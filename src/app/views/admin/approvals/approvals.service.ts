import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api.config';
import { Role } from '../../../core/auth/models/roles.type';
import { AccountStatus } from '../../../core/auth/models/account-status.type';

export interface PendingApprovalUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  roleRequested?: string | null;
  role: Role;
  status: AccountStatus;
  createdAt?: string;
  assignedSttId?: string;
  assignedSttEmail?: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPending(): Observable<PendingApprovalUser[]> {
    return this.http.get<PendingApprovalUser[]>(
      `${this.baseUrl}/api/v1/approvals/pending`
    );
  }

  approve(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/v1/approvals/${id}/approve`,
      {}
    );
  }

  reject(id: string, reason: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/v1/approvals/${id}/reject`,
      { reason }
    );
  }
}