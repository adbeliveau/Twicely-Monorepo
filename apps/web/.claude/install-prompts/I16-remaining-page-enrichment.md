# [I16] Remaining Page Enrichment (8 Hub Pages)

**Phase & Step:** I16
**Feature Name:** Remaining Page Enrichment
**One-line Summary:** Enrich 8 existing hub pages with missing filters, columns, actions, name resolution, and chart improvements.
**Canonical Sources:**
- `TWICELY_V3_PAGE_REGISTRY.md` (Section 8: Hub pages #85, #112-114, #117, #119, #122, #101e)
- `TWICELY_V3_SCHEMA_v2_1_0.md` (tables: auditEvent, featureFlag, kbArticle, kbCategory, staffUser, staffUserRole, customRole, contentReport, enforcementAction)
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` (Section 22: Admin Quick Actions, Section 38: Feature Flags, Section 39: Audit Logging)
- `TWICELY_V3_HELPDESK_CANONICAL.md` (Section 21: KB Editor, Section 21.2: Article List, Section 21.3: Article Editor)
- `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` (Section 2.2: CASL Subjects, Section 3.5: Platform Agent permissions)
- `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` (I16 row)

---

## 1. PREREQUISITES

**Must be complete before starting:**
- Phases A through G: DONE (all 183 steps)
- I1-I15: DONE (all prior enrichment batches)
- H1-H4.2: DONE (crosslister features)

**Tables that must exist (all already in schema):**
- `audit_event` (platform.ts) -- immutable, no UPDATE/DELETE
- `feature_flag` (platform.ts)
- `kb_article`, `kb_category`, `kb_article_attachment`, `kb_article_relation`, `kb_article_feedback` (helpdesk.ts / kb.ts)
- `staff_user`, `staff_user_role`, `custom_role`, `staff_user_custom_role` (auth.ts / platform.ts)
- `content_report`, `enforcement_action` (enforcement.ts)

**Existing files that are the starting point (all exist, will be modified):**
- `src/app/(hub)/d/page.tsx` (93 lines)
- `src/app/(hub)/roles/staff/new/page.tsx` (24 lines)
- `src/app/(hub)/roles/custom/new/page.tsx` (40 lines)
- `src/app/(hub)/kb/page.tsx` (106 lines)
- `src/app/(hub)/kb/[id]/edit/page.tsx` (69 lines)
- `src/app/(hub)/audit/page.tsx` (47 lines)
- `src/app/(hub)/flags/page.tsx` (78 lines)
- `src/app/(hub)/mod/reports/[id]/page.tsx` (126 lines)

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

This is an ENRICHMENT step. All 8 pages already exist and function. The task is to add missing features per canonical specs: filters, columns, name resolution, export, quick actions, and chart improvements. NO new schema tables. NO new routes. NO new page files.

### 2.1 `/d` -- Staff Dashboard Home (Enrich)

**Current state:** 7 KPI stat cards, 2 text-list charts (GMV/Orders 7d), recent activity table.

**Enrichments required:**

**A. Period Toggle Component**
The dashboard currently hardcodes `getDashboardCharts('7d')`. Add a client-side period selector that lets staff switch between 7-day and 30-day views. Implement as searchParams-driven (URL `?period=7d` or `?period=30d`), not client state, so the page remains an RSC.

Modify `src/app/(hub)/d/page.tsx`:
- Read `searchParams.period` (default `'7d'`), validate it against `['7d', '30d']`
- Pass period to `getDashboardCharts(period)`
- Add a `DashboardPeriodToggle` client component (two buttons: "7 days" / "30 days") that updates the URL search param

**B. Users Chart (New Data Series)**
`getDashboardCharts` already returns a `users` array but the page only renders `gmv` and `orders`. Add a third chart panel for "New Users (7d/30d)" using the existing `users` data.

**C. Quick Action Links**
Per Feature Lock-in Section 22, add a "Quick Actions" row below the stat cards. Implement as a horizontal bar of icon+label links:
- "Search Users" -> `/usr`
- "View Orders" -> `/tx/orders`
- "Open Cases" -> `/hd`
- "Audit Log" -> `/audit`
- "Feature Flags" -> `/flags`
- "Settings" -> `/cfg`

Use Lucide icons matching the admin-nav.ts icon assignments for each route.

**D. Format Improvement for Charts**
Replace the current text-list chart rendering (one `<div>` per data point showing date + value) with a simple horizontal bar chart pattern. For each data point, render:
- The date label on the left
- A `<div>` with dynamic width proportional to the max value in the series, using Tailwind `bg-blue-500` or similar
- The numeric value on the right

This gives visual context without adding a charting library.

**E. No changes to `admin-dashboard.ts` queries** -- the data layer is sufficient.

**CASL:** `staffAuthorize()` with no specific subject check (any staff can view dashboard per Page Registry #85).

---

### 2.2 `/roles/staff/new` -- Create Staff User (Enrich)

**Current state:** AdminPageHeader + CreateStaffForm. No breadcrumb back link.

**Enrichments required:**

**A. Add Breadcrumb Back Link**
Add a "Back to Staff" link above the header, matching the pattern used in `/roles/custom/new/page.tsx` (which already has a "Back to Roles" link in the header actions).

Modify `src/app/(hub)/roles/staff/new/page.tsx`:
- Add a `Link` to `/roles/staff` with text "Back to Staff" in the `actions` prop of `AdminPageHeader`, matching the existing style in custom/new (border button).

This page is already feature-complete otherwise. The CreateStaffForm component handles all the necessary functionality.

---

### 2.3 `/roles/custom/new` -- Create Custom Role (Enrich)

**Current state:** Has AdminPageHeader with "Back to Roles" link, CustomRoleForm with PermissionToggleGrid. Feature-complete.

**Enrichment required:** NONE. This page is already complete per specs. Include it in I16 for documentation completeness only -- no code changes needed.

---

### 2.4 `/kb` -- Knowledge Base Article List (Enrich)

**Current state:** Table with Title, Status badge, Audience, Views, Updated columns. "New Article" and "Manage Categories" links. No filters, no search, no author column, no helpful % column.

**Enrichments required per Helpdesk Canonical Section 21.2:**

> "Table view with columns: Title, Category, Status (badge), Audience, Views, Helpful %, Updated, Author."
> "Filters: Status, Category, Audience. Search by title/content."

**A. Add Missing Columns**

Add to the table:
- **Category** column: Join `kbCategory.name` in the query. Display category name or "Uncategorized".
- **Helpful %** column: Compute `helpfulYes / (helpfulYes + helpfulNo) * 100` client-side from existing fields (both already returned by `getAdminKbArticles`). Display as "75%" or "--" if no feedback.
- **Author** column: The `kbArticle.authorStaffId` field exists in the schema. Modify `getAdminKbArticles` to join `staffUser.displayName` and return it. Display as author name.

**B. Add Filter Bar**

Create a `KbArticleFilters` client component with:
- **Status** dropdown: DRAFT | REVIEW | PUBLISHED | ARCHIVED | All
- **Category** dropdown: Populated from categories list (pass from server)
- **Audience** dropdown: ALL | BUYER | SELLER | AGENT_ONLY
- **Search** text input: Filter by title (client-side filter on the returned list, since `getAdminKbArticles` limits to 100)

All filters update URL search params. The page reads these params and passes them to `getAdminKbArticles`.

**C. Query Modification**

Modify `src/lib/queries/kb-admin-queries.ts` function `getAdminKbArticles`:
- Add `audience` filter parameter (already has `status` and `categoryId`)
- Add LEFT JOIN on `staffUser` to get `authorStaffId -> displayName`
- Return `authorName: string | null` in the result
- Return `categoryName: string | null` by joining `kbCategory.name`

**D. Pass categories to page**

The page needs the category list for the filter dropdown. Call `getAdminKbCategories()` (already exists in `kb-admin-queries.ts`) and pass it to the filter component.

**CASL:** `ability.can('manage', 'KbArticle')` -- already checked (HELPDESK_LEAD+, ADMIN per Page Registry #112).

---

### 2.5 `/kb/[id]/edit` -- Knowledge Base Article Editor (Enrich)

**Current state:** KbArticleEditor component with title, slug, excerpt, body (textarea), search keywords, category, audience, featured, pinned. 299 lines.

**Enrichments required per Helpdesk Canonical Section 21.3:**

**A. Add Meta Title / Meta Description Fields**

The `kbArticle` schema has `metaTitle` and `metaDescription` fields. The `KbArticleEditor` component's `InitialData` interface already includes them, and `initialData` is passed from the page with these values. But the component does NOT render input fields for them.

Add to the sidebar section of `KbArticleEditor`:
- **Meta Title** text input: `metaTitle`, maxLength 70
- **Meta Description** textarea: `metaDescription`, maxLength 160, 2 rows

Add state variables for these and include them in the `updateKbArticle` / `createKbArticle` calls.

**B. Add Tags Input**

The schema has `tags: text[].array()`. The `InitialData` interface includes `tags?: string[]` but the editor does NOT render a tags input. (It has `searchKeywords` but not `tags`.)

Add a freeform tags input to the sidebar. Use a comma-separated text input (same pattern as searchKeywords). Add state and include in save action.

**C. Version History Badge**

The page already shows `v{article.version} -- {article.status}`. This is sufficient for I16 scope. Full version history (diff viewer) is out of scope -- the schema only stores a `version` integer, not version snapshots.

**D. Preview Button**

Per Helpdesk Canonical 21.3: "Preview (opens public view in new tab)". Add a "Preview" link/button to the KbArticleToolbar that opens `/h/{categorySlug}/{articleSlug}` in a new tab. The `categorySlugForPreview` variable already exists in the editor but is unused -- wire it to a preview link.

**CASL:** `ability.can('manage', 'KbArticle')` -- already checked.

---

### 2.6 `/audit` -- Audit Log Viewer (Enrich)

**Current state:** AuditLogFilters (actor type, subject, severity dropdowns + action text input), AuditLogTable with expandable details. Paginated.

**Enrichments required per Feature Lock-in Section 39 and Page Registry #119:**

**A. Date Range Picker**

The `auditLogQuerySchema` already supports `startDate` and `endDate` parameters, and `getAuditEvents` already filters by them. But `AuditLogFilters` component does NOT expose date inputs.

Add two date inputs (type="date") to `AuditLogFilters`:
- **From** date input -> maps to `startDate` param (converts to ISO datetime)
- **To** date input -> maps to `endDate` param (converts to ISO datetime)

These update the URL search params, same pattern as existing filters.

**B. CSV Export Button**

Add an "Export CSV" button to the audit log page. This calls a new server action `exportAuditLogCsv` that:
1. Takes the current filter params
2. Queries up to 10,000 audit events matching those filters
3. Serializes to CSV format (id, timestamp, actorType, actorId, action, subject, subjectId, severity, ipAddress)
4. Returns the CSV as a Blob/string

The client component triggers a download by creating a Blob URL and clicking a hidden `<a>` element.

Create:
- `src/lib/actions/admin-audit-export.ts`: Server action `exportAuditLogCsv(params: AuditLogQuery)` that returns `{ csv: string } | { error: string }`
- Wire the export button in `AuditLogFilters`

**C. Expand Subject List in Filters**

The `SUBJECTS` array in `AuditLogFilters` only has 10 entries. Add the complete list from the codebase's audit event subjects:
```
'Listing', 'Order', 'User', 'Setting', 'FeatureFlag', 'StaffUser',
'Payout', 'Return', 'Dispute', 'HealthCheck', 'ContentReport',
'EnforcementAction', 'CustomRole', 'KbArticle', 'HelpdeskCase',
'Subscription', 'CrosslisterAccount', 'Message', 'Review'
```

**CASL:** `ability.can('read', 'AuditEvent')` -- already checked (any staff per Page Registry #119).

---

### 2.7 `/flags` -- Feature Flags Manager (Enrich)

**Current state:** 3-tier partitioned display: KillSwitchPanel, LaunchGatePanel, FeatureFlagTable. `/flags/[id]` detail page already built by I11.

**Enrichments required per Feature Lock-in Section 38:**

**A. Search/Filter Input**

Add a search input at the top of the page that filters flags by key or name. Implement as a URL search param `?q=` that filters the flags list server-side.

Modify `src/lib/queries/admin-feature-flags.ts`:
- Add a `searchTerm` parameter to `getPartitionedFlags` (or create a new `getPartitionedFlagsFiltered` function)
- Filter using `ilike` on `featureFlag.key` or `featureFlag.name`

**B. Create Flag Button**

Per Feature Lock-in 38: admin UI should allow creating flags. A `FeatureFlagForm` component already exists at `src/components/admin/feature-flag-form.tsx`. Check if there's already a create action. If so, add a "Create Flag" button to the page header that opens the form inline (in a collapsible section) or links to the form.

Wire the button visibility to `ability.can('create', 'FeatureFlag')` (already computed as `canCreate` in the page).

**C. Row Links to Detail Page**

Ensure each flag row in `FeatureFlagTable`, `KillSwitchPanel`, and `LaunchGatePanel` has a clickable link to `/flags/{id}` detail page (built in I11). If they already have this, no change needed.

**CASL:** `ability.can('read', 'FeatureFlag')` for page access; `ability.can('create', 'FeatureFlag')` for create button -- both already computed in the page.

---

### 2.8 `/mod/reports/[id]` -- Content Report Detail (Enrich)

**Current state:** Two-column layout. Left: report details (status, target type, target ID, reason, reporter ID, date, description). Right: review status with notes and confirm/dismiss actions + enforcement link.

**Enrichments required:**

**A. Reporter Name Resolution**

Currently displays raw `report.reporterUserId` as a monospace ID. Resolve to display name.

Modify `src/lib/queries/content-reports.ts` function `getContentReportById`:
- JOIN `user` table on `reporterUserId` to get `user.name`
- Return `reporterName: string` in the result

Update the page to display the reporter's name with the ID in parentheses.

**B. Target Content Preview**

Currently displays only `targetType` and `targetId`. For each target type, show a preview:

Create a `ReportTargetPreview` server component that:
- For `LISTING`: query listing title + thumbnail URL + status. Display as a card with link to `/listings?id={targetId}` (hub listing admin).
- For `REVIEW`: query review text excerpt (first 200 chars) + rating. Display inline.
- For `MESSAGE`: query message body excerpt (first 200 chars). Display inline.
- For `USER`: query user name + email + status. Display as a mini card with link to `/usr/{targetId}`.

Create `src/lib/queries/admin-report-target.ts` with a `getReportTargetPreview(targetType, targetId)` function that returns the appropriate preview data.

**C. Related Reports Link**

If there are other reports against the same target, show a count + link. Use existing `getReportsForTarget(targetType, targetId)` from `content-reports.ts` (already exists). Display count below the target section: "X other reports for this target" with a link to `/mod/reports?targetType={type}&targetId={id}`.

**D. Link to Enforcement Action**

If `report.enforcementActionId` is set, show a link to `/mod/enforcement/{enforcementActionId}`. Currently the page only shows an "Issue Enforcement Action" button for CONFIRMED reports but does not link to existing linked enforcement actions.

**CASL:** `ability.can('read', 'ContentReport')` for page; `ability.can('update', 'ContentReport')` for review actions -- both already checked.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
Scan all output for these banned terms before committing:
- `SellerTier` -> `StoreTier` or `ListerTier`
- `FVF` / `Final Value Fee` -> `TF` / `Transaction Fee`
- `BASIC` (as StoreTier) -> `STARTER` or `PRO`
- `ELITE` -> `POWER`
- `PREMIUM` -> `POWER`
- `Twicely Balance` -> `Available for payout`
- `wallet` (seller UI) -> `payout`
- `Withdraw` -> `Request payout`
- `dashboard` as a route prefix -> `/d` for hub, `/my` for user hub
- `/admin` -> use `hub.twicely.co/d` routes

### Tech Stack
- NO charting libraries (recharts, chart.js, etc.) -- use CSS-based bar visualization
- NO Prisma, NextAuth, Redux, tRPC, Meilisearch
- Drizzle ORM for all queries
- Zod `.strict()` on all new schemas
- React Email + Resend (not needed for this step but do not add alternatives)

### Code Patterns
- `strict: true` TypeScript -- zero `as any`, zero `@ts-ignore`
- Max 300 lines per file
- Money as integer cents only
- Ownership via `userId` always
- No `console.log` in production code
- Never spread request body into DB updates -- explicit field mapping only
- Keep helpers in `'use server'` files UNEXPORTED to prevent unintended server actions
- `auditEvent` is IMMUTABLE -- no UPDATE, no DELETE. Only INSERT + SELECT.

### Route Enforcement
- Hub routes under `hub.twicely.co` -- `/d`, `/roles`, `/kb`, `/audit`, `/flags`, `/mod`
- NEVER use `/admin`, `/dashboard`, `/listing/`, `/store/`
- All internal links within hub use relative paths (e.g., `/roles/staff`, not `hub.twicely.co/roles/staff`)

### What NOT To Build
- Do NOT add a rich text editor (Tiptap/Novel/BlockNote) for KB articles -- the spec says "TBD" on editor choice; plain Markdown textarea is correct for now
- Do NOT add real-time Centrifugo integration to dashboard -- spec mentions live counters but that's future work
- Do NOT build full version history viewer for KB articles -- schema only stores `version` integer
- Do NOT add keyboard shortcuts (Feature Lock-in Section 22 lists them but they're a separate feature)
- Do NOT create new database tables
- Do NOT create new page routes (all 8 pages already exist)

---

## 4. ACCEPTANCE CRITERIA

### General
- [ ] All 8 pages render without errors
- [ ] TypeScript: 0 errors (`pnpm typecheck`)
- [ ] Test count >= BASELINE (9168 per Build Tracker v1.90)
- [ ] No banned terms in any new or modified code
- [ ] All files <= 300 lines
- [ ] No `console.log` in production code
- [ ] No `as any`, `@ts-ignore`, `@ts-expect-error`

### Page-Specific

**`/d` Dashboard:**
- [ ] Period toggle switches between 7d and 30d via URL param
- [ ] Three chart panels visible: GMV, Orders, Users
- [ ] Charts render with proportional horizontal bars (not just text)
- [ ] Quick Actions bar with 6 links visible below stat cards
- [ ] All 7 existing stat cards still render correctly

**`/roles/staff/new`:**
- [ ] "Back to Staff" link visible in page header
- [ ] CreateStaffForm still functions (create staff user flow works)

**`/roles/custom/new`:**
- [ ] No changes (confirmed complete)

**`/kb` Article List:**
- [ ] Category column visible in table
- [ ] Helpful % column visible in table (shows percentage or "--")
- [ ] Author column visible (shows staff display name)
- [ ] Status filter dropdown works
- [ ] Category filter dropdown works
- [ ] Audience filter dropdown works
- [ ] Search input filters articles by title
- [ ] Empty state still renders when no articles match

**`/kb/[id]/edit` Article Editor:**
- [ ] Meta Title input visible in sidebar
- [ ] Meta Description textarea visible in sidebar
- [ ] Tags input visible in sidebar (comma-separated)
- [ ] Preview button opens public article URL in new tab
- [ ] Save action includes metaTitle, metaDescription, and tags

**`/audit` Audit Log:**
- [ ] "From" and "To" date inputs visible in filter bar
- [ ] Date filtering works (narrows results to date range)
- [ ] "Export CSV" button visible
- [ ] CSV export downloads a file with audit events matching current filters
- [ ] Subject filter dropdown has expanded list (19 subjects)
- [ ] Existing filters (actor type, severity, action) still work

**`/flags` Feature Flags:**
- [ ] Search input visible at top
- [ ] Search filters flags by key or name
- [ ] "Create Flag" button visible for authorized users
- [ ] Flag rows link to `/flags/{id}` detail page

**`/mod/reports/[id]` Content Report:**
- [ ] Reporter name displayed (not just raw ID)
- [ ] Target content preview shown (listing title, review excerpt, message excerpt, or user name)
- [ ] Related reports count displayed with link
- [ ] Linked enforcement action has clickable link (when set)
- [ ] Confirm/Dismiss actions still work

### Authorization
- [ ] Dashboard accessible to any staff role
- [ ] KB pages require HELPDESK_LEAD+ or ADMIN
- [ ] Roles pages require ADMIN
- [ ] Audit log accessible to any staff role
- [ ] Flags require ADMIN or DEVELOPER
- [ ] Mod reports require ADMIN or MODERATION
- [ ] Create flag button hidden when `ability.can('create', 'FeatureFlag')` is false

---

## 5. TEST REQUIREMENTS

### New Test Files (~40 tests total)

**Queries:**

1. `src/lib/queries/__tests__/kb-admin-enriched.test.ts` (~10 tests)
   - "returns articles with author name from staffUser join"
   - "returns articles with category name"
   - "filters by audience parameter"
   - "returns null authorName when staffUser not found"
   - "computes helpful percentage correctly in consuming code"
   - "returns empty array when no articles match filters"
   - "filters by status, categoryId, and audience combined"

2. `src/lib/queries/__tests__/admin-report-target.test.ts` (~8 tests)
   - "returns listing preview for LISTING target type"
   - "returns review excerpt for REVIEW target type"
   - "returns message excerpt for MESSAGE target type"
   - "returns user info for USER target type"
   - "returns null for non-existent target"
   - "truncates review text to 200 chars"
   - "returns reporter name from getContentReportById"
   - "returns related report count for same target"

**Actions:**

3. `src/lib/actions/__tests__/admin-audit-export.test.ts` (~8 tests)
   - "exports CSV with correct headers"
   - "exports CSV with filtered events when params provided"
   - "limits export to 10,000 rows"
   - "returns error when unauthorized"
   - "CSV includes all required columns (id, timestamp, actorType, actorId, action, subject, subjectId, severity, ipAddress)"
   - "handles empty result set gracefully"
   - "formats timestamps in ISO format"
   - "escapes commas and quotes in CSV values"

**Feature Flags Queries:**

4. `src/lib/queries/__tests__/admin-feature-flags-search.test.ts` (~6 tests)
   - "filters flags by search term on key"
   - "filters flags by search term on name (case insensitive)"
   - "returns all flags when search term is empty"
   - "partitions filtered flags into kill/launch/regular"
   - "returns empty partitions when no flags match search"
   - "search does not affect partition classification"

**Dashboard:**

5. `src/lib/queries/__tests__/admin-dashboard-users.test.ts` (~4 tests)
   - "getDashboardCharts returns users data for 7d period"
   - "getDashboardCharts returns users data for 30d period"
   - "users chart returns empty array when no signups"
   - "users data grouped by date correctly"

### Test Patterns
Follow existing test patterns:
- Use `vi.mock` for `@/lib/db` and `@/lib/casl/staff-authorize`
- Use `selectChain` / `insertChain` helpers for mock DB chains
- Use `makeStaffSession` / `makeOwnerSession` helpers where available
- Each test file must pass independently
- No `as any` in test code -- use proper mock types

---

## 6. FILE APPROVAL LIST

### Files to MODIFY (existing):

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/app/(hub)/d/page.tsx` | Add period toggle, users chart, quick actions, bar chart format |
| 2 | `src/app/(hub)/roles/staff/new/page.tsx` | Add breadcrumb back link |
| 3 | `src/app/(hub)/kb/page.tsx` | Add filter bar, author/category/helpful% columns |
| 4 | `src/app/(hub)/kb/[id]/edit/page.tsx` | Pass searchKeywords to editor (already done), no other page changes needed |
| 5 | `src/app/(hub)/audit/page.tsx` | Wire export button |
| 6 | `src/app/(hub)/flags/page.tsx` | Add search input, create button, detail links |
| 7 | `src/app/(hub)/mod/reports/[id]/page.tsx` | Add reporter name, target preview, related reports, enforcement link |
| 8 | `src/lib/queries/kb-admin-queries.ts` | Add author join, category join, audience filter to getAdminKbArticles |
| 9 | `src/lib/queries/admin-feature-flags.ts` | Add search/filter capability |
| 10 | `src/lib/queries/content-reports.ts` | Add reporter name join to getContentReportById |
| 11 | `src/components/admin/audit-log-filters.tsx` | Add date range inputs, export button, expanded subjects list |
| 12 | `src/components/helpdesk/kb-article-editor.tsx` | Add metaTitle, metaDescription, tags fields + preview button |
| 13 | `src/components/admin/feature-flag-table.tsx` | Add row links to `/flags/{id}` |
| 14 | `src/components/admin/kill-switch-panel.tsx` | Add row links to `/flags/{id}` |
| 15 | `src/components/admin/launch-gate-panel.tsx` | Add row links to `/flags/{id}` |

### Files to CREATE (new):

| # | File Path | Description |
|---|-----------|-------------|
| 16 | `src/components/admin/dashboard-period-toggle.tsx` | Client component: 7d/30d period selector |
| 17 | `src/components/admin/dashboard-quick-actions.tsx` | Quick action links bar for dashboard |
| 18 | `src/components/admin/dashboard-bar-chart.tsx` | Simple CSS-based horizontal bar chart component |
| 19 | `src/components/admin/kb-article-filters.tsx` | Client component: status/category/audience/search filters for KB |
| 20 | `src/components/admin/report-target-preview.tsx` | Server component: content preview for report target |
| 21 | `src/lib/queries/admin-report-target.ts` | Query: fetch target content preview by type+id |
| 22 | `src/lib/actions/admin-audit-export.ts` | Server action: export audit log to CSV |
| 23 | `src/lib/queries/__tests__/kb-admin-enriched.test.ts` | Tests for enriched KB admin queries |
| 24 | `src/lib/queries/__tests__/admin-report-target.test.ts` | Tests for report target preview queries |
| 25 | `src/lib/actions/__tests__/admin-audit-export.test.ts` | Tests for audit CSV export action |
| 26 | `src/lib/queries/__tests__/admin-feature-flags-search.test.ts` | Tests for flag search/filter |
| 27 | `src/lib/queries/__tests__/admin-dashboard-users.test.ts` | Tests for dashboard users chart data |

**Total: 15 modified + 12 created = 27 files**

---

## 7. VERIFICATION CHECKLIST

After implementation, run these commands and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. Lint script
./twicely-lint.sh

# 4. File sizes -- check all modified/created files are <= 300 lines
wc -l src/app/\(hub\)/d/page.tsx src/app/\(hub\)/roles/staff/new/page.tsx src/app/\(hub\)/kb/page.tsx src/app/\(hub\)/kb/\[id\]/edit/page.tsx src/app/\(hub\)/audit/page.tsx src/app/\(hub\)/flags/page.tsx src/app/\(hub\)/mod/reports/\[id\]/page.tsx src/components/admin/dashboard-period-toggle.tsx src/components/admin/dashboard-quick-actions.tsx src/components/admin/dashboard-bar-chart.tsx src/components/admin/kb-article-filters.tsx src/components/admin/report-target-preview.tsx src/lib/queries/admin-report-target.ts src/lib/actions/admin-audit-export.ts src/lib/queries/kb-admin-queries.ts src/lib/queries/admin-feature-flags.ts src/lib/queries/content-reports.ts src/components/admin/audit-log-filters.tsx src/components/helpdesk/kb-article-editor.tsx src/components/admin/feature-flag-table.tsx

# 5. Banned terms check
grep -rn "SellerTier\|SubscriptionTier\|Final Value Fee\|FVF\|BASIC.*StoreTier\|ELITE.*StoreTier\|Twicely Balance\|wallet\|Withdraw" src/app/\(hub\)/d/ src/app/\(hub\)/roles/ src/app/\(hub\)/kb/ src/app/\(hub\)/audit/ src/app/\(hub\)/flags/ src/app/\(hub\)/mod/reports/ src/components/admin/dashboard-*.tsx src/components/admin/kb-article-filters.tsx src/components/admin/report-target-preview.tsx src/lib/queries/admin-report-target.ts src/lib/actions/admin-audit-export.ts || echo "No banned terms found"
```

**Expected results:**
- TypeScript: 0 errors
- Tests: >= 9168 (baseline) with ~40 new tests (expect ~9208+)
- Lint: all checks pass
- All files <= 300 lines
- No banned terms found

---

## 8. IMPLEMENTATION SEQUENCE

These sub-steps can be done in any order since they are independent pages. However, the recommended sequence groups shared work first:

**Step 1: Shared components** (dashboard-bar-chart, dashboard-period-toggle, dashboard-quick-actions)
**Step 2: `/d` dashboard enrichment** (uses step 1 components)
**Step 3: KB queries enrichment** (kb-admin-queries.ts modifications)
**Step 4: `/kb` + `/kb/[id]/edit` pages** (uses step 3 queries)
**Step 5: `/audit` + export action** (audit-log-filters modification + new action)
**Step 6: `/flags` enrichment** (query + page + component modifications)
**Step 7: Content report enrichment** (new query + `/mod/reports/[id]` page)
**Step 8: `/roles/staff/new` trivial fix** (one link addition)
**Step 9: All tests** (can be written alongside each step)

---

## 9. SPEC INCONSISTENCIES

1. **Page Registry #85 vs Feature Lock-in Section 15**: Page Registry says dashboard shows "KPI cards (orders today, revenue, open cases, active listings), charts". Feature Lock-in Section 15 mentions "Live GMV counter" and "Live active users count" via Centrifugo. Decision: Implement static (non-real-time) enrichments only. Real-time via Centrifugo is future work.

2. **Helpdesk Canonical Section 21.3 vs current implementation**: Canonical says "Related articles (search + link)" in editor sidebar. The `kbArticleRelation` table exists for this. However, building a full related-article search+link UI is significant scope. Decision: OUT OF SCOPE for I16 -- note as future enhancement.

3. **Page Registry says `/kb/{slug}` for edit**: Page Registry #114 says `/kb/[id]/edit` but Helpdesk Canonical Section 21.1 says `/kb/{slug}`. Current code uses `[id]`. Decision: Keep `[id]` -- it matches the existing implementation and is more robust (slugs can change, IDs don't).

4. **Feature Lock-in Section 38 says route is `/cfg/flags`**: But Page Registry #122 says `/flags`. Current code is at `/flags`. Decision: Keep `/flags` -- matches both Page Registry and existing implementation. Feature Lock-in used an older route prefix.
