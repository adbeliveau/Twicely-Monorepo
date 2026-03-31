/**
 * Mapbox Geocoding Provider — calls Mapbox Geocoding API v5.
 *
 * Endpoint: https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json
 * Docs: https://docs.mapbox.com/api/search/geocoding/
 */

import { logger } from '@twicely/logger';
import type { GeocodingProvider, GeoPoint, GeocodeResult } from '../types';

const BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
  relevance: number;
  context?: Array<{ id: string; text: string; short_code?: string }>;
  properties?: { accuracy?: string };
}

interface MapboxResponse {
  type: string;
  features: MapboxFeature[];
}

export class MapboxGeocodingProvider implements GeocodingProvider {
  private accessToken: string;

  constructor() {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      throw new Error('MAPBOX_ACCESS_TOKEN is required for Mapbox geocoding');
    }
    this.accessToken = token;
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    const encoded = encodeURIComponent(address.trim());
    const url = `${BASE_URL}/${encoded}.json?access_token=${this.accessToken}&limit=1&types=address,place,locality,postcode`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.error('Mapbox geocode failed', { status: res.status });
        return null;
      }

      const data = (await res.json()) as MapboxResponse;
      if (!data.features || data.features.length === 0) return null;

      return mapFeatureToResult(data.features[0]!);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mapbox geocode error';
      logger.error('Mapbox geocode error', { error: message });
      return null;
    }
  }

  async reverseGeocode(point: GeoPoint): Promise<GeocodeResult | null> {
    const url = `${BASE_URL}/${point.lng},${point.lat}.json?access_token=${this.accessToken}&limit=1&types=address,place,locality`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.error('Mapbox reverse geocode failed', { status: res.status });
        return null;
      }

      const data = (await res.json()) as MapboxResponse;
      if (!data.features || data.features.length === 0) return null;

      return mapFeatureToResult(data.features[0]!);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mapbox reverse geocode error';
      logger.error('Mapbox reverse geocode error', { error: message });
      return null;
    }
  }

  async geocodeBatch(addresses: string[]): Promise<(GeocodeResult | null)[]> {
    // Mapbox doesn't have a native batch endpoint — run sequentially
    const results: (GeocodeResult | null)[] = [];
    for (const address of addresses) {
      results.push(await this.geocode(address));
    }
    return results;
  }
}

/** Extract context fields (city, state, country, postcode) from Mapbox context array. */
function extractContext(
  context: MapboxFeature['context']
): { city: string; state: string; country: string; postalCode: string } {
  let city = '';
  let state = '';
  let country = '';
  let postalCode = '';

  if (!context) return { city, state, country, postalCode };

  for (const ctx of context) {
    if (ctx.id.startsWith('place')) city = ctx.text;
    else if (ctx.id.startsWith('region')) state = ctx.short_code?.replace('US-', '') ?? ctx.text;
    else if (ctx.id.startsWith('country')) country = ctx.short_code?.toUpperCase() ?? ctx.text;
    else if (ctx.id.startsWith('postcode')) postalCode = ctx.text;
  }

  return { city, state, country, postalCode };
}

/** Map a Mapbox feature to our GeocodeResult. */
function mapFeatureToResult(feature: MapboxFeature): GeocodeResult {
  const [lng, lat] = feature.center;
  const { city, state, country, postalCode } = extractContext(feature.context);

  return {
    point: { lat, lng },
    formattedAddress: feature.place_name,
    city,
    state,
    country,
    postalCode,
    confidence: feature.relevance,
  };
}
