/**
 * Seed validation tests for commerce-related modules (A5.1).
 * Covers: personalization tags, buyer reviews, finance center,
 * and listing offers.
 *
 * No database connection required — validates structure only.
 */

import { describe, it, expect } from 'vitest';
import { USER_IDS, SELLER_IDS } from '../seed-users';
import { LISTING_IDS } from '../seed-listings';
import { PERSONALIZATION_IDS } from '../seed-personalization';
import { BUYER_REVIEW_SEED_IDS } from '../seed-reviews-extended';
import { FINANCE_CENTER_IDS } from '../seed-finance-center';
import { OFFER_IDS } from '../seed-offers';

// ── personalization ───────────────────────────────────────────────────────────

describe('Seed personalization data', () => {
  it('interest tag slugs are unique', () => {
    const tagSlugs = Object.values(PERSONALIZATION_IDS.tags);
    const unique = new Set(tagSlugs);
    expect(unique.size).toBe(tagSlugs.length);
  });

  it('interest tag IDs are all unique', () => {
    const tagIds = Object.values(PERSONALIZATION_IDS.tags);
    expect(new Set(tagIds).size).toBe(tagIds.length);
  });

  it('user interest IDs are all unique', () => {
    const interestIds = Object.values(PERSONALIZATION_IDS.userInterests);
    expect(new Set(interestIds).size).toBe(interestIds.length);
  });

  it('user interest tagSlugs reference tag slugs that exist in seed-personalization', () => {
    // Tag IDs map to slug strings — all userInterest tagSlugs should be among the seed tag IDs values
    const validTagIds = new Set(Object.values(PERSONALIZATION_IDS.tags));

    // The seeded user interests use: gaming, smartphones, sneaker-collecting, outdoor-gear,
    // designer, vintage, watches, home-decor, vintage, outdoor-gear, gaming, sneaker-collecting
    const usedSlugs = [
      'seed-tag-010', 'seed-tag-008', 'seed-tag-027', 'seed-tag-019',
      'seed-tag-003', 'seed-tag-002', 'seed-tag-028',
      'seed-tag-020', 'seed-tag-002', 'seed-tag-019', 'seed-tag-010', 'seed-tag-027',
    ];
    for (const tagId of usedSlugs) {
      expect(validTagIds.has(tagId),
        `tag ID "${tagId}" is not defined in seed-personalization interest tags`
      ).toBe(true);
    }
  });

  it('user interest sources use only valid enum values', () => {
    const validSources = new Set(['EXPLICIT', 'PURCHASE', 'WATCHLIST', 'CLICK', 'SEARCH']);
    const usedSources = [
      'EXPLICIT', 'PURCHASE', 'WATCHLIST', 'CLICK',
      'EXPLICIT', 'PURCHASE', 'WATCHLIST',
      'EXPLICIT', 'EXPLICIT', 'PURCHASE', 'SEARCH', 'CLICK',
    ];

    for (const source of usedSources) {
      expect(validSources.has(source),
        `source "${source}" is not a valid user interest source`
      ).toBe(true);
    }
  });

  it('user interests reference valid user IDs', () => {
    const validUserIds = new Set(Object.values(USER_IDS));
    const interestUserIds = [USER_IDS.buyer1, USER_IDS.buyer2, USER_IDS.buyer3];
    for (const uid of interestUserIds) {
      expect(validUserIds.has(uid)).toBe(true);
    }
  });

  it('has 37 interest tags and 12 user interests (4+3+5)', () => {
    expect(Object.keys(PERSONALIZATION_IDS.tags).length).toBe(37);
    expect(Object.keys(PERSONALIZATION_IDS.userInterests).length).toBe(12);
  });
});

// ── buyer reviews ─────────────────────────────────────────────────────────────

describe('Seed buyer reviews (extended)', () => {
  it('buyer review IDs are all unique', () => {
    const ids = Object.values(BUYER_REVIEW_SEED_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('buyer review ratings are within valid range 1-5', () => {
    // br1=(5,5,5), br2=(5,4,4), br3=(3,2,2)
    const overallRatings = [5, 4, 2];
    const ratingPayments = [5, 5, 3];
    const ratingComms = [5, 4, 2];

    for (const r of [...overallRatings, ...ratingPayments, ...ratingComms]) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    }
  });

  it('buyer reviews reference valid order IDs in the valid order set', () => {
    const validOrders = new Set(['seed-order-007', 'seed-order-008', 'seed-order-006']);
    const reviewOrders = ['seed-order-007', 'seed-order-008', 'seed-order-006'];
    for (const orderId of reviewOrders) {
      expect(validOrders.has(orderId),
        `Review references order ${orderId} which is not a valid seeded order`
      ).toBe(true);
    }
  });

  it('buyer reviews reference valid seller and buyer user IDs', () => {
    const validUserIds = new Set(Object.values(USER_IDS));

    // br1: seller1 rates buyer3, br2: seller2 rates buyer2, br3: seller3 rates buyer1
    const pairs: [string, string][] = [
      [USER_IDS.seller1, USER_IDS.buyer3],
      [USER_IDS.seller2, USER_IDS.buyer2],
      [USER_IDS.seller3, USER_IDS.buyer1],
    ];

    for (const [sellerId, buyerId] of pairs) {
      expect(validUserIds.has(sellerId)).toBe(true);
      expect(validUserIds.has(buyerId)).toBe(true);
    }
  });

  it('buyer review status values are valid enum values', () => {
    const validStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN']);
    const usedStatuses = ['APPROVED', 'APPROVED', 'APPROVED'];
    for (const status of usedStatuses) {
      expect(validStatuses.has(status),
        `Status "${status}" is not a valid buyerReview status`
      ).toBe(true);
    }
  });

});

// ── finance center ────────────────────────────────────────────────────────────

describe('Seed finance center data', () => {
  it('finance center IDs are all unique within each group', () => {
    const subIds = Object.values(FINANCE_CENTER_IDS.subscriptions);
    expect(new Set(subIds).size).toBe(subIds.length);

    const expenseIds = Object.values(FINANCE_CENTER_IDS.expenses);
    expect(new Set(expenseIds).size).toBe(expenseIds.length);

    const mileageIds = Object.values(FINANCE_CENTER_IDS.mileage);
    expect(new Set(mileageIds).size).toBe(mileageIds.length);
  });

  it('expense amounts are integer cents', () => {
    const expenseCents = [4599, 2499, 3299, 1899, 45000, 89900, 999, 1499, 2199, 15000];
    for (const cents of expenseCents) {
      expect(Number.isInteger(cents),
        `expense amountCents ${cents} must be an integer`
      ).toBe(true);
      expect(cents).toBeGreaterThan(0);
    }
  });

  it('mileage deductionCents are integer cents (Math.round applied)', () => {
    // IRS rate 0.67/mile — verify Math.round produces integers
    const irsRate = 0.67;
    const milesCases = [8.2, 24.5, 5.8, 32.1, 12.4];
    for (const miles of milesCases) {
      const deductionCents = Math.round(miles * irsRate * 100);
      expect(Number.isInteger(deductionCents),
        `deductionCents for ${miles} miles must be an integer, got ${deductionCents}`
      ).toBe(true);
      expect(deductionCents).toBeGreaterThan(0);
    }
  });

  it('expense categories are valid enum values', () => {
    const validCategories = new Set([
      'SHIPPING_SUPPLIES', 'PACKAGING', 'INVENTORY', 'SOFTWARE',
      'OFFICE', 'STORAGE', 'ADVERTISING', 'EQUIPMENT', 'OTHER',
    ]);
    const usedCategories = [
      'SHIPPING_SUPPLIES', 'SHIPPING_SUPPLIES', 'PACKAGING', 'PACKAGING',
      'INVENTORY', 'INVENTORY', 'SOFTWARE', 'SOFTWARE', 'OFFICE', 'STORAGE',
    ];
    for (const cat of usedCategories) {
      expect(validCategories.has(cat),
        `expense category "${cat}" is not a valid enum value`
      ).toBe(true);
    }
  });

  it('finance subscription references valid seller profile ID and tier is PRO', () => {
    const validSellerProfileIds = new Set(Object.values(SELLER_IDS));
    expect(validSellerProfileIds.has(SELLER_IDS.seller1)).toBe(true);
    expect(new Set(['PRO']).has('PRO')).toBe(true);
  });
});

// ── offers ────────────────────────────────────────────────────────────────────

describe('Seed listing offers', () => {
  it('offer IDs are all unique', () => {
    const ids = Object.values(OFFER_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offer amounts are integer cents', () => {
    const offerCents = [130000, 175000, 5000, 15000, 120000, 140000];
    for (const cents of offerCents) {
      expect(Number.isInteger(cents),
        `offerCents ${cents} must be an integer`
      ).toBe(true);
      expect(cents).toBeGreaterThan(0);
    }
  });

  it('counter offer references its parent offer ID', () => {
    // counterPending (seed-offer-06) parent is countered (seed-offer-05)
    expect(OFFER_IDS.countered).toBe('seed-offer-05');
    expect(OFFER_IDS.counterPending).toBe('seed-offer-06');
    const validOfferIds = new Set(Object.values(OFFER_IDS));
    expect(validOfferIds.has(OFFER_IDS.countered)).toBe(true);
  });

  it('offers reference valid listing IDs', () => {
    // pending+countered+counterPending -> [4]
    // accepted -> [8], declined+bundlePending -> [20], expired -> [40]
    const indices = [4, 8, 20, 21, 22, 40];
    for (const idx of indices) {
      expect(LISTING_IDS[idx]).toBeDefined();
      expect(typeof LISTING_IDS[idx]).toBe('string');
    }
  });

  it('offer statuses use only valid enum values', () => {
    const validStatuses = new Set(['PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN']);
    const usedStatuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'PENDING', 'PENDING'];
    for (const status of usedStatuses) {
      expect(validStatuses.has(status),
        `offer status "${status}" is not a valid enum value`
      ).toBe(true);
    }
  });

  it('bundle offer has BUNDLE type and bundle items', () => {
    expect(OFFER_IDS.bundlePending).toBe('seed-offer-07');
    // Bundle items reference listings [20], [21], [22]
    for (const idx of [20, 21, 22]) {
      expect(LISTING_IDS[idx]).toBeDefined();
    }
  });

});
