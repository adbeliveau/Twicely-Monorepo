import { db } from '@twicely/db';
import { listing, listingImage, watchlistItem } from '@twicely/db/schema';
import { eq, and, desc, count, ilike, sql, SQL } from 'drizzle-orm';

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SOLD' | 'ENDED';

export interface SellerListingRow {
  id: string;
  title: string | null;
  slug: string | null;
  status: ListingStatus;
  priceCents: number | null;
  originalPriceCents: number | null;
  createdAt: Date;
  primaryImageUrl: string | null;
  watcherCount: number;
}

export interface SellerListingsResult {
  listings: SellerListingRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StatusCounts {
  all: number;
  ACTIVE: number;
  DRAFT: number;
  PAUSED: number;
  SOLD: number;
  ENDED: number;
}

const PAGE_SIZE = 25;

/**
 * Get paginated listings for a seller with optional status filter and search.
 */
export async function getSellerListings(
  userId: string,
  options: {
    status?: ListingStatus;
    search?: string;
    page?: number;
  } = {}
): Promise<SellerListingsResult> {
  const { status, search, page = 1 } = options;
  const offset = (page - 1) * PAGE_SIZE;

  // Build where clause
  const whereConditions: SQL[] = [eq(listing.ownerUserId, userId)];
  if (status) {
    whereConditions.push(eq(listing.status, status));
  }
  if (search && search.trim()) {
    whereConditions.push(ilike(listing.title, `%${search.trim()}%`));
  }

  const whereClause = and(...whereConditions);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(listing)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  // Watcher count subquery
  const watcherCountSq = db
    .select({ count: count() })
    .from(watchlistItem)
    .where(eq(watchlistItem.listingId, listing.id));

  // Get listings with primary image and watcher count
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      slug: listing.slug,
      status: listing.status,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      createdAt: listing.createdAt,
      primaryImageUrl: listingImage.url,
      watcherCount: sql<number>`(${watcherCountSq})`.as('watcher_count'),
    })
    .from(listing)
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(whereClause)
    .orderBy(desc(listing.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return {
    listings: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status as ListingStatus,
      priceCents: row.priceCents,
      originalPriceCents: row.originalPriceCents,
      createdAt: row.createdAt,
      primaryImageUrl: row.primaryImageUrl,
      watcherCount: Number(row.watcherCount) || 0,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

/**
 * Get counts per status for a seller's listings.
 */
export async function getSellerListingCounts(userId: string): Promise<StatusCounts> {
  const rows = await db
    .select({
      status: listing.status,
      count: count(),
    })
    .from(listing)
    .where(eq(listing.ownerUserId, userId))
    .groupBy(listing.status);

  const counts: StatusCounts = {
    all: 0,
    ACTIVE: 0,
    DRAFT: 0,
    PAUSED: 0,
    SOLD: 0,
    ENDED: 0,
  };

  for (const row of rows) {
    const status = row.status as ListingStatus;
    const countValue = Number(row.count);
    if (status in counts) {
      counts[status] = countValue;
    }
    counts.all += countValue;
  }

  return counts;
}

/**
 * Get listings by IDs, filtered by owner.
 * Used for bulk operations to validate ownership.
 */
export async function getListingsByIdsForOwner(
  listingIds: string[],
  userId: string
): Promise<Array<{ id: string; status: ListingStatus }>> {
  if (listingIds.length === 0) return [];

  const rows = await db
    .select({
      id: listing.id,
      status: listing.status,
    })
    .from(listing)
    .where(
      and(
        eq(listing.ownerUserId, userId),
        sql`${listing.id} = ANY(${listingIds})`
      )
    );

  return rows.map((row) => ({
    id: row.id,
    status: row.status as ListingStatus,
  }));
}
