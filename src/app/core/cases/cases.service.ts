import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import {
  AssignTechRequest,
  AssignSttRequest,
  CaseResponse,
  CompleteWorkRequest,
  CreateCaseRequest,
  CreateActivationCaseRequest,
  PerformanceSummaryResponse,
  SetRdvRequest,
  ValidateZmRequest
} from './models/case.model';

@Injectable({ providedIn: 'root' })
export class CasesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly casesUrl = `${this.baseUrl}/api/v1/cases`;

  getActivationCases(): Observable<CaseResponse[]> {
    return this.http.get<CaseResponse[]>(`${this.casesUrl}?type=ACTIVATION`);
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

  getMyPerformance(): Observable<PerformanceSummaryResponse> {
    return this.http.get<PerformanceSummaryResponse>(`${this.casesUrl}/analytics/my-performance`);
  }

  getTechPerformance(): Observable<PerformanceSummaryResponse[]> {
    return this.http.get<PerformanceSummaryResponse[]>(`${this.casesUrl}/analytics/tech-performance`);
  }
}
