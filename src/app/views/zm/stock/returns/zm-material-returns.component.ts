import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, of, tap, timeout } from 'rxjs';

import { MaterialReturnService } from '../../../../core/stock/material-return.service';
import {
  MaterialReturn,
  MaterialReturnStatus,
  ProposeHandoverRequest,
  ReturnCondition,
  ReturnDestination,
  ReturnReason,
  ReturnSource,
  ReviewMaterialReturnRequest,
  RETURN_CONDITION_LABELS,
  RETURN_DESTINATION_LABELS,
  RETURN_REASON_LABELS,
  RETURN_SOURCE_LABELS,
} from '../../../../core/stock/material-return.model';
import {
  ZM_AWAITING_ACTION_STATUSES,
  ZM_CONFIRMED_STATUSES,
  ZM_RESCHEDULE_REQUEST_STATUSES,
  ZM_SCHEDULE_PROPOSED_STATUSES,
  canZmProposeSchedule,
  canZmRejectReturn,
  isCompleted,
  isRejected,
  isRescheduleRequested,
  isScheduleConfirmed,
  isScheduleProposed,
  isWaitingForSttConfirmation,
  isWaitingForZmReview,
  statusBadgeClassForReturn,
  statusLabelForReturn,
} from '../../../../core/stock/material-return-status.util';

type ActiveTab = 'pending' | 'all';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

@Component({
  selector: 'app-zm-material-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zm-material-returns.component.html',
  styleUrls: ['./zm-material-returns.component.scss'],
})
export class ZmMaterialReturnsComponent implements OnInit {
  private static readonly ACTION_TIMEOUT_MS = 20000;

  private readonly returnService = inject(MaterialReturnService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private viewDestroyed = false;

  loading = true;
  refreshing = false;
  allReturns: MaterialReturn[] = [];
  activeTab: ActiveTab = 'pending';

  selectedReturn: MaterialReturn | null = null;
  proposeTarget: MaterialReturn | null = null;
  rejectTarget: MaterialReturn | null = null;

  actionLoading = false;
  handoverLoadingId: string | null = null;
  proposeError = '';
  rejectError = '';
  rejectComment = '';
  historySearch = '';
  historyFilter: MaterialReturnStatus | '' = '';
  pendingReturnId: string | null = null;

  proposeForm = {
    handoverDate: '',
    handoverTime: '',
    handoverNote: '',
  };

  toasts: Toast[] = [];
  private toastId = 0;

  readonly timePresets = ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00'];
  readonly historyStatuses: MaterialReturnStatus[] = Array.from(
    new Set<MaterialReturnStatus>([
      ...ZM_AWAITING_ACTION_STATUSES,
      ...ZM_SCHEDULE_PROPOSED_STATUSES,
      ...ZM_RESCHEDULE_REQUEST_STATUSES,
      ...ZM_CONFIRMED_STATUSES,
      'REJECTED',
      'HANDED_OVER',
      'RECEIVED',
      'COMPLETED',
      'CLOSED',
    ]),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.viewDestroyed = true;
    });
  }

  get todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get pendingReturns(): MaterialReturn[] {
    return this.allReturns.filter((item) => this.canZmProposeSchedule(item));
  }

  get awaitingActionCount(): number {
    return this.allReturns.filter((item) => this.isWaitingForZmReview(item)).length;
  }

  get scheduleProposedCount(): number {
    return this.allReturns.filter((item) => this.isWaitingForSttConfirmation(item)).length;
  }

  get rescheduleRequestCount(): number {
    return this.allReturns.filter((item) => this.isRescheduleRequested(item)).length;
  }

  get confirmedCount(): number {
    return this.allReturns.filter((item) => this.isScheduleConfirmed(item)).length;
  }

  get filteredHistory(): MaterialReturn[] {
    return this.allReturns.filter((item) => {
      if (this.historyFilter && item.status !== this.historyFilter) {
        return false;
      }

      if (!this.historySearch.trim()) {
        return true;
      }

      const query = this.historySearch.trim().toLowerCase();
      return (
        item.returnCode.toLowerCase().includes(query) ||
        (item.sttName || '').toLowerCase().includes(query) ||
        (item.sttEmail || '').toLowerCase().includes(query) ||
        (item.crmCase || '').toLowerCase().includes(query)
      );
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.pendingReturnId = params.get('returnId');
      if (!this.loading) {
        this.handlePendingReturnId();
      }
      this.requestViewRefresh();
    });

    this.loadReturns();
  }

  refresh(): void {
    if (this.refreshing) {
      return;
    }

    this.refreshing = true;
    this.returnService
      .getZmReturns()
      .pipe(
        timeout(ZmMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        tap((response) => console.debug('[MaterialReturn][ZM] manual refresh getZmReturns()', response)),
        catchError((error) => {
          console.error('[MaterialReturn][ZM] manual refresh getZmReturns() failed', error);
          this.toast('Unable to refresh material returns.', 'error');
          return of<MaterialReturn[]>([]);
        }),
        finalize(() => {
          this.refreshing = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe((returns) => {
        this.allReturns = this.sortReturns(returns);
        this.handlePendingReturnId();
        this.requestViewRefresh();
      });
  }

  openDetail(returnItem: MaterialReturn): void {
    this.selectedReturn = returnItem;
    this.requestViewRefresh();
  }

  openProposeSchedule(returnItem: MaterialReturn): void {
    this.proposeTarget = returnItem;
    this.proposeForm = {
      handoverDate: returnItem.proposedHandoverDate || '',
      handoverTime: returnItem.proposedHandoverTime || '',
      handoverNote: returnItem.proposedHandoverNote || '',
    };
    this.proposeError = '';
    this.actionLoading = false;
    this.requestViewRefresh();
  }

  openRejectModal(returnItem: MaterialReturn): void {
    this.rejectTarget = returnItem;
    this.rejectComment = '';
    this.rejectError = '';
    this.actionLoading = false;
    this.requestViewRefresh();
  }

  closeAllModals(): void {
    this.selectedReturn = null;
    this.proposeTarget = null;
    this.rejectTarget = null;
    this.proposeError = '';
    this.rejectError = '';
    this.rejectComment = '';
    this.actionLoading = false;
    this.requestViewRefresh();
  }

  submitProposeSchedule(): void {
    if (!this.proposeTarget || this.actionLoading) {
      return;
    }

    if (!this.proposeForm.handoverDate) {
      this.proposeError = 'Handover date is required.';
      this.requestViewRefresh();
      return;
    }
    if (!this.proposeForm.handoverTime) {
      this.proposeError = 'Handover time is required.';
      this.requestViewRefresh();
      return;
    }

    const payload: ProposeHandoverRequest = {
      handoverDate: this.proposeForm.handoverDate,
      handoverTime: this.proposeForm.handoverTime,
      handoverNote: this.proposeForm.handoverNote.trim() || undefined,
    };

    this.actionLoading = true;
    this.proposeError = '';
    console.debug('[MaterialReturn][ZM] proposeSchedule start', {
      returnId: this.proposeTarget.id,
      returnCode: this.proposeTarget.returnCode,
      payload,
    });

    this.returnService
      .proposeSchedule(this.proposeTarget.id, payload)
      .pipe(
        timeout(ZmMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        finalize(() => {
          console.debug('[MaterialReturn][ZM] proposeSchedule finalize');
          this.actionLoading = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe({
        next: (updated) => {
          console.debug('[MaterialReturn][ZM] proposeSchedule success', updated);
          this.actionLoading = false;
          this.upsertReturn(updated);
          this.proposeTarget = null;
          this.toast('Schedule proposed successfully.', 'success');
          this.reloadReturns();
          this.requestViewRefresh();
        },
        error: (error) => {
          console.error('[MaterialReturn][ZM] proposeSchedule failed', error);
          this.actionLoading = false;
          this.proposeError = this.resolveActionError(error, 'Unable to propose the schedule.');
          this.requestViewRefresh();
        },
      });
  }

  confirmReject(): void {
    if (!this.rejectTarget || this.actionLoading) {
      return;
    }

    const comment = this.rejectComment.trim();
    if (!comment) {
      this.rejectError = 'A rejection reason is required.';
      this.requestViewRefresh();
      return;
    }

    const payload: ReviewMaterialReturnRequest = {
      reviewComment: comment,
    };

    this.actionLoading = true;
    this.rejectError = '';
    console.debug('[MaterialReturn][ZM] rejectReturn start', {
      returnId: this.rejectTarget.id,
      returnCode: this.rejectTarget.returnCode,
      payload,
    });

    this.returnService
      .rejectReturn(this.rejectTarget.id, payload)
      .pipe(
        timeout(ZmMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        finalize(() => {
          console.debug('[MaterialReturn][ZM] rejectReturn finalize');
          this.actionLoading = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe({
        next: (updated) => {
          console.debug('[MaterialReturn][ZM] rejectReturn success', updated);
          this.actionLoading = false;
          this.upsertReturn(updated);
          this.rejectTarget = null;
          this.rejectComment = '';
          this.toast('Return request rejected successfully.', 'success');
          this.reloadReturns();
          this.requestViewRefresh();
        },
        error: (error) => {
          console.error('[MaterialReturn][ZM] rejectReturn failed', error);
          this.actionLoading = false;
          this.rejectError = this.resolveActionError(error, 'Unable to reject the return request.');
          this.requestViewRefresh();
        },
      });
  }

  markHandedOver(returnItem: MaterialReturn): void {
    if (this.handoverLoadingId) {
      return;
    }

    this.handoverLoadingId = returnItem.id;
    console.debug('[MaterialReturn][ZM] markHandedOver start', {
      returnId: returnItem.id,
      returnCode: returnItem.returnCode,
    });
    this.returnService
      .markHandedOver(returnItem.id)
      .pipe(
        timeout(ZmMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        finalize(() => {
          console.debug('[MaterialReturn][ZM] markHandedOver finalize');
          this.handoverLoadingId = null;
          this.requestViewRefresh();
        }),
      )
      .subscribe({
        next: (updated) => {
          console.debug('[MaterialReturn][ZM] markHandedOver success', updated);
          this.handoverLoadingId = null;
          this.upsertReturn(updated);
          this.toast('Return marked as handed over.', 'success');
          this.reloadReturns();
          this.requestViewRefresh();
        },
        error: (error) => {
          console.error('[MaterialReturn][ZM] markHandedOver failed', error);
          this.handoverLoadingId = null;
          this.toast(this.resolveActionError(error, 'Unable to mark the return as handed over.'), 'error');
          this.requestViewRefresh();
        },
      });
  }

  isWaitingForZmReview(returnItem: MaterialReturn | null | undefined): boolean {
    return isWaitingForZmReview(returnItem);
  }

  isWaitingForSttConfirmation(returnItem: MaterialReturn | null | undefined): boolean {
    return isWaitingForSttConfirmation(returnItem);
  }

  isScheduleProposed(returnItem: MaterialReturn | null | undefined): boolean {
    return isScheduleProposed(returnItem);
  }

  isScheduleConfirmed(returnItem: MaterialReturn | null | undefined): boolean {
    return isScheduleConfirmed(returnItem);
  }

  isRescheduleRequested(returnItem: MaterialReturn | null | undefined): boolean {
    return isRescheduleRequested(returnItem);
  }

  isRejected(returnItem: MaterialReturn | null | undefined): boolean {
    return isRejected(returnItem);
  }

  isCompleted(returnItem: MaterialReturn | null | undefined): boolean {
    return isCompleted(returnItem);
  }

  canZmProposeSchedule(returnItem: MaterialReturn | null | undefined): boolean {
    return canZmProposeSchedule(returnItem);
  }

  canZmRejectReturn(returnItem: MaterialReturn | null | undefined): boolean {
    return canZmRejectReturn(returnItem);
  }

  statusLabel(returnItem: MaterialReturn | MaterialReturnStatus): string {
    return statusLabelForReturn(returnItem);
  }

  statusBadgeClass(returnItem: MaterialReturn | MaterialReturnStatus): string {
    return statusBadgeClassForReturn(returnItem);
  }

  sourceLabel(value?: ReturnSource): string {
    return value ? RETURN_SOURCE_LABELS[value] ?? value : 'Not specified';
  }

  reasonLabel(value?: ReturnReason): string {
    return value ? RETURN_REASON_LABELS[value] ?? value : 'Not specified';
  }

  conditionLabel(value?: ReturnCondition): string {
    return value ? RETURN_CONDITION_LABELS[value] ?? value : 'Not specified';
  }

  destinationLabel(value?: ReturnDestination): string {
    return value ? RETURN_DESTINATION_LABELS[value] ?? value : 'Not specified';
  }

  timelineLabel(eventType: string): string {
    return eventType.replace(/_/g, ' ');
  }

  trackByReturn(_: number, item: MaterialReturn): string {
    return item.id;
  }

  trackByTimeline(_: number, event: { timestamp: string; eventType: string }): string {
    return `${event.timestamp}-${event.eventType}`;
  }

  private loadReturns(): void {
    this.loading = true;

    this.returnService
      .getZmReturns()
      .pipe(
        tap((response) => console.debug('[MaterialReturn][ZM] getZmReturns()', response)),
        catchError((error) => {
          console.error('[MaterialReturn][ZM] getZmReturns() failed', error);
          this.toast('Unable to load material returns.', 'error');
          return of<MaterialReturn[]>([]);
        }),
        finalize(() => {
          this.loading = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe((returns) => {
        this.allReturns = this.sortReturns(returns);
        this.handlePendingReturnId();
        this.requestViewRefresh();
      });
  }

  private reloadReturns(): void {
    this.returnService
      .getZmReturns()
      .pipe(
        tap((response) => console.debug('[MaterialReturn][ZM] reload getZmReturns()', response)),
        catchError((error) => {
          console.error('[MaterialReturn][ZM] reload getZmReturns() failed', error);
          this.toast('Unable to refresh material returns.', 'error');
          return of<MaterialReturn[]>([]);
        }),
      )
      .subscribe((returns) => {
        this.allReturns = this.sortReturns(returns);
        this.handlePendingReturnId();
        this.requestViewRefresh();
      });
  }

  private handlePendingReturnId(): void {
    if (!this.pendingReturnId) {
      return;
    }

    const identifier = this.pendingReturnId;
    const existing = this.allReturns.find((item) => item.id === identifier || item.returnCode === identifier);
    if (existing) {
      this.pendingReturnId = null;
      this.openNotificationTarget(existing);
      return;
    }

    this.pendingReturnId = null;
    this.returnService
      .getReturnById(identifier)
      .pipe(
        catchError((error) => {
          console.error('[MaterialReturn][ZM] getReturnById() failed', error);
          return of<MaterialReturn | null>(null);
        }),
      )
      .subscribe((returnItem) => {
        if (!returnItem) {
          this.requestViewRefresh();
          return;
        }
        this.upsertReturn(returnItem);
        this.openNotificationTarget(returnItem);
        this.requestViewRefresh();
      });
  }

  private openNotificationTarget(returnItem: MaterialReturn): void {
    if (this.canZmProposeSchedule(returnItem)) {
      this.openProposeSchedule(returnItem);
      return;
    }
    this.openDetail(returnItem);
  }

  private upsertReturn(returnItem: MaterialReturn): void {
    const next = [...this.allReturns];
    const index = next.findIndex((item) => item.id === returnItem.id);
    if (index >= 0) {
      next[index] = returnItem;
    } else {
      next.unshift(returnItem);
    }
    this.allReturns = this.sortReturns(next);

    if (this.selectedReturn?.id === returnItem.id) {
      this.selectedReturn = returnItem;
    }
    if (this.proposeTarget?.id === returnItem.id) {
      this.proposeTarget = returnItem;
    }
    if (this.rejectTarget?.id === returnItem.id) {
      this.rejectTarget = returnItem;
    }
    this.requestViewRefresh();
  }

  private sortReturns(items: MaterialReturn[]): MaterialReturn[] {
    return [...items].sort((left, right) => {
      const leftDate = left.createdAt ?? left.submittedAt ?? '';
      const rightDate = right.createdAt ?? right.submittedAt ?? '';
      return rightDate.localeCompare(leftDate);
    });
  }

  private toast(message: string, type: 'success' | 'error'): void {
    const id = ++this.toastId;
    this.toasts = [...this.toasts, { id, message, type }];
    this.requestViewRefresh();
    setTimeout(() => {
      this.toasts = this.toasts.filter((item) => item.id !== id);
      this.requestViewRefresh();
    }, 4000);
  }

  private resolveActionError(error: unknown, fallback: string): string {
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return 'The request took too long to finish. Check the backend logs and try again.';
    }
    return (error as { error?: { message?: string } })?.error?.message ?? fallback;
  }

  private requestViewRefresh(): void {
    queueMicrotask(() => {
      if (this.viewDestroyed) {
        return;
      }
      this.cdr.detectChanges();
    });
  }
}
