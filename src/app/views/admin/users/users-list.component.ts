import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { AppUser } from '../../../core/users/user.model';
import { UserService } from '../../../core/users/user.service';
import { SwalService } from '../../../core/ui/swal.service';

interface UserSummaryCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: 'primary' | 'accent' | 'success' | 'warning';
}

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
  togglingUserId: string | null = null;
  error: string | null = null;

  searchTerm = '';
  selectedRole = '';
  selectedStatus = '';

  currentPage = 1;
  pageSize = 5;

  selectedZmBySttId: Record<string, string> = {};

  readonly pageSizeOptions = [5, 10, 20];
  readonly roleOptions = [
    { value: '', label: 'All roles' },
    { value: 'ROLE_ADMIN', label: 'Admin' },
    { value: 'ROLE_STT', label: 'STT' },
    { value: 'ROLE_TECH', label: 'TECH' },
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
    if (this.loading) {
      return;
    }

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
          this.users = this.users.filter((user) => user.id !== id);

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

  async toggleBan(user: AppUser): Promise<void> {
    if (!this.canManageBan(user)) {
      return;
    }

    const willEnable = !user.enabled;
    const actionLabel = willEnable ? 'Unban' : 'Ban';
    const confirm = await this.swal.confirmAction(
      `${actionLabel} ${user.fullName}?`,
      willEnable
        ? 'This will restore access to the platform for this user.'
        : 'This will immediately block this user from accessing the platform.',
      actionLabel
    );

    if (!confirm.isConfirmed) {
      return;
    }

    this.togglingUserId = user.id;
    this.error = null;

    this.usersSvc.update(user.id, { enabled: willEnable })
      .pipe(
        finalize(() => {
          this.togglingUserId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (updated) => {
          this.mergeUser(updated);
          void this.swal.success(
            willEnable ? 'User unbanned' : 'User banned',
            willEnable
              ? `${updated.fullName} can access the platform again.`
              : `${updated.fullName} is now blocked from accessing the platform.`
          );
        },
        error: (err) => {
          console.error('Error updating user access:', err);
          const message = err?.error?.message ?? 'Failed to update user access';
          this.error = message;
          void this.swal.error('Access update failed', message);
        }
      });
  }

  setRoleFilter(role: string): void {
    this.selectedRole = role;
    this.currentPage = 1;
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
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
          this.mergeUser(updated);
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
    for (const user of this.users) {
      if (user.id) {
        this.selectedZmBySttId[user.id] = user.assignedZmId ?? '';
      }
    }
  }

  get approvedZmUsers(): AppUser[] {
    return this.users
      .filter((user) => user.role === 'ROLE_ZM' && user.status === 'APPROVED' && user.enabled)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  get summaryCards(): UserSummaryCard[] {
    const approvedStt = this.users.filter((user) => user.role === 'ROLE_STT' && user.status === 'APPROVED' && user.enabled);
    const assignedSttCount = approvedStt.filter((user) => !!user.assignedZmId).length;

    return [
      {
        label: 'Total users',
        helper: 'All accounts currently available in the system',
        value: String(this.users.length),
        icon: 'cilPeople',
        tone: 'primary'
      },
      {
        label: 'Approved access',
        helper: 'Active accounts cleared for operations',
        value: String(this.countByStatus('APPROVED')),
        icon: 'cilCheckCircle',
        tone: 'success'
      },
      {
        label: 'Pending review',
        helper: 'Accounts still waiting for activation',
        value: String(this.countByStatus('PENDING')),
        icon: 'cilClock',
        tone: 'warning'
      },
      {
        label: 'STT mapped to ZM',
        helper: 'Assigned STT supervision coverage',
        value: `${assignedSttCount}/${approvedStt.length || 0}`,
        icon: 'cilLayers',
        tone: 'accent'
      }
    ];
  }

  canAssignZm(user: AppUser): boolean {
    return user.role === 'ROLE_STT' && user.status === 'APPROVED' && !!user.enabled;
  }

  canManageBan(user: AppUser): boolean {
    return user.status === 'APPROVED';
  }

  isAssigning(sttId: string): boolean {
    return this.assigningSttId === sttId;
  }

  isDeleting(id: string): boolean {
    return this.deletingId === id;
  }

  isTogglingAccess(id: string): boolean {
    return this.togglingUserId === id;
  }

  effectiveRole(user: AppUser): string {
    return user.role || user.roleRequested || '';
  }

  formatRole(role?: string | null): string {
    switch (role) {
      case 'ROLE_ADMIN':
        return 'Admin';
      case 'ROLE_STT':
        return 'STT';
      case 'ROLE_TECH':
        return 'TECH';
      case 'ROLE_CRM_BOUTIQUE':
        return 'CRM Boutique';
      case 'ROLE_ZM':
        return 'ZM';
      default:
        return 'Not set';
    }
  }

  formatStatus(status?: string | null): string {
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

  roleIcon(role?: string | null): string {
    switch (role) {
      case 'ROLE_ADMIN':
        return 'cilSettings';
      case 'ROLE_STT':
        return 'cilPeople';
      case 'ROLE_TECH':
        return 'cilTask';
      case 'ROLE_CRM_BOUTIQUE':
        return 'cilPhone';
      case 'ROLE_ZM':
        return 'cilLocationPin';
      default:
        return 'cilUser';
    }
  }

  roleBadgeClass(role?: string | null): string {
    switch (role) {
      case 'ROLE_ADMIN':
        return 'user-pill user-pill--admin';
      case 'ROLE_STT':
        return 'user-pill user-pill--stt';
      case 'ROLE_TECH':
        return 'user-pill user-pill--tech';
      case 'ROLE_CRM_BOUTIQUE':
        return 'user-pill user-pill--crm';
      case 'ROLE_ZM':
        return 'user-pill user-pill--zm';
      default:
        return 'user-pill user-pill--neutral';
    }
  }

  statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'user-pill user-pill--approved';
      case 'REJECTED':
        return 'user-pill user-pill--rejected';
      case 'PENDING':
      default:
        return 'user-pill user-pill--pending';
    }
  }

  accessBadgeClass(user: AppUser): string {
    if (user.status === 'APPROVED' && !user.enabled) {
      return 'user-pill user-pill--rejected';
    }

    return user.enabled
      ? 'user-pill user-pill--enabled'
      : 'user-pill user-pill--disabled';
  }

  accessLabel(user: AppUser): string {
    if (user.status === 'APPROVED' && !user.enabled) {
      return 'Banned';
    }

    return user.enabled ? 'Enabled' : 'Disabled';
  }

  toggleAccessLabel(user: AppUser): string {
    return user.enabled ? 'Ban user' : 'Unban user';
  }

  toggleAccessIcon(user: AppUser): string {
    return user.enabled ? 'cilBan' : 'cilCheckCircle';
  }

  initialsFor(user: AppUser): string {
    const source = (user.fullName ?? user.email ?? '').trim();

    if (!source) {
      return 'NA';
    }

    const tokens = source.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase();
    }

    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
  }

  assignmentLabel(user: AppUser): string {
    if (user.role !== 'ROLE_STT') {
      return 'Not applicable';
    }

    if (!user.assignedZmId) {
      return 'Not assigned';
    }

    return this.getFilteredAssignedZmName(user);
  }

  getFilteredAssignedZmName(user: AppUser): string {
    if (!user.assignedZmId) {
      return 'Not assigned';
    }

    const zm = this.users.find((candidate) => candidate.id === user.assignedZmId);
    return zm?.fullName || user.assignedZmEmail || 'Assigned';
  }

  countByStatus(status: string): number {
    return this.users.filter((user) => user.status === status).length;
  }

  get filteredUsers(): AppUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const effectiveRole = this.effectiveRole(user);

      const matchesSearch =
        !term ||
        (user.fullName ?? '').toLowerCase().includes(term) ||
        (user.email ?? '').toLowerCase().includes(term) ||
        (user.phone ?? '').toLowerCase().includes(term);

      const matchesRole = !this.selectedRole || effectiveRole === this.selectedRole;
      const matchesStatus = !this.selectedStatus || user.status === this.selectedStatus;

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
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  rangeLabel(): string {
    if (this.filteredUsers.length === 0) {
      return '0 of 0';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
    return `${start}-${end} of ${this.filteredUsers.length}`;
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
    this.selectedStatus = '';
    this.currentPage = 1;
  }

  trackById = (_index: number, user: AppUser) => user.id;

  private mergeUser(updated: AppUser): void {
    this.users = this.users.map((user) => user.id === updated.id ? updated : user);

    this.selectedZmBySttId[updated.id] = updated.assignedZmId ?? '';
  }
}
