import { Injectable, computed, signal, inject } from '@angular/core';
import { MOCK_RESULTS } from '../../sample-search/data-access/sample.mock';
import { OperationLogService, Alarm } from '../../../shared/services/operation-log.service';
import type { DashboardKpi, FailureMode, HourlyTrendPoint } from './dashboard.models';
import type { SampleResult } from '../../sample-search/data-access/sample-models';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayKey = dateKey(0);
const yesterdayKey = dateKey(-1);

function todayOnlyRecords(): SampleResult[] {
  return MOCK_RESULTS.filter((r: { lockingTime: string }) => r.lockingTime.startsWith(todayKey));
}

function yesterdayOnlyRecords(): SampleResult[] {
  return MOCK_RESULTS.filter((r: { lockingTime: string }) => r.lockingTime.startsWith(yesterdayKey));
}

function hourKey(dt: string): string {
  const match = dt.match(/ (\d{2}):/);
  return match ? match[1] + ':00' : '';
}

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly logService = inject(OperationLogService);

  private readonly todayResults = signal(todayOnlyRecords());
  private readonly yesterdayResults = signal(yesterdayOnlyRecords());

  readonly kpis = computed<readonly DashboardKpi[]>(() => {
    const today = this.todayResults();
    const yesterday = this.yesterdayResults();

    const todayTotal = today.length;
    const todayPass = today.filter((r: { result: string }) => r.result === 'PASS').length;
    const todayFail = today.filter((r: { result: string }) => r.result === 'FAIL').length;
    const todayLowConf = today.filter((r: { confidence: number | null }) => r.confidence != null && r.confidence < 80).length;

    const yesterdayTotal = yesterday.length;
    const yesterdayPass = yesterday.filter((r: { result: string }) => r.result === 'PASS').length;
    const yesterdayFail = yesterday.filter((r: { result: string }) => r.result === 'FAIL').length;
    const yesterdayLowConf = yesterday.filter((r: { confidence: number | null }) => r.confidence != null && r.confidence < 80).length;

    const passRate = todayTotal > 0 ? Math.round((todayPass / todayTotal) * 1000) / 10 : 0;
    const yesterdayPassRate = yesterdayTotal > 0 ? Math.round((yesterdayPass / yesterdayTotal) * 1000) / 10 : 0;

    const deltaTotal = yesterdayTotal > 0 ? todayTotal - yesterdayTotal : 0;
    const deltaPassRate = yesterdayTotal > 0 ? passRate - yesterdayPassRate : 0;
    const deltaFail = yesterdayTotal > 0 ? todayFail - yesterdayFail : 0;
    const deltaLowConf = yesterdayTotal > 0 ? todayLowConf - yesterdayLowConf : 0;

    return [
      {
        label: 'Total Locked Items Today',
        value: String(todayTotal),
        icon: 'layers',
        tone: 'primary' as const,
        delta: yesterdayTotal > 0 ? `${deltaTotal >= 0 ? '+' : ''}${deltaTotal}` : null,
        deltaDirection: deltaTotal >= 0 ? 'up' : 'down',
        deltaTone: deltaTotal >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'PASS Rate',
        value: yesterdayTotal > 0 ? `${passRate.toFixed(1)}%` : '—',
        icon: 'check',
        tone: 'success' as const,
        delta: yesterdayTotal > 0 ? `${deltaPassRate >= 0 ? '+' : '-'}${Math.abs(deltaPassRate).toFixed(1)}%` : null,
        deltaDirection: deltaPassRate >= 0 ? 'up' : 'down',
        deltaTone: deltaPassRate >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'FAIL Count',
        value: String(todayFail),
        icon: 'alert',
        tone: 'danger' as const,
        delta: yesterdayTotal > 0 ? `${deltaFail >= 0 ? '+' : '-'}${Math.abs(deltaFail)}` : null,
        deltaDirection: deltaFail >= 0 ? 'up' : 'down',
        deltaTone: deltaFail >= 0 ? 'negative' : 'positive',
      },
      {
        label: 'Low Confidence Count',
        value: String(todayLowConf),
        icon: 'activity',
        tone: 'warning' as const,
        delta: yesterdayTotal > 0 ? `${deltaLowConf >= 0 ? '+' : '-'}${Math.abs(deltaLowConf)}` : null,
        deltaDirection: deltaLowConf >= 0 ? 'up' : 'down',
        deltaTone: deltaLowConf >= 0 ? 'negative' : 'positive',
      },
    ];
  });

  readonly hourlyTrend = computed<readonly HourlyTrendPoint[]>(() => {
    const today = this.todayResults();
    const now = new Date();
    const currentHour = now.getHours();
    const byHour = new Map<string, number>();

    // Only include hours from 00:00 to current hour
    for (let h = 0; h <= currentHour; h++) {
      byHour.set(pad(h) + ':00', 0);
    }

    for (const r of today) {
      const hk = hourKey(r.lockingTime);
      if (hk && byHour.has(hk)) {
        byHour.set(hk, (byHour.get(hk) ?? 0) + 1);
      }
    }

    return Array.from(byHour.entries()).map(([hour, count]) => ({ hour, count }));
  });

  readonly failureModes = computed<readonly FailureMode[]>(() => {
    const today = this.todayResults();
    const byMode = new Map<string, number>();
    for (const r of today) {
      if ((r as { result: string; failureMode: string | null }).result === 'FAIL' && (r as { failureMode: string | null }).failureMode) {
        const mode = (r as { failureMode: string }).failureMode!;
        byMode.set(mode, (byMode.get(mode) ?? 0) + 1);
      }
    }
    const modes: FailureMode[] = Array.from(byMode.entries()).map(([label, count]) => ({
      label,
      count,
      tone: 'slate' as const,
    }));
    modes.sort((a, b) => b.count - a.count);
    return modes;
  });

  readonly alarms = this.logService.alarmEntries;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  addAlarm(type: Alarm['type'], details: string) {
    this.logService.addAlarm(type, details);
  }

  markAlarmRead(id: number) {
    this.logService.markAlarmRead(id);
  }

  removeAlarm(id: number) {
    this.logService.removeAlarm(id);
  }
}
