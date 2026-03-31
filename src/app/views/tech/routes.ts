import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./tech-dashboard.component').then(m => m.TechDashboardComponent) },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('./tech-activation-cases.component').then(m => m.TechActivationCasesComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];
