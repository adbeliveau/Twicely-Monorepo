/**
 * Trust Metrics Queries
 *
 * Queries for fetching metrics used in trust calculations:
 * - Reviewer trust weight factors (C1.1)
 * - Seller performance metrics (C1.2)
 * - Buyer quality metrics (C1.3)
 */

import { db } from '@twicely/db';
import { user, order, review, returnRequest, dispute, sellerProfile } from '@twicely/db/schema';
import { eq, and, gte, count, avg, sql } from 'drizzle-orm';
import type { TrustWeightFactors } from '@twicely/commerce/trust-weight';
import type { SellerMetrics } from '@twicely/commerce/performance-band';
import type { BuyerMetrics } from '@twicely/commerce/buyer-quality';

/**
 * Get trust weight factors for a reviewer (buyer).
 */
export async function getReviewerTrustFactors(userId: string): Promise<TrustWeightFactors> {
  // Get user creation date
  const [userData] = await db
    .select({
      createdAt: user.createdAt,
      phoneVerified: user.phoneVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) {
    return {
      accountAgeDays: 0,
      verifiedPurchases: 0,
      reviewsSubmitted: 0,
      isIdentityVerified: false,
    };
  }

  const now = new Date();
  const accountAgeDays = Math.floor(
    (now.getTime() - userData.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Count verified purchases (completed orders as buyer)
  const [purchaseResult] = await db
    .select({ count: count() })
    .from(order)
    .where(
      and(
        eq(order.buyerId, userId),
        eq(order.status, 'COMPLETED')
      )
    );

  // Count reviews submitted
  const [reviewResult] = await db
    .select({ count: count() })
    .from(review)
    .where(eq(review.reviewerUserId, userId));

  return {
    accountAgeDays,
    verifiedPurchases: purchaseResult?.count ?? 0,
    reviewsSubmitted: reviewResult?.count ?? 0,
    isIdentityVerified: userData.phoneVerified,
  };
}

/**
 * Get seller performance metrics for band calculation.
 */
export async function getSellerPerformanceMetrics(sellerId: string): Promise<SellerMetrics | null> {
  // Check if seller exists
  const [seller] = await db
    .select({
      id: sellerProfile.id,
      status: sellerProfile.status,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!seller) return null;

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get order counts and rates
  const [orderStats] = await db
    .select({
      total: count(),
      completed: sql<number>`COUNT(*) FILTER (WHERE ${order.status} = 'COMPLETED')`,
      canceled: sql<number>`COUNT(*) FILTER (WHERE ${order.status} = 'CANCELED')`,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, sellerId),
        gte(order.createdAt, ninetyDaysAgo)
      )
    );

  const totalOrders = orderStats?.total ?? 0;
  const completedOrders = Number(orderStats?.completed ?? 0);
  const canceledOrders = Number(orderStats?.canceled ?? 0);

  // Get late shipment rate from shipments table (via order)
  const shipmentResult = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE s.late_shipment = true)::float / NULLIF(COUNT(*)::float, 0) as late_rate
    FROM shipment s
    JOIN "order" o ON s.order_id = o.id
    WHERE o.seller_id = ${sellerId}
    AND o.created_at >= ${ninetyDaysAgo}
  `);

  const lateShipmentRate = Number(
    (shipmentResult[0] as Record<string, unknown>)?.late_rate ?? 0
  );

  // Get return stats
  const [returnStats] = await db
    .select({
      total: count(),
      inad: sql<number>`COUNT(*) FILTER (WHERE ${returnRequest.reason} = 'INAD')`,
    })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.sellerId, sellerId),
        gte(returnRequest.createdAt, ninetyDaysAgo)
      )
    );

  const returnCount = returnStats?.total ?? 0;
  const inadCount = Number(returnStats?.inad ?? 0);

  // Calculate rates
  const returnRate = completedOrders > 0 ? returnCount / completedOrders : 0;
  const inadRate = completedOrders > 0 ? inadCount / completedOrders : 0;
  const cancelRate = totalOrders > 0 ? canceledOrders / totalOrders : 0;
  const onTimeShippingPct = (1 - lateShipmentRate) * 100;

  // Get review average
  const [reviewStats] = await db
    .select({
      avgRating: avg(review.rating),
    })
    .from(review)
    .where(
      and(
        eq(review.sellerId, sellerId),
        eq(review.status, 'APPROVED'),
        gte(review.createdAt, ninetyDaysAgo)
      )
    );

  // Get average response time (placeholder - would need message timestamps)
  const responseTimeHours: number | null = null;

  return {
    onTimeShippingPct,
    inadRate,
    reviewAverage: reviewStats?.avgRating ? Number(reviewStats.avgRating) : null,
    responseTimeHours,
    returnRate,
    cancelRate,
    totalOrders,
  };
}

/**
 * Get buyer quality metrics for tier calculation.
 */
export async function getBuyerQualityMetrics(buyerId: string): Promise<BuyerMetrics> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get order stats (as buyer)
  const [orderStats] = await db
    .select({
      total: count(),
      canceled: sql<number>`COUNT(*) FILTER (WHERE ${order.status} = 'CANCELED' AND ${order.cancelInitiator} = 'BUYER')`,
    })
    .from(order)
    .where(
      and(
        eq(order.buyerId, buyerId),
        gte(order.createdAt, ninetyDaysAgo)
      )
    );

  // Get return count (buyer-initiated)
  const [returnStats] = await db
    .select({ count: count() })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.buyerId, buyerId),
        gte(returnRequest.createdAt, ninetyDaysAgo)
      )
    );

  // Get dispute count
  const [disputeStats] = await db
    .select({ count: count() })
    .from(dispute)
    .where(
      and(
        eq(dispute.buyerId, buyerId),
        gte(dispute.createdAt, ninetyDaysAgo)
      )
    );

  return {
    totalOrders90d: orderStats?.total ?? 0,
    returns90d: returnStats?.count ?? 0,
    cancellations90d: Number(orderStats?.canceled ?? 0),
    disputes90d: disputeStats?.count ?? 0,
  };
}

/**
 * Update a review's trust weight in the database.
 */
export async function updateReviewTrustWeight(
  reviewId: string,
  weight: number,
  factors: TrustWeightFactors
): Promise<void> {
  await db
    .update(review)
    .set({
      trustWeight: weight,
      trustWeightFactors: factors,
      updatedAt: new Date(),
    })
    .where(eq(review.id, reviewId));
}

/**
 * Update a user's buyer quality tier.
 */
export async function updateBuyerQualityTier(
  userId: string,
  tier: 'GREEN' | 'YELLOW' | 'RED'
): Promise<void> {
  await db
    .update(user)
    .set({
      buyerQualityTier: tier,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}
