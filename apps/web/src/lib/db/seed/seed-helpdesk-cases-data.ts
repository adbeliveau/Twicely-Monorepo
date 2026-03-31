/**
 * Helpdesk seed data — messages, events, macros, and CSAT ratings.
 * Extracted from seed-helpdesk-cases.ts to keep files under 300 lines.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { caseMessage, caseEvent, helpdeskMacro, caseCsat } from '../schema';
import { USER_IDS } from './seed-users';

const STAFF_AGENT_ID = 'seed-staff-agent-001';
const STAFF_AGENT_2_ID = 'seed-staff-agent-002';

function hoursAgo(h: number): Date { return new Date(Date.now() - h * 3600_000); }
function daysAgo(d: number): Date { return new Date(Date.now() - d * 86_400_000); }

/** Case IDs — shared between main seeder and data seeders. */
export const CASE_IDS = {
  orderIssue:       'seed-hd-case-001',
  returnRequest:    'seed-hd-case-002',
  billingIssue:     'seed-hd-case-003',
  accountLocked:    'seed-hd-case-004',
  dispute:          'seed-hd-case-005',
  shippingDelay:    'seed-hd-case-006',
  escalated:        'seed-hd-case-007',
  resolved:         'seed-hd-case-008',
  closed:           'seed-hd-case-009',
  criticalFraud:    'seed-hd-case-010',
  onHold:           'seed-hd-case-011',
  pendingInternal2: 'seed-hd-case-012',
  multiTag:         'seed-hd-case-013',
  csatGood:         'seed-hd-case-014',
  csatBad:          'seed-hd-case-015',
  chatSupport:      'seed-hd-case-016',
};

const MSG = {
  m01: 'seed-hd-msg-001', m02: 'seed-hd-msg-002', m03: 'seed-hd-msg-003',
  m04: 'seed-hd-msg-004', m05: 'seed-hd-msg-005', m06: 'seed-hd-msg-006',
  m07: 'seed-hd-msg-007', m08: 'seed-hd-msg-008', m09: 'seed-hd-msg-009',
  m10: 'seed-hd-msg-010', m11: 'seed-hd-msg-011', m12: 'seed-hd-msg-012',
  m13: 'seed-hd-msg-013', m14: 'seed-hd-msg-014', m15: 'seed-hd-msg-015',
  m16: 'seed-hd-msg-016', m17: 'seed-hd-msg-017', m18: 'seed-hd-msg-018',
  m19: 'seed-hd-msg-019', m20: 'seed-hd-msg-020',
  m21: 'seed-hd-msg-021', m22: 'seed-hd-msg-022', m23: 'seed-hd-msg-023',
  m24: 'seed-hd-msg-024', m25: 'seed-hd-msg-025', m26: 'seed-hd-msg-026',
  m27: 'seed-hd-msg-027', m28: 'seed-hd-msg-028', m29: 'seed-hd-msg-029',
  m30: 'seed-hd-msg-030',
};

const EVT = {
  e01: 'seed-hd-evt-001', e02: 'seed-hd-evt-002', e03: 'seed-hd-evt-003',
  e04: 'seed-hd-evt-004', e05: 'seed-hd-evt-005', e06: 'seed-hd-evt-006',
  e07: 'seed-hd-evt-007', e08: 'seed-hd-evt-008', e09: 'seed-hd-evt-009',
  e10: 'seed-hd-evt-010', e11: 'seed-hd-evt-011', e12: 'seed-hd-evt-012',
  e13: 'seed-hd-evt-013', e14: 'seed-hd-evt-014',
};

const MACRO_IDS = {
  greeting:     'seed-hd-macro-001',
  shipping:     'seed-hd-macro-002',
  refund:       'seed-hd-macro-003',
  escalate:     'seed-hd-macro-004',
  closing:      'seed-hd-macro-005',
  returnInfo:   'seed-hd-macro-006',
  returnPolicy: 'seed-hd-macro-007',
  accountHelp:  'seed-hd-macro-008',
};

const CSAT_IDS = {
  good: 'seed-hd-csat-001',
  bad:  'seed-hd-csat-002',
};

export async function seedMessages(db: PostgresJsDatabase): Promise<void> {
  await db.insert(caseMessage).values([
    // Case 1: order issue (3 messages)
    { id: MSG.m01, caseId: CASE_IDS.orderIssue, senderType: 'user', senderId: USER_IDS.buyer1, senderName: 'Emma Thompson', direction: 'INBOUND', body: 'Hi, my order was marked as delivered but I never received it. I checked with my neighbors and the mailroom. Tracking: 1Z9999W03023456784. Can you help?', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(6) },
    { id: MSG.m02, caseId: CASE_IDS.orderIssue, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Emma, I\'m sorry to hear about this. I\'ve opened an investigation with the carrier. In the meantime, could you confirm your delivery address? We\'ll get this sorted for you.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(3) },
    { id: MSG.m03, caseId: CASE_IDS.orderIssue, senderType: 'user', senderId: USER_IDS.buyer1, senderName: 'Emma Thompson', direction: 'INBOUND', body: 'Yes, the address is correct: 123 Main St, Apt 4B, New York, NY 10001. I\'ve been having issues with deliveries in my building lately.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(1) },
    // Case 2: return request (3 messages)
    { id: MSG.m04, caseId: CASE_IDS.returnRequest, senderType: 'user', senderId: USER_IDS.buyer2, senderName: 'Sarah Chen', direction: 'INBOUND', body: 'I received the vintage denim jacket but it has a large coffee stain on the back that was not visible in any of the listing photos. I want to return it.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(1) },
    { id: MSG.m05, caseId: CASE_IDS.returnRequest, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'OUTBOUND', body: 'Hi Sarah, thank you for reaching out. Could you please upload photos of the stain? This will help us process your return request and review the listing.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(20) },
    { id: MSG.m06, caseId: CASE_IDS.returnRequest, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'INTERNAL', body: 'Flagging this listing for review — seller has had 2 previous "not as described" complaints this month. May need to issue warning.', deliveryStatus: 'SENT', createdAt: hoursAgo(19) },
    // Case 3: billing (2 messages)
    { id: MSG.m07, caseId: CASE_IDS.billingIssue, senderType: 'user', senderId: USER_IDS.seller1, senderName: 'Michael Park', direction: 'INBOUND', body: 'I upgraded my store from Starter to Pro yesterday and was charged twice — once for $29.99 and again for $29.99. My card shows two transactions from Twicely.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(4) },
    { id: MSG.m08, caseId: CASE_IDS.billingIssue, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Michael, I can see the duplicate charge in our system. I\'ve initiated a refund for the second charge of $29.99. It should appear in 3-5 business days. I apologize for the inconvenience.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(2) },
    // Case 5: dispute (3 messages)
    { id: MSG.m09, caseId: CASE_IDS.dispute, senderType: 'system', senderName: 'System', direction: 'SYSTEM', body: 'Dispute case automatically created from buyer protection claim. Order: seed-order-003.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(1) },
    { id: MSG.m10, caseId: CASE_IDS.dispute, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'OUTBOUND', body: 'We\'re investigating your claim. The seller has been notified and has 48 hours to provide shipping evidence.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(20) },
    { id: MSG.m11, caseId: CASE_IDS.dispute, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'INTERNAL', body: 'Seller provided tracking that shows "In Transit" for 10 days. Carrier investigation needed. Holding for carrier response before ruling.', deliveryStatus: 'SENT', createdAt: hoursAgo(2) },
    // Case 7: chargeback escalated (2 messages)
    { id: MSG.m12, caseId: CASE_IDS.escalated, senderType: 'system', senderName: 'System', direction: 'SYSTEM', body: 'Chargeback received from Stripe for $247.00 on order #TWC-10008. Reason: "product_not_received". Evidence submission deadline: 2026-03-22.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(2) },
    { id: MSG.m13, caseId: CASE_IDS.escalated, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'INTERNAL', body: 'SLA breached. Escalating to management. Seller has proof of delivery (signed). Preparing evidence packet for Stripe dispute.', deliveryStatus: 'SENT', createdAt: hoursAgo(0.5) },
    // Case 8: resolved (3 messages)
    { id: MSG.m14, caseId: CASE_IDS.resolved, senderType: 'user', senderId: USER_IDS.seller3, senderName: 'Jessica Lee', direction: 'INBOUND', body: 'How do I connect my Poshmark account to the crosslister? I can\'t find the option in settings.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(3) },
    { id: MSG.m15, caseId: CASE_IDS.resolved, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Jessica! Go to My Hub > Crosslister > Connections. Click "Add Platform" and select Poshmark. You\'ll be prompted to authorize access.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(2) },
    { id: MSG.m16, caseId: CASE_IDS.resolved, senderType: 'user', senderId: USER_IDS.seller3, senderName: 'Jessica Lee', direction: 'INBOUND', body: 'Found it, thank you! That was really easy.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(1) },
    // Case 6: shipping delay (2 messages)
    { id: MSG.m17, caseId: CASE_IDS.shippingDelay, senderType: 'user', senderId: USER_IDS.buyer2, senderName: 'Sarah Chen', direction: 'INBOUND', body: 'I ordered 5 days ago and the seller still hasn\'t shipped. The listing said ships in 1-2 business days. What\'s going on?', deliveryStatus: 'DELIVERED', createdAt: daysAgo(2) },
    { id: MSG.m18, caseId: CASE_IDS.shippingDelay, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Sarah, I\'ve sent a reminder to the seller. If they don\'t ship within 24 hours, you\'ll be eligible for a full refund. I\'ll follow up.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(10) },
    // Case 10: fraud (2 messages)
    { id: MSG.m19, caseId: CASE_IDS.criticalFraud, senderType: 'system', senderName: 'System', direction: 'SYSTEM', body: 'Auto-flagged: seller seed-seller-003 received 12 "counterfeit" reports in the last 48 hours from unique buyers. Account under review.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(1) },
    { id: MSG.m20, caseId: CASE_IDS.criticalFraud, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'INTERNAL', body: 'Confirmed pattern of counterfeit luxury items. 8 out of 12 reports verified with photo evidence. Recommending account suspension pending full review.', deliveryStatus: 'SENT', createdAt: hoursAgo(1) },
    // New messages — cases 11-16
    { id: MSG.m21, caseId: CASE_IDS.onHold, senderType: 'user', senderId: USER_IDS.buyer1, senderName: 'Emma Thompson', direction: 'INBOUND', body: 'The shoes I received are size 9 but I ordered size 10. I need to exchange them.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(2) },
    { id: MSG.m22, caseId: CASE_IDS.onHold, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Emma, I\'ve put this on hold while we wait for the seller to respond. They have 48 hours to confirm a return. I\'ll update you as soon as I hear back.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(1) },
    { id: MSG.m23, caseId: CASE_IDS.pendingInternal2, senderType: 'system', senderName: 'System', direction: 'SYSTEM', body: 'Buyer protection claim filed: counterfeit luxury handbag. Authentication photo evidence attached.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(1) },
    { id: MSG.m24, caseId: CASE_IDS.pendingInternal2, senderType: 'agent', senderId: STAFF_AGENT_2_ID, senderName: 'Jane Doe', direction: 'INTERNAL', body: 'Reviewing authentication photos. Brand specialist consultation requested. Case pending expert review.', deliveryStatus: 'SENT', createdAt: hoursAgo(3) },
    { id: MSG.m25, caseId: CASE_IDS.multiTag, senderType: 'user', senderId: USER_IDS.seller2, senderName: 'Ryan Lopez', direction: 'INBOUND', body: 'I have multiple issues — my listings are not showing in search, my payout is stuck, and my identity verification keeps failing. Please help!', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(2) },
    { id: MSG.m26, caseId: CASE_IDS.multiTag, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Ryan, I can see all three issues. I\'m escalating the verification flag to our trust team and will address the listing visibility separately. I\'ll keep you updated.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(1) },
    { id: MSG.m27, caseId: CASE_IDS.csatGood, senderType: 'user', senderId: USER_IDS.seller3, senderName: 'Jessica Lee', direction: 'INBOUND', body: 'I would like to cancel my Pro subscription but keep selling on the free tier.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(5) },
    { id: MSG.m28, caseId: CASE_IDS.csatGood, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Jessica! Your Pro subscription has been cancelled effective at your billing date. You\'ll remain on the free NONE tier after that. You can always upgrade again anytime.', deliveryStatus: 'DELIVERED', createdAt: daysAgo(4) },
    { id: MSG.m29, caseId: CASE_IDS.chatSupport, senderType: 'user', senderId: USER_IDS.buyer3, senderName: 'Alex Kim', direction: 'INBOUND', body: 'I need to set up 2-factor authentication but the SMS codes are not arriving to my phone.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(0.5) },
    { id: MSG.m30, caseId: CASE_IDS.chatSupport, senderType: 'agent', senderId: STAFF_AGENT_ID, senderName: 'Agent Smith', direction: 'OUTBOUND', body: 'Hi Alex! Let\'s troubleshoot. First, can you confirm your phone number has the correct country code? Also try using the authenticator app option instead of SMS.', deliveryStatus: 'DELIVERED', createdAt: hoursAgo(0.3) },
  ]).onConflictDoNothing();
}

export async function seedEvents(db: PostgresJsDatabase): Promise<void> {
  await db.insert(caseEvent).values([
    { id: EVT.e01, caseId: CASE_IDS.orderIssue, eventType: 'created', actorType: 'user', actorId: USER_IDS.buyer1, dataJson: {}, createdAt: hoursAgo(6) },
    { id: EVT.e02, caseId: CASE_IDS.orderIssue, eventType: 'status_changed', actorType: 'system', dataJson: { from: 'NEW', to: 'OPEN' }, createdAt: hoursAgo(3) },
    { id: EVT.e03, caseId: CASE_IDS.returnRequest, eventType: 'created', actorType: 'user', actorId: USER_IDS.buyer2, dataJson: {}, createdAt: daysAgo(1) },
    { id: EVT.e04, caseId: CASE_IDS.returnRequest, eventType: 'status_changed', actorType: 'agent', actorId: STAFF_AGENT_2_ID, dataJson: { from: 'OPEN', to: 'PENDING_USER' }, createdAt: hoursAgo(20) },
    { id: EVT.e05, caseId: CASE_IDS.billingIssue, eventType: 'created', actorType: 'user', actorId: USER_IDS.seller1, dataJson: {}, createdAt: hoursAgo(4) },
    { id: EVT.e06, caseId: CASE_IDS.escalated, eventType: 'created', actorType: 'system', dataJson: { source: 'stripe_chargeback' }, createdAt: daysAgo(2) },
    { id: EVT.e07, caseId: CASE_IDS.escalated, eventType: 'status_changed', actorType: 'system', dataJson: { from: 'OPEN', to: 'ESCALATED', reason: 'SLA breach' }, createdAt: hoursAgo(1) },
    { id: EVT.e08, caseId: CASE_IDS.resolved, eventType: 'created', actorType: 'user', actorId: USER_IDS.seller3, dataJson: {}, createdAt: daysAgo(3) },
    { id: EVT.e09, caseId: CASE_IDS.resolved, eventType: 'status_changed', actorType: 'agent', actorId: STAFF_AGENT_ID, dataJson: { from: 'OPEN', to: 'RESOLVED' }, createdAt: daysAgo(1) },
    { id: EVT.e10, caseId: CASE_IDS.closed, eventType: 'created', actorType: 'user', actorId: USER_IDS.buyer3, dataJson: {}, createdAt: daysAgo(7) },
    { id: EVT.e11, caseId: CASE_IDS.closed, eventType: 'status_changed', actorType: 'system', dataJson: { from: 'RESOLVED', to: 'CLOSED', reason: 'Auto-closed after 72h' }, createdAt: daysAgo(4) },
    { id: EVT.e12, caseId: CASE_IDS.criticalFraud, eventType: 'created', actorType: 'system', dataJson: { source: 'auto-flag', reportCount: 12 }, createdAt: daysAgo(1) },
    { id: EVT.e13, caseId: CASE_IDS.onHold, eventType: 'status_changed', actorType: 'agent', actorId: STAFF_AGENT_ID, dataJson: { from: 'OPEN', to: 'ON_HOLD', reason: 'Awaiting seller response' }, createdAt: daysAgo(1) },
    { id: EVT.e14, caseId: CASE_IDS.csatGood, eventType: 'status_changed', actorType: 'agent', actorId: STAFF_AGENT_ID, dataJson: { from: 'OPEN', to: 'RESOLVED' }, createdAt: daysAgo(3) },
  ]).onConflictDoNothing();
}

export async function seedMacros(db: PostgresJsDatabase): Promise<void> {
  await db.insert(helpdeskMacro).values([
    { id: MACRO_IDS.greeting, name: 'Greeting', description: 'Standard greeting', bodyTemplate: 'Hi {{requester_name}}, thank you for reaching out to Twicely Support. I\'m happy to help you with this.\n\n', actionsJson: [], isShared: true, createdByStaffId: STAFF_AGENT_ID },
    { id: MACRO_IDS.shipping, name: 'Shipping Delay Notice', description: 'Notify about shipping delay', bodyTemplate: 'I\'ve reviewed your order and can see it hasn\'t shipped yet. I\'ve sent a reminder to the seller. If they don\'t ship within 24 hours, you\'ll be eligible for a full refund.', actionsJson: [{ type: 'ADD_TAGS', value: 'shipping-delay' }], isShared: true, createdByStaffId: STAFF_AGENT_ID },
    { id: MACRO_IDS.refund, name: 'Refund Initiated', description: 'Confirm refund processing', bodyTemplate: 'I\'ve initiated a refund of {{amount}} to your original payment method. Please allow 3-5 business days for it to appear. You\'ll receive a confirmation email shortly.', actionsJson: [], isShared: true, createdByStaffId: STAFF_AGENT_ID },
    { id: MACRO_IDS.escalate, name: 'Escalation Notice', description: 'Inform about escalation', bodyTemplate: 'I\'m escalating this to our specialized team for further review. They\'ll be in touch within {{sla_time}}. Your case number is {{case_number}} — please reference it in any future communication.', actionsJson: [{ type: 'SET_STATUS', value: 'ESCALATED' }], isShared: true, createdByStaffId: STAFF_AGENT_2_ID },
    { id: MACRO_IDS.closing, name: 'Closing Resolution', description: 'Close case with summary', bodyTemplate: 'Great news — this issue has been resolved! Here\'s a summary:\n\n{{resolution_summary}}\n\nIf you need anything else, feel free to reopen this case or create a new one. Thank you for using Twicely!', actionsJson: [{ type: 'SET_STATUS', value: 'RESOLVED' }], isShared: true, createdByStaffId: STAFF_AGENT_ID },
    { id: MACRO_IDS.returnInfo, name: 'Return Instructions', description: 'Send return shipping info', bodyTemplate: 'Your return has been approved. Here are the next steps:\n\n1. Pack the item securely in its original packaging\n2. Print the return label (sent to your email)\n3. Drop off at any USPS location\n4. Your refund will process within 48 hours of receiving the item\n\nReturn label: {{return_label_url}}', actionsJson: [{ type: 'ADD_TAGS', value: 'return-approved' }], isShared: true, createdByStaffId: STAFF_AGENT_2_ID },
    { id: MACRO_IDS.returnPolicy, name: 'Return Policy Explanation', description: 'Explain the return policy to buyers', bodyTemplate: 'Hi {{requester_name}}, I understand your frustration. Here\'s a quick summary of our return policy:\n\n\u2022 Returns are accepted within 30 days of delivery\n\u2022 Items must be in original condition\n\u2022 Buyer remorse returns may incur a small restocking fee\n\nI\'ll process your return request now. Please allow 3-5 business days for the refund.', actionsJson: [{ type: 'ADD_TAGS', value: 'return-policy' }], isShared: true, createdByStaffId: STAFF_AGENT_ID },
    { id: MACRO_IDS.accountHelp, name: 'Account Recovery Steps', description: 'Guide user through account recovery', bodyTemplate: 'Hi {{requester_name}}, let\'s get your account access restored:\n\n1. Go to twicely.co/auth/forgot-password\n2. Enter your registered email address\n3. Check your inbox (including spam)\n4. Click the reset link within 30 minutes\n\nIf you\'re still having trouble, reply here and I\'ll escalate to our security team.', actionsJson: [], isShared: true, createdByStaffId: STAFF_AGENT_2_ID },
  ]).onConflictDoNothing();
}

export async function seedCsat(db: PostgresJsDatabase): Promise<void> {
  await db.insert(caseCsat).values([
    {
      id: CSAT_IDS.good, caseId: CASE_IDS.csatGood, userId: USER_IDS.seller3,
      rating: 5, comment: 'Very helpful and quick response!',
      surveyRequestedAt: daysAgo(3), respondedAt: daysAgo(2),
    },
    {
      id: CSAT_IDS.bad, caseId: CASE_IDS.csatBad, userId: USER_IDS.buyer1,
      rating: 2, comment: 'Resolution took too long and the item was still damaged.',
      surveyRequestedAt: daysAgo(2), respondedAt: daysAgo(1),
    },
  ]).onConflictDoNothing();
}
