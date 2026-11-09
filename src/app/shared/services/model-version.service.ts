import { Injectable, computed, signal } from '@angular/core';

export interface ModelVersionRecord {
  readonly version: string;
  readonly type: 'base' | 'local';
  readonly trainedAt: string | null;
  readonly sampleCount: number | null;
  readonly active: boolean;
}

export interface ModelVersionDraft {
  readonly version: string;
  readonly trainedAt: string | null;
  readonly sampleCount: number | null;
}

const INITIAL_VERSIONS: readonly ModelVersionRecord[] = [
  {
    version: 'V3.0',
    type: 'local',
    trainedAt: null,
    sampleCount: null,
    active: true,
  },
  {
    version: 'V2.0',
    type: 'base',
    trainedAt: null,
    sampleCount: null,
    active: false,
  },
];

export const ACTIVE_MODEL_VERSION_STORAGE_KEY = 'xyd_active_version_v1';

@Injectable({ providedIn: 'root' })
export class ModelVersionService {
  private readonly versionState = signal<ModelVersionRecord[]>([...INITIAL_VERSIONS]);

  readonly versions = this.versionState.asReadonly();

  readonly activeVersion = computed(
    () => this.versionState().find((item) => item.active) ?? null,
  );

  readonly activeVersionLabel = computed(() => this.activeVersion()?.version ?? '—');

  constructor() {
    this.restoreActiveVersion();
  }

  addVersion(draft: ModelVersionDraft): ModelVersionRecord {
    const existing = this.versionState().find((item) => item.version === draft.version);
    if (existing) {
      return existing;
    }
    const record: ModelVersionRecord = {
      version: draft.version,
      type: 'local',
      trainedAt: draft.trainedAt,
      sampleCount: draft.sampleCount,
      active: false,
    };
    this.versionState.update((list) => [record, ...list]);
    return record;
  }

  ensureVersions(records: readonly ModelVersionRecord[]): void {
    this.versionState.update((list) => {
      const next = [...list];
      for (const record of records) {
        const index = next.findIndex((item) => item.version === record.version);
        if (index === -1) {
          next.push({ ...record });
          continue;
        }
        next[index] = {
          ...next[index],
          type: record.type,
          trainedAt: record.trainedAt ?? next[index].trainedAt,
          sampleCount: record.sampleCount ?? next[index].sampleCount,
        };
      }
      return next;
    });
  }

  setActiveVersion(version: string): void {
    this.versionState.update((list) =>
      list.map((item) => ({ ...item, active: item.version === version })),
    );
  }

  private restoreActiveVersion(): void {
    try {
      const stored = localStorage.getItem(ACTIVE_MODEL_VERSION_STORAGE_KEY);
      if (stored === null || stored.length === 0) {
        return;
      }
      this.versionState.update((list) => {
        if (list.some((item) => item.version === stored)) {
          return list.map((item) => ({ ...item, active: item.version === stored }));
        }
        return [
          {
            version: stored,
            type: 'base',
            trainedAt: null,
            sampleCount: null,
            active: true,
          },
          ...list.map((item) => ({ ...item, active: false })),
        ];
      });
    } catch {
      return;
    }
  }

  nextVersion(): string {
    const highest = this.versionState().reduce((max, item) => {
      const match = /^V(\d+)\.(\d+)$/.exec(item.version);
      if (!match) {
        return max;
      }
      return Math.max(max, Number(match[1]) * 1000 + Number(match[2]));
    }, 0);
    const major = Math.floor(highest / 1000);
    const minor = (highest % 1000) + 1;
    return `V${major}.${minor}`;
  }
}
