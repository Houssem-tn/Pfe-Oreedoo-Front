import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerComponent } from '@coreui/angular';

import {
  NotificationItem,
  AlertLevel,
  AlertCategory,
  AlertActionType,
  effectiveLevel,
  effectiveCategory,
} from './models/notification.model';
import { NotificationStoreService } from './notification-store.service';
import { AuthStore } from '../auth/auth.store';

type LevelFilter    = 'ALL' | AlertLevel;
type CategoryFilter = 'ALL' | AlertCategory;

@Component({
  selector: 'app-alert-center',
  standalone: true,
  imports: [NgClass, DatePipe, IconDirective, SpinnerComponent],
  templateUrl: './alert-center.component.html',
  styleUrls: ['./alert-center.component.scss']
})
export class AlertCenterComponent {
  readonly store    = inject(NotificationStoreService);
  private readonly router    = inject(Router);
  private readonly authStore = inject(AuthStore);

  readonly activeLevelFilter    = signal<LevelFilter>('ALL');
  readonly activeCategoryFilter = signal<CategoryFilter>('ALL');
  readonly compact              = signal(false);
  readonly selectedIds          = signal<Set<string>>(new Set());

  // ── Severity counters ────────────────────────────────────────────────

  readonly criticalCount = computed(() =>
    this.store.alertsByLevel().filter(n => effectiveLevel(n) === 'CRITICAL').length
  );
  readonly warningCount = computed(() =>
    this.store.alertsByLevel().filter(n => effectiveLevel(n) === 'WARNING').length
  );
  readonly infoCount = computed(() =>
    this.store.alertsByLevel().filter(n => effectiveLevel(n) === 'INFO').length
  );

  // ── Category counters ────────────────────────────────────────────────

  readonly categoryCounters = computed(() => {
    const counts: Record<AlertCategory, number> = {
      DPM: 0, STOCK: 0, MATERIAL_RETURN: 0, CASE: 0, PERMISSION: 0, USER: 0, SLA: 0, SYSTEM: 0
    };
    for (const n of this.store.alertsByLevel()) {
      counts[effectiveCategory(n)]++;
    }
    return counts;
  });

  categoryCount(cat: AlertCategory): number {
    return this.categoryCounters()[cat];
  }

  // ── Filtered list (level ∩ category) ────────────────────────────────

  readonly filtered = computed(() => {
    const lf = this.activeLevelFilter();
    const cf = this.activeCategoryFilter();
    return this.store.alertsByLevel().filter(n => {
      const levelOk    = lf === 'ALL' || effectiveLevel(n) === lf;
      const categoryOk = cf === 'ALL' || effectiveCategory(n) === cf;
      return levelOk && categoryOk;
    });
  });

  readonly allSelected = computed(() => {
    const ids   = this.selectedIds();
    const items = this.filtered();
    return items.length > 0 && items.every(i => ids.has(i.id));
  });

  readonly selectionCount = computed(() => this.selectedIds().size);

  // ── Pagination ───────────────────────────────────────────────────────

  readonly currentPage  = signal(1);
  readonly pageSize     = 10 as const;

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  );

  readonly paginatedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly pageRangeLabel = computed(() => {
    const total = this.filtered().length;
    if (total === 0) return '0 results';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end   = Math.min(this.currentPage() * this.pageSize, total);
    return `${start}–${end} of ${total}`;
  });

  readonly visiblePages = computed<(number | '...')[]>(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  goToPage(n: number | '...'): void {
    if (typeof n === 'number') {
      this.currentPage.set(Math.max(1, Math.min(n, this.totalPages())));
    }
  }

  // ── Filter / selection ──────────────────────────────────────────────

  setLevelFilter(f: LevelFilter): void {
    this.activeLevelFilter.set(f);
    this.currentPage.set(1);
    this.clearSelection();
  }

  setCategoryFilter(f: CategoryFilter): void {
    this.activeCategoryFilter.set(f);
    this.currentPage.set(1);
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

  // ── Severity helpers ─────────────────────────────────────────────────

  isCritical(item: NotificationItem): boolean {
    return effectiveLevel(item) === 'CRITICAL';
  }

  isWarning(item: NotificationItem): boolean {
    return effectiveLevel(item) === 'WARNING';
  }

  // ── Icon ─────────────────────────────────────────────────────────────

  iconBg(item: NotificationItem): string {
    return `alert-icon--${effectiveLevel(item).toLowerCase()}`;
  }

  iconName(item: NotificationItem): string {
    switch (item.eventType) {
      case 'STOCK_CRITICAL':
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':                              return 'cilBan';
      case 'STOCK_LOW_WARNING':
      case 'SLA_WARNING':                                return 'cilWarning';
      case 'STOCK_USAGE_PERMISSION_REQUIRED':
      case 'STOCK_USAGE_PERMISSION_APPROVED':
      case 'STOCK_USAGE_PERMISSION_REJECTED':            return 'cilLockLocked';
      case 'DPM_CREATED':
      case 'DPM_CONFIRMED':
      case 'DPM_REJECTED':
      case 'DPM_RDV_SCHEDULED':
      case 'DPM_RDV_CONFIRMED_BY_STT':
      case 'DPM_EXTERNAL_REJECTED':                     return 'cilStorage';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':                     return 'cilTask';
      case 'CASES_BULK_ASSIGNED_TO_ZM':                 return 'cilLayers';
      case 'USER_REGISTERED':                           return 'cilUser';
      case 'STOCK_DISTRIBUTED':                         return 'cilTruck';
      case 'MATERIAL_RETURN_SUBMITTED':
      case 'MATERIAL_RETURN_REJECTED':
      case 'MATERIAL_RETURN_SCHEDULE_PROPOSED':
      case 'MATERIAL_RETURN_SCHEDULE_CONFIRMED':
      case 'MATERIAL_RETURN_RESCHEDULE_REQUESTED':
      case 'MATERIAL_RETURN_HANDED_OVER':               return 'cilArrowThickFromRight';
      case 'MATERIAL_RETURN_CLOSED':                    return 'cilCheckCircle';
      default:                                          return 'cilBell';
    }
  }

  // ── Lifecycle status ─────────────────────────────────────────────────

  getLifecycleStatus(item: NotificationItem): 'NEW' | null {
    return item.read ? null : 'NEW';
  }

  // ── Category chip ─────────────────────────────────────────────────────

  getCategoryLabel(item: NotificationItem): string {
    return effectiveCategory(item);
  }

  getCategoryChipClass(item: NotificationItem): string {
    return `alert-chip--cat-${effectiveCategory(item).toLowerCase()}`;
  }

  // ── Metadata chips ───────────────────────────────────────────────────

  getMetaChips(item: NotificationItem): string[] {
    const chips: string[] = [];
    const data = item.data ?? {};

    // Aggregated bulk batch: show count + operation type + responsible actor rather than
    // single-case metadata, keeping the summary informative at a glance.
    if (item.eventType === 'CASES_BULK_ASSIGNED_TO_ZM') {
      const count = Number(data['count'] ?? 0);
      if (count > 0) chips.push(`${count} case${count === 1 ? '' : 's'}`);
      const op = String(data['operation'] ?? '');
      if (op === 'INJECTION') chips.push('Injection');
      else if (op === 'DISTRIBUTION') chips.push('Distribution');
      const actor = item.triggeredBy ?? data['zmName'];
      if (actor) chips.push(`by ${actor}`);
      return chips;
    }

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

  // ── Time ─────────────────────────────────────────────────────────────

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

  // ── Action ───────────────────────────────────────────────────────────

  getAlertActionLabel(item: NotificationItem): string | null {
    // Aggregated bulk batch: surface the count so the summary stays the default while still
    // letting the user expand into the detailed case list.
    if (item.eventType === 'CASES_BULK_ASSIGNED_TO_ZM') {
      const count = Number(item.data?.['count'] ?? 0);
      return count > 0 ? `View ${count} case${count === 1 ? '' : 's'}` : 'View cases';
    }

    switch (item.actionType as AlertActionType) {
      case 'OPEN_CASE':                     return 'Open Case';
      case 'OPEN_DPM':
      case 'OPEN_DPM_REQUEST':              return 'Open DPM';
      case 'OPEN_STOCK':
      case 'OPEN_STOCK_PAGE':               return 'View Stock';
      case 'OPEN_PERMISSION_REQUEST':
      case 'OPEN_STOCK_PERMISSION_REQUEST': return 'Review Request';
      case 'OPEN_USER':                     return 'Review User';
      case 'OPEN_THRESHOLDS':
      case 'OPEN_STOCK_THRESHOLDS':         return 'Configure Thresholds';
      case 'OPEN_MATERIAL_RETURN':          return 'View Return';
      default:                              return null;
    }
  }

  handleAction(item: NotificationItem): void {
    this.store.markAsRead(item.id);
    const role = this.authStore.role();
    const data = item.data ?? {};

    switch (item.actionType as AlertActionType) {
      case 'OPEN_CASE':
        this.router.navigate([data['routeHint'] ?? this.defaultCaseRoute(role)]);
        break;
      case 'OPEN_DPM':
      case 'OPEN_DPM_REQUEST':
        this.router.navigate([data['routeHint'] ?? this.defaultDpmRoute(role)]);
        break;
      case 'OPEN_STOCK':
      case 'OPEN_STOCK_PAGE':
        this.router.navigate([data['routeHint'] ?? this.defaultStockRoute(role)]);
        break;
      case 'OPEN_PERMISSION_REQUEST':
      case 'OPEN_STOCK_PERMISSION_REQUEST':
        this.router.navigate([this.permissionRoute(role)]);
        break;
      case 'OPEN_USER':
        this.router.navigate(['/admin/users']);
        break;
      case 'OPEN_THRESHOLDS':
      case 'OPEN_STOCK_THRESHOLDS':
        this.router.navigate(['/zm/stock/thresholds']);
        break;
      case 'OPEN_MATERIAL_RETURN': {
        const returnId = data['returnId'] as string | undefined;
        const returnRoute = this.defaultReturnRoute(role);
        if (returnId) {
          this.router.navigate([returnRoute], { queryParams: { returnId } });
        } else {
          this.router.navigate([returnRoute]);
        }
        break;
      }
    }
  }

  // ── Empty state ──────────────────────────────────────────────────────

  emptyMessage(): { title: string; sub: string } {
    const lf = this.activeLevelFilter();
    const cf = this.activeCategoryFilter();

    if (lf !== 'ALL' && cf !== 'ALL') {
      return { title: `No ${lf.toLowerCase()} ${cf} alerts.`, sub: 'Try adjusting the filters.' };
    }
    if (cf !== 'ALL') {
      return { title: `No ${cf} alerts.`, sub: 'This category is clear.' };
    }
    switch (lf) {
      case 'CRITICAL': return { title: 'No critical alerts.', sub: 'Operations are stable.' };
      case 'WARNING':  return { title: 'No warnings detected.', sub: 'Everything looks good.' };
      case 'INFO':     return { title: 'No information alerts.', sub: "You're all caught up." };
      default:         return { title: 'No alerts yet.', sub: 'Alerts will appear here in real time.' };
    }
  }

  // ── Private routes ───────────────────────────────────────────────────

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

  private defaultReturnRoute(role: string | null): string {
    return role === 'ROLE_ZM' ? '/zm/stock/returns' : '/stt/stock/returns';
  }
}
