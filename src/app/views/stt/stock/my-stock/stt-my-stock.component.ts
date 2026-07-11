import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  BadgeComponent, SpinnerComponent, TableDirective,
  ButtonDirective, ColComponent, RowComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { UserService } from '../../../../core/users/user.service';
import { DpmRequest, DpmStatus, SttStock, TechStock } from '../../../../core/stock/stock.model';
import {
  formatMaterialGroups,
  groupMaterialQuantities,
  materialUnitShort
} from '../../../../core/stock/material-quantity.util';
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

  get totalAvailableLabel(): string {
    return formatMaterialGroups(this.materialGroups(item => item.availableQuantity));
  }

  get totalReceivedLabel(): string {
    return formatMaterialGroups(this.materialGroups(item => item.totalReceived));
  }

  unitSuffix(item: Pick<SttStock['items'][number], 'unit'>): string {
    return ` ${materialUnitShort(item.unit)}`;
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

  private materialGroups(quantity: (item: SttStock['items'][number]) => number) {
    return groupMaterialQuantities(this.stock?.items ?? [], {
      equipmentId: item => item.equipmentId,
      equipmentName: item => item.equipmentName,
      unit: item => item.unit,
      quantity
    });
  }
}
