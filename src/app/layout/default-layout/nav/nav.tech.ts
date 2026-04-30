import { INavData } from '@coreui/angular';

export const navTech: INavData[] = [
  {
    name: 'Field Dashboard',
    url: '/tech/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'My Field Tasks',
    url: '/tech/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'Complaint Tasks',
    url: '/tech/cases/complaint',
    iconComponent: { name: 'cilNotes' }
  }
];
