# E3 — Admin Dashboard (hub.twicely.co)

**Phase & Step:** E3 (sub-steps E3.1 through E3.7)
**Feature Name:** Platform Admin Dashboard
**One-line Summary:** Build the hub.twicely.co admin interface: staff authentication, platform dashboard, user management, transaction management, finance overview, moderation queue, platform settings, and safe meetup location management.

**Canonical Sources — Read ALL before starting:**

| Doc | Relevance |
|-----|-----------|
| `TWICELY_V3_PAGE_REGISTRY.md` | Section 8: All hub routes (/d, /usr, /tx, /fin, /mod, /cfg), page states, role gates |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Sections 3.5-3.6: Platform Agent + Admin permissions matrix. Section 4: CASL ability factory for platform staff. Section 4.3: Custom roles. |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | Part D Section 17: Settings UI tab structure, display requirements, role access |
| `TWICELY_V3_SCHEMA_v2_0_7.md` | Sections 2.6-2.8 (staffUser, staffUserRole, staffSession), Section 14 (platformSetting, featureFlag, auditEvent, sequenceCounter, customRole, staffUserCustomRole) |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Sections 15, 20, 21: Real-time admin, global search, settings UI |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` | Section 10.3: Hub sidebar navigation |
| `TWICELY_V3_DECISION_RATIONALE.md` | N/A — no E3-specific locked decisions (uses general admin rules from Actors doc) |
| `TWICELY_V3_LOCAL_CANONICAL.md` | Safe meetup location table (E3.7) |

---

## 1. PREREQUISITES

### Phases that must be complete
- Phase A (Foundation): All 5 core steps DONE (schema, auth, CASL, seed)
- Phase B (Core Marketplace): All 15 core steps DONE (browse, listings, cart, checkout, orders, shipping)
- Phase C (Trust & Monetization): All 26 steps DONE (reviews, offers, Stripe Connect, returns, disputes, buyer protection)
- E1 (Notifications): DONE

### What already exists in codebase
- `staffUser`, `staffUserRole`, `staffSession` tables — schema at `src/lib/db/schema/staff.ts`
- `platformSetting`, `platformSettingHistory`, `featureFlag`, `auditEvent`, `sequenceCounter`, `customRole`, `staffUserCustomRole` tables — schema at `src/lib/db/schema/platform.ts`
- `safeMeetupLocation`, `localTransaction` tables — schema at `src/lib/db/schema/local.ts`
- Seed: admin user at `admin@hub.twicely.co` with SUPER_ADMIN role — `src/lib/db/seed/seed-system.ts`
- Middleware: hub subdomain detection in `src/proxy.ts` (lines 12-24) — detects `hub.twicely.co` / `hub.twicely.local`, redirects `/` to `/d`
- Hub layout shell: `src/app/(hub)/layout.tsx` — currently a pass-through (`return children`)
- Disputes page: `src/app/(hub)/mod/disputes/page.tsx` — existing admin disputes page (needs integration into hub layout)
- CASL: `CaslSession.isPlatformStaff` is a STUB (hardcoded `false`) — `src/lib/casl/types.ts` line 23-24
- CASL: `ability.ts` has NO platform staff/admin rules — only guest, buyer, seller, seller-staff
- CASL: `authorize.ts` hardcodes `isPlatformStaff: false, platformRoles: []` — line 62-63
- `getPlatformSetting()` utility exists at `src/lib/queries/platform-settings.ts`
- Platform settings seed exists at `src/lib/db/seed/seed-platform.ts`
- Subjects list includes: `FeatureFlag`, `AuditEvent`, `Setting`, `Analytics`, `HealthCheck` — already defined

### Dependencies needed
- `bcryptjs` — already installed (used for staff password hashing in seed)
- No new npm packages required for E3

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

This is a large feature spanning 7 sub-steps. It decomposes into **5 parallel streams** (see Section 8). Here is the complete scope.

### 2.1 Staff Authentication (E3 prerequisite — builds before all sub-steps)

**Problem:** The `CaslSession` type stubs `isPlatformStaff: false` and `platformRoles: []`. The `authorize()` function never resolves staff identity. Hub routes have no auth gate.

**What to build:**

1. **Staff auth service** (`src/lib/auth/staff-auth.ts`):
   - `loginStaff(email: string, password: string): Promise<StaffSession>` — validate credentials against `staffUser` table, verify `isActive`, check password with bcryptjs, create `staffSession` row, return session token
   - `getStaffSession(token: string): Promise<StaffSession | null>` — lookup `staffSession` by token, verify not expired, check `lastActivityAt` for 30-minute inactivity timeout (Actors Canonical Section 3.5), load roles from `staffUserRole`
   - `logoutStaff(token: string): Promise<void>` — delete session row
   - Session expiry: 8 hours absolute, 30 minutes inactivity (Actors Canonical)
   - Cookie name: `twicely.staff_token` (separate from marketplace `twicely.session_token`)

2. **Staff CASL integration** — update `src/lib/casl/types.ts`:
   - Change `isPlatformStaff: false` to `isPlatformStaff: boolean`
   - Change `platformRoles: []` to `platformRoles: PlatformRole[]`
   - Add `PlatformRole` type: `'HELPDESK_AGENT' | 'HELPDESK_LEAD' | 'HELPDESK_MANAGER' | 'SUPPORT' | 'MODERATION' | 'FINANCE' | 'DEVELOPER' | 'SRE' | 'ADMIN' | 'SUPER_ADMIN'`

3. **Staff CASL ability rules** — add to `src/lib/casl/ability.ts`:
   - New function `definePlatformAgentAbilities(builder, session)` per Actors Canonical Section 3.5 matrix
   - New function `definePlatformAdminAbilities(builder, session)` per Actors Canonical Section 3.6
   - Admin has `can('manage', 'all')` EXCEPT `cannot('delete', 'LedgerEntry')`, `cannot('delete', 'AuditEvent')`, `cannot('update', 'LedgerEntry')`
   - See Section 3 below for complete ability matrix

4. **Staff authorize helper** (`src/lib/casl/staff-authorize.ts`):
   - `staffAuthorize(): Promise<{ ability: AppAbility; session: StaffCaslSession }>` — reads `twicely.staff_token` cookie, resolves staff session, builds CASL abilities
   - Throws `ForbiddenError` if no valid staff session (unlike `authorize()` which returns guest abilities)

5. **Hub middleware update** — update `src/proxy.ts`:
   - For hub subdomain: check `twicely.staff_token` cookie. If missing, redirect to `/login` (hub login page)
   - Exception: `/login` route itself is public on hub subdomain

6. **Hub login page** — `src/app/(hub)/login/page.tsx`:
   - Email + password form
   - On success: set `twicely.staff_token` cookie, redirect to `/d`
   - Server action: `loginStaffAction` — validates input with Zod, calls `loginStaff`, sets cookie
   - Title: "Hub Login | Twicely" (per Page Registry #82)
   - Gate: PUBLIC (staff login)

### 2.2 Hub Layout Shell

Replace the pass-through `src/app/(hub)/layout.tsx` with a proper admin shell:

1. **Hub layout** (`src/app/(hub)/layout.tsx`):
   - Sidebar + topbar persistent shell (same architectural pattern as `/my` layout)
   - Sidebar navigation per Page Registry Section 10.3 (all hub sidebar items)
   - Topbar: staff display name, role badges, logout button, global search (Cmd+K), theme toggle
   - Active route highlighting
   - Role-gated sidebar items (hide items the staff member cannot access)

2. **Hub sidebar navigation** (`src/lib/hub/admin-nav.ts`):
   - Registry of all hub sidebar items with role gates:

   ```
   Dashboard       /d                  STAFF(any)
   Users           /usr                STAFF(ADMIN, SUPPORT)
   Transactions    /tx                 STAFF(ADMIN, SUPPORT, FINANCE)
   Finance         /fin                STAFF(ADMIN, FINANCE)
   Moderation      /mod                STAFF(ADMIN, MODERATION)
   Helpdesk        /hd                 STAFF(HELPDESK_AGENT+)
   Knowledge Base  /kb                 STAFF(HELPDESK_LEAD+, ADMIN)
   Listings        /listings           STAFF(ADMIN, MODERATION)
   Disputes        /disputes           STAFF(ADMIN, SUPPORT)
   Returns         /returns            STAFF(ADMIN, SUPPORT)
   Analytics       /analytics          STAFF(ADMIN, FINANCE)
   Subscriptions   /subscriptions      ADMIN
   Categories      /categories         ADMIN
   Notifications   /notifications      ADMIN
   Feature Flags   /flags              STAFF(ADMIN, DEVELOPER)
   Settings        /cfg                ADMIN
   Roles           /roles              ADMIN
   Audit Log       /audit              STAFF(any)
   System Health   /health             STAFF(ADMIN, DEVELOPER, SRE)
   Data Retention  /data-retention     ADMIN
   ```

3. **Hub components** (`src/components/admin/`):
   - `admin-sidebar.tsx` — sidebar with role-gated nav items
   - `admin-topbar.tsx` — topbar with staff info, search, logout
   - `admin-page-header.tsx` — reusable page header (title + description + optional actions)
   - `stat-card.tsx` — reusable KPI card (value, label, change indicator, icon)
   - `data-table.tsx` — reusable admin data table (sortable columns, pagination, search)

### 2.3 E3.1 — Platform Dashboard (`/d`)

**Route:** `/d` | **Gate:** STAFF(any) | **Page Registry #83**

**KPI Cards (top row):**
- Orders today (count)
- Revenue today (GMV in dollars)
- Open support cases (count)
- Active listings (count)
- Active users (count, last 24h) — count of distinct users with orders or listings created
- New signups today (count)

**Charts section:**
- GMV trend (7-day, 30-day selectable) — bar chart
- Orders trend (7-day, 30-day selectable) — line chart
- New users trend (30-day) — line chart

**Recent activity feed:**
- Last 10 significant events from `auditEvent` table (new orders, disputes opened, listings flagged, etc.)

**Data source queries:**
- `getDashboardKPIs()` — aggregates from `order`, `user`, `listing`, `helpdeskCase` tables
- `getDashboardCharts(period: '7d' | '30d')` — time-series aggregations
- `getRecentAdminActivity(limit: number)` — from `auditEvent` with severity >= MEDIUM

### 2.4 E3.2 — User Management (`/usr`, `/usr/[id]`)

**Route:** `/usr` | **Gate:** STAFF(ADMIN, SUPPORT) | **Page Registry #84-85**

**User list page (`/usr`):**
- Data table with columns: Name, Email, Type (buyer/seller), Status (active/restricted/suspended/banned), Joined date, Orders count
- Search by name, email, or username
- Filters: seller type (PERSONAL/BUSINESS), status, date range
- Pagination (50 per page)

**User detail page (`/usr/[id]`):**
- 7 tabs per Page Registry:
  1. **Overview**: account info, seller status, trust score, subscription tiers (StoreTier, ListerTier), performance band
  2. **Orders**: purchase + sale history (paginated table)
  3. **Listings**: all listings with status badges
  4. **Cases**: support cases filed by this user
  5. **Finance**: seller balance (available for payout), payout history, recent ledger entries
  6. **Activity**: recent audit events for this user
  7. **Notes**: internal staff notes (not visible to user) — stored in a new `staffNote` record (see NOT SPECIFIED note below)

- **Action toolbar** per Page Registry:
  - Suspend / Unsuspend (toggles `user.isBanned` + creates audit event)
  - Warn (send warning notification — creates notification record)
  - Restrict selling / buying (sets `sellerProfile.status = RESTRICTED`)
  - Hold payouts (sets a reserve hold on seller funds)
  - Reset password (generates a password reset token via Better Auth)

**NOT SPECIFIED — Owner decision needed:** The Page Registry specifies a "Notes" tab for internal staff notes on users, but no `staffNote` table exists in the schema doc. Options: (A) Create a simple `staff_note` table: `id, targetUserId, staffUserId, content, createdAt`. (B) Use the existing `auditEvent` table with a STAFF_NOTE action type. (C) Defer Notes tab to later. **Recommendation: Option A.** The installer should create a simple table but ASK the owner before adding it to the schema.

### 2.5 E3.3 — Transaction Management (`/tx`, `/tx/orders`, `/tx/orders/[id]`, `/tx/payments`)

**Routes:** Page Registry #86-89 | **Gate:** STAFF(ADMIN, SUPPORT, FINANCE)

**Transaction overview (`/tx`):**
- KPI cards: total order volume (30d), payment volume (30d), refund rate (30d), average order value
- Quick links to sub-pages

**All orders (`/tx/orders`):**
- Data table: order number, buyer name, seller name, status badge, total, date, payment status
- Search by order number, buyer email, seller email
- Filters: status, date range, amount range
- Pagination (50 per page)

**Order detail (`/tx/orders/[id]`):**
- Full order detail: items list, payment info (Stripe payment intent ID, capture status), shipping info (tracking, carrier), returns (if any), disputes (if any), ledger entries for this order, timeline of status changes
- **Admin action buttons** (per Page Registry):
  - Issue refund (full or partial) — creates Stripe refund + ledger entries. Requires reason text. Audited.
  - Cancel order (with reason) — audited
  - Override status (with reason) — audited, ADMIN only
  - Add internal note — audit event with STAFF_NOTE type
  - Escalate to helpdesk case — creates new `helpdeskCase` linked to this order
  - View buyer / View seller — links to `/usr/[id]`

**Payments (`/tx/payments`):**
- Payment intents list from orders (Stripe payment intent ID, amount, capture status, refund history)
- Filters: status, date range
- Read-only view — actions happen through order detail page

### 2.6 E3.4 — Finance Overview (`/fin`, `/fin/ledger`, `/fin/payouts`, `/fin/recon`, `/fin/adjustments`, `/fin/costs`)

**Routes:** Page Registry #90-95 | **Gate:** STAFF(ADMIN, FINANCE)

**Finance dashboard (`/fin`):**
- KPI cards: total GMV (period selectable), fees collected, payouts sent, platform take rate (fees/GMV)
- Revenue trend chart (30-day)
- Quick links to sub-pages

**Ledger explorer (`/fin/ledger`):**
- Data table of ALL `ledgerEntry` records
- Columns: date, type (enum badge), seller, order, amount (green for credits, red for debits), status
- Filters: entry type, seller, order, date range
- Read-only (ledger entries are immutable)
- Pagination (100 per page)

**Payouts (`/fin/payouts`):**
- Payout list from `payout` table: seller name, amount, status, initiated date, completed date
- Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)
- **Action: Trigger manual payout batch** — ADMIN only, creates audit event at CRITICAL severity

**Reconciliation (`/fin/recon`):**
- Placeholder page with "Coming soon" message
- Will display `reconciliationReport` records when F-phase builds the reconciliation engine
- For now: just the page shell with the correct layout and role gate

**Adjustments (`/fin/adjustments`):**
- List of manual adjustments (ledger entries with type `MANUAL_CREDIT` or `MANUAL_DEBIT`)
- **Create new adjustment form** — ADMIN only:
  - Select seller (search by name/email)
  - Amount (cents input)
  - Type: Credit or Debit
  - Reason code (required): GOODWILL_CREDIT, ERROR_CORRECTION, PROMOTIONAL, OTHER
  - Reason text (required)
  - Creates: ledger entry + audit event at CRITICAL severity

**Platform costs (`/fin/costs`):**
- Ledger entries with type `PLATFORM_ABSORBED_COST`
- Aggregated by period: total absorbed costs, breakdown by sub-type
- Read-only summary

### 2.7 E3.5 — Moderation Queue (`/mod`, `/mod/listings`, `/mod/messages`, `/mod/reviews`)

**Routes:** Page Registry #96-99 | **Gate:** STAFF(ADMIN, MODERATION)

**Moderation overview (`/mod`):**
- KPI cards: flagged listings count, flagged messages count, flagged reviews count
- Queue prioritization: show oldest unresolved items first

**Flagged listings (`/mod/listings`):**
- Listings where `enforcementState = 'FLAGGED'`
- Table: thumbnail, title, seller, flag reason, flagged date
- Actions per listing: Remove (set enforcementState=REMOVED), Clear (set enforcementState=CLEAR), Warn seller (send notification)
- Each action creates audit event

**Flagged messages (`/mod/messages`):**
- Placeholder page — depends on E2 (Messaging System) which is not yet built
- Show "Messaging system not yet available. Flagged messages will appear here when messaging is enabled."

**Flagged reviews (`/mod/reviews`):**
- Reviews where `status = 'FLAGGED'`
- Table: reviewer name, seller name, rating, review text excerpt, flag reason
- Actions: Remove (set status=REMOVED), Approve (set status=APPROVED)
- Each action creates audit event

**Integration note:** The existing disputes page at `src/app/(hub)/mod/disputes/` should be left in place. It already has the correct route. The new `/mod` overview page should link to it.

### 2.8 E3.6 — Platform Settings (`/cfg`)

**Route:** `/cfg` | **Gate:** ADMIN | **Page Registry #114**

**Tab-based settings UI** per Platform Settings Canonical Section 17:

| Tab Key | Tab Label | Category | Gate |
|---------|-----------|----------|------|
| `environment` | Environment | (secrets) | ADMIN |
| `integrations` | Integrations | (providers) | ADMIN, SRE |
| `fees` | Fees & Pricing | `fees` | ADMIN |
| `commerce` | Commerce | `commerce` | ADMIN |
| `fulfillment` | Fulfillment | `fulfillment` | ADMIN |
| `trust` | Trust & Quality | `trust` | ADMIN |
| `discovery` | Discovery | `discovery` | ADMIN |
| `comms` | Communications | `comms` | ADMIN |
| `payments` | Payments | `payments` | ADMIN |
| `privacy` | Privacy | `privacy` | ADMIN |

**Tab content:** Query `platformSetting` table filtered by category. Render each setting as an inline-editable field with:
1. Label (plain English)
2. Description (one sentence)
3. Current value (editable)
4. Default indicator
5. Type-appropriate input component (NumberInput, CentsInput, BasisPointsInput, PercentInput, Toggle, SelectInput, TextInput)
6. Per-section Save button
7. Change indicator (visual diff when value differs from saved)

**Save behavior:**
- Create new `platformSettingHistory` row with previous value
- Update `platformSetting` row with new value + `updatedByStaffId`
- Create `auditEvent` at severity HIGH (CRITICAL for fee/provider changes)

**Environment tab:**
- Reads from `environmentSecret` table (if it exists in schema — NOT SPECIFIED if this table is implemented yet)
- Shows masked values (last 4 chars visible)
- Edit modal for updating secrets
- For MVP: display platform settings in the `environment` category. Full encrypted secrets management can come later.

**Integrations tab:**
- Placeholder: "Provider integration management coming in E4."
- Show read-only list of expected providers (Stripe, Shippo, Resend, Typesense, Cloudflare R2, Centrifugo)

### 2.9 E3.7 — Safe Meetup Location Management

**Context:** Admin manages the `safeMeetupLocation` table for Twicely.Local.

**Where in UI:** Sub-page accessible from `/cfg` settings or a dedicated admin page. NOT SPECIFIED in Page Registry as a standalone route. **Recommendation:** Add as a sub-section within the Commerce tab of `/cfg`, OR as a dedicated page at `/cfg/meetup-locations`.

**CRUD operations:**
- List all safe meetup locations (table with name, address, city/state, verified status, meetup count, active toggle)
- Create new location: name, full address, lat/lng, type (police station, library, etc.), operating hours (JSON), verified status
- Edit location
- Toggle active/inactive
- Each action creates audit event

**Schema already exists:** `safeMeetupLocation` in `src/lib/db/schema/local.ts` with all needed columns.

---

## 3. CASL RULES — PLATFORM STAFF ABILITIES

Per Actors & Security Canonical Sections 3.5-3.6. These rules must be added to `src/lib/casl/ability.ts`.

### Platform Agent Abilities (by role)

```typescript
// HELPDESK_AGENT, HELPDESK_LEAD, HELPDESK_MANAGER
can('manage', 'HelpdeskCase');
can('read', 'User');
can('read', 'Order');
can('read', 'Listing');
can('read', 'Return');
can('read', 'Dispute');

// SUPPORT
can('read', 'User');
can('read', 'Order');
can('read', 'Listing');
can('read', 'Return');
can('read', 'Dispute');
can('read', 'Payout');
can('read', 'AuditEvent');
can('create', 'Return'); // guided refund initiation

// MODERATION
can('read', 'User');
can('read', 'Listing');
can('read', 'Review');
can('read', 'Message');
can('read', 'AuditEvent');
can('update', 'Listing'); // enforcementState changes
can('update', 'SellerProfile'); // suspend
can('update', 'Review'); // moderate

// FINANCE
can('read', 'Order');
can('read', 'Payout');
can('read', 'LedgerEntry');
can('read', 'AuditEvent');
can('read', 'User');
can('update', 'Payout'); // place/release hold

// DEVELOPER
can('read', 'FeatureFlag');
can('read', 'AuditEvent');
can('read', 'HealthCheck');
can('update', 'FeatureFlag');

// SRE
can('read', 'HealthCheck');
can('read', 'AuditEvent');
can('manage', 'HealthCheck'); // run diagnostics
```

### Platform Admin Abilities

```typescript
// ADMIN and SUPER_ADMIN
can('manage', 'all');
cannot('delete', 'LedgerEntry');  // immutable
cannot('delete', 'AuditEvent');   // immutable
cannot('update', 'LedgerEntry');  // immutable
```

---

## 4. CONSTRAINTS — WHAT NOT TO DO

### Banned terms
- NO `SellerTier` — use `StoreTier` or `ListerTier`
- NO `FVF` / `Final Value Fee` — use `TF` / `Transaction Fee`
- NO `Twicely Balance` — use `Available for payout`
- NO `wallet` in any admin UI — use `payout` or `earnings`
- NO `Withdraw` — use `Request payout`
- NO `dashboard` in marketplace routes (that prefix is `/my`)
- NO `/admin` routes — hub uses subdomain `hub.twicely.co` with prefixes `/d`, `/usr`, `/tx`, `/fin`, `/mod`, `/cfg`

### Tech stack
- NO Prisma — use Drizzle ORM
- NO NextAuth — staff auth is custom (staffUser table, not Better Auth)
- NO Redux/Zustand — use React context + server state
- NO tRPC — use server actions + API routes

### Code rules
- All files under 300 lines
- All monetary values in integer cents
- All fee rates read from `platform_settings` table, NEVER hardcoded
- Zod validation on ALL server action inputs (`.strict()` mode)
- Explicit field mapping (never spread request body)
- `userId` is the ownership key everywhere
- No `as any`, no `@ts-ignore`, no `@ts-expect-error`

### Route rules
- Hub pages are NOT under `(marketplace)` route group — they stay under `(hub)`
- Hub pages use the `hub` layout (not `dashboard` or `marketplace`)
- All hub pages: `noindex, nofollow` meta robots tag
- Hub page titles follow pattern: `{Page Title} | Twicely Hub`

### Authorization rules
- Every hub page MUST check staff session before rendering
- Every server action MUST call `staffAuthorize()` and verify the role gate
- Never expose internal IDs in error messages — "Not found" only
- Agent sessions timeout after 30 minutes of inactivity
- All admin actions on user data create `auditEvent` records

### What NOT to build in E3
- Helpdesk (`/hd/*`) — deferred to G9
- Knowledge Base (`/kb/*`) — deferred to G9
- Feature Flags (`/flags`) — deferred to E4
- Audit Log (`/audit`) — deferred to E4
- System Health (`/health`) — deferred to E5
- Staff Roles CRUD (`/roles`) — already exists from A4, just needs hub layout integration
- Platform Analytics (`/analytics`) — deferred to D4
- Categories admin (`/categories`) — already exists from B1
- Subscriptions admin (`/subscriptions`) — already exists from D3
- Data Retention (`/data-retention`) — deferred to G8

---

## 5. ACCEPTANCE CRITERIA

### Authentication
- [ ] Staff can log in at `hub.twicely.co/login` with email + password
- [ ] Invalid credentials show generic error ("Invalid email or password")
- [ ] Successful login sets `twicely.staff_token` cookie and redirects to `/d`
- [ ] Staff session expires after 8 hours absolute
- [ ] Staff session expires after 30 minutes of inactivity
- [ ] Unauthenticated access to any hub route (except `/login`) redirects to `/login`
- [ ] Staff logout clears cookie and deletes session row
- [ ] `CaslSession` type correctly supports `isPlatformStaff: boolean` and `platformRoles: PlatformRole[]`
- [ ] CASL ability factory applies correct rules per platform role

### Hub Layout
- [ ] Hub sidebar shows all navigation items from Page Registry Section 10.3
- [ ] Sidebar items are hidden when staff member lacks the required role
- [ ] Active route is highlighted in sidebar
- [ ] Topbar shows staff display name and role badges
- [ ] All hub pages have `noindex, nofollow` meta tags
- [ ] All hub page titles follow `{Page Title} | Twicely Hub` pattern

### Dashboard (E3.1)
- [ ] `/d` shows 6 KPI cards with real data from database
- [ ] KPI values update on page load (server-rendered)
- [ ] GMV and order charts display with period selector
- [ ] Recent activity feed shows last 10 audit events

### User Management (E3.2)
- [ ] `/usr` shows paginated user table with search and filters
- [ ] User search works on name, email, username
- [ ] `/usr/[id]` shows 7 tabs with user data
- [ ] Admin can suspend/unsuspend a user (creates audit event)
- [ ] Admin can restrict selling for a seller (creates audit event)
- [ ] SUPPORT role can access `/usr` but cannot suspend (read-only actions)
- [ ] FINANCE role CANNOT access `/usr` (redirect to `/d` or show forbidden)
- [ ] MODERATION role CANNOT access `/usr`

### Transaction Management (E3.3)
- [ ] `/tx` shows transaction overview KPIs
- [ ] `/tx/orders` shows paginated order table with search
- [ ] Order search works on order number, buyer email, seller email
- [ ] `/tx/orders/[id]` shows full order detail with timeline
- [ ] Admin can issue refund from order detail (creates ledger entries + audit event)
- [ ] FINANCE role can view all `/tx/*` pages
- [ ] MODERATION role CANNOT access `/tx/*`

### Finance (E3.4)
- [ ] `/fin` shows revenue dashboard with KPIs
- [ ] `/fin/ledger` shows all ledger entries (read-only)
- [ ] Ledger entries cannot be edited or deleted from UI
- [ ] `/fin/payouts` shows payout list
- [ ] `/fin/adjustments` allows ADMIN to create manual adjustments
- [ ] Manual adjustment requires reason code + reason text
- [ ] Manual adjustment creates ledger entry + audit event (CRITICAL severity)
- [ ] FINANCE role can view but CANNOT create adjustments
- [ ] SUPPORT role CANNOT access `/fin/*`

### Moderation (E3.5)
- [ ] `/mod` shows overview with flagged counts
- [ ] `/mod/listings` shows flagged listings with action buttons
- [ ] Removing a listing sets `enforcementState = 'REMOVED'` + creates audit event
- [ ] Clearing a flag sets `enforcementState = 'CLEAR'` + creates audit event
- [ ] `/mod/reviews` shows flagged reviews with approve/remove actions
- [ ] `/mod/messages` shows placeholder message (E2 not yet built)
- [ ] Existing disputes page at `/mod/disputes` continues to work
- [ ] MODERATION role can access all `/mod/*` pages
- [ ] SUPPORT role CANNOT access `/mod/*`

### Settings (E3.6)
- [ ] `/cfg` shows 10 tabs per Platform Settings Canonical Section 17
- [ ] Settings are loaded from `platformSetting` table grouped by category
- [ ] Each setting shows label, description, current value, default, type indicator
- [ ] Editing a setting creates `platformSettingHistory` row + `auditEvent`
- [ ] CentsInput shows dollars but stores integer cents
- [ ] BasisPointsInput shows percentage but stores basis points
- [ ] Only ADMIN can access `/cfg`
- [ ] Environment tab shows settings in `environment` category
- [ ] Integrations tab shows placeholder

### Safe Meetup Locations (E3.7)
- [ ] Admin can CRUD safe meetup locations
- [ ] Location list shows name, address, verified status, active toggle
- [ ] Creating a location requires: name, address, city, state, zip, latitude, longitude, type
- [ ] Each CRUD action creates audit event

### General
- [ ] All monetary values displayed in dollars (stored as integer cents)
- [ ] No banned terms appear in any UI text
- [ ] All files under 300 lines
- [ ] Zero TypeScript errors
- [ ] Test count >= 1214 (current baseline per tracker v1.9)
- [ ] All server actions have Zod input validation in strict mode

---

## 6. TEST REQUIREMENTS

Per `TWICELY_V3_TESTING_STANDARDS.md` patterns. Use existing test helpers from `src/lib/casl/__tests__/helpers.ts`.

### Unit Tests

**Staff auth tests** (`src/lib/auth/__tests__/staff-auth.test.ts`):
- "should authenticate valid staff user"
- "should reject invalid password"
- "should reject inactive staff user"
- "should create staff session on login"
- "should expire session after 8 hours"
- "should expire session after 30 min inactivity"
- "should delete session on logout"

**Staff CASL tests** (`src/lib/casl/__tests__/staff-ability.test.ts`):
- "ADMIN can manage all subjects except immutable ones"
- "ADMIN cannot delete LedgerEntry"
- "ADMIN cannot delete AuditEvent"
- "ADMIN cannot update LedgerEntry"
- "SUPPORT can read User, Order, Listing, Return, Dispute, Payout"
- "SUPPORT can create Return (guided refund)"
- "SUPPORT cannot update Listing"
- "MODERATION can read and update Listing"
- "MODERATION can update Review"
- "MODERATION cannot read Payout"
- "FINANCE can read LedgerEntry and Payout"
- "FINANCE can update Payout (hold)"
- "FINANCE cannot update Listing"
- "DEVELOPER can read and update FeatureFlag"
- "DEVELOPER cannot read Payout"
- "SRE can read and manage HealthCheck"
- "SRE cannot read Payout"
- "HELPDESK_AGENT can manage HelpdeskCase"
- "staff with no roles has no permissions"

**Dashboard queries tests** (`src/lib/queries/__tests__/admin-dashboard.test.ts`):
- "getDashboardKPIs returns correct counts"
- "getDashboardCharts returns time-series data"

**Settings action tests** (`src/lib/actions/__tests__/admin-settings.test.ts`):
- "updatePlatformSetting creates history row"
- "updatePlatformSetting creates audit event"
- "updatePlatformSetting rejects non-admin"
- "updatePlatformSetting validates input"

**User management action tests** (`src/lib/actions/__tests__/admin-users.test.ts`):
- "suspendUser sets isBanned and creates audit event"
- "suspendUser rejects non-admin/support"
- "restrictSelling sets sellerProfile status"

**Moderation action tests** (`src/lib/actions/__tests__/admin-moderation.test.ts`):
- "removeListing sets enforcementState to REMOVED"
- "clearListingFlag sets enforcementState to CLEAR"
- "removeReview sets review status to REMOVED"
- "moderation actions create audit events"

**Finance action tests** (`src/lib/actions/__tests__/admin-finance.test.ts`):
- "createManualAdjustment creates ledger entry"
- "createManualAdjustment requires reason code and text"
- "createManualAdjustment rejects non-admin"
- "createManualAdjustment creates CRITICAL audit event"

### Edge Cases
- Staff with multiple roles gets union of all permissions
- Staff with ADMIN + MODERATION gets manage all (ADMIN subsumes)
- Attempting to access `/cfg` as FINANCE role returns forbidden
- Empty dashboard (no orders, no users) renders without errors
- Settings with no rows in database return defaults
- User detail for non-existent user shows "Not found"

---

## 7. FILE APPROVAL LIST

### Stream A: Staff Auth + CASL (prerequisite for all other streams)

| # | File Path | Description |
|---|-----------|-------------|
| A1 | `src/lib/auth/staff-auth.ts` | Staff login/session/logout service |
| A2 | `src/lib/casl/types.ts` | Update CaslSession type for platform staff |
| A3 | `src/lib/casl/ability.ts` | Add platform agent + admin ability rules |
| A4 | `src/lib/casl/staff-authorize.ts` | Server-side staff authorization helper |
| A5 | `src/proxy.ts` | Update hub middleware for staff auth gate |
| A6 | `src/app/(hub)/login/page.tsx` | Hub login page |
| A7 | `src/lib/actions/staff-login.ts` | Login server action |
| A8 | `src/lib/casl/__tests__/staff-ability.test.ts` | Staff CASL ability tests |
| A9 | `src/lib/auth/__tests__/staff-auth.test.ts` | Staff auth service tests |

### Stream B: Hub Layout + Shared Components

| # | File Path | Description |
|---|-----------|-------------|
| B1 | `src/app/(hub)/layout.tsx` | Hub layout shell (sidebar + topbar + content) |
| B2 | `src/lib/hub/admin-nav.ts` | Hub sidebar navigation registry with role gates |
| B3 | `src/components/admin/admin-sidebar.tsx` | Admin sidebar component |
| B4 | `src/components/admin/admin-topbar.tsx` | Admin topbar component |
| B5 | `src/components/admin/admin-page-header.tsx` | Reusable page header component |
| B6 | `src/components/admin/stat-card.tsx` | Reusable KPI stat card |
| B7 | `src/components/admin/data-table.tsx` | Reusable sortable data table with pagination |

### Stream C: Dashboard + User Management + Transactions (E3.1 + E3.2 + E3.3)

| # | File Path | Description |
|---|-----------|-------------|
| C1 | `src/lib/queries/admin-dashboard.ts` | Dashboard KPIs + chart data queries |
| C2 | `src/app/(hub)/d/page.tsx` | Platform dashboard page |
| C3 | `src/lib/queries/admin-users.ts` | User list + detail queries |
| C4 | `src/lib/actions/admin-users.ts` | User management actions (suspend, restrict, warn) |
| C5 | `src/app/(hub)/usr/page.tsx` | User list page |
| C6 | `src/app/(hub)/usr/[id]/page.tsx` | User detail page (tabbed) |
| C7 | `src/lib/queries/admin-orders.ts` | Order list + detail queries (admin view) |
| C8 | `src/lib/actions/admin-orders.ts` | Order admin actions (refund, cancel, override) |
| C9 | `src/app/(hub)/tx/page.tsx` | Transaction overview page |
| C10 | `src/app/(hub)/tx/orders/page.tsx` | All orders list page |
| C11 | `src/app/(hub)/tx/orders/[id]/page.tsx` | Order detail page (admin) |
| C12 | `src/app/(hub)/tx/payments/page.tsx` | Payments list page |
| C13 | `src/lib/queries/__tests__/admin-dashboard.test.ts` | Dashboard query tests |
| C14 | `src/lib/actions/__tests__/admin-users.test.ts` | User management action tests |
| C15 | `src/lib/actions/__tests__/admin-orders.test.ts` | Order admin action tests |

### Stream D: Finance + Moderation (E3.4 + E3.5)

| # | File Path | Description |
|---|-----------|-------------|
| D1 | `src/lib/queries/admin-finance.ts` | Finance dashboard + ledger + payout queries |
| D2 | `src/lib/actions/admin-finance.ts` | Manual adjustment action |
| D3 | `src/app/(hub)/fin/page.tsx` | Finance dashboard page |
| D4 | `src/app/(hub)/fin/ledger/page.tsx` | Ledger explorer page |
| D5 | `src/app/(hub)/fin/payouts/page.tsx` | Payouts list page |
| D6 | `src/app/(hub)/fin/recon/page.tsx` | Reconciliation placeholder page |
| D7 | `src/app/(hub)/fin/adjustments/page.tsx` | Adjustments page + create form |
| D8 | `src/app/(hub)/fin/costs/page.tsx` | Platform costs page |
| D9 | `src/lib/queries/admin-moderation.ts` | Moderation queue queries |
| D10 | `src/lib/actions/admin-moderation.ts` | Moderation actions (remove, clear, approve) |
| D11 | `src/app/(hub)/mod/page.tsx` | Moderation overview page |
| D12 | `src/app/(hub)/mod/listings/page.tsx` | Flagged listings page |
| D13 | `src/app/(hub)/mod/messages/page.tsx` | Flagged messages placeholder page |
| D14 | `src/app/(hub)/mod/reviews/page.tsx` | Flagged reviews page |
| D15 | `src/lib/actions/__tests__/admin-finance.test.ts` | Finance action tests |
| D16 | `src/lib/actions/__tests__/admin-moderation.test.ts` | Moderation action tests |

### Stream E: Platform Settings + Safe Meetup Locations (E3.6 + E3.7)

| # | File Path | Description |
|---|-----------|-------------|
| E1 | `src/lib/queries/admin-settings.ts` | Settings queries (by category, by tab) |
| E2 | `src/lib/actions/admin-settings.ts` | Settings update action + history creation |
| E3 | `src/app/(hub)/cfg/page.tsx` | Settings page shell (tab router) |
| E4 | `src/components/admin/settings/settings-tab.tsx` | Generic settings tab component |
| E5 | `src/components/admin/settings/setting-field.tsx` | Individual setting field renderer |
| E6 | `src/components/admin/settings/cents-input.tsx` | CentsInput (shows $, stores cents) |
| E7 | `src/components/admin/settings/bps-input.tsx` | BasisPointsInput (shows %, stores bps) |
| E8 | `src/lib/queries/admin-meetup-locations.ts` | Meetup location CRUD queries |
| E9 | `src/lib/actions/admin-meetup-locations.ts` | Meetup location CRUD actions |
| E10 | `src/app/(hub)/cfg/meetup-locations/page.tsx` | Safe meetup locations management page |
| E11 | `src/lib/actions/__tests__/admin-settings.test.ts` | Settings action tests |
| E12 | `src/lib/actions/__tests__/admin-meetup-locations.test.ts` | Meetup location action tests |

**Total: 55 files** (9 Stream A + 7 Stream B + 15 Stream C + 16 Stream D + 12 Stream E = 59, minus 4 shared deps = 55 unique files)

---

## 8. PARALLEL STREAMS

### Dependency Graph

```
Stream A: Staff Auth + CASL
    |
    v
Stream B: Hub Layout + Shared Components
    |
    +------+------+------+
    |      |      |      |
    v      v      v      v
Stream C  Stream D  Stream E
(Dashboard (Finance  (Settings
 +Users    +Mod)     +Meetup)
 +Orders)
```

Stream A MUST complete first (all other streams depend on `staffAuthorize()` and CASL rules).
Stream B MUST complete second (all page streams depend on layout shell + shared components).
Streams C, D, E can execute in parallel after B completes.

### Stream A — Staff Auth + CASL

**Goal:** Enable platform staff to authenticate and get correct CASL abilities.

**Tasks (sequential):**
1. Update `CaslSession` type in `src/lib/casl/types.ts`
2. Add `PlatformRole` type
3. Implement `definePlatformAgentAbilities()` and `definePlatformAdminAbilities()` in `src/lib/casl/ability.ts`
4. Update `defineAbilitiesFor()` to handle platform staff sessions
5. Implement `src/lib/auth/staff-auth.ts` (login, session management, logout)
6. Implement `src/lib/casl/staff-authorize.ts`
7. Update `src/proxy.ts` for hub auth gate
8. Implement login page + server action
9. Write all tests

**Interface contracts consumed by other streams:**

```typescript
// From src/lib/casl/staff-authorize.ts
export interface StaffCaslSession {
  staffUserId: string;
  email: string;
  displayName: string;
  isPlatformStaff: true;
  platformRoles: PlatformRole[];
}

export async function staffAuthorize(): Promise<{
  ability: AppAbility;
  session: StaffCaslSession;
}>;

// From src/lib/casl/types.ts
export type PlatformRole =
  | 'HELPDESK_AGENT' | 'HELPDESK_LEAD' | 'HELPDESK_MANAGER'
  | 'SUPPORT' | 'MODERATION' | 'FINANCE'
  | 'DEVELOPER' | 'SRE' | 'ADMIN' | 'SUPER_ADMIN';
```

### Stream B — Hub Layout + Shared Components

**Goal:** Provide the persistent hub shell and reusable components.

**Tasks (sequential):**
1. Implement `src/lib/hub/admin-nav.ts` — navigation registry
2. Implement `src/components/admin/admin-sidebar.tsx`
3. Implement `src/components/admin/admin-topbar.tsx`
4. Implement `src/components/admin/admin-page-header.tsx`
5. Implement `src/components/admin/stat-card.tsx`
6. Implement `src/components/admin/data-table.tsx`
7. Replace `src/app/(hub)/layout.tsx` with full hub layout shell

**Interface contracts consumed by other streams:**

```typescript
// From src/components/admin/admin-page-header.tsx
export function AdminPageHeader(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.ReactElement;

// From src/components/admin/stat-card.tsx
export function StatCard(props: {
  label: string;
  value: string | number;
  change?: { value: number; period: string };
  icon?: React.ReactNode;
}): React.ReactElement;

// From src/components/admin/data-table.tsx
export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
};

export function DataTable<T>(props: {
  columns: DataTableColumn<T>[];
  data: T[];
  pagination?: { page: number; pageSize: number; total: number };
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}): React.ReactElement;

// From src/lib/hub/admin-nav.ts
export type AdminNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  roles: PlatformRole[] | 'any'; // 'any' = any staff role
};

export const ADMIN_NAV: AdminNavItem[];

export function filterAdminNav(
  nav: AdminNavItem[],
  roles: PlatformRole[]
): AdminNavItem[];
```

### Stream C — Dashboard + Users + Transactions (E3.1, E3.2, E3.3)

**Goal:** Build the dashboard, user management, and transaction management pages.

**Depends on:** Stream A (staffAuthorize), Stream B (layout + components)

**Tasks:**
1. `src/lib/queries/admin-dashboard.ts` — KPI and chart queries
2. `src/app/(hub)/d/page.tsx` — Dashboard page
3. `src/lib/queries/admin-users.ts` — User queries
4. `src/lib/actions/admin-users.ts` — User management actions
5. `src/app/(hub)/usr/page.tsx` — User list
6. `src/app/(hub)/usr/[id]/page.tsx` — User detail
7. `src/lib/queries/admin-orders.ts` — Admin order queries
8. `src/lib/actions/admin-orders.ts` — Admin order actions
9. `src/app/(hub)/tx/page.tsx` — Transaction overview
10. `src/app/(hub)/tx/orders/page.tsx` — Orders list
11. `src/app/(hub)/tx/orders/[id]/page.tsx` — Order detail
12. `src/app/(hub)/tx/payments/page.tsx` — Payments list
13. Write all tests

### Stream D — Finance + Moderation (E3.4, E3.5)

**Goal:** Build the finance overview and moderation queue pages.

**Depends on:** Stream A (staffAuthorize), Stream B (layout + components)

**Tasks:**
1. `src/lib/queries/admin-finance.ts` — Finance queries
2. `src/lib/actions/admin-finance.ts` — Manual adjustment action
3. `src/app/(hub)/fin/page.tsx` — Finance dashboard
4. `src/app/(hub)/fin/ledger/page.tsx` — Ledger explorer
5. `src/app/(hub)/fin/payouts/page.tsx` — Payouts list
6. `src/app/(hub)/fin/recon/page.tsx` — Recon placeholder
7. `src/app/(hub)/fin/adjustments/page.tsx` — Adjustments
8. `src/app/(hub)/fin/costs/page.tsx` — Platform costs
9. `src/lib/queries/admin-moderation.ts` — Moderation queries
10. `src/lib/actions/admin-moderation.ts` — Moderation actions
11. `src/app/(hub)/mod/page.tsx` — Moderation overview
12. `src/app/(hub)/mod/listings/page.tsx` — Flagged listings
13. `src/app/(hub)/mod/messages/page.tsx` — Messages placeholder
14. `src/app/(hub)/mod/reviews/page.tsx` — Flagged reviews
15. Write all tests

### Stream E — Settings + Meetup Locations (E3.6, E3.7)

**Goal:** Build the platform settings management UI and safe meetup location management.

**Depends on:** Stream A (staffAuthorize), Stream B (layout + components)

**Tasks:**
1. `src/lib/queries/admin-settings.ts` — Settings queries
2. `src/lib/actions/admin-settings.ts` — Settings update action
3. `src/app/(hub)/cfg/page.tsx` — Settings page shell
4. `src/components/admin/settings/settings-tab.tsx` — Tab component
5. `src/components/admin/settings/setting-field.tsx` — Field renderer
6. `src/components/admin/settings/cents-input.tsx` — CentsInput
7. `src/components/admin/settings/bps-input.tsx` — BasisPointsInput
8. `src/lib/queries/admin-meetup-locations.ts` — Location queries
9. `src/lib/actions/admin-meetup-locations.ts` — Location CRUD actions
10. `src/app/(hub)/cfg/meetup-locations/page.tsx` — Locations page
11. Write all tests

### Merge Verification

After all streams complete, verify:
- [ ] All hub sidebar links navigate to working pages
- [ ] Role gating works end-to-end (login as FINANCE role, verify cannot access /mod)
- [ ] Staff login -> navigate all pages -> logout works without errors
- [ ] Existing disputes page at `/mod/disputes` still works within new layout
- [ ] All audit events are created for admin actions
- [ ] Settings changes persist and are retrievable
- [ ] `pnpm typecheck` passes with 0 errors
- [ ] `pnpm test` passes with >= 1214 tests (baseline)
- [ ] No files over 300 lines
- [ ] No banned terms in any created file

---

## 9. VERIFICATION CHECKLIST

After implementation, run these commands and paste the RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. File size check (no files over 300 lines)
find src/app/\(hub\) src/lib/actions/admin-* src/lib/queries/admin-* src/lib/auth/staff-* src/lib/casl/staff-* src/lib/hub src/components/admin -name '*.ts' -o -name '*.tsx' 2>/dev/null | xargs wc -l | sort -rn | head -20

# 4. Banned terms check
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|Twicely Balance\|wallet\|Withdraw" src/app/\(hub\) src/components/admin src/lib/actions/admin-* src/lib/queries/admin-* src/lib/hub 2>/dev/null || echo "No banned terms found"

# 5. Route prefix check
grep -rn '"/admin\|"/dashboard\|"/store/' src/app/\(hub\) src/components/admin 2>/dev/null || echo "No wrong routes found"

# 6. Full lint script
./twicely-lint.sh
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 1214 passing (at least ~30 new tests from E3)
- All files under 300 lines
- Zero banned terms
- Zero wrong route prefixes
- Full lint script passes

---

## 10. SPEC INCONSISTENCIES & GAPS

These require owner decisions before implementation:

### Gap 1: Staff Notes Table
The Page Registry specifies a "Notes" tab on user detail with "internal staff notes (not visible to user)" but no `staffNote` table exists in the schema doc. **Ask before implementing.** Recommend: simple `staff_note` table with `id, targetUserId, staffUserId, content, createdAt`.

### Gap 2: Meetup Location Route
E3.7 (safe meetup location management) has no explicit route in the Page Registry. It is mentioned as a build step. **Recommend:** `/cfg/meetup-locations` as a sub-page, or a section within the Commerce tab.

### Gap 3: Environment Secrets Table
The Platform Settings Canonical specifies an `environmentSecret` table (Section 1.3) but the actual schema in `src/lib/db/schema/platform.ts` does NOT have this table. The `platformSetting` table has an `isSecret` boolean column. **For E3.6:** Use `platformSetting` rows with `isSecret: true` for the Environment tab. Full `environmentSecret` table can be added in A2.1 schema addendum.

### Gap 4: Hub Auth — Separate from Marketplace Auth
The Actors Canonical specifies platform staff have their own session type (`staffSession` table). The `CaslSession` type currently mixes marketplace and platform concepts. The cleanest approach: `staffAuthorize()` reads the staff cookie, queries `staffUser` + `staffUserRole` + `staffSession`, and returns a `StaffCaslSession` that feeds into the ability factory. This is a separate auth flow from Better Auth marketplace auth. **This is an architectural decision that affects all hub routes.**

### Terminology Note (from Actors Canonical)
The Actors doc uses `/corp/*` route prefix in some places. This was the V2 naming. V3 uses the subdomain `hub.twicely.co` with direct route prefixes (`/d`, `/usr`, `/tx`, etc.). The install prompt uses V3 routes throughout.

---

**END OF INSTALL PROMPT — E3 Admin Dashboard (hub.twicely.co)**
