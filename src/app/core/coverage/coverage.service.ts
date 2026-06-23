import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { CoverageLayerDetail, CoverageLayerSummary } from './coverage.models';

@Injectable({ providedIn: 'root' })
export class CoverageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/coverage-layers`;

  getLayers(): Observable<CoverageLayerSummary[]> {
    return this.http.get<CoverageLayerSummary[]>(this.url);
  }

  getLayer(id: string): Observable<CoverageLayerDetail> {
    return this.http.get<CoverageLayerDetail>(`${this.url}/${id}`);
  }

  uploadLayer(formData: FormData): Observable<CoverageLayerDetail> {
    return this.http.post<CoverageLayerDetail>(`${this.url}/upload`, formData);
  }

  archiveLayer(id: string): Observable<CoverageLayerSummary> {
    return this.http.patch<CoverageLayerSummary>(`${this.url}/${id}/archive`, {});
  }

  deleteLayer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
