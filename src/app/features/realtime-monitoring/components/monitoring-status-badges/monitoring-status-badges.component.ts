import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BadgeStatus = 'idle' | 'receiving' | 'timeout' | 'error';

@Component({
  selector: 'app-monitoring-status-badges',
  templateUrl: './monitoring-status-badges.component.html',
  styleUrl: './monitoring-status-badges.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringStatusBadgesComponent {
  readonly serviceStatus = input.required<BadgeStatus>();
  readonly modelVersion = input.required<string>();

  protected readonly serviceLabel = computed(() => {
    switch (this.serviceStatus()) {
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
}
