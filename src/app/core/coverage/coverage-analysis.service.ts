import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import {
  CoverageAnalysisResult,
  CoverageAnalysisSummary,
  CoverageAnalyticsPointsResponse,
  PointCheckResponse
} from './coverage.models';

/** Optional viewport restriction for {@link CoverageAnalysisService.getAnalyticsPoints}. */
export interface CoverageBoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

@Injectable({ providedIn: 'root' })
export class CoverageAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/coverage-analysis`;

  /**
   * Coverage markers sourced from the latest imported Merged Operations file.
   * `source` defaults to MES (activation). Pass a bounding box to restrict to a viewport.
   */
  getAnalyticsPoints(
    source = 'MES',
    bbox?: CoverageBoundingBox,
    limit?: number
  ): Observable<CoverageAnalyticsPointsResponse> {
    let params = new HttpParams().set('source', source);
    if (bbox) {
      params = params
        .set('minLat', bbox.minLat)
        .set('minLng', bbox.minLng)
        .set('maxLat', bbox.maxLat)
        .set('maxLng', bbox.maxLng);
    }
    if (limit != null) params = params.set('limit', limit);
    return this.http.get<CoverageAnalyticsPointsResponse>(`${this.url}/analytics-points`, { params });
  }

  runAnalysis(governorate?: string): Observable<CoverageAnalysisSummary> {
    const body = governorate ? { governorate } : {};
    return this.http.post<CoverageAnalysisSummary>(`${this.url}/run`, body);
  }

  getSummary(): Observable<CoverageAnalysisSummary> {
    return this.http.get<CoverageAnalysisSummary>(`${this.url}/summary`);
  }

  getAllResults(): Observable<CoverageAnalysisResult[]> {
    return this.http.get<CoverageAnalysisResult[]>(`${this.url}/results`);
  }

  getCaseResult(caseId: string): Observable<CoverageAnalysisResult> {
    return this.http.get<CoverageAnalysisResult>(`${this.url}/case/${caseId}`);
  }

  getOutsideCoverage(): Observable<CoverageAnalysisResult[]> {
    return this.http.get<CoverageAnalysisResult[]>(`${this.url}/outside-coverage`);
  }

  checkPoint(latitude: number, longitude: number): Observable<PointCheckResponse> {
    return this.http.post<PointCheckResponse>(`${this.url}/check-point`, { latitude, longitude });
  }
}
