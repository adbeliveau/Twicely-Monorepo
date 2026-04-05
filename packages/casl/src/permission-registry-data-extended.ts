/**
 * Permission registry extended module data — Part 1 (G-phase catch-up)
 * Commerce, Finance, Trust & Safety, Content additions from Phases D–G.
 * All subjects must exist in subjects.ts SUBJECTS array.
 */

import type { PermissionModule } from './permission-registry';

export const PERMISSION_MODULES_EXTENDED: PermissionModule[] = [
  // ─── COMMERCE (additions) ──────────────────────────────────────────────────
  {
    subject: 'Shipment',
    name: 'Shipments',
    description: 'Shipping labels and tracking — view and manage shipment records',
    category: 'COMMERCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
    ],
  },
  {
    subject: 'ShippingProfile',
    name: 'Shipping Profiles',
    description: 'Seller shipping profiles — view and manage shipping rate templates',
    category: 'COMMERCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'Offer',
    name: 'Offers',
    description: 'Buyer offers and counter-offers on listings',
    category: 'COMMERCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'PromotedListing',
    name: 'Promoted Listings',
    description: 'Boosted listings — view and manage promoted listing campaigns',
    category: 'COMMERCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'CombinedShippingQuote',
    name: 'Combined Shipping Quotes',
    description: 'Seller-quoted combined shipping for multi-item orders',
    category: 'COMMERCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'DelegatedAccess',
    name: 'Delegated Access',
    description: 'Seller staff delegation — view and manage delegated access grants',
    category: 'COMMERCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  // ─── FINANCE (additions) ───────────────────────────────────────────────────
  {
    subject: 'Expense',
    name: 'Expenses',
    description: 'Seller expense tracking for Financial Center',
    category: 'FINANCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'FinancialReport',
    name: 'Financial Reports',
    description: 'P&L, balance sheet, and cash flow reports',
    category: 'FINANCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Generate' },
    ],
  },
  {
    subject: 'MileageEntry',
    name: 'Mileage Entries',
    description: 'Seller mileage tracking for tax deductions',
    category: 'FINANCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'AccountingIntegration',
    name: 'Accounting Integrations',
    description: 'QuickBooks/Xero integrations — connect, sync, and manage accounting data',
    category: 'FINANCE',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Connect' },
      { action: 'update', label: 'Sync' },
      { action: 'delete', label: 'Disconnect' },
    ],
  },
  // ─── TRUST_AND_SAFETY (additions) ──────────────────────────────────────────
  {
    subject: 'ContentReport',
    name: 'Content Reports',
    description: 'User-submitted reports on listings, reviews, messages, and users — review and action',
    category: 'TRUST_AND_SAFETY',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Submit' },
      { action: 'update', label: 'Review' },
    ],
  },
  {
    subject: 'EnforcementAction',
    name: 'Enforcement Actions',
    description: 'Staff enforcement actions against users — warnings, restrictions, suspensions',
    category: 'TRUST_AND_SAFETY',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Issue' },
      { action: 'update', label: 'Lift / Modify' },
    ],
  },
  {
    subject: 'LocalFraudFlag',
    name: 'Local Fraud Flags',
    description: 'Escrow fraud detection flags — review, confirm, or dismiss',
    category: 'TRUST_AND_SAFETY',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Review' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'LocalReliabilityEvent',
    name: 'Reliability Events',
    description: 'Local meetup reliability marks — view and manage reliability history',
    category: 'TRUST_AND_SAFETY',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  // ─── CONTENT (additions) ───────────────────────────────────────────────────
  {
    subject: 'ListingQuestion',
    name: 'Q&A',
    description: 'Listing questions and answers — moderate Q&A content',
    category: 'CONTENT',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
    ],
  },
  {
    subject: 'ReviewResponse',
    name: 'Review Responses',
    description: 'Seller responses to buyer reviews — view and moderate',
    category: 'CONTENT',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'update', label: 'Moderate' },
      { action: 'delete', label: 'Delete' },
    ],
  },

  // ─── HELPDESK (G9 additions) ───────────────────────────────────────────────
  {
    subject: 'KbArticle',
    name: 'KB Articles',
    description: 'Knowledge base articles — create, publish, and manage help content',
    category: 'CONTENT',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'delete', label: 'Delete' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'KbCategory',
    name: 'KB Categories',
    description: 'Knowledge base categories — organize and reorder help topics',
    category: 'CONTENT',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'update', label: 'Edit' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskTeam',
    name: 'Helpdesk Teams',
    description: 'Helpdesk agent teams — manage team membership and availability',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskTeamMember',
    name: 'Helpdesk Team Members',
    description: 'Helpdesk agent availability and online status — agents update their own status',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'update', label: 'Update availability' },
    ],
  },
  {
    subject: 'HelpdeskMacro',
    name: 'Helpdesk Macros',
    description: 'Helpdesk response macros — create and manage canned reply templates',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskSavedView',
    name: 'Helpdesk Saved Views',
    description: 'Saved case queue filters — personal and shared view presets',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'create', label: 'Create' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskRoutingRule',
    name: 'Routing Rules',
    description: 'Case routing rules — auto-assign cases based on conditions',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskSlaPolicy',
    name: 'SLA Policies',
    description: 'SLA response targets — configure first-response and resolution times',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskAutomationRule',
    name: 'Automation Rules',
    description: 'Helpdesk automation — trigger actions on case events',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'HelpdeskEmailConfig',
    name: 'Helpdesk Email Config',
    description: 'Helpdesk email settings — business hours, auto-close, and routing config',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
      { action: 'manage', label: 'Manage' },
    ],
  },
  {
    subject: 'CaseCsat',
    name: 'CSAT Ratings',
    description: 'Customer satisfaction ratings — view and report on helpdesk CSAT scores',
    category: 'PLATFORM',
    actions: [
      { action: 'read', label: 'View' },
    ],
  },
];
