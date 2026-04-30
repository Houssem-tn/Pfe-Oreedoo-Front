import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import Swal from 'sweetalert2';

import { CasesService } from '../../../core/cases/cases.service';
import { PerformanceSummaryResponse } from '../../../core/cases/models/case.model';
import { normalizeGovernorateList } from '../../../core/shared/tunisia-governorates';
import { SwalService } from '../../../core/ui/swal.service';
import { UserService } from '../../../core/users/user.service';
import { AppUser } from '../../../core/users/user.model';

@Component({
  selector: 'app-my-team',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective],
  templateUrl: './my-team.component.html',
  styleUrl: './my-team.component.scss'
})
export class MyTeamComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly casesService = inject(CasesService);
  private readonly swal = inject(SwalService);

  stts = signal<AppUser[]>([]);
  zmProfile = signal<AppUser | null>(null);
  pendingCoverageRequests = signal<AppUser[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  validatingCoverageSttId = signal<string | null>(null);

  expandedSttId = signal<string | null>(null);
  techsByStt = signal<Record<string, AppUser[]>>({});
  techLoadingByStt = signal<Record<string, boolean>>({});
  performanceByEmail = signal<Record<string, PerformanceSummaryResponse>>({});

  ngOnInit(): void {
    this.loadMyProfile();
    this.loadMyStts();
    this.loadPendingCoverageRequests();
    this.loadTechPerformance();
  }

  loadMyProfile(): void {
    this.userService.getMe().subscribe({
      next: (res) => {
        this.zmProfile.set(res ?? null);
      },
      error: (err) => {
        console.error('Failed to load ZM profile', err);
        this.zmProfile.set(null);
      }
    });
  }

  loadMyStts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.userService.getMyStts().subscribe({
      next: (res) => {
        this.stts.set(res || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load my STTs', err);
        this.error.set(err?.error?.message ?? 'Unable to load your STT team right now.');
        this.loading.set(false);
      }
    });
  }

  loadPendingCoverageRequests(): void {
    this.userService.getMyPendingCoverageRequests().subscribe({
      next: (res) => {
        this.pendingCoverageRequests.set(res || []);
      },
      error: (err) => {
        console.error('Failed to load pending STT coverage requests', err);
        this.pendingCoverageRequests.set([]);
      }
    });
  }

  loadTechPerformance(): void {
    this.casesService.getTechPerformance().subscribe({
      next: (rows) => {
        const dictionary: Record<string, PerformanceSummaryResponse> = {};
        for (const row of rows ?? []) {
          const email = (row.userEmail ?? '').trim().toLowerCase();
          if (email) {
            dictionary[email] = row;
          }
        }
        this.performanceByEmail.set(dictionary);
      },
      error: (err) => {
        console.error('Failed to load team tech performance', err);
        this.performanceByEmail.set({});
      }
    });
  }

  toggleSttTechs(sttId: string): void {
    if (this.expandedSttId() === sttId) {
      this.expandedSttId.set(null);
      return;
    }

    this.expandedSttId.set(sttId);

    const existing = this.techsByStt()[sttId];
    if (existing) return;

    this.techLoadingByStt.update(state => ({
      ...state,
      [sttId]: true
    }));

    this.userService.getMySttTechs(sttId).subscribe({
      next: (res) => {
        this.techsByStt.update(state => ({
          ...state,
          [sttId]: (res || []).filter((item) => item.role === 'ROLE_TECH')
        }));

        this.techLoadingByStt.update(state => ({
          ...state,
          [sttId]: false
        }));
      },
      error: (err) => {
        console.error('Failed to load TECHs', err);

        this.techLoadingByStt.update(state => ({
          ...state,
          [sttId]: false
        }));
      }
    });
  }

  isExpanded(sttId: string): boolean {
    return this.expandedSttId() === sttId;
  }

  getTechs(sttId: string): AppUser[] {
    return this.techsByStt()[sttId] || [];
  }

  isTechLoading(sttId: string): boolean {
    return !!this.techLoadingByStt()[sttId];
  }

  avatarUrl(user?: AppUser | null): string | null {
    if (!user) {
      return null;
    }

    return user.profileThumbnailUrl || user.profileImageUrl || null;
  }

  initialsFor(user?: AppUser | null): string {
    const source = (user?.fullName ?? '').trim() || (user?.email ?? '').trim();
    if (!source) {
      return 'NA';
    }

    const parts = source.split(/[\s@._-]+/).filter(Boolean);
    if (!parts.length) {
      return 'NA';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  techPerformance(tech: AppUser): PerformanceSummaryResponse | null {
    const key = (tech.email ?? '').trim().toLowerCase();
    if (!key) {
      return null;
    }

    return this.performanceByEmail()[key] ?? null;
  }

  sttMetrics(sttId: string): {
    techCount: number;
    activeTasks: number;
    breaches: number;
    warnings: number;
    avgCompletion: number;
  } {
    const techs = this.getTechs(sttId);
    if (!techs.length) {
      return { techCount: 0, activeTasks: 0, breaches: 0, warnings: 0, avgCompletion: 0 };
    }

    let activeTasks = 0;
    let breaches = 0;
    let warnings = 0;
    let completionSum = 0;
    let completionCount = 0;

    for (const tech of techs) {
      const perf = this.techPerformance(tech);
      if (!perf) {
        continue;
      }

      activeTasks += perf.activeTasksCount ?? 0;
      breaches += perf.slaBreachCount ?? 0;
      warnings += perf.slaWarningCount ?? 0;
      completionSum += perf.workCompletionProgress ?? 0;
      completionCount += 1;
    }

    return {
      techCount: techs.length,
      activeTasks,
      breaches,
      warnings,
      avgCompletion: completionCount ? completionSum / completionCount : 0
    };
  }

  get totalTechLoaded(): number {
    return Object.values(this.techsByStt()).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  }

  get totalActiveTasks(): number {
    return Object.values(this.performanceByEmail()).reduce((sum, row) => sum + (row.activeTasksCount ?? 0), 0);
  }

  get pendingCoverageValidationCount(): number {
    return this.pendingCoverageRequests().reduce((sum, stt) => sum + this.pendingGovernoratesFor(stt).length, 0);
  }

  get avgTeamCompletion(): number {
    const rows = Object.values(this.performanceByEmail());
    if (!rows.length) {
      return 0;
    }

    const total = rows.reduce((sum, row) => sum + (row.workCompletionProgress ?? 0), 0);
    return total / rows.length;
  }

  accountStatusBadge(status?: string | null): string {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-subtle text-success-emphasis';
      case 'REJECTED':
        return 'bg-danger-subtle text-danger-emphasis';
      default:
        return 'bg-warning-subtle text-warning-emphasis';
    }
  }

  pendingGovernoratesFor(stt: AppUser): string[] {
    const territory = new Set(normalizeGovernorateList(this.zmProfile()?.assignedGovernorates ?? []));
    return normalizeGovernorateList(stt.requestedGovernorates ?? []).filter((governorate) => territory.has(governorate));
  }

  isValidatingCoverage(sttId: string): boolean {
    return this.validatingCoverageSttId() === sttId;
  }

  async openValidateCoverageModal(stt: AppUser): Promise<void> {
    const governorates = this.pendingGovernoratesFor(stt);
    if (!governorates.length) {
      await this.swal.error('Nothing to validate', 'This STT has no pending governorate request inside your territory.');
      return;
    }

    const result = await Swal.fire<string[]>({
      titleText: `Validate Zones for ${stt.fullName}`,
      width: 720,
      html: `
        <div class="coverage-approval-modal">
          <div class="coverage-approval-modal__hint">
            Approve the governorates you want to activate for this STT inside your territory.
          </div>
          <div class="coverage-approval-modal__grid">
            ${governorates.map((governorate) => `
              <label class="coverage-approval-modal__option">
                <input type="checkbox" name="sw-coverage-approval" value="${this.escapeHtml(governorate)}" checked />
                <span>${this.escapeHtml(governorate)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Validate zones',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#321fdb',
      preConfirm: () => {
        const popup = Swal.getPopup();
        if (!popup) {
          return [];
        }

        const selected = Array.from(
          popup.querySelectorAll<HTMLInputElement>('input[name="sw-coverage-approval"]:checked')
        ).map((checkbox) => checkbox.value);

        if (selected.length === 0) {
          Swal.showValidationMessage('Select at least one governorate to validate');
          return undefined;
        }

        return selected;
      }
    });

    if (!result.isConfirmed || !result.value?.length) {
      return;
    }

    this.validatingCoverageSttId.set(stt.id);

    this.userService.validateCoverageAreasForStt(stt.id, {
      approvedGovernorates: result.value
    }).subscribe({
      next: async () => {
        this.loadMyStts();
        this.loadPendingCoverageRequests();
        await this.swal.success('Zones validated', `Governorates were validated successfully for ${stt.fullName}.`);
        this.validatingCoverageSttId.set(null);
      },
      error: async (err) => {
        console.error('Failed to validate STT coverage areas', err);
        const message = err?.error?.message ?? 'Failed to validate STT coverage areas';
        await this.swal.error('Validation failed', message);
        this.validatingCoverageSttId.set(null);
      }
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
