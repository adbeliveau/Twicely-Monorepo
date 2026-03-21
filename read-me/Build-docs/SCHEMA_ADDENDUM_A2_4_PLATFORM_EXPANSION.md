# Schema Addendum A2.4 — Platform Expansion & Browser Extension
**Version:** A2.4
**Status:** LOCKED
**Date:** 2026-03-06
**Depends on:** Schema v2.0.7 (133 tables baseline)
**Build phase:** H1 (browser extension tables) / H2–H4 (connectors consume new channel values)
**Decision references:** #105, #106, #107

---

## Summary of Changes

| Type | Item | Change |
|------|------|--------|
| Enum ALTER | `channelEnum` | Add `WHATNOT`, `SHOPIFY`, `VESTIAIRE` (Decision #140: shortened from `VESTIAIRE_COLLECTIVE`) |
| ~~New enum~~ | ~~`extensionBrowserEnum`~~ | ~~Removed — Decision #141: JWT + Valkey approach adopted~~ |
| ~~New enum~~ | ~~`extensionJobStatusEnum`~~ | ~~Removed — Decision #141~~ |
| ~~New enum~~ | ~~`extensionJobTypeEnum`~~ | ~~Removed — Decision #141~~ |
| ~~New table~~ | ~~`extension_installation`~~ | ~~Removed — Decision #141: Extension tracking via stateless JWT + Valkey~~ |
| ~~New table~~ | ~~`extension_job`~~ | ~~Removed — Decision #141: BullMQ + crossJob table handles job tracking~~ |

**Table count:** 133 → **133** (no new tables — extension uses JWT + Valkey, see Decision #141)
**Enum count:** +0 new enums, 1 enum altered (3 new channel values)

---

## 1. Enum Alterations

### 1.1 channelEnum — Add 3 values

Current (Schema v2.0.7):
```typescript
export const channelEnum = pgEnum('channel', [
  'TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP',
  'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL',
]);
```

Updated (A2.4):
```typescript
export const channelEnum = pgEnum('channel', [
  'TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP',
  'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL',
  'WHATNOT', 'SHOPIFY', 'VESTIAIRE',  // Decision #140: shortened from VESTIAIRE_COLLECTIVE
]);
```

**Connector tier mapping (append to Lister Canonical §9.1):**

| Channel | Tier | Auth | Import | Crosslist | Notes |
|---------|------|------|--------|-----------|-------|
| WHATNOT | A | OAuth (Seller API) | ❌ | ✅ BIN only | Live/auction out of scope |
| SHOPIFY | A | OAuth (Admin API) | ✅ | ✅ | Seller chooses scope at connect time |
| VESTIAIRE | C | SESSION (extension) | ✅ | ✅ | EU luxury; Decision #140: shortened from VESTIAIRE_COLLECTIVE |

---

## 2. New Enums

```typescript
// §1.10 — append to Crosslister enum block

export const extensionBrowserEnum = pgEnum('extension_browser', [
  'CHROME', 'EDGE', 'FIREFOX',
]);

export const extensionJobStatusEnum = pgEnum('extension_job_status', [
  'PENDING',      // Created in DB, not yet pushed to extension
  'DISPATCHED',   // Pushed via Centrifugo, awaiting extension ACK
  'EXECUTING',    // Extension has ACKed, execution in progress
  'COMPLETED',    // Extension posted success to callback
  'FAILED',       // Extension posted failure or max retries exceeded
  'TIMED_OUT',    // No response within deadline
]);

export const extensionJobTypeEnum = pgEnum('extension_job_type', [
  'PUBLISH',       // Create new listing on platform
  'UPDATE',        // Edit existing listing
  'DELIST',        // Remove listing from platform
  'VERIFY',        // Check listing still exists and is active
  'SHARE',         // Poshmark share-to-followers (Automation add-on only)
  'HEALTH_CHECK',  // Ping extension to confirm connectivity
]);
```

---

## 3. New Tables

### 3.1 extensionInstallation

Tracks which users have the extension installed, on which browser, and when it last checked in.

```typescript
export const extensionInstallation = pgTable('extension_installation', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),

  // Identity
  browser:             extensionBrowserEnum('browser').notNull(),
  extensionVersion:    text('extension_version').notNull(),         // e.g. "1.0.4"
  manifestVersion:     integer('manifest_version').notNull().default(3),

  // Status
  isActive:            boolean('is_active').notNull().default(true),
  lastHeartbeatAt:     timestamp('last_heartbeat_at', { withTimezone: true }),
  lastJobCompletedAt:  timestamp('last_job_completed_at', { withTimezone: true }),

  // Centrifugo channel this installation listens on
  // Format: extension:{sellerId}:{installationId}
  centrifugoChannel:   text('centrifugo_channel').notNull(),

  // Device fingerprint — used to detect duplicate installs on same machine
  deviceFingerprint:   text('device_fingerprint'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerBrowserIdx:    index('ei_seller_browser').on(table.sellerId, table.browser),
  activeIdx:           index('ei_active').on(table.isActive),
  heartbeatIdx:        index('ei_heartbeat').on(table.lastHeartbeatAt),
}));
```

**Notes:**
- One row per seller × browser. If a seller installs on Chrome and Edge, two rows.
- `isActive` flips to false if heartbeat is absent for >30 minutes. BullMQ job checks.
- `centrifugoChannel` is the Centrifugo channel the extension subscribes to for job delivery.
- Multiple installs of the same browser (reinstall) are handled by updating the existing row, not inserting a new one.

---

### 3.2 extensionJob

Every job dispatched to a browser extension. BullMQ is the scheduler; this table is the persistent audit trail and retry mechanism.

```typescript
export const extensionJob = pgTable('extension_job', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id),
  installationId:      text('installation_id').notNull().references(() => extensionInstallation.id),
  crossJobId:          text('cross_job_id').references(() => crossJob.id),  // Parent crosslister job if applicable

  // Job definition
  jobType:             extensionJobTypeEnum('job_type').notNull(),
  targetChannel:       channelEnum('target_channel').notNull(),      // Must be POSHMARK | FB_MARKETPLACE | THEREALREAL | VESTIAIRE
  payloadJson:         jsonb('payload_json').notNull().default('{}'), // Instructions for the extension DOM script

  // Status tracking
  status:              extensionJobStatusEnum('status').notNull().default('PENDING'),
  attempts:            integer('attempts').notNull().default(0),
  maxAttempts:         integer('max_attempts').notNull().default(3),

  // Timing
  dispatchedAt:        timestamp('dispatched_at', { withTimezone: true }),
  ackedAt:             timestamp('acked_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  deadlineAt:          timestamp('deadline_at', { withTimezone: true }).notNull(), // Job expires if not completed by this time

  // Results
  resultJson:          jsonb('result_json').default('{}'),            // Success payload from extension callback
  errorMessage:        text('error_message'),
  errorCode:           text('error_code'),

  // Idempotency
  idempotencyKey:      text('idempotency_key').notNull().unique(),    // Format: ext:{crossJobId}:{attempt}

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:           index('ej_seller').on(table.sellerId),
  installationIdx:     index('ej_installation').on(table.installationId),
  crossJobIdx:         index('ej_cross_job').on(table.crossJobId),
  statusIdx:           index('ej_status').on(table.status),
  deadlineIdx:         index('ej_deadline').on(table.deadlineAt),
}));
```

**Notes:**
- `targetChannel` constraint: only Tier C platforms (`POSHMARK`, `FB_MARKETPLACE`, `THEREALREAL`, `VESTIAIRE`). Enforced at application layer, not DB constraint.
- `deadlineAt` defaults to `createdAt + 5 minutes`. BullMQ sweeper marks TIMED_OUT on expired jobs.
- `payloadJson` contains serialised DOM instructions. Shape varies by `jobType` and `targetChannel`. Extension interprets it.
- `resultJson` is posted back by extension to `/api/crosslister/extension/callback`. Contains `{ externalId?, externalUrl?, screenshot? }` on success.

---

## 4. Migration SQL

Apply in order:

```sql
-- Step 1: Extend channelEnum
-- PostgreSQL requires individual ALTER TYPE statements; cannot add multiple in one
ALTER TYPE channel ADD VALUE IF NOT EXISTS 'WHATNOT';
ALTER TYPE channel ADD VALUE IF NOT EXISTS 'SHOPIFY';
ALTER TYPE channel ADD VALUE IF NOT EXISTS 'VESTIAIRE';  -- Decision #140

-- Step 2: New enums
CREATE TYPE extension_browser AS ENUM ('CHROME', 'EDGE', 'FIREFOX');

CREATE TYPE extension_job_status AS ENUM (
  'PENDING', 'DISPATCHED', 'EXECUTING', 'COMPLETED', 'FAILED', 'TIMED_OUT'
);

CREATE TYPE extension_job_type AS ENUM (
  'PUBLISH', 'UPDATE', 'DELIST', 'VERIFY', 'SHARE', 'HEALTH_CHECK'
);

-- Step 3: extension_installation table
CREATE TABLE extension_installation (
  id                    TEXT PRIMARY KEY,
  seller_id             TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  browser               extension_browser NOT NULL,
  extension_version     TEXT NOT NULL,
  manifest_version      INTEGER NOT NULL DEFAULT 3,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_heartbeat_at     TIMESTAMPTZ,
  last_job_completed_at TIMESTAMPTZ,
  centrifugo_channel    TEXT NOT NULL,
  device_fingerprint    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ei_seller_browser ON extension_installation(seller_id, browser);
CREATE INDEX ei_active         ON extension_installation(is_active);
CREATE INDEX ei_heartbeat      ON extension_installation(last_heartbeat_at);

-- Step 4: extension_job table
CREATE TABLE extension_job (
  id                TEXT PRIMARY KEY,
  seller_id         TEXT NOT NULL REFERENCES "user"(id),
  installation_id   TEXT NOT NULL REFERENCES extension_installation(id),
  cross_job_id      TEXT REFERENCES cross_job(id),
  job_type          extension_job_type NOT NULL,
  target_channel    channel NOT NULL,
  payload_json      JSONB NOT NULL DEFAULT '{}',
  status            extension_job_status NOT NULL DEFAULT 'PENDING',
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 3,
  dispatched_at     TIMESTAMPTZ,
  acked_at          TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  deadline_at       TIMESTAMPTZ NOT NULL,
  result_json       JSONB DEFAULT '{}',
  error_message     TEXT,
  error_code        TEXT,
  idempotency_key   TEXT NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ej_seller       ON extension_job(seller_id);
CREATE INDEX ej_installation ON extension_job(installation_id);
CREATE INDEX ej_cross_job    ON extension_job(cross_job_id);
CREATE INDEX ej_status       ON extension_job(status);
CREATE INDEX ej_deadline     ON extension_job(deadline_at);
```

---

## 5. CASL Subjects

Add to `src/lib/casl/subjects.ts`:
```typescript
'ExtensionInstallation' | 'ExtensionJob'
```

Permissions:
```typescript
// Seller: own extension installations
{ action: 'read',   subject: 'ExtensionInstallation', conditions: { sellerId } }
{ action: 'create', subject: 'ExtensionInstallation', conditions: { sellerId } }
{ action: 'update', subject: 'ExtensionInstallation', conditions: { sellerId } }
{ action: 'delete', subject: 'ExtensionInstallation', conditions: { sellerId } }

// Seller: own extension jobs (read only — jobs are created by server)
{ action: 'read',   subject: 'ExtensionJob',          conditions: { sellerId } }

// Hub staff: read all (support visibility)
{ action: 'read',   subject: 'ExtensionInstallation' }  // SUPPORT+
{ action: 'read',   subject: 'ExtensionJob'          }  // SUPPORT+
```

---

## 6. API Routes Added (Phase H)

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/crosslister/extension/register` | POST | Seller session | Extension calls on install/browser-open. Upserts `extensionInstallation`. Returns Centrifugo token + channel. |
| `/api/crosslister/extension/heartbeat` | POST | Seller session | Extension pings every 5 min. Updates `lastHeartbeatAt`. |
| `/api/crosslister/extension/callback` | POST | Seller session | Extension posts job result. Updates `extensionJob` status + result. |
| `/api/crosslister/extension/status` | GET | Seller session | Returns seller's active installations + pending job counts. Used by crosslister UI. |

---

## 7. Feature Flags — Connector Registry

All connector feature flags are seeded at migration time. Flags use the existing `feature_flag` table (Platform Settings Canonical). Type: `BOOLEAN`.

### Seed Values

| Flag Key | Default | Notes |
|----------|---------|-------|
| `connector:ebay` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:poshmark` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:mercari` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:depop` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:fb_marketplace` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:grailed` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:therealreal` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:etsy` | `OFF` | Enable via /cfg/feature-flags when ready |
| `connector:whatnot` | `OFF` | Phase H2 — requires Seller API access approval |
| `connector:shopify:import` | `OFF` | Phase H3 — requires Shopify Partner app approval |
| `connector:shopify:crosslist` | `OFF` | Phase H3 — requires Shopify Partner app approval |
| `connector:vestiaire_collective` | `OFF` | Phase H4 — low priority, build last |

**All connectors ship OFF. No connector is ever enabled by code, seed data, or default. Every connector must be explicitly enabled by a human via `/cfg/feature-flags` in the hub.**

### Enforcement Points

Two checks per connector, both required:

**1. Account connect UI** (`/my/selling/crosslist/connect`)
```typescript
// Before rendering a platform in the connect flow
const flag = await getFeatureFlag(`connector:${channel.toLowerCase()}`);
if (!flag.enabled) return null; // Platform not shown in UI
```

**2. Connector registry initialization** (`src/lib/crosslister/registry.ts`)
```typescript
// Before dispatching any job for a channel
const flag = await getFeatureFlag(`connector:${channel.toLowerCase()}`);
if (!flag.enabled) throw new ConnectorDisabledError(channel);
```

Shopify uses the sub-flag for the relevant capability:
```typescript
// At import job dispatch
const flag = await getFeatureFlag('connector:shopify:import');

// At crosslist job dispatch  
const flag = await getFeatureFlag('connector:shopify:crosslist');
```

### Kill Switch Behaviour

If a flag is flipped `OFF` on a live connector:
- New account connections for that platform are blocked immediately
- Existing `crosslisterAccount` rows are untouched — data is preserved
- Pending `crossJob` and `extensionJob` rows for that channel are skipped by the scheduler (not deleted)
- When the flag is re-enabled, queued jobs resume normally
- Hub admin surfaces a banner: "Connector disabled — {n} jobs paused"

### Hub Admin — Required UI

Connector flags **must** appear as a dedicated section in `/cfg/feature-flags`. This is not optional. The page must:

1. **Group connector flags separately** under a "Connectors" section — not mixed in with general feature flags
2. **Show all 12 connector flags** regardless of whether the connector is built yet — seeded at migration time, always visible
3. **Display per-flag metadata:** flag key, current state (ON/OFF), last changed by, last changed at
4. **Require ADMIN+ role** to toggle — same as all feature flags
5. **Show a confirmation modal** before enabling any connector: *"Enabling {Platform} will make it available to all sellers. Confirm?"*

Claude Code instruction: When building the `/cfg/feature-flags` page, connector flags are not optional UI. The page is incomplete without the Connectors section. Fail the slice if connector flags are not grouped and visible.

### No Hardcoded Enables

Zero exceptions. The following patterns are FORBIDDEN in application code:

```typescript
// FORBIDDEN — hardcoded enable
const ENABLED_CONNECTORS = ['EBAY', 'POSHMARK'];

// FORBIDDEN — env var bypass
if (process.env.ENABLE_EBAY === 'true') { ... }

// FORBIDDEN — seeding ON in migrations or seed files
await db.insert(featureFlag).values({ key: 'connector:ebay', enabled: true });

// CORRECT — always check the flag
const flag = await getFeatureFlag('connector:ebay');
if (!flag.enabled) throw new ConnectorDisabledError('EBAY');
```

- Tables: 133 → 135
- Enums: +3 new, 1 altered
