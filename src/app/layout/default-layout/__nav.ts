import { INavData } from '@coreui/angular';
import { navAdmin } from './nav/nav.admin';
import { navStt } from './nav/nav.stt';
import { navTech } from './nav/nav.tech';
import { navZm } from './nav/nav.zm';
// (optional) add later: import { navCrmBoutique } from './nav/nav.crm-boutique';

import { Role } from '../../core/auth/models/roles.type';

export function getNavByRole(role: Role | null): INavData[] {
  if (!role) return [];

  switch (role) {
    case 'ROLE_ADMIN':
      return navAdmin;

    case 'ROLE_STT':
      return navStt;

    case 'ROLE_TECH':
      return navTech;

    case 'ROLE_ZM':
      return navZm;

    // case 'ROLE_CRM_BOUTIQUE':
    //   return navCrmBoutique;

    default:
      return [];
  }
}