import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
  ButtonDirective, BadgeComponent, SpinnerComponent,
  TableDirective, FormControlDirective, FormLabelDirective,
  ColComponent, RowComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { Equipment, CreateEquipmentRequest } from '../../../../core/stock/stock.model';
import { SwalService } from '../../../../core/ui/swal.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
    ButtonDirective, BadgeComponent, SpinnerComponent,
    TableDirective, FormControlDirective, FormLabelDirective,
    ColComponent, RowComponent
  ],
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

  form: CreateEquipmentRequest = { name: '', description: '', unit: '' };
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  searchTerm = '';

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
    this.form = { name: '', description: '', unit: '' };
    this.selectedImage = null;
    this.imagePreview = null;
    this.modalVisible = true;
  }

  openEdit(eq: Equipment): void {
    this.editingId = eq.id;
    this.form = { name: eq.name, description: eq.description ?? '', unit: eq.unit ?? '' };
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
    return t ? this.equipment.filter(e => e.name.toLowerCase().includes(t)) : this.equipment;
  }
}
