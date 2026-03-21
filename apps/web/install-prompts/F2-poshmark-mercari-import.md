# Install Prompt: F2 — Poshmark + Mercari Import

**Phase & Step:** F2
**Feature Name:** Poshmark + Mercari Import Connectors
**One-line Summary:** Build PoshmarkConnector (Tier C, session-based) and MercariConnector (Tier B, OAuth) implementing the existing `PlatformConnector` interface, plus make the existing import pipeline and UI generic across all three launch platforms.
**Date:** 2026-03-06

---

## Canonical Sources — READ ALL BEFORE STARTING

| Document | Why |
|----------|-----|
| `TWICELY_V3_LISTER_CANONICAL.md` | PRIMARY — Section 9.1 (Tier B/C distinction), 9.2 (connector interface), 9.4 (Tier C session automation safeguards), 10 (dedupe), 16 (Poshmark 3 automation modes), 19 (image specs), 27 (platform rollout). |
| `TWICELY_V3_SCHEMA_v2_0_7.md` | Section 12.1-12.9. All crosslister tables already exist. No new tables needed. |
| `TWICELY_V3_PAGE_REGISTRY.md` | Rows 56-59. Same routes as F1 (`/my/selling/crosslist/*`). No new pages needed. |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Section 46 (Crosslister UX). Listing form crosslist toggles show per-platform readiness. |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | CASL subjects + delegation scopes already in place from E2.1. No changes needed. |
| `TWICELY_V3_DECISION_RATIONALE.md` | Decisions #16 (Imports Go Active Immediately), #17 (Crosslister as Supply Engine). Both apply identically to Poshmark and Mercari. |

---

## 1. PREREQUISITES

### Already Complete (Verified)

**From E2.1 (Connector Framework):**
- `PlatformConnector` interface at `src/lib/crosslister/connector-interface.ts`
- All shared types at `src/lib/crosslister/types.ts` — `ExternalListing`, `PaginatedListings`, `AuthResult`, `AuthInput` (including `SessionAuthInput`), `ConnectorCapabilities`, etc.
- Channel registry at `src/lib/crosslister/channel-registry.ts`:
  - POSHMARK: `tier: 'C'`, `authMethod: 'SESSION'`, `enabled: true`, color `#DE3163`, max 16 images, 80 title, 1500 desc, `canShare: true`
  - MERCARI: `tier: 'B'`, `authMethod: 'OAUTH'`, `enabled: true`, color `#FF4F00`, max 12 images, 80 title, 1000 desc
- Connector registry at `src/lib/crosslister/connector-registry.ts` — `registerConnector()`, `getConnector()`
- CASL: `CrosslisterAccount`, `ChannelProjection`, `CrossJob`, `ImportBatch` all in subjects.ts
- Delegation scopes: `crosslister.read`, `crosslister.publish`, `crosslister.import`, `crosslister.manage`
- Seed data: Poshmark and Mercari feature flags already seeded as `true` in `seed-crosslister.ts`
- Seed data: Rate limits for both platforms already seeded
- Seed data: Channel category mappings for both platforms already seeded
- Seed data: Policy rules (Poshmark min-photo, Mercari no-ext-links) already seeded
- Validations: `connectAccountSchema` supports all channels and auth methods

**From F1 (eBay Import):**
- `EbayConnector` at `src/lib/crosslister/connectors/ebay-connector.ts` — pattern to follow
- `ebay-types.ts` + `ebay-normalizer.ts` — type + normalizer pattern to follow
- Import pipeline at `src/lib/crosslister/services/import-service.ts` — currently HARDCODED to eBay (must be made generic)
- Dedupe service at `src/lib/crosslister/services/dedupe-service.ts` — already channel-agnostic
- Listing creator at `src/lib/crosslister/services/listing-creator.ts` — already channel-agnostic (accepts `ExternalChannel` param)
- Import notifier at `src/lib/crosslister/services/import-notifier.ts` — already channel-agnostic
- Server actions at `src/lib/actions/crosslister-accounts.ts` — currently HARDCODED to eBay (must be made generic)
- Server actions at `src/lib/actions/crosslister-import.ts` — currently HARDCODED to eBay (must be made generic)
- Queries at `src/lib/queries/crosslister.ts` — already channel-agnostic
- OAuth callback at `src/app/api/crosslister/ebay/callback/route.ts` — pattern for Mercari callback
- All UI pages and components — currently HARDCODED to show only eBay (must be made generic)

### Dependencies
- F1 (eBay Import) — DONE
- npm: No new packages required. Both Poshmark and Mercari API calls use standard `fetch()`.

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

F2 has two parallel workstreams plus a mandatory refactoring step:

- **Stream 0 (MUST DO FIRST):** Make the import pipeline, actions, and UI generic (remove all eBay hardcoding)
- **Stream A:** PoshmarkConnector (Tier C, session-based auth)
- **Stream B:** MercariConnector (Tier B, OAuth)

Stream A and Stream B can run in parallel AFTER Stream 0 is complete.

---

### 2.0 Stream 0: Genericize the Import Pipeline

The F1 implementation hardcoded `'EBAY'` and `normalizeEbayListing` throughout. This stream replaces all hardcoded references with channel-aware dispatching.

#### 2.0.1 Create Generic Normalizer Dispatcher

**File:** `src/lib/crosslister/services/normalizer-dispatch.ts` (NEW, ~50 lines)

This module dispatches normalization to the correct platform-specific normalizer based on channel.

```typescript
import type { ExternalListing } from '../types';
import type { ExternalChannel } from '../types';

/**
 * Normalize raw listing data from any supported channel.
 * Dispatches to the channel-specific normalizer.
 */
export function normalizeExternalListing(
  raw: Record<string, unknown>,
  channel: ExternalChannel,
): ExternalListing { ... }
```

Implementation:
- Switch on `channel`:
  - `'EBAY'`: call `normalizeEbayListing(raw)` then `toExternalListing(result)` (existing functions)
  - `'POSHMARK'`: call `normalizePoshmarkListing(raw)` then `toExternalListing(result)` (from Stream A)
  - `'MERCARI'`: call `normalizeMercariListing(raw)` then `toExternalListing(result)` (from Stream B)
  - default: throw `Error('No normalizer for channel: ${channel}')`

#### 2.0.2 Modify `import-service.ts` — Remove eBay Hardcoding

**File:** `src/lib/crosslister/services/import-service.ts` (MODIFY)

Current hardcoded references to replace:

| Line | Current | New |
|------|---------|-----|
| 23 | `import { normalizeEbayListing } from '../connectors/ebay-normalizer'` | `import { normalizeExternalListing } from './normalizer-dispatch'` |
| 51 | `const connector = getConnector('EBAY')` | `const connector = getConnector(batch.channel as ExternalChannel)` — pass channel from batch row |
| 65 | `channel: 'EBAY' as const` | `channel: batch.channel as ExternalChannel` — use the batch's channel |
| 127-128 | `const raw = record.rawDataJson as Parameters<typeof normalizeEbayListing>[0]; const normalized = normalizeEbayListing(raw);` | `const raw = record.rawDataJson as Record<string, unknown>; const normalized = normalizeExternalListing(raw, batchChannel);` |
| 180 | `const { listingId } = await createImportedListing(normalized, sellerId, 'EBAY')` | `const { listingId } = await createImportedListing(normalized, sellerId, batchChannel)` |
| 186 | `channel: 'EBAY'` | `channel: batchChannel` |
| 222 | `channel: 'EBAY'` | `channel: batchChannel` |

Key changes:
- `stageFetch` must accept the channel from the batch and use `getConnector(channel)` instead of `getConnector('EBAY')`
- `stageTransform` must accept the channel and call `normalizeExternalListing(raw, channel)` instead of `normalizeEbayListing(raw)`
- `stageImport` must pass the channel to `createImportedListing` and `channelProjection` insert
- `processImportBatch` must read `batch.channel` and thread it through all stages

The function signatures should change to accept `channel: ExternalChannel` as a parameter threaded from the batch row.

#### 2.0.3 Modify `crosslister-import.ts` Actions — Remove eBay Hardcoding

**File:** `src/lib/actions/crosslister-import.ts` (MODIFY)

Current hardcoded references to replace:

| Line | Current | New |
|------|---------|-----|
| 21 | `import { normalizeEbayListing } from '...'` | `import { normalizeExternalListing } from '...'` |
| 90 | `where(eq(platformSetting.key, 'crosslister.ebay.importEnabled'))` | Dynamic: `where(eq(platformSetting.key, \`crosslister.${channelKey}.importEnabled\`))` using a channel-to-settings-key helper |
| 234-235 | `normalizeEbayListing(raw)` | `normalizeExternalListing(raw, channel)` where `channel` is read from the import record's batch |
| 261 | `createImportedListing(normalized, sellerId, 'EBAY')` | `createImportedListing(normalized, sellerId, channel)` |

To resolve the channel for `startImport`: read `account.channel` from the crosslisterAccount row (already fetched at line 65-74).

To resolve the channel for `retryImportRecord`: read `batch.channel` from the batch row (already fetched at line 224-230, but `.channel` is not currently selected — add it to the select clause).

Helper function for feature flag key lookup (unexported, keep in same file):
```typescript
function getImportFlagKey(channel: ExternalChannel): string {
  const map: Record<ExternalChannel, string> = {
    EBAY: 'crosslister.ebay.importEnabled',
    POSHMARK: 'crosslister.poshmark.importEnabled',
    MERCARI: 'crosslister.mercari.importEnabled',
    DEPOP: 'crosslister.depop.importEnabled',
    FB_MARKETPLACE: 'crosslister.fbMarketplace.importEnabled',
    ETSY: 'crosslister.etsy.importEnabled',
    GRAILED: 'crosslister.grailed.importEnabled',
    THEREALREAL: 'crosslister.therealreal.importEnabled',
  };
  return map[channel];
}
```

#### 2.0.4 Modify `crosslister-accounts.ts` Actions — Remove eBay Hardcoding

**File:** `src/lib/actions/crosslister-accounts.ts` (MODIFY)

Current state: `connectEbayAccount()` is eBay-specific. `disconnectAccount()` has `if (account.channel === 'EBAY')`. `refreshAccountAuth()` has `if (account.channel !== 'EBAY')`.

Changes:
1. **Replace `connectEbayAccount()`** with a generic `connectPlatformAccount(input)` action that accepts `{ channel: ExternalChannel }` validated by Zod. For OAuth channels (EBAY, MERCARI), it builds an auth URL using the connector. For SESSION channels (POSHMARK), it returns instructions for session-based auth (username/password form, handled client-side).
2. **Update `disconnectAccount()`**: Replace `if (account.channel === 'EBAY')` with a generic `getConnector(account.channel as ExternalChannel)` call. Use a try-catch around the revoke since some connectors may not support it.
3. **Update `refreshAccountAuth()`**: Remove `if (account.channel !== 'EBAY')` guard. Instead, check if the connector supports token refresh (OAuth-based channels do, session-based channels use `revokeAuth` + re-authenticate instead). For session channels, return `{ success: false, error: 'Session-based platforms require re-authentication. Please reconnect.' }`.

New action signature:
```typescript
export async function connectPlatformAccount(
  input: unknown,
): Promise<ActionResult<{ url?: string; method: 'OAUTH' | 'SESSION' }>>
```

The Zod schema for this action:
```typescript
const connectPlatformSchema = z.object({
  channel: z.enum(['EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL']),
}).strict();
```

For OAUTH channels (EBAY, MERCARI): return `{ url, method: 'OAUTH' }` — the UI redirects the seller.
For SESSION channels (POSHMARK): return `{ method: 'SESSION' }` — the UI shows a username/password form.

IMPORTANT: Keep the existing `connectEbayAccount` function exported alongside the new generic one for backward compatibility. Mark it with a `@deprecated` JSDoc comment. The UI will switch to the generic function.

#### 2.0.5 Modify UI Components — Remove eBay Hardcoding

**File:** `src/components/crosslister/connect-platform-grid.tsx` (MODIFY)

Current state: Hardcoded `PLATFORMS` array with Poshmark and Mercari as `available: false`. Hardcoded `handleConnectEbay` function.

Changes:
1. Remove the `available: false` for Poshmark and Mercari — set both to `available: true`
2. Replace `handleConnectEbay` with a generic `handleConnect(channel)` function that calls the new `connectPlatformAccount({ channel })` action
3. For OAUTH results (`result.data?.url`): redirect with `window.location.href`
4. For SESSION results (`result.data?.method === 'SESSION'`): show a session auth dialog (new component)

**File:** `src/components/crosslister/platform-card.tsx` (MODIFY)

Current state: Hardcoded eBay color `bg-[#E53238]` and display name logic `account.channel === 'EBAY' ? 'eBay' : account.channel`.

Changes:
1. Import `getChannelMetadata` from channel-registry
2. Use `metadata.color` for the avatar background
3. Use `metadata.displayName` for the platform name
4. Revoke logic: use generic `getConnector(account.channel)` pattern (already handled by updated `disconnectAccount` action)

**File:** `src/components/crosslister/connect-platform-cta.tsx` — No changes needed (already generic).

**File:** `src/components/crosslister/import-start-form.tsx` — Verify it uses `accountId` (already generic). No changes expected.

**File:** `src/components/crosslister/import-progress.tsx` — No changes needed.
**File:** `src/components/crosslister/import-summary.tsx` — No changes needed.
**File:** `src/components/crosslister/import-issues-table.tsx` — No changes needed.
**File:** `src/components/crosslister/import-page-client.tsx` — No changes needed.

#### 2.0.6 New Component: Session Auth Dialog

**File:** `src/components/crosslister/session-auth-dialog.tsx` (NEW, ~120 lines)

A dialog/modal for Tier C platforms (Poshmark) where the seller enters their platform username and password.

Props:
```typescript
interface SessionAuthDialogProps {
  channel: ExternalChannel;
  channelDisplayName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}
```

The dialog contains:
- Channel name + color header
- Warning banner: "Your credentials are encrypted and stored securely. Twicely never shares your credentials with third parties." (Source: Lister Canonical Section 9.4)
- Username input (text)
- Password input (password)
- "Connect" submit button
- On submit: calls `authenticateSessionAccount({ channel, username, password })` server action

**New server action** (add to `crosslister-accounts.ts`):
```typescript
export async function authenticateSessionAccount(
  input: unknown,
): Promise<ActionResult>
```

This action:
1. Validates input with `z.object({ channel, username, password }).strict()`
2. Gets or creates a crosslisterAccount row for the seller + channel
3. Calls `connector.authenticate({ method: 'SESSION', username, password })`
4. If successful, stores sessionData + sets status ACTIVE
5. If failed, returns error

#### 2.0.7 Modify Mercari OAuth Callback Route

**File:** `src/app/api/crosslister/mercari/callback/route.ts` (NEW, ~100 lines)

Follow the exact same pattern as `src/app/api/crosslister/ebay/callback/route.ts`. Differences:
- Redirect URLs: `/my/selling/crosslist/connect?connected=mercari` and `?error=auth_failed`
- Use `getConnector('MERCARI')` instead of `new EbayConnector()`
- Channel is `'MERCARI'` in all DB operations

---

### 2.1 Stream A: Poshmark Connector (Tier C, Session-Based)

Poshmark has NO official public API. The Lister Canonical (Section 9.4, Section 16) specifies that Tier C connectors use session automation. For the import-only F2 scope, the connector uses Poshmark's internal mobile API (undocumented but well-known in the reseller tooling space).

#### 2.1.1 Poshmark Types

**File:** `src/lib/crosslister/connectors/poshmark-types.ts` (NEW, ~80 lines)

Define TypeScript interfaces for Poshmark's internal API responses:

```typescript
/** Poshmark listing data (from internal API /api/posts) */
export interface PoshmarkListing {
  id: string;
  title: string;
  description: string;
  price_amount: { val: string; currency_code: string };
  original_price_amount?: { val: string; currency_code: string };
  inventory: { size_quantities: Array<{ size_id: string; quantity_available: number }> };
  catalog: { department_obj?: { display: string }; category_obj?: { display: string } };
  pictures: Array<{ url: string }>;
  brand?: { display: string };
  condition?: string;
  status: string; // 'available', 'sold', 'not_for_sale', 'removed'
  created_at: string; // ISO timestamp
  updated_at: string;
  covershot?: { url: string };
}

/** Poshmark paginated listings response */
export interface PoshmarkListingsResponse {
  data: PoshmarkListing[];
  more_available: boolean;
  next_max_id?: string;
}

/** Poshmark auth response (internal login API) */
export interface PoshmarkAuthResponse {
  user?: {
    id: string;
    username: string;
  };
  jwt?: string;
  error?: string;
}
```

Important: Poshmark's internal API returns prices as `{ val: "25.00", currency_code: "USD" }`. The normalizer must parse `val` to integer cents.

#### 2.1.2 Poshmark Normalizer

**File:** `src/lib/crosslister/connectors/poshmark-normalizer.ts` (NEW, ~140 lines)

Follow the exact pattern of `ebay-normalizer.ts`.

```typescript
export interface PoshmarkNormalizedData {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: string | null;
  brand: string | null;
  images: ExternalImage[];
  itemSpecifics: Record<string, string>;
  url: string;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT';
  listedAt: Date | null;
  soldAt: null;
  category: string | null;
  shippingType: string | null;
  shippingPriceCents: null;
  weight: null;
  dimensions: null;
}
```

Field mappings:
- `externalId` = `raw.id`
- `title` = `raw.title` (trim, max 200 chars)
- `description` = `raw.description` (plain text, no HTML stripping needed)
- `priceCents` = parse `raw.price_amount.val` to integer cents (same `parsePrice` pattern as eBay)
- `currencyCode` = `raw.price_amount.currency_code` or `'USD'`
- `quantity` = sum of `raw.inventory.size_quantities[*].quantity_available` (min 1)
- `condition` = map Poshmark conditions to Twicely enum:
  - `'NWT'` -> `'NEW_WITH_TAGS'`
  - `'NWOT'` -> `'NEW_WITHOUT_TAGS'`
  - `'Good'` -> `'GOOD'`
  - `'Like New'` -> `'LIKE_NEW'`
  - `'Fair'` -> `'ACCEPTABLE'`
  - Others -> `null`
- `brand` = `raw.brand?.display` or `null`
- `images` = `raw.pictures.map(...)` with covershot as primary if present, else first picture
- `category` = `raw.catalog.category_obj?.display` or `null`
- `status` mapping:
  - `'available'` -> `'ACTIVE'`
  - `'sold'` -> `'SOLD'`
  - `'not_for_sale'` -> `'ENDED'`
  - `'removed'` -> `'ENDED'`
  - Others -> `'ENDED'`
- `url` = `https://poshmark.com/listing/${raw.id}`
- `listedAt` = parse `raw.created_at` if present, else `null`

Export:
```typescript
export function normalizePoshmarkListing(raw: PoshmarkListing): PoshmarkNormalizedData
export function toExternalListing(normalized: PoshmarkNormalizedData): ExternalListing
export function parsePoshmarkPrice(value: string): number
```

#### 2.1.3 Poshmark Connector

**File:** `src/lib/crosslister/connectors/poshmark-connector.ts` (NEW, ~280 lines)

Implements `PlatformConnector`. Self-registers via `registerConnector(new PoshmarkConnector())`.

```typescript
export class PoshmarkConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'POSHMARK';
  readonly tier: ConnectorTier = 'C';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = POSHMARK_CAPABILITIES;
  ...
}
```

Where `POSHMARK_CAPABILITIES`:
```typescript
const POSHMARK_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: false,        // Tier C: no update support
  canDelist: true,
  hasWebhooks: false,       // No webhooks
  hasStructuredCategories: false, // Flat categories
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: true,           // Poshmark-specific sharing
  maxImagesPerListing: 16,
  maxTitleLength: 80,
  maxDescriptionLength: 1500,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};
```

**API details (Poshmark internal mobile API):**
- Base URL: `https://poshmark.com/api`
- Auth: POST `/login` with `{ username_or_email, password }`. Returns JWT token.
- Fetch closet: GET `/posts?username={username}&max_id={cursor}&limit=48` with `Authorization: Bearer {jwt}`
- Fetch single: GET `/posts/{id}` with bearer token
- All requests require `User-Agent` header mimicking mobile app

**Config from platform_settings:**
```
crosslister.poshmark.apiBase        (default: 'https://poshmark.com/api')
crosslister.poshmark.userAgent      (default: mobile user-agent string)
```

These do NOT yet exist in seed. They must be added (see Section 2.3).

**Method implementations:**

`authenticate(credentials: SessionAuthInput)`:
1. Validate `credentials.method === 'SESSION'`
2. Load config from platform_settings
3. POST to login endpoint with username + password
4. If success: return `AuthResult` with `sessionData: { jwt, username }`, `externalUsername`, `externalAccountId`
5. If failure: return error result
6. TODO: Token encryption before production (same as eBay — plaintext for F2)

`refreshAuth(account)`:
- Poshmark sessions expire. For Tier C, refresh = attempt to use existing JWT.
- If JWT is still valid (test with a GET request): return success with same tokens
- If JWT is expired: return `{ success: false, error: 'Session expired. Please reconnect.' }`
- Status will be set to `REAUTHENTICATION_REQUIRED` by the caller

`revokeAuth(account)`:
- Best effort: send logout request if JWT exists
- Log and ignore errors (same pattern as eBay)

`fetchListings(account, cursor?)`:
1. Extract JWT from `account.sessionData` (typed as `{ jwt: string; username: string }`)
2. If no JWT: return empty result
3. GET closet listings with pagination (`max_id` cursor)
4. Normalize each listing via `normalizePoshmarkListing`
5. Filter to status `'ACTIVE'` only
6. Return `PaginatedListings` with `cursor = response.next_max_id`

`fetchSingleListing(account, externalId)`:
1. GET single post by ID
2. Normalize and return

`createListing`, `updateListing`, `delistListing`, `verifyListing`:
- All stubs returning `{ success: false, error: 'Not implemented in F2', retryable: false }`

`healthCheck(account)`:
- Try fetching 1 listing. If 200, healthy. Pattern identical to eBay.

Self-register at bottom of file:
```typescript
registerConnector(new PoshmarkConnector());
```

---

### 2.2 Stream B: Mercari Connector (Tier B, OAuth)

Mercari has a developer API (limited but usable). Tier B means OAuth auth, no webhooks, limited endpoints.

#### 2.2.1 Mercari Types

**File:** `src/lib/crosslister/connectors/mercari-types.ts` (NEW, ~80 lines)

```typescript
/** Mercari listing item (from API) */
export interface MercariItem {
  id: string;
  name: string;
  description: string;
  price: number;           // integer cents already (Mercari returns cents)
  status: string;          // 'on_sale', 'sold_out', 'trading', 'inactive'
  condition_id: number;    // 1-6 mapping
  photos: Array<{ url: string }>;
  brand?: { id: number; name: string };
  categories?: Array<{ id: number; name: string }>;
  shipping?: {
    method_id: number;
    payer_id: number;       // 1=seller, 2=buyer
    fee?: number;           // shipping fee in cents
  };
  created: number;         // Unix timestamp
  updated: number;
  item_condition?: string;
}

/** Mercari paginated response */
export interface MercariListingsResponse {
  result: string;           // 'OK' or error
  data: MercariItem[];
  meta?: {
    next_page_token?: string;
    has_next: boolean;
  };
}

/** Mercari OAuth token response */
export interface MercariTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/** Mercari user profile (from /users/me) */
export interface MercariUserProfile {
  id: string;
  name: string;
}
```

#### 2.2.2 Mercari Normalizer

**File:** `src/lib/crosslister/connectors/mercari-normalizer.ts` (NEW, ~130 lines)

Follow the exact pattern of `ebay-normalizer.ts`.

```typescript
export interface MercariNormalizedData {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: string | null;
  brand: string | null;
  images: ExternalImage[];
  itemSpecifics: Record<string, string>;
  url: string;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT';
  listedAt: Date | null;
  soldAt: null;
  category: string | null;
  shippingType: string | null;
  shippingPriceCents: number | null;
  weight: null;
  dimensions: null;
}
```

Field mappings:
- `externalId` = `String(raw.id)`
- `title` = `raw.name` (trim, max 200 chars)
- `description` = `raw.description` (plain text)
- `priceCents` = `raw.price` (Mercari returns integer cents directly)
- `currencyCode` = `'USD'` (Mercari US only)
- `quantity` = `1` (Mercari is single-quantity per listing)
- `condition` mapping from `condition_id`:
  - `1` -> `'NEW_WITH_TAGS'`
  - `2` -> `'LIKE_NEW'`
  - `3` -> `'GOOD'`
  - `4` -> `'GOOD'` (Mercari "Fair" maps to Twicely "Good")
  - `5` -> `'ACCEPTABLE'` (Mercari "Poor")
  - `6` -> `'NEW_WITHOUT_TAGS'`
  - Others -> `null`
- `brand` = `raw.brand?.name` or `null`
- `images` = `raw.photos.map(...)` with first as primary
- `category` = first category name from `raw.categories` array, or `null`
- `status` mapping:
  - `'on_sale'` -> `'ACTIVE'`
  - `'sold_out'` -> `'SOLD'`
  - `'trading'` -> `'SOLD'`
  - `'inactive'` -> `'ENDED'`
  - Others -> `'ENDED'`
- `url` = `https://www.mercari.com/us/item/${raw.id}/`
- `listedAt` = `new Date(raw.created * 1000)` if present, else `null`
- `shippingType` = `raw.shipping?.payer_id === 1 ? 'FREE' : 'FLAT'`
- `shippingPriceCents` = `raw.shipping?.fee ?? null`

Export:
```typescript
export function normalizeMercariListing(raw: MercariItem): MercariNormalizedData
export function toExternalListing(normalized: MercariNormalizedData): ExternalListing
```

#### 2.2.3 Mercari Connector

**File:** `src/lib/crosslister/connectors/mercari-connector.ts` (NEW, ~260 lines)

Implements `PlatformConnector`. Self-registers via `registerConnector(new MercariConnector())`.

```typescript
export class MercariConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'MERCARI';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = MERCARI_CAPABILITIES;
  ...
}
```

Where `MERCARI_CAPABILITIES`:
```typescript
const MERCARI_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: true,
  canDelist: true,
  hasWebhooks: false,        // Tier B: no webhooks
  hasStructuredCategories: true,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 12,
  maxTitleLength: 80,
  maxDescriptionLength: 1000,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};
```

**API details (Mercari API):**
- Auth: OAuth 2.0 (same flow as eBay but different endpoints)
- Auth URL: `https://www.mercari.com/oauth/authorize`
- Token URL: `https://api.mercari.com/oauth/token`
- API base: `https://api.mercari.com/v1`
- Fetch listings: `GET /users/me/items?status=on_sale&page_token={cursor}&page_size=50`
- Fetch single: `GET /items/{id}`
- Health: `GET /users/me` — if 200, healthy

**Config from platform_settings:**
```
crosslister.mercari.clientId
crosslister.mercari.clientSecret
crosslister.mercari.redirectUri    (default: 'https://twicely.co/api/crosslister/mercari/callback')
crosslister.mercari.environment    (default: 'PRODUCTION')
```

These do NOT yet exist in seed. They must be added (see Section 2.3).

**Method implementations:**

`authenticate(credentials: OAuthAuthInput)`:
- Same pattern as EbayConnector. Exchange auth code for tokens.
- After token exchange, GET `/users/me` to populate `externalAccountId` and `externalUsername`
- Return AuthResult with tokens + capabilities

`refreshAuth(account)`:
- Same pattern as EbayConnector. POST to token URL with `grant_type: refresh_token`.

`revokeAuth(account)`:
- POST to revoke endpoint if available, else best-effort (same as eBay)

`fetchListings(account, cursor?)`:
1. GET user items with pagination
2. Normalize each via `normalizeMercariListing`
3. Filter to `'ACTIVE'` status only
4. Return `PaginatedListings`

`fetchSingleListing(account, externalId)`:
1. GET single item
2. Normalize and return

`createListing`, `updateListing`, `delistListing`, `verifyListing`:
- All stubs returning `{ success: false, error: 'Not implemented in F2', retryable: false }`

`healthCheck(account)`:
- GET `/users/me`. If 200, healthy.

`buildAuthUrl(state: string)`:
- Helper method (same pattern as `EbayConnector.buildAuthUrl`) for generating the OAuth authorization URL.

Self-register at bottom of file:
```typescript
registerConnector(new MercariConnector());
```

---

### 2.3 Seed Data Updates

**File:** `src/lib/db/seed/seed-crosslister.ts` (MODIFY)

Add platform_settings entries for Poshmark and Mercari API configuration. Append to the `CROSSLISTER_SETTINGS` array:

```typescript
// Poshmark API config (F2 — session-based, no OAuth credentials needed)
{ key: 'crosslister.poshmark.apiBase', value: 'https://poshmark.com/api', type: 'string', description: 'Poshmark internal API base URL' },
{ key: 'crosslister.poshmark.userAgent', value: 'Poshmark/8.0 (iPhone; iOS 17.0)', type: 'string', description: 'User-Agent header for Poshmark API requests' },

// Mercari OAuth credentials (F2 — values populated by admin before launch)
{ key: 'crosslister.mercari.clientId', value: '', type: 'string', description: 'Mercari app client ID for OAuth' },
{ key: 'crosslister.mercari.clientSecret', value: '', type: 'string', description: 'Mercari app client secret for OAuth' },
{ key: 'crosslister.mercari.redirectUri', value: 'https://twicely.co/api/crosslister/mercari/callback', type: 'string', description: 'Mercari OAuth redirect URI' },
{ key: 'crosslister.mercari.environment', value: 'PRODUCTION', type: 'string', description: 'Mercari API environment' },
```

---

### 2.4 Connector Auto-Registration

**IMPORTANT:** The connector modules self-register when their module file is loaded. The import pipeline uses `getConnector(channel)` which requires the connector to be registered. You must ensure the new connectors are imported (side-effect import) in a central location.

**File:** `src/lib/crosslister/connectors/index.ts` (NEW, ~10 lines)

```typescript
/**
 * Side-effect imports that register all platform connectors.
 * Import this file once at app startup to ensure all connectors are available.
 */
import './ebay-connector';
import './poshmark-connector';
import './mercari-connector';
```

Then import this barrel from `import-service.ts` (add at top):
```typescript
import '../connectors'; // Ensure all connectors are registered
```

And from the OAuth callback routes that need connectors.

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- No `SellerTier`, `SubscriptionTier`, `FVF`, `BASIC`, `ELITE`, `PLUS`, `MAX`, `PREMIUM`, `Twicely Balance`, `wallet`, `Withdraw`

### Banned Tech
- No Prisma, NextAuth, Redis, Zustand, tRPC, Meilisearch, MinIO, Soketi, Nodemailer

### Specific Constraints
1. **Do NOT invent new database tables.** All crosslister tables already exist from E2.1. The `crosslisterAccount` table already supports SESSION auth via the `sessionData` jsonb column.
2. **Do NOT add new fields to existing tables.** The schema is locked.
3. **Do NOT create new page routes.** F2 uses the same 4 pages as F1 (`/my/selling/crosslist/*`). The UI is already generic enough — it shows whatever accounts are connected.
4. **Do NOT implement crosslisting publish** (outbound). That is F3. All `createListing`, `updateListing`, `delistListing` methods must remain stubs.
5. **Do NOT implement automation.** That is F6. No Poshmark sharing, no auto-relist, no offer-to-likers.
6. **Do NOT implement real token encryption.** Follow the F1 pattern: TODO comment, plaintext storage. Token encryption is a G10 task.
7. **Do NOT implement real-time import progress via Centrifugo.** Follow F1 pattern: polling via `getImportBatchStatus` action.
8. **Do NOT download/migrate images.** Store external image URLs directly (same as F1 pattern).
9. **Do NOT implement headless browser automation** for Poshmark. For F2, the Poshmark connector uses their internal mobile API (HTTP requests, not Puppeteer/Playwright). Full browser automation is F6.
10. **Do NOT hardcode fee rates, API credentials, or rate limits.** All come from `platform_settings`.
11. **Money as integer cents only.** Poshmark returns `"25.00"` strings — parse to `2500`. Mercari returns integer cents directly.
12. **Ownership via `userId` always.** The `sellerId` in crosslister tables traces to `userId`, never `storeId`.
13. **Max 300 lines per file.** If any connector exceeds 300 lines, split helpers into a separate file (e.g., `poshmark-helpers.ts`).
14. **Keep all helper functions unexported** in `'use server'` files to prevent them from becoming unintended server actions.

---

## 4. ACCEPTANCE CRITERIA

### Functional
1. A seller can connect a Poshmark account via username/password through the session auth dialog
2. A seller can connect a Mercari account via OAuth (redirect flow identical to eBay)
3. A seller can start a free one-time import from a connected Poshmark account
4. A seller can start a free one-time import from a connected Mercari account
5. Imported Poshmark listings appear as ACTIVE on Twicely (Decision #16)
6. Imported Mercari listings appear as ACTIVE on Twicely (Decision #16)
7. Poshmark imports correctly parse prices from `{ val: "25.00" }` format to integer cents
8. Mercari imports correctly use integer cents from the API response
9. Dedupe works across platforms: a listing imported from eBay and then from Poshmark with the same title+price is deduplicated (linked, not duplicated)
10. The connect platform grid shows eBay, Poshmark, and Mercari all as connectable (no "Coming soon" badges)
11. The platform card shows the correct color and display name for each platform (eBay red, Poshmark pink, Mercari orange)
12. Disconnecting works for all three platforms
13. The existing eBay import continues to work identically (no regressions)
14. All import actions are generic — `startImport` works with any accountId regardless of channel
15. Import feature flags are checked per-channel (e.g., Poshmark import can be disabled independently)

### Authorization
16. Unauthenticated users cannot connect any platform account
17. CASL `CrosslisterAccount` create permission is required to connect
18. CASL `ImportBatch` create permission is required to start an import
19. Delegation scopes are respected: `crosslister.import` allows delegated staff to import
20. Account ownership is checked: seller A cannot import from seller B's connected account

### Data Integrity
21. All monetary values stored as integer cents (priceCents)
22. Poshmark `price_amount.val` string "89.99" converts to 8999 cents
23. Mercari `price` integer cents are stored directly without conversion
24. Listing conditions map correctly to Twicely's 7-value enum
25. External image URLs are stored directly (no R2 download during import)
26. `importedFromChannel` on listing table is set to `'POSHMARK'` or `'MERCARI'` for each import
27. `firstImportCompletedAt` prevents second free import per platform per account

### Negative Cases
28. Connecting a platform that already has an ACTIVE account returns an error
29. Starting an import when `firstImportCompletedAt` is already set returns "Free import already used"
30. Starting an import on a REVOKED or ERROR account returns "Account is not active"
31. Poshmark login with invalid credentials returns a clear error (not an unhandled exception)
32. Mercari OAuth with an invalid code returns a clear error
33. Session-based refresh for Poshmark (expired JWT) returns "Session expired. Please reconnect." and sets status to REAUTHENTICATION_REQUIRED
34. Import on a disabled channel (e.g., `crosslister.poshmark.importEnabled = false`) is blocked

### Vocabulary
35. No banned terms appear anywhere in UI, code, or test descriptions
36. No `'EBAY'` hardcoded strings remain in import-service.ts, crosslister-import.ts, or crosslister-accounts.ts (except in eBay-specific connector files)

---

## 5. TEST REQUIREMENTS

### Unit Tests — Poshmark

**File:** `src/lib/crosslister/connectors/__tests__/poshmark-normalizer.test.ts` (NEW, ~15 tests)
- `parsePoshmarkPrice` converts "89.99" to 8999
- `parsePoshmarkPrice` handles "0" correctly
- `parsePoshmarkPrice` handles invalid string as 0
- `normalizePoshmarkListing` maps title correctly (trimming)
- `normalizePoshmarkListing` truncates title to 200 chars
- `normalizePoshmarkListing` maps NWT condition to NEW_WITH_TAGS
- `normalizePoshmarkListing` maps NWOT condition to NEW_WITHOUT_TAGS
- `normalizePoshmarkListing` maps Like New condition to LIKE_NEW
- `normalizePoshmarkListing` returns null condition for unknown values
- `normalizePoshmarkListing` maps image URLs with covershot as primary
- `normalizePoshmarkListing` handles missing optional fields gracefully
- `normalizePoshmarkListing` maps 'available' status to ACTIVE
- `normalizePoshmarkListing` maps 'sold' status to SOLD
- `normalizePoshmarkListing` extracts brand from brand object
- `normalizePoshmarkListing` builds correct Poshmark listing URL

**File:** `src/lib/crosslister/connectors/__tests__/poshmark-connector.test.ts` (NEW, ~12 tests)
- `authenticate` returns AuthResult with session data on success
- `authenticate` returns error for invalid credentials
- `authenticate` returns error for non-SESSION auth method
- `fetchListings` returns paginated ExternalListing array
- `fetchListings` handles empty closet
- `fetchListings` handles pagination (has_more + cursor)
- `fetchListings` returns empty when no session data
- `refreshAuth` returns error for expired session
- `healthCheck` returns healthy when API responds 200
- `healthCheck` returns unhealthy on error
- `channel` is 'POSHMARK'
- `tier` is 'C'

### Unit Tests — Mercari

**File:** `src/lib/crosslister/connectors/__tests__/mercari-normalizer.test.ts` (NEW, ~14 tests)
- `normalizeMercariListing` maps title correctly (trimming)
- `normalizeMercariListing` truncates title to 200 chars
- `normalizeMercariListing` uses integer cents price directly
- `normalizeMercariListing` maps condition_id 1 to NEW_WITH_TAGS
- `normalizeMercariListing` maps condition_id 2 to LIKE_NEW
- `normalizeMercariListing` maps condition_id 3 to GOOD
- `normalizeMercariListing` maps condition_id 5 to ACCEPTABLE
- `normalizeMercariListing` returns null condition for unknown values
- `normalizeMercariListing` maps image URLs with first as primary
- `normalizeMercariListing` handles missing optional fields gracefully
- `normalizeMercariListing` maps 'on_sale' status to ACTIVE
- `normalizeMercariListing` maps 'sold_out' status to SOLD
- `normalizeMercariListing` builds correct Mercari listing URL
- `normalizeMercariListing` quantity is always 1 (Mercari single-quantity)

**File:** `src/lib/crosslister/connectors/__tests__/mercari-connector.test.ts` (NEW, ~12 tests)
- `authenticate` returns AuthResult with tokens on success
- `authenticate` returns error on invalid code
- `authenticate` returns error for non-OAUTH auth method
- `authenticate` fetches user profile for externalAccountId
- `fetchListings` returns paginated ExternalListing array
- `fetchListings` handles empty inventory
- `fetchListings` handles pagination
- `fetchListings` returns empty when no access token
- `refreshAuth` refreshes expired tokens
- `healthCheck` returns healthy when API responds 200
- `channel` is 'MERCARI'
- `tier` is 'B'

### Unit Tests — Generic Pipeline

**File:** `src/lib/crosslister/services/__tests__/normalizer-dispatch.test.ts` (NEW, ~6 tests)
- Dispatches to eBay normalizer for channel EBAY
- Dispatches to Poshmark normalizer for channel POSHMARK
- Dispatches to Mercari normalizer for channel MERCARI
- Throws for unsupported channel (DEPOP)
- Returns valid ExternalListing shape for each channel

### Integration Tests — Updated Actions

**File:** `src/lib/actions/__tests__/crosslister-accounts.test.ts` (MODIFY, +8 tests)
- `connectPlatformAccount` returns OAuth URL for eBay
- `connectPlatformAccount` returns OAuth URL for Mercari
- `connectPlatformAccount` returns SESSION method for Poshmark
- `connectPlatformAccount` rejects unauthenticated users
- `authenticateSessionAccount` succeeds with valid Poshmark credentials
- `authenticateSessionAccount` fails with invalid credentials
- `disconnectAccount` works for Poshmark accounts
- `refreshAccountAuth` returns session-expired for Poshmark

**File:** `src/lib/actions/__tests__/crosslister-import.test.ts` (MODIFY, +6 tests)
- `startImport` works with Poshmark accountId
- `startImport` works with Mercari accountId
- `startImport` checks channel-specific feature flag
- `retryImportRecord` normalizes with correct channel normalizer
- Feature flag check uses channel-specific key (not hardcoded ebay)
- Generic normalizer is used instead of eBay-specific normalizer

### Expected Total New Tests: ~73

---

## 6. FILE APPROVAL LIST

### New Files (16)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/connectors/poshmark-types.ts` | TypeScript interfaces for Poshmark internal API responses |
| 2 | `src/lib/crosslister/connectors/poshmark-normalizer.ts` | Poshmark listing normalizer (field mapping + price parsing) |
| 3 | `src/lib/crosslister/connectors/poshmark-connector.ts` | PoshmarkConnector class implementing PlatformConnector (Tier C, session) |
| 4 | `src/lib/crosslister/connectors/mercari-types.ts` | TypeScript interfaces for Mercari API responses |
| 5 | `src/lib/crosslister/connectors/mercari-normalizer.ts` | Mercari listing normalizer (field mapping) |
| 6 | `src/lib/crosslister/connectors/mercari-connector.ts` | MercariConnector class implementing PlatformConnector (Tier B, OAuth) |
| 7 | `src/lib/crosslister/connectors/index.ts` | Barrel side-effect import to register all connectors |
| 8 | `src/lib/crosslister/services/normalizer-dispatch.ts` | Generic normalizer dispatcher (channel -> platform normalizer) |
| 9 | `src/app/api/crosslister/mercari/callback/route.ts` | Mercari OAuth callback route (same pattern as eBay) |
| 10 | `src/components/crosslister/session-auth-dialog.tsx` | Session auth dialog for Tier C platforms (username/password form) |
| 11 | `src/lib/crosslister/connectors/__tests__/poshmark-normalizer.test.ts` | Poshmark normalizer unit tests (~15 tests) |
| 12 | `src/lib/crosslister/connectors/__tests__/poshmark-connector.test.ts` | Poshmark connector unit tests (~12 tests) |
| 13 | `src/lib/crosslister/connectors/__tests__/mercari-normalizer.test.ts` | Mercari normalizer unit tests (~14 tests) |
| 14 | `src/lib/crosslister/connectors/__tests__/mercari-connector.test.ts` | Mercari connector unit tests (~12 tests) |
| 15 | `src/lib/crosslister/services/__tests__/normalizer-dispatch.test.ts` | Generic normalizer dispatch tests (~6 tests) |
| 16 | `src/lib/crosslister/services/__tests__/import-service.test.ts` | Import service generic pipeline tests (if not already present) |

### Modified Files (8)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/services/import-service.ts` | Remove all eBay hardcoding; use getConnector(channel) + normalizeExternalListing(raw, channel) |
| 2 | `src/lib/actions/crosslister-accounts.ts` | Add generic connectPlatformAccount + authenticateSessionAccount; update disconnect/refresh to be channel-agnostic |
| 3 | `src/lib/actions/crosslister-import.ts` | Remove eBay hardcoding; use channel-specific feature flag key; use generic normalizer |
| 4 | `src/components/crosslister/connect-platform-grid.tsx` | Enable Poshmark + Mercari (available: true); generic connect handler; show session auth dialog for Tier C |
| 5 | `src/components/crosslister/platform-card.tsx` | Use channel metadata for color + display name instead of hardcoded eBay values |
| 6 | `src/lib/db/seed/seed-crosslister.ts` | Add Poshmark API config + Mercari OAuth credential platform_settings |
| 7 | `src/lib/actions/__tests__/crosslister-accounts.test.ts` | Add ~8 tests for new generic connect + session auth actions |
| 8 | `src/lib/actions/__tests__/crosslister-import.test.ts` | Add ~6 tests for channel-generic import behavior |

### Total: 24 files (16 new + 8 modified), ~73 new tests

---

## 7. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste the FULL raw output:

```bash
# 1. TypeScript check — must be 0 errors
pnpm typecheck

# 2. Test suite — must be >= 2715 (current baseline after F1)
pnpm test

# 3. Banned terms grep
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|Twicely Balance\|wallet\|Withdraw" \
  src/lib/crosslister/connectors/poshmark* \
  src/lib/crosslister/connectors/mercari* \
  src/lib/crosslister/services/normalizer-dispatch.ts \
  src/components/crosslister/ \
  src/lib/actions/crosslister-accounts.ts \
  src/lib/actions/crosslister-import.ts \
  src/app/api/crosslister/mercari/ || echo "No banned terms found"

# 4. Verify no eBay hardcoding remains in generic files
grep -n "'EBAY'" \
  src/lib/crosslister/services/import-service.ts \
  src/lib/actions/crosslister-import.ts \
  src/lib/actions/crosslister-accounts.ts \
  src/components/crosslister/connect-platform-grid.tsx \
  src/components/crosslister/platform-card.tsx && echo "FAIL: eBay hardcoding found" || echo "PASS: No eBay hardcoding in generic files"

# 5. File size check — no file over 300 lines
find src/lib/crosslister/connectors src/lib/crosslister/services \
  src/lib/actions/crosslister-accounts.ts src/lib/actions/crosslister-import.ts \
  src/components/crosslister \
  -name "*.ts" -o -name "*.tsx" | \
  xargs wc -l | grep -v total | awk '$1 > 300 { print "OVER 300:", $0 }' || echo "All files under 300 lines"

# 6. Verify connector self-registration
grep -rn "registerConnector" \
  src/lib/crosslister/connectors/poshmark-connector.ts \
  src/lib/crosslister/connectors/mercari-connector.ts || echo "FAIL: Missing self-registration"

# 7. Run the full lint script
./twicely-lint.sh
```

### Expected Outcomes
- TypeScript: 0 errors
- Tests: >= 2788 (2715 baseline + ~73 new)
- No banned terms
- No eBay hardcoding in generic files
- All files under 300 lines
- Both connectors self-register
- Full lint script passes

---

## 8. IMPLEMENTATION ORDER

Execute in this exact sequence:

### Step 1: Stream 0 — Genericize (do FIRST)
1. Create `normalizer-dispatch.ts` (initially with only eBay case + throw for others)
2. Modify `import-service.ts` — replace all `'EBAY'` hardcoding
3. Modify `crosslister-import.ts` — replace all eBay hardcoding
4. Modify `crosslister-accounts.ts` — add generic `connectPlatformAccount`, update `disconnectAccount`/`refreshAccountAuth`
5. Run tests — all existing eBay tests must still pass

### Step 2: Stream A — Poshmark (can parallel with Step 3)
1. Create `poshmark-types.ts`
2. Create `poshmark-normalizer.ts`
3. Create `poshmark-connector.ts`
4. Create `poshmark-normalizer.test.ts`
5. Create `poshmark-connector.test.ts`
6. Update `normalizer-dispatch.ts` to include POSHMARK case

### Step 3: Stream B — Mercari (can parallel with Step 2)
1. Create `mercari-types.ts`
2. Create `mercari-normalizer.ts`
3. Create `mercari-connector.ts`
4. Create `mercari-normalizer.test.ts`
5. Create `mercari-connector.test.ts`
6. Create `src/app/api/crosslister/mercari/callback/route.ts`
7. Update `normalizer-dispatch.ts` to include MERCARI case

### Step 4: UI + Integration
1. Create `connectors/index.ts` barrel
2. Create `session-auth-dialog.tsx`
3. Modify `connect-platform-grid.tsx`
4. Modify `platform-card.tsx`
5. Modify `seed-crosslister.ts`
6. Create `normalizer-dispatch.test.ts`
7. Update existing test files with new tests
8. Run full verification checklist

---

## 9. KEY DIFFERENCES FROM F1

| Aspect | F1 (eBay) | F2 (Poshmark + Mercari) |
|--------|-----------|------------------------|
| Scope | Built everything from scratch | Reuses pipeline, adds 2 connectors + genericizes |
| New pages | 4 pages, 7 components | 0 new pages, 1 new component (session dialog) |
| New actions | 6 new actions | 2 new actions (connectPlatformAccount, authenticateSessionAccount) |
| Pipeline | Built from scratch, hardcoded to eBay | Made generic to support any channel |
| Auth | OAuth only | OAuth (Mercari) + Session (Poshmark) |
| API type | Official REST API (Tier A) | Internal mobile API (Tier C, Poshmark) + Limited API (Tier B, Mercari) |
| Tests | 69 new | ~73 new |
| Total files | 33 (29 new + 4 modified) | 24 (16 new + 8 modified) |

---

## 10. OPEN QUESTIONS (Owner Decision Needed)

1. **Poshmark API stability:** Poshmark's internal API is undocumented and may change without notice. Should we add a circuit breaker threshold to the connector (e.g., 5 consecutive failures -> auto-pause the seller's Poshmark account)?
   - **Recommendation:** Yes, the Lister Canonical Section 9.4 already specifies "3 consecutive failures -> pause" as a safeguard.

2. **Mercari API access:** Does Twicely already have a Mercari developer account/app registered? The OAuth flow requires a registered app with client ID/secret.
   - **If no:** The connector code will work but needs credentials populated in platform_settings before launch.

3. **Cross-platform dedupe on first import:** If a seller imports from eBay first, then imports from Poshmark, the dedupe service will detect duplicates across platforms. Should these auto-link (>=90% confidence) or always flag for seller review?
   - **Current behavior:** Auto-link at >=90%, flag at 70-89%. This is correct per Lister Canonical Section 10.3.
