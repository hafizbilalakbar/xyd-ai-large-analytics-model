import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { VersionTimelineItem } from '../../data-access/version-management.models';

@Component({
  selector: 'app-version-timeline',
  standalone: true,
  imports: [],
  templateUrl: './version-timeline.component.html',
  styleUrl: './version-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionTimelineComponent {
  readonly versions = input.required<readonly VersionTimelineItem[]>();
  readonly activeVersion = input.required<string>();

  readonly activate = output<string>();
  readonly details = output<string>();

  readonly modelTypeLabel = (type: 'base' | 'local'): string =>
    type === 'base' ? 'Basic Model' : 'Local Model';

  readonly isActive = (version: VersionTimelineItem): boolean =>
    version.version === this.activeVersion();

  readonly accuracyText = (accuracy: number | null): string =>
    accuracy === null ? '—' : `${accuracy.toFixed(1)}%`;

  readonly barWidth = (accuracy: number | null): number =>
    accuracy === null ? 0 : Math.max(0, Math.min(100, accuracy));
}
