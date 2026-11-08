import { TrainingPreview, estimateTrainingEta } from './training-task.models';

export const USE_TRAINING_TASK_MOCK = true;

export const TRAINING_POLL_INTERVAL_MS = 2000;

export const TRAINING_QUEUE_MS = 1800;

export const TRAINING_RUN_MS = 16000;

export const MOCK_TRAINING_BASE_SAMPLE_COUNT = 3254;

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
