import { Injectable, inject, signal, computed } from '@angular/core';
import { Subscription } from 'rxjs';

import { NotificationApiService } from './notification-api.service';
import { NotificationWsService } from './notification-ws.service';
import { NotificationItem } from './models/notification.model';
import { AuthStore } from '../auth/auth.store';

@Injectable({ providedIn: 'root' })
export class NotificationStoreService {
  private static readonly POPUP_TTL_MS = 8000;
  private static readonly POPUP_LIMIT = 4;

  private readonly api = inject(NotificationApiService);
  private readonly ws = inject(NotificationWsService);
  private readonly authStore = inject(AuthStore);

  private wsSubscription: Subscription | null = null;
  private readonly popupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly _items = signal<NotificationItem[]>([]);
  private readonly _ephemeralAlerts = signal<NotificationItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _initialized = signal(false);

  readonly items = this._items.asReadonly();
  readonly ephemeralAlerts = this._ephemeralAlerts.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  readonly unreadCount = computed(() =>
    this._items().filter(n => !n.read).length
  );

  readonly latestFirst = computed(() =>
    [...this._items()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );

  init(): void {
    if (this._initialized()) {
      return;
    }

    const isAuthenticated = this.authStore.isAuthenticated();
    const role = this.authStore.role();
    const email = this.authStore.user()?.email;

    if (!isAuthenticated || !role || !email) {
      return;
    }

    this._initialized.set(true);
    this._loading.set(true);

    // bind realtime first
    this.bindRealtime();

    // connect websocket first so we do not miss fresh notifications
    this.ws.connect();

    // then load initial list from REST
    this.api.getMyRoleNotifications().subscribe({
      next: (notifications) => {
        this._items.set(this.sortByDateDesc(notifications));
        this._loading.set(false);
      },
      error: (error) => {
        console.error('[Notification Store] Failed to load notifications', error);
        this._loading.set(false);
      }
    });
  }

  destroy(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    this.ws.disconnect();
    this.clearEphemeralAlerts();
    this._initialized.set(false);
    this._items.set([]);
    this._loading.set(false);
  }

  dismissEphemeralAlert(notificationId: string): void {
    if (!notificationId) {
      return;
    }

    this.clearPopupTimer(notificationId);
    this._ephemeralAlerts.update(items => items.filter(item => item.id !== notificationId));
  }

  refresh(): void {
    this.api.getMyRoleNotifications().subscribe({
      next: (notifications) => {
        this._items.set(this.sortByDateDesc(notifications));
      },
      error: (error) => {
        console.error('[Notification Store] Failed to refresh notifications', error);
      }
    });
  }

  markAsRead(notificationId: string): void {
    if (!notificationId) {
      return;
    }

    const current = this._items();
    const target = current.find(n => n.id === notificationId);

    if (!target || target.read) {
      return;
    }

    this.api.markAsRead(notificationId).subscribe({
      next: (updated) => {
        this._items.update(items =>
          this.sortByDateDesc(
            items.map(item => item.id === updated.id ? updated : item)
          )
        );
      },
      error: (error) => {
        console.error('[Notification Store] Failed to mark notification as read', error);
      }
    });
  }

  markAllAsRead(): void {
    if (this.unreadCount() === 0) {
      return;
    }

    this.api.markAllAsRead().subscribe({
      next: (updatedItems) => {
        this._items.set(this.sortByDateDesc(updatedItems));
      },
      error: (error) => {
        console.error('[Notification Store] Failed to mark all as read', error);
      }
    });
  }

  private bindRealtime(): void {
    if (this.wsSubscription) {
      return;
    }

    this.wsSubscription = this.ws.notifications$.subscribe({
      next: (incoming) => {
        console.log('[Notification Store] Realtime notification received:', incoming);

        this._items.update(items => {
          const exists = items.some(item => item.id === incoming.id);

          if (exists) {
            return this.sortByDateDesc(
              items.map(item => item.id === incoming.id ? incoming : item)
            );
          }

          this.pushEphemeralAlert(incoming);
          return this.sortByDateDesc([incoming, ...items]);
        });
      },
      error: (error) => {
        console.error('[Notification Store] Realtime stream error', error);
      }
    });
  }

  private sortByDateDesc(items: NotificationItem[]): NotificationItem[] {
    return [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private pushEphemeralAlert(item: NotificationItem): void {
    if (!this.isOperationalAlert(item)) {
      return;
    }

    this._ephemeralAlerts.update((alerts) => {
      const deduped = alerts.filter(alert => alert.id !== item.id);
      const next = [item, ...deduped].slice(0, NotificationStoreService.POPUP_LIMIT);
      return this.sortByDateDesc(next);
    });

    this.clearPopupTimer(item.id);
    const timer = setTimeout(() => {
      this._ephemeralAlerts.update(alerts => alerts.filter(alert => alert.id !== item.id));
      this.clearPopupTimer(item.id);
    }, NotificationStoreService.POPUP_TTL_MS);

    this.popupTimers.set(item.id, timer);
  }

  private isOperationalAlert(item: NotificationItem): boolean {
    return item.eventType === 'SLA_WARNING'
      || item.eventType === 'SLA_BREACHED'
      || item.eventType === 'SLA_ESCALATED'
      || item.eventType === 'CASE_ASSIGNED_TO_TECH'
      || item.eventType === 'CASE_ASSIGNED_TO_STT'
      || item.eventType === 'CASE_ASSIGNED_TO_ZM';
  }

  private clearPopupTimer(notificationId: string): void {
    const timer = this.popupTimers.get(notificationId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.popupTimers.delete(notificationId);
  }

  private clearEphemeralAlerts(): void {
    this.popupTimers.forEach(timer => clearTimeout(timer));
    this.popupTimers.clear();
    this._ephemeralAlerts.set([]);
  }
}
