import { INavData } from '@coreui/angular';
import { navAdmin } from './nav/nav.admin';
import { navStt } from './nav/nav.stt';
import { navTech } from './nav/nav.tech';
import { navZm } from './nav/nav.zm';
// (optional) add later: import { navCrmBoutique } from './nav/nav.crm-boutique';

import { Role } from '../../core/auth/models/roles.type';

function cloneNavItems(items: INavData[]): INavData[] {
  return items.map(item => ({
    ...item,
    badge: item.badge ? { ...item.badge } : undefined,
    attributes: item.attributes ? { ...item.attributes } : undefined,
    iconComponent: item.iconComponent ? { ...item.iconComponent } : undefined,
    label: item.label ? { ...item.label } : undefined,
    linkProps: item.linkProps ? { ...item.linkProps } : undefined,
    wrapper: item.wrapper ? { ...item.wrapper } : undefined,
    children: item.children ? cloneNavItems(item.children) : undefined
  }));
}

export function getNavByRole(role: Role | null): INavData[] {
  if (!role) return [];

  switch (role) {
    case 'ROLE_ADMIN':
      return cloneNavItems(navAdmin);

    case 'ROLE_STT':
      return cloneNavItems(navStt);

    case 'ROLE_TECH':
      return cloneNavItems(navTech);

    case 'ROLE_ZM':
      return cloneNavItems(navZm);

    // case 'ROLE_CRM_BOUTIQUE':
    //   return navCrmBoutique;

    default:
      return [];
  }
}
