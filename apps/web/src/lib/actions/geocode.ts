'use server';

/**
 * Geocoding Actions — address-to-coordinates and reverse geocoding.
 * Uses @twicely/geocoding with Mapbox backend.
 */

import { authorize } from '@twicely/casl';
import { geocodeAddress, reverseGeocode } from '@twicely/geocoding';
import type { GeoPoint } from '@twicely/geocoding';
import { z } from 'zod';

const addressSchema = z.object({
  address: z.string().min(3).max(500),
}).strict();

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}).strict();

export async function geocodeAddressAction(input: unknown) {
  const { session } = await authorize();
  if (!session) return { error: 'Not authenticated' };

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
  const { session } = await authorize();
  if (!session) return { error: 'Not authenticated' };

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
