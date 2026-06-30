import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import {
  DistributeToTechRequest,
  DistributionItemRequest,
  EquipmentInstance,
  SttDistribution,
  SttStockItem,
  TrackingMode
} from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/searchable-select/searchable-select.component';

interface DistributionLine {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  available: number;
  quantity: number;
  /** Tracking mode of the equipment (NONE = quantity-based). */
  trackingMode: TrackingMode;
  /** Tracked units available in STT stock for this equipment (tracked items only). */
  availableUnits: EquipmentInstance[];
  /** Selected tracked-unit ids (tracked items only). */
  selectedInstanceIds: string[];
}

@Component({
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SpinnerComponent, SearchableSelectComponent],
  templateUrl: './distribute.component.html',
  styleUrls: ['./distribute.component.scss']
})
export class DistributeComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly authStore = inject(AuthStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  stockItems: SttStockItem[] = [];
  techs: AppUser[] = [];
  distributions: SttDistribution[] = [];

  /** equipmentId → trackingMode, and equipmentId → available tracked units in my stock. */
  private trackingByEquipment = new Map<string, TrackingMode>();
  private unitsByEquipment = new Map<string, EquipmentInstance[]>();

  loading = false;
  loadingHistory = false;
  submitting = false;
  error: string | null = null;
  successMsg: string | null = null;

  selectedTechId = '';
  notes = '';
  lines: DistributionLine[] = [];

  activeTab: 'distribute' | 'history' = 'distribute';

  ngOnInit(): void {
    this.loadData();
    this.loadHistory();
  }

  get currentUser() { return this.authStore.user(); }

  loadData(): void {
    this.loading = true;
    forkJoin({
      stock: this.stockSvc.getMySttStock(),
      techs: this.userSvc.getMyTechs(),
      equipment: this.stockSvc.getEquipment(),
      instances: this.stockSvc.getMySttInstances()
    }).pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ stock, techs, equipment, instances }) => {
          this.stockItems = stock?.items ?? [];
          this.techs = techs;
          this.trackingByEquipment = new Map(equipment.map(e => [e.id, e.trackingMode ?? 'NONE']));
          this.unitsByEquipment = new Map();
          for (const inst of instances) {
            const list = this.unitsByEquipment.get(inst.equipmentId) ?? [];
            list.push(inst);
            this.unitsByEquipment.set(inst.equipmentId, list);
          }
          // Drop any in-progress selections that are no longer in stock.
          this.lines = [];
        },
        error: e => this.error = e.message
      });
  }

  isTracked(equipmentId: string): boolean {
    const mode = this.trackingByEquipment.get(equipmentId);
    return !!mode && mode !== 'NONE';
  }

  unitLabel(inst: EquipmentInstance): string {
    const parts: string[] = [];
    if (inst.serialNumber) parts.push(`SN ${inst.serialNumber}`);
    if (inst.imei) parts.push(`IMEI ${inst.imei}`);
    return parts.join(' · ') || inst.id;
  }

  isUnitSelected(line: DistributionLine, instanceId: string): boolean {
    return line.selectedInstanceIds.includes(instanceId);
  }

  toggleUnit(line: DistributionLine, instanceId: string): void {
    const idx = line.selectedInstanceIds.indexOf(instanceId);
    if (idx >= 0) line.selectedInstanceIds.splice(idx, 1);
    else line.selectedInstanceIds.push(instanceId);
    line.quantity = line.selectedInstanceIds.length;
  }

  loadHistory(): void {
    this.loadingHistory = true;
    this.stockSvc.getMyDistributions()
      .pipe(finalize(() => { this.loadingHistory = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({ next: d => this.distributions = d, error: () => {} });
  }

  /** Items the STT actually has on hand and can still hand out. */
  get availableItems(): SttStockItem[] {
    return this.stockItems.filter(i => i.availableQuantity > 0);
  }

  isSelected(equipmentId: string): boolean {
    return this.lines.some(l => l.equipmentId === equipmentId);
  }

  /** Add or remove an item from the distribution based on remaining stock. */
  toggleItem(item: SttStockItem): void {
    const idx = this.lines.findIndex(l => l.equipmentId === item.equipmentId);
    if (idx >= 0) {
      this.lines.splice(idx, 1);
    } else {
      const trackingMode = this.trackingByEquipment.get(item.equipmentId) ?? 'NONE';
      const tracked = trackingMode !== 'NONE';
      const availableUnits = tracked ? (this.unitsByEquipment.get(item.equipmentId) ?? []) : [];
      this.lines.push({
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        unit: item.unit,
        available: tracked ? availableUnits.length : item.availableQuantity,
        quantity: tracked ? 0 : 1,
        trackingMode,
        availableUnits,
        selectedInstanceIds: []
      });
    }
  }

  decrementQuantity(line: DistributionLine): void {
    if (line.quantity > 1) line.quantity--;
  }

  incrementQuantity(line: DistributionLine): void {
    if (line.quantity < line.available) line.quantity++;
  }

  removeLine(i: number): void { this.lines.splice(i, 1); }

  get techOptions(): SelectOption[] {
    const opts: SelectOption[] = [];
    const me = this.currentUser;
    if (me?.id) {
      const meName = me.fullName ?? me.username ?? '';
      opts.push({
        value: me.id,
        label: `${meName} (Self)`,
        subtitle: me.email ?? '',
        initials: meName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ME',
        avatarColor: '#f59e0b',
        badge: 'SELF',
        badgeColor: 'warning' as const
      });
    }
    for (const t of this.techs) {
      if (t.id === me?.id) continue;
      opts.push({
        value: t.id,
        label: t.fullName,
        subtitle: t.email,
        initials: t.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        avatarColor: '#e5243b',
        badge: 'TECH',
        badgeColor: 'info' as const
      });
    }
    return opts;
  }

  get canSubmit(): boolean {
    return !!this.selectedTechId &&
      this.lines.length > 0 &&
      this.lines.every(l => l.trackingMode !== 'NONE'
        ? (l.selectedInstanceIds.length > 0 && l.selectedInstanceIds.length <= l.available)
        : (l.quantity > 0 && l.quantity <= l.available));
  }

  isSelfDistribution(techId: string): boolean {
    return !!this.currentUser?.id && techId === this.currentUser.id;
  }

  /** History rows are now stock-based; legacy rows may still carry a DPM ref. */
  sourceLabel(d: SttDistribution): string {
    return d.dpmId ? `DPM ${d.dpmId.slice(-6)}` : 'Stock';
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.error = null;
    this.successMsg = null;
    const payload: DistributeToTechRequest = {
      techId: this.selectedTechId,
      notes: this.notes.trim() || undefined,
      items: this.lines.map<DistributionItemRequest>(l => l.trackingMode !== 'NONE'
        ? { equipmentId: l.equipmentId, quantity: l.selectedInstanceIds.length, instanceIds: l.selectedInstanceIds }
        : { equipmentId: l.equipmentId, quantity: l.quantity })
    };
    this.stockSvc.distributeToTech(payload)
      .pipe(finalize(() => { this.submitting = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => {
          this.successMsg = 'Distribution recorded successfully.';
          this.selectedTechId = '';
          this.notes = '';
          this.lines = [];
          this.loadData();
          this.loadHistory();
        },
        error: e => this.error = e.error?.message ?? e.message
      });
  }
}
