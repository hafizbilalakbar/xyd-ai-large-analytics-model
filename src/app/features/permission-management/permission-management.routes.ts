import { Routes } from '@angular/router';

export const PERMISSION_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/permission-management/permission-management.component').then(
        (component) => component.PermissionManagementComponent,
      ),
    title: 'Permission Management | XYD AI Platform',
  },
];
