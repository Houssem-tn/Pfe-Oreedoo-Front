import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';

import {
  CardBodyComponent,
  CardComponent,
  ColComponent,
  RowComponent,
  TableDirective,
  ButtonDirective,
  SpinnerComponent
} from '@coreui/angular';

import { ApprovalsService, PendingApprovalUser } from './approvals.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    SpinnerComponent
  ],
  templateUrl: './approvals.component.html'
})
export class ApprovalsComponent implements OnInit {
  private readonly api = inject(ApprovalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  items: PendingApprovalUser[] = [];
  loading = false;
  actionLoadingId: string | null = null;
  error: string | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    // prevent double refresh calls
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.api.listPending()
      .pipe(
        finalize(() => {
          this.loading = false;

          // ✅ force UI update (fix spinner stays until reclick)
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (rows) => {
          this.items = rows ?? [];
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Failed to load pending approvals';
        }
      });
  }

  approve(userId: string): void {
    this.actionLoadingId = userId;

    this.api.approve(userId)
      .pipe(finalize(() => {
        this.actionLoadingId = null;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: () => {
          this.items = this.items.filter((u) => u.id !== userId);
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Approve failed';
        }
      });
  }

  reject(userId: string): void {
    this.actionLoadingId = userId;

    this.api.reject(userId)
      .pipe(finalize(() => {
        this.actionLoadingId = null;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: () => {
          this.items = this.items.filter((u) => u.id !== userId);
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Reject failed';
        }
      });
  }

  isActionLoading(id: string): boolean {
    return this.actionLoadingId === id;
  }

  trackById = (_: number, u: PendingApprovalUser) => u.id;
}