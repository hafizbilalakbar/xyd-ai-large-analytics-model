import { Routes } from '@angular/router';

export const DATA_IMPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/data-import/data-import.component').then(
        (component) => component.DataImportComponent,
      ),
    title: 'Data Import | XYD AI Platform',
  },
];
