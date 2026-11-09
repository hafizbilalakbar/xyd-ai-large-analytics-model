import { TrainingPreview, TrainingMetrics, estimateTrainingEta } from './training-task.models';

export const USE_TRAINING_TASK_MOCK = true;

export const TRAINING_POLL_INTERVAL_MS = 500;

export const TRAINING_QUEUE_MS = 300;

export const TRAINING_RUN_MS = 16000;

export const MOCK_TRAINING_BASE_SAMPLE_COUNT = 3254;

export const TRAINING_CATEGORY_CODES: readonly string[] = ['PASS', 'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F08'];

export function buildTrainingMetrics(): TrainingMetrics {
  const perClass: Record<string, number | null> = {
    PASS: 0.993,
    F01: 0.998,
    F02: 0.945,
    F03: 0.972,
    F04: 0.890,
    F05: 0.938,
    F06: 0.905,
    F08: 0.991,
  };
  const values = TRAINING_CATEGORY_CODES.map((code) => perClass[code]).filter(
    (value): value is number => typeof value === 'number',
  );
  const accuracy =
    values.length > 0
      ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4))
      : null;
  return {
    accuracy_macro: accuracy,
    per_class: perClass,
    eval_mode: 'cv5',
    is_placeholder: true,
  };
}

export const MOCK_TRAINING_PREVIEW: TrainingPreview = {
  active_version: 'V3.0',
  active_train_count: MOCK_TRAINING_BASE_SAMPLE_COUNT,
  sample_count: MOCK_TRAINING_BASE_SAMPLE_COUNT,
  base_sample_count: MOCK_TRAINING_BASE_SAMPLE_COUNT,
  local_total: 0,
  new_corrections: 0,
  eta_text: estimateTrainingEta(MOCK_TRAINING_BASE_SAMPLE_COUNT),
};

export function createMockTaskId(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const suffix = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `T${year}${month}${day}-${suffix}`;
}
