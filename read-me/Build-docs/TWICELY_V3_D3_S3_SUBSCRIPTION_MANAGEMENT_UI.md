# D3-S3: Subscription Management UI

**Slice:** D3-S3 (slice 3 of 5 for Store Subscriptions)
**Route:** `/my/selling/subscription` (Page Registry #68)
**Gate:** OWNER_ONLY
**Depends on:** D3-S1 (price map, engine, queries) ✅, D3-S2 (checkout + webhooks) ✅
**Baseline:** 850 tests

---

## WHAT THIS SLICE BUILDS

The seller's subscription management page. Shows current subscription status across all 4 product axes, lets sellers subscribe to new products (via D3-S2 checkout), cancel subscriptions, and manage billing via Stripe Customer Portal.

**This slice does NOT build:**
- Upgrade/downgrade between tiers (D3-S4)
- Bundle purchase flow (D3-S5)
- Trial activation (deferred)

Upgrade/downgrade buttons render as disabled with "Coming soon" tooltip. Bundle upsell cards are visible but link to `/pricing` (public page, not yet built — just the link).

---

## READ FIRST

```
C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_D3_S3_SUBSCRIPTION_MANAGEMENT_UI.md
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md  (§4, §6, §7, §8, §9)
C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PAGE_REGISTRY.md  (#68)
C:\Users\XPS-15\Projects\Twicely\src\lib\queries\subscriptions.ts
C:\Users\XPS-15\Projects\Twicely\src\lib\subscriptions\price-map.ts
C:\Users\XPS-15\Projects\Twicely\src\lib\subscriptions\subscription-engine.ts
C:\Users\XPS-15\Projects\Twicely\src\lib\actions\create-subscription-checkout.ts
C:\Users\XPS-15\Projects\Twicely\src\lib\mutations\cancel-subscription.ts
```

---

## FILE MANIFEST

| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `src/app/(hub)/my/selling/subscription/page.tsx` | ~120 | Page (server component) |
| 2 | `src/components/subscription/subscription-overview.tsx` | ~180 | Client component |
| 3 | `src/components/subscription/subscription-card.tsx` | ~150 | Client component |
| 4 | `src/components/subscription/cancel-subscription-dialog.tsx` | ~120 | Client component |
| 5 | `src/lib/actions/manage-subscription.ts` | ~130 | Server actions |
| 6 | `src/lib/actions/__tests__/manage-subscription.test.ts` | ~200 | Tests |
| 7 | `src/components/subscription/__tests__/subscription-card.test.tsx` | ~120 | Tests |

**Total:** 7 new files, ~1,020 lines, ~18+ tests

---

## TASK 0: Verify Prerequisites

Before writing any code, confirm these exist and are importable:

```bash
# D3-S1 foundation
grep -n "getSubscriptionSnapshot\|getProfileTiers" src/lib/queries/subscriptions.ts
grep -n "getPricing\|formatTierPrice\|getAnnualSavingsPercent" src/lib/subscriptions/price-map.ts
grep -n "getDowngradeWarnings\|compareStoreTiers\|compareListerTiers" src/lib/subscriptions/subscription-engine.ts

# D3-S2 actions
grep -n "createSubscriptionCheckout" src/lib/actions/create-subscription-checkout.ts
grep -n "cancelSubscription\|setStripeCustomerId" src/lib/mutations/cancel-subscription.ts

# Auth pattern
grep -rn "auth.api.getSession" src/app/\(hub\)/my/selling/ | head -5

# Stripe server import
grep -rn "stripe" src/lib/stripe/server.ts | head -3
```

If any import is missing, STOP and report.

---

## TASK 1: Server Actions — `manage-subscription.ts`

**File:** `src/lib/actions/manage-subscription.ts` (~130 lines)

Two server actions:

### 1a. `cancelSubscriptionAction`

```typescript
'use server';

import { z } from 'zod';
// ... imports

const CancelSubscriptionSchema = z.object({
  product: z.enum(['store', 'lister', 'automation', 'finance']),
}).strict();

interface CancelResult {
  success: boolean;
  error?: string;
}

export async function cancelSubscriptionAction(
  input: z.infer<typeof CancelSubscriptionSchema>
): Promise<CancelResult> {
  // 1. Zod parse
  // 2. Auth — get session
  // 3. Get sellerProfileId via getSellerProfileIdByUserId(userId)
  // 4. Get the Stripe subscription ID for this product via getStripeSubscriptionId(product, sellerProfileId)
  //    (from queries/subscriptions.ts)
  // 5. If no active subscription → error
  // 6. Call stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
  //    DO NOT call stripe.subscriptions.cancel() — that cancels immediately.
  //    We want cancel at period end so the seller keeps access until billing cycle ends.
  // 7. Return { success: true }
  //
  // The Stripe webhook will fire customer.subscription.updated with cancel_at_period_end: true.
  // Then at period end, customer.subscription.deleted fires and our webhook handler
  // calls cancelSubscription() to revert the tier.
}
```

**CRITICAL:** This action calls `stripe.subscriptions.update()` with `cancel_at_period_end: true`. It does NOT call `stripe.subscriptions.cancel()`. The difference:
- `update({ cancel_at_period_end: true })` → subscription stays active until current period ends, then Stripe fires `deleted` event
- `cancel()` → subscription terminates immediately

### 1b. `createBillingPortalSession`

```typescript
const BillingPortalSchema = z.object({
  returnUrl: z.string().url().optional(),
}).strict();

interface PortalResult {
  success: boolean;
  portalUrl?: string;
  error?: string;
}

export async function createBillingPortalSession(
  input?: z.infer<typeof BillingPortalSchema>
): Promise<PortalResult> {
  // 1. Auth — get session
  // 2. Get sellerProfileId
  // 3. Load sellerProfile.stripeCustomerId
  // 4. If no stripeCustomerId → error "No billing account found"
  // 5. Create Stripe billing portal session:
  //    stripe.billingPortal.sessions.create({
  //      customer: stripeCustomerId,
  //      return_url: input?.returnUrl || `${baseUrl}/my/selling/subscription`,
  //    })
  // 6. Return { success: true, portalUrl: session.url }
}
```

**Note:** The Stripe Customer Portal lets users update payment methods, view invoices, and download receipts. We don't need to build any of that — Stripe hosts it.

---

## TASK 2: Page — `subscription/page.tsx`

**File:** `src/app/(hub)/my/selling/subscription/page.tsx` (~120 lines)

Server component. Follows the existing pattern in `/my/selling/*` pages.

```typescript
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getSellerProfileIdByUserId, getSubscriptionSnapshot } from '@/lib/queries/subscriptions';
import { SubscriptionOverview } from '@/components/subscription/subscription-overview';

export const metadata = { title: 'Subscription | Twicely' };

export default async function SubscriptionPage() {
  // 1. Auth check — redirect to /auth/login if no session
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  // 2. Get seller profile — redirect to /my if not a seller
  const sellerProfileId = await getSellerProfileIdByUserId(session.user.id);
  if (!sellerProfileId) redirect('/my');

  // 3. Load full subscription snapshot
  const snapshot = await getSubscriptionSnapshot(sellerProfileId);

  // 4. Load seller profile for business status check
  //    (needed to show "Upgrade to Business" prompt for store subscription)
  //    Use a lightweight query: sellerType, stripeAccountId, stripeOnboarded
  //    from sellerProfile WHERE id = sellerProfileId

  // 5. Render
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your Store, Crosslister, Finance, and Automation subscriptions.
        </p>
      </div>
      <SubscriptionOverview
        snapshot={snapshot}
        sellerType={profile.sellerType}
        hasStripeConnect={!!profile.stripeAccountId && profile.stripeOnboarded}
      />
    </div>
  );
}
```

---

## TASK 3: SubscriptionOverview Component

**File:** `src/components/subscription/subscription-overview.tsx` (~180 lines)

Client component (`'use client'`). Renders a grid of 4 SubscriptionCards + bundle upsell.

```typescript
'use client';

import { SubscriptionCard } from './subscription-card';
import { formatTierPrice, getAnnualSavingsPercent } from '@/lib/subscriptions/price-map';
import type { SubscriptionSnapshot } from '@/lib/queries/subscriptions';

interface SubscriptionOverviewProps {
  snapshot: SubscriptionSnapshot;
  sellerType: 'PERSONAL' | 'BUSINESS';
  hasStripeConnect: boolean;
}
```

**Layout:** 2-column grid on desktop, single column on mobile.

**4 product cards rendered via `<SubscriptionCard>` (see Task 4):**

### Card 1: Store Subscription
- Current tier from `snapshot.profileTiers.storeTier`
- If `storeTier === 'NONE'`: show "No Store Subscription" with Subscribe button
- If `sellerType === 'PERSONAL'`: show "Upgrade to Business to unlock Store subscriptions" info box instead of subscribe button
- If subscribed: show tier badge, status, renewal date, cancel button
- Available tiers for new subscription: STARTER, PRO, POWER (not ENTERPRISE)

### Card 2: XLister Subscription
- Current tier from `snapshot.profileTiers.listerTier`
- If `listerTier === 'NONE'` or `'FREE'`: show "Free Plan" with upgrade options
- Available tiers: LITE, PRO
- Show publish credits: "200/mo" (LITE) or "2,000/mo" (PRO)

### Card 3: Finance Subscription
- Current tier from `snapshot.profileTiers.financeTier`
- If `financeTier === 'FREE'`: show "Free Plan" with upgrade to PRO
- Only one paid tier: PRO

### Card 4: Automation Add-On
- From `snapshot.profileTiers.hasAutomation`
- Boolean — either subscribed or not
- If not subscribed: show features list + Subscribe button
- If subscribed: show status, renewal, cancel
- Show "2,000 actions/mo"

**Below the grid:**
- "Manage Payment Methods" button → calls `createBillingPortalSession()` → redirects to Stripe portal
- Bundle upsell section: "Save with bundles" cards showing Starter/Pro/Power bundles with savings percentages
  - Each card shows what's included and "Save ~$X/mo"
  - Links to `/pricing` (page not yet built — just href, no onClick)

---

## TASK 4: SubscriptionCard Component

**File:** `src/components/subscription/subscription-card.tsx` (~150 lines)

Client component. Reusable card for each subscription product.

```typescript
'use client';

interface SubscriptionCardProps {
  title: string;                        // "Store", "Crosslister", "Finance Pro", "Automation"
  product: 'store' | 'lister' | 'finance' | 'automation';
  currentTier: string;                  // e.g., 'PRO', 'FREE', 'NONE'
  status: string | null;                // 'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', null
  currentPeriodEnd: Date | null;        // Next renewal date
  cancelAtPeriodEnd: boolean;           // If true, show "Cancels on {date}"
  trialEndsAt?: Date | null;           // If trialing
  availableTiers: Array<{              // Tiers the seller can subscribe to
    tier: string;
    label: string;
    monthlyPrice: string;              // Formatted: "$39.99/mo"
    annualPrice: string;               // Formatted: "$29.99/mo"
    annualSavings: number;             // Percentage: 25
    features: string[];                // Key features for this tier
  }>;
  onSubscribe: (tier: string, interval: 'monthly' | 'annual') => void;
  onCancel: () => void;
  canSubscribe: boolean;               // false if missing prereqs (e.g., not BUSINESS for store)
  disabledReason?: string;             // "Upgrade to Business first"
  isUpgradeAvailable: boolean;         // true if currently subscribed and higher tier exists
}
```

**Card states:**

**State A: No subscription (tier = NONE/FREE)**
- Gray border, neutral background
- Title + "No active subscription" or "Free Plan"
- Feature comparison of available tiers (compact)
- For each tier: two buttons "Monthly $X" / "Annual $X (Save Y%)"
- Annual button should be visually emphasized (primary variant)

**State B: Active subscription**
- Brand-colored left border (#7C3AED)
- Tier badge (e.g., "PRO") in brand color
- Status indicator: green dot "Active", yellow dot "Past Due", blue dot "Trialing"
- "Renews {date}" or "Trial ends {date}"
- If `cancelAtPeriodEnd`: yellow banner "Cancels on {date}" with "Reactivate" button (deferred — just show the banner for now)
- "Change Plan" button (disabled with "Coming soon" tooltip — D3-S4)
- "Cancel Subscription" button (opens cancel dialog)

**State C: Past due**
- Red left border
- "Payment failed" warning
- "Update Payment Method" button → billing portal

**State D: Cannot subscribe (e.g., PERSONAL trying to get Store)**
- Card visible but subscribe buttons disabled
- Info message: `disabledReason`

---

## TASK 5: CancelSubscriptionDialog Component

**File:** `src/components/subscription/cancel-subscription-dialog.tsx` (~120 lines)

Uses shadcn `AlertDialog` component.

```typescript
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getDowngradeWarnings } from '@/lib/subscriptions/subscription-engine';
```

**Dialog flow:**
1. Trigger: "Cancel Subscription" button on the card
2. Dialog opens with:
   - Title: "Cancel {Product} Subscription?"
   - Description: "Your subscription will remain active until {periodEndDate}. After that, you'll be downgraded to {revertTier}."
   - Downgrade warnings from `getDowngradeWarnings()`:
     - Store PRO→NONE: "You'll lose access to boosting, bulk tools, and coupons"
     - Store POWER→NONE: "Your custom storefront pages will be unpublished, daily auto-payouts will stop"
     - etc.
   - Each warning rendered as a yellow alert row
3. Two buttons: "Keep Subscription" (cancel dialog) / "Yes, Cancel" (confirm)
4. On confirm: calls `cancelSubscriptionAction({ product })`, shows loading state
5. On success: `router.refresh()` to reload page data
6. On error: shows error toast

---

## TASK 6: Tests

### 6a. `manage-subscription.test.ts` (~200 lines, 10+ tests)

Mock pattern: same as create-subscription-checkout.test.ts (mock auth, db, stripe, queries).

**Tests for cancelSubscriptionAction:**
1. No session → `{ success: false, error: 'Unauthorized' }`
2. No seller profile → `{ success: false, error: 'Seller profile not found' }`
3. Invalid product (Zod) → `{ success: false, error: 'Invalid input' }`
4. No active subscription found → `{ success: false, error: ... }`
5. Valid store cancel → calls `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`, returns `{ success: true }`
6. Valid lister cancel → same pattern
7. Valid automation cancel → same pattern

**Tests for createBillingPortalSession:**
8. No session → error
9. No stripeCustomerId → `{ success: false, error: 'No billing account found' }`
10. Valid → calls `stripe.billingPortal.sessions.create()`, returns `{ success: true, portalUrl }`

### 6b. `subscription-card.test.tsx` (~120 lines, 8+ tests)

Uses `@testing-library/react` + Vitest.

**Tests:**
1. Renders "No active subscription" when tier is NONE
2. Renders tier badge and "Active" status when subscribed
3. Renders "Cancels on {date}" banner when cancelAtPeriodEnd is true
4. Renders "Past Due" warning with red indicator
5. Shows disabled subscribe button with reason when canSubscribe is false
6. Calls onSubscribe with correct tier and interval when subscribe button clicked
7. Calls onCancel when cancel button clicked
8. Shows "Trialing" status with trial end date

---

## GUARDRAILS

1. **DO NOT build upgrade/downgrade logic.** "Change Plan" button renders disabled with tooltip "Coming soon". That's D3-S4.
2. **DO NOT build bundle purchase flow.** Bundle cards link to `/pricing`. That's D3-S5.
3. **DO NOT build "Reactivate" for canceled subscriptions.** Just show the "Cancels on {date}" banner. Reactivation is D3-S4.
4. **Cancel = cancel_at_period_end, NOT immediate cancel.** Use `stripe.subscriptions.update()` not `stripe.subscriptions.cancel()`.
5. **Stripe Customer Portal for payment methods.** We do NOT build our own payment method management UI.
6. **sellerProfileId derived from session, never from request body.** Same security pattern as D3-S2.
7. **All server actions use Zod validation at entry.**
8. **All monetary display uses `formatTierPrice()` from price-map.ts.** Do not format prices manually.
9. **Use `getDowngradeWarnings()` from subscription-engine.ts** for cancel dialog warnings. Do not hardcode warning text.
10. **ENTERPRISE tier is never shown as a subscribable option.** Enterprise is "Contact sales" — render as text, not a button.
11. **Brand color for active subscription accent: #7C3AED** (Deep Amethyst).
12. **Date formatting:** Use `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` for renewal dates. Example: "Mar 15, 2026".
13. **All files under 300 lines.**
14. **Mobile responsive: single column at 375px, two columns at md breakpoint.**
15. **Use shadcn/ui components:** Card, Badge, Button, AlertDialog, Tooltip. Do NOT install new UI libraries.

---

## SUBSCRIPTION SNAPSHOT SHAPE

The `getSubscriptionSnapshot` function (from D3-S1) returns this structure. Use it directly — do not re-query:

```typescript
interface SubscriptionSnapshot {
  profileTiers: {
    storeTier: StoreTier;
    listerTier: ListerTier;
    financeTier: FinanceTier;
    hasAutomation: boolean;
  };
  store: {
    id: string;
    tier: StoreTier;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: Date | null;
  } | null;
  lister: { /* same shape minus trialEndsAt */ } | null;
  automation: { /* same shape, no tier field */ } | null;
  finance: { /* same shape */ } | null;
}
```

---

## AVAILABLE TIER DATA FOR CARDS

Build these from the price-map functions. Do NOT hardcode prices.

### Store tiers (for non-subscribed sellers)
```typescript
const storeTiers = [
  {
    tier: 'STARTER',
    label: 'Starter',
    monthlyPrice: formatTierPrice('store', 'STARTER', 'monthly'),  // "$12.00/mo"
    annualPrice: formatTierPrice('store', 'STARTER', 'annual'),    // "$6.99/mo"
    annualSavings: getAnnualSavingsPercent('store', 'STARTER'),    // 42
    features: ['250 free listings/mo', 'Announcement bar', 'Social links', 'Weekly auto-payout'],
  },
  {
    tier: 'PRO',
    label: 'Pro',
    // ... same pattern
    features: ['2,000 free listings/mo', 'Bulk tools', 'Coupons', 'Boosting', 'Analytics'],
  },
  {
    tier: 'POWER',
    label: 'Power',
    // ... same pattern
    features: ['15,000 free listings/mo', 'Page builder', 'Auto-counter', 'Daily payout', '25 staff'],
  },
];
```

### XLister tiers
```typescript
const listerTiers = [
  { tier: 'LITE', label: 'Lite', features: ['200 publishes/mo', '25 AI credits', '25 BG removals'] },
  { tier: 'PRO', label: 'Pro', features: ['2,000 publishes/mo', '200 AI credits', '200 BG removals'] },
];
```

### Finance tier
```typescript
// Only one paid tier
{ tier: 'PRO', label: 'Pro', features: ['Full P&L', 'Cross-platform revenue', 'Expense tracking', 'Tax prep'] }
```

### Automation
```typescript
// Boolean — no tiers
{ features: ['Auto-relist', 'Offer to likers', 'Smart price drops', 'Posh sharing', '2,000 actions/mo'] }
```

---

## VERIFY

After all tasks complete:

```bash
pnpm typecheck                    # 0 errors
pnpm test                         # 850 + new tests
wc -l src/app/\(hub\)/my/selling/subscription/page.tsx \
  src/components/subscription/subscription-overview.tsx \
  src/components/subscription/subscription-card.tsx \
  src/components/subscription/cancel-subscription-dialog.tsx \
  src/lib/actions/manage-subscription.ts \
  src/lib/actions/__tests__/manage-subscription.test.ts \
  src/components/subscription/__tests__/subscription-card.test.tsx
# ALL files under 300 lines
grep -rn "as any\|@ts-ignore\|@ts-expect-error" src/components/subscription/ src/lib/actions/manage-subscription.ts
# Should be 0
```

---

## LAUNCHER PROMPT

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_D3_S3_SUBSCRIPTION_MANAGEMENT_UI.md

This is the complete install spec for D3-S3 (Subscription Management UI). Read the ENTIRE file before writing any code. It contains:
- 7 tasks (Task 0 through Task 6)
- File manifest (7 new files)
- 15 guardrails you MUST follow
- Verification commands at the bottom

Execute every task in order. Do NOT skip Task 0 (prerequisite check). Stop and report after running verification.
```
