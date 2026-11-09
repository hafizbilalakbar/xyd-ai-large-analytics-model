import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MonitoringServiceStatus } from '../../data-access/monitoring.models';

@Component({
  selector: 'app-monitoring-status-badges',
  templateUrl: './monitoring-status-badges.component.html',
  styleUrl: './monitoring-status-badges.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringStatusBadgesComponent {
  readonly serviceStatus = input.required<MonitoringServiceStatus>();
  readonly modelVersion = input.required<string>();

  protected readonly serviceLabel = computed(() => {
    if (this.serviceStatus() === 'receiving') {
      return 'Receiving';
    }

    if (this.serviceStatus() === 'error') {
      return 'Error';
    }

    return 'Idle';
  });
}
