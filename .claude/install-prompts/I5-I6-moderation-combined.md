# [I5 + I6] Moderation Suite + Reviews Admin (Admin Panel V2-to-V3 Port)

**One-line Summary:** Enrich existing `/mod` pages with moderation queue, listing detail views, status filters, suppression workflow, dispute resolution rules config, and review detail/admin pages.

**Canonical Sources (read ALL before starting):**
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` (Sections 4, 5, 25, 42, 44 -- DSR, Buyer Ratings, Buyer Protection, Returns & Disputes, Seller Standards & Enforcement)
- `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` (Section 3.5 MODERATION role, Section 3.6 ADMIN, CASL pseudocode)
- `TWICELY_V3_SCHEMA_v2_1_0.md` (Tables: listing, review, reviewResponse, buyerReview, dispute, contentReport, enforcementAction, order, user)
- `TWICELY_V3_PAGE_REGISTRY.md` (Routes 98-101h under `/mod/*`)
- `TWICELY_V3_BUYER_PROTECTION_CANONICAL.md` (Claim flows, auto-close, escalation, platform settings)
- `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` (protection.*, returns.*, review.*, moderation.* keys)

---

## 1. PREREQUISITES

### What Must Be Complete
- Phase G complete (all 50 steps done, including G4 enforcement infrastructure, G4.1 seller standards, G4.2 appeal flow)
- Phase H steps up to H3.1 complete (current state)
- Existing `/mod` pages already built (E3.5, G4)
- contentReport + enforcementAction tables already exist (enforcement.ts)
- CASL MODERATION role already wired (platform-abilities.ts)
- All existing mod queries (admin-moderation.ts, content-reports.ts, enforcement-actions.ts) and actions (admin-moderation.ts, enforcement.ts) already exist

### What Already Exists (DO NOT recreate)

Pages:
```
src/app/(hub)/mod/page.tsx                      -- Overview with KPI stat cards + nav links
src/app/(hub)/mod/listings/page.tsx              -- Flagged listings table (enforcementState='FLAGGED')
src/app/(hub)/mod/reviews/page.tsx               -- Flagged reviews table (status='FLAGGED')
src/app/(hub)/mod/messages/page.tsx              -- Flagged messages (uses getFlaggedConversations)
src/app/(hub)/mod/disputes/page.tsx              -- Dispute list (OPEN + RESOLVED sections)
src/app/(hub)/mod/disputes/[id]/page.tsx         -- Dispute detail with buyer/seller/evidence/resolution
src/app/(hub)/mod/disputes/[id]/dispute-actions.tsx -- Client component: assign, resolve, process claim
src/app/(hub)/mod/reports/page.tsx               -- Content reports with status tabs
src/app/(hub)/mod/reports/[id]/page.tsx          -- Report detail with review/dismiss actions
src/app/(hub)/mod/enforcement/page.tsx           -- Enforcement action list
src/app/(hub)/mod/enforcement/[id]/page.tsx      -- Enforcement detail
src/app/(hub)/mod/enforcement/new/page.tsx       -- Create enforcement action form
src/app/(hub)/mod/returns/page.tsx               -- Return requests (active + resolved)
src/app/(hub)/mod/collections/page.tsx           -- Curated collections list
src/app/(hub)/mod/collections/[id]/page.tsx      -- Edit curated collection
src/app/(hub)/mod/collections/new/page.tsx       -- New curated collection
```

Queries:
```
src/lib/queries/admin-moderation.ts              -- getModerationKPIs, getFlaggedListings, getFlaggedReviews
src/lib/queries/content-reports.ts               -- getContentReports, getContentReportById, getContentReportCountByStatus, getUserReportHistory, getReportsForTarget
src/lib/queries/enforcement-actions.ts           -- getEnforcementActions, getEnforcementActionById, getActiveEnforcementForUser, getEnforcementHistory, getEnforcementKPIs, getAppealableActionsForUser, getAppealedEnforcementActions, getAppealKPIs
```

Actions:
```
src/lib/actions/admin-moderation.ts              -- removeListingAction, clearListingFlagAction, removeReviewAction, approveReviewAction
src/lib/actions/enforcement.ts                   -- (enforcement CRUD actions, reviewContentReportAction)
```

Components:
```
src/components/admin/actions/moderation-actions.tsx    -- ListingActions (Remove/Clear), ReviewActions (Remove/Approve)
src/components/admin/actions/report-review-actions.tsx -- ReportReviewActions (Confirm/Dismiss)
src/components/admin/actions/enforcement-actions.tsx   -- Enforcement action buttons
src/components/admin/flagged-messages-table.tsx        -- FlaggedMessagesTable
```

### Existing Enums (from src/lib/db/schema/enums.ts)
```typescript
enforcementStateEnum: ['CLEAR', 'FLAGGED', 'SUPPRESSED', 'REMOVED']
listingStatusEnum: ['DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'REMOVED', 'RESERVED']
reviewStatusEnum: ['PENDING', 'APPROVED', 'FLAGGED', 'REMOVED']
disputeStatusEnum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'APPEALED', 'APPEAL_RESOLVED', 'CLOSED']
contentReportStatusEnum: ['PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED']
contentReportTargetEnum: ['LISTING', 'REVIEW', 'MESSAGE', 'USER']
contentReportReasonEnum: ['COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY', 'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE', 'SHILL_REVIEWS', 'OTHER']
enforcementActionTypeEnum: ['COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION', 'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION', 'ACCOUNT_BAN']
enforcementActionStatusEnum: ['ACTIVE', 'EXPIRED', 'LIFTED', 'APPEALED', 'APPEAL_APPROVED']
enforcementTriggerEnum: ['SCORE_BASED', 'POLICY_VIOLATION', 'CONTENT_REPORT', 'ADMIN_MANUAL', 'SYSTEM_AUTO']
claimTypeEnum: ['INR', 'INAD', 'DAMAGED', 'COUNTERFEIT', 'REMORSE']
```

### Existing CASL Rules for MODERATION Role (from platform-abilities.ts lines 84-105)
```typescript
can('read', 'User');
can('read', 'Listing');
can('read', 'Review');
can('read', 'Message');
can('read', 'Conversation');
can('read', 'AuditEvent');
can('update', 'Listing');
can('update', 'SellerProfile');
can('update', 'Review');
can('read', 'LocalFraudFlag');
can('manage', 'LocalFraudFlag');
can('manage', 'CuratedCollection');
can('read', 'ContentReport');
can('update', 'ContentReport');
can('read', 'EnforcementAction');
can('create', 'EnforcementAction');
can('update', 'EnforcementAction');
```

NOTE: MODERATION role can `update` Listing (which includes changing enforcementState) and `update` Review (which includes changing review.status). MODERATION cannot read Dispute or Return -- those are SUPPORT/ADMIN. However, ADMIN has `manage all`, so the new `/mod/disputes/rules` page requires ADMIN role, not MODERATION.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

This step is decomposed into 3 sub-steps. All are sequential.

---

### Sub-Step I5.1: Moderation Queue + Listing Moderation Detail + Listings Enrichment

#### New Pages

**A) `/mod/queue/page.tsx` -- Moderation Queue (NEW)**

Unified moderation queue showing ALL pending work items in priority order. This is the primary landing page for moderators.

Data sources:
- Flagged listings (enforcementState = 'FLAGGED')
- Pending content reports (status = 'PENDING' or 'UNDER_REVIEW')
- Flagged reviews (status = 'FLAGGED')

Display as a single prioritized table. Priority ordering:
1. Oldest PENDING content reports first (first-in, first-out)
2. Flagged listings (by createdAt ascending)
3. Flagged reviews (by createdAt ascending)

Table columns: Priority (numeric), Type (badge: Listing/Report/Review), Target (title or ID truncated), Reporter/Source, Date Flagged, Status, Actions (link to detail page).

Claim/assign: "Claim" button changes contentReport.status to 'UNDER_REVIEW' and sets reviewedByStaffId to current staff. Already implemented in reviewContentReportAction for content reports.

Bulk actions: Checkboxes on each row. Bulk actions dropdown: "Dismiss Selected" (for reports) and "Clear Flags" (for listings/reviews). Implement via new server actions.

Stats bar at top: Total queue size, Items claimed by me, Avg time to resolve (last 30 days).

**B) `/mod/listings/[id]/page.tsx` -- Listing Moderation Detail (NEW)**

Detailed view of a specific listing for moderation review. Two-column layout.

Left column:
- Listing images (gallery from listingImage table, join on listingId)
- Listing title, description, price (formatted from cents), condition
- Category name (join to category table)
- Listing status badge + enforcement state badge
- Created date, activated date
- Tags array

Right column - Seller Context panel:
- Seller name (from user table via ownerUserId)
- Seller profile link (/usr/[ownerUserId])
- Seller performance band (from sellerPerformance table via sellerProfile)
- Average rating + total reviews
- Active enforcement actions count for this seller
- Previous reports against this seller's listings (using getReportsForTarget)

Bottom section - Report History:
- All contentReports targeting this listing (getReportsForTarget('LISTING', listingId))
- Table: Reporter, Reason, Date, Status

Action buttons (conditional on CASL `can('update', 'Listing')`):
- "Approve" -- sets enforcementState to 'CLEAR', audit event CLEAR_LISTING_FLAG (existing action)
- "Suppress" -- sets enforcementState to 'SUPPRESSED', audit event SUPPRESS_LISTING (new action)
- "Remove" -- sets enforcementState to 'REMOVED', audit event REMOVE_LISTING (existing action)
- "Flag" -- sets enforcementState to 'FLAGGED' (if currently CLEAR, useful for proactive moderation)
- Each action requires a reason text input (stored in audit event details)
- Link: "Issue Enforcement Action" (links to /mod/enforcement/new?userId={ownerUserId}&listingId={listingId})

**C) `/mod/listings/pending/page.tsx` -- Listings Awaiting First Review (NEW)**

Shows listings where enforcementState = 'FLAGGED' that have ZERO contentReport entries AND were flagged by system (not user report). This catches auto-flagged listings that need human review.

Query: Select listings where enforcementState = 'FLAGGED', LEFT JOIN contentReport WHERE targetType = 'LISTING' AND targetId = listing.id, filter WHERE contentReport.id IS NULL.

Table columns: Title, Seller, Price, Flagged Date, Actions (link to /mod/listings/[id]).

If no auto-flagging system exists yet, this page shows listings flagged without a corresponding content report (staff-flagged or system-flagged). Empty state: "No listings awaiting first review."

**D) `/mod/listings/suppressed/page.tsx` -- Suppressed Listings (NEW)**

Shows listings where enforcementState = 'SUPPRESSED'. These are listings hidden from search but not deleted.

Table columns: Title, Seller, Price, Suppressed Date (updatedAt), Reason (from most recent audit event where action = 'SUPPRESS_LISTING'), Actions.

Actions per row:
- "Reinstate" button -- sets enforcementState to 'CLEAR', requires reason, audit event REINSTATE_LISTING
- "Remove" button -- escalates to 'REMOVED'
- Link to /mod/listings/[id] for full detail

#### Enrichments to Existing Pages

**E) Enrich `/mod/listings/page.tsx` -- Add Status Filter Tabs**

Replace the current flat table with tabbed navigation similar to /mod/reports/page.tsx:
- Tabs: All | Flagged | Suppressed | Removed
- Default tab: Flagged
- "All" shows all listings where enforcementState != 'CLEAR'
- "Flagged" shows enforcementState = 'FLAGGED' (current behavior)
- "Suppressed" shows enforcementState = 'SUPPRESSED'
- "Removed" shows enforcementState = 'REMOVED'

Update getFlaggedListings query to accept an optional enforcementState filter parameter (currently hardcoded to 'FLAGGED'). Rename it to getModeratedListings to reflect broader scope.

Add a link column: each listing title links to /mod/listings/[id] detail page.

**F) Enrich `/mod/page.tsx` -- Add Queue Size Widget + More Stats**

Add to the existing stat cards:
- "Queue Size" stat: total of (flagged listings + pending reports + flagged reviews) -- already computed by getModerationKPIs, just display it as a single aggregated "Queue Size" card
- "Reports Today" stat: count of contentReports WHERE createdAt >= start of today (UTC)
- "Avg Resolution Time" stat: average time between contentReport.createdAt and contentReport.reviewedAt WHERE reviewedAt IS NOT NULL and reviewedAt >= 30 days ago. Display as hours.

Add a "Go to Queue" prominent button/link at top that navigates to /mod/queue.

#### New Queries

Add to `src/lib/queries/admin-moderation.ts`:

```typescript
// Rename getFlaggedListings -> getModeratedListings, add enforcementState filter
export async function getModeratedListings(
  enforcementFilter: 'FLAGGED' | 'SUPPRESSED' | 'REMOVED' | null,
  page: number,
  pageSize: number
): Promise<{ listings: ModeratedListingRow[]; total: number }>

// Get listing detail for moderation view
export async function getListingForModeration(listingId: string): Promise<ModeratedListingDetail | null>

// Get queue items (unified: flagged listings + pending reports + flagged reviews)
export async function getModerationQueue(
  page: number,
  pageSize: number
): Promise<{ items: ModerationQueueItem[]; total: number }>

// Get reports-today count + avg resolution time
export async function getModerationStats(): Promise<{
  reportsToday: number;
  avgResolutionHours: number;
}>

// Get suppressed listings with suppression reason from audit
export async function getSuppressedListings(
  page: number,
  pageSize: number
): Promise<{ listings: SuppressedListingRow[]; total: number }>

// Get listings pending first review (flagged but no content report)
export async function getPendingFirstReviewListings(
  page: number,
  pageSize: number
): Promise<{ listings: PendingListingRow[]; total: number }>
```

#### New Actions

Add to `src/lib/actions/admin-moderation.ts`:

```typescript
// Suppress a listing (enforcementState -> SUPPRESSED)
export async function suppressListingAction(input: unknown): Promise<{ success?: boolean; error?: string }>

// Reinstate a listing (enforcementState -> CLEAR from SUPPRESSED)
export async function reinstateListingAction(input: unknown): Promise<{ success?: boolean; error?: string }>

// Flag a listing proactively (enforcementState -> FLAGGED from CLEAR)
export async function flagListingAction(input: unknown): Promise<{ success?: boolean; error?: string }>

// Bulk dismiss content reports
export async function bulkDismissReportsAction(input: unknown): Promise<{ success?: boolean; error?: string }>

// Bulk clear listing flags
export async function bulkClearListingFlagsAction(input: unknown): Promise<{ success?: boolean; error?: string }>
```

Each action:
- Uses `staffAuthorize()` with CASL check
- Validates input with Zod `.strict()`
- Creates audit event with severity (SUPPRESS = HIGH, REINSTATE = MEDIUM, FLAG = MEDIUM, bulk actions = HIGH)
- Uses `revalidatePath('/mod')` after mutation
- Explicit field mapping (NEVER spread input into update)

---

### Sub-Step I5.2: Dispute Resolution Rules Config + Messages Enrichment

#### New Pages

**G) `/mod/disputes/rules/page.tsx` -- Dispute Resolution Rules Config (NEW)**

IMPORTANT: This page requires ADMIN role (not MODERATION) because it modifies platform_settings.

Displays and edits dispute resolution configuration using existing platform_settings values. NOT a new table -- uses existing `platform_settings` table reads/writes.

Settings displayed (from Buyer Protection canonical Section 8 and platform settings extended):
```
protection.standardClaimWindowDays: 30
protection.counterfeitClaimWindowDays: 60
protection.sellerResponseHours: 72
protection.autoApproveOnNonResponse: true
protection.maxClaimAmountCents: 2500000
protection.maxRestockingFeePercent: 15
protection.chargebackFeeCents: 1500
returns.sellerResponseDays: 3
returns.autoApproveUnderCents: 1000
returns.maxReturnsPerBuyerPerMonth: 10
payments.disputeSellerFeeCents: 2000
payments.waiveFirstDisputeFee: false
```

Layout: Two-column card grid.
- Card 1: "Claim Windows" -- standardClaimWindowDays, counterfeitClaimWindowDays
- Card 2: "Response & Escalation" -- sellerResponseHours, returns.sellerResponseDays, autoApproveOnNonResponse
- Card 3: "Auto-Close Conditions" -- returns.autoApproveUnderCents, returns.maxReturnsPerBuyerPerMonth
- Card 4: "Fees & Limits" -- maxClaimAmountCents, maxRestockingFeePercent, chargebackFeeCents, disputeSellerFeeCents, waiveFirstDisputeFee
- Card 5: "Escalation Thresholds" -- read-only display of current values with descriptions

Each card uses inline edit pattern (click value to edit, save button). Uses existing `updatePlatformSetting` from `src/lib/actions/admin-settings.ts` (or `updateSettingAction` for the Zod-validated variant).

CASL check: `ability.can('update', 'Setting')` -- this is ADMIN-only.

#### Enrichment to Existing Pages

**H) Enrich `/mod/messages/page.tsx` -- Add Keyword Filter + Flag Patterns**

The current page uses `getFlaggedConversations` and displays via `FlaggedMessagesTable`. Enrich by:

1. Adding a search input that filters by keyword in the flagged message content. Pass keyword as a query parameter `?q=` and filter server-side.
2. Adding a "Flag Patterns" summary section above the table showing the top 5 most common contentReport reasons for MESSAGE-type reports in the last 30 days (e.g., "FEE_AVOIDANCE: 12, HARASSMENT: 8, SPAM: 5").

New query: `getMessageFlagPatterns()` -- groups contentReport WHERE targetType = 'MESSAGE' AND createdAt >= 30 days ago BY reason, orders by count DESC, limits to 5.

Update `getFlaggedConversations` (in messaging-admin.ts) to accept an optional keyword filter parameter.

---

### Sub-Step I6: Reviews Admin

#### New Pages

**I) `/mod/reviews/[id]/page.tsx` -- Review Detail (NEW)**

Detailed view of a single review for moderation.

Left column - Review Content:
- Star rating display (1-5 stars, use existing star rendering pattern)
- DSR breakdown if present: Item As Described, Shipping Speed, Communication, Packaging Quality
- Review title (if present)
- Review body text
- Review photos gallery (from review.photos array)
- "Verified Purchase" badge (review.isVerifiedPurchase)
- Review date
- Flag reason (review.flagReason) + who flagged (review.flaggedByUserId)

Right column - Context:
- Buyer info: name + link to /usr/[reviewerUserId]
- Seller info: name + link to /usr/[sellerId]
- Order info: link to /tx/orders/[orderId]
- Seller's response (from reviewResponse table, join on reviewId) -- show body + date if exists
- Content reports targeting this review: getReportsForTarget('REVIEW', reviewId)

Actions (conditional on `can('update', 'Review')`):
- "Approve" -- sets review.status to 'APPROVED' (existing approveReviewAction)
- "Remove" -- sets review.status to 'REMOVED', requires reason text, sets removedByStaffId + removedReason (enhance existing removeReviewAction)
- "Flag" -- sets review.status to 'FLAGGED' if currently APPROVED (new action for proactive flagging)

New query: `getReviewForModeration(reviewId: string)` -- fetches review with joined reviewer/seller user info, order info, reviewResponse, and content reports.

#### Enrichment to Existing Pages

**J) Enrich `/mod/reviews/page.tsx` -- Add Filters + Bulk Actions**

Replace the current flat flagged-only table with:

1. Filter by rating: Dropdown or radio buttons (All, 1 star, 2 stars, 3 stars, 4 stars, 5 stars). Filters reviews shown.
2. Reported-only toggle: Toggle switch. When ON (default), shows only FLAGGED reviews. When OFF, shows ALL reviews for browsing.
3. Search by keyword: Text input searching review.body content.
4. Each review row links to /mod/reviews/[id] detail page.
5. Bulk actions: Checkboxes + "Bulk Approve" and "Bulk Remove" buttons.

Update `getFlaggedReviews` query to accept optional filters: rating, status (not just FLAGGED), keyword search in body. Rename to `getModeratedReviews`.

New actions:
```typescript
// Flag a review proactively
export async function flagReviewAction(input: unknown): Promise<{ success?: boolean; error?: string }>

// Bulk approve reviews
export async function bulkApproveReviewsAction(input: unknown): Promise<{ success?: boolean; error?: string }>

// Bulk remove reviews
export async function bulkRemoveReviewsAction(input: unknown): Promise<{ success?: boolean; error?: string }>
```

Enhance `removeReviewAction` to accept and store `reason` text (setting review.removedReason and review.removedByStaffId).

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Critical Restrictions
- **DO NOT modify `src/lib/hub/admin-nav.ts`** -- reserved for I17. All new pages are under the existing `/mod` route group and will be discoverable via the existing nav links.
- **DO NOT create new database tables.** All new pages use existing tables (listing, review, contentReport, enforcementAction, order, user, reviewResponse, listingImage, sellerPerformance, auditEvent).
- **DO NOT modify existing schema files.** All columns already exist.
- **DO NOT hardcode fee rates or thresholds.** Dispute rules page reads from platform_settings table.
- **DO NOT use `as any`, `@ts-ignore`, or `@ts-expect-error`.** Fix the types.
- **DO NOT create files over 300 lines.** Split if needed.
- **DO NOT expose internal IDs in error messages.** Use "Not found", never "You don't have access to listing X."

### Vocabulary
- Use `enforcementState` not "moderation status" in code
- Use `ownerUserId` to reference listing owner, never `sellerId` (the listing schema uses `ownerUserId`)
- Stars display: use existing star rendering pattern or star icons, not custom rating components
- When displaying amounts: format from integer cents using existing formatPrice/formatCents pattern already used in mod pages

### Authorization Rules
- `/mod/queue`, `/mod/listings/*`, `/mod/reviews/*`, `/mod/messages` -- require MODERATION or ADMIN role via `staffAuthorize()` + CASL check
- `/mod/disputes/rules` -- requires ADMIN role (setting writes need `can('update', 'Setting')`)
- Bulk actions -- same CASL check as individual actions, iterated
- All mutation actions -- audit event required

### Tech Stack
- Drizzle ORM for all queries (NOT Prisma)
- Zod `.strict()` on all input validation schemas
- `staffAuthorize()` from `@/lib/casl/staff-authorize` for auth
- Server actions with `'use server'` directive
- `revalidatePath` after mutations
- No client-side state management libraries -- use React `useState` / `useTransition` for client components

---

## 4. ACCEPTANCE CRITERIA

### I5.1: Moderation Queue + Listing Detail + Listings Enrichment

1. `/mod/queue` renders a unified table combining flagged listings, pending content reports, and flagged reviews, sorted by oldest first
2. `/mod/queue` shows stats bar: total queue size, items claimed by current staff, avg resolution time
3. `/mod/queue` bulk actions (dismiss reports, clear listing flags) work and create audit events
4. `/mod/listings/[id]` displays full listing detail (images, title, description, price, condition, tags)
5. `/mod/listings/[id]` displays seller context (name, performance band, average rating, enforcement history)
6. `/mod/listings/[id]` displays report history for that listing
7. `/mod/listings/[id]` action buttons: Approve, Suppress, Remove, Flag -- each requires reason, creates audit event
8. `/mod/listings/pending` shows only flagged listings with no associated content reports
9. `/mod/listings/suppressed` shows suppressed listings with reason from audit events, has Reinstate + Remove actions
10. `/mod/listings` page now has status filter tabs: All / Flagged / Suppressed / Removed
11. `/mod/listings` each listing title links to /mod/listings/[id]
12. `/mod` overview page shows queue size + reports today + avg resolution time in stat cards
13. `/mod` has prominent "Go to Queue" link
14. `suppressListingAction` sets enforcementState to 'SUPPRESSED' and creates HIGH severity audit event
15. `reinstateListingAction` sets enforcementState to 'CLEAR' from 'SUPPRESSED' and creates MEDIUM audit event
16. All new actions return `{ error: 'Forbidden' }` when CASL denies access
17. All new actions validate input with Zod `.strict()` -- unknown keys rejected

### I5.2: Dispute Rules Config + Messages Enrichment

18. `/mod/disputes/rules` page renders dispute resolution settings in card grid layout, reading from platform_settings
19. `/mod/disputes/rules` page requires ADMIN role (not MODERATION)
20. `/mod/disputes/rules` inline edit saves via existing updatePlatformSettingAction, creates audit event
21. `/mod/messages` has a keyword search input filtering flagged messages server-side
22. `/mod/messages` shows flag pattern summary (top 5 reasons for MESSAGE-type reports in last 30 days)

### I6: Reviews Admin

23. `/mod/reviews/[id]` displays full review detail (rating, DSR, body, photos, flag reason)
24. `/mod/reviews/[id]` displays buyer + seller context with links to /usr/[id]
25. `/mod/reviews/[id]` displays seller response if exists (from reviewResponse table)
26. `/mod/reviews/[id]` displays content reports targeting this review
27. `/mod/reviews/[id]` action buttons: Approve, Remove (with reason), Flag
28. `/mod/reviews` has rating filter dropdown
29. `/mod/reviews` has reported-only toggle (default ON = only FLAGGED, OFF = all reviews)
30. `/mod/reviews` has keyword search in review body
31. `/mod/reviews` each row links to /mod/reviews/[id]
32. `/mod/reviews` has bulk approve and bulk remove actions
33. Enhanced `removeReviewAction` stores reason in review.removedReason and staffId in review.removedByStaffId
34. `flagReviewAction` sets review.status to 'FLAGGED' with audit event

### Negative Cases

35. Unauthenticated requests to any /mod/* page redirect to login (staffAuthorize throws)
36. FINANCE role cannot access any /mod/* page (no CASL read on Listing/Review)
37. MODERATION role cannot access /mod/disputes/rules (no can('update', 'Setting'))
38. Bulk actions with empty array return error, do not create audit events
39. suppressListingAction on already-suppressed listing is idempotent (succeeds, no error)
40. removeReviewAction without reason still works (reason is optional in schema) but audit event records empty reason
41. No banned terms appear in any UI text or code: no "FVF", no "wallet", no "Twicely Balance", no "withdraw"

---

## 5. TEST REQUIREMENTS

### Unit Tests (Server Actions)

**File: `src/lib/actions/__tests__/admin-moderation-enriched.test.ts`**
Follow existing pattern from `admin-moderation.test.ts` (mock staffAuthorize, mock db, use makeUpdateChain/makeInsertChain helpers).

Tests:
- `suppressListingAction` -- returns Forbidden when CASL denies
- `suppressListingAction` -- validates input with Zod strict (rejects unknown keys)
- `suppressListingAction` -- sets enforcementState to SUPPRESSED and creates audit event
- `reinstateListingAction` -- returns Forbidden when CASL denies
- `reinstateListingAction` -- validates input, reinstates listing, creates audit event
- `flagListingAction` -- flags a CLEAR listing, creates audit event
- `bulkDismissReportsAction` -- validates array input, dismisses all, creates audit events
- `bulkDismissReportsAction` -- returns error on empty array
- `bulkClearListingFlagsAction` -- clears flags on multiple listings
- `flagReviewAction` -- flags an APPROVED review, creates audit event
- `flagReviewAction` -- returns Forbidden when CASL denies
- `bulkApproveReviewsAction` -- approves multiple reviews, creates audit events
- `bulkRemoveReviewsAction` -- removes multiple reviews, creates audit events
- `removeReviewAction` (enhanced) -- stores removedReason and removedByStaffId

**File: `src/lib/queries/__tests__/admin-moderation-enriched.test.ts`**
Tests:
- `getModeratedListings` -- returns listings filtered by enforcementState
- `getModeratedListings` -- returns all non-CLEAR when filter is null
- `getModerationQueue` -- returns items from all three sources in priority order
- `getModerationStats` -- returns reportsToday count and avgResolutionHours
- `getListingForModeration` -- returns full listing with images, seller info, reports
- `getListingForModeration` -- returns null for non-existent listing
- `getSuppressedListings` -- returns only SUPPRESSED listings
- `getPendingFirstReviewListings` -- returns flagged listings with no content reports
- `getReviewForModeration` -- returns review with context (buyer, seller, response, reports)
- `getReviewForModeration` -- returns null for non-existent review
- `getModeratedReviews` -- filters by rating, status, keyword
- `getMessageFlagPatterns` -- returns top 5 reasons for MESSAGE reports in last 30 days

### Test Count Impact
Expected new tests: ~40-50 tests across 2 test files. Test baseline should increase accordingly.

---

## 6. FILE APPROVAL LIST

### Sub-Step I5.1 (Queue + Listing Detail + Listings Enrichment)
```
NEW  src/app/(hub)/mod/queue/page.tsx                            -- Unified moderation queue page
NEW  src/app/(hub)/mod/listings/[id]/page.tsx                    -- Listing moderation detail page
NEW  src/app/(hub)/mod/listings/[id]/listing-mod-actions.tsx     -- Client component: Approve/Suppress/Remove/Flag buttons
NEW  src/app/(hub)/mod/listings/pending/page.tsx                 -- Listings pending first review
NEW  src/app/(hub)/mod/listings/suppressed/page.tsx              -- Suppressed listings with reinstate
EDIT src/app/(hub)/mod/listings/page.tsx                         -- Add status filter tabs
EDIT src/app/(hub)/mod/page.tsx                                  -- Add queue size widget, reports today, avg resolution time, Go to Queue link
EDIT src/lib/queries/admin-moderation.ts                         -- Add getModeratedListings, getModerationQueue, getModerationStats, getListingForModeration, getSuppressedListings, getPendingFirstReviewListings. Keep getFlaggedListings as alias.
EDIT src/lib/actions/admin-moderation.ts                         -- Add suppressListingAction, reinstateListingAction, flagListingAction, bulkDismissReportsAction, bulkClearListingFlagsAction
NEW  src/lib/actions/__tests__/admin-moderation-enriched.test.ts -- Tests for new actions
NEW  src/lib/queries/__tests__/admin-moderation-enriched.test.ts -- Tests for new queries
```

### Sub-Step I5.2 (Dispute Rules + Messages)
```
NEW  src/app/(hub)/mod/disputes/rules/page.tsx                   -- Dispute resolution rules config
EDIT src/app/(hub)/mod/messages/page.tsx                         -- Add keyword search + flag patterns
EDIT src/lib/queries/admin-moderation.ts                         -- Add getMessageFlagPatterns (or add to separate file)
```

### Sub-Step I6 (Reviews Admin)
```
NEW  src/app/(hub)/mod/reviews/[id]/page.tsx                     -- Review detail page
NEW  src/app/(hub)/mod/reviews/[id]/review-mod-actions.tsx       -- Client component: Approve/Remove/Flag buttons
EDIT src/app/(hub)/mod/reviews/page.tsx                          -- Add rating filter, reported-only toggle, keyword search, bulk actions, row links
EDIT src/lib/queries/admin-moderation.ts                         -- Add getReviewForModeration, rename getFlaggedReviews -> getModeratedReviews (keep alias)
EDIT src/lib/actions/admin-moderation.ts                         -- Add flagReviewAction, bulkApproveReviewsAction, bulkRemoveReviewsAction. Enhance removeReviewAction.
```

### Total
- **NEW files: 8**
- **EDIT files: 7** (some edited in multiple sub-steps)
- **Test files: 2 new**

---

## 7. VERIFICATION CHECKLIST

After implementation, run and paste FULL raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test count (must be >= BASELINE)
pnpm test

# 3. Banned terms + lint checks
./twicely-lint.sh

# 4. Verify new pages render (no import errors)
# Check that each new page file exports a default async function component

# 5. File size check -- verify no file over 300 lines
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20
```

Expected outcomes:
- TypeScript: 0 errors
- Tests: BASELINE + ~40-50 new tests (all passing)
- Banned terms: 0 occurrences
- No file over 300 lines
- All new pages use `staffAuthorize()` as first call
- All new actions use Zod `.strict()` validation
- All mutations create audit events
- No `as any`, no `@ts-ignore`

---

## 8. SPEC GAPS AND OWNER DECISIONS NEEDED

### NOT SPECIFIED -- Owner Decision Needed

1. **Moderation queue priority formula:** The spec does not define a specific numeric priority formula. The prompt specifies "oldest first" as a reasonable default. Should there be a weighted priority (e.g., COUNTERFEIT reports higher than SPAM)? **Decision needed.**

2. **Queue claim behavior for listings/reviews:** Content reports have a built-in status field (UNDER_REVIEW) and reviewedByStaffId. Listings and reviews do NOT have a "claimed by" field. Should we add an `assignedToStaffId` column to the listing table? Or is claim-tracking only for content reports? **Recommendation: Track claims only for content reports (existing field). Listings/reviews don't need claim tracking -- the moderator acts directly (approve/remove/suppress) without claiming first.**

3. **Dispute rules page -- which settings exist?** The platform_settings_extended seed file has `payments.disputeSellerFeeCents` and `payments.waiveFirstDisputeFee` but does NOT have `protection.autoApproveOnNonResponse` or `protection.maxClaimAmountCents`. The Buyer Protection canonical lists these as platform settings but they may not be seeded yet. **Recommendation: The page should render whatever protection.* and returns.* keys exist in platform_settings. If a key is missing, show "Not configured" with a note. Do NOT create new seed entries -- that belongs to a separate seed task.**

4. **Keyword search in messages:** The existing `getFlaggedConversations` query may not have message body content readily available for keyword search. If message content is not joined in the current query, the keyword filter would require a new query joining the `message` table. **Verify the existing query shape before implementing.**

5. **Bulk action limit:** No spec defines a maximum bulk action size. **Recommendation: Cap at 50 items per bulk action to prevent accidental mass operations. Validate in Zod schema: `z.array(z.string().min(1)).min(1).max(50)`.**

---

## 9. PATTERN REFERENCES

### Existing Page Pattern (use as template)
- `/mod/reports/page.tsx` -- Status tabs pattern (STATUS_TABS array, Link-based tabs, searchParams filtering)
- `/mod/reports/[id]/page.tsx` -- Detail page pattern (staffAuthorize, fetch by ID, notFound if null, two-column layout)
- `/mod/disputes/[id]/dispute-actions.tsx` -- Client action component pattern (useTransition, useState, router.refresh)

### Existing Action Pattern (use as template)
- `src/lib/actions/admin-moderation.ts` -- Zod strict schema, staffAuthorize, CASL check, db update with explicit field mapping, audit event insert

### Existing Query Pattern (use as template)
- `src/lib/queries/admin-moderation.ts` -- Paginated queries with count + offset, user name resolution via separate query + Map, return { items, total }

### Existing Test Pattern (use as template)
- `src/lib/actions/__tests__/admin-moderation.test.ts` -- Mock staffAuthorize, mock db with update/insert chains, mock drizzle-orm, mock schema, test Forbidden + validation + success paths
