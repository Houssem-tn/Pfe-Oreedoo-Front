import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./tech-dashboard.component').then(m => m.TechDashboardComponent) },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];