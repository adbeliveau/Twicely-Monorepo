/**
 * Corp Navigation Bridge
 *
 * Adapts the monorepo ADMIN_NAV flat list into the sectioned format
 * (CORP_NAV_SECTIONS) that the CorpSidebar component expects.
 *
 * Route prefixes use hub.twicely.co paths (/d, /usr, /tx, etc.)
 * per CLAUDE.md, NOT V2's /corp/* routes.
 */

import { ADMIN_NAV, type AdminNavItem } from '@/lib/hub/admin-nav';

export type CorpNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
  children?: CorpNavItem[];
};

export type CorpNavSection = {
  id: string;
  label: string;
  items: CorpNavItem[];
};

function toCorpNavItem(item: AdminNavItem): CorpNavItem {
  return {
    key: item.key,
    label: item.label,
    href: item.href,
    icon: item.icon,
    disabled: item.disabled,
    children: item.children?.map(toCorpNavItem),
  };
}

function pick(keys: string[]): CorpNavItem[] {
  return keys
    .map((k) => ADMIN_NAV.find((i) => i.key === k))
    .filter((i): i is AdminNavItem => i !== undefined)
    .map(toCorpNavItem);
}

export const CORP_NAV_SECTIONS: CorpNavSection[] = [
  {
    id: 'main',
    label: 'Main',
    items: pick(['dashboard', 'analytics', 'users']),
  },
  {
    id: 'commerce',
    label: 'Commerce',
    items: pick([
      'transactions',
      'listings-admin',
      'categories',
      'subscriptions',
      'promotions',
    ]),
  },
  {
    id: 'finance',
    label: 'Finance',
    items: pick(['finance']),
  },
  {
    id: 'trust',
    label: 'Trust & Safety',
    items: pick(['moderation', 'trust-safety']),
  },
  {
    id: 'support',
    label: 'Customer Support',
    items: pick(['helpdesk', 'knowledge-base', 'notifications']),
  },
  {
    id: 'data',
    label: 'Data Management',
    items: pick(['data-management']),
  },
  {
    id: 'ops',
    label: 'Operations',
    items: pick([
      'feature-flags',
      'errors',
      'operations',
      'admin-messages',
      'search-admin',
      'system-health',
      'audit-log',
    ]),
  },
  {
    id: 'settings',
    label: 'Platform Settings',
    items: pick([
      'settings',
      'roles',
      'crosslister',
      'providers',
      'localization',
      'compliance',
    ]),
  },
];
