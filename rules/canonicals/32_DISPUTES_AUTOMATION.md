# Canonical 32 -- Disputes Automation

**Status:** DRAFT (V4)
**Domain:** commerce, jobs, notifications, scoring, finance, trust-safety
**Depends on:** Canonical 01 (Commerce/Orders), Canonical 05 (Finance/Ledger), Canonical 10 (Jobs/BullMQ), Canonical 12 (Scoring), Canonical 26 (Risk/Fraud)
**Package:** `packages/commerce` (engine + queries), `packages/db` (schema), `packages/jobs` (SLA monitor)
**V2 Sources:** Phase 14 (Returns/Disputes), Phase 28 (Disputes Automation), Phase 38 (Buyer Protection)
**V3 Sources:** `packages/commerce/src/disputes.ts`, `dispute-queries.ts`, `dispute-recovery.ts`, `buyer-protection.ts`

---

## 1. Purpose

This canonical defines the automated dispute resolution system: configurable
auto-resolution rules, SLA monitoring, evidence handling, escalation workflows,
fraud detection integration, AI-powered dispute analysis hooks, and the
Decision #92 buyer protection recovery waterfall. It builds on V3's existing
dispute escalation and resolution code without replacing it.

---

## 2. Core Principles

| # | Principle |
|---|-----------|
| D-1 | Auto-resolution is evidence-based, not arbitrary. Rules must reference concrete conditions. |
| D-2 | SLA deadlines are configurable via `platform_settings` with platform minimums. |
| D-3 | Escalation is always available to either party before final resolution. |
| D-4 | Ledger entries created only on final resolution (via `processReturnRefund` or `recoverFromSellerWaterfall`). |
| D-5 | All decisions are audited with immutable timeline entries. |
| D-6 | Seller protection score affects auto-resolution bias (from `@twicely/scoring`). |
| D-7 | Decision #92 waterfall (`dispute-recovery.ts`) runs before buyer refund. Never bypassed. |
| D-8 | `isAutoResolvable` flag allows staff to opt out individual disputes from automation. |
| D-9 | Evidence limits and file size caps enforced server-side. |
| D-10 | SLA timers use UTC anchoring (BullMQ cron with `tz: 'UTC'`). |
| D-11 | Chargeback prevention: proactively refund when dispute likelihood exceeds threshold. |
| D-12 | Escalation ladder is strict: auto -> agent -> supervisor -> platform decision. No skipping levels. |

---

## 3. Schema (Drizzle pgTable)

### 3.1 Existing tables

| Table | File | Status |
|-------|------|--------|
| `dispute` | `packages/db/src/schema/shipping.ts` | EXISTS in V3 |
| `returnRequest` | `packages/db/src/schema/shipping.ts` | EXISTS in V3 |
| `order` | `packages/db/src/schema/commerce.ts` | EXISTS in V3 |
| `sellerBalance` | `packages/db/src/schema/finance.ts` | EXISTS in V3 |
| `ledgerEntry` | `packages/db/src/schema/finance.ts` | EXISTS in V3 |

### 3.2 Existing dispute schema (V3)

```
dispute {
  id, orderId, buyerId, sellerId, returnRequestId?,
  claimType (INR | INAD | DAMAGED | COUNTERFEIT | REMORSE),
  status (OPEN | UNDER_REVIEW | RESOLVED_BUYER | RESOLVED_SELLER | RESOLVED_PARTIAL |
          APPEALED | APPEAL_RESOLVED | CLOSED),
  description, evidencePhotos[], sellerResponseNote, sellerEvidencePhotos[],
  resolutionNote, resolutionAmountCents, resolvedByStaffId,
  appealNote, appealEvidencePhotos[], appealResolvedNote,
  deadlineAt, resolvedAt, appealedAt, appealResolvedAt,
  createdAt, updatedAt
}
```

### 3.3 New tables (V4 additive)

#### disputeRule

Configurable auto-resolution rules managed by Trust & Safety staff.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| name | text UNIQUE | Human-readable rule name |
| ruleType | text NOT NULL | auto_close_delivered, auto_close_no_response, auto_escalate, refund_on_no_tracking, auto_refund_low_value, chargeback_prevention |
| priority | integer default 100 | Lower = higher priority; evaluated in order |
| conditions | jsonb NOT NULL | See condition schema below |
| action | text NOT NULL | close_buyer_favor, close_seller_favor, escalate, refund_partial, prevent_chargeback |
| actionParams | jsonb default '{}' | { refundPercent?, notifyBuyer?, notifySeller?, escalateTo? } |
| isActive | boolean default true | |
| createdByStaffId | text NOT NULL | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

Index: `(ruleType, isActive)`, `(priority)`

#### disputeRuleExecution

Audit trail of every auto-resolution rule execution. Immutable.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| disputeId | text FK -> dispute.id | onDelete: cascade |
| ruleId | text FK -> disputeRule.id | onDelete: set null (rule may be deleted later) |
| ruleName | text NOT NULL | Snapshot of rule name at execution time |
| conditions | jsonb NOT NULL | Snapshot of conditions that were evaluated |
| context | jsonb NOT NULL | Snapshot of dispute context at evaluation time |
| action | text NOT NULL | Action that was taken |
| outcome | text NOT NULL | success, skipped_bias, skipped_manual_override, failed |
| errorMessage | text | If outcome = failed |
| executedAt | timestamptz NOT NULL | |

Indexes: `(disputeId, executedAt)`, `(ruleId)`

#### disputeSla

Per-dispute SLA tracking with escalation triggers.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| disputeId | text UNIQUE FK -> dispute.id | onDelete: cascade |
| currentStage | text NOT NULL | seller_response, buyer_response, platform_review, supervisor_review, final |
| stageStartedAt | timestamptz NOT NULL | |
| slaDeadline | timestamptz NOT NULL | |
| escalatedAt | timestamptz | |
| isOverdue | boolean default false | |
| escalationLevel | integer default 0 | 0=auto, 1=agent, 2=supervisor, 3=platform_decision |

Indexes: `(slaDeadline, isOverdue)`, `(currentStage)`, `(escalationLevel)`

#### disputeEvidence

Structured evidence records beyond the existing photo arrays on the dispute table.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| disputeId | text FK -> dispute.id | onDelete: cascade |
| submittedBy | text NOT NULL | buyer, seller, platform |
| submitterId | text NOT NULL | userId or staffId |
| evidenceType | text NOT NULL | tracking, photo, receipt, communication, other |
| description | text | |
| storageKey | text | R2/S3 key for file uploads |
| metadata | jsonb default '{}' | { mimeType, fileSizeBytes, originalFilename } |
| createdAt | timestamptz | |

Index: `(disputeId, submittedBy)`

#### disputeTimeline

Immutable event log for dispute lifecycle. Never updated, only appended.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| disputeId | text FK -> dispute.id | onDelete: cascade |
| eventType | text NOT NULL | opened, response, evidence, escalated, resolved, auto_action, sla_breach, appeal_filed, appeal_resolved |
| actorType | text NOT NULL | buyer, seller, platform, system |
| actorId | text | |
| description | text NOT NULL | Human-readable event description |
| metadata | jsonb default '{}' | |
| createdAt | timestamptz NOT NULL | |

Index: `(disputeId, createdAt)`

#### disputeResolution

Final resolution record with Decision #92 waterfall result and audit linkage.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| disputeId | text UNIQUE FK -> dispute.id | onDelete: restrict |
| outcome | text NOT NULL | buyer_favor, seller_favor, split, withdrawn |
| reason | text NOT NULL | |
| refundCents | integer default 0 | |
| sellerDebited | boolean default false | |
| resolvedBy | text NOT NULL | auto, staff, system |
| resolvedById | text | staffId if manual |
| ruleId | text FK -> disputeRule.id | If auto-resolved (set null on rule delete) |
| waterfallResult | jsonb | Decision #92 recovery breakdown { recoveredFromAvailableCents, recoveredFromReservedCents, platformAbsorbedCents } |
| createdAt | timestamptz | |

Index: `(outcome)`, `(resolvedBy)`

### 3.4 Additive columns on existing `dispute` table

| Column | Type | Notes |
|--------|------|-------|
| category | text | item_not_received, item_not_as_described, damaged, counterfeit, other |
| buyerClaim | text | Buyer's extended claim text |
| sellerResponse | text | Seller's extended response text |
| lastActionAt | timestamptz | Updated on every action |
| isAutoResolvable | boolean default true | Staff can disable for individual disputes |
| aiSentimentScore | real | Future: AI sentiment analysis score (0-1) |
| aiEvidenceQualityScore | real | Future: AI evidence quality score (0-1) |

---

## 4. Dispute State Machine (V3 canonical -- unchanged)

```
OPEN --> UNDER_REVIEW --> RESOLVED_BUYER (full refund via waterfall)
                      \-> RESOLVED_SELLER (no refund)
                      \-> RESOLVED_PARTIAL (partial refund via waterfall)
RESOLVED_* --> APPEALED --> APPEAL_RESOLVED --> CLOSED
```

### 4.1 Auto-resolution integration points

Auto-resolution plugs into the existing state machine. It never introduces new
states -- it only accelerates transitions via rule evaluation.

| Auto-action | Transition | Condition |
|-------------|------------|-----------|
| Auto-close delivered | OPEN -> RESOLVED_SELLER | Delivery confirmed + grace period |
| Auto-refund no tracking | OPEN -> RESOLVED_BUYER | No tracking + 7d since open |
| Auto-refund low value | OPEN -> RESOLVED_BUYER | Order total < threshold + buyer has good history |
| Auto-escalate no response | OPEN -> UNDER_REVIEW | Seller non-responsive + SLA breach |
| Auto-close inactivity | OPEN -> RESOLVED_SELLER | 14d no activity |
| Chargeback prevention | OPEN -> RESOLVED_BUYER | High chargeback probability score |

---

## 5. Auto-Resolution Rule Engine

Lives in `packages/commerce/src/dispute-auto-resolve.ts`.

### 5.1 Rule condition schema

```ts
interface RuleConditions {
  deliveryConfirmed?: boolean;
  daysSinceDelivery?: number;      // minimum days
  hasTracking?: boolean;
  sellerResponded?: boolean;
  buyerResponded?: boolean;
  daysSinceOpen?: number;          // minimum days
  claimType?: ClaimType;           // optional filter
  orderTotalCentsMax?: number;     // only for orders under this amount
  buyerClaimCount90Days?: number;  // max claims in 90 days (fraud filter)
  sellerScoreBand?: string;        // EXCELLENT, GOOD, FAIR, POOR
  chargebackProbability?: number;  // 0-1 threshold
}
```

### 5.2 Evaluation flow

1. Load active rules sorted by `priority ASC`
2. Build context from dispute + order + shipment data
3. Apply seller protection score bias (see section 7)
4. For each rule, check `isAutoResolvable` flag on dispute
5. Match first rule where ALL conditions are satisfied
6. Log evaluation to `disputeRuleExecution`
7. Execute the matched action
8. Create `disputeTimeline` event
9. Send notifications

### 5.3 Action execution

| Action | Behavior |
|--------|----------|
| `close_buyer_favor` | Transition to RESOLVED_BUYER, run Decision #92 waterfall, issue refund |
| `close_seller_favor` | Transition to RESOLVED_SELLER, no refund |
| `refund_partial` | Transition to RESOLVED_PARTIAL, waterfall for `actionParams.refundPercent` |
| `escalate` | Transition to UNDER_REVIEW, create/update SLA timer, assign to agent queue |
| `prevent_chargeback` | Pre-emptive refund to avoid Stripe chargeback fee |

### 5.4 Decision #92 Integration

When auto-resolution results in a buyer-favorable outcome:

1. Calculate refund amount (return request amount or order total)
2. Call `recoverFromSellerWaterfall()` from `packages/commerce/src/dispute-recovery.ts`
3. Log waterfall result in `disputeResolution.waterfallResult`
4. Process refund via `processReturnRefund()` from `@twicely/stripe/refunds`
5. The waterfall is best-effort -- failure does NOT block refund

---

## 6. SLA Monitoring (BullMQ)

### 6.1 Queue: `dispute-sla-monitor`

Lives in `packages/jobs/src/dispute-sla-monitor.ts`. Registered as a BullMQ
repeatable job in `cron-jobs.ts` with `tz: 'UTC'`.

### 6.2 Monitor tick logic

1. Find overdue SLAs: `WHERE slaDeadline < now() AND isOverdue = false AND currentStage != 'final'`
2. Mark as overdue, set `isOverdue = true`
3. For `seller_response` stage + no seller response -> auto-escalate (if setting enabled)
4. For `buyer_response` stage + no buyer response -> close in seller favor
5. For `platform_review` stage overdue -> alert ops team, bump escalation level
6. For all overdue: evaluate auto-resolution rules
7. Find open auto-resolvable disputes: check delivery-confirmed auto-close
8. Log `disputeTimeline` events for all actions

### 6.3 SLA stage transitions

| Stage | Duration (from platform_settings) | On breach |
|-------|-----------------------------------|-----------|
| seller_response | `disputes.sla.sellerResponseHours` (default 48h) | Auto-escalate to platform |
| buyer_response | `disputes.sla.buyerResponseHours` (default 72h) | Close in seller favor |
| platform_review | `disputes.sla.platformReviewHours` (default 120h) | Alert ops team |
| supervisor_review | `disputes.sla.supervisorReviewHours` (default 48h) | Platform auto-decision |
| final | -- | N/A (terminal) |

### 6.4 Seller response deadline automation

When a dispute is opened:
1. Create `disputeSla` record with `currentStage = 'seller_response'`
2. Set `slaDeadline` to `now + sellerResponseHours`
3. Notify seller of deadline
4. If seller responds, advance to `buyer_response` stage with new deadline
5. If deadline passes without response, trigger SLA breach action

---

## 7. Seller Protection Score Integration

From V3 seller scoring system (`@twicely/scoring`):

| Score Tier | Auto-Resolution Behavior |
|------------|-------------------------|
| EXCELLENT (90-100) | Favor seller in ambiguous cases; all auto buyer-favor rules require manual confirmation |
| GOOD (70-89) | Standard rules apply |
| FAIR (50-69) | Auto-approve buyer claims if seller non-responsive at 48h |
| POOR (0-49) | Auto-approve buyer claims immediately with any evidence |

### 7.1 Bias function

```ts
async function getAutoResolutionBias(
  sellerId: string
): Promise<'SELLER' | 'NEUTRAL' | 'BUYER'> {
  const band = await getSellerPerformanceBand(sellerId);
  if (band === 'EXCELLENT') return 'SELLER';
  if (band === 'POOR') return 'BUYER';
  return 'NEUTRAL';
}
```

When bias = SELLER: skip `close_buyer_favor` and `refund_partial` auto-rules; escalate to staff instead.
When bias = BUYER: lower evidence thresholds, shorter effective SLA windows (halved).

---

## 8. Escalation Ladder

### 8.1 Levels

| Level | Actor | Timeout | On timeout |
|-------|-------|---------|------------|
| 0 | Auto-resolution engine | Immediate | Escalate to level 1 if no rule matches |
| 1 | Support agent | `disputes.sla.platformReviewHours` | Escalate to level 2 |
| 2 | Supervisor | `disputes.sla.supervisorReviewHours` | Escalate to level 3 |
| 3 | Platform decision (senior staff) | No timeout | Must resolve manually |

### 8.2 Escalation triggers

- SLA deadline breach at any level
- Buyer or seller requests escalation (`POST /api/disputes/:id/escalate`)
- High-value dispute (order total > `disputes.escalation.highValueThresholdCents`, default 50000)
- Repeat offender detected (buyer OR seller flagged by fraud system)

---

## 9. Fraud Detection Integration

### 9.1 Buyer abuse detection

| Trigger | Action |
|---------|--------|
| 3+ claims overturned on appeal in 90 days | Flag account for review |
| 5+ claims filed in 30 days | Disable auto-approve for this buyer |
| Claim rate > 15% of orders | Require manual review for all future claims |
| Return fraud pattern (keeps item + gets refund) | Escalate all future claims to level 2 |

Buyer abuse flags stored in `user.trustFlags` (existing jsonb column).

### 9.2 Seller abuse detection

| Trigger | Action |
|---------|--------|
| 5+ INAD disputes in 30 days | Lower seller score, require listing review |
| Tracking shows different destination | Flag for investigation |
| Pattern of "delivered" claims with buyer denials | Manual review required |

### 9.3 Chargeback prevention

When `disputes.chargebackPrevention.enabled` is true:
1. Score every open dispute for chargeback probability (based on claim type, amount, buyer history)
2. If probability > `disputes.chargebackPrevention.threshold` (default 0.7):
   - Auto-refund via `prevent_chargeback` rule action
   - Log as chargeback prevention in `disputeRuleExecution`
   - Saves the platform the Stripe chargeback fee ($15+)

---

## 10. AI Integration (deferred -- hooks only)

### 10.1 Sentiment analysis

Future: analyze buyer/seller messages for urgency and frustration level.
V4 installs the columns `aiSentimentScore` on `dispute` and the setting key.

### 10.2 Evidence quality scoring

Future: analyze uploaded photos for relevance and clarity.
V4 installs the column `aiEvidenceQualityScore` on `dispute` and the setting key.

### 10.3 Hook interface

```ts
interface DisputeAIAnalysis {
  sentimentScore: number;          // 0 (calm) to 1 (escalated)
  evidenceQualityScore: number;    // 0 (poor) to 1 (conclusive)
  suggestedOutcome: string;        // buyer_favor, seller_favor, split
  confidence: number;              // 0-1
  reasoning: string;               // human-readable explanation
}
```

---

## 11. Evidence Handling

### 11.1 Submission flow

1. Validate dispute exists and user is buyer/seller on it
2. Check evidence count limit (`disputes.evidence.maxPerDispute`, default 10)
3. Validate file size (`disputes.evidence.maxFileSizeBytes`, default 10 MB)
4. Upload file to R2 (via `@twicely/storage`)
5. Create `disputeEvidence` record
6. Create `disputeTimeline` event
7. Update `dispute.lastActionAt`
8. Notify counterparty

### 11.2 Allowed evidence types

| Type | Accepted formats | Max size |
|------|-----------------|----------|
| photo | JPEG, PNG, GIF, WEBP | 10 MB |
| receipt | PDF, JPEG, PNG | 10 MB |
| tracking | URL or screenshot (PNG, JPEG) | 10 MB |
| communication | PDF, PNG, text | 10 MB |

---

## 12. RBAC (CASL Permissions)

### 12.1 Subject: `Dispute`

| Actor | Actions |
|-------|---------|
| Buyer | `create` own, `read` own, submit evidence on own |
| Seller | `update` own (respond), `read` own, submit evidence on own |
| Staff (SUPPORT) | `read` all, `update` (respond on behalf) |
| Staff (TRUST_SAFETY) | `read`, `update`, `manage` rules, override auto-resolution |
| Staff (ADMIN) | `manage` all |

### 12.2 Subject: `DisputeRule`

| Actor | Actions |
|-------|---------|
| Staff (TRUST_SAFETY) | `manage` |
| Staff (ADMIN) | `manage` |
| Staff (SUPPORT) | `read` |

### 12.3 Subject: `DisputeEvidence`

| Actor | Actions |
|-------|---------|
| Buyer | `create` on own disputes, `read` own |
| Seller | `create` on own disputes, `read` own |
| Staff (SUPPORT+) | `read` all |

---

## 13. Platform Settings Keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `disputes.sla.sellerResponseHours` | number | 48 | Seller must respond |
| `disputes.sla.buyerResponseHours` | number | 72 | Buyer must respond to seller |
| `disputes.sla.platformReviewHours` | number | 120 | Platform decision window |
| `disputes.sla.supervisorReviewHours` | number | 48 | Supervisor escalation window |
| `disputes.sla.autoEscalateOnNoResponse` | boolean | true | Auto-escalate on SLA breach |
| `disputes.sla.autoCloseOnDeliveryConfirmed` | boolean | true | Close if delivered |
| `disputes.sla.deliveryConfirmationGraceDays` | number | 3 | Grace period after delivery |
| `disputes.sla.autoCloseInactivityDays` | number | 14 | Close on inactivity |
| `disputes.evidence.maxPerDispute` | number | 10 | Max evidence items |
| `disputes.evidence.maxFileSizeBytes` | number | 10485760 | 10 MB |
| `disputes.monitor.tickPattern` | string | `*/15 * * * *` | SLA monitor cron |
| `disputes.escalation.highValueThresholdCents` | number | 50000 | Auto-escalate above this |
| `disputes.autoRefund.lowValueThresholdCents` | number | 2000 | Auto-refund below this |
| `disputes.chargebackPrevention.enabled` | boolean | false | Enable chargeback prevention |
| `disputes.chargebackPrevention.threshold` | number | 0.7 | Probability threshold |
| `disputes.buyerAbuse.maxClaimsOverturnedFor90d` | number | 3 | Abuse flag threshold |
| `disputes.buyerAbuse.maxClaimsFiled30d` | number | 5 | High-claim-rate threshold |
| `disputes.buyerAbuse.maxClaimRatePercent` | number | 15 | Claim-to-order ratio |
| `disputes.ai.sentimentEndpoint` | string | (empty) | Future AI sentiment endpoint |
| `disputes.ai.evidenceEndpoint` | string | (empty) | Future AI evidence endpoint |

---

## 14. Notifications

| Event | Recipients | Template key |
|-------|-----------|-------------|
| Dispute opened | buyer, seller | `dispute.opened` |
| Dispute resolved | buyer, seller | `dispute.resolved` |
| Dispute auto-resolved | buyer, seller | `dispute.auto_resolved` |
| Dispute escalated | seller, assigned agent | `dispute.escalated` |
| SLA breach (seller) | seller | `dispute.sla_breach` |
| SLA breach (platform) | ops staff | `dispute.sla_platform_breach` |
| Evidence submitted | counterparty | `dispute.evidence_submitted` |
| Seller response deadline reminder | seller | `dispute.seller_deadline_reminder` |
| Chargeback prevention refund | buyer, seller | `dispute.chargeback_prevented` |

---

## 15. Audit Events

| Event | Trigger |
|-------|---------|
| `dispute.opened` | Buyer escalates return to dispute |
| `dispute.assigned` | Staff assigns themselves |
| `dispute.resolved` | Staff or auto resolves |
| `dispute.auto_resolved` | Rule engine auto-resolves |
| `dispute.escalated` | Auto or user escalation |
| `dispute.evidence_submitted` | Any party submits evidence |
| `dispute.rule_created` | Staff creates auto-resolution rule |
| `dispute.rule_updated` | Staff modifies rule |
| `dispute.rule_disabled` | Staff disables a rule |
| `dispute.sla_breached` | SLA deadline passes |
| `dispute.recovery_waterfall` | Decision #92 waterfall executes |
| `dispute.chargeback_prevented` | Pre-emptive refund issued |
| `dispute.buyer_abuse_flagged` | Abuse pattern detected |

---

## 16. Default Auto-Resolution Rules (seed data)

| # | Name | Priority | Conditions | Action |
|---|------|----------|-----------|--------|
| 1 | Auto-close on delivery confirmation | 10 | `deliveryConfirmed=true, daysSinceDelivery>=3` | close_seller_favor |
| 2 | Auto-refund on no tracking | 20 | `hasTracking=false, daysSinceOpen>=7` | close_buyer_favor |
| 3 | Auto-refund low value | 25 | `orderTotalCentsMax<=2000, daysSinceOpen>=2` | close_buyer_favor |
| 4 | Auto-escalate seller no response | 30 | `sellerResponded=false, daysSinceOpen>=3` | escalate |
| 5 | Auto-close on inactivity | 100 | `daysSinceOpen>=14` | close_seller_favor |

---

## 17. Out of Scope

- No external arbitration or legal document generation
- No insurance claims
- No chargeback representment (separate domain: `@twicely/stripe/chargebacks`)
- Decision #92 waterfall is not modified or replaced by this canonical
- No multi-language dispute templates
- No video evidence support (photos and documents only)

---

## 18. Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | 2026-04-09 | V4 merge: V2 phase 28 + V3 dispute engine + Decision #92 waterfall + buyer protection integration |
| 4.1 | 2026-04-09 | V4 rewrite: added disputeRuleExecution audit trail, escalation ladder (4 levels), chargeback prevention, fraud detection integration, AI hooks, expanded platform_settings, seller response deadline automation |
