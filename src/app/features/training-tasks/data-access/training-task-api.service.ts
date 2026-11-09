import { Injectable, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../parameters-and-formulas/data-access/parameters-and-formulas.service';
import { LowConfidenceReviewService } from '../../low-confidence-review/data-access/low-confidence-review.service';
import { ModelVersionStore } from '../../../shared/services/model-version.store';
import type { TrainingTaskStoreTask } from '../../../shared/services/model-version.store';
import {
  TrainingJob,
  TrainingJobList,
  TrainingMetrics,
  TrainingPreview,
  estimateTrainingEta,
} from './training-task.models';
import {
  MOCK_TRAINING_BASE_SAMPLE_COUNT,
  MOCK_TRAINING_PREVIEW,
  TRAINING_QUEUE_MS,
  TRAINING_RUN_MS,
  USE_TRAINING_TASK_MOCK,
  buildTrainingMetrics,
  createMockTaskId,
} from './training-task.mock';

const STORAGE_KEY_CORRECTION_BASELINE = 'xyd_training_correction_baseline_v1';
const API_BASE = '/api/v1/training';

interface StartTrainingResponse {
  readonly task_id: string;
}

interface TrainingApiError extends Error {
  trace_id?: string;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function logTime(value: Date): string {
  return value.toLocaleTimeString('en-GB', { hour12: false });
}

function toTaskDraft(job: TrainingJob): TrainingTaskStoreTask {
  return {
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
    deleted: false,
    logSummary: job.log_summary ?? null,
    metrics: job.metrics ?? null,
  };
}

function toJob(task: TrainingTaskStoreTask): TrainingJob {
  return {
    task_id: task.taskId,
    status: task.status,
    scope: task.scope,
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
    log_summary: task.logSummary ?? null,
    metrics: task.metrics ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class TrainingTaskApiService {
  private readonly parameters = inject(ParametersAndFormulasService);
  private readonly review = inject(LowConfidenceReviewService);
  private readonly store = inject(ModelVersionStore);

  private correctionBaseline: number | null = this.loadCorrectionBaseline();

  async getPreview(): Promise<TrainingPreview> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(180);
      const corrected = this.review.correctedTotal();
      const baseline = this.ensureCorrectionBaseline(corrected);
      const active = this.store.activeVersion();
      return clone({
        ...MOCK_TRAINING_PREVIEW,
        active_version: active?.id ?? MOCK_TRAINING_PREVIEW.active_version,
        active_train_count: active?.sampleSize ?? MOCK_TRAINING_BASE_SAMPLE_COUNT,
        sample_count: active?.sampleSize ?? MOCK_TRAINING_BASE_SAMPLE_COUNT,
        new_corrections: Math.max(0, corrected - baseline),
        eta_text: estimateTrainingEta(active?.sampleSize ?? MOCK_TRAINING_BASE_SAMPLE_COUNT),
      });
    }
    return this.request<TrainingPreview>('GET', `${API_BASE}/preview`);
  }

  async startTraining(): Promise<TrainingJob> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(420);
      if (
        this.store.tasks().some(
          (item) => item.status === 'pending' || item.status === 'running',
        )
      ) {
        throw new Error('A training task is already in progress.');
      }
      const now = new Date();
      const job: TrainingJob = {
        task_id: createMockTaskId(now),
        status: 'pending',
        scope: 'all_stations',
        sample_count: this.store.activeVersion()?.sampleSize ?? MOCK_TRAINING_BASE_SAMPLE_COUNT,
        created_at: now.toISOString(),
        started_at: null,
        finished_at: null,
        duration_ms: null,
        progress: 0,
        model_version: null,
        model_version_id: null,
        created_version_id: null,
        deleted: false,
        log_summary: `[${logTime(now)}] Task queued.`,
        metrics: null,
      };
      this.store.addTask(toTaskDraft(job));
      return clone(job);
    }
    const response = await this.request<StartTrainingResponse>('POST', `${API_BASE}/start`);
    return this.request<TrainingJob>('GET', `${API_BASE}/jobs/${encodeURIComponent(response.task_id)}`);
  }

  async getJobs(page = 1, pageSize = 20): Promise<TrainingJobList> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(160);
      this.advanceJobs();
      const tasks = this.store.tasks();
      const ordered = [...tasks]
        .map((item) => toJob(item))
        .sort(
          (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
        );
      const start = Math.max(0, (page - 1) * pageSize);
      return clone({
        items: ordered.slice(start, start + pageSize),
        page,
        page_size: pageSize,
        total: ordered.length,
      });
    }
    return this.request<TrainingJobList>(
      'GET',
      `${API_BASE}/jobs?page=${page}&page_size=${pageSize}`,
    );
  }

  async getJob(taskId: string): Promise<TrainingJob> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(150);
      this.advanceJobs();
      const task = this.store.findTask(taskId);
      if (!task) {
        throw new Error(`Training task ${taskId} was not found.`);
      }
      return clone(toJob(task));
    }
    return this.request<TrainingJob>('GET', `${API_BASE}/jobs/${encodeURIComponent(taskId)}`);
  }

  async getTrainingTaskDetail(taskId: string): Promise<TrainingJob> {
    return this.getJob(taskId);
  }

  async cancelJob(taskId: string): Promise<TrainingJob> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(220);
      this.advanceJobs();
      const task = this.store.findTask(taskId);
      if (!task) {
        throw new Error(`Training task ${taskId} was not found.`);
      }
      if (task.status !== 'pending' && task.status !== 'running') {
        throw new Error('The training task is no longer running.');
      }
      const now = new Date();
      const startedAt = task.startedAt ?? task.createdAt;
      const elapsed = now.getTime() - Date.parse(startedAt);
      const updated = this.store.updateTask(taskId, {
        status: 'cancelled',
        finishedAt: now.toISOString(),
        durationMs: elapsed,
        logSummary: this.appendLogLine(task.logSummary ?? null, `[${logTime(now)}] Training task terminated by the operator.`),
      });
      if (updated === null) {
        throw new Error(`Training task ${taskId} was not found.`);
      }
      return clone(toJob(updated));
    }
    return this.request<TrainingJob>(
      'POST',
      `${API_BASE}/jobs/${encodeURIComponent(taskId)}/cancel`,
    );
  }

  async deleteTrainingTask(taskId: string): Promise<void> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(220);
      const task = this.store.findTask(taskId);
      if (!task) {
        throw new Error(`Training task ${taskId} was not found.`);
      }
      if (task.status === 'pending' || task.status === 'running') {
        throw new Error('Running tasks cannot be deleted.');
      }
      this.store.updateTask(taskId, { status: 'cancelled', deleted: true });
      return;
    }
    await this.request('DELETE', `${API_BASE}/jobs/${encodeURIComponent(taskId)}`);
  }

  markCorrectionsIncluded(): void {
    if (!USE_TRAINING_TASK_MOCK) {
      return;
    }
    this.correctionBaseline = this.review.correctedTotal();
    this.saveCorrectionBaseline();
  }

  private advanceJobs(): void {
    const now = new Date();
    const nowMs = now.getTime();

    for (const task of this.store.tasks()) {
      if (task.status === 'pending') {
        const createdAt = Date.parse(task.createdAt);
        if (nowMs - createdAt >= TRAINING_QUEUE_MS) {
          const startedAt = new Date(createdAt + TRAINING_QUEUE_MS).toISOString();
          this.store.updateTask(task.taskId, {
            status: 'running',
            startedAt,
            progress: 1,
            logSummary: this.appendLogLine(task.logSummary ?? null, `[${logTime(new Date(createdAt + TRAINING_QUEUE_MS))}] Training started.`),
          });
        }
      }

      if (task.status === 'running') {
        const startedAt = Date.parse(task.startedAt ?? task.createdAt);
        const elapsed = Math.max(0, nowMs - startedAt);
        const progress = Math.min(99, Math.floor((elapsed / TRAINING_RUN_MS) * 100));
        this.store.updateTask(task.taskId, {
          progress,
          durationMs: elapsed,
        });
        if (elapsed >= TRAINING_RUN_MS) {
          this.finishJob(task, now);
        }
      }
    }
  }

  private appendLogLine(existing: string | null, line: string): string {
    return existing ? `${existing}\n${line}` : line;
  }

  private finishJob(task: TrainingTaskStoreTask, now: Date): void {
    const job = toJob(task);
    const failureReason = this.failureReason(job);
    const nowIso = now.toISOString();
    const elapsed = now.getTime() - Date.parse(task.createdAt);
    const baseUpdates: { finishedAt: string; durationMs: number } = {
      finishedAt: nowIso,
      durationMs: elapsed,
    };

    if (failureReason) {
      this.store.updateTask(task.taskId, {
        ...baseUpdates,
        status: 'failed',
        logSummary: this.appendLogLine(task.logSummary ?? null, failureReason),
      });
      return;
    }

    const nextVersion = this.store.nextVersion();
    const metrics = this.buildMetrics(task);
    this.store.updateTask(task.taskId, {
      ...baseUpdates,
      status: 'done',
      progress: 100,
      modelVersion: nextVersion,
      modelVersionId: `candidate-${task.taskId}`,
      metrics,
      logSummary: this.appendLogLine(
        this.appendLogLine(task.logSummary ?? null, `[${logTime(now)}] Grouped rotation validation completed.`),
        `[${logTime(now)}] Candidate version ${nextVersion} produced.`,
      ),
    });

    this.store.addVersion({
      id: nextVersion,
      type: 'local',
      trainingDate: nowIso,
      sampleSize: task.sampleCount,
      accuracy: metrics.accuracy_macro,
      perClassAccuracy: Object.entries(metrics.per_class ?? {}).map(([code, acc]) => ({
        code,
        name: code,
        accuracy: (acc ?? 0) * 100,
      })),
      status: 'Inactive',
      sourceTaskId: task.taskId,
    });
    this.store.updateTask(task.taskId, { createdVersionId: Number(nextVersion.replace('V', '')) });
    this.markCorrectionsIncluded();
  }

  private failureReason(job: TrainingJob): string | null {
    const modes = this.parameters.activeFailureModes();
    const sampleCount = job.sample_count ?? 0;
    if (modes.length === 0) {
      return 'Training failed: no enabled failure modes are available.';
    }
    const minimum = this.parameters.systemSettings().training_min_samples_per_class;
    const required = modes.length * minimum;
    if (sampleCount < required) {
      return `Training failed: ${sampleCount} samples available, ${required} required for ${modes.length} failure modes.`;
    }
    return null;
  }

  private buildMetrics(task: TrainingTaskStoreTask): TrainingMetrics {
    return buildTrainingMetrics(task.taskId, task.sampleCount ?? 0, this.store.activeVersion()?.accuracy ?? 0);
  }

  private ensureCorrectionBaseline(corrected: number): number {
    if (this.correctionBaseline === null) {
      this.correctionBaseline = corrected;
      this.saveCorrectionBaseline();
    }
    return this.correctionBaseline;
  }

  private loadCorrectionBaseline(): number | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CORRECTION_BASELINE);
      if (stored !== null) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private saveCorrectionBaseline(): void {
    if (this.correctionBaseline === null) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_CORRECTION_BASELINE, String(this.correctionBaseline));
    } catch {
      return;
    }
  }

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string): Promise<T> {
    const response = await fetch(path, { method });
    if (!response.ok) {
      const error = new Error(
        `Training service request failed (${response.status}).`,
      ) as TrainingApiError;
      const traceId = response.headers.get('x-trace-id');
      if (traceId) {
        error.trace_id = traceId;
      }
      throw error;
    }
    return (await response.json()) as T;
  }
}
