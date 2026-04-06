import { hashSync } from 'bcryptjs';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { user, account, sellerProfile, businessInfo } from '../schema';

// Hardcoded IDs for idempotency
export const USER_IDS = {
  buyer1: 'seed-buyer-001',
  buyer2: 'seed-buyer-002',
  buyer3: 'seed-buyer-003',
  seller1: 'seed-seller-001',
  seller2: 'seed-seller-002',
  seller3: 'seed-seller-003',
};

const SELLER_PROFILE_IDS = {
  seller1: 'seed-sp-001',
  seller2: 'seed-sp-002',
  seller3: 'seed-sp-003',
};

const BUSINESS_INFO_ID = 'seed-bi-001';


const ACCOUNT_IDS = {
  buyer1: 'seed-acct-buyer1',
  buyer2: 'seed-acct-buyer2',
  buyer3: 'seed-acct-buyer3',
  seller1: 'seed-acct-seller1',
  seller2: 'seed-acct-seller2',
  seller3: 'seed-acct-seller3',
};

function hashDemoPassword(): string {
  return hashSync('DemoPass123!', 12);
}

export async function seedUsers(db: PostgresJsDatabase): Promise<void> {
  const demoPasswordHash = hashDemoPassword();

  // 1. Users (6)
  await db.insert(user).values([
    // Buyers
    {
      id: USER_IDS.buyer1,
      name: 'Emma Thompson',
      email: 'buyer1@demo.twicely.co',
      emailVerified: true,
      username: 'emma_t',
      isSeller: false,
      completedPurchaseCount: 0,
      isBanned: false,
      marketingOptIn: false,
    },
    {
      id: USER_IDS.buyer2,
      name: 'James Wilson',
      email: 'buyer2@demo.twicely.co',
      emailVerified: true,
      username: 'james_w',
      isSeller: false,
      completedPurchaseCount: 0,
      isBanned: false,
      marketingOptIn: false,
    },
    {
      id: USER_IDS.buyer3,
      name: 'Sofia Garcia',
      email: 'buyer3@demo.twicely.co',
      emailVerified: true,
      username: 'sofia_g',
      isSeller: false,
      completedPurchaseCount: 0,
      isBanned: false,
      marketingOptIn: false,
    },
    // Sellers
    {
      id: USER_IDS.seller1,
      name: "Mike's Electronics",
      email: 'seller1@demo.twicely.co',
      emailVerified: true,
      username: 'mikes_electronics',
      isSeller: true,
      completedPurchaseCount: 0,
      isBanned: false,
      marketingOptIn: false,
    },
    {
      id: USER_IDS.seller2,
      name: "Sarah's Closet",
      email: 'seller2@demo.twicely.co',
      emailVerified: true,
      username: 'sarahs_closet',
      isSeller: true,
      completedPurchaseCount: 0,
      isBanned: false,
      marketingOptIn: false,
    },
    {
      id: USER_IDS.seller3,
      name: 'Vintage Vault LLC',
      email: 'seller3@demo.twicely.co',
      emailVerified: true,
      username: 'vintage_vault',
      isSeller: true,
      completedPurchaseCount: 0,
      isBanned: false,
      marketingOptIn: false,
    },
  ]).onConflictDoNothing();

  // 2. Accounts (6) - Better Auth credential accounts
  await db.insert(account).values([
    {
      id: ACCOUNT_IDS.buyer1,
      userId: USER_IDS.buyer1,
      accountId: USER_IDS.buyer1,
      providerId: 'credential',
      password: demoPasswordHash,
    },
    {
      id: ACCOUNT_IDS.buyer2,
      userId: USER_IDS.buyer2,
      accountId: USER_IDS.buyer2,
      providerId: 'credential',
      password: demoPasswordHash,
    },
    {
      id: ACCOUNT_IDS.buyer3,
      userId: USER_IDS.buyer3,
      accountId: USER_IDS.buyer3,
      providerId: 'credential',
      password: demoPasswordHash,
    },
    {
      id: ACCOUNT_IDS.seller1,
      userId: USER_IDS.seller1,
      accountId: USER_IDS.seller1,
      providerId: 'credential',
      password: demoPasswordHash,
    },
    {
      id: ACCOUNT_IDS.seller2,
      userId: USER_IDS.seller2,
      accountId: USER_IDS.seller2,
      providerId: 'credential',
      password: demoPasswordHash,
    },
    {
      id: ACCOUNT_IDS.seller3,
      userId: USER_IDS.seller3,
      accountId: USER_IDS.seller3,
      providerId: 'credential',
      password: demoPasswordHash,
    },
  ]).onConflictDoNothing();

  // 3. Seller profiles (3)
  await db.insert(sellerProfile).values([
    {
      id: SELLER_PROFILE_IDS.seller1,
      userId: USER_IDS.seller1,
      sellerType: 'PERSONAL',
      storeTier: 'NONE',
      listerTier: 'FREE',
      performanceBand: 'ESTABLISHED',
      status: 'ACTIVE',
      payoutsEnabled: false,
      storeName: "Mike's Electronics",
      storeSlug: 'mikes-electronics',
      handlingTimeDays: 3,
      vacationMode: false,
      stripeOnboarded: false,
      trustScore: 80,
    },
    {
      id: SELLER_PROFILE_IDS.seller2,
      userId: USER_IDS.seller2,
      sellerType: 'PERSONAL',
      storeTier: 'NONE',
      listerTier: 'LITE',
      performanceBand: 'ESTABLISHED',
      status: 'ACTIVE',
      payoutsEnabled: false,
      storeName: "Sarah's Closet",
      storeSlug: 'sarahs-closet',
      handlingTimeDays: 3,
      vacationMode: false,
      stripeOnboarded: false,
      trustScore: 80,
    },
    {
      id: SELLER_PROFILE_IDS.seller3,
      userId: USER_IDS.seller3,
      sellerType: 'BUSINESS',
      // v3.2: BASIC → STARTER, PLUS → PRO
      storeTier: 'STARTER',
      listerTier: 'PRO',
      performanceBand: 'TOP_RATED',
      status: 'ACTIVE',
      payoutsEnabled: false,
      storeName: 'Vintage Vault LLC',
      storeSlug: 'vintage-vault',
      handlingTimeDays: 3,
      vacationMode: false,
      stripeOnboarded: false,
      trustScore: 80,
    },
  ]).onConflictDoNothing();

  // 4. Business info (1 - for seller3 only)
  await db.insert(businessInfo).values({
    id: BUSINESS_INFO_ID,
    userId: USER_IDS.seller3,
    businessName: 'Vintage Vault LLC',
    businessType: 'LLC',
    address1: '456 Commerce Ave',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'US',
  }).onConflictDoNothing();
}

// Export for use in other seeders
export const SELLER_IDS = SELLER_PROFILE_IDS;
