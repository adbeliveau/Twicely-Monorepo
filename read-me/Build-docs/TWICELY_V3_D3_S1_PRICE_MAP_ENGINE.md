# D3-S1 — Subscription Price Map + Engine + Queries

## READ FIRST
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md (§4 Store, §5 XLister, §6 Finance, §8 Automation, §9 Bundles, §16 Stripe Product Mapping)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md (§3 storeSubscription, listerSubscription, automationSubscription, §18.1 financeSubscription)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_USER_MODEL.md (§4 subscription axes, "DO NOT CONFLATE" table)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md (§3 trials, §5 Stripe integration)
- C:\Users\XPS-15\Projects\Twicely\src\lib\db\schema\subscriptions.ts (existing Drizzle schema for all 4 subscription tables)
- C:\Users\XPS-15\Projects\Twicely\src\lib\db\schema\index.ts (verify all 4 subscription tables are exported)
- C:\Users\XPS-15\Projects\Twicely\src\lib\stripe\server.ts (existing Stripe client)
- C:\Users\XPS-15\Projects\Twicely\src\lib\utils\tier-gates.ts (existing StoreTierGatedFeature map)
- C:\Users\XPS-15\Projects\Twicely\src\lib\commerce\boosting.ts (reference for pure function pattern)

---

## CONTEXT

This is slice 1 of 5 for D3 (Store Subscriptions). It builds the foundation layer: a comprehensive price/product map that maps Twicely tiers → Stripe product/price IDs, pure validation functions, and DB query functions for all 4 subscription tables.

### The Three Independent Axes + Automation (LOCKED)

| Axis | Enum | Tiers | Table |
|------|------|-------|-------|
| Store | `StoreTier` | NONE / STARTER / PRO / POWER / ENTERPRISE | `storeSubscription` |
| XLister | `ListerTier` | NONE / FREE / LITE / PRO | `listerSubscription` |
| Finance | `FinanceTier` | FREE / PRO | `financeSubscription` |
| Automation | boolean | on/off | `automationSubscription` |

Plus 3 Bundles (single Stripe products, not combined components):
- Seller Starter = Store Starter + Finance Pro
- Seller Pro = Store Pro + XLister Pro + Finance Pro (6mo free)
- Seller Power = Store Power + XLister Pro + Finance Pro + Automation

### CRITICAL GUARDRAILS

1. **DO NOT create Stripe products/prices in code.** The price map contains STRING PLACEHOLDERS like `price_store_starter_annual`. These will be replaced with real Stripe Price IDs when we create them in the Stripe Dashboard. The code must work with any string value.
2. **DO NOT modify any existing schema tables.** Use the tables exactly as they exist in schema/subscriptions.ts.
3. **DO NOT add subscription webhook handling.** That's D3-S2.
4. **DO NOT build any UI.** That's D3-S3.
5. **All functions are either pure (no DB) or read-only queries.** No mutations in this slice.

---

## TASK 1: Stripe Product/Price Map

**File:** `src/lib/subscriptions/price-map.ts` (~180 lines)

This file is the SINGLE SOURCE OF TRUTH for mapping Twicely tiers to Stripe product/price IDs and pricing.

```typescript
// ─── Types ──────────────────────────────────────────────────────────────

export type BillingInterval = 'monthly' | 'annual';

export interface PricingEntry {
  /** Stripe Product ID (set in env or config, placeholder for now) */
  stripeProductId: string;
  /** Stripe Price ID for monthly billing */
  stripePriceIdMonthly: string;
  /** Stripe Price ID for annual billing */
  stripePriceIdAnnual: string;
  /** Monthly price in cents (when billed monthly) */
  monthlyCents: number;
  /** Monthly price in cents (when billed annually) */
  annualMonthlyCents: number;
  /** Display name for UI */
  displayName: string;
}

// ─── Store Subscription Pricing ─────────────────────────────────────────

export const STORE_PRICING: Record<string, PricingEntry> = {
  STARTER: {
    stripeProductId: 'prod_store_starter',
    stripePriceIdMonthly: 'price_store_starter_monthly',
    stripePriceIdAnnual: 'price_store_starter_annual',
    monthlyCents: 1200,
    annualMonthlyCents: 699,
    displayName: 'Store Starter',
  },
  PRO: {
    stripeProductId: 'prod_store_pro',
    stripePriceIdMonthly: 'price_store_pro_monthly',
    stripePriceIdAnnual: 'price_store_pro_annual',
    monthlyCents: 3999,
    annualMonthlyCents: 2999,
    displayName: 'Store Pro',
  },
  POWER: {
    stripeProductId: 'prod_store_power',
    stripePriceIdMonthly: 'price_store_power_monthly',
    stripePriceIdAnnual: 'price_store_power_annual',
    monthlyCents: 7999,
    annualMonthlyCents: 5999,
    displayName: 'Store Power',
  },
  // ENTERPRISE is custom pricing — not in the map. Handled separately.
  // NONE is free — no Stripe product needed.
};

// ─── XLister Subscription Pricing ───────────────────────────────────────

export const LISTER_PRICING: Record<string, PricingEntry> = {
  LITE: {
    stripeProductId: 'prod_xlister_lite',
    stripePriceIdMonthly: 'price_xlister_lite_monthly',
    stripePriceIdAnnual: 'price_xlister_lite_annual',
    monthlyCents: 1399,
    annualMonthlyCents: 999,
    displayName: 'XLister Lite',
  },
  PRO: {
    stripeProductId: 'prod_xlister_pro',
    stripePriceIdMonthly: 'price_xlister_pro_monthly',
    stripePriceIdAnnual: 'price_xlister_pro_annual',
    monthlyCents: 3999,
    annualMonthlyCents: 2999,
    displayName: 'XLister Pro',
  },
  // FREE tier has no Stripe product — it's the default.
  // NONE means no crosslister at all.
};

// ─── Finance Subscription Pricing ───────────────────────────────────────

export const FINANCE_PRICING: Record<string, PricingEntry> = {
  PRO: {
    stripeProductId: 'prod_finance_pro',
    stripePriceIdMonthly: 'price_finance_pro_monthly',
    stripePriceIdAnnual: 'price_finance_pro_annual',
    monthlyCents: 1499,
    annualMonthlyCents: 999,
    displayName: 'Finance Pro',
  },
  // FREE is default — no Stripe product.
};

// ─── Automation Add-On Pricing ──────────────────────────────────────────

export const AUTOMATION_PRICING: PricingEntry = {
  stripeProductId: 'prod_automation',
  stripePriceIdMonthly: 'price_automation_monthly',
  stripePriceIdAnnual: 'price_automation_annual',
  monthlyCents: 1299,
  annualMonthlyCents: 999,
  displayName: 'Automation',
};

// ─── Bundle Pricing ─────────────────────────────────────────────────────

export interface BundleEntry extends PricingEntry {
  /** Which individual tiers this bundle includes */
  includes: {
    storeTier: string;
    listerTier?: string;
    financeTier: string;
    automation?: boolean;
  };
}

export const BUNDLE_PRICING: Record<string, BundleEntry> = {
  STARTER: {
    stripeProductId: 'prod_bundle_starter',
    stripePriceIdMonthly: 'price_bundle_starter_monthly',
    stripePriceIdAnnual: 'price_bundle_starter_annual',
    monthlyCents: 2499,
    annualMonthlyCents: 1799,
    displayName: 'Seller Starter Bundle',
    includes: { storeTier: 'STARTER', financeTier: 'PRO' },
  },
  PRO: {
    stripeProductId: 'prod_bundle_pro',
    stripePriceIdMonthly: 'price_bundle_pro_monthly',
    stripePriceIdAnnual: 'price_bundle_pro_annual',
    monthlyCents: 7499,
    annualMonthlyCents: 5999,
    displayName: 'Seller Pro Bundle',
    includes: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO' },
  },
  POWER: {
    stripeProductId: 'prod_bundle_power',
    stripePriceIdMonthly: 'price_bundle_power_monthly',
    stripePriceIdAnnual: 'price_bundle_power_annual',
    monthlyCents: 10999,
    annualMonthlyCents: 8999,
    displayName: 'Seller Power Bundle',
    includes: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', automation: true },
  },
};
```

### Helper Functions (in the same file)

```typescript
export type SubscriptionProduct = 'store' | 'lister' | 'finance' | 'automation' | 'bundle';

/**
 * Look up a pricing entry by product type and tier.
 * Returns null for free/none tiers or unknown combos.
 */
export function getPricing(product: SubscriptionProduct, tier: string): PricingEntry | null

/**
 * Get the Stripe Price ID for a product/tier/interval combo.
 * Returns null if no paid tier exists.
 */
export function getStripePriceId(
  product: SubscriptionProduct,
  tier: string,
  interval: BillingInterval
): string | null

/**
 * Given a Stripe Price ID, reverse-lookup which product + tier + interval it belongs to.
 * Returns null if not found (e.g., a price ID from a different Stripe account).
 */
export function resolveStripePriceId(priceId: string): {
  product: SubscriptionProduct;
  tier: string;
  interval: BillingInterval;
} | null

/**
 * Get the display price for a tier (formatted string like "$29.99/mo").
 */
export function formatTierPrice(product: SubscriptionProduct, tier: string, interval: BillingInterval): string

/**
 * Calculate annual savings percentage vs monthly.
 * Returns 0 if no savings or tier doesn't exist.
 */
export function getAnnualSavingsPercent(product: SubscriptionProduct, tier: string): number
```

---

## TASK 2: Subscription Engine (Pure Functions)

**File:** `src/lib/subscriptions/subscription-engine.ts` (~100 lines)

```typescript
import { STORE_PRICING, LISTER_PRICING } from './price-map';

// ─── Store Tier Ordering ────────────────────────────────────────────────

const STORE_TIER_ORDER = ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'] as const;
const LISTER_TIER_ORDER = ['NONE', 'FREE', 'LITE', 'PRO'] as const;

export type StoreTierValue = typeof STORE_TIER_ORDER[number];
export type ListerTierValue = typeof LISTER_TIER_ORDER[number];

/**
 * Returns -1 (downgrade), 0 (same), 1 (upgrade).
 */
export function compareStoreTiers(current: string, target: string): -1 | 0 | 1

/**
 * Returns -1 (downgrade), 0 (same), 1 (upgrade).
 */
export function compareListerTiers(current: string, target: string): -1 | 0 | 1

/**
 * Can this seller subscribe to this store tier?
 * Rules:
 * - NONE: always allowed (cancel)
 * - STARTER/PRO/POWER: requires BUSINESS seller status
 * - ENTERPRISE: not self-service (return false, must contact sales)
 */
export function canSubscribeToStoreTier(tier: string, sellerStatus: string): { allowed: boolean; reason?: string }

/**
 * What happens to features when downgrading?
 * Returns a list of warnings like "Boosting will be disabled" or "Custom categories will be hidden".
 */
export function getDowngradeWarnings(currentTier: string, targetTier: string): string[]

/**
 * Is this a paid tier (needs Stripe subscription)?
 */
export function isPaidStoreTier(tier: string): boolean
// true for STARTER, PRO, POWER. false for NONE, ENTERPRISE.

export function isPaidListerTier(tier: string): boolean
// true for LITE, PRO. false for NONE, FREE.
```

---

## TASK 3: Subscription Queries

**File:** `src/lib/queries/subscriptions.ts` (~120 lines)

Read-only queries for all 4 subscription tables.

```typescript
import { db } from '@/lib/db';
import { storeSubscription, listerSubscription, financeSubscription, automationSubscription, sellerProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────────

export interface SubscriptionSummary {
  store: {
    tier: string;
    status: string;
    interval: 'monthly' | 'annual' | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: Date | null;
  } | null;
  lister: {
    tier: string;
    status: string;
    interval: 'monthly' | 'annual' | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  finance: {
    tier: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  automation: {
    status: string;
    creditsIncluded: number;
    creditsUsed: number;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

/**
 * Get complete subscription state for a seller.
 * Returns all 4 axes in one call. Used by subscription management page.
 */
export async function getSubscriptionSummary(sellerProfileId: string): Promise<SubscriptionSummary>

/**
 * Get store subscription for a seller. Returns null if no record exists.
 */
export async function getStoreSubscription(sellerProfileId: string): Promise<StoreSubscriptionRow | null>

/**
 * Get lister subscription for a seller.
 */
export async function getListerSubscription(sellerProfileId: string): Promise<ListerSubscriptionRow | null>

/**
 * Get finance subscription for a seller.
 */
export async function getFinanceSubscription(sellerProfileId: string): Promise<FinanceSubscriptionRow | null>

/**
 * Get automation subscription for a seller.
 */
export async function getAutomationSubscription(sellerProfileId: string): Promise<AutomationSubscriptionRow | null>

/**
 * Find which seller profile owns a Stripe subscription ID.
 * Searches all 4 subscription tables. Used by webhook handler.
 */
export async function findSellerByStripeSubscriptionId(stripeSubId: string): Promise<{
  sellerProfileId: string;
  product: 'store' | 'lister' | 'finance' | 'automation';
} | null>

/**
 * Find seller profile by Stripe customer ID.
 * The sellerProfile table has stripeCustomerId field.
 */
export async function findSellerByStripeCustomerId(customerId: string): Promise<{
  sellerProfileId: string;
  userId: string;
} | null>
```

Each individual query function returns the full row type inferred from Drizzle (`typeof storeSubscription.$inferSelect`). Define type aliases at the top:

```typescript
type StoreSubscriptionRow = typeof storeSubscription.$inferSelect;
type ListerSubscriptionRow = typeof listerSubscription.$inferSelect;
type FinanceSubscriptionRow = typeof financeSubscription.$inferSelect;
type AutomationSubscriptionRow = typeof automationSubscription.$inferSelect;
```

For `getSubscriptionSummary`, determine interval from `stripePriceId` using `resolveStripePriceId` from the price map. If the stripePriceId is null or unrecognized, interval = null.

---

## TASK 4: Tests

### File: `src/lib/subscriptions/__tests__/price-map.test.ts` (~100 lines)

Minimum 12 tests:

**getPricing (3 tests):**
- store PRO → returns entry with correct prices
- store NONE → returns null
- lister FREE → returns null

**getStripePriceId (3 tests):**
- store PRO annual → returns 'price_store_pro_annual'
- automation monthly → returns 'price_automation_monthly'
- store NONE annual → returns null

**resolveStripePriceId (3 tests):**
- 'price_store_pro_annual' → { product: 'store', tier: 'PRO', interval: 'annual' }
- 'price_bundle_power_monthly' → { product: 'bundle', tier: 'POWER', interval: 'monthly' }
- 'price_unknown_thing' → null

**formatTierPrice (2 tests):**
- store PRO monthly → '$39.99/mo'
- store PRO annual → '$29.99/mo'

**getAnnualSavingsPercent (1 test):**
- store PRO → correct percentage (~25%)

### File: `src/lib/subscriptions/__tests__/subscription-engine.test.ts` (~80 lines)

Minimum 10 tests:

**compareStoreTiers (3 tests):**
- NONE → PRO = 1 (upgrade)
- PRO → PRO = 0 (same)
- POWER → STARTER = -1 (downgrade)

**canSubscribeToStoreTier (3 tests):**
- PRO with BUSINESS → allowed
- PRO with PERSONAL → not allowed, reason mentions BUSINESS
- ENTERPRISE → not allowed, reason mentions sales

**getDowngradeWarnings (2 tests):**
- PRO → STARTER → includes "Boosting will be disabled" and "Custom categories will be hidden"
- STARTER → NONE → includes warnings about storefront features

**isPaidStoreTier / isPaidListerTier (2 tests):**
- isPaidStoreTier('PRO') → true, isPaidStoreTier('NONE') → false
- isPaidListerTier('LITE') → true, isPaidListerTier('FREE') → false

---

## FILE MANIFEST

| # | File | Lines | New/Mod |
|---|------|-------|---------|
| 1 | `src/lib/subscriptions/price-map.ts` | ~180 | New |
| 2 | `src/lib/subscriptions/subscription-engine.ts` | ~100 | New |
| 3 | `src/lib/queries/subscriptions.ts` | ~120 | New |
| 4 | `src/lib/subscriptions/__tests__/price-map.test.ts` | ~100 | New |
| 5 | `src/lib/subscriptions/__tests__/subscription-engine.test.ts` | ~80 | New |
| **Total** | | **~580** | **5 new** |

---

## GUARDRAILS — READ THESE BEFORE WRITING ANY CODE

1. **NO Stripe API calls anywhere in this slice.** Pure functions and DB reads only.
2. **NO mutations (insert/update/delete).** All queries are SELECT.
3. **NO webhook handling.** That's D3-S2.
4. **NO UI components or pages.** That's D3-S3.
5. **NO modifications to existing schema files.** Use tables as-is.
6. **Stripe Price IDs are PLACEHOLDER STRINGS** like `price_store_pro_annual`. They get swapped for real IDs later. Code must not validate their format.
7. **Bundles are single Stripe products** — NOT combined subscriptions. One Stripe subscription per bundle.
8. **ENTERPRISE is not self-service.** Not in the price map. `canSubscribeToStoreTier('ENTERPRISE', ...)` returns false with "Contact sales."
9. **All files under 300 lines.** If price-map.ts hits 300, split bundle pricing into `price-map-bundles.ts`.
10. **Import subscription tables from `@/lib/db/schema`** — do NOT import directly from `schema/subscriptions.ts`.

## VERIFY

```bash
pnpm typecheck                    # 0 errors
pnpm test                         # all pass, target ≥778 (756 + 22 new)
wc -l src/lib/subscriptions/price-map.ts src/lib/subscriptions/subscription-engine.ts src/lib/queries/subscriptions.ts src/lib/subscriptions/__tests__/price-map.test.ts src/lib/subscriptions/__tests__/subscription-engine.test.ts
# ALL under 300
./twicely-lint.sh
```

## COMMIT

```bash
git add -A && git commit -m "D3-S1: subscription price map, engine, queries — 22+ tests, no Stripe calls"
```
