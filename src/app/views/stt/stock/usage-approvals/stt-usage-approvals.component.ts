import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import {
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ContainerComponent,
  FormControlDirective,
  FormLabelDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  ModalToggleDirective,
  SpinnerComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import {
  ReviewPermissionRequest,
  RejectPermissionRequest,
  StockUsagePermission,
  PermissionItemDetail
} from '../../../../core/stock/stock.model';

@Component({
  selector: 'app-stt-usage-approvals',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    RouterLink,
    IconDirective,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    BadgeComponent,
    ButtonDirective,
    SpinnerComponent,
    FormControlDirective,
    FormLabelDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalToggleDirective
  ],
  template: `
    <c-container fluid class="py-3">

      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 class="mb-0">Stock Usage Approvals</h4>
          <p class="text-body-secondary mb-0" style="font-size:.875rem">
            Pending over-limit stock usage requests from your technicians.
          </p>
        </div>
        <button cButton color="secondary" variant="outline" size="sm" (click)="load()">
          Refresh
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="text-center py-5">
        <c-spinner></c-spinner>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading() && pending().length === 0"
           class="text-center py-5 text-body-secondary">
        <svg cIcon name="cilCheckCircle" style="width:2.5rem;height:2.5rem;opacity:.4"></svg>
        <p class="mt-2">No pending approval requests.</p>
      </div>

      <!-- Cards -->
      <div class="d-flex flex-column gap-3" *ngIf="!loading() && pending().length > 0">
        <c-card *ngFor="let req of pending()" class="permission-card">
          <c-card-body>
            <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
              <!-- Left: request info -->
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <svg cIcon name="cilStorage" style="width:16px;height:16px;color:#e55353"></svg>
                  <span class="fw-bold">{{ req.techName }}</span>
                  <span class="text-body-secondary">→ Case {{ req.caseReference }}</span>
                </div>

                <!-- Requested cable -->
                <div *ngIf="req.requestedCableMeters > 0" class="mb-1"
                     style="font-size:.875rem">
                  <strong>Cable:</strong>
                  {{ req.requestedCableMeters }}m requested
                </div>

                <!-- Requested items -->
                <div *ngIf="req.requestedItems?.length" style="font-size:.875rem">
                  <strong>Equipment:</strong>
                  <span *ngFor="let item of req.requestedItems; let last = last">
                    {{ item.requestedQuantity }}x {{ item.itemName }}<span *ngIf="!last">, </span>
                  </span>
                </div>

                <!-- Reason -->
                <div *ngIf="req.reason" class="mt-1 text-body-secondary" style="font-size:.82rem">
                  <em>Reason: {{ req.reason }}</em>
                </div>

                <div class="mt-1 text-body-secondary" style="font-size:.78rem">
                  Requested: {{ req.createdAt | date:'dd MMM yyyy, HH:mm' }}
                </div>
              </div>

              <!-- Right: action buttons -->
              <div class="d-flex gap-2 flex-wrap">
                <button cButton color="success" size="sm" (click)="openApproveModal(req)">
                  Approve
                </button>
                <button cButton color="danger" variant="outline" size="sm"
                        (click)="openRejectModal(req)">
                  Reject
                </button>
              </div>
            </div>
          </c-card-body>
        </c-card>
      </div>

    </c-container>

    <!-- ── Approve Modal ─────────────────────────────────────────────────── -->
    <c-modal [visible]="approveModalOpen()" (visibleChange)="approveModalOpen.set($event)">
      <c-modal-header>
        <h5 cModalTitle>Approve Usage Request</h5>
      </c-modal-header>
      <c-modal-body *ngIf="selectedReq()">
        <p class="text-body-secondary" style="font-size:.875rem">
          Review and set the approved amounts for TECH <strong>{{ selectedReq()!.techName }}</strong>.
        </p>

        <!-- Cable -->
        <div *ngIf="selectedReq()!.requestedCableMeters > 0" class="mb-3">
          <label cFormLabel>Cable approved (m)</label>
          <input type="number" cFormControl [min]="0"
                 [max]="selectedReq()!.requestedCableMeters"
                 [(ngModel)]="approveDraft.approvedCableMeters" />
          <div class="text-body-secondary mt-1" style="font-size:.8rem">
            Requested: {{ selectedReq()!.requestedCableMeters }}m
          </div>
        </div>

        <!-- Items -->
        <div *ngFor="let item of selectedReq()!.requestedItems; let i = index" class="mb-3">
          <label cFormLabel>{{ item.itemName }} approved quantity</label>
          <input type="number" cFormControl [min]="0" [max]="item.requestedQuantity"
                 [(ngModel)]="approveDraft.approvedItems![i].approvedQuantity" />
          <div class="text-body-secondary mt-1" style="font-size:.8rem">
            Requested: {{ item.requestedQuantity }}
          </div>
        </div>

        <!-- Review comment -->
        <div class="mb-3">
          <label cFormLabel>Comment (optional)</label>
          <textarea cFormControl rows="2" [(ngModel)]="approveDraft.reviewComment"></textarea>
        </div>
      </c-modal-body>
      <c-modal-footer>
        <button cButton color="secondary" variant="outline"
                (click)="approveModalOpen.set(false)">Cancel</button>
        <button cButton color="success" (click)="submitApprove()" [disabled]="saving()">
          <c-spinner size="sm" *ngIf="saving()"></c-spinner>
          <span *ngIf="!saving()">Confirm Approval</span>
        </button>
      </c-modal-footer>
    </c-modal>

    <!-- ── Reject Modal ──────────────────────────────────────────────────── -->
    <c-modal [visible]="rejectModalOpen()" (visibleChange)="rejectModalOpen.set($event)">
      <c-modal-header>
        <h5 cModalTitle>Reject Usage Request</h5>
      </c-modal-header>
      <c-modal-body *ngIf="selectedReq()">
        <p class="text-body-secondary" style="font-size:.875rem">
          Rejecting the over-limit request from
          <strong>{{ selectedReq()!.techName }}</strong> for case
          <strong>{{ selectedReq()!.caseReference }}</strong>.
        </p>
        <div class="mb-3">
          <label cFormLabel>Rejection reason <span class="text-danger">*</span></label>
          <textarea cFormControl rows="3" [(ngModel)]="rejectComment"
                    placeholder="Explain why this request is rejected…"></textarea>
        </div>
      </c-modal-body>
      <c-modal-footer>
        <button cButton color="secondary" variant="outline"
                (click)="rejectModalOpen.set(false)">Cancel</button>
        <button cButton color="danger" (click)="submitReject()"
                [disabled]="saving() || !rejectComment.trim()">
          <c-spinner size="sm" *ngIf="saving()"></c-spinner>
          <span *ngIf="!saving()">Confirm Rejection</span>
        </button>
      </c-modal-footer>
    </c-modal>
  `
})
export class SttUsageApprovalsComponent implements OnInit {
  private readonly stockService = inject(StockService);

  readonly loading = signal(true);
  readonly pending = signal<StockUsagePermission[]>([]);
  readonly selectedReq = signal<StockUsagePermission | null>(null);
  readonly approveModalOpen = signal(false);
  readonly rejectModalOpen = signal(false);
  readonly saving = signal(false);

  approveDraft: ReviewPermissionRequest = {
    approvedCableMeters: 0,
    approvedItems: [],
    reviewComment: ''
  };
  rejectComment = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.stockService.getMyPendingPermissions().subscribe({
      next: (list) => {
        this.pending.set(list);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); }
    });
  }

  openApproveModal(req: StockUsagePermission): void {
    this.selectedReq.set(req);
    this.approveDraft = {
      approvedCableMeters: req.requestedCableMeters,
      approvedItems: (req.requestedItems ?? []).map(item => ({
        itemId: item.itemId,
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
}
