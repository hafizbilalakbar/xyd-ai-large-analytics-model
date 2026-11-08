import { Injectable, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../parameters-and-formulas/data-access/parameters-and-formulas.service';
import { LowConfidenceReviewService } from '../../low-confidence-review/data-access/low-confidence-review.service';
import { ModelVersionService } from '../../../shared/services/model-version.service';
import {
  TrainingEvaluationMode,
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
  createMockTaskId,
} from './training-task.mock';

const STORAGE_KEY_JOBS = 'xyd_training_jobs_v1';
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

@Injectable({ providedIn: 'root' })
export class TrainingTaskApiService {
  private readonly parameters = inject(ParametersAndFormulasService);
  private readonly review = inject(LowConfidenceReviewService);
  private readonly versions = inject(ModelVersionService);

  private jobs: TrainingJob[] = this.loadJobs();
  private correctionBaseline: number | null = this.loadCorrectionBaseline();

  async getPreview(): Promise<TrainingPreview> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(180);
      const corrected = this.review.correctedTotal();
      const baseline = this.ensureCorrectionBaseline(corrected);
      return clone({
        ...MOCK_TRAINING_PREVIEW,
        new_corrections: Math.max(0, corrected - baseline),
        eta_text: estimateTrainingEta(MOCK_TRAINING_PREVIEW.sample_count),
      });
    }
    return this.request<TrainingPreview>('GET', `${API_BASE}/preview`);
  }

  async startTraining(): Promise<TrainingJob> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(420);
      this.advanceJobs();
      if (this.jobs.some((job) => job.status === 'pending' || job.status === 'running')) {
        throw new Error('A training task is already in progress.');
      }
      const now = new Date();
      const job: TrainingJob = {
        task_id: createMockTaskId(now),
        status: 'pending',
        scope: 'all_stations',
        sample_count: MOCK_TRAINING_BASE_SAMPLE_COUNT,
        created_at: now.toISOString(),
        started_at: null,
        finished_at: null,
        duration_ms: null,
        progress: 0,
        model_version: null,
        model_version_id: null,
        log_summary: `[${logTime(now)}] Task queued.`,
        metrics: null,
      };
      this.jobs = [job, ...this.jobs];
      this.persistJobs();
      return clone(job);
    }
    const response = await this.request<StartTrainingResponse>('POST', `${API_BASE}/start`);
    return this.request<TrainingJob>('GET', `${API_BASE}/jobs/${encodeURIComponent(response.task_id)}`);
  }

  async getJobs(page = 1, pageSize = 20): Promise<TrainingJobList> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(160);
      this.advanceJobs();
      const ordered = [...this.jobs].sort(
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
      const job = this.jobs.find((item) => item.task_id === taskId);
      if (!job) {
        throw new Error(`Training task ${taskId} was not found.`);
      }
      return clone(job);
    }
    return this.request<TrainingJob>('GET', `${API_BASE}/jobs/${encodeURIComponent(taskId)}`);
  }

  async cancelJob(taskId: string): Promise<TrainingJob> {
    if (USE_TRAINING_TASK_MOCK) {
      await delay(220);
      this.advanceJobs();
      const job = this.jobs.find((item) => item.task_id === taskId);
      if (!job) {
        throw new Error(`Training task ${taskId} was not found.`);
      }
      if (job.status !== 'pending' && job.status !== 'running') {
        throw new Error('The training task is no longer running.');
      }
      const now = new Date();
      job.status = 'cancelled';
      job.finished_at = now.toISOString();
      job.duration_ms = now.getTime() - Date.parse(job.created_at);
      this.appendLog(job, 'Training task terminated by the operator.', now);
      this.persistJobs();
      return clone(job);
    }
    return this.request<TrainingJob>(
      'POST',
      `${API_BASE}/jobs/${encodeURIComponent(taskId)}/cancel`,
    );
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
    let changed = false;

    for (const job of this.jobs) {
      if (job.status === 'pending') {
        const createdAt = Date.parse(job.created_at);
        if (nowMs - createdAt >= TRAINING_QUEUE_MS) {
          job.status = 'running';
          job.started_at = new Date(createdAt + TRAINING_QUEUE_MS).toISOString();
          job.progress = 1;
          this.appendLog(job, 'Training started.', new Date(createdAt + TRAINING_QUEUE_MS));
          changed = true;
        }
      }

      if (job.status === 'running') {
        const startedAt = Date.parse(job.started_at ?? job.created_at);
        const elapsed = Math.max(0, nowMs - startedAt);
        const progress = Math.min(99, Math.floor((elapsed / TRAINING_RUN_MS) * 100));
        if (progress > job.progress) {
          job.progress = progress;
          changed = true;
        }
        if (elapsed >= TRAINING_RUN_MS) {
          this.finishJob(job, now);
          changed = true;
        }
      }
    }

    if (changed) {
      this.persistJobs();
    }
  }

  private finishJob(job: TrainingJob, now: Date): void {
    const failureReason = this.failureReason(job);
    job.finished_at = now.toISOString();
    job.duration_ms = now.getTime() - Date.parse(job.created_at);

    if (failureReason) {
      job.status = 'failed';
      this.appendLog(job, failureReason, now);
      return;
    }

    job.status = 'done';
    job.progress = 100;
    job.model_version = this.versions.nextVersion();
    job.model_version_id = `candidate-${job.task_id}`;
    job.metrics = this.buildMetrics();
    this.appendLog(job, 'Grouped rotation validation completed.', now);
    this.appendLog(job, `Candidate version ${job.model_version} produced.`, now);
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

  private buildMetrics(): TrainingMetrics {
    const codes = this.parameters.activeFailureModes().map((mode) => mode.code);
    const perClass: Record<string, number | null> = {};
    codes.forEach((code, index) => {
      perClass[code] = Number((0.88 + ((index * 7) % 9) / 100).toFixed(3));
    });
    const values = codes
      .map((code) => perClass[code])
      .filter((value): value is number => typeof value === 'number');
    const accuracy =
      values.length > 0
        ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4))
        : null;
    const evaluationMode: TrainingEvaluationMode = 'cv5';
    return {
      accuracy_macro: accuracy,
      per_class: perClass,
      eval_mode: evaluationMode,
      is_placeholder: true,
    };
  }

  private appendLog(job: TrainingJob, message: string, at: Date): void {
    const line = `[${logTime(at)}] ${message}`;
    job.log_summary = job.log_summary ? `${job.log_summary}\n${line}` : line;
  }

  private ensureCorrectionBaseline(corrected: number): number {
    if (this.correctionBaseline === null) {
      this.correctionBaseline = corrected;
      this.saveCorrectionBaseline();
    }
    return this.correctionBaseline;
  }

  private loadJobs(): TrainingJob[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_JOBS);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return (parsed as unknown[]).filter((item): item is TrainingJob => {
            if (typeof item !== 'object' || item === null) {
              return false;
            }
            const candidate = item as Partial<TrainingJob>;
            return typeof candidate.task_id === 'string' && typeof candidate.created_at === 'string';
          });
        }
      }
    } catch {
      return [];
    }
    return [];
  }

  private persistJobs(): void {
    try {
      localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(this.jobs));
    } catch {
      return;
    }
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

  private async request<T>(method: 'GET' | 'POST', path: string): Promise<T> {
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
