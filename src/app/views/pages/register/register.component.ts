import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: Role;
    password: string;
    confirmPassword: string;
  } = {
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

  selectRole(role: Role): void {
    this.form.role = role;
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

  submit(): void {
    this.error = null;
    this.success = null;

    if (!this.form.firstName.trim()) {
      this.error = 'First name is required';
      return;
    }

    if (!this.form.lastName.trim()) {
      this.error = 'Last name is required';
      return;
    }

    if (!this.form.email.trim()) {
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
      firstName: this.form.firstName.trim(),
      lastName: this.form.lastName.trim(),
      email: this.form.email.trim().toLowerCase(),
      phone: this.form.phone?.trim() || undefined,
      password: this.form.password,
      role: this.form.role,
      sttId: undefined
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = this.form.role === 'ROLE_STT'
          ? 'Account created. Waiting for ZM approval.'
          : 'Account created. Waiting for admin approval.';

        setTimeout(() => this.router.navigateByUrl('/login'), 1000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Register failed';
      }
    });
  }
}