import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent, TableDirective,
  ButtonDirective, ColComponent, RowComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { DpmRequest, DpmStatus, SttStock, TechStock } from '../../../../core/stock/stock.model';

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, RouterLink,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, SpinnerComponent, TableDirective,
    ButtonDirective, ColComponent, RowComponent
  ],
  templateUrl: './stt-my-stock.component.html',
  styleUrls: ['./stt-my-stock.component.scss']
})
export class SttMyStockComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  stock: SttStock | null = null;
  incomingDpms: DpmRequest[] = [];
  techStocks: TechStock[] = [];

  loading = false;
  error: string | null = null;

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.stockSvc.getMySttStock().subscribe({ next: s => this.stock = s, error: e => this.error = e.message });
    this.stockSvc.getIncomingDpms().subscribe({ next: d => this.incomingDpms = d });
    this.stockSvc.getMyTechsStocks()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: t => this.techStocks = t });
  }

  get totalAvailable(): number {
    return (this.stock?.items ?? []).reduce((s, i) => s + i.availableQuantity, 0);
  }

  get totalReceived(): number {
    return (this.stock?.items ?? []).reduce((s, i) => s + i.totalReceived, 0);
  }

  statusColor(s: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'warning', PARTIALLY_CONFIRMED: 'info',
      FULLY_CONFIRMED: 'success', REJECTED: 'danger', CANCELLED: 'secondary'
    };
    return m[s] ?? 'secondary';
  }
}
