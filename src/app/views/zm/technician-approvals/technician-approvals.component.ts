import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { TechInvitation, TechInvitationService } from '../../../core/invitations/tech-invitation.service';
import { SwalService } from '../../../core/ui/swal.service';

@Component({
  selector: 'app-technician-approvals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './technician-approvals.component.html'
})
export class TechnicianApprovalsComponent implements OnInit {
  private readonly invitationService = inject(TechInvitationService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected loading = false;
  protected actionLoadingId: string | null = null;
  protected invitations: TechInvitation[] = [];
  protected successMessage = '';
  protected errorMessage = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.invitationService.getPendingZmApprovals().subscribe({
      next: (data) => {
        this.invitations = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load pending approvals';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  protected async decide(invitationId: string, approve: boolean): Promise<void> {
    const actionLabel = approve ? 'approve' : 'reject';
    const confirm = await this.swal.confirmAction(
      `${approve ? 'Approve' : 'Reject'} technician?`,
      `Are you sure you want to ${actionLabel} this technician invitation?`,
      approve ? 'Approve' : 'Reject'
    );

    if (!confirm.isConfirmed) {
      return;
    }

    this.actionLoadingId = invitationId;
    this.successMessage = '';
    this.errorMessage = '';

    this.invitationService.decideByZm(invitationId, approve).subscribe({
      next: (message) => {
        this.successMessage = message || 'Decision saved successfully';
        this.actionLoadingId = null;
        void this.swal.success(
          approve ? 'Technician approved' : 'Technician rejected',
          this.successMessage
        );
        this.load();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.error || 'Failed to process decision';
        this.actionLoadingId = null;
        void this.swal.error('Action failed', this.errorMessage);
      }
    });
  }
}