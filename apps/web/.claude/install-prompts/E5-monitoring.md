# Install Prompt: E5 — Monitoring (Grafana + Prometheus + Loki + Doctor)

**Phase & Step:** `[E5]`
**Feature Name:** Monitoring, Observability & System Health Dashboard
**One-Line Summary:** Build the `/health` and `/health/doctor` hub pages, expose a Prometheus-compatible `/api/metrics` endpoint, wire structured JSON logging for Loki ingestion, create Docker Compose for the Grafana+Prometheus+Loki stack, implement per-service doctor checks, and seed monitoring platform settings.
**Date:** 2026-03-05

## Canonical Sources

The installer MUST read these documents before writing any code:

| Document | Relevance |
|----------|-----------|
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` Section 41 | **Primary spec** — stack (Prometheus, Grafana, Loki), key dashboards, application metrics, alert rules, logging requirements, admin settings keys |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` Section 40 | BullMQ cron jobs table — "Health check ping" every 60 seconds, Prometheus metrics per queue |
| `TWICELY_V3_PAGE_REGISTRY.md` Pages #118, #119 | `/health` (System Health) and `/health/doctor` (Doctor Checks) — both `STAFF(ADMIN, DEVELOPER, SRE)` gate, Build Phase E4 |
| `TWICELY_V3_SCHEMA_v2_0_7.md` Section 14.9, 14.12 | `providerInstance.lastHealthStatus/lastHealthCheckAt/lastHealthLatencyMs/lastHealthError`, `providerHealthLog` table |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` Section 3.5 | DEVELOPER: `can('read', 'HealthCheck')`, SRE: `can('read'+'manage', 'HealthCheck')`, agent permissions matrix |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` Section 5.7 | Provider health check every 15 min, auto-failover after 3 consecutive failures |
| `TWICELY_V3_DECISION_RATIONALE.md` Decision #62 | Railway deployment — Docker containers, all services deploy as containers |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` Section 10.3 | Hub sidebar — "System Health" item at `/health`, roles: `['ADMIN', 'DEVELOPER', 'SRE']` |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns: vi.mock for db/queries, `makeStaffSession` helpers |

---

## 1. PREREQUISITES

| Prerequisite | Status | Notes |
|-------------|--------|-------|
| E3 Admin Dashboard | DONE | Hub shell, layout, sidebar, `staffAuthorize()`, all hub admin pages operational |
| CASL: `HealthCheck` subject | EXISTS | `src/lib/casl/subjects.ts` line 29 |
| CASL: DEVELOPER `can('read', 'HealthCheck')` | EXISTS | `src/lib/casl/platform-abilities.ts` line 67 |
| CASL: SRE `can('manage', 'HealthCheck')` | EXISTS | `src/lib/casl/platform-abilities.ts` lines 72-74 |
| Hub nav: `system-health` item | EXISTS | `src/lib/hub/admin-nav.ts` lines 165-170, roles: `['ADMIN', 'DEVELOPER', 'SRE']` |
| Structured logger | EXISTS | `src/lib/logger.ts` — JSON-formatted logs to stdout/stderr, Loki-compatible |
| `providerInstance` schema | EXISTS | `src/lib/db/schema/providers.ts` — has `lastHealthStatus`, `lastHealthCheckAt`, `lastHealthLatencyMs`, `lastHealthError` |
| `providerHealthLog` schema | EXISTS | `src/lib/db/schema/providers.ts` lines 88-98 |
| `staffAuthorize()` | EXISTS | `src/lib/casl/staff-authorize.ts` — returns `{ ability, session }` |
| `AdminPageHeader` component | EXISTS | `src/components/admin/admin-page-header.tsx` |
| `StatCard` component | EXISTS | `src/components/admin/stat-card.tsx` |
| Cron pattern | EXISTS | `src/app/api/cron/orders/route.ts` — CRON_SECRET Bearer auth pattern |
| `getPlatformSetting()` | EXISTS | `src/lib/queries/platform-settings.ts` |

---

## 2. SCOPE ANALYSIS — What to Build

E5 covers four distinct sub-systems:

1. **Prometheus Metrics Endpoint** — `/api/metrics` route that exposes application counters/gauges/histograms in Prometheus text format
2. **Docker Compose Monitoring Stack** — Grafana + Prometheus + Loki containers, pre-configured dashboards, scrape configs
3. **System Health Hub Pages** — `/health` (overview) and `/health/doctor` (per-service diagnostic checks)
4. **Platform Settings** — Seed `monitoring.*` settings keys, wire logger to read `monitoring.logLevel`

### What is NOT in Scope

- Implementing PagerDuty integration (alert channel for Critical alerts — deferred, Slack webhook suffices at launch)
- Building the Grafana dashboards themselves (those are JSON configs provisioned into Grafana, not application code)
- Implementing BullMQ worker processes (E5 registers the cron API route; actual BullMQ infra is out-of-scope until F-phase)
- Real-time WebSocket push of health status (Centrifugo infra not confirmed deployed)

---

## 3. DATABASE — No New Tables

E5 does NOT create any new database tables. All required schema already exists:

| Table | File | Purpose in E5 |
|-------|------|---------------|
| `providerInstance` | `src/lib/db/schema/providers.ts` | Read `lastHealthStatus`, `lastHealthCheckAt`, `lastHealthLatencyMs`, `lastHealthError` for health dashboard display |
| `providerHealthLog` | `src/lib/db/schema/providers.ts` | Write health check results, read for history on doctor page |
| `platformSetting` | `src/lib/db/schema/platform.ts` | Read/write `monitoring.*` settings |

### Platform Settings to Seed

Per Feature Lock-in Section 41 "Admin Settings":

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `monitoring.alertSlackWebhook` | string | `""` | Slack webhook URL for alert notifications |
| `monitoring.logLevel` | string | `"INFO"` | Minimum log level in production (DEBUG, INFO, WARN, ERROR) |
| `monitoring.metricsRetentionDays` | number | `90` | Prometheus data retention period in days |

---

## 4. EXACTLY WHAT TO BUILD

### 4.1 Prometheus Metrics Endpoint

**Route:** `GET /api/metrics`
**Auth:** Protected by `METRICS_SECRET` Bearer token (env variable, NOT CRON_SECRET — separate secret for metrics scraping). If no secret configured, return 500.
**Response:** `text/plain` in Prometheus exposition format.

**Application Metrics** (from Feature Lock-in Section 41):

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `twicely_http_requests_total` | Counter | `route`, `method`, `status` | Total HTTP requests |
| `twicely_http_request_duration_seconds` | Histogram | `route`, `method` | Request latency |
| `twicely_orders_total` | Counter | `status` | Orders by status |
| `twicely_payments_total` | Counter | `outcome` | Payment attempts by outcome (success/failure) |
| `twicely_listings_active` | Gauge | — | Current active listing count |
| `twicely_users_active_daily` | Gauge | — | DAU count (approximate) |
| `twicely_search_queries_total` | Counter | `type` | Search queries |
| `twicely_search_latency_seconds` | Histogram | — | Search response time |

**Implementation:** Use the `prom-client` npm package (the standard Prometheus client for Node.js). Create a metrics registry singleton. Counters and gauges are collected in-process; the `/api/metrics` endpoint serializes the registry.

**IMPORTANT:** The histogram/counter increments happen in application code (middleware, server actions, etc.). For E5, create the registry, define the metrics, and expose the endpoint. The actual instrumentation wiring into middleware is a separate concern — E5 provides the `recordMetric()` utility functions, but does NOT modify existing middleware or server actions (that would be a massive cross-cutting change). Instead, provide utility functions the codebase can adopt incrementally.

### 4.2 System Health Hub Page (`/health`)

**Route:** `hub.twicely.co/health`
**Gate:** `STAFF(ADMIN, DEVELOPER, SRE)` — ability check: `ability.can('read', 'HealthCheck')`
**Layout:** `hub`
**Title:** `System Health | Twicely Hub`

**Page Content:**

1. **Overall Status Banner** — Aggregate: ALL_HEALTHY (green), DEGRADED (yellow), UNHEALTHY (red). Computed from all doctor check results.

2. **Service Status Grid** — Cards for each service:
   - PostgreSQL (database connectivity + connection pool stats)
   - Valkey (cache connectivity + memory usage)
   - Typesense (search engine health + index count)
   - Stripe (API reachability)
   - Shippo (API reachability)
   - Resend (email delivery health)
   - Centrifugo (WebSocket server status)
   - BullMQ (queue depths, if worker is running)

   Each card shows:
   - Service name + icon
   - Status badge: HEALTHY (green), DEGRADED (yellow), UNHEALTHY (red), UNKNOWN (gray)
   - Last check timestamp
   - Response latency in ms
   - Error message (if unhealthy)

3. **Provider Health Section** — Read from `providerInstance` table. Show all configured provider instances with their `lastHealthStatus`, `lastHealthCheckAt`, `lastHealthLatencyMs`.

4. **Quick Actions** (SRE only — `ability.can('manage', 'HealthCheck')`):
   - "Run All Checks" button — triggers a full doctor check run
   - "View Doctor Details" link to `/health/doctor`

### 4.3 Doctor Checks Hub Page (`/health/doctor`)

**Route:** `hub.twicely.co/health/doctor`
**Gate:** `STAFF(ADMIN, DEVELOPER, SRE)` — same as `/health`
**Layout:** `hub`
**Title:** `Doctor Checks | Twicely Hub`

**Page Content:**

Per-module health verification. Each check is a server action that probes a specific dependency and returns structured results.

**Doctor Check Definitions:**

| Module | Check Name | What It Tests | Pass Criteria |
|--------|-----------|---------------|---------------|
| Database | `db.connection` | Run `SELECT 1` on PostgreSQL | Query succeeds in < 1s |
| Database | `db.migrations` | Compare Drizzle schema version | No pending migrations |
| Database | `db.pool` | Check active/idle/total connections | Active < 80% of max |
| Valkey | `valkey.ping` | Send PING to Valkey | PONG response in < 100ms |
| Valkey | `valkey.memory` | Check `INFO memory` | Used memory < 80% of maxmemory |
| Typesense | `typesense.health` | Hit `/health` endpoint | Status 200 |
| Typesense | `typesense.collections` | List collections | Expected collections exist |
| Stripe | `stripe.api` | List balance (idempotent read) | API key valid, response in < 2s |
| Shippo | `shippo.api` | Retrieve address validation test | API key valid |
| Resend | `resend.api` | List domains | API key valid |
| Centrifugo | `centrifugo.health` | Hit `/api` info endpoint | Status 200 |
| App | `app.env` | Check required env vars are set | All required vars present |
| App | `app.settings` | Query platform_setting count | > 0 settings exist |

**Page Layout:**
- Table with columns: Module, Check, Status, Latency, Message, Last Run
- "Run All Checks Now" button (SRE only — `ability.can('manage', 'HealthCheck')`)
- Auto-refreshes results after running checks
- Individual "Recheck" button per row

### 4.4 Structured Logger Enhancement

The existing logger at `src/lib/logger.ts` already outputs structured JSON. E5 enhances it:

1. **Add `requestId` and `userId` fields** — Every log line should include these when available. Create a `LogContext` utility that middleware can populate.
2. **Read `monitoring.logLevel` from platform settings** — Cache the value (re-read every 5 minutes) so that log level can be changed from the admin UI without restart. Fallback: `process.env.LOG_LEVEL` or `"INFO"`.
3. **Add `route` field** — For request-scoped logs.

**IMPORTANT:** Do NOT modify the existing logger signature in a breaking way. Add the context enrichment as optional parameters/wrappers. Existing callers must continue to work unchanged.

### 4.5 Docker Compose Monitoring Stack

Create `docker/monitoring/docker-compose.yml` with:

1. **Prometheus** — Scrapes `/api/metrics` every 15s. Config in `docker/monitoring/prometheus/prometheus.yml`.
2. **Grafana** — Pre-provisioned dashboards and Prometheus + Loki data sources. Config in `docker/monitoring/grafana/`.
3. **Loki** — Receives logs from the Next.js app. Config in `docker/monitoring/loki/loki-config.yml`.
4. **Promtail** (log shipper) — Tails the app's stdout/stderr and ships to Loki. Config in `docker/monitoring/promtail/promtail-config.yml`.

**Grafana Dashboard Provisioning:**

Per Feature Lock-in Section 41, provision these dashboard JSON files:

| Dashboard File | Panels |
|---------------|--------|
| `platform-overview.json` | Active users, orders/hour, revenue today, error rate, p95 latency |
| `api-performance.json` | Request rate, latency by route, error rate by route |
| `background-jobs.json` | Queue depth, throughput, DLQ depth, job latency per queue |
| `infrastructure.json` | CPU, memory, disk, PostgreSQL connections, Valkey memory |

**NOTE:** These are starter dashboards. The JSON files define panel structure with placeholder queries against the Prometheus metrics defined in 4.1. They will show data once the app is instrumented and metrics are flowing.

**Alert Rules** (Prometheus alerting rules in `docker/monitoring/prometheus/alerts.yml`):

Per Feature Lock-in Section 41:

| Alert | Condition | Severity | Label |
|-------|-----------|----------|-------|
| HighErrorRate | `rate(twicely_http_requests_total{status=~"5.."}[5m]) / rate(twicely_http_requests_total[5m]) > 0.05` | critical | |
| SlowAPI | `histogram_quantile(0.95, rate(twicely_http_request_duration_seconds_bucket[10m])) > 2` | warning | |
| PaymentFailures | `rate(twicely_payments_total{outcome="failure"}[5m]) / rate(twicely_payments_total[5m]) > 0.1` | critical | |
| DLQGrowing | `twicely_bullmq_queue_depth{queue="dead-letter"} > 100` | warning | |
| DatabaseConnections | `twicely_db_connections_active / twicely_db_connections_max > 0.8` | warning | |
| DiskSpace | `node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.15` | warning | |

### 4.6 Health Check Cron Endpoint

**Route:** `GET /api/cron/health`
**Auth:** `CRON_SECRET` Bearer token (same pattern as `/api/cron/orders`)
**Purpose:** Called every 60 seconds (Feature Lock-in Section 40 cron table). Runs the doctor checks, writes results to `providerHealthLog` for provider checks, and emits metrics.

**Behavior:**
1. Run all doctor checks defined in 4.3
2. For provider-backed checks, write result to `providerHealthLog` and update `providerInstance.lastHealthStatus/lastHealthCheckAt/lastHealthLatencyMs/lastHealthError`
3. If any check fails and `monitoring.alertSlackWebhook` is configured, send Slack alert
4. Return JSON summary: `{ healthy: boolean, checks: Array<{ name, status, latencyMs, error? }> }`

### 4.7 Seed Monitoring Platform Settings

Add monitoring settings to the seed script. Pattern: append to the existing seed in `src/lib/db/seed.ts` or a new `seed-monitoring.ts` file.

---

## 5. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- No `Redis` — use `Valkey` everywhere (variable names, comments, UI labels)
- No `Bull` without `MQ` — always `BullMQ`
- No `FVF` or `Final Value Fee` — use `TF` / `Transaction Fee`
- No `dashboard` in route paths — hub routes use `/d`, `/health`, etc.
- No `admin` in route paths — hub uses `hub.twicely.co`

### Tech Stack
- No `Meilisearch` — Typesense for search health checks
- No `Soketi`/`Pusher` — Centrifugo for real-time health checks
- No `Nodemailer`/`SES` — Resend for email health checks
- No `Redis` client — Valkey client (ioredis with Valkey endpoint)
- No `Zustand`/`Redux` — server state via `staffAuthorize()` + query functions

### Code Patterns
- `strict: true` TypeScript — zero `as any`, zero `@ts-ignore`
- All files under 300 lines
- `staffAuthorize()` on every hub page, `ability.can()` checks before data operations
- No hardcoded secrets — all from `process.env` or `platform_setting`
- No `console.log` — use the structured `logger`
- Explicit field mapping (never spread request bodies)
- Zod `.strict()` on any input schemas

### Business Logic
- DEVELOPER can `read` HealthCheck only — cannot trigger checks
- SRE can `read` AND `manage` HealthCheck — can trigger checks
- ADMIN gets `manage('all')` which includes HealthCheck
- Doctor checks are READ-ONLY probes — they must NEVER modify state
- Health check results are NOT stored in a new table — provider checks go to `providerHealthLog`, app checks return ephemeral results
- The `/api/metrics` endpoint does NOT require staff auth — it uses a separate `METRICS_SECRET` for Prometheus scraping

### Gotchas from Canonical
- Page Registry lists `/health` and `/health/doctor` under Build Phase "E4", but Build Sequence Tracker lists them under E5. The tracker is authoritative — E5 is correct.
- Feature Lock-in section 41 says `/health` not `/health/overview` — the route is `/health` directly
- Actors Canonical uses `/corp/health/*` (V2 naming) but V3 uses hub subdomain routes: `hub.twicely.co/health` and `hub.twicely.co/health/doctor`
- The Platform Settings Canonical does NOT have a dedicated monitoring section. The monitoring settings keys (`monitoring.alertSlackWebhook`, `monitoring.logLevel`, `monitoring.metricsRetentionDays`) are defined ONLY in Feature Lock-in Section 41 "Admin Settings" block.
- The Prometheus metrics names in the canonical use bare names (`http_requests_total`). The implementation should prefix all with `twicely_` to avoid collisions.

---

## 6. ACCEPTANCE CRITERIA

### Health Pages
- [ ] `/health` page loads for staff with ADMIN, DEVELOPER, or SRE roles
- [ ] `/health` page returns 403 (redirects to login) for unauthenticated users
- [ ] `/health` page returns 403 for staff with SUPPORT or MODERATION roles only
- [ ] `/health` shows service status cards for: PostgreSQL, Valkey, Typesense, Stripe, Shippo, Resend, Centrifugo
- [ ] Each service card shows: name, status badge (HEALTHY/DEGRADED/UNHEALTHY/UNKNOWN), last check time, latency, error message
- [ ] Overall status banner computes aggregate from all checks
- [ ] "Run All Checks" button visible only for SRE and ADMIN (not DEVELOPER)
- [ ] `/health/doctor` page shows per-module check table with all 13 checks listed in Section 4.3
- [ ] `/health/doctor` "Run All Checks Now" button triggers checks and refreshes results
- [ ] Provider instances section shows data from `providerInstance` table

### Metrics Endpoint
- [ ] `GET /api/metrics` returns 401 without Bearer token
- [ ] `GET /api/metrics` returns 401 with wrong Bearer token
- [ ] `GET /api/metrics` returns 500 if `METRICS_SECRET` env var not set
- [ ] `GET /api/metrics` returns `text/plain` Prometheus exposition format with valid token
- [ ] Response includes all 8 metric families defined in Section 4.1
- [ ] Counter metrics include help text and type declaration
- [ ] Histogram metrics include `_bucket`, `_sum`, `_count` suffixes

### Docker Monitoring Stack
- [ ] `docker/monitoring/docker-compose.yml` defines Prometheus, Grafana, Loki, Promtail services
- [ ] Prometheus config scrapes the app's `/api/metrics` endpoint
- [ ] Grafana has provisioned data sources for Prometheus and Loki
- [ ] 4 dashboard JSON files exist and are valid JSON
- [ ] Alert rules file defines all 6 alerts from Section 4.5
- [ ] `docker compose up` from `docker/monitoring/` starts all services (verified by running)

### Logger Enhancement
- [ ] Existing logger calls (`logger.info(...)`, etc.) continue to work unchanged
- [ ] New `createRequestLogger()` utility accepts `requestId`, `userId`, `route`
- [ ] Logger reads `monitoring.logLevel` from platform settings (with caching)
- [ ] Debug logs suppressed in production when logLevel is INFO (default)

### Health Check Cron
- [ ] `GET /api/cron/health` returns 401 without CRON_SECRET
- [ ] `GET /api/cron/health` runs all doctor checks and returns JSON summary
- [ ] Provider check results written to `providerHealthLog` table
- [ ] Provider instance `lastHealthStatus` and related fields updated after check

### Platform Settings
- [ ] `monitoring.alertSlackWebhook` seeded with empty string default
- [ ] `monitoring.logLevel` seeded with "INFO" default
- [ ] `monitoring.metricsRetentionDays` seeded with 90 default

### Authorization
- [ ] No banned terms appear anywhere in UI or code
- [ ] All routes use correct prefixes (`/health`, `/health/doctor`, `/api/metrics`, `/api/cron/health`)
- [ ] CASL `ability.can('read', 'HealthCheck')` checked on both hub pages
- [ ] CASL `ability.can('manage', 'HealthCheck')` checked before "Run All Checks" action
- [ ] TypeScript: 0 errors
- [ ] All files under 300 lines
- [ ] Test count >= BASELINE_TESTS (2117)

---

## 7. TEST REQUIREMENTS

### Unit Tests

**Doctor checks service tests** (`src/lib/monitoring/__tests__/doctor-checks.test.ts`):
- `db.connection check returns HEALTHY when SELECT 1 succeeds`
- `db.connection check returns UNHEALTHY when query throws`
- `db.connection check includes latency in result`
- `valkey.ping check returns HEALTHY on PONG response`
- `valkey.ping check returns UNHEALTHY on timeout`
- `typesense.health check returns HEALTHY on 200`
- `typesense.health check returns UNHEALTHY on non-200`
- `stripe.api check returns HEALTHY on valid key`
- `stripe.api check returns UNHEALTHY when STRIPE_SECRET_KEY missing`
- `app.env check returns UNHEALTHY when required vars missing`
- `app.settings check returns HEALTHY when settings exist`
- `runAllChecks aggregates results correctly`
- `runAllChecks returns overall UNHEALTHY if any check fails`
- `runAllChecks returns overall DEGRADED if any check is DEGRADED`

**Metrics registry tests** (`src/lib/monitoring/__tests__/metrics.test.ts`):
- `registry exports Prometheus text format`
- `incrementHttpRequest increments counter with labels`
- `observeHttpDuration records histogram observation`
- `setActiveListings sets gauge value`
- `all metrics include HELP and TYPE declarations`

**Logger enhancement tests** (`src/lib/__tests__/logger-enhanced.test.ts`):
- `createRequestLogger includes requestId in output`
- `createRequestLogger includes userId when provided`
- `createRequestLogger includes route when provided`
- `logger respects monitoring.logLevel setting`
- `logger defaults to INFO when setting not found`

### Integration Tests

**Health page authorization tests** (`src/lib/queries/__tests__/health-checks.test.ts`):
- `getServiceHealthSummary returns all service check results`
- `getProviderHealthStatus reads from providerInstance table`
- `writeProviderHealthResult updates providerInstance and inserts providerHealthLog`

**Cron health endpoint tests** (`src/app/api/cron/__tests__/health.test.ts`):
- `GET /api/cron/health returns 401 without auth header`
- `GET /api/cron/health returns 401 with wrong secret`
- `GET /api/cron/health returns 200 with valid CRON_SECRET`

### Edge Cases
- Typesense/Valkey/Centrifugo not running (connection refused) — check returns UNHEALTHY, not crash
- Stripe API key invalid — check returns UNHEALTHY with message, not unhandled error
- Platform settings table empty — logger defaults to INFO
- Metrics endpoint called with no metrics collected yet — returns valid empty Prometheus format
- Very slow health check (>5s) — timeout and return UNHEALTHY with "Timeout" message

---

## 8. FILE APPROVAL LIST

### New Files (24)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/app/(hub)/health/page.tsx` | System Health hub page — service status grid, provider health |
| 2 | `src/app/(hub)/health/doctor/page.tsx` | Doctor Checks hub page — per-module check table with run button |
| 3 | `src/app/api/metrics/route.ts` | Prometheus metrics endpoint — `/api/metrics` with Bearer auth |
| 4 | `src/app/api/cron/health/route.ts` | Health check cron — runs doctor checks, writes provider health |
| 5 | `src/lib/monitoring/metrics.ts` | Prometheus metrics registry — counters, gauges, histograms using prom-client |
| 6 | `src/lib/monitoring/doctor-checks.ts` | Doctor check definitions — per-service health probe functions |
| 7 | `src/lib/monitoring/doctor-runner.ts` | Doctor runner — executes all checks, aggregates results, reports |
| 8 | `src/lib/monitoring/types.ts` | Shared types — HealthCheckResult, ServiceStatus, DoctorCheckResult |
| 9 | `src/lib/monitoring/slack-alert.ts` | Slack webhook alert sender — sends alerts when checks fail |
| 10 | `src/lib/queries/health-checks.ts` | Queries — getProviderHealthStatus, getServiceHealthSummary |
| 11 | `src/lib/actions/health-checks.ts` | Server actions — runDoctorChecks (manage HealthCheck gate) |
| 12 | `src/components/admin/health-status-card.tsx` | Service status card component — name, badge, latency, error |
| 13 | `src/components/admin/health-status-banner.tsx` | Overall health status banner — aggregated green/yellow/red |
| 14 | `src/components/admin/doctor-check-table.tsx` | Doctor check results table — module, check, status, latency, message |
| 15 | `src/components/admin/run-checks-button.tsx` | "Run All Checks" client component — calls server action, shows loading |
| 16 | `src/lib/monitoring/__tests__/doctor-checks.test.ts` | Doctor checks unit tests |
| 17 | `src/lib/monitoring/__tests__/metrics.test.ts` | Metrics registry unit tests |
| 18 | `src/lib/__tests__/logger-enhanced.test.ts` | Logger enhancement tests |
| 19 | `src/lib/queries/__tests__/health-checks.test.ts` | Health queries integration tests |
| 20 | `docker/monitoring/docker-compose.yml` | Docker Compose for Grafana + Prometheus + Loki + Promtail |
| 21 | `docker/monitoring/prometheus/prometheus.yml` | Prometheus scrape config — targets app `/api/metrics` |
| 22 | `docker/monitoring/prometheus/alerts.yml` | Prometheus alert rules — 6 alert definitions |
| 23 | `docker/monitoring/loki/loki-config.yml` | Loki configuration — local storage, retention |
| 24 | `docker/monitoring/promtail/promtail-config.yml` | Promtail config — ships app logs to Loki |

### Grafana Provisioning Files (6)

| # | File Path | Description |
|---|-----------|-------------|
| 25 | `docker/monitoring/grafana/provisioning/datasources/datasources.yml` | Auto-provision Prometheus + Loki data sources |
| 26 | `docker/monitoring/grafana/provisioning/dashboards/dashboards.yml` | Dashboard provider config — load JSON from directory |
| 27 | `docker/monitoring/grafana/dashboards/platform-overview.json` | Grafana dashboard: Platform Overview panels |
| 28 | `docker/monitoring/grafana/dashboards/api-performance.json` | Grafana dashboard: API Performance panels |
| 29 | `docker/monitoring/grafana/dashboards/background-jobs.json` | Grafana dashboard: Background Jobs panels |
| 30 | `docker/monitoring/grafana/dashboards/infrastructure.json` | Grafana dashboard: Infrastructure panels |

### Modified Files (3)

| # | File Path | Change Description |
|---|-----------|-------------------|
| 31 | `src/lib/logger.ts` | Add `createRequestLogger()`, log level from platform settings (caching) |
| 32 | `src/lib/db/seed.ts` OR `src/lib/db/seed/seed-monitoring.ts` | Seed `monitoring.*` platform settings |
| 33 | `package.json` | Add `prom-client` dependency |

**Total: 30 new files + 3 modified files = 33 files**

---

## 9. PARALLEL STREAMS

This feature has 33 files across 4 independent sub-systems. Decompose into 5 streams.

### Dependency Graph

```
Stream A (Types + Metrics Registry)
    |
    +---> Stream B (Doctor Checks + Queries + Actions + Cron)
    |         |
    |         +---> Stream D (Hub Pages + Components)
    |
    +---> Stream C (Docker Monitoring Stack)

Stream E (Logger Enhancement + Seed) — independent, no deps
```

### Stream A: Types + Metrics Registry (3 files)

**Files:**
1. `src/lib/monitoring/types.ts`
2. `src/lib/monitoring/metrics.ts`
3. `src/app/api/metrics/route.ts`

**Interface Contract — types.ts:**

```typescript
export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface HealthCheckResult {
  name: string;           // e.g., "db.connection"
  module: string;         // e.g., "Database"
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

export interface ProviderHealthRow {
  instanceId: string;
  instanceName: string;
  displayName: string;
  adapterName: string;
  serviceType: string;
  status: string | null;       // lastHealthStatus
  lastCheckAt: Date | null;
  latencyMs: number | null;
  error: string | null;
}
```

**Interface Contract — metrics.ts:**

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const metricsRegistry: Registry;

// Utility functions for instrumenting code
export function incrementHttpRequest(route: string, method: string, status: number): void;
export function observeHttpDuration(route: string, method: string, durationSeconds: number): void;
export function incrementOrder(status: string): void;
export function incrementPayment(outcome: string): void;
export function setActiveListings(count: number): void;
export function setDailyActiveUsers(count: number): void;
export function incrementSearchQuery(type: string): void;
export function observeSearchLatency(durationSeconds: number): void;
export function getMetricsText(): Promise<string>;
```

**Implementation Details:**

`metrics.ts`:
- Create a `Registry` instance (NOT the default global registry — use a custom one)
- Define all 8 metrics from Section 4.1 with `twicely_` prefix
- Export utility functions that wrap `counter.inc()` and `histogram.observe()`
- Export `getMetricsText()` that calls `registry.metrics()`

`route.ts` (`/api/metrics`):
- Read `METRICS_SECRET` from `process.env`
- If not set, return 500 `{ error: 'Metrics endpoint not configured' }`
- Verify `Authorization: Bearer <METRICS_SECRET>` header
- Call `getMetricsText()` and return as `text/plain; version=0.0.4; charset=utf-8`

### Stream B: Doctor Checks + Queries + Actions + Cron (6 files + 2 test files)

**Depends on:** Stream A (imports `types.ts`)

**Files:**
1. `src/lib/monitoring/doctor-checks.ts`
2. `src/lib/monitoring/doctor-runner.ts`
3. `src/lib/monitoring/slack-alert.ts`
4. `src/lib/queries/health-checks.ts`
5. `src/lib/actions/health-checks.ts`
6. `src/app/api/cron/health/route.ts`
7. `src/lib/monitoring/__tests__/doctor-checks.test.ts`
8. `src/lib/queries/__tests__/health-checks.test.ts`

**Types imported from Stream A (inlined for self-containment):**

```typescript
type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

interface HealthCheckResult {
  name: string;
  module: string;
  status: ServiceHealthStatus;
  latencyMs: number;
  message: string | null;
  checkedAt: Date;
}

interface DoctorSummary {
  overall: ServiceHealthStatus;
  checks: HealthCheckResult[];
  checkedAt: Date;
}

interface ProviderHealthRow {
  instanceId: string;
  instanceName: string;
  displayName: string;
  adapterName: string;
  serviceType: string;
  status: string | null;
  lastCheckAt: Date | null;
  latencyMs: number | null;
  error: string | null;
}
```

**Implementation Details:**

`doctor-checks.ts`:
- Define each check as an async function returning `HealthCheckResult`
- Each check has a 5-second timeout — if exceeded, return UNHEALTHY with "Timeout" message
- Wrap each check in try/catch — connection errors return UNHEALTHY, never throw
- Export an array of check definitions: `{ name, module, fn }`

Example check pattern:
```typescript
async function checkDbConnection(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      name: 'db.connection',
      module: 'Database',
      status: 'HEALTHY',
      latencyMs: Date.now() - start,
      message: null,
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      name: 'db.connection',
      module: 'Database',
      status: 'UNHEALTHY',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date(),
    };
  }
}
```

For Valkey: use `ioredis` (already a dependency via BullMQ). Connect to `process.env.VALKEY_URL`.
For Typesense: use fetch to `process.env.TYPESENSE_URL/health`.
For Stripe: use the Stripe SDK `stripe.balance.retrieve()` (idempotent read).
For Shippo: use fetch to Shippo API with API key header (address validation test call).
For Resend: use the Resend SDK to list domains.
For Centrifugo: use fetch to `process.env.CENTRIFUGO_API_URL/api/info`.
For app.env: check that `DATABASE_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `CRON_SECRET`, `METRICS_SECRET` are all defined.
For app.settings: query `SELECT COUNT(*) FROM platform_setting`.

`doctor-runner.ts`:
- Import all check definitions from `doctor-checks.ts`
- `runAllChecks()`: execute all checks in parallel with `Promise.allSettled()`
- Compute `overall`: UNHEALTHY if any UNHEALTHY, DEGRADED if any DEGRADED, HEALTHY otherwise
- Return `DoctorSummary`

`slack-alert.ts`:
- `sendSlackAlert(summary: DoctorSummary): Promise<void>`
- Read `monitoring.alertSlackWebhook` from platform settings
- If empty/null, silently return (no-op)
- POST to webhook URL with formatted message: service name, status, error details
- Wrap in try/catch — alert failures must not crash the health check

`health-checks.ts` (queries):
- `getProviderHealthStatus(): Promise<ProviderHealthRow[]>` — join `providerInstance` with `providerAdapter` for display names
- `writeProviderHealthResult(instanceId, status, latencyMs, error): Promise<void>` — update `providerInstance` fields and insert into `providerHealthLog`

`health-checks.ts` (actions):
- `'use server'`
- `runDoctorChecksAction(): Promise<DoctorSummary>`
- Must call `staffAuthorize()` and check `ability.can('manage', 'HealthCheck')` — throws ForbiddenError if not SRE/ADMIN
- Calls `runAllChecks()` from doctor-runner
- For provider-backed checks, calls `writeProviderHealthResult()`
- Returns the `DoctorSummary`

`route.ts` (`/api/cron/health`):
- Same CRON_SECRET pattern as `/api/cron/orders`
- Calls `runAllChecks()` directly (no CASL — cron auth is via secret)
- Writes provider results
- Calls `sendSlackAlert()` if any check is UNHEALTHY
- Returns JSON: `{ healthy: boolean, checksRun: number, failed: number, checks: [...] }`

### Stream C: Docker Monitoring Stack (8 files)

**Depends on:** Nothing (fully independent of application code)

**Files:**
1. `docker/monitoring/docker-compose.yml`
2. `docker/monitoring/prometheus/prometheus.yml`
3. `docker/monitoring/prometheus/alerts.yml`
4. `docker/monitoring/loki/loki-config.yml`
5. `docker/monitoring/promtail/promtail-config.yml`
6. `docker/monitoring/grafana/provisioning/datasources/datasources.yml`
7. `docker/monitoring/grafana/provisioning/dashboards/dashboards.yml`
8. `docker/monitoring/grafana/dashboards/platform-overview.json`

Plus 3 more dashboard JSON files (api-performance, background-jobs, infrastructure).

**Implementation Details:**

`docker-compose.yml`:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.51.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=90d'

  grafana:
    image: grafana/grafana:10.4.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
      - grafana-data:/var/lib/grafana

  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log
    command: -config.file=/etc/promtail/config.yml

volumes:
  prometheus-data:
  grafana-data:
  loki-data:
```

`prometheus.yml`:
- Global scrape interval: 15s
- Scrape job `twicely-app` targeting `host.docker.internal:3000/api/metrics` with Bearer auth
- Alert rules file: `/etc/prometheus/alerts.yml`

`alerts.yml`:
- Define all 6 alert rules from Section 4.5

Grafana provisioning:
- `datasources.yml`: Prometheus at `http://prometheus:9090`, Loki at `http://loki:3100`
- `dashboards.yml`: Load from `/var/lib/grafana/dashboards`

Dashboard JSON files:
- Each dashboard has a unique UID, title, and panel array
- Panels reference `twicely_*` metrics with appropriate Prometheus queries
- Use standard Grafana panel types: stat, timeseries, table, gauge

### Stream D: Hub Pages + Components (5 files)

**Depends on:** Stream A (types), Stream B (queries + actions)

**Files:**
1. `src/app/(hub)/health/page.tsx`
2. `src/app/(hub)/health/doctor/page.tsx`
3. `src/components/admin/health-status-card.tsx`
4. `src/components/admin/health-status-banner.tsx`
5. `src/components/admin/doctor-check-table.tsx`
6. `src/components/admin/run-checks-button.tsx`

**Types imported (inlined):**

```typescript
type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

interface HealthCheckResult {
  name: string;
  module: string;
  status: ServiceHealthStatus;
  latencyMs: number;
  message: string | null;
  checkedAt: Date;
}

interface DoctorSummary {
  overall: ServiceHealthStatus;
  checks: HealthCheckResult[];
  checkedAt: Date;
}

interface ProviderHealthRow {
  instanceId: string;
  instanceName: string;
  displayName: string;
  adapterName: string;
  serviceType: string;
  status: string | null;
  lastCheckAt: Date | null;
  latencyMs: number | null;
  error: string | null;
}
```

**Implementation Details:**

`/health/page.tsx`:
- Server component
- `staffAuthorize()` at top — extract `ability` and `session`
- Check `ability.can('read', 'HealthCheck')` — if false, throw ForbiddenError
- Query provider health: `getProviderHealthStatus()`
- Run a lightweight summary check (cached or from last cron run, NOT a full doctor run on page load)
- Metadata: `{ title: 'System Health | Twicely Hub' }`
- Render: `AdminPageHeader`, `HealthStatusBanner`, service status cards grid, provider health section
- "Run All Checks" button visible only if `ability.can('manage', 'HealthCheck')`
- Link to `/health/doctor` for detailed checks

`/health/doctor/page.tsx`:
- Server component
- `staffAuthorize()` + `ability.can('read', 'HealthCheck')` check
- Shows the full doctor checks table
- "Run All Checks Now" button (client component `RunChecksButton`)
- Metadata: `{ title: 'Doctor Checks | Twicely Hub' }`

`health-status-card.tsx`:
- Props: `name: string`, `status: ServiceHealthStatus`, `latencyMs: number | null`, `lastCheckAt: Date | null`, `error: string | null`, `icon?: ReactNode`
- Status badge colors: HEALTHY = green, DEGRADED = yellow, UNHEALTHY = red, UNKNOWN = gray
- Show latency as `{N}ms`
- Show error message in red if present

`health-status-banner.tsx`:
- Props: `status: ServiceHealthStatus`
- Full-width banner: green "All Systems Operational", yellow "Some Services Degraded", red "System Issues Detected"

`doctor-check-table.tsx`:
- Props: `checks: HealthCheckResult[]`
- Table columns: Module, Check Name, Status (badge), Latency (ms), Message, Last Run (relative time)
- Group rows by module for visual clarity

`run-checks-button.tsx`:
- `'use client'`
- Calls `runDoctorChecksAction()` server action
- Shows loading spinner while running
- On completion, displays results or triggers page refresh via `router.refresh()`
- Handles errors gracefully (show toast or inline error)

### Stream E: Logger Enhancement + Seed (3 files)

**Depends on:** Nothing (fully independent)

**Files:**
1. `src/lib/logger.ts` (MODIFY)
2. `src/lib/db/seed/seed-monitoring.ts` (NEW) or modify `seed.ts`
3. `src/lib/__tests__/logger-enhanced.test.ts` (NEW)
4. `src/lib/monitoring/__tests__/metrics.test.ts` (NEW)

**Implementation Details:**

`logger.ts` modifications:
- Add `createRequestLogger(context: { requestId?: string; userId?: string; route?: string })` function
- Returns a logger instance that includes context fields in every log entry
- Add log level filtering: read `monitoring.logLevel` from platform settings, cache for 5 minutes
- Use `getPlatformSetting('monitoring.logLevel', 'INFO')` for the read
- Cache with a simple module-level variable + timestamp
- Do NOT break existing `logger.info/warn/error/debug` signatures

`seed-monitoring.ts`:
- Export `seedMonitoringSettings()` function
- Insert 3 platform settings:
  - `monitoring.alertSlackWebhook` (string, default: `""`, category: `monitoring`)
  - `monitoring.logLevel` (string, default: `"INFO"`, category: `monitoring`)
  - `monitoring.metricsRetentionDays` (number, default: `90`, category: `monitoring`)
- Use upsert pattern (insert on conflict do nothing) to be idempotent

`package.json` modification:
- Add `prom-client` as a dependency (latest stable, currently `^15.x`)

### Execution Order

```
Start immediately:
  Stream A (Types + Metrics)  ─┐
  Stream C (Docker Stack)       │ All independent
  Stream E (Logger + Seed)     ─┘

After Stream A completes:
  Stream B (Doctor + Queries + Actions + Cron)

After Streams A + B complete:
  Stream D (Hub Pages + Components)
```

### Merge Verification

After all streams are complete, verify:

1. **Import chain works:** `health/page.tsx` imports from `queries/health-checks.ts` which imports from `monitoring/types.ts` — all resolve
2. **CASL integration:** Both hub pages call `staffAuthorize()` and check HealthCheck ability
3. **Server action chain:** `run-checks-button.tsx` (client) calls `runDoctorChecksAction()` (server action) which calls `runAllChecks()` (doctor-runner)
4. **Cron chain:** `/api/cron/health` calls `runAllChecks()`, `writeProviderHealthResult()`, and `sendSlackAlert()`
5. **Metrics endpoint works:** `/api/metrics` returns valid Prometheus text format
6. **Docker stack starts:** `docker compose -f docker/monitoring/docker-compose.yml config` validates without errors
7. **TypeScript: 0 errors** across all new files
8. **No banned terms** in any file
9. **All files under 300 lines**

---

## 10. VERIFICATION CHECKLIST

After implementation, run these commands and paste FULL raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. Banned terms scan
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|STANDARD\|RISING\|Twicely Balance\|wallet\|Withdraw\|FinanceTier" \
  src/app/\(hub\)/health/ \
  src/lib/monitoring/ \
  src/lib/queries/health-checks.ts \
  src/lib/actions/health-checks.ts \
  src/components/admin/health-status-card.tsx \
  src/components/admin/health-status-banner.tsx \
  src/components/admin/doctor-check-table.tsx \
  src/components/admin/run-checks-button.tsx \
  || echo "No banned terms found"

# 4. Wrong route scan
grep -rn "/dashboard\|/admin\|/listing/\|/store/\|/shop/\|/search" \
  src/app/\(hub\)/health/ \
  src/lib/monitoring/ \
  || echo "No wrong routes found"

# 5. File size check
wc -l \
  src/app/\(hub\)/health/page.tsx \
  src/app/\(hub\)/health/doctor/page.tsx \
  src/app/api/metrics/route.ts \
  src/app/api/cron/health/route.ts \
  src/lib/monitoring/types.ts \
  src/lib/monitoring/metrics.ts \
  src/lib/monitoring/doctor-checks.ts \
  src/lib/monitoring/doctor-runner.ts \
  src/lib/monitoring/slack-alert.ts \
  src/lib/queries/health-checks.ts \
  src/lib/actions/health-checks.ts \
  src/components/admin/health-status-card.tsx \
  src/components/admin/health-status-banner.tsx \
  src/components/admin/doctor-check-table.tsx \
  src/components/admin/run-checks-button.tsx \
  src/lib/logger.ts

# 6. Docker compose validation (if Docker is available)
docker compose -f docker/monitoring/docker-compose.yml config > /dev/null 2>&1 && echo "Docker compose valid" || echo "Docker compose validation skipped (Docker not available)"

# 7. Lint script
./twicely-lint.sh
```

**Expected Outcomes:**
- TypeScript: 0 errors
- Tests: >= 2117 (baseline) + ~25 new tests = ~2142+
- Banned terms: none found
- Wrong routes: none found
- All files: <= 300 lines each
- Docker compose: valid (or skipped if Docker not installed)

---

## SPEC INCONSISTENCIES & GAPS (Owner Decisions Needed)

### 1. Page Registry Build Phase Mismatch
The Page Registry lists `/health` and `/health/doctor` under Build Phase "E4", but the Build Sequence Tracker lists them as part of "E5 — Monitoring". The Build Sequence Tracker is treated as authoritative. No action needed unless the owner disagrees.

### 2. Platform Settings Canonical Missing Monitoring Section
The Platform Settings Canonical (`TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md`) does NOT have a dedicated monitoring section (Sections 1-16.1 cover identity through accessibility, then Part D). The three `monitoring.*` keys are defined ONLY in Feature Lock-in Section 41. The installer should seed these keys based on the Feature Lock-in specification.

### 3. No Dedicated system_health_check Table in Schema
The canonical schema does NOT define a `system_health_check` table. The Page Registry mentions "service health checks" but no table exists for storing app-level (non-provider) health check results. The approach in this prompt is ephemeral: app health checks are computed on-demand and not persisted. Only provider health checks are persisted (in the existing `providerHealthLog` table). If a persistent health check log is desired for historical trending, a NEW table would need to be added to the schema doc.

**NOT SPECIFIED — owner decision needed:** Should app-level health check results (db.connection, valkey.ping, etc.) be persisted to a new table, or remain ephemeral (computed on each check)?

### 4. Grafana Dashboard Contents
Feature Lock-in Section 41 lists 7 dashboards (Platform Overview, API Performance, Orders & Payments, Crosslister, Background Jobs, Search, Infrastructure). This prompt implements 4 (Platform Overview, API Performance, Background Jobs, Infrastructure) because Orders & Payments and Search dashboards require metrics that depend on Phase F (Crosslister) features not yet built, and the Crosslister dashboard is entirely F-phase. The remaining dashboards can be added when their metrics are available.

**NOT SPECIFIED — owner decision needed:** Build all 7 dashboard skeletons now (with empty/placeholder panels for unavailable metrics), or only the 4 that have backing metrics?

### 5. prom-client NPM Package
The tech stack specifies no restrictions on metrics libraries. `prom-client` is the de-facto standard Prometheus client for Node.js with 3M+ weekly downloads. It is the only reasonable choice. If the owner has a preference for a different library, flag it before implementation.

### 6. METRICS_SECRET vs CRON_SECRET
The prompt introduces `METRICS_SECRET` as a separate env variable from `CRON_SECRET`. Prometheus scraping is a different security boundary from cron job invocation. If the owner prefers a single shared secret, this can be simplified. The separate secret approach is recommended because metrics endpoints may be scraped from a different network than cron jobs.

**NOT SPECIFIED — owner decision needed:** Separate `METRICS_SECRET` for Prometheus scraping, or reuse `CRON_SECRET`?
