import type { AdminNavItem } from './admin-nav-types';

/**
 * Extended admin nav sections: Content Management, Data Management, Ops,
 * Settings, Crosslister, Localization, Compliance, Providers.
 */
export const ADMIN_NAV_EXTENDED: AdminNavItem[] = [
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
    children: [
      { key: 'roles-overview', label: 'Roles Overview', href: '/roles', icon: 'UserCog', roles: ['ADMIN'] },
      { key: 'staff', label: 'Staff', href: '/roles/staff', icon: 'Users', roles: ['ADMIN'] },
    ],
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
