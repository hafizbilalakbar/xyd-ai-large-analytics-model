import { Injectable } from '@angular/core';
import type { MonitoringRecord } from './monitoring.models';

const API_BASE = '/api/v1/monitor';

interface ApiErrorBody {
  readonly error?: {
    readonly message?: string;
  };
}

function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    return (async () => {
      const body = (await response.json()) as ApiErrorBody;
      return new Error(body.error?.message ?? fallback);
    })();
  } catch {
    return Promise.resolve(new Error(fallback));
  }
}

function toRecord(item: unknown): MonitoringRecord {
  const raw = item as {
    readonly sample_no?: number | string;
    readonly created_at?: string;
    readonly pass_fail?: boolean;
    readonly top_code?: string | null;
    readonly top_confidence?: number | null;
    readonly model_version?: string | null;
    readonly workstation?: string | null;
    readonly torque?: number | null;
    readonly angle?: number | null;
    readonly curve?: readonly { readonly angle: number; readonly torque: number }[] | null;
    readonly results?: readonly { readonly code: string; readonly name: string }[] | null;
  };
  const pass = raw.pass_fail === true;
  return {
    id: String(raw.sample_no ?? ''),
    sampleId: String(raw.sample_no ?? ''),
    workstation: raw.workstation ?? 'WS-01',
    torque: typeof raw.torque === 'number' ? raw.torque : 0,
    angle: typeof raw.angle === 'number' ? raw.angle : 0,
    modelVersion: raw.model_version ?? '—',
    result: pass ? 'PASS' : 'FAIL',
    lockedAt: new Date(raw.created_at ?? ''),
    curve: raw.curve ? [...raw.curve] : [],
  };
}

interface MonitorLatestResponse {
  readonly items?: readonly unknown[];
  readonly active_version?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MonitoringApiService {
  async getLatest(): Promise<{
    readonly items: readonly MonitoringRecord[];
    readonly activeVersion: string | null;
  }> {
    const response = await fetch(`${API_BASE}/latest`, { method: 'GET' });
    if (!response.ok) {
      throw await parseError(response, 'Failed to load monitoring data.');
    }
    const data = (await response.json()) as MonitorLatestResponse;
    return {
      items: (data.items ?? []).map((item) => toRecord(item)),
      activeVersion: data.active_version ?? null,
    };
  }
}
