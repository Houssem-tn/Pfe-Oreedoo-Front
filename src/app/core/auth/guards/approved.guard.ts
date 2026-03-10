import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth.store';

export const approvedGuard: CanActivateFn = () => {
  const router = inject(Router);
  const store = inject(AuthStore);

  const status = store.status();

  // If status is absent in JWT/store, do not block here
  if (!status) return true;

  if (status === 'APPROVED') return true;

  return router.parseUrl('/login');
};