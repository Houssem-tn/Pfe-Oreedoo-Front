import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { CreatePermissionRequest, StockUsagePermission } from './stock.model';

@Injectable({ providedIn: 'root' })
export class StockUsagePermissionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly permissionsUrl = `${this.baseUrl}/api/v1/stock-usage-permissions`;

  createPermissionRequest(payload: CreatePermissionRequest): Observable<StockUsagePermission> {
    return this.http.post<StockUsagePermission>(this.permissionsUrl, payload);
  }

  getPermissionsByCase(caseId: string): Observable<StockUsagePermission[]> {
    return this.http.get<StockUsagePermission[]>(`${this.permissionsUrl}/case/${caseId}`);
  }
}
