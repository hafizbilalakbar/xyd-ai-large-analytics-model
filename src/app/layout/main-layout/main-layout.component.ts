import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileSidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  protected openMobileSidebar(): void {
    this.mobileSidebarOpen.set(true);
  }

  protected closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }
}
