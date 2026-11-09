export type TrainingTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export type TrainingScope = 'single_station' | 'all_stations';

export type TrainingEvaluationMode = 'cv5' | 'trainset';

export type TrainingStatusTone = 'success' | 'danger' | 'warning' | 'neutral';

export interface TrainingPreview {
  readonly active_version: string | null;
  readonly active_train_count: number | null;
  readonly sample_count: number;
  readonly base_sample_count: number;
  readonly local_total: number;
  readonly new_corrections: number;
  readonly eta_text: string | null;
}

export interface TrainingMetrics {
  readonly accuracy_macro: number | null;
  readonly per_class: Record<string, number | null> | null;
  readonly eval_mode: TrainingEvaluationMode | null;
  readonly is_placeholder: boolean;
}

export interface TrainingJob {
  task_id: string;
  status: TrainingTaskStatus;
  scope: TrainingScope;
  sample_count: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  progress: number;
  model_version: string | null;
  model_version_id: string | null;
  created_version_id: number | null;
  deleted: boolean;
  log_summary: string | null;
  metrics: TrainingMetrics | null;
}

export interface TrainingJobList {
  readonly items: TrainingJob[];
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
}

const STATUS_LABELS: Record<TrainingTaskStatus, string> = {
  pending: 'Queued',
  running: 'Training',
  done: 'Completed',
  failed: 'Failed',
  cancelled: 'Terminated',
};

const SCOPE_LABELS: Record<TrainingScope, string> = {
  single_station: 'This station',
  all_stations: 'All stations',
};

const EVALUATION_MODE_LABELS: Record<TrainingEvaluationMode, string> = {
  cv5: 'Grouped rotation validation',
  trainset: 'Training data self-test',
};

export function trainingStatusLabel(status: TrainingTaskStatus): string {
  return STATUS_LABELS[status];
}

export function trainingScopeLabel(scope: TrainingScope): string {
  return SCOPE_LABELS[scope];
}

export function trainingEvaluationModeLabel(mode: TrainingEvaluationMode | null): string {
  return mode ? EVALUATION_MODE_LABELS[mode] : '—';
}

export function trainingStatusTone(status: TrainingTaskStatus): TrainingStatusTone {
  if (status === 'done') {
    return 'success';
  }
  if (status === 'failed') {
    return 'danger';
  }
  if (status === 'running') {
    return 'warning';
  }
  return 'neutral';
}

export function isActiveTrainingStatus(status: TrainingTaskStatus): boolean {
  return status === 'pending' || status === 'running';
}

export function formatTrainingDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

export function formatTrainingDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return '—';
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const totalSeconds = Math.round(seconds);
  return `${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} sec`;
}

export function formatAccuracy(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function estimateTrainingEta(sampleCount: number): string | null {
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) {
    return null;
  }
  const low = Math.max(1, Math.round(sampleCount / 3254));
  return `Approximately ${low}–${low + 1} minutes`;
}
