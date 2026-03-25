import { Routes } from '@angular/router';

export const routes: Routes = [

  {
    path: 'dashboard',
    redirectTo: '/dashboard',
    pathMatch: 'full'
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
      import('../cases/activation-cases-list.component').then(m => m.ActivationCasesListComponent)
  },
  {
    path: 'cases/activation/new',
    loadComponent: () =>
      import('../cases/create-activation-case.component').then(m => m.CreateActivationCaseComponent)
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

  { path: '', redirectTo: 'users', pathMatch: 'full' }
];