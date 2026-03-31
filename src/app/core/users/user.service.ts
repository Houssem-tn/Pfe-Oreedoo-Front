import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppUser, Role, UserAuditItem } from './user.model';
import { API_BASE_URL } from '../http/api.config';

export interface AssignSttToZmRequest {
  sttId: string;
  zmId: string;
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

  assignSttToZm(body: AssignSttToZmRequest): Observable<AppUser> {
    return this.http.put<AppUser>(
      `${this.baseUrl}/admin/assign-stt-to-zm`,
      body
    );
  }

  getMyStts(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.usersUrl}/me/stts`);
  }

  getAllZmsForAssignment(): Observable<AppUser[]> {
    return this.getAll().pipe(
      map((users) => (users ?? []).filter((u) => u.role === 'ROLE_ZM' && u.status === 'APPROVED' && !!u.enabled))
    );
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

  uploadProfileImage(userId: string, file: File): Observable<AppUser> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<AppUser>(
      `${this.usersUrl}/${userId}/profile-image`,
      formData
    );
  }
}
