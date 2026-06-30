import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../core/stock/stock.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { EquipmentInstance, InstanceStatus, UnitTrackingFilters } from '../../../core/stock/stock.model';

/**
 * Per-unit (IMEI / Serial) tracking audit. Shared by Admin and ZM: the ZM view is
 * scoped server-side to the ZM's STTs. Lists every tracked EquipmentInstance with its
 * current owner, status and source DPM, and a detail panel showing the full movement history.
 */
@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SpinnerComponent],
  templateUrl: './unit-tracking.component.html',
  styleUrls: ['./unit-tracking.component.scss']
})
export class UnitTrackingComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly authStore = inject(AuthStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  instances: EquipmentInstance[] = [];
  loading = false;
  error: string | null = null;

  // Filters
  search = '';
  statusFilter: InstanceStatus | '' = '';

  readonly statusOptions: { value: InstanceStatus; label: string }[] = [
    { value: 'IN_STT_STOCK', label: 'In STT stock' },
    { value: 'IN_TECH_STOCK', label: 'In TECH stock' },
    { value: 'USED_ON_CASE', label: 'Used on case' },
    { value: 'RECOVERED_FROM_CLIENT', label: 'Recovered from client' },
    { value: 'RETURNED_TO_DEPOT', label: 'Returned to depot' }
  ];

  // Detail panel
  detail: EquipmentInstance | null = null;
  detailVisible = false;
  loadingDetail = false;

  get isAdmin(): boolean { return this.authStore.role() === 'ROLE_ADMIN'; }

  // ── Summary chips (derived client-side from the loaded rows) ──────────────
  get trackedUnitsCount(): number { return this.instances.length; }
  get inTechStockCount(): number { return this.instances.filter(i => i.status === 'IN_TECH_STOCK').length; }
  get usedOnCaseCount(): number { return this.instances.filter(i => i.status === 'USED_ON_CASE').length; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    const filters: UnitTrackingFilters = {
      q: this.search.trim() || undefined,
      status: this.statusFilter || undefined
    };
    const req$ = this.isAdmin
      ? this.stockSvc.adminGetUnitTracking(filters)
      : this.stockSvc.zmGetUnitTracking(filters);
    req$.pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: rows => this.instances = rows,
        error: e => this.error = e.error?.message ?? e.message
      });
  }

  applyFilters(): void { this.load(); }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = '';
    this.load();
  }

  openDetail(inst: EquipmentInstance): void {
    this.detail = inst;
    this.detailVisible = true;
    this.loadingDetail = true;
    const req$ = this.isAdmin
      ? this.stockSvc.adminGetUnitTrackingDetail(inst.id)
      : this.stockSvc.zmGetUnitTrackingDetail(inst.id);
    req$.pipe(finalize(() => { this.loadingDetail = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: d => this.detail = d,
        error: e => this.error = e.error?.message ?? e.message
      });
  }

  closeDetail(): void {
    this.detailVisible = false;
    this.detail = null;
  }

  // ── Display helpers ──────────────────────────────────────────────────────

  statusLabel(s?: string): string {
    return this.statusOptions.find(o => o.value === s)?.label ?? (s ?? '—');
  }

  statusClass(s?: string): string {
    switch (s) {
      case 'IN_STT_STOCK': return 'ut-badge--stt';
      case 'IN_TECH_STOCK': return 'ut-badge--tech';
      case 'USED_ON_CASE': return 'ut-badge--used';
      case 'RECOVERED_FROM_CLIENT': return 'ut-badge--recovered';
      case 'RETURNED_TO_DEPOT': return 'ut-badge--depot';
      default: return 'ut-badge--muted';
    }
  }

  identifier(inst: EquipmentInstance): string {
    const parts: string[] = [];
    if (inst.serialNumber) parts.push(`SN ${inst.serialNumber}`);
    if (inst.imei) parts.push(`IMEI ${inst.imei}`);
    return parts.join(' · ') || '—';
  }

  ownerLabel(inst: EquipmentInstance): string {
    if (!inst.currentOwnerType) return '—';
    const name = inst.currentOwnerName ? ` — ${inst.currentOwnerName}` : '';
    return `${inst.currentOwnerType}${name}`;
  }
}
