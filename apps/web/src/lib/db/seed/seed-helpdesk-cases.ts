/**
 * G9 / G9.7 — Seed helpdesk cases, messages, events, macros, CSAT, sequenceCounter.
 * Expanded from 10 to 16 cases covering all 9 case types and all 4 channels.
 * Idempotent via onConflictDoNothing.
 *
 * Sub-seeders (messages, events, macros, CSAT) extracted to seed-helpdesk-cases-data.ts.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { helpdeskCase, sequenceCounter } from '@twicely/db/schema';
import { USER_IDS } from './seed-users';
import { HELPDESK_SEED_IDS } from './seed-helpdesk';
import { sql } from 'drizzle-orm';
import {
  CASE_IDS,
  seedMessages,
  seedEvents,
  seedMacros,
  seedCsat,
} from './seed-helpdesk-cases-data';

const STAFF_AGENT_ID = 'seed-staff-agent-001';
const STAFF_AGENT_2_ID = 'seed-staff-agent-002';

function hoursAgo(h: number): Date { return new Date(Date.now() - h * 3600_000); }
function daysAgo(d: number): Date { return new Date(Date.now() - d * 86_400_000); }
function hoursFromNow(h: number): Date { return new Date(Date.now() + h * 3600_000); }

export async function seedHelpdeskCases(db: PostgresJsDatabase): Promise<void> {
  // ── 1. Cases (16) ──────────────────────────────────────────────────────────
  await db.insert(helpdeskCase).values([
    // Original 10 cases
    {
      id: CASE_IDS.orderIssue, caseNumber: 'HD-000101', type: 'ORDER', channel: 'WEB',
      subject: 'Order not received — tracking shows delivered',
      description: 'Package marked delivered but I never got it. Checked with neighbors and mailroom.',
      status: 'OPEN', priority: 'HIGH', requesterId: USER_IDS.buyer1,
      requesterEmail: 'buyer1@demo.twicely.co', requesterType: 'buyer',
      assignedTeamId: HELPDESK_SEED_IDS.teams.orderSupport, assignedAgentId: STAFF_AGENT_ID,
      orderId: 'seed-order-001', tags: ['missing-package', 'delivery-issue'],
      slaFirstResponseDueAt: hoursAgo(2), slaResolutionDueAt: hoursFromNow(20),
      slaFirstResponseBreached: false, firstResponseAt: hoursAgo(3),
      lastActivityAt: hoursAgo(1), createdAt: hoursAgo(6), updatedAt: hoursAgo(1),
    },
    {
      id: CASE_IDS.returnRequest, caseNumber: 'HD-000102', type: 'RETURN', channel: 'WEB',
      subject: 'Item not as described — requesting return',
      description: 'The vintage jacket has a large stain that was not shown in the listing photos.',
      status: 'PENDING_USER', priority: 'NORMAL', requesterId: USER_IDS.buyer2,
      requesterEmail: 'buyer2@demo.twicely.co', requesterType: 'buyer',
      assignedTeamId: HELPDESK_SEED_IDS.teams.trustSafety, assignedAgentId: STAFF_AGENT_2_ID,
      tags: ['return', 'not-as-described'],
      slaFirstResponseDueAt: hoursAgo(1), slaResolutionDueAt: hoursFromNow(40),
      slaFirstResponseBreached: false, firstResponseAt: hoursAgo(4),
      lastActivityAt: hoursAgo(3), createdAt: daysAgo(1), updatedAt: hoursAgo(3),
    },
    {
      id: CASE_IDS.billingIssue, caseNumber: 'HD-000103', type: 'BILLING', channel: 'EMAIL',
      subject: 'Double charged for subscription upgrade',
      status: 'OPEN', priority: 'URGENT', requesterId: USER_IDS.seller1,
      requesterEmail: 'seller1@demo.twicely.co', requesterType: 'seller',
      assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport, assignedAgentId: STAFF_AGENT_ID,
      tags: ['billing', 'subscription', 'double-charge'],
      slaFirstResponseDueAt: hoursAgo(1), slaResolutionDueAt: hoursFromNow(6),
      slaFirstResponseBreached: false, firstResponseAt: hoursAgo(2),
      lastActivityAt: hoursAgo(0.5), createdAt: hoursAgo(4), updatedAt: hoursAgo(0.5),
    },
    {
      id: CASE_IDS.accountLocked, caseNumber: 'HD-000104', type: 'ACCOUNT', channel: 'WEB',
      subject: 'Account locked after password reset',
      status: 'NEW', priority: 'NORMAL', requesterId: USER_IDS.buyer3,
      requesterEmail: 'buyer3@demo.twicely.co', requesterType: 'buyer',
      assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport,
      tags: ['account', 'locked'],
      slaFirstResponseDueAt: hoursFromNow(7), slaResolutionDueAt: hoursFromNow(47),
      lastActivityAt: hoursAgo(0.2), createdAt: hoursAgo(0.2), updatedAt: hoursAgo(0.2),
    },
    {
      id: CASE_IDS.dispute, caseNumber: 'HD-000105', type: 'DISPUTE', channel: 'SYSTEM',
      subject: 'Buyer filed item not received dispute',
      status: 'PENDING_INTERNAL', priority: 'URGENT', requesterId: USER_IDS.buyer1,
      requesterType: 'buyer', assignedTeamId: HELPDESK_SEED_IDS.teams.trustSafety,
      assignedAgentId: STAFF_AGENT_2_ID, orderId: 'seed-order-003',
      disputeCaseId: 'seed-dispute-001', tags: ['dispute', 'item-not-received'],
      slaFirstResponseDueAt: hoursAgo(3), slaResolutionDueAt: hoursFromNow(4),
      slaFirstResponseBreached: false, firstResponseAt: hoursAgo(5),
      lastActivityAt: hoursAgo(2), createdAt: daysAgo(1), updatedAt: hoursAgo(2),
    },
    {
      id: CASE_IDS.shippingDelay, caseNumber: 'HD-000106', type: 'ORDER', channel: 'WEB',
      subject: 'Seller has not shipped after 5 days',
      status: 'OPEN', priority: 'NORMAL', requesterId: USER_IDS.buyer2,
      requesterType: 'buyer', assignedTeamId: HELPDESK_SEED_IDS.teams.orderSupport,
      assignedAgentId: STAFF_AGENT_ID, orderId: 'seed-order-005',
      tags: ['shipping-delay'], slaResolutionDueAt: hoursFromNow(30),
      firstResponseAt: hoursAgo(10),
      lastActivityAt: hoursAgo(5), createdAt: daysAgo(2), updatedAt: hoursAgo(5),
    },
    {
      id: CASE_IDS.escalated, caseNumber: 'HD-000107', type: 'CHARGEBACK', channel: 'SYSTEM',
      subject: 'Chargeback on order #TWC-10008 — $247.00',
      status: 'ESCALATED', priority: 'CRITICAL', requesterId: USER_IDS.seller2,
      requesterType: 'seller', assignedTeamId: HELPDESK_SEED_IDS.teams.escalations,
      assignedAgentId: STAFF_AGENT_2_ID, orderId: 'seed-order-008',
      tags: ['chargeback', 'urgent'], slaFirstResponseDueAt: hoursAgo(4),
      slaResolutionDueAt: hoursAgo(1), slaResolutionBreached: true,
      firstResponseAt: hoursAgo(5),
      lastActivityAt: hoursAgo(0.5), createdAt: daysAgo(2), updatedAt: hoursAgo(0.5),
    },
    {
      id: CASE_IDS.resolved, caseNumber: 'HD-000108', type: 'SUPPORT', channel: 'EMAIL',
      subject: 'How do I enable crosslister?',
      status: 'RESOLVED', priority: 'LOW', requesterId: USER_IDS.seller3,
      requesterEmail: 'seller3@demo.twicely.co', requesterType: 'seller',
      assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport, assignedAgentId: STAFF_AGENT_ID,
      tags: ['crosslister', 'how-to'], firstResponseAt: daysAgo(2),
      resolvedAt: daysAgo(1), slaFirstResponseBreached: false,
      lastActivityAt: daysAgo(1), createdAt: daysAgo(3), updatedAt: daysAgo(1),
    },
    {
      id: CASE_IDS.closed, caseNumber: 'HD-000109', type: 'ACCOUNT', channel: 'WEB',
      subject: 'Update my email address',
      status: 'CLOSED', priority: 'LOW', requesterId: USER_IDS.buyer3,
      requesterType: 'buyer', assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport,
      tags: ['account', 'email-change'], firstResponseAt: daysAgo(6),
      resolvedAt: daysAgo(5), closedAt: daysAgo(4),
      lastActivityAt: daysAgo(4), createdAt: daysAgo(7), updatedAt: daysAgo(4),
    },
    {
      id: CASE_IDS.criticalFraud, caseNumber: 'HD-000110', type: 'MODERATION', channel: 'INTERNAL',
      subject: 'Suspected fraudulent seller — 12 reports in 48h',
      status: 'ESCALATED', priority: 'CRITICAL', requesterId: USER_IDS.seller1,
      requesterType: 'seller', assignedTeamId: HELPDESK_SEED_IDS.teams.trustSafety,
      assignedAgentId: STAFF_AGENT_2_ID, sellerId: USER_IDS.seller3,
      tags: ['fraud', 'moderation', 'critical'],
      slaFirstResponseDueAt: hoursAgo(5), slaResolutionDueAt: hoursAgo(2),
      slaResolutionBreached: true, firstResponseAt: hoursAgo(6),
      lastActivityAt: hoursAgo(1), createdAt: daysAgo(1), updatedAt: hoursAgo(1),
    },
    // New 6 cases — G9.7
    {
      id: CASE_IDS.onHold, caseNumber: 'HD-000111', type: 'RETURN', channel: 'EMAIL',
      subject: 'Return request pending seller response',
      description: 'Buyer wants to return shoes — wrong size delivered.',
      status: 'ON_HOLD', priority: 'NORMAL', requesterId: USER_IDS.buyer1,
      requesterEmail: 'buyer1@demo.twicely.co', requesterType: 'buyer',
      assignedTeamId: HELPDESK_SEED_IDS.teams.orderSupport, assignedAgentId: STAFF_AGENT_ID,
      tags: ['return', 'on-hold', 'size-issue'],
      slaFirstResponseDueAt: hoursAgo(1), slaResolutionDueAt: hoursFromNow(24),
      slaFirstResponseBreached: false, firstResponseAt: hoursAgo(2),
      lastActivityAt: hoursAgo(4), createdAt: daysAgo(2), updatedAt: hoursAgo(4),
    },
    {
      id: CASE_IDS.pendingInternal2, caseNumber: 'HD-000112', type: 'DISPUTE', channel: 'SYSTEM',
      subject: 'Counterfeit item claim — review in progress',
      status: 'PENDING_INTERNAL', priority: 'HIGH', requesterId: USER_IDS.buyer2,
      requesterType: 'buyer', assignedTeamId: HELPDESK_SEED_IDS.teams.trustSafety,
      assignedAgentId: STAFF_AGENT_2_ID, orderId: 'seed-order-007',
      disputeCaseId: 'seed-dispute-002', tags: ['counterfeit', 'dispute', 'review'],
      slaFirstResponseDueAt: hoursAgo(2), slaResolutionDueAt: hoursFromNow(12),
      slaFirstResponseBreached: false, firstResponseAt: hoursAgo(4),
      lastActivityAt: hoursAgo(1), createdAt: daysAgo(1), updatedAt: hoursAgo(1),
    },
    {
      id: CASE_IDS.multiTag, caseNumber: 'HD-000113', type: 'SUPPORT', channel: 'WEB',
      subject: 'Multiple issues with my seller account',
      description: 'Having trouble with listings, payouts, and verification.',
      status: 'OPEN', priority: 'HIGH', requesterId: USER_IDS.seller2,
      requesterEmail: 'seller2@demo.twicely.co', requesterType: 'seller',
      assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport, assignedAgentId: STAFF_AGENT_ID,
      orderId: 'seed-order-009', listingId: 'seed-listing-001',
      tags: ['listings', 'payout', 'verification', 'seller-account', 'urgent-review'],
      slaFirstResponseDueAt: hoursFromNow(2), slaResolutionDueAt: hoursFromNow(26),
      firstResponseAt: hoursAgo(0.5),
      lastActivityAt: hoursAgo(0.5), createdAt: hoursAgo(2), updatedAt: hoursAgo(0.5),
    },
    {
      id: CASE_IDS.csatGood, caseNumber: 'HD-000114', type: 'BILLING', channel: 'EMAIL',
      subject: 'Subscription cancellation confirmed',
      status: 'RESOLVED', priority: 'LOW', requesterId: USER_IDS.seller3,
      requesterEmail: 'seller3@demo.twicely.co', requesterType: 'seller',
      assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport, assignedAgentId: STAFF_AGENT_ID,
      tags: ['billing', 'cancellation'], firstResponseAt: daysAgo(4),
      resolvedAt: daysAgo(3),
      lastActivityAt: daysAgo(3), createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
    {
      id: CASE_IDS.csatBad, caseNumber: 'HD-000115', type: 'ORDER', channel: 'WEB',
      subject: 'Late delivery — item arrived damaged',
      status: 'RESOLVED', priority: 'HIGH', requesterId: USER_IDS.buyer1,
      requesterEmail: 'buyer1@demo.twicely.co', requesterType: 'buyer',
      assignedTeamId: HELPDESK_SEED_IDS.teams.orderSupport, assignedAgentId: STAFF_AGENT_2_ID,
      orderId: 'seed-order-010', tags: ['shipping', 'damage', 'late-delivery'],
      firstResponseAt: daysAgo(5),
      resolvedAt: daysAgo(2),
      lastActivityAt: daysAgo(2), createdAt: daysAgo(6), updatedAt: daysAgo(2),
    },
    {
      id: CASE_IDS.chatSupport, caseNumber: 'HD-000116', type: 'ACCOUNT', channel: 'WEB',
      subject: 'Can not verify phone number for 2FA',
      description: 'SMS verification code is not arriving.',
      status: 'OPEN', priority: 'NORMAL', requesterId: USER_IDS.buyer3,
      requesterEmail: 'buyer3@demo.twicely.co', requesterType: 'buyer',
      assignedTeamId: HELPDESK_SEED_IDS.teams.generalSupport, assignedAgentId: STAFF_AGENT_ID,
      tags: ['account', '2fa', 'verification'],
      slaFirstResponseDueAt: hoursFromNow(4), slaResolutionDueAt: hoursFromNow(28),
      firstResponseAt: hoursAgo(0.3),
      lastActivityAt: hoursAgo(0.1), createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1),
    },
  ]).onConflictDoNothing();

  // ── 2. Messages ───────────────────────────────────────────────────────────
  await seedMessages(db);

  // ── 3. Events ─────────────────────────────────────────────────────────────
  await seedEvents(db);

  // ── 4. Macros ─────────────────────────────────────────────────────────────
  await seedMacros(db);

  // ── 5. CSAT ratings (2) ───────────────────────────────────────────────────
  await seedCsat(db);

  // ── 6. Sequence counter ───────────────────────────────────────────────────
  await db.insert(sequenceCounter).values({
    id: 'seed-sc-case-number',
    name: 'case_number',
    prefix: 'HD-',
    currentValue: 200,
    paddedWidth: 6,
  }).onConflictDoNothing();

  // ── 7. Seed agent signature ────────────────────────────────────────────────
  await db.execute(
    sql`UPDATE staff_user SET signature_html = 'Best regards,\nAgent Smith\nTwicely Support Team' WHERE id = ${STAFF_AGENT_ID}`
  );
}

export { CASE_IDS as HELPDESK_CASE_IDS } from './seed-helpdesk-cases-data';
