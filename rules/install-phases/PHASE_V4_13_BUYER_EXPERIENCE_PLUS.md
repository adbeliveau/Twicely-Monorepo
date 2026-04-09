# V4 Install Phase 13 — Buyer Experience Plus

**Status:** DRAFT (V4)
**Prereq:** Phase 12 complete, `packages/commerce` operational, `packages/notifications` operational, Typesense search live, existing V3 tables: `priceAlert`, `categoryAlert`, `browsingHistory`, `savedSearch`, `watchlistItem`, `marketCategorySummary`, `interestTag`, `userInterest`
**Canonical:** `rules/canonicals/33_BUYER_EXPERIENCE_PLUS.md`

---

## 0) What this phase installs

### Backend
- `priceHistory` table -- per-listing price change tracking (Drizzle)
- `buyerCollection` + `buyerCollectionItem` tables -- named listing collections
- `recommendationFeed` table -- cached personalized feeds
- `buyerPreference` table -- inferred buyer preference profiles with digest settings
- `reviewModerationQueue` table -- auto-flagged review moderation queue
- Extensions to existing `priceAlert` table (digest, system suggestion, trigger tracking columns)
- Price alert service (enhanced with system suggestions and digest option)
- Price history service (recording + daily snapshots + stats)
- Market index computation service (extends existing marketCategorySummary)
- Recommendation feed service (interest-weighted personalized feeds)
- Collection management service (named collections beyond flat watchlist)
- Alert digest service (timezone-aware batched email digests)
- Review moderation service (auto-flag + staff queue)
- Buyer preference inference service (nightly recomputation from browsing + purchase data)

### Hub UI (Buyer-facing)
- Listing detail: "Set Price Alert" button, price history chart, deal badge, "Add to Collection"
- `/account/alerts` -- Price alert management
- `/account/alerts/categories` -- Category alert management
- `/account/recently-viewed` -- Browsing history
- `/account/collections` -- Collection management
- `/account/collections/[id]` -- Collection detail
- `/account/orders` -- Order tracking with visual timeline
- `/account/settings/notifications` -- Digest preferences
- Homepage "For You" section -- Personalized recommendations

### Hub UI (Admin)
- `(hub)/cfg/buyer-alerts` -- Alert limits and threshold configuration
- `(hub)/analytics/market-prices` -- Market price index dashboard
- `(hub)/mod/reviews` -- Review moderation queue

### Ops
- 7 BullMQ cron jobs (price snapshots, market index, digests daily/weekly, alert expiry, preference recompute, history cleanup)
- Seed data: platform_settings for all buyer.* keys

---

## 1) Schema (Drizzle)

### Files

| File | Action |
|---|---|
| `packages/db/src/schema/buyer-experience.ts` | CREATE -- priceHistory, buyerCollection, buyerCollectionItem, recommendationFeed, buyerPreference, reviewModerationQueue |
| `packages/db/src/schema/alerts.ts` | MODIFY -- extend priceAlert with V4 columns |
| `packages/db/src/schema/index.ts` | MODIFY -- add new exports |

### New Tables (see Canonical 33 sections 3.7-3.11 for full definitions)

**`priceHistory`**: id, listingId (FK), priceCents, previousCents, changeType, changeBps, source, snapshotDate, createdAt. Indexes: `ph_listing_date`, `ph_snapshot`.

**`buyerCollection`**: id, userId (FK), name, description, isPublic, coverImageUrl, sortOrder, createdAt, updatedAt. Index: `bc_user`.

**`buyerCollectionItem`**: id, collectionId (FK), listingId (FK), note, addedAt. Index: `bci_collection`. Unique: `(collectionId, listingId)`.

**`recommendationFeed`**: id, userId (FK), feedType, itemsJson, computedAt, expiresAt, createdAt. Unique: `(userId, feedType)`. Index: `rf_expires`.

**`buyerPreference`**: id, userId (FK, unique), categoryScoresJson, brandScoresJson, sizePreferencesJson, avgViewedPriceCents, preferredPriceRangeLowCents, preferredPriceRangeHighCents, preferredConditions, digestFrequency, digestTime, digestTimezone, lastDigestSentAt, lastComputedAt, createdAt, updatedAt. Index: `bp_user`.

**`reviewModerationQueue`**: id, reviewId (FK), flagReason, flagScore, autoFlagged, status, reviewedByStaffId, reviewedAt, reviewNote, createdAt. Indexes: `rmq_status`, `rmq_review`.

### Extend `priceAlert` -- add columns

```
includeInDigest (boolean DEFAULT false), digestSentAt (timestamp),
suggestedBySystem (boolean DEFAULT false), originalPriceCents (integer),
triggeredPriceCents (integer), triggeredAt (timestamp), notificationSentAt (timestamp)
```

Add index: `pa_digest (includeInDigest, isActive)`.

### Migration

```bash
npx drizzle-kit generate --name buyer_experience_plus
npx drizzle-kit migrate
npx turbo typecheck --filter=@twicely/db
```

---

## 2) Server actions + queries

### Files

| File | Action |
|---|---|
| `packages/commerce/src/price-alert-service.ts` | CREATE |
| `packages/commerce/src/price-history-service.ts` | CREATE |
| `packages/commerce/src/market-index-service.ts` | CREATE |
| `packages/commerce/src/recommendation-service.ts` | CREATE |
| `packages/commerce/src/collection-service.ts` | CREATE |
| `packages/commerce/src/review-moderation-service.ts` | CREATE |
| `packages/commerce/src/buyer-preference-service.ts` | CREATE |
| `packages/notifications/src/alert-digest-service.ts` | CREATE |
| `apps/web/src/lib/queries/buyer-experience.ts` | CREATE |
| `apps/web/src/lib/actions/buyer-experience.ts` | CREATE |

### Key Functions

**price-alert-service.ts:**
- `createPriceAlert(userId, listingId, alertType, options)` -- validate, enforce max, upsert
- `getSuggestedAlertTarget(listingId)` -- compare to market median, suggest if above threshold
- `checkPriceAlertsForListing(listingId, newPriceCents)` -- trigger matching alerts
- `expireStaleAlerts()` -- cron: deactivate expired
- `getUserPriceAlerts(userId)` -- active alerts with listing data

**price-history-service.ts:**
- `recordPriceChange(listingId, newPriceCents, source)` -- record if change > minChangeBps
- `getListingPriceHistory(listingId, days)` -- sorted history for chart
- `getPriceHistoryStats(listingId)` -- initial, current, lowest, highest
- `runDailyPriceSnapshots()` -- BullMQ cron

**market-index-service.ts:**
- `computeMarketIndex(categoryId, conditionBucket?, brand?)` -- aggregate sold listings
- `runMarketIndexComputation()` -- BullMQ cron: all categories

**recommendation-service.ts:**
- `getRecommendations(userId, feedType, limit)` -- cache check + compute
- `computeRecommendationFeed(userId, feedType)` -- interest + recency + deals blend
- `invalidateFeed(userId)` -- called on preference change

**collection-service.ts:**
- `createCollection(userId, name, options)` -- enforce maxPerUser
- `addToCollection(collectionId, listingId, note?)` -- enforce maxItemsPerCollection
- `removeFromCollection(collectionId, listingId)`
- `getUserCollections(userId)` -- with item counts
- `getCollectionItems(collectionId, page)` -- paginated

**review-moderation-service.ts:**
- `autoFlagReview(reviewId)` -- profanity, personal info, competitor check
- `getReviewModerationQueue(status, page)` -- staff queue
- `moderateReview(queueId, decision, staffId, note)` -- approve/reject/escalate

**buyer-preference-service.ts:**
- `recomputePreferences(userId)` -- aggregate browsing + purchase data
- `saveSizePreference(userId, categorySlug, size)` -- explicit preference
- `updateDigestPreferences(userId, frequency, time, timezone)` -- user settings

**alert-digest-service.ts:**
- `generateUserDigest(userId)` -- collect triggered alerts since last digest
- `sendDailyDigests()` -- BullMQ cron: find matching users by timezone
- `sendWeeklyDigests()` -- weekly frequency

### Integration Points

1. **Listing price update** -> call `recordPriceChange()` + `checkPriceAlertsForListing()`
2. **New listing activated** -> V3 `notifyCategoryAlertMatches()` already wired
3. **Review creation** -> call `autoFlagReview()`, flag sets review to PENDING
4. **Browsing history engagement** -> V3 `updateEngagement()` already wired
5. **Purchase** -> V3 `recordPurchaseSignal()` already wired

---

## 3) UI pages

### Files

| File | Action |
|---|---|
| `apps/web/src/app/(hub)/account/alerts/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/account/alerts/categories/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/account/recently-viewed/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/account/collections/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/account/collections/[id]/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/buyer-alerts/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/analytics/market-prices/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/mod/reviews/page.tsx` | CREATE |
| `apps/web/src/components/listing/PriceAlertButton.tsx` | CREATE |
| `apps/web/src/components/listing/PriceHistoryChart.tsx` | CREATE |
| `apps/web/src/components/listing/AddToCollectionMenu.tsx` | CREATE |
| `apps/web/src/components/home/RecommendationFeed.tsx` | CREATE |
| `apps/web/src/components/order/OrderTimeline.tsx` | CREATE |

---

## 4) Tests

### Files

| File | Action |
|---|---|
| `packages/commerce/src/__tests__/price-alert-service.test.ts` | CREATE |
| `packages/commerce/src/__tests__/price-history-service.test.ts` | CREATE |
| `packages/commerce/src/__tests__/market-index-service.test.ts` | CREATE |
| `packages/commerce/src/__tests__/recommendation-service.test.ts` | CREATE |
| `packages/commerce/src/__tests__/collection-service.test.ts` | CREATE |
| `packages/commerce/src/__tests__/review-moderation-service.test.ts` | CREATE |
| `packages/commerce/src/__tests__/buyer-preference-service.test.ts` | CREATE |
| `packages/notifications/src/__tests__/alert-digest-service.test.ts` | CREATE |

### Test Matrix

| Category | Count |
|----------|-------|
| Price alert: create, upsert, validate target | 4 |
| Price alert: max per user enforced | 2 |
| Price alert: trigger BELOW_TARGET, PERCENT_DROP, ANY_DROP | 3 |
| Price alert: system-suggested target | 2 |
| Price alert: digest inclusion, expiry | 3 |
| Price history: record, skip below threshold | 3 |
| Price history: daily snapshot, stats computation | 4 |
| Market index: compute percentiles, confidence levels | 3 |
| Market index: min sample enforcement, batch processing | 3 |
| Recommendation: cache hit/miss, TTL, exclude viewed | 4 |
| Recommendation: score by interest weight | 2 |
| Collection: create, add, remove, limits | 4 |
| Collection: unique constraint, public/private | 3 |
| Review moderation: flag profanity, personal info, clean pass | 3 |
| Review moderation: staff approve/reject/escalate | 3 |
| Buyer preference: recompute, size prefs, digest settings | 4 |
| Alert digest: daily generate, timezone-aware, skip empty | 4 |
| Alert digest: weekly generate | 1 |
| **Total** | **55** |

---

## 5) Doctor checks

| Check | Pass Condition |
|-------|----------------|
| `buyer_exp.price_history` | priceHistory table accessible |
| `buyer_exp.collections` | buyerCollection + buyerCollectionItem tables accessible |
| `buyer_exp.recommendation_feed` | recommendationFeed table accessible |
| `buyer_exp.buyer_preference` | buyerPreference table accessible |
| `buyer_exp.review_moderation` | reviewModerationQueue table accessible |
| `buyer_exp.price_alert_trigger` | Create alert -> simulate price drop -> verify triggered |
| `buyer_exp.market_index_fresh` | At least 1 marketCategorySummary computed in last 48h |
| `buyer_exp.platform_settings` | All buyer.* settings readable with defaults |
| `buyer_exp.cron_jobs_registered` | All 7 cron jobs registered in BullMQ |

---

## Completion Criteria

- [ ] 6 new tables created and migrated
- [ ] `priceAlert` extended with V4 columns
- [ ] Price alert service: create, trigger, suggest, expire all working
- [ ] Price history service: record, snapshot, stats all working
- [ ] Market index computation extending existing tables
- [ ] Recommendation feed: compute, cache, invalidate
- [ ] Collection CRUD with limits enforced
- [ ] Review auto-moderation + staff queue
- [ ] Buyer preference inference + digest settings
- [ ] Alert digest service with timezone-aware delivery
- [ ] All 7 BullMQ cron jobs registered
- [ ] Listing update flow wired to price alerts + price history
- [ ] Review creation wired to auto-moderation
- [ ] All buyer.* platform settings seeded (28 keys)
- [ ] CASL permissions added for all new subjects
- [ ] All buyer-facing and admin UI pages render
- [ ] `npx turbo typecheck` passes (0 errors)
- [ ] `npx turbo test` passes (>= BASELINE_TESTS + 55 new)
