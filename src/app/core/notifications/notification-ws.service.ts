import { Injectable, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
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
      console.warn('[Notification WS] Missing token, role, or email. Connection skipped.');
      return;
    }

    if (this.client?.active || this.client?.connected) {
      console.log('[Notification WS] Already active/connected. Skipping reconnect.');
      return;
    }

    const brokerURL = this.buildWsUrl('/ws-notifications');
    console.log('[Notification WS] Connecting to:', brokerURL);
    console.log('[Notification WS] Role topic:', this.buildRoleTopic(role));
    console.log('[Notification WS] User topic:', this.buildUserTopic(email));

    this.client = new Client({
      brokerURL,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      debug: (msg: string) => {
        console.log('[Notification WS]', msg);
      }
    });

    this.client.onConnect = () => {
      console.log('[Notification WS] Connected successfully');
      this.subscribeToTopics(role, email);
    };

    this.client.onDisconnect = () => {
      console.log('[Notification WS] Disconnected');
    };

    this.client.onStompError = (frame) => {
      console.error('[Notification WS] Broker error:', frame.headers['message']);
      console.error('[Notification WS] Details:', frame.body);
    };

    this.client.onWebSocketClose = (event) => {
      console.warn('[Notification WS] WebSocket closed:', event);
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
      console.warn('[Notification WS] Cannot subscribe: client not connected');
      return;
    }

    this.roleSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();

    const roleTopic = this.buildRoleTopic(role);
    const userTopic = this.buildUserTopic(email);

    this.roleSubscription = this.client.subscribe(roleTopic, (message: IMessage) => {
      console.log('[Notification WS] Role message received:', message.body);
      this.handleIncomingMessage(message);
    });

    this.userSubscription = this.client.subscribe(userTopic, (message: IMessage) => {
      console.log('[Notification WS] User message received:', message.body);
      this.handleIncomingMessage(message);
    });

    console.log('[Notification WS] Subscribed to role topic:', roleTopic);
    console.log('[Notification WS] Subscribed to user topic:', userTopic);
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

  private buildWsUrl(path: string): string {
    const resolvedBaseUrl = this.baseUrl?.trim()
      ? this.baseUrl
      : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200');
    const httpUrl = new URL(resolvedBaseUrl);
    const protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${httpUrl.host}${path}`;
  }
}
