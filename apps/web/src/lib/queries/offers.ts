import { db } from '@twicely/db';
import { listingImage } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getActiveOffersForBuyer, getActiveOffersForSeller } from '@twicely/commerce/offer-queries';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELED' | 'COUNTERED';

export interface BuyerOfferRow {
  id: string;
  listingId: string;
  offerCents: number;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  listing: { id: string; title: string | null; slug: string | null; priceCents: number | null };
  thumbnail: string | null;
  orderId: string | null;
  counterByRole: string | null;
  parentOfferId: string | null;
}

export interface SellerOfferRow extends BuyerOfferRow {
  buyerId: string;
  buyerName: string | null;
  buyerCompletedPurchases: number;
  buyerCreatedAt: Date;
  buyerVerified: boolean;
}

interface GetOffersOptions {
  status?: OfferStatus | 'all';
  page?: number;
  perPage?: number;
}

async function getThumbnailMap(listingIds: string[]): Promise<Map<string, string>> {
  if (listingIds.length === 0) return new Map();
  const thumbnails = await db
    .select({ listingId: listingImage.listingId, url: listingImage.url })
    .from(listingImage)
    .where(and(inArray(listingImage.listingId, listingIds), eq(listingImage.isPrimary, true)));
  return new Map(thumbnails.map((t) => [t.listingId, t.url]));
}

function filterByStatus<T extends { status: string }>(items: T[], status: OfferStatus | 'all'): T[] {
  return status === 'all' ? items : items.filter((o) => o.status === status);
}

/** Get paginated buyer offers with listing thumbnail. */
export async function getBuyerOffers(
  buyerId: string,
  options: GetOffersOptions = {}
): Promise<{ offers: BuyerOfferRow[]; total: number; page: number; perPage: number }> {
  const { status = 'all', page = 1, perPage = 20 } = options;
  const { offers: raw, total: rawTotal } = await getActiveOffersForBuyer(buyerId, { page, limit: perPage * 2 });

  const filtered = filterByStatus(raw, status);
  const paginated = filtered.slice(0, perPage);
  if (paginated.length === 0) return { offers: [], total: 0, page, perPage };

  const thumbMap = await getThumbnailMap([...new Set(paginated.map((o) => o.listingId))]);
  const offers: BuyerOfferRow[] = paginated.map((o) => ({
    id: o.id, listingId: o.listingId, offerCents: o.offerCents, status: o.status,
    createdAt: o.createdAt, expiresAt: o.expiresAt,
    listing: { id: o.listing.id, title: o.listing.title, slug: o.listing.slug, priceCents: o.listing.priceCents },
    thumbnail: thumbMap.get(o.listingId) ?? null, orderId: null,
    counterByRole: o.counterByRole, parentOfferId: o.parentOfferId,
  }));
  return { offers, total: status === 'all' ? rawTotal : filtered.length, page, perPage };
}

/** Get paginated seller offers with listing thumbnail and buyer info. */
export async function getSellerOffers(
  sellerId: string,
  options: GetOffersOptions = {}
): Promise<{ offers: SellerOfferRow[]; total: number; page: number; perPage: number }> {
  const { status = 'all', page = 1, perPage = 20 } = options;
  const { offers: raw, total: rawTotal } = await getActiveOffersForSeller(sellerId, { page, limit: perPage * 2 });

  const filtered = filterByStatus(raw, status);
  const paginated = filtered.slice(0, perPage);
  if (paginated.length === 0) return { offers: [], total: 0, page, perPage };

  const thumbMap = await getThumbnailMap([...new Set(paginated.map((o) => o.listingId))]);
  const offers: SellerOfferRow[] = paginated.map((o) => ({
    id: o.id, listingId: o.listingId, buyerId: o.buyerId, offerCents: o.offerCents, status: o.status,
    createdAt: o.createdAt, expiresAt: o.expiresAt,
    listing: { id: o.listing.id, title: o.listing.title, slug: o.listing.slug, priceCents: o.listing.priceCents },
    thumbnail: thumbMap.get(o.listingId) ?? null, orderId: null,
    buyerName: o.buyer?.name ?? null,
    buyerCompletedPurchases: o.buyer?.completedPurchaseCount ?? 0,
    buyerCreatedAt: o.buyer?.createdAt ?? new Date(),
    buyerVerified: (o.buyer?.emailVerified ?? false) && (o.buyer?.phoneVerified ?? false),
    counterByRole: o.counterByRole, parentOfferId: o.parentOfferId,
  }));
  return { offers, total: status === 'all' ? rawTotal : filtered.length, page, perPage };
}
