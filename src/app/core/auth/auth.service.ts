import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../http/api.config';
import { TokenService } from './token.service';
import { AuthStore } from './auth.store';
import { NotificationStoreService } from '../notifications/notification-store.service';
import {
  AuthResponse,
  JwtClaims,
  LoginRequest,
  RegisterRequest,
  AuthUser,
} from './models/auth.models';
import { Role } from './models/roles.type';
import { decodeJwt, isJwtExpired } from './jwt.util';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { TechInvitationValidationResponse } from './models/tech-invitation-validation-response.model';
import { TechRegisterRequest } from './models/tech-register-request.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tokenService = inject(TokenService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationStore = inject(NotificationStoreService);

  initFromStorage(): void {
    const token = this.tokenService.get();
    if (!token || isJwtExpired(token)) {
      this.logout();
      return;
    }

    const user = this.userFromToken(token);
    this.authStore.setUser(user);

    if (user) {
      this.notificationStore.init();
    }
  }

  login(body: LoginRequest): Observable<void> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/v1/auth/login`, body)
      .pipe(
        tap((res: any) => {
          const token = res?.accessToken ?? res?.token;
          if (!token) throw new Error('Token missing in login response');

          this.tokenService.set(token);

          const user = this.userFromToken(token);
          this.authStore.setUser(user);

          if (user) {
            this.notificationStore.destroy();
            this.notificationStore.init();
          }
        }),
        map(() => void 0)
      );
  }

  register(body: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/v1/auth/register`, body);
  }

  validateTechInvitation(token: string): Observable<TechInvitationValidationResponse> {
    return this.http.get<TechInvitationValidationResponse>(
      `${this.baseUrl}/api/v1/tech-invitations/validate?token=${encodeURIComponent(token)}`
    );
  }

  registerTechInvitation(body: TechRegisterRequest): Observable<void> {
    return this.http
      .post<any>(`${this.baseUrl}/api/v1/auth/register-tech-by-invitation`, body)
      .pipe(map(() => void 0));
  }

  logout(): void {
    this.notificationStore.destroy();
    this.tokenService.clear();
    this.authStore.clear();
  }

  get token(): string | null {
    return this.tokenService.get();
  }

  hasRole(roles: Role[] | Role): boolean {
    const needed = Array.isArray(roles) ? roles : [roles];
    const current = this.authStore.role();
    return !!current && needed.includes(current);
  }

  isApproved(): boolean {
    return this.authStore.status() === 'APPROVED';
  }

  private userFromToken(token: string): AuthUser | null {
    const claims = decodeJwt<JwtClaims>(token);
    if (!claims) return null;

    const role = this.extractRole(claims);
    if (!role) return null;

    return {
      username: claims.sub,
      email: claims.sub,
      role,
      status: (claims as any).status ?? (claims as any).accountStatus,
    };
  }

  private extractRole(claims: JwtClaims): Role | null {
    const direct = (claims as any).role as Role | undefined;
    if (direct) return direct;

    const rolesArray = (claims as any).roles as Role[] | undefined;
    if (Array.isArray(rolesArray) && rolesArray.length) return rolesArray[0];

    const authorities = (claims as any).authorities as string[] | undefined;
    if (Array.isArray(authorities) && authorities.length) return authorities[0] as Role;

    return null;
  }
}