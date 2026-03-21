# Install Prompt: F1 — eBay Import (Free, One-Time)

**Phase & Step:** F1 (includes F1.1, F1.2, F1.3)
**Feature Name:** eBay Import — OAuth Connection, Listing Fetch/Transform/Dedupe, Bulk Import UI
**One-line Summary:** Build the complete eBay import pipeline: OAuth account connection, paginated listing fetch with normalization/dedupe, and the seller-facing crosslister dashboard + import UI at `/my/selling/crosslist/*`.
**Date:** 2026-03-06

---

## Canonical Sources — READ ALL BEFORE STARTING

| Document | Why |
|----------|-----|
| `TWICELY_V3_LISTER_CANONICAL.md` | PRIMARY — Sections 1-6, 9-10, 19, 21-22, 27, 29-30. Import pipeline, connector interface, dedupe, CASL, rollout. |
| `TWICELY_V3_SCHEMA_v2_0_7.md` | Sections 1.10, 12.1-12.9. All crosslister table definitions. Section 5.1 listing table (importedFromChannel, importedExternalId). |
| `TWICELY_V3_PAGE_REGISTRY.md` | Rows 56-59. Routes: `/my/selling/crosslist`, `/my/selling/crosslist/connect`, `/my/selling/crosslist/import`, `/my/selling/crosslist/import/issues`. |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Section 46 (Crosslister UX Integration). Sidebar widget, listing form toggles, command center. |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Section 3.3-3.4. Seller + Seller Staff crosslister permissions and delegation scopes. |
| `TWICELY_V3_DECISION_RATIONALE.md` | Decisions #16 (Imports Go Active Immediately), #17 (Crosslister as Supply Engine). |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` | Section 2 route structure. Crosslister nests under `/my/selling/crosslist/*`. Gate: `HAS_CROSSLISTER` in sidebar. |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | Crosslister settings keys (already seeded). |

---

## 1. PREREQUISITES

### Already Complete (Verified)
- **E2.1 Crosslister Connector Framework** — ALL of the following exist and are tested:
  - `src/lib/crosslister/connector-interface.ts` — `PlatformConnector` interface (10 methods + 2 optional)
  - `src/lib/crosslister/types.ts` — All shared types: `ExternalListing`, `PaginatedListings`, `AuthResult`, `ConnectorCapabilities`, etc.
  - `src/lib/crosslister/db-types.ts` — Drizzle inferred types for all 9 crosslister tables
  - `src/lib/crosslister/channel-registry.ts` — `CHANNEL_REGISTRY` Map with metadata for all 8 channels. eBay enabled=true, tier='A', authMethod='OAUTH'.
  - `src/lib/crosslister/connector-registry.ts` — `registerConnector()`, `getConnector()`, `hasConnector()`
  - `src/lib/crosslister/index.ts` — barrel export
  - `src/lib/db/schema/crosslister.ts` — 9 tables: `crosslisterAccount`, `channelProjection`, `crossJob`, `importBatch`, `importRecord`, `dedupeFingerprint`, `channelCategoryMapping`, `channelPolicyRule`, `automationSetting`
  - `src/lib/db/schema/enums.ts` — `channelEnum`, `authMethodEnum`, `accountStatusEnum`, `channelListingStatusEnum`, `publishJobStatusEnum`, `publishJobTypeEnum`, `importBatchStatusEnum`
  - `src/lib/validations/crosslister.ts` — Zod schemas: `connectAccountSchema`, `disconnectAccountSchema`, `startImportSchema`, `publishListingsSchema`, `updateProjectionOverridesSchema`, `cancelJobSchema`, `updateAutomationSettingsSchema`
  - `src/lib/casl/subjects.ts` — `CrosslisterAccount`, `ChannelProjection`, `CrossJob`, `ImportBatch` all registered
  - `src/lib/casl/ability.ts` — Seller CASL rules for all 4 crosslister subjects
  - `src/lib/casl/staff-abilities.ts` — Delegation scopes: `crosslister.read`, `crosslister.publish`, `crosslister.import`, `crosslister.manage`
  - `src/lib/db/seed/seed-crosslister.ts` — 40+ platform settings seeded (feature flags, rate limits, publish limits, import settings)
  - `src/lib/hub/hub-nav.ts` — Crosslister nav group with items: Platforms, Import, Automation

- **Schema fields on listing table:**
  - `listing.importedFromChannel` — `channelEnum` (nullable)
  - `listing.importedExternalId` — `text` (nullable)

- **No existing code for:** actions, queries, services, connectors, pages, or components in the crosslister domain.

### Dependencies
- B2 (Listing Creation) — DONE
- E1 (Notification System) — DONE
- npm: No new packages required. eBay API calls use standard `fetch()`.

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

This prompt covers three sub-steps delivered as a single unit:
- **F1.1:** eBay OAuth + account connection
- **F1.2:** Listing fetch + transform + dedupe
- **F1.3:** Bulk import UI (crosslister dashboard + import progress + issues page)

### 2.1 eBay Connector Implementation

Create a concrete `EbayConnector` class implementing the `PlatformConnector` interface. This is a Tier A connector (full REST API, OAuth, webhooks available).

**File:** `src/lib/crosslister/connectors/ebay-connector.ts`

The connector must implement ALL methods from the interface:

```
authenticate(credentials: OAuthAuthInput): Promise<AuthResult>
refreshAuth(account: CrosslisterAccount): Promise<AuthResult>
revokeAuth(account: CrosslisterAccount): Promise<void>
fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings>
fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing>
createListing(...): Promise<PublishResult>      // stub — returns { success: false, error: 'Not implemented in F1', retryable: false }
updateListing(...): Promise<UpdateResult>       // stub
delistListing(...): Promise<DelistResult>       // stub
verifyListing(...): Promise<VerificationResult> // stub
healthCheck(account: CrosslisterAccount): Promise<HealthResult>
```

**eBay API details:**
- Auth: OAuth 2.0 Authorization Code Grant. eBay uses `https://auth.ebay.com/oauth2/authorize` for auth URL and `https://api.ebay.com/identity/v1/oauth2/token` for token exchange.
- API base: `https://api.ebay.com` (production), `https://api.sandbox.ebay.com` (sandbox)
- Fetch listings: `GET /sell/inventory/v1/inventory_item` (paginated, use `offset` + `limit`)
- Fetch single: `GET /sell/inventory/v1/inventory_item/{sku}`
- Health check: `GET /sell/inventory/v1/inventory_item?limit=1` — if 200, healthy
- All API calls require `Authorization: Bearer {accessToken}` header
- Rate limits: respect `X-RateLimit-Remaining` header

**Environment variables needed (stored encrypted in platform_settings, NOT .env):**
- `crosslister.ebay.clientId` — eBay app client ID
- `crosslister.ebay.clientSecret` — eBay app client secret
- `crosslister.ebay.redirectUri` — OAuth redirect URI (`https://twicely.co/api/crosslister/ebay/callback`)
- `crosslister.ebay.environment` — `PRODUCTION` or `SANDBOX`

**Token handling:**
- Access tokens stored encrypted in `crosslisterAccount.accessToken`
- Refresh tokens stored encrypted in `crosslisterAccount.refreshToken`
- `tokenExpiresAt` tracked; refresh proactively when within 5 minutes of expiry
- On auth failure (401), set account status to `REAUTHENTICATION_REQUIRED`

**eBay listing normalization (in `fetchListings`):**
- Map eBay inventory item fields to `ExternalListing` shape from `types.ts`
- `externalId` = eBay SKU
- `priceCents` = parse eBay price (which is a decimal string like "89.99") to integer cents (8999)
- `condition` = map eBay condition IDs to Twicely condition enum values (best effort; store raw value in `itemSpecifics`)
- `images` = eBay `product.imageUrls` array, first = primary
- `status` = map eBay listing status to 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT'
- Only return listings with status 'ACTIVE' during import (skip SOLD/ENDED)

**File:** `src/lib/crosslister/connectors/ebay-types.ts` — eBay API response type definitions (typed, no `any`)

**Registration:** At bottom of `ebay-connector.ts`, call `registerConnector(new EbayConnector())`.

### 2.2 OAuth Callback API Route

**File:** `src/app/api/crosslister/ebay/callback/route.ts`

`GET` handler:
1. Extract `code` and `state` from query params
2. Validate `state` matches stored CSRF token (from session/cookie)
3. Call `ebayConnector.authenticate({ method: 'OAUTH', code, redirectUri })`
4. On success: create/update `crosslisterAccount` row with tokens, capabilities, status=ACTIVE
5. Set `firstImportCompletedAt = null` (first import not yet done)
6. Redirect to `/my/selling/crosslist/connect?connected=ebay`
7. On failure: redirect to `/my/selling/crosslist/connect?error=auth_failed`

### 2.3 Server Actions — Account Management

**File:** `src/lib/actions/crosslister-accounts.ts`

Actions (all `'use server'`, Zod `.strict()`, `authorize()` check):

1. **`connectEbayAccount`** — Generates eBay OAuth URL and returns it. Does NOT connect — the callback route does that.
   - Input: none (or just a CSRF state token)
   - Auth: `can('create', 'CrosslisterAccount', { sellerId })`
   - Returns: `{ url: string }` — the eBay authorization URL
   - Checks: channel is enabled via platform_settings `crosslister.ebay.importEnabled`
   - Checks: seller does not already have an ACTIVE eBay account (unique constraint: sellerId + channel)

2. **`disconnectAccount`** — Revokes auth and soft-disconnects.
   - Input: `disconnectAccountSchema` (`{ accountId }`)
   - Auth: `can('delete', 'CrosslisterAccount', { sellerId })`
   - Steps: call `connector.revokeAuth()`, set status to `REVOKED`, clear tokens
   - Does NOT delete projections (archived, not destroyed — per Lister Canonical Section 25.4)

3. **`refreshAccountAuth`** — Proactively refresh an expired/expiring token.
   - Input: `{ accountId: string }`
   - Auth: `can('update', 'CrosslisterAccount', { sellerId })`
   - Calls `connector.refreshAuth(account)`, updates tokens + `tokenExpiresAt`

### 2.4 Server Actions — Import Pipeline

**File:** `src/lib/actions/crosslister-import.ts`

Actions:

1. **`startImport`** — Start a one-time free import from a connected account.
   - Input: `startImportSchema` (`{ accountId }`)
   - Auth: `can('create', 'ImportBatch', { sellerId })`
   - Validations:
     - Account exists, belongs to seller, status is ACTIVE
     - `crosslisterAccount.firstImportCompletedAt` is NULL (one-time free import per marketplace per account)
     - Channel import is enabled via feature flag (`crosslister.ebay.importEnabled`)
   - Creates `importBatch` row: `{ sellerId, accountId, channel, status: 'CREATED', isFirstImport: true, totalItems: 0 }`
   - Calls `processImportBatch(batchId)` (the import service — see 2.5)
   - Returns: `{ batchId: string }`

2. **`getImportBatchStatus`** — Poll import progress (fallback if Centrifugo unavailable).
   - Input: `{ batchId: string }`
   - Auth: `can('read', 'ImportBatch', { sellerId })`
   - Returns: full `ImportBatch` row with counts

3. **`getImportIssues`** — Get failed/skipped import records for a batch.
   - Input: `{ batchId: string, page?: number, limit?: number }`
   - Auth: `can('read', 'ImportBatch', { sellerId })`
   - Returns: paginated `importRecord` rows where `status = 'failed'` or `status = 'skipped'`

4. **`retryImportRecord`** — Retry a single failed import record.
   - Input: `{ recordId: string }`
   - Auth: `can('create', 'ImportBatch', { sellerId })`
   - Re-runs normalize + dedupe + create for that single record

### 2.5 Import Service (NOT a server action — plain function)

**File:** `src/lib/crosslister/services/import-service.ts`

This is the core import pipeline engine. It is NOT a `'use server'` file — it contains business logic called by server actions.

**Function:** `async function processImportBatch(batchId: string): Promise<void>`

Pipeline stages (matching Lister Canonical Section 6.2):

**Stage 1 — FETCHING:**
- Update batch status to `FETCHING`
- Call `connector.fetchListings(account, cursor)` in a loop, paginating with cursor
- Read batch size from platform_settings: `crosslister.import.batchSize` (default 50)
- For each page of results:
  - Create `importRecord` rows with `status: 'pending'`, `rawDataJson` = the external listing data
  - Update `importBatch.totalItems` with running count
- Only import listings with `status === 'ACTIVE'` from the external platform

**Stage 2 — DEDUPLICATING:**
- Update batch status to `DEDUPLICATING`
- For each pending import record:
  - Generate dedupe fingerprint (see 2.6)
  - Check for existing fingerprint match in `dedupeFingerprint` table for this seller
  - Strong match (>= 90% composite): set `importRecord.dedupeMatchListingId`, `dedupeConfidence`, `status: 'deduplicated'`
  - Weak match (70-89%): set match fields, `status: 'review'` (still creates listing but flags for manual review)
  - No match (< 70%): `status: 'pending'` (will create new listing)

**Stage 3 — TRANSFORMING:**
- Update batch status to `TRANSFORMING`
- For each non-deduplicated record:
  - Normalize raw data to canonical listing fields using `normalizeEbayListing()` (see 2.7)
  - Store result in `importRecord.normalizedDataJson`
  - Validate minimum requirements: title present, at least 1 image URL, price > 0
  - If validation fails: set `status: 'failed'`, `errorMessage` = specific failure reason

**Stage 4 — IMPORTING:**
- Update batch status to `IMPORTING`
- For each record with `status: 'pending'` (passed normalization):
  - Create canonical `listing` row with:
    - `ownerUserId` = seller's userId
    - `status: 'ACTIVE'` (Decision #16: imports go ACTIVE immediately)
    - `importedFromChannel: 'EBAY'`
    - `importedExternalId` = eBay SKU/itemId
    - All normalized fields mapped explicitly (title, description, priceCents, condition, brand, etc.)
    - `slug` = generated from title (same slugify logic as listing creation in B2)
  - Create `channelProjection` row linking back to eBay:
    - `listingId`, `accountId`, `channel: 'EBAY'`, `sellerId`
    - `externalId` = eBay SKU/itemId
    - `externalUrl` = eBay listing URL
    - `status: 'ACTIVE'`
    - `syncEnabled: true`
  - Create `dedupeFingerprint` row for the new listing
  - Update `importRecord.listingId` and set `status: 'created'`
  - Increment `importBatch.createdItems`
- For deduplicated records (strong match):
  - Create `channelProjection` linking the existing listing to the eBay source
  - Set `importRecord.status: 'deduplicated'`
  - Increment `importBatch.deduplicatedItems`

**Stage 5 — COMPLETING:**
- Update batch status to `COMPLETED` (or `PARTIALLY_COMPLETED` if any failed)
- Set `importBatch.completedAt = now()`
- Set `crosslisterAccount.firstImportCompletedAt = now()`
- Compute final counts: createdItems, deduplicatedItems, failedItems, skippedItems

**Error handling:**
- If any stage throws, set batch status to `FAILED`, log error in `errorSummaryJson`
- Individual record failures do NOT fail the entire batch — the batch continues and records the failure per-item
- Batch with some failures and some successes = `PARTIALLY_COMPLETED`

**CRITICAL BUSINESS RULES:**
- Imported listings are ALWAYS ACTIVE — never DRAFT
- Imported listings are ALWAYS exempt from insertion fees (not enforced here — the insertion fee calculator must check `importedFromChannel IS NOT NULL`)
- ONE free import per external marketplace per account (enforced by checking `firstImportCompletedAt`)
- No subscription required for the free import (any seller can import)

### 2.6 Dedupe Service

**File:** `src/lib/crosslister/services/dedupe-service.ts`

Functions:

1. **`generateFingerprint(listing: ExternalListing, sellerId: string): DedupeInput`**
   - `titleHash` = lowercase, remove stopwords, sort remaining words, hash with SHA-256
   - `imageHash` = null for now (pHash requires image download — defer to F1 enhancement or use placeholder)
   - `priceRange` = bucket: `"0-999"`, `"1000-2499"`, `"2500-4999"`, `"5000-9999"`, `"10000+"`  (cents)
   - `compositeHash` = SHA-256 of `titleHash + priceRange + (brand ?? '') + (category ?? '')`

2. **`findDedupeMatch(fingerprint: DedupeInput, sellerId: string): { matchListingId: string | null, confidence: number }`**
   - Query `dedupeFingerprint` table for this seller
   - Exact `compositeHash` match = 95% confidence (strong)
   - Exact `titleHash` match + same price range = 85% confidence (weak — flag for review)
   - Same `titleHash` only = 75% confidence (weak)
   - No match = 0%

### 2.7 eBay Listing Normalizer

**File:** `src/lib/crosslister/connectors/ebay-normalizer.ts`

**Function:** `normalizeEbayListing(raw: EbayInventoryItem): NormalizedListingData`

Maps eBay inventory item fields to Twicely listing fields:

| eBay Field | Twicely Field | Transform |
|------------|--------------|-----------|
| `product.title` | `title` | Trim, max 200 chars |
| `product.description` | `description` | Strip HTML tags, trim |
| `product.aspects` | `attributesJson` | Map key-value pairs |
| `product.brand` (from aspects) | `brand` | Extract from aspects |
| `product.imageUrls` | images array | Map to `ExternalImage[]` |
| `offers[0].pricingSummary.price.value` | `priceCents` | Parse decimal string to integer cents |
| `offers[0].pricingSummary.price.currency` | `currency` | Pass through (should be USD) |
| `condition` | `condition` | Map eBay condition enum to Twicely condition enum |
| `availability.shipToLocationAvailability.quantity` | `quantity` | Integer |
| `sku` | `externalId` | Pass through |
| `offers[0].listingId` | used in URL | `https://www.ebay.com/itm/{listingId}` |

**eBay condition mapping:**
| eBay Condition | Twicely Condition |
|----------------|------------------|
| `NEW` | `NEW_WITH_TAGS` |
| `NEW_OTHER` | `NEW_WITHOUT_TAGS` |
| `NEW_WITH_DEFECTS` | `NEW_WITH_DEFECTS` |
| `LIKE_NEW` | `LIKE_NEW` |
| `VERY_GOOD` | `VERY_GOOD` |
| `GOOD` | `GOOD` |
| `ACCEPTABLE` | `ACCEPTABLE` |
| Other/unknown | `null` (let seller set manually) |

**Return type:** `NormalizedListingData` — a type containing all the fields needed to create a `listing` row plus metadata for the `importRecord`.

### 2.8 Queries

**File:** `src/lib/queries/crosslister.ts`

Queries (all check CASL authorization):

1. **`getConnectedAccounts(sellerId: string)`** — All `crosslisterAccount` rows for this seller, ordered by channel.
2. **`getImportBatches(sellerId: string)`** — All `importBatch` rows for this seller, ordered by `createdAt DESC`.
3. **`getImportBatchById(batchId: string, sellerId: string)`** — Single batch with ownership check.
4. **`getImportRecords(batchId: string, sellerId: string, options?: { status?: string, page?: number, limit?: number })`** — Paginated import records for a batch.
5. **`getCrosslisterDashboardData(sellerId: string)`** — Aggregated data for the crosslister dashboard: connected accounts with status, latest import batch per account, total listings per channel (from channelProjection counts).
6. **`getChannelProjectionCount(sellerId: string, channel: string)`** — Count of active projections for a channel.

### 2.9 Pages & Components

All pages use the `dashboard` layout (inside the My Hub shell at `/my`). The crosslister section in the sidebar is gated by `HAS_CROSSLISTER` which should be true for ANY seller (free import available to all sellers — the sidebar shows the crosslister section to all sellers, not just those with a ListerTier subscription).

**IMPORTANT VISIBILITY RULE:** The free one-time import is available to ALL sellers regardless of ListerTier. The crosslister sidebar section must be visible to all sellers. The `HAS_CROSSLISTER` gate in hub-nav.ts needs to evaluate to true for all sellers. If it currently gates on ListerTier !== NONE, it must be changed to gate on `isSeller === true` (or always show for sellers). The import is the supply flywheel — never gate it behind a subscription.

#### Page 1: Crosslister Dashboard (`/my/selling/crosslist`)

**File:** `src/app/(marketplace)/my/selling/crosslist/page.tsx`

**Page Registry Row 56:** SELLER or DELEGATE(crosslister.read)

**States:**
- LOADING: Connection cards skeleton
- EMPTY (no connections): "Connect your first platform" card with platform picker showing enabled channels (eBay, Poshmark, Mercari). Large "Connect eBay" CTA with eBay logo/color.
- POPULATED: Connected platform cards showing:
  - Platform icon + name + status badge (green dot = ACTIVE, amber = REAUTHENTICATION_REQUIRED, red = ERROR)
  - External username
  - Active listing count (from channelProjection count)
  - Last sync timestamp
  - "Import" button (if `firstImportCompletedAt` is null — one-time import available)
  - "Disconnect" button
  - If status is REAUTHENTICATION_REQUIRED: "Reconnect" button prominently displayed

**Components:**
- `src/components/crosslister/platform-card.tsx` — Single connected platform card
- `src/components/crosslister/connect-platform-cta.tsx` — Empty state / add platform card

#### Page 2: Connect Platform (`/my/selling/crosslist/connect`)

**File:** `src/app/(marketplace)/my/selling/crosslist/connect/page.tsx`

**Page Registry Row 57:** SELLER or DELEGATE(crosslister.manage)

Shows enabled platforms with "Connect" buttons. For F1, only eBay is fully functional (Poshmark and Mercari show as "Coming soon").

**Query params:**
- `?connected=ebay` — show success toast "eBay account connected successfully!"
- `?error=auth_failed` — show error toast "Failed to connect eBay account. Please try again."

**Components:**
- `src/components/crosslister/connect-platform-grid.tsx` — Grid of platform cards with connect buttons

#### Page 3: Import Progress (`/my/selling/crosslist/import`)

**File:** `src/app/(marketplace)/my/selling/crosslist/import/page.tsx`

**Page Registry Row 58:** SELLER or DELEGATE(crosslister.import)

**States:**
- EMPTY (no imports): "Import your listings from another platform" + select connected account to import from
- IN_PROGRESS: Import progress display:
  - Progress bar (processedItems / totalItems)
  - Status label (FETCHING, DEDUPLICATING, TRANSFORMING, IMPORTING)
  - Live counts: Created, Deduplicated, Failed, Skipped
  - Estimated time remaining (simple: items remaining / items per second)
  - "Importing from eBay..." header with eBay icon
- COMPLETED: Summary card:
  - "Import complete!" with checkmark
  - Created: X new listings
  - Deduplicated: X linked to existing
  - Failed: X items (link to issues page if > 0)
  - "View your listings" CTA -> `/my/selling/listings`
- FAILED: Error message with retry option

**Components:**
- `src/components/crosslister/import-progress.tsx` — Progress bar + live counts (polls via `getImportBatchStatus` every 3 seconds as Centrifugo fallback)
- `src/components/crosslister/import-summary.tsx` — Completed import summary
- `src/components/crosslister/import-start-form.tsx` — Account selector + start import button

#### Page 4: Import Issues (`/my/selling/crosslist/import/issues`)

**File:** `src/app/(marketplace)/my/selling/crosslist/import/issues/page.tsx`

**Page Registry Row 59:** SELLER or DELEGATE(crosslister.import)

Shows failed import records with:
- Item title (from raw data)
- Error message (specific: "Missing title", "Price is zero", "Image URL unreachable")
- "Retry" button per item
- Original eBay listing link

**Components:**
- `src/components/crosslister/import-issues-table.tsx` — Table of failed records with retry buttons

### 2.10 Listing Creation Helper

**File:** `src/lib/crosslister/services/listing-creator.ts`

Helper function used by the import service to create canonical listings from normalized data. This function:
- Generates a slug from the title (reuse existing slugify logic from B2)
- Creates the `listing` row with `status: 'ACTIVE'`, `importedFromChannel`, `importedExternalId`
- Creates `listingImage` rows for each image (download from eBay URL to R2 is DEFERRED to a background job — for now store eBay URLs directly as `imageUrl` so listings are immediately browsable)
- Returns the created listing ID

**IMPORTANT:** This helper must NOT be exported from a `'use server'` file. It is a plain function in a non-`'use server'` module.

### 2.11 Notification Integration

When an import completes, send a notification to the seller:

**File:** `src/lib/crosslister/services/import-notifier.ts`

- `notifyImportCompleted(sellerId: string, batchId: string, counts: ImportCounts)` — sends in-app + email notification
- Template: use existing `notify()` from notification service
- Template key: `import_completed` (add to notification templates)
- Content: "Your eBay import is complete! {createdItems} listings imported, {failedItems} issues to review."

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- NO `SellerTier` or `SubscriptionTier` — use `ListerTier` for crosslister subscription
- NO `FVF` or `Final Value Fee` — use `TF` / `Transaction Fee`
- NO `wallet` or `Twicely Balance` in any seller-facing text
- NO `BASIC`, `ELITE`, `PLUS`, `MAX`, `PREMIUM` tier names

### Banned Patterns
- NO `as any`, `as unknown as T`, `@ts-ignore`, `@ts-expect-error`
- NO hardcoded fee rates — read from `platform_settings`
- NO fee calculations in frontend code
- NO files over 300 lines — split if needed
- NO spreading request body into DB inserts — explicit field mapping only
- NO `console.log` in production code (use `logger` from `src/lib/logger.ts`)
- NO `storeId` or `sellerProfileId` as ownership key — always `userId` (which maps to `sellerId` in crosslister tables, where `sellerId` references `user.id`)

### Banned Tech
- NO Prisma (use Drizzle)
- NO Redis (use Valkey)
- NO tRPC (use server actions + API routes)
- NO Zustand/Redux (use React context + server state)

### Critical Gotchas
1. `crosslisterAccount.sellerId` references `user.id`, NOT `sellerProfile.id`. Ownership via `userId` always.
2. The `authorize()` function uses `session.userId` as the `sellerId` for CASL checks (or `session.onBehalfOfSellerId` for delegated staff).
3. Imported listings must set `status: 'ACTIVE'` — NEVER `'DRAFT'`. This is Decision #16, non-negotiable.
4. Imported listings are exempt from insertion fees. The import code itself does not need to enforce this — the insertion fee calculator elsewhere must check `importedFromChannel IS NOT NULL`.
5. ONE free import per marketplace per account. Enforced by checking `crosslisterAccount.firstImportCompletedAt IS NULL`. After import completes, set this timestamp.
6. The free import requires NO subscription. Any seller can import. Do not check ListerTier.
7. Do NOT download images from eBay to R2 during import — store eBay image URLs directly. Image migration is a separate background job (out of scope for F1).
8. Tokens (accessToken, refreshToken) should be stored as-is in the database. Encryption at rest is handled at the application layer by a separate encryption service. For F1, store tokens as plain text with a TODO comment noting encryption is needed before production.
9. Helper functions in import-service.ts, dedupe-service.ts, etc. must NOT be in `'use server'` files. Keep them as plain TypeScript modules.
10. The sidebar `HAS_CROSSLISTER` gate must allow ALL sellers (not just those with ListerTier). The free import flywheel requires visibility.

---

## 4. ACCEPTANCE CRITERIA

### Positive Cases
1. A seller can initiate eBay OAuth from `/my/selling/crosslist/connect` and be redirected to eBay's authorization page.
2. After eBay authorization, the callback creates a `crosslisterAccount` row with status ACTIVE and the seller is redirected back with a success message.
3. A seller with a connected eBay account can start a one-time free import from `/my/selling/crosslist/import`.
4. The import fetches all ACTIVE listings from eBay, normalizes them, checks for duplicates, and creates canonical Twicely listings with `status: 'ACTIVE'`.
5. Each imported listing has `importedFromChannel: 'EBAY'` and `importedExternalId` set.
6. Each imported listing has a corresponding `channelProjection` row linking it back to the eBay source.
7. Each imported listing has a `dedupeFingerprint` row for future dedupe matching.
8. The import progress page shows live counts (created, deduplicated, failed, skipped).
9. Failed imports appear on the issues page with specific error messages and retry buttons.
10. After import completes, `crosslisterAccount.firstImportCompletedAt` is set and a notification is sent.
11. The crosslister dashboard (`/my/selling/crosslist`) shows the connected eBay account with listing count and status.
12. Delegated staff with `crosslister.read` scope can view the dashboard but cannot start imports.
13. Delegated staff with `crosslister.import` scope can start imports.
14. Delegated staff with `crosslister.manage` scope can connect/disconnect accounts.

### Negative Cases
15. A seller CANNOT start a second free import for the same marketplace (eBay) — must return error "Free import already used for this platform."
16. A seller CANNOT import from a disconnected account (status REVOKED) — must return error.
17. A buyer (non-seller) CANNOT access any crosslister pages — redirected to enable selling.
18. Unauthenticated users CANNOT access crosslister routes.
19. A seller CANNOT access another seller's crosslister data — CASL denies.
20. If eBay import feature flag `crosslister.ebay.importEnabled` is false, the connect and import actions must return errors.
21. Import records with missing titles are marked as failed with error "Missing required field: title."
22. Import records with price of 0 or negative are marked as failed with error "Invalid price."
23. Import records with no images are marked as failed with error "At least one image is required."

### Data Integrity
24. All monetary values stored as integer cents (no floats).
25. All `crosslisterAccount.sellerId` values reference valid `user.id` entries.
26. All `importBatch.accountId` values reference valid `crosslisterAccount.id` entries.
27. All `channelProjection.listingId` values reference valid `listing.id` entries.
28. The `importBatch` final counts (created + deduplicated + failed + skipped) equal `totalItems`.

### Vocabulary
29. No banned terms appear in any UI text, code comments, variable names, or error messages.
30. Route paths use `/my/selling/crosslist/*` — never `/crosslister/`, `/import/`, or `/dashboard`.

---

## 5. TEST REQUIREMENTS

### Unit Tests

**File:** `src/lib/crosslister/connectors/__tests__/ebay-connector.test.ts`
- `authenticate()` — returns AuthResult with tokens on success
- `authenticate()` — returns error result on invalid code
- `fetchListings()` — returns paginated ExternalListing array
- `fetchListings()` — handles empty response (no listings)
- `fetchListings()` — handles pagination (hasMore + cursor)
- `healthCheck()` — returns healthy when API responds 200
- `healthCheck()` — returns unhealthy when API responds error
- Mock `fetch` for all eBay API calls

**File:** `src/lib/crosslister/connectors/__tests__/ebay-normalizer.test.ts`
- Normalizes title correctly (trimming, length limit)
- Converts eBay price string to integer cents
- Maps eBay conditions to Twicely conditions
- Handles missing optional fields gracefully
- Maps image URLs to ExternalImage array
- Returns null condition for unknown eBay condition values

**File:** `src/lib/crosslister/services/__tests__/dedupe-service.test.ts`
- Generates consistent fingerprint for same input
- Finds exact compositeHash match (strong match, >= 90%)
- Finds titleHash-only match (weak match, 70-89%)
- Returns no match for completely different listings
- Handles missing brand/category gracefully

**File:** `src/lib/crosslister/services/__tests__/import-service.test.ts`
- Creates canonical listings with ACTIVE status (never DRAFT)
- Sets importedFromChannel and importedExternalId on created listings
- Creates channelProjection for each imported listing
- Creates dedupeFingerprint for each imported listing
- Handles deduplicated items (links projection to existing listing)
- Marks items with missing title as failed
- Marks items with zero price as failed
- Marks items with no images as failed
- Sets batch to COMPLETED when all items processed
- Sets batch to PARTIALLY_COMPLETED when some items fail
- Sets batch to FAILED on unrecoverable error
- Sets firstImportCompletedAt on account after completion
- Prevents second import for same marketplace (checks firstImportCompletedAt)

**File:** `src/lib/actions/__tests__/crosslister-accounts.test.ts`
- `connectEbayAccount` — returns OAuth URL for authenticated seller
- `connectEbayAccount` — rejects if channel disabled via feature flag
- `connectEbayAccount` — rejects if seller already has active eBay account
- `connectEbayAccount` — rejects for non-seller
- `disconnectAccount` — revokes and sets status to REVOKED
- `disconnectAccount` — rejects for wrong seller (CASL)

**File:** `src/lib/actions/__tests__/crosslister-import.test.ts`
- `startImport` — creates import batch and returns batchId
- `startImport` — rejects if firstImportCompletedAt is set (already imported)
- `startImport` — rejects if account status is not ACTIVE
- `startImport` — rejects if feature flag is disabled
- `startImport` — rejects for non-seller
- `getImportBatchStatus` — returns batch with counts
- `getImportIssues` — returns failed records paginated
- `retryImportRecord` — re-processes a failed record

**File:** `src/lib/queries/__tests__/crosslister.test.ts`
- `getConnectedAccounts` — returns accounts for seller only
- `getImportBatches` — returns batches ordered by createdAt DESC
- `getCrosslisterDashboardData` — aggregates accounts + counts

**Target: ~55-65 new tests across all test files.**

---

## 6. FILE APPROVAL LIST

### New Files (27)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/connectors/ebay-connector.ts` | eBay PlatformConnector implementation (OAuth, fetchListings, healthCheck) |
| 2 | `src/lib/crosslister/connectors/ebay-types.ts` | TypeScript types for eBay API responses (inventory item, offer, etc.) |
| 3 | `src/lib/crosslister/connectors/ebay-normalizer.ts` | Maps eBay inventory items to Twicely ExternalListing shape |
| 4 | `src/lib/crosslister/services/import-service.ts` | Core import pipeline: fetch, dedupe, transform, create listings |
| 5 | `src/lib/crosslister/services/dedupe-service.ts` | Fingerprint generation and duplicate matching |
| 6 | `src/lib/crosslister/services/listing-creator.ts` | Helper to create canonical listing + projection from normalized data |
| 7 | `src/lib/crosslister/services/import-notifier.ts` | Sends notification when import completes |
| 8 | `src/app/api/crosslister/ebay/callback/route.ts` | eBay OAuth callback handler (GET) |
| 9 | `src/lib/actions/crosslister-accounts.ts` | Server actions: connectEbayAccount, disconnectAccount, refreshAccountAuth |
| 10 | `src/lib/actions/crosslister-import.ts` | Server actions: startImport, getImportBatchStatus, getImportIssues, retryImportRecord |
| 11 | `src/lib/queries/crosslister.ts` | Queries: getConnectedAccounts, getImportBatches, getCrosslisterDashboardData, etc. |
| 12 | `src/app/(marketplace)/my/selling/crosslist/page.tsx` | Crosslister dashboard page |
| 13 | `src/app/(marketplace)/my/selling/crosslist/connect/page.tsx` | Connect platform page |
| 14 | `src/app/(marketplace)/my/selling/crosslist/import/page.tsx` | Import progress page |
| 15 | `src/app/(marketplace)/my/selling/crosslist/import/issues/page.tsx` | Import issues page |
| 16 | `src/components/crosslister/platform-card.tsx` | Connected platform status card |
| 17 | `src/components/crosslister/connect-platform-cta.tsx` | Empty state CTA to connect first platform |
| 18 | `src/components/crosslister/connect-platform-grid.tsx` | Grid of platforms with connect buttons |
| 19 | `src/components/crosslister/import-progress.tsx` | Import progress bar + live counts |
| 20 | `src/components/crosslister/import-summary.tsx` | Completed import summary card |
| 21 | `src/components/crosslister/import-start-form.tsx` | Account selector + start import button |
| 22 | `src/components/crosslister/import-issues-table.tsx` | Table of failed records with retry |
| 23 | `src/lib/crosslister/connectors/__tests__/ebay-connector.test.ts` | eBay connector unit tests |
| 24 | `src/lib/crosslister/connectors/__tests__/ebay-normalizer.test.ts` | eBay normalizer unit tests |
| 25 | `src/lib/crosslister/services/__tests__/import-service.test.ts` | Import service unit tests |
| 26 | `src/lib/crosslister/services/__tests__/dedupe-service.test.ts` | Dedupe service unit tests |
| 27 | `src/lib/actions/__tests__/crosslister-accounts.test.ts` | Account management action tests |

### New Files (continued)

| # | File Path | Description |
|---|-----------|-------------|
| 28 | `src/lib/actions/__tests__/crosslister-import.test.ts` | Import action tests |
| 29 | `src/lib/queries/__tests__/crosslister.test.ts` | Crosslister query tests |

### Modified Files (4)

| # | File Path | Change |
|---|-----------|--------|
| 1 | `src/lib/hub/hub-nav.ts` | Update `HAS_CROSSLISTER` gate to show for ALL sellers (not just ListerTier !== NONE). The free import must be visible to all sellers. |
| 2 | `src/lib/db/seed/seed-crosslister.ts` | Add eBay OAuth config platform_settings keys (clientId, clientSecret, redirectUri, environment) and `import_completed` notification template |
| 3 | `src/lib/crosslister/index.ts` | Add import for ebay-connector so it self-registers on module load |
| 4 | `src/lib/notifications/templates.ts` | Add `import_completed` template definition (if templates are registered here) |

**Total: 29 new + 4 modified = 33 files**

---

## 7. PARALLEL STREAMS

The work can be organized into 3 parallel streams after an initial setup step:

### Stream 0 (Sequential — do first, ~15 min)
- Modify `hub-nav.ts` gate
- Add seed data for eBay OAuth settings
- Add notification template

### Stream A: eBay Connector + Normalizer (~45 min)
- `ebay-types.ts`
- `ebay-connector.ts`
- `ebay-normalizer.ts`
- `ebay-connector.test.ts`
- `ebay-normalizer.test.ts`

### Stream B: Import Pipeline Services + Actions (~60 min)
- `dedupe-service.ts` + tests
- `import-service.ts` + tests
- `listing-creator.ts`
- `import-notifier.ts`
- `crosslister-accounts.ts` (actions) + tests
- `crosslister-import.ts` (actions) + tests
- `crosslister.ts` (queries) + tests
- `callback/route.ts` (OAuth API route)

### Stream C: UI Pages + Components (~45 min)
- Depends on Stream B (needs queries and actions)
- All 4 pages
- All 7 components

---

## 8. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Verify test count >= BASELINE (2646)
# Paste the full summary line

# 4. Banned terms check
./twicely-lint.sh

# 5. File size check — no files over 300 lines
find src/lib/crosslister src/lib/actions/crosslister* src/lib/queries/crosslister* src/app/api/crosslister src/app/\(marketplace\)/my/selling/crosslist src/components/crosslister -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20

# 6. Route prefix check — verify all crosslister routes use /my/selling/crosslist
grep -rn "crosslist" src/app --include="*.tsx" --include="*.ts" -l

# 7. Verify no 'as any' in new files
grep -rn "as any" src/lib/crosslister src/lib/actions/crosslister* src/lib/queries/crosslister* src/components/crosslister

# 8. Verify no hardcoded fee rates in new files
grep -rn "0\.10\|0\.11\|0\.105\|0\.095\|0\.09\|0\.085\|0\.08" src/lib/crosslister

# 9. Verify imported listings go ACTIVE (never DRAFT)
grep -rn "DRAFT" src/lib/crosslister/services/import-service.ts src/lib/crosslister/services/listing-creator.ts
# Expected: 0 occurrences

# 10. Verify ownership uses sellerId/userId, never storeId
grep -rn "storeId\|sellerProfileId" src/lib/crosslister src/lib/actions/crosslister* src/lib/queries/crosslister*
# Expected: 0 occurrences (sellerId is used, which references user.id)
```

---

## 9. SPEC CLARIFICATIONS AND OPEN QUESTIONS

### Resolved In This Prompt
1. **Image handling during import:** Store eBay image URLs directly in listing images — do NOT download to R2 during import. This keeps imports fast. Image migration to R2 is a separate background job (out of scope for F1).
2. **Sidebar visibility:** The `HAS_CROSSLISTER` gate must show for ALL sellers, not just ListerTier subscribers. The free import is the supply flywheel — gating it defeats the purpose.
3. **pHash for dedupe:** Defer image perceptual hashing to a later enhancement. F1 uses text-based fingerprinting only (title hash + price range + brand + category).
4. **Centrifugo real-time updates:** The Lister Canonical specifies real-time import progress via Centrifugo. For F1, use polling (every 3 seconds via `getImportBatchStatus`) as a fallback. Centrifugo integration for import progress events can be added as an enhancement.
5. **Token encryption:** Store tokens as plain text in F1 with a TODO comment. Encryption service integration is a cross-cutting concern addressed separately.

### NOT SPECIFIED — Owner Decision Needed
1. **Re-import after first free import:** The spec says "Re-import (pulling new items added since first import) requires Crosslister Lite+." F1 only builds the one-time free import. The UI should NOT show an import button after `firstImportCompletedAt` is set (for F1). Re-import functionality is deferred to F2+.
2. **Listing slug collision handling:** When creating listings from import, slug collisions are possible. The installer should use the same slug collision resolution logic from B2 listing creation (append random suffix). Confirm this is the correct approach.
3. **Category mapping during import:** eBay categories need to map to Twicely categories. For F1, set `categoryId: null` on imported listings and let sellers categorize manually. Category auto-mapping is a separate enhancement. Confirm this is acceptable for launch.
