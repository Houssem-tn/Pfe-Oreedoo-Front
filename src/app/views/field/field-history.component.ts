import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import { CaseResponse } from '../../core/cases/models/case.model';
import { FieldCaseCardComponent } from './components/field-case-card.component';
import { FieldEmptyStateComponent } from './components/field-empty-state.component';
import {
  fieldBasePathFromUrl,
  fieldCompletedAt,
  filterFieldCases,
  isCompletedFieldStatus
} from './field-case-utils';

@Component({
  standalone: true,
  imports: [CommonModule, FieldCaseCardComponent, FieldEmptyStateComponent],
  template: `
    <section class="field-page">
      <div class="field-page__header">
        <div class="field-page__eyebrow">History</div>
        <h1 class="field-page__title">Completed work</h1>
        <p class="field-page__subtitle">{{ completedCases.length }} completed interventions are available for review.</p>
      </div>

      <div *ngIf="loading" class="field-loading">
        <span class="field-spinner"></span>
        Loading history
      </div>

      <div *ngIf="error" class="field-banner field-banner--danger">{{ error }}</div>

      <section class="field-case-list" *ngIf="!loading && !error && completedCases.length > 0">
        <app-field-case-card
          *ngFor="let item of completedCases; trackBy: trackByCase"
          [item]="item"
          [basePath]="basePath"
        />
      </section>

      <app-field-empty-state
        *ngIf="!loading && !error && completedCases.length === 0"
        title="No completed cases yet"
        message="Finished interventions will appear here."
        icon="cilClock"
      />
    </section>
  `
})
export class FieldHistoryComponent implements OnInit {
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

  get completedCases(): CaseResponse[] {
    return filterFieldCases(this.cases, this.currentUserEmail, this.authStore.role())
      .filter((item) => isCompletedFieldStatus(item.status))
      .sort((left, right) => this.toEpoch(fieldCompletedAt(right)) - this.toEpoch(fieldCompletedAt(left)));
  }

  trackByCase = (_index: number, item: CaseResponse): string => item.id;

  private loadCases(): void {
    this.loading = true;
    this.error = null;

    this.casesService.getOperationalCases()
      .pipe(finalize(() => {
        this.loading = false;
        this.render();
      }))
      .subscribe({
        next: (rows) => {
          this.cases = rows ?? [];
        },
        error: (err) => {
          console.error('Failed to load field history', err);
          this.error = err?.error?.message ?? 'Unable to load field history.';
          this.cases = [];
        }
      });
  }

  private toEpoch(value: string | null): number {
    if (!value) {
      return 0;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private get currentUserEmail(): string {
    return (this.authStore.user()?.email ?? '').trim().toLowerCase();
  }

  private render(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
