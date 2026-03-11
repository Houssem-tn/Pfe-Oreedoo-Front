import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
import { PublicSttOption } from '../../../core/auth/models/auth.models';
import { API_BASE_URL } from '../../../core/http/api.config';

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
export class RegisterComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  readonly router = inject(Router);

  roles: Role[] = [
    'ROLE_STT',
    'ROLE_TECH',
    'ROLE_ZM'
  ];

  sttOptions: PublicSttOption[] = [];
  sttLoading = false;

  form = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'ROLE_TECH' as Role,
  sttId: '',
  password: '',
  confirmPassword: ''
};

  error: string | null = null;
  success: string | null = null;
  loading = false;

  ngOnInit(): void {
    this.loadPublicStts();
  }

  get requiresSttSelection(): boolean {
    return this.form.role === 'ROLE_TECH';
  }

  onRoleChange(): void {
    if (!this.requiresSttSelection) {
      this.form.sttId = '';
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

    if (this.form.password !== this.form.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.requiresSttSelection && !this.form.sttId) {
      this.error = 'Please choose an STT';
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
  sttId: this.requiresSttSelection ? this.form.sttId : undefined
}).subscribe({
      next: () => {
        this.loading = false;
        this.success = this.requiresSttSelection
          ? 'Account created. Waiting for the selected STT approval.'
          : this.form.role === 'ROLE_STT'
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

  private loadPublicStts(): void {
    this.sttLoading = true;

    this.http.get<PublicSttOption[]>(
      `${this.apiBaseUrl}/api/v1/public/stts`
    ).subscribe({
      next: (items) => {
        this.sttOptions = items ?? [];
        this.sttLoading = false;
      },
      error: (error) => {
        console.error('[Register] Failed to load public STTs', error);
        this.sttOptions = [];
        this.sttLoading = false;
      }
    });
  }
}