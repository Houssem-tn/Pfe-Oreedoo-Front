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
    name: 'Technician Approvals',
    url: '/zm/technician-approvals',
    iconComponent: { name: 'cilUserFollow' }
  },

   {
    name: 'My Team',
    url: '/zm/my-team',
    iconComponent: { name: 'cil-people' }
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