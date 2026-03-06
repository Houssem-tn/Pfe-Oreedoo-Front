import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./stt-dashboard.component').then(m => m.SttDashboardComponent) },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];