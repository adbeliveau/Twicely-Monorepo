/**
 * Bundle Offer Response — Accept, decline, or counter a bundle offer.
 */

import { db } from '@twicely/db';
import { listingOffer, offerBundleItem } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { scheduleOfferExpiry, cancelOfferExpiry } from '@twicely/jobs/offer-expiry';
import { notifyOfferEvent } from './offer-notifications';
import { createOrderFromOffer } from './offer-to-order';
import { getOfferById } from './offer-queries';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export interface BundleOfferResult {
  success: boolean;
  offer?: {
    id: string;
    offerCents: number;
    status: string;
    listingIds: string[];
  };
  error?: string;
}

/**
 * Respond to a bundle offer (accept, decline, or counter).
 */
export async function respondToBundleOffer(
  sellerId: string,
  offerId: string,
  action: 'accept' | 'decline' | 'counter',
  counterPriceCents?: number
): Promise<BundleOfferResult> {
  const offer = await getOfferById(offerId);
  if (!offer) return { success: false, error: 'Offer not found' };
  if (offer.type !== 'BUNDLE') return { success: false, error: 'Not a bundle offer' };
  if (offer.status !== 'PENDING') return { success: false, error: 'Offer is no longer pending' };
  if (offer.sellerId !== sellerId) return { success: false, error: 'You cannot respond to this offer' };

  // Validate counter price before expensive DB queries
  if (action === 'counter' && !counterPriceCents) {
    return { success: false, error: 'Counter price is required' };
  }

  // Get bundle items
  const bundleItems = await db
    .select({ listingId: offerBundleItem.listingId })
    .from(offerBundleItem)
    .where(eq(offerBundleItem.offerId, offerId));

  const listingIds = bundleItems.map(b => b.listingId);

  if (action === 'accept') {
    // Capture payment
    if (!offer.stripeHoldId) {
      return { success: false, error: 'No payment hold found' };
    }

    try {
      await stripe.paymentIntents.capture(offer.stripeHoldId);
    } catch {
      return { success: false, error: 'Failed to capture payment' };
    }

    // Mark accepted
    await db.update(listingOffer)
      .set({ status: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(listingOffer.id, offerId));

    // Cancel expiry job
    await cancelOfferExpiry(offerId);

    // Create order from bundle offer
    const orderResult = await createOrderFromOffer({
      offerId,
      shippingAddressId: offer.shippingAddressId!,
      stripePaymentIntentId: offer.stripeHoldId,
    });

    if (!orderResult.success) {
      return { success: false, error: orderResult.error ?? 'Failed to create order' };
    }

    // Notify buyer
    notifyOfferEvent('accepted', offerId);

    return {
      success: true,
      offer: { id: offerId, offerCents: offer.offerCents, status: 'ACCEPTED', listingIds },
    };
  }

  if (action === 'decline') {
    // Release hold
    if (offer.stripeHoldId) {
      try { await stripe.paymentIntents.cancel(offer.stripeHoldId); } catch { /* ignore */ }
    }

    // Mark declined
    await db.update(listingOffer)
      .set({ status: 'DECLINED', respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(listingOffer.id, offerId));

    // Cancel expiry job
    await cancelOfferExpiry(offerId);

    // Notify buyer
    notifyOfferEvent('declined', offerId);

    return {
      success: true,
      offer: { id: offerId, offerCents: offer.offerCents, status: 'DECLINED', listingIds },
    };
  }

  if (action === 'counter') {
    if (counterPriceCents === offer.offerCents) {
      return { success: false, error: 'Counter must be a different amount' };
    }
    const maxCounterRounds = await getPlatformSetting<number>('bundle.maxCounterRounds', 1);
    if (offer.counterCount >= maxCounterRounds) {
      return { success: false, error: 'Maximum counter rounds reached for bundle offers' };
    }

    // Release buyer's hold
    if (offer.stripeHoldId) {
      try { await stripe.paymentIntents.cancel(offer.stripeHoldId); } catch { /* ignore */ }
    }

    const expiryHours = await getPlatformSetting<number>('commerce.offer.expirationHours', 48);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Create counter offer (no hold for seller counter)
    const result = await db.transaction(async (tx) => {
      // Mark original as countered
      await tx.update(listingOffer)
        .set({ status: 'COUNTERED', respondedAt: new Date(), updatedAt: new Date() })
        .where(eq(listingOffer.id, offerId));

      // Create new counter offer
      const [counterOffer] = await tx.insert(listingOffer).values({
        listingId: offer.listingId,
        buyerId: offer.buyerId,
        sellerId,
        offerCents: counterPriceCents!,
        status: 'PENDING',
        type: 'BUNDLE',
        expiresAt,
        parentOfferId: offerId,
        counterByRole: 'SELLER',
        counterCount: offer.counterCount + 1,
        shippingAddressId: offer.shippingAddressId,
      }).returning();

      if (!counterOffer) {
        throw new Error('Failed to create counter offer');
      }

      // Copy bundle items to new offer
      await tx.insert(offerBundleItem).values(
        listingIds.map(listingId => ({
          offerId: counterOffer.id,
          listingId,
        }))
      );

      return counterOffer;
    });

    // Cancel old expiry, schedule new
    await cancelOfferExpiry(offerId);
    await scheduleOfferExpiry(result.id, expiresAt);

    // Notify buyer
    notifyOfferEvent('countered', result.id, { recipientOverride: offer.buyerId });

    return {
      success: true,
      offer: { id: result.id, offerCents: result.offerCents, status: 'PENDING', listingIds },
    };
  }

  return { success: false, error: 'Invalid action' };
}
