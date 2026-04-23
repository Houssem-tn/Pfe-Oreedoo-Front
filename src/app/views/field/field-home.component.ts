import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import { CaseResponse } from '../../core/cases/models/case.model';
import { FieldCaseCardComponent } from './components/field-case-card.component';
import { FieldEmptyStateComponent } from './components/field-empty-state.component';
import { FieldSummaryCardComponent } from './components/field-summary-card.component';
import {
  fieldBasePathFromUrl,
  fieldCompletedAt,
  filterFieldCases,
  isActiveFieldStatus,
  sameLocalDay
} from './field-case-utils';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconDirective,
    FieldSummaryCardComponent,
    FieldCaseCardComponent,
    FieldEmptyStateComponent
  ],
  template: `
    <section class="field-page">
      <div class="field-page__header">
        <div class="field-page__eyebrow">{{ todayLabel }}</div>
        <h1 class="field-page__title">Hello {{ displayName }}</h1>
        <p class="field-page__subtitle">{{ activeCases.length }} active field cases are assigned to this device workspace.</p>
      </div>

      <div class="field-summary-grid">
        <app-field-summary-card label="Active cases" [value]="activeCases.length" icon="cilTask" />
        <app-field-summary-card label="Completed today" [value]="completedToday" icon="cilCheckCircle" tone="success" />
        <app-field-summary-card label="Pending tasks" [value]="pendingTasks" icon="cilClock" tone="warning" />
      </div>

      <div *ngIf="loading" class="field-loading">
        <span class="field-spinner"></span>
        Loading field home
      </div>

      <div *ngIf="error" class="field-banner field-banner--danger">{{ error }}</div>

      <ng-container *ngIf="!loading && !error">
        <section class="field-card">
          <div class="field-section-title">
            <h2>Next tasks</h2>
            <a class="field-button field-button--ghost" [routerLink]="basePath + '/tasks'">
              <svg cIcon name="cilList"></svg>
              View all
            </a>
          </div>

          <div class="field-case-list" *ngIf="nextTasks.length > 0; else noTasks">
            <app-field-case-card
              *ngFor="let item of nextTasks; trackBy: trackByCase"
              [item]="item"
              [basePath]="basePath"
            />
          </div>

          <ng-template #noTasks>
            <app-field-empty-state
              title="No active task"
              message="Completed cases will stay in History."
              icon="cilCheckCircle"
              [actionLink]="basePath + '/history'"
              actionLabel="Open history"
            />
          </ng-template>
        </section>
      </ng-container>
    </section>
  `
})
export class FieldHomeComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly casesService = inject(CasesService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  loading = false;
  error: string | null = null;
  cases: CaseResponse[] = [];

  ngOnInit(): void {
    this.loadCases();
  }

  get basePath(): string {
    return fieldBasePathFromUrl(this.router.url);
  }

  get displayName(): string {
    const user = this.authStore.user();
    return user?.fullName?.trim() || user?.username?.trim() || user?.email?.split('@')[0] || 'there';
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(new Date());
  }

  get assignedCases(): CaseResponse[] {
    return filterFieldCases(this.cases, this.currentUserEmail, this.authStore.role());
  }

  get activeCases(): CaseResponse[] {
    return this.assignedCases.filter((item) => isActiveFieldStatus(item.status));
  }

  get completedToday(): number {
    return this.assignedCases.filter((item) => sameLocalDay(fieldCompletedAt(item))).length;
  }

  get pendingTasks(): number {
    return this.activeCases.filter((item) => item.status !== 'NOT_REACHABLE').length;
  }

  get nextTasks(): CaseResponse[] {
    return [...this.activeCases]
      .sort((left, right) => this.caseSortValue(left) - this.caseSortValue(right))
      .slice(0, 4);
  }

  refresh(): void {
    this.loadCases();
  }

  trackByCase = (_index: number, item: CaseResponse): string => item.id;

  private loadCases(): void {
    this.loading = true;
    this.error = null;

    this.casesService.getActivationCases()
      .pipe(finalize(() => {
        this.loading = false;
        this.render();
      }))
      .subscribe({
        next: (rows) => {
          this.cases = rows ?? [];
        },
        error: (err) => {
          console.error('Failed to load field home cases', err);
          this.error = err?.error?.message ?? 'Unable to load your field cases.';
          this.cases = [];
        }
      });
  }

  private caseSortValue(item: CaseResponse): number {
    const deadline = item.slaTracking?.remainingSeconds;
    if (deadline != null) {
      return deadline;
    }

    return Date.parse(item.updatedAt ?? item.createdAt ?? '') || Number.MAX_SAFE_INTEGER;
  }

  private get currentUserEmail(): string {
    return (this.authStore.user()?.email ?? '').trim().toLowerCase();
  }

  private render(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
