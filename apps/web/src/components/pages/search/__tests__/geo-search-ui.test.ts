/**
 * Tests for geo search UI logic (Decision #144).
 *
 * Validates conditional rendering rules for:
 * - Location filter visibility
 * - Nearest sort option availability
 * - Distance badge display
 * - Map view toggle visibility
 * - Active filter location tag
 */

import { describe, it, expect } from 'vitest';

// ─── Logic: Nearest sort option ─────────────────────────────────────────────

interface SortOption {
  value: string;
  label: string;
  geoOnly?: boolean;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'nearest', label: 'Nearest', geoOnly: true },
];

function getVisibleSortOptions(hasLocation: boolean): SortOption[] {
  return SORT_OPTIONS.filter(
    (opt) => !('geoOnly' in opt && opt.geoOnly) || hasLocation,
  );
}

// ─── Logic: Distance badge ──────────────────────────────────────────────────

function getDistanceBadgeText(
  distanceMiles: number | undefined | null,
  fulfillmentType: string | undefined,
): string | null {
  if (fulfillmentType !== 'LOCAL_ONLY' && fulfillmentType !== 'SHIP_AND_LOCAL') {
    return null;
  }
  if (distanceMiles != null) {
    return distanceMiles < 1
      ? '<1 mi'
      : `${Math.round(distanceMiles)} mi`;
  }
  return 'Local';
}

// ─── Logic: Map toggle visibility ───────────────────────────────────────────

function shouldShowMapToggle(
  listings: Array<{ sellerLat?: number | null; sellerLng?: number | null }>,
): boolean {
  return listings.some((l) => l.sellerLat != null);
}

// ─── Logic: Active filter location tag ──────────────────────────────────────

function hasGeoFilter(params: {
  near?: string | null;
  lat?: string | null;
}): boolean {
  return !!(params.near || params.lat);
}

function getLocationTagLabel(
  near: string | null | undefined,
  radius: string | null | undefined,
): string {
  const loc = near ?? 'Custom location';
  const r = radius ?? '25';
  return `Near: ${loc} (${r} mi)`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Geo search — sort options', () => {
  it('shows 4 options when no location is set', () => {
    const options = getVisibleSortOptions(false);
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.value)).not.toContain('nearest');
  });

  it('shows 5 options including nearest when location is set', () => {
    const options = getVisibleSortOptions(true);
    expect(options).toHaveLength(5);
    expect(options.map((o) => o.value)).toContain('nearest');
  });
});

describe('Geo search — distance badge', () => {
  it('returns null for SHIP_ONLY listings', () => {
    expect(getDistanceBadgeText(5, 'SHIP_ONLY')).toBeNull();
  });

  it('shows miles for LOCAL_ONLY with distance', () => {
    expect(getDistanceBadgeText(5.3, 'LOCAL_ONLY')).toBe('5 mi');
  });

  it('shows <1 mi for very close listings', () => {
    expect(getDistanceBadgeText(0.4, 'SHIP_AND_LOCAL')).toBe('<1 mi');
  });

  it('rounds distance to nearest mile', () => {
    expect(getDistanceBadgeText(12.7, 'LOCAL_ONLY')).toBe('13 mi');
  });

  it('shows "Local" when no distance data', () => {
    expect(getDistanceBadgeText(undefined, 'LOCAL_ONLY')).toBe('Local');
    expect(getDistanceBadgeText(null, 'SHIP_AND_LOCAL')).toBe('Local');
  });
});

describe('Geo search — map toggle', () => {
  it('shows toggle when at least one listing has geo data', () => {
    const listings = [
      { sellerLat: 40.7, sellerLng: -74.0 },
      { sellerLat: null, sellerLng: null },
    ];
    expect(shouldShowMapToggle(listings)).toBe(true);
  });

  it('hides toggle when no listings have geo data', () => {
    const listings = [
      { sellerLat: null, sellerLng: null },
      { sellerLat: undefined, sellerLng: undefined },
    ];
    expect(shouldShowMapToggle(listings)).toBe(false);
  });

  it('hides toggle for empty results', () => {
    expect(shouldShowMapToggle([])).toBe(false);
  });
});

describe('Geo search — active filter tag', () => {
  it('detects geo filter from near param', () => {
    expect(hasGeoFilter({ near: '90210' })).toBe(true);
  });

  it('detects geo filter from lat param', () => {
    expect(hasGeoFilter({ lat: '34.05' })).toBe(true);
  });

  it('returns false when no geo params', () => {
    expect(hasGeoFilter({})).toBe(false);
    expect(hasGeoFilter({ near: null, lat: null })).toBe(false);
  });

  it('formats location tag with near and radius', () => {
    expect(getLocationTagLabel('Los Angeles', '25')).toBe(
      'Near: Los Angeles (25 mi)',
    );
  });

  it('uses default radius when not specified', () => {
    expect(getLocationTagLabel('NYC', null)).toBe('Near: NYC (25 mi)');
  });

  it('uses "Custom location" when near is null', () => {
    expect(getLocationTagLabel(null, '50')).toBe(
      'Near: Custom location (50 mi)',
    );
  });
});
