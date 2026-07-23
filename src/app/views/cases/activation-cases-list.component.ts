import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
import {
  CASE_MODULE_LABEL_KEYS,
  COMPLAINT_CATEGORY_LABEL_KEYS,
  EXECUTION_MODE_LABEL_KEYS,
  SLA_STATUS_LABEL_KEYS
} from '../../core/i18n/ui-labels';

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
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective, TranslocoModule, CaseDetailComponent, AssignUserModalComponent],
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
  private readonly transloco = inject(TranslocoService);

  cases: CaseResponse[] = [];
  loading = false;
  performanceLoading = false;
  actionLoadingCaseId: string | null = null;
  error: string | null = null;

  // Case detail modal state
  caseDetailVisible = false;
  caseDetailData: CaseResponse | null = null;

  // Deep-link target (e.g. from a message notification). The matching row shows a
  // green highlight until its details are opened.
  highlightedCaseId: string | null = null;

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
  private focusSub?: Subscription;
  private langSub?: Subscription;
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

    // Deep-link from a message notification: open the target case directly (or
    // highlight it if it can't be opened). Reacts to repeated clicks because we
    // strip the param after handling it, so a fresh navigation always emits.
    this.focusSub = this.route.queryParamMap.subscribe((params) => {
      const focusCaseId = params.get('focusCaseId');
      if (!focusCaseId) {
        return;
      }

      this.focusDeepLinkedCase(focusCaseId);

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { focusCaseId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    });

    this.langSub = this.transloco.langChanges$.subscribe(() => {
      this.zone.run(() => this.cdr.detectChanges());
    });

    this.loadCases();
    this.loadSummary();
    this.loadPerformance();
    this.startLiveTicker();
    this.startBackendResync();
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
    this.focusSub?.unsubscribe();
    this.langSub?.unsubscribe();
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
    if (this.isResModule) {
      return this.transloco.translate(CASE_MODULE_LABEL_KEYS.RES);
    }
    if (this.isComplaintModule) {
      return this.transloco.translate(CASE_MODULE_LABEL_KEYS.PLT);
    }
    return this.transloco.translate(CASE_MODULE_LABEL_KEYS.ACT);
  }

  get caseBoardLabelPlural(): string {
    if (this.isResModule) return this.t('cases.board.modules.resiliation.plural');
    return this.isComplaintModule
      ? this.t('cases.board.modules.complaint.plural')
      : this.t('cases.board.modules.activation.plural');
  }

  get statusOptions(): Array<{ value: '' | CaseStatus; label: string }> {
    if (this.isComplaintModule) {
      return [
        { value: '', label: this.t('cases.board.filters.allStatuses') },
        { value: 'CREATED', label: this.statusLabel('CREATED') },
        { value: 'ASSIGNED_TO_ZM', label: this.statusLabel('ASSIGNED_TO_ZM') },
        { value: 'ASSIGNED_TO_STT', label: this.statusLabel('ASSIGNED_TO_STT') },
        { value: 'DIAGNOSIS_STEP', label: this.statusLabel('DIAGNOSIS_STEP') },
        { value: 'ASSIGNED_TO_TECH', label: this.statusLabel('ASSIGNED_TO_TECH') },
        { value: 'NOT_REACHABLE', label: this.statusLabel('NOT_REACHABLE') },
        { value: 'RESOLUTION_SUBMITTED', label: this.statusLabel('RESOLUTION_SUBMITTED') },
        { value: 'RETURNED_TO_STT', label: this.statusLabel('RETURNED_TO_STT') },
        { value: 'ESCALATED', label: this.statusLabel('ESCALATED') },
        { value: 'REOPENED', label: this.statusLabel('REOPENED') },
        { value: 'VALIDATED_BY_ZM', label: this.statusLabel('VALIDATED_BY_ZM') },
        { value: 'CLOSED', label: this.statusLabel('CLOSED') }
      ];
    }

    return [
      { value: '', label: this.t('cases.board.filters.allStatuses') },
      { value: 'CREATED', label: this.statusLabel('CREATED') },
      { value: 'ASSIGNED_TO_ZM', label: this.statusLabel('ASSIGNED_TO_ZM') },
      { value: 'ASSIGNED_TO_STT', label: this.statusLabel('ASSIGNED_TO_STT') },
      { value: 'ASSIGNED_TO_TECH', label: this.statusLabel('ASSIGNED_TO_TECH') },
      { value: 'RDV_SET', label: this.statusLabel('RDV_SET') },
      { value: 'NOT_REACHABLE', label: this.statusLabel('NOT_REACHABLE') },
      { value: 'ABANDONED', label: this.statusLabel('ABANDONED') },
      { value: 'WORK_DONE', label: this.statusLabel('WORK_DONE') },
      { value: 'VALIDATED_BY_ZM', label: this.statusLabel('VALIDATED_BY_ZM') },
      { value: 'REJECTED_BY_ZM', label: this.statusLabel('REJECTED_BY_ZM') },
      { value: 'CLOSED', label: this.statusLabel('CLOSED') }
    ];
  }

  get canCreateCase(): boolean {
    return this.currentRole === 'ROLE_ADMIN' && !this.isComplaintModule;
  }

  get createRoute(): string {
    return '/admin/cases/activation/new';
  }

  get workspaceTitle(): string {
    return this.t(this.workspaceTitleKey());
  }

  get workspaceSubtitle(): string {
    return this.t(this.workspaceSubtitleKey());
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
      { label: this.isResModule ? this.t('cases.board.stats.totalResiliations') : this.isComplaintModule ? this.t('cases.board.stats.totalComplaints') : this.t('cases.board.stats.totalCases'), value: s?.totalCases ?? 0, icon: 'cilDescription', className: 'stat-neutral' },
      { label: this.t('cases.board.stats.ownedByZm'), value: s?.ownedByZm ?? 0, icon: 'cilUser', className: 'stat-primary' },
      { label: this.t('cases.board.stats.assignedToStt'), value: s?.assignedStt ?? 0, icon: 'cilPeople', className: 'stat-info' },
      { label: this.t('cases.board.stats.assignedToTech'), value: s?.assignedTech ?? 0, icon: 'cilUserFollow', className: 'stat-warning' },
      { label: this.t('cases.board.stats.slaWarning'), value: s?.slaWarning ?? 0, icon: 'cilWarning', className: 'stat-warning' },
      { label: this.t('cases.board.stats.slaBreached'), value: s?.slaBreached ?? 0, icon: 'cilBan', className: 'stat-danger' },
      { label: this.isComplaintModule ? this.t('cases.board.stats.resolutionReady') : this.t('cases.board.stats.workDone'), value: s?.workDone ?? 0, icon: 'cilTask', className: 'stat-success' },
      { label: this.t('statuses.case.closed'), value: s?.closed ?? 0, icon: 'cilLockLocked', className: 'stat-dark' }
    ];
  }

  get performanceCards(): PerfCard[] {
    if (!this.myPerformance) {
      return [];
    }

    return [
      {
        label: this.t('cases.board.performance.activeTasks'),
        value: String(this.myPerformance.activeTasksCount),
        icon: 'cilTask',
        className: 'perf-primary'
      },
      {
        label: this.t('cases.board.performance.rdvOnTime'),
        value: String(this.myPerformance.rdvOnTime),
        icon: 'cilCheckCircle',
        className: 'perf-success'
      },
      {
        label: this.t('cases.board.performance.rdvLate'),
        value: String(this.myPerformance.rdvLate),
        icon: 'cilClock',
        className: 'perf-danger'
      },
      {
        label: this.t('cases.board.performance.rdvOnTimeRate'),
        value: `${this.myPerformance.rdvOnTimeRate.toFixed(1)}%`,
        icon: 'cilChart',
        className: 'perf-success'
      },
      {
        label: this.t('cases.board.performance.avgRdvResponse'),
        value: this.formatMinutes(this.myPerformance.averageResponseMinutes),
        icon: 'cilSpeedometer',
        className: 'perf-info'
      },
      {
        label: this.t('cases.board.performance.slaWarnings'),
        value: String(this.myPerformance.slaWarningCount),
        icon: 'cilWarning',
        className: 'perf-warning'
      },
      {
        label: this.t('cases.board.performance.slaEscalations'),
        value: String(this.myPerformance.slaEscalationCount),
        icon: 'cilBan',
        className: 'perf-danger'
      },
      {
        label: this.t('cases.board.performance.avgOverdue'),
        value: this.formatMinutes(this.myPerformance.averageOverdueMinutes),
        icon: 'cilClock',
        className: 'perf-warning'
      },
      {
        label: this.t('cases.board.performance.completion'),
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
      { label: this.t('cases.board.alertSummary.criticalBreach'), value: breached, icon: 'cilBan', className: 'stat-danger' },
      { label: this.t('cases.board.alertSummary.escalated'), value: escalated, icon: 'cilWarning', className: 'stat-danger' },
      { label: this.t('cases.board.alertSummary.slaWarning'), value: warning, icon: 'cilWarning', className: 'stat-warning' },
      { label: this.t('cases.board.alertSummary.assignments'), value: assignments, icon: 'cilTask', className: 'stat-primary' },
      { label: this.t('cases.board.alertSummary.unreadAlerts'), value: unread, icon: 'cilBell', className: 'stat-dark' }
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
          this.error = err?.error?.message ?? this.t('cases.board.errors.loadCases', { module: this.caseBoardLabel.toLowerCase() });
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
      return this.t('cases.board.pagination.range', { start: 0, end: 0, total: 0 });
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalElements);
    return this.t('cases.board.pagination.range', { start, end, total: this.totalElements });
  }

  statusBadgeClass(status: CaseStatus): string {
    return CASE_STATUS_UI[status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
  }

  statusLabel(status: CaseStatus): string {
    return this.transloco.translate(CASE_STATUS_UI[status]?.label ?? status);
  }

  getSlaStatus(item: CaseResponse): SlaStatus | null {
    return this.resolveLiveSla(item).status;
  }

  slaStatusLabel(item: CaseResponse): string {
    const status = this.getSlaStatus(item);

    switch (status) {
      case 'ON_TRACK':
        return this.transloco.translate(SLA_STATUS_LABEL_KEYS.ON_TRACK);
      case 'WARNING':
        return this.transloco.translate(SLA_STATUS_LABEL_KEYS.WARNING);
      case 'BREACHED':
        return this.transloco.translate(SLA_STATUS_LABEL_KEYS.BREACHED);
      case 'COMPLETED_ON_TIME':
        return this.transloco.translate(SLA_STATUS_LABEL_KEYS.COMPLETED_ON_TIME);
      case 'COMPLETED_LATE':
        return this.transloco.translate(SLA_STATUS_LABEL_KEYS.COMPLETED_LATE);
      default:
        return this.t('cases.board.sla.notStarted');
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
        return this.t('cases.board.sla.rdvCaptured');
      }

      return this.t('cases.board.sla.respondedIn', { duration: this.formatSeconds(live.responseDurationSeconds) });
    }

    const remaining = live.remainingSeconds;
    if (remaining == null) {
      return '-';
    }

    if (remaining <= 0) {
      return live.overdueSeconds > 0
        ? this.t('cases.board.sla.overdueBy', { duration: this.formatSeconds(live.overdueSeconds) })
        : this.t('cases.board.sla.overdue');
    }

    return this.t('cases.board.sla.remaining', { duration: this.formatSeconds(remaining) });
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
    this.assignModalTitle = this.t('cases.board.assign.stt.title', { crmCase: item.crmCase });
    this.assignModalDescription = item.gouvernorat
      ? this.t('cases.board.assign.stt.descriptionForGovernorate', { governorate: item.gouvernorat })
      : this.t('cases.board.assign.stt.descriptionDefault');
    this.assignModalCurrentId = item.sttId ?? null;
    this.assignModalConfirmText = item.sttId ? this.t('cases.board.assign.stt.change') : this.t('cases.board.assign.stt.assign');
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
      const message = err?.error?.message ?? this.t('cases.board.assign.stt.loadError');
      void this.swal.error(this.t('cases.board.assign.loadFailedTitle'), message);
      this.zone.run(() => this.cdr.detectChanges());
    });
  }

  openAssignTech(item: CaseResponse): void {
    this.assignModalMode = 'tech';
    this.assignModalPendingCase = item;
    this.assignModalTitle = this.t('cases.board.assign.tech.title', { crmCase: item.crmCase });
    this.assignModalDescription = this.t('cases.board.assign.tech.descriptionDefault');
    this.assignModalCurrentId = item.techId ?? null;
    this.assignModalConfirmText = item.techId ? this.t('cases.board.assign.tech.change') : this.t('cases.board.assign.tech.assign');
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
      const message = err?.error?.message ?? this.t('cases.board.assign.tech.loadError');
      void this.swal.error(this.t('cases.board.assign.loadFailedTitle'), message);
      this.zone.run(() => this.cdr.detectChanges());
    });
  }

  async onAssignSave(userId: string): Promise<void> {
    if (!this.assignModalPendingCase) return;
    const item = this.assignModalPendingCase;
    this.assignModalVisible = false;

    if (this.assignModalMode === 'stt') {
      await this.runAction(item.id, () => this.casesService.assignStt(item.id, userId), this.t('cases.board.assign.stt.saved'));
    } else {
      await this.runAction(item.id, () => this.casesService.assignTech(item.id, userId), this.t('cases.board.assign.tech.saved'));
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
            this.t('cases.board.executeMyself.confirmTitle'),
            this.t('cases.board.executeMyself.confirmText', { crmCase: item.crmCase }),
            this.t('cases.board.executeMyself.confirmButton')
          );

      if (!confirm.isConfirmed) {
        return;
      }

      await this.runAction(
        item.id,
        () => this.casesService.executeMyself(item.id),
        alreadySelfExecuting
          ? this.t('cases.board.executeMyself.kept')
          : this.t('cases.board.executeMyself.activated')
      );

      void this.openSttExecutionWorkspace(item.id, 'details');
    } catch (err: any) {
      console.error('Failed to switch to STT self-execution:', err);
      const message = err?.error?.message ?? this.t('cases.board.executeMyself.errorMessage');
      await this.swal.error(this.t('cases.board.executeMyself.errorTitle'), message);
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
      return this.t('cases.board.actions.diagnosis');
    }

    if (this.canUpdateWork(item) && (item.type === 'PLAINTE' || item.status === 'RDV_SET')) {
      return this.t('cases.board.actions.work');
    }

    if (this.canSetRdv(item)) {
      return this.t('cases.board.actions.rdv');
    }

    return this.t('common.details');
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
      title: this.t('cases.board.rdv.title', { crmCase: item.crmCase }),
      width: 860,
      html: `
        <div class="case-op-modal">
          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.reachable')} <span>*</span></label>
              <select id="sw-rdv-joignable" class="swal2-input case-op-input">
                <option value="true" ${rdv.joignable !== false ? 'selected' : ''}>${this.popupText('common.yes')}</option>
                <option value="false" ${rdv.joignable === false ? 'selected' : ''}>${this.popupText('common.no')}</option>
              </select>
            </div>

            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.rdv.fields.dateTime')} <span>*</span></label>
              <input id="sw-rdv-date" type="datetime-local" class="swal2-input case-op-input" value="${this.toDateTimeLocal(rdv.datePriseRdv)}" />
            </div>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">${this.popupText('caseDetail.fields.causeInjoignabilite')}</label>
            <input id="sw-rdv-cause-inj" class="swal2-input case-op-input" value="${this.escapeHtml(rdv.causeInjoignabilite ?? '')}" placeholder="${this.popupText('cases.board.rdv.placeholders.causeInjoignabilite')}" />
          </div>

          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.rdv.fields.operationalDetail')}</label>
              <textarea id="sw-rdv-detail" class="swal2-textarea case-op-textarea" placeholder="${this.popupText('cases.board.rdv.placeholders.operationalDetail')}">${this.escapeHtml(rdv.detail ?? '')}</textarea>
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.rdv.fields.comment')}</label>
              <textarea id="sw-rdv-comment" class="swal2-textarea case-op-textarea" placeholder="${this.popupText('cases.board.rdv.placeholders.comment')}">${this.escapeHtml(rdv.cmtRdv ?? '')}</textarea>
            </div>
          </div>

          <div class="case-op-divider"></div>

          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.abandoned')}</label>
              <select id="sw-rdv-abandon" class="swal2-input case-op-input">
                <option value="false" ${rdv.abandon ? '' : 'selected'}>${this.popupText('common.no')}</option>
                <option value="true" ${rdv.abandon ? 'selected' : ''}>${this.popupText('common.yes')}</option>
              </select>
            </div>

            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.causeAbandon')}</label>
              <input id="sw-rdv-cause-abandon" class="swal2-input case-op-input" value="${this.escapeHtml(rdv.causeAbandon ?? '')}" placeholder="${this.popupText('cases.board.rdv.placeholders.causeAbandon')}" />
            </div>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: this.t('cases.board.rdv.confirmButton'),
      cancelButtonText: this.t('common.cancel'),
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
          Swal.showValidationMessage(this.t('cases.board.rdv.validation.dateRequired'));
          return undefined;
        }

        if (!joignable && !causeInjoignabilite) {
          Swal.showValidationMessage(this.t('cases.board.rdv.validation.causeInjoignabiliteRequired'));
          return undefined;
        }

        if (abandon && !causeAbandon) {
          Swal.showValidationMessage(this.t('cases.board.rdv.validation.causeAbandonRequired'));
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
    await this.runAction(item.id, () => this.casesService.setRdv(item.id, rdvPayload), this.t('cases.board.rdv.saved'));
  }

  async openWorkPopup(item: CaseResponse): Promise<void> {
    if (this.isStt && this.isSttExecutor(item)) {
      await this.openSttExecutionWorkspace(item.id, 'work');
      return;
    }

    const work = this.extractWork(item);
    const metrics = this.extractMetrics(item);

    const result = await Swal.fire<CompleteWorkRequest>({
      title: this.t('cases.board.work.title', { crmCase: item.crmCase }),
      width: 760,
      html: `
        <div class="case-op-modal">
          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.work.fields.result')} <span>*</span></label>
              <input id="sw-work-result" class="swal2-input case-op-input" value="${this.escapeHtml(work.repTravauxStt ?? '')}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.work.fields.completedAt')} <span>*</span></label>
              <input id="sw-work-date" type="datetime-local" class="swal2-input case-op-input" value="${this.toDateTimeLocal(work.dateFinTrv)}" />
            </div>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">${this.popupText('cases.board.work.fields.comment')} <span>*</span></label>
            <textarea id="sw-work-comment" class="swal2-textarea case-op-textarea" placeholder="${this.popupText('cases.board.work.placeholders.comment')}">${this.escapeHtml(work.cmtTrvStt ?? '')}</textarea>
          </div>

          <div class="case-op-divider"></div>
          <div class="case-op-subtitle">${this.popupText('caseDetail.sections.technicalMetrics')}</div>

          <div class="case-op-grid case-op-grid-3">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.work.fields.metrageCable')}</label>
              <input id="sw-work-metrage" type="number" step="0.01" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.metrageCable)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.work.fields.nombrePv')}</label>
              <input id="sw-work-pv" type="number" step="1" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.nombrePv)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.work.fields.debitDl')}</label>
              <input id="sw-work-dl" type="number" step="0.01" class="swal2-input case-op-input" value="${this.toInputNumber(metrics.debitDl)}" />
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.work.fields.debitUl')}</label>
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
      confirmButtonText: this.t('cases.board.work.confirmButton'),
      cancelButtonText: this.t('common.cancel'),
      confirmButtonColor: '#2eb85c',
      preConfirm: () => {
        const repTravauxStt = this.getElementValue('sw-work-result').trim();
        const dateFinTrv = this.toIso(this.getElementValue('sw-work-date'));
        const cmtTrvStt = this.getElementValue('sw-work-comment').trim();

        if (!repTravauxStt || !dateFinTrv || !cmtTrvStt) {
          Swal.showValidationMessage(this.t('cases.board.work.validation.requiredFields'));
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
    await this.runAction(item.id, () => this.casesService.completeWork(item.id, workPayload), this.t('cases.board.work.saved'));
  }

  async openDiagnosisPopup(item: CaseResponse): Promise<void> {
    const diagnosis = this.extractDiagnosis(item);
    const selectedCategory = diagnosis.complaintCategory ?? 'OTHER';

    const result = await Swal.fire<ComplaintDiagnosisRequest>({
      title: this.t('cases.board.diagnosis.title', { crmCase: item.crmCase }),
      width: 780,
      html: `
        <div class="case-op-modal">
          <div class="case-op-grid case-op-grid-2">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('cases.board.diagnosis.fields.category')} <span>*</span></label>
              <select id="sw-diagnosis-category" class="swal2-input case-op-input">
                ${this.complaintCategoryOptions()
                  .map((option) => `<option value="${option.value}" ${selectedCategory === option.value ? 'selected' : ''}>${option.label}</option>`)
                  .join('')}
              </select>
            </div>

            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.rootCause')}</label>
              <input id="sw-diagnosis-root-cause" class="swal2-input case-op-input" value="${this.escapeHtml(diagnosis.rootCause ?? '')}" />
            </div>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">${this.popupText('cases.board.diagnosis.fields.comment')}</label>
            <textarea id="sw-diagnosis-comment" class="swal2-textarea case-op-textarea" placeholder="${this.popupText('cases.board.diagnosis.placeholders.comment')}">${this.escapeHtml(diagnosis.diagnosisComment ?? item.complaintDescription ?? item.complaintDetail ?? '')}</textarea>
          </div>

          <div class="case-op-divider"></div>

          <div class="case-op-grid case-op-grid-3">
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.requiresFieldWork')}</label>
              <select id="sw-diagnosis-field" class="swal2-input case-op-input">
                <option value="false" ${diagnosis.requiresFieldWork ? '' : 'selected'}>${this.popupText('common.no')}</option>
                <option value="true" ${diagnosis.requiresFieldWork ? 'selected' : ''}>${this.popupText('common.yes')}</option>
              </select>
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.requiresTech')}</label>
              <select id="sw-diagnosis-tech" class="swal2-input case-op-input">
                <option value="false" ${diagnosis.requiresTechIntervention ? '' : 'selected'}>${this.popupText('common.no')}</option>
                <option value="true" ${diagnosis.requiresTechIntervention ? 'selected' : ''}>${this.popupText('common.yes')}</option>
              </select>
            </div>
            <div class="case-op-field">
              <label class="case-op-label">${this.popupText('caseDetail.fields.requiresEscalation')}</label>
              <select id="sw-diagnosis-escalation" class="swal2-input case-op-input">
                <option value="false" ${diagnosis.requiresEscalation ? '' : 'selected'}>${this.popupText('common.no')}</option>
                <option value="true" ${diagnosis.requiresEscalation ? 'selected' : ''}>${this.popupText('common.yes')}</option>
              </select>
            </div>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: this.t('cases.board.diagnosis.confirmButton'),
      cancelButtonText: this.t('common.cancel'),
      confirmButtonColor: '#1b9aaa',
      preConfirm: () => {
        const complaintCategory = this.getElementValue('sw-diagnosis-category') as ComplaintCategory;
        const rootCause = this.toNullable(this.getElementValue('sw-diagnosis-root-cause'));
        const diagnosisComment = this.toNullable(this.getElementValue('sw-diagnosis-comment'));
        const requiresFieldWork = this.getElementValue('sw-diagnosis-field') === 'true';
        const requiresTechIntervention = this.getElementValue('sw-diagnosis-tech') === 'true';
        const requiresEscalation = this.getElementValue('sw-diagnosis-escalation') === 'true';

        if (!complaintCategory) {
          Swal.showValidationMessage(this.t('cases.board.diagnosis.validation.categoryRequired'));
          return undefined;
        }

        if (requiresEscalation && requiresTechIntervention) {
          Swal.showValidationMessage(this.t('cases.board.diagnosis.validation.nextStepConflict'));
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
      this.t('cases.board.diagnosis.saved')
    );
  }

  async openValidatePopup(item: CaseResponse): Promise<void> {
    const validation = this.extractValidation(item);
    const defaultApproved = validation.approved ?? true;

    const result = await Swal.fire<ValidateZmRequest>({
      title: this.t('cases.board.validation.title', { crmCase: item.crmCase }),
      width: 720,
      html: `
        <div class="case-op-modal">
          <div class="case-op-field">
            <label class="case-op-label">${this.popupText('cases.board.validation.fields.decision')} <span>*</span></label>
            <select id="sw-zm-approved" class="swal2-input case-op-input">
              <option value="true" ${defaultApproved ? 'selected' : ''}>${this.popupText('cases.board.validation.options.approve')}</option>
              <option value="false" ${defaultApproved ? '' : 'selected'}>${this.popupText('cases.board.validation.options.reject')}</option>
            </select>
          </div>

          <div class="case-op-field">
            <label class="case-op-label">${this.popupText('cases.board.validation.fields.comment')} <span>*</span></label>
            <textarea id="sw-zm-comment" class="swal2-textarea case-op-textarea" placeholder="${this.popupText('cases.board.validation.placeholders.comment')}">${this.escapeHtml(validation.comment ?? '')}</textarea>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: this.t('cases.board.validation.confirmButton'),
      cancelButtonText: this.t('common.cancel'),
      confirmButtonColor: '#321fdb',
      preConfirm: () => {
        const approved = this.getElementValue('sw-zm-approved') === 'true';
        const comment = this.getElementValue('sw-zm-comment').trim();

        if (!comment) {
          Swal.showValidationMessage(this.t('cases.board.validation.validation.commentRequired'));
          return undefined;
        }

        return { approved, comment };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const validationPayload = result.value;
    await this.runAction(item.id, () => this.casesService.validateZm(item.id, validationPayload), this.t('cases.board.validation.saved'));
  }

  async openReopenComplaint(item: CaseResponse): Promise<void> {
    const result = await Swal.fire<ReopenComplaintRequest>({
      title: this.t('cases.board.reopen.title', { crmCase: item.crmCase }),
      width: 640,
      html: `
        <div class="case-op-modal">
          <div class="case-op-field">
            <label class="case-op-label">${this.popupText('cases.board.reopen.fields.comment')}</label>
            <textarea id="sw-reopen-comment" class="swal2-textarea case-op-textarea" placeholder="${this.popupText('cases.board.reopen.placeholders.comment')}"></textarea>
          </div>
        </div>
      `,
      customClass: {
        popup: 'case-op-popup'
      },
      showCancelButton: true,
      confirmButtonText: this.t('cases.board.reopen.confirmButton'),
      cancelButtonText: this.t('common.cancel'),
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
      this.t('cases.board.reopen.saved')
    );
  }

  async openClosePopup(item: CaseResponse): Promise<void> {
    const confirm = await this.swal.confirmAction(
      this.t('cases.board.close.confirmTitle'),
      this.t('cases.board.close.confirmText', { crmCase: item.crmCase }),
      this.t('cases.board.close.confirmButton')
    );

    if (!confirm.isConfirmed) return;
    await this.runAction(item.id, () => this.casesService.closeCase(item.id), this.t('cases.board.close.saved'));
  }

  /**
   * Opens a deep-linked case (e.g. from a message notification) directly in the
   * details modal. The row is highlighted green in the meantime; the highlight is
   * cleared once the details open, and left in place if the direct open fails so
   * the user can still spot the case in the list.
   */
  private focusDeepLinkedCase(caseId: string): void {
    if (!caseId) {
      return;
    }

    this.highlightedCaseId = caseId;
    this.zone.run(() => this.cdr.detectChanges());

    const cached = this.detailCache.get(caseId);
    if (cached) {
      this.caseDetailData = cached;
      this.caseDetailVisible = true;
      this.highlightedCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    this.casesService.getCaseById(caseId).subscribe({
      next: (fullCase) => {
        this.detailCache.set(caseId, fullCase);
        this.caseDetailData = fullCase;
        this.caseDetailVisible = true;
        // Details are open now — the green highlight has served its purpose.
        this.highlightedCaseId = null;
        this.zone.run(() => this.cdr.detectChanges());
      },
      error: (err) => {
        console.error('Failed to open case from notification:', err);
        this.highlightedCaseId = null;
        const status = err?.status;
        // Controlled feedback when the case is gone or the user may not access it,
        // instead of silently landing on the board with nothing opened.
        if (status === 404 || status === 403) {
          const messageKey = status === 404
            ? 'cases.board.details.deletedMessage'
            : 'cases.board.details.forbiddenMessage';
          this.swal.error(this.t('cases.board.details.errorTitle'), this.t(messageKey));
        }
        this.zone.run(() => this.cdr.detectChanges());
      }
    });
  }

  async openDetails(item: CaseResponse): Promise<void> {
    // Opening the details satisfies the "highlight until opened" contract.
    if (this.highlightedCaseId === item.id) {
      this.highlightedCaseId = null;
    }

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
      const message = err?.error?.message ?? this.t('cases.board.details.errorMessage');
      await this.swal.error(this.t('cases.board.details.errorTitle'), message);
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
      const message = err?.error?.message ?? err?.message ?? this.t('cases.board.download.errorMessage');
      await this.swal.error(this.t('cases.board.download.errorTitle'), message);
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
      await this.swal.success(successTitle, this.t('cases.board.messages.operationCompleted'));
      this.detailCache.delete(caseId);
      this.loadCases();
      this.loadSummary();
      this.loadPerformance();
    } catch (err: any) {
      console.error('Case action failed:', err);
      const message = err?.error?.message ?? this.t('cases.board.messages.operationFailed');
      await this.swal.error(this.t('cases.board.messages.requestFailed'), message);
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
      return this.transloco.translate(EXECUTION_MODE_LABEL_KEYS.STT_SELF_EXECUTION);
    }

    if (this.hasTechExecution(item)) {
      return this.transloco.translate(EXECUTION_MODE_LABEL_KEYS.TECH_EXECUTION);
    }

    return this.t('cases.execution.notSelected');
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
      { value: 'NETWORK_COVERAGE', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.NETWORK_COVERAGE) },
      { value: 'SERVICE_QUALITY', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.SERVICE_QUALITY) },
      { value: 'INSTALLATION', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.INSTALLATION) },
      { value: 'EQUIPMENT', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.EQUIPMENT) },
      { value: 'BILLING', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.BILLING) },
      { value: 'ACTIVATION_FOLLOW_UP', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.ACTIVATION_FOLLOW_UP) },
      { value: 'CUSTOMER_EDUCATION', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.CUSTOMER_EDUCATION) },
      { value: 'OTHER', label: this.t(COMPLAINT_CATEGORY_LABEL_KEYS.OTHER) }
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
      return `<div class="text-body-secondary small">${this.popupText('cases.board.timeline.empty')}</div>`;
    }

    const rows = timeline.slice(0, 12).map((event) => {
      const occurredAt = this.escapeHtml(this.asDateLabel(event.occurredAt));
      const title = this.escapeHtml(event.title ?? event.eventType ?? this.t('cases.board.timeline.event'));
      const details = this.escapeHtml(event.details ?? '-');
      const actor = this.escapeHtml(event.actor ?? this.t('notifications.alertCenter.targetRoles.system'));
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
            ${this.popupText('cases.board.timeline.actorState', { actor, from: this.escapeHtml(stateFrom), to: this.escapeHtml(stateTo) })}
          </div>
        </div>
      `;
    }).join('');

    return `<div class="case-timeline">${rows}</div>`;
  }

  private renderProofsHtml(proofs: CaseProofFile[]): string {
    if (!proofs.length) {
      return `<div class="text-body-secondary small">${this.popupText('cases.board.proof.empty')}</div>`;
    }

    const rows = proofs.map((proof) => {
      const filename = this.escapeHtml(proof.originalFilename || this.t('cases.board.proof.defaultFilename'));
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
            <div class="small text-body-secondary">${this.popupText('cases.board.proof.uploaded', { value: uploadedAt })}</div>
            <div class="small text-body-secondary">${this.popupText('cases.board.proof.by', { value: uploadedBy })}</div>
            <div class="small text-body-secondary">${this.popupText('cases.board.proof.source', { value: source || '-' })}</div>
            <div class="small text-body-secondary">${this.popupText('cases.board.proof.gps', { value: location })}</div>
            <div class="small text-body-secondary">${this.popupText('cases.board.proof.capturedAt', { value: capturedAt })}</div>
            <div class="small text-body-secondary">${this.popupText('cases.board.proof.accuracy', { value: accuracy })}</div>
            <div class="d-flex gap-2 flex-wrap mt-2">
              <a
                href="${imageHref}"
                target="_blank"
                rel="noopener noreferrer"
                class="small text-primary text-decoration-none"
              >${this.popupText('cases.board.proof.openImage')}</a>
              ${mapHref ? `
                <a
                  href="${this.escapeHtml(mapHref)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="small text-primary text-decoration-none"
                >${this.popupText('cases.board.proof.openMap')}</a>
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
      return `<div class="text-body-secondary small">${this.popupText('cases.board.workLocation.empty')}</div>`;
    }

    return `
      <div class="row g-2 mb-2">
        <div class="col-md-5"><strong>${this.popupText('cases.board.workLocation.coordinates')}</strong> ${location}</div>
        <div class="col-md-4"><strong>${this.popupText('caseDetail.fields.capturedAt')}</strong> ${capturedAt}</div>
        <div class="col-md-3"><strong>${this.popupText('caseDetail.fields.accuracy')}</strong> ${accuracy}</div>
      </div>
      ${mapHref ? `
        <a
          href="${this.escapeHtml(mapHref)}"
          target="_blank"
          rel="noopener noreferrer"
          class="small text-primary text-decoration-none"
        >${this.popupText('cases.board.workLocation.openMap')}</a>
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
      return this.t('caseDetail.proofSource.gallery');
    }

    if (source === 'camera') {
      return this.t('caseDetail.proofSource.camera');
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

    return this.t('common.measure.approxMeters', { value: Math.round(value) });
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
      return this.t('common.duration.minutesCompact', { value: 0 });
    }

    const rounded = Math.round(value * 10) / 10;
    return this.t('common.duration.minutesCompact', { value: rounded });
  }

  private formatSeconds(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return this.t('common.duration.lessThanMinute');
    }

    const safeSeconds = Math.floor(totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);

    if (hours > 0) {
      return this.t('common.duration.hoursMinutesCompact', { hours, minutes });
    }

    if (minutes > 0) {
      return this.t('common.duration.minutesCompact', { value: minutes });
    }

    return this.t('common.duration.lessThanMinute');
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
    return date.toLocaleString(this.dateLocale());
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

  private workspaceTitleKey(): string {
    if (this.isResModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'cases.board.workspace.resiliation.admin.title';
        case 'ROLE_ZM':
          return 'cases.board.workspace.resiliation.zm.title';
        case 'ROLE_STT':
          return 'cases.board.workspace.resiliation.stt.title';
        case 'ROLE_TECH':
          return 'cases.board.workspace.resiliation.tech.title';
        default:
          return 'cases.board.workspace.resiliation.default.title';
      }
    }

    if (this.isComplaintModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'cases.board.workspace.complaint.admin.title';
        case 'ROLE_ZM':
          return 'cases.board.workspace.complaint.zm.title';
        case 'ROLE_STT':
          return 'cases.board.workspace.complaint.stt.title';
        case 'ROLE_TECH':
          return 'cases.board.workspace.complaint.tech.title';
        default:
          return 'cases.board.workspace.complaint.default.title';
      }
    }

    switch (this.currentRole) {
      case 'ROLE_ADMIN':
        return 'cases.board.workspace.activation.admin.title';
      case 'ROLE_ZM':
        return 'cases.board.workspace.activation.zm.title';
      case 'ROLE_STT':
        return 'cases.board.workspace.activation.stt.title';
      case 'ROLE_TECH':
        return 'cases.board.workspace.activation.tech.title';
      default:
        return 'cases.board.workspace.activation.default.title';
    }
  }

  private workspaceSubtitleKey(): string {
    if (this.isResModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'cases.board.workspace.resiliation.admin.subtitle';
        case 'ROLE_ZM':
          return 'cases.board.workspace.resiliation.zm.subtitle';
        case 'ROLE_STT':
          return 'cases.board.workspace.resiliation.stt.subtitle';
        case 'ROLE_TECH':
          return 'cases.board.workspace.resiliation.tech.subtitle';
        default:
          return 'cases.board.workspace.resiliation.default.subtitle';
      }
    }

    if (this.isComplaintModule) {
      switch (this.currentRole) {
        case 'ROLE_ADMIN':
          return 'cases.board.workspace.complaint.admin.subtitle';
        case 'ROLE_ZM':
          return 'cases.board.workspace.complaint.zm.subtitle';
        case 'ROLE_STT':
          return 'cases.board.workspace.complaint.stt.subtitle';
        case 'ROLE_TECH':
          return 'cases.board.workspace.complaint.tech.subtitle';
        default:
          return 'cases.board.workspace.complaint.default.subtitle';
      }
    }

    switch (this.currentRole) {
      case 'ROLE_ADMIN':
        return 'cases.board.workspace.activation.admin.subtitle';
      case 'ROLE_ZM':
        return 'cases.board.workspace.activation.zm.subtitle';
      case 'ROLE_STT':
        return 'cases.board.workspace.activation.stt.subtitle';
      case 'ROLE_TECH':
        return 'cases.board.workspace.activation.tech.subtitle';
      default:
        return 'cases.board.workspace.activation.default.subtitle';
    }
  }

  private dateLocale(): string {
    switch (this.transloco.getActiveLang()) {
      case 'ar':
        return 'ar';
      case 'fr':
        return 'fr-FR';
      default:
        return 'en-US';
    }
  }

  private popupText(key: string, params?: Record<string, unknown>): string {
    return this.escapeHtml(this.t(key, params));
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
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
