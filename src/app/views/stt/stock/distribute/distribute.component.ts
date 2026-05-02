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
  DistributableDpm,
  DistributeToTechRequest,
  DistributionItemRequest,
  SttDistribution
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

  distributableDpms: DistributableDpm[] = [];
  techs: AppUser[] = [];
  distributions: SttDistribution[] = [];

  loading = false;
  loadingHistory = false;
  submitting = false;
  error: string | null = null;
  successMsg: string | null = null;

  selectedTechId = '';
  selectedDpmId = '';
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
      dpms: this.stockSvc.getDistributableDpms(),
      techs: this.userSvc.getMyTechs()
    }).pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ dpms, techs }) => {
          this.distributableDpms = dpms;
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

  get selectedDpm(): DistributableDpm | null {
    return this.distributableDpms.find(d => d.id === this.selectedDpmId) ?? null;
  }

  onDpmSelect(dpmId: string): void {
    this.selectedDpmId = dpmId;
    const dpm = this.distributableDpms.find(d => d.id === dpmId);
    if (!dpm) { this.lines = []; return; }
    this.lines = dpm.items.map(item => ({
      equipmentId: item.equipmentId,
      equipmentName: item.equipmentName,
      available: item.remainingQuantity,
      quantity: item.remainingQuantity
    }));
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
    return !!this.selectedTechId && !!this.selectedDpmId &&
      this.lines.length > 0 &&
      this.lines.every(l => l.quantity > 0 && l.quantity <= l.available);
  }

  isSelfDistribution(techId: string): boolean {
    return !!this.currentUser?.id && techId === this.currentUser.id;
  }

  dpmLabel(d: SttDistribution): string {
    if (!d.dpmId) return '—';
    const dpm = this.distributableDpms.find(x => x.id === d.dpmId);
    return dpm ? dpm.dpmNumber : d.dpmId.slice(-6);
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.error = null;
    this.successMsg = null;
    const payload: DistributeToTechRequest = {
      techId: this.selectedTechId,
      dpmId: this.selectedDpmId,
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
          this.selectedDpmId = '';
          this.notes = '';
          this.lines = [];
          this.loadData();
          this.loadHistory();
        },
        error: e => this.error = e.error?.message ?? e.message
      });
  }
}
