import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  OnDestroy,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

type SidebarMode = 'desktop' | 'tablet' | 'mobile';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnDestroy {
  private readonly viewportWidth = signal(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  private readonly desktopCollapsed = signal(this.loadCollapsed());

  protected readonly mode = computed<SidebarMode>(() => {
    const width = this.viewportWidth();
    if (width < 640) {
      return 'mobile';
    }
    if (width < 1024) {
      return 'tablet';
    }
    return 'desktop';
  });

  protected readonly drawerOpen = signal(false);
  protected readonly sidebarCollapsed = computed(() => {
    const mode = this.mode();
    if (mode === 'tablet') {
      return !this.drawerOpen();
    }
    if (mode === 'mobile') {
      return false;
    }
    return this.desktopCollapsed();
  });
  protected readonly announcement = signal('');
  protected readonly sidebarAnimated = signal(false);

  private lastMode: SidebarMode | null = null;
  private lastFocused: HTMLElement | null = null;
  private animateFrame: number | null = null;

  private readonly handleResize = (): void => {
    this.viewportWidth.set(window.innerWidth);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'b') {
      event.preventDefault();
      this.toggleSidebar();
      return;
    }

    if (this.mode() === 'desktop' || !this.drawerOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDrawer();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResize);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.handleKeyDown);
    }

    afterNextRender(() => {
      this.animateFrame = requestAnimationFrame(() => {
        this.animateFrame = null;
        this.sidebarAnimated.set(true);
      });
    });

    effect(() => {
      try {
        localStorage.setItem('sidebar-collapsed', String(this.desktopCollapsed()));
      } catch {
        return;
      }
    });

    effect((onCleanup) => {
      const locked = this.drawerOpen() && this.mode() !== 'desktop';
      if (!locked || typeof document === 'undefined') {
        return;
      }
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.body.style.overflow = previousOverflow;
      });
    });

    effect(() => {
      const mode = this.mode();
      if (this.lastMode === mode) {
        return;
      }
      this.lastMode = mode;
      this.drawerOpen.set(false);
    });
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
    if (this.animateFrame !== null) {
      cancelAnimationFrame(this.animateFrame);
    }
  }

  protected toggleSidebar(): void {
    if (this.mode() === 'desktop') {
      this.desktopCollapsed.update((collapsed) => !collapsed);
      this.announcement.set(
        this.desktopCollapsed() ? 'Sidebar collapsed' : 'Sidebar expanded',
      );
      return;
    }

    if (this.drawerOpen()) {
      this.closeDrawer();
      return;
    }

    this.openDrawer();
  }

  protected openDrawer(): void {
    if (this.mode() === 'desktop' || this.drawerOpen()) {
      return;
    }
    this.lastFocused =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.drawerOpen.set(true);
    this.announcement.set('Navigation menu opened');
    requestAnimationFrame(() => {
      const sidebar = document.getElementById('app-sidebar');
      const first = sidebar?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    });
  }

  protected closeDrawer(): void {
    if (!this.drawerOpen()) {
      return;
    }
    this.drawerOpen.set(false);
    this.announcement.set('Navigation menu closed');
    const target = this.lastFocused;
    this.lastFocused = null;
    requestAnimationFrame(() => {
      if (target?.isConnected) {
        target.focus();
      }
    });
  }

  private trapFocus(event: KeyboardEvent): void {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) {
      return;
    }
    const focusables = Array.from(
      sidebar.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!sidebar.contains(active)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private loadCollapsed(): boolean {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  }
}
