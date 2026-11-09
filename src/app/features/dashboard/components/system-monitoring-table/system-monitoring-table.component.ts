import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SystemWarning } from '../../data-access/dashboard.models';

@Component({
  selector: 'app-system-monitoring-table',
  templateUrl: './system-monitoring-table.component.html',
  styleUrl: './system-monitoring-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemMonitoringTableComponent {
  readonly warnings = input.required<readonly SystemWarning[]>();

  protected readonly activeCount = computed(
    () => this.warnings().filter((warning) => warning.status !== 'Resolved').length,
  );
}
