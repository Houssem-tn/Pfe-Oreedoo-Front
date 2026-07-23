import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthUser } from '../../core/auth/models/auth.models';
import { NotificationItem } from '../../core/notifications/models/notification.model';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { NotificationToastStackComponent } from '../../core/notifications/notification-toast-stack.component';
import { UserService } from '../../core/users/user.service';
import { LanguageSelectorComponent } from '../../shared/language-selector/language-selector.component';

interface FieldNavItem {
  labelKey: string;
  icon: string;
  path: 'home' | 'tasks' | 'history' | 'profile' | 'stock/my-stock';
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
    NotificationToastStackComponent,
    TranslocoModule,
    LanguageSelectorComponent
  ],
  templateUrl: './field-layout.component.html'
})
export class FieldLayoutComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationStoreService);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly transloco = inject(TranslocoService);
  private readonly subscriptions = new Subscription();

  navBase = '/tech';
  notificationsOpen = false;

  readonly techNavItems: FieldNavItem[] = [
    { labelKey: 'field.home', icon: 'cilHome', path: 'home', exact: true },
    { labelKey: 'field.tasks', icon: 'cilTask', path: 'tasks', exact: false },
    { labelKey: 'field.myStock', icon: 'cilStorage', path: 'stock/my-stock', exact: false },
    { labelKey: 'field.history', icon: 'cilClock', path: 'history', exact: true },
    { labelKey: 'field.profile', icon: 'cilUser', path: 'profile', exact: true }
  ];

  readonly sttNavItems: FieldNavItem[] = [
    { labelKey: 'field.home', icon: 'cilHome', path: 'home', exact: true },
    { labelKey: 'field.tasks', icon: 'cilTask', path: 'tasks', exact: false },
    { labelKey: 'field.history', icon: 'cilClock', path: 'history', exact: true },
    { labelKey: 'field.profile', icon: 'cilUser', path: 'profile', exact: true }
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
    return user?.fullName?.trim() || user?.username?.trim() || user?.email?.split('@')[0]
      || this.transloco.translate('field.fieldUser');
  }

  get roleLabel(): string {
    return this.transloco.translate(this.navBase.startsWith('/stt') ? 'field.roleSttExecution' : 'field.roleTechField');
  }

  get navItems(): FieldNavItem[] {
    return this.navBase.startsWith('/stt') ? this.sttNavItems : this.techNavItems;
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
