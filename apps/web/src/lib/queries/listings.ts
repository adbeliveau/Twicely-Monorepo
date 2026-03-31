import { db } from '@twicely/db';
import { listing, listingImage, user, sellerProfile, category, sellerPerformance } from '@twicely/db/schema';
import { eq, and, ne, gte, lte, desc, asc, inArray, sql } from 'drizzle-orm';
import type { ListingDetailData, ListingCardData } from '@/types/listings';
import { mapToListingCard } from '@/lib/queries/shared';

type ListingStatus = 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'PAUSED' | 'SOLD' | 'ENDED' | 'REMOVED';

/**
 * Get full listing detail by slug.
 * Returns ACTIVE, SOLD, or ENDED listings (SOLD/ENDED show "no longer available" in UI).
 */
export async function getListingBySlug(slug: string): Promise<ListingDetailData | null> {
  const validStatuses: ListingStatus[] = ['ACTIVE', 'RESERVED', 'SOLD', 'ENDED'];

  const rows = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      condition: listing.condition,
      brand: listing.brand,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      allowOffers: listing.allowOffers,
      autoAcceptOfferCents: listing.autoAcceptOfferCents,
      autoDeclineOfferCents: listing.autoDeclineOfferCents,
      quantity: listing.quantity,
      availableQuantity: listing.availableQuantity,
      tags: listing.tags,
      attributesJson: listing.attributesJson,
      status: listing.status,
      fulfillmentType: listing.fulfillmentType,
      localHandlingFlags: listing.localHandlingFlags,
      activatedAt: listing.activatedAt,
      createdAt: listing.createdAt,
      ownerUserId: listing.ownerUserId,
      categoryId: listing.categoryId,
      videoUrl: listing.videoUrl,
      videoThumbUrl: listing.videoThumbUrl,
      videoDurationSeconds: listing.videoDurationSeconds,
      // User fields
      userName: user.name,
      userUsername: user.username,
      userAvatarUrl: user.avatarUrl,
      userCreatedAt: user.createdAt,
      // Seller profile fields
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
      performanceBand: sellerProfile.performanceBand,
      // Seller performance fields
      averageRating: sellerPerformance.averageRating,
      totalReviews: sellerPerformance.totalReviews,
      // Category fields
      categoryName: category.name,
      categorySlug: category.slug,
      categoryParentId: category.parentId,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .leftJoin(category, eq(listing.categoryId, category.id))
    .where(and(eq(listing.slug, slug), inArray(listing.status, validStatuses)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Get all images
  const images = await db
    .select({
      id: listingImage.id,
      url: listingImage.url,
      altText: listingImage.altText,
      position: listingImage.position,
    })
    .from(listingImage)
    .where(eq(listingImage.listingId, row.id))
    .orderBy(asc(listingImage.position));

  // Get parent category if exists
  let parentCategory: { id: string; name: string; slug: string } | null = null;
  if (row.categoryParentId) {
    const parentRows = await db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })
      .from(category)
      .where(eq(category.id, row.categoryParentId))
      .limit(1);
    parentCategory = parentRows[0] ?? null;
  }

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title ?? '',
    description: row.description ?? '',
    priceCents: row.priceCents ?? 0,
    originalPriceCents: row.originalPriceCents,
    condition: row.condition ?? 'GOOD',
    brand: row.brand,
    freeShipping: row.freeShipping,
    shippingCents: row.shippingCents ?? 0,
    allowOffers: row.allowOffers,
    autoAcceptOfferCents: row.autoAcceptOfferCents,
    autoDeclineOfferCents: row.autoDeclineOfferCents,
    quantity: row.quantity,
    availableQuantity: row.availableQuantity,
    tags: row.tags ?? [],
    attributesJson: (row.attributesJson as Record<string, unknown>) ?? {},
    status: row.status,
    fulfillmentType: row.fulfillmentType,
    localHandlingFlags: row.localHandlingFlags ?? [],
    activatedAt: row.activatedAt,
    createdAt: row.createdAt,
    images,
    videoUrl: row.videoUrl,
    videoThumbUrl: row.videoThumbUrl,
    videoDurationSeconds: row.videoDurationSeconds,
    seller: {
      userId: row.ownerUserId,
      displayName: row.userName ?? 'Unknown Seller',
      username: row.userUsername ?? '',
      avatarUrl: row.userAvatarUrl,
      storeName: row.storeName,
      storeSlug: row.storeSlug,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews ?? 0,
      memberSince: row.userCreatedAt ?? row.createdAt,
      performanceBand: row.performanceBand ?? 'EMERGING',
    },
    category: row.categoryId
      ? {
          id: row.categoryId,
          name: row.categoryName ?? '',
          slug: row.categorySlug ?? '',
          parent: parentCategory,
        }
      : null,
  };
}


/**
 * Get similar listings (same category, similar price, exclude current listing).
 */
export async function getSimilarListings(
  listingId: string,
  categoryId: string,
  priceCents: number,
  limit: number = 6
): Promise<ListingCardData[]> {
  const minPrice = Math.floor(priceCents * 0.5);
  const maxPrice = Math.floor(priceCents * 1.5);

  const rows = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      condition: listing.condition,
      brand: listing.brand,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      primaryImageUrl: listingImage.url,
      primaryImageAlt: listingImage.altText,
      sellerName: user.name,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerShowStars: sellerPerformance.showStars,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(
      and(
        eq(listing.status, 'ACTIVE'),
        eq(listing.categoryId, categoryId),
        ne(listing.id, listingId),
        gte(listing.priceCents, minPrice),
        lte(listing.priceCents, maxPrice)
      )
    )
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map(mapToListingCard);
}

/**
 * Get more listings from the same seller (exclude current listing).
 */
export async function getSellerListings(
  sellerUserId: string,
  excludeListingId: string,
  limit: number = 6
): Promise<ListingCardData[]> {
  const rows = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      originalPriceCents: listing.originalPriceCents,
      condition: listing.condition,
      brand: listing.brand,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      primaryImageUrl: listingImage.url,
      primaryImageAlt: listingImage.altText,
      sellerName: user.name,
      sellerUsername: user.username,
      sellerAvatarUrl: user.avatarUrl,
      sellerAverageRating: sellerPerformance.averageRating,
      sellerTotalReviews: sellerPerformance.totalReviews,
      sellerShowStars: sellerPerformance.showStars,
    })
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(listing.ownerUserId, sellerProfile.userId))
    .leftJoin(sellerPerformance, eq(sellerProfile.id, sellerPerformance.sellerProfileId))
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(
      and(
        eq(listing.status, 'ACTIVE'),
        eq(listing.ownerUserId, sellerUserId),
        ne(listing.id, excludeListingId)
      )
    )
    .orderBy(desc(listing.createdAt))
    .limit(limit);

  return rows.map(mapToListingCard);
}
