# TWICELY V3 — B5 Seller Dashboard Build Prompt

**Phase:** B5 | **Depends On:** B4 (Order Management) | **Enables:** B5.1, B5.2, C3
**User Story:** "As a seller, I see my stats, listings, orders, and shipping profiles in one place"

---

## DOCUMENTS TO READ BEFORE WRITING ANY CODE

Read ALL of these. Do not skim. Do not skip.

1. `TWICELY_V3_BUILD_BRIEF.md` — Execution rules, build order, file approval protocol
2. `TWICELY_V3_PAGE_REGISTRY.md` — Pages #38, #39, #43, #69 + Section 4.1 (Seller Page States)
3. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — §8 (Shipping Improvements), §9 (Seller Analytics)
4. `TWICELY_V3_FEATURE_LOCKIN_ADDENDUM.md` — §50 (Combined Shipping — 5 modes)
5. `TWICELY_V3_SCHEMA.md` — Section 5.6 (`shippingProfile` table)
6. `TWICELY_V3_SCHEMA_ADDENDUM_v1_2.md` — `shippingProfile` field additions (5 combined shipping fields)
7. `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — CASL gates for SELLER and DELEGATE actors
8. `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` — §12 (Seller Finance Routes, data contracts for overview)

---

## SCOPE — WHAT B5 DELIVERS

B5 has THREE sub-slices. Build them in order.

### B5.0 — Seller Overview Dashboard (enhance existing `/my/selling`)

This page already exists from B2 (basic shell). B5 replaces it with a real dashboard.

**Route:** `/my/selling`
**Gate:** SELLER or DELEGATE(analytics.view)
**Page Registry:** #38

**Dashboard Widgets (4 cards across top):**

| Widget | Data Source | Display |
|--------|-----------|---------|
| Revenue (30 days) | SUM of `orderItem.priceCents` for seller's completed orders in last 30 days | Dollar amount + % change vs prior 30 days |
| Orders (30 days) | COUNT of seller's orders in last 30 days | Number + "X awaiting shipment" subtitle |
| Active Listings | COUNT of seller's listings WHERE status = 'ACTIVE' | Number + "X draft" subtitle |
| Views (30 days) | SUM of `listingView` records for seller's listings in last 30 days | Number + % change vs prior 30 days |

**Quick Actions Bar (below widgets):**
- "Create Listing" → `/my/selling/listings/new`
- "View Orders" → `/my/selling/orders`
- "Shipping Profiles" → `/my/selling/shipping`

**Recent Activity Feed (below quick actions):**
- Last 10 events: new orders, items sold, new watchers, listing views milestones
- Each row: icon + description + relative timestamp
- Query from `order` + `watchlistItem` tables, merge and sort by date

**Awaiting Shipment Alert (conditional, top of page):**
- If any orders have status 'PAID' and are past 75% of handling time: show orange banner
- "You have X orders awaiting shipment. Ship by [date] to maintain your on-time rate."
- Links to `/my/selling/orders?status=AWAITING_SHIPMENT`

### B5.1 — Shipping Profile Management

**Route:** `/my/selling/shipping`
**Gate:** SELLER or DELEGATE(shipping.manage)
**Page Registry:** #69

**Page States (from Page Registry §4.1):**
- LOADING: Card skeleton (3 placeholders)
- EMPTY: "Set up shipping profiles to save time" + "Create Shipping Profile" CTA
- POPULATED: Profile cards (name, carrier, service, handling time, default badge, combined shipping mode) + "Create New" button
- Maximum 3 profiles per seller (no Store) / 10 profiles (Store Starter+)

**Shipping Profile Card shows:**
- Profile name (editable)
- Carrier + service level
- Handling time (X business days)
- Package dimensions (if set)
- Weight (if set)
- Default badge (star icon) — one profile must be default
- Combined shipping mode indicator
- Edit / Delete buttons

**Create/Edit Form (modal or inline):**

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| name | text | Yes | — | max 50 chars, unique per user |
| carrier | select | Yes | USPS | USPS, UPS, FedEx, DHL |
| service | select | No | — | Carrier-dependent options |
| handlingTimeDays | number | Yes | 3 | 1–10 |
| isDefault | toggle | No | false | Only one can be true |
| weightOz | number | No | — | 1–1200 |
| lengthIn | number | No | — | 0.1–108 |
| widthIn | number | No | — | 0.1–108 |
| heightIn | number | No | — | 0.1–108 |

**Combined Shipping Mode Configuration (on same form, below dimensions):**

```
Combined Shipping
─────────────────
How do you want to handle multi-item orders?

◯ Individual shipping (each item ships separately)       ← default
◯ Flat combined fee: $[____] for any bundle
◯ Per additional item: +$[____] per extra item
◯ Auto-discount: [__]% off total shipping
◯ I'll quote shipping after each order (48-hour window)

ℹ️ If you choose "quote after order" and don't respond
   within 48 hours, buyer automatically gets 25% off shipping.
```

| Mode | Field | Validation |
|------|-------|------------|
| INDIVIDUAL | — | No extra fields |
| FLAT | flatCombinedCents | 1–99999 ($0.01–$999.99) |
| PER_ADDITIONAL | additionalItemCents | 1–99999 |
| AUTO_DISCOUNT | autoDiscountPercent | 10–75, autoDiscountMinItems default 2, range 2–20 |
| QUOTED | — | No extra fields, shows 48hr warning |

**Schema fields (from Schema Addendum v1.2, already on `shippingProfile`):**
```
combinedShippingMode    → combinedShippingModeEnum, default 'NONE'
flatCombinedCents       → integer, nullable
additionalItemCents     → integer, nullable
autoDiscountPercent     → real, nullable (10–75)
autoDiscountMinItems    → integer, default 2
```

**Delete behavior:**
- Cannot delete the default profile — must set another as default first
- Cannot delete a profile that's assigned to active listings — show warning with count
- Soft confirmation dialog: "This profile is used by X listings. Those listings will revert to no shipping profile."

### B5.2 — Listing Management (Bulk Actions + Filters)

**Route:** `/my/selling/listings` (enhance existing page)
**Gate:** SELLER or DELEGATE(listings.view) for viewing, DELEGATE(listings.manage) for actions
**Page Registry:** #39

**Status Tabs:**
- All | Active | Draft | Paused | Sold | Ended
- Tab shows count in badge: "Active (42)"
- URL reflected: `/my/selling/listings?status=ACTIVE`

**Listing Table Columns:**

| Column | Width | Content |
|--------|-------|---------|
| Checkbox | 40px | Bulk select |
| Image | 60px | First listing image thumbnail |
| Title | flex | Listing title (truncated, links to edit) |
| Price | 100px | Current price, original price strikethrough if different |
| Status | 100px | Status badge (color-coded) |
| Views | 80px | View count |
| Watchers | 80px | Watcher count |
| Listed | 100px | Date listed (relative: "3d ago") |
| Actions | 80px | Three-dot menu |

**Per-Row Actions (three-dot menu):**
- Edit → `/my/selling/listings/[id]/edit`
- Pause (if ACTIVE) → sets status PAUSED
- Resume (if PAUSED) → sets status ACTIVE
- End Listing (if ACTIVE or PAUSED) → sets status ENDED
- Duplicate → creates draft copy
- Delete (if DRAFT or ENDED) → soft delete

**Bulk Actions Toolbar (appears when 1+ items selected):**
- "X selected" count
- Pause Selected (only ACTIVE items)
- Resume Selected (only PAUSED items)
- End Selected (ACTIVE or PAUSED items)
- Delete Selected (DRAFT or ENDED items)
- Select All on Page / Deselect All

**Search within listings:**
- Text search by title (ILIKE query)
- Debounced, 300ms delay

**Pagination:**
- 25 items per page
- Offset-based pagination with page numbers

---

## SERVER ACTIONS & QUERIES

### Queries (read-only, in `src/lib/queries/`)

| Function | File | Returns |
|----------|------|---------|
| `getSellerDashboardStats(userId)` | `seller-dashboard.ts` | { revenue30d, revenuePrev30d, orders30d, ordersPrev30d, activeListings, draftListings, views30d, viewsPrev30d, awaitingShipmentCount } |
| `getSellerRecentActivity(userId, limit)` | `seller-dashboard.ts` | Array of { type, description, timestamp, linkUrl } |
| `getSellerShippingProfiles(userId)` | `shipping-profiles.ts` | Array of shippingProfile rows |
| `getShippingProfileById(profileId, userId)` | `shipping-profiles.ts` | Single shippingProfile or null |
| `getShippingProfileListingCount(profileId)` | `shipping-profiles.ts` | number |
| `getSellerListings(userId, filters)` | `seller-listings.ts` | { listings: Array, totalCount, pageCount } |
| `getSellerListingCounts(userId)` | `seller-listings.ts` | { all, active, draft, paused, sold, ended } |

### Server Actions (mutations, in `src/lib/actions/`)

| Action | File | Input | Behavior |
|--------|------|-------|----------|
| `createShippingProfile(data)` | `shipping-profiles.ts` | CreateShippingProfileInput | Validate max profiles, insert, set default if first |
| `updateShippingProfile(id, data)` | `shipping-profiles.ts` | UpdateShippingProfileInput | Validate ownership, update, handle default swap |
| `deleteShippingProfile(id)` | `shipping-profiles.ts` | profileId | Validate ownership, check no active listing deps, delete |
| `setDefaultShippingProfile(id)` | `shipping-profiles.ts` | profileId | Validate ownership, unset old default, set new |
| `bulkUpdateListingStatus(ids, status)` | `seller-listings.ts` | { listingIds, newStatus } | Validate ownership of all, validate status transitions, update all |
| `bulkDeleteListings(ids)` | `seller-listings.ts` | listingIds | Validate ownership, validate all DRAFT or ENDED, soft delete |

---

## FILE PLAN

List every file to create or modify. Wait for approval before writing code.

### New Files

| # | Path | Description | Est. Lines |
|---|------|-------------|------------|
| 1 | `src/lib/queries/seller-dashboard.ts` | Dashboard stats + recent activity queries | ~120 |
| 2 | `src/lib/queries/shipping-profiles.ts` | Shipping profile CRUD queries | ~80 |
| 3 | `src/lib/queries/seller-listings.ts` | Seller listing queries with filters, counts, pagination | ~120 |
| 4 | `src/lib/actions/shipping-profiles.ts` | Shipping profile create/update/delete/setDefault actions | ~180 |
| 5 | `src/lib/actions/seller-listings.ts` | Bulk status update + bulk delete actions | ~120 |
| 6 | `src/lib/validations/shipping-profile.ts` | Zod schemas for shipping profile inputs | ~60 |
| 7 | `src/app/(dashboard)/my/selling/shipping/page.tsx` | Shipping profiles list page | ~80 |
| 8 | `src/components/seller/dashboard-stats.tsx` | 4 stat cards component | ~80 |
| 9 | `src/components/seller/recent-activity.tsx` | Activity feed component | ~70 |
| 10 | `src/components/seller/awaiting-shipment-alert.tsx` | Conditional banner component | ~40 |
| 11 | `src/components/seller/shipping-profile-card.tsx` | Individual profile card | ~80 |
| 12 | `src/components/seller/shipping-profile-form.tsx` | Create/edit form with combined shipping config | ~200 |
| 13 | `src/components/seller/listing-table.tsx` | Enhanced listing table with checkboxes + bulk toolbar | ~200 |
| 14 | `src/components/seller/listing-status-tabs.tsx` | Status filter tabs with counts | ~50 |
| 15 | `src/components/seller/bulk-actions-toolbar.tsx` | Floating toolbar for bulk operations | ~80 |

### Modified Files

| # | Path | Change |
|---|------|--------|
| 16 | `src/app/(dashboard)/my/selling/page.tsx` | Replace basic shell with dashboard widgets + activity feed |
| 17 | `src/app/(dashboard)/my/selling/listings/page.tsx` | Add status tabs, bulk actions, enhanced table |

### Test Files

| # | Path | Description |
|---|------|-------------|
| 18 | `tests/unit/queries/seller-dashboard.test.ts` | Dashboard stats query tests |
| 19 | `tests/unit/actions/shipping-profiles.test.ts` | Shipping profile CRUD action tests |
| 20 | `tests/unit/actions/seller-listings.test.ts` | Bulk action tests (status transitions, ownership) |
| 21 | `tests/e2e/seller-dashboard.spec.ts` | E2E: login as seller → see stats → manage shipping profiles → bulk edit listings |

**Total: 21 files, ~1,700 estimated lines**

---

## RULES — READ THESE BEFORE EVERY FILE

1. **TypeScript strict:true.** Zero `as any`. Zero `as unknown as T`. Zero `@ts-ignore`. Fix the type, don't cast around it.
2. **No file over 300 lines.** If a component exceeds 300 lines, split it into subcomponents.
3. **All queries use the query layer pattern.** Every DB query goes through `src/lib/queries/`. No raw Drizzle calls in page components or server actions.
4. **All mutations use server actions.** Every write operation goes through `src/lib/actions/`. Actions validate input with Zod, check CASL permissions, then mutate.
5. **CASL enforcement on every action.** Check `ability.can('manage', 'Listing')` or `ability.can('manage', 'ShippingProfile')` before mutation. Return 403 if unauthorized.
6. **CASL checks on pages.** Each page component checks ability before rendering. Unauthorized users see "Start selling on Twicely" CTA or redirect.
7. **Delegate support.** Shipping profile actions check `DELEGATE(shipping.manage)`. Listing bulk actions check `DELEGATE(listings.manage)`. Dashboard stats check `DELEGATE(analytics.view)`.
8. **Ownership validation on every mutation.** Always verify `profile.userId === session.userId` before update/delete. Never trust client-submitted userId.
9. **Mobile responsive.** All components work at 375px minimum. Dashboard stats stack 2x2 on mobile. Listing table becomes card layout on mobile.
10. **No invented fields.** Only use columns that exist in the schema. Do not add columns. Do not rename columns.
11. **No invented routes.** Only build the routes listed in this prompt. No `/api/*` routes — use server actions.
12. **Status transitions must be valid.** Only allow: ACTIVE→PAUSED, PAUSED→ACTIVE, ACTIVE→ENDED, PAUSED→ENDED. Draft→Active is B2's job. Sold is system-only.
13. **Integer cents for all money.** Display with `(cents / 100).toFixed(2)`. Never use floats for money storage or calculation.
14. **No premature abstraction.** Build concrete components. Don't create a generic `<DataTable>` — build `<ListingTable>` that does exactly what it needs to.
15. **Combined shipping mode 5 (QUOTED) is config-only in B5.** The seller can SELECT it and save it to their profile. The actual quote flow at checkout is Phase D2. Don't build the quote flow.
16. **No analytics charts in B5.** The `/my/selling` dashboard shows NUMBER stats only (cards). Charts and trend lines are Phase D4. Don't import recharts or chart.js.
17. **No financial center features in B5.** Revenue on the dashboard is a simple SUM query. Don't build P&L, expense tracking, or anything from the Financial Center spec.
18. **Seed data compatibility.** All queries must work with existing seed data (3 sellers, 50 listings, 10 orders). If seed data doesn't have enough variety, note what needs adding but don't modify the seed in B5.
19. **URL-reflected filters.** Status tab selection and search text must be in the URL as query params. Back button must work. Bookmarkable.
20. **Idempotent bulk actions.** If bulk pause is called on a mix of ACTIVE and already-PAUSED listings, pause the ACTIVE ones and skip the PAUSED ones silently. Don't error.
21. **Do NOT create stub files.** Every file must be complete and functional. No placeholder exports, no TODO comments replacing real logic.
22. **Do NOT silently create extra files** not listed in the file plan. If you need an additional file, explain why first.
23. **Combined shipping `NONE` vs `INDIVIDUAL`.** Schema enum has `NONE` as default. `NONE` means "no combined shipping configured" (same behavior as INDIVIDUAL). Both result in per-item shipping. The form shows "Individual" as the first radio option which maps to `NONE` in the DB.
24. **Shipping profile limit enforcement.** No Store seller: max 3 profiles. Store Starter+: max 10. Check `sellerProfile.storeTier` for gating. If at limit, show disabled "Create" button with tooltip.

---

## VERIFICATION CHECKLIST

Before marking B5 complete, verify ALL of the following:

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx next lint` passes with zero errors
- [ ] `npx next build` succeeds
- [ ] All unit tests pass (`npx vitest run`)
- [ ] E2E test passes (`npx playwright test seller-dashboard`)
- [ ] `/my/selling` shows 4 stat cards with real data from seed
- [ ] `/my/selling` shows recent activity feed
- [ ] `/my/selling` shows awaiting shipment alert when applicable
- [ ] `/my/selling/shipping` shows empty state for sellers with no profiles
- [ ] `/my/selling/shipping` create form works with all 5 combined shipping modes
- [ ] `/my/selling/shipping` edit and delete work correctly
- [ ] `/my/selling/shipping` default profile swap works
- [ ] `/my/selling/shipping` profile limit enforced (3 for no-store, 10 for store)
- [ ] `/my/selling/listings` has status tabs with counts
- [ ] `/my/selling/listings` has working bulk select + bulk actions toolbar
- [ ] `/my/selling/listings` bulk pause/resume/end/delete work correctly
- [ ] `/my/selling/listings` has title search
- [ ] `/my/selling/listings` has pagination
- [ ] All status transitions are validated (no SOLD→PAUSED, etc.)
- [ ] CASL blocks non-sellers from all B5 pages
- [ ] CASL allows delegates with correct scopes
- [ ] Mobile responsive at 375px for all pages
- [ ] URL query params reflect filter/tab/search state
- [ ] No file exceeds 300 lines

---

## START SEQUENCE

1. Read all documents listed in "DOCUMENTS TO READ" section
2. Present the file plan for approval (list from FILE PLAN section)
3. After approval, build in this order:
   - Validation schemas (file 6)
   - Queries (files 1, 2, 3)
   - Server actions (files 4, 5)
   - Components (files 8–15)
   - Pages (files 7, 16, 17)
   - Tests (files 18–21)
4. After each file: `npx tsc --noEmit` to verify types
5. After all files: full build + test suite
6. Create backup: `tar -czf checkpoint-B5.tar.gz .`
