import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';

interface AuditModuleCard {
  title: string;
  description: string;
  route: string;
  icon: string;
  enabled: boolean;
  signal: string;
  highlights: string[];
}

@Component({
  standalone: true,
  selector: 'app-audits',
  imports: [CommonModule, RouterLink, IconDirective],
  templateUrl: './audits.component.html',
  styleUrl: './audits.component.scss'
})
export class AuditsComponent {
  readonly modules: AuditModuleCard[] = [
    {
      title: 'Users Auditing',
      description: 'Track approvals, rejections, validators, and rejection reasons.',
      route: '/admin/audits/users',
      icon: 'cilUser',
      enabled: true,
      signal: 'Live accountability trail for onboarding decisions.',
      highlights: [
        'Approvals and rejections in one timeline',
        'Validator identity and decision date',
        'Fast focus on rejected registrations'
      ]
    },
    {
      title: 'Interventions Auditing',
      description: 'Follow intervention activity and operational traces.',
      route: '/admin/audits/interventions',
      icon: 'cilList',
      enabled: true,
      signal: 'Live lifecycle trail across ACT, PLT and RES — assignments, field execution, SLA and closure.',
      highlights: [
        'Intervention lifecycle history',
        'Assignment and completion events',
        'SLA and escalation checkpoints'
      ]
    },
    {
      title: 'Stock Auditing',
      description: 'Monitor stock movements and inventory-related actions.',
      route: '/admin/audits/stock',
      icon: 'cilStorage',
      enabled: true,
      signal: 'Full audit trail of DPM creation, confirmations, and STT→TECH distributions.',
      highlights: [
        'Movement journal by operator',
        'Inventory adjustments and reasons',
        'Risk points on field stock flow'
      ]
    },
    {
      title: 'Notifications Auditing',
      description: 'Review system notification flow and delivery events.',
      route: '/admin/audits',
      icon: 'cilBell',
      enabled: false,
      signal: 'Roadmap scope for alert delivery and reliability analysis.',
      highlights: [
        'Delivery attempts and failures',
        'Role-based notification visibility',
        'Operational alert auditability'
      ]
    }
  ];

  get enabledModulesCount(): number {
    return this.modules.filter((module) => module.enabled).length;
  }

  get plannedModulesCount(): number {
    return this.modules.length - this.enabledModulesCount;
  }

  get coverageRate(): number {
    if (!this.modules.length) {
      return 0;
    }

    return Math.round((this.enabledModulesCount / this.modules.length) * 100);
  }

  get featuredModule(): AuditModuleCard | null {
    return this.modules.find((module) => module.enabled) ?? this.modules[0] ?? null;
  }

  moduleStateLabel(module: AuditModuleCard): string {
    return module.enabled ? 'Live now' : 'Roadmap';
  }

  moduleActionLabel(module: AuditModuleCard): string {
    return module.enabled ? 'Open audit trail' : 'Coming soon';
  }
}
