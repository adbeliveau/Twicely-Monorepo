# Canonical 36 -- Production Hardening & Observability

**Status:** DRAFT (V4)
**Domain:** platform-ops, system-health
**Depends on:** Canonical 27 (System Health), `packages/stripe/src/webhooks.ts`, `packages/db/src/schema/commerce.ts`, `packages/db/src/schema/finance.ts`, `packages/config`, `@twicely/jobs`
**Package:** `packages/config/src/production/` (new directory), extends `packages/stripe/src/`, extends `packages/db/src/schema/`

---

## 1. Purpose

Harden the V3 monorepo for production traffic. V3 has a working payment pipeline, feature flag kill switches, and webhook idempotency, but is missing structured audit logging, API rate limiting, security headers, production invariant monitoring, data retention enforcement, circuit breakers for external services, and an operational observability framework. This canonical closes those gaps.

---

## 2. Core Principles

1. **Every admin/operator action is audited.** The `auditLog` table is append-only. No deletes, no updates. Retention: 7 years minimum.
2. **Structured logging everywhere.** All log output is JSON with correlation IDs. No `console.log` with plain strings in production code paths.
3. **Rate limits on all public API routes.** Configurable per route type (auth, messaging, search, checkout). Enforced server-side via middleware.
4. **Security headers are non-negotiable.** CSP, CORS, X-Frame-Options, Strict-Transport-Security applied by Next.js middleware.
5. **External service failures are contained.** Circuit breakers prevent cascading failures from Stripe, shipping providers, and AI services.
6. **Global kill switch is fail-safe.** When `kill.platform` is disabled, the middleware returns HTTP 503 for API routes and renders a maintenance page for browser requests. Static assets are still served. Hub is exempt.
7. **Data retention is automated.** Per-table retention policies are enforced by a BullMQ cron job. No manual purging.
8. **Production invariants run on a schedule.** BullMQ cron job runs invariant checks every 6 hours. Failures notify ADMIN staff.

---

## 3. Schema (Drizzle pgTable)

### 3.1 `auditLog` table (new)

File: `packages/db/src/schema/audit.ts` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `actorUserId` | text, nullable | Null for system actions |
| `actorRole` | text, nullable | `buyer`, `seller`, `staff`, `system` |
| `actorIp` | text, nullable | Masked to /24 for privacy |
| `actorUserAgent` | text, nullable | |
| `action` | text, not null | Dotted key, e.g., `rbac.role.create` |
| `category` | `auditCategoryEnum` | `RBAC`, `FINANCE`, `TRUST`, `COMMERCE`, `MODERATION`, `SYSTEM`, `SECURITY`, `SETTINGS`, `MESSAGING` |
| `severity` | `auditSeverityEnum` | `INFO`, `WARNING`, `CRITICAL` |
| `entityType` | text, nullable | e.g., `Role`, `Payout`, `Review` |
| `entityId` | text, nullable | |
| `metaJson` | jsonb, default `'{}'` | Arbitrary context |
| `correlationId` | text, nullable | Request correlation ID for tracing |
| `sessionId` | text, nullable | |
| `createdAt` | timestamptz | |

Indexes: `(action, createdAt)`, `(category, createdAt)`, `(entityType, entityId)`, `(actorUserId, createdAt)`, `(severity, createdAt)`, `(correlationId)`.

Enums to add to `enums.ts`:
```ts
export const auditCategoryEnum = pgEnum('audit_category', [
  'RBAC', 'FINANCE', 'TRUST', 'COMMERCE', 'MODERATION', 'SYSTEM', 'SECURITY', 'SETTINGS', 'MESSAGING',
]);
export const auditSeverityEnum = pgEnum('audit_severity', ['INFO', 'WARNING', 'CRITICAL']);
export const retentionPolicyStatusEnum = pgEnum('retention_policy_status', ['ACTIVE', 'PAUSED', 'DISABLED']);
export const circuitBreakerStateEnum = pgEnum('circuit_breaker_state', ['CLOSED', 'OPEN', 'HALF_OPEN']);
```

### 3.2 `retentionPolicy` table (new)

File: `packages/db/src/schema/audit.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `tableName` | text, not null, unique | Target table name (e.g., `audit_log`, `message_rate_limit`) |
| `retentionDays` | integer, not null | Rows older than this are purged |
| `dateColumn` | text, not null | Column name to check age against (e.g., `created_at`) |
| `purgeStrategy` | text, not null | `hard_delete`, `soft_archive`, `body_redact` |
| `batchSize` | integer, not null, default 1000 | Rows per purge batch |
| `status` | `retentionPolicyStatusEnum` | `ACTIVE`, `PAUSED`, `DISABLED` |
| `lastRunAt` | timestamptz, nullable | |
| `lastPurgedCount` | integer, nullable | |
| `createdAt` | timestamptz | |
| `updatedAt` | timestamptz | |

### 3.3 `circuitBreakerState` table (new)

File: `packages/db/src/schema/audit.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `serviceKey` | text, not null, unique | e.g., `stripe`, `shippo`, `openai`, `typesense` |
| `state` | `circuitBreakerStateEnum` | `CLOSED` (healthy), `OPEN` (tripped), `HALF_OPEN` (testing) |
| `failureCount` | integer, not null, default 0 | Consecutive failures |
| `lastFailureAt` | timestamptz, nullable | |
| `lastSuccessAt` | timestamptz, nullable | |
| `openedAt` | timestamptz, nullable | When the breaker tripped |
| `halfOpenAt` | timestamptz, nullable | When half-open probe started |
| `closedAt` | timestamptz, nullable | When the breaker last recovered |
| `metaJson` | jsonb, default `'{}'` | Last error message, etc. |
| `updatedAt` | timestamptz | |

### 3.4 Schema extensions

**`orderPayment` -- add `stripeTransferId`:**

```ts
// packages/db/src/schema/commerce.ts
stripeTransferId: text('stripe_transfer_id'),
```

**`businessTypeEnum` -- add `NONPROFIT`, `OTHER`:**

```ts
// packages/db/src/schema/enums.ts
export const businessTypeEnum = pgEnum('business_type', ['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP', 'NONPROFIT', 'OTHER']);
```

**`ledgerEntryTypeEnum` -- add `TRANSFER_REVERSAL`:**

Add `TRANSFER_REVERSAL` to the enum. Semantically distinct from `REFUND` (refund is buyer-initiated, transfer reversal is platform/Stripe-initiated clawback).

---

## 4. Audit Log System

### 4.1 Emitter

File: `packages/config/src/production/audit-emitter.ts`

```ts
export async function emitAuditEvent(input: {
  actorUserId?: string;
  actorRole?: string;
  actorIp?: string;
  action: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  correlationId?: string;
}): Promise<string>
```

- Derives category from action prefix if not provided (`rbac.* -> RBAC`, `finance.* -> FINANCE`, etc.).
- Derives severity from known action mappings (`user.suspend -> WARNING`, `finance.reconcile.error -> CRITICAL`).
- Append-only: no update or delete functions are exported.

### 4.2 Mandatory coverage

All of the following actions MUST call `emitAuditEvent`:

- RBAC: `rbac.role.{create,update,delete}`, `rbac.permission.{grant,revoke}`
- Finance: `payout.{execute,cancel}`, `refund.execute`, `hold.{apply,release}`
- Trust: `trust.case.{create,resolve}`, `trust.enforcement.{apply,lift}`
- Moderation: `review.{hide,restore,remove}`, `listing.remove`, `user.{suspend,unsuspend}`
- Settings: `feature_flag.update`, `settings.*.update`, `killswitch.{enable,disable}`
- Security: `login.{success,failed}`, `password.change`, `mfa.{enable,disable}`

### 4.3 Query service

File: `packages/config/src/production/audit-query.ts`

Supports: filter by action, actionPrefix, category, severity, actorUserId, entityType, entityId, date range. Paginated. Read-only. CASL-gated (`read AuditLog`).

---

## 5. Structured Logging

### 5.1 Logger utility

File: `packages/config/src/production/logger.ts`

```ts
export function createLogger(module: string): {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, error?: Error, meta?: Record<string, unknown>): void;
}
```

Output format (JSON, one line per entry):
```json
{
  "timestamp": "2026-04-09T12:00:00.000Z",
  "level": "info",
  "module": "stripe.webhooks",
  "message": "transfer.created processed",
  "correlationId": "req_abc123",
  "meta": { "transferId": "tr_xxx", "orderId": "ord_yyy" }
}
```

### 5.2 Correlation ID

Generated per incoming request via Next.js middleware. Stored in `AsyncLocalStorage` and automatically attached to all log entries and audit events within that request scope.

File: `apps/web/src/lib/middleware/correlation-id.ts`

---

## 6. Error Tracking

### 6.1 Sentry integration

File: `apps/web/src/lib/sentry.ts` (client), `apps/web/src/instrumentation.ts` (server)

- Initialize Sentry with environment, release version, and correlation ID.
- Capture unhandled exceptions and rejected promises.
- Attach user context (userId, role) from session.
- Sample rate: 100% for errors, 10% for transactions (configurable via `system.sentry.transactionSampleRate`).
- DSN from `SENTRY_DSN` environment variable (required in production, optional in development).

---

## 7. Performance Monitoring

### 7.1 Web Vitals

File: `apps/web/src/components/web-vitals.tsx`

Report Core Web Vitals (LCP, FID, CLS, TTFB, INP) to the structured logger. In production, also send to Sentry Performance.

### 7.2 API latency tracking

Middleware records request start time. On response, log:
```json
{
  "route": "/api/listings",
  "method": "GET",
  "status": 200,
  "durationMs": 45,
  "correlationId": "req_abc123"
}
```

Percentile aggregation (p50, p95, p99) is computed by the analytics system (Canonical 15), not in the hot path.

---

## 8. API Rate Limiting

### 8.1 Strategy

Token bucket rate limiting implemented via Valkey (Redis). Each route type has its own bucket configuration.

### 8.2 Route type limits

| Route Type | Requests/min | Burst | Notes |
|---|---|---|---|
| `auth` | 10 | 15 | Login, register, password reset |
| `search` | 60 | 100 | Listing search, autocomplete |
| `messaging` | 30 | 50 | Send message, mark read |
| `checkout` | 10 | 15 | Create order, payment intent |
| `api_general` | 120 | 200 | All other API routes |
| `webhook` | 500 | 1000 | Stripe/external webhooks |

### 8.3 Implementation

File: `apps/web/src/lib/middleware/rate-limit.ts`

Uses Valkey `INCR` + `EXPIRE` for sliding window. Returns `429 Too Many Requests` with `Retry-After` header.

Rate limit headers on every response:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1712678400
```

---

## 9. Security Headers

### 9.1 Headers applied by Next.js middleware

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | See section 9.2 |

### 9.2 CSP policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://images.unsplash.com;
connect-src 'self' https://api.stripe.com https://*.sentry.io wss://*.centrifugo.twicely.co;
frame-src https://js.stripe.com https://www.youtube.com https://www.loom.com;
font-src 'self';
object-src 'none';
base-uri 'self';
```

### 9.3 CORS

```ts
// apps/web/next.config.ts
headers: [
  {
    source: '/api/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ALLOWED_ORIGINS ?? 'https://twicely.co' },
      { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-Correlation-ID' },
      { key: 'Access-Control-Max-Age', value: '86400' },
    ],
  },
]
```

---

## 10. Data Retention Policies

### 10.1 Default policies (seeded)

| Table | Retention Days | Strategy | Date Column |
|---|---|---|---|
| `audit_log` | 2555 (7 years) | `hard_delete` | `created_at` |
| `message_rate_limit` | 7 | `hard_delete` | `window_start` |
| `message_moderation_log` | 365 | `hard_delete` | `created_at` |
| `case_event` | 730 | `hard_delete` | `created_at` |
| `case_csat` | 365 | `hard_delete` | `created_at` |
| `message` (body redact) | 730 | `body_redact` | `created_at` |
| `alert_history` | 90 | `hard_delete` | `created_at` |
| `circuit_breaker_state` | 30 (meta cleanup) | `soft_archive` | `updated_at` |

### 10.2 Enforcement

BullMQ cron job: `system.retention-purge`, daily at 03:00 UTC.

For each active `retentionPolicy`:
1. SELECT rows older than `retentionDays` in batches of `batchSize`.
2. Apply purge strategy (`hard_delete`, `body_redact`, or `soft_archive`).
3. Update `lastRunAt` and `lastPurgedCount`.
4. Log to `auditLog` with `action = 'system.retention.purge'`.

---

## 11. Circuit Breakers

### 11.1 Services protected

| Service Key | Failure Threshold | Open Duration | Half-Open Probes |
|---|---|---|---|
| `stripe` | 5 consecutive | 60 seconds | 1 request |
| `shippo` | 3 consecutive | 120 seconds | 1 request |
| `openai` | 3 consecutive | 300 seconds | 1 request |
| `typesense` | 5 consecutive | 30 seconds | 1 request |
| `centrifugo` | 5 consecutive | 30 seconds | 1 request |
| `sentry` | 10 consecutive | 600 seconds | 1 request |

### 11.2 Implementation

File: `packages/config/src/production/circuit-breaker.ts`

```ts
export async function withCircuitBreaker<T>(
  serviceKey: string,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T>
```

State transitions:
- **CLOSED** (normal): requests pass through. On failure, increment `failureCount`. If `failureCount >= threshold`, transition to OPEN.
- **OPEN**: all requests short-circuit immediately. If `fallback` provided, return fallback value. After `openDuration`, transition to HALF_OPEN.
- **HALF_OPEN**: allow one probe request. On success, transition to CLOSED and reset `failureCount`. On failure, transition back to OPEN.

State is persisted in `circuitBreakerState` table (for cross-instance consistency) and cached in Valkey (for speed).

### 11.3 Graceful degradation

When a circuit breaker is OPEN:
- **Stripe**: queue payment operations for retry. Show "Payment processing delayed" to user.
- **Shippo**: use cached shipping rates (stale but functional). Flag orders for manual label generation.
- **OpenAI/AI**: skip AI features (moderation, suggestions). Features degrade to non-AI mode.
- **Typesense**: fall back to Drizzle `ILIKE` search (slow but functional).
- **Centrifugo**: disable realtime updates. Users see data on next page load.

---

## 12. Global Platform Kill Switch

### 12.1 Behavior

When `kill.platform` feature flag is disabled (platform is OFF):
- API routes (`/api/*`): return HTTP 503 with JSON body `{ "error": "PLATFORM_DISABLED", "message": "Twicely is currently undergoing maintenance." }`.
- Page routes: rewrite to `/maintenance` (static, no DB calls).
- Exempt routes: `/auth/login`, `/api/platform/killswitches`, `/_next/*`, `/favicon.ico`.
- Hub (`hub.twicely.co`): NOT affected. Staff must always access the hub.

### 12.2 Cache TTL

`kill.platform` uses a 10-second Valkey cache TTL (vs 60-second for normal feature flags). Platform comes back online within 10 seconds of re-enabling.

---

## 13. Production Invariant Checks

### 13.1 Invariant definitions

File: `packages/config/src/production/invariants.ts`

| Key | SQL Check | Critical |
|---|---|---|
| `commerce.one_payout_per_order` | `SELECT order_id FROM payout WHERE status='COMPLETED' GROUP BY order_id HAVING COUNT(*)>1` | Yes |
| `commerce.one_review_per_order` | `SELECT order_id FROM review GROUP BY order_id HAVING COUNT(*)>1` | Yes |
| `money.ledger_keys_unique` | `SELECT idempotency_key FROM ledger_entry WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING COUNT(*)>1` | Yes |
| `trust.events_idempotent` | `SELECT event_key FROM trust_event WHERE event_key IS NOT NULL GROUP BY event_key HAVING COUNT(*)>1` | Yes |
| `money.no_negative_payouts` | `SELECT id FROM payout WHERE amount_cents < 0` | Yes |
| `commerce.no_orphan_payments` | `SELECT id FROM order_payment WHERE order_id NOT IN (SELECT id FROM "order")` | Yes |
| `stripe.transfer_ids_linked` | Completed orders without transfer IDs | No (warn) |

### 13.2 BullMQ cron

Schedule: Every 6 hours (`0 */6 * * *`), UTC. On critical failure: notify ADMIN staff. Do NOT auto-enable kill switches.

---

## 14. Missing Stripe Webhook Handlers

### 14.1 `transfer.created`

Record `stripeTransferId` on the `orderPayment` row. Create `TRANSFER` ledger entry.

### 14.2 `transfer.reversed`

Create `TRANSFER_REVERSAL` ledger entries (one per reversal). Immutable -- never modify the original Transfer entry. Notify seller.

### 14.3 `refund.created`

Supplementary to `charge.refunded`. Defensive reconciliation: verify `orderPayment.refundAmountCents` matches. Create audit event.

Handler files:
- `packages/stripe/src/webhook-transfer-handlers.ts` (new)
- `packages/stripe/src/webhook-refund-handler.ts` (extend existing)

---

## 15. Launch Gates

### 15.1 Pre-deployment checklist (automated)

File: `packages/config/src/production/launch-gates.ts`

| Gate | Check | Required |
|---|---|---|
| `schema.migrations_applied` | Drizzle migration table is current | Yes |
| `env.required_vars` | All required env vars present | Yes |
| `invariants.all_critical` | All critical invariants pass | Yes |
| `killswitch.platform_on` | `kill.platform` is enabled | Yes |
| `health.all_providers` | All health providers return PASS or WARN | Yes |
| `stripe.webhook_endpoints` | Required webhook events registered | No |
| `valkey.connected` | Valkey/Redis connection healthy | Yes |
| `typesense.connected` | Typesense connection healthy | No |

### 15.2 Hub UI

`/operations` page: add invariant check results panel, last-run timestamp, manual "Run Now" button, launch gate status dashboard.

---

## 16. Incident Response

### 16.1 Severity levels

| Level | Response Time | Examples |
|---|---|---|
| SEV1 (critical) | 15 min | Platform down, payments failing, data breach |
| SEV2 (high) | 1 hour | Search unavailable, emails not sending, payout delays |
| SEV3 (medium) | 4 hours | Minor feature broken, slow performance |
| SEV4 (low) | 24 hours | Cosmetic issues, non-critical bugs |

### 16.2 Escalation paths

- SEV1/SEV2: Notify ADMIN staff via `system.incident.{sev1,sev2}` notification template. Auto-created helpdesk case with URGENT priority.
- SEV3/SEV4: Logged as system events. Visible on `/operations` dashboard.

---

## 17. RBAC

| Subject | Actions | Who |
|---|---|---|
| `AuditLog` | `read` | ADMIN, SRE |
| `KillSwitch` | `read` | ADMIN, SRE |
| `KillSwitch` | `update` | ADMIN (only) |
| `ProductionInvariant` | `read` | ADMIN, SRE |
| `ProductionInvariant` | `create` (run check) | ADMIN |
| `RetentionPolicy` | `read`, `update` | ADMIN |
| `CircuitBreaker` | `read` | ADMIN, SRE |
| `CircuitBreaker` | `update` (manual trip/reset) | ADMIN |

---

## 18. Platform Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `system.invariantCheck.cronPattern` | string | `0 */6 * * *` | Cron schedule for invariant checks |
| `system.invariantCheck.enabled` | boolean | true | Master switch for invariant checks |
| `system.killswitch.platformCacheTtlMs` | integer | 10000 | Cache TTL for kill.platform |
| `system.retention.cronPattern` | string | `0 3 * * *` | Cron for retention purge |
| `system.retention.enabled` | boolean | true | Master switch for retention purge |
| `system.circuitBreaker.enabled` | boolean | true | Master switch for circuit breakers |
| `system.rateLimit.enabled` | boolean | true | Master switch for API rate limiting |
| `system.sentry.enabled` | boolean | true | Sentry error tracking |
| `system.sentry.transactionSampleRate` | number | 0.1 | Sentry transaction sample rate |
| `system.logging.level` | string | `info` | Minimum log level |
| `stripe.webhook.transferCreated.enabled` | boolean | true | Enable transfer.created handler |
| `stripe.webhook.transferReversed.enabled` | boolean | true | Enable transfer.reversed handler |
| `stripe.webhook.refundCreated.enabled` | boolean | true | Enable refund.created handler |

---

## 19. Out of Scope

- Infrastructure provisioning (Railway, Vercel, AWS config)
- Database backup scheduling (handled by hosting provider)
- CDN configuration (Cloudflare, handled separately)
- APM tools beyond Sentry (Datadog, New Relic -- future consideration)
- Load testing framework (deferred to pre-launch sprint)
- Blue/green deployment strategy (handled by CI/CD pipeline)
- Multi-region failover (single region for V4 launch)
