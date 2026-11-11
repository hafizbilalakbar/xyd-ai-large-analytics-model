import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuditLogService } from '../../../../core/logging/audit-log.service';
import { SystemMetricsService } from '../../data-access/system-metrics.service';

const MEMORY_WARN_PERCENT = 80;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${plural(days, 'day')} ${plural(hours, 'hour')}`;
  }
  if (hours > 0) {
    return `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`;
  }
  if (minutes > 0) {
    return plural(minutes, 'minute');
  }
  return plural(seconds, 'second');
}

function mbToGb(value: number): string {
  return (Math.round((value / 1024) * 10) / 10).toFixed(1);
}

function exportStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

@Component({
  selector: 'app-logs-and-monitoring',
  imports: [PageHeaderComponent, ToastContainerComponent, IconComponent],
  templateUrl: './logs-and-monitoring.component.html',
  styleUrl: './logs-and-monitoring.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsAndMonitoringComponent implements OnDestroy {
  private readonly metricsService = inject(SystemMetricsService);
  private readonly auditLog = inject(AuditLogService);
  private readonly toastService = inject(ToastService);

  protected readonly metrics = this.metricsService.metrics;
  protected readonly metricsSource = this.metricsService.source;
  protected readonly logs = this.auditLog.entries;

  protected readonly filterTerm = signal('');

  private readonly nowTick = signal(Date.now());
  private readonly tickTimer = window.setInterval(() => {
    this.nowTick.set(Date.now());
  }, 1000);

  protected readonly filteredLogs = computed(() => {
    const term = this.filterTerm().trim().toLowerCase();
    if (term === '') {
      return this.logs();
    }
    return this.logs().filter(
      (entry) =>
        entry.message.toLowerCase().includes(term) || entry.kind.includes(term),
    );
  });

  protected readonly cpuPercent = computed(() =>
    Math.round(this.metrics()?.system.cpu_percent ?? 0),
  );

  protected readonly memPercent = computed(() =>
    Math.round(this.metrics()?.system.mem_percent ?? 0),
  );

  protected readonly memWarn = computed(() => this.memPercent() >= MEMORY_WARN_PERCENT);

  protected readonly diskPercent = computed(() => {
    const system = this.metrics()?.system;
    if (!system || !system.disk_total_mb || system.disk_total_mb <= 0) {
      return 0;
    }
    const used = system.disk_used_mb ?? 0;
    return Math.round((used / system.disk_total_mb) * 100);
  });

  protected readonly diskLabel = computed(() => {
    const system = this.metrics()?.system;
    if (!system || !system.disk_total_mb || system.disk_total_mb <= 0) {
      return '—';
    }
    const used =
      system.disk_used_mb === null || system.disk_used_mb === undefined
        ? null
        : mbToGb(system.disk_used_mb);
    return used === null ? '—' : `${used} / ${mbToGb(system.disk_total_mb)} GB`;
  });

  /** Uptime keeps counting between polls so the label ticks every second. */
  protected readonly uptimeLabel = computed(() => {
    const current = this.metrics();
    if (!current) {
      return '—';
    }
    const lastUpdatedAt = this.metricsService.lastUpdatedAt();
    const elapsedSincePoll =
      lastUpdatedAt > 0 ? Math.max(0, (this.nowTick() - lastUpdatedAt) / 1000) : 0;
    return formatUptime(current.system.uptime_s + elapsedSincePoll);
  });

  protected readonly todayIngestLabel = computed(() =>
    (this.metrics()?.ingest.today_count ?? 0).toLocaleString(),
  );

  protected readonly anomalyLabel = computed(() =>
    (this.metrics()?.ingest.error_count ?? 0).toLocaleString(),
  );

  protected readonly latestDataLabel = computed(() => {
    const lastAt = this.metrics()?.ingest.last_at;
    return lastAt ? this.auditLog.formatTimestamp(lastAt) : '—';
  });

  protected readonly activeVersionLabel = computed(
    () => this.metrics()?.inference.active_version ?? '—',
  );

  protected readonly inferenceTodayLabel = computed(() =>
    (this.metrics()?.inference.today_count ?? 0).toLocaleString(),
  );

  protected readonly avgDurationLabel = computed(() => {
    const avg = this.metrics()?.inference.avg_dur_ms;
    return avg === null || avg === undefined ? '—' : `${avg} ms`;
  });

  ngOnDestroy(): void {
    window.clearInterval(this.tickTimer);
  }

  protected formatEntryTime(isoTime: string): string {
    return this.auditLog.formatTimestamp(isoTime);
  }

  protected onFilterInput(event: Event): void {
    this.filterTerm.set((event.target as HTMLInputElement).value);
  }

  protected exportLogs(): void {
    const summary = [
      `  ${'System status'.padEnd(16)}CPU ${this.cpuPercent()}%, memory ${this.memPercent()}%, disk ${this.diskLabel()} (${this.diskPercent()}%), uptime ${this.uptimeLabel()}`,
      `  ${'Data access'.padEnd(16)}${this.todayIngestLabel()} records today, ${this.anomalyLabel()} anomalies, latest ${this.latestDataLabel()}`,
      `  ${'Model judgment'.padEnd(16)}version ${this.activeVersionLabel()}, ${this.inferenceTodayLabel()} inferences today, average ${this.avgDurationLabel()}`,
    ];
    const content = this.auditLog.buildExportFile(summary);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `operation-logs_${exportStamp(new Date())}.log`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toastService.show('Operation log exported.', 'success');
  }
}
