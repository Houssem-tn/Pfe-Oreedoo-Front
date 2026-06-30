import { INavData } from '@coreui/angular';

export function getNavZm(canCreateDpm: boolean, canImportCoverage = false): INavData[] {
  return [
    {
      name: 'Dashboard',
      url: '/zm/dashboard',
      iconComponent: { name: 'cilSpeedometer' }
    },
    {
      name: 'Alert Center',
      url: '/alerts',
      iconComponent: { name: 'cilBell' }
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
      name: 'Resiliation Cases',
      url: '/zm/cases/resiliation',
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
      title: true,
      name: 'Coverage'
    },
    {
      name: 'Network Coverage',
      url: '/zm/network-coverage',
      iconComponent: { name: 'cilMap' }
    },

    {
      title: true,
      name: 'Stock'
    },

    // ── DPM-only entries ───────────────────────────────────────────────────────
    ...(canCreateDpm ? [
      {
        name: 'My DPMs',
        url: '/zm/stock/my-tracking',
        iconComponent: { name: 'cilStorage' }
      },
      {
        name: 'Create DPM',
        url: '/zm/stock/create-dpm',
        iconComponent: { name: 'cilPlus' }
      }
    ] : []),

    // ── Available to all ZMs ───────────────────────────────────────────────────
    {
      name: 'Team Stock',
      url: '/zm/stock/team-stock',
      iconComponent: { name: 'cilPeople' }
    },
    {
      name: 'Team Distributions',
      url: '/zm/stock/team-distributions',
      iconComponent: { name: 'cilShare' }
    },
    {
      name: 'Unit Tracking',
      url: '/zm/stock/unit-tracking',
      iconComponent: { name: 'cilTags' }
    },
    {
      name: 'Case Stock Audit',
      url: '/zm/stock/case-audit',
      iconComponent: { name: 'cilChart' }
    },

    // ── DPM-only entry ─────────────────────────────────────────────────────────
    ...(canCreateDpm ? [
      {
        name: 'Stock Thresholds',
        url: '/zm/stock/thresholds',
        iconComponent: { name: 'cilSettings' }
      }
    ] : []),

    // ── Available to all ZMs ───────────────────────────────────────────────────
    {
      name: 'Material Returns',
      url: '/zm/stock/returns',
      iconComponent: { name: 'cilArrowThickFromRight' }
    }
  ];
}
