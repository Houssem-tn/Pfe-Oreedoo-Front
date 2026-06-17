import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import {
  InterventionAuditFilters,
  InterventionAuditPage,
  InterventionAuditSummary
} from './intervention-audit.model';

@Injectable({ providedIn: 'root' })
export class InterventionAuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/admin/intervention-audits`;

  getAudits(filters: InterventionAuditFilters = {}): Observable<InterventionAuditPage> {
    let params = new HttpParams();
    if (filters.search)      params = params.set('search', filters.search);
    if (filters.module)      params = params.set('module', filters.module);
    if (filters.status)      params = params.set('status', filters.status);
    if (filters.eventType)   params = params.set('eventType', filters.eventType);
    if (filters.slaStatus)   params = params.set('slaStatus', filters.slaStatus);
    if (filters.proofStatus) params = params.set('proofStatus', filters.proofStatus);
    if (filters.governorate) params = params.set('governorate', filters.governorate);
    if (filters.technician)  params = params.set('technician', filters.technician);
    if (filters.from)        params = params.set('from', filters.from);
    if (filters.to)          params = params.set('to', filters.to);
    if (filters.sort)        params = params.set('sort', filters.sort);
    params = params.set('page', String(filters.page ?? 0));
    params = params.set('size', String(filters.size ?? 25));
    return this.http.get<InterventionAuditPage>(this.url, { params });
  }

  getSummary(): Observable<InterventionAuditSummary> {
    return this.http.get<InterventionAuditSummary>(`${this.url}/summary`);
  }
}
