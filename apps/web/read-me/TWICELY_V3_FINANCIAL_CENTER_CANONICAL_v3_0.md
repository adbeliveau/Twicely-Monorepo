# TWICELY V3 — Financial Center Canonical v3.0

**Version:** 3.0 | **Date:** 2026-03-07 | **Status:** LOCKED
**Replaces:** Financial Center Canonical v1.0, v2.0, and all addenda (all retired)
**Also closes:** Decision Rationale §45 (5-tier model — retired), §46 (Finance in Store tiers — retired)
**Read alongside:** Finance Engine Canonical v1.2, Pricing Canonical v3.2, Schema v2.0.4
**Company finances (System 3):** See Company Finances Canonical v1.0 — separate document, separate routes

---

## VERSION HISTORY

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial — basic bookkeeping concept, 5-tier model |
| 2.0 | 2026-03-07 | Two tiers, Claude Vision receipts, full dashboard spec, hub routes |
| **3.0** | **2026-03-07** | **Adds 10-feature intelligence layer. Revised FREE/PRO split. Pricing raised to $11.99 annual / $14.99 monthly. All stale content removed. Single authoritative document.** |

---

## 1. WHAT THIS IS

The Twicely Financial Center is the **fourth product axis** — an independent subscription that turns Twicely into a seller's complete resale business operating system.

**The zero-setup advantage.** Every other bookkeeping tool for resellers requires manual entry or CSV import for marketplace sales. Twicely IS the marketplace and built the crosslister — revenue flows in automatically. That single advantage justifies the price over every competitor in the category.

**Two distinct layers:**

- **Bookkeeping layer** — auto-populated P&L, expense tracking, receipt scanning, mileage, COGS, tax prep, accounting sync. Looks backward. Answers "what happened?"
- **Intelligence layer** — 10 computed features built from live data. Looks forward and sideways. Answers "what does it mean and what should I do?"

**Competitor comparison:**

| Tool | Price | Auto-populates marketplace revenue | Intelligence layer |
|---|---|---|---|
| QuickBooks Simple Start | $17.50/mo | ❌ Manual / CSV | ❌ |
| Wave | $16/mo | ❌ Manual / CSV | ❌ |
| Seller Ledger | $12/mo | Partial (eBay/Poshmark only) | ❌ |
| Bookskeeper | $14.99/mo | Partial | ❌ |
| **Twicely Finance PRO** | **$11.99/mo annual** | **✅ All platforms, real-time, zero setup** | **✅ 10 features** |

**Strategic moat.** A seller with 2 years of categorized expenses, mileage logs, sourcing ROI, COGS history, and business health trends inside Twicely has catastrophic switching costs. The Financial Center is a retention weapon disguised as a bookkeeping tool.

**Three systems — do not conflate:**
- `/my/finances` — seller bookkeeping (their money) ← this document
- `hub.twicely.co/fin/*` — platform integrity (seller payouts, ledger, reconciliation)
- `hub.twicely.co/company/*` — Twicely Inc. finances (our money) — see Company Finances Canonical v1.0

---

## 2. TIERS (AUTHORITATIVE — TWO TIERS ONLY)

The 5-tier model (FREE/Lite/Plus/Pro/Enterprise) is permanently retired. Decision Rationale §45 is superseded.

| Tier | Annual | Monthly | Who |
|------|--------|---------|-----|
| **FREE** | $0 | $0 | Every seller, always. No gate. |
| **PRO** | **$11.99/mo** | **$14.99/mo** | BUSINESS status required. |

Annual billed as $143.88/year. Monthly billed month-to-month.

**BUSINESS status gate:** PERSONAL sellers see FREE only. PRO upgrade CTA is visible but clicking it prompts BUSINESS upgrade first. BUSINESS upgrade is free — it's a status, not a paywall.

**Update required:** Pricing Canonical v3.2 §7 must be updated to $11.99 annual / $14.99 monthly before D4 build.

### Finance PRO Trial — First Store Activation

| Condition | Result |
|-----------|--------|
| First-ever Store tier activation (any tier, standalone or via bundle) | Finance PRO free for 6 months, one-time |
| Downgrade + re-upgrade Store | Does NOT restart trial |
| Cancel + resubscribe Store | Does NOT restart trial |
| Bundle purchase containing Store tier | Counts as qualifying activation |
| Trial expires without purchasing PRO | Auto-reverts to FREE |

**Trial value at new pricing:** ~$72 in annual-rate value over 6 months. Makes the trial more compelling than before.

**Tracking fields on `financeSubscription`:**
- `storeTierTrialUsed: boolean` — flips true on first qualifying activation, never resets
- `storeTierTrialStartedAt: timestamp`
- `storeTierTrialEndsAt: timestamp`

**Expiry flow:** Month 5 → email "Your Finance PRO trial ends in 30 days — keep everything for $11.99/mo." At `storeTierTrialEndsAt`: BullMQ job auto-reverts to FREE. Data retained. No features deleted — just gated.

---

## 3. FREE vs PRO — COMPLETE FEATURE SPLIT

**FREE philosophy:** Genuine daily utility. Enough to build a habit and trust Twicely with financial data. Visibility into what's happening right now. No intelligence, no tools, no history beyond 30 days.

**PRO philosophy:** Complete intelligence and control. The "why" behind every number, tools to act on it, and the tax infrastructure serious resellers need. Priced confidently because what's being offered is gold.

### FREE Tier (What's Included)

| Feature | Notes |
|---------|-------|
| Gross revenue — 30 days, Twicely only | Foundation metric |
| Available for payout | Live from ledger |
| Pending balance | Live from ledger |
| Effective fee rate — current month | Trust builder |
| Last 5 orders | Basic activity feed |
| **Revenue velocity — read-only** | "On pace for $X this month." No goal, no daily target, no pace alert. Simple. Creates daily open habit. |
| **Business health score — number only** | Shows score (e.g., 74/100) with label (Strong/Fair/Weak). No breakdown. "Upgrade to see what's driving your score." |
| **Tax reminder banner** | Generic seasonal banner before quarterly due dates: "Quarterly estimated taxes may be due soon. Finance PRO tracks this for you." No estimates, no math. |
| Upgrade prompts on all gated features | Preview of what PRO unlocks |

**Period selector on FREE:** This Month / Last Month / Last 3 Months / Last 30 Days. No custom range.

**History retention on FREE:** 30 days rolling.

### PRO Tier (Everything)

All FREE features plus:

| Feature | Category |
|---------|----------|
| Full KPI grid — all 15 KPIs | Bookkeeping |
| P&L statement | Bookkeeping |
| Balance sheet | Bookkeeping |
| Cash flow statement | Bookkeeping |
| Expense tracking — unlimited | Bookkeeping |
| Recurring expenses | Bookkeeping |
| Custom expense categories (max 10) | Bookkeeping |
| Receipt scanning — AI, 50/mo | Bookkeeping |
| Mileage tracker — IRS rate | Bookkeeping |
| COGS bulk editor | Bookkeeping |
| Inventory aging analysis | Bookkeeping |
| Tax prep package — Schedule C | Bookkeeping |
| CSV + PDF export | Bookkeeping |
| QuickBooks / Xero sync | Bookkeeping |
| 2-year history retention | Bookkeeping |
| Custom date range period selector | Bookkeeping |
| YoY comparisons (≥13 months) | Bookkeeping |
| Cross-platform revenue breakdown (F5.1) | Bookkeeping |
| **Goal tracker** | Intelligence |
| **Revenue velocity — full with daily targets and pace alerts** | Intelligence |
| **Business health score — full breakdown** | Intelligence |
| **Profit by category** | Intelligence |
| **Tax withholding assistant** | Intelligence |
| **Quarterly tax estimates** | Intelligence |
| **Cost trend analysis** | Intelligence |
| **Dead stock cost calculator** | Intelligence |
| **Inventory capital efficiency** | Intelligence |
| **Best performing periods** | Intelligence |
| Cash flow projection — 30 day | Intelligence |
| Break-even calculator | Intelligence |
| Sourcing ROI tracking | Intelligence |

---

## 4. AUTO-POPULATED DATA (ZERO SETUP)

| Event | Type | Data Captured | Phase |
|-------|------|---------------|-------|
| `order.completed` | Revenue | Sale price, TF, Stripe fees, shipping cost | D4 |
| `order.refunded` | Adjustment | Refund amount, fee reversals | D4 |
| `crosslister.sale_detected` (eBay) | Revenue | Sale price, eBay FVF | F5.1 |
| `crosslister.sale_detected` (Poshmark) | Revenue | Sale price, Poshmark 20% fee | F5.1 |
| `crosslister.sale_detected` (Mercari) | Revenue | Sale price, Mercari fees | F5.1 |
| `crosslister.sale_detected` (Depop) | Revenue | Sale price, Depop fees | F5.1 |
| `order.completed` (local) | Revenue | Sale price, local TF | D4 |
| `store.subscription_charged` | Expense | Amount, tier name | D3 |
| `crosslister.subscription_charged` | Expense | Amount, tier name | D3 |
| `finance.subscription_charged` | Expense | Amount | D4 |
| `automation.subscription_charged` | Expense | Amount | D3 |
| `shipping.label_purchased` | Expense | Label cost, carrier, order ID | D4 |
| `auth.fee_charged` | Expense | Auth fee, auth type, result | C1 |
| `insertion.fee_charged` | Expense | Fee amount, listing count | D3 |
| `boost.fee_charged` | Expense | Boost amount, listing ID | D2 |
| `buyerprotection.absorbed_cost` | Expense | Amount, claim ID | C4 |
| `return.shipping_absorbed` | Expense | Label cost, order ID | C4 |
| `goodwill.credit_issued` | Expense | Credit amount, reason | E3 |
| `affiliate.commission_paid` | Expense | Commission amount, affiliate ID | G-affiliate |
| `payout.sent` | Cash flow | Payout amount, destination | C3 |

---

## 5. KPI DEFINITIONS (AUTHORITATIVE — 15 KPIs)

PRO dashboard shows all 15. FREE shows first 3 only (revenue, available for payout, effective fee rate).

| # | KPI | Formula | Null handling |
|---|-----|---------|---------------|
| 1 | Gross Revenue | Σ(completed sale prices, all platforms) | — |
| 2 | Available for Payout | `sellerBalance.availableCents` | — |
| 3 | Effective Fee Rate | Total Platform Fees / Gross Revenue × 100 | — |
| 4 | COGS | Σ(listing.cogsCents for sold items) | Exclude nulls — show count of missing |
| 5 | Gross Profit | Revenue − COGS | Show "—" if COGS incomplete |
| 6 | Platform Fees | TF + Stripe + all crosslister platform fees | — |
| 7 | Net After Fees | Gross Profit − Platform Fees | — |
| 8 | Operating Expenses | Σ(all expense entries, manual + auto) | — |
| 9 | Net Profit | Net After Fees − Operating Expenses | — |
| 10 | Net Profit Margin | Net Profit / Gross Revenue × 100 | — |
| 11 | Sell-Through Rate | Orders / Active listings × 100 | Requires ≥1 listing |
| 12 | Average Sale Price | Gross Revenue / Order count | Requires ≥1 order |
| 13 | Average Days to Sell | Avg(soldAt − activatedAt) | Requires ≥5 orders |
| 14 | Inventory Value | Σ(priceCents) for active listings | — |
| 15 | Inventory at Cost | Σ(cogsCents) for active listings | Show "—" where COGS null |

**Null COGS rule:** Never show $0 where COGS is null. Always show "—" with tooltip: "Add your item cost to calculate profit."

---

## 6. INTELLIGENCE LAYER — ALL 10 FEATURES

All 10 features: PRO only. Zero AI, zero external APIs, zero marginal cost to Twicely.
All computed against data already in PostgreSQL.
Most cached nightly in `financialProjection` by BullMQ. Some computed at query time.
Data gate failures: card is hidden entirely — never shown with insufficient data.

---

### §6.1 Goal Tracker

**PRO only. No data gate — seller sets the goal manually.**

Seller sets a monthly revenue target and/or profit target. Real-time pace indicator.

**Setup:** Modal with two optional fields: Revenue goal, Profit goal. At least one required to activate. Goals stored in `sellerProfile.financeGoals: jsonb`.

**Display position:** Top of PRO dashboard, above KPI grid. Collapsed/hidden if no goal is set — never forced.

```
┌──────────────────────────────────────────────────────────────────┐
│  🎯 January Goal                                    [Edit Goal]  │
│                                                                  │
│  Revenue:  $3,200 of $5,000   ████████████░░░░░░░░░  64%        │
│  Profit:   $1,140 of $2,000   ██████████░░░░░░░░░░░  57%        │
│                                                                  │
│  Day 18 of 31  ·  13 days left                                  │
│  Revenue: $178/day current  ·  Need $138/day to hit  ✅         │
│  Profit:   $63/day current  ·  Need $66/day to hit   ⚠️         │
└──────────────────────────────────────────────────────────────────┘
```

**Pace formula:**
```
dailyPace = currentRevenue / daysElapsed
requiredPace = (goal - currentRevenue) / daysRemaining
```

**Status indicators:**
- ✅ On track: `dailyPace >= requiredPace`
- ⚠️ Slightly behind: `dailyPace` is 80–99% of `requiredPace`
- 🔴 Off track: `dailyPace < 80%` of `requiredPace`
- 🎉 Goal reached: revenue ≥ goal before month ends — celebrate with confetti animation

**Goal for profit:** Only shown if ≥50% of sold items in current period have COGS entered. Otherwise: "Add item costs to track profit goal."

**Month reset:** Goal resets on the 1st. Prior month goal stored in history — seller can view "Did I hit my goal last month?" with a pass/fail badge on the goal card.

---

### §6.2 Revenue Velocity

**FREE: Simple read-only. PRO: Full with daily targets and pace alerts.**

The single most habit-forming feature. Sellers check this constantly.

**FREE display (no goal required):**
```
📈 January Velocity
On pace for $4,890 this month  ·  $3,200 earned so far
```
One line. Always visible. Always current. Updates on every page load.

**PRO display (with goal active):**
Full card per §6.1 pace display — daily target, pace status, days remaining.

**PRO display (without goal set):**
```
📈 January Velocity
$3,200 earned  ·  Day 18 of 31
On pace for ~$5,511 by month end

[Set a monthly goal to track pace →]
```

**Formula:**
```
projectedMonthTotal = (currentRevenue / daysElapsed) * daysInMonth
```

**Data gate:** Requires ≥3 completed orders in current month. Below gate (FREE): "Not enough orders yet this month." Below gate (PRO): same.

---

### §6.3 Business Health Score

**FREE: Score + label only. PRO: Full breakdown with component scores and actions.**

A single composite number representing the financial health of the resale business.

**Score components (all derived from existing KPIs — no new data needed):**

| Component | Weight | What it measures | Source |
|---|---|---|---|
| Profit margin trend | 25% | Net margin direction over 90 days | KPI #10, trailed |
| Expense ratio | 20% | Operating expenses / gross revenue | KPI #8 / KPI #1 |
| Sell-through velocity | 20% | Sell-through rate vs 60-day trailing avg | KPI #11 |
| Inventory age distribution | 20% | % of inventory in Fresh vs Stale/Dead buckets | Aging buckets |
| Revenue growth | 15% | MoM revenue change, 3-month trailing | KPI #1, trailed |

**Score ranges:**
- 80–100: 💚 Excellent
- 65–79: 🟢 Strong
- 50–64: 🟡 Fair
- 35–49: 🟠 Needs attention
- 0–34: 🔴 Weak

**FREE display:**
```
┌──────────────────────────────────┐
│  Business Health      74 / 100  │
│  🟢 Strong                       │
│  [Upgrade to see what's driving  │
│   your score and how to improve] │
└──────────────────────────────────┘
```

**PRO display:**
```
┌───────────────────────────────────────────────────────────────┐
│  Business Health Score                            74 / 100    │
│  🟢 Strong  ↗ +6 vs last month                               │
│                                                               │
│  Profit Margin Trend    ████████████████████░░░  92/100  ✅  │
│  Expense Ratio          ████████████░░░░░░░░░░░  61/100  ⚠️  │
│  Sell-Through           █████████████████░░░░░░  78/100  ✅  │
│  Inventory Age          ███████████░░░░░░░░░░░░  58/100  ⚠️  │
│  Revenue Growth         █████████████████████░░  94/100  ✅  │
│                                                               │
│  💡 Your expense ratio is your biggest drag.                 │
│     Shipping costs are up 18% over 3 months.                │
│     [View Cost Trends →]                                     │
└───────────────────────────────────────────────────────────────┘
```

**Insight copy:** One actionable sentence per ⚠️ component. Pre-written templates, not AI-generated. The system picks the worst-scoring component and surfaces its pre-written insight. Each component has 3–5 templates in platform settings.

**Data gate:** Requires ≥60 days of account history and ≥10 completed orders. Below gate (FREE): hide score entirely. Below gate (PRO): "Your health score will appear after 60 days of activity."

**Computed:** Nightly by `finance:projection:compute` BullMQ job. Stored in `financialProjection.healthScore` + `financialProjection.healthScoreBreakdownJson`.

---

### §6.4 Profit by Category

**PRO only. Data gate: ≥5 sold items with COGS entered in period.**

Which categories are actually making money, not just selling.

```
┌───────────────────────────────────────────────────────────────┐
│  Profit by Category — Last 90 Days        [Sort: Margin ▾]   │
│                                                               │
│  Shoes         $1,840 revenue   54% margin   ████████████    │
│  Electronics   $2,100 revenue   38% margin   ████████        │
│  Bags            $940 revenue   47% margin   ██████████      │
│  Clothing      $1,220 revenue   22% margin   █████           │
│  Other           $340 revenue   31% margin   ███████         │
│                                                               │
│  ⚠️ Clothing: lowest margin category. Consider adjusting      │
│  sourcing prices or shifting focus to higher-margin items.   │
│                                                               │
│  X items missing COGS — add cost to improve accuracy [→]     │
└───────────────────────────────────────────────────────────────┘
```

**Formula per category:**
```
categoryRevenue = Σ(salePrice for sold listings in category)
categoryCOGS = Σ(cogsCents for sold listings in category)
categoryMargin = (categoryRevenue - categoryCOGS) / categoryRevenue × 100
```

**Minimum COGS coverage:** Requires ≥5 sold items with COGS in the category to show that category. Categories with fewer show: "Add cost data to X more items to see [Category] profit."

**Missing COGS counter:** Always shown below chart — "X sold items missing cost data. Add costs to improve accuracy. [Bulk editor →]"

**Insight:** Flags the lowest-margin category with a pre-written suggestion. Not AI — static template surfaced by the score.

**Computed:** At query time on page load. Lightweight aggregation — no caching needed.

---

### §6.5 Tax Withholding Assistant

**PRO only. No data gate — shown from first order.**

Resellers are penalized constantly for not setting aside quarterly taxes. This tells them what to set aside. Every display carries a hard disclaimer.

```
┌───────────────────────────────────────────────────────────────┐
│  💰 Tax Withholding — 2026                                    │
│                                                               │
│  Net Profit YTD:          $18,400                            │
│  Estimated rate:          25–30%  (self-employment)          │
│  Suggested set-aside:     $4,600 – $5,520                    │
│                                                               │
│  Marked as saved:         $0      [Update →]                  │
│  Remaining to set aside:  $4,600 – $5,520                    │
│                                                               │
│  ⚠️ This is an estimate only. Consult a tax professional      │
│  for advice specific to your situation.                       │
└───────────────────────────────────────────────────────────────┘
```

**Seller can mark an amount as "saved" to track what they've actually set aside.** Stored in `financeSubscription.taxSavedCents`. This is self-reported — Twicely has no visibility into their bank account. Displayed as-is with no validation.

**Estimated rate:** Sourced from `finance.tax.estimatedRateLow` and `finance.tax.estimatedRateHigh` platform settings. Default: 25–30%. Admin updates annually. Never a single number — always a range to communicate it's an estimate.

**Disclaimer:** Hardcoded on every display of any tax figure. Cannot be removed via platform settings.
> "This is an estimate only and does not constitute tax advice. Consult a qualified tax professional before making decisions about your taxes."

---

### §6.6 Quarterly Tax Estimates

**PRO only. No data gate — shown from first order.**

Running estimate of what they owe this quarter. The mechanic that stops the annual penalty surprise.

```
┌───────────────────────────────────────────────────────────────┐
│  📅 Quarterly Tax Estimates — 2026                            │
│                                                               │
│  Q1 (due Apr 15)    $1,840 estimated   ✅ Marked paid        │
│  Q2 (due Jun 16)    $2,320 estimated   ⚠️ Due in 47 days     │
│  Q3 (due Sep 15)    —                  📋 Not yet calculable  │
│  Q4 (due Jan 15)    —                  📋 Not yet calculable  │
│                                                               │
│  Q2 estimate based on $9,280 net profit this quarter.        │
│  Rate applied: 25%  (configured in Finance Settings)         │
│                                                               │
│  ⚠️ Estimates only. Consult a tax professional.              │
└───────────────────────────────────────────────────────────────┘
```

**Formula:**
```
quarterNetProfit = Σ(net profit for calendar quarter)
quarterlyEstimate = quarterNetProfit × (finance.tax.estimatedRateLow / 100)
```

**Due date reminders:** BullMQ job fires email 30 days before + 7 days before each quarterly due date. Reminder links to this card.

**"Marked paid" toggle:** Seller marks when they've paid. Self-reported. Stored in `financeSubscription.taxQuarterlyPaymentsJson`.

**Hard disclaimer:** Same text as §6.5, shown below table always.

**Quarterly due dates** sourced from platform settings — updated annually for actual IRS calendar (they shift when dates fall on weekends/holidays).

---

### §6.7 Cost Trend Analysis

**PRO only. Data gate: ≥3 months of expense history.**

Surfaces the expense categories moving the wrong direction before they become a problem.

```
┌───────────────────────────────────────────────────────────────┐
│  📊 Cost Trends — Last 6 Months               [6mo ▾]        │
│                                                               │
│  as % of Revenue:                                            │
│                                                               │
│  Shipping costs       7% → 14%   ↑ +100%  🔴 Significant    │
│  Platform fees        9% → 9.1%  ↑ +1%    ✅ Stable          │
│  Packaging            2% → 2.4%  ↑ +20%   ⚠️ Mild increase  │
│  Storage              3% → 3%    → 0%     ✅ Stable          │
│  Subscriptions        1% → 1.2%  ↑ +20%   ✅ Small           │
│                                                               │
│  💡 Shipping costs doubled as % of revenue over 6 months.    │
│  Review your label strategy or adjust pricing to compensate.  │
└───────────────────────────────────────────────────────────────┘
```

**Formula per category per period:**
```
categoryRatio = categoryExpenses / grossRevenue × 100
trendDirection = currentRatio - startingRatio
trendPct = (currentRatio - startingRatio) / startingRatio × 100
```

**Alert thresholds:**
- 🔴 Significant: any category up >50% as % of revenue
- ⚠️ Mild: any category up 20–50%
- ✅ Stable: within ±20%

**Period selector:** 3 months / 6 months / 12 months. Default: 6 months.

**Minimum category amount:** Categories with < $50 total over the period are excluded — noise suppression.

**Computed:** At query time. Grouped aggregation by category and month.

---

### §6.8 Dead Stock Cost Calculator

**PRO only. Data gate: ≥1 listing in Stale or Dead aging bucket.**

Makes stale inventory feel financially urgent. Bridges the gap between "this item is old" and "this item is costing me money."

```
┌───────────────────────────────────────────────────────────────┐
│  ⏳ Dead Stock Analysis                                        │
│                                                               │
│  91–180 days (Dead):    14 items   $1,260 at list price      │
│                                    $840 at cost               │
│  181+ days (Long-tail):  9 items   $720 at list price        │
│                                    $490 at cost               │
│                                                               │
│  Total idle capital:    $1,330 at cost (23 items)            │
│                                                               │
│  At your 62% sell-through rate, these items represent        │
│  $826 in capital that should have converted by now.          │
│                                                               │
│  Opportunity cost: ~$X/month sitting in unsold inventory     │
│  (based on your average 18-day time-to-sell)                 │
│                                                               │
│  [Drop prices on these items →]   [View in inventory →]      │
└───────────────────────────────────────────────────────────────┘
```

**Formulas:**
```
idleCapital = Σ(cogsCents for items in Stale + Dead + Long-tail buckets)
expectedConversionValue = idleCapital × sellThroughRate90d
opportunityCostPerMonth = idleCapital / avgDaysToSell × 30
```

**If cogsCents is null for stale items:** Show list price with asterisk — "* List price shown — add item cost for accurate idle capital."

**CTA links:**
- "Drop prices on these items" → `/my/selling/listings?filter=stale&bulkAction=priceEdit`
- "View in inventory" → `/my/finances/inventory?filter=stale`

**Computed:** At query time. Fast — just filters existing inventory aging data.

---

### §6.9 Inventory Capital Efficiency

**PRO only. Data gate: ≥10 sold items with COGS entered AND ≥30 days history.**

How fast is their money working? The metric that tells sellers whether to source more aggressively or liquidate first.

```
┌───────────────────────────────────────────────────────────────┐
│  💼 Inventory Capital Efficiency                              │
│                                                               │
│  Inventory turns:     1.8×/month   ↗ +0.3 vs last month     │
│  Capital at work:     $12,400 at cost (active listings)      │
│  Avg turnover:        24 days      (how long to convert $1)  │
│                                                               │
│  At 1.8 turns/month, every $1 invested becomes $1.54        │
│  in revenue within 30 days (after your 54% avg margin).     │
│                                                               │
│  Industry benchmark: 1.5–2.5× for active resellers          │
│  Your status: ✅ Within healthy range                        │
└───────────────────────────────────────────────────────────────┘
```

**Formulas:**
```
avgInventoryAtCost = (openingInventoryCost + closingInventoryCost) / 2
cogsSold = Σ(cogsCents for items sold in period)
inventoryTurns = cogsSold / avgInventoryAtCost
avgTurnoverDays = 30 / inventoryTurns
```

**Industry benchmark ranges:** Sourced from platform settings — admin-configurable. Default: 1.5–2.5× for healthy resellers.

**"Every $1 becomes $X" narrative:** Computed as `(avgSalePrice / avgCOGS)` — shows the multiplier on invested capital in plain language. Only shown when COGS coverage ≥ 50% of active listings.

**Computed:** Nightly in `finance:projection:compute`. Cached in `financialProjection`.

---

### §6.10 Best Performing Periods

**PRO only. Data gate: ≥90 days of history AND ≥20 completed orders.**

When do their items actually sell? Actionable for listing timing and sourcing cadence.

```
┌───────────────────────────────────────────────────────────────┐
│  📅 Best Performing Periods — Last 12 Months                  │
│                                                               │
│  Best days to list (fastest sell-through):                   │
│  Monday    ████████████████████  38% faster than avg  🏆     │
│  Tuesday   ██████████████████    31% faster           ✅      │
│  Wednesday ████████████████      22% faster           ✅      │
│  Thursday  ████████████          avg                          │
│  Friday    ██████████            12% slower                   │
│  Saturday  █████████             18% slower                   │
│  Sunday    ████████              24% slower                   │
│                                                               │
│  Best months (by revenue):                                   │
│  Nov ████████████████████  2.1×  Dec ████████████████ 1.8×  │
│  Oct ██████████████  1.4×  Jan  ██████████████  1.3×        │
│                                                               │
│  💡 Items listed Monday–Wednesday sell 30% faster on average. │
│  Plan your listing sessions for early in the week.           │
└───────────────────────────────────────────────────────────────┘
```

**Day-of-week formula:**
```
avgDaysToSellByDOW = groupBy(listedAt.dayOfWeek, avg(soldAt - listedAt))
relativeSpeed = (overallAvgDays - dowAvgDays) / overallAvgDays × 100
```

**Monthly revenue formula:**
```
monthRevenue = Σ(salePrice for orders in month)
monthMultiplier = monthRevenue / avgMonthRevenue
```

**Seasonal insight:** Flags the top 2 revenue months and suggests sourcing lead time. "November is your strongest month — consider ramping sourcing in September."

**Minimum data gate (strict):** Below 90 days OR below 20 orders — card is completely hidden. No partial display. No "come back when you have more data" placeholder — just absent. This prevents unreliable patterns from influencing behavior.

**Computed:** Nightly by `finance:projection:compute`. Cached in `financialProjection.performingPeriodsJson`.

---

## 7. PRO DASHBOARD LAYOUT (COMPLETE)

Period selector defaults to current month. Custom date range available to PRO.

```
┌─────────────────────────────────────────────────────────────────┐
│  💰 Financial Overview    [January 2026 ▾]  [YoY ▾]  [Export]  │
└─────────────────────────────────────────────────────────────────┘

[GOAL TRACKER — §6.1, only if goal is set]
┌──────────────────────────────────────────────────────────────────┐
│  🎯 January Goal: Revenue $5,000 · Profit $2,000   [Edit Goal]  │
│  Revenue: $3,200 ████████████░░░░░░░░  64% · ✅ On track        │
│  Profit:  $1,140 ██████████░░░░░░░░░░  57% · ⚠️ Slightly behind │
└──────────────────────────────────────────────────────────────────┘

[REVENUE VELOCITY — §6.2]
┌──────────────────────────────────────────────────────────────────┐
│  📈 Day 18 of 31 · $3,200 earned · On pace for ~$5,511          │
│  Revenue: $178/day · Need $138/day to hit goal ✅               │
└──────────────────────────────────────────────────────────────────┘

ROW 1 — PRIMARY KPIs (3 large cards)
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Gross Revenue   │  │   Net Profit     │  │  Profit Margin   │
│    $7,240        │  │    $2,721        │  │     37.6%        │
│  ↗ +23% YoY     │  │  ↗ +31% YoY     │  │  ↗ +2.8pp YoY   │
└──────────────────┘  └──────────────────┘  └──────────────────┘

ROW 2 — FINANCIAL FLOW (4 smaller cards)
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│    COGS    │ │  Platform  │ │ Operating  │ │ Net After  │
│   $2,840   │ │   Fees     │ │  Expenses  │ │   Fees     │
│            │ │   $954     │ │   $765     │ │  $3,446    │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

ROW 3 — VELOCITY + INVENTORY (4 smaller cards)
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  Sell-Thru │ │  Avg Sale  │ │  Avg Days  │ │ Inventory  │
│    62%     │ │   $51.00   │ │  to Sell   │ │   Value    │
│  ↗ +4%    │ │            │ │  18 days   │ │  $12,400   │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

ROW 4 — PAYOUT STATUS
┌────────────────────────────────────────────────────────────────┐
│  Available: $890  ·  Pending: $340  ·  Next payout: Friday    │
│                                               [Withdraw Now]  │
└────────────────────────────────────────────────────────────────┘

ROW 5 — BUSINESS HEALTH + BREAK-EVEN (2 cards)
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Business Health    74/100   │  │  Break-Even                  │
│  🟢 Strong ↗ +6 last month  │  │  Fixed costs: $765/mo        │
│                              │  │  Gross margin: 60.8%         │
│  Profit Margin  92/100  ✅   │  │                              │
│  Expense Ratio  61/100  ⚠️   │  │  You need: $1,258/mo        │
│  Sell-Through   78/100  ✅   │  │  You're at: $7,240/mo ✅    │
│  Inventory Age  58/100  ⚠️   │  │                              │
│  Revenue Growth 94/100  ✅   │  │  Well above break-even       │
│                              │  │                              │
│  💡 Expense ratio is your   │  │                              │
│  biggest drag. Shipping up  │  │                              │
│  18% over 3 months.         │  │                              │
│  [View Cost Trends →]       │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘

ROW 6 — REVENUE CHART (full width)
  Stacked bar chart — Twicely only pre-F5.1, multi-platform post-F5.1
  Daily / Weekly toggle. Bar / Line toggle.

ROW 7 — CASH FLOW PROJECTION + DEAD STOCK (2 cards)
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  📈 Next 30 Days             │  │  ⏳ Dead Stock               │
│  Revenue:  ~$3,200           │  │  23 items · $1,330 idle      │
│  Expenses: ~$480             │  │  capital at cost             │
│  Profit:   ~$2,720           │  │                              │
│                              │  │  ~$826 should have sold by   │
│  62% sell-through rate       │  │  now at your current rate    │
│  47 listings active          │  │                              │
│  Based on 90-day history     │  │  [Drop prices →]             │
└──────────────────────────────┘  └──────────────────────────────┘

ROW 8 — INVENTORY CAPITAL EFFICIENCY + PROFIT BY CATEGORY (2 cards)
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  💼 Capital Efficiency       │  │  📊 Profit by Category       │
│  1.8× turns/month ✅        │  │  Shoes      54% margin 🏆    │
│  24 avg days to convert      │  │  Bags       47% margin       │
│  $12,400 at work             │  │  Electronics 38% margin      │
│  $1 → $1.54 in 30 days      │  │  Clothing   22% margin ⚠️    │
└──────────────────────────────┘  └──────────────────────────────┘

ROW 9 — EXPENSE BREAKDOWN (full width)
  Donut chart + category table. [Add Expense +] in header.

ROW 10 — TAX CENTER (2 cards)
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  💰 Tax Withholding          │  │  📅 Quarterly Estimates      │
│  Net profit YTD: $18,400     │  │  Q1 (Apr 15)  $1,840  ✅    │
│  Set aside: $4,600–$5,520    │  │  Q2 (Jun 16)  $2,320  ⚠️    │
│  Saved: $0  [Update →]       │  │  Q3 (Sep 15)  —      📋     │
│                              │  │  Q4 (Jan 15)  —      📋     │
│  ⚠️ Estimate only.           │  │  ⚠️ Estimate only.           │
└──────────────────────────────┘  └──────────────────────────────┘

ROW 11 — BEST PERFORMING PERIODS + COST TRENDS (2 cards, if data gate met)
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  📅 Best Periods             │  │  📊 Cost Trends              │
│  Mon: 38% faster 🏆         │  │  Shipping:    7% → 14%  🔴   │
│  Tue: 31% faster             │  │  Platform:    9% → 9.1% ✅   │
│  Nov/Dec: 2.1×/1.8× revenue │  │  Packaging:   2% → 2.4% ⚠️   │
│  [View full breakdown →]     │  │  [View full breakdown →]     │
└──────────────────────────────┘  └──────────────────────────────┘

ROW 12 — SOURCING ROI (if sourcing trips tagged)
  Per existing §8.8 spec.
```

**Mobile layout (<768px):** All cards stacked full-width. Goal tracker and velocity always at top. Charts horizontally scrollable. Tax cards stacked.

---

## 8. FREE TIER DASHBOARD LAYOUT

```
┌─────────────────────────────────────────────────────────────────┐
│  💰 Financial Overview      [This Month ▾]   [Upgrade to PRO]  │
└─────────────────────────────────────────────────────────────────┘

[REVENUE VELOCITY — simplified, no goal]
┌──────────────────────────────────────────────────────────────────┐
│  📈 January · $1,240 earned · On pace for ~$2,138 this month    │
└──────────────────────────────────────────────────────────────────┘

ROW 1 — 3 KPI CARDS
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Gross Revenue  │  │ Available for  │  │ Effective Fee  │
│   $1,240       │  │    Payout      │  │    Rate        │
│  ↗ vs last mo │  │    $890        │  │    8.4%        │
│                │  │  +$340 pending │  │                │
└────────────────┘  └────────────────┘  └────────────────┘

[BUSINESS HEALTH SCORE — teaser only]
┌──────────────────────────────────────────────────────────────────┐
│  Business Health: 74 / 100  🟢 Strong                           │
│  Upgrade to Finance PRO to see what's driving your score        │
│  and how to improve it.                          [Upgrade →]    │
└──────────────────────────────────────────────────────────────────┘

[LAST 5 ORDERS]
  ... order rows ...

[TAX REMINDER BANNER — seasonal, near Q due dates only]
┌──────────────────────────────────────────────────────────────────┐
│  📅 Quarterly estimated taxes may be due soon.                  │
│  Finance PRO tracks your estimates and reminds you before       │
│  each due date.                                  [Upgrade →]    │
└──────────────────────────────────────────────────────────────────┘

[PRO UPGRADE CARD]
┌──────────────────────────────────────────────────────────────────┐
│  🔒 Unlock the full picture with Finance PRO — $11.99/mo        │
│                                                                  │
│  P&L · Expenses · Mileage · Tax Prep · Goal Tracking           │
│  Receipt Scanning · Full Health Score · Profit by Category      │
│                                                                  │
│  [Start 6-Month Free Trial]         or    [$11.99/mo annual]   │
└──────────────────────────────────────────────────────────────────┘
```

**Trial CTA logic:**
- Store active + `storeTierTrialUsed = false` → "Start 6-Month Free Trial" prominently
- `storeTierTrialUsed = true` + PRO not active → "$11.99/mo annual · $14.99/mo monthly"
- PERSONAL status → PRO upgrade CTA hidden, replaced with "Upgrade to BUSINESS to unlock Finance PRO" with link to BUSINESS upgrade

**Tax reminder banner:** Only shown in the 30 days before a quarterly due date (April 15, June 15, September 15, January 15). Hidden the rest of the year.

---

## 9. MANUAL ENTRY FEATURES (PRO)

### Expense Tracking

**Preset categories (16):** Shipping Supplies, Packaging, Equipment, Software/Subscriptions, Mileage, Storage/Rent, Sourcing Trips, Photography, Authentication, Platform Fees, Postage, Returns/Losses, Marketing, Office Supplies, Professional Services, Other

**Custom categories:** PRO only, max 10. Cannot delete if entries exist — archive instead.

**Recurring expenses:** Monthly/weekly/annual with start/end dates. Auto-created by BullMQ job. Displayed with "Recurring" badge. Cannot edit auto-logged entries — they are the system of record.

**Auto-logged expenses:** `isAutoLogged: true`. "Auto" badge in UI. Not editable by seller.

### Receipt Scanning — Claude Vision

Via provider abstraction. Usage key: `receipt-scanning`. Model: `claude-sonnet-4-6`.

**Credit pool:** Completely separate from Crosslister AI credits. 50 scans/month PRO. $0.25/scan overage billed end of cycle. No rollover.

**Confidence thresholds:**
- ≥85: auto-fill, fields remain editable
- 60–84: pre-fill + confirm prompt "Does this look right?"
- <60: "Please verify" banner, all fields manual
- `NOT_A_RECEIPT`: "This doesn't appear to be a receipt."
- `UNREADABLE`: "Try a clearer photo or enter manually."

**Supported formats:** image/jpeg, image/png, image/webp, image/heic. Max 10MB.

**Storage:** R2 at `receipts/{userId}/{expenseId}.{ext}`

### Mileage Tracker

IRS rate from `finance.mileageRatePerMile` platform setting — never hardcoded. Updated annually.

### COGS Entry

**All sellers (no tier gate):** Optional "Your cost" field on listing create and edit forms. Stored as `listing.cogsCents`.

**PRO only:** Bulk COGS editor at `/my/finances/cogs`. Inline edit, CSV import. Shows sold listings missing cost only.

### Sourcing ROI

Link expense entries to listings via sourcing trip grouping. Revenue + ROI displayed per trip on expense list. Full spec per prior §8.8.

---

## 10. REPORTS (PRO)

| Report | Description |
|--------|-------------|
| P&L Statement | Full income statement, period selectable, YoY toggle, Schedule C format available |
| Balance Sheet | Assets (inventory at cost, pending receivables), liabilities, equity |
| Cash Flow Statement | Operating cash flows by period |
| Inventory Aging | Full aging table per bucket configuration |
| Tax Prep Package | Schedule C mapped, PDF + CSV, with hardcoded disclaimer |

**Tax prep disclaimer (hardcoded — not editable via platform settings):**
> "This report is provided for informational purposes only and does not constitute tax advice. Consult a qualified tax professional before filing. Twicely makes no representation regarding the accuracy or completeness of this report for tax purposes. 1099-K forms are issued directly by each platform and are not included in this report."

**Export formats:** CSV + PDF (PRO). Reports retained 2 years.

---

## 11. ACCOUNTING INTEGRATIONS (PRO — Phase G10.3)

**QuickBooks Online + Xero.** OAuth2. Daily sync or on-demand. Twicely data wins — QB/Xero are receivers. Dedup on Twicely transaction ID. Retry ×3 on failure, then alert seller. Tokens encrypted at rest.

---

## 12. ROUTES (AUTHORITATIVE)

| Route | Tier | Phase | Description |
|-------|------|-------|-------------|
| `/my/finances` | FREE + PRO | D4 | Dashboard per §7 / §8 |
| `/my/finances/pl` | PRO | D4 | Full P&L |
| `/my/finances/inventory` | PRO | D4 | Inventory aging + capital efficiency |
| `/my/finances/expenses` | PRO | D4 | Expense list, add, receipt upload |
| `/my/finances/mileage` | PRO | D4 | Mileage log |
| `/my/finances/cogs` | PRO | D4 | Bulk COGS editor |
| `/my/finances/reports` | PRO | D4 | Generate all reports |
| `/my/finances/platforms` | PRO | F5.1 | Cross-platform revenue (post-crosslister) |
| `/my/finances/integrations` | PRO | G10.3 | QB/Xero connection |
| `/my/finances/settings` | All | D4 | Currency, categories, goals, tax rate, aging buckets |

**Ledger/payout routes remain at `/my/selling/finances/*`** — separate concern.

---

## 13. SCHEMA ADDITIONS

Queue for next migration. Additive only — no existing tables modified destructively.

### Add to `financeSubscription`:
```typescript
storeTierTrialUsed:          boolean — default false
storeTierTrialStartedAt:     timestamp (nullable)
storeTierTrialEndsAt:        timestamp (nullable)
receiptCreditsUsedThisMonth: integer — default 0
receiptCreditsPeriodStart:   timestamp (nullable)
taxSavedCents:               integer — default 0  // seller self-reported withholding savings
taxQuarterlyPaymentsJson:    jsonb — default '{}'  // { "2026_Q1": { paid: true, paidAt: ... } }
```

### Add to `listing`:
```typescript
cogsCents:          integer (nullable)
sourcingExpenseId:  text (nullable, references expense.id)
```

### Add to `expense`:
```typescript
sourcingTripGroupId:  text (nullable)
isAutoLogged:         boolean — default false
autoLogEventType:     text (nullable)
recurringExpenseId:   text (nullable, references recurringExpense.id)
```

### New table: `recurringExpense`
```typescript
export const recurringExpense = pgTable('recurring_expense', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  userId:       text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  category:     text('category').notNull(),
  amountCents:  integer('amount_cents').notNull(),
  vendor:       text('vendor'),
  description:  text('description'),
  frequency:    text('frequency').notNull(),  // 'MONTHLY' | 'WEEKLY' | 'ANNUAL'
  startDate:    date('start_date').notNull(),
  endDate:      date('end_date'),
  isActive:     boolean('is_active').notNull().default(true),
  lastCreatedAt: date('last_created_at'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### New table: `financialProjection` (nightly cache)
```typescript
export const financialProjection = pgTable('financial_projection', {
  id:                       text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:          text('seller_profile_id').notNull().unique()
                              .references(() => sellerProfile.id),
  // Projection
  projectedRevenue30d:      integer('projected_revenue_30d'),
  projectedExpenses30d:     integer('projected_expenses_30d'),
  projectedProfit30d:       integer('projected_profit_30d'),
  // Rates
  sellThroughRate90d:       integer('sell_through_rate_90d'),  // basis points: 6200 = 62%
  avgSalePrice90d:          integer('avg_sale_price_90d'),
  effectiveFeeRate90d:      integer('effective_fee_rate_90d'), // basis points
  avgDaysToSell90d:         integer('avg_days_to_sell_90d'),
  // Break-even
  breakEvenRevenue:         integer('break_even_revenue'),
  breakEvenOrders:          integer('break_even_orders'),
  // Health score
  healthScore:              integer('health_score'),           // 0-100
  healthScoreBreakdownJson: jsonb('health_score_breakdown_json'),
  // Capital efficiency
  inventoryTurnsPerMonth:   integer('inventory_turns_per_month'), // basis points
  // Performing periods
  performingPeriodsJson:    jsonb('performing_periods_json'),
  // Quality
  dataQualityScore:         integer('data_quality_score').notNull().default(0), // 0-100
  computedAt:               timestamp('computed_at', { withTimezone: true })
                              .notNull().defaultNow(),
});
```

### Add to `sellerProfile`:
```typescript
financeGoals: jsonb('finance_goals'),
// { revenueGoalCents: number | null, profitGoalCents: number | null }
// null = no goal set
```

---

## 14. PLATFORM SETTINGS (COMPLETE — REPLACES v2.0 §11)

```
# Pricing
finance.pricing.pro.annualMonthlyCents: 1199     # $11.99/mo billed annually
finance.pricing.pro.annualTotalCents: 143880     # $143.88/year
finance.pricing.pro.monthlyCents: 1499           # $14.99/mo billed monthly

# Trial
finance.storeTierTrialMonths: 6
finance.storeTierTrialRepeatable: false

# Retention
finance.reportRetentionDays.free: 30
finance.reportRetentionYears.pro: 2

# Receipt scanning
finance.receiptScanCredits.pro: 50
finance.receiptScanCredits.overageCents: 25
finance.receiptScanCredits.rollover: false
finance.receiptScanning.usageKey: "receipt-scanning"
finance.receiptScanning.provider: "anthropic"
finance.receiptScanning.model: "claude-sonnet-4-6"
finance.receiptScanning.maxImageSizeMb: 10
finance.receiptScanning.confidenceAutoAccept: 85
finance.receiptScanning.confidenceConfirmPrompt: 60
finance.receiptScanning.supportedFormats: ["image/jpeg","image/png","image/webp","image/heic"]

# Mileage (update January 1 annually)
finance.mileageRatePerMile: 0.70
finance.mileageRateYear: 2026

# Inventory aging defaults (sellers can override in /my/finances/settings)
finance.inventoryAging.freshDays: 30
finance.inventoryAging.slowingDays: 60
finance.inventoryAging.staleDays: 90
finance.inventoryAging.deadDays: 180

# Intelligence layer — data gates
finance.projection.minimumHistoryDays: 90
finance.projection.minimumOrders: 10
finance.projection.dataQualityThreshold: 60
finance.breakeven.minimumHistoryMonths: 3
finance.yoy.minimumMonths: 13
finance.healthScore.minimumHistoryDays: 60
finance.healthScore.minimumOrders: 10
finance.performingPeriods.minimumHistoryDays: 90
finance.performingPeriods.minimumOrders: 20
finance.capitalEfficiency.minimumSoldWithCogs: 10
finance.capitalEfficiency.minimumHistoryDays: 30
finance.profitByCategory.minimumSoldWithCogs: 5
finance.costTrend.minimumHistoryMonths: 3
finance.costTrend.minimumCategoryAmountCents: 5000  # $50 — noise floor

# Intelligence layer — thresholds
finance.inventoryTurns.healthyLow: 150    # basis points: 1.5×
finance.inventoryTurns.healthyHigh: 250   # basis points: 2.5×
finance.costTrend.redAlertPct: 50         # >50% increase = significant
finance.costTrend.yellowAlertPct: 20      # 20-50% increase = mild

# Health score component weights (must sum to 100)
finance.healthScore.weights.profitMarginTrend: 25
finance.healthScore.weights.expenseRatio: 20
finance.healthScore.weights.sellThroughVelocity: 20
finance.healthScore.weights.inventoryAge: 20
finance.healthScore.weights.revenueGrowth: 15

# Tax (update annually)
finance.tax.estimatedRateLow: 25          # % — self-employment lower bound
finance.tax.estimatedRateHigh: 30         # % — self-employment upper bound
finance.tax.q1DueDate: "2026-04-15"
finance.tax.q2DueDate: "2026-06-16"
finance.tax.q3DueDate: "2026-09-15"
finance.tax.q4DueDate: "2027-01-15"
finance.tax.reminderBannerDaysBefore: 30  # days before due date to show FREE banner
finance.tax.reminderEmailDaysBefore: [30, 7]

# Custom categories
finance.customCategories.maxPerSeller: 10

# General
finance.defaultCurrency: "USD"
finance.expenseCategories: [
  "Shipping Supplies", "Packaging", "Equipment", "Software/Subscriptions",
  "Storage/Rent", "Sourcing Trips", "Photography", "Authentication",
  "Platform Fees", "Postage", "Returns/Losses", "Marketing",
  "Office Supplies", "Professional Services", "Other"
]
```

---

## 15. BACKGROUND JOBS (BULLMQ)

| Job | Schedule | What it does |
|-----|----------|-------------|
| `finance:projection:compute` | Nightly 3:00 AM UTC | Rebuild `financialProjection` for all PRO sellers meeting data gates. Computes: projection, sell-through, fee rates, break-even, health score, capital efficiency, performing periods. |
| `finance:recurring:create` | Daily 6:00 AM UTC | Create expense entries for due recurring expenses |
| `finance:credits:reset` | On seller billing cycle date | Reset `receiptCreditsUsedThisMonth = 0` |
| `finance:trial:check` | Daily 8:00 AM UTC | Warn at 30 days before expiry; auto-revert at `storeTierTrialEndsAt` |
| `finance:tax:reminder` | Daily 8:00 AM UTC | Send email reminders at 30 + 7 days before quarterly due dates (PRO only) |
| `finance:mileage:rate:alert` | January 1 annually | Alert admin: "Update finance.mileageRatePerMile and finance.mileageRateYear for new tax year" |
| `finance:tax:dates:alert` | January 1 annually | Alert admin: "Update quarterly tax due dates in platform settings" |

---

## 16. CASL PERMISSIONS

| Subject | Actor | read | create | update | delete |
|---------|-------|------|--------|--------|--------|
| FinanceSubscription | Seller | Own | — | Own (Stripe) | — |
| Expense | Seller | Own | Own (manual only) | Own (manual only) | Own (manual only, not auto-logged) |
| RecurringExpense | Seller | Own | Own | Own | Own |
| MileageEntry | Seller | Own | Own | Own | Own |
| FinancialReport | Seller | Own | Own (generate) | — | — |
| FinancialProjection | Seller | Own | — | — | — |
| AccountingIntegration | Seller | Own | Own | Own | Own |
| FinanceSubscription | Platform Admin | Any | — | Any | — |
| Expense | Platform Admin | Any | Manual adj. | — | — |
| FinancialProjection | Platform Agent (FINANCE) | Any | — | — | — |

Staff with `finance.view` scope: read seller's expenses, mileage, reports. Cannot create or edit.

---

## 17. PHASE MAPPING

| Feature | Phase |
|---------|-------|
| FREE dashboard | D4 |
| PRO dashboard — full KPI grid | D4 |
| Goal tracker | D4 |
| Revenue velocity | D4 |
| Business health score | D4 |
| Tax withholding assistant | D4 |
| Quarterly tax estimates | D4 |
| Expense tracking + recurring | D4 |
| Receipt scanning (Claude Vision) | D4 |
| Mileage tracker | D4 |
| COGS entry on listing form | D4 |
| COGS bulk editor | D4 |
| Inventory aging | D4 |
| Dead stock cost calculator | D4 |
| Inventory capital efficiency | D4 |
| Best performing periods | D4 |
| Cost trend analysis | D4 |
| Profit by category | D4 |
| Cash flow projection | D4 |
| Break-even calculator | D4 |
| Sourcing ROI | D4 |
| P&L + balance sheet + cash flow reports | D4 |
| Tax prep package (Schedule C) | D4 |
| Cross-platform revenue `/my/finances/platforms` | F5.1 |
| YoY comparisons (data) | F5.1+ / 13 months |
| QuickBooks / Xero sync | G10.3 |

---

## 18. D4 AUDIT CHECKLIST

**Pricing:**
- [ ] Finance PRO annual: $11.99/mo ($143.88/year) — verify Stripe product
- [ ] Finance PRO monthly: $14.99/mo — verify Stripe product
- [ ] Pricing Canonical v3.2 §7 updated to match before build

**FREE dashboard:**
- [ ] Revenue velocity: simple read-only, no goal, no daily target
- [ ] Health score: number + label only, upgrade prompt
- [ ] Tax reminder banner: only within 30 days of Q due date, hidden otherwise
- [ ] 3 KPI cards + last 5 orders only — nothing else
- [ ] PRO upgrade CTA: shows trial offer if `storeTierTrialUsed = false` + Store active
- [ ] PERSONAL sellers: PRO CTA hidden, BUSINESS upgrade CTA shown instead

**PRO dashboard:**
- [ ] Goal tracker: hidden if no goal set, renders above velocity card when set
- [ ] Revenue velocity: full with daily pace and status indicator
- [ ] Health score: full breakdown with component bars and insight copy
- [ ] All 15 KPIs rendered per §5 formulas
- [ ] Null COGS: "—" not "$0" everywhere
- [ ] Cross-platform section: hidden entirely pre-F5.1
- [ ] YoY toggle: hidden if < 13 months data

**Intelligence features:**
- [ ] Profit by category: hidden if < 5 sold items with COGS per category
- [ ] Tax withholding: hardcoded disclaimer on every render — cannot be removed
- [ ] Quarterly tax: hardcoded disclaimer on every render — cannot be removed
- [ ] Cost trend: hidden if < 3 months expense history
- [ ] Dead stock: hidden if 0 items in Stale/Dead buckets
- [ ] Capital efficiency: hidden if < 10 sold items with COGS AND < 30 days history
- [ ] Best performing periods: hidden entirely if < 90 days OR < 20 orders
- [ ] Health score: hidden entirely if < 60 days OR < 10 orders
- [ ] All intelligence features: hidden below gate, never partial/empty state shown

**Data integrity:**
- [ ] All monetary values in cents throughout — zero floating point
- [ ] Auto-logged expenses: `isAutoLogged = true`, not editable, "Auto" badge
- [ ] Custom categories: max 10 enforced server-side
- [ ] Inventory aging buckets: from platform settings, never hardcoded
- [ ] `financialProjection` rebuilt nightly — never computed on page request
- [ ] Receipt credits: finance pool only, never touch crosslister.aiCredits

**Tax:**
- [ ] Tax disclaimer text hardcoded — verify no platform settings key controls it
- [ ] Tax due dates: from platform settings, not hardcoded
- [ ] Tax reminder banner: only shows 30 days before Q due date

**Trial:**
- [ ] `storeTierTrialUsed` flips to `true` on first Store activation — bundle counts
- [ ] 30-day warning email fires when `storeTierTrialEndsAt` = now + 30 days
- [ ] BullMQ expiry job downgrades to FREE — data retained, features gated only
- [ ] Re-upgrade after expiry: `storeTierTrialUsed` stays `true`, no new trial

**Tests:**
- [ ] Test count increases from pre-D4 baseline — never decreases
- [ ] Unit tests: all 10 intelligence formulas tested with known inputs/outputs
- [ ] Unit tests: health score computation, all 5 components, edge cases
- [ ] Unit tests: goal pace calculation, all status thresholds
- [ ] E2E: full PRO dashboard renders without error
- [ ] E2E: FREE dashboard shows velocity + health score teaser + upgrade CTAs
- [ ] E2E: intelligence cards hidden below data gates

---

*End of Financial Center Canonical v3.0*
*Replaces: v1.0, v2.0, and all addenda — all retired*
*System 1 of 3: User Financial Center (/my/finances) | Platform Integrity (/fin/*) | Company Finances (/company/*)*
*Pricing update required: Pricing Canonical v3.2 §7 must reflect $11.99 annual / $14.99 monthly*
*Next review trigger: After D4 build complete — before F5.1*
