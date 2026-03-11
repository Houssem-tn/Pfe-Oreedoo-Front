import { Role } from './roles.type';
import { AccountStatus } from './account-status.enum';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  sttId?: string;
}

export interface PublicSttOption {
  id: string;
  fullName: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
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
  roles?: Role[];
  status?: AccountStatus;
  exp?: number;
  iat?: number;
}