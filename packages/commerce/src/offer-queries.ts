import { db } from '@twicely/db';
import { listingOffer, listing, user } from '@twicely/db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export interface OfferWithListing {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  offerCents: number;
  currency: string;
  message: string | null;
  status: string;
  type: string;
  expiresAt: Date;
  parentOfferId: string | null;
  counterByRole: string | null;
  counterCount: number;
  respondedAt: Date | null;
  stripeHoldId: string | null;
  shippingAddressId: string | null;
  createdAt: Date;
  listing: { id: string; title: string | null; slug: string | null; priceCents: number | null; status: string };
}

export interface OfferWithDetails extends OfferWithListing {
  buyer?: { id: string; name: string | null; buyerQualityTier: string };
  seller?: { id: string; name: string | null; email: string | null };
}

// Reusable select fields
const offerFields = {
  id: listingOffer.id,
  listingId: listingOffer.listingId,
  buyerId: listingOffer.buyerId,
  sellerId: listingOffer.sellerId,
  offerCents: listingOffer.offerCents,
  currency: listingOffer.currency,
  message: listingOffer.message,
  status: listingOffer.status,
  type: listingOffer.type,
  expiresAt: listingOffer.expiresAt,
  parentOfferId: listingOffer.parentOfferId,
  counterByRole: listingOffer.counterByRole,
  counterCount: listingOffer.counterCount,
  respondedAt: listingOffer.respondedAt,
  stripeHoldId: listingOffer.stripeHoldId,
  shippingAddressId: listingOffer.shippingAddressId,
  createdAt: listingOffer.createdAt,
};

const listingFields = {
  listing: { id: listing.id, title: listing.title, slug: listing.slug, priceCents: listing.priceCents, status: listing.status },
};

const buyerFields = { buyer: { id: user.id, name: user.name, buyerQualityTier: user.buyerQualityTier } };

/** Walk parentOfferId up to root, return ordered array (oldest first) */
export async function getOfferChain(offerId: string): Promise<OfferWithListing[]> {
  const chain: OfferWithListing[] = [];
  let currentId: string | null = offerId;
  const ancestors: string[] = [];

  while (currentId) {
    ancestors.unshift(currentId);
    const [offer] = await db.select({ parentOfferId: listingOffer.parentOfferId })
      .from(listingOffer).where(eq(listingOffer.id, currentId)).limit(1);
    currentId = offer?.parentOfferId ?? null;
  }

  for (const id of ancestors) {
    const [offer] = await db.select({ ...offerFields, ...listingFields })
      .from(listingOffer).innerJoin(listing, eq(listing.id, listingOffer.listingId))
      .where(eq(listingOffer.id, id)).limit(1);
    if (offer) chain.push(offer);
  }
  return chain;
}

/** Get all PENDING offers for a listing, ordered by offerCents DESC */
export async function getActiveOffersForListing(listingId: string): Promise<OfferWithDetails[]> {
  return db.select({ ...offerFields, ...listingFields, ...buyerFields })
    .from(listingOffer)
    .innerJoin(listing, eq(listing.id, listingOffer.listingId))
    .innerJoin(user, eq(user.id, listingOffer.buyerId))
    .where(and(eq(listingOffer.listingId, listingId), eq(listingOffer.status, 'PENDING')))
    .orderBy(desc(listingOffer.offerCents));
}

/** Get paginated buyer offers with listing info */
export async function getActiveOffersForBuyer(
  buyerId: string,
  opts: { page: number; limit: number }
): Promise<{ offers: OfferWithListing[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const [offers, [totalResult]] = await Promise.all([
    db.select({ ...offerFields, ...listingFields })
      .from(listingOffer).innerJoin(listing, eq(listing.id, listingOffer.listingId))
      .where(eq(listingOffer.buyerId, buyerId))
      .orderBy(desc(listingOffer.createdAt)).limit(opts.limit).offset(offset),
    db.select({ count: count() }).from(listingOffer).where(eq(listingOffer.buyerId, buyerId)),
  ]);
  return { offers, total: totalResult?.count ?? 0 };
}

/** Get paginated seller offers with listing + buyer info */
export async function getActiveOffersForSeller(
  sellerId: string,
  opts: { page: number; limit: number }
): Promise<{ offers: OfferWithDetails[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const [offers, [totalResult]] = await Promise.all([
    db.select({ ...offerFields, ...listingFields, ...buyerFields })
      .from(listingOffer)
      .innerJoin(listing, eq(listing.id, listingOffer.listingId))
      .innerJoin(user, eq(user.id, listingOffer.buyerId))
      .where(eq(listingOffer.sellerId, sellerId))
      .orderBy(desc(listingOffer.createdAt)).limit(opts.limit).offset(offset),
    db.select({ count: count() }).from(listingOffer).where(eq(listingOffer.sellerId, sellerId)),
  ]);
  return { offers, total: totalResult?.count ?? 0 };
}

/** Count active offers by buyer for a specific seller (spam limit: max 3) */
export async function countActiveOffersByBuyerForSeller(buyerId: string, sellerId: string): Promise<number> {
  const [result] = await db.select({ count: count() }).from(listingOffer)
    .where(and(eq(listingOffer.buyerId, buyerId), eq(listingOffer.sellerId, sellerId), eq(listingOffer.status, 'PENDING')));
  return result?.count ?? 0;
}

/** Count all active offers by buyer (global limit: max 10) */
export async function countActiveOffersByBuyer(buyerId: string): Promise<number> {
  const [result] = await db.select({ count: count() }).from(listingOffer)
    .where(and(eq(listingOffer.buyerId, buyerId), eq(listingOffer.status, 'PENDING')));
  return result?.count ?? 0;
}

/** Count active offers by buyer for a specific listing (per-listing limit) */
export async function countActiveOffersByBuyerForListing(buyerId: string, listingId: string): Promise<number> {
  const [result] = await db.select({ count: count() }).from(listingOffer)
    .where(and(eq(listingOffer.buyerId, buyerId), eq(listingOffer.listingId, listingId), eq(listingOffer.status, 'PENDING')));
  return result?.count ?? 0;
}

/** Get single offer by ID with listing and user joins */
export async function getOfferById(offerId: string): Promise<OfferWithDetails | null> {
  const [offer] = await db.select({ ...offerFields, ...listingFields, ...buyerFields })
    .from(listingOffer)
    .innerJoin(listing, eq(listing.id, listingOffer.listingId))
    .innerJoin(user, eq(user.id, listingOffer.buyerId))
    .where(eq(listingOffer.id, offerId)).limit(1);
  return offer ?? null;
}

/** Count pending offers for a listing (for "X offers" badge) */
export async function countPendingOffersForListing(listingId: string): Promise<number> {
  const [result] = await db.select({ count: count() }).from(listingOffer)
    .where(and(eq(listingOffer.listingId, listingId), eq(listingOffer.status, 'PENDING')));
  return result?.count ?? 0;
}

/** Check if buyer has a declined offer within the cooldown window for same listing + amount */
export async function hasRecentDeclinedOffer(buyerId: string, listingId: string, offerCents: number): Promise<boolean> {
  const cooldownHours = await getPlatformSetting<number>('commerce.offer.declineCooldownHours', 24);
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const [result] = await db.select({ count: count() }).from(listingOffer)
    .where(and(
      eq(listingOffer.buyerId, buyerId),
      eq(listingOffer.listingId, listingId),
      eq(listingOffer.offerCents, offerCents),
      eq(listingOffer.status, 'DECLINED'),
      sql`${listingOffer.respondedAt} > ${cutoff}`
    ));
  return (result?.count ?? 0) > 0;
}

/** Get offer with both buyer and seller details for notifications */
export async function getOfferWithParties(offerId: string): Promise<(OfferWithDetails & { seller?: { id: string; name: string | null; email: string | null } }) | null> {
  const [offer] = await db.select({
    ...offerFields,
    ...listingFields,
    ...buyerFields,
  })
    .from(listingOffer)
    .innerJoin(listing, eq(listing.id, listingOffer.listingId))
    .innerJoin(user, eq(user.id, listingOffer.buyerId))
    .where(eq(listingOffer.id, offerId)).limit(1);

  if (!offer) return null;

  // Fetch seller separately since we need two joins on user table
  const [sellerData] = await db.select({ id: user.id, name: user.name, email: user.email })
    .from(user).where(eq(user.id, offer.sellerId)).limit(1);

  return { ...offer, seller: sellerData ?? undefined };
}
