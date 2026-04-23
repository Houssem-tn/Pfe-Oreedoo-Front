import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';

import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../core/auth/models/roles.type';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    RouterLink,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
    FormControlDirective,
    ButtonDirective
  ]
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  readonly router = inject(Router);

  roles: Role[] = [
    'ROLE_STT',
    'ROLE_ZM'
  ];

  form: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: Role;
    password: string;
    confirmPassword: string;
  } = {
    fullName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'ROLE_STT',
    password: '',
    confirmPassword: ''
  };

  error: string | null = null;
  success: string | null = null;
  loading = false;

  selectedPhotoFile: File | null = null;
  photoPreviewUrl: string | null = null;
  readonly maxPhotoSizeBytes = 5 * 1024 * 1024;
  readonly allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

  selectRole(role: Role): void {
    this.form.role = role;
  }

  get isSttRegistration(): boolean {
    return this.form.role === 'ROLE_STT';
  }

  formatRoleLabel(role: Role): string {
    switch (role) {
      case 'ROLE_ZM':
        return 'ZM';
      case 'ROLE_STT':
        return 'STT';
      default:
        return role;
    }
  }

  getRoleDescription(role: Role): string {
    switch (role) {
      case 'ROLE_ZM':
        return 'Zone manager access';
      case 'ROLE_STT':
        return 'STT supervisor access';
      default:
        return 'Platform access';
    }
  }

  getRoleIcon(role: Role): string {
    switch (role) {
      case 'ROLE_ZM':
        return 'cilUser';
      case 'ROLE_STT':
        return 'cilPeople';
      default:
        return 'cilBadge';
    }
  }

  onPhotoSelected(event: Event): void {
    this.error = null;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.clearSelectedPhoto();
      return;
    }

    if (!this.allowedPhotoTypes.includes(file.type)) {
      this.clearSelectedPhoto(input);
      this.error = 'Only JPG, PNG, and WEBP images are allowed';
      return;
    }

    if (file.size > this.maxPhotoSizeBytes) {
      this.clearSelectedPhoto(input);
      this.error = 'Photo size must not exceed 5 MB';
      return;
    }

    this.selectedPhotoFile = file;

    if (this.photoPreviewUrl) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }
    this.photoPreviewUrl = URL.createObjectURL(file);
  }

  removeSelectedPhoto(fileInput?: HTMLInputElement): void {
    this.clearSelectedPhoto(fileInput);
  }

  submit(): void {
    this.error = null;
    this.success = null;

    const fullName = this.form.fullName.trim();
    const firstName = this.form.firstName.trim();
    const lastName = this.form.lastName.trim();
    const email = this.form.email.trim().toLowerCase();
    const phone = this.form.phone?.trim() || undefined;

    if (this.isSttRegistration && !fullName) {
      this.error = 'STT/company name is required';
      return;
    }

    if (!this.isSttRegistration && !firstName) {
      this.error = 'First name is required';
      return;
    }

    if (!this.isSttRegistration && !lastName) {
      this.error = 'Last name is required';
      return;
    }

    if (!email) {
      this.error = 'Email is required';
      return;
    }

    if (!this.form.password) {
      this.error = 'Password is required';
      return;
    }

    if (this.form.password.length < 6) {
      this.error = 'Password must contain at least 6 characters';
      return;
    }

    if (this.form.password !== this.form.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;

    this.auth.register({
      fullName: this.isSttRegistration ? fullName : undefined,
      firstName: this.isSttRegistration ? undefined : firstName,
      lastName: this.isSttRegistration ? undefined : lastName,
      email,
      phone,
      password: this.form.password,
      role: this.form.role,
      sttId: undefined
    }).subscribe({
      next: () => {
        if (!this.selectedPhotoFile) {
          this.handleRegisterSuccess();
          return;
        }

        this.auth.uploadRegisterPhoto(email, this.selectedPhotoFile).subscribe({
          next: () => this.handleRegisterSuccess(),
          error: () => {
            this.loading = false;
            this.success = 'Account created, but profile photo upload failed. You can upload it later.';
            setTimeout(() => this.router.navigateByUrl('/login'), 1500);
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Register failed';
      }
    });
  }

  private handleRegisterSuccess(): void {
    this.loading = false;
    this.success = this.form.role === 'ROLE_STT'
      ? 'Account created. Waiting for ZM approval.'
      : 'Account created. Waiting for admin approval.';

    setTimeout(() => this.router.navigateByUrl('/login'), 1000);
  }

  private clearSelectedPhoto(fileInput?: HTMLInputElement): void {
    this.selectedPhotoFile = null;

    if (this.photoPreviewUrl) {
      URL.revokeObjectURL(this.photoPreviewUrl);
      this.photoPreviewUrl = null;
    }

    if (fileInput) {
      fileInput.value = '';
    }
  }
}
