import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { NotificationItem } from './models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getMyRoleNotifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(
      `${this.baseUrl}/api/v1/notifications/my-role`
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(
      `${this.baseUrl}/api/v1/notifications/my-role/unread-count`
    );
  }

  markAsRead(notificationId: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(
      `${this.baseUrl}/api/v1/notifications/${notificationId}/read`,
      {}
    );
  }

  markAllAsRead(): Observable<NotificationItem[]> {
    return this.http.patch<NotificationItem[]>(
      `${this.baseUrl}/api/v1/notifications/my-role/read-all`,
      {}
    );
  }
}