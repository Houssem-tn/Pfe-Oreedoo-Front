import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';

export type TechInvitationStatus =
  | 'PENDING_REGISTRATION'
  | 'REGISTERED_PENDING_ZM_APPROVAL'
  | 'APPROVED_BY_ZM'
  | 'REJECTED_BY_ZM'
  | 'EXPIRED'
  | 'CANCELLED';

export interface TechInvitation {
  id: string;
  email: string;
  sttId: string;
  sttEmail: string;
  sttName: string;
  zmId: string;
  zmEmail: string;
  zmName: string;
  registeredTechId?: string | null;
  token?: string;
  used: boolean;
  createdAt?: string;
  expiresAt?: string;
  registeredAt?: string;
  zmDecisionAt?: string;
  status: TechInvitationStatus;
}

@Injectable({ providedIn: 'root' })
export class TechInvitationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  sendInvitation(email: string): Observable<string> {
    return this.http.post(`${this.baseUrl}/api/v1/tech-invitations/stt/send`, { email }, {
      responseType: 'text'
    });
  }

  getMySttInvitations(): Observable<TechInvitation[]> {
    return this.http.get<TechInvitation[]>(`${this.baseUrl}/api/v1/tech-invitations/stt/my-invitations`);
  }

  getPendingZmApprovals(): Observable<TechInvitation[]> {
    return this.http.get<TechInvitation[]>(`${this.baseUrl}/api/v1/tech-invitations/zm/pending`);
  }

  decideByZm(invitationId: string, approve: boolean): Observable<string> {
    return this.http.post(
      `${this.baseUrl}/api/v1/tech-invitations/zm/${invitationId}/decision`,
      { approve },
      { responseType: 'text' }
    );
  }
}