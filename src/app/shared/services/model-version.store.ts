import { Injectable, computed, signal, Signal } from '@angular/core';
import type { TrainingMetrics } from '../../features/training-tasks/data-access/training-task.models';

export type ModelVersionType = 'basic' | 'local';

export type ModelEvaluationMode = 'cv5' | 'trainset';

export type TrainingTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export type TrainingScope = 'single_station' | 'all_stations';

export interface ModelVersionStoreVersion {
  readonly id: string;
  readonly type: ModelVersionType;
  readonly trainingDate: string | null;
  readonly sampleSize: number | null;
  readonly accuracy: number | null;
  readonly perClassAccuracy: readonly { code: string; name?: string; accuracy: number }[];
  readonly status: string;
  readonly active: boolean;
  readonly sourceTaskId: string | null;
}

export interface TrainingTaskStoreTask {
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
  readonly logSummary: string | null;
  readonly metrics: TrainingMetrics | null;
}

const STORAGE_KEY = 'xyd_model_versions_v3';
const STORAGE_KEY_ACTIVE = 'xyd_active_version_v3';
const STORAGE_KEY_TASKS = 'xyd_model_versions_tasks_v3';

const VERSION_ID_PATTERN = /^V(\d+)\.(\d+)$/;

function versionWeight(version: string): number {
  const match = VERSION_ID_PATTERN.exec(version);
  if (match === null) {
    return 0;
  }
  return Number(match[1]) * 1000 + Number(match[2]);
}

function sortDescending(records: readonly ModelVersionStoreVersion[]): ModelVersionStoreVersion[] {
  return [...records].sort(
    (left, right) => versionWeight(right.id) - versionWeight(left.id),
  );
}

function isValidVersionId(id: string): boolean {
  return VERSION_ID_PATTERN.test(id);
}

function persistToStorage(versions: ModelVersionStoreVersion[], active: string | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    if (active !== null) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, active);
    }
  } catch {
    return;
  }
}

function persistTasks(tasks: TrainingTaskStoreTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class ModelVersionStore {
  private readonly versionsState = signal<ModelVersionStoreVersion[]>([]);
  private readonly tasksState = signal<TrainingTaskStoreTask[]>([]);
  private readonly trainingState = signal(false);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly versions: Signal<readonly ModelVersionStoreVersion[]> = this.versionsState.asReadonly();
  readonly tasks: Signal<readonly TrainingTaskStoreTask[]> = this.tasksState.asReadonly();
  readonly trainingInProgress = this.trainingState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();

  readonly activeVersionId = computed(() => {
    const versions = this.versionsState();
    const active = versions.find((item) => item.active);
    return active?.id ?? null;
  });

  readonly activeVersion = computed(() => {
    return this.versionsState().find((item) => item.active) ?? null;
  });

  readonly previousVersion = computed(() => {
    const sorted = sortDescending(this.versionsState());
    const activeId = this.activeVersionId();
    const idx = sorted.findIndex((item) => item.id === activeId);
    if (idx === -1 || idx === sorted.length - 1) {
      return sorted.length > 1 ? sorted[0] : null;
    }
    return sorted[idx + 1];
  });

  readonly sortedVersions = computed(() => sortDescending(this.versionsState()));

  constructor() {
    // Start empty; pages populate from the backend via load(). No localStorage restore,
    // so deleted items never come back from a stale local copy.
    this.versionsState.set([]);
    this.tasksState.set([]);
  }

  loadVersions(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.loadingState.set(false);
  }

  setTasks(tasks: readonly TrainingTaskStoreTask[]): void {
    this.tasksState.update(() => [...tasks].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    ));
    persistTasks(this.tasksState());
  }

  activateVersion(id: string): void {
    const target = this.versionsState().find((item) => item.id === id);
    if (!target || target.active) {
      return;
    }
    this.versionsState.update((list) =>
      list.map((item) => ({ ...item, active: item.id === id })),
    );
    persistToStorage(this.versionsState(), this.activeVersionId());
  }

  deleteVersion(id: string): { ok: boolean; reason: string | null } {
    const record = this.versionsState().find((item) => item.id === id);
    if (!record) {
      return { ok: false, reason: 'Version not found.' };
    }
    if (record.active) {
      return { ok: false, reason: `${record.id} is in use. Activate another version before deleting.` };
    }
    const versionCount = this.versionsState().length;
    if (versionCount <= 2) {
      return { ok: false, reason: 'Cannot delete the last remaining version.' };
    }
    this.versionsState.update((list) => list.filter((item) => item.id !== id));
    persistToStorage(this.versionsState(), this.activeVersionId());
    return { ok: true, reason: null };
  }

  addVersion(version: {
    id: string;
    type: ModelVersionType;
    trainingDate: string | null;
    sampleSize: number | null;
    accuracy: number | null;
    perClassAccuracy?: readonly { code: string; name?: string; accuracy: number }[];
    status?: string;
    sourceTaskId?: string | null;
  }): ModelVersionStoreVersion {
    const existing = this.versionsState().find((item) => item.id === version.id);
    if (existing) {
      return existing;
    }
    if (!isValidVersionId(version.id)) {
      throw new Error(`Invalid version id: ${version.id}`);
    }
    const record: ModelVersionStoreVersion = {
      id: version.id,
      type: version.type,
      trainingDate: version.trainingDate,
      sampleSize: version.sampleSize,
      accuracy: version.accuracy,
      perClassAccuracy: version.perClassAccuracy ?? [],
      status: version.status ?? 'Inactive',
      active: false,
      sourceTaskId: version.sourceTaskId ?? null,
    };
    this.versionsState.update((list) => sortDescending([record, ...list]));
    persistToStorage(this.versionsState(), this.activeVersionId());
    return record;
  }

  setVersions(versions: ModelVersionStoreVersion[]): void {
    this.versionsState.update(() => sortDescending(versions));
    persistToStorage(this.versionsState(), this.activeVersionId());
  }

  setPersistedActive(active: string | null): void {
    persistToStorage(this.versionsState(), active);
  }

  nextVersion(): string {
    const highestMajor = this.versionsState().reduce((max, item) => {
      const match = VERSION_ID_PATTERN.exec(item.id);
      if (!match) {
        return max;
      }
      return Math.max(max, Number(match[1]));
    }, 0);
    return `V${highestMajor + 1}.0`;
  }

  setTrainingInProgress(value: boolean): void {
    this.trainingState.set(value);
  }

  findTask(taskId: string): TrainingTaskStoreTask | null {
    return this.tasksState().find((item) => item.taskId === taskId) ?? null;
  }

  findByVersion(version: string): ModelVersionStoreVersion | null {
    return this.versionsState().find((item) => item.id === version) ?? null;
  }

  findBySourceTaskId(sourceTaskId: string): ModelVersionStoreVersion | null {
    return this.versionsState().find((item) => item.sourceTaskId === sourceTaskId) ?? null;
  }

  addTask(draft: {
    taskId: string;
    status: TrainingTaskStatus;
    scope: TrainingScope;
    sampleCount: number | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
    progress: number;
    modelVersion: string | null;
    modelVersionId: string | null;
    createdVersionId: number | null;
  }): TrainingTaskStoreTask {
    const existing = this.tasksState().find((item) => item.taskId === draft.taskId);
    if (existing) {
      return existing;
    }
    const task: TrainingTaskStoreTask = {
      ...draft,
      deleted: false,
      logSummary: null,
      metrics: null,
    };
    this.tasksState.update((list) => [task, ...list]);
    persistTasks(this.tasksState());
    return task;
  }

  updateTask(taskId: string, updates: Partial<TrainingTaskStoreTask>): TrainingTaskStoreTask | null {
    let result: TrainingTaskStoreTask | null = null;
    this.tasksState.update((list) =>
      list.map((item) => {
        if (item.taskId !== taskId) {
          return item;
        }
        const next: TrainingTaskStoreTask = { ...item, ...updates };
        result = next;
        return next;
      }),
    );
    if (result !== null) {
      persistTasks(this.tasksState());
    }
    return result;
  }

  terminateTask(taskId: string): TrainingTaskStoreTask | null {
    const task = this.findTask(taskId);
    if (!task) {
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

  canDeleteVersion(id: string): { allowed: boolean; reason: string | null } {
    const record = this.versionsState().find((item) => item.id === id);
    if (!record) {
      return { allowed: false, reason: 'Version not found.' };
    }
    if (record.active) {
      return { allowed: false, reason: `${record.id} is in use. Activate another version before deleting.` };
    }
    const versionCount = this.versionsState().length;
    if (versionCount <= 2) {
      return { allowed: false, reason: 'Cannot delete the last remaining version.' };
    }
    return { allowed: true, reason: null };
  }

  canDeleteTask(taskId: string): { allowed: boolean; reason: string | null } {
    const task = this.findTask(taskId);
    if (!task) {
      return { allowed: false, reason: 'Task not found.' };
    }
    if (task.status === 'pending' || task.status === 'running') {
      return { allowed: false, reason: 'Running tasks cannot be deleted.' };
    }
    return { allowed: true, reason: null };
  }

  deleteTaskWithVersion(taskId: string): { ok: boolean; reason: string | null; deletedVersion?: string } {
    const task = this.findTask(taskId);
    if (!task) {
      return { ok: false, reason: 'Task not found.' };
    }
    if (task.status === 'pending' || task.status === 'running') {
      return { ok: false, reason: 'Running tasks cannot be deleted.' };
    }

    const createdVersionId = task.createdVersionId;
    let deletedVersion: string | undefined;

    if (createdVersionId !== null) {
      const version = this.findBySourceTaskId(taskId);
      if (version) {
        const canDelete = this.canDeleteVersion(version.id);
        if (!canDelete.allowed) {
          return { ok: false, reason: canDelete.reason };
        }
        this.versionsState.update((list) => list.filter((item) => item.id !== version.id));
        deletedVersion = version.id;
      }
    }

    this.tasksState.update((list) => list.filter((item) => item.taskId !== taskId));
    persistToStorage(this.versionsState(), this.activeVersionId());
    persistTasks(this.tasksState());

    return { ok: true, reason: null, deletedVersion };
  }

  deleteVersionWithTask(versionId: string): { ok: boolean; reason: string | null; deletedTaskId?: string } {
    const record = this.versionsState().find((item) => item.id === versionId);
    if (!record) {
      return { ok: false, reason: 'Version not found.' };
    }
    if (record.active) {
      return { ok: false, reason: `${record.id} is in use. Activate another version before deleting.` };
    }
    const versionCount = this.versionsState().length;
    if (versionCount <= 2) {
      return { ok: false, reason: 'Cannot delete the last remaining version.' };
    }

    const sourceTaskId = record.sourceTaskId;
    let deletedTaskId: string | undefined;

    if (sourceTaskId !== null) {
      const task = this.findTask(sourceTaskId);
      if (task) {
        const canDelete = this.canDeleteTask(sourceTaskId);
        if (!canDelete.allowed) {
          return { ok: false, reason: canDelete.reason };
        }
        this.tasksState.update((list) => list.filter((item) => item.taskId !== sourceTaskId));
        deletedTaskId = sourceTaskId;
      }
    }

    this.versionsState.update((list) => list.filter((item) => item.id !== versionId));
    persistToStorage(this.versionsState(), this.activeVersionId());
    persistTasks(this.tasksState());

    return { ok: true, reason: null, deletedTaskId };
  }
}
