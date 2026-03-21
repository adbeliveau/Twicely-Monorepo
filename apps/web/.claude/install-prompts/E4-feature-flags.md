# E4 — Feature Flags + Audit Log Viewer

**Phase & Step:** `[E4]`
**Feature Name:** Feature Flags Management + Audit Log Viewer
**One-line Summary:** Build the hub `/flags` page for managing feature flags (create, toggle, percentage rollout, targeting) and the `/audit` page for viewing immutable audit events, with full server actions, queries, Zod validation, CASL authorization, and tests.

**Canonical Sources (read ALL before starting):**
1. `TWICELY_V3_SCHEMA_v2_0_7.md` — Section 14.3 (`featureFlag`), Section 14.4 (`auditEvent`)
2. `TWICELY_V3_PAGE_REGISTRY.md` — Page #117 (`/audit`), Page #118-119 (`/health`, `/health/doctor`), Page #120 (`/flags`)
3. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — Section 38 (Feature Flags), Section 39 (Audit Logging)
4. `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — Section 3.5 (DEVELOPER role), Section 4.3.4 (FeatureFlag subject)
5. `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` — E4 entry
6. `TWICELY_V3_TESTING_STANDARDS.md` — Test patterns

---

## 1. PREREQUISITES

### Completed Dependencies
- **E3 (Admin Dashboard)** -- DONE. All hub infrastructure exists: `staffAuthorize()`, hub layout, admin-nav, CASL platform-abilities.
- **A4 / A4.1 (Staff Roles)** -- DONE. Staff auth, custom roles, permission registry all exist.
- **A2 (Schema)** -- DONE. `featureFlag` table and `auditEvent` table already exist in `src/lib/db/schema/platform.ts`.

### Already Exists (DO NOT recreate)
- `featureFlag` table in `src/lib/db/schema/platform.ts` (lines 37-49)
- `featureFlagTypeEnum` in `src/lib/db/schema/enums.ts` (line 149): `['BOOLEAN', 'PERCENTAGE', 'TARGETED']`
- `auditEvent` table in `src/lib/db/schema/platform.ts` (lines 52-69)
- `auditSeverityEnum` in `src/lib/db/schema/enums.ts`: `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']`
- `FeatureFlag` in CASL `subjects.ts` (line 25)
- `AuditEvent` in CASL `subjects.ts` (line 26)
- DEVELOPER role can `read` + `update` FeatureFlag (platform-abilities.ts lines 65-68)
- ADMIN can `manage all` (includes FeatureFlag and AuditEvent)
- Feature Flags nav entry in `admin-nav.ts` (lines 130-135): `{ key: 'feature-flags', href: '/flags', roles: ['ADMIN', 'DEVELOPER'] }`
- Audit Log nav entry in `admin-nav.ts` (lines 158-163): `{ key: 'audit-log', href: '/audit', roles: 'any' }`
- `FeatureFlag` in permission-registry-data.ts (lines 272-282) with actions: read, create, update, delete
- `AuditEvent` in permission-registry-data.ts (lines 284-289) with action: read only

### NPM Dependencies
None required beyond existing stack. No new packages.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2.1 Database

**NO schema changes.** All tables already exist.

**`featureFlag` table (already in `platform.ts`):**
```typescript
export const featureFlag = pgTable('feature_flag', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  key:                 text('key').notNull().unique(),       // e.g. 'feature.newCheckoutFlow'
  name:                text('name').notNull(),               // Human-readable name
  description:         text('description'),                  // Optional description
  type:                featureFlagTypeEnum('type').notNull().default('BOOLEAN'),  // BOOLEAN | PERCENTAGE | TARGETED
  enabled:             boolean('enabled').notNull().default(false),
  percentage:          integer('percentage'),                 // 0-100 for PERCENTAGE type
  targetingJson:       jsonb('targeting_json').notNull().default(sql`'{}'`),  // Segment rules for TARGETED type
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**`auditEvent` table (already in `platform.ts`):**
```typescript
export const auditEvent = pgTable('audit_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  actorType:           text('actor_type').notNull(),          // 'STAFF', 'USER', 'SYSTEM'
  actorId:             text('actor_id'),                      // Who did it
  action:              text('action').notNull(),              // e.g. 'TOGGLE_FLAG', 'UPDATE_SETTING'
  subject:             text('subject').notNull(),             // e.g. 'FeatureFlag', 'Setting'
  subjectId:           text('subject_id'),                    // ID of affected resource
  severity:            auditSeverityEnum('severity').notNull().default('LOW'),
  detailsJson:         jsonb('details_json').notNull().default(sql`'{}'`),
  ipAddress:           text('ip_address'),
  userAgent:           text('user_agent'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 2.2 CASL Rules

**Already defined -- no changes needed.**

Per `platform-abilities.ts`:
- DEVELOPER: `can('read', 'FeatureFlag')`, `can('update', 'FeatureFlag')`, `can('read', 'AuditEvent')`
- ADMIN / SUPER_ADMIN: `can('manage', 'all')` (includes create/delete FeatureFlag + read AuditEvent)
- All staff: AuditEvent is read-only. `cannot('delete', 'AuditEvent')` is enforced for ADMIN/SUPER_ADMIN.

**CASL checks to enforce in actions:**
| Action | Required CASL Check |
|--------|-------------------|
| List flags | `ability.can('read', 'FeatureFlag')` |
| Create flag | `ability.can('create', 'FeatureFlag')` -- ADMIN only (DEVELOPER has read + update only) |
| Update flag (toggle, percentage, targeting) | `ability.can('update', 'FeatureFlag')` |
| Delete flag | `ability.can('delete', 'FeatureFlag')` -- ADMIN only |
| List audit events | `ability.can('read', 'AuditEvent')` |

### 2.3 Server Actions

**File: `src/lib/actions/admin-feature-flags.ts`**

Four server actions (all use `staffAuthorize()`):

1. **`createFeatureFlagAction(input: unknown)`**
   - CASL: `ability.can('create', 'FeatureFlag')`
   - Validates: key (dotted format, unique), name, description, type, enabled, percentage (0-100 if PERCENTAGE), targetingJson
   - Inserts into `featureFlag` with `createdByStaffId = session.staffUserId`
   - Creates audit event: action `'CREATE_FLAG'`, subject `'FeatureFlag'`, severity `'MEDIUM'`
   - Returns `{ success: true, id: string }` or `{ error: string }`

2. **`updateFeatureFlagAction(input: unknown)`**
   - CASL: `ability.can('update', 'FeatureFlag')`
   - Validates: flagId, plus updatable fields (name, description, enabled, percentage, targetingJson)
   - Fetches existing flag, updates with explicit field mapping
   - Creates audit event: action `'UPDATE_FLAG'`, severity `'MEDIUM'`, detailsJson includes previous + new values
   - Returns `{ success: true }` or `{ error: string }`

3. **`toggleFeatureFlagAction(input: unknown)`**
   - CASL: `ability.can('update', 'FeatureFlag')`
   - Validates: flagId only
   - Fetches flag, flips `enabled` boolean
   - Creates audit event: action `'TOGGLE_FLAG'`, severity `'HIGH'` (toggling a flag is a high-impact action), detailsJson includes key + previous + new enabled state
   - Returns `{ success: true, enabled: boolean }` or `{ error: string }`

4. **`deleteFeatureFlagAction(input: unknown)`**
   - CASL: `ability.can('delete', 'FeatureFlag')`
   - Validates: flagId
   - Checks flag exists, then hard-deletes from `featureFlag`
   - Creates audit event: action `'DELETE_FLAG'`, severity `'HIGH'`, detailsJson includes deleted key + name
   - Returns `{ success: true }` or `{ error: string }`

### 2.4 Queries

**File: `src/lib/queries/admin-feature-flags.ts`**

1. **`getFeatureFlags(): Promise<FeatureFlagRow[]>`**
   - Selects all flags ordered by `key` ascending
   - Returns typed array with all columns

2. **`getFeatureFlagById(id: string): Promise<FeatureFlagRow | null>`**
   - Selects single flag by ID
   - Returns null if not found

3. **`getFeatureFlagByKey(key: string): Promise<FeatureFlagRow | null>`**
   - Selects single flag by key (for uniqueness checks)
   - Returns null if not found

**File: `src/lib/queries/admin-audit-log.ts`**

1. **`getAuditEvents(params): Promise<{ events: AuditEventRow[], totalCount: number }>`**
   - Params: `{ page?: number, limit?: number, actorType?: string, action?: string, subject?: string, severity?: string, startDate?: string, endDate?: string, actorId?: string, subjectId?: string }`
   - Returns paginated results with total count for pagination
   - Ordered by `createdAt` descending (most recent first)
   - All filters are optional, applied with AND logic

2. **`getAuditEventById(id: string): Promise<AuditEventRow | null>`**
   - Selects single audit event by ID
   - Returns null if not found

### 2.5 Zod Schemas

**File: `src/lib/actions/admin-feature-flag-schemas.ts`**

```typescript
import { z } from 'zod';

// Dotted key format: category.subcategory.name (1-3 segments)
const flagKeyRegex = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){0,2}$/;

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(flagKeyRegex, 'Key must be dotted lowercase (e.g. feature.newCheckout)'),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'TARGETED']).default('BOOLEAN'),
  enabled: z.boolean().default(false),
  percentage: z.number().int().min(0).max(100).optional(),
  targetingJson: z.record(z.unknown()).optional(),
}).strict().refine(
  (data) => data.type !== 'PERCENTAGE' || (data.percentage !== undefined && data.percentage !== null),
  { message: 'Percentage is required for PERCENTAGE type flags', path: ['percentage'] }
);

export const updateFeatureFlagSchema = z.object({
  flagId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  percentage: z.number().int().min(0).max(100).optional(),
  targetingJson: z.record(z.unknown()).optional(),
}).strict();

export const toggleFeatureFlagSchema = z.object({
  flagId: z.string().min(1),
}).strict();

export const deleteFeatureFlagSchema = z.object({
  flagId: z.string().min(1),
}).strict();

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
```

**File: `src/lib/queries/admin-audit-log-schemas.ts`**

```typescript
import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorType: z.string().optional(),
  action: z.string().optional(),
  subject: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actorId: z.string().optional(),
  subjectId: z.string().optional(),
}).strict();

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
```

### 2.6 Pages

**Page #120: `/flags` -- Feature Flags (hub.twicely.co/flags)**
- Route: `src/app/(hub)/flags/page.tsx`
- Layout: hub
- Gate: `STAFF(ADMIN, DEVELOPER)` -- enforced via `staffAuthorize()` + `ability.can('read', 'FeatureFlag')`
- Title: `Feature Flags | Twicely Hub` (noindex, nofollow)

**UI Requirements:**
- Page header: "Feature Flags" with description "Manage feature rollouts, A/B tests, and kill switches."
- "Create Flag" button (visible only if `ability.can('create', 'FeatureFlag')` -- ADMIN only, not DEVELOPER)
- Flag list as a table/card grid:
  - Each row: key, name, type badge, enabled toggle switch, percentage (if applicable), description, created date
  - Toggle switch fires `toggleFeatureFlagAction` inline (no page navigation)
  - Click row to expand/edit (inline or modal)
  - Delete button (only if `ability.can('delete', 'FeatureFlag')` -- ADMIN only)
- "Kill Switch" visual indicator: flags with key prefix `kill.` shown with red styling
- Empty state: "No feature flags configured yet."

**Page #117: `/audit` -- Audit Log (hub.twicely.co/audit)**
- Route: `src/app/(hub)/audit/page.tsx`
- Layout: hub
- Gate: `STAFF(any)` -- all authenticated staff can view audit log
- Title: `Audit Log | Twicely Hub` (noindex, nofollow)

**UI Requirements:**
- Page header: "Audit Log" with description "Immutable record of all platform actions."
- Filter bar with dropdowns:
  - Actor Type: All / STAFF / USER / SYSTEM
  - Action: text input (free-text search)
  - Subject: dropdown from known subjects (Listing, Order, User, Setting, FeatureFlag, etc.)
  - Severity: All / LOW / MEDIUM / HIGH / CRITICAL
  - Date range: start date + end date pickers
- Audit event table:
  - Columns: Timestamp, Actor, Action, Subject, Subject ID, Severity badge, Details (expandable)
  - Severity badges: LOW = gray, MEDIUM = blue, HIGH = yellow, CRITICAL = red
  - Paginated (50 per page)
  - Ordered by most recent first
  - Click to expand row and show full `detailsJson` as formatted JSON
- No create/edit/delete actions -- audit events are immutable (read-only page)
- Empty state: "No audit events recorded yet."

### 2.7 Components

**File: `src/components/admin/feature-flag-table.tsx`**
- Client component (`'use client'`)
- Renders the flag list as a table
- Each row has:
  - Key (monospace font)
  - Name
  - Type badge (BOOLEAN = green, PERCENTAGE = blue, TARGETED = purple)
  - Toggle switch (calls `toggleFeatureFlagAction` via form action or client fetch)
  - Percentage display (if PERCENTAGE type, show `XX%`)
  - Actions: Edit button, Delete button (ADMIN-gated)
- Props: `{ flags: FeatureFlagRow[], canCreate: boolean, canDelete: boolean }`

**File: `src/components/admin/feature-flag-form.tsx`**
- Client component (`'use client'`)
- Used for both create and edit (determines by presence of `initialData` prop)
- Fields: key (create only, disabled on edit), name, description, type selector (BOOLEAN/PERCENTAGE/TARGETED), enabled toggle, percentage slider (shown only for PERCENTAGE type), targeting rules JSON editor (shown only for TARGETED type)
- Calls `createFeatureFlagAction` or `updateFeatureFlagAction`
- Uses dialog/modal pattern (shadcn Dialog)
- Props: `{ initialData?: FeatureFlagRow, onSuccess: () => void }`

**File: `src/components/admin/audit-log-table.tsx`**
- Client component (`'use client'`)
- Renders the audit event list as a table with expandable rows
- Severity badges with color coding
- Expandable detail panel showing formatted `detailsJson`
- Props: `{ events: AuditEventRow[], totalCount: number, page: number, limit: number }`

**File: `src/components/admin/audit-log-filters.tsx`**
- Client component (`'use client'`)
- Filter controls: actor type dropdown, action text input, subject dropdown, severity dropdown, date range
- Uses URL search params for filter state (server-side filtering)
- Props: `{ currentFilters: AuditLogQuery }`

### 2.8 Feature Flag Evaluation Service

**File: `src/lib/services/feature-flags.ts`**

A server-side service for evaluating feature flags in application code:

```typescript
/**
 * Check if a feature flag is enabled for a given context.
 *
 * Evaluation order (per Feature Lock-in Section 38):
 * 1. User-specific override (if exists in targetingJson.userOverrides) -> use it
 * 2. Segment targeting (if matches targetingJson.segments) -> use it
 * 3. Percentage rollout (if PERCENTAGE type) -> hash(userId + flagKey) determines bucket
 * 4. Default value (enabled field)
 */
export async function isFeatureEnabled(
  flagKey: string,
  context?: { userId?: string }
): Promise<boolean>
```

This reads from the database directly for now. The spec mentions Valkey caching with 30-second TTL -- note this as a future optimization but do NOT implement Valkey caching in E4. The caching infrastructure is not yet deployed.

### 2.9 Platform Settings to Seed

Per Feature Lock-in Section 38:
- `featureFlags.cacheSeconds`: 30 (default). Valkey cache TTL. Category: `featureFlags`.
- `featureFlags.requireApprovalForProduction`: false (default). Category: `featureFlags`.

These should be added to the seed data in `src/lib/db/seed.ts` (or the appropriate seed file) under the `featureFlags` category.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- No `SellerTier`, `SubscriptionTier`, `FVF`, `BASIC`, `ELITE`, `PLUS`, `MAX`, `PREMIUM`, `STANDARD`, `RISING`, `Twicely Balance`, `wallet`, `Withdraw`, `FinanceTier`
- These terms are unlikely to appear in feature flags/audit code, but scan output before committing

### Banned Tech
- No Prisma, no NextAuth, no Redis (use Valkey references only if needed), no tRPC
- No Zustand/Redux for UI state -- use React context + server state patterns

### Route Enforcement
- Feature flags page: `/flags` (NOT `/feature-flags`, NOT `/cfg/flags`)
- Audit log page: `/audit` (NOT `/audit-log`, NOT `/cfg/audit`)
- Both under `(hub)` route group

### Code Pattern Enforcement
- `strict: true` TypeScript -- zero `as any`, zero `@ts-ignore`
- Zod `.strict()` on ALL input schemas
- `staffAuthorize()` for authorization (NOT `authorize()`)
- Explicit field mapping on all DB writes (never spread request body)
- Max 300 lines per file
- Audit events are INSERT-ONLY -- no update/delete methods anywhere
- All query params validated through Zod

### Business Logic Enforcement
- Audit events are IMMUTABLE -- the audit log page is read-only, no edit/delete UI
- Feature flag toggle is severity HIGH (per Feature Lock-in Section 38: "Admin Actions: feature flag toggled")
- DEVELOPER can read + update flags but CANNOT create or delete (per Actors Canonical Section 3.5 agent permissions matrix)
- All flag changes produce an audit event
- Flag key format is dotted lowercase: `category.subcategory.name`
- Percentage flags require a percentage value (0-100)

### What NOT to Build in E4
- Valkey caching layer for flags (infrastructure not deployed)
- Client-side React Context for flag evaluation (deferred -- use server-side evaluation for now)
- Centrifugo real-time flag change propagation
- Health check pages (E5 scope -- `/health` and `/health/doctor`)
- Data retention page (G8 scope)

---

## 4. ACCEPTANCE CRITERIA

### Feature Flags
- [ ] `/flags` page renders for ADMIN role staff
- [ ] `/flags` page renders for DEVELOPER role staff
- [ ] `/flags` page returns "Access denied" for SUPPORT, MODERATION, FINANCE, SRE, HELPDESK_* roles
- [ ] ADMIN can create a new BOOLEAN flag with key, name, description
- [ ] ADMIN can create a PERCENTAGE flag with percentage value 0-100
- [ ] ADMIN can create a TARGETED flag with targetingJson
- [ ] DEVELOPER cannot create a flag (CASL denies `create` on `FeatureFlag` for DEVELOPER)
- [ ] DEVELOPER can toggle a flag (CASL allows `update` on `FeatureFlag`)
- [ ] DEVELOPER can update flag name, description, percentage, targeting
- [ ] DEVELOPER cannot delete a flag (CASL denies `delete` on `FeatureFlag` for DEVELOPER)
- [ ] ADMIN can delete a flag
- [ ] Toggle action flips the `enabled` boolean and returns the new state
- [ ] Creating a flag with a duplicate key returns an error
- [ ] Creating a PERCENTAGE flag without a percentage value returns validation error
- [ ] Every flag create/update/toggle/delete produces an audit event
- [ ] Audit events for flag changes include the flag key in detailsJson
- [ ] Toggle audit events have severity HIGH
- [ ] Create/update audit events have severity MEDIUM
- [ ] Delete audit events have severity HIGH
- [ ] Zod strict mode rejects unknown fields on all inputs
- [ ] Empty key or empty name rejected by validation
- [ ] Key format enforced (dotted lowercase only)
- [ ] Percentage values outside 0-100 rejected by validation

### Audit Log
- [ ] `/audit` page renders for ALL staff roles (gate is `'any'`)
- [ ] Audit events displayed in reverse chronological order
- [ ] Severity badges have correct colors (LOW=gray, MEDIUM=blue, HIGH=yellow, CRITICAL=red)
- [ ] Filter by actor type works
- [ ] Filter by subject works
- [ ] Filter by severity works
- [ ] Filter by date range works
- [ ] Pagination works (50 per page default)
- [ ] Expanding a row shows full detailsJson
- [ ] NO edit or delete controls appear anywhere on the audit page
- [ ] Empty state shows "No audit events recorded yet."

### Feature Flag Evaluation Service
- [ ] `isFeatureEnabled('nonexistent.flag')` returns false
- [ ] `isFeatureEnabled('boolean.flag')` returns the flag's `enabled` value
- [ ] `isFeatureEnabled('percentage.flag', { userId })` deterministically returns true/false based on hash
- [ ] Same userId + same flagKey always returns the same result (deterministic hashing)
- [ ] Different userIds produce different results at roughly the correct percentage rate

### Data Integrity
- [ ] Feature flag IDs are CUID2
- [ ] Audit event IDs are CUID2
- [ ] `createdByStaffId` on flags is set from session, never from request body
- [ ] `actorId` on audit events is set from session, never from request body

### No Banned Terms
- [ ] Zero occurrences of banned terms in any created/modified file

---

## 5. TEST REQUIREMENTS

### Unit Tests

**File: `src/lib/actions/__tests__/admin-feature-flags.test.ts`**

Test categories (follow existing pattern from `admin-settings.test.ts`):

A. Authorization tests:
- `createFeatureFlagAction returns Forbidden when CASL denies create on FeatureFlag`
- `updateFeatureFlagAction returns Forbidden when CASL denies update on FeatureFlag`
- `toggleFeatureFlagAction returns Forbidden when CASL denies update on FeatureFlag`
- `deleteFeatureFlagAction returns Forbidden when CASL denies delete on FeatureFlag`
- `DEVELOPER can toggle but not create (update allowed, create denied)`

B. Validation tests:
- `createFeatureFlagAction rejects empty key`
- `createFeatureFlagAction rejects key with invalid format (spaces, uppercase)`
- `createFeatureFlagAction rejects PERCENTAGE type without percentage value`
- `createFeatureFlagAction rejects percentage outside 0-100`
- `createFeatureFlagAction rejects extra unknown fields via strict schema`
- `updateFeatureFlagAction rejects missing flagId`
- `toggleFeatureFlagAction rejects missing flagId`
- `deleteFeatureFlagAction rejects missing flagId`

C. Not-found tests:
- `updateFeatureFlagAction returns Flag not found for missing ID`
- `toggleFeatureFlagAction returns Flag not found for missing ID`
- `deleteFeatureFlagAction returns Flag not found for missing ID`

D. Business logic tests:
- `createFeatureFlagAction returns error for duplicate key`
- `toggleFeatureFlagAction flips enabled from false to true`
- `toggleFeatureFlagAction flips enabled from true to false`

E. Happy path tests:
- `createFeatureFlagAction creates flag and returns success with ID`
- `createFeatureFlagAction sets createdByStaffId from session`
- `updateFeatureFlagAction updates only provided fields`
- `deleteFeatureFlagAction deletes flag and returns success`

F. Audit event tests:
- `createFeatureFlagAction creates MEDIUM severity audit event`
- `toggleFeatureFlagAction creates HIGH severity audit event`
- `deleteFeatureFlagAction creates HIGH severity audit event with deleted flag details`
- `updateFeatureFlagAction creates MEDIUM severity audit event with before/after values`

**File: `src/lib/queries/__tests__/admin-feature-flags.test.ts`**

- `getFeatureFlags returns all flags ordered by key`
- `getFeatureFlagById returns flag for valid ID`
- `getFeatureFlagById returns null for invalid ID`
- `getFeatureFlagByKey returns flag for valid key`
- `getFeatureFlagByKey returns null for non-existent key`

**File: `src/lib/queries/__tests__/admin-audit-log.test.ts`**

- `getAuditEvents returns paginated events ordered by createdAt desc`
- `getAuditEvents filters by actorType`
- `getAuditEvents filters by subject`
- `getAuditEvents filters by severity`
- `getAuditEvents filters by date range`
- `getAuditEvents returns totalCount for pagination`
- `getAuditEventById returns event for valid ID`
- `getAuditEventById returns null for invalid ID`

**File: `src/lib/services/__tests__/feature-flags.test.ts`**

- `isFeatureEnabled returns false for non-existent flag`
- `isFeatureEnabled returns enabled value for BOOLEAN flag`
- `isFeatureEnabled evaluates PERCENTAGE flag deterministically for same userId`
- `isFeatureEnabled returns different results for different userIds (probabilistic)`
- `isFeatureEnabled checks user overrides in targetingJson first`
- `isFeatureEnabled returns false when flag is disabled regardless of type`

### Estimated test count: ~40-45 new tests

---

## 6. FILE APPROVAL LIST

### New Files (14)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/actions/admin-feature-flags.ts` | Server actions: create, update, toggle, delete feature flags |
| 2 | `src/lib/actions/admin-feature-flag-schemas.ts` | Zod schemas for feature flag input validation |
| 3 | `src/lib/queries/admin-feature-flags.ts` | Queries: list flags, get by ID, get by key |
| 4 | `src/lib/queries/admin-audit-log.ts` | Queries: list audit events with filters and pagination |
| 5 | `src/lib/queries/admin-audit-log-schemas.ts` | Zod schema for audit log query params |
| 6 | `src/lib/services/feature-flags.ts` | Feature flag evaluation service: `isFeatureEnabled()` |
| 7 | `src/app/(hub)/flags/page.tsx` | Feature flags management page |
| 8 | `src/app/(hub)/audit/page.tsx` | Audit log viewer page |
| 9 | `src/components/admin/feature-flag-table.tsx` | Feature flag list table with toggle switches |
| 10 | `src/components/admin/feature-flag-form.tsx` | Create/edit feature flag dialog form |
| 11 | `src/components/admin/audit-log-table.tsx` | Audit event table with expandable details |
| 12 | `src/components/admin/audit-log-filters.tsx` | Audit log filter controls |
| 13 | `src/lib/actions/__tests__/admin-feature-flags.test.ts` | Tests for feature flag server actions |
| 14 | `src/lib/queries/__tests__/admin-feature-flags.test.ts` | Tests for feature flag queries |
| 15 | `src/lib/queries/__tests__/admin-audit-log.test.ts` | Tests for audit log queries |
| 16 | `src/lib/services/__tests__/feature-flags.test.ts` | Tests for feature flag evaluation service |

### Modified Files (1)

| # | File Path | Change Description |
|---|-----------|-------------------|
| 1 | `src/lib/db/seed.ts` (or appropriate seed file) | Add `featureFlags.cacheSeconds` and `featureFlags.requireApprovalForProduction` platform settings |

### Total: 16 new + 1 modified = 17 files

---

## 7. PARALLEL STREAMS

This feature has 17 files and 3 independent sub-tasks. Decompose into 3 streams.

### Dependency Graph

```
Stream A (Schemas + Queries + Seed)
  |
  v
Stream B (Actions + Evaluation Service)          Stream C (Pages + Components)
  |                                                |
  +---------> [Both depend on A] <-----------------+
```

Stream A must complete first. Streams B and C can run in parallel after A.

### Stream A: Schemas + Queries + Seed (5 files)

**Purpose:** Define Zod validation schemas, database queries, audit log query schemas, and seed data.

**Files:**
1. `src/lib/actions/admin-feature-flag-schemas.ts`
2. `src/lib/queries/admin-feature-flags.ts`
3. `src/lib/queries/admin-audit-log-schemas.ts`
4. `src/lib/queries/admin-audit-log.ts`
5. Modify `src/lib/db/seed.ts` (add platform settings)

**Interface contracts (types for downstream streams):**

```typescript
// ─── From admin-feature-flag-schemas.ts ─────────────────────────────────────
import { z } from 'zod';

const flagKeyRegex = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){0,2}$/;

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(flagKeyRegex, 'Key must be dotted lowercase (e.g. feature.newCheckout)'),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'TARGETED']).default('BOOLEAN'),
  enabled: z.boolean().default(false),
  percentage: z.number().int().min(0).max(100).optional(),
  targetingJson: z.record(z.unknown()).optional(),
}).strict().refine(
  (data) => data.type !== 'PERCENTAGE' || (data.percentage !== undefined && data.percentage !== null),
  { message: 'Percentage is required for PERCENTAGE type flags', path: ['percentage'] }
);

export const updateFeatureFlagSchema = z.object({
  flagId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  percentage: z.number().int().min(0).max(100).optional(),
  targetingJson: z.record(z.unknown()).optional(),
}).strict();

export const toggleFeatureFlagSchema = z.object({
  flagId: z.string().min(1),
}).strict();

export const deleteFeatureFlagSchema = z.object({
  flagId: z.string().min(1),
}).strict();

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;

// ─── From admin-feature-flags.ts (queries) ──────────────────────────────────

export interface FeatureFlagRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: 'BOOLEAN' | 'PERCENTAGE' | 'TARGETED';
  enabled: boolean;
  percentage: number | null;
  targetingJson: unknown;
  createdByStaffId: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getFeatureFlags(): Promise<FeatureFlagRow[]>;
export async function getFeatureFlagById(id: string): Promise<FeatureFlagRow | null>;
export async function getFeatureFlagByKey(key: string): Promise<FeatureFlagRow | null>;

// ─── From admin-audit-log-schemas.ts ────────────────────────────────────────

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorType: z.string().optional(),
  action: z.string().optional(),
  subject: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actorId: z.string().optional(),
  subjectId: z.string().optional(),
}).strict();

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

// ─── From admin-audit-log.ts (queries) ──────────────────────────────────────

export interface AuditEventRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  subject: string;
  subjectId: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detailsJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export async function getAuditEvents(params: AuditLogQuery): Promise<{
  events: AuditEventRow[];
  totalCount: number;
}>;
export async function getAuditEventById(id: string): Promise<AuditEventRow | null>;
```

**Seed data to add:**
```typescript
// In seed.ts, add to the platform settings seed array:
{ key: 'featureFlags.cacheSeconds', value: 30, type: 'number', category: 'featureFlags', description: 'Valkey cache TTL in seconds for feature flag values' },
{ key: 'featureFlags.requireApprovalForProduction', value: false, type: 'boolean', category: 'featureFlags', description: 'Require 2-person approval for production flag changes' },
```

**Query implementation notes:**
- `getAuditEvents` must build a dynamic WHERE clause using `and()` from drizzle-orm, adding conditions only for provided filter params
- For date range filtering, use `gte` and `lte` on `auditEvent.createdAt`
- For total count, use a separate `db.select({ count: sql<number>`count(*)`` })` query with the same filters
- Keep the count query and data query in the same function for atomic filter application

---

### Stream B: Actions + Evaluation Service (3 files + 2 test files)

**Purpose:** Implement server actions for CRUD operations on feature flags, and the `isFeatureEnabled()` evaluation service.

**Depends on:** Stream A (schemas + queries)

**Files:**
1. `src/lib/actions/admin-feature-flags.ts`
2. `src/lib/services/feature-flags.ts`
3. `src/lib/actions/__tests__/admin-feature-flags.test.ts`
4. `src/lib/services/__tests__/feature-flags.test.ts`

**Implementation details for `admin-feature-flags.ts`:**

Follow the exact pattern from `admin-settings.ts`:
- `'use server'` directive at top
- Import `staffAuthorize` from `@/lib/casl/staff-authorize`
- Import Zod schemas from `./admin-feature-flag-schemas`
- Import `db` from `@/lib/db`
- Import `featureFlag`, `auditEvent` from `@/lib/db/schema`
- Import `eq` from `drizzle-orm`
- Each action: authorize -> validate -> business logic -> audit -> return

```typescript
'use server';

import { db } from '@/lib/db';
import { featureFlag, auditEvent } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@/lib/casl/staff-authorize';
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  toggleFeatureFlagSchema,
  deleteFeatureFlagSchema,
} from './admin-feature-flag-schemas';

export async function createFeatureFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'FeatureFlag')) {
    return { error: 'Forbidden' };
  }

  const parsed = createFeatureFlagSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { key, name, description, type, enabled, percentage, targetingJson } = parsed.data;

  // Check for duplicate key
  const [existing] = await db
    .select({ id: featureFlag.id })
    .from(featureFlag)
    .where(eq(featureFlag.key, key))
    .limit(1);

  if (existing) return { error: 'A flag with this key already exists' };

  // Insert
  const [created] = await db.insert(featureFlag).values({
    key,
    name,
    description: description ?? null,
    type,
    enabled,
    percentage: percentage ?? null,
    targetingJson: targetingJson ?? {},
    createdByStaffId: session.staffUserId,
  }).returning({ id: featureFlag.id });

  // Audit
  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_FLAG',
    subject: 'FeatureFlag',
    subjectId: created.id,
    severity: 'MEDIUM',
    detailsJson: { key, name, type, enabled },
  });

  return { success: true, id: created.id };
}
// ... (similar pattern for update, toggle, delete)
```

**Implementation details for `feature-flags.ts` (evaluation service):**

```typescript
import { db } from '@/lib/db';
import { featureFlag } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Evaluate if a feature flag is enabled.
 *
 * Evaluation order (Feature Lock-in Section 38):
 * 1. Flag disabled -> false
 * 2. User-specific override in targetingJson.userOverrides -> use it
 * 3. Segment targeting (targetingJson.segments) -> use it (NOT IMPLEMENTED YET)
 * 4. Percentage rollout -> hash(userId + flagKey) determines bucket
 * 5. Default (enabled field)
 */
export async function isFeatureEnabled(
  flagKey: string,
  context?: { userId?: string }
): Promise<boolean> {
  const [flag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.key, flagKey))
    .limit(1);

  if (!flag) return false;
  if (!flag.enabled) return false;

  // BOOLEAN type: just return enabled
  if (flag.type === 'BOOLEAN') return true;

  // PERCENTAGE type: deterministic hash
  if (flag.type === 'PERCENTAGE' && flag.percentage !== null) {
    if (!context?.userId) return false;
    const bucket = hashToBucket(context.userId, flagKey);
    return bucket < flag.percentage;
  }

  // TARGETED type: check user overrides
  if (flag.type === 'TARGETED' && context?.userId) {
    const targeting = flag.targetingJson as {
      userOverrides?: Record<string, boolean>;
    };
    if (targeting?.userOverrides?.[context.userId] !== undefined) {
      return targeting.userOverrides[context.userId];
    }
  }

  // Fallback to enabled
  return flag.enabled;
}

/**
 * Deterministic hash to bucket (0-99) for percentage rollout.
 * Uses a simple FNV-1a-inspired hash for consistency.
 */
function hashToBucket(userId: string, flagKey: string): number {
  const input = `${userId}:${flagKey}`;
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return Math.abs(hash) % 100;
}
```

**Test patterns (follow `admin-settings.test.ts` pattern):**

```typescript
// admin-feature-flags.test.ts mock setup:
const mockStaffAuthorize = vi.fn();
vi.mock('@/lib/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
    delete: mockDbDelete,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('@/lib/db/schema', () => ({
  featureFlag: {
    id: 'id', key: 'key', name: 'name', description: 'description',
    type: 'type', enabled: 'enabled', percentage: 'percentage',
    targetingJson: 'targeting_json', createdByStaffId: 'created_by_staff_id',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  auditEvent: {
    id: 'id', action: 'action', subject: 'subject',
  },
}));
```

---

### Stream C: Pages + Components (6 files + 2 test files)

**Purpose:** Build the hub pages and React components for feature flag management and audit log viewing.

**Depends on:** Stream A (queries + types)

**Files:**
1. `src/app/(hub)/flags/page.tsx`
2. `src/app/(hub)/audit/page.tsx`
3. `src/components/admin/feature-flag-table.tsx`
4. `src/components/admin/feature-flag-form.tsx`
5. `src/components/admin/audit-log-table.tsx`
6. `src/components/admin/audit-log-filters.tsx`
7. `src/lib/queries/__tests__/admin-feature-flags.test.ts`
8. `src/lib/queries/__tests__/admin-audit-log.test.ts`

**Page implementation patterns (follow `/roles/page.tsx`):**

```typescript
// src/app/(hub)/flags/page.tsx
import type { Metadata } from 'next';
import { staffAuthorize } from '@/lib/casl/staff-authorize';
import { getFeatureFlags } from '@/lib/queries/admin-feature-flags';
import { FeatureFlagTable } from '@/components/admin/feature-flag-table';

export const metadata: Metadata = { title: 'Feature Flags | Twicely Hub' };

export default async function FeatureFlagsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'FeatureFlag')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const flags = await getFeatureFlags();
  const canCreate = ability.can('create', 'FeatureFlag');
  const canDelete = ability.can('delete', 'FeatureFlag');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage feature rollouts, A/B tests, and kill switches.
          </p>
        </div>
        {/* Create button only for ADMIN */}
      </div>
      <FeatureFlagTable flags={flags} canCreate={canCreate} canDelete={canDelete} />
    </div>
  );
}
```

```typescript
// src/app/(hub)/audit/page.tsx
import type { Metadata } from 'next';
import { staffAuthorize } from '@/lib/casl/staff-authorize';
import { getAuditEvents } from '@/lib/queries/admin-audit-log';
import { auditLogQuerySchema } from '@/lib/queries/admin-audit-log-schemas';
import { AuditLogTable } from '@/components/admin/audit-log-table';
import { AuditLogFilters } from '@/components/admin/audit-log-filters';

export const metadata: Metadata = { title: 'Audit Log | Twicely Hub' };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'AuditEvent')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const rawParams = await searchParams;
  const parsed = auditLogQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : { page: 1, limit: 50 };

  const { events, totalCount } = await getAuditEvents(query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Immutable record of all platform actions.
        </p>
      </div>
      <AuditLogFilters currentFilters={query} />
      <AuditLogTable events={events} totalCount={totalCount} page={query.page} limit={query.limit} />
    </div>
  );
}
```

**Component implementation notes:**

`feature-flag-table.tsx`:
- Renders flags in a responsive table
- Toggle switch per row using a form with hidden input + server action
- After toggle: call `revalidatePath('/flags')` in the action so the page re-renders
- Type badges: BOOLEAN (green pill), PERCENTAGE (blue pill + percentage), TARGETED (purple pill)
- Kill switch flags (key starts with `kill.`): red left border or red badge
- Delete button shows confirmation dialog before calling `deleteFeatureFlagAction`

`feature-flag-form.tsx`:
- shadcn Dialog (or inline expandable section)
- Conditional fields: percentage slider shown only when type is PERCENTAGE, targeting JSON textarea shown only when type is TARGETED
- On create: redirects/revalidates on success
- On edit: pre-fills with existing flag data

`audit-log-table.tsx`:
- Paginated table with expandable rows
- Severity badges: LOW = `bg-gray-100 text-gray-800`, MEDIUM = `bg-blue-100 text-blue-800`, HIGH = `bg-yellow-100 text-yellow-800`, CRITICAL = `bg-red-100 text-red-800`
- Expandable detail: click row to show `detailsJson` as formatted JSON (`JSON.stringify(details, null, 2)` in a `<pre>` block)
- Pagination: "Page X of Y" with Previous/Next buttons, uses URL search params

`audit-log-filters.tsx`:
- Form that updates URL search params on submit
- Actor Type: `<select>` with options: All, STAFF, USER, SYSTEM
- Subject: `<select>` with known subjects from SUBJECTS constant
- Severity: `<select>` with options: All, LOW, MEDIUM, HIGH, CRITICAL
- Date range: two date inputs (start, end)
- "Apply Filters" button + "Clear" link
- Uses `useRouter().push()` to update URL with filter params

### Merge Verification

After all streams complete, verify:
1. `/flags` page loads, displays flags, toggle works, create works (ADMIN), delete works (ADMIN)
2. `/audit` page loads, displays events (including those created by flag actions), filters work, pagination works
3. `isFeatureEnabled()` returns correct values for all 3 flag types
4. All tests pass (`pnpm test`)
5. TypeScript compiles with zero errors (`pnpm typecheck`)
6. No files exceed 300 lines
7. No banned terms in any file

---

## 8. VERIFICATION CHECKLIST

After implementation, run these checks and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test count (must be >= 2117 baseline)
pnpm test

# 3. Banned terms check
./twicely-lint.sh

# 4. File size check (no files over 300 lines)
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20

# 5. Route check (no wrong routes)
grep -rn "\/admin\|\/dashboard\|\/feature-flags\|\/audit-log" src/app src/components src/lib --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."

# 6. New files created
find src -name "*feature-flag*" -o -name "*audit-log*" -o -name "*feature-flags*" | sort
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 2157 (2117 baseline + ~40 new)
- Banned terms: zero occurrences
- All new files under 300 lines
- No wrong route prefixes
- 16-17 new files listed

---

## 9. SPEC INCONSISTENCIES

### 9.1 Feature Lock-in Schema vs Actual Schema

The Feature Lock-in Section 38 shows a different schema than what exists in the codebase:

| Feature Lock-in (Section 38) | Actual Schema (`platform.ts`) |
|------------------------------|-------------------------------|
| `key: text('key').primaryKey()` | `id: text('id').primaryKey()`, `key: text('key').notNull().unique()` |
| `defaultValue: boolean` | Uses `enabled: boolean` instead |
| `percentageValue: integer` | Uses `percentage: integer` instead |
| `targetingRules: jsonb` | Uses `targetingJson: jsonb` instead |
| `isActive: boolean` | Not present -- uses `enabled` instead |
| `createdBy: uuid` referencing `users.id` | `createdByStaffId: text` (staff, not marketplace user) |
| Table name: `feature_flags` (plural) | Table name: `feature_flag` (singular) |

**Resolution:** Use the ACTUAL schema from `platform.ts` (which matches the schema canonical doc v2.0.8 Section 14.3). The Feature Lock-in schema is an older draft that was superseded by the canonical schema doc.

### 9.2 Admin UI Route

The Feature Lock-in Section 38 says `hub.twicely.co/cfg/flags` for the admin UI. But the Page Registry (page #120) says `/flags` directly (not under `/cfg`). The admin-nav.ts already has `href: '/flags'`.

**Resolution:** Use `/flags` as specified in the Page Registry and admin-nav.ts. The Feature Lock-in reference to `/cfg/flags` is stale.

### 9.3 DEVELOPER Create Permission

The Actors Canonical Section 3.5 agent permissions matrix shows DEVELOPER can only "Toggle feature flag" but the CASL code in `platform-abilities.ts` gives DEVELOPER `can('read', 'FeatureFlag')` and `can('update', 'FeatureFlag')` -- no `create` or `delete`. The permission-registry-data.ts lists all four CRUD actions for FeatureFlag but that's the available action set, not what each role gets.

**Resolution:** DEVELOPER gets read + update only (matches both canonical and code). ADMIN gets full CRUD via `manage all`. This is already correctly implemented in CASL.

---

## 10. NOTES FOR INSTALLER

1. **Reuse existing patterns.** Follow `admin-settings.ts` + `admin-settings.test.ts` as the primary reference for action and test structure.

2. **`revalidatePath` after mutations.** Call `revalidatePath('/flags')` at the end of every feature flag action so the page re-renders with fresh data.

3. **Do NOT implement Valkey caching.** The spec mentions 30-second Valkey TTL for flag reads. This is a future optimization. For E4, read directly from PostgreSQL. The `featureFlags.cacheSeconds` platform setting is seeded for future use.

4. **Do NOT build client-side React Context for flags.** The spec mentions "Client-side: flags fetched on page load via API, cached in React context." This is deferred. For now, use server-side `isFeatureEnabled()` only.

5. **Audit events are INSERT-ONLY.** The audit log page must have NO edit, delete, or status change controls. The CASL rule `cannot('delete', 'AuditEvent')` is already enforced for all roles including ADMIN.

6. **`searchParams` in Next.js 15 is a Promise.** When using `searchParams` in the audit log page, await it: `const rawParams = await searchParams;`

7. **Percentage hashing must be deterministic.** The `hashToBucket()` function must produce the same output for the same `(userId, flagKey)` pair every time. Use a pure mathematical hash, not `Math.random()` or `crypto.randomUUID()`.

8. **Flag key validation.** Keys must be dotted lowercase: `feature.newCheckout`, `rollout.newSearch`, `kill.payments`. The regex enforces 1-3 dot-separated segments of lowercase alphanumeric characters. The first character of each segment must be a letter.

---

**END OF INSTALL PROMPT -- E4-feature-flags.md**
