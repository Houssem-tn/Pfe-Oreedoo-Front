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
      import('../dashboard/dashboard.component').then(m => m.DashboardComponent)
  },

  {
    path: 'users',
    loadComponent: () =>
      import('./users/users-list.component').then(m => m.UsersListComponent)
  },
  {
    path: 'users/new',
    loadComponent: () =>
      import('../pages/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'users/:id',
    loadComponent: () =>
      import('../pages/register/register.component').then(m => m.RegisterComponent)
  },

  {
    path: 'approvals',
    loadComponent: () =>
      import('./approvals/approvals.component').then(m => m.ApprovalsComponent)
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
    path: 'saved-zm-performance',
    loadComponent: () =>
      import('./saved-zm-performance/saved-zm-performance.component').then(m => m.SavedZmPerformanceComponent)
  },
  {
    path: 'act-analysis',
    loadComponent: () =>
      import('../dashboard/activation-analysis.component').then(m => m.ActivationAnalysisComponent)
  },

  // Audit home
  {
    path: 'audits',
    loadComponent: () =>
      import('./audits/audits.component').then(m => m.AuditsComponent)
  },

  // Users auditing
  {
    path: 'audits/users',
    loadComponent: () =>
      import('./audits/users-audit/users-audit.component').then(m => m.UsersAuditComponent)
  },

  // Stock auditing
  {
    path: 'audits/stock',
    loadComponent: () =>
      import('./audits/stock-audit/stock-audit.component').then(m => m.StockAuditComponent)
  },

  // Interventions auditing
  {
    path: 'audits/interventions',
    loadComponent: () =>
      import('./audits/interventions-audit/interventions-audit.component').then(m => m.InterventionsAuditComponent)
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
    data: { title: 'Equipment' }
  },
  {
    path: 'stock/tracking',
    loadComponent: () =>
      import('./stock/tracking/admin-stock-tracking.component').then(m => m.AdminStockTrackingComponent),
    data: { title: 'Stock Tracking' }
  },
  {
    path: 'stock/team-distributions',
    loadComponent: () =>
      import('../shared/team-distributions/team-distributions.component').then(m => m.TeamDistributionsComponent),
    data: { title: 'Team Distributions' }
  },

  {
    path: 'network-coverage',
    loadComponent: () =>
      import('../zm/network-coverage/network-coverage.component').then(m => m.NetworkCoverageComponent),
    data: { title: 'Network Coverage Intelligence' }
  },

  { path: '', redirectTo: 'users', pathMatch: 'full' }
];
