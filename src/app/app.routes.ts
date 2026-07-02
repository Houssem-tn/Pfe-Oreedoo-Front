import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { approvedGuard } from './core/auth/guards/approved.guard';
import { roleChildGuard } from './core/auth/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./views/pages/login/login.component').then((m) => m.LoginComponent),
    data: { title: 'Login Page' },
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./views/pages/register/register.component').then((m) => m.RegisterComponent),
    data: { title: 'Register Page' },
  },
  {
    path: 'register-tech',
    loadComponent: () =>
      import('./views/pages/register-tech-invitation/register-tech-invitation.component')
        .then((m) => m.RegisterTechInvitationComponent),
    data: { title: 'Technician Invitation Registration' },
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

  {
    path: 'tech',
    canActivate: [authGuard, approvedGuard],
    canActivateChild: [roleChildGuard],
    data: { roles: ['ROLE_TECH'], title: 'Field TECH' },
    loadChildren: () => import('./views/field/routes').then((m) => m.routes),
  },
  {
    path: 'stt/cases/execution',
    canActivate: [authGuard, approvedGuard],
    canActivateChild: [roleChildGuard],
    data: { roles: ['ROLE_STT'], title: 'Field STT Execution' },
    loadChildren: () => import('./views/field/routes').then((m) => m.routes),
  },

  {
    path: '',
    loadComponent: () => import('./layout').then((m) => m.DefaultLayoutComponent),
    data: { title: 'Home' },
    canActivate: [authGuard, approvedGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes),
      },
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
        path: 'zm',
        canActivateChild: [roleChildGuard],
        data: { roles: ['ROLE_ZM'] },
        loadChildren: () => import('./views/zm/routes').then((m) => m.routes),
      },

      {
        path: 'alerts',
        loadComponent: () =>
          import('./views/alerts/alert-center-page.component').then(m => m.AlertCenterPageComponent),
        data: { title: 'Alert Center' }
      },

      {
        path: 'profile',
        loadComponent: () =>
          import('./views/profile/profile.component').then(m => m.ProfileComponent),
        data: { title: 'My Profile' }
      },

      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
