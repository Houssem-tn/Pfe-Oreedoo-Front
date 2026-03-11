import { INavData } from '@coreui/angular';

export const navZm: INavData[] = [
  {
    name: 'Dashboard',
    url: '/zm/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'Approvals',
    url: '/zm/approvals',
    iconComponent: { name: 'cilCheckCircle' }
  },
  {
    name: 'Validation Queue',
    url: '/zm/validations',
    iconComponent: { name: 'cilTask' }
  },
  {
    name: 'Audit Dossiers',
    url: '/zm/audits',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'Reports',
    url: '/zm/reports',
    iconComponent: { name: 'cilChart' }
  }
];