import { INavData } from '@coreui/angular';

export const navStt: INavData[] = [
  {
    name: 'Dashboard',
    url: '/stt/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'Invite Technicians',
    url: '/stt/invite-technicians',
    iconComponent: { name: 'cilEnvelopeOpen' }
  },
  {
    name: 'Approvals',
    url: '/stt/approvals',
    iconComponent: { name: 'cilCheckCircle' }
  },
  {
    name: 'Activation Cases',
    url: '/stt/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'My Technicians',
    url: '/stt/my-technicians',
    iconComponent: { name: 'cilPeople' }
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