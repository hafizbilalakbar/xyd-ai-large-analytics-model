import { Routes } from '@angular/router';
import { SampleSearchPageComponent } from './pages/sample-search-page/sample-search-page.component';

export const SAMPLE_SEARCH_ROUTES: Routes = [
  {
    path: '',
    component: SampleSearchPageComponent,
    title: 'Sample Query',
  },
];