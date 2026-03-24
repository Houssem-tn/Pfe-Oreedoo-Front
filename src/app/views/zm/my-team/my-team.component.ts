import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { UserService } from '../../../core/users/user.service';

@Component({
  selector: 'app-my-team',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-team.component.html',
  styleUrl: './my-team.component.scss'
})
export class MyTeamComponent implements OnInit {
  private userService = inject(UserService);

  stts = signal<any[]>([]);
  loading = signal(false);

  expandedSttId = signal<string | null>(null);
  techsByStt = signal<Record<string, any[]>>({});
  techLoadingByStt = signal<Record<string, boolean>>({});

  ngOnInit(): void {
    this.loadMyStts();
  }

  loadMyStts(): void {
    this.loading.set(true);

    this.userService.getMyStts().subscribe({
      next: (res) => {
        this.stts.set(res || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load my STTs', err);
        this.loading.set(false);
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
          [sttId]: res || []
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

  getTechs(sttId: string): any[] {
    return this.techsByStt()[sttId] || [];
  }

  isTechLoading(sttId: string): boolean {
    return !!this.techLoadingByStt()[sttId];
  }
}