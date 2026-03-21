/**
 * Bundle Offers -- Multi-item offer negotiation
 *
 * Allows buyers to make offers on multiple items from the same seller.
 * Bundle offers have a single price for all items combined.
 */

import { db } from '@twicely/db';
import { listingOffer, offerBundleItem, listing, address } from '@twicely/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { scheduleOfferExpiry } from '@twicely/jobs/offer-expiry';
import { notifyOfferEvent } from './offer-notifications';
import { getOfferById } from './offer-queries';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// Re-export response function and types for external consumers
export { respondToBundleOffer } from './bundle-offer-response';
export type { BundleOfferResult } from './bundle-offer-response';
import type { BundleOfferResult } from './bundle-offer-response';

export interface CreateBundleOfferParams {
  buyerId: string;
  sellerId?: string; // Optional - derived from listings if not provided
  listingIds: string[];
  offeredPriceCents: number;
  shippingAddressId: string;
  message?: string;
  paymentMethodId: string;
}

/**
 * Create a bundle offer for multiple items from the same seller.
 */
export async function createBundleOffer(params: CreateBundleOfferParams): Promise<BundleOfferResult> {
  const { buyerId, listingIds, offeredPriceCents, shippingAddressId, message, paymentMethodId } = params;

  // 1. Validate item count
  const minItems = await getPlatformSetting<number>('bundle.minItems', 2);
  const maxItems = await getPlatformSetting<number>('bundle.maxItems', 10);
  if (listingIds.length < minItems) {
    return { success: false, error: `Bundle must contain at least ${minItems} items` };
  }
  if (listingIds.length > maxItems) {
    return { success: false, error: `Bundle cannot exceed ${maxItems} items` };
  }

  // 2. Fetch all listings and validate
  const listings = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      status: listing.status,
      priceCents: listing.priceCents,
    })
    .from(listing)
    .where(inArray(listing.id, listingIds));

  if (listings.length !== listingIds.length) {
    return { success: false, error: 'One or more listings not found' };
  }

  // 3. Validate all from same seller and all ACTIVE
  const sellerIds = new Set(listings.map(l => l.ownerUserId));
  if (sellerIds.size > 1) {
    return { success: false, error: 'All items must be from the same seller' };
  }

  // Derive sellerId from listings
  const sellerId = listings[0]!.ownerUserId;

  // 4. Validate buyer !== seller
  if (buyerId === sellerId) {
    return { success: false, error: 'You cannot make an offer on your own listings' };
  }

  const inactiveListings = listings.filter(l => l.status !== 'ACTIVE');
  if (inactiveListings.length > 0) {
    return { success: false, error: 'One or more listings are no longer available' };
  }

  // 5. Validate offer price <= sum of individual prices
  const totalPriceCents = listings.reduce((sum, l) => sum + (l.priceCents ?? 0), 0);
  if (offeredPriceCents > totalPriceCents) {
    return { success: false, error: 'Bundle offer cannot exceed total of individual prices' };
  }

  // 6. Validate shipping address
  const [addr] = await db
    .select({ id: address.id, userId: address.userId })
    .from(address)
    .where(eq(address.id, shippingAddressId))
    .limit(1);

  if (!addr || addr.userId !== buyerId) {
    return { success: false, error: 'Invalid shipping address' };
  }

  // 7. Create Stripe authorization hold
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: offeredPriceCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      capture_method: 'manual',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        type: 'bundle_offer_hold',
        buyerId,
        sellerId,
        listingIds: listingIds.join(','),
      },
    });
  } catch {
    return { success: false, error: 'Failed to authorize payment' };
  }

  // 8. Calculate expiry
  const expiryHours = await getPlatformSetting<number>('commerce.offer.expirationHours', 48);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  // 9. Create offer and bundle items in transaction
  const result = await db.transaction(async (tx) => {
    // Insert main offer (listingId points to first item for compatibility)
    const [newOffer] = await tx.insert(listingOffer).values({
      listingId: listingIds[0]!,
      buyerId,
      sellerId,
      offerCents: offeredPriceCents,
      message,
      status: 'PENDING',
      type: 'BUNDLE',
      expiresAt,
      stripeHoldId: paymentIntent.id,
      counterCount: 0,
      shippingAddressId,
    }).returning();

    if (!newOffer) {
      throw new Error('Failed to create offer');
    }

    // Insert bundle item rows
    await tx.insert(offerBundleItem).values(
      listingIds.map(listingId => ({
        offerId: newOffer.id,
        listingId,
      }))
    );

    return newOffer;
  });

  // 10. Schedule expiry job
  await scheduleOfferExpiry(result.id, expiresAt);

  // 11. Notify seller
  notifyOfferEvent('created', result.id);

  return {
    success: true,
    offer: {
      id: result.id,
      offerCents: result.offerCents,
      status: result.status,
      listingIds,
    },
  };
}

/**
 * Get bundle offer details including all linked listings.
 */
export async function getBundleOfferDetails(offerId: string) {
  const offer = await getOfferById(offerId);
  if (!offer) return null;
  if (offer.type !== 'BUNDLE') return null;

  const bundleItems = await db
    .select({
      listingId: offerBundleItem.listingId,
      title: listing.title,
      priceCents: listing.priceCents,
      slug: listing.slug,
    })
    .from(offerBundleItem)
    .innerJoin(listing, eq(offerBundleItem.listingId, listing.id))
    .where(eq(offerBundleItem.offerId, offerId));

  return {
    ...offer,
    bundleItems,
    totalListPriceCents: bundleItems.reduce((sum, b) => sum + (b.priceCents ?? 0), 0),
  };
}
