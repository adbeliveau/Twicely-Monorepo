// ─── Hub Navigation Registry ────────────────────────────────────────────────
// Reference: TWICELY_V3_UNIFIED_HUB_CANONICAL.md §3.4, §3.5

import type { UserCapabilities, HubGate } from '@/types/hub';

// ─── Types ──────────────────────────────────────────────────────────────────

export type HubNavSection = {
  key: string;
  label: string;
  icon: string;                              // Lucide icon name
  gate: HubGate;
  parent?: string;                           // If set, renders as sub-group under parent section
  items: HubNavItem[];
};

export type HubNavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;                             // Badge key (resolved by sidebar props)
  requiresScope?: string;                    // For staff: delegated access scope
  external?: boolean;                        // Links outside /my shell (e.g., /h)
  disabled?: boolean;                        // Grays out item, prevents navigation
  exact?: boolean;                           // Only highlight on exact pathname match
};

// ─── Navigation Registry ────────────────────────────────────────────────────

export const HUB_NAV: HubNavSection[] = [
  // ─── ALWAYS VISIBLE ─────────────────────────────────────────────
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    gate: 'ALWAYS',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/my', icon: 'LayoutDashboard' },
    ],
  },
  {
    key: 'shopping',
    label: 'Shopping',
    icon: 'ShoppingBag',
    gate: 'ALWAYS',
    items: [
      { key: 'feed', label: 'For You', href: '/my/feed', icon: 'Heart', disabled: false },
      { key: 'purchases', label: 'Purchases', href: '/my/buying/orders', icon: 'Package' },
      { key: 'offers-sent', label: 'Offers Sent', href: '/my/buying/offers', icon: 'Send' },
      { key: 'watchlist', label: 'Watchlist', href: '/my/buying/watchlist', icon: 'Heart' },
      { key: 'saved-searches', label: 'Saved Searches', href: '/my/buying/searches', icon: 'Search' },
      { key: 'my-reviews', label: 'My Reviews', href: '/my/buying/reviews', icon: 'Star' },
      { key: 'following', label: 'Following', href: '/my/buying/following', icon: 'UserPlus', disabled: false },
      { key: 'alerts', label: 'Price Alerts', href: '/my/buying/alerts', icon: 'Bell' },
      { key: 'history', label: 'History', href: '/my/buying/history', icon: 'Clock' },
    ],
  },

  // ─── SELLING ────────────────────────────────────────────────────
  {
    key: 'selling',
    label: 'Selling',
    icon: 'Store',
    gate: 'IS_SELLER',
    items: [
      { key: 'listings', label: 'Listings', href: '/my/selling/listings', icon: 'Tag',
        requiresScope: 'listings.view' },
      { key: 'seller-orders', label: 'Orders', href: '/my/selling/orders', icon: 'ShoppingCart',
        requiresScope: 'orders.view' },
      { key: 'offers-received', label: 'Offers', href: '/my/selling/offers', icon: 'HandCoins',
        requiresScope: 'orders.view' },
      { key: 'returns', label: 'Returns', href: '/my/selling/returns', icon: 'RotateCcw',
        requiresScope: 'returns.respond' },
      { key: 'shipping', label: 'Shipping Profiles', href: '/my/selling/shipping', icon: 'Truck',
        requiresScope: 'shipping.manage' },
      { key: 'promotions', label: 'Promotions', href: '/my/selling/promotions', icon: 'Megaphone',
        requiresScope: 'promotions.view' },
      { key: 'authentication', label: 'Authentication', href: '/my/selling/authentication', icon: 'ShieldCheck',
        requiresScope: 'listings.view' },
    ],
  },

  // ─── CROSSLISTER (sub-group under Selling) ─────────────────────
  // Gate is IS_SELLER — free one-time import is available to ALL sellers
  // regardless of ListerTier. The import flywheel must not be gated behind a subscription.
  {
    key: 'crosslister',
    label: 'Crosslister',
    icon: 'RefreshCw',
    gate: 'IS_SELLER',
    parent: 'selling',
    items: [
      { key: 'platforms', label: 'Platforms', href: '/my/selling/crosslist/connect', icon: 'Link',
        requiresScope: 'crosslister.manage' },
      { key: 'import', label: 'Import', href: '/my/selling/crosslist/import', icon: 'Download',
        requiresScope: 'crosslister.import' },
      { key: 'automation', label: 'Automation', href: '/my/selling/crosslist/automation', icon: 'Zap',
        requiresScope: 'crosslister.manage', disabled: false },
    ],
  },

  // ─── STORE (sub-group under Selling) ────────────────────────────
  {
    key: 'store',
    label: 'Store',
    icon: 'Storefront',
    gate: 'HAS_STORE',
    parent: 'selling',
    items: [
      { key: 'branding', label: 'Branding', href: '/my/selling/store', icon: 'Palette',
        requiresScope: 'store.manage' },
      { key: 'page-builder', label: 'Page Builder', href: '/my/selling/store/editor', icon: 'Layout',
        requiresScope: 'store.manage' },
      { key: 'staff', label: 'Staff', href: '/my/selling/staff', icon: 'Users',
        requiresScope: 'staff.manage' },
    ],
  },

  // ─── FINANCE (sub-group under Selling) ──────────────────────────
  {
    key: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    gate: 'IS_SELLER',
    parent: 'selling',
    items: [
      { key: 'finance-overview', label: 'Overview', href: '/my/selling/finances', icon: 'BarChart2',
        requiresScope: 'finances.view', exact: true },
      { key: 'transactions', label: 'Transactions', href: '/my/selling/finances/transactions', icon: 'FileText',
        requiresScope: 'finances.view' },
      { key: 'payouts', label: 'Payouts', href: '/my/selling/finances/payouts', icon: 'Banknote',
        requiresScope: 'finances.view' },
      { key: 'platform-revenue', label: 'Platform Revenue', href: '/my/selling/finances/platforms', icon: 'TrendingUp',
        requiresScope: 'finances.view' },
      { key: 'integrations', label: 'Integrations', href: '/my/selling/finances/integrations', icon: 'Link2',
        requiresScope: 'finances.view' },
    ],
  },

  // ─── SELLER EXTRAS (flat items after sub-groups) ────────────────
  {
    key: 'seller-extras',
    label: '',
    icon: '',
    gate: 'IS_SELLER',
    parent: 'selling',
    items: [
      { key: 'analytics', label: 'Analytics', href: '/my/selling/analytics', icon: 'BarChart2',
        requiresScope: 'analytics.view' },
      { key: 'subscription', label: 'Subscription', href: '/my/selling/subscription', icon: 'Crown' },
      { key: 'affiliate', label: 'Affiliate', href: '/my/selling/affiliate', icon: 'Users' },
      { key: 'local-pickup', label: 'Local Pickup', href: '/my/selling/settings/local', icon: 'MapPin' },
    ],
  },

  // ─── MESSAGES ───────────────────────────────────────────────────
  {
    key: 'messages',
    label: 'Messages',
    icon: 'MessageSquare',
    gate: 'ALWAYS',
    items: [
      {
        key: 'inbox',
        label: 'Inbox',
        href: '/my/messages',
        icon: 'MessageSquare',
        badge: 'unreadMessages',
      },
    ],
  },

  // ─── SETTINGS ───────────────────────────────────────────────────
  {
    key: 'settings',
    label: 'Settings',
    icon: 'Settings',
    gate: 'ALWAYS',
    items: [
      { key: 'account', label: 'Account', href: '/my/settings', icon: 'UserCircle' },
      { key: 'addresses', label: 'Addresses', href: '/my/settings/addresses', icon: 'MapPin' },
      { key: 'security', label: 'Security', href: '/my/settings/security', icon: 'Shield' },
      { key: 'notifications', label: 'Notifications', href: '/my/settings/notifications', icon: 'Bell' },
    ],
  },

  // ─── HELP ───────────────────────────────────────────────────────
  {
    key: 'help',
    label: 'Help',
    icon: 'HelpCircle',
    gate: 'ALWAYS',
    items: [
      { key: 'help-center', label: 'Help Center', href: '/h', icon: 'BookOpen', external: true },
      { key: 'contact', label: 'Contact Support', href: '/h/contact', icon: 'HelpCircle', external: true },
      { key: 'my-cases', label: 'My Cases', href: '/my/support', icon: 'Ticket', disabled: false },
    ],
  },
];

// ─── Navigation Filter Function ─────────────────────────────────────────────

/**
 * filterHubNav — filters navigation based on user capabilities
 *
 * Reference: TWICELY_V3_UNIFIED_HUB_CANONICAL.md §3.5
 *
 * Steps:
 * 1. Filter sections by capability gate
 * 2. Filter items by staff scopes (if acting as delegated staff)
 * 3. Remove empty sections
 */
export function filterHubNav(
  nav: HubNavSection[],
  capabilities: UserCapabilities
): HubNavSection[] {
  // Step 1: Filter by gate
  const gated = nav.filter((section) => {
    switch (section.gate) {
      case 'ALWAYS':          return true;
      case 'IS_SELLER':       return capabilities.isSeller;
      case 'HAS_CROSSLISTER': return capabilities.hasCrosslister;
      case 'HAS_STORE':       return capabilities.hasStore;
      default:                return false;
    }
  });

  // Step 2: Filter items by staff scopes
  const scoped = gated.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.requiresScope) return true;
      if (!capabilities.isStaff) return true;      // Owners have all scopes
      return (
        capabilities.delegatedScopes.includes('*') ||
        capabilities.delegatedScopes.includes(item.requiresScope)
      );
    }),
  }));

  // Step 3: Remove empty sections
  return scoped.filter((section) => section.items.length > 0);
}
