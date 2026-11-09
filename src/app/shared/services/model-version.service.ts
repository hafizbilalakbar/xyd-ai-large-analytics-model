import { Injectable, computed, signal } from '@angular/core';
import type { TrainingMetrics } from '../../features/training-tasks/data-access/training-task.models';

export type ModelVersionType = 'basic' | 'local';

export type ModelEvaluationMode = 'cv5' | 'trainset';

export type TrainingTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export type TrainingScope = 'single_station' | 'all_stations';

export interface ModelVersionEvaluation {
  readonly accuracyMacro: number | null;
  readonly accuracyWeighted: number | null;
  readonly perClass: Readonly<Record<string, number | null>>;
  readonly byCombo: Readonly<Record<string, number | null>> | null;
  readonly sampleCount: number | null;
  readonly droppedCount: number;
  readonly evalMode: ModelEvaluationMode | null;
  readonly isPlaceholder: boolean;
}

export interface ModelVersionRecord {
  readonly versionId: number;
  readonly version: string;
  readonly type: ModelVersionType;
  readonly trainedAt: string | null;
  readonly sampleCount: number | null;
  readonly accuracy: number | null;
  readonly active: boolean;
  readonly metrics: ModelVersionEvaluation | null;
  readonly parentVersionId: number | null;
  readonly trainingScope: string | null;
  readonly sourceTaskId: string | null;
}

export interface ModelVersionDraft {
  readonly version: string;
  readonly trainedAt: string | null;
  readonly sampleCount: number | null;
  readonly accuracy?: number | null;
  readonly metrics?: ModelVersionEvaluation | null;
  readonly trainingScope?: string | null;
  readonly parentVersionId?: number | null;
  readonly type?: ModelVersionType;
  readonly sourceTaskId?: string | null;
}

export interface TrainingTask {
  readonly taskId: string;
  readonly status: TrainingTaskStatus;
  readonly scope: TrainingScope;
  readonly sampleCount: number | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly progress: number;
  readonly modelVersion: string | null;
  readonly modelVersionId: string | null;
  readonly createdVersionId: number | null;
  readonly deleted: boolean;
  readonly metrics: TrainingMetrics | null;
  readonly logSummary: string | null;
}

export interface TrainingTaskDraft {
  readonly taskId: string;
  readonly status: TrainingTaskStatus;
  readonly scope: TrainingScope;
  readonly sampleCount: number | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly progress: number;
  readonly modelVersion: string | null;
  readonly modelVersionId: string | null;
  readonly createdVersionId: number | null;
  readonly metrics: TrainingMetrics | null;
  readonly logSummary: string | null;
}

const VERSIONS_STORAGE_KEY = 'xyd_model_versions_v3';
const TASKS_STORAGE_KEY = 'xyd_training_tasks_v3';

export const ACTIVE_MODEL_VERSION_STORAGE_KEY = 'xyd_active_version_v1';

const V3_METRICS: ModelVersionEvaluation = {
  accuracyMacro: 0.9563,
  accuracyWeighted: 0.9929,
  perClass: {
    PASS: 0.9963,
    F01: 1,
    F02: 0.9615,
    F03: 1,
    F04: 0.8696,
    F05: 0.9406,
    F06: 0.8824,
    F08: 1,
  },
  byCombo: { C1: null, C2: null, C3: null, C4: null },
  sampleCount: 3254,
  droppedCount: 0,
  evalMode: 'cv5',
  isPlaceholder: false,
};

const V2_METRICS: ModelVersionEvaluation = {
  accuracyMacro: 0.9581,
  accuracyWeighted: 0.9893,
  perClass: {
    PASS: 0.9975,
    F01: 1,
    F02: 1,
    F03: 0.9857,
    F04: 0.8696,
    F05: 0.9293,
    F06: 0.8824,
    F08: 1,
  },
  byCombo: { C1: null, C2: null, C3: null, C4: null },
  sampleCount: 1499,
  droppedCount: 0,
  evalMode: 'cv5',
  isPlaceholder: false,
};

const V1_METRICS: ModelVersionEvaluation = {
  accuracyMacro: 0.945,
  accuracyWeighted: 0.991,
  perClass: {
    PASS: 0.9900,
    F01: 0.985,
    F02: 0.950,
    F03: 0.970,
    F04: 0.880,
    F05: 0.930,
    F06: 0.890,
    F08: 0.990,
  },
  byCombo: { C1: null, C2: null, C3: null, C4: null },
  sampleCount: 800,
  droppedCount: 0,
  evalMode: 'cv5',
  isPlaceholder: false,
};

const INITIAL_VERSIONS: readonly ModelVersionRecord[] = [
  {
    versionId: 2,
    version: 'V3.0',
    type: 'basic',
    trainedAt: '2026/11/2',
    sampleCount: 3254,
    accuracy: 0.9563,
    active: true,
    metrics: V3_METRICS,
    parentVersionId: null,
    trainingScope: null,
    sourceTaskId: null,
  },
  {
    versionId: 1,
    version: 'V2.0',
    type: 'basic',
    trainedAt: '2026/11/2',
    sampleCount: 1499,
    accuracy: 0.9581,
    active: false,
    metrics: V2_METRICS,
    parentVersionId: null,
    trainingScope: null,
    sourceTaskId: null,
  },
  {
    versionId: 3,
    version: 'V1.0',
    type: 'basic',
    trainedAt: '2026/11/2',
    sampleCount: 800,
    accuracy: 0.945,
    active: false,
    metrics: V1_METRICS,
    parentVersionId: null,
    trainingScope: null,
    sourceTaskId: null,
  },
];

function cloneEvaluation(value: ModelVersionEvaluation | null): ModelVersionEvaluation | null {
  if (value === null) {
    return null;
  }
  return {
    ...value,
    perClass: { ...value.perClass },
    byCombo: value.byCombo === null ? null : { ...value.byCombo },
  };
}

function cloneRecord(record: ModelVersionRecord): ModelVersionRecord {
  return {
    ...record,
    metrics: cloneEvaluation(record.metrics),
  };
}

function cloneDefaults(): ModelVersionRecord[] {
  return INITIAL_VERSIONS.map(cloneRecord);
}

function cloneTask(task: TrainingTask): TrainingTask {
  return { ...task };
}

function versionWeight(version: string): number {
  const match = /^V(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    return 0;
  }
  return Number(match[1]) * 1000 + Number(match[2]);
}

function sortDescending(records: readonly ModelVersionRecord[]): ModelVersionRecord[] {
  return [...records].sort(
    (left, right) => versionWeight(right.version) - versionWeight(left.version),
  );
}

function formatStoredDate(value: string | null): string | null {
  if (value === null || value.length === 0) {
    return null;
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRecordMap(value: unknown): value is Record<string, number | null> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(
    (item) => item === null || (typeof item === 'number' && Number.isFinite(item)),
  );
}

function isEvaluation(value: unknown): value is ModelVersionEvaluation {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value['accuracyMacro'] === null || typeof value['accuracyMacro'] === 'number') &&
    (value['accuracyWeighted'] === null || typeof value['accuracyWeighted'] === 'number') &&
    isRecordMap(value['perClass']) &&
    (value['byCombo'] === null || isRecordMap(value['byCombo'])) &&
    (value['sampleCount'] === null || typeof value['sampleCount'] === 'number') &&
    typeof value['droppedCount'] === 'number' &&
    (value['evalMode'] === null ||
      value['evalMode'] === 'cv5' ||
      value['evalMode'] === 'trainset') &&
    typeof value['isPlaceholder'] === 'boolean'
  );
}

function isModelVersionRecord(value: unknown): value is ModelVersionRecord {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value['versionId'] === 'number' &&
    typeof value['version'] === 'string' &&
    (value['type'] === 'basic' || value['type'] === 'local') &&
    (value['trainedAt'] === null || typeof value['trainedAt'] === 'string') &&
    (value['sampleCount'] === null || typeof value['sampleCount'] === 'number') &&
    (value['accuracy'] === null || typeof value['accuracy'] === 'number') &&
    typeof value['active'] === 'boolean' &&
    (value['metrics'] === null || isEvaluation(value['metrics'])) &&
    (value['parentVersionId'] === null || typeof value['parentVersionId'] === 'number') &&
    (value['trainingScope'] === null || typeof value['trainingScope'] === 'string') &&
    (value['sourceTaskId'] === null || typeof value['sourceTaskId'] === 'string')
  );
}

function isTrainingTaskStatus(value: unknown): value is TrainingTaskStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'done' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function isTrainingScope(value: unknown): value is TrainingScope {
  return value === 'single_station' || value === 'all_stations';
}

function isTrainingTask(value: unknown): value is TrainingTask {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value['taskId'] === 'string' &&
    isTrainingTaskStatus(value['status']) &&
    isTrainingScope(value['scope']) &&
    (value['sampleCount'] === null || typeof value['sampleCount'] === 'number') &&
    typeof value['createdAt'] === 'string' &&
    (value['startedAt'] === null || typeof value['startedAt'] === 'string') &&
    (value['finishedAt'] === null || typeof value['finishedAt'] === 'string') &&
    (value['durationMs'] === null || typeof value['durationMs'] === 'number') &&
    typeof value['progress'] === 'number' &&
    (value['modelVersion'] === null || typeof value['modelVersion'] === 'string') &&
    (value['modelVersionId'] === null || typeof value['modelVersionId'] === 'string') &&
    (value['createdVersionId'] === null || typeof value['createdVersionId'] === 'number') &&
    typeof value['deleted'] === 'boolean'
  );
}

function readStoredVersions(): ModelVersionRecord[] | null {
  try {
    const raw = localStorage.getItem(VERSIONS_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isModelVersionRecord)) {
      return null;
    }
    return parsed.map(cloneRecord);
  } catch {
    return null;
  }
}

function readStoredTasks(): TrainingTask[] | null {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isTrainingTask)) {
      return null;
    }
    return parsed.map(cloneTask);
  } catch {
    return null;
  }
}

function readStoredActiveVersion(): string | null {
  try {
    const value = localStorage.getItem(ACTIVE_MODEL_VERSION_STORAGE_KEY);
    return value !== null && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class ModelVersionService {
  private readonly versionState = signal<ModelVersionRecord[]>(cloneDefaults());
  private readonly taskState = signal<TrainingTask[]>([]);
  private readonly trainingState = signal(false);

  readonly versions = this.versionState.asReadonly();
  readonly tasks = this.taskState.asReadonly();
  readonly trainingInProgress = this.trainingState.asReadonly();

  readonly activeVersion = computed(
    () => this.versionState().find((item) => item.active) ?? null,
  );

  readonly activeVersionLabel = computed(() => this.activeVersion()?.version ?? '—');

  constructor() {
    this.restore();
  }

  addVersion(draft: ModelVersionDraft): ModelVersionRecord {
    const existing = this.versionState().find((item) => item.version === draft.version);
    if (existing) {
      return existing;
    }
    const nextId =
      this.versionState().reduce((max, item) => Math.max(max, item.versionId), 0) + 1;
    const active = this.activeVersion();
    const record: ModelVersionRecord = {
      versionId: nextId,
      version: draft.version,
      type: draft.type ?? 'local',
      trainedAt: formatStoredDate(draft.trainedAt),
      sampleCount: draft.sampleCount,
      accuracy: draft.accuracy ?? draft.metrics?.accuracyMacro ?? null,
      active: false,
      metrics: cloneEvaluation(draft.metrics ?? null),
      parentVersionId: draft.parentVersionId ?? active?.versionId ?? null,
      trainingScope: draft.trainingScope ?? null,
      sourceTaskId: draft.sourceTaskId ?? null,
    };
    this.versionState.update((list) => sortDescending([record, ...list]));
    this.persist();
    return record;
  }

  syncVersions(records: readonly ModelVersionRecord[]): void {
    const previous = new Map(this.versionState().map((item) => [item.version, item]));
    this.versionState.update(() => {
      const merged = records.map((record) => {
        const prior = previous.get(record.version);
        return cloneRecord({
          ...record,
          trainedAt: formatStoredDate(record.trainedAt),
          metrics: record.metrics ?? prior?.metrics ?? null,
          parentVersionId: record.parentVersionId ?? prior?.parentVersionId ?? null,
          trainingScope: record.trainingScope ?? prior?.trainingScope ?? null,
          sourceTaskId: record.sourceTaskId ?? prior?.sourceTaskId ?? null,
        });
      });
      const sorted = sortDescending(merged);
      if (sorted.length === 0) {
        return [];
      }
      if (!sorted.some((item) => item.active)) {
        const priorActive = sorted.find((item) => previous.get(item.version)?.active);
        const fallback = priorActive ?? sorted[0];
        return sorted.map((item) => ({ ...item, active: item.version === fallback.version }));
      }
      return sorted;
    });
    this.persist();
  }

  findById(versionId: number): ModelVersionRecord | null {
    return this.versionState().find((item) => item.versionId === versionId) ?? null;
  }

  findByVersion(version: string): ModelVersionRecord | null {
    return this.versionState().find((item) => item.version === version) ?? null;
  }

  setActiveVersionById(versionId: number): void {
    this.versionState.update((list) =>
      list.map((item) => ({ ...item, active: item.versionId === versionId })),
    );
    this.persist();
  }

  setActiveVersion(version: string): void {
    const target = this.findByVersion(version);
    if (target !== null) {
      this.setActiveVersionById(target.versionId);
    }
  }

  setTrainingInProgress(value: boolean): void {
    this.trainingState.set(value);
  }

  nextVersion(): string {
    const highestMajor = this.versionState().reduce((max, item) => {
      const match = /^V(\d+)\./.exec(item.version);
      if (!match) {
        return max;
      }
      return Math.max(max, Number(match[1]));
    }, 0);
    return `V${highestMajor + 1}.0`;
  }

  findTask(taskId: string): TrainingTask | null {
    return this.taskState().find((item) => item.taskId === taskId) ?? null;
  }

  addTask(draft: TrainingTaskDraft): TrainingTask {
    const existing = this.taskState().find((item) => item.taskId === draft.taskId);
    if (existing) {
      return existing;
    }
    const task: TrainingTask = {
      ...draft,
      deleted: false,
    };
    this.taskState.update((list) => [task, ...list]);
    this.persist();
    return task;
  }

  updateTask(taskId: string, updates: Partial<TrainingTask>): TrainingTask | null {
    let result: TrainingTask | null = null;
    this.taskState.update((list) =>
      list.map((item) => {
        if (item.taskId !== taskId) {
          return item;
        }
        const next: TrainingTask = { ...item, ...updates };
        result = next;
        return next;
      }),
    );
    if (result !== null) {
      this.persist();
    }
    return result;
  }

  terminateTask(taskId: string): TrainingTask | null {
    const task = this.findTask(taskId);
    if (task === null) {
      return null;
    }
    if (task.status !== 'pending' && task.status !== 'running') {
      return null;
    }
    const now = new Date();
    const startedAt = task.startedAt ?? task.createdAt;
    const elapsed = now.getTime() - Date.parse(startedAt);
    return this.updateTask(taskId, {
      status: 'cancelled',
      finishedAt: now.toISOString(),
      durationMs: elapsed,
    });
  }

  canDeleteVersion(versionId: number): { allowed: boolean; reason: string | null } {
    const record = this.findById(versionId);
    if (record === null) {
      return { allowed: false, reason: 'Version not found.' };
    }
    if (record.active) {
      return { allowed: false, reason: `${record.version} is in use. Activate another version before deleting.` };
    }
    const versionCount = this.versionState().length;
    if (versionCount <= 2) {
      return { allowed: false, reason: 'Cannot delete the last remaining version.' };
    }
    return { allowed: true, reason: null };
  }

  canDeleteTask(taskId: string): { allowed: boolean; reason: string | null } {
    const task = this.findTask(taskId);
    if (task === null) {
      return { allowed: false, reason: 'Task not found.' };
    }
    if (task.status === 'pending' || task.status === 'running') {
      return { allowed: false, reason: 'Running tasks cannot be deleted.' };
    }
    return { allowed: true, reason: null };
  }

  deleteTaskWithVersion(taskId: string): { ok: boolean; reason: string | null; deletedVersion?: string } {
    const task = this.findTask(taskId);
    if (task === null) {
      return { ok: false, reason: 'Task not found.' };
    }
    if (task.status === 'pending' || task.status === 'running') {
      return { ok: false, reason: 'Running tasks cannot be deleted.' };
    }

    const createdVersionId = task.createdVersionId;
    let deletedVersion: string | undefined;

    if (createdVersionId !== null) {
      const version = this.findById(createdVersionId);
      if (version !== null) {
        const canDelete = this.canDeleteVersion(createdVersionId);
        if (!canDelete.allowed) {
          return { ok: false, reason: canDelete.reason };
        }
        this.versionState.update((list) =>
          list.filter((item) => item.versionId !== createdVersionId),
        );
        deletedVersion = version.version;
      }
    }

    this.taskState.update((list) => list.filter((item) => item.taskId !== taskId));
    this.persist();

    return { ok: true, reason: null, deletedVersion };
  }

  deleteVersionWithTask(versionId: number): { ok: boolean; reason: string | null; deletedTaskId?: string } {
    const record = this.findById(versionId);
    if (record === null) {
      return { ok: false, reason: 'Version not found.' };
    }
    if (record.active) {
      return { ok: false, reason: `${record.version} is in use. Activate another version before deleting.` };
    }
    const versionCount = this.versionState().length;
    if (versionCount <= 2) {
      return { ok: false, reason: 'Cannot delete the last remaining version.' };
    }

    const sourceTaskId = record.sourceTaskId;
    let deletedTaskId: string | undefined;

    if (sourceTaskId !== null) {
      const task = this.findTask(sourceTaskId);
      if (task !== null) {
        const canDelete = this.canDeleteTask(sourceTaskId);
        if (!canDelete.allowed) {
          return { ok: false, reason: canDelete.reason };
        }
        this.taskState.update((list) => list.filter((item) => item.taskId !== sourceTaskId));
        deletedTaskId = sourceTaskId;
      }
    }

    this.versionState.update((list) => list.filter((item) => item.versionId !== versionId));
    this.persist();

    return { ok: true, reason: null, deletedTaskId };
  }

  private persist(): void {
    try {
      localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(this.versionState()));
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(this.taskState()));
      localStorage.setItem(ACTIVE_MODEL_VERSION_STORAGE_KEY, this.activeVersion()?.version ?? '');
    } catch {
      return;
    }
  }

  private restore(): void {
    const stored = readStoredVersions();
    const list = stored ?? cloneDefaults();
    const activeLabel = readStoredActiveVersion();
    let restored: ModelVersionRecord[];

    if (activeLabel !== null && list.some((item) => item.version === activeLabel)) {
      restored = list.map((item) => ({ ...item, active: item.version === activeLabel }));
    } else if (list.some((item) => item.active)) {
      restored = list;
    } else {
      restored = list.map((item) => ({ ...item, active: item.version === list[0].version }));
    }

    this.versionState.set(sortDescending(restored));
    if (stored === null) {
      this.persist();
    }

    const storedTasks = readStoredTasks();
    if (storedTasks !== null) {
      this.taskState.set(storedTasks);
    }
  }
}
