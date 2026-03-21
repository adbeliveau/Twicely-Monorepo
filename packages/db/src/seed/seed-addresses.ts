import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { address } from '../schema';
import { USER_IDS } from './seed-users';

// Hardcoded IDs for idempotency
const ADDRESS_IDS = {
  buyer1: 'seed-addr-buyer1',
  buyer2: 'seed-addr-buyer2',
  buyer3: 'seed-addr-buyer3',
  seller1: 'seed-addr-seller1',
  seller2: 'seed-addr-seller2',
  seller3: 'seed-addr-seller3',
};

/**
 * Seed user addresses (6 - 1 per user).
 * Depends on seedUsers() running first.
 */
export async function seedAddresses(db: PostgresJsDatabase): Promise<void> {
  await db.insert(address).values([
    {
      id: ADDRESS_IDS.buyer1,
      userId: USER_IDS.buyer1,
      label: 'Home',
      name: 'Emma Thompson',
      address1: '123 Main St',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      country: 'US',
      isDefault: true,
    },
    {
      id: ADDRESS_IDS.buyer2,
      userId: USER_IDS.buyer2,
      label: 'Home',
      name: 'James Wilson',
      address1: '456 Oak Ave',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
      country: 'US',
      isDefault: true,
    },
    {
      id: ADDRESS_IDS.buyer3,
      userId: USER_IDS.buyer3,
      label: 'Home',
      name: 'Sofia Garcia',
      address1: '789 Pine Blvd',
      city: 'Denver',
      state: 'CO',
      zip: '80202',
      country: 'US',
      isDefault: true,
    },
    {
      id: ADDRESS_IDS.seller1,
      userId: USER_IDS.seller1,
      label: 'Business',
      name: "Mike's Electronics",
      address1: '100 Tech Park Dr',
      city: 'San Jose',
      state: 'CA',
      zip: '95110',
      country: 'US',
      isDefault: true,
    },
    {
      id: ADDRESS_IDS.seller2,
      userId: USER_IDS.seller2,
      label: 'Home',
      name: "Sarah's Closet",
      address1: '222 Fashion Way',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      country: 'US',
      isDefault: true,
    },
    {
      id: ADDRESS_IDS.seller3,
      userId: USER_IDS.seller3,
      label: 'Warehouse',
      name: 'Vintage Vault LLC',
      address1: '456 Commerce Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
      isDefault: true,
    },
  ]).onConflictDoNothing();
}

// Export for use in other seeders
export const ADDRESS_DATA = ADDRESS_IDS;
