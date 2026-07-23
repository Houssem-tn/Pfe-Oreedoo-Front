import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { SwalService } from '../../../core/ui/swal.service';
import { ApprovalsService, PendingApprovalUser } from './approvals.service';

interface ApprovalSummaryCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: 'primary' | 'accent' | 'success' | 'warning';
}

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconDirective
  ],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss'
})
export class ApprovalsComponent implements OnInit {
  private readonly api = inject(ApprovalsService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  items: PendingApprovalUser[] = [];
  loading = false;
  actionLoadingId: string | null = null;
  error: string | null = null;

  searchTerm = '';
  selectedRole = '';
  selectedApprovalId: string | null = null;

  currentPage = 1;
  pageSize = 5;

  readonly pageSizeOptions = [5, 10, 20];
  readonly roleOptions = [
    { value: '', label: 'All roles' },
    { value: 'ROLE_STT', label: 'STT' },
    { value: 'ROLE_TECH', label: 'TECH' },
   
    { value: 'ROLE_ZM', label: 'ZM' }
  ];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.loading) {
      return;
    }

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
          this.syncSelectedApproval();
        },
        error: (e: any) => {
          this.error = e?.error?.message ?? 'Failed to load pending approvals';
        }
      });
  }

  async approve(userId: string): Promise<void> {
    const user = this.items.find((candidate) => candidate.id === userId);
    const approvedUserName = user?.fullName ?? 'User';

    const confirm = await this.swal.confirmAction(
      'Approve account?',
      `This will approve ${approvedUserName}.`,
      'Approve'
    );

    if (!confirm.isConfirmed) {
      return;
    }

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
          this.items = this.items.filter((candidate) => candidate.id !== userId);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }

          if (this.selectedApprovalId === userId) {
            this.selectedApprovalId = null;
          }

          void this.swal.success('Account approved', `${approvedUserName} has been approved successfully.`);
        },
        error: (e: any) => {
          const message = e?.error?.message ?? 'Approve failed';
          this.error = message;
          void this.swal.error('Approval failed', message);
        }
      });
  }

  async reject(user: PendingApprovalUser): Promise<void> {
    const result = await this.swal.promptTextarea(
      'Reject account',
      `Provide a rejection reason for ${user.fullName}`,
      'Rejection reason',
      'Reject'
    );

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
          this.items = this.items.filter((candidate) => candidate.id !== user.id);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }

          if (this.selectedApprovalId === user.id) {
            this.selectedApprovalId = null;
          }

          void this.swal.success('Account rejected', `${user.fullName} has been rejected successfully.`);
        },
        error: (e: any) => {
          const message = e?.error?.message ?? 'Reject failed';
          this.error = message;
          void this.swal.error('Rejection failed', message);
        }
      });
  }

  get filteredItems(): PendingApprovalUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.items.filter((user) => {
      const effectiveRole = this.effectiveRole(user);

      const matchesSearch =
        !term ||
        (user.fullName ?? '').toLowerCase().includes(term) ||
        (user.email ?? '').toLowerCase().includes(term) ||
        (user.username ?? '').toLowerCase().includes(term) ||
        (user.phone ?? '').toLowerCase().includes(term);

      const matchesRole = !this.selectedRole || effectiveRole === this.selectedRole;

      return matchesSearch && matchesRole;
    });
  }

  get summaryCards(): ApprovalSummaryCard[] {
    return [
      {
        label: 'Pending queue',
        helper: 'Accounts waiting for admin validation',
        value: String(this.items.length),
        icon: 'cilClock',
        tone: 'primary'
      },
      {
        label: 'Visible now',
        helper: 'Accounts matching the active filters',
        value: String(this.filteredItems.length),
        icon: 'cilFilter',
        tone: 'accent'
      },
      {
        label: 'TECH requests',
        helper: 'Field users waiting for access',
        value: String(this.countByRole('ROLE_TECH')),
        icon: 'cilTask',
        tone: 'success'
      },
      {
        label: 'STT + ZM',
        helper: 'Operational partner and zone requests',
        value: String(this.countByRole('ROLE_STT') + this.countByRole('ROLE_ZM')),
        icon: 'cilPeople',
        tone: 'warning'
      }
    ];
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
  }

  get paginatedItems(): PendingApprovalUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  get selectedApproval(): PendingApprovalUser | null {
    if (!this.selectedApprovalId) {
      return null;
    }

    return this.items.find((user) => user.id === this.selectedApprovalId) ?? null;
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedRole = '';
    this.currentPage = 1;
  }

  setRoleFilter(role: string): void {
    this.selectedRole = role;
    this.currentPage = 1;
  }

  openDetails(user: PendingApprovalUser): void {
    this.selectedApprovalId = user.id;
  }

  closeDetails(): void {
    this.selectedApprovalId = null;
  }

  isActionLoading(id: string): boolean {
    return this.actionLoadingId === id;
  }

  formatRole(role?: string | null): string {
    switch (role) {
      case 'ROLE_STT':
        return 'STT';
      case 'ROLE_TECH':
        return 'TECH';
      case 'ROLE_CRM_BOUTIQUE':
        return 'CRM Boutique';
      case 'ROLE_ZM':
        return 'ZM';
      case 'ROLE_ADMIN':
        return 'Admin';
      default:
        return 'Not set';
    }
  }

  effectiveRole(user: PendingApprovalUser): string {
    return user.roleRequested || user.role || '';
  }

  roleIcon(role?: string | null): string {
    switch (role) {
      case 'ROLE_TECH':
        return 'cilTask';
      case 'ROLE_STT':
        return 'cilPeople';
      case 'ROLE_ZM':
        return 'cilLocationPin';
      case 'ROLE_CRM_BOUTIQUE':
        return 'cilPhone';
      case 'ROLE_ADMIN':
        return 'cilSettings';
      default:
        return 'cilUser';
    }
  }

  roleBadgeClass(role?: string | null): string {
    switch (role) {
      case 'ROLE_TECH':
        return 'approval-pill approval-pill--tech';
      case 'ROLE_STT':
        return 'approval-pill approval-pill--stt';
      case 'ROLE_ZM':
        return 'approval-pill approval-pill--zm';
      case 'ROLE_CRM_BOUTIQUE':
        return 'approval-pill approval-pill--crm';
      case 'ROLE_ADMIN':
        return 'approval-pill approval-pill--admin';
      default:
        return 'approval-pill approval-pill--neutral';
    }
  }

  statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'approval-pill approval-pill--approved';
      case 'REJECTED':
        return 'approval-pill approval-pill--rejected';
      case 'PENDING':
      default:
        return 'approval-pill approval-pill--pending';
    }
  }

  statusLabel(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
      case 'PENDING':
      default:
        return 'Pending review';
    }
  }

  statusIcon(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'cilCheckCircle';
      case 'REJECTED':
        return 'cilXCircle';
      case 'PENDING':
      default:
        return 'cilClock';
    }
  }

  initialsFor(user: PendingApprovalUser): string {
    const source = (user.fullName ?? user.username ?? user.email ?? '').trim();

    if (!source) {
      return 'NA';
    }

    const tokens = source.split(/\s+/).filter(Boolean);

    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase();
    }

    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
  }

  countByRole(role: string): number {
    return this.items.filter((user) => this.effectiveRole(user) === role).length;
  }

  approvalStageLabel(user: PendingApprovalUser): string {
    if (user.status === 'REJECTED') {
      return 'Rejected request';
    }

    if (user.status === 'APPROVED') {
      return 'Approved account';
    }

    return 'Awaiting admin decision';
  }

  rangeLabel(): string {
    if (this.filteredItems.length === 0) {
      return '0 of 0';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredItems.length);
    return `${start}-${end} of ${this.filteredItems.length}`;
  }

  trackById(_index: number, user: PendingApprovalUser): string {
    return user.id;
  }

  private syncSelectedApproval(): void {
    if (!this.selectedApprovalId) {
      return;
    }

    const stillExists = this.items.some((user) => user.id === this.selectedApprovalId);
    if (!stillExists) {
      this.selectedApprovalId = null;
    }
  }
}
