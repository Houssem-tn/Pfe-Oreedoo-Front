import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import { PerformanceSummaryResponse } from '../../core/cases/models/case.model';
import { FieldSummaryCardComponent } from './components/field-summary-card.component';
import { humanizeFieldValue } from './field-case-utils';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective, FieldSummaryCardComponent],
  template: `
    <section class="field-page">
      <div class="field-page__header">
        <div class="field-page__eyebrow">Profile</div>
        <h1 class="field-page__title">{{ displayName }}</h1>
        <p class="field-page__subtitle">{{ email }}</p>
      </div>

      <section class="field-card">
        <div class="field-detail-grid">
          <div class="field-fact">
            <span>Role</span>
            <strong>{{ roleLabel }}</strong>
          </div>
          <div class="field-fact">
            <span>Status</span>
            <strong>{{ statusLabel }}</strong>
          </div>
          <div class="field-fact">
            <span>Workspace</span>
            <strong>{{ workspaceLabel }}</strong>
          </div>
        </div>
      </section>

      <div *ngIf="loading" class="field-loading">
        <span class="field-spinner"></span>
        Loading metrics
      </div>

      <div *ngIf="error" class="field-banner field-banner--warning">{{ error }}</div>

      <div class="field-summary-grid">
        <app-field-summary-card label="Assigned" [value]="performance?.assignedCases ?? '-'" icon="cilTask" />
        <app-field-summary-card label="Active" [value]="performance?.activeTasksCount ?? '-'" icon="cilClock" tone="warning" />
        <app-field-summary-card label="Completed" [value]="performance?.completedCasesCount ?? '-'" icon="cilCheckCircle" tone="success" />
      </div>

      <section class="field-card">
        <div class="field-section-title">
          <h2>Completion</h2>
          <span>{{ completionLabel }}</span>
        </div>
        <div class="field-button-row">
          <a class="field-button field-button--primary" routerLink="../tasks">
            <svg cIcon name="cilTask"></svg>
            Open tasks
          </a>
          <button class="field-button field-button--ghost" type="button" (click)="loadPerformance()" [disabled]="loading">
            <svg cIcon name="cilReload"></svg>
            Refresh
          </button>
        </div>
      </section>
    </section>
  `
})
export class FieldProfileComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly casesService = inject(CasesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  loading = false;
  error: string | null = null;
  performance: PerformanceSummaryResponse | null = null;

  ngOnInit(): void {
    this.loadPerformance();
  }

  get displayName(): string {
    return this.authStore.user()?.fullName
      || this.authStore.user()?.username
      || this.authStore.user()?.email?.split('@')[0]
      || 'Field user';
  }

  get email(): string {
    return this.authStore.user()?.email ?? '-';
  }

  get roleLabel(): string {
    return humanizeFieldValue(this.authStore.role());
  }

  get statusLabel(): string {
    return humanizeFieldValue(this.authStore.status());
  }

  get workspaceLabel(): string {
    return this.authStore.role() === 'ROLE_STT' ? 'STT self execution' : 'TECH execution';
  }

  get completionLabel(): string {
    if (!this.performance) {
      return '-';
    }

    return `${Math.round(this.performance.workCompletionProgress)}%`;
  }

  loadPerformance(): void {
    this.loading = true;
    this.error = null;

    this.casesService.getMyPerformance()
      .pipe(finalize(() => {
        this.loading = false;
        this.render();
      }))
      .subscribe({
        next: (summary) => {
          this.performance = summary;
        },
        error: (err) => {
          console.error('Failed to load field profile performance', err);
          this.error = err?.error?.message ?? 'Metrics are unavailable right now.';
          this.performance = null;
        }
      });
  }

  private render(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
