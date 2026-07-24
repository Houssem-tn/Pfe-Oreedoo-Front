import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSelectorComponent } from '../../../shared/language-selector/language-selector.component';
import { getValidationMessage } from '../../../shared/validation/validation-message.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoModule, LanguageSelectorComponent],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth-shell.scss']
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]]
  });

  loading = false;
  submitted = false;
  /** Generic success message shown once the request has been accepted. */
  success = false;
  /** Non-account-revealing transport/server error message. */
  errorMessage: string | null = null;

  get emailCtrl() {
    return this.form.controls.email;
  }

  emailError(): string {
    if (!this.emailCtrl.touched || this.emailCtrl.valid) {
      return '';
    }
    return getValidationMessage(this.transloco, this.emailCtrl.errors);
  }

  submit(): void {
    // Guard against accidental duplicate submissions.
    if (this.loading) {
      return;
    }

    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusEmail();
      this.cdr.detectChanges();
      return;
    }

    // Normalize before sending: trim + lowercase (server normalizes too).
    const email = this.emailCtrl.value.trim().toLowerCase();

    this.loading = true;
    this.form.disable();
    this.cdr.detectChanges();

    this.auth.forgotPassword({ email })
      .pipe(finalize(() => {
        this.loading = false;
        this.form.enable();
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          // Same generic outcome for every account state — never reveals whether
          // an account exists.
          this.submitted = true;
          this.success = true;
          this.cdr.detectChanges();
        },
        error: () => {
          // Transport/server failure only (the backend returns 200 for all
          // account states). Message is generic and reveals nothing.
          this.errorMessage = this.transloco.translate('forgotPassword.errorGeneric');
          this.cdr.detectChanges();
        }
      });
  }

  private focusEmail(): void {
    // Defer so the disabled→enabled/render settles before focusing.
    setTimeout(() => this.emailInput?.nativeElement?.focus(), 0);
  }
}
