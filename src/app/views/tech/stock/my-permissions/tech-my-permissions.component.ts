import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { IconDirective } from '@coreui/icons-angular';
import {
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ContainerComponent,
  SpinnerComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { PermissionItemDetail, StockUsagePermission, PermissionStatus } from '../../../../core/stock/stock.model';
import { formatMaterialQuantity } from '../../../../core/stock/material-quantity.util';

@Component({
  selector: 'app-tech-my-permissions',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    IconDirective,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    BadgeComponent,
    ButtonDirective,
    SpinnerComponent
  ],
  template: `
    <c-container fluid class="py-3">

      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 class="mb-0">My Stock Permission Requests</h4>
          <p class="text-body-secondary mb-0" style="font-size:.875rem">
            Over-limit usage requests you have submitted to your STT supervisor.
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
      <div *ngIf="!loading() && requests().length === 0"
           class="text-center py-5 text-body-secondary">
        <svg cIcon name="cilCheckCircle" style="width:2.5rem;height:2.5rem;opacity:.4"></svg>
        <p class="mt-2">No permission requests submitted yet.</p>
      </div>

      <!-- Cards -->
      <div class="d-flex flex-column gap-3" *ngIf="!loading() && requests().length > 0">
        <c-card *ngFor="let req of requests()">
          <c-card-body>
            <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <svg cIcon name="cilStorage" style="width:16px;height:16px"></svg>
                  <span class="fw-bold">Case {{ req.caseReference }}</span>
                  <c-badge [color]="statusColor(req.status)">{{ statusLabel(req.status) }}</c-badge>
                </div>

                <div *ngIf="req.requestedCableMeters > 0 && !req.requestedItems?.length" style="font-size:.875rem" class="mb-1">
                  <strong>Cable:</strong> {{ req.requestedCableMeters }}m requested
                  <span *ngIf="req.approvedCableMeters > 0"> — {{ req.approvedCableMeters }}m approved</span>
                </div>

                <div *ngIf="requestedPermissionSummary(req)" style="font-size:.875rem" class="mb-1">
                  <strong>Requested:</strong> {{ requestedPermissionSummary(req) }}
                </div>

                <div *ngIf="approvedPermissionSummary(req)" style="font-size:.875rem" class="mb-1">
                  <strong>Approved:</strong> {{ approvedPermissionSummary(req) }}
                </div>

                <div *ngIf="req.reason" class="text-body-secondary mt-1" style="font-size:.82rem">
                  <em>Reason: {{ req.reason }}</em>
                </div>

                <div *ngIf="req.reviewComment" class="mt-1" style="font-size:.82rem"
                     [class.text-success]="req.status === 'APPROVED' || req.status === 'PARTIALLY_APPROVED'"
                     [class.text-danger]="req.status === 'REJECTED'">
                  STT note: {{ req.reviewComment }}
                </div>

                <div class="mt-1 text-body-secondary" style="font-size:.78rem">
                  Submitted: {{ req.createdAt | date:'dd MMM yyyy, HH:mm' }}
                  <span *ngIf="req.reviewedAt"> · Reviewed: {{ req.reviewedAt | date:'dd MMM yyyy, HH:mm' }}</span>
                </div>
              </div>
            </div>
          </c-card-body>
        </c-card>
      </div>

    </c-container>
  `
})
export class TechMyPermissionsComponent implements OnInit {
  private readonly stockService = inject(StockService);

  readonly loading = signal(true);
  readonly requests = signal<StockUsagePermission[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.stockService.getMyPermissionRequests().subscribe({
      next: (list) => {
        this.requests.set([...list].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); }
    });
  }

  statusLabel(status: PermissionStatus): string {
    switch (status) {
      case 'PENDING': return 'Pending';
      case 'APPROVED': return 'Approved';
      case 'PARTIALLY_APPROVED': return 'Partially Approved';
      case 'REJECTED': return 'Rejected';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  statusColor(status: PermissionStatus): string {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'PARTIALLY_APPROVED': return 'info';
      case 'REJECTED': return 'danger';
      default: return 'secondary';
    }
  }

  requestedPermissionSummary(req: StockUsagePermission): string {
    return this.permissionSummary(req.requestedItems, 'requestedQuantity', req.requestedCableMeters);
  }

  approvedPermissionSummary(req: StockUsagePermission): string {
    return this.permissionSummary(req.approvedItems, 'approvedQuantity', req.approvedCableMeters);
  }

  private permissionSummary(
    items: PermissionItemDetail[] | undefined,
    quantityKey: 'requestedQuantity' | 'approvedQuantity',
    legacyCableMeters: number
  ): string {
    const parts = (items ?? [])
      .map(item => ({
        name: item.itemName,
        quantity: Number(item[quantityKey] ?? 0),
        unit: item.unit
      }))
      .filter(item => Number.isFinite(item.quantity) && item.quantity > 0)
      .map(item => `${formatMaterialQuantity(item.quantity, item.unit)} ${item.name}`);

    if (!parts.length && legacyCableMeters > 0) {
      parts.push(`${formatMaterialQuantity(legacyCableMeters, 'METERS')} cable`);
    }

    return parts.join(', ');
  }
}
