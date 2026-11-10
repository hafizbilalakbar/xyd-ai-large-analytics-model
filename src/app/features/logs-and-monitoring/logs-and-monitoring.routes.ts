import { Routes } from '@angular/router';

export const LOGS_AND_MONITORING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/logs-and-monitoring/logs-and-monitoring.component').then(
        (component) => component.LogsAndMonitoringComponent,
      ),
    title: 'Logs & Monitoring',
  },
];
