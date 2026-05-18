import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import {
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ContainerComponent,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormLabelDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  SpinnerComponent,
  TableDirective,
  TooltipDirective
} from '@coreui/angular';

import { StockService } from '../../../../core/stock/stock.service';
import { StockThreshold, StockThresholdRequest, Equipment } from '../../../../core/stock/stock.model';

interface ThresholdRow {
  threshold?: StockThreshold;
  equipment: Equipment;
  editing: boolean;
  draft: { warningThreshold: number; criticalThreshold: number; enabled: boolean };
  saving: boolean;
}

@Component({
  selector: 'app-zm-stock-thresholds',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconDirective,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    BadgeComponent,
    ButtonDirective,
    SpinnerComponent,
    TableDirective,
    FormControlDirective,
    FormLabelDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    TooltipDirective
  ],
  template: `
    <c-container fluid class="py-3">

      <!-- Page Header -->
      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 class="mb-0">Stock Alert Thresholds</h4>
          <p class="text-body-secondary mb-0" style="font-size:0.875rem">
            These thresholds control when low-stock alerts are sent to you and your STTs.
          </p>
        </div>
        <button cButton color="secondary" variant="outline" size="sm" (click)="loadData()">
          <svg cIcon name="cilReload" class="me-1" style="width:14px;height:14px"></svg>
          Refresh
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="text-center py-5">
        <c-spinner></c-spinner>
        <p class="mt-2 text-body-secondary">Loading thresholds…</p>
      </div>

      <!-- Error -->
      <div *ngIf="!loading() && error()" class="alert alert-danger">{{ error() }}</div>

      <!-- Thresholds table -->
      <c-card *ngIf="!loading()">
        <c-card-header>
          <div class="d-flex align-items-center gap-2">
            <svg cIcon name="cilStorage" style="width:18px;height:18px"></svg>
            <strong>Equipment Thresholds</strong>
          </div>
        </c-card-header>
        <c-card-body class="p-0">
          <div *ngIf="rows().length === 0" class="text-center py-5 text-body-secondary">
            <svg cIcon name="cilStorage" style="width:2rem;height:2rem;opacity:.4"></svg>
            <p class="mt-2 mb-0">No equipment found. Add equipment first in the Admin panel.</p>
          </div>

          <table cTable *ngIf="rows().length > 0" responsive hover class="mb-0">
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit</th>
                <th>Warning At</th>
                <th>Critical At</th>
                <th>Status</th>
                <th>Preview</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rows(); let i = index">
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <img *ngIf="row.equipment.imageUrl" [src]="row.equipment.imageUrl"
                         class="rounded" style="width:28px;height:28px;object-fit:cover" alt="">
                    <div>
                      <div class="fw-semibold" style="font-size:0.88rem">{{ row.equipment.name }}</div>
                      <div class="text-body-secondary" style="font-size:0.75rem">
                        {{ row.equipment.category }}
                      </div>
                    </div>
                  </div>
                </td>

                <td>
                  <c-badge color="secondary" class="text-uppercase">
                    {{ unitLabel(row.equipment) }}
                  </c-badge>
                </td>

                <!-- Warning threshold -->
                <td>
                  <ng-container *ngIf="!row.editing">
                    <span *ngIf="row.threshold">
                      ≤ {{ row.threshold.warningThreshold }} {{ unitLabel(row.equipment) }}
                    </span>
                    <span *ngIf="!row.threshold" class="text-body-secondary fst-italic">
                      Not configured
                    </span>
                  </ng-container>
                  <ng-container *ngIf="row.editing">
                    <input type="number" cFormControl [min]="0" style="width:90px"
                           [(ngModel)]="row.draft.warningThreshold" />
                  </ng-container>
                </td>

                <!-- Critical threshold -->
                <td>
                  <ng-container *ngIf="!row.editing">
                    <span *ngIf="row.threshold">
                      ≤ {{ row.threshold.criticalThreshold }} {{ unitLabel(row.equipment) }}
                    </span>
                    <span *ngIf="!row.threshold" class="text-body-secondary fst-italic">
                      Not configured
                    </span>
                  </ng-container>
                  <ng-container *ngIf="row.editing">
                    <input type="number" cFormControl [min]="0" style="width:90px"
                           [(ngModel)]="row.draft.criticalThreshold" />
                  </ng-container>
                </td>

                <!-- Enabled toggle -->
                <td>
                  <ng-container *ngIf="!row.threshold">
                    <c-badge color="secondary">Not configured</c-badge>
                  </ng-container>
                  <ng-container *ngIf="row.threshold && !row.editing">
                    <button cButton size="sm"
                            [color]="row.threshold.enabled ? 'success' : 'secondary'"
                            variant="outline"
                            (click)="toggleEnabled(i)"
                            [disabled]="row.saving">
                      {{ row.threshold.enabled ? 'Enabled' : 'Disabled' }}
                    </button>
                  </ng-container>
                  <ng-container *ngIf="row.threshold && row.editing">
                    <c-form-check>
                      <input cFormCheckInput type="checkbox" [(ngModel)]="row.draft.enabled"
                             [id]="'enabled_' + i" />
                      <label cFormCheckLabel [for]="'enabled_' + i">
                        {{ row.draft.enabled ? 'Enabled' : 'Disabled' }}
                      </label>
                    </c-form-check>
                  </ng-container>
                </td>

                <!-- Preview -->
                <td style="font-size:0.78rem; color:var(--cui-secondary-color)">
                  <ng-container *ngIf="row.threshold && row.threshold.enabled">
                    Alert when ≤ {{ row.threshold.warningThreshold }} {{ unitLabel(row.equipment) }}
                  </ng-container>
                  <ng-container *ngIf="row.editing">
                    Alert when ≤ {{ row.draft.warningThreshold }} {{ unitLabel(row.equipment) }}
                  </ng-container>
                  <ng-container *ngIf="!row.threshold && !row.editing">
                    —
                  </ng-container>
                </td>

                <!-- Actions -->
                <td class="text-end">
                  <ng-container *ngIf="!row.editing">
                    <button cButton size="sm" color="primary" variant="outline"
                            (click)="startEdit(i)" [disabled]="row.saving">
                      {{ row.threshold ? 'Edit' : 'Configure' }}
                    </button>
                  </ng-container>
                  <ng-container *ngIf="row.editing">
                    <div class="d-flex gap-1 justify-content-end">
                      <button cButton size="sm" color="success" (click)="save(i)"
                              [disabled]="row.saving">
                        <c-spinner size="sm" *ngIf="row.saving"></c-spinner>
                        <span *ngIf="!row.saving">Save</span>
                      </button>
                      <button cButton size="sm" color="secondary" variant="outline"
                              (click)="cancelEdit(i)" [disabled]="row.saving">
                        Cancel
                      </button>
                    </div>
                  </ng-container>
                </td>
              </tr>
            </tbody>
          </table>
        </c-card-body>
      </c-card>

    </c-container>
  `
})
export class ZmStockThresholdsComponent implements OnInit {
  private readonly stockService = inject(StockService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ThresholdRow[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    // Load equipment list and existing thresholds in parallel
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        equipment: this.stockService.getEquipment(),
        thresholds: this.stockService.getMyThresholds()
      }).subscribe({
        next: ({ equipment, thresholds }) => {
          const thresholdMap = new Map(thresholds.map(t => [t.itemId, t]));
          const built: ThresholdRow[] = equipment
            .filter(e => e.active)
            .map(e => {
              const threshold = thresholdMap.get(e.id);
              return {
                equipment: e,
                threshold,
                editing: false,
                draft: {
                  warningThreshold: threshold?.warningThreshold ?? 5,
                  criticalThreshold: threshold?.criticalThreshold ?? 0,
                  enabled: threshold?.enabled ?? true
                },
                saving: false
              };
            });
          this.rows.set(built);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load threshold data. Please try again.');
          this.loading.set(false);
        }
      });
    });
  }

  startEdit(i: number): void {
    this.rows.update(rows => {
      const updated = [...rows];
      const row = { ...updated[i] };
      row.editing = true;
      row.draft = {
        warningThreshold: row.threshold?.warningThreshold ?? 5,
        criticalThreshold: row.threshold?.criticalThreshold ?? 0,
        enabled: row.threshold?.enabled ?? true
      };
      updated[i] = row;
      return updated;
    });
  }

  cancelEdit(i: number): void {
    this.rows.update(rows => {
      const updated = [...rows];
      updated[i] = { ...updated[i], editing: false };
      return updated;
    });
  }

  save(i: number): void {
    const row = this.rows()[i];
    if (row.draft.warningThreshold < row.draft.criticalThreshold) {
      alert('Warning threshold must be greater than or equal to critical threshold.');
      return;
    }

    const payload: StockThresholdRequest = {
      itemId: row.equipment.id,
      itemName: row.equipment.name,
      itemType: row.equipment.category === 'CABLE' ? 'CABLE' : 'EQUIPMENT',
      warningThreshold: row.draft.warningThreshold,
      criticalThreshold: row.draft.criticalThreshold,
      unit: row.equipment.unit === 'METERS' ? 'METER' : 'PIECE',
      enabled: row.draft.enabled
    };

    this.rows.update(rows => {
      const updated = [...rows];
      updated[i] = { ...updated[i], saving: true };
      return updated;
    });

    const request$ = row.threshold
      ? this.stockService.updateThreshold(row.threshold.id, payload)
      : this.stockService.upsertThreshold(payload);

    request$.subscribe({
      next: (updated) => {
        this.rows.update(rows => {
          const copy = [...rows];
          copy[i] = { ...copy[i], threshold: updated, editing: false, saving: false };
          return copy;
        });
      },
      error: (err) => {
        this.rows.update(rows => {
          const copy = [...rows];
          copy[i] = { ...copy[i], saving: false };
          return copy;
        });
        alert(err?.error?.message ?? 'Failed to save threshold.');
      }
    });
  }

  toggleEnabled(i: number): void {
    const row = this.rows()[i];
    if (!row.threshold) return;

    this.rows.update(rows => {
      const copy = [...rows];
      copy[i] = { ...copy[i], saving: true };
      return copy;
    });

    this.stockService.toggleThreshold(row.threshold.id).subscribe({
      next: (updated) => {
        this.rows.update(rows => {
          const copy = [...rows];
          copy[i] = { ...copy[i], threshold: updated, saving: false };
          return copy;
        });
      },
      error: () => {
        this.rows.update(rows => {
          const copy = [...rows];
          copy[i] = { ...copy[i], saving: false };
          return copy;
        });
      }
    });
  }

  unitLabel(equipment: Equipment): string {
    if (equipment.unit === 'METERS') return 'm';
    return 'pcs';
  }
}
