import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { AppUser } from '../../../core/users/user.model';
import { UserService } from '../../../core/users/user.service';
import { SwalService } from '../../../core/ui/swal.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, IconDirective],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss'
})
export class UsersListComponent implements OnInit {
  private readonly usersSvc = inject(UserService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  users: AppUser[] = [];
  loading = false;
  deletingId: string | null = null;
  assigningSttId: string | null = null;
  error: string | null = null;

  // filters
  searchTerm = '';
  selectedRole = '';
  selectedStatus = '';

  // pagination
  currentPage = 1;
  pageSize = 5;

  // assign ZM state
  selectedZmBySttId: Record<string, string> = {};

  readonly roleOptions = [
    { value: '', label: 'All roles' },
    { value: 'ROLE_ADMIN', label: 'Admin' },
    { value: 'ROLE_STT', label: 'STT' },
    { value: 'ROLE_TECH', label: 'Technician STT' },
    { value: 'ROLE_CRM_BOUTIQUE', label: 'CRM Boutique' },
    { value: 'ROLE_ZM', label: 'ZM' }
  ];

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.usersSvc.getAll()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (data) => {
          this.users = data ?? [];
          this.currentPage = 1;
          this.initializeZmSelections();
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.error = err?.error?.message ?? 'Failed to load users';
        }
      });
  }

  async remove(id: string): Promise<void> {
    const confirm = await this.swal.confirmDelete('user');
    if (!confirm.isConfirmed) {
      return;
    }

    this.deletingId = id;
    this.error = null;

    this.usersSvc.delete(id)
      .pipe(
        finalize(() => {
          this.deletingId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: () => {
          this.users = this.users.filter(u => u.id !== id);

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
          }

          void this.swal.success('User deleted', 'The user has been deleted successfully.');
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          const message = err?.error?.message ?? 'Failed to delete user';
          this.error = message;
          void this.swal.error('Delete failed', message);
        }
      });
  }

  async openAssignZmModal(stt: AppUser): Promise<void> {
    const options = this.approvedZmUsers.reduce<Record<string, string>>((acc, zm) => {
      acc[zm.id] = zm.fullName;
      return acc;
    }, {});

    if (Object.keys(options).length === 0) {
      void this.swal.error('No ZM available', 'There are no approved ZM users available for assignment.');
      return;
    }

    const result = await this.swal.promptSelect(
      `Assign ZM to ${stt.fullName}`,
      'Select ZM',
      options,
      stt.assignedZmId ?? '',
      stt.assignedZmId ? 'Change' : 'Assign'
    );

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.assignZm(stt, result.value);
  }

  private assignZm(stt: AppUser, zmId: string): void {
    this.selectedZmBySttId[stt.id] = zmId;

    this.error = null;

    this.assigningSttId = stt.id;

    this.usersSvc.assignSttToZm({
      sttId: stt.id,
      zmId
    })
      .pipe(
        finalize(() => {
          this.assigningSttId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (updated) => {
          this.users = this.users.map(u => u.id === updated.id ? updated : u);
          this.selectedZmBySttId[updated.id] = updated.assignedZmId ?? '';
          void this.swal.success('Assignment saved', `ZM assigned successfully to ${updated.fullName}.`);
        },
        error: (err) => {
          console.error('Error assigning ZM:', err);
          const message = err?.error?.message ?? 'Failed to assign ZM';
          this.error = message;
          void this.swal.error('Assignment failed', message);
        }
      });
  }

  initializeZmSelections(): void {
    for (const u of this.users) {
      if (u.id) {
        this.selectedZmBySttId[u.id] = u.assignedZmId ?? '';
      }
    }
  }

  get approvedZmUsers(): AppUser[] {
    return this.users
      .filter(u => u.role === 'ROLE_ZM' && u.status === 'APPROVED' && u.enabled)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

 canAssignZm(u: AppUser): boolean {
  return u.role === 'ROLE_STT' && u.status === 'APPROVED' && !!u.enabled;
}

  isAssigning(sttId: string): boolean {
    return this.assigningSttId === sttId;
  }

  isDeleting(id: string): boolean {
    return this.deletingId === id;
  }

  formatRole(role?: string | null): string {
    return role ? role.replace('ROLE_', '').replaceAll('_', ' ') : '—';
  }

  getFilteredAssignedZmName(u: AppUser): string {
    if (!u.assignedZmId) return '—';
    const zm = this.users.find(user => user.id === u.assignedZmId);
    return zm?.fullName || u.assignedZmEmail || 'Assigned';
  }

  get filteredUsers(): AppUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((u) => {
      const effectiveRole = u.role || u.roleRequested || '';

      const matchesSearch =
        !term ||
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term);

      const matchesRole =
        !this.selectedRole || effectiveRole === this.selectedRole;

      const matchesStatus =
        !this.selectedStatus || u.status === this.selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get paginatedUsers(): AppUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
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
    this.selectedStatus = '';
    this.currentPage = 1;
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

  enabledBadgeClass(enabled?: boolean | null): string {
    return enabled
      ? 'bg-success-subtle text-success-emphasis'
      : 'bg-secondary-subtle text-secondary-emphasis';
  }

  trackById = (_: number, u: AppUser) => u.id;
}