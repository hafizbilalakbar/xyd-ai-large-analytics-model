import { Routes } from '@angular/router';

export const DATA_EXPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/data-export/data-export.component').then(
        (component) => component.DataExportComponent,
      ),
    title: 'Data Export',
  },
];
