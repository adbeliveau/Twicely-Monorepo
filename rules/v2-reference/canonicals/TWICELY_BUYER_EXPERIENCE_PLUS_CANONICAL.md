# TWICELY_BUYER_EXPERIENCE_PLUS_CANONICAL.md
**Status:** LOCKED (v2.0)  
**Scope:** Price alerts, price history, market pricing, deal badges, category alerts, digests, browsing history, personalized recommendations, size preferences.  
**Audience:** Product, engineering, data/ML, and AI agents.  
**Extends:** `TWICELY_BUYER_EXPERIENCE_CANONICAL.md`

---

## 1. Purpose

This canonical defines **advanced buyer engagement, pricing intelligence, and personalization features** for Twicely.

It ensures:
- buyers can set sophisticated price alerts with multiple trigger types
- price history is tracked and visualized for informed purchasing
- market-based deal detection highlights true bargains
- category-level alerts notify buyers of matching listings
- email digests consolidate alerts without notification fatigue
- browsing behavior informs recommendations
- recommendations are personalized and explainable
- size preferences are remembered across sessions

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Alerts are buyer-controlled**  
   Users set their own thresholds; no dark patterns.

2. **History enables, never betrays**  
   Browsing and price data improve experience; never sold or exposed.

3. **Recommendations are explainable**  
   Every recommendation has a reason buyers can understand.

4. **Deal badges are honest**  
   Only true market bargains get highlighted; no fake urgency.

5. **Digests respect attention**  
   Consolidate notifications; never spam.

6. **Privacy is paramount**  
   Buyers can clear history and opt out of tracking.

---

## 3. Price Alerts

### 3.1 Price Alert Model

```ts
type PriceAlert = {
  id: string;
  userId: string;
  listingId: string;
  
  // Thresholds
  targetPriceCents: number;
  originalPriceCents: number;     // Price when alert was set
  
  // Alert type
  alertType: PriceAlertType;
  percentThreshold?: number;      // For PERCENT_DROP: e.g., 10 = 10%
  
  // Status
  isActive: boolean;
  
  // Trigger tracking
  triggeredAt?: Date;
  triggeredPriceCents?: number;
  notificationSent: boolean;
  notificationSentAt?: Date;
  
  // Digest grouping
  includeInDigest: boolean;       // NEW: Include in daily/weekly digest
  digestFrequency?: DigestFrequency;
  
  // Auto-expire
  expiresAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
};

type PriceAlertType = 
  | "BELOW_PRICE"       // Alert when price ≤ target
  | "PERCENT_DROP"      // Alert when price drops X% from original
  | "BELOW_MARKET"      // NEW: Alert when price < market index
  | "ANY_DROP";         // NEW: Alert on any price reduction
```

### 3.2 Price Alert Rules

1. **Target must be below current price** (for BELOW_PRICE type)
2. **One alert per user per listing**
3. **Alerts are one-shot** (deactivate after trigger)
4. **Optional expiration** (default 90 days)
5. **Seller cannot see alerts**
6. **Max 100 active alerts per user**

### 3.3 Alert Triggering

```ts
async function checkPriceAlerts(
  listingId: string,
  newPriceCents: number,
  marketIndex?: MarketPriceIndex
): Promise<AlertTriggerResult[]> {
  const alerts = await findActiveAlerts(listingId);
  const triggered: AlertTriggerResult[] = [];
  
  for (const alert of alerts) {
    let shouldTrigger = false;
    
    switch (alert.alertType) {
      case "BELOW_PRICE":
        shouldTrigger = newPriceCents <= alert.targetPriceCents;
        break;
        
      case "PERCENT_DROP":
        const dropPercent = ((alert.originalPriceCents - newPriceCents) / alert.originalPriceCents) * 100;
        shouldTrigger = dropPercent >= (alert.percentThreshold ?? 10);
        break;
        
      case "BELOW_MARKET":
        if (marketIndex) {
          shouldTrigger = newPriceCents < marketIndex.medianPriceCents;
        }
        break;
        
      case "ANY_DROP":
        shouldTrigger = newPriceCents < alert.originalPriceCents;
        break;
    }
    
    if (shouldTrigger) {
      await markAlertTriggered(alert.id, newPriceCents);
      triggered.push({
        alertId: alert.id,
        userId: alert.userId,
        listingId,
        currentPriceCents: newPriceCents,
        alertType: alert.alertType,
      });
    }
  }
  
  return triggered;
}
```

---

## 4. Price History (NEW)

### 4.1 Price History Model

```ts
type ListingPriceHistory = {
  id: string;
  listingId: string;
  
  priceCents: number;
  previousPriceCents?: number;
  
  changeType: PriceChangeType;
  changePercent?: number;
  
  recordedAt: Date;
  
  // Context
  source: "SELLER_UPDATE" | "PROMOTION" | "SYSTEM";
  promotionId?: string;
};

type PriceChangeType = 
  | "INITIAL"       // First price set
  | "INCREASE"      // Price went up
  | "DECREASE"      // Price went down
  | "RESTORED";     // Back to original after promo

// Aggregated view for UI
type PriceHistorySummary = {
  listingId: string;
  
  currentPriceCents: number;
  originalPriceCents: number;       // First recorded price
  lowestPriceCents: number;
  highestPriceCents: number;
  averagePriceCents: number;
  
  priceDropCount: number;
  priceIncreaseCount: number;
  
  lastChangeAt: Date;
  lastChangeType: PriceChangeType;
  lastChangePercent?: number;
  
  // Graph data points
  history: Array<{ date: Date; priceCents: number }>;
  
  // Is current price the lowest ever?
  isLowestEver: boolean;
  
  // Days since last price change
  daysSinceLastChange: number;
};
```

### 4.2 Price History Recording

```ts
async function recordPriceChange(args: {
  listingId: string;
  newPriceCents: number;
  source: string;
  promotionId?: string;
}): Promise<void> {
  const lastRecord = await getLastPriceRecord(args.listingId);
  const previousPrice = lastRecord?.priceCents;
  
  let changeType: PriceChangeType = "INITIAL";
  let changePercent: number | undefined;
  
  if (previousPrice !== undefined) {
    if (args.newPriceCents < previousPrice) {
      changeType = "DECREASE";
      changePercent = ((previousPrice - args.newPriceCents) / previousPrice) * 100;
    } else if (args.newPriceCents > previousPrice) {
      changeType = "INCREASE";
      changePercent = ((args.newPriceCents - previousPrice) / previousPrice) * 100;
    } else {
      return; // No change, don't record
    }
  }
  
  await createPriceHistoryRecord({
    listingId: args.listingId,
    priceCents: args.newPriceCents,
    previousPriceCents: previousPrice,
    changeType,
    changePercent,
    source: args.source,
    promotionId: args.promotionId,
    recordedAt: new Date(),
  });
  
  // Update summary cache
  await updatePriceHistorySummary(args.listingId);
  
  // Check price alerts
  await checkPriceAlerts(args.listingId, args.newPriceCents);
}
```

### 4.3 Price History Retention

| Data Type | Retention |
|-----------|-----------|
| Individual price changes | 365 days |
| Summary (min/max/avg) | Lifetime |
| Graph data points | 90 days (then daily aggregates) |

### 4.4 Price History API

```ts
// Get price history for listing
GET /api/listings/:id/price-history
Response: PriceHistorySummary

// Get graph data
GET /api/listings/:id/price-history/graph?days=30
Response: Array<{ date: string; priceCents: number }>
```

---

## 5. Market Price Index (NEW)

### 5.1 Market Price Index Model

```ts
type MarketPriceIndex = {
  id: string;
  
  // Scope (one of these is set)
  categoryId?: string;
  productId?: string;        // For catalog products
  attributeHash?: string;    // For brand + condition + category combo
  
  // Statistics
  medianPriceCents: number;
  averagePriceCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  
  // Percentiles for deal detection
  p10PriceCents: number;     // 10th percentile = great deal
  p25PriceCents: number;     // 25th percentile = good deal
  p75PriceCents: number;     // 75th percentile
  p90PriceCents: number;     // 90th percentile
  
  // Sample info
  sampleSize: number;
  computedAt: Date;
  validUntil: Date;
  
  // Confidence
  confidence: "HIGH" | "MEDIUM" | "LOW";  // Based on sample size
};

// Deal thresholds derived from index
type DealThresholds = {
  greatDealCents: number;    // Price ≤ p10 = "Great Deal"
  goodDealCents: number;     // Price ≤ p25 = "Good Deal"
  fairPriceCents: number;    // Price ≤ median = "Fair Price"
};
```

### 5.2 Market Index Computation

```ts
async function computeMarketIndex(scope: MarketIndexScope): Promise<MarketPriceIndex> {
  // Get sold listings in last 90 days for this scope
  const soldListings = await getSoldListings({
    ...scope,
    soldAfter: daysAgo(90),
    limit: 1000,
  });
  
  if (soldListings.length < 10) {
    return { confidence: "LOW", ... };
  }
  
  const prices = soldListings.map(l => l.soldPriceCents).sort((a, b) => a - b);
  
  return {
    ...scope,
    medianPriceCents: percentile(prices, 50),
    averagePriceCents: average(prices),
    minPriceCents: prices[0],
    maxPriceCents: prices[prices.length - 1],
    p10PriceCents: percentile(prices, 10),
    p25PriceCents: percentile(prices, 25),
    p75PriceCents: percentile(prices, 75),
    p90PriceCents: percentile(prices, 90),
    sampleSize: prices.length,
    confidence: prices.length >= 50 ? "HIGH" : prices.length >= 20 ? "MEDIUM" : "LOW",
    computedAt: new Date(),
    validUntil: addDays(new Date(), 7),
  };
}
```

### 5.3 Index Refresh Schedule

| Scope Type | Refresh Frequency |
|------------|-------------------|
| Category (top 100) | Daily |
| Category (others) | Weekly |
| Product (high volume) | Daily |
| Product (low volume) | Weekly |
| Attribute hash | On-demand with 7-day cache |

---

## 6. Deal Badges (NEW)

### 6.1 Deal Badge Model

```ts
type DealBadge = {
  type: DealBadgeType;
  label: string;
  description: string;
  savingsPercent?: number;
  savingsCents?: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

type DealBadgeType =
  | "GREAT_DEAL"      // Price ≤ p10 of market
  | "GOOD_DEAL"       // Price ≤ p25 of market
  | "PRICE_DROP"      // Recent price reduction
  | "LOWEST_PRICE"    // Lowest price ever for this listing
  | "BELOW_MARKET"    // Below median market price
  | "NEW_LISTING";    // Listed in last 24h (no price history)
```

### 6.2 Deal Badge Computation

```ts
async function computeDealBadge(listing: Listing): Promise<DealBadge | null> {
  const priceHistory = await getPriceHistorySummary(listing.id);
  const marketIndex = await getMarketIndex(listing);
  
  // Priority order (first match wins)
  
  // 1. Lowest price ever
  if (priceHistory?.isLowestEver && priceHistory.priceDropCount > 0) {
    return {
      type: "LOWEST_PRICE",
      label: "Lowest Price",
      description: "This is the lowest price this item has ever been",
      savingsPercent: percentDiff(priceHistory.highestPriceCents, listing.priceCents),
      confidence: "HIGH",
    };
  }
  
  // 2. Great deal (p10)
  if (marketIndex?.confidence !== "LOW" && listing.priceCents <= marketIndex.p10PriceCents) {
    return {
      type: "GREAT_DEAL",
      label: "Great Deal",
      description: "Priced in the bottom 10% of similar items",
      savingsPercent: percentDiff(marketIndex.medianPriceCents, listing.priceCents),
      savingsCents: marketIndex.medianPriceCents - listing.priceCents,
      confidence: marketIndex.confidence,
    };
  }
  
  // 3. Good deal (p25)
  if (marketIndex?.confidence !== "LOW" && listing.priceCents <= marketIndex.p25PriceCents) {
    return {
      type: "GOOD_DEAL",
      label: "Good Deal",
      description: "Priced below 75% of similar items",
      savingsPercent: percentDiff(marketIndex.medianPriceCents, listing.priceCents),
      confidence: marketIndex.confidence,
    };
  }
  
  // 4. Recent price drop
  if (priceHistory?.lastChangeType === "DECREASE" && priceHistory.daysSinceLastChange <= 7) {
    return {
      type: "PRICE_DROP",
      label: `${Math.round(priceHistory.lastChangePercent!)}% Off`,
      description: `Price dropped ${priceHistory.daysSinceLastChange} day(s) ago`,
      savingsPercent: priceHistory.lastChangePercent,
      confidence: "HIGH",
    };
  }
  
  // 5. Below market
  if (marketIndex && listing.priceCents < marketIndex.medianPriceCents) {
    return {
      type: "BELOW_MARKET",
      label: "Below Average",
      description: "Priced below the market average",
      confidence: marketIndex.confidence,
    };
  }
  
  return null;
}
```

### 6.3 Badge Display Rules

1. **One badge per listing** (highest priority wins)
2. **LOW confidence badges hidden by default** (user can enable)
3. **Badges refresh on price change**
4. **Badges visible on search results and listing page**
5. **No badge for seller's own listings** (prevent gaming)

---

## 7. Category Alerts (NEW)

### 7.1 Category Alert Model

```ts
type CategoryAlert = {
  id: string;
  userId: string;
  
  // Scope
  categoryId: string;
  
  // Filters (optional)
  brandFilter?: string[];
  conditionFilter?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  keywords?: string[];
  
  // Notification settings
  isActive: boolean;
  notifyImmediate: boolean;      // Push on match
  includeInDigest: boolean;      // Include in digest
  digestFrequency: DigestFrequency;
  
  // Tracking
  lastMatchAt?: Date;
  matchCount: number;
  
  createdAt: Date;
  updatedAt: Date;
};
```

### 7.2 Category Alert Rules

1. **Max 20 category alerts per user**
2. **Alerts match new listings only** (not price changes)
3. **Immediate notifications limited to 10/day per alert**
4. **Excess matches rolled into digest**
5. **Duplicate suppression** (same listing once per alert)

### 7.3 Category Alert Matching

```ts
async function checkCategoryAlerts(newListing: Listing): Promise<void> {
  const alerts = await findActiveAlertsForCategory(newListing.categoryId);
  
  for (const alert of alerts) {
    // Check filters
    if (!matchesFilters(newListing, alert)) continue;
    
    // Record match
    await recordAlertMatch(alert.id, newListing.id);
    
    // Send notification (if immediate enabled and under daily limit)
    if (alert.notifyImmediate && await canSendImmediateNotification(alert.id)) {
      await sendCategoryAlertNotification(alert.userId, newListing);
    }
  }
}

function matchesFilters(listing: Listing, alert: CategoryAlert): boolean {
  if (alert.brandFilter?.length && !alert.brandFilter.includes(listing.brand)) {
    return false;
  }
  if (alert.conditionFilter?.length && !alert.conditionFilter.includes(listing.condition)) {
    return false;
  }
  if (alert.minPriceCents && listing.priceCents < alert.minPriceCents) {
    return false;
  }
  if (alert.maxPriceCents && listing.priceCents > alert.maxPriceCents) {
    return false;
  }
  if (alert.keywords?.length) {
    const titleLower = listing.title.toLowerCase();
    if (!alert.keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
      return false;
    }
  }
  return true;
}
```

---

## 8. Alert Digests (NEW)

### 8.1 Digest Model

```ts
type DigestFrequency = "DAILY" | "WEEKLY" | "INSTANT";

type AlertDigest = {
  id: string;
  userId: string;
  frequency: DigestFrequency;
  
  // Content
  priceAlerts: DigestPriceAlert[];
  categoryMatches: DigestCategoryMatch[];
  watchlistUpdates: DigestWatchlistUpdate[];
  
  // Delivery
  scheduledFor: Date;
  sentAt?: Date;
  emailId?: string;
  
  createdAt: Date;
};

type DigestPriceAlert = {
  alertId: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  oldPriceCents: number;
  newPriceCents: number;
  triggeredAt: Date;
};

type DigestCategoryMatch = {
  alertId: string;
  categoryName: string;
  matchCount: number;
  topMatches: Array<{
    listingId: string;
    title: string;
    image: string;
    priceCents: number;
  }>;
};

type DigestWatchlistUpdate = {
  listingId: string;
  updateType: "PRICE_DROP" | "SOLD" | "ENDING_SOON";
  details: string;
};
```

### 8.2 Digest Generation

```ts
async function generateDigest(userId: string, frequency: DigestFrequency): Promise<AlertDigest | null> {
  const since = frequency === "DAILY" ? daysAgo(1) : daysAgo(7);
  
  // Gather triggered price alerts
  const priceAlerts = await getTriggeredPriceAlerts(userId, since);
  
  // Gather category matches
  const categoryMatches = await getCategoryAlertMatches(userId, since);
  
  // Gather watchlist updates
  const watchlistUpdates = await getWatchlistUpdates(userId, since);
  
  // Skip if empty
  if (priceAlerts.length === 0 && categoryMatches.length === 0 && watchlistUpdates.length === 0) {
    return null;
  }
  
  return createDigest({
    userId,
    frequency,
    priceAlerts,
    categoryMatches,
    watchlistUpdates,
    scheduledFor: new Date(),
  });
}
```

### 8.3 Digest Scheduling

| Frequency | Schedule |
|-----------|----------|
| DAILY | 8:00 AM user's timezone |
| WEEKLY | Sunday 8:00 AM user's timezone |
| INSTANT | Immediately (for urgent alerts) |

### 8.4 Digest Email Content

```
Subject: Your Twicely Deals Digest - [Date]

[User Name], here's what's happening:

📉 PRICE DROPS (3)
- [Item 1] dropped from $45 to $35 (22% off)
- [Item 2] now $29 (lowest ever!)
- [Item 3] dropped 15%

🔔 NEW MATCHES (12)
Electronics > Headphones: 8 new items
Clothing > Vintage: 4 new items

👁️ WATCHLIST UPDATES (2)
- [Item] SOLD
- [Item] price dropped

[View All] [Manage Alerts]
```

---

## 9. Browsing History

### 9.1 Browsing History Model

```ts
type UserBrowsingHistory = {
  id: string;
  userId: string;
  listingId: string;
  categoryId?: string;
  sellerId?: string;
  
  // Engagement metrics
  viewCount: number;
  totalDurationSec: number;
  lastViewDurationSec: number;
  
  // Actions taken
  didAddToCart: boolean;
  didAddToWatchlist: boolean;
  didMakeOffer: boolean;
  didPurchase: boolean;
  didSetPriceAlert: boolean;   // NEW
  
  // Context
  sourceType?: "search" | "category" | "recommendation" | "alert" | "direct";
  searchQuery?: string;
  
  firstViewedAt: Date;
  lastViewedAt: Date;
};
```

### 9.2 Recording Views

```ts
async function recordListingView(args: {
  userId: string;
  listingId: string;
  durationSec?: number;
  sourceType?: string;
  searchQuery?: string;
}): Promise<void> {
  const listing = await getListing(args.listingId);
  
  await upsertBrowsingHistory({
    userId: args.userId,
    listingId: args.listingId,
    categoryId: listing.categoryId,
    sellerId: listing.sellerId,
    viewCount: { increment: 1 },
    totalDurationSec: { increment: args.durationSec ?? 0 },
    lastViewDurationSec: args.durationSec ?? 0,
    lastViewedAt: new Date(),
    sourceType: args.sourceType,
    searchQuery: args.searchQuery,
  });
}
```

### 9.3 History Limits

| Limit | Value |
|-------|-------|
| Max entries per user | 500 |
| Retention period | 90 days |
| Oldest entries | Auto-pruned (FIFO) |

### 9.4 Privacy Controls

```ts
async function clearBrowsingHistory(userId: string): Promise<void>;
async function disableBrowsingTracking(userId: string): Promise<void>;
async function exportBrowsingHistory(userId: string): Promise<ExportData>;
```

---

## 10. Personalized Recommendations

### 10.1 Inferred Preferences Model

```ts
type UserPreferenceInferred = {
  userId: string;
  
  // Category preferences
  categoryScores: Array<{ categoryId: string; score: number }>;
  
  // Brand preferences
  brandScores: Array<{ brand: string; score: number }>;
  
  // Size preferences
  sizePreferences: Record<string, string>;
  
  // Price preferences
  avgViewedPriceCents?: number;
  preferredPriceRangeLow?: number;
  preferredPriceRangeHigh?: number;
  
  // Deal sensitivity (NEW)
  dealSensitivity: "HIGH" | "MEDIUM" | "LOW";  // Based on alert/badge interaction
  
  // Condition preferences
  conditionScores: Array<{ condition: string; score: number }>;
  
  lastComputedAt: Date;
  computeVersion: number;
};
```

### 10.2 Recommendation Feed

```ts
type RecommendationReason = 
  | "viewed_similar"
  | "same_category"
  | "same_seller"
  | "same_brand"
  | "price_range"
  | "trending"
  | "new_arrival"
  | "size_match"
  | "great_deal"         // NEW: High deal sensitivity user
  | "price_dropped"      // NEW: Items from watchlist/viewed with price drop
  | "back_in_stock";     // NEW: Previously unavailable
```

### 10.3 Deal-Aware Recommendations

```ts
async function generateRecommendations(userId: string): Promise<RecommendationItem[]> {
  const preferences = await getInferredPreferences(userId);
  
  // For deal-sensitive users, boost items with deal badges
  if (preferences.dealSensitivity === "HIGH") {
    const deals = await getListingsWithDealBadges({
      categoryIds: preferences.topCategories,
      limit: 20,
    });
    
    // Merge deals with regular recommendations
    return mergeWithDealsFirst(regularRecs, deals);
  }
  
  return regularRecs;
}
```

---

## 11. Size Preferences

### 11.1 Size Preference Storage

```ts
type SizePreferences = {
  [categoryType: string]: string;
};

// Examples:
{
  "tops": "M",
  "bottoms": "32",
  "shoes": "10",
  "dresses": "8",
}
```

### 11.2 Size Preference Learning

```ts
async function learnSizePreference(args: {
  userId: string;
  categoryType: string;
  selectedSize: string;
  action: "purchase" | "cart" | "manual";
}): Promise<void>;
```

---

## 12. Platform Settings

| Setting | Default | Description |
|---------|---------|-------------|
| PRICE_ALERT_MAX_PER_USER | 100 | Max active price alerts |
| PRICE_ALERT_DEFAULT_EXPIRY_DAYS | 90 | Default alert expiration |
| CATEGORY_ALERT_MAX_PER_USER | 20 | Max category alerts |
| CATEGORY_ALERT_IMMEDIATE_LIMIT | 10 | Max immediate notifications/day/alert |
| PRICE_HISTORY_RETENTION_DAYS | 365 | Individual price change retention |
| PRICE_HISTORY_GRAPH_DAYS | 90 | Full resolution graph data |
| MARKET_INDEX_MIN_SAMPLE | 10 | Minimum sales for index |
| MARKET_INDEX_HIGH_CONFIDENCE | 50 | Sales count for HIGH confidence |
| DEAL_BADGE_ENABLED | true | Show deal badges |
| DEAL_BADGE_LOW_CONFIDENCE_VISIBLE | false | Show LOW confidence badges |
| DIGEST_ENABLED | true | Enable digest emails |
| BROWSING_HISTORY_MAX_ENTRIES | 500 | Max history per user |
| BROWSING_HISTORY_RETENTION_DAYS | 90 | History retention |

---

## 13. RBAC & Permissions

| Action | Required Permission |
|--------|---------------------|
| Create/manage price alerts | buyer (self) |
| Create/manage category alerts | buyer (self) |
| View price history | public |
| View deal badges | public |
| View own browsing history | buyer (self) |
| Clear own browsing history | buyer (self) |
| Get recommendations | buyer (self) |
| Set size preference | buyer (self) |
| Configure digest frequency | buyer (self) |
| View market index data | public |
| Force recompute market index | analytics.admin (corp) |
| View alert analytics | analytics.view (corp) |

---

## 14. Health Checks

| Check | Pass Condition |
|-------|----------------|
| No stale triggered alerts | All triggered alerts processed within 1 hour |
| Market index freshness | Top 100 categories computed in last 24h |
| Digest delivery | All scheduled digests sent within 2 hours |
| Price history recording | No listings with >1h price change lag |
| Recommendation freshness | Feeds generated in last 24 hours |

---

## 15. Audit Requirements

**Must emit audit events:**
- Price alert created/triggered/deleted
- Category alert created/updated/deleted
- Digest sent
- Browsing history cleared
- Market index recomputed (manual)
- Size preference set (manual only)

**Not audited (high volume):**
- Individual page views
- Price history records
- Deal badge computations
- Recommendation impressions

---

## 16. Integration Points

| System | Integration |
|--------|-------------|
| Listing Service | Price change triggers history record + alert check |
| Search Service | Include deal badges in search results |
| Notification Service | Send price/category alerts and digests |
| Checkout Service | Learn size from purchase |
| Analytics Service | Track deal badge performance |
| Email Service | Digest delivery |

---

## 17. Privacy & Compliance

### 17.1 Data Collection Notice

- Browsing tracked only for logged-in users
- Price history is public (no PII)
- Clear notice in privacy policy
- Opt-out available in settings

### 17.2 Data Retention

| Data Type | Retention |
|-----------|-----------|
| Browsing history | 90 days |
| Price alerts | Until triggered/expired |
| Category alerts | Until deleted |
| Price history | 365 days (individual), lifetime (summary) |
| Market index | 7 days (then recomputed) |
| Digests | 30 days |
| Inferred preferences | Recomputed, not permanent |

### 17.3 Data Export (GDPR)

```ts
async function exportUserData(userId: string): Promise<UserDataExport> {
  return {
    browsingHistory: await exportBrowsingHistory(userId),
    priceAlerts: await exportPriceAlerts(userId),
    categoryAlerts: await exportCategoryAlerts(userId),
    preferences: await exportPreferences(userId),
    digestHistory: await exportDigestHistory(userId),
  };
}
```

---

## 18. Out of Scope

- Social features (following users)
- Collaborative filtering (users like you)
- Purchase prediction
- Dynamic pricing based on history
- Cross-device tracking
- Price comparison with external sites
- Auction price tracking

---

## 19. Final Rule

Buyer experience features must never:
- Manipulate urgency artificially
- Expose browsing data to sellers
- Show fake deal badges
- Use dark patterns for engagement
- Retain data beyond stated periods
- Send unsolicited notifications

**If behavior is not defined here, it must be rejected or added to this canonical.**
