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
  metrageCable: string;
  nombrePv: string;
  debitDl: string;
  debitUl: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}

interface TechProofDraft {
  caseId: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  capturedAt: string;
  lastError?: string | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective],
  templateUrl: './tech-activation-cases.component.html',
  styleUrl: './tech-activation-cases.component.scss'
})
export class TechActivationCasesComponent implements OnInit, OnDestroy {
  private static readonly CLOCK_TICK_MS = 1000;
  private static readonly RESYNC_MS = 60000;
  private static readonly PROOF_STORAGE_KEY = 'tech-work-proof-drafts-v1';
  private static readonly MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;

  private readonly casesService = inject(CasesService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationsStore = inject(NotificationStoreService);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  performanceLoading = false;
  actionBusy = false;
  syncing = false;
  error: string | null = null;
  panelError: string | null = null;
  banner: TechBanner | null = null;

  cases: CaseResponse[] = [];
  performance: PerformanceSummaryResponse | null = null;

  searchTerm = '';
  statusFilter: '' | CaseStatus = '';
  quickFilter: TechQuickFilter = 'urgent';

  selectedCaseId: string | null = null;
  selectedCaseDetails: CaseResponse | null = null;
  activePanel: TechPanel = 'details';
  panelLoading = false;

  rdvForm: TechRdvForm = this.createEmptyRdvForm();
  workForm: TechWorkForm = this.createEmptyWorkForm();
  proofDrafts: Record<string, TechProofDraft> = {};

  private routeIntentCaseId: string | null = null;
  private routeIntentPanel: TechPanel = 'details';
  private nowEpochMs = Date.now();
  private clockHandle: ReturnType<typeof setInterval> | null = null;
  private resyncHandle: ReturnType<typeof setInterval> | null = null;

  readonly statusOptions: Array<{ value: '' | CaseStatus; label: string }> = [
    { value: '', label: 'All statuses' },
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

  get accessibleCases(): CaseResponse[] {
    return this.cases.filter((item) => this.isCaseOwnedByTech(item));
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
    const relevant = new Set(['CASE_ASSIGNED_TO_TECH', 'SLA_WARNING', 'SLA_BREACHED', 'SLA_ESCALATED']);

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
      .sort((left, right) => this.priorityScore(left) - this.priorityScore(right));
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
    return this.isCaseOwnedByTech(item)
      && ['ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE'].includes(item.status);
  }

  canSubmitWork(item: CaseResponse): boolean {
    return this.isCaseOwnedByTech(item)
      && ['ASSIGNED_TO_TECH', 'RDV_SET'].includes(item.status);
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

  openPanel(item: CaseResponse, panel: TechPanel): void {
    this.banner = null;
    this.panelError = null;
    this.selectedCaseId = item.id;
    this.activePanel = panel;
    this.selectedCaseDetails = this.selectedCaseDetails?.id === item.id ? this.selectedCaseDetails : null;

    if (panel === 'rdv') {
      this.rdvForm = this.createRdvForm(item);
    }

    if (panel === 'work') {
      this.workForm = this.createWorkForm(item);
    }

    this.loadCaseDetails(item.id);
  }

  closePanel(): void {
    this.selectedCaseId = null;
    this.selectedCaseDetails = null;
    this.activePanel = 'details';
    this.panelLoading = false;
    this.panelError = null;
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

    this.actionBusy = true;
    this.banner = null;

    try {
      const updated = await firstValueFrom(this.casesService.setRdv(target.id, payload));
      this.replaceCase(updated);
      this.selectedCaseDetails = updated;
      this.banner = { tone: 'success', text: 'RDV saved. The task card and SLA block are now updated.' };
      this.activePanel = 'details';
      this.loadPerformance();
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

    if (!this.currentProofDraft) {
      this.banner = { tone: 'danger', text: 'Attach a proof photo before submitting work.' };
      return;
    }

    const payload = this.buildWorkPayload();
    if (!payload) {
      return;
    }

    this.actionBusy = true;
    this.banner = null;

    try {
      const updated = await firstValueFrom(this.casesService.completeWork(target.id, payload));
      this.replaceCase(updated);
      this.selectedCaseDetails = updated;

      const proofResult = await this.uploadProofDraft(target.id);

      if (proofResult === 'uploaded') {
        this.banner = { tone: 'success', text: 'Work and proof photo submitted successfully.' };
      } else {
        this.banner = {
          tone: 'warning',
          text: 'Work was submitted, but the proof photo is still queued on this device because the proof endpoint did not accept it yet.'
        };
      }

      this.activePanel = 'details';
      this.loadPerformance();
      this.loadCaseDetails(target.id);
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

  async onProofFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file || !this.selectedCaseId) {
      if (input) {
        input.value = '';
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.banner = { tone: 'danger', text: 'Use an image file for proof.' };
      input.value = '';
      return;
    }

    if (file.size > TechActivationCasesComponent.MAX_PHOTO_SIZE_BYTES) {
      this.banner = { tone: 'danger', text: 'Proof photo must stay under 8 MB for reliable mobile upload.' };
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
      lastError: null
    });

    this.banner = { tone: 'info', text: 'Proof photo ready. It will be sent right after the work payload.' };
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
    return draft.lastError
      ? `Captured ${capturedAt}. Pending backend sync.`
      : `Captured ${capturedAt}. Ready to send.`;
  }

  uploadedProofCaption(proof: CaseProofFile): string {
    const uploadedAt = proof.createdAt ? new Date(proof.createdAt).toLocaleString() : 'unknown time';
    const uploadedBy = proof.uploadedBy?.trim() ? proof.uploadedBy : 'unknown user';
    return `Uploaded ${uploadedAt} by ${uploadedBy}`;
  }

  proofStatusClass(item: CaseResponse): string {
    const draft = this.proofDrafts[item.id];
    return draft?.lastError
      ? 'bg-warning-subtle text-warning-emphasis tech-pill'
      : 'bg-dark-subtle text-dark-emphasis tech-pill';
  }

  detailMetricEntries(item: CaseResponse): Array<{ label: string; value: string }> {
    const metrics = extractMetrics(item);

    return [
      { label: 'Cable', value: this.metricValue(metrics.metrageCable) },
      { label: 'PV', value: this.metricValue(metrics.nombrePv) },
      { label: 'DL', value: this.metricValue(metrics.debitDl) },
      { label: 'UL', value: this.metricValue(metrics.debitUl) },
      { label: 'RSRP', value: this.metricValue(metrics.rsrp) },
      { label: 'RSRQ', value: this.metricValue(metrics.rsrq) },
      { label: 'SINR', value: this.metricValue(metrics.sinr) }
    ];
  }

  performanceLabel(): string {
    if (!this.performance) {
      return 'Waiting for performance snapshot';
    }

    return `${this.performance.workCompletionProgress.toFixed(0)}% completion`;
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

  private matchesQuickFilter(item: CaseResponse): boolean {
    switch (this.quickFilter) {
      case 'urgent': {
        const status = this.slaStatus(item);
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
    const sla = resolveLiveSla(item, this.nowEpochMs);
    const deadlinePenalty = 100 - sla.progressPercent;
    const statusPriority = item.status === 'RDV_SET' ? -10 : item.status === 'ASSIGNED_TO_TECH' ? 0 : 20;
    const proofPenalty = this.hasPendingProof(item) ? -5 : 0;
    return deadlinePenalty + statusPriority + proofPenalty;
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
      metrageCable: '',
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
      metrageCable: toInputNumber(metrics.metrageCable),
      nombrePv: toInputNumber(metrics.nombrePv),
      debitDl: toInputNumber(metrics.debitDl),
      debitUl: toInputNumber(metrics.debitUl),
      rsrp: toInputNumber(metrics.rsrp),
      rsrq: toInputNumber(metrics.rsrq),
      sinr: toInputNumber(metrics.sinr)
    };
  }

  private buildWorkPayload(): CompleteWorkRequest | null {
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
      metrageCable: toMaybeNumber(this.workForm.metrageCable),
      nombrePv: toMaybeNumber(this.workForm.nombrePv),
      debitDl: toMaybeNumber(this.workForm.debitDl),
      debitUl: toMaybeNumber(this.workForm.debitUl),
      rsrp: toMaybeNumber(this.workForm.rsrp),
      rsrq: toMaybeNumber(this.workForm.rsrq),
      sinr: toMaybeNumber(this.workForm.sinr)
    };
  }

  private metricValue(value?: number | null): string {
    return value == null ? '-' : String(value);
  }

  private replaceCase(updated: CaseResponse): void {
    this.cases = this.cases.map((item) => item.id === updated.id ? updated : item);

    if (!this.cases.some((item) => item.id === updated.id)) {
      this.cases = [updated, ...this.cases];
    }
  }

  private loadProofDrafts(): void {
    try {
      const raw = localStorage.getItem(TechActivationCasesComponent.PROOF_STORAGE_KEY);
      this.proofDrafts = raw ? JSON.parse(raw) : {};
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
    if (!draft) {
      return 'queued';
    }

    try {
      const file = this.dataUrlToFile(draft);
      const updated = await firstValueFrom(this.casesService.uploadWorkProof(caseId, file));
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

  private startClock(): void {
    this.clockHandle = setInterval(() => {
      this.nowEpochMs = Date.now();
    }, TechActivationCasesComponent.CLOCK_TICK_MS);
  }

  private startResync(): void {
    this.resyncHandle = setInterval(() => {
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

  private isCaseOwnedByTech(item: CaseResponse): boolean {
    return (item.techEmail ?? '').trim().toLowerCase() === this.currentUserEmail;
  }

  private toNullable(value?: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }
}
