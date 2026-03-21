import { db } from '@twicely/db';
import { listingOffer, listing } from '@twicely/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { getOfferById } from './offer-queries';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export interface OfferResult {
  success: boolean;
  offer?: { id: string; listingId: string; buyerId: string; sellerId: string; offerCents: number; status: string; stripeHoldId: string | null; counterCount?: number };
  orderId?: string;
  error?: string;
}

/** Decline an offer — release hold */
export async function declineOffer(offerId: string, sellerId: string): Promise<OfferResult> {
  const offer = await getOfferById(offerId);
  if (!offer) return { success: false, error: 'Offer not found' };
  if (offer.status !== 'PENDING') return { success: false, error: 'Offer is no longer pending' };
  if (offer.sellerId !== sellerId) return { success: false, error: 'You cannot decline this offer' };

  if (offer.stripeHoldId) {
    try { await stripe.paymentIntents.cancel(offer.stripeHoldId); } catch { /* may already be released */ }
  }

  const [updated] = await db.update(listingOffer)
    .set({ status: 'DECLINED', respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(listingOffer.id, offerId)).returning();

  return { success: true, offer: updated };
}

/** Counter an offer — release old hold, create new offer row */
export async function counterOffer(
  offerId: string,
  actorId: string,
  counterCents: number,
  message?: string,
  paymentMethodId?: string
): Promise<OfferResult> {
  const offer = await getOfferById(offerId);
  if (!offer) return { success: false, error: 'Offer not found' };
  if (offer.status !== 'PENDING') return { success: false, error: 'Offer is no longer pending' };

  const isSeller = actorId === offer.sellerId;
  const isBuyer = actorId === offer.buyerId;
  if (!isSeller && !isBuyer) return { success: false, error: 'You cannot counter this offer' };

  const maxCounterDepth = await getPlatformSetting<number>('commerce.offer.maxCounterDepth', 3);
  if (offer.counterCount >= maxCounterDepth) {
    return { success: false, error: 'Maximum negotiation rounds reached' };
  }
  if (counterCents === offer.offerCents) {
    return { success: false, error: 'Counter must be a different amount' };
  }

  // Get listing expiry settings
  const [lst] = await db.select({ offerExpiryHours: listing.offerExpiryHours }).from(listing)
    .where(eq(listing.id, offer.listingId)).limit(1);
  const defaultExpiryHours = await getPlatformSetting<number>('commerce.offer.expirationHours', 48);
  const expiresAt = new Date(Date.now() + (lst?.offerExpiryHours ?? defaultExpiryHours) * 60 * 60 * 1000);

  // Step 1: If buyer counters, create new Stripe hold FIRST (before any DB changes)
  // If this fails, old offer stays PENDING — buyer can retry
  let stripeHoldId: string | null = null;
  if (isBuyer) {
    if (!paymentMethodId) {
      return { success: false, error: 'Payment method required for counter offer' };
    }
    try {
      const pi = await stripe.paymentIntents.create({
        amount: counterCents,
        currency: offer.currency,
        payment_method: paymentMethodId,
        capture_method: 'manual',
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { offerId, listingId: offer.listingId, buyerId: offer.buyerId, type: 'counter_hold' },
      });
      stripeHoldId = pi.id;
    } catch {
      return { success: false, error: 'Failed to authorize payment for counter offer' };
    }
  }

  // Step 2: Release old hold (idempotent, safe — old offer still PENDING at this point)
  if (offer.stripeHoldId) {
    try { await stripe.paymentIntents.cancel(offer.stripeHoldId); } catch { /* ignore */ }
  }

  // Step 3: In transaction — set old offer COUNTERED + insert new offer
  const [newOffer] = await db.transaction(async (tx) => {
    await tx.update(listingOffer).set({ status: 'COUNTERED', respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(listingOffer.id, offerId));

    return tx.insert(listingOffer).values({
      listingId: offer.listingId,
      buyerId: offer.buyerId,
      sellerId: offer.sellerId,
      offerCents: counterCents,
      message,
      status: 'PENDING',
      type: 'BEST_OFFER',
      expiresAt,
      parentOfferId: offerId,
      counterByRole: isSeller ? 'SELLER' : 'BUYER',
      counterCount: offer.counterCount + 1,
      stripeHoldId,
      shippingAddressId: offer.shippingAddressId, // Carry forward from parent
    }).returning();
  });

  return { success: true, offer: newOffer };
}

/** Cancel an offer (buyer only) */
export async function cancelOffer(offerId: string, buyerId: string): Promise<OfferResult> {
  const offer = await getOfferById(offerId);
  if (!offer) return { success: false, error: 'Offer not found' };
  if (offer.status !== 'PENDING') return { success: false, error: 'Offer is no longer pending' };
  if (offer.buyerId !== buyerId) return { success: false, error: 'You can only cancel your own offers' };

  if (offer.stripeHoldId) {
    try { await stripe.paymentIntents.cancel(offer.stripeHoldId); } catch { /* ignore */ }
  }

  const [updated] = await db.update(listingOffer).set({ status: 'CANCELED', updatedAt: new Date() })
    .where(eq(listingOffer.id, offerId)).returning();

  return { success: true, offer: updated };
}

/** Expire an offer (called by job) */
export async function expireOffer(offerId: string): Promise<OfferResult> {
  const offer = await getOfferById(offerId);
  if (!offer) return { success: false, error: 'Offer not found' };
  if (offer.status !== 'PENDING') return { success: true }; // Idempotent

  if (offer.stripeHoldId) {
    try { await stripe.paymentIntents.cancel(offer.stripeHoldId); } catch { /* ignore */ }
  }

  const [updated] = await db.update(listingOffer).set({ status: 'EXPIRED', updatedAt: new Date() })
    .where(eq(listingOffer.id, offerId)).returning();

  return { success: true, offer: updated };
}

/**
 * Decline all pending offers for a listing (when listing sells at full price).
 * Releases Stripe holds and marks offers as DECLINED.
 */
export async function declineAllPendingOffersForListing(
  listingId: string,
  excludeOfferId?: string
): Promise<{ declined: number }> {
  // Build where clause
  const conditions = [
    eq(listingOffer.listingId, listingId),
    eq(listingOffer.status, 'PENDING'),
  ];
  if (excludeOfferId) {
    conditions.push(ne(listingOffer.id, excludeOfferId));
  }

  // Get pending offers
  const pendingOffers = await db
    .select({ id: listingOffer.id, stripeHoldId: listingOffer.stripeHoldId })
    .from(listingOffer)
    .where(and(...conditions));

  if (pendingOffers.length === 0) {
    return { declined: 0 };
  }

  // Release Stripe holds
  for (const offer of pendingOffers) {
    if (offer.stripeHoldId) {
      try {
        await stripe.paymentIntents.cancel(offer.stripeHoldId);
      } catch {
        // Hold may already be released or captured
      }
    }
  }

  // Mark all as DECLINED
  const now = new Date();
  await db
    .update(listingOffer)
    .set({ status: 'DECLINED', respondedAt: now, updatedAt: now })
    .where(and(...conditions));

  return { declined: pendingOffers.length };
}
