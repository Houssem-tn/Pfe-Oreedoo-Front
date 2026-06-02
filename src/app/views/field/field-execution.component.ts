import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { Subscription, finalize, firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import {
  CaseDiagnosis,
  CaseResponse,
  CaseUsedEquipmentItem,
  ComplaintCategory,
  ComplaintDiagnosisRequest,
  CompleteWorkRequest,
  EquipmentItemProofPayload,
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
import {
  CaseLimitItem,
  CreatePermissionRequest,
  StockUsagePermission,
  TechStock,
  TechStockItem
} from '../../core/stock/stock.model';
import { StockUsagePermissionService } from '../../core/stock/stock-usage-permission.service';
import { SwalService } from '../../core/ui/swal.service';
import { NotificationItem } from '../../core/notifications/models/notification.model';
import { NotificationWsService } from '../../core/notifications/notification-ws.service';

type FieldExecutionStep = 'rdv' | 'diagnosis' | 'stock' | 'work' | 'metrics' | 'completion';
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

interface EquipmentItemProof {
  file: File;
  previewUrl: string;
  ocrBusy: boolean;
  validated: boolean;
  ocrWarnings: string[];
  needsReview: boolean;
  modemModel: string;
  macAddress: string;
  serialNumber: string;
  imei: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  capturedAt: string | null;
}

interface OverLimitLine {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  limit: number;
  unit: string;
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
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = showDiagnosisStep ? 'diagnosis' : firstExecutionStep">Next</button>
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
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = firstExecutionStep">Next</button>
            <button *ngIf="canEditDiagnosis" class="field-button field-button--primary" type="submit" [disabled]="actionBusy">
              <svg cIcon name="cilSave"></svg>
              Save diagnosis
            </button>
          </div>
        </form>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'stock' && isTechRole">
          <div class="field-section-title">
            <h2>Stock step</h2>
            <span>Declare used stock first</span>
          </div>

          <div class="field-fact">
            <span>Add the equipment consumed on this case before continuing to work and metrics.</span>
          </div>

          <div class="field-fact" *ngIf="currentCaseUsedEquipment.length > 0">
            <span>This case already has {{ currentCaseUsedEquipment.length }} saved equipment item{{ currentCaseUsedEquipment.length > 1 ? 's' : '' }}.</span>
          </div>

          <div *ngIf="techStockLoading" class="field-loading">
            <span class="field-spinner"></span>
            Loading stock...
          </div>

          <div *ngIf="techStockError" class="field-banner field-banner--danger">{{ techStockError }}</div>

          <ng-container *ngIf="!techStockLoading && techStockItems.length > 0">
            <div class="field-usage-picker">
              <div class="field-usage-line" *ngFor="let line of usageLines; let i = index">
                <select class="field-input field-usage-line__select" [(ngModel)]="line.equipmentId" [name]="'fsEq_' + i" [disabled]="actionBusy">
                  <option value="">Item...</option>
                  <option *ngFor="let stockItem of techStockItems" [value]="stockItem.equipmentId">
                    {{ stockItem.equipmentName }} - {{ stockQuantityLabel(stockItem.remainingQuantity, stockItem.unit) }} left
                  </option>
                </select>
                <input class="field-input field-usage-line__qty" type="number" min="1" step="1" [(ngModel)]="line.quantity" [name]="'fsQty_' + i" [disabled]="actionBusy" placeholder="Qty" />
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

          <div *ngIf="caseLimitsLoading" class="field-loading field-loading--compact">
            <span class="field-spinner"></span>
            Checking case limits...
          </div>

          <section *ngIf="hasOverLimit" class="field-stock-check field-stock-check--danger">
            <div class="field-section-title">
              <h2>Permission required</h2>
              <span>STT approval is needed</span>
            </div>

            <p class="field-stock-check__copy">
              Your declared usage exceeds the per-case limit configured for this intervention.
            </p>

            <div class="field-stock-table">
              <div class="field-stock-table__head">
                <span>Item</span>
                <span>Requested</span>
                <span>Allowed</span>
              </div>
              <div class="field-stock-table__row" *ngFor="let line of overLimitLines">
                <strong>{{ line.equipmentName }}</strong>
                <span>{{ line.quantity }} {{ stockUnitLabel(line.unit) }}</span>
                <span>{{ line.limit }} {{ stockUnitLabel(line.unit) }}</span>
              </div>
            </div>
          </section>

          <div class="field-stock-check field-stock-check--success" *ngIf="!caseLimitsLoading && !hasOverLimit && hasAnyUsageLine">
            Usage is within the allowed limits. No STT permission is required.
          </div>

          <section
            *ngIf="showStockPermissionCard"
            class="field-permission-card"
            [ngClass]="'field-permission-card--' + permissionStatusTone(activeCasePermission?.status)"
          >
            <div class="field-permission-card__header">
              <div>
                <h3>{{ stockPermissionCardTitle }}</h3>
                <p>{{ stockPermissionHeadline }}</p>
              </div>
              <span class="field-permission-status" *ngIf="activeCasePermission">
                {{ permissionStatusLabel(activeCasePermission.status) }}
              </span>
            </div>

            <div class="field-permission-card__body" *ngIf="stockPermissionErrorMessage">
              <p>{{ stockPermissionErrorMessage }}</p>
            </div>

            <div class="field-permission-card__meta">
              <div class="field-permission-card__meta-item">
                <span>Requested usage</span>
                <p *ngIf="permissionRequestCableMeters > 0">Cable: {{ permissionRequestCableMeters }}m</p>
                <ul class="field-permission-list field-permission-list--compact" *ngIf="permissionRequestEquipmentItems.length > 0">
                  <li *ngFor="let line of permissionRequestEquipmentItems">
                    <span>{{ line.equipmentName }}</span>
                    <strong>{{ line.quantity }} {{ stockUnitLabel(line.unit) }}</strong>
                  </li>
                </ul>
              </div>

              <div class="field-permission-card__meta-item" *ngIf="activeCasePermission && showApprovedPermissionSummary">
                <span>Approved usage</span>
                <p *ngIf="activeCasePermission.approvedCableMeters > 0">Cable: {{ activeCasePermission.approvedCableMeters }}m</p>
                <ul class="field-permission-list field-permission-list--compact" *ngIf="activeCasePermission.approvedItems?.length">
                  <li *ngFor="let permissionItem of activeCasePermission.approvedItems">
                    <span>{{ permissionItem.itemName }}</span>
                    <strong>{{ permissionItem.approvedQuantity }} {{ stockUnitLabel(permissionItem.unit) }}</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div class="field-permission-card__body" *ngIf="activeCasePermission?.reviewComment">
              <p><strong>STT note:</strong> {{ activeCasePermission?.reviewComment }}</p>
            </div>

            <div class="field-permission-card__body" *ngIf="stockStepBlocked">
              <p class="field-permission-card__notice">{{ completionPermissionNotice }}</p>
            </div>

            <div class="field-permission-card__actions" *ngIf="canRequestNewPermission">
              <button
                class="field-button field-button--warning"
                type="button"
                (click)="openPermissionModal()"
                [disabled]="permissionsLoading || permissionSaving"
              >
                Ask STT Permission
              </button>
            </div>
          </section>

          <div class="field-button-row" style="margin-top: 1.5rem">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = showDiagnosisStep ? 'diagnosis' : 'rdv'">Back</button>
            <button class="field-button field-button--primary" type="button" (click)="activeStep = 'work'" [disabled]="stockStepBlocked">
              {{ stockStepBlocked ? 'Waiting for STT approval' : 'Next: Work' }}
            </button>
          </div>
        </section>

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
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = isTechRole ? 'stock' : (showDiagnosisStep ? 'diagnosis' : 'rdv')">Back</button>
            <button class="field-button field-button--primary" type="button" (click)="activeStep = 'metrics'">Next</button>
          </div>
        </section>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'metrics'">
          <div class="field-section-title">
            <h2>Metrics step</h2>
            <span>Technical data</span>
          </div>

          <div class="field-form-grid" *ngIf="false && isTechRole">
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

          <div class="field-section-title" style="margin-top: 1.5rem">
            <span>Equipment Proof Photos</span>
            <span class="field-badge" [class.field-badge--success]="itemProofs.length > 0" [class.field-badge--warning]="itemProofs.length === 0">
              {{ itemProofs.length }} added
            </span>
          </div>

          <p class="field-hint">
            Take a photo of each router, modem, or device label. At least one photo is required.
            MAC address and serial number are required per item.
          </p>

          <div class="field-form-grid">
            <button class="field-button field-button--ghost" type="button" (click)="itemProofInput.click()" [disabled]="actionBusy">
              <svg cIcon name="cilCamera"></svg>
              Add Item Photo
            </button>
            <input #itemProofInput
                   type="file"
                   accept="image/*"
                   capture="environment"
                   hidden
                   (change)="addItemProof(itemProofInput)" />
          </div>

          <div class="field-alert field-alert--warning" *ngIf="itemProofs.length === 0">
            <svg cIcon name="cilWarning"></svg>
            At least one equipment photo is required before finishing.
          </div>

          <div class="field-item-proof" *ngFor="let proof of itemProofs; let i = index">

            <!-- Contained image preview -->
            <div class="field-item-proof__preview" *ngIf="proof.previewUrl">
              <img [src]="proof.previewUrl" [alt]="'Item ' + (i + 1)" class="field-item-proof__img" />
            </div>
            <div class="field-item-proof__placeholder" *ngIf="!proof.previewUrl && proof.ocrBusy">
              <span class="field-spinner"></span>
            </div>

            <!-- Padded body: header row, alerts, form -->
            <div class="field-item-proof__body">

              <div class="field-item-proof__header">
                <div class="field-item-proof__meta">
                  <strong>Item {{ i + 1 }}</strong>
                  <div class="field-item-proof__badges">
                    <span class="field-badge field-badge--info" *ngIf="proof.ocrBusy">Processing...</span>
                    <span class="field-badge field-badge--success" *ngIf="!proof.ocrBusy && proof.latitude != null">GPS OK</span>
                    <span class="field-badge field-badge--danger" *ngIf="!proof.ocrBusy && proof.latitude == null">No GPS</span>
                  </div>
                </div>
                <button class="field-button field-button--ghost field-item-proof__remove" type="button" (click)="removeItemProof(i)" [disabled]="actionBusy">
                  Remove
                </button>
              </div>

              <div class="field-alert field-alert--warning" *ngIf="proof.needsReview || proof.ocrWarnings.length > 0">
                <svg cIcon name="cilWarning"></svg>
                Please verify the extracted information for this item.
              </div>

              <div class="field-alert field-alert--info" *ngIf="!proof.ocrBusy && !proof.imei">
                <svg cIcon name="cilInfo"></svg>
                IMEI not found — you can continue without it.
              </div>

              <div class="field-toggle-row">
                <button type="button" class="field-toggle" [class.field-toggle--active]="proof.validated" (click)="proof.validated = true">
                  <svg cIcon name="cilCheck"></svg> Validated
                </button>
                <button type="button" class="field-toggle" [class.field-toggle--active]="!proof.validated" (click)="proof.validated = false">
                  <svg cIcon name="cilX"></svg> Modify
                </button>
              </div>

              <div class="field-form-grid field-form-grid--two">
                <label class="field-label">
                  Model
                  <input class="field-input" type="text" [name]="'iModel_' + i" [(ngModel)]="proof.modemModel" [disabled]="proof.validated || proof.ocrBusy" placeholder="e.g. ZLT W51" />
                </label>
                <label class="field-label">
                  MAC Address *
                  <input class="field-input" type="text" [name]="'iMac_' + i" [(ngModel)]="proof.macAddress" [disabled]="proof.validated || proof.ocrBusy" placeholder="e.g. 98:A9:42:FF:24:DA" />
                </label>
                <label class="field-label">
                  Serial Number *
                  <input class="field-input" type="text" [name]="'iSn_' + i" [(ngModel)]="proof.serialNumber" [disabled]="proof.validated || proof.ocrBusy" placeholder="e.g. W51P740912346" />
                </label>
                <label class="field-label">
                  IMEI
                  <input class="field-input" type="text" [name]="'iImei_' + i" [(ngModel)]="proof.imei" [disabled]="proof.validated || proof.ocrBusy" placeholder="Optional" />
                </label>
              </div>

            </div>
          </div>

          <div class="field-button-row" style="margin-top: 1.5rem">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'work'">Back</button>
            <button class="field-button field-button--primary" type="button" (click)="proceedToCompletion()">Next</button>
          </div>
        </section>

        <section class="field-card field-form-grid" *ngIf="activeStep === 'completion'">
          <div class="field-section-title">
            <h2>Finish work</h2>
            <span>Confirmation</span>
          </div>

          <section
            *ngIf="showStockPermissionCard"
            class="field-permission-card"
            [ngClass]="'field-permission-card--' + permissionStatusTone(activeCasePermission?.status)"
          >
            <div class="field-permission-card__header">
              <div>
                <h3>{{ stockPermissionCardTitle }}</h3>
                <p>{{ stockPermissionHeadline }}</p>
              </div>
              <span class="field-permission-status" *ngIf="activeCasePermission">
                {{ permissionStatusLabel(activeCasePermission.status) }}
              </span>
            </div>

            <div class="field-permission-card__body" *ngIf="stockPermissionErrorMessage">
              <p>{{ stockPermissionErrorMessage }}</p>
            </div>

            <div class="field-permission-card__meta">
              <div class="field-permission-card__meta-item">
                <span>Requested usage</span>
                <p *ngIf="permissionRequestCableMeters > 0">Cable: {{ permissionRequestCableMeters }}m</p>
                <ul class="field-permission-list field-permission-list--compact" *ngIf="permissionRequestEquipmentItems.length > 0">
                  <li *ngFor="let line of permissionRequestEquipmentItems">
                    <span>{{ line.equipmentName }}</span>
                    <strong>{{ line.quantity }} {{ stockUnitLabel(line.unit) }}</strong>
                  </li>
                </ul>
                <p *ngIf="permissionRequestCableMeters <= 0 && permissionRequestEquipmentItems.length === 0">
                  No over-limit stock selected right now.
                </p>
              </div>

              <div class="field-permission-card__meta-item" *ngIf="activeCasePermission && showApprovedPermissionSummary">
                <span>Approved usage</span>
                <p *ngIf="activeCasePermission.approvedCableMeters > 0">Cable: {{ activeCasePermission.approvedCableMeters }}m</p>
                <ul class="field-permission-list field-permission-list--compact" *ngIf="activeCasePermission.approvedItems?.length">
                  <li *ngFor="let item of activeCasePermission.approvedItems">
                    <span>{{ item.itemName }}</span>
                    <strong>{{ item.approvedQuantity }} {{ stockUnitLabel(item.unit) }}</strong>
                  </li>
                </ul>
                <p *ngIf="!activeCasePermission.approvedCableMeters && !activeCasePermission.approvedItems?.length">
                  No approved extra quantity was recorded.
                </p>
              </div>
            </div>

            <div class="field-permission-card__body" *ngIf="activeCasePermission?.reviewComment">
              <p>
                <strong>STT note:</strong>
                {{ activeCasePermission?.reviewComment }}
              </p>
            </div>

            <div class="field-permission-card__body" *ngIf="completionBlockedByPermission">
              <p class="field-permission-card__notice">{{ completionPermissionNotice }}</p>
            </div>

            <div class="field-permission-card__actions" *ngIf="canRequestNewPermission">
              <button
                class="field-button field-button--warning"
                type="button"
                (click)="openPermissionModal()"
                [disabled]="permissionsLoading || permissionSaving"
              >
                Ask STT Permission
              </button>
            </div>
          </section>

          <div class="field-alert field-alert--info">
            <svg cIcon name="cilInfo"></svg>
            Review the summary below and confirm to submit the work report.
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
            <div class="field-fact">
              <span>Equipment photos</span>
              <strong>{{ itemProofs.length }} photo{{ itemProofs.length !== 1 ? 's' : '' }} ready</strong>
            </div>
          </div>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="activeStep = 'metrics'">Back</button>
            <button class="field-button field-button--success" type="button" (click)="finishWork()" [disabled]="actionBusy || completionBlockedByPermission">
              <svg cIcon name="cilCheckCircle"></svg>
              {{ completionBlockedByPermission ? 'Waiting for STT approval' : 'Finish' }}
            </button>
          </div>
        </section>
      </ng-container>

      <div *ngIf="permissionModalOpen" class="field-modal-backdrop" (click)="closePermissionModal()">
        <section class="field-modal field-card" (click)="$event.stopPropagation()">
          <div class="field-section-title">
            <h2>Ask STT Permission</h2>
            <span>Over-limit stock request</span>
          </div>

          <div class="field-modal__meta">
            <div class="field-fact">
              <span>Case reference</span>
              <strong>{{ caseReferenceLabel }}</strong>
            </div>
            <div class="field-fact">
              <span>Case id</span>
              <strong>{{ caseItem?.id ?? '-' }}</strong>
            </div>
          </div>

          <div class="field-modal__summary" *ngIf="permissionRequestCableMeters > 0">
            <strong>Cable requested:</strong>
            <span>{{ permissionRequestCableMeters }}m</span>
          </div>

          <div class="field-modal__summary" *ngIf="permissionRequestEquipmentItems.length > 0">
            <strong>Requested equipment</strong>
            <ul class="field-permission-list">
              <li *ngFor="let line of permissionRequestEquipmentItems">
                <span>{{ line.equipmentName }}</span>
                <strong>{{ line.quantity }} {{ stockUnitLabel(line.unit) }}</strong>
              </li>
            </ul>
          </div>

          <label class="field-label">
            Reason
            <textarea
              class="field-textarea"
              name="permissionReason"
              rows="4"
              [(ngModel)]="permissionReason"
              placeholder="Explain why this intervention needs extra cable or equipment."
            ></textarea>
          </label>

          <div class="field-modal__hint">A reason is required before the request can be sent to your STT.</div>

          <div class="field-button-row">
            <button class="field-button field-button--ghost" type="button" (click)="closePermissionModal()" [disabled]="permissionSaving">
              Cancel
            </button>
            <button
              class="field-button field-button--primary"
              type="button"
              (click)="submitPermissionRequest()"
              [disabled]="permissionSaving || !permissionReason.trim()"
            >
              {{ permissionSaving ? 'Sending...' : 'Send Request' }}
            </button>
          </div>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .field-permission-card {
      border: 1px solid rgba(229, 165, 10, 0.28);
      border-radius: 1rem;
      padding: 1rem;
      background: linear-gradient(180deg, rgba(255, 248, 229, 0.96), rgba(255, 255, 255, 0.98));
      display: grid;
      gap: 0.85rem;
    }

    .field-permission-card--success {
      border-color: rgba(25, 135, 84, 0.28);
      background: linear-gradient(180deg, rgba(233, 248, 239, 0.96), rgba(255, 255, 255, 0.98));
    }

    .field-permission-card--info {
      border-color: rgba(13, 110, 253, 0.22);
      background: linear-gradient(180deg, rgba(235, 244, 255, 0.96), rgba(255, 255, 255, 0.98));
    }

    .field-permission-card--danger {
      border-color: rgba(220, 53, 69, 0.28);
      background: linear-gradient(180deg, rgba(255, 239, 241, 0.97), rgba(255, 255, 255, 0.98));
    }

    .field-permission-card__header {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      justify-content: space-between;
    }

    .field-permission-card__header h3 {
      margin: 0;
      font-size: 1rem;
    }

    .field-permission-card__header p,
    .field-permission-card__body p,
    .field-permission-card__meta p {
      margin: 0.35rem 0 0;
      color: rgba(26, 26, 26, 0.72);
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .field-permission-status {
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      background: rgba(0, 0, 0, 0.08);
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .field-permission-card__body,
    .field-permission-card__meta {
      display: grid;
      gap: 0.75rem;
    }

    .field-permission-card__meta-item {
      display: grid;
      gap: 0.35rem;
    }

    .field-permission-card__meta-item span {
      font-size: 0.78rem;
      color: rgba(26, 26, 26, 0.58);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .field-permission-list {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.45rem;
      font-size: 0.92rem;
    }

    .field-permission-list li {
      line-height: 1.4;
    }

    .field-permission-list--compact {
      padding-left: 0;
      list-style: none;
    }

    .field-permission-list--compact li {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .field-permission-card__actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .field-permission-card__notice {
      color: #8a1538;
      font-weight: 600;
    }

    .field-loading--compact {
      font-size: 0.92rem;
    }

    .field-stock-check {
      border-radius: 1rem;
      padding: 1rem;
      display: grid;
      gap: 0.75rem;
      border: 1px solid rgba(25, 135, 84, 0.18);
      background: rgba(233, 248, 239, 0.72);
    }

    .field-stock-check--danger {
      border-color: rgba(220, 53, 69, 0.2);
      background: rgba(255, 239, 241, 0.88);
    }

    .field-stock-check--success {
      color: #146c43;
      font-weight: 600;
    }

    .field-stock-check__copy {
      margin: 0;
      color: rgba(26, 26, 26, 0.72);
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .field-stock-table {
      display: grid;
      gap: 0.5rem;
    }

    .field-stock-table__head,
    .field-stock-table__row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 0.8fr));
      gap: 0.75rem;
      align-items: center;
    }

    .field-stock-table__head {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: rgba(26, 26, 26, 0.58);
    }

    .field-stock-table__row {
      border-radius: 0.85rem;
      background: rgba(255, 255, 255, 0.72);
      padding: 0.75rem 0.85rem;
      font-size: 0.92rem;
    }

    .field-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(8, 15, 28, 0.58);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 1rem;
    }

    .field-modal {
      display: grid;
      width: min(32rem, 100%);
      max-height: min(88vh, 42rem);
      overflow: auto;
      gap: 1rem;
    }

    .field-modal__meta {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    }

    .field-modal__summary {
      display: grid;
      gap: 0.5rem;
      font-size: 0.92rem;
    }

    .field-modal__hint {
      font-size: 0.82rem;
      color: rgba(26, 26, 26, 0.62);
      line-height: 1.45;
    }

    @media (max-width: 640px) {
      .field-permission-card__header {
        flex-direction: column;
      }

      .field-permission-status {
        white-space: normal;
      }

      .field-modal-backdrop {
        align-items: stretch;
        padding: 0.75rem;
      }

      .field-modal {
        width: 100%;
        margin-top: auto;
      }
    }
  `]
})
export class FieldExecutionComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly casesService = inject(CasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly ocrService = inject(OcrService);
  private readonly stockService = inject(StockService);
  private readonly stockUsagePermissionService = inject(StockUsagePermissionService);
  private readonly notificationWsService = inject(NotificationWsService);
  private readonly swal = inject(SwalService);

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
  caseLimits: CaseLimitItem[] = [];
  caseLimitsLoading = false;
  permissionsLoading = false;
  permissionSaving = false;
  permissionModalOpen = false;
  permissionReason = '';
  requiresStockPermission = false;
  stockPermissionErrorMessage: string | null = null;
  casePermissions: StockUsagePermission[] = [];
  private wsPermissionSub: Subscription | null = null;
  speedtestProofFile: File | null = null;
  signalProofFile: File | null = null;
  itemProofs: EquipmentItemProof[] = [];
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

    if (this.isTechRole) {
      steps.push({ key: 'stock', label: 'Stock', icon: 'cilStorage' });
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

  get hasAnyUsageLine(): boolean {
    return this.usageLines.some((line) => !!line.equipmentId);
  }

  get overLimitLines(): OverLimitLine[] {
    if (!this.isTechRole) {
      return [];
    }

    const merged = new Map<string, { quantity: number; item: TechStockItem }>();

    for (const line of this.usageLines) {
      const equipmentId = (line.equipmentId ?? '').trim();
      const quantity = Number(String(line.quantity ?? '').trim());
      if (!equipmentId || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      const stockItem = this.techStockItems.find((item) => item.equipmentId === equipmentId);
      if (!stockItem) {
        continue;
      }

      const existing = merged.get(equipmentId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        merged.set(equipmentId, { quantity, item: stockItem });
      }
    }

    const result: OverLimitLine[] = [];
    for (const { quantity, item } of merged.values()) {
      const limit = this.getItemLimit(item);
      if (limit !== null && quantity > limit) {
        result.push({
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity,
          limit,
          unit: item.unit ?? 'PIECES'
        });
      }
    }

    return result;
  }

  get hasOverLimit(): boolean {
    return this.overLimitLines.length > 0;
  }

  get permissionUsageLines(): OverLimitLine[] {
    const overLimit = this.overLimitLines;
    if (overLimit.length) {
      return overLimit;
    }

    const result: OverLimitLine[] = [];

    for (const line of this.usageLines) {
      const equipmentId = (line.equipmentId ?? '').trim();
      const quantity = Number(String(line.quantity ?? '').trim());
      if (!equipmentId || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      const stockItem = this.techStockItems.find((item) => item.equipmentId === equipmentId);
      const unit = stockItem?.unit ?? 'PIECES';
      const limit = stockItem ? this.getItemLimit(stockItem) : (unit === 'METERS' ? 20 : 1);
      result.push({
        equipmentId,
        equipmentName: stockItem?.equipmentName ?? equipmentId,
        quantity,
        limit: limit ?? (unit === 'METERS' ? 20 : 1),
        unit
      });
    }

    return result;
  }

  get activeCasePermission(): StockUsagePermission | null {
    return [...this.casePermissions]
      .filter((permission) => permission.status !== 'CANCELLED')
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
  }

  get permissionRequestCableMeters(): number {
    return this.permissionUsageLines
      .filter((line) => line.unit === 'METERS')
      .reduce((sum, line) => sum + line.quantity, 0);
  }

  get permissionRequestEquipmentItems(): OverLimitLine[] {
    return this.permissionUsageLines.filter((line) => line.unit !== 'METERS');
  }

  get caseReferenceLabel(): string {
    return this.caseItem?.crmCase?.trim() || this.caseItem?.id || '-';
  }

  get showStockPermissionCard(): boolean {
    if (!this.isTechRole) {
      return false;
    }

    return this.hasOverLimit || this.requiresStockPermission || !!this.activeCasePermission;
  }

  get showApprovedPermissionSummary(): boolean {
    return this.activeCasePermission?.status === 'APPROVED'
      || this.activeCasePermission?.status === 'PARTIALLY_APPROVED';
  }

  get completionBlockedByPermission(): boolean {
    if (!this.isTechRole || !this.hasOverLimit) {
      return false;
    }

    return !this.currentUsageAllowedByPermission;
  }

  get stockStepBlocked(): boolean {
    return this.completionBlockedByPermission;
  }

  get canRequestNewPermission(): boolean {
    if (!this.isTechRole || !this.showStockPermissionCard) {
      return false;
    }

    const status = this.activeCasePermission?.status;
    return this.permissionUsageLines.length > 0
      && (this.hasOverLimit || this.requiresStockPermission)
      && (!status || status === 'REJECTED' || status === 'CANCELLED');
  }

  get stockPermissionCardTitle(): string {
    const status = this.activeCasePermission?.status;
    if (status === 'PENDING') {
      return 'Waiting for STT Approval';
    }

    if (status === 'APPROVED') {
      return this.currentUsageAllowedByPermission
        ? 'STT Permission Approved'
        : 'Approved Limit Reached';
    }

    if (status === 'PARTIALLY_APPROVED') {
      return this.currentUsageAllowedByPermission
        ? 'STT Permission Partially Approved'
        : 'Adjust to Approved Quantity';
    }

    if (status === 'REJECTED') {
      return 'STT Permission Rejected';
    }

    return 'STT Permission Required';
  }

  get stockPermissionHeadline(): string {
    const status = this.activeCasePermission?.status;
    if (status === 'PENDING') {
      return 'This case is waiting for your STT to approve the extra stock request before you can finish.';
    }

    if (status === 'APPROVED') {
      return this.currentUsageAllowedByPermission
        ? 'Your STT approved the extra stock usage for this case. You can finish with the approved amount.'
        : 'Your current stock usage is higher than the approved amount. Reduce it to the approved quantity before finishing.';
    }

    if (status === 'PARTIALLY_APPROVED') {
      return this.currentUsageAllowedByPermission
        ? 'Your STT approved part of the requested stock. You can finish if you stay within the approved quantities below.'
        : 'Only part of the request was approved. Reduce the usage to the approved quantities before finishing.';
    }

    if (status === 'REJECTED') {
      return 'Your STT rejected the previous request. Adjust the usage or submit a new request for another review.';
    }

    return 'This operation exceeds the automatic stock usage limit. Ask your STT for permission before finishing this case.';
  }

  get completionPermissionNotice(): string {
    const status = this.activeCasePermission?.status;
    if (status === 'PENDING') {
      return 'Pending STT approval. Finish stays disabled until the request is approved.';
    }

    if (status === 'REJECTED') {
      return 'This request was rejected. Update the requested usage or send a new permission request.';
    }

    if (status === 'APPROVED' || status === 'PARTIALLY_APPROVED') {
      return 'The current usage is still above the approved amount. Adjust the quantities and try again.';
    }

    return 'Ask your STT for permission before finishing this case.';
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
    if (this.isTechRole) {
      this.wsPermissionSub = this.notificationWsService.notifications$.subscribe((notification) => {
        this.handlePermissionNotification(notification);
      });
    }

    const caseId = this.route.snapshot.paramMap.get('id');
    if (!caseId) {
      this.error = 'Case id is missing.';
      return;
    }

    this.loadCase(caseId);
  }

  ngOnDestroy(): void {
    this.wsPermissionSub?.unsubscribe();
    this.wsPermissionSub = null;
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
          this.activeStep = updated.type === 'PLAINTE' ? 'diagnosis' : this.firstExecutionStep;
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
            this.activeStep = this.firstExecutionStep;
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

  proceedToCompletion(): void {
    if (this.itemProofs.length === 0) {
      this.showBanner('Add at least one equipment photo before continuing.', 'danger');
      return;
    }

    for (let i = 0; i < this.itemProofs.length; i++) {
      const proof = this.itemProofs[i];
      if (proof.ocrBusy) {
        this.showBanner(`Item ${i + 1} is still being processed. Please wait.`, 'warning');
        return;
      }
      if (!proof.macAddress.trim()) {
        this.showBanner(`MAC address is required for item ${i + 1}.`, 'danger');
        return;
      }
      if (!proof.serialNumber.trim()) {
        this.showBanner(`Serial number is required for item ${i + 1}.`, 'danger');
        return;
      }
      if (proof.latitude == null || proof.longitude == null) {
        this.showBanner(`GPS location is required for item ${i + 1}. Retake the photo with location enabled.`, 'danger');
        return;
      }
    }

    this.activeStep = 'completion';
  }

  async addItemProof(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showBanner('Use an image file for equipment proof.', 'danger');
      return;
    }

    const proof: EquipmentItemProof = {
      file,
      previewUrl: '',
      ocrBusy: true,
      validated: false,
      ocrWarnings: [],
      needsReview: false,
      modemModel: '',
      macAddress: '',
      serialNumber: '',
      imei: '',
      latitude: null,
      longitude: null,
      gpsAccuracy: null,
      capturedAt: null
    };

    this.itemProofs.push(proof);
    this.render();

    proof.previewUrl = await this.readFileAsDataUrl(file);
    this.render();

    const [location, responses] = await Promise.all([
      this.captureLocation(),
      firstValueFrom(this.ocrService.extract([file])).catch(() => [])
    ]);

    if (location) {
      proof.latitude = location.latitude;
      proof.longitude = location.longitude;
      proof.gpsAccuracy = location.accuracyMeters ?? null;
      proof.capturedAt = location.capturedAt;
    }

    const metrics = this.ocrService.parseLabelMetrics(responses);
    proof.modemModel = metrics.modemModel;
    proof.macAddress = metrics.macAddress;
    proof.serialNumber = metrics.serialNumber;
    proof.imei = metrics.imei;
    proof.ocrWarnings = metrics.warnings ?? [];
    proof.needsReview = metrics.needsReview ?? false;
    proof.validated = !!metrics.macAddress && !!metrics.serialNumber && !proof.needsReview;
    proof.ocrBusy = false;

    this.render();
  }

  removeItemProof(index: number): void {
    this.itemProofs.splice(index, 1);
    this.render();
  }

  async finishWork(): Promise<void> {
    const target = this.caseItem;
    if (!target) {
      return;
    }

    if (this.completionBlockedByPermission) {
      this.banner = null;
      this.requiresStockPermission = true;
      this.stockPermissionErrorMessage = this.completionPermissionNotice;
      this.render();
      return;
    }

    if (this.itemProofs.length === 0) {
      this.showBanner('Add at least one equipment photo in the Metrics step before finishing.', 'danger');
      return;
    }

    const payload = await this.buildWorkPayload();
    if (!payload) {
      return;
    }

    this.actionBusy = true;
    this.showBanner('Finishing work...', 'info');

    try {
      this.requiresStockPermission = false;
      this.stockPermissionErrorMessage = null;
      let updated = await firstValueFrom(this.casesService.completeWork(target.id, payload));
      const proofLocation = this.proofUploadLocation(payload);

      const extraAttachments: FieldProofAttachment[] = [];

      if (this.speedtestProofFile) {
        extraAttachments.push({ file: this.speedtestProofFile, captureSource: 'speedtest_screenshot' });
      }

      if (this.signalProofFile) {
        extraAttachments.push({ file: this.signalProofFile, captureSource: 'signal_screenshot' });
      }

      for (const proof of this.itemProofs) {
        extraAttachments.push({ file: proof.file, captureSource: 'equipment_item_proof' });
      }

      const hasNewAttachments = extraAttachments.length > 0;
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
      const errorMessage = err?.error?.message ?? err?.message ?? 'Unable to finish work.';
      if (this.isStockPermissionError(err)) {
        this.banner = null;
        this.requiresStockPermission = true;
        this.stockPermissionErrorMessage = errorMessage;
        this.loadCasePermissions();
      } else {
        this.showBanner(errorMessage, 'danger');
      }
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
    this.casePermissions = [];
    this.caseLimits = [];
    this.requiresStockPermission = false;
    this.stockPermissionErrorMessage = null;
    this.permissionModalOpen = false;

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
            this.loadCaseLimits(item.id);
            this.loadCasePermissions();
          } else {
            this.techStock = null;
            this.techStockError = null;
            this.usageLines = [];
            this.casePermissions = [];
            this.caseLimits = [];
          }
          if (item.type !== 'PLAINTE' && this.activeStep === 'diagnosis') {
            this.activeStep = this.firstExecutionStep;
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

    const equipmentProofs: EquipmentItemProofPayload[] = this.itemProofs.map((p) => ({
      modemModel: p.modemModel.trim() || undefined,
      macAddress: p.macAddress.trim(),
      serialNumber: p.serialNumber.trim(),
      imei: p.imei.trim() || undefined,
      latitude: p.latitude!,
      longitude: p.longitude!,
      gpsAccuracy: p.gpsAccuracy ?? undefined,
      capturedAt: p.capturedAt ?? undefined
    }));

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
      equipmentProofs: equipmentProofs.length > 0 ? equipmentProofs : undefined,
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
      case 'equipment_item_proof':
        return 'equipment item photo';
      default:
        return 'attachment';
    }
  }

  private clearPendingProofAttachments(): void {
    this.speedtestProofFile = null;
    this.signalProofFile = null;
    this.itemProofs = [];
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

  loadCasePermissions(): void {
    const caseId = this.caseItem?.id;
    if (!caseId || !this.isTechRole) {
      return;
    }

    this.permissionsLoading = true;
    this.stockUsagePermissionService.getPermissionsByCase(caseId)
      .pipe(finalize(() => {
        this.permissionsLoading = false;
        this.render();
      }))
      .subscribe({
        next: (permissions) => {
          this.casePermissions = permissions ?? [];

          if (this.activeCasePermission?.status === 'APPROVED' || this.activeCasePermission?.status === 'PARTIALLY_APPROVED') {
            this.requiresStockPermission = false;
            this.stockPermissionErrorMessage = null;
          }
        },
        error: (err) => {
          console.error('Failed to load stock permission requests for field execution', err);
          this.casePermissions = [];
        }
      });
  }

  loadCaseLimits(caseId: string): void {
    if (!this.isTechRole) {
      return;
    }

    this.caseLimitsLoading = true;
    this.stockService.getCaseLimits(caseId)
      .pipe(finalize(() => {
        this.caseLimitsLoading = false;
        this.render();
      }))
      .subscribe({
        next: (limits) => {
          this.caseLimits = limits ?? [];
        },
        error: (err) => {
          console.error('Failed to load case usage limits for field execution', err);
          this.caseLimits = [];
        }
      });
  }

  openPermissionModal(): void {
    this.permissionReason = '';
    this.permissionModalOpen = true;
    this.render();
  }

  closePermissionModal(): void {
    if (this.permissionSaving) {
      return;
    }

    this.permissionModalOpen = false;
    this.render();
  }

  async submitPermissionRequest(): Promise<void> {
    const caseId = this.caseItem?.id;
    const reason = this.permissionReason.trim();

    if (!caseId || !this.canRequestNewPermission) {
      return;
    }

    if (!reason) {
      this.showBanner('Add a reason before sending the permission request.', 'danger');
      return;
    }

    const payload: CreatePermissionRequest = {
      caseId,
      reason,
      requestedCableMeters: this.permissionRequestCableMeters,
      requestedItems: this.permissionRequestEquipmentItems.map((line) => ({
        itemId: line.equipmentId,
        itemName: line.equipmentName,
        requestedQuantity: line.quantity,
        unit: line.unit
      }))
    };

    this.permissionSaving = true;

    this.stockUsagePermissionService.createPermissionRequest(payload)
      .pipe(finalize(() => {
        this.permissionSaving = false;
        this.render();
      }))
      .subscribe({
        next: (permission) => {
          this.permissionModalOpen = false;
          this.permissionReason = '';
          this.requiresStockPermission = false;
          this.stockPermissionErrorMessage = null;
          this.casePermissions = [
            permission,
            ...this.casePermissions.filter((existing) => existing.id !== permission.id)
          ];
          this.showBanner('Pending STT approval.', 'info');
          void this.swal.successToast('Permission request sent to your STT.');
        },
        error: (err) => {
          console.error('Failed to submit stock permission request', err);
          this.permissionModalOpen = false;
          this.showBanner(err?.error?.message ?? 'Unable to send the permission request.', 'danger');
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
    if (value === 'work' && this.isTechRole) {
      return 'stock';
    }

    return value === 'stock' || value === 'work' || value === 'metrics' || value === 'completion' || value === 'rdv' || value === 'diagnosis'
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

  stockUnitLabel(unit?: string | null): string {
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

  private handlePermissionNotification(notification: NotificationItem): void {
    const relevantEvents = ['STOCK_USAGE_PERMISSION_APPROVED', 'STOCK_USAGE_PERMISSION_REJECTED'];
    if (!relevantEvents.includes(notification.eventType)) {
      return;
    }

    const caseId = this.caseItem?.id?.trim();
    const relatedCaseId = (notification.relatedCaseId ?? (notification.data?.['caseId'] as string | undefined))?.trim();
    if (!caseId || !relatedCaseId || relatedCaseId !== caseId) {
      return;
    }

    this.loadCasePermissions();

    if (notification.eventType === 'STOCK_USAGE_PERMISSION_APPROVED') {
      const status = notification.data?.['permissionStatus'] as string | undefined;
      const comment = notification.data?.['reviewComment'] as string | undefined;
      const isPartial = status === 'PARTIALLY_APPROVED';
      this.requiresStockPermission = false;
      this.stockPermissionErrorMessage = null;
      this.showBanner(
        isPartial
          ? `STT partially approved your stock request.${comment ? ' Note: ' + comment : ''}`
          : `STT approved your stock request.${comment ? ' Note: ' + comment : ''}`,
        isPartial ? 'info' : 'success'
      );
      return;
    }

    const reason = notification.data?.['reviewComment'] as string | undefined;
    this.requiresStockPermission = true;
    this.stockPermissionErrorMessage = reason
      ? `STT rejected your request. Reason: ${reason}`
      : 'STT rejected your request. Adjust the used stock or send a new request.';
    this.showBanner(this.stockPermissionErrorMessage, 'danger');
  }

  permissionStatusLabel(status?: string | null): string {
    switch (status) {
      case 'PENDING':
        return 'Pending STT Approval';
      case 'APPROVED':
        return 'Approved';
      case 'PARTIALLY_APPROVED':
        return 'Partially Approved';
      case 'REJECTED':
        return 'Rejected';
      default:
        return 'Review Needed';
    }
  }

  permissionStatusTone(status?: string | null): BannerTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PARTIALLY_APPROVED':
        return 'info';
      case 'REJECTED':
        return 'danger';
      case 'PENDING':
      default:
        return 'warning';
    }
  }

  private get currentUsageAllowedByPermission(): boolean {
    if (!this.hasOverLimit) {
      return true;
    }

    const permission = this.activeCasePermission;
    if (!permission || (permission.status !== 'APPROVED' && permission.status !== 'PARTIALLY_APPROVED')) {
      return false;
    }

    if (this.permissionRequestCableMeters > permission.approvedCableMeters) {
      return false;
    }

    const approvedItems = new Map(
      (permission.approvedItems ?? []).map((item) => [item.itemId, Number(item.approvedQuantity ?? 0)])
    );

    for (const line of this.permissionRequestEquipmentItems) {
      if (line.quantity > 1 && line.quantity > (approvedItems.get(line.equipmentId) ?? 0)) {
        return false;
      }
    }

    return true;
  }

  get firstExecutionStep(): FieldExecutionStep {
    return this.isTechRole ? 'stock' : 'work';
  }

  private getItemLimit(item: TechStockItem): number | null {
    const config = this.caseLimits.find((entry) => entry.itemId === item.equipmentId);
    if (config) {
      return config.caseUsageLimitEnabled ? config.caseUsageLimit : null;
    }

    return item.unit === 'METERS' ? 20 : 1;
  }

  private isStockPermissionError(error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status;
    const message = ((error as { error?: { message?: string }, message?: string } | null)?.error?.message
      ?? (error as { message?: string } | null)?.message
      ?? '')
      .toLowerCase();

    if (status !== 403) {
      return false;
    }

    return message.includes('requires stt permission')
      || message.includes('stock usage limit')
      || message.includes('submit a permission request first')
      || message.includes('exceeds the approved amount');
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
