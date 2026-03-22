/**
 * System role default permissions for the admin UI.
 * Derived from platform-abilities.ts CASL rules.
 * Used by /roles/system/[code] to show the read-only toggle grid.
 */

import type { PlatformRole } from '@twicely/casl/types';

export interface SystemRoleDefinition {
  code: PlatformRole;
  displayName: string;
  description: string;
  isLocked: boolean;
  /** Permission pairs this role grants — or 'wildcard' for SUPER_ADMIN/ADMIN */
  permissions: Array<{ subject: string; action: string }> | 'wildcard';
}

export const SYSTEM_ROLE_DEFINITIONS: Record<string, SystemRoleDefinition> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full platform access. Bypasses all permission checks via wildcard.',
    isLocked: true,
    permissions: 'wildcard',
  },
  ADMIN: {
    code: 'ADMIN',
    displayName: 'Platform Admin',
    description: 'Manages users, listings, orders, disputes, and most platform operations.',
    isLocked: false,
    permissions: 'wildcard',
  },
  SUPPORT: {
    code: 'SUPPORT',
    displayName: 'Support Agent',
    description: 'Handles customer inquiries, order issues, and dispute management.',
    isLocked: false,
    permissions: [
      { subject: 'User', action: 'read' },
      { subject: 'Order', action: 'read' },
      { subject: 'Listing', action: 'read' },
      { subject: 'Return', action: 'read' },
      { subject: 'Return', action: 'create' },
      { subject: 'Dispute', action: 'read' },
      { subject: 'Payout', action: 'read' },
      { subject: 'AuditEvent', action: 'read' },
    ],
  },
  MODERATION: {
    code: 'MODERATION',
    displayName: 'Content Moderator',
    description: 'Reviews flagged content, moderates listings and reviews.',
    isLocked: false,
    permissions: [
      { subject: 'User', action: 'read' },
      { subject: 'Listing', action: 'read' },
      { subject: 'Listing', action: 'update' },
      { subject: 'Review', action: 'read' },
      { subject: 'Review', action: 'update' },
      { subject: 'Message', action: 'read' },
      { subject: 'SellerProfile', action: 'update' },
      { subject: 'AuditEvent', action: 'read' },
    ],
  },
  FINANCE: {
    code: 'FINANCE',
    displayName: 'Finance Admin',
    description: 'Manages financial reports, payouts, holds, and reconciliation.',
    isLocked: false,
    permissions: [
      { subject: 'User', action: 'read' },
      { subject: 'Order', action: 'read' },
      { subject: 'Payout', action: 'read' },
      { subject: 'Payout', action: 'update' },
      { subject: 'LedgerEntry', action: 'read' },
      { subject: 'AuditEvent', action: 'read' },
    ],
  },
  DEVELOPER: {
    code: 'DEVELOPER',
    displayName: 'Developer',
    description: 'Access to technical tools, feature flags, and system diagnostics.',
    isLocked: false,
    permissions: [
      { subject: 'FeatureFlag', action: 'read' },
      { subject: 'FeatureFlag', action: 'update' },
      { subject: 'AuditEvent', action: 'read' },
      { subject: 'HealthCheck', action: 'read' },
    ],
  },
  SRE: {
    code: 'SRE',
    displayName: 'Site Reliability Engineer',
    description: 'Monitors system health, diagnostics, and operational settings.',
    isLocked: false,
    permissions: [
      { subject: 'HealthCheck', action: 'read' },
      { subject: 'AuditEvent', action: 'read' },
    ],
  },
  HELPDESK_AGENT: {
    code: 'HELPDESK_AGENT',
    displayName: 'Helpdesk Agent',
    description: 'Customer service representative — handles cases, replies, resolves.',
    isLocked: false,
    permissions: [
      { subject: 'HelpdeskCase', action: 'read' },
      { subject: 'HelpdeskCase', action: 'create' },
      { subject: 'HelpdeskCase', action: 'update' },
      { subject: 'User', action: 'read' },
      { subject: 'Order', action: 'read' },
      { subject: 'Listing', action: 'read' },
      { subject: 'Return', action: 'read' },
      { subject: 'Dispute', action: 'read' },
    ],
  },
  HELPDESK_LEAD: {
    code: 'HELPDESK_LEAD',
    displayName: 'Helpdesk Lead',
    description: 'Senior agent — manages macros, views, assigns cases, views reports.',
    isLocked: false,
    permissions: [
      { subject: 'HelpdeskCase', action: 'read' },
      { subject: 'HelpdeskCase', action: 'create' },
      { subject: 'HelpdeskCase', action: 'update' },
      { subject: 'HelpdeskCase', action: 'delete' },
      { subject: 'User', action: 'read' },
      { subject: 'Order', action: 'read' },
      { subject: 'Listing', action: 'read' },
      { subject: 'Return', action: 'read' },
      { subject: 'Dispute', action: 'read' },
    ],
  },
  HELPDESK_MANAGER: {
    code: 'HELPDESK_MANAGER',
    displayName: 'Helpdesk Manager',
    description: 'Manages teams, routing, SLA, automation — full helpdesk operations.',
    isLocked: false,
    permissions: [
      { subject: 'HelpdeskCase', action: 'read' },
      { subject: 'HelpdeskCase', action: 'create' },
      { subject: 'HelpdeskCase', action: 'update' },
      { subject: 'HelpdeskCase', action: 'delete' },
      { subject: 'User', action: 'read' },
      { subject: 'Order', action: 'read' },
      { subject: 'Listing', action: 'read' },
      { subject: 'Return', action: 'read' },
      { subject: 'Dispute', action: 'read' },
    ],
  },
};

/** Get a system role definition by code, or undefined if not a system role. */
export function getSystemRoleDefinition(code: string): SystemRoleDefinition | undefined {
  return SYSTEM_ROLE_DEFINITIONS[code];
}
