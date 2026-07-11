import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import {
  CaseConsumption,
  CaseConsumptionSummary,
  DpmRequest,
  DpmStatus,
  DpmTechRollup,
  StockAuditEntry,
  StockAuditStatusCategory,
  StockAuditType,
  SttDistribution,
  ZmStockAudit
} from '../../../../core/stock/stock.model';
import {
  formatMaterialGroups,
  formatMaterialQuantity,
  groupMaterialQuantities,
  materialUnitShort
} from '../../../../core/stock/material-quantity.util';

interface ZmCard {
  id: string;
  name: string;
  email: string;
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
}

interface ItemAuditEntry {
  dpm: DpmRequest;
  requestedQty: number;
  confirmedQty: number | null;
  shortageQty: number | null;
}

interface ItemAuditRow {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  totalRequested: number;
  totalConfirmed: number;
  totalShortage: number;
  dpmCount: number;
  pendingCount: number;
  confirmedCount: number;
  rejectedCount: number;
  entries: ItemAuditEntry[];
}

@Component({
  standalone: true,
  selector: 'app-stock-audit',
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, SpinnerComponent],
  templateUrl: './stock-audit.component.html',
  styleUrls: ['./stock-audit.component.scss']
})
export class StockAuditComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  // ── DPM audit state ───────────────────────────────────────────────────────
  dpms: DpmRequest[] = [];
  distributionsByDpmId = new Map<string, SttDistribution[]>();

  loading = false;
  error: string | null = null;

  activeTab: 'feed' | 'dpm' | 'consumption' = 'feed';
  activeView: 'zm' | 'stock' = 'zm';
  zmSearch = '';
  itemSearch = '';

  zmAudit: ZmStockAudit | null = null;
  loadingZmAudit = false;
  zmAuditVisible = false;

  selectedDpm: DpmRequest | null = null;
  selectedDpmDistributions: SttDistribution[] = [];
  selectedDpmRollups: DpmTechRollup[] = [];
  loadingDpmRollups = false;
  panelVisible = false;

  selectedItemRow: ItemAuditRow | null = null;
  itemPanelVisible = false;

  // ── Case Consumption Audit state ─────────────────────────────────────────
  consumptions: CaseConsumption[] = [];
  consumptionSummary: CaseConsumptionSummary | null = null;
  loadingConsumptions = false;
  consumptionError: string | null = null;

  consumptionSearch = '';
  consumptionCaseTypeFilter: '' | 'ACTIVATION' | 'PLAINTE' = '';

  selectedConsumption: CaseConsumption | null = null;
  consumptionDetailVisible = false;

  // ── Unified Audit Feed state (DPM + Returns) ─────────────────────────────
  feedEntries: StockAuditEntry[] = [];
  loadingFeed = false;
  feedError: string | null = null;

  feedTypeFilter: 'ALL' | StockAuditType = 'ALL';
  feedStatusFilter: '' | StockAuditStatusCategory = '';
  feedRoleFilter: '' | 'ZM' | 'STT' | 'TECH' = '';
  feedSearch = '';
  feedFrom = '';
  feedTo = '';

  feedPage = 1;
  readonly feedPageSize = 25;

  selectedReturn: StockAuditEntry | null = null;
  returnDetailVisible = false;

  ngOnInit(): void { this.load(); this.loadFeed(); }

  load(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      dpms:          this.stockSvc.adminGetAllDpms(),
      distributions: this.stockSvc.adminGetAllDistributions()
    })
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ dpms, distributions }) => {
          this.dpms = dpms;
          const map = new Map<string, SttDistribution[]>();
          for (const d of distributions) {
            if (!d.dpmId) continue;
            const arr = map.get(d.dpmId) ?? [];
            arr.push(d);
            map.set(d.dpmId, arr);
          }
          this.distributionsByDpmId = map;
        },
        error: e => this.error = e.message
      });
  }

  openZmAudit(zmId: string): void {
    this.zmAudit = null;
    this.loadingZmAudit = true;
    this.zmAuditVisible = true;
    this.error = null;
    this.stockSvc.adminGetZmStockAudit(zmId)
      .pipe(finalize(() => { this.loadingZmAudit = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: audit => { this.zmAudit = audit; this.cdr.detectChanges(); },
        error: e => { this.error = e.message; }
      });
  }

  closeZmAudit(): void {
    this.zmAuditVisible = false;
    this.zmAudit = null;
  }

  openDpm(dpm: DpmRequest, distributions?: SttDistribution[]): void {
    // Open the panel synchronously with a loading state. The app runs zoneless
    // (Angular v21, no zone.js), so we must notify change detection ourselves —
    // but via markForCheck(), NOT a synchronous detectChanges(). Forcing a
    // re-entrant detectChanges() from inside this click handler left the newly
    // created @if panel view uncommitted, so it only appeared on the next
    // scheduler tick (i.e. after clicking elsewhere). markForCheck() lets the
    // scheduler render the panel in one clean tick on this first click.
    this.selectedDpm = dpm;
    this.selectedDpmDistributions = distributions ?? this.distributionsByDpmId.get(dpm.id) ?? [];
    this.selectedDpmRollups = [];
    this.loadingDpmRollups = true;
    this.panelVisible = true;
    this.cdr.markForCheck();

    // Fetch the enriched tracking so new pooled distributions (dpmId=null) surface
    // through automatic source allocations, not only legacy dpmId-linked records.
    this.stockSvc.adminGetDpmTracking(dpm.id)
      .pipe(finalize(() => { this.loadingDpmRollups = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: t => {
          this.selectedDpmRollups = t.techRollups ?? [];
          if ((!this.selectedDpmDistributions || this.selectedDpmDistributions.length === 0)
              && (t.techDistributions?.length ?? 0) > 0) {
            this.selectedDpmDistributions = t.techDistributions ?? [];
          }
          this.cdr.detectChanges();
        },
        error: () => { /* non-critical: panel still renders legacy data */ }
      });
  }

  /** True when the DPM has TECH distributions via allocations or legacy direct link. */
  get selectedDpmHasDistribution(): boolean {
    return this.selectedDpmRollups.length > 0 || this.selectedDpmDistributions.length > 0;
  }

  unitShort(unit?: string): string {
    return materialUnitShort(unit);
  }

  openItemPanel(row: ItemAuditRow): void {
    this.selectedItemRow = row;
    this.itemPanelVisible = true;
    this.cdr.detectChanges();
  }

  get zmCards(): ZmCard[] {
    const map = new Map<string, ZmCard>();
    for (const d of this.dpms) {
      if (!map.has(d.zmId)) {
        map.set(d.zmId, { id: d.zmId, name: d.zmName, email: d.zmEmail, total: 0, pending: 0, confirmed: 0, rejected: 0 });
      }
      const c = map.get(d.zmId)!;
      c.total++;
      if (d.status === 'PENDING_STT_CONFIRMATION') c.pending++;
      else if (d.status === 'FULLY_CONFIRMED' || d.status === 'PARTIALLY_CONFIRMED') c.confirmed++;
      else if (d.status === 'REJECTED' || d.status === 'CANCELLED') c.rejected++;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredZmCards(): ZmCard[] {
    if (!this.zmSearch.trim()) return this.zmCards;
    const q = this.zmSearch.toLowerCase();
    return this.zmCards.filter(z => z.name.toLowerCase().includes(q) || z.email.toLowerCase().includes(q));
  }

  get itemAuditRows(): ItemAuditRow[] {
    const map = new Map<string, ItemAuditRow>();
    for (const dpm of this.dpms) {
      for (const item of dpm.items) {
        if (!map.has(item.equipmentId)) {
          map.set(item.equipmentId, {
            equipmentId: item.equipmentId,
            equipmentName: item.equipmentName,
            unit: item.unit,
            totalRequested: 0,
            totalConfirmed: 0,
            totalShortage: 0,
            dpmCount: 0,
            pendingCount: 0,
            confirmedCount: 0,
            rejectedCount: 0,
            entries: []
          });
        }
        const row = map.get(item.equipmentId)!;
        row.totalRequested += item.requestedQuantity;
        if (item.confirmedQuantity != null) row.totalConfirmed += item.confirmedQuantity;
        if (item.shortageQuantity != null) row.totalShortage += item.shortageQuantity;
        row.dpmCount++;
        if (dpm.status === 'PENDING_STT_CONFIRMATION') row.pendingCount++;
        else if (dpm.status === 'FULLY_CONFIRMED' || dpm.status === 'PARTIALLY_CONFIRMED') row.confirmedCount++;
        else if (dpm.status === 'REJECTED' || dpm.status === 'CANCELLED') row.rejectedCount++;
        row.entries.push({
          dpm,
          requestedQty: item.requestedQuantity,
          confirmedQty: item.confirmedQuantity ?? null,
          shortageQty: item.shortageQuantity ?? null
        });
      }
    }
    return [...map.values()].sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));
  }

  get filteredItemRows(): ItemAuditRow[] {
    const rows = this.itemAuditRows;
    if (!this.itemSearch.trim()) return rows;
    const q = this.itemSearch.toLowerCase();
    return rows.filter(r => r.equipmentName.toLowerCase().includes(q));
  }

  totalItemsRequestedLabel(): string {
    return formatMaterialGroups(this.itemRowGroups(this.itemAuditRows, row => row.totalRequested));
  }

  consumptionQtyLabel(c: CaseConsumption): string {
    return formatMaterialGroups(this.consumptionGroups(c));
  }

  // ── Case Consumption tab methods ─────────────────────────────────────────

  loadConsumptions(): void {
    if (this.consumptions.length > 0 && !this.consumptionError) return;
    this.loadingConsumptions = true;
    this.consumptionError = null;
    forkJoin({
      list:    this.stockSvc.getCaseConsumptions(),
      summary: this.stockSvc.getCaseConsumptionSummary()
    })
      .pipe(finalize(() => { this.loadingConsumptions = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ list, summary }) => {
          this.consumptions = list;
          this.consumptionSummary = summary;
        },
        error: e => { this.consumptionError = e.message; }
      });
  }

  switchTab(tab: 'feed' | 'dpm' | 'consumption'): void {
    this.activeTab = tab;
    if (tab === 'consumption' && this.consumptions.length === 0) {
      this.loadConsumptions();
    }
    if (tab === 'feed' && this.feedEntries.length === 0 && !this.feedError) {
      this.loadFeed();
    }
  }

  get filteredConsumptions(): CaseConsumption[] {
    let list = this.consumptions;
    if (this.consumptionCaseTypeFilter) {
      list = list.filter(c => c.caseType === this.consumptionCaseTypeFilter);
    }
    if (this.consumptionSearch.trim()) {
      const q = this.consumptionSearch.toLowerCase();
      list = list.filter(c =>
        (c.crmCase ?? '').toLowerCase().includes(q) ||
        (c.technicianName ?? '').toLowerCase().includes(q) ||
        (c.sttName ?? '').toLowerCase().includes(q) ||
        (c.zmName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  openConsumptionDetail(c: CaseConsumption): void {
    this.selectedConsumption = c;
    this.consumptionDetailVisible = true;
    this.cdr.detectChanges();
  }

  closeConsumptionDetail(): void {
    this.consumptionDetailVisible = false;
    this.selectedConsumption = null;
  }

  caseTypeLabel(t?: string | null): string {
    if (t === 'ACTIVATION') return 'Activation';
    if (t === 'PLAINTE') return 'Plainte';
    return t ?? '-';
  }

  unitLabel(unit?: string | null): string {
    return materialUnitShort(unit);
  }

  nameInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  formatQty(qty: number, unit?: string): string {
    return formatMaterialQuantity(qty, unit);
  }

  rollupUsageSummary(roll: DpmTechRollup): string {
    return [
      `distributed ${formatMaterialGroups(this.rollupGroups(roll.items, item => item.distributedQuantity))}`,
      `used ${formatMaterialGroups(this.rollupGroups(roll.items, item => item.usedQuantity))}`,
      `remaining ${formatMaterialGroups(this.rollupGroups(roll.items, item => item.remainingQuantity))}`
    ].join(' · ');
  }

  // ── Unified Audit Feed tab methods ───────────────────────────────────────

  loadFeed(): void {
    this.loadingFeed = true;
    this.feedError = null;
    this.stockSvc.adminGetStockAuditEntries('ALL')
      .pipe(finalize(() => { this.loadingFeed = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: entries => { this.feedEntries = entries ?? []; },
        error: e => { this.feedError = e.message; }
      });
  }

  setFeedType(type: 'ALL' | StockAuditType): void {
    this.feedTypeFilter = type;
    this.feedPage = 1;
  }

  resetFeedPage(): void {
    this.feedPage = 1;
  }

  get filteredFeed(): StockAuditEntry[] {
    let list = this.feedEntries;

    if (this.feedTypeFilter !== 'ALL') {
      list = list.filter(e => e.auditType === this.feedTypeFilter);
    }
    if (this.feedStatusFilter) {
      list = list.filter(e => e.statusCategory === this.feedStatusFilter);
    }
    if (this.feedRoleFilter) {
      list = list.filter(e => (e.actorRole ?? '').toUpperCase() === this.feedRoleFilter);
    }
    if (this.feedFrom) {
      const from = new Date(this.feedFrom).getTime();
      list = list.filter(e => e.updatedAt != null && new Date(e.updatedAt).getTime() >= from);
    }
    if (this.feedTo) {
      // inclusive end-of-day
      const to = new Date(this.feedTo).getTime() + 24 * 60 * 60 * 1000 - 1;
      list = list.filter(e => e.updatedAt != null && new Date(e.updatedAt).getTime() <= to);
    }
    if (this.feedSearch.trim()) {
      const q = this.feedSearch.toLowerCase();
      list = list.filter(e =>
        (e.reference ?? '').toLowerCase().includes(q) ||
        (e.actorName ?? '').toLowerCase().includes(q) ||
        (e.sttName ?? '').toLowerCase().includes(q) ||
        (e.zmName ?? '').toLowerCase().includes(q) ||
        (e.crmCase ?? '').toLowerCase().includes(q) ||
        (e.items ?? []).some(i => (i.equipmentName ?? '').toLowerCase().includes(q))
      );
    }
    return list;
  }

  get pagedFeed(): StockAuditEntry[] {
    const start = (this.feedPage - 1) * this.feedPageSize;
    return this.filteredFeed.slice(start, start + this.feedPageSize);
  }

  get feedTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredFeed.length / this.feedPageSize));
  }

  prevFeedPage(): void { if (this.feedPage > 1) this.feedPage--; }
  nextFeedPage(): void { if (this.feedPage < this.feedTotalPages) this.feedPage++; }

  feedCount(type: 'ALL' | StockAuditType): number {
    if (type === 'ALL') return this.feedEntries.length;
    return this.feedEntries.filter(e => e.auditType === type).length;
  }

  feedCountByCategory(cat: StockAuditStatusCategory): number {
    return this.feedEntries.filter(e => e.statusCategory === cat).length;
  }

  openFeedEntry(entry: StockAuditEntry, event?: Event): void {
    // The detail backdrop is created on the next change-detection tick, so it can
    // never receive this same opening click — but stop propagation defensively so
    // no ancestor handler can interfere with opening the panel.
    event?.stopPropagation();

    if (entry.auditType === 'DPM') {
      // Reuse the rich DPM flow panel; the full DpmRequest is loaded by load().
      const dpm = this.dpms.find(d => d.id === entry.id);
      if (dpm) this.openDpm(dpm);
      return;
    }
    // Return-material entry: open synchronously, then let the zoneless scheduler
    // render the panel on this first click (markForCheck, not a re-entrant
    // detectChanges()).
    this.selectedReturn = entry;
    this.returnDetailVisible = true;
    this.cdr.markForCheck();
  }

  closeReturnDetail(): void {
    this.returnDetailVisible = false;
    this.selectedReturn = null;
  }

  feedItemsQtyLabel(entry: StockAuditEntry): string {
    return formatMaterialGroups(this.feedGroups(entry));
  }

  reasonLabel(reason?: string | null): string {
    const m: Record<string, string> = {
      DAMAGED: 'Damaged',
      BROKEN: 'Broken',
      CLIENT_RESILIATION_RECOVERY: 'Résiliation recovery',
      UNUSED: 'Unused',
      WRONG_DISTRIBUTION: 'Wrong distribution',
      REPLACEMENT: 'Replacement',
      OTHER: 'Other'
    };
    return reason ? (m[reason] ?? this.prettyEnum(reason)) : '—';
  }

  prettyEnum(value?: string | null): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  statusLabel(s: DpmStatus): string {
    const m: Partial<Record<DpmStatus, string>> = {
      WAITING_TEAM_STOCK_APPROVAL: 'Waiting Approval', TEAM_STOCK_REJECTED: 'Ext. Rejected',
      RDV_SCHEDULED: 'RDV Scheduled', RDV_CONFIRMED_BY_STT: 'RDV Confirmed',
      MATERIAL_RECEIVED: 'Material Received', COMPLETED: 'Completed',
      PENDING_STT_CONFIRMATION: 'Pending', PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed', REJECTED: 'Rejected', CANCELLED: 'Cancelled'
    };
    return m[s] ?? s;
  }

  countByStatus(s: DpmStatus): number {
    return this.dpms.filter(d => d.status === s).length;
  }

  get consumptionBreakdownLabel(): string {
    const groups = this.consumptionSummary?.quantityBreakdown?.length
      ? this.consumptionSummary.quantityBreakdown
      : groupMaterialQuantities(this.consumptions.flatMap(c => c.consumedItems ?? []), {
          equipmentId: item => item.equipmentId,
          equipmentName: item => item.equipmentName,
          unit: item => item.unit,
          quantity: item => item.quantityUsed
        });
    return formatMaterialGroups(groups, { separator: '\n' });
  }

  private itemRowGroups(
    rows: readonly ItemAuditRow[],
    quantity: (row: ItemAuditRow) => number
  ) {
    return groupMaterialQuantities(rows, {
      equipmentId: row => row.equipmentId,
      equipmentName: row => row.equipmentName,
      unit: row => row.unit,
      quantity
    });
  }

  private consumptionGroups(consumption: CaseConsumption) {
    return groupMaterialQuantities(consumption.consumedItems ?? [], {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity: item => item.quantityUsed
    });
  }

  private feedGroups(entry: StockAuditEntry) {
    return groupMaterialQuantities(entry.items ?? [], {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity: item => item.quantity
    });
  }

  private rollupGroups(
    items: readonly DpmTechRollup['items'][number][],
    quantity: (item: DpmTechRollup['items'][number]) => number
  ) {
    return groupMaterialQuantities(items, {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity
    });
  }
}
