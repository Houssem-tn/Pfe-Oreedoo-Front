import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./stt-dashboard.component').then(m => m.SttDashboardComponent)
  },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent),
    data: { caseType: 'ACTIVATION' }
  },
  {
    path: 'cases/complaint',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent),
    data: { caseType: 'PLAINTE' }
  },
  {
    path: 'cases/execution',
    loadComponent: () =>
      import('../tech/tech-activation-cases.component').then(m => m.TechActivationCasesComponent)
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
  {
    path: 'invite-technicians',
    loadComponent: () =>
      import('./invite-technicians/invite-technicians.component').then(m => m.InviteTechniciansComponent)
  },
  // Stock Management
  {
    path: 'stock',
    redirectTo: 'stock/my-stock',
    pathMatch: 'full'
  },
  {
    path: 'stock/my-stock',
    loadComponent: () =>
      import('./stock/my-stock/stt-my-stock.component').then(m => m.SttMyStockComponent),
    data: { title: 'My Stock' }
  },
  {
    path: 'stock/incoming-dpms',
    loadComponent: () =>
      import('./stock/incoming-dpms/incoming-dpms.component').then(m => m.IncomingDpmsComponent),
    data: { title: 'Incoming DPMs' }
  },
  {
    path: 'stock/distribute',
    loadComponent: () =>
      import('./stock/distribute/distribute.component').then(m => m.DistributeComponent),
    data: { title: 'Distribute to TECH' }
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];
