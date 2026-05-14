import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';

export interface AdminComplaintAnalyticsPreviewRow {
  rowNumber: number;
  crmCase: string | null;
  gouvernorat: string | null;
  stt: string | null;
  statut: string | null;
  assignmentBusinessDays: number | null;
  rdvBusinessDays: number | null;
  executionBusinessDays: number | null;
  endToEndBusinessDays: number | null;
  issues: string[];
  validRow: boolean;
  rowCategory: 'valid_new' | 'duplicate' | 'invalid';
}

export interface AdminComplaintAnalyticsInvalidReason {
  reason: string;
  count: number;
}

export interface AdminComplaintAnalyticsPreviewResponse {
  sourceFileName: string;
  totalRows: number;
  processableRows: number;
  validNewRows: number;
  duplicateRows: number;
  invalidRows: number;
  distinctStts: number;
  distinctGovernorates: number;
  enCoursRows: number;
  effectueRows: number;
  termineRows: number;
  actionableRows: number;
  invalidRowPageSize: number;
  invalidReasonSummaries: AdminComplaintAnalyticsInvalidReason[];
  validPreviewRows: AdminComplaintAnalyticsPreviewRow[];
  invalidRowsPreview: AdminComplaintAnalyticsPreviewRow[];
}

export type ComplaintImportProcessingMode = 'ANALYTICS' | 'DISTRIBUTION' | 'ANALYTICS_AND_DISTRIBUTION';

export interface AdminComplaintAnalyticsDistributionSummary {
  processableRows: number;
  actionableRows: number;
  createdCases: number;
  updatedExistingCases: number;
  assignedToZmCases: number;
  sentToAdminQueueCases: number;
  sourceCompletedRows: number;
  sourceTerminatedRows: number;
  noGovernorateRows: number;
}

export interface AdminComplaintAnalyticsImportResponse {
  mode: ComplaintImportProcessingMode;
  batchId: string | null;
  sourceFileName: string;
  totalRows: number;
  processableRows: number;
  insertedRows: number;
  validNewRows: number;
  invalidRows: number;
  duplicateRows: number;
  distinctStts: number;
  distinctGovernorates: number;
  enCoursRows: number;
  effectueRows: number;
  termineRows: number;
  actionableRows: number;
  distributionSummary: AdminComplaintAnalyticsDistributionSummary | null;
  uploadedAt: string;
}

export interface AdminComplaintAnalyticsBatch {
  batchId: string;
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  insertedRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  distinctStts: number;
  distinctGovernorates: number;
}

export interface AdminComplaintAnalyticsKpis {
  totalCases: number;
  completedCasesPercentage: number;
  averageAssignmentSla: number | null;
  averageRdvDelay: number | null;
  averageExecutionSla: number | null;
  averageEndToEndSla: number | null;
  delayedCasesPercentage: number;
  blockedCasesPercentage: number;
  injoignableRate: number;
  abandonRate: number;
  sttCount: number;
  governorateCount: number;
}

export interface AdminComplaintAnalyticsSttItem {
  sttName: string;
  caseCount: number;
  percentage: number;
  averageAssignmentSla: number | null;
  averageRdvDelay: number | null;
  averageExecutionSla: number | null;
  averageEndToEndSla: number | null;
  rdvSuccessRate: number;
  workCompletionRate: number;
  abandonRate: number;
  injoignableRate: number;
  delayedRate: number;
}

export interface AdminComplaintAnalyticsGovernorateItem {
  gouvernorat: string;
  caseCount: number;
  percentage: number;
  averageAssignmentSla: number | null;
  averageRdvDelay: number | null;
  averageExecutionSla: number | null;
  averageEndToEndSla: number | null;
  rdvSuccessRate: number;
  workCompletionRate: number;
  delayedRate: number;
  distinctSttCount: number;
  topSttName: string | null;
}

export interface AdminComplaintAnalyticsCauseItem {
  cause: string;
  count: number;
  percentage: number;
}

export interface AdminComplaintAnalyticsPipelineStage {
  stageKey: string;
  label: string;
  averageBusinessDays: number | null;
  measuredCases: number;
}

export interface AdminComplaintAnalyticsQualitySlice {
  label: string;
  caseCount: number;
  averageDebitDl: number | null;
  averageDebitUl: number | null;
  averageRsrp: number | null;
  averageRsrq: number | null;
  averageSinr: number | null;
  averageMetrageCable: number | null;
  averageNombreDePv: number | null;
}

export interface AdminComplaintAnalyticsAlert {
  severity: string;
  title: string;
  message: string;
}

export interface AdminComplaintAnalyticsSummary {
  storedRows: number;
  validStoredRows: number;
  batchCount: number;
  latestBatch: AdminComplaintAnalyticsBatch | null;
  recentBatches: AdminComplaintAnalyticsBatch[];
  availableStts: string[];
  availableGovernorates: string[];
  selectedStt: string | null;
  selectedGovernorate: string | null;
  kpis: AdminComplaintAnalyticsKpis;
  rdvSuccessRate: number;
  averageDebitDl: number | null;
  averageDebitUl: number | null;
  averageRsrp: number | null;
  averageRsrq: number | null;
  averageSinr: number | null;
  averageMetrageCable: number | null;
  averageNombreDePv: number | null;
}

export interface AdminComplaintAnalyticsCharts {
  bestStt: string | null;
  worstStt: string | null;
  bestGovernorate: string | null;
  worstGovernorate: string | null;
  mostDelayedStage: string | null;
  sttRanking: AdminComplaintAnalyticsSttItem[];
  governorateBreakdown: AdminComplaintAnalyticsGovernorateItem[];
  topInjoignabiliteCauses: AdminComplaintAnalyticsCauseItem[];
  topAbandonCauses: AdminComplaintAnalyticsCauseItem[];
  pipelineStages: AdminComplaintAnalyticsPipelineStage[];
  qualityByStt: AdminComplaintAnalyticsQualitySlice[];
  qualityByGovernorate: AdminComplaintAnalyticsQualitySlice[];
  alerts: AdminComplaintAnalyticsAlert[];
  insights: string[];
}

export interface AdminComplaintAnalyticsRowListItem {
  id: string;
  batchId: string;
  uploadedAt: string;
  sourceFileName: string | null;
  rowNumber: number | null;
  crmCase: string | null;
  gouvernorat: string | null;
  stt: string | null;
  statut: string | null;
  assignmentBusinessDays: number | null;
  rdvBusinessDays: number | null;
  executionBusinessDays: number | null;
  endToEndBusinessDays: number | null;
}

export interface AdminComplaintAnalyticsRowsPage {
  items: AdminComplaintAnalyticsRowListItem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface AdminComplaintAnalyticsDashboard {
  storedRows: number;
  validStoredRows: number;
  batchCount: number;
  latestBatch: AdminComplaintAnalyticsBatch | null;
  recentBatches: AdminComplaintAnalyticsBatch[];
  availableStts: string[];
  availableGovernorates: string[];
  selectedStt: string | null;
  selectedGovernorate: string | null;
  kpis: AdminComplaintAnalyticsKpis;
  rdvSuccessRate: number;
  bestStt: string | null;
  worstStt: string | null;
  bestGovernorate: string | null;
  worstGovernorate: string | null;
  mostDelayedStage: string | null;
  averageDebitDl: number | null;
  averageDebitUl: number | null;
  averageRsrp: number | null;
  averageRsrq: number | null;
  averageSinr: number | null;
  averageMetrageCable: number | null;
  averageNombreDePv: number | null;
  sttRanking: AdminComplaintAnalyticsSttItem[];
  governorateBreakdown: AdminComplaintAnalyticsGovernorateItem[];
  topInjoignabiliteCauses: AdminComplaintAnalyticsCauseItem[];
  topAbandonCauses: AdminComplaintAnalyticsCauseItem[];
  pipelineStages: AdminComplaintAnalyticsPipelineStage[];
  qualityByStt: AdminComplaintAnalyticsQualitySlice[];
  qualityByGovernorate: AdminComplaintAnalyticsQualitySlice[];
  alerts: AdminComplaintAnalyticsAlert[];
  insights: string[];
}

export interface AdminComplaintAnalyticsQuery {
  stt?: string;
  gouvernorat?: string;
}

export interface SavedComplaintAnalyticsStudyResponse {
  id: string;
  savedAt: string;
  savedBy?: string | null;
  sourceFileNames: string[];
  sourceBatchIds: string[];
  dashboard: AdminComplaintAnalyticsDashboard;
}

@Injectable({ providedIn: 'root' })
export class AdminComplaintAnalyticsService {
  private static readonly GET_CACHE_TTL_MS = 10000;
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly analyticsUrl = `${this.baseUrl}/api/v1/plaintes/analytics`;
  private readonly getCache = new Map<string, { expiresAt: number; stream: Observable<unknown> }>();

  preview(file: File): Observable<AdminComplaintAnalyticsPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AdminComplaintAnalyticsPreviewResponse>(`${this.analyticsUrl}/preview`, formData);
  }

  importFile(file: File, mode: ComplaintImportProcessingMode): Observable<AdminComplaintAnalyticsImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return this.http.post<AdminComplaintAnalyticsImportResponse>(`${this.analyticsUrl}/import`, formData).pipe(
      tap(() => this.invalidateCachedGets())
    );
  }

  getSummary(query: AdminComplaintAnalyticsQuery = {}): Observable<AdminComplaintAnalyticsSummary> {
    return this.cachedGet<AdminComplaintAnalyticsSummary>(this.buildUrl(`${this.analyticsUrl}/summary`, query));
  }

  getCharts(query: AdminComplaintAnalyticsQuery = {}): Observable<AdminComplaintAnalyticsCharts> {
    return this.cachedGet<AdminComplaintAnalyticsCharts>(this.buildUrl(`${this.analyticsUrl}/charts`, query));
  }

  getRows(
    page = 0,
    size = 50,
    query: AdminComplaintAnalyticsQuery = {}
  ): Observable<AdminComplaintAnalyticsRowsPage> {
    return this.cachedGet<AdminComplaintAnalyticsRowsPage>(this.buildUrl(`${this.analyticsUrl}/rows`, {
      ...query,
      page,
      size
    }));
  }

  getDashboard(query: AdminComplaintAnalyticsQuery = {}): Observable<AdminComplaintAnalyticsDashboard> {
    return this.cachedGet<AdminComplaintAnalyticsDashboard>(this.buildUrl(`${this.analyticsUrl}/dashboard`, query));
  }

  saveStudy(dashboard: AdminComplaintAnalyticsDashboard): Observable<SavedComplaintAnalyticsStudyResponse> {
    return this.http.post<SavedComplaintAnalyticsStudyResponse>(`${this.analyticsUrl}/save-study`, {
      dashboard
    }).pipe(
      tap(() => this.invalidateCachedGets())
    );
  }

  listSavedStudies(): Observable<SavedComplaintAnalyticsStudyResponse[]> {
    return this.cachedGet<SavedComplaintAnalyticsStudyResponse[]>(`${this.analyticsUrl}/saved-studies`);
  }

  getSavedStudySummary(
    studyId: string,
    query: AdminComplaintAnalyticsQuery = {}
  ): Observable<AdminComplaintAnalyticsSummary> {
    return this.cachedGet<AdminComplaintAnalyticsSummary>(
      this.buildSavedStudyUrl(studyId, 'summary', query)
    );
  }

  getSavedStudyCharts(
    studyId: string,
    query: AdminComplaintAnalyticsQuery = {}
  ): Observable<AdminComplaintAnalyticsCharts> {
    return this.cachedGet<AdminComplaintAnalyticsCharts>(
      this.buildSavedStudyUrl(studyId, 'charts', query)
    );
  }

  getSavedStudyRows(
    studyId: string,
    page = 0,
    size = 50,
    query: AdminComplaintAnalyticsQuery = {}
  ): Observable<AdminComplaintAnalyticsRowsPage> {
    return this.cachedGet<AdminComplaintAnalyticsRowsPage>(
      this.buildSavedStudyUrl(studyId, 'rows', {
        ...query,
        page,
        size
      })
    );
  }

  getSavedStudyDashboard(
    studyId: string,
    query: AdminComplaintAnalyticsQuery = {}
  ): Observable<AdminComplaintAnalyticsDashboard> {
    return this.cachedGet<AdminComplaintAnalyticsDashboard>(
      this.buildSavedStudyUrl(studyId, 'dashboard', query)
    );
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
      expiresAt: now + AdminComplaintAnalyticsService.GET_CACHE_TTL_MS,
      stream: request$
    });
    return request$;
  }

  private invalidateCachedGets(): void {
    this.getCache.clear();
  }

  private buildSavedStudyUrl(
    studyId: string,
    endpoint: 'summary' | 'charts' | 'rows' | 'dashboard',
    query: AdminComplaintAnalyticsQuery & { page?: number; size?: number } = {}
  ): string {
    const encodedId = encodeURIComponent(studyId);
    return this.buildUrl(`${this.analyticsUrl}/saved-studies/${encodedId}/${endpoint}`, query);
  }

  private buildUrl(
    baseUrl: string,
    query: AdminComplaintAnalyticsQuery & { page?: number; size?: number } = {}
  ): string {
    const params = new URLSearchParams();

    if (query.stt?.trim()) {
      params.set('stt', query.stt.trim());
    }

    if (query.gouvernorat?.trim()) {
      params.set('gouvernorat', query.gouvernorat.trim());
    }

    if (query.page != null) {
      params.set('page', String(query.page));
    }

    if (query.size != null) {
      params.set('size', String(query.size));
    }

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}
