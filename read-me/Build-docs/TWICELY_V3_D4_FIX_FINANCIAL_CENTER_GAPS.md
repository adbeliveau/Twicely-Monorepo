# Install Prompt: D4-FIX — Financial Center Gap Fixes

**Phase & Step:** `[D4-FIX]`
**One-line Summary:** Wire the reports page (components exist, page missing), flesh out the admin reconciliation console (25-line skeleton), and build the finance settings page.

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md` — §4 (reports by tier), §8 (UI locations), §9 (platform settings)
2. `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` — §10.5 (reconciliation console), §11 (admin finance console)
3. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — §49 (Financial Center feature lock-in)
4. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — §7 (finance tiers: FREE/PRO)

---

## 0. PREREQUISITES

```bash
# Verify existing components that need wiring
ls src/components/finance/report-generator.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"
ls src/components/finance/report-list.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"
ls src/components/finance/report-viewer.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"
ls src/components/finance/finance-pro-gate.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"

# Verify report actions exist
grep -rn "generateReport\|listReports\|getReport\|deleteReport" src/lib/actions/ --include="*.ts" -l

# Verify recon page is skeleton
wc -l src/app/\(hub\)/fin/recon/page.tsx

# Verify finance platform settings exist in seed
grep -n "finance\.\|mileageRate\|expenseCategor\|reportRetention" src/lib/db/seed/*.ts | head -15

# Read existing components to understand props
head -40 src/components/finance/report-generator.tsx
head -40 src/components/finance/report-list.tsx
head -40 src/components/finance/report-viewer.tsx
head -40 src/components/finance/finance-pro-gate.tsx

# Read existing report actions to understand API
grep -n "export.*function\|export.*async" src/lib/actions/*finance*report* 2>/dev/null | head -20
grep -n "export.*function\|export.*async" src/lib/actions/*finance* 2>/dev/null | head -30

# Read the existing recon skeleton
cat src/app/\(hub\)/fin/recon/page.tsx

# Read the existing finance dashboard page for layout patterns
head -50 src/app/\(hub\)/my/selling/finances/page.tsx

# Read the existing admin fin overview for admin layout patterns
cat src/app/\(hub\)/fin/page.tsx

# Test baseline
npx vitest run 2>&1 | tail -3
```

Record test baseline. Read ALL component files and action files before writing any code.

---

## 1. GAP FIX 1: Reports Page (`/my/selling/finances/reports`)

### What exists
- `report-generator.tsx` — component for generating new reports (P&L, balance sheet, cash flow, tax prep)
- `report-list.tsx` — component for listing saved reports with delete
- `report-viewer.tsx` — component for viewing a single report with CSV/PDF export
- Server actions for generate, list, get, delete reports
- `report-csv.ts` + `report-pdf.ts` — export logic for all 3 report types
- `finance-pro-gate.tsx` — tier gate component

### What to build
New file: `src/app/(hub)/my/selling/finances/reports/page.tsx`

This is a **wiring job** — connect existing components to the page.

**Page structure:**
```
Server component:
  1. Auth check → get session
  2. Get financeTier (or derive from sellerProfile)
  3. If financeTier !== 'PRO' → render FinanceProGate with upgrade CTA
  4. If PRO → load saved reports list via server action
  5. Render ReportsClient (client component)

Client component (inline or separate):
  1. State: selectedReportId (null = list view, string = detail view)
  2. List view: ReportGenerator + ReportList
  3. Detail view: ReportViewer with back button
```

**Metadata:**
```typescript
export const metadata = { title: 'Reports | Twicely' };
```

**Key rules:**
- PRO only — gate with `finance-pro-gate` component
- Read the actual props of `report-generator`, `report-list`, `report-viewer` from the source files and pass them correctly
- Do NOT re-implement any report logic — just wire the components
- Follow the same layout pattern as the existing `/my/selling/finances/expenses/page.tsx`
- Under 150 lines

---

## 2. GAP FIX 2: Reconciliation Console (`/fin/recon`)

### What exists
- 25-line skeleton page

### Spec requirements (Finance Engine Canonical §10.5)

The admin reconciliation console must show:
- Daily reconciliation status indicator (green/yellow/red)
- Summary stats: total entries checked, discrepancies found, auto-resolved, pending manual review
- Discrepancy list (filterable by severity: LOW/HIGH/CRITICAL)
- Each discrepancy row: seller name, entry type, expected amount, actual amount, difference, Stripe event ID, status (pending/resolved/auto-resolved)
- Manual resolution actions: link Stripe event to ledger entry, create corrective entry
- Historical reconciliation report list (date, status, entries checked, issues found)
- Stripe balance vs platform liability comparison card

**Implementation approach:**

Since reconciliation is admin-only and the data pipeline (BullMQ reconciliation job) may not be fully built yet, build this as a **real UI with mock-ready queries**:

1. Create queries file: `src/lib/queries/reconciliation.ts`
   - `getReconciliationSummary(period)` — returns status, counts, last run time
   - `getDiscrepancies(filters)` — returns paginated discrepancy list
   - `getReconciliationHistory(limit)` — returns past reconciliation runs
   - `getBalanceComparison()` — Stripe balance vs platform liability

2. Rewrite `src/app/(hub)/fin/recon/page.tsx` as a full server page:
   - Status card (green/yellow/red based on last reconciliation result)
   - Stats row: entries checked, discrepancies, auto-resolved, pending
   - Stripe vs Platform balance comparison card
   - Discrepancy table with severity badges and status filters
   - Historical runs table with date/status/count

3. Create client component `src/components/admin/recon-dashboard.tsx` for the interactive parts:
   - Severity filter (LOW/HIGH/CRITICAL tabs or dropdown)
   - "Run Reconciliation" button (calls server action — stub if not wired to BullMQ yet)
   - "Resolve" button per discrepancy row

**Key rules:**
- Admin only — this is under `(hub)/fin/` which is already admin-gated
- If reconciliation data doesn't exist yet (no BullMQ job), the queries should return empty/placeholder data gracefully — NOT throw
- All monetary values in integer cents, display with `(cents / 100).toFixed(2)` or use a shared formatter
- Under 200 lines for the page, under 250 for the component
- Follow the layout pattern of other `/fin/*` pages (read `/fin/page.tsx` and `/fin/ledger/page.tsx` for patterns)

---

## 3. GAP FIX 3: Finance Settings Page (`/my/selling/finances/settings`)

### Spec requirements (Financial Center Canonical §9)

Settings page shows:
- **Expense categories**: Read from `finance.expenseCategories` platform setting. Display the 16 preset categories. In V3 these are not user-editable (platform-wide) — just display them. Add a note: "Custom categories coming soon."
- **History retention**: Show the seller's retention period based on their tier (FREE: 30 days, PRO: 2 years). Read from `finance.reportRetentionDays.free` / `finance.reportRetentionYears.pro` platform settings.
- **Default currency**: Show `finance.defaultCurrency` (USD). Read-only for now.
- **Mileage rate**: Show current IRS rate from `finance.mileageRatePerMile`. Read-only (admin-set).
- **Data export**: "Download all financial data" button — calls an action that generates a full CSV export of all transactions, expenses, mileage for the user.

**Implementation:**

New file: `src/app/(hub)/my/selling/finances/settings/page.tsx`

```
Server component:
  1. Auth check
  2. Load platform settings: expenseCategories, reportRetention, defaultCurrency, mileageRatePerMile
  3. Load seller's financeTier
  4. Render settings sections
```

**Page sections:**
1. **Your Plan** — current finance tier badge (FREE/PRO), link to `/my/selling/subscription`
2. **History Retention** — "Your data is retained for {X}" based on tier
3. **Expense Categories** — list of 16 categories in a simple grid. "Custom categories coming soon" note.
4. **Mileage Rate** — "Current IRS rate: $0.70/mile (2026)" — read-only
5. **Currency** — "USD" — read-only
6. **Export Data** — "Download All Financial Data" button. Either:
   - Link to existing CSV export action with `type: 'all'`
   - Or disabled with "Coming soon" if full export isn't built

**Key rules:**
- Available to ALL tiers (spec says "All" for settings)
- Read-only display — no edit forms needed in V3
- Platform settings read via `getSetting()` helper
- Under 120 lines
- Follow same layout as other finance sub-pages

---

## 4. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/app/(hub)/my/selling/finances/reports/page.tsx` | ~130 | Reports page wiring existing components |
| 2 | `src/app/(hub)/my/selling/finances/settings/page.tsx` | ~120 | Finance settings (read-only display) |
| 3 | `src/lib/queries/reconciliation.ts` | ~120 | Reconciliation queries (mock-ready) |
| 4 | `src/components/admin/recon-dashboard.tsx` | ~200 | Reconciliation interactive dashboard |

### Modified Files

| # | File | Change |
|---|------|--------|
| 5 | `src/app/(hub)/fin/recon/page.tsx` | Rewrite from 25-line skeleton to full implementation |

---

## 5. CONSTRAINTS

### DO NOT:
- Re-implement report generation logic — it's already built in actions
- Re-implement CSV/PDF export — it's already built in report-csv.ts and report-pdf.ts
- Build QuickBooks/Xero integration — that's G10.3
- Build custom expense category editing — just display the preset 16
- Build reconciliation BullMQ job — just build the UI that reads results
- Make settings editable — V3 is read-only display of platform settings
- Add new components to `/components/finance/` unless absolutely necessary — reuse existing
- Export helpers from 'use server' files

### Layout patterns:
- Follow the same auth + tier check pattern as `/my/selling/finances/expenses/page.tsx`
- Admin pages follow the pattern in `/fin/page.tsx`
- Use shadcn/ui components (Card, Badge, Button, Table)
- Brand color for PRO badge: #7C3AED
- All files under 300 lines

### Tier gating:
- Reports page: PRO only (use `finance-pro-gate` component)
- Settings page: ALL tiers (no gate)
- Recon page: Admin only (already handled by route group)

---

## 6. TEST REQUIREMENTS

### No new test files required for this fix.

These are wiring jobs (pages connecting existing tested components to routes) and read-only display pages. The existing 17 finance test files cover the business logic. However:

- Verify all existing finance tests still pass after changes
- Verify TypeScript compiles clean
- Verify the recon queries file compiles (even if it returns empty data)

If you want to add tests for the reconciliation queries, create:
`src/lib/queries/__tests__/reconciliation.test.ts` (~8 tests)
- getReconciliationSummary returns default values when no data
- getDiscrepancies returns empty array when no data
- getReconciliationHistory returns empty array
- getBalanceComparison returns zeroes when no data

This is optional — only if time permits.

---

## 7. VERIFICATION

```bash
# TypeScript
pnpm typecheck                    # 0 errors

# Tests
pnpm test                         # must match or exceed baseline (3223)

# New files exist
ls src/app/\(hub\)/my/selling/finances/reports/page.tsx
ls src/app/\(hub\)/my/selling/finances/settings/page.tsx
ls src/lib/queries/reconciliation.ts
ls src/components/admin/recon-dashboard.tsx

# File sizes
wc -l src/app/\(hub\)/my/selling/finances/reports/page.tsx \
      src/app/\(hub\)/my/selling/finances/settings/page.tsx \
      src/app/\(hub\)/fin/recon/page.tsx \
      src/lib/queries/reconciliation.ts \
      src/components/admin/recon-dashboard.tsx
# ALL under 300 lines

# Recon page is no longer skeleton
wc -l src/app/\(hub\)/fin/recon/page.tsx
# Should be >80 lines (was 25)

# Banned terms
grep -rn "as any\|@ts-ignore\|SellerTier\|SubscriptionTier\|Twicely Balance\|wallet" \
  src/app/\(hub\)/my/selling/finances/reports/page.tsx \
  src/app/\(hub\)/my/selling/finances/settings/page.tsx \
  src/app/\(hub\)/fin/recon/page.tsx \
  src/lib/queries/reconciliation.ts \
  src/components/admin/recon-dashboard.tsx
# Should be 0

# Route check — all 3 gaps filled
echo "=== ROUTES AFTER FIX ==="
ls src/app/\(hub\)/my/selling/finances/reports/page.tsx && echo "FIXED: /reports"
ls src/app/\(hub\)/my/selling/finances/settings/page.tsx && echo "FIXED: /settings"
wc -l src/app/\(hub\)/fin/recon/page.tsx | grep -v "^25 " && echo "FIXED: /fin/recon"
```

**Stop and report after verification.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_D4_FIX_FINANCIAL_CENTER_GAPS.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCE_ENGINE_CANONICAL.md (§10.5, §11)

CRITICAL: Task 0 requires reading ALL existing finance components before writing code.
The reports page is a WIRING job — read the component props and action signatures first.
Do NOT re-implement any existing logic. Execute all tasks in order. Stop and report after running verification.
```
