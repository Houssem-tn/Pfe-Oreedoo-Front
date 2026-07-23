import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { TranslocoService } from '@jsverse/transloco';
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
import { TranslocoModule } from '@jsverse/transloco';

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
    NotificationToastStackComponent,
    TranslocoModule
  ]
})
export class DefaultLayoutComponent implements OnInit, OnDestroy {
  public navItems: INavData[] = [];

  private readonly store = inject(AuthStore);
  private readonly notificationStore = inject(NotificationStoreService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
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
    this.subscriptions.add(
      this.transloco.langChanges$.subscribe(() => this.refreshNavItems())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.notificationStore.destroy();
  }

  private refreshNavItems(): void {
    const rawItems = getNavByRole(
      this.store.role(),
      this.store.canCreateDpm(),
      this.store.canImportCoverage()
    );

    this.navItems = rawItems.map(item => ({
      ...item,
      name: item.name ? this.transloco.translate(item.name) : item.name
    }));
  }
}
