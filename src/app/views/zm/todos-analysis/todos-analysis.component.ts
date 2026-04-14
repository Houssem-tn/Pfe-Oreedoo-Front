import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { getStyle } from '@coreui/utils';
import { ChartOptions, TooltipItem } from 'chart.js';
import { finalize } from 'rxjs/operators';

import {
  TodoImportService,
  ZmTodoAnalysisDetailResponse,
  ZmTodoAnalysisListItem,
  ZmTodoAnalyticsAlert,
  ZmTodoAnalyticsGovernorateItem,
  ZmTodoAnalyticsInvalidReason,
  ZmTodoAnalyticsResponse,
  ZmTodoAnalyticsSttItem
} from '../../../core/todo-import/todo-import.service';
import { AppUser } from '../../../core/users/user.model';
import { UserService } from '../../../core/users/user.service';

type ChartViewModel = {
  type: 'bar' | 'pie';
  data?: any;
  options?: any;
};

type KpiCard = {
  label: string;
  value: string;
  hint: string;
  tone: 'primary' | 'info' | 'warning' | 'danger' | 'success' | 'neutral';
  icon: string;
};

type SummaryCard = {
  label: string;
  value: string;
  tone: 'primary' | 'warning' | 'danger' | 'success' | 'neutral';
};

@Component({
  selector: 'app-todos-analysis',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective, ChartjsComponent],
  templateUrl: './todos-analysis.component.html',
  styleUrl: './todos-analysis.component.scss'
})
export class TodosAnalysisComponent implements OnInit {
  private static readonly INVALID_REASON_PAGE_SIZE = 50;

  private readonly todoImportService = inject(TodoImportService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  profile: AppUser | null = null;
  profileLoading = false;
  listLoading = false;
  detailLoading = false;
  errorMessage: string | null = null;
  analyses: ZmTodoAnalysisListItem[] = [];
  selectedAnalysis: ZmTodoAnalysisDetailResponse | null = null;
  analytics: ZmTodoAnalyticsResponse | null = null;
  expandedInvalidReason: string | null = null;
  invalidReasonPage = 1;

  casesBySttChart: ChartViewModel = { type: 'bar' };
  casesByGovernorateChart: ChartViewModel = { type: 'pie' };
  slaByGovernorateChart: ChartViewModel = { type: 'bar' };
  delayedByGovernorateChart: ChartViewModel = { type: 'bar' };

  ngOnInit(): void {
    this.loadProfile();
    this.loadAnalyses();
  }

  get hasAnalytics(): boolean {
    return !!this.analytics;
  }

  get selectedAnalysisId(): string | null {
    return this.selectedAnalysis?.id ?? null;
  }

  get sttBreakdown(): ZmTodoAnalyticsSttItem[] {
    return this.analytics?.sttBreakdown ?? [];
  }

  get governorateBreakdown(): ZmTodoAnalyticsGovernorateItem[] {
    return this.analytics?.governorateBreakdown ?? [];
  }

  get invalidReasonSummaries(): ZmTodoAnalyticsInvalidReason[] {
    return this.analytics?.invalidReasonSummaries ?? [];
  }

  get selectedInvalidReason(): ZmTodoAnalyticsInvalidReason | null {
    if (!this.expandedInvalidReason) {
      return null;
    }

    return this.invalidReasonSummaries.find(item => item.reason === this.expandedInvalidReason) ?? null;
  }

  get invalidReasonPageSize(): number {
    return TodosAnalysisComponent.INVALID_REASON_PAGE_SIZE;
  }

  get paginatedSelectedInvalidReasonCrmCases(): string[] {
    const crmCases = this.selectedInvalidReason?.crmCases ?? [];
    const start = (this.invalidReasonPage - 1) * this.invalidReasonPageSize;
    return crmCases.slice(start, start + this.invalidReasonPageSize);
  }

  get selectedInvalidReasonTotalPages(): number {
    const totalCases = this.selectedInvalidReason?.crmCases.length ?? 0;
    return Math.max(1, Math.ceil(totalCases / this.invalidReasonPageSize));
  }

  get selectedInvalidReasonRangeStart(): number {
    const totalCases = this.selectedInvalidReason?.crmCases.length ?? 0;

    if (totalCases === 0) {
      return 0;
    }

    return ((this.invalidReasonPage - 1) * this.invalidReasonPageSize) + 1;
  }

  get selectedInvalidReasonRangeEnd(): number {
    const totalCases = this.selectedInvalidReason?.crmCases.length ?? 0;
    return Math.min(this.invalidReasonPage * this.invalidReasonPageSize, totalCases);
  }

  get alerts(): ZmTodoAnalyticsAlert[] {
    return this.analytics?.alerts ?? [];
  }

  get insights(): string[] {
    return this.analytics?.insights ?? [];
  }

  get hasGovernorateSlaData(): boolean {
    return this.governorateBreakdown.some(item => item.averageSlaBusinessDays != null);
  }

  get connectedZmName(): string {
    return this.analytics?.connectedZmName
      || this.profile?.fullName?.trim()
      || 'Connected Zone Manager';
  }

  get selectedFileName(): string {
    return this.selectedAnalysis?.sourceFileName || this.analytics?.sourceFileName || '-';
  }

  get selectedUploadedAt(): string | null {
    return this.selectedAnalysis?.uploadedAt ?? null;
  }

  get summaryCards(): SummaryCard[] {
    return [
      {
        label: 'Rows in file',
        value: this.formatMetric(this.analytics?.totalRows ?? 0),
        tone: 'neutral'
      },
      {
        label: 'Matched rows',
        value: this.formatMetric(this.analytics?.matchedRows ?? 0),
        tone: 'primary'
      },
      {
        label: 'Valid rows',
        value: this.formatMetric(this.analytics?.validMatchedRows ?? 0),
        tone: 'success'
      },
      {
        label: 'Invalid rows',
        value: this.formatMetric(this.analytics?.invalidMatchedRows ?? 0),
        tone: 'danger'
      },
      {
        label: 'Ignored rows',
        value: this.formatMetric(this.analytics?.ignoredRows ?? 0),
        tone: 'warning'
      }
    ];
  }

  get kpiCards(): KpiCard[] {
    return [
      {
        label: 'Total Cases',
        value: this.formatMetric(this.analytics?.totalCases ?? 0),
        hint: 'Valid imported rows used in this saved study',
        tone: 'primary',
        icon: 'cilDescription'
      },
      {
        label: 'Average SLA',
        value: this.analytics?.averageSlaBusinessDays != null
          ? `${this.formatMetric(this.analytics.averageSlaBusinessDays)} d`
          : '-',
        hint: `${this.formatMetric(this.analytics?.rowsWithSla ?? 0)} row(s) with valid SLA dates`,
        tone: 'info',
        icon: 'cilClock'
      },
      {
        label: 'Delayed Cases',
        value: `${this.formatMetric(this.analytics?.delayedRate ?? 0)}%`,
        hint: `${this.formatMetric(this.analytics?.delayedCases ?? 0)} delayed case(s)`,
        tone: 'warning',
        icon: 'cilWarning'
      },
      {
        label: 'Gele Cases',
        value: `${this.formatMetric(this.analytics?.geleRate ?? 0)}%`,
        hint: `${this.formatMetric(this.analytics?.geleCases ?? 0)} frozen case(s)`,
        tone: 'danger',
        icon: 'cilBan'
      },
      {
        label: 'STTs Involved',
        value: this.formatMetric(this.analytics?.distinctSttCount ?? 0),
        hint: this.analytics?.topSttName
          ? `${this.analytics.topSttName} is the main STT`
          : 'No STT found yet',
        tone: 'success',
        icon: 'cilPeople'
      },
      {
        label: 'Governorates',
        value: this.formatMetric(this.analytics?.distinctGovernorateCount ?? 0),
        hint: this.analytics?.worstGovernorateName
          ? `${this.analytics.worstGovernorateName} currently needs the most attention`
          : 'No governorate detected yet',
        tone: 'neutral',
        icon: 'cilLocationPin'
      }
    ];
  }

  selectAnalysis(analysisId: string, syncUrl = true): void {
    if (!analysisId) {
      return;
    }

    if (syncUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { analysisId },
        queryParamsHandling: 'merge'
      });
    }

    this.detailLoading = true;
    this.errorMessage = null;

    this.todoImportService.getSavedAnalysis(analysisId)
      .pipe(finalize(() => { this.detailLoading = false; }))
      .subscribe({
        next: (response) => {
          this.selectedAnalysis = response;
          this.analytics = response.analytics;
          this.expandedInvalidReason = response.analytics.invalidReasonSummaries[0]?.reason ?? null;
          this.invalidReasonPage = 1;
          this.buildCharts(response.analytics);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.selectedAnalysis = null;
          this.analytics = null;
          this.expandedInvalidReason = null;
          this.invalidReasonPage = 1;
          this.resetCharts();
          this.errorMessage = err?.error?.message ?? 'Unable to load the saved todo analysis.';
          this.cdr.detectChanges();
        }
      });
  }

  toggleInvalidReason(reason: string): void {
    this.expandedInvalidReason = reason;
    this.invalidReasonPage = 1;
    this.cdr.detectChanges();
  }

  goToInvalidReasonPage(page: number): void {
    if (page < 1 || page > this.selectedInvalidReasonTotalPages || page === this.invalidReasonPage) {
      return;
    }

    this.invalidReasonPage = page;
    this.cdr.detectChanges();
  }

  goToPreviousInvalidReasonPage(): void {
    this.goToInvalidReasonPage(this.invalidReasonPage - 1);
  }

  goToNextInvalidReasonPage(): void {
    this.goToInvalidReasonPage(this.invalidReasonPage + 1);
  }

  trackByCrmCase(index: number, crmCase: string): string {
    return `${index}-${crmCase}`;
  }

  invalidReasonPageTrackBy(_: number, page: number): number {
    return page;
  }

  getInvalidReasonPages(): number[] {
    const totalPages = this.selectedInvalidReasonTotalPages;
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  get visibleInvalidReasonPages(): number[] {
    const pages = this.getInvalidReasonPages();
    const currentIndex = this.invalidReasonPage - 1;
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(pages.length, start + 5);
    const adjustedStart = Math.max(0, end - 5);
    return pages.slice(adjustedStart, end);
  }

  get shouldShowInvalidReasonPagination(): boolean {
    return (this.selectedInvalidReason?.crmCases.length ?? 0) > this.invalidReasonPageSize;
  }

  get totalSelectedInvalidReasonCrmCases(): number {
    return this.selectedInvalidReason?.crmCases.length ?? 0;
  }

  isInvalidReasonPageActive(page: number): boolean {
    return page === this.invalidReasonPage;
  }

  formatMetric(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  alertToneClass(alert: ZmTodoAnalyticsAlert): string {
    switch ((alert.severity ?? '').toLowerCase()) {
      case 'critical':
        return 'todos-analysis-alert--critical';
      case 'warning':
        return 'todos-analysis-alert--warning';
      case 'success':
        return 'todos-analysis-alert--success';
      default:
        return 'todos-analysis-alert--info';
    }
  }

  trackByAnalysis(_: number, item: ZmTodoAnalysisListItem): string {
    return item.id;
  }

  trackByKpi(_: number, item: KpiCard): string {
    return item.label;
  }

  trackBySummary(_: number, item: SummaryCard): string {
    return item.label;
  }

  trackByAlert(_: number, item: ZmTodoAnalyticsAlert): string {
    return `${item.severity}-${item.title}`;
  }

  trackByInsight(_: number, item: string): string {
    return item;
  }

  trackByStt(_: number, item: ZmTodoAnalyticsSttItem): string {
    return item.sttName ?? 'unknown-stt';
  }

  trackByGovernorate(_: number, item: ZmTodoAnalyticsGovernorateItem): string {
    return item.gouvernorat ?? 'unknown-governorate';
  }

  trackByInvalidReason(_: number, item: ZmTodoAnalyticsInvalidReason): string {
    return item.reason;
  }

  private loadProfile(): void {
    this.profileLoading = true;

    this.userService.getMe()
      .pipe(finalize(() => { this.profileLoading = false; }))
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.cdr.detectChanges();
        },
        error: () => {
          this.profile = null;
          this.cdr.detectChanges();
        }
      });
  }

  private loadAnalyses(): void {
    this.listLoading = true;
    this.errorMessage = null;

    this.todoImportService.listSavedAnalyses()
      .pipe(finalize(() => { this.listLoading = false; }))
      .subscribe({
        next: (items) => {
          this.analyses = items;

          if (items.length === 0) {
            this.selectedAnalysis = null;
            this.analytics = null;
            this.expandedInvalidReason = null;
            this.invalidReasonPage = 1;
            this.resetCharts();
            this.cdr.detectChanges();
            return;
          }

          const queryAnalysisId = this.route.snapshot.queryParamMap.get('analysisId');
          const targetId = items.some(item => item.id === queryAnalysisId)
            ? queryAnalysisId!
            : items[0].id;

          this.selectAnalysis(targetId, false);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.analyses = [];
          this.selectedAnalysis = null;
          this.analytics = null;
          this.expandedInvalidReason = null;
          this.invalidReasonPage = 1;
          this.resetCharts();
          this.errorMessage = err?.error?.message ?? 'Unable to load your saved todo analyses.';
          this.cdr.detectChanges();
        }
      });
  }

  private buildCharts(analytics: ZmTodoAnalyticsResponse): void {
    this.casesBySttChart = this.buildHorizontalBarChart(
      analytics.sttBreakdown.map(item => item.sttName || 'Unknown STT'),
      analytics.sttBreakdown.map(item => item.caseCount),
      'Cases per STT',
      '#e30613',
      (value) => `${this.formatMetric(value)} case(s)`
    );

    this.casesByGovernorateChart = this.buildPieChart(
      analytics.governorateBreakdown.map(item => item.gouvernorat || 'Unknown'),
      analytics.governorateBreakdown.map(item => item.caseCount)
    );

    this.slaByGovernorateChart = this.buildHorizontalBarChart(
      analytics.governorateBreakdown
        .filter(item => item.averageSlaBusinessDays != null)
        .map(item => item.gouvernorat || 'Unknown'),
      analytics.governorateBreakdown
        .filter(item => item.averageSlaBusinessDays != null)
        .map(item => item.averageSlaBusinessDays ?? 0),
      'Average SLA by governorate',
      '#ff6b35',
      (value) => `${this.formatMetric(value)} business day(s)`
    );

    this.delayedByGovernorateChart = this.buildVerticalBarChart(
      analytics.governorateBreakdown.map(item => item.gouvernorat || 'Unknown'),
      analytics.governorateBreakdown.map(item => item.delayedRate),
      'Delayed cases by governorate',
      '#f59e0b',
      (value) => `${this.formatMetric(value)}% delayed`
    );
  }

  private resetCharts(): void {
    this.casesBySttChart = { type: 'bar' };
    this.casesByGovernorateChart = { type: 'pie' };
    this.slaByGovernorateChart = { type: 'bar' };
    this.delayedByGovernorateChart = { type: 'bar' };
  }

  private buildHorizontalBarChart(
    labels: string[],
    values: number[],
    label: string,
    color: string,
    tooltipFormatter: (value: number) => string
  ): ChartViewModel {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: this.withAlpha(color, 0.78),
            borderColor: color,
            borderWidth: 1.5,
            borderRadius: 10,
            maxBarThickness: 28
          }
        ]
      },
      options: this.buildBarChartOptions(true, tooltipFormatter)
    };
  }

  private buildVerticalBarChart(
    labels: string[],
    values: number[],
    label: string,
    color: string,
    tooltipFormatter: (value: number) => string
  ): ChartViewModel {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: this.withAlpha(color, 0.78),
            borderColor: color,
            borderWidth: 1.5,
            borderRadius: 10,
            maxBarThickness: 36
          }
        ]
      },
      options: this.buildBarChartOptions(false, tooltipFormatter)
    };
  }

  private buildPieChart(labels: string[], values: number[]): ChartViewModel {
    const backgroundColors = this.buildPieColors(labels.length);

    return {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 8
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(255, 255, 255, 0.14)',
            borderWidth: 1,
            bodyColor: '#f8fafc',
            padding: 12,
            titleColor: '#ffffff',
            callbacks: {
              title: (items: TooltipItem<'pie'>[]) => items[0]?.label ?? '',
              label: (context: TooltipItem<'pie'>) => {
                const value = Number(context.raw ?? 0);
                const total = values.reduce((sum, current) => sum + current, 0);
                const percentage = total > 0 ? (value / total) * 100 : 0;
                return `${this.formatMetric(value)} case(s) - ${this.formatMetric(percentage)}%`;
              }
            }
          }
        }
      } as ChartOptions<'pie'>
    };
  }

  private buildBarChartOptions(
    horizontal: boolean,
    tooltipFormatter: (value: number) => string
  ): ChartOptions<'bar'> {
    const borderColor = getStyle('--cui-border-color-translucent') ?? 'rgba(15, 23, 42, 0.12)';
    const textColor = getStyle('--cui-body-color') ?? '#334155';

    return {
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: 'rgba(255, 255, 255, 0.14)',
          borderWidth: 1,
          bodyColor: '#f8fafc',
          displayColors: false,
          padding: 12,
          titleColor: '#ffffff',
          callbacks: {
            title: (items: TooltipItem<'bar'>[]) => items[0]?.label ?? '',
            label: (context: TooltipItem<'bar'>) => tooltipFormatter(Number(context.raw ?? 0))
          }
        }
      },
      scales: horizontal
        ? {
            x: {
              beginAtZero: true,
              grid: { color: borderColor },
              ticks: {
                color: textColor,
                font: {
                  size: 11,
                  weight: 'normal'
                }
              }
            },
            y: {
              grid: { display: false },
              ticks: {
                autoSkip: false,
                color: '#475569',
                font: {
                  size: 12,
                  weight: 'normal'
                }
              }
            }
          }
        : {
            x: {
              grid: { display: false },
              ticks: {
                autoSkip: false,
                color: textColor,
                font: {
                  size: 11,
                  weight: 'normal'
                }
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: borderColor },
              ticks: {
                color: textColor,
                callback: (value) => `${this.formatMetric(Number(value))}%`
              }
            }
          }
    };
  }

  private withAlpha(hexColor: string, alpha: number): string {
    if (!hexColor.startsWith('#') || (hexColor.length !== 7 && hexColor.length !== 4)) {
      return hexColor;
    }

    const normalized = hexColor.length === 4
      ? `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`
      : hexColor;

    const red = parseInt(normalized.slice(1, 3), 16);
    const green = parseInt(normalized.slice(3, 5), 16);
    const blue = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private buildPieColors(count: number): string[] {
    return Array.from({ length: count }, (_, index) => {
      const hue = Math.round((index * 360) / Math.max(count, 1));
      return `hsl(${hue} 78% 54%)`;
    });
  }
}
