# V4 Install Phase 09 — Risk Engine

**Status:** DRAFT (V4)
**Prereq:** Drizzle schema infrastructure, packages/scoring exists, BullMQ operational, auth system live
**Canonical:** `rules/canonicals/26_RISK_FRAUD.md`

---

## 0) What this phase installs

### Backend
- `riskSignal`, `riskScore`, `riskThreshold`, `riskAction`, `accountSecurityEvent` tables (Drizzle)
- Risk signal recording service with platform_settings-driven base scores
- Risk score computation engine with sliding window and caching
- Risk gate (action blocker with step-up support and audit trail)
- Account security event recorder with auto-signal generation
- Integration bridges to existing V3 fraud subsystems
- BullMQ cron job for security event pattern scanning

### Hub UI
- `(hub)/mod/risk` -- Risk signals dashboard
- `(hub)/mod/risk/[signalId]` -- Signal detail + resolve
- `(hub)/mod/risk/scores` -- User risk score leaderboard
- `(hub)/cfg/risk-thresholds` -- Threshold configuration
- `(hub)/mod/security-events` -- Security event log
- `(hub)/mod/risk/actions` -- Risk action audit log

### Ops
- Security event pattern scan cron job (every 15 min)
- Seed data: default risk thresholds for all gated actions
- Seed data: platform_settings for all risk.* keys

---

## 1) Schema (Drizzle)

| File | Action |
|---|---|
| `packages/db/src/schema/risk.ts` | CREATE |
| `packages/db/src/schema/index.ts` | MODIFY (add risk exports) |

Create five tables per Canonical 26 Section 3:

- **riskSignal** (C26 s3.1) -- append-only signal log. userId, sellerId, signalType, score, severity, metaJson, source, resolved, resolvedAt, resolvedByStaffId, resolvedReason, occurredAt, createdAt. FK to user `onDelete: 'restrict'`. Indexes: seller+occurredAt, user+occurredAt, type+occurredAt, severity+resolved.

- **riskScore** (C26 s3.2) -- composite risk score per user. userId unique, buyerScore, sellerScore, compositeScore, severity, signalCount, lastSignalAt, lastComputedAt. Indexes: compositeScore, severity.

- **riskThreshold** (C26 s3.3) -- per-action thresholds. action unique, warnAt=31, stepUpAt=61, blockAt=81, isActive, updatedByStaffId.

- **riskAction** (C26 s3.4) -- gate decision audit trail. userId, action, recommendation, scoreAtTime, outcome (allowed/blocked/step_up_passed/step_up_failed/overridden), overriddenByStaffId, overrideReason, metaJson. Indexes: user+occurredAt, action+outcome.

- **accountSecurityEvent** (C26 s3.5) -- append-only auth/security log. userId, eventType, ipAddress, userAgent, deviceId, location, success, metaJson. FK to user `onDelete: 'restrict'`. Indexes: user+occurredAt, type+occurredAt, ip+occurredAt.

```bash
npx drizzle-kit generate --name risk_engine && npx drizzle-kit migrate
npx turbo typecheck --filter=@twicely/db
```

---

## 2) Server actions + queries

### Step 2a: Signal Types & Base Scores

| File | Action |
|---|---|
| `packages/scoring/src/risk/signal-types.ts` | CREATE |

Export `RISK_SIGNAL_TYPES` const object (20 signal types per C26 s4), `RiskSignalType` type, `DEFAULT_SIGNAL_BASE_SCORES` record, `RiskSeverity` type, `severityFromScore()` helper.

### Step 2b: Risk Signal Service

| File | Action |
|---|---|
| `packages/scoring/src/risk/signals.ts` | CREATE |
| `packages/scoring/src/risk/index.ts` | CREATE (barrel) |

**`recordRiskSignal(args)`** -- reads base score from `getPlatformSetting('risk.signal.{type}.baseScore')`, applies scoreMultiplier, caps at 100, derives severity, inserts riskSignal row, emits audit event.

**`resolveRiskSignal(signalId, staffActorId, reason?)`** -- sets resolved=true with timestamp and staff ID, emits audit event.

### Step 2c: Risk Score Computation

| File | Action |
|---|---|
| `packages/scoring/src/risk/scoring.ts` | CREATE |

**`computeRiskScore(args)`** -- checks `risk.enabled` kill switch. Queries unresolved signals within sliding window (`risk.scoring.windowHours`, default 24). Sums scores capped at `risk.scoring.maxScore`. Splits buyer/seller scores. Looks up per-action threshold from riskThreshold table. Upserts riskScore row for cache. Returns `{ score, severity, signals[], recommendation }`.

Cache optimization: if `lastComputedAt` within `risk.scoring.cacheMinutes` (default 1), returns cached score from riskScore table.

### Step 2d: Risk Gate

| File | Action |
|---|---|
| `packages/scoring/src/risk/gate.ts` | CREATE |

Export `RiskBlockedError`, `StepUpRequiredError` (both extend Error with `score` and `action` properties).

**`assertRiskAllowed(args)`** -- calls `computeRiskScore`. Inserts `riskAction` row with outcome. Throws `RiskBlockedError` on `block`, throws `StepUpRequiredError` on `step_up` (unless `bypassStepUp`), returns `RiskScore` otherwise. Every call creates an audit trail row in riskAction.

### Step 2e: Account Security Events

| File | Action |
|---|---|
| `packages/scoring/src/risk/security-events.ts` | CREATE |

**`recordSecurityEvent(args)`** -- inserts accountSecurityEvent row. Auto-generates risk signals for patterns:
- 3+ login failures in 15min -> `LOGIN_FAILURES` signal (threshold from `risk.security.loginFailureThreshold`)
- New device not in last 10 events -> `DEVICE_CHANGE` signal
- Login from new /16 subnet not seen in 30 days -> `GEO_ANOMALY` signal

### Step 2f: Integration Bridges

| File | Action |
|---|---|
| `packages/scoring/src/risk/bridges.ts` | CREATE |

Five bridge functions per C26 s8:
- `bridgeAffiliateFraud({ userId, affiliateId, signalType, severity, details })`
- `bridgeLocalFraud({ userId, localTransactionId, flagSeverity })`
- `bridgeEnforcementAction({ userId, enforcementActionId, actionType })`
- `bridgeChargebackPattern({ userId, chargebackId, amountCents })`
- `bridgeDisputeRate({ userId, disputeCount30d, orderCount30d })`

Each sets appropriate `source` and `meta` fields.

### Step 2g: Hub Queries and Actions

| File | Action |
|---|---|
| `apps/web/src/lib/queries/risk.ts` | CREATE |
| `apps/web/src/lib/actions/risk.ts` | CREATE |

**Queries** (server-side, CASL-gated):
- `getRiskSignals(filters)` -- paginated, filterable signal list
- `getRiskSignal(signalId)` -- single signal detail
- `getRiskScores(filters)` -- user risk score leaderboard (compositeScore desc)
- `getRiskThresholds()` -- all threshold configs
- `getSecurityEvents(filters)` -- paginated security event log
- `getRiskActions(filters)` -- paginated risk action audit log

**Actions** (server actions, CASL-gated):
- `resolveRiskSignalAction(signalId, reason)` -- resolves a signal
- `updateRiskThresholdAction(action, warnAt, stepUpAt, blockAt)` -- updates threshold
- `toggleRiskThresholdAction(action, isActive)` -- enables/disables threshold

---

## 3) UI pages

| File | Action |
|---|---|
| `apps/web/src/app/(hub)/mod/risk/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/mod/risk/[signalId]/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/mod/risk/scores/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/mod/risk/actions/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/cfg/risk-thresholds/page.tsx` | CREATE |
| `apps/web/src/app/(hub)/mod/security-events/page.tsx` | CREATE |

### `(hub)/mod/risk` -- Risk Signals Dashboard

Server component with filterable table. Filters: severity, signalType, resolved, date range. Columns: signalType, score, severity, userId, source, occurredAt, resolved. Click row -> navigate to detail. CASL: `RiskSignal:read`.

### `(hub)/mod/risk/[signalId]` -- Signal Detail

Full signal data + metaJson. "Resolve" button with reason textarea. Timeline of related signals for same user. CASL: `RiskSignal:resolve`.

### `(hub)/mod/risk/scores` -- Risk Score Leaderboard

Table sorted by compositeScore desc. Columns: user, compositeScore, buyerScore, sellerScore, severity, signalCount, lastSignalAt. CASL: `RiskScore:read`.

### `(hub)/mod/risk/actions` -- Risk Action Audit Log

Filterable table: action, outcome, date range. Shows overrides (staff who overrode, reason). CASL: `RiskAction:read`.

### `(hub)/cfg/risk-thresholds` -- Threshold Configuration

Table of all riskThreshold rows. Inline editable warnAt/stepUpAt/blockAt. Toggle isActive. CASL: `RiskThreshold:update`.

### `(hub)/mod/security-events` -- Security Event Log

Filterable: eventType, userId, success, date range. Read-only. CASL: `AccountSecurityEvent:read`.

---

## 4) Tests

### `packages/scoring/src/risk/__tests__/signals.test.ts` (8 tests)

- Record signal with default base score -> verify score and severity
- Record signal with multiplier -> verify capped at 100
- Record signal reads platform_settings for base score override
- Resolve signal -> verify resolved=true, resolvedAt set
- Record signal for unknown type -> uses fallback score 10
- Signal resolution sets staffActorId and reason
- Duplicate signals for same user are allowed (append-only)
- Signal source field defaults to 'system'

### `packages/scoring/src/risk/__tests__/scoring.test.ts` (8 tests)

- Zero signals -> score 0, severity LOW, recommendation allow
- Signals summing to 50 -> severity MEDIUM, recommendation warn
- Signals summing to 70 -> severity HIGH, recommendation step_up
- Signals summing to 150 -> capped at 100, severity CRITICAL, recommendation block
- Custom threshold overrides default bands
- Only unresolved signals counted (resolved excluded)
- Sliding window: signals older than windowHours excluded
- Cached score returned within cacheMinutes (no recompute)

### `packages/scoring/src/risk/__tests__/gate.test.ts` (8 tests)

- Score below warn -> returns RiskScore, riskAction outcome='allowed'
- Score at warn -> returns RiskScore (advisory only)
- Score at step_up -> throws StepUpRequiredError, riskAction outcome='step_up_failed'
- Score at step_up + bypassStepUp -> returns score, riskAction outcome='step_up_passed'
- Score at block -> throws RiskBlockedError, riskAction outcome='blocked'
- Error objects have correct action and score properties
- Every gate call creates a riskAction row
- Kill switch off -> always returns allow, riskAction outcome='allowed'

### `packages/scoring/src/risk/__tests__/risk-action.test.ts` (4 tests)

- Allow outcome creates riskAction with outcome='allowed'
- Block outcome creates riskAction with outcome='blocked'
- Step-up passed creates riskAction with outcome='step_up_passed'
- Override creates riskAction with staffId and reason

### `packages/scoring/src/risk/__tests__/security-events.test.ts` (6 tests)

- Record login success -> no signal generated
- Record 2 login failures -> no signal (below threshold)
- Record 3 login failures in 15min -> LOGIN_FAILURES signal created
- Record login from new device -> DEVICE_CHANGE signal created
- Record login from known device -> no signal
- Event persisted with all fields (ip, userAgent, deviceId)

### `packages/scoring/src/risk/__tests__/bridges.test.ts` (8 tests)

- bridgeAffiliateFraud creates signal with type 'affiliate_fraud' and correct meta
- bridgeLocalFraud creates signal with type 'local_fraud' and correct meta
- bridgeEnforcementAction creates signal with type 'enforcement_action' and correct meta
- bridgeChargebackPattern creates signal with type 'chargeback_pattern' and correct meta
- bridgeDisputeRate creates signal when rate exceeds threshold
- bridgeDisputeRate does NOT create signal when rate is below threshold
- All bridges set correct source field
- Meta includes all domain-specific context fields

### `packages/scoring/src/risk/__tests__/threshold.test.ts` (4 tests)

- Default threshold values match canonical defaults
- Custom threshold correctly overrides warn/step_up/block boundaries
- Inactive threshold treated as if not present (uses defaults)
- Threshold update persists correctly

### Mock setup (all test files)

```ts
vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  riskSignal: mockTable, riskScore: mockTable, riskThreshold: mockTable,
  riskAction: mockTable, accountSecurityEvent: mockTable,
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((key, defaultVal) => defaultVal),
}));
```

**Total: 46 tests minimum (target 52 with edge cases)**

---

## 5) Doctor checks

Add to `packages/jobs/src/doctor-checks.ts`:

### `risk.signal_create`

Create a risk signal with type `ip_velocity`, verify it persists with correct score and severity. Clean up after.

### `risk.score_compute`

Create 3 signals summing above block threshold, call `computeRiskScore()`, verify score > 80 and recommendation = `block`. Clean up after.

### `risk.gate_block`

Verify that `assertRiskAllowed()` throws `RiskBlockedError` when score exceeds block threshold. Verify riskAction row created with outcome='blocked'.

### `risk.threshold_lookup`

Insert a custom threshold for a test action, verify `computeRiskScore()` uses custom thresholds instead of defaults. Clean up after.

### `risk.security_event`

Record a security event, verify it persists. Verify that 3+ login failures auto-generate a LOGIN_FAILURES signal.

---

## Seed Data

### Risk Thresholds (8 rows per C26 s11)

| action | warnAt | stepUpAt | blockAt |
|---|---|---|---|
| `payout_change` | 31 | 61 | 81 |
| `large_payout` | 31 | 51 | 71 |
| `credential_change` | 31 | 61 | 81 |
| `store_upgrade` | 41 | 71 | 91 |
| `high_value_listing` | 31 | 61 | 81 |
| `bulk_listing` | 41 | 61 | 81 |
| `order_placement` | 41 | 71 | 91 |
| `listing_publish` | 41 | 71 | 91 |

### Platform Settings (category `risk`)

See Canonical 26 Section 16 for full list. Key groups: `risk.enabled`, `risk.scoring.*`, `risk.security.*`, `risk.fraud.*`, `risk.verification.*`, `risk.ai.*`, 20x `risk.signal.*.baseScore`, 4x `jobs.cron.risk*.pattern`.

---

## Completion Criteria

- [ ] 5 tables created and migrated (riskSignal, riskScore, riskThreshold, riskAction, accountSecurityEvent)
- [ ] Signal recording computes score from platform_settings, derives severity
- [ ] Risk score computation with caching, sliding window, caps at max
- [ ] Risk gate blocks/step_up/warn/allow with riskAction audit trail on every call
- [ ] Security events auto-generate signals on suspicious patterns
- [ ] Integration bridges for affiliate/local/enforcement/chargeback/dispute
- [ ] Default risk thresholds seeded (8 actions)
- [ ] Platform settings seeded (all risk.* keys per C26 s16)
- [ ] Hub pages render with CASL gating (6 pages)
- [ ] Security event scan cron registered
- [ ] Doctor checks pass (5 checks)
- [ ] `npx turbo typecheck` passes (0 errors)
- [ ] `npx turbo test` passes (>= BASELINE_TESTS + 52 new)
- [ ] No banned terms in any new files
