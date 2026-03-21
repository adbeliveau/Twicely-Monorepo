# [G1-B] Seller Onboarding — Activation + Business Upgrade Wizard

**Phase & Step:** G1-B (part of G1 Onboarding Flows)
**Feature Name:** Seller Onboarding — Personal Activation & Business Upgrade Wizard
**One-line Summary:** Implement the two seller onboarding paths: instant PERSONAL seller activation and multi-step BUSINESS upgrade wizard.

**Canonical Sources — READ ALL BEFORE STARTING:**
1. `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` Section 6 (Seller Activation Flow)
2. `TWICELY_V3_USER_MODEL.md` Sections 3, 6, 11, 15.3 (seller types, business upgrade, lifecycle, gate testing)
3. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` Section 13 (Onboarding Flows — Seller First-Run)
4. `TWICELY_V3_PAGE_REGISTRY.md` Row 71 (`/my/selling/onboarding`)
5. `TWICELY_V3_SCHEMA_v2_1_0.md` Sections 2.3 (sellerProfile), 2.4 (businessInfo)
6. `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` Section 3.3 (seller permissions)
7. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` Section 3.2 (Stripe Connect)
8. `TWICELY_V3_DECISION_RATIONALE.md` Decision #15 (three independent axes), #16 (imports active immediately)

---

## 1. PREREQUISITES

### Must Be Complete
- Phase A-F: all complete
- G1-A (buyer onboarding interest picker): complete
- `sellerProfile` table: exists in `src/lib/db/schema/identity.ts`
- `businessInfo` table: exists in `src/lib/db/schema/identity.ts`
- `user.isSeller` column: exists in `src/lib/db/schema/auth.ts`
- `ensureSellerProfile()`: exists in `src/lib/listings/seller-activate.ts`
- Stripe Connect actions: exist in `src/lib/actions/stripe-onboarding.ts`
- CASL `SellerProfile` subject: exists in `src/lib/casl/subjects.ts`
- `getUserCapabilities()`: exists in `src/lib/queries/user-capabilities.ts`

### Existing Code to Reuse (Do NOT Recreate)
- `ensureSellerProfile()` in `src/lib/listings/seller-activate.ts` — creates seller profile + sets `user.isSeller = true`
- `startOnboardingAction()` in `src/lib/actions/stripe-onboarding.ts` — starts Stripe Connect onboarding
- `getOnboardingStatusAction()` in `src/lib/actions/stripe-onboarding.ts` — checks Stripe account status
- `getSellerProfile()` in `src/lib/queries/seller.ts` — fetches seller profile by userId
- `authorize()` in `src/lib/casl/authorize.ts` — session + CASL ability

---

## 2. DESIGN — TWO DISTINCT PATHS

There are two seller onboarding paths. They are architecturally separate flows.

### Path A: PERSONAL Seller Activation (No Wizard)

**Source:** Hub Canonical Section 6 — "NO multi-step onboarding wizard for personal sellers."

**Flow:**
1. Non-seller user clicks "Start Selling" (sidebar CTA) or "Create your first listing"
2. System calls `enableSellerAction()` — creates `sellerProfile` (PERSONAL, NONE store tier, FREE lister tier) + sets `user.isSeller = true`
3. Emits audit event: `SELLER_ACTIVATED`
4. Redirects to `/my/selling/listings/new`
5. Sidebar immediately shows Selling section

**What already exists:** The `selling/layout.tsx` already shows a "Start selling" CTA for non-sellers and allows through to the create listing page. The `ensureSellerProfile()` in `seller-activate.ts` is called during listing creation. **But there is no explicit "enable selling" action that can be called independently from listing creation.** G1-B must add this.

### Path B: BUSINESS Upgrade Wizard (Multi-Step)

**Source:** User Model Section 6 (Business Upgrade Flow), Feature Lock-in Section 13 (Seller First-Run).

**Flow:**
1. PERSONAL seller clicks "Open a Store" (sidebar CTA) or tries to subscribe to Store tier
2. System blocks: "Business account required for store subscription"
3. Redirects to `/my/selling/onboarding?flow=business`
4. Multi-step wizard:
   - **Step 1 — Business Information**: business name, business type (SOLE_PROPRIETOR / LLC / CORPORATION / PARTNERSHIP), address, EIN (optional), phone (optional), website (optional)
   - **Step 2 — Payout Setup**: Stripe Connect onboarding (reuses existing `startOnboardingAction`)
   - **Step 3 — Store Profile**: store name (required, uniqueness enforced), store slug (auto-generated from store name, editable)
   - **Step 4 — Completion**: success state, "Create your first listing" CTA + "Explore subscription plans" CTA
5. Progress bar shows completion. User can exit and resume later.
6. Incomplete steps shown as reminders on seller dashboard.

**What happens at each step:**
- Step 1 complete: `businessInfo` record created, `sellerProfile.sellerType` updated to `BUSINESS`
- Step 2 complete: Stripe Connect account created + onboarded (`stripeOnboarded = true`)
- Step 3 complete: `sellerProfile.storeName` and `sellerProfile.storeSlug` updated
- Step 4: informational only, no data write

**Resume behavior:** The wizard determines current step by checking what data exists:
- No `businessInfo` record -> start at Step 1
- `businessInfo` exists but `stripeOnboarded = false` -> start at Step 2
- `stripeOnboarded = true` but no `storeName` -> start at Step 3
- All complete -> show Step 4 (completion)

---

## 3. SCOPE — EXACTLY WHAT TO BUILD

### 3.1 Database

**No new tables.** All tables already exist in the schema:

- `sellerProfile` (identity.ts) — columns used: `userId`, `sellerType`, `storeTier`, `listerTier`, `storeName`, `storeSlug`, `stripeAccountId`, `stripeOnboarded`, `payoutsEnabled`, `activatedAt`, `status`
- `businessInfo` (identity.ts) — columns used: `userId`, `businessName`, `businessType`, `ein`, `address1`, `address2`, `city`, `state`, `zip`, `country`, `phone`, `website`
- `user` (auth.ts) — columns used: `isSeller`

### 3.2 Server Actions

#### Action 1: `enableSellerAction`
**File:** `src/lib/actions/seller-onboarding.ts`
**Purpose:** Activate a non-seller as a PERSONAL seller (no wizard).

```
Input: none (uses session userId)
Auth: authorize() — must be authenticated, must NOT already be a seller
Logic:
  1. Call authorize(), get session
  2. Check user.isSeller === false (if already seller, return { success: true, alreadySeller: true })
  3. Call ensureSellerProfile(session.userId) from seller-activate.ts
  4. Emit audit event: { action: 'SELLER_ACTIVATED', subjectType: 'SellerProfile', subjectId: <newProfileId>, actorUserId: session.userId }
  5. revalidatePath('/my')
  6. Return { success: true }
Output: { success: boolean; alreadySeller?: boolean; error?: string }
```

#### Action 2: `submitBusinessInfoAction`
**File:** `src/lib/actions/seller-onboarding.ts`
**Purpose:** Create BusinessInfo record and upgrade seller to BUSINESS type.

```
Input: businessInfoSchema (Zod, .strict())
  - businessName: string, min 2, max 100
  - businessType: enum('SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP')
  - ein: string, optional (format: XX-XXXXXXX)
  - address1: string, min 1, max 200
  - address2: string, optional, max 200
  - city: string, min 1, max 100
  - state: string, min 2, max 2 (US state code)
  - zip: string, regex /^\d{5}(-\d{4})?$/
  - country: string, default 'US'
  - phone: string, optional
  - website: string, optional, url format
Auth: authorize() — must be authenticated seller. ability.can('manage', sub('SellerProfile', { userId }))
Logic:
  1. Validate input with businessInfoSchema
  2. Check if businessInfo already exists for userId (if yes, return error — use separate updateBusinessInfoAction for updates)
  3. Transaction:
    a. Insert into businessInfo with explicit field mapping
    b. Update sellerProfile: set sellerType = 'BUSINESS'
  4. Emit audit event: { action: 'BUSINESS_UPGRADED', subjectType: 'SellerProfile', subjectId: <profileId>, actorUserId }
  5. revalidatePath('/my/selling/onboarding')
  6. Return { success: true }
Output: { success: boolean; error?: string }
```

#### Action 3: `updateStoreNameAction`
**File:** `src/lib/actions/seller-onboarding.ts`
**Purpose:** Set store name and slug on seller profile during onboarding Step 3.

```
Input: storeNameSchema (Zod, .strict())
  - storeName: string, min 2, max 50
  - storeSlug: string, min 2, max 30, regex /^[a-z0-9-]+$/ (lowercase, alphanumeric + hyphens)
Auth: authorize() — must be authenticated seller, sellerType === BUSINESS. ability.can('manage', sub('SellerProfile', { userId }))
Logic:
  1. Validate input with storeNameSchema
  2. Check sellerProfile.sellerType === 'BUSINESS' (if PERSONAL, return error)
  3. Check storeSlug uniqueness: SELECT FROM sellerProfile WHERE storeSlug = input.storeSlug AND userId != session.userId
  4. Update sellerProfile: set storeName, storeSlug
  5. Emit audit event: { action: 'STORE_NAME_SET', subjectType: 'SellerProfile', subjectId: <profileId>, actorUserId, metadata: { storeName, storeSlug } }
  6. revalidatePath('/my/selling/onboarding')
  7. Return { success: true }
Output: { success: boolean; error?: string }
```

#### Action 4: `getOnboardingProgressAction`
**File:** `src/lib/actions/seller-onboarding.ts`
**Purpose:** Determine which step of the business onboarding wizard the user is on.

```
Input: none (uses session userId)
Auth: authorize() — must be authenticated
Logic:
  1. Get session via authorize()
  2. Load sellerProfile for userId (may be null if not yet a seller)
  3. Load businessInfo for userId (may be null)
  4. Determine current step:
    - If sellerProfile.sellerType !== 'BUSINESS' && no businessInfo -> Step 1 (business info)
    - If businessInfo exists && !sellerProfile.stripeOnboarded -> Step 2 (payout setup)
    - If sellerProfile.stripeOnboarded && !sellerProfile.storeName -> Step 3 (store profile)
    - If all above done -> Step 4 (complete)
  5. Return { currentStep, isComplete, sellerType, hasBusinessInfo, stripeOnboarded, storeName }
Output: { success: boolean; progress?: OnboardingProgress; error?: string }

type OnboardingProgress = {
  currentStep: 1 | 2 | 3 | 4;
  isComplete: boolean;
  sellerType: 'PERSONAL' | 'BUSINESS';
  hasBusinessInfo: boolean;
  stripeOnboarded: boolean;
  payoutsEnabled: boolean;
  storeName: string | null;
  storeSlug: string | null;
}
```

### 3.3 Validation Schemas

**File:** `src/lib/validations/seller-onboarding.ts`

```typescript
import { z } from 'zod';

const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP'
] as const;

export const businessInfoSchema = z.object({
  businessName: z.string().min(2).max(100),
  businessType: z.enum(['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP']),
  ein: z.string().regex(/^\d{2}-\d{7}$/).optional().or(z.literal('')),
  address1: z.string().min(1).max(200),
  address2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().min(1).max(100),
  state: z.enum(US_STATE_CODES),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US'),
  phone: z.string().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
}).strict();

export const storeNameSchema = z.object({
  storeName: z.string().min(2).max(50),
  storeSlug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/, 'Store URL must contain only lowercase letters, numbers, and hyphens'),
}).strict();

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type StoreNameInput = z.infer<typeof storeNameSchema>;
```

### 3.4 Query

**File:** `src/lib/queries/business-info.ts`

```typescript
export async function getBusinessInfo(userId: string): Promise<BusinessInfoRecord | null>
```

Simple query: select from businessInfo where userId. Returns null if not found.

### 3.5 Pages / Components

#### Page: `/my/selling/onboarding` (REPLACE existing)

The existing `src/app/(hub)/my/selling/onboarding/page.tsx` currently shows only a Stripe Connect card. **Replace it entirely** with the new multi-purpose onboarding page.

**Route:** `/my/selling/onboarding`
**Route per Page Registry:** Row 71 — `Seller Setup | Twicely`, layout: dashboard, gate: AUTH (becoming seller), build phase: G1
**Metadata:** `{ title: 'Seller Setup | Twicely', robots: 'noindex' }`

**Server Component (`page.tsx`):**
1. `authorize()` — redirect to login if unauthenticated
2. Load `sellerProfile`, `businessInfo`, and Stripe status
3. Determine flow type from `?flow=` query param:
   - `?flow=activate`: Personal seller activation (one-click, no wizard)
   - `?flow=business`: Business upgrade wizard
   - Default (no param): auto-detect based on current state
4. Pass data to client component

**Client Component (`onboarding-wizard.tsx`):**

The wizard is a single `'use client'` component with internal step state. It renders one of 4 step components.

**Step Components (can be in separate files if needed for 300-line limit):**

1. `BusinessInfoStep` — form with fields from `businessInfoSchema`. On submit: calls `submitBusinessInfoAction`. On success: advances to step 2.
2. `PayoutSetupStep` — reuses existing Stripe Connect onboarding logic. Button "Set Up Payouts" calls `startOnboardingAction`. Shows status card if partially complete. "Refresh Status" button. On success: advances to step 3.
3. `StoreProfileStep` — form with `storeName` and `storeSlug` fields. Auto-generates slug from name (slugify). Debounced uniqueness check on slug. On submit: calls `updateStoreNameAction`. On success: advances to step 4.
4. `CompletionStep` — success message. Two CTAs: "Create your first listing" (link to `/my/selling/listings/new`) and "Explore subscription plans" (link to `/my/selling/subscription`).

**Progress Bar:** Shows 4 steps with current step highlighted. Steps show checkmark if complete.

**"Start Selling" One-Click Path:**
When `?flow=activate` or user is not a seller and hasn't chosen business:
- Show a simple card: "Start selling on Twicely"
- "Ready to start selling? Your first listing is free."
- Button: "Start Selling" -> calls `enableSellerAction()` -> redirects to `/my/selling/listings/new`
- Beneath: "Looking to open a full business store? Set up a business account" link -> navigates to `?flow=business`

#### Existing selling layout update

The existing `src/app/(hub)/my/selling/layout.tsx` currently shows a "Start selling" CTA for non-sellers. **Modify it** so the "Create your first listing" button also shows a small "or set up a business account" link that goes to `/my/selling/onboarding?flow=business`.

Also, the CTA button should call `enableSellerAction()` via a client component wrapper rather than just linking to the listing creation page. This ensures the seller profile is created BEFORE they navigate to listing creation.

**IMPORTANT:** The existing layout.tsx allows non-sellers through to the create listing page (`isCreateListingPage` check). This behavior should be preserved — `ensureSellerProfile()` in `seller-activate.ts` is already called during listing creation as a safety net.

### 3.6 CASL Rules

No new CASL subjects needed. The existing rules suffice:

- `SellerProfile`: seller can `manage` their own (condition `{ userId }`) -- per `ability.ts` line 172
- `BusinessInfo`: no CASL subject exists, and none is needed. Access is gated via the `SellerProfile` check (same userId). The action checks `ability.can('manage', sub('SellerProfile', { userId }))` before writing to `businessInfo`.

### 3.7 Audit Events

All actions must emit audit events. Use the existing `auditEvent` table pattern.

| Action | Event Type | Subject Type | Notes |
|--------|-----------|--------------|-------|
| `enableSellerAction` | `SELLER_ACTIVATED` | `SellerProfile` | New seller created |
| `submitBusinessInfoAction` | `BUSINESS_UPGRADED` | `SellerProfile` | Personal -> Business |
| `updateStoreNameAction` | `STORE_NAME_SET` | `SellerProfile` | Store name + slug configured |

---

## 4. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- Do NOT use "wallet" anywhere in UI copy — use "payout"
- Do NOT use "Twicely Balance" — use "Available for payout"
- Do NOT use "Withdraw" — use "Request payout"
- Do NOT use "SellerTier" or "SubscriptionTier" — use `StoreTier` or `ListerTier`

### Technical Constraints
- `as any` — zero occurrences
- `@ts-ignore` — zero occurrences
- All files under 300 lines
- No `console.log` in production code
- Zod `.strict()` on all input schemas
- Explicit field mapping on all DB writes (never spread request body)
- All monetary values as integer cents (no money values in this feature, but if any appear, enforce this)
- Ownership via `userId` always (never `sellerProfileId`, never `storeId`)

### Business Logic Constraints
- PERSONAL sellers get NO wizard. Just enable selling and redirect to listing creation.
- Business upgrade is FREE (no charge). The User Model Section 6 is explicit: "Business upgrade is FREE."
- BusinessInfo is required for store subscription (Store Starter+), NOT required for crosslister (any tier).
- The `sellerType` change from PERSONAL to BUSINESS happens atomically with BusinessInfo creation.
- Store name uniqueness must be enforced at DB level (the `storeSlug` column has a unique index).
- Store slug must be validated: lowercase alphanumeric + hyphens only, 2-30 chars.
- Do NOT create a storefront record during onboarding. Storefront creation happens when user subscribes to Store Starter+ (that's a separate flow in subscription management).
- The onboarding wizard must be resumable — if user exits mid-flow, they can return and pick up where they left off.
- Stripe Connect onboarding is handled by external Stripe Hosted Onboarding — user leaves the site and returns. The action just creates the account link.

### Gotchas from Canonical Docs
- `sellerProfile.id` is a CUID2 PK, NOT userId. `sellerProfile.userId` references `user.id`. The ownership check uses `userId`, never `id`.
- The existing `onboarding-client.tsx` references `startOnboardingAction`, `getOnboardingStatusAction`, `getStripeDashboardLinkAction` from `stripe-onboarding.ts`. These actions must continue to work — they are NOT being replaced, only integrated into the wizard.
- The existing `selling/layout.tsx` uses `auth.api.getSession()` directly instead of `authorize()`. The new onboarding page should use `authorize()` for consistency with the codebase pattern established in F6-FIX.
- Hub Canonical Section 6 says: on confirm, set `performanceBand = EMERGING` — this is already the default in the schema.

---

## 5. ACCEPTANCE CRITERIA

### Personal Seller Activation
- [ ] AC-1: A non-seller user can call `enableSellerAction()` and become a seller
- [ ] AC-2: After calling `enableSellerAction()`, `user.isSeller` is `true`
- [ ] AC-3: After calling `enableSellerAction()`, a `sellerProfile` record exists with `sellerType = 'PERSONAL'`, `storeTier = 'NONE'`, `listerTier = 'FREE'`, `status = 'ACTIVE'`, `performanceBand = 'EMERGING'`
- [ ] AC-4: Calling `enableSellerAction()` when already a seller returns `{ success: true, alreadySeller: true }` without error
- [ ] AC-5: An audit event with action `SELLER_ACTIVATED` is emitted
- [ ] AC-6: Unauthenticated users cannot call `enableSellerAction()` (returns error)

### Business Upgrade Wizard
- [ ] AC-7: `submitBusinessInfoAction` creates a `businessInfo` record with all provided fields
- [ ] AC-8: `submitBusinessInfoAction` updates `sellerProfile.sellerType` to `BUSINESS` in the same transaction
- [ ] AC-9: `submitBusinessInfoAction` rejects if `businessInfo` already exists for this user
- [ ] AC-10: `submitBusinessInfoAction` validates input with `businessInfoSchema.strict()` — unknown keys are rejected
- [ ] AC-11: An audit event with action `BUSINESS_UPGRADED` is emitted
- [ ] AC-12: The Payout Setup step (Step 2) correctly calls `startOnboardingAction` and opens Stripe hosted onboarding
- [ ] AC-13: `updateStoreNameAction` sets `storeName` and `storeSlug` on seller profile
- [ ] AC-14: `updateStoreNameAction` rejects if `sellerType !== 'BUSINESS'`
- [ ] AC-15: `updateStoreNameAction` rejects if `storeSlug` is already taken by another user
- [ ] AC-16: An audit event with action `STORE_NAME_SET` is emitted
- [ ] AC-17: The wizard correctly determines the current step based on existing data (resume behavior)
- [ ] AC-18: All Zod schemas use `.strict()` mode

### UI
- [ ] AC-19: The onboarding page at `/my/selling/onboarding` renders without errors
- [ ] AC-20: The progress bar shows 4 steps with the current step highlighted
- [ ] AC-21: Completed steps show a checkmark icon
- [ ] AC-22: The "Start Selling" one-click path (for PERSONAL activation) is available and works
- [ ] AC-23: The "Set up a business account" link navigates to `?flow=business`
- [ ] AC-24: Step 3 (store profile) auto-generates slug from store name
- [ ] AC-25: Step 4 (completion) shows CTAs for "Create your first listing" and "Explore subscription plans"

### Authorization
- [ ] AC-26: Unauthenticated users are redirected to `/auth/login?callbackUrl=/my/selling/onboarding`
- [ ] AC-27: All actions check CASL ability before making changes
- [ ] AC-28: `sellerId` and `userId` are derived from session, never from request body

### Data Integrity
- [ ] AC-29: `businessInfo.userId` has a unique constraint (one businessInfo per user)
- [ ] AC-30: `sellerProfile.storeSlug` has a unique constraint
- [ ] AC-31: BusinessInfo creation and sellerType update happen in a DB transaction
- [ ] AC-32: No banned terms appear in any UI text or code comments

### Route
- [ ] AC-33: The route is `/my/selling/onboarding` (not `/my/selling/setup`, not `/dashboard/onboarding`)
- [ ] AC-34: The page title is `Seller Setup | Twicely`
- [ ] AC-35: The page has `robots: 'noindex'`

---

## 6. TEST REQUIREMENTS

**File:** `src/lib/actions/__tests__/seller-onboarding.test.ts`

### Unit Tests for `enableSellerAction`
1. "creates seller profile and sets isSeller=true for non-seller"
2. "returns alreadySeller=true if user is already a seller"
3. "returns error for unauthenticated user"
4. "emits SELLER_ACTIVATED audit event"

### Unit Tests for `submitBusinessInfoAction`
5. "creates businessInfo and updates sellerType to BUSINESS"
6. "rejects if businessInfo already exists"
7. "rejects unknown fields (strict mode)"
8. "rejects invalid EIN format"
9. "rejects invalid zip code format"
10. "rejects invalid state code"
11. "returns error for unauthenticated user"
12. "returns error if CASL forbids"
13. "emits BUSINESS_UPGRADED audit event"
14. "creates businessInfo and sellerType update in same transaction"

### Unit Tests for `updateStoreNameAction`
15. "sets storeName and storeSlug on seller profile"
16. "rejects if sellerType is PERSONAL"
17. "rejects if storeSlug already taken"
18. "rejects invalid storeSlug format (uppercase, special chars)"
19. "returns error for unauthenticated user"
20. "emits STORE_NAME_SET audit event"

### Unit Tests for `getOnboardingProgressAction`
21. "returns step 1 for seller with no businessInfo"
22. "returns step 2 for seller with businessInfo but no Stripe"
23. "returns step 3 for seller with Stripe but no storeName"
24. "returns step 4 (complete) when all steps done"
25. "returns progress for non-seller user"

### Unit Tests for Validation Schemas
**File:** `src/lib/validations/__tests__/seller-onboarding.test.ts`
26. "businessInfoSchema accepts valid input"
27. "businessInfoSchema rejects missing businessName"
28. "businessInfoSchema rejects invalid businessType"
29. "businessInfoSchema rejects invalid EIN format"
30. "businessInfoSchema rejects unknown keys (strict)"
31. "storeNameSchema accepts valid input"
32. "storeNameSchema rejects uppercase in storeSlug"
33. "storeNameSchema rejects special chars in storeSlug"
34. "storeNameSchema rejects slug under 2 chars"

### Test Patterns

Follow the existing test patterns in the codebase:
- `vi.mock('@/lib/casl', ...)` for authorize
- `vi.mock('@/lib/db', ...)` for database
- Use `selectChain` / `insertChain` helpers if they exist in the test helpers
- Mock `revalidatePath` from `next/cache`
- Session mock: `{ userId: 'user1', isSeller: true/false, ... }`
- Ability mock: `{ can: vi.fn(() => true/false) }`

---

## 7. FILE APPROVAL LIST

### New Files

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/actions/seller-onboarding.ts` | Server actions: enableSellerAction, submitBusinessInfoAction, updateStoreNameAction, getOnboardingProgressAction |
| 2 | `src/lib/validations/seller-onboarding.ts` | Zod schemas: businessInfoSchema, storeNameSchema |
| 3 | `src/lib/queries/business-info.ts` | Query: getBusinessInfo(userId) |
| 4 | `src/app/(hub)/my/selling/onboarding/onboarding-wizard.tsx` | Client component: multi-step wizard with progress bar |
| 5 | `src/app/(hub)/my/selling/onboarding/steps/business-info-step.tsx` | Step 1: business information form |
| 6 | `src/app/(hub)/my/selling/onboarding/steps/payout-setup-step.tsx` | Step 2: Stripe Connect payout setup |
| 7 | `src/app/(hub)/my/selling/onboarding/steps/store-profile-step.tsx` | Step 3: store name + slug form |
| 8 | `src/app/(hub)/my/selling/onboarding/steps/completion-step.tsx` | Step 4: completion with CTAs |
| 9 | `src/lib/actions/__tests__/seller-onboarding.test.ts` | Tests for all 4 server actions (~25 tests) |
| 10 | `src/lib/validations/__tests__/seller-onboarding.test.ts` | Tests for Zod validation schemas (~9 tests) |

### Modified Files

| # | File Path | Description |
|---|-----------|-------------|
| 11 | `src/app/(hub)/my/selling/onboarding/page.tsx` | REPLACE: new server component with flow detection and data loading |
| 12 | `src/app/(hub)/my/selling/layout.tsx` | MODIFY: add "or set up business account" link to the non-seller CTA |

### Deleted Files

| # | File Path | Reason |
|---|-----------|--------|
| 13 | `src/app/(hub)/my/selling/onboarding/onboarding-client.tsx` | REPLACED by `onboarding-wizard.tsx` (the Stripe-only client is being integrated into the wizard as Step 2) |

---

## 8. VERIFICATION CHECKLIST

After implementation, run these checks and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Run the lint script
./twicely-lint.sh

# 4. Verify no banned terms in new files
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|Twicely Balance\|wallet\|Withdraw" \
  src/lib/actions/seller-onboarding.ts \
  src/lib/validations/seller-onboarding.ts \
  src/lib/queries/business-info.ts \
  "src/app/(hub)/my/selling/onboarding/"

# 5. Check file sizes
wc -l src/lib/actions/seller-onboarding.ts \
  src/lib/validations/seller-onboarding.ts \
  src/lib/queries/business-info.ts \
  src/app/\(hub\)/my/selling/onboarding/*.tsx \
  src/app/\(hub\)/my/selling/onboarding/steps/*.tsx

# 6. Verify test count >= baseline (3550)
# Paste the full test summary line

# 7. Verify route is correct
grep -rn "/my/selling/onboarding" src/app/ --include="*.tsx" --include="*.ts"
```

### Expected Outcomes
1. TypeScript: 0 errors
2. Tests: >= 3550 + ~34 new tests = ~3584
3. Lint: all checks pass
4. Banned terms: 0 matches
5. All files under 300 lines
6. Test count did not decrease
7. Route `/my/selling/onboarding` exists and is correct

---

## 9. SPEC RECONCILIATION NOTES

### Hub Canonical vs Feature Lock-in Tension

The Hub Canonical Section 6 says "NO multi-step onboarding wizard for personal sellers" and describes a one-click activation flow. The Feature Lock-in Section 13 describes a 4-step "Seller First-Run" wizard.

**Resolution:** These describe two different paths:
- Hub Canonical Section 6 = the PERSONAL seller activation (no wizard, just enable + redirect)
- Feature Lock-in Section 13 = the BUSINESS upgrade wizard (guided setup for store sellers)

The Feature Lock-in's steps map to the BUSINESS wizard: Step 1 = store name (business info), Step 2 = shipping profile (deferred — already exists as separate page at `/my/selling/shipping`), Step 3 = payout setup (Stripe Connect), Step 4 = create listing CTA. G1-B reorders these to: business info -> payout setup -> store profile -> completion.

### Feature Lock-in Step 2 (Shipping Profile)

The Feature Lock-in mentions "Shipping profile (default carrier, handling time, return policy)" as Step 2. This is NOT included in the onboarding wizard because:
1. Shipping profiles already exist as a full feature at `/my/selling/shipping` (Phase B5.1)
2. The onboarding wizard focuses on the three gates that block store access: business info, Stripe Connect, and store identity
3. Shipping profiles can be set up at any time and are not a gate for any functionality

This is an editorial decision, not a spec deviation. The shipping profile step is shown as a "recommended next step" in the completion screen but is not part of the wizard flow.

### NOT SPECIFIED — Owner Decision Needed

1. **Store slug reserved words:** Should we maintain a list of reserved slugs (e.g., "admin", "api", "help", "support")? The schema has a unique constraint but no reserved word list. Recommendation: yes, add a small blocklist. **Decision needed.**

2. **Business info edit flow:** After initial creation, how does a user edit their business info? The current scope only covers creation. An `updateBusinessInfoAction` would be a natural follow-up but is not specified in the build tracker. **Decision needed: include in G1-B or defer?**

3. **EIN encryption:** The schema doc Section 2.4 says `ein` should be "Encrypted at application layer." The current `businessInfo` table in `identity.ts` stores `ein` as plain `text('ein')`. Should G1-B implement encryption, or is this deferred to a security hardening pass? **Decision needed.**
