# [I2] User Management Enrichment -- Admin Panel V2-to-V3 Port

**Phase:** I (Admin Panel V2-to-V3 Port)
**Step:** I2
**Feature:** User Management Enrichment
**Summary:** Enrich the existing hub user management pages from skeleton to full-featured admin panel: tabbed user detail with performance/finance/activity data, seller management table, identity verification queue, and admin create-user form.
**Estimated Time:** 5 sub-steps, ~30-60 min each (~3.5 hours total)

**Canonical Sources -- READ ALL BEFORE STARTING:**
- `TWICELY_V3_SCHEMA_v2_1_0.md` -- Tables: user (S2.1), sellerProfile (S2.3), businessInfo (S2.4), storeSubscription (S3.1), listerSubscription (S3.2), sellerBalance (S11.2), address (S2.5), storefront (S2.5b), delegatedAccess (S3.5), order, listing, helpdeskCase, auditEvent, payout, ledgerEntry
- `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` -- Platform Agent + Admin CASL rules (S3.5-3.6), User subject permissions, admin override controls
- `TWICELY_V3_USER_MODEL.md` -- Single account rule (S1), seller capability model (S3), three independent axes (S4), business metadata (S6), ownership model (S5)
- `TWICELY_V3_PAGE_REGISTRY.md` -- Hub user routes (S8.3, rows #86-87b), user detail tabs, user detail actions
- `TWICELY_V3_SELLER_SCORE_CANONICAL.md` -- Performance bands (S3), hub admin view (S9), band overrides (S9.3), enforcement levels (S6)
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` -- Identity Verification S45 (4 levels, 5 triggers, verification flow, status effects)
- `TWICELY_V3_TESTING_STANDARDS.md` -- Test patterns, mock conventions

---

## 1. PREREQUISITES

### Must Be Complete Before Starting
- Phase A-G (all 183 steps COMPLETE)
- Phase H1.1+ (crosslister extension -- started)
- No hard dependency on I1 (Categories & Catalog) -- can run in parallel

### Tables That Already Exist (verified in codebase)
| Table | Schema File | Key Columns for I2 |
|-------|-------------|-------------------|
| `user` | `identity.ts` | id, name, email, emailVerified, username, displayName, phone, phoneVerified, avatarUrl, isSeller, isBanned, bannedAt, bannedReason, buyerQualityTier, marketingOptIn, creditBalanceCents, deletionRequestedAt, createdAt |
| `sellerProfile` | `identity.ts` | id (CUID2 PK), userId (FK unique), sellerType, storeTier, listerTier, bundleTier, hasAutomation, financeTier, performanceBand, status, payoutsEnabled, trustScore, stripeAccountId, stripeOnboarded, stripeCustomerId, handlingTimeDays, vacationMode, activatedAt, verifiedAt, sellerScore (int 0-1000), sellerScoreUpdatedAt, isNew, enforcementLevel, enforcementStartedAt, warningExpiresAt, bandOverride, bandOverrideExpiresAt, bandOverrideReason, bandOverrideBy, boostCreditCents |
| `businessInfo` | `identity.ts` | id, userId (FK unique), businessName, businessType, ein (encrypted), address1, city, state, zip, country, phone, website |
| `storeSubscription` | `subscriptions.ts` | id, sellerProfileId (FK unique), tier, status, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd, trialEndsAt |
| `listerSubscription` | `subscriptions.ts` | id, sellerProfileId (FK unique), tier, status, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd |
| `delegatedAccess` | `subscriptions.ts` | id, sellerId (FK to sellerProfile.id), userId, email, scopes, status |
| `sellerBalance` | `finance.ts` | userId (PK), pendingCents, availableCents, reservedCents |
| `order` | commerce schema | id, orderNumber, status, totalCents, buyerId, sellerId, createdAt |
| `listing` | listings schema | id, title, status, priceCents, slug, ownerUserId, createdAt |
| `helpdeskCase` | helpdesk schema | id, requesterId, subject, status, priority, createdAt |
| `ledgerEntry` | `finance.ts` | id, userId, type, amountCents, status, createdAt |
| `payout` | `finance.ts` | id, userId, amountCents, status, createdAt |
| `auditEvent` | `platform.ts` | id, actorType, actorId, action, subject, subjectId, severity, detailsJson, createdAt |
| `address` | `identity.ts` | id, userId, label, city, state, zip, isDefault |
| `storefront` | `identity.ts` | id, ownerUserId, slug, name, isPublished |

### Tables That DO NOT Exist (verified gaps)
| Missing Table | Referenced In | Impact on I2 |
|---------------|--------------|-------------|
| `identity_verification` | Feature Lock-in S45, Seller Score Canonical | Verification queue (I2.4) must use best-effort approach with `sellerProfile.verifiedAt` |
| `seller_performance_snapshots` | Seller Score Canonical S10.3 | No score history charts -- display only current `sellerProfile.sellerScore` |
| `seller_score_overrides` | Seller Score Canonical S10.4 | Band override writes directly to `sellerProfile.bandOverride*` fields (which DO exist) |

### Existing Code to Build On (DO NOT recreate)
| File | Lines | Contents |
|------|-------|----------|
| `src/app/(hub)/usr/page.tsx` | 107 | Basic user list with search + status filter |
| `src/app/(hub)/usr/[id]/page.tsx` | 111 | Basic user detail with 3 stat cards + orders table |
| `src/lib/queries/admin-users.ts` | 226 | 6 query functions: getAdminUserList, getAdminUserDetail, getAdminUserOrders, getAdminUserListings, getAdminUserCases, getAdminUserFinance, getAdminUserActivity |
| `src/lib/actions/admin-users.ts` | 131 | 4 server actions: suspendUserAction, unsuspendUserAction, restrictSellingAction, warnUserAction |
| `src/components/admin/actions/user-actions.tsx` | 105 | Client component with suspend/warn/impersonate buttons |
| `src/components/admin/admin-page-header.tsx` | 27 | Reusable page header with title, description, actions slot |

### CASL Permission Map (verified in code)
| Role | User read | User create | User update | User impersonate | SellerProfile update | Payout read |
|------|-----------|-------------|-------------|------------------|---------------------|-------------|
| SUPER_ADMIN | YES (wildcard) | YES | YES | YES | YES | YES |
| ADMIN | YES (wildcard) | YES | YES | YES | YES | YES |
| SUPPORT | YES (explicit) | NO | NO | NO | NO | NO |
| FINANCE | YES (explicit) | NO | NO | NO | NO | YES (explicit) |
| MODERATION | YES (explicit) | NO | NO | NO | YES (explicit) | NO |
| HELPDESK_* | YES (explicit) | NO | NO | NO | NO | NO |

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### Sub-step Sequencing
- **I2.1** (Queries + Actions) -- do first, provides data layer for all pages
- **I2.2** (Enriched User Detail Page) -- depends on I2.1
- **I2.3** (Seller Management Page) -- can parallel with I2.2 after I2.1
- **I2.4** (Verification Queue) -- can parallel with I2.2 after I2.1
- **I2.5** (Create User Page) -- can parallel with I2.2 after I2.1

---

### I2.1 -- Enriched Queries & Actions (~45 min)

**Goal:** Extend existing query and action files to support the full user detail page, seller list, and verification queue.

#### File Size Management

`admin-users.ts` queries is at 226 lines. Adding all new queries would exceed 300. Split:
- **Keep** `admin-users.ts` for user-focused queries (user list, user detail, orders, listings, cases, activity)
- **Create** `admin-sellers.ts` for seller-specific queries (seller list, verification queue)

`admin-users.ts` actions is at 131 lines. New actions would push it over 300. Split:
- **Keep** `admin-users.ts` actions for existing suspend/unsuspend/restrict/warn
- **Create** `admin-users-management.ts` for new actions (create user, hold/release payouts, reset password, override band, add note)

#### Queries to MODIFY in `src/lib/queries/admin-users.ts`

**1. `getAdminUserDetail()` -- ENRICH**

Currently returns 12 fields. Must return complete data. New return type:

```typescript
interface UserDetailFull {
  // User fields
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  isSeller: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedReason: string | null;
  buyerQualityTier: string;
  marketingOptIn: boolean;
  creditBalanceCents: number;
  deletionRequestedAt: Date | null;
  createdAt: Date;

  // Seller data (null if not a seller)
  seller: {
    id: string;                    // sellerProfile.id (CUID2 PK -- NOT userId)
    sellerType: string;
    storeTier: string;
    listerTier: string;
    bundleTier: string;
    hasAutomation: boolean;
    financeTier: string;
    performanceBand: string;
    sellerScore: number;           // integer 0-1000
    trustScore: number;
    status: string;                // ACTIVE | RESTRICTED | SUSPENDED
    payoutsEnabled: boolean;
    stripeAccountId: string | null; // MASKED: show last 4 chars only
    stripeOnboarded: boolean;
    handlingTimeDays: number;
    vacationMode: boolean;
    activatedAt: Date | null;
    verifiedAt: Date | null;
    enforcementLevel: string | null;
    warningExpiresAt: Date | null;
    bandOverride: string | null;
    bandOverrideExpiresAt: Date | null;
    bandOverrideReason: string | null;
    boostCreditCents: number;
    isNew: boolean;
  } | null;

  // Business info (null if not BUSINESS type)
  business: {
    businessName: string;
    businessType: string;
    city: string;
    state: string;
    country: string;
    phone: string | null;
    website: string | null;
  } | null;

  // Store subscription (null if no active store sub)
  storeSubscription: {
    tier: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
    trialEndsAt: Date | null;
  } | null;

  // Lister subscription (null if no active lister sub)
  listerSubscription: {
    tier: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;

  // Balance (null if no sellerBalance record)
  balance: {
    pendingCents: number;
    availableCents: number;
    reservedCents: number;
  } | null;

  // Addresses
  addresses: Array<{
    id: string;
    label: string | null;
    city: string;
    state: string;
    zip: string;
    isDefault: boolean;
  }>;

  // Storefront (null if none)
  storefront: {
    slug: string | null;
    name: string | null;
    isPublished: boolean;
  } | null;
}
```

**Implementation notes:**
- Use `Promise.all` to parallelize seller profile, business info, subscriptions, balance, addresses, and storefront queries (6 independent queries after initial user fetch)
- Subscriptions join through `sellerProfile.id` to `storeSubscription.sellerProfileId` and `listerSubscription.sellerProfileId` -- NOT through userId
- EIN must NEVER be returned. Omit `ein` from the businessInfo select entirely.
- `stripeAccountId` must be masked before return: if non-null, return `acct_****${id.slice(-4)}`
- `sellerProfile.id` is a CUID2 PK -- this is NOT the same as `user.id`. Return it as `seller.id` for reference but NEVER use it as an ownership key.

**2. `getAdminUserList()` -- ENRICH with seller join**

Add optional left join on `sellerProfile` to return seller-specific columns in the list:
- Add return fields: `sellerType`, `storeTier`, `performanceBand` (all nullable for non-sellers)
- Add filter params: `sellerType?: string`, `storeTier?: string`, `performanceBand?: string`
- Add sort param: `sort?: 'newest' | 'oldest' | 'name'` (default: 'newest')

#### New file: `src/lib/queries/admin-sellers.ts`

**3. `getAdminSellerList()`** -- Paginated seller-only list

```typescript
interface AdminSellerListOpts {
  page: number;
  pageSize: number;
  search?: string;
  sellerType?: 'PERSONAL' | 'BUSINESS';
  storeTier?: string;
  listerTier?: string;
  performanceBand?: string;
  status?: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';
  sort?: 'newest' | 'oldest' | 'name' | 'score';
}

interface SellerListItem {
  userId: string;
  name: string;
  email: string;
  sellerType: string;
  storeTier: string;
  listerTier: string;
  performanceBand: string;
  sellerScore: number;
  status: string;
  availableCents: number;
  activatedAt: Date | null;
  verifiedAt: Date | null;
  stripeOnboarded: boolean;
}
```

SQL: `INNER JOIN sellerProfile ON sellerProfile.userId = user.id` (only sellers). `LEFT JOIN sellerBalance ON sellerBalance.userId = user.id` for balance. Apply filter conditions. `availableCents` defaults to 0 via `COALESCE`.

**4. `getAdminVerificationQueue()`** -- Sellers needing verification

Since `identity_verification` table does NOT exist, use best-effort approach:

```typescript
interface VerificationQueueItem {
  userId: string;
  name: string;
  email: string;
  sellerType: string;
  storeTier: string;
  verifiedAt: Date | null;
  status: string;              // sellerProfile.status
  enforcementLevel: string | null;
  activatedAt: Date | null;
}
```

Criteria:
- `sellerProfile.storeTier IN ('PRO', 'POWER', 'ENTERPRISE') AND sellerProfile.verifiedAt IS NULL` -- sellers needing enhanced verification per Feature Lock-in S45 trigger: "Seller applies for Store Pro+"
- `sellerProfile.status = 'RESTRICTED'` -- sellers under enforcement review
- Sort: unverified high-tier sellers first, then restricted sellers, by `createdAt DESC`

#### New file: `src/lib/actions/admin-users-management.ts`

All actions follow the established pattern: `'use server'` directive, Zod `.strict()` validation, `staffAuthorize()`, CASL check, explicit field mapping, audit event.

**5. `createUserAction()`**
- CASL: `ability.can('create', 'User')`
- Schema:
  ```typescript
  const createUserSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(255),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  }).strict();
  ```
- Check email uniqueness against `user` table (select count where email = input.email)
- Check username uniqueness if provided
- Generate CUID2 for `id` using `createId()` from `@paralleldrive/cuid2`
- Insert into `user`: `{ id, name, email, emailVerified: false, isSeller: false, isBanned: false, createdAt: new Date(), updatedAt: new Date() }` plus optional `username`
- Audit event: `CREATE_USER`, severity: `HIGH`, details: `{ email, name }`
- Return `{ success: true, userId: id }` on success

**NOT SPECIFIED -- owner decision needed:** Better Auth normally manages user creation. Admin-created users bypass this. Use direct DB insert (no password set). User must use "Forgot Password" flow to set their initial password. An alternative would be to use Better Auth's server-side API if available, but this is not documented.

**6. `holdPayoutsAction()`**
- CASL: `ability.can('update', 'SellerProfile')`
- Schema: `{ userId: z.string().min(1), reason: z.string().min(1).max(500) }.strict()`
- Update: `sellerProfile.payoutsEnabled = false` where `userId = input.userId`
- Audit: `HOLD_PAYOUTS`, severity: `HIGH`, details: `{ reason }`

**7. `releasePayoutsAction()`**
- CASL: `ability.can('update', 'SellerProfile')`
- Schema: `{ userId: z.string().min(1) }.strict()`
- Update: `sellerProfile.payoutsEnabled = true` where `userId = input.userId`
- Audit: `RELEASE_PAYOUTS`, severity: `HIGH`

**8. `overridePerformanceBandAction()`**
- CASL: `ability.can('update', 'SellerProfile')`
- Schema:
  ```typescript
  const overrideBandSchema = z.object({
    userId: z.string().min(1),
    newBand: z.enum(['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']),
    reason: z.string().min(1).max(500),
    expiresInDays: z.number().int().min(1).max(90).optional().default(90),
  }).strict();
  ```
- `SUSPENDED` is NOT allowed as `newBand` -- it is an enforcement action, not a score-based override (Seller Score Canonical S3.2)
- First fetch current `performanceBand` for the audit trail
- Update sellerProfile: `bandOverride = newBand`, `performanceBand = newBand`, `bandOverrideReason = reason`, `bandOverrideBy = session.staffUserId`, `bandOverrideExpiresAt = now + expiresInDays`
- Audit: `OVERRIDE_PERFORMANCE_BAND`, severity: `HIGH`, details: `{ previousBand, newBand, reason, expiresAt }`
- Per Seller Score Canonical S9.3: "All overrides are logged with: admin userId, previous band, new band, reason, timestamp. Overrides expire after 90 days."

**9. `addInternalNoteAction()`**
- CASL: `ability.can('update', 'User')`
- Schema: `{ userId: z.string().min(1), content: z.string().min(1).max(2000) }.strict()`
- Insert `auditEvent` with `action: 'ADMIN_NOTE'`, `subject: 'User'`, `subjectId: userId`, `severity: 'LOW'`, `detailsJson: { content }`
- Per Page Registry "Notes" tab: internal staff notes stored as audit events

**10. `resetPasswordAction()`**
- CASL: `ability.can('update', 'User')`
- Schema: `{ userId: z.string().min(1) }.strict()`
- Lookup user email from `user` table
- Trigger password reset (see "NOT SPECIFIED" below)
- Audit: `ADMIN_RESET_PASSWORD`, severity: `HIGH`, details: `{ targetEmail: maskedEmail }`

**NOT SPECIFIED -- owner decision needed:** The mechanism for triggering a password reset from the server side depends on Better Auth's API surface. If Better Auth exposes a `sendResetEmail(email)` server function, use that. Otherwise, create a `verification` record in the database and send the reset email manually via React Email + Resend. For now, implement as audit event creation only -- the actual email sending can be wired when the email system is connected.

---

### I2.2 -- Enriched User Detail Page (Tabbed) (~60 min)

**Route:** `/usr/[id]` (EXISTING -- REPLACE page content)
**Gate:** `STAFF(ADMIN, SUPPORT)`
**Layout:** `hub`

#### Tab Structure (per Page Registry S8.3)

Tabs implemented as URL search params: `?tab=overview|orders|listings|cases|finance|activity|notes`. Default: `overview`.

| Tab | Data Source | Visible To |
|-----|-----------|-----------|
| Overview | `getAdminUserDetail()` enriched | All staff with `can('read', 'User')` |
| Orders | `getAdminUserOrders()` existing | All staff with `can('read', 'User')` |
| Listings | `getAdminUserListings()` existing | All staff with `can('read', 'User')` |
| Cases | `getAdminUserCases()` existing | All staff with `can('read', 'User')` |
| Finance | `getAdminUserFinance()` existing | Staff with `can('read', 'Payout')` (ADMIN, FINANCE only) |
| Activity | `getAdminUserActivity()` existing | All staff with `can('read', 'User')` |
| Notes | Audit events with action `ADMIN_NOTE` | Staff with `can('update', 'User')` (ADMIN only) |

#### Page Architecture

The page.tsx is a server component that:
1. Calls `staffAuthorize()`
2. Resolves params.id, fetches user header data (always needed: name, email, status badges)
3. Reads `tab` from searchParams
4. Fetches ONLY the active tab's data (avoids loading all tabs at once)
5. Renders: header section + tab navigation + active tab content

#### Component Breakdown

**`src/app/(hub)/usr/[id]/page.tsx`** -- REPLACE existing 111-line file
- Orchestrator: auth check, header data, tab routing, active tab data fetch
- Renders `AdminPageHeader` with enhanced `UserActions`
- Renders tab nav (simple link list, active tab highlighted)
- Switch on tab param to render correct content component
- Max 300 lines

**`src/components/admin/user-detail/user-detail-tabs.tsx`** -- NEW (client component)
- Tab navigation bar with links that update `?tab=` search param
- Uses `useSearchParams()` and `useRouter()` for client-side navigation
- Highlights active tab
- Conditionally shows/hides tabs based on passed permission props (e.g., `canViewFinance`, `canViewNotes`)

**`src/components/admin/user-detail/user-overview-tab.tsx`** -- NEW (server component)
- Receives full `UserDetailFull` as prop
- Renders in 3-column grid layout:
  - **Account Card**: username, email (verified badge), phone (verified badge), joined date, buyer quality tier, marketing opt-in, credit balance (`$X.XX`)
  - **Seller Card** (if isSeller): sellerType badge, performanceBand badge with correct Seller Score Canonical S3.1 colors (POWER_SELLER=#7C3AED purple, TOP_RATED=#F59E0B gold, ESTABLISHED=#10B981 green, EMERGING=gray), sellerScore (0-1000), enforcementLevel, status badge, vacationMode, handlingTimeDays, activatedAt, verifiedAt, isNew
  - **Subscriptions Card** (if seller): storeTier + subscription status + period end, listerTier + status + period end, hasAutomation, financeTier, bundleTier, Stripe Connect ID (masked), Stripe onboarded badge, payoutsEnabled
- Second row:
  - **Business Card** (if BUSINESS): businessName, businessType, city/state/country, phone, website
  - **Balance Card** (if seller): "Available for payout" (NOT "balance"), pending, reserved -- all cents formatted as dollars
  - **Band Override Card** (if bandOverride set): current override band, reason, expires at, set by staff ID
- Third row:
  - **Addresses List**: label, city/state/zip, default badge
  - **Storefront Link** (if exists): slug, name, published status, link to `/st/[slug]`

**`src/components/admin/user-detail/user-orders-tab.tsx`** -- NEW
- Table: Order #, Role (buyer/seller based on `buyerId`/`sellerId` match), Status badge, Total ($), Date
- Pagination (reuses existing `getAdminUserOrders`)
- Each order links to `/tx/orders/[id]`

**`src/components/admin/user-detail/user-listings-tab.tsx`** -- NEW
- Table: Title (linked to `/i/[slug]`), Status badge, Price ($), Created
- Pagination (reuses existing `getAdminUserListings`)

**`src/components/admin/user-detail/user-cases-tab.tsx`** -- NEW
- Table: Case ID, Subject, Status badge, Priority badge, Created
- Uses `getAdminUserCases`

**`src/components/admin/user-detail/user-finance-tab.tsx`** -- NEW
- Balance card: pending, available ("Available for payout"), reserved -- all cents to dollars
- Recent payouts table: status, amount, created
- Recent ledger entries table: type, amount cents (formatted), status, created
- Uses `getAdminUserFinance`

**`src/components/admin/user-detail/user-activity-tab.tsx`** -- NEW
- Timeline list: action, subject, severity badge, timestamp, details summary
- Uses `getAdminUserActivity`
- Chronological, newest first

**`src/components/admin/user-detail/user-notes-tab.tsx`** -- NEW (has client interactivity)
- List of audit events where `action = 'ADMIN_NOTE'` and `subjectId = userId`
- "Add note" form at top: textarea + submit button, calls `addInternalNoteAction`
- Requires `ability.can('update', 'User')`

**`src/components/admin/actions/user-actions.tsx`** -- MODIFY existing
- ADD "Hold payouts" / "Release payouts" toggle button (calls `holdPayoutsAction` / `releasePayoutsAction`)
- ADD "Reset password" button (calls `resetPasswordAction`)
- ADD "Override band" button that opens an inline form with band dropdown + reason textarea + submit
- All new buttons gated by appropriate CASL checks passed as props
- Keep existing: Suspend/Unsuspend, Warn, View as user (impersonate)

New props to add:
```typescript
interface UserActionsProps {
  userId: string;
  isBanned: boolean;
  canImpersonate?: boolean;
  // New props
  isSeller?: boolean;
  payoutsEnabled?: boolean;
  currentBand?: string;
  canUpdateUser?: boolean;       // ability.can('update', 'User')
  canUpdateSeller?: boolean;     // ability.can('update', 'SellerProfile')
}
```

---

### I2.3 -- Seller Management Page (~30 min)

**Route:** `/usr/sellers` (NEW)
**Gate:** `STAFF(ADMIN, SUPPORT)` -- `ability.can('read', 'User')`
**Layout:** `hub`

**NOT IN PAGE REGISTRY** -- V2 admin port addition.

**Page file:** `src/app/(hub)/usr/sellers/page.tsx`

Server component rendering a filtered, paginated seller table.

**Filters (all as search params, HTML form submit -- no client JS needed):**
- Search input (name/email/username)
- Seller Type: All | PERSONAL | BUSINESS
- Store Tier: All | NONE | STARTER | PRO | POWER | ENTERPRISE
- Performance Band: All | EMERGING | ESTABLISHED | TOP_RATED | POWER_SELLER
- Status: All | ACTIVE | RESTRICTED | SUSPENDED
- Sort: Newest | Oldest | Name | Score

**Table Columns:**
| Column | Content |
|--------|---------|
| Seller | Name + email (linked to `/usr/[userId]`) |
| Type | PERSONAL / BUSINESS badge |
| Store Tier | Tier badge |
| Lister Tier | Tier badge |
| Band | Performance band badge with Seller Score Canonical colors |
| Score | Integer 0-1000 |
| Status | ACTIVE (green) / RESTRICTED (yellow) / SUSPENDED (red) badge |
| Available | Available for payout amount (dollars) or "--" if no balance |
| Stripe | Green check if onboarded, gray dash if not |
| Verified | Green check if `verifiedAt` is set, yellow clock if null |
| Joined | activatedAt date |

Pagination: 50 per page. Uses same Previous/Next pattern as existing `/usr` page.

Uses `getAdminSellerList()` query from `admin-sellers.ts`.

Header actions: link to `/usr/new` (if `ability.can('create', 'User')`)

---

### I2.4 -- Identity Verification Queue (~30 min)

**Route:** `/usr/sellers/verification` (NEW)
**Gate:** `STAFF(ADMIN)` -- `ability.can('read', 'User')` AND `ability.can('update', 'SellerProfile')`
**Layout:** `hub`

**NOT IN PAGE REGISTRY** -- V2 admin port addition.

**Page file:** `src/app/(hub)/usr/sellers/verification/page.tsx`

Since the `identity_verification` table does NOT exist in the schema, this page is a **filtered read-only view** of sellers meeting verification criteria. It does NOT have approve/reject actions (those require the full KYC table).

**Queue view shows:**
- Summary count: "X sellers pending verification"
- Table of sellers meeting criteria from `getAdminVerificationQueue()`

**Table Columns:**
| Column | Content |
|--------|---------|
| Seller | Name + email (linked to `/usr/[userId]`) |
| Type | PERSONAL / BUSINESS badge |
| Store Tier | Tier badge |
| Verified | "Unverified" (yellow) if `verifiedAt IS NULL`, "Verified [date]" (green) otherwise |
| Enforcement | Level badge if enforcementLevel is set, "--" otherwise |
| Status | ACTIVE / RESTRICTED / SUSPENDED badge |
| Seller Since | activatedAt date |
| Action | "View" link to `/usr/[userId]` |

**Important:** This is a read-only queue for visibility. Admin actions on these sellers happen from the `/usr/[id]` detail page. This aligns with the fact that the KYC table doesn't exist yet -- full verification approve/reject flow should be built when the `identity_verification` table is added in a future phase.

---

### I2.5 -- Create User Page (~20 min)

**Route:** `/usr/new` (NEW)
**Gate:** `STAFF(ADMIN)` -- `ability.can('create', 'User')`
**Layout:** `hub`

**NOT IN PAGE REGISTRY** -- V2 admin port addition.

**Page file:** `src/app/(hub)/usr/new/page.tsx` -- server component page shell

**Form component:** `src/components/admin/user-detail/create-user-form.tsx` -- client component

**Form Fields:**
| Field | Type | Validation | Required |
|-------|------|-----------|----------|
| Name | text | 1-100 chars | YES |
| Email | email | valid email, max 255, unique | YES |
| Username | text | 3-30 chars, alphanumeric + underscores, unique | NO |

On submit: calls `createUserAction()` server action. On success: redirect to `/usr/[newUserId]`. On error: display inline error.

No password field -- user receives password-reset email to set their own.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms (zero occurrences allowed in all new/modified files)
| BANNED | CORRECT |
|--------|---------|
| `SellerTier` | `StoreTier` or `ListerTier` |
| `SubscriptionTier` | `StoreTier` or `ListerTier` |
| `FVF` / `Final Value Fee` | `TF` / `Transaction Fee` |
| `BASIC` (as StoreTier) | `STARTER` or `PRO` |
| `ELITE` (as StoreTier) | `POWER` |
| `PLUS` / `MAX` (as ListerTier) | `LITE` or `PRO` |
| `PREMIUM` | `POWER` |
| `Twicely Balance` | `Available for payout` |
| `wallet` (in UI) | `payout` or `earnings` |
| `Withdraw` (in UI) | `Request payout` |
| `Balance` as standalone label for seller funds | `Available for payout` |

### Route Rules
- All routes under `/usr/` prefix on hub subdomain
- NEVER use `/admin`, `/dashboard`, `/users`, `/user` as route prefixes
- Internal links: listings use `/i/[slug]`, orders use `/tx/orders/[id]`, cases use `/hd`
- Storefronts link to `/st/[slug]`

### Code Rules
- **DO NOT modify `src/lib/hub/admin-nav.ts`** -- owned by I17, worktree-isolated
- `sellerProfile.id` is CUID2 PK (NOT userId). Always join on `sellerProfile.userId = user.id`. Subscriptions join through `sellerProfile.id` (not userId).
- EIN NEVER returned from queries. Omit from select entirely.
- `stripeAccountId` MASKED before return: `acct_****${id.slice(-4)}`
- All money as integer cents in DB, formatted as dollars in UI
- All server actions: `'use server'`, Zod `.strict()`, `staffAuthorize()`, CASL check, explicit field mapping, audit event, `revalidatePath()`
- Helper functions in `'use server'` files must be UNEXPORTED
- Max 300 lines per file
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- No `console.log` in production code
- `Promise.all()` for independent parallel queries

### Tech Stack
- Drizzle ORM (NOT Prisma)
- CASL for authorization (NOT custom RBAC)
- Zod for validation
- Server components default, client components only for interactivity (tabs, forms, action buttons)
- `revalidatePath()` after mutations (NOT `router.refresh()` from server)

---

## 4. ACCEPTANCE CRITERIA

### Functional
- [ ] `/usr/[id]` displays 7 tabs: Overview, Orders, Listings, Cases, Finance, Activity, Notes
- [ ] Overview tab shows: account info, seller info with sellerScore (0-1000) and performanceBand, subscription details, business info, addresses, storefront link, balance
- [ ] Performance band badges use correct colors: POWER_SELLER=#7C3AED, TOP_RATED=#F59E0B, ESTABLISHED=#10B981, EMERGING=gray
- [ ] Finance tab shows: balance (pending, available as "Available for payout", reserved), recent payouts, recent ledger entries
- [ ] Notes tab displays existing admin notes and allows adding new ones
- [ ] `/usr/sellers` renders paginated seller table with 6 filters (search, sellerType, storeTier, performanceBand, status, sort)
- [ ] `/usr/sellers/verification` shows queue of sellers needing verification (unverified high-tier + restricted sellers)
- [ ] `/usr/new` form creates user and redirects to detail page on success
- [ ] Admin actions toolbar has: Suspend/Unsuspend, Warn, Hold/Release payouts, Reset password, Override band, View as user
- [ ] Tab navigation uses URL search params (`?tab=X`) -- direct linking to specific tabs works

### Authorization
- [ ] All 4 pages require `staffAuthorize()` -- unauthenticated = redirect
- [ ] `/usr`, `/usr/[id]`, `/usr/sellers` accessible to ADMIN and SUPPORT
- [ ] `/usr/sellers/verification`, `/usr/new` accessible to ADMIN only
- [ ] Finance tab hidden from SUPPORT role (requires `can('read', 'Payout')`)
- [ ] Notes tab hidden from SUPPORT role (requires `can('update', 'User')`)
- [ ] `createUserAction` rejects non-ADMIN with `{ error: 'Forbidden' }`
- [ ] `holdPayoutsAction` / `releasePayoutsAction` require `can('update', 'SellerProfile')`
- [ ] `overridePerformanceBandAction` requires `can('update', 'SellerProfile')`
- [ ] All mutating actions create audit events with acting staff member's ID as `actorId`

### Data Integrity
- [ ] All monetary values stored as integer cents, displayed as formatted USD
- [ ] EIN NEVER appears in query results or UI
- [ ] `stripeAccountId` appears masked as `acct_****XXXX`
- [ ] Performance band override correctly sets `bandOverrideExpiresAt` (defaults to 90 days from now)
- [ ] `sellerProfile.id` and `user.id` are never confused in joins

### Vocabulary
- [ ] Zero banned terms in any new/modified file
- [ ] Balance section labeled "Available for payout"
- [ ] "Seller Score" for the 0-1000 number, "Performance Band" for the enum label
- [ ] No "wallet", "withdraw", "balance" as standalone label

### Negative Cases
- [ ] SUPPORT role cannot create users (returns `{ error: 'Forbidden' }`)
- [ ] SUPPORT role cannot hold payouts or override bands
- [ ] Invalid Zod input returns `{ error: 'Invalid input' }`
- [ ] Extra fields rejected by `.strict()`
- [ ] Nonexistent user ID returns 404 via `notFound()`
- [ ] `overridePerformanceBandAction` rejects `SUSPENDED` as `newBand` (not in the z.enum array)
- [ ] Page works for non-seller users (seller sections hidden, Finance tab hidden)

---

## 5. TEST REQUIREMENTS

### Action Tests: `src/lib/actions/__tests__/admin-users-management.test.ts`

Follow existing `admin-users.test.ts` pattern exactly: `vi.mock` for `staff-authorize`, `db`, `drizzle-orm`, `schema`. Chain helpers: `makeUpdateChain()`, `makeInsertChain()`, `makeSelectChain()`. `mockAllowed(action, subject)` / `mockForbidden()`.

```
describe('createUserAction')
  - returns Forbidden when CASL denies create on User
  - returns Invalid input for missing name
  - returns Invalid input for invalid email format
  - returns Invalid input for name over 100 chars
  - rejects extra fields via strict schema
  - creates user and audit event on success
  - returns error when email already exists

describe('holdPayoutsAction')
  - returns Forbidden when CASL denies update on SellerProfile
  - returns Invalid input for missing userId
  - returns Invalid input for missing reason
  - rejects extra fields via strict schema
  - sets payoutsEnabled to false and creates HOLD_PAYOUTS audit event

describe('releasePayoutsAction')
  - returns Forbidden when CASL denies
  - returns Invalid input for missing userId
  - rejects extra fields
  - sets payoutsEnabled to true and creates RELEASE_PAYOUTS audit event

describe('overridePerformanceBandAction')
  - returns Forbidden when CASL denies
  - returns Invalid input for missing userId or newBand
  - rejects SUSPENDED as newBand (not in enum)
  - rejects extra fields
  - overrides band and creates OVERRIDE_PERFORMANCE_BAND audit event
  - defaults expiresInDays to 90 when not provided
  - includes previousBand in audit details

describe('addInternalNoteAction')
  - returns Forbidden when CASL denies
  - returns Invalid input for empty content
  - returns Invalid input for content over 2000 chars
  - rejects extra fields
  - creates ADMIN_NOTE audit event with content in detailsJson

describe('resetPasswordAction')
  - returns Forbidden when CASL denies
  - returns Invalid input for missing userId
  - rejects extra fields
  - creates ADMIN_RESET_PASSWORD audit event
```

**Estimated: ~28 tests**

### Query Tests: `src/lib/queries/__tests__/admin-sellers.test.ts`

```
describe('getAdminSellerList')
  - returns paginated sellers with correct fields
  - filters by sellerType
  - filters by storeTier
  - filters by performanceBand
  - filters by status
  - search matches name and email
  - returns empty array when no matches

describe('getAdminVerificationQueue')
  - returns sellers with storeTier >= PRO and verifiedAt IS NULL
  - returns sellers with RESTRICTED status
  - excludes verified sellers
  - returns empty when no pending
```

**Estimated: ~11 tests**

### Edge Cases
- User with no seller profile (buyer-only) -- seller tabs/cards hidden
- User with seller profile but no business info (PERSONAL) -- business card hidden
- User with no orders/listings/cases -- empty state message per tab
- User with `isBanned: true` -- all tabs render, suspend shows "Unsuspend"
- Seller with no `sellerBalance` record -- balance shows $0.00 for all fields
- Seller with no subscriptions -- subscription card shows "No active subscriptions"
- Band override on seller with existing override -- overwrites previous

**Total estimated new tests: ~39**

---

## 6. FILE APPROVAL LIST

### New Files (14)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/queries/admin-sellers.ts` | `getAdminSellerList()` + `getAdminVerificationQueue()` queries |
| 2 | `src/lib/actions/admin-users-management.ts` | createUser, holdPayouts, releasePayouts, overrideBand, addNote, resetPassword actions |
| 3 | `src/components/admin/user-detail/user-detail-tabs.tsx` | Client component: tab navigation bar using URL search params |
| 4 | `src/components/admin/user-detail/user-overview-tab.tsx` | Overview tab: account, seller, subscriptions, business, addresses, balance cards |
| 5 | `src/components/admin/user-detail/user-orders-tab.tsx` | Orders tab: paginated order table with buyer/seller role column |
| 6 | `src/components/admin/user-detail/user-listings-tab.tsx` | Listings tab: paginated listing table |
| 7 | `src/components/admin/user-detail/user-cases-tab.tsx` | Cases tab: helpdesk cases table |
| 8 | `src/components/admin/user-detail/user-finance-tab.tsx` | Finance tab: balance, payouts, ledger entries |
| 9 | `src/components/admin/user-detail/user-activity-tab.tsx` | Activity tab: audit event timeline |
| 10 | `src/components/admin/user-detail/user-notes-tab.tsx` | Notes tab: admin notes list + add note form |
| 11 | `src/components/admin/user-detail/create-user-form.tsx` | Client component: create user form |
| 12 | `src/app/(hub)/usr/sellers/page.tsx` | Seller management table page with filters |
| 13 | `src/app/(hub)/usr/sellers/verification/page.tsx` | Identity verification queue (read-only) |
| 14 | `src/app/(hub)/usr/new/page.tsx` | Create user page shell |

### New Test Files (2)

| # | File Path | Description |
|---|-----------|-------------|
| 15 | `src/lib/actions/__tests__/admin-users-management.test.ts` | Tests for all new management actions (~28 tests) |
| 16 | `src/lib/queries/__tests__/admin-sellers.test.ts` | Tests for seller list + verification queue (~11 tests) |

### Modified Files (4)

| # | File Path | Change Description |
|---|-----------|-------------------|
| 17 | `src/app/(hub)/usr/[id]/page.tsx` | REPLACE: full tabbed user detail with enriched header |
| 18 | `src/lib/queries/admin-users.ts` | MODIFY: enrich `getAdminUserDetail()` return type, add filters to `getAdminUserList()` |
| 19 | `src/components/admin/actions/user-actions.tsx` | MODIFY: add hold payouts, reset password, override band buttons + new props |
| 20 | `src/app/(hub)/usr/page.tsx` | MODIFY: add header action links to `/usr/sellers` and `/usr/new` |

### Files NOT Modified (explicit exclusions)

| File | Reason |
|------|--------|
| `src/lib/hub/admin-nav.ts` | Owned by I17. DO NOT TOUCH. Sidebar links added separately. |
| `src/lib/actions/admin-users.ts` | Keep existing 4 actions unchanged. New actions in separate file. |
| `src/lib/db/schema/*` | No schema changes. All required tables exist. |
| `src/lib/casl/*` | No CASL changes needed. Existing permissions sufficient. |

**Total: 16 new files + 4 modified = 20 files. ~39 new tests.**

---

## 7. VERIFICATION CHECKLIST

```bash
# 1. TypeScript check -- must be 0 errors
pnpm typecheck

# 2. Test suite -- must be >= BASELINE_TESTS (7990)
pnpm test

# 3. Full lint script
./twicely-lint.sh

# 4. Banned terms check on all new/modified files
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|Twicely Balance\|wallet\|Withdraw" \
  src/lib/queries/admin-sellers.ts \
  src/lib/actions/admin-users-management.ts \
  src/app/\(hub\)/usr/ \
  src/components/admin/user-detail/ \
  src/components/admin/actions/user-actions.tsx

# 5. Route prefix check
grep -rn '"/admin\|"/dashboard\|"/users\|"/listing/\|"/store/\|"/shop/' \
  src/app/\(hub\)/usr/ \
  src/components/admin/user-detail/

# 6. File size check -- all must be <= 300 lines
wc -l \
  src/lib/queries/admin-sellers.ts \
  src/lib/queries/admin-users.ts \
  src/lib/actions/admin-users-management.ts \
  src/app/\(hub\)/usr/\[id\]/page.tsx \
  src/app/\(hub\)/usr/page.tsx \
  src/app/\(hub\)/usr/sellers/page.tsx \
  src/app/\(hub\)/usr/sellers/verification/page.tsx \
  src/app/\(hub\)/usr/new/page.tsx \
  src/components/admin/user-detail/*.tsx \
  src/components/admin/actions/user-actions.tsx

# 7. console.log check
grep -rn 'console.log' \
  src/lib/queries/admin-sellers.ts \
  src/lib/actions/admin-users-management.ts \
  src/components/admin/user-detail/ \
  src/app/\(hub\)/usr/
```

### Expected Outcomes
- TypeScript: 0 errors
- Tests: >= 7990 + ~39 new = ~8029
- Banned terms: 0 matches
- Wrong routes: 0 matches
- All files <= 300 lines
- console.log: 0 matches

---

## 8. SPEC INCONSISTENCIES & OPEN DECISIONS

### Inconsistencies Found

1. **No `identity_verification` table in schema (v2.1.3) or codebase.** Feature Lock-in S45 describes a full KYC flow with 4 verification levels and 5 statuses, but no table was created. G6 findings (agent memory `g6-kyc-findings.md`) confirm: "NO `identity_verification` or `data_export_request` table in schema doc (v2.1.3) -- must be created." The verification queue (I2.4) uses `sellerProfile.verifiedAt` as best-effort signal. Full KYC table should be built in a dedicated future phase.

2. **No `seller_performance_snapshots` table in codebase.** Seller Score Canonical S10.3 defines this table with daily score history, but it was never created. Cannot show score history charts. I2 displays only current `sellerProfile.sellerScore` (which does exist at 0-1000 integer).

3. **No `seller_score_overrides` audit table in codebase.** Seller Score Canonical S10.4 defines this. Band overrides write directly to `sellerProfile.bandOverride*` fields (which DO exist). The audit trail is captured via `auditEvent` records instead.

4. **Routes `/usr/new`, `/usr/sellers`, `/usr/sellers/verification` not in Page Registry.** These are Phase I admin panel port additions. Page Registry v1.8 only defines `/usr` (#86) and `/usr/[id]` (#87).

5. **Admin user creation bypasses Better Auth.** Better Auth manages user registration. The mechanism for admin-created users is not documented in any canonical.

### Owner Decisions Needed

| # | Decision | Default Assumption |
|---|----------|-------------------|
| A | Confirm 3 new routes are approved without Page Registry amendment | YES -- proceeding as V2 port additions |
| B | Admin-created users: direct DB insert + password reset email vs Better Auth admin API | Direct DB insert (option A) |
| C | Verification queue uses `sellerProfile.verifiedAt` as best-effort until KYC table exists | YES |
| D | `resetPasswordAction` creates audit event only (email sending wired later) vs full email implementation now | Audit event only for now |
