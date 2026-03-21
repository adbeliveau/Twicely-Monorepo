/**
 * Local Scheduling Action Helpers (G2.9)
 *
 * Private helpers extracted to keep local-scheduling.ts under 300 lines.
 * Not exported from any public barrel — internal use only.
 * NOTE: No 'use server' — these are internal helpers, not client-callable actions.
 */

import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { localAutoCancelQueue } from '@twicely/jobs/local-auto-cancel';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { generateTokenPair } from '@twicely/commerce/local-token';

// ─── Token Regeneration ───────────────────────────────────────────────────────

export async function regenerateTokensOnConfirmation(
  transactionId: string,
  orderId: string,
  buyerId: string,
  sellerId: string,
  scheduledAt: Date,
): Promise<void> {
  try {
    const tokenExpiryHours = await getPlatformSetting<number>(
      'commerce.local.tokenExpiryHours',
      48,
    );

    const [orderRow] = await db
      .select({ itemSubtotalCents: order.itemSubtotalCents })
      .from(order)
      .where(eq(order.id, orderId))
      .limit(1);

    const amountCents = orderRow?.itemSubtotalCents ?? 0;

    const expiresAt = new Date(scheduledAt);
    expiresAt.setHours(expiresAt.getHours() + tokenExpiryHours);

    const tokens = generateTokenPair({
      transactionId,
      amountCents,
      buyerId,
      sellerId,
      expiresAt,
    });

    await db
      .update(localTransaction)
      .set({
        sellerConfirmationCode: tokens.sellerToken,
        sellerOfflineCode: tokens.sellerOfflineCode,
        buyerConfirmationCode: tokens.buyerToken,
        buyerOfflineCode: tokens.buyerOfflineCode,
        updatedAt: new Date(),
      })
      .where(eq(localTransaction.id, transactionId));

    logger.info('[local-scheduling] Tokens regenerated with confirmed scheduledAt', {
      transactionId,
    });
  } catch (err) {
    logger.error('[local-scheduling] Failed to regenerate tokens', {
      transactionId,
      error: String(err),
    });
  }
}

// ─── Auto-Cancel Scheduling ───────────────────────────────────────────────────

export async function enqueueAutoCancelAtScheduledTime(
  localTransactionId: string,
  orderId: string,
  buyerId: string,
  sellerId: string,
  scheduledAt: Date,
): Promise<void> {
  const autoCancelHours = await getPlatformSetting<number>(
    'commerce.local.autoCancelHours',
    48,
  );

  // Delay = scheduledAt + autoCancelHours - now
  const cancelAt = new Date(scheduledAt);
  cancelAt.setHours(cancelAt.getHours() + autoCancelHours);

  const delayMs = Math.max(0, cancelAt.getTime() - Date.now());

  await localAutoCancelQueue.add(
    'cancel',
    { localTransactionId, orderId, buyerId, sellerId },
    {
      jobId: `local-auto-cancel-${localTransactionId}`,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  logger.info('[local-scheduling] Auto-cancel enqueued at scheduledAt + autoCancelHours', {
    localTransactionId,
    scheduledAt,
    cancelAt,
    delayMs,
  });
}
