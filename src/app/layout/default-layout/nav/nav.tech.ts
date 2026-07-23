import { INavData } from '@coreui/angular';

export const navTech: INavData[] = [
  {
    name: 'nav.fieldDashboard',
    url: '/tech/dashboard',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'nav.myFieldTasks',
    url: '/tech/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'nav.complaintTasks',
    url: '/tech/cases/complaint',
    iconComponent: { name: 'cilNotes' }
  },

  {
    title: true,
    name: 'nav.sectionStock'
  },

  {
    name: 'nav.myEquipment',
    url: '/tech/stock/my-stock',
    iconComponent: { name: 'cilStorage' }
  },

  {
    name: 'nav.myPermissions',
    url: '/tech/stock/my-permissions',
    iconComponent: { name: 'cilTask' }
  }
];
