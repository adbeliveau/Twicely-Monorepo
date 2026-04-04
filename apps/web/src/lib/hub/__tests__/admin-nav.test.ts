import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ADMIN_NAV, filterAdminNav, type AdminNavItem } from '../admin-nav';
import type { PlatformRole } from '@twicely/casl/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten the nav tree (parents + all children) into a single array */
function flattenNav(nav: AdminNavItem[]): AdminNavItem[] {
  const result: AdminNavItem[] = [];
  for (const item of nav) {
    result.push(item);
    if (item.children) {
      result.push(...flattenNav(item.children));
    }
  }
  return result;
}

/** Collect every key in the nav tree */
function collectKeys(nav: AdminNavItem[]): string[] {
  return flattenNav(nav).map((item) => item.key);
}

/** Collect every href in the nav tree (leaf items only — parents with children are collapsible buttons, not links) */
function collectAllHrefs(nav: AdminNavItem[]): string[] {
  return flattenNav(nav).filter((item) => !item.children?.length).map((item) => item.href);
}

/**
 * Pages that exist in admin-nav.ts but intentionally do not have
 * a page.tsx yet (deferred builds). These are excluded from the
 * filesystem existence check.
 */
const DEFERRED_HREFS = new Set([
  '/hd', // Helpdesk lives in (helpdesk) route group, not (hub) — page exists at src/app/(helpdesk)/hd/page.tsx
]);

/** Convert a nav href to the expected page.tsx path under src/app/(hub)/ */
function hrefToPagePath(href: string): string {
  return path.join(
    process.cwd(),
    'src',
    'app',
    '(hub)',
    href.replace(/^\//, ''),
    'page.tsx'
  );
}

/** Extract icon names from ICON_MAP by reading admin-sidebar.tsx source */
function getIconMapKeys(): string[] {
  const sidebarPath = path.join(
    process.cwd(),
    'src',
    'components',
    'admin',
    'admin-sidebar.tsx'
  );
  const source = fs.readFileSync(sidebarPath, 'utf-8');
  // Match the ICON_MAP object block and extract keys
  const mapMatch = source.match(/const ICON_MAP[^=]+=\s*\{([^}]+)\}/s);
  if (!mapMatch || !mapMatch[1]) return [];
  const mapBody: string = mapMatch[1];
  // Extract identifiers (keys equal to values in shorthand — allow digits e.g. BarChart2)
  const keys = mapBody.match(/[A-Z][A-Za-z0-9]+/g) ?? [];
  return keys;
}

const VALID_ROLES: Array<PlatformRole | 'any'> = [
  'HELPDESK_AGENT',
  'HELPDESK_LEAD',
  'HELPDESK_MANAGER',
  'SUPPORT',
  'MODERATION',
  'FINANCE',
  'DEVELOPER',
  'SRE',
  'ADMIN',
  'SUPER_ADMIN',
];

// ─── ADMIN_NAV registry ───────────────────────────────────────────────────────

describe('ADMIN_NAV registry', () => {
  it('has no duplicate keys across entire tree', () => {
    const keys = collectKeys(ADMIN_NAV);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('every href maps to an existing page.tsx in src/app/(hub)/ (excluding deferred)', () => {
    const allHrefs = collectAllHrefs(ADMIN_NAV);
    const missing: string[] = [];
    for (const href of allHrefs) {
      if (DEFERRED_HREFS.has(href)) continue;
      const pagePath = hrefToPagePath(href);
      if (!fs.existsSync(pagePath)) {
        missing.push(`${href} → ${pagePath}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every icon name exists in admin-sidebar ICON_MAP', () => {
    const iconMapKeys = getIconMapKeys();
    const allItems = flattenNav(ADMIN_NAV);
    const missing: string[] = [];
    for (const item of allItems) {
      if (!iconMapKeys.includes(item.icon)) {
        missing.push(`key=${item.key} icon=${item.icon}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('no children array is empty', () => {
    const allItems = flattenNav(ADMIN_NAV);
    const emptyChildren = allItems
      .filter((item) => item.children !== undefined && item.children.length === 0)
      .map((item) => item.key);
    expect(emptyChildren).toEqual([]);
  });

  it('all role values are valid PlatformRole or "any"', () => {
    const allItems = flattenNav(ADMIN_NAV);
    const invalid: string[] = [];
    for (const item of allItems) {
      if (item.roles === 'any') continue;
      for (const role of item.roles) {
        if (!VALID_ROLES.includes(role)) {
          invalid.push(`key=${item.key} role=${role}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it('contains expected top-level keys', () => {
    const topLevelKeys = ADMIN_NAV.map((item) => item.key);
    const expected = [
      'dashboard',
      'analytics',
      'users',
      'transactions',
      'finance',
      'moderation',
      'trust-safety',
      'promotions',
      'helpdesk',
      'knowledge-base',
      'listings-admin',
      'categories',
      'subscriptions',
      'notifications',
      'data-management',
      'feature-flags',
      'errors',
      'operations',
      'admin-messages',
      'search-admin',
      'roles',
      'audit-log',
      'system-health',
      'settings',
      'crosslister',
      'localization',
      'compliance',
      'providers',
    ];
    for (const key of expected) {
      expect(topLevelKeys, `Top-level key "${key}" missing`).toContain(key);
    }
  });
});

// ─── ADMIN_NAV — group structure ─────────────────────────────────────────────

describe('ADMIN_NAV — group structure', () => {
  it('users group is collapsible with 4 children', () => {
    const users = ADMIN_NAV.find((item) => item.key === 'users');
    expect(users).toBeDefined();
    expect(users?.children).toHaveLength(4);
    const childKeys = users?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('usr-overview');
    expect(childKeys).toContain('usr-sellers');
    expect(childKeys).toContain('usr-verification');
    expect(childKeys).toContain('usr-affiliates');
  });

  it('roles group is collapsible with 2 children (overview + staff)', () => {
    const roles = ADMIN_NAV.find((item) => item.key === 'roles');
    expect(roles).toBeDefined();
    expect(roles?.children).toHaveLength(2);
    const childKeys = roles?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('roles-overview');
    expect(childKeys).toContain('staff');
  });

  it('finance group has 12 children', () => {
    const finance = ADMIN_NAV.find((item) => item.key === 'finance');
    expect(finance).toBeDefined();
    expect(finance?.children).toHaveLength(12);
    const childKeys = finance?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('fin-chargebacks');
    expect(childKeys).toContain('fin-holds');
    expect(childKeys).toContain('fin-subscriptions');
  });

  it('moderation group has 13 children', () => {
    const moderation = ADMIN_NAV.find((item) => item.key === 'moderation');
    expect(moderation).toBeDefined();
    expect(moderation?.children).toHaveLength(13);
    const childKeys = moderation?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('mod-queue');
    expect(childKeys).toContain('mod-pending');
    expect(childKeys).toContain('mod-suppressed');
    expect(childKeys).toContain('mod-dispute-rules');
  });

  it('analytics group is collapsible with 2 children', () => {
    const analytics = ADMIN_NAV.find((item) => item.key === 'analytics');
    expect(analytics).toBeDefined();
    expect(analytics?.children).toHaveLength(2);
    const childKeys = analytics?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('analytics-overview');
    expect(childKeys).toContain('analytics-sellers');
  });

  it('trust-safety group is collapsible with 5 children', () => {
    const trustSafety = ADMIN_NAV.find((item) => item.key === 'trust-safety');
    expect(trustSafety).toBeDefined();
    expect(trustSafety?.children).toHaveLength(5);
    const childKeys = trustSafety?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('trust-overview');
    expect(childKeys).toContain('trust-settings');
    expect(childKeys).toContain('trust-sellers');
    expect(childKeys).toContain('risk-signals');
    expect(childKeys).toContain('security-events');
  });

  it('promotions is a flat item (no children)', () => {
    const promotions = ADMIN_NAV.find((item) => item.key === 'promotions');
    expect(promotions).toBeDefined();
    expect(promotions?.children).toBeUndefined();
    expect(promotions?.href).toBe('/promotions');
  });

  it('categories group is collapsible with 2 children', () => {
    const categories = ADMIN_NAV.find((item) => item.key === 'categories');
    expect(categories).toBeDefined();
    expect(categories?.children).toHaveLength(2);
    const childKeys = categories?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('categories-tree');
    expect(childKeys).toContain('categories-catalog');
  });

  it('settings group includes cfg-shippo', () => {
    const settings = ADMIN_NAV.find((item) => item.key === 'settings');
    expect(settings?.children?.some((c) => c.key === 'cfg-shippo')).toBe(true);
    const shippo = settings?.children?.find((c) => c.key === 'cfg-shippo');
    expect(shippo?.href).toBe('/cfg/shippo');
  });

  it('standalone affiliates item no longer exists at top level', () => {
    const topLevelKeys = ADMIN_NAV.map((item) => item.key);
    expect(topLevelKeys).not.toContain('affiliates');
  });

  it('dispute-rules href uses correct path', () => {
    const moderation = ADMIN_NAV.find((item) => item.key === 'moderation');
    const disputeRules = moderation?.children?.find((c) => c.key === 'mod-dispute-rules');
    expect(disputeRules).toBeDefined();
    expect(disputeRules?.href).toBe('/mod/disputes/rules');
  });
});

// ─── filterAdminNav ───────────────────────────────────────────────────────────

describe('filterAdminNav', () => {
  it('SUPER_ADMIN gets all items unfiltered', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['SUPER_ADMIN']);
    expect(filtered).toHaveLength(ADMIN_NAV.length);
    expect(filtered).toBe(ADMIN_NAV); // exact same reference
  });

  it('preserves disabled state for SUPER_ADMIN', () => {
    const navWithDisabled: AdminNavItem[] = [
      ...ADMIN_NAV,
      { key: 'disabled-test', label: 'Disabled', href: '/disabled', icon: 'Flag', roles: ['ADMIN'], disabled: true },
    ];
    const filtered = filterAdminNav(navWithDisabled, ['SUPER_ADMIN']);
    const disabledItem = filtered.find((item) => item.key === 'disabled-test');
    expect(disabledItem?.disabled).toBe(true);
  });

  it('ADMIN gets admin-gated items', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['ADMIN']);
    const keys = filtered.map((item) => item.key);
    expect(keys).toContain('dashboard'); // 'any' role
    expect(keys).toContain('finance');
    expect(keys).toContain('users');
    expect(keys).toContain('settings');
    expect(keys).toContain('trust-safety');
    expect(keys).toContain('promotions');
  });

  it('FINANCE gets finance-gated items, not moderation-only', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['FINANCE']);
    const keys = filtered.map((item) => item.key);
    expect(keys).toContain('finance');
    expect(keys).toContain('analytics');
    expect(keys).toContain('promotions');
    // moderation group requires ADMIN, MODERATION, or SUPPORT — not FINANCE alone
    expect(keys).not.toContain('moderation');
  });

  it('MODERATION gets moderation-gated items, not finance-only', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['MODERATION']);
    const keys = filtered.map((item) => item.key);
    expect(keys).toContain('moderation');
    expect(keys).toContain('listings-admin');
    expect(keys).toContain('categories');
    expect(keys).toContain('trust-safety');
    // finance group requires ADMIN or FINANCE — not MODERATION alone
    expect(keys).not.toContain('finance');
  });

  it('HELPDESK_AGENT gets only helpdesk and audit-log (any-role) items', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['HELPDESK_AGENT']);
    const keys = filtered.map((item) => item.key);
    expect(keys).toContain('helpdesk');
    expect(keys).toContain('dashboard'); // 'any' role
    expect(keys).toContain('audit-log'); // 'any' role
    expect(keys).not.toContain('finance');
    expect(keys).not.toContain('moderation');
  });

  it('SRE gets health and security items', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['SRE']);
    const keys = filtered.map((item) => item.key);
    expect(keys).toContain('system-health');
    expect(keys).toContain('errors');
    expect(keys).toContain('operations');
    // trust-safety has security-events child — but SRE not in trust-safety parent roles
    // trust-safety requires ADMIN, MODERATION, SUPPORT
    expect(keys).not.toContain('trust-safety');
  });

  it('DEVELOPER gets flags, health, crosslister items', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['DEVELOPER']);
    const keys = filtered.map((item) => item.key);
    expect(keys).toContain('feature-flags');
    expect(keys).toContain('system-health');
    expect(keys).toContain('crosslister');
    expect(keys).toContain('search-admin');
    expect(keys).not.toContain('finance');
    expect(keys).not.toContain('moderation');
  });

  it('filters children independently from parents', () => {
    const filtered = filterAdminNav(ADMIN_NAV, ['SUPPORT']);
    const usersGroup = filtered.find((item) => item.key === 'users');
    expect(usersGroup).toBeDefined();
    // SUPPORT is in users roles — group should be visible
    // usr-affiliates has roles ['ADMIN', 'FINANCE'] — SUPPORT should not see it
    const childKeys = usersGroup?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toContain('usr-overview');
    expect(childKeys).toContain('usr-sellers');
    expect(childKeys).not.toContain('usr-affiliates');
    // usr-verification requires ADMIN only — SUPPORT should not see it
    expect(childKeys).not.toContain('usr-verification');
  });
});

// ─── ADMIN_NAV — href filesystem validation ───────────────────────────────────

describe('ADMIN_NAV — href filesystem validation', () => {
  it('every leaf href resolves to a page.tsx file', () => {
    const allItems = flattenNav(ADMIN_NAV).filter((item) => !item.children?.length);
    const missing: string[] = [];
    for (const item of allItems) {
      if (DEFERRED_HREFS.has(item.href)) continue;
      const pagePath = hrefToPagePath(item.href);
      if (!fs.existsSync(pagePath)) {
        missing.push(`key=${item.key} href=${item.href}`);
      }
    }
    if (missing.length > 0) {
      console.warn('Missing page.tsx files for nav items:', missing);
    }
    expect(missing).toEqual([]);
  });
});
