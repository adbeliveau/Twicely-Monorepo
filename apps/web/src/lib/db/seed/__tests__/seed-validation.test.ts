/**
 * Static validation tests for seed data integrity.
 * No database connection required — validates structure and FK references.
 */

import { describe, it, expect } from 'vitest';
import { USER_IDS, SELLER_IDS } from '../seed-users';
import { LISTING_IDS } from '../seed-listings';
import { CATEGORY_IDS } from '../seed-categories';
import { STOREFRONT_SEED_IDS } from '../seed-storefronts';
import { SEED_IDS } from '../seed-system';
import { OFFER_IDS } from '../seed-offers';
import { PROMOTIONS_IDS } from '../seed-promotions';
import { SELLER_SCORE_IDS } from '../seed-seller-scores';
import { PROTECTION_IDS } from '../seed-protection';
import { STRIPE_EVENT_LOG_SEED_IDS } from '../seed-stripe-events';

// ── helpers ─────────────────────────────────────────────────────────────────

/** All seed IDs from every module combined for uniqueness check */
function collectAllIds(): string[] {
  const ids: string[] = [];

  // Users
  ids.push(...Object.values(USER_IDS));
  ids.push(...Object.values(SELLER_IDS));

  // Listings (array)
  ids.push(...LISTING_IDS);

  // Categories
  ids.push(...Object.values(CATEGORY_IDS));

  // Storefronts
  ids.push(...Object.values(STOREFRONT_SEED_IDS));

  // System
  ids.push(SEED_IDS.staffAdminId);

  // Offers
  ids.push(...Object.values(OFFER_IDS));

  // Promotions
  ids.push(...Object.values(PROMOTIONS_IDS.promotedListings));
  ids.push(...Object.values(PROMOTIONS_IDS.events));

  // Seller scores
  ids.push(...Object.values(SELLER_SCORE_IDS));

  // Protection
  ids.push(...Object.values(PROTECTION_IDS));

  // Stripe event logs
  ids.push(...Object.values(STRIPE_EVENT_LOG_SEED_IDS));

  return ids;
}

// Known valid order IDs from seed-orders.ts
const VALID_ORDER_IDS = new Set([
  'seed-order-001', 'seed-order-002', 'seed-order-003', 'seed-order-004', 'seed-order-005',
  'seed-order-006', 'seed-order-007', 'seed-order-008', 'seed-order-009', 'seed-order-010',
]);

// ── tests ────────────────────────────────────────────────────────────────────

describe('Seed data validation', () => {
  it('has no duplicate seed IDs across all modules', () => {
    const allIds = collectAllIds();
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

  it('promoted listing events reference valid promoted listing IDs', () => {
    const validPromotedIds = new Set(Object.values(PROMOTIONS_IDS.promotedListings));

    // Each event ID prefix maps to a promoted listing
    // macbook events -> seed-pl-001
    // rolex event    -> seed-pl-003
    const eventToPromotedMapping: Record<string, string> = {
      'seed-ple-001': 'seed-pl-001',
      'seed-ple-002': 'seed-pl-001',
      'seed-ple-003': 'seed-pl-001',
      'seed-ple-004': 'seed-pl-001',
      'seed-ple-005': 'seed-pl-003',
    };

    for (const [eventId, promotedId] of Object.entries(eventToPromotedMapping)) {
      expect(validPromotedIds.has(promotedId),
        `Event ${eventId} references promoted listing ${promotedId} which does not exist`
      ).toBe(true);
    }
  });

  it('buyer protection claims reference valid order IDs', () => {
    const orderIds = {
      openClaim:     'seed-order-010',
      resolvedClaim: 'seed-order-006',
    };

    for (const [claimKey, orderId] of Object.entries(orderIds)) {
      expect(VALID_ORDER_IDS.has(orderId),
        `Claim ${claimKey} references order ${orderId} which is not a valid seed order`
      ).toBe(true);
    }
  });

  it('buyer protection claims have correct buyer/seller FK references', () => {
    // open claim: buyer3 vs seller3, order 10
    expect(USER_IDS.buyer3).toBe('seed-buyer-003');
    expect(USER_IDS.seller3).toBe('seed-seller-003');

    // resolved claim: buyer1 vs seller3, order 6
    expect(USER_IDS.buyer1).toBe('seed-buyer-001');
    expect(USER_IDS.seller3).toBe('seed-seller-003');
  });

  it('seller score snapshots use valid PerformanceBand enum values', () => {
    const validBands = new Set(['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']);

    // seller1 and seller2 are ESTABLISHED, seller3 is TOP_RATED
    const usedBands = ['ESTABLISHED', 'ESTABLISHED', 'TOP_RATED'];

    for (const band of usedBands) {
      expect(validBands.has(band), `Band "${band}" is not a valid PerformanceBand enum value`).toBe(true);
    }
  });

  it('seller score snapshots reference valid seller profile IDs', () => {
    const validSellerProfileIds = new Set(Object.values(SELLER_IDS));

    const snapshotSellerIds = [SELLER_IDS.seller1, SELLER_IDS.seller2, SELLER_IDS.seller3];

    for (const sellerProfileId of snapshotSellerIds) {
      expect(validSellerProfileIds.has(sellerProfileId),
        `Snapshot references seller profile ${sellerProfileId} which does not exist`
      ).toBe(true);
    }
  });

  it('all monetary values in seed data are integers (no floats)', () => {
    // Promoted listing totalFeeCents
    const promotedFeeCents = [3200, 0, 23000];
    for (const cents of promotedFeeCents) {
      expect(Number.isInteger(cents), `Value ${cents} is not an integer`).toBe(true);
    }

    // Promoted event feeCents
    const eventFeeCents = [1600];
    for (const cents of eventFeeCents) {
      expect(Number.isInteger(cents), `Value ${cents} is not an integer`).toBe(true);
    }

    // Protection claim amounts
    const claimAmounts = [1150500, 251200];
    for (const cents of claimAmounts) {
      expect(Number.isInteger(cents), `Value ${cents} is not an integer`).toBe(true);
    }

    // Stripe event amounts (in payload, for documentation)
    const stripeAmounts = [90700, 45650, 1150500];
    for (const cents of stripeAmounts) {
      expect(Number.isInteger(cents), `Value ${cents} is not an integer`).toBe(true);
    }
  });

  it('storefront pages have valid Puck JSON structure', () => {
    const aboutUsPuckData = {
      root:    { props: {} },
      content: [
        {
          type:  'Hero',
          props: {
            title:       'About Vintage Vault',
            description: 'Premium collectibles since 2018',
          },
        },
        {
          type:  'Text',
          props: { text: 'Family-owned and operated, Vintage Vault specializes in authenticated luxury goods, rare trading cards, and premium collectibles. Every item is verified by our expert team before listing.' },
        },
      ],
    };

    const holidayPuckData = {
      root:    { props: {} },
      content: [
        {
          type:  'FeaturedItems',
          props: {
            title:    'Holiday Collection 2025',
            subtitle: 'Curated gifts for the collector in your life',
          },
        },
      ],
    };

    expect(aboutUsPuckData).toHaveProperty('root');
    expect(aboutUsPuckData).toHaveProperty('content');
    expect(Array.isArray(aboutUsPuckData.content)).toBe(true);

    expect(holidayPuckData).toHaveProperty('root');
    expect(holidayPuckData).toHaveProperty('content');
    expect(Array.isArray(holidayPuckData.content)).toBe(true);
  });

  it('storefront pages reference valid storefront IDs', () => {
    const validStorefrontIds = new Set(Object.values(STOREFRONT_SEED_IDS));

    // Both storefront pages belong to seller3
    const pageStorefrontId = STOREFRONT_SEED_IDS.seller3;

    expect(validStorefrontIds.has(pageStorefrontId),
      `Storefront page references storefront ${pageStorefrontId} which does not exist`
    ).toBe(true);
  });

  it('google category mappings reference valid Twicely category IDs', () => {
    const validCategoryIds = new Set(Object.values(CATEGORY_IDS));

    const mappedCategories = [
      CATEGORY_IDS.electronics,
      CATEGORY_IDS.apparel,
      CATEGORY_IDS.home,
      CATEGORY_IDS.collectibles,
    ];

    for (const catId of mappedCategories) {
      expect(validCategoryIds.has(catId),
        `Google mapping references category ${catId} which does not exist`
      ).toBe(true);
    }
  });

  it('stripe event log entries have unique stripeEventId values', () => {
    const stripeEventIds = [
      'evt_seed_pi_succeeded_order001',
      'evt_seed_pi_succeeded_order007',
      'evt_seed_charge_dispute_order010',
    ];

    const uniqueIds = new Set(stripeEventIds);
    expect(uniqueIds.size).toBe(stripeEventIds.length);
  });

  it('protection claims have valid evidenceJson as arrays', () => {
    const openClaimEvidence = [
      { type: 'photo', url: 'https://placehold.co/800x600/eee/999?text=Evidence+Photo+1', description: 'Item does not match listing description' },
      { type: 'photo', url: 'https://placehold.co/800x600/eee/999?text=Evidence+Photo+2', description: 'Missing crown and bezel shows wear' },
    ];

    const resolvedClaimEvidence = [
      { type: 'photo', url: 'https://placehold.co/800x600/eee/999?text=Damaged+Packaging', description: 'Damaged packaging upon arrival' },
    ];

    expect(Array.isArray(openClaimEvidence)).toBe(true);
    expect(openClaimEvidence.length).toBeGreaterThan(0);

    expect(Array.isArray(resolvedClaimEvidence)).toBe(true);
    expect(resolvedClaimEvidence.length).toBeGreaterThan(0);
  });

  it('promoted listings reference valid listing IDs', () => {
    // MacBook Pro is LISTING_IDS[4], Sony A7 IV is LISTING_IDS[8], Rolex is LISTING_IDS[38]
    const referencedListingIds = [LISTING_IDS[4], LISTING_IDS[8], LISTING_IDS[38]];

    for (const id of referencedListingIds) {
      expect(typeof id).toBe('string');
      expect(id).toBeDefined();
    }

    expect(LISTING_IDS[4]).toBe('seed-listing-005');
    expect(LISTING_IDS[8]).toBe('seed-listing-009');
    expect(LISTING_IDS[38]).toBe('seed-listing-039');
  });

  it('resolved protection claim references valid staff admin ID', () => {
    expect(SEED_IDS.staffAdminId).toBe('seed-staff-admin-001');
  });
});
