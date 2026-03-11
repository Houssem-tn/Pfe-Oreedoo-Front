import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import Swal from 'sweetalert2';

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
    FormsModule,
    IconDirective,
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

  searchTerm = '';
  selectedRole = '';

  currentPage = 1;
  pageSize = 5;

  readonly roleOptions = [
    { value: '', label: 'All roles' },
    { value: 'ROLE_STT', label: 'STT' },
    { value: 'ROLE_TECH', label: 'Technicien STT' },
    { value: 'ROLE_CRM_BOUTIQUE', label: 'CRM Boutique' },
    { value: 'ROLE_ZM', label: 'ZM' }
  ];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.api.listPending()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (rows: PendingApprovalUser[]) => {
          this.items = rows ?? [];
          this.currentPage = 1;
        },
        error: (e: any) => {
          this.error = e?.error?.message ?? 'Failed to load pending approvals';
        }
      });
  }

  approve(userId: string): void {
    const user = this.items.find((u) => u.id === userId);
    const approvedUserName = user?.fullName ?? 'User';

    this.actionLoadingId = userId;
    this.error = null;

    this.api.approve(userId)
      .pipe(
        finalize(() => {
          this.actionLoadingId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: () => {
          this.items = this.items.filter((u) => u.id !== userId);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }

          Swal.fire({
            icon: 'success',
            title: 'Account approved',
            text: `${approvedUserName} has been approved successfully.`,
            confirmButtonText: 'OK',
            timer: 2200,
            timerProgressBar: true
          });
        },
        error: (e: any) => {
          this.error = e?.error?.message ?? 'Approve failed';
        }
      });
  }

  async reject(user: PendingApprovalUser): Promise<void> {
    const result = await Swal.fire<string>({
      title: 'Reject account',
      text: `Provide a rejection reason for ${user.fullName}`,
      input: 'textarea',
      inputLabel: 'Rejection reason',
      inputPlaceholder: 'Enter the rejection reason...',
      inputAttributes: {
        'aria-label': 'Rejection reason'
      },
      showCancelButton: true,
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d9534f',
      inputValidator: (value: string) => {
        const trimmed = value?.trim() ?? '';

        if (!trimmed) {
          return 'Rejection reason is required';
        }

        if (trimmed.length > 500) {
          return 'Rejection reason must be at most 500 characters';
        }

        return undefined;
      }
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    const reason = result.value.trim();

    this.actionLoadingId = user.id;
    this.error = null;

    this.api.reject(user.id, reason)
      .pipe(
        finalize(() => {
          this.actionLoadingId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: () => {
          this.items = this.items.filter((u) => u.id !== user.id);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }

          Swal.fire({
            icon: 'error',
            title: 'Account rejected',
            text: `${user.fullName} has been rejected successfully.`,
            confirmButtonText: 'OK',
            timer: 2400,
            timerProgressBar: true
          });
        },
        error: (e: any) => {
          this.error = e?.error?.message ?? 'Reject failed';
        }
      });
  }

  get filteredItems(): PendingApprovalUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.items.filter((u) => {
      const effectiveRole = u.roleRequested || u.role || '';

      const matchesSearch =
        !term ||
        (u.fullName ?? '').toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term) ||
        (u.username ?? '').toLowerCase().includes(term);

      const matchesRole =
        !this.selectedRole || effectiveRole === this.selectedRole;

      return matchesSearch && matchesRole;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
  }

  get paginatedItems(): PendingApprovalUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedRole = '';
    this.currentPage = 1;
  }

  isActionLoading(id: string): boolean {
    return this.actionLoadingId === id;
  }

  formatRole(role?: string | null): string {
    return role ? role.replace('ROLE_', '').replaceAll('_', ' ') : '—';
  }

  statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-subtle text-success-emphasis';
      case 'REJECTED':
        return 'bg-danger-subtle text-danger-emphasis';
      case 'PENDING':
      default:
        return 'bg-warning-subtle text-warning-emphasis';
    }
  }

  trackById(_index: number, user: PendingApprovalUser): string {
    return user.id;
  }
}