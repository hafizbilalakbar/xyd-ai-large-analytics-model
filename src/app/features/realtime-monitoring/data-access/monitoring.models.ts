export type MonitoringServiceStatus = 'idle' | 'receiving' | 'error';
export type MonitoringDeviceStatus = 'waiting' | 'pushed';
export type MonitoringResult = 'PASS' | 'FAIL';

export interface TorqueAnglePoint {
  readonly angle: number;
  readonly torque: number;
}

export interface MonitoringRecord {
  readonly id: string;
  readonly sampleId: string;
  readonly workstation: string;
  readonly torque: number;
  readonly angle: number;
  readonly modelVersion: string;
  readonly result: MonitoringResult;
  readonly lockedAt: Date;
  readonly curve: readonly TorqueAnglePoint[];
}

export interface MonitoringMock {
  readonly serviceStatus: MonitoringServiceStatus;
  readonly deviceStatus: MonitoringDeviceStatus;
  readonly activationModelVersion: string;
  readonly records: readonly MonitoringRecord[];
}
