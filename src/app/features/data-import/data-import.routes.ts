import { Routes } from '@angular/router';
import { DataImportPageComponent } from './pages/data-import-page/data-import-page.component';

export const DATA_IMPORT_ROUTES: Routes = [
  {
    path: '',
    component: DataImportPageComponent,
    title: 'Data Import',
  },
];
