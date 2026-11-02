import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((routes) => routes.DASHBOARD_ROUTES),
      },
      {
        path: 'realtime-monitoring',
        loadChildren: () =>
          import('./features/realtime-monitoring/realtime-monitoring.routes').then(
            (routes) => routes.REALTIME_MONITORING_ROUTES,
          ),
      },
      {
        path: 'sample-search',
        loadChildren: () =>
          import('./features/sample-search/sample-search.routes').then(
            (routes) => routes.SAMPLE_SEARCH_ROUTES,
          ),
      },
      {
        path: 'low-confidence-review',
        loadChildren: () =>
          import('./features/low-confidence-review/low-confidence-review.routes').then(
            (routes) => routes.LOW_CONFIDENCE_REVIEW_ROUTES,
          ),
      },
      {
        path: 'data-import',
        loadChildren: () =>
          import('./features/data-import/data-import.routes').then(
            (routes) => routes.DATA_IMPORT_ROUTES,
          ),
      },
      {
        path: 'data-export',
        loadChildren: () =>
          import('./features/data-export/data-export.routes').then(
            (routes) => routes.DATA_EXPORT_ROUTES,
          ),
      },
      {
        path: 'parameters-and-formulas',
        loadChildren: () =>
          import('./features/parameters-and-formulas/parameters-and-formulas.routes').then(
            (routes) => routes.PARAMETERS_AND_FORMULAS_ROUTES,
          ),
      },
      {
        path: 'training-tasks',
        loadChildren: () =>
          import('./features/training-tasks/training-tasks.routes').then(
            (routes) => routes.TRAINING_TASKS_ROUTES,
          ),
      },
      {
        path: 'version-management',
        loadChildren: () =>
          import('./features/version-management/version-management.routes').then(
            (routes) => routes.VERSION_MANAGEMENT_ROUTES,
          ),
      },
      {
        path: 'logs-and-monitoring',
        loadChildren: () =>
          import('./features/logs-and-monitoring/logs-and-monitoring.routes').then(
            (routes) => routes.LOGS_AND_MONITORING_ROUTES,
          ),
      },
      {
        path: 'permission-management',
        loadChildren: () =>
          import('./features/permission-management/permission-management.routes').then(
            (routes) => routes.PERMISSION_MANAGEMENT_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
