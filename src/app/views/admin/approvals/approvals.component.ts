import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

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
        next: (rows) => {
          this.items = rows ?? [];
          this.currentPage = 1;
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Failed to load pending approvals';
        }
      });
  }

  approve(userId: string): void {
    this.actionLoadingId = userId;
    this.error = null;

    this.api.approve(userId)
      .pipe(finalize(() => {
        this.actionLoadingId = null;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: () => {
          this.items = this.items.filter((u) => u.id !== userId);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Approve failed';
        }
      });
  }

  reject(userId: string): void {
    this.actionLoadingId = userId;
    this.error = null;

    this.api.reject(userId)
      .pipe(finalize(() => {
        this.actionLoadingId = null;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: () => {
          this.items = this.items.filter((u) => u.id !== userId);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }
        },
        error: (e) => {
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
        u.fullName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term);

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

  statusBadgeClass(status?: string): string {
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

  trackById = (_: number, u: PendingApprovalUser) => u.id;
}