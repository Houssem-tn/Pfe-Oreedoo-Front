import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { IconDirective } from '@coreui/icons-angular';

import { NotificationItem } from './models/notification.model';
import { NotificationStoreService } from './notification-store.service';

@Component({
  selector: 'app-notification-toast-stack',
  standalone: true,
  imports: [CommonModule, DatePipe, IconDirective],
  template: `
    <section class="notification-toast-stack" *ngIf="alerts().length > 0" aria-live="polite" aria-label="Operational alerts">
      <article class="notification-toast" [ngClass]="toastClass(alert)" *ngFor="let alert of alerts(); trackBy: trackById">
        <div class="notification-toast__header">
          <div class="d-flex align-items-center gap-2">
            <span class="notification-toast__icon"><svg cIcon [name]="iconName(alert)"></svg></span>
            <div class="notification-toast__title">{{ alert.title }}</div>
          </div>
          <button type="button" class="btn-close" aria-label="Dismiss" (click)="dismiss(alert.id)"></button>
        </div>

        <div class="notification-toast__message">{{ alert.message }}</div>

        <div class="notification-toast__footer">
          <span class="x-small text-body-secondary">{{ alert.createdAt | date:'shortTime' }}</span>
          <button class="btn btn-sm btn-link p-0 text-decoration-none" *ngIf="!alert.read" (click)="markAsRead(alert)">
            Mark as read
          </button>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .notification-toast-stack {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        display: grid;
        gap: 0.6rem;
        width: min(380px, calc(100vw - 2rem));
        z-index: 1080;
      }

      .notification-toast {
        border-radius: 0.8rem;
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: #fff;
        box-shadow: 0 0.8rem 1.5rem rgba(15, 23, 42, 0.16);
        padding: 0.7rem 0.75rem;
      }

      .notification-toast--warning {
        border-left: 4px solid #f9b115;
      }

      .notification-toast--danger {
        border-left: 4px solid #e55353;
      }

      .notification-toast--assignment {
        border-left: 4px solid #0d6efd;
      }

      .notification-toast__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .notification-toast__icon {
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 0.4rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.06);
      }

      .notification-toast__title {
        font-size: 0.9rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .notification-toast__message {
        font-size: 0.8rem;
        color: var(--cui-secondary-color);
        margin: 0.4rem 0 0.55rem;
      }

      .notification-toast__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      @media (max-width: 576px) {
        .notification-toast-stack {
          left: 0.75rem;
          right: 0.75rem;
          bottom: 0.75rem;
          width: auto;
        }
      }
    `
  ]
})
export class NotificationToastStackComponent {
  private readonly store = inject(NotificationStoreService);

  readonly alerts = this.store.ephemeralAlerts;

  trackById(_: number, item: NotificationItem): string {
    return item.id;
  }

  dismiss(notificationId: string): void {
    this.store.dismissEphemeralAlert(notificationId);
  }

  markAsRead(item: NotificationItem): void {
    if (!item.read) {
      this.store.markAsRead(item.id);
    }
    this.dismiss(item.id);
  }

  iconName(item: NotificationItem): string {
    switch (item.eventType) {
      case 'SLA_WARNING':
        return 'cilWarning';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
        return 'cilBan';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':
        return 'cilTask';
      default:
        return 'cilBell';
    }
  }

  toastClass(item: NotificationItem): string {
    switch (item.eventType) {
      case 'SLA_WARNING':
        return 'notification-toast--warning';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
        return 'notification-toast--danger';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':
        return 'notification-toast--assignment';
      default:
        return '';
    }
  }
}
