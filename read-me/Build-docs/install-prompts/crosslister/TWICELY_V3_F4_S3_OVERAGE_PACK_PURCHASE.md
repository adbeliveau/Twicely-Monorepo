# Install Prompt: F4-S3 — Overage Pack Purchase

**Phase & Step:** `[F4-S3]`
**Depends on:** F4-S1 complete (publish_credit_ledger, rollover-manager with addOverageCredits)
**One-line Summary:** Create server action for purchasing +500 publish credits ($9), add `checkout.session.completed` webhook handler for one-time payments, wire overage credit delivery.

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — §13 (overage packs), §16 (Stripe product mapping: `twicely_overage_pack`)
2. `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` — §7.10 (overage pack settings)
3. `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` — §5.9 (overage pack ledger entry)
4. `TWICELY_V3_DECISION_RATIONALE.md` — §77 (XLister tiers)

---

## 0. PREREQUISITES

```bash
# Verify rollover-manager has addOverageCredits
grep -n "addOverageCredits" src/lib/crosslister/services/rollover-manager.ts

# Verify existing webhook route
ls src/app/api/webhooks/stripe/route.ts 2>/dev/null || ls src/app/api/webhooks/subscriptions/route.ts

# Verify platform settings for overage
grep -n "overage" src/lib/db/seed/*.ts | head -10

# Verify Stripe server module
grep -n "stripe" src/lib/stripe/server.ts | head -3

# Test baseline
npx vitest run 2>&1 | tail -3
```

---

## 1. SCOPE — EXACTLY WHAT TO BUILD

### 1.1 Overage Pack Purchase Action

New file: `src/lib/actions/purchase-overage-pack.ts`

```typescript
'use server';

import { z } from 'zod';

const PurchaseOverageSchema = z.object({
  packType: z.enum(['publishes']),  // Future: 'aiCredits', 'bgRemovals'
}).strict();
```

Flow:
1. Zod validation on input
2. Auth via `auth.api.getSession({ headers: await headers() })`
3. Get `sellerProfileId` from session → `getSellerProfileIdByUserId`
4. Check `sellerProfile.listerTier` is `LITE` or `PRO` — FREE/NONE cannot buy overage
5. Get or create Stripe customer ID (same pattern as `createSubscriptionCheckout`)
6. Read overage price from platform settings: `fees.overage.publishPack.cents` (900 = $9)
7. Read overage quantity from platform settings: `fees.overage.publishPack.quantity` (500)
8. Create Stripe Checkout Session:
   - `mode: 'payment'` (NOT subscription)
   - `line_items: [{ price_data: { currency: 'usd', unit_amount: priceCents, product_data: { name: 'Publish Credits (+500)' } }, quantity: 1 }]`
   - `metadata: { type: 'overage_pack', packType: 'publishes', userId, sellerProfileId, quantity: qty.toString() }`
   - `success_url: ${baseUrl}/my/selling/crosslist?overage=success`
   - `cancel_url: ${baseUrl}/my/selling/crosslist`
9. Return `{ success: true, checkoutUrl: session.url }`

**CRITICAL:** Use `mode: 'payment'`, not `mode: 'subscription'`. This is a one-time purchase.

**CRITICAL:** Wrap Stripe call in try/catch. Return `{ success: false, error: 'Failed to create checkout' }` on failure.

### 1.2 Checkout Webhook Handler

New file: `src/lib/stripe/checkout-webhooks.ts`

This handles `checkout.session.completed` events for one-time payments (NOT subscriptions — those go through the existing subscription webhook handler).

```typescript
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const type = session.metadata?.type;

  switch (type) {
    case 'overage_pack':
      await handleOveragePackPurchase(session);
      break;
    // Future: 'authentication', 'insertion_fee', etc.
    default:
      // Unknown type — log and skip (not an error, could be marketplace checkout)
      console.info(`[checkout-webhook] Unhandled session type: ${type}`);
  }
}
```

**handleOveragePackPurchase:**
1. Extract from metadata: `userId`, `packType`, `quantity`
2. Validate metadata fields exist
3. Get active lister subscription for this user → get `currentPeriodEnd`
4. Call `addOverageCredits(userId, parseInt(quantity), currentPeriodEnd)`
5. Create ledger entry: `OVERAGE_PACK_PURCHASE` with `-900` cents (Finance Engine §5.9)

Idempotency: Use `checkout.session.id` as idempotency key for the ledger entry (`overage:{sessionId}`). If ledger entry already exists, skip.

### 1.3 Wire Checkout Webhook into Route

Modify the existing Stripe webhook route (or create a new one) to handle `checkout.session.completed`:

```typescript
// In the webhook route handler
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  // Only handle one-time payments here
  // Subscription checkouts are handled by subscription webhooks
  if (session.mode === 'payment') {
    await handleCheckoutSessionCompleted(session);
  }
  break;
}
```

**CHECK FIRST:** Does the existing webhook route already handle `checkout.session.completed`? If yes, add the `mode === 'payment'` guard and call the new handler. If no, add the case.

### 1.4 Seed: Verify Overage Settings

Check that these platform settings are already seeded:
```
fees.overage.publishPack.quantity: 500
fees.overage.publishPack.cents: 900
fees.overage.autoMaxPacksPerMonth: 3  // for Phase G auto-purchase
```

If missing, add to seed. If present with different keys (e.g., `overage.publishes.qty`), standardize to `fees.overage.publishPack.*` per Platform Settings Canonical §7.10.

---

## 2. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/lib/actions/purchase-overage-pack.ts` | ~120 | Server action: Stripe checkout for publish credits |
| 2 | `src/lib/stripe/checkout-webhooks.ts` | ~100 | Handler for checkout.session.completed one-time payments |
| 3 | `src/lib/actions/__tests__/purchase-overage-pack.test.ts` | ~200 | 10+ tests |

### Modified Files

| # | File | Change |
|---|------|--------|
| 4 | Stripe webhook route (path TBD — check existing structure) | Add checkout.session.completed routing |
| 5 | `src/lib/db/seed/seed-crosslister.ts` or relevant seed file | Verify/add overage pack settings |

---

## 3. CONSTRAINTS

### DO NOT:
- Use `mode: 'subscription'` for overage packs — must be `mode: 'payment'`
- Allow FREE or NONE tier to purchase overage packs
- Build auto-purchase with configurable cap — that's Phase G
- Build AI credit or BG removal overage packs — only publish credits in F4
- Hardcode overage price or quantity — read from platform_settings
- Build any UI for the overage purchase — that's F4-S4
- Create a ledger entry before payment succeeds — only on webhook confirmation
- Export helpers from the 'use server' file

### Webhook Safety:
- `handleCheckoutSessionCompleted` must be idempotent (check for existing ledger entry)
- `handleOveragePackPurchase` must validate ALL metadata fields before processing
- If `currentPeriodEnd` is null (no active subscription), reject with error log — overage requires active LITE+ subscription
- Wrap external calls in try/catch

---

## 4. TEST REQUIREMENTS

### purchase-overage-pack.test.ts (~10 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Valid LITE seller creates checkout session | success: true, checkoutUrl present |
| 2 | Valid PRO seller creates checkout session | success: true |
| 3 | FREE seller rejected | success: false, error contains 'LITE' |
| 4 | NONE seller rejected | success: false |
| 5 | Unauthenticated user rejected | success: false, error: 'Unauthorized' |
| 6 | Invalid packType rejected by Zod | success: false, error: 'Invalid input' |
| 7 | No seller profile returns error | success: false |
| 8 | Stripe checkout session has mode: 'payment' | Verify mock call args |
| 9 | Metadata includes type: 'overage_pack' | Verify mock call args |
| 10 | Price and quantity from platform_settings | Not hardcoded 900/500 |

### checkout-webhooks (inline or separate test file, ~5 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Overage pack session adds credits | addOverageCredits called with correct args |
| 2 | Duplicate session ID is idempotent | Credits not added twice |
| 3 | Missing metadata fields logged and skipped | No crash |
| 4 | Unknown session type logged and skipped | No crash |
| 5 | No active subscription → error logged | Credits not added |

---

## 5. GUARDRAILS

1. Overage credits expire at `currentPeriodEnd` of the active lister subscription — NOT 60 days from purchase
2. The ledger entry uses idempotency key `overage:{checkout.session.id}` — safe for webhook retries
3. Manual purchase has NO per-month cap. The `fees.overage.autoMaxPacksPerMonth: 3` setting is for Phase G auto-purchase only.
4. `purchase-overage-pack.ts` is a 'use server' file — do NOT export helper functions
5. The checkout webhook handler (`checkout-webhooks.ts`) is NOT a 'use server' file — it's called from the API route

---

## 6. VERIFICATION

```bash
# TypeScript
pnpm typecheck                    # 0 errors

# Tests
pnpm test                         # baseline + ~15 new tests

# File sizes
wc -l src/lib/actions/purchase-overage-pack.ts \
      src/lib/stripe/checkout-webhooks.ts \
      src/lib/actions/__tests__/purchase-overage-pack.test.ts
# ALL under 300 lines

# Banned terms
grep -rn "SellerTier\|SubscriptionTier\|as any\|@ts-ignore" \
  src/lib/actions/purchase-overage-pack.ts \
  src/lib/stripe/checkout-webhooks.ts
# Should be 0

# Verify mode: 'payment'
grep -n "mode.*payment" src/lib/actions/purchase-overage-pack.ts
# Should find the Stripe session creation

# Verify tier gate
grep -n "FREE\|NONE.*cannot\|isPaidListerTier" src/lib/actions/purchase-overage-pack.ts
# Should find the tier check
```

**Stop and report after verification. Do not proceed to F4-S4.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_F4_S3_OVERAGE_PACK_PURCHASE.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md (§13, §16)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md (§7.10)

F4-S1 must be complete before starting. Verify prerequisites in Task 0. Execute all tasks in order. Stop and report after running verification.
```
