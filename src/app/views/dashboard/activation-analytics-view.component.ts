import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { ChartOptions, TooltipItem } from 'chart.js';
import {
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  GutterDirective,
  ProgressComponent,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { getStyle } from '@coreui/utils';

import {
  AdminActivationAnalyticsAlert,
  AdminActivationAnalyticsBatch,
  AdminActivationAnalyticsCauseItem,
  AdminActivationAnalyticsDashboard,
  AdminActivationAnalyticsGovernorateItem,
  AdminActivationAnalyticsPipelineStage,
  AdminActivationAnalyticsQualitySlice,
  AdminActivationAnalyticsSttItem
} from '../../core/admin-activation-analytics/admin-activation-analytics.service';
import { IChartProps } from './dashboard-charts-data';

type KpiCard = {
  label: string;
  value: string;
  tone: string;
  icon: string;
  hint: string;
};

@Component({
  selector: 'app-activation-analytics-view',
  standalone: true,
  templateUrl: './activation-analytics-view.component.html',
  styleUrl: './zm-performance-study-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    RowComponent,
    ColComponent,
    GutterDirective,
    IconDirective,
    ChartjsComponent,
    TableDirective,
    ProgressComponent
  ]
})
export class ActivationAnalyticsViewComponent implements OnChanges {
  @Input() dashboard: AdminActivationAnalyticsDashboard | null = null;
  @Input() loading = false;
  @Input() chartsLoading = false;
  @Input() emptyTitle = 'No activation analytics are loaded right now.';
  @Input() emptyMessage = 'Import a CSV/XLS/XLSX activation dataset to generate the global admin analytics workspace.';

  sttVolumeChart: IChartProps = { type: 'bar' };
  governorateSlaChart: IChartProps = { type: 'bar' };
  governorateVolumeChart: IChartProps = { type: 'pie' };
  pipelineDelayChart: IChartProps = { type: 'bar' };

  ngOnChanges(): void {
    this.buildCharts(this.dashboard);
  }

  get hasDashboardData(): boolean {
    return (this.dashboard?.kpis.totalCases ?? 0) > 0;
  }

  get latestBatch(): AdminActivationAnalyticsBatch | null {
    return this.dashboard?.latestBatch ?? null;
  }

  get sttRanking(): AdminActivationAnalyticsSttItem[] {
    return this.dashboard?.sttRanking ?? [];
  }

  get sttWorkload(): AdminActivationAnalyticsSttItem[] {
    return [...this.sttRanking]
      .sort((left, right) => right.caseCount - left.caseCount || left.sttName.localeCompare(right.sttName))
      .slice(0, 8);
  }

  get governorateBreakdown(): AdminActivationAnalyticsGovernorateItem[] {
    return this.dashboard?.governorateBreakdown ?? [];
  }

  get governorateSlaBreakdown(): AdminActivationAnalyticsGovernorateItem[] {
    return [...this.governorateBreakdown]
      .filter(item => item.averageEndToEndSla != null)
      .sort((left, right) => (right.averageEndToEndSla ?? 0) - (left.averageEndToEndSla ?? 0));
  }

  get pipelineStages(): AdminActivationAnalyticsPipelineStage[] {
    return this.dashboard?.pipelineStages ?? [];
  }

  get topInjoignabiliteCauses(): AdminActivationAnalyticsCauseItem[] {
    return this.dashboard?.topInjoignabiliteCauses ?? [];
  }

  get topAbandonCauses(): AdminActivationAnalyticsCauseItem[] {
    return this.dashboard?.topAbandonCauses ?? [];
  }

  get qualityByStt(): AdminActivationAnalyticsQualitySlice[] {
    return this.dashboard?.qualityByStt ?? [];
  }

  get qualityByGovernorate(): AdminActivationAnalyticsQualitySlice[] {
    return this.dashboard?.qualityByGovernorate ?? [];
  }

  get alerts(): AdminActivationAnalyticsAlert[] {
    return this.dashboard?.alerts ?? [];
  }

  get insights(): string[] {
    return this.dashboard?.insights ?? [];
  }

  get kpiCards(): KpiCard[] {
    const kpis = this.dashboard?.kpis;
    if (!kpis) {
      return [];
    }

    return [
      {
        label: 'Total Cases',
        value: this.formatMetric(kpis.totalCases),
        tone: 'primary',
        icon: 'cilDescription',
        hint: 'Valid activation cases currently driving analytics'
      },
      {
        label: 'Completion Rate',
        value: `${this.formatMetric(kpis.completedCasesPercentage)}%`,
        tone: 'success',
        icon: 'cilCheckCircle',
        hint: 'Cases marked as completed by work execution signals'
      },
      {
        label: 'Avg Assignment SLA',
        value: this.formatDays(kpis.averageAssignmentSla),
        tone: 'info',
        icon: 'cilClock',
        hint: 'Opening to STT assignment business-day average'
      },
      {
        label: 'Avg RDV Delay',
        value: this.formatDays(kpis.averageRdvDelay),
        tone: 'warning',
        icon: 'cilCalendar',
        hint: 'Assignment to RDV business-day average'
      },
      {
        label: 'Avg Execution SLA',
        value: this.formatDays(kpis.averageExecutionSla),
        tone: 'warning',
        icon: 'cilBolt',
        hint: 'RDV to execution finish business-day average'
      },
      {
        label: 'End-to-End SLA',
        value: this.formatDays(kpis.averageEndToEndSla),
        tone: 'danger',
        icon: 'cilSpeedometer',
        hint: 'Opening to completion business-day average'
      },
      {
        label: 'Delayed Cases',
        value: `${this.formatMetric(kpis.delayedCasesPercentage)}%`,
        tone: 'danger',
        icon: 'cilWarning',
        hint: 'Cases breaching the defined delay thresholds'
      },
      {
        label: 'Blocked Cases',
        value: `${this.formatMetric(kpis.blockedCasesPercentage)}%`,
        tone: 'secondary',
        icon: 'cilBan',
        hint: 'Cases showing gelé / blocked status signals'
      },
      {
        label: 'Injoignable Rate',
        value: `${this.formatMetric(kpis.injoignableRate)}%`,
        tone: 'info',
        icon: 'cilPhoneSlash',
        hint: 'Cases impacted by reachability problems'
      },
      {
        label: 'Coverage',
        value: `${this.formatMetric(kpis.sttCount)} STT / ${this.formatMetric(kpis.governorateCount)} Gov`,
        tone: 'primary',
        icon: 'cilGlobeAlt',
        hint: 'Distinct STTs and governorates included'
      }
    ];
  }

  progressValue(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  formatMetric(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDays(value: number | null | undefined): string {
    return value == null ? '-' : `${this.formatMetric(value)} d`;
  }

  trackByStt(_: number, item: AdminActivationAnalyticsSttItem): string {
    return item.sttName;
  }

  trackByGovernorate(_: number, item: AdminActivationAnalyticsGovernorateItem): string {
    return item.gouvernorat;
  }

  trackByBatch(_: number, item: AdminActivationAnalyticsBatch): string {
    return item.batchId;
  }

  trackByCause(_: number, item: AdminActivationAnalyticsCauseItem): string {
    return item.cause;
  }

  trackByQualitySlice(_: number, item: AdminActivationAnalyticsQualitySlice): string {
    return item.label;
  }

  trackByStage(_: number, item: AdminActivationAnalyticsPipelineStage): string {
    return item.stageKey;
  }

  trackByAlert(_: number, item: AdminActivationAnalyticsAlert): string {
    return `${item.severity}-${item.title}`;
  }

  private buildCharts(dashboard: AdminActivationAnalyticsDashboard | null): void {
    this.sttVolumeChart = this.buildHorizontalBarChart(
      this.sttWorkload.map(item => item.sttName || 'Unassigned'),
      this.sttWorkload.map(item => item.caseCount),
      'Cases per STT',
      '#e30613',
      value => `${this.formatMetric(value)} case(s)`
    );

    this.governorateSlaChart = this.buildHorizontalBarChart(
      this.governorateSlaBreakdown.map(item => item.gouvernorat || 'Unknown'),
      this.governorateSlaBreakdown.map(item => item.averageEndToEndSla ?? 0),
      'Average end-to-end SLA',
      '#d97706',
      value => `${this.formatMetric(value)} business day(s)`
    );

    this.governorateVolumeChart = this.buildDoughnutChart(
      (dashboard?.governorateBreakdown ?? []).slice(0, 8).map(item => item.gouvernorat || 'Unknown'),
      (dashboard?.governorateBreakdown ?? []).slice(0, 8).map(item => item.caseCount)
    );

    this.pipelineDelayChart = this.buildVerticalBarChart(
      this.pipelineStages.map(item => item.label),
      this.pipelineStages.map(item => item.averageBusinessDays ?? 0),
      'Average business days',
      '#0f766e',
      value => `${this.formatMetric(value)} day(s)`
    );
  }

  private buildHorizontalBarChart(
    labels: string[],
    values: number[],
    label: string,
    color: string,
    tooltipFormatter: (value: number) => string
  ): IChartProps {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: this.withAlpha(color, 0.75),
            borderColor: color,
            borderWidth: 1.5,
            borderRadius: 10,
            maxBarThickness: 28
          }
        ]
      },
      options: this.buildBarChartOptions(true, tooltipFormatter) as ChartOptions
    };
  }

  private buildVerticalBarChart(
    labels: string[],
    values: number[],
    label: string,
    color: string,
    tooltipFormatter: (value: number) => string
  ): IChartProps {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: this.withAlpha(color, 0.75),
            borderColor: color,
            borderWidth: 1.5,
            borderRadius: 10,
            maxBarThickness: 36
          }
        ]
      },
      options: this.buildBarChartOptions(false, tooltipFormatter) as ChartOptions
    };
  }

  private buildDoughnutChart(labels: string[], values: number[]): IChartProps {
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
              title: items => items[0]?.label ?? '',
              label: context => {
                const value = Number(context.raw ?? 0);
                const total = values.reduce((sum, current) => sum + current, 0);
                const percentage = total > 0 ? (value / total) * 100 : 0;
                return `${this.formatMetric(value)} case(s) - ${this.formatMetric(percentage)}%`;
              }
            }
          }
        }
      } as ChartOptions
    };
  }

  private buildBarChartOptions(horizontal: boolean, tooltipFormatter: (value: number) => string): ChartOptions<'bar'> {
    const borderColor = getStyle('--cui-border-color-translucent') ?? 'rgba(15, 23, 42, 0.12)';
    const textColor = getStyle('--cui-body-color') ?? '#334155';

    return {
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      layout: {
        padding: {
          right: horizontal ? 8 : 0
        }
      },
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
                color: textColor
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: borderColor },
              ticks: {
                color: textColor
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
    const palette = ['#e30613', '#f97316', '#0f766e', '#0ea5e9', '#8b5cf6', '#84cc16', '#475569', '#f59e0b'];
    return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
  }
}
