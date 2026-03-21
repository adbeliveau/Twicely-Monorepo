# D3-S5 — Bundles + Finance Checkout

**Prerequisite:** D3-S4 committed (920 tests, 0 TS errors)
**Target:** ≥960 tests on completion
**Governing docs:** Pricing Canonical v3.2 §9, Schema v2.0.4, User Model v1.3

---

## READ FIRST

```
C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\D3-S5-BUNDLES-FINANCE.md
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_USER_MODEL.md
src/lib/subscriptions/price-map.ts
src/lib/subscriptions/subscription-engine.ts
src/lib/subscriptions/bundle-resolution.ts
src/lib/actions/create-subscription-checkout.ts
src/lib/actions/change-subscription.ts
src/lib/stripe/subscription-webhooks.ts
src/lib/queries/subscriptions.ts
src/db/schema/subscriptions.ts
src/db/schema/identity.ts
src/types/enums.ts
```

Read ALL files above before writing any code. Do not invent — implement exactly what this spec says.

---

## LOCKED DECISIONS

| # | Decision | Source |
|---|----------|--------|
| 98 | 3 bundles only: Starter, Pro, Power (Decision #67 superseded by Pricing Canonical §9) | Adrian |
| 99 | Bundles are single Stripe subscription products, not combined components | Pricing Canonical §9 |
| 100 | Finance Pro is permanent while on any bundle — "6mo free" promo is for non-bundle individual subscribers only (Phase G) | Adrian |
| 101 | New `bundleSubscription` table (Option A) — FK to sellerProfile, same pattern as other subscription tables | Adrian |
| 102 | `bundleTier` denormalized on sellerProfile, same pattern as storeTier/listerTier/financeTier | Adrian |
| 103 | Individual→bundle upgrade: cancel individual Stripe subs immediately, create bundle sub with Stripe proration credit | Pricing Canonical §9 |
| 104 | Bundle cancel: at period end, component tiers revert to NONE/FREE. Seller re-subscribes individually if desired. | Adrian |

---

## BUNDLE DEFINITIONS (Pricing Canonical §9 — authoritative)

| Bundle | BundleTier | Annual/mo | Monthly | Components |
|--------|-----------|-----------|---------|------------|
| Seller Starter | STARTER | $17.99 | $24.99 | Store STARTER + Finance PRO |
| Seller Pro | PRO | $59.99 | $74.99 | Store PRO + Lister PRO + Finance PRO |
| Seller Power | POWER | $89.99 | $109.99 | Store POWER + Lister PRO + Finance PRO + Automation |

### Component Mapping (exact)

```typescript
const BUNDLE_COMPONENTS: Record<BundleTier, BundleComponents> = {
  NONE: { storeTier: 'NONE', listerTier: 'NONE', financeTier: 'FREE', hasAutomation: false },
  STARTER: { storeTier: 'STARTER', listerTier: 'NONE', financeTier: 'PRO', hasAutomation: false },
  PRO: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: false },
  POWER: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: true },
};
```

Note: Seller Starter does NOT include a lister tier. Seller Pro does NOT include automation.

### Pricing (cents)

```
bundle.starter.annualCents: 1799
bundle.starter.monthlyCents: 2499
bundle.pro.annualCents: 5999
bundle.pro.monthlyCents: 7499
bundle.power.annualCents: 8999
bundle.power.monthlyCents: 10999
```

### Stripe Price IDs (convention)

```
price_bundle_starter_monthly | price_bundle_starter_annual
price_bundle_pro_monthly     | price_bundle_pro_annual
price_bundle_power_monthly   | price_bundle_power_annual
```

---

## SECTION A: Schema Migration

### A1: Add `bundleTier` enum

```typescript
export const bundleTierEnum = pgEnum('bundle_tier', ['NONE', 'STARTER', 'PRO', 'POWER']);
```

Add to `src/db/schema/subscriptions.ts` alongside existing enums.
Add to `src/types/enums.ts` as:

```typescript
export type BundleTier = 'NONE' | 'STARTER' | 'PRO' | 'POWER';
```

### A2: Add `bundleSubscription` table

```typescript
export const bundleSubscription = pgTable('bundle_subscription', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  tier:                  bundleTierEnum('tier').notNull(),
  status:                subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId:  text('stripe_subscription_id').unique(),
  stripePriceId:         text('stripe_price_id'),
  currentPeriodStart:    timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:      timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:     boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:            timestamp('canceled_at', { withTimezone: true }),
  trialEndsAt:           timestamp('trial_ends_at', { withTimezone: true }),
  pendingTier:           bundleTierEnum('pending_tier'),
  pendingBillingInterval: text('pending_billing_interval'),
  pendingChangeAt:       timestamp('pending_change_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Same shape as store/lister/finance subscription tables. Includes pending columns from D3-S4.

### A3: Add `bundleTier` to `sellerProfile`

```sql
ALTER TABLE seller_profile ADD COLUMN bundle_tier bundle_tier NOT NULL DEFAULT 'NONE';
```

In Drizzle schema:

```typescript
bundleTier: bundleTierEnum('bundle_tier').notNull().default('NONE'),
```

### A4: Migration file

Create `drizzle/0006_add-bundle-subscription.sql` with:
1. CREATE TYPE bundle_tier
2. CREATE TABLE bundle_subscription
3. ALTER TABLE seller_profile ADD COLUMN bundle_tier

Run migration via `psql`. Verify with `npx tsc --noEmit` and `npx vitest run`.

**STOP after Section A. Report test count and TS errors.**

---

## SECTION B: Price Map + Engine

### B1: Add bundle pricing to `price-map.ts`

Check if `BUNDLE_PRICING` already exists (it was exported in D3-S3 tier-config). If so, update it. If not, add it.

Required shape:

```typescript
export const BUNDLE_PRICING: Record<string, {
  displayName: string;
  annualCents: number;
  monthlyCents: number;
}> = {
  STARTER: { displayName: 'Seller Starter', annualCents: 1799, monthlyCents: 2499 },
  PRO: { displayName: 'Seller Pro', annualCents: 5999, monthlyCents: 7499 },
  POWER: { displayName: 'Seller Power', annualCents: 8999, monthlyCents: 10999 },
};
```

Extend `resolveStripePriceId()` and `getPricing()` to handle `product: 'bundle'`.
Extend `formatTierPrice()` and `getAnnualSavingsPercent()` to handle bundles.

Add Stripe price ID entries to the PRICE_MAP:

```typescript
price_bundle_starter_monthly → { product: 'bundle', tier: 'STARTER', interval: 'monthly', cents: 2499 }
price_bundle_starter_annual  → { product: 'bundle', tier: 'STARTER', interval: 'annual', cents: 1799 }
price_bundle_pro_monthly     → { product: 'bundle', tier: 'PRO', interval: 'monthly', cents: 7499 }
price_bundle_pro_annual      → { product: 'bundle', tier: 'PRO', interval: 'annual', cents: 5999 }
price_bundle_power_monthly   → { product: 'bundle', tier: 'POWER', interval: 'monthly', cents: 10999 }
price_bundle_power_annual    → { product: 'bundle', tier: 'POWER', interval: 'annual', cents: 8999 }
```

### B2: Add bundle component resolution to `bundle-resolution.ts`

This file already exists (extracted in D3-S4). Add:

```typescript
export interface BundleComponents {
  storeTier: StoreTier;
  listerTier: ListerTier;
  financeTier: FinanceTier;
  hasAutomation: boolean;
}

export const BUNDLE_COMPONENTS: Record<BundleTier, BundleComponents> = {
  NONE: { storeTier: 'NONE', listerTier: 'NONE', financeTier: 'FREE', hasAutomation: false },
  STARTER: { storeTier: 'STARTER', listerTier: 'NONE', financeTier: 'PRO', hasAutomation: false },
  PRO: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: false },
  POWER: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: true },
};

export function resolveBundleComponents(tier: BundleTier): BundleComponents {
  return BUNDLE_COMPONENTS[tier];
}

export function getBundleSavingsCents(tier: BundleTier, interval: BillingInterval): number {
  // Sum individual component prices (from getPricing) minus bundle price
  // Returns positive number = savings in cents
}
```

### B3: Add bundle classification to `subscription-engine.ts`

Add `compareBundleTiers()`:

```typescript
export function compareBundleTiers(a: string, b: string): number {
  const order = ['NONE', 'STARTER', 'PRO', 'POWER'];
  return order.indexOf(a) - order.indexOf(b);
}
```

Extend `classifySubscriptionChange()` to handle `product: 'bundle'` using `compareBundleTiers`.

**STOP after Section B. Report test count and TS errors.**

---

## SECTION C: Bundle Checkout

### C1: Create `createBundleCheckout` action

New file: `src/lib/actions/create-bundle-checkout.ts`

Flow:
1. Auth + CASL check: `ability.can('create', sub('Subscription', { userId }))`
2. Validate input: `bundleTier` (STARTER | PRO | POWER), `billingInterval` (monthly | annual)
3. PERSONAL seller guard — bundles include Store, Store requires BUSINESS
4. Check for existing active bundle — return error: "Use Change Plan to switch bundles"
5. Check for existing individual subscriptions (store, lister, finance, automation with active stripeSubscriptionId):
   a. Cancel each immediately: `stripe.subscriptions.cancel(stripeSubId, { prorate: true })`
   b. Update each subscription row: `status: 'CANCELED', canceledAt: new Date()`
   c. Do NOT update sellerProfile tier columns — the bundle webhook handles that
6. Resolve Stripe price ID: `resolveStripePriceId('bundle', bundleTier, billingInterval)`
7. Create Stripe checkout session:
   - `mode: 'subscription'`
   - `line_items: [{ price: bundlePriceId, quantity: 1 }]`
   - `subscription_data.metadata: { product: 'bundle', tier: bundleTier, sellerProfileId }`
   - `success_url: /my/selling/subscription?bundleSuccess=true`
   - `cancel_url: /my/selling/subscription`
8. Return `{ success: true, checkoutUrl }`

Zod schema:

```typescript
const createBundleCheckoutSchema = z.object({
  bundleTier: z.enum(['STARTER', 'PRO', 'POWER']),
  billingInterval: z.enum(['monthly', 'annual']),
});
```

### C2: Finance-only checkout

Verify that the existing `createSubscriptionCheckout` action handles `product: 'finance'`. It should already work from D3-S2. If it does, no code changes needed — only UI wiring in Section F.

If it doesn't handle finance (check the Zod schema and switch statement), add the `'finance'` case following the store/lister pattern.

**STOP after Section C. Report test count and TS errors.**

---

## SECTION D: Webhook Handler

### D1: Extend `handleSubscriptionUpsert` for bundles

In `subscription-webhooks.ts`, add `'bundle'` case to the product switch:

```typescript
case 'bundle': {
  // 1. Upsert bundleSubscription row (same pattern as store/lister/finance)
  await tx.insert(bundleSubscription).values({
    sellerProfileId,
    tier: metadata.tier as BundleTier,
    status: mapStripeStatus(stripeSubscription.status),
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: stripeSubscription.items.data[0]?.price.id,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  }).onConflictDoUpdate({
    target: bundleSubscription.sellerProfileId,
    set: { /* same fields */ },
  });

  // 2. Resolve component tiers
  const components = resolveBundleComponents(metadata.tier as BundleTier);

  // 3. Update sellerProfile
  await tx.update(sellerProfile).set({
    bundleTier: metadata.tier as BundleTier,
    storeTier: components.storeTier,
    listerTier: components.listerTier,
    financeTier: components.financeTier,
    hasAutomation: components.hasAutomation,
    updatedAt: new Date(),
  }).where(eq(sellerProfile.id, sellerProfileId));

  break;
}
```

### D2: Bundle cancellation in webhook

In the `customer.subscription.deleted` handler (or when status becomes 'canceled'):

When the deleted subscription has `metadata.product === 'bundle'`:

1. Update `bundleSubscription`: status = 'CANCELED', canceledAt = now
2. Revert sellerProfile:
   - `bundleTier: 'NONE'`
   - `storeTier: 'NONE'`
   - `listerTier: 'NONE'`
   - `financeTier: 'FREE'`
   - `hasAutomation: false`

Note: If the seller had independent subscriptions before the bundle (which were canceled on bundle purchase), those stay canceled. The seller must re-subscribe individually if they want.

### D3: Extend `applyPendingDowngradeIfNeeded` for bundles

Add `bundleSubscription` to `findPendingSubscription()` lookup. Same pattern — check for pendingTier or pendingBillingInterval, apply if pendingChangeAt is past.

On bundle downgrade apply:
1. Update Stripe subscription to new bundle price
2. Resolve new component tiers via `resolveBundleComponents(newTier)`
3. Update sellerProfile with new component tiers
4. Clear pending fields

**STOP after Section D. Report test count and TS errors.**

---

## SECTION E: Bundle Cancel + Change Plan

### E1: Cancel bundle action

Extend the existing cancel flow to handle `product: 'bundle'`:
- Read `bundleSubscription.stripeSubscriptionId`
- Call `stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })`
- Set `bundleSubscription.cancelAtPeriodEnd = true`
- Do NOT revert component tiers — that happens at period end via webhook (D2)

Also clear pending fields on cancel (same pattern as D3-S4 for store/lister/finance).

### E2: Change bundle plan

Extend `changeSubscriptionAction` to handle `product: 'bundle'`:
- Add 'bundle' to the product Zod enum
- Add VALID_TIERS entry: `bundle: ['STARTER', 'PRO', 'POWER']`
- Classification uses `compareBundleTiers`
- UPGRADE: immediate Stripe update + sync component tiers via `resolveBundleComponents`
- DOWNGRADE: store pending in DB, apply at renewal

On upgrade, the sellerProfile tier columns must be updated in the same transaction:

```typescript
const components = resolveBundleComponents(targetTier as BundleTier);
await tx.update(sellerProfile).set({
  bundleTier: targetTier as BundleTier,
  storeTier: components.storeTier,
  listerTier: components.listerTier,
  financeTier: components.financeTier,
  hasAutomation: components.hasAutomation,
  updatedAt: new Date(),
}).where(eq(sellerProfile.id, sellerProfileId));
```

### E3: Extend `getSubscriptionSnapshot` for bundles

Add to `SubscriptionSnapshot` type:

```typescript
bundleTier: BundleTier;
bundleSubscription: {
  id: string;
  status: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
} | null;
bundlePendingTier: BundleTier | null;
bundlePendingChangeAt: Date | null;
bundlePendingBillingInterval: 'monthly' | 'annual' | null;
bundleBillingInterval: 'monthly' | 'annual' | null;
```

Add parallel query for `bundleSubscription` (same pattern as store/lister/finance — runs in the existing `Promise.all`).

**STOP after Section E. Report test count and TS errors.**

---

## SECTION F: UI

### F1: Bundle section on subscription overview

Add a "Bundles" section to `subscription-overview.tsx` below individual product cards:

- Show 3 bundle options with name, price, savings badge, components list
- Monthly/annual toggle (shared with individual products)
- "Get Bundle" button → `createBundleCheckout`
- If already bundled: show current bundle card with "Change Bundle" + "Cancel Bundle" buttons

### F2: Finance subscribe button

On the Finance card in subscription overview:
- Show "Subscribe to Finance Pro" button when `financeTier === 'FREE'` AND `bundleTier === 'NONE'`
- Calls `createSubscriptionCheckout({ product: 'finance', tier: 'PRO', billingInterval })`
- Only one paid tier (PRO) — no tier selection needed, just interval toggle

### F3: Bundle indicator on individual product cards

When `bundleTier !== 'NONE'`:
- Show "Included in {bundleName}" badge on each included product card
- Disable individual "Change Plan" / "Cancel" buttons
- Hide individual "Subscribe" buttons

### F4: Update tier-config.ts with BUNDLE_TIERS

```typescript
export const BUNDLE_TIERS = [
  {
    tier: 'STARTER', label: 'Seller Starter',
    monthlyPrice: formatTierPrice('bundle', 'STARTER', 'monthly'),
    annualPrice: formatTierPrice('bundle', 'STARTER', 'annual'),
    annualSavings: getAnnualSavingsPercent('bundle', 'STARTER'),
    components: 'Store Starter + Finance Pro',
    features: ['Branded storefront', 'Full P&L + expense tracking', 'Weekly auto-payout'],
  },
  {
    tier: 'PRO', label: 'Seller Pro',
    monthlyPrice: formatTierPrice('bundle', 'PRO', 'monthly'),
    annualPrice: formatTierPrice('bundle', 'PRO', 'annual'),
    annualSavings: getAnnualSavingsPercent('bundle', 'PRO'),
    components: 'Store Pro + XLister Pro + Finance Pro',
    features: ['Everything in Starter', 'Full crosslister', '2,000 publishes/mo', 'Coupons + bulk tools'],
  },
  {
    tier: 'POWER', label: 'Seller Power',
    monthlyPrice: formatTierPrice('bundle', 'POWER', 'monthly'),
    annualPrice: formatTierPrice('bundle', 'POWER', 'annual'),
    annualSavings: getAnnualSavingsPercent('bundle', 'POWER'),
    components: 'Store Power + XLister Pro + Finance Pro + Automation',
    features: ['Everything in Pro', 'Page builder', 'Auto-relist + smart pricing', 'Daily payout', '25 staff seats'],
  },
];
```

**STOP after Section F. Report test count and TS errors.**

---

## SECTION G: Tests

Target: ≥40 new tests (≥960 total).

### G1: Bundle resolution tests (pure functions, no mocks) — ~10 tests

File: `src/lib/subscriptions/__tests__/bundle-resolution.test.ts`

- resolveBundleComponents for all 4 tiers (NONE, STARTER, PRO, POWER)
- getBundleSavingsCents returns positive for all tiers × both intervals
- compareBundleTiers ordering (STARTER < PRO < POWER)
- classifySubscriptionChange for bundle product (upgrade, downgrade, no_change, blocked)

### G2: Bundle checkout tests (mocked) — ~10 tests

File: `src/lib/actions/__tests__/create-bundle-checkout.test.ts`

- Rejects unauthenticated / no CASL permission / PERSONAL seller
- Rejects if already on active bundle
- Cancels existing individual subs before checkout
- Creates Stripe session with correct price ID and metadata
- Returns checkout URL on success
- Handles Stripe error

### G3: Bundle webhook tests (mocked) — ~8 tests

File: `src/lib/stripe/__tests__/bundle-webhooks.test.ts`

- Bundle created → bundleSubscription row + sellerProfile.bundleTier + component tiers
- Bundle canceled → all tiers revert
- Bundle upgrade → component tiers updated
- Bundle downgrade pending → pendingTier set

### G4: Bundle change plan tests — ~6 tests

Extend `src/lib/actions/__tests__/change-subscription.test.ts`

- Bundle UPGRADE / DOWNGRADE / BLOCKED / NO_CHANGE
- Component tier sync on upgrade

### G5: Snapshot + finance — ~4 tests

- Snapshot includes bundle fields
- Finance subscribe button triggers correct checkout

**STOP after Section G. Report FINAL test count and TS errors.**

---

## ACCEPTANCE CRITERIA

- [ ] TypeScript compiles clean (0 errors)
- [ ] All tests pass (≥960 total)
- [ ] Zero `as any` in new code
- [ ] No file over 300 lines
- [ ] `bundleTierEnum` and `bundleSubscription` table in schema
- [ ] `bundleTier` on sellerProfile (denormalized)
- [ ] Bundle pricing in price-map (6 price IDs)
- [ ] BUNDLE_COMPONENTS returns correct tiers for all 4 values
- [ ] Bundle checkout creates Stripe session with correct metadata
- [ ] Bundle checkout cancels existing individual subs immediately
- [ ] PERSONAL seller blocked from bundle purchase
- [ ] Webhook creates bundleSubscription + sets component tiers + updates sellerProfile
- [ ] Bundle cancel reverts all component tiers at period end
- [ ] Bundle upgrade/downgrade uses D3-S4 classify pattern
- [ ] Finance subscribe button works on subscription overview
- [ ] Bundle cards show with savings badges
- [ ] Individual cards show "Included in Bundle" when bundled
- [ ] SubscriptionSnapshot includes bundle fields

---

## COMMIT MESSAGE

```
feat(subscriptions): D3-S5 — bundles + finance checkout

- bundleSubscription table + bundleTier enum + sellerProfile.bundleTier
- 3 bundles: Starter ($17.99/$24.99), Pro ($59.99/$74.99), Power ($89.99/$109.99)
- Component resolution: Starter=Store+Finance, Pro=+Lister, Power=+Automation
- createBundleCheckout: cancels individual subs, creates bundle Stripe session
- Webhook: bundle events sync component tiers to sellerProfile + subscription tables
- Bundle upgrade/downgrade with proration (D3-S4 pattern)
- Finance subscribe button on subscription overview
- "Included in Bundle" indicators on individual product cards
- N new tests (N total)
```
