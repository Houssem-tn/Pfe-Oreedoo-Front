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
    });
  }

  clear() {
    this._user.set(null);
  }
}
