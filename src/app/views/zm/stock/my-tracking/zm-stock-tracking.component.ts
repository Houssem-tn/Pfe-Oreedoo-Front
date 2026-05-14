import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { DpmRequest, DpmStatus, SttDistribution } from '../../../../core/stock/stock.model';
import { SwalService } from '../../../../core/ui/swal.service';
import { DpmPdfService } from '../../../../core/pdf/dpm-pdf.service';

@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, SpinnerComponent],
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
  detailVisible = false;
  loadingDetail = false;

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
    this.loadingDetail = true;
    this.detailVisible = true;
    this.stockSvc.zmGetDpmTracking(dpm.id)
      .pipe(finalize(() => { this.loadingDetail = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: t => { this.detailTechDistributions = t.techDistributions; this.cdr.detectChanges(); },
        error: () => { /* non-critical: show panel without distributions */ }
      });
  }

  nameInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

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

  downloadPdf(dpm: DpmRequest): void {
    this.pdfSvc.download(dpm);
  }

  statusLabel(s: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'Pending', PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed', REJECTED: 'Rejected', CANCELLED: 'Cancelled'
    };
    return m[s] ?? s;
  }
}
