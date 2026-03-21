# Install Prompt: F3 — Crosslist Outbound (Publish to External Platforms)

---

## 1. HEADER

- **Phase & Step**: `[F3]`
- **Feature Name**: Crosslist Outbound — Publish Twicely Listings to External Platforms
- **One-line Summary**: Build the complete outbound publishing pipeline: transform a canonical Twicely listing into platform-specific format, create channel projections, call connector.createListing(), display publish UI with per-platform overrides, and enforce ListerTier publish metering + crosslist feature flags.
- **Canonical Sources** (read ALL before writing ANY code):
  - `TWICELY_V3_LISTER_CANONICAL.md` Sections 1, 3, 7, 8, 9, 15 — PRIMARY authority for publishing flow, publish limits, overrides, policy engine, transform engine
  - `TWICELY_V3_SCHEMA_v2_0_7.md` Section 12 — crosslister schema (channelProjection, crossJob, channelCategoryMapping, channelPolicyRule)
  - `TWICELY_V3_PAGE_REGISTRY.md` Row 56 — `/my/selling/crosslist` (crosslister dashboard)
  - `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` Section 46 — crosslister UX integration (listing form toggles, sidebar widget, cross-platform price editing)
  - `TWICELY_V3_DECISION_RATIONALE.md` Decisions #15 (independent axes), #16 (imports active), #17 (supply engine), #31 (no fees on off-platform)
  - `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` Section 3.3 — seller CASL rules for ChannelProjection, CrossJob
  - `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` Section 6 — ListerTier publish limits (FREE=25, LITE=200, PRO=2000)
  - `Build-docs/SCHEMA_ADDENDUM_A2_4_PLATFORM_EXPANSION.md` Section 7 — connector feature flag enforcement

---

## 2. PREREQUISITES

### 2.1 Phases That Must Be Complete
- **F1** (eBay Import) -- COMPLETE
- **F2** (Poshmark + Mercari Import) -- COMPLETE
- **E2.1** (Crosslister Connector Framework) -- COMPLETE
- **D3** (Store Subscriptions) -- COMPLETE (ListerTier subscription state accessible via sellerProfile)

### 2.2 Tables That Must Already Exist (verified present in codebase)
- `crosslisterAccount` (crosslister.ts) -- exists
- `channelProjection` (crosslister.ts) -- exists
- `crossJob` (crosslister.ts) -- exists
- `channelCategoryMapping` (crosslister.ts) -- exists
- `channelPolicyRule` (crosslister.ts) -- exists
- `listing` + `listingImage` (listings.ts) -- exists
- `sellerProfile` (auth.ts) -- exists (has `listerTier` column)
- `platformSetting` (platform.ts) -- exists
- `featureFlag` (platform.ts) -- exists

### 2.3 Services That Must Already Exist (verified present in codebase)
- All 8 connector classes (ebay, poshmark, mercari, depop, etsy, fb-marketplace, grailed, therealreal) -- exist in `src/lib/crosslister/connectors/`
- Connector interface with `createListing()`, `updateListing()`, `delistListing()` methods -- exists in `connector-interface.ts`
- Connector registry (`getConnector()`, `hasConnector()`) -- exists in `connector-registry.ts`
- Channel registry (`getChannelMetadata()`, `CHANNEL_REGISTRY`) -- exists in `channel-registry.ts`
- `TransformedListing`, `PublishResult`, `DelistResult` types -- exist in `types.ts`
- `isFeatureEnabled()` service -- exists in `src/lib/services/feature-flags.ts`
- Seed data: `crosslister.*.crosslistEnabled` platformSetting keys + `crosslister.publishLimit.*` keys -- exist in `seed-crosslister.ts`

### 2.4 Current State of Connector `createListing()` Methods
ALL 8 connectors have **stub implementations** that return `{ success: false, error: 'Not implemented in F1', retryable: false }`. F3 replaces these stubs with real API call implementations.

### 2.5 Current State of Validations
`src/lib/validations/crosslister.ts` already has:
- `publishListingsSchema` -- validates `{ listingIds: string[], channels: ExternalChannel[] }`
- `updateProjectionOverridesSchema` -- validates `{ projectionId, titleOverride?, descriptionOverride?, priceCentsOverride? }`
- `cancelJobSchema` -- validates `{ jobId }`

Use these AS-IS. Do not recreate them.

### 2.6 Current State of CASL
All crosslister subjects already exist in `subjects.ts`:
- `CrosslisterAccount`, `ChannelProjection`, `CrossJob`, `ImportBatch`, `AutomationSetting`

Seller abilities (ability.ts lines 207-225):
- `can('create', 'ChannelProjection', { sellerId: userId })`
- `can('manage', 'ChannelProjection', { sellerId: userId })`
- `can('delete', 'ChannelProjection', { sellerId: userId })`
- `can('read', 'CrossJob', { sellerId: userId })`
- `can('delete', 'CrossJob', { sellerId: userId })`

Delegation scopes (staff-abilities.ts lines 120-125):
- `crosslister.publish` grants: create ChannelProjection, read ChannelProjection, read CrossJob

These are SUFFICIENT. **No CASL changes needed for F3.**

---

## 3. SCOPE -- EXACTLY WHAT TO BUILD

### IMPORTANT: Feature Flag Enforcement Pattern

**Two feature flag systems coexist in the codebase.** The existing crosslister code uses `platformSetting` keys like `crosslister.ebay.crosslistEnabled`. The SCHEMA_ADDENDUM_A2_4 introduces `connector:*` keys in the `featureFlag` table for Phase H (browser extension platforms).

**For F3, use the EXISTING `platformSetting` pattern** (`crosslister.{channel}.crosslistEnabled`) since that is what all current code uses, what is already seeded, and what the channel registry references via `featureFlags.crosslistEnabled`. The `connector:*` featureFlag keys from SCHEMA_ADDENDUM_A2_4 are for Phase H and are NOT seeded in the current codebase.

**Additionally**, check the `connector:*` feature flag from the `featureFlag` table using `isFeatureEnabled()` as a second kill-switch. Both must pass for a publish to proceed. This implements the "two checks per connector" rule from SCHEMA_ADDENDUM_A2_4 Section 7.

### 3.1 Transform Service -- NEW

**File**: `src/lib/crosslister/services/listing-transform.ts`

The REVERSE of the import normalizer: converts a canonical Twicely listing + listingImages into a `TransformedListing` ready for `connector.createListing()`.

**Source**: Lister Canonical Section 15.2 (Transform Engine), Section 7.4 (Per-Platform Overrides)

```typescript
// NOT a 'use server' file. Plain TypeScript module.

import type { ExternalChannel, TransformedListing, TransformedImage, TransformedShipping, ExternalCategoryMapping } from '../types';

interface CanonicalListingData {
  id: string;
  title: string | null;
  description: string | null;
  priceCents: number | null;
  condition: string | null;
  brand: string | null;
  quantity: number;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  freeShipping: boolean;
  shippingCents: number;
  attributesJson: Record<string, unknown>;
  categoryId: string | null;
}

interface CanonicalImageData {
  url: string;
  position: number;
  isPrimary: boolean;
}

interface ChannelOverrides {
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  priceCentsOverride?: number | null;
  categoryOverride?: ExternalCategoryMapping | null;
  shippingOverride?: TransformedShipping | null;
  itemSpecificsOverride?: Record<string, string> | null;
}

export interface TransformInput {
  listing: CanonicalListingData;
  images: CanonicalImageData[];
  channel: ExternalChannel;
  overrides: ChannelOverrides | null;
}

export function transformListingForChannel(input: TransformInput): TransformedListing
```

**Transform rules** (Lister Canonical Section 15.2):
1. **Title**: Use `overrides.titleOverride` if set, else `listing.title`. Truncate to channel's `maxTitleLength` from `getChannelMetadata(channel).defaultCapabilities.maxTitleLength`.
2. **Description**: Use `overrides.descriptionOverride` if set, else `listing.description`. Truncate to channel's `maxDescriptionLength`. For eBay/Etsy: wrap bare text in `<p>` tags (set `descriptionHtml`). For all others: strip HTML to plain text (set `descriptionHtml` to null).
3. **Price**: Use `overrides.priceCentsOverride` if set (integer cents), else `listing.priceCents`. Must be > 0.
4. **Images**: Convert image rows to `TransformedImage[]`. Limit to channel's `maxImagesPerListing`. Order by `position`. First image gets `isPrimary: true`.
5. **Category**: Use `overrides.categoryOverride` if set, else attempt lookup from `channelCategoryMapping` table for `listing.categoryId` + `channel`. If no mapping found, use `{ externalCategoryId: '', externalCategoryName: '', path: [] }` (connector handles missing category gracefully).
6. **Shipping**: Use `overrides.shippingOverride` if set, else derive from listing fields:
   - If `listing.freeShipping` -> `type: 'FREE'`, `flatRateCents: null`
   - Else if `listing.shippingCents > 0` -> `type: 'FLAT'`, `flatRateCents: listing.shippingCents`
   - Else -> `type: 'CALCULATED'`, weight/dimensions from listing
   - `handlingTimeDays`: default to 3 (read from `platformSetting` `commerce.fulfillment.handlingTimeDays` if exists, else 3)
7. **Item Specifics**: Use `overrides.itemSpecificsOverride` if set, else convert `listing.attributesJson` to `Record<string, string>` (stringify non-string values).
8. **Condition**: Pass through `listing.condition` as-is (connectors map internally).
9. **Quantity**: Use `listing.quantity` directly.
10. **Brand**: Use `listing.brand` or null.

### 3.2 Publish Metering Service -- NEW

**File**: `src/lib/crosslister/services/publish-meter.ts`

Checks and records a seller's monthly publish allowance based on their ListerTier.

**Source**: Lister Canonical Section 7.1, 7.3; Pricing Canonical Section 6

```typescript
// NOT a 'use server' file. Plain TypeScript module.

export interface PublishAllowance {
  tier: string;          // ListerTier value from sellerProfile
  monthlyLimit: number;  // from platformSetting
  usedThisMonth: number; // count of CREATE crossJobs this calendar month
  remaining: number;     // monthlyLimit - usedThisMonth (min 0)
  rolloverBalance: number;  // always 0 for F3 (rollover is F4 scope)
}

// Get publish allowance state for a seller
export async function getPublishAllowance(sellerId: string): Promise<PublishAllowance>

// Check if seller can publish N listings (does NOT decrement)
export async function canPublish(sellerId: string, count: number): Promise<boolean>

// Record N successful publishes by incrementing usage counter
// Implementation: This is a query count, not a stored counter.
// Usage is DERIVED from crossJob rows with jobType='CREATE' and status
// in ('COMPLETED','IN_PROGRESS','PENDING','QUEUED') for current calendar month.
// recordPublishes() is a no-op because usage is derived —
// creating crossJob rows IS the recording.
export async function recordPublishes(sellerId: string, count: number): Promise<void>
```

**Implementation details:**
- Read seller's `listerTier` from `sellerProfile` table where `userId = sellerId`.
- Read publish limit from `platformSetting` keys:
  - `crosslister.publishLimit.free` -> 25
  - `crosslister.publishLimit.lite` -> 200
  - `crosslister.publishLimit.pro` -> 2000
- ListerTier `NONE` -> 0 publishes (cannot crosslist without subscription).
- Count used publishes this calendar month: count `crossJob` rows where `sellerId` matches, `jobType = 'CREATE'`, `status IN ('COMPLETED', 'IN_PROGRESS', 'PENDING', 'QUEUED')`, and `createdAt >= start of current calendar month (UTC)`.
- Calendar month reset on 1st of month (UTC), not rolling 30-day (Lister Canonical Section 7.1).
- Rollover logic deferred to F4 (set `rolloverBalance: 0` always).
- `recordPublishes` is a no-op since usage is derived from crossJob row count.

### 3.3 Policy Validation Service -- NEW

**File**: `src/lib/crosslister/services/policy-validator.ts`

Validates a listing against a target platform's requirements BEFORE publishing.

**Source**: Lister Canonical Section 15.1 (Policy Engine)

```typescript
// NOT a 'use server' file. Plain TypeScript module.

export type PolicyResult =
  | { status: 'ALLOW' }
  | { status: 'DENY'; reason: string }
  | { status: 'REQUIRE_FIELDS'; fields: string[] }
  | { status: 'REQUIRE_CHANGES'; changes: Array<{ field: string; guidance: string }> };

export async function validateForChannel(
  listing: CanonicalListingData,
  images: CanonicalImageData[],
  channel: ExternalChannel,
): Promise<PolicyResult>
```

**Validation rules** (Lister Canonical Section 15.1):
1. Title required (not null/empty) -> DENY "Listing title is required"
2. At least 1 image required -> DENY "At least one image is required"
3. Price > 0 cents -> DENY "Price must be greater than zero"
4. Title length: if exceeds channel `maxTitleLength` -> REQUIRE_CHANGES with guidance
5. Description length: if exceeds channel `maxDescriptionLength` -> REQUIRE_CHANGES with guidance
6. Image count: if exceeds channel `maxImagesPerListing` -> REQUIRE_CHANGES (note: transform will auto-trim, but warn the seller)
7. Channel policy rules: query `channelPolicyRule` table for `channel` where `isActive = true`. For each rule, evaluate `constraintJson` against listing. If severity `BLOCK` -> DENY. If severity `WARN` -> REQUIRE_CHANGES.

**Note**: Return the FIRST blocking result found (DENY takes precedence). If no blocking results, return ALLOW. REQUIRE_CHANGES and REQUIRE_FIELDS are collected into arrays if multiple apply.

### 3.4 Publish Service -- NEW

**File**: `src/lib/crosslister/services/publish-service.ts`

Orchestrates the full publish pipeline for one listing to one channel.

**Source**: Lister Canonical Section 7.2 (Publish Flow — steps 1-6)

```typescript
// NOT a 'use server' file. Plain TypeScript module.

export interface PublishJobResult {
  success: boolean;
  projectionId: string | null;
  externalId: string | null;
  externalUrl: string | null;
  error?: string;
}

export async function publishListingToChannel(
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  overrides?: ChannelOverrides | null,
): Promise<PublishJobResult>
```

**Pipeline steps** (matches Lister Canonical Section 7.2):

1. **LOAD LISTING**: Query listing + images from DB. Verify `ownerUserId === sellerId` and `status === 'ACTIVE'`. If not -> return error.

2. **VALIDATE** (Policy): Call `validateForChannel()`. If result is DENY -> return error. If REQUIRE_FIELDS or REQUIRE_CHANGES -> return error with details. Only ALLOW proceeds.

3. **CHECK CROSSLIST FEATURE FLAG**: Query `platformSetting` for `crosslister.{channelKey}.crosslistEnabled` where `channelKey` maps as:
   - `EBAY` -> `ebay`, `POSHMARK` -> `poshmark`, `MERCARI` -> `mercari`, `DEPOP` -> `depop`
   - `FB_MARKETPLACE` -> `fbMarketplace`, `ETSY` -> `etsy`, `GRAILED` -> `grailed`, `THEREALREAL` -> `therealreal`

   Also check `isFeatureEnabled('connector:{channel_lowercase}')` from the `featureFlag` table. If EITHER check fails -> return error "Publishing to {displayName} is currently disabled."

   **Exception**: If the `connector:*` flag does not exist in the `featureFlag` table, skip that check (it will be seeded in Phase H). The `platformSetting` check is the primary gate for F3.

4. **LOOKUP ACCOUNT**: Find seller's `crosslisterAccount` for this channel with `status = 'ACTIVE'`. If not found -> return error "No active {displayName} account connected. Connect your account first."

5. **TRANSFORM**: Call `transformListingForChannel()` with listing data, images, channel, and overrides. Produce a `TransformedListing`.

6. **CREATE/UPSERT PROJECTION**:
   - Check for existing `channelProjection` with same `(listingId, accountId, channel)`.
   - If exists and status is `ACTIVE` or `PUBLISHING` -> return error "This listing is already published to {displayName}."
   - If exists with other status -> update to `status = 'PUBLISHING'`, reset `publishAttempts = 0`, update `overridesJson`.
   - If not exists -> insert new row with `status = 'PUBLISHING'`, `sellerId`, `overridesJson`.

7. **CREATE CROSS JOB**: Insert `crossJob` row:
   - `sellerId`
   - `projectionId` = the channelProjection ID
   - `accountId` = the crosslisterAccount ID
   - `jobType = 'CREATE'`
   - `priority = 300` (Lister Canonical Section 8.2)
   - `idempotencyKey = 'publish:{listingId}:{channel}:{Date.now()}'`
   - `status = 'IN_PROGRESS'`
   - `payload = { listingId, channel, transformedListing }` (as jsonb)
   - `startedAt = new Date()`

8. **EXECUTE**: Call `connector.createListing(account, transformedListing)`.
   - On SUCCESS:
     - Update projection: `status = 'ACTIVE'`, `externalId = result.externalId`, `externalUrl = result.externalUrl`
     - Update crossJob: `status = 'COMPLETED'`, `completedAt = new Date()`, `result = { externalId, externalUrl }`
     - Return success with projectionId, externalId, externalUrl
   - On FAILURE (retryable):
     - Increment projection `publishAttempts`
     - Update projection `lastPublishError = result.error`
     - Update crossJob: `status = 'FAILED'`, `lastError = result.error`, `attempts += 1`
     - Return error
   - On FAILURE (not retryable):
     - Update projection `status = 'ERROR'`, `lastPublishError = result.error`
     - Update crossJob: `status = 'FAILED'`, `lastError = result.error`
     - Return error

**IMPORTANT**: F3 executes inline (no BullMQ scheduler). The scheduler is F3.1 scope. F3 calls the connector directly in the server action request context, same pattern as `processImportBatch` in F1.

### 3.5 Crosslist Publish Server Actions -- NEW

**File**: `src/lib/actions/crosslister-publish.ts`

```typescript
'use server';
```

**Actions:**

#### `publishListings(input: unknown): Promise<ActionResult<PublishSummary>>`

```typescript
interface PublishSummary {
  published: number;
  failed: number;
  errors: Array<{ listingId: string; channel: string; error: string }>;
}
```

Steps:
1. Validate with existing `publishListingsSchema` (max 500 listings, min 1 channel)
2. `const { session, ability } = await authorize()`
3. Check `ability.can('create', 'ChannelProjection')`. If not -> Forbidden.
4. `const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId`
5. Check publish metering: `canPublish(sellerId, listingIds.length * channels.length)`. If false -> return error with current allowance: "Insufficient publish credits. {remaining} remaining, {needed} needed. Upgrade your Crosslister plan."
6. Verify ALL listings are owned by seller (`ownerUserId`) AND have status `ACTIVE`. Reject any that don't match.
7. For each `(listingId, channel)` pair: call `publishListingToChannel(listingId, channel, sellerId)`. Collect results.
8. Return summary with published/failed counts and error details.

**Note**: `recordPublishes()` is not called explicitly because creating `crossJob` rows with `jobType = 'CREATE'` IS the recording (usage is derived by counting these rows).

#### `delistFromChannel(input: unknown): Promise<ActionResult>`

Schema: `z.object({ projectionId: z.string().min(1) }).strict()`

Steps:
1. Validate input
2. `authorize()` + `ability.can('delete', 'ChannelProjection')`
3. `sellerId` from session (with delegation support)
4. Lookup projection by ID where `sellerId` matches
5. If not found -> "Not found"
6. If `status` is not `ACTIVE` -> "Listing is not active on this platform"
7. Lookup `crosslisterAccount` by `projection.accountId`
8. Check crosslist feature flag for the channel (same dual-check as publish)
9. Call `connector.delistListing(account, projection.externalId!)`
10. On success: update projection `status = 'DELISTED'`
11. On failure: return error
12. Delists do NOT create crossJob rows with `jobType = 'CREATE'`, so they do NOT consume publishes

#### `updateProjectionOverrides(input: unknown): Promise<ActionResult>`

Steps:
1. Validate with existing `updateProjectionOverridesSchema`
2. `authorize()` + `ability.can('update', 'ChannelProjection')`
3. `sellerId` from session
4. Lookup projection + verify `sellerId`
5. Update `overridesJson` with explicit field mapping:
   ```typescript
   const newOverrides = {
     ...currentOverrides,
     ...(parsed.data.titleOverride !== undefined ? { titleOverride: parsed.data.titleOverride } : {}),
     ...(parsed.data.descriptionOverride !== undefined ? { descriptionOverride: parsed.data.descriptionOverride } : {}),
     ...(parsed.data.priceCentsOverride !== undefined ? { priceCentsOverride: parsed.data.priceCentsOverride } : {}),
   };
   ```
6. If projection `status === 'ACTIVE'` and `syncEnabled === true`: set `hasPendingSync = true` (sync execution is F3.1 scope)
7. `revalidatePath('/my/selling/crosslist')`

#### `getPublishAllowanceAction(): Promise<ActionResult<PublishAllowance>>`

Steps:
1. `authorize()` + `ability.can('read', 'ChannelProjection')`
2. `sellerId` from session
3. Call `getPublishAllowance(sellerId)`
4. Return the allowance data

### 3.6 Crosslist Queries -- MODIFY EXISTING FILE

**File**: `src/lib/queries/crosslister.ts` -- ADD these functions to the existing file

```typescript
// Get all channel projections for a specific listing
export async function getProjectionsForListing(
  listingId: string,
  sellerId: string,
): Promise<ChannelProjection[]>

// Get all channel projections for a seller (paginated, filterable)
export async function getSellerProjections(
  sellerId: string,
  options?: { channel?: string; status?: string; page?: number; limit?: number }
): Promise<{ projections: Array<ChannelProjection & { listingTitle: string | null }>; total: number }>

// Get pending/active cross jobs for a seller
export async function getSellerCrossJobs(
  sellerId: string,
  options?: { status?: string; limit?: number }
): Promise<CrossJob[]>

// Get listing + images for the transform pipeline
export async function getListingForPublish(
  listingId: string,
  sellerId: string,
): Promise<{ listing: CanonicalListingData; images: CanonicalImageData[] } | null>
```

**Implementation notes:**
- `getSellerProjections` joins `channelProjection` with `listing` to get `listing.title` for display.
- `getListingForPublish` fetches from `listing` + `listingImage` tables, returns null if listing not found or not owned by seller.
- All queries include `sellerId` ownership check.

### 3.7 Connector `createListing()` / `updateListing()` / `delistListing()` Implementations -- MODIFY 8 FILES

Replace the stub methods in ALL 8 connectors with real API implementations.

**Files to modify:**
- `src/lib/crosslister/connectors/ebay-connector.ts`
- `src/lib/crosslister/connectors/poshmark-connector.ts`
- `src/lib/crosslister/connectors/mercari-connector.ts`
- `src/lib/crosslister/connectors/etsy-connector.ts`
- `src/lib/crosslister/connectors/depop-connector.ts`
- `src/lib/crosslister/connectors/fb-marketplace-connector.ts`
- `src/lib/crosslister/connectors/grailed-connector.ts`
- `src/lib/crosslister/connectors/therealreal-connector.ts`

**Pattern for ALL connectors** (platform-specific API details vary):

```typescript
async createListing(
  account: CrosslisterAccount,
  listing: TransformedListing,
): Promise<PublishResult> {
  if (!account.accessToken && !account.sessionData) {
    return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
  }

  try {
    const config = await this.loadConfig(); // reads platformSetting for API keys/URLs
    // Platform-specific API call using fetch()
    const response = await fetch(/* platform endpoint */, {
      method: 'POST',
      headers: { /* auth + content-type headers */ },
      body: JSON.stringify(/* map TransformedListing to platform-specific payload */),
    });

    if (!response.ok) {
      const isRateLimited = response.status === 429;
      const body = await response.text().catch(() => '');
      logger.error(`[${this.channel}Connector] createListing failed`, {
        status: response.status,
        body: body.slice(0, 500),
      });
      return {
        success: false,
        externalId: null,
        externalUrl: null,
        error: `${this.channel} API error: ${response.status}`,
        retryable: isRateLimited || response.status >= 500,
      };
    }

    const data = await response.json();
    return {
      success: true,
      externalId: /* extract from response */,
      externalUrl: /* construct platform URL */,
      retryable: false,
    };
  } catch (err) {
    logger.error(`[${this.channel}Connector] createListing error`, { error: String(err) });
    return {
      success: false,
      externalId: null,
      externalUrl: null,
      error: String(err),
      retryable: true,
    };
  }
}
```

**Per-connector API specifics:**

| Connector | Tier | Create Endpoint | Delist Endpoint | Key Notes |
|-----------|------|----------------|-----------------|-----------|
| eBay | A | `PUT /sell/inventory/v1/inventory_item/{sku}` then `POST /sell/inventory/v1/offer` then `POST /sell/inventory/v1/offer/{offerId}/publish` | `DELETE /sell/inventory/v1/offer/{offerId}` then `DELETE /sell/inventory/v1/inventory_item/{sku}` | 3-step publish flow. SKU = `tw-{listingId}` |
| Etsy | A | `POST /v3/application/shops/{shopId}/listings` | `DELETE /v3/application/shops/{shopId}/listings/{listingId}` | Single-step. Shop ID from account externalAccountId |
| Mercari | B | `POST /v1/listings` | `PUT /v1/listings/{id}/status` with body `{ status: 'ended' }` | |
| Depop | B | `POST /v1/products` | `DELETE /v1/products/{id}` | Max 4 images |
| FB Marketplace | B | `POST /{page-id}/commerce_listings` | `DELETE /{listing-id}` | Graph API v18.0+ |
| Grailed | B | `POST /api/listings` | `PUT /api/listings/{id}` with body `{ status: 'removed' }` | |
| Poshmark | C | Session: `POST /vm-rest/posts` | Session: `POST /vm-rest/posts/{id}/delete` | Session cookies. Add human-like delay (2-8s random) before call. |
| TheRealReal | C | Session: `POST /api/consignments` | Session: `PUT /api/consignments/{id}` with status=withdrawn | Session cookies. Add human-like delay. |

**Also implement `updateListing()`** in all connectors: same pattern, uses PUT/PATCH to update existing external listing. Used for syncs (F3.1), but the method must exist in F3.

**Also implement `delistListing()`** in all connectors: remove/end the listing on the external platform.

### 3.8 Crosslist UI Components -- NEW (5 files)

#### `src/components/crosslister/crosslist-panel.tsx` -- NEW

The "Also list on" panel for the crosslister command center. (Feature Lock-in Section 46.)

**Two visual states:**

**State 1: Has ListerTier subscription (FREE, LITE, or PRO)**
- Header: "Also list on" with ListerTier badge (e.g., "Crosslister Pro")
- One row per connected + crosslist-enabled platform:
  - Checkbox (default checked if capabilities.canPublish is true)
  - Platform icon (use channel registry `iconSlug`) + display name
  - Readiness indicator: "Ready" (green) or "Missing: [field]" (amber)
- Platforms not connected: grayed out row, "Connect" link to `/my/selling/crosslist/connect`
- Below toggles: `<PublishMeter />` component
- If any checkboxes selected: "Publish to {N} platforms" button

**State 2: No ListerTier subscription (NONE)**
- Grayed out panel with platform icons at opacity 35%
- Upsell text: "List on eBay, Poshmark, Mercari and more" with link to `/my/selling/subscription`
- No checkboxes, no publish button

```typescript
interface CrosslistPanelProps {
  connectedAccounts: CrosslisterAccount[];
  publishAllowance: PublishAllowance;
  listerTier: string;
  selectedListingIds: string[];
  onPublish: (channels: ExternalChannel[]) => void;
}
```

#### `src/components/crosslister/publish-dialog.tsx` -- NEW

Modal dialog for confirming and executing a batch publish.

- Shows: listing count, selected platforms, total publishes needed
- Shows: current publish allowance (remaining / limit)
- Warning if insufficient credits
- "Publish" button triggers the `publishListings` action
- During publish: shows progress (spinner + "Publishing {n} of {total}...")
- After publish: shows summary table (listing title, platform, result status, external URL link or error message)
- "Done" button closes dialog

#### `src/components/crosslister/projection-table.tsx` -- NEW

Table for the crosslister command center showing all published projections.

- Columns: Listing title, Platform (icon + name), Status (badge), External URL (clickable link), Last Published, Actions
- Action buttons per row:
  - "Delist" (calls `delistFromChannel`) -- only shown for status ACTIVE
  - "Edit overrides" (opens ProjectionOverridesDialog) -- only shown for status ACTIVE
  - "Retry" (re-publish) -- only shown for status ERROR
- Filters: channel dropdown, status dropdown
- Pagination
- Empty state: "No crosslisted items yet. Select listings and platforms above to get started."

#### `src/components/crosslister/projection-overrides-dialog.tsx` -- NEW

Modal for editing per-channel overrides on a specific projection.

- Fields:
  - Title override (text input, shows channel max length as hint, e.g., "eBay: max 80 characters")
  - Description override (textarea)
  - Price override (number input in dollars, converts to/from cents for storage)
- "Save" button calls `updateProjectionOverrides` action
- "Clear" button sets all overrides to null (revert to canonical values)
- Shows current canonical values as placeholders

#### `src/components/crosslister/publish-meter.tsx` -- NEW

Small component showing publish usage.

- Visual: `{used} / {limit} publishes this month` text + progress bar
- Progress bar color: green (< 75% used), amber (75-90%), red (> 90%)
- ListerTier badge next to meter (e.g., "FREE", "LITE", "PRO")
- If ListerTier NONE: shows "Upgrade to Crosslister to crosslist" with link to `/my/selling/subscription`

### 3.9 Crosslister Dashboard Page -- MODIFY

**File**: `src/app/(hub)/my/selling/crosslist/page.tsx`

Extend the existing page to add:
1. `<PublishMeter />` component in the header area
2. After the account cards grid: a section with heading "Crosslisted Items" containing `<ProjectionTable />`
3. A "Crosslist listings" button that opens a listing selector + `<PublishDialog />`
4. Fetch new data: `getSellerProjections(sellerId)`, `getPublishAllowance(sellerId)`, seller's `listerTier`

**WARNING**: Current page is 72 lines. After additions it must stay under 300 lines. Extract data-fetching into a single `getCrosslisterPageData()` function in queries if needed.

---

## 4. CONSTRAINTS -- WHAT NOT TO DO

### 4.1 Banned Terms (scan output before committing)
- `SellerTier` -> use `StoreTier` or `ListerTier`
- `FVF` / `Final Value Fee` -> use `TF` / `Transaction Fee`
- `wallet` (seller UI) -> use `payout`
- `Twicely Balance` -> use `Available for payout`
- `SubscriptionTier` -> use `StoreTier` or `ListerTier`
- `BASIC` (as StoreTier) -> use `STARTER` or `PRO`
- `PREMIUM` -> use `POWER`

### 4.2 Banned Technology
- `as any`, `as unknown as T`, `@ts-ignore`, `@ts-expect-error` -- zero occurrences
- Prisma, NextAuth, Redis, tRPC, Zustand, Meilisearch -- never reference
- `console.log` in production code -- use `logger` from `src/lib/logger.ts`

### 4.3 Business Logic -- MUST NOT
- Create ledger entries or charge fees for crosslisting (Decision #31: no fees on off-platform sales)
- Count delists or syncs as publishes (Lister Canonical Section 7.1)
- Allow crosslisting for ListerTier NONE sellers (0 publishes)
- Hardcode publish limits (read from `platformSetting`)
- Execute connectors via BullMQ in F3 (inline execution; scheduler is F3.1)
- Modify the listing create/edit form page (defer to follow-up)

### 4.4 Route Constraints
- ONLY use `/my/selling/crosslist` prefix for crosslister pages
- NEVER create `/crosslister`, `/dashboard/crosslist`, `/l/`, `/listing/` routes

### 4.5 Code Pattern Constraints
- Max 300 lines per file. Split if approaching limit.
- Money as integer cents only. Display conversion in UI components only.
- Ownership via `userId`. `sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId`
- Zod `.strict()` on ALL input schemas
- Explicit field mapping in DB updates (never spread request body)
- All helper functions in `'use server'` files MUST be unexported (to avoid unintended server actions)

### 4.6 Scope Boundaries -- DEFER to Later Steps
| Feature | Deferred To | Why |
|---------|-------------|-----|
| BullMQ publish scheduler | F3.1 | F3 executes inline |
| Rollover credits | F4 | Always `rolloverBalance: 0` |
| Overage packs | F4 | Block with error if exhausted |
| Centrifugo real-time updates | F3.1+ | Use polling/page refresh |
| Category mapping data population | Manual admin task | Table exists, data is admin-managed |
| Image download/upload to R2 | Background job | Use existing image URLs |
| Two-way sync execution | F3.1 / F5 | F3 sets `hasPendingSync` only |
| Sale detection / emergency delist | F5 | Detection + auto-delist pipeline |
| Listing form crosslist toggles | Follow-up | Form is 299 lines, fragile |

---

## 5. ACCEPTANCE CRITERIA

### 5.1 Publish Pipeline
- [ ] A seller with ListerTier FREE can publish up to 25 listings per calendar month
- [ ] A seller with ListerTier NONE cannot publish (returns "Insufficient publish credits" with 0 remaining)
- [ ] Publishing one listing to eBay + Poshmark + Mercari consumes 3 publishes (one crossJob per platform)
- [ ] Delisting from a platform does NOT create a `jobType = 'CREATE'` crossJob (does not consume publishes)
- [ ] After successful publish: channelProjection row exists with `status = 'ACTIVE'`, `externalId` populated, `externalUrl` populated
- [ ] After failed publish: channelProjection has `status = 'ERROR'` and `lastPublishError` populated
- [ ] A crossJob row is created for every publish attempt with `jobType = 'CREATE'`
- [ ] Publish metering reads limits from `platformSetting` keys, never hardcoded values
- [ ] Calendar month resets usage on the 1st (UTC), not rolling 30-day

### 5.2 Feature Flag Enforcement
- [ ] Publishing to a channel whose `crosslister.{channel}.crosslistEnabled` platformSetting is false returns "Publishing to {displayName} is currently disabled"
- [ ] No hardcoded list of enabled connectors in publish code
- [ ] Feature flag check happens BEFORE any API call to external platform

### 5.3 Transform
- [ ] Titles truncated to channel's `maxTitleLength`
- [ ] Images limited to channel's `maxImagesPerListing`
- [ ] Per-channel overrides from `channelProjection.overridesJson` take precedence over canonical values
- [ ] Price override stored and transmitted as integer cents
- [ ] HTML description generated for Tier A platforms (eBay, Etsy), plain text for others

### 5.4 Policy Validation
- [ ] Listing with no title -> DENY
- [ ] Listing with no images -> DENY
- [ ] Listing with price = 0 or null -> DENY
- [ ] Policy validation runs BEFORE metering check and BEFORE any API call

### 5.5 Authorization
- [ ] Unauthenticated users cannot publish (returns "Unauthorized")
- [ ] Seller can only publish OWN listings (`ownerUserId === sellerId` check)
- [ ] Seller can only delist OWN projections (`sellerId` check)
- [ ] Delegated staff with `crosslister.publish` scope CAN create ChannelProjection
- [ ] Delegated staff WITHOUT `crosslister.publish` scope CANNOT publish

### 5.6 UI
- [ ] Crosslister dashboard shows: connected accounts, publish meter, projections table
- [ ] Publish meter shows "{used} / {limit} publishes this month" with progress bar
- [ ] Projection table shows: listing title, platform, status badge, external URL link, delist button
- [ ] Override dialog: editable title/description/price fields with channel limits displayed
- [ ] Non-subscriber (NONE) sees grayed-out panel with upgrade CTA, no publish controls

### 5.7 Vocabulary & Compliance
- [ ] Zero occurrences of any banned term in UI text, code comments, or variable names
- [ ] All routes use `/my/selling/crosslist` prefix
- [ ] No `as any` or `@ts-ignore` anywhere
- [ ] All files under 300 lines

### 5.8 Data Integrity
- [ ] All monetary values as integer cents (no floats, no dollar amounts in DB)
- [ ] `channelProjection` unique constraint `(listingId, accountId, channel)` prevents duplicate projections
- [ ] `crossJob.idempotencyKey` is unique (no duplicate publish jobs)
- [ ] Connector `createListing()` returns `retryable: boolean` for failure classification

---

## 6. TEST REQUIREMENTS

### 6.1 Unit Tests

#### `src/lib/crosslister/services/__tests__/listing-transform.test.ts` (~15 tests)
- "transforms listing with all fields populated"
- "applies title override when set"
- "applies description override when set"
- "applies price override when set in cents"
- "truncates title to channel max length"
- "limits images to channel max count"
- "orders images by position"
- "marks first image as primary"
- "maps freeShipping true to type FREE"
- "maps flat rate shipping to type FLAT with cents"
- "falls back to empty category when no mapping exists"
- "uses canonical values when no overrides set"
- "handles null description gracefully"
- "handles null condition gracefully"
- "generates descriptionHtml for eBay channel"

#### `src/lib/crosslister/services/__tests__/publish-meter.test.ts` (~10 tests)
- "returns 25 monthly limit for FREE tier"
- "returns 200 monthly limit for LITE tier"
- "returns 2000 monthly limit for PRO tier"
- "returns 0 monthly limit for NONE tier"
- "counts only CREATE jobs in current calendar month"
- "excludes CANCELED and old-month jobs from count"
- "canPublish returns true when within allowance"
- "canPublish returns false when over allowance"
- "canPublish returns false for NONE tier regardless of count"
- "reads limits from platformSetting, not hardcoded"

#### `src/lib/crosslister/services/__tests__/policy-validator.test.ts` (~8 tests)
- "returns ALLOW for valid listing with all required fields"
- "returns DENY for null/empty title"
- "returns DENY for zero images"
- "returns DENY for null price"
- "returns DENY for price of zero cents"
- "returns REQUIRE_CHANGES for title exceeding max length"
- "returns REQUIRE_CHANGES for excess images with guidance text"
- "evaluates channelPolicyRule BLOCK rules as DENY"

#### `src/lib/crosslister/services/__tests__/publish-service.test.ts` (~12 tests)
- "publishes listing to channel and returns success"
- "creates channelProjection with status ACTIVE on success"
- "creates crossJob with jobType CREATE and priority 300"
- "returns error when crosslist feature flag disabled"
- "returns error when no active account for channel"
- "returns error when policy validation returns DENY"
- "sets projection status to ERROR on non-retryable failure"
- "increments publishAttempts on failure"
- "sets unique idempotencyKey on crossJob"
- "applies overrides during transform"
- "stores externalId and externalUrl on projection"
- "rejects publishing to already-active projection"

#### `src/lib/actions/__tests__/crosslister-publish.test.ts` (~15 tests)
- "publishListings validates input with publishListingsSchema"
- "publishListings requires authentication"
- "publishListings requires ChannelProjection create ability"
- "publishListings checks publish allowance before executing"
- "publishListings returns error when insufficient publishes"
- "publishListings verifies listing ownership (ownerUserId)"
- "publishListings rejects non-ACTIVE listings"
- "publishListings returns summary with published/failed counts"
- "delistFromChannel requires authentication"
- "delistFromChannel requires delete ChannelProjection ability"
- "delistFromChannel verifies projection ownership via sellerId"
- "delistFromChannel does not create CREATE crossJob"
- "updateProjectionOverrides validates with updateProjectionOverridesSchema"
- "updateProjectionOverrides sets hasPendingSync on active projection"
- "getPublishAllowanceAction returns current allowance for seller"

**Total: ~60 new tests across 5 test files**

### 6.2 Test Patterns
Follow existing test patterns in the codebase:
- `vi.mock('@/lib/db')` with `selectChain` / `insertChain` / `updateChain` helpers
- `vi.mock('@/lib/casl')` returning `makeOwnerSession()` or `makeStaffSession()`
- `vi.mock('@/lib/crosslister/connector-registry')` to mock `getConnector()`
- `vi.mock('@/lib/crosslister/channel-registry')` to mock `getChannelMetadata()`
- `vi.mock('@/lib/db/schema')` for table references
- All tests use `describe` / `it` blocks with descriptive names
- No `@ts-ignore` or `as any` in test code

---

## 7. FILE APPROVAL LIST

### New Files (15)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/services/listing-transform.ts` | Transform canonical listing to platform-specific TransformedListing |
| 2 | `src/lib/crosslister/services/publish-meter.ts` | ListerTier publish allowance check (derived from crossJob count) |
| 3 | `src/lib/crosslister/services/policy-validator.ts` | Pre-publish validation against platform requirements |
| 4 | `src/lib/crosslister/services/publish-service.ts` | Full publish pipeline orchestrator (validate -> transform -> flag -> execute) |
| 5 | `src/lib/actions/crosslister-publish.ts` | Server actions: publishListings, delistFromChannel, updateProjectionOverrides, getPublishAllowanceAction |
| 6 | `src/components/crosslister/crosslist-panel.tsx` | "Also list on" panel with platform checkboxes and publish controls |
| 7 | `src/components/crosslister/publish-dialog.tsx` | Batch publish confirmation modal with progress and results summary |
| 8 | `src/components/crosslister/projection-table.tsx` | Channel projections table with status, external URL, delist/override actions |
| 9 | `src/components/crosslister/projection-overrides-dialog.tsx` | Per-channel override editor (title, description, price) |
| 10 | `src/components/crosslister/publish-meter.tsx` | Publish usage progress bar with tier badge |
| 11 | `src/lib/crosslister/services/__tests__/listing-transform.test.ts` | Tests for listing transform service |
| 12 | `src/lib/crosslister/services/__tests__/publish-meter.test.ts` | Tests for publish metering |
| 13 | `src/lib/crosslister/services/__tests__/policy-validator.test.ts` | Tests for policy validator |
| 14 | `src/lib/crosslister/services/__tests__/publish-service.test.ts` | Tests for publish pipeline |
| 15 | `src/lib/actions/__tests__/crosslister-publish.test.ts` | Tests for publish server actions |

### Modified Files (10)

| # | File Path | What Changes |
|---|-----------|-------------|
| 16 | `src/lib/crosslister/connectors/ebay-connector.ts` | Replace createListing/updateListing/delistListing stubs with eBay Inventory API calls |
| 17 | `src/lib/crosslister/connectors/poshmark-connector.ts` | Replace stubs with Poshmark session API calls (with random delay) |
| 18 | `src/lib/crosslister/connectors/mercari-connector.ts` | Replace stubs with Mercari API calls |
| 19 | `src/lib/crosslister/connectors/etsy-connector.ts` | Replace stubs with Etsy Open API v3 calls |
| 20 | `src/lib/crosslister/connectors/depop-connector.ts` | Replace stubs with Depop API calls |
| 21 | `src/lib/crosslister/connectors/fb-marketplace-connector.ts` | Replace stubs with Facebook Graph API calls |
| 22 | `src/lib/crosslister/connectors/grailed-connector.ts` | Replace stubs with Grailed API calls |
| 23 | `src/lib/crosslister/connectors/therealreal-connector.ts` | Replace stubs with TRR session API calls (with random delay) |
| 24 | `src/lib/queries/crosslister.ts` | Add getProjectionsForListing, getSellerProjections, getSellerCrossJobs, getListingForPublish |
| 25 | `src/app/(hub)/my/selling/crosslist/page.tsx` | Add publish meter, projections table section, crosslist button |

**Total: 15 new + 10 modified = 25 files**

---

## 8. PARALLEL STREAMS

```
Stream A: Core Services (listing-transform, publish-meter, policy-validator, publish-service)
    Files: 1-4 + test files 11-14
    Duration: ~45 min
    Dependencies: none (uses existing types/interfaces)

        |
        v

Stream B: Server Actions + Queries        Stream C: Connector Implementations
    Files: 5, 24 + test 15                    Files: 16-23
    Duration: ~30 min                          Duration: ~45 min
    Depends on: Stream A                       Depends on: Stream A
    (B and C can run in parallel)              (B and C can run in parallel)

        |                                          |
        +------------------------------------------+
        |
        v

Stream D: UI Components + Page Update
    Files: 6-10, 25
    Duration: ~30 min
    Depends on: Stream B (needs actions/queries)
```

**Execution order**: A -> (B + C in parallel) -> D

---

## 9. VERIFICATION CHECKLIST

After implementation, run:

```bash
./twicely-lint.sh
```

Paste the FULL raw output. Do not summarize. Expected outcomes:

| Check | Expected |
|-------|----------|
| TypeScript errors | 0 |
| Test count | >= 2866 (baseline 2806 + ~60 new) |
| Banned terms | 0 occurrences |
| Wrong route prefixes | 0 occurrences |
| Files over 300 lines | 0 files |
| `as any` occurrences | 0 |
| `console.log` in production | 0 |

---

## 10. OPEN QUESTIONS FOR OWNER

1. **Feature flag pattern convergence**: The existing codebase uses `platformSetting` keys for crosslister flags (`crosslister.*.crosslistEnabled`). The SCHEMA_ADDENDUM_A2_4 introduces `connector:*` keys in the `featureFlag` table. F3 uses the existing `platformSetting` pattern as primary gate, with a secondary `featureFlag` check that gracefully skips if the flag doesn't exist yet. Is this dual-check approach acceptable, or should we seed the `connector:*` featureFlag rows now?

2. **Listing form integration**: Feature Lock-in Section 46 describes crosslist toggles in the listing creation form. The listing create page is 299 lines. Should F3 add the crosslist panel to the listing form (risk of exceeding 300 lines), or keep it dashboard-only? Recommendation: dashboard-only for F3, listing form integration as a separate sub-step.

3. **Connector API credentials**: eBay credentials exist from F1. The other 7 connectors need platform API keys seeded as `platformSetting` entries or environment variables. Should F3 seed placeholder settings for all connector credentials, or is that expected to be configured at deployment time?

---

**END OF INSTALL PROMPT**

**Vocabulary: StoreTier (storefront), ListerTier (crosslister), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**
