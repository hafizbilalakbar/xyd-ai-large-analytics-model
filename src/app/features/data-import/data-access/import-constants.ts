import type { BatchOption, TrainingRow, TrainingRowStatus } from './data-import.models';

export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 500;
export const CHUNK_SIZE = 256 * 1024;
export const IMPORT_PAGE_SIZE_OPTIONS = [20, 50, 100];

export const IMPORT_FILE_EXTENSIONS = ['.zip', '.csv', '.tsv', '.txt', '.xlsx', '.xls', '.json'];

export const IMPORT_FILE_ACCEPT = IMPORT_FILE_EXTENSIONS.join(',');

export const IMPORT_MIME_TYPES: Record<string, string[]> = {
  zip: ['application/zip', 'application/x-zip-compressed'],
  csv: ['text/csv', 'application/csv'],
  tsv: ['text/tab-separated-values'],
  txt: ['text/plain'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  json: ['application/json'],
};

export const IMPORT_REQUIRED_FIELDS = {
  playback: ['sampleId', 'lockingTime', 'angle', 'torque'] as const,
  training: ['sampleId', 'lockingTime', 'failureMode', 'corrected', 'confidence', 'modelVersion'] as const,
};

export const COLUMN_SYNONYMS: Record<string, readonly string[]> = {
  sampleId: [
    'sample id', 'sampleid', 'sample no', 'sample_no', 'sampleno',
    '样本编号', '样本id', '样品编号', '样品id', 'sample',
  ],
  lockingTime: [
    'locking time', 'lockingtime', 'lock time', 'lock_time', 'locked at', 'locked_at',
    '时间', '锁定时间', '锁附时间', 'timestamp', 'datetime', 'date time', 'date',
  ],
  angle: [
    'angle', 'angles', 'deg', 'degree', 'degrees', 'rotation angle',
    '角度', '旋转角度', 'angle deg',
  ],
  torque: [
    'torque', 'torques', 'nm', 'n.m', 'n·m',
    '扭矩', '扭力', 'torque nm',
  ],
  time: [
    'time', 'elapsed time', 'elapsed_time', 'ms', 'millisecond',
    '时间', '毫秒', 'elapsed',
  ],
  failureMode: [
    'failure mode', 'failure_mode', 'failuremode', 'failure code', 'failure_code',
    '缺陷模式', '失效模式', '故障模式', 'failure', 'error code',
  ],
  corrected: [
    'corrected', 'is corrected', 'is_corrected', 'manual corrected',
    '已修正', '修正', 'correct',
  ],
  confidence: [
    'confidence', 'conf', 'confidence score', 'confidence_score',
    '置信度', '置信', 'confidence percent',
  ],
  modelVersion: [
    'model version', 'model_version', 'model', 'version',
    '模型版本', '模型', 'version',
  ],
};

export const RESULT_TEXT_MAP: Record<string, 'PASS' | 'FAIL'> = {
  pass: 'PASS',
  ok: 'PASS',
  p: 'PASS',
  '1': 'PASS',
  true: 'PASS',
  yes: 'PASS',
  fail: 'FAIL',
  ng: 'FAIL',
  f: 'FAIL',
  '0': 'FAIL',
  false: 'FAIL',
  no: 'FAIL',
};

export const FAILURE_CODES = [
  { key: 'F01', label: 'Floating High' },
  { key: 'F02', label: 'Fit Abnormal' },
  { key: 'F03', label: 'Clamping Abnormal' },
  { key: 'F04', label: 'Oblique Locking' },
  { key: 'F05', label: 'Slipped Tooth' },
  { key: 'F06', label: 'Bit Slipping' },
  { key: 'F07', label: 'Repeated Tightening' },
  { key: 'F08', label: 'Idle' },
  { key: 'F09', label: 'Trigger Loss' },
  { key: 'F10', label: 'Excessive Friction' },
  { key: 'F11', label: 'Torque Not Reached' },
  { key: 'F12', label: 'Screw Abnormal' },
  { key: 'F13', label: 'Hole Position Abnormal' },
];

export const MOCK_BATCHES: readonly BatchOption[] = [
  { id: 'B001', name: 'B001' },
  { id: 'B002', name: 'B002' },
  { id: 'B003', name: 'B003' },
  { id: 'B004', name: 'B004' },
  { id: 'B005', name: 'B005' },
];

export function isKnownFailureCode(value: string | null | undefined): boolean {
  if (!value) return false;
  const upper = value.trim().toUpperCase();
  return FAILURE_CODES.some((code) => code.key === upper);
}

export function validateTrainingRow(
  values: {
    sampleId: string;
    lockingTime: string;
    failureMode: string | null;
    confidence: number;
    modelVersion: string;
  },
  allRows: readonly TrainingRow[],
  currentId: string,
): { errors: Readonly<{ sampleId?: string; lockingTime?: string; failureMode?: string; confidence?: string; modelVersion?: string }>; duplicateSampleId: boolean; status: TrainingRowStatus; reason: string } {
  const errors: { sampleId?: string; lockingTime?: string; failureMode?: string; confidence?: string; modelVersion?: string } = {};
  const sampleIdInput = values.sampleId.trim();
  const failureModeInput = values.failureMode?.trim() ? values.failureMode.trim().toUpperCase() : null;

  if (!sampleIdInput) {
    errors.sampleId = 'Sample ID is required.';
  }

  const lockingTimeInput = values.lockingTime.trim();
  if (!lockingTimeInput) {
    errors.lockingTime = 'Locking time is required.';
  } else if (Number.isNaN(new Date(lockingTimeInput).getTime())) {
    errors.lockingTime = 'Enter a valid date and time.';
  }

  if (failureModeInput && !isKnownFailureCode(failureModeInput)) {
    errors.failureMode = `Unknown failure code: ${failureModeInput}.`;
  }

  if (!Number.isFinite(values.confidence) || values.confidence < 0 || values.confidence > 100) {
    errors.confidence = 'Confidence must be between 0 and 100.';
  }

  if (!values.modelVersion.trim()) {
    errors.modelVersion = 'Model version is required.';
  }

  const sampleId = sampleIdInput;
  const duplicateSampleId = sampleId
    ? allRows.some((row) => row.id !== currentId && row.sampleId.trim() === sampleId)
    : false;

  let status: TrainingRowStatus = 'Valid';
  let reason = '';

  if (!sampleId) {
    status = 'Error';
    reason = 'Missing Sample ID.';
  } else if (duplicateSampleId) {
    status = 'Warning';
    reason = 'Duplicate Sample ID inside the loaded rows.';
  } else if (errors['lockingTime']) {
    status = 'Warning';
    reason = 'Bad or missing locking time.';
  } else if (errors['confidence']) {
    status = 'Error';
    reason = 'Confidence must be between 0 and 100.';
  } else if (!values.modelVersion.trim()) {
    status = 'Error';
    reason = 'Missing model version.';
  } else if (errors['failureMode']) {
    status = 'Error';
    reason = errors['failureMode'];
  } else if (errors['sampleId']) {
    status = 'Error';
    reason = 'Missing Sample ID.';
  }

  return { errors: Object.freeze(errors), duplicateSampleId, status, reason };
}

export function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}