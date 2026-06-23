import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./tech-dashboard.component').then(m => m.TechDashboardComponent) },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('./tech-activation-cases.component').then(m => m.TechActivationCasesComponent)
  },
  {
    path: 'cases/complaint',
    loadComponent: () =>
      import('./tech-activation-cases.component').then(m => m.TechActivationCasesComponent),
    data: { caseType: 'PLAINTE' }
  },
  {
    path: 'stock/my-stock',
    loadComponent: () =>
      import('./stock/my-stock/tech-my-stock.component').then(m => m.TechMyStockComponent),
    data: { title: 'My Equipment' }
  },
  {
    path: 'stock/my-permissions',
    loadComponent: () =>
      import('./stock/my-permissions/tech-my-permissions.component').then(m => m.TechMyPermissionsComponent),
    data: { title: 'My Permission Requests' }
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];
