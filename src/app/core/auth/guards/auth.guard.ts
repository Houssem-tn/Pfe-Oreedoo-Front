import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth.store';
import { TokenService } from '../token.service';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  const token = tokenService.get();

  // No token at all
  if (!token) {
    return router.parseUrl('/auth/login');
  }

  // Store not initialized yet (page refresh case)
  if (!store.isAuthenticated()) {
    return router.parseUrl('/auth/login');
  }

  return true;
};