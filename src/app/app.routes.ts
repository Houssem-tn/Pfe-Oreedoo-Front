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
    data: { titleKey: 'routes.loginPage' },
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./views/pages/register/register.component').then((m) => m.RegisterComponent),
    data: { titleKey: 'routes.registerPage' },
  },
  {
    path: 'register-tech',
    loadComponent: () =>
      import('./views/pages/register-tech-invitation/register-tech-invitation.component')
        .then((m) => m.RegisterTechInvitationComponent),
    data: { titleKey: 'routes.technicianInvitationRegistration' },
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./views/pages/forgot-password/forgot-password.component')
        .then((m) => m.ForgotPasswordComponent),
    data: { titleKey: 'routes.forgotPassword' },
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./views/pages/reset-password/reset-password.component')
        .then((m) => m.ResetPasswordComponent),
    data: { titleKey: 'routes.resetPassword' },
  },
  {
    path: '404',
    loadComponent: () =>
      import('./views/pages/page404/page404.component').then((m) => m.Page404Component),
    data: { titleKey: 'routes.page404' },
  },
  {
    path: '500',
    loadComponent: () =>
      import('./views/pages/page500/page500.component').then((m) => m.Page500Component),
    data: { titleKey: 'routes.page500' },
  },

  {
    path: 'tech',
    canActivate: [authGuard, approvedGuard],
    canActivateChild: [roleChildGuard],
    data: { roles: ['ROLE_TECH'], titleKey: 'routes.fieldTech' },
    loadChildren: () => import('./views/field/routes').then((m) => m.routes),
  },
  {
    path: 'stt/cases/execution',
    canActivate: [authGuard, approvedGuard],
    canActivateChild: [roleChildGuard],
    data: { roles: ['ROLE_STT'], titleKey: 'routes.fieldSttExecution' },
    loadChildren: () => import('./views/field/routes').then((m) => m.routes),
  },

  {
    path: '',
    loadComponent: () => import('./layout').then((m) => m.DefaultLayoutComponent),
    data: { titleKey: 'routes.home' },
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
        data: { titleKey: 'routes.alertCenter' }
      },

      {
        path: 'profile',
        loadComponent: () =>
          import('./views/profile/profile.component').then(m => m.ProfileComponent),
        data: { titleKey: 'routes.myProfile' }
      },

      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
