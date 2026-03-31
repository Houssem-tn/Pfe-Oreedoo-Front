import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ButtonDirective } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { AuthStore } from '../../core/auth/auth.store';
import { CasesService } from '../../core/cases/cases.service';
import { CreateCaseRequest } from '../../core/cases/models/case.model';
import { SwalService } from '../../core/ui/swal.service';

@Component({
  selector: 'app-create-activation-case',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ButtonDirective, IconDirective],
  templateUrl: './create-activation-case.component.html',
  styleUrl: './create-activation-case.component.scss'
})
export class CreateActivationCaseComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly casesService = inject(CasesService);
  private readonly authStore = inject(AuthStore);
  private readonly swal = inject(SwalService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  submitting = false;

  readonly form = this.fb.group({
    crmCase: ['', [Validators.required, Validators.maxLength(80)]],
    dateCreationCrm: ['', [Validators.required]],
    openingDateTimos: ['', [Validators.required]],
    clientName: ['', [Validators.required, Validators.maxLength(120)]],
    clientPhone: ['', [Validators.required, Validators.maxLength(30)]],
    msisdn: ['', [Validators.required, Validators.maxLength(40)]],
    commentaire: ['', [Validators.maxLength(500)]],
    latitude: ['', [Validators.maxLength(80)]],
    longitude: ['', [Validators.maxLength(80)]],
    localite: ['', [Validators.required, Validators.maxLength(120)]],
    delegation: ['', [Validators.required, Validators.maxLength(120)]],
    gouvernorat: ['', [Validators.required, Validators.maxLength(120)]],
    siteSecteur: ['', [Validators.maxLength(120)]],
    offre: ['', [Validators.maxLength(120)]],
    desPack: ['', [Validators.maxLength(120)]]
  });

  ngOnInit(): void {
    if (this.authStore.role() !== 'ROLE_ADMIN') {
      void this.swal.error('Access denied', 'Only ADMIN can create activation cases.');
      void this.router.navigateByUrl(this.listRoute);
    }
  }

  get listRoute(): string {
    return this.authStore.role() === 'ROLE_ADMIN'
      ? '/admin/cases/activation'
      : '/zm/cases/activation';
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.swal.error('Invalid form', 'Please fill all required fields before submit.');
      return;
    }

    const formValue = this.form.getRawValue();

    const confirm = await this.swal.confirmAction(
      'Create activation case?',
      `CRM case ${formValue.crmCase} will be created.`,
      'Create'
    );

    if (!confirm.isConfirmed) {
      return;
    }

    const payload: CreateCaseRequest = {
      type: 'ACTIVATION',
      crmCase: (formValue.crmCase ?? '').trim(),
      dateCreationCrm: this.toIso(formValue.dateCreationCrm || ''),
      openingDateTimos: this.toIso(formValue.openingDateTimos || ''),
      clientName: (formValue.clientName ?? '').trim(),
      clientPhone: (formValue.clientPhone ?? '').trim(),
      msisdn: (formValue.msisdn ?? '').trim(),
      commentaire: (formValue.commentaire ?? '').trim(),
      latitude: (formValue.latitude ?? '').trim(),
      longitude: (formValue.longitude ?? '').trim(),
      localite: (formValue.localite ?? '').trim(),
      delegation: (formValue.delegation ?? '').trim(),
      gouvernorat: (formValue.gouvernorat ?? '').trim(),
      siteSecteur: (formValue.siteSecteur ?? '').trim(),
      offre: (formValue.offre ?? '').trim(),
      desPack: (formValue.desPack ?? '').trim()
    };

    this.submitting = true;

    this.casesService.createCase(payload)
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: async () => {
          await this.swal.success('Case created', 'Activation case created successfully.');
          await this.router.navigateByUrl(this.listRoute);
        },
        error: async (err) => {
          console.error('Failed to create activation case:', err);
          const message = err?.error?.message ?? 'Failed to create activation case';
          await this.swal.error('Creation failed', message);
        }
      });
  }

  invalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  errorFor(fieldName: string, label: string): string {
    const control = this.form.get(fieldName);
    if (!control || !this.invalid(fieldName)) {
      return '';
    }

    if (control.hasError('required')) {
      return `${label} is required.`;
    }

    if (control.hasError('maxlength')) {
      const requiredLength = control.getError('maxlength')?.requiredLength;
      return `${label} must be at most ${requiredLength} characters.`;
    }

    return `${label} is invalid.`;
  }

  private toIso(value: string): string {
    return new Date(value).toISOString();
  }
}
