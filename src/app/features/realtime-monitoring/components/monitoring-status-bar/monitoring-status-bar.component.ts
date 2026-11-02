import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-monitoring-status-bar',
  imports: [DatePipe],
  templateUrl: './monitoring-status-bar.component.html',
  styleUrl: './monitoring-status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringStatusBarComponent {
  readonly isTimedOut = input.required<boolean>();
  readonly frequency = input.required<number | null>();
  readonly lastReceivedAt = input.required<Date | null>();

  protected readonly frequencyLabel = computed(() => {
    const frequency = this.frequency();
    return frequency === null ? '—' : `${frequency} / min`;
  });
}
