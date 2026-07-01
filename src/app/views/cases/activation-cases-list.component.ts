import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { IconDirective } from '@coreui/icons-angular';
import { CaseDetailComponent } from '../../shared/modals/case-detail/case-detail.component';
import { AssignUserModalComponent } from '../../shared/modals/assign-user-modal/assign-user-modal.component';
import { AuthStore } from '../../core/auth/auth.store';
import { Role } from '../../core/auth/models/roles.type';
import { SwalService } from '../../core/ui/swal.service';
import { TechnicianListItem } from '../../core/stt/models/technician-list-item.model';
import { SttTechnicianApiService } from '../../core/stt/stt-technician-api.service';
import { UserService } from '../../core/users/user.service';
import { CasesService, CaseBoardQuery, CaseBoardSummaryResponse } from '../../core/cases/cases.service';
import {
  CASE_STATUS_UI,
  CaseDiagnosis,
  CaseMetrics,
  CaseProofFile,
  CaseRdv,
  CaseResponse,
  CaseResolution,
  CaseSlaTracking,
  CaseStatus,
  CaseTimelineEvent,
  CaseType,
  CaseWork,
  CaseZmValidation,
  ComplaintCategory,
  ComplaintDiagnosisRequest,
  CompleteWorkRequest,
  PerformanceSummaryResponse,
  ReopenComplaintRequest,
  SetRdvRequest,
  SlaStatus,
  ValidateZmRequest
} from '../../core/cases/models/case.model';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { NotificationItem } from '../../core/notifications/models/notification.model';
import { governoratesMatch } from '../../core/shared/tunisia-governorates';

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
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective, CaseDetailComponent, AssignUserModalComponent],
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
  private readonly route = inject(ActivatedRoute);

  cases: CaseResponse[] = [];
  loading = false;
  performanceLoading = false;
  actionLoadingCaseId: string | null = null;
  error: string | null = null;

  // Case detail modal state
  caseDetailVisible = false;
  caseDetailData: CaseResponse | null = null;

  // Assign user modal state
  assignModalVisible = false;
  assignModalTitle = '';
  assignModalDescription = '';
  assignModalUsers: AssignableUser[] = [];
  assignModalCurrentId: string | null = null;
  assignModalConfirmText = 'Assign';
  assignModalLoading = false;
  private assignModalMode: 'stt' | 'tech' = 'stt';
  private assignModalPendingCase: CaseResponse | null = null;

  myPerformance: PerformanceSummaryResponse | null = null;
  teamTechPerformance: PerformanceSummaryResponse[] = [];

  searchTerm = '';
  selectedStatus = '';
  selectedGouvernorat = '';
  selectedDelegation = '';

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [5, 10, 20];

  // Server-driven pagination state.
  totalElements = 0;
  jumpPageValue: number | null = null;
  summary: CaseBoardSummaryResponse | null = null;

  // Caches so re-opening a detail or an assign modal is instant (no repeat network calls).
  private readonly detailCache = new Map<string, CaseResponse>();
  private cachedSttUsers: Array<{ id: string; fullName: string; email: string; coveredGovernorates?: string[] | null }> | null = null;
  private cachedTechs: AssignableUser[] | null = null;

  // Debounced filter pipeline (search typing + dropdown changes).
  private readonly filterChange$ = new Subject<void>();
  private filterSub?: Subscription;
  private loadSeq = 0;

  private nowEpochMs = Date.now();
  private liveTickHandle: ReturnType<typeof setInterval> | null = null;
  private resyncHandle: ReturnType<typeof setInterval> | null = null;
  private readonly warningThresholdPercent = 50;

  ngOnInit(): void {
    // Optional deep-link from the ZM dashboard: pre-select a status filter (e.g. ?status=WORK_DONE).
    // Non-breaking — absent param leaves the board unfiltered as before.
    const initialStatus = this.route.snapshot.queryParamMap.get('status');
    if (initialStatus) {
      this.selectedStatus = initialStatus;
    }

    // Filter changes (search typing + dropdowns) are debounced, reset to page 1, and reload from the server.
    this.filterSub = this.filterChange$.pipe(debounceTime(300)).subscribe(() => {
      this.currentPage = 1;
      this.loadCases();
      this.loadSummary();
    });

    this.loadCases();
    this.loadSummary();
    this.loadPerformance();
    this.startLiveTicker();
    this.startBackendResync();
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
    this.stopLiveTicker();
    this.stopBackendResync();
  }

  get currentRole(): Role | null {
    return this.authStore.role();
  }

  get caseType(): CaseType {
    return this.resolveCaseTypeFromRoute() ?? 'ACTIVATION';
  }

  get isComplaintModule(): boolean {
    return this.caseType === 'PLAINTE';
  }

  /** PLT/RES discriminator for the field-import case boards (both persist as type=PLAINTE). */
  get caseModule(): 'PLT' | 'RES' | null {
    return this.resolveCaseModuleFromRoute();
  }

  get isResModule(): boolean {
    return this.caseModule === 'RES';
  }

  /** Module filter for performance metrics so each board's stats are scoped to its own cases. */
  get performanceModule(): 'PLT' | 'RES' | undefined {
    if (this.caseType !== 'PLAINTE') {
      return undefined;
    }
    return this.isResModule ? 'RES' : 'PLT';
  }

  get caseBoardLabel(): string {
    if (this.isResModule) return 'Resiliation';
    return this.isComplaintModule ? 'Complaint' : 'Activation';
  }

  get caseBoardLabelPlural(): string {
    if (this.isResModule) return 'Resiliation cases';
    return this.isComplaintModule ? 'Complaints' : 'Activation cases';
  }

  get statusOptions(): Array<{ value: '' | CaseStatus; label: string }> {
    if (this.isComplaintModule) {
      return [
        { value: '', label: 'All statuses' },
        { value: 'CREATED', label: 'Created' },
        { value: 'ASSIGNED_TO_ZM', label: 'Assigned to ZM' },
        { value: 'ASSIGNED_TO_STT', label: 'Assigned to STT' },
        { value: 'DIAGNOSIS_STEP', label: 'Diagnosis step' },
        { value: 'ASSIGNED_TO_TECH', label: 'Assigned to TECH' },
        { value: 'NOT_REACHABLE', label: 'Not reachable' },
        { value: 'RESOLUTION_SUBMITTED', label: 'Resolution submitted' },
        { value: 'RETURNED_TO_STT', label: 'Returned to STT' },
        { value: 'ESCALATED', label: 'Escalated' },
        { value: 'REOPENED', label: 'Reopened' },
        { value: 'VALIDATED_BY_ZM', label: 'Validated by ZM' },
        { value: 'CLOSED', label: 'Closed' }
      ];
    }

    return [
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
  }

  get canCreateCase(): boolean {
    return this.currentRole === 'ROLE_ADMIN' && !this.isComplaintModule;
  }

  get createRoute(): string {
    return '/admin/cases/activation/new';
  }

  get workspaceTitle(): string {
    if (this.isResModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'Ooredoo Resiliation Command Center';
        case 'ROLE_ZM':
          return 'Zone Resiliation Oversight';
        case 'ROLE_STT':
          return 'Resiliation Execution Control';
        case 'ROLE_TECH':
          return 'Field Resiliation Queue';
        default:
          return 'Resiliation Case Management';
      }
    }

    if (this.isComplaintModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'Ooredoo Complaint Command Center';
        case 'ROLE_ZM':
          return 'Zone Complaint Oversight';
        case 'ROLE_STT':
          return 'Complaint Resolution Control';
        case 'ROLE_TECH':
          return 'Field Complaint Queue';
        default:
          return 'Complaint Case Management';
      }
    }

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
    if (this.isResModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'Drive imported RES resiliation orders through the same assignment, execution, and validation discipline as complaints.';
        case 'ROLE_ZM':
          return 'Supervise resiliation ownership, STT execution, and final validation across your zone.';
        case 'ROLE_STT':
          return 'Manage resiliation technician decisions and resolution submission from one operational board.';
        case 'ROLE_TECH':
          return 'Review resiliation interventions, proof capture, and field execution progress in the same mobile workspace.';
        default:
          return 'Telecom resiliation workflow: assignment, execution, work, validation, and closure.';
      }
    }

    if (this.isComplaintModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'Turn imported CRM complaints into a controlled resolution workflow with the same assignment and validation discipline.';
        case 'ROLE_ZM':
          return 'Supervise complaint ownership, diagnosis outcomes, and final validation across your zone.';
        case 'ROLE_STT':
          return 'Manage complaint diagnosis, technician decisions, and resolution submission without leaving the operational board.';
        case 'ROLE_TECH':
          return 'Review complaint interventions, proof capture, and field execution progress in the same mobile workspace.';
        default:
          return 'Telecom complaint workflow: assignment, RDV, diagnosis, work, validation, and closure.';
      }
    }

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

  // The server already scopes/filters/paginates, so these are simply the current page of items.
  get accessibleCases(): CaseResponse[] {
    return this.cases;
  }

  get filteredCases(): CaseResponse[] {
    return this.cases;
  }

  get paginatedCases(): CaseResponse[] {
    return this.cases;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalElements / this.pageSize));
  }

  /** Compact page list: 1 … (current±2) … last, with '...' markers for the gaps. */
  get visiblePages(): Array<number | '...'> {
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const delta = 2;
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);
    const pages: Array<number | '...'> = [1];

    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push('...');
    pages.push(total);

    return pages;
  }

  get gouvernoratOptions(): string[] {
    return this.summary?.governorates ?? [];
  }

  get delegationOptions(): string[] {
    return this.summary?.delegations ?? [];
  }

  get statsCards(): StatCard[] {
    const s = this.summary;

    return [
      { label: this.isResModule ? 'Total resiliations' : this.isComplaintModule ? 'Total complaints' : 'Total Cases', value: s?.totalCases ?? 0, icon: 'cilDescription', className: 'stat-neutral' },
      { label: 'Owned by ZM', value: s?.ownedByZm ?? 0, icon: 'cilUser', className: 'stat-primary' },
      { label: 'Assigned to STT', value: s?.assignedStt ?? 0, icon: 'cilPeople', className: 'stat-info' },
      { label: 'Assigned to TECH', value: s?.assignedTech ?? 0, icon: 'cilUserFollow', className: 'stat-warning' },
      { label: 'SLA Warning', value: s?.slaWarning ?? 0, icon: 'cilWarning', className: 'stat-warning' },
      { label: 'SLA Breached', value: s?.slaBreached ?? 0, icon: 'cilBan', className: 'stat-danger' },
      { label: this.isComplaintModule ? 'Resolution ready' : 'Work Done', value: s?.workDone ?? 0, icon: 'cilTask', className: 'stat-success' },
      { label: 'Closed', value: s?.closed ?? 0, icon: 'cilLockLocked', className: 'stat-dark' }
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
      .filter((item) => this.notificationMatchesCurrentBoard(item))
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
    // The current page is already paginated server-side — just prioritise it for the mobile view.
    return [...this.cases].sort((left, right) => this.mobileSttPriority(left) - this.mobileSttPriority(right));
  }

  loadCases(): void {
    this.loading = true;
    this.error = null;
    // Sequence guard: only the latest in-flight request applies its result (avoids dropped
    // page clicks and out-of-order responses when interactions overlap).
    const seq = ++this.loadSeq;

    this.casesService.getCasesPage(this.boardQuery())
      .pipe(
        finalize(() => {
          if (seq === this.loadSeq) {
            this.loading = false;
            this.zone.run(() => this.cdr.detectChanges());
          }
        })
      )
      .subscribe({
        next: (res) => {
          if (seq !== this.loadSeq) return;
          this.cases = res.items ?? [];
          this.totalElements = res.totalElements ?? 0;
          // Clamp if the active page fell out of range (e.g. filtering shrank the set).
          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
          }
        },
        error: (err) => {
          if (seq !== this.loadSeq) return;
          console.error(`Failed to load ${this.caseType.toLowerCase()} cases:`, err);
          this.error = err?.error?.message ?? `Failed to load ${this.caseBoardLabel.toLowerCase()} cases`;
        }
      });
  }

  loadSummary(): void {
    this.casesService.getCasesSummary(this.boardQuery())
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.zone.run(() => this.cdr.detectChanges());
        },
        error: (err) => {
          console.error('Failed to load board summary:', err);
        }
      });
  }

  private boardQuery(): CaseBoardQuery {
    return {
      type: this.caseType,
      caseModule: this.performanceModule,
      page: this.currentPage - 1,
      size: this.pageSize,
      search: this.searchTerm,
      status: this.selectedStatus || undefined,
      gouvernorat: this.selectedGouvernorat || undefined,
      delegation: this.selectedDelegation || undefined
    };
  }

  loadPerformance(): void {
    if (this.performanceLoading) {
      return;
    }

    this.performanceLoading = true;

    this.casesService.getMyPerformance(this.caseType, this.performanceModule)
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
      this.casesService.getTechPerformance(this.caseType, this.performanceModule).subscribe({
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
    // Debounced → resets to page 1 and reloads the page + summary from the server.
    this.filterChange$.next();
  }

  setPage(page: number): void {
    const target = Math.min(Math.max(1, Math.trunc(page)), this.totalPages);
    if (target === this.currentPage) return;
    this.currentPage = target;
    this.loadCases();
  }

  onJumpToPage(): void {
    if (this.jumpPageValue == null || Number.isNaN(this.jumpPageValue)) return;
    this.setPage(this.jumpPageValue);
    this.jumpPageValue = null;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedGouvernorat = '';
    this.selectedDelegation = '';
    this.currentPage = 1;
    this.loadCases();
    this.loadSummary();
  }

  rangeLabel(): string {
    if (this.totalElements === 0) {
      return '0 of 0';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalElements);
    return `${start}-${end} of ${this.totalElements}`;
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

    if (item.type === 'PLAINTE') {
      switch (item.status) {
        case 'DIAGNOSIS_STEP':
          return remaining - 5000 + executionBoost;
        case 'RETURNED_TO_STT':
        case 'REOPENED':
          return remaining - 3500 + executionBoost;
        case 'ASSIGNED_TO_STT':
          return remaining - 2500 + executionBoost;
        case 'ASSIGNED_TO_TECH':
          return remaining - 1500 + executionBoost;
        case 'NOT_REACHABLE':
          return remaining - 1000 + executionBoost;
        default:
          return remaining + executionBoost;
      }
    }

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

    if (item.type === 'PLAINTE') {
      switch (item.status) {
        case 'ASSIGNED_TO_TECH':
          return remaining - 3000;
        case 'RETURNED_TO_STT':
        case 'REOPENED':
          return remaining - 1500;
        case 'DIAGNOSIS_STEP':
        case 'NOT_REACHABLE':
          return remaining - 500;
        default:
          return remaining;
      }
    }

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
    if (item.type === 'PLAINTE') {
      return ['ASSIGNED_TO_ZM', 'ASSIGNED_TO_STT', 'RETURNED_TO_STT', 'REOPENED', 'ESCALATED'].includes(item.status);
    }

    return ['ASSIGNED_TO_ZM', 'ASSIGNED_TO_STT'].includes(item.status);
  }

  canAssignTech(item: CaseResponse): boolean {
    if (!this.isStt || !this.isCaseOwnedByStt(item)) return false;

    if (item.type === 'PLAINTE') {
      if (this.isImportedFieldComplaint(item)) {
        // PLT/RES imported complaints follow the ACT-like direct TECH assignment (no diagnosis required).
        return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RETURNED_TO_STT', 'REOPENED'].includes(item.status);
      }
      // Standard complaint: diagnosis with a field-work decision is required first.
      return this.hasComplaintFieldDecision(item)
        && ['DIAGNOSIS_STEP', 'ASSIGNED_TO_TECH', 'RETURNED_TO_STT', 'REOPENED'].includes(item.status);
    }

    return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE', 'REJECTED_BY_ZM'].includes(item.status);
  }

  canExecuteMyself(item: CaseResponse): boolean {
    if (!this.isStt || !this.isCaseOwnedByStt(item)) return false;

    if (item.type === 'PLAINTE') {
      if (this.isImportedFieldComplaint(item)) {
        return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RETURNED_TO_STT', 'REOPENED'].includes(item.status);
      }
      return this.hasComplaintFieldDecision(item)
        && ['DIAGNOSIS_STEP', 'ASSIGNED_TO_STT', 'RETURNED_TO_STT', 'REOPENED'].includes(item.status);
    }

    return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE', 'REJECTED_BY_ZM'].includes(item.status);
  }

  canSetRdv(item: CaseResponse): boolean {
    if (item.type === 'PLAINTE') {
      const sttAllowedStatuses = ['ASSIGNED_TO_STT', 'DIAGNOSIS_STEP', 'NOT_REACHABLE'];

      if (this.isStt && this.isSttExecutor(item)) {
        return !this.hasDiagnosis(item) && sttAllowedStatuses.includes(item.status);
      }

      return false;
    }

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
    if (item.type === 'PLAINTE') {
      const isImported = this.isImportedFieldComplaint(item);
      // Standard complaints require a field-work diagnosis decision; PLT/RES imports skip that gate.
      if (!isImported && !this.hasComplaintFieldDecision(item)) {
        return false;
      }

      if (this.isStt && this.isSttExecutor(item)) {
        return ['ASSIGNED_TO_STT', 'RETURNED_TO_STT', 'REOPENED'].includes(item.status);
      }

      if (!this.isTech || !this.isCaseOwnedByTech(item)) return false;
      return item.status === 'ASSIGNED_TO_TECH';
    }

    if (this.isStt && this.isSttExecutor(item)) {
      return ['RDV_SET', 'ASSIGNED_TO_STT'].includes(item.status);
    }

    if (!this.isTech || !this.isCaseOwnedByTech(item)) return false;
    return ['RDV_SET', 'ASSIGNED_TO_TECH'].includes(item.status);
  }

  canDiagnose(item: CaseResponse): boolean {
    if (item.type !== 'PLAINTE' || !this.isStt || !this.isCaseOwnedByStt(item)) {
      return false;
    }

    return this.hasCompletedComplaintRdv(item)
      && ['ASSIGNED_TO_STT', 'DIAGNOSIS_STEP', 'RETURNED_TO_STT', 'REOPENED'].includes(item.status);
  }

  canValidateZm(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    if (item.type === 'PLAINTE') {
      return item.status === 'RESOLUTION_SUBMITTED';
    }

    return item.status === 'WORK_DONE';
  }

  canCloseCase(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return item.status === 'VALIDATED_BY_ZM';
  }

  canReopenComplaint(item: CaseResponse): boolean {
    return item.type === 'PLAINTE'
      && this.isZm
      && this.isCaseOwnedByZm(item)
      && ['CLOSED', 'VALIDATED_BY_ZM', 'RESOLUTION_SUBMITTED'].includes(item.status);
  }

  canView(item: CaseResponse): boolean {
    return this.canAccessCase(item);
  }

  isBusy(caseId: string): boolean {
    return this.actionLoadingCaseId === caseId;
  }

  trackById = (_index: number, item: CaseResponse) => item.id;

  openAssignStt(item: CaseResponse): void {
    this.assignModalMode = 'stt';
    this.assignModalPendingCase = item;
    this.assignModalTitle = `Assign STT — CRM ${item.crmCase}`;
    this.assignModalDescription = item.gouvernorat
      ? `Showing approved STTs that cover ${item.gouvernorat}.`
      : 'Showing approved STTs available for this case.';
    this.assignModalCurrentId = item.sttId ?? null;
    this.assignModalConfirmText = item.sttId ? 'Change STT' : 'Assign STT';
    this.assignModalUsers = [];
    this.assignModalLoading = true;
    this.assignModalVisible = true;

    this.loadAssignableStts(item).then(stts => {
      this.assignModalUsers = stts;
      this.assignModalLoading = false;
      this.zone.run(() => this.cdr.detectChanges());
    }).catch(err => {
      this.assignModalLoading = false;
      this.assignModalVisible = false;
      const message = err?.error?.message ?? 'Failed to load STT list';
      void this.swal.error('Load failed', message);
      this.zone.run(() => this.cdr.detectChanges());
    });
  }

  openAssignTech(item: CaseResponse): void {
    this.assignModalMode = 'tech';
    this.assignModalPendingCase = item;
    this.assignModalTitle = `Assign Technician — CRM ${item.crmCase}`;
    this.assignModalDescription = 'Showing approved technicians from your team.';
    this.assignModalCurrentId = item.techId ?? null;
    this.assignModalConfirmText = item.techId ? 'Change TECH' : 'Assign TECH';
    this.assignModalUsers = [];
    this.assignModalLoading = true;
    this.assignModalVisible = true;

    this.loadAssignableTechs().then(techs => {
      this.assignModalUsers = techs;
      this.assignModalLoading = false;
      this.zone.run(() => this.cdr.detectChanges());
    }).catch(err => {
      this.assignModalLoading = false;
      this.assignModalVisible = false;
      const message = err?.error?.message ?? 'Failed to load technician list';
      void this.swal.error('Load failed', message);
      this.zone.run(() => this.cdr.detectChanges());
    });
  }

  async onAssignSave(userId: string): Promise<void> {
    if (!this.assignModalPendingCase) return;
    const item = this.assignModalPendingCase;
    this.assignModalVisible = false;

    if (this.assignModalMode === 'stt') {
      await this.runAction(item.id, () => this.casesService.assignStt(item.id, userId), 'STT assignment saved');
    } else {
      await this.runAction(item.id, () => this.casesService.assignTech(item.id, userId), 'TECH assignment saved');
    }

    this.assignModalPendingCase = null;
  }

  onAssignCancel(): void {
    this.assignModalVisible = false;
    this.assignModalPendingCase = null;
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
      const panel = this.canDiagnose(item)
        ? 'diagnosis'
        : this.canUpdateWork(item) && (item.type === 'PLAINTE' || item.status === 'RDV_SET')
          ? 'work'
          : this.canSetRdv(item)
          ? 'rdv'
          : 'details';

      void this.openSttExecutionWorkspace(item.id, panel);
      return;
    }

    if (this.canDiagnose(item)) {
      void this.openDiagnosisPopup(item);
      return;
    }

    if (this.canUpdateWork(item) && (item.type === 'PLAINTE' || item.status === 'RDV_SET')) {
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
    if (this.canDiagnose(item)) {
      return 'Diagnosis';
    }

    if (this.canUpdateWork(item) && (item.type === 'PLAINTE' || item.status === 'RDV_SET')) {
      return 'Work';
    }

    if (this.canSetRdv(item)) {
      return 'RDV';
    }

    return 'Details';
  }

  sttPrimaryActionIcon(item: CaseResponse): string {
    if (this.canDiagnose(item)) {
      return 'cilNotes';
    }

    if (this.canUpdateWork(item) && (item.type === 'PLAINTE' || item.status === 'RDV_SET')) {
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

  async openDiagnosisPopup(item: CaseResponse): Promise<void> {
    const diagnosis = this.extractDiagnosis(item);
    const selectedCategory = diagnosis.complaintCategory ?? 'OTHER';

    const result = await Swal.fire<ComplaintDiagnosisRequest>({
      title: `Diagnosis - CRM ${this.escapeHtml(item.crmCase)}`,
      width: 780,
      html: `
        <div class="case-op-modal">
          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">Complaint category <span>*</span></label>
              <select id="sw-diagnosis-category" class="swal2-input case-op-input">
                ${this.complaintCategoryOptions()
                  .map((option) => `<option value="${option.value}" ${selectedCategory === option.value ? 'selected' : ''}>${option.label}</option>`)
                  .join('')}
              </select>
            </div>

            <div class="case-op-field">
              <label class="case-op-label">Root cause</label>
              <input id="sw-diagnosis-root-cause" class="swal2-input case-op-input" value="${this.escapeHtml(diagnosis.rootCause ?? '')}" />
            </div>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">Diagnosis comment</label>
            <textarea id="sw-diagnosis-comment" class="swal2-textarea case-op-textarea" placeholder="Summarize the issue, checks, and next decision">${this.escapeHtml(diagnosis.diagnosisComment ?? item.complaintDescription ?? item.complaintDetail ?? '')}</textarea>
          </div>

          <div class="case-op-divider"></div>

          <div class="case-op-grid case-op-grid-3">
            <div class="case-op-field">
              <label class="case-op-label">Requires field work</label>
              <select id="sw-diagnosis-field" class="swal2-input case-op-input">
                <option value="false" ${diagnosis.requiresFieldWork ? '' : 'selected'}>No</option>
                <option value="true" ${diagnosis.requiresFieldWork ? 'selected' : ''}>Yes</option>
              </select>
            </div>
            <div class="case-op-field">
              <label class="case-op-label">Requires TECH</label>
              <select id="sw-diagnosis-tech" class="swal2-input case-op-input">
                <option value="false" ${diagnosis.requiresTechIntervention ? '' : 'selected'}>No</option>
                <option value="true" ${diagnosis.requiresTechIntervention ? 'selected' : ''}>Yes</option>
              </select>
            </div>
            <div class="case-op-field">
              <label class="case-op-label">Escalate</label>
              <select id="sw-diagnosis-escalation" class="swal2-input case-op-input">
                <option value="false" ${diagnosis.requiresEscalation ? '' : 'selected'}>No</option>
                <option value="true" ${diagnosis.requiresEscalation ? 'selected' : ''}>Yes</option>
              </select>
            </div>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: 'Save diagnosis',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1b9aaa',
      preConfirm: () => {
        const complaintCategory = this.getElementValue('sw-diagnosis-category') as ComplaintCategory;
        const rootCause = this.toNullable(this.getElementValue('sw-diagnosis-root-cause'));
        const diagnosisComment = this.toNullable(this.getElementValue('sw-diagnosis-comment'));
        const requiresFieldWork = this.getElementValue('sw-diagnosis-field') === 'true';
        const requiresTechIntervention = this.getElementValue('sw-diagnosis-tech') === 'true';
        const requiresEscalation = this.getElementValue('sw-diagnosis-escalation') === 'true';

        if (!complaintCategory) {
          Swal.showValidationMessage('Complaint category is required');
          return undefined;
        }

        if (requiresEscalation && requiresTechIntervention) {
          Swal.showValidationMessage('Choose either escalation or TECH intervention for the next step');
          return undefined;
        }

        return {
          complaintCategory,
          rootCause,
          diagnosisComment,
          requiresFieldWork,
          requiresTechIntervention,
          requiresEscalation
        };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const diagnosisPayload = result.value;
    await this.runAction(
      item.id,
      () => this.casesService.diagnoseComplaint(item.id, diagnosisPayload),
      'Diagnosis saved'
    );
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

  async openReopenComplaint(item: CaseResponse): Promise<void> {
    const result = await Swal.fire<ReopenComplaintRequest>({
      title: `Reopen complaint - CRM ${this.escapeHtml(item.crmCase)}`,
      width: 640,
      html: `
        <div class="case-op-modal">
          <div class="case-op-field">
            <label class="case-op-label">Reopen comment</label>
            <textarea id="sw-reopen-comment" class="swal2-textarea case-op-textarea" placeholder="Explain why this complaint needs another resolution cycle"></textarea>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: 'Reopen complaint',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f9b115',
      preConfirm: () => {
        return {
          comment: this.toNullable(this.getElementValue('sw-reopen-comment'))
        };
      }
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    await this.runAction(
      item.id,
      () => this.casesService.reopenComplaint(item.id, result.value!),
      'Complaint reopened'
    );
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
    // Serve from cache instantly; only hit the network the first time a case is expanded.
    const cached = this.detailCache.get(item.id);
    if (cached) {
      this.caseDetailData = cached;
      this.caseDetailVisible = true;
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    this.actionLoadingCaseId = item.id;

    try {
      const fullCase = await firstValueFrom(this.casesService.getCaseById(item.id));
      this.detailCache.set(item.id, fullCase);
      this.caseDetailData = fullCase;
      this.caseDetailVisible = true;
    } catch (err: any) {
      console.error('Failed to load case details:', err);
      const message = err?.error?.message ?? 'Failed to load case details';
      await this.swal.error('Details unavailable', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  onCaseDetailClose(): void {
    this.caseDetailVisible = false;
  }

  async onCaseDetailDownload(caseData: CaseResponse): Promise<void> {
    await this.onCaseDetailsDownload(caseData);
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
      this.detailCache.delete(caseId);
      this.loadCases();
      this.loadSummary();
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

  private openSttExecutionWorkspace(caseId: string, panel: 'details' | 'rdv' | 'diagnosis' | 'work'): Promise<boolean> {
    return this.router.navigate([`/stt/cases/execution/tasks/${caseId}`], {
      queryParams: {
        step: panel === 'details' ? undefined : panel
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
    // Cache the raw STT roster (rarely changes within a session); filter per-case by governorate.
    if (!this.cachedSttUsers) {
      this.cachedSttUsers = (await firstValueFrom(this.userService.getMySttsForZm())) ?? [];
    }
    return this.cachedSttUsers
      .filter((u) => this.userCoversGovernorate(u.coveredGovernorates, item.gouvernorat))
      .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  private async loadAssignableTechs(): Promise<AssignableUser[]> {
    if (!this.cachedTechs) {
      const myTechs = await firstValueFrom(this.sttTechApi.getMyTechnicians());
      this.cachedTechs = (myTechs ?? [])
        .filter((u: TechnicianListItem) => u.status === 'APPROVED' && u.enabled)
        .map((u: TechnicianListItem) => ({ id: u.id, fullName: u.fullName, email: u.email }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return this.cachedTechs;
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

  private extractDiagnosis(item: CaseResponse): CaseDiagnosis {
    return item.diagnosis ?? {};
  }

  private extractResolution(item: CaseResponse): CaseResolution {
    return item.resolution ?? {};
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

  private hasDiagnosis(item: CaseResponse): boolean {
    const diagnosis = this.extractDiagnosis(item);
    return !!diagnosis.complaintCategory
      || !!diagnosis.rootCause?.trim()
      || !!diagnosis.diagnosisComment?.trim()
      || diagnosis.requiresEscalation === true
      || diagnosis.requiresFieldWork === true
      || diagnosis.requiresTechIntervention === true;
  }

  private hasCompletedComplaintRdv(item: CaseResponse): boolean {
    const rdv = this.extractRdv(item);
    return rdv.joignable !== false
      && rdv.abandon !== true
      && !!rdv.datePriseRdv;
  }

  private hasComplaintFieldDecision(item: CaseResponse): boolean {
    const diagnosis = this.extractDiagnosis(item);
    return diagnosis.requiresFieldWork === true || diagnosis.requiresTechIntervention === true;
  }

  private isWorkCompletedStatus(status: CaseStatus): boolean {
    return status === 'WORK_DONE'
      || status === 'RESOLUTION_SUBMITTED'
      || status === 'VALIDATED_BY_ZM'
      || status === 'CLOSED';
  }

  private complaintCategoryOptions(): Array<{ value: ComplaintCategory; label: string }> {
    return [
      { value: 'NETWORK_COVERAGE', label: 'Network coverage' },
      { value: 'SERVICE_QUALITY', label: 'Service quality' },
      { value: 'INSTALLATION', label: 'Installation' },
      { value: 'EQUIPMENT', label: 'Equipment' },
      { value: 'BILLING', label: 'Billing' },
      { value: 'ACTIVATION_FOLLOW_UP', label: 'Activation follow-up' },
      { value: 'CUSTOMER_EDUCATION', label: 'Customer education' },
      { value: 'OTHER', label: 'Other' }
    ];
  }

  private complaintCategoryLabel(value?: ComplaintCategory | null): string {
    return this.complaintCategoryOptions().find((option) => option.value === value)?.label ?? '-';
  }

  private notificationMatchesCurrentBoard(item: NotificationItem): boolean {
    const caseType = typeof item.data?.['caseType'] === 'string'
      ? item.data['caseType'].trim().toUpperCase()
      : '';

    if (!caseType) {
      return this.caseType === 'ACTIVATION';
    }

    return caseType === this.caseType;
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

    if (url.includes('/resiliation') || url.includes('/res-execution')) {
      return 'PLAINTE';
    }

    if (url.includes('/activation')) {
      return 'ACTIVATION';
    }

    return null;
  }

  private resolveCaseModuleFromRoute(): 'PLT' | 'RES' | null {
    const snapshots = [...this.route.snapshot.pathFromRoot].reverse();
    for (const snapshot of snapshots) {
      const value = snapshot.data?.['caseModule'];
      if (value === 'PLT' || value === 'RES') {
        return value;
      }
    }

    const url = this.router.url.toLowerCase();
    if (url.includes('/resiliation') || url.includes('/res-execution')) {
      return 'RES';
    }

    return null;
  }

  /** PLT and RES imported complaints share the ACT-like direct-TECH workflow (no diagnosis gate). */
  private isImportedFieldComplaint(item: CaseResponse): boolean {
    return item.source === 'PLT_TODO_IMPORT' || item.source === 'RES_TODO_IMPORT';
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
    if (!(governorate ?? '').trim()) {
      return false;
    }

    return (governorates ?? []).some((value) => governoratesMatch(value, governorate));
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
          this.loadSummary();
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
