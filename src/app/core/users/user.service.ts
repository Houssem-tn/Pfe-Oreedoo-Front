import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUser, Role, UserAuditItem } from './user.model';

export interface AssignSttToZmRequest {
  sttId: string;
  zmId: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);

  private readonly baseUrl = 'http://localhost:8080/api/v1';
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

  getMySttTechs(sttId: string): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.usersUrl}/me/stts/${sttId}/techs`);
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