import { INavData } from '@coreui/angular';
import { navAdmin } from './nav/nav.admin';
import { navStt } from './nav/nav.stt';
import { navTech } from './nav/nav.tech';
import { getNavZm } from './nav/nav.zm';

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

export function getNavByRole(
  role: Role | null,
  canCreateDpm = false,
  canImportCoverage = false
): INavData[] {
  if (!role) return [];

  switch (role) {
    case 'ROLE_ADMIN':
      return cloneNavItems(navAdmin);

    case 'ROLE_STT':
      return cloneNavItems(navStt);

    case 'ROLE_TECH':
      return cloneNavItems(navTech);

    case 'ROLE_ZM':
      return cloneNavItems(getNavZm(canCreateDpm, canImportCoverage));

    default:
      return [];
  }
}
