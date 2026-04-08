# TWICELY V3 — Platform Settings & Provider System Canonical
**Version:** v1.1  
**Status:** LOCKED  
**Date:** 2026-02-16  
**Purpose:** Single source of truth for every configurable platform setting, the provider abstraction system, encrypted secrets storage, and the admin settings UI at `hub.twicely.co/cfg/*`.

---

## 0. Why This Document Exists

V3's core principle: **if the code needs a number, that number lives in a settings table, not in source code.** Every fee rate, every threshold, every timeout, every limit — all configurable from the admin UI without redeployment. V2 had 216+ configurable settings across 10 tabs. V3 inherits that philosophy with V3-correct values.

This document covers:
- **Part A (§1–§4):** Settings infrastructure — how settings are stored, encrypted, versioned, and accessed
- **Part B (§5–§6):** Provider system — how external services are abstracted for operational flexibility
- **Part C (§7–§16):** Every configurable setting key, organized by category, with type, default, and description
- **Part D (§17):** Admin UI structure at `hub.twicely.co/cfg/*`

**Rule: If a setting is not in this document, it does not exist in V3. If code references a magic number, that's a bug.**

---

# PART A: SETTINGS INFRASTRUCTURE

## 1. Storage Architecture

> **IMPLEMENTATION NOTE (added 2026-04-07, owner-confirmed):** Sections §1.2 and
> §1.6 originally specified **effective-dated versioning** with `version`,
> `isActive`, and `effectiveAt` columns + a "never update in place, always
> create new rows" rule. The shipped implementation uses a **simpler in-place
> update + separate `platformSettingHistory` table** model. This was an
> accepted simplification: history is preserved in the audit table, and the
> effective-dated versioning was deemed over-engineered for the current
> operational needs (no scheduled-future settings, no rollback-by-reactivation
> use case in production). The schema sections below describe the SHIPPED model.
> If effective-dated versioning is needed in the future, it can be added in
> a v2 schema iteration. **The simpler model is the canonical state as of
> 2026-04-07.**

### 1.1 Design Principles

1. **Database-first, env-fallback.** Every setting is read from the database. If not found, fall back to `process.env`. If neither exists, use the hardcoded default from this document.
2. **History via audit table.** Settings are mutated in place. Every edit writes a row to `platformSettingHistory` (and `auditEvent`) capturing the old value, new value, editor, and timestamp. **NOT effective-dated row versioning.**
3. **Category + key addressing.** Settings are addressed as `category.key` (e.g., `commerce.cart.expiryHours`). Flat dot-notation. No nesting in the key itself.
4. **Audit everything.** Every settings change creates an `AuditEvent` AND a `platformSettingHistory` row. Two-layer audit.
5. **Secrets are separate.** API keys, tokens, and credentials go in `EnvironmentSecret` with AES-256-GCM encryption. They never appear in `PlatformSetting`.

### 1.2 Drizzle Schema: `platformSetting`

```typescript
// SHIPPED SCHEMA (2026-04-08) — differs from earlier spec drafts; see DEVIATION NOTE below
export const platformSetting = pgTable('platform_setting', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  category:           text('category').notNull(),               // 'fees', 'commerce', 'trust', etc.
  key:                text('key').notNull().unique(),            // 'cart.expiryHours', 'tf.electronics'
  value:              jsonb('value').notNull(),                  // The setting value (any JSON-serializable type)
  type:               text('type').notNull(),                    // 'number' | 'boolean' | 'string' | 'enum' | 'cents' | 'bps' | 'array'
  description:        text('description'),                       // Human-readable purpose
  isSecret:           boolean('is_secret').notNull().default(false), // Values masked in admin UI
  updatedByStaffId:   text('updated_by_staff_id'),                // StaffUser ID of last editor
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyIdx:      uniqueIndex('ps_key').on(table.key),
  categoryIdx: index('ps_category').on(table.category),
}));
```

> **DEVIATION NOTE:** Earlier spec drafts referenced `valueJson`, `valueType`, `version`, `isActive`, `effectiveAt`, `updatedBy`. The shipped schema consolidates these to `value`, `type`, `updatedByStaffId` and adds `description` + `isSecret`. Versioning is handled via a separate `platform_setting_history` table written on every update. The `updatedBy` column was renamed to `updatedByStaffId` for clarity (it references `staffUser.id`, not `user.id`).

### 1.3 Drizzle Schema: `environmentSecret`

```typescript
export const environmentSecret = pgTable('environment_secret', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  key:         text('key').notNull().unique(),       // e.g., 'STRIPE_SECRET_KEY'
  value:       text('value').notNull(),              // AES-256-GCM encrypted
  provider:    text('provider').notNull(),            // 'stripe', 'shippo', 'resend', etc.
  description: text('description'),                   // Human-readable description
  required:    boolean('required').notNull().default(true),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy:   text('updated_by'),                    // StaffUser ID
}, (table) => ({
  providerIdx: index('es_provider').on(table.provider),
}));
```

### 1.4 Encryption

All secrets encrypted with AES-256-GCM before database storage. The encryption key is the ONLY value that must live in an environment variable (`ENCRYPTION_KEY`). Everything else can be managed through the admin UI.

```typescript
// Encryption utility (lib/encryption.ts)
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(encryptedStr: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const [ivB64, tagB64, dataB64] = encryptedStr.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••';
  return '••••••••' + value.slice(-4);
}
```

### 1.5 Settings Access Pattern (SHIPPED)

```typescript
// packages/db/src/queries/platform-settings.ts
export async function getPlatformSetting<T>(
  key: string,
  defaultValue: T
): Promise<T> {
  // 1. Check database (single row per key — no versioning/effective-dating)
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);
  if (row) return row.value as T;

  // 2. Fallback (DB unreachable or setting not seeded)
  return defaultValue;
}

// Convenience for getting a secret
export async function getSecret(key: string): Promise<string | null> {
  const row = await db.query.environmentSecret.findFirst({
    where: eq(environmentSecret.key, key),
  });
  if (!row) return process.env[key] ?? null;
  return decrypt(row.value);
}
```

### 1.6 Settings Update Rules (SHIPPED MODEL — owner-confirmed 2026-04-07)

1. **In-place update + history table.** The `platformSetting` row is updated in place. Before the update, the prior value is captured in a `platformSettingHistory` row with `oldValue`, `newValue`, `changedAt`, `changedByStaffId`. **The original spec called for "never update in place, always create new versioned row" — the simpler in-place + history model was adopted as a deliberate simplification.**
2. **Scheduled changes.** ~~Set `effectiveAt` to a future date.~~ **NOT IMPLEMENTED.** The shipped model does not support scheduled-future settings. If needed, implement via a BullMQ delayed job that performs the in-place update at the scheduled time.
3. **Rollback.** ~~Re-activate a previous version.~~ Read the previous value from `platformSettingHistory` and apply it via a normal update (which itself creates a new history row). One-click revert UI reads the prior `oldValue` and POSTs it.
4. **Audit.** Every change creates BOTH a `platformSettingHistory` row AND an `AuditEvent { category: 'SETTING_CHANGE', severity: 'HIGH', metadata: { category, key, oldValue, newValue } }`. Two-layer audit.

> **Why the change?** During implementation review, the team determined that
> effective-dated versioning was over-engineered for current operational needs.
> No use case required scheduled-future settings or rollback-by-row-reactivation.
> The audit trail in `platformSettingHistory` provides full historical visibility.
> Reverting an effective-dated implementation later, if needed, is non-breaking.

### 1.7 "Migrate from .env" Feature

On first admin setup, the Environment tab shows a "Migrate from .env" button. This reads all known env vars, encrypts secrets, and inserts them into `environmentSecret`. After migration, the `.env` file can be stripped to contain only `ENCRYPTION_KEY` and `DATABASE_URL`.

---

## 2. Setting Value Types

Every setting has an explicit `type` (formerly `valueType`) that drives the admin UI input component:

| Type | Storage | UI Component | Example |
|------|---------|-------------|---------|
| `number` | JSON number | NumberInput with min/max/step | `cart.expiryHours: 72` |
| `cents` | JSON number (integer) | CentsInput (shows $X.XX, stores cents) | `insertion.fee.STARTER: 20` |
| `bps` | JSON number (integer) | BasisPointsInput (shows X.XX%, stores basis points) | `returns.restockingFeeBps: 1500` |
| `percent` | JSON number (float) | PercentInput (shows X%, stores float) | `tf.electronics: 9.0` |
| `boolean` | JSON boolean | Toggle switch | `offer.enabled: true` |
| `string` | JSON string | TextInput | `digest.timeUtc: "09:00"` |
| `enum` | JSON string | SelectInput with defined options | `shipping.defaultCarrier: "USPS"` |
| `array` | JSON array | Multi-select / tag input | `shipping.enabledCarriers: ["USPS","UPS","FedEx"]` |

**Money rule:** All money values stored as integer cents. No floats for money. Ever. The UI shows dollars; the database stores cents.

**Rate rule:** TF and discount rates stored as `percent` (float, e.g., `9.0` for 9%). Basis points used only where the spec says basis points (e.g., restocking fee).

---

## 3. Settings Seeding

On first application boot (or database migration), a seed script inserts every setting from this document with its default value. The seed is idempotent — it only inserts settings that don't already exist.

```typescript
// packages/db/src/seed/v32-platform-settings.ts (shipped shape)
const SETTINGS_SEED: Array<{
  category: string;
  key: string;
  value: unknown;
  type: string;
  description?: string;
  isSecret?: boolean;
}> = [
  { category: 'commerce', key: 'cart.expiryHours', value: 72, type: 'number', description: 'Hours before a cart expires and releases reservations' },
  { category: 'commerce', key: 'cart.maxItems', value: 100, type: 'number' },
  // ... every setting from §7–§16
];
```

---

## 4. Settings Version History UI

Every setting shows its change history: who changed it, when, old value → new value. Staff can click any previous version to preview what the platform would do with that value, and one-click revert.

---

# PART B: PROVIDER SYSTEM

## 5. Provider Architecture

### 5.1 Why Providers Exist

The tech stack is locked for **development** — we don't debate Prisma vs Drizzle. But the stack is NOT locked for **production**. The platform must be able to swap R2 → S3, Resend → SES, Typesense → Algolia from the admin UI without touching code. Provider abstraction makes this possible.

### 5.2 Three-Table Pattern

**ProviderAdapter** → defines what adapters are available (e.g., "Cloudflare R2", "Amazon S3")  
**ProviderInstance** → a configured adapter with credentials (e.g., "production-r2" using the R2 adapter)  
**ProviderUsageMapping** → maps a usage context to an instance (e.g., "listing-images" → "production-r2")

Code never references a specific provider directly. It calls `getProvider("listing-images")` and gets back the configured instance.

### 5.3 Service Types

| Service Type | Current Default | Possible Alternatives |
|-------------|----------------|----------------------|
| `storage` | Cloudflare R2 | Amazon S3, Backblaze B2, MinIO |
| `email` | Resend | Amazon SES, SendGrid, Postmark |
| `search` | Typesense | Algolia, Meilisearch, Elasticsearch |
| `payments` | Stripe | — (Stripe only for foreseeable future) |
| `shipping` | Shippo | EasyPost, ShipStation |
| `realtime` | Centrifugo | Soketi, Pusher |
| `cache` | Valkey | Redis, DragonflyDB |
| `geocoding` | Mapbox Geocoding | Nominatim (self-hosted), Google Geocoding, OpenCage, Geoapify |

### 5.4 Drizzle Schema: Provider Tables

```typescript
export const providerAdapter = pgTable('provider_adapter', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  serviceType:  text('service_type').notNull(),    // 'storage' | 'email' | 'search' | etc.
  code:         text('code').notNull(),             // 'r2' | 's3' | 'ses' | 'resend'
  name:         text('name').notNull(),             // 'Cloudflare R2'
  description:  text('description'),
  logoUrl:      text('logo_url'),
  docsUrl:      text('docs_url'),
  configSchema: jsonb('config_schema').notNull(),   // JSON schema defining required fields
  enabled:      boolean('enabled').notNull().default(true),
  isBuiltIn:    boolean('is_built_in').notNull().default(false),
  sortOrder:    integer('sort_order').notNull().default(100),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serviceCodeUniq: uniqueIndex('pa_service_code').on(table.serviceType, table.code),
  serviceTypeIdx: index('pa_service_type').on(table.serviceType),
}));

export const providerInstance = pgTable('provider_instance', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  adapterId:    text('adapter_id').notNull().references(() => providerAdapter.id),
  name:         text('name').notNull(),             // 'production-images'
  displayName:  text('display_name').notNull(),     // 'Production Image Storage'
  config:       jsonb('config').notNull(),           // Non-secret config { bucket, region, cdnUrl }
  status:       text('status').notNull().default('ACTIVE'),
  // ProviderInstanceStatus: ACTIVE | DISABLED | TESTING | MIGRATING | FAILED
  priority:     integer('priority').notNull().default(100),       // Lower = higher priority
  trafficPercent: integer('traffic_percent').notNull().default(100), // For gradual migration
  lastHealthCheck:  timestamp('last_health_check', { withTimezone: true }),
  lastHealthStatus: text('last_health_status'),     // HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN
  lastHealthMessage: text('last_health_message'),
  healthCheckCount: integer('health_check_count').notNull().default(0),
  failureCount:     integer('failure_count').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy:    text('created_by'),
}, (table) => ({
  adapterNameUniq: uniqueIndex('pi_adapter_name').on(table.adapterId, table.name),
  statusIdx: index('pi_status').on(table.status),
}));

export const providerSecret = pgTable('provider_secret', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  instanceId:     text('instance_id').notNull().references(() => providerInstance.id, { onDelete: 'cascade' }),
  key:            text('key').notNull(),             // 'accessKeyId' | 'secretAccessKey'
  encryptedValue: text('encrypted_value').notNull(), // AES-256-GCM
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy:      text('updated_by'),
}, (table) => ({
  instanceKeyUniq: uniqueIndex('psec_inst_key').on(table.instanceId, table.key),
  instanceIdx: index('psec_instance').on(table.instanceId),
}));

export const providerUsageMapping = pgTable('provider_usage_mapping', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  usageKey:           text('usage_key').notNull().unique(), // 'listing-images' | 'transactional-email'
  displayName:        text('display_name').notNull(),
  description:        text('description'),
  serviceType:        text('service_type').notNull(),
  primaryInstanceId:  text('primary_instance_id').notNull().references(() => providerInstance.id),
  fallbackInstanceId: text('fallback_instance_id').references(() => providerInstance.id),
  autoFailover:       boolean('auto_failover').notNull().default(true),
  enabled:            boolean('enabled').notNull().default(true),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serviceTypeIdx: index('pum_service_type').on(table.serviceType),
}));

export const providerHealthLog = pgTable('provider_health_log', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  instanceId:     text('instance_id').notNull(),
  status:         text('status').notNull(),           // HEALTHY | DEGRADED | UNHEALTHY
  message:        text('message'),
  responseTimeMs: integer('response_time_ms'),
  checkedAt:      timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  instanceCheckedIdx: index('phl_inst_checked').on(table.instanceId, table.checkedAt),
}));
```

### 5.5 Default Usage Mappings (Seeded)

| Usage Key | Service Type | Description |
|-----------|-------------|-------------|
| `listing-images` | storage | Listing photos uploaded by sellers |
| `user-avatars` | storage | User profile images |
| `storefront-assets` | storage | Store banners, logos |
| `kb-attachments` | storage | Knowledge base article attachments |
| `helpdesk-attachments` | storage | Helpdesk case attachments |
| `export-files` | storage | Data export downloads |
| `transactional-email` | email | Order confirmations, shipping updates, etc. |
| `marketing-email` | email | Promotional campaigns |
| `helpdesk-email` | email | Helpdesk case replies |
| `listing-search` | search | Full-text search for marketplace listings |
| `kb-search` | search | Knowledge base article search |
| `admin-search` | search | Admin global search (users, orders, etc.) |
| `payment-processing` | payments | Checkout, refunds, payouts |
| `shipping-labels` | shipping | Label generation and tracking |
| `websocket` | realtime | Live notifications, messaging, presence |
| `address-geocoding` | geocoding | Geocode seller/buyer addresses on save for distance search |
| `address-autocomplete` | geocoding | Address input suggestions in checkout, settings, and onboarding forms |

### 5.6 Provider Access Pattern

```typescript
// lib/providers.ts
export async function getProvider(usageKey: string): Promise<ProviderClient> {
  const mapping = await db.query.providerUsageMapping.findFirst({
    where: and(
      eq(providerUsageMapping.usageKey, usageKey),
      eq(providerUsageMapping.enabled, true),
    ),
    with: { primaryInstance: { with: { adapter: true, secrets: true } } },
  });

  if (!mapping) throw new Error(`No provider configured for usage: ${usageKey}`);

  const instance = mapping.primaryInstance;
  if (instance.status !== 'ACTIVE') {
    // Try fallback
    if (mapping.fallbackInstanceId && mapping.autoFailover) {
      // Load and return fallback instance
    }
    throw new Error(`Provider instance ${instance.name} is ${instance.status}`);
  }

  // Decrypt secrets and create client
  const secrets = Object.fromEntries(
    instance.secrets.map(s => [s.key, decrypt(s.encryptedValue)])
  );

  return createProviderClient(instance.adapter.code, {
    ...instance.config,
    ...secrets,
  });
}
```

### 5.7 Health Checks

Each provider instance has a health check endpoint. A BullMQ cron job runs health checks every 15 minutes (configurable). Results stored in `providerHealthLog` and `providerInstance.lastHealthStatus`. Admin UI shows green/yellow/red per instance.

Auto-failover: If `autoFailover = true` and the primary instance fails 3 consecutive health checks, traffic automatically routes to the fallback instance. Alert sent to all ADMIN and SRE staff.

---
### 5.8 Custom HTTP Adapters

#### 5.8.1 Why This Exists

The provider system ships with 20+ built-in adapters covering
all major services. But if the admin wants to use a provider
that isn't built-in — say a niche email API or a regional
storage service — they can configure it directly from the UI
with zero code and zero deploys.

Custom HTTP adapters work by defining HTTP endpoint templates
for each method the service type requires. The system does
variable interpolation and makes standard HTTP calls. This
covers any modern REST API.

#### 5.8.2 Two Adapter Sources

| Source | How Created | Where Code Lives | Who Creates |
|--------|-------------|------------------|-------------|
| BUILT_IN | Developer writes TypeScript file, deploys | Codebase: `src/lib/providers/adapters/` | Developer |
| HTTP_CUSTOM | Admin fills form in UI, saves | Database: `providerAdapter.httpConfigJson` | Admin (SUPER_ADMIN only) |

Built-in adapters can do anything — complex auth flows (AWS
Sig V4), binary protocols, SDK-specific logic. HTTP custom
adapters can only make standard HTTP requests with JSON
bodies and header-based auth. This covers ~95% of REST APIs.

#### 5.8.3 HTTP Config Schema

The `httpConfigJson` column stores endpoint definitions.
Each service type defines which endpoints are required.
```typescript
type HttpConfig = {
  baseUrl: string;              // "https://api.provider.com/v1"
  defaultHeaders?: Record<string, string>;  // Applied to all requests
  auth: {
    type: 'BEARER' | 'BASIC' | 'API_KEY_HEADER' | 'API_KEY_QUERY' | 'NONE';
    headerName?: string;        // Default: "Authorization"
    headerPrefix?: string;      // Default: "Bearer" for BEARER type
    secretKey: string;          // Key name in provider secrets: "apiKey"
    queryParam?: string;        // For API_KEY_QUERY: param name
  };
  endpoints: Record<string, HttpEndpoint>;
};

type HttpEndpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;                 // "/messages" — appended to baseUrl
  bodyTemplate?: string;        // JSON string with {{variable}} placeholders
  queryTemplate?: Record<string, string>; // Query params with {{variables}}
  headersOverride?: Record<string, string>;
  successCondition: {
    statusCodes: number[];      // [200, 201, 202]
  };
  responseMapping?: {           // Map response fields to expected return shape
    [outputField: string]: string;  // "url" → "response.data.download_url"
  };
};
```

#### 5.8.4 Required Endpoints Per Service Type

Each service type defines which endpoints the adapter must
provide. Built-in adapters implement these as TypeScript
methods. HTTP custom adapters define these as HTTP endpoint
templates.

| Service Type | Required Endpoints | Optional Endpoints |
|-------------|-------------------|-------------------|
| email | send, healthCheck | — |
| storage | upload, download, delete, healthCheck | list, getMetadata |
| search | index, query, delete, healthCheck | bulkIndex, deleteIndex |
| sms | send, healthCheck | — |
| push | send, healthCheck | sendBatch |
| realtime | publish, healthCheck | subscribe, presence |
| geocoding | forward, reverse, healthCheck | batch, autocomplete |

#### 5.8.5 Variable Interpolation

Body templates and path templates support `{{variable}}`
syntax. Variables are resolved from two sources:

1. **Method arguments** — the data passed when calling the
   provider method (e.g., `to`, `subject`, `html` for email
   send)
2. **Config values** — from the provider instance's config
   JSON (e.g., `config.bucket`, `config.region`)
3. **Secrets** — from the provider instance's encrypted
   secrets (e.g., `secrets.apiKey`)

Example email send body template:
```json
{
  "to": ["{{to}}"],
  "from": "{{from}}",
  "subject": "{{subject}}",
  "html": "{{html}}",
  "reply_to": "{{replyTo}}"
}
```

Example storage upload path template:
```
/buckets/{{config.bucket}}/objects/{{path}}
```

Variables are escaped to prevent injection. Any `{{variable}}`
that doesn't resolve is left as an empty string (for optional
fields) or causes an error (for required fields based on
endpoint schema).

#### 5.8.6 Execution Flow
```
Admin calls getProvider("transactional-email")
    │
    ▼
providerUsageMapping resolves to instance
    │
    ▼
Instance's adapter has adapterSource = ?
    │
    ├── BUILT_IN → load TypeScript adapter from codebase
    │               call adapter.send(args) directly
    │
    └── HTTP_CUSTOM → load httpConfigJson from database
                      find endpoints.send definition
                      interpolate bodyTemplate with args
                      make HTTP request (method + baseUrl + path)
                      apply auth header from secrets
                      check response against successCondition
                      map response fields via responseMapping
                      return result
```

#### 5.8.7 Admin UI — "Add Custom Adapter"

Location: `hub.twicely.co/cfg?tab=integrations` → Adapters → "Add Custom Adapter"

Gate: SUPER_ADMIN only. 2FA required. Audit severity: HIGH.

**Step 1: Basics**
- Name: text field ("My Email Provider")
- Code: auto-generated from name ("my-email-provider")
- Service Type: dropdown (Email, Storage, Search, SMS, Push, Realtime, Geocoding)
- Description: textarea

**Step 2: Authentication**
- Auth Type: dropdown (Bearer Token, Basic Auth, API Key Header, API Key Query, None)
- Based on selection, show relevant fields:
  - Bearer: Secret key name (default: "apiKey")
  - Basic: Username field + Password secret key
  - API Key Header: Header name + Secret key name
  - API Key Query: Query param name + Secret key name
- Base URL: text field ("https://api.provider.com/v1")
- Default Headers: key-value pair editor (optional)

**Step 3: Endpoints**
System shows required endpoints for the chosen service type.
Each endpoint has:
- Method: dropdown (GET/POST/PUT/PATCH/DELETE)
- Path: text field with `{{variable}}` autocomplete
- Body Template: code editor (JSON) with `{{variable}}` autocomplete — NOT Monaco, just a syntax-highlighted textarea with variable hints
- Success Codes: multi-select (200, 201, 202, 204)
- Response Mapping: key-value pairs for mapping response fields (optional)

**Step 4: Config Schema**
Define what fields the instance configuration form should
show when someone creates an instance using this adapter:
- Add Field button → name, label, type (text/number/boolean/select/secret), required toggle, placeholder, help text
- This generates the `configSchemaJson` on the adapter record
- Secret-type fields are stored encrypted in `providerSecret`

**Step 5: Validate & Save**
- "Validate Adapter" — checks all required endpoints defined, body templates are valid JSON, variables are consistent
- "Test Connection" — prompts for test credentials, runs healthCheck endpoint, shows result
- "Save Adapter" — writes to database, appears in adapter dropdown immediately

#### 5.8.8 Guardrails

- Only SUPER_ADMIN can create, edit, or delete custom adapters
- 2FA required for all custom adapter operations
- All changes audit logged (severity: HIGH)
- Maximum 20 custom adapters (prevents sprawl)
- HTTP requests from custom adapters have a 30-second timeout
- HTTP requests are rate-limited to 100/minute per adapter instance
- Custom adapters cannot make requests to internal/private IPs (SSRF prevention)
- Localhost and 10.x/172.16.x/192.168.x blocked
- Response bodies larger than 10MB are rejected
- Custom adapters are clearly labeled "Custom (HTTP)" in all UI to distinguish from built-in
- Deleting a custom adapter requires reassigning any instances first

#### 5.8.9 Built-In vs Custom Comparison

| Capability | Built-In | HTTP Custom |
|-----------|----------|-------------|
| Complex auth (AWS Sig V4, OAuth refresh) | ✅ | ❌ |
| Binary uploads/downloads | ✅ | ❌ |
| Custom retry logic | ✅ | ❌ (uses platform default) |
| Response streaming | ✅ | ❌ |
| Any REST API with JSON | ✅ | ✅ |
| Bearer/Basic/API Key auth | ✅ | ✅ |
| Created by admin | ❌ | ✅ |
| Zero deploy | ❌ | ✅ |
| Health checks | ✅ | ✅ |
| Failover support | ✅ | ✅ |

---

### 5.9 Geocoding Provider Details

#### 5.9.1 Why Geocoding Exists

The marketplace search filter system (Feature Lock-in §28) includes a distance filter: "within 10mi / 25mi / 50mi / 100mi of buyer's location." This requires converting addresses to latitude/longitude coordinates at save time, then filtering by radius at search time.

Geocoding also powers address autocomplete in checkout, seller onboarding, and account settings — reducing typos and improving shipping accuracy.

Future use: Twicely.local (local marketplace mode) will rely heavily on geocoding for proximity-based discovery, local pickup radius, and neighborhood-level search.

#### 5.9.2 When Geocoding Runs

Geocoding is a **save-time operation**, not a search-time operation. Coordinates are computed once and stored:

| Trigger | What Gets Geocoded | Stored On |
|---------|-------------------|-----------|
| Seller saves/updates address | Seller's primary address | `address.latitude`, `address.longitude` |
| Buyer saves shipping address | Buyer's shipping address | `address.latitude`, `address.longitude` |
| Listing created/imported | Seller's address at creation time | `listing.latitude`, `listing.longitude` (denormalized) |
| Buyer uses distance filter | Buyer's current location (browser geolocation or saved address) | Not stored — used as query origin |

Coordinates are indexed in Typesense as `geopoint` fields for radius-based filtering. Typesense handles the distance math at search time — the geocoding provider is never called during search.

#### 5.9.3 Endpoint Signatures

| Endpoint | Input | Output | Description |
|----------|-------|--------|-------------|
| `forward` | `{ address: string, country?: string }` | `{ latitude: number, longitude: number, formattedAddress: string, confidence: number }` | Address string → coordinates |
| `reverse` | `{ latitude: number, longitude: number }` | `{ address: string, city: string, state: string, postalCode: string, country: string }` | Coordinates → address components |
| `autocomplete` | `{ query: string, country?: string, limit?: number }` | `{ suggestions: Array<{ text: string, placeId?: string }> }` | Partial input → address suggestions |
| `batch` | `{ addresses: Array<{ id: string, address: string }> }` | `{ results: Array<{ id: string, latitude: number, longitude: number, confidence: number }> }` | Bulk geocode (for imports) |
| `healthCheck` | — | `{ healthy: boolean, latencyMs: number }` | Service availability check |

#### 5.9.4 Built-In Adapters

**Adapter 1: Mapbox Geocoding** (default)

| Field | Value |
|-------|-------|
| Code | `mapbox` |
| Service Type | `geocoding` |
| Is Built-In | true |
| Codebase Location | `src/lib/providers/adapters/geocoding/mapbox.ts` |
| API Base URL | `https://api.mapbox.com/geocoding/v5/mapbox.places` (forward) / `https://api.mapbox.com/search/geocode/v6` (autocomplete) |
| Auth | Bearer token via `access_token` query parameter |
| Free Tier | 100,000 requests/month (forward + reverse combined) |
| Paid | $5 per 1,000 requests after free tier |
| Rate Limit | 600 requests/minute |
| Coverage | Global |
| Accuracy | Rooftop-level in US/EU, interpolated elsewhere |

Config schema:

```json
[
  { "key": "country", "label": "Default Country", "type": "text", "required": false, "placeholder": "US", "helpText": "ISO 3166-1 alpha-2 country code to bias results" },
  { "key": "language", "label": "Response Language", "type": "text", "required": false, "placeholder": "en", "helpText": "Language for returned place names" },
  { "key": "autocompleteEnabled", "label": "Enable Autocomplete", "type": "boolean", "required": false, "helpText": "Use Mapbox Search API for address autocomplete" }
]
```

Secrets:

| Key | Description |
|-----|-------------|
| `accessToken` | Mapbox access token (starts with `pk.` for public or `sk.` for secret) |

---

**Adapter 2: Nominatim (Self-Hosted)**

| Field | Value |
|-------|-------|
| Code | `nominatim` |
| Service Type | `geocoding` |
| Is Built-In | true |
| Codebase Location | `src/lib/providers/adapters/geocoding/nominatim.ts` |
| API Base URL | Configured per instance (e.g., `http://nominatim:8080` for internal, or `https://nominatim.openstreetmap.org` for public) |
| Auth | None (self-hosted) or `NONE` (public — rate limited) |
| Free Tier | Unlimited (self-hosted) / 1 req/sec (public) |
| Rate Limit | No limit self-hosted / 1 req/sec public |
| Coverage | Global (OpenStreetMap data) |
| Accuracy | Street-level in US/EU. Sufficient for distance filtering (25mi+ radius) |

Config schema:

```json
[
  { "key": "baseUrl", "label": "Nominatim URL", "type": "text", "required": true, "placeholder": "http://nominatim:8080", "helpText": "Self-hosted Nominatim instance URL or https://nominatim.openstreetmap.org" },
  { "key": "country", "label": "Default Country", "type": "text", "required": false, "placeholder": "US", "helpText": "ISO 3166-1 alpha-2 country code to bias results" },
  { "key": "selfHosted", "label": "Self-Hosted Instance", "type": "boolean", "required": true, "helpText": "If true, disables rate limiting. If false, enforces 1 req/sec for public API compliance." },
  { "key": "userAgent", "label": "User-Agent Header", "type": "text", "required": true, "placeholder": "Twicely/1.0 (admin@twicely.co)", "helpText": "Required by Nominatim usage policy. Must identify your application." }
]
```

Secrets: None required for self-hosted. No API key.

**Nominatim limitations:**
- No native autocomplete endpoint. The adapter simulates autocomplete by calling `forward` with partial input and `limit` parameter. Slightly slower than Mapbox's purpose-built autocomplete.
- No batch endpoint. The adapter loops `forward` calls with 50ms delay between each (self-hosted) or 1s delay (public). Fine for import batches processed via BullMQ jobs.
- Response format is different from Mapbox — the adapter normalizes to the standard geocoding output shape.

---

**Adapter 3: Google Geocoding** (optional, not default)

| Field | Value |
|-------|-------|
| Code | `google-geocoding` |
| Service Type | `geocoding` |
| Is Built-In | true |
| Codebase Location | `src/lib/providers/adapters/geocoding/google.ts` |
| API Base URL | `https://maps.googleapis.com/maps/api/geocode` |
| Auth | API key via `key` query parameter |
| Free Tier | $200/month credit (~40,000 requests) |
| Paid | $5 per 1,000 requests after credit |
| Accuracy | Best-in-class rooftop precision |

Config schema:

```json
[
  { "key": "region", "label": "Region Bias", "type": "text", "required": false, "placeholder": "us", "helpText": "ccTLD region code to bias results" }
]
```

Secrets:

| Key | Description |
|-----|-------------|
| `apiKey` | Google Maps Platform API key with Geocoding API enabled |

---

#### 5.9.5 Default Instance & Mapping (Seeded)

On first boot, the seed script creates:

**Adapters:** `mapbox` (geocoding, built-in, enabled), `nominatim` (geocoding, built-in, enabled), `google-geocoding` (geocoding, built-in, enabled)

**Instance:** `production-geocoding` using `mapbox` adapter, status ACTIVE

**Usage mappings:**

| Usage Key | Instance | Fallback | Auto-Failover |
|-----------|----------|----------|---------------|
| `address-geocoding` | `production-geocoding` | — | true |
| `address-autocomplete` | `production-geocoding` | — | true |

When the team is ready to swap to self-hosted Nominatim: create a new instance `nominatim-hetzner` with the Nominatim adapter, test it, then update the usage mappings to point to it. Zero code change.

#### 5.9.6 Geocoding Settings (`geocoding` category)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `geocoding.enabled` | boolean | true | Master switch for geocoding |
| `geocoding.cacheEnabled` | boolean | true | Cache geocoding results to avoid repeat lookups for same address |
| `geocoding.cacheTtlDays` | number | 365 | How long to cache a geocoded address (1 year) |
| `geocoding.confidenceThreshold` | number | 0.6 | Minimum confidence score to accept a geocoding result (0–1). Below this, address is flagged for manual review |
| `geocoding.batchSizeLimit` | number | 500 | Max addresses per batch geocoding job |
| `geocoding.batchDelayMs` | number | 50 | Delay between individual requests in a batch (ms). Set higher for rate-limited providers |
| `geocoding.defaultCountry` | string | "US" | Default country code for geocoding bias |
| `geocoding.autocompleteEnabled` | boolean | true | Enable address autocomplete in forms |
| `geocoding.autocompleteMinChars` | number | 3 | Minimum characters before triggering autocomplete |
| `geocoding.autocompleteDebounceMs` | number | 300 | Debounce delay for autocomplete requests (ms) |

---

## 6. Provider Admin UI (`hub.twicely.co/cfg/integrations`)

The Integrations tab shows:
- **Overview cards:** X adapters, Y instances, Z usage mappings, W active
- **Per-service-type sections:** Storage, Email, Search, Payments, Shipping, Realtime, Cache, Geocoding
- **Each section shows:** configured instances with status dot (green/yellow/red), adapter name, "Configure" link
- **Quick actions:** New Instance, New Usage Mapping
- **Advanced management:** links to Adapters, Instances, Usage Mappings, Health Logs sub-pages

This matches V2's Provider tab layout exactly (V2 path: `/corp/settings/providers`).

---

# PART C: EVERY CONFIGURABLE SETTING

Settings are organized into 10 categories matching the admin UI tabs. Each setting shows: **key**, **type**, **default**, **description**.

Naming convention: `category.subcategory.field` — all lowercase, dots as separators.

---

## 7. Fees & Pricing (`fees`)

### 7.1 Progressive Transaction Fee Brackets (v3.2)

TF uses progressive volume brackets (like income tax). Calendar month reset. NOT category-based (v2 was category-based).

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.tf.bracket1.maxCents` | cents | 49900 | Bracket 1 ceiling ($499) |
| `commerce.tf.bracket1.rate` | bps | 1000 | 10.0% — new/casual welcome rate |
| `commerce.tf.bracket2.maxCents` | cents | 199900 | Bracket 2 ceiling ($1,999) |
| `commerce.tf.bracket2.rate` | bps | 1100 | 11.0% — hobbyist standard ceiling |
| `commerce.tf.bracket3.maxCents` | cents | 499900 | Bracket 3 ceiling ($4,999) |
| `commerce.tf.bracket3.rate` | bps | 1050 | 10.5% — part-time |
| `commerce.tf.bracket4.maxCents` | cents | 999900 | Bracket 4 ceiling ($9,999) |
| `commerce.tf.bracket4.rate` | bps | 1000 | 10.0% — full-time |
| `commerce.tf.bracket5.maxCents` | cents | 2499900 | Bracket 5 ceiling ($24,999) |
| `commerce.tf.bracket5.rate` | bps | 950 | 9.5% — established |
| `commerce.tf.bracket6.maxCents` | cents | 4999900 | Bracket 6 ceiling ($49,999) |
| `commerce.tf.bracket6.rate` | bps | 900 | 9.0% — power seller |
| `commerce.tf.bracket7.maxCents` | cents | 9999900 | Bracket 7 ceiling ($99,999) |
| `commerce.tf.bracket7.rate` | bps | 850 | 8.5% — top seller |
| `commerce.tf.bracket8.maxCents` | null | null | Bracket 8 unlimited |
| `commerce.tf.bracket8.rate` | bps | 800 | 8.0% — enterprise floor |
| `commerce.tf.minimumCents` | cents | 50 | $0.50 minimum TF per order |
| `commerce.tf.gmvWindowType` | string | calendar_month | GMV reset window |

### 7.2 Insertion Fees (per Store Tier)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fees.insertion.NONE` | cents | 35 | Insertion fee — no store |
| `fees.insertion.STARTER` | cents | 25 | Insertion fee — Store Starter |
| `fees.insertion.PRO` | cents | 10 | Insertion fee — Store Pro |
| `fees.insertion.POWER` | cents | 5 | Insertion fee — Store Power |
| `fees.insertion.ENTERPRISE` | cents | 0 | Insertion fee — Store Enterprise |

### 7.3 Free Listings per Month (per Store Tier)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fees.freeListings.NONE` | number | 100 | Free listings/month — no store |
| `fees.freeListings.STARTER` | number | 250 | Free listings/month — Store Starter |
| `fees.freeListings.PRO` | number | 2000 | Free listings/month — Store Pro |
| `fees.freeListings.POWER` | number | 15000 | Free listings/month — Store Power |
| `fees.freeListings.ENTERPRISE` | number | 100000 | Free listings/month — Store Enterprise |

### 7.4 Store Subscription Pricing

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `store.pricing.starter.monthlyCents` | cents | 1200 | Store Starter monthly |
| `store.pricing.starter.annualCents` | cents | 699 | Store Starter annual/mo |
| `store.pricing.pro.monthlyCents` | cents | 3999 | Store Pro monthly |
| `store.pricing.pro.annualCents` | cents | 2999 | Store Pro annual/mo |
| `store.pricing.power.monthlyCents` | cents | 7999 | Store Power monthly |
| `store.pricing.power.annualCents` | cents | 5999 | Store Power annual/mo |

### 7.5 Crosslister Subscription Pricing

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `crosslister.pricing.lite.monthlyCents` | cents | 1399 | Crosslister Lite monthly |
| `crosslister.pricing.lite.annualCents` | cents | 999 | Crosslister Lite annual/mo |
| `crosslister.pricing.pro.monthlyCents` | cents | 3999 | Crosslister Pro monthly |
| `crosslister.pricing.pro.annualCents` | cents | 2999 | Crosslister Pro annual/mo |

### 7.6 Finance Subscription Pricing

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `finance.pricing.pro.monthlyCents` | cents | 1499 | Finance Pro monthly |
| `finance.pricing.pro.annualCents` | cents | 999 | Finance Pro annual/mo |

### 7.7 Automation Add-On Pricing

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `automation.pricing.monthlyCents` | cents | 1299 | Automation monthly |
| `automation.pricing.annualCents` | cents | 999 | Automation annual/mo |
| `automation.actionsPerMonth` | number | 2000 | Automation actions included/month |
| `automation.overagePackSize` | number | 1000 | Actions per overage pack |
| `fees.automation.overagePackCents` | cents | 900 | Overage pack price |

### 7.8 Boosting

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `boost.minRateBps` | bps | 100 | Minimum boost rate in basis points (100 = 1.0%) |
| `boost.maxRateBps` | bps | 800 | Maximum boost rate in basis points (800 = 8.0%) |
| `boost.attributionDays` | number | 7 | Days for boost attribution window |
| `boost.maxPromotedPercentBps` | bps | 3000 | Max % of search results that can be promoted (3000 = 30%) |
| `boost.refundOnReturn` | boolean | true | Refund boost fees on returned orders |

### 7.9 Payment Processing

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.stripe.processingRateBps` | bps | 290 | Stripe processing rate (290 = 2.9%) |
| `commerce.stripe.processingFixedCents` | cents | 30 | Stripe per-transaction fixed fee |

> **Note:** Stripe refund fee retention is controlled by the `refund_application_fee: true` flag in Stripe API calls, not a configurable setting. The previous `fees.stripe.refundFeeRetained` key was never implemented.

### 7.10 Overage Packs

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `overage.publishes.qty` | number | 500 | Publishes per overage pack |
| `overage.publishes.cents` | cents | 900 | Publish overage pack price |
| `overage.aiCredits.qty` | number | 500 | AI credits per overage pack |
| `overage.aiCredits.cents` | cents | 900 | AI overage pack price |
| `overage.bgRemovals.qty` | number | 500 | BG removals per overage pack |
| `overage.bgRemovals.cents` | cents | 900 | BG removal overage pack price |
| `overage.autoMaxPacksPerMonth` | number | 3 | Max auto-purchase packs per month |

---

## 8. Commerce (`commerce`)

### 8.1 Cart

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.cart.expiryHours` | number | 72 | Cart items expire after this many hours |
| `commerce.cart.maxItems` | number | 100 | Maximum items per cart |
| `commerce.cart.reservationMinutes` | number | 15 | Soft reservation hold on cart items (minutes) |
| `commerce.cart.guestCheckoutEnabled` | boolean | false | Allow checkout without account (V3: disabled by default) |

### 8.2 Offers

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.offer.enabled` | boolean | true | Global enable for Make Offer feature |
| `commerce.offer.expirationHours` | number | 48 | Offers expire after X hours |
| `commerce.offer.minPercentOfAsking` | percent | 50.0 | Minimum offer as % of asking price |
| `commerce.offer.counterOfferEnabled` | boolean | true | Allow seller counter-offers |
| `commerce.offer.maxOffersPerBuyer` | number | 3 | Max offers per buyer per listing |
| `commerce.offer.autoDeclineBelowMin` | boolean | true | Auto-reject offers below seller's minimum |

### 8.3 Bundles

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `bundle.enabled` | boolean | true | Enable seller bundle creation |
| `bundle.maxPerSeller` | number | 50 | Maximum bundles per seller |
| `bundle.maxDiscountPercent` | number | 50 | Max bundle discount vs individual (%) |
| `bundle.minItems` | number | 2 | Minimum items for a bundle |
| `bundle.smartPromptsEnabled` | boolean | true | Show bundle suggestions in cart |
| `bundle.freeShippingPromptEnabled` | boolean | true | Suggest items for free shipping |
| `bundle.maxPromptsPerCart` | number | 3 | Max bundle prompts shown at once |

### 8.4 Orders

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.order.autoCompleteAfterDays` | number | 3 | Auto-complete orders X days after delivery |
| `commerce.order.buyerCancelWindowHours` | number | 1 | Hours buyer can cancel after purchase |
| `commerce.order.maxItemsPerOrder` | number | 100 | Maximum items in single order |

### 8.4b Escrow & Fund Release

Per Pricing Canonical v3.2 §5.2. All orders, all tiers, no exceptions.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.escrow.holdHours` | number | 72 | Hours after delivery confirmation before funds release (buyer inspection window) |
| `commerce.escrow.autoReleaseEnabled` | boolean | true | Auto-release funds after hold period expires with no flag |
| `commerce.escrow.buyerEarlyAcceptEnabled` | boolean | true | Allow buyer to accept early (release funds before hold expires) |

### 8.5 Cancellations

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.cancel.sellerPenaltyEnabled` | boolean | true | Penalize sellers who cancel |
| `commerce.cancel.sellerCancelAffectsStandards` | boolean | true | Seller cancels impact seller standards |
| `commerce.cancel.autoRefundOnCancel` | boolean | true | Automatically refund on cancellation |

### 8.6 Listings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `listing.maxImagesPerListing` | number | 24 | Maximum photos per listing |
| `listing.minTitleLength` | number | 10 | Minimum characters in title |
| `listing.maxTitleLength` | number | 80 | Maximum characters in title |
| `listing.maxDescriptionLength` | number | 5000 | Maximum characters in description |
| `listing.durationDays` | number | 90 | Default listing duration in days |
| `listing.autoRenewEnabled` | boolean | true | Allow auto-renew of expired listings |

### 8.7 Conditions

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `commerce.condition.requireFlawDescription` | boolean | true | Require flaw description for Good/Acceptable |
| `commerce.condition.allowCategorySpecific` | boolean | true | Allow categories to add custom conditions |

---

## 9. Fulfillment (`fulfillment`)

### 9.1 Shipping

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fulfillment.shipping.defaultHandlingDays` | number | 3 | Default handling time in business days |
| `fulfillment.shipping.maxHandlingDays` | number | 10 | Maximum allowed handling time |
| `fulfillment.shipping.lateThresholdDays` | number | 1 | Days past handling time before marked late |
| `fulfillment.shipping.trackingRequiredAboveCents` | cents | 5000 | Require tracking for orders above $50 |
| `fulfillment.shipping.signatureRequiredAboveCents` | cents | 75000 | Require signature above $750 |
| `fulfillment.shipping.defaultCarrier` | enum | "USPS" | Default carrier. Options: USPS, UPS, FedEx |
| `fulfillment.shipping.labelGenerationEnabled` | boolean | true | Enable Shippo label generation |
| `fulfillment.shipping.labelDiscountPercent` | percent | 0.0 | Discount on shipping labels |
| `fulfillment.shipping.enabledCarriers` | array | ["USPS","UPS","FedEx"] | Carriers available for labels |

### 9.2 Insurance

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fulfillment.insurance.autoInsureAboveCents` | cents | 10000 | Auto-insure shipments above $100 |
| `fulfillment.insurance.maxCoverageCents` | cents | 500000 | Maximum insurance coverage $5,000 |

### 9.3 Returns

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fulfillment.returns.windowDays` | number | 30 | Default return window in days |
| `fulfillment.returns.sellerResponseDays` | number | 3 | Business days for seller to respond to return |
| `fulfillment.returns.returnShipByDays` | number | 7 | Days buyer has to ship return after label |
| `fulfillment.returns.autoApproveUnderCents` | cents | 1000 | Auto-approve returns under $10 |
| `fulfillment.returns.maxReturnsPerBuyerPerMonth` | number | 10 | Flag serial returners above this |
| `fulfillment.returns.restockingFeeBps` | bps | 0 | Restocking fee in basis points (0 = disabled) |

---

## 10. Trust & Quality (`trust`)

### 10.1 Trust Score Bands

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trust.baseScore` | number | 80 | Starting trust score for new sellers |
| `trust.bandExcellentMin` | number | 90 | Minimum score for EXCELLENT band |
| `trust.bandGoodMin` | number | 75 | Minimum score for GOOD band |
| `trust.bandWatchMin` | number | 60 | Minimum score for WATCH band |
| `trust.bandLimitedMin` | number | 40 | Minimum score for LIMITED band (below = RESTRICTED) |
| `trust.volumeCapped` | number | 10 | Orders before neutral cap |
| `trust.volumeLimited` | number | 50 | Orders for full weight |
| `trust.decayHalfLifeDays` | number | 90 | Days for trust event impact to halve |

### 10.2 Trust Event Weights

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trust.event.review5Star` | number | 1.0 | Trust score delta for 5-star review |
| `trust.event.review4Star` | number | 0.5 | Trust score delta for 4-star review |
| `trust.event.review3Star` | number | -1.5 | Trust score delta for 3-star review |
| `trust.event.review2Star` | number | -4.0 | Trust score delta for 2-star review |
| `trust.event.review1Star` | number | -7.0 | Trust score delta for 1-star review |
| `trust.event.lateShipment` | number | -2.0 | Trust score delta for late shipment |
| `trust.event.sellerCancel` | number | -3.0 | Trust score delta for seller cancellation |
| `trust.event.refundSellerFault` | number | -4.0 | Trust score delta for seller-fault refund |
| `trust.event.disputeOpened` | number | -2.0 | Trust score delta when dispute opens |
| `trust.event.disputeSellerFault` | number | -6.0 | Trust score delta for seller-fault dispute |
| `trust.event.chargeback` | number | -8.0 | Trust score delta for chargeback |
| `trust.event.policyViolation` | number | -12.0 | Trust score delta for policy violation |

### 10.3 Reviews

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trust.review.eligibleDaysAfterDelivery` | number | 3 | Days after delivery before review eligible |
| `trust.review.windowDays` | number | 60 | Days to leave review after eligible |
| `trust.review.allowSellerResponse` | boolean | true | Allow sellers to respond |
| `trust.review.sellerResponseWindowDays` | number | 30 | Days for seller to respond |
| `trust.review.moderationEnabled` | boolean | true | Enable review moderation |
| `trust.review.autoApproveAboveStars` | number | 0 | Auto-approve reviews above X stars (0=all moderated) |
| `trust.review.editWindowHours` | number | 24 | Hours to edit review after posting |
| `trust.review.minLengthChars` | number | 0 | Minimum review text length (0=none) |
| `trust.review.maxLengthChars` | number | 5000 | Maximum review text length |

### 10.4 Seller Standards

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trust.standards.evaluationPeriodDays` | number | 90 | Rolling window for standards evaluation |
| `trust.standards.minOrdersForEvaluation` | number | 10 | Minimum orders before evaluation |
| `trust.standards.maxDefectRatePercent` | percent | 2.0 | Max transaction defect rate for GOOD |
| `trust.standards.maxLateShipRatePercent` | percent | 4.0 | Max late shipment rate for GOOD |
| `trust.standards.maxUnresolvedCasesPercent` | percent | 0.3 | Max unresolved case rate for GOOD |
| `trust.standards.topRatedMaxDefectRate` | percent | 0.5 | Max defect rate for TOP_RATED |
| `trust.standards.topRatedMaxLateShipRate` | percent | 1.0 | Max late ship rate for TOP_RATED |
| `trust.standards.topRatedMinOrdersYear` | number | 100 | Min annual orders for TOP_RATED |
| `trust.standards.belowStandardVisibilityReduction` | percent | 50.0 | Search visibility penalty |
| `trust.standards.belowStandardFvfSurcharge` | percent | 5.0 | Additional TF penalty |
| `trust.standards.restrictedMaxListings` | number | 10 | Max listings for restricted sellers |
| `trust.standards.defectExpiryDays` | number | 365 | Days before defects expire |

### 10.5 Buyer Protection

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trust.protection.defaultWindowDays` | number | 30 | Standard claim window |
| `trust.protection.counterfeitWindowDays` | number | 60 | Extended window for counterfeit claims |
| `trust.protection.sellerResponseDays` | number | 3 | Business days for seller to respond |
| `trust.protection.platformReviewHours` | number | 48 | Hours for platform to review escalated claim |
| `trust.protection.appealWindowDays` | number | 30 | Days after resolution to file appeal |
| `trust.protection.defaultMaxCoverageCents` | cents | 500000 | Default max coverage per claim ($5,000) |
| `trust.protection.autoApproveThresholdCents` | cents | 2500 | Auto-approve claims under $25 if seller no-response |

---

## 11. Discovery (`discovery`)

### 11.1 Search Ranking

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `discovery.search.titleWeight` | number | 3.0 | Weight for title matches in search |
| `discovery.search.descriptionWeight` | number | 1.0 | Weight for description matches |
| `discovery.search.trustMultiplierEnabled` | boolean | true | Boost trusted sellers in search results |
| `discovery.search.freshnessBoostEnabled` | boolean | true | Boost recently listed items |
| `discovery.search.defaultPageSize` | number | 48 | Default results per page |
| `discovery.search.maxPageSize` | number | 100 | Maximum results per page |

### 11.2 Promoted Listings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `discovery.promo.boostEnabled` | boolean | true | Enable promoted listings in search |
| `discovery.promo.maxBoostMultiplier` | number | 3.0 | Maximum ranking boost for promoted |

### 11.3 Price Alerts

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `discovery.priceAlert.enabled` | boolean | true | Enable price drop alerts |
| `discovery.priceAlert.maxPerUser` | number | 100 | Maximum price alerts per user |
| `discovery.priceAlert.defaultExpiryDays` | number | 90 | Default alert expiration |
| `discovery.priceAlert.categoryAlertsEnabled` | boolean | true | Enable category-wide alerts |
| `discovery.priceAlert.categoryAlertMaxPerUser` | number | 20 | Max category alerts per user |
| `discovery.priceAlert.immediateLimit` | number | 10 | Max immediate alerts sent per day |

### 11.4 Market Index

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `discovery.marketIndex.enabled` | boolean | true | Compute market price indexes |
| `discovery.marketIndex.minSample` | number | 10 | Min sales for index calculation |
| `discovery.marketIndex.highConfidence` | number | 50 | Sales needed for HIGH confidence |
| `discovery.marketIndex.dealBadgesEnabled` | boolean | true | Show 'Great Deal' badges |
| `discovery.marketIndex.lowConfidenceVisible` | boolean | false | Display LOW confidence indexes |

---

## 12. Communications (`comms`)

### 12.1 Email

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `comms.email.enabled` | boolean | true | Master switch for email notifications |
| `comms.email.maxPerDayPerUser` | number | 50 | Email rate limit per user per day |
| `comms.email.marketingEnabled` | boolean | true | Enable marketing email campaigns |
| `comms.email.marketingOptInRequired` | boolean | true | Require explicit opt-in for marketing |

### 12.2 Push Notifications

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `comms.push.enabled` | boolean | true | Master switch for push notifications |
| `comms.push.maxPerDayPerUser` | number | 20 | Push rate limit per user per day |

### 12.3 SMS

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `comms.sms.enabled` | boolean | false | Master switch for SMS (off by default) |
| `comms.sms.maxPerDayPerUser` | number | 5 | SMS rate limit per user per day |

### 12.4 Digests

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `comms.digest.enabled` | boolean | true | Enable email digest feature |
| `comms.digest.frequency` | enum | "daily" | Default digest frequency. Options: daily, weekly, monthly |
| `comms.digest.timeUtc` | string | "14:00" | UTC time to send digests (9 AM ET) |

### 12.5 Messaging

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `comms.messaging.enabled` | boolean | true | Enable buyer-seller direct messaging |
| `comms.messaging.rateLimitPerHour` | number | 30 | Max messages per user per hour (Feature Lock-In S19, Actors S6.2) |
| `comms.messaging.moderationEnabled` | boolean | true | Enable message content moderation |
| `comms.messaging.autoResponseEnabled` | boolean | true | Allow seller auto-responses |

---

## 13. Payments (`payments`)

### 13.1 Disputes & Chargebacks

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `payments.disputeFilingFeeCents` | cents | 0 | Fee charged when dispute filed (0 = free to file) |
| `payments.disputeSellerFeeCents` | cents | 2000 | Fee charged to seller if dispute is lost |
| `payments.chargebackFeeCents` | cents | 1500 | Fee charged for chargebacks |
| `payments.chargebackReversalCreditCents` | cents | 1500 | Credit if chargeback is reversed |
| `payments.waiveFirstDisputeFee` | boolean | false | Waive fee for seller's first dispute |
| `payments.disputeFeeWaiverLimit` | number | 1 | Max disputes to waive per year |

### 13.2 Reconciliation

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `payments.reconciliationFrequency` | enum | "daily" | How often to run reconciliation. Options: hourly, daily, weekly |
| `payments.reconciliationTimeUtc` | string | "02:00" | UTC time to run daily reconciliation |
| `payments.autoResolveSmallDiscrepancies` | boolean | true | Auto-resolve discrepancies under threshold |
| `payments.autoResolveThresholdCents` | cents | 100 | Max discrepancy to auto-resolve ($1) |
| `payments.ledgerRetentionYears` | number | 7 | Years to retain ledger entries |
| `payments.generateDailyReports` | boolean | true | Auto-generate daily financial reports |

### 13.3 Payouts

Per Pricing Canonical v3.2 §5. Payout frequency and minimums are gated by Store tier.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `payout.weeklyDay` | number | 5 | Day of week for weekly auto-payout (5=Friday) |
| `payout.weeklyTime` | string | "06:00" | UTC time for weekly auto-payout batch |
| `payout.dailyTime` | string | "06:00" | UTC time for daily auto-payout batch (Power/Enterprise) |
| `payout.minimumNoneCents` | cents | 1500 | Minimum payout for Free (NONE) tier ($15) |
| `payout.minimumStarterCents` | cents | 1000 | Minimum payout for Starter tier ($10) |
| `payout.minimumProCents` | cents | 100 | Minimum payout for Pro tier ($1) |
| `payout.minimumPowerCents` | cents | 100 | Minimum payout for Power tier ($1) |
| `payout.minimumEnterpriseCents` | cents | 0 | Minimum payout for Enterprise tier ($0) |
| `payout.instantFeeCents` | cents | 250 | Flat fee for instant payout ($2.50) |
| `payout.dailyFeeCents` | cents | 100 | Fee per daily auto-payout ($1.00, Power only) |
| `payout.instantMaxCents` | cents | 25000 | Maximum instant payout amount ($250) |
| `payout.instantEnabled` | boolean | true | Allow instant payout requests (Starter+) |
| `payout.onPlatformFeePaymentEnabled` | boolean | true | Allow paying Twicely fees with Stripe payout balance |
| `payout.onDemandCooldownHours` | number | 24 | Hours between seller-initiated payout requests |
| `payout.newSellerHoldDays` | number | 7 | Extra hold for sellers with < 5 completed orders |
| `payout.newSellerHoldThresholdCents` | cents | 50000 | Threshold ($500) above which new seller hold activates |

---

## 14. Privacy (`privacy`)

### 14.1 Data Retention

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `privacy.retention.messageDays` | number | 730 | Message retention (2 years) |
| `privacy.retention.searchLogDays` | number | 90 | Search log retention |
| `privacy.retention.webhookLogDays` | number | 90 | Webhook log retention |
| `privacy.retention.analyticsEventDays` | number | 365 | Analytics event retention (1 year) |
| `privacy.retention.notificationLogDays` | number | 180 | Notification log retention |
| `privacy.retention.auditLogDays` | number | 2555 | Audit log retention (7 years, compliance) |

### 14.2 GDPR

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `privacy.gdpr.dataExportEnabled` | boolean | true | Allow users to export their data |
| `privacy.gdpr.exportFormats` | array | ["json","csv"] | Available export formats |
| `privacy.gdpr.deletionGracePeriodDays` | number | 30 | Days before permanent deletion |
| `privacy.gdpr.anonymizeOnDeletion` | boolean | true | Anonymize vs hard delete |
| `privacy.gdpr.cookieConsentRequired` | boolean | true | Require cookie consent banner |

---

## 15. Rate Limiting (`rateLimit`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `rateLimit.enabled` | boolean | true | Master switch for rate limiting |
| `rateLimit.guestSearchPerMinute` | number | 60 | Guest search rate limit |
| `rateLimit.loginMaxAttempts` | number | 5 | Failed login attempts before lockout |
| `rateLimit.loginLockoutMinutes` | number | 15 | Lockout duration after max attempts |

---

## 16. Tax & Compliance (`tax`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tax.facilitatorEnabled` | boolean | true | Enable marketplace facilitator tax collection |
| `tax.1099kThresholdCents` | cents | 60000 | IRS reporting threshold ($600) |
| `tax.earlyWarningThresholdCents` | cents | 50000 | Tax info collection trigger ($500) |

---

## 16.1 Accessibility (`accessibility`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `accessibility.enforceMinContrast` | boolean | true | Prevent publishing themes that fail contrast |

---

# PART D: ADMIN UI

## 17. Settings UI at `hub.twicely.co/cfg`

### 17.1 Tab Structure

| Tab | Category | Setting Count | Route |
|-----|----------|--------------|-------|
| ⚙️ Environment | — | Secrets | `/cfg?tab=environment` |
| 🔌 Integrations | — | Providers | `/cfg?tab=integrations` |
| 💰 Fees & Pricing | `fees` | ~40 | `/cfg?tab=fees` |
| 🛍️ Commerce | `commerce` | ~25 | `/cfg?tab=commerce` |
| 📦 Fulfillment | `fulfillment` | ~15 | `/cfg?tab=fulfillment` |
| ⭐ Trust & Quality | `trust` | ~35 | `/cfg?tab=trust` |
| 🔍 Discovery | `discovery` | ~20 | `/cfg?tab=discovery` |
| 📢 Communications | `comms` | ~15 | `/cfg?tab=comms` |
| 💵 Payments | `payments` | ~18 | `/cfg?tab=payments` |
| 🔒 Privacy | `privacy` | ~12 | `/cfg?tab=privacy` |

### 17.2 Every Setting Display Requirements

Every setting in the admin UI MUST show:

1. **Label** — plain English name
2. **Description** — one sentence explaining what it does
3. **Current value** — editable inline
4. **Default** — shown as placeholder or "Default: X"
5. **Type indicator** — $, %, toggle, number, dropdown
6. **Save button** — per-section save (not global)
7. **Change indicator** — visual diff when value differs from saved

### 17.3 Environment Tab

Shows all entries from `environmentSecret` table, grouped by provider (Stripe, Shippo, Resend, etc.). Each secret shows:
- Key name
- Masked value (last 4 characters visible: `••••••••sk_4Zx9`)
- Required badge (if required)
- Last updated timestamp + who updated
- Edit button (opens modal with paste field)
- "Migrate from .env" button (one-time bulk import)

### 17.4 Role Access

| Tab | Required Role |
|-----|--------------|
| Environment | ADMIN |
| Integrations | ADMIN, SRE |
| Fees & Pricing | ADMIN |
| Commerce | ADMIN |
| Fulfillment | ADMIN |
| Trust & Quality | ADMIN |
| Discovery | ADMIN |
| Communications | ADMIN |
| Payments | ADMIN |
| Privacy | ADMIN |

All changes require `AuditEvent` at severity HIGH. Fee changes and provider config changes require severity CRITICAL.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-15 | Initial V3 lock. Migrated from V2's 10-tab platform settings (2,606 lines). Translated to V3's three-axis subscription model, category-based TF, no per-order fees. Added provider system with Adapter → Instance → UsageMapping pattern. Added encryption infrastructure. Every setting from Feature Lock-in §21–§43 "Admin Settings" blocks incorporated. |
| 1.1 | 2026-02-16 | Added `geocoding` service type (§5.3), 2 usage mappings (§5.5), endpoint definition (§5.8.4), full geocoding provider spec (§5.9) with Mapbox, Nominatim, and Google built-in adapters. 10 geocoding settings (§5.9.6). Supports distance search filter, address autocomplete, and future Twicely.local. |
| 1.2 | 2026-02-25 | **v3.2 alignment:** §7 fully rewritten with progressive TF brackets, v3.2 pricing. FVF→TF terminology. Dead tier names removed. |
| 1.3 | 2026-02-26 | **Payout & escrow alignment:** §13.3 rewritten with per-tier payout keys from Pricing Canonical §5.4 (was single flat values). Added §8.4b escrow settings (`commerce.escrow.*`). `payments.*` payout keys renamed to `payout.*` prefix. Incorrect values fixed: $25 min→per-tier, 1.5% instant fee→$2.50 flat, 7-day hold→72hr escrow. |
