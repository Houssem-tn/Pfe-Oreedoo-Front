import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { finalize } from 'rxjs/operators';

import { RetrievedStockService } from '../../../../core/stock/retrieved-stock.service';
import { RetrievedStockItem, RetrievedStockItemStatus } from '../../../../core/stock/retrieved-stock.model';
import { materialUnitShort } from '../../../../core/stock/material-quantity.util';

/**
 * ZM READ-ONLY tracking of the retrieved → collected → returned flow across the ZM's territory.
 * The ZM no longer performs collection — that is the responsible STT's action. This view only
 * observes and filters; it exposes no collection controls.
 */
@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './zm-retrieved-collection.component.html',
  styleUrls: ['./zm-retrieved-collection.component.scss']
})
export class ZmRetrievedCollectionComponent implements OnInit {
  private readonly retrievedStockSvc = inject(RetrievedStockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  loading = true;
  error: string | null = null;

  readonly items = signal<RetrievedStockItem[]>([]);

  // Simple read-only filters (STT / technician / status / free-text on serial/imei/customer/case).
  readonly sttFilter = signal('');
  readonly statusFilter = signal('');
  readonly search = signal('');

  readonly sttOptions = computed(() =>
    Array.from(new Set(this.items().map(i => i.sttName).filter(Boolean))) as string[]
  );
  readonly statusOptions = computed(() =>
    Array.from(new Set(this.items().map(i => i.status).filter(Boolean))) as string[]
  );

  readonly filtered = computed(() => {
    const stt = this.sttFilter();
    const status = this.statusFilter();
    const term = this.search().trim().toLowerCase();
    return this.items().filter(i => {
      if (stt && i.sttName !== stt) return false;
      if (status && i.status !== status) return false;
      if (term) {
        const hay = `${i.serialNumber ?? ''} ${i.imei ?? ''} ${i.clientName ?? ''} ${i.crmCase ?? ''} ${i.technicianName ?? ''} ${i.equipmentName ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  });

  // ── Stat chips (whole territory, unfiltered) ────────────────────────────────
  readonly countTotal = computed(() => this.items().length);
  readonly countPending = computed(() =>
    this.items().filter(i => i.status === 'PENDING_STT_COLLECTION' || i.status === 'PENDING_COLLECTION').length
  );
  readonly countCollected = computed(() =>
    this.items().filter(i => i.status === 'COLLECTED_BY_STT' || i.status === 'COLLECTED').length
  );
  readonly countReturned = computed(() => this.items().filter(i => i.status === 'RETURNED').length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.retrievedStockSvc.getZmTracking()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: (items) => this.items.set(items),
        error: (e) => this.error = e?.error?.message ?? e.message
      });
  }

  quantityLabel(item: RetrievedStockItem): string {
    return `${item.quantity} ${materialUnitShort(item.unit)}`;
  }

  identifierLabel(item: RetrievedStockItem): string {
    return [item.serialNumber, item.imei].filter(Boolean).join(' · ') || '-';
  }

  collectorLabel(item: RetrievedStockItem): string {
    return item.collectedBySttName ?? item.collectedByZmName ?? '-';
  }

  // ── Status presentation ─────────────────────────────────────────────────────

  private static readonly STATUS_LABELS: Record<string, string> = {
    PENDING_STT_COLLECTION: 'Pending collection',
    COLLECTED_BY_STT: 'Collected by STT',
    IN_RETURN_REQUEST: 'In return request',
    RETURNED: 'Returned',
    PENDING_COLLECTION: 'Pending collection',
    COLLECTED: 'Collected'
  };

  statusLabel(status?: RetrievedStockItemStatus | string): string {
    if (!status) return '-';
    return ZmRetrievedCollectionComponent.STATUS_LABELS[status] ?? status;
  }

  statusPillClass(status?: RetrievedStockItemStatus | string): string {
    switch (status) {
      case 'PENDING_STT_COLLECTION':
      case 'PENDING_COLLECTION':
        return 'zt-pill--pending';
      case 'COLLECTED_BY_STT':
      case 'COLLECTED':
        return 'zt-pill--partial';
      case 'IN_RETURN_REQUEST':
        return 'zt-pill--rdv';
      case 'RETURNED':
        return 'zt-pill--confirmed';
      default:
        return 'zt-pill--cancelled';
    }
  }
}
