import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./tech-dashboard.component').then(m => m.TechDashboardComponent) },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];