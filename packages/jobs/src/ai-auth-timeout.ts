/**
 * AI authentication timeout job — G10.2 Gap 3
 * Marks stale AI_PENDING requests as AI_INCONCLUSIVE after maxTurnaroundHours.
 * Registered as hourly cron in cron-jobs.ts.
 */

import { db } from '@twicely/db';
import { authenticationRequest, listing } from '@twicely/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { createQueue, createWorker } from './queue';

const QUEUE_NAME = 'ai-auth-timeout';

interface AiAuthTimeoutData {
  triggeredAt: string;
}

export const aiAuthTimeoutQueue = createQueue<AiAuthTimeoutData>(QUEUE_NAME);

export async function processAiAuthTimeout(): Promise<number> {
  const maxHours = await getPlatformSetting<number>(
    'trust.authentication.aiMaxTurnaroundHours',
    24,
  );

  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);

  // Find all stale AI_PENDING requests
  const staleRequests = await db
    .select({
      id: authenticationRequest.id,
      listingId: authenticationRequest.listingId,
      sellerId: authenticationRequest.sellerId,
    })
    .from(authenticationRequest)
    .where(
      and(
        eq(authenticationRequest.status, 'AI_PENDING'),
        lt(authenticationRequest.createdAt, cutoff),
      ),
    );

  if (staleRequests.length === 0) return 0;

  const now = new Date();

  for (const req of staleRequests) {
    await db
      .update(authenticationRequest)
      .set({
        status: 'AI_INCONCLUSIVE',
        completedAt: now,
        buyerFeeCents: 0,
        sellerFeeCents: 0,
        resultNotes: `Timed out — provider did not respond within ${maxHours} hours`,
        updatedAt: now,
      })
      .where(eq(authenticationRequest.id, req.id));

    await db
      .update(listing)
      .set({
        authenticationStatus: 'AI_INCONCLUSIVE',
        updatedAt: now,
      })
      .where(eq(listing.id, req.listingId));

    // Fire-and-forget notification
    try {
      const { notify } = await import('@twicely/notifications/service');
      await notify(req.sellerId, 'auth.ai.inconclusive', {
        listingId: req.listingId,
        reason: 'timeout',
      });
    } catch (err) {
      logger.warn('[ai-auth-timeout] Notification failed', {
        requestId: req.id,
        error: String(err),
      });
    }
  }

  logger.info('[ai-auth-timeout] Processed stale requests', {
    count: staleRequests.length,
    maxHours,
  });

  return staleRequests.length;
}

export async function registerAiAuthTimeoutJob(): Promise<void> {
  await aiAuthTimeoutQueue.add(
    'cron:ai-auth-timeout',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'cron-ai-auth-timeout',
      repeat: { pattern: '0 * * * *', tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

export const aiAuthTimeoutWorker = createWorker<AiAuthTimeoutData>(
  QUEUE_NAME,
  async () => {
    await processAiAuthTimeout();
  },
  1,
);
