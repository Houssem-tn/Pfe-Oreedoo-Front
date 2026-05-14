import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize, firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import {
  CaseDiagnosis,
  CaseResponse,
  CaseUsedEquipmentItem,
  ComplaintCategory,
  ComplaintDiagnosisRequest,
  CompleteWorkRequest,
  SetRdvRequest
} from '../../core/cases/models/case.model';
import {
  buildUsedEquipmentPayload,
  EquipmentUsageLine,
  extractMetrics,
  extractRdv,
  extractWork,
  toDateTimeLocal,
  toIso,
  toMaybeNumber,
  usageLinesFromCaseItems
} from '../tech/tech-case.helpers';
import {
  fieldBasePathFromUrl,
  fieldCaseLocation,
  fieldStatusClass,
  fieldStatusLabel
} from './field-case-utils';
import { OcrService } from '../../core/ocr/ocr.service';
import { StockService } from '../../core/stock/stock.service';
import { TechStock, TechStockItem } from '../../core/stock/stock.model';

type FieldExecutionStep = 'rdv' | 'diagnosis' | 'work' | 'metrics' | 'completion';
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
  nombrePv: string;
  debitDl: string;
  debitUl: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}

interface FieldDiagnosisForm {
  complaintCategory: ComplaintCategory;
  rootCause: string;
  diagnosisComment: string;
  requiresFieldWork: boolean;
  requiresTechIntervention: boolean;
  requiresEscalation: boolean;
}

interface FieldGeoSnapshot {
  latitude: number;
  longitude: number;
  capturedAt: string;
  accuracyMeters?: number | null;
}

interface FieldProofAttachment {
  file: File;
  captureSource: string;
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
          <ng-container *ngFor="let step of steps; let i = index; let last = last">
            <button
              type="button"
              class="field-step"
              [class.field-step--done]="stepState(step) === 'completed'"
              [class.field-step--active]="stepState(step) === 'active'"
              (click)="activeStep = step.key"
            >
              <div class="field-step__bubble">
                <svg cIcon name="cilCheck" *ngIf="stepState(step) === 'completed'"></svg>
                <span *ngIf="stepState(step) !== 'completed'">{{ i + 1 }}</span>
              </div>
              <span class="field-step__label">{{ step.label }}</span>
            </button>
            <div class="field-step__line" *ngIf="!last" [class.field-step__line--done]="stepState(step) === 'completed'"></div>
          </ng-container>
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
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = showDiagnosisStep ? 'diagnosis' : 'work'">Next</button>
            <button class="field-button field-button--primary" type="submit" [disabled]="actionBusy">
              <svg cIcon name="cilSave"></svg>
              Save RDV
            </button>
          </div>
        </form>

        <form class="field-card field-form-grid" *ngIf="activeStep === 'diagnosis' && showDiagnosisStep" (ngSubmit)="saveDiagnosis()">
          <div class="field-section-title">
            <h2>Diagnosis step</h2>
            <span>Decision</span>
          </div>

          <label class="field-label">
            Complaint category
            <select class="field-input" name="complaintCategory" [(ngModel)]="diagnosisForm.complaintCategory" [disabled]="!canEditDiagnosis">
              <option *ngFor="let option of complaintCategoryOptions" [ngValue]="option.value">{{ option.label }}</option>
            </select>
          </label>

          <label class="field-label">
            Root cause
            <input class="field-input" type="text" name="rootCause" [(ngModel)]="diagnosisForm.rootCause" [disabled]="!canEditDiagnosis" />
          </label>

          <label class="field-label">
            Diagnosis comment
            <textarea class="field-textarea" name="diagnosisComment" [(ngModel)]="diagnosisForm.diagnosisComment" [disabled]="!canEditDiagnosis"></textarea>
          </label>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="diagnosisForm.requiresFieldWork" (click)="canEditDiagnosis ? diagnosisForm.requiresFieldWork = true : null">
              Field work
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="!diagnosisForm.requiresFieldWork" (click)="canEditDiagnosis ? diagnosisForm.requiresFieldWork = false : null">
              No field work
            </button>
          </div>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="diagnosisForm.requiresTechIntervention" (click)="canEditDiagnosis ? diagnosisForm.requiresTechIntervention = true : null">
              Assign TECH
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="!diagnosisForm.requiresTechIntervention" (click)="canEditDiagnosis ? diagnosisForm.requiresTechIntervention = false : null">
              STT handles
            </button>
          </div>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="diagnosisForm.requiresEscalation" (click)="canEditDiagnosis ? diagnosisForm.requiresEscalation = true : null">
              Escalate
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="!diagnosisForm.requiresEscalation" (click)="canEditDiagnosis ? diagnosisForm.requiresEscalation = false : null">
              No escalation
            </button>
          </div>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'rdv'">Back</button>
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'work'">Next</button>
            <button *ngIf="canEditDiagnosis" class="field-button field-button--primary" type="submit" [disabled]="actionBusy">
              <svg cIcon name="cilSave"></svg>
              Save diagnosis
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
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = showDiagnosisStep ? 'diagnosis' : 'rdv'">Back</button>
            <button class="field-button field-button--primary" type="button" (click)="activeStep = 'metrics'">Next</button>
          </div>
        </section>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'metrics'">
          <div class="field-section-title">
            <h2>Metrics step</h2>
            <span>{{ isTechRole ? 'Used stock and technical data' : 'Technical data' }}</span>
          </div>

          <div class="field-form-grid" *ngIf="isTechRole">
            <div class="field-section-title">
              <span>Used stock</span>
            </div>

            <div class="field-fact">
              <span>Add the equipment consumed on this case. Stock updates only when the work report is finished.</span>
            </div>

            <div class="field-fact" *ngIf="currentCaseUsedEquipment.length > 0">
              <span>This case already has {{ currentCaseUsedEquipment.length }} saved equipment item{{ currentCaseUsedEquipment.length > 1 ? 's' : '' }}. Edit the lines below to update them.</span>
            </div>

            <div *ngIf="techStockLoading" class="field-loading">
              <span class="field-spinner"></span>
              Loading stock...
            </div>

            <div *ngIf="techStockError" class="field-banner field-banner--danger">{{ techStockError }}</div>

            <ng-container *ngIf="!techStockLoading && techStockItems.length > 0">
              <div class="field-usage-picker">
                <div class="field-usage-line" *ngFor="let line of usageLines; let i = index">
                  <select class="field-input field-usage-line__select" [(ngModel)]="line.equipmentId" [name]="'fuEq_' + i" [disabled]="actionBusy">
                    <option value="">Item...</option>
                    <option *ngFor="let item of techStockItems" [value]="item.equipmentId">
                      {{ item.equipmentName }} — {{ stockQuantityLabel(item.remainingQuantity, item.unit) }} left
                    </option>
                  </select>
                  <input class="field-input field-usage-line__qty" type="number" min="1" step="1" [(ngModel)]="line.quantity" [name]="'fuQty_' + i" [disabled]="actionBusy" placeholder="Qty" />
                  <button class="field-usage-line__remove" type="button" (click)="removeUsageLine(i)" [disabled]="actionBusy" *ngIf="usageLines.length > 1">Remove</button>
                </div>
                <button class="field-usage-add" type="button" (click)="addUsageLine()" [disabled]="actionBusy">+ Add item</button>
              </div>

              <div class="field-fact">
                <span>Leave the list empty if no equipment was used. Duplicate lines are merged automatically when you finish work.</span>
              </div>
            </ng-container>

            <div class="field-fact" *ngIf="!techStockLoading && !techStockError && techStockItems.length === 0">
              <span>No stock assigned yet</span>
            </div>
          </div>

          <div class="field-form-grid field-form-grid--two">
            <label class="field-label">
              PV count
              <input class="field-input" type="number" step="1" name="nombrePv" [(ngModel)]="workForm.nombrePv" />
            </label>
          </div>

          <div class="field-section-title" style="margin-top: 1rem">
            <span>Speedtest Extraction</span>
          </div>

          <!-- Fast OCR implementation for Speedtest -->
          <div class="field-form-grid">
            <button class="field-button field-button--ghost" type="button" (click)="speedtestOcrInput.click()" [disabled]="ocrSpeedtestBusy">
              <svg cIcon name="cilPaperclip"></svg>
              {{ ocrSpeedtestBusy ? 'Extracting...' : 'Attach speedtest screenshot' }}
            </button>
            <input #speedtestOcrInput type="file" accept="image/*" hidden (change)="onSpeedtestOcrUpload(speedtestOcrInput)" />
          </div>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="speedtestValidated" (click)="speedtestValidated = true">
              <svg cIcon name="cilCheck"></svg> Validated
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="!speedtestValidated" (click)="speedtestValidated = false">
              <svg cIcon name="cilX"></svg> Modify
            </button>
          </div>

          <div class="field-form-grid field-form-grid--two">
            <label class="field-label">
              DL
              <input class="field-input" type="number" step="0.01" name="debitDl" [(ngModel)]="workForm.debitDl" [disabled]="speedtestValidated" />
            </label>
            <label class="field-label">
              UL
              <input class="field-input" type="number" step="0.01" name="debitUl" [(ngModel)]="workForm.debitUl" [disabled]="speedtestValidated" />
            </label>
          </div>

          <div class="field-section-title" style="margin-top: 1rem">
            <span>Router Signal Extraction</span>
          </div>

          <!-- Fast OCR implementation for Signal -->
          <div class="field-form-grid">
            <button class="field-button field-button--ghost" type="button" (click)="signalOcrInput.click()" [disabled]="ocrSignalBusy">
              <svg cIcon name="cilPaperclip"></svg>
              {{ ocrSignalBusy ? 'Extracting...' : 'Attach router signal screenshot' }}
            </button>
            <input #signalOcrInput type="file" accept="image/*" hidden (change)="onSignalOcrUpload(signalOcrInput)" />
          </div>

          <div class="field-toggle-row">
            <button type="button" class="field-toggle" [class.field-toggle--active]="signalValidated" (click)="signalValidated = true">
              <svg cIcon name="cilCheck"></svg> Validated
            </button>
            <button type="button" class="field-toggle" [class.field-toggle--active]="!signalValidated" (click)="signalValidated = false">
              <svg cIcon name="cilX"></svg> Modify
            </button>
          </div>

          <div class="field-form-grid field-form-grid--two">
            <label class="field-label">
              RSRP
              <input class="field-input" type="number" step="0.01" name="rsrp" [(ngModel)]="workForm.rsrp" [disabled]="signalValidated" />
            </label>
            <label class="field-label">
              RSRQ
              <input class="field-input" type="number" step="0.01" name="rsrq" [(ngModel)]="workForm.rsrq" [disabled]="signalValidated" />
            </label>
            <label class="field-label" style="grid-column: 1 / -1">
              SINR
              <input class="field-input" type="number" step="0.01" name="sinr" [(ngModel)]="workForm.sinr" [disabled]="signalValidated" />
            </label>
          </div>

          <div class="field-button-row" style="margin-top: 1.5rem">
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
  private readonly authStore = inject(AuthStore);
  private readonly casesService = inject(CasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly ocrService = inject(OcrService);
  private readonly stockService = inject(StockService);

  loading = false;
  actionBusy = false;
  error: string | null = null;
  banner: string | null = null;
  bannerTone: BannerTone = 'info';
  activeStep: FieldExecutionStep = 'rdv';
  caseItem: CaseResponse | null = null;
  techStockLoading = false;
  techStockError: string | null = null;
  techStock: TechStock | null = null;
  proofFile: File | null = null;
  proofPreviewUrl: string | null = null;
  speedtestProofFile: File | null = null;
  signalProofFile: File | null = null;
  ocrSignalBusy = false;
  ocrSpeedtestBusy = false;
  speedtestValidated = true;
  signalValidated = true;
  readonly complaintCategoryOptions: Array<{ value: ComplaintCategory; label: string }> = [
    { value: 'NETWORK_COVERAGE', label: 'Network coverage' },
    { value: 'SERVICE_QUALITY', label: 'Service quality' },
    { value: 'INSTALLATION', label: 'Installation' },
    { value: 'EQUIPMENT', label: 'Equipment' },
    { value: 'BILLING', label: 'Billing' },
    { value: 'ACTIVATION_FOLLOW_UP', label: 'Activation follow-up' },
    { value: 'CUSTOMER_EDUCATION', label: 'Customer education' },
    { value: 'OTHER', label: 'Other' }
  ];

  rdvForm: FieldRdvForm = this.emptyRdvForm();
  diagnosisForm: FieldDiagnosisForm = this.emptyDiagnosisForm();
  workForm: FieldWorkForm = this.emptyWorkForm();
  usageLines: EquipmentUsageLine[] = [];

  get steps(): FieldExecutionStepItem[] {
    const steps: FieldExecutionStepItem[] = [
      { key: 'rdv', label: 'RDV', icon: 'cilCalendar' }
    ];

    if (this.showDiagnosisStep) {
      steps.push({ key: 'diagnosis', label: 'Diagnosis', icon: 'cilNotes' });
    }

    steps.push(
      { key: 'work', label: 'Work', icon: 'cilTask' },
      { key: 'metrics', label: 'Metrics', icon: 'cilChart' },
      { key: 'completion', label: 'Finish', icon: 'cilCheckCircle' }
    );

    return steps;
  }

  get showDiagnosisStep(): boolean {
    return this.caseItem?.type === 'PLAINTE';
  }

  stepState(step: FieldExecutionStepItem): 'completed' | 'active' | 'future' {
    const keys = this.steps.map((s) => s.key);
    const activeIndex = keys.indexOf(this.activeStep);
    const stepIndex = keys.indexOf(step.key);
    if (stepIndex < activeIndex) return 'completed';
    if (stepIndex === activeIndex) return 'active';
    return 'future';
  }

  get canEditDiagnosis(): boolean {
    return this.showDiagnosisStep && this.authStore.role() === 'ROLE_STT';
  }

  get isTechRole(): boolean {
    return this.authStore.role() === 'ROLE_TECH';
  }

  get techStockItems(): TechStockItem[] {
    return [...(this.techStock?.items ?? [])].sort((left, right) => {
      const availabilityDelta = right.remainingQuantity - left.remainingQuantity;
      if (availabilityDelta !== 0) {
        return availabilityDelta;
      }

      return left.equipmentName.localeCompare(right.equipmentName);
    });
  }

  get currentCaseUsedEquipment(): CaseUsedEquipmentItem[] {
    return this.caseUsedEquipmentItems(this.caseItem);
  }

  addUsageLine(): void {
    this.usageLines = [...this.usageLines, { equipmentId: '', quantity: '' }];
    this.render();
  }

  removeUsageLine(index: number): void {
    this.usageLines = this.usageLines.filter((_, i) => i !== index);
    this.render();
  }

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

  stockQuantityLabel(quantity: number, unit?: string | null): string {
    return `${quantity} ${this.stockUnitLabel(unit)}`;
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
          this.diagnosisForm = this.createDiagnosisForm(updated);
          this.showBanner('RDV saved.', 'success');
          this.activeStep = updated.type === 'PLAINTE' ? 'diagnosis' : 'work';
        },
        error: (err) => {
          console.error('Failed to save field RDV', err);
          this.showBanner(err?.error?.message ?? 'Unable to save RDV.', 'danger');
        }
      });
  }

  saveDiagnosis(): void {
    const target = this.caseItem;
    if (!target || target.type !== 'PLAINTE') {
      return;
    }

    const payload = this.buildDiagnosisPayload();
    if (!payload) {
      return;
    }

    this.actionBusy = true;
    this.showBanner('Saving diagnosis...', 'info');

    this.casesService.diagnoseComplaint(target.id, payload)
      .pipe(finalize(() => {
        this.actionBusy = false;
        this.render();
      }))
      .subscribe({
        next: async (updated) => {
          this.caseItem = updated;
          this.diagnosisForm = this.createDiagnosisForm(updated);
          this.showBanner('Diagnosis saved.', 'success');

          if (updated.status === 'DIAGNOSIS_STEP') {
            this.activeStep = 'work';
            return;
          }

          await this.router.navigateByUrl(`${this.basePath}/tasks/${updated.id}`);
        },
        error: (err) => {
          console.error('Failed to save diagnosis', err);
          this.showBanner(err?.error?.message ?? 'Unable to save diagnosis.', 'danger');
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
      const proofLocation = this.proofUploadLocation(payload);

      if (this.proofFile) {
        updated = await firstValueFrom(this.casesService.uploadWorkProof(target.id, this.proofFile, {
          ...proofLocation,
          captureSource: 'camera'
        }));
      }

      const extraAttachments: FieldProofAttachment[] = [];

      if (this.speedtestProofFile) {
        extraAttachments.push({ file: this.speedtestProofFile, captureSource: 'speedtest_screenshot' });
      }

      if (this.signalProofFile) {
        extraAttachments.push({ file: this.signalProofFile, captureSource: 'signal_screenshot' });
      }

      const hasNewAttachments = !!this.proofFile || extraAttachments.length > 0;
      const { latestCase, failedAttachments } = await this.uploadExtraProofAttachments(target.id, extraAttachments, proofLocation);
      if (latestCase) {
        updated = latestCase;
      }

      this.caseItem = updated;
      this.setUsageLinesFromCase(updated);
      this.clearPendingProofAttachments();
      this.showBanner(
        failedAttachments.length
          ? `Work finished. Some attached photos could not be uploaded: ${failedAttachments.join(', ')}.`
          : hasNewAttachments
            ? 'Work finished and attached photos saved.'
            : 'Work finished.',
        failedAttachments.length ? 'warning' : 'success'
      );
      await this.router.navigateByUrl(`${this.basePath}/tasks/${updated.id}`);
    } catch (err: any) {
      console.error('Failed to finish field work', err);
      this.showBanner(err?.error?.message ?? 'Unable to finish work.', 'danger');
    } finally {
      this.actionBusy = false;
      this.render();
    }
  }

  async onSignalOcrUpload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || this.ocrSignalBusy) {
      return;
    }

    this.signalProofFile = file;
    this.ocrSignalBusy = true;
    this.showBanner('Extracting signal screen with OCR...', 'info');

    try {
      const responses = await firstValueFrom(this.ocrService.extract([file]));
      const metrics = this.ocrService.parseSignalMetrics(responses);

      const filled: string[] = [];
      if (metrics.sinr != null) {
        this.workForm.sinr = String(metrics.sinr);
        filled.push('SINR');
      }
      if (metrics.rsrp != null) {
        this.workForm.rsrp = String(metrics.rsrp);
        filled.push('RSRP');
      }
      if (metrics.rsrq != null) {
        this.workForm.rsrq = String(metrics.rsrq);
        filled.push('RSRQ');
      }

      if (filled.length === 0) {
        this.showBanner('OCR did not detect any signal values on this image.', 'warning');
      } else {
        this.showBanner(`Signal values filled: ${filled.join(', ')}. Screenshot will be attached to the case.`, 'success');
      }
    } catch (err: any) {
      console.error('OCR signal extraction failed', err);
      this.showBanner(err?.error?.message ?? 'Unable to extract signal values from this image.', 'danger');
    } finally {
      this.ocrSignalBusy = false;
      this.render();
    }
  }

  async onSpeedtestOcrUpload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || this.ocrSpeedtestBusy) {
      return;
    }

    this.speedtestProofFile = file;
    this.ocrSpeedtestBusy = true;
    this.showBanner('Extracting speedtest screen with OCR...', 'info');

    try {
      const responses = await firstValueFrom(this.ocrService.extract([file]));
      const metrics = this.ocrService.parseSpeedtestMetrics(responses);

      const filled: string[] = [];
      if (metrics.debitDl != null) {
        this.workForm.debitDl = String(metrics.debitDl);
        filled.push('DL');
      }
      if (metrics.debitUl != null) {
        this.workForm.debitUl = String(metrics.debitUl);
        filled.push('UL');
      }

      if (filled.length === 0) {
        this.showBanner('OCR did not detect any speedtest values on this image.', 'warning');
      } else {
        this.showBanner(`Speedtest values filled: ${filled.join(', ')}. Screenshot will be attached to the case.`, 'success');
      }
    } catch (err: any) {
      console.error('OCR speedtest extraction failed', err);
      this.showBanner(err?.error?.message ?? 'Unable to extract speedtest values from this image.', 'danger');
    } finally {
      this.ocrSpeedtestBusy = false;
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
          this.diagnosisForm = this.createDiagnosisForm(item);
          this.workForm = this.createWorkForm(item);
          if (this.isTechRole) {
            this.setUsageLinesFromCase(item);
            this.loadTechStock(true);
          } else {
            this.techStock = null;
            this.techStockError = null;
            this.usageLines = [];
          }
          if (item.type !== 'PLAINTE' && this.activeStep === 'diagnosis') {
            this.activeStep = 'work';
          }
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

  private buildDiagnosisPayload(): ComplaintDiagnosisRequest | null {
    if (!this.diagnosisForm.complaintCategory) {
      this.showBanner('Complaint category is required.', 'danger');
      return null;
    }

    if (this.diagnosisForm.requiresEscalation && this.diagnosisForm.requiresTechIntervention) {
      this.showBanner('Choose either escalation or TECH intervention for the next step.', 'danger');
      return null;
    }

    return {
      complaintCategory: this.diagnosisForm.complaintCategory,
      rootCause: this.toNullable(this.diagnosisForm.rootCause),
      diagnosisComment: this.toNullable(this.diagnosisForm.diagnosisComment),
      requiresFieldWork: this.diagnosisForm.requiresFieldWork,
      requiresTechIntervention: this.diagnosisForm.requiresTechIntervention,
      requiresEscalation: this.diagnosisForm.requiresEscalation
    };
  }

  private async buildWorkPayload(): Promise<CompleteWorkRequest | null> {
    const target = this.caseItem;
    if (!target) {
      return null;
    }

    const repTravauxStt = this.workForm.repTravauxStt.trim();
    const dateFinTrv = toIso(this.workForm.dateFinTrv);
    const cmtTrvStt = this.workForm.cmtTrvStt.trim();

    if (!repTravauxStt || !dateFinTrv || !cmtTrvStt) {
      this.showBanner('Work result, end date, and comment are required.', 'danger');
      return null;
    }

    const usedEquipmentPayload = this.isTechRole
      ? buildUsedEquipmentPayload(this.usageLines, this.techStockItems, this.caseUsedEquipmentItems(target))
      : { items: [], error: null };

    if (usedEquipmentPayload.error) {
      this.showBanner(usedEquipmentPayload.error, 'danger');
      return null;
    }

    const location = await this.captureLocation();

    return {
      repTravauxStt,
      dateFinTrv,
      cmtTrvStt,
      nombrePv: toMaybeNumber(this.workForm.nombrePv),
      debitDl: toMaybeNumber(this.workForm.debitDl),
      debitUl: toMaybeNumber(this.workForm.debitUl),
      rsrp: toMaybeNumber(this.workForm.rsrp),
      rsrq: toMaybeNumber(this.workForm.rsrq),
      sinr: toMaybeNumber(this.workForm.sinr),
      locationLatitude: location?.latitude,
      locationLongitude: location?.longitude,
      locationCapturedAt: location?.capturedAt,
      locationAccuracyMeters: location?.accuracyMeters ?? undefined,
      usedEquipment: this.isTechRole ? usedEquipmentPayload.items : undefined
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
      nombrePv: metrics.nombrePv == null ? '' : String(metrics.nombrePv),
      debitDl: metrics.debitDl == null ? '' : String(metrics.debitDl),
      debitUl: metrics.debitUl == null ? '' : String(metrics.debitUl),
      rsrp: metrics.rsrp == null ? '' : String(metrics.rsrp),
      rsrq: metrics.rsrq == null ? '' : String(metrics.rsrq),
      sinr: metrics.sinr == null ? '' : String(metrics.sinr)
    };
  }

  private proofUploadLocation(payload: CompleteWorkRequest): {
    locationLatitude?: number | null;
    locationLongitude?: number | null;
    locationCapturedAt?: string | null;
    locationAccuracyMeters?: number | null;
  } {
    return {
      locationLatitude: payload.locationLatitude ?? null,
      locationLongitude: payload.locationLongitude ?? null,
      locationCapturedAt: payload.locationCapturedAt ?? null,
      locationAccuracyMeters: payload.locationAccuracyMeters ?? null
    };
  }

  private async uploadExtraProofAttachments(
    caseId: string,
    attachments: FieldProofAttachment[],
    location: {
      locationLatitude?: number | null;
      locationLongitude?: number | null;
      locationCapturedAt?: string | null;
      locationAccuracyMeters?: number | null;
    }
  ): Promise<{ latestCase: CaseResponse | null; failedAttachments: string[] }> {
    let latestCase: CaseResponse | null = null;
    const failedAttachments: string[] = [];

    for (const attachment of attachments) {
      try {
        latestCase = await firstValueFrom(this.casesService.uploadWorkProof(caseId, attachment.file, {
          ...location,
          captureSource: attachment.captureSource
        }));
      } catch (err) {
        console.error(`Failed to upload ${attachment.captureSource} attachment`, err);
        failedAttachments.push(this.attachmentLabel(attachment.captureSource));
      }
    }

    return { latestCase, failedAttachments };
  }

  private attachmentLabel(source: string): string {
    switch (source) {
      case 'speedtest_screenshot':
        return 'speedtest screenshot';
      case 'signal_screenshot':
        return 'signal screenshot';
      default:
        return 'attachment';
    }
  }

  private clearPendingProofAttachments(): void {
    this.proofFile = null;
    this.proofPreviewUrl = null;
    this.speedtestProofFile = null;
    this.signalProofFile = null;
  }

  private createDiagnosisForm(item: CaseResponse): FieldDiagnosisForm {
    const diagnosis = this.extractDiagnosis(item);

    return {
      complaintCategory: diagnosis.complaintCategory ?? 'OTHER',
      rootCause: diagnosis.rootCause ?? '',
      diagnosisComment: diagnosis.diagnosisComment ?? item.complaintDescription ?? item.complaintDetail ?? '',
      requiresFieldWork: diagnosis.requiresFieldWork ?? false,
      requiresTechIntervention: diagnosis.requiresTechIntervention ?? false,
      requiresEscalation: diagnosis.requiresEscalation ?? false
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

  private emptyDiagnosisForm(): FieldDiagnosisForm {
    return {
      complaintCategory: 'OTHER',
      rootCause: '',
      diagnosisComment: '',
      requiresFieldWork: false,
      requiresTechIntervention: false,
      requiresEscalation: false
    };
  }

  private emptyWorkForm(): FieldWorkForm {
    return {
      repTravauxStt: '',
      dateFinTrv: '',
      cmtTrvStt: '',
      nombrePv: '',
      debitDl: '',
      debitUl: '',
      rsrp: '',
      rsrq: '',
      sinr: ''
    };
  }

  loadTechStock(resetSelection = false): void {
    if (!this.isTechRole || this.techStockLoading) {
      return;
    }

    this.techStockLoading = true;
    this.techStockError = null;

    if (resetSelection) {
      this.setUsageLinesFromCase(this.caseItem);
    }

    this.stockService.getMyTechStock()
      .pipe(finalize(() => {
        this.techStockLoading = false;
        this.render();
      }))
      .subscribe({
        next: (stock) => {
          this.techStock = stock;
          this.syncUsageSelection(this.caseItem);
        },
        error: (err) => {
          console.error('Failed to load TECH stock for field execution', err);
          this.techStockError = err?.error?.message ?? 'Stock helper is unavailable right now.';
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
    return value === 'work' || value === 'metrics' || value === 'completion' || value === 'rdv' || value === 'diagnosis'
      ? value
      : 'rdv';
  }

  private extractDiagnosis(item: CaseResponse): CaseDiagnosis {
    return item.diagnosis ?? {};
  }

  private toNullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private stockUnitLabel(unit?: string | null): string {
    if (unit === 'METERS') {
      return 'm';
    }

    if (unit === 'PIECES') {
      return 'pcs';
    }

    return unit?.trim() || 'units';
  }

  private caseUsedEquipmentItems(item?: CaseResponse | null): CaseUsedEquipmentItem[] {
    return item ? (extractWork(item).usedEquipment ?? []) : [];
  }

  private setUsageLinesFromCase(item?: CaseResponse | null): void {
    this.usageLines = usageLinesFromCaseItems(this.caseUsedEquipmentItems(item));
  }

  private syncUsageSelection(item?: CaseResponse | null): void {
    const hasUserSelection = this.usageLines.some((line) => line.equipmentId.trim() || String(line.quantity ?? '').trim());
    if (!hasUserSelection) {
      this.setUsageLinesFromCase(item ?? this.caseItem);
    }
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
