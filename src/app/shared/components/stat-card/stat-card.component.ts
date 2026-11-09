import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import type { IconName } from '../icon/icon-paths';

export type StatTone = 'primary' | 'success' | 'danger' | 'warning';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly tone = input<StatTone>('primary');
  readonly delta = input<string | null>('');
  readonly deltaDirection = input<'up' | 'down'>('up');
  readonly deltaTone = input<'positive' | 'negative'>('positive');
  readonly loading = input(false);

  isNeutralDelta(delta: string | null): boolean {
    if (!delta) return false;
    const n = Number(delta.replace(/[+%]/g, ''));
    return n === 0;
  }
}
