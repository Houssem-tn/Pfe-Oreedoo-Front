import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';

export interface AdminActivationAnalyticsPreviewRow {
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

export interface AdminActivationAnalyticsInvalidReason {
  reason: string;
  count: number;
}

export interface AdminActivationAnalyticsPreviewResponse {
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
  invalidReasonSummaries: AdminActivationAnalyticsInvalidReason[];
  validPreviewRows: AdminActivationAnalyticsPreviewRow[];
  invalidRowsPreview: AdminActivationAnalyticsPreviewRow[];
}

export type ActivationImportProcessingMode = 'ANALYTICS' | 'DISTRIBUTION' | 'ANALYTICS_AND_DISTRIBUTION';

export interface AdminActivationAnalyticsDistributionSummary {
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

export interface AdminActivationAnalyticsImportResponse {
  mode: ActivationImportProcessingMode;
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
  distributionSummary: AdminActivationAnalyticsDistributionSummary | null;
  uploadedAt: string;
}

export interface AdminActivationAnalyticsBatch {
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

export interface AdminActivationAnalyticsKpis {
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

export interface AdminActivationAnalyticsSttItem {
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

export interface AdminActivationAnalyticsGovernorateItem {
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

export interface AdminActivationAnalyticsCauseItem {
  cause: string;
  count: number;
  percentage: number;
}

export interface AdminActivationAnalyticsPipelineStage {
  stageKey: string;
  label: string;
  averageBusinessDays: number | null;
  measuredCases: number;
}

export interface AdminActivationAnalyticsQualitySlice {
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

export interface AdminActivationAnalyticsAlert {
  severity: string;
  title: string;
  message: string;
}

export interface AdminActivationAnalyticsSummary {
  storedRows: number;
  validStoredRows: number;
  batchCount: number;
  latestBatch: AdminActivationAnalyticsBatch | null;
  recentBatches: AdminActivationAnalyticsBatch[];
  availableStts: string[];
  availableGovernorates: string[];
  selectedStt: string | null;
  selectedGovernorate: string | null;
  kpis: AdminActivationAnalyticsKpis;
  rdvSuccessRate: number;
  averageDebitDl: number | null;
  averageDebitUl: number | null;
  averageRsrp: number | null;
  averageRsrq: number | null;
  averageSinr: number | null;
  averageMetrageCable: number | null;
  averageNombreDePv: number | null;
}

export interface AdminActivationAnalyticsCharts {
  bestStt: string | null;
  worstStt: string | null;
  bestGovernorate: string | null;
  worstGovernorate: string | null;
  mostDelayedStage: string | null;
  sttRanking: AdminActivationAnalyticsSttItem[];
  governorateBreakdown: AdminActivationAnalyticsGovernorateItem[];
  topInjoignabiliteCauses: AdminActivationAnalyticsCauseItem[];
  topAbandonCauses: AdminActivationAnalyticsCauseItem[];
  pipelineStages: AdminActivationAnalyticsPipelineStage[];
  qualityByStt: AdminActivationAnalyticsQualitySlice[];
  qualityByGovernorate: AdminActivationAnalyticsQualitySlice[];
  alerts: AdminActivationAnalyticsAlert[];
  insights: string[];
}

export interface AdminActivationAnalyticsRowListItem {
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

export interface AdminActivationAnalyticsRowsPage {
  items: AdminActivationAnalyticsRowListItem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface AdminActivationAnalyticsDashboard {
  storedRows: number;
  validStoredRows: number;
  batchCount: number;
  latestBatch: AdminActivationAnalyticsBatch | null;
  recentBatches: AdminActivationAnalyticsBatch[];
  availableStts: string[];
  availableGovernorates: string[];
  selectedStt: string | null;
  selectedGovernorate: string | null;
  kpis: AdminActivationAnalyticsKpis;
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
  sttRanking: AdminActivationAnalyticsSttItem[];
  governorateBreakdown: AdminActivationAnalyticsGovernorateItem[];
  topInjoignabiliteCauses: AdminActivationAnalyticsCauseItem[];
  topAbandonCauses: AdminActivationAnalyticsCauseItem[];
  pipelineStages: AdminActivationAnalyticsPipelineStage[];
  qualityByStt: AdminActivationAnalyticsQualitySlice[];
  qualityByGovernorate: AdminActivationAnalyticsQualitySlice[];
  alerts: AdminActivationAnalyticsAlert[];
  insights: string[];
}

export interface AdminActivationAnalyticsQuery {
  stt?: string;
  gouvernorat?: string;
}

export interface SavedActivationAnalyticsStudyResponse {
  id: string;
  savedAt: string;
  savedBy?: string | null;
  sourceFileNames: string[];
  sourceBatchIds: string[];
  dashboard: AdminActivationAnalyticsDashboard;
}

@Injectable({ providedIn: 'root' })
export class AdminActivationAnalyticsService {
  private static readonly GET_CACHE_TTL_MS = 10000;
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly analyticsUrl = `${this.baseUrl}/api/v1/admin/activation-analytics`;
  private readonly getCache = new Map<string, { expiresAt: number; stream: Observable<unknown> }>();

  preview(file: File): Observable<AdminActivationAnalyticsPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AdminActivationAnalyticsPreviewResponse>(`${this.analyticsUrl}/preview`, formData);
  }

  importFile(file: File, mode: ActivationImportProcessingMode): Observable<AdminActivationAnalyticsImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return this.http.post<AdminActivationAnalyticsImportResponse>(`${this.analyticsUrl}/import`, formData).pipe(
      tap(() => this.invalidateCachedGets())
    );
  }

  getSummary(query: AdminActivationAnalyticsQuery = {}): Observable<AdminActivationAnalyticsSummary> {
    return this.cachedGet<AdminActivationAnalyticsSummary>(this.buildUrl(`${this.analyticsUrl}/summary`, query));
  }

  getCharts(query: AdminActivationAnalyticsQuery = {}): Observable<AdminActivationAnalyticsCharts> {
    return this.cachedGet<AdminActivationAnalyticsCharts>(this.buildUrl(`${this.analyticsUrl}/charts`, query));
  }

  getRows(
    page = 0,
    size = 50,
    query: AdminActivationAnalyticsQuery = {}
  ): Observable<AdminActivationAnalyticsRowsPage> {
    return this.cachedGet<AdminActivationAnalyticsRowsPage>(this.buildUrl(`${this.analyticsUrl}/rows`, {
      ...query,
      page,
      size
    }));
  }

  getDashboard(query: AdminActivationAnalyticsQuery = {}): Observable<AdminActivationAnalyticsDashboard> {
    return this.cachedGet<AdminActivationAnalyticsDashboard>(this.buildUrl(`${this.analyticsUrl}/dashboard`, query));
  }

  saveStudy(dashboard: AdminActivationAnalyticsDashboard): Observable<SavedActivationAnalyticsStudyResponse> {
    return this.http.post<SavedActivationAnalyticsStudyResponse>(`${this.analyticsUrl}/save-study`, {
      dashboard
    }).pipe(
      tap(() => this.invalidateCachedGets())
    );
  }

  listSavedStudies(): Observable<SavedActivationAnalyticsStudyResponse[]> {
    return this.cachedGet<SavedActivationAnalyticsStudyResponse[]>(`${this.analyticsUrl}/saved-studies`);
  }

  getSavedStudySummary(
    studyId: string,
    query: AdminActivationAnalyticsQuery = {}
  ): Observable<AdminActivationAnalyticsSummary> {
    return this.cachedGet<AdminActivationAnalyticsSummary>(
      this.buildSavedStudyUrl(studyId, 'summary', query)
    );
  }

  getSavedStudyCharts(
    studyId: string,
    query: AdminActivationAnalyticsQuery = {}
  ): Observable<AdminActivationAnalyticsCharts> {
    return this.cachedGet<AdminActivationAnalyticsCharts>(
      this.buildSavedStudyUrl(studyId, 'charts', query)
    );
  }

  getSavedStudyRows(
    studyId: string,
    page = 0,
    size = 50,
    query: AdminActivationAnalyticsQuery = {}
  ): Observable<AdminActivationAnalyticsRowsPage> {
    return this.cachedGet<AdminActivationAnalyticsRowsPage>(
      this.buildSavedStudyUrl(studyId, 'rows', {
        ...query,
        page,
        size
      })
    );
  }

  getSavedStudyDashboard(
    studyId: string,
    query: AdminActivationAnalyticsQuery = {}
  ): Observable<AdminActivationAnalyticsDashboard> {
    return this.cachedGet<AdminActivationAnalyticsDashboard>(
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
      expiresAt: now + AdminActivationAnalyticsService.GET_CACHE_TTL_MS,
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
    query: AdminActivationAnalyticsQuery & { page?: number; size?: number } = {}
  ): string {
    const encodedId = encodeURIComponent(studyId);
    return this.buildUrl(`${this.analyticsUrl}/saved-studies/${encodedId}/${endpoint}`, query);
  }

  private buildUrl(
    baseUrl: string,
    query: AdminActivationAnalyticsQuery & { page?: number; size?: number } = {}
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
