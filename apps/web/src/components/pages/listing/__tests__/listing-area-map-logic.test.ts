/**
 * Tests for ListingAreaMap visibility logic on PDP (Decision #144).
 *
 * The map shows only for LOCAL_ONLY or SHIP_AND_LOCAL listings
 * that have seller city-level coordinates.
 */

import { describe, it, expect } from 'vitest';

// ─── Logic extracted from PDP page ──────────────────────────────────────────

function shouldShowAreaMap(
  fulfillmentType: string,
  sellerLat: number | null | undefined,
  sellerLng: number | null | undefined,
): boolean {
  const isLocal =
    fulfillmentType === 'LOCAL_ONLY' || fulfillmentType === 'SHIP_AND_LOCAL';
  return isLocal && sellerLat != null && sellerLng != null;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PDP area map — visibility', () => {
  it('shows map for LOCAL_ONLY with coordinates', () => {
    expect(shouldShowAreaMap('LOCAL_ONLY', 34.05, -118.24)).toBe(true);
  });

  it('shows map for SHIP_AND_LOCAL with coordinates', () => {
    expect(shouldShowAreaMap('SHIP_AND_LOCAL', 40.71, -74.01)).toBe(true);
  });

  it('hides map for SHIP_ONLY even with coordinates', () => {
    expect(shouldShowAreaMap('SHIP_ONLY', 34.05, -118.24)).toBe(false);
  });

  it('hides map when sellerLat is null', () => {
    expect(shouldShowAreaMap('LOCAL_ONLY', null, -118.24)).toBe(false);
  });

  it('hides map when sellerLng is null', () => {
    expect(shouldShowAreaMap('LOCAL_ONLY', 34.05, null)).toBe(false);
  });

  it('hides map when both coordinates are undefined', () => {
    expect(shouldShowAreaMap('SHIP_AND_LOCAL', undefined, undefined)).toBe(
      false,
    );
  });

  it('hides map for unknown fulfillment type', () => {
    expect(shouldShowAreaMap('UNKNOWN', 34.05, -118.24)).toBe(false);
  });
});
