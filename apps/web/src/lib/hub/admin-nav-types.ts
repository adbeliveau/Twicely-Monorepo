import type { PlatformRole } from '@twicely/casl/types';

/** Navigation item shape for the hub admin sidebar */
export type AdminNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  roles: PlatformRole[] | 'any'; // 'any' = any authenticated staff role
  disabled?: boolean;            // Grays out item, prevents navigation
  children?: AdminNavItem[];     // Sub-items (collapsible group)
};
