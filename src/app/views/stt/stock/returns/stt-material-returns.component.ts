import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs';

import { MaterialReturnService } from '../../../../core/stock/material-return.service';
import { StockService } from '../../../../core/stock/stock.service';
import {
  MaterialReturn,
  MaterialReturnStatus,
  ReturnReason,
  ReturnCondition,
  ReturnDestination,
  ReturnSource,
  CreateMaterialReturnRequest,
  ReturnedItemRequest,
  RETURN_REASON_LABELS,
  RETURN_CONDITION_LABELS,
  RETURN_DESTINATION_LABELS,
  RETURN_SOURCE_LABELS,
  RETURN_STATUS_LABELS,
} from '../../../../core/stock/material-return.model';
import { Equipment, SttStock, SttStockItem } from '../../../../core/stock/stock.model';

// ── Local interfaces ──────────────────────────────────────────────────────────

/** One entry in the search dropdown — built from the full equipment catalog */
interface SearchableItem {
  equipmentId:   string;
  equipmentName: string;
  articleCode:   string;
  unit:          string;
  /** Units currently available in the STT's own stock (0 when item is not in STT stock) */
  availableQty:  number;
  /** True if the item exists in the STT's current stock (any quantity) */
  inSttStock:    boolean;
}

/** One row in the "selected returned items" list */
interface ItemRow {
  equipmentId:   string;
  equipmentName: string;
  articleCode:   string;
  unit:          string;
  availableQty:  number;
  inSttStock:    boolean;
  quantity:      number;
  condition:     ReturnCondition | '';
  serialNumber:  string;
}

@Component({
  selector: 'app-stt-material-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ══════════════════════════════════════════════════════════════════
         PAGE HEADER
    ═════════════════════════════════════════════════════════════════════ -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Material Returns</h2>
        <p class="page-subtitle">
          Declare returned or recovered material for ZM confirmation.
          Items can come from client recovery, résiliation, field recovery, or STT stock.
        </p>
      </div>
      <button class="btn-primary" (click)="openCreateModal()">+ Create Return</button>
    </div>

    <!-- ── Loading ─────────────────────────────────────────────────────── -->
    <div *ngIf="loading" class="empty-state">Loading your returns…</div>

    <!-- ── Empty ──────────────────────────────────────────────────────── -->
    <div *ngIf="!loading && returns.length === 0" class="empty-state">
      No material returns yet. Click <strong>Create Return</strong> to declare one.
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         RETURNS TABLE
    ═════════════════════════════════════════════════════════════════════ -->
    <div *ngIf="!loading && returns.length > 0" class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Return Code</th>
            <th>Source</th>
            <th>Reason</th>
            <th>Destination</th>
            <th>Items</th>
            <th>Planned Date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of returns">
            <td><code class="code-badge">{{ r.returnCode }}</code></td>
            <td>
              <span [class]="sourceChipClass(r.returnSource)">
                {{ r.returnSource ? sourceLabel(r.returnSource) : '—' }}
              </span>
            </td>
            <td>{{ reasonLabel(r.reason) }}</td>
            <td>{{ destinationLabel(r.destination) }}</td>
            <td>
              <span class="items-chip">
                {{ r.items.length }} item{{ r.items.length !== 1 ? 's' : '' }}
              </span>
            </td>
            <td class="ts-cell">{{ r.plannedReturnDate ?? '—' }}</td>
            <td><span [class]="statusClass(r.status)">{{ statusLabel(r.status) }}</span></td>
            <td>
              <button class="btn-link" (click)="openDetail(r)">View</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         CREATE RETURN MODAL
    ═════════════════════════════════════════════════════════════════════ -->
    <div *ngIf="showCreateModal" class="modal-backdrop" (click)="closeModals()">
      <div class="modal-box" (click)="$event.stopPropagation()">

        <!-- sticky header -->
        <div class="modal-header">
          <div class="modal-header-content">
            <h3 class="modal-title">Create Material Return</h3>
            <p class="modal-subtitle">
              Select items from the catalog, enter quantities, and submit for ZM review.
            </p>
          </div>
          <button class="modal-close" type="button" (click)="closeModals()">✕</button>
        </div>

        <!-- scrollable body -->
        <div class="modal-body">

          <!-- ── Return Source ──────────────────────────────────────── -->
          <div class="field-group">
            <label class="field-label">Return Source <span class="req">*</span></label>
            <select class="field-input" [(ngModel)]="form.returnSource" (ngModelChange)="onSourceChange()">
              <option value="">— Where does this material come from? —</option>
              <option *ngFor="let opt of sourceOptions" [value]="opt.value">{{ opt.label }}</option>
            </select>
            <p *ngIf="form.returnSource && form.returnSource !== 'STT_STOCK'" class="field-hint">
              ℹ External source — quantities are not validated against your current STT stock.
            </p>
            <p *ngIf="form.returnSource === 'STT_STOCK'" class="field-hint field-hint--blue">
              ℹ STT stock — quantities will be validated and decremented from your available stock on approval.
            </p>
          </div>

          <!-- ── Case link ──────────────────────────────────────────── -->
          <div class="field-group">
            <label class="field-label">Linked Case <span class="optional">(optional)</span></label>
            <input
              type="text"
              class="field-input"
              [(ngModel)]="form.crmCase"
              placeholder="CRM case reference e.g. #185868760"
            />
          </div>

          <!-- ── Planned Return Date ──────────────────────────────── -->
          <div class="field-group">
            <label class="field-label">
              Planned Handover Date <span class="optional">(optional)</span>
            </label>
            <input
              type="date"
              class="field-input"
              [(ngModel)]="form.plannedReturnDate"
            />
            <p class="field-hint">When do you plan to hand this material over to your ZM / warehouse?</p>
          </div>

          <!-- ── Reason ─────────────────────────────────────────────── -->
          <div class="field-group">
            <label class="field-label">Return Reason <span class="req">*</span></label>
            <select class="field-input" [(ngModel)]="form.reason" (ngModelChange)="onReasonChange()">
              <option value="">— Select reason —</option>
              <option *ngFor="let opt of reasonOptions" [value]="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- ── Condition ──────────────────────────────────────────── -->
          <div class="field-group">
            <label class="field-label">Overall Condition <span class="req">*</span></label>
            <select class="field-input" [(ngModel)]="form.condition">
              <option value="">— Select condition —</option>
              <option *ngFor="let opt of conditionOptions" [value]="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- ── Destination ────────────────────────────────────────── -->
          <div class="field-group">
            <label class="field-label">Destination <span class="req">*</span></label>
            <select class="field-input" [(ngModel)]="form.destination">
              <option value="">— Select destination —</option>
              <option *ngFor="let opt of destinationOptions" [value]="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- ══════════════════════════════════════════════════════════
               ITEMS SECTION
          ═══════════════════════════════════════════════════════════ -->
          <div class="section-divider">
            <span>Returned Items <span class="req">*</span></span>
            <span class="section-hint" *ngIf="itemRows.length > 0">
              {{ itemRows.length }} item{{ itemRows.length !== 1 ? 's' : '' }} selected
            </span>
          </div>

          <!-- ── Search input ──────────────────────────────────────── -->
          <div class="search-wrapper">
            <input
              type="text"
              class="field-input search-input"
              [(ngModel)]="itemSearch"
              (input)="filterEquipment()"
              (focus)="filterEquipment()"
              placeholder="Search equipment catalog by name or article code…"
              autocomplete="off"
            />

            <!-- ── Dropdown results ─────────────────────────────────── -->
            <div *ngIf="filteredEquipment.length > 0" class="search-dropdown">
              <div
                *ngFor="let si of filteredEquipment"
                class="search-option"
                [class.search-option--added]="isAlreadyAdded(si.equipmentId)"
                (mousedown)="onItemMousedown($event, si)"
              >
                <div class="search-option-main">
                  <span class="search-eq-name">{{ si.equipmentName }}</span>
                  <span *ngIf="si.articleCode" class="search-eq-code">{{ si.articleCode }}</span>
                </div>
                <div class="search-option-right">
                  <span *ngIf="si.inSttStock && si.availableQty > 0" class="avail-badge">
                    {{ si.availableQty }} {{ si.unit }} in stock
                  </span>
                  <span *ngIf="si.inSttStock && si.availableQty === 0" class="avail-badge avail-badge--zero">
                    0 {{ si.unit }} available
                  </span>
                  <span *ngIf="!si.inSttStock" class="avail-badge avail-badge--external">
                    Catalog item
                  </span>
                  <span *ngIf="isAlreadyAdded(si.equipmentId)" class="added-label">Added</span>
                  <span *ngIf="!isAlreadyAdded(si.equipmentId)" class="add-label">+ Add</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Selected items list ──────────────────────────────── -->
          <div *ngIf="itemRows.length > 0" class="selected-items">
            <div *ngFor="let row of itemRows; let i = index" class="selected-item-card">

              <!-- item identity -->
              <div class="item-identity">
                <div class="item-identity-left">
                  <span class="item-eq-name">{{ row.equipmentName }}</span>
                  <span *ngIf="row.articleCode" class="item-eq-code">Code: {{ row.articleCode }}</span>
                </div>
                <button class="btn-remove-item" type="button" (click)="removeItem(i)">✕ Remove</button>
              </div>

              <!-- stock info bar — informational, validation only for STT_STOCK source -->
              <div *ngIf="row.inSttStock" class="item-stock-bar">
                <span class="stock-avail">
                  In your stock:
                  <strong>{{ row.availableQty }} {{ row.unit }}</strong>
                </span>
                <span *ngIf="form.returnSource === 'STT_STOCK'" class="stock-note">
                  (validated on submit)
                </span>
              </div>
              <div *ngIf="!row.inSttStock && form.returnSource === 'STT_STOCK'" class="item-stock-bar item-stock-bar--warn">
                ⚠ This item is not in your STT stock. Choose a different return source.
              </div>

              <!-- qty + condition + serial -->
              <div class="item-fields">
                <div class="item-field item-field--qty">
                  <label class="field-label-sm">Quantity <span class="req">*</span></label>
                  <div class="qty-input-wrapper">
                    <input
                      type="number"
                      class="field-input qty-input"
                      [(ngModel)]="row.quantity"
                      [min]="1"
                      [max]="form.returnSource === 'STT_STOCK' ? row.availableQty : 9999"
                      (ngModelChange)="clearError()"
                    />
                    <span class="qty-unit">{{ row.unit }}</span>
                  </div>
                  <span
                    *ngIf="form.returnSource === 'STT_STOCK' && row.inSttStock && row.quantity > row.availableQty"
                    class="field-error-inline"
                  >
                    Max: {{ row.availableQty }} {{ row.unit }}
                  </span>
                </div>

                <div class="item-field">
                  <label class="field-label-sm">Item Condition</label>
                  <select class="field-input" [(ngModel)]="row.condition">
                    <option value="">— Condition —</option>
                    <option *ngFor="let opt of conditionOptions" [value]="opt.value">{{ opt.label }}</option>
                  </select>
                </div>

                <div class="item-field">
                  <label class="field-label-sm">Serial # <span class="optional">(opt.)</span></label>
                  <input
                    type="text"
                    class="field-input"
                    [(ngModel)]="row.serialNumber"
                    placeholder="e.g. SN-00123"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- empty hint when no items selected -->
          <div *ngIf="itemRows.length === 0" class="items-empty-hint">
            No returned items selected yet. Search the catalog above and add material to declare.
          </div>

          <!-- ── Comment ────────────────────────────────────────────── -->
          <div class="field-group" style="margin-top: 1.25rem">
            <label class="field-label">
              Comment
              <span *ngIf="form.reason === 'OTHER'" class="req"> * required for OTHER reason</span>
              <span *ngIf="form.reason !== 'OTHER'" class="optional"> (optional)</span>
            </label>
            <textarea
              class="field-input field-textarea"
              [(ngModel)]="form.comment"
              rows="3"
              placeholder="Add any relevant notes about this return…"
            ></textarea>
          </div>

          <!-- ── Form error ──────────────────────────────────────── -->
          <div *ngIf="formError" class="alert-error">
            <span class="alert-icon">⚠</span> {{ formError }}
          </div>

        </div><!-- end modal-body -->

        <!-- sticky footer -->
        <div class="modal-footer">
          <button class="btn-secondary" type="button" (click)="closeModals()">Cancel</button>
          <button
            class="btn-primary"
            type="button"
            (click)="submitReturn()"
            [disabled]="submitting || itemRows.length === 0"
          >
            {{ submitting ? 'Submitting…' : 'Submit Return' }}
          </button>
        </div>

      </div><!-- end modal-box -->
    </div><!-- end modal-backdrop -->

    <!-- ══════════════════════════════════════════════════════════════════
         DETAIL MODAL
    ═════════════════════════════════════════════════════════════════════ -->
    <div *ngIf="selectedReturn" class="modal-backdrop" (click)="closeModals()">
      <div class="modal-box modal-box--wide" (click)="$event.stopPropagation()">

        <!-- ── Header ──────────────────────────────────────────────── -->
        <div class="modal-header dv-header">
          <div class="dv-header__main">
            <code class="dv-return-code">{{ selectedReturn.returnCode }}</code>
            <span [class]="statusClass(selectedReturn.status)" class="dv-status-pill">
              {{ statusLabel(selectedReturn.status) }}
            </span>
          </div>
          <button class="modal-close" type="button" (click)="closeModals()" aria-label="Close">✕</button>
        </div>

        <!-- ── Body ───────────────────────────────────────────────── -->
        <div class="modal-body dv-body">

          <!-- Metadata grid -->
          <div class="dv-grid">
            <div class="dv-field">
              <span class="dv-label">Return Source</span>
              <span *ngIf="selectedReturn.returnSource" [class]="sourceChipClass(selectedReturn.returnSource)" class="dv-source-chip">
                {{ sourceLabel(selectedReturn.returnSource) }}
              </span>
              <span class="dv-muted" *ngIf="!selectedReturn.returnSource">—</span>
            </div>

            <div class="dv-field">
              <span class="dv-label">Reason</span>
              <span class="dv-value">{{ reasonLabel(selectedReturn.reason) }}</span>
            </div>

            <div class="dv-field">
              <span class="dv-label">Condition</span>
              <span class="dv-value">{{ conditionLabel(selectedReturn.condition) }}</span>
            </div>

            <div class="dv-field">
              <span class="dv-label">Destination</span>
              <span class="dv-value">{{ destinationLabel(selectedReturn.destination) }}</span>
            </div>

            <div class="dv-field" *ngIf="selectedReturn.plannedReturnDate">
              <span class="dv-label">Planned Handover</span>
              <span class="planned-date">{{ selectedReturn.plannedReturnDate }}</span>
            </div>

            <div class="dv-field" *ngIf="selectedReturn.crmCase">
              <span class="dv-label">Linked Case</span>
              <span class="case-ref">{{ selectedReturn.crmCase }}</span>
            </div>

            <div class="dv-field dv-field--full" *ngIf="selectedReturn.comment">
              <span class="dv-label">Comment</span>
              <span class="dv-value">{{ selectedReturn.comment }}</span>
            </div>

            <div class="dv-field dv-field--full" *ngIf="selectedReturn.reviewComment">
              <span class="dv-label">ZM Review Comment</span>
              <span class="review-comment-text">{{ selectedReturn.reviewComment }}</span>
            </div>
          </div>

          <!-- Items section -->
          <div class="section-divider">
            <span>Returned Items</span>
            <span class="section-hint">
              {{ selectedReturn.items.length }}&nbsp;item{{ selectedReturn.items.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <div class="dv-table-wrap">
            <table class="dv-items-table">
              <thead>
                <tr>
                  <th class="dv-th">Equipment</th>
                  <th class="dv-th dv-th--num">Qty</th>
                  <th class="dv-th">Unit</th>
                  <th class="dv-th">Condition</th>
                  <th class="dv-th">Identifiers</th>
                </tr>
              </thead>
              <tbody>
                <tr class="dv-tr" *ngFor="let item of selectedReturn.items">
                  <td class="dv-td">
                    <strong class="dv-eq-name">{{ item.equipmentName }}</strong>
                  </td>
                  <td class="dv-td dv-td--num">{{ item.quantity }}</td>
                  <td class="dv-td dv-td--muted">{{ item.unit }}</td>
                  <td class="dv-td">{{ item.condition ? conditionLabel(item.condition) : '—' }}</td>
                  <td class="dv-td">
                    <ng-container *ngIf="item.serialNumber || item.macAddress || item.imei; else noId">
                      <div class="dv-id-list">
                        <span class="dv-id-chip" *ngIf="item.serialNumber">
                          <span class="dv-id-chip__key">S/N</span>{{ item.serialNumber }}
                        </span>
                        <span class="dv-id-chip" *ngIf="item.macAddress">
                          <span class="dv-id-chip__key">MAC</span>{{ item.macAddress }}
                        </span>
                        <span class="dv-id-chip" *ngIf="item.imei">
                          <span class="dv-id-chip__key">IMEI</span>{{ item.imei }}
                        </span>
                      </div>
                    </ng-container>
                    <ng-template #noId><span class="dv-td--muted">—</span></ng-template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Timestamps -->
          <div class="detail-timestamps">
            <span>Submitted: {{ selectedReturn.submittedAt | date:'dd/MM/yyyy HH:mm' }}</span>
            <span *ngIf="selectedReturn.reviewedAt">
              Reviewed: {{ selectedReturn.reviewedAt | date:'dd/MM/yyyy HH:mm' }}
              · by {{ selectedReturn.reviewedByZmName }}
            </span>
          </div>

        </div>

        <!-- ── Footer ──────────────────────────────────────────────── -->
        <div class="modal-footer">
          <button class="btn-secondary" type="button" (click)="closeModals()">Close</button>
        </div>

      </div>
    </div>
  `,

  styles: [`
    /* ══════════════════════════════════════════════════════════════════
       HOST + PAGE
    ═════════════════════════════════════════════════════════════════════ */
    :host { display: block; padding: 1.5rem; background: #F8FAFC; min-height: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.5rem; gap: 1rem;
    }
    .page-title    { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 .25rem; }
    .page-subtitle { color: #6B7280; font-size: .875rem; margin: 0; }

    /* ══════════════════════════════════════════════════════════════════
       BUTTONS
    ═════════════════════════════════════════════════════════════════════ */
    .btn-primary {
      background: #E30613; color: #fff; border: none; border-radius: 8px;
      padding: .55rem 1.25rem; font-weight: 600; cursor: pointer; font-size: .875rem;
      white-space: nowrap; flex-shrink: 0;
    }
    .btn-primary:hover:not(:disabled) { background: #B00020; }
    .btn-primary:disabled { opacity: .55; cursor: not-allowed; }

    .btn-secondary {
      background: #fff; color: #374151; border: 1px solid #D1D5DB; border-radius: 8px;
      padding: .5rem 1.1rem; font-size: .875rem; cursor: pointer; font-weight: 500;
    }
    .btn-secondary:hover { background: #F9FAFB; }

    .btn-link {
      background: none; border: none; color: #E30613;
      cursor: pointer; font-size: .85rem; font-weight: 600; padding: 0;
    }

    /* ══════════════════════════════════════════════════════════════════
       TABLE
    ═════════════════════════════════════════════════════════════════════ */
    .card {
      background: #fff; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
      border-top: 3px solid #E30613; overflow: hidden;
    }
    .data-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .data-table th {
      background: #F9FAFB; color: #6B7280; font-weight: 600;
      padding: .75rem 1rem; text-align: left; border-bottom: 1px solid #E5E7EB;
      font-size: .78rem; text-transform: uppercase; letter-spacing: .04em;
    }
    .data-table td { padding: .75rem 1rem; border-bottom: 1px solid #F3F4F6; color: #374151; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: #FAFAFA; }
    .ts-cell { color: #6B7280; font-size: .83rem; }

    .code-badge {
      background: #F3F4F6; padding: .2rem .5rem;
      border-radius: 4px; font-size: .8rem; font-family: monospace;
    }
    .items-chip {
      display: inline-block; background: #EFF6FF; color: #1D4ED8;
      border-radius: 20px; padding: .15rem .55rem; font-size: .75rem; font-weight: 600;
    }

    /* ── Status badges ── */
    .badge { display: inline-block; padding: .25rem .65rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .badge-pending  { background: #FEF3C7; color: #92400E; }
    .badge-approved { background: #D1FAE5; color: #065F46; }
    .badge-rejected { background: #FEE2E2; color: #991B1B; }
    .badge-closed   { background: #DBEAFE; color: #1E40AF; }

    /* ── Source chips ── */
    .chip-source { display: inline-block; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-source-stock    { background: #DBEAFE; color: #1E40AF; }
    .chip-source-client   { background: #D1FAE5; color: #065F46; }
    .chip-source-resil    { background: #EDE9FE; color: #5B21B6; }
    .chip-source-field    { background: #FEF3C7; color: #92400E; }
    .chip-source-unused   { background: #E0E7FF; color: #3730A3; }
    .chip-source-other    { background: #F3F4F6; color: #374151; }

    .empty-state { text-align: center; color: #6B7280; padding: 3rem; font-size: .95rem; }

    /* ══════════════════════════════════════════════════════════════════
       MODAL — flex-column layout; header + scrollable body + footer
    ═════════════════════════════════════════════════════════════════════ */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(17, 24, 39, 0.5);
      display: flex; align-items: flex-start; justify-content: center;
      z-index: 9999; padding: 5rem 1rem 2rem; overflow-y: auto; box-sizing: border-box;
    }
    .modal-box {
      position: relative; background: #fff; border-radius: 16px;
      width: 100%; max-width: 600px;
      display: flex; flex-direction: column;
      max-height: calc(100vh - 6rem);
      box-shadow: 0 20px 60px rgba(0,0,0,.25); margin: 0 auto;
    }
    .modal-box--wide { max-width: 920px; }

    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid #E5E7EB;
      flex-shrink: 0; background: #fff; border-radius: 16px 16px 0 0;
      position: sticky; top: 0; z-index: 2;
    }
    .modal-header-content { display: flex; flex-direction: column; gap: .25rem; }
    .modal-title    { margin: 0; font-size: 1.1rem; color: #111827; font-weight: 700; }
    .modal-subtitle { margin: 0; font-size: .8rem; color: #6B7280; }

    .modal-close {
      background: none; border: none; font-size: 1.2rem;
      cursor: pointer; color: #9CA3AF; padding: .2rem .4rem;
      border-radius: 6px; flex-shrink: 0; line-height: 1;
    }
    .modal-close:hover { background: #F3F4F6; color: #111827; }

    .modal-body {
      flex: 1; overflow-y: auto;
      padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 0;
    }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: .75rem;
      padding: 1rem 1.5rem; border-top: 1px solid #E5E7EB;
      flex-shrink: 0; background: #fff; border-radius: 0 0 16px 16px;
    }

    /* ══════════════════════════════════════════════════════════════════
       FORM FIELDS
    ═════════════════════════════════════════════════════════════════════ */
    .field-group { margin-bottom: 1rem; }
    .field-label {
      display: block; font-size: .8rem; font-weight: 600;
      color: #374151; margin-bottom: .35rem;
    }
    .field-label-sm {
      display: block; font-size: .75rem; font-weight: 600;
      color: #6B7280; margin-bottom: .25rem;
    }
    .field-input {
      width: 100%; border: 1px solid #D1D5DB; border-radius: 8px;
      padding: .5rem .75rem; font-size: .875rem; color: #111827;
      outline: none; box-sizing: border-box; background: #fff; font-family: inherit;
    }
    .field-input:focus { border-color: #E30613; box-shadow: 0 0 0 3px rgba(227,6,19,.1); }
    .field-textarea { resize: vertical; min-height: 72px; }
    .req      { color: #E30613; }
    .optional { color: #9CA3AF; font-weight: 400; }

    .field-hint {
      margin: .35rem 0 0; font-size: .78rem; color: #6B7280; line-height: 1.4;
    }
    .field-hint--blue { color: #1D4ED8; }

    /* ══════════════════════════════════════════════════════════════════
       SECTION DIVIDER
    ═════════════════════════════════════════════════════════════════════ */
    .section-divider {
      display: flex; align-items: center; justify-content: space-between;
      margin: 1.25rem 0 .75rem;
      font-size: .78rem; font-weight: 700; color: #6B7280;
      text-transform: uppercase; letter-spacing: .05em;
    }
    .section-hint { color: #E30613; font-weight: 600; text-transform: none; letter-spacing: 0; }

    /* ══════════════════════════════════════════════════════════════════
       ITEM SEARCH + DROPDOWN
    ═════════════════════════════════════════════════════════════════════ */
    .search-wrapper { position: relative; margin-bottom: .5rem; }
    .search-input   { padding-right: 2.5rem; }

    .search-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: #fff; border: 1px solid #E5E7EB; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); z-index: 100;
      overflow: hidden; max-height: 260px; overflow-y: auto;
    }
    .search-option {
      display: flex; align-items: center; justify-content: space-between; gap: .75rem;
      padding: .65rem 1rem; cursor: pointer;
      border-bottom: 1px solid #F3F4F6; transition: background .12s;
    }
    .search-option:last-child { border-bottom: none; }
    .search-option:hover:not(.search-option--added) { background: #FFF1F2; }
    .search-option--added { background: #F9FAFB; cursor: default; opacity: .75; }

    .search-option-main { display: flex; flex-direction: column; gap: .1rem; flex: 1; min-width: 0; }
    .search-eq-name  { font-size: .875rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .search-eq-code  { font-size: .75rem; color: #9CA3AF; font-family: monospace; }

    .search-option-right { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; }
    .avail-badge {
      background: #EFF6FF; color: #1D4ED8; border-radius: 20px;
      padding: .15rem .55rem; font-size: .75rem; font-weight: 600;
    }
    .avail-badge--zero     { background: #F3F4F6; color: #9CA3AF; }
    .avail-badge--external { background: #F0FDF4; color: #16A34A; }
    .add-label   { color: #16A34A; font-size: .78rem; font-weight: 700; }
    .added-label { color: #9CA3AF; font-size: .78rem; }

    /* ══════════════════════════════════════════════════════════════════
       SELECTED ITEMS LIST
    ═════════════════════════════════════════════════════════════════════ */
    .selected-items { display: flex; flex-direction: column; gap: .75rem; margin-top: .25rem; }

    .selected-item-card {
      border: 1px solid #E5E7EB; border-radius: 10px;
      padding: .9rem 1rem; background: #FAFAFA;
      display: flex; flex-direction: column; gap: .6rem;
    }
    .item-identity {
      display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem;
    }
    .item-identity-left { display: flex; flex-direction: column; gap: .15rem; }
    .item-eq-name { font-size: .9rem; font-weight: 700; color: #111827; }
    .item-eq-code { font-size: .75rem; color: #9CA3AF; font-family: monospace; }

    .btn-remove-item {
      background: none; border: 1px solid #FECACA; border-radius: 6px;
      color: #DC2626; cursor: pointer; font-size: .75rem; font-weight: 600;
      padding: .2rem .55rem; white-space: nowrap; flex-shrink: 0;
    }
    .btn-remove-item:hover { background: #FEE2E2; }

    .item-stock-bar {
      background: #EFF6FF; border-radius: 6px; padding: .35rem .65rem;
      font-size: .8rem; color: #1D4ED8; display: flex; gap: .5rem; align-items: center;
    }
    .item-stock-bar--warn { background: #FEF3C7; color: #92400E; }
    .stock-avail strong { font-weight: 700; }
    .stock-note { color: #6B7280; font-size: .75rem; }

    .item-fields {
      display: grid; grid-template-columns: 140px 1fr 1fr; gap: .65rem;
    }
    .item-field { display: flex; flex-direction: column; gap: .25rem; }
    .qty-input-wrapper { display: flex; align-items: center; gap: .35rem; }
    .qty-input  { flex: 1; }
    .qty-unit   { font-size: .8rem; color: #6B7280; white-space: nowrap; }
    .field-error-inline { font-size: .75rem; color: #DC2626; margin-top: .15rem; }

    .items-empty-hint {
      text-align: center; color: #9CA3AF; font-size: .85rem;
      padding: 1rem; background: #F9FAFB; border-radius: 8px;
      border: 1px dashed #E5E7EB; margin-top: .25rem;
    }

    /* ══════════════════════════════════════════════════════════════════
       ALERTS
    ═════════════════════════════════════════════════════════════════════ */
    .alert-error {
      display: flex; align-items: flex-start; gap: .5rem;
      background: #FEE2E2; color: #991B1B; border-radius: 8px;
      padding: .65rem 1rem; font-size: .85rem; margin-top: .75rem;
      border: 1px solid #FECACA;
    }
    .alert-icon { flex-shrink: 0; }

    /* ══════════════════════════════════════════════════════════════════
       DETAIL VIEW — header
    ═════════════════════════════════════════════════════════════════════ */
    .dv-header {
      background: linear-gradient(135deg, #fff 0%, #FFF8F8 100%);
      border-bottom: 2px solid #E5E7EB;
    }
    .dv-header__main {
      display: flex; align-items: center; gap: .85rem; flex-wrap: wrap; flex: 1; min-width: 0;
    }
    .dv-return-code {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 1.05rem; font-weight: 800; color: #111827;
      background: #F3F4F6; border: 1px solid #E5E7EB;
      padding: .3rem .75rem; border-radius: 8px; letter-spacing: .01em;
    }
    .dv-status-pill {
      font-size: .78rem !important; font-weight: 700 !important;
      padding: .32rem .9rem !important; border-radius: 999px !important;
      letter-spacing: .03em;
    }

    /* ── Detail metadata grid ───────────────────────────────────────── */
    .dv-body { gap: 1.25rem !important; }
    .dv-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden;
    }
    .dv-field {
      display: flex; flex-direction: column; gap: .3rem;
      padding: .9rem 1.1rem; border-bottom: 1px solid #E5E7EB;
      border-right: 1px solid #E5E7EB;
    }
    .dv-field:nth-child(even) { border-right: none; }
    .dv-field--full {
      grid-column: 1 / -1; border-right: none;
    }
    .dv-field:last-child,
    .dv-field:nth-last-child(2):not(.dv-field--full):nth-child(odd) {
      border-bottom: none;
    }
    .dv-field--full:last-child { border-bottom: none; }
    .dv-label {
      font-size: .68rem; font-weight: 800; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: .07em;
    }
    .dv-value { font-size: .9rem; color: #111827; font-weight: 500; line-height: 1.4; }
    .dv-muted { font-size: .9rem; color: #9CA3AF; }
    .dv-source-chip { align-self: flex-start; }

    .case-ref   { color: #2563EB; font-weight: 700; font-size: .9rem; }
    .planned-date { color: #1D4ED8; font-weight: 600; font-size: .9rem; }
    .review-comment-text {
      background: #FFF1F2; padding: .6rem .85rem; border-radius: 8px;
      border-left: 3px solid #E30613; color: #B00020; font-size: .875rem; line-height: 1.5;
    }

    /* ── Items table ────────────────────────────────────────────────── */
    .dv-table-wrap {
      border: 1px solid #E5E7EB; border-radius: 12px;
      overflow: hidden; overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .dv-items-table {
      width: 100%; border-collapse: collapse; font-size: .875rem; min-width: 540px;
    }
    .dv-th {
      background: #F8FAFC; color: #6B7280; font-weight: 700;
      padding: .7rem 1rem; text-align: left; border-bottom: 1px solid #E5E7EB;
      font-size: .72rem; text-transform: uppercase; letter-spacing: .05em;
      white-space: nowrap;
    }
    .dv-th--num { text-align: right; width: 4rem; }
    .dv-td { padding: .85rem 1rem; border-bottom: 1px solid #F3F4F6; color: #374151; vertical-align: top; }
    .dv-tr:last-child .dv-td { border-bottom: none; }
    .dv-tr:hover .dv-td { background: #FAFAFA; }
    .dv-td--num  { text-align: right; font-weight: 700; color: #111827; }
    .dv-td--muted { color: #9CA3AF; font-size: .83rem; }
    .dv-eq-name  { font-weight: 700; color: #111827; font-size: .9rem; }

    .dv-id-list { display: flex; flex-direction: column; gap: .28rem; }
    .dv-id-chip {
      display: inline-flex; align-items: center; gap: .35rem;
      background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 6px;
      padding: .15rem .5rem; font-size: .75rem; color: #374151;
      font-family: 'SFMono-Regular', Consolas, monospace; white-space: nowrap;
    }
    .dv-id-chip__key {
      font-weight: 800; color: #9CA3AF; font-size: .65rem;
      text-transform: uppercase; letter-spacing: .06em; font-family: inherit;
    }

    /* ── Timestamps ─────────────────────────────────────────────────── */
    .detail-timestamps {
      display: flex; flex-wrap: wrap; gap: .75rem 1.5rem;
      font-size: .8rem; color: #9CA3AF; padding-top: .25rem;
      border-top: 1px dashed #E5E7EB;
    }

    /* ══════════════════════════════════════════════════════════════════
       RESPONSIVE
    ═════════════════════════════════════════════════════════════════════ */
    @media (max-width: 640px) {
      .modal-backdrop { padding: 4.5rem .6rem 1.5rem; }
      .modal-box { border-radius: 14px; max-height: calc(100vh - 5.5rem); }
    }
    @media (max-width: 480px) {
      .item-fields { grid-template-columns: 1fr 1fr; }
      .item-field--qty { grid-column: 1 / -1; }
      .dv-grid { grid-template-columns: 1fr; }
      .dv-field { border-right: none; }
      .dv-field:nth-last-child(2):not(.dv-field--full):nth-child(odd) { border-bottom: 1px solid #E5E7EB; }
      .dv-header__main { gap: .55rem; }
      .dv-return-code { font-size: .9rem; }
    }
  `]
})
export class SttMaterialReturnsComponent implements OnInit {
  private readonly returnService = inject(MaterialReturnService);
  private readonly stockService  = inject(StockService);
  private readonly cdr           = inject(ChangeDetectorRef);

  returns: MaterialReturn[] = [];
  loading = true;

  // ── Create modal state ────────────────────────────────────────────────────
  showCreateModal = false;
  submitting      = false;
  formError       = '';

  form: {
    crmCase:           string;
    returnSource:      ReturnSource | '';
    plannedReturnDate: string;
    reason:            ReturnReason | '';
    condition:         ReturnCondition | '';
    destination:       ReturnDestination | '';
    comment:           string;
  } = {
    crmCase: '', returnSource: '', plannedReturnDate: '',
    reason: '', condition: '', destination: '', comment: '',
  };

  itemRows:          ItemRow[]          = [];
  itemSearch:        string             = '';
  searchableItems:   SearchableItem[]   = [];
  filteredEquipment: SearchableItem[]   = [];

  private allEquipment: Equipment[] = [];
  private sttStock: SttStock | null  = null;

  // ── Detail modal ──────────────────────────────────────────────────────────
  selectedReturn: MaterialReturn | null = null;

  // ── Option lists ──────────────────────────────────────────────────────────
  readonly sourceOptions = Object.entries(RETURN_SOURCE_LABELS).map(([v, l]) =>
    ({ value: v as ReturnSource, label: l }));
  readonly reasonOptions = Object.entries(RETURN_REASON_LABELS).map(([v, l]) =>
    ({ value: v as ReturnReason, label: l }));
  readonly conditionOptions = Object.entries(RETURN_CONDITION_LABELS).map(([v, l]) =>
    ({ value: v as ReturnCondition, label: l }));
  readonly destinationOptions = Object.entries(RETURN_DESTINATION_LABELS).map(([v, l]) =>
    ({ value: v as ReturnDestination, label: l }));

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    forkJoin({
      returns:   this.returnService.getMyReturns().pipe(catchError(() => of<MaterialReturn[]>([]))),
      equipment: this.stockService.getEquipment().pipe(catchError(() => of<Equipment[]>([]))),
      stock:     this.stockService.getMySttStock().pipe(catchError(() => of<SttStock | null>(null))),
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: ({ returns, equipment, stock }) => {
        this.returns      = returns;
        this.allEquipment = equipment;
        this.sttStock     = stock;
        this.buildSearchableItems();
      },
      error: () => {}
    });
  }

  // ── Build searchable list from the FULL equipment catalog ─────────────────

  private buildSearchableItems(): void {
    // Index STT stock by equipmentId for O(1) lookup
    const stockMap = new Map<string, SttStockItem>();
    if (this.sttStock?.items) {
      this.sttStock.items.forEach(si => stockMap.set(si.equipmentId, si));
    }

    // Build from all active catalog items
    this.searchableItems = this.allEquipment
      .filter(e => (e as any).active !== false)
      .map(e => {
        const si = stockMap.get(e.id);
        return {
          equipmentId:   e.id,
          equipmentName: e.name,
          articleCode:   e.articleCode ?? '',
          unit:          si?.unit ?? (e.unit ?? ''),
          availableQty:  si?.availableQuantity ?? 0,
          inSttStock:    si !== undefined,
        };
      })
      .sort((a, b) => {
        // In-stock items first, then alphabetical
        if (a.inSttStock !== b.inSttStock) return a.inSttStock ? -1 : 1;
        return a.equipmentName.localeCompare(b.equipmentName);
      });
  }

  // ── Modal open / close ───────────────────────────────────────────────────

  openCreateModal(): void {
    this.form = {
      crmCase: '', returnSource: '', plannedReturnDate: '',
      reason: '', condition: '', destination: '', comment: '',
    };
    this.itemRows          = [];
    this.itemSearch        = '';
    this.filteredEquipment = [];
    this.formError         = '';
    this.showCreateModal   = true;
    this.buildSearchableItems();
  }

  openDetail(r: MaterialReturn): void { this.selectedReturn = r; }

  closeModals(): void {
    this.showCreateModal  = false;
    this.selectedReturn   = null;
    this.filteredEquipment = [];
    this.itemSearch        = '';
  }

  // ── Search & selection ────────────────────────────────────────────────────

  filterEquipment(): void {
    const q = this.itemSearch.toLowerCase().trim();
    if (!q) { this.filteredEquipment = []; return; }

    this.filteredEquipment = this.searchableItems.filter(si =>
      si.equipmentName.toLowerCase().includes(q) ||
      si.articleCode.toLowerCase().includes(q)
    );
  }

  isAlreadyAdded(equipmentId: string): boolean {
    return this.itemRows.some(r => r.equipmentId === equipmentId);
  }

  /** mousedown fires before input blur — prevents dropdown from closing before selection registers */
  onItemMousedown(event: MouseEvent, si: SearchableItem): void {
    event.preventDefault();

    if (this.isAlreadyAdded(si.equipmentId)) {
      this.formError = `"${si.equipmentName}" is already in the list below.`;
      setTimeout(() => this.formError = '', 3500);
      this.itemSearch        = '';
      this.filteredEquipment = [];
      return;
    }

    this.itemRows.push({
      equipmentId:   si.equipmentId,
      equipmentName: si.equipmentName,
      articleCode:   si.articleCode,
      unit:          si.unit,
      availableQty:  si.availableQty,
      inSttStock:    si.inSttStock,
      quantity:      1,
      condition:     '',
      serialNumber:  '',
    });

    this.itemSearch        = '';
    this.filteredEquipment = [];
    this.formError         = '';
  }

  removeItem(index: number): void { this.itemRows.splice(index, 1); }

  onReasonChange(): void {
    if (this.form.reason !== 'OTHER') this.form.comment = '';

    // Auto-suggest return source if not yet chosen
    if (!this.form.returnSource) {
      const suggestions: Partial<Record<ReturnReason, ReturnSource>> = {
        CLIENT_RESILIATION_RECOVERY: 'RESILIATION_RECOVERY',
        DAMAGED:                     'DAMAGED_FIELD_RECOVERY',
        BROKEN:                      'DAMAGED_FIELD_RECOVERY',
        UNUSED:                      'UNUSED_FIELD_MATERIAL',
        WRONG_DISTRIBUTION:          'STT_STOCK',
        REPLACEMENT:                 'STT_STOCK',
      };
      const suggested = suggestions[this.form.reason as ReturnReason];
      if (suggested) this.form.returnSource = suggested;
    }
  }

  onSourceChange(): void {
    // Clear per-item stock errors when source changes
    this.formError = '';
  }

  clearError(): void { this.formError = ''; }

  // ── Submit ────────────────────────────────────────────────────────────────

  submitReturn(): void {
    this.formError = '';

    if (!this.form.returnSource)  { this.formError = 'Return source is required.';      return; }
    if (!this.form.reason)        { this.formError = 'Return reason is required.';      return; }
    if (!this.form.condition)     { this.formError = 'Return condition is required.';   return; }
    if (!this.form.destination)   { this.formError = 'Return destination is required.'; return; }
    if (this.itemRows.length === 0) { this.formError = 'At least one item is required.'; return; }

    if (this.form.reason === 'OTHER' && !this.form.comment.trim()) {
      this.formError = 'A comment is required when the reason is "Other".'; return;
    }

    for (const row of this.itemRows) {
      if (!row.quantity || row.quantity <= 0) {
        this.formError = `Quantity must be greater than 0 for "${row.equipmentName}".`; return;
      }
      // Stock validation only for STT_STOCK source
      if (this.form.returnSource === 'STT_STOCK') {
        if (!row.inSttStock) {
          this.formError =
            `"${row.equipmentName}" is not in your STT stock. ` +
            `Switch the return source to an external source, or remove this item.`;
          return;
        }
        if (row.quantity > row.availableQty) {
          this.formError =
            `Cannot return ${row.quantity} ${row.unit} of "${row.equipmentName}". ` +
            `Available STT stock: ${row.availableQty} ${row.unit}.`;
          return;
        }
      }
    }

    const payload: CreateMaterialReturnRequest = {
      crmCase:           this.form.crmCase           || undefined,
      returnSource:      this.form.returnSource       as ReturnSource,
      plannedReturnDate: this.form.plannedReturnDate  || undefined,
      reason:            this.form.reason             as ReturnReason,
      condition:         this.form.condition          as ReturnCondition,
      destination:       this.form.destination        as ReturnDestination,
      items: this.itemRows.map(r => ({
        equipmentId:  r.equipmentId,
        quantity:     r.quantity,
        condition:    r.condition    || undefined,
        serialNumber: r.serialNumber || undefined,
      } as ReturnedItemRequest)),
      comment: this.form.comment || undefined,
    };

    this.submitting = true;
    this.returnService.createReturn(payload).subscribe({
      next: (created) => {
        this.returns    = [created, ...this.returns];
        this.submitting = false;
        this.closeModals();
      },
      error: (err) => {
        this.formError  = err?.error?.message ?? 'An error occurred. Please try again.';
        this.submitting = false;
      },
    });
  }

  // ── Label / class helpers ─────────────────────────────────────────────────

  reasonLabel(r: ReturnReason):           string { return RETURN_REASON_LABELS[r]      ?? r; }
  conditionLabel(c: ReturnCondition):     string { return RETURN_CONDITION_LABELS[c]   ?? c; }
  destinationLabel(d: ReturnDestination): string { return RETURN_DESTINATION_LABELS[d] ?? d; }
  sourceLabel(s: ReturnSource):           string { return RETURN_SOURCE_LABELS[s]       ?? s; }
  statusLabel(s: MaterialReturnStatus):   string { return RETURN_STATUS_LABELS[s]       ?? s; }

  statusClass(s: MaterialReturnStatus): string {
    return 'badge badge-' + s.toLowerCase();
  }

  sourceChipClass(s: ReturnSource | undefined): string {
    if (!s) return 'chip-source chip-source-other';
    const map: Record<ReturnSource, string> = {
      STT_STOCK:              'chip-source chip-source-stock',
      CLIENT_RECOVERY:        'chip-source chip-source-client',
      RESILIATION_RECOVERY:   'chip-source chip-source-resil',
      DAMAGED_FIELD_RECOVERY: 'chip-source chip-source-field',
      UNUSED_FIELD_MATERIAL:  'chip-source chip-source-unused',
      OTHER:                  'chip-source chip-source-other',
    };
    return map[s] ?? 'chip-source chip-source-other';
  }
}
