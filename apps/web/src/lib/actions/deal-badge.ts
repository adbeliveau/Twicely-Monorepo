'use server';

import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import {
  computeDealBadge,
  getDealBadgeLabel,
  getDealBadgeColor,
} from '@twicely/commerce/deal-badges';
import type { ListingContext, MarketSummary, DealBadgeResult } from '@twicely/commerce/deal-badges';

// ─── Schema ──────────────────────────────────────────────────────────────────

const getDealBadgeSchema = z.object({
  listingId: zodId,
  priceCents: z.number().int().nonnegative(),
  categoryId: zodId.nullable(),
  condition: z.enum(['NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE']),
  brand: z.string().nullable(),
  sellerId: zodId,
  sellerAvgDaysToSell: z.number().nullable(),
  hasPriceDropRecent: z.boolean(),
  isOnlyListingOfType: z.boolean(),
}).strict();

const marketSummarySchema = z.object({
  categoryId: zodId,
  condition: z.enum(['NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE']),
  brand: z.string().nullable(),
  sampleSize: z.number().int().nonnegative(),
  medianPriceCents: z.number().int().nonnegative(),
  percentile20PriceCents: z.number().int().nonnegative(),
  avgDaysToSell: z.number().nonnegative(),
}).strict().nullable();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DealBadgeDisplay {
  badge: string | null;
  label: string | null;
  colorClass: string;
  reason: string | null;
}

// ─── Action ──────────────────────────────────────────────────────────────────

/**
 * Compute deal badge for a listing.
 * Called from listing detail pages and listing cards to show
 * GREAT_PRICE, PRICE_DROP, FAST_SELLER, or LAST_ONE badges.
 */
export async function getDealBadgeAction(
  listingContext: z.infer<typeof getDealBadgeSchema>,
  marketSummary: z.infer<typeof marketSummarySchema>
): Promise<DealBadgeDisplay> {
  const listingParsed = getDealBadgeSchema.safeParse(listingContext);
  if (!listingParsed.success) {
    return { badge: null, label: null, colorClass: '', reason: null };
  }

  const marketParsed = marketSummarySchema.safeParse(marketSummary);
  if (!marketParsed.success) {
    return { badge: null, label: null, colorClass: '', reason: null };
  }

  const context: ListingContext = listingParsed.data;
  const summary: MarketSummary | null = marketParsed.data;

  const result: DealBadgeResult = await computeDealBadge(context, summary);

  return {
    badge: result.badge,
    label: getDealBadgeLabel(result.badge),
    colorClass: getDealBadgeColor(result.badge),
    reason: result.reason,
  };
}
