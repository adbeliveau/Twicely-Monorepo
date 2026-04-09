# Canonical 33 — Buyer Experience Plus

**Status:** DRAFT (V4)
**Domain:** Commerce / Personalization / Notifications
**Depends on:** Canonical 07 (Search & Discovery), Canonical 13 (Promotions), `packages/db/src/schema/alerts.ts`, `packages/db/src/schema/social.ts`, `packages/db/src/schema/market-intelligence.ts`, `packages/db/src/schema/personalization.ts`
**Package:** `packages/commerce/src/` (price alerts, history, market index, deal badges, recommendations), `packages/notifications/src/` (digests)

---

## 1. Purpose

This canonical defines **advanced buyer engagement, pricing intelligence, and personalization** features that build on V3's existing buyer experience infrastructure. It ensures:

- Buyers can set sophisticated price alerts with multiple trigger types and digest consolidation
- Price history is tracked per-listing and visualized for informed purchasing
- Market-based deal detection highlights honest bargains
- Saved searches and category alerts notify buyers when matching listings appear
- Browsing history and purchase signals inform personalized recommendation feeds
- Collections let buyers organize saved listings beyond a flat watchlist
- Reviews are enhanced with photos, verified purchase badges, and auto-moderation
- Notifications are consolidated into timezone-aware digests to prevent fatigue
- All features respect privacy: buyers can clear history, opt out, and export data

---

## 2. Core Principles

1. **Alerts are buyer-controlled.** Users set their own thresholds and frequencies. No dark patterns.
2. **History enables, never betrays.** Browsing and price data improve the experience but are never sold or exposed to sellers.
3. **Recommendations are explainable.** Every recommendation includes a reason the buyer can understand (e.g., "Based on your interest in Vintage Denim").
4. **Deal badges are honest.** Only true market bargains get highlighted. No fake urgency. LOW-confidence badges hidden by default.
5. **Digests respect attention.** Consolidate notifications into chosen windows. Never spam.
6. **Privacy is paramount.** Buyers can clear history, disable tracking, and export all data (GDPR-compliant).
7. **All money in integer cents.** Percentiles, thresholds, and rates use cents or basis points.
8. **All limits and thresholds from `platform_settings`.** Never hardcoded.

---

## 3. Schema (Drizzle pgTable)

### 3.1 EXISTING -- `priceAlert` (alerts.ts) -- V4 column extensions

The `priceAlert` table already exists with: `id, userId, listingId, alertType, targetPriceCents, percentDrop, priceCentsAtCreation, isActive, lastTriggeredAt, expiresAt, createdAt`.

**V4 adds:**

| Column | Type | Purpose |
|--------|------|---------|
| `includeInDigest` | `boolean DEFAULT false` | Include triggered alerts in daily digest |
| `digestSentAt` | `timestamp` | Last time included in a digest |
| `suggestedBySystem` | `boolean DEFAULT false` | True if system auto-suggested this alert target |
| `originalPriceCents` | `integer` | Price when alert was created (for % drop calc) |
| `triggeredPriceCents` | `integer` | Price that caused the trigger |
| `triggeredAt` | `timestamp` | When the alert was triggered |
| `notificationSentAt` | `timestamp` | When the notification was dispatched |

### 3.2 EXISTING -- `categoryAlert` (alerts.ts) -- no changes

Already has: `id, userId, categoryId, filtersJson, isActive, lastTriggeredAt, expiresAt, createdAt`.

### 3.3 EXISTING -- `browsingHistory` (social.ts) -- no changes

Already has full engagement tracking: `viewCount, totalDurationSec, didAddToCart, didAddToWatchlist, didMakeOffer, didPurchase, didSetPriceAlert, sourceType, searchQuery`.

### 3.4 EXISTING -- `savedSearch` (social.ts) -- no changes

Already has: `name, queryJson, notifyNewMatches, lastCheckedAt`.

### 3.5 EXISTING -- `watchlistItem` (social.ts) -- no changes

Already has: `userId, listingId, notifyPriceDrop`.

### 3.6 EXISTING -- Market Intelligence tables -- no changes

`marketPricePoint`, `marketCategorySummary`, `marketListingIntelligence`, `marketOfferIntelligence` already exist.

### 3.7 NEW -- `priceHistory`

```typescript
// packages/db/src/schema/buyer-experience.ts

export const priceHistory = pgTable('price_history', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  listingId:      text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  priceCents:     integer('price_cents').notNull(),
  previousCents:  integer('previous_cents'),
  changeType:     text('change_type').notNull(),  // 'INITIAL' | 'INCREASE' | 'DECREASE' | 'SNAPSHOT'
  changeBps:      integer('change_bps'),           // change in basis points (positive = increase, negative = decrease)
  source:         text('source').notNull().default('listing_update'),  // 'listing_update' | 'offer_accepted' | 'promotion' | 'daily_snapshot'
  snapshotDate:   timestamp('snapshot_date', { withTimezone: true }).notNull().defaultNow(),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingDateIdx: index('ph_listing_date').on(table.listingId, table.snapshotDate),
  snapshotIdx:    index('ph_snapshot').on(table.snapshotDate),
}));
```

### 3.8 NEW -- `buyerCollection`

Named collections for organizing saved listings beyond the flat watchlist.

```typescript
export const buyerCollection = pgTable('buyer_collection', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  userId:       text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  description:  text('description'),
  isPublic:     boolean('is_public').notNull().default(false),
  coverImageUrl: text('cover_image_url'),
  sortOrder:    integer('sort_order').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:      index('bc_user').on(table.userId),
}));

export const buyerCollectionItem = pgTable('buyer_collection_item', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  collectionId:   text('collection_id').notNull().references(() => buyerCollection.id, { onDelete: 'cascade' }),
  listingId:      text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  note:           text('note'),
  addedAt:        timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  collectionIdx:  index('bci_collection').on(table.collectionId),
  uniqueItem:     unique().on(table.collectionId, table.listingId),
}));
```

### 3.9 NEW -- `recommendationFeed`

```typescript
export const recommendationFeed = pgTable('recommendation_feed', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  userId:      text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  feedType:    text('feed_type').notNull().default('home'),  // 'home' | 'category' | 'similar' | 'deals' | 'complete_the_look'
  itemsJson:   jsonb('items_json').notNull().default('[]'),   // [{listingId, score, reason, position}]
  computedAt:  timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:   timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userFeedIdx:  unique().on(table.userId, table.feedType),
  expiresIdx:   index('rf_expires').on(table.expiresAt),
}));
```

### 3.10 NEW -- `buyerPreference` (inferred profile)

```typescript
export const buyerPreference = pgTable('buyer_preference', {
  id:                            text('id').primaryKey().$defaultFn(() => createId()),
  userId:                        text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  categoryScoresJson:            jsonb('category_scores_json').notNull().default('[]'),   // [{categoryId, score}]
  brandScoresJson:               jsonb('brand_scores_json').notNull().default('[]'),      // [{brand, score}]
  sizePreferencesJson:           jsonb('size_preferences_json').notNull().default('{}'),  // {tops: "M", shoes: "10"}
  avgViewedPriceCents:           integer('avg_viewed_price_cents'),
  preferredPriceRangeLowCents:   integer('preferred_price_range_low_cents'),
  preferredPriceRangeHighCents:  integer('preferred_price_range_high_cents'),
  preferredConditions:           text('preferred_conditions').array().notNull().default(sql`'{}'::text[]`),
  // Digest preferences
  digestFrequency:               text('digest_frequency').notNull().default('DAILY'),   // 'NONE' | 'DAILY' | 'WEEKLY' | 'INSTANT'
  digestTime:                    text('digest_time').notNull().default('09:00'),        // HH:MM in user's timezone
  digestTimezone:                text('digest_timezone').notNull().default('America/New_York'),
  lastDigestSentAt:              timestamp('last_digest_sent_at', { withTimezone: true }),
  lastComputedAt:                timestamp('last_computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:                     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('bp_user').on(table.userId),
}));
```

### 3.11 NEW -- `reviewModerationQueue`

```typescript
export const reviewModerationQueue = pgTable('review_moderation_queue', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  reviewId:          text('review_id').notNull().references(() => review.id, { onDelete: 'cascade' }),
  flagReason:        text('flag_reason').notNull(),   // 'PROFANITY' | 'SPAM' | 'PERSONAL_INFO' | 'COMPETITOR_MENTION' | 'AUTO_FLAGGED' | 'USER_REPORTED'
  flagScore:         integer('flag_score').notNull().default(0),  // 0-100 (higher = more likely violation)
  autoFlagged:       boolean('auto_flagged').notNull().default(false),
  status:            text('status').notNull().default('PENDING'),  // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED'
  reviewedByStaffId: text('reviewed_by_staff_id'),
  reviewedAt:        timestamp('reviewed_at', { withTimezone: true }),
  reviewNote:        text('review_note'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx:  index('rmq_status').on(table.status),
  reviewIdx:  index('rmq_review').on(table.reviewId),
}));
```

---

## 4. Price Alerts (Enhanced)

### 4.1 Alert Types

| Type | Trigger Condition |
|------|-------------------|
| `BELOW_TARGET` | Price drops to or below `targetPriceCents` |
| `PERCENT_DROP` | Price drops by `percentDrop`% from `originalPriceCents` |
| `ANY_DROP` | Any price reduction from `originalPriceCents` |

### 4.2 Alert Rules

1. **One alert per (userId, listingId).** Upsert on conflict.
2. **Target must be below current price** (for BELOW_TARGET).
3. **Alerts are one-shot.** Deactivated after trigger (buyer can re-enable).
4. **Default expiry:** `buyer.priceAlert.defaultExpiryDays` (90 days).
5. **Max per user:** `buyer.priceAlert.maxPerUser` (50).
6. **Seller cannot see alerts.**
7. **System-suggested targets:** If listing is > `buyer.priceAlert.suggestionThresholdPct` (15%) above market median, offer to create an alert at the median.

### 4.3 Triggering

When a listing price changes (from any source: seller edit, promotion, offer acceptance):
1. `checkPriceAlertsForListing(listingId, newPriceCents)` is called
2. All active alerts for that listing are evaluated
3. Matching alerts are marked triggered (`triggeredAt`, `triggeredPriceCents`, `isActive = false`)
4. Immediate notification sent via `notify()` unless `includeInDigest = true`

---

## 5. Price History

### 5.1 Recording

- `recordPriceChange(listingId, newPriceCents, source)` is called on every listing price mutation
- Only records if the change exceeds `buyer.priceHistory.minChangeBps` (default 100 = 1%)
- Computes `changeBps` as `((newPrice - oldPrice) / oldPrice) * 10000`

### 5.2 Daily Snapshots

BullMQ cron captures daily price snapshots for all active listings to ensure continuous chart data even when sellers do not change prices.

### 5.3 Retention

| Data Type | Retention |
|-----------|-----------|
| Individual price changes | `buyer.priceHistory.retentionDays` (365 days) |
| Daily snapshots | 90 days, then aggregated to weekly |
| Summary stats (min/max/avg) | Lifetime (via `marketListingIntelligence`) |

### 5.4 UI

- Price history chart on listing detail page (line chart, last 90 days by default)
- "Lowest price ever" badge when current price equals historical min and has dropped at least once

---

## 6. Market Price Index

Extends V3's existing `marketCategorySummary` and `marketListingIntelligence` tables.

### 6.1 Index Computation

BullMQ cron `market-index-computation` runs nightly:
1. For each active category x condition bucket combination
2. Query `marketPricePoint` records from the last 90 days
3. Compute: median, avg, p25, p75, min, max, sample size, confidence level
4. Upsert into `marketCategorySummary`

Confidence thresholds:
- HIGH: >= 50 comparable sales
- MEDIUM: 20-49 comparable sales
- LOW: < 20 comparable sales

### 6.2 Deal Badge Integration

The existing `deal-badges.ts` in `packages/commerce/` already computes `GREAT_PRICE`, `PRICE_DROP`, `FAST_SELLER`, `LAST_ONE` badges. The market index feeds this:
- `GREAT_PRICE`: listing price <= p25 of `marketCategorySummary` with >= MEDIUM confidence
- Badge requires minimum sample size: `buyer.dealBadge.minSampleSize` (default 20)
- LOW confidence badges hidden by default (configurable)

---

## 7. Recommendations

### 7.1 Feed Types

| Feed | Purpose |
|------|---------|
| `home` | Personalized homepage section |
| `category` | "More like this" within a category |
| `similar` | Similar to a specific listing |
| `deals` | Best deals matching buyer preferences |
| `complete_the_look` | AI-powered outfit/set suggestions |

### 7.2 Feed Algorithm

1. Get top 5 interest tags by weight from `userInterest`
2. Get category IDs from matching tags
3. Query active listings in those categories, excluding recently viewed (configurable hours)
4. Score each listing: `interestWeight * 0.4 + recencyScore * 0.3 + dealBadgeBonus * 0.3`
5. Cache result in `recommendationFeed` with TTL from `buyer.recommendation.feedTtlMinutes`

### 7.3 Reason Codes

Every recommendation includes a human-readable reason:

| Code | Display Text |
|------|-------------|
| `viewed_similar` | "Similar to items you viewed" |
| `same_category` | "Popular in [Category]" |
| `same_brand` | "More from [Brand]" |
| `price_range` | "In your price range" |
| `trending` | "Trending now" |
| `size_match` | "Available in your size" |
| `great_deal` | "Great deal" |
| `price_dropped` | "Price just dropped" |
| `followed_seller` | "New from a seller you follow" |

---

## 8. Collections

### 8.1 Collection Rules

- Max collections per user: `buyer.collection.maxPerUser` (default 50)
- Max items per collection: `buyer.collection.maxItemsPerCollection` (default 200)
- Collections can be public (shareable via link) or private
- Default collection: "Favorites" (auto-created, cannot be deleted)
- Listings removed from the platform are soft-removed from collections (still visible with "no longer available" badge)

### 8.2 Collection Operations

- Create, rename, delete, reorder collections
- Add/remove listings to/from collections
- Share public collection via URL
- Duplicate collection
- Export collection as CSV (listing titles, prices, URLs)

---

## 9. Enhanced Reviews

### 9.1 Photo Reviews

- Buyers can attach up to 5 photos per review
- Photos are stored in S3, referenced via `review.photoUrls` (already exists)
- Photos are run through content moderation (same pipeline as listing photos)

### 9.2 Verified Purchase Badge

- Reviews on completed orders automatically get `isVerifiedPurchase = true`
- Badge displayed prominently on review card
- Non-verified reviews are de-ranked in display order

### 9.3 Auto-Moderation

On review submission:
1. `autoFlagReview(reviewId)` runs text analysis
2. Checks: profanity word list, personal info regex (phone, email, address), competitor mention list
3. If flag score > `buyer.review.profanityThreshold` (default 50), creates `reviewModerationQueue` entry
4. Flagged reviews set to `PENDING` status (not visible to public until staff approves)
5. Clean reviews go to `VISIBLE` immediately

---

## 10. Alert Digests

### 10.1 Digest Generation

Collects all triggered-but-undigested alerts since the user's last digest:
- Price alerts with `includeInDigest = true` and `triggeredAt > lastDigestSentAt`
- Category alert matches
- Watchlist updates (price drops, sold items)

### 10.2 Digest Scheduling

| Frequency | Schedule |
|-----------|----------|
| DAILY | At user's chosen `digestTime` in their `digestTimezone` |
| WEEKLY | Monday at user's chosen time |
| INSTANT | Sent immediately (bypasses batching) |
| NONE | No digests |

BullMQ cron `alert-digest-daily` runs hourly, finds users whose digest time matches the current UTC hour, generates and sends.

### 10.3 Digest Content

Email template includes:
- Price drops: listing image, old price, new price, savings percentage
- New matches: category name, match count, top 3 listings with images
- Watchlist updates: sold items, price changes
- "View All" and "Manage Alerts" links

Min items to send: `buyer.digest.minItemsToSend` (default 1). Max items: `buyer.digest.maxItems` (default 20).

---

## 11. Smart Notifications

Beyond digests, individual notification triggers:

| Event | Template Key | Channel |
|-------|-------------|---------|
| Price drops to/below target | `buyer.priceAlert.triggered` | IN_APP, PUSH |
| New listing matches category alert | `buyer.categoryAlert.newMatch` | IN_APP, PUSH |
| Seller you follow listed a new item | `buyer.followedSeller.newListing` | IN_APP |
| Daily digest | `buyer.digest.daily` | EMAIL |
| Weekly digest | `buyer.digest.weekly` | EMAIL |
| Review submitted | `buyer.review.submitted` | IN_APP |
| Review approved after moderation | `buyer.review.approved` | IN_APP |
| Review rejected with reason | `buyer.review.rejected` | IN_APP |

---

## 12. Buyer Reputation Display

On a buyer's public profile and in seller-facing order details:
- **Purchase count** (total completed orders)
- **Member since** date
- **Review count** (reviews written)
- No numeric "score" -- buyers are not scored like sellers

---

## 13. Order Tracking Dashboard

Enhanced order tracking beyond basic status:
- Visual timeline: Ordered > Confirmed > Shipped > In Transit > Out for Delivery > Delivered
- Carrier tracking integration (Shippo events from `packages/commerce/src/shipping/`)
- Estimated delivery date
- One-click "Report an Issue" (links to dispute flow)
- "Buy Again" button on completed orders (pre-fills cart with same listing if available, or suggests similar)

---

## 14. Quick Buy / Buy Again

- **Quick Buy:** Buyers with a saved payment method and default address can one-tap purchase from listing page
- **Buy Again:** On completed orders, a "Buy Again" button searches for the same or similar listing and pre-fills checkout
- Quick Buy requires: saved payment method, verified address, listing is still active
- Risk gate check (`assertRiskAllowed`) runs on Quick Buy to prevent fraud

---

## 15. Platform Settings Keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `buyer.priceAlert.maxPerUser` | number | `50` | Max active price alerts per user |
| `buyer.priceAlert.defaultExpiryDays` | number | `90` | Auto-expire alerts after N days |
| `buyer.priceAlert.minTargetPercentBelow` | number | `5` | Target must be >= 5% below current |
| `buyer.priceAlert.suggestionThresholdPct` | number | `15` | Suggest alert if item > 15% above market |
| `buyer.priceHistory.retentionDays` | number | `365` | Individual price change retention |
| `buyer.priceHistory.minChangeBps` | number | `100` | Only record changes >= 1% |
| `buyer.priceHistory.snapshotCronPattern` | string | `'0 3 * * *'` | Daily snapshot cron |
| `buyer.marketIndex.minSampleSize` | number | `10` | Min sold listings for market index |
| `buyer.marketIndex.refreshHours` | number | `24` | Recompute interval |
| `buyer.marketIndex.lookbackDays` | number | `90` | Lookback window |
| `buyer.categoryAlert.maxPerUser` | number | `20` | Max active category alerts |
| `buyer.categoryAlert.checkIntervalMinutes` | number | `60` | Matching check interval |
| `buyer.categoryAlert.maxMatchesPerRun` | number | `10` | Max matches to notify per check |
| `buyer.collection.maxPerUser` | number | `50` | Max collections per buyer |
| `buyer.collection.maxItemsPerCollection` | number | `200` | Max items per collection |
| `buyer.digest.defaultTime` | string | `'09:00'` | Default digest delivery time |
| `buyer.digest.maxItems` | number | `20` | Max items per digest email |
| `buyer.digest.minItemsToSend` | number | `1` | Min items to trigger digest |
| `buyer.recommendation.feedTtlMinutes` | number | `60` | Feed cache TTL |
| `buyer.recommendation.maxItems` | number | `50` | Max recommendations per feed |
| `buyer.recommendation.excludeViewedHours` | number | `72` | Exclude recently viewed |
| `buyer.browsingHistory.maxItems` | number | `200` | Max history entries per user |
| `buyer.browsingHistory.retentionDays` | number | `90` | History auto-purge threshold |
| `buyer.review.autoFlagEnabled` | boolean | `true` | Enable auto-flag on submission |
| `buyer.review.profanityThreshold` | number | `50` | Flag score threshold |
| `buyer.dealBadge.minSampleSize` | number | `20` | Min comparables for badge |
| `buyer.dealBadge.lowConfidenceVisible` | boolean | `false` | Show LOW confidence badges |
| `buyer.quickBuy.enabled` | boolean | `true` | Enable Quick Buy flow |

---

## 16. RBAC (CASL Permissions)

| Action | Subject | Roles |
|--------|---------|-------|
| `create` | `PriceAlert` | Authenticated (own alerts) |
| `read` | `PriceAlert` | Own alerts, SUPPORT, ADMIN |
| `delete` | `PriceAlert` | Own alerts, ADMIN |
| `create` | `CategoryAlert` | Authenticated (own alerts) |
| `read` | `BrowsingHistory` | Own history, ADMIN |
| `delete` | `BrowsingHistory` | Own history (clear all) |
| `manage` | `BuyerCollection` | Own collections |
| `read` | `BuyerCollection` | Own + public collections |
| `read` | `RecommendationFeed` | Own feed |
| `manage` | `ReviewModerationQueue` | MODERATION, ADMIN, SUPER_ADMIN |
| `read` | `PriceHistory` | Public (anyone can see price history for a listing) |
| `manage` | `MarketCategorySummary` | FINANCE, ADMIN (force recompute) |
| `read` | `MarketCategorySummary` | Public |

---

## 17. BullMQ Cron Jobs

| Job | Queue | Schedule | Purpose |
|-----|-------|----------|---------|
| `price-history-snapshot` | `buyer-experience` | `0 3 * * *` | Daily price snapshots for active listings |
| `market-index-computation` | `buyer-experience` | `0 4 * * *` | Recompute market indices |
| `alert-digest-daily` | `buyer-experience` | `0 * * * *` | Hourly: send digests for users whose time matches |
| `alert-digest-weekly` | `buyer-experience` | `0 10 * * 1` | Weekly digest on Monday |
| `expire-stale-alerts` | `buyer-experience` | `0 2 * * *` | Deactivate expired price/category alerts |
| `recompute-preferences` | `buyer-experience` | `0 5 * * *` | Nightly buyer preference recomputation |
| `browsing-history-cleanup` | `buyer-experience` | `0 1 * * 0` | Weekly purge of old browsing history |

All crons use `tz: 'UTC'` and read schedule from `platform_settings`.

---

## 18. UI Touchpoints

### Buyer-facing:
| Route | Purpose |
|-------|---------|
| Listing detail page | "Set Price Alert" button, price history chart, deal badge, "Add to Collection" |
| `/account/alerts` | Active price alerts with edit/delete |
| `/account/alerts/categories` | Category alert management |
| `/account/recently-viewed` | Browsing history |
| `/account/collections` | Collection management |
| `/account/collections/[id]` | Collection detail |
| Homepage "For You" section | Personalized recommendation feed |
| `/account/orders` | Order tracking dashboard with visual timeline |
| `/account/settings/notifications` | Digest preferences |

### Admin-facing:
| Route | Purpose |
|-------|---------|
| `(hub)/cfg/buyer-alerts` | Alert config (limits, thresholds) |
| `(hub)/analytics/market-prices` | Market price index dashboard |
| `(hub)/mod/reviews` | Review moderation queue |

---

## 19. Out of Scope

- Social features (collaborative filtering, "users like you bought")
- Purchase prediction / dynamic pricing based on history
- Cross-device tracking
- Price comparison with external sites (handled by crosslister intelligence, not buyer-facing)
- Auction price tracking
- Loyalty programs / buyer subscriptions
- AI-generated review summaries (deferred to Canonical 30 AI module)

---

## 20. Differentiators

| Feature | eBay | Poshmark | Twicely V4 |
|---------|------|----------|------------|
| Price alerts | Watchlist only | No | Target price, % drop, any drop, system-suggested |
| Price history graph | No (3rd party tools) | No | Native per-listing chart |
| Market price index | No | No | Category/condition/brand aggregation |
| Deal badges | No | No | GREAT_PRICE, PRICE_DROP, FAST_SELLER, LAST_ONE |
| Named collections | No (lists are flat) | No | Named, public/private, exportable |
| Category alerts with filters | Saved searches (basic) | No | Category + brand + condition + price filters |
| Digest emails | No | Basic | Timezone-aware, customizable time, daily/weekly |
| Photo reviews | Yes | No | Yes, with auto-moderation |
| Size preference memory | No | Basic | Per-category persistent filter |
| Review auto-moderation | Report-based | No | Proactive auto-flag + staff queue |
| Order tracking timeline | Basic | Basic | Visual timeline with carrier events |
| Quick Buy | No | "Buy Now" | Saved payment + address one-tap |
