import { Routes } from '@angular/router';

export const TRAINING_TASKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/training-tasks/training-tasks.component').then(
        (component) => component.TrainingTasksComponent,
      ),
    title: 'Training Task Management | XYD AI Platform',
  },
];
