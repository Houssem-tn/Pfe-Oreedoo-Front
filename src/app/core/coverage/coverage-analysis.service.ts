import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import {
  CoverageAnalysisResult,
  CoverageAnalysisSummary,
  CoverageAnalyticsPoint,
  CoverageFeatureCollection,
  PointCheckResponse
} from './coverage.models';

/** High cap for the "load all MES points once" request (comfortably above the ~65K dataset). */
const ALL_POINTS_LIMIT = 200_000;

/** Optional viewport restriction for {@link CoverageAnalysisService.getAnalyticsPoints}. */
export interface CoverageBoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** Optional attribute filters for {@link CoverageAnalysisService.getAnalyticsPoints}. */
export interface CoveragePointFilters {
  governorate?: string;
  delegation?: string;
}

@Injectable({ providedIn: 'root' })
export class CoverageAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/coverage-analysis`;

  /**
   * Coverage markers sourced from the latest imported Merged Operations file, returned as a
   * GeoJSON FeatureCollection for the clustered MapLibre map. `source` defaults to MES
   * (activation). Pass a bounding box to load only the points inside the current viewport;
   * `zoom` and attribute `filters` are optional narrowing hints.
   */
  getAnalyticsPoints(
    source = 'MES',
    bbox?: CoverageBoundingBox,
    zoom?: number,
    filters?: CoveragePointFilters
  ): Observable<CoverageFeatureCollection> {
    let params = new HttpParams().set('source', source);
    if (bbox) {
      // MapLibre bounds order: minLng,minLat,maxLng,maxLat (west,south,east,north).
      params = params.set('bbox', `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`);
    }
    if (zoom != null) params = params.set('zoom', Math.round(zoom));
    if (filters?.governorate) params = params.set('governorate', filters.governorate);
    if (filters?.delegation) params = params.set('delegation', filters.delegation);
    return this.http.get<CoverageFeatureCollection>(`${this.url}/analytics-points`, { params });
  }

  /**
   * Loads ALL MES points once (no bounding box, high cap) as a GeoJSON FeatureCollection.
   * The map keeps them in memory and clusters them client-side — no per-zoom backend calls.
   */
  getAllAnalyticsPoints(source = 'MES'): Observable<CoverageFeatureCollection> {
    const params = new HttpParams().set('source', source).set('limit', ALL_POINTS_LIMIT);
    return this.http.get<CoverageFeatureCollection>(`${this.url}/analytics-points`, { params });
  }

  /**
   * Searches MES analytics rows by MSISDN (exact match) and returns the matching points so the
   * map can locate/highlight them. Does not touch the loaded MES point set.
   */
  searchByMsisdn(source = 'MES', msisdn: string): Observable<CoverageAnalyticsPoint[]> {
    const params = new HttpParams().set('source', source).set('msisdn', msisdn);
    return this.http.get<CoverageAnalyticsPoint[]>(`${this.url}/analytics-points/search`, { params });
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
