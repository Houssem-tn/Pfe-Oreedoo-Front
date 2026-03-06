import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { approvedGuard } from './core/auth/guards/approved.guard';
import { roleChildGuard } from './core/auth/guards/role.guard';

export const routes: Routes = [
  // ✅ Start at login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // ✅ Public pages (outside layout)
  {
    path: 'login',
    loadComponent: () =>
      import('./views/pages/login/login.component').then((m) => m.LoginComponent),
    data: { title: 'Login Page' },
  },

  // ✅ Keep register PUBLIC only if you want that behavior.
  // If register must be admin-only, REMOVE this route and expose it under /admin.
  {
    path: 'register',
    loadComponent: () =>
      import('./views/pages/register/register.component').then((m) => m.RegisterComponent),
    data: { title: 'Register Page' },
  },

  {
    path: '404',
    loadComponent: () =>
      import('./views/pages/page404/page404.component').then((m) => m.Page404Component),
    data: { title: 'Page 404' },
  },
  {
    path: '500',
    loadComponent: () =>
      import('./views/pages/page500/page500.component').then((m) => m.Page500Component),
    data: { title: 'Page 500' },
  },

  // ✅ Main app shell (CoreUI layout) — PROTECTED
  {
    path: '',
    loadComponent: () => import('./layout').then((m) => m.DefaultLayoutComponent),
    data: { title: 'Home' },
    canActivate: [authGuard, approvedGuard],
    children: [
      { path: 'dashboard', loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes) },

      // ✅ role areas (protect all children of each module)
      {
        path: 'admin',
        canActivateChild: [roleChildGuard],
        data: { roles: ['ROLE_ADMIN'] },
        loadChildren: () => import('./views/admin/routes').then((m) => m.routes),
      },
      {
        path: 'stt',
        canActivateChild: [roleChildGuard],
        data: { roles: ['ROLE_STT'] },
        loadChildren: () => import('./views/stt/routes').then((m) => m.routes),
      },
      {
        path: 'tech',
        canActivateChild: [roleChildGuard],
        data: { roles: ['ROLE_TECHNICIEN_STT'] },
        loadChildren: () => import('./views/tech/routes').then((m) => m.routes),
      },
      {
        path: 'zm',
        canActivateChild: [roleChildGuard],
        data: { roles: ['ROLE_ZM'] },
        loadChildren: () => import('./views/zm/routes').then((m) => m.routes),
      },

      // ✅ fallback inside layout
      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  // ✅ global fallback
  { path: '**', redirectTo: 'login' },
];