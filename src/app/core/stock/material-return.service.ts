import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import {
  CreateMaterialReturnRequest,
  EligibleZmOption,
  MarkHandedOverRequest,
  MaterialReturn,
  ProposeHandoverRequest,
  ReviewMaterialReturnRequest,
  ScheduleResponseRequest,
} from './material-return.model';

@Injectable({ providedIn: 'root' })
export class MaterialReturnService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly base = `${this.baseUrl}/api/v1/stock/returns`;

  getEligibleZms(): Observable<EligibleZmOption[]> {
    return this.http.get<EligibleZmOption[]>(`${this.base}/eligible-zms`);
  }

  createReturn(payload: CreateMaterialReturnRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(this.base, payload);
  }

  getSttReturns(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/stt/my-returns`);
  }

  getMyReturns(): Observable<MaterialReturn[]> {
    return this.getSttReturns();
  }

  acceptSchedule(id: string, comment?: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}/schedule/accept`, {
      accepted: true,
      comment: comment || undefined,
    });
  }

  requestReschedule(id: string, comment: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}/schedule/reject`, {
      accepted: false,
      comment,
    });
  }

  scheduleResponse(id: string, body: ScheduleResponseRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}/schedule-response`, body);
  }

  getZmPendingReturns(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/zm/pending`);
  }

  getPendingReturns(): Observable<MaterialReturn[]> {
    return this.getZmPendingReturns();
  }

  getZmReturns(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/zm/my-returns`);
  }

  getAllTeamReturns(): Observable<MaterialReturn[]> {
    return this.getZmReturns();
  }

  proposeSchedule(id: string, body: ProposeHandoverRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}/propose-handover`, body);
  }

  proposeHandover(id: string, body: ProposeHandoverRequest): Observable<MaterialReturn> {
    return this.proposeSchedule(id, body);
  }

  rejectReturn(id: string, body: ReviewMaterialReturnRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}/reject`, body);
  }

  markHandedOver(id: string, body: MarkHandedOverRequest = {}): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}/mark-handed-over`, body);
  }

  getReturnById(id: string): Observable<MaterialReturn> {
    return this.http.get<MaterialReturn>(`${this.base}/${encodeURIComponent(id)}`);
  }

  getById(id: string): Observable<MaterialReturn> {
    return this.getReturnById(id);
  }

  getByCase(caseId: string): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/case/${encodeURIComponent(caseId)}`);
  }

  getAllAudit(): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/audit`);
  }
}
