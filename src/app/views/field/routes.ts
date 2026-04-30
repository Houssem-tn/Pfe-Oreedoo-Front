import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../layout/field-layout').then((m) => m.FieldLayoutComponent),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./field-home.component').then((m) => m.FieldHomeComponent)
      },
      {
        path: 'dashboard',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./field-tasks.component').then((m) => m.FieldTasksComponent)
      },
      {
        path: 'cases/activation',
        loadComponent: () =>
          import('./field-tasks.component').then((m) => m.FieldTasksComponent),
        data: { caseType: 'ACTIVATION' }
      },
      {
        path: 'cases/complaint',
        loadComponent: () =>
          import('./field-tasks.component').then((m) => m.FieldTasksComponent),
        data: { caseType: 'PLAINTE' }
      },
      {
        path: 'tasks/:id/execution',
        loadComponent: () =>
          import('./field-execution.component').then((m) => m.FieldExecutionComponent)
      },
      {
        path: 'tasks/:id',
        loadComponent: () =>
          import('./field-case-detail.component').then((m) => m.FieldCaseDetailComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./field-history.component').then((m) => m.FieldHistoryComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./field-profile.component').then((m) => m.FieldProfileComponent)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];
