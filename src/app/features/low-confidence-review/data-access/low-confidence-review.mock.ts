import { ReviewRow, ReviewFilterOptions } from './low-confidence-review.models';

export const USE_REVIEW_MOCK = true;

export const MOCK_REVIEW_ROWS: ReviewRow[] = [
  { serialNo: 1, sampleId: 'XYD-20261103-001', lockingTime: '2026-11-03 10:30', failureMode: 'F01', confidence: 72, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 2, sampleId: 'XYD-20261103-002', lockingTime: '2026-11-03 10:25', failureMode: 'F03', confidence: 65, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 3, sampleId: 'XYD-20261103-003', lockingTime: '2026-11-03 10:20', failureMode: 'F05', confidence: 58, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 4, sampleId: 'XYD-20261103-004', lockingTime: '2026-11-03 10:15', failureMode: 'F02', confidence: 78, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 5, sampleId: 'XYD-20261103-005', lockingTime: '2026-11-03 10:10', failureMode: 'F01', confidence: 45, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 6, sampleId: 'XYD-20261103-006', lockingTime: '2026-11-03 10:05', failureMode: 'F04', confidence: 69, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 7, sampleId: 'XYD-20261103-007', lockingTime: '2026-11-03 10:00', failureMode: 'F06', confidence: 55, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 8, sampleId: 'XYD-20261103-008', lockingTime: '2026-11-03 09:55', failureMode: 'F03', confidence: 62, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 9, sampleId: 'XYD-20261103-009', lockingTime: '2026-11-03 09:50', failureMode: 'F07', confidence: 48, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 10, sampleId: 'XYD-20261103-010', lockingTime: '2026-11-03 09:45', failureMode: 'F01', confidence: 74, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 11, sampleId: 'XYD-20261103-011', lockingTime: '2026-11-03 09:40', failureMode: 'F02', confidence: 67, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 12, sampleId: 'XYD-20261103-012', lockingTime: '2026-11-03 09:35', failureMode: 'F05', confidence: 52, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 13, sampleId: 'XYD-20261103-013', lockingTime: '2026-11-03 09:30', failureMode: 'F04', confidence: 79, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 14, sampleId: 'XYD-20261103-014', lockingTime: '2026-11-03 09:25', failureMode: 'F06', confidence: 61, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 15, sampleId: 'XYD-20261103-015', lockingTime: '2026-11-03 09:20', failureMode: 'F03', confidence: 43, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 16, sampleId: 'XYD-20261103-016', lockingTime: '2026-11-03 09:15', failureMode: 'F01', confidence: 76, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 17, sampleId: 'XYD-20261103-017', lockingTime: '2026-11-03 09:10', failureMode: 'F07', confidence: 59, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 18, sampleId: 'XYD-20261103-018', lockingTime: '2026-11-03 09:05', failureMode: 'F02', confidence: 64, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 19, sampleId: 'XYD-20261103-019', lockingTime: '2026-11-03 09:00', failureMode: 'F05', confidence: 71, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 20, sampleId: 'XYD-20261103-020', lockingTime: '2026-11-03 08:55', failureMode: 'F04', confidence: 56, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 21, sampleId: 'XYD-20261103-021', lockingTime: '2026-11-03 08:50', failureMode: 'F06', confidence: 68, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 22, sampleId: 'XYD-20261103-022', lockingTime: '2026-11-03 08:45', failureMode: 'F03', confidence: 77, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 23, sampleId: 'XYD-20261103-023', lockingTime: '2026-11-03 08:40', failureMode: 'F01', confidence: 49, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 24, sampleId: 'XYD-20261103-024', lockingTime: '2026-11-03 08:35', failureMode: 'F07', confidence: 73, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 25, sampleId: 'XYD-20261103-025', lockingTime: '2026-11-03 08:30', failureMode: 'F02', confidence: 66, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 26, sampleId: 'XYD-20261103-026', lockingTime: '2026-11-03 08:25', failureMode: 'F05', confidence: 54, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 27, sampleId: 'XYD-20261103-027', lockingTime: '2026-11-03 08:20', failureMode: 'F04', confidence: 70, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 28, sampleId: 'XYD-20261103-028', lockingTime: '2026-11-03 08:15', failureMode: 'F06', confidence: 47, corrected: false, modelVersion: 'V3.0' },
  { serialNo: 29, sampleId: 'XYD-20261103-029', lockingTime: '2026-11-03 08:10', failureMode: 'F03', confidence: 75, corrected: true, modelVersion: 'V3.0' },
  { serialNo: 30, sampleId: 'XYD-20261103-030', lockingTime: '2026-11-03 08:05', failureMode: 'F01', confidence: 60, corrected: false, modelVersion: 'V3.0' },
];

export const MOCK_REVIEW_FILTER_OPTIONS: ReviewFilterOptions = {
  correctedStatuses: [
    { key: 'all', label: 'All' },
    { key: 'uncorrected', label: 'Uncorrected' },
    { key: 'corrected', label: 'Corrected' },
  ],
  failureModes: [
    { key: 'F01', label: 'F01 Floating High' },
    { key: 'F02', label: 'F02 Adhesion Abnormality' },
    { key: 'F03', label: 'F03 Clamping Abnormality' },
    { key: 'F04', label: 'F04 Angled Lock' },
    { key: 'F05', label: 'F05 Slipped Teeth' },
    { key: 'F06', label: 'F06 Bit Slipping' },
    { key: 'F07', label: 'F07 Repeated' },
  ],
};
