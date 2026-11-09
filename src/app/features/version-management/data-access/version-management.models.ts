import type { ModelEvaluationMode, ModelVersionType } from '../../../shared/services/model-version.service';

export interface ClassAccuracy {
  readonly category: string;
  readonly code: string;
  readonly accuracies: Readonly<Record<string, number | null>>;
}

export interface VersionSummary {
  readonly versionId: string;
  readonly version: string;
  readonly type: ModelVersionType;
  readonly trainedAt: string | null;
  readonly sampleSize: number | null;
  readonly accuracy: number | null;
  readonly active: boolean;
  readonly sourceTaskId: string | null;
}

export type VersionTimelineItem = VersionSummary;

export interface VersionDetails extends VersionSummary {
  readonly evalMode: ModelEvaluationMode | null;
  readonly trainingScope: string | null;
}

export interface VersionComparison {
  readonly olderVersion: string;
  readonly newerVersion: string;
  readonly olderVersionId: string;
  readonly newerVersionId: string;
}

export interface ApiEvaluationMetrics {
  readonly accuracy_macro: number | null;
  readonly accuracy_weighted: number | null;
  readonly per_class: Readonly<Record<string, number | null>>;
  readonly by_combo: Readonly<Record<string, number | null>> | null;
  readonly sample_count: number | null;
  readonly dropped_count: number;
  readonly eval_mode: ModelEvaluationMode | null;
  readonly is_placeholder: boolean;
}

export interface ApiModelVersion {
  readonly version_id: string;
  readonly version: string;
  readonly type: ModelVersionType;
  readonly trained_at: string | null;
  readonly sample_count: number | null;
  readonly accuracy_macro: number | null;
  readonly is_active: boolean;
  readonly metrics?: ApiEvaluationMetrics | null;
  readonly parent_version_id?: number | null;
  readonly training_scope?: string | null;
  readonly source_task_id?: string | null;
}

export interface GetVersionsResponse {
  readonly items: readonly ApiModelVersion[];
  readonly default_compare: readonly string[];
}

export interface GetClassAccuracyResponse {
  readonly classAccuracies: readonly ClassAccuracy[];
}

export interface ActivationApiResponse {
  readonly version_id: string;
  readonly version: string;
  readonly duration_ms: number;
}

export interface DeleteVersionResponse {
  readonly version_id: string;
  readonly version: string;
}
