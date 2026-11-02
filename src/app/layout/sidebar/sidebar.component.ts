import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { NAVIGATION_ITEMS } from '../../core/config/navigation.config';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);

  readonly toggleCollapse = output<void>();
  readonly closeMobile = output<void>();

  protected readonly navigationItems = NAVIGATION_ITEMS;
  protected readonly settings = APP_SETTINGS;
}
