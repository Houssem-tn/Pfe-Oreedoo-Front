import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class SwalService {
  private readonly confirmButtonColor = '#321fdb';
  private readonly cancelButtonColor = '#6c757d';

  confirmDelete(entityLabel = 'item'): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'warning',
      title: 'Are you sure?',
      text: `This will permanently delete this ${entityLabel}.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      reverseButtons: true
    });
  }

  confirmAction(title: string, text: string, confirmButtonText = 'Confirm'): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      reverseButtons: true
    });
  }

  promptSelect(
    title: string,
    inputLabel: string,
    inputOptions: Record<string, string>,
    inputValue = '',
    confirmButtonText = 'Save'
  ): Promise<SweetAlertResult<string>> {
    return Swal.fire<string>({
      title,
      input: 'select',
      inputLabel,
      inputOptions,
      inputValue,
      inputPlaceholder: 'Choose an option',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      inputValidator: (value) => (!value ? 'This field is required' : undefined)
    });
  }

  promptTextarea(
    title: string,
    text: string,
    inputLabel: string,
    confirmButtonText = 'Submit'
  ): Promise<SweetAlertResult<string>> {
    return Swal.fire<string>({
      title,
      text,
      input: 'textarea',
      inputLabel,
      inputPlaceholder: 'Type here...',
      inputAttributes: {
        'aria-label': inputLabel
      },
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: this.confirmButtonColor,
      cancelButtonColor: this.cancelButtonColor,
      inputValidator: (value) => {
        const trimmed = value?.trim() ?? '';

        if (!trimmed) {
          return `${inputLabel} is required`;
        }

        if (trimmed.length > 500) {
          return `${inputLabel} must be at most 500 characters`;
        }

        return undefined;
      }
    });
  }

  success(title: string, text: string): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: 'OK',
      confirmButtonColor: this.confirmButtonColor
    });
  }

  successToast(title: string): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      toast: true,
      position: 'top',
      icon: 'success',
      title,
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });
  }

  error(title: string, text: string): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'OK',
      confirmButtonColor: this.confirmButtonColor
    });
  }

  /**
   * Hard-stop shown when a field-proof action cannot obtain GPS coordinates
   * (location off, denied, unavailable, or timed out). Blocks proof
   * capture/submission until the technician enables location.
   */
  locationRequired(): Promise<SweetAlertResult<unknown>> {
    return Swal.fire({
      icon: 'warning',
      title: 'Location Required',
      text: 'GPS/location is required to submit field proof. Please enable location services and allow location permission, then try again.',
      confirmButtonText: 'Try Again',
      confirmButtonColor: this.confirmButtonColor,
      allowOutsideClick: false
    });
  }
}
