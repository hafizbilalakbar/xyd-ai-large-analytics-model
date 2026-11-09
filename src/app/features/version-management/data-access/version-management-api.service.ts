import { Injectable, inject } from '@angular/core';
import { ModelVersionStore } from '../../../shared/services/model-version.store';
import type { ModelVersionStoreVersion } from '../../../shared/services/model-version.store';
import { CLASS_DISPLAY_NAMES, USE_VERSION_MANAGEMENT_MOCK, classCategory } from './version-management.mock';
import type {
  ActivationApiResponse,
  ApiEvaluationMetrics,
  ApiModelVersion,
  ClassAccuracy,
  DeleteVersionResponse,
  GetClassAccuracyResponse,
  GetVersionsResponse,
} from './version-management.models';

const API_BASE = '/api/v1/models';

interface ApiErrorBody {
  readonly error?: {
    readonly message?: string;
  };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toApiMetrics(record: ModelVersionStoreVersion): ApiEvaluationMetrics | null {
  if (!record.perClassAccuracy || record.perClassAccuracy.length === 0) {
    return null;
  }
  const perClass: Record<string, number | null> = {};
  for (const c of record.perClassAccuracy) {
    perClass[c.code] = c.accuracy / 100;
  }
  return {
    accuracy_macro: record.accuracy,
    accuracy_weighted: null,
    per_class: perClass,
    by_combo: null,
    sample_count: record.sampleSize,
    dropped_count: 0,
    eval_mode: 'cv5',
    is_placeholder: false,
  };
}

function toApiVersion(record: ModelVersionStoreVersion, includeMetrics: boolean): ApiModelVersion {
  const base: ApiModelVersion = {
    version_id: record.id,
    version: record.id,
    type: record.type,
    trained_at: record.trainingDate,
    sample_count: record.sampleSize,
    accuracy_macro: record.accuracy,
    is_active: record.active,
    parent_version_id: null,
    training_scope: null,
    source_task_id: record.sourceTaskId ?? null,
  };
  if (!includeMetrics) {
    return base;
  }
  return { ...base, metrics: toApiMetrics(record) };
}

function roundPercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 1000) / 10;
}

function buildClassAccuracies(
  first: ApiModelVersion,
  second: ApiModelVersion,
): ClassAccuracy[] {
  const firstClasses = first.metrics?.per_class ?? {};
  const secondClasses = second.metrics?.per_class ?? {};
  const codes = Array.from(
    new Set([...Object.keys(firstClasses), ...Object.keys(secondClasses)]),
  ).sort();
  return codes.map((code) => ({
    code,
    category: classCategory(code),
    accuracies: {
      [first.version]: roundPercent(firstClasses[code]),
      [second.version]: roundPercent(secondClasses[code]),
    },
  }));
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new Error(body.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

@Injectable({ providedIn: 'root' })
export class VersionManagementApiService {
  private readonly store: ModelVersionStore = inject(ModelVersionStore);

  async getVersions(): Promise<GetVersionsResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(360);
      const records = this.store.versions() as readonly ModelVersionStoreVersion[];
      return {
        items: records.map((record) => toApiVersion(record, true)),
        default_compare: records.slice(0, 2).map((record) => record.id),
      };
    }
    const response = await fetch('/api/v1/models/versions', { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load versions.');
    }
    const data = (await response.json()) as {
      readonly items: readonly {
        readonly version_id: string;
        readonly version: string;
        readonly type: string;
        readonly trained_at: string | null;
        readonly sample_count: number | null;
        readonly accuracy_macro: number | null;
        readonly is_active: boolean;
        readonly source_task_id?: string | null;
      }[];
      readonly default_compare?: readonly string[];
    };
    const versions = data.items.map((item) => ({
      id: item.version,
      type: item.type as 'basic' | 'local',
      trainingDate: item.trained_at,
      sampleSize: item.sample_count,
      accuracy: item.accuracy_macro,
      perClassAccuracy: [],
      status: item.is_active ? 'Active' : 'Inactive',
      active: item.is_active,
      sourceTaskId: item.source_task_id ?? null,
    }));
    this.store.setVersions(versions);
    return {
      items: versions.map((record) => toApiVersion(record, false)),
      default_compare: data.default_compare?.length ? [...data.default_compare] : versions.slice(0, 2).map((record) => record.id),
    };
  }

  async getVersionDetails(versionId: string): Promise<ApiModelVersion> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(320);
      const record = this.store.versions().find((item: ModelVersionStoreVersion) => item.id === versionId);
      if (!record) {
        throw new Error('Version not found.');
      }
      return toApiVersion(record, true);
    }
    const response = await fetch(`/api/v1/models/${encodeURIComponent(versionId)}`, { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load version details.');
    }
    return (await response.json()) as ApiModelVersion;
  }

  async getClassAccuracy(
    olderVersionId: string,
    newerVersionId: string,
  ): Promise<GetClassAccuracyResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(340);
      const older = (this.store.versions() as readonly ModelVersionStoreVersion[]).find((item: ModelVersionStoreVersion) => item.id === olderVersionId);
      const newer = (this.store.versions() as readonly ModelVersionStoreVersion[]).find((item: ModelVersionStoreVersion) => item.id === newerVersionId);
      if (!older || !newer) {
        throw new Error('Version not found.');
      }
      return {
        classAccuracies: buildClassAccuracies(
          toApiVersion(older, true),
          toApiVersion(newer, true),
        ),
      };
    }
    const response = await fetch(
      `/api/v1/models/compare?v1=${encodeURIComponent(olderVersionId)}&v2=${encodeURIComponent(newerVersionId)}`,
      { method: 'GET' },
    );
    if (!response.ok) {
      throw await parseError(response, 'Failed to load class accuracy.');
    }
    const comparison = (await response.json()) as {
      readonly v1: ApiModelVersion;
      readonly v2: ApiModelVersion;
    };
    return { classAccuracies: buildClassAccuracies(comparison.v1, comparison.v2) };
  }

  async activateVersion(versionId: string): Promise<ActivationApiResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      const startedAt = Date.now();
      await delayMs(340);
      const record = (this.store.versions() as readonly ModelVersionStoreVersion[]).find((item: ModelVersionStoreVersion) => item.id === versionId);
      if (!record) {
        throw new Error('Version not found.');
      }
      if (record.active) {
        throw new Error(`${record.id} is already in use.`);
      }
      return {
        version_id: record.id,
        version: record.id,
        duration_ms: Date.now() - startedAt,
      };
    }
    const response = await fetch(`${API_BASE}/${encodeURIComponent(versionId)}/activate`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to activate version.');
    }
    return (await response.json()) as ActivationApiResponse;
  }

  async deleteVersion(versionId: string): Promise<DeleteVersionResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(340);
      const record = (this.store.versions() as readonly ModelVersionStoreVersion[]).find((item: ModelVersionStoreVersion) => item.id === versionId);
      if (!record) {
        throw new Error('Version not found.');
      }
      if (record.active) {
        throw new Error(`${record.id} is in use. Activate another version before deleting.`);
      }
      return {
        version_id: record.id,
        version: record.id,
      };
    }
    const response = await fetch(`${API_BASE}/${encodeURIComponent(versionId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to delete version.');
    }
    return (await response.json()) as DeleteVersionResponse;
  }
}

export const VERSION_CLASS_NAMES = CLASS_DISPLAY_NAMES;
