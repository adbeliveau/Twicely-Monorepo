'use server';

/**
 * Local Fraud Actions (G2.15)
 *
 * Server actions for reporting and resolving local fraud flags.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@twicely/db';
import {
  localFraudFlag,
  localTransaction,
  orderItem,
  listing,
  auditEvent,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { notify } from '@twicely/notifications/service';
import { applyConfirmedFraudConsequences } from '@twicely/commerce/local-fraud-consequences';
import { logger } from '@twicely/logger';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const reportLocalFraudSchema = z.object({
  localTransactionId: z.string().min(1),
  description: z.string().min(10).max(2000),
}).strict();

const resolveLocalFraudFlagSchema = z.object({
  flagId: z.string().min(1),
  resolution: z.enum(['CONFIRMED', 'DISMISSED']),
  note: z.string().min(1).max(2000),
  applyConsequences: z.boolean(),
}).strict();

// ─── Action 1: reportLocalFraudAction ────────────────────────────────────────

/**
 * Buyer reports suspected fraud on their local transaction.
 * Creates MANUAL_REVIEW fraud flag. No automatic consequences.
 */
export async function reportLocalFraudAction(input: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = reportLocalFraudSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { localTransactionId, description } = parsed.data;

  // Load the local transaction
  const [tx] = await db
    .select({
      id: localTransaction.id,
      orderId: localTransaction.orderId,
      buyerId: localTransaction.buyerId,
      sellerId: localTransaction.sellerId,
      status: localTransaction.status,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!tx) {
    return { success: false, error: 'Not found' };
  }

  // CASL: buyer can report fraud on own transactions
  if (!ability.can('create', sub('LocalFraudFlag', { reporterId: session.userId }))) {
    return { success: false, error: 'Not found' };
  }

  if (tx.buyerId !== session.userId) {
    return { success: false, error: 'Not found' };
  }

  // Validate: one fraud report per buyer per localTransaction
  const [existing] = await db
    .select({ id: localFraudFlag.id })
    .from(localFraudFlag)
    .where(
      and(
        eq(localFraudFlag.localTransactionId, localTransactionId),
        eq(localFraudFlag.trigger, 'BUYER_CLAIM'),
      ),
    )
    .limit(1);

  if (existing) {
    return { success: false, error: 'Fraud report already submitted for this transaction' };
  }

  // Get listingId from orderItem
  const [item] = await db
    .select({ listingId: orderItem.listingId })
    .from(orderItem)
    .where(eq(orderItem.orderId, tx.orderId))
    .limit(1);

  if (!item) {
    return { success: false, error: 'Not found' };
  }

  const now = new Date();

  await db.insert(localFraudFlag).values({
    sellerId: tx.sellerId,
    localTransactionId,
    listingId: item.listingId,
    trigger: 'BUYER_CLAIM',
    severity: 'MANUAL_REVIEW',
    status: 'OPEN',
    detailsJson: {
      description,
      reportedBy: session.userId,
      reportedAt: now.toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  });

  // Create audit event for staff notification
  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'BUYER_FRAUD_REPORT_SUBMITTED',
    subject: 'LocalTransaction',
    subjectId: localTransactionId,
    severity: 'HIGH',
    detailsJson: { sellerId: tx.sellerId, listingId: item.listingId },
  });

  logger.info('[local-fraud] Buyer fraud report submitted', {
    localTransactionId,
    buyerId: session.userId,
  });

  return { success: true };
}

// ─── Action 2: resolveLocalFraudFlagAction ────────────────────────────────────

/**
 * Staff resolves a fraud flag — confirms (with consequences) or dismisses.
 * Requires MODERATION or ADMIN role.
 */
export async function resolveLocalFraudFlagAction(input: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'LocalFraudFlag')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = resolveLocalFraudFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { flagId, resolution, note, applyConsequences } = parsed.data;

  // Load flag — must be OPEN
  const [flag] = await db
    .select({ id: localFraudFlag.id, status: localFraudFlag.status, sellerId: localFraudFlag.sellerId, listingId: localFraudFlag.listingId })
    .from(localFraudFlag)
    .where(eq(localFraudFlag.id, flagId))
    .limit(1);

  if (!flag) {
    return { success: false, error: 'Not found' };
  }

  if (flag.status !== 'OPEN') {
    return { success: false, error: 'Flag already resolved' };
  }

  const now = new Date();

  if (resolution === 'CONFIRMED' && applyConsequences) {
    await applyConfirmedFraudConsequences({
      flagId,
      staffId: session.staffUserId,
      resolutionNote: note,
    });
  }

  if (resolution === 'DISMISSED') {
    // If listing was FLAGGED due to this investigation, restore to CLEAR
    const [listingRow] = await db
      .select({ enforcementState: listing.enforcementState })
      .from(listing)
      .where(eq(listing.id, flag.listingId))
      .limit(1);

    if (listingRow?.enforcementState === 'FLAGGED') {
      await db
        .update(listing)
        .set({ enforcementState: 'CLEAR', updatedAt: now })
        .where(eq(listing.id, flag.listingId));
    }

    await db.insert(auditEvent).values({
      actorType: 'STAFF',
      actorId: session.staffUserId,
      action: 'FRAUD_FLAG_DISMISSED',
      subject: 'LocalFraudFlag',
      subjectId: flagId,
      severity: 'MEDIUM',
      detailsJson: { sellerId: flag.sellerId, note },
    });
  }

  // Update flag status
  await db
    .update(localFraudFlag)
    .set({
      status: resolution,
      resolvedByStaffId: session.staffUserId,
      resolvedAt: now,
      resolutionNote: note,
      updatedAt: now,
    })
    .where(eq(localFraudFlag.id, flagId));

  void notify(flag.sellerId, 'local.fraud.seller_flagged', {
    flagId,
    resolution,
  }).catch(() => {});

  revalidatePath('/mod/fraud');

  logger.info('[local-fraud] Fraud flag resolved', {
    flagId,
    resolution,
    staffId: session.staffUserId,
  });

  return { success: true };
}
