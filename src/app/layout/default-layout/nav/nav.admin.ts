import { INavData } from '@coreui/angular';

export const navAdmin: INavData[] = [
  {
    title: true,
    name: 'Administration'
  },

  // ✅ NEW: Pending approvals
  {
    name: 'Approvals',
    url: '/admin/approvals',
    iconComponent: { name: 'cil-check-circle' }
  },

  {
    name: 'Users',
    url: '/admin/users',
    iconComponent: { name: 'cil-user' }
  },

  {
    name: 'Business Rules',
    url: '/admin/rules',
    iconComponent: { name: 'cil-settings' }
  },

  {
    title: true,
    name: 'Performance'
  },

  {
    name: 'Import TODOS',
    url: '/admin/import-todos',
    iconComponent: { name: 'cilCloudUpload' }
  },

  {
    name: 'TODOS analysis',
    url: '/admin/saved-zm-performance',
    iconComponent: { name: 'cilChartLine' }
  },

  {
    title: true,
    name: 'Monitoring'
  },

  {
    name: 'Interventions',
    url: '/admin/interventions',
    iconComponent: { name: 'cil-list' }
  },

  {
    name: 'Activation Cases',
    url: '/admin/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },

  {
    name: 'Stock',
    url: '/admin/stock',
    iconComponent: { name: 'cil-storage' }
  },

  {
    name: 'Audit',
    url: '/admin/audits',
    iconComponent: { name: 'cil-folder' }
  }
];
