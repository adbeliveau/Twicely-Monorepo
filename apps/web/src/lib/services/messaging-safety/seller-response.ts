import { db } from '@twicely/db';
import { sellerResponseMetric } from '@twicely/db/schema';
import { eq, and, gte, isNotNull, avg, count } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Record that a buyer sent the first message in a conversation to a seller.
 * Creates a new metric row if one does not exist for this (sellerId, conversationId).
 */
export async function recordBuyerMessage(
  sellerId: string,
  conversationId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(sellerResponseMetric)
    .where(
      and(
        eq(sellerResponseMetric.sellerId, sellerId),
        eq(sellerResponseMetric.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Already tracking this conversation
    return;
  }

  await db.insert(sellerResponseMetric).values({
    sellerId,
    conversationId,
    firstBuyerMessageAt: new Date(),
  });

  logger.debug('Recorded buyer message for response tracking', {
    sellerId,
    conversationId,
  });
}

/**
 * Record a seller's first response in a conversation.
 * Calculates and stores the response time in minutes.
 */
export async function recordSellerResponse(
  sellerId: string,
  conversationId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(sellerResponseMetric)
    .where(
      and(
        eq(sellerResponseMetric.sellerId, sellerId),
        eq(sellerResponseMetric.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    logger.warn('No buyer message tracked for this conversation', {
      sellerId,
      conversationId,
    });
    return;
  }

  const metric = existing[0];
  if (!metric) {
    return;
  }

  if (metric.firstSellerResponseAt !== null) {
    // Already recorded the first response
    return;
  }

  const now = new Date();
  const responseTimeMinutes = Math.round(
    (now.getTime() - metric.firstBuyerMessageAt.getTime()) / (1000 * 60),
  );

  await db
    .update(sellerResponseMetric)
    .set({
      firstSellerResponseAt: now,
      responseTimeMinutes,
    })
    .where(eq(sellerResponseMetric.id, metric.id));

  logger.debug('Recorded seller response', {
    sellerId,
    conversationId,
    responseTimeMinutes,
  });
}

/**
 * Get seller response statistics over a given number of days.
 */
export async function getSellerResponseStats(
  sellerId: string,
  days: number = 30,
): Promise<{
  averageResponseMinutes: number;
  responseRate: number;
  totalConversations: number;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const totalRows = await db
    .select({ count: count() })
    .from(sellerResponseMetric)
    .where(
      and(
        eq(sellerResponseMetric.sellerId, sellerId),
        gte(sellerResponseMetric.createdAt, since),
      ),
    );

  const totalConversations = totalRows[0]?.count ?? 0;

  if (totalConversations === 0) {
    return { averageResponseMinutes: 0, responseRate: 0, totalConversations: 0 };
  }

  const respondedRows = await db
    .select({
      count: count(),
      avgMinutes: avg(sellerResponseMetric.responseTimeMinutes),
    })
    .from(sellerResponseMetric)
    .where(
      and(
        eq(sellerResponseMetric.sellerId, sellerId),
        gte(sellerResponseMetric.createdAt, since),
        isNotNull(sellerResponseMetric.firstSellerResponseAt),
      ),
    );

  const respondedCount = respondedRows[0]?.count ?? 0;
  const avgMinutes = respondedRows[0]?.avgMinutes
    ? Math.round(Number(respondedRows[0].avgMinutes))
    : 0;

  const responseRate = totalConversations > 0
    ? Math.round((respondedCount / totalConversations) * 100) / 100
    : 0;

  return {
    averageResponseMinutes: avgMinutes,
    responseRate,
    totalConversations,
  };
}
