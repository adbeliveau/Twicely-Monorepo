# Spec Compliance Reviewer - Agent Memory

> **DEPRECATED 2026-03-06:** This agent replaced by `/audit` command (Super Audit).
> Memory preserved as historical reference. New audit patterns go in main MEMORY.md.

## Key File Locations
- Schema spec: `read-me/TWICELY_V3_SCHEMA_v2_0_7.md` (being bumped to v2.0.8 with storefrontPage)
- Page registry: `read-me/TWICELY_V3_PAGE_REGISTRY.md`
- Feature lock-in: `read-me/TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md`
- Feature lock-in addendum: `read-me/TWICELY_V3_FEATURE_LOCKIN_ADDENDUM.md` (Sections 47-50)
- Decision rationale: `read-me/TWICELY_V3_DECISION_RATIONALE.md`
- Actors/security: `read-me/TWICELY_V3_ACTORS_SECURITY_CANONICAL.md`
- Pricing: `read-me/TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md`

## Schema Version
- Current version: v2.0.8 (134 tables in spec doc)
- Code has 139 pgTable() definitions -- 5 extra vs schema doc
- trialUsage + promotedListingEvent: NOW in spec TOC but lack column definitions
- Extra tables NOT in spec: buyerProtectionClaim, stripeEventLog, sellerScoreSnapshot
- CLAUDE.md references v2_0_7 but spec file is v2.0.8

## Ownership Model (Verified 2026-03-03)
- `listing.ownerUserId` = userId
- `storefront.ownerUserId` = userId
- `payout.userId` = userId
- `order.sellerId` / `order.buyerId` = userId
- `combinedShippingQuote.sellerId` / `.buyerId` = userId (verified 2026-03-04)

## CASL Architecture (Updated 2026-03-04)
- Staff abilities extracted to `staff-abilities.ts` (D2.2 refactor)
- `BuyerReview`, `WatcherOffer`, `BuyerBlockList`, `Coupon` CASL subjects REMOVED (were invented)
- `CombinedShippingQuote` subject ADDED for D2.2
- Buyer: `can('read'/'update', 'CombinedShippingQuote', { buyerId: userId })`
- Seller: `can('read'/'update', 'CombinedShippingQuote', { sellerId: userId })`
- Staff (orders.view/manage): read/update CombinedShippingQuote per scope

## D2.2 Combined Shipping Audit (2026-03-04)
### Key Bugs Found:
1. Notification data passes user IDs where display names are expected (recurring pattern)
2. `create-order.ts:275-276`: `maxShippingFormatted` and `deadlineFormatted` are empty strings
3. `shipping-quote.ts`: `orderNumber: quote.orderId` passes orderId not orderNumber
### Schema Match: EXACT (all 14 columns match spec section 19.3)
### Platform Settings: 4 keys match Feature Lock-In Addendum Section 50

## Common Violation Patterns
- Notification data routinely passes userId where display name expected
- Buyer/seller order detail pages use auth.api.getSession() not authorize() (pre-existing)
- `z.string().cuid2()` sometimes weakened to `z.string().min(1)` in refactors
- `as Record<K,V>` type assertions used for template spreads in templates.ts
- `getPlatformSetting()` called outside transaction context (inside tx blocks) -- acceptable for read-only settings

## Previous Audit Notes (Condensed)
- Phase B: 13 violations, 2 security, 6 inventions (2026-03-03)
- Phase C re-audit: CONDITIONAL PASS after 14 fixes
- Phase D: 12 violations (sellerId/sellerProfileId mismatch CRITICAL)
- watcher-offers.ts Zod validation: NOW ADDED in D2.2 changeset
- Invented CASL subjects: NOW REMOVED in D2.2 changeset

## CASL Condition Key Patterns (CRITICAL -- check every review)
- `Analytics` ability uses `{ sellerId }` -- sub() calls MUST use `{ sellerId: userId }` not `{ userId }`
- `LedgerEntry` ability uses `{ userId }` in ability.ts -- NOW added for sellers (was missing in D4 initial)
- `Expense/FinancialReport/MileageEntry` use `{ userId }` in both ability and sub() -- correct
- `Payout` uses `{ userId }` -- correct
- Watch for key name mismatches between ability definitions and sub() calls

## D4 Second-Pass Audit (2026-03-05) -- CONDITIONAL PASS (6 violations, 0 critical)
### Previously FIXED (14 fixes verified applied):
- LedgerEntry added for sellers in ability.ts line 167
- COGS implemented in KPI + expense functions
- Analytics CASL key uses `{ sellerId: userId }` correctly
- `finances/page.tsx` title "Finances | Twicely" (correct)
- All finance pages NOW use `authorize()` (including transactions)
- `snapshotData` type assertions eliminated via union type
- `report.snapshotJson` uses type guards (isPnlData etc)
- `cat.category` in report-pdf.ts escaped via `escapeHtml()`
- `finance-center-reports.ts` SPLIT into 3 files (all under 300 lines)
- All ID fields NOW use `z.string().cuid2()` (was `z.string().min(1)`)
- `getReportAction` NOW has Zod validation
- `window.location.reload()` replaced with `router.refresh()`
- Breadcrumb NOW says "Finances" not "Financial Center"
- receipt-ocr.ts NOW validates R2 hostname before external call
### REMAINING violations (6):
1. Payouts page title "Payout Settings | Twicely" vs Registry "Payouts | Twicely"
2. Mileage page title "Mileage | Twicely" vs Registry "Mileage Tracking | Twicely"
3. `getCogsSummaryAction` missing Zod validation on `days` param
4. `finance-center-expenses.ts` at 301 lines (borderline)
5. `monthlyCents` default 999 instead of 1499 in expenses + mileage pages
6. `as unknown as` in 8 query test files (mock pattern, not production)
### ONGOING unresolved (owner decisions needed):
- CASL subjects Expense/FinancialReport/MileageEntry NOT in Actors spec canonical table
- Recharts NOT in approved tech stack (no charting lib specified)
- `FinanceTier` type in enums.ts contradicts CLAUDE.md ban (but schema spec defines pgEnum)

## Previous Audit Notes (Condensed)
- Phase B: 13 violations, 2 security, 6 inventions
- Phase C re-audit: CONDITIONAL PASS after 14 fixes
- Phase D: 12 violations (sellerId/sellerProfileId mismatch CRITICAL)
- Phase E3: 5 violations (route, runtime bug, auth gates)
- Phase E2.1: CONDITIONAL PASS -- 6 violations (0 critical), 5 inventions

## E2.1 Crosslister Connector Framework (2026-03-05)
### Key Facts:
- 8 external channels: EBAY, POSHMARK, MERCARI, DEPOP, FB_MARKETPLACE, ETSY, GRAILED, THEREALREAL
- Tiers: A=eBay/Etsy, B=Mercari/Depop/Grailed(/FB_MARKETPLACE), C=Poshmark/TheRealReal
- Launch: eBay+Poshmark+Mercari enabled, others disabled
- 5 CASL subjects added, 4 delegation scopes added
- MANAGER preset NOT updated with crosslister scopes (violation)
- Seed severity uses 'ERROR' not 'BLOCK'/'WARN' (violation)
- FB_MARKETPLACE tier not explicitly in Lister Canonical Section 9.1

## Phase E Full Audit (2026-03-05) -- CONDITIONAL PASS (8 violations, 0 critical, 3 inventions)
### Key Findings:
- `/m` route from Page Registry does NOT exist -- messages at `/my/messages` (mobile nav links to `/m` which 404s)
- `notificationSetting` table INVENTED (not in schema spec Section 10, which has only 3 tables)
- `Conversation` + `ListingQuestion` CASL subjects INVENTED (not in 23-subject canonical table)
- Messages pages + notification settings use `auth.api.getSession()` not `authorize()`
- 7x console.error/warn in notification service.tsx + price-drop-notifier.ts (should use logger)
- Feature flag `flagId` uses `z.string().min(1)` not `z.string().cuid2()` in 3 schemas
- `templates.ts` at 322 lines, `qa.ts` at 305 lines (over 300 limit)
- Rate limit: Feature Lock-in says 30/hr, Platform Settings says 20/hr, code uses 20 fallback
### Passed: Schema match for messaging (9.1/9.2), notifications (10.1-10.3), Q&A (24.1), feature flags (14.3)
### Passed: All server actions use authorize()/staffAuthorize(), all hub pages properly auth-gated

## Recurring Violation Patterns (cross-phase)
- `z.string().min(1)` instead of `z.string().cuid2()` for ID fields -- found in D4, D4.1, D4.2, D4.3, E2.1, E4
- `as unknown as` in test mocks -- found in 8+ finance test files, also present in other domains
- `auth.api.getSession()` instead of `authorize()` -- messages pages, notification settings (E2), was fixed in finance pages (D4)
- Page titles deviating from Page Registry -- recurring across phases
- CASL subjects added to code but not added to Actors canonical spec -- now 10+ total (including Conversation, ListingQuestion, Expense, FinancialReport, MileageEntry, CombinedShippingQuote, plus crosslister subjects)
- Role preset MANAGER not updated when new delegation scopes are added
- `console.error/warn` in production code instead of structured logger -- notification system primary offender (7 occurrences)
- Files hitting or exceeding 300-line limit -- templates.ts (322), qa.ts (305), borderline in several others
