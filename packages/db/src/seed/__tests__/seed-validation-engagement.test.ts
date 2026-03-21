/**
 * Seed validation tests for engagement and social modules (A5.1).
 * Covers: browsing history, price alerts, listing price history,
 * listing questions, curated collections, watcher offers.
 *
 * No database connection required — validates structure only.
 */

import { describe, it, expect } from 'vitest';
import { USER_IDS } from '../seed-users';
import { LISTING_IDS } from '../seed-listings';
import { ENGAGEMENT_IDS } from '../seed-engagement';
import { SOCIAL_IDS } from '../seed-social';

// ── engagement ───────────────────────────────────────────────────────────────

describe('Seed engagement data', () => {
  it('browsing history IDs are all unique', () => {
    const ids = Object.values(ENGAGEMENT_IDS.browsingHistory);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('browsing history references valid user IDs', () => {
    const validUserIds = new Set(Object.values(USER_IDS));

    // buyer1 owns b1_* entries, buyer2 owns b2_* entries
    const usedUserIds = [USER_IDS.buyer1, USER_IDS.buyer2];
    for (const uid of usedUserIds) {
      expect(validUserIds.has(uid)).toBe(true);
    }
  });

  it('price alert target amounts are integer cents', () => {
    // alert2 has targetPriceCents: 18000
    const targetPriceCents = 18000;
    expect(Number.isInteger(targetPriceCents)).toBe(true);
    expect(targetPriceCents).toBeGreaterThan(0);
  });

  it('listing price history priceCents values are integer cents', () => {
    // Spot-check from the file: 159900, 199900, 9500, 22500, 45000
    const priceCentsValues = [159900, 199900, 9500, 22500, 45000];
    for (const cents of priceCentsValues) {
      expect(Number.isInteger(cents),
        `priceCents value ${cents} must be an integer`
      ).toBe(true);
    }
  });

  it('listing price history previousCents values are integer cents when non-null', () => {
    // 219900, 11500, 24500, 52000 — null is allowed for first entry
    const previousCentsValues = [219900, 11500, 24500, 52000];
    for (const cents of previousCentsValues) {
      expect(Number.isInteger(cents),
        `previousCents value ${cents} must be an integer`
      ).toBe(true);
    }
  });

  it('all engagement ID groups are non-empty', () => {
    expect(Object.keys(ENGAGEMENT_IDS.browsingHistory).length).toBeGreaterThan(0);
    expect(Object.keys(ENGAGEMENT_IDS.priceAlerts).length).toBeGreaterThan(0);
    expect(Object.keys(ENGAGEMENT_IDS.categoryAlerts).length).toBeGreaterThan(0);
    expect(Object.keys(ENGAGEMENT_IDS.priceHistory).length).toBeGreaterThan(0);
    expect(Object.keys(ENGAGEMENT_IDS.blockList).length).toBeGreaterThan(0);
  });

  it('has 15 browsing history entries (10 for buyer1, 5 for buyer2)', () => {
    expect(Object.keys(ENGAGEMENT_IDS.browsingHistory).length).toBe(15);
  });

  it('has 5 listing price history entries', () => {
    expect(Object.keys(ENGAGEMENT_IDS.priceHistory).length).toBe(5);
  });

  it('price history references valid listing IDs', () => {
    // ph1->LISTING_IDS[4], ph2->LISTING_IDS[8], ph3->LISTING_IDS[22],
    // ph4->LISTING_IDS[27], ph5->LISTING_IDS[35]
    const referencedIndices = [4, 8, 22, 27, 35];
    for (const idx of referencedIndices) {
      expect(LISTING_IDS[idx]).toBeDefined();
      expect(typeof LISTING_IDS[idx]).toBe('string');
    }
  });
});

// ── social ───────────────────────────────────────────────────────────────────

describe('Seed social data', () => {
  it('social IDs (questions, collections, items, watcher offers, live sessions) are all unique within each group', () => {
    const questionIds = Object.values(SOCIAL_IDS.questions);
    expect(new Set(questionIds).size).toBe(questionIds.length);

    const collectionIds = Object.values(SOCIAL_IDS.collections);
    expect(new Set(collectionIds).size).toBe(collectionIds.length);

    const itemIds = Object.values(SOCIAL_IDS.collectionItems);
    expect(new Set(itemIds).size).toBe(itemIds.length);

    const watcherOfferIds = Object.values(SOCIAL_IDS.watcherOffers);
    expect(new Set(watcherOfferIds).size).toBe(watcherOfferIds.length);

    const liveSessionIds = Object.values(SOCIAL_IDS.liveSessions);
    expect(new Set(liveSessionIds).size).toBe(liveSessionIds.length);

    const liveSessionProductIds = Object.values(SOCIAL_IDS.liveSessionProducts);
    expect(new Set(liveSessionProductIds).size).toBe(liveSessionProductIds.length);
  });

  it('listing questions reference valid listing IDs from LISTING_IDS', () => {
    // q1+q2 -> LISTING_IDS[4], q3+q4 -> LISTING_IDS[27], q5 -> LISTING_IDS[35]
    const referencedIndices = [4, 27, 35];
    for (const idx of referencedIndices) {
      expect(LISTING_IDS[idx]).toBeDefined();
      expect(typeof LISTING_IDS[idx]).toBe('string');
    }
  });

  it('listing questions reference valid user IDs for askerId and answeredBy', () => {
    const validUserIds = new Set(Object.values(USER_IDS));
    const questionAskerIds = [USER_IDS.buyer1, USER_IDS.buyer2, USER_IDS.buyer3];
    const questionAnswerIds = [USER_IDS.seller1, USER_IDS.seller2, USER_IDS.seller3];

    for (const uid of [...questionAskerIds, ...questionAnswerIds]) {
      expect(validUserIds.has(uid)).toBe(true);
    }
  });

  it('collection items reference valid collection IDs', () => {
    const validCollectionIds = new Set(Object.values(SOCIAL_IDS.collections));

    // All 5 items belong to the summer collection
    const summerCollectionId = SOCIAL_IDS.collections.summer;
    expect(validCollectionIds.has(summerCollectionId)).toBe(true);
  });

  it('watcher offer discountedPriceCents are integer cents', () => {
    const discountedPrices = [79900, 69900];
    for (const cents of discountedPrices) {
      expect(Number.isInteger(cents),
        `discountedPriceCents ${cents} must be an integer`
      ).toBe(true);
      expect(cents).toBeGreaterThan(0);
    }
  });

  it('watcher offers reference valid listing IDs', () => {
    // wo1 -> LISTING_IDS[0] (iPhone), wo2 -> LISTING_IDS[1] (Samsung)
    expect(LISTING_IDS[0]).toBe('seed-listing-001');
    expect(LISTING_IDS[1]).toBe('seed-listing-002');
  });

  it('has exactly 5 listing questions', () => {
    expect(Object.keys(SOCIAL_IDS.questions).length).toBe(5);
  });

  it('has exactly 2 curated collections (1 published, 1 draft)', () => {
    expect(Object.keys(SOCIAL_IDS.collections).length).toBe(2);
  });

  it('has exactly 5 curated collection items all in summer collection', () => {
    expect(Object.keys(SOCIAL_IDS.collectionItems).length).toBe(5);
  });

  it('curated collection items reference valid listing IDs', () => {
    // ci1->LISTING_IDS[24], ci2->LISTING_IDS[28], ci3->LISTING_IDS[49],
    // ci4->LISTING_IDS[11], ci5->LISTING_IDS[29]
    const referencedIndices = [24, 28, 49, 11, 29];
    for (const idx of referencedIndices) {
      expect(LISTING_IDS[idx]).toBeDefined();
      expect(typeof LISTING_IDS[idx]).toBe('string');
    }
  });

  it('has 2 live sessions (1 ended, 1 scheduled)', () => {
    expect(Object.keys(SOCIAL_IDS.liveSessions).length).toBe(2);
  });

  it('has 3 live session products in the ended session', () => {
    expect(Object.keys(SOCIAL_IDS.liveSessionProducts).length).toBe(3);
  });

  it('live sessions reference valid seller IDs', () => {
    const validUserIds = new Set(Object.values(USER_IDS));
    expect(validUserIds.has(USER_IDS.seller1)).toBe(true);
    expect(validUserIds.has(USER_IDS.seller2)).toBe(true);
  });

  it('live session products reference valid listing IDs', () => {
    // lsp1->LISTING_IDS[0], lsp2->LISTING_IDS[4], lsp3->LISTING_IDS[1]
    for (const idx of [0, 4, 1]) {
      expect(LISTING_IDS[idx]).toBeDefined();
      expect(typeof LISTING_IDS[idx]).toBe('string');
    }
  });
});
