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

  // ✅ Use backend roles (no "ADMIN/TECH" shortcuts)
  roles: Role[] = [
    'ROLE_CRM_BOUTIQUE',
    'ROLE_STT',
    'ROLE_TECH',
    'ROLE_ZM',
    // 'ROLE_ADMIN'  // usually NOT public; keep only if your business allows it
  ];

  form = {
    fullName: '',
    username: '',
    email: '',
    phone: '',
    role: 'ROLE_STT' as Role,
    password: '',
    confirmPassword: ''
  };

  error: string | null = null;
  success: string | null = null;
  loading = false;

  submit(): void {
    this.error = null;
    this.success = null;

    if (!this.form.fullName.trim()) return void (this.error = 'Full name is required');
    if (!this.form.username.trim()) return void (this.error = 'Username is required');
    if (!this.form.email.trim()) return void (this.error = 'Email is required');
    if (!this.form.password) return void (this.error = 'Password is required');
    if (this.form.password !== this.form.confirmPassword) return void (this.error = 'Passwords do not match');

    this.loading = true;

    this.auth.register({
      fullName: this.form.fullName.trim(),
      username: this.form.username.trim(),
      email: this.form.email.trim().toLowerCase(),
      phone: this.form.phone?.trim() || undefined,
      password: this.form.password,
      role: this.form.role
    }).subscribe({
      next: () => {
        this.loading = false;
        // ✅ user is PENDING → redirect to login
        this.success = 'Account created. Waiting for admin approval.';
        setTimeout(() => this.router.navigateByUrl('/login'), 800);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Register failed';
      }
    });
  }
}