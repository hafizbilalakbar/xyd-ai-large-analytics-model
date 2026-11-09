import { Injectable, inject } from '@angular/core';
import { ModelVersionService } from '../../../shared/services/model-version.service';
import type { ModelVersionRecord } from '../../../shared/services/model-version.service';
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

interface ApiErrorBody {
  readonly error?: {
    readonly message?: string;
  };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toApiMetrics(record: ModelVersionRecord): ApiEvaluationMetrics | null {
  if (record.metrics === null) {
    return null;
  }
  return {
    accuracy_macro: record.metrics.accuracyMacro,
    accuracy_weighted: record.metrics.accuracyWeighted,
    per_class: { ...record.metrics.perClass },
    by_combo: record.metrics.byCombo === null ? null : { ...record.metrics.byCombo },
    sample_count: record.metrics.sampleCount,
    dropped_count: record.metrics.droppedCount,
    eval_mode: record.metrics.evalMode,
    is_placeholder: record.metrics.isPlaceholder,
  };
}

function toApiVersion(record: ModelVersionRecord, includeMetrics: boolean): ApiModelVersion {
  const base: ApiModelVersion = {
    version_id: record.versionId,
    version: record.version,
    type: record.type,
    trained_at: record.trainedAt,
    sample_count: record.sampleCount,
    accuracy_macro: record.accuracy,
    is_active: record.active,
    parent_version_id: record.parentVersionId,
    training_scope: record.trainingScope,
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
  private readonly versionStore = inject(ModelVersionService);

  async getVersions(): Promise<GetVersionsResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(360);
      const records = this.versionStore.versions();
      return {
        items: records.map((record) => toApiVersion(record, false)),
        default_compare: records.slice(0, 2).map((record) => record.versionId),
      };
    }
    const response = await fetch('/api/v1/models/versions', { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load versions.');
    }
    return (await response.json()) as GetVersionsResponse;
  }

  async getVersionDetails(versionId: number): Promise<ApiModelVersion> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(320);
      const record = this.versionStore.findById(versionId);
      if (record === null) {
        throw new Error('Version not found.');
      }
      return toApiVersion(record, true);
    }
    const response = await fetch(`/api/v1/models/${versionId}`, { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load version details.');
    }
    return (await response.json()) as ApiModelVersion;
  }

  async getClassAccuracy(
    olderVersionId: number,
    newerVersionId: number,
  ): Promise<GetClassAccuracyResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(340);
      const older = this.versionStore.findById(olderVersionId);
      const newer = this.versionStore.findById(newerVersionId);
      if (older === null || newer === null) {
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
      `/api/v1/models/compare?v1=${olderVersionId}&v2=${newerVersionId}`,
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

  async activateVersion(versionId: number): Promise<ActivationApiResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      const startedAt = Date.now();
      await delayMs(340);
      const record = this.versionStore.findById(versionId);
      if (record === null) {
        throw new Error('Version not found.');
      }
      if (record.active) {
        throw new Error(`${record.version} is already in use.`);
      }
      return {
        version_id: record.versionId,
        version: record.version,
        duration_ms: Date.now() - startedAt,
      };
    }
    const response = await fetch(`/api/v1/models/${versionId}/activate`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to activate version.');
    }
    return (await response.json()) as ActivationApiResponse;
  }

  async deleteVersion(versionId: number): Promise<DeleteVersionResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(340);
      const record = this.versionStore.findById(versionId);
      if (record === null) {
        throw new Error('Version not found.');
      }
      if (record.active) {
        throw new Error(`${record.version} is in use. Activate another version before deleting.`);
      }
      return {
        version_id: record.versionId,
        version: record.version,
      };
    }
    const response = await fetch(`/api/v1/models/${versionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to delete version.');
    }
    return (await response.json()) as DeleteVersionResponse;
  }
}

export const VERSION_CLASS_NAMES = CLASS_DISPLAY_NAMES;
