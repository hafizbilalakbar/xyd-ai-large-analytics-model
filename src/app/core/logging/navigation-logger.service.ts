import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuditLogService } from './audit-log.service';
import { ROUTE_TO_PAGE } from './log-actions';

/**
 * Logs page navigation from the router (one hook, not click handlers in every
 * component). Emits `ui.navigate <Page Name>` on each successful navigation.
 * Dedupes repeat navigations to the same route within 1 second.
 */
@Injectable({ providedIn: 'root' })
export class NavigationLogger {
  private readonly router = inject(Router);
  private readonly auditLog = inject(AuditLogService);
  private lastRoute = '';
  private lastNavTime = 0;

  constructor() {
    this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) {
        return;
      }
      const url = event.urlAfterRedirects;
      const segment = url.split('?')[0]?.split('/').filter(Boolean)[0] ?? '';
      const route = `/${segment}`;
      if (!route || route === '/login') {
        return;
      }
      const now = Date.now();
      if (route === this.lastRoute && now - this.lastNavTime < 1000) {
        return;
      }
      this.lastRoute = route;
      this.lastNavTime = now;
      const pageName = ROUTE_TO_PAGE[route] ?? segment;
      this.auditLog.logOperate('ui.navigate', pageName);
    });
  }
}
