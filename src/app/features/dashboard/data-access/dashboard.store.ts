import { Injectable, signal } from '@angular/core';
import {
  DASHBOARD_KPIS,
  FAILURE_MODES,
  HOURLY_TREND,
  SYSTEM_WARNINGS,
} from './dashboard.data';
import type {
  DashboardKpi,
  FailureMode,
  HourlyTrendPoint,
  SystemWarning,
} from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  readonly kpis = signal<readonly DashboardKpi[]>(DASHBOARD_KPIS).asReadonly();
  readonly hourlyTrend = signal<readonly HourlyTrendPoint[]>(HOURLY_TREND).asReadonly();
  readonly failureModes = signal<readonly FailureMode[]>(FAILURE_MODES).asReadonly();
  readonly warnings = signal<readonly SystemWarning[]>(SYSTEM_WARNINGS).asReadonly();
}
