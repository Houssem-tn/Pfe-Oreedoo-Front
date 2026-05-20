import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
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
import { IconDirective } from '@coreui/icons-angular';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

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

type WorkspaceView = 'upload' | 'processing' | 'dashboard' | 'studies';

const DATE_BASIS_OPTIONS = [
  { value: 'DATE_CREATION_CRM',       label: 'Date Création CRM' },
  { value: 'OPENING_DATE_SUR_TIMOS',  label: 'Date Ouverture TIMOS' },
  { value: 'DATE_AFFECTATION_STT',    label: 'Date Affectation STT' },
  { value: 'DATE_FIN_TRV',            label: 'Date Fin Travaux' },
  { value: 'OPEN_DATE_ACTIVATION',    label: 'Date Activation' },
  { value: 'date_travaux_resiliation','label': 'Date Travaux Résiliation' }
];

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
  ]
})
export class MergedImportWorkspaceComponent implements OnInit, OnDestroy {
  private readonly service    = inject(AdminMergedAnalyticsService);
  private readonly swal       = inject(SwalService);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly zone       = inject(NgZone);
  private readonly fb         = inject(FormBuilder);

  @ViewChild('mergedFileInput') private fileInput?: ElementRef<HTMLInputElement>;

  readonly dateBasisOptions = DATE_BASIS_OPTIONS;

  readonly filtersForm = this.fb.nonNullable.group({
    source:       [''],
    zoneManager:  [''],
    stt:          [''],
    status:       [''],
    gouvernorat:  [''],
    dateBasis:    ['DATE_CREATION_CRM'],
    dateFrom:     [''],
    dateTo:       ['']
  });

  // State
  view: WorkspaceView = 'upload';
  selectedFile: File | null = null;
  isDragOver = false;

  uploadLoading     = false;
  chartsLoading     = false;
  studiesLoading    = false;
  invalidRowsLoading = false;

  currentStudyId: string | null = null;
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

  private pollSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadStudies();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  // ── File selection ────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
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
    if (file) this.setFile(file);
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

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  clearFile(): void {
    this.selectedFile = null;
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.cdr.markForCheck();
  }

  // ── Upload & polling ──────────────────────────────────────────────────────

  startUpload(): void {
    if (!this.selectedFile || this.uploadLoading) return;
    this.uploadLoading = true;
    this.errorMessage  = null;
    this.cdr.markForCheck();

    this.service.upload(this.selectedFile).subscribe({
      next: (response: MergedUploadResponse) => {
        this.currentStudyId = response.studyId;
        this.view           = 'processing';
        this.uploadLoading  = false;
        this.cdr.markForCheck();
        this.startPolling(response.studyId);
      },
      error: (err) => {
        this.uploadLoading = false;
        this.errorMessage  = err?.error?.message ?? 'Upload failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  private startPolling(studyId: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(2000).pipe(
      switchMap(() => this.service.getStatus(studyId)),
      takeWhile(s => s.processingStatus === 'PENDING' || s.processingStatus === 'PROCESSING', true)
    ).subscribe({
      next: (status: MergedStatusResponse) => {
        this.statusResponse = status;
        this.cdr.markForCheck();

        if (status.processingStatus === 'COMPLETED') {
          this.loadDashboard(studyId);
        } else if (status.processingStatus === 'FAILED') {
          this.view         = 'upload';
          this.errorMessage = status.errorMessage ?? 'Processing failed. Please check the file and try again.';
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.view         = 'upload';
        this.errorMessage = 'Lost connection while tracking processing status.';
        this.cdr.markForCheck();
      }
    });
  }

  // ── Dashboard loading ─────────────────────────────────────────────────────

  loadDashboard(studyId: string): void {
    this.currentStudyId = studyId;
    this.chartsLoading  = true;
    this.view           = 'dashboard';
    this.cdr.markForCheck();

    const filters = this.buildFilters();
    const t0 = performance.now();

    this.service.getSummary(studyId, filters).subscribe({
      next: (summary) => {
        console.log(`[MERGED-UI][SUMMARY] loaded in ${(performance.now() - t0).toFixed(1)}ms`);
        this.summary = summary;
        this.cdr.markForCheck();
      }
    });

    this.service.getCharts(studyId, filters).subscribe({
      next: (charts) => {
        console.log(`[MERGED-UI][CHARTS] loaded in ${(performance.now() - t0).toFixed(1)}ms`);
        this.charts        = charts;
        this.chartsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.chartsLoading = false; this.cdr.markForCheck(); }
    });

    this.loadInvalidRows(studyId, 0);
    this.loadFilterOptions(studyId);
  }

  private loadFilterOptions(studyId: string): void {
    if (this.filterOptions) return; // already loaded for this study
    this.filterOptionsLoading = true;
    const t0 = performance.now();
    this.service.getFilters(studyId).subscribe({
      next: (opts) => {
        this.filterOptions        = opts;
        this.filterOptionsLoading = false;
        console.log(
          `[MERGED-UI][FILTERS] loaded in ${(performance.now() - t0).toFixed(1)}ms` +
          ` sources=${opts.sources.length} zms=${opts.zoneManagers.length}` +
          ` stts=${opts.stts.length} govs=${opts.governorates.length} statuses=${opts.statuses.length}`
        );
        this.cdr.markForCheck();
      },
      error: () => { this.filterOptionsLoading = false; this.cdr.markForCheck(); }
    });
  }

  applyFilters(): void {
    if (!this.currentStudyId) return;
    this.loadDashboard(this.currentStudyId);
  }

  resetFilters(): void {
    this.filtersForm.reset({
      source: '', zoneManager: '', stt: '', status: '',
      gouvernorat: '', dateBasis: 'DATE_CREATION_CRM', dateFrom: '', dateTo: ''
    });
    if (this.currentStudyId) this.loadDashboard(this.currentStudyId);
  }

  private buildFilters(): MergedChartFilters {
    const f = this.filtersForm.getRawValue();
    const filters: MergedChartFilters = {};
    if (f.source)       filters.source       = f.source;
    if (f.zoneManager)  filters.zoneManager  = f.zoneManager;
    if (f.stt)          filters.stt          = f.stt;
    if (f.status)       filters.status       = f.status;
    if (f.gouvernorat)  filters.gouvernorat  = f.gouvernorat;
    if (f.dateBasis)    filters.dateBasis    = f.dateBasis;
    if (f.dateFrom)     filters.dateFrom     = new Date(f.dateFrom).toISOString();
    if (f.dateTo)       filters.dateTo       = new Date(f.dateTo).toISOString();
    return filters;
  }

  // ── Invalid rows ──────────────────────────────────────────────────────────

  loadInvalidRows(studyId: string, page: number): void {
    this.invalidRowsLoading = true;
    this.cdr.markForCheck();

    this.service.getInvalidRows(studyId, page, 50).subscribe({
      next: (res: MergedInvalidRowsPageResponse) => {
        this.invalidRows        = res.content;
        this.invalidPage        = res.page;
        this.invalidTotalPages  = res.totalPages;
        this.invalidTotalElements = res.totalElements;
        this.invalidRowsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.invalidRowsLoading = false; this.cdr.markForCheck(); }
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

  // ── Studies list ──────────────────────────────────────────────────────────

  loadStudies(): void {
    this.studiesLoading = true;
    this.service.listStudies().subscribe({
      next: (studies) => {
        this.studies        = studies;
        this.studiesLoading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.studiesLoading = false; this.cdr.markForCheck(); }
    });
  }

  openStudy(study: MergedStudyListItem): void {
    if (study.processingStatus !== 'COMPLETED') {
      this.swal.error('Study Not Ready', `Study is not completed yet. Current status: ${study.processingStatus}`);
      return;
    }
    if (study.studyId !== this.currentStudyId) {
      this.filterOptions = null; // reload options for the new study
    }
    this.loadDashboard(study.studyId);
    this.view = 'dashboard';
    this.cdr.markForCheck();
  }

  deleteStudy(study: MergedStudyListItem): void {
    this.swal.confirmAction('Delete Study', `Delete "${study.fileName}"? All associated rows will be permanently removed.`, 'Delete')
      .then(result => {
        if (!result.isConfirmed) return;
        this.service.deleteStudy(study.studyId).subscribe({
          next: () => {
            this.studies = this.studies.filter(s => s.studyId !== study.studyId);
            if (this.currentStudyId === study.studyId) {
              this.view = 'upload';
              this.currentStudyId = null;
            }
            this.cdr.markForCheck();
          },
          error: () => this.swal.error('Delete Failed', 'Failed to delete study. Please try again.')
        });
      });
  }

  // ── View navigation ───────────────────────────────────────────────────────

  goToUpload(): void {
    this.pollSub?.unsubscribe();
    this.selectedFile   = null;
    this.errorMessage   = null;
    this.filterOptions  = null;
    this.view           = 'upload';
    this.cdr.markForCheck();
  }

  goToStudies(): void {
    this.loadStudies();
    this.view = 'studies';
    this.cdr.markForCheck();
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  get progressPercent(): number {
    return this.statusResponse?.progressPercent ?? 0;
  }

  get processingStatusLabel(): string {
    switch (this.statusResponse?.processingStatus) {
      case 'PENDING':    return 'Waiting to start…';
      case 'PROCESSING': return `Processing rows… (${this.statusResponse?.processedRows?.toLocaleString() ?? 0} / ${this.statusResponse?.totalRows?.toLocaleString() ?? 0})`;
      case 'COMPLETED':  return 'Completed';
      case 'FAILED':     return 'Failed';
      default:           return 'Initializing…';
    }
  }

  chartEntries(dist: Record<string, number> | null | undefined): Array<{ key: string; value: number }> {
    if (!dist) return [];
    return Object.entries(dist).map(([key, value]) => ({ key, value }));
  }

  sourceLabelFor(source: string): string {
    switch (source?.toUpperCase()) {
      case 'MES': case 'MSE': return 'Activation';
      case 'DMG': return 'Déménagement';
      case 'PLT': return 'Plainte';
      case 'RES': return 'Résiliation';
      default:    return source ?? 'Unknown';
    }
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  getMaxTrend(trend: MonthlyTrendPoint[]): number {
    if (!trend?.length) return 1;
    return Math.max(...trend.map(t => t.count), 1);
  }

  trackByKey(_: number, item: { key: string }): string { return item.key; }
  trackById(_: number, row: MergedInvalidRowDto): string { return row.id; }
  trackByStudyId(_: number, s: MergedStudyListItem): string { return s.studyId; }
}
