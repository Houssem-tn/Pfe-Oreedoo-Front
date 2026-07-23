import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  GutterDirective,
  RowComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';

import { AuthStore } from '../../core/auth/auth.store';
import { ActivationImportWorkspaceComponent } from './activation-import-workspace.component';
import { ComplaintImportWorkspaceComponent } from './complaint-import-workspace.component';
import { MergedImportWorkspaceComponent } from './merged-import-workspace.component';
import { TodoImportWorkspaceComponent } from './todo-import-workspace.component';

type ImportContext = 'todos' | 'activation' | 'complaint' | 'merged';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  providers: [provideTranslocoScope('dashboard')],
  imports: [
    CommonModule,
    CardComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    GutterDirective,
    ButtonDirective,
    IconDirective,
    TranslocoModule,
    TodoImportWorkspaceComponent,
    ActivationImportWorkspaceComponent,
    ComplaintImportWorkspaceComponent,
    MergedImportWorkspaceComponent
  ]
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);

  selectedImportType: ImportContext = 'todos';

  ngOnInit(): void {
    if (!this.isAdmin) {
      this.redirectToRoleDashboard();
    }
  }

  get isAdmin(): boolean {
    return this.authStore.role() === 'ROLE_ADMIN';
  }

  get importTypeLabel(): string {
    return this.transloco.translate(`dashboard.shell.importTypeLabel.${this.selectedImportType}`);
  }

  selectImportType(type: ImportContext): void {
    this.selectedImportType = type;
  }

  isSelected(type: ImportContext): boolean {
    return this.selectedImportType === type;
  }

  private redirectToRoleDashboard(): void {
    const role = this.authStore.role();
    switch (role) {
      case 'ROLE_ZM':
        this.router.navigateByUrl('/zm/dashboard');
        break;
      case 'ROLE_STT':
        this.router.navigateByUrl('/stt/dashboard');
        break;
      case 'ROLE_TECH':
        this.router.navigateByUrl('/tech/dashboard');
        break;
      default:
        break;
    }
  }
}
