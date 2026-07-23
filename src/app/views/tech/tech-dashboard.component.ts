import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import { CASE_STATUS_UI, CaseResponse, PerformanceSummaryResponse, SlaStatus } from '../../core/cases/models/case.model';
import { NotificationItem } from '../../core/notifications/models/notification.model';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { resolveLiveSla, slaRemainingLabel, slaStatusLabel } from './tech-case.helpers';

interface TechDashboardCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective, TranslocoModule],
  templateUrl: './tech-dashboard.component.html',
  styleUrl: './tech-dashboard.component.scss'
})
export class TechDashboardComponent implements OnInit, OnDestroy {
  private readonly casesService = inject(CasesService);
  private readonly notificationsStore = inject(NotificationStoreService);
  private readonly authStore = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);

  loading = false;
  error: string | null = null;
  cases: CaseResponse[] = [];
  performance: PerformanceSummaryResponse | null = null;

  private nowEpochMs = Date.now();
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadData();
    this.startTicker();
  }

  ngOnDestroy(): void {
    if (this.tickHandle != null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  get accessibleCases(): CaseResponse[] {
    return this.cases.filter((item) => this.isCaseOwnedByTech(item));
  }

  get activeCases(): CaseResponse[] {
    return this.accessibleCases.filter((item) => item.status !== 'CLOSED');
  }

  get urgentCases(): CaseResponse[] {
    return [...this.activeCases].sort((left, right) => this.priorityScore(left) - this.priorityScore(right)).slice(0, 4);
  }

  get rdvQueue(): CaseResponse[] {
    return this.activeCases
      .filter((item) => this.canSetRdv(item))
      .sort((left, right) => this.priorityScore(left) - this.priorityScore(right))
      .slice(0, 3);
  }

  get workQueue(): CaseResponse[] {
    return this.activeCases
      .filter((item) => this.canSubmitWork(item))
      .sort((left, right) => this.priorityScore(left) - this.priorityScore(right))
      .slice(0, 3);
  }

  get recentAlerts(): NotificationItem[] {
    const events = new Set(['SLA_WARNING', 'SLA_BREACHED', 'SLA_ESCALATED', 'CASE_ASSIGNED_TO_TECH']);
    return this.notificationsStore.latestFirst()
      .filter((item) => events.has(item.eventType))
      .slice(0, 4);
  }

  get summaryCards(): TechDashboardCard[] {
    return [
      {
        label: 'Active tasks',
        helper: 'Current open interventions',
        value: String(this.performance?.activeTasksCount ?? 0),
        icon: 'cilTask',
        tone: 'primary'
      },
      {
        label: 'Urgent SLA',
        helper: 'Warning or breach cases',
        value: String(this.activeCases.filter((item) => {
          const status = this.slaStatus(item);
          return status === 'WARNING' || status === 'BREACHED' || status === 'COMPLETED_LATE';
        }).length),
        icon: 'cilWarning',
        tone: 'warning'
      },
      {
        label: 'RDV queue',
        helper: 'Calls and appointments',
        value: String(this.rdvQueue.length),
        icon: 'cilCalendar',
        tone: 'info'
      },
      {
        label: 'Completion',
        helper: 'My work close rate',
        value: `${Math.round(this.performance?.workCompletionProgress ?? 0)}%`,
        icon: 'cilChartPie',
        tone: 'success'
      }
    ];
  }

  refresh(): void {
    this.loadData();
  }

  trackByCase = (_: number, item: CaseResponse) => item.id;
  trackByAlert = (_: number, item: NotificationItem) => item.id;

  slaProgress(item: CaseResponse): number {
    return resolveLiveSla(item, this.nowEpochMs).progressPercent;
  }

  slaStatus(item: CaseResponse): SlaStatus | null {
    return resolveLiveSla(item, this.nowEpochMs).status;
  }

  slaStatusClass(item: CaseResponse): string {
    switch (this.slaStatus(item)) {
      case 'WARNING':
        return 'bg-warning-subtle text-warning-emphasis';
      case 'BREACHED':
      case 'COMPLETED_LATE':
        return 'bg-danger-subtle text-danger-emphasis';
      case 'COMPLETED_ON_TIME':
        return 'bg-info-subtle text-info-emphasis';
      case 'ON_TRACK':
        return 'bg-success-subtle text-success-emphasis';
      default:
        return 'bg-secondary-subtle text-secondary-emphasis';
    }
  }

  slaLabel(item: CaseResponse): string {
    return slaStatusLabel(this.slaStatus(item));
  }

  remainingLabel(item: CaseResponse): string {
    return slaRemainingLabel(item, this.nowEpochMs);
  }

  statusLabel(item: CaseResponse): string {
    return this.transloco.translate(CASE_STATUS_UI[item.status]?.label ?? item.status);
  }

  statusClass(item: CaseResponse): string {
    return CASE_STATUS_UI[item.status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
  }

  caseLocation(item: CaseResponse): string {
    return [item.localite, item.delegation, item.gouvernorat].filter(Boolean).join(', ');
  }

  canSetRdv(item: CaseResponse): boolean {
    return ['ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE'].includes(item.status);
  }

  canSubmitWork(item: CaseResponse): boolean {
    return ['ASSIGNED_TO_TECH', 'RDV_SET'].includes(item.status);
  }

  primaryPanel(item: CaseResponse): 'details' | 'rdv' | 'stock' {
    if (this.canSubmitWork(item) && item.status === 'RDV_SET') {
      return 'stock';
    }

    if (this.canSetRdv(item)) {
      return 'rdv';
    }

    return 'details';
  }

  primaryActionLabel(item: CaseResponse): string {
    switch (this.primaryPanel(item)) {
      case 'stock':
        return 'Declare stock usage';
      case 'rdv':
        return 'Set RDV';
      default:
        return 'Open details';
    }
  }

  primaryActionIcon(item: CaseResponse): string {
    switch (this.primaryPanel(item)) {
      case 'stock':
        return 'cilStorage';
      case 'rdv':
        return 'cilCalendar';
      default:
        return 'cilMagnifyingGlass';
    }
  }

  priorityScore(item: CaseResponse): number {
    const live = resolveLiveSla(item, this.nowEpochMs);
    const progressWeight = 100 - live.progressPercent;
    const stateWeight = item.status === 'RDV_SET' ? -10 : item.status === 'ASSIGNED_TO_TECH' ? 0 : 15;
    return progressWeight + stateWeight;
  }

  private startTicker(): void {
    this.tickHandle = setInterval(() => {
      this.nowEpochMs = Date.now();
    }, 1000);
  }

  private loadData(): void {
    this.loading = true;
    this.error = null;

    this.casesService.getActivationCases()
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: (rows) => {
          this.cases = rows ?? [];
        },
        error: (err) => {
          console.error('Failed to load TECH dashboard cases', err);
          this.error = err?.error?.message ?? 'Unable to load your field tasks.';
          this.cases = [];
        }
      });

    this.casesService.getMyPerformance().subscribe({
      next: (summary) => {
        this.performance = summary;
      },
      error: () => {
        this.performance = null;
      }
    });
  }

  private get currentUserEmail(): string {
    return (this.authStore.user()?.email ?? '').trim().toLowerCase();
  }

  private isCaseOwnedByTech(item: CaseResponse): boolean {
    return (item.techEmail ?? '').trim().toLowerCase() === this.currentUserEmail;
  }
}
