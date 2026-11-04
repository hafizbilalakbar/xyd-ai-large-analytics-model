export type ImportTab = 'playback' | 'training';

export type ImportStatus =
  | 'idle'
  | 'reading'
  | 'extracting'
  | 'detecting'
  | 'parsing'
  | 'validating'
  | 'saving'
  | 'done'
  | 'failed'
  | 'cancelled';

export type PlaybackResultStatus = 'PASS' | 'FAIL' | 'Pending';
export type TrainingRowStatus = 'Valid' | 'Warning' | 'Error';
export type DuplicateMode = 'skip' | 'overwrite';
export type MatchConfidence = 'High' | 'Medium' | 'Low';

export interface BatchOption {
  readonly id: string;
  readonly name: string;
}

export interface CurvePoint {
  readonly angle: number;
  readonly torque: number;
}

export interface PlaybackCurveItem {
  readonly id: string;
  readonly fileName: string;
  readonly sampleId: string;
  readonly batchId: string;
  readonly lockingTime: string;
  readonly pointCount: number;
  readonly result: PlaybackResultStatus;
  readonly warning: boolean;
  readonly warningReason?: string;
  readonly curve: readonly CurvePoint[];
  readonly peakTorque: number;
  readonly finalAngle: number;
}

export interface TrainingRow {
  readonly id: string;
  readonly fileName: string;
  readonly rowIndex: number;
  readonly sampleId: string;
  readonly lockingTime: string;
  readonly failureMode: string | null;
  readonly failureModeRaw: string | null;
  readonly corrected: boolean;
  readonly confidence: number;
  readonly modelVersion: string;
  readonly status: TrainingRowStatus;
  readonly reason: string;
  readonly edited: boolean;
}

export interface TrainingRowFieldErrors {
  readonly sampleId?: string;
  readonly lockingTime?: string;
  readonly failureMode?: string;
  readonly confidence?: string;
  readonly modelVersion?: string;
}

export interface TrainingRowValidation {
  readonly errors: TrainingRowFieldErrors;
  readonly duplicateSampleId: boolean;
  readonly status: TrainingRowStatus;
  readonly reason: string;
}

export interface TrainingRowValues {
  readonly sampleId: string;
  readonly lockingTime: string;
  readonly failureMode: string | null;
  readonly failureModeRaw: string | null;
  readonly confidence: number;
  readonly modelVersion: string;
}

export interface TrainingSource {
  readonly fileName: string;
  readonly rowCount: number;
}

export interface ColumnMapping {
  readonly field: string;
  readonly sourceColumn: string | null;
  readonly confidence: MatchConfidence;
  readonly samples: readonly (string | null)[];
}

export interface FileParseError {
  readonly fileName: string;
  readonly rowIndex?: number;
  readonly message: string;
}

export interface FileParseResult {
  readonly fileName: string;
  readonly curves: readonly PlaybackCurveItem[];
  readonly rows: readonly TrainingRow[];
  readonly errors: readonly FileParseError[];
}

export interface ImportProgress {
  readonly status: ImportStatus;
  readonly percent: number;
  readonly stage: string;
  readonly fileName: string;
  readonly elapsedMs: number;
}

export interface ImportProgressState {
  readonly status: ImportStatus;
  readonly percent: number;
  readonly stage: string;
  readonly fileName: string;
  readonly elapsedMs: number;
}

export interface PlaybackImportResult {
  readonly items: readonly PlaybackCurveItem[];
  readonly errors: readonly FileParseError[];
}

export interface TrainingImportResult {
  readonly rows: readonly TrainingRow[];
  readonly errors: readonly FileParseError[];
}

export interface WriteTrainingResult {
  readonly written: number;
  readonly skipped: number;
  readonly failed: number;
}

export type WorkerRequest =
  | { type: 'parsePlayback'; files: readonly File[]; batchId: string }
  | { type: 'parseTraining'; files: readonly File[] }
  | { type: 'cancel' };

export type WorkerResponse =
  | { type: 'progress'; progress: ImportProgress }
  | { type: 'playbackResult'; result: PlaybackImportResult }
  | { type: 'trainingResult'; result: TrainingImportResult }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };
