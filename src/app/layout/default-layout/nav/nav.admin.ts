import { INavData } from '@coreui/angular';

export const navAdmin: INavData[] = [
  {
    title: true,
    name: 'nav.sectionAdministration'
  },

  // ✅ NEW: Pending approvals
  {
    name: 'nav.approvals',
    url: '/admin/approvals',
    iconComponent: { name: 'cil-check-circle' }
  },

  {
    name: 'nav.users',
    url: '/admin/users',
    iconComponent: { name: 'cil-user' }
  },
/*
  {
    name: 'nav.businessRules',
    url: '/admin/rules',
    iconComponent: { name: 'cil-settings' }
  },
  */

  {
    title: true,
    name: 'nav.sectionPerformance'
  },

  {
    name: 'nav.importAnalytics',
    url: '/admin/import-todos',
    iconComponent: { name: 'cilCloudUpload' }
  },

  {
    name: 'nav.todosAnalysis',
    url: '/admin/saved-zm-performance',
    iconComponent: { name: 'cilChartLine' }
  },

  {
    name: 'nav.actAnalysis',
    url: '/admin/act-analysis',
    iconComponent: { name: 'cilSpeedometer' }
  },

  {
    title: true,
    name: 'nav.sectionMonitoring'
  },



  {
    name: 'nav.activationCases',
    url: '/admin/cases/activation',
    iconComponent: { name: 'cilFolder' }
  },
  {
    name: 'nav.complaintCases',
    url: '/admin/cases/complaint',
    iconComponent: { name: 'cilNotes' }
  },
  {
    name: 'nav.resiliationCases',
    url: '/admin/cases/resiliation',
    iconComponent: { name: 'cilNotes' }
  },

  {
    title: true,
    name: 'nav.sectionCoverageIntelligence'
  },

  {
    name: 'nav.networkCoverage',
    url: '/admin/network-coverage',
    iconComponent: { name: 'cilMap' }
  },

  {
    title: true,
    name: 'nav.sectionStockManagement'
  },

  {
    name: 'nav.equipment',
    url: '/admin/stock/equipment',
    iconComponent: { name: 'cilStorage' }
  },

  {
    name: 'nav.stockTracking',
    url: '/admin/stock/tracking',
    iconComponent: { name: 'cilChartLine' }
  },

  {
    name: 'nav.teamDistributions',
    url: '/admin/stock/team-distributions',
    iconComponent: { name: 'cilPeople' }
  },

  {
    name: 'nav.unitTracking',
    url: '/admin/stock/unit-tracking',
    iconComponent: { name: 'cilTags' }
  },

  {
    name: 'nav.audit',
    url: '/admin/audits',
    iconComponent: { name: 'cil-folder' }
  }
];
