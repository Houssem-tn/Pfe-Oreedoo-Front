import { Routes } from '@angular/router';
import { canCreateDpmGuard } from '../../core/auth/guards/can-create-dpm.guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./zm-dashboard.component').then(m => m.ZmDashboardComponent),
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
    path: 'cases/resiliation',
    loadComponent: () =>
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent),
    data: { caseType: 'PLAINTE', caseModule: 'RES', titleKey: 'nav.resiliationCases' }
  },
  {
    path: 'cases/activation/new',
    loadComponent: () =>
      import('../cases/create-activation-case.component').then(m => m.CreateActivationCaseComponent),
    data: { titleKey: 'cases.createActivation.title' }
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('../admin/approvals/approvals.component').then(m => m.ApprovalsComponent),
    data: { titleKey: 'nav.approvals' }
  },
  {
    path: 'technician-approvals',
    loadComponent: () =>
      import('./technician-approvals/technician-approvals.component').then(m => m.TechnicianApprovalsComponent),
    data: { titleKey: 'nav.technicianApprovals' }
  },
  {
    path: 'inject-todos',
    loadComponent: () =>
      import('./inject-todos/inject-todos.component').then(m => m.InjectTodosComponent),
    data: { titleKey: 'nav.injectTodos' }
  },
  {
    path: 'todos-analysis',
    loadComponent: () =>
      import('./todos-analysis/todos-analysis.component').then(m => m.TodosAnalysisComponent),
    data: { titleKey: 'nav.todosAnalysis' }
  },
  {
    path: 'imported-todos',
    loadComponent: () =>
      import('./imported-todos/imported-todos.component').then(m => m.ImportedTodosComponent),
    data: { titleKey: 'nav.importedTodos' }
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
    data: { titleKey: 'nav.createDpm' }
  },
  {
    path: 'stock/my-tracking',
    canActivate: [canCreateDpmGuard],
    loadComponent: () =>
      import('./stock/my-tracking/zm-stock-tracking.component').then(m => m.ZmStockTrackingComponent),
    data: { titleKey: 'nav.myDpms' }
  },
  {
    path: 'stock/team-stock',
    loadComponent: () =>
      import('./stock/team-stock/zm-team-stock.component').then(m => m.ZmTeamStockComponent),
    data: { titleKey: 'nav.teamStock' }
  },
  {
    path: 'stock/case-audit',
    loadComponent: () =>
      import('./stock/case-audit/zm-case-audit.component').then(m => m.ZmCaseAuditComponent),
    data: { titleKey: 'nav.caseStockAudit' }
  },
  {
    path: 'stock/team-distributions',
    loadComponent: () =>
      import('../shared/team-distributions/team-distributions.component').then(m => m.TeamDistributionsComponent),
    data: { titleKey: 'nav.teamDistributions' }
  },
  {
    path: 'stock/unit-tracking',
    loadComponent: () =>
      import('../shared/unit-tracking/unit-tracking.component').then(m => m.UnitTrackingComponent),
    data: { titleKey: 'nav.unitTracking' }
  },
  {
    path: 'stock/thresholds',
    canActivate: [canCreateDpmGuard],
    loadComponent: () =>
      import('./stock/thresholds/zm-stock-thresholds.component').then(m => m.ZmStockThresholdsComponent),
    data: { titleKey: 'nav.stockThresholds' }
  },
  {
    path: 'stock/returns',
    loadComponent: () =>
      import('./stock/returns/zm-material-returns.component').then(m => m.ZmMaterialReturnsComponent),
    data: { titleKey: 'nav.materialReturns' }
  },
  {
    // Read-only tracking (the collection action moved to the STT).
    path: 'stock/retrieved-tracking',
    loadComponent: () =>
      import('./stock/retrieved-collection/zm-retrieved-collection.component').then(m => m.ZmRetrievedCollectionComponent),
    data: { titleKey: 'nav.retrievedStockTracking' }
  },
  // Back-compat redirect for the old ZM collection URL.
  { path: 'stock/retrieved-collection', redirectTo: 'stock/retrieved-tracking', pathMatch: 'full' },

  {
    path: 'network-coverage',
    loadComponent: () =>
      import('./network-coverage/network-coverage.component').then(m => m.NetworkCoverageComponent),
    data: { titleKey: 'nav.networkCoverage' }
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
  path: 'my-team',
  loadComponent: () =>
    import('./my-team/my-team.component').then(m => m.MyTeamComponent),
  data: { titleKey: 'nav.myTeam' }
}
];
