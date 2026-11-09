import { TrainingPreview, TrainingMetrics, estimateTrainingEta } from './training-task.models';

export const USE_TRAINING_TASK_MOCK = true;

export const TRAINING_POLL_INTERVAL_MS = 500;

export const TRAINING_QUEUE_MS = 300;

export const TRAINING_RUN_MS = 16000;

export const MOCK_TRAINING_BASE_SAMPLE_COUNT = 3254;

export const TRAINING_CATEGORY_CODES: readonly string[] = ['PASS', 'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F08'];

const PREVIOUS_PER_CLASS: Record<string, number> = {
  PASS: 99.63,
  F01: 100.0,
  F02: 96.15,
  F03: 100.0,
  F04: 86.96,
  F05: 94.06,
  F06: 88.24,
  F08: 100.0,
};

export function buildTrainingMetrics(
  taskId: string,
  sampleCount: number,
  previousAccuracy: number,
): TrainingMetrics {
  // Deterministic seed from task id
  let seed = 0;
  for (let i = 0; i < taskId.length; i++) {
    seed = (seed * 31 + taskId.charCodeAt(i)) | 0;
  }
  seed = (seed * 31 + sampleCount) | 0;
  seed = (seed * 31 + Math.round(previousAccuracy * 10)) | 0;

  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 0xffffffff;
  };

  const perClass: Record<string, number | null> = {};
  for (const code of TRAINING_CATEGORY_CODES) {
    const prev = PREVIOUS_PER_CLASS[code] ?? 95;
    let value: number;
    if (code === 'PASS') {
      value = Math.min(100, Math.max(98, prev + (next() * 4 - 2)));
    } else {
      value = Math.min(100, Math.max(80, prev + (next() * 4 - 2)));
    }
    perClass[code] = Math.round(value * 10) / 10;
  }

  const values = TRAINING_CATEGORY_CODES.map((code) => perClass[code]).filter(
    (value): value is number => typeof value === 'number',
  );
  const accuracy =
    values.length > 0
      ? Math.min(99.5, Math.max(90, Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1))))
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
