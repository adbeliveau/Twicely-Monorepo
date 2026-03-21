# Install Prompt: A4 — Staff Roles Management

**Phase & Step:** `[A4]`
**Feature Name:** Staff Roles Management (Hub /roles area)
**One-line Summary:** Build the hub pages and server logic for managing platform staff users and their system/custom roles at `hub.twicely.co/roles`.
**Date:** 2026-03-04

## Canonical Sources

Read ALL of these before writing any code:

| Document | Why |
|----------|-----|
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` Sections 1.1, 3.5, 3.6, 4.3 | Actor definitions, Platform Agent/Admin permissions, Custom Roles architecture, guardrails, UI behavior |
| `TWICELY_V3_PAGE_REGISTRY.md` Entries #115, #116 | Route definitions for `/roles` and `/roles/staff/[id]` |
| `TWICELY_V3_SCHEMA_v2_0_7.md` Sections 2.6-2.8, 14.4, 14.6-14.7 | `staffUser`, `staffUserRole`, `staffSession`, `auditEvent`, `customRole`, `staffUserCustomRole` tables |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` Section 10.3 | Hub sidebar, `/roles` entry |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns, coverage requirements |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` Line ~840 | `/roles` and `/roles/new` route mentions |
| `CLAUDE.md` | All code rules, banned terms, tech stack |

## Prerequisites

| Requirement | Status |
|-------------|--------|
| Phase A1-A3 (scaffold, schema, auth) | DONE |
| E3 Admin Hub (staff auth, hub layout, sidebar, staffAuthorize) | DONE |
| `staffUser`, `staffUserRole`, `staffSession` tables | EXIST in `src/lib/db/schema/staff.ts` |
| `customRole`, `staffUserCustomRole` tables | EXIST in `src/lib/db/schema/platform.ts` |
| `auditEvent` table | EXISTS in `src/lib/db/schema/platform.ts` |
| `platformRoleEnum` (10 values) | EXISTS in `src/lib/db/schema/enums.ts` |
| `staffAuthorize()` helper | EXISTS in `src/lib/casl/staff-authorize.ts` |
| `loginStaff()` / `getStaffSession()` / `logoutStaff()` | EXIST in `src/lib/auth/staff-auth.ts` |
| Admin nav with `/roles` entry | EXISTS in `src/lib/hub/admin-nav.ts` (roles: `['ADMIN']`) |
| Seed admin user `admin@hub.twicely.co` with `SUPER_ADMIN` | EXISTS in `src/lib/db/seed/seed-system.ts` |
| `AdminPageHeader` component | EXISTS in `src/components/admin/admin-page-header.tsx` |
| `definePlatformAdminAbilities()` (can manage all) | EXISTS in `src/lib/casl/platform-abilities.ts` |

## Scope -- Exactly What To Build

This install prompt covers THREE functional areas:

1. **Staff user management** (CRUD on `staffUser` table + system role assignments via `staffUserRole`)
2. **Custom role management** (CRUD on `customRole` + assignment via `staffUserCustomRole`) -- SUPER_ADMIN only
3. **Hub pages** at `/roles`, `/roles/staff/[id]`, `/roles/staff/new`

### Area 1: CASL Subjects (Prerequisite Update)

Add two new subjects to the CASL subjects list:

**File:** `src/lib/casl/subjects.ts`

Add `'StaffUser'` and `'CustomRole'` to the `SUBJECTS` array. These are referenced in the Actors Canonical Section 4.3.3:
- `cannot('manage', 'CustomRole')` -- Only SUPER_ADMIN via system role
- `cannot('manage', 'StaffUser')` -- Only ADMIN+ via system role

**File:** `src/lib/casl/platform-abilities.ts`

`definePlatformAdminAbilities` already grants `can('manage', 'all')` which covers StaffUser and CustomRole. No changes needed there.

However, add explicit rules in `definePlatformAgentAbilities` so that NON-admin staff do NOT get StaffUser/CustomRole access (this is already covered by default-deny, but the hard ceilings from Section 4.3.3 should be explicit):

```typescript
// At the end of definePlatformAgentAbilities, after all role blocks:
// Hard ceilings -- agents can NEVER manage staff or roles
cannot('manage', 'StaffUser');
cannot('manage', 'CustomRole');
```

Wait -- `definePlatformAgentAbilities` currently does not use `cannot`. The function signature only destructures `can`. You need to also destructure `cannot` from the builder. But since default-deny already blocks these subjects, this is OPTIONAL. If you add it, it is for documentation clarity. If the builder pattern makes it awkward, skip it -- default-deny is sufficient.

### Area 2: Database (All Tables Already Exist)

All tables are already defined in the schema. Here is what each table contains for reference:

**`staffUser`** (src/lib/db/schema/staff.ts):
- `id` text PK (CUID2)
- `email` text NOT NULL UNIQUE
- `displayName` text NOT NULL
- `passwordHash` text NOT NULL
- `mfaEnabled` boolean NOT NULL default false
- `mfaSecret` text nullable
- `recoveryCodes` text nullable
- `isActive` boolean NOT NULL default true
- `lastLoginAt` timestamp nullable
- `createdAt` timestamp NOT NULL defaultNow
- `updatedAt` timestamp NOT NULL defaultNow

**`staffUserRole`** (src/lib/db/schema/staff.ts):
- `id` text PK (CUID2)
- `staffUserId` text NOT NULL FK -> staffUser.id (cascade)
- `role` platformRoleEnum NOT NULL
- `grantedByStaffId` text NOT NULL
- `grantedAt` timestamp NOT NULL defaultNow
- `revokedAt` timestamp nullable (null = active; non-null = revoked)

**`customRole`** (src/lib/db/schema/platform.ts):
- `id` text PK (CUID2)
- `name` text NOT NULL UNIQUE
- `code` text NOT NULL UNIQUE
- `description` text nullable
- `permissionsJson` jsonb NOT NULL default '[]'
- `isActive` boolean NOT NULL default true
- `createdByStaffId` text NOT NULL
- `updatedByStaffId` text nullable
- `createdAt` timestamp NOT NULL defaultNow
- `updatedAt` timestamp NOT NULL defaultNow

**`staffUserCustomRole`** (src/lib/db/schema/platform.ts):
- `id` text PK (CUID2)
- `staffUserId` text NOT NULL FK -> staffUser.id (cascade)
- `customRoleId` text NOT NULL FK -> customRole.id (cascade)
- `grantedByStaffId` text NOT NULL
- `grantedAt` timestamp NOT NULL defaultNow
- `revokedAt` timestamp nullable
- UNIQUE on (staffUserId, customRoleId)

**`auditEvent`** (src/lib/db/schema/platform.ts):
- `id` text PK
- `actorType` text NOT NULL (use 'STAFF')
- `actorId` text (staffUserId of the actor)
- `action` text NOT NULL
- `subject` text NOT NULL
- `subjectId` text
- `severity` auditSeverityEnum NOT NULL default 'LOW'
- `detailsJson` jsonb NOT NULL default '{}'
- `ipAddress` text nullable
- `userAgent` text nullable
- `createdAt` timestamp NOT NULL defaultNow

### Area 3: Queries

**File:** `src/lib/queries/admin-staff.ts`

Follow the pattern from `src/lib/queries/admin-users.ts`.

**`getStaffList(opts: { page: number; pageSize: number; search?: string; activeOnly?: boolean })`**
- SELECT from `staffUser` with optional search (ilike on email, displayName)
- Optional filter: `isActive = true` when activeOnly is set
- For each staff user, also load their active roles from `staffUserRole` WHERE `revokedAt IS NULL`
- Return: `{ staff: StaffListItem[]; total: number }`
- `StaffListItem`: `{ id, email, displayName, isActive, lastLoginAt, createdAt, roles: PlatformRole[] }`
- ORDER BY `createdAt DESC`

**`getStaffById(staffUserId: string)`**
- SELECT from `staffUser` WHERE id = staffUserId
- Also load: all `staffUserRole` rows (active AND revoked) for audit trail
- Also load: all `staffUserCustomRole` rows joined with `customRole` for name/code
- Return shape:

```typescript
interface StaffDetail {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  systemRoles: Array<{
    id: string;
    role: PlatformRole;
    grantedByStaffId: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }>;
  customRoles: Array<{
    id: string;
    customRoleId: string;
    customRoleName: string;
    customRoleCode: string;
    grantedByStaffId: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }>;
}
```

**`getCustomRoleList()`**
- SELECT all from `customRole` WHERE isActive = true
- ORDER BY name ASC
- Return: `CustomRoleListItem[]`

**`getCustomRoleById(customRoleId: string)`**
- SELECT from `customRole` WHERE id = customRoleId
- Also load: count of staff users assigned (active, revokedAt IS NULL)
- Also load: list of assigned staff users (id, email, displayName)
- Return shape matching the customRole columns plus `assignedStaff` array

### Area 4: Server Actions

**File:** `src/lib/actions/admin-staff.ts`

Mark the file with `'use server';` at the top. Follow the pattern from `src/lib/actions/admin-users.ts`:
- Every action calls `staffAuthorize()` first
- Every action validates input with Zod `.strict()`
- Every action creates an `auditEvent` on success
- Every action returns `{ success: true }` or `{ error: string }`
- Input is typed as `unknown` and parsed with safeParse
- Explicit field mapping -- NEVER spread request body

**Actions to implement:**

#### 4a. `createStaffUserAction(input: unknown)`

CASL check: `ability.can('manage', 'StaffUser')` -- this means ADMIN or SUPER_ADMIN only (they have `manage all`).

Zod schema:
```typescript
const createStaffUserSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100),
  password: z.string().min(10).max(128),
  roles: z.array(z.enum([
    'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
    'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN'
  ])).min(1).max(10),
}).strict();
```

Business rules:
- **ADMIN cannot grant ADMIN or SUPER_ADMIN roles.** Only SUPER_ADMIN can grant ADMIN. Only SUPER_ADMIN can grant SUPER_ADMIN. Check: if the calling staff's roles do NOT include 'SUPER_ADMIN', and the requested roles include 'ADMIN' or 'SUPER_ADMIN', return `{ error: 'Only SUPER_ADMIN can grant ADMIN roles' }`.
- Hash the password with bcryptjs (use `hash` from 'bcryptjs', cost factor 10 -- matching the pattern in `src/lib/auth/staff-auth.ts`).
- Check for duplicate email first: SELECT from staffUser WHERE email = input.email. If exists, return `{ error: 'Email already in use' }`.
- INSERT into `staffUser` with explicit field mapping.
- INSERT into `staffUserRole` one row per role, with `grantedByStaffId = session.staffUserId`.
- INSERT `auditEvent` with: actorType='STAFF', actorId=session.staffUserId, action='CREATE_STAFF_USER', subject='StaffUser', subjectId=newStaffUserId, severity='HIGH', detailsJson={ email, displayName, roles }.
- `revalidatePath('/roles')`.
- Return `{ success: true, staffUserId: <new id> }`.

#### 4b. `updateStaffUserAction(input: unknown)`

CASL check: `ability.can('update', 'StaffUser')`

Zod schema:
```typescript
const updateStaffUserSchema = z.object({
  staffUserId: z.string().min(1),
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
}).strict();
```

- If email changes, check for duplicates first.
- UPDATE `staffUser` SET only the provided fields (explicit mapping).
- Audit: action='UPDATE_STAFF_USER', severity='MEDIUM', detailsJson includes before/after.
- `revalidatePath('/roles')` and `revalidatePath('/roles/staff/' + staffUserId)`.

#### 4c. `grantSystemRoleAction(input: unknown)`

CASL check: `ability.can('manage', 'StaffUser')`

Zod schema:
```typescript
const grantSystemRoleSchema = z.object({
  staffUserId: z.string().min(1),
  role: z.enum([
    'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
    'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN'
  ]),
}).strict();
```

Business rules:
- **ADMIN cannot grant ADMIN or SUPER_ADMIN.** If calling session does NOT include 'SUPER_ADMIN' in platformRoles, and the requested role is 'ADMIN' or 'SUPER_ADMIN', return `{ error: 'Only SUPER_ADMIN can grant this role' }`.
- **Cannot grant to self.** If `staffUserId === session.staffUserId`, return `{ error: 'Cannot modify own roles' }`.
- Check if this exact staffUserId + role combination already exists with revokedAt IS NULL. If so, return `{ error: 'Role already assigned' }`.
- INSERT into `staffUserRole`.
- Audit: action='GRANT_SYSTEM_ROLE', subject='StaffUser', subjectId=staffUserId, severity='CRITICAL' (per Actors Canonical Section 6.3), detailsJson={ role, grantedBy: session.staffUserId }.
- `revalidatePath('/roles/staff/' + staffUserId)`.

#### 4d. `revokeSystemRoleAction(input: unknown)`

CASL check: `ability.can('manage', 'StaffUser')`

Zod schema:
```typescript
const revokeSystemRoleSchema = z.object({
  staffUserId: z.string().min(1),
  role: z.enum([...same as above...]),
}).strict();
```

Business rules:
- **ADMIN cannot revoke ADMIN or SUPER_ADMIN.** Same hierarchy check as grant.
- **Cannot modify own roles.** If `staffUserId === session.staffUserId`, return `{ error: 'Cannot modify own roles' }`.
- Find the active `staffUserRole` row (staffUserId + role + revokedAt IS NULL). If not found, return `{ error: 'Role not currently assigned' }`.
- UPDATE `staffUserRole` SET `revokedAt = new Date()` WHERE id = found row id.
- Audit: action='REVOKE_SYSTEM_ROLE', severity='CRITICAL', detailsJson={ role, revokedBy: session.staffUserId }.
- `revalidatePath('/roles/staff/' + staffUserId)`.

#### 4e. `deactivateStaffAction(input: unknown)`

CASL check: `ability.can('update', 'StaffUser')`

Zod schema:
```typescript
const deactivateStaffSchema = z.object({
  staffUserId: z.string().min(1),
  reason: z.string().min(1).max(500),
}).strict();
```

Business rules:
- **Cannot deactivate self.** Return `{ error: 'Cannot deactivate own account' }`.
- **ADMIN cannot deactivate SUPER_ADMIN.** Load target staff roles. If target has SUPER_ADMIN and caller does NOT have SUPER_ADMIN, return `{ error: 'Cannot deactivate SUPER_ADMIN' }`.
- UPDATE `staffUser` SET `isActive = false` WHERE id = staffUserId.
- DELETE all `staffSession` rows WHERE staffUserId = staffUserId (kill all active sessions).
- Audit: action='DEACTIVATE_STAFF', severity='HIGH', detailsJson={ reason }.
- `revalidatePath('/roles')` and `revalidatePath('/roles/staff/' + staffUserId)`.

#### 4f. `reactivateStaffAction(input: unknown)`

CASL check: `ability.can('update', 'StaffUser')`

Zod schema:
```typescript
const reactivateStaffSchema = z.object({
  staffUserId: z.string().min(1),
}).strict();
```

- UPDATE `staffUser` SET `isActive = true` WHERE id = staffUserId.
- Audit: action='REACTIVATE_STAFF', severity='HIGH'.
- `revalidatePath('/roles')` and `revalidatePath('/roles/staff/' + staffUserId)`.

#### 4g. `resetStaffPasswordAction(input: unknown)`

CASL check: `ability.can('update', 'StaffUser')`

Zod schema:
```typescript
const resetStaffPasswordSchema = z.object({
  staffUserId: z.string().min(1),
  newPassword: z.string().min(10).max(128),
}).strict();
```

Business rules:
- **Cannot reset own password through this action** (there would be a separate self-service flow).
- **ADMIN cannot reset SUPER_ADMIN password.** Same hierarchy check.
- Hash the new password, UPDATE staffUser SET passwordHash.
- DELETE all staffSession rows for that user (force re-login).
- Audit: action='RESET_STAFF_PASSWORD', severity='HIGH'.
- `revalidatePath('/roles/staff/' + staffUserId)`.

### Area 5: Hub Pages

**Reference patterns:** `src/app/(hub)/usr/page.tsx` (list), `src/app/(hub)/usr/[id]/page.tsx` (detail), `src/app/(hub)/mod/page.tsx` (dashboard with staffAuthorize).

All hub pages follow this pattern:
1. `export const metadata: Metadata = { title: '... | Twicely Hub' };`
2. Call `staffAuthorize()` at the top
3. Check `ability.can(...)` -- return "Access denied" if forbidden
4. Fetch data via query functions
5. Render using `AdminPageHeader` + content

#### 5a. Staff Roles List Page: `/roles`

**File:** `src/app/(hub)/roles/page.tsx`

Page Registry entry #115: `Staff Roles | Hub`, Layout: `hub`, Gate: `ADMIN`, Build Phase: `A4`

```
Title: "Staff Roles | Twicely Hub"
CASL check: ability.can('read', 'StaffUser')
```

Content:
- `AdminPageHeader` with title "Staff & Roles" and description showing total staff count
- Action button area: "Add Staff" link to `/roles/staff/new` (visible to ADMIN+)
- **Staff table** with columns: Name (link to `/roles/staff/[id]`), Email, Roles (badge chips), Status (Active/Inactive badge), Last Login (relative date), Joined (date)
- Search form (search by name/email)
- Pagination (50 per page)
- Each role shown as a small colored badge (e.g., `ADMIN` in red, `SUPPORT` in blue, etc.)

Page states per Page Registry:
- LOADING: Table skeleton
- EMPTY: "No staff users found"
- POPULATED: Staff table with pagination
- ERROR: "Access denied" for non-ADMIN

#### 5b. Staff Detail Page: `/roles/staff/[id]`

**File:** `src/app/(hub)/roles/staff/[id]/page.tsx`

Page Registry entry #116: `Staff Detail | Hub`, Layout: `hub`, Gate: `ADMIN`, Build Phase: `A4`

```
Title: "Staff Detail | Twicely Hub"
CASL check: ability.can('read', 'StaffUser')
```

Content sections:

1. **Header**: `AdminPageHeader` with staff name as title, email as description, action buttons (Deactivate/Reactivate, Reset Password)

2. **Info card**: Display name, email, status, MFA status, last login, created date

3. **System Roles section**: List of current (active) system roles as badges. Each with a "Revoke" button. Plus a "Grant Role" form (dropdown of platformRoleEnum values not already assigned + "Grant" button). Show revoked roles in a collapsible "History" section (with revoked date and who revoked).

4. **Custom Roles section** (if any custom roles exist): List of assigned custom roles with "Revoke" button. Plus "Assign Custom Role" dropdown. This section is only interactive for SUPER_ADMIN.

Implementation notes:
- The detail page is a Server Component that loads data, then renders Client Components for the interactive forms.
- Create a client component `StaffRoleManager` at `src/components/admin/staff-role-manager.tsx` that handles the grant/revoke UI with form actions.
- Create a client component `StaffActions` at `src/components/admin/actions/staff-actions.tsx` for the deactivate/reactivate/reset-password buttons.

**Hierarchy enforcement in the UI:**
- If the viewing staff is ADMIN (not SUPER_ADMIN), do NOT show grant/revoke buttons for ADMIN or SUPER_ADMIN roles.
- If the target staff user is SUPER_ADMIN and viewer is only ADMIN, show the roles read-only with no action buttons.
- The `session.platformRoles` array from `staffAuthorize()` tells you the viewer's roles.

#### 5c. Create Staff Page: `/roles/staff/new`

**File:** `src/app/(hub)/roles/staff/new/page.tsx`

This route is NOT explicitly in the Page Registry (entries #115 and #116 cover `/roles` and `/roles/staff/[id]`). However, it is a necessary sub-route for the "Add Staff" action from the list page. The Feature Lock-in mentions `/roles/new` for creating roles, but staff creation is a closely related action. This page creates a new `staffUser`, not a custom role.

```
Title: "Add Staff | Twicely Hub"
CASL check: ability.can('create', 'StaffUser')
```

Content:
- `AdminPageHeader` with title "Add Staff Member"
- Form fields:
  - Email (required, email format)
  - Display Name (required, 1-100 chars)
  - Password (required, 10-128 chars)
  - Roles (multi-select checkboxes from platformRoleEnum values)
- Role checkboxes: if viewer is ADMIN but NOT SUPER_ADMIN, the ADMIN and SUPER_ADMIN checkboxes are disabled with tooltip "Only SUPER_ADMIN can grant this role"
- Submit button: "Create Staff User"
- On success: redirect to `/roles/staff/[newId]`
- On error: show error message inline

Create a client component `CreateStaffForm` at `src/components/admin/create-staff-form.tsx`.

### Area 6: Custom Role Management (Deferred/Minimal)

Per the Actors Canonical Section 4.3, custom roles have a complex toggle-grid UI with 30 subjects and ~130 permissions. The full toggle-grid permission editor is a significant UI component. For this A4 install, implement the **data layer** (actions/queries) for custom roles but **defer the toggle-grid UI** to a follow-up step.

What to build for custom roles in A4:
- The queries in `admin-staff.ts` already cover `getCustomRoleList()` and `getCustomRoleById()`
- Add basic CRUD actions for custom roles (create, update, delete) in `admin-staff.ts`
- The `/roles` list page shows custom roles in a separate section below the staff table
- Custom role CRUD actions are gated to SUPER_ADMIN only

**NOT in scope for A4** (defer to a future step):
- The 30-subject toggle-grid permission editor UI
- The custom role detail page with interactive permission toggles
- Loading custom roles into the CASL ability factory (Section 4.3.3 integration)

This means in A4, custom roles can be created with a name/description but cannot yet have their permissions configured via UI. The `permissionsJson` column exists but the UI to edit it is deferred.

## Constraints -- What NOT To Do

1. **Do NOT create any new database tables.** All tables already exist.
2. **Do NOT modify any schema files** (`staff.ts`, `platform.ts`, `enums.ts`).
3. **Do NOT use `as any`, `@ts-ignore`, or `@ts-expect-error`.**
4. **Do NOT spread request body into DB updates** -- use explicit field mapping.
5. **Do NOT hardcode role names in page-level access checks** -- use `staffAuthorize()` + CASL `ability.can()`.
6. **Do NOT export helper functions** from `'use server'` files -- only export the action functions themselves. Internal helpers must be unexported or in a separate non-server file.
7. **Do NOT allow ADMIN to manage ADMIN/SUPER_ADMIN roles.** The hierarchy is: SUPER_ADMIN can manage all roles. ADMIN can manage all roles EXCEPT ADMIN and SUPER_ADMIN. Non-admin staff cannot access `/roles` at all.
8. **Do NOT allow staff to modify their own roles** -- this prevents privilege escalation.
9. **Do NOT use `/admin`, `/dashboard`, or `/corp/roles`** -- the correct route is `/roles` under the hub subdomain.
10. **Do NOT create a separate auth system** -- use the existing `staffAuthorize()` from `src/lib/casl/staff-authorize.ts`.
11. **Maximum 300 lines per file.** Split if longer.
12. **Do NOT add 2FA verification** to role grant/revoke in this step. The Actors Canonical says 2FA is required for CRITICAL admin actions, but the MFA verification UI/flow does not yet exist. Add a `// TODO: Require MFA re-verification (Actors Canonical Section 6.1)` comment where it would go.
13. **Do NOT build the custom role permission toggle grid** -- that is deferred.
14. **Do NOT use any banned terms** from CLAUDE.md.

## Acceptance Criteria

### Functional

1. `/roles` page renders a paginated list of all staff users with their active roles
2. `/roles` page has a search form that filters by email/name
3. `/roles` page has an "Add Staff" button linking to `/roles/staff/new`
4. `/roles/staff/[id]` page shows staff detail with all system roles (active and history)
5. `/roles/staff/[id]` allows granting a new system role (dropdown + button)
6. `/roles/staff/[id]` allows revoking an existing system role (button per role)
7. `/roles/staff/new` page has a form to create a new staff user with email, display name, password, and role selection
8. Creating a staff user inserts into `staffUser` and `staffUserRole` tables
9. Deactivating a staff user sets `isActive = false` and deletes all their `staffSession` rows
10. Reactivating sets `isActive = true`
11. Resetting password updates `passwordHash` and kills all sessions

### Authorization Hierarchy

12. Non-ADMIN staff (SUPPORT, MODERATION, FINANCE, etc.) get "Access denied" on `/roles`
13. ADMIN can view, create, deactivate, reactivate staff users
14. ADMIN can grant/revoke roles EXCEPT ADMIN and SUPER_ADMIN
15. ADMIN sees ADMIN/SUPER_ADMIN role checkboxes as disabled in the create form
16. ADMIN cannot see grant/revoke buttons for ADMIN/SUPER_ADMIN roles on the detail page
17. SUPER_ADMIN can do everything ADMIN can, PLUS grant/revoke ADMIN and SUPER_ADMIN roles
18. No staff user can modify their own roles (self-modification blocked)
19. ADMIN cannot deactivate a SUPER_ADMIN user
20. ADMIN cannot reset a SUPER_ADMIN user's password

### Audit

21. Every role grant creates an `auditEvent` with severity='CRITICAL', action='GRANT_SYSTEM_ROLE'
22. Every role revocation creates an `auditEvent` with severity='CRITICAL', action='REVOKE_SYSTEM_ROLE'
23. Staff creation creates an `auditEvent` with severity='HIGH', action='CREATE_STAFF_USER'
24. Staff deactivation creates an `auditEvent` with severity='HIGH', action='DEACTIVATE_STAFF'
25. Staff reactivation creates an `auditEvent` with severity='HIGH', action='REACTIVATE_STAFF'
26. Password reset creates an `auditEvent` with severity='HIGH', action='RESET_STAFF_PASSWORD'
27. All audit events include `actorType='STAFF'` and `actorId=session.staffUserId`

### Validation

28. All action inputs validated with Zod `.strict()` -- unknown keys rejected
29. Email must be valid email format
30. Display name 1-100 characters
31. Password 10-128 characters
32. At least one role required when creating staff
33. Duplicate email returns a clear error message

### Data Integrity

34. Role revocation uses soft-delete (`revokedAt` timestamp), not hard delete
35. `staffUserRole.grantedByStaffId` always populated with the acting staff's ID
36. All dates use timezone-aware timestamps
37. Password hashed with bcryptjs (cost factor 10)

### Vocabulary

38. No banned terms appear anywhere in the code or UI
39. Page titles follow pattern: `{Page Title} | Twicely Hub`
40. Route prefix is `/roles` (not `/admin/roles`, not `/corp/roles`)

## Test Requirements

**File:** `src/lib/actions/__tests__/admin-staff.test.ts`

Follow the exact testing pattern from `src/lib/actions/__tests__/admin-users.test.ts`:
- Mock `staffAuthorize` with `vi.mock`
- Mock `db` with `vi.mock`
- Mock `drizzle-orm` for `eq`
- Mock schema imports
- Helper functions: `makeUpdateChain`, `makeInsertChain`, `mockAllowed`, `mockForbidden`
- Dynamic import of actions (`await import('../admin-staff')`) after mocks

### Required Tests

**createStaffUserAction:**
1. Returns 'Forbidden' when CASL denies manage on StaffUser
2. Returns 'Invalid input' for missing email
3. Returns 'Invalid input' for invalid email format
4. Returns 'Invalid input' for password under 10 chars
5. Returns 'Invalid input' for empty roles array
6. Rejects extra fields via .strict()
7. Returns 'Email already in use' for duplicate email
8. ADMIN cannot grant ADMIN role (returns error)
9. ADMIN cannot grant SUPER_ADMIN role (returns error)
10. SUPER_ADMIN can grant ADMIN role (success)
11. Creates staff user + roles + audit event on success
12. Password is hashed (not stored in plain text)

**grantSystemRoleAction:**
13. Returns 'Forbidden' when CASL denies
14. Returns 'Invalid input' for missing staffUserId
15. Returns 'Invalid input' for invalid role value
16. Rejects extra fields
17. Returns error when ADMIN tries to grant ADMIN role
18. Returns error when ADMIN tries to grant SUPER_ADMIN role
19. Returns error when trying to modify own roles
20. Returns error when role already assigned
21. Grants role and creates CRITICAL audit event on success

**revokeSystemRoleAction:**
22. Returns 'Forbidden' when CASL denies
23. Returns error when ADMIN tries to revoke ADMIN role
24. Returns error when trying to modify own roles
25. Returns error when role not currently assigned
26. Soft-deletes role (sets revokedAt) and creates CRITICAL audit event

**deactivateStaffAction:**
27. Returns 'Forbidden' when CASL denies
28. Returns error when trying to deactivate self
29. Returns error when ADMIN tries to deactivate SUPER_ADMIN
30. Deactivates staff and deletes sessions and creates HIGH audit event

**reactivateStaffAction:**
31. Returns 'Forbidden' when CASL denies
32. Reactivates staff and creates HIGH audit event

**resetStaffPasswordAction:**
33. Returns 'Forbidden' when CASL denies
34. Returns error when ADMIN tries to reset SUPER_ADMIN password
35. Resets password, kills sessions, creates HIGH audit event

**File:** `src/lib/queries/__tests__/admin-staff.test.ts` (optional but recommended)

Test query functions return correct shapes and handle empty results.

**Minimum: 35 tests** covering all actions with CASL, validation, hierarchy, and audit checks.

## File Approval List

The installer must propose these files before coding:

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/casl/subjects.ts` | MODIFY: Add 'StaffUser' and 'CustomRole' to SUBJECTS array |
| 2 | `src/lib/queries/admin-staff.ts` | CREATE: getStaffList, getStaffById, getCustomRoleList, getCustomRoleById queries |
| 3 | `src/lib/actions/admin-staff.ts` | CREATE: createStaffUser, updateStaffUser, grantSystemRole, revokeSystemRole, deactivateStaff, reactivateStaff, resetStaffPassword actions |
| 4 | `src/app/(hub)/roles/page.tsx` | CREATE: Staff Roles list page |
| 5 | `src/app/(hub)/roles/staff/[id]/page.tsx` | CREATE: Staff detail page |
| 6 | `src/app/(hub)/roles/staff/new/page.tsx` | CREATE: Create staff user page |
| 7 | `src/components/admin/staff-role-manager.tsx` | CREATE: Client component for grant/revoke role UI |
| 8 | `src/components/admin/actions/staff-actions.tsx` | CREATE: Client component for deactivate/reactivate/reset-password buttons |
| 9 | `src/components/admin/create-staff-form.tsx` | CREATE: Client component for the create staff form |
| 10 | `src/lib/actions/__tests__/admin-staff.test.ts` | CREATE: 35+ tests for all admin-staff actions |

**Total: 1 modified file, 9 new files**

## Verification Checklist

After implementation, the installer must run these checks and paste the FULL raw output:

### 1. TypeScript
```bash
pnpm typecheck
```
Expected: 0 errors.

### 2. Tests
```bash
pnpm test
```
Expected: All tests pass. Test count >= BASELINE_TESTS (1434) + ~35 new = ~1469.

### 3. Linter
```bash
./twicely-lint.sh
```
Expected: All checks pass.

### 4. Banned Terms
```bash
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC.*StoreTier\|ELITE.*StoreTier\|PLUS.*ListerTier\|MAX.*ListerTier\|PREMIUM\|Twicely Balance\|wallet\|Withdraw" src/lib/actions/admin-staff.ts src/lib/queries/admin-staff.ts src/app/\(hub\)/roles/ src/components/admin/staff-role-manager.tsx src/components/admin/actions/staff-actions.tsx src/components/admin/create-staff-form.tsx || echo "No banned terms found"
```

### 5. Route Check
```bash
grep -rn "\/admin\|\/corp\/roles\|\/dashboard" src/app/\(hub\)/roles/ src/components/admin/staff-role-manager.tsx src/components/admin/create-staff-form.tsx src/components/admin/actions/staff-actions.tsx || echo "No wrong routes found"
```

### 6. File Size Check
```bash
wc -l src/lib/actions/admin-staff.ts src/lib/queries/admin-staff.ts src/app/\(hub\)/roles/page.tsx src/app/\(hub\)/roles/staff/\[id\]/page.tsx src/app/\(hub\)/roles/staff/new/page.tsx src/components/admin/staff-role-manager.tsx src/components/admin/actions/staff-actions.tsx src/components/admin/create-staff-form.tsx
```
Expected: All files under 300 lines.

### 7. CASL Subjects Check
```bash
grep -n "StaffUser\|CustomRole" src/lib/casl/subjects.ts
```
Expected: Both subjects present in the SUBJECTS array.

### 8. Actions File Check
Verify no helper functions are exported from the 'use server' file:
```bash
grep -n "^export " src/lib/actions/admin-staff.ts
```
Expected: Only the action functions are exported (createStaffUserAction, updateStaffUserAction, grantSystemRoleAction, revokeSystemRoleAction, deactivateStaffAction, reactivateStaffAction, resetStaffPasswordAction). No helper/utility functions exported.

## Spec Gaps and Decisions

1. **`/roles/staff/new` is NOT in the Page Registry.** The Page Registry has #115 (`/roles`) and #116 (`/roles/staff/[id]`). The create route `/roles/staff/new` is implied by the "Add Staff" functionality but not explicitly listed. This is a reasonable addition since the Page Registry entry #115 says "create/revoke roles" and creating staff users is part of that flow. **NOT SPECIFIED -- but necessary for the feature. Proceed with `/roles/staff/new`.**

2. **Custom role toggle-grid UI is deferred.** The Actors Canonical Section 4.3.6 specifies a detailed toggle-grid with 30 subjects and ~130 permissions. This is a significant standalone UI effort. A4 builds the data layer; a future step builds the toggle-grid. **Decision needed: Should the toggle-grid be a separate install prompt (A4.1)?**

3. **2FA re-verification for CRITICAL actions is not yet possible.** The MFA flow for staff users is not yet built. The Actors Canonical requires 2FA for granting Admin roles (Section 3.6). We add TODO comments where 2FA should be checked. **Decision needed: When will staff MFA flow be implemented?**

4. **The admin-nav.ts roles entry uses `['ADMIN']` but SUPER_ADMIN also needs access.** The `filterAdminNav` function in admin-nav.ts already handles this -- line 180 says `if (roles.includes('SUPER_ADMIN')) return nav;` which returns ALL nav items for SUPER_ADMIN. So SUPER_ADMIN already sees the Roles link. No change needed.

5. **The Actors Canonical Section 5.5 uses `/corp/roles` (V2 naming) but V3 uses `/roles` under hub subdomain.** The Page Registry (V3, authoritative) uses `/roles`. Use `/roles`.

---

**END OF INSTALL PROMPT -- A4-staff-roles-management.md**
