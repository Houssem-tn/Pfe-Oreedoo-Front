import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  SpinnerComponent,
  ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
  FormControlDirective, FormLabelDirective, ButtonDirective
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import {
  DpmAllocation, DpmRequest, DpmStatus, DpmTechRollup, RecordExternalApprovalRequest,
  SttDistribution
} from '../../../../core/stock/stock.model';
import { SwalService } from '../../../../core/ui/swal.service';
import { DpmPdfService } from '../../../../core/pdf/dpm-pdf.service';
import {
  formatMaterialGroups,
  formatMaterialQuantity,
  groupMaterialQuantities,
  materialUnitShort
} from '../../../../core/stock/material-quantity.util';

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
    FormControlDirective, FormLabelDirective, ButtonDirective
  ],
  templateUrl: './zm-stock-tracking.component.html',
  styleUrls: ['./zm-stock-tracking.component.scss']
})
export class ZmStockTrackingComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly swal = inject(SwalService);
  private readonly pdfSvc = inject(DpmPdfService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  dpms: DpmRequest[] = [];
  loading = false;
  error: string | null = null;

  filterStatus: DpmStatus | '' = '';
  filterStt = '';

  detailDpm: DpmRequest | null = null;
  detailTechDistributions: SttDistribution[] = [];
  detailTechRollups: DpmTechRollup[] = [];
  detailAllocations: DpmAllocation[] = [];
  detailVisible = false;
  loadingDetail = false;

  // ── RDV / External Approval Modal ─────────────────────────────────────────
  rdvModalVisible = false;
  rdvTargetDpm: DpmRequest | null = null;
  rdvForm: RecordExternalApprovalRequest = this.emptyRdvForm();
  rdvSubmitting = false;
  rdvError: string | null = null;

  // ── Rejection Modal ────────────────────────────────────────────────────────
  rejectModalVisible = false;
  rejectTargetDpm: DpmRequest | null = null;
  rejectionReason = '';
  rejecting = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    this.stockSvc.getMyDpms()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: d => this.dpms = d, error: e => this.error = e.message });
  }

  openDetail(dpm: DpmRequest): void {
    this.detailDpm = dpm;
    this.detailTechDistributions = [];
    this.detailTechRollups = [];
    this.detailAllocations = [];
    this.loadingDetail = true;
    this.detailVisible = true;
    this.stockSvc.zmGetDpmTracking(dpm.id)
      .pipe(finalize(() => { this.loadingDetail = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: t => {
          this.detailTechDistributions = t.techDistributions ?? [];
          this.detailTechRollups = t.techRollups ?? [];
          this.detailAllocations = t.allocations ?? [];
          this.cdr.detectChanges();
        },
        error: () => { /* non-critical */ }
      });
  }

  get hasAnyTechDistribution(): boolean {
    return this.detailTechRollups.length > 0 || this.detailTechDistributions.length > 0;
  }

  unitShort(unit?: string): string {
    return materialUnitShort(unit);
  }

  // ── RDV modal ──────────────────────────────────────────────────────────────

  openRdvModal(dpm: DpmRequest): void {
    this.rdvTargetDpm = dpm;
    this.rdvForm = this.emptyRdvForm();
    this.rdvError = null;
    this.rdvModalVisible = true;
  }

  submitRdv(): void {
    if (!this.rdvTargetDpm) return;
    if (!this.rdvForm.rdvDate?.trim() || !this.rdvForm.rdvLocation?.trim()) {
      this.rdvError = 'RDV date and location are required.';
      return;
    }
    this.rdvSubmitting = true;
    this.rdvError = null;
    this.stockSvc.recordExternalApprovalAndRdv(this.rdvTargetDpm.id, this.rdvForm)
      .pipe(finalize(() => { this.rdvSubmitting = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: updated => {
          this.rdvModalVisible = false;
          this.dpms = this.dpms.map(d => d.id === updated.id ? updated : d);
          if (this.detailDpm?.id === updated.id) this.detailDpm = updated;
          this.cdr.detectChanges();
        },
        error: e => { this.rdvError = e.error?.message ?? e.message; }
      });
  }

  // ── Rejection modal ────────────────────────────────────────────────────────

  openRejectModal(dpm: DpmRequest): void {
    this.rejectTargetDpm = dpm;
    this.rejectionReason = '';
    this.rejectModalVisible = true;
  }

  submitRejection(): void {
    if (!this.rejectTargetDpm) return;
    this.rejecting = true;
    this.stockSvc.recordExternalRejection(this.rejectTargetDpm.id, { rejectionReason: this.rejectionReason.trim() || undefined })
      .pipe(finalize(() => { this.rejecting = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: updated => {
          this.rejectModalVisible = false;
          this.dpms = this.dpms.map(d => d.id === updated.id ? updated : d);
          if (this.detailDpm?.id === updated.id) this.detailDpm = updated;
          this.cdr.detectChanges();
        },
        error: e => this.error = e.error?.message ?? e.message
      });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  cancelDpm(dpm: DpmRequest): void {
    this.swal.confirmAction(
      'Cancel DPM ' + dpm.dpmNumber + '?',
      'This cannot be undone.',
      'Cancel DPM'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.stockSvc.cancelDpm(dpm.id).subscribe({
        next: () => this.load(),
        error: e => this.error = e.message
      });
    });
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  canZmScheduleRdv(dpm: DpmRequest): boolean {
    return dpm.status === 'WAITING_TEAM_STOCK_APPROVAL';
  }

  canZmReject(dpm: DpmRequest): boolean {
    return dpm.status === 'WAITING_TEAM_STOCK_APPROVAL';
  }

  canZmCancel(dpm: DpmRequest): boolean {
    return dpm.status === 'WAITING_TEAM_STOCK_APPROVAL' || dpm.status === 'PENDING_STT_CONFIRMATION';
  }

  statusLabel(s: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      WAITING_TEAM_STOCK_APPROVAL: 'Waiting Approval',
      TEAM_STOCK_REJECTED:         'Ext. Rejected',
      RDV_SCHEDULED:               'RDV Scheduled',
      RDV_CONFIRMED_BY_STT:        'RDV Confirmed',
      MATERIAL_RECEIVED:           'Material Received',
      COMPLETED:                   'Completed',
      PENDING_STT_CONFIRMATION:    'Pending',
      PARTIALLY_CONFIRMED:         'Partial',
      FULLY_CONFIRMED:             'Confirmed',
      REJECTED:                    'Rejected',
      CANCELLED:                   'Cancelled'
    };
    return m[s] ?? s;
  }

  get filtered(): DpmRequest[] {
    return this.dpms.filter(d => {
      const matchStatus = !this.filterStatus || d.status === this.filterStatus;
      const matchStt = !this.filterStt || d.sttName.toLowerCase().includes(this.filterStt.toLowerCase());
      return matchStatus && matchStt;
    });
  }

  countByStatus(status: DpmStatus): number {
    return this.dpms.filter(d => d.status === status).length;
  }

  countWaiting(): number {
    return this.dpms.filter(d => d.status === 'WAITING_TEAM_STOCK_APPROVAL').length;
  }

  countRdvScheduled(): number {
    return this.dpms.filter(d => d.status === 'RDV_SCHEDULED' || d.status === 'RDV_CONFIRMED_BY_STT').length;
  }

  countMaterialReceived(): number {
    return this.dpms.filter(d =>
      d.status === 'MATERIAL_RECEIVED' || d.status === 'FULLY_CONFIRMED' || d.status === 'COMPLETED'
    ).length;
  }

  downloadPdf(dpm: DpmRequest): void {
    this.pdfSvc.download(dpm);
  }

  nameInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  rollupUsageSummary(roll: DpmTechRollup): string {
    return [
      `distributed ${formatMaterialGroups(this.rollupGroups(roll.items, item => item.distributedQuantity))}`,
      `used ${formatMaterialGroups(this.rollupGroups(roll.items, item => item.usedQuantity))}`,
      `remaining ${formatMaterialGroups(this.rollupGroups(roll.items, item => item.remainingQuantity))}`
    ].join(' · ');
  }

  quantityLabel(quantity: number, unit?: string | null): string {
    return formatMaterialQuantity(quantity, unit);
  }

  private rollupGroups(
    items: readonly DpmTechRollup['items'][number][],
    quantity: (item: DpmTechRollup['items'][number]) => number
  ) {
    return groupMaterialQuantities(items, {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity
    });
  }

  private emptyRdvForm(): RecordExternalApprovalRequest {
    return { approvalReference: '', approvalNote: '', rdvDate: '', rdvLocation: '', rdvNote: '' };
  }
}
