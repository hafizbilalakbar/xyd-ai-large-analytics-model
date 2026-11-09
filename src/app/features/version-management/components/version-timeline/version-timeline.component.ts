import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
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

  readonly activate = output<number>();
  readonly details = output<number>();

  readonly modelTypeLabel = (type: 'basic' | 'local'): string =>
    type === 'basic' ? 'Basic Model' : 'Local Model';

  readonly isActive = (version: VersionTimelineItem): boolean =>
    version.version === this.activeVersion();

  readonly accuracyText = (accuracy: number | null): string =>
    accuracy === null ? '—' : `${(accuracy * 100).toFixed(1)}%`;

  readonly barWidth = (accuracy: number | null): number =>
    accuracy === null ? 0 : Math.max(0, Math.min(100, accuracy * 100));

  private readonly displayValues = signal<Record<
    number,
    { accuracy: number | null; sample: number | null }
  >>({});
  private animFrame: number | null = null;

  constructor() {
    effect(() => {
      const list = this.versions();
      this.startAnimations(list);
    });
  }

  accuracyDisplay(versionId: number): number | null {
    return this.displayValues()[versionId]?.accuracy ?? null;
  }

  sampleDisplay(versionId: number): number | null {
    return this.displayValues()[versionId]?.sample ?? null;
  }

  private startAnimations(list: readonly VersionTimelineItem[]): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    const start = Date.now();
    const targets: Record<number, { a: number | null; s: number | null }> = {};
    for (const item of list) {
      targets[item.versionId] = { a: item.accuracy, s: item.sampleSize };
    }
    const tick = (): void => {
      const elapsed = Date.now() - start;
      let t = elapsed / 600;
      if (t > 1) {
        t = 1;
      }
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const next: Record<number, { accuracy: number | null; sample: number | null }> = {};
      for (const [id, target] of Object.entries(targets)) {
        const numId = Number(id);
        next[numId] = {
          accuracy: target.a === null ? null : eased * target.a,
          sample: target.s === null ? null : Math.round(eased * target.s),
        };
      }
      this.displayValues.set(next);
      if (t < 1) {
        this.animFrame = requestAnimationFrame(tick);
      } else {
        this.animFrame = null;
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }
}
