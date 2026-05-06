import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import {
  DpmRequest, DpmStatus, SttDistribution, SttStock, TechStock, TechStockUsage
} from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';

@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SpinnerComponent],
  templateUrl: './admin-stock-tracking.component.html',
  styleUrls: ['./admin-stock-tracking.component.scss']
})
export class AdminStockTrackingComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  dpms: DpmRequest[] = [];
  sttStocks: SttStock[] = [];
  techStocks: TechStock[] = [];
  techUsages: TechStockUsage[] = [];
  userMap = new Map<string, AppUser>();
  techUsageMap = new Map<string, TechStockUsage[]>();

  loading = false;
  error: string | null = null;
  activeTab: 'dpms' | 'stt' | 'tech' = 'dpms';

  dpmFilter = '';
  statusFilter: DpmStatus | '' = '';

  detailDpm: DpmRequest | null = null;
  detailTechDistributions: SttDistribution[] = [];
  detailVisible = false;
  loadingDetail = false;

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      users:      this.userSvc.getAll(),
      dpms:       this.stockSvc.adminGetAllDpms(),
      sttStocks:  this.stockSvc.adminGetAllSttStocks(),
      techStocks: this.stockSvc.adminGetAllTechStocks(),
      techUsages: this.stockSvc.adminGetAllTechUsages()
    }).pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ users, dpms, sttStocks, techStocks, techUsages }) => {
          this.userMap   = new Map(users.map(u => [u.id, u]));
          this.dpms      = dpms;
          this.sttStocks = sttStocks;
          this.techStocks = techStocks;
          this.techUsages = techUsages;
          this.techUsageMap = this.groupTechUsages(techUsages);
        },
        error: e => this.error = e.message
      });
  }

  setTab(tab: 'dpms' | 'stt' | 'tech'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  openDetail(d: DpmRequest): void {
    this.detailDpm = d;
    this.detailTechDistributions = [];
    this.loadingDetail = true;
    this.detailVisible = true;
    this.cdr.detectChanges();
    this.stockSvc.adminGetDpmTracking(d.id)
      .pipe(finalize(() => { this.loadingDetail = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: t => { this.detailTechDistributions = t.techDistributions; this.cdr.detectChanges(); },
        error: e => { this.error = e.message; }
      });
  }

  nameInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  userName(id: string): string {
    return this.userMap.get(id)?.fullName ?? `#${id.slice(-6)}`;
  }

  userEmail(id: string): string {
    return this.userMap.get(id)?.email ?? '';
  }

  userInitials(id: string): string {
    const name = this.userMap.get(id)?.fullName;
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  get filteredDpms(): DpmRequest[] {
    return this.dpms.filter(d => {
      const q = this.dpmFilter.toLowerCase();
      const matchSearch = !q ||
        d.dpmNumber.toLowerCase().includes(q) ||
        d.zmName.toLowerCase().includes(q) ||
        d.sttName.toLowerCase().includes(q);
      return matchSearch && (!this.statusFilter || d.status === this.statusFilter);
    });
  }

  sttTotalReceived(s: SttStock): number { return s.items.reduce((t, i) => t + i.totalReceived, 0); }
  sttTotalDistributed(s: SttStock): number { return s.items.reduce((t, i) => t + i.totalDistributedToTechs, 0); }
  sttTotalAvailable(s: SttStock): number { return s.items.reduce((t, i) => t + i.availableQuantity, 0); }
  sttAvailPct(s: SttStock): number {
    const r = this.sttTotalReceived(s);
    return r ? Math.round((this.sttTotalAvailable(s) / r) * 100) : 0;
  }

  techTotalReceived(t: TechStock): number { return t.items.reduce((s, i) => s + i.receivedQuantity, 0); }
  techTotalUsed(t: TechStock): number { return t.items.reduce((s, i) => s + i.usedQuantity, 0); }
  techTotalRemaining(t: TechStock): number { return t.items.reduce((s, i) => s + i.remainingQuantity, 0); }
  techUsagesFor(techId: string): TechStockUsage[] { return this.techUsageMap.get(techId) ?? []; }

  statusLabel(status: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'Pending', PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed', REJECTED: 'Rejected', CANCELLED: 'Cancelled'
    };
    return m[status] ?? status;
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
