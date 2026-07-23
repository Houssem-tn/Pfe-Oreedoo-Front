import { INavData } from '@coreui/angular';

export const navStt: INavData[] = [
  {
    name: 'nav.dashboard',
    url: '/stt/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'nav.inviteTechnicians',
    url: '/stt/invite-technicians',
    iconComponent: { name: 'cilEnvelopeOpen' }
  },
  {
    name: 'nav.approvals',
    url: '/stt/approvals',
    iconComponent: { name: 'cilCheckCircle' }
  },
  {
    name: 'nav.activationCases',
    url: '/stt/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'nav.complaintCases',
    url: '/stt/cases/complaint',
    iconComponent: { name: 'cilNotes' }
  },
  {
    name: 'nav.resiliationCases',
    url: '/stt/res-execution',
    iconComponent: { name: 'cilNotes' }
  },
  {
    name: 'nav.myTechnicians',
    url: '/stt/my-technicians',
    iconComponent: { name: 'cilPeople' }
  },

  {
    title: true,
    name: 'nav.sectionStock'
  },

  {
    name: 'nav.myStock',
    url: '/stt/stock/my-stock',
    iconComponent: { name: 'cilStorage' }
  },

  {
    name: 'nav.incomingDpms',
    url: '/stt/stock/incoming-dpms',
    iconComponent: { name: 'cilInbox' }
  },

  {
    name: 'nav.distributeToTech',
    url: '/stt/stock/distribute',
    iconComponent: { name: 'cilArrowCircleRight' }
  },

  {
    name: 'nav.usageApprovals',
    url: '/stt/stock/usage-approvals',
    iconComponent: { name: 'cilTask' }
  },

  {
    name: 'nav.materialReturns',
    url: '/stt/stock/returns',
    iconComponent: { name: 'cilArrowThickFromRight' }
  },
  {
    name: 'nav.retrievedStockCollection',
    url: '/stt/stock/retrieved-collection',
    iconComponent: { name: 'cilTruck' }
  }
];
