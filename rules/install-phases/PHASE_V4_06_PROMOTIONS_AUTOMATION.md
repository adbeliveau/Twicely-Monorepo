# PHASE V4-06: Promotions Automation & Campaigns

**Status:** READY
**Canonical:** `rules/canonicals/13_PROMOTIONS_CAMPAIGNS.md`
**Prereqs:** V3 schema exists (`packages/db/src/schema/promotions.ts`), promotion engine exists (`packages/commerce/src/promotions.ts`)
**Extends:** V3 promotion tables + pure functions

---

## 0) What this phase installs

### Backend (packages)
- `packages/db/src/schema/promotions.ts` -- additive: 4 new tables + 2 enums
- `packages/commerce/src/campaign-lifecycle.ts` -- campaign state machine
- `packages/commerce/src/campaign-budget.ts` -- transactional budget management
- `packages/commerce/src/campaign-analytics.ts` -- read-only analytics queries
- `packages/jobs/src/campaign-scheduler.ts` -- BullMQ repeatable job

### Backend (apps/web)
- `apps/web/src/app/api/platform/promotions/campaigns/route.ts` -- LIST + CREATE
- `apps/web/src/app/api/platform/promotions/campaigns/[id]/route.ts` -- GET + PATCH
- `apps/web/src/app/api/platform/promotions/campaigns/[id]/schedule/route.ts` -- POST
- `apps/web/src/app/api/platform/promotions/campaigns/[id]/budget/route.ts` -- POST
- `apps/web/src/app/api/platform/promotions/campaigns/[id]/analytics/route.ts` -- GET

### Tests
- `packages/commerce/src/__tests__/campaign-lifecycle.test.ts`
- `packages/commerce/src/__tests__/campaign-budget.test.ts`
- `packages/jobs/src/__tests__/campaign-scheduler.test.ts`

### Explicit exclusions
- No seller-created campaigns (sellers create individual promotions only)
- No self-service coupon generation
- No affiliate/referral programs
- No dynamic pricing rules

---

## 1) Schema migration

### 1.1 Add enums to `packages/db/src/schema/enums.ts`

```ts
export const promotionCampaignTypeEnum = pgEnum('promotion_campaign_type', [
  'SALE', 'FLASH_SALE', 'SEASONAL', 'CLEARANCE', 'LOYALTY',
]);
export const promotionCampaignStatusEnum = pgEnum('promotion_campaign_status', [
  'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED',
]);
```

### 1.2 Add 4 tables to `packages/db/src/schema/promotions.ts`

See canonical section 3.2 for full column spec. Summary:

| Table | Columns | FKs | Indexes |
|-------|---------|-----|---------|
| `promotion_campaign` | id, name, description, campaignType, status, startsAt, endsAt, timezone, budgetCents, spentCents, budgetAlertPct, autoDisableOnExhaust, targetingRules, createdByStaffId, timestamps | none | (status, startsAt), (status, endsAt) |
| `campaign_promotion` | id, campaignId, promotionId, priority | campaign cascade, promotion restrict | unique(campaignId, promotionId) |
| `campaign_budget_log` | id, campaignId, action, amountCents, balanceCents, orderId, staffId, reason, createdAt | campaign cascade | (campaignId, createdAt) |
| `scheduled_promo_task` | id, campaignId, taskType, scheduledFor, status, executedAt, errorMessage, createdAt | campaign cascade | (scheduledFor, status), (campaignId) |

All PKs: `text('id').primaryKey().$defaultFn(() => createId())`. All timestamps: `{ withTimezone: true }`.

### 1.3 Export from `packages/db/src/schema/index.ts`

```ts
export { promotionCampaign, campaignPromotion, campaignBudgetLog, scheduledPromoTask } from './promotions';
```

### 1.4 Generate migration

```bash
cd packages/db && pnpm drizzle-kit generate
```

---

## 2) Campaign lifecycle

Create `packages/commerce/src/campaign-lifecycle.ts`.

**Imports:** `@twicely/db`, schema tables, `drizzle-orm` operators, `@twicely/logger`.

**Exports:**
- `type CampaignStatus` -- union of 6 status values
- `updateCampaignStatus(campaignId, newStatus, staffId?, reason?)` -- validates transition against state machine (see canonical section 5.1), updates status, fires side effects
- `scheduleCampaignTasks(campaignId)` -- cancels pending tasks, creates activate + deactivate tasks

**Side effects on transition:**
- ACTIVE: set `isActive = true` on all linked promotions via `campaignPromotion` join
- PAUSED/COMPLETED/CANCELED: set `isActive = false` on all linked promotions
- CANCELED: also cancel all pending `scheduledPromoTask` rows

**State machine:** DRAFT -> SCHEDULED -> ACTIVE -> PAUSED -> ACTIVE (resume), ACTIVE -> COMPLETED, any non-terminal -> CANCELED. COMPLETED and CANCELED are terminal.

---

## 3) Budget management

Create `packages/commerce/src/campaign-budget.ts`.

**Exports:**
- `recordPromotionSpend({ campaignId, promotionId, orderId, buyerId, discountCents })` -- returns `{ allowed, reason? }`. Inside transaction: increment `spentCents` via `sql` template, insert `promotionUsage`, insert `campaignBudgetLog` (action=spend). After transaction: if `spentCents >= budgetCents && autoDisableOnExhaust`, call `updateCampaignStatus(COMPLETED)`.
- `refundPromotionSpend({ orderId, staffId?, reason? })` -- look up `promotionUsage`, find campaign via `campaignPromotion` join, decrement `spentCents`, log refund.
- `adjustCampaignBudget({ campaignId, newBudgetCents, staffId, reason })` -- transaction: update `budgetCents`, insert log. Reason is mandatory.

**Budget alert:** inside spend transaction, check `pct = spentCents/budgetCents * 100`. If `pct >= budgetAlertPct`, insert alert log entry.

---

## 4) BullMQ scheduler

Create `packages/jobs/src/campaign-scheduler.ts`.

- Queue: `campaign-scheduler`
- Uses DI factory pattern (same as V3 `cron-jobs.ts`): `createCampaignSchedulerWorker(handlers)` where `handlers.runScheduledTasks` is injected to avoid circular deps
- Registration: `registerCampaignSchedulerJob()` reads `promotions.scheduler.tickPattern` from platform_settings (default `* * * * *`), adds repeatable job with `tz: 'UTC'`
- Worker tick: query `scheduledPromoTask` WHERE `scheduledFor <= now() AND status = 'pending'`, execute each (activate -> `updateCampaignStatus(ACTIVE)`, deactivate -> `updateCampaignStatus(COMPLETED)`), mark completed/failed

Add to `packages/jobs/src/cron-jobs.ts` `registerCronJobs()`:
```ts
import { registerCampaignSchedulerJob } from './campaign-scheduler';
await registerCampaignSchedulerJob();
```

---

## 5) CASL permissions

Add `'PromotionCampaign'` to `packages/casl/src/subjects.ts`.

| File | Change |
|------|--------|
| `platform-abilities.ts` ADMIN | `can('manage', 'PromotionCampaign')` |
| `staff-abilities.ts` MARKETING | `can('read/create/update', 'PromotionCampaign')` |
| `permission-registry-data.ts` | Add subject entry for `PromotionCampaign` |

---

## 6) Platform settings seed

Add to `apps/web/src/lib/db/seed/platform-settings.ts`:

| Key | Default |
|-----|---------|
| `promotions.maxCombinedDiscountPercent` | 75 |
| `promotions.maxStackedCoupons` | 1 |
| `promotions.seller.maxActiveCoupons` | 10 |
| `promotions.seller.maxDiscountPercent` | 50 |
| `promotions.campaign.maxDurationDays` | 30 |
| `promotions.campaign.budgetAlertDefaultPct` | 80 |
| `promotions.scheduler.tickPattern` | `* * * * *` |

---

## 7) API routes

| Route | Methods | CASL | Notes |
|-------|---------|------|-------|
| `/api/platform/promotions/campaigns` | GET, POST | read/create PromotionCampaign | Filter by ?status= |
| `/api/platform/promotions/campaigns/[id]` | GET, PATCH | read/update PromotionCampaign | PATCH only in DRAFT/PAUSED |
| `/api/platform/promotions/campaigns/[id]/schedule` | POST | update PromotionCampaign | DRAFT -> SCHEDULED |
| `/api/platform/promotions/campaigns/[id]/budget` | POST | manage PromotionCampaign | Reason mandatory |
| `/api/platform/promotions/campaigns/[id]/analytics` | GET | read PromotionCampaign | Usage, daily, top promos |

---

## 8) Tests

| Test file | Key assertions |
|-----------|---------------|
| `campaign-lifecycle.test.ts` | Valid transitions succeed, invalid throw, side effects toggle promotions |
| `campaign-budget.test.ts` | Spend increments, exhaustion auto-completes, refund decrements, adjustment logs |
| `campaign-scheduler.test.ts` | Tick processes pending tasks, skips future, marks failed |

---

## 9) Completion criteria

- [ ] 4 new tables + 2 enums via Drizzle migration
- [ ] Campaign lifecycle state machine with all valid transitions
- [ ] Budget tracking with auto-disable on exhaustion
- [ ] BullMQ scheduler registered with `tz: 'UTC'`
- [ ] CASL subject `PromotionCampaign` wired
- [ ] 7 platform_settings keys seeded
- [ ] API routes for CRUD + schedule + budget + analytics
- [ ] Tests pass for lifecycle, budget, scheduler
- [ ] `npx turbo typecheck` passes
- [ ] `npx turbo test` passes (baseline + new tests)
