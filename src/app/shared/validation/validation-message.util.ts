import { ValidationErrors } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Maps an Angular `AbstractControl.errors` object to a single translated
 * message, checking the most specific/important error first. Covers the
 * built-in validators used across the app's Reactive Forms
 * (Validators.required/email/minLength/maxLength/min/max/pattern) plus the
 * app's own `passwordsMismatch` cross-field error.
 *
 * Returns '' when there are no errors (nothing to show).
 */
export function getValidationMessage(transloco: TranslocoService, errors: ValidationErrors | null | undefined): string {
  if (!errors) {
    return '';
  }

  if (errors['required']) {
    return transloco.translate('validation.required');
  }
  if (errors['email']) {
    return transloco.translate('validation.email');
  }
  if (errors['minlength']) {
    return transloco.translate('validation.minLength', { length: errors['minlength'].requiredLength });
  }
  if (errors['maxlength']) {
    return transloco.translate('validation.maxLength', { length: errors['maxlength'].requiredLength });
  }
  if (errors['min']) {
    return transloco.translate('validation.min', { min: errors['min'].min });
  }
  if (errors['max']) {
    return transloco.translate('validation.max', { max: errors['max'].max });
  }
  if (errors['pattern']) {
    return transloco.translate('validation.pattern');
  }
  if (errors['passwordsMismatch']) {
    return transloco.translate('validation.passwordsMismatch');
  }

  return transloco.translate('errors.validationError');
}
