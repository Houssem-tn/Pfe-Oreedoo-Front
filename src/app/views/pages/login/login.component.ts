import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardGroupComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  imports: [
    CommonModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardGroupComponent,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
    FormControlDirective,
    ButtonDirective,
    FormsModule
  ]
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  form = {
    identifier: '', // user types email here
    password: '',
  };

  loading = false;
  error: string | null = null;

  submit() {
    if (this.loading) return;

    this.error = null;
    this.loading = true;

    // ✅ Backend expects "email", not "identifier"
    const payload = {
      email: this.form.identifier?.trim(),
      password: this.form.password,
    };

    this.auth.login(payload).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (e) => {
        this.loading = false;

        const msg =
          e?.error?.message ??
          e?.error?.error ??
          (typeof e?.error === 'string' ? e.error : null) ??
          'Login failed';

        this.error = msg;
      },
    });
  }
}