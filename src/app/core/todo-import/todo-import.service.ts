import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';

export interface ImportedTodoPreviewRow {
  rowNumber: number;
  crmCase?: string | null;
  fxDateCrm?: string | null;
  contact1?: string | null;
  contact2?: string | null;
  msisdn?: string | null;
  gouvernorat?: string | null;
  description?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  openDateSurTimos?: string | null;
  dateAffectationStt?: string | null;
  stt?: string | null;
  statut?: string | null;
  zoneManager?: string | null;
  issues: string[];
  readyToInject: boolean;
}

export interface TodoImportPreviewResponse {
  sourceFileName: string;
  managerFilterUsed: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  invalidRows: number;
  duplicateRows: number;
  readyRows: number;
  previewRows: ImportedTodoPreviewRow[];
}

export interface TodoImportInjectResponse {
  importBatchId: string;
  sourceFileName: string;
  managerFilterUsed: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  invalidRows: number;
  duplicateRows: number;
  savedRows: number;
}

export interface ImportedTodoListItem {
  id: string;
  importBatchId?: string | null;
  sourceFileName?: string | null;
  managerFilterUsed?: string | null;
  rowNumber?: number | null;
  validRow?: boolean | null;
  validationIssues?: string[] | null;
  crmCase?: string | null;
  fxDateCrm?: string | null;
  gouvernorat?: string | null;
  description?: string | null;
  stt?: string | null;
  statut?: string | null;
  zoneManager?: string | null;
  uploadedAt?: string | null;
}

export interface ImportedTodoPageResponse {
  items: ImportedTodoListItem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ZmTodoAnalyticsAlert {
  severity: string;
  title: string;
  message: string;
}

export interface ZmTodoAnalyticsSttItem {
  sttName?: string | null;
  caseCount: number;
  percentage: number;
  averageSlaBusinessDays?: number | null;
  delayedCases: number;
  delayedRate: number;
  geleCases: number;
  geleRate: number;
}

export interface ZmTodoAnalyticsGovernorateItem {
  gouvernorat?: string | null;
  caseCount: number;
  percentage: number;
  averageSlaBusinessDays?: number | null;
  delayedCases: number;
  delayedRate: number;
  geleCases: number;
  geleRate: number;
  topSttName?: string | null;
  topSttCaseCount: number;
}

export interface ZmTodoAnalyticsInvalidReason {
  reason: string;
  count: number;
  crmCases: string[];
}

export interface ZmTodoAnalyticsResponse {
  sourceFileName: string;
  connectedZmName: string;
  managerNameUsed: string;
  totalRows: number;
  matchedRows: number;
  ignoredRows: number;
  validMatchedRows: number;
  invalidMatchedRows: number;
  totalCases: number;
  rowsWithSla: number;
  averageSlaBusinessDays?: number | null;
  delayedCases: number;
  delayedRate: number;
  geleCases: number;
  geleRate: number;
  distinctSttCount: number;
  distinctGovernorateCount: number;
  topSttName?: string | null;
  topSttCaseCount: number;
  topSttPercentage?: number | null;
  bestGovernorateName?: string | null;
  bestGovernorateAverageSla?: number | null;
  worstGovernorateName?: string | null;
  worstGovernorateAverageSla?: number | null;
  alerts: ZmTodoAnalyticsAlert[];
  insights: string[];
  sttBreakdown: ZmTodoAnalyticsSttItem[];
  governorateBreakdown: ZmTodoAnalyticsGovernorateItem[];
  invalidReasonSummaries: ZmTodoAnalyticsInvalidReason[];
}

export interface ZmTodoImportProcessResponse {
  analysisId: string;
  sourceFileName: string;
  uploadedAt: string;
  importBatchId: string;
  totalRows: number;
  matchedRows: number;
  ignoredRows: number;
  validMatchedRows: number;
  invalidMatchedRows: number;
  savedRows: number;
}

export interface ZmTodoAnalysisListItem {
  id: string;
  sourceFileName: string;
  uploadedAt: string;
  importBatchId: string;
  connectedZmName: string;
  totalCases: number;
  matchedRows: number;
  invalidMatchedRows: number;
  averageSlaBusinessDays?: number | null;
}

export interface ZmTodoAnalysisDetailResponse {
  id: string;
  sourceFileName: string;
  uploadedAt: string;
  importBatchId: string;
  analytics: ZmTodoAnalyticsResponse;
}

export interface ImportedTodoListQuery {
  page?: number;
  size?: number;
  search?: string;
  statut?: string;
  rowQuality?: string;
  gouvernorat?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
}

@Injectable({ providedIn: 'root' })
export class TodoImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly importUrl = `${this.baseUrl}/api/v1/zm/todo-imports`;

  preview(file: File, managerFilter: string): Observable<TodoImportPreviewResponse> {
    const formData = this.buildPayload(file, managerFilter);
    return this.http.post<TodoImportPreviewResponse>(`${this.importUrl}/preview`, formData);
  }

  analyze(file: File): Observable<ZmTodoAnalyticsResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ZmTodoAnalyticsResponse>(`${this.importUrl}/analyze`, formData);
  }

  process(file: File): Observable<ZmTodoImportProcessResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ZmTodoImportProcessResponse>(`${this.importUrl}/process`, formData);
  }

  inject(file: File, managerFilter: string): Observable<TodoImportInjectResponse> {
    const formData = this.buildPayload(file, managerFilter);
    return this.http.post<TodoImportInjectResponse>(`${this.importUrl}/inject`, formData);
  }

  listSavedAnalyses(): Observable<ZmTodoAnalysisListItem[]> {
    return this.http.get<ZmTodoAnalysisListItem[]>(`${this.importUrl}/analyses`);
  }

  getSavedAnalysis(analysisId: string): Observable<ZmTodoAnalysisDetailResponse> {
    return this.http.get<ZmTodoAnalysisDetailResponse>(`${this.importUrl}/analyses/${analysisId}`);
  }

  list(query: ImportedTodoListQuery): Observable<ImportedTodoPageResponse> {
    const params = new URLSearchParams();

    if (query.page != null) {
      params.set('page', String(query.page));
    }

    if (query.size != null) {
      params.set('size', String(query.size));
    }

    if (query.search?.trim()) {
      params.set('search', query.search.trim());
    }

    if (query.statut?.trim()) {
      params.set('statut', query.statut.trim());
    }

    if (query.rowQuality?.trim()) {
      params.set('rowQuality', query.rowQuality.trim());
    }

    if (query.gouvernorat?.trim()) {
      params.set('gouvernorat', query.gouvernorat.trim());
    }

    if (query.uploadedFrom?.trim()) {
      params.set('uploadedFrom', query.uploadedFrom.trim());
    }

    if (query.uploadedTo?.trim()) {
      params.set('uploadedTo', query.uploadedTo.trim());
    }

    const queryString = params.toString();
    const url = queryString ? `${this.importUrl}?${queryString}` : this.importUrl;
    return this.http.get<ImportedTodoPageResponse>(url);
  }

  private buildPayload(file: File, managerFilter: string): FormData {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('managerFilter', managerFilter.trim());
    return formData;
  }
}
