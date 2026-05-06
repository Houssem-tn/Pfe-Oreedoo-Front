import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize, firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import {
  CASE_STATUS_UI,
  CaseMetrics,
  CaseProofFile,
  CaseResponse,
  CaseStatus,
  CaseTimelineEvent,
  CompleteWorkRequest,
  PerformanceSummaryResponse,
  SetRdvRequest,
  SlaStatus
} from '../../core/cases/models/case.model';
import { NotificationItem } from '../../core/notifications/models/notification.model';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { StockService } from '../../core/stock/stock.service';
import {
  DeclareTechUsageRequest,
  TechStock,
  TechStockItem
} from '../../core/stock/stock.model';
import {
  extractMetrics,
  extractRdv,
  extractTimeline,
  extractWork,
  resolveLiveSla,
  slaRemainingLabel,
  slaStatusLabel,
  toDateTimeLocal,
  toInputNumber,
  toIso,
  toMaybeNumber
} from './tech-case.helpers';

type TechQuickFilter = 'urgent' | 'rdv' | 'work' | 'all';
type TechPanel = 'details' | 'rdv' | 'work';
type BannerTone = 'success' | 'warning' | 'danger' | 'info';
type TechProofSource = 'camera' | 'gallery';

interface TechBanner {
  tone: BannerTone;
  text: string;
}

interface TechSummaryCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: string;
}

interface TechRdvForm {
  joignable: boolean;
  datePriseRdv: string;
  causeInjoignabilite: string;
  detail: string;
  cmtRdv: string;
  abandon: boolean;
  causeAbandon: string;
}

interface TechWorkForm {
  repTravauxStt: string;
  dateFinTrv: string;
  cmtTrvStt: string;
  nombrePv: string;
  debitDl: string;
  debitUl: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}


interface TechGeoSnapshot {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
}

type LocationPermissionState = PermissionState | 'unsupported';

interface TechProofDraft {
  caseId: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  capturedAt: string;
  captureSource: TechProofSource;
  location: TechGeoSnapshot;
  lastError?: string | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective],
  templateUrl: './tech-activation-cases.component.html',
  styleUrl: './tech-activation-cases.component.scss'
})
export class TechActivationCasesComponent implements OnInit, OnDestroy {
  private static readonly CLOCK_TICK_MS = 60000;
  private static readonly RESYNC_MS = 300000;
  private static readonly PROOF_STORAGE_KEY = 'tech-work-proof-drafts-v1';
  private static readonly MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;

  private readonly casesService = inject(CasesService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationsStore = inject(NotificationStoreService);
  private readonly stockService = inject(StockService);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  performanceLoading = false;
  actionBusy = false;
  syncing = false;
  error: string | null = null;
  panelError: string | null = null;
  banner: TechBanner | null = null;
  locationBusy = false;
  locationError: string | null = null;

  cases: CaseResponse[] = [];
  performance: PerformanceSummaryResponse | null = null;

  searchTerm = '';
  statusFilter: '' | CaseStatus = '';
  quickFilter: TechQuickFilter = 'urgent';
  currentPage = 1;
  readonly pageSize = 4;

  selectedCaseId: string | null = null;
  selectedCaseDetails: CaseResponse | null = null;
  activePanel: TechPanel = 'details';
  panelLoading = false;
  techStockLoading = false;
  stockBusy = false;
  techStockError: string | null = null;
  stockNotice: TechBanner | null = null;

  rdvForm: TechRdvForm = this.createEmptyRdvForm();
  workForm: TechWorkForm = this.createEmptyWorkForm();
  usageLines: Array<{ equipmentId: string; quantity: string }> = [];
  techStock: TechStock | null = null;
  proofDrafts: Record<string, TechProofDraft> = {};
  private pendingProofLocation: TechGeoSnapshot | null = null;
  private pendingProofSource: TechProofSource | null = null;
  private backgroundProofSyncCaseId: string | null = null;
  private backgroundRdvSyncCaseId: string | null = null;

  private routeIntentCaseId: string | null = null;
  private routeIntentPanel: TechPanel = 'details';
  private nowEpochMs = Date.now();
  private clockHandle: ReturnType<typeof setInterval> | null = null;
  private resyncHandle: ReturnType<typeof setInterval> | null = null;

  readonly statusOptions: Array<{ value: '' | CaseStatus; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'ASSIGNED_TO_STT', label: 'Assigned to STT' },
    { value: 'ASSIGNED_TO_TECH', label: 'Assigned to TECH' },
    { value: 'RDV_SET', label: 'RDV set' },
    { value: 'NOT_REACHABLE', label: 'Not reachable' },
    { value: 'WORK_DONE', label: 'Work done' },
    { value: 'VALIDATED_BY_ZM', label: 'Validated by ZM' },
    { value: 'REJECTED_BY_ZM', label: 'Rejected by ZM' },
    { value: 'CLOSED', label: 'Closed' }
  ];
  readonly extractRdv = extractRdv;
  readonly extractWork = extractWork;

  ngOnInit(): void {
    this.loadProofDrafts();
    this.readRouteIntent();
    this.loadCases();
    this.loadPerformance();
    this.startClock();
    this.startResync();
  }

  ngOnDestroy(): void {
    if (this.clockHandle != null) {
      clearInterval(this.clockHandle);
      this.clockHandle = null;
    }

    if (this.resyncHandle != null) {
      clearInterval(this.resyncHandle);
      this.resyncHandle = null;
    }
  }

  get activeCases(): CaseResponse[] {
    return this.accessibleCases.filter((item) => item.status !== 'CLOSED');
  }

  get currentRole(): string | null {
    return this.authStore.role();
  }

  get isTechRole(): boolean {
    return this.currentRole === 'ROLE_TECH';
  }

  get isSttWorkspace(): boolean {
    return this.currentRole === 'ROLE_STT';
  }

  get workspaceEyebrow(): string {
    return this.isSttWorkspace ? 'Ooredoo STT field execution board' : 'Ooredoo TECH mobile board';
  }

  get workspaceTitle(): string {
    return this.isSttWorkspace
      ? 'One mobile queue for STT self-execution, RDV, proof capture, and work closure.'
      : 'One mobile queue for urgent tasks, RDV, and work closure.';
  }

  get workspaceSubtitle(): string {
    return this.isSttWorkspace
      ? 'When you take execution yourself, this workspace mirrors the technician flow so photo proof, GPS capture, and closure stay in one mobile experience.'
      : 'The board now keeps fewer tasks on screen at once, separates core actions from tools, and makes field movement smoother without changing your workflow.';
  }

  get dashboardRoute(): string {
    return this.isSttWorkspace ? '/stt/dashboard' : '/tech/dashboard';
  }

  get accessibleCases(): CaseResponse[] {
    return this.cases.filter((item) => this.canAccessFieldWorkspace(item));
  }

  get urgentCount(): number {
    return this.activeCases.filter((item) => {
      const status = this.slaStatus(item);
      return status === 'WARNING' || status === 'BREACHED' || status === 'COMPLETED_LATE';
    }).length;
  }

  get rdvCount(): number {
    return this.activeCases.filter((item) => this.canSetRdv(item)).length;
  }

  get workCount(): number {
    return this.activeCases.filter((item) => this.canSubmitWork(item)).length;
  }

  get pendingProofCount(): number {
    return Object.keys(this.proofDrafts).length;
  }

  get completedCasesCount(): number {
    return this.accessibleCases.filter((item) =>
      item.status === 'WORK_DONE' || item.status === 'VALIDATED_BY_ZM' || item.status === 'CLOSED'
    ).length;
  }

  get summaryCards(): TechSummaryCard[] {
    return [
      {
        label: 'Urgent first',
        helper: 'Warning or breached SLA',
        value: String(this.urgentCount),
        icon: 'cilWarning',
        tone: 'warning'
      },
      {
        label: 'RDV flow',
        helper: 'Calls and appointments to confirm',
        value: String(this.rdvCount),
        icon: 'cilCalendar',
        tone: 'info'
      },
      {
        label: 'Ready for work',
        helper: 'Interventions ready to close',
        value: String(this.workCount),
        icon: 'cilTask',
        tone: 'success'
      },
      {
        label: 'Proof queue',
        helper: 'Photo proofs pending sync',
        value: String(this.pendingProofCount),
        icon: 'cilMediaRecord',
        tone: 'dark'
      }
    ];
  }

  get operationalAlerts(): NotificationItem[] {
    const relevant = new Set(['CASE_ASSIGNED_TO_TECH', 'CASE_ASSIGNED_TO_STT', 'SLA_WARNING', 'SLA_BREACHED', 'SLA_ESCALATED']);

    return this.notificationsStore.latestFirst()
      .filter((item) => relevant.has(item.eventType))
      .slice(0, 4);
  }

  get visibleCases(): CaseResponse[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.accessibleCases
      .filter((item) => {
        const statusMatches = !this.statusFilter || item.status === this.statusFilter;
        const quickFilterMatches = this.matchesQuickFilter(item);
        const searchMatches =
          !term
          || item.crmCase.toLowerCase().includes(term)
          || item.clientName.toLowerCase().includes(term)
          || item.clientPhone.toLowerCase().includes(term)
          || item.msisdn.toLowerCase().includes(term)
          || item.localite.toLowerCase().includes(term)
          || item.delegation.toLowerCase().includes(term)
          || item.gouvernorat.toLowerCase().includes(term)
          || (item.offre ?? '').toLowerCase().includes(term)
          || (item.desPack ?? '').toLowerCase().includes(term);

        return statusMatches && quickFilterMatches && searchMatches;
      })
      .sort((left, right) => {
        const priorityDelta = this.priorityScore(left) - this.priorityScore(right);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return left.crmCase.localeCompare(right.crmCase);
      });
  }

  get totalVisibleCases(): number {
    return this.visibleCases.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalVisibleCases / this.pageSize));
  }

  get displayPage(): number {
    return this.currentPageValue;
  }

  get pageStart(): number {
    if (!this.totalVisibleCases) {
      return 0;
    }

    return ((this.currentPageValue - 1) * this.pageSize) + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPageValue * this.pageSize, this.totalVisibleCases);
  }

  get paginatedCases(): CaseResponse[] {
    const start = (this.currentPageValue - 1) * this.pageSize;
    return this.visibleCases.slice(start, start + this.pageSize);
  }

  get selectedCasePosition(): number {
    if (!this.selectedCaseId) {
      return 0;
    }

    const index = this.visibleCases.findIndex((item) => item.id === this.selectedCaseId);
    return index >= 0 ? index + 1 : 0;
  }

  get canGoToPreviousCase(): boolean {
    return this.selectedCasePosition > 1;
  }

  get canGoToNextCase(): boolean {
    return this.selectedCasePosition > 0 && this.selectedCasePosition < this.totalVisibleCases;
  }

  get selectedCase(): CaseResponse | null {
    if (!this.selectedCaseId) {
      return null;
    }

    if (this.selectedCaseDetails?.id === this.selectedCaseId) {
      return this.selectedCaseDetails;
    }

    return this.cases.find((item) => item.id === this.selectedCaseId) ?? null;
  }

  get selectedTimeline(): CaseTimelineEvent[] {
    const target = this.selectedCase;
    return target ? extractTimeline(target).slice(0, 8) : [];
  }

  get currentProofDraft(): TechProofDraft | null {
    if (!this.selectedCaseId) {
      return null;
    }

    return this.proofDrafts[this.selectedCaseId] ?? null;
  }

  get uploadedProofs(): CaseProofFile[] {
    return [...(this.selectedCase?.workProofs ?? [])];
  }

  get techStockItems(): TechStockItem[] {
    return [...(this.techStock?.items ?? [])].sort((left, right) => {
      const availabilityDelta = right.remainingQuantity - left.remainingQuantity;
      if (availabilityDelta !== 0) {
        return availabilityDelta;
      }

      return left.equipmentName.localeCompare(right.equipmentName);
    });
  }

  get techStockRemainingTotal(): number {
    return this.techStockItems.reduce((sum, item) => sum + item.remainingQuantity, 0);
  }

  get techStockUsedTotal(): number {
    return this.techStockItems.reduce((sum, item) => sum + item.usedQuantity, 0);
  }

  loadCases(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.casesService.getActivationCases()
      .pipe(finalize(() => {
        this.loading = false;
        this.syncing = false;
      }))
      .subscribe({
        next: (rows) => {
          this.cases = rows ?? [];
          this.applyRouteIntent();
          this.syncCurrentPage();

          if (this.selectedCaseId) {
            const stillVisible = this.cases.some((item) => item.id === this.selectedCaseId);
            if (!stillVisible) {
              this.closePanel();
            }
          }
        },
        error: (err) => {
          console.error('Failed to load TECH cases', err);
          this.error = err?.error?.message ?? 'Unable to load field tasks.';
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
      }))
      .subscribe({
        next: (summary) => {
          this.performance = summary;
        },
        error: () => {
          this.performance = null;
        }
      });
  }

  refreshBoard(): void {
    if (this.loading || this.syncing) {
      return;
    }

    this.banner = null;
    this.syncing = true;
    this.loadCases();

    if (!this.performanceLoading) {
      this.loadPerformance();
    }
  }

  setQuickFilter(filter: TechQuickFilter): void {
    this.quickFilter = filter;
    this.currentPage = 1;
    this.syncCurrentPage();
  }

  updateSearchTerm(value: string): void {
    this.searchTerm = value;
    this.currentPage = 1;
    this.syncCurrentPage();
  }

  updateStatusFilter(value: '' | CaseStatus): void {
    this.statusFilter = value;
    this.currentPage = 1;
    this.syncCurrentPage();
  }

  goToPreviousPage(): void {
    this.currentPage = this.currentPageValue - 1;
    this.syncCurrentPage();
  }

  goToNextPage(): void {
    this.currentPage = this.currentPageValue + 1;
    this.syncCurrentPage();
  }

  openAdjacentCase(offset: -1 | 1): void {
    if (!this.selectedCaseId) {
      return;
    }

    const currentIndex = this.visibleCases.findIndex((item) => item.id === this.selectedCaseId);
    const target = currentIndex >= 0 ? this.visibleCases[currentIndex + offset] : null;
    if (!target) {
      return;
    }

    this.focusCasePage(target.id);
    this.openPanel(target, this.activePanel);
  }

  trackById = (_index: number, item: CaseResponse) => item.id;
  trackByAlert = (_index: number, item: NotificationItem) => item.id;

  statusLabel(status: CaseStatus): string {
    return CASE_STATUS_UI[status]?.label ?? status;
  }

  statusBadgeClass(status: CaseStatus): string {
    const className = CASE_STATUS_UI[status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
    return `${className} tech-pill`;
  }

  slaStatus(item: CaseResponse): SlaStatus | null {
    return resolveLiveSla(item, this.nowEpochMs).status;
  }

  slaLabel(item: CaseResponse): string {
    return slaStatusLabel(this.slaStatus(item));
  }

  slaBadgeClass(item: CaseResponse): string {
    switch (this.slaStatus(item)) {
      case 'WARNING':
        return 'bg-warning-subtle text-warning-emphasis tech-pill';
      case 'BREACHED':
      case 'COMPLETED_LATE':
        return 'bg-danger-subtle text-danger-emphasis tech-pill';
      case 'COMPLETED_ON_TIME':
        return 'bg-info-subtle text-info-emphasis tech-pill';
      case 'ON_TRACK':
        return 'bg-success-subtle text-success-emphasis tech-pill';
      default:
        return 'bg-secondary-subtle text-secondary-emphasis tech-pill';
    }
  }

  slaTrackClass(item: CaseResponse): string {
    switch (this.slaStatus(item)) {
      case 'WARNING':
        return 'tech-sla-track--warning';
      case 'BREACHED':
      case 'COMPLETED_LATE':
        return 'tech-sla-track--danger';
      case 'COMPLETED_ON_TIME':
        return 'tech-sla-track--info';
      case 'ON_TRACK':
        return 'tech-sla-track--safe';
      default:
        return 'tech-sla-track--idle';
    }
  }

  slaProgress(item: CaseResponse): number {
    return resolveLiveSla(item, this.nowEpochMs).progressPercent;
  }

  slaRemaining(item: CaseResponse): string {
    return slaRemainingLabel(item, this.nowEpochMs);
  }

  caseLocation(item: CaseResponse): string {
    return [item.localite, item.delegation, item.gouvernorat].filter(Boolean).join(', ');
  }

  rdvLabel(item: CaseResponse): string {
    const rdv = extractRdv(item);
    return rdv.datePriseRdv
      ? new Date(rdv.datePriseRdv).toLocaleString()
      : 'No RDV set';
  }

  workLabel(item: CaseResponse): string {
    const work = extractWork(item);
    return work.repTravauxStt?.trim() || 'Waiting for work submission';
  }

  hasPendingProof(item: CaseResponse): boolean {
    return !!this.proofDrafts[item.id];
  }

  hasUploadedProofs(item: CaseResponse): boolean {
    return !!item.workProofs?.length;
  }

  canSetRdv(item: CaseResponse): boolean {
    if (!this.isCaseOwnedByCurrentExecutor(item)) {
      return false;
    }

    if (this.isCaseOwnedBySttSelfExecutor(item)) {
      return ['ASSIGNED_TO_STT', 'RDV_SET', 'NOT_REACHABLE'].includes(item.status);
    }

    return ['ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE'].includes(item.status);
  }

  canSubmitWork(item: CaseResponse): boolean {
    if (!this.isCaseOwnedByCurrentExecutor(item)) {
      return false;
    }

    if (this.isCaseOwnedBySttSelfExecutor(item)) {
      return ['ASSIGNED_TO_STT', 'RDV_SET'].includes(item.status);
    }

    return ['ASSIGNED_TO_TECH', 'RDV_SET'].includes(item.status);
  }

  openPrimaryAction(item: CaseResponse): void {
    if (this.canSubmitWork(item) && item.status === 'RDV_SET') {
      this.openPanel(item, 'work');
      return;
    }

    if (this.canSetRdv(item)) {
      this.openPanel(item, 'rdv');
      return;
    }

    this.openPanel(item, 'details');
  }

  primaryActionLabel(item: CaseResponse): string {
    if (this.canSubmitWork(item) && item.status === 'RDV_SET') {
      return 'Submit work';
    }

    if (this.canSetRdv(item)) {
      return 'Set RDV';
    }

    return 'Open task';
  }

  primaryActionIcon(item: CaseResponse): string {
    if (this.canSubmitWork(item) && item.status === 'RDV_SET') {
      return 'cilTask';
    }

    if (this.canSetRdv(item)) {
      return 'cilCalendar';
    }

    return 'cilChevronRight';
  }

  openPanel(item: CaseResponse, panel: TechPanel): void {
    this.banner = null;
    this.panelError = null;
    this.stockNotice = null;
    this.focusCasePage(item.id);
    this.selectedCaseId = item.id;
    this.activePanel = panel;
    this.selectedCaseDetails = this.selectedCaseDetails?.id === item.id ? this.selectedCaseDetails : null;

    if (panel === 'rdv') {
      this.rdvForm = this.createRdvForm(item);
    }

    if (panel === 'work') {
      this.workForm = this.createWorkForm(item);
    }

    if (this.isTechRole) {
      this.loadTechStock(true);
    }

    this.loadCaseDetails(item.id);
  }

  closePanel(): void {
    this.selectedCaseId = null;
    this.selectedCaseDetails = null;
    this.activePanel = 'details';
    this.panelLoading = false;
    this.panelError = null;
    this.stockNotice = null;
  }

  switchPanel(panel: TechPanel): void {
    const target = this.selectedCase;
    if (!target) {
      return;
    }

    this.activePanel = panel;

    if (panel === 'rdv') {
      this.rdvForm = this.createRdvForm(target);
    }

    if (panel === 'work') {
      this.workForm = this.createWorkForm(target);
    }
  }

  async saveRdv(): Promise<void> {
    const target = this.selectedCase;
    if (!target) {
      return;
    }

    await this.flushPendingFormChanges();
    this.actionBusy = true;
    this.banner = null;

    try {
      const datePriseRdv = toIso(this.rdvForm.datePriseRdv);
      if (!datePriseRdv) {
        this.banner = { tone: 'danger', text: 'RDV date and time are required.' };
        return;
      }

      if (!this.rdvForm.joignable && !this.rdvForm.causeInjoignabilite.trim()) {
        this.banner = { tone: 'danger', text: 'Add the non-reachability cause before saving the RDV.' };
        return;
      }

      if (this.rdvForm.abandon && !this.rdvForm.causeAbandon.trim()) {
        this.banner = { tone: 'danger', text: 'Add the abandon cause before saving the RDV.' };
        return;
      }

      const payload: SetRdvRequest = {
        joignable: this.rdvForm.joignable,
        datePriseRdv,
        causeInjoignabilite: this.rdvForm.joignable ? null : this.toNullable(this.rdvForm.causeInjoignabilite),
        detail: this.rdvForm.detail.trim(),
        cmtRdv: this.rdvForm.cmtRdv.trim(),
        abandon: this.rdvForm.abandon,
        causeAbandon: this.rdvForm.abandon ? this.toNullable(this.rdvForm.causeAbandon) : null
      };

      const previousSnapshot = this.cloneCase(target);
      const optimisticCase = this.buildOptimisticRdvCase(target, payload);

      this.replaceCase(optimisticCase);
      this.selectedCaseDetails = optimisticCase;
      this.activePanel = 'details';
      this.banner = { tone: 'info', text: 'RDV saved locally. Syncing the final confirmation in the background...' };
      void this.syncRdvAfterLocalSave(target.id, payload, previousSnapshot);
    } catch (err: any) {
      console.error('Failed to save TECH RDV', err);
      this.banner = { tone: 'danger', text: err?.error?.message ?? 'Unable to save the RDV.' };
    } finally {
      this.actionBusy = false;
    }
  }

  async submitWork(): Promise<void> {
    const target = this.selectedCase;
    if (!target) {
      return;
    }

    await this.flushPendingFormChanges();
    this.actionBusy = true;
    this.banner = { tone: 'info', text: 'Capturing the current GPS position and submitting the work report...' };

    try {
      if (!this.currentProofDraft) {
        this.banner = { tone: 'danger', text: 'Attach a proof photo before submitting work.' };
        return;
      }

      if (!this.currentProofDraft.location) {
        this.banner = { tone: 'danger', text: 'Attach a proof photo again so its GPS position can be saved.' };
        return;
      }

      this.locationError = null;

      const workLocation = await this.captureCurrentLocation(
        'submit the work report',
        'work',
        this.currentProofDraft.location
      );
      if (!workLocation) {
        return;
      }

      const payload = this.buildWorkPayload(workLocation);
      if (!payload) {
        return;
      }

      const updated = await firstValueFrom(this.casesService.completeWork(target.id, payload));
      this.replaceCase(updated);
      this.selectedCaseDetails = updated;
      this.activePanel = 'details';
      this.loadPerformance();
      this.loadCaseDetails(target.id);
      this.banner = {
        tone: 'success',
        text: 'Work submitted. Proof photo is syncing in the background so the field user does not have to wait.'
      };
      void this.syncProofAfterWork(target.id);
    } catch (err: any) {
      console.error('Failed to submit TECH work', err);
      this.banner = { tone: 'danger', text: err?.error?.message ?? 'Unable to submit the work update.' };
    } finally {
      this.actionBusy = false;
    }
  }

  async retryProofUpload(item?: CaseResponse): Promise<void> {
    const target = item ?? this.selectedCase;
    if (!target) {
      return;
    }

    this.banner = null;
    this.actionBusy = true;

    try {
      const result = await this.uploadProofDraft(target.id);

      this.banner = result === 'uploaded'
        ? { tone: 'success', text: 'Proof photo synced successfully.' }
        : { tone: 'warning', text: 'Proof photo is still queued locally. Backend proof upload is not available yet.' };
    } finally {
      this.actionBusy = false;
    }
  }

  async startProofSelection(input: HTMLInputElement, source: TechProofSource): Promise<void> {
    if (!this.selectedCaseId || this.locationBusy || this.actionBusy) {
      return;
    }

    this.banner = null;
    this.locationError = null;
    this.pendingProofLocation = null;
    this.pendingProofSource = source;
    input.value = '';
    input.click();
  }

  async onProofFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    const captureSource = this.pendingProofSource ?? (input?.dataset['source'] === 'gallery' ? 'gallery' : 'camera');

    if (!file || !this.selectedCaseId) {
      this.pendingProofLocation = null;
      this.pendingProofSource = null;
      if (input) {
        input.value = '';
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.banner = { tone: 'danger', text: 'Use an image file for proof.' };
      this.pendingProofLocation = null;
      this.pendingProofSource = null;
      input.value = '';
      return;
    }

    if (file.size > TechActivationCasesComponent.MAX_PHOTO_SIZE_BYTES) {
      this.banner = { tone: 'danger', text: 'Proof photo must stay under 8 MB for reliable mobile upload.' };
      this.pendingProofLocation = null;
      this.pendingProofSource = null;
      input.value = '';
      return;
    }

    this.locationError = null;
    const location = this.pendingProofLocation ?? await this.captureCurrentLocation(
      captureSource === 'camera' ? 'attach a camera proof photo' : 'attach a gallery proof photo',
      'proof'
    );

    if (!location) {
      this.pendingProofLocation = null;
      this.pendingProofSource = null;
      input.value = '';
      return;
    }

    const dataUrl = await this.readFileAsDataUrl(file);

    this.upsertProofDraft({
      caseId: this.selectedCaseId,
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      dataUrl,
      capturedAt: new Date().toISOString(),
      captureSource,
      location,
      lastError: null
    });

    this.pendingProofLocation = null;
    this.pendingProofSource = null;
    this.banner = {
      tone: 'success',
      text: 'Proof photo and GPS position were saved. They will be sent right after the work payload.'
    };
    input.value = '';
  }

  clearProofDraft(): void {
    if (!this.selectedCaseId) {
      return;
    }

    this.removeProofDraft(this.selectedCaseId);
    this.banner = { tone: 'info', text: 'Proof photo removed from this task draft.' };
  }

  markAlertRead(alert: NotificationItem): void {
    if (!alert.read) {
      this.notificationsStore.markAsRead(alert.id);
    }
  }

  async openAlert(alert: NotificationItem): Promise<void> {
    this.markAlertRead(alert);

    const caseId = typeof alert.data?.['caseId'] === 'string'
      ? String(alert.data?.['caseId'])
      : alert.entityId;

    if (!caseId) {
      return;
    }

    const local = this.cases.find((item) => item.id === caseId);
    if (local) {
      this.openPanel(local, 'details');
      return;
    }

    try {
      const fullCase = await firstValueFrom(this.casesService.getCaseById(caseId));
      this.replaceCase(fullCase);
      this.openPanel(fullCase, 'details');
    } catch (err) {
      console.error('Failed to open alert case', err);
      this.banner = { tone: 'danger', text: 'The alert case could not be opened.' };
    }
  }

  customerMapLink(item: CaseResponse): string {
    if (item.latitude && item.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.caseLocation(item))}`;
  }

  proofCaption(draft: TechProofDraft): string {
    const capturedAt = new Date(draft.capturedAt).toLocaleString();
    const source = this.proofSourceLabel(draft.captureSource);
    return draft.lastError
      ? `${source} proof captured ${capturedAt}. Pending backend sync.`
      : `${source} proof captured ${capturedAt}. Ready to send.`;
  }

  uploadedProofCaption(proof: CaseProofFile): string {
    const uploadedAt = proof.createdAt ? new Date(proof.createdAt).toLocaleString() : 'unknown time';
    const uploadedBy = proof.uploadedBy?.trim() ? proof.uploadedBy : 'unknown user';
    const source = this.proofSourceLabel(proof.captureSource);
    return `Uploaded ${uploadedAt} by ${uploadedBy}${source ? ` | ${source}` : ''}`;
  }

  proofSourceLabel(source?: string | null): string {
    if (source === 'gallery') {
      return 'Gallery';
    }

    if (source === 'camera') {
      return 'Camera';
    }

    return '';
  }

  locationSummary(location?: TechGeoSnapshot | null): string {
    if (!location) {
      return 'GPS position not captured';
    }

    const capturedAt = new Date(location.capturedAt).toLocaleString();
    const coords = this.coordinateLabel(location.latitude, location.longitude);
    const accuracy = this.accuracyLabel(location.accuracyMeters);
    return `${coords} | ${accuracy} | ${capturedAt}`;
  }

  proofLocationSummary(proof?: CaseProofFile | null): string {
    if (!proof || proof.locationLatitude == null || proof.locationLongitude == null) {
      return 'No saved GPS position';
    }

    const capturedAt = proof.locationCapturedAt ? new Date(proof.locationCapturedAt).toLocaleString() : 'capture time unavailable';
    return `${this.coordinateLabel(proof.locationLatitude, proof.locationLongitude)} | ${this.accuracyLabel(proof.locationAccuracyMeters)} | ${capturedAt}`;
  }

  workLocationSummary(item: CaseResponse): string {
    const work = extractWork(item);

    if (work.locationLatitude == null || work.locationLongitude == null) {
      return 'No work submission GPS saved';
    }

    const capturedAt = work.locationCapturedAt ? new Date(work.locationCapturedAt).toLocaleString() : 'submit time unavailable';
    return `${this.coordinateLabel(work.locationLatitude, work.locationLongitude)} | ${this.accuracyLabel(work.locationAccuracyMeters)} | ${capturedAt}`;
  }

  draftMapLink(draft?: TechProofDraft | null): string | null {
    return this.mapLinkForCoordinates(draft?.location?.latitude, draft?.location?.longitude);
  }

  proofMapLink(proof?: CaseProofFile | null): string | null {
    return this.mapLinkForCoordinates(proof?.locationLatitude, proof?.locationLongitude);
  }

  workMapLink(item: CaseResponse): string | null {
    const work = extractWork(item);
    return this.mapLinkForCoordinates(work.locationLatitude, work.locationLongitude);
  }

  proofStatusClass(item: CaseResponse): string {
    const draft = this.proofDrafts[item.id];
    return draft?.lastError
      ? 'bg-warning-subtle text-warning-emphasis tech-pill'
      : 'bg-dark-subtle text-dark-emphasis tech-pill';
  }

  addUsageLine(): void {
    this.usageLines = [...this.usageLines, { equipmentId: '', quantity: '' }];
  }

  removeUsageLine(index: number): void {
    this.usageLines = this.usageLines.filter((_, i) => i !== index);
  }

  async submitStockUsage(): Promise<void> {
    const target = this.selectedCase;
    if (!target || !this.isTechRole) return;

    const validLines = this.usageLines.filter((l) => {
      const qty = Number(l.quantity);
      return l.equipmentId && Number.isFinite(qty) && qty > 0;
    });

    if (!validLines.length) {
      this.stockNotice = { tone: 'danger', text: 'Select at least one item with a valid quantity.' };
      return;
    }

    this.stockBusy = true;
    this.stockNotice = null;

    try {
      const payload: DeclareTechUsageRequest = {
        caseId: target.id,
        items: validLines.map((l) => {
          const si = this.techStockItems.find((i) => i.equipmentId === l.equipmentId)!;
          return { equipmentId: si.equipmentId, equipmentName: si.equipmentName, unit: si.unit, quantity: Number(l.quantity) };
        })
      };

      const response = await firstValueFrom(this.stockService.declareMyTechUsage(payload));
      this.techStock = response.stock ?? this.techStock;
      this.usageLines = [{ equipmentId: '', quantity: '' }];

      this.stockNotice = response.hasWarnings
        ? { tone: 'warning', text: response.warnings.join(' ') }
        : { tone: 'success', text: `Usage saved for CRM ${target.crmCase}. Stock updated.` };
    } catch (err: any) {
      console.error('Failed to declare TECH stock usage', err);
      this.stockNotice = { tone: 'danger', text: err?.error?.message ?? 'Unable to declare stock usage.' };
    } finally {
      this.stockBusy = false;
    }
  }


  stockQuantityLabel(quantity: number, unit?: string | null): string {
    const suffix = this.stockUnitLabel(unit);
    return `${quantity} ${suffix}`;
  }

  stockUnitLabel(unit?: string | null): string {
    if (unit === 'METERS') {
      return 'm';
    }

    if (unit === 'PIECES') {
      return 'pcs';
    }

    return unit?.trim() || 'units';
  }

  detailMetricEntries(item: CaseResponse): Array<{ label: string; value: string }> {
    const metrics = extractMetrics(item);

    return [
      { label: 'PV', value: this.metricValue(metrics.nombrePv) },
      { label: 'DL', value: this.metricValue(metrics.debitDl) },
      { label: 'UL', value: this.metricValue(metrics.debitUl) },
      { label: 'RSRP', value: this.metricValue(metrics.rsrp) },
      { label: 'RSRQ', value: this.metricValue(metrics.rsrq) },
      { label: 'SINR', value: this.metricValue(metrics.sinr) }
    ];
  }

  performanceLabel(): string {
    if (!this.totalVisibleCases) {
      return 'No active field execution right now';
    }

    const ratio = (this.completedCasesCount / this.totalVisibleCases) * 100;
    return `${Math.round(ratio)}% completion in this field workspace`;
  }

  private readRouteIntent(): void {
    const params = this.route.snapshot.queryParamMap;
    const focus = params.get('focus');
    const panel = params.get('panel');
    const caseId = params.get('caseId');

    if (focus === 'urgent' || focus === 'rdv' || focus === 'work' || focus === 'all') {
      this.quickFilter = focus;
    }

    if (panel === 'details' || panel === 'rdv' || panel === 'work') {
      this.routeIntentPanel = panel;
    }

    this.routeIntentCaseId = caseId;
  }

  private applyRouteIntent(): void {
    if (!this.routeIntentCaseId) {
      return;
    }

    const target = this.cases.find((item) => item.id === this.routeIntentCaseId);
    if (!target) {
      return;
    }

    this.openPanel(target, this.routeIntentPanel);
    this.routeIntentCaseId = null;
  }

  private loadCaseDetails(caseId: string): void {
    this.panelLoading = true;
    this.panelError = null;

    this.casesService.getCaseById(caseId)
      .pipe(finalize(() => {
        this.panelLoading = false;
      }))
      .subscribe({
        next: (fullCase) => {
          this.selectedCaseDetails = fullCase;
          this.replaceCase(fullCase);
        },
        error: (err) => {
          console.error('Failed to load TECH case details', err);
          this.panelError = err?.error?.message ?? 'Latest case details are unavailable.';
        }
      });
  }

  loadTechStock(resetSelection = false): void {
    if (!this.isTechRole || this.techStockLoading) {
      return;
    }

    this.techStockLoading = true;
    this.techStockError = null;

    if (resetSelection) {
      this.usageLines = [{ equipmentId: '', quantity: '' }];
    }

    this.stockService.getMyTechStock()
      .pipe(finalize(() => {
        this.techStockLoading = false;
      }))
      .subscribe({
        next: (stock) => {
          this.techStock = stock;
          this.syncUsageSelection();
        },
        error: (err) => {
          console.error('Failed to load TECH stock helper', err);
          this.techStockError = err?.error?.message ?? 'Stock helper is unavailable right now.';
        }
      });
  }

  private matchesQuickFilter(item: CaseResponse): boolean {
    switch (this.quickFilter) {
      case 'urgent': {
        const status = this.snapshotSlaStatus(item);
        return status === 'WARNING' || status === 'BREACHED' || status === 'COMPLETED_LATE';
      }
      case 'rdv':
        return this.canSetRdv(item);
      case 'work':
        return this.canSubmitWork(item);
      case 'all':
      default:
        return true;
    }
  }

  private priorityScore(item: CaseResponse): number {
    const deadlinePenalty = 100 - this.snapshotSlaProgress(item);
    const statusPriority = item.status === 'RDV_SET'
      ? -10
      : item.status === 'ASSIGNED_TO_TECH' || item.status === 'ASSIGNED_TO_STT'
        ? 0
        : 20;
    const proofPenalty = this.hasPendingProof(item) ? -5 : 0;
    return deadlinePenalty + statusPriority + proofPenalty;
  }

  private snapshotSlaStatus(item: CaseResponse): SlaStatus | null {
    return item.slaTracking?.status ?? resolveLiveSla(item, this.nowEpochMs).status;
  }

  private snapshotSlaProgress(item: CaseResponse): number {
    const progress = item.slaTracking?.progressPercent;
    if (typeof progress === 'number' && Number.isFinite(progress)) {
      return Math.max(0, Math.min(100, progress));
    }

    return resolveLiveSla(item, this.nowEpochMs).progressPercent;
  }

  private createEmptyRdvForm(): TechRdvForm {
    return {
      joignable: true,
      datePriseRdv: '',
      causeInjoignabilite: '',
      detail: '',
      cmtRdv: '',
      abandon: false,
      causeAbandon: ''
    };
  }

  private createEmptyWorkForm(): TechWorkForm {
    return {
      repTravauxStt: '',
      dateFinTrv: '',
      cmtTrvStt: '',
      nombrePv: '',
      debitDl: '',
      debitUl: '',
      rsrp: '',
      rsrq: '',
      sinr: ''
    };
  }

  private createRdvForm(item: CaseResponse): TechRdvForm {
    const rdv = extractRdv(item);

    return {
      joignable: rdv.joignable !== false,
      datePriseRdv: toDateTimeLocal(rdv.datePriseRdv),
      causeInjoignabilite: rdv.causeInjoignabilite ?? '',
      detail: rdv.detail ?? '',
      cmtRdv: rdv.cmtRdv ?? '',
      abandon: rdv.abandon ?? false,
      causeAbandon: rdv.causeAbandon ?? ''
    };
  }

  private createWorkForm(item: CaseResponse): TechWorkForm {
    const work = extractWork(item);
    const metrics = extractMetrics(item);

    return {
      repTravauxStt: work.repTravauxStt ?? '',
      dateFinTrv: toDateTimeLocal(work.dateFinTrv) || toDateTimeLocal(new Date().toISOString()),
      cmtTrvStt: work.cmtTrvStt ?? '',
      nombrePv: toInputNumber(metrics.nombrePv),
      debitDl: toInputNumber(metrics.debitDl),
      debitUl: toInputNumber(metrics.debitUl),
      rsrp: toInputNumber(metrics.rsrp),
      rsrq: toInputNumber(metrics.rsrq),
      sinr: toInputNumber(metrics.sinr)
    };
  }

  private buildWorkPayload(location: TechGeoSnapshot): CompleteWorkRequest | null {
    const repTravauxStt = this.workForm.repTravauxStt.trim();
    const dateFinTrv = toIso(this.workForm.dateFinTrv);
    const cmtTrvStt = this.workForm.cmtTrvStt.trim();

    if (!repTravauxStt || !dateFinTrv || !cmtTrvStt) {
      this.banner = { tone: 'danger', text: 'Work result, end time, and comment are required.' };
      return null;
    }

    return {
      repTravauxStt,
      dateFinTrv,
      cmtTrvStt,
      nombrePv: toMaybeNumber(this.workForm.nombrePv),
      debitDl: toMaybeNumber(this.workForm.debitDl),
      debitUl: toMaybeNumber(this.workForm.debitUl),
      rsrp: toMaybeNumber(this.workForm.rsrp),
      rsrq: toMaybeNumber(this.workForm.rsrq),
      sinr: toMaybeNumber(this.workForm.sinr),
      locationLatitude: location.latitude,
      locationLongitude: location.longitude,
      locationCapturedAt: location.capturedAt,
      locationAccuracyMeters: location.accuracyMeters ?? undefined
    };
  }

  private metricValue(value?: number | null): string {
    return value == null ? '-' : String(value);
  }

  private buildOptimisticRdvCase(item: CaseResponse, payload: SetRdvRequest): CaseResponse {
    const nextStatus: CaseStatus = !payload.joignable
      ? 'NOT_REACHABLE'
      : payload.abandon
        ? 'ABANDONED'
        : 'RDV_SET';

    const currentRdv = extractRdv(item);
    const nextUpdatedAt = new Date().toISOString();

    return {
      ...item,
      status: nextStatus,
      updatedAt: nextUpdatedAt,
      joignable: payload.joignable,
      datePriseRdv: payload.datePriseRdv,
      causeInjoignabilite: payload.causeInjoignabilite ?? undefined,
      detail: payload.detail,
      cmtRdv: payload.cmtRdv,
      abandon: payload.abandon,
      causeAbandon: payload.causeAbandon ?? undefined,
      rdv: {
        ...currentRdv,
        joignable: payload.joignable,
        datePriseRdv: payload.datePriseRdv,
        causeInjoignabilite: payload.causeInjoignabilite ?? undefined,
        detail: payload.detail,
        cmtRdv: payload.cmtRdv,
        abandon: payload.abandon,
        causeAbandon: payload.causeAbandon ?? undefined
      }
    };
  }

  private cloneCase(item: CaseResponse): CaseResponse {
    return JSON.parse(JSON.stringify(item)) as CaseResponse;
  }

  private replaceCase(updated: CaseResponse): void {
    this.cases = this.cases.map((item) => item.id === updated.id ? updated : item);

    if (!this.cases.some((item) => item.id === updated.id)) {
      this.cases = [updated, ...this.cases];
    }

    this.syncCurrentPage();
  }

  private get currentPageValue(): number {
    return this.clampPage(this.currentPage, this.totalVisibleCases);
  }

  private syncCurrentPage(): void {
    this.currentPage = this.clampPage(this.currentPage, this.totalVisibleCases);
  }

  private focusCasePage(caseId: string): void {
    const caseIndex = this.visibleCases.findIndex((item) => item.id === caseId);
    if (caseIndex < 0) {
      return;
    }

    this.currentPage = Math.floor(caseIndex / this.pageSize) + 1;
  }

  private clampPage(page: number, visibleCount: number): number {
    const totalPages = Math.max(1, Math.ceil(visibleCount / this.pageSize));
    return Math.min(Math.max(page, 1), totalPages);
  }

  private loadProofDrafts(): void {
    try {
      const raw = localStorage.getItem(TechActivationCasesComponent.PROOF_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      this.proofDrafts = this.normalizeProofDrafts(parsed);
    } catch {
      this.proofDrafts = {};
    }
  }

  private persistProofDrafts(): void {
    localStorage.setItem(
      TechActivationCasesComponent.PROOF_STORAGE_KEY,
      JSON.stringify(this.proofDrafts)
    );
  }

  private upsertProofDraft(draft: TechProofDraft): void {
    this.proofDrafts = {
      ...this.proofDrafts,
      [draft.caseId]: draft
    };

    this.persistProofDrafts();
  }

  private removeProofDraft(caseId: string): void {
    const nextDrafts = { ...this.proofDrafts };
    delete nextDrafts[caseId];
    this.proofDrafts = nextDrafts;
    this.persistProofDrafts();
  }

  private async uploadProofDraft(caseId: string): Promise<'uploaded' | 'queued'> {
    const draft = this.proofDrafts[caseId];
    if (!draft || !draft.location) {
      return 'queued';
    }

    try {
      const file = this.dataUrlToFile(draft);
      const updated = await firstValueFrom(this.casesService.uploadWorkProof(caseId, file, {
        locationLatitude: draft.location.latitude,
        locationLongitude: draft.location.longitude,
        locationCapturedAt: draft.location.capturedAt,
        locationAccuracyMeters: draft.location.accuracyMeters ?? null,
        captureSource: draft.captureSource
      }));
      this.replaceCase(updated);

      if (this.selectedCaseId === updated.id) {
        this.selectedCaseDetails = updated;
      }

      this.removeProofDraft(caseId);
      return 'uploaded';
    } catch (err: any) {
      const message = err?.error?.message ?? 'Proof photo upload failed';

      this.upsertProofDraft({
        ...draft,
        lastError: message
      });

      return 'queued';
    }
  }

  private async syncProofAfterWork(caseId: string): Promise<void> {
    if (this.backgroundProofSyncCaseId === caseId) {
      return;
    }

    this.backgroundProofSyncCaseId = caseId;

    try {
      const result = await this.uploadProofDraft(caseId);

      if (result === 'uploaded') {
        this.banner = { tone: 'success', text: 'Work submitted and proof photo synced successfully.' };
        this.loadCaseDetails(caseId);
      } else {
        this.banner = {
          tone: 'warning',
          text: 'Work was submitted, but the proof photo is still queued on this device because the proof endpoint did not accept it yet.'
        };
      }
    } finally {
      if (this.backgroundProofSyncCaseId === caseId) {
        this.backgroundProofSyncCaseId = null;
      }
    }
  }

  private async syncRdvAfterLocalSave(
    caseId: string,
    payload: SetRdvRequest,
    previousSnapshot: CaseResponse
  ): Promise<void> {
    if (this.backgroundRdvSyncCaseId === caseId) {
      return;
    }

    this.backgroundRdvSyncCaseId = caseId;

    try {
      const updated = await firstValueFrom(this.casesService.setRdv(caseId, payload));
      this.replaceCase(updated);

      if (this.selectedCaseId === updated.id) {
        this.selectedCaseDetails = updated;
      }

      this.banner = { tone: 'success', text: 'RDV saved. The task card and SLA block are now updated.' };
      this.loadPerformance();
    } catch (err: any) {
      console.error('Failed to save TECH RDV in background sync', err);
      this.replaceCase(previousSnapshot);

      if (this.selectedCaseId === previousSnapshot.id) {
        this.selectedCaseDetails = previousSnapshot;
        this.activePanel = 'rdv';
      }

      this.banner = { tone: 'danger', text: err?.error?.message ?? 'Unable to save the RDV.' };
    } finally {
      if (this.backgroundRdvSyncCaseId === caseId) {
        this.backgroundRdvSyncCaseId = null;
      }
    }
  }

  private dataUrlToFile(draft: TechProofDraft): File {
    const [metadata, data] = draft.dataUrl.split(',');
    const mimeMatch = metadata.match(/data:(.*?);base64/);
    const mimeType = mimeMatch?.[1] || draft.mimeType || 'image/jpeg';
    const binary = atob(data);
    const buffer = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      buffer[index] = binary.charCodeAt(index);
    }

    return new File([buffer], draft.fileName, { type: mimeType });
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Unable to generate image preview'));
      };

      reader.onerror = () => reject(reader.error ?? new Error('Unable to read image file'));
      reader.readAsDataURL(file);
    });
  }

  private async captureCurrentLocation(
    actionLabel: string,
    mode: 'proof' | 'work' = 'work',
    fallbackLocation: TechGeoSnapshot | null = null
  ): Promise<TechGeoSnapshot | null> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      const message = 'This browser cannot provide GPS coordinates for this action.';
      this.locationError = message;
      this.banner = { tone: 'danger', text: message };
      return null;
    }

    const permissionState = await this.getLocationPermissionState();
    if (permissionState === 'denied') {
      const message = 'Location access is blocked for this site. Allow Location in the browser site settings, then try again.';
      this.locationError = message;
      this.banner = { tone: 'danger', text: message };
      return null;
    }

    this.locationBusy = true;

    try {
      const attempts: PositionOptions[] = mode === 'proof'
        ? [
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 120000
            },
            {
              enableHighAccuracy: true,
              timeout: 9000,
              maximumAge: 0
            }
          ]
        : [
            {
              enableHighAccuracy: false,
              timeout: 2500,
              maximumAge: 300000
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 60000
            }
          ];

      let lastError: unknown = null;

      for (const attempt of attempts) {
        try {
          const position = await this.requestCurrentPosition(attempt);

          return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
            capturedAt: new Date(position.timestamp || Date.now()).toISOString()
          };
        } catch (error: unknown) {
          lastError = error;

          if (this.isPermissionDeniedError(error)) {
            break;
          }
        }
      }

      if (mode === 'work' && fallbackLocation && !this.isPermissionDeniedError(lastError)) {
        return fallbackLocation;
      }

      const message = this.geolocationErrorMessage(lastError, actionLabel);
      this.locationError = message;
      this.banner = { tone: 'danger', text: message };
      return null;
    } finally {
      this.locationBusy = false;
    }
  }

  private async flushPendingFormChanges(): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }

    const activeElement = document.activeElement;
    if (
      !(activeElement instanceof HTMLInputElement)
      && !(activeElement instanceof HTMLTextAreaElement)
      && !(activeElement instanceof HTMLSelectElement)
    ) {
      return;
    }

    this.syncPendingFieldValue(activeElement.name, activeElement.value);
    activeElement.blur();

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0);
    });
  }

  private syncPendingFieldValue(fieldName: string, fieldValue: string): void {
    switch (fieldName) {
      case 'rdvDatePriseRdv':
        this.rdvForm.datePriseRdv = fieldValue;
        break;
      case 'rdvCauseInjoignabilite':
        this.rdvForm.causeInjoignabilite = fieldValue;
        break;
      case 'rdvDetail':
        this.rdvForm.detail = fieldValue;
        break;
      case 'rdvComment':
        this.rdvForm.cmtRdv = fieldValue;
        break;
      case 'rdvCauseAbandon':
        this.rdvForm.causeAbandon = fieldValue;
        break;
      case 'workRepTravauxStt':
        this.workForm.repTravauxStt = fieldValue;
        break;
      case 'workDateFinTrv':
        this.workForm.dateFinTrv = fieldValue;
        break;
      case 'workCmtTrvStt':
        this.workForm.cmtTrvStt = fieldValue;
        break;
      case 'workNombrePv':
        this.workForm.nombrePv = fieldValue;
        break;
      case 'workDebitDl':
        this.workForm.debitDl = fieldValue;
        break;
      case 'workDebitUl':
        this.workForm.debitUl = fieldValue;
        break;
      case 'workRsrp':
        this.workForm.rsrp = fieldValue;
        break;
      case 'workRsrq':
        this.workForm.rsrq = fieldValue;
        break;
      case 'workSinr':
        this.workForm.sinr = fieldValue;
        break;
      default:
        break;
    }
  }

  private requestCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  private async getLocationPermissionState(): Promise<LocationPermissionState> {
    if (typeof navigator === 'undefined' || !('permissions' in navigator) || !navigator.permissions?.query) {
      return 'unsupported';
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state;
    } catch {
      return 'unsupported';
    }
  }

  private geolocationErrorMessage(error: unknown, actionLabel: string): string {
    const base = `Location permission is required to ${actionLabel}.`;

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return `${base} This page is not in a secure context. On phones, GPS usually works only on HTTPS or localhost.`;
    }

    if (typeof error === 'object' && error != null && 'code' in error) {
      const code = Number((error as GeolocationPositionError).code);

      if (code === 1) {
        return `${base} Allow Location for this site in the browser prompt or site settings, then try again.`;
      }

      if (code === 2) {
        return `${base} Turn on the device GPS/location service, then try again.`;
      }

      if (code === 3) {
        return `${base} The location request timed out. Wait a few seconds for the phone to lock the position, then try again.`;
      }
    }

    return `${base} Try again once location service is available on the device.`;
  }

  private isPermissionDeniedError(error: unknown): boolean {
    return typeof error === 'object'
      && error != null
      && 'code' in error
      && Number((error as GeolocationPositionError).code) === 1;
  }

  private mapLinkForCoordinates(latitude?: number | null, longitude?: number | null): string | null {
    if (latitude == null || longitude == null) {
      return null;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  private coordinateLabel(latitude?: number | null, longitude?: number | null): string {
    if (latitude == null || longitude == null) {
      return '-';
    }

    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }

  private accuracyLabel(accuracyMeters?: number | null): string {
    if (accuracyMeters == null || !Number.isFinite(accuracyMeters)) {
      return 'accuracy unavailable';
    }

    return `+/- ${Math.round(accuracyMeters)} m`;
  }

  private normalizeProofDrafts(raw: unknown): Record<string, TechProofDraft> {
    if (!raw || typeof raw !== 'object') {
      return {};
    }

    const normalized: Record<string, TechProofDraft> = {};

    for (const [caseId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      const draft = value as Partial<TechProofDraft> & {
        location?: Partial<TechGeoSnapshot>;
      };

      if (!draft.fileName || !draft.mimeType || !draft.dataUrl || !draft.capturedAt) {
        continue;
      }

      if (!draft.location || typeof draft.location.latitude !== 'number' || typeof draft.location.longitude !== 'number') {
        continue;
      }

      normalized[caseId] = {
        caseId,
        fileName: draft.fileName,
        mimeType: draft.mimeType,
        dataUrl: draft.dataUrl,
        capturedAt: draft.capturedAt,
        captureSource: draft.captureSource === 'gallery' ? 'gallery' : 'camera',
        location: {
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          accuracyMeters: typeof draft.location.accuracyMeters === 'number' ? draft.location.accuracyMeters : null,
          capturedAt: draft.location.capturedAt || draft.capturedAt
        },
        lastError: draft.lastError ?? null
      };
    }

    return normalized;
  }

  private startClock(): void {
    this.clockHandle = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      this.nowEpochMs = Date.now();
    }, TechActivationCasesComponent.CLOCK_TICK_MS);
  }

  private startResync(): void {
    this.resyncHandle = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      if (this.selectedCaseId || this.actionBusy || this.panelLoading || this.locationBusy) {
        return;
      }

      if (!this.loading && !this.syncing) {
        this.syncing = true;
        this.loadCases();
      }

      if (!this.performanceLoading) {
        this.loadPerformance();
      }
    }, TechActivationCasesComponent.RESYNC_MS);
  }

  private get currentUserEmail(): string {
    return (this.authStore.user()?.email ?? '').trim().toLowerCase();
  }

  private canAccessFieldWorkspace(item: CaseResponse): boolean {
    return this.isCaseOwnedByTech(item) || this.isCaseOwnedBySttSelfExecutor(item);
  }

  private isCaseOwnedByCurrentExecutor(item: CaseResponse): boolean {
    return this.isCaseOwnedByTech(item) || this.isCaseOwnedBySttSelfExecutor(item);
  }

  private isCaseOwnedByTech(item: CaseResponse): boolean {
    if ((item.techEmail ?? '').trim().toLowerCase() !== this.currentUserEmail || !item.techId) {
      return false;
    }

    if (!item.executionMode && !item.executorRole && !item.executorId) {
      return true;
    }

    return item.executionMode === 'TECH_EXECUTION'
      && item.executorRole === 'TECH'
      && item.executorId === item.techId;
  }

  private isCaseOwnedBySttSelfExecutor(item: CaseResponse): boolean {
    return (item.sttEmail ?? '').trim().toLowerCase() === this.currentUserEmail
      && item.executionMode === 'STT_SELF_EXECUTION'
      && item.executorRole === 'STT'
      && !!item.sttId
      && item.executorId === item.sttId;
  }

  private syncUsageSelection(): void {
    if (!this.usageLines.length) {
      this.usageLines = [{ equipmentId: '', quantity: '' }];
    }
  }

  private toNullable(value?: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }
}
