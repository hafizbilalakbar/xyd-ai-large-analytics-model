import type { IconName } from '../../../shared/components/icon/icon-paths';
import type { StatTone } from '../../../shared/components/stat-card/stat-card.component';

export type DeltaDirection = 'up' | 'down';
export type DeltaTone = 'positive' | 'negative';

export interface DashboardKpi {
  readonly label: string;
  readonly value: string;
  readonly icon: IconName;
  readonly tone: StatTone;
  readonly delta: string | null;
  readonly deltaDirection: DeltaDirection;
  readonly deltaTone: DeltaTone;
}

export interface HourlyTrendPoint {
  readonly hour: string;
  readonly count: number;
}

export type FailureModeTone = 'blue' | 'amber' | 'red' | 'violet' | 'slate';

export interface FailureMode {
  readonly code: string;
  readonly name: string;
  readonly count: number;
  readonly tone: FailureModeTone;
}

export type AlarmLevel = 'Critical' | 'Warning' | 'Info';

export interface Alarm {
  readonly id: number;
  readonly time: string;
  readonly type: 'storage' | 'model' | 'training' | 'export';
  readonly details: string;
  readonly read: boolean;
}

export type WarningLevel = 'Critical' | 'Warning' | 'Info';
export type WarningStatus = 'Open' | 'Investigating' | 'Resolved';

export interface SystemWarning {
  readonly id: number;
  readonly time: string;
  readonly level: WarningLevel;
  readonly service: string;
  readonly message: string;
  readonly status: WarningStatus;
}
