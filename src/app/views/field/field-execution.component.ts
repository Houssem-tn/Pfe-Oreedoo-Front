import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize, firstValueFrom } from 'rxjs';

import { CasesService } from '../../core/cases/cases.service';
import {
  CaseResponse,
  CompleteWorkRequest,
  SetRdvRequest
} from '../../core/cases/models/case.model';
import {
  extractMetrics,
  extractRdv,
  extractWork,
  toDateTimeLocal,
  toIso,
  toMaybeNumber
} from '../tech/tech-case.helpers';
import {
  fieldBasePathFromUrl,
  fieldCaseLocation,
  fieldStatusClass,
  fieldStatusLabel
} from './field-case-utils';

type FieldExecutionStep = 'rdv' | 'work' | 'metrics' | 'completion';
type BannerTone = 'success' | 'warning' | 'danger' | 'info';

interface FieldExecutionStepItem {
  key: FieldExecutionStep;
  label: string;
  icon: string;
}

interface FieldRdvForm {
  joignable: boolean;
  datePriseRdv: string;
  causeInjoignabilite: string;
  detail: string;
  cmtRdv: string;
  abandon: boolean;
  causeAbandon: string;
}

interface FieldWorkForm {
  repTravauxStt: string;
  dateFinTrv: string;
  cmtTrvStt: string;
  metrageCable: string;
  nombrePv: string;
  debitDl: string;
  debitUl: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}

interface FieldGeoSnapshot {
  latitude: number;
  longitude: number;
  capturedAt: string;
  accuracyMeters?: number | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconDirective],
  template: `
    <section class="field-page">
      <a class="field-button field-button--ghost" [routerLink]="caseItem ? basePath + '/tasks/' + caseItem.id : basePath + '/tasks'">
        <svg cIcon name="cilArrowLeft"></svg>
        Case
      </a>

      <div *ngIf="loading" class="field-loading">
        <span class="field-spinner"></span>
        Loading execution
      </div>

      <div *ngIf="error" class="field-banner field-banner--danger">{{ error }}</div>
      <div *ngIf="banner" class="field-banner" [ngClass]="'field-banner--' + bannerTone">{{ banner }}</div>

      <ng-container *ngIf="!loading && !error && caseItem as item">
        <div class="field-page__header">
          <div class="field-page__eyebrow">Execution</div>
          <h1 class="field-page__title">{{ item.clientName }}</h1>
          <p class="field-page__subtitle">{{ location(item) }}</p>
          <span [class]="statusClass(item)">{{ statusLabel(item) }}</span>
        </div>

        <nav class="field-stepper" aria-label="Execution steps">
          <button
            *ngFor="let step of steps"
            type="button"
            class="field-step-tab"
            [class.field-step-tab--active]="activeStep === step.key"
            (click)="activeStep = step.key"
          >
            <svg cIcon [name]="step.icon"></svg>
            {{ step.label }}
          </button>
        </nav>

        <form class="field-card field-form-grid" *ngIf="activeStep === 'rdv'" (ngSubmit)="saveRdv()">
          <div class="field-section-title">
            <h2>RDV step</h2>
            <span>Appointment</span>
          </div>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="rdvForm.joignable" (click)="rdvForm.joignable = true">
              Reachable
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="!rdvForm.joignable" (click)="rdvForm.joignable = false">
              Not reachable
            </button>
          </div>

          <label class="field-label">
            RDV date
            <input class="field-input" type="datetime-local" name="datePriseRdv" [(ngModel)]="rdvForm.datePriseRdv" />
          </label>

          <label class="field-label" *ngIf="!rdvForm.joignable">
            Cause
            <input class="field-input" type="text" name="causeInjoignabilite" [(ngModel)]="rdvForm.causeInjoignabilite" />
          </label>

          <label class="field-label">
            Detail
            <textarea class="field-textarea" name="rdvDetail" [(ngModel)]="rdvForm.detail"></textarea>
          </label>

          <label class="field-label">
            Comment
            <textarea class="field-textarea" name="rdvComment" [(ngModel)]="rdvForm.cmtRdv"></textarea>
          </label>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="!rdvForm.abandon" (click)="rdvForm.abandon = false">
              Continue
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="rdvForm.abandon" (click)="rdvForm.abandon = true">
              Abandon
            </button>
          </div>

          <label class="field-label" *ngIf="rdvForm.abandon">
            Abandon cause
            <input class="field-input" type="text" name="causeAbandon" [(ngModel)]="rdvForm.causeAbandon" />
          </label>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'work'">Next</button>
            <button class="field-button field-button--primary" type="submit" [disabled]="actionBusy">
              <svg cIcon name="cilSave"></svg>
              Save RDV
            </button>
          </div>
        </form>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'work'">
          <div class="field-section-title">
            <h2>Work step</h2>
            <span>Result</span>
          </div>

          <label class="field-label">
            Work result
            <input class="field-input" type="text" name="repTravauxStt" [(ngModel)]="workForm.repTravauxStt" />
          </label>

          <label class="field-label">
            End date
            <input class="field-input" type="datetime-local" name="dateFinTrv" [(ngModel)]="workForm.dateFinTrv" />
          </label>

          <label class="field-label">
            Comment
            <textarea class="field-textarea" name="cmtTrvStt" [(ngModel)]="workForm.cmtTrvStt"></textarea>
          </label>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'rdv'">Back</button>
            <button class="field-button field-button--primary" type="button" (click)="activeStep = 'metrics'">Next</button>
          </div>
        </section>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'metrics'">
          <div class="field-section-title">
            <h2>Metrics step</h2>
            <span>Technical data</span>
          </div>

          <div class="field-form-grid field-form-grid--two">
            <label class="field-label">
              Cable length
              <input class="field-input" type="number" step="0.01" name="metrageCable" [(ngModel)]="workForm.metrageCable" />
            </label>
            <label class="field-label">
              PV count
              <input class="field-input" type="number" step="1" name="nombrePv" [(ngModel)]="workForm.nombrePv" />
            </label>
            <label class="field-label">
              DL
              <input class="field-input" type="number" step="0.01" name="debitDl" [(ngModel)]="workForm.debitDl" />
            </label>
            <label class="field-label">
              UL
              <input class="field-input" type="number" step="0.01" name="debitUl" [(ngModel)]="workForm.debitUl" />
            </label>
            <label class="field-label">
              RSRP
              <input class="field-input" type="number" step="1" name="rsrp" [(ngModel)]="workForm.rsrp" />
            </label>
            <label class="field-label">
              RSRQ
              <input class="field-input" type="number" step="1" name="rsrq" [(ngModel)]="workForm.rsrq" />
            </label>
            <label class="field-label">
              SINR
              <input class="field-input" type="number" step="1" name="sinr" [(ngModel)]="workForm.sinr" />
            </label>
          </div>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'work'">Back</button>
            <button class="field-button field-button--primary" type="button" (click)="activeStep = 'completion'">Next</button>
          </div>
        </section>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'completion'">
          <div class="field-section-title">
            <h2>Completion step</h2>
            <span>{{ item.workProofs?.length ?? 0 }} proof uploaded</span>
          </div>

          <input #completionProof type="file" accept="image/*,.jpg,.jpeg,.png,.webp" capture="environment" hidden (change)="selectProof($event)" />

          <button class="field-button field-button--ghost" type="button" (click)="completionProof.click()" [disabled]="actionBusy">
            <svg cIcon name="cilMediaRecord"></svg>
            Take Proof Photo
          </button>

          <div class="field-proof-preview" *ngIf="proofPreviewUrl">
            <img [src]="proofPreviewUrl" alt="Selected proof" />
            <div>
              <strong>{{ proofFile?.name }}</strong>
              <span>Ready for upload</span>
            </div>
          </div>

          <div class="field-detail-grid">
            <div class="field-fact">
              <span>Work result</span>
              <strong>{{ workForm.repTravauxStt || '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>End date</span>
              <strong>{{ workForm.dateFinTrv || '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>Comment</span>
              <p>{{ workForm.cmtTrvStt || '-' }}</p>
            </div>
          </div>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'metrics'">Back</button>
            <button class="field-button field-button--success" type="button" (click)="finishWork()" [disabled]="actionBusy">
              <svg cIcon name="cilCheckCircle"></svg>
              Finish
            </button>
          </div>
        </section>
      </ng-container>
    </section>
  `
})
export class FieldExecutionComponent implements OnInit {
  private readonly casesService = inject(CasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  readonly steps: FieldExecutionStepItem[] = [
    { key: 'rdv', label: 'RDV', icon: 'cilCalendar' },
    { key: 'work', label: 'Work', icon: 'cilTask' },
    { key: 'metrics', label: 'Metrics', icon: 'cilChart' },
    { key: 'completion', label: 'Finish', icon: 'cilCheckCircle' }
  ];

  loading = false;
  actionBusy = false;
  error: string | null = null;
  banner: string | null = null;
  bannerTone: BannerTone = 'info';
  activeStep: FieldExecutionStep = 'rdv';
  caseItem: CaseResponse | null = null;
  proofFile: File | null = null;
  proofPreviewUrl: string | null = null;

  rdvForm: FieldRdvForm = this.emptyRdvForm();
  workForm: FieldWorkForm = this.emptyWorkForm();

  ngOnInit(): void {
    this.activeStep = this.stepFromQuery();

    const caseId = this.route.snapshot.paramMap.get('id');
    if (!caseId) {
      this.error = 'Case id is missing.';
      return;
    }

    this.loadCase(caseId);
  }

  get basePath(): string {
    return fieldBasePathFromUrl(this.router.url);
  }

  statusClass(item: CaseResponse): string {
    return fieldStatusClass(item.status);
  }

  statusLabel(item: CaseResponse): string {
    return fieldStatusLabel(item.status);
  }

  location(item: CaseResponse): string {
    return fieldCaseLocation(item);
  }

  saveRdv(): void {
    const target = this.caseItem;
    if (!target) {
      return;
    }

    const payload = this.buildRdvPayload();
    if (!payload) {
      return;
    }

    this.actionBusy = true;
    this.showBanner('Saving RDV...', 'info');

    this.casesService.setRdv(target.id, payload)
      .pipe(finalize(() => {
        this.actionBusy = false;
        this.render();
      }))
      .subscribe({
        next: (updated) => {
          this.caseItem = updated;
          this.rdvForm = this.createRdvForm(updated);
          this.showBanner('RDV saved.', 'success');
          this.activeStep = 'work';
        },
        error: (err) => {
          console.error('Failed to save field RDV', err);
          this.showBanner(err?.error?.message ?? 'Unable to save RDV.', 'danger');
        }
      });
  }

  async selectProof(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showBanner('Use an image file for proof.', 'danger');
      if (input) {
        input.value = '';
      }
      return;
    }

    this.proofFile = file;
    this.proofPreviewUrl = await this.readFileAsDataUrl(file);
    this.showBanner('Proof selected.', 'success');
    if (input) {
      input.value = '';
    }
  }

  async finishWork(): Promise<void> {
    const target = this.caseItem;
    if (!target) {
      return;
    }

    const payload = await this.buildWorkPayload();
    if (!payload) {
      return;
    }

    if (!this.proofFile && !target.workProofs?.length) {
          this.showBanner('Take a proof photo before finishing.', 'danger');
      return;
    }

    this.actionBusy = true;
    this.showBanner('Finishing work...', 'info');

    try {
      let updated = await firstValueFrom(this.casesService.completeWork(target.id, payload));

      if (this.proofFile) {
        const location = await this.captureLocation();
        updated = await firstValueFrom(this.casesService.uploadWorkProof(target.id, this.proofFile, {
          locationLatitude: location?.latitude ?? null,
          locationLongitude: location?.longitude ?? null,
          locationCapturedAt: location?.capturedAt ?? null,
          locationAccuracyMeters: location?.accuracyMeters ?? null,
          captureSource: 'camera'
        }));
      }

      this.caseItem = updated;
      this.showBanner('Work finished.', 'success');
      await this.router.navigateByUrl(`${this.basePath}/tasks/${updated.id}`);
    } catch (err: any) {
      console.error('Failed to finish field work', err);
      this.showBanner(err?.error?.message ?? 'Unable to finish work.', 'danger');
    } finally {
      this.actionBusy = false;
      this.render();
    }
  }

  private loadCase(caseId: string): void {
    this.loading = true;
    this.error = null;

    this.casesService.getCaseById(caseId)
      .pipe(finalize(() => {
        this.loading = false;
        this.render();
      }))
      .subscribe({
        next: (item) => {
          this.caseItem = item;
          this.rdvForm = this.createRdvForm(item);
          this.workForm = this.createWorkForm(item);
        },
        error: (err) => {
          console.error('Failed to load field execution case', err);
          this.error = err?.error?.message ?? 'Unable to load execution flow.';
        }
      });
  }

  private buildRdvPayload(): SetRdvRequest | null {
    const datePriseRdv = toIso(this.rdvForm.datePriseRdv);

    if (!datePriseRdv) {
      this.showBanner('RDV date is required.', 'danger');
      return null;
    }

    if (!this.rdvForm.joignable && !this.rdvForm.causeInjoignabilite.trim()) {
      this.showBanner('Add the non-reachability cause.', 'danger');
      return null;
    }

    if (this.rdvForm.abandon && !this.rdvForm.causeAbandon.trim()) {
      this.showBanner('Add the abandon cause.', 'danger');
      return null;
    }

    return {
      joignable: this.rdvForm.joignable,
      datePriseRdv,
      causeInjoignabilite: this.rdvForm.joignable ? null : this.toNullable(this.rdvForm.causeInjoignabilite),
      detail: this.rdvForm.detail.trim(),
      cmtRdv: this.rdvForm.cmtRdv.trim(),
      abandon: this.rdvForm.abandon,
      causeAbandon: this.rdvForm.abandon ? this.toNullable(this.rdvForm.causeAbandon) : null
    };
  }

  private async buildWorkPayload(): Promise<CompleteWorkRequest | null> {
    const repTravauxStt = this.workForm.repTravauxStt.trim();
    const dateFinTrv = toIso(this.workForm.dateFinTrv);
    const cmtTrvStt = this.workForm.cmtTrvStt.trim();

    if (!repTravauxStt || !dateFinTrv || !cmtTrvStt) {
      this.showBanner('Work result, end date, and comment are required.', 'danger');
      return null;
    }

    const location = await this.captureLocation();

    return {
      repTravauxStt,
      dateFinTrv,
      cmtTrvStt,
      metrageCable: toMaybeNumber(this.workForm.metrageCable),
      nombrePv: toMaybeNumber(this.workForm.nombrePv),
      debitDl: toMaybeNumber(this.workForm.debitDl),
      debitUl: toMaybeNumber(this.workForm.debitUl),
      rsrp: toMaybeNumber(this.workForm.rsrp),
      rsrq: toMaybeNumber(this.workForm.rsrq),
      sinr: toMaybeNumber(this.workForm.sinr),
      locationLatitude: location?.latitude,
      locationLongitude: location?.longitude,
      locationCapturedAt: location?.capturedAt,
      locationAccuracyMeters: location?.accuracyMeters ?? undefined
    };
  }

  private createRdvForm(item: CaseResponse): FieldRdvForm {
    const rdv = extractRdv(item);

    return {
      joignable: rdv.joignable !== false,
      datePriseRdv: toDateTimeLocal(rdv.datePriseRdv),
      causeInjoignabilite: rdv.causeInjoignabilite ?? '',
      detail: rdv.detail ?? '',
      cmtRdv: rdv.cmtRdv ?? '',
      abandon: rdv.abandon ?? false,
      causeAbandon: rdv.causeAbandon ?? ''
    };
  }

  private createWorkForm(item: CaseResponse): FieldWorkForm {
    const work = extractWork(item);
    const metrics = extractMetrics(item);

    return {
      repTravauxStt: work.repTravauxStt ?? '',
      dateFinTrv: toDateTimeLocal(work.dateFinTrv) || toDateTimeLocal(new Date().toISOString()),
      cmtTrvStt: work.cmtTrvStt ?? '',
      metrageCable: metrics.metrageCable == null ? '' : String(metrics.metrageCable),
      nombrePv: metrics.nombrePv == null ? '' : String(metrics.nombrePv),
      debitDl: metrics.debitDl == null ? '' : String(metrics.debitDl),
      debitUl: metrics.debitUl == null ? '' : String(metrics.debitUl),
      rsrp: metrics.rsrp == null ? '' : String(metrics.rsrp),
      rsrq: metrics.rsrq == null ? '' : String(metrics.rsrq),
      sinr: metrics.sinr == null ? '' : String(metrics.sinr)
    };
  }

  private emptyRdvForm(): FieldRdvForm {
    return {
      joignable: true,
      datePriseRdv: '',
      causeInjoignabilite: '',
      detail: '',
      cmtRdv: '',
      abandon: false,
      causeAbandon: ''
    };
  }

  private emptyWorkForm(): FieldWorkForm {
    return {
      repTravauxStt: '',
      dateFinTrv: '',
      cmtTrvStt: '',
      metrageCable: '',
      nombrePv: '',
      debitDl: '',
      debitUl: '',
      rsrp: '',
      rsrq: '',
      sinr: ''
    };
  }

  private async captureLocation(): Promise<FieldGeoSnapshot | null> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
            accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
      );
    });
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Unable to read proof image.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read proof image.'));
      reader.readAsDataURL(file);
    });
  }

  private stepFromQuery(): FieldExecutionStep {
    const value = this.route.snapshot.queryParamMap.get('step');
    return value === 'work' || value === 'metrics' || value === 'completion' || value === 'rdv'
      ? value
      : 'rdv';
  }

  private toNullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private showBanner(message: string, tone: BannerTone): void {
    this.banner = message;
    this.bannerTone = tone;
    this.render();
  }

  private render(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
