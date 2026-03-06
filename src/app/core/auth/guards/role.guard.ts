import { CanActivateFn, CanActivateChildFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { Role } from '../models/roles.type';

function checkRoles(route: ActivatedRouteSnapshot): true | ReturnType<Router['parseUrl']> {
  const router = inject(Router);
  const auth = inject(AuthService);

  // roles can be defined on current route OR parent route
  const allowed =
    (route.data?.['roles'] as Role[] | undefined) ??
    (route.parent?.data?.['roles'] as Role[] | undefined) ??
    [];

  if (!allowed.length) return true;

  if (auth.hasRole(allowed)) return true;

  // choose your default "forbidden" landing
  return router.parseUrl('/dashboard');
}

export const roleGuard: CanActivateFn = (route) => checkRoles(route);
export const roleChildGuard: CanActivateChildFn = (childRoute) => checkRoles(childRoute);