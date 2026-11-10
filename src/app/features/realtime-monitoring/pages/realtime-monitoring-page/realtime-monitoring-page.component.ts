import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { MonitoringEmptyStateComponent } from '../../components/monitoring-empty-state/monitoring-empty-state.component';
import { MonitoringLiveResultComponent } from '../../components/monitoring-live-result/monitoring-live-result.component';
import { MonitoringStatusBadgesComponent } from '../../components/monitoring-status-badges/monitoring-status-badges.component';
import { MonitoringStatusBarComponent } from '../../components/monitoring-status-bar/monitoring-status-bar.component';
import { MonitoringService } from '../../data-access/monitoring.service';

type MonitorStatus = 'idle' | 'receiving' | 'timeout' | 'error';

@Component({
  selector: 'app-realtime-monitoring-page',
  imports: [
    PageHeaderComponent,
    MonitoringStatusBadgesComponent,
    MonitoringEmptyStateComponent,
    MonitoringLiveResultComponent,
    MonitoringStatusBarComponent,
  ],
  templateUrl: './realtime-monitoring-page.component.html',
  styleUrl: './realtime-monitoring-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RealtimeMonitoringPageComponent {
  protected readonly monitoring = inject(MonitoringService);

  protected readonly status = computed<MonitorStatus>(() => this.monitoring.status());
  protected readonly loadError = this.monitoring.loadError$;
  protected readonly activeModelVersion = computed(
    () => this.monitoring.activeVersion() ?? '—',
  );

  protected readonly serviceRunning = computed(
    () => this.status() !== 'error',
  );
  protected readonly devicePushed = computed(
    () => this.monitoring.deviceStatus() === 'pushed',
  );

  protected readonly badgeLabel = computed(() => {
    switch (this.status()) {
      case 'receiving':
        return 'Receiving';
      case 'timeout':
        return 'Timeout';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  });

  protected readonly barTimedOut = computed(() => this.status() === 'timeout');

  retry(): void {
    void this.monitoring.refresh();
  }
}
