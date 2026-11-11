import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ModelVersionStore, type TrainingTaskStoreTask } from '../../../shared/services/model-version.store';
import { OperationLogService } from '../../../shared/services/operation-log.service';
import { AuditLogService } from '../../../core/logging/audit-log.service';
import { LOG_ACTIONS } from '../../../core/logging/log-actions';
import { ToastService } from '../../../shared/services/toast.service';
import { TrainingTaskApiService } from './training-task-api.service';
import { VersionManagementApiService } from '../../version-management/data-access/version-management-api.service';
import {
  TrainingJob,
  TrainingPreview,
  isActiveTrainingStatus,
  trainingScopeLabel,
} from './training-task.models';
import { TRAINING_POLL_INTERVAL_MS } from './training-task.mock';

export type TrainingListState = 'loading' | 'ok' | 'empty' | 'error';

@Injectable({ providedIn: 'root' })
export class TrainingTasksService {
  private readonly api = inject(TrainingTaskApiService);
  private readonly versionApi = inject(VersionManagementApiService);
  private readonly toast = inject(ToastService);
  private readonly operationLog = inject(OperationLogService);
  private readonly auditLog = inject(AuditLogService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(ModelVersionStore);

  private readonly previousStatuses = new Map<string, TrainingJob['status']>();
  private listTimer: number | null = null;
  private detailTimer: number | null = null;

  readonly preview = signal<TrainingPreview | null>(null);
  readonly jobs = computed(() =>
    this.store.tasks()
      .filter((task) => !task.deleted)
      .map((task) => toJob(task)),
  );
  readonly listState = signal<TrainingListState>('loading');
  readonly isPreviewLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly traceId = signal('');
  readonly isStarting = signal(false);
  readonly cancellingTaskId = signal<string | null>(null);
  readonly detail = signal<TrainingJob | null>(null);
  readonly detailOpen = signal(false);
  readonly confirmOpen = signal(false);

  readonly activeVersion = computed(() => this.store.activeVersion()?.id ?? '—');

  readonly hasActiveJob = computed(
    () =>
      this.store.tasks().some((task) => isActiveTrainingStatus(task.status)) ||
      (this.detail() !== null && isActiveTrainingStatus(this.detail()!.status)),
  );

  readonly canStart = computed(
    () =>
      this.preview() !== null &&
      !this.isPreviewLoading() &&
      !this.isStarting() &&
      !this.hasActiveJob(),
  );

  readonly startLabel = computed(() => {
    if (this.hasActiveJob()) {
      return 'Training in progress…';
    }
    if (this.isStarting()) {
      return 'Starting…';
    }
    return '+ Create a new training';
  });

  async load(): Promise<void> {
    this.isPreviewLoading.set(true);
    this.listState.set('loading');
    this.loadError.set(null);
    this.traceId.set('');
    try {
      const [preview, list] = await Promise.all([
        this.api.getPreview(),
        this.api.getJobs(1, 20),
      ]);
      this.preview.set(this.decoratePreview(preview));
      this.isPreviewLoading.set(false);
      this.listState.set(list.items.length > 0 ? 'ok' : 'empty');
      this.loadError.set(null);
      this.store.setTasks(convertJobsToStore(list.items));
      this.trackPreviousStatuses(list.items);
      this.backfillVersions(list.items);
      // Refresh versions from the backend so version deletions cascade to this store.
      await this.versionApi.getVersions();
      if (this.hasActiveJob()) {
        this.startPolling();
      }
    } catch (error) {
      this.isPreviewLoading.set(false);
      this.loadError.set('Unable to load training tasks.');
      this.listState.set('error');
      this.traceId.set(this.traceOf(error));
      this.toast.show('Failed to load training data.', 'error');
    }
  }

  private backfillVersions(jobs: TrainingJob[]): void {
    for (const job of jobs) {
      if (job.status === 'done' && job.model_version) {
        const versionId = job.model_version;
        const existing = this.store.versions().find((item) => item.sourceTaskId === job.task_id || item.id === versionId);
        if (!existing) {
          const metrics = job.metrics;
          this.store.addVersion({
            id: versionId,
            type: 'local',
            trainingDate: job.finished_at ?? job.created_at,
            sampleSize: job.sample_count,
            accuracy: metrics?.accuracy_macro ?? null,
            perClassAccuracy:
              metrics?.per_class
                ? Object.entries(metrics.per_class).map(([code, acc]) => ({
                    code,
                    accuracy: (acc ?? 0) * 100,
                  }))
                : [],
            status: 'Inactive',
            sourceTaskId: job.task_id,
          });
        }
      }
    }
  }

  private syncJobsToStore(jobs: TrainingJob[]): void {
    for (const job of jobs) {
      const existing = this.store.findTask(job.task_id);
      const draft: Partial<TrainingTaskStoreTask> & { taskId: string } = {
        taskId: job.task_id,
        status: job.status,
        scope: job.scope,
        sampleCount: job.sample_count,
        createdAt: job.created_at,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        durationMs: job.duration_ms,
        progress: job.progress,
        modelVersion: job.model_version,
        modelVersionId: job.model_version_id,
        createdVersionId: job.created_version_id,
      };
      if (existing) {
        this.store.updateTask(job.task_id, {
          ...draft,
          deleted: existing.deleted,
          logSummary: job.log_summary ?? null,
          metrics: job.metrics ?? null,
        });
      } else {
        this.store.addTask(draft as TrainingTaskStoreTask);
        this.store.updateTask(job.task_id, {
          logSummary: job.log_summary ?? null,
          metrics: job.metrics ?? null,
        });
      }
    }
  }

  openConfirm(): void {
    if (!this.canStart()) {
      return;
    }
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    this.confirmOpen.set(false);
  }

  async startTraining(): Promise<void> {
    if (!this.canStart()) {
      return;
    }
    this.isStarting.set(true);
    try {
      const job = await this.api.startTraining();
      this.confirmOpen.set(false);
      this.trackPreviousStatuses([job]);
      this.syncJobsToStore([job]);
      this.logStart(job);
      this.auditLog.logOperate(LOG_ACTIONS.trainingStart, `Task ${job.task_id}`, `${job.sample_count ?? 0} samples`);
      this.toast.show('Training task started.', 'success');
      this.store.setTrainingInProgress(true);
      this.listState.set('ok');
      this.startPolling();
    } catch (error) {
      this.store.setTrainingInProgress(false);
      this.report(error, 'Failed to start training.');
    } finally {
      this.isStarting.set(false);
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    if (this.cancellingTaskId() !== null) {
      return;
    }
    this.cancellingTaskId.set(taskId);
    try {
      const job = await this.api.cancelJob(taskId);
      if (this.detail()?.task_id === taskId) {
        this.detail.set(job);
        this.stopDetailPolling();
      }
      this.auditLog.logOperate(LOG_ACTIONS.trainingStop, `Task ${taskId}`, `result: ${job.status}`);
      this.handleSettled(job);
      if (!this.hasActiveJob()) {
        this.stopPolling();
      }
    } catch (error) {
      this.report(error, 'Failed to cancel training task.');
    } finally {
      this.cancellingTaskId.set(null);
    }
  }

  async deleteTaskWithVersion(taskId: string): Promise<boolean> {
    const task = this.store.findTask(taskId);
    if (task === null) {
      this.toast.show('Task not found.', 'error');
      return false;
    }
    if (task.status === 'pending' || task.status === 'running') {
      this.toast.show('Running tasks cannot be deleted.', 'warning');
      return false;
    }

    try {
      await this.api.deleteTrainingTask(taskId);
    } catch (error) {
      this.report(error, 'Unable to delete task.');
      return false;
    }
    // Reload from the backend so the deleted task and its linked version
    // disappear from this store and from the shared version store.
    await this.load();

    this.toast.dismissAll();
    this.toast.show(`Deleted task ${taskId}.`, 'success');
    this.operationLog.add({
      operator: this.operatorName(),
      format: 'Delete training task',
      scope: `Task ${taskId}; result: success`,
      recordCount: 0,
      deleted: true,
    });
    this.listState.set(this.jobs().length > 0 ? 'ok' : 'empty');
    return true;
  }

  async openDetail(taskId: string): Promise<void> {
    try {
      const job = await this.api.getTrainingTaskDetail(taskId);
      this.detail.set(job);
      this.detailOpen.set(true);
      this.trackJob(job);
      if (isActiveTrainingStatus(job.status)) {
        this.startDetailPolling(taskId);
      } else {
        this.stopDetailPolling();
      }
    } catch (error) {
      this.report(error, 'Failed to load training details.');
    }
  }

  async getTrainingTaskDetail(taskId: string): Promise<TrainingJob> {
    return this.api.getTrainingTaskDetail(taskId);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detail.set(null);
    this.stopDetailPolling();
  }

  destroy(): void {
    this.stopPolling();
    this.stopDetailPolling();
  }

  retry(): void {
    void this.load();
  }

  private decoratePreview(preview: TrainingPreview): TrainingPreview {
    const active = this.store.activeVersion();
    return {
      ...preview,
      active_version: active?.id ?? preview.active_version,
      active_train_count: preview.active_train_count ?? active?.sampleSize ?? null,
    };
  }

  private trackPreviousStatuses(items: TrainingJob[]): void {
    for (const item of items) {
      this.previousStatuses.set(item.task_id, item.status);
    }
  }

  private trackJob(job: TrainingJob): void {
    const previous = this.previousStatuses.get(job.task_id);
    if (
      previous !== undefined &&
      isActiveTrainingStatus(previous) &&
      !isActiveTrainingStatus(job.status)
    ) {
      this.handleSettled(job);
    }
    this.previousStatuses.set(job.task_id, job.status);
  }

  private handleSettled(job: TrainingJob): void {
    this.operationLog.add({
      operator: this.operatorName(),
      format:
        job.status === 'done'
          ? 'Training completed'
          : job.status === 'cancelled'
            ? 'Terminate training'
            : 'Training failed',
      scope: `Task ${job.task_id}; ${trainingScopeLabel(job.scope)}; ${job.sample_count ?? 0} samples`,
      recordCount: job.sample_count ?? 0,
      deleted: false,
    });

    if (job.status === 'done') {
      this.operationLog.add({
        operator: this.operatorName(),
        format: 'Create model version',
        scope: `Version ${job.model_version}; result: success`,
        recordCount: job.sample_count ?? 0,
        deleted: false,
      });
      this.toast.show(
        `Training completed. Candidate version ${job.model_version} is available.`,
        'success',
      );
      this.store.setTrainingInProgress(false);
      void this.versionApi.getVersions();
      return;
    }

    if (job.status === 'failed') {
      this.operationLog.addAlarm('training', `Training: Task ${job.task_id} failed.`);
      this.toast.show(`Training task ${job.task_id} failed.`, 'error');
      this.store.setTrainingInProgress(false);
      return;
    }

    this.store.setTrainingInProgress(false);
    this.toast.show(`Training task ${job.task_id} was terminated.`, 'info');
  }

  private logStart(job: TrainingJob): void {
    this.operationLog.add({
      operator: this.operatorName(),
      format: 'Start training',
      scope: `Task ${job.task_id}; ${trainingScopeLabel(job.scope)}; ${job.sample_count ?? 0} samples`,
      recordCount: job.sample_count ?? 0,
      deleted: false,
    });
  }

  private operatorName(): string {
    return this.auth.user()?.name ?? 'Administrator';
  }

  private async refresh(): Promise<void> {
    try {
      const [preview, list] = await Promise.all([
        this.api.getPreview(),
        this.api.getJobs(1, 20),
      ]);
      this.preview.set(this.decoratePreview(preview));
      this.isPreviewLoading.set(false);
      this.loadError.set(null);
      this.store.setTasks(convertJobsToStore(list.items));
      this.trackPreviousStatuses(list.items);
      this.backfillVersions(list.items);
      if (!this.hasActiveJob()) {
        this.stopPolling();
      }
    } catch (error) {
      this.traceId.set(this.traceOf(error));
      if (this.jobs().length === 0) {
        this.listState.set('error');
      }
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.listTimer = window.setInterval(() => {
      void this.refresh();
    }, TRAINING_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.listTimer !== null) {
      window.clearInterval(this.listTimer);
      this.listTimer = null;
    }
  }

  private startDetailPolling(taskId: string): void {
    this.stopDetailPolling();
    this.detailTimer = window.setInterval(() => {
      void this.refreshDetail(taskId);
    }, TRAINING_POLL_INTERVAL_MS);
  }

  private stopDetailPolling(): void {
    if (this.detailTimer !== null) {
      window.clearInterval(this.detailTimer);
      this.detailTimer = null;
    }
  }

  private async refreshDetail(taskId: string): Promise<void> {
    try {
      const job = await this.api.getJob(taskId);
      this.detail.set(job);
      this.trackJob(job);
      if (!isActiveTrainingStatus(job.status)) {
        this.stopDetailPolling();
      }
    } catch (error) {
      this.stopDetailPolling();
      this.traceId.set(this.traceOf(error));
    }
  }

  private report(error: unknown, message: string): void {
    this.traceId.set(this.traceOf(error));
    this.toast.show(message, 'error');
  }

  private traceOf(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'trace_id' in error) {
      const trace = (error as { trace_id?: unknown }).trace_id;
      return typeof trace === 'string' ? trace : '';
    }
    return '';
  }
}

function toJob(task: {
  taskId: string;
  status: string;
  scope: string;
  sampleCount: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  progress: number;
  modelVersion: string | null;
  modelVersionId: string | null;
  createdVersionId: number | null;
  deleted: boolean;
}): TrainingJob {
  return {
    task_id: task.taskId,
    status: task.status as TrainingJob['status'],
    scope: task.scope as TrainingJob['scope'],
    sample_count: task.sampleCount,
    created_at: task.createdAt,
    started_at: task.startedAt,
    finished_at: task.finishedAt,
    duration_ms: task.durationMs,
    progress: task.progress,
    model_version: task.modelVersion,
    model_version_id: task.modelVersionId,
    created_version_id: task.createdVersionId,
    deleted: task.deleted,
    log_summary: null,
    metrics: null,
  };
}

function convertJobsToStore(jobs: TrainingJob[]): TrainingTaskStoreTask[] {
  return jobs.map((job) => ({
    taskId: job.task_id,
    status: job.status,
    scope: job.scope,
    sampleCount: job.sample_count,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    durationMs: job.duration_ms,
    progress: job.progress,
    modelVersion: job.model_version,
    modelVersionId: job.model_version_id,
    createdVersionId: job.created_version_id,
    deleted: !!job.deleted,
    logSummary: job.log_summary ?? null,
    metrics: job.metrics ?? null,
  }));
}
