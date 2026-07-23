import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { firstValueFrom } from 'rxjs';

import { OcrService } from '../../core/ocr/ocr.service';

export interface EquipmentLabelScanResult {
  modemModel: string;
  macAddress: string;
  serialNumber: string;
  imei: string;
  /** The captured/uploaded image, kept for callers that upload it as proof (e.g. retrieved items). */
  file: File | null;
}

/**
 * Reusable "scan an equipment label with EasyOCR" widget: camera capture or file upload → OCR
 * extraction → editable, technician-confirmed IMEI/Serial/MAC before the values are ever used.
 *
 * Extracted from the equivalent logic already shipped for Activation's equipment-proof-photo step
 * (`field-execution.component.ts`'s `addItemProof()`/`EquipmentItemProof`) so Complaint consumption/
 * retrieval and Résiliation retrieval reuse the exact same capture/OCR/confirm/correct UX instead of
 * a second implementation. Never saves OCR values without an explicit confirmation from the
 * technician (the Validated/Modify toggle); OCR failures degrade to empty, editable fields rather
 * than blocking manual entry.
 */
@Component({
  standalone: true,
  selector: 'app-equipment-label-scan',
  imports: [CommonModule, FormsModule, IconDirective],
  template: `
    <div class="label-scan">
      <div class="label-scan__header">
        <span class="label-scan__title">{{ title }}</span>
        <span class="label-scan__badge label-scan__badge--busy" *ngIf="ocrBusy">Scanning...</span>
        <span class="label-scan__badge label-scan__badge--ok" *ngIf="!ocrBusy && hasScanned && !needsReview">Scanned</span>
        <span class="label-scan__badge label-scan__badge--warn" *ngIf="!ocrBusy && needsReview">Needs review</span>
      </div>

      <div class="label-scan__preview" *ngIf="previewUrl">
        <img [src]="previewUrl" alt="Equipment label" class="label-scan__img" />
      </div>
      <div class="label-scan__placeholder" *ngIf="!previewUrl && ocrBusy">
        <span class="label-scan__spinner"></span>
      </div>

      <div class="label-scan__actions">
        <button type="button" class="label-scan__button" (click)="fileInput.click()" [disabled]="ocrBusy">
          <svg cIcon name="cilCamera"></svg>
          {{ hasScanned ? 'Rescan label' : 'Scan with EasyOCR' }}
        </button>
        <input #fileInput type="file" accept="image/*" capture="environment" hidden
               (change)="onFileSelected(fileInput)" />
      </div>

      <div class="label-scan__alert label-scan__alert--warn" *ngIf="ocrWarnings.length > 0">
        <svg cIcon name="cilWarning"></svg>
        <span>{{ ocrWarnings.join(' ') }}</span>
      </div>
      <div class="label-scan__alert label-scan__alert--info" *ngIf="hasScanned && !ocrBusy && ocrFailed">
        <svg cIcon name="cilInfo"></svg>
        <span>OCR could not read this image. Enter the values manually below.</span>
      </div>

      <div class="label-scan__toggle-row" *ngIf="hasScanned && !ocrBusy">
        <button type="button" class="label-scan__toggle" [class.label-scan__toggle--active]="validated"
                (click)="validated = true">
          <svg cIcon name="cilCheck"></svg> Confirmed
        </button>
        <button type="button" class="label-scan__toggle" [class.label-scan__toggle--active]="!validated"
                (click)="validated = false">
          <svg cIcon name="cilX"></svg> Correct
        </button>
      </div>

      <div class="label-scan__fields" *ngIf="hasScanned">
        <label class="label-scan__field">
          Model
          <input type="text" [(ngModel)]="modemModel" name="labelScanModel" [disabled]="validated || ocrBusy"
                 (ngModelChange)="emitConfirmed()" placeholder="e.g. ZLT W51" />
        </label>
        <label class="label-scan__field">
          MAC Address
          <input type="text" [(ngModel)]="macAddress" name="labelScanMac" [disabled]="validated || ocrBusy"
                 (ngModelChange)="emitConfirmed()" placeholder="e.g. 98:A9:42:FF:24:DA" />
        </label>
        <label class="label-scan__field">
          Serial Number
          <input type="text" [(ngModel)]="serialNumber" name="labelScanSerial" [disabled]="validated || ocrBusy"
                 (ngModelChange)="emitConfirmed()" placeholder="e.g. W51P740912346" />
        </label>
        <label class="label-scan__field">
          IMEI
          <input type="text" [(ngModel)]="imei" name="labelScanImei" [disabled]="validated || ocrBusy"
                 (ngModelChange)="emitConfirmed()" placeholder="Optional" />
        </label>
      </div>
    </div>
  `,
  styles: [`
    /* The widget must always stay inside its parent (recovery / consumption rows, modals),
       so it is width-capped and every flex/grid child is allowed to shrink (min-width: 0). */
    .label-scan { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border: 1px dashed var(--cui-border-color, #d8dbe0); border-radius: 0.5rem; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }
    .label-scan__header { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; min-width: 0; }
    .label-scan__title { font-weight: 600; font-size: 0.9rem; min-width: 0; overflow-wrap: anywhere; }
    .label-scan__badge { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 1rem; flex-shrink: 0; }
    .label-scan__badge--busy { background: #cfe2ff; color: #084298; }
    .label-scan__badge--ok { background: #d1e7dd; color: #0f5132; }
    .label-scan__badge--warn { background: #fff3cd; color: #664d03; }
    .label-scan__preview { width: 100%; max-width: min(220px, 100%); }
    .label-scan__img { display: block; width: 100%; max-width: 100%; height: auto; border-radius: 0.375rem; }
    .label-scan__placeholder { display: flex; align-items: center; justify-content: center; height: 120px; }
    .label-scan__spinner { width: 28px; height: 28px; border: 3px solid #ccc; border-top-color: #666; border-radius: 50%; animation: label-scan-spin 0.8s linear infinite; }
    @keyframes label-scan-spin { to { transform: rotate(360deg); } }
    .label-scan__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .label-scan__button { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; border-radius: 0.375rem; border: 1px solid var(--cui-border-color, #d8dbe0); background: transparent; cursor: pointer; font-size: 0.85rem; max-width: 100%; }
    .label-scan__button:disabled { opacity: 0.6; cursor: not-allowed; }
    .label-scan__alert { display: flex; gap: 0.4rem; align-items: flex-start; font-size: 0.8rem; padding: 0.4rem 0.6rem; border-radius: 0.375rem; min-width: 0; }
    .label-scan__alert span { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .label-scan__alert--warn { background: #fff3cd; color: #664d03; }
    .label-scan__alert--info { background: #cfe2ff; color: #084298; }
    .label-scan__toggle-row { display: flex; gap: 0.5rem; }
    .label-scan__toggle { flex: 1 1 0; min-width: 0; padding: 0.3rem 0.5rem; border-radius: 0.375rem; border: 1px solid var(--cui-border-color, #d8dbe0); background: transparent; cursor: pointer; font-size: 0.8rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; }
    .label-scan__toggle--active { background: var(--cui-success, #2eb85c); color: #fff; border-color: transparent; }
    /* minmax(0, 1fr) lets tracks shrink below the inputs' intrinsic width — the actual overflow fix. */
    .label-scan__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .label-scan__field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.75rem; min-width: 0; }
    .label-scan__field input { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; padding: 0.35rem 0.5rem; border-radius: 0.375rem; border: 1px solid var(--cui-border-color, #d8dbe0); font-size: 0.85rem; }
    @media (max-width: 480px) {
      .label-scan__fields { grid-template-columns: 1fr; }
    }
  `]
})
export class EquipmentLabelScanComponent {
  @Input() title = 'Equipment label';
  /** Emits on every change (OCR result or manual edit) so the parent always has the latest values. */
  @Output() scanChange = new EventEmitter<EquipmentLabelScanResult>();
  /** Emits once when the technician toggles "Confirmed" — the parent's cue to accept the values. */
  @Output() confirmed = new EventEmitter<EquipmentLabelScanResult>();

  private readonly ocrService = inject(OcrService);

  previewUrl = '';
  ocrBusy = false;
  hasScanned = false;
  ocrFailed = false;
  needsReview = false;
  ocrWarnings: string[] = [];

  private _validated = false;
  get validated(): boolean {
    return this._validated;
  }
  set validated(value: boolean) {
    this._validated = value;
    if (value) {
      this.confirmed.emit(this.currentValue());
    }
  }

  modemModel = '';
  macAddress = '';
  serialNumber = '';
  imei = '';
  private selectedFile: File | null = null;

  async onFileSelected(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    this.hasScanned = true;
    this.ocrBusy = true;
    this.ocrFailed = false;
    this.validated = false;
    this.selectedFile = file;
    this.previewUrl = await this.readFileAsDataUrl(file);

    const responses = await firstValueFrom(this.ocrService.extract([file])).catch(() => null);
    if (!responses) {
      // OCR failure never blocks manual entry — just leave the fields empty and editable.
      this.ocrFailed = true;
      this.ocrBusy = false;
      return;
    }

    const metrics = this.ocrService.parseLabelMetrics(responses);
    this.modemModel = metrics.modemModel;
    this.macAddress = metrics.macAddress;
    this.serialNumber = metrics.serialNumber;
    this.imei = metrics.imei;
    this.ocrWarnings = metrics.warnings ?? [];
    this.needsReview = metrics.needsReview ?? false;
    this.ocrBusy = false;
    this.emitConfirmed();
  }

  /** Lets the parent pre-clear/reset this row (e.g. when the equipment selection changes). */
  reset(): void {
    this.previewUrl = '';
    this.ocrBusy = false;
    this.hasScanned = false;
    this.ocrFailed = false;
    this.needsReview = false;
    this.ocrWarnings = [];
    this._validated = false;
    this.modemModel = '';
    this.macAddress = '';
    this.serialNumber = '';
    this.imei = '';
    this.selectedFile = null;
  }

  emitConfirmed(): void {
    this.scanChange.emit(this.currentValue());
  }

  private currentValue(): EquipmentLabelScanResult {
    return {
      modemModel: this.modemModel.trim(),
      macAddress: this.macAddress.trim(),
      serialNumber: this.serialNumber.trim(),
      imei: this.imei.trim(),
      file: this.selectedFile
    };
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
