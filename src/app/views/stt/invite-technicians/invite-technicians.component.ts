import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { TechInvitation, TechInvitationService } from '../../../core/invitations/tech-invitation.service';

@Component({
  selector: 'app-invite-technicians',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invite-technicians.component.html'
})
export class InviteTechniciansComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invitationService = inject(TechInvitationService);
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
          this.errorMessage = err?.error?.message || 'Failed to load invitations';
          this.zone.run(() => this.cdr.detectChanges());
        }
      });
  }

  protected submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.zone.run(() => this.cdr.detectChanges());
      return;
    }

    const email = this.form.value.email?.trim() ?? '';
    if (!email) return;

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
          this.successMessage = message || 'Invitation sent successfully';
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
                this.errorMessage = err?.error?.message || 'Invitation sent, but failed to refresh list';
                this.zone.run(() => this.cdr.detectChanges());
              }
            });
        },
        error: (err) => {
          console.error('Failed to send invitation:', err);
          this.errorMessage = err?.error?.message || err?.error || 'Failed to send invitation';
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
}