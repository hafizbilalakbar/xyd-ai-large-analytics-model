import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-monitoring-empty-state',
  templateUrl: './monitoring-empty-state.component.html',
  styleUrl: './monitoring-empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringEmptyStateComponent {
  readonly serviceRunning = input.required<boolean>();
  readonly devicePushed = input.required<boolean>();
  readonly activeVersion = input.required<string>();
  readonly samplesByVersionList = input.required<
    { versionId: string; count: number; lastReceived: string }[]
  >();
}