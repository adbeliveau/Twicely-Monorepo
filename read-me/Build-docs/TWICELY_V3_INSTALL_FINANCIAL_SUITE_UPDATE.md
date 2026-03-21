# TWICELY V3 — Install Prompts: Financial Suite Update
# Two tracks: D4-UPDATE (seller intelligence layer) + E3-COMPANY (Twicely finances)
# Date: 2026-03-07
# Execute ONE prompt at a time. Wait for Adrian's audit between each.

---

# TRACK 1: D4-UPDATE — Seller Financial Center Intelligence Layer
# D4 is installed. F5 is installed. This adds the intelligence layer on top.
# 5 prompts in sequence.

---

## D4-UPDATE PROMPT 1: Schema Migration

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL_v3_0.md  (§13 Schema Additions)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\[this file]

CONTEXT:
D4 Financial Center is installed. F5 crosslister sale detection is installed.
This migration adds tables and columns required by the intelligence layer.
Do NOT modify any existing logic — schema additions only.

TASK: Create a single Drizzle migration with the following changes.

NEW TABLE: financial_projection
Purpose: Nightly cache for all computed intelligence metrics per seller.
Schema per Financial Center Canonical v3.0 §13. Exact columns:
  id                          text primaryKey cuid2
  seller_profile_id           text notNull unique FK→sellerProfile.id
  projected_revenue_30d       integer nullable
  projected_expenses_30d      integer nullable
  projected_profit_30d        integer nullable
  sell_through_rate_90d       integer nullable  (basis points)
  avg_sale_price_90d          integer nullable
  effective_fee_rate_90d      integer nullable  (basis points)
  avg_days_to_sell_90d        integer nullable
  break_even_revenue          integer nullable
  break_even_orders           integer nullable
  health_score                integer nullable  (0-100)
  health_score_breakdown_json jsonb nullable
  inventory_turns_per_month   integer nullable  (basis points)
  performing_periods_json     jsonb nullable
  data_quality_score          integer notNull default 0
  computed_at                 timestamp withTimezone notNull defaultNow

NEW TABLE: recurring_expense
Purpose: Rules for auto-creating seller expense entries on a schedule.
Schema per Financial Center Canonical v3.0 §13. Exact columns:
  id              text primaryKey cuid2
  user_id         text notNull FK→user.id onDelete cascade
  category        text notNull
  amount_cents    integer notNull
  vendor          text nullable
  description     text nullable
  frequency       text notNull  CHECK IN ('MONTHLY','WEEKLY','ANNUAL')
  start_date      date notNull
  end_date        date nullable
  is_active       boolean notNull default true
  last_created_at date nullable
  created_at      timestamp withTimezone notNull defaultNow
  updated_at      timestamp withTimezone notNull defaultNow

ADD COLUMNS to finance_subscription:
  store_tier_trial_used            boolean notNull default false
  store_tier_trial_started_at      timestamp withTimezone nullable
  store_tier_trial_ends_at         timestamp withTimezone nullable
  receipt_credits_used_this_month  integer notNull default 0
  receipt_credits_period_start     timestamp withTimezone nullable
  tax_saved_cents                  integer notNull default 0
  tax_quarterly_payments_json      jsonb notNull default '{}'

ADD COLUMNS to listing:
  cogs_cents            integer nullable
  sourcing_expense_id   text nullable FK→expense.id

ADD COLUMNS to expense:
  sourcing_trip_group_id  text nullable
  is_auto_logged          boolean notNull default false
  auto_log_event_type     text nullable
  recurring_expense_id    text nullable FK→recurring_expense.id

ADD COLUMN to seller_profile:
  finance_goals  jsonb nullable
  -- shape: { revenueGoalCents: number | null, profitGoalCents: number | null }

INDEXES to add:
  financial_projection: index on seller_profile_id (already unique — no extra needed)
  recurring_expense: index on (user_id, is_active)
  listing: index on cogs_cents WHERE cogs_cents IS NOT NULL
  expense: index on sourcing_trip_group_id WHERE sourcing_trip_group_id IS NOT NULL

RULES:
- All money in cents (integers). No decimals anywhere.
- No existing columns modified or removed.
- Run `npx drizzle-kit generate` then `npx drizzle-kit migrate`
- Run `npx tsc --noEmit` — must compile clean
- Run `npx vitest run` — note baseline test count BEFORE this migration

STOP. List:
1. Migration file path
2. All tables/columns added
3. TypeScript error count (must be 0)
4. Test count before migration (baseline for future prompts)
```

---

## D4-UPDATE PROMPT 2: Platform Settings + Stripe Pricing Update

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL_v3_0.md  (§14 Platform Settings)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md

CONTEXT:
Finance PRO pricing has changed: $11.99/mo annual / $14.99/mo monthly.
New platform settings keys are required for the intelligence layer.
The existing Finance PRO Stripe product needs price IDs updated.

TASK A: Update Finance PRO Stripe prices
Find the existing Finance PRO Stripe product in src/lib/stripe/ or wherever
Stripe products are configured. Update:
  Annual price:  $143.88/year ($11.99/mo × 12) — update the price ID
  Monthly price: $14.99/mo — update the price ID

If Stripe products use platform settings for price IDs, update those settings.
If they are hardcoded, find them, update them, and flag the location in your report.

TASK B: Seed/upsert ALL new platform settings from Financial Center Canonical v3.0 §14.
Find where platform settings are seeded (src/db/seed/ or similar).
Add ALL of the following keys using upsert (do not error if already exists):

  finance.pricing.pro.annualMonthlyCents       1199
  finance.pricing.pro.annualTotalCents         143880
  finance.pricing.pro.monthlyCents             1499
  finance.storeTierTrialMonths                 6
  finance.storeTierTrialRepeatable             false
  finance.receiptScanCredits.pro               50
  finance.receiptScanCredits.overageCents      25
  finance.receiptScanCredits.rollover          false
  finance.receiptScanning.usageKey             "receipt-scanning"
  finance.receiptScanning.provider             "anthropic"
  finance.receiptScanning.model                "claude-sonnet-4-6"
  finance.receiptScanning.maxImageSizeMb       10
  finance.receiptScanning.confidenceAutoAccept 85
  finance.receiptScanning.confidenceConfirmPrompt 60
  finance.receiptScanning.supportedFormats     ["image/jpeg","image/png","image/webp","image/heic"]
  finance.mileageRatePerMile                   0.70
  finance.mileageRateYear                      2026
  finance.inventoryAging.freshDays             30
  finance.inventoryAging.slowingDays           60
  finance.inventoryAging.staleDays             90
  finance.inventoryAging.deadDays              180
  finance.projection.minimumHistoryDays        90
  finance.projection.minimumOrders             10
  finance.projection.dataQualityThreshold      60
  finance.breakeven.minimumHistoryMonths       3
  finance.yoy.minimumMonths                    13
  finance.healthScore.minimumHistoryDays       60
  finance.healthScore.minimumOrders            10
  finance.performingPeriods.minimumHistoryDays 90
  finance.performingPeriods.minimumOrders      20
  finance.capitalEfficiency.minimumSoldWithCogs 10
  finance.capitalEfficiency.minimumHistoryDays 30
  finance.profitByCategory.minimumSoldWithCogs 5
  finance.costTrend.minimumHistoryMonths       3
  finance.costTrend.minimumCategoryAmountCents 5000
  finance.inventoryTurns.healthyLow            150
  finance.inventoryTurns.healthyHigh           250
  finance.costTrend.redAlertPct                50
  finance.costTrend.yellowAlertPct             20
  finance.healthScore.weights.profitMarginTrend    25
  finance.healthScore.weights.expenseRatio         20
  finance.healthScore.weights.sellThroughVelocity  20
  finance.healthScore.weights.inventoryAge         20
  finance.healthScore.weights.revenueGrowth        15
  finance.tax.estimatedRateLow                 25
  finance.tax.estimatedRateHigh                30
  finance.tax.q1DueDate                        "2026-04-15"
  finance.tax.q2DueDate                        "2026-06-16"
  finance.tax.q3DueDate                        "2026-09-15"
  finance.tax.q4DueDate                        "2027-01-15"
  finance.tax.reminderBannerDaysBefore         30
  finance.tax.reminderEmailDaysBefore          [30,7]
  finance.customCategories.maxPerSeller        10
  finance.defaultCurrency                      "USD"

RULES:
- All settings upserted — never error on existing key
- Settings typed correctly: booleans as boolean, integers as integer, arrays as JSON array
- Run `npx tsc --noEmit` — must compile clean
- Run `npx vitest run` — test count must match D4-UPDATE Prompt 1 baseline

STOP. Report:
1. Stripe price IDs updated (or flagged if hardcoded location)
2. Platform settings upserted — count
3. Any settings that already existed and were updated (list old vs new value)
4. TypeScript errors: 0
5. Test count delta vs baseline
```

---

## D4-UPDATE PROMPT 3: BullMQ Intelligence Compute Jobs

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL_v3_0.md  (§6 Intelligence Layer, §15 Background Jobs)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCE_ENGINE_CANONICAL.md
- src/lib/jobs/ or src/workers/ — find existing BullMQ job patterns

CONTEXT:
The intelligence layer requires nightly computation stored in financial_projection.
This prompt builds the compute job and supporting service layer.
No UI yet — that is Prompt 4.

TASK A: Create `src/lib/finance/intelligence/compute.ts`
This module exports one function: `computeSellerProjection(sellerProfileId: string)`
It reads from the database and writes one row to financial_projection.

Computations required (all formulas in Financial Center Canonical v3.0 §6):

1. SELL-THROUGH RATE (90d):
   orders_last_90d / avg_active_listings_last_90d → stored as basis points

2. AVG SALE PRICE (90d):
   gross_revenue_90d / order_count_90d → cents

3. EFFECTIVE FEE RATE (90d):
   total_fees_90d / gross_revenue_90d → basis points

4. AVG DAYS TO SELL (90d):
   avg(soldAt - activatedAt) for sold listings in last 90 days → integer days

5. CASH FLOW PROJECTION (30d):
   projectedRevenue = sellThroughRate × activeListings × avgSalePrice × (30/90)
   projectedExpenses = avg_monthly_expenses_last_3mo
   projectedProfit = projectedRevenue × (1 - effectiveFeeRate) - projectedExpenses

6. BREAK-EVEN:
   fixedExpenses = sum of recurring_expense amounts + auto-logged subscriptions (monthly)
   grossMarginPct = (grossRevenue - COGS) / grossRevenue (last 90d, nulls excluded)
   breakEvenRevenue = fixedExpenses / grossMarginPct
   breakEvenOrders = breakEvenRevenue / avgSalePrice
   Only computed if ≥3 months expense history. Null otherwise.

7. HEALTH SCORE (0-100):
   Five components weighted per platform settings:
   a. profitMarginTrend (25%): net margin slope over 90 days. Positive trend = 100, flat = 50, declining = 0.
   b. expenseRatio (20%): operating expenses / gross revenue. <15% = 100, 15-30% = linear, >50% = 0.
   c. sellThroughVelocity (20%): current sell-through vs 60-day trailing avg. Above avg = >50.
   d. inventoryAge (20%): % of inventory in Fresh+Slowing buckets. 100% = 100, 0% = 0.
   e. revenueGrowth (15%): MoM revenue change trailing 3 months. >10% = 100, 0% = 50, negative = 0.
   Final score = Σ(componentScore × weight / 100). Round to integer.
   Store component breakdown in health_score_breakdown_json:
   { profitMarginTrend: N, expenseRatio: N, sellThroughVelocity: N, inventoryAge: N, revenueGrowth: N }

8. INVENTORY TURNS PER MONTH (basis points):
   cogsSold_30d / avgInventoryAtCost × 10000
   Only if ≥10 sold items with COGS AND ≥30 days history. Null otherwise.

9. PERFORMING PERIODS (JSON):
   dayOfWeek: for each DOW (0=Sun..6=Sat), avg days to sell for items listed on that day
   relativeSpeed per DOW: (overallAvg - dowAvg) / overallAvg × 100 (positive = faster)
   monthlyRevenue: revenue by calendar month for trailing 12 months
   monthlyMultiplier: each month / trailing avg monthly revenue
   Only if ≥90 days AND ≥20 completed orders. Null otherwise.
   Shape: { dayOfWeek: [{dow:0,avgDays:N,relativeSpeed:N},...], monthly: [{month:1,revenue:N,multiplier:N},...] }

10. DATA QUALITY SCORE (0-100):
    Start at 0. Add:
    +20 if ≥10 completed orders
    +20 if ≥30 days account history
    +20 if ≥50% of sold items have COGS
    +20 if ≥3 months expense history
    +20 if ≥90 days AND ≥20 orders (performing periods gate)

RULES for compute.ts:
  - All values in integers/basis points — no floating point stored
  - If a computation's data gate is not met, store null for that field
  - Function must be idempotent: upsert on seller_profile_id
  - No side effects — pure read + write to financial_projection
  - Max file size: 300 lines. Split into helpers if needed.
  - All helper functions fully typed, no `any`

TASK B: Create `src/lib/finance/intelligence/compute.test.ts`
Unit tests for every computation in compute.ts.
Test each formula with known inputs and expected outputs.
Test data gate failures (null outputs when gates not met).
Minimum 15 test cases. Must all pass.

TASK C: Register BullMQ jobs
Find existing job registration (src/lib/jobs/ or src/workers/).
Add the following jobs per Financial Center Canonical v3.0 §15:

  finance:projection:compute
    Schedule: nightly 3:00 AM UTC (cron: '0 3 * * *')
    Logic: fetch all seller_profile IDs with financeTier = 'PRO'
           for each: call computeSellerProjection(sellerProfileId)
           batch size: 50 at a time, 100ms delay between batches
           log success/failure counts

  finance:recurring:create
    Schedule: daily 6:00 AM UTC (cron: '0 6 * * *')
    Logic: fetch all active recurring_expense records where:
           next_due_date <= today (compute from last_created_at + frequency)
           create expense entry for each due record
           update last_created_at = today

  finance:trial:check
    Schedule: daily 8:00 AM UTC (cron: '0 8 * * *')
    Logic: find finance subscriptions where:
           store_tier_trial_ends_at BETWEEN now AND now+30days
           AND warning email not yet sent → send 30-day warning email
           find finance subscriptions where store_tier_trial_ends_at <= now
           AND financeTier = 'PRO' AND store_tier_trial_used = true
           → downgrade to FREE (update financeTier, do NOT delete data)

  finance:tax:reminder
    Schedule: daily 8:00 AM UTC (cron: '0 8 * * *')
    Logic: check each quarterly due date from platform settings
           if today = dueDate - 30 days: send 30-day warning email to PRO sellers
           if today = dueDate - 7 days: send 7-day warning email to PRO sellers

RULES for jobs:
  - Each job handler max 150 lines — extract compute logic to compute.ts
  - Proper BullMQ error handling — failed jobs retry ×3 with exponential backoff
  - Log job start, completion, and error counts (not individual seller IDs)
  - Run `npx tsc --noEmit` — must compile clean

STOP. Report:
1. compute.ts — line count, functions exported
2. Test results — pass/fail count (must be all passing)
3. Jobs registered — list with schedules
4. TypeScript errors: 0
5. Test count delta vs baseline
```

---

## D4-UPDATE PROMPT 4: Intelligence Layer UI — PRO Dashboard

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL_v3_0.md  (§6 full, §7 PRO layout)
- src/app/(dashboard)/my/finances/page.tsx  — existing D4 dashboard (READ this file first)
- src/app/(dashboard)/my/finances/  — scan all existing files before touching anything

CONTEXT:
D4 Financial Center is installed. financial_projection table now exists with data.
This prompt adds the 10 intelligence feature cards to the PRO dashboard.
Do NOT modify the bookkeeping features (expenses, mileage, COGS, reports) — they work.
Only add the intelligence cards and update the dashboard layout per §7.

TASK A: Create intelligence card components
Each card is a separate component file. Max 300 lines each.
Location: src/components/finance/intelligence/

Components to create:
  GoalTrackerCard.tsx         — §6.1. Reads financeGoals from sellerProfile.
  RevenueVelocityCard.tsx     — §6.2. FREE shows simple, PRO shows full with goal pace.
  BusinessHealthCard.tsx      — §6.3. FREE shows score only, PRO shows full breakdown.
  ProfitByCategoryCard.tsx    — §6.4. Data gate: ≥5 sold items with COGS per category.
  TaxWithholdingCard.tsx      — §6.5. Hardcoded disclaimer, no platform settings control.
  QuarterlyTaxCard.tsx        — §6.6. Due dates from platform settings. Hardcoded disclaimer.
  CostTrendCard.tsx           — §6.7. Data gate: ≥3 months expense history.
  DeadStockCard.tsx           — §6.8. Data gate: ≥1 item in Stale/Dead bucket.
  CapitalEfficiencyCard.tsx   — §6.9. Data gate: ≥10 sold with COGS AND ≥30 days.
  BestPeriodsCard.tsx         — §6.10. Data gate: ≥90 days AND ≥20 orders. HIDDEN if not met.

CARD RULES (apply to every card):
  - Below data gate: card is NOT rendered at all. No skeleton, no "not enough data" state.
    Exception: GoalTrackerCard (no gate), RevenueVelocityCard (shows "not enough orders" inline),
    TaxWithholdingCard (shows from first order), QuarterlyTaxCard (shows from first order).
  - All monetary values in cents internally, formatted as currency on display.
  - No floating point arithmetic. All rates in basis points, convert only at render.
  - TypeScript strict — no `any`, all props typed.

TASK B: Create API routes for intelligence data
Location: src/app/api/finance/intelligence/

  GET /api/finance/intelligence/projection
    Returns: financialProjection row for current seller
    Auth: authorize() — seller only, own data
    Returns 404 if no projection yet (nightly job hasn't run)

  GET /api/finance/intelligence/profit-by-category?period=90d
    Returns: category breakdown computed at query time
    Periods: 30d | 90d | 12mo
    Auth: authorize() — seller only, own data, PRO required

  GET /api/finance/intelligence/cost-trends?period=6mo
    Returns: expense category ratios over time
    Periods: 3mo | 6mo | 12mo
    Auth: authorize() — seller only, own data, PRO required

  POST /api/finance/intelligence/goals
    Body: { revenueGoalCents: number | null, profitGoalCents: number | null }
    Saves to sellerProfile.financeGoals
    Auth: authorize() — seller only, own data, PRO required

  POST /api/finance/intelligence/tax-saved
    Body: { amountCents: number }
    Saves to financeSubscription.taxSavedCents
    Auth: authorize() — seller only, own data, PRO required

  POST /api/finance/intelligence/tax-quarterly-mark-paid
    Body: { year: number, quarter: number, paid: boolean }
    Updates financeSubscription.taxQuarterlyPaymentsJson
    Auth: authorize() — seller only, own data, PRO required

TASK C: Update the PRO dashboard page
File: src/app/(dashboard)/my/finances/page.tsx (or wherever dashboard renders)

Add the intelligence cards in the order specified in Financial Center Canonical v3.0 §7:
  Row: GoalTrackerCard (if goals set)
  Row: RevenueVelocityCard (always, PRO version)
  Row 1: 3 primary KPI cards (already exist — do not modify)
  Row 2: 4 financial flow KPI cards (already exist — do not modify)
  Row 3: 4 velocity/inventory KPI cards (already exist — do not modify)
  Row 4: Payout status (already exists — do not modify)
  Row 5: BusinessHealthCard + BreakEvenCard (break-even already exists)
  Row 6: Revenue chart (already exists)
  Row 7: CashFlowProjectionCard (already exists) + DeadStockCard
  Row 8: CapitalEfficiencyCard + ProfitByCategoryCard
  Row 9: Expense breakdown (already exists)
  Row 10: TaxWithholdingCard + QuarterlyTaxCard
  Row 11: BestPeriodsCard + CostTrendCard (both hidden if data gate not met)
  Row 12: Sourcing ROI (if exists)

Do NOT remove any existing cards. Only add.

TASK D: Update the FREE dashboard
File: same dashboard, FREE path

Add to FREE dashboard:
  1. RevenueVelocityCard (FREE version — simple one-liner above KPI cards)
  2. BusinessHealthCard (FREE version — score + label + upgrade prompt)
  3. Seasonal tax reminder banner: only render if today is within
     platform_settings.finance.tax.reminderBannerDaysBefore days
     of any quarterly due date. Hidden all other times.

TASK E: Update listing create and edit forms
Add optional "Your cost (optional)" field:
  - Label: "What did you pay for this?"
  - Helper text: "Used for profit tracking — never shown to buyers"
  - Maps to: listing.cogs_cents
  - Available to ALL sellers regardless of Finance tier
  - No gate. No requirement.
  Find: src/app/(dashboard)/my/selling/listings/new/page.tsx (and edit equivalent)
  Add the field. Hook it to the API route that creates/updates listings.

RULES:
  - authorize() from @/lib/casl — never raw auth.api.getSession()
  - PRO gate on intelligence cards: check financeTier === 'PRO' server-side
    before returning data from API routes. Return 403 if FREE.
  - Tax disclaimer text in TaxWithholdingCard and QuarterlyTaxCard is hardcoded
    string constant — do NOT pull from platform settings or database.
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — test count must increase from baseline

STOP. Report:
1. New component files — list with line counts
2. New API routes — list with auth gates
3. Dashboard rows added — confirm order matches §7
4. Listing form: confirm cogs_cents field added to create AND edit
5. TypeScript errors: 0
6. Test count delta vs baseline (must be positive)
7. Wiring audit: grep for each component in the dashboard file
   — confirm every card is actually imported and rendered
```

---

## D4-UPDATE PROMPT 5: Cross-Platform Features Unlock (F5 is Live)

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL_v3_0.md  (§4 auto-populated data, §12 routes)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md  (§12 sale detection)
- src/app/(dashboard)/my/finances/  — scan all existing finance routes

CONTEXT:
F5 crosslister sale detection is installed. Prior to this prompt, cross-platform
revenue features were gated behind F5.1 and hidden. They are now unlocked.
The dashboard revenue chart was Twicely-only. Platform breakdown was hidden.

TASK A: Enable multi-platform revenue chart
Find the revenue chart component on the PRO dashboard.
Remove the "pre-F5.1 single series" flag/condition.
Update to show stacked series per platform:
  Twicely | eBay | Poshmark | Mercari | Depop | Local
Data source: crosslister.sale_detected events + order.completed events
Group by platform and date. Chart library already in place — just add series.

TASK B: Create /my/finances/platforms route
New file: src/app/(dashboard)/my/finances/platforms/page.tsx

Page: "Your Fee Rates by Platform"
Gate: PRO only
Data: Revenue and platform fees per connected crosslister platform

Display table:
  Columns: Platform | Revenue | Fees Paid | Fee Rate
  Fee rate = fees paid / revenue × 100
  Only show platforms with at least 1 detected sale
  Footer note: "Actual fees paid from your connected platform sales.
                Lower rate = more of each sale stays with you."

NO savings comparison. NO "you saved X vs eBay". NO hypothetical rate.
Only show a platform if the seller has ACTUAL detected sales on that platform.
If only Twicely has data: show only Twicely, add note
"Connect your crosslister accounts to see fee rates across all your platforms."

API route: GET /api/finance/platforms
  Returns: platform breakdown for current seller
  Auth: authorize() — seller only, own data, PRO required
  Data source: ledger entries + crosslister sale events grouped by channel

TASK C: Add platforms route to Finance nav
Find the Finance section navigation (sidebar or tab bar).
Add "Platforms" link → /my/finances/platforms
PRO gate: show link, but clicking while FREE shows upgrade prompt.

TASK D: Remove pre-F5.1 hidden flags
Search the codebase for any comments or conditions referencing "pre-F5.1",
"F5.1 gate", "hidden until F5", or similar.
Remove those conditions. The features are live.
List every instance found and removed.

RULES:
  - authorize() from @/lib/casl everywhere
  - Platform fee table: NEVER show a "savings vs eBay" calculation or claim
  - Only real transaction data — no estimated or hypothetical rates
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — test count must increase from baseline

STOP. Report:
1. Revenue chart: confirm multi-series now active, list platforms in legend
2. /my/finances/platforms: confirm route exists and renders
3. F5.1 flags removed: list every file and line
4. Nav: confirm Platforms link added
5. TypeScript errors: 0
6. Test count delta vs baseline (must be positive)
```

---

# TRACK 2: E3-COMPANY — Twicely Company Finances
# New system. No existing code. Builds at hub.twicely.co/company/*
# 6 prompts in sequence.

---

## E3-COMPANY PROMPT 1: Schema — All Company Tables

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md  (§19 Schema)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_ACTORS_SECURITY_CANONICAL.md  (§4 staff roles)

CONTEXT:
Building the Twicely Company Finances system at hub.twicely.co/company/*.
This is System 3 — Twicely's own internal bookkeeping. Completely separate from:
  - Seller Financial Center (/my/finances)
  - Platform integrity (/fin/*)
This prompt creates all schema. No application logic yet.

TASK A: Create Drizzle schema file
Location: src/db/schema/company-finances.ts

Create all tables from Company Finances Canonical v1.0 §19. Exact tables:

1. company_expense
2. company_recurring_expense
3. company_vendor
4. company_vendor_invoice
5. company_contractor
6. company_contractor_payment
7. company_budget
8. company_budget_line
9. company_bank_account
10. company_bank_transaction
11. company_tax_estimate
12. company_forecast

All column names, types, constraints, and defaults exactly as specified in §19.
All money in cents (integer). All timestamps withTimezone.
All IDs are cuid2 via $defaultFn(() => createId()).

Sensitive fields requiring encryption notation (comment only — encryption at app layer):
  company_vendor.ein_encrypted
  company_contractor.ein_encrypted (may be SSN)
  company_bank_account.plaid_access_token_encrypted

TASK B: Add new staff roles to existing staff role enum/constants
Find where platform staff roles are defined (SUPPORT | ADMIN | SUPER_ADMIN etc.)
Add two new roles:
  COMPANY_FINANCE         — full read + write on /company/* routes
  COMPANY_FINANCE_READONLY — read-only on /company/* routes

Update the CASL ability factory to grant:
  COMPANY_FINANCE: can('manage', 'CompanyFinance')
  COMPANY_FINANCE_READONLY: can('read', 'CompanyFinance')
  SUPER_ADMIN: can('manage', 'CompanyFinance')  (already has this via wildcard — confirm)
  All other roles: nothing (403)

TASK C: Add company finance platform settings
Upsert all settings from Company Finances Canonical v1.0 §21:
  company.finance.runwayAlertMonths                12
  company.finance.budgetAlertPctYellow             110
  company.finance.budgetAlertPctRed                125
  company.finance.taxEstimateMethod                "safe_harbor"
  company.finance.estimatedTaxRate                 21
  company.finance.plaidUsageKey                    "company-banking"
  company.finance.bankSyncIntervalMinutes          15
  company.finance.bankCategorizationConfidenceAuto 85
  company.finance.bankCategorizationConfidenceConfirm 60
  company.finance.contractor1099ThresholdCents     60000
  company.finance.contractor1099AlertDayOfYear     335
  company.finance.fiscalYearStartMonth             1
  company.finance.recordRetentionYears             7

TASK D: Generate and run migration
  npx drizzle-kit generate
  npx drizzle-kit migrate
  npx tsc --noEmit

RULES:
  - company_* tables completely isolated from seller/user tables
  - No FK from company tables into user/seller tables (these are Twicely's own records)
  - Exception: created_by_staff_id columns may reference staff user IDs — use text, no FK constraint
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — note new baseline test count

STOP. Report:
1. Schema file created at exact path
2. Tables created — list with column counts
3. New staff roles added — confirm CASL rules
4. Platform settings added — count
5. TypeScript errors: 0
6. Test baseline
```

---

## E3-COMPANY PROMPT 2: Revenue Service + Auto-Population

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md  (§3 Revenue, §4 Cost of Revenue, §5 Chart of Accounts)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCE_ENGINE_CANONICAL.md  (ledger entry types)
- src/db/schema/  — find ledger_entry table

CONTEXT:
Twicely's revenue is already flowing through the Finance Engine ledger.
This service reads that ledger and maps entries to company revenue/CoR lines.
Zero manual entry required for revenue.

TASK A: Create revenue mapping service
Location: src/lib/company-finances/revenue.ts

Export function: getCompanyRevenue(periodStart: Date, periodEnd: Date)
Returns: CompanyRevenueBreakdown type

Mapping from ledger entry types to account codes (per §3 and §5):
  ORDER_TF_FEE                    → 4000  Transaction Fees
  ORDER_BOOST_FEE                 → 4100  Boost Fees
  INSERTION_FEE                   → 4200  Insertion Fees
  INSTANT_PAYOUT_FEE              → 4300  Instant Payout Fees
  STORE_SUBSCRIPTION_CHARGE       → 5000  Subscription Revenue — Store
  LISTER_SUBSCRIPTION_CHARGE      → 5100  Subscription Revenue — XLister
  FINANCE_SUBSCRIPTION_CHARGE     → 5200  Subscription Revenue — Finance (if exists)
  AUTOMATION_ADDON_CHARGE         → 5300  Subscription Revenue — Automation
  BUNDLE_SUBSCRIPTION_CHARGE      → 5400  Subscription Revenue — Bundles
  OVERAGE_PACK_PURCHASE           → 5500  Overage Revenue

Revenue adjustments (negative):
  REFUND_TF_REVERSAL              → 4000  (reduces TF revenue)
  REFUND_BOOST_REVERSAL           → 4100  (reduces boost revenue)
  SUBSCRIPTION_REFUND             → appropriate subscription account
  CHARGEBACK_DEBIT                → reduces net revenue
  CHARGEBACK_REVERSAL             → restores revenue

Cost of Revenue mapping (§4):
  ORDER_STRIPE_PROCESSING_FEE     → 6000  Stripe Processing
  BUYER_PROTECTION_LABEL_COST     → 6100  Absorbed Return Shipping (if entry type exists)
  MANUAL_CREDIT (platform-init)   → 6300  Goodwill Credits
  AFFILIATE_COMMISSION_PAYOUT     → 6400  Affiliate Commissions

For entry types not yet in ledger (INSTANT_PAYOUT_FEE, FINANCE_SUBSCRIPTION_CHARGE):
  Skip gracefully if entry type doesn't exist — log as warning, return 0 for that line.
  Do NOT throw. Revenue system must be resilient to missing entry types.

Return type:
  {
    marketplaceRevenue: { [accountCode: string]: number },  // cents
    saasRevenue: { [accountCode: string]: number },         // cents
    revenueAdjustments: { [accountCode: string]: number },  // cents (negative)
    costOfRevenue: { [accountCode: string]: number },       // cents (negative)
    grossRevenue: number,
    netRevenue: number,
    grossProfit: number,
    periodStart: Date,
    periodEnd: Date,
  }

TASK B: Create hourly BullMQ sync job
Job name: company:revenue:sync
Schedule: hourly (cron: '0 * * * *')
Logic:
  1. Find ledger entries created since last sync (store lastSyncAt in platform settings)
  2. Map to account codes per Task A
  3. Upsert company_expense entries for CoR items with isAutoLogged = true
  4. Update lastSyncAt
  No direct DB cache of revenue totals — revenue is always computed from ledger at query time.
  Only CoR items get written to company_expense (they need to appear in expense lists).

TASK C: Unit tests
Location: src/lib/company-finances/revenue.test.ts
Test the mapping function with mock ledger entries.
Minimum 10 test cases covering:
  - Each revenue line type
  - Adjustment/reversal handling
  - Missing entry type graceful skip
  - Period filtering
  All must pass.

RULES:
  - All amounts in cents — no floating point
  - Ledger is read-only — never write to ledger_entry from this service
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — test count must increase

STOP. Report:
1. revenue.ts — functions exported, line count
2. Entry types mapped — count
3. Entry types skipped (not yet in enum) — list
4. BullMQ job registered — schedule
5. Test results — pass/fail (must be all passing)
6. Test count delta
```

---

## E3-COMPANY PROMPT 3: Executive Dashboard + Full P&L

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md  (§7 Executive Dashboard, §9 Full P&L, §8 Routes)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_ACTORS_SECURITY_CANONICAL.md  (COMPANY_FINANCE role)
- src/app/(hub)/  — find hub layout and nav patterns

CONTEXT:
Hub is installed. Building new /company section inside hub.
Gate: COMPANY_FINANCE or SUPER_ADMIN only. All other roles → 403.

TASK A: Create hub /company layout
Location: src/app/(hub)/company/layout.tsx

  - Sidebar nav with links to all /company/* routes (§8 routes table)
  - Access gate: authorize() — checks COMPANY_FINANCE or SUPER_ADMIN
  - If unauthorized: redirect to /d (hub dashboard) with "Access denied" toast
  - "Twicely Company Finances" header — visually distinct from seller-facing Finance Center

TASK B: Create executive dashboard
Location: src/app/(hub)/company/page.tsx

Sections per §7 wireframe:
  1. CASH & RUNWAY — 3 cards: Cash in Bank, Monthly Burn, Runway
     Cash: from Plaid balance (company_bank_account.balance_cents) if connected,
           else show "Connect bank account →" with link to /company/bank
     Burn: trailing 3-month avg net cash outflow from company_bank_transaction
     Runway: cashBalance / monthlyBurn. Color: green >18mo, yellow 12-18mo, red <12mo

  2. REVENUE — 6 cards: MRR, Net Revenue, MoM MRR Growth, GMV, Gross Take Rate, Net Take Rate
     All from revenue service (Prompt 2). GMV from ledger ORDER_PAYMENT_CAPTURED sum.
     MRR: from active finance_subscription + store/lister subscriptions (normalize to monthly)
     Gross Take Rate: TF collected / GMV
     Net Take Rate: Net Revenue / GMV

  3. P&L SNAPSHOT — inline bar visualization
     Gross Revenue | CoR → Gross Profit (margin%) | OpEx → Net Income (margin%, profitable indicator)
     Data from revenue service + company_expense for current period

  4. SAAS HEALTH — 4 cards: NRR, Churn Rate, Rule of 40, Trial Conversion
     NRR: (StartMRR + Expansion - Contraction - Churn) / StartMRR × 100
     Churn Rate: churned subscribers / starting active subscribers × 100
     Rule of 40: MoM revenue growth % + net margin %
     Trial Conversion: trials converted / trials started (same cohort, last 90d)

  5. UNIT ECONOMICS — 4 cards: Revenue/Order, Cost/Order, Revenue/Seller, Gross Margin/Order
     Revenue/Order: Net Revenue / completed order count
     Cost/Order: Cost of Revenue / completed order count
     Revenue/Seller: Net Revenue / active seller count (sellers with ≥1 order in period)

  6. BUDGET STATUS — progress bars per category
     Compare company_budget_line amounts vs actual company_expense totals
     Color thresholds from platform settings (110% yellow, 125% red)
     "View Full Budget →" link

  7. ACTION ITEMS — dynamic list
     Marketing budget exceeded (if any category >110%)
     Quarterly tax due in X days (if within 30 days of due date)
     Invoices awaiting payment (count + total)
     Bank reconciliation status

TASK C: Create full P&L page
Location: src/app/(hub)/company/pl/page.tsx

  Period selector: This Month / Last Month / This Quarter / Last Quarter / YTD / Last Year / Custom
  YoY toggle: shows "vs same period last year" column when enabled
  Export buttons: PDF + CSV

  P&L structure exactly per §9 wireframe:
  Revenue → Adjustments → Net Revenue → CoR → Gross Profit → OpEx by category → Net Income

  Data sources:
  Revenue + adjustments: revenue service
  CoR: company_expense WHERE account_code BETWEEN '6000' AND '6999' for period
  OpEx: company_expense WHERE account_code BETWEEN '7000' AND '7999' for period
  Label auto-logged items with ← auto, recurring with ← recurring, manual with ← manual

  Footer: Cash balance | Burn rate | Runway (same as dashboard cards)

TASK D: API routes
  GET /api/hub/company/revenue?periodStart=&periodEnd=
    Returns: CompanyRevenueBreakdown from revenue service
    Auth: COMPANY_FINANCE or SUPER_ADMIN

  GET /api/hub/company/pl?periodStart=&periodEnd=&compareYear=boolean
    Returns: full P&L with optional YoY comparison column
    Auth: COMPANY_FINANCE or SUPER_ADMIN

  GET /api/hub/company/saas-metrics?period=
    Returns: MRR, ARR, NRR, churn, trial conversion, Rule of 40
    Auth: COMPANY_FINANCE or SUPER_ADMIN

RULES:
  - authorize() from @/lib/casl on every API route
  - Every route: 403 if not COMPANY_FINANCE or SUPER_ADMIN
  - All amounts in cents — format only at render layer
  - Cash/runway card: if no bank connected, show connect prompt — never show $0
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — test count must increase

STOP. Report:
1. Routes created — list
2. Dashboard sections rendered — confirm all 7 sections
3. P&L: confirm period selector, YoY toggle, export buttons present
4. Auth: confirm 403 for non-COMPANY_FINANCE roles (grep for authorize())
5. TypeScript errors: 0
6. Test count delta
```

---

## E3-COMPANY PROMPT 4: Expenses, Vendors, Contractors

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md  (§6 Expense Management, §13 Vendor Management, §14 Contractor Tracking)
- src/app/(hub)/company/  — existing company files

TASK A: Expense management pages
  src/app/(hub)/company/expenses/page.tsx
    Table: date | category | vendor | amount | auto/manual badge | receipt icon | actions
    Filters: date range, account code, category, auto vs manual
    Search: vendor name, description
    "Add Expense" button → inline form or modal
    Bulk CSV import button → /company/expenses/import

  src/app/(hub)/company/expenses/import/page.tsx
    CSV upload: columns date, account_code, vendor, description, amount_cents, receipt_url
    Validation: unknown account codes flagged, amounts must be integers
    Preview first 10 rows + error summary before commit

  Recurring expense management (tab or subsection on expenses page):
    List of active recurring rules: vendor, amount, frequency, next due date, status
    Add/edit/archive recurring rules
    Cannot delete if generated entries exist — archive only

TASK B: Vendor + invoice pages
  src/app/(hub)/company/vendors/page.tsx
    Vendor list with: name, category, payment terms, active status, total YTD paid
    "New Vendor" form
    Per vendor: edit, view invoices, view payment history

  AP Aging section on vendors page:
    Aging buckets: Current | 1-30 days | 31-60 days | 60+ days
    Per bucket: list of vendors with outstanding invoice amounts
    Status badges: PENDING | APPROVED | OVERDUE (auto from due date)

  Invoice create/edit modal (opens from vendor detail):
    Fields: vendor, invoice number, amount, issue date, due date, attachment upload, description
    "Mark Paid" action → sets paid_at, links to expense entry

TASK C: Contractor + 1099 pages
  src/app/(hub)/company/contractors/page.tsx
    Contractor list: name, service type, status, YTD payments, W-9 status
    "New Contractor" form
    YTD ≥ $600 flagged with "1099 Required" badge

  Per contractor: payment log with add payment button

  1099 Summary tab:
    Table: contractor name | EIN (masked) | YTD payments | 1099 required
    Export button → CSV formatted for CPA
    Only contractors with W-9 on file shown in export

TASK D: API routes
  Standard CRUD routes for:
    /api/hub/company/expenses          GET (list, filter) | POST (create)
    /api/hub/company/expenses/[id]     PUT | DELETE (manual only)
    /api/hub/company/expenses/import   POST (CSV)
    /api/hub/company/recurring         GET | POST | PUT | DELETE
    /api/hub/company/vendors           GET | POST
    /api/hub/company/vendors/[id]      GET | PUT
    /api/hub/company/invoices          GET | POST
    /api/hub/company/invoices/[id]     PUT (mark paid, approve)
    /api/hub/company/contractors       GET | POST
    /api/hub/company/contractors/[id]  GET | PUT
    /api/hub/company/payments          GET | POST

  All routes: authorize() — COMPANY_FINANCE or SUPER_ADMIN

  2FA gate: POST /api/hub/company/expenses where amount_cents > 1_000_000
    Require 2FA verification token in request header
    Return 403 with { requiresTwoFactor: true } if not provided

RULES:
  - Auto-logged expenses: is_auto_logged = true, cannot be edited or deleted via UI
  - EIN/SSN fields: stored encrypted — never return raw value in API response.
    Return masked version: "XX-XXXXX34" last 2 digits only
  - authorize() on every route — no exceptions
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — test count must increase

STOP. Report:
1. Pages created — list
2. API routes — list with auth gates
3. 2FA gate: confirm amount threshold wired correctly
4. EIN masking: confirm raw EIN never returned in any API response
5. Auto-logged delete guard: confirm is_auto_logged rows rejected on delete
6. TypeScript errors: 0
7. Test count delta
```

---

## E3-COMPANY PROMPT 5: Budget, Forecast, Tax Center

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md  (§11 Budget vs Actuals, §12 Forecast & Runway, §15 Tax Center)
- src/app/(hub)/company/  — existing company files

TASK A: Budget vs Actuals page
  src/app/(hub)/company/budget/page.tsx

  Annual budget creation:
    "New Budget" form: fiscal year, label ("Original", "Reforecast Q2", etc.)
    Per account code: annual amount + optional monthly breakdown
    Default monthly split: equal (annual / 12). Toggle to custom monthly amounts.
    Version history: list of prior budgets for same year, read-only
    Active budget clearly marked

  Budget vs Actuals table per §11.2 wireframe:
    Columns: Account | Budget (monthly) | Actual (YTD or monthly) | Variance | % Used | Status
    Color thresholds from platform settings:
      >110%: yellow ⚠️
      >125%: red 🔴
      ≤110%: green ✅
    Revenue vs target section at bottom

  Full-year pace section:
    "At your current run rate, you'll end the year with: Revenue $X | OpEx $X | Net Income $X"
    Formula: (YTD amount / months elapsed) × 12

TASK B: Forecast & Runway page
  src/app/(hub)/company/forecast/page.tsx

  Three scenario display (Bear | Base | Bull):
    Each scenario: projected revenue | expenses | net income | runway | profitability date
    Scenario assumptions editable: GMV growth rate | churn rate | hiring count

  Runway dashboard per §12.4 wireframe:
    Current cash (from Plaid or manual)
    Trailing 3-month burn (from bank transactions)
    Runway at current burn
    Scenario runway bars: color-coded
    Fundraising trigger alert if any scenario < runwayAlertMonths threshold

  BullMQ job: company:forecast:compute
    Schedule: nightly 2:00 AM UTC
    Rebuilds company_forecast rows for all 3 scenarios
    Uses trailing GMV growth + MRR growth + recurring expense total

TASK C: Tax Center page
  src/app/(hub)/company/tax/page.tsx

  Quarterly estimates table per §15.1:
    Q1 | Q2 | Q3 | Q4 with due dates from platform settings
    Estimated amount | Paid amount | Status | Days until due
    "Mark Paid" toggle per quarter
    30-day and 7-day reminder emails via existing trial:check job pattern

  Annual tax summary section:
    Full year: revenue, expenses, net income, contractor payments
    "Export for CPA" button → PDF + CSV

  Sales tax nexus tracker per §15.3:
    Manual entry table: state | threshold | current GMV YTD | status
    Threshold levels: approaching (80-99%) | established (100%+)
    Note: "Consult legal counsel regarding marketplace facilitator obligations"
    This is informational tracking only — no automated compliance

  BullMQ jobs:
    company:tax:reminder — daily, mirrors finance:tax:reminder pattern
    company:1099:alert — December 1, flags contractors ≥ $600 YTD

TASK D: API routes
  /api/hub/company/budget          GET | POST
  /api/hub/company/budget/[id]     GET | PUT (version a new budget)
  /api/hub/company/budget/actuals  GET (variance data)
  /api/hub/company/forecast        GET (all 3 scenarios)
  /api/hub/company/forecast/assumptions  PUT (update scenario assumptions)
  /api/hub/company/tax/estimates   GET | PUT (mark paid)
  /api/hub/company/tax/nexus       GET | POST | PUT | DELETE (nexus tracker rows)

  All: authorize() — COMPANY_FINANCE or SUPER_ADMIN
  Budget changes: require 2FA verification

RULES:
  - Budget versions: never delete old versions — create new active version
  - Runway: never show $0 if no bank connected — show "Connect bank account to see runway"
  - Tax estimates: label clearly "Estimate only — not tax advice" on every display
  - Sales tax nexus: label "Informational only — consult legal" prominently
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — test count must increase

STOP. Report:
1. Pages created — list
2. API routes — list
3. BullMQ jobs registered — list with schedules
4. Budget 2FA gate: confirmed
5. Runway: confirm graceful state when no bank connected
6. Tax/nexus disclaimers: confirm present in UI
7. TypeScript errors: 0
8. Test count delta
```

---

## E3-COMPANY PROMPT 6: Bank, Reconciliation, Reports + QB/Xero Export

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md  (§16 Bank, §17 Reports, §18 QB/Xero Export)
- src/lib/providers/  — find existing provider abstraction pattern
- src/app/(hub)/company/  — existing company files

TASK A: Plaid bank integration
  Provider registration:
    Usage key: "company-banking"
    Register via existing provider abstraction (same pattern as "receipt-scanning")
    Plaid access tokens stored encrypted: AES-256-GCM via provider abstraction
    Never log or return raw tokens

  src/app/(hub)/company/bank/page.tsx
    Connected accounts list: institution, account name, type, last 4, balance, last sync
    "Connect Account" button → Plaid Link flow (use Plaid Link SDK)
    Per account: transaction list with match status, "Sync Now" button

  Transaction review queue:
    Unmatched transactions from company_bank_transaction
    Columns: date | description | amount | suggested category | confidence badge
    Actions per transaction: Match to expense | Create expense | Ignore
    Auto-matched transactions (confidence ≥ 85%): shown as matched, no action needed
    Confirm-prompt transactions (60-84%): highlighted, one-click confirm

  Claude categorization:
    After each Plaid sync, unmatched transactions → Claude Vision API
    Same provider abstraction, usage key: "company-bank-categorize"
    Returns: suggestedAccountCode, suggestedConfidence
    Apply same 85/60 threshold rules as receipt scanning

  BullMQ jobs:
    company:bank:sync — every 15 min during business hours (cron: '*/15 6-22 * * 1-5')
    company:bank:categorize — after each sync, process unmatched transactions
    company:reconcile — monthly on 1st, flag unmatched transactions >30 days old

TASK B: Reports page
  src/app/(hub)/company/reports/page.tsx

  Report generation table per §17:
    Report type selector (P&L, Balance Sheet, Cash Flow, Budget vs Actuals,
    Executive Summary, Revenue Detail, Expense Detail, Contractor 1099, Tax Summary, AP Aging)
    Period selector
    Format: PDF | CSV
    "Generate" button → async generation → download link

  Report generation:
    PDF: server-side render via React to PDF (use @react-pdf/renderer or puppeteer)
    Store generated files in R2: company-reports/{reportType}/{year}/{filename}.pdf
    Return signed URL for download
    Retain for 7 years (company.finance.recordRetentionYears)

  Report history tab:
    Previously generated reports: date, type, period, format, download link
    Links expire after 24h — regenerate on demand

TASK C: QB/Xero export (settings tab)
  src/app/(hub)/company/settings/page.tsx  (or add to existing settings)

  Integrations tab:
    QuickBooks Online: OAuth2 connect button, connection status, last sync
    Xero: OAuth2 connect button, connection status, last sync
    Account code mapping: Twicely account code → QB/Xero account (one-time setup)

  Export any period:
    "Export to QuickBooks" button — creates QB journal entries from Twicely P&L
    "Export to Xero" button — same, maps to Xero chart of accounts
    "Download Journal Entry CSV" — standard format, works with any accounting software

  Messaging on this page:
    "These exports are for your accountant's workflow. Your company finances
    are fully managed in Twicely — you shouldn't need these for day-to-day use."

TASK D: Final nav wiring
  Confirm all /company/* routes are in the hub sidebar:
    Overview | P&L | Expenses | Budget | Forecast | Vendors | Contractors | Tax | Bank | Reports

  Update Page Registry (add to TWICELY_V3_PAGE_REGISTRY.md if that file is code-generated,
  otherwise list all new routes for Adrian to add manually):
    /company             — Company Overview     — COMPANY_FINANCE | SUPER_ADMIN — E3
    /company/pl          — Profit & Loss        — same
    /company/expenses    — Expenses             — same
    /company/budget      — Budget vs Actuals    — same
    /company/forecast    — Forecast & Runway    — same
    /company/vendors     — Vendors & AP         — same
    /company/contractors — Contractors          — same
    /company/tax         — Tax Center           — same
    /company/bank        — Bank & Reconciliation— same
    /company/reports     — Reports              — same
    /company/settings    — Settings             — SUPER_ADMIN only

RULES:
  - Plaid tokens: never logged, never returned in API, always encrypted in DB
  - QB/Xero tokens: same — encrypted at rest, never in API responses
  - Report R2 paths: company-reports/{type}/{year}/{uuid}.pdf
  - authorize() on every route
  - Run `npx tsc --noEmit` — must compile clean
  - Run `npx vitest run` — final test count must be higher than E3-COMPANY Prompt 1 baseline

FINAL AUDIT (run after all 6 E3-COMPANY prompts):
  grep -rn "company" src/app/\(hub\)/company/ --include="*.tsx" | wc -l  (must be >0)
  grep -rn "COMPANY_FINANCE\|SUPER_ADMIN" src/app/api/hub/company/ (must appear in every file)
  grep -rn "authorize()" src/app/api/hub/company/ (must appear in every file)
  grep -rn "plaid_access_token\|ein_encrypted" src/app/api/ (must NOT appear — only encrypted field names)
  npx tsc --noEmit (0 errors)
  npx vitest run (all passing, count higher than baseline)

STOP. Report:
1. All routes created and wired in hub nav — list
2. Plaid integration: confirm tokens encrypted, never in API response
3. Report generation: PDF + CSV confirmed for all report types
4. Page Registry update: list new routes for Adrian
5. Final audit grep results — all passing
6. TypeScript errors: 0
7. Final test count vs E3-COMPANY baseline (must be positive delta)
```

---

# EXECUTION ORDER

## Track 1: D4-UPDATE (Seller Intelligence Layer)
| Prompt | What it builds | Depends on |
|--------|---------------|------------|
| D4-UPDATE-1 | Schema migration | D4 installed ✅ |
| D4-UPDATE-2 | Platform settings + Stripe pricing | D4-UPDATE-1 |
| D4-UPDATE-3 | BullMQ compute jobs | D4-UPDATE-2 |
| D4-UPDATE-4 | Intelligence UI — PRO + FREE dashboards | D4-UPDATE-3 |
| D4-UPDATE-5 | Cross-platform unlock (F5 live) | D4-UPDATE-4 |

## Track 2: E3-COMPANY (Twicely Company Finances)
| Prompt | What it builds | Depends on |
|--------|---------------|------------|
| E3-COMPANY-1 | Schema + roles | Hub installed ✅ |
| E3-COMPANY-2 | Revenue service + auto-population | E3-COMPANY-1 |
| E3-COMPANY-3 | Executive dashboard + P&L | E3-COMPANY-2 |
| E3-COMPANY-4 | Expenses + vendors + contractors | E3-COMPANY-3 |
| E3-COMPANY-5 | Budget + forecast + tax center | E3-COMPANY-4 |
| E3-COMPANY-6 | Bank + reports + QB export + nav | E3-COMPANY-5 |

## Can these run in parallel?
Yes. Track 1 and Track 2 touch completely different parts of the codebase.
D4-UPDATE writes to /my/finances/* and seller schema.
E3-COMPANY writes to /company/* and company_* schema.
No conflicts. Run both tracks simultaneously if using separate Claude Code sessions.

---

# BANNED PATTERNS (apply to every prompt in both tracks)

- NO `as any` — fix the type
- NO `@ts-ignore` — fix the type
- NO `as unknown as T` — fix the type
- NO floating point arithmetic on money — cents only, integers only
- NO hardcoded dollar amounts or percentages — all from platform settings
- NO `auth.api.getSession()` direct — always `authorize()` from `@/lib/casl`
- NO raw Plaid tokens, EIN, or SSN in API responses — masked or omitted
- NO tax claim without hardcoded disclaimer present
- NO "savings vs eBay" language anywhere
- NO file over 300 lines (seed data excluded)
- NO test count decrease — must increase or stay same

---

# COMMIT MESSAGE FORMAT

After each prompt passes audit:

D4-UPDATE-1: feat(finance): schema migration — financial_projection, recurring_expense, intelligence columns
D4-UPDATE-2: feat(finance): pricing update $11.99/$14.99, intelligence platform settings
D4-UPDATE-3: feat(finance): intelligence compute jobs — health score, projection, performing periods
D4-UPDATE-4: feat(finance): intelligence layer UI — 10 cards, PRO/FREE dashboard update
D4-UPDATE-5: feat(finance): cross-platform revenue unlock — F5 live, platforms route, multi-series chart

E3-COMPANY-1: feat(company): schema — 12 company tables, COMPANY_FINANCE roles, platform settings
E3-COMPANY-2: feat(company): revenue service — ledger→account code mapping, hourly sync job
E3-COMPANY-3: feat(company): executive dashboard, P&L page, SaaS metrics API
E3-COMPANY-4: feat(company): expenses, vendors, AP aging, contractors, 1099 tracking
E3-COMPANY-5: feat(company): budget vs actuals, forecast/runway, tax center, quarterly reminders
E3-COMPANY-6: feat(company): Plaid bank, reconciliation, report generation, QB/Xero export, nav wiring
