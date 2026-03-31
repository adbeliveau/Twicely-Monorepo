import type { AdminNavItem } from './admin-nav-types';

/**
 * Core admin nav sections: Dashboard, Analytics, Users, Transactions,
 * Finance, Moderation, Trust & Safety, Promotions, Support.
 */
export const ADMIN_NAV_CORE: AdminNavItem[] = [
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
];
