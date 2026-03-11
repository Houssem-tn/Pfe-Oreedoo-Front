import { INavData } from '@coreui/angular';

export const navStt: INavData[] = [
  {
    name: 'Dashboard',
    url: '/stt/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'Approvals',
    url: '/stt/approvals',
    iconComponent: { name: 'cilCheckCircle' }
  },
  {
    name: 'Create Intervention',
    url: '/stt/create',
    iconComponent: { name: 'cilPlus' }
  },
  {
    name: 'Interventions',
    url: '/stt/interventions',
    iconComponent: { name: 'cilList' }
  },
  {
    name: 'Assign Technician',
    url: '/stt/assign',
    iconComponent: { name: 'cilUserFollow' }
  },
  {
    name: 'Manage RDV',
    url: '/stt/rdv',
    iconComponent: { name: 'cilCalendar' }
  },
  {
    name: 'Pre-Validate',
    url: '/stt/pre-validate',
    iconComponent: { name: 'cilCheckCircle' }
  }
];