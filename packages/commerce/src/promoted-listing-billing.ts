/**
 * V4-06: Promoted Listing CPC Billing
 *
 * Records clicks, enforces daily budgets, calculates ROAS,
 * and creates ledger entries for each click charge.
 */

import { db } from '@twicely/db';
import {
  promotedListing,
  promotedListingEvent,
  ledgerEntry,
} from '@twicely/db/schema';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { logger } from '@twicely/logger';

// --- Helpers ----------------------------------------------------------------

function todayStartUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// --- Core Functions ---------------------------------------------------------

/**
 * Record a CPC click on a promoted listing.
 * Charges bidCents, enforces daily budget, creates ledger entry.
 */
export async function recordPromotedListingClick(args: {
  promotedListingId: string;
  buyerId?: string;
}): Promise<{ charged: boolean; reason?: string }> {
  const { promotedListingId } = args;

  // Load promoted listing
  const [pl] = await db
    .select({
      id: promotedListing.id,
      sellerId: promotedListing.sellerId,
      bidCents: promotedListing.bidCents,
      dailyBudgetCents: promotedListing.dailyBudgetCents,
      isActive: promotedListing.isActive,
    })
    .from(promotedListing)
    .where(eq(promotedListing.id, promotedListingId))
    .limit(1);

  if (!pl) {
    return { charged: false, reason: 'Promoted listing not found' };
  }

  if (!pl.isActive) {
    return { charged: false, reason: 'Promoted listing is not active' };
  }

  // Check daily budget
  if (pl.dailyBudgetCents !== null) {
    const todayStart = todayStartUtc();
    const [spentRow] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${promotedListingEvent.feeCents}), 0)`,
      })
      .from(promotedListingEvent)
      .where(
        and(
          eq(promotedListingEvent.promotedListingId, promotedListingId),
          eq(promotedListingEvent.eventType, 'click'),
          gte(promotedListingEvent.createdAt, todayStart),
        ),
      );

    const todaySpent = Number(spentRow?.total ?? 0);
    if (todaySpent + pl.bidCents > pl.dailyBudgetCents) {
      return { charged: false, reason: 'Daily budget exhausted' };
    }
  }

  // Insert click event
  await db.insert(promotedListingEvent).values({
    promotedListingId,
    eventType: 'click',
    feeCents: pl.bidCents,
  });

  // Increment clicks and totalFeeCents on promotedListing (atomic)
  await db
    .update(promotedListing)
    .set({
      clicks: sql`${promotedListing.clicks} + 1`,
      totalFeeCents: sql`${promotedListing.totalFeeCents} + ${pl.bidCents}`,
      updatedAt: new Date(),
    })
    .where(eq(promotedListing.id, promotedListingId));

  // Create ledger entry for the click charge
  await db.insert(ledgerEntry).values({
    userId: pl.sellerId,
    type: 'PROMOTED_LISTING_FEE',
    amountCents: -pl.bidCents,
    status: 'POSTED',
    memo: 'Promoted listing CPC click',
    idempotencyKey: `promoted_click:${promotedListingId}:${Date.now()}`,
  });

  logger.info('[promoted-listing-billing] Click recorded', {
    promotedListingId,
    bidCents: pl.bidCents,
    sellerId: pl.sellerId,
  });

  return { charged: true };
}

/**
 * Check remaining daily budget for a promoted listing.
 */
export async function checkDailyBudget(
  promotedListingId: string,
): Promise<{
  remaining: boolean;
  spentTodayCents: number;
  dailyBudgetCents: number | null;
}> {
  const [pl] = await db
    .select({
      dailyBudgetCents: promotedListing.dailyBudgetCents,
    })
    .from(promotedListing)
    .where(eq(promotedListing.id, promotedListingId))
    .limit(1);

  if (!pl) {
    return { remaining: false, spentTodayCents: 0, dailyBudgetCents: null };
  }

  const todayStart = todayStartUtc();
  const [spentRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${promotedListingEvent.feeCents}), 0)`,
    })
    .from(promotedListingEvent)
    .where(
      and(
        eq(promotedListingEvent.promotedListingId, promotedListingId),
        eq(promotedListingEvent.eventType, 'click'),
        gte(promotedListingEvent.createdAt, todayStart),
      ),
    );

  const spentTodayCents = Number(spentRow?.total ?? 0);

  return {
    remaining: pl.dailyBudgetCents === null || spentTodayCents < pl.dailyBudgetCents,
    spentTodayCents,
    dailyBudgetCents: pl.dailyBudgetCents,
  };
}

/**
 * Calculate ROAS (return on ad spend) for a promoted listing.
 */
export async function getPromotedListingRoas(
  promotedListingId: string,
): Promise<{
  impressions: number;
  clicks: number;
  sales: number;
  totalFeeCents: number;
  roas: number | null;
}> {
  const [pl] = await db
    .select({
      impressions: promotedListing.impressions,
      clicks: promotedListing.clicks,
      sales: promotedListing.sales,
      totalFeeCents: promotedListing.totalFeeCents,
    })
    .from(promotedListing)
    .where(eq(promotedListing.id, promotedListingId))
    .limit(1);

  if (!pl) {
    return { impressions: 0, clicks: 0, sales: 0, totalFeeCents: 0, roas: null };
  }

  // ROAS = sales / totalFeeCents (null when no spend)
  const roas = pl.totalFeeCents > 0
    ? Math.round((pl.sales / pl.totalFeeCents) * 10000) / 10000
    : null;

  return {
    impressions: pl.impressions,
    clicks: pl.clicks,
    sales: pl.sales,
    totalFeeCents: pl.totalFeeCents,
    roas,
  };
}
