import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Shared password rules for registration / password change / password reset, so
 * the client shows the same requirements everywhere. These mirror the backend's
 * authoritative {@code PasswordPolicy} (min 6 / max 120, not all-whitespace).
 * The backend re-validates every submission — this is UX only, never the sole
 * gate.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 120;

/**
 * Rejects a password that is present but consists only of whitespace. Angular's
 * Validators.required already treats all-whitespace as empty for the required
 * check; this adds an explicit, translatable error and does NOT trim the value
 * (internal spaces are valid password characters that must be preserved).
 */
export function notOnlyWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) {
      return null; // let `required` handle emptiness
    }
    return value.trim().length === 0 ? { onlyWhitespace: true } : null;
  };
}

/**
 * Cross-field validator: flags a mismatch between two controls. Applied at the
 * group level; sets/clears the `passwordsMismatch` error on the confirm control
 * so it can be shown inline next to that field.
 */
export function passwordsMatchValidator(
  passwordKey = 'newPassword',
  confirmKey = 'confirmPassword'
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey);
    const confirm = group.get(confirmKey);
    if (!password || !confirm) {
      return null;
    }

    // Don't mask a more specific error already on the confirm control.
    if (confirm.errors && !confirm.errors['passwordsMismatch']) {
      return null;
    }

    if (password.value !== confirm.value) {
      confirm.setErrors({ ...(confirm.errors ?? {}), passwordsMismatch: true });
      return { passwordsMismatch: true };
    }

    // Clear a previously set mismatch without wiping other errors.
    if (confirm.errors) {
      const { passwordsMismatch: _passwordsMismatch, ...rest } = confirm.errors;
      confirm.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  };
}
