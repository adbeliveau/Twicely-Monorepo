/**
 * C4.3 — Dispute Escalation
 *
 * When buyer and seller can't resolve, buyer escalates to platform.
 *
 * State machine:
 * OPEN → UNDER_REVIEW → RESOLVED_BUYER (refund) | RESOLVED_SELLER (no refund)
 * OPEN → UNDER_REVIEW → RESOLVED_PARTIAL (partial refund)
 * RESOLVED_* → APPEALED → APPEAL_RESOLVED → CLOSED
 *
 * Rules:
 * - Buyer can escalate if: return was declined, or seller didn't respond in 3 days
 * - Platform reviews evidence from both sides
 * - Resolution updates seller score (INAD count)
 * - Admin assignment prevents multiple agents on same case
 */

import { db } from '@twicely/db';
import { dispute, returnRequest, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// Re-export query and admin functions (extracted to dispute-queries.ts)
export {
  getOpenDisputes,
  getAssignedDisputes,
  getDisputeById,
  assignDispute,
  resolveDispute,
  type AssignDisputeResult,
  type DisputeResolution,
  type ResolveDisputeInput,
  type ResolveDisputeResult,
} from './dispute-queries';

// Dispute claim types
type ClaimType = 'INR' | 'INAD' | 'DAMAGED' | 'COUNTERFEIT' | 'REMORSE';

export interface EscalateToDisputeInput {
  buyerId: string;
  returnId: string;
  description: string;
  evidencePhotos?: string[];
}

export interface EscalateResult {
  success: boolean;
  disputeId?: string;
  error?: string;
}

/**
 * Check if a return can be escalated to dispute.
 * Allowed if: declined, or seller didn't respond within deadline.
 */
export async function canEscalate(returnId: string): Promise<{ canEscalate: boolean; reason?: string }> {
  const [req] = await db
    .select({
      status: returnRequest.status,
      sellerResponseDueAt: returnRequest.sellerResponseDueAt,
      sellerRespondedAt: returnRequest.sellerRespondedAt,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { canEscalate: false, reason: 'Return request not found' };
  }

  if (req.status === 'ESCALATED') {
    return { canEscalate: false, reason: 'This return has already been escalated' };
  }

  if (req.status === 'DECLINED') {
    return { canEscalate: true };
  }

  if (req.status === 'PENDING_SELLER' && req.sellerResponseDueAt) {
    if (new Date() > req.sellerResponseDueAt) {
      return { canEscalate: true };
    }
  }

  if (req.status === 'CONDITION_DISPUTE') {
    return { canEscalate: true };
  }

  return { canEscalate: false, reason: 'This return cannot be escalated at this time' };
}

/**
 * Escalate a return to a platform dispute.
 */
export async function escalateToDispute(
  input: EscalateToDisputeInput
): Promise<EscalateResult> {
  const { buyerId, returnId, description, evidencePhotos = [] } = input;

  const [req] = await db
    .select({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      buyerId: returnRequest.buyerId,
      sellerId: returnRequest.sellerId,
      reason: returnRequest.reason,
      status: returnRequest.status,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  if (req.buyerId !== buyerId) {
    return { success: false, error: 'You do not own this return request' };
  }

  const escalateCheck = await canEscalate(returnId);
  if (!escalateCheck.canEscalate) {
    return { success: false, error: escalateCheck.reason };
  }

  const [existingDispute] = await db
    .select({ id: dispute.id })
    .from(dispute)
    .where(eq(dispute.returnRequestId, returnId))
    .limit(1);

  if (existingDispute) {
    return { success: false, error: 'A dispute already exists for this return' };
  }

  const claimType = mapReasonToClaimType(req.reason);
  const now = new Date();
  const reviewDeadlineHours = await getPlatformSetting<number>('commerce.dispute.reviewDeadlineHours', 48);

  const [created] = await db
    .insert(dispute)
    .values({
      orderId: req.orderId,
      buyerId: req.buyerId,
      sellerId: req.sellerId,
      returnRequestId: returnId,
      claimType,
      status: 'OPEN',
      description,
      evidencePhotos,
      deadlineAt: new Date(now.getTime() + reviewDeadlineHours * 60 * 60 * 1000),
    })
    .returning({ id: dispute.id });

  await db
    .update(returnRequest)
    .set({ status: 'ESCALATED', escalatedAt: now, updatedAt: now })
    .where(eq(returnRequest.id, returnId));

  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  await notify(req.sellerId, 'dispute.opened', {
    orderNumber: ord?.orderNumber ?? '',
  });

  await notify(req.buyerId, 'dispute.opened', {
    orderNumber: ord?.orderNumber ?? '',
  });

  return { success: true, disputeId: created?.id };
}

function mapReasonToClaimType(reason: string): ClaimType {
  switch (reason) {
    case 'INAD': return 'INAD';
    case 'DAMAGED': return 'DAMAGED';
    case 'INR': return 'INR';
    case 'COUNTERFEIT': return 'COUNTERFEIT';
    case 'REMORSE': return 'REMORSE';
    default: return 'INAD';
  }
}
