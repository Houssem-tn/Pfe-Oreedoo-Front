import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./tech-dashboard.component').then(m => m.TechDashboardComponent),
    data: { titleKey: 'nav.fieldDashboard' }
  },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('./tech-activation-cases.component').then(m => m.TechActivationCasesComponent),
    data: { titleKey: 'nav.activationCases' }
  },
  {
    path: 'cases/complaint',
    loadComponent: () =>
      import('./tech-activation-cases.component').then(m => m.TechActivationCasesComponent),
    data: { caseType: 'PLAINTE', titleKey: 'nav.complaintCases' }
  },
  {
    path: 'stock/my-stock',
    loadComponent: () =>
      import('./stock/my-stock/tech-my-stock.component').then(m => m.TechMyStockComponent),
    data: { titleKey: 'nav.myEquipment' }
  },
  {
    path: 'stock/my-permissions',
    loadComponent: () =>
      import('./stock/my-permissions/tech-my-permissions.component').then(m => m.TechMyPermissionsComponent),
    data: { titleKey: 'nav.myPermissions' }
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];
