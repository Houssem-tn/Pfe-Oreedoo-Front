import { NgTemplateOutlet, DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { UserService } from '../../../core/users/user.service';
import { CasesService } from '../../../core/cases/cases.service';

import {
  AvatarComponent,
  BadgeComponent,
  BreadcrumbRouterComponent,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownHeaderDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  NavItemComponent,
  NavLinkDirective,
  SidebarToggleDirective
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';
import { NotificationStoreService } from '../../../core/notifications/notification-store.service';
import { NotificationItem } from '../../../core/notifications/models/notification.model';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  styleUrl: './default-header.component.scss',
  imports: [
    ContainerComponent,
    HeaderTogglerDirective,
    SidebarToggleDirective,
    IconDirective,
    HeaderNavComponent,
    NavItemComponent,
    NavLinkDirective,
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
    BreadcrumbRouterComponent,
    DropdownComponent,
    DropdownToggleDirective,
    AvatarComponent,
    DropdownMenuDirective,
    DropdownHeaderDirective,
    DropdownItemDirective,
    BadgeComponent,
    DropdownDividerDirective,
    DatePipe
  ]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit, OnDestroy {
  readonly #colorModeService = inject(ColorModeService);
  readonly notificationStore = inject(NotificationStoreService);
  readonly router = inject(Router);
  readonly authStore = inject(AuthStore);
  private readonly userService = inject(UserService);
  private readonly casesService = inject(CasesService);
  private readonly cdr = inject(ChangeDetectorRef);

  currentUserAvatarUrl: string | null = null;
  readonly defaultAvatarUrl = 'assets/images/avatars/1.jpg';
  activeTasksCount = 0;

  readonly colorMode = this.#colorModeService.colorMode;

  readonly colorModes = [
    { name: 'light', text: 'Light', icon: 'cilSun' },
    { name: 'dark', text: 'Dark', icon: 'cilMoon' },
    { name: 'auto', text: 'Auto', icon: 'cilContrast' }
  ];

  readonly icons = computed(() => {
    const currentMode = this.colorMode();
    return this.colorModes.find(mode => mode.name === currentMode)?.icon ?? 'cilSun';
  });

  readonly unreadCount = this.notificationStore.unreadCount;
  readonly notifications = this.notificationStore.latestFirst;

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.notificationStore.init();
    this.loadCurrentUserProfile();
    this.loadPerformanceSnapshot();
  }

  ngOnDestroy(): void {
    this.notificationStore.destroy();
  }

  sidebarId = input('sidebar1');

  private loadCurrentUserProfile(): void {
    this.userService.getMe().subscribe({
      next: (user) => {
        const nextAvatarUrl =
          user.profileThumbnailUrl ||
          user.profileImageUrl ||
          this.defaultAvatarUrl;

        this.authStore.patchCanCreateDpm(user.canCreateDpm ?? false);

        queueMicrotask(() => {
          this.currentUserAvatarUrl = nextAvatarUrl;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Failed to load current user profile', err);

        queueMicrotask(() => {
          this.currentUserAvatarUrl = this.defaultAvatarUrl;
          this.cdr.detectChanges();
        });
      }
    });
  }

  trackByNotificationId(_: number, item: NotificationItem): string {
    return item.id;
  }

  handleNotificationClick(notification: NotificationItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    this.markOneAsRead(notification, event);

    const role = this.authStore.role();
    const eventType = notification.eventType;

    // Stock alert → go to Alert Center
    if (eventType === 'STOCK_CRITICAL' || eventType === 'STOCK_LOW_WARNING') {
      this.router.navigate(['/alerts']);
      return;
    }

    // STT: permission request arrived
    if (eventType === 'STOCK_USAGE_PERMISSION_REQUIRED' && role === 'ROLE_STT') {
      this.router.navigate(['/stt/stock/usage-approvals']);
      return;
    }

    // TECH: permission was reviewed
    if ((eventType === 'STOCK_USAGE_PERMISSION_APPROVED' || eventType === 'STOCK_USAGE_PERMISSION_REJECTED') && role === 'ROLE_TECH') {
      this.router.navigate(['/tech/stock/my-permissions']);
      return;
    }

    if (eventType !== 'USER_REGISTERED') {
      const roleRoute = this.getCaseRouteForNotification(notification);

      if (roleRoute && this.isCaseEvent(notification.eventType)) {
        this.router.navigate([roleRoute]);
      }

      return;
    }

    if (role === 'ROLE_ADMIN') {
      this.router.navigate(['/admin/approvals']);
      return;
    }

    if (role === 'ROLE_ZM') {
      this.router.navigate(['/zm/approvals']);
      return;
    }

    if (role === 'ROLE_STT') {
      this.router.navigate(['/stt/approvals']);
    }
  }

  markOneAsRead(notification: NotificationItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (!notification.read) {
      this.notificationStore.markAsRead(notification.id);
    }
  }

  markAllAsRead(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.notificationStore.markAllAsRead();
  }

  getNotificationIcon(eventType?: string): string {
    switch (eventType) {
      case 'USER_REGISTERED':
        return 'cilUserFollow';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':
        return 'cilTask';
      case 'SLA_WARNING':
        return 'cilWarning';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
        return 'cilBan';
      case 'USER_APPROVED':
        return 'cilCheckCircle';
      case 'USER_REJECTED':
        return 'cilXCircle';
      case 'INTERVENTION_CREATED':
        return 'cilSettings';
      case 'INTERVENTION_ASSIGNED':
        return 'cilTask';
      case 'STOCK_ALERT':
      case 'STOCK_LOW_WARNING':
        return 'cilWarning';
      case 'STOCK_CRITICAL':
        return 'cilBan';
      case 'STOCK_USAGE_PERMISSION_REQUIRED':
        return 'cilStorage';
      case 'STOCK_USAGE_PERMISSION_APPROVED':
      case 'STOCK_USAGE_PERMISSION_PARTIALLY_APPROVED':
        return 'cilCheckCircle';
      case 'STOCK_USAGE_PERMISSION_REJECTED':
        return 'cilXCircle';
      default:
        return 'cilBell';
    }
  }

  getNotificationBadgeColor(eventType?: string): string {
    switch (eventType) {
      case 'USER_REGISTERED':
        return 'info';
      case 'CASE_ASSIGNED_TO_ZM':
      case 'CASE_ASSIGNED_TO_STT':
      case 'CASE_ASSIGNED_TO_TECH':
        return 'primary';
      case 'SLA_WARNING':
        return 'warning';
      case 'SLA_BREACHED':
      case 'SLA_ESCALATED':
        return 'danger';
      case 'USER_APPROVED':
        return 'success';
      case 'USER_REJECTED':
        return 'danger';
      case 'INTERVENTION_CREATED':
        return 'primary';
      case 'INTERVENTION_ASSIGNED':
        return 'warning';
      case 'STOCK_ALERT':
      case 'STOCK_CRITICAL':
        return 'danger';
      case 'STOCK_LOW_WARNING':
        return 'warning';
      case 'STOCK_USAGE_PERMISSION_REQUIRED':
        return 'warning';
      case 'STOCK_USAGE_PERMISSION_APPROVED':
      case 'STOCK_USAGE_PERMISSION_PARTIALLY_APPROVED':
        return 'success';
      case 'STOCK_USAGE_PERMISSION_REJECTED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  private loadPerformanceSnapshot(): void {
    forkJoin([
      this.casesService.getMyPerformance('ACTIVATION'),
      this.casesService.getMyPerformance('PLAINTE')
    ]).subscribe({
      next: ([activationSummary, complaintSummary]) => {
        this.activeTasksCount = (activationSummary.activeTasksCount ?? 0) + (complaintSummary.activeTasksCount ?? 0);
        this.cdr.detectChanges();
      },
      error: () => {
        this.activeTasksCount = 0;
      }
    });
  }

  private isCaseEvent(eventType?: string): boolean {
    if (!eventType) return false;
    return eventType === 'CASE_ASSIGNED_TO_ZM'
      || eventType === 'CASE_ASSIGNED_TO_STT'
      || eventType === 'CASE_ASSIGNED_TO_TECH'
      || eventType === 'SLA_WARNING'
      || eventType === 'SLA_BREACHED'
      || eventType === 'SLA_ESCALATED';
  }

  private getCaseListRouteByRole(): string | null {
    const role = this.authStore.role();

    switch (role) {
      case 'ROLE_ADMIN':
        return '/admin/cases/activation';
      case 'ROLE_ZM':
        return '/zm/cases/activation';
      case 'ROLE_STT':
        return '/stt/cases/activation';
      case 'ROLE_TECH':
        return '/tech/cases/activation';
      default:
        return null;
    }
  }

  private getCaseRouteForNotification(notification: NotificationItem): string | null {
    const caseType = typeof notification.data?.['caseType'] === 'string'
      ? notification.data['caseType'].trim().toUpperCase()
      : '';

    if (caseType === 'PLAINTE') {
      const role = this.authStore.role();
      switch (role) {
        case 'ROLE_ADMIN':
          return '/admin/cases/complaint';
        case 'ROLE_ZM':
          return '/zm/cases/complaint';
        case 'ROLE_STT':
          return '/stt/cases/complaint';
        case 'ROLE_TECH':
          return '/tech/cases/complaint';
        default:
          return this.getCaseListRouteByRole();
      }
    }

    return this.getCaseListRouteByRole();
  }

  public newMessages = [
    {
      id: 0,
      from: 'Jessica Williams',
      avatar: '7.jpg',
      status: 'success',
      title: 'Urgent: System Maintenance Tonight',
      time: 'Just now',
      link: 'apps/email/inbox/message',
      message: 'Attention team, we\'ll be conducting critical system maintenance tonight from 10 PM to 2 AM. Plan accordingly...'
    },
    {
      id: 1,
      from: 'Richard Johnson',
      avatar: '6.jpg',
      status: 'warning',
      title: 'Project Update: Milestone Achieved',
      time: '5 minutes ago',
      link: 'apps/email/inbox/message',
      message: 'Kudos on hitting sales targets last quarter! Let\'s keep the momentum. New goals, new victories ahead...'
    },
    {
      id: 2,
      from: 'Angela Rodriguez',
      avatar: '5.jpg',
      status: 'danger',
      title: 'Social Media Campaign Launch',
      time: '1:52 PM',
      link: 'apps/email/inbox/message',
      message: 'Exciting news! Our new social media campaign goes live tomorrow. Brace yourselves for engagement...'
    },
    {
      id: 3,
      from: 'Jane Lewis',
      avatar: '4.jpg',
      status: 'info',
      title: 'Inventory Checkpoint',
      time: '4:03 AM',
      link: 'apps/email/inbox/message',
      message: 'Team, it\'s time for our monthly inventory check. Accurate counts ensure smooth operations. Let\'s nail it...'
    },
    {
      id: 4,
      from: 'Ryan Miller',
      avatar: '3.jpg',
      status: 'info',
      title: 'Customer Feedback Results',
      time: '3 days ago',
      link: 'apps/email/inbox/message',
      message: 'Our latest customer feedback is in. Let\'s analyze and discuss improvements for an even better service...'
    }
  ];

  public newNotifications = [
    { id: 0, title: 'New user registered', icon: 'cilUserFollow', color: 'success' },
    { id: 1, title: 'User deleted', icon: 'cilUserUnfollow', color: 'danger' },
    { id: 2, title: 'Sales report is ready', icon: 'cilChartPie', color: 'info' },
    { id: 3, title: 'New client', icon: 'cilBasket', color: 'primary' },
    { id: 4, title: 'Server overloaded', icon: 'cilSpeedometer', color: 'warning' }
  ];

  public newStatus = [
    { id: 0, title: 'CPU Usage', value: 25, color: 'info', details: '348 Processes. 1/4 Cores.' },
    { id: 1, title: 'Memory Usage', value: 70, color: 'warning', details: '11444GB/16384MB' },
    { id: 2, title: 'SSD 1 Usage', value: 90, color: 'danger', details: '243GB/256GB' }
  ];

  public newTasks = [
    { id: 0, title: 'Upgrade NPM', value: 0, color: 'info' },
    { id: 1, title: 'ReactJS Version', value: 25, color: 'danger' },
    { id: 2, title: 'VueJS Version', value: 50, color: 'warning' },
    { id: 3, title: 'Add new layouts', value: 75, color: 'info' },
    { id: 4, title: 'Angular Version', value: 100, color: 'success' }
  ];
}
