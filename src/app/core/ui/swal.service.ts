import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import Swal, { SweetAlertResult } from 'sweetalert2';

export interface SwalTranslatedText {
  key: string;
  params?: Record<string, unknown>;
}

export interface SwalTranslatedOption {
  value: string;
  label: SwalTranslatedText;
}

type LocalizedText = string | SwalTranslatedText;

@Injectable({ providedIn: 'root' })
export class SwalService {
  private readonly transloco = inject(TranslocoService);
  private readonly confirmButtonColor = '#321fdb';
  private readonly cancelButtonColor = '#6c757d';

  confirmDelete(entityLabel?: LocalizedText): Promise<SweetAlertResult<unknown>> {
    const entity = entityLabel
      ? this.resolveText(entityLabel)
      : this.transloco.translate('dialogs.confirmDelete.defaultEntity');

    return Swal.fire({
      icon: 'warning',
      title: this.transloco.translate('dialogs.confirmDelete.title'),
      text: this.transloco.translate('dialogs.confirmDelete.text', { entity }),
      showCancelButton: true,
      confirmButtonText: this.transloco.translate('common.delete'),
      cancelButtonText: this.transloco.translate('common.cancel'),
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      reverseButtons: true
    });
  }

  confirmAction(
    title: LocalizedText,
    text: LocalizedText,
    confirmButtonText?: LocalizedText
  ): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'warning',
      title: this.resolveText(title),
      text: this.resolveText(text),
      showCancelButton: true,
      confirmButtonText: confirmButtonText
        ? this.resolveText(confirmButtonText)
        : this.transloco.translate('common.confirm'),
      cancelButtonText: this.transloco.translate('common.cancel'),
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      reverseButtons: true
    });
  }

  promptSelect(
    title: LocalizedText,
    inputLabel: LocalizedText,
    inputOptions: Record<string, string> | SwalTranslatedOption[],
    inputValue = '',
    confirmButtonText?: LocalizedText
  ): Promise<SweetAlertResult<string>> {
    return Swal.fire<string>({
      title: this.resolveText(title),
      input: 'select',
      inputLabel: this.resolveText(inputLabel),
      inputOptions: this.resolveSelectOptions(inputOptions),
      inputValue,
      inputPlaceholder: this.transloco.translate('dialogs.promptSelect.placeholder'),
      showCancelButton: true,
      confirmButtonText: confirmButtonText
        ? this.resolveText(confirmButtonText)
        : this.transloco.translate('common.save'),
      cancelButtonText: this.transloco.translate('common.cancel'),
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      inputValidator: (value) => (!value ? this.transloco.translate('common.requiredField') : undefined)
    });
  }

  promptTextarea(
    title: LocalizedText,
    text: LocalizedText,
    inputLabel: LocalizedText,
    confirmButtonText?: LocalizedText
  ): Promise<SweetAlertResult<string>> {
    const resolvedLabel = this.resolveText(inputLabel);

    return Swal.fire<string>({
      title: this.resolveText(title),
      text: this.resolveText(text),
      input: 'textarea',
      inputLabel: resolvedLabel,
      inputPlaceholder: this.transloco.translate('dialogs.promptTextarea.placeholder'),
      inputAttributes: {
        'aria-label': resolvedLabel
      },
      showCancelButton: true,
      confirmButtonText: confirmButtonText
        ? this.resolveText(confirmButtonText)
        : this.transloco.translate('common.submit'),
      cancelButtonText: this.transloco.translate('common.cancel'),
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      inputValidator: (value) => {
        const trimmed = value?.trim() ?? '';

        if (!trimmed) {
          return this.transloco.translate('dialogs.promptTextarea.fieldRequired', { field: resolvedLabel });
        }

        if (trimmed.length > 500) {
          return this.transloco.translate('dialogs.promptTextarea.fieldMaxLength', { field: resolvedLabel, max: 500 });
        }

        return undefined;
      }
    });
  }

  success(title: LocalizedText, text: LocalizedText): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'success',
      title: this.resolveText(title),
      text: this.resolveText(text),
      confirmButtonText: this.transloco.translate('common.ok'),
      confirmButtonColor: this.confirmButtonColor
    });
  }

  successToast(title: LocalizedText): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      toast: true,
      position: 'top',
      icon: 'success',
      title: this.resolveText(title),
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });
  }

  error(title: LocalizedText, text: LocalizedText): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'error',
      title: this.resolveText(title),
      text: this.resolveText(text),
      confirmButtonText: this.transloco.translate('common.ok'),
      confirmButtonColor: this.confirmButtonColor
    });
  }

  locationRequired(): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'warning',
      title: this.transloco.translate('dialogs.locationRequired.title'),
      text: this.transloco.translate('dialogs.locationRequired.text'),
      confirmButtonText: this.transloco.translate('dialogs.locationRequired.tryAgain'),
      confirmButtonColor: this.confirmButtonColor,
      allowOutsideClick: false
    });
  }

  private resolveText(value: LocalizedText): string {
    return typeof value === 'string'
      ? value
      : this.transloco.translate(value.key, value.params);
  }

  private resolveSelectOptions(options: Record<string, string> | SwalTranslatedOption[]): Record<string, string> {
    if (!Array.isArray(options)) {
      return options;
    }

    return options.reduce<Record<string, string>>((resolved, option) => {
      resolved[option.value] = this.resolveText(option.label);
      return resolved;
    }, {});
  }
}
