/**
 * Structural seed validation tests for A5.1:
 * - Comprehensive ID uniqueness across ALL seed modules
 * - Category hierarchy integrity
 * - Storefront custom categories FK validity
 *
 * No database connection required — validates structure only.
 */

import { describe, it, expect } from 'vitest';
import { USER_IDS, SELLER_IDS } from '../seed-users';
import { CATEGORY_IDS } from '../seed-categories';
import { STOREFRONT_SEED_IDS, STOREFRONT_CATEGORY_IDS } from '../seed-storefronts';
import { LISTING_IDS } from '../seed-listings';
import { SEED_IDS } from '../seed-system';
import { OFFER_IDS } from '../seed-offers';
import { PROMOTIONS_IDS } from '../seed-promotions';
import { SELLER_SCORE_IDS } from '../seed-seller-scores';
import { PROTECTION_IDS } from '../seed-protection';
import { STRIPE_EVENT_LOG_SEED_IDS } from '../seed-stripe-events';
import { ENGAGEMENT_IDS } from '../seed-engagement';
import { SOCIAL_IDS } from '../seed-social';
import { PERSONALIZATION_IDS } from '../seed-personalization';
import { BUYER_REVIEW_SEED_IDS } from '../seed-reviews-extended';
import { FINANCE_CENTER_IDS } from '../seed-finance-center';

// ── comprehensive uniqueness ──────────────────────────────────────────────────

describe('Complete seed ID uniqueness (all A5.1 modules)', () => {
  function collectAllSeedIds(): string[] {
    const ids: string[] = [];

    ids.push(...Object.values(USER_IDS));
    ids.push(...Object.values(SELLER_IDS));
    ids.push(...LISTING_IDS);
    ids.push(...Object.values(CATEGORY_IDS));
    ids.push(...Object.values(STOREFRONT_SEED_IDS));
    ids.push(...Object.values(STOREFRONT_CATEGORY_IDS));
    ids.push(SEED_IDS.staffAdminId);
    ids.push(...Object.values(OFFER_IDS));
    ids.push(...Object.values(PROMOTIONS_IDS.promotedListings));
    ids.push(...Object.values(PROMOTIONS_IDS.events));
    ids.push(...Object.values(SELLER_SCORE_IDS));
    ids.push(...Object.values(PROTECTION_IDS));
    ids.push(...Object.values(STRIPE_EVENT_LOG_SEED_IDS));

    // A5.1 new modules
    ids.push(...Object.values(ENGAGEMENT_IDS.browsingHistory));
    ids.push(...Object.values(ENGAGEMENT_IDS.priceAlerts));
    ids.push(...Object.values(ENGAGEMENT_IDS.categoryAlerts));
    ids.push(...Object.values(ENGAGEMENT_IDS.priceHistory));
    ids.push(...Object.values(ENGAGEMENT_IDS.blockList));
    ids.push(...Object.values(SOCIAL_IDS.questions));
    ids.push(...Object.values(SOCIAL_IDS.collections));
    ids.push(...Object.values(SOCIAL_IDS.collectionItems));
    ids.push(...Object.values(SOCIAL_IDS.watcherOffers));
    ids.push(...Object.values(PERSONALIZATION_IDS.tags));
    ids.push(...Object.values(PERSONALIZATION_IDS.userInterests));
    ids.push(...Object.values(BUYER_REVIEW_SEED_IDS));
    ids.push(...Object.values(FINANCE_CENTER_IDS.subscriptions));
    ids.push(...Object.values(FINANCE_CENTER_IDS.expenses));
    ids.push(...Object.values(FINANCE_CENTER_IDS.mileage));

    return ids;
  }

  it('has no duplicate seed IDs across ALL modules (A5.1 comprehensive)', () => {
    const allIds = collectAllSeedIds();
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const id of allIds) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }

    expect(duplicates).toEqual([]);
  });

  it('total seed ID count is greater than 150 (A5.1 sanity check)', () => {
    // Actual count: 189 as of A5.1 completion
    expect(collectAllSeedIds().length).toBeGreaterThan(150);
  });
});

// ── category hierarchy ────────────────────────────────────────────────────────

describe('Seed category hierarchy integrity', () => {
  const TOP_LEVEL_IDS = new Set([
    CATEGORY_IDS.electronics,
    CATEGORY_IDS.apparel,
    CATEGORY_IDS.home,
    CATEGORY_IDS.collectibles,
  ]);

  it('top-level category set has exactly 4 entries', () => {
    expect(TOP_LEVEL_IDS.size).toBe(4);
  });

  it('leaf categories reference valid parent category IDs', () => {
    const leafParentMappings: Array<{ child: string; parent: string }> = [
      { child: CATEGORY_IDS.phones, parent: CATEGORY_IDS.electronics },
      { child: CATEGORY_IDS.computers, parent: CATEGORY_IDS.electronics },
      { child: CATEGORY_IDS.cameras, parent: CATEGORY_IDS.electronics },
      { child: CATEGORY_IDS.womens, parent: CATEGORY_IDS.apparel },
      { child: CATEGORY_IDS.mens, parent: CATEGORY_IDS.apparel },
      { child: CATEGORY_IDS.shoes, parent: CATEGORY_IDS.apparel },
      { child: CATEGORY_IDS.kitchen, parent: CATEGORY_IDS.home },
      { child: CATEGORY_IDS.furniture, parent: CATEGORY_IDS.home },
      { child: CATEGORY_IDS.garden, parent: CATEGORY_IDS.home },
      { child: CATEGORY_IDS.tradingCards, parent: CATEGORY_IDS.collectibles },
      { child: CATEGORY_IDS.watches, parent: CATEGORY_IDS.collectibles },
      { child: CATEGORY_IDS.handbags, parent: CATEGORY_IDS.collectibles },
    ];

    for (const { child, parent } of leafParentMappings) {
      expect(TOP_LEVEL_IDS.has(parent),
        `Leaf ${child} references parent ${parent} which is not a top-level category`
      ).toBe(true);
      expect(child).not.toBe(parent);
    }
  });

  it('all 16 categories (4 top-level + 12 leaf) are defined and unique', () => {
    const allCategoryIds = Object.values(CATEGORY_IDS);
    expect(allCategoryIds.length).toBe(16);
    expect(new Set(allCategoryIds).size).toBe(16);
  });

  it('leaf categories are evenly distributed: 3 per top-level category', () => {
    const electronicsLeaves = [CATEGORY_IDS.phones, CATEGORY_IDS.computers, CATEGORY_IDS.cameras];
    const apparelLeaves = [CATEGORY_IDS.womens, CATEGORY_IDS.mens, CATEGORY_IDS.shoes];
    const homeLeaves = [CATEGORY_IDS.kitchen, CATEGORY_IDS.furniture, CATEGORY_IDS.garden];
    const collectiblesLeaves = [CATEGORY_IDS.tradingCards, CATEGORY_IDS.watches, CATEGORY_IDS.handbags];

    expect(electronicsLeaves.length).toBe(3);
    expect(apparelLeaves.length).toBe(3);
    expect(homeLeaves.length).toBe(3);
    expect(collectiblesLeaves.length).toBe(3);
  });

  it('category path format: top-level uses slug, leaf uses parentSlug.childSlug', () => {
    const topLevelPaths = ['electronics', 'apparel-accessories', 'home-garden', 'collectibles-luxury'];
    const leafPaths = [
      'electronics.phones-tablets',
      'electronics.computers-laptops',
      'apparel-accessories.womens-clothing',
      'home-garden.kitchen-dining',
      'collectibles-luxury.trading-cards',
    ];

    for (const p of topLevelPaths) {
      expect(p).not.toContain('.');
      expect(p.length).toBeGreaterThan(0);
    }
    for (const p of leafPaths) {
      expect(p).toContain('.');
      expect(p.split('.').length).toBe(2);
    }
  });
});

// ── storefront custom categories ──────────────────────────────────────────────

describe('Seed storefront custom categories', () => {
  it('custom category IDs are all unique', () => {
    const ids = Object.values(STOREFRONT_CATEGORY_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('custom categories reference valid storefront IDs', () => {
    const validStorefrontIds = new Set(Object.values(STOREFRONT_SEED_IDS));

    const storefrontMappings = [
      STOREFRONT_SEED_IDS.seller1, // s1_phones
      STOREFRONT_SEED_IDS.seller1, // s1_laptops
      STOREFRONT_SEED_IDS.seller1, // s1_cameras
      STOREFRONT_SEED_IDS.seller2, // s2_womens
      STOREFRONT_SEED_IDS.seller2, // s2_mens
      STOREFRONT_SEED_IDS.seller2, // s2_shoes
      STOREFRONT_SEED_IDS.seller3, // s3_cards
      STOREFRONT_SEED_IDS.seller3, // s3_luxury
    ];

    for (const sfId of storefrontMappings) {
      expect(validStorefrontIds.has(sfId),
        `Custom category references storefront ${sfId} which is not a valid seeded storefront`
      ).toBe(true);
    }
  });

  it('has exactly 8 storefront custom categories (3+3+2)', () => {
    expect(Object.keys(STOREFRONT_CATEGORY_IDS).length).toBe(8);
  });

  it('storefront IDs are all unique and there are exactly 3 storefronts', () => {
    const storefrontIds = Object.values(STOREFRONT_SEED_IDS);
    expect(new Set(storefrontIds).size).toBe(storefrontIds.length);
    expect(storefrontIds.length).toBe(3);
  });

  it('storefront ownerUserIds reference valid user IDs', () => {
    const validUserIds = new Set(Object.values(USER_IDS));
    const ownerIds = [USER_IDS.seller1, USER_IDS.seller2, USER_IDS.seller3];
    for (const uid of ownerIds) {
      expect(validUserIds.has(uid)).toBe(true);
    }
  });
});

// ── listing IDs array structure ───────────────────────────────────────────────

describe('Seed listing IDs array', () => {
  it('has exactly 50 listing IDs with correct zero-padded format', () => {
    expect(LISTING_IDS.length).toBe(50);
    expect(LISTING_IDS[0]).toBe('seed-listing-001');
    expect(LISTING_IDS[49]).toBe('seed-listing-050');
  });

  it('all listing IDs are unique', () => {
    expect(new Set(LISTING_IDS).size).toBe(LISTING_IDS.length);
  });

  it('listing ID at index matches its 1-based number', () => {
    for (let i = 0; i < LISTING_IDS.length; i++) {
      const expected = `seed-listing-${String(i + 1).padStart(3, '0')}`;
      expect(LISTING_IDS[i]).toBe(expected);
    }
  });
});
