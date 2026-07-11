import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { TokenService } from './token.service';
import { AuthStore } from './auth.store';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenService: TokenService;
  let store: AuthStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(TokenService);
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should attach the Authorization header when a token is present', () => {
    tokenService.set('my-jwt-token');

    http.get('/api/v1/cases').subscribe();

    const req = httpMock.expectOne('/api/v1/cases');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
    req.flush({});
  });

  it('should not attach an Authorization header when no token is present', () => {
    http.get('/api/v1/cases').subscribe();

    const req = httpMock.expectOne('/api/v1/cases');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should skip attaching the header for auth endpoints even with a token present', () => {
    tokenService.set('my-jwt-token');

    http.post('/api/v1/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should clear token/store and redirect to /login on a 401 response', () => {
    tokenService.set('my-jwt-token');
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT' } as any);
    spyOn(router, 'navigateByUrl');

    http.get('/api/v1/cases').subscribe({
      error: () => {
        // expected
      },
    });

    const req = httpMock.expectOne('/api/v1/cases');
    req.flush({ message: 'Session expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(tokenService.get()).toBeNull();
    expect(store.isAuthenticated()).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('should not touch token/store on a non-401 error (e.g. 500)', () => {
    tokenService.set('my-jwt-token');
    spyOn(router, 'navigateByUrl');

    http.get('/api/v1/cases').subscribe({
      error: () => {
        // expected
      },
    });

    const req = httpMock.expectOne('/api/v1/cases');
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    expect(tokenService.get()).toBe('my-jwt-token');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
