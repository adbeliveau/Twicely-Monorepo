/**
 * Review and response-time metric queries for the seller score engine.
 * Split from metric-queries.ts to stay under 300-line limit.
 * Seller Score Canonical Section 2.1.
 */

import { db } from '@twicely/db';
import { review, conversation, message } from '@twicely/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { windowStart } from '@twicely/scoring/metric-queries';

/**
 * Review average: weighted DSR average for the window.
 * Returns 4.5 (ideal) when no reviews exist in window.
 */
export async function getReviewAverage(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const rows = await db
    .select({
      rating: review.rating,
      dsrItemAsDescribed: review.dsrItemAsDescribed,
      dsrShippingSpeed: review.dsrShippingSpeed,
      dsrCommunication: review.dsrCommunication,
      dsrPackaging: review.dsrPackaging,
      trustWeight: review.trustWeight,
    })
    .from(review)
    .where(
      and(
        eq(review.sellerId, userId),
        gte(review.createdAt, since),
        eq(review.status, 'APPROVED'),
      ),
    );

  if (rows.length === 0) return 4.5;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const r of rows) {
    const dims = [
      r.rating,
      r.dsrItemAsDescribed,
      r.dsrShippingSpeed,
      r.dsrCommunication,
      r.dsrPackaging,
    ].filter((v): v is number => v !== null);
    const avg = dims.reduce((s, v) => s + v, 0) / dims.length;
    const w = r.trustWeight ?? 1.0;
    weightedSum += avg * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 4.5;
}

/**
 * Median response time in hours: time from buyer's first message to seller's first reply.
 * Returns 4 (ideal default) when no conversations in window.
 */
export async function getMedianResponseTime(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const convRows = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        eq(conversation.sellerId, userId),
        gte(conversation.createdAt, since),
      ),
    );

  if (convRows.length === 0) return 4;

  const responseTimes: number[] = [];

  for (const conv of convRows) {
    const msgs = await db
      .select({
        senderUserId: message.senderUserId,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(eq(message.conversationId, conv.id))
      .orderBy(message.createdAt)
      .limit(20);

    const firstBuyerMsg = msgs.find((m) => m.senderUserId !== userId);
    if (!firstBuyerMsg) continue;

    const sellerReply = msgs.find(
      (m) => m.senderUserId === userId && m.createdAt > firstBuyerMsg.createdAt,
    );
    if (!sellerReply) continue;

    const diffMs = sellerReply.createdAt.getTime() - firstBuyerMsg.createdAt.getTime();
    responseTimes.push(diffMs / (1000 * 60 * 60));
  }

  if (responseTimes.length === 0) return 4;

  responseTimes.sort((a, b) => a - b);
  const mid = Math.floor(responseTimes.length / 2);
  if (responseTimes.length % 2 === 0) {
    return ((responseTimes[mid - 1] ?? 4) + (responseTimes[mid] ?? 4)) / 2;
  }
  return responseTimes[mid] ?? 4;
}
