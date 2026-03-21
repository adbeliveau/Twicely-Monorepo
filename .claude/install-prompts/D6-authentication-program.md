# D6 — Authentication Program (Item Authentication & Verification)

**Phase & Step:** [D6] (includes D6.1, D6.2, D6.3, D6.4)
**Feature Name:** Item Authentication Program — Verified Seller Badge, Expert Human Authentication, Certificate System, Photo Fingerprinting
**One-line Summary:** Build the multi-tier item authentication system: Tier 1 Verified Seller badge (seller credential verification), Tier 3 Expert Human Authentication (partner network + request flow), per-item certificate system with public verification URL, and pHash photo fingerprinting for anti-fraud.
**Status:** QUEUED
**Depends on:** C5 (Buyer Protection) -- DONE

**IMPORTANT DISAMBIGUATION:** This is an ITEM authentication/verification system, NOT user login authentication. "Authentication" here means verifying that items (handbags, watches, sneakers, etc.) are genuine/authentic -- NOT user identity verification (which is KYC, covered in G4).

---

## Canonical Sources (MUST read before starting)

| Document | Relevance |
|----------|-----------|
| `TWICELY_V3_FEATURE_LOCKIN_ADDENDUM.md` section 48 | PRIMARY: Authentication Program -- tiers, cost split, certificate system, pHash, buyer declination, platform settings |
| `TWICELY_V3_BUYER_PROTECTION_CANONICAL.md` section 6 | Authentication program overview, tiers, cost split, certificate system, external auth policy, liability boundaries |
| `TWICELY_V3_DECISION_RATIONALE.md` decisions #39 and #40 | LOCKED: Cost split model (50/50 on authentic), never trust external authentication, three principles (pHash, per-item certs, no external badges) |
| `TWICELY_V3_SCHEMA_v2_0_7.md` sections 1.3, 5.1, 8.1, 19.4, 19.5 | `authenticationStatusEnum`, `listing.authenticationStatus`, `listing.authenticationRequestId`, `order.authenticationOffered/Declined/RequestId`, `authenticationRequest` table, `authenticatorPartner` table |
| `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` section 14 | Authentication pricing: buyer $19.99, seller $19.99, expert $39.99, Stripe product mapping |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` sections 3.3, 3.6 | Seller CASL rules (listings, orders), Admin manage all |
| `TWICELY_V3_USER_MODEL.md` | `sellerProfile.isAuthenticatedSeller` boolean field |
| `TWICELY_V3_PAGE_REGISTRY.md` | Listing detail page `/i/[slug]` (badge display), seller pages under `/my/selling` |
| `TWICELY_V3_SELLER_SCORE_CANONICAL.md` sections 3.1, 5, 8 | Performance band badges (separate from auth badges), buyer-visible badge rules |
| `TWICELY_V3_TESTING_STANDARDS.md` | Testing patterns, authentication state machine transitions |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` section 10 | Trust-related platform settings pattern |

---

## 1. PREREQUISITES

### Must Be Complete
- C5 (Buyer Protection) -- DONE. Claims, dispute resolution, counterfeit handling, return flows.
- A3 (Auth -- Better Auth) -- DONE. Session management.
- A4 (CASL setup) -- DONE. `authorize()`, subjects, ability factory.
- B1/B4 (Listings, Orders) -- DONE. Listing CRUD, order creation, listing detail page.

### Already Existing (DO NOT recreate)

- **Schema tables:** `authenticationRequest` and `authenticatorPartner` tables ALREADY EXIST at `src/lib/db/schema/authentication.ts`. They match the schema doc v2.0.7 exactly. DO NOT recreate or modify.
- **Enum:** `authenticationStatusEnum` ALREADY EXISTS at `src/lib/db/schema/enums.ts` (lines 57-62):
  ```
  'NONE', 'SELLER_VERIFIED',
  'AI_PENDING', 'AI_AUTHENTICATED', 'AI_INCONCLUSIVE', 'AI_COUNTERFEIT',
  'EXPERT_PENDING', 'EXPERT_AUTHENTICATED', 'EXPERT_COUNTERFEIT',
  'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED'
  ```
- **Schema re-export:** `src/lib/db/schema/index.ts` line 26: `export * from './authentication';`
- **Listing table:** `listing.authenticationStatus` and `listing.authenticationRequestId` columns ALREADY EXIST in `src/lib/db/schema/listings.ts` (lines 750-751).
- **Order table:** `order.authenticationOffered`, `order.authenticationDeclined`, `order.authenticationDeclinedAt`, `order.authenticationRequestId` columns ALREADY EXIST in `src/lib/db/schema/commerce.ts` (lines 988-991).
- **Seller profile:** `sellerProfile.isAuthenticatedSeller` boolean ALREADY EXISTS in `src/lib/db/schema/identity.ts` (line 348).
- **CASL subjects:** `Listing`, `Order`, `SellerProfile`, `Setting` subjects exist in `src/lib/casl/subjects.ts`.
- **Platform settings query:** `getPlatformSetting()` and `getPlatformSettingsByPrefix()` exist at `src/lib/queries/platform-settings.ts`.
- **Listing detail page:** `/i/[slug]` page exists with seller card, badges already shown via `SellerRatingSummary` (performance band badges).

### Dependencies (npm packages)
- **New:** `sharp` (for pHash computation -- perceptual hashing of images). Already available as a Next.js peer dependency. No additional install needed.
- **Existing:** `@paralleldrive/cuid2`, `zod`, `drizzle-orm`, `@casl/ability`, `next`.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

This feature decomposes into four sequential sub-steps (D6 through D6.4). All four are covered in this single install prompt.

### SUB-STEP OVERVIEW

| Step | Name | What It Builds |
|------|------|----------------|
| D6 | Authentication Program Infrastructure | Constants, types, CASL subject, platform settings seed, pHash utility |
| D6.1 | Tier 1: Verified Seller Badge | Seller verification request flow, staff review, badge display on profile + listings |
| D6.2 | Tier 3: Expert Human Authentication | Partner management (admin), authentication request flow (seller-initiated + buyer-initiated), cost split logic |
| D6.3 | Certificate System + Verify URL | Certificate generation (TW-AUTH-XXXXX), public verification page at `/verify/[certNumber]`, certificate invalidation on relist |
| D6.4 | Photo Fingerprinting (pHash) | Perceptual hash computation, storage, comparison for anti-fraud |

---

### 2.1 Database

**No new tables or columns needed.** All tables and columns already exist in schema. Verify the following exist before starting:

1. `authenticatorPartner` table (src/lib/db/schema/authentication.ts lines 7-19)
2. `authenticationRequest` table (src/lib/db/schema/authentication.ts lines 21-53)
3. `listing.authenticationStatus` column (src/lib/db/schema/listings.ts line 750)
4. `listing.authenticationRequestId` column (src/lib/db/schema/listings.ts line 751)
5. `order.authenticationOffered` column (src/lib/db/schema/commerce.ts line 988)
6. `order.authenticationDeclined` column (src/lib/db/schema/commerce.ts line 989)
7. `order.authenticationDeclinedAt` column (src/lib/db/schema/commerce.ts line 990)
8. `order.authenticationRequestId` column (src/lib/db/schema/commerce.ts line 991)
9. `sellerProfile.isAuthenticatedSeller` column (src/lib/db/schema/identity.ts line 348)
10. `authenticationStatusEnum` enum (src/lib/db/schema/enums.ts lines 57-62)

**No new migration needed** -- these all exist from prior Phase C schema addenda.

### 2.2 Platform Settings (seed values)

Source: Feature Lock-in Addendum section 48, Pricing Canonical section 14.

| Key | Value | Type | Category | Label | Editable |
|-----|-------|------|----------|-------|----------|
| `trust.authentication.offerThresholdCents` | `50000` | `INTEGER` | `trust` | `Show auth option on items above this price (cents)` | `true` |
| `trust.authentication.buyerFeeCents` | `1999` | `INTEGER` | `trust` | `Buyer authentication fee (cents)` | `true` |
| `trust.authentication.sellerFeeCents` | `1999` | `INTEGER` | `trust` | `Seller authentication fee (cents)` | `true` |
| `trust.authentication.expertFeeCents` | `3999` | `INTEGER` | `trust` | `Expert human authentication fee (cents)` | `true` |
| `trust.authentication.expertHighValueFeeCents` | `6999` | `INTEGER` | `trust` | `Expert authentication fee for high-value items (cents)` | `true` |
| `trust.authentication.mandatoryAboveCents` | `null` | `INTEGER` | `trust` | `Mandatory authentication above this price (null = never)` | `true` |

These must be seeded via the existing platform settings seed mechanism. The Pricing Canonical section 14 lists setting keys as `auth.buyerFeeCents`, `auth.sellerFeeCents`, `auth.expertFeeCents` -- but the Feature Lock-in Addendum uses `trust.authentication.*` prefix which is consistent with the existing trust category pattern in the Platform Settings Canonical. **Use the `trust.authentication.*` prefix** as it matches the existing pattern and is more specific.

**NOT SPECIFIED -- owner decision needed:** The Pricing Canonical uses `auth.*` keys while the Feature Lock-in Addendum uses `trust.authentication.*` keys. These are inconsistent. This prompt uses `trust.authentication.*` to match the existing trust settings pattern. If the owner prefers `auth.*`, all key references in this prompt must be updated.

### 2.3 CASL Rules

**New subject needed:** Add `AuthenticationRequest` to the CASL subjects list.

File: `src/lib/casl/subjects.ts`

Add `'AuthenticationRequest'` to the `SUBJECTS` array.

**Ability rules:**

In `src/lib/casl/ability.ts`:

**Buyer abilities** (in `defineBuyerAbilities`):
```typescript
// Authentication - buyer can request authentication on orders they own
can('create', 'AuthenticationRequest', { buyerId: userId });
can('read', 'AuthenticationRequest', { buyerId: userId });
```

**Seller abilities** (in `defineSellerAbilities`):
```typescript
// Authentication - seller can request pre-listing auth and read auth on their listings
can('create', 'AuthenticationRequest', { sellerId });
can('read', 'AuthenticationRequest', { sellerId });
can('update', 'AuthenticationRequest', { sellerId }); // submit photos, update status
```

**Staff abilities** (in `defineStaffAbilities`):
- Staff with `listings.manage` scope can read authentication requests for their delegated seller.
- Staff CANNOT create authentication requests (owner-only financial action).

**Admin abilities:**
- Admin has `manage` on ALL subjects, including `AuthenticationRequest` -- already covered by existing admin rule.

### 2.4 Constants & Types

**File: `src/lib/authentication/constants.ts`** (NEW)

```typescript
// Authentication tiers
export const AUTHENTICATION_TIERS = {
  VERIFIED_SELLER: 'VERIFIED_SELLER', // Tier 1: Free, seller credentials
  AI: 'AI',                           // Tier 2: Deferred to G10.2
  EXPERT: 'EXPERT',                   // Tier 3: Expert human inspection
} as const;

export type AuthenticationTier = typeof AUTHENTICATION_TIERS[keyof typeof AUTHENTICATION_TIERS];

// Authentication initiators
export const AUTHENTICATION_INITIATORS = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
} as const;

export type AuthenticationInitiator = typeof AUTHENTICATION_INITIATORS[keyof typeof AUTHENTICATION_INITIATORS];

// Authentication status groups (for UI logic)
export const AUTH_STATUS_AUTHENTICATED = [
  'SELLER_VERIFIED',
  'AI_AUTHENTICATED',
  'EXPERT_AUTHENTICATED',
] as const;

export const AUTH_STATUS_PENDING = [
  'AI_PENDING',
  'EXPERT_PENDING',
] as const;

export const AUTH_STATUS_FAILED = [
  'AI_COUNTERFEIT',
  'EXPERT_COUNTERFEIT',
] as const;

export const AUTH_STATUS_INVALID = [
  'CERTIFICATE_EXPIRED',
  'CERTIFICATE_REVOKED',
] as const;

// Certificate number prefix
export const CERTIFICATE_PREFIX = 'TW-AUTH-';

// Authenticator specialties
export const AUTHENTICATOR_SPECIALTIES = [
  'HANDBAGS',
  'WATCHES',
  'SNEAKERS',
  'TRADING_CARDS',
  'JEWELRY',
  'ELECTRONICS',
  'DESIGNER_CLOTHING',
  'ART',
] as const;

export type AuthenticatorSpecialty = typeof AUTHENTICATOR_SPECIALTIES[number];

// Platform settings keys
export const AUTH_SETTINGS_KEYS = {
  OFFER_THRESHOLD_CENTS: 'trust.authentication.offerThresholdCents',
  BUYER_FEE_CENTS: 'trust.authentication.buyerFeeCents',
  SELLER_FEE_CENTS: 'trust.authentication.sellerFeeCents',
  EXPERT_FEE_CENTS: 'trust.authentication.expertFeeCents',
  EXPERT_HIGH_VALUE_FEE_CENTS: 'trust.authentication.expertHighValueFeeCents',
  MANDATORY_ABOVE_CENTS: 'trust.authentication.mandatoryAboveCents',
} as const;
```

**File: `src/lib/authentication/types.ts`** (NEW)

```typescript
export type AuthenticationRequestResult = {
  id: string;
  listingId: string;
  orderId: string | null;
  sellerId: string;
  buyerId: string | null;
  initiator: string;
  tier: string;
  status: string;
  totalFeeCents: number;
  buyerFeeCents: number | null;
  sellerFeeCents: number | null;
  refundedBuyerCents: number;
  certificateNumber: string | null;
  certificateUrl: string | null;
  verifyUrl: string | null;
  photosHash: string | null;
  photoUrls: string[] | null;
  resultNotes: string | null;
  authenticatorId: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export type AuthenticatorPartnerSummary = {
  id: string;
  name: string;
  specialties: string[];
  isActive: boolean;
  completedCount: number;
  accuracyRate: number | null;
  avgTurnaroundHours: number | null;
};

export type CertificateVerification = {
  certificateNumber: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND';
  authenticationType: string | null;
  authenticationDate: Date | null;
  listingTitle: string | null;
  listingThumbnailUrl: string | null;
  authenticatorName: string | null;
  photoUrls: string[] | null;
  message: string;
};

export type AuthCostSplit = {
  totalFeeCents: number;
  buyerShareCents: number;
  sellerShareCents: number;
};
```

### 2.5 Server Actions

#### File: `src/lib/actions/authentication.ts` (NEW)

All actions use `'use server'` directive. All inputs validated with Zod strict schemas. All check CASL authorization via `authorize()`.

**Action 1: `requestVerifiedSellerBadge`** (D6.1)

Seller requests Tier 1 Verified Seller status.

Input:
```typescript
const requestVerifiedSellerSchema = z.object({
  // Seller provides sourcing documentation references
  sourcingDocUrls: z.array(z.string().url()).min(1).max(10),
  sourcingNotes: z.string().max(2000).optional(),
}).strict();
```

Logic:
1. `authorize()` -- verify seller session, NOT delegated staff.
2. Verify `ability.can('update', sub('SellerProfile', { id: session.sellerId }))`.
3. Verify seller does NOT already have `isAuthenticatedSeller = true`.
4. Create an `authenticationRequest` record:
   - `listingId`: use a placeholder/null -- **NOT SPECIFIED: The schema requires `listingId` as NOT NULL. This is a seller-level verification, not item-level. Owner decision needed: should we use the seller's first active listing, or should we allow null for Tier 1 requests?** For now, use the seller's first active listing as a reference point, or create a special constant. The installer should flag this.
   - `sellerId`: `session.userId` (ownership is ALWAYS via userId)
   - `initiator`: `'SELLER'`
   - `tier`: `'EXPERT'` -- Tier 1 uses the same flow conceptually but with staff review instead of external expert. Use a dedicated status.
   - `status`: `'EXPERT_PENDING'` initially
   - `totalFeeCents`: 0 (Tier 1 is FREE)
   - `buyerFeeCents`: null
   - `sellerFeeCents`: 0
5. Return `{ success: true }`.
6. `revalidatePath('/my/selling/store')`.

**IMPORTANT ARCHITECTURE NOTE:** Tier 1 "Verified Seller" is a seller-level badge, NOT a per-item authentication. It does NOT create per-item certificates. It sets `sellerProfile.isAuthenticatedSeller = true` after staff approval. This is fundamentally different from Tier 3 (per-item). The `authenticationRequest` table is designed for per-item requests (it has `listingId` NOT NULL).

**NOT SPECIFIED -- owner decision needed:** The `authenticationRequest.listingId` is NOT NULL in the schema, but Tier 1 Verified Seller is a seller-level badge, not a per-item authentication. Options:
- (A) Store the Verified Seller request in a separate table or use `listingId` as a nullable override
- (B) Use the `authenticationRequest` table with a sentinel listingId value
- (C) Skip the `authenticationRequest` table for Tier 1 and just set `isAuthenticatedSeller` directly after staff approval

**Recommended: Option C** -- Tier 1 is a seller credential review, not an item authentication. Use a direct admin action to set `isAuthenticatedSeller = true` on the seller profile, with an audit event. The `authenticationRequest` table is for per-item authentication (Tier 2 and 3 only).

**Action 2: `approveVerifiedSeller`** (D6.1 -- admin/staff action)

Platform staff approves a seller's Verified Seller application.

Input:
```typescript
const approveVerifiedSellerSchema = z.object({
  sellerId: z.string().cuid2(),
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
}).strict();
```

Logic:
1. `authorize()` -- verify platform staff/admin session.
2. Verify `ability.can('manage', 'SellerProfile')` (admin only).
3. Load seller profile by `sellerId` (which is `sellerProfile.id`). Get the `userId` from the profile.
4. If `approved`:
   - Set `sellerProfile.isAuthenticatedSeller = true`.
   - Log audit event: `SELLER_VERIFIED_APPROVED`.
5. If not approved:
   - Log audit event: `SELLER_VERIFIED_DENIED` with notes.
6. `revalidatePath('/my/selling/store')`.
7. Return `{ success: true }`.

**Action 3: `requestItemAuthentication`** (D6.2)

Seller or buyer requests Tier 3 Expert Human Authentication for a specific item.

Input:
```typescript
const requestItemAuthSchema = z.object({
  listingId: z.string().cuid2(),
  orderId: z.string().cuid2().optional(), // Present if buyer-initiated at checkout
  tier: z.literal('EXPERT'),
  photoUrls: z.array(z.string().url()).min(3).max(20), // Auth photos
}).strict();
```

Logic:
1. `authorize()` -- get session.
2. Load listing. Verify listing exists and is in a valid state (ACTIVE or part of an order).
3. Determine initiator from session:
   - If `session.userId === listing.ownerUserId` -> `SELLER` initiated.
   - If `orderId` is provided and `session.userId` matches `order.buyerId` -> `BUYER` initiated.
   - Otherwise -> forbidden.
4. Verify `ability.can('create', sub('AuthenticationRequest', { sellerId: listing.ownerUserId }))` for sellers, or `ability.can('create', sub('AuthenticationRequest', { buyerId: session.userId }))` for buyers.
5. Read fee from platform settings:
   - Expert: `getPlatformSetting('trust.authentication.expertFeeCents', 3999)`
   - If item price >= high-value threshold (future), use `expertHighValueFeeCents`.
6. Calculate cost split (source: Decision Rationale #39):
   - Seller-initiated pre-listing: seller pays full `totalFeeCents`.
   - Buyer-initiated: buyer pays full `totalFeeCents` upfront. If authentic -> 50/50 split settled from payout. If counterfeit -> seller pays all.
   - At creation time, record `totalFeeCents` and set `buyerFeeCents` and `sellerFeeCents` to null (settled on completion).
7. Generate certificate number: `TW-AUTH-` + 5 random alphanumeric uppercase characters (e.g., `TW-AUTH-X7K9M`).
8. Create `authenticationRequest` record with:
   - `status`: `'EXPERT_PENDING'`
   - `totalFeeCents`: fee from platform settings
   - `certificateNumber`: generated
   - `verifyUrl`: `https://twicely.co/verify/${certificateNumber}`
   - `photoUrls`: from input
9. Update `listing.authenticationStatus` = `'EXPERT_PENDING'`.
10. Update `listing.authenticationRequestId` = new request ID.
11. Return `{ success: true, requestId, certificateNumber }`.
12. `revalidatePath('/i/[slug]')`.

**Action 4: `completeAuthentication`** (D6.2 -- admin/authenticator action)

Authenticator or admin records the result of an expert authentication.

Input:
```typescript
const completeAuthSchema = z.object({
  requestId: z.string().cuid2(),
  result: z.enum(['AUTHENTICATED', 'COUNTERFEIT', 'INCONCLUSIVE']),
  resultNotes: z.string().max(5000).optional(),
  authenticatorId: z.string().cuid2().optional(),
}).strict();
```

Logic:
1. `authorize()` -- verify admin/staff session. `ability.can('manage', 'AuthenticationRequest')`.
2. Load authentication request. Verify `status` is `'EXPERT_PENDING'`.
3. Based on `result`:
   - **AUTHENTICATED:**
     - Set `status` = `'EXPERT_AUTHENTICATED'`.
     - Set `completedAt` = now.
     - Set `expiresAt` = null (no expiry for expert auth -- per Decision #40, cert invalidates on relist instead).
     - Calculate cost split per Decision #39:
       - If `initiator === 'SELLER'`: `sellerFeeCents` = `totalFeeCents`, `buyerFeeCents` = 0.
       - If `initiator === 'BUYER'`: split 50/50. `buyerFeeCents` = floor(totalFeeCents / 2), `sellerFeeCents` = totalFeeCents - buyerFeeCents.
     - Update `listing.authenticationStatus` = `'EXPERT_AUTHENTICATED'`.
     - Generate `certificateUrl` (URL to a rendered certificate page/PDF).
   - **COUNTERFEIT:**
     - Set `status` = `'EXPERT_COUNTERFEIT'`.
     - Set `completedAt` = now.
     - If `initiator === 'BUYER'`: `buyerFeeCents` = 0, `refundedBuyerCents` = `totalFeeCents`. Seller pays full: `sellerFeeCents` = `totalFeeCents`.
     - If `initiator === 'SELLER'`: `sellerFeeCents` = `totalFeeCents`. Listing blocked/removed.
     - Update `listing.authenticationStatus` = `'EXPERT_COUNTERFEIT'`.
     - Update `listing.enforcementState` = `'REMOVED'` (counterfeit = listing removed).
     - Issue strike against seller (log audit event, increment seller enforcement counter).
   - **INCONCLUSIVE** (rare for experts but handle gracefully):
     - Twicely absorbs cost. `buyerFeeCents` = 0, `sellerFeeCents` = 0, `refundedBuyerCents` = totalFeeCents (if buyer paid).
     - Set `status` = `'NONE'` (reset). Update listing accordingly.
4. Set `resultNotes`, `authenticatorId`.
5. `revalidatePath` for listing and order pages.
6. Return `{ success: true }`.

**Action 5: `submitAuthenticationPhotos`** (D6.4)

Seller or authenticator submits/updates photos for an authentication request. pHash is computed server-side.

Input:
```typescript
const submitPhotosSchema = z.object({
  requestId: z.string().cuid2(),
  photoUrls: z.array(z.string().url()).min(3).max(20),
}).strict();
```

Logic:
1. `authorize()`. Verify session can update this request.
2. Load request. Verify status is `*_PENDING`.
3. Compute pHash for each photo (see section 2.8).
4. Combine individual pHashes into a composite hash string.
5. Update `authenticationRequest.photoUrls` and `authenticationRequest.photosHash`.
6. Return `{ success: true }`.

**Action 6: `invalidateCertificate`** (D6.3)

Called when a listing is relisted or ended. Certificates die with the transaction.

Input:
```typescript
const invalidateCertSchema = z.object({
  listingId: z.string().cuid2(),
  reason: z.enum(['RELISTED', 'LISTING_ENDED', 'ADMIN_REVOKED', 'FRAUD_DETECTED']),
}).strict();
```

Logic:
1. `authorize()` -- admin or system action.
2. Find all `authenticationRequest` records for this `listingId` with status in `AUTH_STATUS_AUTHENTICATED`.
3. Update their status to `'CERTIFICATE_REVOKED'` if reason is `'ADMIN_REVOKED'` or `'FRAUD_DETECTED'`, or `'CERTIFICATE_EXPIRED'` if reason is `'RELISTED'` or `'LISTING_ENDED'`.
4. Update `listing.authenticationStatus` to `'CERTIFICATE_EXPIRED'` or `'CERTIFICATE_REVOKED'`.
5. Clear `listing.authenticationRequestId`.
6. Log audit event.
7. Return `{ success: true }`.

**CRITICAL BUSINESS RULE:** When a listing is relisted, the old certificate MUST be invalidated. Certificates do NOT transfer. This action must be called from the relist flow. Source: Decision Rationale #40, Feature Lock-in Addendum section 48.

### 2.6 Server Queries

#### File: `src/lib/queries/authentication.ts` (NEW)

**Query 1: `getAuthenticationRequestById`**

```typescript
export async function getAuthenticationRequestById(
  requestId: string
): Promise<AuthenticationRequestResult | null>
```

Joins `authenticationRequest` with `authenticatorPartner` (optional) for display.

**Query 2: `getAuthenticationRequestsForListing`**

```typescript
export async function getAuthenticationRequestsForListing(
  listingId: string
): Promise<AuthenticationRequestResult[]>
```

Returns all authentication requests for a listing, ordered by `createdAt DESC`.

**Query 3: `getAuthenticationRequestsForSeller`**

```typescript
export async function getAuthenticationRequestsForSeller(
  sellerId: string,
  filters?: { status?: string; limit?: number; offset?: number }
): Promise<{ requests: AuthenticationRequestResult[]; total: number }>
```

Returns paginated authentication requests for a seller's listings.

**Query 4: `verifyCertificate`** (D6.3 -- public, no auth required)

```typescript
export async function verifyCertificate(
  certificateNumber: string
): Promise<CertificateVerification>
```

Logic:
1. Look up `authenticationRequest` by `certificateNumber`.
2. If not found: return `{ status: 'NOT_FOUND', message: 'Certificate not found' }`.
3. If found, check status:
   - `EXPERT_AUTHENTICATED` -> `VALID`
   - `AI_AUTHENTICATED` -> `VALID`
   - `CERTIFICATE_EXPIRED` -> `EXPIRED`, message: "This certificate was issued for a previous listing."
   - `CERTIFICATE_REVOKED` -> `REVOKED`, message: "This certificate has been revoked."
4. Join with listing for title + thumbnail. Join with authenticatorPartner for name.
5. Return `CertificateVerification` object with photos for visual comparison.

**Query 5: `getAuthenticatorPartners`** (admin only)

```typescript
export async function getAuthenticatorPartners(
  filters?: { isActive?: boolean; specialty?: string }
): Promise<AuthenticatorPartnerSummary[]>
```

**Query 6: `getAuthenticationBadgeForListing`**

```typescript
export async function getAuthenticationBadgeForListing(
  listingId: string
): Promise<{ status: string; badgeLabel: string | null; certificateNumber: string | null } | null>
```

Returns the current authentication badge info for display on listing cards and detail page. Returns null if status is `'NONE'`.

Badge labels per status (source: Feature Lock-in Addendum section 48):
- `SELLER_VERIFIED`: "Verified Seller" (displayed on seller profile, NOT per-item)
- `EXPERT_AUTHENTICATED`: "Expert Authenticated"
- `EXPERT_PENDING`: "Authentication Pending"
- `AI_AUTHENTICATED`: "AI Authenticated" (deferred, but handle for completeness)
- All others: null (no badge)

**Query 7: `getSellerVerificationStatus`** (D6.1)

```typescript
export async function getSellerVerificationStatus(
  userId: string
): Promise<{ isVerified: boolean }>
```

Reads `sellerProfile.isAuthenticatedSeller` for the given userId.

### 2.7 Pages & Components

#### D6.3: Public Certificate Verification Page

**Route: `/verify/[certNumber]/page.tsx`** (NEW)

NOT SPECIFIED in the Page Registry. The Decision Rationale #40 specifies the URL as `twicely.co/verify/TW-AUTH-XXXXX`. This is a PUBLIC page (no auth required). Add it under `src/app/(marketplace)/verify/[certNumber]/page.tsx`.

**NOT SPECIFIED -- owner decision needed:** The Page Registry does not include a `/verify/[certNumber]` route. The Decision Rationale and Feature Lock-in both reference `twicely.co/verify/TW-AUTH-XXXXX` as a public URL. This prompt creates it as specified in the Decision Rationale. The owner should add this to the Page Registry.

Page behavior:
- Call `verifyCertificate(certNumber)`.
- Display certificate status prominently:
  - VALID: Green shield icon, "This item has been authenticated by Twicely", authentication date, authenticator name, listing thumbnail, authentication photos.
  - EXPIRED: Yellow warning, "This certificate was issued for a previous listing."
  - REVOKED: Red alert, "This certificate has been revoked."
  - NOT_FOUND: "Certificate not found. Verify the certificate number and try again."
- Show authentication photos for visual comparison (buyer can compare item received vs authenticated photos).
- Include disclaimer: "Twicely facilitates authentication through third-party partners. Twicely does not independently guarantee authenticity." (Source: Buyer Protection Canonical section 6, Liability Boundaries)

**Metadata:**
```typescript
title: `Verify Certificate ${certNumber} | Twicely`
```

#### D6.1: Authentication Badge Component

**File: `src/components/listing/authentication-badge.tsx`** (NEW)

Displays the authentication badge on listing cards and detail pages.

Props:
```typescript
type AuthenticationBadgeProps = {
  authenticationStatus: string;
  certificateNumber?: string | null;
  isSellerVerified?: boolean;
};
```

Rendering:
- `EXPERT_AUTHENTICATED`: Shield icon + "Expert Authenticated" text + link to verify URL.
- `EXPERT_PENDING`: Clock icon + "Authentication Pending" text (muted).
- `SELLER_VERIFIED` (or `isSellerVerified === true`): Checkmark icon + "Verified Seller" text.
- `NONE` / other: renders nothing.
- Never show negative labels ("Not Authenticated", "Failed", etc.) -- only positive or pending badges.

#### D6.1: Seller Verification Section

**File: `src/components/seller/verified-seller-section.tsx`** (NEW)

Displayed on the seller's store settings page (`/my/selling/store`). Shows:
- If `isAuthenticatedSeller === true`: "You are a Verified Seller" with green badge.
- If `isAuthenticatedSeller === false`: "Become a Verified Seller" CTA with explanation of benefits, link to apply.

#### D6.2: Authentication Request Form

**File: `src/components/authentication/request-auth-form.tsx`** (NEW)

Form for seller to request item authentication:
- Select listing (dropdown of active listings).
- Upload authentication photos (min 3, max 20).
- Tier selector: only "Expert" available at launch (AI is greyed out / "Coming Soon").
- Fee display: reads from platform settings, shows "$39.99 Expert Authentication".
- Submit button.

#### D6.2: Buyer Authentication Prompt

**File: `src/components/authentication/buyer-auth-prompt.tsx`** (NEW)

Displayed on checkout for items above the `offerThresholdCents` setting ($500 default):
- "Would you like this item authenticated? Your share: $9.99"
- Accept / Decline buttons.
- Declining records `order.authenticationDeclined = true` + timestamp.
- Disclaimer: "Authentication is performed by independent experts. Twicely facilitates but does not guarantee results."

**CRITICAL BUSINESS RULE (source: Feature Lock-in Addendum section 48):** Declining authentication does NOT void buyer protection. But it provides evidence in disputes. The `authenticationDeclined` flag + timestamp are for legal record-keeping.

#### D6.2: External Auth Disclaimer

**File: `src/components/listing/external-auth-disclaimer.tsx`** (NEW)

Displayed when listing description mentions external authentication (StockX, The RealReal, etc.):
- "This seller references authentication from a third party. Twicely cannot verify external authentication claims."
- CTA: "Request Twicely Authentication -- $9.99 your share"

Source: Decision Rationale #40, Principle 1. Feature Lock-in Addendum section 48.

#### D6.3: Certificate Display Component

**File: `src/components/authentication/certificate-card.tsx`** (NEW)

Displays certificate information on listing detail pages and order detail pages:
- Certificate number (e.g., TW-AUTH-X7K9M)
- Link to public verify URL
- Authentication date
- Status badge (VALID / EXPIRED / REVOKED)
- Small photo thumbnails

### 2.8 pHash Utility (D6.4)

**File: `src/lib/authentication/phash.ts`** (NEW)

Perceptual hashing utility for photo fingerprinting.

```typescript
/**
 * Compute perceptual hash (pHash) for an image URL.
 * Uses DCT-based algorithm via sharp for image processing.
 * Returns a 64-bit hex string.
 */
export async function computePerceptualHash(imageUrl: string): Promise<string>;

/**
 * Compute composite hash for multiple images.
 * Concatenates individual hashes with separator.
 */
export async function computeCompositeHash(imageUrls: string[]): Promise<string>;

/**
 * Compare two perceptual hashes.
 * Returns Hamming distance (0 = identical, 64 = completely different).
 * Threshold: distance <= 10 is considered a match.
 */
export function compareHashes(hash1: string, hash2: string): number;

/**
 * Check if a new set of photos matches an existing fingerprint.
 * Used to detect certificate fraud -- someone using another item's cert.
 */
export async function verifyPhotoFingerprint(
  photoUrls: string[],
  storedHash: string,
  threshold?: number
): Promise<{ matches: boolean; distance: number }>;
```

Implementation notes:
- Use `sharp` to resize images to 32x32 grayscale for DCT.
- Apply DCT (Discrete Cosine Transform) to get frequency domain.
- Take top-left 8x8 coefficients (excluding DC component).
- Threshold at median to produce 64-bit binary hash.
- Store as 16-character hex string.
- Hamming distance for comparison (XOR + popcount).
- **The pHash algorithm is the same technology used for crosslister dedupe** (source: Feature Lock-in Addendum section 48).

**Anti-fraud flow (source: Decision Rationale #40, Principle 3):**
1. At authentication time: photos are hashed and stored in `authenticationRequest.photosHash`.
2. At verification time: if someone claims a certificate, system can compare the item's current photos against the stored hash.
3. If hash distance > threshold: "Photo mismatch detected -- this certificate may not belong to this item."

### 2.9 Integration Points

#### Integration 1: Listing Relist Flow

When a listing is relisted (new listing created from a sold listing), the `invalidateCertificate` action MUST be called to expire the old certificate. The relist action (in `src/lib/actions/listings.ts` or equivalent) must call:

```typescript
await invalidateCertificate({ listingId: oldListingId, reason: 'RELISTED' });
```

Source: Decision Rationale #40, Principle 2: "If the item is relisted, the old certificate invalidates."

#### Integration 2: Listing Detail Page Badge

The existing listing detail page at `src/app/(marketplace)/i/[slug]/page.tsx` must be updated to display the `AuthenticationBadge` component. The `getListingPageData` query should include `authenticationStatus` and `authenticationRequestId` data (it likely already returns listing fields).

#### Integration 3: Seller Card Badge

The `SellerCard` component should display "Verified Seller" badge if `sellerProfile.isAuthenticatedSeller === true`. This is separate from performance band badges.

#### Integration 4: Checkout Authentication Prompt

The checkout flow should display the `BuyerAuthPrompt` component for items above the threshold. The checkout page exists at `src/app/(marketplace)/checkout/page.tsx`. The prompt records the buyer's decision on `order.authenticationOffered` and `order.authenticationDeclined`.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- NEVER say "FVF" or "Final Value Fee" -- use "Transaction Fee" or "TF"
- NEVER say "Twicely Balance" -- use "Available for payout"
- NEVER say "wallet" in seller UI context -- use "payout"
- NEVER say "Withdraw" -- use "Request payout"
- NEVER use "Commission" -- use "Twicely fees"

### Banned Patterns
- NEVER hardcode fee amounts ($19.99, $39.99). Always read from `platform_settings` via `getPlatformSetting()`.
- NEVER use `as any`, `@ts-ignore`, `@ts-expect-error`.
- NEVER spread request body into DB update -- explicit field mapping only.
- NEVER use `storeId` as ownership key -- always `userId`.
- NEVER display negative authentication labels to buyers (no "Not Authenticated", "Failed", "Counterfeit" badges). Only show positive or pending badges. Source: Seller Score Canonical section 8.1.
- NEVER recognize external authentication (StockX, The RealReal) for badges. Source: Decision Rationale #40.
- NEVER allow certificates to transfer on relist. Source: Decision Rationale #40, Principle 2.
- NEVER compute pHash on the client side. Server-only.
- NEVER build Tier 2 (AI Authentication). It is deferred to G10.2. The enum values exist for future use only.

### Gotchas
1. `authenticationRequest.listingId` is NOT NULL in the schema. Tier 1 Verified Seller is seller-level, not per-item. Do NOT try to store Tier 1 applications in this table (use direct `sellerProfile.isAuthenticatedSeller` update via admin action instead).
2. The `sellerId` on `authenticationRequest` references `user.id`, NOT `sellerProfile.id`. This follows the ownership model: everything traces to `userId`.
3. Authentication cost split is settled within the SAME transaction -- never deferred to next payout. Source: Decision Rationale #39.
4. The `certificateNumber` must be unique. Use `TW-AUTH-` prefix + 5 alphanumeric chars. Verify uniqueness in DB before insert.
5. `listing.authenticationStatus` is the cached/denormalized status. The source of truth is `authenticationRequest.status`.
6. Photos for pHash must be fetched from Cloudflare R2 URLs server-side for hash computation.

---

## 4. ACCEPTANCE CRITERIA

### D6 Infrastructure
- [ ] `AuthenticationRequest` added to CASL subjects.
- [ ] Constants file exists with all tier, initiator, status group, and settings key constants.
- [ ] Types file exists with all shared types.
- [ ] Platform settings seeded with all 6 `trust.authentication.*` keys.
- [ ] All fee amounts read from platform settings -- zero hardcoded values.

### D6.1 Verified Seller Badge
- [ ] Admin can set `isAuthenticatedSeller = true` on any seller profile.
- [ ] "Verified Seller" badge appears on seller card and storefront header when `isAuthenticatedSeller === true`.
- [ ] "Verified Seller" badge appears next to seller name on listing detail pages.
- [ ] Sellers see their verification status on the store settings page.
- [ ] Badge does NOT appear if `isAuthenticatedSeller === false`.
- [ ] Verification is seller-level, not per-item -- one badge applies to all listings.

### D6.2 Expert Human Authentication
- [ ] Seller can request expert authentication for any of their ACTIVE listings.
- [ ] Buyer can request authentication during checkout for items above threshold.
- [ ] Authentication request creates a record with `EXPERT_PENDING` status.
- [ ] Admin/authenticator can complete authentication with AUTHENTICATED, COUNTERFEIT, or INCONCLUSIVE result.
- [ ] On AUTHENTICATED: listing gets `EXPERT_AUTHENTICATED` status, certificate number assigned, cost split calculated (50/50 for buyer-initiated, full seller for seller-initiated).
- [ ] On COUNTERFEIT: listing removed, seller charged full fee, strike issued.
- [ ] On INCONCLUSIVE: Twicely absorbs cost, buyer refunded if applicable.
- [ ] Buyer declining authentication at checkout records `authenticationDeclined = true` + timestamp but does NOT void buyer protection.
- [ ] External authentication claims show disclaimer per Decision Rationale #40.

### D6.3 Certificate System
- [ ] Every completed authentication has a unique `TW-AUTH-XXXXX` certificate number.
- [ ] Public verification URL at `/verify/[certNumber]` works without authentication.
- [ ] VALID certificates show authentication date, listing thumbnail, authenticator, and photos.
- [ ] EXPIRED certificates show: "This certificate was issued for a previous listing."
- [ ] REVOKED certificates show: "This certificate has been revoked."
- [ ] NOT_FOUND certificates show: "Certificate not found."
- [ ] Certificate page includes liability disclaimer.
- [ ] When a listing is relisted, old certificates are automatically invalidated (set to CERTIFICATE_EXPIRED).
- [ ] Certificate does NOT transfer to new listings.

### D6.4 Photo Fingerprinting
- [ ] pHash computed server-side using `sharp`.
- [ ] Each authentication request stores `photosHash` (composite perceptual hash).
- [ ] `compareHashes` returns Hamming distance between two hashes.
- [ ] `verifyPhotoFingerprint` confirms whether photos match a stored fingerprint.
- [ ] pHash comparison detects near-duplicate images (distance <= 10 = match).
- [ ] Completely different images produce high distance (>= 30).

### Authorization
- [ ] Unauthenticated users can view `/verify/[certNumber]` (public page).
- [ ] Unauthenticated users CANNOT create authentication requests (401).
- [ ] Sellers can create authentication requests for their own listings only.
- [ ] Buyers can create authentication requests for orders they own only.
- [ ] Delegated staff CANNOT create authentication requests.
- [ ] Only admins can approve Verified Seller status.
- [ ] Only admins can complete authentication results.

### Data Integrity
- [ ] All monetary values stored as integer cents.
- [ ] Fee amounts always read from `platform_settings`, never hardcoded.
- [ ] `certificateNumber` is unique in the database.
- [ ] `sellerId` on `authenticationRequest` references `user.id` (the ownership model).
- [ ] Cost split math is correct: buyer + seller shares = total (no rounding errors losing cents).

### Vocabulary
- [ ] No banned terms appear in any UI text, code comments, or variable names.
- [ ] No "wallet", "withdraw", "FVF", "commission", "Twicely Balance" in any authentication UI.
- [ ] Authentication fee labeled as "Authentication fee" (not "commission" or "FVF").
- [ ] Stripe processing fee (if shown) labeled as "Payment processing fee".

---

## 5. TEST REQUIREMENTS

Source: `TWICELY_V3_TESTING_STANDARDS.md`

### Unit Tests

**File: `src/lib/authentication/__tests__/constants.test.ts`**
- `it('exports all authentication tier constants')`
- `it('exports all authentication status groups')`
- `it('AUTH_STATUS_AUTHENTICATED includes correct statuses')`
- `it('CERTIFICATE_PREFIX is TW-AUTH-')`

**File: `src/lib/authentication/__tests__/phash.test.ts`**
- `it('computes a 16-character hex hash for a valid image')`
- `it('returns identical hashes for identical images')`
- `it('returns similar hashes for slightly modified images (distance < 10)')`
- `it('returns different hashes for completely different images (distance > 30)')`
- `it('compareHashes returns 0 for identical hashes')`
- `it('compareHashes returns correct Hamming distance')`
- `it('verifyPhotoFingerprint returns matches=true for matching photos')`
- `it('verifyPhotoFingerprint returns matches=false for different photos')`
- `it('computeCompositeHash combines multiple image hashes')`

**File: `src/lib/authentication/__tests__/cost-split.test.ts`**
- `it('buyer-initiated authentic: splits 50/50')`
- `it('buyer-initiated authentic: handles odd cent amounts (no rounding loss)')`
- `it('seller-initiated authentic: seller pays full amount')`
- `it('counterfeit: seller pays full amount regardless of initiator')`
- `it('inconclusive: Twicely absorbs (buyer=0, seller=0)')`
- `it('buyer-initiated counterfeit: buyer refunded full amount')`

### Integration Tests

**File: `src/lib/actions/__tests__/authentication.test.ts`**
- `it('requestItemAuthentication creates EXPERT_PENDING request for seller')`
- `it('requestItemAuthentication rejects unauthenticated users')`
- `it('requestItemAuthentication rejects staff delegates')`
- `it('requestItemAuthentication reads fee from platform settings')`
- `it('completeAuthentication sets EXPERT_AUTHENTICATED and calculates cost split')`
- `it('completeAuthentication COUNTERFEIT removes listing and charges seller')`
- `it('completeAuthentication INCONCLUSIVE refunds buyer')`
- `it('invalidateCertificate expires cert on relist')`
- `it('invalidateCertificate revokes cert on admin action')`
- `it('approveVerifiedSeller sets isAuthenticatedSeller to true')`
- `it('approveVerifiedSeller rejects non-admin users')`

**File: `src/lib/queries/__tests__/authentication.test.ts`**
- `it('verifyCertificate returns VALID for authenticated request')`
- `it('verifyCertificate returns EXPIRED for expired certificate')`
- `it('verifyCertificate returns REVOKED for revoked certificate')`
- `it('verifyCertificate returns NOT_FOUND for unknown certificate')`
- `it('getAuthenticationBadgeForListing returns badge info for authenticated listing')`
- `it('getAuthenticationBadgeForListing returns null for NONE status')`
- `it('getAuthenticationRequestsForSeller paginates correctly')`

### Edge Cases
- Certificate number uniqueness collision (retry with new random chars).
- Concurrent authentication requests for the same listing (only one PENDING at a time).
- Listing deleted while authentication is pending.
- Seller deactivated while authentication is pending.
- pHash computation for corrupt/unloadable image URLs (graceful error handling).

---

## 6. FILE APPROVAL LIST

### New Files

| # | Path | Description |
|---|------|-------------|
| 1 | `src/lib/authentication/constants.ts` | Authentication tier constants, status groups, settings keys |
| 2 | `src/lib/authentication/types.ts` | Shared TypeScript types for authentication |
| 3 | `src/lib/authentication/phash.ts` | Perceptual hash computation and comparison |
| 4 | `src/lib/authentication/cost-split.ts` | Cost split calculation logic (Decision #39) |
| 5 | `src/lib/actions/authentication.ts` | Server actions: request, complete, approve, invalidate |
| 6 | `src/lib/queries/authentication.ts` | Server queries: verify cert, get requests, get badge |
| 7 | `src/app/(marketplace)/verify/[certNumber]/page.tsx` | Public certificate verification page |
| 8 | `src/components/listing/authentication-badge.tsx` | Authentication badge component for listings |
| 9 | `src/components/seller/verified-seller-section.tsx` | Verified Seller status section for store settings |
| 10 | `src/components/authentication/request-auth-form.tsx` | Authentication request form for sellers |
| 11 | `src/components/authentication/buyer-auth-prompt.tsx` | Checkout authentication prompt for buyers |
| 12 | `src/components/authentication/certificate-card.tsx` | Certificate display card component |
| 13 | `src/components/listing/external-auth-disclaimer.tsx` | External authentication disclaimer |
| 14 | `src/lib/authentication/__tests__/constants.test.ts` | Unit tests for constants |
| 15 | `src/lib/authentication/__tests__/phash.test.ts` | Unit tests for pHash |
| 16 | `src/lib/authentication/__tests__/cost-split.test.ts` | Unit tests for cost split |
| 17 | `src/lib/actions/__tests__/authentication.test.ts` | Integration tests for actions |
| 18 | `src/lib/queries/__tests__/authentication.test.ts` | Integration tests for queries |

### Modified Files

| # | Path | Change |
|---|------|--------|
| 19 | `src/lib/casl/subjects.ts` | Add `'AuthenticationRequest'` to SUBJECTS array |
| 20 | `src/lib/casl/ability.ts` | Add auth request CASL rules for buyer, seller, staff |
| 21 | `src/app/(marketplace)/i/[slug]/page.tsx` | Add `AuthenticationBadge` component to listing detail |
| 22 | `src/app/(hub)/my/selling/store/page.tsx` | Add `VerifiedSellerSection` component |

**Total: 18 new files + 4 modified files = 22 files**

---

## 7. PARALLEL STREAMS

This feature has 22 files and 4+ independent sub-tasks. Decomposition is warranted.

### Dependency Graph

```
Stream A (Infrastructure)
  ├── constants.ts
  ├── types.ts
  ├── cost-split.ts
  └── constants.test.ts, cost-split.test.ts

Stream B (pHash)              [depends on: Stream A types]
  ├── phash.ts
  └── phash.test.ts

Stream C (CASL + Actions)     [depends on: Stream A types + constants]
  ├── subjects.ts (modify)
  ├── ability.ts (modify)
  ├── actions/authentication.ts
  └── actions/__tests__/authentication.test.ts

Stream D (Queries)            [depends on: Stream A types]
  ├── queries/authentication.ts
  └── queries/__tests__/authentication.test.ts

Stream E (UI Components)      [depends on: Stream A types, Stream D query signatures]
  ├── authentication-badge.tsx
  ├── verified-seller-section.tsx
  ├── request-auth-form.tsx
  ├── buyer-auth-prompt.tsx
  ├── certificate-card.tsx
  ├── external-auth-disclaimer.tsx
  ├── verify/[certNumber]/page.tsx
  ├── i/[slug]/page.tsx (modify)
  └── my/selling/store/page.tsx (modify)
```

### Execution Order

1. **Stream A** starts immediately (no dependencies).
2. **Stream B** starts immediately (only needs `sharp`, self-contained algorithm).
3. **Stream C** starts after Stream A completes (needs types + constants).
4. **Stream D** starts after Stream A completes (needs types).
5. **Stream E** starts after Stream A + Stream D complete (needs types + query function signatures).

Streams B and A can run in parallel. Streams C, D can run in parallel after A. Stream E waits for A+D.

### Stream A: Infrastructure (constants, types, cost split)

**Files:**
- `src/lib/authentication/constants.ts`
- `src/lib/authentication/types.ts`
- `src/lib/authentication/cost-split.ts`
- `src/lib/authentication/__tests__/constants.test.ts`
- `src/lib/authentication/__tests__/cost-split.test.ts`

**Interface contract (exported by Stream A, consumed by all other streams):**

```typescript
// constants.ts exports
export const AUTHENTICATION_TIERS: { VERIFIED_SELLER: 'VERIFIED_SELLER'; AI: 'AI'; EXPERT: 'EXPERT' };
export type AuthenticationTier = 'VERIFIED_SELLER' | 'AI' | 'EXPERT';
export const AUTHENTICATION_INITIATORS: { BUYER: 'BUYER'; SELLER: 'SELLER' };
export type AuthenticationInitiator = 'BUYER' | 'SELLER';
export const AUTH_STATUS_AUTHENTICATED: readonly ['SELLER_VERIFIED', 'AI_AUTHENTICATED', 'EXPERT_AUTHENTICATED'];
export const AUTH_STATUS_PENDING: readonly ['AI_PENDING', 'EXPERT_PENDING'];
export const AUTH_STATUS_FAILED: readonly ['AI_COUNTERFEIT', 'EXPERT_COUNTERFEIT'];
export const AUTH_STATUS_INVALID: readonly ['CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED'];
export const CERTIFICATE_PREFIX: 'TW-AUTH-';
export const AUTHENTICATOR_SPECIALTIES: readonly string[];
export type AuthenticatorSpecialty = string;
export const AUTH_SETTINGS_KEYS: {
  OFFER_THRESHOLD_CENTS: string;
  BUYER_FEE_CENTS: string;
  SELLER_FEE_CENTS: string;
  EXPERT_FEE_CENTS: string;
  EXPERT_HIGH_VALUE_FEE_CENTS: string;
  MANDATORY_ABOVE_CENTS: string;
};

// types.ts exports
export type AuthenticationRequestResult = { /* see section 2.4 */ };
export type AuthenticatorPartnerSummary = { /* see section 2.4 */ };
export type CertificateVerification = { /* see section 2.4 */ };
export type AuthCostSplit = { totalFeeCents: number; buyerShareCents: number; sellerShareCents: number };

// cost-split.ts exports
export function calculateAuthCostSplit(
  initiator: AuthenticationInitiator,
  result: 'AUTHENTICATED' | 'COUNTERFEIT' | 'INCONCLUSIVE',
  totalFeeCents: number
): AuthCostSplit;
```

**cost-split.ts implementation:**

```typescript
import type { AuthenticationInitiator, AuthCostSplit } from './types';

export function calculateAuthCostSplit(
  initiator: 'BUYER' | 'SELLER',
  result: 'AUTHENTICATED' | 'COUNTERFEIT' | 'INCONCLUSIVE',
  totalFeeCents: number
): AuthCostSplit {
  if (result === 'INCONCLUSIVE') {
    // Twicely absorbs -- neither party pays
    return { totalFeeCents, buyerShareCents: 0, sellerShareCents: 0 };
  }

  if (result === 'COUNTERFEIT') {
    // Seller pays all regardless of who initiated
    return { totalFeeCents, buyerShareCents: 0, sellerShareCents: totalFeeCents };
  }

  // AUTHENTICATED
  if (initiator === 'SELLER') {
    // Seller-initiated pre-listing: seller already paid full upfront
    return { totalFeeCents, buyerShareCents: 0, sellerShareCents: totalFeeCents };
  }

  // Buyer-initiated: 50/50 split
  const buyerShare = Math.floor(totalFeeCents / 2);
  const sellerShare = totalFeeCents - buyerShare; // Ensures no cent is lost
  return { totalFeeCents, buyerShareCents: buyerShare, sellerShareCents: sellerShare };
}
```

### Stream B: pHash Utility

**Files:**
- `src/lib/authentication/phash.ts`
- `src/lib/authentication/__tests__/phash.test.ts`

**Self-contained.** Only depends on `sharp` (built-in Next.js dependency).

**Interface contract (exported by Stream B):**

```typescript
export async function computePerceptualHash(imageUrl: string): Promise<string>;
export async function computeCompositeHash(imageUrls: string[]): Promise<string>;
export function compareHashes(hash1: string, hash2: string): number;
export async function verifyPhotoFingerprint(
  photoUrls: string[],
  storedHash: string,
  threshold?: number
): Promise<{ matches: boolean; distance: number }>;
```

### Stream C: CASL + Server Actions

**Files:**
- `src/lib/casl/subjects.ts` (modify)
- `src/lib/casl/ability.ts` (modify)
- `src/lib/actions/authentication.ts` (new)
- `src/lib/actions/__tests__/authentication.test.ts` (new)

**Depends on:** Stream A (types, constants, cost-split function).

**Interface contract (consumed by Stream A, inline here):**

Types consumed from Stream A:
```typescript
type AuthCostSplit = { totalFeeCents: number; buyerShareCents: number; sellerShareCents: number };
type AuthenticationInitiator = 'BUYER' | 'SELLER';
const CERTIFICATE_PREFIX = 'TW-AUTH-';
const AUTH_SETTINGS_KEYS = { /* ... */ };
function calculateAuthCostSplit(initiator, result, totalFeeCents): AuthCostSplit;
```

pHash function consumed from Stream B (can be mocked in tests if B not ready):
```typescript
async function computeCompositeHash(imageUrls: string[]): Promise<string>;
```

### Stream D: Queries

**Files:**
- `src/lib/queries/authentication.ts` (new)
- `src/lib/queries/__tests__/authentication.test.ts` (new)

**Depends on:** Stream A (types).

**Interface contract (consumed by Stream E, inline here):**

```typescript
export async function verifyCertificate(certificateNumber: string): Promise<CertificateVerification>;
export async function getAuthenticationBadgeForListing(listingId: string): Promise<{ status: string; badgeLabel: string | null; certificateNumber: string | null } | null>;
export async function getSellerVerificationStatus(userId: string): Promise<{ isVerified: boolean }>;
export async function getAuthenticationRequestsForSeller(sellerId: string, filters?): Promise<{ requests: AuthenticationRequestResult[]; total: number }>;
export async function getAuthenticationRequestById(requestId: string): Promise<AuthenticationRequestResult | null>;
export async function getAuthenticatorPartners(filters?): Promise<AuthenticatorPartnerSummary[]>;
export async function getAuthenticationRequestsForListing(listingId: string): Promise<AuthenticationRequestResult[]>;
```

### Stream E: UI Components + Pages

**Files:**
- `src/components/listing/authentication-badge.tsx`
- `src/components/seller/verified-seller-section.tsx`
- `src/components/authentication/request-auth-form.tsx`
- `src/components/authentication/buyer-auth-prompt.tsx`
- `src/components/authentication/certificate-card.tsx`
- `src/components/listing/external-auth-disclaimer.tsx`
- `src/app/(marketplace)/verify/[certNumber]/page.tsx`
- `src/app/(marketplace)/i/[slug]/page.tsx` (modify)
- `src/app/(hub)/my/selling/store/page.tsx` (modify)

**Depends on:** Stream A (types), Stream D (query function signatures).

All types and query signatures are inlined above. Components import from:
- `@/lib/authentication/constants`
- `@/lib/authentication/types`
- `@/lib/queries/authentication`
- `@/lib/actions/authentication`

### Merge Verification

After all streams complete, verify:
1. `pnpm typecheck` passes with 0 errors.
2. `pnpm test` passes with count >= BASELINE_TESTS (1152).
3. All 18 new files + 4 modified files are present.
4. Importing `@/lib/authentication/constants` works from action and query files.
5. The `/verify/TW-AUTH-TEST1` route renders the verification page.
6. The listing detail page shows authentication badges for authenticated listings.
7. The store settings page shows the Verified Seller section.
8. No banned terms in any file (run `./twicely-lint.sh`).

---

## 8. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. Banned terms check
./twicely-lint.sh

# 4. File count
find src/lib/authentication -type f | wc -l
find src/components/authentication -type f | wc -l
find src/app/\(marketplace\)/verify -type f | wc -l

# 5. File sizes (must all be <= 300 lines)
wc -l src/lib/authentication/*.ts src/lib/authentication/__tests__/*.ts src/lib/actions/authentication.ts src/lib/queries/authentication.ts src/components/listing/authentication-badge.tsx src/components/seller/verified-seller-section.tsx src/components/authentication/*.tsx src/app/\(marketplace\)/verify/\[certNumber\]/page.tsx
```

Expected outcomes:
- TypeScript: 0 errors
- Tests: >= 1152 (baseline), likely 1152 + ~35 new = ~1187
- Banned terms: 0 occurrences
- All files <= 300 lines
- New file count: 18 files created

---

## 9. OPEN QUESTIONS FOR OWNER

1. **Platform settings key prefix:** Pricing Canonical uses `auth.*` (e.g., `auth.buyerFeeCents`), Feature Lock-in Addendum uses `trust.authentication.*`. Which prefix to use? This prompt defaults to `trust.authentication.*` for consistency with existing trust settings. Confirm or override.

2. **Tier 1 Verified Seller storage:** The `authenticationRequest` table requires `listingId` NOT NULL, but Tier 1 is seller-level (not per-item). This prompt recommends direct `sellerProfile.isAuthenticatedSeller` update via admin action (Option C from section 2.5). Confirm this approach.

3. **`/verify/[certNumber]` route:** Not in the Page Registry. This prompt adds it per Decision Rationale #40 and Feature Lock-in Addendum. Should this be formally added to the Page Registry?

4. **pHash library choice:** This prompt uses `sharp` (already a Next.js dependency) for image processing + a manual DCT implementation. Alternatively, an npm package like `imghash` could be used. Which approach is preferred?

5. **Expert authentication partner onboarding flow:** The Feature Lock-in describes partners being managed by admin, but no specific admin pages exist in the Page Registry for partner management. Should D6 include a hub admin page for managing `authenticatorPartner` records, or is that deferred to a later phase?
