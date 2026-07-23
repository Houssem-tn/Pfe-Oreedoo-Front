import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./stt-dashboard.component').then(m => m.SttDashboardComponent),
    data: { titleKey: 'nav.dashboard' }
  },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent),
    data: { caseType: 'ACTIVATION', titleKey: 'nav.activationCases' }
  },
  {
    path: 'cases/complaint',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent),
    data: { caseType: 'PLAINTE', titleKey: 'nav.complaintCases' }
  },
  {
    path: 'res-execution',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent),
    data: { caseType: 'PLAINTE', caseModule: 'RES', titleKey: 'routes.resExecution' }
  },
  {
    path: 'cases/execution',
    loadComponent: () =>
      import('../tech/tech-activation-cases.component').then(m => m.TechActivationCasesComponent),
    data: { titleKey: 'routes.fieldSttExecution' }
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('../admin/approvals/approvals.component').then(m => m.ApprovalsComponent),
    data: { titleKey: 'nav.approvals' }
  },
  {
    path: 'my-technicians',
    loadComponent: () =>
      import('./my-technicians/my-technicians.component').then(m => m.MyTechniciansComponent),
    data: { titleKey: 'nav.myTechnicians' }
  },
  {
    path: 'invite-technicians',
    loadComponent: () =>
      import('./invite-technicians/invite-technicians.component').then(m => m.InviteTechniciansComponent),
    data: { titleKey: 'nav.inviteTechnicians' }
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
    data: { titleKey: 'nav.myStock' }
  },
  {
    path: 'stock/incoming-dpms',
    loadComponent: () =>
      import('./stock/incoming-dpms/incoming-dpms.component').then(m => m.IncomingDpmsComponent),
    data: { titleKey: 'nav.incomingDpms' }
  },
  {
    path: 'stock/distribute',
    loadComponent: () =>
      import('./stock/distribute/distribute.component').then(m => m.DistributeComponent),
    data: { titleKey: 'nav.distributeToTech' }
  },
  {
    path: 'stock/usage-approvals',
    loadComponent: () =>
      import('./stock/usage-approvals/stt-usage-approvals.component').then(m => m.SttUsageApprovalsComponent),
    data: { titleKey: 'nav.usageApprovals' }
  },
  {
    path: 'stock/returns',
    loadComponent: () =>
      import('./stock/returns/stt-material-returns.component').then(m => m.SttMaterialReturnsComponent),
    data: { titleKey: 'nav.materialReturns' }
  },
  {
    path: 'stock/retrieved-collection',
    loadComponent: () =>
      import('./stock/retrieved-collection/stt-retrieved-collection.component').then(m => m.SttRetrievedCollectionComponent),
    data: { titleKey: 'nav.retrievedStockCollection' }
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];
