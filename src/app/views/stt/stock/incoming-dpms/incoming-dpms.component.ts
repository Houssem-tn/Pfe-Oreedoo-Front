import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardComponent, CardBodyComponent, CardHeaderComponent,
  SpinnerComponent, TableDirective,
  FormControlDirective, FormLabelDirective, ButtonDirective,
  ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { ConfirmDpmRequest, DpmItem, DpmItemConfirmation, DpmRequest, DpmStatus } from '../../../../core/stock/stock.model';

interface ConfirmLine extends DpmItem {
  confirmedQty: number;
  note: string;
}

@Component({
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, IconDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, TableDirective,
    FormControlDirective, FormLabelDirective, ButtonDirective,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent
  ],
  templateUrl: './incoming-dpms.component.html',
  styleUrls: ['./incoming-dpms.component.scss']
})
export class IncomingDpmsComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  dpms: DpmRequest[] = [];
  loading = false;
  confirming = false;
  error: string | null = null;

  confirmModalVisible = false;
  confirmingDpm: DpmRequest | null = null;
  confirmLines: ConfirmLine[] = [];
  rejectReason = '';
  isRejecting = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    this.stockSvc.getIncomingDpms()
      .pipe(finalize(() => { this.loading = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: d => this.dpms = d,
        error: e => this.error = e.message
      });
  }

  openConfirm(dpm: DpmRequest): void {
    this.confirmingDpm = dpm;
    this.confirmLines = dpm.items.map(item => ({
      ...item,
      confirmedQty: item.requestedQuantity,
      note: ''
    }));
    this.rejectReason = '';
    this.isRejecting = false;
    this.confirmModalVisible = true;
  }

  increment(line: ConfirmLine): void { line.confirmedQty++; }
  decrement(line: ConfirmLine): void { if (line.confirmedQty > 0) line.confirmedQty--; }

  toggleReject(): void {
    this.isRejecting = !this.isRejecting;
    if (this.isRejecting) this.confirmLines.forEach(l => l.confirmedQty = 0);
    else this.confirmLines.forEach((l, i) => l.confirmedQty = this.confirmingDpm!.items[i].requestedQuantity);
  }

  submitConfirmation(): void {
    if (!this.confirmingDpm) return;
    this.confirming = true;
    const payload: ConfirmDpmRequest = {
      items: this.confirmLines.map<DpmItemConfirmation>(l => ({
        equipmentId: l.equipmentId,
        confirmedQuantity: l.confirmedQty,
        confirmationNote: l.note.trim() || undefined
      })),
      rejectReason: this.isRejecting ? this.rejectReason.trim() : undefined
    };
    this.stockSvc.confirmDpm(this.confirmingDpm.id, payload)
      .pipe(finalize(() => { this.confirming = false; this.zone.run(() => this.cdr.detectChanges()); }))
      .subscribe({
        next: () => { this.confirmModalVisible = false; this.load(); },
        error: e => this.error = e.error?.message ?? e.message
      });
  }

  get shortage(): number {
    return this.confirmLines.reduce((s, l) => s + Math.max(0, l.requestedQuantity - l.confirmedQty), 0);
  }
}
