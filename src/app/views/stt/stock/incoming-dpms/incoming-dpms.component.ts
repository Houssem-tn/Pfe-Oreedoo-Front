import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  SpinnerComponent, TableDirective,
  FormControlDirective, FormLabelDirective, ButtonDirective,
  ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
  BadgeComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import {
  ConfirmDpmRequest, DpmItem, DpmItemConfirmation,
  DpmRequest, DpmStatus
} from '../../../../core/stock/stock.model';

interface ConfirmLine extends DpmItem {
  confirmedQty: number;
  note: string;
}

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, IconDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, TableDirective,
    FormControlDirective, FormLabelDirective, ButtonDirective,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
    BadgeComponent
  ],
  templateUrl: './incoming-dpms.component.html',
  styleUrls: ['./incoming-dpms.component.scss']
})
export class IncomingDpmsComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  dpms: DpmRequest[] = [];
  loading = false;
  error: string | null = null;

  // ── Material reception modal (RDV_CONFIRMED_BY_STT or legacy PENDING) ──────
  confirmModalVisible = false;
  confirmingDpm: DpmRequest | null = null;
  confirmLines: ConfirmLine[] = [];
  rejectReason = '';
  isRejecting = false;
  confirming = false;

  // ── RDV confirmation ────────────────────────────────────────────────────────
  confirmingRdv = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    this.stockSvc.getIncomingDpms()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: d => this.dpms = d,
        error: e => this.error = e.message
      });
  }

  // ── Status helpers ──────────────────────────────────────────────────────────

  canConfirmRdv(dpm: DpmRequest): boolean {
    return dpm.status === 'RDV_SCHEDULED';
  }

  canConfirmReception(dpm: DpmRequest): boolean {
    return dpm.status === 'RDV_CONFIRMED_BY_STT' || dpm.status === 'PENDING_STT_CONFIRMATION';
  }

  isWaitingApproval(dpm: DpmRequest): boolean {
    return dpm.status === 'WAITING_TEAM_STOCK_APPROVAL';
  }

  statusLabel(s: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      WAITING_TEAM_STOCK_APPROVAL: 'Waiting Approval',
      TEAM_STOCK_REJECTED: 'Rejected by Team Stock',
      RDV_SCHEDULED: 'RDV Scheduled',
      RDV_CONFIRMED_BY_STT: 'RDV Confirmed',
      MATERIAL_RECEIVED: 'Material Received',
      COMPLETED: 'Completed',
      PENDING_STT_CONFIRMATION: 'Pending',
      PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled'
    };
    return m[s] ?? s;
  }

  statusColor(s: DpmStatus): string {
    switch (s) {
      case 'WAITING_TEAM_STOCK_APPROVAL': return 'warning';
      case 'TEAM_STOCK_REJECTED':         return 'danger';
      case 'RDV_SCHEDULED':               return 'info';
      case 'RDV_CONFIRMED_BY_STT':        return 'primary';
      case 'MATERIAL_RECEIVED':           return 'success';
      case 'COMPLETED':                   return 'success';
      case 'PENDING_STT_CONFIRMATION':    return 'warning';
      case 'PARTIALLY_CONFIRMED':         return 'info';
      case 'FULLY_CONFIRMED':             return 'success';
      case 'REJECTED':                    return 'danger';
      case 'CANCELLED':                   return 'secondary';
      default:                            return 'secondary';
    }
  }

  // ── RDV confirmation ────────────────────────────────────────────────────────

  submitRdvConfirmation(dpm: DpmRequest): void {
    this.confirmingRdv = true;
    this.error = null;
    this.stockSvc.confirmRdv(dpm.id)
      .pipe(finalize(() => { this.confirmingRdv = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => this.load(),
        error: e => this.error = e.error?.message ?? e.message
      });
  }

  // ── Material reception modal ────────────────────────────────────────────────

  openConfirm(dpm: DpmRequest): void {
    this.confirmingDpm = dpm;
    this.confirmLines = dpm.items.map(item => ({
      ...item,
      confirmedQty: item.requestedQuantity,
      note: ''
    }));
    this.rejectReason = '';
    this.isRejecting = false;
    this.confirmModalVisible = true;
  }

  increment(line: ConfirmLine): void { line.confirmedQty++; }
  decrement(line: ConfirmLine): void { if (line.confirmedQty > 0) line.confirmedQty--; }

  toggleReject(): void {
    this.isRejecting = !this.isRejecting;
    if (this.isRejecting) this.confirmLines.forEach(l => l.confirmedQty = 0);
    else this.confirmLines.forEach((l, i) => l.confirmedQty = this.confirmingDpm!.items[i].requestedQuantity);
  }

  submitConfirmation(): void {
    if (!this.confirmingDpm) return;
    this.confirming = true;
    const payload: ConfirmDpmRequest = {
      items: this.confirmLines.map<DpmItemConfirmation>(l => ({
        equipmentId: l.equipmentId,
        confirmedQuantity: l.confirmedQty,
        confirmationNote: l.note.trim() || undefined
      })),
      rejectReason: this.isRejecting ? this.rejectReason.trim() : undefined
    };
    this.stockSvc.confirmDpm(this.confirmingDpm.id, payload)
      .pipe(finalize(() => { this.confirming = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => { this.confirmModalVisible = false; this.load(); },
        error: e => this.error = e.error?.message ?? e.message
      });
  }

  get hasShortage(): boolean {
    return this.confirmLines.some(l => l.confirmedQty < l.requestedQuantity);
  }

  get shortageLabel(): string {
    const mShort = this.confirmLines
      .filter(l => l.unit === 'METERS')
      .reduce((s, l) => s + Math.max(0, l.requestedQuantity - l.confirmedQty), 0);
    const pShort = this.confirmLines
      .filter(l => l.unit !== 'METERS')
      .reduce((s, l) => s + Math.max(0, l.requestedQuantity - l.confirmedQty), 0);
    const parts: string[] = [];
    if (mShort > 0) parts.push(`${mShort} m`);
    if (pShort > 0) parts.push(`${pShort} pcs`);
    return parts.join(' / ') || '0';
  }

  unitSuffix(unit?: string | null): string {
    return unit === 'METERS' ? ' m' : ' pcs';
  }
}
