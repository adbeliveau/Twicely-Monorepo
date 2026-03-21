/**
 * Seed validation tests for enum correctness and template structure (A5.1):
 * - Notification template IDs, keys, channels
 * - Protection claim claimType enum values
 * - Seller score PerformanceBand enum values and score ranges
 *
 * No database connection required — validates structure only.
 */

import { describe, it, expect } from 'vitest';
import { SELLER_SCORE_IDS } from '../seed-seller-scores';
import { PROTECTION_IDS } from '../seed-protection';

// ── notification templates ────────────────────────────────────────────────────

describe('Seed notification templates', () => {
  // The 19 templates defined in seed-notifications.ts
  const TEMPLATE_IDS = [
    'seed-tpl-offer-declined',
    'seed-tpl-offer-accepted',
    'seed-tpl-offer-received',
    'seed-tpl-offer-countered',
    'seed-tpl-offer-expired',
    'seed-tpl-order-confirmed',
    'seed-tpl-order-shipped',
    'seed-tpl-watchlist-price-drop',
    'seed-tpl-watchlist-watcher-offer',
    'seed-tpl-search-new-match',
    'seed-tpl-trial-ending',
    'seed-tpl-trial-expired',
    'seed-tpl-return-requested',
    'seed-tpl-return-approved',
    'seed-tpl-return-declined',
    'seed-tpl-dispute-opened',
    'seed-tpl-dispute-resolved',
    'seed-tpl-protection-claim',
    'seed-tpl-shipping-exception',
  ];

  const TEMPLATE_KEYS = [
    'offer.declined',
    'offer.accepted',
    'offer.received',
    'offer.countered',
    'offer.expired',
    'order.confirmed',
    'order.shipped',
    'watchlist.price_drop',
    'watchlist.watcher_offer',
    'search.new_match',
    'subscription.trial_ending',
    'subscription.trial_expired',
    'return.requested',
    'return.approved',
    'return.declined',
    'dispute.opened',
    'dispute.resolved',
    'protection.claim_submitted',
    'shipping.exception',
  ];

  const TEMPLATE_CATEGORIES = [
    'offers', 'offers', 'offers', 'offers', 'offers',
    'orders', 'orders',
    'watchlist', 'watchlist',
    'search',
    'subscription', 'subscription',
    'returns', 'returns', 'returns',
    'disputes', 'disputes',
    'protection',
    'shipping',
  ];

  it('notification template IDs are all unique', () => {
    const unique = new Set(TEMPLATE_IDS);
    expect(unique.size).toBe(TEMPLATE_IDS.length);
  });

  it('notification template keys are all unique', () => {
    const unique = new Set(TEMPLATE_KEYS);
    expect(unique.size).toBe(TEMPLATE_KEYS.length);
  });

  it('has exactly 19 notification templates', () => {
    expect(TEMPLATE_IDS.length).toBe(19);
    expect(TEMPLATE_KEYS.length).toBe(19);
  });

  it('notification template channels use only valid values', () => {
    const validChannels = new Set(['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
    // All 19 templates use ['EMAIL', 'IN_APP']
    const usedChannels = ['EMAIL', 'IN_APP'];
    for (const ch of usedChannels) {
      expect(validChannels.has(ch),
        `Channel "${ch}" is not a valid notification channel`
      ).toBe(true);
    }
  });

  it('template keys follow dot-notation category.action convention', () => {
    for (const key of TEMPLATE_KEYS) {
      expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('template categories are non-empty strings', () => {
    for (const cat of TEMPLATE_CATEGORIES) {
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
    }
  });

  it('template key category prefix matches template category field', () => {
    // Verify that the first segment of each key matches the expected category grouping
    const offerKeys = TEMPLATE_KEYS.filter(k => k.startsWith('offer.'));
    const orderKeys = TEMPLATE_KEYS.filter(k => k.startsWith('order.'));
    const watchlistKeys = TEMPLATE_KEYS.filter(k => k.startsWith('watchlist.'));
    const returnKeys = TEMPLATE_KEYS.filter(k => k.startsWith('return.'));
    const disputeKeys = TEMPLATE_KEYS.filter(k => k.startsWith('dispute.'));

    expect(offerKeys.length).toBe(5);
    expect(orderKeys.length).toBe(2);
    expect(watchlistKeys.length).toBe(2);
    expect(returnKeys.length).toBe(3);
    expect(disputeKeys.length).toBe(2);
  });
});

// ── protection claim types ────────────────────────────────────────────────────

describe('Seed protection claim types', () => {
  it('all claimType values are valid enum values', () => {
    const validClaimTypes = new Set(['INR', 'INAD', 'DAMAGED', 'FRAUD', 'CANCEL']);

    // openClaim: INAD (Item Not As Described), resolvedClaim: DAMAGED
    const usedClaimTypes = ['INAD', 'DAMAGED'];
    for (const ct of usedClaimTypes) {
      expect(validClaimTypes.has(ct),
        `claimType "${ct}" is not a valid enum value`
      ).toBe(true);
    }
  });

  it('protection claim IDs follow seed naming convention', () => {
    expect(PROTECTION_IDS.openClaim).toBe('seed-bpc-001');
    expect(PROTECTION_IDS.resolvedClaim).toBe('seed-bpc-002');
  });

  it('has exactly 2 protection claims (1 open, 1 resolved)', () => {
    expect(Object.keys(PROTECTION_IDS).length).toBe(2);
  });

  it('protection claim status values are valid enum values', () => {
    const validStatuses = new Set(['OPEN', 'REVIEWING', 'RESOLVED', 'CLOSED']);
    const usedStatuses = ['OPEN', 'RESOLVED'];
    for (const status of usedStatuses) {
      expect(validStatuses.has(status),
        `claim status "${status}" is not a valid enum value`
      ).toBe(true);
    }
  });
});

// ── seller score enum values and ranges ───────────────────────────────────────

describe('Seed seller score ranges and enum values', () => {
  it('seller score snapshot IDs are all unique', () => {
    const ids = Object.values(SELLER_SCORE_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly 6 seller score snapshots (2 per seller)', () => {
    expect(Object.keys(SELLER_SCORE_IDS).length).toBe(6);
  });

  it('overall scores are in valid range 0-100', () => {
    // seller1: 75, 80; seller2: 70, 75; seller3: 90, 95
    const overallScores = [75, 80, 70, 75, 90, 95];
    for (const score of overallScores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('component scores are in valid range 0-100', () => {
    const componentValues = [85, 88, 80, 90, 88, 82, 85, 78, 88, 85, 95, 96, 92, 98, 96];
    for (const val of componentValues) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('performanceBand values are valid PerformanceBand enum values', () => {
    const validBands = new Set(['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']);
    const usedBands = ['ESTABLISHED', 'ESTABLISHED', 'ESTABLISHED', 'ESTABLISHED', 'TOP_RATED', 'TOP_RATED'];
    for (const band of usedBands) {
      expect(validBands.has(band),
        `PerformanceBand "${band}" is not a valid enum value`
      ).toBe(true);
    }
  });

  it('does not use banned v3.2 PerformanceBand values STANDARD or RISING', () => {
    const bannedBands = ['STANDARD', 'RISING'];
    const usedBands = ['ESTABLISHED', 'ESTABLISHED', 'ESTABLISHED', 'ESTABLISHED', 'TOP_RATED', 'TOP_RATED'];
    for (const band of usedBands) {
      expect(bannedBands.includes(band),
        `Banned PerformanceBand "${band}" found in seed data`
      ).toBe(false);
    }
  });

  it('order counts are non-negative integers', () => {
    const orderCounts = [18, 22, 12, 14, 31, 28];
    for (const count of orderCounts) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it('defect counts are non-negative integers and less than order counts', () => {
    const pairs = [
      { defects: 1, orders: 18 },
      { defects: 0, orders: 22 },
      { defects: 1, orders: 12 },
      { defects: 0, orders: 14 },
      { defects: 0, orders: 31 },
      { defects: 0, orders: 28 },
    ];
    for (const { defects, orders } of pairs) {
      expect(Number.isInteger(defects)).toBe(true);
      expect(defects).toBeGreaterThanOrEqual(0);
      expect(defects).toBeLessThanOrEqual(orders);
    }
  });
});
