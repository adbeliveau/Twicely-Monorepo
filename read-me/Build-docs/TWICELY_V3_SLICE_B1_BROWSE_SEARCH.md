# TWICELY V3 — Phase B1: Browse & Search

**Slice:** B1
**Prerequisite:** Phase A complete (A1–A5 verified, 93 tables, seed data, auth, CASL)
**Goal:** A visitor can browse the homepage, search listings, browse categories, and view listing detail pages. All public. No auth required.
**Pages:** `/` (homepage), `/s` (search), `/c/[slug]` (category), `/c/[slug]/[subslug]` (subcategory), `/i/[slug]` (listing detail)
**Source of truth:** Page Registry §1, Feature Lock-in §11 (Search), §16 (Error Pages), §17 (SEO), §18 (Mobile), §28 (Filters), §29 (Conditions)

---

## CRITICAL RULES — SAME AS ALWAYS

1. **IMPLEMENT EXACTLY WHAT THE SPECS SAY.** Do not add fields, routes, components, or features not in this document.
2. **NO `as any`. NO `@ts-ignore`. NO `as unknown as T`.** Fix the type.
3. **NO FILE OVER 300 LINES.** Split it.
4. **NO SILENT FILE CREATION.** Only create files listed in the file plan for each section. If you need something not listed, STOP and ask.
5. **AFTER EVERY SECTION, run the verification commands.** Show full terminal output.
6. **DO NOT SKIP AHEAD.** Complete each section, verify, checkpoint, then move to the next.
7. **NO PLACEHOLDER DATA IN COMPONENTS.** Components fetch from the database using the seed data from A5.
8. **Tailwind + shadcn/ui ONLY for styling.** No custom CSS files. No CSS modules. No styled-components.
9. **Server Components by default.** Only add `"use client"` when the component needs interactivity (click handlers, useState, useEffect, URL params). Server Components fetch data directly — no API routes needed for read-only pages.
10. **ALL money is stored in cents, displayed in dollars.** Use a `formatPrice(cents: number)` utility. Never divide by 100 inline.

---

## SEARCH STRATEGY — DRIZZLE FOR NOW, TYPESENSE LATER

B1 does NOT use Typesense. We use Drizzle queries with ILIKE for text search and standard WHERE clauses for filters. This keeps us moving without external service dependencies.

The search logic lives in ONE file: `src/lib/search/listings.ts`. When we add Typesense later (via the provider system), we swap the implementation inside that file. Pages never know the difference.

---

## EXISTING PROJECT STATE

From Phase A (already exists — do NOT recreate):
- `src/lib/db/index.ts` — database connection (exports `db`)
- `src/lib/db/schema/index.ts` — barrel export of all 93 tables + 55 enums
- `src/lib/db/seed/` — seed data (50 listings, 16 categories, 6 users, 3 sellers, 10 orders)
- `src/lib/auth/` — Better Auth config
- `src/lib/utils/cn.ts` — className merger
- `src/config/constants.ts` — app constants
- `src/components/ui/` — shadcn: button, input, label, card, separator, badge
- `src/app/layout.tsx` — root layout
- `src/app/page.tsx` — placeholder (will be replaced)
- `src/app/(marketplace)/` — empty route group
- `src/app/auth/` — auth pages from A3

Seed data to work with:
- 50 ACTIVE listings across 3 sellers (electronics, apparel, collectibles)
- 16 categories (4 top-level + 12 leaf)
- 50 listing images (placeholder URLs)
- Prices range $65–$14,500

---

## B1 IS SPLIT INTO 8 SECTIONS — DO THEM IN ORDER

| Section | What | Est. Files |
|---------|------|-----------|
| B1.1 | Install shadcn components + shared utilities | ~5 |
| B1.2 | Marketplace layout shell (header, footer, mobile nav) | ~6 |
| B1.3 | Shared UI components (listing card, grid, skeletons, pagination, breadcrumbs) | ~8 |
| B1.4 | Data access layer (search queries, category queries, listing queries) | ~4 |
| B1.5 | Homepage (`/`) | ~3 |
| B1.6 | Search results page (`/s`) | ~5 |
| B1.7 | Category pages (`/c/[slug]`, `/c/[slug]/[subslug]`) | ~3 |
| B1.8 | Listing detail page (`/i/[slug]`) + SEO + error pages | ~6 |

**Total: ~40 files**

---

# SECTION B1.1 — SHADCN COMPONENTS + UTILITIES

## Step 1: Install additional shadcn/ui components

We already have: button, input, label, card, separator, badge

Install these additional components (use the exact shadcn CLI):

```bash
pnpm dlx shadcn@latest add select skeleton sheet dropdown-menu avatar breadcrumb pagination aspect-ratio scroll-area tabs dialog tooltip
```

That's 13 new components. After install, verify:

```bash
ls src/components/ui/*.tsx | wc -l
```

**Expected: 19 files** (6 existing + 13 new).

## Step 2: Create price formatting utility

**File: `src/lib/utils/format.ts`**

```typescript
/**
 * Format cents to dollar display string.
 * formatPrice(89900) → "$899.00"
 * formatPrice(6500) → "$65.00"
 * formatPrice(1450000) → "$14,500.00"
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format a date for display.
 * formatDate(date) → "Feb 16, 2026"
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Pluralize a word based on count.
 * pluralize(1, 'item') → "1 item"
 * pluralize(5, 'item') → "5 items"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count.toLocaleString()} ${word}`;
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Build a listing slug from title + id.
 * The listing table stores slugs like "iphone-15-pro-max-abc123"
 */
export function buildListingUrl(slug: string): string {
  return `/i/${slug}`;
}

/**
 * Build a category URL from slug path.
 */
export function buildCategoryUrl(slug: string, parentSlug?: string): string {
  if (parentSlug) return `/c/${parentSlug}/${slug}`;
  return `/c/${slug}`;
}
```

## Step 3: Create shared TypeScript types for B1

**File: `src/types/listings.ts`**

These types are derived from the Drizzle schema but shaped for UI consumption. They are NOT duplicates of schema types — they're the shape that pages and components receive after queries.

```typescript
export interface ListingCardData {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  originalPriceCents: number | null;
  condition: string;
  brand: string | null;
  freeShipping: boolean;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
  sellerName: string;
  sellerUsername: string;
  sellerAvatarUrl: string | null;
}

export interface ListingDetailData {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  originalPriceCents: number | null;
  condition: string;
  brand: string | null;
  freeShipping: boolean;
  allowOffers: boolean;
  quantity: number;
  availableQuantity: number | null;
  tags: string[];
  attributesJson: Record<string, unknown>;
  status: string;
  activatedAt: Date | null;
  createdAt: Date;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
  seller: {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    storeName: string | null;
    averageRating: number | null;
    totalReviews: number;
    memberSince: Date;
  };
  category: {
    id: string;
    name: string;
    slug: string;
    parent: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    listingCount: number;
  }>;
}

export interface SearchFilters {
  q?: string;
  categoryId?: string;
  condition?: string[];
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  brand?: string;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  listings: ListingCardData[];
  totalCount: number;
  page: number;
  totalPages: number;
  filters: SearchFilters;
}
```

## Verification — B1.1

```bash
# Components installed
ls src/components/ui/*.tsx | wc -l
# Expected: 19

# New files exist
test -f src/lib/utils/format.ts && echo "format.ts: OK" || echo "MISSING"
test -f src/types/listings.ts && echo "listings.ts: OK" || echo "MISSING"

# TypeScript compiles
npx tsc --noEmit
# Must be zero errors

# Lint clean
pnpm lint
# Must pass
```

## Checkpoint — B1.1

```bash
tar -cf ../twicely-b1-1-utils.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.1 COMPLETE"
```

**STOP. Show verification output. Do not proceed to B1.2 until Adrian approves.**

---

# SECTION B1.2 — MARKETPLACE LAYOUT SHELL

The marketplace layout wraps ALL public pages (homepage, search, category, listing detail). It provides the header with search bar, footer with links, and mobile bottom navigation.

**Reference:** Page Registry §10 (Mobile Navigation), Feature Lock-in §18 (Mobile Responsive)

## File Plan — B1.2

| # | File | What |
|---|------|------|
| 1 | `src/app/(marketplace)/layout.tsx` | Marketplace layout (wraps all public pages) |
| 2 | `src/components/shared/marketplace-header.tsx` | Top header: logo, search bar, nav links |
| 3 | `src/components/shared/marketplace-footer.tsx` | Footer: links, copyright |
| 4 | `src/components/shared/mobile-bottom-nav.tsx` | Mobile bottom tab bar (5 tabs) |
| 5 | `src/components/shared/search-bar.tsx` | Search input with submit (client component) |
| 6 | `src/components/shared/logo.tsx` | Twicely logo/wordmark component |

## Requirements

### Header (`marketplace-header.tsx`)
- Fixed top on desktop (sticky).
- Contains: Logo (left), Search bar (center, expands on focus), Nav links (right): "Sell", "Log In", "Sign Up".
- On mobile (< 768px): Logo left, search icon that opens full-screen search overlay, hamburger or simplified nav.
- Search bar submits to `/s?q={query}` via `router.push`.

### Footer (`marketplace-footer.tsx`)
- Server component (no interactivity).
- Sections: "Buy" (Browse, Categories, How It Works), "Sell" (Start Selling, Fees, Seller Dashboard), "Company" (About, Help Center, Policies), "Legal" (Terms, Privacy, Buyer Protection).
- Copyright: `© {year} Twicely. All rights reserved.`
- Hidden on mobile below the fold (mobile bottom nav takes priority).

### Mobile Bottom Nav (`mobile-bottom-nav.tsx`)
- **Client component** (needs `usePathname` for active state).
- Visible only on mobile (< 768px). Hidden on desktop.
- 5 tabs per Page Registry §10.1:

| Tab | Icon | Route | Badge |
|-----|------|-------|-------|
| Home | Home icon | `/` | — |
| Search | Search icon | `/s` | — |
| Sell | Plus icon | `/my/selling/listings/new` | — |
| Messages | MessageSquare icon | `/m` | — (badge comes in Phase E) |
| My | User icon | `/my` | — |

- Use `lucide-react` icons (already installed via shadcn).
- Active tab highlighted (filled icon or color change).

### Search Bar (`search-bar.tsx`)
- **Client component** (needs `useState`, `useRouter`, form submission).
- Input with search icon prefix.
- On submit: `router.push(/s?q=${encodeURIComponent(query)})`.
- Debounced — NO autocomplete in B1 (comes later with Typesense).
- Placeholder text: "Search for anything..."

### Layout (`(marketplace)/layout.tsx`)
- Server component.
- Structure: `<MarketplaceHeader />` → `<main>{children}</main>` → `<MarketplaceFooter />` → `<MobileBottomNav />`
- Main content area has `min-h-screen` and appropriate padding.
- Must be responsive: content area accounts for header height on desktop and bottom nav on mobile.

### Logo (`logo.tsx`)
- For now: plain text "Twicely" in a distinctive font weight. Link to `/`.
- No image/SVG logo yet — text only.

## Design Direction

- Clean, modern marketplace aesthetic. Think eBay redesigned by Shopify's design team.
- White/light background. Dark text. Accent color for CTAs and active states.
- Use Tailwind's default sans font stack for now (we'll customize later).
- Touch targets: minimum 44×44px on mobile.
- Responsive breakpoints: `md` (768px) for mobile → desktop transitions.

## Verification — B1.2

```bash
# Files exist
for f in \
  src/app/\(marketplace\)/layout.tsx \
  src/components/shared/marketplace-header.tsx \
  src/components/shared/marketplace-footer.tsx \
  src/components/shared/mobile-bottom-nav.tsx \
  src/components/shared/search-bar.tsx \
  src/components/shared/logo.tsx; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# TypeScript compiles
npx tsc --noEmit

# Lint
pnpm lint

# Build succeeds
pnpm build
```

## Checkpoint — B1.2

```bash
tar -cf ../twicely-b1-2-layout.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.2 COMPLETE"
```

**STOP. Show verification output. Do not proceed to B1.3 until Adrian approves.**

---

# SECTION B1.3 — SHARED UI COMPONENTS

These components are used across multiple pages. Build them all here so pages can import them.

## File Plan — B1.3

| # | File | What |
|---|------|------|
| 1 | `src/components/shared/listing-card.tsx` | Single listing card (image, title, price, seller, condition badge) |
| 2 | `src/components/shared/listing-grid.tsx` | Responsive grid of listing cards |
| 3 | `src/components/shared/listing-card-skeleton.tsx` | Loading skeleton for a single listing card |
| 4 | `src/components/shared/category-card.tsx` | Category card (name, listing count, link) |
| 5 | `src/components/shared/condition-badge.tsx` | Condition badge with color coding |
| 6 | `src/components/shared/breadcrumbs.tsx` | Breadcrumb navigation component |
| 7 | `src/components/shared/empty-state.tsx` | Reusable empty state (icon, message, CTA) |
| 8 | `src/components/shared/page-pagination.tsx` | URL-based pagination component |

## Requirements

### Listing Card (`listing-card.tsx`)
- **Server component** (no interactivity needed — it's a link).
- Props: `ListingCardData` from types.
- Shows: primary image (aspect-ratio 1:1 with placeholder fallback), title (2-line truncate), price (formatted from cents), original price with strikethrough if different, condition badge, free shipping badge, seller name small text at bottom.
- Entire card is a `<Link>` to `/i/{slug}`.
- Image uses `next/image` with `fill` and `object-cover`. Fallback to a neutral placeholder if no image.
- Responsive: fills grid cell. No fixed width.

### Listing Grid (`listing-grid.tsx`)
- **Server component.**
- Props: `listings: ListingCardData[]`, optional `emptyMessage: string`.
- Grid: 2 columns on mobile, 3 on `md`, 4 on `lg`, 5 on `xl`.
- If listings is empty, render `<EmptyState>` with the message.
- Gap: `gap-4` on mobile, `gap-6` on desktop.

### Listing Card Skeleton (`listing-card-skeleton.tsx`)
- Uses shadcn `<Skeleton>` component.
- Matches listing card dimensions: square image skeleton, 2 text lines, price line, small text line.
- Props: none. Renders one skeleton card. Grid uses `Array(count).fill(0).map(...)` to render multiple.

### Category Card (`category-card.tsx`)
- Server component.
- Props: `{ name: string; slug: string; parentSlug?: string; listingCount: number; }`.
- Shows category name and listing count.
- Entire card is a `<Link>` to the category URL.
- Clean, minimal design. No image for now.

### Condition Badge (`condition-badge.tsx`)
- Server component.
- Props: `{ condition: string }`.
- Maps condition codes to display text and colors:

| Code | Display | Color Scheme |
|------|---------|-------------|
| NWT | New with Tags | Green |
| NWOT | New without Tags | Green (lighter) |
| LIKE_NEW | Like New | Blue |
| VERY_GOOD | Very Good | Blue (lighter) |
| GOOD | Good | Yellow/Amber |
| ACCEPTABLE | Acceptable | Orange |

- Uses shadcn `<Badge>` with appropriate variant/className.

### Breadcrumbs (`breadcrumbs.tsx`)
- Server component.
- Props: `{ items: Array<{ label: string; href?: string }> }`.
- Last item has no link (current page).
- Uses shadcn `<Breadcrumb>` component.
- Includes JSON-LD `BreadcrumbList` structured data as a `<script type="application/ld+json">` tag.

### Empty State (`empty-state.tsx`)
- Server component.
- Props: `{ icon?: ReactNode; title: string; description?: string; actionLabel?: string; actionHref?: string; }`.
- Centered vertically in container. Icon + title + description + optional CTA button.

### Page Pagination (`page-pagination.tsx`)
- **Client component** (needs `useSearchParams`, `usePathname`, `useRouter`).
- Props: `{ currentPage: number; totalPages: number; }`.
- Preserves existing URL search params when navigating pages.
- Uses shadcn `<Pagination>` component.
- Shows: Previous, page numbers (with ellipsis for large ranges), Next.
- No-op if totalPages <= 1.

## Verification — B1.3

```bash
# Files exist
for f in \
  src/components/shared/listing-card.tsx \
  src/components/shared/listing-grid.tsx \
  src/components/shared/listing-card-skeleton.tsx \
  src/components/shared/category-card.tsx \
  src/components/shared/condition-badge.tsx \
  src/components/shared/breadcrumbs.tsx \
  src/components/shared/empty-state.tsx \
  src/components/shared/page-pagination.tsx; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# No file over 300 lines
wc -l src/components/shared/*.tsx

# TypeScript compiles
npx tsc --noEmit

# Lint
pnpm lint
```

## Checkpoint — B1.3

```bash
tar -cf ../twicely-b1-3-components.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.3 COMPLETE"
```

**STOP. Show verification output. Do not proceed to B1.4 until Adrian approves.**

---

# SECTION B1.4 — DATA ACCESS LAYER

These are server-side query functions. They run in Server Components and API routes. No client-side code.

**CRITICAL: These functions query the REAL database using Drizzle. They use the seed data from A5. NO mock data. NO hardcoded arrays.**

## File Plan — B1.4

| # | File | What |
|---|------|------|
| 1 | `src/lib/search/listings.ts` | Search/filter/sort listings (THE search function) |
| 2 | `src/lib/queries/categories.ts` | Category tree queries |
| 3 | `src/lib/queries/listings.ts` | Single listing detail, related listings |
| 4 | `src/lib/queries/homepage.ts` | Homepage-specific queries (featured, recent, trending) |

## Requirements

### Search Listings (`src/lib/search/listings.ts`)

**THE** search function. One file. One exported function. Clean interface.

```typescript
export async function searchListings(filters: SearchFilters): Promise<SearchResult>
```

Implementation:
- Query the `listing` table joined with `listingImage` (primary only), `user` (seller), `sellerProfile`.
- WHERE conditions built dynamically from filters:
  - `q`: ILIKE on `title` and `description` (split words, AND them — each word must appear in title OR description)
  - `categoryId`: exact match on `listing.categoryId`. If it's a parent category, also include all child category IDs.
  - `condition`: IN clause if multiple conditions selected
  - `minPrice` / `maxPrice`: range filter on `priceCents`
  - `freeShipping`: boolean filter
  - `brand`: ILIKE on `listing.brand`
- Only return listings where `status = 'ACTIVE'`
- Sort options:
  - `relevance` (default): if `q` is present, order by title match first. If no `q`, order by `createdAt DESC`.
  - `newest`: `createdAt DESC`
  - `price_asc`: `priceCents ASC`
  - `price_desc`: `priceCents DESC`
- Pagination: `LIMIT` + `OFFSET`. Default `limit = 24`, max `limit = 48`.
- Return `totalCount` using a separate COUNT query (or `sql<number>\`count(*) over()\`` window function).
- Map results to `ListingCardData[]`.

### Category Queries (`src/lib/queries/categories.ts`)

```typescript
// Get all top-level categories with their children and listing counts
export async function getCategoryTree(): Promise<CategoryData[]>

// Get a single category by slug with children and listing count
export async function getCategoryBySlug(slug: string): Promise<CategoryData | null>

// Get a subcategory by parent slug + own slug
export async function getSubcategory(parentSlug: string, childSlug: string): Promise<CategoryData | null>
```

- Listing counts: COUNT of active listings per category.
- Category tree: top-level categories (parentId IS NULL) with nested children.

### Listing Queries (`src/lib/queries/listings.ts`)

```typescript
// Get full listing detail by slug
export async function getListingBySlug(slug: string): Promise<ListingDetailData | null>

// Get similar listings (same category, similar price, exclude current listing)
export async function getSimilarListings(listingId: string, categoryId: string, priceCents: number, limit?: number): Promise<ListingCardData[]>

// Get more from this seller (exclude current listing)
export async function getSellerListings(sellerUserId: string, excludeListingId: string, limit?: number): Promise<ListingCardData[]>
```

- `getListingBySlug`: Join listing + images (ordered by position) + user + sellerProfile + category (with parent). Only return if status is ACTIVE, SOLD, or ENDED (SOLD/ENDED show "no longer available" in the UI).
- `getSimilarListings`: Same category, price within 50% range, limit 6, random order.
- `getSellerListings`: Same seller, ACTIVE only, newest first, limit 6.

### Homepage Queries (`src/lib/queries/homepage.ts`)

```typescript
// Get featured/recent listings for homepage sections
export async function getRecentListings(limit?: number): Promise<ListingCardData[]>

// Get top-level categories for homepage
export async function getHomepageCategories(): Promise<Array<{ id: string; name: string; slug: string; listingCount: number }>>
```

- `getRecentListings`: ACTIVE listings, ordered by `createdAt DESC`, limit 12.
- `getHomepageCategories`: Top-level categories with listing counts.

### IMPORTANT: Shared query helpers

All listing queries that return `ListingCardData` should use a shared mapping function to avoid duplicating the join + select + map logic. Put it in the same file or as a private helper.

## Verification — B1.4

```bash
# Files exist
for f in \
  src/lib/search/listings.ts \
  src/lib/queries/categories.ts \
  src/lib/queries/listings.ts \
  src/lib/queries/homepage.ts; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# TypeScript compiles
npx tsc --noEmit

# Lint
pnpm lint

# Quick smoke test: check that queries don't crash
# Create a tiny test script and run it
cat > /tmp/test-queries.ts << 'EOF'
import { searchListings } from '@/lib/search/listings';
import { getCategoryTree } from '@/lib/queries/categories';
import { getRecentListings } from '@/lib/queries/homepage';

async function main() {
  const search = await searchListings({ q: 'iphone', page: 1, limit: 5 });
  console.log(`Search "iphone": ${search.totalCount} results, got ${search.listings.length} cards`);

  const cats = await getCategoryTree();
  console.log(`Categories: ${cats.length} top-level`);

  const recent = await getRecentListings(5);
  console.log(`Recent: ${recent.length} listings`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
EOF
npx tsx /tmp/test-queries.ts
```

The smoke test MUST return real data from the seed. If it returns 0 results, the queries are broken.

## Checkpoint — B1.4

```bash
tar -cf ../twicely-b1-4-queries.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.4 COMPLETE"
```

**STOP. Show verification output including smoke test results. Do not proceed to B1.5 until Adrian approves.**

---

# SECTION B1.5 — HOMEPAGE

**Route:** `/`
**Layout:** marketplace
**Gate:** PUBLIC
**Title:** `Twicely — Buy & Sell Secondhand`
**Reference:** Page Registry §1 (page #1), Feature Lock-in §11 (Search), §17 (SEO)

## File Plan — B1.5

| # | File | What |
|---|------|------|
| 1 | `src/app/(marketplace)/page.tsx` | Homepage (REPLACES the existing placeholder) |
| 2 | `src/components/pages/home/hero-section.tsx` | Hero/banner area with search and tagline |
| 3 | `src/components/pages/home/category-grid.tsx` | Category cards grid |

## Requirements

### Homepage Layout
Sections in order:
1. **Hero** — Large search bar centered. Tagline: "Buy and sell secondhand. Better." Subtitle: "The marketplace with built-in seller tools." Trending searches displayed as clickable pills below search (hardcode 5-6 trending terms for now: "Nike Dunks", "iPhone 15", "Vintage Levi's", "PS5", "Air Jordan", "Birkin").
2. **Category Grid** — Top-level categories displayed as cards. "Browse by Category" heading.
3. **Recently Listed** — "Just Listed" heading + grid of 12 most recent listings using `<ListingGrid>`.
4. **Featured Listings** — "Featured Picks" heading + grid of 12 listings (for now, same as recent but offset — use `getRecentListings` with different offset or reversed sort. We'll add real featuring logic later).

### Page States (from Page Registry §1.1)
- LOADING: Skeleton grid (8 cards) + category pills skeleton.
- POPULATED: Hero, category grid, recently listed, featured listings.
- ERROR: "Something went wrong" with retry button.

Since this is a Server Component, LOADING state = Suspense boundaries. Wrap each section in `<Suspense fallback={<SkeletonGrid count={8} />}>`.

### SEO
- `<title>Twicely — Buy & Sell Secondhand</title>`
- `<meta name="description" content="Buy and sell secondhand clothing, electronics, collectibles and more on Twicely. Free shipping available.">`.
- JSON-LD: `WebSite` schema with `SearchAction` targeting `/s?q={search_term_string}`.
- Export a `metadata` object from the page (Next.js Metadata API).

### Design
- Hero: full-width, generous vertical padding. Search bar large and prominent.
- Category grid: 2 cols mobile, 4 cols desktop.
- Listing grids: use `<ListingGrid>` component from B1.3.
- Clean spacing between sections.

## Verification — B1.5

```bash
# Files exist
test -f src/app/\(marketplace\)/page.tsx && echo "OK" || echo "MISSING"
test -f src/components/pages/home/hero-section.tsx && echo "OK" || echo "MISSING"
test -f src/components/pages/home/category-grid.tsx && echo "OK" || echo "MISSING"

# TypeScript compiles
npx tsc --noEmit

# Build succeeds
pnpm build

# Dev server works — homepage should render with seed data
# Start dev, hit homepage, verify it shows listings
pnpm dev &
sleep 5
curl -s http://localhost:3000 | grep -c "Twicely"
kill %1
```

## Checkpoint — B1.5

```bash
tar -cf ../twicely-b1-5-homepage.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.5 COMPLETE"
```

**STOP. Show verification output. Do not proceed to B1.6 until Adrian approves.**

---

# SECTION B1.6 — SEARCH RESULTS PAGE

**Route:** `/s`
**Layout:** marketplace
**Gate:** PUBLIC
**Title:** `Search results for "{q}" | Twicely` (noindex)
**Reference:** Page Registry §1 (page #2), Feature Lock-in §11 (Search), §28 (Filters), §29 (Conditions)

## File Plan — B1.6

| # | File | What |
|---|------|------|
| 1 | `src/app/(marketplace)/s/page.tsx` | Search results page (server component) |
| 2 | `src/components/pages/search/search-filters.tsx` | Filter sidebar/drawer (client component) |
| 3 | `src/components/pages/search/sort-select.tsx` | Sort dropdown (client component) |
| 4 | `src/components/pages/search/active-filters.tsx` | Active filter tags with clear buttons (client component) |
| 5 | `src/components/pages/search/search-results-header.tsx` | "{count} results for '{q}'" + sort |

## Requirements

### URL Parameters
All filters live in URL search params for shareability/bookmarking:
- `q` — search query text
- `category` — category slug (resolved to categoryId in the server)
- `condition` — comma-separated condition codes (e.g., `NWT,NWOT`)
- `minPrice` — minimum price in dollars (converted to cents server-side)
- `maxPrice` — maximum price in dollars
- `freeShipping` — `true` if set
- `brand` — brand text filter
- `sort` — `relevance` | `newest` | `price_asc` | `price_desc`
- `page` — page number (1-based)

### Search Results Page (`/s/page.tsx`)
- **Server Component.** Reads `searchParams`, converts to `SearchFilters`, calls `searchListings()`.
- Two-column layout on desktop: filter sidebar (left, ~280px), results grid (right).
- One-column on mobile: filters in a slide-out `<Sheet>` triggered by "Filters" button.
- Above results: `<SearchResultsHeader>` showing count and sort.
- Results: `<ListingGrid>` with the search results.
- Below results: `<PagePagination>`.
- If no results: `<EmptyState>` with message "No results for '{q}'" + suggested categories CTA.

### Search Filters (`search-filters.tsx`)
- **Client component** (needs URL manipulation).
- Filter sections:
  1. **Category** — List of top-level categories with listing counts. Clicking one adds `category={slug}` to URL.
  2. **Condition** — Checkboxes for each condition (NWT, NWOT, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE).
  3. **Price Range** — Min/Max inputs. Apply on blur or button click.
  4. **Free Shipping** — Single checkbox.
- Applying a filter: update URL params with `router.push` (NOT `router.replace` — allow back navigation).
- "Clear All Filters" link at top.
- On mobile: rendered inside a `<Sheet>` (slide-out from left) with "Apply Filters" button.
- **IMPORTANT:** The filter component receives the initial filter values from URL params AND the category list from the server (passed as props). It does NOT fetch categories itself.

### Sort Select (`sort-select.tsx`)
- Client component.
- Dropdown with 4 options: Relevance (default), Newest, Price: Low to High, Price: High to Low.
- On change: update `sort` URL param.

### Active Filters (`active-filters.tsx`)
- Client component.
- Shows current filters as removable tags/chips. "Condition: NWT ×", "Free Shipping ×", "Under $500 ×".
- Clicking × removes that filter from URL params.
- Only shown if any filters are active (besides `q` and `sort`).

### SEO
- `noindex` — search results pages are not indexed.
- Dynamic title: `Search results for "{q}" | Twicely` or `Search | Twicely` if no query.
- Export `metadata` with `robots: 'noindex'`.

## Verification — B1.6

```bash
# Files exist
for f in \
  src/app/\(marketplace\)/s/page.tsx \
  src/components/pages/search/search-filters.tsx \
  src/components/pages/search/sort-select.tsx \
  src/components/pages/search/active-filters.tsx \
  src/components/pages/search/search-results-header.tsx; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# TypeScript
npx tsc --noEmit

# Build
pnpm build

# Smoke test: search page loads with query
pnpm dev &
sleep 5
curl -s "http://localhost:3000/s?q=iphone" | grep -c "result"
kill %1
```

## Checkpoint — B1.6

```bash
tar -cf ../twicely-b1-6-search.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.6 COMPLETE"
```

**STOP. Show verification output. Do not proceed to B1.7 until Adrian approves.**

---

# SECTION B1.7 — CATEGORY PAGES

**Routes:** `/c/[slug]`, `/c/[slug]/[subslug]`
**Layout:** marketplace
**Gate:** PUBLIC
**Title:** `{Category Name} | Twicely` (indexable)
**Reference:** Page Registry §1 (pages #3, #4)

## File Plan — B1.7

| # | File | What |
|---|------|------|
| 1 | `src/app/(marketplace)/c/[slug]/page.tsx` | Top-level category page |
| 2 | `src/app/(marketplace)/c/[slug]/[subslug]/page.tsx` | Subcategory page |
| 3 | `src/components/pages/category/subcategory-nav.tsx` | Horizontal subcategory pills/tabs |

## Requirements

### Category Page (`/c/[slug]/page.tsx`)
- **Server component.** Fetches category by slug + listings in that category.
- If category not found: `notFound()` (Next.js 404).
- Layout:
  - Breadcrumbs: Home > {Category Name}
  - Category name as `<h1>`.
  - Category description if present.
  - Subcategory navigation: horizontal scrollable row of subcategory pills. Clicking one goes to `/c/{parent}/{child}`.
  - Listings grid with pagination (reuses `<ListingGrid>` and `<PagePagination>`).
  - If no listings: `<EmptyState>` with "No listings in {category} yet."
- Uses `searchListings()` with `categoryId` filter — this includes all child category listings.
- Supports `sort` and `page` URL params (same as search page).

### Subcategory Page (`/c/[slug]/[subslug]/page.tsx`)
- **Server component.** Same as category page but for a child category.
- Breadcrumbs: Home > {Parent} > {Subcategory}
- Validates both parent slug and child slug.
- If either not found: `notFound()`.
- Shows sibling subcategories in the horizontal nav (other children of the same parent).

### Subcategory Nav (`subcategory-nav.tsx`)
- Server component.
- Props: `{ categories: Array<{ name: string; slug: string; parentSlug: string; active: boolean }>; parentSlug: string }`.
- Horizontal scroll container on mobile. "All" pill links back to parent category.
- Active subcategory visually highlighted.

### SEO
- Indexable: `canonical` URL set.
- Title: `{Category Name} | Twicely`.
- Description: category description or default.
- Breadcrumb JSON-LD via `<Breadcrumbs>` component.

### generateMetadata
Both pages should export `generateMetadata` functions that use the category name in the title.

## Verification — B1.7

```bash
# Files exist
for f in \
  src/app/\(marketplace\)/c/\[slug\]/page.tsx \
  src/app/\(marketplace\)/c/\[slug\]/\[subslug\]/page.tsx \
  src/components/pages/category/subcategory-nav.tsx; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# TypeScript
npx tsc --noEmit

# Build
pnpm build

# Smoke test: category page loads
pnpm dev &
sleep 5
curl -s "http://localhost:3000/c/electronics" | grep -ci "electronics"
kill %1
```

## Checkpoint — B1.7

```bash
tar -cf ../twicely-b1-7-categories.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.7 COMPLETE"
```

**STOP. Show verification output. Do not proceed to B1.8 until Adrian approves.**

---

# SECTION B1.8 — LISTING DETAIL + SEO + ERROR PAGES

**Route:** `/i/[slug]`
**Layout:** marketplace
**Gate:** PUBLIC
**Title:** `{Listing Title} — $price | Twicely`
**Reference:** Page Registry §1 (page #5), Feature Lock-in §11 (Similar Items, More From Seller), §17 (SEO), §16 (Error Pages), §29 (Conditions)

## File Plan — B1.8

| # | File | What |
|---|------|------|
| 1 | `src/app/(marketplace)/i/[slug]/page.tsx` | Listing detail page |
| 2 | `src/components/pages/listing/image-gallery.tsx` | Image gallery with thumbnails (client) |
| 3 | `src/components/pages/listing/listing-info.tsx` | Price, condition, shipping, seller card |
| 4 | `src/components/pages/listing/seller-card.tsx` | Seller mini-profile card |
| 5 | `src/app/not-found.tsx` | Global 404 page |
| 6 | `src/app/error.tsx` | Global error boundary (client) |

## Requirements

### Listing Detail Page (`/i/[slug]/page.tsx`)
- **Server component.**
- Fetches listing by slug via `getListingBySlug()`.
- If not found: `notFound()`.
- If status is SOLD or ENDED: show "This item is no longer available" banner at top + still show the listing info (greyed out) + similar items section.
- Layout (desktop): two-column. Image gallery (left, ~60%). Listing info (right, ~40%).
- Layout (mobile): single column. Images on top, info below.
- Sections:
  1. **Breadcrumbs**: Home > {Category} > {Subcategory (if exists)} > {Listing Title}
  2. **Image Gallery**: primary image large, thumbnails below (or side on desktop). Click thumbnail to switch main image. Swipe on mobile.
  3. **Listing Info Panel**:
     - Price (large, bold). If originalPrice differs, show strikethrough.
     - Condition badge.
     - "Free Shipping" badge if applicable.
     - "Make an Offer" indicator (if `allowOffers` is true). Just the text for now — offer flow comes in Phase C.
     - Buy/Add to Cart button (non-functional in B1 — shows button but links to `/auth/login` if not authenticated, or does nothing. Cart comes in B3).
     - Description (full text, preserving line breaks).
     - Tags displayed as small badges.
     - Item details: brand, category, listed date.
  4. **Seller Card**: avatar, name, rating (placeholder stars), "Member since {date}", "View Store" link to `/st/{username}` (store page is Phase D — link exists but page won't exist yet, that's fine).
  5. **More From This Seller**: horizontal scroll of 6 listings from same seller.
  6. **Similar Items**: grid of 6 listings from same category.

### Image Gallery (`image-gallery.tsx`)
- **Client component** (needs click handlers for thumbnail switching, swipe for mobile).
- Props: `{ images: Array<{ id: string; url: string; altText: string | null; position: number }> }`.
- Main image: large, `aspect-ratio: 1/1`. Uses `next/image`.
- Thumbnails: row below main image. Active thumbnail highlighted.
- Click thumbnail → show that image as main.
- If only 1 image, no thumbnails shown.
- Fallback: if images array is empty, show placeholder.

### Listing Info (`listing-info.tsx`)
- Server component.
- Contains the right-column content: price, condition, shipping, buy button, description, tags, details.

### Seller Card (`seller-card.tsx`)
- Server component.
- Props: seller data from `ListingDetailData.seller`.
- Avatar (initials fallback), display name, star rating (show "No reviews yet" if null), member since date, "View Store →" link.

### 404 Page (`not-found.tsx`)
Per Feature Lock-in §16:
- "We couldn't find that page."
- Search bar.
- Popular categories links.
- Link to homepage.

### Error Page (`error.tsx`)
Per Feature Lock-in §16:
- **Client component** (Next.js requirement for error boundaries).
- "Something went wrong on our end."
- "Try again" button (calls `reset()`).
- Link to homepage.
- No technical details exposed.

### SEO for Listing Detail
- Indexable (ACTIVE only). SOLD/ENDED get `noindex`.
- Title: `{Listing Title} — ${formatPrice(priceCents)} | Twicely`
- Description: first 160 chars of listing description.
- JSON-LD: `Product` schema:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "...",
    "description": "...",
    "image": ["..."],
    "offers": {
      "@type": "Offer",
      "price": "...",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "itemCondition": "..."
    },
    "seller": {
      "@type": "Person",
      "name": "..."
    }
  }
  ```
- Open Graph tags: `og:title`, `og:description`, `og:image`, `og:price:amount`.
- Export `generateMetadata` function.

## Verification — B1.8

```bash
# Files exist
for f in \
  src/app/\(marketplace\)/i/\[slug\]/page.tsx \
  src/components/pages/listing/image-gallery.tsx \
  src/components/pages/listing/listing-info.tsx \
  src/components/pages/listing/seller-card.tsx \
  src/app/not-found.tsx \
  src/app/error.tsx; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# TypeScript
npx tsc --noEmit

# Lint
pnpm lint

# Build
pnpm build

# Smoke test: listing detail page loads
pnpm dev &
sleep 5
# Use one of the seed listing slugs
curl -s "http://localhost:3000/i/iphone-15-pro-max-256gb-natural-titanium-seed-listing-001" | grep -ci "price"
# 404 page works
curl -s "http://localhost:3000/i/nonexistent-listing-xyz" | grep -ci "couldn't find"
kill %1
```

## Checkpoint — B1.8

```bash
tar -cf ../twicely-b1-8-listing-detail.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "B1.8 COMPLETE"
```

**STOP. Show verification output. Do not proceed until Adrian approves.**

---

# FINAL B1 AUDIT — ALL 8 SECTIONS COMPLETE

Run all of these. Every one must pass.

```bash
echo "=== B1 FINAL AUDIT ==="

# 1. TypeScript
echo "--- TypeScript ---"
npx tsc --noEmit
echo "Exit: $?"

# 2. Lint
echo "--- Lint ---"
pnpm lint
echo "Exit: $?"

# 3. Build
echo "--- Build ---"
pnpm build
echo "Exit: $?"

# 4. No as any
echo "--- No 'as any' ---"
grep -r "as any" src/app src/components src/lib --include="*.ts" --include="*.tsx" | grep -v node_modules || echo "CLEAN"

# 5. No @ts-ignore
echo "--- No @ts-ignore ---"
grep -r "@ts-ignore\|@ts-expect-error" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules || echo "CLEAN"

# 6. No file over 300 lines
echo "--- File sizes ---"
find src/app src/components src/lib -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -20

# 7. File count check
echo "--- B1 file inventory ---"
echo "Components:"
find src/components -name "*.tsx" | sort
echo ""
echo "Pages:"
find src/app/\(marketplace\) -name "page.tsx" | sort
echo ""
echo "Queries:"
find src/lib/queries src/lib/search -name "*.ts" | sort
echo ""
echo "Types:"
find src/types -name "*.ts" | sort

# 8. Pages load with data
echo "--- Smoke tests ---"
pnpm dev &
DEV_PID=$!
sleep 8

echo "Homepage:"
curl -s http://localhost:3000 | grep -c "Twicely" || echo "FAIL"

echo "Search:"
curl -s "http://localhost:3000/s?q=iphone" | grep -c "result" || echo "FAIL"

echo "Category:"
curl -s "http://localhost:3000/c/electronics" | grep -ci "electronics" || echo "FAIL"

echo "404:"
curl -s "http://localhost:3000/i/does-not-exist" | grep -ci "couldn't find\|not found" || echo "FAIL"

kill $DEV_PID 2>/dev/null

echo "=== B1 AUDIT COMPLETE ==="
```

## Final Checkpoint

```bash
tar -cf ../twicely-b1-complete.tar --exclude=node_modules --exclude=.next --exclude=.git .
echo "PHASE B1 COMPLETE"
```

---

## WHAT NOT TO DO — B1 SPECIFIC

❌ **Do not install Typesense.** Search uses Drizzle ILIKE for now.
❌ **Do not build the cart.** The "Add to Cart" button exists but is non-functional in B1.
❌ **Do not build offers.** "Make an Offer" text shows but clicking does nothing.
❌ **Do not build auth-gated features.** Everything in B1 is PUBLIC.
❌ **Do not build the storefront pages** (`/st/*`). Those are Phase D.
❌ **Do not add API routes.** All B1 pages are Server Components that query directly.
❌ **Do not create CSS files.** Tailwind only.
❌ **Do not create Drizzle relations.** Use explicit joins in queries.
❌ **Do not add `"use client"` to Server Components.** Only components that need interactivity get it.
❌ **Do not hardcode listing data.** All data comes from the database (seed data from A5).
❌ **Do not add real-time features** (Centrifugo). That's Phase E.
❌ **Do not build saved searches, watchlists, or following.** Those are Phase D/E.
❌ **Do not create a sitemap generator.** That's Phase G.

---

**END OF B1 PROMPT**
