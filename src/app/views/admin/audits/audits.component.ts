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
}

@Component({
  standalone: true,
  selector: 'app-audits',
  imports: [CommonModule, RouterLink, IconDirective],
  templateUrl: './audits.component.html'
})
export class AuditsComponent {
  readonly modules: AuditModuleCard[] = [
    {
      title: 'Users Auditing',
      description: 'Track approvals, rejections, validators, and rejection reasons.',
      route: '/admin/audits/users',
      icon: 'cilUser',
      enabled: true
    },
    {
      title: 'Interventions Auditing',
      description: 'Follow intervention activity and operational traces.',
      route: '/admin/audits',
      icon: 'cilList',
      enabled: false
    },
    {
      title: 'Stock Auditing',
      description: 'Monitor stock movements and inventory-related actions.',
      route: '/admin/audits',
      icon: 'cilStorage',
      enabled: false
    },
    {
      title: 'Notifications Auditing',
      description: 'Review system notification flow and delivery events.',
      route: '/admin/audits',
      icon: 'cilBell',
      enabled: false
    }
  ];
}