import { Injectable, inject, signal, computed } from '@angular/core';
import { Subscription } from 'rxjs';

import { NotificationApiService } from './notification-api.service';
import { NotificationWsService } from './notification-ws.service';
import { NotificationItem } from './models/notification.model';
import { AuthStore } from '../auth/auth.store';

@Injectable({ providedIn: 'root' })
export class NotificationStoreService {
  private readonly api = inject(NotificationApiService);
  private readonly ws = inject(NotificationWsService);
  private readonly authStore = inject(AuthStore);

  private wsSubscription: Subscription | null = null;

  private readonly _items = signal<NotificationItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _initialized = signal(false);

  readonly items = this._items.asReadonly();
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

    if (!this.authStore.isAuthenticated() || !this.authStore.role()) {
      return;
    }

    this._loading.set(true);

    this.api.getMyRoleNotifications().subscribe({
      next: (notifications) => {
        this._items.set(this.sortByDateDesc(notifications));
        this.bindRealtime();
        this.ws.connect();
        this._initialized.set(true);
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
    this._initialized.set(false);
    this._items.set([]);
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
        this._items.update(items => {
          const exists = items.some(item => item.id === incoming.id);

          if (exists) {
            return this.sortByDateDesc(
              items.map(item => item.id === incoming.id ? incoming : item)
            );
          }

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
}