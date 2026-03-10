import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth.store';
import { TokenService } from '../token.service';
import { isJwtExpired } from '../jwt.util';
import { AuthService } from '../auth.service';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = tokenService.get();

  if (!token) {
    return router.parseUrl('/login');
  }

  if (isJwtExpired(token)) {
    tokenService.clear();
    store.clear();
    return router.parseUrl('/login');
  }

  // Rebuild auth state on refresh if needed
  if (!store.isAuthenticated()) {
    authService.initFromStorage();
  }

  // Check again after init attempt
  if (!store.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  return true;
};