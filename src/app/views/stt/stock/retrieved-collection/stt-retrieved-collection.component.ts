import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, NgZone, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { filter, finalize } from 'rxjs/operators';

import { RetrievedStockService } from '../../../../core/stock/retrieved-stock.service';
import { RetrievedStockItem, TechnicianRetrievedStockGroup } from '../../../../core/stock/retrieved-stock.model';
import { materialUnitShort } from '../../../../core/stock/material-quantity.util';
import { NotificationStoreService } from '../../../../core/notifications/notification-store.service';
import { NotificationItem } from '../../../../core/notifications/models/notification.model';

type SttRetrievedTab = 'pending' | 'collected';

/**
 * STT physical-collection page for technician retrieved stock. The responsible STT collects
 * recovered equipment from their technicians; collected items land in STT Collected Stock (never
 * distributable/usable) and later feed the Material Return workflow. The ZM/Admin only track.
 */
@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './stt-retrieved-collection.component.html',
  styleUrls: ['./stt-retrieved-collection.component.scss']
})
export class SttRetrievedCollectionComponent implements OnInit {
  private readonly retrievedStockSvc = inject(RetrievedStockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly notificationStore = inject(NotificationStoreService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab: SttRetrievedTab = 'pending';
  loading = true;
  confirming = false;
  error: string | null = null;

  pendingGroups: TechnicianRetrievedStockGroup[] = [];
  collectedItems: RetrievedStockItem[] = [];

  /** Selected item ids, potentially spanning several technician groups. */
  selectedIds = new Set<string>();

  ngOnInit(): void {
    this.load();

    // Live refresh: a technician declaring new recovery pushes a RETRIEVED_STOCK_DECLARED alert to
    // this STT — reload so the pending list updates without a manual page refresh.
    this.notificationStore.realtime$
      .pipe(
        filter((n: NotificationItem) => (n.eventType ?? '').startsWith('RETRIEVED_STOCK_')),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.selectedIds.clear();

    const done = () => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); };

    if (this.activeTab === 'pending') {
      this.retrievedStockSvc.getSttPendingCollection().pipe(finalize(done)).subscribe({
        next: (groups) => this.pendingGroups = groups,
        error: (e) => this.error = e?.error?.message ?? e.message
      });
    } else {
      this.retrievedStockSvc.getSttCollectedStock().pipe(finalize(done)).subscribe({
        next: (items) => this.collectedItems = items,
        error: (e) => this.error = e?.error?.message ?? e.message
      });
    }
  }

  switchTab(tab: SttRetrievedTab): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.load();
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  isSelected(item: RetrievedStockItem): boolean {
    return this.selectedIds.has(item.id);
  }

  toggleSelected(item: RetrievedStockItem): void {
    if (this.selectedIds.has(item.id)) {
      this.selectedIds.delete(item.id);
    } else {
      this.selectedIds.add(item.id);
    }
  }

  isGroupFullySelected(group: TechnicianRetrievedStockGroup): boolean {
    return group.items.length > 0 && group.items.every((i) => this.selectedIds.has(i.id));
  }

  toggleGroupSelected(group: TechnicianRetrievedStockGroup): void {
    const selectAll = !this.isGroupFullySelected(group);
    for (const item of group.items) {
      if (selectAll) {
        this.selectedIds.add(item.id);
      } else {
        this.selectedIds.delete(item.id);
      }
    }
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get selectedTechnicianCount(): number {
    const techIds = new Set<string>();
    for (const group of this.pendingGroups) {
      if (group.items.some((i) => this.selectedIds.has(i.id))) {
        techIds.add(group.technicianId);
      }
    }
    return techIds.size;
  }

  private get selectedItems(): RetrievedStockItem[] {
    const items: RetrievedStockItem[] = [];
    for (const group of this.pendingGroups) {
      for (const item of group.items) {
        if (this.selectedIds.has(item.id)) {
          items.push(item);
        }
      }
    }
    return items;
  }

  // ── Confirm collection ─────────────────────────────────────────────────────

  async confirmCollection(): Promise<void> {
    const items = this.selectedItems;
    if (items.length === 0) {
      return;
    }

    const itemLines = items
      .map((i) => `<li><strong>${i.equipmentName}</strong> — ${this.quantityLabel(i)} <span class="text-muted">(${i.technicianName ?? 'unknown tech'})</span></li>`)
      .join('');

    const result = await Swal.fire({
      title: 'Confirm physical collection',
      html: `
        <p>You are confirming collection of <strong>${items.length}</strong> item(s)
        from <strong>${this.selectedTechnicianCount}</strong> technician(s):</p>
        <ul style="text-align:left;margin:0.75rem auto;max-width:420px;max-height:260px;overflow:auto">${itemLines}</ul>
        <p>This moves the items into your Collected Stock (not distributable) and cannot be undone.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, confirm collection',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.confirming = true;
    this.retrievedStockSvc.confirmCollection({ itemIds: items.map((i) => i.id) })
      .pipe(finalize(() => { this.confirming = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: (response) => {
          this.selectedIds.clear();
          this.load();
          Swal.fire({
            title: 'Collection confirmed',
            text: `${response.collectedItems.length} item(s) added to your Collected Stock. The technician(s) have been notified.`,
            icon: 'success',
            timer: 3000,
            showConfirmButton: false
          });
        },
        error: (e) => {
          Swal.fire('Error', e?.error?.message ?? e.message, 'error');
        }
      });
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  quantityLabel(item: RetrievedStockItem): string {
    return `${item.quantity} ${materialUnitShort(item.unit)}`;
  }

  identifierLabel(item: RetrievedStockItem): string {
    return [item.serialNumber, item.imei].filter(Boolean).join(' · ') || '-';
  }

  private static readonly STATUS_LABELS: Record<string, string> = {
    PENDING_STT_COLLECTION: 'Pending collection',
    COLLECTED_BY_STT: 'Collected by STT',
    IN_RETURN_REQUEST: 'In return request',
    RETURNED: 'Returned',
    PENDING_COLLECTION: 'Pending collection',
    COLLECTED: 'Collected'
  };

  statusLabel(status?: string): string {
    if (!status) return '-';
    return SttRetrievedCollectionComponent.STATUS_LABELS[status] ?? status;
  }

  statusPillClass(status?: string): string {
    switch (status) {
      case 'PENDING_STT_COLLECTION':
      case 'PENDING_COLLECTION':
        return 'pill--pending';
      case 'COLLECTED_BY_STT':
      case 'COLLECTED':
        return 'pill--collected';
      case 'IN_RETURN_REQUEST':
        return 'pill--return';
      case 'RETURNED':
        return 'pill--returned';
      default:
        return 'pill--neutral';
    }
  }
}
