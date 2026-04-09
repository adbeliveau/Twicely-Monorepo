# TWICELY V3 — Buyer Acquisition Addendum

**Version:** v1.0
**Date:** 2026-02-21
**Status:** LOCKED
**Author:** Platform Architect
**Purpose:** Define the buyer acquisition strategy, required technical infrastructure, schema additions, and build order changes. This is the demand-side companion to the crosslister (supply-side) strategy.

---

## 1. STRATEGIC CONTEXT

The crosslister solves supply. This document solves demand. Five buyer acquisition channels, all compounding, four free. No channel depends on paid spend to function. Every channel gets stronger as inventory grows.

| # | Channel | Type | Marginal Cost |
|---|---------|------|---------------|
| 1 | Google Shopping free listings | Organic / compounding | $0 |
| 3 | Resale creator affiliates | Organic / compounding | ~$2K/mo comped subs at scale |
| 4 | SEO long-tail product pages | Organic / compounding | $0 |
| 6 | "Sold For" price reference pages | Organic / compounding | $0 |
| 7 | Buyer referral program ($5 off $50+) | Multiplier on above | $5/referral at breakeven |

Numbering preserved from original analysis. Channels 2 (Miami local) and 5 (Google Ads) are deferred — can be added as paid accelerants post-launch. Twicely.Local is a nationwide product feature, not a geo-targeted marketing channel.

---

## 2. CHANNEL 1: GOOGLE SHOPPING FREE LISTINGS

### 2.1 What It Is

Google Merchant Center allows free product listings across Google Search, Google Shopping tab, Google Images, Google Lens, and YouTube. Every active Twicely listing becomes a free Google Shopping listing automatically via a product data feed.

### 2.2 Why This Is Our Highest-Leverage Channel

When a seller imports 3,000 listings from eBay via the crosslister, those listings go ACTIVE on Twicely immediately. If we push them to Google Merchant Center the same day, every item becomes discoverable by buyers actively searching Google for that exact product. Buyers land on Twicely, see a real listing, buyer protection, a price — and buy.

At 50,000 active listings with 0.1% CTR from Google Shopping impressions: ~50 potential buyers/day. At 500,000 listings: ~500/day. Zero ad spend.

### 2.3 Technical Requirements

**Google Merchant Center Account Setup:**
- Create GMC account for twicely.co
- Verify and claim website
- Opt into free listings (default ON for new accounts)
- Set up product data feed (see §2.4)

**Product Data Feed Generator:**

BullMQ job that generates and submits a product data feed to GMC. Two modes:
1. **Full feed** — Daily at 1 AM UTC. All ACTIVE listings. Submitted as XML/TSV to GMC Content API or via scheduled fetch URL.
2. **Incremental updates** — On listing create, update, status change. Pushed via GMC Content API `products.insert` / `products.delete`.

**Feed URL:** `https://twicely.co/api/feeds/google-shopping.xml` (paginated, fetched by Google daily)

### 2.4 Product Data Specification

Each listing maps to a Google Shopping product entry. Required and recommended attributes:

| Google Attribute | Twicely Source | Required | Notes |
|-----------------|---------------|----------|-------|
| `id` | `listing.id` | Yes | Unique per item |
| `title` | `listing.title` | Yes | Max 150 chars |
| `description` | `listing.description` | Yes | Max 5000 chars, strip HTML |
| `link` | `https://twicely.co/i/{slug}` | Yes | Canonical listing URL |
| `image_link` | Primary listing image URL (R2) | Yes | Min 250x250px |
| `additional_image_link` | Additional listing images (up to 10) | Recommended | |
| `availability` | Map from listing status | Yes | `in_stock` for ACTIVE |
| `price` | `{priceCents/100} USD` | Yes | Format: "42.99 USD" |
| `condition` | Map from `listing.condition` | Yes | `new`, `refurbished`, `used` |
| `brand` | `listing.brand` | Recommended | If available |
| `gtin` | `listing.attributesJson.upc` or `.ean` | Recommended | If available |
| `mpn` | `listing.attributesJson.mpn` | Recommended | If available |
| `identifier_exists` | `false` if no GTIN/MPN/brand | Yes | Required for used/custom items |
| `product_type` | Category path: "Apparel > Women > Tops" | Recommended | From `category.path` |
| `google_product_category` | Mapped from Twicely categories | Recommended | Google taxonomy ID |
| `item_group_id` | NULL (each listing is unique) | No | Used items are one-of-a-kind |
| `shipping` | Computed from shipping profile | Recommended | Price or "Free" |
| `custom_label_0` | `listing.condition` | Optional | For Shopping campaign segmentation |
| `custom_label_1` | `category.feeBucket` | Optional | For category-level reporting |

**Condition Mapping:**

| Twicely Condition | Google Condition |
|-------------------|-----------------|
| NEW_WITH_TAGS | `new` |
| NEW_WITHOUT_TAGS | `new` |
| LIKE_NEW | `used` |
| GOOD | `used` |
| ACCEPTABLE | `used` |
| FOR_PARTS | `used` |

**Feed Exclusions:**
- Listings with `enforcementState != CLEAR` — never in feed
- Listings without images — never in feed
- Listings without price — never in feed
- Listings in DRAFT, ENDED, SOLD status — never in feed
- Listings flagged for review — never in feed

### 2.5 Google Category Mapping Table

New table to map Twicely categories to Google product taxonomy IDs:

```typescript
export const googleCategoryMapping = pgTable('google_category_mapping', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  twicelyCategor yId:  text('twicely_category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  googleCategoryId:    integer('google_category_id').notNull(),  // Google taxonomy numeric ID
  googleCategoryPath:  text('google_category_path').notNull(),   // "Apparel & Accessories > Clothing > Shirts & Tops"
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  twicelyIdx:          unique().on(table.twicelyCategor yId),
}));
```

Seeded during category setup. Admin-editable at `/cfg/google-shopping`. One Twicely category → one Google category.

### 2.6 Pipeline Jobs

| Job | Queue | Schedule | Description |
|-----|-------|----------|-------------|
| `google-feed-full` | `google-shopping` | Daily 1 AM UTC | Generate full product feed XML, upload to GMC |
| `google-feed-incremental` | `google-shopping` | On listing create/update/delete/status change | Push single product update via GMC Content API |
| `google-feed-cleanup` | `google-shopping` | Daily 2 AM UTC | Remove products from GMC that are no longer ACTIVE |

### 2.7 Platform Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `google.shopping.enabled` | boolean | true | Master toggle for Google Shopping feed |
| `google.shopping.merchantId` | string | — | GMC Merchant Center ID |
| `google.shopping.feedUrl` | string | — | Public feed URL for GMC to fetch |
| `google.shopping.fullFeedSchedule` | cron | `0 1 * * *` | Daily full feed generation |
| `google.shopping.incrementalEnabled` | boolean | true | Real-time updates via Content API |
| `google.shopping.excludeCategories` | string[] | [] | Category IDs to exclude from feed |

---

## 3. CHANNEL 3: RESALE CREATOR AFFILIATES

### 3.1 Already Spec'd

The Affiliate & Trials Canonical covers the full affiliate infrastructure:
- Two-tier structure (Community 15% / Influencer 20–30%)
- Promo codes, attribution, payouts
- Schema: 6 tables (affiliate, referral, promoCode, promoCodeRedemption, affiliateCommission, affiliatePayout)

The Social Discovery Addendum adds listing-level affiliate links:
- `twicely.co/i/{slug}?ref={affiliateCode}`
- 3% commission on sale (paid by seller, deducted from payout)
- 7-day attribution window
- Seller opt-in/out control

### 3.2 Buyer Acquisition Framing

Resale creators are the acquisition channel. They are simultaneously:
1. **Sellers** — listing their inventory on Twicely via crosslister
2. **Buyer magnets** — their TikTok/YouTube/Instagram followers click through to Twicely to buy

A creator with 50K followers who posts a thrift haul video and links to their Twicely store drives those followers to Twicely as buyers. Depop's entire growth was built on this — creators promoted their own shops on social, every follower became a platform buyer.

### 3.3 Twicely's Creator Content Angle

No other platform gives sellers market intelligence they can flex in content:
- "Twicely told me this vintage Guess jacket sells for $55 on Poshmark but $68 on eBay"
- "My Twicely dashboard says my sell-through on Women's Tops is 68%"
- "Twicely's deal badge says this is a Great Price — bottom 20% for the category"

This is creator-friendly content that's unique to Twicely. ZIK charges $30–$99/mo for equivalent data. Twicely gives it built into the workflow.

### 3.4 Launch Plan (Pre-Launch, No Code Needed)

1. Identify 20 mid-tier resale creators (10K–100K followers) on TikTok/YouTube/Instagram
2. Offer Influencer affiliate tier (20–30% commission) + free Seller Power bundle ($99.99 value) for 6 months
3. Build relationships before the affiliate tracking system ships — formalize when G1 goes live
4. Target creators across categories: fashion (10), electronics (3), collectibles (3), vintage home (2), sneakers (2)
5. Miami-based creators get priority (proximity to Adrian for relationship building)

**Cost:** ~$2K/month in comped subscriptions (20 × $99.99/mo). Potential reach: 500K–2M impressions/month.

### 3.5 No New Technical Work

Everything needed is in the Affiliate Canonical + Social Discovery Addendum. No schema additions, no new tables, no build order changes for this channel.

---

## 4. CHANNEL 4: SEO LONG-TAIL PRODUCT PAGES

### 4.1 Already Spec'd

The Page Registry (§11) and Feature Lock-in (§17) cover:
- JSON-LD `Product` schema on all listing pages
- Dynamic XML sitemaps (daily cron, paginated at 50K per file)
- Clean canonical URLs: `twicely.co/i/{slug}`
- Meta tags per page type
- Server-side rendering for all public pages
- `robots.txt` rules
- Open Graph + Twitter Card tags

### 4.2 Crosslister Import as SEO Bomb

10,000 sellers importing 50 listings each = 500,000 indexable product pages. With proper schema markup and clean URLs, these pages rank for exactly the long-tail queries buyers type:
- "vintage Levi's 501 W30 L32 light wash"
- "used Canon EOS R5 body only"
- "Nike Air Jordan 1 Retro High OG size 11"

Every import is an SEO event. Every listing page is a buyer acquisition asset.

### 4.3 Enhanced Structured Data for Google Shopping

The Product JSON-LD in the Page Registry needs these additional fields to maximize Google Shopping visibility:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Vintage Levi's 501 W30 L32 Light Wash",
  "description": "...",
  "image": ["https://cdn.twicely.co/..."],
  "brand": { "@type": "Brand", "name": "Levi's" },
  "sku": "{listing.id}",
  "gtin13": "{if available}",
  "itemCondition": "https://schema.org/UsedCondition",
  "offers": {
    "@type": "Offer",
    "url": "https://twicely.co/i/{slug}",
    "priceCurrency": "USD",
    "price": "42.99",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "{seller store name or username}"
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "0",
        "currency": "USD"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 3, "unitCode": "d" },
        "transitTime": { "@type": "QuantitativeValue", "minValue": 2, "maxValue": 7, "unitCode": "d" }
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "US"
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "US",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{seller rating}",
    "reviewCount": "{seller review count}"
  }
}
```

The shipping details and return policy structured data are signals Google uses for Shopping ranking. Most eBay listings don't include these in structured data.

### 4.4 No New Tables

SEO infrastructure is already spec'd. The enhanced JSON-LD is a code-level change in the listing detail page component, not a schema change.

---

## 5. CHANNEL 6: "SOLD FOR" PRICE REFERENCE PAGES

### 5.1 The Concept

When items sell on Twicely, the sold price becomes public data. This creates pages that compete with eBay's completed listings for price research queries:
- "How much is [item] worth"
- "[Brand] [model] sold price"
- "[Item] resale value"

Every sold item becomes a reference page attracting future buyers who are actively researching prices — and they land on Twicely where active listings for similar items are visible.

### 5.2 Page Registry Fix: SOLD Listing Indexing

**CONFLICT:** Page Registry §11.2 currently says:
```
Listing (SOLD/ENDED) → ❌ noindex
```

**This must change for Channel 6 to work.** SOLD listings need to be indexed.

**Updated indexing rule:**

| Status | Indexable | Canonical | Rule |
|--------|-----------|-----------|------|
| ACTIVE | ✅ index | `twicely.co/i/{slug}` | Always indexed |
| SOLD | ✅ index | `twicely.co/i/{slug}` | Indexed with "Sold For" overlay. Shows sold price, sold date, and links to similar active listings. |
| ENDED (unsold) | ❌ noindex | — | No value to searchers |
| DRAFT | ❌ noindex | — | Not public |

**SOLD listing page behavior:**
- Title tag: `{Item Title} — Sold for ${price} | Twicely`
- Shows sold price prominently with date
- Original listing photos and description remain visible
- "See similar items for sale" section below with active listings in same category + condition + brand
- Structured data changes `availability` to `https://schema.org/SoldOut`
- Adds `priceValidUntil` (sold date) to JSON-LD
- No "Add to Cart" or "Make Offer" buttons — replaced with "Browse similar" CTA

**SOLD listings in sitemap:**
- New sitemap file: `sitemap-sold.xml`
- Contains SOLD listings from last 90 days only (older ones get noindexed to prevent stale content penalty)
- Updated daily alongside `sitemap-listings.xml`

**Why 90 days:** Google penalizes stale out-of-stock pages if they dominate a site. 90 days provides fresh price reference data without accumulating dead pages. After 90 days, SOLD listings flip to `noindex` but remain accessible via direct URL.

### 5.3 Schema Addition: Sold Listing Fields

The `listing` table already has `status = SOLD` and `priceCents`. We need:

```typescript
// Add to listing table
soldAt:           timestamp('sold_at', { withTimezone: true }),   // When the item sold
soldPriceCents:   integer('sold_price_cents'),                    // Final sold price (may differ from listing price if offer accepted)
```

`soldAt` gets set when order transitions to PAID. `soldPriceCents` is the actual transaction price (which may be lower than `priceCents` if an offer was accepted).

**NOTE:** Check if these fields already exist on the `order` table. If so, the SOLD listing page can join to `order` instead of duplicating data. But having them on `listing` avoids the join on a high-traffic public page.

### 5.4 "Sold For" Display Threshold

Per Market Intelligence Canonical §3.3: minimum 5 sold items in category + condition + brand in last 90 days before showing "Recently sold for" aggregate on active listing pages. Individual SOLD listing pages always show their own sold price (no minimum).

### 5.5 Platform Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `seo.soldListingIndexDays` | number | 90 | Days to keep SOLD listings indexed |
| `seo.soldListingIndexEnabled` | boolean | true | Master toggle for SOLD listing indexing |

---

## 6. CHANNEL 7: BUYER REFERRAL PROGRAM

### 6.1 Rules

| Rule | Value |
|------|-------|
| **Credit amount** | $5 to both referrer and referred buyer |
| **Minimum order** | $50+ (pre-shipping) |
| **Expiry** | 30 days from issuance |
| **Form** | "$5 off your first order of $50+" — not generic credit |
| **Referrer reward** | $5 Twicely credit (usable on any purchase, buyer or seller side) |
| **Stacking** | Cannot stack with affiliate promo codes or platform promo codes |
| **Self-referral** | Forbidden (same payment method / IP / device checks) |
| **Per-account limit** | One referral credit per new account (can't be referred twice) |
| **Referrer cap** | No cap (refer as many friends as you want) |
| **Attribution** | Referral link: `twicely.co/join?ref={userId short code}` |

### 6.2 Financial Model

$50 order × 10% TF = $5 to Twicely. Stripe fees paid by seller. Twicely spends $5 on referral credit. **True breakeven on first order.** Second purchase from referred buyer is pure TF revenue with zero acquisition cost.

### 6.3 Schema

```typescript
export const buyerReferralStatusEnum = pgEnum('buyer_referral_status', [
  'PENDING',      // Link shared, no signup yet
  'SIGNED_UP',    // Referred user created account
  'REDEEMED',     // Referred user placed qualifying order ($50+)
  'EXPIRED',      // 30 days passed without qualifying order
]);

export const buyerReferral = pgTable('buyer_referral', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  referrerUserId:    text('referrer_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  referredUserId:    text('referred_user_id').references(() => user.id, { onDelete: 'set null' }),
  referralCode:      text('referral_code').notNull().unique(),  // Short code for URL
  status:            buyerReferralStatusEnum('status').notNull().default('PENDING'),

  // Credits
  referrerCreditCents:   integer('referrer_credit_cents'),       // Issued when referred user redeems
  referredCreditCents:   integer('referred_credit_cents'),       // Applied to qualifying order
  qualifyingOrderId:     text('qualifying_order_id'),            // The order that triggered redemption

  // Anti-fraud
  referredIp:            text('referred_ip'),
  referredDeviceHash:    text('referred_device_hash'),

  // Timestamps
  clickedAt:         timestamp('clicked_at', { withTimezone: true }),
  signedUpAt:        timestamp('signed_up_at', { withTimezone: true }),
  redeemedAt:        timestamp('redeemed_at', { withTimezone: true }),
  expiresAt:         timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  referrerIdx:       index('br_referrer').on(table.referrerUserId),
  referredIdx:       index('br_referred').on(table.referredUserId),
  codeIdx:           unique().on(table.referralCode),
  statusIdx:         index('br_status').on(table.status),
}));
```

**User Credit Balance:**

Add to `user` table:

```typescript
// Add to user table
creditBalanceCents:  integer('credit_balance_cents').notNull().default(0),
```

Credit is platform-wide (usable on buyer or seller side). Decremented at checkout. Never goes negative. Cannot be cashed out.

### 6.4 Credit Ledger

Referral credits create ledger entries for audit trail:

```
Event: Buyer referral redeemed

Entries:
  1. BUYER_REFERRAL_CREDIT_ISSUED  -{creditAmountCents}  (referrer's credit)
  2. BUYER_REFERRAL_CREDIT_ISSUED  -{creditAmountCents}  (referred buyer's discount)

metadata: { referralId, referrerUserId, referredUserId, qualifyingOrderId }
```

Add `BUYER_REFERRAL_CREDIT_ISSUED` and `BUYER_REFERRAL_CREDIT_REDEEMED` to `ledgerEntryTypeEnum`.

### 6.5 Routes

| Route | Purpose | Gate |
|-------|---------|------|
| `twicely.co/join?ref={code}` | Referral landing (sets cookie, redirects to signup) | Public |
| `/my/referrals` | Referral dashboard (share link, see status of referrals) | Authenticated |

### 6.6 Platform Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `referral.buyer.enabled` | boolean | true | Master toggle |
| `referral.buyer.creditCents` | cents | 500 | Credit amount for both parties |
| `referral.buyer.minOrderCents` | cents | 5000 | Minimum qualifying order ($50) |
| `referral.buyer.expiryDays` | number | 30 | Days before referral credit expires |
| `referral.buyer.cookieDays` | number | 7 | Attribution cookie duration |
| `referral.buyer.maxPendingPerUser` | number | 50 | Max outstanding referral links per user |

### 6.7 Anti-Fraud

Same patterns as Affiliate Canonical §6:
- Same payment method between referrer and referred → rejected
- Same IP + device hash → flagged for review
- Burst detection: >10 signups from same referral code in 24h → auto-pause, manual review
- Credit abuse: user creating multiple accounts to self-refer → permanent ban on all accounts

---

## 7. BUILD ORDER CHANGES

### 7.1 Additions to Existing Phases

| Phase | Step | Addition | Work Estimate |
|-------|------|----------|---------------|
| **B2** | Listing Creation | Google Merchant Center feed generator (full + incremental) | 3 days |
| **B2** | Listing Creation | Enhanced JSON-LD Product schema with shipping + return policy | 1 day |
| **B2** | Listing Creation | `google_category_mapping` table + seed data + admin UI at `/cfg/google-shopping` | 1 day |
| **B2** | Listing Detail | SOLD listing page behavior (sold price overlay, "see similar" section) | 2 days |
| **B2** | Listing Detail | `soldAt` + `soldPriceCents` fields on listing table | Migration, 0.5 days |
| **B4** | Order Management | Set `listing.soldAt` and `listing.soldPriceCents` when order reaches PAID | 0.5 days |
| **B2.1** | Price History | "Sold For" comps display (already tracked in Build Sequence) | Already tracked |
| **G1** | Onboarding | Buyer referral schema + `buyer_referral` table | 1 day |
| **G1** | Onboarding | Buyer referral flow: share link, signup with credit, checkout discount | 2 days |
| **G1** | Onboarding | `/my/referrals` dashboard page | 1 day |
| **G1** | Onboarding | `user.creditBalanceCents` field + checkout credit application | 1 day |

### 7.2 Updated Build Sequence Tracker Entries

Add to Build Sequence Tracker:

```
B2.2 | Google Merchant Center feed generator | ⬜ | B2 | Full + incremental feed. google_category_mapping table. 
B2.3 | Enhanced Product JSON-LD | ⬜ | B2 | Shipping details, return policy, seller rating in structured data.
B2.4 | SOLD listing indexing + page behavior | ⬜ | B2, B4 | Sold price overlay, "see similar" CTA, 90-day index window.
G1.5 | Buyer referral program | ⬜ | G1 | buyer_referral table, credit balance, share flow, checkout discount.
```

### 7.3 Sitemap Changes

Update Page Registry §11.5:

```
Existing:
- sitemap-categories.xml
- sitemap-listings.xml (ACTIVE only)
- sitemap-stores.xml
- sitemap-help.xml
- sitemap-index.xml

Add:
- sitemap-sold.xml (SOLD listings from last 90 days, paginated at 50K)
```

Daily cron updates both `sitemap-listings.xml` and `sitemap-sold.xml`.

### 7.4 Page Registry Updates

Update §11.2 Indexing Rules:

| Page Type | Indexable | Canonical | **Change** |
|-----------|-----------|-----------|------------|
| Listing (ACTIVE) | ✅ | `twicely.co/i/{slug}` | No change |
| **Listing (SOLD, ≤90 days)** | **✅** | `twicely.co/i/{slug}` | **NEW — was noindex** |
| Listing (SOLD, >90 days) | ❌ noindex | — | **NEW — age-gated** |
| Listing (ENDED) | ❌ noindex | — | No change |

Update §11.1 Title Patterns — add:

| Page Type | Pattern |
|-----------|---------|
| Listing (SOLD) | `{Listing Title} — Sold for ${soldPrice} | Twicely` |

---

## 8. SCHEMA SUMMARY

### 8.1 New Tables

| Table | Domain | Fields |
|-------|--------|--------|
| `google_category_mapping` | Google Shopping | twicelyCategor yId, googleCategoryId, googleCategoryPath |
| `buyer_referral` | Buyer Acquisition | referrerUserId, referredUserId, referralCode, status, credits, anti-fraud, timestamps |

### 8.2 New Enums

| Enum | Values |
|------|--------|
| `buyerReferralStatusEnum` | PENDING, SIGNED_UP, REDEEMED, EXPIRED |

### 8.3 Field Additions to Existing Tables

| Table | Field | Type | Default | Purpose |
|-------|-------|------|---------|---------|
| `listing` | `soldAt` | timestamp | null | When the item sold |
| `listing` | `soldPriceCents` | integer | null | Actual transaction price |
| `user` | `creditBalanceCents` | integer | 0 | Platform credit balance |

### 8.4 Ledger Entry Type Additions

Add to `ledgerEntryTypeEnum`:
- `BUYER_REFERRAL_CREDIT_ISSUED`
- `BUYER_REFERRAL_CREDIT_REDEEMED`

### 8.5 Table Count Impact

Previous total (Schema Addendum v1.3): 115 tables
New tables: 2
**New total: 117 tables** (before Market Intelligence Canonical tables are counted)

---

## 9. CASL PERMISSIONS

```typescript
// Buyer Referral
{ action: 'read', subject: 'BuyerReferral', conditions: { referrerUserId } }   // Own referrals
{ action: 'create', subject: 'BuyerReferral', conditions: { referrerUserId } }  // Generate link

// Google Shopping (admin only)
{ action: 'manage', subject: 'GoogleCategoryMapping' }  // SUPER_ADMIN or catalog scope
```

Add `BuyerReferral` and `GoogleCategoryMapping` to CASL subjects.

---

## 10. PROJECTION AT LAUNCH

Assuming 50,000 active listings (1,000 crosslister sellers × 50 imports avg):

| Channel | Monthly Visitors (est.) | Monthly Orders (est.) | Cost |
|---------|------------------------|-----------------------|------|
| Google Shopping (free) | 1,500–3,000 | 45–90 | $0 |
| Creator affiliates (20) | 500–2,000 | 15–60 | ~$2K comped |
| SEO long-tail | 2,000–5,000 | 60–150 | $0 |
| "Sold For" pages | 500–1,500 | 15–45 | $0 |
| Buyer referral (10% multiplier) | multiplier | 14–35 | $5/referral |
| **Total** | **~5,000–12,000** | **~150–380** | **~$2.7K/mo** |

At $45 AOV × 10% TF: 150–380 orders × $4.50 = **$675–$1,710/mo TF** from buyer channels.

Compounding: every month, inventory grows (more seller imports), SEO strengthens (more indexed pages), "Sold For" library deepens (more price reference data), creators produce more content. Month 6 should be 3–5x month 1.

---

## 11. WHAT THIS DOCUMENT DOES NOT COVER

- ❌ Paid advertising (Google Ads, social ads) — add as accelerant post-launch if organic proves concept
- ❌ Miami-specific marketing — Twicely.Local is nationwide, not geo-targeted
- ❌ Brand partnerships / branded resale programs — future opportunity, not launch priority
- ❌ Live selling / livestream shopping — post-launch per Social Discovery Addendum
- ❌ Email marketing to acquired buyers — covered by notification/personalization systems already spec'd

---

## 12. DOCUMENT REFERENCES

| Document | What Changes |
|----------|-------------|
| `TWICELY_V3_PAGE_REGISTRY.md` | §11.2 SOLD listing indexing rule, §11.5 add sitemap-sold.xml, §11.1 SOLD title pattern |
| `TWICELY_V3_SCHEMA.md` | §5.1 listing — add soldAt, soldPriceCents. §3 user — add creditBalanceCents |
| `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` | Add B2.2, B2.3, B2.4, G1.5 |
| `TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md` | No changes — already covers creator affiliates |
| `TWICELY_V3_FEATURE_LOCKIN_SOCIAL_DISCOVERY.md` | No changes — already covers listing-level affiliate links |
| `TWICELY_V3_MARKET_INTELLIGENCE_CANONICAL.md` | §5.2.3 "Sold For" display threshold (already spec'd) |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | Add §Google Shopping settings, §Buyer Referral settings, §SEO sold listing settings |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Add BuyerReferral and GoogleCategoryMapping CASL subjects |
| `TWICELY_V3_SCHEMA_ADDENDUM_v1_4.md` | If created — include google_category_mapping, buyer_referral tables, new enums, field additions |

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-21 | Initial lock. 5 buyer acquisition channels. Google Shopping feed spec. SOLD listing indexing fix. Buyer referral program. 2 new tables, 1 new enum, 3 field additions. Build order additions at B2 and G1. |

---

**This document is the single source of truth for Twicely V3 buyer acquisition strategy and technical requirements.**
**Vocabulary: StoreTier (storefront subscription), ListerTier (crosslister subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**

**END OF DOCUMENT — TWICELY_V3_BUYER_ACQUISITION_ADDENDUM.md**
