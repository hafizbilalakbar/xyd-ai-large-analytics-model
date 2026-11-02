import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { FailureModeChartComponent } from '../../components/failure-mode-chart/failure-mode-chart.component';
import { HourlyTrendChartComponent } from '../../components/hourly-trend-chart/hourly-trend-chart.component';
import { SystemMonitoringTableComponent } from '../../components/system-monitoring-table/system-monitoring-table.component';
import { DashboardStore } from '../../data-access/dashboard.store';

@Component({
  selector: 'app-dashboard',
  imports: [
    PageHeaderComponent,
    StatCardComponent,
    HourlyTrendChartComponent,
    FailureModeChartComponent,
    SystemMonitoringTableComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly dashboardStore = inject(DashboardStore);

  protected readonly kpis = this.dashboardStore.kpis;
  protected readonly hourlyTrend = this.dashboardStore.hourlyTrend;
  protected readonly failureModes = this.dashboardStore.failureModes;
  protected readonly warnings = this.dashboardStore.warnings;
}
