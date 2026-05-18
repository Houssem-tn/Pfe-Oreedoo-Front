import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerComponent } from '@coreui/angular';

import { NotificationItem, AlertLevel, effectiveLevel } from './models/notification.model';
import { NotificationStoreService } from './notification-store.service';
import { AuthStore } from '../auth/auth.store';

type LevelFilter = 'ALL' | AlertLevel;

@Component({
  selector: 'app-alert-center',
  standalone: true,
  imports: [NgClass, DatePipe, IconDirective, SpinnerComponent],
  templateUrl: './alert-center.component.html',
  styleUrls: ['./alert-center.component.scss']
})
export class AlertCenterComponent {
  readonly store = inject(NotificationStoreService);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);

  readonly activeFilter = signal<LevelFilter>('ALL');
  readonly compact = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());

  readonly criticalCount = computed(() =>
    this.store.alertsByLevel().filter(n => effectiveLevel(n) === 'CRITICAL').length
  );
  readonly warningCount = computed(() =>
    this.store.alertsByLevel().filter(n => effectiveLevel(n) === 'WARNING').length
  );
  readonly infoCount = computed(() =>
    this.store.alertsByLevel().filter(n => effectiveLevel(n) === 'INFO').length
  );

  readonly filtered = computed(() => {
    const f = this.activeFilter();
    if (f === 'ALL') return this.store.alertsByLevel();
    return this.store.alertsByLevel().filter(n => effectiveLevel(n) === f);
  });

  readonly allSelected = computed(() => {
    const ids = this.selectedIds();
    const items = this.filtered();
    return items.length > 0 && items.every(i => ids.has(i.id));
  });

  readonly selectionCount = computed(() => this.selectedIds().size);

  // ── Filter / selection ──────────────────────────────────────────────

  setFilter(f: LevelFilter): void {
    this.activeFilter.set(f);
    this.clearSelection();
  }

  toggleCompact(): void {
    this.compact.update(v => !v);
  }

  trackById(_: number, item: NotificationItem): string {
    return item.id;
  }

  markRead(item: NotificationItem, event: Event): void {
    event.stopPropagation();
    this.store.markAsRead(item.id);
  }

  toggleSelect(id: string, event: Event): void {
    event.stopPropagation();
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.clearSelection();
    } else {
      this.selectedIds.set(new Set(this.filtered().map(i => i.id)));
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  markSelectedRead(): void {
    for (const id of this.selectedIds()) {
      this.store.markAsRead(id);
    }
    this.clearSelection();
  }

  // ── Severity ────────────────────────────────────────────────────────

  isCritical(item: NotificationItem): boolean {
    return effectiveLevel(item) === 'CRITICAL';
  }

  isWarning(item: NotificationItem): boolean {
    return effectiveLevel(item) === 'WARNING';
  }

  getAlertSeverityClass(item: NotificationItem): string {
    return `alert-card--${effectiveLevel(item).toLowerCase()}`;
  }

  // ── Icon ────────────────────────────────────────────────────────────

  iconBg(item: NotificationItem): string {
    return `alert-icon--${effectiveLevel(item).toLowerCase()}`;
  }

  iconName(item: NotificationItem): string {
    switch (item.eventType) {
      case 'STOCK_CRITICAL':
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':          return 'cilBan';
      case 'STOCK_LOW_WARNING':
      case 'SLA_WARNING':            return 'cilWarning';
      case 'STOCK_USAGE_PERMISSION_REQUIRED':
      case 'STOCK_USAGE_PERMISSION_APPROVED':
      case 'STOCK_USAGE_PERMISSION_REJECTED': return 'cilLockLocked';
      case 'DPM_CREATED':
      case 'DPM_CONFIRMED':
      case 'DPM_REJECTED':           return 'cilStorage';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':  return 'cilTask';
      default:                       return 'cilBell';
    }
  }

  // ── Lifecycle status ────────────────────────────────────────────────

  getLifecycleStatus(item: NotificationItem): 'NEW' | null {
    return item.read ? null : 'NEW';
  }

  // ── Category chip ───────────────────────────────────────────────────

  getCategoryLabel(item: NotificationItem): string {
    switch (item.eventType) {
      case 'STOCK_CRITICAL':
      case 'STOCK_LOW_WARNING':                  return 'STOCK_RISK';
      case 'STOCK_USAGE_PERMISSION_REQUIRED':
      case 'STOCK_USAGE_PERMISSION_APPROVED':
      case 'STOCK_USAGE_PERMISSION_REJECTED':    return 'PERMISSION';
      case 'DPM_CREATED':
      case 'DPM_CONFIRMED':
      case 'DPM_REJECTED':                       return 'DPM_STATUS';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':              return 'CASE_ASSIGN';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
      case 'SLA_WARNING':                        return 'SLA_RISK';
      case 'THRESHOLD_UPDATED':                  return 'THRESHOLD';
      case 'WORK_REJECTED':                      return 'WORK_REJECTED';
      case 'PROOF_UPLOADED':                     return 'PROOF';
      default:                                   return '';
    }
  }

  // ── Metadata chips ──────────────────────────────────────────────────

  getMetaChips(item: NotificationItem): string[] {
    const chips: string[] = [];
    const data = item.data ?? {};

    const role = item.targetRole;
    if (role === 'ROLE_TECH') chips.push('TECH');
    else if (role === 'ROLE_STT') chips.push('STT');
    else if (role === 'ROLE_ZM') chips.push('ZM');

    const caseId = item.relatedCaseId ?? data['caseId'];
    if (caseId) chips.push(`Case #${String(caseId).slice(-8)}`);

    const itemName = data['itemName'] ?? data['equipmentName'] ?? data['stockItemName'];
    if (itemName) chips.push(String(itemName));

    const actor = item.triggeredBy ?? data['triggeredBy'] ?? data['actorName'];
    if (actor) chips.push(`by ${actor}`);

    return chips;
  }

  // ── Time ────────────────────────────────────────────────────────────

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0) return 'Just now';
    const min = Math.floor(diffMs / 60_000);
    if (min < 1)  return 'Just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.floor(min / 60);
    if (h < 24)   return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1)  return 'Yesterday';
    if (d < 7)    return `${d}d ago`;
    return new DatePipe('en-US').transform(dateStr, 'dd MMM') ?? '';
  }

  getAbsoluteTime(dateStr: string): string {
    return new DatePipe('en-US').transform(dateStr, 'dd MMM, HH:mm') ?? '';
  }

  // ── Action ──────────────────────────────────────────────────────────

  getAlertActionLabel(item: NotificationItem): string | null {
    switch (item.actionType) {
      case 'OPEN_CASE':                    return 'Open Case';
      case 'OPEN_DPM_REQUEST':             return 'Open DPM';
      case 'OPEN_STOCK_PERMISSION_REQUEST': return 'Review Request';
      case 'OPEN_STOCK_THRESHOLDS':        return 'View Thresholds';
      case 'OPEN_STOCK_PAGE':              return 'View Stock';
      default:                             return null;
    }
  }

  handleAction(item: NotificationItem): void {
    this.store.markAsRead(item.id);
    const role = this.authStore.role();
    const data = item.data ?? {};

    switch (item.actionType) {
      case 'OPEN_CASE':
        this.router.navigate([data['routeHint'] ?? this.defaultCaseRoute(role)]);
        break;
      case 'OPEN_DPM_REQUEST':
        this.router.navigate([data['routeHint'] ?? this.defaultDpmRoute(role)]);
        break;
      case 'OPEN_STOCK_PERMISSION_REQUEST':
        this.router.navigate([this.permissionRoute(role)]);
        break;
      case 'OPEN_STOCK_THRESHOLDS':
        this.router.navigate(['/zm/stock/thresholds']);
        break;
      case 'OPEN_STOCK_PAGE':
        this.router.navigate([data['routeHint'] ?? this.defaultStockRoute(role)]);
        break;
    }
  }

  // ── Empty state ─────────────────────────────────────────────────────

  emptyMessage(): { title: string; sub: string } {
    switch (this.activeFilter()) {
      case 'CRITICAL': return { title: 'No critical alerts.', sub: 'Operations are stable.' };
      case 'WARNING':  return { title: 'No warnings detected.', sub: 'Everything looks good.' };
      case 'INFO':     return { title: 'No information alerts.', sub: "You're all caught up." };
      default:         return { title: 'No alerts yet.', sub: 'Alerts will appear here in real time.' };
    }
  }

  // ── Private routes ──────────────────────────────────────────────────

  private defaultCaseRoute(role: string | null): string {
    switch (role) {
      case 'ROLE_ZM':   return '/zm/cases/activation';
      case 'ROLE_STT':  return '/stt/cases/activation';
      case 'ROLE_TECH': return '/tech/cases/activation';
      default:          return '/admin/cases/activation';
    }
  }

  private defaultDpmRoute(role: string | null): string {
    return role === 'ROLE_STT' ? '/stt/stock/incoming-dpms' : '/zm/stock/my-tracking';
  }

  private defaultStockRoute(role: string | null): string {
    return role === 'ROLE_STT' ? '/stt/stock/my-stock' : '/zm/stock/team-stock';
  }

  private permissionRoute(role: string | null): string {
    if (role === 'ROLE_STT')  return '/stt/stock/usage-approvals';
    if (role === 'ROLE_TECH') return '/tech/stock/my-permissions';
    return '/stt/stock/usage-approvals';
  }
}
