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

import { forkJoin } from 'rxjs';
import { StockService } from '../../../../core/stock/stock.service';
import {
  ConfirmDpmRequest, DpmItem, DpmItemConfirmation,
  DpmRequest, DpmStatus, Equipment, TrackingMode, UnitTrackingInput
} from '../../../../core/stock/stock.model';

interface ConfirmUnit {
  imei: string;
  serialNumber: string;
}

interface ConfirmLine extends DpmItem {
  confirmedQty: number;
  note: string;
  trackingMode: TrackingMode;
  units: ConfirmUnit[];
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

  /** equipmentId → trackingMode, for deciding which reception lines need IMEI/Serial rows. */
  private trackingByEquipment = new Map<string, TrackingMode>();

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
    forkJoin({
      dpms: this.stockSvc.getIncomingDpms(),
      equipment: this.stockSvc.getEquipment()
    })
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ dpms, equipment }) => {
          this.dpms = dpms;
          this.trackingByEquipment = new Map(
            equipment.map((e: Equipment) => [e.id, e.trackingMode ?? 'NONE'])
          );
        },
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
    this.confirmLines = dpm.items.map(item => {
      const trackingMode = this.trackingByEquipment.get(item.equipmentId) ?? 'NONE';
      const line: ConfirmLine = {
        ...item,
        confirmedQty: item.requestedQuantity,
        note: '',
        trackingMode,
        units: []
      };
      this.syncUnits(line);
      return line;
    });
    this.rejectReason = '';
    this.isRejecting = false;
    this.confirmModalVisible = true;
  }

  increment(line: ConfirmLine): void { line.confirmedQty++; this.syncUnits(line); }
  decrement(line: ConfirmLine): void { if (line.confirmedQty > 0) { line.confirmedQty--; this.syncUnits(line); } }

  /** Keep a tracked line's IMEI/Serial rows in sync with the confirmed quantity. */
  onQtyChange(line: ConfirmLine): void {
    if (!Number.isFinite(line.confirmedQty) || line.confirmedQty < 0) line.confirmedQty = 0;
    this.syncUnits(line);
  }

  private syncUnits(line: ConfirmLine): void {
    if (!this.isTracked(line.trackingMode)) { line.units = []; return; }
    const target = Math.max(0, line.confirmedQty);
    while (line.units.length < target) line.units.push({ imei: '', serialNumber: '' });
    if (line.units.length > target) line.units.length = target;
  }

  toggleReject(): void {
    this.isRejecting = !this.isRejecting;
    if (this.isRejecting) {
      this.confirmLines.forEach(l => { l.confirmedQty = 0; this.syncUnits(l); });
    } else {
      this.confirmLines.forEach((l, i) => { l.confirmedQty = this.confirmingDpm!.items[i].requestedQuantity; this.syncUnits(l); });
    }
  }

  // ── Tracking helpers ───────────────────────────────────────────────────────

  isTracked(mode?: TrackingMode): boolean { return !!mode && mode !== 'NONE'; }
  requiresImei(mode?: TrackingMode): boolean { return mode === 'IMEI_ONLY' || mode === 'SERIAL_AND_IMEI'; }
  requiresSerial(mode?: TrackingMode): boolean { return mode === 'SERIAL_ONLY' || mode === 'SERIAL_AND_IMEI'; }
  requiresAtLeastOne(mode?: TrackingMode): boolean { return mode === 'SERIAL_OR_IMEI'; }

  /** Per-line validation error message for tracked items, or null when valid. */
  unitError(line: ConfirmLine): string | null {
    if (this.isRejecting || !this.isTracked(line.trackingMode) || line.confirmedQty <= 0) return null;
    if (line.units.length !== line.confirmedQty) return `Enter details for all ${line.confirmedQty} unit(s).`;
    const seenImei = new Set<string>();
    const seenSerial = new Set<string>();
    for (let i = 0; i < line.units.length; i++) {
      const imei = (line.units[i].imei ?? '').trim().toUpperCase();
      const serial = (line.units[i].serialNumber ?? '').trim().toUpperCase();
      if (this.requiresImei(line.trackingMode) && !imei) return `Unit #${i + 1}: IMEI is required.`;
      if (this.requiresSerial(line.trackingMode) && !serial) return `Unit #${i + 1}: Serial Number is required.`;
      if (this.requiresAtLeastOne(line.trackingMode) && !imei && !serial) return `Unit #${i + 1}: enter an IMEI or a Serial Number.`;
      if (imei) { if (seenImei.has(imei)) return `IMEI "${line.units[i].imei}" is repeated.`; seenImei.add(imei); }
      if (serial) { if (seenSerial.has(serial)) return `Serial "${line.units[i].serialNumber}" is repeated.`; seenSerial.add(serial); }
    }
    return null;
  }

  get trackingValid(): boolean {
    if (this.isRejecting) return true;
    return this.confirmLines.every(l => this.unitError(l) === null);
  }

  submitConfirmation(): void {
    if (!this.confirmingDpm) return;
    if (!this.trackingValid) {
      this.error = 'Please complete the required IMEI / Serial details for tracked items.';
      return;
    }
    this.confirming = true;
    this.error = null;
    const payload: ConfirmDpmRequest = {
      items: this.confirmLines.map<DpmItemConfirmation>(l => ({
        equipmentId: l.equipmentId,
        confirmedQuantity: l.confirmedQty,
        confirmationNote: l.note.trim() || undefined,
        units: (!this.isRejecting && this.isTracked(l.trackingMode) && l.confirmedQty > 0)
          ? l.units.map<UnitTrackingInput>(u => ({
              imei: u.imei.trim() || undefined,
              serialNumber: u.serialNumber.trim() || undefined
            }))
          : undefined
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
