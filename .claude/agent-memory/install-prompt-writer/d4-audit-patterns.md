# D4 Audit Patterns

## Common D4 Finance Defects Found
1. `finance-center-reports.ts` was 617 lines -- split into 3 files + barrel re-export
2. Server actions serialize Date objects to ISO strings -- client components MUST wrap in `new Date()` before calling date methods
3. `auth.api.getSession()` used in 2 pages instead of `authorize()` -- bypasses CASL
4. `feesCents: 0` hardcoded in revenue time series -- remove unused/misleading fields rather than leaving zeros
5. `pendingRefundsCents: 0` hardcoded in balance sheet -- query actual PENDING refund ledger entries
6. ID fields using `z.string().min(1)` instead of `z.string().cuid2()` -- all resource IDs should use cuid2
7. `getReportAction` took raw `reportId: string` instead of `input: unknown` with Zod validation
8. `window.location.reload()` used instead of `router.refresh()` from next/navigation
9. Native `confirm()` used instead of Dialog component for delete confirmation
10. Missing breadcrumbs on sub-pages (expenses, mileage, statements)
11. statements/page.tsx missing seller profile check (expenses and mileage had it)
12. Breadcrumb said "Financial Center" instead of "Finances" (Page Registry #50 says "Finances | Twicely")
13. `listExpensesAction` and `listMileageAction` missing PRO tier gate (CUD actions had it, list didn't)
14. receipt-ocr.ts URL validation used simple `startsWith` check -- needs `new URL()` hostname comparison

## Patterns to Reuse in Future Audits
- Delete confirmation: use state-driven Dialog, NOT native `confirm()`. Pattern in expense-list.tsx (lines 170-183)
- Breadcrumb pattern: `<Link href="/parent" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"><ChevronLeft className="h-4 w-4" />Parent Name</Link>`
- Page auth: always `const { session } = await authorize()` then `if (!session) redirect(...)` then `session.userId`
- Seller profile gate: check `getSellerProfile(session.userId)` and show "Start Selling First" card if null
- Finance PRO gate: check `getFinanceTier(userId)` and show `<FinanceProGate>` if FREE
- URL validation: `new URL()` + hostname comparison, not `startsWith`

## D4 File Structure After Audit
- `queries/finance-center.ts` - KPIs, revenue time series, finance tier, barrel re-exports
- `queries/finance-center-detail.ts` - Recent transactions, expense summary, mileage summary
- `queries/finance-center-expenses.ts` - Expense list/CRUD queries
- `queries/finance-center-mileage.ts` - Mileage list/CRUD queries
- `queries/finance-center-reports.ts` - BARREL re-export only (~10 lines)
- `queries/finance-center-reports-pnl.ts` - P&L report data assembly
- `queries/finance-center-reports-balance-cashflow.ts` - Balance sheet + cash flow
- `queries/finance-center-reports-list.ts` - Report list + getById
