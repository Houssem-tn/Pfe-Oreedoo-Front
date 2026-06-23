import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../core/stock/stock.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { TeamDistribution, TeamDistributionStatus } from '../../../core/stock/stock.model';

interface Option { id: string; name: string; }

/**
 * Team-level distribution tracking, shared by Admin (all teams) and ZM (own STTs).
 * DPM-source-independent: every STT→TECH distribution is listed, including new
 * pooled distributions whose legacy dpmId is null (shown as "Historical / Stock").
 */
@Component({
  standalone: true,
  selector: 'app-team-distributions',
  imports: [CommonModule, DatePipe, FormsModule, SpinnerComponent],
  templateUrl: './team-distributions.component.html',
  styleUrls: ['./team-distributions.component.scss']
})
export class TeamDistributionsComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly authStore = inject(AuthStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  rows: TeamDistribution[] = [];
  loading = false;
  error: string | null = null;

  // ── Filters ───────────────────────────────────────────────────────────────
  search = '';
  zmFilter = '';
  sttFilter = '';
  techFilter = '';
  equipmentFilter = '';
  statusFilter: '' | TeamDistributionStatus = '';
  fromFilter = '';
  toFilter = '';

  page = 1;
  readonly pageSize = 20;

  selected: TeamDistribution | null = null;
  detailVisible = false;

  get isAdmin(): boolean { return this.authStore.role() === 'ROLE_ADMIN'; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    const req$ = this.isAdmin
      ? this.stockSvc.adminGetTeamDistributions()
      : this.stockSvc.zmGetTeamDistributions();
    req$
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: rows => { this.rows = rows ?? []; },
        error: e => this.error = e?.error?.message ?? e.message
      });
  }

  // ── Filter option lists (derived from loaded rows) ────────────────────────
  private distinct(map: (r: TeamDistribution) => Option | null): Option[] {
    const seen = new Map<string, string>();
    for (const r of this.rows) {
      const o = map(r);
      if (o?.id) seen.set(o.id, o.name || o.id);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get zmOptions(): Option[] { return this.distinct(r => r.zmId ? { id: r.zmId, name: r.zmName ?? r.zmId } : null); }
  get sttOptions(): Option[] { return this.distinct(r => r.sttId ? { id: r.sttId, name: r.sttName ?? r.sttId } : null); }
  get techOptions(): Option[] { return this.distinct(r => r.techId ? { id: r.techId, name: r.techName ?? r.techId } : null); }
  get equipmentOptions(): Option[] {
    const seen = new Map<string, string>();
    for (const r of this.rows) {
      for (const it of r.items) seen.set(it.equipmentId, it.equipmentName ?? it.equipmentId);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  readonly statusOptions: TeamDistributionStatus[] =
    ['PENDING', 'CONFIRMED', 'PARTIALLY_USED', 'FULLY_USED', 'CANCELLED'];

  // ── Filtering ─────────────────────────────────────────────────────────────
  get filtered(): TeamDistribution[] {
    const q = this.search.trim().toLowerCase();
    const fromTs = this.fromFilter ? new Date(this.fromFilter).getTime() : null;
    const toTs = this.toFilter ? new Date(this.toFilter).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    return this.rows.filter(r => {
      if (this.zmFilter && r.zmId !== this.zmFilter) return false;
      if (this.sttFilter && r.sttId !== this.sttFilter) return false;
      if (this.techFilter && r.techId !== this.techFilter) return false;
      if (this.statusFilter && r.derivedStatus !== this.statusFilter) return false;
      if (this.equipmentFilter && !r.items.some(i => i.equipmentId === this.equipmentFilter)) return false;
      if (fromTs != null && (!r.distributedAt || new Date(r.distributedAt).getTime() < fromTs)) return false;
      if (toTs != null && (!r.distributedAt || new Date(r.distributedAt).getTime() > toTs)) return false;
      if (q) {
        const hay = [
          r.sttName, r.techName, r.zmName,
          ...r.items.map(i => i.equipmentName),
          ...r.items.flatMap(i => i.sources.map(s => s.dpmNumber))
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  get paged(): TeamDistribution[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }
  prevPage(): void { if (this.page > 1) this.page--; }
  nextPage(): void { if (this.page < this.totalPages) this.page++; }
  resetPage(): void { this.page = 1; }

  clearFilters(): void {
    this.search = ''; this.zmFilter = ''; this.sttFilter = ''; this.techFilter = '';
    this.equipmentFilter = ''; this.statusFilter = ''; this.fromFilter = ''; this.toFilter = '';
    this.resetPage();
  }

  // ── Summary metrics (over filtered set) ───────────────────────────────────
  get totalDistributed(): number { return this.filtered.reduce((s, r) => s + r.totalDistributed, 0); }
  get totalUsed(): number { return this.filtered.reduce((s, r) => s + r.totalUsed, 0); }
  get totalRemaining(): number { return this.filtered.reduce((s, r) => s + r.totalRemaining, 0); }
  get historicalCount(): number { return this.filtered.filter(r => r.historical).length; }

  // ── Detail panel ──────────────────────────────────────────────────────────
  open(row: TeamDistribution): void {
    this.selected = row;
    this.detailVisible = true;
    this.cdr.detectChanges();
  }
  closeDetail(): void { this.detailVisible = false; this.selected = null; }

  // ── Presentation helpers ──────────────────────────────────────────────────
  statusLabel(s: TeamDistributionStatus): string {
    return ({
      PENDING: 'Pending', CONFIRMED: 'Confirmed', PARTIALLY_USED: 'Partially Used',
      FULLY_USED: 'Fully Used', CANCELLED: 'Cancelled'
    } as Record<TeamDistributionStatus, string>)[s] ?? s;
  }

  statusColor(s: TeamDistributionStatus): string {
    return ({
      PENDING: 'warning', CONFIRMED: 'info', PARTIALLY_USED: 'primary',
      FULLY_USED: 'success', CANCELLED: 'secondary'
    } as Record<TeamDistributionStatus, string>)[s] ?? 'secondary';
  }

  unitLabel(unit?: string): string {
    if (unit === 'METERS') return 'm';
    if (unit === 'PIECES') return 'pcs';
    return unit?.trim() || 'units';
  }

  qty(n: number, unit?: string): string {
    return unit === 'METERS' ? `${n} m` : `×${n}`;
  }

  itemsSummary(r: TeamDistribution): string {
    return r.items.map(i => `${i.equipmentName ?? i.equipmentId} ${this.qty(i.distributedQuantity, i.unit)}`).join(', ');
  }

  /** Source label for the row: DPM chips, or a clear historical/stock label. */
  sourceSummary(r: TeamDistribution): string {
    if (r.historical) return 'Historical pooled-stock — DPM source unavailable';
    const dpms = this.dpmChips(r);
    if (dpms.length === 0) return 'Pooled stock';
    return dpms.join(', ');
  }

  /** Distinct DPM source numbers attributed to a distribution (for source chips). */
  dpmChips(r: TeamDistribution): string[] {
    const dpms = new Map<string, string>();
    for (const it of r.items) for (const s of it.sources) dpms.set(s.dpmId, s.dpmNumber ?? s.dpmId);
    return [...dpms.values()];
  }

  nameInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}
