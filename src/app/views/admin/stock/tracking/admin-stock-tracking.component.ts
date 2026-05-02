import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent, TableDirective,
  FormControlDirective,
  NavComponent, NavItemComponent, NavLinkDirective
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { DpmRequest, DpmStatus, SttStock, TechStock, StockMovement } from '../../../../core/stock/stock.model';

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, SpinnerComponent, TableDirective,
    FormControlDirective,
    NavComponent, NavItemComponent, NavLinkDirective
  ],
  templateUrl: './admin-stock-tracking.component.html'
})
export class AdminStockTrackingComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  dpms: DpmRequest[] = [];
  sttStocks: SttStock[] = [];
  techStocks: TechStock[] = [];
  movements: StockMovement[] = [];

  loading = false;
  error: string | null = null;
  activeTab: 'dpms' | 'stt' | 'tech' | 'movements' = 'dpms';

  dpmFilter = '';
  statusFilter: DpmStatus | '' = '';

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.error = null;
    this.stockSvc.adminGetAllDpms().subscribe({ next: d => this.dpms = d, error: e => this.error = e.message });
    this.stockSvc.adminGetAllSttStocks().subscribe({ next: d => this.sttStocks = d });
    this.stockSvc.adminGetAllTechStocks().subscribe({ next: d => this.techStocks = d });
    this.stockSvc.adminGetAllMovements()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: d => this.movements = d, error: e => this.error = e.message });
  }

  setTab(tab: 'dpms' | 'stt' | 'tech' | 'movements'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  get filteredDpms(): DpmRequest[] {
    return this.dpms.filter(d => {
      const matchSearch = !this.dpmFilter ||
        d.dpmNumber.toLowerCase().includes(this.dpmFilter.toLowerCase()) ||
        d.zmName.toLowerCase().includes(this.dpmFilter.toLowerCase()) ||
        d.sttName.toLowerCase().includes(this.dpmFilter.toLowerCase());
      const matchStatus = !this.statusFilter || d.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  sttTotalReceived(stock: SttStock): number {
    return stock.items.reduce((s, i) => s + i.totalReceived, 0);
  }

  sttTotalDistributed(stock: SttStock): number {
    return stock.items.reduce((s, i) => s + i.totalDistributedToTechs, 0);
  }

  sttTotalAvailable(stock: SttStock): number {
    return stock.items.reduce((s, i) => s + i.availableQuantity, 0);
  }

  techTotalReceived(stock: TechStock): number {
    return stock.items.reduce((s, i) => s + i.receivedQuantity, 0);
  }

  statusColor(status: DpmStatus): string {
    const map: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'warning',
      PARTIALLY_CONFIRMED: 'info',
      FULLY_CONFIRMED: 'success',
      REJECTED: 'danger',
      CANCELLED: 'secondary'
    };
    return map[status] ?? 'secondary';
  }

  statusLabel(status: DpmStatus): string {
    const map: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'Pending',
      PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled'
    };
    return map[status] ?? status;
  }
}
