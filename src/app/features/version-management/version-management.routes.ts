import { Routes } from '@angular/router';

export const VERSION_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/version-management-page/version-management-page.component').then(
        (component) => component.VersionManagementPageComponent,
      ),
    title: 'Version Management | XYD AI Platform',
  },
];
