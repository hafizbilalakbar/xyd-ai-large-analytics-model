import { Routes } from '@angular/router';

export const SAMPLE_SEARCH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sample-search/sample-search.component').then(
        (component) => component.SampleSearchComponent,
      ),
    title: 'Sample Query | XYD AI Platform',
  },
];
