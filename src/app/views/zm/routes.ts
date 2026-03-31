import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./zm-dashboard.component').then(m => m.ZmDashboardComponent)
  },
  {
    path: 'cases/activation',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent)
  },
  {
    path: 'cases/activation/new',
    loadComponent: () =>
      import('../cases/create-activation-case.component').then(m => m.CreateActivationCaseComponent)
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
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
  path: 'my-team',
  loadComponent: () =>
    import('./my-team/my-team.component').then(m => m.MyTeamComponent),
  data: { title: 'My Team' }
}
];