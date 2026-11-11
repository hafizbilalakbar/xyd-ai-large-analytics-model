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
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuditLogService, formatTimestamp } from '../../../../core/logging/audit-log.service';
import { SystemMetricsService } from '../../data-access/system-metrics.service';
import { PermissionService } from '../../../../core/permissions/permission.service';

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
  imports: [
    PageHeaderComponent,
    ToastContainerComponent,
    IconComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './logs-and-monitoring.component.html',
  styleUrl: './logs-and-monitoring.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsAndMonitoringComponent implements OnDestroy {
  private readonly metricsService = inject(SystemMetricsService);
  private readonly auditLog = inject(AuditLogService);
  private readonly toastService = inject(ToastService);
  private readonly permissions = inject(PermissionService);

  protected readonly metrics = this.metricsService.metrics;
  protected readonly metricsSource = this.metricsService.source;
  protected readonly entries = this.auditLog.entries;
  protected readonly filteredEntries = this.auditLog.filteredEntries;

  protected readonly filterTerm = signal('');

  protected readonly metricsLoading = signal(false);
  protected readonly metricsError = signal(false);

  private readonly nowTick = signal(Date.now());
  private readonly tickTimer = window.setInterval(() => {
    this.nowTick.set(Date.now());
  }, 1000);

  private exportTimer: number | null = null;

  constructor() {
    // Log that this page was opened
    this.auditLog.logOperate('ui.navigate', 'Logs & Monitoring');
  }

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
    return lastAt ? formatTimestamp(lastAt) : '—';
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

  protected readonly canClearLogs = computed(() =>
    this.permissions.can('log:clear'),
  );

  ngOnDestroy(): void {
    window.clearInterval(this.tickTimer);
    if (this.exportTimer !== null) {
      window.clearTimeout(this.exportTimer);
      this.exportTimer = null;
    }
  }

  protected formatEntryTime(isoTime: string): string {
    return formatTimestamp(isoTime);
  }

  protected isFailEntry(entry: { kind: string; message: string }): boolean {
    return (
      entry.kind === 'interface' &&
      /\b(4\d\d|5\d\d)\b/.test(entry.message)
    );
  }

  protected onFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filterTerm.set(value);
    this.auditLog.setFilter(value);
  }

  protected clearFilter(): void {
    this.filterTerm.set('');
    this.auditLog.clearFilter();
  }

  protected exportLogs(): void {
    const filtered = this.filteredEntries();
    const content = this.auditLog.exportContent(filtered);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `operation-logs_${exportStamp(new Date())}.log`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    this.auditLog.logOperate('logs.export', `${filtered.length} entries`);
    this.toastService.show('Operation log exported.', 'success');
  }

  // ---------- Clear logs dialog ----------

  protected readonly clearDialogOpen = signal(false);

  protected openClearDialog(): void {
    this.clearDialogOpen.set(true);
  }

  protected onClearCancel(): void {
    this.clearDialogOpen.set(false);
  }

  protected onClearConfirm(): void {
    this.clearDialogOpen.set(false);
    this.auditLog.clear();
    this.auditLog.logOperate('logs.clear', 'all entries');
    this.toastService.show('Logs cleared', 'success');
  }

  // ---------- Metrics retry ----------

  protected retryMetrics(): void {
    this.metricsLoading.set(true);
    this.metricsError.set(false);
    this.metricsService.poll();
    window.setTimeout(() => {
      this.metricsLoading.set(false);
      if (!this.metrics() || this.metricsSource() === 'local') {
        this.metricsError.set(true);
      }
    }, 3000);
  }
}
