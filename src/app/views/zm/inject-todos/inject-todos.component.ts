import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs/operators';

import { SwalService } from '../../../core/ui/swal.service';
import { TodoImportService, ZmFieldWorkImportResponse } from '../../../core/todo-import/todo-import.service';
import { AppUser } from '../../../core/users/user.model';
import { UserService } from '../../../core/users/user.service';

type ImportSummaryCard = {
  label: string;
  value: string;
  tone: 'primary' | 'warning' | 'danger' | 'success' | 'neutral';
};

@Component({
  selector: 'app-inject-todos',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective],
  templateUrl: './inject-todos.component.html',
  styleUrl: './inject-todos.component.scss'
})
export class InjectTodosComponent implements OnInit {
  private readonly todoImportService = inject(TodoImportService);
  private readonly userService = inject(UserService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  selectedFile: File | null = null;
  selectedBusinessType: 'PLT' | 'RES' | '' = '';
  selectedDispatchMode: 'BY_ONLINE_USER' | 'BY_GOVERNORATE' = 'BY_GOVERNORATE';
  profile: AppUser | null = null;
  profileLoading = false;
  processing = false;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  result: ZmFieldWorkImportResponse | null = null;

  ngOnInit(): void {
    this.profileLoading = true;

    this.userService.getMe()
      .pipe(
        finalize(() => {
          this.profileLoading = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.detectViewChanges();
        },
        error: () => {
          this.profile = null;
          this.detectViewChanges();
        }
      });
  }

  get connectedZmName(): string {
    return this.profile?.fullName?.trim() || 'Connected Zone Manager';
  }

  get managerKeyUsed(): string {
    return this.buildExcelManagerKey(this.profile?.fullName) || '-';
  }

  get isComplaintCasesTarget(): boolean {
    return this.result?.target === 'COMPLAINT_CASES';
  }

  /** RES imports also create cases (COMPLAINT_CASES target) but live on the dedicated resiliation board. */
  get isResTarget(): boolean {
    return this.isComplaintCasesTarget && this.result?.businessType === 'RES';
  }

  get primaryResultLabel(): string {
    if (this.isResTarget) return 'Resiliation cases created';
    return this.isComplaintCasesTarget ? 'Complaint cases created' : 'Field todos created';
  }

  get primaryResultValue(): number {
    if (!this.result) return 0;
    return this.isComplaintCasesTarget
      ? (this.result.createdComplaintCasesCount ?? 0)
      : (this.result.createdWorkTodoCount ?? 0);
  }

  get primaryResultRoute(): string {
    if (this.isResTarget) return '/zm/cases/resiliation';
    return this.isComplaintCasesTarget ? '/zm/cases/complaint' : '/zm/imported-todos';
  }

  get importSummaryCards(): ImportSummaryCard[] {
    return [
      {
        label: 'Total rows in file',
        value: this.formatMetric(this.result?.totalRows ?? 0),
        tone: 'neutral'
      },
      {
        label: 'Matched your ZM',
        value: this.formatMetric(this.result?.matchedConnectedZmRows ?? 0),
        tone: 'primary'
      },
      {
        label: 'En cours rows',
        value: this.formatMetric(this.result?.enCoursRows ?? 0),
        tone: 'primary'
      },
      {
        label: this.primaryResultLabel,
        value: this.formatMetric(this.primaryResultValue),
        tone: 'success'
      },
      {
        label: 'Ignored (other ZM)',
        value: this.formatMetric(this.result?.ignoredOtherZmCount ?? 0),
        tone: 'warning'
      },
      {
        label: 'Ignored (not En cours)',
        value: this.formatMetric(this.result?.ignoredStatusCount ?? 0),
        tone: 'warning'
      },
      {
        label: 'Duplicates skipped',
        value: this.formatMetric(this.result?.duplicateCount ?? 0),
        tone: 'warning'
      },
      {
        label: 'Invalid rows',
        value: this.formatMetric(this.result?.invalidRowsCount ?? 0),
        tone: 'danger'
      }
    ];
  }

  selectBusinessType(type: 'PLT' | 'RES'): void {
    this.selectedBusinessType = type;
    this.detectViewChanges();
  }

  selectDispatchMode(mode: 'BY_ONLINE_USER' | 'BY_GOVERNORATE'): void {
    this.selectedDispatchMode = mode;
    this.detectViewChanges();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.selectedFile = input?.files?.[0] ?? null;
    this.result = null;
    this.errorMessage = null;
    this.infoMessage = null;
    this.detectViewChanges();
  }

  processUpload(): void {
    if (!this.selectedBusinessType) {
      this.errorMessage = 'Select the file type (PLT or RES) before starting the import.';
      this.detectViewChanges();
      return;
    }

    if (!this.selectedFile) {
      this.errorMessage = 'Select a CSV/XLS/XLSX file before starting the import.';
      this.detectViewChanges();
      return;
    }

    this.processing = true;
    this.errorMessage = null;
    this.infoMessage = null;

    this.todoImportService.process(
      this.selectedFile,
      this.selectedBusinessType,
      this.selectedDispatchMode
    )
      .pipe(
        finalize(() => {
          this.processing = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: async (response) => {
          this.result = response;

          const isComplaints = response.target === 'COMPLAINT_CASES';
          const createdCount = isComplaints
            ? (response.createdComplaintCasesCount ?? 0)
            : (response.createdWorkTodoCount ?? 0);

          if (createdCount === 0) {
            this.infoMessage = isComplaints
              ? 'No new complaint cases were created. Verify that the file contains rows assigned to you with STATUT = En cours.'
              : 'No new field work todos were created. Verify the file type and that the file contains rows assigned to you with STATUT = En cours.';
          } else if (response.invalidRowsCount > 0) {
            this.infoMessage = isComplaints
              ? `${response.invalidRowsCount} row(s) had missing fields (e.g. CRM_CASE) and could not become complaint cases.`
              : `${response.invalidRowsCount} saved todo(s) have validation issues. They are accessible in Field Todos.`;
          }

          this.detectViewChanges();

          const successTitle = isComplaints ? 'PLT import completed' : 'Import completed';
          const baseMsg = isComplaints
            ? `${createdCount} complaint case(s) created in your ZM workspace. ${response.message}`
            : `${createdCount} field work todo(s) created. ${response.message}`;

          const dispatchLine = response.dispatchMode === 'BY_ONLINE_USER'
            ? `\n\nAssignment: By Online User${response.dispatchModeUserName ? ` (${response.dispatchModeUserName})` : ''}`
            : response.dispatchMode === 'BY_GOVERNORATE'
              ? '\n\nAssignment: By Governorate coverage'
              : '';

          await this.swal.success(successTitle, `${baseMsg}${dispatchLine}`);
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to import the file for the connected Zone Manager.';
          this.result = null;
          this.errorMessage = message;
          this.detectViewChanges();
          await this.swal.error('Import failed', message);
        }
      });
  }

  formatMetric(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private buildExcelManagerKey(fullName?: string | null): string | null {
    if (!fullName?.trim()) {
      return null;
    }

    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }

    if (parts.length === 1) {
      return parts[0];
    }

    const [firstName, ...lastNameParts] = parts;
    return `${lastNameParts.join(' ')} ${firstName}`.trim();
  }

  private detectViewChanges(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
