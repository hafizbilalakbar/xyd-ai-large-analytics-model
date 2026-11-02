import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FailureMode } from '../../data-access/dashboard.models';

interface FailureModeShare extends FailureMode {
  readonly share: number;
}

@Component({
  selector: 'app-failure-mode-chart',
  templateUrl: './failure-mode-chart.component.html',
  styleUrl: './failure-mode-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModeChartComponent {
  readonly modes = input.required<readonly FailureMode[]>();

  protected readonly total = computed(() =>
    this.modes().reduce((sum, mode) => sum + mode.count, 0),
  );

  protected readonly items = computed<readonly FailureModeShare[]>(() => {
    const total = this.total();

    return this.modes().map((mode) => ({
      ...mode,
      share: total > 0 ? Math.round((mode.count / total) * 100) : 0,
    }));
  });
}
