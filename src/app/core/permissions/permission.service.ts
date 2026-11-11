import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AccessStoreService } from './access-store.service';
import { routeRuleForSegment } from './permission-catalog';
import { NAVIGATION_ITEMS, type NavigationItem } from '../config/navigation.config';

/**
 * Central place that decides which pages the signed-in user may see.
 *
 * The built-in administrator always has full access. Regular users get the
 * union of the permissions granted to their roles. The sidebar and the route
 * guards both read from this service so the two can never disagree.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);
  private readonly accessStore = inject(AccessStoreService);

  /** Granted permission ids, or `*` for the super administrator. */
  readonly granted = computed<ReadonlySet<string>>(() => {
    const user = this.auth.user();
    if (!user) {
      return new Set<string>();
    }
    if (user.isSuperAdmin) {
      return new Set<string>(['*']);
    }
    const permissions = new Set<string>();
    const rolePermissions = this.accessStore.rolePermissionsMap();
    for (const roleId of user.roleIds) {
      for (const permissionId of rolePermissions.get(roleId) ?? []) {
        permissions.add(permissionId);
      }
    }
    return permissions;
  });

  readonly isSuperAdmin = computed(() => this.auth.user()?.isSuperAdmin ?? false);

  can(permissionId: string): boolean {
    const granted = this.granted();
    return granted.has('*') || granted.has(permissionId);
  }

  /** Whether the first path segment of `url` (e.g. `/sample-search?x=1`) is accessible. */
  canAccessUrl(url: string): boolean {
    const segment = url.split('?')[0]?.split('/').filter(Boolean)[0] ?? '';
    const rule = routeRuleForSegment(segment);
    if (!rule) {
      return true;
    }
    if (rule.adminOnly) {
      return this.isSuperAdmin();
    }
    return rule.anyOf.some((permissionId) => this.can(permissionId));
  }

  /** Navigation entries visible for the current user. */
  readonly visibleNavigation = computed<readonly NavigationItem[]>(() => {
    const items: NavigationItem[] = [];
    for (const item of NAVIGATION_ITEMS) {
      if (this.canAccessUrl(item.route)) {
        items.push(item);
      }
    }
    return items;
  });

  hasAnyAccessibleRoute(): boolean {
    return this.visibleNavigation().length > 0;
  }

  firstAccessibleRoute(): string {
    return this.visibleNavigation()[0]?.route ?? '/dashboard';
  }
}
