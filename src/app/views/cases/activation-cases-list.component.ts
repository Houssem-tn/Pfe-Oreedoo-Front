import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { IconDirective } from '@coreui/icons-angular';
import { AuthStore } from '../../core/auth/auth.store';
import { Role } from '../../core/auth/models/roles.type';
import { SwalService } from '../../core/ui/swal.service';
import { TechnicianListItem } from '../../core/stt/models/technician-list-item.model';
import { SttTechnicianApiService } from '../../core/stt/stt-technician-api.service';
import { UserService } from '../../core/users/user.service';
import { CasesService } from '../../core/cases/cases.service';
import {
  CASE_STATUS_UI,
  CaseMetrics,
  CaseProofFile,
  CaseRdv,
  CaseResponse,
  CaseSlaTracking,
  CaseStatus,
  CaseTimelineEvent,
  CaseWork,
  CaseZmValidation,
  CompleteWorkRequest,
  PerformanceSummaryResponse,
  SetRdvRequest,
  SlaStatus,
  ValidateZmRequest
} from '../../core/cases/models/case.model';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { NotificationItem } from '../../core/notifications/models/notification.model';

type AssignableUser = { id: string; fullName: string; email: string };

type StatCard = {
  label: string;
  value: number;
  icon: string;
  className: string;
};

type PerfCard = {
  label: string;
  value: string;
  icon: string;
  className: string;
};

@Component({
  selector: 'app-activation-cases-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective],
  templateUrl: './activation-cases-list.component.html',
  styleUrl: './activation-cases-list.component.scss'
})
export class ActivationCasesListComponent implements OnInit, OnDestroy {
  private static readonly LIVE_TICK_MS = 60000;
  private static readonly BACKEND_RESYNC_MS = 300000;

  private readonly casesService = inject(CasesService);
  private readonly userService = inject(UserService);
  private readonly sttTechApi = inject(SttTechnicianApiService);
  private readonly authStore = inject(AuthStore);
  private readonly swal = inject(SwalService);
  private readonly notificationStore = inject(NotificationStoreService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  cases: CaseResponse[] = [];
  loading = false;
  performanceLoading = false;
  actionLoadingCaseId: string | null = null;
  error: string | null = null;

  myPerformance: PerformanceSummaryResponse | null = null;
  teamTechPerformance: PerformanceSummaryResponse[] = [];

  searchTerm = '';
  selectedStatus = '';
  selectedGouvernorat = '';
  selectedDelegation = '';

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [5, 10, 20];

  private nowEpochMs = Date.now();
  private liveTickHandle: ReturnType<typeof setInterval> | null = null;
  private resyncHandle: ReturnType<typeof setInterval> | null = null;
  private readonly warningThresholdPercent = 50;

  readonly statusOptions: Array<{ value: '' | CaseStatus; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'CREATED', label: 'Created' },
    { value: 'ASSIGNED_TO_ZM', label: 'Assigned to ZM' },
    { value: 'ASSIGNED_TO_STT', label: 'Assigned to STT' },
    { value: 'ASSIGNED_TO_TECH', label: 'Assigned to TECH' },
    { value: 'RDV_SET', label: 'RDV set' },
    { value: 'NOT_REACHABLE', label: 'Not reachable' },
    { value: 'ABANDONED', label: 'Abandoned' },
    { value: 'WORK_DONE', label: 'Work done' },
    { value: 'VALIDATED_BY_ZM', label: 'Validated by ZM' },
    { value: 'REJECTED_BY_ZM', label: 'Rejected by ZM' },
    { value: 'CLOSED', label: 'Closed' }
  ];

  ngOnInit(): void {
    this.loadCases();
    this.loadPerformance();
    this.startLiveTicker();
    this.startBackendResync();
  }

  ngOnDestroy(): void {
    this.stopLiveTicker();
    this.stopBackendResync();
  }

  get currentRole(): Role | null {
    return this.authStore.role();
  }

  get canCreateCase(): boolean {
    return this.currentRole === 'ROLE_ADMIN';
  }

  get createRoute(): string {
    return '/admin/cases/activation/new';
  }

  get workspaceTitle(): string {
    switch (this.currentRole) {
      case 'ROLE_ADMIN':
        return 'Ooredoo Activation Command Center';
      case 'ROLE_ZM':
        return 'Zone Activation Oversight';
      case 'ROLE_STT':
        return 'Partner Delivery Control';
      case 'ROLE_TECH':
        return 'Field Activation Queue';
      default:
        return 'Activation Case Management';
    }
  }

  get workspaceSubtitle(): string {
    switch (this.currentRole) {
      case 'ROLE_ADMIN':
        return 'Monitor the full CRM activation pipeline, from intake to closure, inside a branded operations workspace.';
      case 'ROLE_ZM':
        return 'Track zone ownership, SLA pressure, and downstream delivery decisions with faster visual scanning.';
      case 'ROLE_STT':
        return 'Keep STT assignments, technician execution, and SLA follow-up aligned in one operational board.';
      case 'ROLE_TECH':
        return 'Review assigned field cases, time pressure, and execution status in a more focused activation queue.';
      default:
        return 'Telecom field workflow: assignment, RDV, work execution, validation, and closure.';
    }
  }

  get accessibleCases(): CaseResponse[] {
    return this.cases.filter((item) => this.canAccessCase(item));
  }

  get filteredCases(): CaseResponse[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.accessibleCases.filter((item) => {
      const matchesSearch =
        !term ||
        item.crmCase.toLowerCase().includes(term) ||
        item.clientName.toLowerCase().includes(term) ||
        item.clientPhone.toLowerCase().includes(term) ||
        this.ownerZmDisplayName(item).toLowerCase().includes(term) ||
        (item.sttName ?? '').toLowerCase().includes(term) ||
        (item.techName ?? '').toLowerCase().includes(term) ||
        (item.offre ?? '').toLowerCase().includes(term) ||
        item.localite.toLowerCase().includes(term) ||
        item.delegation.toLowerCase().includes(term) ||
        item.gouvernorat.toLowerCase().includes(term);

      const matchesStatus = !this.selectedStatus || item.status === this.selectedStatus;
      const matchesGouvernorat = !this.selectedGouvernorat || item.gouvernorat === this.selectedGouvernorat;
      const matchesDelegation = !this.selectedDelegation || item.delegation === this.selectedDelegation;

      return matchesSearch && matchesStatus && matchesGouvernorat && matchesDelegation;
    });
  }

  get paginatedCases(): CaseResponse[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCases.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCases.length / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get gouvernoratOptions(): string[] {
    return [...new Set(this.accessibleCases.map((item) => item.gouvernorat).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  get delegationOptions(): string[] {
    return [...new Set(this.accessibleCases.map((item) => item.delegation).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  get statsCards(): StatCard[] {
    const source = this.accessibleCases;
    const workDoneCount = source.filter((c) => ['WORK_DONE', 'VALIDATED_BY_ZM', 'CLOSED'].includes(c.status)).length;
    const warningCount = source.filter((c) => this.getSlaStatus(c) === 'WARNING').length;
    const breachCount = source.filter((c) => {
      const status = this.getSlaStatus(c);
      return status === 'BREACHED' || status === 'COMPLETED_LATE';
    }).length;

    return [
      { label: 'Total Cases', value: source.length, icon: 'cilDescription', className: 'stat-neutral' },
      { label: 'Owned by ZM', value: source.filter((c) => !!this.ownerZmId(c)).length, icon: 'cilUser', className: 'stat-primary' },
      { label: 'Assigned to STT', value: source.filter((c) => !!c.sttId).length, icon: 'cilPeople', className: 'stat-info' },
      { label: 'Assigned to TECH', value: source.filter((c) => !!c.techId).length, icon: 'cilUserFollow', className: 'stat-warning' },
      { label: 'SLA Warning', value: warningCount, icon: 'cilWarning', className: 'stat-warning' },
      { label: 'SLA Breached', value: breachCount, icon: 'cilBan', className: 'stat-danger' },
      { label: 'Work Done', value: workDoneCount, icon: 'cilTask', className: 'stat-success' },
      { label: 'Closed', value: source.filter((c) => c.status === 'CLOSED').length, icon: 'cilLockLocked', className: 'stat-dark' }
    ];
  }

  get performanceCards(): PerfCard[] {
    if (!this.myPerformance) {
      return [];
    }

    return [
      {
        label: 'Active Tasks',
        value: String(this.myPerformance.activeTasksCount),
        icon: 'cilTask',
        className: 'perf-primary'
      },
      {
        label: 'RDV On-Time',
        value: String(this.myPerformance.rdvOnTime),
        icon: 'cilCheckCircle',
        className: 'perf-success'
      },
      {
        label: 'RDV Late',
        value: String(this.myPerformance.rdvLate),
        icon: 'cilClock',
        className: 'perf-danger'
      },
      {
        label: 'RDV On-Time Rate',
        value: `${this.myPerformance.rdvOnTimeRate.toFixed(1)}%`,
        icon: 'cilChart',
        className: 'perf-success'
      },
      {
        label: 'Avg RDV Response',
        value: this.formatMinutes(this.myPerformance.averageResponseMinutes),
        icon: 'cilSpeedometer',
        className: 'perf-info'
      },
      {
        label: 'SLA Warnings',
        value: String(this.myPerformance.slaWarningCount),
        icon: 'cilWarning',
        className: 'perf-warning'
      },
      {
        label: 'SLA Escalations',
        value: String(this.myPerformance.slaEscalationCount),
        icon: 'cilBan',
        className: 'perf-danger'
      },
      {
        label: 'Avg Overdue',
        value: this.formatMinutes(this.myPerformance.averageOverdueMinutes),
        icon: 'cilClock',
        className: 'perf-warning'
      },
      {
        label: 'Completion',
        value: `${this.myPerformance.workCompletionProgress.toFixed(1)}%`,
        icon: 'cilChartPie',
        className: 'perf-dark'
      }
    ];
  }

  get operationalAlerts(): NotificationItem[] {
    const events = new Set([
      'CASE_ASSIGNED_TO_ZM',
      'CASE_ASSIGNED_TO_STT',
      'CASE_ASSIGNED_TO_TECH',
      'SLA_WARNING',
      'SLA_BREACHED',
      'SLA_ESCALATED'
    ]);

    return this.notificationStore.latestFirst()
      .filter((item) => events.has(item.eventType))
      .slice(0, 4);
  }

  get topTechs(): PerformanceSummaryResponse[] {
    return [...this.teamTechPerformance]
      .sort((a, b) => b.workCompletionProgress - a.workCompletionProgress)
      .slice(0, 3);
  }

  get alertSummaryCards(): StatCard[] {
    const alerts = this.operationalAlerts;
    const breached = alerts.filter((item) => item.eventType === 'SLA_BREACHED').length;
    const warning = alerts.filter((item) => item.eventType === 'SLA_WARNING').length;
    const escalated = alerts.filter((item) => item.eventType === 'SLA_ESCALATED').length;
    const assignments = alerts.filter((item) =>
      item.eventType === 'CASE_ASSIGNED_TO_ZM'
      || item.eventType === 'CASE_ASSIGNED_TO_STT'
      || item.eventType === 'CASE_ASSIGNED_TO_TECH'
    ).length;
    const unread = alerts.filter((item) => !item.read).length;

    return [
      { label: 'Critical Breach', value: breached, icon: 'cilBan', className: 'stat-danger' },
      { label: 'Escalated', value: escalated, icon: 'cilWarning', className: 'stat-danger' },
      { label: 'SLA Warning', value: warning, icon: 'cilWarning', className: 'stat-warning' },
      { label: 'Assignments', value: assignments, icon: 'cilTask', className: 'stat-primary' },
      { label: 'Unread Alerts', value: unread, icon: 'cilBell', className: 'stat-dark' }
    ];
  }

  get techMobileCases(): CaseResponse[] {
    return [...this.filteredCases].sort((left, right) => {
      const priorityDelta = this.mobileTechPriority(left) - this.mobileTechPriority(right);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.crmCase.localeCompare(right.crmCase);
    });
  }

  get sttMobileCases(): CaseResponse[] {
    const start = (this.currentPage - 1) * this.pageSize;

    return [...this.filteredCases]
      .sort((left, right) => this.mobileSttPriority(left) - this.mobileSttPriority(right))
      .slice(start, start + this.pageSize);
  }

  loadCases(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.casesService.getActivationCases()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (rows) => {
          const previousPage = this.currentPage;
          this.cases = rows ?? [];
          this.currentPage = Math.min(Math.max(1, previousPage), this.totalPages);
        },
        error: (err) => {
          console.error('Failed to load activation cases:', err);
          this.error = err?.error?.message ?? 'Failed to load activation cases';
        }
      });
  }

  loadPerformance(): void {
    if (this.performanceLoading) {
      return;
    }

    this.performanceLoading = true;

    this.casesService.getMyPerformance()
      .pipe(finalize(() => {
        this.performanceLoading = false;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: (summary) => {
          this.myPerformance = summary;
        },
        error: (err) => {
          console.error('Failed to load my performance:', err);
          this.myPerformance = null;
        }
      });

    if (this.isAdmin || this.isZm || this.isStt) {
      this.casesService.getTechPerformance().subscribe({
        next: (rows) => {
          this.teamTechPerformance = rows ?? [];
        },
        error: (err) => {
          console.error('Failed to load team performance:', err);
          this.teamTechPerformance = [];
        }
      });
      return;
    }

    this.teamTechPerformance = [];
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedGouvernorat = '';
    this.selectedDelegation = '';
    this.currentPage = 1;
  }

  rangeLabel(): string {
    if (this.filteredCases.length === 0) {
      return '0 of 0';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredCases.length);
    return `${start}-${end} of ${this.filteredCases.length}`;
  }

  statusBadgeClass(status: CaseStatus): string {
    return CASE_STATUS_UI[status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
  }

  statusLabel(status: CaseStatus): string {
    return CASE_STATUS_UI[status]?.label ?? status;
  }

  getSlaStatus(item: CaseResponse): SlaStatus | null {
    return this.resolveLiveSla(item).status;
  }

  slaStatusLabel(item: CaseResponse): string {
    const status = this.getSlaStatus(item);

    switch (status) {
      case 'ON_TRACK':
        return 'On Track';
      case 'WARNING':
        return 'Warning';
      case 'BREACHED':
        return 'Breached';
      case 'COMPLETED_ON_TIME':
        return 'Completed On Time';
      case 'COMPLETED_LATE':
        return 'Completed Late';
      default:
        return 'Not Started';
    }
  }

  slaBadgeClass(item: CaseResponse): string {
    const status = this.getSlaStatus(item);

    switch (status) {
      case 'ON_TRACK':
        return 'bg-success-subtle text-success-emphasis';
      case 'WARNING':
        return 'bg-warning-subtle text-warning-emphasis';
      case 'BREACHED':
        return 'bg-danger-subtle text-danger-emphasis';
      case 'COMPLETED_ON_TIME':
        return 'bg-info-subtle text-info-emphasis';
      case 'COMPLETED_LATE':
        return 'bg-danger-subtle text-danger-emphasis';
      default:
        return 'bg-secondary-subtle text-secondary-emphasis';
    }
  }

  slaProgressClass(item: CaseResponse): string {
    const status = this.getSlaStatus(item);

    switch (status) {
      case 'ON_TRACK':
        return 'sla-progress--safe';
      case 'WARNING':
        return 'sla-progress--warning';
      case 'BREACHED':
      case 'COMPLETED_LATE':
        return 'sla-progress--breached';
      case 'COMPLETED_ON_TIME':
        return 'sla-progress--done';
      default:
        return 'sla-progress--idle';
    }
  }

  slaProgress(item: CaseResponse): number {
    return this.resolveLiveSla(item).progressPercent;
  }

  slaRemainingLabel(item: CaseResponse): string {
    const sla = item.slaTracking;
    if (!sla) {
      return '-';
    }

    const live = this.resolveLiveSla(item);

    if (live.status === 'COMPLETED_ON_TIME' || live.status === 'COMPLETED_LATE') {
      if (live.responseDurationSeconds == null) {
        return 'RDV captured';
      }

      return `Responded in ${this.formatSeconds(live.responseDurationSeconds)}`;
    }

    const remaining = live.remainingSeconds;
    if (remaining == null) {
      return '-';
    }

    if (remaining <= 0) {
      return live.overdueSeconds > 0
        ? `Overdue by ${this.formatSeconds(live.overdueSeconds)}`
        : 'Overdue';
    }

    return `${this.formatSeconds(remaining)} left`;
  }

  alertClass(item: NotificationItem): string {
    switch (item.eventType) {
      case 'SLA_WARNING':
        return 'op-alert op-alert--warning';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
        return 'op-alert op-alert--breached';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':
        return 'op-alert op-alert--assignment';
      default:
        return 'op-alert op-alert--neutral';
    }
  }

  alertIcon(item: NotificationItem): string {
    switch (item.eventType) {
      case 'SLA_WARNING':
        return 'cilWarning';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
        return 'cilBan';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':
        return 'cilTask';
      default:
        return 'cilBell';
    }
  }

  alertCaseRef(item: NotificationItem): string {
    const crmCase = item.data?.['crmCase'];
    if (typeof crmCase === 'string' && crmCase.trim()) {
      return crmCase;
    }

    return item.entityId ?? '-';
  }

  private mobileSttPriority(item: CaseResponse): number {
    const remaining = item.slaTracking?.remainingSeconds ?? Number.MAX_SAFE_INTEGER;
    const executionBoost = this.isSttExecutor(item) ? -1500 : this.isTechExecutor(item) ? 400 : -300;

    switch (item.status) {
      case 'ASSIGNED_TO_STT':
        return remaining - 5000 + executionBoost;
      case 'REJECTED_BY_ZM':
      case 'NOT_REACHABLE':
        return remaining - 2500 + executionBoost;
      case 'ASSIGNED_TO_TECH':
      case 'RDV_SET':
        return remaining - 1000 + executionBoost;
      default:
        return remaining + executionBoost;
    }
  }

  private mobileTechPriority(item: CaseResponse): number {
    const remaining = item.slaTracking?.remainingSeconds ?? Number.MAX_SAFE_INTEGER;

    switch (item.status) {
      case 'RDV_SET':
        return remaining - 3000;
      case 'ASSIGNED_TO_TECH':
      case 'ASSIGNED_TO_STT':
        return remaining - 1500;
      case 'NOT_REACHABLE':
      case 'REJECTED_BY_ZM':
        return remaining - 500;
      default:
        return remaining;
    }
  }

  async openAlert(alert: NotificationItem): Promise<void> {
    const caseIdRaw = alert.data?.['caseId'];
    const caseId = typeof caseIdRaw === 'string' && caseIdRaw.trim()
      ? caseIdRaw
      : alert.entityId;

    if (caseId) {
      const local = this.cases.find((c) => c.id === caseId);
      if (local) {
        await this.openDetails(local);
      }
    }

    if (!alert.read) {
      this.notificationStore.markAsRead(alert.id);
    }
  }

  markAlertRead(alert: NotificationItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!alert.read) {
      this.notificationStore.markAsRead(alert.id);
    }
  }

  canAssignStt(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return ['ASSIGNED_TO_ZM', 'ASSIGNED_TO_STT'].includes(item.status);
  }

  canAssignTech(item: CaseResponse): boolean {
    if (!this.isStt || !this.isCaseOwnedByStt(item)) return false;
    return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE', 'REJECTED_BY_ZM'].includes(item.status);
  }

  canExecuteMyself(item: CaseResponse): boolean {
    if (!this.isStt || !this.isCaseOwnedByStt(item)) return false;
    return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE', 'REJECTED_BY_ZM'].includes(item.status);
  }

  canSetRdv(item: CaseResponse): boolean {
    const sttAllowedStatuses = ['ASSIGNED_TO_STT', 'RDV_SET', 'NOT_REACHABLE'];
    const techAllowedStatuses = ['ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE'];

    if (this.isStt && this.isSttExecutor(item)) {
      return sttAllowedStatuses.includes(item.status);
    }

    if (this.isTech && this.isCaseOwnedByTech(item)) {
      return techAllowedStatuses.includes(item.status);
    }

    return false;
  }

  canUpdateWork(item: CaseResponse): boolean {
    if (this.isStt && this.isSttExecutor(item)) {
      return ['RDV_SET', 'ASSIGNED_TO_STT'].includes(item.status);
    }

    if (!this.isTech || !this.isCaseOwnedByTech(item)) return false;
    return ['RDV_SET', 'ASSIGNED_TO_TECH'].includes(item.status);
  }

  canValidateZm(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return item.status === 'WORK_DONE';
  }

  canCloseCase(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return item.status === 'VALIDATED_BY_ZM';
  }

  canView(item: CaseResponse): boolean {
    return this.canAccessCase(item);
  }

  isBusy(caseId: string): boolean {
    return this.actionLoadingCaseId === caseId;
  }

  trackById = (_index: number, item: CaseResponse) => item.id;

  async openAssignStt(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const stts = await this.loadAssignableStts(item);

      if (!stts.length) {
        await this.swal.error(
          'No STT available',
          `No approved STT currently covers ${item.gouvernorat}.`
        );
        return;
      }

      const result = await this.swal.promptSelect(
        `Assign STT to CRM ${item.crmCase}`,
        'Choose STT',
        stts.reduce<Record<string, string>>((acc, stt) => {
          acc[stt.id] = `${stt.fullName} (${stt.email})`;
          return acc;
        }, {}),
        item.sttId ?? '',
        item.sttId ? 'Change STT' : 'Assign STT'
      );

      if (!result.isConfirmed || !result.value) {
        return;
      }

      const selectedSttId = result.value;
      await this.runAction(item.id, () => this.casesService.assignStt(item.id, selectedSttId), 'STT assignment saved');
    } catch (err: any) {
      console.error('Failed to assign STT:', err);
      const message = err?.error?.message ?? 'Failed to assign STT';
      await this.swal.error('Assignment failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }

    
  }

  async openAssignTech(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const techs = await this.loadAssignableTechs();

      if (!techs.length) {
        await this.swal.error('No TECH available', 'No assignable TECH was found for this case.');
        return;
      }

      const result = await this.swal.promptSelect(
        `Assign TECH to CRM ${item.crmCase}`,
        'Choose TECH',
        techs.reduce<Record<string, string>>((acc, tech) => {
          acc[tech.id] = `${tech.fullName} (${tech.email})`;
          return acc;
        }, {}),
        item.techId ?? '',
        item.techId ? 'Change TECH' : 'Assign TECH'
      );

      if (!result.isConfirmed || !result.value) {
        return;
      }

      const selectedTechId = result.value;
      await this.runAction(item.id, () => this.casesService.assignTech(item.id, selectedTechId), 'TECH assignment saved');
    } catch (err: any) {
      console.error('Failed to assign TECH:', err);
      const message = err?.error?.message ?? 'Failed to assign TECH';
      await this.swal.error('Assignment failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  async openExecuteMyself(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const alreadySelfExecuting = this.isSttExecutor(item);
      const confirm = alreadySelfExecuting
        ? { isConfirmed: true }
        : await this.swal.confirmAction(
            'Take execution yourself?',
            `CRM ${item.crmCase} will stay under your supervision and move into STT self-execution mode.`,
            'Execute myself'
          );

      if (!confirm.isConfirmed) {
        return;
      }

      await this.runAction(
        item.id,
        () => this.casesService.executeMyself(item.id),
        alreadySelfExecuting ? 'STT execution kept' : 'STT self-execution activated'
      );

      void this.openSttExecutionWorkspace(item.id, 'details');
    } catch (err: any) {
      console.error('Failed to switch to STT self-execution:', err);
      const message = err?.error?.message ?? 'Failed to activate STT self-execution';
      await this.swal.error('Execution switch failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  openSttPrimaryAction(item: CaseResponse): void {
    if (this.hasSttSelfExecution(item)) {
      const panel = this.canUpdateWork(item) && item.status === 'RDV_SET'
        ? 'work'
        : this.canSetRdv(item)
          ? 'rdv'
          : 'details';

      void this.openSttExecutionWorkspace(item.id, panel);
      return;
    }

    if (this.canUpdateWork(item) && item.status === 'RDV_SET') {
      void this.openWorkPopup(item);
      return;
    }

    if (this.canSetRdv(item)) {
      void this.openRdvPopup(item);
      return;
    }

    void this.openDetails(item);
  }

  sttPrimaryActionLabel(item: CaseResponse): string {
    if (this.canUpdateWork(item) && item.status === 'RDV_SET') {
      return 'Work';
    }

    if (this.canSetRdv(item)) {
      return 'RDV';
    }

    return 'Details';
  }

  sttPrimaryActionIcon(item: CaseResponse): string {
    if (this.canUpdateWork(item) && item.status === 'RDV_SET') {
      return 'cilTask';
    }

    if (this.canSetRdv(item)) {
      return 'cilCalendar';
    }

    return 'cilMagnifyingGlass';
  }

  async openRdvPopup(item: CaseResponse): Promise<void> {
    if (this.isStt && this.isSttExecutor(item)) {
      await this.openSttExecutionWorkspace(item.id, 'rdv');
      return;
    }

    const rdv = this.extractRdv(item);

    const result = await Swal.fire<SetRdvRequest>({
      title: `Set RDV - CRM ${this.escapeHtml(item.crmCase)}`,
      width: 860,
      html: `
        <div class="case-op-modal">
          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">Joignable <span>*</span></label>
              <select id="sw-rdv-joignable" class="swal2-input case-op-input">
                <option value="true" ${rdv.joignable !== false ? 'selected' : ''}>Yes</option>
                <option value="false" ${rdv.joignable === false ? 'selected' : ''}>No</option>
              </select>
            </div>

            <div class="case-op-field">
              <label class="case-op-label">Date & Time RDV <span>*</span></label>
              <input id="sw-rdv-date" type="datetime-local" class="swal2-input case-op-input" value="${this.toDateTimeLocal(rdv.datePriseRdv)}" />
            </div>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">Customer Reachability Cause</label>
            <input id="sw-rdv-cause-inj" class="swal2-input case-op-input" value="${this.escapeHtml(rdv.causeInjoignabilite ?? '')}" placeholder="Required when joignable = No" />
          </div>

          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">Operational Detail</label>
              <textarea id="sw-rdv-detail" class="swal2-textarea case-op-textarea" placeholder="Customer/site detail for field team">${this.escapeHtml(rdv.detail ?? '')}</textarea>
            </div>
            <div class="case-op-field">
              <label class="case-op-label">RDV Comment</label>
              <textarea id="sw-rdv-comment" class="swal2-textarea case-op-textarea" placeholder="Additional scheduling notes">${this.escapeHtml(rdv.cmtRdv ?? '')}</textarea>
            </div>
          </div>

          <div class="case-op-divider"></div>

          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">Abandon</label>
              <select id="sw-rdv-abandon" class="swal2-input case-op-input">
                <option value="false" ${rdv.abandon ? '' : 'selected'}>No</option>
                <option value="true" ${rdv.abandon ? 'selected' : ''}>Yes</option>
              </select>
            </div>

            <div class="case-op-field">
              <label class="case-op-label">Cause Abandon</label>
              <input id="sw-rdv-cause-abandon" class="swal2-input case-op-input" value="${this.escapeHtml(rdv.causeAbandon ?? '')}" placeholder="Required when abandon = Yes" />
            </div>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: 'Save RDV',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#321fdb',
      preConfirm: () => {
        const joignable = this.getElementValue('sw-rdv-joignable') === 'true';
        const datePriseRdv = this.toIso(this.getElementValue('sw-rdv-date'));
        const causeInjoignabilite = this.toNullable(this.getElementValue('sw-rdv-cause-inj'));
        const detail = this.getElementValue('sw-rdv-detail').trim();
        const cmtRdv = this.getElementValue('sw-rdv-comment').trim();
        const abandon = this.getElementValue('sw-rdv-abandon') === 'true';
        const causeAbandon = this.toNullable(this.getElementValue('sw-rdv-cause-abandon'));

        if (!datePriseRdv) {
          Swal.showValidationMessage('Date RDV is required');
          return undefined;
        }

        if (!joignable && !causeInjoignabilite) {
          Swal.showValidationMessage('Cause injoignabilite is required when client is not joignable');
          return undefined;
        }

        if (abandon && !causeAbandon) {
          Swal.showValidationMessage('Cause abandon is required when abandon is true');
          return undefined;
        }

        return {
          joignable,
          datePriseRdv,
          causeInjoignabilite: joignable ? null : causeInjoignabilite,
          detail,
          cmtRdv,
          abandon,
          causeAbandon: abandon ? causeAbandon : null
        };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const rdvPayload = result.value;
    await this.runAction(item.id, () => this.casesService.setRdv(item.id, rdvPayload), 'RDV saved');
  }

  async openWorkPopup(item: CaseResponse): Promise<void> {
    if (this.isStt && this.isSttExecutor(item)) {
      await this.openSttExecutionWorkspace(item.id, 'work');
      return;
    }

    const work = this.extractWork(item);
    const metrics = this.extractMetrics(item);

    const result = await Swal.fire<CompleteWorkRequest>({
      title: `Update Work - CRM ${this.escapeHtml(item.crmCase)}`,
      width: 760,
      html: `
        <div class="case-op-modal">
          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">Work Result <span>*</span></label>
              <input id="sw-work-result" class="swal2-input case-op-input" value="${this.escapeHtml(work.repTravauxStt ?? '')}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">Date End Work <span>*</span></label>
              <input id="sw-work-date" type="datetime-local" class="swal2-input case-op-input" value="${this.toDateTimeLocal(work.dateFinTrv)}" />
            </div>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">Comment <span>*</span></label>
            <textarea id="sw-work-comment" class="swal2-textarea case-op-textarea" placeholder="Summarize intervention outcome and observations">${this.escapeHtml(work.cmtTrvStt ?? '')}</textarea>
          </div>

          <div class="case-op-divider"></div>
          <div class="case-op-subtitle">Technical Metrics</div>

          <div class="case-op-grid case-op-grid-3">
            <div class="case-op-field">
              <label class="case-op-label">Metrage Cable</label>
              <input id="sw-work-metrage" type="number" step="0.01" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.metrageCable)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">Nombre PV</label>
              <input id="sw-work-pv" type="number" step="1" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.nombrePv)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">Debit DL</label>
              <input id="sw-work-dl" type="number" step="0.01" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.debitDl)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">Debit UL</label>
              <input id="sw-work-ul" type="number" step="0.01" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.debitUl)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">RSRP</label>
              <input id="sw-work-rsrp" type="number" step="1" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.rsrp)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">RSRQ</label>
              <input id="sw-work-rsrq" type="number" step="1" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.rsrq)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">SINR</label>
              <input id="sw-work-sinr" type="number" step="1" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.sinr)}" />
            </div>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: 'Submit Work',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2eb85c',
      preConfirm: () => {
        const repTravauxStt = this.getElementValue('sw-work-result').trim();
        const dateFinTrv = this.toIso(this.getElementValue('sw-work-date'));
        const cmtTrvStt = this.getElementValue('sw-work-comment').trim();

        if (!repTravauxStt || !dateFinTrv || !cmtTrvStt) {
          Swal.showValidationMessage('Work result, date and comment are required');
          return undefined;
        }

        return {
          repTravauxStt,
          dateFinTrv,
          cmtTrvStt,
          metrageCable: this.toMaybeNumber(this.getElementValue('sw-work-metrage')),
          nombrePv: this.toMaybeNumber(this.getElementValue('sw-work-pv')),
          debitDl: this.toMaybeNumber(this.getElementValue('sw-work-dl')),
          debitUl: this.toMaybeNumber(this.getElementValue('sw-work-ul')),
          rsrp: this.toMaybeNumber(this.getElementValue('sw-work-rsrp')),
          rsrq: this.toMaybeNumber(this.getElementValue('sw-work-rsrq')),
          sinr: this.toMaybeNumber(this.getElementValue('sw-work-sinr'))
        };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const workPayload = result.value;
    await this.runAction(item.id, () => this.casesService.completeWork(item.id, workPayload), 'Work updated');
  }

  async openValidatePopup(item: CaseResponse): Promise<void> {
    const validation = this.extractValidation(item);
    const defaultApproved = validation.approved ?? true;

    const result = await Swal.fire<ValidateZmRequest>({
      title: `ZM Validation - CRM ${this.escapeHtml(item.crmCase)}`,
      width: 720,
      html: `
        <div class="case-op-modal">
          <div class="case-op-field">
            <label class="case-op-label">Decision <span>*</span></label>
            <select id="sw-zm-approved" class="swal2-input case-op-input">
              <option value="true" ${defaultApproved ? 'selected' : ''}>Approve</option>
              <option value="false" ${defaultApproved ? '' : 'selected'}>Reject</option>
            </select>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">Validation Comment <span>*</span></label>
            <textarea id="sw-zm-comment" class="swal2-textarea case-op-textarea" placeholder="Explain your validation decision for traceability">${this.escapeHtml(validation.comment ?? '')}</textarea>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: 'Submit Validation',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#321fdb',
      preConfirm: () => {
        const approved = this.getElementValue('sw-zm-approved') === 'true';
        const comment = this.getElementValue('sw-zm-comment').trim();

        if (!comment) {
          Swal.showValidationMessage('Comment is required');
          return undefined;
        }

        return { approved, comment };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const validationPayload = result.value;
    await this.runAction(item.id, () => this.casesService.validateZm(item.id, validationPayload), 'Validation saved');
  }

  async openClosePopup(item: CaseResponse): Promise<void> {
    const confirm = await this.swal.confirmAction(
      'Close this case?',
      `CRM ${item.crmCase} will be closed and cannot move forward.`,
      'Close Case'
    );

    if (!confirm.isConfirmed) return;
    await this.runAction(item.id, () => this.casesService.closeCase(item.id), 'Case closed');
  }

  async openDetails(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const fullCase = await firstValueFrom(this.casesService.getCaseById(item.id));
      const rdv = this.extractRdv(fullCase);
      const work = this.extractWork(fullCase);
      const metrics = this.extractMetrics(fullCase);
      const validation = this.extractValidation(fullCase);
      const timeline = this.extractTimeline(fullCase);
      const proofs = this.extractProofs(fullCase);

      await Swal.fire({
        title: `Case Details - ${this.escapeHtml(fullCase.crmCase)}`,
        width: 940,
        didOpen: (modal) => {
          modal.classList.add('case-details-swal');
        },
        html: `
          <div class="text-start case-details-modal">
            <div class="case-details-section">
              <h6 class="case-details-title">Case Information</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Type:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.type || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Status:</span> <span class="case-detail-value">${this.escapeHtml(this.statusLabel(fullCase.status))}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Client:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.clientName || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Phone:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.clientPhone || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">MSISDN:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.msisdn || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Offer:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.offre || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Pack:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.desPack || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Comment:</span> <span class="case-detail-value">${this.escapeHtml(fullCase.commentaire || '-')}</span></div></div>
                <div class="col-md-12"><div class="case-detail-item"><span class="case-detail-label">Location:</span> <span class="case-detail-value">${this.escapeHtml(`${fullCase.localite || '-'}, ${fullCase.delegation || '-'}, ${fullCase.gouvernorat || '-'}`)}</span></div></div>
              </div>
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">Assignment Chain</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Owner ZM:</span> <span class="case-detail-value">${this.escapeHtml(this.ownerZmLabel(fullCase))}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Supervisor STT:</span> <span class="case-detail-value">${this.escapeHtml(this.personLabel(fullCase.sttName, fullCase.sttEmail))}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">TECH:</span> <span class="case-detail-value">${this.escapeHtml(this.personLabel(fullCase.techName, fullCase.techEmail))}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Execution mode:</span> <span class="case-detail-value">${this.escapeHtml(this.executionModeLabel(fullCase))}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Active executor:</span> <span class="case-detail-value">${this.escapeHtml(this.executorPersonLabel(fullCase))}</span></div></div>
              </div>
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">RDV (Appointment)</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Joignable:</span> <span class="case-detail-value">${rdv.joignable == null ? '-' : rdv.joignable ? '&#10003; Yes' : '&#10007; No'}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Date:</span> <span class="case-detail-value">${this.escapeHtml(this.asDateLabel(rdv.datePriseRdv))}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Abandon:</span> <span class="case-detail-value">${rdv.abandon == null ? '-' : rdv.abandon ? '&#10003; Yes' : '&#10007; No'}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Cause Injoignabilite:</span> <span class="case-detail-value">${this.escapeHtml(rdv.causeInjoignabilite || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Cause Abandon:</span> <span class="case-detail-value">${this.escapeHtml(rdv.causeAbandon || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Detail:</span> <span class="case-detail-value">${this.escapeHtml(rdv.detail || '-')}</span></div></div>
                <div class="col-md-6"><div class="case-detail-item"><span class="case-detail-label">Comment:</span> <span class="case-detail-value">${this.escapeHtml(rdv.cmtRdv || '-')}</span></div></div>
              </div>
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">Work</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Result:</span> <span class="case-detail-value">${this.escapeHtml(work.repTravauxStt || '-')}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Date End:</span> <span class="case-detail-value">${this.escapeHtml(this.asDateLabel(work.dateFinTrv))}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Comment:</span> <span class="case-detail-value">${this.escapeHtml(work.cmtTrvStt || '-')}</span></div></div>
              </div>
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">Work GPS Location</h6>
              ${this.renderWorkLocationHtml(work)}
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">Work Proof</h6>
              ${this.renderProofsHtml(proofs)}
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">Technical Metrics</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-3"><div class="case-detail-item"><span class="case-detail-label">Cable:</span> <span class="case-detail-value">${this.asMetric(metrics.metrageCable)}</span></div></div>
                <div class="col-md-3"><div class="case-detail-item"><span class="case-detail-label">PV:</span> <span class="case-detail-value">${this.asMetric(metrics.nombrePv)}</span></div></div>
                <div class="col-md-3"><div class="case-detail-item"><span class="case-detail-label">DL:</span> <span class="case-detail-value">${this.asMetric(metrics.debitDl)}</span></div></div>
                <div class="col-md-3"><div class="case-detail-item"><span class="case-detail-label">UL:</span> <span class="case-detail-value">${this.asMetric(metrics.debitUl)}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">RSRP:</span> <span class="case-detail-value">${this.asMetric(metrics.rsrp)}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">RSRQ:</span> <span class="case-detail-value">${this.asMetric(metrics.rsrq)}</span></div></div>
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">SINR:</span> <span class="case-detail-value">${this.asMetric(metrics.sinr)}</span></div></div>
              </div>
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">ZM Validation</h6>
              <div class="row g-3 mb-3">
                <div class="col-md-4"><div class="case-detail-item"><span class="case-detail-label">Approved:</span> <span class="case-detail-value">${validation.approved == null ? '-' : validation.approved ? '&#10003; Yes' : '&#10007; No'}</span></div></div>
                <div class="col-md-8"><div class="case-detail-item"><span class="case-detail-label">Comment:</span> <span class="case-detail-value">${this.escapeHtml(validation.comment || '-')}</span></div></div>
              </div>
            </div>

            <div class="case-details-section">
              <h6 class="case-details-title">Case Timeline</h6>
              ${this.renderTimelineHtml(timeline)}
            </div>
          </div>
        `,
        denyButtonText: 'Download',
        cancelButtonText: 'Download',
        showDenyButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#e30613',
        denyButtonColor: '#1b9aaa',
        preConfirm: () => {
          return true;
        },
        preDeny: () => {
          void this.onCaseDetailsDownload(fullCase);
          return false;
        }
      });
    } catch (err: any) {
      console.error('Failed to load case details:', err);
      const message = err?.error?.message ?? 'Failed to load case details';
      await this.swal.error('Details unavailable', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  async onCaseDetailsDownload(caseData: CaseResponse): Promise<void> {
    try {
      const response = await firstValueFrom(this.casesService.downloadCasePdf(caseData.id));
      const blob = response.body;

      if (!blob) {
        throw new Error('Empty PDF response');
      }

      const filename = this.extractDownloadFilename(response.headers.get('content-disposition'))
        ?? this.buildCasePdfFilename(caseData);

      this.saveBlob(blob, filename);
    } catch (err: any) {
      console.error('Failed to download case PDF:', err);
      const message = err?.error?.message ?? err?.message ?? 'Failed to download case report';
      await this.swal.error('Download failed', message);
    }
  }

  private buildCasePdfFilename(caseData: CaseResponse): string {
    const crmCase = (caseData.crmCase ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');

    return `case-${crmCase || caseData.id}.pdf`;
  }

  private extractDownloadFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const plainMatch = /filename="([^"]+)"|filename=([^;]+)/i.exec(contentDisposition);
    const raw = plainMatch?.[1] ?? plainMatch?.[2];
    return raw?.trim() || null;
  }

  private saveBlob(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  private async runAction(caseId: string, action: () => any, successTitle: string): Promise<void> {
    this.actionLoadingCaseId = caseId;

    try {
      await firstValueFrom(action());
      await this.swal.success(successTitle, 'Operation completed successfully.');
      this.loadCases();
      this.loadPerformance();
    } catch (err: any) {
      console.error('Case action failed:', err);
      const message = err?.error?.message ?? 'Operation failed';
      await this.swal.error('Request failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  private canAccessCase(item: CaseResponse): boolean {
    if (this.isAdmin) return true;
    if (this.isZm) return this.isCaseOwnedByZm(item);
    if (this.isStt) return this.isCaseOwnedByStt(item);
    if (this.isTech) return this.isCaseOwnedByTech(item);
    return false;
  }

  private get isAdmin(): boolean {
    return this.currentRole === 'ROLE_ADMIN';
  }

  private get isZm(): boolean {
    return this.currentRole === 'ROLE_ZM';
  }

  private get isStt(): boolean {
    return this.currentRole === 'ROLE_STT';
  }

  private get isTech(): boolean {
    return this.currentRole === 'ROLE_TECH';
  }

  private get currentUserEmail(): string {
    return (this.authStore.user()?.email ?? '').trim().toLowerCase();
  }

  hasSttSelfExecution(item: CaseResponse): boolean {
    return item.executionMode === 'STT_SELF_EXECUTION'
      && item.executorRole === 'STT'
      && !!item.executorId
      && item.executorId === item.sttId;
  }

  hasTechExecution(item: CaseResponse): boolean {
    if (!item.techId) {
      return false;
    }

    if (!item.executionMode && !item.executorRole && !item.executorId) {
      return true;
    }

    return item.executionMode === 'TECH_EXECUTION'
      && item.executorRole === 'TECH'
      && !!item.executorId
      && item.executorId === item.techId;
  }

  isSttExecutor(item: CaseResponse): boolean {
    return this.sameEmail(item.sttEmail, this.currentUserEmail) && this.hasSttSelfExecution(item);
  }

  isTechExecutor(item: CaseResponse): boolean {
    return this.sameEmail(item.techEmail, this.currentUserEmail) && this.hasTechExecution(item);
  }

  executionModeLabel(item: CaseResponse): string {
    if (this.hasSttSelfExecution(item)) {
      return 'STT self execution';
    }

    if (this.hasTechExecution(item)) {
      return 'Technician execution';
    }

    return 'Execution not selected';
  }

  ownerZmCompactLabel(item: CaseResponse): string {
    return this.compactPersonLabel(item.ownerZmName ?? item.zmName, item.zmEmail);
  }

  sttDisplayName(item: CaseResponse): string {
    return this.compactPersonLabel(item.sttName, item.sttEmail);
  }

  techDisplayName(item: CaseResponse): string {
    return this.compactPersonLabel(item.techName, item.techEmail);
  }

  executorDisplayName(item: CaseResponse): string {
    if (this.hasSttSelfExecution(item)) {
      return this.compactPersonLabel(item.sttName, item.sttEmail);
    }

    if (this.hasTechExecution(item)) {
      return this.compactPersonLabel(item.techName, item.techEmail);
    }

    return '-';
  }

  executorPersonLabel(item: CaseResponse): string {
    if (this.hasSttSelfExecution(item)) {
      return this.personLabel(item.sttName, item.sttEmail);
    }

    if (this.hasTechExecution(item)) {
      return this.personLabel(item.techName, item.techEmail);
    }

    return '-';
  }

  private openSttExecutionWorkspace(caseId: string, panel: 'details' | 'rdv' | 'work'): Promise<boolean> {
    return this.router.navigate(['/stt/cases/execution'], {
      queryParams: {
        caseId,
        panel,
        focus: panel === 'work' ? 'work' : panel === 'rdv' ? 'rdv' : 'all'
      }
    });
  }

  private isCaseOwnedByZm(item: CaseResponse): boolean {
    return this.sameEmail(item.zmEmail, this.currentUserEmail);
  }

  private isCaseOwnedByStt(item: CaseResponse): boolean {
    return this.sameEmail(item.sttEmail, this.currentUserEmail);
  }

  private isCaseOwnedByTech(item: CaseResponse): boolean {
    return this.sameEmail(item.techEmail, this.currentUserEmail);
  }

  private sameEmail(left?: string | null, right?: string | null): boolean {
    return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
  }

  private async loadAssignableStts(item: CaseResponse): Promise<AssignableUser[]> {
    const users = await firstValueFrom(this.userService.getMySttsForZm());
    return (users ?? [])
      .filter((u) => this.userCoversGovernorate(u.coveredGovernorates, item.gouvernorat))
      .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  private async loadAssignableTechs(): Promise<AssignableUser[]> {
    const myTechs = await firstValueFrom(this.sttTechApi.getMyTechnicians());
    return (myTechs ?? [])
      .filter((u: TechnicianListItem) => u.status === 'APPROVED' && u.enabled)
      .map((u: TechnicianListItem) => ({ id: u.id, fullName: u.fullName, email: u.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  private extractRdv(item: CaseResponse): CaseRdv {
    if (item.rdv) return item.rdv;

    return {
      joignable: item.joignable,
      datePriseRdv: item.datePriseRdv,
      causeInjoignabilite: item.causeInjoignabilite,
      detail: item.detail,
      cmtRdv: item.cmtRdv,
      abandon: item.abandon,
      causeAbandon: item.causeAbandon
    };
  }

  private extractWork(item: CaseResponse): CaseWork {
    if (item.work) return item.work;

    return {
      repTravauxStt: item.repTravauxStt,
      dateFinTrv: item.dateFinTrv,
      cmtTrvStt: item.cmtTrvStt
    };
  }

  private extractMetrics(item: CaseResponse): CaseMetrics {
    if (item.metrics) return item.metrics;

    return {
      metrageCable: item.metrageCable,
      nombrePv: item.nombrePv,
      debitDl: item.debitDl,
      debitUl: item.debitUl,
      rsrp: item.rsrp,
      rsrq: item.rsrq,
      sinr: item.sinr
    };
  }

  private extractValidation(item: CaseResponse): CaseZmValidation {
    if (item.zmValidation) return item.zmValidation;

    return {
      approved: item.repZm === 'APPROVED' ? true : item.repZm === 'REJECTED' ? false : null,
      comment: item.commentZm
    };
  }

  private extractProofs(item: CaseResponse): CaseProofFile[] {
    return [...(item.workProofs ?? [])];
  }

  private extractTimeline(item: CaseResponse): CaseTimelineEvent[] {
    const timeline = item.timeline ?? [];

    return [...timeline].sort((left, right) => {
      const leftMs = Date.parse(left.occurredAt ?? '');
      const rightMs = Date.parse(right.occurredAt ?? '');

      return (Number.isNaN(rightMs) ? 0 : rightMs) - (Number.isNaN(leftMs) ? 0 : leftMs);
    });
  }

  private renderTimelineHtml(timeline: CaseTimelineEvent[]): string {
    if (!timeline.length) {
      return '<div class="text-body-secondary small">No timeline events yet.</div>';
    }

    const rows = timeline.slice(0, 12).map((event) => {
      const occurredAt = this.escapeHtml(this.asDateLabel(event.occurredAt));
      const title = this.escapeHtml(event.title ?? event.eventType ?? 'Event');
      const details = this.escapeHtml(event.details ?? '-');
      const actor = this.escapeHtml(event.actor ?? 'SYSTEM');
      const stateFrom = event.previousStatus ? this.statusLabel(event.previousStatus) : '-';
      const stateTo = event.newStatus ? this.statusLabel(event.newStatus) : '-';

      return `
        <div class="case-timeline__item mb-2 pb-2 border-bottom">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold small">${title}</div>
              <div class="x-small text-body-secondary">${details}</div>
            </div>
            <span class="x-small text-body-secondary">${occurredAt}</span>
          </div>
          <div class="x-small text-body-secondary mt-1">
            Actor: ${actor} • State: ${this.escapeHtml(stateFrom)} -> ${this.escapeHtml(stateTo)}
          </div>
        </div>
      `;
    }).join('');

    return `<div class="case-timeline">${rows}</div>`;
  }

  private renderProofsHtml(proofs: CaseProofFile[]): string {
    if (!proofs.length) {
      return '<div class="text-body-secondary small">No proof image uploaded yet.</div>';
    }

    const rows = proofs.map((proof) => {
      const filename = this.escapeHtml(proof.originalFilename || 'Proof image');
      const uploadedAt = this.escapeHtml(this.asDateLabel(proof.createdAt));
      const uploadedBy = this.escapeHtml(proof.uploadedBy || '-');
      const imageHref = this.escapeHtml(proof.viewUrl || proof.downloadUrl || '#');
      const mapHref = this.buildMapLink(proof.locationLatitude, proof.locationLongitude);
      const source = this.escapeHtml(this.proofSourceLabel(proof.captureSource));
      const location = this.escapeHtml(this.coordinateLabel(proof.locationLatitude, proof.locationLongitude));
      const capturedAt = this.escapeHtml(this.asDateLabel(proof.locationCapturedAt));
      const accuracy = this.escapeHtml(this.accuracyLabel(proof.locationAccuracyMeters));

      return `
        <div class="d-flex gap-3 align-items-start border rounded-3 p-2 mb-2">
          <a
            href="${imageHref}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-shrink-0"
          >
            <img
              src="${imageHref}"
              alt="${filename}"
              style="width: 112px; height: 84px; object-fit: cover; border-radius: 0.75rem;"
            />
          </a>
          <div class="text-start">
            <div class="fw-semibold text-body">${filename}</div>
            <div class="small text-body-secondary">Uploaded: ${uploadedAt}</div>
            <div class="small text-body-secondary">By: ${uploadedBy}</div>
            <div class="small text-body-secondary">Source: ${source || '-'}</div>
            <div class="small text-body-secondary">GPS: ${location}</div>
            <div class="small text-body-secondary">Captured at: ${capturedAt}</div>
            <div class="small text-body-secondary">Accuracy: ${accuracy}</div>
            <div class="d-flex gap-2 flex-wrap mt-2">
              <a
                href="${imageHref}"
                target="_blank"
                rel="noopener noreferrer"
                class="small text-primary text-decoration-none"
              >
                Open image
              </a>
              ${mapHref ? `
                <a
                  href="${this.escapeHtml(mapHref)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="small text-primary text-decoration-none"
                >
                  Open map
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `<div class="case-proof-list">${rows}</div>`;
  }

  private renderWorkLocationHtml(work: CaseWork): string {
    const mapHref = this.buildMapLink(work.locationLatitude, work.locationLongitude);
    const location = this.escapeHtml(this.coordinateLabel(work.locationLatitude, work.locationLongitude));
    const capturedAt = this.escapeHtml(this.asDateLabel(work.locationCapturedAt));
    const accuracy = this.escapeHtml(this.accuracyLabel(work.locationAccuracyMeters));

    if (location === '-') {
      return '<div class="text-body-secondary small">No work submission GPS saved yet.</div>';
    }

    return `
      <div class="row g-2 mb-2">
        <div class="col-md-5"><strong>Coordinates:</strong> ${location}</div>
        <div class="col-md-4"><strong>Captured at:</strong> ${capturedAt}</div>
        <div class="col-md-3"><strong>Accuracy:</strong> ${accuracy}</div>
      </div>
      ${mapHref ? `
        <a
          href="${this.escapeHtml(mapHref)}"
          target="_blank"
          rel="noopener noreferrer"
          class="small text-primary text-decoration-none"
        >
          Open work location on map
        </a>
      ` : ''}
    `;
  }

  private personLabel(name?: string | null, email?: string | null): string {
    const safeName = (name ?? '').trim();
    const safeEmail = (email ?? '').trim();
    if (!safeName && !safeEmail) return '-';
    if (safeName && safeEmail) return `${safeName} (${safeEmail})`;
    return safeName || safeEmail;
  }

  private compactPersonLabel(name?: string | null, email?: string | null): string {
    const safeName = (name ?? '').trim();
    if (safeName) {
      return safeName;
    }

    const safeEmail = (email ?? '').trim();
    if (!safeEmail) {
      return '-';
    }

    const localPart = safeEmail.split('@')[0]?.trim();
    return localPart || safeEmail;
  }

  private ownerZmId(item: CaseResponse): string {
    return (item.ownerZmId ?? item.zmId ?? '').trim();
  }

  ownerZmDisplayName(item: CaseResponse): string {
    return (item.ownerZmName ?? item.zmName ?? item.zmEmail ?? '').trim();
  }

  private ownerZmLabel(item: CaseResponse): string {
    return this.personLabel(item.ownerZmName ?? item.zmName, item.zmEmail);
  }

  private userCoversGovernorate(governorates?: string[] | null, governorate?: string | null): boolean {
    const target = (governorate ?? '').trim();
    if (!target) {
      return false;
    }

    return (governorates ?? []).some((value) => (value ?? '').trim() === target);
  }

  initialsFor(name?: string | null, email?: string | null): string {
    const source = (name ?? '').trim() || (email ?? '').trim();
    if (!source) return 'NA';

    const words = source.split(/[\s@._-]+/).filter(Boolean);
    if (!words.length) return 'NA';

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }

  private asMetric(value?: number | null): string {
    return value == null ? '-' : String(value);
  }

  private proofSourceLabel(source?: string | null): string {
    if (source === 'gallery') {
      return 'Gallery';
    }

    if (source === 'camera') {
      return 'Camera';
    }

    return '-';
  }

  private buildMapLink(latitude?: number | string | null, longitude?: number | string | null): string | null {
    const normalizedLatitude = this.parseCoordinate(latitude);
    const normalizedLongitude = this.parseCoordinate(longitude);

    if (normalizedLatitude == null || normalizedLongitude == null) {
      return null;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${normalizedLatitude},${normalizedLongitude}`)}`;
  }

  private coordinateLabel(latitude?: number | string | null, longitude?: number | string | null): string {
    const normalizedLatitude = this.parseCoordinate(latitude);
    const normalizedLongitude = this.parseCoordinate(longitude);

    if (normalizedLatitude == null || normalizedLongitude == null) {
      return '-';
    }

    return `${normalizedLatitude.toFixed(6)}, ${normalizedLongitude.toFixed(6)}`;
  }

  private accuracyLabel(value?: number | null): string {
    if (value == null || !Number.isFinite(value)) {
      return '-';
    }

    return `±${Math.round(value)} m`;
  }

  private parseCoordinate(value?: number | string | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private formatMinutes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0m';
    }

    const rounded = Math.round(value * 10) / 10;
    return `${rounded}m`;
  }

  private formatSeconds(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return '<1m';
    }

    const safeSeconds = Math.floor(totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m`;
    }

    return '<1m';
  }

  private resolveLiveSla(item: CaseResponse): {
    status: SlaStatus | null;
    progressPercent: number;
    remainingSeconds: number | null;
    overdueSeconds: number;
    responseDurationSeconds: number | null;
  } {
    const fallback = this.fallbackSla(item.slaTracking);
    const sla = item.slaTracking;
    if (!sla) {
      return fallback;
    }

    const baseStatus = sla.status ?? null;
    if (baseStatus === 'COMPLETED_ON_TIME' || baseStatus === 'COMPLETED_LATE') {
      return fallback;
    }

    const startedMs = this.toEpochMs(sla.startedAt);
    const deadlineMs = this.toEpochMs(sla.deadlineAt);

    if (startedMs == null || deadlineMs == null || deadlineMs <= startedMs) {
      return fallback;
    }

    const durationMs = Math.max(1000, deadlineMs - startedMs);
    const remainingMs = deadlineMs - this.nowEpochMs;
    const clampedRemainingMs = Math.max(0, remainingMs);
    const warningThresholdPercent = sla.warningThresholdPercent ?? this.warningThresholdPercent;

    const remainingSeconds = Math.floor(clampedRemainingMs / 1000);
    const overdueSeconds = Math.floor(Math.max(0, -remainingMs) / 1000);
    const progressPercent = Math.max(0, Math.min(100, (clampedRemainingMs / durationMs) * 100));

    let status: SlaStatus = 'ON_TRACK';
    if (progressPercent <= 0) {
      status = 'BREACHED';
    } else if (progressPercent <= warningThresholdPercent) {
      status = 'WARNING';
    }

    return {
      status,
      progressPercent,
      remainingSeconds,
      overdueSeconds,
      responseDurationSeconds: sla.responseDurationSeconds ?? null
    };
  }

  private fallbackSla(sla?: CaseSlaTracking | null): {
    status: SlaStatus | null;
    progressPercent: number;
    remainingSeconds: number | null;
    overdueSeconds: number;
    responseDurationSeconds: number | null;
  } {
    const status = sla?.status ?? null;
    const progressPercent = Math.max(0, Math.min(100, sla?.progressPercent ?? 0));
    const remainingSeconds = sla?.remainingSeconds ?? null;

    return {
      status,
      progressPercent,
      remainingSeconds,
      overdueSeconds: 0,
      responseDurationSeconds: sla?.responseDurationSeconds ?? null
    };
  }

  private toEpochMs(value?: string | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private startLiveTicker(): void {
    this.stopLiveTicker();

    this.zone.runOutsideAngular(() => {
      this.liveTickHandle = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }

        this.zone.run(() => {
          this.nowEpochMs = Date.now();
        });
      }, ActivationCasesListComponent.LIVE_TICK_MS);
    });
  }

  private stopLiveTicker(): void {
    if (this.liveTickHandle != null) {
      clearInterval(this.liveTickHandle);
      this.liveTickHandle = null;
    }
  }

  private startBackendResync(): void {
    this.stopBackendResync();

    this.zone.runOutsideAngular(() => {
      this.resyncHandle = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }

        if (this.loading || this.performanceLoading || this.actionLoadingCaseId != null) {
          return;
        }

        this.zone.run(() => {
          this.loadCases();
          this.loadPerformance();
        });
      }, ActivationCasesListComponent.BACKEND_RESYNC_MS);
    });
  }

  private stopBackendResync(): void {
    if (this.resyncHandle != null) {
      clearInterval(this.resyncHandle);
      this.resyncHandle = null;
    }
  }

  private asDateLabel(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  private toDateTimeLocal(value?: string | null): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private toIso(value: string): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toISOString();
  }

  private toNullable(value?: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private toMaybeNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toInputNumber(value?: number | null): string {
    return value == null ? '' : String(value);
  }

  private getElementValue(id: string): string {
    const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    return element?.value ?? '';
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
