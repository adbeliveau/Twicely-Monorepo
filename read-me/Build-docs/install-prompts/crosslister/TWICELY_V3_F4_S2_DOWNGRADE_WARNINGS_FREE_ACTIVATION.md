# Install Prompt: F4-S2 — Downgrade Warnings, FREE Activation, Webhook Wiring

**Phase & Step:** `[F4-S2]`
**Depends on:** F4-S1 complete (publish_credit_ledger table, rollover-manager, updated publish-meter)
**One-line Summary:** Add lister-specific downgrade warnings to subscription engine, auto-activate FREE tier on first import, wire rollover credit management into subscription webhooks (period renewal adds credits, cancellation forfeits credits).

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — §6 (XLister pricing, rollover rules)
2. `TWICELY_V3_LISTER_CANONICAL.md` — §7.3 (publish limits, rollover)
3. `TWICELY_V3_DECISION_RATIONALE.md` — §77 (XLister tiers), §93-97 (proration, downgrade timing)
4. `TWICELY_V3_USER_MODEL.md` — §4.2 (crosslister axis independence)
5. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — §12 (free import rules)

---

## 0. PREREQUISITES

```bash
# Verify F4-S1 is complete
grep -n "publishCreditLedger\|publish_credit_ledger" src/lib/db/schema/crosslister-credits.ts | head -5
grep -n "addMonthlyCredits\|consumeCredits\|forfeitAllCredits" src/lib/crosslister/services/rollover-manager.ts | head -5
grep -n "getAvailableCredits" src/lib/crosslister/services/publish-meter.ts | head -3

# Verify subscription-webhooks handles lister product
grep -n "case 'lister'" src/lib/stripe/subscription-webhooks.ts

# Verify import-service exists
ls src/lib/crosslister/services/import-service.ts

# Test baseline
npx vitest run 2>&1 | tail -3
```

Record baseline. All tests must pass at end.

---

## 1. SCOPE — EXACTLY WHAT TO BUILD

### 1.1 Lister Downgrade Warnings

New file: `src/lib/subscriptions/lister-downgrade-warnings.ts`

```typescript
export interface ListerDowngradeContext {
  currentListerTier: ListerTier;
  targetListerTier: ListerTier;
  currentPublishUsage: number;     // used this billing period
  currentRolloverBalance: number;  // from publish-meter
  connectedPlatformCount: number;  // active crosslister_account rows
}

export interface ListerDowngradeWarning {
  feature: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export function getListerDowngradeWarnings(ctx: ListerDowngradeContext): ListerDowngradeWarning[]
```

Warning generation rules (all publish limits from `xlister.publishes.*` platform settings):

| From → To | Warning | Severity |
|-----------|---------|----------|
| PRO → LITE | "Your monthly publish limit drops from 2,000 to 200. You have {usedThisMonth} publishes used this period." | warning |
| PRO → LITE | "Your rollover credit cap drops from 6,000 to 600. You will lose {excess} rollover credits." (only if rolloverBalance > 600) | warning |
| PRO → FREE | "Your monthly publish limit drops from 2,000 to 25." | warning |
| LITE → FREE | "Your monthly publish limit drops from 200 to 25." | warning |
| Any paid → FREE | "Rollover credits will be forfeited. You will lose {rolloverBalance} unused rollover credits." (only if rolloverBalance > 0) | critical |
| Any paid → FREE | "AI credits and background removals will no longer be available." | info |
| Any → NONE | "You will lose all crosslisting capabilities. Active projections will remain on external platforms but cannot be updated or managed." | critical |
| Same tier | No warnings (return empty array) | — |
| Upgrade direction | No warnings (return empty array) | — |

Use `compareListerTiers()` from `subscription-engine.ts` to determine direction. If target >= current, return empty.

### 1.2 Wire Lister Warnings into Subscription Engine

Modify: `src/lib/subscriptions/subscription-engine.ts`

Add export: `getListerDowngradeWarnings` (re-export from lister-downgrade-warnings.ts)

Update `getChangePreview` (if it exists) or the D3-S4 change preview logic to include lister warnings when `product === 'lister'`.

### 1.3 FREE Tier Auto-Activation on First Import

Modify: `src/lib/crosslister/services/import-service.ts`

After a successful import batch reaches COMPLETED status:

```typescript
// After successful import completion
if (importBatch.status === 'COMPLETED') {
  const [profile] = await db
    .select({ listerTier: sellerProfile.listerTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, importBatch.sellerId))
    .limit(1);

  if (profile?.listerTier === 'NONE') {
    await db.update(sellerProfile)
      .set({ listerTier: 'FREE', updatedAt: new Date() })
      .where(eq(sellerProfile.userId, importBatch.sellerId));
    // No lister_subscription row created — FREE is $0, no Stripe product
    // No publish credits added — FREE credits are added on first canPublish check
  }
}
```

Key rules:
- Only triggers when `listerTier === 'NONE'`
- Already FREE/LITE/PRO → no change
- No `lister_subscription` row created for FREE tier
- No Stripe subscription for FREE tier
- `sellerProfile.listerTier = 'FREE'` is the only DB change

### 1.4 Webhook Rollover Wiring

Modify: `src/lib/stripe/subscription-webhooks.ts`

**On period renewal (subscription.updated with new period dates):**

In the existing `case 'lister'` block inside `handleSubscriptionUpsert`:

```typescript
case 'lister': {
  await upsertListerSubscription({ ... });

  // Detect period renewal: new periodStart > old periodStart
  // The webhook payload has the new period dates
  if (status === 'ACTIVE' || status === 'TRIALING') {
    // Add monthly credits for the new period
    // Need to resolve userId from sellerProfileId
    const userId = await getUserIdFromSellerProfileId(sellerProfileId);
    if (userId) {
      await addMonthlyCredits(
        userId,
        tier as ListerTier,
        currentPeriodStart,
        currentPeriodEnd,
        listerSubscriptionId,  // from upsert result
      );
    }
  }
  break;
}
```

**IMPORTANT:** Period renewal detection. Stripe fires `customer.subscription.updated` on every change — not just renewals. To detect a renewal specifically, compare the new `current_period_start` with the subscription's previous period. Options:
- (A) Check if a MONTHLY credit entry already exists for this `periodStart` — if yes, skip (idempotent)
- (B) Use the Stripe event's `previous_attributes` to detect period change

**Recommendation:** Option A — check for existing credit entry with same `userId + periodStart`. This is idempotent and safe for webhook retries. Use:

```typescript
const existing = await db.select({ id: publishCreditLedger.id })
  .from(publishCreditLedger)
  .where(and(
    eq(publishCreditLedger.userId, userId),
    eq(publishCreditLedger.creditType, 'MONTHLY'),
    eq(publishCreditLedger.periodStart, currentPeriodStart),
  ))
  .limit(1);

if (existing.length === 0) {
  await addMonthlyCredits(userId, tier, currentPeriodStart, currentPeriodEnd, subId);
}
```

**On subscription.deleted (lister cancellation):**

In the existing `handleSubscriptionDeleted` handler:

```typescript
if (result.product === 'lister') {
  const userId = await getUserIdFromSellerProfileId(result.sellerProfileId);
  if (userId) {
    await forfeitAllCredits(userId);
  }
  // sellerProfile.listerTier reverts to FREE (not NONE) — handled by cancelSubscription mutation
}
```

### 1.5 Helper: getUserIdFromSellerProfileId

If this doesn't already exist, add to `src/lib/queries/subscriptions.ts` (or the closest lookup file):

```typescript
export async function getUserIdFromSellerProfileId(sellerProfileId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: sellerProfile.userId })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);
  return row?.userId ?? null;
}
```

Check if this already exists before creating it.

---

## 2. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/lib/subscriptions/lister-downgrade-warnings.ts` | ~120 | Lister-specific downgrade warning generation |
| 2 | `src/lib/subscriptions/__tests__/lister-downgrade-warnings.test.ts` | ~180 | 12+ tests |
| 3 | `src/lib/crosslister/services/__tests__/free-tier-activation.test.ts` | ~150 | 8+ tests |
| 4 | `src/lib/stripe/__tests__/lister-subscription-webhooks.test.ts` | ~200 | 10+ tests for rollover wiring |

### Modified Files

| # | File | Change |
|---|------|--------|
| 5 | `src/lib/subscriptions/subscription-engine.ts` | Re-export `getListerDowngradeWarnings` |
| 6 | `src/lib/crosslister/services/import-service.ts` | Add FREE tier auto-activation after import completion |
| 7 | `src/lib/stripe/subscription-webhooks.ts` | Add rollover credit management on lister renewal + cancel |
| 8 | `src/lib/queries/subscriptions.ts` | Add `getUserIdFromSellerProfileId` if not exists |

---

## 3. CONSTRAINTS

### DO NOT:
- Create a `lister_subscription` row for FREE tier — FREE is just sellerProfile.listerTier
- Create Stripe subscriptions for FREE tier
- Add overage pack handling — that's F4-S3
- Build any UI — that's F4-S4
- Modify the publish-meter — that was F4-S1
- Add monthly credits for FREE tier via webhooks — FREE has no Stripe subscription, no webhook fires
- Hardcode publish limits in warning messages — read from platform_settings
- Delete credit ledger rows on forfeiture — set usedCredits = totalCredits

### FREE Tier Credit Initialization:
FREE tier sellers don't get credits via webhook (no Stripe subscription). Their 25 monthly credits are created lazily on first `canPublish` check or publish attempt. The publish-meter should handle this: if no MONTHLY credit row exists for the current month and tier is FREE, create one with `totalCredits: 25`, `expiresAt: endOfMonth`. This was part of F4-S1's publish-meter update.

---

## 4. TEST REQUIREMENTS

### lister-downgrade-warnings.test.ts (~12 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | PRO → LITE warns about publish limit drop | message contains limit numbers |
| 2 | PRO → LITE warns about rollover cap drop when excess exists | severity: warning |
| 3 | PRO → LITE no rollover warning when balance under 600 | Only publish limit warning |
| 4 | LITE → FREE warns about rollover forfeiture | severity: critical |
| 5 | Any paid → FREE warns about AI credits loss | severity: info |
| 6 | Any → NONE warns about losing crosslist capability | severity: critical |
| 7 | Same tier returns empty array | No warnings |
| 8 | Upgrade (FREE → LITE) returns empty array | No warnings |
| 9 | Upgrade (LITE → PRO) returns empty array | No warnings |
| 10 | PRO → FREE generates multiple warnings | publish limit + rollover + AI credits |
| 11 | NONE → NONE returns empty | Edge case |
| 12 | Warning messages don't contain hardcoded limits | Read from platform_settings |

### free-tier-activation.test.ts (~8 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | NONE tier auto-upgraded to FREE on import completion | sellerProfile.listerTier = 'FREE' |
| 2 | Already FREE → not touched | No DB update |
| 3 | Already LITE → not touched | No DB update |
| 4 | Already PRO → not touched | No DB update |
| 5 | No lister_subscription row created | Only sellerProfile updated |
| 6 | Import with FAILED status does NOT activate | Only COMPLETED triggers |
| 7 | Import with IN_PROGRESS status does NOT activate | Only COMPLETED triggers |
| 8 | Multiple imports → only first activates | Idempotent (already FREE on second) |

### lister-subscription-webhooks.test.ts (~10 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Period renewal adds monthly credits for LITE | addMonthlyCredits called with 200 |
| 2 | Period renewal adds monthly credits for PRO | addMonthlyCredits called with 2000 |
| 3 | Duplicate renewal event is idempotent | No duplicate credit entry |
| 4 | Subscription deleted forfeits all credits | forfeitAllCredits called |
| 5 | Subscription deleted for lister reverts tier to FREE | Not NONE |
| 6 | Non-lister subscription deleted does NOT forfeit credits | Only lister product |
| 7 | Period renewal with status PAST_DUE does NOT add credits | Only ACTIVE/TRIALING |
| 8 | TRIALING subscription adds credits | TRIALING gets full tier credits |
| 9 | getUserIdFromSellerProfileId returns null for invalid ID | Graceful handling |
| 10 | Webhook with missing sellerProfileId in metadata handled | No crash |

---

## 5. GUARDRAILS

1. Lister cancel reverts to `FREE` not `NONE` — this is already handled in `cancelSubscription` mutation, verify it still works
2. The warning function is pure — no DB calls inside `getListerDowngradeWarnings`. Pass all data via the context object.
3. `connectedPlatformCount` in the downgrade context is informational (shown in UI) but does NOT affect warning generation in F4-S2
4. Webhook idempotency for credit addition uses `periodStart` check, not Stripe event ID
5. `forfeitAllCredits` is called on delete, NOT on `cancel_at_period_end` — seller keeps credits until period actually ends

---

## 6. VERIFICATION

```bash
# TypeScript
pnpm typecheck                    # 0 errors

# Tests
pnpm test                         # baseline + ~30 new tests

# File sizes
wc -l src/lib/subscriptions/lister-downgrade-warnings.ts \
      src/lib/subscriptions/__tests__/lister-downgrade-warnings.test.ts \
      src/lib/crosslister/services/__tests__/free-tier-activation.test.ts \
      src/lib/stripe/__tests__/lister-subscription-webhooks.test.ts
# ALL under 300 lines

# Banned terms
grep -rn "SellerTier\|SubscriptionTier\|PLUS\|MAX\|crosslister\.publishLimit" \
  src/lib/subscriptions/lister-downgrade-warnings.ts \
  src/lib/stripe/subscription-webhooks.ts
# Should be 0

# Verify FREE activation wired
grep -n "listerTier.*FREE\|FREE.*listerTier" src/lib/crosslister/services/import-service.ts
# Should find the activation code

# Verify rollover wired in webhooks
grep -n "addMonthlyCredits\|forfeitAllCredits" src/lib/stripe/subscription-webhooks.ts
# Should find both
```

**Stop and report after verification. Do not proceed to F4-S3.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_F4_S2_DOWNGRADE_WARNINGS_FREE_ACTIVATION.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md (§6)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md (§7.3)

F4-S1 must be complete before starting. Verify prerequisites in Task 0. Execute all tasks in order. Stop and report after running verification.
```
