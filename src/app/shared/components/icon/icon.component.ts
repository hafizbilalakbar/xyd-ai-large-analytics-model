import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_PATHS } from './icon-paths';
import type { IconName } from './icon-paths';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
