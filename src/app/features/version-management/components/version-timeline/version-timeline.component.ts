import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import type { AccuracyTone, VersionTimelineItem } from '../../data-access/version-management.models';
import {
  accuracyBarWidth,
  accuracyText,
  accuracyTone,
} from '../../data-access/version-management.models';

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
  readonly canDelete = input<(versionId: string) => boolean>(() => false);

  readonly activate = output<string>();
  readonly details = output<string>();
  readonly delete = output<string>();

  readonly modelTypeLabel = (type: 'basic' | 'local'): string =>
    type === 'basic' ? 'Basic Model' : 'Local Model';

  readonly isActive = (version: VersionTimelineItem): boolean =>
    version.version === this.activeVersion();

  readonly accuracyTone = accuracyTone;

  private readonly displayValues = signal<Record<
    string,
    { accuracy: number | null; sample: number | null }
  >>({});
  private animFrame: number | null = null;

  constructor() {
    effect(() => {
      const list = this.versions();
      this.startAnimations(list);
    });
  }

  accuracyDisplay(versionId: string): number | null {
    return this.displayValues()[versionId]?.accuracy ?? null;
  }

  sampleDisplay(versionId: string): number | null {
    return this.displayValues()[versionId]?.sample ?? null;
  }

  accuracyValueText(versionId: string): string {
    const acc = this.accuracyDisplay(versionId);
    return accuracyText(acc);
  }

  accuracyBarTone(versionId: string): AccuracyTone {
    return accuracyTone(this.accuracyDisplay(versionId));
  }

  accuracyBarWidthValue(versionId: string): number {
    return accuracyBarWidth(this.accuracyDisplay(versionId));
  }

  versionCanDelete = (version: VersionTimelineItem): boolean =>
    this.canDelete()(version.versionId);

  private startAnimations(list: readonly VersionTimelineItem[]): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    const start = Date.now();
    const targets: Record<string, { a: number | null; s: number | null }> = {};
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
      const next: Record<string, { accuracy: number | null; sample: number | null }> = {};
      for (const [id, target] of Object.entries(targets)) {
        next[id] = {
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
