import { Injectable, computed, signal } from '@angular/core';
import { AuthUser } from '../auth/models/auth.models';
import { Role } from '../auth/models/roles.type';
import { AccountStatus } from '../auth/models/account-status.type';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();

  readonly isAuthenticated = computed(() => !!this._user());

  readonly role = computed<Role | null>(() => {
    return this._user()?.role ?? null;
  });

  readonly status = computed<AccountStatus | null>(() => {
    return this._user()?.status ?? null;
  });

  readonly isApproved = computed(() => {
    return this._user()?.status === 'APPROVED';
  });

  readonly canCreateDpm = computed<boolean>(() => {
    return this._user()?.canCreateDpm === true;
  });

  readonly canImportCoverage = computed<boolean>(() => {
    return this._user()?.canImportCoverage === true;
  });

  setUser(user: AuthUser | null) {
    if (!user) {
      this._user.set(null);
      return;
    }

    this._user.set({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      canCreateDpm: user.canCreateDpm ?? false,
      canImportCoverage: user.canImportCoverage ?? false,
    });
  }

  patchCanCreateDpm(value: boolean): void {
    const u = this._user();
    if (u) {
      this._user.set({ ...u, canCreateDpm: value });
    }
  }

  patchCanImportCoverage(value: boolean): void {
    const u = this._user();
    if (u) {
      this._user.set({ ...u, canImportCoverage: value });
    }
  }

  clear() {
    this._user.set(null);
  }
}
