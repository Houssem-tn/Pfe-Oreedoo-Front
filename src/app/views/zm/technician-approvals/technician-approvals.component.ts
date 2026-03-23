import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { TechInvitation, TechInvitationService } from '../../../core/invitations/tech-invitation.service';

@Component({
  selector: 'app-technician-approvals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './technician-approvals.component.html'
})
export class TechnicianApprovalsComponent implements OnInit {
  private readonly invitationService = inject(TechInvitationService);

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
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load pending approvals';
        this.loading = false;
      }
    });
  }

  protected decide(invitationId: string, approve: boolean): void {
    this.actionLoadingId = invitationId;
    this.successMessage = '';
    this.errorMessage = '';

    this.invitationService.decideByZm(invitationId, approve).subscribe({
      next: (message) => {
        this.successMessage = message || 'Decision saved successfully';
        this.actionLoadingId = null;
        this.load();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.error || 'Failed to process decision';
        this.actionLoadingId = null;
      }
    });
  }
}