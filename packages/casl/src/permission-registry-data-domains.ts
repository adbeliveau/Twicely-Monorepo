/**
 * Permission registry domain module data — Part 2 (G-phase catch-up)
 * Crosslister, Affiliate, Local, and Platform additions from Phases E–G.
 * All subjects must exist in subjects.ts SUBJECTS array.
 */

import type { PermissionModule } from './permission-registry';

export const PERMISSION_MODULES_DOMAINS: PermissionModule[] = [
  // ─── CROSSLISTER ───────────────────────────────────────────────────────────
  {
    subject: 'CrosslisterAccount',
    name: 'Connected Accounts',
    description: 'External marketplace connections (eBay, Poshmark, Mercari)',
    category: 'CROSSLISTER',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Disconnect' },
    ],
  },
  {
    subject: 'ChannelProjection',
    name: 'Channel Projections',
    description: 'Cross-listed listing projections on external channels',
    category: 'CROSSLISTER',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'CrossJob',
    name: 'Crosslist Jobs',
    description: 'Publish, delist, and sync job queue management',
    category: 'CROSSLISTER',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'delete', label: 'Cancel' },
    ],
  },
  {
    subject: 'ImportBatch',
    name: 'Import Batches',
    description: 'Listing import batches from external marketplaces',
    category: 'CROSSLISTER',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'AutomationSetting',
    name: 'Automation Settings',
    description: 'Crosslister automation rules (auto-relist, smart pricing, sharing)',
    category: 'CROSSLISTER',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'update', label: 'Edit' },
    ],
  },
  // ─── AFFILIATE ─────────────────────────────────────────────────────────────
  {
    subject: 'Affiliate',
    name: 'Affiliates',
    description: 'Affiliate accounts — view, approve, suspend, and ban',
    category: 'AFFILIATE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'Referral',
    name: 'Referrals',
    description: 'Affiliate referral tracking records',
    category: 'AFFILIATE',
    actions: [
      { action: 'read', label: 'View' },
    ],
  },
  {
    subject: 'PromoCode',
    name: 'Promo Codes',
    description: 'Affiliate and platform promotional codes',
    category: 'AFFILIATE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'AffiliateCommission',
    name: 'Commissions',
    description: 'Affiliate commission records and earnings',
    category: 'AFFILIATE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
    ],
  },
  {
    subject: 'AffiliatePayout',
    name: 'Affiliate Payouts',
    description: 'Affiliate payout requests and disbursements',
    category: 'AFFILIATE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'execute', label: 'Execute' },
    ],
  },
  // ─── LOCAL ─────────────────────────────────────────────────────────────────
  {
    subject: 'LocalTransaction',
    name: 'Local Transactions',
    description: 'Local pickup transactions — escrow, meetup, QR confirmation',
    category: 'LOCAL',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'SafeMeetupLocation',
    name: 'Safe Meetup Locations',
    description: 'Verified safe meetup spots — create, edit, and deactivate',
    category: 'LOCAL',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  // ─── PLATFORM (additions) ──────────────────────────────────────────────────
  {
    subject: 'Module',
    name: 'Modules',
    description: 'Platform provider modules — view and manage integrations',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'ProviderAdapter',
    name: 'Provider Adapters',
    description: 'External service adapters (AI, shipping, payments)',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'ProviderInstance',
    name: 'Provider Instances',
    description: 'Active provider instances and their configuration',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'ProviderUsageMapping',
    name: 'Provider Usage Mapping',
    description: 'Provider usage routing rules and fallback configuration',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'ProviderHealthLog',
    name: 'Provider Health Logs',
    description: 'Provider uptime and health monitoring logs',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
    ],
  },
  // ─── KYC & PRIVACY — G6 ────────────────────────────────────────────────────
  {
    subject: 'IdentityVerification',
    name: 'Identity Verification',
    description: 'KYC identity verification records — view status and history',
    category: 'USERS_AND_STAFF',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Start' },
      { action: 'update', label: 'Update' },
    ],
  },
  {
    subject: 'DataExportRequest',
    name: 'Data Export Requests',
    description: 'GDPR data portability export requests — view and manage',
    category: 'USERS_AND_STAFF',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Request' },
    ],
  },
  {
    subject: 'DataRetention',
    name: 'Data Retention',
    description: 'Data retention policies and deletion queue — admin management',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  // ─── CURATION — G3.10 ──────────────────────────────────────────────────────
  {
    subject: 'CuratedCollection',
    name: 'Curated Collections',
    description: 'Staff-curated listing collections shown on the Explore page',
    category: 'CONTENT',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  // ─── FINANCE EXTENSIONS — I3 ───────────────────────────────────────────────
  {
    subject: 'Chargeback',
    name: 'Chargebacks',
    description: 'Stripe chargeback disputes grouped by dispute ID — view and track resolution status',
    category: 'FINANCE',
    actions: [
      { action: 'read', label: 'View' },
    ],
  },
  {
    subject: 'Hold',
    name: 'Reserve Holds',
    description: 'Funds held in reserve pending release — view active and released holds',
    category: 'FINANCE',
    actions: [
      { action: 'read', label: 'View' },
    ],
  },
  // ─── TRUST & SAFETY — I7 ────────────────────────────────────────────────────
  {
    subject: 'TrustSafety',
    name: 'Trust & Safety',
    description: 'Seller trust scores, band distribution, enforcement levels, and band override controls',
    category: 'TRUST_AND_SAFETY',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'update', label: 'Override Band' },
    ],
  },
  {
    subject: 'SecurityEvent',
    name: 'Security Events',
    description: 'Platform security audit events — login anomalies, IP flags, risk signals',
    category: 'TRUST_AND_SAFETY',
    actions: [
      { action: 'read', label: 'View' },
    ],
  },
];
