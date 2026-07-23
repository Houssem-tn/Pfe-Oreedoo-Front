import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { BreadcrumbRouterComponent, IBreadcrumbItem } from '@coreui/angular';
import { TranslocoService } from '@jsverse/transloco';
import { filter, map, startWith } from 'rxjs';

/**
 * Thin wrapper around CoreUI's <c-breadcrumb-router> that builds the
 * breadcrumb trail itself (same walk CoreUI's BreadcrumbRouterService does)
 * so it can read `data.titleKey` — a translation key — in preference to the
 * legacy `data.title` (kept for routes not yet migrated to a key; if that
 * raw string happens to match a real key it translates, otherwise it renders
 * unchanged since transloco.translate() returns unknown input untouched).
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [BreadcrumbRouterComponent],
  template: `<c-breadcrumb-router [items]="translatedBreadcrumbs()" />`
})
export class AppBreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  private readonly rawBreadcrumbs = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.buildBreadcrumbs())
    ),
    { initialValue: [] as IBreadcrumbItem[] }
  );

  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly translatedBreadcrumbs = computed<IBreadcrumbItem[]>(() => {
    this.activeLang();
    return this.rawBreadcrumbs().map(item => ({
      ...item,
      label: item.label ? this.transloco.translate(item.label) : item.label
    }));
  });

  private buildBreadcrumbs(): IBreadcrumbItem[] {
    const breadcrumbs: IBreadcrumbItem[] = [];
    const urlSegments: string[] = [];
    let currentSnapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;

    while (currentSnapshot) {
      const nextSnapshot = this.getPrimaryChild(currentSnapshot);
      if (!nextSnapshot) {
        break;
      }

      currentSnapshot = nextSnapshot;

      if (currentSnapshot.routeConfig?.redirectTo) {
        continue;
      }

      const segmentPaths = currentSnapshot.url
        .map(segment => segment.path)
        .filter((path): path is string => path.length > 0);

      if (segmentPaths.length > 0) {
        urlSegments.push(...segmentPaths);
      }

      const titleKey = currentSnapshot.data['titleKey'] as string | undefined;
      const title = currentSnapshot.data['title'] as string | undefined;
      const label = titleKey ?? title ?? currentSnapshot.title ?? '';

      if (!label) {
        continue;
      }

      breadcrumbs.push({
        label,
        url: urlSegments.length > 0 ? `/${urlSegments.join('/')}` : '/',
        queryParams: currentSnapshot.queryParams
      });
    }

    return breadcrumbs;
  }

  private getPrimaryChild(snapshot: ActivatedRouteSnapshot | null): ActivatedRouteSnapshot | null {
    if (!snapshot?.children?.length) {
      return null;
    }

    return snapshot.children.find(child => child.outlet === PRIMARY_OUTLET) ?? null;
  }
}
