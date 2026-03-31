import type { PlatformRole } from '@twicely/casl/types';

// Navigation item shape for the hub admin sidebar
export type AdminNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  roles: PlatformRole[] | 'any'; // 'any' = any authenticated staff role
  disabled?: boolean;            // Grays out item, prevents navigation
  children?: AdminNavItem[];     // Sub-items (collapsible group)
};

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
  // ─── Core ──────────────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/d',
    icon: 'LayoutDashboard',
    roles: 'any',
  },

  // ─── Analytics ────────────────────────────────────────────────────────────
  {
    key: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: 'BarChart2',
    roles: ['ADMIN', 'FINANCE'],
    children: [
      { key: 'analytics-overview', label: 'Platform', href: '/analytics', icon: 'BarChart2', roles: ['ADMIN', 'FINANCE'] },
      { key: 'analytics-sellers', label: 'Sellers', href: '/analytics/sellers', icon: 'TrendingUp', roles: ['ADMIN', 'FINANCE'] },
    ],
  },

  // ─── Users ─────────────────────────────────────────────────────────────────
  {
    key: 'users',
    label: 'Users',
    href: '/usr',
    icon: 'Users',
    roles: ['ADMIN', 'SUPPORT'],
    children: [
      { key: 'usr-overview', label: 'All Users', href: '/usr', icon: 'Users', roles: ['ADMIN', 'SUPPORT'] },
      { key: 'usr-sellers', label: 'Sellers', href: '/usr/sellers', icon: 'Store', roles: ['ADMIN', 'SUPPORT'] },
      { key: 'usr-verification', label: 'Verification Queue', href: '/usr/sellers/verification', icon: 'ShieldCheck', roles: ['ADMIN'] },
      { key: 'usr-affiliates', label: 'Affiliates', href: '/usr/affiliates', icon: 'UserPlus', roles: ['ADMIN', 'FINANCE'] },
    ],
  },

  // ─── Transactions (collapsible) ────────────────────────────────────────────
  {
    key: 'transactions',
    label: 'Transactions',
    href: '/tx',
    icon: 'CreditCard',
    roles: ['ADMIN', 'SUPPORT', 'FINANCE'],
    children: [
      { key: 'tx-overview', label: 'Overview', href: '/tx', icon: 'CreditCard', roles: ['ADMIN', 'SUPPORT', 'FINANCE'] },
      { key: 'tx-orders', label: 'Orders', href: '/tx/orders', icon: 'ShoppingCart', roles: ['ADMIN', 'SUPPORT', 'FINANCE'] },
      { key: 'tx-payments', label: 'Payments', href: '/tx/payments', icon: 'Banknote', roles: ['ADMIN', 'FINANCE'] },
    ],
  },

  // ─── Finance (collapsible) ─────────────────────────────────────────────────
  {
    key: 'finance',
    label: 'Finance',
    href: '/fin',
    icon: 'DollarSign',
    roles: ['ADMIN', 'FINANCE'],
    children: [
      { key: 'fin-overview', label: 'Overview', href: '/fin', icon: 'DollarSign', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-ledger', label: 'Ledger', href: '/fin/ledger', icon: 'BookOpen', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-payouts', label: 'Payouts', href: '/fin/payouts', icon: 'Banknote', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-recon', label: 'Reconciliation', href: '/fin/recon', icon: 'Scale', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-adjustments', label: 'Adjustments', href: '/fin/adjustments', icon: 'SlidersHorizontal', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-costs', label: 'Platform Costs', href: '/fin/costs', icon: 'Receipt', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-promo-codes', label: 'Promo Codes', href: '/fin/promo-codes', icon: 'Ticket', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-affiliate-payouts', label: 'Affiliate Payouts', href: '/fin/affiliate-payouts', icon: 'UserPlus', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-tax', label: 'Tax Compliance', href: '/fin/tax', icon: 'FileText', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-chargebacks', label: 'Chargebacks', href: '/fin/chargebacks', icon: 'AlertTriangle', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-holds', label: 'Reserve Holds', href: '/fin/holds', icon: 'Lock', roles: ['ADMIN', 'FINANCE'] },
      { key: 'fin-subscriptions', label: 'Subscriptions', href: '/fin/subscriptions', icon: 'Crown', roles: ['ADMIN', 'FINANCE'] },
    ],
  },

  // ─── Moderation (collapsible) ──────────────────────────────────────────────
  {
    key: 'moderation',
    label: 'Moderation',
    href: '/mod',
    icon: 'Shield',
    roles: ['ADMIN', 'MODERATION', 'SUPPORT'],
    children: [
      { key: 'mod-overview', label: 'Queue', href: '/mod', icon: 'Shield', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-queue', label: 'Unified Queue', href: '/mod/queue', icon: 'Layers', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-pending', label: 'Pending Review', href: '/mod/listings/pending', icon: 'Clock', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-suppressed', label: 'Suppressed', href: '/mod/listings/suppressed', icon: 'EyeOff', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-listings', label: 'Listings', href: '/mod/listings', icon: 'Tag', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-reviews', label: 'Reviews', href: '/mod/reviews', icon: 'Star', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-messages', label: 'Messages', href: '/mod/messages', icon: 'MessageSquareWarning', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-disputes', label: 'Disputes', href: '/mod/disputes', icon: 'AlertTriangle', roles: ['ADMIN', 'SUPPORT'] },
      { key: 'mod-dispute-rules', label: 'Dispute Rules', href: '/mod/disputes/rules', icon: 'Scale', roles: ['ADMIN'] },
      { key: 'mod-returns', label: 'Returns', href: '/mod/returns', icon: 'RotateCcw', roles: ['ADMIN', 'SUPPORT'] },
      { key: 'mod-collections', label: 'Collections', href: '/mod/collections', icon: 'Layers', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-reports', label: 'Content Reports', href: '/mod/reports', icon: 'Flag', roles: ['ADMIN', 'MODERATION'] },
      { key: 'mod-enforcement', label: 'Enforcement', href: '/mod/enforcement', icon: 'Gavel', roles: ['ADMIN', 'MODERATION'] },
    ],
  },

  // ─── Trust & Safety ────────────────────────────────────────────────────────
  {
    key: 'trust-safety',
    label: 'Trust & Safety',
    href: '/trust',
    icon: 'ShieldCheck',
    roles: ['ADMIN', 'MODERATION', 'SUPPORT'],
    children: [
      { key: 'trust-overview', label: 'Trust Overview', href: '/trust', icon: 'ShieldCheck', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] },
      { key: 'trust-settings', label: 'Trust Settings', href: '/trust/settings', icon: 'Settings', roles: ['ADMIN'] },
      { key: 'risk-signals', label: 'Risk Signals', href: '/risk', icon: 'AlertTriangle', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] },
      { key: 'security-events', label: 'Security', href: '/security', icon: 'Shield', roles: ['ADMIN', 'SRE'] },
    ],
  },

  // ─── Promotions ────────────────────────────────────────────────────────────
  {
    key: 'promotions',
    label: 'Promotions',
    href: '/promotions',
    icon: 'Ticket',
    roles: ['ADMIN', 'FINANCE', 'MODERATION'],
  },

  // ─── Support ───────────────────────────────────────────────────────────────
  {
    key: 'helpdesk',
    label: 'Helpdesk',
    href: '/hd',
    icon: 'Headphones',
    roles: ['HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN'],
  },
  {
    key: 'knowledge-base',
    label: 'Knowledge Base',
    href: '/kb',
    icon: 'BookOpen',
    roles: ['HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN'],
  },

  // ─── Content Management ────────────────────────────────────────────────────
  {
    key: 'listings-admin',
    label: 'Listings',
    href: '/listings',
    icon: 'Tag',
    roles: ['ADMIN', 'MODERATION'],
  },
  {
    key: 'categories',
    label: 'Categories',
    href: '/categories',
    icon: 'FolderOpen',
    roles: ['ADMIN', 'MODERATION'],
    children: [
      { key: 'categories-tree', label: 'Category Tree', href: '/categories', icon: 'FolderOpen', roles: ['ADMIN', 'MODERATION'] },
      { key: 'categories-catalog', label: 'Catalog Browser', href: '/categories/catalog', icon: 'Grid', roles: ['ADMIN', 'MODERATION'] },
    ],
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    href: '/subscriptions',
    icon: 'Crown',
    roles: ['ADMIN'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    href: '/notifications',
    icon: 'Bell',
    roles: ['ADMIN'],
  },

  // ─── Data Management (collapsible) ────────────────────────────────────────
  {
    key: 'data-management',
    label: 'Data Management',
    href: '/bulk',
    icon: 'Database',
    roles: ['ADMIN'],
    children: [
      { key: 'data-bulk', label: 'Bulk Operations', href: '/bulk', icon: 'Layers', roles: ['ADMIN'] },
      { key: 'data-exports', label: 'Data Exports', href: '/exports', icon: 'FileText', roles: ['ADMIN'] },
      { key: 'data-imports', label: 'Imports', href: '/imports', icon: 'RefreshCw', roles: ['ADMIN'] },
    ],
  },

  // ─── Ops ───────────────────────────────────────────────────────────────────
  {
    key: 'feature-flags',
    label: 'Feature Flags',
    href: '/flags',
    icon: 'Flag',
    roles: ['ADMIN', 'DEVELOPER'],
  },
  {
    key: 'errors',
    label: 'Error Log',
    href: '/errors',
    icon: 'AlertTriangle',
    roles: ['ADMIN', 'DEVELOPER', 'SRE'],
  },
  {
    key: 'operations',
    label: 'Operations',
    href: '/operations',
    icon: 'Terminal',
    roles: ['ADMIN', 'SRE'],
  },
  {
    key: 'admin-messages',
    label: 'Broadcasts',
    href: '/admin-messages',
    icon: 'MessageSquareWarning',
    roles: ['ADMIN'],
  },
  {
    key: 'search-admin',
    label: 'Search Admin',
    href: '/search-admin',
    icon: 'Search',
    roles: ['ADMIN', 'DEVELOPER'],
  },
  {
    key: 'roles',
    label: 'Roles & Permissions',
    href: '/roles',
    icon: 'UserCog',
    roles: ['ADMIN'],
  },
  {
    key: 'staff',
    label: 'Staff',
    href: '/roles/staff',
    icon: 'Users',
    roles: ['ADMIN'],
  },
  {
    key: 'audit-log',
    label: 'Audit Log',
    href: '/audit',
    icon: 'ClipboardList',
    roles: 'any',
  },
  {
    key: 'system-health',
    label: 'System Health',
    href: '/health',
    icon: 'Activity',
    roles: ['ADMIN', 'DEVELOPER', 'SRE'],
    children: [
      { key: 'health-overview', label: 'Overview', href: '/health', icon: 'Activity', roles: ['ADMIN', 'DEVELOPER', 'SRE'] },
      { key: 'health-doctor', label: 'Doctor', href: '/health/doctor', icon: 'Stethoscope', roles: ['ADMIN', 'SRE'] },
    ],
  },

  // ─── Settings (collapsible) ────────────────────────────────────────────────
  {
    key: 'settings',
    label: 'Settings',
    href: '/cfg',
    icon: 'Settings',
    roles: ['ADMIN'],
    children: [
      { key: 'cfg-overview', label: 'Overview', href: '/cfg', icon: 'Settings', roles: ['ADMIN'] },
      { key: 'cfg-platform', label: 'Platform Config', href: '/cfg/platform', icon: 'Sliders', roles: ['ADMIN'] },
      { key: 'cfg-monetization', label: 'Monetization', href: '/cfg/monetization', icon: 'Coins', roles: ['ADMIN'] },
      { key: 'cfg-trust', label: 'Trust & Moderation', href: '/cfg/trust', icon: 'ShieldCheck', roles: ['ADMIN'] },
      { key: 'cfg-stripe', label: 'Stripe Payments', href: '/cfg/stripe', icon: 'CreditCard', roles: ['ADMIN'] },
      { key: 'cfg-shippo', label: 'Shippo Shipping', href: '/cfg/shippo', icon: 'Truck', roles: ['ADMIN'] },
      { key: 'cfg-meetup', label: 'Meetup Locations', href: '/cfg/meetup-locations', icon: 'MapPin', roles: ['ADMIN'] },
      { key: 'cfg-modules', label: 'Modules', href: '/cfg/modules', icon: 'Puzzle', roles: ['ADMIN'] },
      { key: 'cfg-messaging', label: 'Messaging Keywords', href: '/cfg/messaging/keywords', icon: 'MessageSquareWarning', roles: ['ADMIN'] },
      { key: 'cfg-environment', label: 'Environment', href: '/cfg/environment', icon: 'Terminal', roles: ['ADMIN'] },
      { key: 'cfg-jobs', label: 'Jobs & Scheduler', href: '/cfg/jobs', icon: 'Clock', roles: ['ADMIN'] },
      { key: 'cfg-infrastructure', label: 'Infrastructure', href: '/cfg/infrastructure', icon: 'Server', roles: ['ADMIN'] },
      { key: 'cfg-data-retention', label: 'Data Retention', href: '/cfg/data-retention', icon: 'Archive', roles: ['ADMIN'] },
      { key: 'cfg-integrations', label: 'Integrations', href: '/cfg/integrations', icon: 'Plug', roles: ['ADMIN'] },
    ],
  },

  // ─── Crosslister Connectors (collapsible) ─────────────────────────────────
  {
    key: 'crosslister',
    label: 'Crosslister',
    href: '/cfg/ebay',
    icon: 'RefreshCw',
    roles: ['ADMIN', 'DEVELOPER'],
    children: [
      { key: 'cfg-ebay', label: 'eBay', href: '/cfg/ebay', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-etsy', label: 'Etsy', href: '/cfg/etsy', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-mercari', label: 'Mercari', href: '/cfg/mercari', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-poshmark', label: 'Poshmark', href: '/cfg/poshmark', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-depop', label: 'Depop', href: '/cfg/depop', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-grailed', label: 'Grailed', href: '/cfg/grailed', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-fb-marketplace', label: 'FB Marketplace', href: '/cfg/fb-marketplace', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-therealreal', label: 'The RealReal', href: '/cfg/therealreal', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-whatnot', label: 'Whatnot', href: '/cfg/whatnot', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-shopify', label: 'Shopify', href: '/cfg/shopify', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'cfg-vestiaire', label: 'Vestiaire', href: '/cfg/vestiaire', icon: 'ShoppingBag', roles: ['ADMIN', 'DEVELOPER'] },
    ],
  },

  // ─── Localization (collapsible) ───────────────────────────────────────────
  {
    key: 'localization',
    label: 'Localization',
    href: '/translations',
    icon: 'Globe',
    roles: ['ADMIN'],
    children: [
      { key: 'translations', label: 'Translations', href: '/translations', icon: 'Languages', roles: ['ADMIN'] },
      { key: 'policies', label: 'Policy Versions', href: '/policies', icon: 'FileText', roles: ['ADMIN'] },
      { key: 'currency', label: 'Currency', href: '/currency', icon: 'DollarSign', roles: ['ADMIN'] },
    ],
  },

  // ─── Compliance (collapsible) ──────────────────────────────────────────────
  {
    key: 'compliance',
    label: 'Compliance',
    href: '/delegated-access',
    icon: 'Shield',
    roles: ['ADMIN'],
    children: [
      { key: 'delegated-access', label: 'Delegated Access', href: '/delegated-access', icon: 'Users', roles: ['ADMIN'] },
      { key: 'shipping-admin', label: 'Shipping', href: '/shipping-admin', icon: 'Truck', roles: ['ADMIN'] },
      { key: 'taxes', label: 'Tax Rules', href: '/taxes', icon: 'Calculator', roles: ['ADMIN'] },
    ],
  },

  // ─── Providers (collapsible, under Settings conceptually) ──────────────────
  {
    key: 'providers',
    label: 'Providers',
    href: '/cfg/providers',
    icon: 'Server',
    roles: ['ADMIN', 'DEVELOPER'],
    children: [
      { key: 'providers-overview', label: 'Overview', href: '/cfg/providers', icon: 'Server', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'providers-adapters', label: 'Adapters', href: '/cfg/providers/adapters', icon: 'Plug', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'providers-instances', label: 'Instances', href: '/cfg/providers/instances', icon: 'Database', roles: ['ADMIN', 'DEVELOPER'] },
      { key: 'providers-mappings', label: 'Usage Mappings', href: '/cfg/providers/mappings', icon: 'GitBranch', roles: ['ADMIN'] },
      { key: 'providers-health', label: 'Health Logs', href: '/cfg/providers/health', icon: 'Activity', roles: ['ADMIN', 'DEVELOPER'] },
    ],
  },
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
