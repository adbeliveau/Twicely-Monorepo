# V4 Install Phase 08 -- Disputes Automation

**Status:** DRAFT (V4)
**Prereq:** V3 dispute system exists (`packages/commerce/src/disputes.ts`, `dispute-queries.ts`, `dispute-recovery.ts`, `buyer-protection.ts`), jobs infrastructure (`packages/jobs`), scoring (`packages/scoring`)
**Canonical:** `rules/canonicals/32_DISPUTES_AUTOMATION.md`
**Estimated:** 10-14 hours
**Scope:** Schema + auto-resolution rules engine + SLA monitoring + evidence handling + escalation ladder + fraud detection + chargeback prevention + BullMQ jobs + CASL + tests

---

## 0) What this phase installs

### Backend (packages)
- `packages/db/src/schema/disputes.ts` -- NEW file: 6 new tables for dispute automation
- `packages/db/src/schema/shipping.ts` -- additive: 7 new columns on existing `dispute` table
- `packages/commerce/src/dispute-auto-resolve.ts` -- auto-resolution rule engine
- `packages/commerce/src/dispute-sla.ts` -- SLA management (create, advance, check)
- `packages/commerce/src/dispute-evidence.ts` -- structured evidence submission
- `packages/commerce/src/dispute-timeline.ts` -- immutable timeline event creation
- `packages/commerce/src/dispute-escalation.ts` -- 4-level escalation ladder
- `packages/commerce/src/dispute-fraud-detection.ts` -- buyer/seller abuse detection
- `packages/commerce/src/dispute-rules-crud.ts` -- CRUD for auto-resolution rules (staff)
- `packages/jobs/src/dispute-sla-monitor.ts` -- BullMQ repeatable job for SLA monitoring
- `packages/jobs/src/dispute-auto-resolve-tick.ts` -- BullMQ repeatable job for auto-resolution scan

### Backend (apps/web server actions)
- `apps/web/src/lib/actions/dispute-rule-actions.ts` -- create, update, toggle rules
- `apps/web/src/lib/actions/dispute-evidence-actions.ts` -- submit evidence
- `apps/web/src/lib/actions/dispute-escalation-actions.ts` -- escalate, override auto-resolution
- `apps/web/src/lib/queries/dispute-automation-queries.ts` -- rules list, SLA dashboard, timeline

### UI pages
- `apps/web/src/app/(hub)/admin/disputes/rules/page.tsx` -- rule management
- `apps/web/src/app/(hub)/admin/disputes/queue/page.tsx` -- enhanced dispute queue with SLA indicators
- `apps/web/src/app/(hub)/admin/disputes/[id]/page.tsx` -- enhanced detail with timeline + evidence viewer

### Tests
- `packages/commerce/src/__tests__/dispute-auto-resolve.test.ts`
- `packages/commerce/src/__tests__/dispute-sla.test.ts`
- `packages/commerce/src/__tests__/dispute-evidence.test.ts`
- `packages/commerce/src/__tests__/dispute-escalation.test.ts`
- `packages/commerce/src/__tests__/dispute-fraud-detection.test.ts`
- `packages/commerce/src/__tests__/dispute-rules-crud.test.ts`
- `packages/jobs/src/__tests__/dispute-sla-monitor.test.ts`

### Explicit exclusions
- No external arbitration or legal document generation
- No insurance claims
- No chargeback representment (separate: `@twicely/stripe/chargebacks`)
- No AI implementation (hooks/columns only; endpoints configured via platform_settings)
- No video evidence support
- Decision #92 waterfall is NOT modified

---

## 1) Schema (Drizzle)

### 1.1 Create new file `packages/db/src/schema/disputes.ts`

```ts
import { pgTable, text, integer, boolean, timestamp, real, index, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { dispute } from './shipping';

// 7.4 disputeRule
export const disputeRule = pgTable('dispute_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').unique().notNull(),
  ruleType:            text('rule_type').notNull(),
  priority:            integer('priority').notNull().default(100),
  conditions:          jsonb('conditions').notNull(),
  action:              text('action').notNull(),
  actionParams:        jsonb('action_params').notNull().default('{}'),
  isActive:            boolean('is_active').notNull().default(true),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleTypeActiveIdx:   index('dr_rule_type_active').on(table.ruleType, table.isActive),
  priorityIdx:         index('dr_priority').on(table.priority),
}));

// 7.5 disputeRuleExecution
export const disputeRuleExecution = pgTable('dispute_rule_execution', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  ruleId:              text('rule_id')
    .references(() => disputeRule.id, { onDelete: 'set null' }),
  ruleName:            text('rule_name').notNull(),
  conditions:          jsonb('conditions').notNull(),
  context:             jsonb('context').notNull(),
  action:              text('action').notNull(),
  outcome:             text('outcome').notNull(),
  errorMessage:        text('error_message'),
  executedAt:          timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disputeTimeIdx:      index('dre_dispute_time').on(table.disputeId, table.executedAt),
  ruleIdx:             index('dre_rule').on(table.ruleId),
}));

// 7.6 disputeSla
export const disputeSla = pgTable('dispute_sla', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').unique().notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  currentStage:        text('current_stage').notNull(),
  stageStartedAt:      timestamp('stage_started_at', { withTimezone: true }).notNull(),
  slaDeadline:         timestamp('sla_deadline', { withTimezone: true }).notNull(),
  escalatedAt:         timestamp('escalated_at', { withTimezone: true }),
  isOverdue:           boolean('is_overdue').notNull().default(false),
  escalationLevel:     integer('escalation_level').notNull().default(0),
}, (table) => ({
  deadlineOverdueIdx:  index('dsla_deadline_overdue').on(table.slaDeadline, table.isOverdue),
  stageIdx:            index('dsla_stage').on(table.currentStage),
  escalationIdx:       index('dsla_escalation').on(table.escalationLevel),
}));

// 7.7 disputeEvidence
export const disputeEvidence = pgTable('dispute_evidence', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  submittedBy:         text('submitted_by').notNull(),
  submitterId:         text('submitter_id').notNull(),
  evidenceType:        text('evidence_type').notNull(),
  description:         text('description'),
  storageKey:          text('storage_key'),
  metadata:            jsonb('metadata').notNull().default('{}'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disputeSubmitterIdx: index('de_dispute_submitter').on(table.disputeId, table.submittedBy),
}));

// 7.8 disputeTimeline
export const disputeTimeline = pgTable('dispute_timeline', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  eventType:           text('event_type').notNull(),
  actorType:           text('actor_type').notNull(),
  actorId:             text('actor_id'),
  description:         text('description').notNull(),
  metadata:            jsonb('metadata').notNull().default('{}'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disputeTimeIdx:      index('dt_dispute_time').on(table.disputeId, table.createdAt),
}));

// 7.9 disputeResolution
export const disputeResolution = pgTable('dispute_resolution', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').unique().notNull()
    .references(() => dispute.id, { onDelete: 'restrict' }),
  outcome:             text('outcome').notNull(),
  reason:              text('reason').notNull(),
  refundCents:         integer('refund_cents').notNull().default(0),
  sellerDebited:       boolean('seller_debited').notNull().default(false),
  resolvedBy:          text('resolved_by').notNull(),
  resolvedById:        text('resolved_by_id'),
  ruleId:              text('rule_id')
    .references(() => disputeRule.id, { onDelete: 'set null' }),
  waterfallResult:     jsonb('waterfall_result'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  outcomeIdx:          index('dres_outcome').on(table.outcome),
  resolvedByIdx:       index('dres_resolved_by').on(table.resolvedBy),
}));
```

### 1.2 Additive columns on existing `dispute` table

Add to `packages/db/src/schema/shipping.ts` dispute table definition:

```ts
// V4 additive columns for disputes automation
category:              text('category'),
buyerClaim:            text('buyer_claim'),
sellerResponse:        text('seller_response'),
lastActionAt:          timestamp('last_action_at', { withTimezone: true }),
isAutoResolvable:      boolean('is_auto_resolvable').notNull().default(true),
aiSentimentScore:      real('ai_sentiment_score'),
aiEvidenceQualityScore: real('ai_evidence_quality_score'),
```

### 1.3 Export from schema index

Add to `packages/db/src/schema/index.ts`:
```ts
export {
  disputeRule,
  disputeRuleExecution,
  disputeSla,
  disputeEvidence,
  disputeTimeline,
  disputeResolution,
} from './disputes';
```

### 1.4 Generate migration

```bash
cd packages/db && pnpm drizzle-kit generate
```

---

## 2) Server actions + queries

### 2.1 Auto-resolution engine (`packages/commerce/src/dispute-auto-resolve.ts`)

**Imports:** `@twicely/db`, schema tables, `dispute-recovery`, `@twicely/stripe/refunds`, `@twicely/notifications/service`, `@twicely/logger`, `@twicely/scoring` (dynamic import to avoid circular dep).

**Exports:**
- `evaluateAutoResolution(disputeId)` -- returns `{ shouldResolve, rule?, action? }`
- `executeAutoResolution(disputeId, rule)` -- execute matched rule action
- `buildDisputeContext(disputeId)` -- build RuleConditions context from dispute + order + shipment

**Rule condition schema** (jsonb on `disputeRule.conditions`):
```ts
interface RuleConditions {
  deliveryConfirmed?: boolean;
  daysSinceDelivery?: number;      // minimum days
  hasTracking?: boolean;
  sellerResponded?: boolean;
  buyerResponded?: boolean;
  daysSinceOpen?: number;          // minimum days
  claimType?: string;              // optional filter
  orderTotalCentsMax?: number;     // only for orders under this amount
  buyerClaimCount90Days?: number;  // max claims in 90 days (fraud filter)
  sellerScoreBand?: string;        // EXCELLENT, GOOD, FAIR, POOR
  chargebackProbability?: number;  // 0-1 threshold
}
```

**Evaluation flow:**
1. Load dispute (check `isAutoResolvable = true`)
2. Load active rules sorted by `priority ASC`
3. Build context from dispute + order + shipment
4. Get seller protection bias via `getAutoResolutionBias(sellerId)` (dynamic import from `@twicely/scoring`)
5. For each rule, check all conditions against context
6. If bias = SELLER and action = `close_buyer_favor`: skip, log as `skipped_bias` in `disputeRuleExecution`
7. On match: execute action, create `disputeRuleExecution` record (snapshot rule name, conditions, context), create `disputeTimeline` event, create `disputeResolution` if terminal

**Action execution:**
| Action | Behavior |
|--------|----------|
| `close_buyer_favor` | Call `recoverFromSellerWaterfall()`, then `processReturnRefund()`. Store `waterfallResult` in `disputeResolution`. |
| `close_seller_favor` | Update dispute status to RESOLVED_SELLER. No refund. |
| `refund_partial` | Waterfall for `actionParams.refundPercent` of order total, then partial refund. |
| `escalate` | Call `escalateDispute()` from `dispute-escalation.ts`. |
| `prevent_chargeback` | Pre-emptive full refund. Log in `disputeRuleExecution` with outcome = 'success'. |

**Decision #92 integration:** waterfall is best-effort. Failure does NOT block refund. Waterfall result stored in `disputeResolution.waterfallResult`.

### 2.2 SLA management (`packages/commerce/src/dispute-sla.ts`)

**Exports:**
- `createDisputeSla(disputeId, stage)` -- creates SLA record with deadline from platform_settings
- `advanceSlaStage(disputeId, newStage)` -- advance to next stage with new deadline
- `checkSlaBreaches()` -- find all overdue SLAs, return list for processing
- `markSlaOverdue(slaId)` -- set isOverdue = true
- `getSlaDeadline(stage)` -- read hours from platform_settings, compute deadline

SLA stage durations (from platform_settings, never hardcoded):
```
seller_response:    disputes.sla.sellerResponseHours     (default 48)
buyer_response:     disputes.sla.buyerResponseHours      (default 72)
platform_review:    disputes.sla.platformReviewHours     (default 120)
supervisor_review:  disputes.sla.supervisorReviewHours   (default 48)
```

### 2.3 Evidence handling (`packages/commerce/src/dispute-evidence.ts`)

**Exports:**
- `submitEvidence({ disputeId, submittedBy, submitterId, evidenceType, description?, storageKey?, metadata? })` -- validates limits, creates record + timeline event, updates `dispute.lastActionAt`, notifies counterparty
- `getEvidenceForDispute(disputeId)` -- return all evidence ordered by createdAt

**Validation:**
- Evidence count < `disputes.evidence.maxPerDispute` (default 10)
- File size < `disputes.evidence.maxFileSizeBytes` (default 10 MB) -- from metadata.fileSizeBytes
- evidenceType in `['tracking', 'photo', 'receipt', 'communication', 'other']`

### 2.4 Timeline (`packages/commerce/src/dispute-timeline.ts`)

**Exports:**
- `addTimelineEvent({ disputeId, eventType, actorType, actorId?, description, metadata? })` -- insert-only, immutable
- `getTimeline(disputeId)` -- return ordered timeline events
- `getTimelineSummary(disputeId)` -- return event counts by type

Event types: `opened`, `response`, `evidence`, `escalated`, `resolved`, `auto_action`, `sla_breach`, `appeal_filed`, `appeal_resolved`

### 2.5 Escalation ladder (`packages/commerce/src/dispute-escalation.ts`)

**Exports:**
- `escalateDispute(disputeId, actorType, reason, actorId?)` -- bump escalation level, update SLA, notify
- `getEscalationLevel(disputeId)` -- read from disputeSla
- `canEscalate(disputeId, actorType)` -- check if further escalation is possible

Escalation levels:
```
0: Auto-resolution engine (initial)
1: Support agent (assigned via dispute queue)
2: Supervisor (escalated from agent)
3: Platform decision (senior staff, final authority)
```

On escalation:
1. Update `disputeSla.escalationLevel`
2. Advance SLA stage (seller_response -> platform_review, etc.)
3. Create `disputeTimeline` event with `eventType = 'escalated'`
4. Notify appropriate party

### 2.6 Fraud detection (`packages/commerce/src/dispute-fraud-detection.ts`)

**Exports:**
- `checkBuyerAbusePatterns(buyerId)` -- count claims, overturn rate, claim-to-order ratio
- `checkSellerAbusePatterns(sellerId)` -- INAD rate, tracking anomalies
- `flagUserForReview(userId, flagType, metadata)` -- add flag to `user.trustFlags`
- `shouldDisableAutoApprove(buyerId)` -- check if buyer has abuse flags

Thresholds (from platform_settings):
- `disputes.buyerAbuse.maxClaimsOverturnedFor90d` (default 3)
- `disputes.buyerAbuse.maxClaimsFiled30d` (default 5)
- `disputes.buyerAbuse.maxClaimRatePercent` (default 15)

### 2.7 Rules CRUD (`packages/commerce/src/dispute-rules-crud.ts`)

**Exports:**
- `createDisputeRule({ name, ruleType, priority, conditions, action, actionParams, staffId })` -- validate, create
- `updateDisputeRule(ruleId, updates, staffId)` -- validate conditions/action, update
- `toggleDisputeRule(ruleId, isActive, staffId)` -- enable/disable
- `listDisputeRules(filters?)` -- return rules sorted by priority
- `getDisputeRule(ruleId)` -- single rule detail

### 2.8 Server actions (`apps/web/src/lib/actions/`)

#### dispute-rule-actions.ts
- `createRuleAction(formData)` -- CASL check: `manage` on `DisputeRule`
- `updateRuleAction(ruleId, formData)` -- CASL check: `manage` on `DisputeRule`
- `toggleRuleAction(ruleId, isActive)` -- CASL check: `manage` on `DisputeRule`

#### dispute-evidence-actions.ts
- `submitEvidenceAction(disputeId, formData)` -- CASL check: user is buyer/seller on dispute
- `getEvidenceAction(disputeId)` -- CASL check: user is party or staff

#### dispute-escalation-actions.ts
- `escalateDisputeAction(disputeId, reason)` -- CASL check: user is party on dispute or staff
- `overrideAutoResolutionAction(disputeId, disable)` -- CASL check: `manage` on `Dispute` (TRUST_SAFETY+)

### 2.9 Queries (`apps/web/src/lib/queries/dispute-automation-queries.ts`)

- `listDisputeRules(filters?)` -- paginated rule list for admin
- `getDisputeQueueWithSla(filters?)` -- dispute queue enhanced with SLA status, overdue indicators
- `getDisputeDetailWithTimeline(disputeId)` -- full dispute + timeline + evidence + SLA + resolution
- `getDisputeAutoResolutionHistory(disputeId)` -- rule executions for a dispute
- `getDisputeAutomationStats()` -- dashboard stats: auto-resolved count, avg resolution time, SLA compliance rate

---

## 3) UI pages

### 3.1 Dispute rules management `(hub)/admin/disputes/rules`

- Rules list sorted by priority (drag to reorder)
- Each rule card: name, type badge, conditions summary, action badge, active toggle
- Create rule form: name, type selector, condition builder (JSON schema form), action selector, action params, priority
- Edit rule inline or in modal
- Execution history per rule (last 10 executions with outcome)

### 3.2 Enhanced dispute queue `(hub)/admin/disputes/queue`

Enhancements over existing V3 queue:
- SLA countdown indicator per dispute (green = on track, yellow = <4h remaining, red = overdue)
- Escalation level badge (0-3)
- Filter by: SLA status (on-time, warning, overdue), escalation level, claim type, auto-resolvable
- Sort by: SLA deadline, created date, escalation level
- Quick actions: assign, escalate, override auto-resolution
- Bulk actions: escalate selected, assign batch to agent

### 3.3 Enhanced dispute detail `(hub)/admin/disputes/[id]`

Enhancements over existing V3 detail:
- Full timeline (disputeTimeline) with chronological events, type-colored badges
- Evidence viewer: grid of evidence items with type icons, click to expand, file download
- SLA status panel: current stage, deadline countdown, escalation level
- Auto-resolution panel: matched rules, execution history (from disputeRuleExecution), bias information
- Manual resolution form: outcome selector, refund amount, resolution note
- Override toggle: disable/enable auto-resolution for this dispute
- Decision #92 waterfall result (if applicable): breakdown of available/reserved/platform-absorbed
- Buyer/seller history sidebar: past disputes, claim rate, abuse flags

---

## 4) Tests

### 4.1 dispute-auto-resolve.test.ts

| Test | Assertion |
|------|-----------|
| Delivery confirmed + 3d -> close_seller_favor | Dispute resolved, no refund |
| No tracking + 7d -> close_buyer_favor | Dispute resolved, waterfall called, refund issued |
| Low value order + 2d -> close_buyer_favor | Auto-refund for orders < 2000 cents |
| Seller no response + 3d -> escalate | Status = UNDER_REVIEW, SLA created |
| 14d inactivity -> close_seller_favor | Dispute resolved, no refund |
| isAutoResolvable = false skips all rules | Returns { shouldResolve: false } |
| SELLER bias skips close_buyer_favor | Logged as skipped_bias in disputeRuleExecution |
| BUYER bias applies rules at lower thresholds | close_buyer_favor matches earlier |
| No matching rule | Returns { shouldResolve: false } |
| Rule execution creates audit record | disputeRuleExecution row with correct context + conditions snapshots |
| Decision #92 waterfall called on buyer_favor | recoverFromSellerWaterfall receives correct params |
| Waterfall failure does not block refund | Refund proceeds, error logged |

### 4.2 dispute-sla.test.ts

| Test | Assertion |
|------|-----------|
| Create SLA with correct deadline | slaDeadline = now + sellerResponseHours from settings |
| Advance stage updates deadline | New stage, new deadline computed from platform_settings |
| Check breaches returns overdue SLAs | Only SLAs past deadline with isOverdue = false returned |
| Mark overdue sets flag | isOverdue = true |
| Deadline reads from platform_settings | Uses configured hours, not hardcoded values |
| Supervisor stage has separate timeout | Uses `disputes.sla.supervisorReviewHours` |

### 4.3 dispute-evidence.test.ts

| Test | Assertion |
|------|-----------|
| Submit evidence creates record | disputeEvidence row created |
| Submit evidence creates timeline event | disputeTimeline row with eventType = 'evidence' |
| Evidence limit enforced | Throws EVIDENCE_LIMIT_REACHED at max |
| Invalid evidence type rejected | Throws INVALID_EVIDENCE_TYPE |
| Updates dispute.lastActionAt | Timestamp updated on evidence submission |
| Buyer can submit on own dispute | Success |
| Non-party cannot submit | Throws FORBIDDEN |

### 4.4 dispute-escalation.test.ts

| Test | Assertion |
|------|-----------|
| Escalate bumps level | escalationLevel incremented by 1 |
| Escalate advances SLA stage | currentStage updated to next level |
| Cannot escalate past level 3 | Returns error |
| Buyer can escalate own dispute | Success |
| Seller can escalate own dispute | Success |
| Non-party cannot escalate | Returns FORBIDDEN |
| Already resolved cannot escalate | Returns CANNOT_ESCALATE |
| Timeline event created on escalation | disputeTimeline row with eventType = 'escalated' |

### 4.5 dispute-fraud-detection.test.ts

| Test | Assertion |
|------|-----------|
| 3+ overturned claims flags buyer | user.trustFlags updated with APPEAL_ABUSE_PATTERN |
| 5+ claims in 30d disables auto-approve | shouldDisableAutoApprove returns true |
| Claim rate > 15% flags for manual review | user.trustFlags updated |
| Seller with 5+ INAD in 30d flagged | User flagged for review |
| Clean buyer returns no flags | No action taken, no flags set |

### 4.6 dispute-rules-crud.test.ts

| Test | Assertion |
|------|-----------|
| Create rule with valid data | disputeRule row created |
| Duplicate name rejected | Throws unique constraint error |
| Update rule changes conditions + updatedAt | conditions modified, updatedAt bumped |
| Toggle rule changes isActive | isActive flipped |
| List rules ordered by priority | Results sorted by priority ASC |

### 4.7 dispute-sla-monitor.test.ts (BullMQ job)

| Test | Assertion |
|------|-----------|
| Tick finds and processes overdue SLAs | Overdue SLAs marked, appropriate actions taken |
| Seller non-response triggers auto-escalate | Dispute status = UNDER_REVIEW |
| Buyer non-response closes seller favor | Dispute status = RESOLVED_SELLER |
| Platform review overdue alerts ops team | Notification sent to ops staff |
| Open auto-resolvable disputes evaluated | Auto-resolution rules checked for newly qualifying disputes |
| Empty queue is no-op | No errors, no actions |

---

## 5) Doctor checks

```ts
{
  key: 'disputes.rule_table_exists',
  check: () => db.select().from(disputeRule).limit(1),
},
{
  key: 'disputes.default_rules_seeded',
  check: async () => {
    const count = await db.select({ c: sql`count(*)` })
      .from(disputeRule).where(eq(disputeRule.isActive, true));
    return Number(count[0].c) >= 5;
  },
},
{
  key: 'disputes.sla_table_exists',
  check: () => db.select().from(disputeSla).limit(1),
},
{
  key: 'disputes.evidence_table_exists',
  check: () => db.select().from(disputeEvidence).limit(1),
},
{
  key: 'disputes.timeline_table_exists',
  check: () => db.select().from(disputeTimeline).limit(1),
},
{
  key: 'disputes.resolution_table_exists',
  check: () => db.select().from(disputeResolution).limit(1),
},
{
  key: 'disputes.rule_execution_table_exists',
  check: () => db.select().from(disputeRuleExecution).limit(1),
},
{
  key: 'disputes.sla_monitor_job_registered',
  check: async () => {
    // Verify BullMQ repeatable job exists for dispute-sla-monitor
  },
},
{
  key: 'disputes.platform_settings_seeded',
  check: async () => {
    // Verify all 20 disputes.* settings exist in platform_settings
  },
},
{
  key: 'disputes.casl_subjects_wired',
  check: async () => {
    // Verify DisputeRule + DisputeEvidence subjects registered in CASL
  },
},
{
  key: 'disputes.auto_resolve_evaluates',
  check: async () => {
    // Create mock dispute context with delivery confirmed + 3 days
    // Run evaluateAutoResolution
    // Verify it matches the "auto-close on delivery" rule
    // Clean up test data
  },
},
```

---

## 6) Seed data

### 6.1 Default auto-resolution rules

Add to `apps/web/src/lib/db/seed/dispute-rules.ts`:

```ts
const defaultRules = [
  {
    name: 'Auto-close on delivery confirmation',
    ruleType: 'auto_close_delivered',
    priority: 10,
    conditions: { deliveryConfirmed: true, daysSinceDelivery: 3 },
    action: 'close_seller_favor',
    actionParams: {},
  },
  {
    name: 'Auto-refund on no tracking',
    ruleType: 'refund_on_no_tracking',
    priority: 20,
    conditions: { hasTracking: false, daysSinceOpen: 7 },
    action: 'close_buyer_favor',
    actionParams: {},
  },
  {
    name: 'Auto-refund low value order',
    ruleType: 'auto_refund_low_value',
    priority: 25,
    conditions: { orderTotalCentsMax: 2000, daysSinceOpen: 2 },
    action: 'close_buyer_favor',
    actionParams: {},
  },
  {
    name: 'Auto-escalate seller no response',
    ruleType: 'auto_escalate',
    priority: 30,
    conditions: { sellerResponded: false, daysSinceOpen: 3 },
    action: 'escalate',
    actionParams: {},
  },
  {
    name: 'Auto-close on inactivity',
    ruleType: 'auto_close_no_response',
    priority: 100,
    conditions: { daysSinceOpen: 14 },
    action: 'close_seller_favor',
    actionParams: {},
  },
];
```

Use upsert on `name` to make seed idempotent. All rules: `createdByStaffId = 'system'`, `isActive = true`.

### 6.2 Platform settings

Add to `apps/web/src/lib/db/seed/platform-settings.ts`:

```ts
{ key: 'disputes.sla.sellerResponseHours', value: '48', type: 'number' },
{ key: 'disputes.sla.buyerResponseHours', value: '72', type: 'number' },
{ key: 'disputes.sla.platformReviewHours', value: '120', type: 'number' },
{ key: 'disputes.sla.supervisorReviewHours', value: '48', type: 'number' },
{ key: 'disputes.sla.autoEscalateOnNoResponse', value: 'true', type: 'boolean' },
{ key: 'disputes.sla.autoCloseOnDeliveryConfirmed', value: 'true', type: 'boolean' },
{ key: 'disputes.sla.deliveryConfirmationGraceDays', value: '3', type: 'number' },
{ key: 'disputes.sla.autoCloseInactivityDays', value: '14', type: 'number' },
{ key: 'disputes.evidence.maxPerDispute', value: '10', type: 'number' },
{ key: 'disputes.evidence.maxFileSizeBytes', value: '10485760', type: 'number' },
{ key: 'disputes.monitor.tickPattern', value: '*/15 * * * *', type: 'string' },
{ key: 'disputes.escalation.highValueThresholdCents', value: '50000', type: 'number' },
{ key: 'disputes.autoRefund.lowValueThresholdCents', value: '2000', type: 'number' },
{ key: 'disputes.chargebackPrevention.enabled', value: 'false', type: 'boolean' },
{ key: 'disputes.chargebackPrevention.threshold', value: '0.7', type: 'number' },
{ key: 'disputes.buyerAbuse.maxClaimsOverturnedFor90d', value: '3', type: 'number' },
{ key: 'disputes.buyerAbuse.maxClaimsFiled30d', value: '5', type: 'number' },
{ key: 'disputes.buyerAbuse.maxClaimRatePercent', value: '15', type: 'number' },
{ key: 'disputes.ai.sentimentEndpoint', value: '', type: 'string' },
{ key: 'disputes.ai.evidenceEndpoint', value: '', type: 'string' },
```

---

## 7) CASL wiring

### 7.1 Add subjects

Add to `packages/casl/src/subjects.ts`:
```ts
'DisputeRule',
'DisputeEvidence',
```

### 7.2 Staff abilities

Add to `packages/casl/src/staff-abilities.ts`:
```ts
// TRUST_SAFETY role
can('manage', 'DisputeRule');
can('manage', 'Dispute');  // includes override auto-resolution
can('read', 'DisputeEvidence');

// SUPPORT role
can('read', 'DisputeRule');
can('read', 'DisputeEvidence');
```

### 7.3 Platform abilities

Add to `packages/casl/src/platform-abilities.ts` for ADMIN role:
```ts
can('manage', 'DisputeRule');
can('manage', 'DisputeEvidence');
```

### 7.4 Buyer/Seller abilities

Add to `packages/casl/src/buyer-abilities.ts`:
```ts
can('create', 'DisputeEvidence', { disputeId: ownDisputeIds });
can('read', 'DisputeEvidence', { disputeId: ownDisputeIds });
```

Equivalent for seller via `packages/casl/src/seller-abilities.ts` (condition: `{ disputeId: ownDisputeIds }`).

### 7.5 Permission registry

Add to `packages/casl/src/permission-registry-data.ts`:
```ts
{
  subject: 'DisputeRule',
  name: 'Dispute Auto-Resolution Rules',
  description: 'Configurable rules for automated dispute resolution by Trust & Safety staff',
},
{
  subject: 'DisputeEvidence',
  name: 'Dispute Evidence',
  description: 'Evidence submission and viewing for dispute parties and staff',
},
```

---

## 8) BullMQ job registration

### 8.1 SLA monitor

Create `packages/jobs/src/dispute-sla-monitor.ts`:
- Queue: `dispute-sla-monitor`
- DI factory pattern: `createDisputeSlaMonitorWorker(handlers)` where handlers are injected to avoid circular deps
- Registration: `registerDisputeSlaMonitorJob()` reads `disputes.monitor.tickPattern` from platform_settings (default `*/15 * * * *`), adds repeatable job with `tz: 'UTC'`

Monitor tick logic:
1. Find overdue SLAs (deadline < now, not already overdue, not final)
2. Mark as overdue
3. For `seller_response` + no seller response -> auto-escalate if setting enabled
4. For `buyer_response` + no buyer response -> close in seller favor
5. For `platform_review` overdue -> alert ops, bump escalation level
6. Evaluate auto-resolution rules on all open, auto-resolvable disputes
7. Log timeline events for all actions

### 8.2 Auto-resolve tick

Create `packages/jobs/src/dispute-auto-resolve-tick.ts`:
- Runs on same schedule as SLA monitor
- Scans all OPEN auto-resolvable disputes
- Evaluates rules for newly qualifying conditions (e.g., delivery confirmed since last tick)
- This catches disputes where conditions changed between SLA check intervals

### 8.3 Register in cron-jobs.ts

Add to `packages/jobs/src/cron-jobs.ts` inside `registerCronJobs()`:
```ts
import { registerDisputeSlaMonitorJob } from './dispute-sla-monitor';
await registerDisputeSlaMonitorJob();
```

---

## 9) Integration with existing V3 code (UNCHANGED files)

| File | Status | Notes |
|------|--------|-------|
| `disputes.ts` | UNCHANGED | `escalateToDispute()` and `canEscalate()` remain as-is. After dispute creation, V4 hooks create SLA + timeline. |
| `dispute-queries.ts` | UNCHANGED | Manual `resolveDispute()` already calls Decision #92 waterfall. After resolution, V4 hooks create `disputeResolution` + timeline. |
| `dispute-recovery.ts` | UNCHANGED | Called from BOTH manual and auto paths. Idempotent via ledger idempotencyKey. |
| `buyer-protection.ts` | UNCHANGED | Claims create disputes via existing path. Auto-resolution evaluates on next monitor tick. |

### 9.1 Hook integration points

V4 hooks are wired AFTER existing V3 operations, not replacing them:
- After `escalateToDispute()` succeeds: call `createDisputeSla(disputeId, 'seller_response')` + `addTimelineEvent(opened)`
- After `resolveDispute()` succeeds: call `disputeResolution` insert + `addTimelineEvent(resolved)` + `advanceSlaStage(final)`
- After seller responds: call `advanceSlaStage(buyer_response)` + `addTimelineEvent(response)`

---

## 10) Completion criteria

- [ ] 6 new tables created via Drizzle migration (`disputeRule`, `disputeRuleExecution`, `disputeSla`, `disputeEvidence`, `disputeTimeline`, `disputeResolution`)
- [ ] 7 additive columns on existing `dispute` table
- [ ] 5 default auto-resolution rules seeded (delivery close, no tracking refund, low value refund, no response escalate, inactivity close)
- [ ] 20 platform_settings keys seeded
- [ ] Auto-resolution engine evaluates rules with seller protection bias integration
- [ ] Rule execution audit trail in `disputeRuleExecution` with context + conditions snapshots
- [ ] SLA management: create, advance stages, check breaches, all durations from platform_settings
- [ ] Evidence submission with count/size limits, counterparty notification
- [ ] Immutable timeline events for all dispute actions
- [ ] 4-level escalation ladder (auto -> agent -> supervisor -> platform decision)
- [ ] Buyer/seller abuse detection with trust flag integration
- [ ] Chargeback prevention rule type (disabled by default)
- [ ] BullMQ SLA monitor registered with `tz: 'UTC'` cron
- [ ] Decision #92 waterfall called correctly by auto-resolution (unchanged from V3)
- [ ] CASL subjects `DisputeRule` + `DisputeEvidence` wired
- [ ] Server actions for rules CRUD + evidence + escalation + override
- [ ] Admin UI pages: rules management, enhanced queue with SLA indicators, enhanced detail with timeline
- [ ] All tests pass (auto-resolve, SLA, evidence, escalation, fraud detection, rules CRUD, SLA monitor)
- [ ] `npx turbo typecheck` passes
- [ ] `npx turbo test` passes (baseline + new tests)
