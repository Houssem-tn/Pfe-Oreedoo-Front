import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthUser } from '../../core/auth/models/auth.models';
import { NotificationItem } from '../../core/notifications/models/notification.model';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { NotificationToastStackComponent } from '../../core/notifications/notification-toast-stack.component';
import { UserService } from '../../core/users/user.service';

interface FieldNavItem {
  label: string;
  icon: string;
  path: 'home' | 'tasks' | 'history' | 'profile';
  exact: boolean;
}

@Component({
  selector: 'app-field-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconDirective,
    NotificationToastStackComponent
  ],
  templateUrl: './field-layout.component.html'
})
export class FieldLayoutComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationStoreService);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly subscriptions = new Subscription();

  navBase = '/tech';
  notificationsOpen = false;

  readonly navItems: FieldNavItem[] = [
    { label: 'Home', icon: 'cilHome', path: 'home', exact: true },
    { label: 'Tasks', icon: 'cilTask', path: 'tasks', exact: false },
    { label: 'History', icon: 'cilClock', path: 'history', exact: true },
    { label: 'Profile', icon: 'cilUser', path: 'profile', exact: true }
  ];

  ngOnInit(): void {
    this.notifications.init();
    this.syncNavBase();
    this.loadCurrentUserProfile();

    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.syncNavBase())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.notifications.destroy();
  }

  get userName(): string {
    const user = this.authStore.user();
    return user?.fullName?.trim() || user?.username?.trim() || user?.email?.split('@')[0] || 'Field user';
  }

  get roleLabel(): string {
    return this.navBase.startsWith('/stt') ? 'STT execution' : 'TECH field';
  }

  linkFor(path: FieldNavItem['path']): string {
    return `${this.navBase}/${path}`;
  }

  get unreadCount(): number {
    return this.notifications.unreadCount();
  }

  get latestNotifications(): NotificationItem[] {
    return this.notifications.latestFirst().slice(0, 6);
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.notifications.refresh();
    }
  }

  markAllRead(): void {
    this.notifications.markAllAsRead();
  }

  openNotification(item: NotificationItem): void {
    this.notifications.markAsRead(item.id);
    this.notificationsOpen = false;

    const caseId = typeof item.data?.['caseId'] === 'string'
      ? item.data['caseId']
      : item.entityId;

    const isCaseNotification = item.entityType === 'CASE'
      || item.eventType.startsWith('CASE_')
      || item.eventType.startsWith('SLA_');

    if (caseId && isCaseNotification) {
      void this.router.navigateByUrl(`${this.navBase}/tasks/${caseId}`);
    }
  }

  logout(): void {
    this.notificationsOpen = false;
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  private syncNavBase(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    this.navBase = path.startsWith('/stt/cases/execution') ? '/stt/cases/execution' : '/tech';
  }

  private loadCurrentUserProfile(): void {
    this.subscriptions.add(
      this.userService.getMe().subscribe({
        next: (profile) => {
          const current = this.authStore.user();
          const role = (profile.role ?? current?.role) as AuthUser['role'] | undefined;

          if (!role) {
            return;
          }

          this.authStore.setUser({
            id: profile.id ?? current?.id,
            username: profile.fullName ?? current?.username,
            fullName: profile.fullName ?? current?.fullName,
            email: profile.email ?? current?.email,
            role,
            status: (profile.status ?? current?.status) as AuthUser['status']
          });
        },
        error: (error) => {
          console.warn('[FieldLayout] Unable to refresh profile for greeting', error);
        }
      })
    );
  }
}
