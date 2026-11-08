import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { OperationLogService } from '../../../shared/services/operation-log.service';
import { ModelVersionService } from '../../../shared/services/model-version.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TrainingTaskApiService } from './training-task-api.service';
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
  private readonly toast = inject(ToastService);
  private readonly operationLog = inject(OperationLogService);
  private readonly auth = inject(AuthService);
  private readonly versions = inject(ModelVersionService);

  private readonly previousStatuses = new Map<string, TrainingJob['status']>();
  private listTimer: number | null = null;
  private detailTimer: number | null = null;

  readonly preview = signal<TrainingPreview | null>(null);
  readonly jobs = signal<TrainingJob[]>([]);
  readonly listState = signal<TrainingListState>('loading');
  readonly isPreviewLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly traceId = signal('');
  readonly isStarting = signal(false);
  readonly cancellingTaskId = signal<string | null>(null);
  readonly detail = signal<TrainingJob | null>(null);
  readonly detailOpen = signal(false);
  readonly confirmOpen = signal(false);

  readonly activeVersion = computed(
    () => this.preview()?.active_version ?? this.versions.activeVersionLabel(),
  );

  readonly hasActiveJob = computed(
    () =>
      this.jobs().some((job) => isActiveTrainingStatus(job.status)) ||
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
    return '+ New training';
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
      this.applyJobs(list.items, true);
      this.isPreviewLoading.set(false);
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
    let started = false;
    try {
      const job = await this.api.startTraining();
      this.confirmOpen.set(false);
      this.upsertJob(job);
      this.previousStatuses.set(job.task_id, job.status);
      this.logStart(job);
      this.toast.show('Training task started.', 'success');
      started = true;
      await this.refresh();
    } catch (error) {
      this.report(error, 'Failed to start training.');
    } finally {
      this.isStarting.set(false);
      if (started) {
        this.startPolling();
      }
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    if (this.cancellingTaskId() !== null) {
      return;
    }
    this.cancellingTaskId.set(taskId);
    try {
      const job = await this.api.cancelJob(taskId);
      this.upsertJob(job);
      this.trackJob(job);
      if (this.detail()?.task_id === taskId) {
        this.detail.set(job);
        this.stopDetailPolling();
      }
      await this.refresh();
      if (!this.hasActiveJob()) {
        this.stopPolling();
      }
    } catch (error) {
      this.report(error, 'Failed to cancel training task.');
    } finally {
      this.cancellingTaskId.set(null);
    }
  }

  async openDetail(taskId: string): Promise<void> {
    try {
      const job = await this.api.getJob(taskId);
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
    const active = this.versions.activeVersion();
    return {
      ...preview,
      active_version: active?.version ?? preview.active_version,
      active_train_count: preview.active_train_count ?? active?.sampleCount ?? null,
    };
  }

  private applyJobs(items: TrainingJob[], initial: boolean): void {
    for (const job of items) {
      if (!initial) {
        this.trackJob(job);
      } else {
        this.previousStatuses.set(job.task_id, job.status);
      }
    }
    this.jobs.set(items);
    this.listState.set(items.length > 0 ? 'ok' : 'empty');
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
    this.jobs.update((list) => {
      if (!list.some((item) => item.task_id === job.task_id)) {
        return list;
      }
      return list.map((item) => (item.task_id === job.task_id ? job : item));
    });
  }

  private handleSettled(job: TrainingJob): void {
    this.operationLog.add({
      operator: this.operatorName(),
      format: job.status === 'done' ? 'Training completed' : job.status === 'cancelled' ? 'Terminate training' : 'Training failed',
      scope: `Task ${job.task_id}; ${trainingScopeLabel(job.scope)}; ${job.sample_count ?? 0} samples`,
      recordCount: job.sample_count ?? 0,
      deleted: false,
    });

    if (job.status === 'done') {
      const version = this.versions.addVersion({
        version: job.model_version ?? this.versions.nextVersion(),
        trainedAt: job.finished_at,
        sampleCount: job.sample_count,
      });
      this.api.markCorrectionsIncluded();
      this.toast.show(
        `Training completed. Candidate version ${version.version} is available.`,
        'success',
      );
      return;
    }

    if (job.status === 'failed') {
      this.operationLog.addAlarm('training', `Training: Task ${job.task_id} failed.`);
      this.toast.show(`Training task ${job.task_id} failed.`, 'error');
      return;
    }

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
      this.applyJobs(list.items, false);
      this.isPreviewLoading.set(false);
      this.loadError.set(null);
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

  private upsertJob(job: TrainingJob): void {
    this.jobs.update((list) => {
      if (!list.some((item) => item.task_id === job.task_id)) {
        return [job, ...list];
      }
      return list.map((item) => (item.task_id === job.task_id ? job : item));
    });
    if (this.listState() !== 'ok') {
      this.listState.set('ok');
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
