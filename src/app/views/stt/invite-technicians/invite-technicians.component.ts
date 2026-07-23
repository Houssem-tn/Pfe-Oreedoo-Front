import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';
import { TechInvitation, TechInvitationService } from '../../../core/invitations/tech-invitation.service';
import { SwalService } from '../../../core/ui/swal.service';
import { getValidationMessage } from '../../../shared/validation/validation-message.util';

@Component({
  selector: 'app-invite-technicians',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconDirective, TranslocoModule],
  templateUrl: './invite-technicians.component.html',
  styleUrl: './invite-technicians.component.scss'
})
export class InviteTechniciansComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invitationService = inject(TechInvitationService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly transloco = inject(TranslocoService);

  protected loading = false;
  protected submitting = false;
  protected invitations: TechInvitation[] = [];
  protected successMessage = '';
  protected errorMessage = '';

  protected form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected get summaryCards(): Array<{ label: string; value: number; icon: string; tone: string }> {
    return [
      {
        label: 'invitations.totalInvitations',
        value: this.invitations.length,
        icon: 'cilEnvelopeOpen',
        tone: 'brand'
      },
      {
        label: 'statuses.invitation.pendingRegistration',
        value: this.invitations.filter((item) => item.status === 'PENDING_REGISTRATION').length,
        icon: 'cilAlarm',
        tone: 'warning'
      },
      {
        label: 'statuses.invitation.registeredPendingZmApproval',
        value: this.invitations.filter((item) => item.status === 'REGISTERED_PENDING_ZM_APPROVAL').length,
        icon: 'cilClock',
        tone: 'soft'
      },
      {
        label: 'statuses.invitation.approvedByZm',
        value: this.invitations.filter((item) => item.status === 'APPROVED_BY_ZM').length,
        icon: 'cilCheckCircle',
        tone: 'success'
      }
    ];
  }

  protected get emailErrorMessage(): string {
    return getValidationMessage(this.transloco, this.form.controls.email.errors);
  }

  protected get sortedInvitations(): TechInvitation[] {
    return [...this.invitations].sort((left, right) => this.toEpoch(right.createdAt) - this.toEpoch(left.createdAt));
  }

  ngOnInit(): void {
    this.loadInvitations();
  }

  protected loadInvitations(): void {
    if (this.loading) return;

    this.loading = true;
    this.errorMessage = '';

    this.invitationService.getMySttInvitations()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (data) => {
          this.invitations = [...(data ?? [])];
          this.zone.run(() => this.cdr.detectChanges());
        },
        error: (err) => {
          console.error('Failed to load invitations:', err);
          this.errorMessage = this.extractErrorMessage(err, this.transloco.translate('invitations.loadFailedFallback'));
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected async submit(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.swal.error(this.transloco.translate('invitations.invalidFormTitle'), this.transloco.translate('invitations.invalidFormText'));
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    const email = this.form.value.email?.trim() ?? '';
    if (!email) {
      this.errorMessage = this.transloco.translate('validation.email');
      void this.swal.error(this.transloco.translate('invitations.invalidEmailTitle'), this.errorMessage);
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    const confirm = await this.swal.confirmAction(
      this.transloco.translate('invitations.sendConfirmTitle'),
      this.transloco.translate('invitations.sendConfirmText', { email }),
      this.transloco.translate('invitations.sendConfirmButton')
    );

    if (!confirm.isConfirmed) {
      return;
    }

    this.submitting = true;

    this.invitationService.sendInvitation(email)
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (message) => {
          this.successMessage = typeof message === 'string'
            ? message
            : this.transloco.translate('invitations.invitationSentDefault');
          void this.swal.success(this.transloco.translate('invitations.invitationSentTitle'), this.successMessage);

          this.form.reset();

          this.invitationService.getMySttInvitations()
            .pipe(
              finalize(() => {
                this.zone.run(() => this.cdr.detectChanges());
              })
            )
            .subscribe({
              next: (data) => {
                this.invitations = [...(data ?? [])];
                this.zone.run(() => this.cdr.detectChanges());
              },
              error: (err) => {
                console.error('Failed to reload invitations after send:', err);
                this.errorMessage = this.extractErrorMessage(
                  err,
                  this.transloco.translate('invitations.refreshFailedFallback')
                );
                void this.swal.error(this.transloco.translate('invitations.refreshFailedTitle'), this.errorMessage);
                this.zone.run(() => this.cdr.detectChanges());
              }
            });
        },
        error: (err) => {
          console.error('Failed to send invitation:', err);
          this.errorMessage = this.extractErrorMessage(err, this.transloco.translate('invitations.sendFailedFallback'));
          void this.swal.error(this.transloco.translate('invitations.sendFailedTitle'), this.errorMessage);
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected badgeClass(status: string): string {
    switch (status) {
      case 'PENDING_REGISTRATION':
        return 'bg-warning text-dark';
      case 'REGISTERED_PENDING_ZM_APPROVAL':
        return 'bg-info text-dark';
      case 'APPROVED_BY_ZM':
        return 'bg-success';
      case 'REJECTED_BY_ZM':
        return 'bg-danger';
      case 'EXPIRED':
        return 'bg-secondary';
      default:
        return 'bg-light text-dark';
    }
  }

  protected trackByInvitation(index: number, item: TechInvitation): string {
    return item.id ?? item.email ?? index.toString();
  }

  private static readonly STATUS_KEYS: Record<string, string> = {
    PENDING_REGISTRATION: 'statuses.invitation.pendingRegistration',
    REGISTERED_PENDING_ZM_APPROVAL: 'statuses.invitation.registeredPendingZmApproval',
    APPROVED_BY_ZM: 'statuses.invitation.approvedByZm',
    REJECTED_BY_ZM: 'statuses.invitation.rejectedByZm',
    EXPIRED: 'statuses.invitation.expired',
    CANCELLED: 'statuses.invitation.cancelled'
  };

  protected statusLabel(status?: string | null): string {
    if (!status?.trim()) {
      return '-';
    }

    const key = InviteTechniciansComponent.STATUS_KEYS[status.trim().toUpperCase()];
    return key ? this.transloco.translate(key) : status;
  }

  private extractErrorMessage(err: any, fallback: string): string {
    if (typeof err?.error === 'string') {
      try {
        const parsed = JSON.parse(err.error);
        return parsed?.message || err.error || fallback;
      } catch {
        return err.error || fallback;
      }
    }

    return err?.error?.message || err?.message || fallback;
  }

  private toEpoch(value?: string | null): number {
    if (!value) {
      return 0;
    }

    const epoch = Date.parse(value);
    return Number.isNaN(epoch) ? 0 : epoch;
  }
}
