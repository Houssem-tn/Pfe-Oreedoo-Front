import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpinnerComponent } from '@coreui/angular';
import { finalize } from 'rxjs/operators';

import { StockService } from '../../../../core/stock/stock.service';
import { CaseConsumption, CaseConsumptionSummary } from '../../../../core/stock/stock.model';

@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SpinnerComponent],
  templateUrl: './zm-case-audit.component.html',
  styleUrls: ['./zm-case-audit.component.scss']
})
export class ZmCaseAuditComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  consumptions: CaseConsumption[] = [];
  summary: CaseConsumptionSummary | null = null;

  loading = false;
  error: string | null = null;

  searchFilter = '';
  caseTypeFilter: '' | 'ACTIVATION' | 'PLAINTE' = '';

  selectedConsumption: CaseConsumption | null = null;
  detailVisible = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;

    this.stockSvc.getCaseConsumptions().pipe(
      finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); })
    ).subscribe({
      next: list => {
        this.consumptions = list;
        this.buildSummary(list);
      },
      error: e => { this.error = e.message; }
    });
  }

  private buildSummary(list: CaseConsumption[]): void {
    const totalQty = list.reduce((s, c) => s + (c.totalQuantityUsed ?? 0), 0);

    const cableMeter = list.reduce((s, c) =>
      s + (c.consumedItems ?? [])
        .filter(i => i.unit === 'METERS')
        .reduce((q, i) => q + i.quantityUsed, 0), 0);

    const boxes = list.reduce((s, c) =>
      s + (c.consumedItems ?? [])
        .filter(i => i.unit !== 'METERS')
        .reduce((q, i) => q + i.quantityUsed, 0), 0);

    const techMap = new Map<string, { name: string; count: number }>();
    for (const c of list) {
      if (!c.technicianId) continue;
      const entry = techMap.get(c.technicianId) ?? { name: c.technicianName ?? c.technicianId, count: 0 };
      entry.count++;
      techMap.set(c.technicianId, entry);
    }
    let topTechId: string | null = null;
    let topTechName: string | null = null;
    let topCount = 0;
    for (const [id, entry] of techMap) {
      if (entry.count > topCount) { topCount = entry.count; topTechId = id; topTechName = entry.name; }
    }

    this.summary = {
      totalConsumptions: list.length,
      totalItemTypes: list.reduce((s, c) => s + (c.totalItemTypes ?? 0), 0),
      totalQuantityConsumed: totalQty,
      cableTotalMeters: cableMeter,
      totalBoxesUsed: boxes,
      topTechnicianId: topTechId,
      topTechnicianName: topTechName,
      topTechnicianConsumptions: topCount,
      casesWithoutStockDeclaration: 0
    };
  }

  get filtered(): CaseConsumption[] {
    let list = this.consumptions;
    if (this.caseTypeFilter) {
      list = list.filter(c => c.caseType === this.caseTypeFilter);
    }
    if (this.searchFilter.trim()) {
      const q = this.searchFilter.toLowerCase();
      list = list.filter(c =>
        (c.crmCase ?? '').toLowerCase().includes(q) ||
        (c.technicianName ?? '').toLowerCase().includes(q) ||
        (c.sttName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  openDetail(c: CaseConsumption): void {
    this.selectedConsumption = c;
    this.detailVisible = true;
    this.cdr.detectChanges();
  }

  closeDetail(): void {
    this.detailVisible = false;
    this.selectedConsumption = null;
  }

  caseTypeLabel(t?: string | null): string {
    if (t === 'ACTIVATION') return 'Activation';
    if (t === 'PLAINTE') return 'Plainte';
    return t ?? '—';
  }

  unitLabel(unit?: string | null): string {
    if (unit === 'METERS') return 'm';
    if (unit === 'PIECES') return 'pcs';
    return unit?.trim() || 'unit';
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

  nameInitials(name?: string | null): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  itemsSummary(c: CaseConsumption): string {
    if (!c.consumedItems?.length) return 'No items';
    return c.consumedItems.map(i =>
      `${i.equipmentName ?? i.equipmentId} ×${i.quantityUsed}`
    ).join(', ');
  }
}
