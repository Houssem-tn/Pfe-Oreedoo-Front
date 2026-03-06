import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth.store';

export const approvedGuard: CanActivateFn = () => {
  const router = inject(Router);
  const store = inject(AuthStore);

  const status = store.status();

  // If status is not present in JWT, don't block (backend is authority)
  if (!status) return true;

  if (status === 'APPROVED') return true;

  // If PENDING or REJECTED → block access
  return router.parseUrl('/auth/login');
};