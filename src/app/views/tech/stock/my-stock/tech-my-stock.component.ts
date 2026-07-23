import { ChangeDetectorRef, Component, DestroyRef, NgZone, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent,
  ColComponent, RowComponent
} from '@coreui/angular';
import Swal from 'sweetalert2';

import { StockService } from '../../../../core/stock/stock.service';
import { PendingDistribution, TechStock, TechStockItem } from '../../../../core/stock/stock.model';
import {
  formatMaterialGroups,
  groupMaterialQuantities,
  materialUnitLabel,
  materialUnitShort
} from '../../../../core/stock/material-quantity.util';
import { RetrievedStockService } from '../../../../core/stock/retrieved-stock.service';
import { RetrievedStockItem } from '../../../../core/stock/retrieved-stock.model';
import { NotificationStoreService } from '../../../../core/notifications/notification-store.service';
import { NotificationItem } from '../../../../core/notifications/models/notification.model';

type TechStockTab = 'available' | 'retrieved';

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
  private readonly retrievedStockSvc = inject(RetrievedStockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly notificationStore = inject(NotificationStoreService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab: TechStockTab = 'available';

  stock: TechStock | null = null;
  pendingConfirmations: PendingDistribution[] = [];
  retrievedItems: RetrievedStockItem[] = [];
  loading = true;
  confirming: Record<string, boolean> = {};
  error: string | null = null;

  ngOnInit(): void {
    this.load();

    // Live updates: whenever a stock-affecting event reaches this technician over the
    // WebSocket (STT distribution, distribution/return approval, retrieved-stock collection,
    // threshold alerts), reload from the backend — no manual page refresh required.
    this.notificationStore.realtime$
      .pipe(
        filter((n) => this.affectsTechStock(n)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.load());
  }

  private affectsTechStock(n: NotificationItem): boolean {
    const type = n.eventType ?? '';
    return type.startsWith('STOCK_')
      || type.startsWith('RETRIEVED_STOCK_')
      || n.category === 'STOCK';
  }

  switchTab(tab: TechStockTab): void {
    this.activeTab = tab;
  }

  load(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      stock: this.stockSvc.getMyTechStock(),
      pending: this.stockSvc.getMyPendingConfirmations(),
      retrieved: this.retrievedStockSvc.getMyRetrievedStock()
    }).pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); })).subscribe({
      next: ({ stock, pending, retrieved }) => {
        this.stock = stock;
        this.pendingConfirmations = pending;
        this.retrievedItems = retrieved;
      },
      error: e => this.error = e.message
    });
  }

  retrievedItemIdentifier(item: RetrievedStockItem): string {
    return [item.serialNumber, item.imei].filter(Boolean).join(' · ') || '-';
  }

  confirmReception(dist: PendingDistribution): void {
    const itemLines = dist.items
      .map(i => `<li><strong>${i.equipmentName}</strong> — ${this.quantityLabel(i.quantity, i.unit)}</li>`)
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
          // Reload the full snapshot (stock + pending + retrieved) from the backend so every
          // panel reflects the confirmed reception immediately — no manual refresh.
          this.load();
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
    return formatMaterialGroups(this.materialGroups(dist.items, item => item.quantity));
  }

  get totalReceivedLabel(): string {
    return formatMaterialGroups(this.materialGroups(this.stock?.items ?? [], item => item.receivedQuantity));
  }

  get totalUsedLabel(): string {
    return formatMaterialGroups(this.materialGroups(this.stock?.items ?? [], item => item.usedQuantity));
  }

  get totalRemainingLabel(): string {
    return formatMaterialGroups(this.materialGroups(this.stock?.items ?? [], item => item.remainingQuantity));
  }

  unitLabel(item: TechStockItem): string {
    return materialUnitShort(item.unit);
  }

  unitName(item: TechStockItem): string {
    return materialUnitLabel(item.unit);
  }

  quantityLabel(quantity: number, unit?: string | null): string {
    return `${quantity} ${materialUnitShort(unit)}`;
  }

  private materialGroups<T extends { equipmentId: string; equipmentName?: string; unit?: string }>(
    items: readonly T[],
    quantity: (item: T) => number
  ) {
    return groupMaterialQuantities(items, {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity
    });
  }
}
