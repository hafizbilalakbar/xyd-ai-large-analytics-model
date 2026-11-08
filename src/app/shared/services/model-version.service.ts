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

@Injectable({ providedIn: 'root' })
export class ModelVersionService {
  private readonly versionState = signal<ModelVersionRecord[]>([...INITIAL_VERSIONS]);

  readonly versions = this.versionState.asReadonly();

  readonly activeVersion = computed(
    () => this.versionState().find((item) => item.active) ?? null,
  );

  readonly activeVersionLabel = computed(() => this.activeVersion()?.version ?? '—');

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
