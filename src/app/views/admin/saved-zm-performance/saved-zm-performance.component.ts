import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, GutterDirective, RowComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  AdminPerformanceAnalyticsQuery,
  AdminPerformanceImportService,
  SavedZmPerformanceRowPreview,
  SavedZmPerformanceRowQualityQuery,
  SavedZmPerformanceRowQualityResponse,
  SavedZmPerformanceStudyResponse,
  ZmPerformanceStudyResponse
} from '../../../core/admin-performance-import/admin-performance-import.service';
import { SwalService } from '../../../core/ui/swal.service';
import { ZmPerformanceStudyViewComponent } from '../../dashboard/zm-performance-study-view.component';

@Component({
  selector: 'app-saved-zm-performance',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    IconDirective,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    GutterDirective,
    ZmPerformanceStudyViewComponent
  ],
  templateUrl: './saved-zm-performance.component.html',
  styleUrls: ['./saved-zm-performance.component.scss', '../../dashboard/dashboard.component.scss']
})
export class SavedZmPerformanceComponent implements OnInit {
  private static readonly INVALID_PAGE_SIZE = 50;

  private readonly fb = inject(FormBuilder);
  private readonly adminPerformanceImportService = inject(AdminPerformanceImportService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  readonly filtersForm = this.fb.nonNullable.group({
    zoneManager: [''],
    gouvernorat: [''],
    uploadedFrom: [''],
    uploadedTo: ['']
  });

  loading = false;
  analyticsLoading = false;
  errorMessage: string | null = null;
  studies: SavedZmPerformanceStudyResponse[] = [];
  selectedStudyId: string | null = null;
  selectedStudyAnalytics: ZmPerformanceStudyResponse | null = null;
  selectedStudyRowQuality: SavedZmPerformanceRowQualityResponse | null = null;
  activeView: 'valid' | 'invalid' = 'valid';
  selectedInvalidReason: string | null = null;
  invalidPage = 1;

  ngOnInit(): void {
    this.loadSavedStudies();
  }

  get selectedStudy(): SavedZmPerformanceStudyResponse | null {
    if (!this.selectedStudyId) {
      return this.studies[0] ?? null;
    }

    return this.studies.find(item => item.id === this.selectedStudyId) ?? this.studies[0] ?? null;
  }

  loadSavedStudies(): void {
    this.loading = true;
    this.errorMessage = null;

    this.adminPerformanceImportService.listSavedStudies()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.studies = response;
          if (response.length === 0) {
            this.selectedStudyId = null;
            this.selectedStudyAnalytics = null;
            this.selectedStudyRowQuality = null;
            this.detectViewChanges();
            return;
          }

          const stillExists = this.selectedStudyId && response.some(item => item.id === this.selectedStudyId);
          this.selectedStudyId = stillExists ? this.selectedStudyId : response[0].id;
          this.detectViewChanges();
          this.loadSelectedStudyData();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to load saved ZM performance studies.';
          this.errorMessage = message;
          this.studies = [];
          this.selectedStudyId = null;
          this.selectedStudyAnalytics = null;
          this.selectedStudyRowQuality = null;
          this.detectViewChanges();
          await this.swal.error('Saved studies unavailable', message);
        }
      });
  }

  selectStudy(studyId: string): void {
    this.selectedStudyId = studyId;
    this.activeView = 'valid';
    this.selectedInvalidReason = null;
    this.invalidPage = 1;
    this.resetFiltersSilently();
    this.detectViewChanges();
    this.loadSelectedStudyData();
  }

  applyFilters(): void {
    this.invalidPage = 1;
    this.loadSelectedStudyData();
  }

  resetFilters(): void {
    this.selectedInvalidReason = null;
    this.invalidPage = 1;
    this.resetFiltersSilently();
    this.loadSelectedStudyData();
  }

  get availableZoneManagers(): string[] {
    return this.selectedStudyAnalytics?.availableZoneManagers ?? [];
  }

  get availableGovernorates(): string[] {
    return this.selectedStudyAnalytics?.availableGovernorates ?? [];
  }

  setActiveView(view: 'valid' | 'invalid'): void {
    this.activeView = view;
    this.detectViewChanges();
  }

  selectInvalidReason(reason: string | null): void {
    this.selectedInvalidReason = reason;
    this.invalidPage = 1;
    this.detectViewChanges();
    this.loadSelectedStudyData();
  }

  goToPreviousInvalidPage(): void {
    if (this.invalidPage <= 1) {
      return;
    }

    this.invalidPage -= 1;
    this.detectViewChanges();
    this.loadSelectedStudyData();
  }

  goToNextInvalidPage(): void {
    const totalPages = this.selectedStudyRowQuality?.invalidTotalPages ?? 1;
    if (this.invalidPage >= totalPages) {
      return;
    }

    this.invalidPage += 1;
    this.detectViewChanges();
    this.loadSelectedStudyData();
  }

  rowStatusLabel(row: SavedZmPerformanceRowPreview): string {
    return row.validRow ? 'Valid' : 'Invalid';
  }

  rowStatusClass(row: SavedZmPerformanceRowPreview): string {
    return row.validRow
      ? 'bg-success-subtle text-success-emphasis'
      : 'bg-danger-subtle text-danger-emphasis';
  }

  issueLabel(row: SavedZmPerformanceRowPreview): string {
    return row.issues.length > 0 ? row.issues.join(' | ') : 'Unknown validation issue';
  }

  trackBySavedRow(index: number, row: SavedZmPerformanceRowPreview): string {
    return `${row.sourceFileName ?? 'unknown'}-${row.rowNumber}-${index}`;
  }

  trackByInvalidReason(_: number, item: { reason: string }): string {
    return item.reason;
  }

  private async loadSelectedStudyData(showErrors = false): Promise<void> {
    if (!this.selectedStudyId) {
      this.selectedStudyAnalytics = null;
      this.selectedStudyRowQuality = null;
      this.detectViewChanges();
      return;
    }

    this.analyticsLoading = true;
    this.errorMessage = null;
    this.detectViewChanges();

    try {
      const response = await firstValueFrom(
        forkJoin({
          analytics: this.adminPerformanceImportService.getSavedStudyAnalytics(this.selectedStudyId, this.currentAnalyticsQuery()),
          rowQuality: this.adminPerformanceImportService.getSavedStudyRowQuality(this.selectedStudyId, this.currentRowQualityQuery())
        })
          .pipe(
            finalize(() => {
              this.analyticsLoading = false;
              this.detectViewChanges();
            })
          )
      );

      this.selectedStudyAnalytics = response.analytics;
      this.selectedStudyRowQuality = response.rowQuality;
      this.selectedInvalidReason = response.rowQuality.selectedInvalidReason ?? null;
      this.invalidPage = response.rowQuality.invalidPage;
      this.filtersForm.patchValue({
        zoneManager: response.analytics.selectedZoneManager ?? '',
        gouvernorat: response.analytics.selectedGovernorate ?? ''
      }, { emitEvent: false });
      this.detectViewChanges();
    } catch (err: any) {
      const message = err?.error?.message ?? 'Failed to load the saved dashboard statistics.';
      this.errorMessage = message;
      this.selectedStudyAnalytics = null;
      this.selectedStudyRowQuality = null;
      this.detectViewChanges();
      if (showErrors) {
        await this.swal.error('Saved dashboard unavailable', message);
      }
    }
  }

  trackByStudy(_: number, item: SavedZmPerformanceStudyResponse): string {
    return item.id;
  }

  formatMetric(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private currentAnalyticsQuery(): AdminPerformanceAnalyticsQuery {
    return this.filtersForm.getRawValue();
  }

  private currentRowQualityQuery(): SavedZmPerformanceRowQualityQuery {
    return {
      ...this.filtersForm.getRawValue(),
      invalidReason: this.selectedInvalidReason ?? undefined,
      invalidPage: this.invalidPage,
      invalidPageSize: SavedZmPerformanceComponent.INVALID_PAGE_SIZE
    };
  }

  private resetFiltersSilently(): void {
    this.filtersForm.setValue({
      zoneManager: '',
      gouvernorat: '',
      uploadedFrom: '',
      uploadedTo: ''
    }, { emitEvent: false });
  }

  private detectViewChanges(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
