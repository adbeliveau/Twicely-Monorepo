# PHASE V4.04 -- SEO & Structured Data

**Canonical:** `rules/canonicals/21_SEO_DISCOVERY.md` sections 3-14
**Prerequisites:** V3 complete (listing detail page with metadata exists, Typesense live, categories exist)
**Estimated:** 3-4 hours
**Scope:** JSON-LD structured data + sitemaps + robots.txt + meta tag enhancements + admin SEO settings

---

## Step 1: Schema Change (Minimal)

### 1.1 Category Column Addition

File: `packages/db/src/schema/catalog.ts` -- add to `category` table:

```ts
ogImageUrl: text('og_image_url'),
```

### 1.2 Migration

```bash
cd packages/db && npx drizzle-kit generate --name seo_v4_04
```

No new tables required. All SEO metadata is computed at render time from existing data.

---

## Step 2: Structured Data Service

File: `packages/commerce/src/seo/structured-data.ts`

### 2.1 Types

```ts
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

export type Breadcrumb = {
  name: string;
  href: string;
};

export type ProductJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  description?: string;
  image?: string[];
  sku: string;
  brand?: { '@type': 'Brand'; name: string };
  offers: {
    '@type': 'Offer';
    url: string;
    priceCurrency: string;
    price: string;
    availability: string;
    itemCondition: string;
    seller: { '@type': 'Person'; name: string; url: string };
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: string;
  };
};
```

### 2.2 Functions

```ts
export function generateProductJsonLd(listing: ListingForSeo): ProductJsonLd
// See canonical 6.1 for exact implementation

export function mapConditionToSchemaOrg(condition: string): string
// NEW_WITH_TAGS, NEW_WITHOUT_TAGS -> NewCondition
// All others -> UsedCondition

export function generateBreadcrumbJsonLd(breadcrumbs: Breadcrumb[]): object
// See canonical 6.2

export function generateItemListJsonLd(
  listings: Array<{ slug: string }>,
  name: string,
  url: string
): object
// See canonical 6.5 -- top 20 items only

export const organizationJsonLd: object
// See canonical 6.3 -- static, exported as const

export const websiteJsonLd: object
// See canonical 6.4 -- static with SearchAction, exported as const
```

---

## Step 3: Meta Tag Service

File: `packages/commerce/src/seo/meta-tags.ts`

### 3.1 Types

```ts
import type { Metadata } from 'next';

export type CategoryForSeo = {
  slug: string;
  name: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
};

export type SellerForSeo = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
};
```

### 3.2 Functions

```ts
export function generateListingMeta(listing: ListingForSeo): Metadata
// Extends existing V3 listing-page-metadata.ts
// V4 addition: variation price range display
// See canonical 7.1

export function generateCategoryMeta(
  cat: CategoryForSeo,
  listingCount: number
): Metadata
// See canonical 7.2

export function generateSearchMeta(
  query: string,
  resultCount: number
): Metadata
// See canonical 7.3 -- always noindex, follow

export function generateStoreMeta(seller: SellerForSeo): Metadata
// See canonical 7.4

export function computeRobotsDirective(
  listing: ListingForSeo
): string | undefined
// Preserve existing V3 Decision #71 logic
// ACTIVE -> undefined (indexable)
// SOLD -> check seo.soldListingIndexEnabled + seo.soldListingIndexDays
// ENDED, PAUSED, RESERVED -> 'noindex'
// REMOVED -> 'noindex, nofollow'
```

---

## Step 4: Sitemap Service

File: `packages/commerce/src/seo/sitemap.ts`

### 4.1 Types

```ts
export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

export type SitemapIndexEntry = {
  loc: string;
  lastmod?: string;
};
```

### 4.2 Functions

```ts
export async function generateSitemapIndex(): Promise<string>
// Returns XML sitemap index pointing to sub-sitemaps
// Entries: sitemap-static.xml, sitemap-categories.xml,
//   sitemap-listings-1.xml through sitemap-listings-N.xml,
//   sitemap-stores.xml

export async function generateStaticSitemap(): Promise<string>
// Static pages: /, /c, /s, /p/terms, /p/privacy, /p/fees, etc.

export async function generateCategorySitemap(): Promise<string>
// All active categories: /c/{slug} and /c/{slug}/{subslug}

export async function generateListingSitemap(page: number): Promise<string>
// Chunk: 10,000 listings per file (seo.sitemap.listingsPerFile setting)
// Include ACTIVE listings + SOLD within index window
// Order by updatedAt desc

export async function generateStoreSitemap(): Promise<string>
// Active seller stores: /st/{username}

export function buildSitemapXml(urls: SitemapUrl[]): string
// Standard XML sitemap builder with escapeXml

export function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string
// Standard XML sitemap index builder
```

### 4.3 Query Patterns

Listing sitemap query:
```ts
const listings = await db
  .select({ id: listing.id, slug: listing.slug, updatedAt: listing.updatedAt })
  .from(listing)
  .where(or(
    eq(listing.status, 'ACTIVE'),
    and(
      eq(listing.status, 'SOLD'),
      gte(listing.soldAt, sql`NOW() - interval '${indexDays} days'`)
    )
  ))
  .orderBy(desc(listing.updatedAt))
  .limit(listingsPerFile)
  .offset((page - 1) * listingsPerFile);
```

Category sitemap query:
```ts
const categories = await db
  .select({ slug: category.slug, updatedAt: category.updatedAt, parentId: category.parentId })
  .from(category)
  .where(eq(category.isActive, true));
```

Store sitemap query:
```ts
const sellers = await db
  .select({ username: user.username, updatedAt: sellerProfile.updatedAt })
  .from(sellerProfile)
  .innerJoin(user, eq(sellerProfile.userId, user.id))
  .where(eq(sellerProfile.status, 'ACTIVE'));
```

---

## Step 5: robots.txt Service

File: `packages/commerce/src/seo/robots.ts`

```ts
export function generateRobotsTxt(): string
// See canonical 9.1 for exact content
// Blocks: /api/, /my/, /auth/, /checkout/, /cart/
// Also blocks hub routes: /d/, /usr/, /tx/, /fin/, /mod/, /hd/, /cfg/, etc.
// Includes Sitemap: https://twicely.co/sitemap.xml
// Includes Crawl-delay from seo.robots.crawlDelay setting
```

---

## Step 6: Next.js Route Handlers

### 6.1 Sitemap Routes

```
apps/web/src/app/sitemap.xml/route.ts
apps/web/src/app/sitemap-static.xml/route.ts
apps/web/src/app/sitemap-categories.xml/route.ts
apps/web/src/app/sitemap-listings-[page].xml/route.ts   (dynamic: page=1,2,3...)
apps/web/src/app/sitemap-stores.xml/route.ts
```

Each exports:
```ts
export async function GET(request: Request): Promise<Response> {
  const xml = await generateXxxSitemap();
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
```

### 6.2 robots.txt Route

```
apps/web/src/app/robots.txt/route.ts
```

```ts
export async function GET(): Promise<Response> {
  const body = generateRobotsTxt();
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

---

## Step 7: Page Enhancements (Existing Pages)

### 7.1 Listing Detail -- JSON-LD

File: `apps/web/src/app/(marketplace)/i/[slug]/page.tsx` (modify)

Add at the top of the page component return:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(generateProductJsonLd(listingData)) }}
/>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbJsonLd(breadcrumbs)) }}
/>
```

### 7.2 Listing Detail -- Enhanced Metadata

File: `apps/web/src/app/(marketplace)/i/[slug]/listing-page-metadata.ts` (modify)

Replace existing `generateListingMetadata` with call to `generateListingMeta` from `packages/commerce/src/seo/meta-tags.ts`. Preserve existing Decision #71 logic (it is already correct).

### 7.3 Category Pages -- JSON-LD + Meta

File: `apps/web/src/app/(marketplace)/c/[slug]/page.tsx` (modify)

Add `generateCategoryMeta` for metadata export.
Add `generateItemListJsonLd` + `generateBreadcrumbJsonLd` in page body.

File: `apps/web/src/app/(marketplace)/c/[slug]/[subslug]/page.tsx` (modify)

Same treatment as parent category page.

### 7.4 Search Results -- Meta

File: `apps/web/src/app/(marketplace)/s/page.tsx` (modify)

Add `generateSearchMeta` for metadata export. Ensures `noindex, follow`.

### 7.5 Home Page -- JSON-LD

File: `apps/web/src/app/(marketplace)/page.tsx` (modify)

Add `organizationJsonLd` + `websiteJsonLd` as `<script type="application/ld+json">` blocks.

### 7.6 Seller Store -- Meta

File: `apps/web/src/app/(marketplace)/st/[username]/page.tsx` (if exists, or the equivalent store route)

Add `generateStoreMeta` for metadata export.

---

## Step 8: BullMQ Job -- Sitemap Pre-warm

File: `packages/jobs/src/workers/sitemap-regenerate.ts`

Cron: daily at 03:00 UTC (`seo.sitemap.regenerateCronPattern` setting)

```ts
export async function regenerateSitemaps(): Promise<void>
// Call each sitemap generator to pre-warm cache
// Log total URL counts
```

Register in `packages/jobs/src/cron-jobs.ts`.

---

## Step 9: Platform Settings Seed

Seed these keys into `platform_settings` (if not already present):

```
seo.soldListingIndexEnabled       = true     (may already exist)
seo.soldListingIndexDays          = 90       (may already exist)
seo.sitemap.listingsPerFile       = 10000
seo.sitemap.cacheTtlMinutes       = 60
seo.sitemap.regenerateCronPattern = '0 3 * * *'
seo.meta.defaultDescription       = 'Twicely - Peer-to-peer resale marketplace'
seo.meta.titleSuffix              = ' | Twicely'
seo.meta.ogDefaultImage           = 'https://twicely.co/og-default.png'
seo.robots.crawlDelay             = 1
```

---

## Step 10: Tests

### 10.1 Unit Tests

| File | Tests |
|---|---|
| `packages/commerce/src/seo/__tests__/structured-data.test.ts` | Product JSON-LD, breadcrumbs, ItemList, condition mapping |
| `packages/commerce/src/seo/__tests__/meta-tags.test.ts` | Listing meta, category meta, search meta, store meta, robots directive |
| `packages/commerce/src/seo/__tests__/sitemap.test.ts` | XML generation, pagination, URL correctness, SOLD listing window |
| `packages/commerce/src/seo/__tests__/robots.test.ts` | Content validation, blocked paths |

### 10.2 Key Assertions

- `generateProductJsonLd` includes `@type: Product`, price in USD, correct availability
- `mapConditionToSchemaOrg` maps NEW_WITH_TAGS -> NewCondition, GOOD -> UsedCondition
- `generateBreadcrumbJsonLd` has correct positions (1-indexed)
- `computeRobotsDirective` returns undefined for ACTIVE, 'noindex' for ENDED, correct for SOLD within/outside window
- `generateListingMeta` includes `product:price:amount` in other fields
- `buildSitemapXml` produces valid XML with `<?xml` header and `<urlset>` root
- Sitemap listing query includes ACTIVE + SOLD-within-window, excludes DRAFT/ENDED/REMOVED
- `generateRobotsTxt` blocks /api/, /my/, /auth/, /checkout/, /cart/
- `generateRobotsTxt` includes Sitemap directive
- Price in JSON-LD is `(priceCents / 100).toFixed(2)`, never a float
- Variation listings show price range in meta description

---

## Step 11: Files Created Summary

| # | File Path | Purpose |
|---|---|---|
| 1 | `packages/db/src/schema/catalog.ts` (modify) | Add `ogImageUrl` to category |
| 2 | `packages/commerce/src/seo/structured-data.ts` | JSON-LD generators |
| 3 | `packages/commerce/src/seo/meta-tags.ts` | Meta tag generators |
| 4 | `packages/commerce/src/seo/sitemap.ts` | Sitemap generators |
| 5 | `packages/commerce/src/seo/robots.ts` | robots.txt generator |
| 6 | `apps/web/src/app/sitemap.xml/route.ts` | Sitemap index handler |
| 7 | `apps/web/src/app/sitemap-static.xml/route.ts` | Static sitemap handler |
| 8 | `apps/web/src/app/sitemap-categories.xml/route.ts` | Categories sitemap handler |
| 9 | `apps/web/src/app/sitemap-listings-[page].xml/route.ts` | Listings sitemap handler |
| 10 | `apps/web/src/app/sitemap-stores.xml/route.ts` | Stores sitemap handler |
| 11 | `apps/web/src/app/robots.txt/route.ts` | robots.txt handler |
| 12 | `apps/web/src/app/(marketplace)/i/[slug]/page.tsx` (modify) | Add JSON-LD |
| 13 | `apps/web/src/app/(marketplace)/i/[slug]/listing-page-metadata.ts` (modify) | Use shared meta-tags |
| 14 | `apps/web/src/app/(marketplace)/c/[slug]/page.tsx` (modify) | Add JSON-LD + meta |
| 15 | `apps/web/src/app/(marketplace)/c/[slug]/[subslug]/page.tsx` (modify) | Add JSON-LD + meta |
| 16 | `apps/web/src/app/(marketplace)/s/page.tsx` (modify) | Add search meta |
| 17 | `apps/web/src/app/(marketplace)/page.tsx` (modify) | Add Organization + WebSite JSON-LD |
| 18 | `packages/jobs/src/workers/sitemap-regenerate.ts` | Sitemap pre-warm cron |
| 19 | `packages/jobs/src/cron-jobs.ts` (modify) | Register sitemap cron |
| 20-23 | `packages/commerce/src/seo/__tests__/*.test.ts` | 4 test files |

---

## Completion Criteria

- [ ] `category.ogImageUrl` column added
- [ ] JSON-LD Product rendered on listing detail pages
- [ ] JSON-LD BreadcrumbList rendered on listing + category pages
- [ ] JSON-LD Organization + WebSite rendered on home page
- [ ] JSON-LD ItemList rendered on category pages
- [ ] Meta tags include OG + Twitter cards on all public pages
- [ ] `noindex, follow` on search results pages
- [ ] SOLD listing indexing respects Decision #71 window
- [ ] Sitemap index at `/sitemap.xml` lists sub-sitemaps
- [ ] Listing sitemaps paginated at 10,000 per file
- [ ] robots.txt blocks private routes, includes Sitemap directive
- [ ] Sitemap pre-warm cron registered and functional
- [ ] All platform_settings keys seeded
- [ ] All tests passing
- [ ] `npx turbo typecheck` -- 0 errors
- [ ] `npx turbo test` -- baseline maintained or increased
