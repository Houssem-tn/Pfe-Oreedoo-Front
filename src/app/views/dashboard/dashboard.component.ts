import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
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

import { AuthStore } from '../../core/auth/auth.store';
import {
  AdminPerformanceImportInjectResponse,
  AdminPerformanceImportPreviewResponse,
  AdminPerformanceImportPreviewRow,
  AdminPerformanceImportService,
  ZmPerformanceStudyResponse
} from '../../core/admin-performance-import/admin-performance-import.service';
import { SwalService } from '../../core/ui/swal.service';
import { ZmPerformanceStudyViewComponent } from './zm-performance-study-view.component';

type InvalidReasonSummary = {
  reason: string;
  count: number;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
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
    ZmPerformanceStudyViewComponent
  ]
})
export class DashboardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly adminPerformanceImportService = inject(AdminPerformanceImportService);
  private readonly swal = inject(SwalService);
  @ViewChild('performanceImportFileInput') private performanceImportFileInput?: ElementRef<HTMLInputElement>;

  readonly analyticsFiltersForm = this.fb.nonNullable.group({
    zoneManager: [''],
    gouvernorat: [''],
    uploadedFrom: [''],
    uploadedTo: ['']
  });

  selectedFile: File | null = null;

  previewLoading = false;
  injectLoading = false;
  analyticsLoading = false;
  saveStudyLoading = false;

  errorMessage: string | null = null;
  warningMessage: string | null = null;

  importPreview: AdminPerformanceImportPreviewResponse | null = null;
  importResult: AdminPerformanceImportInjectResponse | null = null;
  analytics: ZmPerformanceStudyResponse | null = null;

  ngOnInit(): void {
    if (!this.isAdmin) {
      this.redirectToRoleDashboard();
      return;
    }

    this.loadAnalytics(true);
  }

  get isAdmin(): boolean {
    return this.authStore.role() === 'ROLE_ADMIN';
  }

  get previewRows(): AdminPerformanceImportPreviewRow[] {
    return this.importPreview?.previewRows ?? [];
  }

  get invalidReasonSummaries(): InvalidReasonSummary[] {
    const summary = new Map<string, number>();

    for (const row of this.previewRows.filter(item => !item.validRow)) {
      const issues = row.issues.length > 0 ? row.issues : ['Unknown validation issue'];
      for (const issue of issues) {
        summary.set(issue, (summary.get(issue) ?? 0) + 1);
      }
    }

    return Array.from(summary.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  }

  get hasPreview(): boolean {
    return !!this.importPreview;
  }

  get selectedZoneManagers(): string[] {
    return this.analytics?.availableZoneManagers ?? [];
  }

  get selectedGovernorates(): string[] {
    return this.analytics?.availableGovernorates ?? [];
  }

  get canInject(): boolean {
    return !!this.selectedFile && !!this.importPreview && !this.injectLoading;
  }

  get canSaveStudy(): boolean {
    return !!this.analytics && this.analytics.totalCases > 0 && !this.saveStudyLoading && !this.analyticsLoading;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.selectedFile = input?.files?.[0] ?? null;
    this.importPreview = null;
    this.importResult = null;
    this.errorMessage = null;
    this.warningMessage = null;
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

    this.adminPerformanceImportService.preview(this.selectedFile)
      .pipe(finalize(() => { this.previewLoading = false; }))
      .subscribe({
        next: (response) => {
          this.importPreview = response;

          if (response.totalRows === 0) {
            this.warningMessage = 'The uploaded file was parsed, but no non-empty rows were found.';
          } else if (response.invalidRows > 0) {
            this.warningMessage = 'Some rows are invalid for analytics and will be stored with issues so they do not affect KPI calculations.';
          }
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to preview the operational analytics file.';
          this.errorMessage = message;
          this.importPreview = null;
          await this.swal.error('Preview failed', message);
        }
      });
  }

  injectImport(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Select a file first.';
      return;
    }

    if (!this.importPreview) {
      this.warningMessage = 'Preview the file first so the admin can validate the parsed rows before saving the batch.';
      return;
    }

    this.injectLoading = true;
    this.errorMessage = null;

    this.adminPerformanceImportService.inject(this.selectedFile)
      .pipe(finalize(() => { this.injectLoading = false; }))
      .subscribe({
        next: async (response) => {
          this.importResult = response;
          await this.loadAnalytics(true);
          await this.swal.success(
            'Performance batch imported',
            `${response.savedRows} row(s) were stored in batch ${response.batchId}. ${response.validRows} valid row(s) are now available for ZM study analytics.`
          );
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to import the analytics batch.';
          this.errorMessage = message;
          await this.swal.error('Import failed', message);
        }
      });
  }

  applyAnalyticsFilters(): void {
    this.loadAnalytics();
  }

  resetAnalyticsFilters(): void {
    this.analyticsFiltersForm.setValue({
      zoneManager: '',
      gouvernorat: '',
      uploadedFrom: '',
      uploadedTo: ''
    });
    this.loadAnalytics();
  }

  savePerformanceStudy(): void {
    if (!this.canSaveStudy || !this.analytics) {
      return;
    }

    this.saveStudyLoading = true;
    this.errorMessage = null;

    this.adminPerformanceImportService.saveStudy(this.analytics)
      .pipe(finalize(() => { this.saveStudyLoading = false; }))
      .subscribe({
        next: async (response) => {
          this.clearImportWorkspace(true);
          this.errorMessage = null;
          this.resetAnalyticsFiltersSilently();
          await this.loadAnalytics();
          await this.swal.success(
            'Performance saved',
            `The study from ${response.sourceFileNames.join(', ') || 'the imported batch'} was saved and the dashboard staging area was cleared for the next file.`
          );
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to save the current performance study.';
          this.errorMessage = message;
          await this.swal.error('Save failed', message);
        }
      });
  }

  async loadAnalytics(showErrors = false): Promise<void> {
    this.analyticsLoading = true;
    this.errorMessage = null;

    try {
      const response = await firstValueFrom(
        this.adminPerformanceImportService.getAnalytics(this.analyticsFiltersForm.getRawValue())
          .pipe(finalize(() => { this.analyticsLoading = false; }))
      );

      this.analytics = response;
      this.analyticsFiltersForm.patchValue({
        zoneManager: response.selectedZoneManager ?? '',
        gouvernorat: response.selectedGovernorate ?? ''
      }, { emitEvent: false });
    } catch (err: any) {
      const message = err?.error?.message ?? 'Failed to load Zone Manager performance analytics.';
      this.errorMessage = message;
      this.analytics = null;
      if (showErrors) {
        await this.swal.error('Analytics unavailable', message);
      }
    }
  }

  rowStatusLabel(row: AdminPerformanceImportPreviewRow): string {
    return row.validRow ? 'Valid' : 'Invalid';
  }

  rowStatusClass(row: AdminPerformanceImportPreviewRow): string {
    return row.validRow
      ? 'bg-success-subtle text-success-emphasis'
      : 'bg-danger-subtle text-danger-emphasis';
  }

  issueLabel(row: AdminPerformanceImportPreviewRow): string {
    return row.issues.join(' | ');
  }

  trackByPreviewRow(_: number, row: AdminPerformanceImportPreviewRow): number {
    return row.rowNumber;
  }

  private redirectToRoleDashboard(): void {
    const role = this.authStore.role();
    switch (role) {
      case 'ROLE_ZM':
        this.router.navigateByUrl('/zm/dashboard');
        break;
      case 'ROLE_STT':
        this.router.navigateByUrl('/stt/dashboard');
        break;
      case 'ROLE_TECH':
        this.router.navigateByUrl('/tech/dashboard');
        break;
      default:
        break;
    }
  }

  private resetAnalyticsFiltersSilently(): void {
    this.analyticsFiltersForm.setValue({
      zoneManager: '',
      gouvernorat: '',
      uploadedFrom: '',
      uploadedTo: ''
    }, { emitEvent: false });
  }

  private clearImportWorkspace(resetNativeInput = false): void {
    this.selectedFile = null;
    this.importPreview = null;
    this.importResult = null;
    this.warningMessage = null;

    if (resetNativeInput && this.performanceImportFileInput?.nativeElement) {
      this.performanceImportFileInput.nativeElement.value = '';
    }
  }
}
