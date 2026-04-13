import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  AdminPerformanceAnalyticsQuery,
  AdminPerformanceImportService,
  SavedZmPerformanceStudyResponse,
  ZmPerformanceStudyResponse
} from '../../../core/admin-performance-import/admin-performance-import.service';
import { SwalService } from '../../../core/ui/swal.service';
import { ZmPerformanceStudyViewComponent } from '../../dashboard/zm-performance-study-view.component';

@Component({
  selector: 'app-saved-zm-performance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, IconDirective, ZmPerformanceStudyViewComponent],
  templateUrl: './saved-zm-performance.component.html',
  styleUrl: './saved-zm-performance.component.scss'
})
export class SavedZmPerformanceComponent implements OnInit {
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
            this.detectViewChanges();
            return;
          }

          const stillExists = this.selectedStudyId && response.some(item => item.id === this.selectedStudyId);
          this.selectedStudyId = stillExists ? this.selectedStudyId : response[0].id;
          this.detectViewChanges();
          this.loadSelectedStudyAnalytics();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to load saved ZM performance studies.';
          this.errorMessage = message;
          this.studies = [];
          this.selectedStudyId = null;
          this.selectedStudyAnalytics = null;
          this.detectViewChanges();
          await this.swal.error('Saved studies unavailable', message);
        }
      });
  }

  selectStudy(studyId: string): void {
    this.selectedStudyId = studyId;
    this.resetFiltersSilently();
    this.detectViewChanges();
    this.loadSelectedStudyAnalytics();
  }

  applyFilters(): void {
    this.loadSelectedStudyAnalytics();
  }

  resetFilters(): void {
    this.resetFiltersSilently();
    this.loadSelectedStudyAnalytics();
  }

  get availableZoneManagers(): string[] {
    return this.selectedStudyAnalytics?.availableZoneManagers ?? [];
  }

  get availableGovernorates(): string[] {
    return this.selectedStudyAnalytics?.availableGovernorates ?? [];
  }

  private async loadSelectedStudyAnalytics(showErrors = false): Promise<void> {
    if (!this.selectedStudyId) {
      this.selectedStudyAnalytics = null;
      this.detectViewChanges();
      return;
    }

    this.analyticsLoading = true;
    this.errorMessage = null;
    this.detectViewChanges();

    try {
      const response = await firstValueFrom(
        this.adminPerformanceImportService.getSavedStudyAnalytics(this.selectedStudyId, this.currentAnalyticsQuery())
          .pipe(
            finalize(() => {
              this.analyticsLoading = false;
              this.detectViewChanges();
            })
          )
      );

      this.selectedStudyAnalytics = response;
      this.filtersForm.patchValue({
        zoneManager: response.selectedZoneManager ?? '',
        gouvernorat: response.selectedGovernorate ?? ''
      }, { emitEvent: false });
      this.detectViewChanges();
    } catch (err: any) {
      const message = err?.error?.message ?? 'Failed to load the saved dashboard statistics.';
      this.errorMessage = message;
      this.selectedStudyAnalytics = null;
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
