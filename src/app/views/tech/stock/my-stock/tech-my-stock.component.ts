import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent,
  ColComponent, RowComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { TechStock, TechStockItem } from '../../../../core/stock/stock.model';

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, IconDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, SpinnerComponent,
    ColComponent, RowComponent
  ],
  templateUrl: './tech-my-stock.component.html'
})
export class TechMyStockComponent implements OnInit {
  private readonly stockSvc = inject(StockService);

  stock: TechStock | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.stockSvc.getMyTechStock().pipe(finalize(() => this.loading = false)).subscribe({
      next: s => this.stock = s,
      error: e => this.error = e.message
    });
  }

  get totalReceived(): number {
    return (this.stock?.items ?? []).reduce((s, i) => s + i.receivedQuantity, 0);
  }

  get totalUsed(): number {
    return (this.stock?.items ?? []).reduce((s, i) => s + i.usedQuantity, 0);
  }

  get totalRemaining(): number {
    return (this.stock?.items ?? []).reduce((s, i) => s + i.remainingQuantity, 0);
  }

  unitLabel(item: TechStockItem): string {
    return item.unit === 'METERS' ? 'm' : 'pcs';
  }

  unitName(item: TechStockItem): string {
    return item.unit === 'METERS' ? 'Meters' : 'Pieces';
  }
}
