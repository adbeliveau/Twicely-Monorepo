# D3-S2 — Stripe Checkout Session + Subscription Webhooks

## READ THIS INSTALL FILE FIRST
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_D3_S2_CHECKOUT_WEBHOOKS.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md (§4 Store, §5 XLister, §6 Finance, §8 Automation, §16 Stripe Product Mapping)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md (§3 subscription tables, §2.3 sellerProfile)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md (§3 trials, §5.1 Stripe integration)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_ACTORS_SECURITY_CANONICAL.md (§2.4 webhook signature validation)
- C:\Users\XPS-15\Projects\Twicely\src\lib\subscriptions\price-map.ts (D3-S1 — pricing maps + helpers)
- C:\Users\XPS-15\Projects\Twicely\src\lib\subscriptions\subscription-engine.ts (D3-S1 — tier comparison + eligibility)
- C:\Users\XPS-15\Projects\Twicely\src\lib\queries\subscriptions.ts (D3-S1 — read queries)
- C:\Users\XPS-15\Projects\Twicely\src\lib\stripe\server.ts (existing Stripe client)
- C:\Users\XPS-15\Projects\Twicely\src\lib\stripe\webhooks.ts (existing marketplace webhook handler — DO NOT MODIFY)
- C:\Users\XPS-15\Projects\Twicely\src\lib\db\schema\subscriptions.ts (Drizzle schema for all 4 tables)
- C:\Users\XPS-15\Projects\Twicely\src\lib\db\schema\identity.ts (sellerProfile columns)

---

## CONTEXT

This is slice 2 of 5 for D3 (Store Subscriptions). It builds the Stripe integration layer:
1. A server action that creates a Stripe Checkout Session for subscription purchases
2. A webhook handler that processes subscription lifecycle events
3. Helper queries needed by the webhook handler

### What D3-S1 already built:
- `price-map.ts` — STORE_PRICING, LISTER_PRICING, FINANCE_PRICING, AUTOMATION_PRICING, BUNDLE_PRICING
- `getStripePriceId(product, tier, interval)` — returns Stripe Price ID
- `resolveStripePriceId(priceId)` — reverse-lookup price ID → product + tier + interval
- `subscription-engine.ts` — compareStoreTiers, canSubscribeToStoreTier, isPaidStoreTier
- `queries/subscriptions.ts` — getSubscriptionSnapshot, getProfileTiers, getSellerProfileIdByUserId

### What this slice does NOT build:
- Upgrade/downgrade (D3-S4)
- Bundle checkout (D3-S5)
- Finance subscription checkout (D3-S5)
- Subscription management UI (D3-S3)
- Billing portal (D3-S4)

---

## CRITICAL GUARDRAILS

1. **DO NOT modify `src/lib/stripe/webhooks.ts`.** That file handles marketplace order webhooks (payment intents, charges, disputes). It is already 323 lines. Subscription webhooks go in a NEW file.
2. **DO NOT modify any existing schema tables.** If `stripeCustomerId` is missing from `sellerProfile`, add it via a NEW migration-safe column addition (see Task 0).
3. **Webhook payloads MUST be verified against Stripe signature.** Never trust unsigned data. Use `stripe.webhooks.constructEvent()`.
4. **All tier changes go through sellerProfile.** When a webhook says "subscription active at PRO tier", update `sellerProfile.storeTier = 'PRO'`. The subscription table is the billing record; sellerProfile is the authorization source.
5. **resolveStripePriceId returns `tier: 'DEFAULT'` for automation.** Your webhook handler must map this to `hasAutomation: true` on sellerProfile, NOT try to look up a tier enum.
6. **Use `metadata` on the Checkout Session** to pass `sellerProfileId` and `product` ('store' | 'lister' | 'automation' | 'finance'). This is how the webhook knows which table to update.
7. **Stripe Price IDs are placeholders** (e.g., `price_store_pro_annual`). Code must work with any string. Do NOT validate format.
8. **All files under 300 lines.** The webhook handler will be the largest — split by event type if needed.
9. **Subscription status enum values:** `ACTIVE`, `PAST_DUE`, `CANCELED`, `PAUSED`, `TRIALING`, `PENDING`. Map Stripe statuses to these.

---

## TASK 0: Schema Pre-Check — stripeCustomerId

**BEFORE writing any code, run this:**

```bash
grep -n "stripeCustomerId\|stripe_customer_id" src/lib/db/schema/identity.ts
```

If `stripeCustomerId` does NOT exist on `sellerProfile`, add it:

**File:** `src/lib/db/schema/identity.ts` (modify)

Add this column to `sellerProfile` after `stripeOnboarded`:

```typescript
stripeCustomerId:  text('stripe_customer_id').unique(),
```

Then run:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

If the column already exists, skip this task entirely.

**Why:** Stripe Checkout Sessions require a Customer ID. When the seller first subscribes, we create a Stripe Customer and store the ID. Subsequent subscriptions reuse it.

---

## TASK 1: Webhook Lookup Queries

**File:** `src/lib/queries/subscription-lookups.ts` (~60 lines, NEW)

These are the queries the webhook handler needs that were NOT in D3-S1.

```typescript
import { db } from '@/lib/db';
import { sellerProfile, storeSubscription, listerSubscription, automationSubscription, financeSubscription } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';

/**
 * Find seller profile by Stripe Customer ID.
 * Used by webhook handler to identify which seller a subscription event belongs to.
 */
export async function findSellerByStripeCustomerId(customerId: string): Promise<{
  sellerProfileId: string;
  userId: string;
  storeTier: string;
  listerTier: string;
  hasAutomation: boolean;
  financeTier: string;
} | null> {
  const [row] = await db
    .select({
      sellerProfileId: sellerProfile.id,
      userId: sellerProfile.userId,
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      hasAutomation: sellerProfile.hasAutomation,
      financeTier: sellerProfile.financeTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.stripeCustomerId, customerId))
    .limit(1);
  return row ?? null;
}

/**
 * Find which subscription table contains a given Stripe subscription ID.
 * Searches all 4 tables. Returns the product type and seller profile ID.
 */
export async function findSubscriptionByStripeId(stripeSubId: string): Promise<{
  product: 'store' | 'lister' | 'automation' | 'finance';
  subscriptionId: string;
  sellerProfileId: string;
} | null>
// Implementation: query each of the 4 tables sequentially (not parallel — we expect
// early match). Check storeSubscription first (most common), then lister, automation, finance.
// Return first match or null.
```

---

## TASK 2: Subscription Mutations

**File:** `src/lib/mutations/subscriptions.ts` (~120 lines, NEW)

Write operations that the webhook handler calls. Separated from queries for clarity.

```typescript
import { db } from '@/lib/db';
import { sellerProfile, storeSubscription, listerSubscription, automationSubscription, financeSubscription } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Create or update a store subscription record from Stripe webhook data.
 * Also updates sellerProfile.storeTier.
 */
export async function upsertStoreSubscription(params: {
  sellerProfileId: string;
  tier: string;
  status: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: Date | null;
}): Promise<void>
// Implementation:
// 1. Check if storeSubscription exists for sellerProfileId
// 2. If exists: UPDATE the row
// 3. If not: INSERT new row
// 4. ALWAYS: UPDATE sellerProfile.storeTier = params.tier
// Use a transaction (db.transaction) to ensure both updates succeed or both fail.

/**
 * Same pattern for lister subscription.
 * Updates sellerProfile.listerTier.
 */
export async function upsertListerSubscription(params: {
  sellerProfileId: string;
  tier: string;
  status: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void>

/**
 * Same pattern for automation subscription.
 * Updates sellerProfile.hasAutomation = (status === 'ACTIVE' || status === 'TRIALING').
 */
export async function upsertAutomationSubscription(params: {
  sellerProfileId: string;
  status: string;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void>

/**
 * Same pattern for finance subscription.
 * Updates sellerProfile.financeTier.
 */
export async function upsertFinanceSubscription(params: {
  sellerProfileId: string;
  tier: string;
  status: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void>

/**
 * Handle subscription cancellation.
 * Sets subscription status = 'CANCELED', canceledAt = now.
 * Reverts sellerProfile tier to free/none.
 */
export async function cancelSubscription(params: {
  product: 'store' | 'lister' | 'automation' | 'finance';
  sellerProfileId: string;
  stripeSubscriptionId: string;
}): Promise<void>
// Implementation:
// 1. Update the subscription table: status = 'CANCELED', canceledAt = now
// 2. Revert the sellerProfile field:
//    - store → storeTier = 'NONE'
//    - lister → listerTier = 'FREE'  (NOT 'NONE' — FREE is the default crosslister tier)
//    - automation → hasAutomation = false
//    - finance → financeTier = 'FREE'
// Use a transaction.

/**
 * Store Stripe Customer ID on seller profile (first-time subscription).
 */
export async function setStripeCustomerId(
  sellerProfileId: string,
  stripeCustomerId: string
): Promise<void>
```

---

## TASK 3: Create Checkout Session Action

**File:** `src/lib/actions/create-subscription-checkout.ts` (~150 lines, NEW)

```typescript
'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe/server';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { getStripePriceId } from '@/lib/subscriptions/price-map';
import { canSubscribeToStoreTier, isPaidStoreTier, isPaidListerTier } from '@/lib/subscriptions/subscription-engine';
import type { BillingInterval, SubscriptionProduct } from '@/lib/subscriptions/price-map';

interface CreateCheckoutInput {
  product: SubscriptionProduct;  // 'store' | 'lister' | 'automation' | 'finance'
  tier: string;                   // e.g., 'PRO', 'LITE', 'DEFAULT' for automation
  interval: BillingInterval;      // 'monthly' | 'annual'
}

interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export async function createSubscriptionCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>
```

**Implementation flow:**

1. **Auth** — get session, get userId
2. **Get sellerProfileId** — via `getSellerProfileIdByUserId(userId)`. Fail if no seller profile.
3. **Eligibility check (store only):**
   - Read sellerProfile to get `sellerType`, `stripeAccountId`, `stripeOnboarded`
   - Call `canSubscribeToStoreTier(tier, { isBusinessSeller: sellerType === 'BUSINESS', hasStripeConnect: !!stripeAccountId && stripeOnboarded, hasIdentityVerified: true })`
   - Note: `hasIdentityVerified: true` for now — KYC enforcement is Phase G
   - If not allowed, return error
4. **Get Stripe Price ID** — `getStripePriceId(product, tier, interval)`. Fail if null.
5. **Get or create Stripe Customer:**
   - Read `sellerProfile.stripeCustomerId`
   - If null: `stripe.customers.create({ email, metadata: { sellerProfileId, userId } })` → store ID via `setStripeCustomerId()`
   - If exists: reuse
6. **Check for existing active subscription** — if they already have an active subscription for this product, return error "Already subscribed. Use upgrade/downgrade instead." (upgrade is D3-S4)
7. **Create Stripe Checkout Session:**
   ```typescript
   const session = await stripe.checkout.sessions.create({
     mode: 'subscription',
     customer: stripeCustomerId,
     line_items: [{ price: stripePriceId, quantity: 1 }],
     success_url: `${baseUrl}/my/selling/subscription?success=true&product=${input.product}`,
     cancel_url: `${baseUrl}/my/selling/subscription?canceled=true`,
     metadata: {
       sellerProfileId,
       product: input.product,
       tier: input.tier,
     },
     subscription_data: {
       metadata: {
         sellerProfileId,
         product: input.product,
         tier: input.tier,
       },
     },
   });
   ```
8. Return `{ success: true, checkoutUrl: session.url }`

**CRITICAL:** The `subscription_data.metadata` is what propagates to the subscription object. The webhook reads metadata FROM THE SUBSCRIPTION, not from the checkout session. Always set metadata on both.

---

## TASK 4: Subscription Webhook Handler

**File:** `src/lib/stripe/subscription-webhooks.ts` (~180 lines, NEW)

This is the core money-path file. It processes Stripe subscription events and updates the database.

```typescript
import Stripe from 'stripe';
import { stripe } from './server';
import { resolveStripePriceId } from '@/lib/subscriptions/price-map';
import { findSellerByStripeCustomerId, findSubscriptionByStripeId } from '@/lib/queries/subscription-lookups';
import {
  upsertStoreSubscription,
  upsertListerSubscription,
  upsertAutomationSubscription,
  upsertFinanceSubscription,
  cancelSubscription,
} from '@/lib/mutations/subscriptions';

// ─── Stripe Status → Twicely Status Mapping ────────────────────────────────

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':        return 'ACTIVE';
    case 'past_due':      return 'PAST_DUE';
    case 'canceled':      return 'CANCELED';
    case 'paused':        return 'PAUSED';
    case 'trialing':      return 'TRIALING';
    case 'incomplete':    return 'PENDING';
    case 'incomplete_expired': return 'CANCELED';
    case 'unpaid':        return 'PAST_DUE';
    default:              return 'PENDING';
  }
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

/**
 * Handle customer.subscription.created and customer.subscription.updated.
 * Both events have the same shape — a full Subscription object.
 */
export async function handleSubscriptionUpsert(subscription: Stripe.Subscription): Promise<void>
```

**Implementation for `handleSubscriptionUpsert`:**

1. Extract `subscription.metadata.sellerProfileId` and `subscription.metadata.product`
2. If metadata is missing, try `findSellerByStripeCustomerId(subscription.customer)` as fallback
3. Get the first item's price: `subscription.items.data[0].price.id`
4. Resolve via `resolveStripePriceId(priceId)` to get product + tier + interval
5. Map Stripe status: `mapStripeStatus(subscription.status)`
6. Route to the correct upsert function based on product:
   - `'store'` → `upsertStoreSubscription({ sellerProfileId, tier, status, stripeSubscriptionId: subscription.id, stripePriceId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, trialEndsAt })`
   - `'lister'` → `upsertListerSubscription(...)`
   - `'automation'` → `upsertAutomationSubscription(...)` — NOTE: no tier field, just status
   - `'finance'` → `upsertFinanceSubscription(...)`
7. If `resolveStripePriceId` returns `tier: 'DEFAULT'` (automation), route to automation handler

```typescript
/**
 * Handle customer.subscription.deleted.
 * Stripe sends this when a subscription is fully canceled (not just cancel_at_period_end).
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void>
```

**Implementation:** Look up which product this subscription belongs to using `findSubscriptionByStripeId(subscription.id)`, then call `cancelSubscription({ product, sellerProfileId, stripeSubscriptionId })`.

```typescript
/**
 * Main webhook dispatcher for subscription events.
 * Called from the API route after signature verification.
 */
export async function handleSubscriptionWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.trial_will_end':
      // TODO: Send "trial ending" notification (needs E1 notification system)
      break;
    default:
      // Ignore unhandled subscription events
      break;
  }
}
```

---

## TASK 5: Webhook API Route

**File:** `src/app/api/webhooks/subscriptions/route.ts` (~50 lines, NEW)

This is a SEPARATE webhook endpoint from the marketplace webhook. Stripe can send different event types to different endpoints.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { handleSubscriptionWebhook } from '@/lib/stripe/subscription-webhooks';

const WEBHOOK_SECRET = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    await handleSubscriptionWebhook(event);
  } catch (err) {
    console.error('Subscription webhook handler error:', err);
    // Return 200 to prevent Stripe from retrying (we log the error)
    // In production, this should go to error monitoring (Sentry/Loki)
  }

  return NextResponse.json({ received: true });
}
```

**CRITICAL:** Return 200 even on handler errors to prevent Stripe retry storms. Log the error for investigation.

---

## TASK 6: Tests

### File: `src/lib/stripe/__tests__/subscription-webhooks.test.ts` (~150 lines, NEW)

Minimum 15 tests:

**mapStripeStatus (5 tests):**
- 'active' → 'ACTIVE'
- 'past_due' → 'PAST_DUE'
- 'trialing' → 'TRIALING'
- 'canceled' → 'CANCELED'
- 'incomplete' → 'PENDING'

**handleSubscriptionUpsert routing (5 tests):**
Mock the mutation functions. Verify correct routing:
- Subscription with metadata `product: 'store', tier: 'PRO'` → calls `upsertStoreSubscription` with tier 'PRO'
- Subscription with metadata `product: 'lister', tier: 'LITE'` → calls `upsertListerSubscription`
- Subscription with metadata `product: 'automation'` → calls `upsertAutomationSubscription`
- Subscription with metadata `product: 'finance', tier: 'PRO'` → calls `upsertFinanceSubscription`
- Subscription with `resolveStripePriceId` returning `tier: 'DEFAULT'` → routes to automation

**handleSubscriptionDeleted (2 tests):**
- Known subscription → calls `cancelSubscription` with correct product
- Unknown subscription (not in any table) → does not throw

**handleSubscriptionWebhook dispatch (3 tests):**
- `customer.subscription.created` → calls handleSubscriptionUpsert
- `customer.subscription.deleted` → calls handleSubscriptionDeleted
- `customer.subscription.trial_will_end` → no-op (no error)

### File: `src/lib/actions/__tests__/create-subscription-checkout.test.ts` (~100 lines, NEW)

Minimum 8 tests:

**Auth/eligibility (4 tests):**
- No session → error 'Unauthorized'
- No seller profile → error
- Store subscription without BUSINESS status → error mentioning 'business'
- Already has active subscription for product → error mentioning 'upgrade/downgrade'

**Checkout creation (4 tests):**
- Valid store PRO monthly → returns checkoutUrl
- Valid lister LITE annual → returns checkoutUrl
- Invalid tier (store NONE) → error
- Metadata includes sellerProfileId and product in subscription_data

---

## FILE MANIFEST

| # | File | Lines | New/Mod |
|---|------|-------|---------|
| 0 | `src/lib/db/schema/identity.ts` | +1 | Mod (stripeCustomerId — ONLY if missing) |
| 1 | `src/lib/queries/subscription-lookups.ts` | ~60 | New |
| 2 | `src/lib/mutations/subscriptions.ts` | ~120 | New |
| 3 | `src/lib/actions/create-subscription-checkout.ts` | ~150 | New |
| 4 | `src/lib/stripe/subscription-webhooks.ts` | ~180 | New |
| 5 | `src/app/api/webhooks/subscriptions/route.ts` | ~50 | New |
| 6 | `src/lib/stripe/__tests__/subscription-webhooks.test.ts` | ~150 | New |
| 7 | `src/lib/actions/__tests__/create-subscription-checkout.test.ts` | ~100 | New |
| **Total** | | **~810** | **7 new, 1 mod** |

---

## GUARDRAILS — READ THESE BEFORE WRITING ANY CODE

1. **DO NOT touch `src/lib/stripe/webhooks.ts`** — that's the marketplace webhook handler.
2. **DO NOT create Stripe Products/Prices in code.** Price IDs come from `price-map.ts`.
3. **DO NOT hardcode any dollar amounts.** Use `getStripePriceId()` from D3-S1.
4. **DO NOT build upgrade/downgrade logic.** If seller already has an active sub for this product, return an error saying "use upgrade". That's D3-S4.
5. **DO NOT build bundle checkout.** That's D3-S5.
6. **DO NOT build any UI pages.** That's D3-S3.
7. **ALWAYS use `db.transaction()`** in mutation functions that update both subscription table + sellerProfile.
8. **ALWAYS verify webhook signature** before processing any event data.
9. **ALWAYS set metadata on `subscription_data`** in the Checkout Session, not just on the session itself.
10. **Return 200 from webhook even on handler errors** — log the error, don't trigger Stripe retries.
11. **Import from `@/lib/db/schema`** barrel export, NOT from individual schema files like `schema/subscriptions.ts`.
12. **cancelSubscription reverts lister to 'FREE' not 'NONE'.** FREE is the default crosslister tier (free tier with limited features). NONE means no crosslister at all.
13. **All files under 300 lines.** If subscription-webhooks.ts is hitting 300, split `handleSubscriptionUpsert` into a separate file.
14. **`STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`** is a SEPARATE env var from the marketplace webhook secret. Two endpoints, two secrets.
15. **Do NOT import `stripe` from `'stripe'` directly.** Import from `@/lib/stripe/server` which is the configured instance.

---

## ENV VARS NEEDED

Add to `.env.example` (do NOT commit real values):

```
# Subscription webhook (separate from marketplace webhook)
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxx
```

---

## VERIFY

```bash
# Task 0: Check if stripeCustomerId was needed
grep -n "stripeCustomerId" src/lib/db/schema/identity.ts

# Standard verification
pnpm typecheck                    # 0 errors
pnpm test                         # all pass, target ≥846 (823 + 23 new)
wc -l src/lib/queries/subscription-lookups.ts src/lib/mutations/subscriptions.ts src/lib/actions/create-subscription-checkout.ts src/lib/stripe/subscription-webhooks.ts src/app/api/webhooks/subscriptions/route.ts src/lib/stripe/__tests__/subscription-webhooks.test.ts src/lib/actions/__tests__/create-subscription-checkout.test.ts
# ALL under 300
./twicely-lint.sh
```

## COMMIT

```bash
git add -A && git commit -m "D3-S2: subscription checkout + webhook handler — Stripe sessions, 4-table upserts, 23+ tests"
```
