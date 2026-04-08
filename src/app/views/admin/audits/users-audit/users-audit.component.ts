import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import {
  AppUser,
  InvitationStatus,
  Role,
  UserAuditActor,
  UserAuditDetailsResponse
} from '../../../../core/users/user.model';
import { UserService } from '../../../../core/users/user.service';

interface UsersAuditSummaryCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: 'primary' | 'warning' | 'success' | 'danger';
}

interface DetailMetricCard {
  label: string;
  helper: string;
  value: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

interface DetailTraceCard {
  label: string;
  helper: string;
  icon: string;
  actor: UserAuditActor | null;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
}

interface TimelineItem {
  label: string;
  timestamp: string;
  helper: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
}

interface ProfileEntry {
  label: string;
  value: string;
  icon: string;
}

@Component({
  standalone: true,
  selector: 'app-users-audit',
  imports: [CommonModule, FormsModule, RouterLink, IconDirective],
  templateUrl: './users-audit.component.html',
  styleUrl: './users-audit.component.scss'
})
export class UsersAuditComponent implements OnInit {
  private readonly usersSvc = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  users: AppUser[] = [];
  loading = false;
  error: string | null = null;

  detailLoading = false;
  detailError: string | null = null;
  selectedUserId: string | null = null;
  selectedUserAudit: UserAuditDetailsResponse | null = null;

  searchTerm = '';
  selectedStatus = '';
  selectedRole = '';

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  readonly roleOptions = [
    { value: '', label: 'All roles' },
    { value: 'ROLE_ADMIN', label: 'Admin' },
    { value: 'ROLE_STT', label: 'STT' },
    { value: 'ROLE_TECH', label: 'TECH' },
    { value: 'ROLE_CRM_BOUTIQUE', label: 'CRM Boutique' },
    { value: 'ROLE_ZM', label: 'ZM' }
  ];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const requestedUserId = params.get('user');

      if (!requestedUserId) {
        this.selectedUserId = null;
        this.selectedUserAudit = null;
        this.detailError = null;
        return;
      }

      this.selectedUserId = requestedUserId;

      if (this.users.length > 0) {
        this.loadAuditDetails(requestedUserId, true);
      }
    });

    this.loadAuditData();
  }

  loadAuditData(): void {
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
          this.syncSelectedUser();

          if (this.selectedUserId) {
            this.loadAuditDetails(this.selectedUserId, true);
          }
        },
        error: (err) => {
          console.error('Error loading audit data:', err);
          this.error = err?.error?.message ?? 'Failed to load audit data';
        }
      });
  }

  loadAuditDetails(id: string, preserveCurrent = false): void {
    if (!id) {
      return;
    }

    if (!preserveCurrent) {
      this.selectedUserAudit = null;
    }

    this.detailLoading = true;
    this.detailError = null;

    this.usersSvc.getAuditDetails(id)
      .pipe(
        finalize(() => {
          this.detailLoading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (details) => {
          if (this.selectedUserId !== id) {
            return;
          }

          this.selectedUserAudit = details;
          this.mergeUser(details.user);
        },
        error: (err) => {
          if (this.selectedUserId !== id) {
            return;
          }

          console.error('Error loading user audit details:', err);
          this.detailError = err?.error?.message ?? 'Failed to load user audit details';
        }
      });
  }

  selectUser(user: AppUser): void {
    this.selectedUserId = user.id;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { user: user.id },
      queryParamsHandling: 'merge'
    });
    this.loadAuditDetails(user.id, false);
  }

  clearSelection(): void {
    this.selectedUserId = null;
    this.selectedUserAudit = null;
    this.detailError = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { user: null },
      queryParamsHandling: 'merge'
    });
  }

  get totalUsers(): number {
    return this.users.length;
  }

  get pendingUsersCount(): number {
    return this.users.filter((user) => user.status === 'PENDING').length;
  }

  get approvedUsersCount(): number {
    return this.users.filter((user) => user.status === 'APPROVED' && !!user.enabled).length;
  }

  get bannedUsersCount(): number {
    return this.users.filter((user) => user.status === 'APPROVED' && !user.enabled).length;
  }

  get selectedUserSummary(): AppUser | null {
    if (!this.selectedUserId) {
      return null;
    }

    return this.users.find((user) => user.id === this.selectedUserId) ?? null;
  }

  get selectedUser(): AppUser | null {
    return this.selectedUserAudit?.user ?? this.selectedUserSummary;
  }

  get selectedAuditRole(): Role | string | null {
    const user = this.selectedUser;
    return user ? this.effectiveRole(user) : null;
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
        label: 'Active approved',
        helper: 'Approved users currently allowed to operate',
        value: String(this.approvedUsersCount),
        icon: 'cilCheckCircle',
        tone: 'success'
      },
      {
        label: 'Banned accounts',
        helper: 'Approved users currently blocked by admin',
        value: String(this.bannedUsersCount),
        icon: 'cilBan',
        tone: 'danger'
      }
    ];
  }

  get filteredAuditUsers(): AppUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesSearch =
        !term ||
        (user.fullName ?? '').toLowerCase().includes(term) ||
        (user.email ?? '').toLowerCase().includes(term) ||
        (user.phone ?? '').toLowerCase().includes(term);

      const matchesStatus = !this.selectedStatus || user.status === this.selectedStatus;
      const matchesRole = !this.selectedRole || this.effectiveRole(user) === this.selectedRole;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }

  get hasFilters(): boolean {
    return !!this.searchTerm.trim() || !!this.selectedStatus || !!this.selectedRole;
  }

  get selectedStatusLabel(): string {
    return this.statusOptions.find((status) => status.value === this.selectedStatus)?.label ?? 'All statuses';
  }

  get selectedRoleLabel(): string {
    return this.roleOptions.find((role) => role.value === this.selectedRole)?.label ?? 'All roles';
  }

  get detailMetricCards(): DetailMetricCard[] {
    const role = this.selectedAuditRole;
    const performance = this.selectedUserAudit?.performance;
    const hierarchy = this.selectedUserAudit?.hierarchy;

    if (!role || role === 'ROLE_CRM_BOUTIQUE' || !performance) {
      return [];
    }

    if (role === 'ROLE_TECH') {
      return [
        this.metricCard('Assigned cases', performance.assignedCases, 'Cases currently or previously assigned to this technician.', 'cilLayers', 'primary'),
        this.metricCard('Active tasks', performance.activeTasksCount, 'Open field actions still under this technician.', 'cilTask', 'warning'),
        this.metricCard('Completed cases', performance.completedCasesCount, 'Cases already delivered by this technician.', 'cilCheckCircle', 'success'),
        this.metricCard('On-time RDV', performance.rdvOnTime, 'Appointments completed inside SLA.', 'cilCalendar', 'success'),
        this.metricCard('Late RDV', performance.rdvLate, 'Appointments completed after SLA expiry.', 'cilClock', 'warning'),
        this.metricCard('SLA breaches', performance.slaBreachCount, 'Cases that breached SLA while in this technician scope.', 'cilBan', 'danger')
      ];
    }

    if (role === 'ROLE_STT') {
      return [
        this.metricCard('Technician team', hierarchy?.techCount ?? 0, 'Technicians currently assigned under this STT.', 'cilPeople', 'primary'),
        this.metricCard('Cases in scope', performance.assignedCases, 'Activation cases handled in this STT scope.', 'cilLayers', 'primary'),
        this.metricCard('Active workload', performance.activeTasksCount, 'Operational cases still moving under this STT.', 'cilTask', 'warning'),
        this.metricCard('Completed cases', performance.completedCasesCount, 'Cases completed by this STT team.', 'cilCheckCircle', 'success'),
        this.metricCard('On-time RDV', `${this.formatPercent(performance.rdvOnTimeRate)}%`, 'On-time appointment rate for the supervised scope.', 'cilCalendar', 'success'),
        this.metricCard('SLA breaches', performance.slaBreachCount, 'Breaches observed in the STT operational perimeter.', 'cilWarning', 'danger')
      ];
    }

    if (role === 'ROLE_ZM') {
      return [
        this.metricCard('Managed STT', hierarchy?.sttCount ?? 0, 'STT supervisors directly assigned to this ZM.', 'cilPeople', 'primary'),
        this.metricCard('Subordinate TECH', hierarchy?.techCount ?? 0, 'Technicians linked to this ZM through team assignments.', 'cilUserFollow', 'primary'),
        this.metricCard('Cases in zone', performance.assignedCases, 'Activation cases covered by this ZM area.', 'cilLayers', 'primary'),
        this.metricCard('Active operations', performance.activeTasksCount, 'Cases still open in the zone.', 'cilTask', 'warning'),
        this.metricCard('Completed cases', performance.completedCasesCount, 'Cases completed in this zone scope.', 'cilCheckCircle', 'success'),
        this.metricCard('SLA escalations', performance.slaEscalationCount, 'Escalations triggered in the zone scope.', 'cilWarning', 'danger')
      ];
    }

    return [
      this.metricCard('Activation cases', performance.assignedCases, 'Current activation footprint visible to this administrator.', 'cilLayers', 'primary'),
      this.metricCard('Active operations', performance.activeTasksCount, 'Open operational cases still being processed.', 'cilTask', 'warning'),
      this.metricCard('Completed cases', performance.completedCasesCount, 'Cases completed across the activation operation.', 'cilCheckCircle', 'success'),
      this.metricCard('On-time RDV', `${this.formatPercent(performance.rdvOnTimeRate)}%`, 'Operational punctuality observed across the scope.', 'cilCalendar', 'success'),
      this.metricCard('SLA warnings', performance.slaWarningCount, 'Cases approaching breach threshold.', 'cilClock', 'warning'),
      this.metricCard('SLA breaches', performance.slaBreachCount, 'Cases that breached SLA in the current scope.', 'cilBan', 'danger')
    ];
  }

  get detailTraceCards(): DetailTraceCard[] {
    const role = this.selectedAuditRole;
    const details = this.selectedUserAudit;

    if (!role || !details) {
      return [];
    }

    const cards: DetailTraceCard[] = [
      {
        label: 'Approval owner',
        helper: details.user.status === 'APPROVED'
          ? 'User who validated the account into production use.'
          : 'Validation owner will appear here once the account is approved.',
        icon: 'cilCheckCircle',
        actor: details.validator ?? null,
        tone: details.user.status === 'APPROVED' ? 'success' : 'warning'
      }
    ];

    if (role === 'ROLE_TECH') {
      cards.push(
        {
          label: 'Invited by STT',
          helper: 'Original field supervisor that sent the technician invitation.',
          icon: 'cilEnvelopeOpen',
          actor: details.invitedBy ?? null,
          tone: 'primary'
        },
        {
          label: 'Invitation ZM',
          helper: 'ZM involved in the invitation decision chain for this technician.',
          icon: 'cilLocationPin',
          actor: details.invitationZm ?? null,
          tone: 'neutral'
        },
        {
          label: 'Assigned STT',
          helper: 'Current STT operational owner supervising this technician.',
          icon: 'cilPeople',
          actor: details.assignedStt ?? null,
          tone: 'primary'
        },
        {
          label: 'Assigned ZM',
          helper: 'Current zone owner attached to this technician chain.',
          icon: 'cilLocationPin',
          actor: details.assignedZm ?? null,
          tone: 'neutral'
        }
      );
    }

    if (role === 'ROLE_STT') {
      cards.push({
        label: 'Assigned ZM',
        helper: 'Zone manager currently supervising this STT.',
        icon: 'cilLocationPin',
        actor: details.assignedZm ?? null,
        tone: 'primary'
      });
    }

    if (role === 'ROLE_ZM') {
      cards.push({
        label: 'Approved by admin',
        helper: 'Administrative approval resolved from the validation trail.',
        icon: 'cilSettings',
        actor: details.validator ?? null,
        tone: 'success'
      });
    }

    return cards;
  }

  get lifecycleTimeline(): TimelineItem[] {
    const user = this.selectedUser;
    const details = this.selectedUserAudit;
    const invitation = details?.invitation;
    const items: TimelineItem[] = [];

    if (invitation?.createdAt) {
      items.push({
        label: 'Invitation created',
        timestamp: invitation.createdAt,
        helper: `${this.actorDisplayName(details?.invitedBy, 'STT source not resolved')} launched the technician invitation.`,
        icon: 'cilEnvelopeOpen',
        tone: 'primary'
      });
    }

    if (invitation?.registeredAt) {
      items.push({
        label: 'Invitation registration completed',
        timestamp: invitation.registeredAt,
        helper: 'The invited technician completed registration from the invitation flow.',
        icon: 'cilUserFollow',
        tone: 'success'
      });
    }

    if (invitation?.zmDecisionAt) {
      items.push({
        label: 'Invitation reviewed by ZM',
        timestamp: invitation.zmDecisionAt,
        helper: `Invitation status: ${this.formatInvitationStatus(invitation.status)}.`,
        icon: 'cilLocationPin',
        tone: invitation.status === 'REJECTED_BY_ZM' ? 'warning' : 'success'
      });
    }

    if (user?.createdAt) {
      items.push({
        label: 'Account created',
        timestamp: user.createdAt,
        helper: 'Initial account record creation in the platform.',
        icon: 'cilUser',
        tone: 'primary'
      });
    }

    if (user?.validatedAt) {
      items.push({
        label: 'Account validated',
        timestamp: user.validatedAt,
        helper: `${this.actorDisplayName(details?.validator, user.validatedBy || 'Validator not resolved')} approved this account.`,
        icon: 'cilCheckCircle',
        tone: 'success'
      });
    }

    if (user?.lastLoginAt) {
      items.push({
        label: 'Last login detected',
        timestamp: user.lastLoginAt,
        helper: 'Most recent successful sign-in recorded on this account.',
        icon: 'cilClock',
        tone: 'neutral'
      });
    }

    return items;
  }

  get roleProfileEntries(): ProfileEntry[] {
    const role = this.selectedAuditRole;
    const profile = this.selectedUserAudit?.roleProfile;

    if (!role || !profile) {
      return [];
    }

    const entries: ProfileEntry[] = [];

    if (role === 'ROLE_CRM_BOUTIQUE') {
      this.pushProfileEntry(entries, 'Boutique name', profile.boutiqueName, 'cilHome');
      this.pushProfileEntry(entries, 'Boutique code', profile.boutiqueCode, 'cilTags');
      this.pushProfileEntry(entries, 'Boutique address', profile.boutiqueAddress, 'cilLocationPin');
    }

    if (role === 'ROLE_STT') {
      this.pushProfileEntry(entries, 'Service center', profile.serviceCenter, 'cilHome');
      this.pushProfileEntry(entries, 'Department', profile.department, 'cilLayers');
    }

    if (role === 'ROLE_TECH') {
      this.pushProfileEntry(entries, 'Matricule', profile.matricule, 'cilUser');
      this.pushProfileEntry(entries, 'Skill set', profile.skillSet, 'cilTask');
      this.pushProfileEntry(entries, 'Region', profile.region, 'cilLocationPin');

      if (profile.available !== null && profile.available !== undefined) {
        entries.push({
          label: 'Availability',
          value: profile.available ? 'Available' : 'Unavailable',
          icon: profile.available ? 'cilCheckCircle' : 'cilBan'
        });
      }
    }

    if (role === 'ROLE_ZM') {
      this.pushProfileEntry(entries, 'Zone name', profile.zoneName, 'cilLocationPin');
      this.pushProfileEntry(entries, 'Zone code', profile.zoneCode, 'cilTags');
      this.pushProfileEntry(entries, 'Coverage', profile.coverage, 'cilMap');
    }

    return entries;
  }

  get visibleDirectReports(): UserAuditActor[] {
    return (this.selectedUserAudit?.hierarchy?.directReports ?? []).slice(0, 6);
  }

  get remainingDirectReportCount(): number {
    const total = this.selectedUserAudit?.hierarchy?.directReportCount ?? 0;
    return Math.max(0, total - this.visibleDirectReports.length);
  }

  get hasHierarchySection(): boolean {
    const role = this.selectedAuditRole;
    return role === 'ROLE_STT' || role === 'ROLE_ZM';
  }

  get teamSectionTitle(): string {
    switch (this.selectedAuditRole) {
      case 'ROLE_STT':
        return 'Technician team';
      case 'ROLE_ZM':
        return 'Managed STT network';
      default:
        return 'Team visibility';
    }
  }

  get teamSectionHint(): string {
    const hierarchy = this.selectedUserAudit?.hierarchy;

    if (this.selectedAuditRole === 'ROLE_STT') {
      return `${hierarchy?.techCount ?? 0} technicians are currently attached to this STT.`;
    }

    if (this.selectedAuditRole === 'ROLE_ZM') {
      return `${hierarchy?.sttCount ?? 0} STT accounts and ${hierarchy?.techCount ?? 0} subordinate technicians are currently linked to this ZM.`;
    }

    return 'No hierarchy data available.';
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedRole = '';
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

  formatInvitationStatus(status?: InvitationStatus | string | null): string {
    switch (status) {
      case 'PENDING_REGISTRATION':
        return 'Pending registration';
      case 'REGISTERED_PENDING_ZM_APPROVAL':
        return 'Pending ZM approval';
      case 'APPROVED_BY_ZM':
        return 'Approved by ZM';
      case 'REJECTED_BY_ZM':
        return 'Rejected by ZM';
      case 'EXPIRED':
        return 'Expired';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return 'Not recorded';
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

  roleBadgeClass(role?: string | null): string {
    switch (role) {
      case 'ROLE_ADMIN':
        return 'audit-pill audit-pill--admin';
      case 'ROLE_STT':
        return 'audit-pill audit-pill--stt';
      case 'ROLE_TECH':
        return 'audit-pill audit-pill--tech';
      case 'ROLE_CRM_BOUTIQUE':
        return 'audit-pill audit-pill--crm';
      case 'ROLE_ZM':
        return 'audit-pill audit-pill--zm';
      default:
        return 'audit-pill audit-pill--neutral';
    }
  }

  statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'audit-pill audit-pill--approved';
      case 'REJECTED':
        return 'audit-pill audit-pill--rejected';
      case 'PENDING':
      default:
        return 'audit-pill audit-pill--pending';
    }
  }

  accessBadgeClass(user: AppUser): string {
    if (user.status === 'APPROVED' && !user.enabled) {
      return 'audit-pill audit-pill--banned';
    }

    return user.enabled
      ? 'audit-pill audit-pill--enabled'
      : 'audit-pill audit-pill--disabled';
  }

  accessLabel(user: AppUser): string {
    if (user.status === 'APPROVED' && !user.enabled) {
      return 'Banned';
    }

    return user.enabled ? 'Enabled' : 'Disabled';
  }

  invitationStatusClass(status?: InvitationStatus | string | null): string {
    switch (status) {
      case 'APPROVED_BY_ZM':
        return 'audit-pill audit-pill--approved';
      case 'REJECTED_BY_ZM':
        return 'audit-pill audit-pill--rejected';
      case 'PENDING_REGISTRATION':
      case 'REGISTERED_PENDING_ZM_APPROVAL':
        return 'audit-pill audit-pill--pending';
      default:
        return 'audit-pill audit-pill--neutral';
    }
  }

  userInitials(user: AppUser): string {
    return this.computeInitials(user.fullName, user.email);
  }

  actorInitials(actor?: UserAuditActor | null): string {
    return this.computeInitials(actor?.fullName, actor?.email);
  }

  isSelectedUser(user: AppUser): boolean {
    return !!this.selectedUserId && user.id === this.selectedUserId;
  }

  actorDisplayName(actor?: UserAuditActor | null, fallback = 'Not recorded'): string {
    if (actor?.fullName?.trim()) {
      return actor.fullName.trim();
    }

    if (actor?.email?.trim()) {
      return actor.email.trim();
    }

    return fallback;
  }

  actorDisplayMeta(actor?: UserAuditActor | null): string {
    if (!actor) {
      return 'No actor resolved from the current audit sources.';
    }

    const parts = [
      actor.role ? this.formatRole(actor.role) : null,
      actor.status ? this.formatStatus(actor.status) : null,
      actor.email || null
    ].filter((value): value is string => !!value);

    return parts.length ? parts.join(' · ') : 'User trace exists without extra profile metadata.';
  }

  profileImageFor(source?: { profileThumbnailUrl?: string | null; profileImageUrl?: string | null } | null): string | null {
    return source?.profileThumbnailUrl || source?.profileImageUrl || null;
  }

  effectiveRole(user?: AppUser | null): Role | string {
    return user?.role || user?.roleRequested || '';
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return 'Not recorded';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Not recorded';
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  trackById = (_index: number, user: AppUser) => user.id;

  private metricCard(
    label: string,
    value: number | string,
    helper: string,
    icon: string,
    tone: DetailMetricCard['tone']
  ): DetailMetricCard {
    return {
      label,
      value: typeof value === 'number' ? this.formatCount(value) : value,
      helper,
      icon,
      tone
    };
  }

  private pushProfileEntry(entries: ProfileEntry[], label: string, value: string | null | undefined, icon: string): void {
    if (!value || !value.trim()) {
      return;
    }

    entries.push({
      label,
      value: value.trim(),
      icon
    });
  }

  private mergeUser(updated: AppUser | null | undefined): void {
    if (!updated?.id) {
      return;
    }

    let found = false;
    this.users = this.users.map((user) => {
      if (user.id !== updated.id) {
        return user;
      }

      found = true;
      return {
        ...user,
        ...updated
      };
    });

    if (!found) {
      this.users = [updated, ...this.users];
    }
  }

  private syncSelectedUser(): void {
    if (!this.selectedUserId) {
      return;
    }

    const currentUser = this.users.find((user) => user.id === this.selectedUserId);
    if (!currentUser) {
      this.selectedUserId = null;
      this.selectedUserAudit = null;
      this.detailError = null;
      return;
    }

    if (this.selectedUserAudit?.user?.id === currentUser.id) {
      this.selectedUserAudit = {
        ...this.selectedUserAudit,
        user: {
          ...this.selectedUserAudit.user,
          ...currentUser
        }
      };
    }
  }

  private computeInitials(fullName?: string | null, email?: string | null): string {
    const source = (fullName ?? email ?? '').trim();

    if (!source) {
      return 'NA';
    }

    const tokens = source.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase();
    }

    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
  }

  private formatCount(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }

  private formatPercent(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(value ?? 0);
  }
}
