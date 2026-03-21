# Install Prompt: F1 — eBay Import (Free, One-Time)

**Phase & Step:** `[F1]` (includes F1.1, F1.2, F1.3)
**Feature Name:** eBay Import — Free One-Time Import Pipeline
**One-line Summary:** Connect eBay via OAuth, fetch active listings, transform to canonical Twicely format, deduplicate, create ACTIVE listings, and provide real-time bulk import UI.
**Date:** 2026-03-03

**Canonical Sources — READ ALL BEFORE STARTING:**

| Doc | Why |
|-----|-----|
| `TWICELY_V3_LISTER_CANONICAL.md` | Primary spec: import pipeline (section 6), connector framework (section 9), dedupe (section 10), CASL permissions (section 22), Centrifugo events (section 21) |
| `TWICELY_V3_SCHEMA_v2_0_7.md` | Section 12: `crosslister_account`, `channel_projection`, `cross_job`, `import_batch`, `import_record`, `dedupe_fingerprint`, `channel_category_mapping` |
| `TWICELY_V3_PAGE_REGISTRY.md` | Routes #55-58: `/my/selling/crosslist`, `/my/selling/crosslist/connect`, `/my/selling/crosslist/import`, `/my/selling/crosslist/import/issues` |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Section 46: Crosslister UX Integration (sidebar widget, states, admin settings) |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Section 3.4: delegation scopes (only Actors doc scopes for now; section 22.3 of Lister Canonical adds `crosslister:read`, `crosslister:publish`, `crosslister:import`, `crosslister:manage`) |
| `TWICELY_V3_USER_MODEL.md` | Section 12: Crosslister integration, free import flywheel, ownership rules |
| `TWICELY_V3_DECISION_RATIONALE.md` | Decision #16: Imports Go Active Immediately. Decision #17: Crosslister as Supply Engine |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | Section 7.5: Crosslister pricing settings |

---

## 1. PREREQUISITES

### Phases That Must Be Complete
- **B2** (Listing Creation) — DONE. Listings can be created programmatically.
- **E1** (Notification System) — DONE. Notifications can be sent for import events.
- **A4** (CASL Authorization) — DONE. CASL ability builder exists.

### Schema That Already Exists
The following Drizzle schema files already exist in `src/lib/db/schema/crosslister.ts` and are re-exported from `src/lib/db/schema/index.ts`:

| Table | File | Status |
|-------|------|--------|
| `crosslisterAccount` | `crosslister.ts` line 10 | EXISTS — all columns match schema doc section 12.1 |
| `channelProjection` | `crosslister.ts` line 46 | EXISTS — all columns match schema doc section 12.2 |
| `crossJob` | `crosslister.ts` line 82 | EXISTS — all columns match schema doc section 12.3 |
| `importBatch` | `crosslister.ts` line 114 | EXISTS — all columns match schema doc section 12.4 |
| `importRecord` | `crosslister.ts` line 141 | EXISTS — all columns match schema doc section 12.5 |
| `dedupeFingerprint` | `crosslister.ts` line 160 | EXISTS — all columns match schema doc section 12.6 |
| `channelCategoryMapping` | `crosslister.ts` line 176 | EXISTS — all columns match schema doc section 12.7 |
| `channelPolicyRule` | `crosslister.ts` line 191 | EXISTS — all columns match schema doc section 12.8 |
| `automationSetting` | `crosslister.ts` line 206 | EXISTS — all columns match schema doc section 12.9 |

All crosslister enums exist in `src/lib/db/schema/enums.ts`:
- `channelEnum` (line ~173): `TWICELY`, `EBAY`, `POSHMARK`, `MERCARI`, `DEPOP`, `FB_MARKETPLACE`, `ETSY`, `GRAILED`, `THEREALREAL`
- `authMethodEnum` (line ~176): `OAUTH`, `API_KEY`, `SESSION`
- `accountStatusEnum` (line ~177): `ACTIVE`, `PAUSED`, `REVOKED`, `ERROR`, `REAUTHENTICATION_REQUIRED`
- `channelListingStatusEnum` (line ~178): `DRAFT`, `PUBLISHING`, `ACTIVE`, `PAUSED`, `SOLD`, `ENDED`, `DELISTING`, `DELISTED`, `ERROR`, `ORPHANED`
- `publishJobStatusEnum` (line ~181): `PENDING`, `QUEUED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELED`
- `publishJobTypeEnum` (line ~182): `CREATE`, `UPDATE`, `DELIST`, `RELIST`, `SYNC`, `VERIFY`
- `importBatchStatusEnum` (line ~183): `CREATED`, `FETCHING`, `DEDUPLICATING`, `TRANSFORMING`, `IMPORTING`, `COMPLETED`, `FAILED`, `PARTIALLY_COMPLETED`

The `listing` table already has import-source columns (in `src/lib/db/schema/listings.ts`):
- `importedFromChannel: channelEnum('imported_from_channel')` — nullable, set to `'EBAY'` on import
- `importedExternalId: text('imported_external_id')` — nullable, the eBay item ID

### Dependencies (npm packages needed)

| Package | Purpose |
|---------|---------|
| `ebay-api` | Official eBay SDK for Browse/Trading API calls |

Packages already available:
- `@paralleldrive/cuid2` (ID generation)
- `drizzle-orm` / `drizzle-zod` (ORM + schema-derived Zod)
- `zod` (validation)

**Infrastructure NOT needed for F1:** Centrifugo real-time is NOT required for the initial F1 implementation. Real-time import progress via WebSocket is a nice-to-have. For F1, use polling-based progress (the UI polls the `importBatch` record for counts). Centrifugo integration can be added when real-time infra is wired in a later phase.

**BullMQ NOT required for F1:** The import pipeline runs as a long-running server action that processes batches sequentially. BullMQ job queues are for Phase F3+ (outbound publish scheduling). F1 imports are synchronous background processes triggered by the server action.

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

### 2.1 CASL — New Subjects + Rules

**New subjects to add to `src/lib/casl/subjects.ts`:**

```typescript
// Add these to the SUBJECTS array:
'CrosslisterAccount',
'ImportBatch',
'ChannelProjection',
'CrossJob',
```

**CASL rules to add to `src/lib/casl/ability.ts`:**

For **Seller** (in `defineSellerAbilities`):
```typescript
// Crosslister accounts — seller owns via sellerId
can('manage', 'CrosslisterAccount', { sellerId });
// Import batches — seller owns via sellerId
can('create', 'ImportBatch', { sellerId });
can('read', 'ImportBatch', { sellerId });
// Channel projections — seller owns via sellerId
can('read', 'ChannelProjection', { sellerId });
// Cross jobs — seller can read/cancel their own
can('read', 'CrossJob', { sellerId });
can('delete', 'CrossJob', { sellerId });
```

For **Seller Staff** (in `defineStaffAbilities`):
The Lister Canonical section 22.3 defines 4 crosslister-specific delegation scopes. These are NOT in the main Actors Canonical (which only lists 16 scopes). The crosslister scopes must be recognized:

```typescript
if (scopes.includes('crosslister.read')) {
  can('read', 'CrosslisterAccount', { sellerId });
  can('read', 'ImportBatch', { sellerId });
  can('read', 'ChannelProjection', { sellerId });
  can('read', 'CrossJob', { sellerId });
}

if (scopes.includes('crosslister.import')) {
  can('read', 'CrosslisterAccount', { sellerId });
  can('create', 'ImportBatch', { sellerId });
  can('read', 'ImportBatch', { sellerId });
}

if (scopes.includes('crosslister.manage')) {
  can('manage', 'CrosslisterAccount', { sellerId });
  can('create', 'ImportBatch', { sellerId });
  can('read', 'ImportBatch', { sellerId });
  can('read', 'ChannelProjection', { sellerId });
  can('manage', 'ChannelProjection', { sellerId });
  can('read', 'CrossJob', { sellerId });
  can('delete', 'CrossJob', { sellerId });
}
```

For **Platform Admin** (in `definePlatformAdminAbilities`):
```typescript
can('manage', 'CrosslisterAccount');
can('manage', 'ImportBatch');
can('manage', 'ChannelProjection');
can('manage', 'CrossJob');
```

### 2.2 eBay OAuth + Account Connection (F1.1)

**API Route:** `POST /api/crosslister/ebay/auth-url`
- Input (Zod): `{ returnUrl: z.string().url() }` (where to redirect after OAuth)
- Output: `{ url: string }` (eBay OAuth consent screen URL)
- Logic: Build eBay OAuth URL with `scope=https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.account.readonly`
- eBay environment config from `platform_settings`:
  - `crosslister.ebay.clientId` (from environment_secret or .env)
  - `crosslister.ebay.clientSecret` (from environment_secret or .env)
  - `crosslister.ebay.ruName` (eBay redirect URL name, from environment_secret or .env)
  - `crosslister.ebay.sandbox` (boolean, from platform_settings)

**API Route:** `GET /api/crosslister/ebay/callback`
- Input: `code` query parameter from eBay OAuth redirect
- Logic:
  1. Exchange authorization code for access token + refresh token via eBay API
  2. Call eBay's GET `/commerce/identity/v1/user/` to get `externalAccountId` and `externalUsername`
  3. Upsert into `crosslisterAccount` table:
     - `sellerId` = session.userId (from authorize())
     - `channel` = `'EBAY'`
     - `authMethod` = `'OAUTH'`
     - `accessToken` = encrypted access token
     - `refreshToken` = encrypted refresh token
     - `tokenExpiresAt` = current time + expires_in
     - `lastAuthAt` = now
     - `status` = `'ACTIVE'`
     - `capabilities` = `{ canImport: true, canPublish: true, canDelist: true, hasWebhooks: true, canAutoRelist: false, hasStructuredCategories: true, maxImagesPerListing: 24, maxTitleLength: 80, maxDescriptionLength: 500000, supportedImageFormats: ['JPEG', 'PNG'] }`
  4. Redirect to `/my/selling/crosslist` with success toast
- CASL check: `ability.can('manage', 'CrosslisterAccount')`

**API Route:** `POST /api/crosslister/ebay/refresh`
- Called automatically when `tokenExpiresAt` is within 5 minutes of now
- Exchanges refresh token for new access token
- Updates `crosslisterAccount.accessToken`, `crosslisterAccount.tokenExpiresAt`

**Server Action:** `disconnectPlatformAccount`
- Input (Zod): `{ accountId: z.string() }`
- Logic: Set `crosslisterAccount.status = 'REVOKED'`, clear tokens
- CASL check: `ability.can('manage', 'CrosslisterAccount', { sellerId: session.userId })`

**Token Encryption:**
Tokens must be encrypted at rest. Use AES-256-GCM. Create a utility at `src/lib/crosslister/encryption.ts`:
- `encryptToken(plaintext: string): string` — returns `iv:authTag:ciphertext` as base64
- `decryptToken(encrypted: string): string` — reverses
- Encryption key from env var `CROSSLISTER_ENCRYPTION_KEY` (32-byte hex)

### 2.3 Listing Fetch + Transform + Dedupe (F1.2)

**Server Action:** `startEbayImport`
- Input (Zod): `{ accountId: z.string() }`
- CASL check: `ability.can('create', 'ImportBatch', { sellerId: session.userId })`
- Business rules:
  1. Verify `crosslisterAccount.status === 'ACTIVE'` and `channel === 'EBAY'`
  2. Check if first import: `crosslisterAccount.firstImportCompletedAt === null`
  3. If NOT first import AND `sellerProfile.listerTier` is `'NONE'` or `'FREE'`: DENY with message "Re-import requires Crosslister Lite or above" (Lister Canonical section 6.1: "Re-import requires Lister Lite+")
  4. Create `importBatch` record: `sellerId`, `accountId`, `channel: 'EBAY'`, `status: 'CREATED'`, `isFirstImport`
  5. Return `{ batchId: string }`
  6. Begin background processing (see pipeline below)

**Import Pipeline (background processing within the server action):**

The import runs as a series of steps that update the `importBatch` record progressively. Each step is idempotent (can be retried from the step's start).

**Step 1: FETCH (status: 'FETCHING')**
- Call eBay Browse API `GET /buy/browse/v1/item_summary/search` OR Trading API `GetMyeBaySelling` (active items) paginated
- Fetch ALL active listings (not ended, not sold) — 200 items per page
- For each item, create an `importRecord`:
  - `batchId` = this batch
  - `externalId` = eBay item ID
  - `channel` = `'EBAY'`
  - `status` = `'pending'`
  - `rawDataJson` = raw eBay API response for this item
- Update `importBatch.totalItems` after all pages fetched
- Update `importBatch.status` = `'FETCHING'` at start, then...

**Step 2: TRANSFORM (status: 'TRANSFORMING')**
- For each `importRecord` with status `'pending'`:
  - Parse `rawDataJson` and map to Twicely canonical fields:
    - `title` = eBay title (up to 80 chars on eBay, Twicely has no hard limit)
    - `description` = eBay description (strip HTML tags, preserve text)
    - `priceCents` = eBay currentPrice in cents (convert from eBay's `{ value, currency }`)
    - `condition` = map eBay condition ID to Twicely `listingConditionEnum`:
      - eBay 1000 (New) -> `'NEW_WITH_TAGS'`
      - eBay 1500 (New other) -> `'NEW_WITHOUT_TAGS'`
      - eBay 1750 (New with defects) -> `'NEW_WITH_DEFECTS'`
      - eBay 2000 (Certified refurbished) -> `'LIKE_NEW'`
      - eBay 2500 (Seller refurbished) -> `'VERY_GOOD'`
      - eBay 3000 (Used) -> `'GOOD'`
      - eBay 4000 (Very Good) -> `'VERY_GOOD'`
      - eBay 5000 (Good) -> `'GOOD'`
      - eBay 6000 (Acceptable) -> `'ACCEPTABLE'`
      - eBay 7000 (For parts) -> `'ACCEPTABLE'`
    - `brand` = eBay item specifics "Brand" value
    - `categoryId` = look up `channelCategoryMapping` for eBay category -> Twicely category (if no mapping, set `null` — flag for manual assignment)
    - `attributesJson` = eBay item specifics mapped to JSON
    - `quantity` = eBay quantity available
    - `images` = eBay pictureURLs array (to be downloaded to R2 later)
    - `shippingCents` = eBay shipping cost if flat rate, or 0 if free
    - `freeShipping` = true if eBay shipping is free
    - `weightOz` = eBay package weight (if present)
  - Store result in `importRecord.normalizedDataJson`
- Update `importBatch.status` = `'TRANSFORMING'` at start, then...

**Step 3: DEDUPE (status: 'DEDUPLICATING')**
- For each `importRecord` with status `'pending'`:
  - Generate fingerprint:
    - `titleHash` = SHA-256 of lowercase, stopword-removed, brand-normalized title
    - `imageHash` = perceptual hash (pHash) of primary image URL (if available; use a lightweight pHash library or defer to placeholder)
    - `priceRange` = bucket the price: "0-10", "10-20", "20-50", "50-100", "100-200", "200-500", "500-1000", "1000+"
    - `compositeHash` = SHA-256 of `sellerId + titleHash + priceRange`
  - Query `dedupeFingerprint` for this seller where `compositeHash` matches:
    - Score >= 90%: auto-link (set `importRecord.status = 'deduplicated'`, `dedupeMatchListingId`, `dedupeConfidence`)
    - Score 70-89%: flag (set `importRecord.status = 'deduplicated'`, store match info, dedupeConfidence)
    - Score < 70%: no match, proceed to create
  - For F1 (eBay-only, first import), most items will be "no match" (new to Twicely). Dedupe matters more when importing from a second platform.
- Update `importBatch.deduplicatedItems` count

**Step 4: CREATE (status: 'IMPORTING')**
- For each `importRecord` with status `'pending'` (not deduplicated):
  - Create a `listing` record:
    - `ownerUserId` = session.userId
    - `status` = `'ACTIVE'` (Decision #16: imports go ACTIVE immediately)
    - `title`, `description`, `priceCents`, `condition`, `brand`, `categoryId`, `quantity`, `attributesJson`, `freeShipping`, `shippingCents`, `weightOz` from normalized data
    - `importedFromChannel` = `'EBAY'`
    - `importedExternalId` = eBay item ID
    - `slug` = generate slug from title + CUID suffix
    - `activatedAt` = now
  - Create `listingImage` records for each photo URL (download from eBay, upload to R2, store R2 URL)
  - Create `channelProjection` record linking back to eBay:
    - `listingId` = new listing ID
    - `accountId` = the crosslister account ID
    - `channel` = `'EBAY'`
    - `sellerId` = session.userId
    - `externalId` = eBay item ID
    - `externalUrl` = eBay listing URL
    - `status` = `'ACTIVE'`
    - `syncEnabled` = true
  - Create `dedupeFingerprint` record for the new listing
  - Update `importRecord.status` = `'created'`, `importRecord.listingId` = new listing ID
  - Update `importBatch.createdItems` count
  - Update `importBatch.processedItems` count
- For deduplicated items that were auto-linked:
  - Create `channelProjection` linking existing listing to eBay
  - Update `importBatch.processedItems` count
- For items that failed validation (missing required fields):
  - Set `importRecord.status` = `'failed'`, `importRecord.errorMessage` = specific error
  - Update `importBatch.failedItems` count
  - Update `importBatch.processedItems` count

**Step 5: COMPLETE**
- Set `importBatch.status` = `'COMPLETED'` (or `'PARTIALLY_COMPLETED'` if any failed)
- Set `importBatch.completedAt` = now
- Set `crosslisterAccount.firstImportCompletedAt` = now (if first import)
- If seller `isSeller === false`: set `user.isSeller = true`, create `sellerProfile` (Lister Canonical: import activates seller status)
- Send notification: "Your eBay import is complete! {createdItems} listings imported, {deduplicatedItems} duplicates found, {failedItems} need attention."

**Image Import:**
For F1, download eBay images and re-upload to Cloudflare R2. This can be done inline during Step 4 or deferred to a post-import batch. For simplicity in F1, download inline but with a timeout per image (5 seconds). Failed image downloads should NOT fail the listing — create the listing with a placeholder and queue image for retry.

### 2.4 Bulk Import UI (F1.3)

**Route: `/my/selling/crosslist`** (Page Registry #55)
- Layout: `dashboard`
- Gate: `SELLER` or `DELEGATE(crosslister.read)`
- Build Phase: F1
- Title: "Crosslister | Twicely"

**Page States (from Page Registry):**
1. **LOADING**: Connection cards skeleton
2. **EMPTY (no connections)**: "Connect your first platform" + platform picker showing eBay card (other platforms grayed out with "Coming soon")
3. **POPULATED**: Connected eBay card with status badge, listing count, last sync time. "Import" button. If import batch exists, show progress/results.
4. **ERROR (auth expired)**: eBay card shows "Reauthentication required" + "Reconnect" button

**Route: `/my/selling/crosslist/connect`** (Page Registry #56)
- Layout: `dashboard`
- Gate: `SELLER` or `DELEGATE(crosslister.manage)`
- Title: "Connect Platform | Twicely"

**UI**: Platform picker grid. For F1, only eBay is enabled. Others show "Coming soon" with opacity 35%.
- eBay card: logo + "Connect eBay" button -> initiates OAuth flow via `POST /api/crosslister/ebay/auth-url`

**Route: `/my/selling/crosslist/import`** (Page Registry #57)
- Layout: `dashboard`
- Gate: `SELLER` or `DELEGATE(crosslister.import)`
- Title: "Import Listings | Twicely"

**UI**:
- If no active import batch: "Start Import" button with description "Import your eBay listings to Twicely. Free, one-time per platform. Listings go live immediately."
- If import in progress: Progress display showing:
  - Status label: "Fetching from eBay..." / "Transforming..." / "Checking for duplicates..." / "Creating listings..."
  - Progress bar: `processedItems / totalItems`
  - Counters: "Created: X | Duplicates: Y | Failed: Z"
  - Poll `importBatch` every 3 seconds for updated counts
- If import complete: Summary card with final counts + "View Issues" link if `failedItems > 0` + "View Your Listings" link

**Route: `/my/selling/crosslist/import/issues`** (Page Registry #58)
- Layout: `dashboard`
- Gate: `SELLER` or `DELEGATE(crosslister.import)`
- Title: "Import Issues | Twicely"

**UI**: Table of `importRecord` rows where `status = 'failed'` for the most recent batch:
- Columns: eBay Item ID, Title (from rawData), Error Message, Action
- Error messages should be human-readable: "Missing title", "Price not available", "Category could not be mapped"
- Action column: "Fix" link (navigates to listing edit form pre-filled with available data) OR "Skip" button (marks as `'skipped'`)

### 2.5 Query Functions

**File: `src/lib/queries/crosslister.ts`**

```typescript
// Get all connected accounts for a seller
getConnectedAccounts(sellerId: string): Promise<CrosslisterAccount[]>

// Get a specific account by ID (with ownership check)
getAccountById(accountId: string, sellerId: string): Promise<CrosslisterAccount | null>

// Get the most recent import batch for an account
getLatestImportBatch(accountId: string, sellerId: string): Promise<ImportBatch | null>

// Get import batch by ID
getImportBatchById(batchId: string, sellerId: string): Promise<ImportBatch | null>

// Get failed import records for a batch
getFailedImportRecords(batchId: string, sellerId: string): Promise<ImportRecord[]>

// Get import batch with counts (for progress display)
getImportProgress(batchId: string, sellerId: string): Promise<{
  status: string;
  totalItems: number;
  processedItems: number;
  createdItems: number;
  deduplicatedItems: number;
  failedItems: number;
  skippedItems: number;
}>

// Check if first import has been completed for a channel
hasCompletedFirstImport(sellerId: string, channel: 'EBAY'): Promise<boolean>
```

### 2.6 Server Actions

**File: `src/lib/actions/crosslister.ts`**

```typescript
// Connect platform (redirects to OAuth)
connectEbayAccount(): Promise<{ url: string }>

// Disconnect platform
disconnectPlatformAccount(input: { accountId: string }): Promise<void>

// Start eBay import (validates eligibility, creates batch, begins processing)
startEbayImport(input: { accountId: string }): Promise<{ batchId: string }>

// Skip a failed import record
skipImportRecord(input: { recordId: string }): Promise<void>
```

### 2.7 eBay Connector

**File: `src/lib/crosslister/connectors/ebay.ts`**

Implements the eBay-specific logic for F1 (import only, no outbound publish yet):

```typescript
interface EbayConnector {
  // Build OAuth URL
  getAuthUrl(returnUrl: string): string;

  // Exchange auth code for tokens
  exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;

  // Refresh access token
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;

  // Get user identity
  getUserIdentity(accessToken: string): Promise<{ userId: string; username: string }>;

  // Fetch active listings (paginated)
  fetchActiveListings(accessToken: string, cursor?: string): Promise<{
    items: EbayListing[];
    nextCursor: string | null;
    totalCount: number;
  }>;

  // Fetch single listing detail
  fetchListing(accessToken: string, itemId: string): Promise<EbayListing>;
}
```

**eBay API endpoints used:**
- Auth: `https://auth.ebay.com/oauth2/authorize` (production) / `https://auth.sandbox.ebay.com/oauth2/authorize` (sandbox)
- Token exchange: `POST https://api.ebay.com/identity/v1/oauth2/token`
- User identity: `GET https://api.ebay.com/commerce/identity/v1/user/`
- Active listings: `GET https://api.ebay.com/sell/inventory/v1/inventory_item` (Inventory API) OR `GetMyeBaySelling` (Trading API)

### 2.8 Transform Engine

**File: `src/lib/crosslister/transform/ebay-transform.ts`**

Maps eBay listing data to Twicely canonical format:

```typescript
function transformEbayListing(raw: EbayListing): NormalizedListing {
  return {
    title: raw.title,
    description: stripHtml(raw.description),
    priceCents: Math.round(parseFloat(raw.price.value) * 100),
    condition: mapEbayCondition(raw.conditionId),
    brand: extractBrand(raw.itemSpecifics),
    categoryId: null, // Resolved separately via channelCategoryMapping
    ebayCategoryId: raw.categoryId,
    quantity: raw.quantityAvailable,
    imageUrls: raw.imageUrls,
    attributesJson: mapItemSpecifics(raw.itemSpecifics),
    freeShipping: raw.shippingOptions?.some(o => o.shippingCost?.value === '0.00') ?? false,
    shippingCents: parseShippingCost(raw.shippingOptions),
    weightOz: parseWeight(raw.packageWeightAndSize),
  };
}
```

### 2.9 Dedupe Engine

**File: `src/lib/crosslister/dedupe/fingerprint.ts`**

```typescript
// Generate a fingerprint for a listing
function generateFingerprint(input: {
  sellerId: string;
  title: string;
  priceCents: number;
  primaryImageUrl?: string;
}): DedupeFingerprint

// Find matching fingerprints for a seller
function findMatches(
  sellerId: string,
  fingerprint: DedupeFingerprint
): Promise<{ listingId: string; confidence: number }[]>

// Normalized title hash (lowercase, remove stopwords, normalize brand names)
function hashTitle(title: string): string

// Price range bucket
function getPriceRange(priceCents: number): string
```

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Patterns
- Do NOT hardcode eBay API credentials in code. They must come from environment variables / platform_settings.
- Do NOT create listings in `'DRAFT'` status. **Decision #16**: Imports ALWAYS go ACTIVE immediately.
- Do NOT charge insertion fees on imported listings. Imports are ALWAYS free.
- Do NOT gate the first import behind any ListerTier. First import is free for ALL sellers, even `listerTier: 'NONE'`.
- Do NOT require BUSINESS status to use the crosslister. Crosslister is available to ALL sellers (PERSONAL or BUSINESS).
- Do NOT require a Store subscription to use the crosslister. Store and Crosslister are independent axes.
- Do NOT use `storeId`, `sellerProfileId`, or `staffId` as ownership key. Always `sellerId = userId`.
- Do NOT spread request body into DB inserts/updates. Explicit field mapping only.
- Do NOT use `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Do NOT put fee calculations in frontend code.
- Do NOT use Redis — use Valkey if caching is needed.
- Do NOT use Prisma — use Drizzle.
- Do NOT use tRPC — use Next.js API routes + server actions.
- Do NOT create tables not in the schema doc.
- Do NOT create pages not in the Page Registry.

### Gotchas from Canonical Docs
1. **`crosslisterAccount.sellerId` references `user.id`** (not sellerProfile.id). This is correct per the ownership model.
2. **`importBatch.isFirstImport`** must be calculated by checking `crosslisterAccount.firstImportCompletedAt === null` at batch creation time.
3. **Re-import gating**: Only the FIRST import per marketplace is free. Subsequent imports (re-imports for new items) require `listerTier >= 'LITE'`. Check is: if `firstImportCompletedAt` is NOT null, require Lite+.
4. **One account per channel per seller**: The `crosslisterAccount` table has a unique constraint on `(sellerId, channel)`. Upsert on reconnect, don't create duplicates.
5. **Token encryption**: Access tokens and refresh tokens MUST be encrypted at rest per Lister Canonical section 5.1 and schema doc comments.
6. **Import activates seller**: If a non-seller imports, `user.isSeller` should become `true` and a `sellerProfile` should be created. This matches User Model section 11 lifecycle step 3.
7. **`importRecord.status`** is a plain text column (not enum): values are `'pending'`, `'created'`, `'deduplicated'`, `'failed'`, `'skipped'`.
8. **Slug generation**: Must be unique. Use title + CUID suffix (e.g., `vintage-levis-501-abc123def`).
9. **eBay sandbox vs production**: Use platform_settings boolean to toggle. All eBay API URLs should support both environments.

---

## 4. ACCEPTANCE CRITERIA

### Positive Cases
1. A seller with no ListerTier can connect their eBay account via OAuth and import listings for free.
2. Imported listings appear with `status: 'ACTIVE'` on Twicely immediately.
3. Each imported listing has `importedFromChannel: 'EBAY'` and `importedExternalId` set.
4. A `channelProjection` record links each imported listing back to the eBay source.
5. A `dedupeFingerprint` record is created for each imported listing.
6. The import progress page shows real-time counts (total, created, deduplicated, failed) via polling.
7. Failed import records appear on the Issues page with human-readable error messages.
8. The crosslister dashboard shows the connected eBay account with status and listing count.
9. First import sets `crosslisterAccount.firstImportCompletedAt`.
10. A PERSONAL seller can import (no BUSINESS gate, no Store gate).
11. Seller staff with `crosslister.import` scope can trigger imports on behalf of the seller.

### Negative Cases
12. A seller CANNOT import a second time from eBay without ListerTier LITE+ (re-import gate).
13. Imported listings are NOT charged insertion fees (verify no insertion fee ledger entries created).
14. A seller CANNOT connect two eBay accounts (unique constraint on sellerId + channel).
15. A disconnected account (`status: 'REVOKED'`) CANNOT be used to import.
16. A buyer (non-seller) who imports becomes a seller automatically (`isSeller: true`).
17. Unauthenticated users CANNOT access `/my/selling/crosslist` or any crosslister API routes.
18. Seller staff WITHOUT crosslister scopes CANNOT access crosslister pages.

### Data Integrity
19. All price values are stored as integer cents (never floats, never dollars).
20. All access tokens are encrypted at rest.
21. All IDs use CUID2.
22. Ownership uses `sellerId = userId` throughout.
23. No banned terms appear in any UI or code (no "wallet", "withdraw", "FVF", "SellerTier", etc.).

### Vocabulary
24. Routes use `/my/selling/crosslist` prefix (not `/dashboard`, not `/admin`).
25. UI refers to "Crosslister" or "Import", never "Crosslister" in user-facing copy.
26. No banned route prefixes appear (`/l/`, `/listing/`, `/store/`, `/shop/`, `/dashboard`, `/admin`).

---

## 5. TEST REQUIREMENTS

### Unit Tests

**`src/lib/actions/__tests__/crosslister.test.ts`** (~20 tests):
- `startEbayImport` — creates import batch for valid account
- `startEbayImport` — rejects if account status is not ACTIVE
- `startEbayImport` — rejects re-import without Lite+ tier
- `startEbayImport` — allows first import with listerTier NONE
- `startEbayImport` — allows first import with listerTier FREE
- `startEbayImport` — rejects unauthenticated user
- `disconnectPlatformAccount` — sets status to REVOKED
- `disconnectPlatformAccount` — rejects if not account owner
- `skipImportRecord` — marks record as skipped
- `skipImportRecord` — rejects if not batch owner

**`src/lib/queries/__tests__/crosslister.test.ts`** (~10 tests):
- `getConnectedAccounts` — returns accounts for seller
- `getConnectedAccounts` — returns empty array for seller with no connections
- `getLatestImportBatch` — returns most recent batch
- `getImportProgress` — returns correct counts
- `hasCompletedFirstImport` — true after first import
- `hasCompletedFirstImport` — false before any import
- `getFailedImportRecords` — returns only failed records

**`src/lib/crosslister/__tests__/ebay-transform.test.ts`** (~15 tests):
- Transforms eBay price to integer cents correctly
- Maps all eBay condition IDs to Twicely conditions
- Strips HTML from eBay descriptions
- Extracts brand from item specifics
- Handles missing optional fields gracefully
- Maps shipping cost correctly
- Sets freeShipping when eBay shipping is $0
- Handles eBay items with no images (still creates record, flags for attention)
- Handles eBay items with 24 images (max)

**`src/lib/crosslister/__tests__/fingerprint.test.ts`** (~8 tests):
- Generates consistent hash for same input
- Different titles produce different hashes
- Price range bucketing is correct at boundaries
- Composite hash includes sellerId (no cross-seller matching)
- Title normalization removes stopwords
- Title normalization is case-insensitive

**`src/lib/crosslister/__tests__/encryption.test.ts`** (~4 tests):
- Encrypts and decrypts correctly
- Different plaintexts produce different ciphertexts
- Decryption with wrong key fails
- Handles empty string

### Integration Tests
- OAuth flow end-to-end (mock eBay API): connect -> verify account created -> disconnect -> verify status REVOKED
- Import pipeline end-to-end (mock eBay API): start import -> verify batch created -> verify listings created with ACTIVE status -> verify channel projections created -> verify fingerprints created

### Edge Cases
- eBay returns 0 active listings (import completes immediately with 0 items)
- eBay returns a listing with price in non-USD currency (skip or convert)
- eBay token expires mid-import (auto-refresh and retry)
- Duplicate eBay item ID in import (idempotent — skip if already imported)
- Very long eBay description (truncate per Twicely limits if needed, or store full)
- eBay listing with variations (for F1: import as single listing with variations noted in attributes, NOT as multiple listings)

---

## 6. FILE APPROVAL LIST

### Stream A: CASL + Types (must complete first)

| # | File Path | Description |
|---|-----------|-------------|
| A1 | `src/lib/casl/subjects.ts` | MODIFY: Add `CrosslisterAccount`, `ImportBatch`, `ChannelProjection`, `CrossJob` subjects |
| A2 | `src/lib/casl/ability.ts` | MODIFY: Add seller crosslister rules, staff crosslister scope rules, admin crosslister rules |
| A3 | `src/lib/crosslister/types.ts` | CREATE: Shared TypeScript types for crosslister (EbayListing, NormalizedListing, ConnectorCapabilities, etc.) |

### Stream B: Encryption + eBay Connector (depends on A3)

| # | File Path | Description |
|---|-----------|-------------|
| B1 | `src/lib/crosslister/encryption.ts` | CREATE: AES-256-GCM encrypt/decrypt for tokens |
| B2 | `src/lib/crosslister/connectors/ebay.ts` | CREATE: eBay OAuth, token exchange, listing fetch via eBay API |
| B3 | `src/lib/crosslister/connectors/ebay-config.ts` | CREATE: eBay API URLs, scopes, env-based config |
| B4 | `src/lib/crosslister/__tests__/encryption.test.ts` | CREATE: Encryption unit tests |

### Stream C: Transform + Dedupe (depends on A3)

| # | File Path | Description |
|---|-----------|-------------|
| C1 | `src/lib/crosslister/transform/ebay-transform.ts` | CREATE: eBay -> Twicely field mapping, condition mapping, HTML stripping |
| C2 | `src/lib/crosslister/dedupe/fingerprint.ts` | CREATE: Fingerprint generation, title hashing, price bucketing, match scoring |
| C3 | `src/lib/crosslister/__tests__/ebay-transform.test.ts` | CREATE: Transform unit tests |
| C4 | `src/lib/crosslister/__tests__/fingerprint.test.ts` | CREATE: Fingerprint unit tests |

### Stream D: Queries + Actions (depends on A, B, C)

| # | File Path | Description |
|---|-----------|-------------|
| D1 | `src/lib/queries/crosslister.ts` | CREATE: All crosslister query functions |
| D2 | `src/lib/actions/crosslister.ts` | CREATE: Server actions (startEbayImport, disconnectPlatformAccount, skipImportRecord) |
| D3 | `src/lib/crosslister/import-pipeline.ts` | CREATE: Import pipeline orchestrator (fetch, transform, dedupe, create steps) |
| D4 | `src/lib/crosslister/slug-generator.ts` | CREATE: Listing slug generation from title + CUID suffix |
| D5 | `src/lib/queries/__tests__/crosslister.test.ts` | CREATE: Query unit tests |
| D6 | `src/lib/actions/__tests__/crosslister.test.ts` | CREATE: Action unit tests |

### Stream E: API Routes (depends on B)

| # | File Path | Description |
|---|-----------|-------------|
| E1 | `src/app/api/crosslister/ebay/auth-url/route.ts` | CREATE: POST - generate eBay OAuth URL |
| E2 | `src/app/api/crosslister/ebay/callback/route.ts` | CREATE: GET - handle eBay OAuth callback, upsert account |
| E3 | `src/app/api/crosslister/ebay/refresh/route.ts` | CREATE: POST - refresh eBay access token |

### Stream F: UI Pages (depends on D)

| # | File Path | Description |
|---|-----------|-------------|
| F1 | `src/app/(marketplace)/my/selling/crosslist/page.tsx` | CREATE: Crosslister dashboard (connected accounts, status) |
| F2 | `src/app/(marketplace)/my/selling/crosslist/connect/page.tsx` | CREATE: Platform picker (eBay enabled, others "Coming soon") |
| F3 | `src/app/(marketplace)/my/selling/crosslist/import/page.tsx` | CREATE: Import progress page (start button, progress bar, completion summary) |
| F4 | `src/app/(marketplace)/my/selling/crosslist/import/issues/page.tsx` | CREATE: Failed import records table with fix/skip actions |
| F5 | `src/components/crosslister/connected-account-card.tsx` | CREATE: Platform connection card component (status badge, listing count, actions) |
| F6 | `src/components/crosslister/import-progress.tsx` | CREATE: Import progress display (progress bar, counters, status label) |
| F7 | `src/components/crosslister/platform-picker.tsx` | CREATE: Platform selection grid (eBay active, others coming soon) |
| F8 | `src/components/crosslister/import-issues-table.tsx` | CREATE: Failed records table component |

### Stream G: Validations

| # | File Path | Description |
|---|-----------|-------------|
| G1 | `src/lib/validations/crosslister.ts` | CREATE: Zod schemas for crosslister inputs |

**Total files: 28** (3 modified, 25 created)

---

## 7. PARALLEL STREAMS

This feature has 28 files across 7 sub-tasks. Decompose into parallel streams.

### Dependency Graph

```
Stream A (CASL + Types)
    │
    ├──── Stream B (Encryption + eBay Connector)
    │         │
    │         └──── Stream E (API Routes)
    │
    ├──── Stream C (Transform + Dedupe)
    │
    └──── Stream G (Validations)
              │
              └──── Stream D (Queries + Actions + Pipeline)
                        │
                        └──── Stream F (UI Pages + Components)
```

### Stream A: CASL + Types (3 files, ~150 lines)
**Must complete first. All other streams depend on this.**

**Task A1: Update CASL subjects**
- File: `src/lib/casl/subjects.ts`
- Add `'CrosslisterAccount'`, `'ImportBatch'`, `'ChannelProjection'`, `'CrossJob'` to the `SUBJECTS` array

**Task A2: Update CASL ability rules**
- File: `src/lib/casl/ability.ts`
- In `defineSellerAbilities`: add crosslister subject rules (manage CrosslisterAccount, create/read ImportBatch, read ChannelProjection, read/delete CrossJob) all scoped to `{ sellerId }`
- In `defineStaffAbilities`: add crosslister delegation scope handling for `crosslister.read`, `crosslister.import`, `crosslister.manage`
- In platform admin abilities (separate file `platform-abilities.ts`): add `manage` for all crosslister subjects

**Task A3: Create shared types**
- File: `src/lib/crosslister/types.ts`
- Types needed (inline the full definitions here so the installer has them):

```typescript
export interface EbayListing {
  itemId: string;
  title: string;
  description: string;
  price: { value: string; currency: string };
  conditionId: string;
  conditionDescription?: string;
  categoryId: string;
  categoryName?: string;
  imageUrls: string[];
  itemSpecifics: Array<{ name: string; value: string }>;
  quantityAvailable: number;
  shippingOptions?: Array<{
    shippingServiceCode: string;
    shippingCost?: { value: string; currency: string };
    freeShipping: boolean;
  }>;
  packageWeightAndSize?: {
    weight?: { value: number; unit: string };
    dimensions?: { length: number; width: number; height: number; unit: string };
  };
  listingUrl: string;
}

export interface NormalizedListing {
  title: string;
  description: string;
  priceCents: number;
  condition: string | null;
  brand: string | null;
  categoryId: string | null;
  ebayCategoryId: string;
  quantity: number;
  imageUrls: string[];
  attributesJson: Record<string, string>;
  freeShipping: boolean;
  shippingCents: number;
  weightOz: number | null;
}

export interface DedupeMatch {
  listingId: string;
  confidence: number;
}

export interface ImportProgressPayload {
  batchId: string;
  channel: string;
  totalItems: number;
  processedItems: number;
  createdItems: number;
  deduplicatedItems: number;
  failedItems: number;
  skippedItems: number;
  status: string;
}

export interface ConnectorCapabilities {
  canImport: boolean;
  canPublish: boolean;
  canUpdate: boolean;
  canDelist: boolean;
  hasWebhooks: boolean;
  hasStructuredCategories: boolean;
  canAutoRelist: boolean;
  canMakeOffers: boolean;
  canShare: boolean;
  maxImagesPerListing: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  supportedImageFormats: string[];
}
```

**Stream A output:** CASL subjects updated, ability rules wired, shared types file created.

---

### Stream B: Encryption + eBay Connector (4 files, ~250 lines)
**Depends on:** Stream A (types)

**Task B1: Token encryption utility**
- File: `src/lib/crosslister/encryption.ts`
- AES-256-GCM encrypt/decrypt
- Key from `process.env.CROSSLISTER_ENCRYPTION_KEY` (must be 64-char hex = 32 bytes)
- Format: `iv:authTag:ciphertext` (all base64)

**Task B2: eBay config**
- File: `src/lib/crosslister/connectors/ebay-config.ts`
- Export constants/functions for eBay API URLs based on sandbox toggle
- Read `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME` from env
- Export `getEbayAuthUrl()`, `getEbayTokenUrl()`, `getEbayApiBaseUrl()`

**Task B3: eBay connector**
- File: `src/lib/crosslister/connectors/ebay.ts`
- `getOAuthUrl(returnUrl: string): string`
- `exchangeAuthCode(code: string): Promise<{ accessToken, refreshToken, expiresIn }>`
- `refreshAccessToken(refreshToken: string): Promise<{ accessToken, expiresIn }>`
- `getUserIdentity(accessToken: string): Promise<{ userId, username }>`
- `fetchActiveListings(accessToken: string, offset: number, limit: number): Promise<{ items: EbayListing[], total: number }>`
- Use `fetch()` directly (not the `ebay-api` npm package — simpler, fewer dependencies)
- All API calls include proper error handling with typed error responses

**Task B4: Encryption tests**
- File: `src/lib/crosslister/__tests__/encryption.test.ts`
- 4 tests as described in section 5

**Stream B output:** Token encryption works, eBay connector can authenticate and fetch listings.

---

### Stream C: Transform + Dedupe (4 files, ~250 lines)
**Depends on:** Stream A (types)

**Task C1: eBay transform**
- File: `src/lib/crosslister/transform/ebay-transform.ts`
- `transformEbayListing(raw: EbayListing): NormalizedListing`
- `mapEbayCondition(conditionId: string): string | null` — mapping table as documented in section 2.3
- `stripHtml(html: string): string` — basic HTML tag removal
- `extractBrand(itemSpecifics: Array<{ name: string; value: string }>): string | null`
- `mapItemSpecifics(specs: Array<{ name: string; value: string }>): Record<string, string>`
- `parseShippingCost(options?: EbayListing['shippingOptions']): number` — returns cents
- `parseWeight(pkg?: EbayListing['packageWeightAndSize']): number | null` — returns oz

**Task C2: Dedupe fingerprint engine**
- File: `src/lib/crosslister/dedupe/fingerprint.ts`
- `hashTitle(title: string): string` — SHA-256 of normalized title
- `getPriceRange(priceCents: number): string` — bucketing per Lister Canonical section 10.2
- `generateCompositeHash(sellerId: string, titleHash: string, priceRange: string): string`
- `generateFingerprint(input: { sellerId, title, priceCents, primaryImageUrl? }): { titleHash, imageHash, priceRange, compositeHash }`
- `findMatches(db: DrizzleDb, sellerId: string, compositeHash: string): Promise<DedupeMatch[]>`
- For F1, `imageHash` is deferred (placeholder null) — full pHash implementation requires image processing library. Title + price matching is sufficient for first import.

**Task C3 + C4: Tests for transform and fingerprint**
- As described in section 5

**Stream C output:** Transform maps eBay data to Twicely canonical. Fingerprint engine generates composite hashes and finds matches.

---

### Stream D: Queries + Actions + Pipeline (6 files, ~500 lines)
**Depends on:** Streams A, B, C, G

**Task D1: Query functions**
- File: `src/lib/queries/crosslister.ts`
- All functions listed in section 2.5
- All queries scoped by `sellerId` (never return data for other sellers)
- Use `eq()`, `and()`, `desc()` from Drizzle

**Task D2: Validation schemas**
— Handled by Stream G, but listed here for dependency clarity

**Task D3: Import pipeline orchestrator**
- File: `src/lib/crosslister/import-pipeline.ts`
- `runImportPipeline(params: { batchId, accountId, sellerId, accessToken }): Promise<void>`
- Orchestrates the 5 steps (fetch, transform, dedupe, create, complete)
- Each step updates `importBatch.status` and counts
- Handles errors: if a step fails, marks batch as `'FAILED'` with `errorSummaryJson`
- Individual item failures do NOT fail the batch (mark as `'failed'` in importRecord, continue)
- Processes items in batches of 50 to avoid memory pressure

**Task D4: Slug generator**
- File: `src/lib/crosslister/slug-generator.ts`
- `generateListingSlug(title: string): string`
- Slugify title (lowercase, replace spaces with hyphens, remove special chars) + append 8-char CUID suffix
- Ensure uniqueness by checking DB (retry with new suffix if collision)

**Task D5: Server actions**
- File: `src/lib/actions/crosslister.ts`
- `'use server'` directive
- Zod `.strict()` on all input schemas
- `authorize()` call for CASL check on every action
- Explicit field mapping (never spread)
- `revalidatePath('/my/selling/crosslist')` after mutations

**Task D6: Tests for queries and actions**
- As described in section 5
- Use existing test patterns: `vi.mock` for db/casl/queries, `selectChain`/`insertChain` helpers, `makeOwnerSession`

**Stream D output:** Full import pipeline works end-to-end. Server actions are authorized and validated.

---

### Stream E: API Routes (3 files, ~200 lines)
**Depends on:** Stream B (eBay connector)

**Task E1: Auth URL route**
- File: `src/app/api/crosslister/ebay/auth-url/route.ts`
- `POST` handler
- Authorize with CASL (`manage CrosslisterAccount`)
- Build eBay OAuth URL using connector
- Return `{ url }`

**Task E2: OAuth callback route**
- File: `src/app/api/crosslister/ebay/callback/route.ts`
- `GET` handler (eBay redirects here after user consents)
- Extract `code` from query params
- Exchange for tokens via connector
- Get user identity
- Upsert `crosslisterAccount` with encrypted tokens
- Redirect to `/my/selling/crosslist` with success parameter

**Task E3: Token refresh route**
- File: `src/app/api/crosslister/ebay/refresh/route.ts`
- `POST` handler (called by import pipeline when token near expiry)
- Authorize with CASL
- Refresh token via connector
- Update encrypted tokens in DB

**Stream E output:** Full OAuth flow works — seller can connect eBay account.

---

### Stream F: UI Pages + Components (8 files, ~600 lines)
**Depends on:** Stream D (queries + actions)

**Task F1: Crosslister dashboard page**
- File: `src/app/(marketplace)/my/selling/crosslist/page.tsx`
- SSR page with CASL gate
- Fetches connected accounts via query
- Shows `ConnectedAccountCard` for each account
- Empty state: "Connect your first platform" CTA
- Links to `/my/selling/crosslist/connect` and `/my/selling/crosslist/import`

**Task F2: Connect page**
- File: `src/app/(marketplace)/my/selling/crosslist/connect/page.tsx`
- Shows platform picker grid
- eBay card is active with "Connect" button
- Other platforms (Poshmark, Mercari, Depop, Etsy) show as "Coming soon" (grayed, 35% opacity)
- "Connect eBay" triggers OAuth flow

**Task F3: Import page**
- File: `src/app/(marketplace)/my/selling/crosslist/import/page.tsx`
- If no active batch: "Start Import" button
- If batch in progress: shows `ImportProgress` component with polling (3-second interval `useEffect` + `fetch`)
- If batch complete: shows summary card
- "Start Import" calls `startEbayImport` server action

**Task F4: Import issues page**
- File: `src/app/(marketplace)/my/selling/crosslist/import/issues/page.tsx`
- Table of failed `importRecord` rows
- "Skip" button per row calls `skipImportRecord` server action
- Empty state: "No issues found. All listings imported successfully."

**Tasks F5-F8: Components**
- Reusable UI components as listed in the file approval list
- Use shadcn/ui components (Card, Button, Badge, Progress, Table)
- All components under 300 lines

**Stream F output:** Complete UI for crosslister flow — connect, import, view progress, fix issues.

---

### Stream G: Validations (1 file, ~50 lines)
**Depends on:** Stream A (types)

**Task G1: Zod schemas**
- File: `src/lib/validations/crosslister.ts`
- `connectEbaySchema = z.object({ returnUrl: z.string().url() }).strict()`
- `startImportSchema = z.object({ accountId: z.string().min(1) }).strict()`
- `disconnectAccountSchema = z.object({ accountId: z.string().min(1) }).strict()`
- `skipImportRecordSchema = z.object({ recordId: z.string().min(1) }).strict()`

**Stream G output:** All input validation schemas ready.

---

### Execution Order

1. **Start immediately:** Stream A (CASL + Types) + Stream G (Validations)
2. **After A completes:** Start Stream B (Connector) + Stream C (Transform + Dedupe) in parallel
3. **After A, B, C, G complete:** Start Stream D (Queries + Actions + Pipeline) + Stream E (API Routes)
4. **After D completes:** Start Stream F (UI Pages)

### Merge Verification

After all streams complete, verify:
- [ ] `pnpm typecheck` passes with 0 errors
- [ ] `pnpm test` passes with count >= BASELINE_TESTS
- [ ] All 4 new CASL subjects are in the subjects array
- [ ] Seller abilities include crosslister rules
- [ ] Staff delegation includes crosslister scopes
- [ ] eBay OAuth callback correctly upserts account with encrypted tokens
- [ ] Import pipeline creates listings with `status: 'ACTIVE'`
- [ ] Import pipeline creates channel projections linking to eBay
- [ ] Import pipeline creates dedupe fingerprints
- [ ] Import pipeline sets `firstImportCompletedAt` on completion
- [ ] Re-import check works (blocks if not first import and tier < LITE)
- [ ] All routes use correct prefixes (`/my/selling/crosslist/*`)
- [ ] No banned terms in any file
- [ ] No files over 300 lines

---

## 8. VERIFICATION CHECKLIST

After implementation, run these commands:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. Banned terms check
./twicely-lint.sh

# 4. File sizes
find src/lib/crosslister src/lib/actions/crosslister.ts src/lib/queries/crosslister.ts src/app/api/crosslister src/app/\(marketplace\)/my/selling/crosslist src/components/crosslister -name '*.ts' -o -name '*.tsx' 2>/dev/null | xargs wc -l | sort -rn | head -20

# 5. Route prefix check
grep -rn '/dashboard\|/admin\|/listing/\|/store/\|/shop/' src/app/\(marketplace\)/my/selling/crosslist/ src/components/crosslister/ 2>/dev/null

# 6. Verify no hardcoded eBay credentials
grep -rn 'EBAY_CLIENT\|ebay_client\|v1-prod\|a]a\[' src/lib/crosslister/ src/app/api/crosslister/ 2>/dev/null
```

**Expected outcomes:**
1. TypeScript: 0 errors
2. Tests: >= BASELINE_TESTS + ~57 new tests
3. Banned terms: 0 occurrences
4. All files under 300 lines
5. No wrong route prefixes
6. No hardcoded credentials

---

## 9. SPEC GAPS AND OWNER DECISIONS NEEDED

The following items are **not fully specified** in the canonical docs. The installer should implement the recommended approach unless the owner directs otherwise.

### Gap 1: eBay API Choice
The Lister Canonical mentions both "Browse API" and "Trading API" for fetching listings. The Browse API is newer but read-only and buyer-focused. The **Sell APIs** (Inventory API: `GET /sell/inventory/v1/inventory_item`) are designed for fetching a seller's own listings. **Recommendation:** Use eBay's Inventory API (part of Sell APIs) which requires `sell.inventory.readonly` OAuth scope. Fall back to Trading API `GetMyeBaySelling` if Inventory API is insufficient.

### Gap 2: Image Download Strategy
The canonical docs say images are stored in Cloudflare R2 but don't specify whether import should download images synchronously or queue them. **Recommendation:** For F1, attempt synchronous download during import with a 5-second timeout per image. Failed downloads create the listing without images and flag the import record for manual attention.

### Gap 3: Centrifugo Real-Time Progress
Lister Canonical section 6.3 specifies real-time import progress via Centrifugo WebSocket. Centrifugo infrastructure may not be deployed yet. **Recommendation:** For F1, use polling (client-side `setInterval` every 3 seconds fetching import progress from a server action). Add a TODO comment for Centrifugo upgrade.

### Gap 4: Category Mapping Bootstrapping
The `channelCategoryMapping` table is empty at launch. eBay has ~34,000 leaf categories. **Recommendation:** For F1, import listings with `categoryId: null` and set a flag "Category needs assignment." After import, show a banner: "X listings need category assignment." The seller can bulk-assign categories. A seed script for common eBay-to-Twicely category mappings can be added as a follow-up.

### Gap 5: eBay Variations
eBay supports multi-variation listings (e.g., a shirt in 3 sizes). The Twicely listing table does not yet have variations (Feature Lock-in section 45 mentions variations but schema is for future). **Recommendation:** For F1, import eBay multi-variation listings as a single listing with quantity = sum of all variation quantities. Store the original variation data in `importRecord.rawDataJson` for future use.

---

**END OF INSTALL PROMPT**
**Vocabulary check:** StoreTier (storefront), ListerTier (crosslister), PerformanceBand (earned). No banned terms used.
