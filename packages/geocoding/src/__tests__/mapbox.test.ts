import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { MapboxGeocodingProvider } from '../providers/mapbox';

const MAPBOX_FEATURE = {
  place_name: '123 Main St, Springfield, IL 62701, United States',
  center: [-89.6501, 39.7817],
  relevance: 0.95,
  context: [
    { id: 'place.123', text: 'Springfield' },
    { id: 'region.456', text: 'Illinois', short_code: 'US-IL' },
    { id: 'country.789', text: 'United States', short_code: 'us' },
    { id: 'postcode.101', text: '62701' },
  ],
};

describe('MapboxGeocodingProvider', () => {
  let provider: MapboxGeocodingProvider;

  beforeEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
    provider = new MapboxGeocodingProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.MAPBOX_ACCESS_TOKEN;
  });

  it('throws if MAPBOX_ACCESS_TOKEN is missing', () => {
    delete process.env.MAPBOX_ACCESS_TOKEN;
    expect(() => new MapboxGeocodingProvider()).toThrow('MAPBOX_ACCESS_TOKEN');
  });

  describe('geocode', () => {
    it('returns GeocodeResult for a valid address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: 'FeatureCollection', features: [MAPBOX_FEATURE] }),
      });

      const result = await provider.geocode('123 Main St, Springfield, IL');

      expect(result).not.toBeNull();
      expect(result!.point.lat).toBeCloseTo(39.7817);
      expect(result!.point.lng).toBeCloseTo(-89.6501);
      expect(result!.city).toBe('Springfield');
      expect(result!.state).toBe('IL');
      expect(result!.country).toBe('US');
      expect(result!.postalCode).toBe('62701');
      expect(result!.confidence).toBe(0.95);
      expect(result!.formattedAddress).toContain('123 Main St');
    });

    it('returns null when no features found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: 'FeatureCollection', features: [] }),
      });

      const result = await provider.geocode('xyznonexistentplace');
      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await provider.geocode('123 Main St');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.geocode('123 Main St');
      expect(result).toBeNull();
    });

    it('encodes the address in the URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: 'FeatureCollection', features: [MAPBOX_FEATURE] }),
      });

      await provider.geocode('123 Main St, Suite #5');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('123%20Main%20St%2C%20Suite%20%235');
      expect(calledUrl).toContain('access_token=test-token');
    });
  });

  describe('reverseGeocode', () => {
    it('returns GeocodeResult for valid coordinates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: 'FeatureCollection', features: [MAPBOX_FEATURE] }),
      });

      const result = await provider.reverseGeocode({ lat: 39.7817, lng: -89.6501 });

      expect(result).not.toBeNull();
      expect(result!.city).toBe('Springfield');
      expect(result!.formattedAddress).toContain('123 Main St');
    });

    it('passes lng,lat in the URL (Mapbox order)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: 'FeatureCollection', features: [MAPBOX_FEATURE] }),
      });

      await provider.reverseGeocode({ lat: 39.7817, lng: -89.6501 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('-89.6501,39.7817');
    });

    it('returns null when no features found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: 'FeatureCollection', features: [] }),
      });

      const result = await provider.reverseGeocode({ lat: 0, lng: 0 });
      expect(result).toBeNull();
    });
  });

  describe('geocodeBatch', () => {
    it('geocodes multiple addresses sequentially', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ type: 'FeatureCollection', features: [MAPBOX_FEATURE] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ type: 'FeatureCollection', features: [] }),
        });

      const results = await provider.geocodeBatch(['123 Main St', 'nowhere']);

      expect(results).toHaveLength(2);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
    });
  });
});
