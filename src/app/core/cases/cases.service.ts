import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import {
  AssignTechRequest,
  AssignSttRequest,
  CaseResponse,
  CaseType,
  ComplaintImportResponse,
  ComplaintDiagnosisRequest,
  CompleteWorkRequest,
  CreateCaseRequest,
  CreateActivationCaseRequest,
  DeclareClientRecoveryRequest,
  PerformanceSummaryResponse,
  ReopenComplaintRequest,
  SetRdvRequest,
  ValidateZmRequest
} from './models/case.model';

export interface CaseBoardQuery {
  type: CaseType;
  caseModule?: 'PLT' | 'RES';
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  gouvernorat?: string;
  delegation?: string;
}

export interface CasePageResponse {
  items: CaseResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface CaseBoardSummaryResponse {
  totalCases: number;
  ownedByZm: number;
  assignedStt: number;
  assignedTech: number;
  slaWarning: number;
  slaBreached: number;
  workDone: number;
  closed: number;
  governorates: string[];
  delegations: string[];
}

@Injectable({ providedIn: 'root' })
export class CasesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly casesUrl = `${this.baseUrl}/api/v1/cases`;
  private readonly plaintesUrl = `${this.baseUrl}/api/v1/plaintes`;

  getCasesByType(type: CaseType, caseModule?: 'PLT' | 'RES'): Observable<CaseResponse[]> {
    const url = caseModule
      ? `${this.casesUrl}?type=${type}&caseModule=${caseModule}`
      : `${this.casesUrl}?type=${type}`;
    return this.http.get<CaseResponse[]>(url);
  }

  getCasesPage(params: CaseBoardQuery): Observable<CasePageResponse> {
    return this.http.get<CasePageResponse>(`${this.casesUrl}/page${this.boardQuery(params, true)}`);
  }

  getCasesSummary(params: CaseBoardQuery): Observable<CaseBoardSummaryResponse> {
    return this.http.get<CaseBoardSummaryResponse>(`${this.casesUrl}/summary${this.boardQuery(params, false)}`);
  }

  private boardQuery(params: CaseBoardQuery, withPaging: boolean): string {
    const q = new URLSearchParams();
    q.set('type', params.type);
    if (params.caseModule) q.set('caseModule', params.caseModule);
    if (withPaging) {
      q.set('page', String(params.page ?? 0));
      q.set('size', String(params.size ?? 10));
    }
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.status?.trim()) q.set('status', params.status.trim());
    if (params.gouvernorat?.trim()) q.set('gouvernorat', params.gouvernorat.trim());
    if (params.delegation?.trim()) q.set('delegation', params.delegation.trim());
    return `?${q.toString()}`;
  }

  getActivationCases(): Observable<CaseResponse[]> {
    return this.getCasesByType('ACTIVATION');
  }

  /** Complaint board: PLAINTE cases excluding the RES module (which has its own board). */
  getComplaintCases(): Observable<CaseResponse[]> {
    return this.getCasesByType('PLAINTE', 'PLT');
  }

  /** Resiliation board: only RES-module PLAINTE cases. */
  getResiliationCases(): Observable<CaseResponse[]> {
    return this.getCasesByType('PLAINTE', 'RES');
  }

  importComplaintCsv(file: File): Observable<ComplaintImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ComplaintImportResponse>(`${this.plaintesUrl}/import`, formData);
  }

  getOperationalCases(types: CaseType[] = ['ACTIVATION', 'PLAINTE']): Observable<CaseResponse[]> {
    return forkJoin(types.map((type) => this.getCasesByType(type))).pipe(
      map((responses) => responses.flat())
    );
  }

  getCaseById(id: string): Observable<CaseResponse> {
    return this.http.get<CaseResponse>(`${this.casesUrl}/${id}`);
  }

  downloadCasePdf(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.casesUrl}/${id}/pdf`, {
      observe: 'response',
      responseType: 'blob'
    });
  }

  createCase(payload: CreateCaseRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(this.casesUrl, payload);
  }

  createActivationCase(payload: CreateActivationCaseRequest): Observable<CaseResponse> {
    return this.createCase({
      type: 'ACTIVATION',
      ...payload
    });
  }

  assignStt(caseId: string, stt: string | AssignSttRequest): Observable<CaseResponse> {
    const payload = typeof stt === 'string' ? { sttId: stt } : { sttId: stt.sttId };
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/assign-stt`, payload);
  }

  assignTech(caseId: string, tech: string | AssignTechRequest): Observable<CaseResponse> {
    const payload = typeof tech === 'string' ? { techId: tech } : { techId: tech.techId };
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/assign-tech`, payload);
  }

  executeMyself(caseId: string): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/execute-myself`, {});
  }

  setRdv(caseId: string, payload: SetRdvRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/rdv`, payload);
  }

  completeWork(caseId: string, payload: CompleteWorkRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/work`, payload);
  }

  /** RES only: declare equipment recovered from the client; the backend links it to a material return. */
  declareClientRecovery(caseId: string, payload: DeclareClientRecoveryRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/res-recovery`, payload);
  }

  diagnoseComplaint(caseId: string, payload: ComplaintDiagnosisRequest): Observable<CaseResponse> {
    return this.http.post(`${this.plaintesUrl}/${caseId}/diagnosis`, payload).pipe(
      switchMap(() => this.getCaseById(caseId))
    );
  }

  reopenComplaint(caseId: string, payload: ReopenComplaintRequest): Observable<CaseResponse> {
    return this.http.post(`${this.plaintesUrl}/${caseId}/reopen`, payload).pipe(
      switchMap(() => this.getCaseById(caseId))
    );
  }

  uploadWorkProof(
    caseId: string,
    file: File,
    options?: {
      locationLatitude?: number | null;
      locationLongitude?: number | null;
      locationCapturedAt?: string | null;
      locationAccuracyMeters?: number | null;
      captureSource?: string | null;
    }
  ): Observable<CaseResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    if (options?.locationLatitude != null) {
      formData.append('latitude', String(options.locationLatitude));
    }

    if (options?.locationLongitude != null) {
      formData.append('longitude', String(options.locationLongitude));
    }

    if (options?.locationCapturedAt) {
      formData.append('locationCapturedAt', options.locationCapturedAt);
    }

    if (options?.locationAccuracyMeters != null) {
      formData.append('locationAccuracyMeters', String(options.locationAccuracyMeters));
    }

    if (options?.captureSource?.trim()) {
      formData.append('captureSource', options.captureSource.trim());
    }

    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/work-proof`, formData);
  }

  submitWork(caseId: string, payload: CompleteWorkRequest): Observable<CaseResponse> {
    return this.completeWork(caseId, payload);
  }

  validateZm(caseId: string, payload: ValidateZmRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/validate-zm`, payload);
  }

  closeCase(caseId: string): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.casesUrl}/${caseId}/close`, {});
  }

  getMyPerformance(type?: CaseType, caseModule?: 'PLT' | 'RES'): Observable<PerformanceSummaryResponse> {
    return this.http.get<PerformanceSummaryResponse>(
      `${this.casesUrl}/analytics/my-performance${this.performanceQuery(type, caseModule)}`
    );
  }

  getTechPerformance(type?: CaseType, caseModule?: 'PLT' | 'RES'): Observable<PerformanceSummaryResponse[]> {
    return this.http.get<PerformanceSummaryResponse[]>(
      `${this.casesUrl}/analytics/tech-performance${this.performanceQuery(type, caseModule)}`
    );
  }

  private performanceQuery(type?: CaseType, caseModule?: 'PLT' | 'RES'): string {
    const params: string[] = [];
    if (type) params.push(`type=${type}`);
    if (caseModule) params.push(`caseModule=${caseModule}`);
    return params.length ? `?${params.join('&')}` : '';
  }
}
