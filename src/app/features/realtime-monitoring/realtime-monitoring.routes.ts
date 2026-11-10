import { Routes } from '@angular/router';

export const REALTIME_MONITORING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/realtime-monitoring-page/realtime-monitoring-page.component').then(
        (component) => component.RealtimeMonitoringPageComponent,
      ),
    title: 'Real-time Lock Monitoring',
  },
];
