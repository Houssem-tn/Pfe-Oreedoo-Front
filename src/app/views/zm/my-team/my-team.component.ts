import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';

import { CasesService } from '../../../core/cases/cases.service';
import { PerformanceSummaryResponse } from '../../../core/cases/models/case.model';
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

  stts = signal<AppUser[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  expandedSttId = signal<string | null>(null);
  techsByStt = signal<Record<string, AppUser[]>>({});
  techLoadingByStt = signal<Record<string, boolean>>({});
  performanceByEmail = signal<Record<string, PerformanceSummaryResponse>>({});

  ngOnInit(): void {
    this.loadMyStts();
    this.loadTechPerformance();
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
}