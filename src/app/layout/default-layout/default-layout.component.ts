import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective,
  INavData
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { getNavByRole } from './__nav';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationStoreService } from '../../core/notifications/notification-store.service';
import { NotificationToastStackComponent } from '../../core/notifications/notification-toast-stack.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective,
    NotificationToastStackComponent
  ]
})
export class DefaultLayoutComponent implements OnInit, OnDestroy {
  public navItems: INavData[] = [];

  private readonly store = inject(AuthStore);
  private readonly notificationStore = inject(NotificationStoreService);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();

  constructor() {
    effect(() => {
      this.refreshNavItems();
    });
  }

  ngOnInit(): void {
    this.notificationStore.init();
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          this.refreshNavItems();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.notificationStore.destroy();
  }

  private refreshNavItems(): void {
    this.navItems = getNavByRole(this.store.role());
  }
}
