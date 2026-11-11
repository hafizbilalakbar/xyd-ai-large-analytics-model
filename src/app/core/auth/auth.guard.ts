import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PermissionService } from '../permissions/permission.service';

/** Redirects unauthenticated visitors to the login page. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  auth.ensureSessionValid();
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Blocks direct URL access to pages the current role cannot use. Denied
 * visitors are sent to the first page their role allows; users without any
 * accessible page are signed out.
 */
export const permissionGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  if (permissions.canAccessUrl(state.url)) {
    return true;
  }
  if (permissions.hasAnyAccessibleRoute()) {
    return router.createUrlTree([permissions.firstAccessibleRoute()]);
  }
  auth.signOut(false);
  return router.createUrlTree(['/login'], {
    queryParams: { reason: 'no-access' },
  });
};
