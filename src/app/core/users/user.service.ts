import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppUser, Role, UserAuditDetailsResponse, UserAuditItem } from './user.model';
import { API_BASE_URL } from '../http/api.config';

export interface AssignCoverageAreasToSttRequest {
  sttId: string;
  coveredGovernorates: string[];
}

export interface RequestCoverageAreasRequest {
  requestedGovernorates: string[];
}

export interface ValidateCoverageAreasRequest {
  approvedGovernorates: string[];
}

export interface AssignGovernoratesToZmRequest {
  zmId: string;
  assignedGovernorates: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly baseUrl = `${this.apiBaseUrl}/api/v1`;
  private readonly usersUrl = `${this.baseUrl}/users`;

  getAll(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.usersUrl);
  }

  getById(id: string): Observable<AppUser> {
    return this.http.get<AppUser>(`${this.usersUrl}/${id}`);
  }

  getAuditDetails(id: string): Observable<UserAuditDetailsResponse> {
    return this.http.get<UserAuditDetailsResponse>(`${this.usersUrl}/${id}/audit-details`);
  }

  getMe(): Observable<AppUser> {
    return this.http.get<AppUser>(`${this.usersUrl}/me`);
  }

  create(payload: any): Observable<AppUser> {
    return this.http.post<AppUser>(this.usersUrl, payload);
  }

  update(id: string, payload: any): Observable<AppUser> {
    return this.http.put<AppUser>(`${this.usersUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.usersUrl}/${id}`);
  }

  getAuditByRole(role: Role): Observable<UserAuditItem[]> {
    return this.http.get<UserAuditItem[]>(`${this.usersUrl}/audit/by-role/${role}`);
  }

  assignCoverageAreasToStt(body: AssignCoverageAreasToSttRequest): Observable<AppUser> {
    return this.http.put<AppUser>(
      `${this.baseUrl}/admin/assign-coverage-areas-to-stt`,
      body
    );
  }

  assignGovernoratesToZm(body: AssignGovernoratesToZmRequest): Observable<AppUser> {
    return this.http.put<AppUser>(
      `${this.baseUrl}/admin/assign-governorates-to-zm`,
      body
    );
  }

  requestMyCoverageAreas(body: RequestCoverageAreasRequest): Observable<AppUser> {
    return this.http.put<AppUser>(`${this.usersUrl}/me/coverage-request`, body);
  }

  getMyStts(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.usersUrl}/me/stts`);
  }

  getMyPendingCoverageRequests(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.usersUrl}/me/stts/coverage-requests`);
  }

  getMySttsForZm(): Observable<AppUser[]> {
    return this.getMyStts().pipe(
      map((users) => (users ?? []).filter((u) => u.role === 'ROLE_STT' && u.status === 'APPROVED' && !!u.enabled))
    );
  }

  getMySttTechs(sttId: string): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.usersUrl}/me/stts/${sttId}/techs`);
  }

  getMyTechsForStt(sttId: string): Observable<AppUser[]> {
    return this.getMySttTechs(sttId).pipe(
      map((users) => (users ?? []).filter((u) => u.role === 'ROLE_TECH' && u.status === 'APPROVED' && !!u.enabled))
    );
  }

  validateCoverageAreasForStt(sttId: string, body: ValidateCoverageAreasRequest): Observable<AppUser> {
    return this.http.put<AppUser>(`${this.usersUrl}/me/stts/${sttId}/coverage-validation`, body);
  }

  uploadProfileImage(userId: string, file: File): Observable<AppUser> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<AppUser>(
      `${this.usersUrl}/${userId}/profile-image`,
      formData
    );
  }
}
