import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { catchError, finalize, of } from 'rxjs';

import { MaterialReturnService } from '../../../../core/stock/material-return.service';
import {
  MaterialReturn,
  MaterialReturnStatus,
  ReturnReason,
  ReturnCondition,
  ReturnDestination,
  ReturnSource,
  ReviewMaterialReturnRequest,
  RETURN_REASON_LABELS,
  RETURN_CONDITION_LABELS,
  RETURN_DESTINATION_LABELS,
  RETURN_SOURCE_LABELS,
  RETURN_STATUS_LABELS,
} from '../../../../core/stock/material-return.model';

type TabId = 'pending' | 'history';

interface KpiCard { label: string; value: number; color: string; }

@Component({
  selector: 'app-zm-material-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── Page Header ─────────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Material Returns Review</h2>
        <p class="page-subtitle">Review returned, damaged, recovered, and unused material from your STTs.</p>
      </div>
    </div>

    <!-- ── KPI Row ────────────────────────────────────────────────────── -->
    <div class="kpi-row">
      <div *ngFor="let kpi of kpiCards" class="kpi-card" [style.border-top-color]="kpi.color">
        <span class="kpi-value" [style.color]="kpi.color">{{ kpi.value }}</span>
        <span class="kpi-label">{{ kpi.label }}</span>
      </div>
    </div>

    <!-- ── Tabs ───────────────────────────────────────────────────────── -->
    <div class="tab-bar">
      <button [class.tab-active]="activeTab === 'pending'" (click)="activeTab = 'pending'">
        Pending Review
        <span *ngIf="pendingReturns.length > 0" class="tab-badge">{{ pendingReturns.length }}</span>
      </button>
      <button [class.tab-active]="activeTab === 'history'" (click)="activeTab = 'history'">
        History
      </button>
    </div>

    <!-- ── Filters (History tab) ──────────────────────────────────────── -->
    <div *ngIf="activeTab === 'history'" class="filter-row">
      <input type="text" [(ngModel)]="filterStt" placeholder="Filter by STT name…" />
      <select [(ngModel)]="filterStatus">
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="CLOSED">Closed</option>
      </select>
      <select [(ngModel)]="filterSource">
        <option value="">All sources</option>
        <option *ngFor="let opt of sourceOptions" [value]="opt.value">{{ opt.label }}</option>
      </select>
      <select [(ngModel)]="filterReason">
        <option value="">All reasons</option>
        <option *ngFor="let opt of reasonOptions" [value]="opt.value">{{ opt.label }}</option>
      </select>
      <select [(ngModel)]="filterDestination">
        <option value="">All destinations</option>
        <option *ngFor="let opt of destinationOptions" [value]="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- ── Loading ────────────────────────────────────────────────────── -->
    <div *ngIf="loading" class="empty-state">Loading returns…</div>

    <!-- ── Pending Tab ────────────────────────────────────────────────── -->
    <ng-container *ngIf="!loading && activeTab === 'pending'">
      <div *ngIf="pendingReturns.length === 0" class="empty-state">
        No pending material returns. Your STTs are all clear.
      </div>

      <div class="returns-grid" *ngIf="pendingReturns.length > 0">
        <div *ngFor="let r of pendingReturns" class="return-card">
          <div class="return-card-top">
            <div>
              <code class="code-badge">{{ r.returnCode }}</code>
              <span *ngIf="r.crmCase" class="case-link">Case: {{ r.crmCase }}</span>
            </div>
            <span [class]="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
          </div>

          <div class="return-card-meta">
            <span class="meta-chip meta-stt">👤 {{ r.sttName }}</span>
            <span *ngIf="r.returnSource" [class]="sourceChipClass(r.returnSource)">
              {{ sourceLabel(r.returnSource) }}
            </span>
            <span [class]="reasonClass(r.reason)">{{ reasonLabel(r.reason) }}</span>
            <span [class]="conditionChipClass(r.condition)">{{ conditionLabel(r.condition) }}</span>
            <span [class]="destinationChipClass(r.destination)">{{ destinationLabel(r.destination) }}</span>
          </div>

          <div class="return-card-summary">
            {{ r.items.length }} item{{ r.items.length !== 1 ? 's' : '' }} ·
            {{ totalQty(r) }} unit{{ totalQty(r) !== 1 ? 's' : '' }} ·
            <span *ngIf="r.plannedReturnDate" class="planned-date-chip">
              📅 Handover: {{ r.plannedReturnDate }}
            </span>
            <span class="ts-muted">{{ r.submittedAt | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>

          <div *ngIf="r.comment" class="return-card-comment">{{ r.comment }}</div>

          <div class="return-card-actions">
            <button class="btn-outline" (click)="openDetail(r)">Review</button>
            <button class="btn-approve" (click)="openApproveModal(r)">Approve</button>
            <button class="btn-reject" (click)="openRejectModal(r)">Reject</button>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- ── History Tab ────────────────────────────────────────────────── -->
    <ng-container *ngIf="!loading && activeTab === 'history'">
      <div *ngIf="filteredHistory.length === 0" class="empty-state">No returns match your filters.</div>

      <div class="card" *ngIf="filteredHistory.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>STT</th>
              <th>Reason</th>
              <th>Condition</th>
              <th>Destination</th>
              <th>Items</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of filteredHistory">
              <td><code class="code-badge">{{ r.returnCode }}</code></td>
              <td>{{ r.sttName }}</td>
              <td>{{ reasonLabel(r.reason) }}</td>
              <td>{{ conditionLabel(r.condition) }}</td>
              <td>{{ destinationLabel(r.destination) }}</td>
              <td>{{ r.items.length }}</td>
              <td><span [class]="statusClass(r.status)">{{ statusLabel(r.status) }}</span></td>
              <td>{{ r.createdAt | date:'dd/MM/yyyy' }}</td>
              <td><button class="btn-link" (click)="openDetail(r)">View</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <!-- ═════════════════════════════════════════════════════════════════
         DETAIL DRAWER / MODAL
    ══════════════════════════════════════════════════════════════════ -->
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
          <button class="modal-close" (click)="closeModals()" aria-label="Close">✕</button>
        </div>

        <!-- ── Body ───────────────────────────────────────────────── -->
        <div class="modal-body dv-body">

          <!-- Metadata grid -->
          <div class="dv-grid">
            <div class="dv-field">
              <span class="dv-label">STT</span>
              <span class="dv-value">{{ selectedReturn.sttName }}</span>
            </div>
            <div class="dv-field" *ngIf="selectedReturn.returnSource">
              <span class="dv-label">Return Source</span>
              <span [class]="sourceChipClass(selectedReturn.returnSource!)" class="dv-source-chip">
                {{ sourceLabel(selectedReturn.returnSource!) }}
              </span>
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
              <span class="planned-date-text">{{ selectedReturn.plannedReturnDate }}</span>
            </div>
            <div class="dv-field" *ngIf="selectedReturn.crmCase">
              <span class="dv-label">Linked Case</span>
              <span class="case-link-text">{{ selectedReturn.crmCase }}</span>
            </div>
            <div class="dv-field dv-field--full" *ngIf="selectedReturn.comment">
              <span class="dv-label">STT Comment</span>
              <span class="dv-value">{{ selectedReturn.comment }}</span>
            </div>
          </div>

          <!-- Items section -->
          <div class="section-title">
            Returned Items
            <span class="section-title__count">
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
                  <td class="dv-td"><strong class="dv-eq-name">{{ item.equipmentName }}</strong></td>
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

          <!-- Proof images -->
          <div *ngIf="selectedReturn.proofImageUrls && selectedReturn.proofImageUrls.length > 0">
            <div class="section-title">Proof Images</div>
            <div class="proof-images">
              <img *ngFor="let url of selectedReturn.proofImageUrls"
                   [src]="url" class="proof-thumb" alt="proof" />
            </div>
          </div>

          <!-- Review comment -->
          <div *ngIf="selectedReturn.reviewComment" class="review-comment-box">
            <span class="dv-label">ZM Review Comment</span>
            <p>{{ selectedReturn.reviewComment }}</p>
            <span class="ts-muted">
              by {{ selectedReturn.reviewedByZmName }}
              · {{ selectedReturn.reviewedAt | date:'dd/MM/yyyy HH:mm' }}
            </span>
          </div>

          <!-- Timestamps -->
          <div class="detail-timestamps">
            <span>Submitted: {{ selectedReturn.submittedAt | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>

        </div>

        <!-- ── Footer ──────────────────────────────────────────────── -->
        <div class="modal-footer">
          <button class="btn-secondary" (click)="closeModals()">Close</button>
          <ng-container *ngIf="selectedReturn.status === 'PENDING'">
            <button class="btn-reject" (click)="openRejectModal(selectedReturn)">Reject</button>
            <button class="btn-approve" (click)="openApproveModal(selectedReturn)">Approve</button>
          </ng-container>
        </div>

      </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════
         APPROVE MODAL
    ══════════════════════════════════════════════════════════════════ -->
    <div *ngIf="approveTarget" class="modal-backdrop" (click)="closeActionModals()">
      <div class="modal-box modal-box--sm" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Approve Return</h3>
          <button class="modal-close" (click)="closeActionModals()">✕</button>
        </div>
        <div class="modal-body">
          <p class="confirm-msg">
            You are about to approve <strong>{{ approveTarget.returnCode }}</strong> from
            <strong>{{ approveTarget.sttName }}</strong>.
            <ng-container *ngIf="approveTarget.returnSource === 'STT_STOCK'">
              This will <strong>decrease their available STT stock</strong> for each returned item.
            </ng-container>
            <ng-container *ngIf="approveTarget.returnSource && approveTarget.returnSource !== 'STT_STOCK'">
              Source: <strong>{{ sourceLabel(approveTarget.returnSource) }}</strong> —
              STT stock will <strong>not</strong> be decreased (external/recovered material).
            </ng-container>
          </p>
          <div class="form-row">
            <label>Review Comment (optional)</label>
            <textarea [(ngModel)]="approveComment" rows="2"
                      placeholder="Approval note…"></textarea>
          </div>
          <div *ngIf="actionError" class="alert-error">{{ actionError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" (click)="closeActionModals()">Cancel</button>
          <button class="btn-approve" (click)="confirmApprove()" [disabled]="actionLoading">
            {{ actionLoading ? 'Processing…' : 'Confirm Approve' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════
         REJECT MODAL
    ══════════════════════════════════════════════════════════════════ -->
    <div *ngIf="rejectTarget" class="modal-backdrop" (click)="closeActionModals()">
      <div class="modal-box modal-box--sm" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Reject Return</h3>
          <button class="modal-close" (click)="closeActionModals()">✕</button>
        </div>
        <div class="modal-body">
          <p class="confirm-msg">
            You are about to reject <strong>{{ rejectTarget.returnCode }}</strong> from
            <strong>{{ rejectTarget.sttName }}</strong>.
            STT stock will remain unchanged.
          </p>
          <div class="form-row">
            <label>Rejection Reason <span class="req">*</span></label>
            <textarea [(ngModel)]="rejectComment" rows="3"
                      placeholder="Explain why this return is rejected…"></textarea>
          </div>
          <div *ngIf="actionError" class="alert-error">{{ actionError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" (click)="closeActionModals()">Cancel</button>
          <button class="btn-reject-confirm" (click)="confirmReject()" [disabled]="actionLoading">
            {{ actionLoading ? 'Processing…' : 'Confirm Reject' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 1.5rem; background: #F8FAFC; min-height: 100%; }

    /* ── Header ── */
    .page-header { margin-bottom: 1.5rem; }
    .page-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 .25rem; }
    .page-subtitle { color: #6B7280; font-size: .875rem; margin: 0; }

    /* ── KPI ── */
    .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi-card {
      background: #fff; border-radius: 12px; padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,.07); border-top: 3px solid #E5E7EB;
      display: flex; flex-direction: column; gap: .25rem;
    }
    .kpi-value { font-size: 1.75rem; font-weight: 700; line-height: 1; }
    .kpi-label { font-size: .78rem; color: #6B7280; font-weight: 500; }

    /* ── Tabs ── */
    .tab-bar {
      display: flex; gap: .25rem; background: #F3F4F6; border-radius: 10px;
      padding: .25rem; margin-bottom: 1.25rem; width: fit-content;
    }
    .tab-bar button {
      padding: .45rem 1.1rem; border: none; background: transparent;
      border-radius: 8px; font-size: .875rem; font-weight: 500; color: #6B7280; cursor: pointer;
      display: flex; align-items: center; gap: .4rem;
    }
    .tab-bar button:hover { color: #111827; }
    .tab-active { background: #fff !important; color: #E30613 !important; font-weight: 600 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .tab-badge {
      background: #E30613; color: #fff; border-radius: 20px;
      padding: .1rem .45rem; font-size: .7rem; font-weight: 700;
    }

    /* ── Filters ── */
    .filter-row {
      display: flex; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap;
    }
    .filter-row input, .filter-row select {
      border: 1px solid #D1D5DB; border-radius: 8px; padding: .45rem .75rem;
      font-size: .875rem; color: #374151; min-width: 160px;
    }

    /* ── Return cards grid ── */
    .returns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1rem; }
    .return-card {
      background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.07);
      border-left: 4px solid #F59E0B; padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: .7rem;
    }
    .return-card-top { display: flex; align-items: flex-start; justify-content: space-between; }
    .return-card-meta { display: flex; flex-wrap: wrap; gap: .4rem; }
    .return-card-summary { font-size: .83rem; color: #6B7280; }
    .return-card-comment { font-size: .83rem; color: #374151; background: #F9FAFB; padding: .5rem .75rem; border-radius: 6px; }
    .return-card-actions { display: flex; gap: .5rem; margin-top: .25rem; }

    /* ── Chips / badges ── */
    .badge { display: inline-block; padding: .25rem .65rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .badge-pending  { background: #FEF3C7; color: #92400E; }
    .badge-approved { background: #D1FAE5; color: #065F46; }
    .badge-rejected { background: #FEE2E2; color: #991B1B; }
    .badge-closed   { background: #DBEAFE; color: #1E40AF; }

    .meta-chip { display: inline-block; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 500; background: #F3F4F6; color: #374151; }
    .meta-stt { background: #EFF6FF; color: #1D4ED8; }

    /* Source chips */
    .chip-source { display: inline-block; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-source-stock   { background: #DBEAFE; color: #1E40AF; }
    .chip-source-client  { background: #D1FAE5; color: #065F46; }
    .chip-source-resil   { background: #EDE9FE; color: #5B21B6; }
    .chip-source-field   { background: #FEF3C7; color: #92400E; }
    .chip-source-unused  { background: #E0E7FF; color: #3730A3; }
    .chip-source-other   { background: #F3F4F6; color: #374151; }

    .planned-date-chip { color: #1D4ED8; font-size: .8rem; font-weight: 600; margin-right: .25rem; }
    .planned-date-text { color: #1D4ED8; font-weight: 600; }

    /* Reason chips */
    .chip-reason-damaged      { background: #FEF3C7; color: #92400E; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-reason-broken       { background: #FEE2E2; color: #991B1B; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-reason-resiliation  { background: #D1FAE5; color: #065F46; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-reason-unused       { background: #E0E7FF; color: #3730A3; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-reason-wrong        { background: #FDE68A; color: #78350F; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-reason-default      { background: #F3F4F6; color: #374151; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }

    /* Condition chips */
    .chip-cond-good     { background: #D1FAE5; color: #065F46; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-cond-damage   { background: #FEF3C7; color: #92400E; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-cond-broken   { background: #FEE2E2; color: #991B1B; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-cond-default  { background: #F3F4F6; color: #374151; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }

    /* Destination chips */
    .chip-dest-usable   { background: #D1FAE5; color: #065F46; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-dest-damaged  { background: #FEE2E2; color: #991B1B; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-dest-repair   { background: #DBEAFE; color: #1E40AF; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-dest-recon    { background: #EDE9FE; color: #5B21B6; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .chip-dest-scrap    { background: #F3F4F6; color: #374151; padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }

    /* ── Buttons ── */
    .btn-primary {
      background: #E30613; color: #fff; border: none; border-radius: 8px;
      padding: .55rem 1.25rem; font-weight: 600; cursor: pointer; font-size: .875rem;
    }
    .btn-secondary {
      background: #fff; color: #374151; border: 1px solid #D1D5DB; border-radius: 8px;
      padding: .5rem 1.1rem; font-size: .875rem; cursor: pointer;
    }
    .btn-outline {
      background: #fff; color: #374151; border: 1px solid #D1D5DB; border-radius: 8px;
      padding: .4rem .9rem; font-size: .82rem; cursor: pointer; font-weight: 500;
    }
    .btn-outline:hover { background: #F9FAFB; }
    .btn-approve {
      background: #16A34A; color: #fff; border: none; border-radius: 8px;
      padding: .4rem .9rem; font-size: .82rem; cursor: pointer; font-weight: 600;
    }
    .btn-approve:hover:not(:disabled) { background: #15803D; }
    .btn-approve:disabled { opacity: .6; cursor: not-allowed; }
    .btn-reject {
      background: #FEE2E2; color: #991B1B; border: none; border-radius: 8px;
      padding: .4rem .9rem; font-size: .82rem; cursor: pointer; font-weight: 600;
    }
    .btn-reject:hover { background: #FECACA; }
    .btn-reject-confirm {
      background: #DC2626; color: #fff; border: none; border-radius: 8px;
      padding: .5rem 1.1rem; font-size: .875rem; cursor: pointer; font-weight: 600;
    }
    .btn-reject-confirm:hover:not(:disabled) { background: #B91C1C; }
    .btn-reject-confirm:disabled { opacity: .6; cursor: not-allowed; }
    .btn-link { background: none; border: none; color: #E30613; cursor: pointer; font-size: .85rem; font-weight: 600; padding: 0; }

    /* ── Card / Table ── */
    .card {
      background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
      border-top: 3px solid #E30613; overflow: hidden;
    }
    .data-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .data-table th { background: #F9FAFB; color: #6B7280; font-weight: 600;
      padding: .75rem 1rem; text-align: left; border-bottom: 1px solid #E5E7EB;
      font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
    .data-table td { padding: .75rem 1rem; border-bottom: 1px solid #F3F4F6; color: #374151; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: #FAFAFA; }
    .code-badge { background: #F3F4F6; padding: .2rem .5rem; border-radius: 4px; font-size: .8rem; }
    .case-link { font-size: .78rem; color: #2563EB; margin-left: .5rem; }
    .case-link-text { color: #2563EB; font-weight: 600; }

    /* ── Modal ── */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(17,24,39,.5);
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
    .modal-box--sm   { max-width: 480px; }
    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid #E5E7EB;
      flex-shrink: 0; border-radius: 16px 16px 0 0;
      position: sticky; top: 0; z-index: 2;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; color: #111827; font-weight: 700; }
    .modal-close {
      background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #9CA3AF;
      padding: .2rem .4rem; border-radius: 6px; flex-shrink: 0; line-height: 1;
    }
    .modal-close:hover { background: #F3F4F6; color: #111827; }
    .modal-body  { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
    .modal-footer {
      padding: 1rem 1.5rem; border-top: 1px solid #E5E7EB;
      display: flex; justify-content: flex-end; gap: .75rem; align-items: center;
      flex-shrink: 0; border-radius: 0 0 16px 16px;
    }

    /* ── Detail view — header ── */
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

    /* ── Detail view — metadata grid ── */
    .dv-body { display: flex; flex-direction: column; gap: 1.25rem; }
    .dv-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden;
    }
    .dv-field {
      display: flex; flex-direction: column; gap: .3rem;
      padding: .9rem 1.1rem; border-bottom: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB;
    }
    .dv-field:nth-child(even) { border-right: none; }
    .dv-field--full { grid-column: 1 / -1; border-right: none; }
    .dv-field:last-child { border-bottom: none; }
    .dv-field--full:last-child { border-bottom: none; }
    .dv-label {
      font-size: .68rem; font-weight: 800; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: .07em;
    }
    .dv-value { font-size: .9rem; color: #111827; font-weight: 500; line-height: 1.4; }
    .dv-source-chip { align-self: flex-start; }
    .planned-date-text { color: #1D4ED8; font-weight: 600; font-size: .9rem; }
    .case-link-text { color: #2563EB; font-weight: 700; font-size: .9rem; }

    /* ── Detail view — section title ── */
    .section-title {
      display: flex; align-items: center; justify-content: space-between;
      font-size: .8rem; font-weight: 700; color: #6B7280;
      text-transform: uppercase; letter-spacing: .05em;
    }
    .section-title__count {
      font-weight: 600; color: #E30613; font-size: .75rem;
      text-transform: none; letter-spacing: 0;
    }

    /* ── Detail view — items table ── */
    .dv-table-wrap {
      border: 1px solid #E5E7EB; border-radius: 12px;
      overflow: hidden; overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .dv-items-table { width: 100%; border-collapse: collapse; font-size: .875rem; min-width: 520px; }
    .dv-th {
      background: #F8FAFC; color: #6B7280; font-weight: 700;
      padding: .7rem 1rem; text-align: left; border-bottom: 1px solid #E5E7EB;
      font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap;
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

    /* ── Detail view — review box + timestamps ── */
    .review-comment-box {
      background: #FFF1F2; border-radius: 10px; padding: .85rem 1rem;
      border-left: 3px solid #E30613; display: flex; flex-direction: column; gap: .35rem;
    }
    .review-comment-box p { margin: 0; color: #B00020; font-size: .9rem; line-height: 1.5; }
    .proof-images { display: flex; gap: .5rem; flex-wrap: wrap; }
    .proof-thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #E5E7EB; }
    .detail-timestamps {
      display: flex; flex-wrap: wrap; gap: .75rem 1.5rem;
      font-size: .8rem; color: #9CA3AF; padding-top: .25rem; border-top: 1px dashed #E5E7EB;
    }
    .ts-muted { color: #9CA3AF; font-size: .8rem; }

    @media (max-width: 640px) {
      .modal-backdrop { padding: 4.5rem .6rem 1.5rem; }
      .modal-box { border-radius: 14px; max-height: calc(100vh - 5.5rem); }
    }
    @media (max-width: 480px) {
      .dv-grid { grid-template-columns: 1fr; }
      .dv-field { border-right: none; }
      .dv-field:nth-last-child(2):not(.dv-field--full):nth-child(odd) { border-bottom: 1px solid #E5E7EB; }
      .dv-header__main { gap: .55rem; }
      .dv-return-code { font-size: .9rem; }
    }

    /* ── Form ── */
    .form-row { margin-bottom: .9rem; }
    .form-row label { display: block; font-size: .8rem; font-weight: 600; color: #374151; margin-bottom: .3rem; }
    .form-row input, .form-row textarea {
      width: 100%; border: 1px solid #D1D5DB; border-radius: 8px;
      padding: .5rem .75rem; font-size: .875rem; box-sizing: border-box;
    }
    .confirm-msg { font-size: .9rem; color: #374151; margin-bottom: 1rem; line-height: 1.5; }
    .req { color: #E30613; }

    /* ── Alert ── */
    .alert-error {
      background: #FEE2E2; color: #991B1B; border-radius: 8px;
      padding: .65rem 1rem; font-size: .85rem; margin-top: .75rem;
    }
    .empty-state { text-align: center; color: #6B7280; padding: 3rem; font-size: .95rem; }
  `]
})
export class ZmMaterialReturnsComponent implements OnInit {
  private readonly returnService = inject(MaterialReturnService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  activeTab: TabId = 'pending';

  pendingReturns: MaterialReturn[] = [];
  allReturns: MaterialReturn[] = [];

  // Filters for history
  filterStt         = '';
  filterStatus      = '';
  filterSource      = '';
  filterReason      = '';
  filterDestination = '';

  // Detail modal
  selectedReturn: MaterialReturn | null = null;

  // Approve modal
  approveTarget: MaterialReturn | null = null;
  approveComment = '';

  // Reject modal
  rejectTarget: MaterialReturn | null = null;
  rejectComment = '';

  actionLoading = false;
  actionError = '';

  readonly sourceOptions      = Object.entries(RETURN_SOURCE_LABELS).map(([v, l])      => ({ value: v as ReturnSource,      label: l }));
  readonly reasonOptions      = Object.entries(RETURN_REASON_LABELS).map(([v, l])      => ({ value: v as ReturnReason,      label: l }));
  readonly destinationOptions = Object.entries(RETURN_DESTINATION_LABELS).map(([v, l]) => ({ value: v as ReturnDestination, label: l }));

  ngOnInit(): void {
    forkJoin({
      pending: this.returnService.getPendingReturns().pipe(catchError(() => of([] as MaterialReturn[]))),
      all:     this.returnService.getAllTeamReturns().pipe(catchError(() => of([] as MaterialReturn[]))),
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: ({ pending, all }) => {
        this.pendingReturns = pending;
        this.allReturns = all;
      },
      error: () => {}
    });
  }

  get kpiCards(): KpiCard[] {
    const all = this.allReturns;
    const now = new Date();
    const thisMonth = (r: MaterialReturn) => {
      if (!r.reviewedAt) return false;
      const d = new Date(r.reviewedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    return [
      { label: 'Pending Returns',         value: this.pendingReturns.length,                                                color: '#F59E0B' },
      { label: 'Approved This Month',      value: all.filter(r => (r.status === 'APPROVED' || r.status === 'CLOSED') && thisMonth(r)).length, color: '#16A34A' },
      { label: 'Rejected This Month',      value: all.filter(r => r.status === 'REJECTED' && thisMonth(r)).length,           color: '#DC2626' },
      { label: 'Recovered (Résiliation)',  value: all.filter(r => r.reason === 'CLIENT_RESILIATION_RECOVERY').length,         color: '#2563EB' },
      { label: 'Damaged Items',            value: all.filter(r => r.reason === 'DAMAGED' || r.reason === 'BROKEN').length,    color: '#E30613' },
    ];
  }

  get filteredHistory(): MaterialReturn[] {
    return this.allReturns.filter(r => {
      if (this.filterStatus      && r.status      !== this.filterStatus)      return false;
      if (this.filterSource      && r.returnSource !== this.filterSource)      return false;
      if (this.filterReason      && r.reason       !== this.filterReason)      return false;
      if (this.filterDestination && r.destination  !== this.filterDestination) return false;
      if (this.filterStt && !(r.sttName ?? '').toLowerCase().includes(this.filterStt.toLowerCase())) return false;
      return true;
    });
  }

  totalQty(r: MaterialReturn): number {
    return r.items.reduce((s, i) => s + i.quantity, 0);
  }

  openDetail(r: MaterialReturn): void   { this.selectedReturn = r; }
  openApproveModal(r: MaterialReturn): void { this.approveTarget = r; this.approveComment = ''; this.actionError = ''; }
  openRejectModal(r: MaterialReturn): void  { this.rejectTarget  = r; this.rejectComment = '';  this.actionError = ''; }

  closeModals(): void       { this.selectedReturn = null; }
  closeActionModals(): void { this.approveTarget = null; this.rejectTarget = null; }

  confirmApprove(): void {
    if (!this.approveTarget) return;
    this.actionLoading = true;
    this.actionError = '';
    const body: ReviewMaterialReturnRequest = { reviewComment: this.approveComment || undefined };
    this.returnService.approveReturn(this.approveTarget.id, body).subscribe({
      next: (updated) => {
        this.replaceInLists(updated);
        this.actionLoading = false;
        this.closeActionModals();
      },
      error: (err) => {
        this.actionError = err?.error?.message ?? 'Failed to approve return.';
        this.actionLoading = false;
      },
    });
  }

  confirmReject(): void {
    if (!this.rejectTarget) return;
    if (!this.rejectComment.trim()) { this.actionError = 'Rejection comment is required.'; return; }
    this.actionLoading = true;
    this.actionError = '';
    const body: ReviewMaterialReturnRequest = { reviewComment: this.rejectComment };
    this.returnService.rejectReturn(this.rejectTarget.id, body).subscribe({
      next: (updated) => {
        this.replaceInLists(updated);
        this.actionLoading = false;
        this.closeActionModals();
      },
      error: (err) => {
        this.actionError = err?.error?.message ?? 'Failed to reject return.';
        this.actionLoading = false;
      },
    });
  }

  private replaceInLists(updated: MaterialReturn): void {
    this.pendingReturns = this.pendingReturns.filter(r => r.id !== updated.id);
    const idx = this.allReturns.findIndex(r => r.id === updated.id);
    if (idx >= 0) this.allReturns[idx] = updated;
    else this.allReturns = [updated, ...this.allReturns];
    if (this.selectedReturn?.id === updated.id) this.selectedReturn = updated;
  }

  // ── Label / class helpers ──────────────────────────────────────────────────

  sourceLabel(s: ReturnSource): string { return RETURN_SOURCE_LABELS[s] ?? s; }

  sourceChipClass(s: ReturnSource): string {
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

  reasonLabel(r: ReturnReason): string      { return RETURN_REASON_LABELS[r] ?? r; }
  conditionLabel(c: ReturnCondition): string { return RETURN_CONDITION_LABELS[c] ?? c; }
  destinationLabel(d: ReturnDestination): string { return RETURN_DESTINATION_LABELS[d] ?? d; }
  statusLabel(s: MaterialReturnStatus): string   { return RETURN_STATUS_LABELS[s] ?? s; }

  statusClass(s: MaterialReturnStatus): string {
    return 'badge badge-' + s.toLowerCase();
  }

  reasonClass(r: ReturnReason): string {
    const map: Partial<Record<ReturnReason, string>> = {
      DAMAGED: 'chip-reason-damaged',
      BROKEN: 'chip-reason-broken',
      CLIENT_RESILIATION_RECOVERY: 'chip-reason-resiliation',
      UNUSED: 'chip-reason-unused',
      WRONG_DISTRIBUTION: 'chip-reason-wrong',
    };
    return map[r] ?? 'chip-reason-default';
  }

  conditionChipClass(c: ReturnCondition): string {
    if (c === 'GOOD') return 'chip-cond-good';
    if (c === 'DAMAGED' || c === 'RECONDITIONABLE') return 'chip-cond-damage';
    if (c === 'BROKEN' || c === 'LOST') return 'chip-cond-broken';
    return 'chip-cond-default';
  }

  destinationChipClass(d: ReturnDestination): string {
    if (d === 'USABLE_STOCK') return 'chip-dest-usable';
    if (d === 'DAMAGED_STOCK') return 'chip-dest-damaged';
    if (d === 'REPAIR_CENTER') return 'chip-dest-repair';
    if (d === 'RECONDITIONING') return 'chip-dest-recon';
    if (d === 'SCRAP') return 'chip-dest-scrap';
    return 'chip-cond-default';
  }
}
