/**
 * Geocoding Provider Abstraction
 *
 * Allows swapping Mapbox for Nominatim (or any other provider)
 * without changing application code.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  point: GeoPoint;
  formattedAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  /** 0-1 confidence score (1 = exact match). */
  confidence: number;
}

export interface GeocodingProvider {
  /** Convert a text address to coordinates. */
  geocode(address: string): Promise<GeocodeResult | null>;

  /** Convert coordinates to a structured address. */
  reverseGeocode(point: GeoPoint): Promise<GeocodeResult | null>;

  /** Geocode multiple addresses in sequence. */
  geocodeBatch(addresses: string[]): Promise<(GeocodeResult | null)[]>;
}
