import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { platformSetting, listingOffer } from '@twicely/db/schema';
import { seedSystem } from './seed/seed-system';
import { seedCategories } from './seed/seed-categories';
import { seedPlatform } from './seed/seed-platform';
import { seedUsers, USER_IDS } from './seed/seed-users';
import { seedAddresses, ADDRESS_DATA } from './seed/seed-addresses';
import { seedListings, LISTING_IDS } from './seed/seed-listings';
import { seedOrders } from './seed/seed-orders';
import { seedNotifications } from './seed/seed-notifications';
// A5.1 expanded seeders
import { seedStorefronts } from './seed/seed-storefronts';
import { seedEngagement } from './seed/seed-engagement';
import { seedFinanceCenter } from './seed/seed-finance-center';
import { seedSocial } from './seed/seed-social';
import { seedBuyerReviews } from './seed/seed-reviews-extended';
import { seedPersonalization } from './seed/seed-personalization';
import { seedCommsSettings } from './seed/seed-comms-settings';
import { seedCrosslister } from './seed/seed-crosslister';
import { seedMessaging } from './seed/seed-messaging';
import { seedAffiliates } from './seed/seed-affiliates';
import { seedHelpdesk } from './seed/seed-helpdesk';
import { seedHelpdeskCases } from './seed/seed-helpdesk-cases';
import { seedHelpdeskKb } from './seed/seed-helpdesk-kb';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('Seeding database...');

  console.log('  - System data (staff, fees, sequences)...');
  await seedSystem(db);

  console.log('  - Categories (16 categories)...');
  await seedCategories(db);

  console.log('  - Platform settings (104 v3.2 canonical values)...');
  await seedPlatform(db);

  console.log('  - Users (buyers, sellers, profiles)...');
  await seedUsers(db);

  console.log('  - Addresses (6 user addresses)...');
  await seedAddresses(db);

  console.log('  - Listings (50 listings + images)...');
  await seedListings(db);

  console.log('  - Orders (10 orders + items)...');
  await seedOrders(db);

  console.log('  - Offers (platform settings + 6 sample offers)...');
  await seedOffers(db);

  console.log('  - Notification templates...');
  await seedNotifications(db);

  // A5.1 expanded seed data
  console.log('  - Storefronts (3 stores + custom categories)...');
  await seedStorefronts(db);

  console.log('  - Engagement (browsing history, price alerts, price history)...');
  await seedEngagement(db);

  console.log('  - Finance Center (subscriptions, expenses, mileage)...');
  await seedFinanceCenter(db);

  console.log('  - Social (Q&A, curated collections, watcher offers)...');
  await seedSocial(db);

  console.log('  - Buyer reviews (seller rates buyer)...');
  await seedBuyerReviews(db);

  console.log('  - Personalization (interest tags + user interests)...');
  await seedPersonalization(db);

  console.log('  - Comms platform settings (11 comms.* keys)...');
  await seedCommsSettings(db);

  console.log('  - Crosslister platform settings + category mappings + policy rules...');
  await seedCrosslister(db);

  console.log('  - Messaging platform settings + demo conversations...');
  await seedMessaging(db);

  console.log('  - Affiliates (2 affiliates, 3 promo codes, 5 referrals, 3 commissions, 1 payout)...');
  await seedAffiliates(db);

  console.log('  - Helpdesk config (teams, SLA, routing, automation, KB categories)...');
  await seedHelpdesk(db);

  console.log('  - Helpdesk cases (10 cases, 20 messages, 12 events, 6 macros)...');
  await seedHelpdeskCases(db);

  console.log('  - KB articles (12 articles with content)...');
  await seedHelpdeskKb(db);

  console.log('  - Provider adapters (17 built-in: 9 infra + 8 crosslister)...');
  const { seedProviderAdapters } = await import('./seed/seed-providers');
  await seedProviderAdapters();

  console.log('Seed complete.');

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

// Offer IDs
const OFFER_IDS = {
  pending: 'seed-offer-01',
  accepted: 'seed-offer-02',
  declined: 'seed-offer-03',
  expired: 'seed-offer-04',
  countered: 'seed-offer-05',
  counterPending: 'seed-offer-06',
};

async function seedOffers(db: ReturnType<typeof drizzle>): Promise<void> {
  // Platform settings for offer limits
  await db.insert(platformSetting).values([
    { id: 'seed-ps-offer-1', key: 'commerce.offer.maxPerBuyerPerListing', value: 3, type: 'number', category: 'commerce' },
    { id: 'seed-ps-offer-2', key: 'commerce.offer.maxPerBuyerPerSeller', value: 3, type: 'number', category: 'commerce' },
    { id: 'seed-ps-offer-3', key: 'commerce.offer.maxPerBuyerGlobal', value: 10, type: 'number', category: 'commerce' },
  ]).onConflictDoNothing();

  const now = new Date();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 6 sample offers with different states
  type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COUNTERED' | 'EXPIRED';
  type OfferType = 'BEST_OFFER';
  const offers: Array<{
    id: string; listingId: string; buyerId: string; sellerId: string; offerCents: number;
    status: OfferStatus; type: OfferType; expiresAt: Date; shippingAddressId: string;
    counterCount: number; respondedAt?: Date; parentOfferId?: string; counterByRole?: string;
  }> = [
    { id: OFFER_IDS.pending, listingId: LISTING_IDS[4]!, buyerId: USER_IDS.buyer1, sellerId: USER_IDS.seller1,
      offerCents: 130000, status: 'PENDING', type: 'BEST_OFFER', expiresAt: future,
      shippingAddressId: ADDRESS_DATA.buyer1, counterCount: 0 },
    { id: OFFER_IDS.accepted, listingId: LISTING_IDS[8]!, buyerId: USER_IDS.buyer2, sellerId: USER_IDS.seller1,
      offerCents: 175000, status: 'ACCEPTED', type: 'BEST_OFFER', expiresAt: past, respondedAt: past,
      shippingAddressId: ADDRESS_DATA.buyer2, counterCount: 0 },
    { id: OFFER_IDS.declined, listingId: LISTING_IDS[20]!, buyerId: USER_IDS.buyer3, sellerId: USER_IDS.seller2,
      offerCents: 5000, status: 'DECLINED', type: 'BEST_OFFER', expiresAt: past, respondedAt: past,
      shippingAddressId: ADDRESS_DATA.buyer3, counterCount: 0 },
    { id: OFFER_IDS.expired, listingId: LISTING_IDS[40]!, buyerId: USER_IDS.buyer1, sellerId: USER_IDS.seller3,
      offerCents: 15000, status: 'EXPIRED', type: 'BEST_OFFER', expiresAt: past,
      shippingAddressId: ADDRESS_DATA.buyer1, counterCount: 0 },
    { id: OFFER_IDS.countered, listingId: LISTING_IDS[4]!, buyerId: USER_IDS.buyer2, sellerId: USER_IDS.seller1,
      offerCents: 120000, status: 'COUNTERED', type: 'BEST_OFFER', expiresAt: past, respondedAt: past,
      shippingAddressId: ADDRESS_DATA.buyer2, counterCount: 0 },
    { id: OFFER_IDS.counterPending, listingId: LISTING_IDS[4]!, buyerId: USER_IDS.buyer2, sellerId: USER_IDS.seller1,
      offerCents: 140000, status: 'PENDING', type: 'BEST_OFFER', expiresAt: future,
      parentOfferId: OFFER_IDS.countered, counterByRole: 'SELLER', counterCount: 1,
      shippingAddressId: ADDRESS_DATA.buyer2 },
  ];
  await db.insert(listingOffer).values(offers).onConflictDoNothing();
}
