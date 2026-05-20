import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonDirective,
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
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

import {
  buildTrendChartOptions,
  getSlaColor,
  getSourceColor,
  getStatusColor,
  OOREDDOO_CHART_COLORS,
  withAlpha
} from '../../shared/charts/ooredoo-chart-theme';
import { ChartOptions, Scale, TooltipItem } from 'chart.js';
import {
  AdminMergedAnalyticsService,
  MergedAnalyticsFiltersResponse,
  MergedChartFilters,
  MergedChartsResponse,
  MergedInvalidRowDto,
  MergedInvalidRowsPageResponse,
  MergedStatusResponse,
  MergedStudyListItem,
  MergedSummaryResponse,
  MergedUploadResponse,
  MonthlyTrendPoint
} from '../../core/admin-merged-analytics/admin-merged-analytics.service';
import { SwalService } from '../../core/ui/swal.service';
import { IChartProps } from './dashboard-charts-data';

type WorkspaceView = 'upload' | 'processing' | 'dashboard' | 'studies';

type KpiCard = {
  hint: string;
  label: string;
  tone: 'neutral' | 'success' | 'danger' | 'warning' | 'muted' | 'accent';
  value: string;
};

type ChartPoint = {
  color: string;
  label: string;
  value: number;
};

const DATE_BASIS_OPTIONS = [
  { value: 'DATE_CREATION_CRM', label: 'Date Creation CRM' },
  { value: 'OPENING_DATE_SUR_TIMOS', label: 'Date Ouverture TIMOS' },
  { value: 'DATE_AFFECTATION_STT', label: 'Date Affectation STT' },
  { value: 'DATE_FIN_TRV', label: 'Date Fin Travaux' },
  { value: 'OPEN_DATE_ACTIVATION', label: 'Date Activation' },
  { value: 'date_travaux_resiliation', label: 'Date Travaux Resiliation' }
] as const;

const DEFAULT_SOURCE_OPTIONS = ['MES', 'MSE', 'DMG', 'PLT', 'RES'];

@Component({
  selector: 'app-merged-import-workspace',
  standalone: true,
  templateUrl: './merged-import-workspace.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    RowComponent,
    ColComponent,
    GutterDirective,
    ButtonDirective,
    IconDirective,
    TableDirective,
    ProgressComponent,
    ChartjsComponent
  ]
})
export class MergedImportWorkspaceComponent implements OnInit, OnDestroy {
  private readonly service = inject(AdminMergedAnalyticsService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

  @ViewChild('mergedFileInput') private fileInput?: ElementRef<HTMLInputElement>;

  readonly dateBasisOptions = DATE_BASIS_OPTIONS;
  readonly chartSkeletonCards = [0, 1, 2, 3];
  readonly kpiSkeletonCards = [0, 1, 2, 3, 4, 5];

  readonly filtersForm = this.fb.nonNullable.group({
    source: [''],
    zoneManager: [''],
    stt: [''],
    status: [''],
    gouvernorat: [''],
    dateBasis: ['DATE_CREATION_CRM'],
    dateFrom: [''],
    dateTo: ['']
  });

  view: WorkspaceView = 'upload';
  selectedFile: File | null = null;
  isDragOver = false;

  uploadLoading = false;
  summaryLoading = false;
  chartsLoading = false;
  studiesLoading = false;
  invalidRowsLoading = false;

  currentStudyId: string | null = null;
  currentStudyMeta: MergedStudyListItem | null = null;
  statusResponse: MergedStatusResponse | null = null;
  summary: MergedSummaryResponse | null = null;
  charts: MergedChartsResponse | null = null;
  studies: MergedStudyListItem[] = [];

  invalidRows: MergedInvalidRowDto[] = [];
  invalidPage = 0;
  invalidTotalPages = 0;
  invalidTotalElements = 0;

  filterOptions: MergedAnalyticsFiltersResponse | null = null;
  filterOptionsLoading = false;

  errorMessage: string | null = null;

  sourceDistributionChart: IChartProps = { type: 'doughnut' };
  monthlyTrendChart: IChartProps = { type: 'line' };
  zoneManagerChart: IChartProps = { type: 'bar' };
  sttChart: IChartProps = { type: 'bar' };
  statusDistributionChart: IChartProps = { type: 'doughnut' };
  gouvernoratChart: IChartProps = { type: 'bar' };
  slaCrmChart: IChartProps = { type: 'doughnut' };
  slaTechChart: IChartProps = { type: 'doughnut' };

  private pollSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadStudies();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  get kpiCards(): KpiCard[] {
    if (!this.summary) {
      return [];
    }

    return [
      {
        label: 'Total rows',
        value: this.formatMetric(this.summary.totalRows),
        tone: 'neutral',
        hint: 'Rows parsed from the selected merged import'
      },
      {
        label: 'Valid rows',
        value: this.formatMetric(this.summary.validRows),
        tone: 'success',
        hint: 'Rows available for analytics after validation'
      },
      {
        label: 'Invalid rows',
        value: this.formatMetric(this.summary.invalidRows),
        tone: 'danger',
        hint: 'Rows rejected from analytics because of validation issues'
      },
      {
        label: 'Warnings',
        value: this.formatMetric(this.summary.warningRows),
        tone: 'warning',
        hint: 'Rows imported with warning flags worth reviewing'
      },
      {
        label: 'Duplicates',
        value: this.formatMetric(this.summary.duplicateRows),
        tone: 'muted',
        hint: 'Potential duplicate operation rows detected in the study'
      },
      {
        label: 'Processing time',
        value: this.formatDuration(this.currentStudyDurationMs),
        tone: 'accent',
        hint: 'End-to-end import and study processing runtime'
      }
    ];
  }

  get currentStudyFileName(): string {
    return this.currentStudyMeta?.fileName ?? this.selectedFile?.name ?? 'No file selected yet';
  }

  get currentStudyFileType(): string {
    if (this.currentStudyMeta?.fileType) {
      return this.currentStudyMeta.fileType;
    }

    if (!this.selectedFile) {
      return '-';
    }

    const ext = this.selectedFile.name.split('.').pop()?.toUpperCase();
    return ext || '-';
  }

  get currentStudyUploadedAt(): string | null {
    return this.currentStudyMeta?.uploadedAt ?? null;
  }

  get currentStudySourcesFound(): string[] {
    if (this.currentStudyMeta?.sourcesFound?.length) {
      return this.currentStudyMeta.sourcesFound;
    }

    if (!this.summary?.countBySourceLabel) {
      return [];
    }

    return Object.entries(this.summary.countBySourceLabel)
      .filter(([, count]) => count > 0)
      .map(([label]) => label);
  }

  get currentStudyDurationMs(): number | null {
    return this.currentStudyMeta?.processingDurationMs ?? this.statusResponse?.processingDurationMs ?? null;
  }

  get currentProcessingStatus(): string {
    return this.statusResponse?.processingStatus ?? this.currentStudyMeta?.processingStatus ?? 'PENDING';
  }

  get currentProgressPercent(): number {
    if (this.view === 'dashboard' && this.currentProcessingStatus === 'COMPLETED') {
      return 100;
    }

    return this.statusResponse?.progressPercent ?? (this.currentStudyMeta?.processingStatus === 'COMPLETED' ? 100 : 0);
  }

  get processingStatusLabel(): string {
    switch (this.currentProcessingStatus) {
      case 'PENDING':
        return 'Waiting to start...';
      case 'PROCESSING':
        return `Processing rows... (${this.statusResponse?.processedRows?.toLocaleString() ?? 0} / ${this.statusResponse?.totalRows?.toLocaleString() ?? 0})`;
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Initializing...';
    }
  }

  get statusBadgeClass(): string {
    switch (this.currentProcessingStatus) {
      case 'COMPLETED':
        return 'status-pill status-pill--success';
      case 'FAILED':
        return 'status-pill status-pill--danger';
      case 'PROCESSING':
        return 'status-pill status-pill--warning';
      default:
        return 'status-pill status-pill--muted';
    }
  }

  get hasDashboardData(): boolean {
    return (this.summary?.totalRows ?? 0) > 0;
  }

  get dateBasisLabel(): string {
    return this.dateBasisOptions.find(option => option.value === this.filtersForm.value.dateBasis)?.label ?? 'Date Creation CRM';
  }

  get availableSources(): string[] {
    const sources = this.filterOptions?.sources?.length ? this.filterOptions.sources : DEFAULT_SOURCE_OPTIONS;
    return Array.from(new Set(sources));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.isDragOver = false;
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.setFile(file);
    }
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  clearFile(): void {
    this.selectedFile = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.cdr.markForCheck();
  }

  startUpload(): void {
    if (!this.selectedFile || this.uploadLoading) {
      return;
    }

    this.uploadLoading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.service.upload(this.selectedFile).subscribe({
      next: (response: MergedUploadResponse) => {
        this.currentStudyId = response.studyId;
        this.currentStudyMeta = this.buildStudyMetaFromSelectedFile(response.studyId, 'PENDING');
        this.view = 'processing';
        this.uploadLoading = false;
        this.cdr.markForCheck();
        this.startPolling(response.studyId);
      },
      error: (err) => {
        this.uploadLoading = false;
        this.errorMessage = err?.error?.message ?? 'Upload failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    if (!this.currentStudyId) {
      return;
    }

    this.loadDashboard(this.currentStudyId);
  }

  resetFilters(): void {
    this.filtersForm.reset({
      source: '',
      zoneManager: '',
      stt: '',
      status: '',
      gouvernorat: '',
      dateBasis: 'DATE_CREATION_CRM',
      dateFrom: '',
      dateTo: ''
    });

    if (this.currentStudyId) {
      this.loadDashboard(this.currentStudyId);
    }
  }

  refreshCurrentStudy(): void {
    if (!this.currentStudyId) {
      return;
    }

    this.loadDashboard(this.currentStudyId);
  }

  loadInvalidRows(studyId: string, page: number): void {
    this.invalidRowsLoading = true;
    this.cdr.markForCheck();

    this.service.getInvalidRows(studyId, page, 50).subscribe({
      next: (res: MergedInvalidRowsPageResponse) => {
        this.invalidRows = res.content;
        this.invalidPage = res.page;
        this.invalidTotalPages = res.totalPages;
        this.invalidTotalElements = res.totalElements;
        this.invalidRowsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.invalidRowsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  nextInvalidPage(): void {
    if (this.currentStudyId && this.invalidPage < this.invalidTotalPages - 1) {
      this.loadInvalidRows(this.currentStudyId, this.invalidPage + 1);
    }
  }

  prevInvalidPage(): void {
    if (this.currentStudyId && this.invalidPage > 0) {
      this.loadInvalidRows(this.currentStudyId, this.invalidPage - 1);
    }
  }

  loadStudies(silent = false): void {
    if (!silent) {
      this.studiesLoading = true;
    }

    this.service.listStudies().subscribe({
      next: (studies) => {
        this.studies = studies;
        if (this.currentStudyId) {
          this.currentStudyMeta = studies.find(study => study.studyId === this.currentStudyId) ?? this.currentStudyMeta;
        }
        this.studiesLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.studiesLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openStudy(study: MergedStudyListItem): void {
    if (study.processingStatus !== 'COMPLETED') {
      this.swal.error('Study Not Ready', `Study is not completed yet. Current status: ${study.processingStatus}`);
      return;
    }

    if (study.studyId !== this.currentStudyId) {
      this.filterOptions = null;
    }

    this.selectedFile = null;
    this.currentStudyMeta = study;
    this.statusResponse = null;
    this.loadDashboard(study.studyId);
    this.view = 'dashboard';
    this.cdr.markForCheck();
  }

  deleteStudy(study: MergedStudyListItem): void {
    this.swal.confirmAction('Delete Study', `Delete "${study.fileName}"? All associated rows will be permanently removed.`, 'Delete')
      .then(result => {
        if (!result.isConfirmed) {
          return;
        }

        this.service.deleteStudy(study.studyId).subscribe({
          next: () => {
            this.studies = this.studies.filter(item => item.studyId !== study.studyId);
            if (this.currentStudyId === study.studyId) {
              this.resetDashboardState();
              this.view = 'upload';
            }
            this.cdr.markForCheck();
          },
          error: () => this.swal.error('Delete Failed', 'Failed to delete study. Please try again.')
        });
      });
  }

  goToUpload(): void {
    this.pollSub?.unsubscribe();
    this.resetDashboardState();
    this.view = 'upload';
    this.cdr.markForCheck();
  }

  goToStudies(): void {
    this.loadStudies();
    this.view = 'studies';
    this.cdr.markForCheck();
  }

  sourceLabelFor(source: string): string {
    switch (source?.toUpperCase()) {
      case 'MES':
      case 'MSE':
        return 'Activation';
      case 'DMG':
        return 'Demenagement';
      case 'PLT':
        return 'Plainte';
      case 'RES':
        return 'Resiliation';
      default:
        return source ?? 'Unknown';
    }
  }

  sourceOptionLabelFor(source: string): string {
    switch (source?.toUpperCase()) {
      case 'MES':
        return 'MES - Activation';
      case 'MSE':
        return 'MSE - Activation';
      case 'DMG':
        return 'DMG - Demenagement';
      case 'PLT':
        return 'PLT - Plainte';
      case 'RES':
        return 'RES - Resiliation';
      default:
        return source ?? 'Unknown';
    }
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null) {
      return '-';
    }

    if (ms < 1000) {
      return `${Math.round(ms)} ms`;
    }

    if (ms < 60_000) {
      return `${(ms / 1000).toFixed(1)} s`;
    }

    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  formatMetric(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  hasDistributionData(dist: Record<string, number> | null | undefined): boolean {
    return !!dist && Object.values(dist).some(value => value > 0);
  }

  hasTrendData(points: MonthlyTrendPoint[] | null | undefined): boolean {
    return !!points?.length && points.some(point => point.count > 0);
  }

  chartHasRenderableData(chart: IChartProps): boolean {
    const datasets = chart.data?.datasets ?? [];
    return datasets.some(dataset => (dataset.data as number[] | undefined)?.some(value => Number(value) > 0));
  }

  getBarChartHeight(itemCount: number): number {
    return Math.min(Math.max(itemCount * 34, 280), 420);
  }

  getHorizontalItemCount(dist: Record<string, number> | null | undefined): number {
    return Object.entries(dist ?? {})
      .filter(([key, value]) => !!key && value > 0)
      .slice(0, 10).length;
  }

  trackById(_: number, row: MergedInvalidRowDto): string {
    return row.id;
  }

  trackByStudyId(_: number, study: MergedStudyListItem): string {
    return study.studyId;
  }

  private setFile(file: File): void {
    const allowed = ['.csv', '.xls', '.xlsx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
      this.swal.error('Invalid File', 'Only .csv, .xls, and .xlsx files are accepted.');
      return;
    }

    this.selectedFile = file;
    this.errorMessage = null;
    this.cdr.markForCheck();
  }

  private startPolling(studyId: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(2000).pipe(
      switchMap(() => this.service.getStatus(studyId)),
      takeWhile(status => status.processingStatus === 'PENDING' || status.processingStatus === 'PROCESSING', true)
    ).subscribe({
      next: (status: MergedStatusResponse) => {
        this.statusResponse = status;
        this.syncStudyMetaWithStatus(status);
        this.cdr.markForCheck();

        if (status.processingStatus === 'COMPLETED') {
          this.loadDashboard(studyId);
          this.loadStudies(true);
        } else if (status.processingStatus === 'FAILED') {
          this.view = 'upload';
          this.errorMessage = status.errorMessage ?? 'Processing failed. Please check the file and try again.';
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.view = 'upload';
        this.errorMessage = 'Lost connection while tracking processing status.';
        this.cdr.markForCheck();
      }
    });
  }

  private loadDashboard(studyId: string): void {
    this.currentStudyId = studyId;
    this.view = 'dashboard';
    this.summaryLoading = true;
    this.chartsLoading = true;
    this.errorMessage = null;
    this.summary = null;
    this.charts = null;
    this.invalidRows = [];
    this.invalidPage = 0;
    this.invalidTotalPages = 0;
    this.invalidTotalElements = 0;
    this.resetChartModels();
    this.currentStudyMeta = this.studies.find(study => study.studyId === studyId) ?? this.currentStudyMeta;
    this.cdr.markForCheck();

    const filters = this.buildFilters();
    const summaryStart = performance.now();

    this.service.getSummary(studyId, filters).subscribe({
      next: (summary) => {
        console.log(`[MERGED-UI][SUMMARY_LOADED] duration=${(performance.now() - summaryStart).toFixed(1)}ms`);
        this.summary = summary;
        this.summaryLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.summaryLoading = false;
        this.cdr.markForCheck();
      }
    });

    this.service.getCharts(studyId, filters).subscribe({
      next: (charts) => {
        this.charts = charts;
        this.buildDashboardCharts(charts);
        this.chartsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.chartsLoading = false;
        this.cdr.markForCheck();
      }
    });

    this.loadInvalidRows(studyId, 0);
    this.loadFilterOptions(studyId);
  }

  private loadFilterOptions(studyId: string): void {
    if (this.filterOptions) {
      return;
    }

    this.filterOptionsLoading = true;
    const start = performance.now();

    this.service.getFilters(studyId).subscribe({
      next: (options) => {
        this.filterOptions = options;
        this.filterOptionsLoading = false;
        console.log(
          `[MERGED-UI][FILTERS_LOADED] duration=${(performance.now() - start).toFixed(1)}ms` +
          ` sources=${options.sources.length} zones=${options.zoneManagers.length}` +
          ` stts=${options.stts.length} govs=${options.governorates.length} statuses=${options.statuses.length}`
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.filterOptionsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildFilters(): MergedChartFilters {
    const formValue = this.filtersForm.getRawValue();
    const filters: MergedChartFilters = {};

    if (formValue.source) {
      filters.source = formValue.source;
    }
    if (formValue.zoneManager) {
      filters.zoneManager = formValue.zoneManager;
    }
    if (formValue.stt) {
      filters.stt = formValue.stt;
    }
    if (formValue.status) {
      filters.status = formValue.status;
    }
    if (formValue.gouvernorat) {
      filters.gouvernorat = formValue.gouvernorat;
    }
    if (formValue.dateBasis) {
      filters.dateBasis = formValue.dateBasis;
    }
    if (formValue.dateFrom) {
      filters.dateFrom = new Date(formValue.dateFrom).toISOString();
    }
    if (formValue.dateTo) {
      filters.dateTo = new Date(formValue.dateTo).toISOString();
    }

    return filters;
  }

  private buildDashboardCharts(charts: MergedChartsResponse): void {
    const renderStart = performance.now();
    console.log('[MERGED-UI][CHARTS_RENDER_START]');

    this.sourceDistributionChart = this.buildDonutChart(
      'sourceDistribution',
      charts.sourceLabelDistribution,
      getSourceColor
    );

    this.monthlyTrendChart = this.buildTrendChart(charts.monthlyTrend);

    this.zoneManagerChart = this.buildBarChart(
      'zoneManagerDistribution',
      charts.zoneManagerDistribution,
      () => withAlpha(OOREDDOO_CHART_COLORS.primaryRed, 0.75),
      value => `${this.formatMetric(value)} row(s)`,
      10
    );

    this.sttChart = this.buildBarChart(
      'sttDistribution',
      charts.sttDistribution,
      () => withAlpha(OOREDDOO_CHART_COLORS.deepRed, 0.75),
      value => `${this.formatMetric(value)} row(s)`,
      10
    );

    this.statusDistributionChart = this.buildDonutChart(
      'statusDistribution',
      charts.statusDistribution,
      getStatusColor
    );

    this.gouvernoratChart = this.buildBarChart(
      'gouvernoratDistribution',
      charts.gouvernoratDistribution,
      () => withAlpha(OOREDDOO_CHART_COLORS.infoBlue, 0.75),
      value => `${this.formatMetric(value)} row(s)`,
      10
    );

    this.slaCrmChart = this.buildDonutChart(
      'slaCrmLabelDistribution',
      charts.slaCrmLabelDistribution,
      getSlaColor
    );

    this.slaTechChart = this.buildDonutChart(
      'slaTechLabelDistribution',
      charts.slaTechLabelDistribution,
      getSlaColor
    );

    console.log(`[MERGED-UI][CHARTS_RENDER_DONE] duration=${(performance.now() - renderStart).toFixed(1)}ms`);
  }

  private toChartPoints(
    distribution: Record<string, number> | null | undefined,
    colorResolver: (label: string) => string,
    limit?: number
  ): ChartPoint[] {
    const entries = Object.entries(distribution ?? {})
      .filter(([key, value]) => !!key && value > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const sliced = typeof limit === 'number' ? entries.slice(0, limit) : entries;

    return sliced.map(([key, value]) => ({
      label: key,
      value,
      color: colorResolver(key)
    }));
  }

  private buildDonutChart(
    chartName: string,
    distribution: Record<string, number> | null | undefined,
    colorResolver: (label: string) => string
  ): IChartProps {
    const points = this.toChartPoints(distribution, colorResolver);

    if (!points.length) {
      this.logChartEmpty(chartName);
    }

    const fullLabels = points.map(p => p.label);
    const values = points.map(p => p.value);
    const colors = points.map(p => p.color);
    const total = values.reduce((s, v) => s + v, 0);

    return {
      type: 'doughnut',
      data: {
        labels: fullLabels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        animation: { duration: 300 },
        cutout: '64%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxHeight: 10, boxWidth: 10, padding: 16, useBorderRadius: true }
          },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(255,255,255,0.14)',
            borderWidth: 1,
            bodyColor: '#f8fafc',
            padding: 12,
            titleColor: '#ffffff',
            callbacks: {
              title: (items: TooltipItem<'doughnut'>[]) =>
                fullLabels[items[0]?.dataIndex ?? -1] ?? items[0]?.label ?? '',
              label: (context: TooltipItem<'doughnut'>) => {
                const value = Number(context.raw ?? 0);
                const pct = total > 0 ? (value / total) * 100 : 0;
                return `${this.formatMetric(value)} row(s) — ${this.formatMetric(pct)}%`;
              }
            }
          }
        }
      } as ChartOptions
    };
  }

  private buildBarChart(
    chartName: string,
    distribution: Record<string, number> | null | undefined,
    colorResolver: (label: string) => string,
    valueFormatter: (value: number) => string,
    limit: number
  ): IChartProps {
    const points = this.toChartPoints(distribution, colorResolver, limit);

    if (!points.length) {
      this.logChartEmpty(chartName);
    }

    const fullLabels = points.map(p => p.label);
    const values = points.map(p => p.value);
    const colors = points.map(p => p.color);

    const borderColor = getStyle('--cui-border-color-translucent') ?? 'rgba(15,23,42,0.10)';
    const textColor = getStyle('--cui-body-color') ?? '#334155';

    return {
      type: 'bar',
      data: {
        labels: fullLabels,
        datasets: [
          {
            label: chartName,
            data: values,
            backgroundColor: colors,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 26
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        animation: { duration: 300 },
        indexAxis: 'y',
        layout: { padding: { right: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(255,255,255,0.14)',
            borderWidth: 1,
            bodyColor: '#f8fafc',
            displayColors: false,
            padding: 12,
            titleColor: '#ffffff',
            callbacks: {
              title: (items: TooltipItem<'bar'>[]) =>
                fullLabels[items[0]?.dataIndex ?? -1] ?? items[0]?.label ?? '',
              label: (context: TooltipItem<'bar'>) =>
                valueFormatter(Number(context.raw ?? 0))
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: borderColor },
            ticks: { color: textColor, maxTicksLimit: 6, font: { size: 11 } }
          },
          y: {
            border: { display: false },
            grid: { display: false },
            ticks: {
              autoSkip: false,
              color: '#475569',
              font: { size: 11 },
              callback(this: Scale, tickValue: number | string): string {
                const label = this.getLabelForValue(Number(tickValue));
                return label.length > 24 ? `${label.substring(0, 22)}…` : label;
              }
            }
          }
        }
      } as ChartOptions
    };
  }

  private buildTrendChart(points: MonthlyTrendPoint[] | null | undefined): IChartProps {
    const trend = points ?? [];

    if (!trend.length) {
      this.logChartEmpty('monthlyTrend');
    }

    return {
      type: 'line',
      data: {
        labels: trend.map(point => point.month),
        datasets: [
          {
            label: 'Monthly trend',
            data: trend.map(point => point.count),
            borderColor: OOREDDOO_CHART_COLORS.primaryRed,
            borderWidth: 2.5,
            backgroundColor: (context: { chart: { chartArea?: { bottom: number; top: number }; ctx: CanvasRenderingContext2D } }) => {
              const chart = context.chart;
              const area = chart.chartArea;

              if (!area) {
                return withAlpha(OOREDDOO_CHART_COLORS.primaryRed, 0.16);
              }

              const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              gradient.addColorStop(0, withAlpha(OOREDDOO_CHART_COLORS.primaryRed, 0.22));
              gradient.addColorStop(1, withAlpha(OOREDDOO_CHART_COLORS.primaryRed, 0.02));
              return gradient;
            },
            fill: true,
            pointBackgroundColor: OOREDDOO_CHART_COLORS.primaryRed,
            pointHoverRadius: 5,
            pointRadius: 0,
            tension: 0.35
          }
        ]
      },
      options: buildTrendChartOptions({
        tooltipFormatter: (value, label) => `${label}: ${this.formatMetric(value)} row(s)`
      }) as ChartOptions
    };
  }

  private logChartEmpty(chartName: string): void {
    console.log(`[MERGED-UI][CHART_EMPTY] chart=${chartName}`);
  }

  private syncStudyMetaWithStatus(status: MergedStatusResponse): void {
    if (!this.currentStudyMeta) {
      return;
    }

    this.currentStudyMeta = {
      ...this.currentStudyMeta,
      processingStatus: status.processingStatus,
      processingDurationMs: status.processingDurationMs,
      totalRows: status.totalRows,
      validRows: status.validRows,
      invalidRows: status.invalidRows
    };
  }

  private buildStudyMetaFromSelectedFile(studyId: string, processingStatus: string): MergedStudyListItem {
    return {
      studyId,
      fileName: this.selectedFile?.name ?? 'Merged import',
      fileType: this.selectedFile?.name.split('.').pop()?.toUpperCase() ?? 'FILE',
      uploadedAt: new Date().toISOString(),
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      processingStatus,
      processingDurationMs: null,
      sourcesFound: []
    };
  }

  private resetDashboardState(): void {
    this.selectedFile = null;
    this.currentStudyId = null;
    this.currentStudyMeta = null;
    this.statusResponse = null;
    this.summary = null;
    this.charts = null;
    this.invalidRows = [];
    this.invalidPage = 0;
    this.invalidTotalPages = 0;
    this.invalidTotalElements = 0;
    this.filterOptions = null;
    this.filterOptionsLoading = false;
    this.errorMessage = null;
    this.uploadLoading = false;
    this.summaryLoading = false;
    this.chartsLoading = false;
    this.invalidRowsLoading = false;
    this.resetChartModels();
  }

  private resetChartModels(): void {
    this.sourceDistributionChart = { type: 'doughnut' };
    this.monthlyTrendChart = { type: 'line' };
    this.zoneManagerChart = { type: 'bar' };
    this.sttChart = { type: 'bar' };
    this.statusDistributionChart = { type: 'doughnut' };
    this.gouvernoratChart = { type: 'bar' };
    this.slaCrmChart = { type: 'doughnut' };
    this.slaTechChart = { type: 'doughnut' };
  }
}
