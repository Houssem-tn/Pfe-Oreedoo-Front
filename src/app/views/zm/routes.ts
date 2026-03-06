import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./zm-dashboard.component').then(m => m.ZmDashboardComponent) },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];