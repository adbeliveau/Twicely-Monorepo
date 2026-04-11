'use server';

/**
 * Geocoding Actions — address-to-coordinates and reverse geocoding.
 * Uses @twicely/geocoding with Mapbox backend.
 */

import { authorize } from '@twicely/casl';
import { geocodeAddress, reverseGeocode } from '@twicely/geocoding';
import type { GeoPoint } from '@twicely/geocoding';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { z } from 'zod';

const addressSchema = z.object({
  address: z.string().min(3).max(500),
}).strict();

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}).strict();

const searchLocationSchema = z.object({
  zip: z.string().min(3).max(10).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).strict();

export async function geocodeAddressAction(input: unknown) {
  const { session, ability } = await authorize();
  if (!session) return { error: 'Not authenticated' };
  if (!ability.can('read', 'SafeMeetupLocation')) return { error: 'Not authorized' };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid address' };

  const result = await geocodeAddress(parsed.data.address);

  if (!result) {
    return { error: 'Address not found' };
  }

  return {
    success: true,
    point: result.point,
    formattedAddress: result.formattedAddress,
    city: result.city,
    state: result.state,
    country: result.country,
    postalCode: result.postalCode,
    confidence: result.confidence,
  };
}

export async function reverseGeocodeAction(input: unknown) {
  const { session, ability } = await authorize();
  if (!session) return { error: 'Not authenticated' };
  if (!ability.can('read', 'SafeMeetupLocation')) return { error: 'Not authorized' };

  const parsed = pointSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid coordinates' };

  const point: GeoPoint = parsed.data;
  const result = await reverseGeocode(point);

  if (!result) {
    return { error: 'Location not found' };
  }

  return {
    success: true,
    formattedAddress: result.formattedAddress,
    city: result.city,
    state: result.state,
    country: result.country,
    postalCode: result.postalCode,
  };
}

/**
 * Resolve a buyer's location for geo-proximity search (Decision #144).
 * Public action — no auth required (search is public).
 * Accepts zip code or lat/lng coordinates.
 */
export async function resolveSearchLocation(input: unknown) {
  const geoEnabled = await getPlatformSetting<boolean>('discovery.geo.enabled', true);
  if (!geoEnabled) return { error: 'Geo search is disabled' };

  const parsed = searchLocationSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid location input' };

  const { zip, lat, lng } = parsed.data;

  // If coordinates provided, reverse geocode for label
  if (lat !== undefined && lng !== undefined) {
    const result = await reverseGeocode({ lat, lng });
    return {
      success: true,
      lat,
      lng,
      label: result ? `${result.city}, ${result.state}` : `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    };
  }

  // If zip provided, forward geocode
  if (zip) {
    const result = await geocodeAddress(zip);
    if (!result) return { error: 'Location not found' };
    return {
      success: true,
      lat: result.point.lat,
      lng: result.point.lng,
      label: result.city ? `${result.city}, ${result.state}` : zip,
    };
  }

  return { error: 'Provide zip or coordinates' };
}
