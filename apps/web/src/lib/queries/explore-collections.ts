import { db } from '@twicely/db';
import {
  listing,
  listingImage,
  user,
  sellerProfile,
  sellerPerformance,
  curatedCollection,
  curatedCollectionItem,
} from '@twicely/db/schema';
import { eq, and, sql, isNotNull, asc } from 'drizzle-orm';
import { mapToListingCard } from './shared';
import { listingCardFields } from './explore-shared';
import type { ExploreCollection } from './explore-shared';

async function fetchCollectionListings(collectionId: string): Promise<ExploreCollection['listings']> {
  const items = await db
    .select({ ...listingCardFields })
    .from(curatedCollectionItem)
    .innerJoin(listing, eq(curatedCollectionItem.listingId, listing.id))
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(sellerProfile, eq(sellerProfile.userId, listing.ownerUserId))
    .leftJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
    .where(and(eq(curatedCollectionItem.collectionId, collectionId), eq(listing.status, 'ACTIVE')))
    .orderBy(asc(curatedCollectionItem.sortOrder))
    .limit(12);
  return items.map((row) => mapToListingCard(row));
}

/**
 * Staff Picks: editorially curated published collections.
 * Per Personalization Canonical §5.
 */
export async function getStaffPickCollections(): Promise<ExploreCollection[]> {
  const collections = await db
    .select({
      id: curatedCollection.id,
      title: curatedCollection.title,
      slug: curatedCollection.slug,
      description: curatedCollection.description,
      coverImageUrl: curatedCollection.coverImageUrl,
    })
    .from(curatedCollection)
    .where(
      and(
        eq(curatedCollection.isPublished, true),
        sql`(${curatedCollection.startDate} IS NULL OR ${curatedCollection.startDate} <= now())`,
        sql`(${curatedCollection.endDate} IS NULL OR ${curatedCollection.endDate} > now())`,
      ),
    )
    .orderBy(asc(curatedCollection.sortOrder));

  if (collections.length === 0) return [];

  return Promise.all(
    collections.map(async (col) => ({
      id: col.id,
      title: col.title,
      slug: col.slug,
      description: col.description ?? null,
      coverImageUrl: col.coverImageUrl ?? null,
      listings: await fetchCollectionListings(col.id),
    })),
  );
}

/**
 * Seasonal collections: time-based features with BOTH startDate and endDate set.
 * Per Personalization Canonical §5.
 */
export async function getSeasonalCollections(): Promise<ExploreCollection[]> {
  const collections = await db
    .select({
      id: curatedCollection.id,
      title: curatedCollection.title,
      slug: curatedCollection.slug,
      description: curatedCollection.description,
      coverImageUrl: curatedCollection.coverImageUrl,
    })
    .from(curatedCollection)
    .where(
      and(
        eq(curatedCollection.isPublished, true),
        isNotNull(curatedCollection.startDate),
        isNotNull(curatedCollection.endDate),
        sql`${curatedCollection.startDate} <= now()`,
        sql`${curatedCollection.endDate} > now()`,
      ),
    )
    .orderBy(asc(curatedCollection.sortOrder));

  if (collections.length === 0) return [];

  return Promise.all(
    collections.map(async (col) => ({
      id: col.id,
      title: col.title,
      slug: col.slug,
      description: col.description ?? null,
      coverImageUrl: col.coverImageUrl ?? null,
      listings: await fetchCollectionListings(col.id),
    })),
  );
}
