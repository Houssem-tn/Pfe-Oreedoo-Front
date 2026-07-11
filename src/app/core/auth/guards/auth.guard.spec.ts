import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { authGuard } from './auth.guard';
import { AuthStore } from '../auth.store';
import { TokenService } from '../token.service';
import { API_BASE_URL } from '../../http/api.config';
import { NotificationStoreService } from '../../notifications/notification-store.service';
import { makeFakeJwt } from '../testing/jwt-test-helper';

describe('authGuard', () => {
  let store: AuthStore;
  let tokenService: TokenService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        { provide: NotificationStoreService, useValue: jasmine.createSpyObj('NotificationStoreService', ['init', 'destroy']) },
      ],
    });

    store = TestBed.inject(AuthStore);
    tokenService = TestBed.inject(TokenService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  function runGuard() {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
  }

  it('should redirect to /login when there is no token', () => {
    const result = runGuard();
    expect(result).toEqual(router.parseUrl('/login'));
  });

  it('should clear state and redirect to /login when the token is expired', () => {
    tokenService.set(makeFakeJwt({ sub: 'stt@example.com', role: 'ROLE_STT', exp: 1 }));
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT' } as any);

    const result = runGuard();

    expect(result).toEqual(router.parseUrl('/login'));
    expect(tokenService.get()).toBeNull();
    expect(store.isAuthenticated()).toBeFalse();
  });

  it('should allow navigation when the store is already authenticated with a valid token', () => {
    const token = makeFakeJwt({ sub: 'stt@example.com', role: 'ROLE_STT' });
    tokenService.set(token);
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT' } as any);

    expect(runGuard()).toBeTrue();
  });

  it('should rebuild the store from a valid token on refresh (store not yet authenticated)', () => {
    const token = makeFakeJwt({ sub: 'zm@example.com', role: 'ROLE_ZM' });
    tokenService.set(token);
    // store starts empty (simulates a page refresh)

    expect(runGuard()).toBeTrue();
    expect(store.isAuthenticated()).toBeTrue();
  });
});
