import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { AppUser } from '../../../core/users/user.model';
import { UserService } from '../../../core/users/user.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, IconDirective],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss'
})
export class UsersListComponent implements OnInit {
  private readonly usersSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  users: AppUser[] = [];
  loading = false;
  deletingId: string | null = null;
  assigningSttId: string | null = null;
  error: string | null = null;
  assignSuccess: string | null = null;

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

  expandedAssignRowId: string | null = null;

openAssignCard(user: any): void {
  this.expandedAssignRowId = user.id;
  this.selectedZmBySttId[user.id] = user.assignedZmId || '';
}

closeAssignCard(): void {
  this.expandedAssignRowId = null;
}

isAssignCardOpen(userId: string): boolean {
  return this.expandedAssignRowId === userId;
}

saveAssignFromCard(user: any): void {
  this.assignZm(user);
}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = null;
    this.assignSuccess = null;

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

  remove(id: string): void {
    if (!confirm('Delete this user?')) return;

    this.deletingId = id;
    this.error = null;
    this.assignSuccess = null;

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
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          this.error = err?.error?.message ?? 'Failed to delete user';
        }
      });
  }

  assignZm(stt: AppUser): void {
    const zmId = this.selectedZmBySttId[stt.id];

    if (!zmId) {
      this.error = 'Please select a ZM before saving.';
      this.assignSuccess = null;
      return;
    }

    this.assigningSttId = stt.id;
    this.error = null;
    this.assignSuccess = null;

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
          this.assignSuccess = `ZM assigned successfully to ${updated.fullName}.`;
          this.expandedAssignRowId = null;
        },
        error: (err) => {
          console.error('Error assigning ZM:', err);
          this.error = err?.error?.message ?? 'Failed to assign ZM';
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

hasAssignedZm(u: AppUser): boolean {
  return !!u.assignedZmId;
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