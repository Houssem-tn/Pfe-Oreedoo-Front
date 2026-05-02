import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SpinnerComponent } from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { DpmRequest, DpmStatus, StockMovement } from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';

@Component({
  standalone: true,
  selector: 'app-stock-audit',
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, SpinnerComponent],
  templateUrl: './stock-audit.component.html',
  styleUrls: ['./stock-audit.component.scss']
})
export class StockAuditComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  dpms: DpmRequest[] = [];
  movementsByRef = new Map<string, StockMovement[]>();
  userMap = new Map<string, AppUser>();

  loading = false;
  error: string | null = null;

  searchFilter = '';
  statusFilter: DpmStatus | '' = '';
  zmFilter = '';

  selectedDpm: DpmRequest | null = null;
  panelVisible = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    this.userSvc.getAll().subscribe({
      next: list => { this.userMap = new Map(list.map(u => [u.id, u])); }
    });
    forkJoin({
      dpms: this.stockSvc.adminGetAllDpms(),
      movements: this.stockSvc.adminGetAllMovements()
    })
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ dpms, movements }) => {
          this.dpms = dpms;
          const map = new Map<string, StockMovement[]>();
          for (const m of movements) {
            if (!m.referenceId) continue;
            const arr = map.get(m.referenceId) ?? [];
            arr.push(m);
            map.set(m.referenceId, arr);
          }
          this.movementsByRef = map;
        },
        error: e => this.error = e.message
      });
  }

  openDpm(dpm: DpmRequest): void {
    this.selectedDpm = dpm;
    this.panelVisible = true;
  }

  get zmOptions(): { id: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const d of this.dpms) seen.set(d.zmId, d.zmName);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get filtered(): DpmRequest[] {
    return this.dpms.filter(d => {
      if (this.statusFilter && d.status !== this.statusFilter) return false;
      if (this.zmFilter && d.zmId !== this.zmFilter) return false;
      if (this.searchFilter.trim()) {
        const q = this.searchFilter.toLowerCase();
        if (!d.dpmNumber.toLowerCase().includes(q) &&
            !d.zmName.toLowerCase().includes(q) &&
            !d.sttName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  distributionsFor(dpm: DpmRequest): StockMovement[] {
    return (this.movementsByRef.get(dpm.id) ?? [])
      .filter(m => m.movementType === 'STT_TO_TECH_DISTRIBUTION');
  }

  distributionTechs(dpm: DpmRequest): string[] {
    return [...new Set(
      this.distributionsFor(dpm).filter(m => m.toActorId).map(m => m.toActorId!)
    )];
  }

  itemsForTech(dpm: DpmRequest, techId: string): StockMovement[] {
    return this.distributionsFor(dpm).filter(m => m.toActorId === techId);
  }

  nameInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  userName(id: string | undefined): string {
    if (!id) return '—';
    return this.userMap.get(id)?.fullName ?? `#${id.slice(-6)}`;
  }

  userEmail(id: string | undefined): string {
    if (!id) return '';
    return this.userMap.get(id)?.email ?? '';
  }

  statusLabel(s: DpmStatus): string {
    const m: Record<DpmStatus, string> = {
      PENDING_STT_CONFIRMATION: 'Pending',
      PARTIALLY_CONFIRMED: 'Partial',
      FULLY_CONFIRMED: 'Confirmed',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled'
    };
    return m[s] ?? s;
  }

  countByStatus(s: DpmStatus): number {
    return this.dpms.filter(d => d.status === s).length;
  }
}
