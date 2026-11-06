import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { FailureModeChartComponent } from '../../components/failure-mode-chart/failure-mode-chart.component';
import { HourlyTrendChartComponent } from '../../components/hourly-trend-chart/hourly-trend-chart.component';
import { RecentWarningComponent } from '../../components/recent-warning/recent-warning.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { DashboardStore } from '../../data-access/dashboard.store';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    PageHeaderComponent,
    StatCardComponent,
    HourlyTrendChartComponent,
    FailureModeChartComponent,
    RecentWarningComponent,
    IconComponent,
    ToastContainerComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly store = inject(DashboardStore);
  private readonly toast = inject(ToastService);

  readonly kpis = this.store.kpis;
  readonly hourlyTrend = this.store.hourlyTrend;
  readonly failureModes = this.store.failureModes;
  readonly alarms = this.store.alarms;
  readonly loading = this.store.loading;

  readonly refreshing = signal(false);
  readonly lastUpdated = signal(formatTime(new Date()));

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;

  ngOnInit(): void {
    this.scheduleRefresh();
    this.setupVisibilityHandler();
    this.checkStorageAlarm();
    Promise.resolve().then(() => this.store.loading.set(false));
  }

  ngOnDestroy(): void {
    this.stopRefreshTimer();
    this.removeVisibilityHandler();
  }

  private scheduleRefresh(): void {
    this.stopRefreshTimer();
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.refreshTimer = setTimeout(() => {
      void this.onRefresh();
    }, 60000);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.stopRefreshTimer();
      } else {
        this.scheduleRefresh();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeVisibilityHandler(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private checkStorageAlarm(): void {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage
        .estimate()
        .then((estimate) => {
          const total = estimate.quota ?? 0;
          const used = estimate.usage ?? 0;
          if (total > 0 && (total - used) / total < 0.05) {
            this.store.addAlarm('storage', 'Insufficient disk space/critical');
          }
        })
        .catch(() => {});
    }
  }

  async onRefresh(): Promise<void> {
    if (this.refreshing()) {
      return;
    }

    this.refreshing.set(true);
    this.store.loading.set(true);
    this.store.error.set(null);

    try {
      await Promise.all([this.reloadData(), new Promise((resolve) => setTimeout(resolve, 500))]);
      this.lastUpdated.set(formatTime(new Date()));
    } catch {
      this.store.error.set('Refresh failed. Keeping previous data.');
      this.toast.show('Refresh failed. Please try again.', 'error');
    } finally {
      this.store.loading.set(false);
      this.refreshing.set(false);
      this.scheduleRefresh();
      this.checkStorageAlarm();
    }
  }

  private async reloadData(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    this.store.refreshData();
  }

  onAlarmMarkRead(id: number): void {
    this.store.markAlarmRead(id);
  }

  onAlarmRemove(id: number): void {
    this.store.removeAlarm(id);
  }
}
