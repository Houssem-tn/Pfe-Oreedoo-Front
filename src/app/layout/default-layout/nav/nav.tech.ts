import { INavData } from '@coreui/angular';

export const navTech: INavData[] = [
  {
    name: 'Dashboard',
    url: '/tech/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'My Interventions',
    url: '/tech/interventions',
    iconComponent: { name: 'cilList' }
  },
  {
    name: 'Execute Intervention',
    url: '/tech/execute',
    iconComponent: { name: 'cilSettings' }
  },
  {
    name: 'Submit Intervention',
    url: '/tech/submit',
    iconComponent: { name: 'cilCloudUpload' }
  },
  {
    name: 'History',
    url: '/tech/history',
    iconComponent: { name: 'cilHistory' }
  }
];