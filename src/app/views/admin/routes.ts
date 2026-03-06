import { Routes } from '@angular/router';

export const routes: Routes = [

  // ✅ Admin dashboard (optional)
  {
    path: 'dashboard',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // ✅ User management
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

  // ✅ NEW: Approval management page
  {
    path: 'approvals',
    loadComponent: () =>
      import('./approvals/approvals.component').then(m => m.ApprovalsComponent)
  },

  { path: '', redirectTo: 'users', pathMatch: 'full' }
];