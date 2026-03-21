# TWICELY V3 — LISTER CANONICAL
## Crosslisting, Scheduling, Imports, Automation, Polling, Dedupe, and Marketplace Orchestration

**Canonical ID:** `canon.twicely_v3.lister.v1.0`
**Status:** LOCKED — single source of truth for all crosslister architecture
**Created:** 2026-02-15
**Vocabulary:** ListerTier (crosslister subscription), StoreTier (storefront subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.

> **Law:** If it isn't in this file, it isn't real. If it conflicts with this file, this file wins.
> **Prime Principle:** UNLIMITED INTENT. CONTROLLED EXECUTION. VERIFIED REALITY.

**Authority references:**
- Pricing, tiers, publish limits, rollover → `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md`
- ListerTier enum, seller profile fields → `TWICELY_V3_USER_MODEL.md`
- CASL permissions, actor types, delegation → `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md`
- Feature flags, platform rollout → `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` §11.3

---

## 1. PHILOSOPHY & NON-NEGOTIABLES

**Twicely is the canonical inventory hub.** Every listing on every platform is a projection of the canonical Twicely listing. External listings are never the source of truth. Twicely always wins.

**You cannot crosslist without a Twicely listing.** Imports create a Twicely listing. Manual creation creates a Twicely listing. There is no "import only to eBay" or "push from Poshmark to Mercari directly." Every flow goes through Twicely's canonical record.

**Unlimited intent, controlled execution.** Sellers queue everything immediately. No artificial caps on what can be queued. The scheduler paces execution safely using rolling 24-hour windows, platform micro-rate limits, and per-seller fairness. The seller never waits at the UI — they wait in the queue, which is invisible.

**Verified reality.** The system never assumes an action succeeded. Webhooks where platforms support them. Adaptive polling where they don't. Every external state is verified. If the scheduler pushed a listing to eBay, the system confirms it appeared on eBay. "Fire and forget" is forbidden.

**Emergency delists outrank everything.** When a sale is detected on any platform, emergency delists on all other platforms jump the queue immediately. Double-selling is the #1 crosslister failure mode. Prevention is the highest priority operation in the entire system.

**No nickel-and-dime.** No per-push credits. Crosslisting is subscription-based (ListerTier controls monthly publishes). Automation is a flat add-on. Overage packs are uniform $9/500. The seller never calculates "will this push cost me a credit?"

**Everything is auditable, idempotent, and replayable.** Every job, every state change, every external API call is logged with timestamps, inputs, outputs, and idempotency keys. Any operation can be replayed safely. Failed operations can be inspected, retried, or cancelled.

**Crosslister works without a store.** A seller can subscribe to Lister Pro, crosslist to 5 platforms, and never have a Store subscription. Crosslister and Store are independent axes. Bundles exist for sellers who want both, but they're never required.

**Imports are sacred.** The free one-time import per marketplace is Twicely's supply flywheel and user acquisition strategy. Imported items go ACTIVE immediately, bypass listing caps, are NEVER charged insertion fees, and are never gated behind subscription tiers.

---

## 2. STRATEGIC CONTEXT

The crosslister is not just a feature — it's Twicely's primary growth engine.

**The flywheel:**
1. Reseller imports listings from eBay/Poshmark/Mercari → free, zero friction
2. Imports create canonical Twicely listings → Twicely marketplace gets supply automatically
3. Seller sees Twicely working, inventory already there → subscribes to crosslister to manage distribution
4. Crosslister revenue (subscriptions) flows while marketplace revenue (TF) grows
5. Every crosslister user automatically populates Twicely's marketplace as a side effect

**The funnel:** Importer → Marketplace → Crosslister → Storefront

Each stage feeds the next. The crosslister is the trojan horse for marketplace supply growth. Sellers don't think "I'm listing on Twicely" — they think "I'm using my crosslisting tool." Twicely inventory grows organically.

---

## 3. CANONICAL OWNERSHIP MODEL

External listings are projections of the canonical Twicely listing. Canonical state always wins.

```
┌──────────────────────────────────────────────────┐
│                 TWICELY (Canonical)               │
│                                                    │
│  Listing #4821                                     │
│  Title: "Vintage Levi's 501 Raw Denim 32x34"     │
│  Price: $89.00                                     │
│  Quantity: 1                                       │
│  Status: ACTIVE                                    │
│  Photos: 8 originals in R2                        │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ eBay     │  │ Poshmark │  │ Mercari  │        │
│  │ Proj.    │  │ Proj.    │  │ Proj.    │        │
│  │          │  │          │  │          │        │
│  │ extId:   │  │ extId:   │  │ extId:   │        │
│  │ 2849103  │  │ pm_8821  │  │ m_44210  │        │
│  │ status:  │  │ status:  │  │ status:  │        │
│  │ ACTIVE   │  │ ACTIVE   │  │ QUEUED   │        │
│  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────┘
```

**Rules:**
- One canonical listing → many channel projections
- Each projection tracks: externalListingId, channel, status, overrides, lastVerifiedAt
- Price/title/description changes on Twicely propagate to all projections (if auto-sync enabled)
- External changes detected via polling/webhooks become "diffs" — seller reviews and accepts or rejects
- If two-way sync is enabled per field group, external changes auto-merge into canonical (seller opt-in per field group)
- Canonical listing deletion cascades to all projections (delist from all platforms)

---

## 4. ARCHITECTURE OVERVIEW

### 4.1 V3 Tech Stack Integration

| Component | Technology | Role in Lister |
|-----------|-----------|----------------|
| Database | PostgreSQL + Drizzle ORM | Canonical listings, projections, jobs, metrics |
| Job Queue | Valkey + BullMQ | Scheduler, import pipeline, polling, emergency delists |
| File Storage | Cloudflare R2 | Original images, per-channel image variants |
| Search | Typesense | Listing search, dedupe candidate matching |
| Real-Time | Centrifugo | Job status updates, sale notifications, import progress |
| Auth | Better Auth + CASL | Seller permissions, delegation scopes, connector auth |
| Monitoring | Grafana + Prometheus + Loki | Job metrics, connector health, scheduler throughput |

### 4.2 High-Level Architecture

```
                           ┌─────────────┐
                           │   Seller UI  │
                           │  (Next.js)   │
                           └──────┬───────┘
                                  │
                           ┌──────▼───────┐
                           │  API Routes   │
                           │  /api/lister  │
                           └──────┬───────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
       ┌──────▼──────┐   ┌──────▼──────┐   ┌───────▼──────┐
       │   Import    │   │  Crosslist  │   │  Automation  │
       │  Pipeline   │   │   Engine    │   │   Engine     │
       └──────┬──────┘   └──────┬──────┘   └───────┬──────┘
              │                  │                   │
              └──────────┬──────┴───────────────────┘
                         │
                  ┌──────▼──────┐
                  │  Scheduler  │         ┌──────────────┐
                  │  (BullMQ)   │◄───────►│   Connector  │
                  │             │         │   Framework  │
                  └──────┬──────┘         └──────┬───────┘
                         │                       │
              ┌──────────┼───────────┬───────────┤
              │          │           │           │
         ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐
         │  eBay  │ │ Posh   │ │Mercari │ │ Depop  │
         │Connect.│ │Connect.│ │Connect.│ │Connect.│
         └────────┘ └────────┘ └────────┘ └────────┘
```

### 4.3 BullMQ Queue Architecture

| Queue | Priority | Purpose | Concurrency |
|-------|----------|---------|-------------|
| `lister:emergency-delist` | CRITICAL | Sale detected → delist all other platforms | 50 |
| `lister:verification` | HIGH | Confirm external state matches expected | 20 |
| `lister:import` | MEDIUM | Inbound imports from external platforms | 10 |
| `lister:publish` | MEDIUM | Outbound publishes to external platforms | 10 |
| `lister:sync` | LOW | Price/quantity/description sync updates | 10 |
| `lister:polling` | LOW | Adaptive polling for state verification | 20 |
| `lister:automation` | LOW | Auto-relist, offers, sharing, price drops | 10 |
| `lister:metrics` | LOWEST | Analytics rollup, daily aggregation | 5 |

**Priority order (scheduler always respects):** Emergency Delist > Verification > Import = Publish > Sync > Polling > Automation > Metrics

---

## 5. DOMAIN OBJECTS (Drizzle Schema Sketches)

### 5.1 CrosslisterAccount (Channel Connection)

```typescript
export const crosslisterAccounts = pgTable('crosslister_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),

  // Channel identity
  channel: channelEnum('channel').notNull(),           // EBAY, POSHMARK, MERCARI, DEPOP, FB_MARKETPLACE, ETSY, GRAILED, THEREALREAL
  externalAccountId: text('external_account_id'),       // Platform's user/account ID
  externalUsername: text('external_username'),           // Display name on platform

  // Auth
  authMethod: authMethodEnum('auth_method').notNull(),  // OAUTH, API_KEY, SESSION
  accessToken: text('access_token'),                    // Encrypted at rest
  refreshToken: text('refresh_token'),                  // Encrypted at rest
  sessionData: jsonb('session_data'),                   // For Tier C (session automation) — encrypted
  tokenExpiresAt: timestamp('token_expires_at'),
  lastAuthAt: timestamp('last_auth_at'),

  // Status
  status: accountStatusEnum('status').notNull().default('ACTIVE'),  // ACTIVE, PAUSED, REVOKED, ERROR, REAUTHENTICATION_REQUIRED
  lastSyncAt: timestamp('last_sync_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastError: text('last_error'),
  consecutiveErrors: integer('consecutive_errors').default(0),

  // Capabilities (declared by connector at auth time)
  capabilities: jsonb('capabilities').notNull().default('{}'),
  // e.g. { canImport: true, canPublish: true, canDelist: true, hasWebhooks: true, canAutoRelist: false }

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5.2 ChannelProjection (Per-Platform External Listing State)

```typescript
export const channelProjections = pgTable('channel_projections', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  accountId: uuid('account_id').notNull().references(() => crosslisterAccounts.id),

  // External identity
  channel: channelEnum('channel').notNull(),
  externalListingId: text('external_listing_id'),       // Set after successful publish
  externalUrl: text('external_url'),

  // Status lifecycle
  status: projectionStatusEnum('status').notNull().default('DRAFT'),
  // DRAFT → QUEUED → PUBLISHING → ACTIVE → SOLD → ENDED → DELISTED → ERROR → FAILED
  lastPublishedAt: timestamp('last_published_at'),
  lastVerifiedAt: timestamp('last_verified_at'),
  lastDelistedAt: timestamp('last_delisted_at'),

  // Per-channel overrides (seller can customize per platform)
  titleOverride: text('title_override'),
  descriptionOverride: text('description_override'),
  priceOverride: integer('price_override'),              // In cents
  categoryOverride: jsonb('category_override'),          // Platform-specific category mapping
  shippingOverride: jsonb('shipping_override'),           // Platform-specific shipping config
  itemSpecificsOverride: jsonb('item_specifics_override'),// Platform-required attributes

  // Sync tracking
  syncEnabled: boolean('sync_enabled').default(true),
  lastCanonicalHash: text('last_canonical_hash'),        // Hash of canonical data at last sync
  hasPendingSync: boolean('has_pending_sync').default(false),
  externalDiff: jsonb('external_diff'),                  // Changes detected on platform not yet accepted

  // Publish attempt tracking
  publishAttempts: integer('publish_attempts').default(0),
  lastPublishError: text('last_publish_error'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjection: unique().on(table.listingId, table.accountId, table.channel),
}));
```

### 5.3 CrossJob (Queued Work Item)

```typescript
export const crossJobs = pgTable('cross_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  projectionId: uuid('projection_id').references(() => channelProjections.id),
  accountId: uuid('account_id').references(() => crosslisterAccounts.id),

  // Job identity
  jobType: jobTypeEnum('job_type').notNull(),
  // IMPORT, PUBLISH, SYNC, DELIST, EMERGENCY_DELIST, VERIFY, POLL, AUTO_RELIST,
  // AUTO_OFFER, AUTO_SHARE, AUTO_PRICE_DROP, REFRESH_LISTING, BULK_IMPORT
  priority: integer('priority').notNull().default(500),  // 0 = highest, 999 = lowest

  // Idempotency
  idempotencyKey: text('idempotency_key').notNull().unique(),

  // Execution
  status: jobStatusEnum('status').notNull().default('PENDING'),
  // PENDING → SCHEDULED → RUNNING → COMPLETED → FAILED → DEAD_LETTERED → CANCELLED
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  lastError: text('last_error'),

  // Payload
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),

  // BullMQ reference
  bullmqJobId: text('bullmq_job_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5.4 ImportBatch (Bulk Import Tracking)

```typescript
export const importBatches = pgTable('import_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  accountId: uuid('account_id').notNull().references(() => crosslisterAccounts.id),

  channel: channelEnum('channel').notNull(),
  status: importStatusEnum('status').notNull().default('PENDING'),
  // PENDING → FETCHING → NORMALIZING → DEDUPLICATING → CREATING → COMPLETED → FAILED → PARTIAL

  // Counts
  totalItems: integer('total_items').default(0),
  processedItems: integer('processed_items').default(0),
  createdItems: integer('created_items').default(0),
  deduplicatedItems: integer('deduplicated_items').default(0),
  failedItems: integer('failed_items').default(0),
  skippedItems: integer('skipped_items').default(0),

  // Import metadata
  isFirstImport: boolean('is_first_import').notNull(),    // Free one-time import?
  batchSize: integer('batch_size').default(50),           // Items per API pull
  errors: jsonb('errors').default('[]'),                   // Per-item error log

  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 5.5 MergeRecord (Manual Merge + Undo)

```typescript
export const mergeRecords = pgTable('merge_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),

  // Merge details
  primaryListingId: uuid('primary_listing_id').notNull().references(() => listings.id),
  mergedListingId: uuid('merged_listing_id').notNull().references(() => listings.id),

  // Snapshot for undo
  beforeState: jsonb('before_state').notNull(),          // Full snapshot of both listings + projections
  afterState: jsonb('after_state').notNull(),

  // Status
  status: mergeStatusEnum('status').notNull().default('ACTIVE'),  // ACTIVE, UNDONE
  undoneAt: timestamp('undone_at'),
  undoExpiresAt: timestamp('undo_expires_at').notNull(), // 30-day undo window

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 5.6 PolicyRule (Per-Channel Compliance)

```typescript
export const policyRules = pgTable('policy_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  channel: channelEnum('channel').notNull(),
  categoryPath: text('category_path'),                   // Null = applies to all categories

  // Rule definition
  ruleType: ruleTypeEnum('rule_type').notNull(),         // REQUIRED_FIELD, MAX_LENGTH, ALLOWED_VALUES, FORBIDDEN_CONTENT, IMAGE_SPEC
  field: text('field').notNull(),                        // e.g. 'title', 'description', 'images', 'itemSpecifics.brand'
  constraint: jsonb('constraint').notNull(),             // e.g. { maxLength: 80 } or { required: true } or { allowedValues: [...] }
  guidance: text('guidance'),                            // Human-readable fix instruction
  severity: severityEnum('severity').notNull(),          // BLOCK (cannot publish) or WARN (publish with flag)

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 5.7 Drizzle Enums

```typescript
export const channelEnum = pgEnum('channel', [
  'TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP',
  'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL',
]);

export const accountStatusEnum = pgEnum('crosslister_account_status', [
  'ACTIVE', 'PAUSED', 'REVOKED', 'ERROR', 'REAUTHENTICATION_REQUIRED',
]);

export const projectionStatusEnum = pgEnum('projection_status', [
  'DRAFT', 'QUEUED', 'PUBLISHING', 'ACTIVE', 'SOLD', 'ENDED', 'DELISTED', 'ERROR', 'FAILED',
]);

export const jobTypeEnum = pgEnum('cross_job_type', [
  'IMPORT', 'PUBLISH', 'SYNC', 'DELIST', 'EMERGENCY_DELIST', 'VERIFY', 'POLL',
  'AUTO_RELIST', 'AUTO_OFFER', 'AUTO_SHARE', 'AUTO_PRICE_DROP', 'REFRESH_LISTING', 'BULK_IMPORT',
]);

export const jobStatusEnum = pgEnum('cross_job_status', [
  'PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED',
]);

export const authMethodEnum = pgEnum('auth_method', ['OAUTH', 'API_KEY', 'SESSION']);

export const connectorTierEnum = pgEnum('connector_tier', ['A', 'B', 'C']);

export const importStatusEnum = pgEnum('import_status', [
  'PENDING', 'FETCHING', 'NORMALIZING', 'DEDUPLICATING', 'CREATING', 'COMPLETED', 'FAILED', 'PARTIAL',
]);

export const mergeStatusEnum = pgEnum('merge_status', ['ACTIVE', 'UNDONE']);

export const ruleTypeEnum = pgEnum('policy_rule_type', [
  'REQUIRED_FIELD', 'MAX_LENGTH', 'ALLOWED_VALUES', 'FORBIDDEN_CONTENT', 'IMAGE_SPEC',
]);

export const severityEnum = pgEnum('policy_severity', ['BLOCK', 'WARN']);

export const pollTierEnum = pgEnum('poll_tier', ['HOT', 'WARM', 'COLD', 'LONGTAIL']);
```

---

## 6. IMPORT PIPELINE

### 6.1 Free One-Time Import (Supply Flywheel)

| Parameter | Value |
|-----------|-------|
| Cost | FREE — no charge, no insertion fees on imported items |
| Limit | ONE import per external marketplace per account |
| Item limit | No limit on number of items per import |
| Listing state | Imported listings go ACTIVE on Twicely immediately |
| Rate limiting | Imports run through scheduler at MEDIUM priority; batched at 50 items per API pull |
| Validation | Items must have: title, 1+ photo, price, active status on source. Failed items → "Import Issues" queue |
| Abuse prevention | One-time per marketplace per account. Flagged if account age < 24 hours. Rate limited per scheduler |
| Re-import | Pulling new items added since first import requires Crosslister Lite+ |

### 6.2 Import Pipeline Stages

```
External Platform API
        │
        ▼
┌─────────────────┐
│  1. INGEST       │  Fetch paginated listings from external platform
│     (Connector)  │  50 items per batch, respect platform rate limits
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. NORMALIZE    │  Map external fields → Twicely canonical schema
│     (Transform)  │  Normalize title, description, price, images, category
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. DEDUPE       │  Fingerprint each item (see §10)
│     (Matching)   │  Strong match → auto-link to existing canonical
│                  │  Weak match → flag for manual review
│                  │  No match → create new canonical listing
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. CREATE       │  Create/link canonical Twicely listing
│     (Canonical)  │  Status = ACTIVE (not draft)
│                  │  Create ChannelProjection linking back to source
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. VERIFY       │  Queue verification job to confirm import accuracy
│     (Scheduler)  │  Compare imported data vs external source
└─────────────────┘
```

**Import always creates/links a Twicely listing.** There is no "import only" mode. No "import to drafts." Imports go ACTIVE on Twicely.

### 6.3 Import Progress (Real-Time via Centrifugo)

During import, the seller sees live progress via WebSocket:

```
Channel: private-user.{sellerId}
Event: import.progress

Payload:
{
  batchId: "uuid",
  channel: "EBAY",
  total: 487,
  processed: 231,
  created: 218,
  deduplicated: 8,
  failed: 5,
  status: "CREATING",
  estimatedMinutesRemaining: 12
}
```

Progress bar in UI updates in real-time. Failed items are collected and shown in "Import Issues" queue after completion with specific fix instructions per item.

### 6.4 Import vs Insertion Fee Interaction

Imported items are ALWAYS exempt from insertion fees. A seller who imports 600 items pays $0 in insertion fees. If they then manually create 300 more listings (with 250 free allowance), they pay insertion fees on the 50 over their limit.

The monthly free listing allowance counts ONLY manually created new listings. Imports exist in a separate, ungated lane.

---

## 7. CROSSLISTING (DISTRIBUTION)

### 7.1 What Is a Publish?

A publish is pushing a Twicely listing to ONE external marketplace. This is the ONLY action that consumes a publish.

| Action | Publish Cost | Why |
|--------|-------------|-----|
| Create listing on Twicely | 0 | Home platform — never a publish |
| Import from external platform to Twicely | 0 | Import is free |
| Push Twicely listing → eBay | 1 | Outbound to external platform |
| Push Twicely listing → Poshmark | 1 | Outbound to external platform |
| Push same listing → eBay + Poshmark + Mercari | 3 | 1 per destination |
| Update synced listing (price/qty change) | 0 | Sync is not a publish |
| Auto-relist on external platform | 0 | Relist is automation, not new publish |
| Auto-delist on external platform | 0 | Delist is protective, never metered |

**Rule:** Syncs, relists, and delists NEVER count as publishes. A publish is the initial act of creating a listing on an external platform. Everything after is maintenance.

### 7.2 Publish Flow

```
Seller selects listings + target platforms
        │
        ▼
┌─────────────────┐
│  1. VALIDATE     │  Policy engine checks per-platform requirements
│     (Policy)     │  Result: ALLOW / DENY / REQUIRE_FIELDS / REQUIRE_CHANGES
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. TRANSFORM    │  Map canonical → platform format
│     (Transform)  │  Title truncation, description conversion, image resize
│                  │  Category mapping, item specifics injection
│                  │  Apply per-platform overrides if set
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. METER        │  Check publish allowance (ListerTier monthly limit)
│     (Billing)    │  Sufficient publishes? → proceed
│                  │  Insufficient? → block with upgrade prompt
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. QUEUE        │  Create CrossJob with idempotency key
│     (Scheduler)  │  Queue for execution per scheduler rules
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. EXECUTE      │  Connector pushes to platform API
│     (Connector)  │  On success: set projection status = ACTIVE
│                  │  On failure: retry with backoff (max 3 attempts)
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. VERIFY       │  Queue verification job
│     (Scheduler)  │  Confirm listing appeared on platform
│                  │  Compare published data vs expected
└─────────────────┘
```

### 7.3 Publish Limits by ListerTier

| Tier | Publishes/Month | Rollover |
|------|----------------|----------|
| Lister Free | 25 | None |
| Lister Lite | 200 | 60 days, max 600 |
| Lister Pro | 2,000 | 60 days, max 6,000 |

Rollover max stockpile: 3× monthly plan allotment. Rollover expires FIFO. On downgrade: excess rollover forfeited to new tier's max.

See `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` §6 for full pricing and feature matrix.

### 7.4 Per-Platform Overrides

Sellers can customize per platform without changing the canonical listing:

- **Title override** — platform-specific title (eBay 80-char limit, Poshmark style)
- **Description override** — platform-specific description (HTML for eBay, text for Poshmark)
- **Price override** — different price per platform (account for different fee structures)
- **Category override** — platform-specific category mapping
- **Shipping override** — platform-specific shipping settings/profiles
- **Item specifics override** — eBay-required structured attributes per category

Overrides are stored on the ChannelProjection. If no override is set, the canonical value is used and transformed automatically.

---

## 8. SCHEDULER

### 8.1 Core Principles

The scheduler is the single execution gateway for all outbound operations. Nothing touches an external platform API without going through the scheduler.

- **Rolling 24-hour pacing window.** Each seller's jobs are spread across a 24-hour window to avoid burst patterns that trigger platform detection.
- **Platform micro-rate limits.** Per-platform rate limits respected at all times. eBay: their published API limits. Poshmark: conservative session limits. Mercari: API limits.
- **Per-seller fairness.** No single seller can monopolize queue capacity. Fair-share scheduling ensures 1,000 sellers with 50 items each get equivalent throughput.
- **Tier weighting.** Higher ListerTier subscribers get priority weighting within the fairness algorithm. Enterprise sellers process faster than Free tier. But fairness still applies — a Power seller can't starve a Free seller entirely.

### 8.2 Priority Order (Absolute)

```
EMERGENCY_DELIST (priority 0)    ← sale detected, prevent double-sell
    │
VERIFICATION (priority 100)      ← confirm external state
    │
IMPORT (priority 300)            ← inbound from external
PUBLISH (priority 300)           ← outbound to external
    │
SYNC (priority 500)              ← price/qty/desc updates
    │
POLLING (priority 600)           ← adaptive state check
    │
AUTOMATION (priority 700)        ← auto-relist, offers, sharing
    │
METRICS (priority 900)           ← analytics rollup
```

Emergency delists ALWAYS preempt. A delist in progress cannot be interrupted, but a delist in queue jumps ahead of everything else.

### 8.3 Rate Limiting Per Platform

| Platform | API Rate Limit | Scheduler Pacing | Notes |
|----------|---------------|-------------------|-------|
| eBay | Published API limits (5,000/day typical) | 200 calls/hour/seller | Well-documented REST API |
| Poshmark | No official API — session limits | 60 actions/hour/seller | Conservative to avoid detection |
| Mercari | API limits (varies) | 150 calls/hour/seller | API stability varies |
| Depop | API limits | 150 calls/hour/seller | REST API |
| FB Marketplace | Graph API limits | 100 calls/hour/seller | Most restrictive |
| Etsy | Published API limits | 200 calls/hour/seller | Well-documented REST API |

These are initial values. The scheduler tracks error rates and adjusts dynamically. If a platform starts returning 429s, the scheduler backs off automatically per platform, per seller.

### 8.4 Scheduling Algorithm

```
Every 5 seconds:
  1. Pull next batch of PENDING jobs from each queue (ordered by priority, then scheduledFor)
  2. For each job:
     a. Check platform rate limit bucket → if exhausted, skip
     b. Check seller fairness quota → if exhausted, skip
     c. Check connector health → if circuit-breaker open, skip
     d. Dispatch to connector for execution
  3. Update rate limit buckets
  4. Emit metrics to Prometheus
```

### 8.5 Burst Protection

When a seller queues 500 items × 3 platforms (1,500 publishes), the scheduler:
1. Accepts all 1,500 jobs immediately (unlimited intent)
2. Spreads execution across the rolling 24-hour window
3. Prioritizes based on seller's tier weighting
4. Shows real-time progress via Centrifugo (e.g., "412/1,500 published")
5. Seller can cancel remaining queued jobs at any time

---

## 9. CONNECTOR FRAMEWORK

### 9.1 Connector Tiers

| Tier | Auth Method | Description | Platforms |
|------|------------|-------------|-----------|
| **Tier A: API-First** | OAuth / API Key | Full REST API, webhooks available, structured data | eBay, Etsy |
| **Tier B: API-Limited** | OAuth / API Key | API exists but incomplete — no webhooks, limited endpoints | Mercari, Depop, Grailed |
| **Tier C: Session Automation** | Session cookies | No API — browser session automation required | Poshmark, TheRealReal |

### 9.2 Connector Interface

Every connector implements a standard interface regardless of tier:

```typescript
interface PlatformConnector {
  // Identity
  readonly channel: Channel;
  readonly tier: 'A' | 'B' | 'C';
  readonly version: string;

  // Declared capabilities (set at auth time)
  readonly capabilities: ConnectorCapabilities;

  // Auth
  authenticate(credentials: AuthInput): Promise<AuthResult>;
  refreshAuth(account: CrosslisterAccount): Promise<AuthResult>;
  revokeAuth(account: CrosslisterAccount): Promise<void>;

  // Import
  fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings>;
  fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing>;

  // Publish
  createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult>;
  updateListing(account: CrosslisterAccount, externalId: string, changes: Partial<TransformedListing>): Promise<UpdateResult>;
  delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult>;

  // Verification
  verifyListing(account: CrosslisterAccount, externalId: string): Promise<VerificationResult>;

  // Webhooks (Tier A only)
  registerWebhook?(account: CrosslisterAccount, events: string[]): Promise<WebhookRegistration>;
  handleWebhook?(payload: unknown): Promise<WebhookEvent>;

  // Health
  healthCheck(account: CrosslisterAccount): Promise<HealthResult>;
}

interface ConnectorCapabilities {
  canImport: boolean;
  canPublish: boolean;
  canUpdate: boolean;
  canDelist: boolean;
  hasWebhooks: boolean;
  hasStructuredCategories: boolean;
  canAutoRelist: boolean;
  canMakeOffers: boolean;
  canShare: boolean;             // Poshmark-specific
  maxImagesPerListing: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  supportedImageFormats: string[];
}
```

### 9.3 Connector Versioning

Connectors are versioned independently. When a platform changes their API:
1. New connector version is built
2. Canary deployment: 1% of traffic uses new version
3. Error rates compared against baseline
4. If clean: full rollout. If degraded: automatic rollback.
5. Old version remains available for emergency rollback.

Canary detection runs automatically. If a platform pushes a breaking change, the system detects it via increased error rates within minutes and alerts ops.

### 9.4 Tier C: Session Automation (Poshmark, TheRealReal)

Tier C connectors use headless browser sessions because the platform has no API. This carries inherent risk.

**Safeguards:**
- Session isolation: each seller's session runs in its own sandbox
- Randomized timing: actions have human-like random delays (2-8 seconds between actions)
- Conservative rate limits: significantly lower than API platforms
- Kill-switch: per-platform, per-seller, global — can be triggered instantly
- Circuit breaker: 3 consecutive failures → pause seller's account for that platform
- Risk acknowledgment: seller must accept ToS warning before enabling Tier C automation

**Session management:**
- Sessions stored encrypted in database
- Session refresh happens automatically before expiry
- If session is invalidated (platform forces logout), status → REAUTHENTICATION_REQUIRED
- Seller notified via Centrifugo + email/push to re-authenticate

---

## 10. DEDUPE & FINGERPRINTING

### 10.1 Why Dedupe Matters

A seller importing from eBay and Poshmark likely has the same item listed on both. Without dedupe, the import creates two canonical Twicely listings for one item. This leads to: double inventory, confusing analytics, and double-sell risk.

### 10.2 Fingerprint Generation

Every imported item gets a fingerprint composed of multiple signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Image perceptual hash | 40% | pHash of primary image — tolerant of crops, watermarks |
| Normalized title | 20% | Lowercased, stopwords removed, brand normalized |
| SKU / UPC / MPN | 30% (if present) | Exact match on any product identifier |
| Category + price band | 10% | Same category family + price within 20% |

### 10.3 Match Tiers

| Score | Action | Description |
|-------|--------|-------------|
| 90-100% | Auto-link | Strong match — automatically link to existing canonical listing |
| 70-89% | Flag for review | Weak match — show seller side-by-side comparison |
| 0-69% | Create new | No meaningful match — create new canonical listing |

Auto-linked items: the existing canonical listing gains a new ChannelProjection for the imported platform. No duplicate created.

Flagged items go to the "Possible Duplicates" queue where the seller sees both items side-by-side and can: merge them (choose primary), dismiss (they're different items), or undo a previous auto-link.

### 10.4 Fingerprint Index

Fingerprints are stored in a dedicated index for fast matching during import. Image hashes use a Hamming distance lookup. Text fingerprints use Typesense fuzzy matching. SKU/UPC matches are exact.

---

## 11. MANUAL MERGE + UNDO

When the dedupe pipeline misses a match (or the seller wants to consolidate), manual merge is available.

### 11.1 Merge Flow

1. Seller selects two listings they believe are the same item
2. System shows side-by-side comparison of all fields
3. Seller chooses the primary listing (which one keeps its listing ID)
4. System merges:
   - All ChannelProjections from merged listing → primary listing
   - Photos combined (deduped by image hash)
   - Best field values suggested (seller confirms)
5. Merged listing is soft-deleted (hidden, not destroyed)
6. MergeRecord created with full before/after snapshot

### 11.2 Safe Locks During Merge

During merge, both listings are temporarily locked:
- No new sales can process (held for ~30 seconds max)
- No syncs or publishes execute
- If a sale arrives during merge → merge is aborted, sale processed, seller notified

### 11.3 Undo

- Undo window: 30 days from merge
- Undo restores both listings to pre-merge state
- All ChannelProjections moved back to their original listings
- MergeRecord.status → UNDONE
- After 30 days: merged listing permanently deleted, undo no longer available

---

## 12. SALE DETECTION & EMERGENCY DELISTS

### 12.1 Detection Methods

| Method | Latency | Platforms |
|--------|---------|-----------|
| Webhooks | Seconds | eBay, Etsy |
| Adaptive polling (HOT tier) | 1-3 minutes | Poshmark, Mercari, Depop |
| Adaptive polling (WARM tier) | 5-15 minutes | Lower activity listings |

### 12.2 Emergency Delist Flow

```
Sale detected on Platform A
        │
        ▼
┌─────────────────────────────────┐
│  1. Mark canonical listing      │
│     status = SOLD               │
│     soldOnChannel = A           │
│     soldAt = now()              │
└────────┬────────────────────────┘
         ▼
┌─────────────────────────────────┐
│  2. For EVERY other projection  │
│     where status = ACTIVE:      │
│     → Create EMERGENCY_DELIST   │
│     → Priority = 0 (highest)    │
│     → Jump queue immediately    │
└────────┬────────────────────────┘
         ▼
┌─────────────────────────────────┐
│  3. Execute delists             │
│     API platforms: immediate    │
│     Session platforms: ASAP     │
│     (within seconds to minutes) │
└────────┬────────────────────────┘
         ▼
┌─────────────────────────────────┐
│  4. Verify delists              │
│     Confirm each platform shows │
│     listing as ended/removed    │
└────────┬────────────────────────┘
         ▼
┌─────────────────────────────────┐
│  5. Notify seller               │
│     Via Centrifugo (real-time)  │
│     + push notification         │
│     "Sold on eBay! Delisted     │
│      from Poshmark + Mercari"   │
└─────────────────────────────────┘
```

### 12.3 Double-Sell Mitigation

If a second sale arrives before delists complete:
1. Both sales are flagged as POTENTIAL_DOUBLE_SELL
2. Seller notified immediately with clear instructions
3. Seller must cancel one sale manually (Twicely cannot auto-cancel on external platforms)
4. System tracks double-sell rate per seller and per platform for quality metrics
5. If double-sell rate exceeds threshold → seller's polling tier automatically elevated to HOT

### 12.4 Delist Targets

| Platform Type | Target Delist Latency |
|--------------|-----------------------|
| Tier A (API + webhooks) | < 10 seconds |
| Tier B (API, no webhooks) | < 3 minutes |
| Tier C (session automation) | < 5 minutes |

These are targets. The system monitors actual latency and alerts if degraded.

---

## 13. ADAPTIVE POLLING ENGINE

### 13.1 Why Polling Exists

APIs and webhooks are incomplete. Not every platform supports webhooks. Not every event triggers a webhook. Some webhooks are unreliable. Polling exists to verify reality for platforms where webhooks don't exist or can't be trusted.

### 13.2 Polling Tiers

| Tier | Interval | Criteria | Budget |
|------|----------|----------|--------|
| **HOT** | 1-3 min | Active listing, recent sale/offer/watcher activity, high-value item | Highest |
| **WARM** | 5-15 min | Active listing, some recent activity | Medium |
| **COLD** | 30-60 min | Active listing, no recent activity | Low |
| **LONGTAIL** | 2-6 hours | Listing active 30+ days with zero activity | Minimal |

### 13.3 Tier Promotion/Demotion

Listings move between polling tiers based on:

| Signal | Effect |
|--------|--------|
| Watcher/like added | Promote to HOT for 1 hour |
| Offer received | Promote to HOT for 2 hours |
| Price changed by seller | Promote to WARM for 30 min |
| Sale detected on ANY platform | All projections → HOT until delisted |
| No activity for 7 days | Demote to COLD |
| No activity for 30 days | Demote to LONGTAIL |

### 13.4 Cost-Aware Budget

Polling has a budget per platform per seller:
- Each poll consumes API quota (Tier A/B) or session time (Tier C)
- Budget allocated based on ListerTier (higher tier = more polling budget)
- If budget exhausted, only HOT items continue polling; WARM/COLD/LONGTAIL pause until next budget window
- Enterprise tier: unlimited polling budget

### 13.5 Webhook Supplement

For platforms with webhooks (eBay, Etsy), polling is supplementary — not primary. Webhooks handle the realtime signal. Polling runs at COLD/LONGTAIL intervals as a safety net to catch any webhooks that were missed.

---

## 14. TWO-WAY SYNC & CONFLICT RESOLUTION

### 14.1 Sync Direction

| Direction | Description | Trigger |
|-----------|-------------|---------|
| Canonical → External | Twicely change propagates to all projections | Seller edits on Twicely |
| External → Canonical | External change detected, pending seller review | Polling/webhook detects change |

### 14.2 Canonical → External (Outbound Sync)

When a seller edits their listing on Twicely:
1. Canonical listing updated
2. System computes hash of new canonical data
3. Compares against each projection's `lastCanonicalHash`
4. For projections where sync is enabled and hash differs → queue SYNC job
5. SYNC job transforms canonical data to platform format and pushes update
6. Syncs do NOT count as publishes

### 14.3 External → Canonical (Inbound Sync)

When polling/webhook detects a change on an external platform:
1. Change recorded as `externalDiff` on the ChannelProjection
2. If two-way auto-sync is DISABLED (default): seller sees "External Change Detected" notification with diff view
3. If two-way auto-sync is ENABLED (per field group): change auto-merges into canonical
4. Conflicts (both canonical and external changed same field): flagged for manual resolution

### 14.4 Field Groups for Two-Way Sync

Sellers opt into two-way sync per field group, not per field:

| Field Group | Fields | Default |
|-------------|--------|---------|
| Pricing | price, shippingPrice | OFF (canonical wins) |
| Description | title, description | OFF (canonical wins) |
| Inventory | quantity, status | OFF (canonical wins) |
| Images | photos | OFF (canonical wins) |

Most sellers should leave two-way sync OFF. Canonical Twicely listing is the source of truth. Two-way sync is for advanced sellers who make platform-specific edits directly on that platform and want them reflected back.

---

## 15. POLICY & TRANSFORM ENGINE

### 15.1 Policy Engine

Before any publish or sync, the policy engine validates the listing against the target platform's requirements.

**Output:**

| Result | Description | Action |
|--------|-------------|--------|
| ALLOW | All requirements met | Proceed to publish |
| DENY | Critical requirement violated | Block publish, show error |
| REQUIRE_FIELDS | Missing fields that platform requires | Show seller which fields to fill |
| REQUIRE_CHANGES | Fields need modification (too long, wrong format) | Show seller what to change with guidance |

**Example policy rules:**
- eBay: title max 80 chars → if over, REQUIRE_CHANGES with suggested truncation
- Poshmark: min 1 cover photo → if missing, DENY
- eBay: item specifics required per category → if missing, REQUIRE_FIELDS with list
- Mercari: no external links in description → if found, REQUIRE_CHANGES

### 15.2 Transform Engine

Transforms canonical listing data to platform-specific format:

| Transform | Description |
|-----------|-------------|
| Title truncation | Shorten to platform max, preserving keywords |
| Description conversion | HTML → text (Poshmark), text → HTML (eBay) |
| Image resize/crop | Meet platform image specs (dimensions, file size, format) |
| Category mapping | Map Twicely canonical category → platform-native category tree |
| Item specifics injection | Add platform-required structured attributes from canonical data |
| Shipping mapping | Map Twicely shipping profile → platform shipping settings |
| Price adjustment | Apply platform-specific pricing rules if seller has price overrides |

### 15.3 Category Mapping

Twicely maintains a canonical category tree. Each platform has its own category tree. A mapping table connects them.

```
Twicely: Clothing > Men > Jeans > Straight Leg
    ↓ maps to ↓
eBay: Clothing, Shoes & Accessories > Men > Men's Clothing > Jeans > Straight
Poshmark: Men > Jeans > Straight Leg
Mercari: Men > Clothing > Jeans
```

Mappings are maintained by platform admins. AI-assisted category suggestion is free (0 AI credits) and helps sellers pick the right Twicely category, which auto-maps to all platforms.

---

## 16. POSHMARK: 3 AUTOMATION MODES

Poshmark has no official API. All interactions require session automation (Tier C connector). This carries inherent risk because Poshmark explicitly bans automation. We provide 3 modes with escalating risk and capability.

### 16.1 Mode 1: Safe (Recommendations Only)

| Feature | Description |
|---------|-------------|
| Cost | Free (included in any ListerTier) |
| Risk | Zero — no automated actions taken |
| What it does | Analyzes listing performance, suggests actions, shows best times to share |
| What it doesn't do | Never touches Poshmark automatically |

Seller sees: "Share this listing — best time is 2pm EST (your highest engagement window)." Seller manually shares.

### 16.2 Mode 2: Assisted (Human-Confirmed)

| Feature | Description |
|---------|-------------|
| Cost | Requires Automation add-on ($9.99/month) |
| Risk | Low — seller confirms every batch before execution |
| What it does | Prepares action batches, seller reviews and approves |
| What it doesn't do | Never acts without explicit seller approval per batch |

Seller sees: "Ready to share 45 listings to 'Best in Jeans' party. [Approve] [Skip]." On approve, the system executes with human-like pacing.

### 16.3 Mode 3: Full Automation

| Feature | Description |
|---------|-------------|
| Cost | Requires Automation add-on ($9.99/month) |
| Risk | Elevated — automated actions on a platform that bans automation |
| Requirements | Explicit risk acknowledgment, ToS acceptance |
| Kill-switch | Per-seller + global — instant pause |

**Actions available in Mode 3:**
- Closet shares (share own listings to followers)
- Community shares (share to parties)
- Offer to likers (send offers to users who liked listings)
- Follow/unfollow (grow follower base)
- Auto-relist (end and relist stale listings)

**Risk controls:**
- Randomized timing (2-8 second delays between actions)
- Daily action limits (conservative caps well below Poshmark detection thresholds)
- Session sandboxing (isolated per seller)
- Activity patterns that mimic human behavior (no perfect timing, no identical intervals)
- Automatic pause if any action returns unexpected result
- Circuit breaker: 3 failures → pause for 1 hour, 5 failures → pause for 24 hours

**Liability transfer:** Seller must accept acknowledgment that reads (paraphrased): "Poshmark's ToS prohibits automation. Using Mode 3 may result in account restrictions on Poshmark. Twicely is a tool provider and is not responsible for actions taken on third-party platforms at your direction." This follows the Nifty.ai legal pattern.

---

## 17. AUTOMATION ADD-ON (All Platforms)

The Automation add-on ($9.99/month) is a single subscription that covers ALL connected platforms. It is NOT platform-specific. If you have Automation and connect Poshmark, sharing is included.

### 17.1 Features

| Feature | Platforms | Description |
|---------|-----------|-------------|
| Auto-relist | All | End and relist stale listings to refresh search ranking |
| Offer to likers/watchers | eBay, Poshmark, Mercari, Depop | Send automatic offers to interested buyers |
| Smart price drops | All | Scheduled price reductions to trigger notification to watchers |
| Closet sharing | Poshmark | Share listings to followers and parties |
| Follow/unfollow | Poshmark | Grow follower base automatically |
| Listing refresh | All | AI tweaks title/description for freshness (costs 1 AI credit) |

### 17.2 Automation Metering

| Resource | How It's Metered |
|----------|-----------------|
| Automation actions | Monthly allowance per ListerTier (see Pricing Canonical v3.2 §6) |
| AI credits | Monthly allowance per ListerTier (listing refresh = 1 credit) |
| Sharing actions | Included in automation actions count |

### 17.3 Gate Rule

Automation requires Crosslister Lite or above. You cannot add Automation with Lister Free — it makes no sense to automate when you can only do 25 publishes/month.

---

## 18. SHIPPING ADAPTER

### 18.1 Canonical Shipping Profile

Each listing has a canonical shipping configuration on Twicely. The shipping adapter maps this to platform-native settings.

| Field | Description |
|-------|-------------|
| shippingType | FREE, FLAT, CALCULATED, LOCAL_PICKUP |
| flatRate | Fixed shipping cost (if FLAT) |
| weight | Item weight for calculated shipping |
| dimensions | L × W × H for calculated shipping |
| handlingTime | Business days to ship after sale |
| domesticCarriers | Allowed carriers (USPS, UPS, FedEx) |
| internationalShipping | Enabled/disabled + countries |

### 18.2 Platform Mapping

| Platform | Shipping Model | Adapter Behavior |
|----------|---------------|------------------|
| eBay | Calculated, flat, free | Full mapping — most flexible |
| Poshmark | Size-based flat rate | Map to nearest Poshmark size bucket |
| Mercari | Weight-based or free | Map weight → Mercari shipping label |
| Depop | Flat rate or free | Map flatRate directly |
| Etsy | Calculated, flat, free | Full mapping similar to eBay |

### 18.3 Blocking Rule

If a listing's shipping configuration cannot be mapped to the target platform (missing required fields), the policy engine returns REQUIRE_FIELDS and the publish is blocked until the seller provides the missing shipping data.

---

## 19. IMAGE HANDLING

### 19.1 Storage

All original images stored in Cloudflare R2. Images are never modified in place — all transformations create new variants.

### 19.2 Per-Channel Variants

Each platform has different image requirements:

| Platform | Max Images | Min Size | Max Size | Format | Aspect Ratio |
|----------|-----------|----------|----------|--------|-------------|
| Twicely | 24 | 500×500 | 4000×4000 | JPEG, PNG, WebP | Any |
| eBay | 24 | 500×500 | 9000×9000 | JPEG, PNG | Any |
| Poshmark | 16 | 400×400 | — | JPEG | Square preferred |
| Mercari | 12 | 300×300 | — | JPEG | Any |
| Depop | 4 | 400×400 | — | JPEG | Square required |

When publishing, the transform engine generates platform-appropriate image variants (resize, crop, format convert) and caches them in R2 under a platform-specific prefix.

### 19.3 Background Removal

- Main image background removal: manual opt-in per listing
- Included in ListerTier monthly allowance (BG removal credits)
- 1 BG removal = 1 credit
- Original preserved, BG-removed version stored as variant

### 19.4 Image Deduplication

During import, images are perceptually hashed (pHash). If the same image exists on multiple platforms (common for crosslisted items), it's stored once in R2 and referenced by both projections.

---

## 20. ANALYTICS & METRICS

### 20.1 Unified Cross-Platform Metrics

The lister aggregates metrics across all connected platforms into a unified view:

| Metric | Source | Description |
|--------|--------|-------------|
| Impressions | Platform API/polling | How many times listing was viewed |
| Clicks | Platform API/polling | How many times listing was clicked |
| Watchers/Likes | Platform API/polling | Interest signals |
| Offers received | Platform API/polling | Purchase intent signals |
| Sales | Platform API/webhooks | Completed transactions |
| Revenue | Calculated | Sale price × quantity across all platforms |
| Sell-through rate | Calculated | Items sold / items listed |
| Time-to-sale | Calculated | Listed date → sale date |
| ROI by channel | Calculated | Revenue - platform fees per channel |
| Automation effectiveness | Calculated | Sales attributed to automation actions |

### 20.2 Daily Rollup

Metrics are rolled up daily per listing, per channel, per seller. Historical data retained for 2 years. Real-time metrics available via Centrifugo for the seller's dashboard.

### 20.3 Cross-Platform Dashboard

The seller sees a unified dashboard showing:
- Which platforms each listing is active on (with per-platform status badges)
- Side-by-side performance comparison across platforms
- Best-performing platform per listing
- Recommendations: "This listing gets 3× more views on eBay than Poshmark — consider boosting on eBay"
- Revenue by platform (Twicely, eBay, Poshmark, etc.)

**Beta constraint:** Cross-platform analytics ship when crosslister ships. Beta launch = Twicely-only metrics.

---

## 21. REAL-TIME EVENTS (Centrifugo)

### 21.1 Lister-Specific Channels

| Channel Pattern | Events | Who Receives |
|----------------|--------|-------------|
| `private-user.{sellerId}` | import.progress, publish.progress, sale.detected, delist.completed, job.failed, merge.completed | The seller |
| `private-admin.lister` | connector.health, platform.error, scheduler.metrics, double-sell.alert | Platform admins |

### 21.2 Key Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `import.progress` | batchId, total, processed, created, failed, status | During import pipeline |
| `publish.progress` | total, published, failed, remaining | During batch publish |
| `sale.detected` | listingId, channel, salePrice, buyerId | Sale detected on any platform |
| `delist.completed` | listingId, channels[], delistLatency | All emergency delists confirmed |
| `job.failed` | jobId, jobType, error, retriesRemaining | Any job failure |
| `sync.external_change` | projectionId, channel, diff | External change detected |
| `automation.action` | actionType, listingId, channel, result | Automation action executed |

---

## 22. CASL PERMISSIONS

### 22.1 Seller Permissions (Lister-Related)

| Permission | Who Has It | Description |
|-----------|-----------|-------------|
| `manage CrosslisterAccount` | Seller (own) | Connect/disconnect platforms |
| `read CrosslisterAccount` | Seller (own), delegated staff | View connection status |
| `create ChannelProjection` | Seller (own) with ListerTier check | Publish to external platform |
| `manage ChannelProjection` | Seller (own) | Edit overrides, enable/disable sync |
| `delete ChannelProjection` | Seller (own) | Delist from external platform |
| `create ImportBatch` | Seller (own) | Start import |
| `manage MergeRecord` | Seller (own) | Merge/undo listings |
| `read CrossJob` | Seller (own) | View job status |
| `delete CrossJob` | Seller (own) | Cancel pending jobs |
| `manage AutomationSettings` | Seller (own) with Automation check | Configure auto-relist, offers, etc. |

### 22.2 Admin Permissions

| Permission | Description |
|-----------|-------------|
| `manage PlatformConnector` | Enable/disable connectors, adjust rate limits |
| `manage PolicyRule` | Edit per-platform validation rules |
| `manage CategoryMapping` | Edit category tree mappings |
| `read CrossJob (any)` | Inspect any seller's jobs |
| `manage CrossJob (any)` | Retry/cancel/DLQ any job |
| `manage GlobalThrottle` | Platform kill-switches, global rate limits |
| `read SchedulerMetrics` | Monitoring dashboard |

### 22.3 Delegation Scopes

When a seller delegates staff access, lister-related scopes include:

| Scope | What It Allows |
|-------|---------------|
| `crosslister:read` | View connected accounts, job status, projections |
| `crosslister:publish` | Publish listings to external platforms |
| `crosslister:import` | Run imports from connected platforms |
| `crosslister:manage` | Full control — connect/disconnect accounts, edit automation |

---

## 23. ADMIN CONTROLS

### 23.1 Platform Kill-Switches

| Control | Description |
|---------|-------------|
| Per-platform kill-switch | Instantly pause ALL jobs for a specific platform |
| Per-seller kill-switch | Pause all lister jobs for a specific seller |
| Global kill-switch | Pause ALL lister jobs across all platforms and sellers |

Kill-switches take effect within 5 seconds. Active jobs in progress complete (can't interrupt mid-API-call), but no new jobs dispatch.

### 23.2 Rate Limit Overrides

Admins can adjust rate limits per platform without code deployment:
- Increase/decrease calls per hour per seller
- Set burst allowances for specific events
- Temporary overrides with automatic expiry

### 23.3 Job Inspection

Admin can:
- View all jobs by status (PENDING, RUNNING, FAILED, DEAD_LETTERED)
- Filter by seller, platform, job type
- Retry failed jobs individually or in bulk
- Cancel pending jobs
- Move dead-lettered jobs back to queue after fix
- View full job payload and error details

### 23.4 Connector Health Dashboard

Real-time view per connector:
- Success rate (last 1h, 24h, 7d)
- Average latency
- Error breakdown by type
- Circuit breaker status
- Active sessions (Tier C)
- Webhook delivery rate (Tier A)

---

## 24. RELIABILITY & RECOVERY

### 24.1 Idempotent Jobs

Every CrossJob has a unique idempotencyKey. If the same job is dispatched twice (due to queue retry, network issue), the second execution is a no-op. Idempotency keys include: sellerId + listingId + channel + jobType + timestamp bucket (1-minute granularity).

### 24.2 Retry Strategy

| Job Type | Max Attempts | Backoff | Dead-Letter After |
|----------|-------------|---------|-------------------|
| EMERGENCY_DELIST | 5 | 5s, 15s, 30s, 60s, 120s | 5 failures |
| PUBLISH | 3 | 30s, 120s, 300s | 3 failures |
| SYNC | 3 | 60s, 300s, 900s | 3 failures |
| IMPORT | 3 | 60s, 300s, 600s | 3 failures |
| POLLING | 1 | None (next poll cycle picks up) | Never |
| AUTOMATION | 2 | 60s, 300s | 2 failures |

### 24.3 Circuit Breakers

Circuit breakers operate at two levels:
- **Per-seller per-platform:** 3 consecutive failures → open for 15 minutes → half-open (1 test request) → close if success
- **Per-platform global:** Error rate > 30% over 5-minute window → alert ops + auto-reduce rate limits by 50%

### 24.4 Dead Letter Queue (DLQ)

Jobs that exhaust all retries move to DLQ. DLQ jobs:
- Are visible in admin dashboard
- Include full error context and stack trace
- Can be individually retried after root cause fix
- Trigger alerts to ops if DLQ depth exceeds threshold
- Auto-purge after 30 days if not addressed

### 24.5 Webhook Replay Safety

Webhook handlers are idempotent. If a platform sends the same webhook twice (eBay does this sometimes), the second processing is a no-op. Webhook deduplication uses platform-provided event ID + timestamp.

---

## 25. SECURITY & COMPLIANCE

### 25.1 Token Security

- All OAuth tokens, API keys, and session data encrypted at rest (AES-256-GCM)
- Tokens never logged in plaintext (redacted in all logs)
- Token rotation: refresh tokens used proactively before expiry
- Revocation: when seller disconnects an account, tokens are immediately destroyed

### 25.2 Session Isolation (Tier C)

- Each seller's Tier C session runs in an isolated context
- Sessions cannot access other sellers' data
- Session data encrypted with per-seller key
- Session cleanup: terminated sessions have data wiped within 1 hour

### 25.3 Audit Trail

Every lister operation logged:
- Who (sellerId or staffId via delegation)
- What (job type, listing ID, channel)
- When (timestamp)
- Result (success/failure/error)
- Full payload (for replay capability)

Audit logs retained for 2 years. Immutable — no deletions permitted.

### 25.4 Data Handling

- External listing data (titles, descriptions, images) stored as projections — linked to canonical listing
- When a seller disconnects a platform → projections archived (soft delete), not destroyed
- GDPR/CCPA: seller can request full data export or deletion of their lister data
- Deletion cascades: user deletion → all lister data (accounts, projections, jobs, merge records) permanently deleted

---

## 26. SCALE TARGETS

### 26.1 Throughput

| Metric | Target |
|--------|--------|
| Import throughput | 50 items/batch, 10 batches/minute per seller |
| Publish throughput | 500+ publishes/hour across all sellers |
| Emergency delist latency | < 10s (Tier A), < 3m (Tier B), < 5m (Tier C) |
| Polling coverage | 100% of active projections polled within tier SLA |
| Scheduler cycle time | < 5 seconds |

### 26.2 "50×10 Test"

A single seller should be able to queue 50 items × 10 platforms (500 publishes) and have all executed within the rolling 24-hour scheduler window under normal platform health.

### 26.3 Cost Projection

Approximate infrastructure cost for lister services:
- ~$400-$500 per 1,000 active sellers/month
- Dominated by: polling infrastructure, session management (Tier C), image processing
- Scales linearly with active sellers

---

## 27. PLATFORM ROLLOUT (Feature Flags)

Import and crosslisting capabilities roll out per platform independently. Import can be enabled before crosslisting for any platform.

### 27.1 Feature Flags

```
imports.{platform}.enabled      — can sellers import FROM this platform?
crosslister.{platform}.enabled  — can sellers push TO this platform?
automation.{platform}.enabled   — are automation features available for this platform?
```

### 27.2 Rollout Plan

| Phase | Platforms | Import | Crosslist | Automation |
|-------|----------|--------|-----------|------------|
| Launch | eBay, Poshmark, Mercari | ✅ | ✅ | ✅ |
| Month 1-2 | Depop, Facebook Marketplace | ✅ | ✅ | ✅ |
| Month 3-4 | Etsy, Grailed | ✅ | ✅ | ✅ |
| Month 5-6 | TheRealReal | ✅ | ✅ | 🟡 |

Each platform ships import first (low risk — read-only), then crosslisting (write operations), then automation.

---

## 28. CONSOLIDATED LISTING FORM

The seller fills out ONE listing form on Twicely. The form shows:
1. Canonical fields (title, description, price, photos, category, condition, shipping)
2. Per-platform tabs showing: what the listing will look like on each connected platform
3. Platform-specific required fields highlighted (e.g., eBay item specifics)
4. Override option per field per platform
5. Policy validation results per platform (green check, yellow warning, red block)

The seller never duplicates data entry. They write one title, one description, upload photos once. The transform engine handles the rest.

---

## 29. ACCEPTANCE TESTS

These must all pass before lister is considered complete:

| # | Test | Criteria |
|---|------|----------|
| 1 | Import always creates Twicely listing | Import from any platform → canonical listing with ACTIVE status |
| 2 | Import never charges insertion fees | 600 imported items → $0 insertion fees |
| 3 | Dedupe prevents duplicate projections | Same item on eBay + Poshmark → 1 canonical listing, 2 projections |
| 4 | Manual merge preserves links + undo | Merge 2 listings → all projections on primary → undo restores both |
| 5 | Sale triggers emergency delists | Sell on eBay → Poshmark + Mercari delisted within target latency |
| 6 | Double-sell detected and flagged | Two sales arrive within delist window → both flagged, seller notified |
| 7 | Scheduler fairness under burst | 100 sellers each queue 50 items → all get fair throughput |
| 8 | Policy engine blocks invalid publish | Missing required field → REQUIRE_FIELDS, publish blocked |
| 9 | Kill-switch pauses platform safely | Toggle eBay kill-switch → all eBay jobs pause, other platforms unaffected |
| 10 | Publish counts correctly | Push to 3 platforms = 3 publishes consumed |
| 11 | Syncs don't count as publishes | Price change synced to 3 platforms = 0 publishes consumed |
| 12 | Tier C session isolation | Seller A's session cannot access Seller B's data |
| 13 | Automation respects Poshmark modes | Mode 2: action batch requires approval before execution |
| 14 | Circuit breaker triggers on failures | 3 consecutive failures → connector paused for seller |
| 15 | Publish respects ListerTier limit | Lister Free seller with 25 publishes used → 26th publish blocked |
| 16 | Import progress real-time | Import of 500 items → Centrifugo events update UI every batch |
| 17 | Per-platform overrides work | Title override on eBay projection → eBay listing uses override, others use canonical |

---

## 30. FORBIDDEN PATTERNS

❌ Fire-and-forget API calls (always verify)
❌ Per-push credits for crosslisting (subscription-based, not credit-based)
❌ Insertion fees on imported listings (ALWAYS exempt)
❌ Imports going to DRAFT status (always ACTIVE)
❌ Crosslister requiring Store subscription (independent axes)
❌ Store requiring Crosslister subscription (independent axes)
❌ Counting syncs, relists, or delists as publishes (only initial push counts)
❌ Logging tokens in plaintext
❌ Hardcoding rate limits (must be admin-configurable)
❌ Blocking the import to gate behind subscriptions (free import is sacred)
❌ Using SellerTier or SubscriptionTier vocabulary (use ListerTier, StoreTier, PerformanceBand)
❌ Treating external listings as source of truth (Twicely canonical always wins)
❌ Single-threaded scheduler (must handle concurrent platforms)
❌ Meilisearch (use Typesense), Soketi (use Centrifugo), MinIO (use Cloudflare R2), Prisma (use Drizzle)

---

## 31. CHANGELOG

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-15 | Initial V3 lock. Full architecture: canonical hub model, import pipeline, scheduler (BullMQ), connector framework (Tier A/B/C), dedupe/fingerprinting, emergency delists, adaptive polling, Poshmark 3-mode automation, automation add-on, two-way sync, policy/transform engine, shipping adapter, image handling, analytics, CASL permissions, admin controls, reliability/recovery, security, scale targets, platform rollout. |

---

**This document is the single source of truth for Twicely V3 crosslister architecture.**
**Vocabulary: ListerTier (crosslister subscription), StoreTier (storefront subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**
