import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs/operators';

import { SwalService } from '../../../core/ui/swal.service';
import { TodoImportService, ZmTodoImportProcessResponse } from '../../../core/todo-import/todo-import.service';
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
  profile: AppUser | null = null;
  profileLoading = false;
  processing = false;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  result: ZmTodoImportProcessResponse | null = null;

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

  get importSummaryCards(): ImportSummaryCard[] {
    return [
      {
        label: 'Rows in file',
        value: this.formatMetric(this.result?.totalRows ?? 0),
        tone: 'neutral'
      },
      {
        label: 'Matched rows',
        value: this.formatMetric(this.result?.matchedRows ?? 0),
        tone: 'primary'
      },
      {
        label: 'Ignored rows',
        value: this.formatMetric(this.result?.ignoredRows ?? 0),
        tone: 'warning'
      },
      {
        label: 'Saved rows',
        value: this.formatMetric(this.result?.savedRows ?? 0),
        tone: 'success'
      },
      {
        label: 'Invalid matched rows',
        value: this.formatMetric(this.result?.invalidMatchedRows ?? 0),
        tone: 'danger'
      }
    ];
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
    if (!this.selectedFile) {
      this.errorMessage = 'Select a CSV/XLS/XLSX file before starting the import.';
      return;
    }

    this.processing = true;
    this.errorMessage = null;
    this.infoMessage = null;

    this.todoImportService.process(this.selectedFile)
      .pipe(
        finalize(() => {
          this.processing = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: async (response) => {
          this.result = response;

          if (response.savedRows === 0) {
            this.infoMessage = 'The file was processed and the analysis was saved, but no matched rows were stored in Imported Todos.';
          } else if (response.invalidMatchedRows > 0) {
            this.infoMessage = `${response.invalidMatchedRows} matched row(s) were saved as invalid rows in Imported Todos and are also reflected in Todos Analysis.`;
          }

          this.detectViewChanges();

          await this.swal.success(
            'Import completed',
            `${response.savedRows} matched row(s) were saved and the analysis snapshot was stored for ${this.connectedZmName}.`
          );
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
