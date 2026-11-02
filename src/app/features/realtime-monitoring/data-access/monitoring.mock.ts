import type {
  MonitoringMock,
  MonitoringRecord,
  MonitoringResult,
  TorqueAnglePoint,
} from './monitoring.models';

export const MOCK_MONITORING_STATE: 'empty' | 'live' = 'empty';

interface MockSample {
  readonly sampleId: string;
  readonly workstation: string;
  readonly torque: number;
  readonly angle: number;
  readonly result: MonitoringResult;
  readonly offsetSeconds: number;
}

const LOCK_CURVE: readonly TorqueAnglePoint[] = [
  { angle: 0, torque: 0.2 },
  { angle: 6, torque: 1.6 },
  { angle: 14, torque: 4.2 },
  { angle: 22, torque: 7.4 },
  { angle: 31, torque: 10.1 },
  { angle: 41, torque: 12.3 },
  { angle: 52, torque: 13.5 },
  { angle: 62, torque: 13.9 },
  { angle: 70, torque: 13.8 },
  { angle: 74.2, torque: 13.8 },
];

const MOCK_SAMPLES: readonly MockSample[] = [
  {
    sampleId: 'XYD-20261103-0148',
    workstation: 'WS-01',
    torque: 13.8,
    angle: 74.2,
    result: 'PASS',
    offsetSeconds: 8,
  },
  {
    sampleId: 'XYD-20261103-0147',
    workstation: 'WS-02',
    torque: 13.5,
    angle: 73.6,
    result: 'PASS',
    offsetSeconds: 24,
  },
  {
    sampleId: 'XYD-20261103-0146',
    workstation: 'WS-01',
    torque: 9.4,
    angle: 58.1,
    result: 'FAIL',
    offsetSeconds: 41,
  },
  {
    sampleId: 'XYD-20261103-0145',
    workstation: 'WS-03',
    torque: 13.9,
    angle: 74.8,
    result: 'PASS',
    offsetSeconds: 57,
  },
  {
    sampleId: 'XYD-20261103-0144',
    workstation: 'WS-02',
    torque: 13.2,
    angle: 72.4,
    result: 'PASS',
    offsetSeconds: 80,
  },
  {
    sampleId: 'XYD-20261103-0143',
    workstation: 'WS-01',
    torque: 14,
    angle: 75.1,
    result: 'PASS',
    offsetSeconds: 105,
  },
  {
    sampleId: 'XYD-20261103-0142',
    workstation: 'WS-03',
    torque: 8.7,
    angle: 54.9,
    result: 'FAIL',
    offsetSeconds: 130,
  },
  {
    sampleId: 'XYD-20261103-0141',
    workstation: 'WS-02',
    torque: 13.6,
    angle: 73.9,
    result: 'PASS',
    offsetSeconds: 158,
  },
  {
    sampleId: 'XYD-20261103-0140',
    workstation: 'WS-01',
    torque: 13.7,
    angle: 74.1,
    result: 'PASS',
    offsetSeconds: 184,
  },
  {
    sampleId: 'XYD-20261103-0139',
    workstation: 'WS-03',
    torque: 13.4,
    angle: 73.2,
    result: 'PASS',
    offsetSeconds: 210,
  },
  {
    sampleId: 'XYD-20261103-0138',
    workstation: 'WS-02',
    torque: 13.9,
    angle: 74.5,
    result: 'PASS',
    offsetSeconds: 240,
  },
  {
    sampleId: 'XYD-20261103-0137',
    workstation: 'WS-01',
    torque: 13.1,
    angle: 72.8,
    result: 'PASS',
    offsetSeconds: 270,
  },
];

export function createMonitoringMock(): MonitoringMock {
  if (MOCK_MONITORING_STATE === 'empty') {
    return {
      serviceStatus: 'idle',
      deviceStatus: 'waiting',
      activationModelVersion: 'V3.0',
      records: [],
    };
  }

  const now = Date.now();
  const records: readonly MonitoringRecord[] = MOCK_SAMPLES.map((sample) => ({
    id: sample.sampleId,
    sampleId: sample.sampleId,
    workstation: sample.workstation,
    torque: sample.torque,
    angle: sample.angle,
    modelVersion: 'V3.0',
    result: sample.result,
    lockedAt: new Date(now - sample.offsetSeconds * 1000),
    curve: LOCK_CURVE,
  }));

  return {
    serviceStatus: 'receiving',
    deviceStatus: 'pushed',
    activationModelVersion: 'V3.0',
    records,
  };
}
