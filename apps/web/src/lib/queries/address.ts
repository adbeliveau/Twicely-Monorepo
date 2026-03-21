import { db } from '@twicely/db';
import { address } from '@twicely/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface AddressData {
  id: string;
  userId: string;
  label: string | null;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
}

/**
 * Get all addresses for a user, ordered by isDefault DESC, createdAt DESC.
 */
export async function getUserAddresses(userId: string): Promise<AddressData[]> {
  const addresses = await db
    .select({
      id: address.id,
      userId: address.userId,
      label: address.label,
      name: address.name,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
    })
    .from(address)
    .where(eq(address.userId, userId))
    .orderBy(desc(address.isDefault), desc(address.createdAt));

  return addresses;
}

/**
 * Get a single address by ID, verify ownership.
 */
export async function getAddressById(
  addressId: string,
  userId: string
): Promise<AddressData | null> {
  const [row] = await db
    .select({
      id: address.id,
      userId: address.userId,
      label: address.label,
      name: address.name,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
    })
    .from(address)
    .where(and(eq(address.id, addressId), eq(address.userId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Get the default address for a user, or first address if no default.
 */
export async function getDefaultAddress(userId: string): Promise<AddressData | null> {
  const [row] = await db
    .select({
      id: address.id,
      userId: address.userId,
      label: address.label,
      name: address.name,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
    })
    .from(address)
    .where(eq(address.userId, userId))
    .orderBy(desc(address.isDefault), desc(address.createdAt))
    .limit(1);

  return row ?? null;
}
