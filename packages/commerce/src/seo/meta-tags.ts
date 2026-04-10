/**
 * Meta Tag Generators — Canonical 21 §7
 *
 * Generates Next.js Metadata objects for listing, category,
 * search, and storefront pages.
 */

import type { ListingForSeo } from './structured-data';

/**
 * Next.js Metadata type (subset used by SEO generators).
 * Defined inline to avoid a dependency on 'next' in the commerce package.
 */
export type SeoMetadata = {
  title?: string;
  description?: string;
  robots?: string | { index: boolean; follow: boolean };
  alternates?: { canonical?: string };
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    images?: Array<{ url: string; width?: number; height?: number; alt?: string }>;
    type?: string;
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    images?: string[];
  };
  other?: Record<string, string>;
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CategoryForSeo = {
  slug: string;
  name: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
};

export type SellerForMetaSeo = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://twicely.co';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ─── Robots Directive ──────────────────────────────────────────────────────────

/**
 * Compute robots directive for a listing.
 * Preserves Decision #71 SOLD listing index window logic.
 *
 * @param indexEnabled - from getPlatformSetting('seo.soldListingIndexEnabled', true)
 * @param indexDays - from getPlatformSetting('seo.soldListingIndexDays', 90)
 */
export function computeRobotsDirective(
  listing: Pick<ListingForSeo, 'status' | 'soldAt'>,
  indexEnabled: boolean = true,
  indexDays: number = 90,
): string | undefined {
  if (listing.status === 'REMOVED') return 'noindex, nofollow';
  if (listing.status === 'ENDED' || listing.status === 'PAUSED' || listing.status === 'RESERVED') return 'noindex';
  if (listing.status === 'SOLD') {
    if (!indexEnabled || !listing.soldAt) return 'noindex';
    const ageMs = Date.now() - new Date(listing.soldAt).getTime();
    const ageDays = ageMs / 86_400_000;
    if (ageDays > indexDays) return 'noindex';
    // Within window: indexable
    return undefined;
  }
  // ACTIVE: indexable
  return undefined;
}

// ─── Meta Generators ───────────────────────────────────────────────────────────

/** Generate Metadata for a listing detail page. Canonical 21 §7.1 */
export function generateListingMeta(
  listing: ListingForSeo,
  robotsDirective: string | undefined,
): SeoMetadata {
  const priceDisplay = listing.hasVariations &&
    listing.minPriceCents !== undefined &&
    listing.maxPriceCents !== undefined &&
    listing.minPriceCents !== listing.maxPriceCents
    ? `${formatPrice(listing.minPriceCents)} - ${formatPrice(listing.maxPriceCents)}`
    : formatPrice(listing.priceCents);

  const title = `${listing.title} \u2014 ${priceDisplay} | Twicely`;
  const description = truncate(
    listing.description || `Buy ${listing.title} for ${priceDisplay} on Twicely`,
    160,
  );

  return {
    title,
    description,
    robots: robotsDirective,
    alternates: { canonical: `${BASE_URL}/i/${listing.slug}` },
    openGraph: {
      title: listing.title,
      description,
      url: `${BASE_URL}/i/${listing.slug}`,
      siteName: 'Twicely',
      images: listing.images[0]
        ? [{ url: listing.images[0].url, width: 1200, height: 630, alt: listing.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: listing.title,
      description,
      images: listing.images[0] ? [listing.images[0].url] : undefined,
    },
    other: {
      'og:type': 'product',
      'product:price:amount': (listing.priceCents / 100).toFixed(2),
      'product:price:currency': 'USD',
    },
  };
}

/** Generate Metadata for a category browse page. Canonical 21 §7.2 */
export function generateCategoryMeta(
  cat: CategoryForSeo,
  listingCount: number,
  page?: number,
): SeoMetadata {
  const baseName = cat.metaTitle || cat.name;
  const title = page && page > 1
    ? `${baseName} - Page ${page} | Twicely`
    : `${baseName} | Twicely`;
  const description = truncate(
    cat.metaDescription || `Browse ${listingCount} items in ${cat.name} on Twicely. Peer-to-peer resale marketplace.`,
    160,
  );

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/c/${cat.slug}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/c/${cat.slug}`,
      siteName: 'Twicely',
      images: cat.ogImageUrl ? [{ url: cat.ogImageUrl }] : undefined,
    },
  };
}

/** Generate Metadata for search results page. Canonical 21 §7.3 — always noindex, follow */
export function generateSearchMeta(query: string, resultCount: number): SeoMetadata {
  return {
    title: query ? `Search: ${query} | Twicely` : 'Search | Twicely',
    description: query ? `Found ${resultCount} results for "${query}"` : 'Search for items on Twicely',
    robots: { index: false, follow: true },
  };
}

/** Generate Metadata for a seller storefront page. Canonical 21 §7.4 */
export function generateStoreMeta(seller: SellerForMetaSeo): SeoMetadata {
  const title = `${seller.displayName}'s Store | Twicely`;
  const description = truncate(
    seller.bio || `Shop ${seller.displayName}'s listings on Twicely`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/st/${seller.username}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/st/${seller.username}`,
      siteName: 'Twicely',
    },
  };
}
