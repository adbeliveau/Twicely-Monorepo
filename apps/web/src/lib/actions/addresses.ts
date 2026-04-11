'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { address, sellerProfile } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { addressSchema, type AddressFormData } from '@/lib/validations/address';
import { logger } from '@twicely/logger';

interface AddressActionResult {
  success: boolean;
  addressId?: string;
  errors?: Record<string, string>;
  error?: string;
}

const ADDRESS_OWNERSHIP_FIELDS = { id: address.id, userId: address.userId };

function parseAddress(data: unknown): { data: AddressFormData } | { errors: Record<string, string> } {
  const parsed = addressSchema.safeParse(data);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field && typeof field === 'string') errors[field] = issue.message;
    }
    return { errors };
  }
  return { data: parsed.data };
}

async function clearDefaultAddresses(userId: string): Promise<void> {
  await db
    .update(address)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(address.userId, userId), eq(address.isDefault, true)));
}

function revalidateAddressPaths() {
  revalidatePath('/my/settings/addresses');
  revalidatePath('/checkout');
}

/**
 * Geocode a seller's default address to update sellerLat/sellerLng on their profile.
 * Fire-and-forget — never blocks address save. (Decision #144)
 */
async function geocodeSellerLocation(userId: string, city: string, state: string, zip: string): Promise<void> {
  try {
    const [profile] = await db
      .select({ id: sellerProfile.id })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, userId))
      .limit(1);
    if (!profile) return; // Not a seller — skip

    const { geocodeAddress } = await import('@twicely/geocoding');
    const result = await geocodeAddress(`${city}, ${state} ${zip}`);
    if (!result) {
      await db.update(sellerProfile).set({ sellerLat: null, sellerLng: null }).where(eq(sellerProfile.id, profile.id));
      return;
    }
    await db.update(sellerProfile).set({
      sellerLat: result.point.lat,
      sellerLng: result.point.lng,
    }).where(eq(sellerProfile.id, profile.id));
  } catch (err) {
    logger.warn('[geocode] Failed to geocode seller location', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function createAddress(data: AddressFormData): Promise<AddressActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'User')) {
    return { success: false, error: 'Your account cannot manage addresses' };
  }

  const userId = session.userId;
  const result = parseAddress(data);
  if ('errors' in result) return { success: false, errors: result.errors };
  const v = result.data;

  const existing = await db.select({ id: address.id }).from(address).where(eq(address.userId, userId)).limit(1);
  const shouldBeDefault = v.isDefault || existing.length === 0;
  if (shouldBeDefault) await clearDefaultAddresses(userId);

  const [newAddr] = await db.insert(address).values({
    userId,
    label: v.label?.trim() || null,
    name: v.name.trim(),
    address1: v.address1.trim(),
    address2: v.address2?.trim() || null,
    city: v.city.trim(),
    state: v.state.trim(),
    zip: v.zip.trim(),
    country: v.country.trim(),
    phone: v.phone?.trim() || null,
    isDefault: shouldBeDefault,
  }).returning({ id: address.id });

  // Decision #144: geocode seller location from default address (fire-and-forget)
  if (shouldBeDefault) {
    void geocodeSellerLocation(userId, v.city.trim(), v.state.trim(), v.zip.trim());
  }

  revalidateAddressPaths();
  return { success: true, addressId: newAddr!.id };
}

export async function updateAddress(addressId: string, data: AddressFormData): Promise<AddressActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'User')) {
    return { success: false, error: 'Your account cannot manage addresses' };
  }

  const userId = session.userId;
  const [existing] = await db.select(ADDRESS_OWNERSHIP_FIELDS).from(address).where(eq(address.id, addressId)).limit(1);
  if (!existing || existing.userId !== userId) return { success: false, error: 'Address not found' };

  const result = parseAddress(data);
  if ('errors' in result) return { success: false, errors: result.errors };
  const v = result.data;

  if (v.isDefault) await clearDefaultAddresses(userId);

  const isDefault = v.isDefault ?? false;
  await db.update(address).set({
    label: v.label?.trim() || null,
    name: v.name.trim(),
    address1: v.address1.trim(),
    address2: v.address2?.trim() || null,
    city: v.city.trim(),
    state: v.state.trim(),
    zip: v.zip.trim(),
    country: v.country.trim(),
    phone: v.phone?.trim() || null,
    isDefault,
    updatedAt: new Date(),
  }).where(eq(address.id, addressId));

  // Decision #144: re-geocode seller location when default address is updated
  if (isDefault) {
    void geocodeSellerLocation(userId, v.city.trim(), v.state.trim(), v.zip.trim());
  }

  revalidateAddressPaths();
  return { success: true, addressId };
}

export async function deleteAddress(addressId: string): Promise<AddressActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'User')) {
    return { success: false, error: 'Your account cannot manage addresses' };
  }

  const userId = session.userId;
  const [existing] = await db
    .select({ ...ADDRESS_OWNERSHIP_FIELDS, isDefault: address.isDefault })
    .from(address).where(eq(address.id, addressId)).limit(1);
  if (!existing || existing.userId !== userId) return { success: false, error: 'Address not found' };

  await db.delete(address).where(eq(address.id, addressId));

  if (existing.isDefault) {
    const [next] = await db.select({ id: address.id }).from(address).where(eq(address.userId, userId)).limit(1);
    if (next) await db.update(address).set({ isDefault: true, updatedAt: new Date() }).where(eq(address.id, next.id));
  }

  revalidateAddressPaths();
  return { success: true };
}

export async function setDefaultAddress(addressId: string): Promise<AddressActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'User')) {
    return { success: false, error: 'Your account cannot manage addresses' };
  }

  const userId = session.userId;
  const [existing] = await db.select(ADDRESS_OWNERSHIP_FIELDS).from(address).where(eq(address.id, addressId)).limit(1);
  if (!existing || existing.userId !== userId) return { success: false, error: 'Address not found' };

  await clearDefaultAddresses(userId);
  await db.update(address).set({ isDefault: true, updatedAt: new Date() }).where(eq(address.id, addressId));

  revalidateAddressPaths();
  return { success: true, addressId };
}
