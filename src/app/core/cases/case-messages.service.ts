import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';

export interface CaseMessage {
  id: string;
  caseId: string;
  caseReference: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderRole: 'ROLE_ZM' | 'ROLE_STT' | string;
  receiverId: string;
  receiverName: string | null;
  receiverRole: string;
  content: string | null;
  attachmentFilename: string | null;
  attachmentContentType: string | null;
  attachmentViewUrl: string | null;
  attachmentDownloadUrl: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  /** True when the current authenticated user is the sender (bubble alignment). */
  mine: boolean;
}

export interface CaseMessageUnread {
  caseId: string;
  caseReference: string;
  caseType: string | null;
  caseModule: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface CaseMessageUnreadSummary {
  totalUnread: number;
  cases: CaseMessageUnread[];
}

export interface MarkMessagesReadResponse {
  caseId: string;
  markedRead: number;
}

@Injectable({ providedIn: 'root' })
export class CaseMessagesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly casesUrl = `${this.baseUrl}/api/v1/cases`;

  getMessages(caseId: string): Observable<CaseMessage[]> {
    return this.http.get<CaseMessage[]>(`${this.casesUrl}/${caseId}/messages`);
  }

  sendMessage(caseId: string, content: string, file?: File | null): Observable<CaseMessage> {
    if (file) {
      const formData = new FormData();
      if (content.trim()) {
        formData.append('content', content.trim());
      }
      formData.append('file', file, file.name);
      return this.http.post<CaseMessage>(`${this.casesUrl}/${caseId}/messages`, formData);
    }
    return this.http.post<CaseMessage>(`${this.casesUrl}/${caseId}/messages`, { content: content.trim() });
  }

  markThreadRead(caseId: string): Observable<MarkMessagesReadResponse> {
    return this.http.put<MarkMessagesReadResponse>(`${this.casesUrl}/${caseId}/messages/read`, {});
  }

  getUnreadSummary(): Observable<CaseMessageUnreadSummary> {
    return this.http.get<CaseMessageUnreadSummary>(`${this.baseUrl}/api/v1/case-messages/unread-summary`);
  }
}
