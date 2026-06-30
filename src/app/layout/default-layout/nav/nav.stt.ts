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
    name: 'Complaint Cases',
    url: '/stt/cases/complaint',
    iconComponent: { name: 'cilNotes' }
  },
  {
    name: 'Resiliation Cases',
    url: '/stt/res-execution',
    iconComponent: { name: 'cilNotes' }
  },
  {
    name: 'My Technicians',
    url: '/stt/my-technicians',
    iconComponent: { name: 'cilPeople' }
  },

  {
    title: true,
    name: 'Stock'
  },

  {
    name: 'My Stock',
    url: '/stt/stock/my-stock',
    iconComponent: { name: 'cilStorage' }
  },

  {
    name: 'Incoming DPMs',
    url: '/stt/stock/incoming-dpms',
    iconComponent: { name: 'cilInbox' }
  },

  {
    name: 'Distribute to TECH',
    url: '/stt/stock/distribute',
    iconComponent: { name: 'cilArrowCircleRight' }
  },

  {
    name: 'Usage Approvals',
    url: '/stt/stock/usage-approvals',
    iconComponent: { name: 'cilTask' }
  },

  {
    name: 'Material Returns',
    url: '/stt/stock/returns',
    iconComponent: { name: 'cilArrowThickFromRight' }
  }
];
