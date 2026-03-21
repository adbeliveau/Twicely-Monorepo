import { describe, it, expect } from 'vitest';

// ─── Helpers extracted from meetup-map logic ──────────────────────────────────

function getMidpoint(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): [number, number] {
  return [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
}

function getDirectionsUrl(
  safeSpot: { lat: number; lng: number } | null | undefined,
  buyerLat: number,
  buyerLng: number,
  sellerLat: number,
  sellerLng: number
): string {
  const lat = safeSpot ? safeSpot.lat : getMidpoint(buyerLat, buyerLng, sellerLat, sellerLng)[0];
  const lng = safeSpot ? safeSpot.lng : getMidpoint(buyerLat, buyerLng, sellerLat, sellerLng)[1];
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function getDistanceChipText(distanceMiles: number): string {
  return `${distanceMiles.toFixed(1)} mi away`;
}

function hasSafeSpotChip(safeSpot: { lat: number; lng: number; name: string; verified: boolean } | null | undefined): boolean {
  return safeSpot != null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MeetupMap logic', () => {
  describe('Google Maps directions URL', () => {
    it('uses safe spot coordinates when safeSpot is provided', () => {
      const url = getDirectionsUrl(
        { lat: 40.1, lng: -74.5 },
        40.7128,
        -74.006,
        34.0522,
        -118.2437
      );
      expect(url).toBe('https://maps.google.com/?q=40.1,-74.5');
    });

    it('uses midpoint when safeSpot is null', () => {
      const url = getDirectionsUrl(null, 40.0, -74.0, 42.0, -76.0);
      expect(url).toBe('https://maps.google.com/?q=41,-75');
    });

    it('uses midpoint when safeSpot is undefined', () => {
      const url = getDirectionsUrl(undefined, 40.0, -74.0, 42.0, -76.0);
      expect(url).toBe('https://maps.google.com/?q=41,-75');
    });
  });

  describe('distance chip text', () => {
    it('formats 2.5 miles as "2.5 mi away"', () => {
      expect(getDistanceChipText(2.5)).toBe('2.5 mi away');
    });

    it('formats 0.3 miles as "0.3 mi away"', () => {
      expect(getDistanceChipText(0.3)).toBe('0.3 mi away');
    });

    it('formats 15.0 miles as "15.0 mi away"', () => {
      expect(getDistanceChipText(15.0)).toBe('15.0 mi away');
    });
  });

  describe('safe spot chip visibility', () => {
    it('returns true when safeSpot is non-null', () => {
      expect(hasSafeSpotChip({ lat: 40.1, lng: -74.5, name: 'Police Station', verified: true })).toBe(true);
    });

    it('returns false when safeSpot is null', () => {
      expect(hasSafeSpotChip(null)).toBe(false);
    });

    it('returns false when safeSpot is undefined', () => {
      expect(hasSafeSpotChip(undefined)).toBe(false);
    });
  });
});
