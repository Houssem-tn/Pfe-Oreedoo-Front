import { INavData } from '@coreui/angular';

export function getNavZm(canCreateDpm: boolean, canImportCoverage = false): INavData[] {
  return [
    {
      name: 'nav.dashboard',
      url: '/zm/dashboard',
      iconComponent: { name: 'cilSpeedometer' }
    },
    {
      name: 'nav.alertCenter',
      url: '/alerts',
      iconComponent: { name: 'cilBell' }
    },
    {
      name: 'nav.approvals',
      url: '/zm/approvals',
      iconComponent: { name: 'cilCheckCircle' }
    },
    {
      name: 'nav.technicianApprovals',
      url: '/zm/technician-approvals',
      iconComponent: { name: 'cilUserFollow' }
    },

    {
      name: 'nav.activationCases',
      url: '/zm/cases/activation',
      iconComponent: { name: 'cilFolder' }
    },
    {
      name: 'nav.complaintCases',
      url: '/zm/cases/complaint',
      iconComponent: { name: 'cilNotes' }
    },
    {
      name: 'nav.resiliationCases',
      url: '/zm/cases/resiliation',
      iconComponent: { name: 'cilNotes' }
    },
    {
      name: 'nav.injectTodos',
      url: '/zm/inject-todos',
      iconComponent: { name: 'cilCloudUpload' }
    },
    /*
    {
      name: 'nav.todosAnalysis',
      url: '/zm/todos-analysis',
      iconComponent: { name: 'cilSpeedometer' }
    },
    {
      name: 'nav.importedTodos',
      url: '/zm/imported-todos',
      iconComponent: { name: 'cilSpreadsheet' }
    },
    */

    {
      name: 'nav.myTeam',
      url: '/zm/my-team',
      iconComponent: { name: 'cil-people' }
    },


    {
      title: true,
      name: 'nav.sectionCoverage'
    },
    {
      name: 'nav.networkCoverage',
      url: '/zm/network-coverage',
      iconComponent: { name: 'cilMap' }
    },

    {
      title: true,
      name: 'nav.sectionStock'
    },

    // ── DPM-only entries ───────────────────────────────────────────────────────
    ...(canCreateDpm ? [
      {
        name: 'nav.myDpms',
        url: '/zm/stock/my-tracking',
        iconComponent: { name: 'cilStorage' }
      },
      {
        name: 'nav.createDpm',
        url: '/zm/stock/create-dpm',
        iconComponent: { name: 'cilPlus' }
      }
    ] : []),

    // ── Available to all ZMs ───────────────────────────────────────────────────
    {
      name: 'nav.teamStock',
      url: '/zm/stock/team-stock',
      iconComponent: { name: 'cilPeople' }
    },
    {
      name: 'nav.teamDistributions',
      url: '/zm/stock/team-distributions',
      iconComponent: { name: 'cilShare' }
    },
    {
      name: 'nav.unitTracking',
      url: '/zm/stock/unit-tracking',
      iconComponent: { name: 'cilTags' }
    },
    {
      name: 'nav.caseStockAudit',
      url: '/zm/stock/case-audit',
      iconComponent: { name: 'cilChart' }
    },

    // ── DPM-only entry ─────────────────────────────────────────────────────────
    ...(canCreateDpm ? [
      {
        name: 'nav.stockThresholds',
        url: '/zm/stock/thresholds',
        iconComponent: { name: 'cilSettings' }
      }
    ] : []),

    // ── Available to all ZMs ───────────────────────────────────────────────────
    {
      name: 'nav.materialReturns',
      url: '/zm/stock/returns',
      iconComponent: { name: 'cilArrowThickFromRight' }
    },
    {
      // Read-only tracking only — the ZM no longer performs collection (that is the STT's action).
      name: 'nav.retrievedStockTracking',
      url: '/zm/stock/retrieved-tracking',
      iconComponent: { name: 'cilTruck' }
    }
  ];
}
