# TWICELY V2 — Unified Platform Settings (CANONICAL)

**Version:** 1.0  
**Created:** 2026-01-21  
**Status:** CANONICAL - This document defines the authoritative settings architecture

---

## CANONICAL RULE

> **ALL platform-configurable settings MUST exist in the Unified Platform Settings page at `/corp/settings/platform`.**
>
> No new settings pages may be created outside the tab structure defined here. If a new configurable value is needed, it MUST be added to the appropriate tab in this unified interface.
>
> **If a setting is not in the Platform Settings page, it does not exist as a configurable option.**

---

## RBAC BOUNDARY RULE (AUTHORITATIVE)

- All settings defined in this document are **corp-admin settings**.
- Authorization for `/corp/settings/*` is governed **exclusively by PlatformRole**.
- Seller delegated scopes (defined in `TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md`)
  MUST NEVER authorize access to any setting in this document.
- The corp RBAC system and seller delegated RBAC system are intentionally separate
  and MUST NOT be merged.

---

## Settings Architecture

### Single Source of Truth

| Aspect | Rule |
|--------|------|
| **Location** | ALL settings live at `/corp/settings/platform` |
| **Storage** | `PlatformSettings` model with `category` + `key` |
| **UI** | Single page with 7 tabs |
| **Access** | Requires `PlatformRole.ADMIN` or category-specific role |
| **Audit** | ALL changes logged to `PlatformSettingsAudit` |

### Tab Structure (Fixed - Do Not Add New Tabs)

| Tab # | Key | Label | Contains |
|-------|-----|-------|----------|
| 1 | `monetization` | 💰 Fees & Pricing | Fee schedules, Tier pricing |
| 2 | `commerce` | 🛒 Commerce | Cart, Orders, Offers, Cancellation |
| 3 | `fulfillment` | 📦 Fulfillment | Shipping, Payouts |
| 4 | `trust` | ⭐ Trust & Quality | Reviews, Seller Standards, Disputes |
| 5 | `discovery` | 🔍 Discovery | Search Ranking, Promotions |
| 6 | `communications` | 🔔 Communications | Notifications, Messaging |
| 7 | `privacy` | 🔒 Privacy | Data Retention, GDPR |

### Adding New Settings

When adding a new configurable value:

1. **Identify the correct tab** from the 7 categories above
2. **Add type definition** to `platformSettingsTypes.ts`
3. **Add default value** to `platformSettingsDefaults.ts`
4. **Add UI controls** to the appropriate tab in `page.tsx`
5. **Never create a separate settings page**

---

## Pages Being REMOVED

The following individual settings pages are **REMOVED** and replaced by the unified page:

| Old Page | Old URL | Replacement |
|----------|---------|-------------|
| Fee Schedules | `/corp/settings/monetization/fee-schedules` | Tab 1: Fees & Pricing |
| Fee Configuration | `/corp/settings/monetization` | Tab 1: Fees & Pricing |
| Tier Management | `/corp/settings/tiers` | Tab 1: Fees & Pricing |
| Trust Settings | `/corp/settings/trust` | Tab 4: Trust & Quality |
| Data Retention | `/corp/settings/retention` | Tab 7: Privacy |
| Shipping Settings | `/corp/settings/shipping` | Tab 3: Fulfillment |
| Search Settings | `/corp/settings/search` | Tab 5: Discovery |
| Payout Settings | `/corp/settings/payouts` | Tab 3: Fulfillment |

### Pages Being KEPT (Specialized Functionality)

These pages have functionality beyond simple settings and are **KEPT**:

| Page | URL | Reason |
|------|-----|--------|
| Feature Flags | `/corp/settings/flags` | Has rollout %, user targeting, A/B testing |
| Notification Templates | `/corp/settings/notifications/templates` | Email/SMS template editor |
| Category Management | `/corp/settings/categories` | Category tree CRUD, not just config |
| Policy Library | `/corp/trust/policy` | Policy document editor |

---

## URL Redirects

All old settings URLs redirect to the unified page with the appropriate tab:

```typescript
// apps/web/middleware.ts (add to existing)

const SETTINGS_REDIRECTS: Record<string, string> = {
  // Monetization → Tab 1
  "/corp/settings/monetization": "/corp/settings/platform?tab=monetization",
  "/corp/settings/monetization/fee-schedules": "/corp/settings/platform?tab=monetization",
  "/corp/settings/tiers": "/corp/settings/platform?tab=monetization",
  
  // Commerce → Tab 2
  "/corp/settings/orders": "/corp/settings/platform?tab=commerce",
  "/corp/settings/cart": "/corp/settings/platform?tab=commerce",
  "/corp/settings/offers": "/corp/settings/platform?tab=commerce",
  
  // Fulfillment → Tab 3
  "/corp/settings/shipping": "/corp/settings/platform?tab=fulfillment",
  "/corp/settings/payouts": "/corp/settings/platform?tab=fulfillment",
  
  // Trust → Tab 4
  "/corp/settings/trust": "/corp/settings/platform?tab=trust",
  "/corp/settings/reviews": "/corp/settings/platform?tab=trust",
  "/corp/settings/seller-standards": "/corp/settings/platform?tab=trust",
  "/corp/settings/disputes": "/corp/settings/platform?tab=trust",
  
  // Discovery → Tab 5
  "/corp/settings/search": "/corp/settings/platform?tab=discovery",
  "/corp/settings/promotions": "/corp/settings/platform?tab=discovery",
  
  // Communications → Tab 6
  "/corp/settings/notifications": "/corp/settings/platform?tab=communications",
  
  // Privacy → Tab 7
  "/corp/settings/retention": "/corp/settings/platform?tab=privacy",
  "/corp/settings/privacy": "/corp/settings/platform?tab=privacy",
};

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Handle settings redirects
  if (SETTINGS_REDIRECTS[path]) {
    return NextResponse.redirect(new URL(SETTINGS_REDIRECTS[path], request.url));
  }
  
  // ... rest of middleware
}
```

---

## Files to DELETE

Remove these files/folders after migration:

```
apps/web/app/(platform)/corp/settings/
├── monetization/               # DELETE entire folder
│   ├── page.tsx
│   └── fee-schedules/
│       └── page.tsx
├── tiers/                      # DELETE entire folder
│   └── page.tsx
├── trust/                      # DELETE (keep /corp/trust/policy)
│   └── page.tsx
├── retention/                  # DELETE entire folder
│   └── page.tsx
├── shipping/                   # DELETE entire folder  
│   └── page.tsx
├── search/                     # DELETE entire folder
│   └── page.tsx
├── payouts/                    # DELETE entire folder
│   └── page.tsx
```

**KEEP these:**
```
apps/web/app/(platform)/corp/settings/
├── flags/                      # KEEP - Feature flag management
│   └── page.tsx
├── notifications/              # KEEP - Template editor
│   └── templates/
│       └── page.tsx
├── categories/                 # KEEP - Category tree management
│   └── page.tsx
└── platform/                   # NEW - Unified settings page
    └── page.tsx
```

---

## Updated Navigation

Update `CORP_NAV_ITEMS` in Phase 15:

```typescript
// REMOVE these nav items:
// - "Fee Schedules" 
// - "Tier Management"
// - "Trust Settings"
// - "Data Retention"
// - "Shipping Settings"
// - "Search Settings"
// - "Payout Settings"

// ADD single unified entry:
{
  key: "platform-settings",
  label: "Platform Settings",
  href: "/corp/settings/platform",
  icon: "Settings",
  section: "settings",
  sortOrder: 1,
  requires: "PlatformRole.ADMIN",
  description: "All platform configuration",
  badge: "New",
},

// KEEP these specialized entries:
{
  key: "feature-flags",
  label: "Feature Flags",
  href: "/corp/settings/flags",
  icon: "Flag",
  section: "settings",
  sortOrder: 2,
  requires: "PlatformRole.ADMIN | PlatformRole.DEVELOPER",
},
{
  key: "notification-templates",
  label: "Notification Templates",
  href: "/corp/settings/notifications/templates",
  icon: "Mail",
  section: "settings",
  sortOrder: 3,
  requires: "PlatformRole.ADMIN | PlatformRole.SUPPORT",
},
{
  key: "categories",
  label: "Categories",
  href: "/corp/settings/categories",
  icon: "FolderTree",
  section: "settings",
  sortOrder: 4,
  requires: "PlatformRole.ADMIN | PlatformRole.MODERATION",
},
```

---

## Schema

```prisma
// =============================================================================
// PLATFORM SETTINGS - Single source of truth for all configurable values
// =============================================================================

model PlatformSettings {
  id          String   @id @default(cuid())
  category    String   // monetization | commerce | fulfillment | trust | discovery | communications | privacy
  key         String   // Specific settings key within category (e.g., "fees", "cart", "reviews")
  configJson  Json     // The actual configuration values
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  effectiveAt DateTime @default(now())
  expiresAt   DateTime?
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([category, key])
  @@index([category])
  @@index([isActive, effectiveAt])
}

model PlatformSettingsAudit {
  id              String   @id @default(cuid())
  settingsId      String
  category        String
  key             String
  previousJson    Json?
  newJson         Json
  changedBy       String
  changedAt       DateTime @default(now())
  changeReason    String?
  
  @@index([settingsId])
  @@index([category, key])
  @@index([changedAt])
}
```

---

## Complete Settings Inventory

### Tab 1: 💰 Fees & Pricing (`monetization`)

#### Key: `fees`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `insertionFeeSeller` | cents | 35 | Insertion fee for SELLER tier |
| `insertionFeeStarter` | cents | 30 | Insertion fee for STARTER tier |
| `insertionFeeBasic` | cents | 25 | Insertion fee for BASIC tier |
| `insertionFeePro` | cents | 15 | Insertion fee for PRO tier |
| `insertionFeeElite` | cents | 5 | Insertion fee for ELITE tier |
| `insertionFeeEnterprise` | cents | 5 | Insertion fee for ENTERPRISE tier |
| `perOrderFeeCents` | cents | 40 | Per-order fee (standard) |
| `perOrderFeeCentsSmall` | cents | 30 | Per-order fee (small orders) |
| `smallOrderThresholdCents` | cents | 1000 | Small order threshold ($10) |
| `processingFeeBps` | bps | 290 | Stripe processing fee (display only) |
| `processingFeeFixedCents` | cents | 30 | Stripe fixed fee (display only) |

#### Key: `tiers`
| Setting (per tier) | Type | Description |
|-------------------|------|-------------|
| `monthlyCents` | cents | Monthly subscription price |
| `annualCents` | cents | Annual subscription price |
| `freeListingsMonthly` | int | Free listings per month |
| `finalValueFeeBps` | bps | Final value fee rate |
| `staffAccountsMax` | int | Max staff accounts |
| `storefrontEnabled` | bool | Storefront access |
| `promotedListingsEnabled` | bool | Promoted listings access |
| `analyticsLevel` | enum | Analytics tier |

---

### Tab 2: 🛒 Commerce (`commerce`)

#### Key: `cart`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `reservationDurationMinutes` | int | 15 | Cart item reservation time |
| `cartExpiryHours` | int | 24 | Cart expiration time |
| `maxCartItems` | int | 50 | Maximum items in cart |
| `maxQuantityPerItem` | int | 10 | Max quantity per item |
| `abandonedCartReminderHours` | int | 4 | First reminder timing |
| `abandonedCartSecondReminderHours` | int | 24 | Second reminder timing |

#### Key: `orders`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `autoCompleteDaysAfterDelivery` | int | 3 | Auto-complete timing |
| `disputeWindowDays` | int | 30 | Dispute window |
| `defaultReturnWindowDays` | int | 30 | Default return window |
| `requireSignatureAboveCents` | cents | 75000 | Signature threshold ($750) |
| `allowPartialShipments` | bool | false | Allow partial fulfillment |
| `autoRefundOnCancelBeforeShip` | bool | true | Auto-refund on cancel |

#### Key: `offers`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultOfferExpiryHours` | int | 48 | Offer expiration time |
| `maxCounterOffers` | int | 5 | Max counter-offers |
| `minOfferPercentOfPrice` | int | 0 | Min offer % (0 = no min) |
| `platformOfferFeeEnabled` | bool | false | Charge fee on offers |
| `platformOfferFeeBps` | bps | 0 | Offer fee rate |

#### Key: `cancellation`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `buyerFreeCancelWindowMinutes` | int | 5 | Free cancel window |
| `buyerCanRequestCancelBeforeShip` | bool | true | Allow cancel requests |
| `sellerCancelResponseHours` | int | 48 | Seller response time |
| `buyerCancelAbuseWindowDays` | int | 30 | Abuse detection window |
| `buyerCancelAbuseThreshold` | int | 5 | Abuse threshold count |
| `buyerCancelAbusePenaltyType` | enum | WARNING | Penalty type |
| `buyerCancelAbuseCooldownDays` | int | 7 | Cooldown period |
| `sellerCancelCountsAsDefect` | bool | true | Count as defect |
| `sellerCancelExemptReasons` | array | [...] | Exempt reasons |
| `unpaidOrderCancelHours` | int | 48 | Unpaid order timeout |

---

### Tab 3: 📦 Fulfillment (`fulfillment`)

#### Key: `shipping`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultHandlingDays` | int | 3 | Default handling time |
| `maxHandlingDays` | int | 30 | Maximum handling time |
| `lateShipmentGracePeriodHours` | int | 24 | Grace period |
| `combinedShippingEnabled` | bool | true | Allow combined shipping |
| `freeShippingPromotionEnabled` | bool | true | Allow free shipping promos |
| `domesticOnlyDefault` | bool | true | Default to domestic |
| `requireTrackingNumber` | bool | true | Require tracking |
| `autoMarkDeliveredDays` | int | 0 | Auto-mark delivered (0=off) |

#### Key: `payouts`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `minPayoutAmountCents` | cents | 100 | Minimum payout ($1) |
| `payoutSchedule` | enum | daily | Payout frequency |
| `payoutDayOfWeek` | int | 1 | Day for weekly payouts |
| `newSellerHoldDays` | int | 7 | New seller hold period |
| `highRiskHoldEnabled` | bool | true | Enable high-risk holds |
| `highRiskThresholdCents` | cents | 100000 | High-risk threshold ($1000) |
| `instantPayoutEnabled` | bool | false | Enable instant payouts |
| `instantPayoutFeeBps` | bps | 100 | Instant payout fee (1%) |

---

### Tab 4: ⭐ Trust & Quality (`trust`)

#### Key: `reviews`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `reviewEligibleDaysAfterDelivery` | int | 3 | Days before eligible |
| `reviewWindowDays` | int | 60 | Review window |
| `allowSellerResponse` | bool | true | Allow responses |
| `sellerResponseWindowDays` | int | 30 | Response window |
| `reviewModerationEnabled` | bool | true | Enable moderation |
| `autoApproveReviewsAboveStars` | int | 0 | Auto-approve threshold |
| `reviewEditWindowHours` | int | 24 | Edit window |
| `minReviewLengthChars` | int | 0 | Minimum length |
| `maxReviewLengthChars` | int | 5000 | Maximum length |

#### Key: `sellerStandards`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `evaluationPeriodDays` | int | 90 | Evaluation period |
| `minOrdersForEvaluation` | int | 10 | Min orders for eval |
| `maxDefectRatePercent` | float | 2.0 | GOOD: max defect rate |
| `maxLateShipRatePercent` | float | 4.0 | GOOD: max late ship rate |
| `maxCasesWithoutResolutionPercent` | float | 0.3 | GOOD: max unresolved |
| `topRatedMaxDefectRatePercent` | float | 0.5 | TOP: max defect rate |
| `topRatedMaxLateShipRatePercent` | float | 1.0 | TOP: max late ship |
| `topRatedMinOrdersPerYear` | int | 100 | TOP: min orders |
| `belowStandardListingVisibilityReduction` | int | 50 | Visibility penalty % |
| `belowStandardFvfSurchargePercent` | int | 5 | FVF surcharge % |
| `restrictedMaxActiveListings` | int | 10 | Restricted listing limit |
| `defectExpiryDays` | int | 365 | Defect expiry |

#### Key: `disputes`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sellerEvidenceWindowHours` | int | 72 | Seller evidence window |
| `buyerResponseWindowHours` | int | 72 | Buyer response window |
| `autoEscalateDays` | int | 7 | Auto-escalate days |
| `platformReviewDays` | int | 5 | Platform review time |
| `refundProcessingDays` | int | 5 | Refund processing time |
| `chargebackFeeAmountCents` | cents | 2000 | Chargeback fee ($20) |
| `autoRefundOnSellerNoResponse` | bool | true | Auto-refund if no response |
| `returnShippingDefaultPaidBy` | enum | seller | Return shipping payer |

---

### Tab 5: 🔍 Discovery (`discovery`)

#### Key: `search`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `titleWeight` | float | 3.0 | Title relevance weight |
| `descriptionWeight` | float | 1.0 | Description weight |
| `categoryWeight` | float | 2.0 | Category weight |
| `attributeWeight` | float | 1.5 | Attribute weight |
| `trustScoreEnabled` | bool | true | Include trust in ranking |
| `trustMultiplierWeight` | float | 0.3 | Trust weight |
| `freshnessBoostEnabled` | bool | true | Boost new listings |
| `freshnessBoostDays` | int | 7 | Freshness period |
| `freshnessMaxBoost` | float | 1.2 | Max freshness boost |
| `defaultPageSize` | int | 48 | Default results per page |
| `maxPageSize` | int | 100 | Max results per page |
| `personalizationEnabled` | bool | true | Enable personalization |
| `recentViewsBoostEnabled` | bool | true | Boost recent views |

#### Key: `promotions`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `promotedListingsEnabled` | bool | true | Enable promoted listings |
| `minAdRatePercent` | int | 2 | Minimum ad rate |
| `maxAdRatePercent` | int | 15 | Maximum ad rate |
| `defaultAdRatePercent` | int | 5 | Default ad rate |
| `promotedSlotsPerPage` | int | 4 | Promoted slots per page |
| `promotedSlotPositions` | array | [1,5,9,13] | Slot positions |
| `secondPriceAuctionEnabled` | bool | true | Use second-price auction |
| `minDailyBudgetCents` | cents | 100 | Minimum daily budget ($1) |
| `platformPromotionTakeRateBps` | bps | 0 | Platform take rate |

---

### Tab 6: 🔔 Communications (`communications`)

#### Key: `notifications`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `emailEnabled` | bool | true | Enable email notifications |
| `pushEnabled` | bool | true | Enable push notifications |
| `smsEnabled` | bool | false | Enable SMS notifications |
| `digestEnabled` | bool | true | Enable digest emails |
| `digestFrequency` | enum | daily | Digest frequency |
| `digestTimeUtc` | string | "09:00" | Digest send time |
| `maxEmailsPerDayPerUser` | int | 50 | Email rate limit |
| `maxPushPerDayPerUser` | int | 20 | Push rate limit |
| `maxSmsPerDayPerUser` | int | 5 | SMS rate limit |
| `marketingEmailsEnabled` | bool | true | Allow marketing emails |
| `marketingOptInRequired` | bool | true | Require opt-in |

---

### Tab 7: 🔒 Privacy (`privacy`)

#### Key: `retention`
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `messageRetentionDays` | int | 730 | Message retention (2 years) |
| `searchLogRetentionDays` | int | 90 | Search log retention |
| `webhookLogRetentionDays` | int | 90 | Webhook log retention |
| `analyticsEventRetentionDays` | int | 365 | Analytics retention |
| `notificationLogRetentionDays` | int | 180 | Notification log retention |
| `auditLogRetentionDays` | int | 2555 | Audit log retention (7 years) |
| `dataExportEnabled` | bool | true | Allow data export |
| `dataExportFormatOptions` | array | ["json","csv"] | Export formats |
| `accountDeletionGracePeriodDays` | int | 30 | Deletion grace period |
| `anonymizeOnDeletion` | bool | true | Anonymize vs hard delete |

---

## Total: 174 Configurable Settings

| Tab | Settings Count |
|-----|----------------|
| 💰 Fees & Pricing | 59 (11 fees + 48 tier configs) |
| 🛒 Commerce | 27 |
| 📦 Fulfillment | 16 |
| ⭐ Trust & Quality | 29 |
| 🔍 Discovery | 22 |
| 🔔 Communications | 11 |
| 🔒 Privacy | 10 |
| **TOTAL** | **174** |

---

## Enforcement

### Doctor Check: No Rogue Settings Pages

```typescript
export const settingsArchitectureCheck: HealthCheck = {
  name: "settings.architecture",
  run: async () => {
    // Scan for any settings pages outside /corp/settings/platform
    const roguePages = await scanForRogueSettingsPages();
    
    return {
      name: "settings.architecture",
      status: roguePages.length === 0 ? "PASS" : "FAIL",
      details: roguePages.length === 0
        ? "All settings in unified page"
        : `Found ${roguePages.length} rogue settings pages: ${roguePages.join(", ")}`,
    };
  },
};

async function scanForRogueSettingsPages(): Promise<string[]> {
  const allowedSettingsPaths = [
    "/corp/settings/platform",      // Unified settings
    "/corp/settings/flags",         // Feature flags (specialized)
    "/corp/settings/notifications/templates", // Templates (specialized)
    "/corp/settings/categories",    // Categories (specialized)
  ];
  
  // Check for any other /corp/settings/* pages
  // Return list of violations
  return [];
}
```

### Lint Rule (Optional)

```typescript
// eslint-plugin-twicely/no-rogue-settings.ts
export const noRogueSettings = {
  meta: {
    type: "problem",
    docs: {
      description: "Settings pages must use unified Platform Settings",
    },
  },
  create(context) {
    return {
      // Detect creation of new settings pages outside allowed paths
    };
  },
};
```

---

## Migration Checklist

- [ ] Create `PlatformSettings` and `PlatformSettingsAudit` models
- [ ] Run Prisma migration
- [ ] Create type definitions (`platformSettingsTypes.ts`)
- [ ] Create default values (`platformSettingsDefaults.ts`)
- [ ] Create service (`platformSettingsService.ts`)
- [ ] Create API route (`/api/corp/settings/platform`)
- [ ] Create unified UI page (`/corp/settings/platform/page.tsx`)
- [ ] Add URL redirects to middleware
- [ ] Update nav items (remove old, add unified)
- [ ] Delete old settings page files
- [ ] Add Doctor health check
- [ ] Update any services using old hardcoded values to read from `PlatformSettings`
- [ ] Test all 7 tabs
- [ ] Verify redirects work

---

## Bundle Settings (Phase 3)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| SELLER_BUNDLES_ENABLED | boolean | true | Enable seller bundles feature |
| MAX_BUNDLES_PER_SELLER | number | 50 | Max active bundles per seller |
| MAX_BUNDLE_DISCOUNT_PERCENT | number | 50 | Maximum discount percentage |
| MIN_BUNDLE_ITEMS | number | 2 | Minimum items for a bundle |
| SMART_PROMPTS_ENABLED | boolean | true | Show smart cart prompts |
| FREE_SHIPPING_PROMPT_ENABLED | boolean | true | Show free shipping prompts |
| BUNDLE_PROMPT_ENABLED | boolean | true | Show bundle suggestions |
| MAX_PROMPTS_PER_CART | number | 3 | Max prompts displayed |
| MAKE_ME_A_DEAL_ENABLED | boolean | true | Enable negotiation feature |
| MIN_ITEMS_FOR_DEAL | number | 2 | Min items to request deal |
| MIN_CART_VALUE_CENTS_FOR_DEAL | number | 2000 | Min cart value ($20) |
| REQUEST_EXPIRATION_HOURS | number | 48 | Request timeout |
| MAX_REQUESTS_PER_BUYER_DAY | number | 5 | Daily request limit |
| SELLER_RESPONSE_SLA_HOURS | number | 24 | Seller response deadline |
| COUNTER_OFFER_EXPIRATION_HOURS | number | 24 | Counter-offer timeout |

**Admin UI:** `/corp/settings/bundles`

---

## Price Alert Settings (Phase 43)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| PRICE_ALERTS_ENABLED | boolean | true | Enable price alerts |
| PRICE_ALERT_MAX_PER_USER | number | 100 | Max active alerts per user |
| PRICE_ALERT_DEFAULT_EXPIRY_DAYS | number | 90 | Default alert expiration |
| CATEGORY_ALERTS_ENABLED | boolean | true | Enable category alerts |
| CATEGORY_ALERT_MAX_PER_USER | number | 20 | Max category alerts per user |
| CATEGORY_ALERT_IMMEDIATE_LIMIT | number | 10 | Max immediate notifications/day |
| PRICE_HISTORY_ENABLED | boolean | true | Track price history |
| PRICE_HISTORY_RETENTION_DAYS | number | 365 | Price change retention |
| MARKET_INDEX_ENABLED | boolean | true | Compute market indexes |
| MARKET_INDEX_MIN_SAMPLE | number | 10 | Min sales for index |
| MARKET_INDEX_HIGH_CONFIDENCE | number | 50 | Sales for HIGH confidence |
| DEAL_BADGES_ENABLED | boolean | true | Show deal badges |
| DEAL_BADGE_LOW_CONFIDENCE_VISIBLE | boolean | false | Show LOW confidence badges |
| DIGESTS_ENABLED | boolean | true | Enable email digests |

**Admin UI:** `/corp/settings/price-alerts`

---

## Protection Settings (Phase 38)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| CLAIM_WINDOW_DAYS_DEFAULT | number | 30 | Default claim window |
| CLAIM_WINDOW_DAYS_COUNTERFEIT | number | 180 | Counterfeit claim window |
| SELLER_RESPONSE_DEADLINE_HOURS | number | 72 | Seller must respond within |
| APPEAL_WINDOW_DAYS | number | 30 | Days to file appeal |
| APPEAL_REVIEW_SLA_HOURS | number | 48 | Appeal review deadline |
| AUTO_REFUND_MAX_CENTS | number | 10000 | Auto-approve threshold |
| DEFAULT_COVERAGE_LIMIT_CENTS | number | 500000 | Default max coverage |
| PROTECTION_SCORE_CLAIM_PENALTY | number | 5 | Points lost per claim |
| PROTECTION_SCORE_APPEAL_WIN_BONUS | number | 3 | Points gained per appeal won |
| MAX_CLAIMS_PER_BUYER_90_DAYS | number | 5 | Buyer abuse threshold |
| SHOW_PROTECTION_BADGES | boolean | true | Show badges on listings |
| SHOW_SELLER_PROTECTION_SCORE | boolean | true | Show score to sellers |

**Admin UI:** `/corp/settings/protection`

---

## Trust Label Settings (Phase 37)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| SHOW_TRUST_LABELS_TO_BUYERS | boolean | true | Show trust labels on listings |
| TOP_RATED_LABEL_TEXT | string | "Top Rated Seller" | Label for TOP_RATED sellers |
| TOP_RATED_LABEL_SHORT | string | "Top Rated" | Short label for cards |
| TOP_RATED_LABEL_ICON | string | "⭐" | Icon for TOP_RATED |
| GOOD_LABEL_TEXT | string | "Trusted Seller" | Label for GOOD sellers |
| GOOD_LABEL_SHORT | string | "Trusted" | Short label for cards |
| GOOD_LABEL_ICON | string | "✓" | Icon for GOOD |
| SHOW_TRUST_ICON | boolean | true | Show icon with label |

**Admin UI:** `/corp/settings/platform?tab=trust` → Trust Labels section

**Key Principle:** Only positive signals (TOP_RATED, GOOD) show badges. WATCH, LIMITED, and RESTRICTED sellers show NO badge - not negative labels.

---

## Summary

**Before:** 8+ scattered settings pages, inconsistent UI, some values hardcoded

**After:**
- ✅ **1 unified page** at `/corp/settings/platform`
- ✅ **10 organized tabs** by category (including new Bundle, Price Alert, Protection tabs)
- ✅ **224 configurable settings** (174 original + 42 new + 8 trust labels)
- ✅ **Full audit trail** for all changes
- ✅ **Redirects** from old URLs
- ✅ **Canonical rule** - no new settings pages allowed
- ✅ **Doctor check** enforces architecture

---

*This is the CANONICAL specification for Twicely V2 platform settings architecture.*
