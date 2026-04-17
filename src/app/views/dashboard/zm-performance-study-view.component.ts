import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
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
  ZmPerformanceGovernorateItem,
  ZmPerformanceGovernorateSttItem,
  ZmPerformanceStudyResponse,
  ZmPerformanceSttBreakdownItem
} from '../../core/admin-performance-import/admin-performance-import.service';
import { IChartProps } from './dashboard-charts-data';

type KpiCard = {
  label: string;
  value: string;
  tone: string;
  icon: string;
  hint: string;
};

@Component({
  selector: 'app-zm-performance-study-view',
  standalone: true,
  templateUrl: './zm-performance-study-view.component.html',
  styleUrl: './zm-performance-study-view.component.scss',
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
export class ZmPerformanceStudyViewComponent implements OnChanges {
  @Input() study: ZmPerformanceStudyResponse | null = null;
  @Input() loading = false;
  @Input() emptyTitle = 'No performance data is loaded right now.';
  @Input() emptyMessage = 'Import a batch or select a saved study to see the statistics.';

  selectedGovernorateStudy = '';
  casesBySttChart: IChartProps = { type: 'bar' };
  slaByGovernorateChart: IChartProps = { type: 'bar' };
  casesByGovernorateChart: IChartProps = { type: 'pie' };

  ngOnChanges(): void {
    this.syncSelectedGovernorateStudy();
    this.buildCharts(this.study);
  }

  get hasStudyData(): boolean {
    return (this.study?.totalCases ?? 0) > 0;
  }

  get selectedScopeLabel(): string {
    return this.study?.selectedZoneManager || 'All Zone Managers';
  }

  get sttBreakdown(): ZmPerformanceSttBreakdownItem[] {
    return this.study?.sttBreakdown ?? [];
  }

  get governorateBreakdown(): ZmPerformanceGovernorateItem[] {
    return this.study?.governorateBreakdown ?? [];
  }

  get governorateBreakdownWithSla(): ZmPerformanceGovernorateItem[] {
    return this.governorateBreakdown.filter(item => item.averageSlaBusinessDays != null);
  }

  get hasGovernorateSlaData(): boolean {
    return this.governorateBreakdownWithSla.length > 0;
  }

  get governorateSlaChartHeight(): number {
    const itemCount = this.governorateBreakdownWithSla.length;
    return Math.min(Math.max(itemCount * 34, 320), 760);
  }

  get omittedGovernorateSlaCount(): number {
    return Math.max(0, this.governorateBreakdown.length - this.governorateBreakdownWithSla.length);
  }

  get insights(): string[] {
    return this.study?.insights ?? [];
  }

  get focusedGovernorateStudy(): ZmPerformanceGovernorateItem | null {
    if (this.governorateBreakdown.length === 0) {
      return null;
    }

    return this.governorateBreakdown.find(item => (item.gouvernorat ?? '') === this.selectedGovernorateStudy)
      ?? this.governorateBreakdown[0]
      ?? null;
  }

  get kpiCards(): KpiCard[] {
    return [
      {
        label: 'Total Cases',
        value: this.formatMetric(this.study?.totalCases ?? 0),
        tone: 'primary',
        icon: 'cilDescription',
        hint: 'Imported cases in this saved or current study'
      },
      {
        label: 'Average SLA',
        value: this.study?.rowsWithSla
          ? `${this.formatMetric(this.study.averageSlaBusinessDays)} d`
          : '-',
        tone: 'info',
        icon: 'cilClock',
        hint: `${this.study?.rowsWithSla ?? 0} row(s) with valid SLA dates`
      },
      {
        label: 'STTs Used',
        value: this.formatMetric(this.study?.distinctSttCount ?? 0),
        tone: 'warning',
        icon: 'cilPeople',
        hint: 'Distinct STTs involved in the study'
      },
      {
        label: 'Governorates',
        value: this.formatMetric(this.study?.distinctGovernorateCount ?? 0),
        tone: 'success',
        icon: 'cilLocationPin',
        hint: 'Governorates covered in the study'
      }
    ];
  }

  sttProgressValue(item: ZmPerformanceSttBreakdownItem): number {
    return Math.max(0, Math.min(100, item.percentage));
  }

  governorateSttProgressValue(item: ZmPerformanceGovernorateSttItem): number {
    return Math.max(0, Math.min(100, item.percentage));
  }

  selectGovernorateStudy(governorate: string): void {
    this.selectedGovernorateStudy = governorate;
  }

  trackByStt(_: number, item: ZmPerformanceSttBreakdownItem): string {
    return item.sttName ?? 'unknown-stt';
  }

  trackByGovernorate(_: number, item: ZmPerformanceGovernorateItem): string {
    return item.gouvernorat ?? 'unknown-governorate';
  }

  trackByGovernorateStt(_: number, item: ZmPerformanceGovernorateSttItem): string {
    return item.sttName ?? 'unknown-governorate-stt';
  }

  formatMetric(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private buildCharts(study: ZmPerformanceStudyResponse | null): void {
    this.casesBySttChart = this.buildHorizontalBarChart(
      study?.sttBreakdown.map(item => item.sttName || 'Unassigned') ?? [],
      study?.sttBreakdown.map(item => item.caseCount) ?? [],
      'Cases per STT',
      '#e30613',
      (value) => `${this.formatMetric(value)} case(s)`
    );

    this.slaByGovernorateChart = this.buildHorizontalBarChart(
      study?.governorateBreakdown
        .filter(item => item.averageSlaBusinessDays != null)
        .map(item => item.gouvernorat || 'Unknown') ?? [],
      study?.governorateBreakdown
        .filter(item => item.averageSlaBusinessDays != null)
        .map(item => item.averageSlaBusinessDays ?? 0) ?? [],
      'Average SLA (business days)',
      '#e30613',
      (value) => `${this.formatMetric(value)} business day(s)`
    );

    this.casesByGovernorateChart = this.buildDoughnutChart(
      study?.governorateBreakdown.map(item => item.gouvernorat || 'Unknown') ?? [],
      study?.governorateBreakdown.map(item => item.caseCount) ?? []
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

  private buildVerticalBarChart(labels: string[], values: number[], label: string, color: string): IChartProps {
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
      options: this.buildBarChartOptions(false, (value) => this.formatMetric(value)) as ChartOptions
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
              title: (items) => items[0]?.label ?? '',
              label: (context) => {
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

  private buildBarChartOptions(
    horizontal: boolean,
    tooltipFormatter: (value: number) => string
  ): ChartOptions<'bar'> {
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

  private syncSelectedGovernorateStudy(): void {
    if (this.governorateBreakdown.length === 0) {
      this.selectedGovernorateStudy = '';
      return;
    }

    const matchingSelectedGovernorate = this.study?.selectedGovernorate ?? '';
    const hasCurrentSelection = this.governorateBreakdown.some(
      item => (item.gouvernorat ?? '') === this.selectedGovernorateStudy
    );

    if (hasCurrentSelection) {
      return;
    }

    const preferredSelection = this.governorateBreakdown.find(
      item => (item.gouvernorat ?? '') === matchingSelectedGovernorate
    );

    this.selectedGovernorateStudy = preferredSelection?.gouvernorat
      ?? this.governorateBreakdown[0]?.gouvernorat
      ?? '';
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
