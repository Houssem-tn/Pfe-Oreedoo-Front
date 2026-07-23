import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { LanguageSelectorComponent } from '../../../shared/language-selector/language-selector.component';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
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
    FormsModule,
    TranslocoModule,
    LanguageSelectorComponent
  ]
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly transloco = inject(TranslocoService);

  form = {
    identifier: '',
    password: '',
  };

  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    try {
      const redirectedError = sessionStorage.getItem('auth.redirectError');
      if (redirectedError) {
        this.error = redirectedError;
        sessionStorage.removeItem('auth.redirectError');
      }
    } catch {
      // ignore storage errors
    }
  }

  submit() {
    if (this.loading) return;

    this.error = null;
    this.loading = true;
    this.cdr.detectChanges();

    const payload = {
      email: this.form.identifier?.trim(),
      password: this.form.password,
    };

    this.auth.login(payload)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.router.navigateByUrl(this.landingRoute());
        },
        error: (e) => {
          const msg =
            e?.error?.message ??
            e?.error?.error ??
            (typeof e?.error === 'string' ? e.error : null) ??
            null;

          this.error = this.normalizeErrorMessage(msg);
          this.cdr.detectChanges();
        },
      });
  }

  private normalizeErrorMessage(message: string | null): string {
    const normalized = (message ?? '').trim();

    // The backend does not yet return stable error codes for this case, so we
    // match its known raw message and route it through the errors.* keys.
    if (normalized === 'Account disabled') {
      return this.transloco.translate('errors.accountDisabled');
    }

    return normalized || this.transloco.translate('errors.loginFailed');
  }

  private landingRoute(): string {
    switch (this.authStore.role()) {
      case 'ROLE_TECH':
        return '/tech/home';
      default:
        return '/dashboard';
    }
  }
}
