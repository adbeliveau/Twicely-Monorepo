/**
 * @twicely/geocoding — Geocoding provider abstraction with Mapbox backend.
 *
 * Usage:
 *   import { geocodeAddress, reverseGeocode } from '@twicely/geocoding';
 *
 * Provider selection: GEOCODING_PROVIDER env var ('mapbox' | 'nominatim', default: 'mapbox')
 */

import type { GeocodingProvider, GeoPoint, GeocodeResult } from './types';

export type { GeocodingProvider, GeoPoint, GeocodeResult } from './types';

let _provider: GeocodingProvider | null = null;

/**
 * Get the configured geocoding provider singleton.
 * - GEOCODING_PROVIDER=mapbox → MapboxGeocodingProvider (default)
 * - GEOCODING_PROVIDER=nominatim → NominatimGeocodingProvider (stub)
 */
export function getGeocodingProvider(): GeocodingProvider {
  if (_provider) return _provider;

  const providerName = process.env.GEOCODING_PROVIDER ?? 'mapbox';

  switch (providerName) {
    case 'nominatim': {
      const { NominatimGeocodingProvider } = require('./providers/nominatim') as {
        NominatimGeocodingProvider: new () => GeocodingProvider;
      };
      _provider = new NominatimGeocodingProvider();
      break;
    }
    case 'mapbox':
    default: {
      const { MapboxGeocodingProvider } = require('./providers/mapbox') as {
        MapboxGeocodingProvider: new () => GeocodingProvider;
      };
      _provider = new MapboxGeocodingProvider();
      break;
    }
  }

  return _provider;
}

/** Reset the provider singleton (for testing). */
export function resetGeocodingProvider(): void {
  _provider = null;
}

/**
 * Geocode an address string to coordinates.
 * Returns null if no results found.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  return getGeocodingProvider().geocode(address);
}

/**
 * Reverse geocode coordinates to a structured address.
 * Returns null if no results found.
 */
export async function reverseGeocode(point: GeoPoint): Promise<GeocodeResult | null> {
  return getGeocodingProvider().reverseGeocode(point);
}

/**
 * Geocode multiple addresses.
 * Returns array in same order as input, with null for unresolvable addresses.
 */
export async function geocodeBatch(addresses: string[]): Promise<(GeocodeResult | null)[]> {
  return getGeocodingProvider().geocodeBatch(addresses);
}
