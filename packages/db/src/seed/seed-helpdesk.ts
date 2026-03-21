/**
 * G9.1 — Seed helpdesk teams, SLA policies, routing rules, automation rules, KB categories.
 * Idempotent via onConflictDoNothing.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  helpdeskTeam,
  helpdeskSlaPolicy,
  helpdeskRoutingRule,
  helpdeskAutomationRule,
  kbCategory,
} from '../schema';

const TEAM_IDS = {
  generalSupport: 'seed-hd-team-general',
  orderSupport: 'seed-hd-team-orders',
  trustSafety: 'seed-hd-team-trust',
  moderation: 'seed-hd-team-mod',
  escalations: 'seed-hd-team-escalations',
};

const SLA_IDS = {
  critical: 'seed-hd-sla-critical',
  urgent: 'seed-hd-sla-urgent',
  high: 'seed-hd-sla-high',
  normal: 'seed-hd-sla-normal',
  low: 'seed-hd-sla-low',
};

const ROUTING_IDS = {
  chargebacks: 'seed-hd-route-chargebacks',
  disputes: 'seed-hd-route-disputes',
  returns: 'seed-hd-route-returns',
  moderation: 'seed-hd-route-moderation',
  orderIssues: 'seed-hd-route-orders',
  account: 'seed-hd-route-account',
  billing: 'seed-hd-route-billing',
};

const AUTOMATION_IDS = {
  autoCloseStale: 'seed-hd-auto-close-stale',
  slaBreachCritical: 'seed-hd-auto-sla-critical',
  slaBreachUrgent: 'seed-hd-auto-sla-urgent',
  reopenNotify: 'seed-hd-auto-reopen',
  welcomeMessage: 'seed-hd-auto-welcome',
};

const KB_CAT_IDS = {
  ordersShipping: 'seed-kb-cat-orders-shipping',
  returnsRefunds: 'seed-kb-cat-returns-refunds',
  paymentsBilling: 'seed-kb-cat-payments-billing',
  buyerProtection: 'seed-kb-cat-buyer-protection',
  selling: 'seed-kb-cat-selling',
  crosslister: 'seed-kb-cat-crosslister',
  account: 'seed-kb-cat-account',
  policies: 'seed-kb-cat-policies',
};

export async function seedHelpdesk(db: PostgresJsDatabase): Promise<void> {
  // 1. Teams (5)
  await db.insert(helpdeskTeam).values([
    { id: TEAM_IDS.generalSupport, name: 'General Support', isDefault: true, maxConcurrentCases: 25 },
    { id: TEAM_IDS.orderSupport, name: 'Order Support', isDefault: false, maxConcurrentCases: 25 },
    { id: TEAM_IDS.trustSafety, name: 'Trust & Safety', isDefault: false, maxConcurrentCases: 15 },
    { id: TEAM_IDS.moderation, name: 'Moderation', isDefault: false, maxConcurrentCases: 20 },
    { id: TEAM_IDS.escalations, name: 'Escalations', isDefault: false, maxConcurrentCases: 10 },
  ]).onConflictDoNothing();

  // 2. SLA policies (5)
  await db.insert(helpdeskSlaPolicy).values([
    { id: SLA_IDS.critical, priority: 'CRITICAL', firstResponseMinutes: 60, resolutionMinutes: 240, businessHoursOnly: false, escalateOnBreach: true },
    { id: SLA_IDS.urgent, priority: 'URGENT', firstResponseMinutes: 120, resolutionMinutes: 480, businessHoursOnly: true, escalateOnBreach: true },
    { id: SLA_IDS.high, priority: 'HIGH', firstResponseMinutes: 240, resolutionMinutes: 1440, businessHoursOnly: true, escalateOnBreach: true },
    { id: SLA_IDS.normal, priority: 'NORMAL', firstResponseMinutes: 480, resolutionMinutes: 2880, businessHoursOnly: true, escalateOnBreach: false },
    { id: SLA_IDS.low, priority: 'LOW', firstResponseMinutes: 1440, resolutionMinutes: 4320, businessHoursOnly: true, escalateOnBreach: false },
  ]).onConflictDoNothing();

  // 3. Routing rules (7)
  await db.insert(helpdeskRoutingRule).values([
    {
      id: ROUTING_IDS.chargebacks,
      name: 'Chargebacks to Trust & Safety',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'CHARGEBACK' }],
      actionsJson: { assignTeamId: TEAM_IDS.trustSafety, setPriority: 'CRITICAL' },
      sortOrder: 1,
      isActive: true,
    },
    {
      id: ROUTING_IDS.disputes,
      name: 'Disputes to Trust & Safety',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'DISPUTE' }],
      actionsJson: { assignTeamId: TEAM_IDS.trustSafety, setPriority: 'URGENT' },
      sortOrder: 2,
      isActive: true,
    },
    {
      id: ROUTING_IDS.returns,
      name: 'Returns to Trust & Safety',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'RETURN' }],
      actionsJson: { assignTeamId: TEAM_IDS.trustSafety, setPriority: 'HIGH' },
      sortOrder: 3,
      isActive: true,
    },
    {
      id: ROUTING_IDS.moderation,
      name: 'Moderation to Moderation Team',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'MODERATION' }],
      actionsJson: { assignTeamId: TEAM_IDS.moderation },
      sortOrder: 4,
      isActive: true,
    },
    {
      id: ROUTING_IDS.orderIssues,
      name: 'Order Issues to Order Support',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'ORDER' }],
      actionsJson: { assignTeamId: TEAM_IDS.orderSupport },
      sortOrder: 5,
      isActive: true,
    },
    {
      id: ROUTING_IDS.account,
      name: 'Account Issues to General Support',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'ACCOUNT' }],
      actionsJson: { assignTeamId: TEAM_IDS.generalSupport },
      sortOrder: 6,
      isActive: true,
    },
    {
      id: ROUTING_IDS.billing,
      name: 'Billing to General Support',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'BILLING' }],
      actionsJson: { assignTeamId: TEAM_IDS.generalSupport },
      sortOrder: 7,
      isActive: true,
    },
  ]).onConflictDoNothing();

  // 4. Automation rules (5)
  await db.insert(helpdeskAutomationRule).values([
    {
      id: AUTOMATION_IDS.autoCloseStale,
      name: 'Auto-close stale pending user cases',
      triggerEvent: 'NO_RESPONSE',
      conditionsJson: [{ field: 'status', operator: 'eq', value: 'PENDING_USER' }, { field: 'daysSinceUpdate', operator: 'gte', value: 14 }],
      actionsJson: [{ type: 'SET_STATUS', value: 'CLOSED' }],
      sortOrder: 1,
      isActive: true,
    },
    {
      id: AUTOMATION_IDS.slaBreachCritical,
      name: 'SLA breach escalation (CRITICAL)',
      triggerEvent: 'SLA_BREACHED',
      conditionsJson: [{ field: 'priority', operator: 'eq', value: 'CRITICAL' }],
      actionsJson: [{ type: 'SET_STATUS', value: 'ESCALATED' }, { type: 'ASSIGN_TEAM', value: TEAM_IDS.escalations }],
      sortOrder: 2,
      isActive: true,
    },
    {
      id: AUTOMATION_IDS.slaBreachUrgent,
      name: 'SLA breach escalation (URGENT)',
      triggerEvent: 'SLA_BREACHED',
      conditionsJson: [{ field: 'priority', operator: 'eq', value: 'URGENT' }],
      actionsJson: [{ type: 'SET_STATUS', value: 'ESCALATED' }, { type: 'ASSIGN_TEAM', value: TEAM_IDS.escalations }],
      sortOrder: 3,
      isActive: true,
    },
    {
      id: AUTOMATION_IDS.reopenNotify,
      name: 'Notify agent on case reopen',
      triggerEvent: 'CASE_REOPENED',
      conditionsJson: [],
      actionsJson: [{ type: 'SEND_NOTIFICATION', value: 'helpdesk.case.reopened' }, { type: 'ADD_TAGS', value: 'reopened' }],
      sortOrder: 4,
      isActive: true,
    },
    {
      id: AUTOMATION_IDS.welcomeMessage,
      name: 'Reopen on user message to pending case',
      triggerEvent: 'MESSAGE_RECEIVED',
      conditionsJson: [{ field: 'status', operator: 'eq', value: 'PENDING_USER' }],
      actionsJson: [{ type: 'SET_STATUS', value: 'OPEN' }],
      sortOrder: 5,
      isActive: true,
    },
  ]).onConflictDoNothing();

  // 5. KB categories (8)
  await db.insert(kbCategory).values([
    { id: KB_CAT_IDS.ordersShipping, slug: 'orders-shipping', name: 'Orders & Shipping', icon: 'Package', sortOrder: 1, isActive: true },
    { id: KB_CAT_IDS.returnsRefunds, slug: 'returns-refunds', name: 'Returns & Refunds', icon: 'RefreshCw', sortOrder: 2, isActive: true },
    { id: KB_CAT_IDS.paymentsBilling, slug: 'payments-billing', name: 'Payments & Billing', icon: 'CreditCard', sortOrder: 3, isActive: true },
    { id: KB_CAT_IDS.buyerProtection, slug: 'buyer-protection', name: 'Buyer Protection', icon: 'Shield', sortOrder: 4, isActive: true },
    { id: KB_CAT_IDS.selling, slug: 'selling', name: 'Selling on Twicely', icon: 'Store', sortOrder: 5, isActive: true },
    { id: KB_CAT_IDS.crosslister, slug: 'crosslister', name: 'Crosslister', icon: 'Link2', sortOrder: 6, isActive: true },
    { id: KB_CAT_IDS.account, slug: 'account', name: 'Account & Settings', icon: 'User', sortOrder: 7, isActive: true },
    { id: KB_CAT_IDS.policies, slug: 'policies', name: 'Policies', icon: 'FileText', sortOrder: 8, isActive: true },
  ]).onConflictDoNothing();
}

export const HELPDESK_SEED_IDS = {
  teams: TEAM_IDS,
  sla: SLA_IDS,
  routing: ROUTING_IDS,
  automation: AUTOMATION_IDS,
  kbCategories: KB_CAT_IDS,
};
