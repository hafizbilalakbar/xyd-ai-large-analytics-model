import { Injectable, inject } from '@angular/core';
import { USE_VERSION_MANAGEMENT_MOCK } from '../../features/version-management/data-access/version-management.mock';
import { ModelVersionStore } from './model-version.store';

const API_BASE = '/api/v1/models';

interface ApiErrorBody {
  readonly error?: {
    readonly message?: string;
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
export class ModelVersionApiService {
  private readonly store = inject(ModelVersionStore);

  async loadVersions(): Promise<void> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      this.store.loadVersions();
      return;
    }
    const response = await fetch(`${API_BASE}/versions`, { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load versions.');
    }
    const data = (await response.json()) as {
      readonly items: readonly {
        readonly version_id: number;
        readonly version: string;
        readonly type: string;
        readonly trained_at: string | null;
        readonly sample_count: number | null;
        readonly accuracy_macro: number | null;
        readonly is_active: boolean;
      }[];
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
      sourceTaskId: null,
    }));
    this.store.setVersions(versions);
  }

  async activateVersion(versionId: string): Promise<void> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      this.store.activateVersion(versionId);
      return;
    }
    const response = await fetch(`${API_BASE}/${encodeURIComponent(versionId)}/activate`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to activate version.');
    }
    this.store.activateVersion(versionId);
  }

  async deleteVersion(versionId: string): Promise<void> {
    if (USE_VERSION_MANAGEMENT_MOCK) {
      this.store.deleteVersion(versionId);
      return;
    }
    const response = await fetch(`${API_BASE}/${encodeURIComponent(versionId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw await parseError(response, 'Failed to delete version.');
    }
    this.store.deleteVersion(versionId);
  }
}
