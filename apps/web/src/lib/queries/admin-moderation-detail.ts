/**
 * Admin Moderation Detail Query — split from admin-moderation.ts
 * Single listing deep-read for the /mod/listings/[id] detail page.
 */

import { db } from '@twicely/db';
import {
  listing, user, enforcementAction, listingImage,
  sellerProfile, sellerPerformance, category,
} from '@twicely/db/schema';
import { eq, count, and } from 'drizzle-orm';

export interface ModeratedListingDetail {
  id: string;
  title: string | null;
  description: string | null;
  priceCents: number | null;
  condition: string | null;
  enforcementState: string;
  status: string;
  tags: string[];
  createdAt: Date;
  activatedAt: Date | null;
  categoryName: string | null;
  ownerUserId: string;
  sellerName: string;
  performanceBand: string;
  averageRating: number | null;
  totalReviews: number;
  activeEnforcementCount: number;
  images: Array<{ url: string; position: number }>;
}

export async function getListingForModeration(listingId: string): Promise<ModeratedListingDetail | null> {
  const [row] = await db
    .select({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      condition: listing.condition,
      enforcementState: listing.enforcementState,
      status: listing.status,
      tags: listing.tags,
      createdAt: listing.createdAt,
      activatedAt: listing.activatedAt,
      ownerUserId: listing.ownerUserId,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!row) return null;

  const [ownerRow, images, catRow, spRow] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, row.ownerUserId)).limit(1),
    db.select({ url: listingImage.url, position: listingImage.position })
      .from(listingImage)
      .where(eq(listingImage.listingId, listingId))
      .orderBy(listingImage.position),
    row.categoryId
      ? db.select({ name: category.name }).from(category).where(eq(category.id, row.categoryId)).limit(1)
      : Promise.resolve([] as Array<{ name: string }>),
    db.select({
      performanceBand: sellerProfile.performanceBand,
      sellerProfileId: sellerProfile.id,
    })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, row.ownerUserId))
      .limit(1),
  ]);

  let averageRating: number | null = null;
  let totalReviews = 0;
  let activeEnforcementCount = 0;

  if (spRow[0]) {
    const [perfRow, enfCount] = await Promise.all([
      db.select({ averageRating: sellerPerformance.averageRating, totalReviews: sellerPerformance.totalReviews })
        .from(sellerPerformance)
        .where(eq(sellerPerformance.sellerProfileId, spRow[0].sellerProfileId))
        .limit(1),
      db.select({ count: count() })
        .from(enforcementAction)
        .where(and(eq(enforcementAction.userId, row.ownerUserId), eq(enforcementAction.status, 'ACTIVE'))),
    ]);
    averageRating = perfRow[0]?.averageRating ?? null;
    totalReviews = perfRow[0]?.totalReviews ?? 0;
    activeEnforcementCount = enfCount[0]?.count ?? 0;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    condition: row.condition,
    enforcementState: row.enforcementState,
    status: row.status,
    tags: row.tags,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    categoryName: catRow[0]?.name ?? null,
    ownerUserId: row.ownerUserId,
    sellerName: ownerRow[0]?.name ?? 'Unknown',
    performanceBand: spRow[0]?.performanceBand ?? 'EMERGING',
    averageRating,
    totalReviews,
    activeEnforcementCount,
    images,
  };
}
