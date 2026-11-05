import { ChangeDetectionStrategy, Component, inject, signal, HostListener, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { FailureModeChartComponent } from '../../components/failure-mode-chart/failure-mode-chart.component';
import { HourlyTrendChartComponent } from '../../components/hourly-trend-chart/hourly-trend-chart.component';
import { RecentWarningComponent } from '../../components/recent-warning/recent-warning.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { DashboardStore } from '../../data-access/dashboard.store';
import type { DashboardKpi } from '../../data-access/dashboard.models';

function parseNumber(value: string): number {
  const n = Number(value.replace(/,/g, '').replace('%', ''));
  return isNaN(n) ? 0 : n;
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly store = inject(DashboardStore);

  readonly kpis = this.store.kpis;
  readonly hourlyTrend = this.store.hourlyTrend;
  readonly failureModes = this.store.failureModes;
  readonly alarms = this.store.alarms;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly refreshing = signal(false);
  readonly lastUpdated = signal(formatTime(new Date()));

  private readonly animatedValues = signal<Map<string, number>>(new Map());
  private animationFrame: number | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;

  readonly displayValue = (kpi: DashboardKpi): string => {
    const animated = this.animatedValues().get(kpi.label);
    const target = parseNumber(kpi.value);
    const current = animated ?? target;
    if (kpi.label === 'PASS Rate') {
      return formatPercent(current);
    }
    return formatNumber(current);
  };

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.destroy();
  }

  ngOnInit(): void {
    this.startCountUpFromZero();
    this.startRefreshTimer();
    this.setupVisibilityHandler();
    this.checkStorageAlarm();
    // First load: hide skeletons after initial render
    Promise.resolve().then(() => {
      this.store.loading.set(false);
    });
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private destroy(): void {
    this.cancelAnimation();
    this.stopRefreshTimer();
    this.removeVisibilityHandler();
  }

  private startCountUpFromZero(): void {
    const kpis = this.kpis();
    const start = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const next = new Map<string, number>();
      for (const kpi of kpis) {
        const target = parseNumber(kpi.value);
        next.set(kpi.label, target * easeProgress);
      }
      this.animatedValues.set(next);

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  private startCountUpToTargets(): void {
    const prev = this.animatedValues();
    const kpis = this.kpis();
    const start = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const next = new Map<string, number>();
      for (const kpi of kpis) {
        const target = parseNumber(kpi.value);
        const current = prev.get(kpi.label) ?? target;
        next.set(kpi.label, current + (target - current) * easeProgress);
      }
      this.animatedValues.set(next);

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  private cancelAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshTimer = setTimeout(() => {
      this.onRefresh();
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
      if (document.visibilityState === 'visible') {
        this.stopRefreshTimer();
        this.onRefresh();
        this.startRefreshTimer();
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
      navigator.storage.estimate().then(est => {
        const total = est.quota ?? 0;
        const used = est.usage ?? 0;
        const free = total - used;
        if (total > 0 && free / total < 0.05) {
          this.store.addAlarm('storage', 'Insufficient disk space/critical');
        }
      }).catch(() => {
      });
    }
  }

  onRefresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.store.loading.set(true);
    this.store.error.set(null);

    Promise.resolve().then(() => {
      this.startCountUpToTargets();
      this.lastUpdated.set(formatTime(new Date()));
      this.store.loading.set(false);
      this.refreshing.set(false);
      this.startRefreshTimer();
      this.checkStorageAlarm();
    }).catch(() => {
      this.store.loading.set(false);
      this.refreshing.set(false);
      this.store.error.set('Refresh failed. Keeping previous data.');
      this.startRefreshTimer();
    });
  }

  onAlarmMarkRead(id: number): void {
    this.store.markAlarmRead(id);
  }

  onAlarmRemove(id: number): void {
    this.store.removeAlarm(id);
  }
}
