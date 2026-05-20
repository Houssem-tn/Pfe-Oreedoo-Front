import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface MergedUploadResponse {
  studyId: string;
  status: string;
  message: string;
}

export interface MergedStatusResponse {
  studyId: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  processedRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  progressPercent: number;
  processingDurationMs: number | null;
  errorMessage: string | null;
}

export interface MergedSummaryResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningRows: number;
  countBySource: Record<string, number>;
  countBySourceLabel: Record<string, number>;
  countByZoneManager: Record<string, number>;
  countByStt: Record<string, number>;
  countByStatus: Record<string, number>;
  countByGouvernorat: Record<string, number>;
  dateMin: string | null;
  dateMax: string | null;
  missingOptionalColumns: string[];
}

export interface MonthlyTrendPoint {
  month: string;
  count: number;
}

export interface TechnicalMetricsAverages {
  avgDebitDl: number | null;
  avgDebitUl: number | null;
  avgRsrp: number | null;
  avgRsrq: number | null;
  avgSinr: number | null;
  avgSlaCrm: number | null;
  avgSlaTech: number | null;
}

export interface MergedChartsResponse {
  sourceDistribution: Record<string, number>;
  sourceLabelDistribution: Record<string, number>;
  zoneManagerDistribution: Record<string, number>;
  sttDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  gouvernoratDistribution: Record<string, number>;
  slaCrmLabelDistribution: Record<string, number>;
  slaTechLabelDistribution: Record<string, number>;
  monthlyTrend: MonthlyTrendPoint[];
  technicalMetrics: TechnicalMetricsAverages;
}

export interface MergedInvalidRowDto {
  id: string;
  rowNumber: number;
  crmCase: string | null;
  source: string | null;
  zoneManager: string | null;
  reasons: string[];
  rawPreview: string | null;
}

export interface MergedInvalidRowsPageResponse {
  content: MergedInvalidRowDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface MergedStudyListItem {
  studyId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  processingStatus: string;
  processingDurationMs: number | null;
  sourcesFound: string[];
}

export interface MergedAnalyticsFiltersResponse {
  sources: string[];
  zoneManagers: string[];
  stts: string[];
  governorates: string[];
  statuses: string[];
}

export interface MergedChartFilters {
  source?: string;
  zoneManager?: string;
  stt?: string;
  status?: string;
  gouvernorat?: string;
  dateBasis?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminMergedAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/admin/merged-analytics';

  upload(file: File): Observable<MergedUploadResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MergedUploadResponse>(`${this.base}/upload`, form);
  }

  getStatus(studyId: string): Observable<MergedStatusResponse> {
    return this.http.get<MergedStatusResponse>(`${this.base}/${studyId}/status`);
  }

  getSummary(studyId: string, filters: MergedChartFilters = {}): Observable<MergedSummaryResponse> {
    const params = this.buildParams(filters);
    return this.http.get<MergedSummaryResponse>(`${this.base}/${studyId}/summary`, { params });
  }

  getCharts(studyId: string, filters: MergedChartFilters = {}): Observable<MergedChartsResponse> {
    const params = this.buildParams(filters);
    return this.http.get<MergedChartsResponse>(`${this.base}/${studyId}/charts`, { params });
  }

  getInvalidRows(studyId: string, page = 0, size = 50): Observable<MergedInvalidRowsPageResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<MergedInvalidRowsPageResponse>(`${this.base}/${studyId}/invalid-rows`, { params });
  }

  listStudies(): Observable<MergedStudyListItem[]> {
    return this.http.get<MergedStudyListItem[]>(`${this.base}/studies`);
  }

  getFilters(studyId: string): Observable<MergedAnalyticsFiltersResponse> {
    return this.http.get<MergedAnalyticsFiltersResponse>(`${this.base}/${studyId}/filters`);
  }

  deleteStudy(studyId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${studyId}`);
  }

  private buildParams(filters: MergedChartFilters): HttpParams {
    let params = new HttpParams();
    if (filters.source)      params = params.set('source', filters.source);
    if (filters.zoneManager) params = params.set('zoneManager', filters.zoneManager);
    if (filters.stt)         params = params.set('stt', filters.stt);
    if (filters.status)      params = params.set('status', filters.status);
    if (filters.gouvernorat) params = params.set('gouvernorat', filters.gouvernorat);
    if (filters.dateBasis)   params = params.set('dateBasis', filters.dateBasis);
    if (filters.dateFrom)    params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo)      params = params.set('dateTo', filters.dateTo);
    return params;
  }
}
