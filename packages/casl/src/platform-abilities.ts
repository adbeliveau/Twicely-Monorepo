import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, PlatformRole } from './types';

/**
 * Define abilities for platform agents (non-admin staff roles)
 * Per Actors & Security Canonical Section 3.5
 */
export function definePlatformAgentAbilities(
  builder: AbilityBuilder<AppAbility>,
  roles: PlatformRole[]
): void {
  const { can } = builder;

  const isHelpdeskRole =
    roles.includes('HELPDESK_AGENT') ||
    roles.includes('HELPDESK_LEAD') ||
    roles.includes('HELPDESK_MANAGER');

  if (isHelpdeskRole) {
    can('manage', 'HelpdeskCase');
    can('read', 'User');
    can('read', 'Order');
    can('read', 'Listing');
    can('read', 'Return');
    can('read', 'Dispute');
    // All helpdesk roles can read KB and macros
    can('read', 'KbArticle');
    can('read', 'KbCategory');
    can('read', 'HelpdeskTeam');
    can('read', 'HelpdeskMacro');
    can('read', 'HelpdeskSavedView');
    // All helpdesk roles can create and delete their own saved views
    // (action-level ownership check ensures deletion is scoped to own views)
    can('create', 'HelpdeskSavedView');
    can('delete', 'HelpdeskSavedView');
    can('manage', 'CaseCsat');
    // All helpdesk roles can update their own team member availability status
    can('update', 'HelpdeskTeamMember');
  }

  if (roles.includes('HELPDESK_LEAD') || roles.includes('HELPDESK_MANAGER')) {
    // Lead+ can manage macros and KB content
    can('manage', 'HelpdeskMacro');
    can('manage', 'KbArticle');
    can('manage', 'KbCategory');
  }

  if (roles.includes('HELPDESK_MANAGER')) {
    // Manager can manage teams, routing, SLA, automation, email config
    can('manage', 'HelpdeskTeam');
    can('manage', 'HelpdeskRoutingRule');
    can('manage', 'HelpdeskSlaPolicy');
    can('manage', 'HelpdeskAutomationRule');
    can('manage', 'HelpdeskEmailConfig');
    can('manage', 'HelpdeskSavedView');
  }

  if (roles.includes('SUPPORT')) {
    can('read', 'User');
    can('read', 'Order');
    can('read', 'Listing');
    can('read', 'Return');
    can('read', 'Dispute');
    can('read', 'Payout');
    can('read', 'AuditEvent');
    can('read', 'SecurityEvent');
    // I7 — Trust & Safety — Support can view trust context during disputes
    can('read', 'TrustSafety');
    can('create', 'Return');
    can('read', 'CombinedShippingQuote');
    can('manage', 'CombinedShippingQuote');
    can('read', 'LocalTransaction');
    can('manage', 'LocalTransaction');
    can('read', 'SafeMeetupLocation');
    can('manage', 'SafeMeetupLocation');
    can('manage', 'LocalReliabilityEvent');
    // G4 — Enforcement context reads for support
    can('read', 'ContentReport');
    can('read', 'EnforcementAction');
    // G6 — Support can read verification status for support context
    can('read', 'IdentityVerification');
    can('read', 'DataRetention');
    // SEC-009: Impersonation restricted to ADMIN/SUPER_ADMIN only (not SUPPORT)
  }

  if (roles.includes('MODERATION')) {
    // I7 — Trust & Safety — MODERATION can view trust scores and seller trust profiles
    can('read', 'TrustSafety');
    can('read', 'User');
    can('read', 'Listing');
    can('read', 'Review');
    can('read', 'Message');
    can('read', 'Conversation');
    can('read', 'AuditEvent');
    can('read', 'SecurityEvent');
    can('update', 'Listing');
    can('update', 'SellerProfile');
    can('update', 'Review');
    // G2.15 — Fraud flags
    can('read', 'LocalFraudFlag');
    can('manage', 'LocalFraudFlag');
    // G3.10 — Curation tools
    can('manage', 'CuratedCollection');
    // G4 — Enforcement
    can('read', 'ContentReport');
    can('update', 'ContentReport');
    can('read', 'EnforcementAction');
    can('create', 'EnforcementAction');
    can('update', 'EnforcementAction');
    // I1 — Category tree visibility (nav shows /categories for MODERATION)
    can('read', 'Category');
    // I9 — admin can review abusive seller promotions
    can('read', 'Promotion');
  }

  if (roles.includes('FINANCE')) {
    can('read', 'Order');
    can('read', 'Payout');
    can('read', 'LedgerEntry');
    can('read', 'AuditEvent');
    can('read', 'User');
    can('update', 'Payout');
    can('read', 'Analytics');
    can('read', 'Expense');
    can('read', 'FinancialReport');
    can('read', 'MileageEntry');
    // I3 — Chargebacks and Reserve Holds (per permission-registry-data-domains.ts §FINANCE)
    can('read', 'Chargeback');
    can('read', 'Hold');
    // Affiliate finance management — G1.2
    can('manage', 'Affiliate');
    can('manage', 'AffiliatePayout');
    // Promo code management — G1.5
    can('manage', 'PromoCode');
    // I9 — FINANCE can read seller promotions for context
    can('read', 'Promotion');
    // Tax info — FINANCE can read (masked) for compliance — G5
    can('read', 'TaxInfo');
    // G6 — Finance can read verification status (for payout decisions)
    can('read', 'IdentityVerification');
    can('read', 'DataRetention');
    // Accounting integrations — G10.3 (staff can view, manage for any user)
    can(['read'], 'AccountingIntegration');
  }

  if (roles.includes('DEVELOPER')) {
    can('read', 'FeatureFlag');
    can('read', 'AuditEvent');
    can('read', 'HealthCheck');
    can('update', 'FeatureFlag');
    can('read', 'ProviderAdapter');
    can('read', 'ProviderInstance');
    can('read', 'ProviderHealthLog');
  }

  if (roles.includes('SRE')) {
    can('read', 'HealthCheck');
    can('read', 'AuditEvent');
    can('read', 'SecurityEvent');
    can('manage', 'HealthCheck');
  }
}

/**
 * Define abilities for platform admins (ADMIN, SUPER_ADMIN)
 * Per Actors & Security Canonical Section 3.6
 */
export function definePlatformAdminAbilities(
  builder: AbilityBuilder<AppAbility>
): void {
  const { can, cannot } = builder;

  can('manage', 'all');
  // Ledger entries are immutable — no delete or update
  cannot('delete', 'LedgerEntry');
  cannot('delete', 'AuditEvent');
  cannot('update', 'LedgerEntry');
}
