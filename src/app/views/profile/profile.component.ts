import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs/operators';

import { AppUser } from '../../core/users/user.model';
import { UserService } from '../../core/users/user.service';
import { CurrentUserStore } from '../../core/users/current-user.store';
import { SwalService } from '../../core/ui/swal.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconDirective],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly currentUserStore = inject(CurrentUserStore);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  protected readonly defaultAvatarUrl = 'assets/images/avatars/1.jpg';

  // Only allow common image types up to 5 MB for the avatar.
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static readonly ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

  protected user: AppUser | null = null;
  protected loading = false;
  protected saving = false;
  protected uploadingImage = false;
  protected editMode = false;

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    // Optional phone. Empty is allowed; otherwise it must look like a phone number.
    phone: ['', [Validators.pattern(/^\s*$|^[+]?[0-9][0-9\s().\-]{5,19}$/)]]
  });

  get isAdmin(): boolean {
    return (this.user?.role ?? '') === 'ROLE_ADMIN';
  }

  get avatarUrl(): string {
    return this.user?.profileThumbnailUrl || this.user?.profileImageUrl || this.defaultAvatarUrl;
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  protected loadProfile(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;

    this.userService.getMe()
      .pipe(finalize(() => {
        this.loading = false;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: (user) => {
          this.applyUser(user);
        },
        error: (err) => {
          console.error('Failed to load profile', err);
          void this.swal.error('Profile', this.extractErrorMessage(err, 'Failed to load your profile'));
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected enterEditMode(): void {
    if (this.isAdmin) {
      return;
    }
    this.editMode = true;
    this.resetFormFromUser();
  }

  protected cancelEdit(): void {
    this.editMode = false;
    this.resetFormFromUser();
  }

  protected save(): void {
    if (this.isAdmin) {
      void this.swal.error('Not allowed', 'Administrator profiles are read-only.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.swal.error('Invalid form', 'Please fix the highlighted fields before saving.');
      return;
    }

    const fullName = (this.form.value.fullName ?? '').trim();
    const phone = (this.form.value.phone ?? '').trim();

    this.saving = true;

    this.userService.updateMe({ fullName, phone: phone || null })
      .pipe(finalize(() => {
        this.saving = false;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: (user) => {
          this.applyUser(user);
          this.editMode = false;
          void this.swal.successToast('Profile updated');
          this.zone.run(() => this.cdr.detectChanges());
        },
        error: (err) => {
          console.error('Failed to update profile', err);
          void this.swal.error('Update failed', this.extractErrorMessage(err, 'Failed to update your profile'));
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset the input so selecting the same file again re-triggers the change event.
    input.value = '';

    if (!file || this.isAdmin) {
      return;
    }

    if (!ProfileComponent.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      void this.swal.error('Invalid image', 'Please choose a PNG, JPG, WEBP or GIF image.');
      return;
    }

    if (file.size > ProfileComponent.MAX_IMAGE_BYTES) {
      void this.swal.error('Image too large', 'The image must be 5 MB or smaller.');
      return;
    }

    const userId = this.user?.id;
    if (!userId) {
      return;
    }

    this.uploadingImage = true;

    this.userService.uploadProfileImage(userId, file)
      .pipe(finalize(() => {
        this.uploadingImage = false;
        this.zone.run(() => this.cdr.detectChanges());
      }))
      .subscribe({
        next: (user) => {
          this.applyUser(user);
          void this.swal.successToast('Profile picture updated');
          this.zone.run(() => this.cdr.detectChanges());
        },
        error: (err) => {
          console.error('Failed to update profile picture', err);
          void this.swal.error('Upload failed', this.extractErrorMessage(err, 'Failed to update your picture'));
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected roleLabel(role?: string | null): string {
    switch (role) {
      case 'ROLE_ADMIN':
        return 'Administrator';
      case 'ROLE_ZM':
        return 'Zone Manager';
      case 'ROLE_STT':
        return 'STT';
      case 'ROLE_TECH':
        return 'Technician';
      case 'ROLE_CRM_BOUTIQUE':
        return 'CRM Boutique';
      default:
        return role || '-';
    }
  }

  protected statusLabel(status?: string | null): string {
    if (!status) {
      return '-';
    }
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  protected statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'bg-success';
      case 'PENDING':
        return 'bg-warning text-dark';
      case 'REJECTED':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  private applyUser(user: AppUser): void {
    this.user = user;
    this.currentUserStore.set(user);
    this.resetFormFromUser();
  }

  private resetFormFromUser(): void {
    this.form.reset({
      fullName: this.user?.fullName ?? '',
      phone: this.user?.phone ?? ''
    });
  }

  private extractErrorMessage(err: any, fallback: string): string {
    if (typeof err?.error === 'string') {
      try {
        const parsed = JSON.parse(err.error);
        return parsed?.message || err.error || fallback;
      } catch {
        return err.error || fallback;
      }
    }
    return err?.error?.message || err?.message || fallback;
  }
}
