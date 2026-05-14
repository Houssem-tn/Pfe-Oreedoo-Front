import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent,
  ColComponent, RowComponent
} from '@coreui/angular';
import Swal from 'sweetalert2';

import { StockService } from '../../../../core/stock/stock.service';
import { PendingDistribution, TechStock, TechStockItem } from '../../../../core/stock/stock.model';

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
  pendingConfirmations: PendingDistribution[] = [];
  loading = false;
  confirming: Record<string, boolean> = {};
  error: string | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      stock: this.stockSvc.getMyTechStock(),
      pending: this.stockSvc.getMyPendingConfirmations()
    }).pipe(finalize(() => this.loading = false)).subscribe({
      next: ({ stock, pending }) => {
        this.stock = stock;
        this.pendingConfirmations = pending;
      },
      error: e => this.error = e.message
    });
  }

  confirmReception(dist: PendingDistribution): void {
    const itemLines = dist.items
      .map(i => `<li><strong>${i.equipmentName}</strong> — ${i.quantity}${i.unit === 'METERS' ? ' m' : ' pcs'}</li>`)
      .join('');

    Swal.fire({
      title: 'Confirm Stock Reception',
      html: `
        <p>You are confirming reception of the following items from <strong>${dist.sttName ?? 'STT'}</strong>:</p>
        <ul style="text-align:left;margin:0.75rem auto;max-width:300px">${itemLines}</ul>
        <p>This action cannot be undone.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, I received it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.confirming = { ...this.confirming, [dist.id]: true };
      this.stockSvc.confirmStockReception(dist.id).pipe(
        finalize(() => {
          const updated = { ...this.confirming };
          delete updated[dist.id];
          this.confirming = updated;
        })
      ).subscribe({
        next: () => {
          this.pendingConfirmations = this.pendingConfirmations.filter(p => p.id !== dist.id);
          this.stockSvc.getMyTechStock().subscribe({ next: s => this.stock = s });
          Swal.fire({
            title: 'Reception Confirmed',
            text: 'The stock has been added to your inventory.',
            icon: 'success',
            timer: 2500,
            showConfirmButton: false
          });
        },
        error: e => {
          Swal.fire('Error', e.error?.message ?? e.message, 'error');
        }
      });
    });
  }

  itemsLabel(dist: PendingDistribution): string {
    const meters = dist.items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.quantity, 0);
    const pieces = dist.items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.quantity, 0);
    return this.stockLabel(meters, pieces);
  }

  private stockLabel(meters: number, pieces: number): string {
    const parts: string[] = [];
    if (meters > 0) parts.push(`${meters} m`);
    if (pieces > 0) parts.push(`${pieces} pcs`);
    return parts.join(' / ') || '0';
  }

  get totalReceivedLabel(): string {
    const items = this.stock?.items ?? [];
    return this.stockLabel(
      items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.receivedQuantity, 0),
      items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.receivedQuantity, 0)
    );
  }

  get totalUsedLabel(): string {
    const items = this.stock?.items ?? [];
    return this.stockLabel(
      items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.usedQuantity, 0),
      items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.usedQuantity, 0)
    );
  }

  get totalRemainingLabel(): string {
    const items = this.stock?.items ?? [];
    return this.stockLabel(
      items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.remainingQuantity, 0),
      items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.remainingQuantity, 0)
    );
  }

  unitLabel(item: TechStockItem): string {
    return item.unit === 'METERS' ? 'm' : 'pcs';
  }

  unitName(item: TechStockItem): string {
    return item.unit === 'METERS' ? 'Meters' : 'Pieces';
  }
}
