import { db } from '@twicely/db';
import { buyerPreference, browsingHistory, order, orderItem, listing } from '@twicely/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { PreferenceInput } from './types';

interface BuyerPreferenceRow {
  id: string;
  userId: string;
  preferredCategories: unknown;
  preferredBrands: unknown;
  preferredSizes: unknown;
  priceRangeMinCents: number | null;
  priceRangeMaxCents: number | null;
  updatedAt: Date;
}

/**
 * Upsert buyer preferences (explicit user-set preferences).
 */
export async function upsertPreferences(
  userId: string,
  input: PreferenceInput
): Promise<BuyerPreferenceRow> {
  const existing = await db
    .select()
    .from(buyerPreference)
    .where(eq(buyerPreference.userId, userId))
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    const [updated] = await db
      .update(buyerPreference)
      .set({
        preferredCategories: input.preferredCategories !== undefined
          ? JSON.stringify(input.preferredCategories)
          : undefined,
        preferredBrands: input.preferredBrands !== undefined
          ? JSON.stringify(input.preferredBrands)
          : undefined,
        preferredSizes: input.preferredSizes !== undefined
          ? JSON.stringify(input.preferredSizes)
          : undefined,
        priceRangeMinCents: input.priceRangeMinCents !== undefined
          ? input.priceRangeMinCents
          : undefined,
        priceRangeMaxCents: input.priceRangeMaxCents !== undefined
          ? input.priceRangeMaxCents
          : undefined,
        updatedAt: now,
      })
      .where(eq(buyerPreference.userId, userId))
      .returning();
    return updated as unknown as BuyerPreferenceRow;
  }

  const id = createId();
  const [inserted] = await db
    .insert(buyerPreference)
    .values({
      id,
      userId,
      preferredCategories: JSON.stringify(input.preferredCategories ?? []),
      preferredBrands: JSON.stringify(input.preferredBrands ?? []),
      preferredSizes: JSON.stringify(input.preferredSizes ?? {}),
      priceRangeMinCents: input.priceRangeMinCents ?? null,
      priceRangeMaxCents: input.priceRangeMaxCents ?? null,
      updatedAt: now,
    })
    .returning();

  return inserted as unknown as BuyerPreferenceRow;
}

/**
 * Get a buyer's preferences.
 */
export async function getPreferences(userId: string): Promise<BuyerPreferenceRow | null> {
  const [row] = await db
    .select()
    .from(buyerPreference)
    .where(eq(buyerPreference.userId, userId))
    .limit(1);

  return (row as unknown as BuyerPreferenceRow) ?? null;
}

/**
 * Infer buyer preferences from browsing and purchase history.
 * Aggregates most-viewed categories, brands, and price ranges.
 */
export async function inferPreferences(userId: string): Promise<PreferenceInput> {
  // Get top categories from browsing history
  const topCategories = await db
    .select({
      categoryId: browsingHistory.categoryId,
      views: sql<number>`SUM(${browsingHistory.viewCount})`,
    })
    .from(browsingHistory)
    .where(eq(browsingHistory.userId, userId))
    .groupBy(browsingHistory.categoryId)
    .orderBy(sql`SUM(${browsingHistory.viewCount}) DESC`)
    .limit(10);

  const preferredCategories = topCategories
    .map(c => c.categoryId)
    .filter((id): id is string => id !== null);

  // Get price range from browsing history (join with listing to get prices)
  const priceStats = await db
    .select({
      minPrice: sql<number>`MIN(${listing.priceCents})`,
      maxPrice: sql<number>`MAX(${listing.priceCents})`,
    })
    .from(browsingHistory)
    .innerJoin(listing, eq(browsingHistory.listingId, listing.id))
    .where(eq(browsingHistory.userId, userId));

  return {
    preferredCategories,
    preferredBrands: [],
    preferredSizes: {},
    priceRangeMinCents: priceStats[0]?.minPrice ?? null,
    priceRangeMaxCents: priceStats[0]?.maxPrice ?? null,
  };
}
