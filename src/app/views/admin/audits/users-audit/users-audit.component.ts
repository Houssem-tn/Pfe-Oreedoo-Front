import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { AppUser } from '../../../../core/users/user.model';
import { UserService } from '../../../../core/users/user.service';


@Component({
  standalone: true,
  selector: 'app-users-audit',
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, IconDirective],
  templateUrl: './users-audit.component.html'
})
export class UsersAuditComponent implements OnInit {
  private readonly usersSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  users: AppUser[] = [];
  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedStatus = '';

  selectedRejectedUser: AppUser | null = null;

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    
  ];

  ngOnInit(): void {
    this.loadAuditData();
  }

  loadAuditData(): void {
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
          this.syncSelectedRejectedUser();
        },
        error: (err) => {
          console.error('Error loading audit data:', err);
          this.error = err?.error?.message ?? 'Failed to load audit data';
        }
      });
  }

  get totalUsers(): number {
    return this.users.length;
  }

  get pendingUsersCount(): number {
    return this.users.filter(u => u.status === 'PENDING').length;
  }

  get approvedUsersCount(): number {
    return this.users.filter(u => u.status === 'APPROVED').length;
  }

  get rejectedUsersCount(): number {
    return this.users.filter(u => u.status === 'REJECTED').length;
  }

  get approvalRate(): number {
    if (!this.totalUsers) return 0;
    return Math.round((this.approvedUsersCount / this.totalUsers) * 100);
  }

  get rejectionRate(): number {
    if (!this.totalUsers) return 0;
    return Math.round((this.rejectedUsersCount / this.totalUsers) * 100);
  }

  get filteredAuditUsers(): AppUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((u) => {
      const matchesSearch =
        !term ||
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term);

      const matchesStatus =
        !this.selectedStatus || u.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  get recentValidationActivity(): AppUser[] {
    return this.filteredAuditUsers
      .filter(u => !!u.validatedAt && (u.status === 'APPROVED' || u.status === 'REJECTED'))
      .sort((a, b) => this.toTime(b.validatedAt) - this.toTime(a.validatedAt))
      .slice(0, 10);
  }

  get latestRejectedUsers(): AppUser[] {
    return this.filteredAuditUsers
      .filter(u => u.status === 'REJECTED')
      .sort((a, b) => this.toTime(b.validatedAt) - this.toTime(a.validatedAt))
      .slice(0, 10);
  }

  get displayedRejectedUsers(): AppUser[] {
    if (this.selectedRejectedUser) {
      return [this.selectedRejectedUser];
    }
    return this.latestRejectedUsers;
  }

  selectAuditUser(user: AppUser): void {
    if (user.status === 'REJECTED') {
      this.selectedRejectedUser = user;
      return;
    }

    this.selectedRejectedUser = null;
  }

  clearRejectedSelection(): void {
    this.selectedRejectedUser = null;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedRejectedUser = null;
  }

  formatRole(role?: string | null): string {
    return role ? role.replace('ROLE_', '').replaceAll('_', ' ') : '—';
  }

  auditActionLabel(user: AppUser): string {
    if (user.status === 'APPROVED') return 'Approved';
    if (user.status === 'REJECTED') return 'Rejected';
    return 'Pending';
  }

  actionBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-subtle text-success-emphasis';
      case 'REJECTED':
        return 'bg-danger-subtle text-danger-emphasis';
      default:
        return 'bg-warning-subtle text-warning-emphasis';
    }
  }

  isSelectedRejectedUser(user: AppUser): boolean {
    return !!this.selectedRejectedUser && this.selectedRejectedUser.id === user.id;
  }

  private syncSelectedRejectedUser(): void {
    if (!this.selectedRejectedUser) return;

    const stillVisible = this.filteredAuditUsers.find(
      u => u.id === this.selectedRejectedUser?.id && u.status === 'REJECTED'
    );

    this.selectedRejectedUser = stillVisible ?? null;
  }

  private toTime(value?: string | null): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  trackById = (_: number, u: AppUser) => u.id;

  loginBadgeClass(user: AppUser): string {
  return user.lastLoginAt
    ? 'bg-success-subtle text-success-emphasis'
    : 'bg-secondary-subtle text-secondary-emphasis';
}
}