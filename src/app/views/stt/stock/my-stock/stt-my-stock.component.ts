import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent, TableDirective,
  ButtonDirective, ColComponent, RowComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { DpmRequest, DpmStatus, SttStock, TechStock, TechStockItem } from '../../../../core/stock/stock.model';
import { AppUser } from '../../../../core/users/user.model';

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, RouterLink,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, SpinnerComponent, TableDirective,
    ButtonDirective, ColComponent, RowComponent
  ],
  templateUrl: './stt-my-stock.component.html',
  styleUrls: ['./stt-my-stock.component.scss']
})
export class SttMyStockComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly userSvc = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  stock: SttStock | null = null;
  incomingDpms: DpmRequest[] = [];
  techStocks: TechStock[] = [];
  userMap = new Map<string, AppUser>();

  loading = false;
  error: string | null = null;

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      me:          this.userSvc.getMe(),
      techs:       this.userSvc.getMyTechs().pipe(catchError(() => of([] as AppUser[]))),
      stock:       this.stockSvc.getMySttStock().pipe(catchError(() => of(null))),
      incomingDpms: this.stockSvc.getIncomingDpms().pipe(catchError(() => of([] as DpmRequest[]))),
      techStocks:  this.stockSvc.getMyTechsStocks().pipe(catchError(() => of([] as TechStock[])))
    }).pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: ({ me, techs, stock, incomingDpms, techStocks }) => {
          const map = new Map<string, AppUser>();
          map.set(me.id, me);
          for (const u of techs) map.set(u.id, u);
          this.userMap = map;
          this.stock = stock;
          this.incomingDpms = incomingDpms;
          this.techStocks = techStocks;
        },
        error: e => this.error = e.message
      });
  }

  userName(id: string): string {
    return this.userMap.get(id)?.fullName ?? id;
  }

  userInitials(id: string): string {
    const name = this.userMap.get(id)?.fullName;
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  private stockLabel(meters: number, pieces: number): string {
    const parts: string[] = [];
    if (meters > 0) parts.push(`${meters} m`);
    if (pieces > 0) parts.push(`${pieces} pcs`);
    return parts.join(' / ') || '0';
  }

  get totalAvailableLabel(): string {
    const items = this.stock?.items ?? [];
    const m = items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.availableQuantity, 0);
    const p = items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.availableQuantity, 0);
    return this.stockLabel(m, p);
  }

  get totalReceivedLabel(): string {
    const items = this.stock?.items ?? [];
    const m = items.filter(i => i.unit === 'METERS').reduce((s, i) => s + i.totalReceived, 0);
    const p = items.filter(i => i.unit !== 'METERS').reduce((s, i) => s + i.totalReceived, 0);
    return this.stockLabel(m, p);
  }

  unitSuffix(item: TechStockItem): string {
    return item.unit === 'METERS' ? ' m' : ' pcs';
  }

  statusColor(s: DpmStatus): string {
    const m: Partial<Record<DpmStatus, string>> = {
      WAITING_TEAM_STOCK_APPROVAL: 'warning', TEAM_STOCK_REJECTED: 'danger',
      RDV_SCHEDULED: 'info', RDV_CONFIRMED_BY_STT: 'primary',
      MATERIAL_RECEIVED: 'success', COMPLETED: 'success',
      PENDING_STT_CONFIRMATION: 'warning', PARTIALLY_CONFIRMED: 'info',
      FULLY_CONFIRMED: 'success', REJECTED: 'danger', CANCELLED: 'secondary'
    };
    return m[s] ?? 'secondary';
  }
}
