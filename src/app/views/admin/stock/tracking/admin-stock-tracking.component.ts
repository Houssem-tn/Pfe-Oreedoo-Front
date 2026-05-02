import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import {
  DpmRequest, DpmStatus, SttStock, TechStock
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
  userMap = new Map<string, AppUser>();

  loading = false;
  error: string | null = null;
  activeTab: 'dpms' | 'stt' | 'tech' = 'dpms';

  dpmFilter = '';
  statusFilter: DpmStatus | '' = '';

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.error = null;
    this.userSvc.getAll().subscribe({
      next: list => { this.userMap = new Map(list.map(u => [u.id, u])); }
    });
    this.stockSvc.adminGetAllDpms().subscribe({
      next: d => this.dpms = d, error: e => this.error = e.message
    });
    this.stockSvc.adminGetAllSttStocks().subscribe({ next: d => this.sttStocks = d });
    this.stockSvc.adminGetAllTechStocks()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: d => this.techStocks = d });
  }

  setTab(tab: 'dpms' | 'stt' | 'tech'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
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

  statusLabel(status: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'Pending', PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed', REJECTED: 'Rejected', CANCELLED: 'Cancelled'
    };
    return m[status] ?? status;
  }

}
