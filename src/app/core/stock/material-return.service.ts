import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import {
  MaterialReturn,
  CreateMaterialReturnRequest,
  ReviewMaterialReturnRequest,
} from './material-return.model';

@Injectable({ providedIn: 'root' })
export class MaterialReturnService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly base = `${this.baseUrl}/api/v1/stock/returns`;

  // ── STT ──────────────────────────────────────────────────────────────────────

  createReturn(payload: CreateMaterialReturnRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(this.base, payload);
  }

  getMyReturns(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/my`);
  }

  // ── ZM ───────────────────────────────────────────────────────────────────────

  getPendingReturns(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/pending`);
  }

  getAllTeamReturns(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/team`);
  }

  approveReturn(id: string, body?: ReviewMaterialReturnRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${id}/approve`, body ?? {});
  }

  rejectReturn(id: string, body: ReviewMaterialReturnRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${id}/reject`, body);
  }

  // ── Shared ───────────────────────────────────────────────────────────────────

  getById(id: string): Observable<MaterialReturn> {
    return this.http.get<MaterialReturn>(`${this.base}/${id}`);
  }

  getByCase(caseId: string): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/case/${caseId}`);
  }

  getAllAudit(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/audit`);
  }
}
