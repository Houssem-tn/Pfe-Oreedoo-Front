import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { TechInvitationValidationResponse } from '../../../core/auth/models/tech-invitation-validation-response.model';
import { TechRegisterRequest } from '../../../core/auth/models/tech-register-request.model';

@Component({
  selector: 'app-register-tech-invitation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register-tech-invitation.component.html',
  styleUrls: ['./register-tech-invitation.component.scss']
})
export class RegisterTechInvitationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  token = '';
  invitation: TechInvitationValidationResponse | null = null;

  loadingValidation = true;
  submitting = false;

  pageError: string | null = null;
  submitError: string | null = null;
  submitSuccess: string | null = null;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    phone: ['', [Validators.maxLength(30)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(120)]]
  });

  ngOnInit(): void {
    this.token = (this.route.snapshot.queryParamMap.get('token') ?? '').trim();
    console.log('TOKEN FROM URL =', this.token);

    if (!this.token) {
      this.loadingValidation = false;
      this.pageError = 'Invitation token is missing.';
      this.cdr.detectChanges();
      return;
    }

    console.log('Calling validateTechInvitation...');

    this.authService
      .validateTechInvitation(this.token)
      .pipe(
        finalize(() => {
          console.log('Validation request finished');
          this.loadingValidation = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Validation response =', response);
          this.invitation = response;

          if (!response.valid) {
            this.pageError = response.message || 'This invitation is not valid.';
            this.form.disable();
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Validation error =', err);
          this.pageError =
            err?.error?.message ||
            err?.error?.error ||
            'Unable to validate invitation. Please try again later.';

          this.cdr.detectChanges();
        }
      });
  }

  get canShowForm(): boolean {
    return !!this.invitation?.valid && !this.pageError;
  }

  get firstNameCtrl() {
    return this.form.controls.firstName;
  }

  get lastNameCtrl() {
    return this.form.controls.lastName;
  }

  get phoneCtrl() {
    return this.form.controls.phone;
  }

  get passwordCtrl() {
    return this.form.controls.password;
  }

  submit(): void {
    this.submitError = null;
    this.submitSuccess = null;

    if (!this.canShowForm) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: TechRegisterRequest = {
      token: this.token,
      firstName: this.firstNameCtrl.value.trim(),
      lastName: this.lastNameCtrl.value.trim(),
      password: this.passwordCtrl.value,
      phone: this.phoneCtrl.value?.trim() || null
    };

    this.submitting = true;
    this.form.disable();
    this.cdr.detectChanges();

    this.authService
      .registerTechInvitation(payload)
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.form.enable();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.submitSuccess =
            'Your technician account request has been submitted successfully. It is now pending approval.';

          this.form.reset({
            firstName: '',
            lastName: '',
            phone: '',
            password: ''
          });

          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.submitError =
            err?.error?.message ||
            err?.error?.error ||
            'Registration failed. Please verify your data and try again.';
          this.cdr.detectChanges();
        }
      });
  }
}