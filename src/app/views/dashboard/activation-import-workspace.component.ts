import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
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
  AdminActivationAnalyticsDashboard,
  AdminActivationAnalyticsImportResponse,
  AdminActivationAnalyticsInvalidReason,
  AdminActivationAnalyticsPreviewResponse,
  AdminActivationAnalyticsPreviewRow,
  AdminActivationAnalyticsService
} from '../../core/admin-activation-analytics/admin-activation-analytics.service';
import { SwalService } from '../../core/ui/swal.service';
import { ActivationAnalyticsViewComponent } from './activation-analytics-view.component';

@Component({
  selector: 'app-activation-import-workspace',
  standalone: true,
  templateUrl: './activation-import-workspace.component.html',
  styleUrl: './dashboard.component.scss',
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
    ActivationAnalyticsViewComponent
  ]
})
export class ActivationImportWorkspaceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly analyticsService = inject(AdminActivationAnalyticsService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  @ViewChild('activationImportFileInput') private activationImportFileInput?: ElementRef<HTMLInputElement>;

  readonly analyticsFiltersForm = this.fb.nonNullable.group({
    stt: [''],
    gouvernorat: ['']
  });

  selectedFile: File | null = null;

  previewLoading = false;
  importLoading = false;
  dashboardLoading = false;
  saveStudyLoading = false;

  errorMessage: string | null = null;
  warningMessage: string | null = null;

  importPreview: AdminActivationAnalyticsPreviewResponse | null = null;
  importResult: AdminActivationAnalyticsImportResponse | null = null;
  dashboard: AdminActivationAnalyticsDashboard | null = null;

  activePreviewView: 'valid' | 'invalid' = 'valid';
  selectedInvalidReason: string | null = null;
  invalidRowsPage = 1;

  ngOnInit(): void {
    this.loadDashboard(true);
  }

  get validPreviewRows(): AdminActivationAnalyticsPreviewRow[] {
    return this.importPreview?.validPreviewRows ?? [];
  }

  get invalidPreviewRows(): AdminActivationAnalyticsPreviewRow[] {
    return this.importPreview?.invalidRowsPreview ?? [];
  }

  get invalidReasonSummaries(): AdminActivationAnalyticsInvalidReason[] {
    return this.importPreview?.invalidReasonSummaries ?? [];
  }

  get invalidRowPageSize(): number {
    return this.importPreview?.invalidRowPageSize ?? 50;
  }

  get filteredInvalidPreviewRows(): AdminActivationAnalyticsPreviewRow[] {
    if (!this.selectedInvalidReason) {
      return this.invalidPreviewRows;
    }

    return this.invalidPreviewRows.filter(row => {
      const issues = row.issues.length > 0 ? row.issues : ['Unknown validation issue'];
      return issues.includes(this.selectedInvalidReason!);
    });
  }

  get pagedInvalidPreviewRows(): AdminActivationAnalyticsPreviewRow[] {
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

  get canSaveStudy(): boolean {
    return !!this.dashboard && this.dashboard.kpis.totalCases > 0 && !this.saveStudyLoading && !this.dashboardLoading;
  }

  get availableStts(): string[] {
    return this.dashboard?.availableStts ?? [];
  }

  get availableGovernorates(): string[] {
    return this.dashboard?.availableGovernorates ?? [];
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
            this.warningMessage = 'Invalid rows and duplicate CRM_CASE rows are shown for review only. Only valid new rows will be stored in Mongo.';
          } else {
            this.warningMessage = null;
          }

          this.detectViewChanges();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to preview the activation analytics file.';
          this.errorMessage = message;
          this.importPreview = null;
          this.detectViewChanges();
          await this.swal.error('Preview failed', message);
        }
      });
  }

  importDataset(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Select a file first.';
      return;
    }

    if (!this.importPreview) {
      this.warningMessage = 'Preview the file first so the admin can validate the parsed rows before importing.';
      return;
    }

    this.importLoading = true;
    this.errorMessage = null;

    this.analyticsService.importFile(this.selectedFile)
      .pipe(
        finalize(() => {
          this.importLoading = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: async (response) => {
          this.importResult = response;
          this.detectViewChanges();
          await this.loadDashboard(true);
          await this.swal.success(
            'Activation dataset imported',
            `${response.insertedRows} new valid row(s) were stored in batch ${response.batchId}. ${response.duplicateRows} duplicate row(s) and ${response.invalidRows} invalid row(s) were skipped.`
          );
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to import the activation analytics batch.';
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

  saveActivationStudy(): void {
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
          this.dashboard = null;
          this.resetAnalyticsFiltersSilently();
          await this.swal.success(
            'Act analysis saved',
            `The activation analytics snapshot based on ${response.sourceFileNames.join(', ') || 'the current dataset'} is now available from Act analysis.`
          );
          this.detectViewChanges();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to save the current activation analysis.';
          this.errorMessage = message;
          this.detectViewChanges();
          await this.swal.error('Save failed', message);
        }
      });
  }

  async loadDashboard(showErrors = false): Promise<void> {
    this.dashboardLoading = true;
    this.errorMessage = null;

    try {
      const response = await firstValueFrom(
        this.analyticsService.getDashboard(this.analyticsFiltersForm.getRawValue())
          .pipe(
            finalize(() => {
              this.dashboardLoading = false;
              this.detectViewChanges();
            })
          )
      );

      this.dashboard = response;
      this.analyticsFiltersForm.patchValue({
        stt: response.selectedStt ?? '',
        gouvernorat: response.selectedGovernorate ?? ''
      }, { emitEvent: false });
      this.detectViewChanges();
    } catch (err: any) {
      const message = err?.error?.message ?? 'Failed to load activation analytics.';
      this.errorMessage = message;
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

  trackByPreviewRow(_: number, row: AdminActivationAnalyticsPreviewRow): number {
    return row.rowNumber;
  }

  trackByInvalidReason(_: number, item: AdminActivationAnalyticsInvalidReason): string {
    return item.reason;
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

    if (resetNativeInput && this.activationImportFileInput?.nativeElement) {
      this.activationImportFileInput.nativeElement.value = '';
    }
  }

  private detectViewChanges(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
