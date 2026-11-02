import { Routes } from '@angular/router';

export const VERSION_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/version-management/version-management.component').then(
        (component) => component.VersionManagementComponent,
      ),
    title: 'Version Management | XYD AI Platform',
  },
];
