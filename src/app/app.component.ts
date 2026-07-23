import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, PRIMARY_OUTLET, Router, RouterOutlet } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { delay, filter, map, tap } from 'rxjs/operators';

import { ColorModeService } from '@coreui/angular';
import { IconSetService } from '@coreui/icons-angular';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { iconSubset } from './icons/icon-subset';

@Component({
  selector: 'app-root',
  template: '<router-outlet />',
  imports: [RouterOutlet]
})
export class AppComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly activatedRoute = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly titleService = inject(Title);
  readonly transloco = inject(TranslocoService);

  readonly colorModeService = inject(ColorModeService);
  readonly iconSetService = inject(IconSetService);

  readonly authService = inject(AuthService);
  readonly languageService = inject(LanguageService);

  constructor() {
    this.languageService.init();
    this.updateDocumentTitle();

    this.iconSetService.icons = { ...iconSubset };

    this.colorModeService.localStorageItemName.set('coreui-free-angular-admin-template-theme-default');
    this.colorModeService.eventName.set('ColorSchemeChange');

    this.authService.initFromStorage();
  }

  ngOnInit(): void {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.updateDocumentTitle();
        }
      });

    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateDocumentTitle());

    this.activatedRoute.queryParams
      .pipe(
        delay(1),
        map((params) => params['theme']?.match(/^[A-Za-z0-9\s]+/)?.[0] as string | undefined),
        filter((theme): theme is string => ['dark', 'light', 'auto'].includes(theme ?? '')),
        tap((theme) => {
          this.colorModeService.colorMode.set(theme);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private updateDocumentTitle(): void {
    const snapshot = this.deepestPrimaryRoute(this.router.routerState.snapshot.root);
    const titleKey = snapshot?.data?.['titleKey'] as string | undefined;
    const title = titleKey
      ? this.transloco.translate(titleKey)
      : this.transloco.translate('app.title');

    this.titleService.setTitle(title);
  }

  private deepestPrimaryRoute(snapshot: ActivatedRouteSnapshot | null): ActivatedRouteSnapshot | null {
    let current = snapshot;

    while (current) {
      const next = current.children.find((child) => child.outlet === PRIMARY_OUTLET) ?? null;
      if (!next) {
        return current;
      }
      current = next;
    }

    return null;
  }
}
