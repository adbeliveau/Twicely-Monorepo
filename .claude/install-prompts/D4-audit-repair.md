# D4 Financial Center Audit Repair

**Phase & Step**: `[D4-AUDIT]`
**Feature Name**: D4 Financial Center Audit Violations Fix Pass
**One-line Summary**: Fix 14 audit violations across the D4 Financial Center code -- file size, runtime crash, CASL bypass, hardcoded zeros, validation, UX, and defense-in-depth issues.
**Canonical Sources**: Read before starting:
- `TWICELY_V3_SCHEMA_v2_0_7.md` (ledgerEntry types, sellerBalance columns)
- `TWICELY_V3_PAGE_REGISTRY.md` (route #50-55b, breadcrumb text "Finances")
- `TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md` (feature details)
- `TWICELY_V3_TESTING_STANDARDS.md` (test patterns)
- `CLAUDE.md` (300-line max, authorize() pattern, cuid2 IDs, no banned terms)

---

## PREREQUISITES

- D4, D4.1, D4.2, D4.3 are all COMPLETE.
- All schema tables exist in `src/lib/db/schema/finance.ts`.
- All CASL subjects (Expense, MileageEntry, FinancialReport) exist in `src/lib/casl/subjects.ts`.
- `authorize()` is available at `@/lib/casl`.
- `getSellerProfile()` is available at `@/lib/queries/seller`.
- shadcn `Dialog` component already used by `expense-list.tsx` and `mileage-list.tsx` for delete confirmations (use this same pattern, not `AlertDialog`).

---

## SCOPE -- EXACTLY WHAT TO FIX

There are 14 findings, numbered below. Each is a surgical fix. No new features. No new tables. No new routes.

---

### FINDING 1 (CRITICAL): Split `finance-center-reports.ts` (617 lines)

**File**: `src/lib/queries/finance-center-reports.ts` (617 lines -- EXCEEDS 300-line max)

Split into 3 files:

#### File A: `src/lib/queries/finance-center-reports-pnl.ts`
Contains:
- Interface `PnlReportData` (lines 34-70)
- Constant `PLATFORM_FEE_TYPES` (lines 146-156)
- Function `getPnlReportData()` (lines 162-353)

Export: `PnlReportData`, `PLATFORM_FEE_TYPES`, `getPnlReportData`

#### File B: `src/lib/queries/finance-center-reports-balance-cashflow.ts`
Contains:
- Interface `BalanceSheetData` (lines 72-96)
- Interface `CashFlowData` (lines 98-122)
- Function `getBalanceSheetData()` (lines 359-424) -- NOTE: this calls `getPnlReportData()`, so import from file A
- Function `getCashFlowData()` (lines 430-543) -- imports `PLATFORM_FEE_TYPES` from file A

Export: `BalanceSheetData`, `CashFlowData`, `getBalanceSheetData`, `getCashFlowData`

#### File C: `src/lib/queries/finance-center-reports-list.ts`
Contains:
- Interface `SavedReport` (lines 124-133)
- Interface `ReportListResult` (lines 135-140)
- Column maps `REPORT_COLUMNS`, `REPORT_META_COLUMNS` (lines 549-568)
- Function `getReportList()` (lines 570-604)
- Function `getReportById()` (lines 606-617)
- Import `ListReportsInput` from `@/lib/validations/finance-center`

Export: `SavedReport`, `ReportListResult`, `getReportList`, `getReportById`

#### Barrel re-export: `src/lib/queries/finance-center-reports.ts`
Replace the entire 617-line file with a barrel re-export file:

```typescript
/**
 * Finance Center report queries — barrel re-export.
 * Split into sub-modules to stay under 300-line limit.
 */
export { getPnlReportData, PLATFORM_FEE_TYPES, type PnlReportData } from './finance-center-reports-pnl';
export { getBalanceSheetData, getCashFlowData, type BalanceSheetData, type CashFlowData } from './finance-center-reports-balance-cashflow';
export { getReportList, getReportById, type SavedReport, type ReportListResult } from './finance-center-reports-list';
```

All external consumers import from `@/lib/queries/finance-center-reports` -- the barrel ensures zero breaking changes. Verify these consumers still compile:
- `src/lib/actions/finance-center-reports.ts`
- `src/lib/finance/report-csv.ts`
- `src/lib/finance/report-pdf.ts`
- `src/components/finance/report-list.tsx`
- `src/components/finance/report-viewer.tsx`
- `src/components/finance/report-generator.tsx`
- `src/components/finance/statements-client.tsx`

---

### FINDING 2 (CRITICAL): Fix `.toLocaleDateString()` runtime crash

**File**: `src/components/finance/transaction-table.tsx`, line 44

**Current code**:
```typescript
{tx.createdAt.toLocaleDateString()}
```

**Problem**: Server actions serialize `Date` objects to ISO strings when sent to the client. `tx.createdAt` arrives as a `string`, not a `Date`. Calling `.toLocaleDateString()` on a string crashes at runtime.

**Fix**: Wrap in `new Date()`:
```typescript
{new Date(tx.createdAt).toLocaleDateString()}
```

Also update the `TransactionRow` type in `src/lib/queries/finance-center.ts` (lines 33-42) to make the date fields union types that reflect serialization reality, OR simply keep the type as `Date` and just fix the component to always wrap. The simplest approach is wrapping. Just change line 44.

---

### FINDING 3 (CRITICAL): Replace `auth.api.getSession()` with `authorize()` on 2 pages

Both pages bypass CASL by calling `auth.api.getSession()` directly instead of `authorize()`.

#### Fix A: `src/app/(hub)/my/selling/finances/transactions/page.tsx`

**Current** (lines 1-30):
```typescript
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
// ...
const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) {
  redirect('/auth/login?callbackUrl=/my/selling/finances/transactions');
}
// Uses session.user.id below
```

**Replace with**:
```typescript
import { authorize } from '@/lib/casl';
// Remove: import { headers } from 'next/headers';
// Remove: import { auth } from '@/lib/auth';
// ...
const { session } = await authorize();
if (!session) {
  redirect('/auth/login?callbackUrl=/my/selling/finances/transactions');
}
// Use session.userId below (NOT session.user.id)
```

Change all `session.user.id` references to `session.userId`.

#### Fix B: `src/app/(hub)/my/selling/finances/payouts/page.tsx`

**Current** (lines 1-28):
```typescript
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
// ...
const session = await auth.api.getSession({
  headers: await headers(),
});
if (!session?.user) {
  redirect('/auth/login?callbackUrl=/my/selling/finances/payouts');
}
// Uses session.user.id below
```

**Replace with**:
```typescript
import { authorize } from '@/lib/casl';
// Remove: import { headers } from 'next/headers';
// Remove: import { auth } from '@/lib/auth';
// ...
const { session } = await authorize();
if (!session) {
  redirect('/auth/login?callbackUrl=/my/selling/finances/payouts');
}
// Use session.userId below (NOT session.user.id)
```

Change all `session.user.id` references to `session.userId`.

---

### FINDING 4 (HIGH): Fix `feesCents: 0` in revenue time series

**File**: `src/lib/queries/finance-center.ts`, line 253

The `getRevenueTimeSeries()` function hardcodes `feesCents: 0` for every data point. This produces a misleading Fees area in the chart that is always zero.

**Fix**: Remove `feesCents` entirely from this query and the consuming interface/component. This is the simpler fix -- the data is not available at the per-day granularity from this query, and showing a zero line misleads users.

1. In `src/lib/queries/finance-center.ts`:
   - Remove `feesCents: number` from the `RevenueDataPoint` interface (line 29)
   - Remove `feesCents: 0` from the result array push (line 253)

2. In `src/components/finance/revenue-chart.tsx`:
   - Remove the `Fees` field from `chartData` mapping (line 65: `Fees: d.feesCents`)
   - Remove the entire Fees `<Area>` component (lines 93-100)
   - Remove the red fee area from the chart legend (it will auto-remove when the Area is gone)

---

### FINDING 5 (HIGH): Fix `pendingRefundsCents: 0` in balance sheet

**File**: `src/lib/queries/finance-center-reports.ts` (will be in `finance-center-reports-balance-cashflow.ts` after split), function `getBalanceSheetData()`, line 415

**Current code**:
```typescript
pendingRefundsCents: 0,
```
and:
```typescript
const totalLiabilitiesCents = reservedCents;
```

**Fix**: Query actual pending refund amounts from ledger entries where type is `REFUND_FULL` or `REFUND_PARTIAL` and status is `PENDING`, scoped to the user.

Add this query inside `getBalanceSheetData()`, after the inventory query block:

```typescript
const REFUND_TYPES_FOR_PENDING = ['REFUND_FULL', 'REFUND_PARTIAL'] as const;

const [pendingRefundRow] = await db
  .select({
    total: sql<number>`coalesce(sum(abs(${ledgerEntry.amountCents})), 0)::int`,
  })
  .from(ledgerEntry)
  .where(
    and(
      eq(ledgerEntry.userId, userId),
      inArray(ledgerEntry.type, [...REFUND_TYPES_FOR_PENDING]),
      eq(ledgerEntry.status, 'PENDING'),
    ),
  );

const pendingRefundsCents = pendingRefundRow?.total ?? 0;
```

Then update the `totalLiabilitiesCents` calculation:
```typescript
const totalLiabilitiesCents = reservedCents + pendingRefundsCents;
```

And replace the hardcoded `0`:
```typescript
pendingRefundsCents,
```

The imports for `inArray` and `ledgerEntry` are already present in the original file. After the split, ensure `ledgerEntry` and all required drizzle operators are imported in `finance-center-reports-balance-cashflow.ts`.

---

### FINDING 6 (MEDIUM): Fix ID validation schemas

**File**: `src/lib/validations/finance-center.ts`

Change all `z.string().min(1)` used for ID fields to `z.string().cuid2()`. This prevents arbitrary string injection for resource IDs.

Lines to change:
- Line 93: `updateExpenseSchema` -> `id: z.string().cuid2()`
- Line 108: `deleteExpenseSchema` -> `id: z.string().cuid2()`
- Line 139: `updateMileageSchema` -> `id: z.string().cuid2()`
- Line 148: `deleteMileageSchema` -> `id: z.string().cuid2()`
- Line 196: `deleteReportSchema` -> `id: z.string().cuid2()`

This matches the pattern used in `cart.ts`, `checkout.ts`, `order-actions.ts`, and `shipping-profile.ts`.

---

### FINDING 7 (MEDIUM): Add Zod validation to `getReportAction`

**File**: `src/lib/actions/finance-center-reports.ts`, lines 199-220

**Current code**:
```typescript
export async function getReportAction(
  reportId: string,
): Promise<GetReportResponse> {
  if (!reportId) return { success: false, error: 'Report ID required' };
  // ...
```

**Fix**: Add a Zod schema for the input, matching the pattern of other actions.

Add a new schema to `src/lib/validations/finance-center.ts`:
```typescript
export const getReportSchema = z
  .object({
    id: z.string().cuid2(),
  })
  .strict();

export type GetReportInput = z.infer<typeof getReportSchema>;
```

Then update `getReportAction` in `src/lib/actions/finance-center-reports.ts`:
```typescript
import {
  generateReportSchema,
  listReportsSchema,
  deleteReportSchema,
  getReportSchema,       // <-- add
} from '@/lib/validations/finance-center';

export async function getReportAction(
  input: unknown,                         // <-- changed from reportId: string
): Promise<GetReportResponse> {
  const parsed = getReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('FinancialReport', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const report = await getReportById(userId, parsed.data.id);  // <-- use parsed.data.id
    if (!report) return { success: false, error: 'Not found' };
    return { success: true, report };
  } catch {
    return { success: false, error: 'Failed to load report' };
  }
}
```

**IMPORTANT**: Update ALL callers of `getReportAction` to pass `{ id: reportId }` instead of a bare string. The only caller is:

- `src/components/finance/report-list.tsx`, line 60:
  **Current**: `const result = await getReportAction(id);`
  **Fix**: `const result = await getReportAction({ id });`

---

### FINDING 8 (MEDIUM): Replace `window.location.reload()`

**File**: `src/components/finance/add-expense-button.tsx`, line 32

**Current code**:
```typescript
onSuccess={() => {
  setOpen(false);
  window.location.reload();
}}
```

**Fix**: Replace with `useRouter().refresh()`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';  // <-- add import
// ...

export function AddExpenseButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();                   // <-- add hook

  return (
    <>
      {/* ... */}
      <ExpenseForm
        onSuccess={() => {
          setOpen(false);
          router.refresh();                     // <-- replace window.location.reload()
        }}
        onCancel={() => setOpen(false)}
      />
      {/* ... */}
    </>
  );
}
```

---

### FINDING 9 (MEDIUM): Replace `confirm()` with Dialog in `report-list.tsx`

**File**: `src/components/finance/report-list.tsx`, line 45

**Current code**:
```typescript
async function handleDelete(id: string) {
  if (!confirm('Delete this report? This cannot be undone.')) return;
  // ...
}
```

**Fix**: Replace the native `confirm()` with a state-driven `Dialog` pattern, identical to the pattern used in `expense-list.tsx` (lines 170-183) and `mileage-list.tsx` (lines 243-267).

Add state variables:
```typescript
const [deletingId, setDeletingId] = useState<string | null>(null);
const [deleteError, setDeleteError] = useState<string | null>(null);
const [deleteLoading, setDeleteLoading] = useState(false);
```

NOTE: the existing `deletingId` state (line 21) is already declared BUT is used to track the in-flight delete ID and a loading spinner. Refactor it:
- Rename the existing `deletingId` concept: the existing `deletingId` state on line 21 doubles as "which report is being deleted AND showing spinner". Keep it for the confirmation dialog target.
- Remove the old `handleDelete` function entirely.
- Add a new `confirmDelete` function:

```typescript
async function confirmDelete() {
  if (!deletingId) return;
  setDeleteError(null);
  setDeleteLoading(true);
  try {
    const result = await deleteReportAction({ id: deletingId });
    if (result.success) {
      setDeletingId(null);
      await fetchReports(page);
    } else {
      setDeleteError(result.error ?? 'Failed to delete');
    }
  } finally {
    setDeleteLoading(false);
  }
}
```

Update the delete button's onClick (line 150):
**Current**: `onClick={() => void handleDelete(r.id)}`
**Fix**: `onClick={() => { setDeletingId(r.id); setDeleteError(null); }}`

Add the confirmation Dialog at the end of the component JSX (before the closing `</Card>` wrapper), using the same pattern as `expense-list.tsx`:
```tsx
<Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
  <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle>Delete report</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">Delete this report? This cannot be undone.</p>
    {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
    <div className="flex gap-3 pt-2">
      <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
        {deleteLoading ? 'Deleting...' : 'Delete'}
      </Button>
      <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteLoading}>Cancel</Button>
    </div>
  </DialogContent>
</Dialog>
```

Add the Dialog imports:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
```

Remove the now-unused `deleteLoading` variable that was the old `setDeletingId` flow -- wait, actually the `deletingId` state already exists on line 21. Consolidate: the existing `deletingId` state on line 21 should be reused for the dialog target. Add `deleteError` and `deleteLoading` as new state. Remove the `disabled={deletingId === r.id}` on the delete button (line 151) since the dialog now handles the loading state.

---

### FINDING 10 (MEDIUM): Add breadcrumbs to 3 sub-pages

Add a breadcrumb `<Link>` back to "Finances" (`/my/selling/finances`) on 3 pages, using the same pattern as `transactions/page.tsx` (lines 44-49), but with correct text "Finances" instead of "Financial Center".

#### Fix A: `src/app/(hub)/my/selling/finances/expenses/page.tsx`

Add `import { ChevronLeft } from 'lucide-react';` (if not already imported).

Replace the header section (around line 94-96):
```tsx
{/* Header */}
<div className="flex items-center justify-between flex-wrap gap-2">
  <h1 className="text-2xl font-bold">Expenses</h1>
  <AddExpenseButton />
</div>
```

With:
```tsx
{/* Header with breadcrumb */}
<div>
  <Link
    href="/my/selling/finances"
    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
  >
    <ChevronLeft className="h-4 w-4" />
    Finances
  </Link>
  <div className="flex items-center justify-between flex-wrap gap-2">
    <h1 className="text-2xl font-bold">Expenses</h1>
    <AddExpenseButton />
  </div>
</div>
```

#### Fix B: `src/app/(hub)/my/selling/finances/mileage/page.tsx`

Add `import { ChevronLeft } from 'lucide-react';` (if not already imported).

Replace the header section (around line 87-89):
```tsx
{/* Header */}
<div className="flex items-center justify-between flex-wrap gap-2">
  <h1 className="text-2xl font-bold">Mileage Tracker</h1>
</div>
```

With:
```tsx
{/* Header with breadcrumb */}
<div>
  <Link
    href="/my/selling/finances"
    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
  >
    <ChevronLeft className="h-4 w-4" />
    Finances
  </Link>
  <h1 className="text-2xl font-bold">Mileage Tracker</h1>
</div>
```

#### Fix C: `src/app/(hub)/my/selling/finances/statements/page.tsx`

Add `import Link from 'next/link';` and `import { ChevronLeft } from 'lucide-react';`.

Replace the header section (around lines 34-39):
```tsx
<div>
  <h1 className="text-2xl font-bold">Financial Statements</h1>
  <p className="text-muted-foreground text-sm">
    Generate P&amp;L reports, balance sheets, and cash flow statements
  </p>
</div>
```

With:
```tsx
<div>
  <Link
    href="/my/selling/finances"
    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
  >
    <ChevronLeft className="h-4 w-4" />
    Finances
  </Link>
  <h1 className="text-2xl font-bold">Financial Statements</h1>
  <p className="text-muted-foreground text-sm">
    Generate P&amp;L reports, balance sheets, and cash flow statements
  </p>
</div>
```

---

### FINDING 11 (MEDIUM): Add seller profile check to statements page

**File**: `src/app/(hub)/my/selling/finances/statements/page.tsx`

The expenses page (line 32-53) and mileage page (line 29-50) both check `getSellerProfile()` and show "Start Selling First" if null. The statements page skips this.

**Fix**: Add the same check.

Add imports:
```typescript
import Link from 'next/link';           // May already be needed for breadcrumb (finding 10)
import { getSellerProfile } from '@/lib/queries/seller';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
```

After the `if (!session)` redirect block, add:

```typescript
const sellerProfile = await getSellerProfile(session.userId);

if (!sellerProfile) {
  return (
    <div className="space-y-6">
      {/* breadcrumb from finding 10 */}
      <div>
        <Link
          href="/my/selling/finances"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Finances
        </Link>
        <h1 className="text-2xl font-bold">Financial Statements</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Start Selling First</CardTitle>
          <CardDescription>
            Create your first listing to access financial statements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/my/selling/listings/new">Create Listing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### FINDING 12 (MEDIUM): Fix breadcrumb text

**File**: `src/app/(hub)/my/selling/finances/transactions/page.tsx`, line 49

**Current**: `Financial Center`
**Correct per Page Registry #50**: `Finances`

Change:
```tsx
<ChevronLeft className="h-4 w-4" />
Financial Center
```
To:
```tsx
<ChevronLeft className="h-4 w-4" />
Finances
```

---

### FINDING 13 (MEDIUM): Add tier gate to list actions

Add a `financeTier !== 'PRO'` guard to the list/read actions for defense in depth. These actions currently rely only on CASL but skip the PRO tier check that the CUD actions enforce.

#### Fix A: `src/lib/actions/finance-center-expenses.ts`, function `listExpensesAction` (lines 252-275)

After the CASL check and before the `try` block, add:
```typescript
const financeTier = await getFinanceTier(userId);
if (financeTier !== 'PRO') {
  return { success: false, error: 'Upgrade to Finance Pro to view expenses' };
}
```

`getFinanceTier` is already imported (line 16).

#### Fix B: `src/lib/actions/finance-center-mileage.ts`, function `listMileageAction` (lines 203-226)

After the CASL check and before the `try` block, add:
```typescript
const financeTier = await getFinanceTier(userId);
if (financeTier !== 'PRO') {
  return { success: false, error: 'Upgrade to Finance Pro to view mileage' };
}
```

`getFinanceTier` is already imported (line 14).

---

### FINDING 14 (MEDIUM): Improve receipt OCR URL validation

**File**: `src/lib/finance/receipt-ocr.ts`, lines 24-27

**Current code**:
```typescript
const r2Prefix = process.env.NEXT_PUBLIC_R2_URL;
if (r2Prefix && !imageUrl.startsWith(r2Prefix)) {
  return MOCK_RESULT;
}
```

**Problem**: The `startsWith` check is a weak URL validation. A crafted string like `https://r2.example.com.evil.com/...` would pass if the prefix is `https://r2.example.com`.

**Fix**: Add `new URL()` parsing to validate the URL structure, and compare hostnames:

```typescript
const r2Prefix = process.env.NEXT_PUBLIC_R2_URL;
if (r2Prefix) {
  try {
    const imageUrlParsed = new URL(imageUrl);
    const r2UrlParsed = new URL(r2Prefix);
    if (imageUrlParsed.hostname !== r2UrlParsed.hostname) {
      return MOCK_RESULT;
    }
  } catch {
    // Malformed URL -- reject
    return MOCK_RESULT;
  }
}
```

This ensures:
- Malformed URLs are rejected (catch block)
- Hostname must match exactly (no prefix spoofing)
- The rest of the function proceeds normally if hostname matches or R2 prefix is not configured

---

## CONSTRAINTS -- WHAT NOT TO DO

- Do NOT add new database tables or columns.
- Do NOT create new routes or pages.
- Do NOT change any business logic (fee calculations, escrow rules, etc.).
- Do NOT rename any exported types or functions (barrel re-exports maintain the same public API).
- Do NOT use any banned terms (see CLAUDE.md vocabulary section).
- Do NOT use `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Do NOT exceed 300 lines in any file.
- Do NOT add `console.log` statements.
- The split files (finding 1) must produce ZERO import changes for external consumers.

---

## ACCEPTANCE CRITERIA

### CRITICAL fixes
- [ ] `finance-center-reports.ts` is now a barrel re-export file under 15 lines
- [ ] `finance-center-reports-pnl.ts` exists and is under 300 lines
- [ ] `finance-center-reports-balance-cashflow.ts` exists and is under 300 lines
- [ ] `finance-center-reports-list.ts` exists and is under 300 lines
- [ ] All existing imports from `@/lib/queries/finance-center-reports` still compile
- [ ] `transaction-table.tsx` wraps `tx.createdAt` in `new Date()` before calling `.toLocaleDateString()`
- [ ] `transactions/page.tsx` uses `authorize()` from `@/lib/casl`, NOT `auth.api.getSession()`
- [ ] `payouts/page.tsx` uses `authorize()` from `@/lib/casl`, NOT `auth.api.getSession()`
- [ ] Neither `transactions/page.tsx` nor `payouts/page.tsx` import `headers` from `next/headers` or `auth` from `@/lib/auth`

### HIGH fixes
- [ ] `RevenueDataPoint` interface does NOT contain `feesCents`
- [ ] `revenue-chart.tsx` does NOT render a Fees `<Area>` component
- [ ] `getBalanceSheetData()` queries actual pending refund ledger entries (REFUND_FULL/REFUND_PARTIAL with PENDING status)
- [ ] `totalLiabilitiesCents` includes `pendingRefundsCents` in its calculation

### MEDIUM fixes
- [ ] All ID fields in `finance-center.ts` validation schemas use `z.string().cuid2()` not `z.string().min(1)`
- [ ] `getReportAction` accepts `input: unknown` with Zod validation, not a bare `reportId: string`
- [ ] `getReportSchema` exists in `finance-center.ts` validations with `id: z.string().cuid2()`
- [ ] `report-list.tsx` callers pass `{ id: reportId }` not a bare string
- [ ] `add-expense-button.tsx` uses `router.refresh()` not `window.location.reload()`
- [ ] `report-list.tsx` uses a Dialog for delete confirmation, not `confirm()`
- [ ] All 4 finance sub-pages (expenses, mileage, statements, transactions) have breadcrumb links back to `/my/selling/finances`
- [ ] All breadcrumbs say "Finances" not "Financial Center"
- [ ] `statements/page.tsx` checks `getSellerProfile()` and shows "Start Selling First" if null
- [ ] `listExpensesAction` and `listMileageAction` both check `financeTier === 'PRO'` before returning data
- [ ] `receipt-ocr.ts` validates URLs using `new URL()` and compares hostnames, not just `startsWith`

### Vocabulary compliance
- [ ] Zero occurrences of banned terms in any modified file

---

## TEST REQUIREMENTS

Update existing tests where function signatures change. Specifically:

### Tests to update

1. **`src/lib/actions/__tests__/finance-center-reports.test.ts`**: Update tests for `getReportAction` to pass `{ id: 'some-cuid' }` instead of a bare string. Add a test: `'rejects invalid non-cuid2 report ID'`.

2. **`src/lib/queries/__tests__/finance-center-reports.test.ts`**: Verify imports still work from the barrel. No logic changes needed unless the test directly imports from `finance-center-reports.ts` (it does -- verify barrel re-exports work).

3. Add 1-2 new tests for the tier gate in list actions:
   - In an appropriate existing test file (e.g., `finance-center-expenses-list.test.ts`), add: `'listExpensesAction returns error when financeTier is FREE'`
   - In `finance-center-mileage-list.test.ts`, add: `'listMileageAction returns error when financeTier is FREE'`

4. Add 1 test for receipt OCR URL validation:
   - In `finance-center-expenses-receipt.test.ts` (or a new test), add: `'extractReceiptData rejects URL with different hostname than R2'`

### Test count
Test count MUST NOT decrease. It should increase by at least 3-4 tests.

---

## FILE APPROVAL LIST

| # | Action | File Path | Description |
|---|--------|-----------|-------------|
| 1 | CREATE | `src/lib/queries/finance-center-reports-pnl.ts` | P&L report data query (split from 617-line file) |
| 2 | CREATE | `src/lib/queries/finance-center-reports-balance-cashflow.ts` | Balance sheet + cash flow queries (split from 617-line file) |
| 3 | CREATE | `src/lib/queries/finance-center-reports-list.ts` | Report list + getById queries (split from 617-line file) |
| 4 | REWRITE | `src/lib/queries/finance-center-reports.ts` | Replace 617-line file with barrel re-export (~10 lines) |
| 5 | MODIFY | `src/components/finance/transaction-table.tsx` | Wrap `tx.createdAt` in `new Date()` |
| 6 | MODIFY | `src/app/(hub)/my/selling/finances/transactions/page.tsx` | Replace `auth.api.getSession()` with `authorize()`, fix breadcrumb text |
| 7 | MODIFY | `src/app/(hub)/my/selling/finances/payouts/page.tsx` | Replace `auth.api.getSession()` with `authorize()` |
| 8 | MODIFY | `src/lib/queries/finance-center.ts` | Remove `feesCents` from `RevenueDataPoint` |
| 9 | MODIFY | `src/components/finance/revenue-chart.tsx` | Remove Fees Area from chart |
| 10 | MODIFY | `src/lib/validations/finance-center.ts` | Change `z.string().min(1)` to `z.string().cuid2()` on IDs; add `getReportSchema` |
| 11 | MODIFY | `src/lib/actions/finance-center-reports.ts` | Add Zod validation to `getReportAction` |
| 12 | MODIFY | `src/components/finance/add-expense-button.tsx` | Replace `window.location.reload()` with `router.refresh()` |
| 13 | MODIFY | `src/components/finance/report-list.tsx` | Replace `confirm()` with Dialog; update `getReportAction` call |
| 14 | MODIFY | `src/app/(hub)/my/selling/finances/expenses/page.tsx` | Add breadcrumb |
| 15 | MODIFY | `src/app/(hub)/my/selling/finances/mileage/page.tsx` | Add breadcrumb |
| 16 | MODIFY | `src/app/(hub)/my/selling/finances/statements/page.tsx` | Add breadcrumb + seller profile check |
| 17 | MODIFY | `src/lib/actions/finance-center-expenses.ts` | Add tier gate to `listExpensesAction` |
| 18 | MODIFY | `src/lib/actions/finance-center-mileage.ts` | Add tier gate to `listMileageAction` |
| 19 | MODIFY | `src/lib/finance/receipt-ocr.ts` | Improve URL validation with `new URL()` |
| 20 | MODIFY | `src/lib/actions/__tests__/finance-center-reports.test.ts` | Update tests for new `getReportAction` signature |
| 21 | MODIFY | `src/lib/actions/__tests__/finance-center-expenses-list.test.ts` | Add tier gate test |
| 22 | MODIFY | `src/lib/actions/__tests__/finance-center-mileage-list.test.ts` | Add tier gate test |

**Total: 3 new files, 19 modified files = 22 files**

---

## PARALLEL STREAMS

This audit repair decomposes into 4 independent streams plus a final merge stream. All findings within a stream are sequential (same files). Streams A, B, C, and D are independent and can execute in parallel.

```
Stream A (File Split)     Stream B (Auth + UX Pages)     Stream C (Data Fixes)     Stream D (Action Hardening)
   [1. Split reports]       [3. authorize() x2]            [4. Remove feesCents]     [6. cuid2 IDs]
   [5. pendingRefunds]      [10. Breadcrumbs x3]           [2. Date wrap]            [7. Zod getReport]
                            [11. Seller profile check]     [8. router.refresh]       [13. Tier gates]
                            [12. Fix breadcrumb text]      [9. Dialog confirm]       [14. URL validation]
         |                          |                            |                          |
         +----------+---------------+----------------------------+--------------------------+
                    |
              [MERGE: TypeScript check + test run + banned terms scan]
```

### Stream A: Report File Split + Balance Sheet Fix (Findings 1, 5)

**Files**:
- CREATE `src/lib/queries/finance-center-reports-pnl.ts`
- CREATE `src/lib/queries/finance-center-reports-balance-cashflow.ts`
- CREATE `src/lib/queries/finance-center-reports-list.ts`
- REWRITE `src/lib/queries/finance-center-reports.ts`

**Interface contract** (shared with all streams):
```typescript
// Types exported from barrel (unchanged public API):
export { getPnlReportData, PLATFORM_FEE_TYPES, type PnlReportData } from './finance-center-reports-pnl';
export { getBalanceSheetData, getCashFlowData, type BalanceSheetData, type CashFlowData } from './finance-center-reports-balance-cashflow';
export { getReportList, getReportById, type SavedReport, type ReportListResult } from './finance-center-reports-list';
```

Finding 5 (pendingRefundsCents) is in this stream because it modifies `getBalanceSheetData()` which is being moved to the new split file.

### Stream B: Auth + UX Pages (Findings 3, 10, 11, 12)

**Files**:
- MODIFY `src/app/(hub)/my/selling/finances/transactions/page.tsx`
- MODIFY `src/app/(hub)/my/selling/finances/payouts/page.tsx`
- MODIFY `src/app/(hub)/my/selling/finances/expenses/page.tsx`
- MODIFY `src/app/(hub)/my/selling/finances/mileage/page.tsx`
- MODIFY `src/app/(hub)/my/selling/finances/statements/page.tsx`

No interface contracts needed -- these are leaf page components with no shared API.

### Stream C: Component Fixes (Findings 2, 4, 8, 9)

**Files**:
- MODIFY `src/components/finance/transaction-table.tsx`
- MODIFY `src/lib/queries/finance-center.ts`
- MODIFY `src/components/finance/revenue-chart.tsx`
- MODIFY `src/components/finance/add-expense-button.tsx`
- MODIFY `src/components/finance/report-list.tsx`

**Interface contract** for finding 4 (RevenueDataPoint change):
```typescript
// BEFORE:
export interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  feesCents: number;    // <-- REMOVE
  orderCount: number;
}

// AFTER:
export interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}
```

Both `finance-center.ts` (query) and `revenue-chart.tsx` (component) must be updated together.

NOTE: Finding 9 (report-list.tsx Dialog) also requires the `getReportAction` signature change from Finding 7. The report-list change depends on Finding 7 being done. If streams C and D run in parallel, the `getReportAction({ id })` call in report-list.tsx must use the NEW signature. The old `getReportAction(id)` call must be updated. This is a soft dependency -- stream C can write the `{ id }` form even before stream D changes the action signature, because the test will validate correctness at merge time.

### Stream D: Action Hardening (Findings 6, 7, 13, 14)

**Files**:
- MODIFY `src/lib/validations/finance-center.ts`
- MODIFY `src/lib/actions/finance-center-reports.ts`
- MODIFY `src/lib/actions/finance-center-expenses.ts`
- MODIFY `src/lib/actions/finance-center-mileage.ts`
- MODIFY `src/lib/finance/receipt-ocr.ts`
- MODIFY `src/lib/actions/__tests__/finance-center-reports.test.ts`
- MODIFY `src/lib/actions/__tests__/finance-center-expenses-list.test.ts`
- MODIFY `src/lib/actions/__tests__/finance-center-mileage-list.test.ts`

**Interface contract** for finding 7 (`getReportAction` signature change):
```typescript
// BEFORE:
export async function getReportAction(reportId: string): Promise<GetReportResponse>

// AFTER:
export async function getReportAction(input: unknown): Promise<GetReportResponse>
// Expects: { id: string } validated by getReportSchema
```

---

## VERIFICATION CHECKLIST

After implementation, run:

```bash
./twicely-lint.sh
```

Paste the FULL raw output. Additionally verify:

1. `wc -l src/lib/queries/finance-center-reports*.ts` -- all files under 300 lines
2. `pnpm typecheck` -- 0 errors
3. `pnpm test` -- test count >= BASELINE_TESTS (1373), should increase by ~3-4
4. No occurrences of `auth.api.getSession` in any finance page files
5. No occurrences of `window.location.reload` in any finance component files
6. No occurrences of `confirm(` (native) in any finance component files
7. No occurrences of `z.string().min(1)` for ID fields in `finance-center.ts` validations
8. No occurrences of `feesCents` in `finance-center.ts` queries or `revenue-chart.tsx`
