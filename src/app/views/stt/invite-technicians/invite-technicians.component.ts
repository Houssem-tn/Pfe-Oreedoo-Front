import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { TechInvitation, TechInvitationService } from '../../../core/invitations/tech-invitation.service';
import { SwalService } from '../../../core/ui/swal.service';

@Component({
  selector: 'app-invite-technicians',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invite-technicians.component.html'
})
export class InviteTechniciansComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invitationService = inject(TechInvitationService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  protected loading = false;
  protected submitting = false;
  protected invitations: TechInvitation[] = [];
  protected successMessage = '';
  protected errorMessage = '';

  protected form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

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
          this.errorMessage = this.extractErrorMessage(err, 'Failed to load invitations');
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected async submit(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.swal.error('Invalid form', 'Please enter a valid technician email.');
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    const email = this.form.value.email?.trim() ?? '';
    if (!email) {
      this.errorMessage = 'Please enter a valid email.';
      void this.swal.error('Invalid email', this.errorMessage);
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    const confirm = await this.swal.confirmAction(
      'Send invitation?',
      `An invitation will be sent to ${email}.`,
      'Send'
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
            : 'Invitation sent successfully';
          void this.swal.success('Invitation sent', this.successMessage);

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
                  'Invitation sent, but failed to refresh list'
                );
                void this.swal.error('Refresh failed', this.errorMessage);
                this.zone.run(() => this.cdr.detectChanges());
              }
            });
        },
        error: (err) => {
          console.error('Failed to send invitation:', err);
          this.errorMessage = this.extractErrorMessage(err, 'Failed to send invitation');
          void this.swal.error('Send failed', this.errorMessage);
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
}