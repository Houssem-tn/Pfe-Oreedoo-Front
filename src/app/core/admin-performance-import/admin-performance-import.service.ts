import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';

export interface AdminPerformanceImportPreviewRow {
  rowNumber: number;
  crmCase?: string | null;
  zoneManager?: string | null;
  gouvernorat?: string | null;
  stt?: string | null;
  statut?: string | null;
  openDateSurTimos?: string | null;
  dateAffectationStt?: string | null;
  slaBusinessDays?: number | null;
  issues: string[];
  validRow: boolean;
}

export interface AdminPerformanceImportPreviewResponse {
  sourceFileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  distinctZoneManagers: number;
  distinctStts: number;
  distinctGovernorates: number;
  previewRows: AdminPerformanceImportPreviewRow[];
}

export interface AdminPerformanceImportInjectResponse {
  batchId: string;
  sourceFileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  distinctZoneManagers: number;
  distinctStts: number;
  distinctGovernorates: number;
  savedRows: number;
}

export interface ZmPerformanceSttBreakdownItem {
  sttName?: string | null;
  caseCount: number;
  percentage: number;
  averageSlaBusinessDays?: number | null;
}

export interface ZmPerformanceGovernorateSttItem {
  sttName?: string | null;
  caseCount: number;
  percentage: number;
  averageSlaBusinessDays?: number | null;
}

export interface ZmPerformanceGovernorateItem {
  gouvernorat?: string | null;
  caseCount: number;
  percentage: number;
  averageSlaBusinessDays?: number | null;
  distinctSttCount: number;
  topSttName?: string | null;
  topSttCaseCount: number;
  sttBreakdown: ZmPerformanceGovernorateSttItem[];
}

export interface ZmPerformanceStudyResponse {
  selectedZoneManager?: string | null;
  selectedGovernorate?: string | null;
  availableZoneManagers: string[];
  availableGovernorates: string[];
  totalCases: number;
  rowsWithSla: number;
  averageSlaBusinessDays: number;
  minSlaBusinessDays?: number | null;
  maxSlaBusinessDays?: number | null;
  distinctSttCount: number;
  distinctGovernorateCount: number;
  topSttName?: string | null;
  topSttCaseCount: number;
  topGovernorateName?: string | null;
  topGovernorateCaseCount: number;
  bestGovernorateName?: string | null;
  bestGovernorateAverageSla?: number | null;
  worstGovernorateName?: string | null;
  worstGovernorateAverageSla?: number | null;
  insights: string[];
  sttBreakdown: ZmPerformanceSttBreakdownItem[];
  governorateBreakdown: ZmPerformanceGovernorateItem[];
}

export interface AdminPerformanceAnalyticsQuery {
  zoneManager?: string;
  gouvernorat?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
}

export interface SavedZmPerformanceStudyResponse {
  id: string;
  savedAt: string;
  savedBy?: string | null;
  sourceFileNames: string[];
  sourceBatchIds: string[];
  study: ZmPerformanceStudyResponse;
}

export interface SavedZmPerformanceInvalidReason {
  reason: string;
  count: number;
}

export interface SavedZmPerformanceRowPreview {
  sourceFileName?: string | null;
  uploadedAt?: string | null;
  rowNumber: number;
  crmCase?: string | null;
  zoneManager?: string | null;
  gouvernorat?: string | null;
  stt?: string | null;
  statut?: string | null;
  openDateSurTimos?: string | null;
  dateAffectationStt?: string | null;
  slaBusinessDays?: number | null;
  issues: string[];
  validRow: boolean;
}

export interface SavedZmPerformanceRowQualityResponse {
  sourceFileNames: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  distinctZoneManagers: number;
  distinctStts: number;
  distinctGovernorates: number;
  rowsWithSla: number;
  invalidRowsWithMultipleIssues: number;
  invalidPageSize: number;
  invalidPage: number;
  filteredInvalidRows: number;
  invalidTotalPages: number;
  selectedInvalidReason?: string | null;
  invalidReasonSummaries: SavedZmPerformanceInvalidReason[];
  invalidPreviewRows: SavedZmPerformanceRowPreview[];
}

export interface SavedZmPerformanceRowQualityQuery extends AdminPerformanceAnalyticsQuery {
  invalidReason?: string;
  invalidPage?: number;
  invalidPageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminPerformanceImportService {
  private static readonly GET_CACHE_TTL_MS = 10000;
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly importUrl = `${this.baseUrl}/api/v1/admin/performance-imports`;
  private readonly getCache = new Map<string, { expiresAt: number; stream: Observable<unknown> }>();

  preview(file: File): Observable<AdminPerformanceImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<AdminPerformanceImportPreviewResponse>(`${this.importUrl}/preview`, formData);
  }

  inject(file: File): Observable<AdminPerformanceImportInjectResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<AdminPerformanceImportInjectResponse>(`${this.importUrl}/inject`, formData).pipe(
      tap(() => this.invalidateCachedGets())
    );
  }

  getAnalytics(query: AdminPerformanceAnalyticsQuery): Observable<ZmPerformanceStudyResponse> {
    const params = new URLSearchParams();

    if (query.zoneManager?.trim()) {
      params.set('zoneManager', query.zoneManager.trim());
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
    const url = queryString ? `${this.importUrl}/analytics?${queryString}` : `${this.importUrl}/analytics`;
    return this.cachedGet<ZmPerformanceStudyResponse>(url);
  }

  saveStudy(study: ZmPerformanceStudyResponse): Observable<SavedZmPerformanceStudyResponse> {
    return this.http.post<SavedZmPerformanceStudyResponse>(`${this.importUrl}/save-study`, {
      study
    }).pipe(
      tap(() => this.invalidateCachedGets())
    );
  }

  listSavedStudies(): Observable<SavedZmPerformanceStudyResponse[]> {
    return this.cachedGet<SavedZmPerformanceStudyResponse[]>(`${this.importUrl}/saved-studies`);
  }

  getSavedStudyAnalytics(studyId: string, query: AdminPerformanceAnalyticsQuery): Observable<ZmPerformanceStudyResponse> {
    const params = new URLSearchParams();

    if (query.zoneManager?.trim()) {
      params.set('zoneManager', query.zoneManager.trim());
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
    const url = queryString
      ? `${this.importUrl}/saved-studies/${encodeURIComponent(studyId)}/analytics?${queryString}`
      : `${this.importUrl}/saved-studies/${encodeURIComponent(studyId)}/analytics`;

    return this.cachedGet<ZmPerformanceStudyResponse>(url);
  }

  getSavedStudyRowQuality(studyId: string, query: SavedZmPerformanceRowQualityQuery): Observable<SavedZmPerformanceRowQualityResponse> {
    const params = new URLSearchParams();

    if (query.zoneManager?.trim()) {
      params.set('zoneManager', query.zoneManager.trim());
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

    if (query.invalidReason?.trim()) {
      params.set('invalidReason', query.invalidReason.trim());
    }

    if (query.invalidPage != null) {
      params.set('invalidPage', String(query.invalidPage));
    }

    if (query.invalidPageSize != null) {
      params.set('invalidPageSize', String(query.invalidPageSize));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.importUrl}/saved-studies/${encodeURIComponent(studyId)}/row-quality?${queryString}`
      : `${this.importUrl}/saved-studies/${encodeURIComponent(studyId)}/row-quality`;

    return this.cachedGet<SavedZmPerformanceRowQualityResponse>(url);
  }

  private cachedGet<T>(url: string): Observable<T> {
    const now = Date.now();
    const cached = this.getCache.get(url);
    if (cached && cached.expiresAt > now) {
      return cached.stream as Observable<T>;
    }

    const request$ = this.http.get<T>(url).pipe(
      tap({
        error: () => this.getCache.delete(url)
      }),
      shareReplay(1)
    );

    this.getCache.set(url, {
      expiresAt: now + AdminPerformanceImportService.GET_CACHE_TTL_MS,
      stream: request$
    });
    return request$;
  }

  private invalidateCachedGets(): void {
    this.getCache.clear();
  }
}
