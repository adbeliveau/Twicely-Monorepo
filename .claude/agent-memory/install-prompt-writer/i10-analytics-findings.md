# I10 Analytics — Findings

## Scope
- 2 pages: `/analytics` (enrich existing stub), `/analytics/sellers` (new)
- 7 files total (3 create, 1 replace, 2 test files, 1 client component)
- Dependencies: E3.1 (dashboard), existing tables only

## Key Schema Facts
- `order.status` uses `orderStatusEnum`: CREATED, PAYMENT_PENDING, PAID, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, COMPLETED, CANCELED, REFUNDED, DISPUTED
- GMV = SUM of order.totalCents WHERE status IN ('COMPLETED', 'DELIVERED')
- `ledgerEntry.amountCents` is SIGNED: positive = credit to seller, negative = debit. Fee entries are negative (debits).
- Fee ledger types: ORDER_TF_FEE, ORDER_BOOST_FEE, INSERTION_FEE, SUBSCRIPTION_CHARGE, LOCAL_TRANSACTION_FEE, CROSSLISTER_PLATFORM_FEE
- EXCLUDE ORDER_STRIPE_PROCESSING_FEE from take rate (that's Stripe's revenue, not Twicely's)
- Only count POSTED ledger entries for revenue (not PENDING or REVERSED)

## CASL State
- `Analytics` subject registered in subjects.ts (line 29), permission-registry-data.ts (line 143)
- FINANCE role has `can('read', 'Analytics')` in platform-abilities.ts (line 116)
- ADMIN has `can('manage', 'all')` which covers Analytics
- No CASL changes needed for I10

## Existing Components
- `StatCard` at src/components/admin/stat-card.tsx — supports `change` prop with { value: number, period: string }
- `ChartCard` at src/components/admin/chart-card.tsx — client component with period tabs (7d/30d/90d)
- `AdminPageHeader` at src/components/admin/admin-page-header.tsx

## Admin Nav
- Analytics entry already at admin-nav.ts lines 43-49, roles: ['ADMIN', 'FINANCE']
- No nav changes needed

## Critical Join Warning
- `sellerProfile.id` is CUID2 PK. `sellerProfile.userId` references user.id.
- `order.sellerId` = userId (NOT sellerProfile.id)
- Join: `order.sellerId = sellerProfile.userId`, NOT `order.sellerId = sellerProfile.id`

## No Spec Gaps
- Page Registry row 126 specifies exact scope: "GMV, take rate, user growth, cohort retention"
- Build Tracker confirms 2 pages: /analytics dashboard + /analytics/sellers table
