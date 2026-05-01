import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize, forkJoin } from 'rxjs';

import { CasesService } from '../../core/cases/cases.service';
import { CaseResponse, PerformanceSummaryResponse } from '../../core/cases/models/case.model';
import { TechInvitation, TechInvitationService } from '../../core/invitations/tech-invitation.service';
import { TUNISIA_GOVERNORATES } from '../../core/shared/tunisia-governorates';
import { GovernorateSelectorComponent } from '../../shared/modals/governorate-selector/governorate-selector.component';
import { SttTechnicianApiService } from '../../core/stt/stt-technician-api.service';
import { TechnicianListItem } from '../../core/stt/models/technician-list-item.model';
import { SwalService } from '../../core/ui/swal.service';
import { AppUser } from '../../core/users/user.model';
import { UserService } from '../../core/users/user.service';

type DashboardStat = {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: 'brand' | 'soft' | 'warning' | 'success';
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, IconDirective, GovernorateSelectorComponent],
  templateUrl: './stt-dashboard.component.html',
  styleUrl: './stt-dashboard.component.scss'
})
export class SttDashboardComponent implements OnInit {
  private readonly casesService = inject(CasesService);
  private readonly technicianApi = inject(SttTechnicianApiService);
  private readonly invitationService = inject(TechInvitationService);
  private readonly userService = inject(UserService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  loading = false;
  coverageSaving = false;
  error: string | null = null;

  // Governorate selector modal state
  govSelectorVisible = false;
  govSelectorSelected: string[] = [];

  cases: CaseResponse[] = [];
  technicians: TechnicianListItem[] = [];
  invitations: TechInvitation[] = [];
  performance: PerformanceSummaryResponse | null = null;
  profile: AppUser | null = null;
  readonly governorateOptions = [...TUNISIA_GOVERNORATES];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.error = null;

    forkJoin({
      cases: this.casesService.getActivationCases(),
      technicians: this.technicianApi.getMyTechnicians(),
      invitations: this.invitationService.getMySttInvitations(),
      performance: this.casesService.getMyPerformance(),
      profile: this.userService.getMe()
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: ({ cases, technicians, invitations, performance, profile }) => {
          this.cases = cases ?? [];
          this.technicians = technicians ?? [];
          this.invitations = invitations ?? [];
          this.performance = performance ?? null;
          this.profile = profile ?? null;
        },
        error: (err) => {
          console.error('Failed to load STT dashboard:', err);
          this.error = err?.error?.message ?? 'Failed to load STT operational dashboard';
        }
      });
  }

  get stats(): DashboardStat[] {
    const assignedCases = this.cases.length;
    const waitingForTech = this.cases.filter((item) => item.status === 'ASSIGNED_TO_STT').length;
    const inField = this.cases.filter((item) => ['ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE'].includes(item.status)).length;
    const workPendingReview = this.cases.filter((item) => ['WORK_DONE', 'REJECTED_BY_ZM'].includes(item.status)).length;
    const approvedTechs = this.technicians.filter((item) => item.status === 'APPROVED' && item.enabled).length;
    const pendingInvites = this.invitations.filter((item) =>
      item.status === 'PENDING_REGISTRATION' || item.status === 'REGISTERED_PENDING_ZM_APPROVAL'
    ).length;

    return [
      {
        label: 'Managed cases',
        value: String(assignedCases),
        hint: 'Cases currently inside your STT perimeter.',
        icon: 'cilFolderOpen',
        tone: 'brand'
      },
      {
        label: 'Need technician',
        value: String(waitingForTech),
        hint: 'Cases waiting for technician assignment.',
        icon: 'cilUserFollow',
        tone: 'warning'
      },
      {
        label: 'Field follow-up',
        value: String(inField),
        hint: 'TECH cases that still need active supervision.',
        icon: 'cilTask',
        tone: 'soft'
      },
      {
        label: 'Work pending review',
        value: String(workPendingReview),
        hint: 'Work done or rejected cases to watch closely.',
        icon: 'cilCheckCircle',
        tone: 'success'
      },
      {
        label: 'Active technicians',
        value: String(approvedTechs),
        hint: 'Approved technicians currently available to you.',
        icon: 'cilPeople',
        tone: 'soft'
      },
      {
        label: 'Open invitations',
        value: String(pendingInvites),
        hint: 'Registration or ZM approval still in progress.',
        icon: 'cilEnvelopeOpen',
        tone: 'brand'
      }
    ];
  }

  get urgentCases(): CaseResponse[] {
    return [...this.cases]
      .sort((left, right) => this.casePriority(left) - this.casePriority(right))
      .slice(0, 4);
  }

  get recentInvitations(): TechInvitation[] {
    return [...this.invitations]
      .sort((left, right) => this.toEpoch(right.createdAt) - this.toEpoch(left.createdAt))
      .slice(0, 4);
  }

  get approvedTechCount(): number {
    return this.technicians.filter((item) => item.status === 'APPROVED' && item.enabled).length;
  }

  get pendingTechCount(): number {
    return this.technicians.filter((item) => item.status === 'PENDING').length;
  }

  get invitationReadyCount(): number {
    return this.invitations.filter((item) => item.status === 'APPROVED_BY_ZM').length;
  }

  get approvedCoverageAreas(): string[] {
    return (this.profile?.coveredGovernorates ?? []).filter((item) => !!item?.trim());
  }

  get requestedCoverageAreas(): string[] {
    return (this.profile?.requestedGovernorates ?? []).filter((item) => !!item?.trim());
  }

  get coverageSummaryLabel(): string {
    return `${this.approvedCoverageAreas.length} approved • ${this.requestedCoverageAreas.length} pending`;
  }

  get averageCompletionLabel(): string {
    if (!this.performance) {
      return '-';
    }

    return `${this.performance.workCompletionProgress.toFixed(0)}%`;
  }

  statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'WORK_DONE':
      case 'VALIDATED_BY_ZM':
      case 'CLOSED':
        return 'stt-pill stt-pill--success';
      case 'RDV_SET':
      case 'ASSIGNED_TO_TECH':
        return 'stt-pill stt-pill--soft';
      case 'ASSIGNED_TO_STT':
      case 'NOT_REACHABLE':
      case 'REJECTED_BY_ZM':
        return 'stt-pill stt-pill--warning';
      default:
        return 'stt-pill stt-pill--brand';
    }
  }

  invitationBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED_BY_ZM':
        return 'stt-pill stt-pill--success';
      case 'REJECTED_BY_ZM':
      case 'EXPIRED':
      case 'CANCELLED':
        return 'stt-pill stt-pill--danger';
      case 'REGISTERED_PENDING_ZM_APPROVAL':
        return 'stt-pill stt-pill--soft';
      default:
        return 'stt-pill stt-pill--warning';
    }
  }

  humanizeStatus(value?: string | null): string {
    if (!value?.trim()) {
      return '-';
    }

    return value
      .trim()
      .toLowerCase()
      .split('_')
      .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
      .join(' ');
  }

  caseSlaLabel(item: CaseResponse): string {
    const remaining = item.slaTracking?.remainingSeconds;
    if (remaining == null) {
      return 'SLA not started';
    }

    if (remaining <= 0) {
      return 'Overdue';
    }

    if (remaining < 3600) {
      return `${Math.ceil(remaining / 60)} min left`;
    }

    return `${Math.ceil(remaining / 3600)} h left`;
  }

  executorSummary(item: CaseResponse): string {
    if (item.executionMode === 'STT_SELF_EXECUTION') {
      return `Executor: ${item.sttName || item.sttEmail || 'You'} (self)`;
    }

    if (item.executionMode === 'TECH_EXECUTION') {
      return `Executor: ${item.techName || item.techEmail || 'Technician'}`;
    }

    return 'Executor: not selected';
  }

  openSuggestZonesModal(): void {
    this.govSelectorSelected = [
      ...this.approvedCoverageAreas,
      ...this.requestedCoverageAreas
    ];
    this.govSelectorVisible = true;
  }

  onGovSave(selected: string[]): void {
    this.govSelectorVisible = false;
    this.coverageSaving = true;
    this.error = null;

    this.userService.requestMyCoverageAreas({
      requestedGovernorates: selected
    })
      .pipe(
        finalize(() => {
          this.coverageSaving = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: async (updated) => {
          this.profile = updated;
          await this.swal.success(
            'Coverage suggestion sent',
            'Your requested governorates were updated and any new areas are now waiting for ZM validation.'
          );
        },
        error: async (err) => {
          console.error('Failed to submit STT coverage suggestion:', err);
          const message = err?.error?.message ?? 'Failed to submit your coverage suggestion';
          this.error = message;
          await this.swal.error('Suggestion failed', message);
        }
      });
  }

  onGovCancel(): void {
    this.govSelectorVisible = false;
  }

  private casePriority(item: CaseResponse): number {
    const remaining = item.slaTracking?.remainingSeconds;
    const base = remaining == null ? Number.MAX_SAFE_INTEGER : remaining;

    switch (item.status) {
      case 'ASSIGNED_TO_STT':
        return base - 5000;
      case 'NOT_REACHABLE':
      case 'REJECTED_BY_ZM':
        return base - 3000;
      case 'WORK_DONE':
        return base - 2000;
      default:
        return base;
    }
  }

  private toEpoch(value?: string | null): number {
    if (!value) {
      return 0;
    }

    const epoch = Date.parse(value);
    return Number.isNaN(epoch) ? 0 : epoch;
  }

}
