# [G4] Enforcement & Moderation Infrastructure

## One-Line Summary

Build the foundational enforcement engine: content report system, enforcement action tracking, seller enforcement level management, notification templates, platform settings, CASL subjects, and enhanced moderation hub pages -- unlocking G4.1 (seller standards bands + auto-enforcement) and G4.2 (appeal flow).

## Canonical Sources -- READ ALL BEFORE STARTING

| Document | Relevant Sections |
|----------|-------------------|
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Section 44 (Seller Standards & Enforcement) -- enforcement tiers, policy violations, admin settings |
| `TWICELY_V3_SCHEMA_v2_1_0.md` | Section 1.3 (`enforcementStateEnum`), Section 2.3 (`sellerProfile`), Section 8.3 (`sellerPerformance`), Section 8.5 (`sellerScoreSnapshot`) |
| `TWICELY_V3_SELLER_SCORE_CANONICAL.md` | Section 6 (Enforcement Integration), Section 10 (Schema), Section 11.5 (Enforcement Thresholds) |
| `TWICELY_V3_PAGE_REGISTRY.md` | Section 8.6 (/mod routes), Section 4 (/my/selling/verification at #73) |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Section 3.5 (MODERATION role permissions), Section 3.6 (ADMIN actions) |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | Seller Score Canonical Section 11.5 enforcement threshold settings |
| `TWICELY_V3_TESTING_STANDARDS.md` | Unit + integration test patterns |
| `TWICELY_V3_DECISION_RATIONALE.md` | No enforcement-specific locked decisions found |

---

## Prerequisites

| Prerequisite | Status |
|---|---|
| E3.5 (Moderation queue /mod) | COMPLETE -- basic listing flag/clear/remove + review approve/remove exist |
| sellerProfile table | EXISTS in `src/lib/db/schema/identity.ts` -- lacks enforcement fields |
| sellerPerformance table | EXISTS in `src/lib/db/schema/reviews.ts` |
| sellerScoreSnapshot table | EXISTS in `src/lib/db/schema/finance.ts` |
| enforcementStateEnum | EXISTS in `src/lib/db/schema/enums.ts`: `['CLEAR', 'FLAGGED', 'SUPPRESSED', 'REMOVED']` |
| listing.enforcementState column | EXISTS in `src/lib/db/schema/listings.ts` |
| admin-moderation.ts actions | EXISTS -- `removeListingAction`, `clearListingFlagAction`, `removeReviewAction`, `approveReviewAction` |
| admin-moderation.ts queries | EXISTS -- `getModerationKPIs`, `getFlaggedListings`, `getFlaggedReviews` |
| mod pages | EXISTS -- `/mod`, `/mod/listings`, `/mod/reviews`, `/mod/messages`, `/mod/disputes`, `/mod/returns`, `/mod/collections` |
| CASL MODERATION role | EXISTS -- reads User/Listing/Review/Message/Conversation/AuditEvent, updates Listing/SellerProfile/Review |

---

## Scope -- EXACTLY What to Build

G4 is the PARENT step that creates enforcement infrastructure. It does NOT implement:
- G4.1: Seller score-based auto-enforcement, daily score recalculation BullMQ job, seller performance dashboard at `/my/selling/performance`
- G4.2: Appeal submission flow, appeal review hub page, appeal resolution actions

### A. Database Schema Changes

#### A1. New Enums (add to `src/lib/db/schema/enums.ts`)

```typescript
// Content report reasons (user-submitted reports)
export const contentReportReasonEnum = pgEnum('content_report_reason', [
  'COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY',
  'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE',
  'SHILL_REVIEWS', 'OTHER'
]);

// Content report status
export const contentReportStatusEnum = pgEnum('content_report_status', [
  'PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'
]);

// Content report target type
export const contentReportTargetEnum = pgEnum('content_report_target', [
  'LISTING', 'REVIEW', 'MESSAGE', 'USER'
]);

// Enforcement action types
export const enforcementActionTypeEnum = pgEnum('enforcement_action_type', [
  'COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL',
  'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION',
  'ACCOUNT_BAN'
]);

// Enforcement action status
export const enforcementActionStatusEnum = pgEnum('enforcement_action_status', [
  'ACTIVE', 'EXPIRED', 'LIFTED', 'APPEALED', 'APPEAL_APPROVED'
]);

// Enforcement trigger source
export const enforcementTriggerEnum = pgEnum('enforcement_trigger', [
  'SCORE_BASED', 'POLICY_VIOLATION', 'CONTENT_REPORT', 'ADMIN_MANUAL', 'SYSTEM_AUTO'
]);
```

#### A2. New Table: `contentReport` (add to new file `src/lib/db/schema/enforcement.ts`)

This is the user-facing report system. Any user can report a listing, review, message, or user.

```typescript
export const contentReport = pgTable('content_report', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  reporterUserId: text('reporter_user_id').notNull().references(() => user.id),
  targetType:     contentReportTargetEnum('target_type').notNull(),
  targetId:       text('target_id').notNull(),           // listing.id, review.id, message.id, or user.id
  reason:         contentReportReasonEnum('reason').notNull(),
  description:    text('description'),                   // Optional free text (max 1000 chars)
  status:         contentReportStatusEnum('status').notNull().default('PENDING'),
  reviewedByStaffId: text('reviewed_by_staff_id'),       // staffUser who reviewed
  reviewedAt:     timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes:    text('review_notes'),                  // Staff internal notes
  enforcementActionId: text('enforcement_action_id'),    // FK to enforcementAction if confirmed -> action taken
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reporterIdx:   index('cr_reporter').on(table.reporterUserId),
  targetIdx:     index('cr_target').on(table.targetType, table.targetId),
  statusIdx:     index('cr_status').on(table.status),
  createdIdx:    index('cr_created').on(table.createdAt),
}));
```

#### A3. New Table: `enforcementAction` (in `src/lib/db/schema/enforcement.ts`)

Tracks every enforcement action taken against a seller or user. Immutable history -- actions can be LIFTED or APPEALED but never deleted.

```typescript
export const enforcementAction = pgTable('enforcement_action', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  userId:         text('user_id').notNull().references(() => user.id),
  actionType:     enforcementActionTypeEnum('action_type').notNull(),
  trigger:        enforcementTriggerEnum('trigger').notNull(),
  status:         enforcementActionStatusEnum('status').notNull().default('ACTIVE'),
  reason:         text('reason').notNull(),                          // Human-readable explanation
  details:        jsonb('details').notNull().default('{}'),          // Structured metadata (metrics, thresholds breached, etc.)
  contentReportId: text('content_report_id'),                        // FK if triggered by content report
  issuedByStaffId: text('issued_by_staff_id'),                       // staffUser who issued (null if system-auto)
  expiresAt:      timestamp('expires_at', { withTimezone: true }),   // Null = permanent until manually lifted
  liftedAt:       timestamp('lifted_at', { withTimezone: true }),
  liftedByStaffId: text('lifted_by_staff_id'),
  liftedReason:   text('lifted_reason'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:       index('ea_user').on(table.userId),
  typeIdx:       index('ea_type').on(table.actionType),
  statusIdx:     index('ea_status').on(table.status),
  triggerIdx:    index('ea_trigger').on(table.trigger),
  createdIdx:    index('ea_created').on(table.createdAt),
}));
```

#### A4. sellerProfile Migration -- Add Enforcement Fields

Add the following columns to `sellerProfile` in `src/lib/db/schema/identity.ts` (per Seller Score Canonical Section 10.2):

```typescript
// G4 -- Enforcement fields (Seller Score Canonical Section 10.2)
enforcementLevel:      text('enforcement_level'),              // 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION' | null
enforcementStartedAt:  timestamp('enforcement_started_at', { withTimezone: true }),
warningExpiresAt:      timestamp('warning_expires_at', { withTimezone: true }),
bandOverride:          performanceBandEnum('band_override'),
bandOverrideExpiresAt: timestamp('band_override_expires_at', { withTimezone: true }),
bandOverrideReason:    text('band_override_reason'),
bandOverrideBy:        text('band_override_by'),               // text, not uuid (Twicely uses CUID2 for all IDs)
```

**IMPORTANT**: The Seller Score Canonical uses `uuid('band_override_by').references(() => users.id)` but Twicely uses CUID2 `text` for all IDs. Use `text('band_override_by')` to match the codebase convention.

#### A5. Drizzle Migration

Generate a migration file: `drizzle/XXXX_add-enforcement-infrastructure.sql`

The migration must:
1. Create the 6 new enums
2. Create `content_report` table
3. Create `enforcement_action` table
4. Add the 7 new columns to `seller_profile`

### B. Schema Barrel Export

Update `src/lib/db/schema/index.ts` to export:
- All new enums from `enums.ts`
- `contentReport`, `enforcementAction` from `enforcement.ts`

### C. CASL Subject Registration

#### C1. Add new CASL subjects to `src/lib/casl/subjects.ts`:

```typescript
// Enforcement -- G4
'ContentReport',
'EnforcementAction',
```

#### C2. Update `src/lib/casl/platform-abilities.ts`:

**MODERATION role** -- add:
```typescript
can('read', 'ContentReport');
can('update', 'ContentReport');      // review + confirm/dismiss
can('read', 'EnforcementAction');
can('create', 'EnforcementAction');  // issue enforcement
can('update', 'EnforcementAction');  // lift enforcement
```

**SUPPORT role** -- add:
```typescript
can('read', 'ContentReport');        // Support can view reports for context
can('read', 'EnforcementAction');    // Support can view enforcement history
```

**ADMIN** already has `can('manage', 'all')` so no changes needed.

### D. Platform Settings Seeding

Add the following settings to `src/lib/db/seed/v32-platform-settings-extended.ts` (per Seller Score Canonical Section 11.5):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.enforcement.coachingBelow` | `number` | `550` | Score triggering coaching |
| `score.enforcement.warningBelow` | `number` | `400` | Score triggering warning |
| `score.enforcement.restrictionBelow` | `number` | `250` | Score triggering restriction |
| `score.enforcement.preSuspensionBelow` | `number` | `100` | Score triggering pre-suspension |
| `score.enforcement.warningDurationDays` | `number` | `30` | Days to improve during warning |
| `score.enforcement.restrictionDurationDays` | `number` | `90` | Days before restriction escalates |
| `score.enforcement.preSuspensionDays` | `number` | `30` | Days before admin review |

Also add Feature Lock-in Section 44 admin settings:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sellerStandards.evaluationWindowDays` | `number` | `90` | Rolling window for metric calculation |
| `sellerStandards.minimumOrders` | `number` | `10` | Minimum orders before enforcement |
| `sellerStandards.warningPeriodDays` | `number` | `30` | Days to improve after warning |
| `sellerStandards.restrictionToSuspensionDays` | `number` | `90` | Days before restriction escalates |

Category: `'trust'` for all enforcement settings, editable: `true`.

### E. Zod Validation Schemas

Create `src/lib/validations/enforcement.ts`:

1. **`contentReportSchema`** -- for user-submitted reports:
   - `targetType`: enum (LISTING, REVIEW, MESSAGE, USER)
   - `targetId`: string (CUID2)
   - `reason`: enum (COUNTERFEIT, PROHIBITED_ITEM, etc.)
   - `description`: optional string, max 1000 chars
   - `.strict()`

2. **`reviewContentReportSchema`** -- for staff reviewing a report:
   - `reportId`: string (CUID2)
   - `status`: enum (CONFIRMED, DISMISSED)
   - `reviewNotes`: optional string, max 2000 chars
   - `.strict()`

3. **`issueEnforcementActionSchema`** -- for staff issuing an enforcement action:
   - `userId`: string (CUID2)
   - `actionType`: enum (WARNING, RESTRICTION, SUSPENSION, LISTING_REMOVAL, etc.)
   - `trigger`: enum (POLICY_VIOLATION, CONTENT_REPORT, ADMIN_MANUAL)
   - `reason`: string, max 2000 chars
   - `contentReportId`: optional string (CUID2)
   - `expiresAt`: optional date string (ISO 8601)
   - `.strict()`

4. **`liftEnforcementActionSchema`** -- for staff lifting an enforcement action:
   - `actionId`: string (CUID2)
   - `liftedReason`: string, max 2000 chars
   - `.strict()`

5. **`updateSellerEnforcementSchema`** -- for admin updating enforcement level on sellerProfile:
   - `userId`: string (CUID2)
   - `enforcementLevel`: nullable enum ('COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION')
   - `bandOverride`: optional performanceBand enum
   - `bandOverrideReason`: optional string, max 500 chars
   - `.strict()`

### F. Server Actions

#### F1. `src/lib/actions/content-report.ts` (user-facing)

1. **`submitContentReportAction(input: unknown)`**
   - Auth: `authorize()` -- any authenticated user
   - CASL: No special subject needed -- any authenticated user can report content (Feature Lock-in mentions "Report message" and "flag for moderation")
   - Validates target exists (listing, review, message, user)
   - Creates `contentReport` row with status PENDING
   - Creates `auditEvent` (severity: MEDIUM, action: 'CONTENT_REPORT_SUBMITTED')
   - Returns `{ success: true }`
   - Rate limit: Max 10 reports per user per 24 hours (check count before insert)
   - Self-report prevention: Cannot report own content

#### F2. `src/lib/actions/enforcement.ts` (staff-facing)

1. **`reviewContentReportAction(input: unknown)`**
   - Auth: `staffAuthorize()`
   - CASL: `ability.can('update', 'ContentReport')`
   - Updates report status to CONFIRMED or DISMISSED
   - Sets `reviewedByStaffId`, `reviewedAt`, `reviewNotes`
   - If CONFIRMED: does NOT auto-issue enforcement action (staff does that separately -- separation of concerns)
   - Creates `auditEvent` (severity: HIGH, action: 'CONTENT_REPORT_REVIEWED')
   - `revalidatePath('/mod/reports')`

2. **`issueEnforcementActionAction(input: unknown)`**
   - Auth: `staffAuthorize()`
   - CASL: `ability.can('create', 'EnforcementAction')`
   - Creates `enforcementAction` row
   - If action type is LISTING_REMOVAL: updates `listing.enforcementState` to 'REMOVED'
   - If action type is LISTING_SUPPRESSION: updates `listing.enforcementState` to 'SUPPRESSED'
   - If action type is SUSPENSION: updates `sellerProfile.status` to 'SUSPENDED'
   - If action type is RESTRICTION: updates `sellerProfile.status` to 'RESTRICTED'
   - If action type is WARNING/COACHING/RESTRICTION/PRE_SUSPENSION: updates `sellerProfile.enforcementLevel` and `enforcementStartedAt`
   - Creates `auditEvent` (severity: CRITICAL for SUSPENSION, HIGH for others, action: 'ENFORCEMENT_ACTION_ISSUED')
   - `revalidatePath('/mod')`

3. **`liftEnforcementActionAction(input: unknown)`**
   - Auth: `staffAuthorize()`
   - CASL: `ability.can('update', 'EnforcementAction')`
   - Updates enforcementAction status to LIFTED, sets `liftedAt`, `liftedByStaffId`, `liftedReason`
   - Reverses the effect:
     - If was SUSPENSION: updates `sellerProfile.status` back to 'ACTIVE'
     - If was RESTRICTION: updates `sellerProfile.status` back to 'ACTIVE'
     - If was LISTING_REMOVAL: updates `listing.enforcementState` back to 'CLEAR' (staff explicitly decides)
     - If was WARNING/COACHING/RESTRICTION/PRE_SUSPENSION on enforcement level: clears `sellerProfile.enforcementLevel` to null, clears `enforcementStartedAt`
   - Creates `auditEvent` (severity: HIGH, action: 'ENFORCEMENT_ACTION_LIFTED')
   - `revalidatePath('/mod')`

4. **`updateSellerBandOverrideAction(input: unknown)`**
   - Auth: `staffAuthorize()`
   - CASL: `ability.can('update', 'SellerProfile')`
   - Updates `sellerProfile.bandOverride`, `bandOverrideReason`, `bandOverrideBy`, `bandOverrideExpiresAt`
   - Creates `auditEvent` (severity: HIGH, action: 'BAND_OVERRIDE_SET')
   - `revalidatePath('/mod')`

### G. Query Functions

#### G1. `src/lib/queries/content-reports.ts`

1. **`getContentReports(status, page, pageSize)`** -- paginated list of content reports, filterable by status. Joins reporter name.
2. **`getContentReportById(reportId)`** -- single report with full details including target entity info.
3. **`getContentReportCountByStatus()`** -- counts per status for dashboard KPI cards.
4. **`getUserReportHistory(userId)`** -- all reports made BY a user (for fraud detection of serial reporters).
5. **`getReportsForTarget(targetType, targetId)`** -- all reports against a specific entity.

#### G2. `src/lib/queries/enforcement-actions.ts`

1. **`getEnforcementActions(userId?, status?, page, pageSize)`** -- paginated list, filterable by user and status.
2. **`getEnforcementActionById(actionId)`** -- single action with full details.
3. **`getActiveEnforcementForUser(userId)`** -- all ACTIVE enforcement actions for a user. Used by seller dashboard warning banner.
4. **`getEnforcementHistory(userId)`** -- full history for a user (all statuses). Used by hub user detail page.
5. **`getEnforcementKPIs()`** -- dashboard KPIs: active warnings, active restrictions, active suspensions, pending reports.

### H. Hub Pages (Moderation)

#### H1. Enhanced `/mod` overview page

Modify `src/app/(hub)/mod/page.tsx` to add:
- Content Reports KPI card (pending count)
- Active Enforcement KPI card (active enforcement actions count)
- Quick links to `/mod/reports` and `/mod/enforcement`

#### H2. New `/mod/reports` page

`src/app/(hub)/mod/reports/page.tsx` -- list of content reports

- Table columns: Reporter, Target Type, Target, Reason, Status, Date
- Status filter tabs: Pending | Under Review | Confirmed | Dismissed | All
- Gate: STAFF(ADMIN, MODERATION)
- Click row -> goes to `/mod/reports/[id]`

#### H3. New `/mod/reports/[id]` page

`src/app/(hub)/mod/reports/[id]/page.tsx` -- single report detail

- Shows reporter info, target info (with link to target entity), reason, description
- Target preview: if listing, show title/price/images; if review, show review text; if message, show message preview; if user, show user card
- Actions: Confirm (requires reason) or Dismiss (requires reason)
- If confirmed: "Issue Enforcement Action" button that navigates to enforcement form pre-filled with report context
- Gate: STAFF(ADMIN, MODERATION)

#### H4. New `/mod/enforcement` page

`src/app/(hub)/mod/enforcement/page.tsx` -- list of enforcement actions

- Table columns: User, Action Type, Trigger, Status, Issued By, Created, Expires
- Status filter tabs: Active | Expired | Lifted | Appealed | All
- Gate: STAFF(ADMIN, MODERATION)
- Click row -> goes to `/mod/enforcement/[id]`

#### H5. New `/mod/enforcement/[id]` page

`src/app/(hub)/mod/enforcement/[id]/page.tsx` -- single enforcement action detail

- Shows user info, action type, trigger, reason, details JSON, status
- If linked to content report: shows report summary with link
- If ACTIVE: "Lift Action" button with reason form
- Gate: STAFF(ADMIN, MODERATION)

#### H6. New `/mod/enforcement/new` page

`src/app/(hub)/mod/enforcement/new/page.tsx` -- form to issue enforcement action

- User search (by email or name)
- Action type dropdown
- Trigger type dropdown
- Reason textarea
- Optional expiry date picker
- Optional content report link
- Gate: STAFF(ADMIN, MODERATION)

### I. Hub Navigation Update

Update `src/lib/hub/admin-nav.ts` to add children under the Moderation group:

```typescript
{ key: 'mod-reports', label: 'Content Reports', href: '/mod/reports', icon: 'Flag', roles: ['ADMIN', 'MODERATION'] },
{ key: 'mod-enforcement', label: 'Enforcement', href: '/mod/enforcement', icon: 'Gavel', roles: ['ADMIN', 'MODERATION'] },
```

### J. Notification Templates

Add 4 new notification templates to `src/lib/notifications/templates.ts`:

1. **`enforcement_coaching`** -- sent to seller when enforcement level becomes COACHING
   - Subject: "Tips to improve your selling performance"
   - Category: trust

2. **`enforcement_warning`** -- sent to seller when enforcement level becomes WARNING
   - Subject: "Action required: Your selling performance needs attention"
   - Category: trust

3. **`enforcement_restriction`** -- sent to seller when enforcement level becomes RESTRICTION
   - Subject: "Your account has been restricted"
   - Category: trust

4. **`enforcement_lifted`** -- sent to seller when enforcement action is lifted
   - Subject: "Account restriction has been lifted"
   - Category: trust

These templates define the shape only. Actual triggering happens in G4.1 (auto-enforcement) and the manual actions in F2.

### K. User-Facing Report Button

**NOT in G4 scope.** The "Report" button on listing detail, review, and message pages will be wired when G4 is complete. For now, the `submitContentReportAction` is callable -- the UI button integration can be done as a follow-up or in G4.1. The action is testable via unit tests.

**OWNER DECISION NEEDED:** Should G4 include adding a "Report" button to the listing detail page (`/i/[slug]`) and review components? This is straightforward UI work but not strictly "infrastructure." If YES, add a small dropdown menu (triple-dot or flag icon) with "Report this listing" / "Report this review" that opens a modal with reason picker + optional description. If NO, defer to a separate ticket.

---

## Constraints -- What NOT to Do

### Banned Terms -- Verify Zero Occurrences
- NO `SellerTier` (use `StoreTier` or `ListerTier`)
- NO `FVF` or `Final Value Fee` (use `TF` or `Transaction Fee`)
- NO `BASIC`, `ELITE`, `PLUS`, `MAX`, `PREMIUM` as tier names
- NO `Twicely Balance` (use "Available for payout")
- NO `wallet` in seller UI (use `payout`)
- NO `Withdraw` (use "Request payout")
- NO `Below Standard` badge visible to buyers (Seller Score Canonical: "Buyers never see a negative signal about a seller")

### Tech Stack
- NO Prisma (use Drizzle)
- NO NextAuth (use Better Auth)
- NO Redis (use Valkey)
- NO custom RBAC (use CASL)

### Business Rules -- Enforcement-Specific
- Enforcement does NOT affect Transaction Fee rates (Seller Score Canonical: "No performance band... affects TF rates")
- SUSPENDED status is NOT score-derived -- it is an admin action or policy violation (Seller Score Canonical Section 3.2)
- Policy violations are SEPARATE from score-based enforcement (Seller Score Canonical Section 6.4)
- Buyers NEVER see negative seller labels (no "Below Standard" badge, no warning indicators) -- Seller Score Canonical: "No Negative Labels to Buyers"
- `enforcementLevel` on sellerProfile is a TEXT field (not an enum) -- stores 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION' | null
- The `bandOverride` field uses `performanceBandEnum` (existing enum, not a new one)

### Code Patterns
- All IDs are CUID2 `text`, not UUID
- Money in integer cents
- Zod `.strict()` on all validation schemas
- Explicit field mapping in all DB updates (never spread request body)
- Max 300 lines per file
- `userId` is the ownership key (never `sellerProfileId` as ownership)
- Staff actions logged with `session.staffUserId` as actorId
- Server actions: `'use server'` directive, no exported helpers

### Route Enforcement
- All hub pages under `/mod/` prefix
- No `/admin/`, no `/dashboard/`

---

## Acceptance Criteria

### Schema
- [ ] 6 new enums exist in `enums.ts` and compile without errors
- [ ] `contentReport` table has all specified columns with correct types, defaults, and indexes
- [ ] `enforcementAction` table has all specified columns with correct types, defaults, and indexes
- [ ] `sellerProfile` has 7 new enforcement columns: `enforcementLevel`, `enforcementStartedAt`, `warningExpiresAt`, `bandOverride`, `bandOverrideExpiresAt`, `bandOverrideReason`, `bandOverrideBy`
- [ ] All new tables/enums are exported from `src/lib/db/schema/index.ts`
- [ ] Drizzle migration file exists and is syntactically valid

### CASL
- [ ] `ContentReport` and `EnforcementAction` appear in `SUBJECTS` array
- [ ] MODERATION role has read+update on ContentReport and read+create+update on EnforcementAction
- [ ] SUPPORT role has read on ContentReport and read on EnforcementAction
- [ ] ADMIN still has `manage all` (no changes needed)

### Platform Settings
- [ ] 11 new platform settings seeded with correct keys, types, defaults, and category
- [ ] All settings have `editable: true`

### Server Actions
- [ ] `submitContentReportAction` -- requires auth, validates target exists, creates report, creates audit event, enforces rate limit, prevents self-reporting
- [ ] `reviewContentReportAction` -- requires staff auth, CASL check, updates status, sets reviewer, creates audit event
- [ ] `issueEnforcementActionAction` -- requires staff auth, CASL check, creates action, applies side effects to listing/sellerProfile as appropriate, creates audit event
- [ ] `liftEnforcementActionAction` -- requires staff auth, CASL check, sets LIFTED status, reverses side effects, creates audit event
- [ ] `updateSellerBandOverrideAction` -- requires staff auth, CASL check, sets band override fields, creates audit event
- [ ] All actions use Zod `.strict()` validation
- [ ] All actions use explicit field mapping (no spread)
- [ ] No exported helper functions (only exported server actions)

### Queries
- [ ] Content report queries: list (paginated+filtered), getById, countByStatus, getUserReportHistory, getReportsForTarget
- [ ] Enforcement action queries: list (paginated+filtered), getById, getActiveForUser, getHistory, getKPIs
- [ ] All queries use proper Drizzle select patterns

### Hub Pages
- [ ] `/mod` overview page shows Content Reports KPI and Active Enforcement KPI alongside existing metrics
- [ ] `/mod/reports` page renders content reports table with status filter tabs
- [ ] `/mod/reports/[id]` page shows report detail with Confirm/Dismiss actions
- [ ] `/mod/enforcement` page renders enforcement actions table with status filter tabs
- [ ] `/mod/enforcement/[id]` page shows action detail with Lift button
- [ ] `/mod/enforcement/new` page shows form to issue new enforcement action
- [ ] All hub pages use `staffAuthorize()` with appropriate CASL checks
- [ ] Hub sidebar navigation includes Content Reports and Enforcement items under Moderation

### Notification Templates
- [ ] 4 new templates exist: `enforcement_coaching`, `enforcement_warning`, `enforcement_restriction`, `enforcement_lifted`
- [ ] Templates follow existing pattern in `templates.ts`

### Negative Criteria
- [ ] No buyer-facing "Below Standard" badge or negative seller label anywhere
- [ ] No score calculation logic (that is G4.1)
- [ ] No appeal submission flow (that is G4.2)
- [ ] No daily BullMQ recalculation job (that is G4.1)
- [ ] No `/my/selling/performance` page (that is G4.1)
- [ ] No auto-enforcement triggered by score thresholds (that is G4.1)
- [ ] Zero banned terms in any new code or UI text
- [ ] Zero TypeScript errors
- [ ] Zero `as any`, `@ts-ignore`, or `@ts-expect-error`
- [ ] No files over 300 lines
- [ ] No hardcoded fee rates or threshold values (all from platform_settings)

---

## Test Requirements

### Unit Tests

#### `src/lib/validations/__tests__/enforcement-schemas.test.ts` (~15 tests)
- contentReportSchema accepts valid input with all required fields
- contentReportSchema rejects unknown keys (`.strict()`)
- contentReportSchema rejects invalid targetType
- contentReportSchema rejects invalid reason enum
- contentReportSchema rejects description over 1000 chars
- reviewContentReportSchema accepts CONFIRMED and DISMISSED statuses
- issueEnforcementActionSchema validates all required fields
- issueEnforcementActionSchema rejects missing reason
- liftEnforcementActionSchema accepts valid actionId + liftedReason
- updateSellerEnforcementSchema validates nullable enforcementLevel

#### `src/lib/actions/__tests__/content-report.test.ts` (~15 tests)
- submitContentReportAction creates report for valid listing target
- submitContentReportAction creates report for valid review target
- submitContentReportAction rejects unauthenticated user
- submitContentReportAction rejects self-reporting (reporter = target owner)
- submitContentReportAction enforces rate limit (11th report in 24h rejected)
- submitContentReportAction rejects non-existent target
- submitContentReportAction creates audit event
- submitContentReportAction validates input with Zod

#### `src/lib/actions/__tests__/enforcement.test.ts` (~25 tests)
- reviewContentReportAction updates status to CONFIRMED
- reviewContentReportAction updates status to DISMISSED
- reviewContentReportAction rejects non-MODERATION staff
- reviewContentReportAction rejects non-existent report
- reviewContentReportAction sets reviewedByStaffId and reviewedAt
- issueEnforcementActionAction creates action for LISTING_REMOVAL
- issueEnforcementActionAction sets listing.enforcementState to REMOVED when LISTING_REMOVAL
- issueEnforcementActionAction sets sellerProfile.status to SUSPENDED when SUSPENSION
- issueEnforcementActionAction sets sellerProfile.status to RESTRICTED when RESTRICTION
- issueEnforcementActionAction sets sellerProfile.enforcementLevel for WARNING
- issueEnforcementActionAction rejects non-MODERATION staff
- issueEnforcementActionAction creates audit event with CRITICAL severity for SUSPENSION
- liftEnforcementActionAction sets status to LIFTED
- liftEnforcementActionAction reverses SUSPENSION back to ACTIVE
- liftEnforcementActionAction reverses RESTRICTION back to ACTIVE
- liftEnforcementActionAction clears enforcementLevel when lifting WARNING
- liftEnforcementActionAction rejects already-LIFTED action
- liftEnforcementActionAction rejects non-MODERATION staff
- updateSellerBandOverrideAction sets override fields
- updateSellerBandOverrideAction creates audit event

#### `src/lib/queries/__tests__/content-reports.test.ts` (~10 tests)
- getContentReports returns paginated results filtered by status
- getContentReportById returns full report with reporter name
- getContentReportCountByStatus returns correct counts per status
- getUserReportHistory returns all reports by a specific user
- getReportsForTarget returns reports for a specific listing

#### `src/lib/queries/__tests__/enforcement-actions.test.ts` (~10 tests)
- getEnforcementActions returns paginated results filtered by user and status
- getEnforcementActionById returns full action with user info
- getActiveEnforcementForUser returns only ACTIVE actions for a user
- getEnforcementHistory returns all actions for a user regardless of status
- getEnforcementKPIs returns correct counts for active warnings, restrictions, suspensions

Total: ~75 new tests expected.

---

## File Approval List

### New Files

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/db/schema/enforcement.ts` | contentReport + enforcementAction Drizzle tables |
| 2 | `drizzle/XXXX_add-enforcement-infrastructure.sql` | Migration: new enums, new tables, sellerProfile columns |
| 3 | `src/lib/validations/enforcement.ts` | Zod schemas for content reports and enforcement actions |
| 4 | `src/lib/actions/content-report.ts` | User-facing content report submission action |
| 5 | `src/lib/actions/enforcement.ts` | Staff enforcement actions: review report, issue/lift action, band override |
| 6 | `src/lib/queries/content-reports.ts` | Content report query functions |
| 7 | `src/lib/queries/enforcement-actions.ts` | Enforcement action query functions |
| 8 | `src/app/(hub)/mod/reports/page.tsx` | Content reports list page |
| 9 | `src/app/(hub)/mod/reports/[id]/page.tsx` | Content report detail page |
| 10 | `src/app/(hub)/mod/enforcement/page.tsx` | Enforcement actions list page |
| 11 | `src/app/(hub)/mod/enforcement/[id]/page.tsx` | Enforcement action detail page |
| 12 | `src/app/(hub)/mod/enforcement/new/page.tsx` | Issue enforcement action form page |
| 13 | `src/components/admin/actions/enforcement-actions.tsx` | Client components for enforcement action buttons |
| 14 | `src/components/admin/actions/report-review-actions.tsx` | Client components for content report review buttons |
| 15 | `src/lib/validations/__tests__/enforcement-schemas.test.ts` | Validation schema tests |
| 16 | `src/lib/actions/__tests__/content-report.test.ts` | Content report action tests |
| 17 | `src/lib/actions/__tests__/enforcement.test.ts` | Enforcement action tests |
| 18 | `src/lib/queries/__tests__/content-reports.test.ts` | Content report query tests |
| 19 | `src/lib/queries/__tests__/enforcement-actions.test.ts` | Enforcement action query tests |

### Modified Files

| # | File Path | Change |
|---|-----------|--------|
| 20 | `src/lib/db/schema/enums.ts` | Add 6 new enums |
| 21 | `src/lib/db/schema/identity.ts` | Add 7 enforcement columns to sellerProfile |
| 22 | `src/lib/db/schema/index.ts` | Export new tables and enums |
| 23 | `src/lib/casl/subjects.ts` | Add ContentReport, EnforcementAction |
| 24 | `src/lib/casl/platform-abilities.ts` | Add enforcement CASL rules for MODERATION and SUPPORT |
| 25 | `src/lib/hub/admin-nav.ts` | Add Content Reports and Enforcement nav items |
| 26 | `src/lib/db/seed/v32-platform-settings-extended.ts` | Add 11 enforcement threshold settings |
| 27 | `src/lib/notifications/templates.ts` | Add 4 enforcement notification templates |
| 28 | `src/app/(hub)/mod/page.tsx` | Add Content Reports and Enforcement KPI cards |
| 29 | `src/lib/queries/admin-moderation.ts` | Add enforcement KPI to getModerationKPIs |

**Total: 19 new files + 10 modified files = 29 files**

---

## Verification Checklist

After implementation, run and report:

```bash
./twicely-lint.sh
```

Expected outcomes:
1. TypeScript: 0 errors
2. Tests: >= 5759 (current baseline) + ~75 new = >= 5834
3. Banned terms: 0 occurrences
4. Wrong routes: 0 occurrences
5. Files over 300 lines: 0
6. Console.log in production: 0

Additionally verify:
- `pnpm drizzle-kit generate` completes without errors (if applicable)
- New hub pages render at `/mod/reports`, `/mod/enforcement`, `/mod/enforcement/new`
- Existing mod pages still work (`/mod`, `/mod/listings`, `/mod/reviews`)

---

## SPEC INCONSISTENCIES AND OWNER DECISIONS

### 1. Content Report Tables Not in Schema Doc

The schema doc (v2.1.0) has NO `contentReport` or `enforcementAction` tables in its 144-table inventory. Feature Lock-in Section 44 describes enforcement behavior, and the Seller Score Canonical defines enforcement thresholds and sellerProfile fields, but neither doc defines the content report or enforcement action tables explicitly.

**Decision needed:** These tables are clearly implied by the feature requirements (users can "Report message: flag for moderation" per Feature Lock-in Section 19, staff can "remove/clear/warn" per Page Registry Section 8.6, policy violations have escalation per FL Section 44). The table designs above are derived from these requirements. The owner should confirm the table structure is acceptable before implementation OR these tables should be added to the schema doc.

### 2. Seller Score Canonical Uses UUID, Codebase Uses CUID2

The Seller Score Canonical Section 10.2 specifies `uuid('band_override_by').references(() => users.id)`. The actual codebase uses `text` with CUID2 for all IDs. This prompt uses `text('band_override_by')` to match the codebase convention.

### 3. `performanceBandEnum` vs Seller Score Canonical

The schema doc's `performanceBandEnum` is `['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']` (4 values). The Seller Score Canonical Section 10.1 lists 5 values including `SUSPENDED`. The actual codebase `enums.ts` has 4 values matching the schema doc (no SUSPENDED). SUSPENDED is handled by `sellerProfile.status = 'SUSPENDED'`, not by the band enum. The `bandOverride` field should use the existing 4-value enum.

### 4. Report Button UI Scope

Should G4 include adding "Report" buttons to the listing detail page and review components? See section K above. This is a small UI addition (~30 minutes) but goes beyond pure infrastructure.

### 5. Feature Lock-in Section 44 vs Seller Score Canonical Section 6

Feature Lock-in Section 44 defines metric-based thresholds (e.g., "Shipping time < 90% = Warning, < 80% = Restriction"). Seller Score Canonical Section 6 defines score-based thresholds (e.g., "Score 250-399 = Warning"). These are TWO DIFFERENT approaches. The Seller Score Canonical explicitly says it "Supersedes Feature Lock-in Section 44" for scoring specifics. G4 seeds BOTH sets of platform settings so G4.1 can use whichever the owner prefers. The enforcement infrastructure supports both approaches.
