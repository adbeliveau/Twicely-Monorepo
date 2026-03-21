import { getListingBySlug, getSimilarListings, getSellerListings } from '@/lib/queries/listings';
import { getSellerReviewSummary, getSellerReviews, getSellerDSRAverages } from '@/lib/queries/reviews';
import { getUserAddresses } from '@/lib/queries/address';
import { countPendingOffersForListing } from '@twicely/commerce/offer-queries';
import { getWatchStatus, getWatcherCount } from '@/lib/queries/watchlist';
import { getRecentlyViewed } from '@/lib/queries/browsing-history';
import { getPriceHistory, getSoldComparables, type PriceHistoryPoint, type SoldComparable } from '@/lib/queries/price-history';
import { getWatcherOfferForBuyer, type WatcherOfferForBuyer } from '@/lib/queries/watcher-offers';
import { getUserAlertForListing, type PriceAlertType } from '@/lib/queries/price-alerts';
import type { ListingDetailData } from '@/types/listings';
import type { BrowsingHistoryItem } from '@/lib/queries/browsing-history';

export interface UserPriceAlert {
  id: string;
  alertType: PriceAlertType;
  targetPriceCents: number | null;
  percentDrop: number | null;
}

export interface ListingPageData {
  listing: ListingDetailData;
  similarListings: Awaited<ReturnType<typeof getSimilarListings>>;
  sellerListings: Awaited<ReturnType<typeof getSellerListings>>;
  reviewSummary: Awaited<ReturnType<typeof getSellerReviewSummary>>;
  recentReviews: Awaited<ReturnType<typeof getSellerReviews>>;
  dsrAverages: Awaited<ReturnType<typeof getSellerDSRAverages>>;
  userAddresses: Awaited<ReturnType<typeof getUserAddresses>>;
  pendingOfferCount: number;
  userIsWatching: boolean;
  userNotifyPriceDrop: boolean;
  watcherCount: number;
  recentlyViewed: BrowsingHistoryItem[];
  priceHistory: PriceHistoryPoint[];
  soldComparables: SoldComparable[];
  watcherOffer: WatcherOfferForBuyer | null;
  userPriceAlert: UserPriceAlert | null;
  isOwnListing: boolean;
}

/**
 * Load all data needed for the listing detail page.
 * Returns null if the listing is not found.
 */
export async function getListingPageData(
  slug: string,
  currentUserId: string | null
): Promise<ListingPageData | null> {
  const listing = await getListingBySlug(slug);

  if (!listing) {
    return null;
  }

  const isOwnListing = currentUserId === listing.seller.userId;

  const [
    similarListings,
    sellerListings,
    reviewSummary,
    recentReviews,
    dsrAverages,
    userAddresses,
    pendingOfferCount,
    watchStatus,
    watcherCount,
    recentlyViewed,
    priceHistory,
    soldComparables,
    watcherOffer,
    userPriceAlert,
  ] = await Promise.all([
    listing.category
      ? getSimilarListings(listing.id, listing.category.id, listing.priceCents, 6)
      : Promise.resolve([]),
    getSellerListings(listing.seller.userId, listing.id, 6),
    getSellerReviewSummary(listing.seller.userId),
    getSellerReviews(listing.seller.userId, { page: 1, pageSize: 3 }),
    getSellerDSRAverages(listing.seller.userId),
    currentUserId ? getUserAddresses(currentUserId) : Promise.resolve([]),
    countPendingOffersForListing(listing.id),
    currentUserId ? getWatchStatus(currentUserId, listing.id) : Promise.resolve({ isWatching: false, notifyPriceDrop: false }),
    getWatcherCount(listing.id),
    currentUserId ? getRecentlyViewed(currentUserId, listing.id) : Promise.resolve([]),
    getPriceHistory(listing.id),
    listing.category ? getSoldComparables(listing.id, listing.category.id) : Promise.resolve([]),
    getWatcherOfferForBuyer(listing.id, currentUserId),
    currentUserId ? getUserAlertForListing(currentUserId, listing.id) : Promise.resolve(null),
  ]);

  return {
    listing,
    similarListings,
    sellerListings,
    reviewSummary,
    recentReviews,
    dsrAverages,
    userAddresses,
    pendingOfferCount,
    userIsWatching: watchStatus.isWatching,
    userNotifyPriceDrop: watchStatus.notifyPriceDrop,
    watcherCount,
    recentlyViewed,
    priceHistory,
    soldComparables,
    watcherOffer,
    userPriceAlert,
    isOwnListing,
  };
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function buildBreadcrumbs(listing: {
  title: string;
  category: { name: string; slug: string; parent: { name: string; slug: string } | null } | null;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
  if (listing.category) {
    if (listing.category.parent) {
      items.push({ label: listing.category.parent.name, href: `/c/${listing.category.parent.slug}` });
      items.push({ label: listing.category.name, href: `/c/${listing.category.parent.slug}/${listing.category.slug}` });
    } else {
      items.push({ label: listing.category.name, href: `/c/${listing.category.slug}` });
    }
  }
  items.push({ label: listing.title });
  return items;
}

export function buildJsonLd(
  listing: { title: string; description: string; priceCents: number; condition: string; images: { url: string }[]; seller: { displayName: string } },
  isUnavailable: boolean
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: listing.images.map((img) => img.url),
    offers: {
      '@type': 'Offer',
      price: (listing.priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: isUnavailable ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: mapConditionToSchema(listing.condition),
    },
    seller: { '@type': 'Person', name: listing.seller.displayName },
  };
}

function mapConditionToSchema(condition: string): string {
  const mapping: Record<string, string> = {
    NEW_WITH_TAGS: 'https://schema.org/NewCondition',
    NEW_WITHOUT_TAGS: 'https://schema.org/NewCondition',
    NEW_WITH_DEFECTS: 'https://schema.org/NewCondition',
    LIKE_NEW: 'https://schema.org/UsedCondition',
    VERY_GOOD: 'https://schema.org/UsedCondition',
    GOOD: 'https://schema.org/UsedCondition',
    ACCEPTABLE: 'https://schema.org/UsedCondition',
  };
  return mapping[condition] ?? 'https://schema.org/UsedCondition';
}
