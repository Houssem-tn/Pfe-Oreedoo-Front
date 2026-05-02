import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { SttStock, TechStock } from '../../../../core/stock/stock.model';
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
  sttMap = new Map<string, AppUser>();
  techMap = new Map<string, AppUser>();

  loading = false;
  error: string | null = null;
  searchFilter = '';
  expandedSttIds = new Set<string>();

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      dpms:       this.stockSvc.getMyDpms(),
      sttStocks:  this.stockSvc.zmGetMySttsStocks(),
      techStocks: this.stockSvc.zmGetMyTechsStocks()
    }).pipe(
      switchMap(({ dpms, sttStocks, techStocks }) => {
        // Build sttMap from DPM data — covers every STT ever targeted, regardless of assignedZmId
        const sttMap = new Map<string, AppUser>();
        for (const d of dpms) {
          if (!sttMap.has(d.sttId)) {
            sttMap.set(d.sttId, { id: d.sttId, fullName: d.sttName, email: d.sttEmail });
          }
        }
        this.sttMap = sttMap;

        const sttIds = sttStocks.map(s => s.sttId);
        const techCalls = sttIds.length
          ? sttIds.map(id => this.userSvc.getMySttTechs(id))
          : [of([] as AppUser[])];

        return forkJoin({ techLists: forkJoin(techCalls) }).pipe(
          map(({ techLists }) => ({ techLists, sttStocks, techStocks }))
        );
      }),
      finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); })
    ).subscribe({
      next: ({ techLists, sttStocks, techStocks }) => {
        const tMap = new Map<string, AppUser>();
        for (const [id, stt] of this.sttMap) tMap.set(id, stt);
        for (const list of techLists) {
          for (const t of list) tMap.set(t.id, t);
        }
        this.techMap = tMap;
        this.sttStocks = sttStocks;
        this.techStocks = techStocks;
        this.expandedSttIds = new Set(sttStocks.map(s => s.sttId));
      },
      error: e => this.error = e.message
    });
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

  get totalSttUnits(): number {
    return this.sttStocks.reduce((sum, s) =>
      sum + s.items.reduce((a, i) => a + i.availableQuantity, 0), 0);
  }

  get totalTechUnits(): number {
    return this.techStocks.reduce((sum, t) =>
      sum + t.items.reduce((a, i) => a + i.receivedQuantity, 0), 0);
  }

  isSelfExecutor(ts: TechStock): boolean {
    return ts.techId === ts.sttId;
  }

  sttAvailableUnits(ss: SttStock): number {
    return ss.items.reduce((sum, i) => sum + i.availableQuantity, 0);
  }
}
