import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { roleGuard, roleChildGuard } from './role.guard';
import { AuthStore } from '../auth.store';
import { API_BASE_URL } from '../../http/api.config';
import { NotificationStoreService } from '../../notifications/notification-store.service';

describe('roleGuard / roleChildGuard', () => {
  let store: AuthStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        { provide: NotificationStoreService, useValue: jasmine.createSpyObj('NotificationStoreService', ['init', 'destroy']) },
      ],
    });

    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  function routeWithRoles(roles: string[] | undefined, parentRoles?: string[]) {
    return {
      data: roles ? { roles } : {},
      parent: parentRoles ? { data: { roles: parentRoles } } : undefined,
    } as any;
  }

  it('should allow navigation when the route declares no role restriction', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard(routeWithRoles(undefined), {} as any));
    expect(result).toBeTrue();
  });

  it('should allow navigation when the current user has one of the allowed roles', () => {
    store.setUser({ email: 'admin@example.com', role: 'ROLE_ADMIN' } as any);

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['ROLE_ADMIN', 'ROLE_ZM']), {} as any)
    );
    expect(result).toBeTrue();
  });

  it('should redirect to /dashboard when the current user lacks the required role', () => {
    store.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);

    const result = TestBed.runInInjectionContext(() => roleGuard(routeWithRoles(['ROLE_ADMIN']), {} as any));
    expect(result).toEqual(router.parseUrl('/dashboard'));
  });

  it('should fall back to the parent route roles when the child route declares none', () => {
    store.setUser({ email: 'zm@example.com', role: 'ROLE_ZM' } as any);

    const result = TestBed.runInInjectionContext(() =>
      roleChildGuard(routeWithRoles(undefined, ['ROLE_ZM']), {} as any)
    );
    expect(result).toBeTrue();
  });

  it('should redirect via roleChildGuard when neither child nor parent role matches', () => {
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT' } as any);

    const result = TestBed.runInInjectionContext(() =>
      roleChildGuard(routeWithRoles(undefined, ['ROLE_ZM']), {} as any)
    );
    expect(result).toEqual(router.parseUrl('/dashboard'));
  });
});
