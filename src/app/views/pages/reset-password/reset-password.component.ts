import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSelectorComponent } from '../../../shared/language-selector/language-selector.component';
import { getValidationMessage } from '../../../shared/validation/validation-message.util';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  notOnlyWhitespaceValidator,
  passwordsMatchValidator
} from '../../../shared/validation/password.validators';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoModule, LanguageSelectorComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../auth-shell.scss']
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly maxLength = PASSWORD_MAX_LENGTH;

  /**
   * The raw token, held ONLY in component memory for the lifetime of this view.
   * Never written to localStorage/sessionStorage/cookies/global state, and never
   * sent to analytics or logs.
   */
  private token = '';

  hasToken = false;
  showNewPassword = false;
  showConfirmPassword = false;

  loading = false;
  success = false;
  /** True for an unknown/expired/used/revoked token → offer "request another link". */
  invalidLink = false;
  errorMessage: string | null = null;

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
        notOnlyWhitespaceValidator()
      ]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') }
  );

  ngOnInit(): void {
    this.token = (this.route.snapshot.queryParamMap.get('token') ?? '').trim();
    this.hasToken = this.token.length > 0;

    if (!this.hasToken) {
      // Controlled error state — no form shown, no exception surfaced.
      this.invalidLink = true;
      this.errorMessage = this.transloco.translate('resetPassword.errorMissingToken');
      return;
    }

    // Strip the token from the visible URL without navigating away (keeps this
    // component's state and the in-memory token). Prevents the secret lingering
    // in the address bar / browser history / referer headers.
    this.location.replaceState('/reset-password');
  }

  get newPasswordCtrl() {
    return this.form.controls.newPassword;
  }

  get confirmPasswordCtrl() {
    return this.form.controls.confirmPassword;
  }

  get passwordLengthMet(): boolean {
    const v = this.newPasswordCtrl.value;
    return v.trim().length > 0 && v.length >= PASSWORD_MIN_LENGTH && v.length <= PASSWORD_MAX_LENGTH;
  }

  get passwordsMatch(): boolean {
    return (
      this.newPasswordCtrl.value.length > 0 &&
      this.newPasswordCtrl.value === this.confirmPasswordCtrl.value
    );
  }

  newPasswordError(): string {
    if (!this.newPasswordCtrl.touched || this.newPasswordCtrl.valid) {
      return '';
    }
    if (this.newPasswordCtrl.errors?.['onlyWhitespace']) {
      return this.transloco.translate('resetPassword.errorOnlyWhitespace');
    }
    return getValidationMessage(this.transloco, this.newPasswordCtrl.errors);
  }

  confirmPasswordError(): string {
    if (!this.confirmPasswordCtrl.touched || this.confirmPasswordCtrl.valid) {
      return '';
    }
    return getValidationMessage(this.transloco, this.confirmPasswordCtrl.errors);
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(): void {
    if (this.loading || !this.hasToken) {
      return;
    }

    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.form.disable();
    this.cdr.detectChanges();

    this.auth.resetPassword({
      token: this.token,
      newPassword: this.newPasswordCtrl.value,
      confirmPassword: this.confirmPasswordCtrl.value
    })
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.success = true;
          // Do NOT auto-authenticate — send the user to login to sign in fresh.
          setTimeout(() => this.router.navigateByUrl('/login'), 2200);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.form.enable();
          this.applyError(err);
          this.cdr.detectChanges();
        }
      });
  }

  private applyError(err: HttpErrorResponse): void {
    const backendMessage: string = err?.error?.message ?? '';

    if (err?.status === 429) {
      this.errorMessage = this.transloco.translate('resetPassword.errorTooMany');
      return;
    }

    if (backendMessage === 'Invalid or expired reset link') {
      this.invalidLink = true;
      this.errorMessage = this.transloco.translate('resetPassword.errorInvalidLink');
      return;
    }

    if (backendMessage === 'Password confirmation does not match') {
      this.errorMessage = this.transloco.translate('validation.passwordsMismatch');
      return;
    }

    if (backendMessage) {
      // Any remaining backend validation message (e.g. password policy) — shown
      // as a generic "does not meet requirements" so we don't surface raw text.
      this.errorMessage = this.transloco.translate('resetPassword.errorPasswordPolicy');
      return;
    }

    this.errorMessage = this.transloco.translate('resetPassword.errorGeneric');
  }
}
