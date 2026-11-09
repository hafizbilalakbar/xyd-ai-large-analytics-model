import { Injectable, computed, inject, signal } from '@angular/core';
import { USE_SAMPLE_MOCK } from '../../sample-search/data-access/sample.mock';
import { OperationLogService, Alarm } from '../../../shared/services/operation-log.service';
import {
  DASHBOARD_ALARMS,
  DASHBOARD_KPIS,
  EMPTY_KPIS,
  FAILURE_MODES,
  HOURLY_TREND,
} from './dashboard.data';
import type { DashboardKpi, FailureMode, HourlyTrendPoint } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly logService = inject(OperationLogService);

  private readonly refreshCounter = signal(0);

  private readonly sampleAlarms = signal<readonly Alarm[]>(
    USE_SAMPLE_MOCK ? [...DASHBOARD_ALARMS] : [],
  );

  readonly kpis = computed<readonly DashboardKpi[]>(() => {
    this.refreshCounter();
    return USE_SAMPLE_MOCK ? DASHBOARD_KPIS : EMPTY_KPIS;
  });

  readonly hourlyTrend = computed<readonly HourlyTrendPoint[]>(() => {
    this.refreshCounter();
    return USE_SAMPLE_MOCK ? HOURLY_TREND : [];
  });

  readonly failureModes = computed<readonly FailureMode[]>(() => {
    this.refreshCounter();
    return USE_SAMPLE_MOCK ? FAILURE_MODES : [];
  });

  readonly alarms = computed<readonly Alarm[]>(() => {
    this.refreshCounter();
    return [...this.sampleAlarms(), ...this.logService.alarmEntries()];
  });

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  addAlarm(type: Alarm['type'], details: string): void {
    this.logService.addAlarm(type, details);
  }

  markAlarmRead(id: number): void {
    if (this.sampleAlarms().some((alarm) => alarm.id === id)) {
      this.sampleAlarms.update((list) =>
        list.map((alarm) => (alarm.id === id ? { ...alarm, read: true } : alarm)),
      );
      return;
    }
    this.logService.markAlarmRead(id);
  }

  removeAlarm(id: number): void {
    if (this.sampleAlarms().some((alarm) => alarm.id === id)) {
      this.sampleAlarms.update((list) => list.filter((alarm) => alarm.id !== id));
      return;
    }
    this.logService.removeAlarm(id);
  }

  refreshData(): void {
    this.refreshCounter.update((counter) => counter + 1);
  }
}
