import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpinnerComponent } from '@coreui/angular';
import { finalize } from 'rxjs/operators';

import { StockService } from '../../../../core/stock/stock.service';
import { CaseConsumption, CaseConsumptionSummary } from '../../../../core/stock/stock.model';
import {
  formatMaterialGroups,
  formatMaterialQuantity,
  groupMaterialQuantities,
  materialUnitShort
} from '../../../../core/stock/material-quantity.util';

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
    const breakdown = groupMaterialQuantities(list.flatMap(c => c.consumedItems ?? []), {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity: item => item.quantityUsed
    });
    const totalQty = breakdown.reduce((sum, item) => sum + item.quantity, 0);

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
      cableTotalMeters: 0,
      totalBoxesUsed: 0,
      quantityBreakdown: breakdown,
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
    return materialUnitShort(unit);
  }

  consumptionQtyLabel(c: CaseConsumption): string {
    return formatMaterialGroups(this.consumptionGroups(c));
  }

  nameInitials(name?: string | null): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  itemsSummary(c: CaseConsumption): string {
    if (!c.consumedItems?.length) return 'No items';
    return c.consumedItems.map(i =>
      `${i.equipmentName ?? i.equipmentId} ${formatMaterialQuantity(i.quantityUsed, i.unit)}`
    ).join(', ');
  }

  get summaryBreakdownLabel(): string {
    return formatMaterialGroups(this.summary?.quantityBreakdown ?? [], { separator: '\n' });
  }

  private consumptionGroups(consumption: Pick<CaseConsumption, 'consumedItems'>) {
    return groupMaterialQuantities(consumption.consumedItems ?? [], {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity: item => item.quantityUsed
    });
  }
}
