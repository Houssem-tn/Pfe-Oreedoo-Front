import { Injectable, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';
import { AuthStore } from '../auth/auth.store';
import { TokenService } from '../auth/token.service';
import { Role } from '../auth/models/roles.type';
import { NotificationItem } from './models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationWsService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tokenService = inject(TokenService);
  private readonly authStore = inject(AuthStore);

  private client: Client | null = null;
  private roleSubscription: StompSubscription | null = null;
  private userSubscription: StompSubscription | null = null;

  private readonly notificationSubject = new Subject<NotificationItem>();
  readonly notifications$ = this.notificationSubject.asObservable();

  connect(): void {
    const token = this.tokenService.get();
    const role = this.authStore.role();
    const email = this.authStore.user()?.email?.trim().toLowerCase();

    if (!token || !role || !email) {
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
      this.subscribeToTopics(role, email);
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
    this.roleSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.roleSubscription = null;
    this.userSubscription = null;

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
  }

  reconnectForCurrentRole(): void {
    this.disconnect();
    this.connect();
  }

  private subscribeToTopics(role: Role, email: string): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    this.roleSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();

    const roleTopic = this.buildRoleTopic(role);
    const userTopic = this.buildUserTopic(email);

    this.roleSubscription = this.client.subscribe(roleTopic, (message: IMessage) => {
      this.handleIncomingMessage(message);
    });

    this.userSubscription = this.client.subscribe(userTopic, (message: IMessage) => {
      this.handleIncomingMessage(message);
    });
  }

  private handleIncomingMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as NotificationItem;
      this.notificationSubject.next(payload);
    } catch (error) {
      console.error('[Notification WS] Failed to parse message', error, message.body);
    }
  }

  private buildRoleTopic(role: Role): string {
    return `/topic/notifications/${role}`;
  }

  private buildUserTopic(email: string): string {
    return `/topic/notifications/user/${email.trim().toLowerCase()}`;
  }
}