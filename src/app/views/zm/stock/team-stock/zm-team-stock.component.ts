import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { DpmRequest, SttStock, SttStockItem, TechStock, TechStockUsage } from '../../../../core/stock/stock.model';
import {
  formatMaterialGroups,
  formatMaterialQuantity,
  groupMaterialQuantities,
  materialUnitShort
} from '../../../../core/stock/material-quantity.util';
import { AppUser } from '../../../../core/users/user.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  templateUrl: './zm-team-stock.component.html',
  styleUrls: ['./zm-team-stock.component.scss']
})
export class ZmTeamStockComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  sttStocks: SttStock[] = [];
  techStocks: TechStock[] = [];
  techUsages: TechStockUsage[] = [];
  sttMap = new Map<string, AppUser>();
  techMap = new Map<string, AppUser>();
  techUsageMap = new Map<string, TechStockUsage[]>();
  /** For each sttId: unique ZM names whose DPMs were confirmed for that STT. */
  sttDistributorZmsMap = new Map<string, string[]>();

  loading = false;
  error: string | null = null;
  /** Accordion: only one STT card is expanded at a time. null = all collapsed (default). */
  expandedSttId: string | null = null;
  /** Per-STT active detail tab: 'warehouse' (stock table) or 'techs' (tech grid). */
  private activeTabMap = new Map<string, 'warehouse' | 'techs'>();

  page = 1;
  pageSize = 10;

  private _searchFilter = '';
  get searchFilter(): string { return this._searchFilter; }
  set searchFilter(v: string) { this._searchFilter = v; this.page = 1; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      // Source of truth for "my STTs": org-chart (assignedZmId), not DPM authorship.
      myStts:     this.userSvc.getMyStts(),
      sttStocks:  this.stockSvc.zmGetMySttsStocks(),
      techStocks: this.stockSvc.zmGetMyTechsStocks(),
      techUsages: this.stockSvc.zmGetMyTechsUsages(),
      // All DPMs for my STTs (any creator ZM) — used for distributor ZM labels.
      sttsDpms:   this.stockSvc.zmGetMySttsDpms()
    }).pipe(
      switchMap(({ myStts, sttStocks, techStocks, techUsages, sttsDpms }) => {
        // Build sttMap from the org-chart STT list — correct source of truth.
        const sttMap = new Map<string, AppUser>();
        for (const stt of myStts) {
          sttMap.set(stt.id, stt);
        }
        this.sttMap = sttMap;

        // Build distributor ZM labels per STT from confirmed DPMs.
        this.sttDistributorZmsMap = this.buildDistributorZmsMap(sttsDpms);

        const sttIds = sttStocks.map(s => s.sttId);
        const techCalls = sttIds.length
          ? sttIds.map(id => this.userSvc.getMySttTechs(id).pipe(catchError(() => of([] as AppUser[]))))
          : [of([] as AppUser[])];

        return forkJoin({ techLists: forkJoin(techCalls) }).pipe(
          map(({ techLists }) => ({ techLists, sttStocks, techStocks, techUsages }))
        );
      }),
      finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); })
    ).subscribe({
      next: ({ techLists, sttStocks, techStocks, techUsages }) => {
        const tMap = new Map<string, AppUser>();
        for (const [id, stt] of this.sttMap) tMap.set(id, stt);
        for (const list of techLists) {
          for (const t of list) tMap.set(t.id, t);
        }
        this.techMap = tMap;
        this.sttStocks = sttStocks;
        this.techStocks = techStocks;
        this.techUsages = techUsages;
        this.techUsageMap = this.groupTechUsages(techUsages);
        this.expandedSttId = null;
      },
      error: e => this.error = e.message
    });
  }

  distributorZmsFor(sttId: string): string[] {
    return this.sttDistributorZmsMap.get(sttId) ?? [];
  }

  private buildDistributorZmsMap(dpms: DpmRequest[]): Map<string, string[]> {
    const map = new Map<string, Set<string>>();
    for (const dpm of dpms) {
      if (!dpm.sttId || !dpm.zmName) continue;
      if (!map.has(dpm.sttId)) map.set(dpm.sttId, new Set());
      map.get(dpm.sttId)!.add(dpm.zmName);
    }
    const result = new Map<string, string[]>();
    for (const [sttId, names] of map) result.set(sttId, [...names]);
    return result;
  }

  get filteredSttStocks(): SttStock[] {
    if (!this._searchFilter.trim()) return this.sttStocks;
    const q = this._searchFilter.toLowerCase();
    return this.sttStocks.filter(s =>
      this.sttName(s.sttId).toLowerCase().includes(q)
    );
  }

  get pagedSttStocks(): SttStock[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredSttStocks.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSttStocks.length / this.pageSize));
  }

  get showingFrom(): number {
    return this.filteredSttStocks.length === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.page * this.pageSize, this.filteredSttStocks.length);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = Math.max(1, this.page - 2); i <= Math.min(this.totalPages, this.page + 2); i++) {
      pages.push(i);
    }
    return pages;
  }

  setPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) this.page = p;
  }

  onPageSizeChange(event: Event): void {
    this.pageSize = +(event.target as HTMLSelectElement).value;
    this.page = 1;
  }

  techStocksForStt(sttId: string): TechStock[] {
    return this.techStocks.filter(t => t.sttId === sttId);
  }

  sttName(sttId: string): string {
    return this.sttMap.get(sttId)?.fullName ?? sttId;
  }

  sttInitials(sttId: string): string {
    const name = this.sttMap.get(sttId)?.fullName ?? '';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
  }

  techName(techId: string): string {
    return this.techMap.get(techId)?.fullName ?? techId;
  }

  techInitials(techId: string): string {
    const name = this.techMap.get(techId)?.fullName ?? '';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TC';
  }

  toggleStt(sttId: string): void {
    this.expandedSttId = this.expandedSttId === sttId ? null : sttId;
  }

  /** Short display code derived from the digits in the STT name, e.g. "STT2" → "STT-002". */
  sttCode(sttId: string): string {
    const name = this.sttMap.get(sttId)?.fullName ?? '';
    const digits = name.match(/\d+/)?.[0];
    return digits ? `STT-${digits.padStart(3, '0')}` : '';
  }

  tabFor(sttId: string): 'warehouse' | 'techs' {
    return this.activeTabMap.get(sttId) ?? 'warehouse';
  }

  setTab(sttId: string, tab: 'warehouse' | 'techs', event?: Event): void {
    event?.stopPropagation();
    this.activeTabMap.set(sttId, tab);
  }

  /** Share of received stock that has been distributed to TECHs (0–100), for the row progress bar. */
  distributedPct(item: SttStockItem): number {
    if (!item.totalReceived || item.totalReceived <= 0) return 0;
    return Math.min(100, Math.round((item.totalDistributedToTechs / item.totalReceived) * 100));
  }

  /** Availability tone for the row badge dot: 'zero' / 'low' (<50% of received) / 'ok'. */
  availLevel(item: SttStockItem): 'zero' | 'low' | 'ok' {
    if (item.availableQuantity <= 0) return 'zero';
    const ratio = item.totalReceived > 0 ? item.availableQuantity / item.totalReceived : 1;
    return ratio < 0.5 ? 'low' : 'ok';
  }

  get totalSttUnitsLabel(): string {
    return formatMaterialGroups(this.sttMaterialGroups(item => item.availableQuantity));
  }

  get totalTechUnitsLabel(): string {
    return formatMaterialGroups(this.techMaterialGroups(item => item.remainingQuantity));
  }

  get totalTechUsedUnitsLabel(): string {
    return formatMaterialGroups(this.techMaterialGroups(item => item.usedQuantity));
  }

  isSelfExecutor(ts: TechStock): boolean {
    return ts.techId === ts.sttId;
  }

  sttAvailableLabel(ss: SttStock): string {
    return formatMaterialGroups(this.sttMaterialGroups(item => item.availableQuantity, ss.items));
  }

  techUsagesForTech(techId: string): TechStockUsage[] {
    return this.techUsageMap.get(techId) ?? [];
  }

  private groupTechUsages(usages: TechStockUsage[]): Map<string, TechStockUsage[]> {
    const grouped = new Map<string, TechStockUsage[]>();

    for (const usage of usages) {
      const current = grouped.get(usage.techId) ?? [];
      current.push(usage);
      grouped.set(usage.techId, current);
    }

    return grouped;
  }

  unitShort(unit?: string | null): string {
    return materialUnitShort(unit);
  }

  quantityLabel(quantity: number, unit?: string | null): string {
    return formatMaterialQuantity(quantity, unit);
  }

  private sttMaterialGroups(
    quantity: (item: SttStock['items'][number]) => number,
    items: ReadonlyArray<SttStock['items'][number]> = this.sttStocks.flatMap(stock => stock.items)
  ) {
    return groupMaterialQuantities(items, {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity
    });
  }

  private techMaterialGroups(
    quantity: (item: TechStock['items'][number]) => number,
    items: ReadonlyArray<TechStock['items'][number]> = this.techStocks.flatMap(stock => stock.items)
  ) {
    return groupMaterialQuantities(items, {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity
    });
  }
}
