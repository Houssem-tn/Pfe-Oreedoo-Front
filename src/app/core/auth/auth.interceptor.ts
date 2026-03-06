import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { TokenService } from './token.service';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const token = tokenService.get();

  // Skip auth endpoints
  if (req.url.includes('/api/v1/auth/')) {
    return next(req);
  }

  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      // If backend returns 401 (invalid/expired token)
      if (error.status === 401) {
        tokenService.clear();
        authStore.clear();
        router.navigateByUrl('/pages/login'); // adapt if your login route differs
      }
      return throwError(() => error);
    })
  );
};