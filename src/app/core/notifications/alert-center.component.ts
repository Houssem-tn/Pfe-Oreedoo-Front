import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerComponent } from '@coreui/angular';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

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
import { ROLE_LABEL_KEYS } from '../i18n/ui-labels';

type Tab            = 'ACTIVE' | 'ARCHIVED';
type LevelFilter    = 'ALL' | AlertLevel;
type CategoryFilter = 'ALL' | AlertCategory;

/** One of the six headline metric tiles. */
interface SummaryCard {
  key:      string;
  count:    number;
  label:    string;
  sublabel: string;
  icon:     string;
  tone:     string;
}

@Component({
  selector: 'app-alert-center',
  standalone: true,
  imports: [IconDirective, SpinnerComponent, TranslocoModule],
  templateUrl: './alert-center.component.html',
  styleUrls: ['./alert-center.component.scss']
})
export class AlertCenterComponent {
  readonly store             = inject(NotificationStoreService);
  private readonly router    = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  // ── View state ────────────────────────────────────────────────────────
  readonly activeLang      = signal(this.transloco.getActiveLang());
  readonly activeTab       = signal<Tab>('ACTIVE');
  readonly searchTerm      = signal('');
  readonly fromDate        = signal('');
  readonly toDate          = signal('');
  readonly typeFilter      = signal<CategoryFilter>('ALL');
  readonly severityFilter  = signal<LevelFilter>('ALL');

  readonly categoryOptions = computed<{ value: CategoryFilter; label: string }[]>(() => {
    this.activeLang();
    return [
      { value: 'ALL',             label: this.t('notifications.alertCenter.filters.allTypes') },
      { value: 'SLA',             label: this.t('notifications.category.sla') },
      { value: 'CASE',            label: this.t('notifications.category.case') },
      { value: 'STOCK',           label: this.t('notifications.category.stock') },
      { value: 'MATERIAL_RETURN', label: this.t('notifications.category.materialReturn') },
      { value: 'DPM',             label: this.t('notifications.category.dpm') },
      { value: 'PERMISSION',      label: this.t('notifications.category.permission') },
      { value: 'USER',            label: this.t('notifications.category.user') },
      { value: 'SYSTEM',          label: this.t('notifications.category.system') },
    ];
  });

  readonly severityOptions = computed<{ value: LevelFilter; label: string }[]>(() => {
    this.activeLang();
    return [
      { value: 'ALL',      label: this.t('notifications.alertCenter.filters.allSeverities') },
      { value: 'CRITICAL', label: this.t('notifications.alertCenter.severity.critical') },
      { value: 'WARNING',  label: this.t('notifications.alertCenter.severity.warning') },
      { value: 'INFO',     label: this.t('notifications.alertCenter.severity.info') },
    ];
  });

  // ── Severity / category counters (scoped to active, unread alerts) ─────
  private readonly activePool = computed(() =>
    this.store.alertsByLevel().filter(n => !n.read)
  );

  readonly criticalCount = computed(() =>
    this.activePool().filter(n => effectiveLevel(n) === 'CRITICAL').length
  );
  readonly warningCount = computed(() =>
    this.activePool().filter(n => effectiveLevel(n) === 'WARNING').length
  );
  readonly infoCount = computed(() =>
    this.activePool().filter(n => effectiveLevel(n) === 'INFO').length
  );

  private readonly categoryCounters = computed(() => {
    const counts: Record<AlertCategory, number> = {
      DPM: 0, STOCK: 0, MATERIAL_RETURN: 0, CASE: 0, PERMISSION: 0, USER: 0, SLA: 0, SYSTEM: 0
    };
    for (const n of this.activePool()) {
      counts[effectiveCategory(n)]++;
    }
    return counts;
  });

  /** The six headline tiles, mirroring the design, driven by live counts. */
  readonly summaryCards = computed<SummaryCard[]>(() => {
    this.activeLang();
    const c = this.categoryCounters();
    return [
      { key: 'critical', count: this.criticalCount(),             label: this.t('notifications.alertCenter.summary.critical.label'), sublabel: this.t('notifications.alertCenter.summary.critical.sublabel'), icon: 'cilXCircle',     tone: 'crit'   },
      { key: 'warning',  count: this.warningCount(),              label: this.t('notifications.alertCenter.summary.warning.label'), sublabel: this.t('notifications.alertCenter.summary.warning.sublabel'), icon: 'cilWarning',     tone: 'warn'   },
      { key: 'returns',  count: c.MATERIAL_RETURN,                label: this.t('notifications.alertCenter.summary.returns.label'), sublabel: this.t('notifications.alertCenter.summary.returns.sublabel'), icon: 'cilReload',      tone: 'info'   },
      { key: 'cases',    count: c.CASE + c.SLA,                   label: this.t('notifications.alertCenter.summary.cases.label'), sublabel: this.t('notifications.alertCenter.summary.cases.sublabel'), icon: 'cilChart',       tone: 'purple' },
      { key: 'team',     count: c.USER + c.PERMISSION,            label: this.t('notifications.alertCenter.summary.team.label'), sublabel: this.t('notifications.alertCenter.summary.team.sublabel'), icon: 'cilPeople',      tone: 'green'  },
      { key: 'urgent',   count: this.store.unreadCriticalCount(), label: this.t('notifications.alertCenter.summary.urgent.label'), sublabel: this.t('notifications.alertCenter.summary.urgent.sublabel'), icon: 'cilLocationPin', tone: 'rose'   },
    ];
  });

  // ── Tab + filter pipeline ─────────────────────────────────────────────
  private readonly tabbedAlerts = computed(() => {
    const archived = this.activeTab() === 'ARCHIVED';
    return this.store.alertsByLevel().filter(n => archived ? n.read : !n.read);
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const sev  = this.severityFilter();
    const cat  = this.typeFilter();
    const from = this.fromDate() ? new Date(this.fromDate()).getTime() : null;
    const to   = this.toDate()   ? new Date(this.toDate()).getTime() + 86_400_000 : null; // inclusive end-of-day

    return this.tabbedAlerts().filter(n => {
      if (sev !== 'ALL' && effectiveLevel(n) !== sev)    return false;
      if (cat !== 'ALL' && effectiveCategory(n) !== cat) return false;

      const t = new Date(n.createdAt).getTime();
      if (from !== null && t < from) return false;
      if (to   !== null && t >= to)  return false;

      if (term) {
        const hay = `${n.title} ${n.message} ${this.cardSubtitle(n)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  });

  readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim() !== '' ||
    this.fromDate() !== '' ||
    this.toDate() !== '' ||
    this.typeFilter() !== 'ALL' ||
    this.severityFilter() !== 'ALL'
  );

  readonly activeCount   = computed(() => this.store.alertsByLevel().filter(n => !n.read).length);
  readonly archivedCount = computed(() => this.store.alertsByLevel().filter(n =>  n.read).length);

  // ── Pagination ────────────────────────────────────────────────────────
  readonly pageSize    = 9 as const;        // 3 rows × 3 columns
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  );

  /** Page index clamped to the valid range — the source of truth for the UI. */
  readonly activePage = computed(() => Math.min(this.currentPage(), this.totalPages()));

  readonly paginated = computed(() => {
    const start = (this.activePage() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly pageRangeLabel = computed(() => {
    this.activeLang();
    const total = this.filtered().length;
    if (total === 0) return this.t('notifications.alertCenter.pager.zeroAlerts');
    const start = (this.activePage() - 1) * this.pageSize + 1;
    const end   = Math.min(this.activePage() * this.pageSize, total);
    return this.t('notifications.alertCenter.pager.range', { start, end, total });
  });

  readonly visiblePages = computed<(number | '...')[]>(() => {
    const total   = this.totalPages();
    const current = this.activePage();
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

  constructor() {
    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lang) => this.activeLang.set(lang));

    // Keep the page in range when the list shrinks (e.g. dismissing the last card on a page).
    effect(() => {
      const tp = this.totalPages();
      if (this.currentPage() > tp) {
        this.currentPage.set(tp);
      }
    });
  }

  goToPage(n: number | '...'): void {
    if (typeof n !== 'number') return;
    this.currentPage.set(Math.max(1, Math.min(n, this.totalPages())));
  }

  // ── State mutators ────────────────────────────────────────────────────
  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  onSearch(value: string): void       { this.searchTerm.set(value);   this.currentPage.set(1); }
  onFromDate(value: string): void     { this.fromDate.set(value);     this.currentPage.set(1); }
  onToDate(value: string): void       { this.toDate.set(value);       this.currentPage.set(1); }
  onType(value: string): void         { this.typeFilter.set(value as CategoryFilter); this.currentPage.set(1); }
  onSeverity(value: string): void     { this.severityFilter.set(value as LevelFilter); this.currentPage.set(1); }

  clearFilters(): void {
    this.searchTerm.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.typeFilter.set('ALL');
    this.severityFilter.set('ALL');
    this.currentPage.set(1);
  }

  trackById(_: number, item: NotificationItem): string {
    return item.id;
  }

  // ── Card visuals ──────────────────────────────────────────────────────

  /** Accent / icon tone keyed off business category for a colourful board. */
  cardTone(item: NotificationItem): string {
    switch (effectiveCategory(item)) {
      case 'SLA':             return 'crit';
      case 'STOCK':           return 'warn';
      case 'MATERIAL_RETURN': return 'info';
      case 'CASE':            return 'purple';
      case 'DPM':             return 'teal';
      case 'PERMISSION':      return 'indigo';
      case 'USER':            return 'green';
      default:                return 'slate';
    }
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
      case 'DPM_EXTERNAL_REJECTED':                      return 'cilStorage';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':                      return 'cilTask';
      case 'CASES_BULK_ASSIGNED_TO_ZM':                  return 'cilLayers';
      case 'USER_REGISTERED':                            return 'cilUser';
      case 'STOCK_DISTRIBUTED':                          return 'cilStorage';
      case 'MATERIAL_RETURN_SUBMITTED':
      case 'MATERIAL_RETURN_REJECTED':
      case 'MATERIAL_RETURN_SCHEDULE_PROPOSED':
      case 'MATERIAL_RETURN_SCHEDULE_CONFIRMED':
      case 'MATERIAL_RETURN_RESCHEDULE_REQUESTED':
      case 'MATERIAL_RETURN_HANDED_OVER':                return 'cilReload';
      case 'MATERIAL_RETURN_CLOSED':                     return 'cilCheckCircle';
      default:                                           return 'cilBell';
    }
  }

  /** Severity pill shown top-right of every card. */
  severityBadge(item: NotificationItem): { label: string; tone: string } {
    switch (effectiveLevel(item)) {
      case 'CRITICAL': return { label: this.t('notifications.alertCenter.severity.critical'), tone: 'crit' };
      case 'WARNING':  return { label: this.t('notifications.alertCenter.severity.warning'), tone: 'warn' };
      default:         return { label: this.t('notifications.alertCenter.severity.info'), tone: 'info' };
    }
  }

  /** Secondary identifier line under the title (case ref / actor / role). */
  cardSubtitle(item: NotificationItem): string {
    this.activeLang();
    const data = item.data ?? {};

    const caseRef = data['caseReference'] ?? data['caseRef'];
    if (caseRef) return this.t('notifications.alertCenter.subtitles.caseNumber', { ref: caseRef });

    const caseId = item.relatedCaseId ?? data['caseId'];
    if (caseId) return this.t('notifications.alertCenter.subtitles.caseNumber', { ref: String(caseId).slice(-8).toUpperCase() });

    const actor = item.triggeredBy ?? data['actorName'] ?? data['triggeredBy'];
    if (actor) return String(actor);

    const zone = data['zone'] ?? data['zoneName'] ?? data['region'];
    if (zone) return String(zone);

    switch (item.targetRole) {
      case 'ROLE_TECH': return this.t('notifications.alertCenter.targetRoles.tech');
      case 'ROLE_STT':  return this.t('notifications.alertCenter.targetRoles.stt');
      case 'ROLE_ZM':   return this.t('notifications.alertCenter.targetRoles.zm');
      case 'ROLE_ADMIN': return this.t(ROLE_LABEL_KEYS.ROLE_ADMIN);
      default:          return this.t('notifications.alertCenter.targetRoles.system');
    }
  }

  // ── Time ──────────────────────────────────────────────────────────────
  getRelativeTime(dateStr: string): string {
    this.activeLang();
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0) return this.t('notifications.alertCenter.relativeTime.now');
    const min = Math.floor(diffMs / 60_000);
    if (min < 1)  return this.t('notifications.alertCenter.relativeTime.now');
    if (min < 60) return this.t('notifications.alertCenter.relativeTime.minutesAgo', { count: min });
    const h = Math.floor(min / 60);
    if (h < 24)   return this.t('notifications.alertCenter.relativeTime.hoursAgo', { count: h });
    const d = Math.floor(h / 24);
    if (d === 1)  return this.t('notifications.alertCenter.relativeTime.yesterday');
    if (d < 7)    return this.t('notifications.alertCenter.relativeTime.daysAgo', { count: d });
    return new DatePipe(this.dateLocale()).transform(dateStr, 'dd MMM') ?? '';
  }

  // ── Actions ───────────────────────────────────────────────────────────

  /** Filled primary button label, derived from the alert's action type. */
  primaryActionLabel(item: NotificationItem): string {
    if (item.eventType === 'CASES_BULK_ASSIGNED_TO_ZM') {
      const count = Number(item.data?.['count'] ?? 0);
      return count > 0
        ? this.t('notifications.alertCenter.actions.viewCasesCount', { count })
        : this.t('notifications.alertCenter.actions.viewCases');
    }
    switch (item.actionType as AlertActionType) {
      case 'OPEN_CASE':                     return this.t('notifications.alertCenter.actions.viewCase');
      case 'OPEN_DPM':
      case 'OPEN_DPM_REQUEST':              return this.t('notifications.alertCenter.actions.openDpm');
      case 'OPEN_STOCK':
      case 'OPEN_STOCK_PAGE':               return this.t('notifications.alertCenter.actions.viewStock');
      case 'OPEN_PERMISSION_REQUEST':
      case 'OPEN_STOCK_PERMISSION_REQUEST': return this.t('notifications.alertCenter.actions.reviewRequest');
      case 'OPEN_USER':                     return this.t('notifications.alertCenter.actions.reviewUser');
      case 'OPEN_THRESHOLDS':
      case 'OPEN_STOCK_THRESHOLDS':         return this.t('notifications.alertCenter.actions.configure');
      case 'OPEN_MATERIAL_RETURN':          return this.t('notifications.alertCenter.actions.viewReturn');
      default:                              return this.t('notifications.alertCenter.actions.open');
    }
  }

  handleAction(item: NotificationItem): void {
    this.store.markAsRead(item.id);
    const role = this.authStore.role();
    const data = item.data ?? {};

    switch (item.actionType as AlertActionType) {
      case 'OPEN_CASE':
        this.navigateToCase(item, role);
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
      default:
        // No navigation target — treat the primary button as an acknowledge.
        break;
    }
  }

  /** Outline secondary button: archive the alert out of the active board. */
  dismiss(item: NotificationItem, event: Event): void {
    event.stopPropagation();
    this.store.markAsRead(item.id);
  }

  // ── Empty state ───────────────────────────────────────────────────────
  emptyMessage(): { title: string; sub: string } {
    if (this.hasActiveFilters()) {
      return {
        title: this.t('notifications.alertCenter.empty.filtered.title'),
        sub: this.t('notifications.alertCenter.empty.filtered.sub')
      };
    }
    if (this.activeTab() === 'ARCHIVED') {
      return {
        title: this.t('notifications.alertCenter.empty.archived.title'),
        sub: this.t('notifications.alertCenter.empty.archived.sub')
      };
    }
    return {
      title: this.t('notifications.alertCenter.empty.active.title'),
      sub: this.t('notifications.alertCenter.empty.active.sub')
    };
  }

  pageRangeLabelText(): string {
    this.activeLang();
    const total = this.filtered().length;
    if (total === 0) {
      return this.t('notifications.alertCenter.pager.zeroAlerts');
    }
    const start = (this.activePage() - 1) * this.pageSize + 1;
    const end = Math.min(this.activePage() * this.pageSize, total);
    return this.t('notifications.alertCenter.pager.range', { start, end, total });
  }

  /**
   * Opens the exact case referenced by an alert. Uses the stable `caseId`
   * (`relatedCaseId` / `data.caseId`) and a role-based board route derived from the
   * case type, passing `focusCaseId` so the board loads the full case by ID and opens
   * it (or shows a controlled error if it no longer exists). Bulk-assignment alerts
   * carry no single case, so they honour their server `routeHint`. We never navigate to
   * the backend's non-role `/cases/...` hint, which is not a real client route.
   */
  private navigateToCase(item: NotificationItem, role: string | null): void {
    const data = item.data ?? {};

    if (item.eventType === 'CASES_BULK_ASSIGNED_TO_ZM') {
      const hint = typeof data['routeHint'] === 'string' ? data['routeHint'] : null;
      this.router.navigate([hint ?? this.defaultCaseRoute(role)]);
      return;
    }

    const caseId = item.relatedCaseId
      ?? (typeof data['caseId'] === 'string' ? (data['caseId'] as string) : null);
    const caseType = typeof data['caseType'] === 'string' ? (data['caseType'] as string).toUpperCase() : '';
    const route = this.caseRouteByType(role, caseType);

    if (caseId) {
      this.router.navigate([route], { queryParams: { focusCaseId: caseId } });
    } else {
      this.router.navigate([route]);
    }
  }

  private caseRouteByType(role: string | null, caseType: string): string {
    if (caseType === 'PLAINTE') {
      switch (role) {
        case 'ROLE_ZM':   return '/zm/cases/complaint';
        case 'ROLE_STT':  return '/stt/cases/complaint';
        case 'ROLE_TECH': return '/tech/cases/complaint';
        default:          return '/admin/cases/complaint';
      }
    }
    return this.defaultCaseRoute(role);
  }

  // ── Default routes ────────────────────────────────────────────────────
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

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  private dateLocale(): string {
    switch (this.activeLang()) {
      case 'ar':
        return 'ar-TN';
      case 'en':
        return 'en-US';
      default:
        return 'fr-TN';
    }
  }
}
