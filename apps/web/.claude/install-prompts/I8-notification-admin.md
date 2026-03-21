# I8 — Notification Admin

**Phase & Step:** `[I8]`
**Feature Name:** Notification Admin — Template Management Hub
**One-line Summary:** Enrich the `/notifications` stub page into a full CRUD admin for notification templates, plus add `/notifications/[id]` (edit) and `/notifications/new` (create) pages.

**Canonical Sources (read ALL before starting):**
- `TWICELY_V3_SCHEMA_v2_1_0.md` — Section 10.4 (notificationTemplate table)
- `TWICELY_V3_PAGE_REGISTRY.md` — Row 124 (`/notifications`)
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — Section 27 (Notification Preferences, Admin Settings)
- `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — Section 3.5-3.6 (platform staff abilities, Notification subject)
- `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` — Section 12 (Communications / `comms.*` keys)
- `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` — I8 row

---

## 1. PREREQUISITES

| Prerequisite | Status |
|---|---|
| Phase E1 (Messaging & Notifications schema) | COMPLETE |
| `notificationTemplate` table in `src/lib/db/schema/notifications.ts` | EXISTS — already defined and exported |
| `notification_template` seed data in `src/lib/db/seed/seed-notifications.ts` | EXISTS — 19 templates seeded |
| `Notification` CASL subject in `src/lib/casl/subjects.ts` | EXISTS — line 17 |
| `Notification` in permission registry | EXISTS — `src/lib/casl/permission-registry-data.ts` lines 229-238 (read, create, update, delete) |
| ADMIN abilities via `definePlatformAdminAbilities` | EXISTS — `can('manage', 'all')` covers Notification |
| Nav entry in sidebar | EXISTS — `admin-nav.ts` line 160-165, key `notifications`, href `/notifications`, roles `['ADMIN']` |
| Existing stub at `/notifications/page.tsx` | EXISTS — shows template count only |

**No new npm packages required.** All dependencies (Drizzle, Zod, CASL, lucide-react, shadcn/ui) are already installed.

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

### 2.1 Database

**No new tables or columns needed.** The `notificationTemplate` table already exists with these columns:

```typescript
// From src/lib/db/schema/notifications.ts (§10.4)
notificationTemplate = pgTable('notification_template', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  key:             text('key').notNull().unique(),       // e.g. 'order.confirmed'
  name:            text('name').notNull(),                // e.g. 'Order Confirmed'
  description:     text('description'),                   // nullable
  category:        text('category').notNull(),            // 'order', 'listing', 'offer', 'account', 'marketing'
  subjectTemplate: text('subject_template'),              // nullable, email subject with {{var}} placeholders
  bodyTemplate:    text('body_template').notNull(),       // body text with {{var}} placeholders
  htmlTemplate:    text('html_template'),                 // nullable, HTML email version
  channels:        text('channels').array().notNull().default(sql`'{}'::text[]`),  // ['EMAIL','IN_APP','PUSH','SMS']
  isSystemOnly:    boolean('is_system_only').notNull().default(false),  // true = user cannot disable
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Valid channel values: `'EMAIL'`, `'PUSH'`, `'IN_APP'`, `'SMS'` (from `notificationChannelEnum`).

Valid categories (derived from seed data): `'offers'`, `'orders'`, `'watchlist'`, `'search'`, `'subscription'`, `'returns'`, `'disputes'`, `'protection'`, `'shipping'`. The category field is a free-form text, not an enum — the installer should allow any text category, but the UI should show a filter based on distinct categories found in the database.

### 2.2 Zod Validation Schemas

Create `src/lib/validations/notification-templates.ts`:

```typescript
// createNotificationTemplateSchema
{
  key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_.]*$/, 'Key must be lowercase dot-separated identifier'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().min(1).max(100),
  subjectTemplate: z.string().max(1000).nullable().optional(),
  bodyTemplate: z.string().min(1).max(10000),
  htmlTemplate: z.string().max(50000).nullable().optional(),
  channels: z.array(z.enum(['EMAIL', 'PUSH', 'IN_APP', 'SMS'])).min(1),
  isSystemOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
}.strict()

// updateNotificationTemplateSchema
{
  templateId: z.string().cuid2(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().min(1).max(100).optional(),
  subjectTemplate: z.string().max(1000).nullable().optional(),
  bodyTemplate: z.string().min(1).max(10000).optional(),
  htmlTemplate: z.string().max(50000).nullable().optional(),
  channels: z.array(z.enum(['EMAIL', 'PUSH', 'IN_APP', 'SMS'])).min(1).optional(),
  isSystemOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
}.strict()
// NOTE: `key` is NOT updatable once created (template key is a stable identifier used by code).

// deleteNotificationTemplateSchema
{
  templateId: z.string().cuid2(),
}.strict()
```

### 2.3 Server Actions

Create `src/lib/actions/admin-notifications.ts` (`'use server'`):

**Actions to implement:**

1. **`createNotificationTemplateAction(input: unknown)`**
   - `staffAuthorize()` + `ability.can('create', 'Notification')` check
   - Parse with `createNotificationTemplateSchema`
   - Check key uniqueness (query `notificationTemplate` where `key = input.key`)
   - Insert with explicit field mapping (never spread)
   - Write `auditEvent` with `action: 'CREATE_NOTIFICATION_TEMPLATE'`, `subject: 'Notification'`, `severity: 'MEDIUM'`
   - `revalidatePath('/notifications')`
   - Return `{ success: true, templateId: id }`

2. **`updateNotificationTemplateAction(input: unknown)`**
   - `staffAuthorize()` + `ability.can('update', 'Notification')` check
   - Parse with `updateNotificationTemplateSchema`
   - Verify template exists (select by `templateId`)
   - Build explicit update fields (never spread input into `.set()`)
   - Always set `updatedAt: new Date()`
   - Write `auditEvent` with `action: 'UPDATE_NOTIFICATION_TEMPLATE'`, `subject: 'Notification'`, `severity: 'MEDIUM'`
   - `revalidatePath('/notifications')` + `revalidatePath('/notifications/' + templateId)`
   - Return `{ success: true }`

3. **`deleteNotificationTemplateAction(input: unknown)`**
   - `staffAuthorize()` + `ability.can('delete', 'Notification')` check
   - Parse with `deleteNotificationTemplateSchema`
   - Verify template exists
   - **Guard**: if `isSystemOnly === true`, return `{ error: 'Cannot delete system-only template' }` — system templates cannot be deleted
   - Delete the row
   - Write `auditEvent` with `action: 'DELETE_NOTIFICATION_TEMPLATE'`, `subject: 'Notification'`, `severity: 'HIGH'`
   - `revalidatePath('/notifications')`
   - Return `{ success: true }`

4. **`toggleNotificationTemplateAction(input: unknown)`**
   - Convenience action for toggling `isActive`
   - Schema: `{ templateId: z.string().cuid2(), isActive: z.boolean() }.strict()`
   - `staffAuthorize()` + `ability.can('update', 'Notification')` check
   - Update `isActive` + `updatedAt`
   - Write `auditEvent` with `action: 'TOGGLE_NOTIFICATION_TEMPLATE'`, `subject: 'Notification'`, `severity: 'MEDIUM'`, `detailsJson: { isActive }`
   - `revalidatePath('/notifications')`
   - Return `{ success: true }`

**Pattern to follow:** See `src/lib/actions/admin-curated-collections.ts` for the exact staffAuthorize + Zod parse + DB op + audit + revalidate pattern.

**Critical: Keep all helper functions unexported.** Only the four action functions should be `export`ed. Exported helpers in `'use server'` files become unintended server actions.

### 2.4 Queries

Create `src/lib/queries/admin-notifications.ts`:

1. **`getAdminNotificationTemplates(filter?: { category?: string; isActive?: boolean })`**
   - Returns all templates ordered by `category ASC, name ASC`
   - Optional filter by category and isActive
   - Return type: `AdminNotificationTemplateRow[]`

   ```typescript
   type AdminNotificationTemplateRow = {
     id: string;
     key: string;
     name: string;
     description: string | null;
     category: string;
     channels: string[];
     isSystemOnly: boolean;
     isActive: boolean;
     createdAt: Date;
     updatedAt: Date;
   };
   ```

2. **`getAdminNotificationTemplateById(id: string)`**
   - Returns single template with ALL fields (including bodyTemplate, subjectTemplate, htmlTemplate)
   - Return type: `AdminNotificationTemplateDetail | null`

   ```typescript
   type AdminNotificationTemplateDetail = {
     id: string;
     key: string;
     name: string;
     description: string | null;
     category: string;
     subjectTemplate: string | null;
     bodyTemplate: string;
     htmlTemplate: string | null;
     channels: string[];
     isSystemOnly: boolean;
     isActive: boolean;
     createdAt: Date;
     updatedAt: Date;
   };
   ```

3. **`getNotificationCategories()`**
   - Returns distinct categories from `notificationTemplate` table
   - For the filter dropdown
   - Return type: `string[]`

### 2.5 Pages

#### 2.5.1 ENRICH: `src/app/(hub)/notifications/page.tsx`

Replace the current stub with a full template list page. Pattern: follow `src/app/(hub)/kb/page.tsx`.

**Layout:**
- Page header: "Notification Templates" with subtitle "Manage notification templates and channel defaults."
- Top-right: "New Template" button linking to `/notifications/new` (blue, with Plus icon)
- Filter bar: category dropdown (populated from `getNotificationCategories()`), active/inactive toggle
- Stats summary: total templates count, active count, inactive count
- Table with columns:
  - **Name** (linked to `/notifications/{id}`) — also show `key` in smaller gray text below
  - **Category** — pill badge
  - **Channels** — show channel badges (EMAIL, PUSH, IN_APP, SMS)
  - **System** — lock icon if `isSystemOnly`
  - **Status** — green "Active" / gray "Inactive" badge
  - **Updated** — formatted date
  - **Actions** — toggle active/inactive button, edit link
- Empty state: icon + "No templates yet" + "Create your first notification template."
- Role gate: `ability.can('read', 'Notification')` — return access denied if false

#### 2.5.2 CREATE: `src/app/(hub)/notifications/new/page.tsx`

New template creation page. Pattern: follow `src/app/(hub)/kb/new/page.tsx`.

**Layout:**
- Back link: "Back to Notification Templates" -> `/notifications`
- Page header: "New Template"
- Render `NotificationTemplateEditor` component (no initialData)
- Role gate: `ability.can('create', 'Notification')` — return access denied if false

#### 2.5.3 EDIT: `src/app/(hub)/notifications/[id]/page.tsx`

Template detail/edit page. Pattern: follow `src/app/(hub)/kb/[id]/edit/page.tsx`.

**Layout:**
- Back link: "Back to Notification Templates" -> `/notifications`
- Page header: "Edit Template" with key displayed as subtitle
- Render `NotificationTemplateEditor` component with initialData from `getAdminNotificationTemplateById`
- If template not found: call `notFound()`
- Role gate: `ability.can('read', 'Notification')` — return access denied if false

### 2.6 Client Components

#### 2.6.1 `src/components/admin/notification-template-editor.tsx`

`'use client'` component used by both new and edit pages.

**Props:**
```typescript
interface NotificationTemplateEditorProps {
  initialData?: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    category: string;
    subjectTemplate: string | null;
    bodyTemplate: string;
    htmlTemplate: string | null;
    channels: string[];
    isSystemOnly: boolean;
    isActive: boolean;
  };
}
```

**Form fields:**
- **Key** (text input) — only editable on create; read-only on edit (shown as gray disabled input). Regex-validated: lowercase dot-separated identifiers (e.g., `order.confirmed`).
- **Name** (text input, required)
- **Description** (textarea, optional)
- **Category** (text input, required — free text, with datalist of existing categories if available)
- **Subject Template** (text input, optional) — with hint "Use {{variableName}} for dynamic content"
- **Body Template** (textarea, required, multiline) — with hint about placeholder syntax
- **HTML Template** (textarea, optional, multiline) — collapsed by default, expand toggle "Show HTML template"
- **Channels** (checkbox group: EMAIL, PUSH, IN_APP, SMS) — at least one required
- **System Only** (checkbox) — "Prevent users from disabling this notification"
- **Active** (checkbox)

**Submit behavior:**
- Create mode: calls `createNotificationTemplateAction`, on success redirects to `/notifications`
- Edit mode: calls `updateNotificationTemplateAction`, on success shows success toast or redirects
- Show inline error messages from action return
- Disable submit while pending (`useTransition`)

**Delete button (edit mode only, not for system-only templates):**
- Red "Delete Template" button at bottom
- Confirmation dialog: "Are you sure you want to delete this template? This cannot be undone."
- Calls `deleteNotificationTemplateAction`, on success redirects to `/notifications`

#### 2.6.2 `src/components/admin/notification-template-toggle.tsx`

Small `'use client'` component for the active/inactive toggle in the list table.

**Props:** `{ templateId: string; isActive: boolean }`
**Behavior:** Calls `toggleNotificationTemplateAction` on click, optimistic UI update.

### 2.7 CASL Rules

**No CASL changes needed.** The existing rules already cover this feature:

- `ADMIN` / `SUPER_ADMIN`: `can('manage', 'all')` in `definePlatformAdminAbilities` (line 158 of `platform-abilities.ts`)
- `Notification` subject already exists in subjects.ts
- Permission registry already defines `read`, `create`, `update`, `delete` actions on `Notification`
- The current stub page already checks `ability.can('read', 'Notification')` — maintain this pattern

**DEVELOPER role:** The Page Registry (row 124) says `ADMIN` only. The admin-nav.ts also uses `roles: ['ADMIN']`. Do NOT add DEVELOPER access. Only ADMIN and SUPER_ADMIN can manage notification templates.

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- Do NOT use `wallet`, `withdraw`, `balance`, `FVF`, or any term from the CLAUDE.md banned list in any UI copy or comments.

### Tech Stack
- Do NOT use Prisma, NextAuth, Redis, tRPC, or any banned technology.
- Use `import { db } from '@/lib/db'` for all database access (Drizzle).
- Use Zod for all input validation.

### Code Patterns
- Do NOT use `as any`, `@ts-ignore`, `@ts-expect-error`.
- Do NOT spread request body into DB updates — use explicit field mapping.
- Do NOT export helper functions from `'use server'` files.
- Max 300 lines per file. If the editor component approaches 300 lines, split the form sections into sub-components.
- No `console.log` in production code.

### Business Logic
- Template `key` is immutable after creation (code references templates by key).
- System-only templates (`isSystemOnly: true`) cannot be deleted. They CAN be deactivated.
- The `channels` array must contain at least one value.
- Valid channel values are ONLY: `'EMAIL'`, `'PUSH'`, `'IN_APP'`, `'SMS'`.
- The `key` must be unique (enforced at both validation and DB level).

### Route Enforcement
- All routes use `/notifications` prefix (NOT `/cfg/notifications`, NOT `/admin/notifications`).
- This is a hub route at `hub.twicely.co/notifications`.

### What NOT to Build
- Do NOT build a notification sending/preview feature (that is a future concern).
- Do NOT build user-facing notification preference management (that exists at `/my/settings/notifications`).
- Do NOT modify the `notification`, `notificationPreference`, or `notificationSetting` tables.
- Do NOT modify the existing seed data or seed file.
- Do NOT add new platform settings — the comms settings already exist in `v32-platform-settings-extended.ts`.
- Do NOT modify `admin-nav.ts` — the nav entry already exists.
- Do NOT modify any CASL files — existing abilities already cover this.

---

## 4. ACCEPTANCE CRITERIA

### Functional
1. `/notifications` page loads and shows ALL notification templates in a table with Name, Category, Channels, System badge, Active status, Updated date.
2. `/notifications` page has a "New Template" link/button that navigates to `/notifications/new`.
3. Clicking a template name in the table navigates to `/notifications/{id}`.
4. `/notifications/new` renders a form with all fields listed in Section 2.6.1.
5. Creating a template with valid data succeeds and redirects to `/notifications`.
6. Creating a template with a duplicate `key` returns an error.
7. Creating a template with empty `channels` array returns an error.
8. `/notifications/[id]` loads the template data and pre-fills the form.
9. The `key` field is read-only on the edit page.
10. Updating a template works for any subset of updatable fields.
11. Deleting a non-system-only template works and redirects to `/notifications`.
12. Deleting a system-only template returns an error "Cannot delete system-only template".
13. The toggle button on the list page toggles `isActive` immediately.
14. The category filter on the list page filters the table.

### Authorization
15. Unauthenticated users (no staff session) get `ForbiddenError` (thrown by `staffAuthorize`).
16. Non-ADMIN staff (e.g., HELPDESK_AGENT, MODERATION, FINANCE) see "Access denied" on all three pages.
17. ADMIN and SUPER_ADMIN can access all three pages and perform all CRUD operations.

### Data Integrity
18. All four actions write audit events with correct `actorType: 'STAFF'`, `actorId`, `action`, `subject: 'Notification'`, `subjectId`.
19. The `updatedAt` field is set to current time on every update.
20. Template `key` has unique constraint — attempting a duplicate `key` at DB level also fails gracefully.
21. `channels` array only contains valid values (`EMAIL`, `PUSH`, `IN_APP`, `SMS`).

### Vocabulary & UX
22. Page title includes "Notification Templates" (not "Notification Admin" or "Notifications Manager").
23. No banned terms appear anywhere in UI copy, variable names, or comments.
24. All routes use `/notifications` prefix, no `/admin`, no `/cfg/notifications`.

---

## 5. TEST REQUIREMENTS

### Test File: `src/lib/actions/__tests__/admin-notifications.test.ts`

Test the four server actions. Follow the exact pattern in `src/lib/actions/__tests__/admin-curated-collections.test.ts`:

**Mock setup:**
- `vi.mock('@/lib/casl/staff-authorize')` — mockStaffAuthorize
- `vi.mock('@/lib/db')` — mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete
- `vi.mock('drizzle-orm')` — eq, and
- `vi.mock('@/lib/db/schema')` — notificationTemplate, auditEvent stubs
- `vi.mock('next/cache')` — revalidatePath
- Helper functions: `makeSelectChain`, `makeInsertChain`, `makeUpdateChain`, `makeDeleteChain`, `mockCanManage`, `mockForbidden`

**Tests for `createNotificationTemplateAction`:**
1. Returns `Forbidden` when CASL denies create on Notification
2. Returns `Invalid input` for missing required fields (key, name, bodyTemplate, channels)
3. Returns `Invalid input` for key with invalid format (uppercase, spaces)
4. Returns `Invalid input` for empty channels array
5. Rejects extra fields via strict schema
6. Returns error when key already exists (duplicate check)
7. Inserts template with correct explicit fields on valid input
8. Writes audit event on successful create
9. Calls revalidatePath('/notifications')
10. Returns success with templateId

**Tests for `updateNotificationTemplateAction`:**
11. Returns `Forbidden` when CASL denies update
12. Returns `Not found` when templateId doesn't exist
13. Returns `Invalid input` for missing templateId
14. Updates only provided fields (partial update)
15. Always sets updatedAt
16. Writes audit event on successful update
17. Calls revalidatePath for both list and detail pages

**Tests for `deleteNotificationTemplateAction`:**
18. Returns `Forbidden` when CASL denies delete
19. Returns `Not found` when templateId doesn't exist
20. Returns error when template is system-only
21. Deletes template and writes HIGH severity audit event
22. Calls revalidatePath('/notifications')

**Tests for `toggleNotificationTemplateAction`:**
23. Returns `Forbidden` when CASL denies update
24. Toggles isActive and writes audit event
25. Includes isActive value in audit detailsJson

### Test File: `src/lib/queries/__tests__/admin-notifications.test.ts`

**Tests for query functions:**
26. `getAdminNotificationTemplates` returns all templates ordered by category, name
27. `getAdminNotificationTemplates` filters by category when provided
28. `getAdminNotificationTemplates` filters by isActive when provided
29. `getAdminNotificationTemplateById` returns template with all fields
30. `getAdminNotificationTemplateById` returns null for non-existent ID
31. `getNotificationCategories` returns distinct category values

### Test File: `src/lib/validations/__tests__/notification-templates.test.ts`

**Tests for Zod schemas:**
32. `createNotificationTemplateSchema` accepts valid input
33. `createNotificationTemplateSchema` rejects missing key
34. `createNotificationTemplateSchema` rejects invalid key format (uppercase, spaces, starting with number)
35. `createNotificationTemplateSchema` rejects empty channels array
36. `createNotificationTemplateSchema` rejects invalid channel values
37. `createNotificationTemplateSchema` rejects unknown fields (strict mode)
38. `updateNotificationTemplateSchema` accepts partial update (only name)
39. `updateNotificationTemplateSchema` requires templateId
40. `updateNotificationTemplateSchema` rejects unknown fields
41. `deleteNotificationTemplateSchema` requires templateId as cuid2

**Target: ~41 tests minimum.**

---

## 6. FILE APPROVAL LIST

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/lib/validations/notification-templates.ts` | CREATE | Zod schemas for create, update, delete, toggle actions |
| 2 | `src/lib/queries/admin-notifications.ts` | CREATE | Query functions: getTemplates, getTemplateById, getCategories |
| 3 | `src/lib/actions/admin-notifications.ts` | CREATE | Server actions: create, update, delete, toggle template |
| 4 | `src/app/(hub)/notifications/page.tsx` | MODIFY | Enrich stub into full template list with table, filters, stats |
| 5 | `src/app/(hub)/notifications/new/page.tsx` | CREATE | New template creation page with editor component |
| 6 | `src/app/(hub)/notifications/[id]/page.tsx` | CREATE | Template detail/edit page with editor component |
| 7 | `src/components/admin/notification-template-editor.tsx` | CREATE | Client component: template form (create/edit modes) |
| 8 | `src/components/admin/notification-template-toggle.tsx` | CREATE | Client component: active/inactive toggle for list |
| 9 | `src/lib/validations/__tests__/notification-templates.test.ts` | CREATE | Zod schema validation tests (~10 tests) |
| 10 | `src/lib/actions/__tests__/admin-notifications.test.ts` | CREATE | Server action tests (~25 tests) |
| 11 | `src/lib/queries/__tests__/admin-notifications.test.ts` | CREATE | Query function tests (~6 tests) |

**Total: 8 new files, 1 modified file, 3 test files.**

---

## 7. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Run the unified lint script
./twicely-lint.sh

# 4. Verify test count >= BASELINE_TESTS (8603)
# The test output summary line should show >= 8603 tests passing

# 5. Verify no new banned terms in created/modified files
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|STANDARD\|RISING\|Twicely Balance\|wallet\|Withdraw\|FinanceTier" \
  src/lib/validations/notification-templates.ts \
  src/lib/queries/admin-notifications.ts \
  src/lib/actions/admin-notifications.ts \
  src/app/\(hub\)/notifications/ \
  src/components/admin/notification-template-editor.tsx \
  src/components/admin/notification-template-toggle.tsx

# 6. Verify file sizes under 300 lines
wc -l src/lib/validations/notification-templates.ts \
  src/lib/queries/admin-notifications.ts \
  src/lib/actions/admin-notifications.ts \
  src/app/\(hub\)/notifications/page.tsx \
  src/app/\(hub\)/notifications/new/page.tsx \
  src/app/\(hub\)/notifications/\[id\]/page.tsx \
  src/components/admin/notification-template-editor.tsx \
  src/components/admin/notification-template-toggle.tsx

# 7. Verify routes use correct prefix
grep -rn "/admin/notification\|/cfg/notifications\|/l/\|/listing/" \
  src/app/\(hub\)/notifications/ \
  src/components/admin/notification-template-editor.tsx
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 8603 passing (baseline) + ~41 new = ~8644+
- Banned terms: 0 matches
- All files under 300 lines
- Wrong routes: 0 matches

---

## 8. NOTES & SPEC GAPS

### Spec Inconsistency: `notifications.*` vs `comms.*` keys
The Feature Lock-in Section 27 uses `notifications.emailEnabled`, `notifications.pushEnabled`, etc. as setting keys. The Platform Settings Canonical Section 12 uses `comms.email.enabled`, `comms.push.enabled`, etc. The seed data uses `email.enabled`, `push.enabled`, `sms.enabled` (without the `comms.` prefix in the key, but `category: 'comms'`). **This is a known inconsistency documented in agent memory.** The I8 feature does NOT need to read or modify platform settings — it only manages notification templates. No action needed from the installer on this.

### Template Category Values
The schema defines `category` as free-form text, not an enum. The seed data uses: `offers`, `orders`, `watchlist`, `search`, `subscription`, `returns`, `disputes`, `protection`, `shipping`. The installer should allow any category string in the create/update schemas. The UI filter should populate dynamically from `getNotificationCategories()`.

### Page Registry Gap
The Page Registry (row 124) only lists `/notifications`. The `/notifications/[id]` and `/notifications/new` sub-pages are specified in the Build Sequence Tracker I8 row but not individually listed in the Page Registry. This is a documentation gap consistent with other features (e.g., KB pages `/kb/[id]/edit` and `/kb/new` are also not individually listed). The installer should proceed with all three pages.

### DEVELOPER Role Access
The Actors & Security canonical says Notification subject has `view, create, edit, delete` actions and lists it under the staff permission matrix. However, the existing admin-nav.ts restricts the `/notifications` nav item to `['ADMIN']` only. The permission-registry-data.ts includes it in the CONTENT category (not DEVELOPER). **The installer should follow the existing code pattern: ADMIN-only access.** If custom roles grant Notification permissions to non-ADMIN staff, the pages will still work for them because the CASL check is on the `Notification` subject, not on a role string.
