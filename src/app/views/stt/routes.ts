import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./stt-dashboard.component').then(m => m.SttDashboardComponent)
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('../admin/approvals/approvals.component').then(m => m.ApprovalsComponent)
  },
  {
    path: 'my-technicians',
    loadComponent: () =>
      import('./my-technicians/my-technicians.component').then(m => m.MyTechniciansComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];