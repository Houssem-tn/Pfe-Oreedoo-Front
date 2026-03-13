import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { TechnicianListItem } from './models/technician-list-item.model';

@Injectable({ providedIn: 'root' })
export class SttTechnicianApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getMyTechnicians(): Observable<TechnicianListItem[]> {
    return this.http.get<TechnicianListItem[]>(
      `${this.baseUrl}/api/v1/stt/my-technicians`
    );
  }
}