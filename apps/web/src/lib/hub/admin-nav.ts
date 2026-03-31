import type { PlatformRole } from '@twicely/casl/types';
import type { AdminNavItem } from './admin-nav-types';
import { ADMIN_NAV_CORE } from './admin-nav-core';
import { ADMIN_NAV_EXTENDED } from './admin-nav-extended';

// Re-export the type so existing imports keep working
export type { AdminNavItem } from './admin-nav-types';

/**
 * Hub sidebar navigation registry.
 * Reference: TWICELY_V3_PAGE_REGISTRY.md Section 8 / TWICELY_V3_UNIFIED_HUB_CANONICAL.md Section 10.3
 *
 * Route prefixes per CLAUDE.md:
 *   /d     — Dashboard
 *   /usr   — User management
 *   /tx    — Transactions
 *   /fin   — Finance
 *   /mod   — Moderation
 *   /hd    — Helpdesk (deferred G9)
 *   /kb    — Knowledge Base (deferred G9)
 *   /flags — Feature Flags
 *   /cfg   — Platform config
 *   /roles — Staff roles
 *   /audit — Audit log
 *   /health — System health
 *   /trust    — Trust & Safety
 *   /risk     — Risk Signals
 *   /security — Security Events
 *   /promotions — Promotions
 *   /analytics — Analytics (collapsible)
 *   /categories — Categories (collapsible)
 */
export const ADMIN_NAV: AdminNavItem[] = [
  ...ADMIN_NAV_CORE,
  ...ADMIN_NAV_EXTENDED,
];

/**
 * Filter the admin nav to only items the staff member's roles allow.
 */
export function filterAdminNav(
  nav: AdminNavItem[],
  roles: PlatformRole[]
): AdminNavItem[] {
  if (roles.includes('SUPER_ADMIN')) {
    // SUPER_ADMIN sees all items (role filter bypassed), but disabled state is preserved
    return nav;
  }
  return nav
    .filter((item) => {
      if (item.roles === 'any') return true;
      return item.roles.some((role) => roles.includes(role));
    })
    .map((item) => ({
      ...item,
      children: item.children ? filterAdminNav(item.children, roles) : undefined,
    }));
}
