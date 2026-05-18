import { Role } from './roles.type';
import { AccountStatus } from './account-status.enum';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName?: string;
  firstName?: string;
  lastName?: string;
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
  accessToken?: string;
  token?: string;
  tokenType?: string;
  role?: Role;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
    status?: AccountStatus;
    role?: Role;
    canCreateDpm?: boolean;
  };
}

export interface AuthUser {
  id?: string;
  username?: string;
  fullName?: string;
  email?: string;
  role: Role;
  status?: AccountStatus;
  canCreateDpm?: boolean;
}

export interface JwtClaims {
  sub: string;
  name?: string;
  fullName?: string;
  role?: Role;
  roles?: Role[];
  status?: AccountStatus;
  exp?: number;
  iat?: number;
}
