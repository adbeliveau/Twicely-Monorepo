import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { browsingHistory, priceAlert, categoryAlert, listingPriceHistory, buyerBlockList } from '../schema';
import { USER_IDS } from './seed-users';
import { LISTING_IDS } from './seed-listings';
import { SEED_IDS } from './seed-system';

// Hardcoded IDs for idempotency
const BROWSING_HISTORY_IDS = {
  b1_l1: 'seed-bh-001', b1_l2: 'seed-bh-002', b1_l3: 'seed-bh-003', b1_l4: 'seed-bh-004', b1_l5: 'seed-bh-005',
  b1_l6: 'seed-bh-006', b1_l7: 'seed-bh-007', b1_l8: 'seed-bh-008', b1_l9: 'seed-bh-009', b1_l10: 'seed-bh-010',
  b2_l1: 'seed-bh-011', b2_l2: 'seed-bh-012', b2_l3: 'seed-bh-013', b2_l4: 'seed-bh-014', b2_l5: 'seed-bh-015',
};

const PRICE_ALERT_IDS = {
  alert1: 'seed-pa-001',
  alert2: 'seed-pa-002',
};

const CATEGORY_ALERT_IDS = {
  alert1: 'seed-ca-001',
};

const PRICE_HISTORY_IDS = {
  ph1: 'seed-lph-001', ph2: 'seed-lph-002', ph3: 'seed-lph-003', ph4: 'seed-lph-004', ph5: 'seed-lph-005',
};

const BLOCK_LIST_IDS = {
  block1: 'seed-bbl-001',
};

export async function seedEngagement(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 1. Browsing History (15 entries: 10 for buyer1, 5 for buyer2)
  await db.insert(browsingHistory).values([
    // Buyer 1 - 10 entries across various listings
    { id: BROWSING_HISTORY_IDS.b1_l1, userId: USER_IDS.buyer1, listingId: LISTING_IDS[0]!, categoryId: SEED_IDS.categories.phones, sellerId: USER_IDS.seller1, viewCount: 3, totalDurationSec: 180, lastViewDurationSec: 45, didAddToWatchlist: true, sourceType: 'search', searchQuery: 'iphone 14', firstViewedAt: daysAgo(10), lastViewedAt: daysAgo(2) },
    { id: BROWSING_HISTORY_IDS.b1_l2, userId: USER_IDS.buyer1, listingId: LISTING_IDS[4]!, categoryId: SEED_IDS.categories.computers, sellerId: USER_IDS.seller1, viewCount: 5, totalDurationSec: 320, lastViewDurationSec: 90, didAddToCart: true, didMakeOffer: true, sourceType: 'category', firstViewedAt: daysAgo(8), lastViewedAt: daysAgo(1) },
    { id: BROWSING_HISTORY_IDS.b1_l3, userId: USER_IDS.buyer1, listingId: LISTING_IDS[8]!, categoryId: SEED_IDS.categories.cameras, sellerId: USER_IDS.seller1, viewCount: 2, totalDurationSec: 95, lastViewDurationSec: 50, sourceType: 'recommendation', firstViewedAt: daysAgo(7), lastViewedAt: daysAgo(5) },
    { id: BROWSING_HISTORY_IDS.b1_l4, userId: USER_IDS.buyer1, listingId: LISTING_IDS[20]!, categoryId: SEED_IDS.categories.womens, sellerId: USER_IDS.seller2, viewCount: 1, totalDurationSec: 30, lastViewDurationSec: 30, sourceType: 'search', searchQuery: 'lululemon leggings', firstViewedAt: daysAgo(6), lastViewedAt: daysAgo(6) },
    { id: BROWSING_HISTORY_IDS.b1_l5, userId: USER_IDS.buyer1, listingId: LISTING_IDS[27]!, categoryId: SEED_IDS.categories.shoes, sellerId: USER_IDS.seller2, viewCount: 4, totalDurationSec: 240, lastViewDurationSec: 60, didAddToWatchlist: true, didSetPriceAlert: true, sourceType: 'direct', firstViewedAt: daysAgo(5), lastViewedAt: daysAgo(1) },
    { id: BROWSING_HISTORY_IDS.b1_l6, userId: USER_IDS.buyer1, listingId: LISTING_IDS[35]!, categoryId: SEED_IDS.categories.tradingCards, sellerId: USER_IDS.seller3, viewCount: 6, totalDurationSec: 420, lastViewDurationSec: 120, didAddToWatchlist: true, sourceType: 'alert', firstViewedAt: daysAgo(12), lastViewedAt: daysAgo(3) },
    { id: BROWSING_HISTORY_IDS.b1_l7, userId: USER_IDS.buyer1, listingId: LISTING_IDS[38]!, categoryId: SEED_IDS.categories.watches, sellerId: USER_IDS.seller3, viewCount: 2, totalDurationSec: 150, lastViewDurationSec: 75, sourceType: 'category', firstViewedAt: daysAgo(4), lastViewedAt: daysAgo(2) },
    { id: BROWSING_HISTORY_IDS.b1_l8, userId: USER_IDS.buyer1, listingId: LISTING_IDS[42]!, categoryId: SEED_IDS.categories.handbags, sellerId: USER_IDS.seller3, viewCount: 1, totalDurationSec: 25, lastViewDurationSec: 25, sourceType: 'recommendation', firstViewedAt: daysAgo(3), lastViewedAt: daysAgo(3) },
    { id: BROWSING_HISTORY_IDS.b1_l9, userId: USER_IDS.buyer1, listingId: LISTING_IDS[10]!, categoryId: SEED_IDS.categories.cameras, sellerId: USER_IDS.seller1, viewCount: 3, totalDurationSec: 180, lastViewDurationSec: 60, sourceType: 'search', searchQuery: 'fujifilm x-t5', firstViewedAt: daysAgo(9), lastViewedAt: daysAgo(4) },
    { id: BROWSING_HISTORY_IDS.b1_l10, userId: USER_IDS.buyer1, listingId: LISTING_IDS[45]!, categoryId: SEED_IDS.categories.kitchen, sellerId: USER_IDS.seller3, viewCount: 2, totalDurationSec: 90, lastViewDurationSec: 45, didPurchase: true, sourceType: 'direct', firstViewedAt: daysAgo(14), lastViewedAt: daysAgo(10) },
    // Buyer 2 - 5 entries
    { id: BROWSING_HISTORY_IDS.b2_l1, userId: USER_IDS.buyer2, listingId: LISTING_IDS[1]!, categoryId: SEED_IDS.categories.phones, sellerId: USER_IDS.seller1, viewCount: 2, totalDurationSec: 120, lastViewDurationSec: 60, didAddToWatchlist: true, sourceType: 'search', searchQuery: 'samsung galaxy', firstViewedAt: daysAgo(7), lastViewedAt: daysAgo(3) },
    { id: BROWSING_HISTORY_IDS.b2_l2, userId: USER_IDS.buyer2, listingId: LISTING_IDS[22]!, categoryId: SEED_IDS.categories.womens, sellerId: USER_IDS.seller2, viewCount: 1, totalDurationSec: 45, lastViewDurationSec: 45, sourceType: 'category', firstViewedAt: daysAgo(5), lastViewedAt: daysAgo(5) },
    { id: BROWSING_HISTORY_IDS.b2_l3, userId: USER_IDS.buyer2, listingId: LISTING_IDS[35]!, categoryId: SEED_IDS.categories.tradingCards, sellerId: USER_IDS.seller3, viewCount: 8, totalDurationSec: 600, lastViewDurationSec: 180, didAddToCart: true, didPurchase: true, sourceType: 'search', searchQuery: 'pokemon charizard', firstViewedAt: daysAgo(10), lastViewedAt: daysAgo(8) },
    { id: BROWSING_HISTORY_IDS.b2_l4, userId: USER_IDS.buyer2, listingId: LISTING_IDS[39]!, categoryId: SEED_IDS.categories.watches, sellerId: USER_IDS.seller3, viewCount: 3, totalDurationSec: 200, lastViewDurationSec: 70, didAddToWatchlist: true, sourceType: 'recommendation', firstViewedAt: daysAgo(6), lastViewedAt: daysAgo(2) },
    { id: BROWSING_HISTORY_IDS.b2_l5, userId: USER_IDS.buyer2, listingId: LISTING_IDS[24]!, categoryId: SEED_IDS.categories.mens, sellerId: USER_IDS.seller2, viewCount: 1, totalDurationSec: 35, lastViewDurationSec: 35, sourceType: 'direct', firstViewedAt: daysAgo(4), lastViewedAt: daysAgo(4) },
  ]).onConflictDoNothing();

  // 2. Price Alerts (2 for buyer1)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(priceAlert).values([
    { id: PRICE_ALERT_IDS.alert1, userId: USER_IDS.buyer1, listingId: LISTING_IDS[4]!, alertType: 'ANY_DROP', isActive: true, expiresAt: thirtyDaysFromNow, createdAt: daysAgo(5) },
    { id: PRICE_ALERT_IDS.alert2, userId: USER_IDS.buyer1, listingId: LISTING_IDS[27]!, alertType: 'TARGET_PRICE', targetPriceCents: 18000, isActive: true, expiresAt: thirtyDaysFromNow, createdAt: daysAgo(3) },
  ]).onConflictDoNothing();

  // 3. Category Alert (1 for buyer1)
  await db.insert(categoryAlert).values([
    { id: CATEGORY_ALERT_IDS.alert1, userId: USER_IDS.buyer1, categoryId: SEED_IDS.categories.tradingCards, filtersJson: { condition: ['LIKE_NEW', 'VERY_GOOD'], maxPriceCents: 50000 }, isActive: true, expiresAt: thirtyDaysFromNow, createdAt: daysAgo(7) },
  ]).onConflictDoNothing();

  // 4. Listing Price History (5 entries showing price drops) — canonical §27.1 columns
  await db.insert(listingPriceHistory).values([
    { id: PRICE_HISTORY_IDS.ph1, listingId: LISTING_IDS[4]!, priceCents: 159900, previousCents: null, changeReason: 'MANUAL', createdAt: daysAgo(30) },
    { id: PRICE_HISTORY_IDS.ph2, listingId: LISTING_IDS[8]!, priceCents: 199900, previousCents: 219900, changeReason: 'MANUAL', createdAt: daysAgo(14) },
    { id: PRICE_HISTORY_IDS.ph3, listingId: LISTING_IDS[22]!, priceCents: 9500, previousCents: 11500, changeReason: 'PROMOTION', createdAt: daysAgo(7) },
    { id: PRICE_HISTORY_IDS.ph4, listingId: LISTING_IDS[27]!, priceCents: 22500, previousCents: 24500, changeReason: 'MANUAL', createdAt: daysAgo(5) },
    { id: PRICE_HISTORY_IDS.ph5, listingId: LISTING_IDS[35]!, priceCents: 45000, previousCents: 52000, changeReason: 'MANUAL', createdAt: daysAgo(10) },
  ]).onConflictDoNothing();

  // 5. Buyer Block List (seller1 blocks buyer3)
  await db.insert(buyerBlockList).values([
    { id: BLOCK_LIST_IDS.block1, blockerId: USER_IDS.seller1, blockedId: USER_IDS.buyer3, reason: 'Multiple lowball offers', createdAt: daysAgo(20) },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const ENGAGEMENT_IDS = {
  browsingHistory: BROWSING_HISTORY_IDS,
  priceAlerts: PRICE_ALERT_IDS,
  categoryAlerts: CATEGORY_ALERT_IDS,
  priceHistory: PRICE_HISTORY_IDS,
  blockList: BLOCK_LIST_IDS,
};
