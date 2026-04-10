/**
 * V4-06: Campaign Analytics
 *
 * Read-only analytics queries for campaign performance monitoring.
 */

import { db } from '@twicely/db';
import {
  promotionCampaign,
  campaignPromotion,
  campaignBudgetLog,
  promotionUsage,
} from '@twicely/db/schema';
import { eq, count, sql, and } from 'drizzle-orm';

// --- Types ------------------------------------------------------------------

export interface CampaignAnalytics {
  campaignId: string;
  name: string;
  status: string;
  campaignType: string;
  budgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
  spendPct: number | null;
  linkedPromotionCount: number;
  totalRedemptions: number;
  totalDiscountCents: number;
  uniqueBuyers: number;
  startsAt: Date;
  endsAt: Date;
}

// --- Core Functions ---------------------------------------------------------

/**
 * Get comprehensive analytics for a campaign.
 * Aggregates spend, redemptions, and buyer counts.
 */
export async function getCampaignAnalytics(
  campaignId: string,
): Promise<CampaignAnalytics | null> {
  // Fetch campaign base data
  const [campaign] = await db
    .select({
      id: promotionCampaign.id,
      name: promotionCampaign.name,
      status: promotionCampaign.status,
      campaignType: promotionCampaign.campaignType,
      budgetCents: promotionCampaign.budgetCents,
      spentCents: promotionCampaign.spentCents,
      startsAt: promotionCampaign.startsAt,
      endsAt: promotionCampaign.endsAt,
    })
    .from(promotionCampaign)
    .where(eq(promotionCampaign.id, campaignId))
    .limit(1);

  if (!campaign) return null;

  // Count linked promotions
  const [promoCount] = await db
    .select({ value: count() })
    .from(campaignPromotion)
    .where(eq(campaignPromotion.campaignId, campaignId));

  // Get linked promotion IDs for usage aggregation
  const links = await db
    .select({ promotionId: campaignPromotion.promotionId })
    .from(campaignPromotion)
    .where(eq(campaignPromotion.campaignId, campaignId));

  let totalRedemptions = 0;
  let totalDiscountCents = 0;
  let uniqueBuyers = 0;

  if (links.length > 0) {
    const promoIds = links.map((l) => l.promotionId);

    // Aggregate promotion usage for all linked promotions
    const [usageAgg] = await db
      .select({
        redemptions: count(),
        discountTotal: sql<number>`COALESCE(SUM(${promotionUsage.discountCents}), 0)`,
        buyers: sql<number>`COUNT(DISTINCT ${promotionUsage.buyerId})`,
      })
      .from(promotionUsage)
      .where(sql`${promotionUsage.promotionId} = ANY(${promoIds})`);

    totalRedemptions = usageAgg?.redemptions ?? 0;
    totalDiscountCents = Number(usageAgg?.discountTotal ?? 0);
    uniqueBuyers = Number(usageAgg?.buyers ?? 0);
  }

  const remainingCents =
    campaign.budgetCents !== null
      ? Math.max(0, campaign.budgetCents - campaign.spentCents)
      : null;

  const spendPct =
    campaign.budgetCents !== null && campaign.budgetCents > 0
      ? Math.round((campaign.spentCents / campaign.budgetCents) * 100)
      : null;

  return {
    campaignId: campaign.id,
    name: campaign.name,
    status: campaign.status,
    campaignType: campaign.campaignType,
    budgetCents: campaign.budgetCents,
    spentCents: campaign.spentCents,
    remainingCents,
    spendPct,
    linkedPromotionCount: promoCount?.value ?? 0,
    totalRedemptions,
    totalDiscountCents,
    uniqueBuyers,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
  };
}
