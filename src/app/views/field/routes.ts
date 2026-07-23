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
          import('./field-home.component').then((m) => m.FieldHomeComponent),
        data: { titleKey: 'field.home' }
      },
      {
        path: 'dashboard',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./field-tasks.component').then((m) => m.FieldTasksComponent),
        data: { titleKey: 'field.tasks' }
      },
      {
        path: 'cases/activation',
        loadComponent: () =>
          import('./field-tasks.component').then((m) => m.FieldTasksComponent),
        data: { caseType: 'ACTIVATION', titleKey: 'nav.activationCases' }
      },
      {
        path: 'cases/complaint',
        loadComponent: () =>
          import('./field-tasks.component').then((m) => m.FieldTasksComponent),
        data: { caseType: 'PLAINTE', titleKey: 'nav.complaintCases' }
      },
      {
        path: 'tasks/:id/execution',
        loadComponent: () =>
          import('./field-execution.component').then((m) => m.FieldExecutionComponent),
        data: { titleKey: 'field.execution' }
      },
      {
        path: 'tasks/:id',
        loadComponent: () =>
          import('./field-case-detail.component').then((m) => m.FieldCaseDetailComponent),
        data: { titleKey: 'common.details' }
      },
      {
        path: 'stock/my-stock',
        loadComponent: () =>
          import('../tech/stock/my-stock/tech-my-stock.component').then((m) => m.TechMyStockComponent),
        data: { titleKey: 'nav.myStock' }
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./field-history.component').then((m) => m.FieldHistoryComponent),
        data: { titleKey: 'field.history' }
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./field-profile.component').then((m) => m.FieldProfileComponent),
        data: { titleKey: 'field.profile' }
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];
