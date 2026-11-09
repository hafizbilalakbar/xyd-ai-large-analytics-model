import { Injectable } from '@angular/core';
import { ACTIVE_MODEL_VERSION_STORAGE_KEY } from '../../../shared/services/model-version.service';
import {
  MOCK_CLASS_ACCURACY,
  MOCK_VERSION_DETAILS,
  MOCK_VERSIONS,
  USE_VERSION_MANAGEMENT_MOCK,
} from './version-management.mock';
import type {
  ActivateVersionResponse,
  ClassAccuracy,
  GetClassAccuracyResponse,
  GetVersionsResponse,
  VersionDetails,
  VersionSummary,
} from './version-management.models';

const STORAGE_KEY_VERSIONS = 'xyd_versions_v1';
const STORAGE_KEY_ACTIVE = ACTIVE_MODEL_VERSION_STORAGE_KEY;

interface ApiErrorBody {
  readonly error?: {
    readonly message?: string;
  };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function versionWeight(version: string): number {
  const match = /^V(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    return 0;
  }
  return Number(match[1]) * 1000 + Number(match[2]);
}

function sortVersions(versions: readonly VersionSummary[]): VersionSummary[] {
  return [...versions].sort(
    (left, right) => versionWeight(right.version) - versionWeight(left.version),
  );
}

function isVersionSummary(value: unknown): value is VersionSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['version'] === 'string' &&
    (record['type'] === 'base' || record['type'] === 'local') &&
    (record['trainedAt'] === null || typeof record['trainedAt'] === 'string') &&
    (record['sampleSize'] === null || typeof record['sampleSize'] === 'number') &&
    (record['accuracy'] === null || typeof record['accuracy'] === 'number') &&
    typeof record['active'] === 'boolean'
  );
}

function readStoredVersions(): VersionSummary[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERSIONS);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isVersionSummary)) {
      return null;
    }
    return parsed.map((item) => ({ ...item }));
  } catch {
    return null;
  }
}

function readStoredActiveVersion(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY_ACTIVE);
    return value !== null && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveStoredState(versions: readonly VersionSummary[], activeVersion: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_VERSIONS, JSON.stringify(versions));
    localStorage.setItem(STORAGE_KEY_ACTIVE, activeVersion);
  } catch {
    return;
  }
}

function cloneDefaults(): VersionSummary[] {
  return MOCK_VERSIONS.map((version) => ({ ...version }));
}

function cloneClassAccuracy(metric: ClassAccuracy): ClassAccuracy {
  return {
    ...metric,
    accuracies: { ...metric.accuracies },
  };
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
  async getVersions(): Promise<GetVersionsResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(360);
      return { versions: this.loadVersions() };
    }
    const response = await fetch('/api/v1/models/versions', { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load versions.');
    }
    return (await response.json()) as GetVersionsResponse;
  }

  async getVersionDetails(version: string): Promise<VersionDetails> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(320);
      return this.buildDetails(version);
    }
    const response = await fetch(`/api/v1/models/versions/${encodeURIComponent(version)}`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load version details.');
    }
    return (await response.json()) as VersionDetails;
  }

  async getClassAccuracy(
    olderVersion: string,
    newerVersion: string,
  ): Promise<GetClassAccuracyResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      await delayMs(340);
      return {
        classAccuracies: MOCK_CLASS_ACCURACY.map(cloneClassAccuracy),
      };
    }
    const response = await fetch(
      `/api/v1/models/compare?v1=${encodeURIComponent(olderVersion)}&v2=${encodeURIComponent(newerVersion)}`,
      { method: 'GET' },
    );
    if (!response.ok) {
      throw await parseError(response, 'Failed to load class accuracy.');
    }
    return (await response.json()) as GetClassAccuracyResponse;
  }

  async activateVersion(version: string): Promise<ActivateVersionResponse> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      const startedAt = Date.now();
      await delayMs(340);
      const versions = this.loadVersions();
      if (!versions.some((item) => item.version === version)) {
        throw new Error('Version not found.');
      }
      const previousVersion = versions.find((item) => item.active)?.version ?? null;
      const updated = sortVersions(
        versions.map((item) => ({ ...item, active: item.version === version })),
      );
      saveStoredState(updated, version);
      return {
        success: true,
        activatedVersion: version,
        previousVersion,
        durationMs: Date.now() - startedAt,
      };
    }
    const response = await fetch(`/api/v1/models/${encodeURIComponent(version)}/activate`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to activate version.');
    }
    return (await response.json()) as ActivateVersionResponse;
  }

  private loadVersions(): VersionSummary[] {
    const stored = readStoredVersions();
    if (stored === null) {
      saveStoredState(cloneDefaults(), 'V3.0');
      return cloneDefaults();
    }
    const activeVersion = readStoredActiveVersion();
    if (activeVersion !== null && stored.some((item) => item.version === activeVersion)) {
      return sortVersions(
        stored.map((item) => ({ ...item, active: item.version === activeVersion })),
      );
    }
    const existingActive = stored.find((item) => item.active)?.version ?? null;
    if (existingActive !== null) {
      return sortVersions(
        stored.map((item) => ({ ...item, active: item.version === existingActive })),
      );
    }
    return sortVersions(stored.map((item) => ({ ...item, active: item.version === stored[0].version })));
  }

  private buildDetails(version: string): VersionDetails {
    const summary = this.loadVersions().find((item) => item.version === version) ?? null;
    const detail = MOCK_VERSION_DETAILS.find((item) => item.version === version) ?? null;
    return {
      version,
      type: summary?.type ?? detail?.type ?? 'base',
      trainedAt: summary?.trainedAt ?? detail?.trainedAt ?? null,
      sampleSize: summary?.sampleSize ?? detail?.sampleSize ?? null,
      accuracy: summary?.accuracy ?? detail?.accuracy ?? null,
      active: summary?.active ?? false,
      evalMode: detail?.evalMode ?? null,
      trainingScope: detail?.trainingScope ?? null,
    };
  }
}
