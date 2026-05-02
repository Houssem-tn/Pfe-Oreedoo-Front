import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  ButtonDirective, SpinnerComponent, FormControlDirective,
  FormLabelDirective, ColComponent, RowComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { Equipment, CreateDpmRequest, DpmItemRequest } from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/searchable-select/searchable-select.component';

interface DpmLine {
  equipmentId: string;
  equipmentName: string;
  equipmentImageUrl?: string;
  requestedQuantity: number;
}

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, IconDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    ButtonDirective, SpinnerComponent, FormControlDirective,
    FormLabelDirective, ColComponent, RowComponent,
    SearchableSelectComponent
  ],
  templateUrl: './create-dpm.component.html',
  styleUrls: ['./create-dpm.component.scss']
})
export class CreateDpmComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  equipment: Equipment[] = [];
  stts: AppUser[] = [];
  loadingEquipment = false;
  loadingStts = false;
  submitting = false;
  error: string | null = null;

  selectedSttId = '';
  deliveryPersonName = '';
  notes = '';
  lines: DpmLine[] = [];

  ngOnInit(): void {
    this.loadEquipment();
    this.loadStts();
  }

  loadEquipment(): void {
    this.loadingEquipment = true;
    this.stockSvc.getEquipment()
      .pipe(finalize(() => { this.loadingEquipment = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: items => this.equipment = items, error: e => this.error = e.message });
  }

  loadStts(): void {
    this.loadingStts = true;
    this.userSvc.getMySttsForZm()
      .pipe(finalize(() => { this.loadingStts = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: list => this.stts = list, error: () => {} });
  }

  addLine(): void {
    this.lines.push({ equipmentId: '', equipmentName: '', requestedQuantity: 1 });
  }

  removeLine(i: number): void {
    this.lines.splice(i, 1);
  }

  onEquipmentChange(line: DpmLine): void {
    const eq = this.equipment.find(e => e.id === line.equipmentId);
    if (eq) {
      line.equipmentName = eq.name;
      line.equipmentImageUrl = eq.imageUrl;
    }
  }

  increment(line: DpmLine): void { line.requestedQuantity++; }
  decrement(line: DpmLine): void { if (line.requestedQuantity > 1) line.requestedQuantity--; }

  get sttOptions(): SelectOption[] {
    return this.stts.map(s => ({
      value: s.id,
      label: s.fullName,
      subtitle: s.email,
      initials: s.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      avatarColor: '#7f1227',
      badge: 'STT',
      badgeColor: 'danger' as const
    }));
  }

  equipmentOptionsFor(line: DpmLine): SelectOption[] {
    const usedIds = new Set(
      this.lines.map(l => l.equipmentId).filter(id => id && id !== line.equipmentId)
    );
    return this.equipment
      .filter(eq => !usedIds.has(eq.id))
      .map(eq => ({
        value: eq.id,
        label: eq.name,
        subtitle: eq.unit ? `Unit: ${eq.unit}` : (eq.description ?? undefined),
        imageUrl: eq.imageUrl ?? undefined
      }));
  }

  get canSubmit(): boolean {
    return !!this.selectedSttId && !!this.deliveryPersonName.trim() &&
      this.lines.length > 0 && this.lines.every(l => !!l.equipmentId && l.requestedQuantity > 0);
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.error = null;
    const payload: CreateDpmRequest = {
      sttId: this.selectedSttId,
      deliveryPersonName: this.deliveryPersonName.trim(),
      notes: this.notes.trim() || undefined,
      items: this.lines.map<DpmItemRequest>(l => ({
        equipmentId: l.equipmentId,
        requestedQuantity: l.requestedQuantity
      }))
    };
    this.stockSvc.createDpm(payload)
      .pipe(finalize(() => { this.submitting = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => this.router.navigate(['/zm/stock/my-tracking']),
        error: err => this.error = err.error?.message ?? err.message
      });
  }
}
