import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { ZmDashboardResponse } from './zm-dashboard.model';

@Injectable({ providedIn: 'root' })
export class ZmDashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/zm/dashboard`;

  /** Full operational dashboard for the logged-in ZM (server-aggregated, ZM-scoped). */
  getDashboard(): Observable<ZmDashboardResponse> {
    return this.http.get<ZmDashboardResponse>(this.url);
  }
}
