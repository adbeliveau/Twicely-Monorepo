import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { promotedListing, promotedListingEvent } from '../schema';
import { USER_IDS } from './seed-users';
import { LISTING_IDS } from './seed-listings';

// Hardcoded IDs for idempotency
const PROMOTED_LISTING_IDS = {
  macbook:  'seed-pl-001',
  sonyA7:   'seed-pl-002',
  rolex:    'seed-pl-003',
};

const PROMOTED_EVENT_IDS = {
  macbookImpression1: 'seed-ple-001',
  macbookImpression2: 'seed-ple-002',
  macbookClick:       'seed-ple-003',
  macbookSale:        'seed-ple-004',
  rolexImpression:    'seed-ple-005',
};

/**
 * Seed promoted listings and attribution events.
 * Depends on seedListings() and seedOrders() running first.
 */
export async function seedPromotions(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 3 promoted listings
  await db.insert(promotedListing).values([
    {
      // seller1: MacBook Pro listing — active, 10% boost
      id:            PROMOTED_LISTING_IDS.macbook,
      listingId:     LISTING_IDS[4]!,
      sellerId:      USER_IDS.seller1,
      boostPercent:  10,
      isActive:      true,
      impressions:   500,
      clicks:        25,
      sales:         2,
      totalFeeCents: 3200,
      startedAt:     daysAgo(14),
      createdAt:     daysAgo(14),
      updatedAt:     daysAgo(1),
    },
    {
      // seller1: Sony A7 IV listing — active, 15% boost
      id:            PROMOTED_LISTING_IDS.sonyA7,
      listingId:     LISTING_IDS[8]!,
      sellerId:      USER_IDS.seller1,
      boostPercent:  15,
      isActive:      true,
      impressions:   200,
      clicks:        10,
      sales:         0,
      totalFeeCents: 0,
      startedAt:     daysAgo(7),
      createdAt:     daysAgo(7),
      updatedAt:     daysAgo(1),
    },
    {
      // seller3: Rolex Submariner listing — ended, 20% boost
      id:            PROMOTED_LISTING_IDS.rolex,
      listingId:     LISTING_IDS[38]!,
      sellerId:      USER_IDS.seller3,
      boostPercent:  20,
      isActive:      false,
      impressions:   1000,
      clicks:        50,
      sales:         1,
      totalFeeCents: 23000,
      startedAt:     daysAgo(30),
      endedAt:       daysAgo(5),
      createdAt:     daysAgo(30),
      updatedAt:     daysAgo(5),
    },
  ]).onConflictDoNothing();

  // 5 attribution events
  await db.insert(promotedListingEvent).values([
    {
      id:                 PROMOTED_EVENT_IDS.macbookImpression1,
      promotedListingId:  PROMOTED_LISTING_IDS.macbook,
      eventType:          'IMPRESSION',
      attributionWindow:  7,
      createdAt:          daysAgo(10),
    },
    {
      id:                 PROMOTED_EVENT_IDS.macbookImpression2,
      promotedListingId:  PROMOTED_LISTING_IDS.macbook,
      eventType:          'IMPRESSION',
      attributionWindow:  7,
      createdAt:          daysAgo(5),
    },
    {
      id:                 PROMOTED_EVENT_IDS.macbookClick,
      promotedListingId:  PROMOTED_LISTING_IDS.macbook,
      eventType:          'CLICK',
      attributionWindow:  7,
      createdAt:          daysAgo(5),
    },
    {
      id:                 PROMOTED_EVENT_IDS.macbookSale,
      promotedListingId:  PROMOTED_LISTING_IDS.macbook,
      eventType:          'SALE',
      orderId:            'seed-order-001',
      feeCents:           1600,
      attributionWindow:  7,
      createdAt:          daysAgo(4),
    },
    {
      id:                 PROMOTED_EVENT_IDS.rolexImpression,
      promotedListingId:  PROMOTED_LISTING_IDS.rolex,
      eventType:          'IMPRESSION',
      attributionWindow:  7,
      createdAt:          daysAgo(20),
    },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const PROMOTIONS_IDS = {
  promotedListings: PROMOTED_LISTING_IDS,
  events:           PROMOTED_EVENT_IDS,
};
