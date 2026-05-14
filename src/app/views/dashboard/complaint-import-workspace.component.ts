import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  GutterDirective,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  AdminComplaintAnalyticsCharts,
  AdminComplaintAnalyticsDashboard,
  ComplaintImportProcessingMode,
  AdminComplaintAnalyticsImportResponse,
  AdminComplaintAnalyticsInvalidReason,
  AdminComplaintAnalyticsPreviewResponse,
  AdminComplaintAnalyticsPreviewRow,
  AdminComplaintAnalyticsSummary,
  AdminComplaintAnalyticsService
} from '../../core/admin-complaint-analytics/admin-complaint-analytics.service';
import { SwalService } from '../../core/ui/swal.service';
import { ComplaintAnalyticsViewComponent } from './complaint-analytics-view.component';

@Component({
  selector: 'app-complaint-import-workspace',
  standalone: true,
  templateUrl: './complaint-import-workspace.component.html',
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
    ComplaintAnalyticsViewComponent
  ]
})
export class ComplaintImportWorkspaceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly analyticsService = inject(AdminComplaintAnalyticsService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  @ViewChild('complaintImportFileInput') private complaintImportFileInput?: ElementRef<HTMLInputElement>;

  readonly analyticsFiltersForm = this.fb.nonNullable.group({
    stt: [''],
    gouvernorat: ['']
  });

  selectedFile: File | null = null;

  previewLoading = false;
  importLoading = false;
  dashboardLoading = false;
  chartsLoading = false;
  saveStudyLoading = false;
  activeProcessingMode: ComplaintImportProcessingMode | null = null;

  errorMessage: string | null = null;
  warningMessage: string | null = null;

  importPreview: AdminComplaintAnalyticsPreviewResponse | null = null;
  importResult: AdminComplaintAnalyticsImportResponse | null = null;
  dashboard: AdminComplaintAnalyticsDashboard | null = null;

  activePreviewView: 'valid' | 'invalid' = 'valid';
  selectedInvalidReason: string | null = null;
  invalidRowsPage = 1;
  private dashboardSummary: AdminComplaintAnalyticsSummary | null = null;
  private dashboardCharts: AdminComplaintAnalyticsCharts | null = null;
  private lastDashboardRequestKey: string | null = null;

  ngOnInit(): void {
    this.loadDashboard(true, true);
  }

  get validPreviewRows(): AdminComplaintAnalyticsPreviewRow[] {
    return this.importPreview?.validPreviewRows ?? [];
  }

  get invalidPreviewRows(): AdminComplaintAnalyticsPreviewRow[] {
    return this.importPreview?.invalidRowsPreview ?? [];
  }

  get invalidReasonSummaries(): AdminComplaintAnalyticsInvalidReason[] {
    return this.importPreview?.invalidReasonSummaries ?? [];
  }

  get invalidRowPageSize(): number {
    return this.importPreview?.invalidRowPageSize ?? 50;
  }

  get filteredInvalidPreviewRows(): AdminComplaintAnalyticsPreviewRow[] {
    if (!this.selectedInvalidReason) {
      return this.invalidPreviewRows;
    }

    return this.invalidPreviewRows.filter(row => {
      const issues = row.issues.length > 0 ? row.issues : ['Unknown validation issue'];
      return issues.includes(this.selectedInvalidReason!);
    });
  }

  get pagedInvalidPreviewRows(): AdminComplaintAnalyticsPreviewRow[] {
    const pageSize = this.invalidRowPageSize;
    const start = (this.invalidRowsPage - 1) * pageSize;
    return this.filteredInvalidPreviewRows.slice(start, start + pageSize);
  }

  get invalidRowsPageCount(): number {
    return Math.max(1, Math.ceil(this.filteredInvalidPreviewRows.length / this.invalidRowPageSize));
  }

  get selectedInvalidReasonCount(): number {
    return this.filteredInvalidPreviewRows.length;
  }

  get validRowsWithEndToEnd(): number {
    return this.validPreviewRows.filter(row => row.endToEndBusinessDays != null).length;
  }

  get hasPreview(): boolean {
    return !!this.importPreview;
  }

  get canImport(): boolean {
    return !!this.selectedFile && !!this.importPreview && !this.importLoading;
  }

  get canAnalyzeBatch(): boolean {
    return this.canImport && (this.importPreview?.validNewRows ?? 0) > 0;
  }

  get canDistributeBatch(): boolean {
    return this.canImport && (this.importPreview?.processableRows ?? 0) > 0;
  }

  get canAnalyzeAndDistribute(): boolean {
    return this.canAnalyzeBatch || this.canDistributeBatch;
  }

  get canSaveStudy(): boolean {
    return !!this.dashboardSummary
      && !!this.dashboardCharts
      && !!this.dashboard
      && this.dashboard.kpis.totalCases > 0
      && !this.saveStudyLoading
      && !this.dashboardLoading
      && !this.chartsLoading;
  }

  get availableStts(): string[] {
    return this.dashboardSummary?.availableStts ?? this.dashboard?.availableStts ?? [];
  }

  get availableGovernorates(): string[] {
    return this.dashboardSummary?.availableGovernorates ?? this.dashboard?.availableGovernorates ?? [];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.selectedFile = input?.files?.[0] ?? null;
    this.importPreview = null;
    this.importResult = null;
    this.activePreviewView = 'valid';
    this.selectedInvalidReason = null;
    this.invalidRowsPage = 1;
    this.errorMessage = null;
    this.warningMessage = null;
    this.detectViewChanges();
  }

  previewImport(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Select a CSV/XLS/XLSX file before previewing the import.';
      return;
    }

    this.previewLoading = true;
    this.errorMessage = null;
    this.warningMessage = null;
    this.importResult = null;

    this.analyticsService.preview(this.selectedFile)
      .pipe(
        finalize(() => {
          this.previewLoading = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.importPreview = response;
          this.activePreviewView = response.invalidRows > 0 ? 'invalid' : 'valid';
          this.selectedInvalidReason = null;
          this.invalidRowsPage = 1;

          if (response.totalRows === 0) {
            this.warningMessage = 'The uploaded file was parsed, but no non-empty rows were found.';
          } else if (response.invalidRows > 0 || response.duplicateRows > 0) {
            this.warningMessage = 'Invalid rows are blocked. Duplicate CRM_CASE rows are skipped for plainte analytics storage, but dataset duplicates can still refresh the complaint workflow when you choose an import mode.';
          } else {
            this.warningMessage = null;
          }

          this.detectViewChanges();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to preview the complaint analytics file.';
          this.errorMessage = message;
          this.importPreview = null;
          this.detectViewChanges();
          await this.swal.error('Preview failed', message);
        }
      });
  }

  importDataset(mode: ComplaintImportProcessingMode): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Select a file first.';
      return;
    }

    if (!this.importPreview) {
      this.warningMessage = 'Preview the file first so the admin can validate the parsed rows before importing.';
      return;
    }

    this.importLoading = true;
    this.activeProcessingMode = mode;
    this.errorMessage = null;

    this.analyticsService.importFile(this.selectedFile, mode)
      .pipe(
        finalize(() => {
          this.importLoading = false;
          this.activeProcessingMode = null;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: async (response) => {
          this.importResult = response;
          this.detectViewChanges();
          if (response.mode !== 'DISTRIBUTION') {
            await this.loadDashboard(true, true);
          }
          await this.swal.success(
            'Complaint batch processed',
            this.buildProcessingSuccessMessage(response)
          );
          if (mode !== 'ANALYTICS') {
            await this.router.navigateByUrl('/admin/cases/complaint');
          }
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to import the complaint analytics batch.';
          this.errorMessage = message;
          this.detectViewChanges();
          await this.swal.error('Import failed', message);
        }
      });
  }

  applyAnalyticsFilters(): void {
    this.loadDashboard();
  }

  resetAnalyticsFilters(): void {
    this.analyticsFiltersForm.setValue({
      stt: '',
      gouvernorat: ''
    });
    this.loadDashboard();
  }

  saveComplaintStudy(): void {
    if (!this.canSaveStudy || !this.dashboard) {
      return;
    }

    this.saveStudyLoading = true;
    this.errorMessage = null;

    this.analyticsService.saveStudy(this.dashboard)
      .pipe(
        finalize(() => {
          this.saveStudyLoading = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: async (response) => {
          this.clearImportWorkspace(true);
          this.dashboardSummary = null;
          this.dashboardCharts = null;
          this.dashboard = null;
          this.resetAnalyticsFiltersSilently();
          await this.swal.success(
            'Complaint analysis saved',
            `The complaint analytics snapshot based on ${response.sourceFileNames.join(', ') || 'the current dataset'} has been saved successfully.`
          );
          this.detectViewChanges();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to save the current complaint analysis.';
          this.errorMessage = message;
          this.detectViewChanges();
          await this.swal.error('Save failed', message);
        }
      });
  }

  async loadDashboard(showErrors = false, forceReload = false): Promise<void> {
    const requestKey = JSON.stringify(this.analyticsFiltersForm.getRawValue());
    if (!forceReload && requestKey === this.lastDashboardRequestKey && this.dashboardSummary) {
      return;
    }

    this.lastDashboardRequestKey = requestKey;
    this.dashboardLoading = true;
    this.chartsLoading = true;
    this.errorMessage = null;
    this.dashboardSummary = null;
    this.dashboardCharts = null;
    this.rebuildDashboard();

    try {
      const response = await firstValueFrom(
        this.analyticsService.getSummary(this.analyticsFiltersForm.getRawValue())
          .pipe(
            finalize(() => {
              this.dashboardLoading = false;
              this.detectViewChanges();
            })
          )
      );

      this.dashboardSummary = response;
      this.dashboardCharts = null;
      this.rebuildDashboard();
      this.analyticsFiltersForm.patchValue({
        stt: response.selectedStt ?? '',
        gouvernorat: response.selectedGovernorate ?? ''
      }, { emitEvent: false });
      this.detectViewChanges();
      await this.loadCharts();
    } catch (err: any) {
      this.lastDashboardRequestKey = null;
      const message = err?.error?.message ?? 'Failed to load complaint analytics.';
      this.errorMessage = message;
      this.chartsLoading = false;
      this.dashboardSummary = null;
      this.dashboardCharts = null;
      this.dashboard = null;
      this.detectViewChanges();
      if (showErrors) {
        await this.swal.error('Analytics unavailable', message);
      }
    }
  }

  setInvalidReason(reason: string | null): void {
    this.selectedInvalidReason = reason;
    this.activePreviewView = 'invalid';
    this.invalidRowsPage = 1;
    this.detectViewChanges();
  }

  setActivePreviewView(view: 'valid' | 'invalid'): void {
    this.activePreviewView = view;
    this.detectViewChanges();
  }

  goToPreviousInvalidRowsPage(): void {
    if (this.invalidRowsPage <= 1) {
      return;
    }
    this.invalidRowsPage -= 1;
    this.detectViewChanges();
  }

  goToNextInvalidRowsPage(): void {
    if (this.invalidRowsPage >= this.invalidRowsPageCount) {
      return;
    }
    this.invalidRowsPage += 1;
    this.detectViewChanges();
  }

  trackByPreviewRow(_: number, row: AdminComplaintAnalyticsPreviewRow): number {
    return row.rowNumber;
  }

  trackByInvalidReason(_: number, item: AdminComplaintAnalyticsInvalidReason): string {
    return item.reason;
  }

  isProcessingMode(mode: ComplaintImportProcessingMode): boolean {
    return this.activeProcessingMode === mode;
  }

  private resetAnalyticsFiltersSilently(): void {
    this.analyticsFiltersForm.setValue({
      stt: '',
      gouvernorat: ''
    }, { emitEvent: false });
  }

  private clearImportWorkspace(resetNativeInput = false): void {
    this.selectedFile = null;
    this.importPreview = null;
    this.importResult = null;
    this.activePreviewView = 'valid';
    this.selectedInvalidReason = null;
    this.invalidRowsPage = 1;
    this.warningMessage = null;
    this.errorMessage = null;

    if (resetNativeInput && this.complaintImportFileInput?.nativeElement) {
      this.complaintImportFileInput.nativeElement.value = '';
    }
  }

  private buildProcessingSuccessMessage(response: AdminComplaintAnalyticsImportResponse): string {
    const segments: string[] = [];

    if (response.mode !== 'DISTRIBUTION') {
      if (response.insertedRows > 0 && response.batchId) {
        segments.push(`${response.insertedRows} new analytics row(s) were stored in batch ${response.batchId}.`);
      } else {
        segments.push('No new analytics rows were stored because this file only contained already imported CRM_CASE rows or non-actionable source updates.');
      }
    }

    if (response.distributionSummary) {
      segments.push(
        `${response.distributionSummary.createdCases} case(s) were created, `
        + `${response.distributionSummary.updatedExistingCases} existing case(s) were refreshed, `
        + `${response.distributionSummary.assignedToZmCases} row(s) were routed to a ZM, `
        + `and ${response.distributionSummary.sentToAdminQueueCases} row(s) were left in the admin queue.`
      );
    }

    segments.push(
      `${response.duplicateRows} duplicate analytics row(s) and ${response.invalidRows} invalid row(s) were skipped from analytics storage.`
    );

    return segments.join(' ');
  }

  private async loadCharts(): Promise<void> {
    this.chartsLoading = true;
    this.detectViewChanges();

    try {
      const response = await firstValueFrom(
        this.analyticsService.getCharts(this.analyticsFiltersForm.getRawValue())
          .pipe(
            finalize(() => {
              this.chartsLoading = false;
              this.detectViewChanges();
            })
          )
      );

      this.dashboardCharts = response;
      this.rebuildDashboard();
      this.detectViewChanges();
    } catch (err: any) {
      this.dashboardCharts = null;
      this.rebuildDashboard();
      this.errorMessage = err?.error?.message ?? 'Failed to load complaint analytics charts.';
      this.detectViewChanges();
    }
  }

  private rebuildDashboard(): void {
    if (!this.dashboardSummary) {
      this.dashboard = null;
      return;
    }

    this.dashboard = {
      ...this.dashboardSummary,
      ...(this.dashboardCharts ?? this.emptyChartsState())
    };
  }

  private emptyChartsState(): AdminComplaintAnalyticsCharts {
    return {
      bestStt: null,
      worstStt: null,
      bestGovernorate: null,
      worstGovernorate: null,
      mostDelayedStage: null,
      sttRanking: [],
      governorateBreakdown: [],
      topInjoignabiliteCauses: [],
      topAbandonCauses: [],
      pipelineStages: [],
      qualityByStt: [],
      qualityByGovernorate: [],
      alerts: [],
      insights: []
    };
  }

  private detectViewChanges(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
