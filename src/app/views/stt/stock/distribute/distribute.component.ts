import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  ButtonDirective, SpinnerComponent, FormControlDirective,
  FormLabelDirective, ColComponent, RowComponent,
  TableDirective, BadgeComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import {
  DistributeToTechRequest, DistributionItemRequest,
  SttStock, SttStockItem, SttDistribution
} from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/searchable-select/searchable-select.component';

interface DistributionLine {
  equipmentId: string;
  equipmentName: string;
  available: number;
  quantity: number;
}

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, IconDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    ButtonDirective, SpinnerComponent, FormControlDirective,
    FormLabelDirective, ColComponent, RowComponent,
    TableDirective, BadgeComponent,
    SearchableSelectComponent
  ],
  templateUrl: './distribute.component.html',
  styleUrls: ['./distribute.component.scss']
})
export class DistributeComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  myStock: SttStock | null = null;
  techs: AppUser[] = [];
  distributions: SttDistribution[] = [];

  loadingStock = false;
  loadingTechs = false;
  loadingHistory = false;
  submitting = false;
  error: string | null = null;
  successMsg: string | null = null;

  selectedTechId = '';
  notes = '';
  lines: DistributionLine[] = [];

  activeTab: 'distribute' | 'history' = 'distribute';

  ngOnInit(): void {
    this.loadStock();
    this.loadTechs();
    this.loadHistory();
  }

  loadStock(): void {
    this.loadingStock = true;
    this.stockSvc.getMySttStock()
      .pipe(finalize(() => { this.loadingStock = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: s => { this.myStock = s; this.lines = []; },
        error: e => this.error = e.message
      });
  }

  loadTechs(): void {
    this.loadingTechs = true;
    this.userSvc.getMyTechs()
      .pipe(finalize(() => { this.loadingTechs = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: list => this.techs = list,
        error: () => {}
      });
  }

  loadHistory(): void {
    this.loadingHistory = true;
    this.stockSvc.getMyDistributions()
      .pipe(finalize(() => { this.loadingHistory = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: d => this.distributions = d,
        error: () => {}
      });
  }

  addLine(): void {
    this.lines.push({ equipmentId: '', equipmentName: '', available: 0, quantity: 1 });
  }

  removeLine(i: number): void { this.lines.splice(i, 1); }

  decrementQuantity(line: DistributionLine): void {
    if (line.quantity > 1) line.quantity--;
  }

  incrementQuantity(line: DistributionLine): void {
    if (line.quantity < line.available) line.quantity++;
  }

  onEquipmentChange(line: DistributionLine): void {
    const si = this.myStock?.items.find(i => i.equipmentId === line.equipmentId);
    if (si) {
      line.equipmentName = si.equipmentName;
      line.available = si.availableQuantity;
      if (line.quantity > line.available) line.quantity = line.available;
    }
  }

  get availableItems(): SttStockItem[] {
    return (this.myStock?.items ?? []).filter(i => i.availableQuantity > 0);
  }

  get techOptions(): SelectOption[] {
    return this.techs.map(t => ({
      value: t.id,
      label: t.fullName,
      subtitle: t.email,
      initials: t.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      avatarColor: '#e5243b',
      badge: 'TECH',
      badgeColor: 'info' as const
    }));
  }

  get equipmentOptions(): SelectOption[] {
    return this.availableItems.map(si => ({
      value: si.equipmentId,
      label: si.equipmentName,
      subtitle: `Available: ${si.availableQuantity}`,
      badge: `${si.availableQuantity}`,
      badgeColor: (si.availableQuantity > 5 ? 'success' : si.availableQuantity > 0 ? 'warning' : 'secondary') as SelectOption['badgeColor']
    }));
  }

  get canSubmit(): boolean {
    return !!this.selectedTechId && this.lines.length > 0 &&
      this.lines.every(l => !!l.equipmentId && l.quantity > 0 && l.quantity <= l.available);
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.error = null;
    this.successMsg = null;
    const payload: DistributeToTechRequest = {
      techId: this.selectedTechId,
      notes: this.notes.trim() || undefined,
      items: this.lines.map<DistributionItemRequest>(l => ({
        equipmentId: l.equipmentId,
        quantity: l.quantity
      }))
    };
    this.stockSvc.distributeToTech(payload)
      .pipe(finalize(() => { this.submitting = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => {
          this.successMsg = 'Distribution recorded successfully.';
          this.selectedTechId = '';
          this.notes = '';
          this.lines = [];
          this.loadStock();
          this.loadHistory();
        },
        error: e => this.error = e.error?.message ?? e.message
      });
  }
}
