/**
 * Typesense document indexing — upsert, delete, and bulk sync for listings.
 * Called on listing create/update/delete and by the full reindex job.
 */

import { getTypesenseClient } from './typesense-client';
import { LISTINGS_COLLECTION, listingsSchema } from './typesense-schema';

export interface ListingDocument {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  tags?: string[];
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  condition?: string;
  fulfillmentType?: string;
  authenticationStatus?: string;
  freeShipping: boolean;
  ownerUserId: string;
  storefrontCategoryId?: string;
  priceCents: number;
  originalPriceCents?: number;
  shippingCents?: number;
  availableQuantity?: number;
  sellerScore: number;
  sellerPerformanceBand?: string;
  sellerTotalReviews: number;
  sellerName?: string;
  sellerUsername?: string;
  sellerAvatarUrl?: string;
  sellerAverageRating?: number;
  sellerShowStars?: boolean;
  boostPercent?: number;
  activatedAt: number;
  createdAt: number;
  slug?: string;
  dealBadgeType?: string;
  primaryImageUrl?: string;
  primaryImageAlt?: string;
}

/** Ensure the listings collection exists. Creates it if missing. */
export async function ensureCollection(): Promise<void> {
  const client = getTypesenseClient();
  try {
    await client.collections(LISTINGS_COLLECTION).retrieve();
  } catch {
    await client.collections().create(listingsSchema);
  }
}

/** Upsert a single listing document. */
export async function upsertListingDocument(doc: ListingDocument): Promise<void> {
  const client = getTypesenseClient();
  await client.collections(LISTINGS_COLLECTION).documents().upsert(doc);
}

/** Delete a listing document by ID. */
export async function deleteListingDocument(listingId: string): Promise<void> {
  const client = getTypesenseClient();
  try {
    await client.collections(LISTINGS_COLLECTION).documents(listingId).delete();
  } catch {
    // Document may not exist — safe to ignore
  }
}

/** Bulk upsert an array of listing documents. */
export async function bulkUpsertListings(docs: ListingDocument[]): Promise<{ success: number; failed: number }> {
  if (docs.length === 0) return { success: 0, failed: 0 };

  const client = getTypesenseClient();
  const results = await client
    .collections(LISTINGS_COLLECTION)
    .documents()
    .import(docs, { action: 'upsert' });

  let success = 0;
  let failed = 0;
  for (const result of results) {
    if (result.success) success++;
    else failed++;
  }
  return { success, failed };
}

/** Delete all documents and recreate the collection (full reindex). */
export async function recreateCollection(): Promise<void> {
  const client = getTypesenseClient();
  try {
    await client.collections(LISTINGS_COLLECTION).delete();
  } catch {
    // Collection may not exist
  }
  await client.collections().create(listingsSchema);
}
