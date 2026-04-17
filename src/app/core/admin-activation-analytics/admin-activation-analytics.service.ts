import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  validNewRows: number;
  duplicateRows: number;
  invalidRows: number;
  distinctStts: number;
  distinctGovernorates: number;
  invalidRowPageSize: number;
  invalidReasonSummaries: AdminActivationAnalyticsInvalidReason[];
  validPreviewRows: AdminActivationAnalyticsPreviewRow[];
  invalidRowsPreview: AdminActivationAnalyticsPreviewRow[];
}

export interface AdminActivationAnalyticsImportResponse {
  batchId: string;
  sourceFileName: string;
  totalRows: number;
  insertedRows: number;
  validNewRows: number;
  invalidRows: number;
  duplicateRows: number;
  distinctStts: number;
  distinctGovernorates: number;
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
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly analyticsUrl = `${this.baseUrl}/api/v1/admin/activation-analytics`;

  preview(file: File): Observable<AdminActivationAnalyticsPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AdminActivationAnalyticsPreviewResponse>(`${this.analyticsUrl}/preview`, formData);
  }

  importFile(file: File): Observable<AdminActivationAnalyticsImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AdminActivationAnalyticsImportResponse>(`${this.analyticsUrl}/import`, formData);
  }

  getDashboard(query: AdminActivationAnalyticsQuery = {}): Observable<AdminActivationAnalyticsDashboard> {
    const params = new URLSearchParams();

    if (query.stt?.trim()) {
      params.set('stt', query.stt.trim());
    }

    if (query.gouvernorat?.trim()) {
      params.set('gouvernorat', query.gouvernorat.trim());
    }

    const queryString = params.toString();
    const url = queryString ? `${this.analyticsUrl}/dashboard?${queryString}` : `${this.analyticsUrl}/dashboard`;
    return this.http.get<AdminActivationAnalyticsDashboard>(url);
  }

  saveStudy(dashboard: AdminActivationAnalyticsDashboard): Observable<SavedActivationAnalyticsStudyResponse> {
    return this.http.post<SavedActivationAnalyticsStudyResponse>(`${this.analyticsUrl}/save-study`, {
      dashboard
    });
  }

  listSavedStudies(): Observable<SavedActivationAnalyticsStudyResponse[]> {
    return this.http.get<SavedActivationAnalyticsStudyResponse[]>(`${this.analyticsUrl}/saved-studies`);
  }

  getSavedStudyDashboard(
    studyId: string,
    query: AdminActivationAnalyticsQuery = {}
  ): Observable<AdminActivationAnalyticsDashboard> {
    const params = new URLSearchParams();

    if (query.stt?.trim()) {
      params.set('stt', query.stt.trim());
    }

    if (query.gouvernorat?.trim()) {
      params.set('gouvernorat', query.gouvernorat.trim());
    }

    const queryString = params.toString();
    const encodedId = encodeURIComponent(studyId);
    const url = queryString
      ? `${this.analyticsUrl}/saved-studies/${encodedId}/dashboard?${queryString}`
      : `${this.analyticsUrl}/saved-studies/${encodedId}/dashboard`;

    return this.http.get<AdminActivationAnalyticsDashboard>(url);
  }
}
