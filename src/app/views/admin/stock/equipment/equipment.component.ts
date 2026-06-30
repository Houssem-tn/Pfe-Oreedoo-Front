import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { Equipment, CreateEquipmentRequest, StockUnit, TrackingMode } from '../../../../core/stock/stock.model';
import { SwalService } from '../../../../core/ui/swal.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IconDirective, SpinnerComponent],
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss']
})
export class EquipmentComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  equipment: Equipment[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  modalVisible = false;
  editingId: string | null = null;

  readonly unitOptions: { value: StockUnit; label: string }[] = [
    { value: 'METERS', label: 'Meters' },
    { value: 'PIECES', label: 'Pieces' }
  ];

  readonly trackingModeOptions: { value: TrackingMode; label: string; hint: string }[] = [
    { value: 'NONE', label: 'No tracking', hint: 'Quantity-based only (e.g. cable, connecteur, fixation).' },
    { value: 'SERIAL_ONLY', label: 'Serial number only', hint: 'Each unit must declare a Serial Number.' },
    { value: 'IMEI_ONLY', label: 'IMEI only', hint: 'Each unit must declare an IMEI.' },
    { value: 'SERIAL_AND_IMEI', label: 'Serial number + IMEI', hint: 'Each unit must declare both a Serial Number and an IMEI.' },
    { value: 'SERIAL_OR_IMEI', label: 'Serial number or IMEI', hint: 'Each unit must declare at least one of Serial Number or IMEI.' }
  ];

  trackingHint(mode?: TrackingMode): string {
    return this.trackingModeOptions.find(o => o.value === (mode ?? 'NONE'))?.hint ?? '';
  }

  form: CreateEquipmentRequest = this.emptyForm();
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  searchTerm = '';

  private emptyForm(): CreateEquipmentRequest {
    // Defaults preserve previous behaviour: usable in ACT and PLT, not a pack item, not recoverable.
    return {
      name: '', articleCode: '', description: '', unit: undefined,
      packItem: false, usableInAct: true, usableInPlt: true, recoverableFromClient: false,
      trackingMode: 'NONE'
    };
  }

  /** Pack items can never be consumed in ACT — keep the toggle states coherent in the form. */
  onPackItemChange(): void {
    if (this.form.packItem) {
      this.form.usableInAct = false;
    }
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.stockSvc.getEquipment()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: items => this.equipment = items,
        error: err => this.error = err.message
      });
  }

  openCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.selectedImage = null;
    this.imagePreview = null;
    this.modalVisible = true;
  }

  openEdit(eq: Equipment): void {
    this.editingId = eq.id;
    this.form = {
      name: eq.name,
      articleCode: eq.articleCode ?? '',
      description: eq.description ?? '',
      unit: eq.unit,
      packItem: eq.packItem ?? false,
      usableInAct: eq.usableInAct ?? true,
      usableInPlt: eq.usableInPlt ?? true,
      recoverableFromClient: eq.recoverableFromClient ?? false,
      trackingMode: eq.trackingMode ?? 'NONE'
    };
    this.selectedImage = null;
    this.imagePreview = eq.imageUrl ?? null;
    this.modalVisible = true;
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
      this.imagePreview = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  save(): void {
    if (!this.form.name.trim()) return;
    this.saving = true;
    const obs = this.editingId
      ? this.stockSvc.updateEquipment(this.editingId, this.form, this.selectedImage ?? undefined)
      : this.stockSvc.createEquipment(this.form, this.selectedImage ?? undefined);

    obs.pipe(finalize(() => { this.saving = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => { this.modalVisible = false; this.load(); },
        error: err => this.error = err.message
      });
  }

  deactivate(eq: Equipment): void {
    this.swal.confirmAction(`Deactivate "${eq.name}"?`, 'This will hide it from the equipment list.', 'Deactivate')
      .then(result => {
        if (!result.isConfirmed) return;
        this.stockSvc.deactivateEquipment(eq.id).subscribe({
          next: () => this.load(),
          error: err => this.error = err.message
        });
      });
  }

  get filtered(): Equipment[] {
    const t = this.searchTerm.toLowerCase();
    if (!t) return this.equipment;
    return this.equipment.filter(e =>
      e.name.toLowerCase().includes(t) ||
      (e.articleCode ?? '').toLowerCase().includes(t) ||
      (e.description ?? '').toLowerCase().includes(t)
    );
  }

  unitLabel(unit?: StockUnit): string {
    if (unit === 'METERS') return 'Meters';
    if (unit === 'PIECES') return 'Pieces';
    return '—';
  }

  usageBadges(eq: Equipment): { label: string; cls: string }[] {
    const badges: { label: string; cls: string }[] = [];
    if (eq.packItem) badges.push({ label: 'Pack', cls: 'equip-usage--pack' });
    if (eq.usableInAct) badges.push({ label: 'ACT', cls: 'equip-usage--act' });
    if (eq.usableInPlt) badges.push({ label: 'PLT', cls: 'equip-usage--plt' });
    if (eq.recoverableFromClient) badges.push({ label: 'RES', cls: 'equip-usage--res' });
    if (eq.trackingMode && eq.trackingMode !== 'NONE') badges.push({ label: 'Tracked', cls: 'equip-usage--tracked' });
    return badges;
  }
}
