import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { finalize } from 'rxjs/operators';

import { TUNISIA_GOVERNORATES } from '../../../core/shared/tunisia-governorates';
import { SwalService } from '../../../core/ui/swal.service';
import {
  ImportedTodoListItem,
  ImportedTodoPageResponse,
  TodoImportService
} from '../../../core/todo-import/todo-import.service';

@Component({
  selector: 'app-imported-todos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective],
  templateUrl: './imported-todos.component.html',
  styleUrl: './imported-todos.component.scss'
})
export class ImportedTodosComponent implements OnInit {
  private readonly todoImportService = inject(TodoImportService);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  private static readonly PAGE_WINDOW = 5;

  readonly governorateOptions = [...TUNISIA_GOVERNORATES];

  readonly pageSizeOptions = [25, 50, 100];
  readonly rowQualityOptions = [
    { value: '', label: 'All rows' },
    { value: 'valid', label: 'Valid rows only' },
    { value: 'invalid', label: 'Invalid rows only' }
  ];
  readonly businessTypeOptions = [
    { value: '', label: 'All types' },
    { value: 'PLT', label: 'PLT' },
    { value: 'RES', label: 'RES' }
  ];
  readonly workflowStatusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'READY_FOR_STT_ASSIGNMENT', label: 'Ready for STT' },
    { value: 'ASSIGNED_TO_STT', label: 'Assigned to STT' },
    { value: 'ASSIGNED_TO_TECH', label: 'Assigned to Tech' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'TECH_COMPLETED', label: 'Tech Completed' },
    { value: 'STT_VALIDATED', label: 'STT Validated' },
    { value: 'ZM_VALIDATED', label: 'ZM Validated' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'BLOCKED', label: 'Blocked' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'PENDING_ZM_REVIEW', label: 'Pending ZM Review' }
  ];

  loading = false;
  errorMessage: string | null = null;

  searchTerm = '';
  selectedStatus = '';
  selectedRowQuality = '';
  selectedGouvernorat = '';
  selectedBusinessType = '';
  selectedWorkflowStatus = '';
  uploadedFrom = '';
  uploadedTo = '';
  currentPage = 1;
  pageSize = 50;

  result: ImportedTodoPageResponse = {
    items: [],
    totalElements: 0,
    totalPages: 0,
    page: 0,
    size: 50
  };

  ngOnInit(): void {
    this.loadImportedTodos();
  }

  get items(): ImportedTodoListItem[] {
    return this.result.items;
  }

  get totalElements(): number {
    return this.result.totalElements;
  }

  get totalPages(): number {
    return Math.max(1, this.result.totalPages || 0);
  }

  get pages(): number[] {
    const total = this.result.totalPages;
    if (total <= 0) {
      return [];
    }

    const halfWindow = Math.floor(ImportedTodosComponent.PAGE_WINDOW / 2);
    let start = Math.max(1, this.currentPage - halfWindow);
    let end = Math.min(total, start + ImportedTodosComponent.PAGE_WINDOW - 1);

    if (end - start + 1 < ImportedTodosComponent.PAGE_WINDOW) {
      start = Math.max(1, end - ImportedTodosComponent.PAGE_WINDOW + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  get hasRows(): boolean {
    return this.items.length > 0;
  }

  get rangeStart(): number {
    if (this.totalElements === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    if (this.totalElements === 0) return 0;
    return Math.min(this.currentPage * this.pageSize, this.totalElements);
  }

  get activeFiltersCount(): number {
    return [
      this.searchTerm.trim(),
      this.selectedStatus.trim(),
      this.selectedRowQuality.trim(),
      this.selectedGouvernorat.trim(),
      this.selectedBusinessType.trim(),
      this.selectedWorkflowStatus.trim(),
      this.uploadedFrom.trim(),
      this.uploadedTo.trim()
    ].filter(Boolean).length;
  }

  workflowStatusLabel(status?: string | null): string {
    if (!status) return '';
    return this.workflowStatusOptions.find(o => o.value === status)?.label ?? status;
  }

  loadImportedTodos(): void {
    this.loading = true;
    this.errorMessage = null;

    this.todoImportService.list({
      page: this.currentPage - 1,
      size: this.pageSize,
      search: this.searchTerm,
      statut: this.selectedStatus,
      rowQuality: this.selectedRowQuality,
      gouvernorat: this.selectedGouvernorat,
      businessType: this.selectedBusinessType,
      workflowStatus: this.selectedWorkflowStatus,
      uploadedFrom: this.uploadedFrom,
      uploadedTo: this.uploadedTo
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.detectViewChanges();
        })
      )
      .subscribe({
        next: (response) => {
          this.result = response;
          this.currentPage = response.totalPages > 0
            ? Math.min(this.currentPage, response.totalPages)
            : 1;
          this.detectViewChanges();
        },
        error: async (err) => {
          const message = err?.error?.message ?? 'Failed to load imported todos.';
          this.errorMessage = message;
          this.result = {
            items: [],
            totalElements: 0,
            totalPages: 0,
            page: 0,
            size: this.pageSize
          };
          this.detectViewChanges();
          await this.swal.error('Imported todos unavailable', message);
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadImportedTodos();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedRowQuality = '';
    this.selectedGouvernorat = '';
    this.selectedBusinessType = '';
    this.selectedWorkflowStatus = '';
    this.uploadedFrom = '';
    this.uploadedTo = '';
    this.pageSize = 50;
    this.currentPage = 1;
    this.loadImportedTodos();
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.loadImportedTodos();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadImportedTodos();
  }

  trackById(_: number, item: ImportedTodoListItem): string {
    return item.id;
  }

  trackByIssue(_: number, issue: string): string {
    return issue;
  }

  private detectViewChanges(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }
}
