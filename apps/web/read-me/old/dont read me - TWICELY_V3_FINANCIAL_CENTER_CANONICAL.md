# TWICELY V3 — Financial Center Canonical

**Version:** v1.0 | **Date:** 2026-02-17 | **Status:** LOCKED
**Formerly:** Analytics Canonical (renamed — scope expanded from reporting to full bookkeeping)

---

## 1. CONCEPT

Full resale business operating system. Sellers never open QuickBooks or a spreadsheet. Twicely auto-populates sales data from marketplace + crosslister, plus manual expense tracking, receipt scanning, mileage logging, and P&L generation.

**Not just reporting** — this is the 4th product axis (independent subscription: FREE/PRO only).

---

## 2. AUTO-POPULATED DATA (Zero Setup)

| Source | Data | How |
|--------|------|-----|
| Twicely sales | Revenue, TF, Stripe fees, shipping costs | Automatic from order completion |
| Crosslister eBay sales | Sale price, eBay fees | Auto from sale detection (F5) |
| Crosslister Poshmark sales | Sale price, Poshmark 20% fee | Auto from sale detection |
| Crosslister Mercari sales | Sale price, Mercari fees | Auto from sale detection |
| Local sales | Sale price, local fee | Auto from order completion |
| Subscriptions | Monthly charges | Auto from Stripe billing |
| Shipping labels | Label cost per order | Auto from Shippo |
| Authentication fees | Auth cost per item | Auto from auth request |
| Insertion fees | Per-listing fees | Auto from billing |

---

## 3. MANUAL ENTRY FEATURES

### Expense Tracking (PRO)
- 16 preset categories: Shipping Supplies, Packaging, Equipment, Software/Subscriptions, Mileage, Storage/Rent, Sourcing Trips, Photography, Authentication, Platform Fees, Postage, Returns/Losses, Marketing, Office Supplies, Professional Services, Other
- Fields: category, amount, vendor, description, date, receipt photo
- Recurring expenses: monthly/weekly/annual with start/end dates

### Receipt Scanning (PRO)
- Upload photo → AI extracts amount, vendor, date, suggested category
- Uses AI credit system (1 credit per scan)
- Manual correction UI if AI misreads
- Receipt photo stored in R2

### Mileage Tracker (PRO)
- Log: description, miles, date
- IRS rate auto-applied ($0.70/mile for 2026)
- Deduction auto-calculated: miles × rate
- Trip history with period totals

---

## 4. REPORTS BY TIER

| Report | FREE | PRO |
|--------|------|-----|
| Revenue dashboard (30 days) | ✅ | ✅ |
| P&L statement | ❌ | ✅ |
| Revenue by platform | ❌ | ✅ |
| Expense by category | ❌ | ✅ |
| CSV export | ❌ | ✅ |
| Tax prep package | ❌ | ✅ |
| Balance sheet | ❌ | ✅ |
| Cash flow statement | ❌ | ✅ |
| Inventory aging | ❌ | ✅ |
| Cross-platform breakdown | ❌ | ✅ |
| Receipt scanning | ❌ | ✅ |
| Mileage tracker | ❌ | ✅ |
| QuickBooks/Xero sync | ❌ | ✅ |

### History Retention
FREE: 30 days | PRO: 2 years (per Pricing Canonical v3.2 §7.1)

### Export Formats
CSV (PRO), PDF reports (PRO), QuickBooks sync (PRO), Xero sync (PRO)

---

## 5. EVENT TAXONOMY

All events that feed the Financial Center:

| Event | Type | Data |
|-------|------|------|
| `order.completed` | Revenue | sale price, TF, Stripe, shipping |
| `order.refunded` | Adjustment | refund amount, fee reversals |
| `crosslister.sale_detected` | Revenue | sale price, platform fees |
| `subscription.charged` | Expense (auto) | amount, product name |
| `shipping.label_purchased` | Expense (auto) | label cost, carrier |
| `auth.fee_charged` | Expense (auto) | auth fee, result |
| `insertion.fee_charged` | Expense (auto) | fee amount |
| `expense.created` | Expense (manual) | amount, category, vendor |
| `mileage.logged` | Expense (manual) | miles, deduction |
| `payout.sent` | Cash flow | payout amount |

---

## 6. KPI FORMULAS

| KPI | Formula |
|-----|---------|
| Gross Revenue | Sum of all order.completed amounts + crosslister sale amounts |
| COGS | Sum of listing.cogsCents for sold items |
| Gross Profit | Revenue - COGS |
| Platform Fees | TF + Stripe + crosslister platform fees |
| Net After Fees | Gross Profit - Platform Fees |
| Operating Expenses | Sum of all expense entries (manual + auto) |
| Net Profit | Net After Fees - Operating Expenses |
| Sell-Through Rate | Items sold / Items listed (period) |
| Average Sale Price | Total revenue / Number of orders |
| Average Days to Sell | Avg(soldAt - activatedAt) for sold listings |
| Inventory Value | Sum of priceCents for active listings |
| COGS Margin | (Revenue - COGS) / Revenue |

---

## 7. ACCOUNTING INTEGRATIONS (PRO)

### QuickBooks Online
- OAuth2 connection flow
- Sync frequency: daily or on-demand
- Maps: Twicely revenue → QB Income account, expenses → QB Expense accounts by category, payouts → QB bank deposits
- Conflict resolution: Twicely data wins (QuickBooks is the receiver)

### Xero
- OAuth2 connection flow
- Same sync model as QuickBooks
- Maps to Xero chart of accounts

### Sync Rules
- Only syncs completed/posted transactions (not pending)
- De-duplicates on Twicely transaction ID
- Failed syncs → retry 3x → alert seller → manual sync option
- Disconnect at any time — historical data remains in Twicely

---

## 8. UI LOCATIONS

| Route | Content | Tier |
|-------|---------|------|
| `/my/finances` | Dashboard — revenue, expenses, P&L summary | FREE |
| `/my/finances/expenses` | Expense list, add/edit, receipt upload | PRO |
| `/my/finances/mileage` | Mileage log, trip history | PRO |
| `/my/finances/reports` | Generate P&L, balance sheet, tax prep | PRO |
| `/my/finances/integrations` | QuickBooks/Xero connection | PRO |
| `/my/finances/settings` | Preferences, retention, categories | All |

---

## 9. PLATFORM SETTINGS

```
finance.mileageRatePerMile: 0.70
finance.receiptScanAiCredits: 1
finance.maxFreeExpensesPerMonth: 50
finance.reportRetentionDays.free: 30
finance.reportRetentionYears.pro: 2
finance.expenseCategories: ["Shipping Supplies", "Packaging", "Equipment", "Software/Subscriptions", "Mileage", "Storage/Rent", "Sourcing Trips", "Photography", "Authentication", "Platform Fees", "Postage", "Returns/Losses", "Marketing", "Office Supplies", "Professional Services", "Other"]
finance.defaultCurrency: "USD"
```

---

## 10. STRATEGIC VALUE

Three-product lock-in:
1. **Crosslister**: "All my listings managed here"
2. **Financial Center**: "All my business finances tracked here"
3. **Marketplace**: "Lowest fees, best tools"

Seller using all three has catastrophic switching costs. Listings + finances + marketplace data — all in Twicely.

---

## 11. PHASE

- D4: Basic dashboard (FREE tier) + all PRO features (expense tracking, receipt scanning, mileage, P&L, balance sheet, cash flow, COGS)
- F5.1: Auto-populate from crosslister sale detection
- G10.3: QuickBooks/Xero sync
