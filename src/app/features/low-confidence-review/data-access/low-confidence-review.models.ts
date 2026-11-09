export interface ReviewFilter {
  correctedStatus: string;
  failureModes: string[];
  confidenceMin: number;
  confidenceMax: number;
  startDate: string;
  endDate: string;
}

export interface ReviewRow {
  serialNo: number;
  sampleId: string;
  lockingTime: string;
  failureMode: string | null;
  confidence: number | null;
  corrected: boolean;
  modelVersion: string;
}

export interface ReviewFilterOptions {
  correctedStatuses: { key: string; label: string }[];
  failureModes: { key: string; label: string }[];
}

export interface ReviewSort {
  field: 'lockingTime' | 'confidence';
  direction: 'asc' | 'desc';
}

export interface ReviewEditForm {
  sampleId: string;
  failureMode: string | null;
  corrected: boolean;
  modelVersion: string;
}

export interface ReviewModalState {
  type: 'view' | 'edit' | 'delete' | 'bulkDelete' | 'discard' | null;
  record: ReviewRow | null;
}

export const REVIEW_FILTER_DEFAULTS: ReviewFilter = {
  correctedStatus: 'uncorrected',
  failureModes: [],
  confidenceMin: 0,
  confidenceMax: 80,
  startDate: '',
  endDate: '',
};

export const REVIEW_SORT_DEFAULT: ReviewSort = {
  field: 'confidence',
  direction: 'asc',
};
