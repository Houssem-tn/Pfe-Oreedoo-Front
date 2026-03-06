import { Role } from './roles.type';
import { AccountStatus } from './account-status.enum';

export interface LoginRequest {
  email: string; // email OR username (align with backend)
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string; // or "token" -> adjust mapping in AuthService
}

export interface AuthUser {
  id?: string;
  username?: string;
  email?: string;
  role: Role;
  status?: AccountStatus;
}

export interface JwtClaims {
  sub: string;
  role?: Role;
  roles?: Role[];          // support both
  status?: AccountStatus;  // if you include it in JWT
  exp?: number;
  iat?: number;
}