# TWICELY V3 — Company Finances Canonical v1.0

**Version:** 1.0 | **Date:** 2026-03-07 | **Status:** LOCKED
**Route prefix:** `hub.twicely.co/company/*`
**Access gate:** `COMPANY_FINANCE` staff role (new) + `SUPER_ADMIN` (always)
**Build phase:** E3 (alongside hub build)
**Read alongside:** Finance Engine Canonical v1.2, Financial Center Canonical v2.0

---

## 1. WHAT THIS IS

Twicely's own internal financial operating system. Complete replacement for QuickBooks.

**Why it beats QB for a business like this:**

| QB | Twicely Company Finances |
|---|---|
| You manually enter or import revenue | Revenue auto-populates in real time from the ledger — zero data entry ever |
| Generic chart of accounts you configure yourself | Pre-configured for a marketplace SaaS — no setup, works on day one |
| No concept of MRR, ARR, or churn | SaaS metrics are first-class — MRR waterfall, NRR, trial conversion |
| No concept of GMV or take rate | Marketplace metrics built in — GMV, gross take rate, net take rate |
| No burn rate or runway dashboard | Runway always visible on the executive dashboard |
| No unit economics | Cost per order, revenue per seller, gross margin per transaction |
| Bank reconciliation is painful and manual | Plaid integration for automatic transaction import and categorization |
| No budget vs actuals alerts | Variance alerts the moment a category exceeds threshold |
| No revenue forecasting tied to operations | Forecast built from actual GMV trend + MRR cohorts |
| Accountant-level tool — founders hate it | Executive-first design — Adrian opens this daily, not quarterly |
| $30-300/mo for what you need | Costs nothing — it's inside the platform you're already building |

**The three audiences:**
1. **Adrian (founder)** — executive dashboard daily. Runway, burn, MRR growth, take rate.
2. **CFO / finance lead** — P&L deep dive, budget vs actuals, quarterly tax estimates.
3. **Accountant (external)** — read-only access. Export to QB/Xero if they need it.

**Separation from the other systems:**
- `/my/finances` = seller's bookkeeping (their money)
- `/fin/*` = platform integrity (seller payouts, ledger, reconciliation)
- `/company/*` = Twicely Inc.'s finances (our money) ← this document

---

## 2. ACCESS CONTROL

**New staff role: `COMPANY_FINANCE`**

Added to the Actors & Security Canonical custom role system. This is the most sensitive role on the platform — Twicely's own financials.

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | Full read + write always |
| `COMPANY_FINANCE` | Full read + write on all `/company/*` routes |
| `COMPANY_FINANCE_READONLY` | Read-only on all `/company/*` routes (for external accountants) |
| All other roles | No access — `/company/*` returns 403 |

**Invariants:**
- Only `SUPER_ADMIN` can grant or revoke `COMPANY_FINANCE` and `COMPANY_FINANCE_READONLY`
- All actions audit logged at `HIGH` severity
- Financial report generation and QB/Xero export logged at `CRITICAL`
- Expense creation, edit, delete require 2FA for amounts > $10,000
- Budget changes require 2FA always

---

## 3. REVENUE (AUTO-POPULATED — ZERO ENTRY REQUIRED)

This is the feature that makes the system irreplaceable. Every dollar Twicely earns flows through the Finance Engine ledger. The Company Finances system reads that ledger directly. Revenue is always real-time, always accurate, always zero-touch.

### 3.1 Revenue Lines (Auto from Ledger)

| Revenue Line | Ledger Entry Type(s) | Account Code | Category |
|---|---|---|---|
| Transaction fees | `ORDER_TF_FEE` | 4000 | Marketplace Revenue |
| Boost fees | `ORDER_BOOST_FEE` | 4100 | Marketplace Revenue |
| Insertion fees | `INSERTION_FEE` | 4200 | Marketplace Revenue |
| Instant payout fees | `INSTANT_PAYOUT_FEE` | 4300 | Marketplace Revenue |
| Authentication margin | Auth fee − auth cost | 4400 | Marketplace Revenue |
| Store subscriptions | `STORE_SUBSCRIPTION_CHARGE` | 5000 | SaaS Revenue |
| Crosslister subscriptions | `LISTER_SUBSCRIPTION_CHARGE` | 5100 | SaaS Revenue |
| Finance subscriptions | `FINANCE_SUBSCRIPTION_CHARGE` | 5200 | SaaS Revenue |
| Automation add-on | `AUTOMATION_ADDON_CHARGE` | 5300 | SaaS Revenue |
| Bundle subscriptions | `BUNDLE_SUBSCRIPTION_CHARGE` | 5400 | SaaS Revenue |
| Overage charges | `OVERAGE_PACK_PURCHASE` | 5500 | SaaS Revenue |

### 3.2 Revenue Adjustments (Auto from Ledger)

| Adjustment | Ledger Entry Type(s) | Effect |
|---|---|---|
| TF refunded on returns | `REFUND_TF_REVERSAL` | Reduces TF revenue |
| Boost refunded on returns | `REFUND_BOOST_REVERSAL` | Reduces boost revenue |
| Subscription refunds | `SUBSCRIPTION_REFUND` | Reduces subscription revenue |
| Chargeback losses | `CHARGEBACK_DEBIT` | Reduces net revenue |
| Chargeback reversals won | `CHARGEBACK_REVERSAL` | Restores revenue |

### 3.3 Revenue Reporting Vocabulary

| Term | Definition |
|------|-----------|
| **Gross Revenue** | All fee and subscription income before any deductions |
| **Net Revenue** | Gross Revenue − refunded fees − chargebacks |
| **Marketplace Revenue** | TF + boost + insertion + instant payout + auth margin |
| **SaaS Revenue** | All subscription charges (store + lister + finance + automation + bundles + overages) |
| **MRR** | Monthly Recurring Revenue from active subscriptions, normalized to monthly |
| **ARR** | MRR × 12 |
| **GMV** | Gross Merchandise Value — total buyer payments through Twicely (not Twicely's revenue) |
| **Gross Take Rate** | TF collected / GMV × 100 — what % of marketplace volume Twicely keeps before costs |
| **Net Take Rate** | Net Revenue / GMV × 100 — after all cost-of-revenue deductions |

---

## 4. COST OF REVENUE (AUTO-POPULATED)

Costs that flow directly from Twicely operating the marketplace. Auto-logged from the ledger and provider systems.

| Cost Line | Source | Account Code | Auto? |
|---|---|---|---|
| Stripe processing fees (platform) | Stripe API / ledger | 6000 | ✅ |
| Absorbed return shipping | `BUYER_PROTECTION_LABEL_COST` | 6100 | ✅ |
| Buyer protection payouts absorbed | Ledger — BP claims paid | 6200 | ✅ |
| Goodwill credits issued | `MANUAL_CREDIT` (platform-initiated) | 6300 | ✅ |
| Affiliate commissions | `AFFILIATE_COMMISSION_PAYOUT` | 6400 | ✅ |
| Shippo API costs | Manual (Shippo invoices monthly) | 6500 | ❌ Manual |
| Authentication costs paid | Auth provider invoices | 6600 | ❌ Manual |

**Note on Shippo and Auth:** Shippo and authentication provider invoices are monthly. Enter them as recurring company expenses (§6.2). Future: direct API pull from Shippo invoices endpoint (post-launch optimization).

---

## 5. CHART OF ACCOUNTS (PRE-CONFIGURED)

No setup required. Pre-configured for a marketplace SaaS on day one. Admin can add sub-accounts but cannot delete system accounts.

```
INCOME
  4000  Transaction Fees
  4100  Boost Fees
  4200  Insertion Fees
  4300  Instant Payout Fees
  4400  Authentication Revenue
  5000  Subscription Revenue — Store
  5100  Subscription Revenue — Crosslister
  5200  Subscription Revenue — Finance
  5300  Subscription Revenue — Automation
  5400  Subscription Revenue — Bundles
  5500  Overage Revenue

COST OF REVENUE
  6000  Stripe Processing Fees
  6100  Return Shipping Absorbed
  6200  Buyer Protection Absorbed
  6300  Goodwill Credits
  6400  Affiliate Commissions
  6500  Shippo API Costs
  6600  Authentication Provider Costs

OPERATING EXPENSES — INFRASTRUCTURE
  7000  Hetzner (servers)
  7010  Cloudflare (R2, CDN, DNS)
  7020  Railway (deployments)
  7030  Infrastructure — Other

OPERATING EXPENSES — THIRD-PARTY APIs
  7100  Anthropic / Claude API
  7110  Mapbox (geocoding)
  7120  Resend (email)
  7130  Typesense (search)
  7140  Centrifugo (realtime)
  7150  Plaid (bank connections)
  7160  API — Other

OPERATING EXPENSES — PERSONNEL
  7200  Salaries — Full-time
  7210  Benefits
  7220  Contractors (1099)
  7230  Recruiting

OPERATING EXPENSES — PROFESSIONAL SERVICES
  7300  Legal
  7310  Accounting / CPA
  7320  Consulting

OPERATING EXPENSES — MARKETING
  7400  Paid Advertising
  7410  Content / Creative
  7420  Sponsorships / Influencer
  7430  Marketing — Other

OPERATING EXPENSES — SOFTWARE & TOOLS
  7500  SaaS Subscriptions
  7510  Development Tools
  7520  Design Tools
  7530  Software — Other

OPERATING EXPENSES — GENERAL & ADMIN
  7600  Insurance
  7610  Office / Coworking
  7620  Travel & Entertainment
  7630  Equipment & Hardware
  7640  G&A — Other
```

---

## 6. EXPENSE MANAGEMENT

### 6.1 Manual Expense Entry

For any cost not auto-populated from the ledger.

**Fields:**
- Account code (dropdown — chart of accounts)
- Category (auto-fills from account code, editable)
- Amount (cents — no floating point)
- Vendor (free text or from vendor list §9)
- Description
- Date
- Receipt / invoice attachment (R2 stored, max 25MB, PDF or image)
- Fiscal period (auto-filled from date, overridable)
- Notes (internal)
- Recurring? (toggle — if yes, sets up recurring entry §6.2)

**2FA gate:** Required for any single expense > $10,000.

### 6.2 Recurring Expenses

Set once, auto-created on schedule by BullMQ job.

- Frequency: monthly / quarterly / annual / custom (every N days)
- Start date + optional end date
- Generates an expense entry on each due date
- Entry includes a "Recurring" badge and link to the recurring rule
- Admin receives a notification 3 days before each auto-creation: "Recurring expense '$X to Vendor Y' will be logged on [date]. Edit or pause →"
- Cannot delete a recurring rule if it has generated entries — archive instead

**Primary recurring candidates:** Hetzner (monthly), Cloudflare (monthly), Anthropic API (monthly), Resend (monthly), legal retainer (monthly), accounting (monthly or annual), insurance (annual), SaaS tools (monthly/annual).

### 6.3 Vendor Invoice Tracking (Accounts Payable)

Route: `/company/vendors`

For vendors that send invoices before payment.

**Per invoice:**
- Vendor (from vendor list)
- Invoice number
- Amount (cents)
- Issue date
- Due date
- Status: `PENDING` / `APPROVED` / `PAID` / `OVERDUE`
- Attachment (invoice PDF)
- Payment date (set when marked PAID)
- Linked to expense entry on payment

**Automated:**
- Status auto-transitions to `OVERDUE` at midnight on due date if not paid
- Weekly email digest: "You have X invoices due in the next 14 days ($Y total)"
- OVERDUE invoices surface on the executive dashboard

### 6.4 Expense Bulk Import

CSV import for historical data or accountant handoff.
- Columns: `date, account_code, vendor, description, amount_cents, receipt_url`
- Validation: unknown account codes flagged, amounts must be integers
- Preview before commit: shows first 10 rows + error summary
- Successful import creates entries with `importedAt` timestamp

---

## 7. EXECUTIVE DASHBOARD (`/company`)

This is the screen Adrian opens every morning. Designed for a founder, not an accountant.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Twicely Financials              [This Month ▾]    [Export ▾]       │
└─────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASH & RUNWAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  Cash in Bank      │  │  Monthly Burn       │  │  Runway            │
│  $847,200          │  │  $42,800            │  │  19.8 months       │
│  Connected: Chase  │  │  ↘ -3% vs last mo  │  │  at current burn   │
│  Updated: 2min ago │  │  (trailing 3-mo)   │  │  ⚠️ <18mo target   │
└────────────────────┘  └────────────────────┘  └────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REVENUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  MRR               │  │  Net Revenue        │  │  MoM MRR Growth    │
│  $188,950          │  │  $406,200           │  │  +11.4%            │
│  ↗ +11.4% MoM     │  │  (this month)       │  │  ↗ accelerating    │
└────────────────────┘  └────────────────────┘  └────────────────────┘
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  GMV               │  │  Gross Take Rate   │  │  Net Take Rate     │
│  $4,063,400        │  │  10.2%             │  │  9.1%              │
│  ↗ +18% MoM       │  │  (TF / GMV)        │  │  after costs       │
└────────────────────┘  └────────────────────┘  └────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P&L SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌───────────────────────────────────────────────────────────────────┐
│  Gross Revenue      $414,860    ████████████████████████          │
│  Cost of Revenue     -$45,820   ████                              │
│  Gross Profit        $369,040   87.7% gross margin                │
│  Operating Expenses  -$326,240  ████████████████████              │
│  Net Income           $42,800   10.3% net margin   ✅ Profitable  │
└───────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAAS HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  NRR         │ │  Churn Rate  │ │  Rule of 40  │ │  Trial Conv. │
│  108%        │ │  2.1%/mo     │ │  Score: 51   │ │  Store: 34%  │
│  ✅ >100%    │ │  ⚠️ Target<2%│ │  ✅ >40      │ │  XList: 28%  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIT ECONOMICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Rev/Order    │ │ Cost/Order   │ │ Rev/Seller   │ │ Gross Margin │
│ $4.12        │ │ $0.38        │ │ $306.34      │ │ /Order: 90.8%│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUDGET STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Infrastructure:  $14,200 of $16,000 budget  [████████████░░░░]  89% ✅
  Personnel:      $245,000 of $260,000 budget  [████████████████░]  94% ✅
  Marketing:       $28,400 of $22,000 budget   [████████████████████] 129% ⚠️
  Legal:            $8,200 of $8,000 budget    [████████████████████] 103% ⚠️
  [View Full Budget →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  Marketing budget exceeded by $6,400 this month
  ⚠️  Q2 estimated tax payment due in 14 days ($38,400 estimated)
  📋  3 invoices awaiting approval ($24,800 total)
  📋  2 contractor payments due this week ($8,500 total)
  ✅  Bank reconciliation: current (last synced 2 hours ago)
```

**Dashboard rules:**
- Cash card: live from Plaid (auto-refresh every 15min during business hours)
- Burn rate: trailing 3-month average of net cash outflow, updated nightly
- Runway = Cash / Burn rate. Alert colors: green >18mo, yellow 12-18mo, red <12mo
- Revenue cards: real-time from ledger
- MRR: computed from active subscription records (same source as `/fin/mrr`)
- P&L snapshot: current period, refreshed hourly
- Budget status: any category >110% budget shows ⚠️, >125% shows 🔴
- Action items: live — resolved items disappear automatically

---

## 8. ROUTES (COMPLETE)

| Route | Title | Description |
|-------|-------|-------------|
| `/company` | Company Overview | Executive dashboard per §7 |
| `/company/pl` | Profit & Loss | Full P&L with period selector, YoY, export |
| `/company/balance` | Balance Sheet | Assets, liabilities, equity |
| `/company/cashflow` | Cash Flow | Operating, investing, financing activities |
| `/company/revenue` | Revenue Deep Dive | All revenue lines, MRR waterfall, cohort analysis |
| `/company/expenses` | Expenses | All company expenses — manual entry, list, bulk import |
| `/company/budget` | Budget vs Actuals | Annual budget, monthly variance, reforecast |
| `/company/forecast` | Forecast & Runway | Revenue + expense forecast, scenario planning |
| `/company/vendors` | Vendors & AP | Vendor management, invoice tracking, AP aging |
| `/company/contractors` | Contractors | 1099 contractor tracking, payment log |
| `/company/tax` | Tax Center | Quarterly estimates, annual summary, nexus tracking |
| `/company/bank` | Bank & Reconciliation | Connected accounts, transaction import, matching |
| `/company/reports` | Reports | Generate and download all financial reports |
| `/company/settings` | Settings | Chart of accounts, fiscal year, integrations, access |

---

## 9. FULL P&L STATEMENT (`/company/pl`)

**Period selector:** This Month / Last Month / This Quarter / Last Quarter / YTD / Last Year / Custom Range
**YoY toggle:** Adds "vs same period last year" column when enabled
**Export:** PDF (formatted, branded) + CSV (accountant-ready)

```
═══════════════════════════════════════════════════════════════════
  TWICELY INC. — PROFIT & LOSS
  January 2026  |  Generated Jan 31, 2026  |  [Export PDF] [CSV]
═══════════════════════════════════════════════════════════════════

REVENUE
  Marketplace Revenue
    Transaction Fees (TF):                    $312,400    ← auto
    Boost Fees:                                $48,200    ← auto
    Insertion Fees:                             $9,860    ← auto
    Instant Payout Fees:                        $2,800    ← auto
    Authentication Revenue (margin):            $3,400    ← auto
  Total Marketplace Revenue:                  $376,660

  SaaS Revenue
    Store Subscriptions:                       $14,820    ← auto
    Crosslister Subscriptions:                     $11,940    ← auto
    Finance Subscriptions:                      $3,200    ← auto
    Automation Add-On:                          $2,840    ← auto
    Bundle Subscriptions:                       $5,400    ← auto
  Total SaaS Revenue:                          $38,200
                                              ────────
Gross Revenue:                               $414,860

REVENUE ADJUSTMENTS
  TF Refunded (returns):                       -$4,200    ← auto
  Boost Refunded (returns):                      -$800    ← auto
  Subscription Refunds:                          -$400    ← auto
  Chargebacks (net):                           -$4,060    ← auto
                                              ────────
Net Revenue:                                 $405,400

COST OF REVENUE
  Stripe Processing Fees:                     -$12,445    ← auto
  Shippo API (January invoice):               -$14,200    ← manual
  Authentication Provider (January):          -$11,800    ← manual
  Absorbed Return Shipping:                    -$2,840    ← auto
  Buyer Protection Absorbed:                   -$1,200    ← auto
  Goodwill Credits Issued:                       -$840    ← auto
  Affiliate Commissions:                       -$2,495    ← auto
                                              ────────
Total Cost of Revenue:                       -$45,820

Gross Profit:                                $359,580    (87.9% margin)

OPERATING EXPENSES

  Infrastructure
    Hetzner:                                  -$4,200    ← recurring
    Cloudflare:                               -$1,840    ← recurring
    Railway:                                  -$3,100    ← recurring
    Other:                                    -$5,060    ← manual
  Total Infrastructure:                      -$14,200

  Third-Party APIs
    Anthropic / Claude API:                   -$1,240    ← recurring
    Mapbox:                                     -$420    ← recurring
    Resend:                                     -$380    ← recurring
    Typesense:                                  -$290    ← recurring
    Centrifugo:                                 -$180    ← recurring
    Plaid:                                      -$310    ← recurring
  Total APIs:                                 -$2,820

  Personnel
    Salaries:                               -$198,000    ← recurring
    Benefits:                               -$29,700     ← recurring
    Contractors (1099):                     -$17,300     ← manual
  Total Personnel:                         -$245,000

  Professional Services
    Legal:                                   -$8,200    ← manual
    Accounting / CPA:                        -$2,400    ← recurring
  Total Professional:                       -$10,600

  Marketing
    Paid Advertising:                        -$18,400    ← manual
    Content / Creative:                       -$6,200    ← manual
    Influencer / Sponsorships:               -$3,800    ← manual
  Total Marketing:                          -$28,400

  Software & Tools:                          -$8,420    ← recurring
  Insurance:                                 -$3,200    ← recurring
  G&A Other:                                -$13,600    ← manual
                                            ────────
Total Operating Expenses:                  -$326,240
                                            ════════
NET INCOME:                                  $42,800   (10.3% net margin)
═══════════════════════════════════════════════════════════════════
  [auto] = populated automatically from Twicely's ledger / systems
  [recurring] = auto-created from recurring expense rules
  [manual] = entered by finance team

  Cash: $847,200  |  Burn Rate: $42,800/mo  |  Runway: 19.8 months
═══════════════════════════════════════════════════════════════════
```

---

## 10. REVENUE DEEP DIVE (`/company/revenue`)

The page that answers "where is our money actually coming from and is it healthy?"

### 10.1 Revenue Mix Chart

Stacked bar chart — monthly. Shows Marketplace vs SaaS split over time.
- Target: SaaS grows as % of total (higher quality, more predictable)
- Alert if Marketplace revenue drops >20% MoM without corresponding GMV drop (take rate issue)

### 10.2 MRR Waterfall (Monthly)

```
January 2026 MRR Movement
───────────────────────────────────────────────────────────
Starting MRR:         $169,580
  + New MRR:          +$24,340    (new subscribers)
  + Expansion MRR:     +$8,120    (upgrades)
  - Contraction MRR:   -$6,240    (downgrades)
  - Churned MRR:       -$6,850    (cancellations)
                       ────────
Ending MRR:           $188,950    (+$19,370, +11.4%)
───────────────────────────────────────────────────────────
Net MRR Change: +$19,370  |  Net Revenue Retention: 108%
```

### 10.3 SaaS Health Metrics (Definitions)

All computed from active subscription records + ledger. Never manually entered.

| Metric | Formula | Target |
|--------|---------|--------|
| **MRR** | Σ(active subscription monthly values) | — |
| **ARR** | MRR × 12 | — |
| **New MRR** | Revenue from new subscriptions started this month | Positive always |
| **Expansion MRR** | Revenue from tier upgrades this month | Positive always |
| **Contraction MRR** | Revenue lost from downgrades this month | Minimize |
| **Churned MRR** | Revenue lost from cancellations this month | Minimize |
| **Net MRR Change** | New + Expansion − Contraction − Churned | Positive |
| **NRR (Net Revenue Retention)** | (Starting MRR + Expansion − Contraction − Churn) / Starting MRR × 100 | >100% |
| **GRR (Gross Revenue Retention)** | (Starting MRR − Contraction − Churn) / Starting MRR × 100 | >85% |
| **Logo Churn Rate** | Cancelled subscribers / Starting active subscribers × 100 | <2%/mo |
| **Revenue Churn Rate** | Churned MRR / Starting MRR × 100 | <3%/mo |
| **Trial Conversion Rate** | Trials converted to paid / Trials started (same cohort) × 100 | >30% |
| **Rule of 40** | MoM Revenue Growth % + Net Margin % | >40 (healthy SaaS) |

### 10.4 Marketplace Revenue Metrics

| Metric | Formula |
|--------|---------|
| **GMV** | Σ(buyer payments) for period |
| **Gross Take Rate** | TF collected / GMV × 100 |
| **Net Take Rate** | Net Revenue / GMV × 100 (after all cost-of-revenue) |
| **Revenue per Transaction** | Net Revenue / Order count |
| **Revenue per Active Seller** | Net Revenue / Active seller count |
| **Effective TF Rate** | Blended TF across all bracket levels (shows how progressive schedule plays out at scale) |

### 10.5 Cohort Revenue Analysis (Monthly Cohort Table)

Which seller signup cohorts are generating the most lifetime revenue?

| Signup Cohort | Cohort Size | Avg Revenue Mo 1 | Mo 3 | Mo 6 | Mo 12 | Retention % |
|---|---|---|---|---|---|---|
| Jan 2025 | 482 | $18.40 | $22.10 | $28.40 | $34.20 | 71% |
| Feb 2025 | 394 | $19.20 | $23.40 | $29.80 | — | 68% |
| Mar 2025 | 521 | $22.10 | $26.40 | — | — | — |

This is the data for LTV calculation. LTV = average monthly revenue × average customer lifetime in months.

---

## 11. BUDGET VS ACTUALS (`/company/budget`)

### 11.1 Annual Budget Creation

- Create budget at start of fiscal year (or any time with versioning)
- Enter annual amount per account code
- Monthly allocation: equal split by default, or custom monthly amounts
- Version history: every save creates a version. Prior versions read-only. Active version clearly marked.
- Reforecast: create a new version mid-year with "Reforecast Q2 2026" label

### 11.2 Variance Display

```
BUDGET vs ACTUALS — January 2026                    [Full Year ▾]

Account                  Budget      Actual      Variance    % Used
─────────────────────────────────────────────────────────────────
OPERATING EXPENSES
  Infrastructure        $16,000     $14,200     -$1,800      89% ✅
  APIs                   $3,200      $2,820       -$380      88% ✅
  Personnel            $260,000    $245,000    -$15,000      94% ✅
  Professional          $10,000     $10,600      +$600      106% ⚠️
  Marketing             $22,000     $28,400     +$6,400      129% 🔴
  Software               $9,000      $8,420       -$580      94% ✅
  Insurance              $3,200      $3,200          $0     100% ✅
  G&A                   $15,000     $13,600     -$1,400      91% ✅
─────────────────────────────────────────────────────────────────
Total OpEx            $338,400    $326,240    -$12,160      97% ✅

Revenue Target        $380,000    $414,860    +$34,860      109% ✅ Above
Net Income Target      $41,600     $42,800     +$1,200      103% ✅ Above
```

**Alert rules:**
- Any category >110% of monthly budget: yellow ⚠️ — email to COMPANY_FINANCE users
- Any category >125%: red 🔴 — email + in-dashboard banner + action required
- Revenue below 90% of target: ⚠️ alert
- Net income below 80% of target: 🔴 alert

### 11.3 Full-Year Budget Pace

"At your current run rate, you'll end the year with:
- Revenue: $4.97M (vs $4.56M budget — 9% above) ✅
- Operating Expenses: $3.91M (vs $4.06M budget — 4% under) ✅
- Net Income: $512K (vs $337K budget — 52% above) ✅"

---

## 12. FORECAST & RUNWAY (`/company/forecast`)

### 12.1 Revenue Forecast

Built from two components — auto-computed nightly:

**Marketplace revenue forecast:**
- Input: trailing 90-day GMV growth rate
- Apply growth rate to current GMV baseline
- Apply current gross take rate
- Output: projected marketplace revenue for next 3/6/12 months

**SaaS revenue forecast:**
- Input: starting MRR + trailing 3-month avg MRR growth rate (new − churn)
- Project forward: MRR(month+1) = MRR(month) × (1 + MoM growth rate)
- Output: projected MRR/ARR for next 12 months

**Combined forecast line:** Marketplace + SaaS projected revenue by month.

### 12.2 Expense Forecast

- Recurring expenses: exact (known amounts, known dates)
- Variable expenses (infrastructure, API): trend from trailing 3 months, scaled by projected GMV growth
- Personnel: manually entered headcount plan (admin inputs planned hires + dates)
- One-time expenses: manually flagged with expected month

### 12.3 Scenario Planning

Three scenarios side-by-side. Admin sets assumptions for each.

| Scenario | GMV Growth Rate | Churn Rate | Hiring Plan |
|---|---|---|---|
| **Bear** | +5%/mo | 4%/mo | No new hires |
| **Base** | +11%/mo | 2%/mo | Current plan |
| **Bull** | +18%/mo | 1%/mo | Accelerated |

Each scenario shows: projected revenue, projected expenses, net income, runway, time to profitability (if not yet profitable).

### 12.4 Runway Dashboard

```
CASH RUNWAY ANALYSIS
─────────────────────────────────────────────────────────────
Current Cash:             $847,200
Trailing 3-Month Burn:     $42,800/mo (net cash outflow)

At current burn rate:     19.8 months runway

Scenarios:
  Bear (burn $68K/mo):    12.5 months  🔴  (fundraise trigger)
  Base (burn $42.8K/mo):  19.8 months  ✅
  Bull (revenue > burn):  Profitable in 2.1 months  🚀

Fundraising trigger:      < 12 months runway
Current status:           ✅ No immediate action needed
─────────────────────────────────────────────────────────────
Cash balance updated via Plaid every 15 minutes.
Burn rate recalculated nightly from trailing 3-month actuals.
```

**Fundraising trigger:** Admin sets a runway threshold (default: 12 months). When projected runway crosses below threshold in any scenario, email alert fires to all `COMPANY_FINANCE` + `SUPER_ADMIN` users: "⚠️ Bear scenario runway drops below 12 months. Review forecast."

---

## 13. VENDOR MANAGEMENT (`/company/vendors`)

### 13.1 Vendor Record

| Field | Notes |
|-------|-------|
| Name | Required |
| EIN (Tax ID) | Encrypted at rest — AES-256-GCM |
| Contact name + email | For remittance advice |
| Payment terms | Net-30, Net-15, Due on receipt, etc. |
| Payment method | ACH, wire, check, card |
| Bank account (last 4) | For verification |
| Category | Maps to chart of accounts |
| Active / Inactive | Inactive vendors archived, not deleted |
| Notes | Internal only |

### 13.2 AP Aging Report

```
ACCOUNTS PAYABLE AGING — as of January 31, 2026

Vendor              Current    1-30 days   31-60 days  60+ days
──────────────────────────────────────────────────────────────────
Hetzner             $4,200                                       ← paid on time
Legal Partners                  $8,200                           ← due Feb 14
Design Agency                              $3,400                ← ⚠️ overdue
Old Contractor                                          $1,200   ← 🔴 60+ days
──────────────────────────────────────────────────────────────────
Total              $4,200       $8,200      $3,400       $1,200
```

---

## 14. CONTRACTOR TRACKING (`/company/contractors`)

### 14.1 Contractor Record

| Field | Notes |
|-------|-------|
| Name | Legal name for 1099 |
| EIN / SSN | Encrypted — required for 1099 |
| Email | For payment notifications |
| Service type | Development / Design / Legal / Marketing / Other |
| Rate | Hourly, project, or monthly retainer |
| Status | Active / Inactive |
| W-9 on file | Boolean — required before first payment |

### 14.2 Payment Logging

Each payment logged with: amount, date, description, invoice number. Running YTD total displayed prominently.

### 14.3 1099-NEC Tracking

At year end:
- Any contractor with YTD payments ≥ $600 flagged: "1099-NEC required"
- Export: contractor name, EIN, total payments — formatted for CPA handoff
- Admin notification on December 1: "X contractors are approaching or have passed the $600 1099 threshold"

```
1099 SUMMARY — Tax Year 2026

Contractor             YTD Payments    1099 Required?
────────────────────────────────────────────────────
Jane Smith (Dev)         $24,500       ✅ Required
Bob Jones (Design)        $8,400       ✅ Required
ABC Legal LLC            $12,200       ✅ Required
New Freelancer              $340       ❌ Under $600
────────────────────────────────────────────────────
[Export 1099 Data for CPA →]
```

---

## 15. TAX CENTER (`/company/tax`)

**Not tax advice. Twicely tracks the data — the accountant does the filing.**

### 15.1 Quarterly Estimated Tax Tracker

Federal estimated taxes are due quarterly. Twicely tracks and reminds.

| Quarter | Period | Due Date | Estimated | Paid | Status |
|---------|--------|----------|-----------|------|--------|
| Q1 2026 | Jan–Mar | Apr 15 | $38,400 | $38,400 | ✅ Paid |
| Q2 2026 | Apr–Jun | Jun 16 | $41,200 | — | ⚠️ Due in 14 days |
| Q3 2026 | Jul–Sep | Sep 15 | — | — | 📋 Not yet due |
| Q4 2026 | Oct–Dec | Jan 15 '27 | — | — | 📋 Not yet due |

**Estimated amount calculation:** Based on prior year tax ÷ 4 (safe harbor method), or current year net income YTD × estimated tax rate (admin configures). The admin always reviews before treating as final — this is a rough estimate, not tax advice.

**Reminders:** 30 days before due date + 7 days before due date.

### 15.2 Annual Tax Summary

Generated December 31 for the full year:
- Total revenue by line item
- Total expenses by category
- Net income
- Contractor payments (1099 summary)
- Available for Payout liability (relevant for tax treatment)
- PDF + CSV export for CPA

### 15.3 Sales Tax Nexus Tracker

Track which states Twicely has economic nexus in (matters for marketplace facilitator laws).

| State | Nexus Trigger | Threshold | Current GMV YTD | Status |
|-------|--------------|-----------|-----------------|--------|
| NY | Economic | $500K or 100 transactions | $340,000 | ⚠️ Approaching |
| CA | Economic | $500K | $890,000 | 🔴 Nexus established |
| TX | Economic | $500K | $120,000 | ✅ Below threshold |

**Note:** Marketplace facilitator laws vary by state. Twicely may be required to collect and remit sales tax on behalf of sellers in certain states. This tracker surfaces the thresholds — legal reviews the obligations. Not a substitute for a sales tax attorney.

---

## 16. BANK & RECONCILIATION (`/company/bank`)

### 16.1 Plaid Integration

- Connect company bank accounts and credit cards via Plaid Link
- Transactions auto-imported within 15 minutes of posting
- Balance updated in real time (refreshed every 15 min during business hours)
- Multi-account: connect as many accounts as needed (operating, payroll, savings, card)

**Supported:** All major US banks and credit unions via Plaid.

**Credentials:** Plaid access tokens encrypted at rest — AES-256-GCM via provider abstraction. Usage key: `company-banking`.

### 16.2 Transaction Categorization

Each imported bank transaction goes through three layers:

1. **Auto-match:** If the amount + vendor + date matches an existing company expense entry within ±3 days → auto-matched, marked reconciled
2. **AI-assist (Claude):** Unmatched transactions passed to Claude with description + amount → returns suggested account code + category. Confidence threshold: same as receipt scanning (85% auto-apply, 60-84% confirm, <60% manual)
3. **Manual review:** Unmatched transactions surface in a review queue

**Review queue columns:** Date, Description, Amount, Suggested Category, Match / Create Expense / Ignore

### 16.3 Reconciliation

- Any period where bank balance ≠ sum of matched transactions is flagged
- Monthly reconciliation report generated automatically on the 1st
- Unreconciled items older than 30 days: alert to COMPANY_FINANCE users

---

## 17. REPORTS (`/company/reports`)

All reports available as PDF (formatted, branded) and CSV (raw data for accountants).

| Report | Description | Period Options |
|--------|-------------|---------------|
| Profit & Loss | Full income statement | Monthly / Quarterly / Annual / Custom |
| Balance Sheet | Assets, liabilities, equity snapshot | Point in time |
| Cash Flow Statement | Operating / investing / financing | Monthly / Quarterly / Annual |
| Budget vs Actuals | Variance by category | Monthly / YTD / Annual |
| Executive Summary | One-page KPI snapshot | Monthly |
| Revenue Detail | All revenue lines with ledger source | Any period |
| Expense Detail | All expenses with category, vendor | Any period |
| Contractor / 1099 Summary | Payments by contractor | Annual (tax year) |
| Tax Summary | Full year P&L formatted for CPA | Annual |
| AP Aging | Outstanding invoices by age | Point in time |

**Report generation:** PDF generated server-side (Puppeteer or similar), stored in R2, signed URL returned for download. Retained for 7 years per financial record retention policy.

---

## 18. QUICKBOOKS / XERO EXPORT (`/company/settings` → Integrations tab)

The goal is to never need this. But if your accountant lives in QB or an auditor demands it:

**QuickBooks Online export:**
- OAuth2 connection
- Map Twicely account codes → QB chart of accounts (one-time mapping, saved)
- Export any period: creates QB journal entries from Twicely P&L data
- Conflict resolution: QB is the receiver — Twicely data overwrites
- De-duplicate on Twicely transaction ID

**Xero export:**
- Same model, maps to Xero chart of accounts

**Manual export:**
- Standard journal entry CSV (works with any accounting system)
- QB IIF format (legacy QuickBooks desktop)

**The point:** These exports exist for compliance and accountant handoff. The actual financial management happens in Twicely. The accountant gets data out of Twicely for their purposes — not the other way around.

---

## 19. SCHEMA (NEW TABLES)

All tables prefixed with `company_` to distinguish from seller/platform tables.

```typescript
// Company expense (manual + recurring auto-created)
export const companyExpense = pgTable('company_expense', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  accountCode:         text('account_code').notNull(),          // From chart of accounts
  category:            text('category').notNull(),
  amountCents:         integer('amount_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  vendor:              text('vendor'),
  vendorId:            text('vendor_id').references(() => companyVendor.id),
  description:         text('description'),
  date:                date('date').notNull(),
  receiptUrl:          text('receipt_url'),                     // R2 stored
  fiscalYear:          integer('fiscal_year').notNull(),
  fiscalMonth:         integer('fiscal_month').notNull(),        // 1-12
  isRecurring:         boolean('is_recurring').notNull().default(false),
  recurringExpenseId:  text('recurring_expense_id').references(() => companyRecurringExpense.id),
  bankTransactionId:   text('bank_transaction_id').references(() => companyBankTransaction.id),
  isAutoLogged:        boolean('is_auto_logged').notNull().default(false),
  autoLogSourceType:   text('auto_log_source_type'),            // 'ledger_entry' | 'plaid' | 'recurring'
  autoLogSourceId:     text('auto_log_source_id'),
  notes:               text('notes'),
  createdByStaffId:    text('created_by_staff_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  fiscalIdx:  index('ce_fiscal').on(table.fiscalYear, table.fiscalMonth),
  dateIdx:    index('ce_date').on(table.date),
  accountIdx: index('ce_account').on(table.accountCode),
}));

// Recurring company expense
export const companyRecurringExpense = pgTable('company_recurring_expense', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  accountCode:  text('account_code').notNull(),
  category:     text('category').notNull(),
  amountCents:  integer('amount_cents').notNull(),
  vendor:       text('vendor'),
  vendorId:     text('vendor_id').references(() => companyVendor.id),
  description:  text('description'),
  frequency:    text('frequency').notNull(),   // 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM'
  customDays:   integer('custom_days'),         // if frequency = CUSTOM
  startDate:    date('start_date').notNull(),
  endDate:      date('end_date'),              // null = no end
  isActive:     boolean('is_active').notNull().default(true),
  lastCreatedAt: date('last_created_at'),
  createdByStaffId: text('created_by_staff_id'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Vendor
export const companyVendor = pgTable('company_vendor', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  name:            text('name').notNull(),
  ein_encrypted:   text('ein_encrypted'),                // AES-256-GCM
  contactName:     text('contact_name'),
  contactEmail:    text('contact_email'),
  paymentTerms:    text('payment_terms'),                // 'NET_30' | 'NET_15' | 'DUE_ON_RECEIPT' | 'CUSTOM'
  paymentMethod:   text('payment_method'),               // 'ACH' | 'WIRE' | 'CHECK' | 'CARD'
  bankAccountLast4: text('bank_account_last4'),
  defaultAccountCode: text('default_account_code'),
  isActive:        boolean('is_active').notNull().default(true),
  notes:           text('notes'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Vendor invoice (AP)
export const companyVendorInvoice = pgTable('company_vendor_invoice', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  vendorId:       text('vendor_id').notNull().references(() => companyVendor.id),
  invoiceNumber:  text('invoice_number'),
  amountCents:    integer('amount_cents').notNull(),
  issueDate:      date('issue_date').notNull(),
  dueDate:        date('due_date').notNull(),
  paidAt:         date('paid_at'),
  status:         text('status').notNull().default('PENDING'), // PENDING|APPROVED|PAID|OVERDUE
  description:    text('description'),
  attachmentUrl:  text('attachment_url'),
  linkedExpenseId: text('linked_expense_id').references(() => companyExpense.id),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Contractor
export const companyContractor = pgTable('company_contractor', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  name:            text('name').notNull(),
  ein_encrypted:   text('ein_encrypted'),                // EIN or SSN — AES-256-GCM
  email:           text('email'),
  serviceType:     text('service_type').notNull(),        // DEVELOPMENT|DESIGN|LEGAL|MARKETING|OTHER
  rateType:        text('rate_type'),                     // HOURLY | PROJECT | MONTHLY
  rateCents:       integer('rate_cents'),
  w9OnFile:        boolean('w9_on_file').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
  notes:           text('notes'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Contractor payment
export const companyContractorPayment = pgTable('company_contractor_payment', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  contractorId:   text('contractor_id').notNull().references(() => companyContractor.id),
  amountCents:    integer('amount_cents').notNull(),
  paymentDate:    date('payment_date').notNull(),
  description:    text('description'),
  invoiceNumber:  text('invoice_number'),
  taxYear:        integer('tax_year').notNull(),
  linkedExpenseId: text('linked_expense_id').references(() => companyExpense.id),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Annual budget
export const companyBudget = pgTable('company_budget', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  fiscalYear:       integer('fiscal_year').notNull(),
  version:          integer('version').notNull().default(1),
  label:            text('label'),                        // "Original", "Reforecast Q2", etc.
  isActive:         boolean('is_active').notNull().default(false),
  notes:            text('notes'),
  createdByStaffId: text('created_by_staff_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  yearVersionIdx: unique().on(table.fiscalYear, table.version),
}));

// Budget line (per account code per month)
export const companyBudgetLine = pgTable('company_budget_line', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  budgetId:     text('budget_id').notNull().references(() => companyBudget.id),
  accountCode:  text('account_code').notNull(),
  category:     text('category').notNull(),
  annualCents:  integer('annual_cents').notNull(),
  jan:          integer('jan').notNull(),
  feb:          integer('feb').notNull(),
  mar:          integer('mar').notNull(),
  apr:          integer('apr').notNull(),
  may:          integer('may').notNull(),
  jun:          integer('jun').notNull(),
  jul:          integer('jul').notNull(),
  aug:          integer('aug').notNull(),
  sep:          integer('sep').notNull(),
  oct:          integer('oct').notNull(),
  nov:          integer('nov').notNull(),
  dec:          integer('dec').notNull(),
}, (table) => ({
  budgetAccountIdx: unique().on(table.budgetId, table.accountCode),
}));

// Bank account (Plaid)
export const companyBankAccount = pgTable('company_bank_account', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  institutionName:       text('institution_name').notNull(),
  accountName:           text('account_name').notNull(),
  accountType:           text('account_type').notNull(),   // CHECKING|SAVINGS|CREDIT|INVESTMENT
  accountLast4:          text('account_last4').notNull(),
  plaidItemId:           text('plaid_item_id').notNull(),
  plaidAccessToken_encrypted: text('plaid_access_token_encrypted').notNull(),
  plaidAccountId:        text('plaid_account_id').notNull(),
  balanceCents:          integer('balance_cents'),
  balanceUpdatedAt:      timestamp('balance_updated_at', { withTimezone: true }),
  lastSyncAt:            timestamp('last_sync_at', { withTimezone: true }),
  isActive:              boolean('is_active').notNull().default(true),
  isPrimary:             boolean('is_primary').notNull().default(false),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Bank transaction (from Plaid)
export const companyBankTransaction = pgTable('company_bank_transaction', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  bankAccountId:       text('bank_account_id').notNull().references(() => companyBankAccount.id),
  plaidTransactionId:  text('plaid_transaction_id').notNull().unique(),
  amountCents:         integer('amount_cents').notNull(),   // positive = debit, negative = credit
  date:                date('date').notNull(),
  description:         text('description').notNull(),
  merchantName:        text('merchant_name'),
  plaidCategory:       text('plaid_category'),
  suggestedAccountCode: text('suggested_account_code'),
  suggestedConfidence: integer('suggested_confidence'),      // 0-100
  isMatched:           boolean('is_matched').notNull().default(false),
  matchedExpenseId:    text('matched_expense_id').references(() => companyExpense.id),
  isIgnored:           boolean('is_ignored').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tax estimate (quarterly)
export const companyTaxEstimate = pgTable('company_tax_estimate', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  taxYear:              integer('tax_year').notNull(),
  quarter:              integer('quarter').notNull(),         // 1-4
  jurisdiction:         text('jurisdiction').notNull(),       // 'FEDERAL' | state code
  dueDate:              date('due_date').notNull(),
  estimatedAmountCents: integer('estimated_amount_cents'),
  paidAmountCents:      integer('paid_amount_cents'),
  paidAt:               date('paid_at'),
  notes:                text('notes'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  yearQuarterIdx: unique().on(table.taxYear, table.quarter, table.jurisdiction),
}));

// Company financial projection (nightly cache)
export const companyForecast = pgTable('company_forecast', {
  id:                        text('id').primaryKey().$defaultFn(() => createId()),
  scenario:                  text('scenario').notNull(),      // 'BEAR' | 'BASE' | 'BULL'
  periodStart:               date('period_start').notNull(),
  periodEnd:                 date('period_end').notNull(),     // 12 months forward
  projectedRevenueCents:     integer('projected_revenue_cents'),
  projectedExpensesCents:    integer('projected_expenses_cents'),
  projectedNetIncomeCents:   integer('projected_net_income_cents'),
  projectedRunwayMonths:     integer('projected_runway_months'),
  assumptionsJson:           jsonb('assumptions_json'),
  computedAt:                timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 20. BACKGROUND JOBS (BULLMQ)

| Job | Schedule | What it does |
|-----|----------|-------------|
| `company:revenue:sync` | Hourly | Pull ledger entries since last sync → update company revenue records |
| `company:recurring:create` | Daily 6:00 AM UTC | Create expense entries for due recurring rules, notify 3 days before |
| `company:forecast:compute` | Nightly 2:00 AM UTC | Rebuild all three scenario forecasts, update runway |
| `company:bank:sync` | Every 15 min (business hours) | Plaid transaction pull, update balances |
| `company:bank:categorize` | After each sync | Run Claude categorization on unmatched transactions |
| `company:invoice:overdue` | Daily midnight | Flip PENDING invoices to OVERDUE past due date |
| `company:budget:alert` | Daily 8:00 AM UTC | Check all categories against budget, send alerts for >110% |
| `company:tax:reminder` | 30d + 7d before due date | Quarterly estimated tax due date reminders |
| `company:1099:alert` | December 1 annually | Flag contractors approaching/at $600 threshold |
| `company:reconcile` | Monthly, 1st of month | Reconciliation report — unmatched transactions >30 days |

---

## 21. PLATFORM SETTINGS

```
# Access
company.finance.runwayAlertMonths: 12          # Threshold for fundraising alert
company.finance.budgetAlertPctYellow: 110      # % of budget that triggers yellow warning
company.finance.budgetAlertPctRed: 125         # % of budget that triggers red alert

# Tax
company.finance.taxEstimateMethod: "safe_harbor" # or "current_year"
company.finance.estimatedTaxRate: 21           # Federal corporate rate estimate

# Bank
company.finance.plaidUsageKey: "company-banking"
company.finance.bankSyncIntervalMinutes: 15
company.finance.bankCategorizationConfidenceAuto: 85
company.finance.bankCategorizationConfidenceConfirm: 60

# Contractors
company.finance.contractor1099ThresholdCents: 60000  # $600 in cents
company.finance.contractor1099AlertDayOfYear: 335    # December 1

# Fiscal year
company.finance.fiscalYearStartMonth: 1        # 1 = January (calendar year)

# Retention
company.finance.recordRetentionYears: 7        # IRS minimum for business records
```

---

## 22. AUDIT CHECKLIST (E3 Build)

- [ ] All `/company/*` routes return 403 for any role except COMPANY_FINANCE + SUPER_ADMIN
- [ ] Revenue cards pull from ledger in real time — zero manual entry ever for revenue
- [ ] `company_expense` entries created by ledger sync have `isAutoLogged = true` and are not editable
- [ ] Recurring expense creation job runs daily — creates entry, logs `lastCreatedAt`
- [ ] Cash / runway card refreshes from Plaid balance — not from manual entry
- [ ] Burn rate: trailing 3-month average of net cash outflow from bank data, not estimated
- [ ] Budget variance alerts fire at 110% (yellow) and 125% (red) — email + dashboard
- [ ] Forecast rebuilds nightly for all 3 scenarios — never computed on page request
- [ ] 2FA required for expenses > $10,000 and all budget changes
- [ ] EIN / SSN / Plaid tokens all encrypted at rest (AES-256-GCM) via provider abstraction
- [ ] All actions audit logged at HIGH severity; report generation at CRITICAL
- [ ] QB/Xero export available but clearly secondary — the data flows Twicely → QB, never QB → Twicely
- [ ] 1099 alert fires December 1 for contractors ≥ $600 YTD
- [ ] Invoice status auto-transitions to OVERDUE at midnight on due date
- [ ] New routes added to Page Registry before E3 build begins
- [ ] New COMPANY_FINANCE and COMPANY_FINANCE_READONLY roles added to Actors & Security Canonical
- [ ] Test count increases from pre-E3 baseline — never decreases

---

*End of Company Finances Canonical v1.0*
*System 3 of 3: User Financial Center (v2.0) | Platform Integrity (/fin/*) | Company Finances (/company/*)*
*Build phase: E3 | Next review: After E3 complete, before first board deck*
