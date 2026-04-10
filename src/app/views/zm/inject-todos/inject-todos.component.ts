import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs/operators';

import { SwalService } from '../../../core/ui/swal.service';
import {
  ImportedTodoPreviewRow,
  TodoImportInjectResponse,
  TodoImportPreviewResponse,
  TodoImportService
} from '../../../core/todo-import/todo-import.service';

@Component({
  selector: 'app-inject-todos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconDirective],
  templateUrl: './inject-todos.component.html',
  styleUrl: './inject-todos.component.scss'
})
export class InjectTodosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly todoImportService = inject(TodoImportService);
  private readonly swal = inject(SwalService);

  readonly form = this.fb.nonNullable.group({
    managerFilter: ['', [Validators.required, Validators.maxLength(120)]]
  });

  selectedFile: File | null = null;
  previewLoading = false;
  injectLoading = false;
  errorMessage: string | null = null;
  warningMessage: string | null = null;
  preview: TodoImportPreviewResponse | null = null;
  injectResult: TodoImportInjectResponse | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.selectedFile = file;
    this.clearResults();
  }

  onManagerFilterInput(): void {
    this.clearResults();
  }

  previewFilteredRows(): void {
    if (!this.validateForm()) {
      return;
    }

    this.previewLoading = true;
    this.errorMessage = null;
    this.warningMessage = null;
    this.injectResult = null;

    this.todoImportService.preview(this.selectedFile as File, this.managerFilter)
      .pipe(finalize(() => { this.previewLoading = false; }))
      .subscribe({
        next: (response) => {
          this.preview = response;

          if (response.matchedRows === 0) {
            this.warningMessage = 'No Excel rows matched the provided ZONE_MNANAGER filter.';
            return;
          }

          if (response.readyRows === 0) {
            this.warningMessage = 'Matching rows were found, but none are ready to inject because of validation or duplicate checks.';
            return;
          }

          if (response.invalidRows > 0 || response.duplicateRows > 0) {
            this.warningMessage = 'Some matching rows will be skipped because they are invalid or already imported.';
          }
        },
        error: async (err) => {
          this.preview = null;
          const message = err?.error?.message ?? 'Failed to preview the uploaded todo file.';
          this.errorMessage = message;
          await this.swal.error('Preview failed', message);
        }
      });
  }

  injectTodos(): void {
    if (!this.validateForm()) {
      return;
    }

    if (!this.preview || this.preview.readyRows === 0) {
      this.warningMessage = 'Preview the file first and make sure there are rows ready to inject.';
      return;
    }

    this.injectLoading = true;
    this.errorMessage = null;

    this.todoImportService.inject(this.selectedFile as File, this.managerFilter)
      .pipe(finalize(() => { this.injectLoading = false; }))
      .subscribe({
        next: async (response) => {
          this.injectResult = response;
          this.warningMessage = null;
          await this.swal.success(
            'Todos injected',
            `${response.savedRows} filtered todo(s) were saved successfully in batch ${response.importBatchId}.`
          );
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to inject the filtered todos.';
          this.errorMessage = message;
          await this.swal.error('Injection failed', message);
        }
      });
  }

  get managerFilter() : string {
    return this.form.controls.managerFilter.value.trim();
  }

  get previewRows(): ImportedTodoPreviewRow[] {
    return this.preview?.previewRows ?? [];
  }

  get hasPreview(): boolean {
    return !!this.preview;
  }

  get canInject(): boolean {
    return !!this.selectedFile && !!this.preview && this.preview.readyRows > 0 && !this.injectLoading;
  }

  rowStatusLabel(row: ImportedTodoPreviewRow): string {
    if (row.readyToInject) {
      return 'Ready';
    }

    if (row.issues.some((issue) => issue.toLowerCase().includes('duplicate'))) {
      return 'Duplicate';
    }

    return 'Invalid';
  }

  rowStatusClass(row: ImportedTodoPreviewRow): string {
    if (row.readyToInject) {
      return 'bg-success-subtle text-success-emphasis';
    }

    if (row.issues.some((issue) => issue.toLowerCase().includes('duplicate'))) {
      return 'bg-warning-subtle text-warning-emphasis';
    }

    return 'bg-danger-subtle text-danger-emphasis';
  }

  issueLabel(row: ImportedTodoPreviewRow): string {
    return row.issues.join(' | ');
  }

  private validateForm(): boolean {
    this.form.markAllAsTouched();
    this.errorMessage = null;
    this.warningMessage = null;

    if (!this.selectedFile) {
      this.errorMessage = 'Select an Excel file before previewing or injecting todos.';
      return false;
    }

    if (this.form.invalid) {
      this.errorMessage = 'Manager Name is required.';
      return false;
    }

    return true;
  }

  private clearResults(): void {
    this.preview = null;
    this.injectResult = null;
    this.errorMessage = null;
    this.warningMessage = null;
  }
}
