import { Routes } from '@angular/router';

export const routes: Routes = [

  {
    path: 'dashboard',
    redirectTo: 'import-todos',
    pathMatch: 'full'
  },

  {
    path: 'import-todos',
    loadComponent: () =>
      import('../dashboard/dashboard.component').then(m => m.DashboardComponent),
    data: { titleKey: 'nav.importAnalytics' }
  },

  {
    path: 'users',
    loadComponent: () =>
      import('./users/users-list.component').then(m => m.UsersListComponent),
    data: { titleKey: 'nav.users' }
  },
  {
    path: 'users/new',
    loadComponent: () =>
      import('../pages/register/register.component').then(m => m.RegisterComponent),
    data: { titleKey: 'admin.users.create' }
  },
  {
    path: 'users/:id',
    loadComponent: () =>
      import('../pages/register/register.component').then(m => m.RegisterComponent),
    data: { titleKey: 'admin.users.edit' }
  },

  {
    path: 'approvals',
    loadComponent: () =>
      import('./approvals/approvals.component').then(m => m.ApprovalsComponent),
    data: { titleKey: 'nav.approvals' }
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
    path: 'saved-zm-performance',
    loadComponent: () =>
      import('./saved-zm-performance/saved-zm-performance.component').then(m => m.SavedZmPerformanceComponent),
    data: { titleKey: 'admin.savedZmPerformance.title' }
  },
  {
    path: 'act-analysis',
    loadComponent: () =>
      import('../dashboard/activation-analysis.component').then(m => m.ActivationAnalysisComponent),
    data: { titleKey: 'nav.actAnalysis' }
  },

  // Audit home
  {
    path: 'audits',
    loadComponent: () =>
      import('./audits/audits.component').then(m => m.AuditsComponent),
    data: { titleKey: 'nav.audit' }
  },

  // Users auditing
  {
    path: 'audits/users',
    loadComponent: () =>
      import('./audits/users-audit/users-audit.component').then(m => m.UsersAuditComponent),
    data: { titleKey: 'admin.audit.users' }
  },

  // Stock auditing
  {
    path: 'audits/stock',
    loadComponent: () =>
      import('./audits/stock-audit/stock-audit.component').then(m => m.StockAuditComponent),
    data: { titleKey: 'admin.audit.stock' }
  },

  // Interventions auditing
  {
    path: 'audits/interventions',
    loadComponent: () =>
      import('./audits/interventions-audit/interventions-audit.component').then(m => m.InterventionsAuditComponent),
    data: { titleKey: 'admin.audit.interventions' }
  },

  // Stock Management
  {
    path: 'stock',
    redirectTo: 'stock/equipment',
    pathMatch: 'full'
  },
  {
    path: 'stock/equipment',
    loadComponent: () =>
      import('./stock/equipment/equipment.component').then(m => m.EquipmentComponent),
    data: { titleKey: 'nav.equipment' }
  },
  {
    path: 'stock/tracking',
    loadComponent: () =>
      import('./stock/tracking/admin-stock-tracking.component').then(m => m.AdminStockTrackingComponent),
    data: { titleKey: 'nav.stockTracking' }
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
    path: 'network-coverage',
    loadComponent: () =>
      import('../zm/network-coverage/network-coverage.component').then(m => m.NetworkCoverageComponent),
    data: { titleKey: 'nav.networkCoverage' }
  },

  { path: '', redirectTo: 'users', pathMatch: 'full' }
];
