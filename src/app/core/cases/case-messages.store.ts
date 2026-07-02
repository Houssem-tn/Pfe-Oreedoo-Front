import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { CaseMessagesService, CaseMessageUnreadSummary } from './case-messages.service';

/**
 * Unread case-discussion badge state for the current ZM/STT user.
 *
 * Refresh strategy (WebSocket-ready): a slow poll keeps the badge honest, and a
 * subscription to the realtime notification stream (CASE_MESSAGE_RECEIVED arrives
 * over the existing WS) triggers an immediate refresh, so the badge reacts in
 * near-real-time without a dedicated message socket yet.
 */
@Injectable({ providedIn: 'root' })
export class CaseMessagesStore {
  private static readonly POLL_MS = 60_000;

  private readonly api = inject(CaseMessagesService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationStore = inject(NotificationStoreService);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private realtimeSub: Subscription | null = null;
  private started = false;

  private readonly _summary = signal<CaseMessageUnreadSummary>({ totalUnread: 0, cases: [] });

  readonly summary = this._summary.asReadonly();
  readonly totalUnread = computed(() => this._summary().totalUnread);
  readonly caseUnreads = computed(() => this._summary().cases);

  /** Only ZM and STT participate in case discussions. */
  readonly enabled = computed(() => {
    const role = this.authStore.role();
    return role === 'ROLE_ZM' || role === 'ROLE_STT';
  });

  init(): void {
    if (this.started || !this.enabled()) {
      return;
    }
    this.started = true;
    this.refresh();

    // Instant badge: refresh the unread summary the moment a message push arrives
    // over the WebSocket (the slow poll below is just a safety net).
    this.realtimeSub = this.notificationStore.realtime$.subscribe((incoming) => {
      if (incoming?.eventType === 'CASE_MESSAGE_RECEIVED') {
        this.refresh();
      }
    });

    this.pollTimer = setInterval(() => this.refresh(), CaseMessagesStore.POLL_MS);
  }

  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = null;
    this.started = false;
    this._summary.set({ totalUnread: 0, cases: [] });
  }

  refresh(): void {
    if (!this.enabled()) {
      return;
    }
    this.api.getUnreadSummary().subscribe({
      next: (summary) => this._summary.set(summary ?? { totalUnread: 0, cases: [] }),
      error: (error) => console.error('[Case Messages Store] Failed to load unread summary', error)
    });
  }

  unreadForCase(caseId: string): number {
    return this._summary().cases.find(c => c.caseId === caseId)?.unreadCount ?? 0;
  }
}
