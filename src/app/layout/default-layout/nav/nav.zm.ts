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
    name: 'Activation Cases',
    url: '/zm/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'Complaint Cases',
    url: '/zm/cases/complaint',
    iconComponent: { name: 'cilNotes' }
  },
  {
    name: 'Inject Todos',
    url: '/zm/inject-todos',
    iconComponent: { name: 'cilCloudUpload' }
  },
  {
    name: 'Todos Analysis',
    url: '/zm/todos-analysis',
    iconComponent: { name: 'cilSpeedometer' }
  },
  {
    name: 'Imported Todos',
    url: '/zm/imported-todos',
    iconComponent: { name: 'cilSpreadsheet' }
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
  },

  {
    title: true,
    name: 'Stock'
  },

  {
    name: 'My DPMs',
    url: '/zm/stock/my-tracking',
    iconComponent: { name: 'cilStorage' }
  },

  {
    name: 'Create DPM',
    url: '/zm/stock/create-dpm',
    iconComponent: { name: 'cilPlus' }
  },
  {
    name: 'Team Stock',
    url: '/zm/stock/team-stock',
    iconComponent: { name: 'cilPeople' }
  },
  {
    name: 'Case Stock Audit',
    url: '/zm/stock/case-audit',
    iconComponent: { name: 'cilChart' }
  }
];
