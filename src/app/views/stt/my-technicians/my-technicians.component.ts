import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { IconDirective } from '@coreui/icons-angular';

import { TechnicianListItem } from '../../../core/stt/models/technician-list-item.model';
import { SttTechnicianApiService } from '../../../core/stt/stt-technician-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, IconDirective],
  templateUrl: './my-technicians.component.html',
  styleUrl: './my-technicians.component.scss'
})
export class MyTechniciansComponent implements OnInit {
  private readonly api = inject(SttTechnicianApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  technicians: TechnicianListItem[] = [];
  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedStatus = '';

  currentPage = 1;
  pageSize = 6;
  readonly pageSizeOptions = [4, 6, 12];

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.api.getMyTechnicians()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (data) => {
          this.technicians = data ?? [];
          this.currentPage = 1;
        },
        error: (err) => {
          console.error('Error loading technicians:', err);
          this.error = err?.error?.message ?? 'Failed to load technicians';
        }
      });
  }

  get filteredTechnicians(): TechnicianListItem[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.technicians.filter((t) => {
      const matchesSearch =
        !term ||
        t.fullName.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        (t.phone ?? '').toLowerCase().includes(term);

      const matchesStatus =
        !this.selectedStatus || t.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTechnicians.length / this.pageSize));
  }

  get paginatedTechnicians(): TechnicianListItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTechnicians.slice(start, start + this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get summaryCards(): Array<{ label: string; value: number; icon: string; tone: string }> {
    return [
      { label: 'Total technicians', value: this.technicians.length, icon: 'cilPeople', tone: 'brand' },
      { label: 'Approved', value: this.technicians.filter((item) => item.status === 'APPROVED').length, icon: 'cilCheckCircle', tone: 'success' },
      { label: 'Pending', value: this.technicians.filter((item) => item.status === 'PENDING').length, icon: 'cilAlarm', tone: 'warning' },
      { label: 'Enabled', value: this.technicians.filter((item) => item.enabled).length, icon: 'cilUserFollow', tone: 'soft' }
    ];
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.currentPage = 1;
  }

  rangeLabel(): string {
    if (this.filteredTechnicians.length === 0) {
      return '0 of 0';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredTechnicians.length);
    return `${start}-${end} of ${this.filteredTechnicians.length}`;
  }

  statusBadgeClass(status?: string): string {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-subtle text-success-emphasis';
      case 'REJECTED':
        return 'bg-danger-subtle text-danger-emphasis';
      case 'PENDING':
      default:
        return 'bg-warning-subtle text-warning-emphasis';
    }
  }

  enabledBadgeClass(enabled?: boolean): string {
    return enabled
      ? 'bg-success-subtle text-success-emphasis'
      : 'bg-secondary-subtle text-secondary-emphasis';
  }

  initialsFor(name: string): string {
    const words = name.split(/\s+/).filter(Boolean);

    if (!words.length) {
      return 'NA';
    }

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }

  trackById = (_: number, tech: TechnicianListItem) => tech.id;
}
