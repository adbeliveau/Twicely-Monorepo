# Canonical 26 — Risk Engine & Fraud Detection

**Status:** DRAFT (V4)
**Domain:** Risk scoring, fraud detection, account security, identity verification
**Depends on:** db (schema), scoring (service layer), jobs (BullMQ cron), casl (RBAC), auth (session events), notifications (alerts)
**Package:** `packages/scoring/src/risk/` (service layer) + `packages/db/src/schema/risk.ts` (schema) + `packages/jobs/src/risk-*.ts` (workers)

---

## 1. Purpose

Define the platform-wide risk engine that protects Twicely from fraud, abuse, and account compromise. The engine collects risk signals from multiple sources, computes composite risk scores per user, gates high-risk actions behind step-up verification or blocks, and provides staff with tools to investigate and resolve signals.

V4 merges V2's comprehensive risk scoring design (Phase 32) with V3's existing fraud subsystems (affiliate fraud scan, local fraud detection, enforcement actions). The key insight: V3 already has domain-specific fraud detection running in BullMQ jobs; V4 unifies these into a single risk signal table with composite scoring, configurable thresholds, and a staff dashboard.

---

## 2. Core Principles

1. **Append-only signals** -- risk signals are never deleted, only marked `resolved`. This preserves the audit trail for compliance and dispute evidence.
2. **All thresholds from platform_settings** -- never hardcode score thresholds, window durations, or base scores. Every tunable value reads from `platform_settings` with a code-level default fallback.
3. **Server-side enforcement only** -- risk gates execute on the server. The client receives a rejection or step-up prompt but cannot bypass the check.
4. **Audit everything** -- every signal creation, resolution, threshold change, and gate decision emits an audit event via the existing audit trail.
5. **Configurable sliding window** -- risk score computation considers only unresolved signals within a configurable time window (default 24 hours). Old signals decay naturally.
6. **Pure service module** -- the risk engine in `packages/scoring/src/risk/` contains no server actions, no route handlers, no React components. It exports pure functions consumed by server actions in `apps/web/`.
7. **Integer cents for all monetary values** -- signal metadata involving money uses integer cents.
8. **Existing V3 fraud subsystems feed in** -- affiliate fraud, local fraud, enforcement actions, and chargeback patterns feed into the unified risk signal table via bridge functions, but retain their own domain-specific tables and logic.

---

## 3. Schema (Drizzle pgTable)

All tables in `packages/db/src/schema/risk.ts`.

### 3.1 riskSignal

Append-only log of risk signals. Each row represents one detected risk indicator.

```ts
export const riskSignal = pgTable('risk_signal', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').references(() => user.id, { onDelete: 'restrict' }),
  sellerId:          text('seller_id'),
  signalType:        text('signal_type').notNull(),       // typed string, see Section 4
  score:             integer('score').notNull(),            // 0-100, computed from base + multiplier
  severity:          text('severity').notNull().default('LOW'), // LOW | MEDIUM | HIGH | CRITICAL
  metaJson:          jsonb('meta_json').notNull().default(sql`'{}'`),
  source:            text('source').notNull().default('system'), // originating subsystem
  resolved:          boolean('resolved').notNull().default(false),
  resolvedAt:        timestamp('resolved_at', { withTimezone: true }),
  resolvedByStaffId: text('resolved_by_staff_id'),
  resolvedReason:    text('resolved_reason'),
  occurredAt:        timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:   index('rs_seller').on(table.sellerId, table.occurredAt),
  userIdx:     index('rs_user').on(table.userId, table.occurredAt),
  typeIdx:     index('rs_type').on(table.signalType, table.occurredAt),
  severityIdx: index('rs_severity').on(table.severity, table.resolved),
}));
```

### 3.2 riskScore

Composite risk score per user. Recomputed on each `assertRiskAllowed()` call and cached for dashboard display. Not a materialized view -- written explicitly by the scoring engine.

```ts
export const riskScore = pgTable('risk_score', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }).unique(),
  buyerScore:       integer('buyer_score').notNull().default(0),   // 0-100
  sellerScore:      integer('seller_score').notNull().default(0),  // 0-100
  compositeScore:   integer('composite_score').notNull().default(0), // max(buyer, seller)
  severity:         text('severity').notNull().default('LOW'),
  signalCount:      integer('signal_count').notNull().default(0),
  lastSignalAt:     timestamp('last_signal_at', { withTimezone: true }),
  lastComputedAt:   timestamp('last_computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  compositeIdx: index('rsc_composite').on(table.compositeScore),
  severityIdx:  index('rsc_severity').on(table.severity),
}));
```

### 3.3 riskThreshold

Per-action configurable thresholds. Each row defines when to warn, require step-up, or block for a specific action type.

```ts
export const riskThreshold = pgTable('risk_threshold', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  action:           text('action').notNull().unique(),  // e.g. 'payout_change', 'high_value_listing'
  warnAt:           integer('warn_at').notNull().default(31),
  stepUpAt:         integer('step_up_at').notNull().default(61),
  blockAt:          integer('block_at').notNull().default(81),
  isActive:         boolean('is_active').notNull().default(true),
  updatedByStaffId: text('updated_by_staff_id'),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.4 riskAction

Audit trail of risk-triggered actions (blocks, step-ups, manual overrides).

```ts
export const riskAction = pgTable('risk_action', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  action:           text('action').notNull(),             // the gated action attempted
  recommendation:   text('recommendation').notNull(),     // allow | warn | step_up | block
  scoreAtTime:      integer('score_at_time').notNull(),
  outcome:          text('outcome').notNull(),            // allowed | blocked | step_up_passed | step_up_failed | overridden
  overriddenByStaffId: text('overridden_by_staff_id'),
  overrideReason:   text('override_reason'),
  metaJson:         jsonb('meta_json').notNull().default(sql`'{}'`),
  occurredAt:       timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:   index('ra_user').on(table.userId, table.occurredAt),
  actionIdx: index('ra_action').on(table.action, table.outcome),
}));
```

### 3.5 accountSecurityEvent

Append-only security event log for authentication and account changes.

```ts
export const accountSecurityEvent = pgTable('account_security_event', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  userId:      text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  eventType:   text('event_type').notNull(),  // login | logout | password_change | mfa_enable | ...
  ipAddress:   text('ip_address'),
  userAgent:   text('user_agent'),
  deviceId:    text('device_id'),
  location:    text('location'),              // geo approximation (city, country)
  success:     boolean('success').notNull().default(true),
  metaJson:    jsonb('meta_json').notNull().default(sql`'{}'`),
  occurredAt:  timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('ase_user').on(table.userId, table.occurredAt),
  typeIdx: index('ase_type').on(table.eventType, table.occurredAt),
  ipIdx:   index('ase_ip').on(table.ipAddress, table.occurredAt),
}));
```

---

## 4. Signal Types

Signals are typed strings. New types can be added without schema migration.

```ts
// packages/scoring/src/risk/signal-types.ts

export const RISK_SIGNAL_TYPES = {
  // Authentication & Account
  IP_VELOCITY: 'ip_velocity',             // Too many requests from same IP
  DEVICE_CHANGE: 'device_change',         // New device detected on account
  LOGIN_FAILURES: 'login_failures',       // Multiple failed login attempts
  GEO_ANOMALY: 'geo_anomaly',             // Login from unusual location
  CREDENTIAL_CHANGE: 'credential_change', // Email/password/MFA changed

  // Commerce & Transactions
  PAYOUT_CHANGE: 'payout_change',         // Payout destination modified
  UNUSUAL_VOLUME: 'unusual_volume',       // Sudden spike in orders/listings
  CARD_VELOCITY: 'card_velocity',         // Multiple card attempts in short window
  REFUND_ABUSE: 'refund_abuse',           // Pattern of return/refund requests
  ACCOUNT_AGE: 'account_age',             // New account performing high-value action
  SHILL_BIDDING: 'shill_bidding',         // Self-purchase or coordinated fake offers
  LISTING_MANIPULATION: 'listing_manipulation', // Deceptive titles, price bait-and-switch
  RETURN_FRAUD_RING: 'return_fraud_ring', // Coordinated return fraud across accounts
  PAYMENT_FAILURE_RATE: 'payment_failure_rate', // Abnormally high payment failure rate

  // Cross-domain (fed by other V3 subsystems)
  AFFILIATE_FRAUD: 'affiliate_fraud',           // From affiliate-fraud-scan.ts
  LOCAL_FRAUD: 'local_fraud',                   // From local-fraud-noshow-relist.ts
  CHARGEBACK_PATTERN: 'chargeback_pattern',     // From stripe chargeback handler
  ENFORCEMENT_ACTION: 'enforcement_action',     // From enforcement system
  IDENTITY_UNVERIFIED: 'identity_unverified',   // Identity verification failed or expired
  DISPUTE_RATE: 'dispute_rate',                 // Abnormally high dispute rate
} as const;

export type RiskSignalType = typeof RISK_SIGNAL_TYPES[keyof typeof RISK_SIGNAL_TYPES];
```

### Base Scores (configurable via platform_settings)

| Signal | Default Base Score | Setting Key |
|---|---|---|
| `ip_velocity` | 15 | `risk.signal.ipVelocity.baseScore` |
| `device_change` | 20 | `risk.signal.deviceChange.baseScore` |
| `login_failures` | 25 | `risk.signal.loginFailures.baseScore` |
| `geo_anomaly` | 35 | `risk.signal.geoAnomaly.baseScore` |
| `credential_change` | 30 | `risk.signal.credentialChange.baseScore` |
| `payout_change` | 40 | `risk.signal.payoutChange.baseScore` |
| `unusual_volume` | 30 | `risk.signal.unusualVolume.baseScore` |
| `card_velocity` | 45 | `risk.signal.cardVelocity.baseScore` |
| `refund_abuse` | 50 | `risk.signal.refundAbuse.baseScore` |
| `account_age` | 25 | `risk.signal.accountAge.baseScore` |
| `shill_bidding` | 60 | `risk.signal.shillBidding.baseScore` |
| `listing_manipulation` | 35 | `risk.signal.listingManipulation.baseScore` |
| `return_fraud_ring` | 55 | `risk.signal.returnFraudRing.baseScore` |
| `payment_failure_rate` | 30 | `risk.signal.paymentFailureRate.baseScore` |
| `affiliate_fraud` | 40 | `risk.signal.affiliateFraud.baseScore` |
| `local_fraud` | 45 | `risk.signal.localFraud.baseScore` |
| `chargeback_pattern` | 50 | `risk.signal.chargebackPattern.baseScore` |
| `enforcement_action` | 35 | `risk.signal.enforcementAction.baseScore` |
| `identity_unverified` | 25 | `risk.signal.identityUnverified.baseScore` |
| `dispute_rate` | 40 | `risk.signal.disputeRate.baseScore` |

---

## 5. Risk Severity Bands

Score aggregation is capped at 100. Severity is derived from composite score:

| Band | Score Range | Recommendation | Effect |
|---|---|---|---|
| LOW | 0-30 | `allow` | No friction. Action proceeds normally. |
| MEDIUM | 31-60 | `warn` | Soft warning in UI. Staff notification. Action proceeds. |
| HIGH | 61-80 | `step_up` | Step-up verification required before action completes. |
| CRITICAL | 81-100 | `block` | Action blocked. Staff must review and resolve signals. |

These default bands are overridable per-action via the `riskThreshold` table.

---

## 6. Service Layer

All risk services live in `packages/scoring/src/risk/`. No direct DB imports in consuming code -- all access through these functions.

### 6.1 Signal Recording

```
recordRiskSignal(args) -> riskSignal row
  - Reads base score from platform_settings (fallback to DEFAULT_SIGNAL_BASE_SCORES)
  - Applies optional scoreMultiplier (capped so final score <= 100)
  - Computes severity from score via severityFromScore()
  - Inserts riskSignal row
  - Emits audit event: risk.signal.recorded
```

### 6.2 Signal Resolution

```
resolveRiskSignal(signalId, staffActorId, reason?) -> riskSignal row
  - Sets resolved=true, resolvedAt=now(), resolvedByStaffId, resolvedReason
  - Emits audit event: risk.signal.resolved
```

### 6.3 Risk Score Computation

```
computeRiskScore(args) -> RiskScore
  - Reads risk.enabled kill switch. If false -> returns { score: 0, recommendation: 'allow' }
  - Reads unresolved signals within sliding window (risk.scoring.windowHours, default 24)
  - Sums scores, caps at risk.scoring.maxScore (default 100)
  - Splits into buyerScore and sellerScore based on signal context
  - Looks up per-action threshold from riskThreshold table
  - Upserts riskScore row for the user
  - Returns { score, severity, signals[], recommendation }
```

### 6.4 Risk Gate

```
assertRiskAllowed(args) -> RiskScore | throws
  - Calls computeRiskScore
  - Logs a riskAction row with the outcome
  - If recommendation=block: throws RiskBlockedError
  - If recommendation=step_up and !bypassStepUp: throws StepUpRequiredError
  - Otherwise returns the score for caller to log
```

### 6.5 Security Event Recording

```
recordSecurityEvent(args) -> accountSecurityEvent row
  - Inserts event row with all context (IP, user agent, device, location)
  - Auto-generates risk signals for suspicious patterns:
    - 3+ login failures in 15min -> LOGIN_FAILURES signal
    - New device not seen in last 10 events -> DEVICE_CHANGE signal
    - Login from IP in a new /16 subnet not seen in 30 days -> GEO_ANOMALY signal
  - All pattern thresholds read from platform_settings
```

---

## 7. Fraud Pattern Detection

### 7.1 Shill Bidding Detection

BullMQ periodic scan (`risk-shill-scan`, every 30 min):
- Detects accounts making offers on their own listings (via shared IP, device fingerprint, or linked payment method).
- Detects coordinated purchase patterns between related accounts (common shipping address, creation IP).
- Creates `shill_bidding` signal with evidence in metaJson.

### 7.2 Listing Manipulation Detection

Real-time signal on listing create/update:
- Detects extreme price changes (>80% reduction followed by re-raise).
- Detects keyword stuffing in titles (>5 brand names not matching category).
- Creates `listing_manipulation` signal.

### 7.3 Return Fraud Ring Detection

BullMQ periodic scan (`risk-return-fraud-scan`, daily):
- Identifies clusters of accounts with high return rates shipping to/from overlapping addresses.
- Detects "wardrobing" patterns (return after brief use, specific categories).
- Creates `return_fraud_ring` signal for all accounts in the cluster.

### 7.4 Payment Fraud Velocity

Real-time on payment failure:
- Tracks failed payment attempts per user per hour.
- If rate exceeds `risk.fraud.paymentFailureThreshold` (default 5) in `risk.fraud.paymentFailureWindowMinutes` (default 60): creates `payment_failure_rate` signal.

---

## 8. Integration with Existing V3 Fraud Subsystems

### 8.1 Affiliate Fraud Bridge

When `affiliate-fraud-scan.ts` detects a flagged affiliate:
```
bridgeAffiliateFraud({ userId, affiliateId, signalType, severity, details })
  -> recordRiskSignal({ signalType: 'affiliate_fraud', source: 'affiliate-fraud-scan', meta: {...} })
```

### 8.2 Local Fraud Bridge

When `local-fraud-noshow-relist.ts` or the local fraud flag system confirms fraud:
```
bridgeLocalFraud({ userId, localTransactionId, flagSeverity })
  -> recordRiskSignal({ signalType: 'local_fraud', source: 'local-fraud-detection', meta: {...} })
```

### 8.3 Enforcement Bridge

When an enforcement action is created:
```
bridgeEnforcementAction({ userId, enforcementActionId, actionType })
  -> recordRiskSignal({ signalType: 'enforcement_action', source: 'enforcement', meta: {...} })
```

### 8.4 Chargeback Bridge

When a chargeback is recorded via Stripe webhook:
```
bridgeChargebackPattern({ userId, chargebackId, amountCents })
  -> recordRiskSignal({ signalType: 'chargeback_pattern', source: 'stripe-chargeback', meta: {...} })
```

### 8.5 Dispute Rate Bridge

Computed during dispute creation:
```
bridgeDisputeRate({ userId, disputeCount30d, orderCount30d })
  -> if disputeRate > threshold: recordRiskSignal({ signalType: 'dispute_rate', ... })
```

---

## 9. Identity Verification Integration

### 9.1 Provider

Stripe Identity for document verification. No custom KYC -- use Stripe's hosted verification flow.

### 9.2 Verification as Signal Source

- When a user is required to verify but has not: `identity_unverified` signal added.
- When verification completes successfully: the `identity_unverified` signal is auto-resolved.
- Verification status is consumed from `packages/db/src/schema/identity-verification.ts` (existing V3 schema). This canonical does NOT own the verification workflow -- only consumes its status.

### 9.3 Verification Triggers

Identity verification is required when:
- Composite risk score crosses step-up threshold for sensitive actions (payout_change, credential_change).
- First payout request exceeding `risk.verification.payoutThresholdCents` (default 50000 = $500).
- Manual staff request via risk dashboard.

---

## 10. AI Integration (Future)

### 10.1 Anomaly Detection

Future BullMQ job (`risk-anomaly-scan`, hourly):
- Compares user behavioral patterns against baseline (order frequency, listing patterns, login times).
- Deviation beyond N standard deviations creates a risk signal.
- Requires minimum 30-day behavioral baseline per user.

### 10.2 Pattern Recognition

Future ML model integration point:
- `packages/scoring/src/risk/ai-scorer.ts` exports `computeAIRiskScore(userId)`.
- Returns a 0-100 score that is blended with the rule-based score.
- Blend weight configurable via `risk.ai.blendWeight` (default 0 = disabled).

Both are out of scope for V4.0 launch. The schema and service interfaces are designed to accommodate them without migration.

---

## 11. Gated Actions

These actions MUST call `assertRiskAllowed()` before executing:

| Action | Threshold Action Key | Description |
|---|---|---|
| Payout destination change | `payout_change` | Changing bank account or Stripe Connect destination |
| Large payout request (>$500) | `large_payout` | Payout exceeding configurable threshold |
| Email/password change | `credential_change` | Sensitive credential modification |
| Store tier upgrade | `store_upgrade` | Subscription tier change |
| Listing high-value item (>$1000) | `high_value_listing` | Listing with price above configurable threshold |
| Bulk listing operations | `bulk_listing` | Bulk edit/delete/publish actions |
| Order placement | `order_placement` | Checkout completion (buyer-side) |
| Listing publish | `listing_publish` | New listing going live |

Thresholds are seeded with defaults and editable via hub admin at `/cfg/risk-thresholds`.

---

## 12. Real-Time Scoring

Risk checks run synchronously at action time. Performance budget: < 50ms per `assertRiskAllowed()` call.

Optimization strategy:
1. Query only unresolved signals within the sliding window (indexed on `userId + occurredAt`).
2. Cache riskThreshold rows in Valkey (TTL 5 min, invalidated on update).
3. The `riskScore` table acts as a cache -- if `lastComputedAt` is within `risk.scoring.cacheMinutes` (default 1), return cached score without recomputing.

---

## 13. RBAC

| Permission | Roles |
|---|---|
| `RiskSignal:read` | ADMIN, SUPER_ADMIN, MODERATION, SRE |
| `RiskSignal:resolve` | ADMIN, SUPER_ADMIN, MODERATION |
| `RiskScore:read` | ADMIN, SUPER_ADMIN, MODERATION, SRE |
| `RiskThreshold:read` | ADMIN, SUPER_ADMIN, SRE |
| `RiskThreshold:update` | ADMIN, SUPER_ADMIN |
| `RiskAction:read` | ADMIN, SUPER_ADMIN, MODERATION, SRE |
| `AccountSecurityEvent:read` | ADMIN, SUPER_ADMIN, MODERATION, SRE |

---

## 14. Hub Routes

| Route | Description | CASL |
|---|---|---|
| `(hub)/mod/risk` | Risk signals dashboard (filterable by severity, type, resolved) | `RiskSignal:read` |
| `(hub)/mod/risk/[signalId]` | Signal detail + resolve action | `RiskSignal:read` + `resolve` |
| `(hub)/mod/risk/scores` | User risk score leaderboard | `RiskScore:read` |
| `(hub)/cfg/risk-thresholds` | Threshold management (per-action warnAt/stepUpAt/blockAt) | `RiskThreshold:update` |
| `(hub)/mod/security-events` | Account security event log | `AccountSecurityEvent:read` |
| `(hub)/mod/risk/actions` | Risk action audit log (blocks, step-ups, overrides) | `RiskAction:read` |

---

## 15. BullMQ Jobs

| Job | Queue | Schedule | Description |
|---|---|---|---|
| `risk-security-scan` | `platform-cron` | `*/15 * * * *` | Scan recent security events for velocity patterns |
| `risk-shill-scan` | `platform-cron` | `*/30 * * * *` | Detect shill bidding patterns |
| `risk-return-fraud-scan` | `platform-cron` | `0 3 * * *` | Daily return fraud ring detection |
| `risk-score-decay` | `platform-cron` | `0 4 * * *` | Optional: auto-resolve signals older than N days |

All cron patterns read from `platform_settings` with keys:
- `jobs.cron.riskSecurityScan.pattern`
- `jobs.cron.riskShillScan.pattern`
- `jobs.cron.riskReturnFraudScan.pattern`
- `jobs.cron.riskScoreDecay.pattern`

All with `tz: 'UTC'`.

---

## 16. Platform Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `risk.enabled` | boolean | `true` | Global kill switch -- if false, all gates return `allow` |
| `risk.scoring.windowHours` | number | `24` | Sliding window for score aggregation |
| `risk.scoring.maxScore` | number | `100` | Score cap |
| `risk.scoring.cacheMinutes` | number | `1` | Cache duration for computed risk scores |
| `risk.security.loginFailureThreshold` | number | `3` | Failures in window to trigger signal |
| `risk.security.loginFailureWindowMinutes` | number | `15` | Window for login failure counting |
| `risk.fraud.paymentFailureThreshold` | number | `5` | Payment failures to trigger signal |
| `risk.fraud.paymentFailureWindowMinutes` | number | `60` | Window for payment failure counting |
| `risk.verification.payoutThresholdCents` | number | `50000` | Payout amount requiring identity verification |
| `risk.ai.blendWeight` | number | `0` | AI score blend weight (0 = disabled) |
| `risk.signal.*.baseScore` | number | (varies) | Per-signal-type base scores (see Section 4) |
| `jobs.cron.riskSecurityScan.pattern` | string | `*/15 * * * *` | Cron pattern |
| `jobs.cron.riskShillScan.pattern` | string | `*/30 * * * *` | Cron pattern |
| `jobs.cron.riskReturnFraudScan.pattern` | string | `0 3 * * *` | Cron pattern |
| `jobs.cron.riskScoreDecay.pattern` | string | `0 4 * * *` | Cron pattern |

---

## 17. Privacy & Data Retention

1. **IP addresses** in `accountSecurityEvent` are stored raw for security investigation but purged after `risk.retention.securityEventDays` (default 90 days) via the existing `cleanup-audit-archive` job.
2. **Risk signals** are retained for `risk.retention.signalDays` (default 365 days). After retention period, metaJson is scrubbed of PII but the signal row and score are preserved for aggregate analytics.
3. **Right to explanation**: When a user's action is blocked or requires step-up, the response includes the risk severity and a human-readable reason (e.g., "Unusual account activity detected"). It does NOT expose individual signal details, scores, or detection methods.
4. **GDPR data export**: Risk signals and security events for a user are included in the data export package (pseudonymized where needed).

---

## 18. Testing Requirements

| Test Category | Minimum Tests |
|---|---|
| Signal recording + severity computation | 8 |
| Risk score aggregation + capping + caching | 8 |
| Risk gate (allow/warn/step_up/block) | 8 |
| Risk action audit trail | 4 |
| Security event recording + auto-signals | 6 |
| Signal resolution | 4 |
| Threshold configuration | 4 |
| Integration bridges (affiliate/local/enforcement/chargeback/dispute) | 8 |
| Kill switch (risk.enabled=false) | 2 |
| **Total** | **52** |

---

## 19. Out of Scope

| Feature | Decision |
|---|---|
| Identity verification workflow (KYC) | Owned by `packages/db/src/schema/identity-verification.ts` + Stripe Identity. This canonical consumes verification status as a signal. |
| ML-based anomaly detection | Interfaces defined (Section 10) but implementation deferred to post-V4.0. |
| Device fingerprinting library | Use request IP + user agent + device ID from auth session. No third-party fingerprinting SDK. |
| Real-time fraud alerting to buyers/sellers | Fraud alerts go to staff only via hub dashboard and Slack. User-facing notifications limited to action rejections. |

---

## 20. Migration

```bash
# After adding schema to packages/db/src/schema/risk.ts and re-exporting from index.ts:
npx drizzle-kit generate --name risk_engine
npx drizzle-kit migrate
```

Seed `riskThreshold` with default rows for all gated actions in `apps/web/src/lib/db/seed/risk-thresholds.ts`.
