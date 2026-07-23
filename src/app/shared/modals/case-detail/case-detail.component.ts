import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  BadgeComponent,
  ButtonCloseDirective,
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import {
  CASE_STATUS_UI,
  CaseProofFile,
  CaseResponse,
  CaseStatus,
  CaseTimelineEvent,
  caseSupportsMetrics
} from '../../../core/cases/models/case.model';
import { StockService } from '../../../core/stock/stock.service';
import { PermissionItemDetail, StockUsagePermission, PermissionStatus } from '../../../core/stock/stock.model';
import { formatMaterialQuantity } from '../../../core/stock/material-quantity.util';
import { LocationActionsComponent } from '../../components/location-actions/location-actions.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { CaseMessage, CaseMessagesService } from '../../../core/cases/case-messages.service';
import { CaseMessagesStore } from '../../../core/cases/case-messages.store';
import { NotificationStoreService } from '../../../core/notifications/notification-store.service';
import { NotificationItem } from '../../../core/notifications/models/notification.model';
import {
  CASE_TYPE_LABEL_KEYS,
  COMPLAINT_CATEGORY_LABEL_KEYS,
  EXECUTION_MODE_LABEL_KEYS,
  PERMISSION_STATUS_LABEL_KEYS,
  RESOLUTION_VALIDATION_LABEL_KEYS,
  ROLE_LABEL_KEYS
} from '../../../core/i18n/ui-labels';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    BadgeComponent,
    IconDirective,
    TranslocoModule,
    LocationActionsComponent
  ],
  templateUrl: './case-detail.component.html',
  styleUrl: './case-detail.component.scss'
})
export class CaseDetailComponent implements OnChanges, OnDestroy {
  /** Safety-net poll cadence while the modal is open; realtime WS push is the primary path. */
  private static readonly MESSAGES_POLL_MS = 15_000;

  private readonly stockService = inject(StockService);
  private readonly authStore = inject(AuthStore);
  private readonly caseMessagesService = inject(CaseMessagesService);
  private readonly caseMessagesStore = inject(CaseMessagesStore);
  private readonly notificationStore = inject(NotificationStoreService);
  private readonly transloco = inject(TranslocoService);

  @Input() visible = false;
  @Input() caseData: CaseResponse | null = null;

  casePermissions: StockUsagePermission[] = [];
  permissionsLoading = false;

  // ── Discussion (ZM ↔ STT case chat) state ─────────────────────────────────
  messages: CaseMessage[] = [];
  messagesLoading = false;
  messagesError: string | null = null;
  messagesForbidden = false;
  sendingMessage = false;
  messageDraft = '';
  messageAttachment: File | null = null;
  private messagesPollTimer: ReturnType<typeof setInterval> | null = null;
  private messagesRealtimeSub: Subscription | null = null;

  @ViewChild('chatScroll') private chatScroll?: ElementRef<HTMLDivElement>;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<CaseResponse>();

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible']?.currentValue === true || changes['caseData']) && this.visible && this.caseData?.id) {
      this.loadPermissions(this.caseData.id);
      this.startDiscussion(this.caseData.id);
    }
    if (changes['visible']?.currentValue === false) {
      this.casePermissions = [];
      this.stopDiscussion();
    }
  }

  ngOnDestroy(): void {
    this.stopMessagesPolling();
  }

  private loadPermissions(caseId: string): void {
    this.permissionsLoading = true;
    this.stockService.getPermissionsByCase(caseId).subscribe({
      next: (list) => {
        this.casePermissions = list.filter(p => p.status !== 'CANCELLED')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.permissionsLoading = false;
      },
      error: () => { this.permissionsLoading = false; }
    });
  }

  // ── Discussion (ZM ↔ STT case chat) ────────────────────────────────────────

  /** Discussion is shown to the case participants (ZM/STT) and to admins for audit. */
  get discussionVisible(): boolean {
    const role = this.authStore.role();
    return !this.messagesForbidden
      && (role === 'ROLE_ADMIN' || role === 'ROLE_ZM' || role === 'ROLE_STT');
  }

  /** Admin is read-only; only ZM and STT can write. */
  get canWriteMessages(): boolean {
    const role = this.authStore.role();
    return role === 'ROLE_ZM' || role === 'ROLE_STT';
  }

  /** A ZM cannot start the discussion before an STT is assigned to the case. */
  get discussionBlockedReason(): string | null {
    if (!this.canWriteMessages || !this.caseData) {
      return null;
    }
    if (this.authStore.role() === 'ROLE_ZM' && !this.caseData.sttId && !this.caseData.sttEmail) {
      return this.transloco.translate('caseDetail.discussion.assignSttFirst');
    }
    return null;
  }

  get canSendNow(): boolean {
    return !this.sendingMessage
      && !this.discussionBlockedReason
      && (this.messageDraft.trim().length > 0 || !!this.messageAttachment);
  }

  private startDiscussion(caseId: string): void {
    this.messagesForbidden = false;
    this.messagesError = null;
    this.messageDraft = '';
    this.messageAttachment = null;
    this.loadMessages(caseId, true);
    this.stopMessagesPolling();

    // Instant delivery: reload the thread the moment a message push for THIS case
    // arrives over the WebSocket. The poll below is only a safety net.
    this.messagesRealtimeSub = this.notificationStore.realtime$.subscribe((incoming) => {
      if (incoming?.eventType === 'CASE_MESSAGE_RECEIVED' && this.matchesCase(incoming, caseId)) {
        this.loadMessages(caseId, false);
      }
    });

    this.messagesPollTimer = setInterval(
      () => this.loadMessages(caseId, false),
      CaseDetailComponent.MESSAGES_POLL_MS
    );
  }

  /** True when a realtime notification refers to the given case. */
  private matchesCase(notification: NotificationItem, caseId: string): boolean {
    return notification.relatedCaseId === caseId
      || notification.entityId === caseId
      || notification.data?.['caseId'] === caseId;
  }

  private stopDiscussion(): void {
    this.stopMessagesPolling();
    this.messages = [];
    this.messageDraft = '';
    this.messageAttachment = null;
    this.messagesError = null;
    this.messagesForbidden = false;
  }

  private stopMessagesPolling(): void {
    if (this.messagesPollTimer) {
      clearInterval(this.messagesPollTimer);
      this.messagesPollTimer = null;
    }
    this.messagesRealtimeSub?.unsubscribe();
    this.messagesRealtimeSub = null;
  }

  private loadMessages(caseId: string, showSpinner: boolean): void {
    if (!this.discussionVisible) {
      return;
    }
    if (showSpinner) {
      this.messagesLoading = true;
    }
    this.caseMessagesService.getMessages(caseId).subscribe({
      next: (list) => {
        const grew = list.length > this.messages.length;
        this.messages = list;
        this.messagesLoading = false;
        this.messagesError = null;
        if (showSpinner || grew) {
          this.scrollChatToBottom();
        }
        this.markThreadRead(caseId, list);
      },
      error: (err) => {
        this.messagesLoading = false;
        if (err?.status === 403) {
          // TECH or a non-participant: hide the section instead of erroring.
          this.messagesForbidden = true;
          this.stopMessagesPolling();
          return;
        }
        this.messagesError = err?.error?.message ?? this.transloco.translate('caseDetail.discussion.loadFailed');
      }
    });
  }

  private markThreadRead(caseId: string, list: CaseMessage[]): void {
    const hasUnreadForMe = list.some(m => !m.mine && !m.read);
    if (!hasUnreadForMe || !this.canWriteMessages) {
      return;
    }
    this.caseMessagesService.markThreadRead(caseId).subscribe({
      next: () => {
        this.messages = this.messages.map(m => m.mine ? m : { ...m, read: true });
        this.caseMessagesStore.refresh();
      },
      error: () => { /* badge poll will self-correct */ }
    });
  }

  sendMessage(): void {
    const caseId = this.caseData?.id;
    if (!caseId || !this.canSendNow) {
      return;
    }

    this.sendingMessage = true;
    this.messagesError = null;
    this.caseMessagesService.sendMessage(caseId, this.messageDraft, this.messageAttachment).subscribe({
      next: () => {
        this.messageDraft = '';
        this.messageAttachment = null;
        this.sendingMessage = false;
        this.loadMessages(caseId, false);
      },
      error: (err) => {
        this.sendingMessage = false;
        this.messagesError = err?.error?.message ?? this.transloco.translate('caseDetail.discussion.sendFailed');
      }
    });
  }

  private scrollChatToBottom(): void {
    setTimeout(() => {
      const el = this.chatScroll?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  onMessageAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !file.type.startsWith('image/')) {
      this.messagesError = this.transloco.translate('caseDetail.discussion.imageOnly');
      input.value = '';
      return;
    }
    this.messagesError = null;
    this.messageAttachment = file;
    input.value = '';
  }

  clearMessageAttachment(): void {
    this.messageAttachment = null;
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  messageRoleLabel(role: string): string {
    const key = ROLE_LABEL_KEYS[role as keyof typeof ROLE_LABEL_KEYS];
    return key ? this.transloco.translate(key) : (role?.replace('ROLE_', '') ?? '');
  }

  trackByMessageId(_: number, item: CaseMessage): string {
    return item.id;
  }

  permissionStatusLabel(status: PermissionStatus): string {
    const key = PERMISSION_STATUS_LABEL_KEYS[status];
    return this.transloco.translate(key ?? status);
  }

  permissionStatusColor(status: PermissionStatus): string {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'PARTIALLY_APPROVED': return 'info';
      case 'REJECTED': return 'danger';
      default: return 'secondary';
    }
  }

  permissionItemLabel(item: PermissionItemDetail): string {
    return `${formatMaterialQuantity(item.requestedQuantity, item.unit)} ${item.itemName}`;
  }

  onClose(): void {
    this.close.emit();
    this.visibleChange.emit(false);
  }

  handleVisibleChange(v: boolean): void {
    if (!v) {
      this.close.emit();
    }
    this.visibleChange.emit(v);
  }

  onDownload(): void {
    if (this.caseData) {
      this.download.emit(this.caseData);
    }
  }

  statusBadgeClass(status?: CaseStatus | null): string {
    if (!status) return 'bg-secondary-subtle text-secondary-emphasis';
    return CASE_STATUS_UI[status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
  }

  statusLabel(status?: CaseStatus | null): string {
    if (!status) return this.transloco.translate('common.notSpecified');
    return this.transloco.translate(CASE_STATUS_UI[status]?.label ?? status);
  }

  val(value: string | null | undefined): string {
    const s = (value ?? '').trim();
    return s || this.transloco.translate('common.notSpecified');
  }

  numVal(value: number | null | undefined): string {
    if (value == null) return this.transloco.translate('common.notSpecified');
    return String(value);
  }

  boolVal(value: boolean | null | undefined): string {
    if (value == null) return this.transloco.translate('common.notSpecified');
    return this.transloco.translate(value ? 'common.yes' : 'common.no');
  }

  dateVal(value: string | null | undefined): string {
    if (!value) return this.transloco.translate('common.notSpecified');
    try {
      return new Date(value).toLocaleString(this.currentLocale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return value;
    }
  }

  humanizeStatus(value?: string | null): string {
    if (!value?.trim()) return this.transloco.translate('common.notSpecified');

    const normalized = value.trim().toUpperCase();
    const translatedKey =
      (EXECUTION_MODE_LABEL_KEYS as Record<string, string>)[normalized] ??
      (COMPLAINT_CATEGORY_LABEL_KEYS as Record<string, string>)[normalized] ??
      (RESOLUTION_VALIDATION_LABEL_KEYS as Record<string, string>)[normalized] ??
      (CASE_TYPE_LABEL_KEYS as Record<string, string>)[normalized];

    if (translatedKey) {
      return this.transloco.translate(translatedKey);
    }

    return normalized.toLowerCase().split('_')
      .map(p => p ? p[0].toUpperCase() + p.slice(1) : '')
      .join(' ');
  }

  typeLabel(value?: string | null): string {
    if (!value?.trim()) {
      return this.transloco.translate('common.notSpecified');
    }

    const key = (CASE_TYPE_LABEL_KEYS as Record<string, string>)[value.trim().toUpperCase()];
    return key ? this.transloco.translate(key) : value;
  }

  get hasLocation(): boolean {
    const c = this.caseData;
    return !!(c?.latitude || c?.longitude);
  }

  get hasWorkLocation(): boolean {
    const work = this.caseData?.work;
    return work?.locationLatitude != null && work?.locationLongitude != null;
  }

  get hasProofs(): boolean {
    return (this.caseData?.workProofs?.length ?? 0) > 0;
  }

  get proofs(): CaseProofFile[] {
    return [...(this.caseData?.workProofs ?? [])];
  }

  get hasMetrics(): boolean {
    const m = this.caseData?.metrics;
    // `!= null` keeps a valid zero (0 is a real metric value, not "absent").
    return !!(m?.nombrePv != null ||
              m?.debitDl != null || m?.debitUl != null ||
              m?.rsrp != null || m?.rsrq != null || m?.sinr != null ||
              // fall back to legacy top-level fields for older cases
              this.caseData?.nombrePv != null || this.caseData?.debitDl != null ||
              this.caseData?.debitUl != null || this.caseData?.rsrp != null ||
              this.caseData?.rsrq != null || this.caseData?.sinr != null);
  }

  /**
   * Metrics section is shown for Activation AND Complaint, never for Résiliation.
   * (RES is a PLAINTE case discriminated by module/source.)
   */
  get showMetricsSection(): boolean {
    return caseSupportsMetrics(this.caseData) && this.hasMetrics;
  }

  get sortedTimeline(): CaseTimelineEvent[] {
    if (!this.caseData?.timeline?.length) return [];
    return [...this.caseData.timeline].sort((a, b) => {
      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    });
  }

  timelineIconName(eventType: string): string {
    const t = eventType?.toLowerCase() ?? '';
    if (t.includes('stock_usage_permission')) return 'cilStorage';
    if (t.includes('assign')) return 'cilUserFollow';
    if (t.includes('rdv') || t.includes('appointment')) return 'cilCalendar';
    if (t.includes('work') || t.includes('complet')) return 'cilTask';
    if (t.includes('validat') || t.includes('approv')) return 'cilCheckCircle';
    if (t.includes('reject') || t.includes('abandon')) return 'cilBan';
    if (t.includes('create')) return 'cilFile';
    if (t.includes('close')) return 'cilLockLocked';
    if (t.includes('escalat')) return 'cilWarning';
    if (t.includes('reopen')) return 'cilReload';
    return 'cilHistory';
  }

  hasProofLocation(proof?: CaseProofFile | null): boolean {
    return proof?.locationLatitude != null && proof?.locationLongitude != null;
  }

  coordinateLabel(latitude?: number | string | null, longitude?: number | string | null): string {
    const normalizedLatitude = this.parseCoordinate(latitude);
    const normalizedLongitude = this.parseCoordinate(longitude);

    if (normalizedLatitude == null || normalizedLongitude == null) {
      return this.transloco.translate('common.notSpecified');
    }

    return `${normalizedLatitude.toFixed(6)}, ${normalizedLongitude.toFixed(6)}`;
  }

  mapLink(latitude?: number | string | null, longitude?: number | string | null): string | null {
    const normalizedLatitude = this.parseCoordinate(latitude);
    const normalizedLongitude = this.parseCoordinate(longitude);

    if (normalizedLatitude == null || normalizedLongitude == null) {
      return null;
    }

    return `https://maps.google.com/?q=${normalizedLatitude},${normalizedLongitude}`;
  }

  accuracyLabel(value?: number | null): string {
    if (value == null || Number.isNaN(value)) {
      return this.transloco.translate('common.notSpecified');
    }

    return `${Math.round(value)} m`;
  }

  proofSourceLabel(source?: string | null): string {
    const normalized = (source ?? '').trim().toLowerCase();

    switch (normalized) {
      case 'camera':
        return this.transloco.translate('caseDetail.proofSource.camera');
      case 'gallery':
        return this.transloco.translate('caseDetail.proofSource.gallery');
      case 'speedtest_screenshot':
        return this.transloco.translate('caseDetail.proofSource.speedtestScreenshot');
      case 'signal_screenshot':
        return this.transloco.translate('caseDetail.proofSource.signalScreenshot');
      default:
        if (!normalized) {
          return this.transloco.translate('caseDetail.proofSource.attachment');
        }

        return normalized
          .split(/[_-]+/)
          .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
          .join(' ');
    }
  }

  private currentLocale(): string {
    switch (this.transloco.getActiveLang()) {
      case 'ar':
        return 'ar-TN';
      case 'en':
        return 'en-US';
      default:
        return 'fr-TN';
    }
  }

  proofFileUrl(proof?: CaseProofFile | null): string | null {
    const viewUrl = proof?.viewUrl?.trim();
    const downloadUrl = proof?.downloadUrl?.trim();
    return viewUrl || downloadUrl || null;
  }

  hasProofFile(proof?: CaseProofFile | null): boolean {
    return !!this.proofFileUrl(proof);
  }

  hasProofPreview(proof?: CaseProofFile | null): boolean {
    return this.isImageProof(proof) && !!this.proofFileUrl(proof);
  }

  proofTitle(proof: CaseProofFile, index: number): string {
    const filename = proof.originalFilename?.trim();
    return filename || `Proof ${index + 1}`;
  }

  private isImageProof(proof?: CaseProofFile | null): boolean {
    const contentType = proof?.contentType?.trim().toLowerCase();
    if (contentType) {
      return contentType.startsWith('image/');
    }

    const fileUrl = this.proofFileUrl(proof)?.toLowerCase() ?? '';
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif']
      .some((extension) => fileUrl.includes(extension));
  }

  private parseCoordinate(value?: number | string | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const text = (value ?? '').toString().trim();
    if (!text) {
      return null;
    }

    const normalized = Number(text.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : null;
  }
}
