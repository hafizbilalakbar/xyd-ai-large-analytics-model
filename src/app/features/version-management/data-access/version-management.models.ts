export interface ClassAccuracy {
  category: string;
  code: string;
  accuracies: Readonly<Record<string, number | null>>;
}

export interface VersionSummary {
  version: string;
  type: 'base' | 'local';
  trainedAt: string | null;
  sampleSize: number | null;
  accuracy: number | null;
  active: boolean;
}

export type VersionTimelineItem = VersionSummary;

export interface VersionDetails extends VersionSummary {
  evalMode: 'cv5' | 'trainset' | null;
  trainingScope: string | null;
}

export interface VersionComparison {
  olderVersion: string;
  newerVersion: string;
}

export interface GetVersionsResponse {
  versions: readonly VersionSummary[];
}

export interface GetClassAccuracyResponse {
  classAccuracies: readonly ClassAccuracy[];
}

export interface ActivateVersionResponse {
  success: boolean;
  activatedVersion: string;
  previousVersion: string | null;
  durationMs: number;
}
