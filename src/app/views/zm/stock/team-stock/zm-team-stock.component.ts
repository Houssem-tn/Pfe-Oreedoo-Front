import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { DpmRequest, SttStock, TechStock, TechStockUsage } from '../../../../core/stock/stock.model';
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
  searchFilter = '';
  expandedSttIds = new Set<string>();

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
        this.expandedSttIds = new Set(sttStocks.map(s => s.sttId));
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
    if (!this.searchFilter.trim()) return this.sttStocks;
    const q = this.searchFilter.toLowerCase();
    return this.sttStocks.filter(s =>
      this.sttName(s.sttId).toLowerCase().includes(q)
    );
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
    if (this.expandedSttIds.has(sttId)) {
      this.expandedSttIds.delete(sttId);
    } else {
      this.expandedSttIds.add(sttId);
    }
  }

  private stockLabel(meters: number, pieces: number): string {
    const parts: string[] = [];
    if (meters > 0) parts.push(`${meters} m`);
    if (pieces > 0) parts.push(`${pieces} pcs`);
    return parts.join(' / ') || '0';
  }

  get totalSttUnitsLabel(): string {
    const items = this.sttStocks.flatMap(s => s.items);
    const m = items.filter(i => i.unit === 'METERS').reduce((a, i) => a + i.availableQuantity, 0);
    const p = items.filter(i => i.unit !== 'METERS').reduce((a, i) => a + i.availableQuantity, 0);
    return this.stockLabel(m, p);
  }

  get totalTechUnitsLabel(): string {
    const items = this.techStocks.flatMap(t => t.items);
    const m = items.filter(i => i.unit === 'METERS').reduce((a, i) => a + i.remainingQuantity, 0);
    const p = items.filter(i => i.unit !== 'METERS').reduce((a, i) => a + i.remainingQuantity, 0);
    return this.stockLabel(m, p);
  }

  get totalTechUsedUnitsLabel(): string {
    const items = this.techStocks.flatMap(t => t.items);
    const m = items.filter(i => i.unit === 'METERS').reduce((a, i) => a + i.usedQuantity, 0);
    const p = items.filter(i => i.unit !== 'METERS').reduce((a, i) => a + i.usedQuantity, 0);
    return this.stockLabel(m, p);
  }

  isSelfExecutor(ts: TechStock): boolean {
    return ts.techId === ts.sttId;
  }

  sttAvailableLabel(ss: SttStock): string {
    const m = ss.items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.availableQuantity, 0);
    const p = ss.items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.availableQuantity, 0);
    return this.stockLabel(m, p);
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
}
