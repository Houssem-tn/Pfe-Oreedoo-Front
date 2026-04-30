import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize, firstValueFrom } from 'rxjs';

import { CasesService } from '../../core/cases/cases.service';
import { CaseResponse } from '../../core/cases/models/case.model';
import { extractRdv, extractWork } from '../tech/tech-case.helpers';
import {
  canFinishFieldWork,
  canUpdateFieldRdv,
  fieldBasePathFromUrl,
  fieldCaseLocation,
  fieldCaseOffer,
  fieldMapLink,
  fieldMetricEntries,
  fieldRdvLabel,
  fieldStatusClass,
  fieldStatusLabel,
  fieldWorkLabel
} from './field-case-utils';

interface FieldGeoSnapshot {
  latitude: number;
  longitude: number;
  capturedAt: string;
  accuracyMeters?: number | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective],
  template: `
    <section class="field-page">
      <a class="field-button field-button--ghost" [routerLink]="basePath + '/tasks'">
        <svg cIcon name="cilArrowLeft"></svg>
        Tasks
      </a>

      <div *ngIf="loading" class="field-loading">
        <span class="field-spinner"></span>
        Loading case
      </div>

      <div *ngIf="error" class="field-banner field-banner--danger">{{ error }}</div>
      <div *ngIf="banner" class="field-banner" [ngClass]="'field-banner--' + bannerTone">{{ banner }}</div>

      <ng-container *ngIf="!loading && !error && caseItem as item">
        <div class="field-page__header">
          <div class="field-page__eyebrow">CRM {{ item.crmCase }}</div>
          <h1 class="field-page__title">{{ item.clientName }}</h1>
          <p class="field-page__subtitle">{{ location(item) }}</p>
          <span [class]="statusClass(item)">{{ statusLabel(item) }}</span>
        </div>

        <section class="field-action-grid">
          <a
            class="field-button field-button--primary"
            [routerLink]="basePath + '/tasks/' + item.id + '/execution'"
            [queryParams]="{ step: 'work' }"
          >
            <svg cIcon name="cilMediaPlay"></svg>
            Start Work
          </a>

          <a
            class="field-button field-button--ghost"
            [class.field-button--warning]="canUpdateRdv(item)"
            [routerLink]="basePath + '/tasks/' + item.id + '/execution'"
            [queryParams]="{ step: 'rdv' }"
          >
            <svg cIcon name="cilCalendar"></svg>
            Update RDV
          </a>

          <button class="field-button field-button--ghost" type="button" (click)="proofInput.click()" [disabled]="actionBusy">
            <svg cIcon name="cilMediaRecord"></svg>
            Take Proof Photo
          </button>
          <input #proofInput type="file" accept="image/*,.jpg,.jpeg,.png,.webp" capture="environment" hidden (change)="uploadProof($event)" />

          <a
            class="field-button field-button--success"
            [class.field-button--ghost]="!canFinish(item)"
            [routerLink]="basePath + '/tasks/' + item.id + '/execution'"
            [queryParams]="{ step: 'completion' }"
          >
            <svg cIcon name="cilCheckCircle"></svg>
            Finish
          </a>
        </section>

        <section class="field-card">
          <div class="field-section-title">
            <h2>Client info</h2>
            <span>{{ offer(item) }}</span>
          </div>

          <div class="field-detail-grid">
            <div class="field-fact">
              <span>Phone</span>
              <strong>{{ item.clientPhone || '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>MSISDN</span>
              <strong>{{ item.msisdn || '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>Location</span>
              <strong>{{ location(item) }}</strong>
            </div>
          </div>

          <div class="field-button-row" style="margin-top: 0.9rem;">
            <a class="field-button field-button--primary" [href]="'tel:' + item.clientPhone">
              <svg cIcon name="cilPhone"></svg>
              Call
            </a>
            <a class="field-button field-button--ghost" [href]="mapLink(item)" target="_blank" rel="noopener noreferrer">
              <svg cIcon name="cilMap"></svg>
              Map
            </a>
          </div>
        </section>

        <section class="field-card">
          <div class="field-section-title">
            <h2>Comments</h2>
            <span>{{ proofCount(item) }} proof</span>
          </div>

          <div class="field-detail-grid">
            <div class="field-fact">
              <span>Case comment</span>
              <p>{{ item.commentaire || '-' }}</p>
            </div>
            <div class="field-fact">
              <span>RDV</span>
              <p>{{ rdvComment(item) }}</p>
            </div>
            <div class="field-fact">
              <span>Work</span>
              <p>{{ workComment(item) }}</p>
            </div>
          </div>
        </section>

        <section class="field-card" *ngIf="item.type === 'PLAINTE'">
          <div class="field-section-title">
            <h2>Diagnosis</h2>
            <span>{{ item.diagnosis?.complaintCategory || 'Pending' }}</span>
          </div>

          <div class="field-detail-grid">
            <div class="field-fact">
              <span>Root cause</span>
              <strong>{{ item.diagnosis?.rootCause || '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>TECH needed</span>
              <strong>{{ item.diagnosis?.requiresTechIntervention ? 'Yes' : 'No' }}</strong>
            </div>
            <div class="field-fact">
              <span>Escalation</span>
              <strong>{{ item.diagnosis?.requiresEscalation ? 'Yes' : 'No' }}</strong>
            </div>
            <div class="field-fact">
              <span>Comment</span>
              <p>{{ item.diagnosis?.diagnosisComment || '-' }}</p>
            </div>
          </div>
        </section>

        <section class="field-card">
          <div class="field-section-title">
            <h2>Technical data</h2>
            <span>{{ workLabel(item) }}</span>
          </div>

          <div class="field-metric-grid">
            <div class="field-fact" *ngFor="let metric of metrics(item)">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
        </section>

        <section class="field-card" *ngIf="item.type === 'PLAINTE'">
          <div class="field-section-title">
            <h2>Resolution</h2>
            <span>{{ item.resolution?.validationStatus || 'Pending' }}</span>
          </div>

          <div class="field-detail-grid">
            <div class="field-fact">
              <span>Resolution type</span>
              <strong>{{ item.resolution?.resolutionType || '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>Submitted at</span>
              <strong>{{ item.resolution?.submittedAt ? (item.resolution?.submittedAt | date:'short') : '-' }}</strong>
            </div>
            <div class="field-fact">
              <span>Resolution comment</span>
              <p>{{ item.resolution?.resolutionComment || '-' }}</p>
            </div>
          </div>
        </section>
      </ng-container>
    </section>
  `
})
export class FieldCaseDetailComponent implements OnInit {
  private readonly casesService = inject(CasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  loading = false;
  actionBusy = false;
  error: string | null = null;
  banner: string | null = null;
  bannerTone: 'success' | 'warning' | 'danger' | 'info' = 'info';
  caseItem: CaseResponse | null = null;

  ngOnInit(): void {
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

  canFinish(item: CaseResponse): boolean {
    return canFinishFieldWork(item);
  }

  canUpdateRdv(item: CaseResponse): boolean {
    return canUpdateFieldRdv(item);
  }

  location(item: CaseResponse): string {
    return fieldCaseLocation(item);
  }

  offer(item: CaseResponse): string {
    return fieldCaseOffer(item);
  }

  mapLink(item: CaseResponse): string {
    return fieldMapLink(item);
  }

  statusClass(item: CaseResponse): string {
    return fieldStatusClass(item.status);
  }

  statusLabel(item: CaseResponse): string {
    return fieldStatusLabel(item.status);
  }

  workLabel(item: CaseResponse): string {
    return fieldWorkLabel(item);
  }

  metrics(item: CaseResponse): ReturnType<typeof fieldMetricEntries> {
    return fieldMetricEntries(item);
  }

  rdvComment(item: CaseResponse): string {
    const rdv = extractRdv(item);
    return [fieldRdvLabel(item), rdv.detail, rdv.cmtRdv].filter((value) => !!value?.trim()).join(' | ') || '-';
  }

  workComment(item: CaseResponse): string {
    const work = extractWork(item);
    return [work.repTravauxStt, work.cmtTrvStt].filter((value) => !!value?.trim()).join(' | ') || '-';
  }

  proofCount(item: CaseResponse): number {
    return item.workProofs?.length ?? 0;
  }

  async uploadProof(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    const target = this.caseItem;

    if (!file || !target) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showBanner('Use an image file for proof.', 'danger');
      input.value = '';
      return;
    }

    this.actionBusy = true;
    this.showBanner('Uploading proof...', 'info');

    try {
      const location = await this.captureLocation();
      const updated = await firstValueFrom(this.casesService.uploadWorkProof(target.id, file, {
        locationLatitude: location?.latitude ?? null,
        locationLongitude: location?.longitude ?? null,
        locationCapturedAt: location?.capturedAt ?? null,
        locationAccuracyMeters: location?.accuracyMeters ?? null,
        captureSource: 'camera'
      }));

      this.caseItem = updated;
      this.showBanner(location ? 'Proof uploaded with GPS.' : 'Proof uploaded.', 'success');
    } catch (err: any) {
      console.error('Failed to upload field proof', err);
      this.showBanner(err?.error?.message ?? 'Unable to upload proof.', 'danger');
    } finally {
      this.actionBusy = false;
      this.render();
      input.value = '';
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
        },
        error: (err) => {
          console.error('Failed to load field case detail', err);
          this.error = err?.error?.message ?? 'Unable to load this case.';
        }
      });
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

  private showBanner(message: string, tone: 'success' | 'warning' | 'danger' | 'info'): void {
    this.banner = message;
    this.bannerTone = tone;
    this.render();
  }

  private render(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
