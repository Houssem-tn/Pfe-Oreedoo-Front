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
  SttDistribution,
  ZmStockAudit
} from '../../../../core/stock/stock.model';

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

  activeTab: 'dpm' | 'consumption' = 'dpm';
  activeView: 'zm' | 'stock' = 'zm';
  zmSearch = '';
  itemSearch = '';

  zmAudit: ZmStockAudit | null = null;
  loadingZmAudit = false;
  zmAuditVisible = false;

  selectedDpm: DpmRequest | null = null;
  selectedDpmDistributions: SttDistribution[] = [];
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

  ngOnInit(): void { this.load(); }

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
    this.selectedDpm = dpm;
    this.selectedDpmDistributions = distributions ?? this.distributionsByDpmId.get(dpm.id) ?? [];
    this.panelVisible = true;
    this.cdr.detectChanges();
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
    const rows = this.itemAuditRows;
    const m = rows.filter(r => r.unit === 'METERS').reduce((s, r) => s + r.totalRequested, 0);
    const p = rows.filter(r => r.unit !== 'METERS').reduce((s, r) => s + r.totalRequested, 0);
    const parts: string[] = [];
    if (m > 0) parts.push(`${m} m`);
    if (p > 0) parts.push(`${p} pcs`);
    return parts.join(' / ') || '0';
  }

  consumptionQtyLabel(c: CaseConsumption): string {
    const items = c.consumedItems ?? [];
    const m = items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.quantityUsed, 0);
    const p = items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.quantityUsed, 0);
    const parts: string[] = [];
    if (m > 0) parts.push(`${m} m`);
    if (p > 0) parts.push(`${p} pcs`);
    return parts.join(' / ') || '0';
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

  switchTab(tab: 'dpm' | 'consumption'): void {
    this.activeTab = tab;
    if (tab === 'consumption' && this.consumptions.length === 0) {
      this.loadConsumptions();
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
    if (unit === 'METERS') return 'm';
    if (unit === 'PIECES') return 'pcs';
    return unit?.trim() || 'units';
  }

  nameInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  formatQty(qty: number, unit?: string): string {
    return unit === 'METERS' ? `${qty} m` : `×${qty}`;
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
}
