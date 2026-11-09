import type { ClassAccuracy, VersionDetails, VersionSummary } from './version-management.models';

export const USE_VERSION_MANAGEMENT_MOCK = true;

export const MOCK_VERSIONS: readonly VersionSummary[] = [
  {
    version: 'V3.0',
    type: 'base',
    trainedAt: '2026/11/2',
    sampleSize: 3254,
    accuracy: 95.6,
    active: true,
  },
  {
    version: 'V2.0',
    type: 'base',
    trainedAt: '2026/11/2',
    sampleSize: 1499,
    accuracy: 95.8,
    active: false,
  },
  {
    version: 'V1.0',
    type: 'base',
    trainedAt: '2026/11/2',
    sampleSize: 800,
    accuracy: 93.2,
    active: false,
  },
];

export const MOCK_CLASS_ACCURACY: readonly ClassAccuracy[] = [
  {
    category: 'F01 Buoyancy',
    code: 'F01',
    accuracies: { 'V2.0': 100, 'V3.0': 100 },
  },
  {
    category: 'F02 Poor fit',
    code: 'F02',
    accuracies: { 'V2.0': 100, 'V3.0': 96.2 },
  },
  {
    category: 'F03 Clamping abnormality',
    code: 'F03',
    accuracies: { 'V2.0': 98.6, 'V3.0': 100 },
  },
  {
    category: 'F04 Angled lock',
    code: 'F04',
    accuracies: { 'V2.0': 87, 'V3.0': 87 },
  },
  {
    category: 'F05 Slipped teeth',
    code: 'F05',
    accuracies: { 'V2.0': 92.9, 'V3.0': 94.1 },
  },
  {
    category: 'F06 Slipping bit',
    code: 'F06',
    accuracies: { 'V2.0': 88.2, 'V3.0': 88.2 },
  },
  {
    category: 'F08 Idling',
    code: 'F08',
    accuracies: { 'V2.0': 100, 'V3.0': 100 },
  },
  {
    category: 'PASS',
    code: 'PASS',
    accuracies: { 'V2.0': 99.8, 'V3.0': 99.6 },
  },
];

export const MOCK_VERSION_DETAILS: readonly VersionDetails[] = [
  {
    ...MOCK_VERSIONS[0],
    evalMode: 'cv5',
    trainingScope: 'All stations',
  },
  {
    ...MOCK_VERSIONS[1],
    evalMode: 'cv5',
    trainingScope: 'All stations',
  },
  {
    ...MOCK_VERSIONS[2],
    evalMode: null,
    trainingScope: null,
  },
];
