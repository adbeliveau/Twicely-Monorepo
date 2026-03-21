# D3-S4: Subscription Upgrade/Downgrade

**Baseline:** 872 tests | 0 TS errors
**Scope:** Upgrade, downgrade, and billing interval change for Store, Lister, Finance, and Automation subscriptions
**Target:** Tests increase. Zero TS errors. Zero `as any`.

---

## READ FIRST

```
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md
C:\Users\XPS-15\Projects\Twicely\Install\D3-S4-UPGRADE-DOWNGRADE.md
src/lib/subscriptions/price-map.ts
src/lib/subscriptions/subscription-engine.ts
src/lib/actions/create-subscription-checkout.ts
src/lib/actions/manage-subscription.ts
src/lib/webhooks/subscription-webhooks.ts
src/lib/queries/subscriptions.ts
src/components/subscription/subscription-card.tsx
src/components/subscription/subscription-overview.tsx
src/db/schema/subscriptions.ts
```

Read EVERY file above before writing ANY code. Do not invent — implement exactly what this prompt says.

---

## DECISIONS (LOCKED)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Proration strategy | `create_prorations` | Stripe default. Fair. No custom math. |
| Billing anchor | Keep original | Predictable billing dates. Stripe default. |
| Monthly↔Annual | Allow mid-cycle | Revenue-positive upsell path. |
| Downgrade timing | At period end | Seller keeps paid features until period expires. |
| Downgrade mechanism | DB `pendingTier` + webhook | Simpler than Stripe Subscription Schedules. |

---

## TIER ORDERING (source of truth for upgrade/downgrade classification)

```typescript
// Store: NONE < STARTER < PRO < POWER < ENTERPRISE
const STORE_TIER_ORDER = ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'] as const;

// Lister: NONE < FREE < LITE < PRO
const LISTER_TIER_ORDER = ['NONE', 'FREE', 'LITE', 'PRO'] as const;
```

These orderings already exist in subscription-engine.ts via `compareStoreTiers()` and `compareListerTiers()`. Use them. Do not create a parallel ordering.

---

## CHANGE CLASSIFICATION

Every subscription change falls into exactly one of these categories:

| Change | Classification | Stripe Behavior | DB Behavior |
|--------|---------------|-----------------|-------------|
| Lower tier → Higher tier | **UPGRADE** | `subscriptions.update()` with new price, `proration_behavior: 'create_prorations'` | Update `tier` + `stripePriceId` immediately |
| Higher tier → Lower tier | **DOWNGRADE** | No Stripe call yet | Set `pendingTier` + `pendingChangeAt` = `currentPeriodEnd` |
| Monthly → Annual (same tier) | **INTERVAL_UPGRADE** | `subscriptions.update()` with annual price, `proration_behavior: 'create_prorations'` | Update `stripePriceId` immediately |
| Annual → Monthly (same tier) | **INTERVAL_DOWNGRADE** | No Stripe call yet | Set `pendingBillingInterval: 'monthly'` + `pendingChangeAt` = `currentPeriodEnd` |
| Same tier, same interval | **NO_CHANGE** | Reject | Reject |
| Any tier → ENTERPRISE | **BLOCKED** | N/A | Show "Contact sales" |
| ENTERPRISE → Any tier | **BLOCKED** | N/A | Show "Contact sales" |
| Any tier → NONE | **CANCEL** | Already handled by D3-S3 cancel flow | Use existing `cancelSubscriptionAction()` |

**Combined changes** (e.g., PRO monthly → POWER annual): Classify by tier direction. If tier goes up, it's an UPGRADE regardless of interval change. If tier stays same and interval changes, classify by interval direction.

Priority: tier direction > interval direction.

---

## SECTION A: Schema Migration

### New columns on `store_subscription`:

```typescript
pendingTier:             storeTierEnum('pending_tier'),                              // nullable
pendingBillingInterval:  text('pending_billing_interval'),                           // nullable, 'monthly' | 'annual'
pendingChangeAt:         timestamp('pending_change_at', { withTimezone: true }),      // nullable
```

### New columns on `lister_subscription`:

```typescript
pendingTier:             listerTierEnum('pending_tier'),                             // nullable
pendingBillingInterval:  text('pending_billing_interval'),                           // nullable, 'monthly' | 'annual'
pendingChangeAt:         timestamp('pending_change_at', { withTimezone: true }),      // nullable
```

### New columns on `finance_subscription` (if table exists, same pattern):

```typescript
pendingTier:             financeTierEnum('pending_tier'),                            // nullable
pendingBillingInterval:  text('pending_billing_interval'),                           // nullable
pendingChangeAt:         timestamp('pending_change_at', { withTimezone: true }),      // nullable
```

### Migration rules:
- All three columns are nullable (no default needed — null means no pending change)
- Add columns to existing tables. Do NOT create new tables.
- Run `npx drizzle-kit generate` then `npx drizzle-kit push`
- Verify `npx tsc --noEmit` passes

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/db/schema/subscriptions.ts` | ADD 3 columns to each subscription table |

**STOP after Section A. Run `npx tsc --noEmit` and `npx vitest run`. Report results. Wait for approval.**

---

## SECTION B: Subscription Engine — Change Classification

Add to `src/lib/subscriptions/subscription-engine.ts`:

### B1: `classifySubscriptionChange()`

```typescript
type ChangeClassification =
  | 'UPGRADE'
  | 'DOWNGRADE'
  | 'INTERVAL_UPGRADE'
  | 'INTERVAL_DOWNGRADE'
  | 'NO_CHANGE'
  | 'BLOCKED';

interface ChangeRequest {
  product: 'store' | 'lister' | 'finance';
  currentTier: string;
  currentInterval: 'monthly' | 'annual';
  targetTier: string;
  targetInterval: 'monthly' | 'annual';
}

function classifySubscriptionChange(req: ChangeRequest): ChangeClassification
```

Logic:
1. If `currentTier === targetTier && currentInterval === targetInterval` → `NO_CHANGE`
2. If `targetTier === 'ENTERPRISE'` or `currentTier === 'ENTERPRISE'` → `BLOCKED`
3. If `targetTier === 'NONE'` → `BLOCKED` (use cancel flow instead)
4. Compare tiers using existing `compareStoreTiers()` / `compareListerTiers()`:
   - Target > Current → `UPGRADE` (regardless of interval change)
   - Target < Current → `DOWNGRADE` (regardless of interval change)
   - Target === Current AND `monthly → annual` → `INTERVAL_UPGRADE`
   - Target === Current AND `annual → monthly` → `INTERVAL_DOWNGRADE`

### B2: `getChangePreview()`

```typescript
interface ChangePreview {
  classification: ChangeClassification;
  currentPriceCents: number;
  targetPriceCents: number;
  savingsPerMonthCents: number;    // positive = saves money, negative = costs more
  effectiveDate: 'immediate' | Date;  // Date = period end for downgrades
  warnings: string[];              // from existing getDowngradeWarnings() for downgrades
}

function getChangePreview(req: ChangeRequest & { currentPeriodEnd: Date }): ChangePreview
```

Logic:
- Use `price-map.ts` functions (`formatTierPrice`, `getStripePriceId`) to get pricing
- For UPGRADE/INTERVAL_UPGRADE: `effectiveDate = 'immediate'`
- For DOWNGRADE/INTERVAL_DOWNGRADE: `effectiveDate = currentPeriodEnd`
- For DOWNGRADE: populate `warnings` from existing `getDowngradeWarnings()`
- `savingsPerMonthCents`: compare monthly cost of current vs target (use annual/12 for annual plans)

### B3: `getBillingIntervalFromPriceId()`

```typescript
function getBillingIntervalFromPriceId(stripePriceId: string): 'monthly' | 'annual' | null
```

Reverse lookup from the STRIPE_PRICE_IDS map in price-map.ts. Returns the billing interval for a given Stripe price ID.

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/lib/subscriptions/subscription-engine.ts` | ADD classifySubscriptionChange, getChangePreview, getBillingIntervalFromPriceId |

**STOP after Section B. Run `npx tsc --noEmit` and `npx vitest run`. Report results. Wait for approval.**

---

## SECTION C: Server Action — `changeSubscription()`

Create `src/lib/actions/change-subscription.ts`:

### Zod schema:

```typescript
const changeSubscriptionSchema = z.object({
  product: z.enum(['store', 'lister', 'finance']),
  targetTier: z.string(),
  targetInterval: z.enum(['monthly', 'annual']),
});
```

### Server action: `changeSubscriptionAction()`

```typescript
'use server'

export async function changeSubscriptionAction(input: z.infer<typeof changeSubscriptionSchema>): Promise<{
  success: boolean;
  error?: string;
  classification?: ChangeClassification;
  effectiveDate?: string;
}>
```

Logic:

1. **Auth check:** Get session. Reject if not authenticated.
2. **Ownership check:** Get seller profile by `session.userId`. Reject if not seller.
3. **Get current state:** Query the relevant subscription table (store/lister/finance) by `sellerProfileId`.
4. **Get current interval:** Call `getBillingIntervalFromPriceId(subscription.stripePriceId)`.
5. **Classify:** Call `classifySubscriptionChange()`.
6. **Guard checks:**
   - `NO_CHANGE` → return error "You're already on this plan"
   - `BLOCKED` → return error "Contact sales for Enterprise changes"
   - Store upgrade + seller is PERSONAL → return error "Upgrade to Business first" (per User Model §15.3)
7. **UPGRADE or INTERVAL_UPGRADE:**
   ```typescript
   // Get the Stripe subscription item ID
   const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
   const itemId = stripeSubscription.items.data[0].id;
   const newPriceId = getStripePriceId(product, targetTier, targetInterval);

   await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
     items: [{ id: itemId, price: newPriceId }],
     proration_behavior: 'create_prorations',
   });

   // Update local DB immediately
   await db.update(subscriptionTable)
     .set({
       tier: targetTier,
       stripePriceId: newPriceId,
       // Clear any pending downgrade
       pendingTier: null,
       pendingBillingInterval: null,
       pendingChangeAt: null,
       updatedAt: new Date(),
     })
     .where(eq(subscriptionTable.id, subscription.id));

   return { success: true, classification: 'UPGRADE', effectiveDate: 'now' };
   ```

8. **DOWNGRADE or INTERVAL_DOWNGRADE:**
   ```typescript
   // Do NOT call Stripe yet — store pending change in DB
   const pendingData: Record<string, unknown> = {
     pendingChangeAt: subscription.currentPeriodEnd,
     updatedAt: new Date(),
   };

   if (classification === 'DOWNGRADE') {
     pendingData.pendingTier = targetTier;
     // If interval also changed, store that too
     if (targetInterval !== currentInterval) {
       pendingData.pendingBillingInterval = targetInterval;
     }
   } else {
     // INTERVAL_DOWNGRADE — tier stays same, only interval changes
     pendingData.pendingBillingInterval = targetInterval;
   }

   await db.update(subscriptionTable)
     .set(pendingData)
     .where(eq(subscriptionTable.id, subscription.id));

   return {
     success: true,
     classification,
     effectiveDate: subscription.currentPeriodEnd.toISOString(),
   };
   ```

9. **Wrap all Stripe calls in try/catch.** Return `{ success: false, error: message }` on failure.

### Cancel pending downgrade:

```typescript
export async function cancelPendingChangeAction(input: {
  product: 'store' | 'lister' | 'finance';
}): Promise<{ success: boolean; error?: string }>
```

Logic: Clear `pendingTier`, `pendingBillingInterval`, `pendingChangeAt` on the subscription row. No Stripe call needed. Auth + ownership check required.

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/lib/actions/change-subscription.ts` | NEW — changeSubscriptionAction, cancelPendingChangeAction |

**STOP after Section C. Run `npx tsc --noEmit` and `npx vitest run`. Report results. Wait for approval.**

---

## SECTION D: Webhook Handler — Apply Pending Downgrades at Renewal

Update `src/lib/webhooks/subscription-webhooks.ts`:

### D1: On `customer.subscription.updated` event

After existing handler logic, add a check for pending downgrades:

```typescript
// After processing the normal subscription update...
// Check if this renewal should trigger a pending downgrade

async function applyPendingDowngradeIfNeeded(
  stripeSubscriptionId: string,
  stripeSubscription: Stripe.Subscription
): Promise<void>
```

Logic:

1. Look up the local subscription by `stripeSubscriptionId` (check all three tables: store, lister, finance).
2. If `pendingTier` is null AND `pendingBillingInterval` is null → return (no pending change).
3. If `pendingChangeAt` is in the future → return (not yet time).
4. **Apply the downgrade via Stripe:**
   ```typescript
   const itemId = stripeSubscription.items.data[0].id;
   const newPriceId = getStripePriceId(product, pendingTier ?? currentTier, pendingBillingInterval ?? currentInterval);

   await stripe.subscriptions.update(stripeSubscriptionId, {
     items: [{ id: itemId, price: newPriceId }],
     proration_behavior: 'none', // No proration — this is the new period
   });
   ```
5. **Update local DB:**
   ```typescript
   await db.update(subscriptionTable).set({
     tier: pendingTier ?? currentTier,
     stripePriceId: newPriceId,
     pendingTier: null,
     pendingBillingInterval: null,
     pendingChangeAt: null,
     updatedAt: new Date(),
   }).where(eq(subscriptionTable.stripeSubscriptionId, stripeSubscriptionId));
   ```
6. Also update `sellerProfile` tier field if the subscription table has a corresponding column there (store → `storeTier`, lister → `listerTier`).

### D2: On `customer.subscription.deleted` event

If a subscription is deleted (e.g., cancel at period end fires), also clear any pending downgrade columns:

```typescript
// In existing deleted handler, add:
pendingTier: null,
pendingBillingInterval: null,
pendingChangeAt: null,
```

### D3: Lister cancel revert

Existing behavior: lister cancel reverts to FREE, not NONE. Verify this still works with the new pending columns. A canceled lister subscription with `pendingTier` should have the pending cleared — cancellation supersedes downgrade.

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/lib/webhooks/subscription-webhooks.ts` | MODIFY — add applyPendingDowngradeIfNeeded, update deleted handler |

**STOP after Section D. Run `npx tsc --noEmit` and `npx vitest run`. Report results. Wait for approval.**

---

## SECTION E: Queries — Extend SubscriptionSnapshot

Update `src/lib/queries/subscriptions.ts`:

### E1: Extend `SubscriptionSnapshot` type

Add to the existing SubscriptionSnapshot type (whether it's flat or nested — match the existing shape):

```typescript
// Pending downgrade info per product
storePendingTier: StoreTier | null;
storePendingChangeAt: Date | null;
storePendingBillingInterval: 'monthly' | 'annual' | null;

listerPendingTier: ListerTier | null;
listerPendingChangeAt: Date | null;
listerPendingBillingInterval: 'monthly' | 'annual' | null;

financePendingTier: 'FREE' | 'PRO' | null;
financePendingChangeAt: Date | null;
financePendingBillingInterval: 'monthly' | 'annual' | null;

// Current billing intervals (derived from stripePriceId)
storeBillingInterval: 'monthly' | 'annual' | null;
listerBillingInterval: 'monthly' | 'annual' | null;
financeBillingInterval: 'monthly' | 'annual' | null;
```

### E2: Update `getSubscriptionSnapshot()` query

Include the new columns in the query. Derive billing interval from `stripePriceId` using `getBillingIntervalFromPriceId()`.

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/lib/queries/subscriptions.ts` | MODIFY — extend snapshot type and query |

**STOP after Section E. Run `npx tsc --noEmit` and `npx vitest run`. Report results. Wait for approval.**

---

## SECTION F: UI — Change Plan Dialog + Pending Banner

### F1: Create `src/components/subscription/change-plan-dialog.tsx`

A dialog that shows when the seller clicks "Change Plan" on a subscription card.

**Props:**
```typescript
interface ChangePlanDialogProps {
  product: 'store' | 'lister' | 'finance';
  currentTier: string;
  currentInterval: 'monthly' | 'annual';
  currentPeriodEnd: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Content:**
1. Title: "Change {Product} Plan"
2. Available tiers grid (exclude NONE, ENTERPRISE, current tier):
   - For each tier: name, monthly price, annual price, key features summary
   - Highlight if annual saves money: "Save {X}% with annual billing"
3. Billing interval toggle: Monthly | Annual
4. Change preview section (computed from `getChangePreview`):
   - Classification badge: "Upgrade — effective immediately" or "Downgrade — effective {date}"
   - Price difference: "+$X/mo" or "-$X/mo"
   - For downgrades: warning list from `getDowngradeWarnings()`
5. Confirm button:
   - Upgrade: "Upgrade to {Tier}" (primary button, purple #7C3AED)
   - Downgrade: "Schedule Downgrade" (secondary/warning style)
6. Loading state on confirm. `finally` block to reset loading.
7. Toast on success. Router refresh.

### F2: Update `src/components/subscription/subscription-card.tsx`

1. **Enable "Change Plan" button.** Remove the disabled state and "Coming soon" tooltip.
2. Wire button to open `ChangePlanDialog` with current subscription data.
3. **Add pending downgrade banner** inside the card when `pendingTier` or `pendingBillingInterval` is set:
   ```
   ┌──────────────────────────────────────────┐
   │ ⚠️ Changing to {PendingTier} on {date}   │
   │                          [Cancel Change]  │
   └──────────────────────────────────────────┘
   ```
   "Cancel Change" calls `cancelPendingChangeAction()`.

### F3: Update `src/components/subscription/subscription-overview.tsx`

Pass the new pending fields and billing interval fields through to the subscription cards.

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/components/subscription/change-plan-dialog.tsx` | NEW |
| 2 | `src/components/subscription/subscription-card.tsx` | MODIFY — enable Change Plan, add pending banner |
| 3 | `src/components/subscription/subscription-overview.tsx` | MODIFY — pass new fields |

**STOP after Section F. Run `npx tsc --noEmit` and `npx vitest run`. Report results. Wait for approval.**

---

## SECTION G: Tests

### G1: Unit tests — `subscription-engine.test.ts`

Add to existing test file (or create if not present):

```typescript
describe('classifySubscriptionChange', () => {
  // UPGRADE cases
  it('classifies STARTER → PRO as UPGRADE', () => { ... });
  it('classifies PRO → POWER as UPGRADE', () => { ... });
  it('classifies FREE → LITE as UPGRADE (lister)', () => { ... });
  it('classifies LITE → PRO as UPGRADE (lister)', () => { ... });

  // DOWNGRADE cases
  it('classifies POWER → PRO as DOWNGRADE', () => { ... });
  it('classifies PRO → STARTER as DOWNGRADE', () => { ... });
  it('classifies PRO → LITE as DOWNGRADE (lister)', () => { ... });

  // INTERVAL changes
  it('classifies monthly → annual (same tier) as INTERVAL_UPGRADE', () => { ... });
  it('classifies annual → monthly (same tier) as INTERVAL_DOWNGRADE', () => { ... });

  // Combined changes — tier wins
  it('classifies PRO monthly → POWER annual as UPGRADE (tier wins)', () => { ... });
  it('classifies POWER annual → PRO monthly as DOWNGRADE (tier wins)', () => { ... });

  // Edge cases
  it('classifies same tier same interval as NO_CHANGE', () => { ... });
  it('classifies any → ENTERPRISE as BLOCKED', () => { ... });
  it('classifies ENTERPRISE → any as BLOCKED', () => { ... });
  it('classifies any → NONE as BLOCKED (use cancel)', () => { ... });
});

describe('getChangePreview', () => {
  it('returns immediate effectiveDate for UPGRADE', () => { ... });
  it('returns period end date for DOWNGRADE', () => { ... });
  it('returns positive savings for monthly → annual', () => { ... });
  it('returns negative savings for annual → monthly', () => { ... });
  it('includes downgrade warnings for DOWNGRADE', () => { ... });
});

describe('getBillingIntervalFromPriceId', () => {
  it('returns monthly for monthly store price IDs', () => { ... });
  it('returns annual for annual store price IDs', () => { ... });
  it('returns null for unknown price ID', () => { ... });
});
```

**Minimum: 20 test cases for classification + preview + interval lookup.**

### G2: Unit tests — `change-subscription.test.ts`

```typescript
describe('changeSubscriptionAction', () => {
  it('rejects unauthenticated users', () => { ... });
  it('rejects non-sellers', () => { ... });
  it('rejects PERSONAL seller trying to upgrade store', () => { ... });
  it('calls stripe.subscriptions.update on UPGRADE with create_prorations', () => { ... });
  it('updates local DB tier immediately on UPGRADE', () => { ... });
  it('clears pending fields on UPGRADE', () => { ... });
  it('does NOT call Stripe on DOWNGRADE', () => { ... });
  it('sets pendingTier and pendingChangeAt on DOWNGRADE', () => { ... });
  it('returns error for NO_CHANGE', () => { ... });
  it('returns error for ENTERPRISE (BLOCKED)', () => { ... });
  it('wraps Stripe errors in try/catch', () => { ... });
});

describe('cancelPendingChangeAction', () => {
  it('clears pending fields', () => { ... });
  it('rejects unauthenticated users', () => { ... });
  it('rejects non-owner', () => { ... });
});
```

**Minimum: 14 test cases.**

### G3: Unit tests — webhook pending downgrade

Add to existing webhook test file:

```typescript
describe('applyPendingDowngradeIfNeeded', () => {
  it('does nothing when no pending change exists', () => { ... });
  it('does nothing when pendingChangeAt is in the future', () => { ... });
  it('calls stripe.subscriptions.update with new price and proration_behavior: none', () => { ... });
  it('clears pending fields after applying downgrade', () => { ... });
  it('updates seller profile tier on store downgrade', () => { ... });
  it('cancellation clears pending downgrade', () => { ... });
});
```

**Minimum: 6 test cases.**

**Total new tests: ≥ 40.**

### Files:
| # | Path | Action |
|---|------|--------|
| 1 | `src/lib/subscriptions/__tests__/subscription-engine.test.ts` | ADD or extend — 20+ tests |
| 2 | `src/lib/actions/__tests__/change-subscription.test.ts` | NEW — 14+ tests |
| 3 | `src/lib/webhooks/__tests__/subscription-webhooks.test.ts` | ADD — 6+ tests |

**STOP after Section G. Run `npx tsc --noEmit` and `npx vitest run`. Report FULL test count (must be ≥ 912). Wait for approval.**

---

## ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | TypeScript compiles clean | `npx tsc --noEmit` → 0 errors |
| 2 | All tests pass | `npx vitest run` → 0 failures |
| 3 | Test count ≥ 912 | `npx vitest run 2>&1 \| grep "Tests"` |
| 4 | Zero `as any` in new code | `grep -rn "as any" src/lib/actions/change-subscription.ts src/lib/subscriptions/subscription-engine.ts src/components/subscription/change-plan-dialog.tsx` |
| 5 | UPGRADE calls Stripe immediately | Verify `stripe.subscriptions.update` with `proration_behavior: 'create_prorations'` |
| 6 | DOWNGRADE stores pending in DB | Verify DB write with `pendingTier` + `pendingChangeAt`, NO Stripe call |
| 7 | Monthly→Annual is INTERVAL_UPGRADE | Test case passes |
| 8 | Annual→Monthly is INTERVAL_DOWNGRADE | Test case passes |
| 9 | Tier direction wins over interval direction | PRO monthly → POWER annual = UPGRADE (test passes) |
| 10 | ENTERPRISE is BLOCKED in both directions | Test cases pass |
| 11 | NONE target is BLOCKED (use cancel) | Test case passes |
| 12 | Webhook applies pending downgrade at renewal | Test case with `proration_behavior: 'none'` |
| 13 | Cancel clears pending downgrade fields | Test case passes |
| 14 | Pending banner shows on subscription card | Visual: card shows "Changing to X on Y" |
| 15 | Change Plan button is enabled | Visual: no more "Coming soon" tooltip |
| 16 | Change Plan dialog shows preview | Visual: classification, price diff, warnings for downgrades |
| 17 | PERSONAL seller blocked from store upgrade | Test case passes |
| 18 | No file over 300 lines | `find src -name "*.ts" -o -name "*.tsx" \| xargs wc -l \| sort -rn \| head -10` |

---

## COMMIT MESSAGE

```
feat(subscriptions): D3-S4 — upgrade/downgrade with proration

- classifySubscriptionChange() — UPGRADE/DOWNGRADE/INTERVAL_UPGRADE/INTERVAL_DOWNGRADE/NO_CHANGE/BLOCKED
- getChangePreview() — pricing diff, effective date, warnings
- changeSubscriptionAction() — Stripe update for upgrades, DB pending for downgrades
- cancelPendingChangeAction() — clear pending downgrade
- Webhook: applyPendingDowngradeIfNeeded() on subscription renewal
- Schema: pendingTier, pendingBillingInterval, pendingChangeAt on all subscription tables
- UI: ChangePlanDialog, enabled Change Plan button, pending downgrade banner
- 40+ new tests ({ACTUAL_COUNT} total)
```

Replace `{ACTUAL_COUNT}` with actual test count from vitest output.

---

## WHAT NOT TO DO

❌ Do NOT use Stripe Subscription Schedules — we use DB pending + webhook
❌ Do NOT call `stripe.subscriptions.cancel()` for downgrades — that's the cancel flow (D3-S3)
❌ Do NOT apply downgrades immediately — seller keeps features until period end
❌ Do NOT hardcode any pricing — use price-map.ts functions
❌ Do NOT create a separate "change request" table — use columns on existing subscription tables
❌ Do NOT allow changes to/from ENTERPRISE — "Contact sales"
❌ Do NOT allow target tier = NONE — that's cancellation, use existing cancel flow
❌ Do NOT forget try/catch on every Stripe call
❌ Do NOT forget `finally` block on loading state in UI
❌ Do NOT use `as any` — zero exceptions in non-test code
❌ Do NOT create files over 300 lines
