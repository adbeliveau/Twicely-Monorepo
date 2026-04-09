# Canonical 21 -- SEO & Public Discovery

**Status:** DRAFT (V4)
**Domain:** SEO, Structured Data, Sitemaps, Meta Tags, Canonical URLs, Public Browse
**Depends on:** Canonical 01 (Listings Core), Canonical 02 (Search & Discovery), Canonical 03 (Variations & Catalog)
**Package:** `apps/web` (Next.js metadata API, route handlers), `packages/commerce/src/seo/` (shared helpers), `packages/jobs` (sitemap pre-warm cron)
**V2 lineage:** Install Phase 39 (SEO + Public Browse Foundation)
**V3 baseline:** Next.js App Router with `generateMetadata()`, `listing.slug` column exists, `category.metaTitle`/`category.metaDescription` columns exist, `listing-page-metadata.ts` already handles SOLD listing index windows

> **Law:** This file is the single source of truth for all SEO behavior: canonical URLs, structured data, sitemap generation, robots directives, Open Graph tags, and server-side rendering requirements for crawlers. If V2 Phase 39 conflicts, this file wins.
> **Platform Settings Authority:** All configurable SEO behavior reads from `platform_settings`. Hardcoded values are fallbacks only.

---

## 1. Purpose

This canonical defines the SEO and public discovery system for Twicely V4. It governs:

- Canonical URL generation and slug strategy for all public entities
- JSON-LD structured data (Product, Offer, BreadcrumbList, Organization, WebSite, ItemList)
- Open Graph and Twitter Card meta tag generation
- Dynamic sitemap generation with sitemap index
- robots.txt configuration
- Server-side rendering requirements for search engine crawlers
- Category landing page SEO (H1, meta, structured breadcrumbs)
- Pagination SEO (canonical handling for paginated results)
- Seller storefront structured data (AggregateRating)
- Variation-aware structured data (multiple Offers per Product)
- SOLD listing indexing window (Decision #71)
- Redirect rule management (301/302)

**If SEO behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Server-rendered by default**: All public pages (listing detail, category browse, storefronts, static pages) MUST render complete HTML on the server. No JavaScript-only content for critical SEO elements.
2. **One canonical URL per entity**: Every listing, category, and storefront has exactly one canonical URL. All other URLs (with query params, tracking, etc.) point to the canonical via `<link rel="canonical">`.
3. **Structured data follows Schema.org**: JSON-LD is the only structured data format. Microdata and RDFa are not used.
4. **Sitemaps are dynamic**: Generated on request (with caching), not static files. Updated as listings/categories change.
5. **Integer cents for display**: Prices in structured data are converted from integer cents to decimal strings at render time only (e.g., `1999` -> `"19.99"`).
6. **No indexing of private/transactional pages**: Checkout, account, hub/admin, and API routes are always `noindex`.
7. **SOLD listings stay indexed temporarily**: Decision #71 -- SOLD listings remain indexed for a configurable window to capture long-tail traffic, then noindex.
8. **All thresholds from platform_settings**: Sitemap limits, cache TTLs, crawl delays, index windows -- all configurable.

---

## 3. URL Structure

### 3.1 Canonical URL Patterns

| Entity | URL Pattern | Example |
|---|---|---|
| Homepage | `/` | `https://twicely.co/` |
| Listing detail | `/i/{slug}` | `https://twicely.co/i/nike-air-jordan-retro-abc123` |
| Category browse | `/c/{slug}` | `https://twicely.co/c/electronics` |
| Subcategory | `/c/{slug}/{subslug}` | `https://twicely.co/c/electronics/phones` |
| Search results | `/s?q={query}` | `https://twicely.co/s?q=nike+dunks` |
| Seller storefront | `/st/{username}` | `https://twicely.co/st/vintagefinds` |
| Help center | `/h/{category-slug}` | `https://twicely.co/h/shipping` |
| Help article | `/h/{category-slug}/{article-slug}` | `https://twicely.co/h/shipping/how-to-ship` |
| Policy pages | `/p/{slug}` | `https://twicely.co/p/terms` |

### 3.2 Slug Generation

```ts
// packages/commerce/src/seo/slugify.ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
```

**Listing slugs:**
- Format: `{slugified-title}-{cuid}` (the CUID suffix ensures uniqueness)
- Generated on listing creation, stored in `listing.slug`
- Slug is immutable after creation (title changes do NOT update slug)
- Old URLs with changed titles still resolve (slug is the lookup key)

**Category slugs:**
- Stored in `category.slug` (already exists in V3)
- Admin-managed, manually set
- Must be unique at each depth level

**Storefront slugs:**
- Same as the user's username
- Unique by definition (username is unique)

### 3.3 Canonical URL Generation

```ts
// packages/commerce/src/seo/url-service.ts
const BASE_URL = getPlatformSetting('seo.baseUrl', 'https://twicely.co');

export function getListingCanonicalUrl(slug: string): string {
  return `${BASE_URL}/i/${slug}`;
}

export function getCategoryCanonicalUrl(path: string): string {
  return `${BASE_URL}/c/${path}`;
}

export function getStorefrontCanonicalUrl(username: string): string {
  return `${BASE_URL}/st/${username}`;
}
```

### 3.4 Base Domain

```
Production:  https://twicely.co
Hub (admin): https://hub.twicely.co  (never indexed, separate subdomain)
```

---

## 4. Schema

### 4.1 Existing V3 Fields Used (No Changes)

```ts
// listing table
listing.slug              // URL slug
listing.title             // Meta title source
listing.description       // Meta description source
listing.priceCents        // Price for structured data
listing.status            // Indexing rules
listing.soldAt            // SOLD listing indexing window
listing.activatedAt       // Freshness signal
listing.brand             // Brand for structured data

// category table
category.slug             // Category URL
category.metaTitle        // Override meta title
category.metaDescription  // Override meta description

// listingImage table
listingImage.url          // OG image
listingImage.altText      // Image alt text
```

### 4.2 New Column on `category`

```ts
// Add to packages/db/src/schema/catalog.ts category table
ogImageUrl: text('og_image_url'),  // Category-level Open Graph image
```

### 4.3 `seoRedirect` (packages/db/src/schema/seo.ts) -- New Table

```ts
export const seoRedirect = pgTable('seo_redirect', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  fromPath:     text('from_path').notNull().unique(),
  toPath:       text('to_path').notNull(),
  statusCode:   integer('status_code').notNull().default(301), // 301 permanent, 302 temporary
  isActive:     boolean('is_active').notNull().default(true),
  hitCount:     integer('hit_count').notNull().default(0),
  lastHitAt:    timestamp('last_hit_at', { withTimezone: true }),
  reason:       text('reason'),              // "category slug changed", "listing removed", etc.
  createdBy:    text('created_by'),          // staff user ID or 'system'
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeFromIdx: index('sr_active_from').on(table.isActive, table.fromPath),
}));
```

**Rules:**
- Redirect middleware runs in Next.js middleware before page rendering
- Maximum redirect rules: `seo.redirect.maxRules` (default: 10000)
- System auto-creates redirects when category slugs change
- Admin can create manual redirects via hub

---

## 5. Indexing Rules

### 5.1 By Listing Status

| Status | Indexable | `robots` | Duration |
|---|---|---|---|
| ACTIVE | Yes | (none -- default index) | Indefinite |
| SOLD | Conditional | `noindex` after window | `seo.soldListingIndexDays` (default: 90) |
| ENDED | No | `noindex` | Always |
| PAUSED | No | `noindex` | Always |
| REMOVED | No | `noindex, nofollow` | Always |
| DRAFT | Not accessible | 404 | Always |
| PENDING_REVIEW | Not accessible | 404 | Always |

### 5.2 SOLD Listing Indexing (Decision #71)

SOLD listings remain indexed for a configurable window to capture long-tail search traffic and buyer acquisition. After the window expires, they receive `noindex`.

```ts
// Already implemented in V3: listing-page-metadata.ts
if (listing.status === 'SOLD') {
  const indexEnabled = await getPlatformSetting<boolean>('seo.soldListingIndexEnabled', true);
  const indexDays = await getPlatformSetting<number>('seo.soldListingIndexDays', 90);
  if (!indexEnabled || !listing.soldAt) return 'noindex';
  const ageDays = (Date.now() - new Date(listing.soldAt).getTime()) / 86_400_000;
  if (ageDays > indexDays) return 'noindex';
  // else: indexable
}
```

### 5.3 Search Results Pages

Search result pages (`/s?q=...`) always have `noindex, follow`. They should NOT be indexed, but links within them should be followed.

### 5.4 Filtered Category Pages

Category pages with filter query params (e.g., `/c/shoes?brand=Nike&size=10`) are `noindex, follow`. Only clean category URLs without filters are indexed.

### 5.5 Admin/Hub Pages

All `hub.twicely.co` pages and all `/my/*` pages are `noindex, nofollow`. The hub middleware sets `X-Robots-Tag: noindex, nofollow` at the response level.

---

## 6. Structured Data (JSON-LD)

### 6.1 Product (Listing Detail)

Every ACTIVE or recently-SOLD listing page renders a `<script type="application/ld+json">` block:

```ts
// packages/commerce/src/seo/structured-data.ts
export function generateProductJsonLd(listing: ListingForSeo): ProductJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description ?? undefined,
    image: listing.images.map(img => img.url),
    sku: listing.id,
    brand: listing.brand
      ? { '@type': 'Brand', name: listing.brand }
      : undefined,
    itemCondition: mapConditionToSchemaOrg(listing.condition),
    offers: listing.hasVariations
      ? generateVariantOffers(listing)
      : {
          '@type': 'Offer',
          url: `https://twicely.co/i/${listing.slug}`,
          priceCurrency: 'USD',
          price: (listing.priceCents / 100).toFixed(2),
          availability: listing.status === 'ACTIVE' && (listing.availableQuantity ?? listing.quantity) > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/SoldOut',
          seller: {
            '@type': 'Person',
            name: listing.sellerName,
            url: `https://twicely.co/st/${listing.sellerUsername}`,
          },
        },
    aggregateRating: listing.sellerAverageRating && listing.sellerTotalReviews > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: listing.sellerAverageRating.toFixed(1),
          reviewCount: String(listing.sellerTotalReviews),
        }
      : undefined,
  };
}
```

**Condition Mapping:**

| Twicely Condition | Schema.org |
|---|---|
| NEW_WITH_TAGS | `https://schema.org/NewCondition` |
| NEW_WITHOUT_TAGS | `https://schema.org/NewCondition` |
| LIKE_NEW | `https://schema.org/UsedCondition` |
| VERY_GOOD | `https://schema.org/UsedCondition` |
| GOOD | `https://schema.org/UsedCondition` |
| ACCEPTABLE | `https://schema.org/UsedCondition` |
| NEW_WITH_DEFECTS | `https://schema.org/UsedCondition` |

**Variant-aware Product (when `hasVariations = true`):**

```ts
function generateVariantOffers(listing: ListingForSeo): OfferJsonLd[] {
  return listing.children.map(child => ({
    '@type': 'Offer',
    url: `https://twicely.co/i/${listing.slug}`,
    priceCurrency: 'USD',
    price: (child.priceCents / 100).toFixed(2),
    availability: child.availableQuantity > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    sku: child.sku,
    // Include variation attributes as additional properties
    ...(child.variationCombination.SIZE && { size: child.variationCombination.SIZE }),
    ...(child.variationCombination.COLOR && { color: child.variationCombination.COLOR }),
  }));
}
```

### 6.2 BreadcrumbList (Category Pages + Listing Detail)

```ts
export function generateBreadcrumbJsonLd(breadcrumbs: Breadcrumb[]): BreadcrumbJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: i < breadcrumbs.length - 1 ? `https://twicely.co${crumb.href}` : undefined,
    })),
  };
}
```

### 6.3 Organization (Home Page -- Global)

```ts
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Twicely',
  url: 'https://twicely.co',
  logo: 'https://twicely.co/logo.png',
  sameAs: [
    'https://twitter.com/twicely',
    'https://instagram.com/twicely',
  ],
};
```

### 6.4 WebSite (Home Page -- SearchAction)

```ts
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Twicely',
  url: 'https://twicely.co',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://twicely.co/s?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};
```

### 6.5 ItemList (Category Browse)

```ts
export function generateItemListJsonLd(
  listings: ListingCardForSeo[],
  categoryName: string,
  categoryUrl: string
): ItemListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categoryName,
    url: `https://twicely.co${categoryUrl}`,
    numberOfItems: listings.length,
    itemListElement: listings.slice(0, 20).map((listing, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://twicely.co/i/${listing.slug}`,
    })),
  };
}
```

### 6.6 Seller Storefront (AggregateRating)

```ts
export function generateSellerJsonLd(seller: SellerForSeo): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: seller.displayName,
    url: `https://twicely.co/st/${seller.username}`,
    ...(seller.averageRating && seller.totalReviews > 0 && {
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
```

---

## 7. Meta Tags (Next.js Metadata API)

All meta tags use Next.js App Router `generateMetadata()`. No manual `<head>` manipulation.

### 7.1 Listing Detail Page

```ts
export function generateListingMeta(listing: ListingForSeo): Metadata {
  const priceDisplay = listing.hasVariations && listing.minPriceCents !== listing.maxPriceCents
    ? `${formatPrice(listing.minPriceCents)} - ${formatPrice(listing.maxPriceCents)}`
    : formatPrice(listing.priceCents);

  const title = `${listing.title} -- ${priceDisplay} | Twicely`;
  const description = truncate(
    listing.description || `Buy ${listing.title} for ${priceDisplay} on Twicely`,
    160
  );

  return {
    title,
    description,
    robots: computeRobotsDirective(listing),
    alternates: { canonical: `https://twicely.co/i/${listing.slug}` },
    openGraph: {
      title: listing.title,
      description,
      url: `https://twicely.co/i/${listing.slug}`,
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
```

### 7.2 Category Browse Page

```ts
export function generateCategoryMeta(cat: CategoryForSeo, listingCount: number): Metadata {
  const title = cat.metaTitle || `${cat.name} | Twicely`;
  const description = cat.metaDescription
    || `Browse ${listingCount} items in ${cat.name} on Twicely. Peer-to-peer resale marketplace.`;

  return {
    title,
    description: truncate(description, 160),
    alternates: { canonical: `https://twicely.co/c/${cat.slug}` },
    openGraph: {
      title, description,
      url: `https://twicely.co/c/${cat.slug}`,
      siteName: 'Twicely',
      images: cat.ogImageUrl ? [{ url: cat.ogImageUrl }] : undefined,
    },
  };
}
```

### 7.3 Search Results Page

```ts
export function generateSearchMeta(query: string, resultCount: number): Metadata {
  return {
    title: query ? `Search: ${query} | Twicely` : 'Search | Twicely',
    description: query ? `Found ${resultCount} results for "${query}"` : 'Search for items on Twicely',
    robots: { index: false, follow: true },
  };
}
```

### 7.4 Seller Storefront Page

```ts
export function generateStoreMeta(seller: SellerForSeo): Metadata {
  const title = `${seller.displayName}'s Store | Twicely`;
  const description = truncate(
    seller.bio || `Shop ${seller.displayName}'s listings on Twicely`,
    160
  );
  return {
    title, description,
    alternates: { canonical: `https://twicely.co/st/${seller.username}` },
    openGraph: { title, description, url: `https://twicely.co/st/${seller.username}`, siteName: 'Twicely' },
  };
}
```

---

## 8. Sitemap Generation

### 8.1 Architecture

Use a **sitemap index** pattern for scalability:

```
/sitemap.xml                -> sitemap index (points to sub-sitemaps)
/sitemap-static.xml         -> static pages (home, about, policies, help)
/sitemap-categories.xml     -> all active categories
/sitemap-listings-[n].xml   -> active listings, chunked per file
/sitemap-stores.xml         -> active seller storefronts
```

### 8.2 Implementation

```ts
// packages/commerce/src/seo/sitemap.ts
export async function generateSitemapIndex(): Promise<string>
export async function generateStaticSitemap(): Promise<string>
export async function generateCategorySitemap(): Promise<string>
export async function generateListingSitemap(page: number): Promise<string>
export async function generateStoreSitemap(): Promise<string>

// Helpers
export function buildSitemapXml(urls: SitemapUrl[]): string
export function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string
```

### 8.3 URL Priorities

| Entity | changefreq | priority |
|---|---|---|
| Homepage | daily | 1.0 |
| Category (level 0) | daily | 0.9 |
| Category (level 1+) | weekly | 0.7 |
| Listing (ACTIVE) | daily | 0.6 |
| Listing (SOLD, within index window) | monthly | 0.3 |
| Seller storefront | weekly | 0.5 |
| Policy pages | monthly | 0.3 |
| Help articles | monthly | 0.4 |

### 8.4 Limits

- Max 50,000 URLs per sitemap file (Google/Bing limit)
- Max 50 MB uncompressed per file
- Listing sitemaps chunked at `seo.sitemap.listingsPerFile` (default: 10000) per file
- Only ACTIVE listings + SOLD listings within the index window are included

### 8.5 Cache & Refresh

- Sitemaps are generated on-demand with caching. Cache TTL: `seo.sitemap.cacheTtlMinutes` (default: 60)
- BullMQ job `seo:sitemap-regenerate` runs daily to pre-warm the cache. Cron pattern: `seo.sitemap.regenerateCronPattern` (default: `'0 3 * * *'`). tz: `'UTC'`

### 8.6 Next.js Route Handlers

```ts
// apps/web/src/app/sitemap.xml/route.ts
// apps/web/src/app/sitemap-static.xml/route.ts
// apps/web/src/app/sitemap-categories.xml/route.ts
// apps/web/src/app/sitemap-listings-[page].xml/route.ts
// apps/web/src/app/sitemap-stores.xml/route.ts
```

Each returns `new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=...' } })`.

---

## 9. robots.txt

```ts
// packages/commerce/src/seo/robots.ts
export function generateRobotsTxt(baseUrl: string, crawlDelay: number): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /my/
Disallow: /auth/
Disallow: /checkout/
Disallow: /cart/

# Hub routes (admin, staff-only)
Disallow: /d/
Disallow: /usr/
Disallow: /tx/
Disallow: /fin/
Disallow: /mod/
Disallow: /hd/
Disallow: /cfg/
Disallow: /roles/
Disallow: /audit/
Disallow: /health/
Disallow: /flags/
Disallow: /analytics/

Sitemap: ${baseUrl}/sitemap.xml

Crawl-delay: ${crawlDelay}
`;
}
```

Route handler at `apps/web/src/app/robots.txt/route.ts` calls `generateRobotsTxt()` with values from `platform_settings`.

---

## 10. Pagination SEO

### 10.1 Category Browse Pagination

- Page 1 canonical is the bare URL (no `?page=1`)
- Pages 2+ have `?page=N` in their canonical URL
- All paginated pages are indexable (no `noindex`)
- Filter parameters (e.g., `?brand=Nike&size=M`) trigger `noindex, follow` -- only clean category URLs are indexed

### 10.2 Meta Title for Paginated Pages

```ts
// Page 1: "Men's Sneakers | Twicely"
// Page 2+: "Men's Sneakers - Page 2 | Twicely"
const title = page > 1
  ? `${category.name} - Page ${page} | Twicely`
  : `${category.name} | Twicely`;
```

---

## 11. Server-Side Rendering Requirements

### 11.1 Critical SSR Elements (MUST be in initial HTML)

1. `<title>` tag
2. `<meta name="description">` tag
3. `<link rel="canonical">` tag
4. All Open Graph `<meta>` tags
5. JSON-LD `<script>` blocks
6. Visible `<h1>` tag
7. Product price text (for listing pages)
8. Primary product image `<img>` with `alt` text
9. Breadcrumb navigation text

### 11.2 Acceptable Client-Side Hydration

- Add to cart button interactivity
- Variant selector state changes
- Image gallery/carousel transitions
- Review loading (lazy)
- Related listings (lazy)

---

## 12. Category Landing Page SEO

Each category landing page MUST have:

1. **Unique H1**: The category name (e.g., `<h1>Men's Sneakers</h1>`)
2. **Meta title**: Custom `metaTitle` from category record, or `{Category Name} | Twicely`
3. **Meta description**: Custom `metaDescription` from category record, or auto-generated
4. **Breadcrumb trail**: From Home through parent categories to current category
5. **Category description**: If `category.description` exists, rendered as visible body text above listings
6. **Listing count**: "Showing X items in {Category Name}"
7. **Faceted filters**: Rendered as accessible HTML (not JavaScript-only)

Admin can set per category in `(hub)/cfg/catalog/categories`:
- `metaTitle` -- custom title tag override
- `metaDescription` -- custom meta description
- `description` -- visible on-page description
- `ogImageUrl` -- category Open Graph image

---

## 13. RBAC (CASL Abilities)

SEO functionality is mostly public (read-only for crawlers). Admin actions:

| Action | Subject | Who |
|---|---|---|
| `update` | `Category` (metaTitle, metaDescription, ogImageUrl) | `PlatformRole.ADMIN` |
| `manage` | `SeoRedirect` | `PlatformRole.ADMIN` |
| `read` | SEO platform_settings | `PlatformRole.ADMIN` or `PlatformRole.DEVELOPER` |
| `update` | SEO platform_settings | `PlatformRole.ADMIN` |

New CASL subject: `SeoRedirect`.

---

## 14. Platform Settings Keys

```
seo.baseUrl                          = "https://twicely.co"
seo.soldListingIndexEnabled          = true
seo.soldListingIndexDays             = 90
seo.sitemap.listingsPerFile          = 10000
seo.sitemap.cacheTtlMinutes          = 60
seo.sitemap.regenerateCronPattern    = "0 3 * * *"
seo.meta.defaultDescription          = "Twicely - Peer-to-peer resale marketplace"
seo.meta.titleSuffix                 = " | Twicely"
seo.meta.ogDefaultImage              = "https://twicely.co/og-default.png"
seo.robots.crawlDelay                = 1
seo.redirect.maxRules                = 10000
seo.noIndexSearchPages               = true
seo.noIndexFilteredPages             = true
seo.twitterHandle                    = "@twicely"
seo.socialLinks                      = ["https://twitter.com/twicely","https://instagram.com/twicely"]
seo.structuredData.includeRatings    = true
```

---

## 15. Admin UI

| Route | Purpose |
|---|---|
| `(hub)/cfg/seo/redirects` | Manage redirect rules (301/302) |
| `(hub)/cfg/seo/settings` | SEO platform_settings editor |
| `(hub)/cfg/catalog/categories` | Edit category metaTitle, metaDescription, description, ogImageUrl |

---

## 16. Observability

| Metric | Type | Description |
|---|---|---|
| `seo.sitemap.generated` | counter | Sitemap regeneration events |
| `seo.sitemap.urls` | gauge | Total URLs across all sitemaps |
| `seo.sitemap.generation_ms` | histogram | Sitemap generation latency |
| `seo.jsonld.rendered` | counter | JSON-LD blocks rendered (by type) |
| `seo.robots.served` | counter | robots.txt requests served |
| `seo.sold_listing.indexed` | gauge | SOLD listings still in index window |
| `seo.sold_listing.expired` | counter | SOLD listings moved to noindex |
| `seo.redirect.hit` | counter | Redirect rule matches |

### Audit Events

Must emit audit events for:
- Redirect rule created/updated/deleted
- Category metaTitle/metaDescription/ogImageUrl updated
- SEO platform_settings changed

---

## 17. Out of Scope

- Google Search Console API integration (future)
- Internationalized/hreflang tags (deferred per V3 INTERNATIONAL_DEFERRED.md)
- AMP pages
- Google Merchant Center feed (future)
- Facebook Catalog integration (future)
- Dynamic rendering / prerendering service (not needed with Next.js SSR)
- Link building or off-page SEO strategies
- Automated SEO auditing/scoring tools

---

## 18. Final Rule

SEO behavior must never:
- Serve different content to crawlers vs. users (cloaking)
- Index private, transactional, or admin pages
- Use keyword stuffing in meta tags
- Hardcode any thresholds (all from `platform_settings`)
- Break existing V3 listing metadata (Decision #71 logic must be preserved)
- Use float values for prices in structured data (compute from integer cents at render time)
- Generate sitemaps with more than 50,000 URLs per file (Google limit)
- Allow duplicate canonical URLs across entities

**If behavior is not defined here, it must be rejected or added to this canonical.**
