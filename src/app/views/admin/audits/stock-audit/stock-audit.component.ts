import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import {
  DpmRequest, DpmStatus, SttDistribution, ZmStockAudit
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

  dpms: DpmRequest[] = [];
  distributionsByDpmId = new Map<string, SttDistribution[]>();

  loading = false;
  error: string | null = null;

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

  totalItemsRequested(): number {
    return this.itemAuditRows.reduce((s, r) => s + r.totalRequested, 0);
  }

  nameInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  formatQty(qty: number, unit?: string): string {
    return unit === 'METERS' ? `${qty} m` : `×${qty}`;
  }

  statusLabel(s: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'Pending',
      PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled'
    };
    return m[s] ?? s;
  }

  countByStatus(s: DpmStatus): number {
    return this.dpms.filter(d => d.status === s).length;
  }
}
