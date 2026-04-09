# Canonical 27 — System Health Framework

**Status:** DRAFT (V4)
**Domain:** System health monitoring, doctor checks, SRE dashboard, circuit breakers, status page
**Depends on:** db (schema), jobs (BullMQ cron), casl (RBAC), config (platform_settings)
**Package:** `packages/jobs/src/doctor-checks.ts` (check definitions + runner) + `apps/web/src/lib/monitoring/` (types + runner) + `packages/db/src/schema/health.ts` (persistence)

---

## 1. Purpose

Define how the platform monitors its own health, persists check results, surfaces status to operators, and degrades gracefully when subsystems fail. V4 extends V3's existing doctor check system (8 checks, BullMQ cron, Slack alerts) with persistence, a dashboard, circuit breakers, and a public status page.

V4 intentionally simplifies V2's overengineered approach. V2 had module manifests, lifecycle state machines, provider registries with settings panels, and three separate Prisma models. V4 replaces all of that with: check functions, a cron, a snapshot table, a dashboard. No module lifecycle. No manifests. No provider settings UI.

---

## 2. Core Principles

1. **Side-effect-free checks** -- health checks are read-only. They ping, query, and validate but never mutate state.
2. **5-second timeout per check** -- any check exceeding 5 seconds is marked UNHEALTHY with message "Timeout".
3. **Four-value status enum** -- `HEALTHY`, `DEGRADED`, `UNHEALTHY`, `UNKNOWN`. No other values. Overall status = worst component status.
4. **Cron frequency from platform_settings** -- default every 5 minutes. No hardcoded intervals.
5. **Stale = UNKNOWN** -- snapshots older than `health.staleAfterMinutes` (default 15) render as UNKNOWN on the dashboard.
6. **Dashboard is read-only** -- all staff can view. Only SUPER_ADMIN can trigger ad-hoc runs.
7. **Fail-closed circuit breakers** -- when an external service is marked UNHEALTHY, circuit breaker prevents further calls until the next successful health check.

---

## 3. Existing V3 Code (Keep and Extend)

### 3.1 Type Definitions

`apps/web/src/lib/monitoring/types.ts` defines the canonical types:

```ts
export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface HealthCheckResult {
  name: string;        // e.g., "db.connection"
  module: string;      // e.g., "Database"
  status: ServiceHealthStatus;
  latencyMs: number;
  message: string | null;
  checkedAt: Date;
}

export interface DoctorSummary {
  overall: ServiceHealthStatus;
  checks: HealthCheckResult[];
  checkedAt: Date;
}
```

These types remain canonical. V4 does NOT change them.

### 3.2 Existing Doctor Checks

`packages/jobs/src/doctor-checks.ts` implements 8 checks:

| Check | Module | What It Validates |
|---|---|---|
| `db.connection` | Database | `SELECT 1` succeeds |
| `db.pool` | Database | Connection pool healthy |
| `app.env` | App | Required env vars present |
| `app.optional-env` | App | Optional env vars present |
| `app.settings` | App | `platform_settings` table has rows |
| `valkey.ping` | Valkey | Valkey responds to PING |
| `typesense.health` | Typesense | Typesense `/health` endpoint OK |
| `centrifugo.health` | Centrifugo | Centrifugo API reachable |

### 3.3 Doctor Runner

`apps/web/src/lib/monitoring/doctor-runner.ts` runs checks via `Promise.allSettled` and aggregates into `DoctorSummary`. V4 keeps this and adds persistence after each run.

### 3.4 Cron Integration

`packages/jobs/src/cron-jobs.ts` registers a `cron:health` job (every 5 min) that calls `runAllChecks()` and alerts Slack on failures. V4 extends this to also persist results.

---

## 4. Schema (Drizzle pgTable)

Add to `packages/db/src/schema/health.ts` (new file).

### 4.1 healthSnapshot

Per-check result from each health run. One row per check per run.

```ts
export const healthSnapshot = pgTable('health_snapshot', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  runId:       text('run_id').notNull(),                    // FK to healthRun.id
  checkName:   text('check_name').notNull(),                // e.g. "db.connection"
  module:      text('module').notNull(),                    // e.g. "Database"
  status:      text('status').notNull(),                    // HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN
  message:     text('message'),
  latencyMs:   integer('latency_ms'),
  detailsJson: jsonb('details_json').notNull().default(sql`'{}'`),
  checkedAt:   timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdx:      index('hs_run').on(table.runId),
  checkIdx:    index('hs_check').on(table.checkName, table.checkedAt),
  statusIdx:   index('hs_status').on(table.status),
  moduleIdx:   index('hs_module').on(table.module, table.checkedAt),
}));
```

### 4.2 healthRun

Aggregate record for each complete health check run.

```ts
export const healthRun = pgTable('health_run', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  runType:            text('run_type').notNull().default('scheduled'), // scheduled | interactive | manual
  status:             text('status').notNull().default('UNKNOWN'),     // worst status across all checks
  startedAt:          timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt:         timestamp('finished_at', { withTimezone: true }),
  durationMs:         integer('duration_ms'),
  totalChecks:        integer('total_checks').notNull().default(0),
  healthyCount:       integer('healthy_count').notNull().default(0),
  degradedCount:      integer('degraded_count').notNull().default(0),
  unhealthyCount:     integer('unhealthy_count').notNull().default(0),
  unknownCount:       integer('unknown_count').notNull().default(0),
  triggeredByStaffId: text('triggered_by_staff_id'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runTypeIdx:  index('hr_run_type').on(table.runType, table.startedAt),
  statusIdx:   index('hr_status').on(table.status),
}));
```

### 4.3 healthCheckProvider

Registry of known check providers and their configuration. Populated at app startup.

```ts
export const healthCheckProvider = pgTable('health_check_provider', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  checkName:     text('check_name').notNull().unique(),
  module:        text('module').notNull(),
  description:   text('description'),
  isActive:      boolean('is_active').notNull().default(true),
  timeoutMs:     integer('timeout_ms').notNull().default(5000),
  scheduleGroup: text('schedule_group').notNull().default('default'), // group for selective runs
  lastStatus:    text('last_status'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 5. Health Check Categories

### 5.1 Infrastructure

| Check | Module | Healthy | Degraded | Unhealthy |
|---|---|---|---|---|
| `db.connection` | Database | `SELECT 1` < 200ms | Latency > 500ms | Connection fails |
| `db.pool` | Database | Pool has free connections | Pool > 80% utilized | Pool exhausted |
| `db.migrations` | Database | No pending migrations | -- | Pending migrations exist |
| `valkey.ping` | Valkey | PING < 50ms | Latency > 100ms | Connection fails |
| `typesense.health` | Typesense | `/health` returns OK < 200ms | Latency > 500ms | Connection fails |
| `centrifugo.health` | Centrifugo | API reachable | Connections = 0 (expected > 0) | Connection fails |

### 5.2 External Services

| Check | Module | Healthy | Degraded | Unhealthy |
|---|---|---|---|---|
| `stripe.api` | Stripe | `GET /v1/balance` succeeds | Last webhook > 30 min ago | API returns error |
| `email.resend` | Email | API key valid | Last send > 30 min ago | API returns error |
| `r2.bucket` | Storage | HEAD request succeeds < 1s | Latency > 2000ms | Request fails |
| `shippo.api` | Shipping | API key valid | -- | API returns error |

### 5.3 Application

| Check | Module | Healthy | Degraded | Unhealthy |
|---|---|---|---|---|
| `app.env` | App | All required env vars present | -- | Missing required vars |
| `app.optional-env` | App | All optional vars present | Missing optional vars | -- |
| `app.settings` | App | `platform_settings` has rows | -- | Table empty or inaccessible |

### 5.4 Queue (BullMQ)

| Check | Module | Healthy | Degraded | Unhealthy |
|---|---|---|---|---|
| `bullmq.connection` | BullMQ | Valkey reachable for queues | -- | Connection fails |
| `bullmq.depth` | BullMQ | Waiting jobs < 1000 | Waiting > 1000 | Waiting > 10000 |
| `bullmq.failed` | BullMQ | Failed jobs < 50 | Failed > 50 | Failed > 500 |
| `bullmq.stale` | BullMQ | No stale jobs | Active jobs > 30 min old | Active jobs > 2 hr old |

---

## 6. Performance Budgets

Enforced by health checks and surfaced on the dashboard.

| Category | Target | Degraded | Unhealthy |
|---|---|---|---|
| API response time (p95) | < 200ms | > 500ms | > 2000ms |
| Search latency (Typesense, p95) | < 100ms | > 500ms | > 2000ms |
| DB query time (p95) | < 50ms | > 200ms | > 1000ms |
| Cache hit rate (Valkey) | > 90% | < 80% | < 50% |
| Health check run total | < 10s | > 20s | > 60s |

Performance budgets are informational. They do not block actions -- they generate health check degradation signals.

---

## 7. Circuit Breaker Patterns

### 7.1 Circuit Breaker State Machine

```
CLOSED (normal) --[N failures]--> OPEN (blocking)
OPEN --[timeout expires]--> HALF_OPEN (probing)
HALF_OPEN --[success]--> CLOSED
HALF_OPEN --[failure]--> OPEN
```

### 7.2 Protected Services

| Service | Failure Threshold | Open Duration | Fallback |
|---|---|---|---|
| Stripe API | 3 consecutive failures | 30s | Queue payment for retry |
| Typesense | 3 consecutive failures | 15s | DB fallback search (degraded) |
| Centrifugo | 5 consecutive failures | 60s | Silent degradation (no realtime) |
| Resend (email) | 3 consecutive failures | 60s | Queue email for retry |
| Shippo | 3 consecutive failures | 30s | Cached rates / error message |
| R2 (storage) | 3 consecutive failures | 30s | Error on upload, cache on read |

### 7.3 Implementation

Circuit breaker state stored in Valkey (not DB -- must be fast):
```
circuit:{service}:state = CLOSED | OPEN | HALF_OPEN
circuit:{service}:failures = number
circuit:{service}:lastFailure = ISO timestamp
```

All thresholds configurable via platform_settings:
- `health.circuit.{service}.failureThreshold` (default 3)
- `health.circuit.{service}.openDurationSeconds` (default 30)

---

## 8. Health Endpoints

### 8.1 Public Health (Load Balancer Target)

`GET /api/health` -- no auth required.

```json
{ "status": "ok", "timestamp": "2026-04-09T12:00:00Z" }
```

Returns HTTP 200 if the app server is responding. Returns HTTP 503 if `PLATFORM_DISABLED=true` env var is set or maintenance mode is active.

### 8.2 Deep Health (Staff Only)

`GET /api/health/deep` -- requires staff auth.

```json
{
  "status": "degraded",
  "timestamp": "2026-04-09T12:00:00Z",
  "checks": {
    "database": { "status": "HEALTHY", "latencyMs": 12 },
    "valkey": { "status": "HEALTHY", "latencyMs": 3 },
    "typesense": { "status": "HEALTHY", "latencyMs": 8 },
    "storage": { "status": "HEALTHY", "latencyMs": 45 },
    "bullmq": { "status": "HEALTHY", "pending": 23, "failed": 0 },
    "centrifugo": { "status": "HEALTHY", "connections": 142 },
    "email": { "status": "DEGRADED", "lastSentAt": "2026-04-09T11:58:00Z" },
    "stripe": { "status": "HEALTHY", "lastWebhookAt": "2026-04-09T11:59:30Z" }
  },
  "version": "4.0.1",
  "uptime": 86400,
  "circuitBreakers": {
    "stripe": "CLOSED",
    "typesense": "CLOSED",
    "email": "HALF_OPEN"
  }
}
```

### 8.3 Public Status Page

`GET /status` -- no auth. Simplified view for sellers/buyers.

Shows: operational / degraded / major outage per category (Marketplace, Payments, Search, Notifications). No internal details exposed.

---

## 9. Dashboard UI

### 9.1 Route

`(hub)/cfg/health` -- operator access. Requires ADMIN, SUPER_ADMIN, SRE, or DEVELOPER role.

### 9.2 Tile Grid Layout

```
+------------------+  +------------------+  +------------------+
|   Database       |  |   Valkey         |  |   Typesense      |
|   3/3 HEALTHY    |  |   1/1 HEALTHY    |  |   1/1 HEALTHY    |
|   12ms avg       |  |   3ms            |  |   8ms            |
|   Last: 2m ago   |  |   Last: 2m ago   |  |   Last: 2m ago   |
+------------------+  +------------------+  +------------------+

+------------------+  +------------------+  +------------------+
|   Centrifugo     |  |   App            |  |   BullMQ         |
|   1/1 HEALTHY    |  |   3/3 HEALTHY    |  |   4/4 HEALTHY    |
|   142 conns      |  |                  |  |   23 pending     |
|   Last: 2m ago   |  |   Last: 2m ago   |  |   Last: 2m ago   |
+------------------+  +------------------+  +------------------+

+------------------+  +------------------+  +------------------+
|   Stripe         |  |   Storage (R2)   |  |   Email          |
|   1/1 HEALTHY    |  |   1/1 HEALTHY    |  |   1/1 DEGRADED   |
|   Last wh: 30s   |  |   45ms           |  |   Last: 32m ago  |
|   Last: 2m ago   |  |   Last: 2m ago   |  |   Last: 2m ago   |
+------------------+  +------------------+  +------------------+
```

Tile colors:
- Green border: all checks HEALTHY
- Yellow border: any DEGRADED
- Red border: any UNHEALTHY
- Gray border: UNKNOWN (stale or never-run)

### 9.3 Detail Panel

Clicking a tile expands to show individual checks within that module, with latency, message, timestamp, and trend sparkline (last 24 hours).

### 9.4 Ad-Hoc Run

SUPER_ADMIN sees a "Run Now" button that triggers a one-shot health run via server action. The button is disabled during an active run.

### 9.5 Run History

Below the tile grid: a table of recent `healthRun` rows (last 50), showing overall status, check counts, duration, and trigger type.

### 9.6 Circuit Breaker Status

Sidebar panel showing current circuit breaker states for all protected services.

---

## 10. Kill Switches

Emergency toggles accessible at `(hub)/cfg/kill-switches` (SUPER_ADMIN only). Stored in Valkey for immediate effect. Logged in audit trail.

| Switch | Effect | Use Case |
|---|---|---|
| `PLATFORM_DISABLED` | Returns 503 on all requests | Total platform shutdown |
| `killCheckout` | Disable all new purchases | Payment system issue |
| `killPayouts` | Halt all seller payouts | Fraud investigation |
| `killImports` | Disable crosslister imports | Platform API rate limiting |
| `killPublish` | Disable crosslister outbound | Platform API issue |
| `killRegistration` | Disable new account creation | Bot attack |
| `killLocalTransactions` | Disable Twicely.Local | Safety concern |
| `killAuthentication` | Disable authentication program | Provider issue |
| `readOnlyMode` | No writes to DB | DB maintenance |

Kill switches are instant (no deployment needed). Toggling a kill switch emits an audit event and sends a Slack notification.

---

## 11. Alerting

| Severity | Condition | Notification Channel |
|---|---|---|
| CRITICAL | Any component UNHEALTHY for > 2 consecutive runs | Slack #alerts-critical + email to SRE |
| HIGH | Any component DEGRADED for > 5 consecutive runs | Slack #alerts |
| MEDIUM | BullMQ failed jobs > 50 | Slack #alerts |
| LOW | Single check latency above threshold | Logged only (structured log) |

Alert deduplication: only one alert per check per status transition (not per run). Alerts auto-resolve when check returns to HEALTHY.

Alert configuration via platform_settings:
- `health.alerts.slack.enabled` (default true)
- `health.alerts.slack.webhookUrl` (default empty)
- `health.alerts.email.enabled` (default false)
- `health.alerts.email.recipients` (default empty, comma-separated)

---

## 12. Dependency Health Matrix

Shows which packages depend on which external services. Used by the dashboard to predict blast radius of service failures.

| Service | Dependent Packages |
|---|---|
| PostgreSQL (Neon) | ALL (db is universal dependency) |
| Valkey | auth, jobs, realtime, search (caching), scoring (circuit breakers) |
| Typesense | search, crosslister (listing sync) |
| Centrifugo | realtime, notifications (live push) |
| Stripe | stripe, commerce, subscriptions, finance |
| Resend | email, notifications |
| R2 (Cloudflare) | storage |
| Shippo | commerce (shipping labels) |

---

## 13. Snapshot Persistence

### 13.1 Writer

After each health run, the cron worker:
1. Creates a `healthRun` row with `startedAt` and `runType`.
2. For each check result, inserts a `healthSnapshot` row linked by `runId`.
3. Updates the `healthRun` with counts, overall status, `finishedAt`, and `durationMs`.
4. Updates `healthCheckProvider.lastStatus` and `lastCheckedAt` for each check.

```
persistHealthRun(summary: DoctorSummary, runType: 'scheduled' | 'interactive' | 'manual')
  -> healthRun row + N healthSnapshot rows
```

### 13.2 Cron Integration

The existing `cron:health` task in `cron-jobs.ts` is updated to:
1. Call `runAllChecks()` (unchanged).
2. Call `persistHealthRun(summary, 'scheduled')` (new).
3. If any check is UNHEALTHY, call `sendSlackAlert(summary)` (unchanged).
4. Update circuit breaker states based on results (new).

---

## 14. RBAC

| Permission | Roles |
|---|---|
| `HealthSnapshot:read` | ADMIN, SUPER_ADMIN, SRE, DEVELOPER |
| `HealthRun:create` | SUPER_ADMIN |
| `HealthRun:read` | ADMIN, SUPER_ADMIN, SRE, DEVELOPER |
| `HealthCheckProvider:read` | ADMIN, SUPER_ADMIN, SRE, DEVELOPER |
| `KillSwitch:read` | ADMIN, SUPER_ADMIN |
| `KillSwitch:update` | SUPER_ADMIN |

---

## 15. Platform Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `health.enabled` | boolean | `true` | Global kill switch for health cron |
| `health.staleAfterMinutes` | number | `15` | Mark snapshots as UNKNOWN if older |
| `health.checkTimeoutMs` | number | `5000` | Per-check timeout |
| `jobs.cron.health.pattern` | string | `*/5 * * * *` | Cron schedule for health runs |
| `health.alerts.slack.enabled` | boolean | `true` | Send Slack alerts on UNHEALTHY |
| `health.alerts.slack.webhookUrl` | string | (empty) | Slack webhook URL |
| `health.alerts.email.enabled` | boolean | `false` | Send email alerts on CRITICAL |
| `health.alerts.email.recipients` | string | (empty) | Comma-separated email addresses |
| `health.history.retentionDays` | number | `30` | Auto-purge old snapshots and runs |
| `health.degradedThresholdMs.database` | number | `500` | DB latency degraded threshold |
| `health.degradedThresholdMs.cache` | number | `100` | Valkey latency degraded threshold |
| `health.degradedThresholdMs.search` | number | `500` | Typesense latency degraded threshold |
| `health.degradedThresholdMs.storage` | number | `2000` | R2 latency degraded threshold |
| `health.bullmq.failedJobsWarnThreshold` | number | `50` | Failed jobs to trigger DEGRADED |
| `health.bullmq.failedJobsCriticalThreshold` | number | `500` | Failed jobs to trigger UNHEALTHY |
| `health.bullmq.depthWarnThreshold` | number | `1000` | Queue depth to trigger DEGRADED |
| `health.bullmq.depthCriticalThreshold` | number | `10000` | Queue depth to trigger UNHEALTHY |
| `health.circuit.*.failureThreshold` | number | `3` | Per-service circuit breaker failure count |
| `health.circuit.*.openDurationSeconds` | number | `30` | Per-service circuit breaker open duration |

---

## 16. Data Retention

Health snapshots and runs older than `health.history.retentionDays` (default 30) are purged by the existing `cleanup-audit-archive` job. Add `health_snapshot` and `health_run` to the cleanup target list.

---

## 17. Testing Requirements

| Test Category | Minimum Tests |
|---|---|
| Existing doctor checks (db, valkey, typesense, centrifugo, env, settings) | 8 (already exist) |
| New doctor checks (bullmq, stripe, r2, email, migrations) | 5 |
| Health snapshot persistence | 4 |
| Health run aggregation | 3 |
| Stale detection logic | 2 |
| Circuit breaker state transitions | 6 |
| Dashboard data query | 3 |
| Ad-hoc run trigger | 2 |
| Kill switch toggle + audit | 3 |
| **Total** | **36** |

---

## 18. Out of Scope

| Feature | Decision |
|---|---|
| Module Registry with lifecycle states | Dropped. Module enablement is handled by feature flags (existing `module_registry` table at `/cfg`). |
| Module manifests (JSON config per module) | Dropped. Not needed -- configuration via platform_settings. |
| HealthSettings model (global + per-provider config) | Dropped. All config via platform_settings. |
| Provider detail pages with settings panels | Dropped. Dashboard tile expansion is sufficient. |
| Doctor UI as separate page (`/corp/doctor`) | Merged into `(hub)/cfg/health` dashboard. |
| PagerDuty / OpsGenie integration | Deferred. Slack + email sufficient for V4.0. |
| Custom SLO definitions | Deferred. Performance budgets (Section 6) serve this purpose for now. |
| Distributed tracing (OpenTelemetry) | Deferred. Structured logging via `@twicely/logger` is sufficient for V4.0. |

---

## 19. Migration

```bash
# After adding healthSnapshot, healthRun, healthCheckProvider to packages/db/src/schema/health.ts:
npx drizzle-kit generate --name health_framework
npx drizzle-kit migrate
```

No seed data required -- `healthCheckProvider` rows are upserted on app startup. Snapshots are created by the first cron run.
