import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, GutterDirective, RowComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  AdminActivationAnalyticsDashboard,
  AdminActivationAnalyticsService,
  SavedActivationAnalyticsStudyResponse
} from '../../core/admin-activation-analytics/admin-activation-analytics.service';
import { SwalService } from '../../core/ui/swal.service';
import { ActivationAnalyticsViewComponent } from './activation-analytics-view.component';

@Component({
  selector: 'app-activation-analysis',
  standalone: true,
  templateUrl: './activation-analysis.component.html',
  styleUrl: './dashboard.component.scss',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    CardComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    GutterDirective,
    ButtonDirective,
    IconDirective,
    ActivationAnalyticsViewComponent
  ]
})
export class ActivationAnalysisComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly analyticsService = inject(AdminActivationAnalyticsService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  readonly filtersForm = this.fb.nonNullable.group({
    stt: [''],
    gouvernorat: ['']
  });

  loading = false;
  saveStudyLoading = false;
  errorMessage: string | null = null;

  dashboard: AdminActivationAnalyticsDashboard | null = null;
  savedStudies: SavedActivationAnalyticsStudyResponse[] = [];
  selectedStudyId: string | null = null;
  viewMode: 'live' | 'saved' = 'live';

  ngOnInit(): void {
    this.loadSavedStudies();
    this.loadCurrentView(true);
  }

  get availableStts(): string[] {
    return this.dashboard?.availableStts ?? [];
  }

  get availableGovernorates(): string[] {
    return this.dashboard?.availableGovernorates ?? [];
  }

  get canSaveStudy(): boolean {
    return this.viewMode === 'live'
      && !!this.dashboard
      && this.dashboard.kpis.totalCases > 0
      && !this.saveStudyLoading
      && !this.loading;
  }

  get selectedStudy(): SavedActivationAnalyticsStudyResponse | null {
    if (!this.selectedStudyId) {
      return null;
    }
    return this.savedStudies.find(item => item.id === this.selectedStudyId) ?? null;
  }

  showLiveDataset(): void {
    this.viewMode = 'live';
    this.selectedStudyId = null;
    this.resetFiltersSilently();
    this.detectViewChanges();
    this.loadCurrentView();
  }

  selectStudy(studyId: string): void {
    this.viewMode = 'saved';
    this.selectedStudyId = studyId;
    this.resetFiltersSilently();
    this.detectViewChanges();
    this.loadCurrentView();
  }

  applyFilters(): void {
    this.loadCurrentView();
  }

  resetFilters(): void {
    this.resetFiltersSilently();
    this.loadCurrentView();
  }

  saveLiveStudy(): void {
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
        next: async () => {
          this.loadSavedStudies();
          await this.swal.success('Act analysis saved', 'The current activation dashboard snapshot is now available in the saved analysis list.');
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to save the current activation analysis.';
          this.errorMessage = message;
          this.detectViewChanges();
          await this.swal.error('Save failed', message);
        }
      });
  }

  async loadCurrentView(showErrors = false): Promise<void> {
    this.loading = true;
    this.errorMessage = null;

    try {
      const response = this.viewMode === 'saved' && this.selectedStudyId
        ? await firstValueFrom(
            this.analyticsService.getSavedStudyDashboard(this.selectedStudyId, this.filtersForm.getRawValue())
              .pipe(
                finalize(() => {
                  this.loading = false;
                  this.detectViewChanges();
                })
              )
          )
        : await firstValueFrom(
            this.analyticsService.getDashboard(this.filtersForm.getRawValue())
              .pipe(
                finalize(() => {
                  this.loading = false;
                  this.detectViewChanges();
                })
              )
          );

      this.dashboard = response;
      this.filtersForm.patchValue({
        stt: response.selectedStt ?? '',
        gouvernorat: response.selectedGovernorate ?? ''
      }, { emitEvent: false });
      this.detectViewChanges();
    } catch (err: any) {
      const message = err?.error?.message ?? 'Failed to load Act analysis.';
      this.errorMessage = message;
      this.dashboard = null;
      this.detectViewChanges();
      if (showErrors) {
        await this.swal.error('Act analysis unavailable', message);
      }
    }
  }

  loadSavedStudies(): void {
    this.analyticsService.listSavedStudies().subscribe({
      next: (response) => {
        this.savedStudies = response;
        const stillExists = this.selectedStudyId && response.some(item => item.id === this.selectedStudyId);
        if (this.viewMode === 'saved' && !stillExists) {
          this.selectedStudyId = response[0]?.id ?? null;
        }
        this.detectViewChanges();
      },
      error: () => {
        this.savedStudies = [];
        this.detectViewChanges();
      }
    });
  }

  trackByStudy(_: number, item: SavedActivationAnalyticsStudyResponse): string {
    return item.id;
  }

  private resetFiltersSilently(): void {
    this.filtersForm.setValue({
      stt: '',
      gouvernorat: ''
    }, { emitEvent: false });
  }

  private detectViewChanges(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
