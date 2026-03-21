# D5 — Delegation (Seller Staff Accounts)

**Phase & Step:** [D5]
**Feature Name:** Seller Delegation & Staff Management
**One-line Summary:** Build the UI and server logic for sellers to invite, manage, and revoke staff members who can perform scoped actions on their behalf.
**Status:** QUEUED
**Depends on:** D3 (Store Subscriptions) -- DONE

---

## Canonical Sources (MUST read before starting)

| Document | Relevance |
|----------|-----------|
| `TWICELY_V3_SCHEMA_v2_0_7.md` section 3.4 | `delegated_access` table definition |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` sections 3.4, 4.1, 4.2, 5.3 | Delegation scopes, CASL rules, session structure, route gates |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` section 26 | Delegation business rules, UI, admin settings |
| `TWICELY_V3_USER_MODEL.md` section 8 | Staff invariants, delegation scopes, role presets |
| `TWICELY_V3_PAGE_REGISTRY.md` entries 66-67 | `/my/selling/staff` and `/my/selling/staff/invite` routes |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` sections 3.2, 3.3, 7 | Sidebar visibility, staff context switching |
| `TWICELY_V3_TESTING_STANDARDS.md` | Testing patterns |

---

## 1. PREREQUISITES

### Must Be Complete
- A3 (Auth -- Better Auth) -- DONE
- A4 (CASL setup) -- DONE. The CASL ability factory (`src/lib/casl/ability.ts`) already has `defineStaffAbilities()` with full scope-to-rule mapping. The `DelegatedAccess` subject exists. The `authorize()` function exists. Tests for staff abilities exist.
- D3 (Store Subscriptions) -- DONE. `storeSubscription` table exists with tier data.
- `delegated_access` table -- ALREADY EXISTS in schema at `src/lib/db/schema/subscriptions.ts` (lines 102-120). Migration for this table should already be in place from prior schema addenda.

### Already Existing (DO NOT recreate)
- **Schema:** `delegatedAccess` table in `src/lib/db/schema/subscriptions.ts` -- already defined
- **Enums:** `delegationStatusEnum` in `src/lib/db/schema/enums.ts` -- PENDING, ACTIVE, REVOKED, EXPIRED
- **CASL types:** `DelegationScope` type in `src/lib/casl/types.ts` -- 16 scope values defined
- **CASL ability:** `defineStaffAbilities()` in `src/lib/casl/ability.ts` -- fully maps scopes to CASL rules
- **CASL tests:** `src/lib/casl/__tests__/ability-seller-staff.test.ts` -- 11 tests covering all scope combinations
- **CASL authorize:** `src/lib/casl/authorize.ts` -- has the `authorize()` function BUT currently hardcodes `delegationId: null`. D5 MUST update this.
- **CASL check helper:** `sub()` in `src/lib/casl/check.ts`
- **Auth server:** `src/lib/auth/server.ts` -- Better Auth config

### Dependencies (npm packages)
No new packages needed. Existing: `@casl/ability`, `zod`, `drizzle-orm`, `better-auth`, `next`, `@paralleldrive/cuid2`.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2.1 Database

**Table: `delegated_access` (ALREADY EXISTS -- do not recreate)**

```typescript
// src/lib/db/schema/subscriptions.ts (lines 102-120)
export const delegatedAccess = pgTable('delegated_access', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:        text('seller_id').notNull().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  userId:          text('user_id').notNull().references(() => user.id),
  email:           text('email').notNull(),
  scopes:          text('scopes').array().notNull().default(sql`'{}'::text[]`),
  status:          delegationStatusEnum('status').notNull().default('ACTIVE'),
  invitedAt:       timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt:      timestamp('accepted_at', { withTimezone: true }),
  revokedAt:       timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: text('revoked_by_user_id'),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:       index('da_seller').on(table.sellerId),
  userIdx:         index('da_user').on(table.userId),
  statusIdx:       index('da_status').on(table.status),
}));
```

**Schema observation:** The User Model (section 8) mentions `rolePreset` and `invitedByUserId` columns, but the Schema doc v2.0.7 (the source of truth for columns) does NOT include them. Do NOT add columns that are not in the schema doc. Role presets are a UI convenience only -- the `scopes` array is what gets stored.

**No new migration needed** -- the `delegated_access` table should already exist from prior Phase D schema addenda. Verify by checking existing migrations. If the table does not exist in migrations, a migration MUST be generated first.

### 2.2 Platform Settings (seed values)

Three delegation-related platform settings must be seeded. Source: Feature Lock-in section 26.

| Key | Value | Type | Category | Label | Editable |
|-----|-------|------|----------|-------|----------|
| `delegation.maxStaffPerSeller` | `10` | `INTEGER` | `delegation` | `Max staff per seller` | `true` |
| `delegation.require2faForHighRisk` | `true` | `BOOLEAN` | `delegation` | `Require 2FA for high-risk scope grants` | `true` |
| `delegation.payoutChangeHoldHours` | `72` | `INTEGER` | `delegation` | `Payout change hold hours (delegated)` | `true` |

**NOTE:** The default of 10 from the Feature Lock-in is a general default. The User Model section 4.1 defines per-StoreTier staff limits: NONE=0, STARTER=0, PRO=5, POWER=25, ENTERPRISE=unlimited. The platform setting `delegation.maxStaffPerSeller` is a platform-wide maximum cap. The actual limit for a seller is `min(tierLimit, platformMax)`. NONE and STARTER tiers get 0 staff -- delegation is not available to them.

### 2.3 Server Actions

**File: `src/lib/actions/delegation.ts`**

All actions use `'use server'` directive. All inputs validated with Zod strict schemas. All check CASL authorization via `authorize()`. All log audit events.

#### Action 1: `inviteStaffMember`

**Input schema:**
```typescript
const inviteStaffSchema = z.object({
  email: z.string().email(),
  scopes: z.array(z.string()).min(1),
}).strict();
```

**Logic:**
1. Call `authorize()` -- get session + ability
2. Verify session is NOT null and NOT a delegate (owner only -- `session.delegationId === null`)
3. Verify `ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }))`
4. Load seller profile to get `storeTier`
5. Determine staff limit from StoreTier: PRO=5, POWER=25, ENTERPRISE=999 (treated as unlimited). NONE and STARTER = 0 (reject immediately)
6. Also read platform setting `delegation.maxStaffPerSeller` -- actual limit is `min(tierLimit, platformSetting)`
7. Count existing active/pending delegations for this sellerId
8. If count >= limit, return error: "Staff limit reached for your current plan"
9. Validate all scopes are valid DelegationScope values
10. Check if user with this email already has active/pending delegation for this seller -- if so, error
11. Look up user by email. If user does not exist, set `userId` to a placeholder or handle PENDING state (see below)
12. Create `delegated_access` record with status `PENDING`, scopes from input
13. Emit audit event: `delegation.invited`
14. Revalidate `/my/selling/staff`
15. Return `{ success: true, delegationId: newRecord.id }`

**PENDING state handling:** When a user is invited by email but that email is NOT yet registered on Twicely, the delegation record is still created with status `PENDING`. The `userId` field is required by the schema (NOT NULL), so the system must either (a) find the user by email or (b) return an error saying the user must have a Twicely account first. Given the FK constraint, option (b) is the correct approach per the schema. The invited person must sign up first, then the owner re-invites them. Alternatively, the owner can only invite existing Twicely users by email.

**DECISION NEEDED:** The Feature Lock-in says "Staff member creates their own Twicely account (or uses existing one)" which implies invitations can be sent to non-users. But the schema has a NOT NULL FK to user.id. Resolution options:
- **(A)** Allow inviting non-users: set userId to a sentinel, and when the user signs up, a hook matches their email and links the delegation. This requires schema awareness of pending-without-user state.
- **(B)** Only allow inviting existing Twicely users by email lookup. If not found, show "This person needs to create a Twicely account first."

**Recommendation:** Option (B) for D5 initial implementation. It is simpler, does not require a signup hook, and matches the schema constraint. Option (A) can be added as a D5.1 enhancement later.

#### Action 2: `updateStaffScopes`

**Input schema:**
```typescript
const updateScopesSchema = z.object({
  delegationId: z.string().cuid2(),
  scopes: z.array(z.string()).min(1),
}).strict();
```

**Logic:**
1. `authorize()` -- session + ability
2. Owner-only check (`session.delegationId === null`)
3. CASL check: `ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }))`
4. Load delegation record, verify `sellerId === session.sellerId` and status is ACTIVE
5. Validate all scopes are valid DelegationScope values
6. Update `scopes` and `updatedAt`
7. Emit audit event: `delegation.scopes_updated` with old and new scopes
8. Revalidate `/my/selling/staff`
9. Return `{ success: true }`

#### Action 3: `revokeStaffMember`

**Input schema:**
```typescript
const revokeSchema = z.object({
  delegationId: z.string().cuid2(),
}).strict();
```

**Logic:**
1. `authorize()` -- session + ability
2. Owner-only check (`session.delegationId === null`)
3. CASL check: `ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }))`
4. Load delegation record, verify `sellerId === session.sellerId` and status is ACTIVE or PENDING
5. Update status to `REVOKED`, set `revokedAt` to now, `revokedByUserId` to session.userId
6. Emit audit event: `delegation.revoked`
7. Revalidate `/my/selling/staff`
8. Return `{ success: true }`

**Security note from canonical:** "If delegation is revoked mid-session, next API call returns 403." This is handled by the `authorize()` function which loads delegation status on each request (after D5 updates it).

#### Action 4: `acceptInvitation`

**Input schema:**
```typescript
const acceptSchema = z.object({
  delegationId: z.string().cuid2(),
}).strict();
```

**Logic:**
1. `authorize()` -- session (must be authenticated)
2. Load delegation record where `id === delegationId` AND `userId === session.userId` AND `status === PENDING`
3. If not found, return error "Invitation not found or already processed"
4. Check if `expiresAt` is set and has passed -- if so, update to EXPIRED and return error
5. Update status to `ACTIVE`, set `acceptedAt` to now
6. Emit audit event: `delegation.accepted`
7. Return `{ success: true }`

### 2.4 Queries

**File: `src/lib/queries/delegation.ts`**

#### Query 1: `getStaffMembers`

Returns all delegation records for a seller, including user name and email from the joined user table.

```typescript
export async function getStaffMembers(sellerId: string): Promise<StaffMember[]>
```

**Returns:**
```typescript
type StaffMember = {
  id: string;               // delegatedAccess.id
  userId: string;
  email: string;
  name: string;             // from user table join
  scopes: string[];
  status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};
```

**Logic:** Join `delegated_access` with `user` on `userId`. Filter by `sellerId`. Order by `createdAt` desc. Include all statuses (UI will filter/display accordingly).

#### Query 2: `getActiveDelegation`

This is the CRITICAL query used by the `authorize()` function to check if the current user has an active delegation.

```typescript
export async function getActiveDelegation(userId: string): Promise<ActiveDelegation | null>
```

**Returns:**
```typescript
type ActiveDelegation = {
  delegationId: string;
  sellerId: string;         // sellerProfile.id of the delegating seller
  scopes: string[];
  ownerUserId: string;      // the seller's userId (for display/audit)
  ownerName: string;        // for "Acting as: [Name]" UI
};
```

**Logic:**
1. Query `delegated_access` where `userId = $userId` AND `status = 'ACTIVE'`
2. Join with `seller_profile` to get the `seller_profile.userId` (owner's userId)
3. Join with `user` (on seller_profile.userId) to get owner's name
4. Check `expiresAt` -- if set and passed, update to EXPIRED and return null
5. If multiple active delegations exist, return the most recently accepted one (a user can only act as one delegate at a time in the current session)

**IMPORTANT:** This query is called on EVERY authenticated request (inside `authorize()`). It MUST be fast. The indexes `da_user` and `da_status` on the `delegated_access` table support this.

#### Query 3: `getDelegationById`

Used by the actions to load a specific delegation for verification.

```typescript
export async function getDelegationById(delegationId: string): Promise<DelegationRecord | null>
```

#### Query 4: `getStaffCountForSeller`

Returns count of active + pending delegations for a seller. Used by `inviteStaffMember` to check limits.

```typescript
export async function getStaffCountForSeller(sellerId: string): Promise<number>
```

#### Query 5: `getPendingInvitations`

Returns pending invitations for the current user (to show in their hub when they log in).

```typescript
export async function getPendingInvitations(userId: string): Promise<PendingInvitation[]>
```

### 2.5 Authorization Updates

**CRITICAL: Update `src/lib/casl/authorize.ts`**

The current `authorize()` function hardcodes delegation fields to null:

```typescript
// CURRENT (lines 59-61):
delegationId: null,
onBehalfOfSellerId: null,
delegatedScopes: [],
```

D5 MUST update this to load active delegation from the database:

```typescript
// UPDATED:
// Check for active delegation
const delegation = await getActiveDelegation(user.id);

const caslSession: CaslSession = {
  userId: user.id,
  email: user.email,
  isSeller: user.isSeller ?? false,
  sellerId,
  sellerStatus: null,
  delegationId: delegation?.delegationId ?? null,
  onBehalfOfSellerId: delegation?.sellerId ?? null,
  delegatedScopes: delegation?.scopes ?? [],
  isPlatformStaff: false,
  platformRoles: [],
};
```

**Session mode switching:** When a user IS a seller themselves AND also has a delegation, they should NOT automatically enter delegation mode. Delegation mode should be entered explicitly (e.g., via a "Switch to [Seller Name]" action in the topbar). For D5 initial implementation, the simplest approach is:
- If user has an active delegation AND is not themselves a seller, auto-enter delegation mode
- If user IS a seller AND has a delegation, they stay in their own seller context by default and can switch via a future UI (beyond D5 scope)

**NOT SPECIFIED -- owner decision needed:** How does a user who is both a seller and a staff member switch between contexts? The Hub Canonical section 7 describes a topbar context switcher ("Acting as: [Seller Name] dropdown to switch back"), but the mechanism (cookie? query param? session field?) is not specified. For D5, implement the data layer only -- the UI context switcher is a future enhancement. Default behavior: if user has `delegationId` populated, they are in staff mode.

### 2.6 Pages & Components

#### Page 1: `/my/selling/staff` (Staff Management)

**Route:** `src/app/(hub)/my/selling/staff/page.tsx`
**Gate:** `OWNER_ONLY` (from Page Registry entry 66). Staff with `staff.manage` scope can also access this per the Actors canonical section 3.4. But the Page Registry says OWNER_ONLY. Page Registry takes precedence for the route gate. However, the CASL rules DO allow staff with `staff.manage` scope to `manage DelegatedAccess`. Resolution: the page gate checks OWNER_ONLY at the route level. In a future iteration, staff.manage holders could also be granted page access. For D5, follow the Page Registry: OWNER_ONLY.

**Page states (from Page Registry conventions):**
- **LOADING:** Table skeleton (3-5 rows)
- **EMPTY:** "You haven't added any staff members yet" + "Invite Staff" CTA
- **POPULATED:** Staff table + "Invite Staff" button
- **FORBIDDEN:** Non-owner or non-seller sees "Staff management is only available to store owners"
- **TIER_BLOCKED:** NONE/STARTER tier sees "Staff management requires Store Pro or higher" + upgrade CTA

**Staff table columns:**
- Name + email
- Scopes (badge chips for each scope, or role preset label if matching a preset)
- Status (PENDING/ACTIVE/REVOKED badge)
- Invited date
- Last activity (placeholder for future audit log integration)
- Actions: Edit scopes, Revoke access

**Data flow:**
1. Server component calls `authorize()` to verify OWNER_ONLY
2. Server component loads seller profile to check `storeTier` (must be PRO+)
3. Server component calls `getStaffMembers(session.sellerId)`
4. Passes data to client component for interactive table

#### Page 2: `/my/selling/staff/invite` (Invite Staff Form)

**Route:** `src/app/(hub)/my/selling/staff/invite/page.tsx`
**Gate:** `OWNER_ONLY` (from Page Registry entry 67)

**Form fields:**
- Email address (text input, validated)
- Permission scopes (checkbox group organized by category)
- Role preset selector (dropdown with MANAGER, FULFILLMENT, FINANCE, SUPPORT, READ_ONLY, CUSTOM)
  - Selecting a preset auto-fills the scope checkboxes
  - Modifying any checkbox after selecting a preset switches to CUSTOM
- Submit button: "Send Invitation"

**Scope categories for the checkbox UI:**

| Category | Scopes |
|----------|--------|
| Listings | `listings.view`, `listings.manage` |
| Orders | `orders.view`, `orders.manage` |
| Shipping | `shipping.manage` |
| Returns | `returns.respond` |
| Messages | `messages.view`, `messages.send` |
| Finance | `finance.view` |
| Analytics | `analytics.view` |
| Promotions | `promotions.view`, `promotions.manage` |
| Store Settings | `settings.view`, `settings.manage` |
| Staff | `staff.manage` |
| Dashboard | `dashboard.view` |

**Role presets (from Actors canonical section 3.4):**

| Preset | Scopes |
|--------|--------|
| MANAGER | All scopes EXCEPT `staff.manage` |
| FULFILLMENT | `dashboard.view`, `orders.view`, `orders.manage`, `shipping.manage`, `messages.view`, `messages.send` |
| FINANCE | `dashboard.view`, `finance.view`, `orders.view`, `analytics.view` |
| SUPPORT | `dashboard.view`, `orders.view`, `returns.respond`, `messages.view`, `messages.send` |
| READ_ONLY | `dashboard.view`, `listings.view`, `orders.view`, `finance.view`, `analytics.view`, `messages.view`, `settings.view` |

**Data flow:**
1. Server component verifies OWNER_ONLY + PRO+ tier
2. Client component renders form
3. On submit, calls `inviteStaffMember` server action
4. On success, redirect to `/my/selling/staff`

#### Component: `StaffMemberRow` (client component)

Renders a single staff member in the table. Includes:
- Edit scopes dialog (modal with scope checkboxes, calls `updateStaffScopes`)
- Revoke button with confirmation dialog (calls `revokeStaffMember`)
- Status badge (colored per status)

#### Component: `ScopeSelector` (client component)

Reusable scope checkbox group used in both the invite form and the edit scopes dialog. Accepts `selectedScopes` and `onChange` props. Renders scopes grouped by category with role preset quick-select.

### 2.7 CASL Rules (Already Implemented)

The CASL rules for delegation are ALREADY FULLY IMPLEMENTED in `src/lib/casl/ability.ts`:

- Seller gets `can('manage', 'DelegatedAccess', { sellerId })` -- lines 124-125
- Staff with `staff.manage` scope gets `can('manage', 'DelegatedAccess', { sellerId })` -- lines 230-232
- Staff hardcoded `cannot('manage', 'Subscription')`, `cannot('create/update/delete', 'Payout')`, `cannot('delete', 'SellerProfile')` -- lines 234-241

**No changes needed to the ability factory.** The only CASL-related change is in `authorize.ts` to load delegation context.

### 2.8 Tier Gating

Staff limits per StoreTier (from User Model section 4.1):

| StoreTier | Staff Limit |
|-----------|-------------|
| NONE | 0 (no delegation) |
| STARTER | 0 (no delegation) |
| PRO | 5 |
| POWER | 25 |
| ENTERPRISE | Unlimited (capped by platform setting) |

The actual limit is `min(tierStaffLimit, platformSetting('delegation.maxStaffPerSeller'))`.

The invite action must enforce this. The staff management page must show the limit and current count.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- Do NOT use `wallet` in any UI copy -- use `payout`
- Do NOT use `SellerTier` or `SubscriptionTier` -- use `StoreTier`
- Do NOT use `dashboard` in route paths -- routes are under `/my/selling/staff`
- Do NOT use `admin` in route paths
- Do NOT use `FVF` or `Final Value Fee` -- use `TF` / `Transaction Fee`
- Do NOT use `Twicely Balance` -- use `Available for payout`
- Do NOT use `BASIC`, `ELITE`, `PLUS`, `MAX`, or `PREMIUM` as tier names

### Tech Stack
- Do NOT use Prisma -- use Drizzle
- Do NOT use NextAuth -- use Better Auth
- Do NOT use Zustand/Redux -- use React context + server state
- Do NOT use tRPC -- use Next.js server actions

### Code Patterns
- Do NOT use `as any`, `as unknown as T`, `@ts-ignore`, `@ts-expect-error`
- Do NOT hardcode fee rates or staff limits in code -- read from `platform_settings` table and StoreTier logic
- Do NOT spread request body into DB updates -- explicit field mapping
- Do NOT use `storeId`, `businessId`, `sellerProfileId` as ownership key -- always `userId`
- Do NOT create files over 300 lines -- split if needed
- Do NOT use `sellerId` or `delegationId` from request body -- derive from session ONLY
- Do NOT allow staff to set their own scopes or modify their own delegation
- Do NOT allow PERSONAL sellers or NONE/STARTER StoreTier sellers to access delegation features

### Business Logic
- Do NOT allow staff to manage Subscriptions (hardcoded cannot in CASL)
- Do NOT allow staff to manage Payouts (hardcoded cannot in CASL)
- Do NOT allow staff to delete SellerProfile (hardcoded cannot in CASL)
- Do NOT allow staff to modify the owner's User account
- Do NOT allow staff to grant scopes they themselves do not have (if staff.manage is delegated to a staff member, that staff member still cannot grant staff.manage to others)
- Do NOT create new tables -- `delegated_access` already exists
- Do NOT add columns to `delegated_access` -- follow the schema doc exactly
- Do NOT create a `rolePreset` column (it is in the User Model sketch but NOT in the Schema v2.0.7)

### Gotchas from Canonical Docs
1. **Schema inconsistency:** The User Model lists `rolePreset` and `invitedByUserId` as columns, but the Schema v2.0.7 does NOT include them. The Schema doc is the source of truth. Do NOT add these columns.
2. **Feature Lock-in scope names differ from Actors canonical scope names.** The Feature Lock-in section 26 uses `messages.reply`, `finances.view`, `refunds.request`, `refunds.initiate`, `payouts.view`, `payouts.manage`, `store.manage`, `crosslist.manage`. The Actors canonical section 3.4 uses `messages.send`, `finance.view`, `shipping.manage`, `settings.manage`, `staff.manage`. The CASL implementation in the codebase follows the Actors canonical. **Use the Actors canonical scope names** (which are already defined in `src/lib/casl/types.ts` as the `DelegationScope` type).
3. **`authorize()` is called on EVERY request.** The `getActiveDelegation()` query must be fast. Consider caching strategy in future, but for D5, the indexed query is sufficient.
4. **Delegation is per-seller, not per-store.** A seller can only have one delegation set. The `sellerId` FK points to `sellerProfile.id`, not to a storefront.
5. **The `userId` field on `delegated_access` has a NOT NULL FK constraint.** You cannot invite someone who does not have a Twicely account. Handle this in the invite action with a clear error message.

---

## 4. ACCEPTANCE CRITERIA

### Positive Cases
- [ ] AC-1: Owner with StoreTier PRO can invite a staff member by email
- [ ] AC-2: Invited user with existing Twicely account gets a PENDING delegation record created
- [ ] AC-3: Staff member can accept a pending invitation via `acceptInvitation` action
- [ ] AC-4: After acceptance, delegation status changes to ACTIVE and `acceptedAt` is set
- [ ] AC-5: Owner can view all staff members (PENDING, ACTIVE, REVOKED) in the staff table
- [ ] AC-6: Owner can edit scopes on an ACTIVE delegation
- [ ] AC-7: Owner can revoke an ACTIVE or PENDING delegation
- [ ] AC-8: Revoking sets status to REVOKED, `revokedAt` to now, `revokedByUserId` to owner
- [ ] AC-9: Role preset selector auto-fills correct scopes for each preset
- [ ] AC-10: Custom scope selection works independently of presets
- [ ] AC-11: `authorize()` function loads delegation context from DB instead of hardcoded nulls
- [ ] AC-12: A user with active delegation gets `delegationId`, `onBehalfOfSellerId`, and `delegatedScopes` populated in their CaslSession
- [ ] AC-13: Staff limits are enforced per StoreTier (PRO=5, POWER=25, ENTERPRISE=unlimited)
- [ ] AC-14: Platform setting `delegation.maxStaffPerSeller` caps the tier-based limit
- [ ] AC-15: The staff management page shows current count vs limit
- [ ] AC-16: All delegation mutations emit audit events

### Negative Cases
- [ ] AC-17: PERSONAL seller CANNOT access `/my/selling/staff` (FORBIDDEN)
- [ ] AC-18: NONE/STARTER StoreTier seller CANNOT access `/my/selling/staff` (TIER_BLOCKED with upgrade CTA)
- [ ] AC-19: Staff member (delegate) CANNOT access `/my/selling/staff` unless they have `staff.manage` scope -- but for D5, page gate is OWNER_ONLY so delegates never reach it
- [ ] AC-20: Unauthenticated user CANNOT access `/my/selling/staff` (redirect to login)
- [ ] AC-21: Owner CANNOT invite more staff than their tier allows
- [ ] AC-22: Owner CANNOT invite an email that does not correspond to an existing Twicely user (clear error message)
- [ ] AC-23: Owner CANNOT invite the same email twice (if active/pending delegation exists)
- [ ] AC-24: Staff CANNOT modify their own delegation (cannot call `updateStaffScopes` or `revokeStaffMember` on their own record)
- [ ] AC-25: Invalid scopes are rejected by Zod validation
- [ ] AC-26: `delegationId` and `sellerId` are NEVER read from request body -- always from session

### Data Integrity
- [ ] AC-27: All monetary values (if any) stored as integer cents
- [ ] AC-28: All delegation records have valid CUID2 IDs
- [ ] AC-29: `scopes` array contains only values from the `DelegationScope` type
- [ ] AC-30: `revokedByUserId` is only set when status transitions to REVOKED

### Vocabulary Checks
- [ ] AC-31: No banned terms appear in UI copy or code comments
- [ ] AC-32: Route paths use `/my/selling/staff` (not `/dashboard/staff`, not `/admin/staff`)
- [ ] AC-33: StoreTier names use NONE/STARTER/PRO/POWER/ENTERPRISE (not BASIC/ELITE/PREMIUM)

---

## 5. TEST REQUIREMENTS

### Unit Tests

**File: `src/lib/actions/__tests__/delegation.test.ts`**

```
describe('inviteStaffMember', () => {
  it('creates PENDING delegation for valid email with existing user')
  it('rejects if caller is not authenticated')
  it('rejects if caller is a delegate (not owner)')
  it('rejects if seller StoreTier is NONE or STARTER')
  it('rejects if staff limit is reached for tier')
  it('rejects if email is already invited (active/pending)')
  it('rejects if email does not match an existing user')
  it('rejects invalid scopes')
  it('validates input with Zod strict schema')
})

describe('updateStaffScopes', () => {
  it('updates scopes on active delegation owned by caller')
  it('rejects if delegation belongs to different seller')
  it('rejects if delegation status is not ACTIVE')
  it('rejects if caller is not owner')
  it('rejects invalid scopes')
})

describe('revokeStaffMember', () => {
  it('revokes active delegation and sets revokedAt + revokedByUserId')
  it('revokes pending delegation')
  it('rejects if delegation belongs to different seller')
  it('rejects if delegation already revoked')
  it('rejects if caller is not owner')
})

describe('acceptInvitation', () => {
  it('accepts pending invitation and sets ACTIVE + acceptedAt')
  it('rejects if invitation not found')
  it('rejects if invitation already accepted')
  it('rejects if invitation expired')
  it('rejects if userId does not match invitation')
})
```

**File: `src/lib/queries/__tests__/delegation.test.ts`**

```
describe('getStaffMembers', () => {
  it('returns all delegation records for a seller with user join')
  it('returns empty array for seller with no staff')
  it('orders by createdAt desc')
})

describe('getActiveDelegation', () => {
  it('returns active delegation for user')
  it('returns null if no active delegation')
  it('returns null if delegation is expired')
  it('returns null if delegation is revoked')
  it('auto-expires delegation past expiresAt')
})

describe('getStaffCountForSeller', () => {
  it('counts only ACTIVE and PENDING delegations')
  it('does not count REVOKED or EXPIRED')
})
```

### Edge Cases to Cover
- User invites themselves (own email) -- should be rejected
- User with multiple delegations from different sellers -- `getActiveDelegation` returns most recent
- Race condition: two owners invite the same user simultaneously -- unique constraint or check-and-insert handles this
- Delegation expires between creation and acceptance -- `acceptInvitation` must check `expiresAt`
- Revoking a PENDING invitation (before acceptance) -- should work, set to REVOKED

---

## 6. FILE APPROVAL LIST

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/queries/delegation.ts` | Delegation queries (getStaffMembers, getActiveDelegation, getDelegationById, getStaffCountForSeller, getPendingInvitations) |
| 2 | `src/lib/actions/delegation.ts` | Server actions (inviteStaffMember, updateStaffScopes, revokeStaffMember, acceptInvitation) |
| 3 | `src/lib/queries/__tests__/delegation.test.ts` | Query unit tests |
| 4 | `src/lib/actions/__tests__/delegation.test.ts` | Action unit tests |
| 5 | `src/lib/casl/authorize.ts` | UPDATE: Load delegation context from DB instead of hardcoded nulls |
| 6 | `src/app/(hub)/my/selling/staff/page.tsx` | Staff management page (server component) |
| 7 | `src/app/(hub)/my/selling/staff/invite/page.tsx` | Invite staff page (server component) |
| 8 | `src/components/delegation/staff-table.tsx` | Client component: staff list table with edit/revoke actions |
| 9 | `src/components/delegation/scope-selector.tsx` | Client component: scope checkbox group with role presets |
| 10 | `src/components/delegation/invite-form.tsx` | Client component: invite staff form |
| 11 | `src/components/delegation/edit-scopes-dialog.tsx` | Client component: dialog for editing staff scopes |
| 12 | `src/lib/delegation/constants.ts` | Delegation constants: ROLE_PRESETS, SCOPE_CATEGORIES, SCOPE_LABELS, TIER_STAFF_LIMITS |
| 13 | `src/lib/db/seed/seed-delegation-settings.ts` | Seed module for 3 delegation platform settings |

---

## 7. PARALLEL STREAMS

This feature has 13 files across 3 independent sub-tasks. Decompose into 3 parallel streams.

### Dependency Graph

```
Stream A: Constants + Queries + authorize() update
Stream B: Server Actions (depends on Stream A queries)
Stream C: Pages + Components (depends on Stream A constants, Stream B action signatures)

    ┌──────────────┐
    │  Stream A     │
    │  Constants    │
    │  Queries      │
    │  authorize()  │
    └──────┬───────┘
           │
    ┌──────┴───────┐
    │  Stream B     │
    │  Actions      │
    │  Action Tests │
    └──────┬───────┘
           │
    ┌──────┴───────┐
    │  Stream C     │
    │  Pages        │
    │  Components   │
    │  Seed         │
    └──────────────┘
```

### Stream A: Data Layer (Constants + Queries + Authorize Update)

**Files:** #1, #3, #5, #12

**Task A.1: Create constants file**

File: `src/lib/delegation/constants.ts`

```typescript
import type { DelegationScope } from '@/lib/casl/types';

// Role presets from Actors canonical section 3.4
export const ROLE_PRESETS = {
  MANAGER: [
    'dashboard.view', 'listings.view', 'listings.manage',
    'orders.view', 'orders.manage', 'shipping.manage',
    'returns.respond', 'messages.view', 'messages.send',
    'finance.view', 'analytics.view', 'promotions.view',
    'promotions.manage', 'settings.view', 'settings.manage',
  ] as DelegationScope[],
  FULFILLMENT: [
    'dashboard.view', 'orders.view', 'orders.manage',
    'shipping.manage', 'messages.view', 'messages.send',
  ] as DelegationScope[],
  FINANCE: [
    'dashboard.view', 'finance.view', 'orders.view', 'analytics.view',
  ] as DelegationScope[],
  SUPPORT: [
    'dashboard.view', 'orders.view', 'returns.respond',
    'messages.view', 'messages.send',
  ] as DelegationScope[],
  READ_ONLY: [
    'dashboard.view', 'listings.view', 'orders.view',
    'finance.view', 'analytics.view', 'messages.view', 'settings.view',
  ] as DelegationScope[],
} as const;

export type RolePreset = keyof typeof ROLE_PRESETS;

// All valid delegation scopes (must match DelegationScope type exactly)
export const ALL_SCOPES: DelegationScope[] = [
  'dashboard.view', 'listings.view', 'listings.manage',
  'orders.view', 'orders.manage', 'shipping.manage',
  'returns.respond', 'messages.view', 'messages.send',
  'finance.view', 'analytics.view', 'promotions.view',
  'promotions.manage', 'settings.view', 'settings.manage',
  'staff.manage',
];

// Scope display labels
export const SCOPE_LABELS: Record<DelegationScope, string> = {
  'dashboard.view': 'View dashboard',
  'listings.view': 'View listings',
  'listings.manage': 'Manage listings',
  'orders.view': 'View orders',
  'orders.manage': 'Manage orders',
  'shipping.manage': 'Manage shipping',
  'returns.respond': 'Respond to returns',
  'messages.view': 'View messages',
  'messages.send': 'Send messages',
  'finance.view': 'View finances',
  'analytics.view': 'View analytics',
  'promotions.view': 'View promotions',
  'promotions.manage': 'Manage promotions',
  'settings.view': 'View store settings',
  'settings.manage': 'Manage store settings',
  'staff.manage': 'Manage staff',
};

// Scope groupings for UI
export const SCOPE_CATEGORIES = [
  { label: 'Dashboard', scopes: ['dashboard.view'] as DelegationScope[] },
  { label: 'Listings', scopes: ['listings.view', 'listings.manage'] as DelegationScope[] },
  { label: 'Orders', scopes: ['orders.view', 'orders.manage'] as DelegationScope[] },
  { label: 'Shipping', scopes: ['shipping.manage'] as DelegationScope[] },
  { label: 'Returns', scopes: ['returns.respond'] as DelegationScope[] },
  { label: 'Messages', scopes: ['messages.view', 'messages.send'] as DelegationScope[] },
  { label: 'Finance', scopes: ['finance.view'] as DelegationScope[] },
  { label: 'Analytics', scopes: ['analytics.view'] as DelegationScope[] },
  { label: 'Promotions', scopes: ['promotions.view', 'promotions.manage'] as DelegationScope[] },
  { label: 'Store Settings', scopes: ['settings.view', 'settings.manage'] as DelegationScope[] },
  { label: 'Staff', scopes: ['staff.manage'] as DelegationScope[] },
] as const;

// Staff limits per StoreTier (from User Model section 4.1)
export const TIER_STAFF_LIMITS: Record<string, number> = {
  NONE: 0,
  STARTER: 0,
  PRO: 5,
  POWER: 25,
  ENTERPRISE: 999, // Effectively unlimited, capped by platform setting
};
```

**Task A.2: Create queries file**

File: `src/lib/queries/delegation.ts`

Implement `getStaffMembers`, `getActiveDelegation`, `getDelegationById`, `getStaffCountForSeller`, `getPendingInvitations` as specified in section 2.4.

Types needed (inline in the file):

```typescript
export type StaffMember = {
  id: string;
  userId: string;
  email: string;
  name: string;
  scopes: string[];
  status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type ActiveDelegation = {
  delegationId: string;
  sellerId: string;
  scopes: string[];
  ownerUserId: string;
  ownerName: string;
};

export type DelegationRecord = {
  id: string;
  sellerId: string;
  userId: string;
  email: string;
  scopes: string[];
  status: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  expiresAt: Date | null;
};

export type PendingInvitation = {
  id: string;
  sellerId: string;
  ownerName: string;
  scopes: string[];
  invitedAt: Date;
};
```

**Task A.3: Update authorize.ts**

File: `src/lib/casl/authorize.ts` (MODIFY)

Replace the hardcoded delegation nulls with a call to `getActiveDelegation(user.id)`. Import from `src/lib/queries/delegation.ts`.

**Task A.4: Create query tests**

File: `src/lib/queries/__tests__/delegation.test.ts`

Test all 5 queries as specified in section 5.

### Stream B: Server Actions

**Files:** #2, #4

Depends on: Stream A (queries must exist for actions to import).

**Task B.1: Create actions file**

File: `src/lib/actions/delegation.ts`

Implement all 4 actions as specified in section 2.3. Each action:
1. Uses `'use server'` directive
2. Validates input with Zod strict schema
3. Calls `authorize()` to get session + ability
4. Checks CASL permissions with `ability.can()` + `sub()`
5. Performs the mutation
6. Calls `revalidatePath` where appropriate
7. Returns `{ success: boolean; error?: string }` or `{ success: boolean; delegationId?: string }`

Key imports:
```typescript
import { authorize, ForbiddenError, sub } from '@/lib/casl';
import { getStaffCountForSeller, getDelegationById } from '@/lib/queries/delegation';
import { delegatedAccess } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { ALL_SCOPES, TIER_STAFF_LIMITS } from '@/lib/delegation/constants';
```

For the staff limit check, the action must:
1. Load the seller's `storeTier` from `sellerProfile`
2. Look up `TIER_STAFF_LIMITS[storeTier]` for the tier-based limit
3. Read `delegation.maxStaffPerSeller` from `platform_settings` table
4. Use `Math.min(tierLimit, platformMax)` as the effective limit

For the email-to-user lookup:
```typescript
const [existingUser] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, input.email))
  .limit(1);

if (!existingUser) {
  return { success: false, error: 'No Twicely account found for this email. The person must create an account first.' };
}
```

**Task B.2: Create action tests**

File: `src/lib/actions/__tests__/delegation.test.ts`

Test all 4 actions as specified in section 5.

### Stream C: UI Layer (Pages + Components + Seed)

**Files:** #6, #7, #8, #9, #10, #11, #13

Depends on: Stream A (constants for scope labels/presets), Stream B (action function signatures for form submission).

**Task C.1: Create seed module**

File: `src/lib/db/seed/seed-delegation-settings.ts`

Pattern from existing seeds: export an async function, use `.onConflictDoNothing()`, use `seed-delegation-` ID prefix.

```typescript
import { db } from '@/lib/db';
import { platformSetting } from '@/lib/db/schema';

export async function seedDelegationSettings() {
  await db.insert(platformSetting).values([
    {
      id: 'seed-delegation-001',
      key: 'delegation.maxStaffPerSeller',
      value: '10',
      type: 'INTEGER',
      category: 'delegation',
      label: 'Max staff per seller',
      description: 'Platform-wide maximum staff members per seller (capped by tier limit)',
      editable: true,
    },
    {
      id: 'seed-delegation-002',
      key: 'delegation.require2faForHighRisk',
      value: 'true',
      type: 'BOOLEAN',
      category: 'delegation',
      label: 'Require 2FA for high-risk scope grants',
      description: 'Owner must have 2FA enabled to grant refunds.initiate or payouts.manage scopes',
      editable: true,
    },
    {
      id: 'seed-delegation-003',
      key: 'delegation.payoutChangeHoldHours',
      value: '72',
      type: 'INTEGER',
      category: 'delegation',
      label: 'Payout change hold hours (delegated)',
      description: 'Hold period after a delegated staff member changes payout destination',
      editable: true,
    },
  ]).onConflictDoNothing();
}
```

Also update the orchestrator `src/lib/db/seed.ts` to import and call this module.

**Task C.2: Create ScopeSelector component**

File: `src/components/delegation/scope-selector.tsx`

Client component. Props:
```typescript
type ScopeSelectorProps = {
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
};
```

Renders grouped checkboxes from `SCOPE_CATEGORIES` constant. Includes a role preset dropdown that auto-fills scopes. Changing any checkbox after selecting a preset shows "Custom" in the dropdown.

**Task C.3: Create InviteForm component**

File: `src/components/delegation/invite-form.tsx`

Client component with `'use client'` directive. Uses `ScopeSelector`. Calls `inviteStaffMember` action on submit. Shows success/error toast.

**Task C.4: Create StaffTable component**

File: `src/components/delegation/staff-table.tsx`

Client component. Renders table of staff members. Each row has edit and revoke actions.

**Task C.5: Create EditScopesDialog component**

File: `src/components/delegation/edit-scopes-dialog.tsx`

Client component. Modal dialog with `ScopeSelector` for editing scopes on an existing delegation. Calls `updateStaffScopes` action.

**Task C.6: Create staff page**

File: `src/app/(hub)/my/selling/staff/page.tsx`

Server component. Authorization flow:
1. `authorize()` -- redirect if not authenticated
2. Check session is owner (not delegate)
3. Load seller profile -- check storeTier >= PRO
4. If tier blocked, show upgrade CTA
5. Call `getStaffMembers(session.sellerId!)`
6. Render `StaffTable` with data

**Task C.7: Create invite page**

File: `src/app/(hub)/my/selling/staff/invite/page.tsx`

Server component. Same auth/tier checks as staff page. Renders `InviteForm`.

### Merge Verification

After all three streams are complete, verify:

1. `authorize()` correctly loads delegation from DB (run existing CASL staff tests -- they should still pass)
2. Staff management page renders with data from queries
3. Invite flow creates PENDING record
4. Edit scopes updates record
5. Revoke flow sets REVOKED status
6. Tier gating prevents NONE/STARTER from accessing staff pages
7. Run full test suite -- test count must be >= BASELINE_TESTS (1034)
8. Run `pnpm typecheck` -- must be 0 errors
9. Run banned terms grep -- must be 0 hits

---

## 8. VERIFICATION CHECKLIST

After implementation, run ALL of these and report the raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Full test suite
pnpm test

# 3. Banned terms check
./twicely-lint.sh

# 4. Files created/modified (with line counts)
# List every file and its line count

# 5. Route prefix check -- verify no banned route patterns
# grep for /dashboard, /admin, /store/, /listing/, /l/
```

### Expected Outcomes
- TypeScript: 0 errors
- Tests: >= 1034 (baseline) + new delegation tests (expect ~25-30 new tests)
- Banned terms: 0 occurrences
- Files over 300 lines: 0
- All route paths use `/my/selling/staff` prefix
- No `as any`, `@ts-ignore`, `@ts-expect-error` in any new files
- `delegationId` and `sellerId` are never read from request body in any action
- All monetary values (if any) in integer cents
- All IDs are CUID2

---

## 9. SPEC INCONSISTENCIES (Flagged for Owner)

### Inconsistency 1: `rolePreset` column

The User Model (section 8) defines `DelegatedAccess` with a `rolePreset` field: `MANAGER | FULFILLMENT | FINANCE | SUPPORT | READ_ONLY | CUSTOM`. The Schema v2.0.7 does NOT include this column on the `delegated_access` table. The schema doc is the source of truth. This install prompt does NOT add `rolePreset` to the table. Role presets are UI-only convenience -- the `scopes` array is what is stored and evaluated.

**Owner action needed:** If you want `rolePreset` persisted, add it to the schema doc and generate a migration. Otherwise, leave it as UI-only.

### Inconsistency 2: `invitedByUserId` column

The User Model sketch includes `invitedByUserId` on `DelegatedAccess`. The Schema v2.0.7 does NOT include this column. This install prompt does NOT add it.

**Owner action needed:** If you want audit trail of who sent the invitation (relevant when staff.manage delegates can invite), add to schema. For D5, the owner is always the inviter (OWNER_ONLY page gate), so this is implicitly `session.userId`.

### Inconsistency 3: Scope name differences between Feature Lock-in and Actors Canonical

The Feature Lock-in section 26 lists scopes like `messages.reply`, `finances.view`, `refunds.request`, `refunds.initiate`, `payouts.view`, `payouts.manage`, `store.manage`, `crosslist.manage`. The Actors canonical section 3.4 and the CASL implementation use different names: `messages.send`, `finance.view`, `settings.manage`, `staff.manage`. The codebase already implements the Actors canonical version. This install prompt follows the codebase implementation.

### Inconsistency 4: Default staff limit vs tier-based limits

The Feature Lock-in section 26 says `delegation.maxStaffPerSeller: 10 (default)`. The User Model section 4.1 has tier-specific limits: PRO=5, POWER=25, ENTERPRISE=unlimited. The platform setting acts as a platform-wide cap. The actual per-seller limit is `min(tierLimit, platformSetting)`. This means with the default setting of 10, PRO sellers get 5 (tier limit is lower) and POWER sellers get 10 (platform cap is lower than 25). This may be intentional or may need adjustment. Flagging for owner review.

### Inconsistency 5: Staff page access for staff.manage delegates

The Page Registry entry 66 says `/my/selling/staff` gate is `OWNER_ONLY`. The CASL rules in the Actors canonical give staff with `staff.manage` scope the ability to `manage DelegatedAccess`. These are in tension: the route says owner-only but the permission system allows staff.manage holders. This install prompt follows the Page Registry (OWNER_ONLY) for the D5 implementation. If the owner wants staff.manage delegates to access the page, the page gate should be updated.

### Inconsistency 6: Invite non-registered users

The Feature Lock-in section 26 says "Staff member creates their own Twicely account (or uses existing one)" implying invitations to non-users should be possible. The schema has `userId NOT NULL` with FK to user table, making it impossible to store a delegation for a non-existent user. This install prompt requires the invitee to have an existing account. See section 2.3 for the decision rationale.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-02 | Initial D5 install prompt. Full delegation feature. |
