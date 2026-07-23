import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { catchError, finalize, forkJoin, of, tap, timeout } from 'rxjs';

import { MaterialReturnService } from '../../../../core/stock/material-return.service';
import { RetrievedStockService } from '../../../../core/stock/retrieved-stock.service';
import {
  CreateMaterialReturnRequest,
  EligibleZmOption,
  MaterialReturn,
  MaterialReturnStatus,
  ReturnCondition,
  ReturnDestination,
  ReturnReason,
  ReturnSource,
  ReturnedItem,
  ReturnedItemRequest,
  RETURN_CONDITION_LABELS,
  RETURN_DESTINATION_LABELS,
  RETURN_REASON_LABELS,
  RETURN_SOURCE_LABELS,
} from '../../../../core/stock/material-return.model';
import {
  canSttReviewSchedule,
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
import { RetrievedStockItem } from '../../../../core/stock/retrieved-stock.model';
import {
  Equipment,
  EquipmentInstance,
  SttStock,
  TrackingMode,
} from '../../../../core/stock/stock.model';
import { StockService } from '../../../../core/stock/stock.service';

type CreateReturnSource = Extract<ReturnSource, 'STT_STOCK' | 'COLLECTED_ITEM_STOCK'>;

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface SearchableItem {
  equipmentId: string;
  equipmentName: string;
  articleCode: string;
  unit: string;
  availableQty: number;
  inSttStock: boolean;
  trackingMode: TrackingMode;
}

interface ItemRow {
  equipmentId: string;
  equipmentName: string;
  articleCode: string;
  unit: string;
  availableQty: number;
  inSttStock: boolean;
  quantity: number;
  condition: ReturnCondition | '';
  serialNumber: string;
  imei: string;
  instanceId: string;
  trackingMode: TrackingMode;
  trackedInstances: EquipmentInstance[];
  trackedLoading: boolean;
  trackedError: string;
}

interface SelectionSummaryGroup {
  equipmentId: string;
  equipmentName: string;
  unit: string;
  quantity: number;
}

@Component({
  selector: 'app-stt-material-returns',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './stt-material-returns.component.html',
  styleUrls: ['./stt-material-returns.component.scss'],
})
export class SttMaterialReturnsComponent implements OnInit {
  private static readonly ACTION_TIMEOUT_MS = 20000;

  private readonly returnService = inject(MaterialReturnService);
  private readonly retrievedStockService = inject(RetrievedStockService);
  private readonly stockService = inject(StockService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private viewDestroyed = false;

  loading = true;
  refreshing = false;
  returns: MaterialReturn[] = [];

  eligibleZms: EligibleZmOption[] = [];
  eligibleZmsLoading = false;

  allEquipment: Equipment[] = [];
  sttStock: SttStock | null = null;
  searchableItems: SearchableItem[] = [];
  filteredEquipment: SearchableItem[] = [];
  itemRows: ItemRow[] = [];
  itemSearch = '';

  eligibleCollectedItems: RetrievedStockItem[] = [];
  collectedItemsLoading = false;
  collectedItemsError = '';
  collectedSearch = '';
  selectedCollectedIds = new Set<string>();

  showCreateModal = false;
  selectedReturn: MaterialReturn | null = null;
  reviewReturn: MaterialReturn | null = null;

  createSubmitting = false;
  reviewSubmitting = false;
  formError = '';
  reviewError = '';
  reviewComment = '';

  pendingReturnId: string | null = null;

  toasts: Toast[] = [];
  private toastId = 0;

  form: {
    responsibleZmId: string;
    crmCase: string;
    returnSource: CreateReturnSource | '';
    reason: ReturnReason | '';
    condition: ReturnCondition | '';
    destination: ReturnDestination | '';
    comment: string;
  } = this.createEmptyForm();

  readonly sourceOptions = (['STT_STOCK', 'COLLECTED_ITEM_STOCK'] as const).map((value) => ({
    value,
    label: RETURN_SOURCE_LABELS[value],
  }));
  readonly reasonOptions = Object.entries(RETURN_REASON_LABELS).map(([value, label]) => ({
    value: value as ReturnReason,
    label,
  }));
  readonly conditionOptions = Object.entries(RETURN_CONDITION_LABELS).map(([value, label]) => ({
    value: value as ReturnCondition,
    label,
  }));
  readonly destinationOptions = Object.entries(RETURN_DESTINATION_LABELS).map(([value, label]) => ({
    value: value as ReturnDestination,
    label,
  }));

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.viewDestroyed = true;
    });
  }

  get waitingForZmReviewCount(): number {
    return this.returns.filter((item) => this.isWaitingForZmReview(item)).length;
  }

  get actionRequiredCount(): number {
    return this.returns.filter((item) => this.canSttReviewSchedule(item)).length;
  }

  get confirmedCount(): number {
    return this.returns.filter((item) => this.isScheduleConfirmed(item)).length;
  }

  get completedCount(): number {
    return this.returns.filter((item) => this.isCompleted(item)).length;
  }

  get actionRequiredReturns(): MaterialReturn[] {
    return this.returns.filter((item) => this.canSttReviewSchedule(item));
  }

  get isCollectedSource(): boolean {
    return this.form.returnSource === 'COLLECTED_ITEM_STOCK';
  }

  get isSttStockSource(): boolean {
    return this.form.returnSource === 'STT_STOCK';
  }

  get selectedCollectedItems(): RetrievedStockItem[] {
    return this.eligibleCollectedItems.filter((item) => this.selectedCollectedIds.has(item.id));
  }

  get filteredCollectedItems(): RetrievedStockItem[] {
    const query = this.collectedSearch.trim().toLowerCase();
    if (!query) {
      return this.eligibleCollectedItems;
    }

    return this.eligibleCollectedItems.filter((item) =>
      [
        item.equipmentName,
        item.articleCode,
        item.technicianName,
        item.crmCase,
        item.caseId,
        item.clientName,
        item.serialNumber,
        item.imei,
        item.caseUsageContext,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }

  get hasEligibleCollectedItems(): boolean {
    return this.eligibleCollectedItems.length > 0;
  }

  get allEligibleCollectedSelected(): boolean {
    return this.eligibleCollectedItems.length > 0
      && this.eligibleCollectedItems.every((item) => this.selectedCollectedIds.has(item.id));
  }

  get selectedItemCount(): number {
    return this.isCollectedSource ? this.selectedCollectedIds.size : this.itemRows.length;
  }

  get selectionSummaryGroups(): SelectionSummaryGroup[] {
    const groups = new Map<string, SelectionSummaryGroup>();
    const sourceItems = this.isCollectedSource
      ? this.selectedCollectedItems.map((item) => ({
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName || item.equipmentId,
          unit: item.unit || '',
          quantity: item.quantity,
        }))
      : this.itemRows.map((item) => ({
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          unit: item.unit,
          quantity: item.quantity,
        }));

    for (const item of sourceItems) {
      const key = `${item.equipmentId}::${item.unit || ''}`;
      const current = groups.get(key);
      if (current) {
        current.quantity += item.quantity;
      } else {
        groups.set(key, {
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          unit: item.unit || '',
          quantity: item.quantity,
        });
      }
    }

    return [...groups.values()].sort((left, right) => left.equipmentName.localeCompare(right.equipmentName));
  }

  get selectionSerializedIdentifiers(): string[] {
    const rawIdentifiers = this.isCollectedSource
      ? this.selectedCollectedItems.map((item) => this.buildIdentifierLine(item.equipmentName || item.equipmentId, item.serialNumber, item.imei))
      : this.itemRows
          .filter((item) => this.isTrackedRow(item))
          .map((item) => this.buildIdentifierLine(item.equipmentName, item.serialNumber, item.imei));
    return rawIdentifiers.filter((value): value is string => !!value);
  }

  get selectionOrigins(): string[] {
    if (!this.isCollectedSource) {
      return [];
    }

    const origins = new Set<string>();
    for (const item of this.selectedCollectedItems) {
      const technician = item.technicianName || 'Unknown technician';
      const caseRef = item.crmCase || item.caseId || 'No case';
      const caseType = item.caseUsageContext || 'N/A';
      origins.add(`${technician} • ${caseRef} (${caseType})`);
    }
    return [...origins.values()].sort((left, right) => left.localeCompare(right));
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.pendingReturnId = params.get('returnId');
      if (!this.loading) {
        this.handlePendingReturnId();
      }
      this.requestViewRefresh();
    });

    this.loadInitialData();
  }

  refresh(): void {
    if (this.refreshing) {
      return;
    }

    this.refreshing = true;
    this.returnService
      .getSttReturns()
      .pipe(
        timeout(SttMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        tap((response) => console.debug('[MaterialReturn][STT] manual refresh getSttReturns()', response)),
        catchError((error) => {
          console.error('[MaterialReturn][STT] manual refresh getSttReturns() failed', error);
          this.toast('Unable to refresh material returns.', 'error');
          return of<MaterialReturn[]>([]);
        }),
        finalize(() => {
          this.refreshing = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe((returns) => {
        this.returns = this.sortReturns(returns);
        this.handlePendingReturnId();
        this.requestViewRefresh();
      });
  }

  openCreateModal(): void {
    this.form = this.createEmptyForm('STT_STOCK');
    this.resetSourceSelectionState();
    this.formError = '';
    this.createSubmitting = false;
    this.showCreateModal = true;
    this.buildSearchableItems();
    this.loadEligibleZms();
    this.onReturnSourceChange(this.form.returnSource);
    this.requestViewRefresh();
  }

  openDetail(returnItem: MaterialReturn): void {
    this.selectedReturn = returnItem;
    this.requestViewRefresh();
  }

  openReviewSchedule(returnItem: MaterialReturn): void {
    this.reviewReturn = returnItem;
    this.reviewComment = '';
    this.reviewError = '';
    this.reviewSubmitting = false;
    this.requestViewRefresh();
  }

  closeAllModals(): void {
    this.showCreateModal = false;
    this.selectedReturn = null;
    this.reviewReturn = null;
    this.itemSearch = '';
    this.filteredEquipment = [];
    this.collectedSearch = '';
    this.formError = '';
    this.reviewError = '';
    this.reviewComment = '';
    this.createSubmitting = false;
    this.reviewSubmitting = false;
    this.requestViewRefresh();
  }

  onReturnSourceChange(nextSource: CreateReturnSource | ''): void {
    this.form.returnSource = nextSource;
    this.resetSourceSelectionState();
    this.formError = '';

    if (nextSource === 'STT_STOCK') {
      this.buildSearchableItems();
    }
    if (nextSource === 'COLLECTED_ITEM_STOCK') {
      this.loadCollectedReturnEligible();
    }
    this.requestViewRefresh();
  }

  filterEquipment(): void {
    const query = this.itemSearch.trim().toLowerCase();
    if (!query) {
      this.filteredEquipment = [];
      this.requestViewRefresh();
      return;
    }

    this.filteredEquipment = this.searchableItems
      .filter((item) =>
        item.equipmentName.toLowerCase().includes(query) || item.articleCode.toLowerCase().includes(query),
      )
      .slice(0, 10);
    this.requestViewRefresh();
  }

  isAlreadyAdded(equipmentId: string): boolean {
    return this.itemRows.some((item) => item.equipmentId === equipmentId);
  }

  selectEquipment(event: MouseEvent, item: SearchableItem): void {
    event.preventDefault();
    if (this.isAlreadyAdded(item.equipmentId)) {
      this.formError = `"${item.equipmentName}" is already in the request.`;
      this.requestViewRefresh();
      return;
    }

    const row: ItemRow = {
      equipmentId: item.equipmentId,
      equipmentName: item.equipmentName,
      articleCode: item.articleCode,
      unit: item.unit,
      availableQty: item.availableQty,
      inSttStock: item.inSttStock,
      quantity: this.isTrackedMode(item.trackingMode) ? 1 : 1,
      condition: '',
      serialNumber: '',
      imei: '',
      instanceId: '',
      trackingMode: item.trackingMode,
      trackedInstances: [],
      trackedLoading: false,
      trackedError: '',
    };

    this.itemRows.push(row);
    if (this.isTrackedRow(row)) {
      this.loadTrackedInstancesForRow(row);
    }

    this.itemSearch = '';
    this.filteredEquipment = [];
    this.formError = '';
    this.requestViewRefresh();
  }

  removeItem(index: number): void {
    this.itemRows.splice(index, 1);
    this.requestViewRefresh();
  }

  refreshTrackedInstances(row: ItemRow): void {
    this.loadTrackedInstancesForRow(row);
  }

  onTrackedInstanceChange(row: ItemRow): void {
    const selected = row.trackedInstances.find((item) => item.id === row.instanceId);
    row.serialNumber = selected?.serialNumber || '';
    row.imei = selected?.imei || '';
    row.quantity = 1;
    this.requestViewRefresh();
  }

  isTrackedRow(row: ItemRow): boolean {
    return this.isTrackedMode(row.trackingMode);
  }

  trackedInstanceLabel(instance: EquipmentInstance): string {
    const identifiers = [instance.serialNumber, instance.imei].filter(Boolean).join(' • ');
    return identifiers || instance.id;
  }

  isCollectedSelected(itemId: string): boolean {
    return this.selectedCollectedIds.has(itemId);
  }

  toggleCollectedSelection(item: RetrievedStockItem): void {
    if (this.selectedCollectedIds.has(item.id)) {
      this.selectedCollectedIds.delete(item.id);
    } else {
      this.selectedCollectedIds.add(item.id);
    }
    this.requestViewRefresh();
  }

  toggleSelectAllCollected(): void {
    if (this.allEligibleCollectedSelected) {
      this.selectedCollectedIds.clear();
    } else {
      this.eligibleCollectedItems.forEach((item) => this.selectedCollectedIds.add(item.id));
    }
    this.requestViewRefresh();
  }

  removeCollectedSelection(itemId: string): void {
    this.selectedCollectedIds.delete(itemId);
    this.requestViewRefresh();
  }

  proofLink(item: RetrievedStockItem | ReturnedItem): string | null {
    return item.proofViewUrl || item.proofDownloadUrl || null;
  }

  itemIdentifier(item: RetrievedStockItem | ReturnedItem): string {
    return [item.serialNumber, item.imei].filter(Boolean).join(' • ') || 'Not tracked';
  }

  submitReturn(): void {
    if (this.createSubmitting) {
      return;
    }

    const validationError = this.validateCreateForm();
    if (validationError) {
      this.formError = validationError;
      this.requestViewRefresh();
      return;
    }

    const payload: CreateMaterialReturnRequest = {
      responsibleZmId: this.form.responsibleZmId,
      crmCase: this.resolveCrmCase(),
      returnSource: this.form.returnSource as ReturnSource,
      reason: this.form.reason as ReturnReason,
      condition: this.resolveRequestCondition(),
      destination: this.form.destination as ReturnDestination,
      comment: this.form.comment.trim() || undefined,
      items: this.isCollectedSource
        ? []
        : this.itemRows.map(
            (item) =>
              ({
                equipmentId: item.equipmentId,
                quantity: item.quantity,
                condition: item.condition || undefined,
                serialNumber: item.serialNumber.trim() || undefined,
                imei: item.imei.trim() || undefined,
                instanceId: item.instanceId || undefined,
              }) as ReturnedItemRequest,
          ),
      retrievedStockItemIds: this.isCollectedSource ? this.selectedCollectedItems.map((item) => item.id) : undefined,
    };

    this.createSubmitting = true;
    this.formError = '';
    console.debug('[MaterialReturn][STT] createReturn start', payload);

    this.returnService
      .createReturn(payload)
      .pipe(
        timeout(SttMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        finalize(() => {
          console.debug('[MaterialReturn][STT] createReturn finalize');
          this.createSubmitting = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe({
        next: (created) => {
          console.debug('[MaterialReturn][STT] createReturn success', created);
          this.createSubmitting = false;
          this.upsertReturn(created);
          this.closeAllModals();
          this.toast('Material return request submitted successfully.', 'success');
          this.requestViewRefresh();
        },
        error: (error) => {
          console.error('[MaterialReturn][STT] createReturn failed', error);
          this.createSubmitting = false;
          this.formError = this.resolveActionError(error, 'Unable to submit the return request.');
          this.requestViewRefresh();
        },
      });
  }

  confirmSchedule(): void {
    if (!this.reviewReturn || this.reviewSubmitting) {
      return;
    }

    this.reviewSubmitting = true;
    this.reviewError = '';
    console.debug('[MaterialReturn][STT] acceptSchedule start', {
      returnId: this.reviewReturn.id,
      returnCode: this.reviewReturn.returnCode,
      comment: this.reviewComment,
    });

    this.returnService
      .acceptSchedule(this.reviewReturn.id, this.reviewComment.trim() || undefined)
      .pipe(
        timeout(SttMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        finalize(() => {
          console.debug('[MaterialReturn][STT] acceptSchedule finalize', {
            reviewSubmitting: this.reviewSubmitting,
            returnId: this.reviewReturn?.id,
          });
          this.reviewSubmitting = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe({
        next: (updated) => {
          console.debug('[MaterialReturn][STT] acceptSchedule success', updated);
          this.reviewSubmitting = false;
          this.upsertReturn(updated);
          this.reviewReturn = null;
          this.reviewComment = '';
          this.toast('Schedule confirmed successfully.', 'success');
          this.reloadReturns();
          this.requestViewRefresh();
        },
        error: (error) => {
          console.error('[MaterialReturn][STT] acceptSchedule failed', error);
          this.reviewSubmitting = false;
          this.reviewError = this.resolveActionError(error, 'Unable to confirm the schedule.');
          this.requestViewRefresh();
        },
      });
  }

  requestNewTime(): void {
    if (!this.reviewReturn || this.reviewSubmitting) {
      return;
    }

    const comment = this.reviewComment.trim();
    if (!comment) {
      this.reviewError = 'A comment is required when requesting a new time.';
      this.requestViewRefresh();
      return;
    }

    this.reviewSubmitting = true;
    this.reviewError = '';
    console.debug('[MaterialReturn][STT] requestReschedule start', {
      returnId: this.reviewReturn.id,
      returnCode: this.reviewReturn.returnCode,
      comment,
    });

    this.returnService
      .requestReschedule(this.reviewReturn.id, comment)
      .pipe(
        timeout(SttMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        finalize(() => {
          console.debug('[MaterialReturn][STT] requestReschedule finalize', {
            reviewSubmitting: this.reviewSubmitting,
            returnId: this.reviewReturn?.id,
          });
          this.reviewSubmitting = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe({
        next: (updated) => {
          console.debug('[MaterialReturn][STT] requestReschedule success', updated);
          this.reviewSubmitting = false;
          this.upsertReturn(updated);
          this.reviewReturn = null;
          this.reviewComment = '';
          this.toast('A new handover time has been requested.', 'success');
          this.reloadReturns();
          this.requestViewRefresh();
        },
        error: (error) => {
          console.error('[MaterialReturn][STT] requestReschedule failed', error);
          this.reviewSubmitting = false;
          this.reviewError = this.resolveActionError(error, 'Unable to request a new time.');
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

  canSttReviewSchedule(returnItem: MaterialReturn | null | undefined): boolean {
    return canSttReviewSchedule(returnItem);
  }

  statusLabel(returnItem: MaterialReturn | MaterialReturnStatus): string {
    return this.transloco.translate(statusLabelForReturn(returnItem));
  }

  statusBadgeClass(returnItem: MaterialReturn | MaterialReturnStatus): string {
    return statusBadgeClassForReturn(returnItem);
  }

  sourceLabel(value?: ReturnSource): string {
    return value
      ? this.transloco.translate(RETURN_SOURCE_LABELS[value] ?? value)
      : this.transloco.translate('common.notSpecified');
  }

  reasonLabel(value?: ReturnReason): string {
    return value
      ? this.transloco.translate(RETURN_REASON_LABELS[value] ?? value)
      : this.transloco.translate('common.notSpecified');
  }

  conditionLabel(value?: ReturnCondition): string {
    return value
      ? this.transloco.translate(RETURN_CONDITION_LABELS[value] ?? value)
      : this.transloco.translate('common.notSpecified');
  }

  destinationLabel(value?: ReturnDestination): string {
    return value
      ? this.transloco.translate(RETURN_DESTINATION_LABELS[value] ?? value)
      : this.transloco.translate('common.notSpecified');
  }

  trackByReturn(_: number, item: MaterialReturn): string {
    return item.id;
  }

  trackByTimeline(_: number, event: { timestamp: string; eventType: string }): string {
    return `${event.timestamp}-${event.eventType}`;
  }

  trackByItemRow(_: number, item: ItemRow): string {
    return item.equipmentId;
  }

  trackByCollectedItem(_: number, item: RetrievedStockItem): string {
    return item.id;
  }

  timelineLabel(eventType: string): string {
    return eventType.replace(/_/g, ' ');
  }

  private loadInitialData(): void {
    this.loading = true;

    forkJoin({
      returns: this.returnService.getSttReturns().pipe(
        tap((response) => console.debug('[MaterialReturn][STT] getSttReturns()', response)),
        catchError((error) => {
          console.error('[MaterialReturn][STT] getSttReturns() failed', error);
          this.toast('Unable to load material returns.', 'error');
          return of<MaterialReturn[]>([]);
        }),
      ),
      equipment: this.stockService.getEquipment().pipe(
        catchError((error) => {
          console.error('[MaterialReturn][STT] getEquipment() failed', error);
          return of<Equipment[]>([]);
        }),
      ),
      stock: this.stockService.getMySttStock().pipe(
        catchError((error) => {
          console.error('[MaterialReturn][STT] getMySttStock() failed', error);
          return of<SttStock | null>(null);
        }),
      ),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe(({ returns, equipment, stock }) => {
        this.returns = this.sortReturns(returns);
        this.allEquipment = equipment;
        this.sttStock = stock;
        this.buildSearchableItems();
        this.handlePendingReturnId();
        this.requestViewRefresh();
      });
  }

  private reloadReturns(): void {
    this.returnService
      .getSttReturns()
      .pipe(
        tap((response) => console.debug('[MaterialReturn][STT] reload getSttReturns()', response)),
        catchError((error) => {
          console.error('[MaterialReturn][STT] reload getSttReturns() failed', error);
          this.toast('Unable to refresh material returns.', 'error');
          return of<MaterialReturn[]>([]);
        }),
      )
      .subscribe((returns) => {
        this.returns = this.sortReturns(returns);
        this.handlePendingReturnId();
        this.requestViewRefresh();
      });
  }

  private loadEligibleZms(): void {
    this.eligibleZmsLoading = true;
    this.returnService
      .getEligibleZms()
      .pipe(
        finalize(() => {
          this.eligibleZmsLoading = false;
          this.requestViewRefresh();
        }),
        catchError((error) => {
          console.error('[MaterialReturn][STT] getEligibleZms() failed', error);
          this.toast('Unable to load responsible ZMs.', 'error');
          return of<EligibleZmOption[]>([]);
        }),
      )
      .subscribe((options) => {
        this.eligibleZms = options;
        this.requestViewRefresh();
      });
  }

  private buildSearchableItems(): void {
    const equipmentIndex = new Map<string, Equipment>();
    this.allEquipment.forEach((item) => equipmentIndex.set(item.id, item));

    this.searchableItems = (this.sttStock?.items ?? [])
      .filter((item) => item.availableQuantity > 0)
      .map((item) => {
        const equipment = equipmentIndex.get(item.equipmentId);
        return {
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName || equipment?.name || item.equipmentId,
          articleCode: equipment?.articleCode ?? '',
          unit: item.unit || equipment?.unit || '',
          availableQty: item.availableQuantity,
          inSttStock: true,
          trackingMode: equipment?.trackingMode ?? 'NONE',
        } satisfies SearchableItem;
      })
      .sort((left, right) => left.equipmentName.localeCompare(right.equipmentName));
  }

  private loadTrackedInstancesForRow(row: ItemRow): void {
    row.trackedLoading = true;
    row.trackedError = '';
    row.trackedInstances = [];
    row.instanceId = '';
    row.serialNumber = '';
    row.imei = '';

    this.stockService
      .getMySttInstances(row.equipmentId)
      .pipe(
        timeout(SttMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        catchError((error) => {
          console.error('[MaterialReturn][STT] getMySttInstances() failed', error);
          row.trackedError = this.resolveActionError(error, 'Unable to load tracked STT stock for this equipment.');
          return of<EquipmentInstance[]>([]);
        }),
        finalize(() => {
          row.trackedLoading = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe((instances) => {
        row.trackedInstances = instances ?? [];
        if (row.trackedInstances.length === 1) {
          row.instanceId = row.trackedInstances[0].id;
          this.onTrackedInstanceChange(row);
        }
        this.requestViewRefresh();
      });
  }

  private loadCollectedReturnEligible(): void {
    this.collectedItemsLoading = true;
    this.collectedItemsError = '';
    this.eligibleCollectedItems = [];

    this.retrievedStockService
      .getSttReturnEligible()
      .pipe(
        timeout(SttMaterialReturnsComponent.ACTION_TIMEOUT_MS),
        catchError((error) => {
          console.error('[MaterialReturn][STT] getSttReturnEligible() failed', error);
          this.collectedItemsError = this.resolveActionError(error, 'Unable to load collected item stock.');
          return of<RetrievedStockItem[]>([]);
        }),
        finalize(() => {
          this.collectedItemsLoading = false;
          this.requestViewRefresh();
        }),
      )
      .subscribe((items) => {
        this.eligibleCollectedItems = (items ?? []).sort((left, right) =>
          (right.collectedAt || '').localeCompare(left.collectedAt || ''),
        );
        this.requestViewRefresh();
      });
  }

  private handlePendingReturnId(): void {
    if (!this.pendingReturnId) {
      return;
    }

    const identifier = this.pendingReturnId;
    const existing = this.returns.find((item) => item.id === identifier || item.returnCode === identifier);
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
          console.error('[MaterialReturn][STT] getReturnById() failed', error);
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
    if (this.canSttReviewSchedule(returnItem)) {
      this.openReviewSchedule(returnItem);
      return;
    }
    this.openDetail(returnItem);
  }

  private validateCreateForm(): string | null {
    if (!this.form.responsibleZmId) {
      return 'Please select the responsible Zone Manager.';
    }
    if (!this.form.returnSource) {
      return 'Return source is required.';
    }
    if (!this.form.reason) {
      return 'Return reason is required.';
    }
    if (!this.form.destination) {
      return 'Destination is required.';
    }
    if (!this.isCollectedSource && !this.form.condition) {
      return 'Overall condition is required.';
    }
    if (this.form.reason === 'OTHER' && !this.form.comment.trim()) {
      return 'A comment is required when the reason is Other.';
    }

    if (this.isCollectedSource) {
      if (this.collectedItemsLoading) {
        return 'Collected item stock is still loading. Please wait a moment.';
      }
      if (this.selectedCollectedItems.length === 0) {
        return 'Select at least one collected item.';
      }
      return null;
    }

    if (this.itemRows.length === 0) {
      return 'At least one returned item is required.';
    }

    for (const item of this.itemRows) {
      if (!item.quantity || item.quantity <= 0) {
        return `Quantity must be greater than zero for "${item.equipmentName}".`;
      }
      if (!item.inSttStock) {
        return `"${item.equipmentName}" is not available in your STT stock.`;
      }
      if (this.isTrackedRow(item)) {
        if (item.quantity !== 1) {
          return `Tracked equipment "${item.equipmentName}" must be returned as one exact physical unit.`;
        }
        if (!item.instanceId) {
          return `Select the exact serial number or IMEI for "${item.equipmentName}".`;
        }
      } else if (item.quantity > item.availableQty) {
        return `"${item.equipmentName}" exceeds the available STT stock quantity.`;
      }
    }

    return null;
  }

  private resolveRequestCondition(): ReturnCondition {
    if (this.form.condition) {
      return this.form.condition;
    }
    const selectedConditions = this.selectedCollectedItems
      .map((item) => item.condition)
      .filter((value): value is ReturnCondition => !!value);
    if (selectedConditions.length === 0) {
      return 'UNKNOWN';
    }

    const priority: ReturnCondition[] = ['BROKEN', 'DAMAGED', 'RECONDITIONABLE', 'GOOD', 'LOST', 'UNKNOWN'];
    for (const condition of priority) {
      if (selectedConditions.includes(condition)) {
        return condition;
      }
    }
    return 'UNKNOWN';
  }

  private resolveCrmCase(): string | undefined {
    const explicitCase = this.form.crmCase.trim();
    if (explicitCase) {
      return explicitCase;
    }
    if (!this.isCollectedSource) {
      return undefined;
    }
    const uniqueCases = [...new Set(this.selectedCollectedItems.map((item) => item.crmCase).filter(Boolean))];
    return uniqueCases.length === 1 ? uniqueCases[0] : undefined;
  }

  private upsertReturn(returnItem: MaterialReturn): void {
    const next = [...this.returns];
    const index = next.findIndex((item) => item.id === returnItem.id);
    if (index >= 0) {
      next[index] = returnItem;
    } else {
      next.unshift(returnItem);
    }
    this.returns = this.sortReturns(next);

    if (this.selectedReturn?.id === returnItem.id) {
      this.selectedReturn = returnItem;
    }
    if (this.reviewReturn?.id === returnItem.id) {
      this.reviewReturn = returnItem;
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

  private createEmptyForm(returnSource: CreateReturnSource | '' = '') {
    return {
      responsibleZmId: '',
      crmCase: '',
      returnSource,
      reason: '' as ReturnReason | '',
      condition: '' as ReturnCondition | '',
      destination: '' as ReturnDestination | '',
      comment: '',
    };
  }

  private resetSourceSelectionState(): void {
    this.itemRows = [];
    this.itemSearch = '';
    this.filteredEquipment = [];
    this.collectedSearch = '';
    this.selectedCollectedIds.clear();
    this.eligibleCollectedItems = [];
    this.collectedItemsLoading = false;
    this.collectedItemsError = '';
  }

  private isTrackedMode(mode?: TrackingMode): boolean {
    return !!mode && mode !== 'NONE';
  }

  private buildIdentifierLine(equipmentName: string, serialNumber?: string | null, imei?: string | null): string | null {
    const identifiers = [serialNumber, imei].filter(Boolean).join(' • ');
    if (!identifiers) {
      return null;
    }
    return `${equipmentName}: ${identifiers}`;
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
