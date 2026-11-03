export interface SampleFilter {
  electricBatchNumber: string;
  modelName: string[];
  electricScrewdriverModel: string[];
  bitType: string[];
  screwSpec: string[];
  lockedItemMaterial: string[];
  gluePeelingResistant: string;
  toothType: string;
  resultStatus: string;
  failureModes: string[];
  confidence: string;
  startDate: string;
  endDate: string;
}

export interface SampleResult {
  serialNo: number;
  sampleId: string;
  lockingTime: string;
  electricScrewdriverModel: string;
  screwSpecification: string;
  result: 'PASS' | 'FAIL';
  failureMode: string | null;
  confidence: number | null;
  corrected: boolean;
  modelVersion: string;
}

export interface FilterOption {
  key: string;
  label: string;
}

export interface SampleFilterOptions {
  electricBatchNumbers: FilterOption[];
  modelNames: FilterOption[];
  electricScrewdriverModels: FilterOption[];
  bitTypes: FilterOption[];
  screwSpecs: FilterOption[];
  lockedItemMaterials: FilterOption[];
  gluePeelingResistantOptions: FilterOption[];
  toothTypes: FilterOption[];
  resultStatuses: FilterOption[];
  failureModes: FilterOption[];
  confidenceOptions: FilterOption[];
}

export const SAMPLE_FILTER_DEFAULTS: SampleFilter = {
  electricBatchNumber: 'all',
  modelName: [],
  electricScrewdriverModel: [],
  bitType: [],
  screwSpec: [],
  lockedItemMaterial: [],
  gluePeelingResistant: 'all',
  toothType: 'all',
  resultStatus: 'all',
  failureModes: [],
  confidence: 'all',
  startDate: '',
  endDate: '',
};
