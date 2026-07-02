import { Injectable, computed, inject, signal } from '@angular/core';
import { AppUser } from './user.model';
import { UserService } from './user.service';

/**
 * Holds the authenticated user's own profile (as returned by GET /users/me)
 * so that the header avatar/name and the profile page stay in sync. When the
 * user edits their profile, calling {@link set} pushes the fresh data here and
 * every consumer (e.g. the top-right avatar) reacts immediately.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly userService = inject(UserService);

  private readonly _user = signal<AppUser | null>(null);

  readonly user = this._user.asReadonly();

  readonly avatarUrl = computed<string | null>(() => {
    const user = this._user();
    return user?.profileThumbnailUrl || user?.profileImageUrl || null;
  });

  readonly displayName = computed<string | null>(() => this._user()?.fullName ?? null);

  /** Fetch the current profile from the backend and cache it. */
  load(): void {
    this.userService.getMe().subscribe({
      next: (user) => this._user.set(user),
      error: () => this._user.set(null)
    });
  }

  /** Replace the cached profile (e.g. after a successful self-update). */
  set(user: AppUser | null): void {
    this._user.set(user);
  }

  clear(): void {
    this._user.set(null);
  }
}
