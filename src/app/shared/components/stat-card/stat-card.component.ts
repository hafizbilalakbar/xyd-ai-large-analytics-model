import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import type { IconName } from '../icon/icon-paths';

export type StatTone = 'primary' | 'success' | 'danger' | 'warning';

@Component({
  selector: 'app-stat-card',
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
  readonly delta = input('');
  readonly deltaDirection = input<'up' | 'down'>('up');
  readonly deltaTone = input<'positive' | 'negative'>('positive');
}
