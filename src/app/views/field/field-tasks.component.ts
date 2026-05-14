import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import { CaseResponse, CaseType } from '../../core/cases/models/case.model';
import { FieldCaseCardComponent } from './components/field-case-card.component';
import { FieldEmptyStateComponent } from './components/field-empty-state.component';
import {
  fieldBasePathFromUrl,
  fieldCaseLocation,
  fieldCaseOffer,
  filterFieldCases,
  isActiveFieldStatus,
  isCompletedFieldStatus
} from './field-case-utils';

type FieldTaskFilter = 'active' | 'ready' | 'completed' | 'all';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, FieldCaseCardComponent, FieldEmptyStateComponent],
  template: `
    <section class="field-page">
      <div class="field-page__header">
        <div class="field-page__eyebrow">Tasks</div>
        <h1 class="field-page__title">{{ pageTitle }}</h1>
        <p class="field-page__subtitle">{{ pageSubtitle }}</p>
      </div>

      <section class="field-card field-toolbar">
        <input
          class="field-search"
          type="search"
          placeholder="Search client, CRM, phone, location"
          [(ngModel)]="searchTerm"
        />

        <select class="field-select" [(ngModel)]="filter">
          <option value="active">Active</option>
          <option value="ready">Ready for work</option>
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
      </section>

      <div *ngIf="loading" class="field-loading">
        <span class="field-spinner"></span>
        Loading tasks
      </div>

      <div *ngIf="error" class="field-banner field-banner--danger">{{ error }}</div>

      <section class="field-case-list" *ngIf="!loading && !error && visibleCases.length > 0">
        <app-field-case-card
          *ngFor="let item of visibleCases; trackBy: trackByCase"
          [item]="item"
          [basePath]="basePath"
        />
      </section>

      <app-field-empty-state
        *ngIf="!loading && !error && visibleCases.length === 0"
        title="No matching task"
        message="No results in the current view."
        icon="cilSearch"
      />
    </section>
  `
})
export class FieldTasksComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly casesService = inject(CasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  loading = false;
  error: string | null = null;
  cases: CaseResponse[] = [];
  searchTerm = '';
  filter: FieldTaskFilter = 'active';

  ngOnInit(): void {
    this.loadCases();
  }

  get basePath(): string {
    return fieldBasePathFromUrl(this.router.url);
  }

  get caseType(): CaseType | null {
    return this.resolveCaseTypeFromRoute();
  }

  get isComplaintRoute(): boolean {
    return this.caseType === 'PLAINTE';
  }

  get pageTitle(): string {
    if (this.caseType === 'ACTIVATION') {
      return 'Assigned activation cases';
    }

    if (this.caseType === 'PLAINTE') {
      return 'Assigned complaint cases';
    }

    return 'Assigned cases';
  }

  get pageSubtitle(): string {
    if (this.caseType === 'ACTIVATION') {
      return 'Activation visits, locations, offers, and service status in one queue.';
    }

    if (this.caseType === 'PLAINTE') {
      return 'Complaint interventions, locations, and service status in one queue.';
    }

    return 'Client visits, locations, offers, and service status in one queue.';
  }

  get assignedCases(): CaseResponse[] {
    return filterFieldCases(this.cases, this.currentUserEmail, this.authStore.role());
  }

  get visibleCases(): CaseResponse[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.assignedCases
      .filter((item) => this.matchesFilter(item))
      .filter((item) => !term || this.searchText(item).includes(term))
      .sort((left, right) => this.caseSortValue(left) - this.caseSortValue(right));
  }

  trackByCase = (_index: number, item: CaseResponse): string => item.id;

  private loadCases(): void {
    this.loading = true;
    this.error = null;

    this.caseRequest()
      .pipe(finalize(() => {
        this.loading = false;
        this.render();
      }))
      .subscribe({
        next: (rows) => {
          this.cases = rows ?? [];
        },
        error: (err) => {
          console.error('Failed to load field tasks', err);
          this.error = err?.error?.message ?? 'Unable to load assigned tasks.';
          this.cases = [];
        }
      });
  }

  private caseRequest() {
    if (this.caseType === 'PLAINTE') {
      return this.casesService.getComplaintCases();
    }

    if (this.caseType === 'ACTIVATION') {
      return this.casesService.getActivationCases();
    }

    return this.casesService.getOperationalCases();
  }

  private resolveCaseTypeFromRoute(): CaseType | null {
    const snapshots = [...this.route.snapshot.pathFromRoot].reverse();
    for (const snapshot of snapshots) {
      const value = snapshot.data?.['caseType'];
      if (value === 'ACTIVATION' || value === 'PLAINTE') {
        return value;
      }
    }

    const url = this.router.url.toLowerCase();
    if (url.includes('/complaint')) {
      return 'PLAINTE';
    }

    if (url.includes('/activation')) {
      return 'ACTIVATION';
    }

    return null;
  }

  private matchesFilter(item: CaseResponse): boolean {
    switch (this.filter) {
      case 'ready':
        return item.status === 'RDV_SET';
      case 'completed':
        return isCompletedFieldStatus(item.status);
      case 'all':
        return true;
      case 'active':
      default:
        return isActiveFieldStatus(item.status);
    }
  }

  private searchText(item: CaseResponse): string {
    return [
      item.crmCase,
      item.clientName,
      item.clientPhone,
      item.msisdn,
      fieldCaseLocation(item),
      fieldCaseOffer(item)
    ].join(' ').toLowerCase();
  }

  private caseSortValue(item: CaseResponse): number {
    const remaining = item.slaTracking?.remainingSeconds;
    if (remaining != null) {
      return remaining;
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
