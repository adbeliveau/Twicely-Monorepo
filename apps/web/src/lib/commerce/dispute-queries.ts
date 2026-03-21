/**
 * Dispute query and admin resolution functions — extracted from disputes.ts
 *
 * Read-only queries for dispute data (admin dashboard, detail views)
 * and admin operations (assign, resolve).
 */

import { db } from '@twicely/db';
import { dispute, order } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { processReturnRefund } from '@twicely/stripe/refunds';
import { logger } from '@twicely/logger';

/**
 * Get all open disputes (for admin dashboard).
 */
export async function getOpenDisputes() {
  return db
    .select({
      id: dispute.id,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      claimType: dispute.claimType,
      status: dispute.status,
      description: dispute.description,
      deadlineAt: dispute.deadlineAt,
      resolvedByStaffId: dispute.resolvedByStaffId,
      createdAt: dispute.createdAt,
    })
    .from(dispute)
    .where(
      and(
        eq(dispute.status, 'OPEN'),
        isNull(dispute.resolvedByStaffId)
      )
    )
    .orderBy(dispute.createdAt);
}

/**
 * Get disputes assigned to an admin.
 */
export async function getAssignedDisputes(adminId: string) {
  return db
    .select({
      id: dispute.id,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      claimType: dispute.claimType,
      status: dispute.status,
      description: dispute.description,
      deadlineAt: dispute.deadlineAt,
      createdAt: dispute.createdAt,
    })
    .from(dispute)
    .where(
      and(
        eq(dispute.resolvedByStaffId, adminId),
        eq(dispute.status, 'UNDER_REVIEW')
      )
    )
    .orderBy(dispute.deadlineAt);
}

/**
 * Get dispute by ID with full details.
 */
export async function getDisputeById(disputeId: string) {
  const [disp] = await db
    .select()
    .from(dispute)
    .where(eq(dispute.id, disputeId))
    .limit(1);

  return disp ?? null;
}

export interface AssignDisputeResult { success: boolean; error?: string }

/**
 * Admin assigns themselves to a dispute.
 */
export async function assignDispute(
  adminId: string,
  disputeId: string
): Promise<AssignDisputeResult> {
  const [disp] = await db
    .select({
      id: dispute.id,
      status: dispute.status,
      resolvedByStaffId: dispute.resolvedByStaffId,
    })
    .from(dispute)
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!disp) {
    return { success: false, error: 'Dispute not found' };
  }

  if (disp.resolvedByStaffId) {
    return { success: false, error: 'Dispute is already assigned to another agent' };
  }

  if (!['OPEN', 'UNDER_REVIEW'].includes(disp.status)) {
    return { success: false, error: 'Can only assign open disputes' };
  }

  await db
    .update(dispute)
    .set({
      resolvedByStaffId: adminId,
      status: 'UNDER_REVIEW',
      updatedAt: new Date(),
    })
    .where(eq(dispute.id, disputeId));

  return { success: true };
}

export type DisputeResolution = 'RESOLVED_BUYER' | 'RESOLVED_SELLER' | 'RESOLVED_PARTIAL';

export interface ResolveDisputeInput {
  adminId: string;
  disputeId: string;
  resolution: DisputeResolution;
  resolutionNote: string;
  resolutionAmountCents?: number;
}

export interface ResolveDisputeResult { success: boolean; error?: string }

/**
 * Admin resolves a dispute.
 */
export async function resolveDispute(
  input: ResolveDisputeInput
): Promise<ResolveDisputeResult> {
  const { adminId, disputeId, resolution, resolutionNote, resolutionAmountCents } = input;

  const [disp] = await db
    .select({
      id: dispute.id,
      status: dispute.status,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      resolvedByStaffId: dispute.resolvedByStaffId,
      returnRequestId: dispute.returnRequestId,
    })
    .from(dispute)
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!disp) {
    return { success: false, error: 'Dispute not found' };
  }

  if (disp.resolvedByStaffId !== adminId) {
    return { success: false, error: 'You are not assigned to this dispute' };
  }

  if (disp.status !== 'UNDER_REVIEW') {
    return { success: false, error: 'Dispute is not under review' };
  }

  if (resolution === 'RESOLVED_PARTIAL' && !resolutionAmountCents) {
    return { success: false, error: 'Partial resolution requires an amount' };
  }

  const now = new Date();

  await db
    .update(dispute)
    .set({
      status: resolution,
      resolutionNote,
      resolutionAmountCents: resolutionAmountCents ?? null,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(dispute.id, disputeId));

  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, disp.orderId))
    .limit(1);

  const resolutionText = {
    RESOLVED_BUYER: 'Resolved in favor of the buyer. A full refund will be issued.',
    RESOLVED_SELLER: 'Resolved in favor of the seller. No refund will be issued.',
    RESOLVED_PARTIAL: `Resolved with a partial refund of $${((resolutionAmountCents ?? 0) / 100).toFixed(2)}.`,
  }[resolution];

  await notify(disp.buyerId, 'dispute.resolved', {
    orderNumber: ord?.orderNumber ?? '',
    resolution: resolutionText,
  });

  await notify(disp.sellerId, 'dispute.resolved', {
    orderNumber: ord?.orderNumber ?? '',
    resolution: resolutionText,
  });

  if ((resolution === 'RESOLVED_BUYER' || resolution === 'RESOLVED_PARTIAL') && disp.returnRequestId) {
    const refundAmount = resolution === 'RESOLVED_PARTIAL' ? resolutionAmountCents : undefined;
    const refundResult = await processReturnRefund({
      returnId: disp.returnRequestId,
      amountCents: refundAmount,
    });
    if (!refundResult.success) {
      logger.error('Failed to process refund for dispute', { disputeId, error: refundResult.error });
    }
  }

  return { success: true };
}
