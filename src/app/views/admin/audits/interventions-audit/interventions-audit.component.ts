import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { InterventionAuditService } from '../../../../core/intervention-audit/intervention-audit.service';
import {
  InterventionAudit,
  InterventionAuditEvent,
  InterventionAuditFilters,
  InterventionAuditSummary
} from '../../../../core/intervention-audit/intervention-audit.model';

@Component({
  standalone: true,
  selector: 'app-interventions-audit',
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, SpinnerComponent],
  templateUrl: './interventions-audit.component.html',
  styleUrls: ['./interventions-audit.component.scss']
})
export class InterventionsAuditComponent implements OnInit {
  private readonly auditSvc = inject(InterventionAuditService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  readonly statusOptions = [
    'CREATED', 'ASSIGNED_TO_ZM', 'ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH', 'RDV_SET',
    'NOT_REACHABLE', 'ABANDONED', 'DIAGNOSIS_STEP', 'ESCALATED', 'WORK_DONE',
    'RESOLUTION_SUBMITTED', 'VALIDATED_BY_ZM', 'REJECTED_BY_ZM', 'RETURNED_TO_STT',
    'REOPENED', 'CLOSED'
  ];

  readonly eventTypeOptions = [
    'CASE_CREATED', 'ASSIGNMENT_UPDATED', 'STATUS_CHANGED', 'RDV_UPDATED',
    'DIAGNOSIS_UPDATED', 'WORK_UPDATED', 'STOCK_CONSUMED', 'ZM_VALIDATION',
    'CASE_REOPENED', 'CASE_CLOSED', 'SLA_WARNING', 'SLA_BREACHED', 'SLA_ESCALATED'
  ];

  // ── Filters ───────────────────────────────────────────────────────────────
  search = '';
  moduleFilter = '';
  statusFilter = '';
  eventTypeFilter = '';
  slaFilter = '';
  proofFilter = '';
  governorate = '';
  technician = '';
  from = '';
  to = '';
  sort = '';

  page = 0;
  readonly size = 25;

  // ── Data ──────────────────────────────────────────────────────────────────
  audits: InterventionAudit[] = [];
  totalElements = 0;
  totalPages = 0;
  summary: InterventionAuditSummary | null = null;

  loading = false;
  error: string | null = null;

  selected: InterventionAudit | null = null;
  drawerVisible = false;

  private readonly searchTrigger = new Subject<void>();

  ngOnInit(): void {
    this.searchTrigger.pipe(debounceTime(350)).subscribe(() => this.reload());
    this.loadSummary();
    this.reload();
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  private buildFilters(): InterventionAuditFilters {
    return {
      search: this.search.trim() || undefined,
      module: this.moduleFilter || undefined,
      status: this.statusFilter || undefined,
      eventType: this.eventTypeFilter || undefined,
      slaStatus: this.slaFilter || undefined,
      proofStatus: this.proofFilter || undefined,
      governorate: this.governorate.trim() || undefined,
      technician: this.technician.trim() || undefined,
      from: this.from ? new Date(this.from + 'T00:00:00').toISOString() : undefined,
      to: this.to ? new Date(this.to + 'T23:59:59.999').toISOString() : undefined,
      sort: this.sort || undefined,
      page: this.page,
      size: this.size
    };
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.auditSvc.getAudits(this.buildFilters())
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: pageData => {
          this.audits = pageData.content ?? [];
          this.totalElements = pageData.totalElements ?? 0;
          this.totalPages = pageData.totalPages ?? 0;
        },
        error: e => { this.error = e?.message ?? 'Failed to load intervention audits'; }
      });
  }

  loadSummary(): void {
    this.auditSvc.getSummary().subscribe({
      next: s => { this.summary = s; this.zone.run(() => this.cdr.detectChanges()); },
      error: () => { /* summary is non-blocking */ }
    });
  }

  // ── Filter handlers ───────────────────────────────────────────────────────

  onFilterChange(): void {
    this.page = 0;
    this.reload();
  }

  onSearchChange(): void {
    this.page = 0;
    this.searchTrigger.next();
  }

  clearFilters(): void {
    this.search = '';
    this.moduleFilter = '';
    this.statusFilter = '';
    this.eventTypeFilter = '';
    this.slaFilter = '';
    this.proofFilter = '';
    this.governorate = '';
    this.technician = '';
    this.from = '';
    this.to = '';
    this.sort = '';
    this.page = 0;
    this.reload();
  }

  get hasActiveFilters(): boolean {
    return !!(this.search || this.moduleFilter || this.statusFilter || this.eventTypeFilter ||
      this.slaFilter || this.proofFilter || this.governorate || this.technician || this.from || this.to);
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  prevPage(): void { if (this.page > 0) { this.page--; this.reload(); } }
  nextPage(): void { if (this.page < this.totalPages - 1) { this.page++; this.reload(); } }

  get rangeStart(): number { return this.totalElements === 0 ? 0 : this.page * this.size + 1; }
  get rangeEnd(): number { return Math.min((this.page + 1) * this.size, this.totalElements); }

  // ── Drawer ────────────────────────────────────────────────────────────────

  openDrawer(item: InterventionAudit): void {
    this.selected = item;
    this.drawerVisible = true;
    this.cdr.detectChanges();
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.selected = null;
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  statusLabel(status?: string): string {
    return status ? this.prettyEnum(status) : '—';
  }

  /** Maps a CaseStatus to a colour group used by the status badge. */
  statusGroup(status?: string): string {
    switch (status) {
      case 'CLOSED':
      case 'VALIDATED_BY_ZM':
        return 'done';
      case 'WORK_DONE':
      case 'RESOLUTION_SUBMITTED':
        return 'pending';
      case 'REJECTED_BY_ZM':
      case 'RETURNED_TO_STT':
      case 'ABANDONED':
      case 'NOT_REACHABLE':
      case 'ESCALATED':
      case 'REOPENED':
        return 'alert';
      case 'RDV_SET':
      case 'DIAGNOSIS_STEP':
        return 'progress';
      default:
        return 'open';
    }
  }

  slaLabel(category?: string): string {
    switch (category) {
      case 'ON_TIME': return 'On time';
      case 'WARNING': return 'Warning';
      case 'BREACHED': return 'Breached';
      default: return '—';
    }
  }

  eventTypeLabel(eventType?: string): string {
    if (!eventType) return '—';
    const m: Record<string, string> = {
      CASE_CREATED: 'Case created',
      ASSIGNMENT_UPDATED: 'Assignment',
      STATUS_CHANGED: 'Status change',
      RDV_UPDATED: 'RDV updated',
      DIAGNOSIS_UPDATED: 'Diagnosis',
      WORK_UPDATED: 'Field work',
      STOCK_CONSUMED: 'Material consumed',
      ZM_VALIDATION: 'ZM validation',
      CASE_REOPENED: 'Reopened',
      CASE_CLOSED: 'Closed',
      SLA_WARNING: 'SLA warning',
      SLA_BREACHED: 'SLA breached',
      SLA_ESCALATED: 'Escalated'
    };
    return m[eventType] ?? this.prettyEnum(eventType);
  }

  /** Icon key for a timeline event (resolved in the template via @switch). */
  eventIcon(ev: InterventionAuditEvent): string {
    if (ev.proofFileId) return 'proof';
    switch (ev.eventType) {
      case 'CASE_CREATED': return 'created';
      case 'ASSIGNMENT_UPDATED':
        if (ev.targetRole === 'ZM') return 'zm';
        if (ev.targetRole === 'STT') return 'stt';
        if (ev.targetRole === 'TECH') return 'tech';
        return 'assign';
      case 'RDV_UPDATED': return 'rdv';
      case 'DIAGNOSIS_UPDATED': return 'diagnosis';
      case 'WORK_UPDATED': return 'work';
      case 'STOCK_CONSUMED': return 'material';
      case 'ZM_VALIDATION': return 'validate';
      case 'CASE_CLOSED': return 'close';
      case 'CASE_REOPENED': return 'reopen';
      case 'SLA_WARNING':
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED': return 'sla';
      default: return 'status';
    }
  }

  eventCategory(ev: InterventionAuditEvent): string {
    return (ev.category ?? 'LIFECYCLE').toLowerCase();
  }

  prettyEnum(value?: string | null): string {
    if (!value) return '';
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  nameInitials(name?: string | null): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  hasGps(item: InterventionAudit | null): boolean {
    return !!(item && item.gpsLatitude != null && item.gpsLongitude != null);
  }

  gpsString(item: InterventionAudit): string {
    return `${item.gpsLatitude?.toFixed(5)}, ${item.gpsLongitude?.toFixed(5)}`;
  }

  trackByEventId(_: number, ev: InterventionAuditEvent): string {
    return ev.id ?? String(_);
  }
}
