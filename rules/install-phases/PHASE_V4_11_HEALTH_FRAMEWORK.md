# V4 Install Phase 11 — System Health Framework

**Status:** DRAFT (V4)
**Prereq:** Drizzle schema infrastructure, BullMQ cron operational, existing doctor-checks.ts (8 checks), Valkey running
**Canonical:** `rules/canonicals/27_SYSTEM_HEALTH.md`

---

## 0) What this phase installs

### Backend
- `healthSnapshot`, `healthRun`, `healthCheckProvider` tables (Drizzle)
- 9 new health check providers (BullMQ x4, Stripe, R2, Resend, Shippo, migrations) -- total 17 checks
- Snapshot persistence after every health cron run
- Stale detection logic
- Circuit breaker state machine for external services (Valkey-backed)
- Kill switch infrastructure (Valkey-backed, audit-logged)
- Public status page data generation

### Hub UI
- `(hub)/cfg/health` -- System health dashboard with tile grid + history + circuit breaker sidebar
- `(hub)/cfg/health/history` -- Full run history with detail expansion
- `(hub)/cfg/kill-switches` -- Emergency kill switch panel (SUPER_ADMIN only)
- `/status` -- Public-facing simplified status page
- Ad-hoc "Run Now" for SUPER_ADMIN

### Ops
- Existing `cron:health` job extended to persist snapshots + update circuit breakers
- Snapshot retention cleanup (30-day default)
- Alert deduplication (one alert per status transition, not per run)

---

## 1) Schema (Drizzle)

| File | Action |
|---|---|
| `packages/db/src/schema/health.ts` | CREATE |
| `packages/db/src/schema/index.ts` | MODIFY (add health exports) |

Create three tables per Canonical 27 Section 4:

**healthSnapshot** (C27 s4.1) -- per-check result from each health run. runId, checkName, module, status (HEALTHY/DEGRADED/UNHEALTHY/UNKNOWN), message, latencyMs, detailsJson, checkedAt. Indexes: runId, checkName+checkedAt, status, module+checkedAt.

**healthRun** (C27 s4.2) -- aggregate record per complete run. runType (scheduled/interactive/manual), status (worst across checks), startedAt, finishedAt, durationMs, totalChecks, healthyCount, degradedCount, unhealthyCount, unknownCount, triggeredByStaffId. Indexes: runType+startedAt, status.

**healthCheckProvider** (C27 s4.3) -- registry of known checks. checkName unique, module, description, isActive, timeoutMs (default 5000), scheduleGroup, lastStatus, lastCheckedAt. Upserted on app startup.

```bash
npx drizzle-kit generate --name health_framework && npx drizzle-kit migrate
npx turbo typecheck --filter=@twicely/db
```

---

## 2) Server actions + queries

### Step 2a: New Health Check Providers

| File | Action |
|---|---|
| `packages/jobs/src/doctor-checks.ts` | MODIFY (add 9 checks to existing 8) |

All follow the existing pattern: 5s timeout via `withTimeout()`, return `HealthCheckResult`, use `makeResult()` helper.

#### BullMQ Checks (Module: BullMQ)

**`bullmq.connection`** -- Create temporary Queue, call `getJobCounts()` to verify Valkey reachable for queue operations. Close after probe.

**`bullmq.depth`** -- Sum waiting job counts across all known queues. HEALTHY if < `health.bullmq.depthWarnThreshold` (1000), DEGRADED if < `health.bullmq.depthCriticalThreshold` (10000), UNHEALTHY otherwise.

**`bullmq.failed`** -- Sum failed job counts. HEALTHY if < `health.bullmq.failedJobsWarnThreshold` (50), DEGRADED if < `health.bullmq.failedJobsCriticalThreshold` (500), UNHEALTHY otherwise.

**`bullmq.stale`** -- Check for active jobs older than 30 min. HEALTHY if none, DEGRADED if any, UNHEALTHY if any > 2 hours.

#### External Service Checks

**`stripe.api`** (Module: Stripe) -- `GET /v1/balance` with Bearer auth. HEALTHY on 200, DEGRADED on other, UNKNOWN if env var missing.

**`email.resend`** (Module: Email) -- `GET /api-keys` with Bearer auth. HEALTHY on 200, DEGRADED otherwise, UNKNOWN if env var missing.

**`r2.bucket`** (Module: Storage) -- HEAD request to R2 endpoint. HEALTHY on 200/403, DEGRADED otherwise, UNKNOWN if env var missing.

**`shippo.api`** (Module: Shipping) -- Shippo API validation. HEALTHY on 200, UNKNOWN if env var missing.

#### Database Check

**`db.migrations`** (Module: Database) -- `SELECT COUNT(*) FROM __drizzle_migrations`. HEALTHY if accessible, DEGRADED on error.

#### Updated DOCTOR_CHECKS array (17 total)

```
db.connection, db.pool, db.migrations,
app.env, app.optional-env, app.settings,
valkey.ping,
bullmq.connection, bullmq.depth, bullmq.failed, bullmq.stale,
typesense.health, centrifugo.health,
stripe.api, email.resend, r2.bucket, shippo.api
```

### Step 2b: Snapshot Persistence

| File | Action |
|---|---|
| `packages/jobs/src/health-persistence.ts` | CREATE |

**`persistHealthRun(summary, runType, triggeredByStaffId?)`**:
1. Count statuses from `summary.checks` (healthy/degraded/unhealthy/unknown).
2. Derive overall status: UNHEALTHY if any unhealthy, DEGRADED if any degraded, UNKNOWN if all unknown, HEALTHY otherwise.
3. Insert `healthRun` row with counts, timestamps, durationMs.
4. Bulk-insert `healthSnapshot` rows (one per check: checkName, module, status, message, latencyMs, detailsJson, checkedAt).
5. Upsert `healthCheckProvider` rows (lastStatus, lastCheckedAt).
6. Return the healthRun row.

### Step 2c: Circuit Breaker Implementation

| File | Action |
|---|---|
| `packages/jobs/src/circuit-breaker.ts` | CREATE |

Valkey-backed circuit breaker per Canonical 27 Section 7.

```ts
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// State transitions:
// CLOSED + N failures -> OPEN
// OPEN + timeout elapsed -> HALF_OPEN
// HALF_OPEN + success -> CLOSED
// HALF_OPEN + failure -> OPEN

export async function getCircuitState(service: string): Promise<CircuitState>
export async function recordCircuitSuccess(service: string): Promise<void>
export async function recordCircuitFailure(service: string): Promise<void>
export async function isCircuitOpen(service: string): Promise<boolean>
export async function getAllCircuitStates(): Promise<Record<string, CircuitState>>
export async function updateCircuitBreakersFromHealth(summary: DoctorSummary): Promise<void>
```

Valkey keys per service:
```
circuit:{service}:state      = CLOSED | OPEN | HALF_OPEN
circuit:{service}:failures   = number
circuit:{service}:lastFailure = ISO timestamp
circuit:{service}:openedAt   = ISO timestamp
```

Protected services: `stripe`, `typesense`, `centrifugo`, `resend`, `shippo`, `r2`.

Thresholds from platform_settings:
- `health.circuit.{service}.failureThreshold` (default 3)
- `health.circuit.{service}.openDurationSeconds` (default 30)

### Step 2d: Kill Switch Infrastructure

| File | Action |
|---|---|
| `packages/jobs/src/kill-switches.ts` | CREATE |

Valkey-backed kill switches per Canonical 27 Section 10.

```ts
export const KILL_SWITCHES = [
  'killCheckout', 'killPayouts', 'killImports', 'killPublish',
  'killRegistration', 'killLocalTransactions', 'killAuthentication',
  'readOnlyMode',
] as const;

export type KillSwitchName = typeof KILL_SWITCHES[number];

export async function isKillSwitchActive(name: KillSwitchName): Promise<boolean>
export async function toggleKillSwitch(name: KillSwitchName, active: boolean, staffId: string): Promise<void>
export async function getAllKillSwitches(): Promise<Record<KillSwitchName, boolean>>
```

Each toggle: sets/deletes Valkey key, emits audit event `health.killswitch.toggled`, sends Slack notification.

### Step 2e: Update Cron Worker

| File | Action |
|---|---|
| `packages/jobs/src/cron-jobs.ts` | MODIFY (health case) |

In `case 'health':` block, after `runAllChecks()` and before Slack alert:

```ts
const { persistHealthRun } = await import('./health-persistence');
await persistHealthRun(summary, 'scheduled');

const { updateCircuitBreakersFromHealth } = await import('./circuit-breaker');
await updateCircuitBreakersFromHealth(summary);
```

### Step 2f: Health Dashboard Queries

| File | Action |
|---|---|
| `apps/web/src/lib/queries/health.ts` | CREATE |

**`getLatestSnapshots()`** -- latest healthSnapshot per checkName. Marks stale (> `health.staleAfterMinutes`) as UNKNOWN with `isStale=true`.

**`getRecentHealthRuns(limit=50)`** -- healthRun ordered by startedAt desc.

**`groupByModule(snapshots)`** -- groups by module for tile rendering.

**`getHealthRunDetail(runId)`** -- healthRun + all snapshots for that run.

### Step 2g: Hub Actions

| File | Action |
|---|---|
| `apps/web/src/lib/actions/health.ts` | CREATE |

**`triggerHealthRunAction()`** -- CASL: `HealthRun:create`. Runs checks, persists, returns run.

**`toggleKillSwitchAction(name, active)`** -- CASL: `KillSwitch:update`. Toggles switch.

---

## 3) UI pages

| File | Action |
|---|---|
| `apps/web/src/app/(hub)/cfg/health/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/health/health-tiles.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/health/health-history.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/health/circuit-breakers.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/health/history/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/kill-switches/page.tsx` | CREATE |
| `apps/web/src/app/status/page.tsx` | CREATE |

### `(hub)/cfg/health` -- System Health Dashboard

Server component. CASL: `HealthSnapshot:read`.

- **Top banner**: Overall status badge + last run timestamp
- **Tile grid**: One tile per module. Border colors: green/yellow/red/gray. Click to expand individual checks with latency and message.
- **Circuit breaker sidebar**: Current state of all 6 protected services (CLOSED/OPEN/HALF_OPEN)
- **"Run Now" button**: SUPER_ADMIN only, triggers ad-hoc run
- **Recent runs table**: Last 20 healthRun rows
- Link to full history

### `(hub)/cfg/health/history` -- Full Run History

Server component. CASL: `HealthRun:read`.

Paginated table (last 200 runs). Click to expand all snapshots for that run. Columns: status, run type, counts, duration, startedAt.

### `(hub)/cfg/kill-switches` -- Kill Switch Panel

Server component. CASL: `KillSwitch:update` (SUPER_ADMIN only).

Grid of toggle switches. Each shows: name, description, current state, last toggled by/at. Toggle via server action with confirmation dialog.

### `/status` -- Public Status Page

Public route, no auth. Categories: Marketplace, Payments, Search, Notifications. Each shows Operational/Degraded/Major Outage. No internal details exposed.

---

## 4) Tests

### `packages/jobs/src/__tests__/doctor-checks-new.test.ts` (9 tests)

- checkBullmqConnection returns HEALTHY when Valkey up
- checkBullmqDepth returns DEGRADED when depth > warn threshold
- checkBullmqFailed returns UNHEALTHY when failed > critical threshold
- checkBullmqStale returns DEGRADED when active jobs > 30 min
- checkStripeApi returns UNKNOWN when env var missing
- checkR2Bucket returns UNKNOWN when endpoint not configured
- checkResendApi returns UNKNOWN when API key missing
- checkShippoApi returns UNKNOWN when API key missing
- checkDbMigrations returns HEALTHY when table accessible

### `packages/jobs/src/__tests__/health-persistence.test.ts` (6 tests)

- Creates healthRun row with correct counts
- Creates N healthSnapshot rows linked by runId
- Overall UNHEALTHY when any check UNHEALTHY
- Overall DEGRADED when worst is DEGRADED
- Overall HEALTHY when all HEALTHY
- Upserts healthCheckProvider lastStatus and lastCheckedAt

### `packages/jobs/src/__tests__/circuit-breaker.test.ts` (8 tests)

- Initial state is CLOSED
- Failure below threshold stays CLOSED
- Failure at threshold transitions to OPEN
- OPEN after timeout transitions to HALF_OPEN
- HALF_OPEN + success transitions to CLOSED
- HALF_OPEN + failure transitions back to OPEN
- isCircuitOpen returns true when OPEN
- getAllCircuitStates returns all 6 services

### `packages/jobs/src/__tests__/kill-switches.test.ts` (5 tests)

- Toggle on sets Valkey key
- Toggle off removes Valkey key
- isKillSwitchActive returns correct state
- Toggle emits audit event
- getAllKillSwitches returns all switches with states

### `apps/web/src/lib/queries/__tests__/health.test.ts` (4 tests)

- getLatestSnapshots returns latest per checkName
- Stale snapshots marked as UNKNOWN with isStale=true
- groupByModule groups correctly
- getRecentHealthRuns returns ordered by startedAt desc

### `apps/web/src/lib/actions/__tests__/health.test.ts` (3 tests)

- triggerHealthRunAction persists run with runType='interactive'
- triggerHealthRunAction requires HealthRun:create permission
- toggleKillSwitchAction requires KillSwitch:update permission

### Mock setup

```ts
vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  healthSnapshot: mockTable, healthRun: mockTable, healthCheckProvider: mockTable,
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((key, defaultVal) => defaultVal),
}));
// Valkey mock for circuit breaker + kill switch tests
vi.mock('./valkey-client', () => ({
  valkey: { get: vi.fn(), set: vi.fn(), del: vi.fn(), exists: vi.fn() },
}));
```

**Total: 35 tests minimum (target 36)**

---

## 5) Doctor checks

### `health.persistence`

Trigger a health run via `runAllChecks()` + `persistHealthRun()`. Verify a `healthRun` row was created with correct status. Verify `healthSnapshot` rows created for each check. Clean up after.

### `health.stale_detection`

Insert a healthSnapshot with `checkedAt` = 20 minutes ago. Call `getLatestSnapshots()`. Verify the stale snapshot is returned with `isStale=true` and status overridden to UNKNOWN.

### `health.circuit_breaker`

Record 3 consecutive failures for a test service. Verify circuit transitions to OPEN. Record success after timeout. Verify transitions to CLOSED.

### `health.kill_switch`

Toggle `killCheckout` on. Verify `isKillSwitchActive('killCheckout')` returns true. Toggle off. Verify returns false.

### `health.provider_registry`

Verify `healthCheckProvider` table has rows for all 17 checks after a health run.

---

## Platform Settings + CASL

### Platform Settings (per C27 s15)

| Key | Default | Category |
|---|---|---|
| `health.enabled` | `true` | health |
| `health.staleAfterMinutes` | `15` | health |
| `health.checkTimeoutMs` | `5000` | health |
| `jobs.cron.health.pattern` | `*/5 * * * *` | jobs |
| `health.alerts.slack.enabled` | `true` | health |
| `health.alerts.slack.webhookUrl` | `""` | health |
| `health.alerts.email.enabled` | `false` | health |
| `health.alerts.email.recipients` | `""` | health |
| `health.history.retentionDays` | `30` | health |
| `health.degradedThresholdMs.database` | `500` | health |
| `health.degradedThresholdMs.cache` | `100` | health |
| `health.degradedThresholdMs.search` | `500` | health |
| `health.degradedThresholdMs.storage` | `2000` | health |
| `health.bullmq.failedJobsWarnThreshold` | `50` | health |
| `health.bullmq.failedJobsCriticalThreshold` | `500` | health |
| `health.bullmq.depthWarnThreshold` | `1000` | health |
| `health.bullmq.depthCriticalThreshold` | `10000` | health |
| `health.circuit.*.failureThreshold` | `3` | health |
| `health.circuit.*.openDurationSeconds` | `30` | health |

### CASL Additions

In `packages/casl/src/staff-abilities.ts`:
- ADMIN, SUPER_ADMIN, SRE, DEVELOPER: `can('read', 'HealthSnapshot')`, `can('read', 'HealthRun')`, `can('read', 'HealthCheckProvider')`
- SUPER_ADMIN only: `can('create', 'HealthRun')`, `can('read', 'KillSwitch')`, `can('update', 'KillSwitch')`
- ADMIN: `can('read', 'KillSwitch')`

### Cleanup Addition

Add to retention purge in `packages/jobs/src/cleanup-queue.ts`:
- Delete `health_snapshot` rows where `created_at < NOW() - retentionDays`
- Delete `health_run` rows where `started_at < NOW() - retentionDays`

---

## Completion Criteria

- [ ] 3 tables created and migrated (healthSnapshot, healthRun, healthCheckProvider)
- [ ] 9 new health checks added (17 total in DOCTOR_CHECKS)
- [ ] Health cron persists snapshots + updates circuit breakers after every run
- [ ] Stale snapshots (> staleAfterMinutes) render as UNKNOWN on dashboard
- [ ] Circuit breaker state machine works for all 6 protected services
- [ ] Kill switch toggle + audit trail works for all 8 switches
- [ ] Hub `(hub)/cfg/health` page renders tile grid with correct colors
- [ ] Hub `(hub)/cfg/kill-switches` renders for SUPER_ADMIN only
- [ ] Public `/status` page renders simplified status
- [ ] SUPER_ADMIN "Run Now" triggers ad-hoc run
- [ ] History page shows runs with detail expansion
- [ ] Retention cleanup purges old snapshots and runs
- [ ] Platform settings seeded (all health.* keys per C27 s15)
- [ ] CASL permissions added
- [ ] Doctor checks pass (5 checks)
- [ ] `npx turbo typecheck` passes (0 errors)
- [ ] `npx turbo test` passes (>= BASELINE_TESTS + 36 new)
- [ ] No banned terms in any new files
