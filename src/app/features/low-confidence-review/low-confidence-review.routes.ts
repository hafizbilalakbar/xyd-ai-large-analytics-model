import { Routes } from '@angular/router';

export const LOW_CONFIDENCE_REVIEW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/low-confidence-review-page/low-confidence-review-page.component').then(
        (component) => component.LowConfidenceReviewPageComponent,
      ),
    title: 'Low Confidence Review | XYD AI Platform',
  },
];
