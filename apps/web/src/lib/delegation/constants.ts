import type { DelegationScope } from '@twicely/casl/types';

// Role presets from Actors canonical section 3.4
export const ROLE_PRESETS = {
  MANAGER: [
    'dashboard.view', 'listings.view', 'listings.manage',
    'orders.view', 'orders.manage', 'shipping.manage',
    'returns.respond', 'messages.view', 'messages.send',
    'finance.view', 'analytics.view', 'promotions.view',
    'promotions.manage', 'settings.view', 'settings.manage',
  ] as DelegationScope[],
  FULFILLMENT: [
    'dashboard.view', 'orders.view', 'orders.manage',
    'shipping.manage', 'messages.view', 'messages.send',
  ] as DelegationScope[],
  FINANCE: [
    'dashboard.view', 'finance.view', 'orders.view', 'analytics.view',
  ] as DelegationScope[],
  SUPPORT: [
    'dashboard.view', 'orders.view', 'returns.respond',
    'messages.view', 'messages.send',
  ] as DelegationScope[],
  READ_ONLY: [
    'dashboard.view', 'listings.view', 'orders.view',
    'finance.view', 'analytics.view', 'messages.view', 'settings.view',
  ] as DelegationScope[],
} as const;

export type RolePreset = keyof typeof ROLE_PRESETS;

// All valid delegation scopes (must match DelegationScope type exactly)
export const ALL_SCOPES: DelegationScope[] = [
  'dashboard.view', 'listings.view', 'listings.manage',
  'orders.view', 'orders.manage', 'shipping.manage',
  'returns.respond', 'messages.view', 'messages.send',
  'finance.view', 'analytics.view', 'promotions.view',
  'promotions.manage', 'settings.view', 'settings.manage',
  'staff.manage',
  'crosslister.read', 'crosslister.publish', 'crosslister.import', 'crosslister.manage',
];

// Scope display labels
export const SCOPE_LABELS: Record<DelegationScope, string> = {
  'dashboard.view': 'View dashboard',
  'listings.view': 'View listings',
  'listings.manage': 'Manage listings',
  'orders.view': 'View orders',
  'orders.manage': 'Manage orders',
  'shipping.manage': 'Manage shipping',
  'returns.respond': 'Respond to returns',
  'messages.view': 'View messages',
  'messages.send': 'Send messages',
  'finance.view': 'View finances',
  'analytics.view': 'View analytics',
  'promotions.view': 'View promotions',
  'promotions.manage': 'Manage promotions',
  'settings.view': 'View store settings',
  'settings.manage': 'Manage store settings',
  'staff.manage': 'Manage staff',
  'crosslister.read': 'View crosslister accounts and jobs',
  'crosslister.publish': 'Publish listings to external platforms',
  'crosslister.import': 'Import listings from connected platforms',
  'crosslister.manage': 'Full crosslister management',
};

// Scope groupings for UI
export const SCOPE_CATEGORIES = [
  { label: 'Dashboard', scopes: ['dashboard.view'] as DelegationScope[] },
  { label: 'Listings', scopes: ['listings.view', 'listings.manage'] as DelegationScope[] },
  { label: 'Orders', scopes: ['orders.view', 'orders.manage'] as DelegationScope[] },
  { label: 'Shipping', scopes: ['shipping.manage'] as DelegationScope[] },
  { label: 'Returns', scopes: ['returns.respond'] as DelegationScope[] },
  { label: 'Messages', scopes: ['messages.view', 'messages.send'] as DelegationScope[] },
  { label: 'Finance', scopes: ['finance.view'] as DelegationScope[] },
  { label: 'Analytics', scopes: ['analytics.view'] as DelegationScope[] },
  { label: 'Promotions', scopes: ['promotions.view', 'promotions.manage'] as DelegationScope[] },
  { label: 'Store Settings', scopes: ['settings.view', 'settings.manage'] as DelegationScope[] },
  { label: 'Staff', scopes: ['staff.manage'] as DelegationScope[] },
  { label: 'Crosslister', scopes: ['crosslister.read', 'crosslister.publish', 'crosslister.import', 'crosslister.manage'] as DelegationScope[] },
] as const;

// Staff limits per StoreTier (from User Model section 4.1)
export const TIER_STAFF_LIMITS: Record<string, number> = {
  NONE: 0,
  STARTER: 0,
  PRO: 5,
  POWER: 25,
  ENTERPRISE: 999, // Effectively unlimited, capped by platform setting
};
