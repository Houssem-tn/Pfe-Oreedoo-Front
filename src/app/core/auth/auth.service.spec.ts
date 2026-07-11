import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { TokenService } from './token.service';
import { API_BASE_URL } from '../http/api.config';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { makeFakeJwt } from './testing/jwt-test-helper';

describe('AuthService', () => {
  let service: AuthService;
  let store: AuthStore;
  let tokenService: TokenService;
  let httpMock: HttpTestingController;
  let notificationStoreSpy: jasmine.SpyObj<NotificationStoreService>;

  beforeEach(() => {
    localStorage.clear();
    notificationStoreSpy = jasmine.createSpyObj('NotificationStoreService', ['init', 'destroy']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        { provide: NotificationStoreService, useValue: notificationStoreSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    store = TestBed.inject(AuthStore);
    tokenService = TestBed.inject(TokenService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('login() should store the token, populate AuthStore from the JWT, and (re)start the notification store', () => {
    const token = makeFakeJwt({ sub: 'stt@example.com', role: 'ROLE_STT' });

    let completed = false;
    service.login({ email: 'stt@example.com', password: 'pw' }).subscribe(() => (completed = true));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/v1/auth/login'));
    req.flush({ accessToken: token, role: 'ROLE_STT', user: { id: 'u1', email: 'stt@example.com', fullName: 'STT One' } });

    expect(completed).toBeTrue();
    expect(tokenService.get()).toBe(token);
    expect(store.isAuthenticated()).toBeTrue();
    expect(store.role()).toBe('ROLE_STT');
    expect(notificationStoreSpy.destroy).toHaveBeenCalled();
    expect(notificationStoreSpy.init).toHaveBeenCalled();
  });

  it('login() should error when the response has no token', (done) => {
    service.login({ email: 'stt@example.com', password: 'pw' }).subscribe({
      next: () => fail('expected an error'),
      error: (err) => {
        expect(err.message).toContain('Token missing in login response');
        expect(store.isAuthenticated()).toBeFalse();
        done();
      },
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/v1/auth/login'));
    req.flush({ user: { email: 'stt@example.com' } }); // no accessToken/token field
  });

  it('login() should propagate an HTTP error from the backend without swallowing it', (done) => {
    service.login({ email: 'stt@example.com', password: 'wrong' }).subscribe({
      next: () => fail('expected an error'),
      error: (err) => {
        expect(err.status).toBe(400);
        done();
      },
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/v1/auth/login'));
    req.flush({ message: 'Invalid credentials' }, { status: 400, statusText: 'Bad Request' });
  });

  it('logout() should clear the token, cached user, notification store, and AuthStore', () => {
    const token = makeFakeJwt({ sub: 'zm@example.com', role: 'ROLE_ZM' });
    tokenService.set(token);
    store.setUser({ email: 'zm@example.com', role: 'ROLE_ZM' } as any);

    service.logout();

    expect(tokenService.get()).toBeNull();
    expect(store.isAuthenticated()).toBeFalse();
    expect(notificationStoreSpy.destroy).toHaveBeenCalled();
  });

  it('hasRole() should reflect the current AuthStore role', () => {
    store.setUser({ email: 'tech@example.com', role: 'ROLE_TECH' } as any);

    expect(service.hasRole('ROLE_TECH')).toBeTrue();
    expect(service.hasRole(['ROLE_ADMIN', 'ROLE_TECH'])).toBeTrue();
    expect(service.hasRole('ROLE_ADMIN')).toBeFalse();
  });

  it('hasRole() should return false when nobody is logged in', () => {
    expect(service.hasRole('ROLE_ADMIN')).toBeFalse();
  });

  it('initFromStorage() should log out when the stored token is expired', () => {
    const expiredToken = makeFakeJwt({ sub: 'stt@example.com', role: 'ROLE_STT', exp: 1 });
    tokenService.set(expiredToken);

    service.initFromStorage();

    expect(tokenService.get()).toBeNull();
    expect(store.isAuthenticated()).toBeFalse();
  });

  it('initFromStorage() should rebuild AuthStore from a valid stored token', () => {
    const token = makeFakeJwt({ sub: 'admin@example.com', role: 'ROLE_ADMIN' });
    tokenService.set(token);

    service.initFromStorage();

    expect(store.isAuthenticated()).toBeTrue();
    expect(store.role()).toBe('ROLE_ADMIN');
    expect(notificationStoreSpy.init).toHaveBeenCalled();
  });
});
