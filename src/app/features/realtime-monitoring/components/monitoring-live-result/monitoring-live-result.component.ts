import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { MonitoringRecord } from '../../data-access/monitoring.models';
import { TorqueAngleChartComponent } from '../torque-angle-chart/torque-angle-chart.component';

@Component({
  selector: 'app-monitoring-live-result',
  imports: [DatePipe, TorqueAngleChartComponent],
  templateUrl: './monitoring-live-result.component.html',
  styleUrl: './monitoring-live-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringLiveResultComponent {
  readonly record = input.required<MonitoringRecord>();
  readonly recentRecords = input.required<readonly MonitoringRecord[]>();
  readonly activeVersion = input.required<string>();
}
