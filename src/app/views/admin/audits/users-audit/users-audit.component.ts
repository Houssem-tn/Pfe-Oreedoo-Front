import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { AppUser } from '../../../../core/users/user.model';
import { UserService } from '../../../../core/users/user.service';

interface UsersAuditSummaryCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: 'primary' | 'warning' | 'success' | 'danger';
}

@Component({
  standalone: true,
  selector: 'app-users-audit',
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, IconDirective],
  templateUrl: './users-audit.component.html',
  styleUrl: './users-audit.component.scss'
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
    { value: 'REJECTED', label: 'Rejected' }
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
    return this.users.filter((user) => user.status === 'PENDING').length;
  }

  get approvedUsersCount(): number {
    return this.users.filter((user) => user.status === 'APPROVED').length;
  }

  get rejectedUsersCount(): number {
    return this.users.filter((user) => user.status === 'REJECTED').length;
  }

  get approvalRate(): number {
    if (!this.totalUsers) return 0;
    return Math.round((this.approvedUsersCount / this.totalUsers) * 100);
  }

  get rejectionRate(): number {
    if (!this.totalUsers) return 0;
    return Math.round((this.rejectedUsersCount / this.totalUsers) * 100);
  }

  get summaryCards(): UsersAuditSummaryCard[] {
    return [
      {
        label: 'Registered users',
        helper: 'Complete onboarding population',
        value: String(this.totalUsers),
        icon: 'cilPeople',
        tone: 'primary'
      },
      {
        label: 'Awaiting review',
        helper: 'Registrations still pending validation',
        value: String(this.pendingUsersCount),
        icon: 'cilClock',
        tone: 'warning'
      },
      {
        label: 'Approved access',
        helper: `Approval rate ${this.approvalRate}%`,
        value: String(this.approvedUsersCount),
        icon: 'cilCheckCircle',
        tone: 'success'
      },
      {
        label: 'Rejected cases',
        helper: `Rejection rate ${this.rejectionRate}%`,
        value: String(this.rejectedUsersCount),
        icon: 'cilXCircle',
        tone: 'danger'
      }
    ];
  }

  get filteredAuditUsers(): AppUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesSearch =
        !term ||
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term);

      const matchesStatus =
        !this.selectedStatus || user.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  get recentValidationActivity(): AppUser[] {
    return this.filteredAuditUsers
      .filter((user) => !!user.validatedAt && (user.status === 'APPROVED' || user.status === 'REJECTED'))
      .sort((a, b) => this.toTime(b.validatedAt) - this.toTime(a.validatedAt))
      .slice(0, 10);
  }

  get latestRejectedUsers(): AppUser[] {
    return this.filteredAuditUsers
      .filter((user) => user.status === 'REJECTED')
      .sort((a, b) => this.toTime(b.validatedAt) - this.toTime(a.validatedAt))
      .slice(0, 10);
  }

  get displayedRejectedUsers(): AppUser[] {
    if (this.selectedRejectedUser) {
      return [this.selectedRejectedUser];
    }

    return this.latestRejectedUsers;
  }

  get hasFilters(): boolean {
    return !!this.searchTerm.trim() || !!this.selectedStatus;
  }

  get selectedStatusLabel(): string {
    return this.statusOptions.find((status) => status.value === this.selectedStatus)?.label ?? 'All statuses';
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

  userInitials(user: AppUser): string {
    return (user.fullName ?? '')
      .split(' ')
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'NA';
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
      (user) => user.id === this.selectedRejectedUser?.id && user.status === 'REJECTED'
    );

    this.selectedRejectedUser = stillVisible ?? null;
  }

  private toTime(value?: string | null): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  trackById = (_: number, user: AppUser) => user.id;

  loginBadgeClass(user: AppUser): string {
    return user.lastLoginAt
      ? 'bg-success-subtle text-success-emphasis'
      : 'bg-secondary-subtle text-secondary-emphasis';
  }
}
