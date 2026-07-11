import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import {
  ReviewPermissionRequest,
  RejectPermissionRequest,
  StockUsagePermission
} from '../../../../core/stock/stock.model';
import { formatMaterialQuantity, normalizeMaterialUnit } from '../../../../core/stock/material-quantity.util';

@Component({
  selector: 'app-stt-usage-approvals',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    IconDirective,
    SpinnerComponent
  ],
  templateUrl: './stt-usage-approvals.component.html',
  styleUrl:    './stt-usage-approvals.component.scss'
})
export class SttUsageApprovalsComponent implements OnInit {
  private readonly stockService = inject(StockService);

  readonly loading          = signal(true);
  readonly pending          = signal<StockUsagePermission[]>([]);
  readonly selectedReq      = signal<StockUsagePermission | null>(null);
  readonly approveModalOpen = signal(false);
  readonly rejectModalOpen  = signal(false);
  readonly saving           = signal(false);
  readonly error            = signal<string | null>(null);

  approveDraft: ReviewPermissionRequest = {
    approvedCableMeters: 0,
    approvedItems:       [],
    reviewComment:       ''
  };
  rejectComment = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.stockService.getMyPendingPermissions().subscribe({
      next:  (list) => { this.pending.set(list); this.loading.set(false); },
      error: ()     => { this.loading.set(false); this.error.set('Failed to load approval queue. Try refreshing.'); }
    });
  }

  openApproveModal(req: StockUsagePermission): void {
    this.selectedReq.set(req);
    this.approveDraft = {
      approvedCableMeters: req.requestedCableMeters,
      approvedItems: (req.requestedItems ?? []).map(item => ({
        itemId:           item.itemId,
        approvedQuantity: item.requestedQuantity
      })),
      reviewComment: ''
    };
    this.approveModalOpen.set(true);
  }

  openRejectModal(req: StockUsagePermission): void {
    this.selectedReq.set(req);
    this.rejectComment = '';
    this.rejectModalOpen.set(true);
  }

  submitApprove(): void {
    const req = this.selectedReq();
    if (!req) return;
    this.saving.set(true);

    this.stockService.approvePermission(req.id, this.approveDraft).subscribe({
      next: () => {
        this.saving.set(false);
        this.approveModalOpen.set(false);
        this.pending.update(list => list.filter(p => p.id !== req.id));
      },
      error: (err) => {
        this.saving.set(false);
        alert(err?.error?.message ?? 'Failed to approve request.');
      }
    });
  }

  submitReject(): void {
    const req = this.selectedReq();
    if (!req || !this.rejectComment.trim()) return;
    this.saving.set(true);

    const payload: RejectPermissionRequest = { reviewComment: this.rejectComment.trim() };
    this.stockService.rejectPermission(req.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.rejectModalOpen.set(false);
        this.pending.update(list => list.filter(p => p.id !== req.id));
      },
      error: (err) => {
        this.saving.set(false);
        alert(err?.error?.message ?? 'Failed to reject request.');
      }
    });
  }

  quantityLabel(quantity: number, unit?: string | null): string {
    return formatMaterialQuantity(quantity, unit);
  }

  showLegacyRequestedCable(req: StockUsagePermission): boolean {
    return req.requestedCableMeters > 0
      && !(req.requestedItems ?? []).some(item => normalizeMaterialUnit(item.unit) === 'METERS');
  }
}
