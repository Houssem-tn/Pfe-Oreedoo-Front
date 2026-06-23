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
  SttDistribution,
  SttStockItem
} from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/searchable-select/searchable-select.component';

interface DistributionLine {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  available: number;
  quantity: number;
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
      techs: this.userSvc.getMyTechs()
    }).pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ stock, techs }) => {
          this.stockItems = stock?.items ?? [];
          this.techs = techs;
        },
        error: e => this.error = e.message
      });
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
      this.lines.push({
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        unit: item.unit,
        available: item.availableQuantity,
        quantity: 1
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
      this.lines.every(l => l.quantity > 0 && l.quantity <= l.available);
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
          this.loadData();
          this.loadHistory();
        },
        error: e => this.error = e.error?.message ?? e.message
      });
  }
}
