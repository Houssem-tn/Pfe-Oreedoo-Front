import { Injectable, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
//import SockJS from 'sockjs-client/dist/sockjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { AuthStore } from '../auth/auth.store';
import { TokenService } from '../auth/token.service';
import { Role } from '../auth/models/roles.type';
import { NotificationItem } from './models/notification.model';
import { buildNotificationTopic } from './models/notification-topic.util';

@Injectable({ providedIn: 'root' })
export class NotificationWsService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tokenService = inject(TokenService);
  private readonly authStore = inject(AuthStore);

  private client: Client | null = null;
  private subscription: StompSubscription | null = null;

  private readonly notificationSubject = new Subject<NotificationItem>();
  readonly notifications$ = this.notificationSubject.asObservable();

  connect(): void {
    const token = this.tokenService.get();
    const role = this.authStore.role();

    if (!token || !role) {
      return;
    }

    if (this.client?.active) {
      return;
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${this.baseUrl}/ws-notifications`),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 0,
      debug: (msg: string) => {
        console.log('[Notification WS]', msg);
      }
    });

    this.client.onConnect = () => {
      this.subscribeToRoleTopic(role);
    };

    this.client.onStompError = (frame) => {
      console.error('[Notification WS] Broker error:', frame.headers['message']);
      console.error('[Notification WS] Details:', frame.body);
    };

    this.client.onWebSocketError = (event) => {
      console.error('[Notification WS] WebSocket error:', event);
    };

    this.client.activate();
  }

  disconnect(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
  }

  reconnectForCurrentRole(): void {
    this.disconnect();
    this.connect();
  }

  private subscribeToRoleTopic(role: Role): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    this.subscription?.unsubscribe();

    const topic = buildNotificationTopic(role);

    this.subscription = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const payload = JSON.parse(message.body) as NotificationItem;
        this.notificationSubject.next(payload);
      } catch (error) {
        console.error('[Notification WS] Failed to parse message', error, message.body);
      }
    });
  }
}