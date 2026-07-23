import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import {
  ConfirmCollectionRequest,
  ConfirmCollectionResponse,
  RetrievedStockItem,
  TechnicianRetrievedStockGroup,
} from './retrieved-stock.model';

@Injectable({ providedIn: 'root' })
export class RetrievedStockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly base = `${this.baseUrl}/api/v1/stock/retrieved-stock`;

  // ── Technician ─────────────────────────────────────────────────────────────

  /** Technician's own pending bucket ("Retrieved Stock — Pending STT Collection"). */
  getMyRetrievedStock(): Observable<RetrievedStockItem[]> {
    return this.http.get<RetrievedStockItem[]>(`${this.base}/tech/mine`);
  }

  /** Second-phase proof photo upload for an already-declared item (owner-only). */
  uploadRetrievalProof(itemId: string, file: File): Observable<RetrievedStockItem> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<RetrievedStockItem>(`${this.base}/${encodeURIComponent(itemId)}/proof`, formData);
  }

  // ── STT (the responsible collector) ─────────────────────────────────────────

  /** STT's pending-collection queue, grouped by technician (only their own technicians' items). */
  getSttPendingCollection(): Observable<TechnicianRetrievedStockGroup[]> {
    return this.http.get<TechnicianRetrievedStockGroup[]>(`${this.base}/stt/pending`);
  }

  /** STT Collected Stock — physically collected, not distributable, awaiting Material Return. */
  getSttCollectedStock(): Observable<RetrievedStockItem[]> {
    return this.http.get<RetrievedStockItem[]>(`${this.base}/stt/collected`);
  }

  /** Collected items eligible to be added to a Material Return Request. */
  getSttReturnEligible(): Observable<RetrievedStockItem[]> {
    return this.http.get<RetrievedStockItem[]>(`${this.base}/stt/return-eligible`);
  }

  /** The one atomic multi-select action: STT confirms physical collection of one or more items. */
  confirmCollection(payload: ConfirmCollectionRequest): Observable<ConfirmCollectionResponse> {
    return this.http.post<ConfirmCollectionResponse>(`${this.base}/stt/confirm-collection`, payload);
  }

  // ── ZM (read-only tracking — no collection action) ──────────────────────────

  /** ZM read-only tracking of retrieved & collected stock across their territory. */
  getZmTracking(): Observable<RetrievedStockItem[]> {
    return this.http.get<RetrievedStockItem[]>(`${this.base}/zm/tracking`);
  }

  // ── Shared ─────────────────────────────────────────────────────────────────

  getByCase(caseId: string): Observable<RetrievedStockItem[]> {
    return this.http.get<RetrievedStockItem[]>(`${this.base}/case/${encodeURIComponent(caseId)}`);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  getAllAudit(): Observable<RetrievedStockItem[]> {
    return this.http.get<RetrievedStockItem[]>(`${this.base}/admin/all`);
  }
}
