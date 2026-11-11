import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostBinding,
  input,
} from '@angular/core';
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
  readonly size = input<number>(20);

  @HostBinding('style.--icon-size')
  protected readonly iconSize = `${this.size()}px`;

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
}
