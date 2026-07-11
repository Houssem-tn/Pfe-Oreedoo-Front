import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { approvedGuard } from './approved.guard';
import { AuthStore } from '../auth.store';

describe('approvedGuard', () => {
  let store: AuthStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  function run() {
    return TestBed.runInInjectionContext(() => approvedGuard({} as any, {} as any));
  }

  it('should allow navigation when no status is present (not blocked)', () => {
    expect(run()).toBeTrue();
  });

  it('should allow navigation when status is APPROVED', () => {
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT', status: 'APPROVED' } as any);
    expect(run()).toBeTrue();
  });

  it('should redirect to /login when status is PENDING', () => {
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT', status: 'PENDING' } as any);
    expect(run()).toEqual(router.parseUrl('/login'));
  });

  it('should redirect to /login when status is REJECTED', () => {
    store.setUser({ email: 'stt@example.com', role: 'ROLE_STT', status: 'REJECTED' } as any);
    expect(run()).toEqual(router.parseUrl('/login'));
  });
});
