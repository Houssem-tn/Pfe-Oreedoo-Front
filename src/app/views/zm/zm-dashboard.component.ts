import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { SpinnerComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ChartData } from 'chart.js';
import { finalize } from 'rxjs/operators';

import { ZmDashboardService } from '../../core/zm-dashboard/zm-dashboard.service';
import {
  ZmActionGroup,
  ZmDashboardResponse,
  ZmSttPerformance
} from '../../core/zm-dashboard/zm-dashboard.model';
import {
  OOREDDOO_CHART_COLORS,
  buildBarChartOptions,
  buildDonutChartOptions,
  buildTrendChartOptions,
  withAlpha
} from '../../shared/charts/ooredoo-chart-theme';
import { ZmZoneMapComponent } from './zone-map/zm-zone-map.component';

type Tone = 'primary' | 'info' | 'warning' | 'danger' | 'success' | 'neutral';

interface KpiCard {
  label: string;
  value: number;
  icon: string;
  tone: Tone;
  link?: string;
  query?: Record<string, string>;
}

interface ActionCard {
  key: string;
  title: string;
  icon: string;
  tone: Tone;
  group: ZmActionGroup;
  link: string;
  query?: Record<string, string>;
}

interface ChartVM {
  type: 'doughnut' | 'bar' | 'line';
  data: ChartData;
  options: any;
}

@Component({
  selector: 'app-zm-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective, ChartjsComponent, SpinnerComponent, ZmZoneMapComponent],
  templateUrl: './zm-dashboard.component.html',
  styleUrl: './zm-dashboard.component.scss'
})
export class ZmDashboardComponent implements OnInit {
  private readonly service = inject(ZmDashboardService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<ZmDashboardResponse | null>(null);

  statusDonut: ChartVM | null = null;
  sttBar: ChartVM | null = null;
  overdueBar: ChartVM | null = null;
  completionLine: ChartVM | null = null;
  stockBar: ChartVM | null = null;
  governorateBar: ChartVM | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.buildCharts(res);
        },
        error: (err) => {
          console.error('Failed to load ZM dashboard', err);
          this.error.set(err?.error?.message ?? 'Unable to load your dashboard right now.');
        }
      });
  }

  // ── Derived view models ──────────────────────────────────────────────────────

  get isEmpty(): boolean {
    const d = this.data();
    return !!d && d.kpis.totalCases === 0 && d.stockOverview.dpmCreated === 0
      && d.todoImportStats.length === 0 && d.sttPerformance.length === 0;
  }

  get kpiCards(): KpiCard[] {
    const k = this.data()?.kpis;
    if (!k) return [];
    return [
      { label: 'Total Cases', value: k.totalCases, icon: 'cilFolder', tone: 'primary', link: '/zm/cases/activation' },
      { label: 'Pending', value: k.pending, icon: 'cilInbox', tone: 'warning', link: '/zm/cases/activation', query: { status: 'ASSIGNED_TO_ZM' } },
      { label: 'Assigned to STT', value: k.assignedStt, icon: 'cilPeople', tone: 'info', link: '/zm/cases/activation', query: { status: 'ASSIGNED_TO_STT' } },
      { label: 'Assigned to TECH', value: k.assignedTech, icon: 'cilUser', tone: 'info', link: '/zm/cases/activation', query: { status: 'ASSIGNED_TO_TECH' } },
      { label: 'In Progress', value: k.inProgress, icon: 'cilLoopCircular', tone: 'info' },
      { label: 'Work Done', value: k.workDone, icon: 'cilCheck', tone: 'success', link: '/zm/cases/activation', query: { status: 'WORK_DONE' } },
      { label: 'Waiting Validation', value: k.waitingValidation, icon: 'cilTask', tone: 'warning', link: '/zm/cases/complaint', query: { status: 'RESOLUTION_SUBMITTED' } },
      { label: 'Closed', value: k.closed, icon: 'cilLockLocked', tone: 'neutral', link: '/zm/cases/activation', query: { status: 'CLOSED' } },
      { label: 'Overdue SLA', value: k.overdueSla, icon: 'cilWarning', tone: 'danger' },
      { label: 'Active STTs', value: k.activeStts, icon: 'cilGroup', tone: 'primary', link: '/zm/my-team' },
      { label: 'Open DPMs', value: k.openDpms, icon: 'cilStorage', tone: 'info', link: '/zm/stock/my-tracking' },
      { label: 'Pending Returns', value: k.pendingReturns, icon: 'cilArrowThickFromRight', tone: 'warning', link: '/zm/stock/returns' }
    ];
  }

  get actionCards(): ActionCard[] {
    const a = this.data()?.actionItems;
    if (!a) return [];
    return [
      { key: 'assign', title: 'Waiting STT assignment', icon: 'cilUserFollow', tone: 'warning', group: a.waitingAssignment, link: '/zm/cases/activation', query: { status: 'ASSIGNED_TO_ZM' } },
      { key: 'validate', title: 'Waiting your validation', icon: 'cilTask', tone: 'primary', group: a.waitingValidation, link: '/zm/cases/complaint', query: { status: 'RESOLUTION_SUBMITTED' } },
      { key: 'overdue', title: 'Overdue cases', icon: 'cilWarning', tone: 'danger', group: a.overdue, link: '/zm/cases/activation' },
      { key: 'returns', title: 'Returns awaiting approval', icon: 'cilArrowThickFromRight', tone: 'info', group: a.pendingReturns, link: '/zm/stock/returns' },
      { key: 'dpm', title: 'DPMs needing follow-up', icon: 'cilStorage', tone: 'info', group: a.dpmFollowUp, link: '/zm/stock/my-tracking' },
      { key: 'imei', title: 'Missing IMEI / Serial', icon: 'cilTags', tone: 'warning', group: a.missingImeiSerial, link: '/zm/stock/unit-tracking' },
      { key: 'stock', title: 'Stock anomalies', icon: 'cilChartLine', tone: 'danger', group: a.stockAnomalies, link: '/zm/stock/team-stock' }
    ];
  }

  get totalActionCount(): number {
    return this.actionCards.reduce((sum, c) => sum + (c.group?.count ?? 0), 0);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  openKpi(card: KpiCard): void {
    if (!card.link) return;
    this.router.navigate([card.link], card.query ? { queryParams: card.query } : {});
  }

  openStt(): void {
    this.router.navigate(['/zm/my-team']);
  }

  // ── Formatting helpers ───────────────────────────────────────────────────────

  statusLabel(status: string): string {
    return (status ?? '')
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  alertTone(level: string | null): Tone {
    switch ((level ?? '').toUpperCase()) {
      case 'CRITICAL': return 'danger';
      case 'WARNING': return 'warning';
      case 'SUCCESS': return 'success';
      default: return 'info';
    }
  }

  slaTone(percent: number): Tone {
    if (percent >= 85) return 'success';
    if (percent >= 60) return 'warning';
    return 'danger';
  }

  trackByStt(_: number, row: ZmSttPerformance): string {
    return row.sttId;
  }

  // ── Charts ───────────────────────────────────────────────────────────────────

  private buildCharts(d: ZmDashboardResponse): void {
    this.statusDonut = this.buildStatusDonut(d);
    this.sttBar = this.buildSttBar(d);
    this.overdueBar = this.buildOverdueBar(d);
    this.completionLine = this.buildCompletionLine(d);
    this.stockBar = this.buildStockBar(d);
    this.governorateBar = this.buildGovernorateBar(d);
  }

  private statusColor(status: string): string {
    const c = OOREDDOO_CHART_COLORS;
    const map: Record<string, string> = {
      CREATED: c.neutralGray,
      ASSIGNED_TO_ZM: c.warningOrange,
      ASSIGNED_TO_STT: c.infoBlue,
      ASSIGNED_TO_TECH: c.purple,
      RDV_SET: c.infoBlue,
      NOT_REACHABLE: c.neutralGray,
      DIAGNOSIS_STEP: c.infoBlue,
      WORK_DONE: c.successGreen,
      RESOLUTION_SUBMITTED: c.successGreen,
      VALIDATED_BY_ZM: c.successGreen,
      REJECTED_BY_ZM: c.criticalRed,
      RETURNED_TO_STT: c.warningOrange,
      REOPENED: c.warningOrange,
      ESCALATED: c.criticalRed,
      ABANDONED: c.neutralGray,
      CLOSED: c.deepRed
    };
    return map[status] ?? c.neutralGray;
  }

  private buildStatusDonut(d: ZmDashboardResponse): ChartVM {
    const rows = d.casesByStatus.filter(s => s.count > 0);
    return {
      type: 'doughnut',
      data: {
        labels: rows.map(s => this.statusLabel(s.status)),
        datasets: [{
          data: rows.map(s => s.count),
          backgroundColor: rows.map(s => this.statusColor(s.status)),
          borderWidth: 0
        }]
      },
      options: buildDonutChartOptions({
        tooltipFormatter: (label, value, total) =>
          `${label}: ${value} (${total ? Math.round((value / total) * 100) : 0}%)`
      })
    };
  }

  private topStts(d: ZmDashboardResponse, by: (s: ZmSttPerformance) => number, limit = 10): ZmSttPerformance[] {
    return [...d.sttPerformance].filter(s => by(s) > 0).sort((a, b) => by(b) - by(a)).slice(0, limit);
  }

  private sttLabel(s: ZmSttPerformance): string {
    return s.sttName || s.sttEmail || s.sttId;
  }

  private buildSttBar(d: ZmDashboardResponse): ChartVM {
    const rows = this.topStts(d, s => s.assigned);
    return {
      type: 'bar',
      data: {
        labels: rows.map(s => this.sttLabel(s)),
        datasets: [{
          data: rows.map(s => s.assigned),
          backgroundColor: OOREDDOO_CHART_COLORS.primaryRed,
          borderRadius: 6,
          maxBarThickness: 26
        }]
      },
      options: buildBarChartOptions({ horizontal: true })
    };
  }

  private buildOverdueBar(d: ZmDashboardResponse): ChartVM {
    const rows = this.topStts(d, s => s.late);
    return {
      type: 'bar',
      data: {
        labels: rows.map(s => this.sttLabel(s)),
        datasets: [{
          data: rows.map(s => s.late),
          backgroundColor: OOREDDOO_CHART_COLORS.criticalRed,
          borderRadius: 6,
          maxBarThickness: 26
        }]
      },
      options: buildBarChartOptions({ horizontal: true })
    };
  }

  private buildCompletionLine(d: ZmDashboardResponse): ChartVM {
    const rows = d.completionTrend;
    return {
      type: 'line',
      data: {
        labels: rows.map(p => p.date),
        datasets: [{
          data: rows.map(p => p.completed),
          borderColor: OOREDDOO_CHART_COLORS.successGreen,
          backgroundColor: withAlpha(OOREDDOO_CHART_COLORS.successGreen, 0.15),
          fill: true,
          borderWidth: 2
        }]
      },
      options: buildTrendChartOptions({ tooltipFormatter: (v) => `${v} completed` })
    };
  }

  private buildStockBar(d: ZmDashboardResponse): ChartVM {
    const s = d.stockOverview;
    const c = OOREDDOO_CHART_COLORS;
    return {
      type: 'bar',
      data: {
        labels: ['Received', 'Distributed', 'Consumed', 'Returned', 'Recoverable'],
        datasets: [{
          data: [s.materialReceivedByStt, s.materialDistributed, s.materialConsumed, s.materialReturned, s.recoverable],
          backgroundColor: [c.infoBlue, c.purple, c.warningOrange, c.primaryRed, c.successGreen],
          borderRadius: 6,
          maxBarThickness: 48
        }]
      },
      options: buildBarChartOptions({})
    };
  }

  private buildGovernorateBar(d: ZmDashboardResponse): ChartVM {
    const rows = [...d.governorateStats].slice(0, 12);
    return {
      type: 'bar',
      data: {
        labels: rows.map(g => g.governorate),
        datasets: [{
          data: rows.map(g => g.total),
          backgroundColor: OOREDDOO_CHART_COLORS.deepRed,
          borderRadius: 6,
          maxBarThickness: 26
        }]
      },
      options: buildBarChartOptions({ horizontal: true, maxTicksLimit: 6 })
    };
  }
}
