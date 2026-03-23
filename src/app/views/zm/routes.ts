import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./zm-dashboard.component').then(m => m.ZmDashboardComponent)
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('../admin/approvals/approvals.component').then(m => m.ApprovalsComponent)
  },
  {
    path: 'technician-approvals',
    loadComponent: () =>
      import('./technician-approvals/technician-approvals.component').then(m => m.TechnicianApprovalsComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];