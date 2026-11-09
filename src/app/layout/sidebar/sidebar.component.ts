import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { NAVIGATION_ITEMS } from '../../core/config/navigation.config';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ModelVersionService } from '../../shared/services/model-version.service';

type SidebarMode = 'desktop' | 'tablet' | 'mobile';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnDestroy {
  readonly collapsed = input(false);
  readonly mode = input<SidebarMode>('desktop');
  readonly drawerOpen = input(false);
  readonly animate = input(false);

  readonly toggleCollapse = output<void>();
  readonly closeDrawer = output<void>();

  private readonly modelVersions = inject(ModelVersionService);

  protected readonly navigationItems = NAVIGATION_ITEMS;
  protected readonly settings = APP_SETTINGS;
  protected readonly activeModelVersion = this.modelVersions.activeVersionLabel;
  protected readonly toggleLabel = computed(() =>
    this.collapsed() ? 'Expand sidebar' : 'Collapse sidebar',
  );
  protected readonly tooltipLabel = signal('');
  protected readonly tooltipTop = signal(0);
  protected readonly tooltipLeft = signal(0);

  private tooltipTimer: number | null = null;
  private touchStartX: number | null = null;

  ngOnDestroy(): void {
    this.clearTooltipTimer();
  }

  protected showItemTooltip(label: string, event: Event): void {
    if (!this.collapsed()) {
      return;
    }
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    this.clearTooltipTimer();
    const rect = target.getBoundingClientRect();
    const railRight = target.closest<HTMLElement>('.sidebar')?.getBoundingClientRect().right ?? rect.right;
    const top = Math.min(Math.max(rect.top + rect.height / 2, 40), window.innerHeight - 40);
    const left = Math.max(rect.right, railRight) + 12;
    this.tooltipTimer = window.setTimeout(() => {
      this.tooltipTimer = null;
      this.tooltipTop.set(top);
      this.tooltipLeft.set(left);
      this.tooltipLabel.set(label);
    }, 150);
  }

  protected hideItemTooltip(): void {
    this.clearTooltipTimer();
    this.tooltipLabel.set('');
  }

  protected onNavigate(): void {
    this.hideItemTooltip();
    this.closeDrawer.emit();
  }

  protected onTouchStart(event: TouchEvent): void {
    if (this.mode() !== 'mobile' || !this.drawerOpen()) {
      return;
    }
    this.touchStartX = event.touches[0]?.clientX ?? null;
  }

  protected onTouchEnd(event: TouchEvent): void {
    if (this.mode() !== 'mobile' || !this.drawerOpen() || this.touchStartX === null) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? this.touchStartX;
    if (this.touchStartX - endX > 60) {
      this.closeDrawer.emit();
    }
    this.touchStartX = null;
  }

  private clearTooltipTimer(): void {
    if (this.tooltipTimer !== null) {
      window.clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
  }
}
