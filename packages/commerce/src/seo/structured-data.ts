/**
 * JSON-LD Structured Data Generators — Canonical 21 §6
 *
 * Generates Schema.org structured data for listings, categories,
 * organization, website, and breadcrumbs.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ListingForSeo = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  status: string;
  condition: string;
  brand: string | null;
  quantity: number;
  availableQuantity: number | null;
  soldAt: Date | null;
  hasVariations: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  sellerName: string;
  sellerUsername: string;
  sellerAverageRating: number | null;
  sellerTotalReviews: number;
  images: Array<{ url: string; altText: string | null }>;
};

export type ListingCardForSeo = {
  slug: string;
};

export type Breadcrumb = {
  name: string;
  href: string;
};

export type SellerForSeo = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  averageRating: number | null;
  totalReviews: number;
};

export type ProductJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  description?: string;
  image?: string[];
  sku: string;
  brand?: { '@type': 'Brand'; name: string };
  itemCondition: string;
  offers: OfferJsonLd | OfferJsonLd[];
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: string;
  };
};

export type OfferJsonLd = {
  '@type': 'Offer';
  url: string;
  priceCurrency: string;
  price: string;
  availability: string;
  seller?: { '@type': 'Person'; name: string; url: string };
  sku?: string;
  size?: string;
  color?: string;
};

export type BreadcrumbJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
};

export type ItemListJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  name: string;
  url: string;
  numberOfItems: number;
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    url: string;
  }>;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = 'https://twicely.co';

const CONDITION_MAP: Record<string, string> = {
  NEW_WITH_TAGS: 'https://schema.org/NewCondition',
  NEW_WITHOUT_TAGS: 'https://schema.org/NewCondition',
  NEW_WITH_DEFECTS: 'https://schema.org/UsedCondition',
  LIKE_NEW: 'https://schema.org/UsedCondition',
  VERY_GOOD: 'https://schema.org/UsedCondition',
  GOOD: 'https://schema.org/UsedCondition',
  ACCEPTABLE: 'https://schema.org/UsedCondition',
};

// ─── Functions ─────────────────────────────────────────────────────────────────

/** Map internal condition code to Schema.org condition URL. */
export function mapConditionToSchemaOrg(condition: string): string {
  return CONDITION_MAP[condition] ?? 'https://schema.org/UsedCondition';
}

/** Generate Schema.org Product JSON-LD for a listing detail page. */
export function generateProductJsonLd(listing: ListingForSeo): ProductJsonLd {
  const result: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description ?? undefined,
    image: listing.images.length > 0 ? listing.images.map((img) => img.url) : undefined,
    sku: listing.id,
    brand: listing.brand ? { '@type': 'Brand', name: listing.brand } : undefined,
    itemCondition: mapConditionToSchemaOrg(listing.condition),
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/i/${listing.slug}`,
      priceCurrency: 'USD',
      price: (listing.priceCents / 100).toFixed(2),
      availability:
        listing.status === 'ACTIVE' && (listing.availableQuantity ?? listing.quantity) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      seller: {
        '@type': 'Person',
        name: listing.sellerName,
        url: `${BASE_URL}/st/${listing.sellerUsername}`,
      },
    },
    aggregateRating:
      listing.sellerAverageRating !== null && listing.sellerTotalReviews > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: listing.sellerAverageRating.toFixed(1),
            reviewCount: String(listing.sellerTotalReviews),
          }
        : undefined,
  };

  return result;
}

/** Generate Schema.org BreadcrumbList JSON-LD. */
export function generateBreadcrumbJsonLd(breadcrumbs: Breadcrumb[]): BreadcrumbJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      name: crumb.name,
      item: i < breadcrumbs.length - 1 ? `${BASE_URL}${crumb.href}` : undefined,
    })),
  };
}

/** Generate Schema.org ItemList JSON-LD for category pages. Top 20 items only. */
export function generateItemListJsonLd(
  listings: ListingCardForSeo[],
  categoryName: string,
  categoryUrl: string,
): ItemListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categoryName,
    url: `${BASE_URL}${categoryUrl}`,
    numberOfItems: listings.length,
    itemListElement: listings.slice(0, 20).map((listing, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      url: `${BASE_URL}/i/${listing.slug}`,
    })),
  };
}

/** Organization structured data (static). */
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Twicely',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  sameAs: [
    'https://twitter.com/twicely',
    'https://instagram.com/twicely',
  ],
};

/** WebSite structured data with SearchAction for sitelinks search box. */
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Twicely',
  url: BASE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/s?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/** Seller storefront JSON-LD (Person with AggregateRating). */
export function generateSellerJsonLd(seller: SellerForSeo): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: seller.displayName,
    url: `${BASE_URL}/st/${seller.username}`,
    ...(seller.averageRating !== null && seller.totalReviews > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: seller.averageRating.toFixed(1),
        reviewCount: String(seller.totalReviews),
        bestRating: '5',
        worstRating: '1',
      },
    }),
  };
}
