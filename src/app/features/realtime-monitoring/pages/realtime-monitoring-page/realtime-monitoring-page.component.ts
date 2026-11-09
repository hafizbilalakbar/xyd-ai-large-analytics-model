import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ModelVersionStore } from '../../../../shared/services/model-version.store';
import { MonitoringEmptyStateComponent } from '../../components/monitoring-empty-state/monitoring-empty-state.component';
import { MonitoringLiveResultComponent } from '../../components/monitoring-live-result/monitoring-live-result.component';
import { MonitoringStatusBadgesComponent } from '../../components/monitoring-status-badges/monitoring-status-badges.component';
import { MonitoringStatusBarComponent } from '../../components/monitoring-status-bar/monitoring-status-bar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { MonitoringService } from '../../data-access/monitoring.service';

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
  protected readonly modelVersions = inject(ModelVersionStore);
  protected readonly serviceRunning = computed(
    () => this.monitoring.serviceStatus() !== 'error',
  );
  protected readonly devicePushed = computed(
    () => this.monitoring.deviceStatus() === 'pushed',
  );
  protected readonly activeModelVersion = computed(
    () => this.modelVersions.activeVersion()?.id ?? '—',
  );
}
