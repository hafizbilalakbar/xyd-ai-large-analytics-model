import { Routes } from '@angular/router';

export const PARAMETERS_AND_FORMULAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        './pages/parameters-and-formulas-page/parameters-and-formulas-page.component'
      ).then((m) => m.ParametersAndFormulasPageComponent),
    title: 'Parameter & Formula Configuration',
  },
];
