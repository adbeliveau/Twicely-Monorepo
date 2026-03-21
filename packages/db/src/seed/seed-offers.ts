import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSetting, listingOffer, offerBundleItem } from '../schema';
import { USER_IDS } from './seed-users';
import { LISTING_IDS } from './seed-listings';
import { ADDRESS_DATA } from './seed-addresses';

// Hardcoded IDs for idempotency
export const OFFER_IDS = {
  pending:        'seed-offer-01',
  accepted:       'seed-offer-02',
  declined:       'seed-offer-03',
  expired:        'seed-offer-04',
  countered:      'seed-offer-05',
  counterPending: 'seed-offer-06',
  bundlePending:  'seed-offer-07',
};

const BUNDLE_ITEM_IDS = {
  bi1: 'seed-obi-001',
  bi2: 'seed-obi-002',
  bi3: 'seed-obi-003',
};

/**
 * Seed listing offers and offer-related platform settings.
 * The 3 offer limit keys are NOT in v32-platform-settings.ts, so they live here.
 * Depends on seedPlatform(), seedListings(), seedUsers(), seedAddresses() running first.
 */
export async function seedOffers(db: PostgresJsDatabase): Promise<void> {
  // Platform settings for offer limits (not in V32_PLATFORM_SETTINGS array)
  await db.insert(platformSetting).values([
    { id: 'seed-ps-offer-1', key: 'commerce.offer.maxPerBuyerPerListing', value: 3, type: 'number', category: 'commerce' },
    { id: 'seed-ps-offer-2', key: 'commerce.offer.maxPerBuyerPerSeller',  value: 3, type: 'number', category: 'commerce' },
    { id: 'seed-ps-offer-3', key: 'commerce.offer.maxPerBuyerGlobal',     value: 10, type: 'number', category: 'commerce' },
  ]).onConflictDoNothing();

  const now = new Date();
  const past   = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COUNTERED' | 'EXPIRED';
  type OfferType   = 'BEST_OFFER' | 'BUNDLE';

  const offers: Array<{
    id: string;
    listingId: string;
    buyerId: string;
    sellerId: string;
    offerCents: number;
    status: OfferStatus;
    type: OfferType;
    expiresAt: Date;
    shippingAddressId: string;
    counterCount: number;
    respondedAt?: Date;
    parentOfferId?: string;
    counterByRole?: string;
  }> = [
    {
      id: OFFER_IDS.pending,
      listingId: LISTING_IDS[4]!,
      buyerId: USER_IDS.buyer1,
      sellerId: USER_IDS.seller1,
      offerCents: 130000,
      status: 'PENDING',
      type: 'BEST_OFFER',
      expiresAt: future,
      shippingAddressId: ADDRESS_DATA.buyer1,
      counterCount: 0,
    },
    {
      id: OFFER_IDS.accepted,
      listingId: LISTING_IDS[8]!,
      buyerId: USER_IDS.buyer2,
      sellerId: USER_IDS.seller1,
      offerCents: 175000,
      status: 'ACCEPTED',
      type: 'BEST_OFFER',
      expiresAt: past,
      respondedAt: past,
      shippingAddressId: ADDRESS_DATA.buyer2,
      counterCount: 0,
    },
    {
      id: OFFER_IDS.declined,
      listingId: LISTING_IDS[20]!,
      buyerId: USER_IDS.buyer3,
      sellerId: USER_IDS.seller2,
      offerCents: 5000,
      status: 'DECLINED',
      type: 'BEST_OFFER',
      expiresAt: past,
      respondedAt: past,
      shippingAddressId: ADDRESS_DATA.buyer3,
      counterCount: 0,
    },
    {
      id: OFFER_IDS.expired,
      listingId: LISTING_IDS[40]!,
      buyerId: USER_IDS.buyer1,
      sellerId: USER_IDS.seller3,
      offerCents: 15000,
      status: 'EXPIRED',
      type: 'BEST_OFFER',
      expiresAt: past,
      shippingAddressId: ADDRESS_DATA.buyer1,
      counterCount: 0,
    },
    {
      id: OFFER_IDS.countered,
      listingId: LISTING_IDS[4]!,
      buyerId: USER_IDS.buyer2,
      sellerId: USER_IDS.seller1,
      offerCents: 120000,
      status: 'COUNTERED',
      type: 'BEST_OFFER',
      expiresAt: past,
      respondedAt: past,
      shippingAddressId: ADDRESS_DATA.buyer2,
      counterCount: 0,
    },
    {
      id: OFFER_IDS.counterPending,
      listingId: LISTING_IDS[4]!,
      buyerId: USER_IDS.buyer2,
      sellerId: USER_IDS.seller1,
      offerCents: 140000,
      status: 'PENDING',
      type: 'BEST_OFFER',
      expiresAt: future,
      parentOfferId: OFFER_IDS.countered,
      counterByRole: 'SELLER',
      counterCount: 1,
      shippingAddressId: ADDRESS_DATA.buyer2,
    },
  ];

  // Bundle offer: buyer3 wants 3 items from seller2's store
  offers.push({
    id: OFFER_IDS.bundlePending,
    listingId: LISTING_IDS[20]!, // primary listing (anchor)
    buyerId: USER_IDS.buyer3,
    sellerId: USER_IDS.seller2,
    offerCents: 45000, // $450 bundle price
    status: 'PENDING',
    type: 'BUNDLE',
    expiresAt: future,
    shippingAddressId: ADDRESS_DATA.buyer3,
    counterCount: 0,
  });

  await db.insert(listingOffer).values(offers).onConflictDoNothing();

  // Bundle items: 3 listings in the bundle offer
  await db.insert(offerBundleItem).values([
    { id: BUNDLE_ITEM_IDS.bi1, offerId: OFFER_IDS.bundlePending, listingId: LISTING_IDS[20]! },
    { id: BUNDLE_ITEM_IDS.bi2, offerId: OFFER_IDS.bundlePending, listingId: LISTING_IDS[21]! },
    { id: BUNDLE_ITEM_IDS.bi3, offerId: OFFER_IDS.bundlePending, listingId: LISTING_IDS[22]! },
  ]).onConflictDoNothing();
}
