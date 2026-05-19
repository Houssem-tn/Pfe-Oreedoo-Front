import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { StockService } from '../../../../core/stock/stock.service';
import { Equipment, StockThreshold, StockThresholdRequest } from '../../../../core/stock/stock.model';

interface ThresholdRow {
  threshold?: StockThreshold;
  equipment: Equipment;
}

interface ThresholdDraft {
  warningThreshold: number;
  criticalThreshold: number;
  stockAlertEnabled: boolean;
  caseUsageLimit: number;
  caseUsageLimitEnabled: boolean;
}

@Component({
  selector: 'app-zm-stock-thresholds',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }

    /* ── Shell ─────────────────────────────────────────────────────────── */
    .sr-shell {
      --sr-red: #c0102a;
      --sr-red-light: rgba(192,16,42,.08);
      --sr-red-mid: rgba(192,16,42,.14);
      --sr-border: #e5e7eb;
      --sr-radius: 1rem;
      --sr-shadow: 0 4px 18px rgba(0,0,0,.07);
      --sr-text: #1a1a2e;
      --sr-muted: #6b7280;
      background: linear-gradient(160deg,#fff6f7 0%,#f9fafb 60%,#fff0f2 100%);
      border-radius: 1.5rem;
      display: grid;
      gap: 1.25rem;
      min-height: 100%;
      padding: 1.5rem;
    }

    /* ── Hero header ───────────────────────────────────────────────────── */
    .sr-hero {
      align-items: center;
      background: linear-gradient(135deg,#c0102a 0%,#8f0c20 55%,#6b091a 100%);
      border-radius: var(--sr-radius);
      box-shadow: 0 12px 32px rgba(192,16,42,.22);
      display: flex;
      gap: 1rem;
      justify-content: space-between;
      overflow: hidden;
      padding: 1.4rem 1.6rem;
      position: relative;
    }
    .sr-hero::before {
      background: radial-gradient(circle at 80% 30%,rgba(255,255,255,.12),transparent 55%);
      content: '';
      inset: 0;
      pointer-events: none;
      position: absolute;
    }
    .sr-hero__icon {
      align-items: center;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.22);
      border-radius: .85rem;
      color: #fff;
      display: inline-flex;
      flex: 0 0 auto;
      height: 3rem;
      justify-content: center;
      width: 3rem;
    }
    .sr-hero__icon svg { height: 1.3rem; width: 1.3rem; }
    .sr-hero__copy { flex: 1; min-width: 0; }
    .sr-hero__title {
      color: #fff;
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: -.02em;
    }
    .sr-hero__sub {
      color: rgba(255,255,255,.7);
      font-size: .85rem;
      margin-top: .15rem;
    }
    .sr-refresh-btn {
      align-items: center;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.22);
      border-radius: .7rem;
      color: rgba(255,255,255,.9);
      cursor: pointer;
      display: inline-flex;
      font-size: .85rem;
      font-weight: 700;
      gap: .4rem;
      padding: .5rem .95rem;
      transition: background .15s ease;
      white-space: nowrap;
    }
    .sr-refresh-btn svg { height: .9rem; width: .9rem; }
    .sr-refresh-btn:hover { background: rgba(255,255,255,.26); }

    /* ── KPI strip ─────────────────────────────────────────────────────── */
    .sr-kpis {
      display: grid;
      gap: .85rem;
      grid-template-columns: repeat(auto-fit,minmax(140px,1fr));
    }
    .sr-kpi {
      background: #fff;
      border: 1px solid var(--sr-border);
      border-radius: var(--sr-radius);
      box-shadow: var(--sr-shadow);
      padding: .95rem 1.1rem;
      text-align: center;
    }
    .sr-kpi__value {
      color: var(--sr-red);
      font-size: 1.7rem;
      font-weight: 900;
      line-height: 1;
    }
    .sr-kpi__label {
      color: var(--sr-muted);
      font-size: .75rem;
      font-weight: 700;
      letter-spacing: .05em;
      margin-top: .3rem;
      text-transform: uppercase;
    }
    .sr-kpi--green .sr-kpi__value { color: #15803d; }
    .sr-kpi--orange .sr-kpi__value { color: #d97706; }

    /* ── Alert banner ──────────────────────────────────────────────────── */
    .sr-alert {
      background: rgba(192,16,42,.07);
      border: 1px solid rgba(192,16,42,.18);
      border-radius: var(--sr-radius);
      color: #9f132b;
      font-size: .9rem;
      padding: .8rem 1rem;
    }

    /* ── Main card ─────────────────────────────────────────────────────── */
    .sr-card {
      background: #fff;
      border: 1px solid var(--sr-border);
      border-radius: var(--sr-radius);
      box-shadow: var(--sr-shadow);
      overflow: hidden;
    }

    /* ── Tabs ──────────────────────────────────────────────────────────── */
    .sr-tabs {
      border-bottom: 1px solid var(--sr-border);
      display: flex;
      gap: 0;
      padding: 0 1.1rem;
    }
    .sr-tab {
      align-items: center;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      color: var(--sr-muted);
      cursor: pointer;
      display: inline-flex;
      font-size: .88rem;
      font-weight: 700;
      gap: .45rem;
      margin-bottom: -1px;
      padding: .9rem .2rem;
      margin-right: 1.5rem;
      transition: color .15s ease, border-color .15s ease;
    }
    .sr-tab svg { height: .9rem; width: .9rem; }
    .sr-tab--active {
      border-bottom-color: var(--sr-red);
      color: var(--sr-red);
    }
    .sr-tab:hover:not(.sr-tab--active) { color: var(--sr-text); }

    /* ── Loading ───────────────────────────────────────────────────────── */
    .sr-loading {
      align-items: center;
      color: var(--sr-muted);
      display: flex;
      flex-direction: column;
      gap: .6rem;
      padding: 3rem;
      text-align: center;
    }
    .sr-spinner {
      animation: sr-spin .7s linear infinite;
      border: 3px solid var(--sr-red-light);
      border-radius: 50%;
      border-top-color: var(--sr-red);
      height: 2rem;
      width: 2rem;
    }
    @keyframes sr-spin { to { transform: rotate(360deg); } }

    /* ── Empty state ───────────────────────────────────────────────────── */
    .sr-empty {
      color: var(--sr-muted);
      font-size: .9rem;
      padding: 3rem;
      text-align: center;
    }

    /* ── Table ─────────────────────────────────────────────────────────── */
    .sr-table-wrap { overflow-x: auto; }
    table.sr-table {
      border-collapse: collapse;
      width: 100%;
    }
    table.sr-table th {
      background: #fafafa;
      border-bottom: 1.5px solid var(--sr-border);
      color: var(--sr-muted);
      font-size: .72rem;
      font-weight: 800;
      letter-spacing: .07em;
      padding: .75rem 1rem;
      text-align: left;
      text-transform: uppercase;
      white-space: nowrap;
    }
    table.sr-table td {
      border-bottom: 1px solid #f3f4f6;
      color: var(--sr-text);
      font-size: .875rem;
      padding: .8rem 1rem;
      vertical-align: middle;
    }
    table.sr-table tr:last-child td { border-bottom: none; }
    table.sr-table tr:hover td { background: #fdf9f9; }

    /* ── Item cell ─────────────────────────────────────────────────────── */
    .sr-item { display: flex; align-items: center; gap: .65rem; }
    .sr-item-img {
      border: 1px solid var(--sr-border);
      border-radius: .5rem;
      flex: 0 0 auto;
      height: 2.2rem;
      object-fit: cover;
      width: 2.2rem;
    }
    .sr-item-placeholder {
      align-items: center;
      background: var(--sr-red-light);
      border-radius: .5rem;
      color: var(--sr-red);
      display: inline-flex;
      flex: 0 0 auto;
      height: 2.2rem;
      justify-content: center;
      width: 2.2rem;
    }
    .sr-item-placeholder svg { height: .9rem; width: .9rem; }
    .sr-item-name { font-size: .875rem; font-weight: 700; }
    .sr-item-code {
      background: var(--sr-red-light);
      border-radius: .35rem;
      color: #8f0c20;
      font-family: ui-monospace,'Cascadia Code','Fira Code',monospace;
      font-size: .72rem;
      font-weight: 700;
      margin-top: .1rem;
      padding: .1rem .35rem;
    }

    /* ── Badges ────────────────────────────────────────────────────────── */
    .sr-badge {
      border-radius: 999px;
      font-size: .72rem;
      font-weight: 800;
      padding: .2rem .55rem;
    }
    .sr-badge--unit  { background: #f3f4f6; color: #374151; }
    .sr-badge--on    { background: rgba(21,128,61,.12); color: #15803d; }
    .sr-badge--off   { background: #f3f4f6; color: var(--sr-muted); }
    .sr-badge--none  { background: rgba(217,119,6,.1); color: #b45309; }
    .sr-badge--code  {
      background: var(--sr-red-light);
      color: #8f0c20;
      font-family: ui-monospace,'Cascadia Code',monospace;
    }

    /* ── Preview chip ──────────────────────────────────────────────────── */
    .sr-preview {
      color: var(--sr-muted);
      font-size: .78rem;
      font-style: italic;
    }

    /* ── Actions ───────────────────────────────────────────────────────── */
    .sr-configure-btn {
      align-items: center;
      background: none;
      border: 1.5px solid var(--sr-red-mid);
      border-radius: .6rem;
      color: var(--sr-red);
      cursor: pointer;
      display: inline-flex;
      font-size: .8rem;
      font-weight: 800;
      gap: .35rem;
      padding: .38rem .75rem;
      transition: background .14s ease, border-color .14s ease;
    }
    .sr-configure-btn svg { height: .8rem; width: .8rem; }
    .sr-configure-btn:hover {
      background: var(--sr-red-light);
      border-color: var(--sr-red);
    }

    /* ══════════════════════════════════════════════════════════════════════
       Configure Modal
       ══════════════════════════════════════════════════════════════════════ */
    .sr-modal-bd {
      align-items: center;
      background: rgba(10,0,5,.48);
      backdrop-filter: blur(8px);
      display: flex;
      inset: 0;
      justify-content: center;
      overflow-y: auto;
      padding: 1.5rem;
      position: fixed;
      z-index: 1060;
    }
    .sr-modal {
      background: #fff;
      border: 1px solid rgba(192,16,42,.12);
      border-radius: 1.5rem;
      box-shadow: 0 32px 80px rgba(192,16,42,.16), 0 4px 16px rgba(0,0,0,.08);
      display: grid;
      grid-template-rows: auto 1fr auto;
      max-width: 540px;
      overflow: hidden;
      width: 100%;
    }

    /* Modal header */
    .sr-modal-hd {
      align-items: flex-start;
      background: linear-gradient(135deg,#c0102a 0%,#8f0c20 50%,#6b091a 100%);
      display: flex;
      gap: 1rem;
      padding: 1.4rem 1.5rem 1.3rem;
      position: relative;
    }
    .sr-modal-hd::before {
      background: radial-gradient(circle at 80% 20%,rgba(255,255,255,.1),transparent 50%);
      content: '';
      inset: 0;
      pointer-events: none;
      position: absolute;
    }
    .sr-modal-hd__icon {
      align-items: center;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.22);
      border-radius: .85rem;
      color: #fff;
      display: inline-flex;
      flex: 0 0 auto;
      height: 2.8rem;
      justify-content: center;
      width: 2.8rem;
    }
    .sr-modal-hd__icon svg { height: 1.1rem; width: 1.1rem; }
    .sr-modal-hd__copy { flex: 1; min-width: 0; }
    .sr-modal-hd__eyebrow {
      color: rgba(255,255,255,.65);
      font-size: .7rem;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .sr-modal-hd__title {
      color: #fff;
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -.02em;
    }
    .sr-modal-hd__sub {
      color: rgba(255,255,255,.62);
      font-family: ui-monospace,'Cascadia Code',monospace;
      font-size: .76rem;
      margin-top: .15rem;
    }
    .sr-modal-close {
      align-items: center;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 999px;
      color: rgba(255,255,255,.85);
      cursor: pointer;
      display: inline-flex;
      flex: 0 0 auto;
      height: 2.1rem;
      justify-content: center;
      position: relative;
      transition: background .16s ease;
      width: 2.1rem;
    }
    .sr-modal-close svg { height: .9rem; width: .9rem; }
    .sr-modal-close:hover { background: rgba(255,255,255,.26); }

    /* Modal body */
    .sr-modal-body { display: grid; gap: 1.2rem; padding: 1.5rem; }

    /* Section cards inside modal */
    .sr-section {
      border: 1.5px solid var(--sr-border);
      border-radius: .9rem;
      overflow: hidden;
    }
    .sr-section-hd {
      align-items: center;
      background: #fafafa;
      border-bottom: 1px solid var(--sr-border);
      display: flex;
      gap: .5rem;
      padding: .7rem 1rem;
    }
    .sr-section-hd svg { color: var(--sr-red); height: .9rem; width: .9rem; }
    .sr-section-title { color: var(--sr-text); font-size: .82rem; font-weight: 800; }
    .sr-section-sub { color: var(--sr-muted); font-size: .74rem; margin-left: auto; }
    .sr-section-body { display: grid; gap: .9rem; padding: 1rem; }

    /* Toggle row */
    .sr-toggle-row {
      align-items: center;
      display: flex;
      gap: .75rem;
      justify-content: space-between;
    }
    .sr-toggle-label { color: var(--sr-text); font-size: .86rem; font-weight: 700; }
    .sr-toggle-desc { color: var(--sr-muted); font-size: .76rem; margin-top: .08rem; }
    .sr-toggle {
      cursor: pointer;
      height: 1.3rem;
      position: relative;
      width: 2.4rem;
    }
    .sr-toggle input { display: none; }
    .sr-toggle-track {
      background: #e5e7eb;
      border-radius: 999px;
      height: 100%;
      position: absolute;
      transition: background .2s ease;
      width: 100%;
    }
    .sr-toggle-thumb {
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,.2);
      height: 1rem;
      left: .15rem;
      position: absolute;
      top: .15rem;
      transition: left .2s ease;
      width: 1rem;
    }
    .sr-toggle input:checked ~ .sr-toggle-track { background: var(--sr-red); }
    .sr-toggle input:checked ~ .sr-toggle-thumb { left: 1.25rem; }

    /* Field row */
    .sr-field { display: grid; gap: .35rem; }
    .sr-label {
      color: #5a1a28;
      font-size: .75rem;
      font-weight: 800;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .sr-input-wrap { display: flex; align-items: center; gap: 0; }
    .sr-input {
      background: rgba(255,248,249,.9);
      border: 1.5px solid rgba(192,16,42,.14);
      border-radius: .75rem 0 0 .75rem;
      color: var(--sr-text);
      flex: 1;
      font-size: .93rem;
      min-height: 2.8rem;
      outline: none;
      padding: .6rem .9rem;
      transition: border-color .16s ease, box-shadow .16s ease;
    }
    .sr-input:focus {
      border-color: rgba(192,16,42,.38);
      box-shadow: 0 0 0 3px rgba(192,16,42,.09);
      z-index: 1;
    }
    .sr-input-unit {
      align-items: center;
      background: #f9fafb;
      border: 1.5px solid rgba(192,16,42,.14);
      border-left: none;
      border-radius: 0 .75rem .75rem 0;
      color: var(--sr-muted);
      display: inline-flex;
      font-size: .82rem;
      font-weight: 700;
      min-height: 2.8rem;
      padding: 0 .75rem;
      white-space: nowrap;
    }
    .sr-row-fields { display: grid; gap: .75rem; grid-template-columns: 1fr 1fr; }

    /* Preview text inside modal */
    .sr-modal-preview {
      background: var(--sr-red-light);
      border-left: 3px solid var(--sr-red);
      border-radius: 0 .5rem .5rem 0;
      color: #6b091a;
      font-size: .8rem;
      line-height: 1.5;
      padding: .55rem .75rem;
    }

    /* Disabled state */
    .sr-section--disabled .sr-section-body { opacity: .45; pointer-events: none; }

    /* Modal footer */
    .sr-modal-ft {
      align-items: center;
      background: #fafafa;
      border-top: 1px solid var(--sr-border);
      display: flex;
      gap: .75rem;
      justify-content: flex-end;
      padding: .9rem 1.5rem;
    }
    .sr-btn {
      align-items: center;
      border: 0;
      border-radius: .75rem;
      cursor: pointer;
      display: inline-flex;
      font-size: .9rem;
      font-weight: 800;
      gap: .4rem;
      min-height: 2.65rem;
      padding: .65rem 1.2rem;
      transition: transform .14s ease, box-shadow .14s ease, opacity .14s ease;
    }
    .sr-btn:disabled { cursor: not-allowed; opacity: .5; transform: none !important; }
    .sr-btn:not(:disabled):hover { transform: translateY(-1px); }
    .sr-btn--ghost {
      background: #fff;
      border: 1.5px solid var(--sr-border);
      color: #374151;
    }
    .sr-btn--ghost:hover { border-color: rgba(192,16,42,.3); }
    .sr-btn--primary {
      background: linear-gradient(135deg,#e5243b,#c0102a 55%,#8f0c20);
      box-shadow: 0 10px 24px rgba(192,16,42,.26);
      color: #fff;
    }
    .sr-btn--primary:not(:disabled):hover { box-shadow: 0 14px 32px rgba(192,16,42,.34); }
    .sr-btn-spinner {
      animation: sr-spin .7s linear infinite;
      border: 2px solid rgba(255,255,255,.35);
      border-radius: 50%;
      border-top-color: #fff;
      display: inline-block;
      height: .9rem;
      width: .9rem;
    }

    /* Validation error */
    .sr-form-err { color: #9f132b; font-size: .78rem; margin-top: .15rem; }

    @media (max-width:600px) {
      .sr-shell { border-radius: 1rem; padding: 1rem; }
      .sr-row-fields { grid-template-columns: 1fr; }
      .sr-kpis { grid-template-columns: repeat(2,1fr); }
    }
  `],
  template: `
<div class="sr-shell">

  <!-- ── Hero ─────────────────────────────────────────────────────────── -->
  <div class="sr-hero">
    <div class="sr-hero__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
    </div>
    <div class="sr-hero__copy">
      <div class="sr-hero__title">Stock Rules & Alerts</div>
      <div class="sr-hero__sub">Configure low-stock alerts and per-case usage limits for your teams.</div>
    </div>
    <button class="sr-refresh-btn" type="button" (click)="loadData()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
      Refresh
    </button>
  </div>

  <!-- ── KPI strip ──────────────────────────────────────────────────── -->
  <div class="sr-kpis">
    <div class="sr-kpi">
      <div class="sr-kpi__value">{{ total() }}</div>
      <div class="sr-kpi__label">Total Items</div>
    </div>
    <div class="sr-kpi sr-kpi--green">
      <div class="sr-kpi__value">{{ alertsOn() }}</div>
      <div class="sr-kpi__label">Alerts Active</div>
    </div>
    <div class="sr-kpi sr-kpi--orange">
      <div class="sr-kpi__value">{{ notConfigured() }}</div>
      <div class="sr-kpi__label">Not Configured</div>
    </div>
    <div class="sr-kpi sr-kpi--green">
      <div class="sr-kpi__value">{{ caseLimitsOn() }}</div>
      <div class="sr-kpi__label">Case Limits On</div>
    </div>
  </div>

  @if (error()) {
    <div class="sr-alert">{{ error() }}</div>
  }

  <!-- ── Main card ──────────────────────────────────────────────────── -->
  <div class="sr-card">

    <!-- Tabs -->
    <div class="sr-tabs">
      <button class="sr-tab" [class.sr-tab--active]="activeTab() === 'alerts'"
              type="button" (click)="activeTab.set('alerts')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 01-3.46 0"></path>
        </svg>
        Low Stock Alerts
      </button>
      <button class="sr-tab" [class.sr-tab--active]="activeTab() === 'limits'"
              type="button" (click)="activeTab.set('limits')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Case Usage Limits
      </button>
    </div>

    @if (loading()) {
      <div class="sr-loading">
        <div class="sr-spinner"></div>
        <span>Loading…</span>
      </div>
    } @else if (rows().length === 0) {
      <div class="sr-empty">No active equipment found. Add items in the Admin catalogue first.</div>
    } @else {

      <!-- ── Tab: Low Stock Alerts ──────────────────────────────────── -->
      @if (activeTab() === 'alerts') {
        <div class="sr-table-wrap">
          <table class="sr-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Article Code</th>
                <th>Unit</th>
                <th>Warning At</th>
                <th>Critical At</th>
                <th>Alert Status</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.equipment.id) {
                <tr>
                  <td>
                    <div class="sr-item">
                      @if (row.equipment.imageUrl) {
                        <img class="sr-item-img" [src]="row.equipment.imageUrl" alt="">
                      } @else {
                        <span class="sr-item-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        </span>
                      }
                      <div>
                        <div class="sr-item-name">{{ row.equipment.name }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    @if (row.equipment.articleCode) {
                      <span class="sr-badge sr-badge--code">{{ row.equipment.articleCode }}</span>
                    } @else {
                      <span style="color:#9ca3af">—</span>
                    }
                  </td>
                  <td><span class="sr-badge sr-badge--unit">{{ unitLabel(row.equipment) }}</span></td>
                  <td>
                    @if (row.threshold) {
                      ≤ {{ row.threshold.warningThreshold }} {{ unitLabel(row.equipment) }}
                    } @else {
                      <span style="color:#9ca3af;font-style:italic">Not set</span>
                    }
                  </td>
                  <td>
                    @if (row.threshold) {
                      ≤ {{ row.threshold.criticalThreshold }} {{ unitLabel(row.equipment) }}
                    } @else {
                      <span style="color:#9ca3af;font-style:italic">Not set</span>
                    }
                  </td>
                  <td>
                    @if (!row.threshold) {
                      <span class="sr-badge sr-badge--none">Not configured</span>
                    } @else if (row.threshold.enabled) {
                      <span class="sr-badge sr-badge--on">Enabled</span>
                    } @else {
                      <span class="sr-badge sr-badge--off">Disabled</span>
                    }
                  </td>
                  <td>
                    @if (row.threshold?.enabled) {
                      <span class="sr-preview">
                        Alert when ≤ {{ row.threshold!.warningThreshold }} {{ unitLabel(row.equipment) }}
                      </span>
                    } @else {
                      <span style="color:#9ca3af">—</span>
                    }
                  </td>
                  <td>
                    <button class="sr-configure-btn" type="button" (click)="openModal(row)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      {{ row.threshold ? 'Edit' : 'Configure' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ── Tab: Case Usage Limits ─────────────────────────────────── -->
      @if (activeTab() === 'limits') {
        <div class="sr-table-wrap">
          <table class="sr-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Article Code</th>
                <th>Unit</th>
                <th>Allowed per Case</th>
                <th>Permission Required When</th>
                <th>Limit Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.equipment.id) {
                <tr>
                  <td>
                    <div class="sr-item">
                      @if (row.equipment.imageUrl) {
                        <img class="sr-item-img" [src]="row.equipment.imageUrl" alt="">
                      } @else {
                        <span class="sr-item-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        </span>
                      }
                      <div>
                        <div class="sr-item-name">{{ row.equipment.name }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    @if (row.equipment.articleCode) {
                      <span class="sr-badge sr-badge--code">{{ row.equipment.articleCode }}</span>
                    } @else {
                      <span style="color:#9ca3af">—</span>
                    }
                  </td>
                  <td><span class="sr-badge sr-badge--unit">{{ unitLabel(row.equipment) }}</span></td>
                  <td>
                    @if (row.threshold?.caseUsageLimitEnabled && row.threshold?.caseUsageLimit != null) {
                      <strong>{{ row.threshold!.caseUsageLimit }} {{ unitLabel(row.equipment) }}</strong>
                    } @else if (row.threshold?.caseUsageLimitEnabled === false) {
                      <span style="color:#9ca3af;font-style:italic">No limit</span>
                    } @else {
                      <span style="color:#9ca3af;font-style:italic">Not configured</span>
                    }
                  </td>
                  <td>
                    @if (row.threshold?.caseUsageLimitEnabled && row.threshold?.caseUsageLimit != null) {
                      <span class="sr-preview">
                        &gt; {{ row.threshold!.caseUsageLimit }} {{ unitLabel(row.equipment) }}
                      </span>
                    } @else if (row.threshold && !row.threshold.caseUsageLimitEnabled) {
                      <span style="color:#15803d;font-size:.78rem">Never (limit off)</span>
                    } @else {
                      <span class="sr-preview" style="color:#b45309">Fallback default</span>
                    }
                  </td>
                  <td>
                    @if (!row.threshold) {
                      <span class="sr-badge sr-badge--none">Not configured</span>
                    } @else if (row.threshold.caseUsageLimitEnabled) {
                      <span class="sr-badge sr-badge--on">Enabled</span>
                    } @else {
                      <span class="sr-badge sr-badge--off">Disabled</span>
                    }
                  </td>
                  <td>
                    <button class="sr-configure-btn" type="button" (click)="openModal(row)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      {{ row.threshold ? 'Edit' : 'Configure' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

    }
  </div><!-- /sr-card -->

</div><!-- /sr-shell -->

<!-- ══════════════════════════════════════════════════════════════════════
     Configure Modal
     ══════════════════════════════════════════════════════════════════════ -->
@if (modalRow()) {
  <div class="sr-modal-bd" (click)="closeModal()">
    <div class="sr-modal" (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="sr-modal-hd">
        <div class="sr-modal-hd__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"></path>
          </svg>
        </div>
        <div class="sr-modal-hd__copy">
          <div class="sr-modal-hd__eyebrow">Stock Rules &amp; Alerts</div>
          <div class="sr-modal-hd__title">{{ modalRow()!.equipment.name }}</div>
          @if (modalRow()!.equipment.articleCode) {
            <div class="sr-modal-hd__sub">{{ modalRow()!.equipment.articleCode }} · {{ unitLabel(modalRow()!.equipment) }}</div>
          }
        </div>
        <button class="sr-modal-close" type="button" (click)="closeModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="sr-modal-body">

        <!-- Section 1: Low Stock Alerts -->
        <div class="sr-section">
          <div class="sr-section-hd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 01-3.46 0"></path>
            </svg>
            <span class="sr-section-title">Low Stock Alerts</span>
            <span class="sr-section-sub">Notify when stock drops below threshold</span>
          </div>
          <div class="sr-section-body">

            <!-- Alert enabled toggle -->
            <div class="sr-toggle-row">
              <div>
                <div class="sr-toggle-label">Enable low-stock alerts</div>
                <div class="sr-toggle-desc">Send alerts when stock falls to or below the warning level.</div>
              </div>
              <label class="sr-toggle">
                <input type="checkbox" [(ngModel)]="draft().stockAlertEnabled"
                       (ngModelChange)="patchDraft({ stockAlertEnabled: $event })" />
                <span class="sr-toggle-track"></span>
                <span class="sr-toggle-thumb"></span>
              </label>
            </div>

            <!-- Warning + Critical inputs -->
            <div class="sr-row-fields" [class.sr-section--disabled]="!draft().stockAlertEnabled">
              <div class="sr-field">
                <label class="sr-label">Warning threshold</label>
                <div class="sr-input-wrap">
                  <input class="sr-input" type="number" min="0"
                         [ngModel]="draft().warningThreshold"
                         (ngModelChange)="patchDraft({ warningThreshold: +$event })" />
                  <span class="sr-input-unit">{{ unitLabel(modalRow()!.equipment) }}</span>
                </div>
              </div>
              <div class="sr-field">
                <label class="sr-label">Critical threshold</label>
                <div class="sr-input-wrap">
                  <input class="sr-input" type="number" min="0"
                         [ngModel]="draft().criticalThreshold"
                         (ngModelChange)="patchDraft({ criticalThreshold: +$event })" />
                  <span class="sr-input-unit">{{ unitLabel(modalRow()!.equipment) }}</span>
                </div>
              </div>
            </div>

            @if (draft().stockAlertEnabled) {
              <div class="sr-modal-preview">
                Alert when stock ≤ {{ draft().warningThreshold }} {{ unitLabel(modalRow()!.equipment) }}
                · Critical when ≤ {{ draft().criticalThreshold }} {{ unitLabel(modalRow()!.equipment) }}
              </div>
            }
            @if (validationErr()) {
              <div class="sr-form-err">{{ validationErr() }}</div>
            }
          </div>
        </div>

        <!-- Section 2: Case Usage Permission -->
        <div class="sr-section">
          <div class="sr-section-hd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0110 0v4"></path>
            </svg>
            <span class="sr-section-title">Case Usage Permission</span>
            <span class="sr-section-sub">STT approval above this limit</span>
          </div>
          <div class="sr-section-body">

            <!-- Limit enabled toggle -->
            <div class="sr-toggle-row">
              <div>
                <div class="sr-toggle-label">Enable per-case usage limit</div>
                <div class="sr-toggle-desc">TECH must request STT approval to exceed this quantity in one case.</div>
              </div>
              <label class="sr-toggle">
                <input type="checkbox" [(ngModel)]="draft().caseUsageLimitEnabled"
                       (ngModelChange)="patchDraft({ caseUsageLimitEnabled: $event })" />
                <span class="sr-toggle-track"></span>
                <span class="sr-toggle-thumb"></span>
              </label>
            </div>

            <!-- Limit value input -->
            <div [class.sr-section--disabled]="!draft().caseUsageLimitEnabled">
              <div class="sr-field">
                <label class="sr-label">Maximum allowed per case</label>
                <div class="sr-input-wrap">
                  <input class="sr-input" type="number" min="0"
                         [ngModel]="draft().caseUsageLimit"
                         (ngModelChange)="patchDraft({ caseUsageLimit: +$event })" />
                  <span class="sr-input-unit">{{ unitLabel(modalRow()!.equipment) }}</span>
                </div>
              </div>
            </div>

            @if (draft().caseUsageLimitEnabled) {
              <div class="sr-modal-preview">
                TECH can use up to <strong>{{ draft().caseUsageLimit }} {{ unitLabel(modalRow()!.equipment) }}</strong>
                per case without permission.
                Above this amount, STT approval is required.
              </div>
            } @else {
              <div class="sr-modal-preview" style="border-left-color:#6b7280;background:#f9fafb;color:#6b7280">
                Usage limit is disabled — TECH can use any quantity of this item without permission.
                Stock availability is still enforced.
              </div>
            }
          </div>
        </div>

      </div><!-- /modal-body -->

      <!-- Footer -->
      <div class="sr-modal-ft">
        <button class="sr-btn sr-btn--ghost" type="button" (click)="closeModal()">
          Cancel
        </button>
        <button class="sr-btn sr-btn--primary" type="button"
                [disabled]="saving()" (click)="save()">
          @if (saving()) {
            <span class="sr-btn-spinner"></span>
          }
          Save Rules
        </button>
      </div>

    </div><!-- /sr-modal -->
  </div><!-- /sr-modal-bd -->
}
  `
})
export class ZmStockThresholdsComponent implements OnInit {
  private readonly stockSvc = inject(StockService);

  readonly loading   = signal(true);
  readonly error     = signal<string | null>(null);
  readonly rows      = signal<ThresholdRow[]>([]);
  readonly activeTab = signal<'alerts' | 'limits'>('alerts');
  readonly saving    = signal(false);
  readonly modalRow  = signal<ThresholdRow | null>(null);
  readonly draft     = signal<ThresholdDraft>(this.emptyDraft());
  readonly validationErr = signal<string | null>(null);

  // ── Computed KPIs ──────────────────────────────────────────────────────────
  readonly total         = computed(() => this.rows().length);
  readonly alertsOn      = computed(() => this.rows().filter(r => r.threshold?.enabled).length);
  readonly notConfigured = computed(() => this.rows().filter(r => !r.threshold).length);
  readonly caseLimitsOn  = computed(() => this.rows().filter(r => r.threshold?.caseUsageLimitEnabled).length);

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        equipment:  this.stockSvc.getEquipment(),
        thresholds: this.stockSvc.getMyThresholds()
      }).subscribe({
        next: ({ equipment, thresholds }) => {
          const map = new Map(thresholds.map(t => [t.itemId, t]));
          const built: ThresholdRow[] = equipment
            .filter(e => e.active)
            .map(e => ({ equipment: e, threshold: map.get(e.id) }));
          this.rows.set(built);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load data. Please try again.');
          this.loading.set(false);
        }
      });
    });
  }

  openModal(row: ThresholdRow): void {
    this.validationErr.set(null);
    const t = row.threshold;
    this.draft.set({
      warningThreshold:     t?.warningThreshold    ?? 5,
      criticalThreshold:    t?.criticalThreshold   ?? 0,
      stockAlertEnabled:    t?.enabled             ?? true,
      caseUsageLimit:       t?.caseUsageLimit       ?? 1,
      caseUsageLimitEnabled: t?.caseUsageLimitEnabled ?? false
    });
    this.modalRow.set(row);
  }

  closeModal(): void {
    this.modalRow.set(null);
    this.validationErr.set(null);
  }

  /** Immutably patches the draft signal with the given partial. */
  patchDraft(patch: Partial<ThresholdDraft>): void {
    this.draft.update(d => ({ ...d, ...patch }));
  }

  save(): void {
    const row = this.modalRow();
    if (!row) return;

    const d = this.draft();
    this.validationErr.set(null);

    if (d.stockAlertEnabled && d.warningThreshold < d.criticalThreshold) {
      this.validationErr.set('Warning threshold must be ≥ critical threshold.');
      return;
    }
    if (d.caseUsageLimitEnabled && d.caseUsageLimit < 0) {
      this.validationErr.set('Case usage limit must be ≥ 0.');
      return;
    }

    const payload: StockThresholdRequest = {
      itemId:               row.equipment.id,
      itemName:             row.equipment.name,
      itemType:             row.equipment.category === 'CABLE' ? 'CABLE' : 'EQUIPMENT',
      warningThreshold:     d.warningThreshold,
      criticalThreshold:    d.criticalThreshold,
      unit:                 row.equipment.unit === 'METERS' ? 'METER' : 'PIECE',
      enabled:              d.stockAlertEnabled,
      caseUsageLimit:       d.caseUsageLimitEnabled ? d.caseUsageLimit : undefined,
      caseUsageLimitEnabled: d.caseUsageLimitEnabled
    };

    this.saving.set(true);
    const req$ = row.threshold
      ? this.stockSvc.updateThreshold(row.threshold.id, payload)
      : this.stockSvc.upsertThreshold(payload);

    req$.subscribe({
      next: (saved) => {
        this.rows.update(rs =>
          rs.map(r => r.equipment.id === row.equipment.id
            ? { ...r, threshold: saved }
            : r)
        );
        this.saving.set(false);
        this.closeModal();
      },
      error: (err) => {
        this.validationErr.set(err?.error?.message ?? 'Failed to save. Please try again.');
        this.saving.set(false);
      }
    });
  }

  unitLabel(equipment: Equipment): string {
    return equipment.unit === 'METERS' ? 'm' : 'pcs';
  }

  private emptyDraft(): ThresholdDraft {
    return { warningThreshold: 5, criticalThreshold: 0, stockAlertEnabled: true, caseUsageLimit: 1, caseUsageLimitEnabled: false };
  }
}
