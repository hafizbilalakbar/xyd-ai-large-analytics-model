import { Routes } from '@angular/router';

export const PARAMETERS_AND_FORMULAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/parameters-and-formulas/parameters-and-formulas.component').then(
        (component) => component.ParametersAndFormulasComponent,
      ),
    title: 'Parameter & Formula Configuration | XYD AI Platform',
  },
];
