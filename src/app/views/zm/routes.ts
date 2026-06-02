import { Routes } from '@angular/router';
import { canCreateDpmGuard } from '../../core/auth/guards/can-create-dpm.guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./zm-dashboard.component').then(m => m.ZmDashboardComponent)
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
  {
    path: 'inject-todos',
    loadComponent: () =>
      import('./inject-todos/inject-todos.component').then(m => m.InjectTodosComponent),
    data: { title: 'Inject Todos' }
  },
  {
    path: 'todos-analysis',
    loadComponent: () =>
      import('./todos-analysis/todos-analysis.component').then(m => m.TodosAnalysisComponent),
    data: { title: 'Todos Analysis' }
  },
  {
    path: 'imported-todos',
    loadComponent: () =>
      import('./imported-todos/imported-todos.component').then(m => m.ImportedTodosComponent),
    data: { title: 'Imported Todos' }
  },
  // Stock Management
  {
    path: 'stock',
    redirectTo: 'stock/team-stock',
    pathMatch: 'full'
  },
  {
    path: 'stock/create-dpm',
    canActivate: [canCreateDpmGuard],
    loadComponent: () =>
      import('./stock/create-dpm/create-dpm.component').then(m => m.CreateDpmComponent),
    data: { title: 'Create DPM' }
  },
  {
    path: 'stock/my-tracking',
    canActivate: [canCreateDpmGuard],
    loadComponent: () =>
      import('./stock/my-tracking/zm-stock-tracking.component').then(m => m.ZmStockTrackingComponent),
    data: { title: 'My DPM Tracking' }
  },
  {
    path: 'stock/team-stock',
    loadComponent: () =>
      import('./stock/team-stock/zm-team-stock.component').then(m => m.ZmTeamStockComponent),
    data: { title: 'Team Stock Overview' }
  },
  {
    path: 'stock/case-audit',
    loadComponent: () =>
      import('./stock/case-audit/zm-case-audit.component').then(m => m.ZmCaseAuditComponent),
    data: { title: 'Case Stock Audit' }
  },
  {
    path: 'stock/thresholds',
    canActivate: [canCreateDpmGuard],
    loadComponent: () =>
      import('./stock/thresholds/zm-stock-thresholds.component').then(m => m.ZmStockThresholdsComponent),
    data: { title: 'Stock Alert Thresholds' }
  },
  {
    path: 'stock/returns',
    loadComponent: () =>
      import('./stock/returns/zm-material-returns.component').then(m => m.ZmMaterialReturnsComponent),
    data: { title: 'Material Returns Review' }
  },

  {
    path: 'network-coverage',
    loadComponent: () =>
      import('./network-coverage/network-coverage.component').then(m => m.NetworkCoverageComponent),
    data: { title: 'Network Coverage Intelligence' }
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
  path: 'my-team',
  loadComponent: () =>
    import('./my-team/my-team.component').then(m => m.MyTeamComponent),
  data: { title: 'My Team' }
}
];
