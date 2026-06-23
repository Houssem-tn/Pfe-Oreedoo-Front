import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { CoverageAnalysisResult, CoverageAnalysisSummary, PointCheckResponse } from './coverage.models';

@Injectable({ providedIn: 'root' })
export class CoverageAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/coverage-analysis`;

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
