import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import Swal from 'sweetalert2';

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

const TUNISIA_GOVERNORATES = [
  'Tunis',
  'Ariana',
  'Ben Arous',
  'Mannouba',
  'Nabeul',
  'Zaghouan',
  'Bizerte',
  'B\u00E9ja',
  'Jendouba',
  'Le Kef',
  'Siliana',
  'Sousse',
  'Monastir',
  'Mahdia',
  'Sfax',
  'Kairouan',
  'Kasserine',
  'Sidi Bouzid',
  'Gab\u00E8s',
  'M\u00E9denine',
  'Tataouine',
  'Gafsa',
  'Tozeur',
  'K\u00E9bili'
] as const;

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
  assigningGovernoratesZmId: string | null = null;
  assigningCoverageSttId: string | null = null;
  togglingUserId: string | null = null;
  error: string | null = null;

  searchTerm = '';
  selectedRole = '';
  selectedStatus = '';

  currentPage = 1;
  pageSize = 5;

  readonly pageSizeOptions = [5, 10, 20];
  readonly governorateOptions = [...TUNISIA_GOVERNORATES];
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

  async openAssignGovernoratesModal(zm: AppUser): Promise<void> {
    const result = await this.openGovernoratePicker(
      `Assign Governorates to ${zm.fullName}`,
      'Saving replaces the current territorial coverage for this ZM.',
      this.governoratesFor(zm),
      'Save governorates'
    );

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.assignGovernorates(zm, result.value);
  }

  async openSetCoverageAreasModal(stt: AppUser): Promise<void> {
    const result = await this.openGovernoratePicker(
      `Set Coverage Areas for ${stt.fullName}`,
      'Saving replaces the current governorates this STT can support across zones.',
      this.coverageAreasFor(stt),
      'Save coverage areas'
    );

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.assignCoverageAreas(stt, result.value);
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

  private assignGovernorates(zm: AppUser, assignedGovernorates: string[]): void {
    this.error = null;
    this.assigningGovernoratesZmId = zm.id;

    this.usersSvc.assignGovernoratesToZm({
      zmId: zm.id,
      assignedGovernorates
    })
      .pipe(
        finalize(() => {
          this.assigningGovernoratesZmId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (updated) => {
          this.mergeUser(updated);
          void this.swal.success('Governorates saved', `Territorial coverage updated for ${updated.fullName}.`);
        },
        error: (err) => {
          console.error('Error assigning governorates:', err);
          const message = err?.error?.message ?? 'Failed to assign governorates';
          this.error = message;
          void this.swal.error('Governorate assignment failed', message);
        }
      });
  }

  private assignCoverageAreas(stt: AppUser, coveredGovernorates: string[]): void {
    this.error = null;
    this.assigningCoverageSttId = stt.id;

    this.usersSvc.assignCoverageAreasToStt({
      sttId: stt.id,
      coveredGovernorates
    })
      .pipe(
        finalize(() => {
          this.assigningCoverageSttId = null;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (updated) => {
          this.mergeUser(updated);
          void this.swal.success('Coverage saved', `Coverage areas updated for ${updated.fullName}.`);
        },
        error: (err) => {
          console.error('Error assigning STT coverage:', err);
          const message = err?.error?.message ?? 'Failed to save STT coverage areas';
          this.error = message;
          void this.swal.error('Coverage update failed', message);
        }
      });
  }

  get summaryCards(): UserSummaryCard[] {
    const approvedStt = this.users.filter((user) => user.role === 'ROLE_STT' && user.status === 'APPROVED' && user.enabled);
    const coveredSttCount = approvedStt.filter((user) => this.coverageAreasFor(user).length > 0).length;

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
        label: 'STT coverage ready',
        helper: 'Coverage areas defined for governorate-based dispatch',
        value: `${coveredSttCount}/${approvedStt.length || 0}`,
        icon: 'cilLayers',
        tone: 'accent'
      }
    ];
  }

  canAssignGovernorates(user: AppUser): boolean {
    return user.role === 'ROLE_ZM';
  }

  canSetCoverageAreas(user: AppUser): boolean {
    return user.role === 'ROLE_STT';
  }

  canManageBan(user: AppUser): boolean {
    return user.status === 'APPROVED';
  }

  isAssigningGovernorates(zmId: string): boolean {
    return this.assigningGovernoratesZmId === zmId;
  }

  isAssigningCoverage(sttId: string): boolean {
    return this.assigningCoverageSttId === sttId;
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

  territoryDetailLabel(user: AppUser): string {
    if (user.role === 'ROLE_STT') {
      return 'Coverage areas';
    }

    if (user.role === 'ROLE_ZM') {
      return 'Governorate coverage';
    }

    return 'Assignment';
  }

  territoryDetailValue(user: AppUser): string {
    if (user.role === 'ROLE_STT') {
      return this.coverageSummary(user);
    }

    if (user.role === 'ROLE_ZM') {
      return this.governorateSummary(user);
    }

    return 'Not applicable';
  }

  governoratesFor(user: AppUser): string[] {
    return (user.assignedGovernorates ?? []).filter((governorate) => !!governorate?.trim());
  }

  coverageAreasFor(user: AppUser): string[] {
    return (user.coveredGovernorates ?? []).filter((governorate) => !!governorate?.trim());
  }

  governorateSummary(user: AppUser): string {
    const count = this.governoratesFor(user).length;

    if (count === 0) {
      return 'No governorates assigned';
    }

    return `${count} governorate${count > 1 ? 's' : ''} assigned`;
  }

  coverageSummary(user: AppUser): string {
    const count = this.coverageAreasFor(user).length;

    if (count === 0) {
      return 'No coverage areas defined';
    }

    return `${count} coverage area${count > 1 ? 's' : ''} defined`;
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
  trackGovernorate = (_index: number, governorate: string) => governorate;

  private mergeUser(updated: AppUser): void {
    this.users = this.users.map((user) => user.id === updated.id ? updated : user);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private openGovernoratePicker(
    titleText: string,
    hint: string,
    currentGovernorates: string[],
    confirmButtonText: string
  ): Promise<import('sweetalert2').SweetAlertResult<string[]>> {
    const selectedGovernorates = new Set(currentGovernorates);

    return Swal.fire<string[]>({
      titleText,
      width: 760,
      html: `
        <div class="user-governorates-modal">
          <div class="user-governorates-modal__toolbar">
            <label class="user-governorates-modal__toggle">
              <input id="sw-governorates-all" type="checkbox" ${selectedGovernorates.size === this.governorateOptions.length ? 'checked' : ''} />
              <span>Select all governorates</span>
            </label>
            <div class="user-governorates-modal__hint">
              ${this.escapeHtml(hint)}
            </div>
          </div>

          <div class="user-governorates-modal__grid">
            ${this.governorateOptions.map((governorate) => `
              <label class="user-governorates-modal__option">
                <input
                  type="checkbox"
                  name="sw-governorate"
                  value="${this.escapeHtml(governorate)}"
                  ${selectedGovernorates.has(governorate) ? 'checked' : ''}
                />
                <span>${this.escapeHtml(governorate)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `,
      customClass: {
        popup: 'user-governorates-popup'
      },
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#321fdb',
      didOpen: () => {
        const popup = Swal.getPopup();
        if (!popup) {
          return;
        }

        const selectAll = popup.querySelector<HTMLInputElement>('#sw-governorates-all');
        const checkboxes = Array.from(
          popup.querySelectorAll<HTMLInputElement>('input[name="sw-governorate"]')
        );

        const syncSelectAll = () => {
          if (!selectAll) {
            return;
          }

          selectAll.checked = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
        };

        selectAll?.addEventListener('change', () => {
          checkboxes.forEach((checkbox) => {
            checkbox.checked = !!selectAll.checked;
          });
        });

        checkboxes.forEach((checkbox) => {
          checkbox.addEventListener('change', syncSelectAll);
        });

        syncSelectAll();
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        if (!popup) {
          return [];
        }

        const selected = Array.from(
          popup.querySelectorAll<HTMLInputElement>('input[name="sw-governorate"]:checked')
        ).map((checkbox) => checkbox.value);

        if (selected.length === 0) {
          Swal.showValidationMessage('Select at least one governorate');
          return undefined;
        }

        return selected;
      }
    });
  }
}
