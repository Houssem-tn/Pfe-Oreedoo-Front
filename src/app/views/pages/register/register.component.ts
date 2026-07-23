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

import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../core/auth/models/roles.type';
import { LanguageSelectorComponent } from '../../../shared/language-selector/language-selector.component';

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
    ButtonDirective,
    TranslocoModule,
    LanguageSelectorComponent
  ]
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
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
        return this.transloco.translate('register.roleZmDescription');
      case 'ROLE_STT':
        return this.transloco.translate('register.roleSttDescription');
      default:
        return this.transloco.translate('register.rolePlatformDescription');
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
      this.error = this.transloco.translate('register.errors.photoTypeInvalid');
      return;
    }

    if (file.size > this.maxPhotoSizeBytes) {
      this.clearSelectedPhoto(input);
      this.error = this.transloco.translate('register.errors.photoTooLarge');
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
      this.error = this.transloco.translate('register.errors.companyNameRequired');
      return;
    }

    if (!this.isSttRegistration && !firstName) {
      this.error = this.transloco.translate('register.errors.firstNameRequired');
      return;
    }

    if (!this.isSttRegistration && !lastName) {
      this.error = this.transloco.translate('register.errors.lastNameRequired');
      return;
    }

    if (!email) {
      this.error = this.transloco.translate('register.errors.emailRequired');
      return;
    }

    if (!this.form.password) {
      this.error = this.transloco.translate('register.errors.passwordRequired');
      return;
    }

    if (this.form.password.length < 6) {
      this.error = this.transloco.translate('register.errors.passwordTooShort');
      return;
    }

    if (this.form.password !== this.form.confirmPassword) {
      this.error = this.transloco.translate('register.errors.passwordsMismatch');
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
            this.success = this.transloco.translate('register.errors.photoUploadFailed');
            setTimeout(() => this.router.navigateByUrl('/login'), 1500);
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? this.transloco.translate('register.errors.registerFailed');
      }
    });
  }

  private handleRegisterSuccess(): void {
    this.loading = false;
    this.success = this.form.role === 'ROLE_STT'
      ? this.transloco.translate('register.success.waitingZmApproval')
      : this.transloco.translate('register.success.waitingAdminApproval');

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
