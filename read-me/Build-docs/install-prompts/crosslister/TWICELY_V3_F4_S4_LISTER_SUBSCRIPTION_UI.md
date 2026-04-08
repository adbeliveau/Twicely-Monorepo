# Install Prompt: F4-S4 — Lister Subscription UI

**Phase & Step:** `[F4-S4]`
**Depends on:** F4-S1 (rollover), F4-S2 (warnings, FREE activation), F4-S3 (overage action)
**One-line Summary:** Build lister subscription card for `/my/selling/subscription`, publish meter display for `/my/selling/crosslist`, wire queries and page data loading.

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_PAGE_REGISTRY.md` — #69 (`/my/selling/subscription`), #56 (`/my/selling/crosslist`)
2. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — §6 (XLister tiers, features)
3. `TWICELY_V3_LISTER_CANONICAL.md` — §7.3 (publish limits by tier)

**Reference existing D3-S3 components:**
- `src/components/subscription/subscription-card.tsx` — reuse patterns
- `src/components/subscription/subscription-overview.tsx` — integrate lister card
- `src/components/subscription/cancel-subscription-dialog.tsx` — reuse for lister cancel

---

## 0. PREREQUISITES

```bash
# Verify F4-S1/S2/S3 are complete
grep -n "getAvailableCredits" src/lib/crosslister/services/rollover-manager.ts
grep -n "getListerDowngradeWarnings" src/lib/subscriptions/lister-downgrade-warnings.ts
grep -n "purchaseOveragePackAction" src/lib/actions/purchase-overage-pack.ts

# Verify existing subscription page and overview
ls src/app/\(hub\)/my/selling/subscription/page.tsx
ls src/components/subscription/subscription-overview.tsx

# Verify crosslister dashboard page exists
ls src/app/\(hub\)/my/selling/crosslist/page.tsx 2>/dev/null || echo "Page not found — will need to create"

# Verify existing publish meter
grep -n "getPublishAllowance" src/lib/crosslister/services/publish-meter.ts

# Test baseline
npx vitest run 2>&1 | tail -3
```

---

## 1. SCOPE — EXACTLY WHAT TO BUILD

### 1.1 Lister Subscription Queries

New file: `src/lib/queries/lister-subscription.ts`

```typescript
export interface ListerSubscriptionSnapshot {
  listerTier: ListerTier;
  publishAllowance: {
    tier: ListerTier;
    monthlyLimit: number;
    usedThisMonth: number;
    remaining: number;
    rolloverBalance: number;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    pendingTier: ListerTier | null;  // from D3-S4 pending downgrade
  } | null;
  connectedPlatformCount: number;
}

export async function getListerSubscriptionSnapshot(userId: string): Promise<ListerSubscriptionSnapshot>
```

Implementation:
1. Get `sellerProfile.listerTier` and `sellerProfile.id`
2. Get `listerSubscription` row via `sellerProfileId` (may be null for FREE/NONE)
3. Call `getPublishAllowance(userId)` from publish-meter
4. Count active `crosslisterAccount` rows for this user
5. Assemble and return snapshot

### 1.2 Lister Subscription Card

New file: `src/components/subscription/lister-subscription-card.tsx`

This is a specialized card for the lister product — NOT the generic `SubscriptionCard`. The lister card has unique elements (publish meter, rollover display, overage purchase) that the generic card doesn't support.

**Props:**

```typescript
interface ListerSubscriptionCardProps {
  snapshot: ListerSubscriptionSnapshot;
  isSubscribing?: boolean;
  onSubscribe: (tier: string, interval: 'monthly' | 'annual') => void;
  onPurchaseOverage: () => void;
}
```

**States:**

**State A: NONE tier**
- Gray border
- Headline: "Start Crosslisting"
- Body: "Import your listings for free from any platform. Get 5 publishes as a 6-month teaser on the free plan (Decision #105)."
- CTA: "Import Your Listings" → link to `/my/selling/crosslist/import` (or wherever import wizard lives)
- No subscribe buttons (NONE → FREE happens via import, not subscription)

**State B: FREE tier**
- Gray border with subtle accent
- Tier badge: "Free"
- Publish meter: progress bar showing `{used} / 5 publishes` (Decision #105 — 5 total for the 6-month window, not 25/month)
- No rollover display (FREE has no rollover)
- Upgrade CTA cards for LITE and PRO (reuse the tier card pattern from subscription-card.tsx)
- Feature comparison: what you get with LITE vs PRO
- No cancel button (FREE is free)

**State C: LITE/PRO tier (active)**
- Brand border (#7C3AED)
- Tier badge: "Lite" or "Pro"
- Publish meter: progress bar `{used} / {monthlyLimit + rolloverBalance} publishes`
- Rollover display: "{rolloverBalance} rollover credits" (only if > 0)
- Connected platforms: "{count} platforms connected"
- Action row:
  - "Buy +500 Publishes ($9)" button → calls `onPurchaseOverage`
  - "Change Plan" button disabled with "Coming soon" tooltip (if D3-S4 isn't wired for lister yet)
  - Cancel button → `CancelSubscriptionDialog` with lister-specific warnings
- If `cancelAtPeriodEnd`: amber banner "Your subscription ends on {date}"
- If `pendingTier`: info banner "Changing to {tier} on {date}"

**State D: PAST_DUE**
- Red border
- Payment failed warning
- "Update Payment Method" button → billing portal

**Publish Meter Progress Bar:**
- Width: `(used / (monthlyLimit + rolloverBalance)) * 100%`
- Color: green < 75%, amber 75-90%, red > 90%
- Text below: `{remaining} publishes remaining`
- If rollover > 0: gray text `(includes {rolloverBalance} rollover)`

**Available Tiers Data:**
Build from `formatTierPrice()` — same pattern as STORE_TIERS in subscription-overview.tsx:

```typescript
const LISTER_UPGRADE_TIERS = [
  {
    tier: 'LITE', label: 'Lite',
    monthlyPrice: formatTierPrice('lister', 'LITE', 'monthly'),
    annualPrice: formatTierPrice('lister', 'LITE', 'annual'),
    annualSavings: getAnnualSavingsPercent('lister', 'LITE'),
    features: ['200 publishes/mo', '25 AI credits', '25 BG removals', '60-day rollover'],
  },
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatTierPrice('lister', 'PRO', 'monthly'),
    annualPrice: formatTierPrice('lister', 'PRO', 'annual'),
    annualSavings: getAnnualSavingsPercent('lister', 'PRO'),
    features: ['2,000 publishes/mo', '200 AI credits', '200 BG removals', '60-day rollover'],
  },
];
```

### 1.3 Publish Meter Display Component

New file: `src/components/crosslister/publish-meter-display.tsx`

Lightweight component for the crosslister dashboard page. Shows the publish meter without the full subscription management UI.

**Props:**
```typescript
interface PublishMeterDisplayProps {
  publishAllowance: {
    tier: ListerTier;
    monthlyLimit: number;
    usedThisMonth: number;
    remaining: number;
    rolloverBalance: number;
  };
}
```

**Display:**
- Horizontal progress bar (same styling as lister card)
- Text: `{usedThisMonth} of {monthlyLimit} publishes used this month`
- If rollover > 0: `+ {rolloverBalance} rollover credits available`
- If remaining < 20% of total: amber warning "Running low on publishes"
- If remaining === 0: red warning "No publishes remaining" + link to upgrade or buy overage
- If tier is NONE: "Enable crosslisting by importing your first listings"

### 1.4 Wire into Subscription Page

Modify: `src/app/(hub)/my/selling/subscription/page.tsx`

Add lister snapshot loading:
```typescript
const listerSnapshot = await getListerSubscriptionSnapshot(session.user.id);
```

Pass to `SubscriptionOverview`:
```typescript
<SubscriptionOverview
  snapshot={subscriptionSnapshot}
  listerSnapshot={listerSnapshot}
  sellerType={...}
  hasStripeConnect={...}
/>
```

Modify: `src/components/subscription/subscription-overview.tsx`

Replace the generic lister `SubscriptionCard` with the new `ListerSubscriptionCard`:

```typescript
// REMOVE the generic lister SubscriptionCard
// REPLACE with:
<ListerSubscriptionCard
  snapshot={listerSnapshot}
  onSubscribe={(tier, interval) => handleSubscribe('lister', tier, interval)}
  onPurchaseOverage={handlePurchaseOverage}
/>
```

Add `handlePurchaseOverage`:
```typescript
async function handlePurchaseOverage() {
  const result = await purchaseOveragePackAction({ packType: 'publishes' });
  if (result.success && result.checkoutUrl) {
    window.location.href = result.checkoutUrl;
  }
  // TODO: show error toast on failure (E-phase notification system)
}
```

### 1.5 Wire into Crosslister Dashboard

Modify: `src/app/(hub)/my/selling/crosslist/page.tsx`

Load publish allowance and pass to display component:

```typescript
import { getPublishAllowance } from '@/lib/crosslister/services/publish-meter';

// In the server component:
const publishAllowance = await getPublishAllowance(session.user.id);

// In JSX:
<PublishMeterDisplay publishAllowance={publishAllowance} />
```

---

## 2. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/lib/queries/lister-subscription.ts` | ~80 | getListerSubscriptionSnapshot query |
| 2 | `src/components/subscription/lister-subscription-card.tsx` | ~280 | Full lister card with publish meter, rollover, tiers |
| 3 | `src/components/crosslister/publish-meter-display.tsx` | ~80 | Lightweight publish meter for crosslister dashboard |

### Modified Files

| # | File | Change |
|---|------|--------|
| 4 | `src/app/(hub)/my/selling/subscription/page.tsx` | Load lister snapshot, pass to overview |
| 5 | `src/components/subscription/subscription-overview.tsx` | Replace generic lister card with ListerSubscriptionCard, add overage handler |
| 6 | `src/app/(hub)/my/selling/crosslist/page.tsx` | Add PublishMeterDisplay with publish allowance |

### Test Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 7 | `src/components/subscription/__tests__/lister-subscription-card.test.tsx` | ~120 | Helper function tests (same pattern as subscription-card.test.tsx) |

---

## 3. CONSTRAINTS

### DO NOT:
- Rebuild the generic SubscriptionCard — the lister card is a separate component
- Build upgrade/downgrade flow UI (D3-S4 scope) — "Change Plan" is disabled with tooltip
- Build import wizard UI — just link to it
- Build toast/notification for errors — use inline error display or console for now
- Hardcode any prices — use `formatTierPrice()` from price-map.ts
- Hardcode publish limits — derive from snapshot data
- Use `@testing-library/react` (not installed) — test exported helpers only

### UI Rules:
- Brand color for active: `#7C3AED`
- Mobile responsive: single column at 375px
- Use shadcn/ui components only
- Date format: `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
- Refer to product as "XLister" or "Crosslister" in UI text — never "Lister" alone

---

## 4. TEST REQUIREMENTS

### lister-subscription-card.test.tsx (~10 tests)

Test the helper functions and data derivation (same pattern as D3-S3 subscription-card.test.tsx):

| # | Test | Expected |
|---|------|----------|
| 1 | Progress bar percentage calculation: 0 used | 0% |
| 2 | Progress bar percentage: 150/200 used | 75% |
| 3 | Progress bar percentage: 200/200 monthly + 100 rollover used 250 | ~83% |
| 4 | Progress bar color: < 75% | green |
| 5 | Progress bar color: 75-90% | amber |
| 6 | Progress bar color: > 90% | red |
| 7 | Rollover display text: 0 rollover | Not shown |
| 8 | Rollover display text: 150 rollover | "150 rollover credits" |
| 9 | Remaining text with rollover | "includes {n} rollover" |
| 10 | Tier label mapping | LITE → "Lite", PRO → "Pro", FREE → "Free" |

---

## 5. GUARDRAILS

1. The `ListerSubscriptionCard` is a CLIENT component ('use client') — same as existing subscription components
2. The `getListerSubscriptionSnapshot` query runs on the SERVER in the page component
3. `PublishMeterDisplay` is a CLIENT component for potential future interactivity (polling)
4. If `crosslist/page.tsx` doesn't exist yet, create it as a minimal server page with just the publish meter
5. The overage "Buy +500" button is only visible for LITE/PRO tiers (paid subscribers)
6. `CancelSubscriptionDialog` is reused from D3-S3 — import it, pass `product="lister"` and lister-specific warnings
7. The lister card in `subscription-overview.tsx` REPLACES the generic `SubscriptionCard` for lister — don't render both

---

## 6. VERIFICATION

```bash
# TypeScript
pnpm typecheck                    # 0 errors

# Tests
pnpm test                         # baseline + ~10 new tests

# File sizes
wc -l src/lib/queries/lister-subscription.ts \
      src/components/subscription/lister-subscription-card.tsx \
      src/components/crosslister/publish-meter-display.tsx \
      src/components/subscription/__tests__/lister-subscription-card.test.tsx
# ALL under 300 lines

# Banned terms
grep -rn "SellerTier\|SubscriptionTier\|as any\|@ts-ignore\|Lister Subscription" \
  src/components/subscription/lister-subscription-card.tsx \
  src/components/crosslister/publish-meter-display.tsx \
  src/lib/queries/lister-subscription.ts
# Should be 0 (use "XLister" or "Crosslister" in UI, not "Lister Subscription")

# Verify lister card is wired
grep -n "ListerSubscriptionCard" src/components/subscription/subscription-overview.tsx
# Should find the import and usage

# Verify publish meter is wired
grep -n "PublishMeterDisplay" src/app/\(hub\)/my/selling/crosslist/page.tsx
# Should find the import and usage

# Verify no hardcoded prices
grep -rn "\$9\.\|900\|500.*credits\|publishes.*200\|publishes.*2000" \
  src/components/subscription/lister-subscription-card.tsx
# Should be 0 (all from formatTierPrice or snapshot data)
```

**Stop and report after verification. F4 is complete when all 4 sub-slices pass.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_F4_S4_LISTER_SUBSCRIPTION_UI.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md (§6)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PAGE_REGISTRY.md (#56, #69)

F4-S1, S2, and S3 must all be complete before starting. Verify prerequisites in Task 0. Execute all tasks in order. Stop and report after running verification.
```
