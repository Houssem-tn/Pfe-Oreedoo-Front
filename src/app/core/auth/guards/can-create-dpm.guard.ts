import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, catchError, of } from 'rxjs';
import { AuthStore } from '../auth.store';
import { UserService } from '../../users/user.service';

export const canCreateDpmGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const userService = inject(UserService);
  const router = inject(Router);

  const role = authStore.role();

  if (role === 'ROLE_ADMIN') return true;
  if (role !== 'ROLE_ZM') return router.parseUrl('/dashboard');

  // Fast path: already populated from a previous /me call
  if (authStore.canCreateDpm()) return true;

  // Slow path: fetch /me and check (first navigation after login)
  return userService.getMe().pipe(
    map(user => {
      const allowed = user.canCreateDpm === true;
      if (allowed) {
        authStore.patchCanCreateDpm(true);
        return true;
      }
      return router.parseUrl('/zm/stock/team-stock');
    }),
    catchError(() => of(router.parseUrl('/zm/stock/team-stock')))
  );
};
