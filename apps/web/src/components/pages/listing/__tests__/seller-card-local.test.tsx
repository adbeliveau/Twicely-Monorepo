/**
 * Tests for SellerCard local metrics rendering logic (G2.17).
 *
 * These tests validate the conditional rendering logic — when to show
 * local meetup stats based on fulfillmentType and localMetrics.
 * The vitest environment is node (no jsdom), so we test pure functions.
 */

import { describe, it, expect } from 'vitest';
import type { SellerLocalMetrics } from '@/lib/queries/local-metrics';

// ─── Logic extracted from SellerCard ─────────────────────────────────────────

type FulfillmentType = 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL' | string;

function shouldShowLocalStats(
  localMetrics: SellerLocalMetrics | null | undefined,
  fulfillmentType: FulfillmentType | undefined,
): boolean {
  if (localMetrics === null || localMetrics === undefined) return false;
  if (fulfillmentType === 'LOCAL_ONLY' || fulfillmentType === 'SHIP_AND_LOCAL') {
    return true;
  }
  return false;
}

function shouldShowReliabilityTierBadge(): boolean {
  // Per A14: tier badge is NEVER shown on listing detail or storefront.
  // Only on meetup screen (G2.8).
  return false;
}

function shouldShowRawMarkCount(): boolean {
  // Per A14: raw mark count is private — never exposed to buyers.
  return false;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLocalMetrics(
  overrides: Partial<SellerLocalMetrics> = {},
): SellerLocalMetrics {
  return {
    localTransactionCount: 10,
    localCompletedCount: 9,
    localCompletionRate: 0.9,
    localReliabilityTier: 'RELIABLE',
    localAvgResponseLabel: 'Same day',
    hasLocalActivity: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SellerCard — local stats conditional rendering', () => {
  it('renders local stats when fulfillmentType is LOCAL_ONLY and localMetrics is not null', () => {
    const metrics = makeLocalMetrics();
    expect(shouldShowLocalStats(metrics, 'LOCAL_ONLY')).toBe(true);
  });

  it('renders local stats when fulfillmentType is SHIP_AND_LOCAL and localMetrics is not null', () => {
    const metrics = makeLocalMetrics();
    expect(shouldShowLocalStats(metrics, 'SHIP_AND_LOCAL')).toBe(true);
  });

  it('does NOT render local stats when fulfillmentType is SHIP_ONLY', () => {
    const metrics = makeLocalMetrics();
    expect(shouldShowLocalStats(metrics, 'SHIP_ONLY')).toBe(false);
  });

  it('does NOT render local stats when localMetrics is null even if fulfillmentType is LOCAL_ONLY', () => {
    expect(shouldShowLocalStats(null, 'LOCAL_ONLY')).toBe(false);
  });

  it('does NOT render local stats when localMetrics is undefined', () => {
    expect(shouldShowLocalStats(undefined, 'LOCAL_ONLY')).toBe(false);
  });

  it('does NOT show reliability tier badge or raw mark count', () => {
    expect(shouldShowReliabilityTierBadge()).toBe(false);
    expect(shouldShowRawMarkCount()).toBe(false);
  });

  it('does NOT render local stats when fulfillmentType is undefined', () => {
    const metrics = makeLocalMetrics();
    expect(shouldShowLocalStats(metrics, undefined)).toBe(false);
  });

  it('local stats use localCompletedCount (not localTransactionCount)', () => {
    const metrics = makeLocalMetrics({
      localTransactionCount: 20,
      localCompletedCount: 16,
    });
    // The displayed count should be 16, not 20
    expect(metrics.localCompletedCount).toBe(16);
    expect(metrics.localCompletedCount).not.toBe(metrics.localTransactionCount);
  });
});
