'use server';

import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';

/**
 * Get listing IDs that match a filter for bulk operations.
 */
export async function getListingsForBulkAction(
  filter: {
    status?: string;
    categoryId?: string;
    priceMin?: number;
    priceMax?: number;
  }
): Promise<{ success: boolean; listingIds?: string[]; error?: string }> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    let query = db
      .select({ id: listing.id })
      .from(listing)
      .where(eq(listing.ownerUserId, userId))
      .$dynamic();

    if (filter.status) {
      query = query.where(eq(listing.status, filter.status as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'SOLD'));
    }

    if (filter.categoryId) {
      query = query.where(eq(listing.categoryId, filter.categoryId));
    }

    if (filter.priceMin !== undefined) {
      query = query.where(sql`${listing.priceCents} >= ${filter.priceMin}`);
    }

    if (filter.priceMax !== undefined) {
      query = query.where(sql`${listing.priceCents} <= ${filter.priceMax}`);
    }

    const results = await query.limit(100);

    return {
      success: true,
      listingIds: results.map((r) => r.id),
    };
  } catch (error) {
    logger.error('Get listings for bulk action error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: 'Failed to fetch listings' };
  }
}
