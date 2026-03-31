/**
 * Nominatim Geocoding Provider — placeholder for future self-hosted Nominatim.
 *
 * All methods throw NotImplementedError. This provider exists to satisfy
 * the GeocodingProvider interface and serve as the implementation target
 * when migrating away from Mapbox.
 */

import type { GeocodingProvider, GeoPoint, GeocodeResult } from '../types';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`Nominatim provider: ${method}() is not implemented yet`);
    this.name = 'NotImplementedError';
  }
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  async geocode(_address: string): Promise<GeocodeResult | null> {
    throw new NotImplementedError('geocode');
  }

  async reverseGeocode(_point: GeoPoint): Promise<GeocodeResult | null> {
    throw new NotImplementedError('reverseGeocode');
  }

  async geocodeBatch(_addresses: string[]): Promise<(GeocodeResult | null)[]> {
    throw new NotImplementedError('geocodeBatch');
  }
}
