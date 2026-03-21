# Install Prompt: I7 — Trust & Safety Suite (Hub Admin Pages)

**Phase & Step:** `[I7]`
**Feature Name:** Trust & Safety Suite — Hub Admin Pages
**One-line Summary:** Build 5 new hub pages for trust score overview, individual seller trust profiles, trust settings configuration, risk/fraud signals, and security event audit — all reading from existing schema tables.
**Canonical Sources (READ BEFORE STARTING):**

1. `read-me/TWICELY_V3_SELLER_SCORE_CANONICAL.md` — Trust score engine, performance bands, enforcement, hub admin view (Sections 9, 10, 11)
2. `read-me/TWICELY_V3_SCHEMA_v2_1_0.md` — `sellerProfile` (Section 2.3), `sellerPerformance` (Section 8.3), `sellerScoreSnapshot` (Section 8.5), `auditEvent` (Section 14.4)
3. `read-me/TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` — Section 10: Trust & Quality (`trust.*` keys)
4. `read-me/TWICELY_V3_PAGE_REGISTRY.md` — Hub routes: `/cfg/trust`, `/security` (Feature Lock-in Section 23)
5. `read-me/TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — Section 13 (Security Event Logging, Fraud Detection Patterns), Section 19 (new CASL subjects: SecurityEvent, FraudCase)
6. `read-me/TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — Section 33 (User Detail Trust Section), Section 23 (Hub routes including `/mod/fraud`, `/cfg/trust`, `/security`)

---

## 1. PREREQUISITES

### Completed Phases/Steps
- Phase A-G: 100% complete (all 183 steps)
- Phase H: H1.1-H1.4, H2.1-H2.3, H3.1 complete
- I1-I6 (parallel batch): complete
- `sellerProfile` table exists with `trustScore`, `sellerScore`, `performanceBand`, `enforcementLevel`, `bandOverride*` fields
- `sellerPerformance` table exists with cached aggregates (defectRate, inadRate, chargebackRate, etc.)
- `sellerScoreSnapshot` table exists with daily snapshot data, metric scores, band transitions
- `auditEvent` table exists with severity, action, subject, ipAddress, userAgent fields
- `platformSetting` table exists with trust.* category keys seeded in `v32-platform-settings-extended.ts`
- `staffAuthorize()` and CASL infrastructure fully wired

### Existing Infrastructure Used
- `src/lib/casl/staff-authorize.ts` — `staffAuthorize()` for all server components
- `src/lib/casl/platform-abilities.ts` — MODERATION and ADMIN role definitions
- `src/lib/casl/subjects.ts` — existing subject list (needs 2 additions)
- `src/lib/queries/admin-settings.ts` — `getSettingsByCategory()`, `getSettingsByKeys()`
- `src/lib/queries/admin-sellers.ts` — existing seller list/query patterns
- `src/components/admin/admin-page-header.tsx` — `AdminPageHeader` component
- `src/components/admin/stat-card.tsx` — `StatCard` component
- `src/app/(hub)/cfg/trust/page.tsx` — existing trust settings page (will be ENRICHED, not replaced)
- `src/app/(hub)/mod/page.tsx` — reference pattern for hub dashboard pages

### No New npm Packages Required
All UI components use existing shadcn/ui + lucide-react. No new dependencies.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2.1 CASL Additions (2 new subjects)

Per Actors/Security Canonical Section 19, add these to `src/lib/casl/subjects.ts`:

```
'TrustSafety'     — trust score viewing, override, threshold settings
'SecurityEvent'   — security log viewing
```

**NOTE:** `FraudCase` subject is specified in Actors/Security Section 19 but there is no `fraud_case` table in the schema. Flag it with a comment `// FraudCase — deferred until fraud_case table exists` but do NOT add it to the subjects array yet.

Add CASL rules to `src/lib/casl/platform-abilities.ts`:
- MODERATION: `can('read', 'TrustSafety')` (view trust scores, seller trust profiles)
- ADMIN: already has `can('manage', 'all')` so no explicit addition needed, but TrustSafety and SecurityEvent will be governed by it
- SUPPORT: `can('read', 'TrustSafety')` (view trust context during disputes)

### 2.2 Database — NO NEW TABLES

All data comes from existing tables. This step creates NO new tables, NO migrations.

**Tables read from:**

| Table | Schema File | Used For |
|-------|------------|----------|
| `sellerProfile` | `src/lib/db/schema/identity.ts` | `trustScore`, `sellerScore`, `performanceBand`, `enforcementLevel`, `bandOverride`, `bandOverrideReason`, `bandOverrideBy`, `bandOverrideExpiresAt` |
| `sellerPerformance` | `src/lib/db/schema/reviews.ts` | `defectRate`, `inadRate`, `chargebackRate`, `lateShipmentRate`, `cancelRate`, `returnRate`, `currentBand`, `onTimeShippingPct`, `avgResponseTimeHours` |
| `sellerScoreSnapshot` | `src/lib/db/schema/finance.ts` | Historical score data, band transitions, per-metric scores, `searchMultiplier`, `trendModifier` |
| `auditEvent` | `src/lib/db/schema/platform.ts` | Security events filtered by `action LIKE 'security.%'`, severity-based filtering |
| `platformSetting` | `src/lib/db/schema/platform.ts` | `trust.*` category settings for the settings editor |
| `user` | `src/lib/db/schema/auth.ts` | Join for seller name/email display |

### 2.3 Query Files

**File: `src/lib/queries/admin-trust.ts`** — New file, all trust/risk/security queries.

Functions to implement:

```typescript
// --- Trust Overview Dashboard ---
getTrustOverviewKPIs(): Promise<TrustOverviewKPIs>
// Returns: totalSellers, avgTrustScore, avgSellerScore, bandDistribution (count per band),
//          enforcementCounts (per level), overrideCounts (active overrides),
//          sellersInCoaching, sellersInWarning, sellersInRestriction, sellersInPreSuspension

getTrustBandDistribution(): Promise<Array<{ band: string; count: number }>>
// Group sellerProfile by performanceBand, count each

getEnforcementDistribution(): Promise<Array<{ level: string; count: number }>>
// Group sellerProfile by enforcementLevel WHERE enforcementLevel IS NOT NULL

getRecentBandTransitions(limit?: number): Promise<BandTransition[]>
// From sellerScoreSnapshot WHERE previousBand IS NOT NULL AND bandChangedAt IS NOT NULL
// ORDER BY bandChangedAt DESC, LIMIT 20 default
// Join user for name/email

getTrustScoreTimeline(days?: number): Promise<Array<{ date: string; avgScore: number }>>
// From sellerScoreSnapshot, GROUP BY snapshotDate, AVG(overallScore)
// Last 90 days default

// --- Seller Trust Profile (detail page) ---
getSellerTrustProfile(userId: string): Promise<SellerTrustProfile | null>
// Joins sellerProfile + sellerPerformance + user
// Returns all trust fields: trustScore, sellerScore, performanceBand, enforcementLevel,
// bandOverride*, all performance rates, metric scores

getSellerScoreHistory(userId: string, days?: number): Promise<SellerScoreSnapshot[]>
// From sellerScoreSnapshot WHERE userId = X ORDER BY snapshotDate DESC
// Last 90 days default. Returns full snapshot rows.

// --- Risk/Fraud Signals ---
getRiskSignals(): Promise<RiskSignals>
// Aggregates from sellerProfile + auditEvent:
//   - Sellers with trustScore < trust.bandLimitedMin (40 default)
//   - Sellers with enforcementLevel = 'PRE_SUSPENSION'
//   - Recent chargebacks (auditEvent WHERE action = 'security.fraud.flagged')
//   - Sellers with high defect rates (sellerPerformance.defectRate > trust.standards.maxDefectRatePercent)
//   - Active band overrides count

// --- Security Events ---
getSecurityEvents(opts: SecurityEventOpts): Promise<{ events: SecurityEventRow[]; total: number }>
// From auditEvent WHERE action LIKE 'security.%'
// Opts: page, pageSize, severity filter, action filter, dateRange
// Returns: id, actorType, actorId, action, subject, subjectId, severity, detailsJson, ipAddress, userAgent, createdAt

getSecurityEventKPIs(): Promise<SecurityEventKPIs>
// Counts from auditEvent WHERE action LIKE 'security.%':
//   - last24h, last7d, last30d counts
//   - by severity (CRITICAL, HIGH, MEDIUM, LOW)
//   - top 5 most frequent event types
```

**Types to define in the same file:**

```typescript
interface TrustOverviewKPIs {
  totalSellers: number;
  avgTrustScore: number;
  avgSellerScore: number;
  bandDistribution: Array<{ band: string; count: number }>;
  enforcementCounts: { coaching: number; warning: number; restriction: number; preSuspension: number };
  activeOverrides: number;
}

interface BandTransition {
  userId: string;
  userName: string;
  previousBand: string;
  newBand: string;
  sellerScore: number;
  changedAt: Date;
}

interface SellerTrustProfile {
  userId: string;
  name: string;
  email: string;
  trustScore: number;
  sellerScore: number;
  performanceBand: string;
  enforcementLevel: string | null;
  enforcementStartedAt: Date | null;
  warningExpiresAt: Date | null;
  bandOverride: string | null;
  bandOverrideExpiresAt: Date | null;
  bandOverrideReason: string | null;
  bandOverrideBy: string | null;
  isNew: boolean;
  // From sellerPerformance
  defectRate: number;
  inadRate: number;
  chargebackRate: number;
  lateShipmentRate: number;
  cancelRate: number;
  returnRate: number;
  onTimeShippingPct: number | null;
  avgResponseTimeHours: number | null;
  currentBand: string;
  totalOrders: number;
  completedOrders: number;
  averageRating: number | null;
}

interface SellerScoreSnapshot {
  id: string;
  snapshotDate: string | null;
  overallScore: number;
  performanceBand: string;
  searchMultiplier: number | null;
  shippingScore: number | null;
  inadScore: number | null;
  reviewScore: number | null;
  responseScore: number | null;
  returnScore: number | null;
  cancellationScore: number | null;
  trendModifier: number | null;
  orderCount: number;
  previousBand: string | null;
  bandChangedAt: Date | null;
}

interface SecurityEventOpts {
  page: number;
  pageSize: number;
  severity?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

interface SecurityEventRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  subject: string;
  subjectId: string | null;
  severity: string;
  detailsJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface SecurityEventKPIs {
  last24h: number;
  last7d: number;
  last30d: number;
  bySeverity: Array<{ severity: string; count: number }>;
  topEventTypes: Array<{ action: string; count: number }>;
}

interface RiskSignals {
  restrictedSellers: number;
  preSuspensionSellers: number;
  highDefectSellers: number;
  recentFraudFlags: number;
  activeOverrides: number;
  lowTrustSellers: number;
}
```

### 2.4 Server Actions

**File: `src/lib/actions/admin-trust.ts`** — New file, trust override action.

```typescript
'use server';

// updateBandOverride — ADMIN only
// Input: Zod schema with .strict()
//   userId: z.string()
//   newBand: z.enum(['POWER_SELLER', 'TOP_RATED', 'ESTABLISHED', 'EMERGING'])
//   reason: z.string().min(10).max(500)
//   expiresInDays: z.number().int().min(1).max(365).optional().default(90)
//
// Authorization: staffAuthorize() + ability.can('update', 'SellerProfile')
// Logic:
//   1. Get current sellerProfile for userId
//   2. Set bandOverride, bandOverrideReason, bandOverrideBy (session staffUser.id), bandOverrideExpiresAt
//   3. Log audit event: action='trust.band_override', severity='HIGH'
//   4. revalidatePath('/trust')
//   5. revalidatePath(`/trust/sellers/${userId}`)
//
// CRITICAL: Use explicit field mapping. Never spread input into DB update.
// CRITICAL: bandOverrideBy = session userId (the admin who performed the action)

// revokeBandOverride — ADMIN only
// Input: userId: z.string(), reason: z.string().min(5)
// Sets bandOverride = null, bandOverrideExpiresAt = null, bandOverrideReason = null, bandOverrideBy = null
// Logs audit event: action='trust.band_override_revoked', severity='MEDIUM'
```

**CRITICAL:** Keep helpers unexported. Only the two action functions should be exported to prevent unintended server action exposure.

### 2.5 Pages

#### Page 1: `/trust` — Trust Score Overview Dashboard

**File:** `src/app/(hub)/trust/page.tsx`
**Layout:** `hub` (staff layout)
**Auth:** `staffAuthorize()` + `ability.can('read', 'TrustSafety')`
**Roles:** ADMIN, MODERATION, SUPPORT

Content:
- `AdminPageHeader` with title "Trust & Safety" and description "Seller trust scores, performance bands, and enforcement overview"
- **KPI Row** (StatCard grid, 2 rows of 4):
  - Total Sellers (Users icon)
  - Avg Trust Score (ShieldCheck icon)
  - Avg Seller Score (BarChart2 icon)
  - Active Overrides (AlertTriangle icon)
  - In Coaching (count) (MessageSquare icon)
  - In Warning (count) (AlertTriangle icon, color=warning)
  - In Restriction (count) (Shield icon, color=error)
  - Pre-Suspension (count) (Ban icon, color=error)
- **Band Distribution Section**: Cards showing POWER_SELLER / TOP_RATED / ESTABLISHED / EMERGING / SUSPENDED counts with the band colors from Seller Score Canonical Section 3.1:
  - POWER_SELLER: #7C3AED (purple)
  - TOP_RATED: #F59E0B (gold/amber)
  - ESTABLISHED: #10B981 (green)
  - EMERGING: gray
  - SUSPENDED: red
- **Recent Band Transitions** table (last 20): userId (link to `/trust/sellers/[id]`), seller name, previous band, new band, score, date
- **Navigation Cards** (links to sub-pages):
  - "Seller Trust Profiles" -> `/trust/sellers` placeholder (or inline search, see below)
  - "Trust Settings" -> `/cfg/trust` (existing page)
  - "Risk Signals" -> `/risk`
  - "Security Events" -> `/security`

**Seller Search**: Include a simple search input at the top that filters sellers by name/email and links to `/trust/sellers/[userId]`. This avoids creating a separate `/trust/sellers` list page — the user detail page already exists at `/usr/[id]`.

#### Page 2: `/trust/sellers/[id]` — Individual Seller Trust Profile

**File:** `src/app/(hub)/trust/sellers/[id]/page.tsx`
**Layout:** `hub`
**Auth:** `staffAuthorize()` + `ability.can('read', 'TrustSafety')`
**Roles:** ADMIN, MODERATION, SUPPORT

Content (per Seller Score Canonical Section 9.1):
- `AdminPageHeader` with title "{Seller Name} — Trust Profile"
- **Hero Card**: Trust score (large number), seller score, performance band badge (colored per Section 3.1), enforcement status, trend state indicator
  - If band override active: show override badge with reason and expiry
- **Score History Chart placeholder**: Display last 90 days of scores from `sellerScoreSnapshot` as a simple HTML table (chart library integration deferred to I17). Columns: Date, Score, Band, Shipping Score, INAD Score, Review Score, Response Score, Return Score, Cancellation Score, Trend Modifier
- **Performance Metrics Grid** (6 cards, one per metric from Seller Score Canonical Section 2.1):
  - On-Time Shipping: `onTimeShippingPct` from sellerPerformance
  - INAD Rate: `inadRate` from sellerPerformance
  - Review Average: `averageRating` from sellerPerformance
  - Response Time: `avgResponseTimeHours` from sellerPerformance
  - Return Rate: `returnRate` from sellerPerformance
  - Cancellation Rate: `cancelRate` from sellerPerformance
  Each card shows: value, whether above/below ideal threshold, weight percentage (25%, 20%, 20%, 15%, 10%, 10%)
- **Enforcement Section**: Current enforcement level (if any), started at, warning expiry
- **Override Controls** (ADMIN only — check `ability.can('update', 'SellerProfile')`):
  - If no active override: "Set Band Override" form with band dropdown (POWER_SELLER, TOP_RATED, ESTABLISHED, EMERGING), reason text field (required, min 10 chars), expiry days input (default 90)
  - If override active: Show current override details + "Revoke Override" button with reason input
  - Both submit to server actions in `admin-trust.ts`
- **Quick Links**: Link to `/usr/[id]` (full user detail), link to `/mod/enforcement?seller=[id]` (enforcement actions for this seller)

#### Page 3: `/trust/settings` — Trust Event Weights Configuration

**File:** `src/app/(hub)/trust/settings/page.tsx`
**Layout:** `hub`
**Auth:** `staffAuthorize()` + `ability.can('update', 'Setting')`
**Roles:** ADMIN only

Content:
- `AdminPageHeader` with title "Trust Score Configuration" and description "Configure trust event weights, band thresholds, and enforcement parameters"
- **3 Sections**, each as a settings form using the existing `SettingsHubForm` pattern:

**Section A: Band Thresholds** — Display and edit these `trust.*` platform settings:
  - `trust.baseScore` (default: 80)
  - `trust.bandExcellentMin` (default: 90)
  - `trust.bandGoodMin` (default: 75)
  - `trust.bandWatchMin` (default: 60)
  - `trust.bandLimitedMin` (default: 40)
  - `trust.volumeCapped` (default: 10)
  - `trust.volumeLimited` (default: 50)
  - `trust.decayHalfLifeDays` (default: 90)

**Section B: Event Weights** — Display and edit these `trust.event.*` settings:
  - `trust.event.review5Star` (+1.0)
  - `trust.event.review4Star` (+0.5)
  - `trust.event.review3Star` (-1.5)
  - `trust.event.review2Star` (-4.0)
  - `trust.event.review1Star` (-7.0)
  - `trust.event.lateShipment` (-2.0)
  - `trust.event.sellerCancel` (-3.0)
  - `trust.event.refundSellerFault` (-4.0)
  - `trust.event.disputeOpened` (-2.0)
  - `trust.event.disputeSellerFault` (-6.0)
  - `trust.event.chargeback` (-8.0)
  - `trust.event.policyViolation` (-12.0)

**Section C: Seller Standards** — Display and edit these `trust.standards.*` settings:
  - `trust.standards.evaluationPeriodDays` (90)
  - `trust.standards.minOrdersForEvaluation` (10)
  - `trust.standards.maxDefectRatePercent` (2.0)
  - `trust.standards.maxLateShipRatePercent` (4.0)
  - `trust.standards.maxUnresolvedCasesPercent` (0.3)
  - `trust.standards.topRatedMaxDefectRate` (0.5)
  - `trust.standards.topRatedMaxLateShipRate` (1.0)
  - `trust.standards.topRatedMinOrdersYear` (100)
  - `trust.standards.belowStandardVisibilityReduction` (50.0)
  - `trust.standards.restrictedMaxListings` (10)
  - `trust.standards.defectExpiryDays` (365)

Use the existing `getSettingsByKeys()` query to load values. Editing uses the existing `updatePlatformSetting` action (already exists from E3/V3.2 settings infrastructure).

**NOTE:** `trust.standards.belowStandardFvfSurcharge` key exists in Platform Settings Canonical but references "FVF" which is a banned term. This key exists in the seed data. Display it with label "Below Standard TF Surcharge" in the UI. Do NOT rename the key in the database -- only control the display label.

#### Page 4: `/risk` — Risk Signals / Fraud Overview

**File:** `src/app/(hub)/risk/page.tsx`
**Layout:** `hub`
**Auth:** `staffAuthorize()` + `ability.can('read', 'TrustSafety')`
**Roles:** ADMIN, MODERATION, SUPPORT

Content:
- `AdminPageHeader` with title "Risk Signals" and description "Fraud detection overview and risk monitoring"
- **KPI Row** (StatCard grid):
  - Low Trust Sellers (trustScore < 40)
  - Pre-Suspension Sellers
  - High Defect Rate Sellers (defectRate > maxDefectRatePercent)
  - Recent Fraud Flags (auditEvent security.fraud.flagged in last 7d)
  - Active Band Overrides
  - Restricted Sellers (enforcementLevel = 'RESTRICTION')
- **Fraud Detection Patterns** section: Static informational card listing the 7 fraud patterns from Actors/Security Canonical Section 13.2:
  - Account takeover, Shill buying, Listing hijack, Drop shipping abuse, Return fraud, Chargeback abuse, Velocity abuse
  - Each with detection method and action columns
  - This is a reference panel, NOT live detection (live detection is future scope)
- **Navigation Cards**:
  - "Enforcement Actions" -> `/mod/enforcement`
  - "Content Reports" -> `/mod/reports`
  - "Security Events" -> `/security`
  - "Trust Overview" -> `/trust`

#### Page 5: `/security` — Security Events Audit

**File:** `src/app/(hub)/security/page.tsx`
**Layout:** `hub`
**Auth:** `staffAuthorize()` + `ability.can('read', 'AuditEvent')`
**Roles:** ADMIN, SRE (per Actors/Security Canonical Section 19 — "ADMIN covers security config, SRE covers monitoring")

Content:
- `AdminPageHeader` with title "Security Events" and description "Authentication audit, security alerts, and incident monitoring"
- **KPI Row** (StatCard grid):
  - Events (Last 24h)
  - Events (Last 7d)
  - Events (Last 30d)
  - Critical Events (count where severity = 'CRITICAL')
- **Severity Breakdown**: 4 small cards showing CRITICAL / HIGH / MEDIUM / LOW counts (last 30 days)
- **Event Types Breakdown**: Top 5 most frequent security event types with counts
- **Security Events Table** (paginated):
  - Columns: Time, Severity (badge colored), Action, Subject, Actor, IP Address
  - Filters: severity dropdown, action type dropdown (values from Actors/Security Section 19: security.login.failed, security.session.revoked, security.2fa.setup, security.2fa.removed, security.payout_destination.changed, security.password.changed, security.email.changed, security.fraud.flagged, security.incident.created)
  - Pagination: 20 per page, server-side via searchParams
  - Each row expandable/clickable to show detailsJson and userAgent
- **Reference Panel**: Security event definitions table from Actors/Security Section 13.1 (static, informational)

### 2.6 Admin Navigation

**DO NOT modify `src/lib/hub/admin-nav.ts`.** Navigation entries for /trust, /risk, /security are deferred to I17 (Nav Consolidation).

Instead, leave `// NAV_ENTRY:` comments at the top of each new page file following the existing pattern (see `src/app/(hub)/usr/[id]/page.tsx` line 1 for example):

```
// /trust page:
// NAV_ENTRY: { label: 'Trust & Safety', href: '/trust', icon: 'ShieldCheck', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] }

// /risk page:
// NAV_ENTRY: { label: 'Risk Signals', href: '/risk', icon: 'AlertTriangle', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] }

// /security page:
// NAV_ENTRY: { label: 'Security', href: '/security', icon: 'Shield', roles: ['ADMIN', 'SRE'] }
```

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- Never use "SellerTier" -- use StoreTier or ListerTier
- Never use "FVF" or "Final Value Fee" in UI copy -- use "TF" or "Transaction Fee"
- Never use "Twicely Balance" -- use "Available for payout"
- Never use "wallet" in seller-facing UI
- Never use "BASIC", "ELITE", "PLUS", "MAX", "PREMIUM" as tier names
- Never use "STANDARD" or "RISING" as performance bands

### Tech Stack
- Never use Prisma, NextAuth, Redis, Zustand, tRPC
- All queries use Drizzle ORM
- All auth uses `staffAuthorize()` (staff auth, NOT Better Auth user auth)

### Architecture
- Do NOT create any new database tables or migrations
- Do NOT modify `src/lib/hub/admin-nav.ts` (deferred to I17)
- Do NOT create any new CASL action types -- only subjects
- Do NOT build live fraud detection logic -- the /risk page shows aggregated signals, not real-time detection
- Do NOT build chart rendering (use HTML tables for score history) -- chart library integration deferred
- Do NOT create client components unless absolutely necessary for interactivity (override form, search input). Server components preferred.
- Max 300 lines per file. Split components if needed.
- All monetary values in integer cents
- All rate values display as percentages (multiply by 100 if stored as decimal)
- Ownership: all queries filter by `userId`, never `storeId` or `sellerProfileId` for business data
  - Exception: `sellerPerformance.sellerProfileId` is the FK -- when joining, go through `sellerProfile.id` then to `sellerProfile.userId`
- Keep all helper functions in action files unexported to prevent unintended server action exposure

### Route Enforcement
- Hub pages under `(hub)` route group
- Trust pages: `/trust`, `/trust/sellers/[id]`, `/trust/settings`
- Risk page: `/risk`
- Security page: `/security`
- NEVER use `/admin`, `/dashboard`, `/store/`, `/listing/`

---

## 4. ACCEPTANCE CRITERIA

### Positive Cases
1. ADMIN staff can access all 5 pages (/trust, /trust/sellers/[id], /trust/settings, /risk, /security)
2. MODERATION staff can access /trust, /trust/sellers/[id], /risk but NOT /trust/settings or /security
3. SUPPORT staff can access /trust, /trust/sellers/[id], /risk but NOT /trust/settings or /security
4. SRE staff can access /security but NOT /trust, /trust/settings, or /risk
5. /trust page shows correct band distribution counts matching database
6. /trust/sellers/[id] shows all 6 metric values from sellerPerformance
7. /trust/sellers/[id] shows score history from sellerScoreSnapshot
8. /trust/settings page loads all trust.* platform settings with correct default values
9. Band override form on seller trust profile works: sets bandOverride, bandOverrideBy, bandOverrideExpiresAt on sellerProfile
10. Override revoke clears all bandOverride fields
11. /risk page shows aggregated risk signal counts
12. /security page shows filtered audit events with `action LIKE 'security.%'`
13. /security page pagination works with server-side searchParams
14. All server actions call `staffAuthorize()` as the FIRST operation
15. All band colors match Seller Score Canonical Section 3.1 exactly

### Negative Cases
1. Unauthenticated users get redirected (staffAuthorize throws)
2. DEVELOPER staff CANNOT access /trust, /risk, or /trust/settings (only /security via AuditEvent read access would be checked, but the page specifically checks for ADMIN/SRE)
3. FINANCE staff CANNOT access any of the 5 pages
4. Band override with reason < 10 characters is rejected by Zod validation
5. Band override on non-existent userId returns error (not found)
6. Override form is NOT visible to MODERATION or SUPPORT staff (only ADMIN)
7. SUSPENDED is NOT an option in the band override dropdown (it is an admin enforcement action, not a score-derived override per Seller Score Canonical Section 3.2)

### Data Integrity
1. `bandOverrideBy` is set to the admin's userId from session, NEVER from request body
2. All audit events logged with correct action, severity, and details
3. Trust settings edits go through existing `updatePlatformSetting` action (audit trail maintained)
4. No raw SQL -- all queries through Drizzle ORM
5. `detailsJson` in audit events is valid JSON

### Vocabulary
1. Zero occurrences of banned terms in any created/modified file
2. Performance band labels match exactly: POWER_SELLER, TOP_RATED, ESTABLISHED, EMERGING, SUSPENDED
3. No "FVF" in any UI label -- "Below Standard TF Surcharge" used instead

---

## 5. TEST REQUIREMENTS

### Unit Tests

**File: `src/lib/queries/__tests__/admin-trust.test.ts`**

Test descriptions:
- `getTrustOverviewKPIs returns correct band distribution counts`
- `getTrustOverviewKPIs returns correct enforcement level counts`
- `getTrustBandDistribution groups by performanceBand correctly`
- `getRecentBandTransitions returns transitions ordered by date desc`
- `getRecentBandTransitions respects limit parameter`
- `getSellerTrustProfile returns null for non-existent userId`
- `getSellerTrustProfile joins sellerPerformance metrics correctly`
- `getSellerScoreHistory returns snapshots ordered by date desc`
- `getSellerScoreHistory respects days parameter`
- `getRiskSignals counts restricted sellers correctly`
- `getRiskSignals counts low trust sellers below threshold`
- `getSecurityEvents filters by severity`
- `getSecurityEvents filters by action prefix`
- `getSecurityEvents paginates correctly`
- `getSecurityEventKPIs counts events by time window`
- `getSecurityEventKPIs returns top event types`

Pattern: Use `vi.mock` for db, create mock return values with `selectChain` helper pattern (see existing test files like `src/lib/queries/__tests__/admin-feature-flags.test.ts` for the established mock pattern).

**File: `src/lib/actions/__tests__/admin-trust.test.ts`**

Test descriptions:
- `updateBandOverride sets all override fields on sellerProfile`
- `updateBandOverride rejects invalid band values`
- `updateBandOverride rejects reason shorter than 10 chars`
- `updateBandOverride requires ADMIN role (staffAuthorize check)`
- `updateBandOverride requires ability.can update SellerProfile`
- `updateBandOverride logs audit event with severity HIGH`
- `updateBandOverride sets bandOverrideBy from session, not input`
- `updateBandOverride calculates expiry date correctly`
- `revokeBandOverride clears all override fields`
- `revokeBandOverride requires ADMIN role`
- `revokeBandOverride logs audit event`
- `revokeBandOverride rejects missing reason`

Pattern: Use `vi.mock` for db/casl, `makeStaffSession` helper, verify explicit field mapping (no spread).

### Edge Cases to Cover
- Seller with no sellerPerformance row (new seller, no orders)
- Seller with no sellerScoreSnapshot rows (never scored)
- Empty audit_event table (no security events)
- All sellers in same band (distribution shows 100% in one band)
- Override on seller who already has an active override (should replace)
- Score history with gaps in dates (missing snapshots for some days)

---

## 6. FILE APPROVAL LIST

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/casl/subjects.ts` | ADD 2 subjects: TrustSafety, SecurityEvent |
| 2 | `src/lib/casl/platform-abilities.ts` | ADD TrustSafety read for MODERATION and SUPPORT |
| 3 | `src/lib/queries/admin-trust.ts` | NEW: All trust/risk/security queries (7 functions) |
| 4 | `src/lib/actions/admin-trust.ts` | NEW: updateBandOverride + revokeBandOverride server actions |
| 5 | `src/app/(hub)/trust/page.tsx` | NEW: Trust overview dashboard |
| 6 | `src/app/(hub)/trust/sellers/[id]/page.tsx` | NEW: Individual seller trust profile |
| 7 | `src/app/(hub)/trust/settings/page.tsx` | NEW: Trust event weights + band thresholds settings |
| 8 | `src/app/(hub)/risk/page.tsx` | NEW: Risk signals / fraud overview |
| 9 | `src/app/(hub)/security/page.tsx` | NEW: Security events audit log |
| 10 | `src/lib/queries/__tests__/admin-trust.test.ts` | NEW: Query unit tests (~16 tests) |
| 11 | `src/lib/actions/__tests__/admin-trust.test.ts` | NEW: Action unit tests (~12 tests) |

**Total: 11 files (2 modified, 9 new)**
**Estimated tests: ~28 new tests**

---

## 7. VERIFICATION CHECKLIST

After implementation, run these commands and paste FULL raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test count (must be >= BASELINE_TESTS)
pnpm test

# 3. Lint check
./twicely-lint.sh

# 4. Banned terms check (zero occurrences expected in new/modified files)
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|Twicely Balance\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|STANDARD\|RISING" \
  src/lib/queries/admin-trust.ts \
  src/lib/actions/admin-trust.ts \
  src/app/\(hub\)/trust/ \
  src/app/\(hub\)/risk/ \
  src/app/\(hub\)/security/ \
  src/lib/casl/subjects.ts \
  src/lib/casl/platform-abilities.ts

# 5. File size check (all under 300 lines)
wc -l \
  src/lib/queries/admin-trust.ts \
  src/lib/actions/admin-trust.ts \
  src/app/\(hub\)/trust/page.tsx \
  src/app/\(hub\)/trust/sellers/\[id\]/page.tsx \
  src/app/\(hub\)/trust/settings/page.tsx \
  src/app/\(hub\)/risk/page.tsx \
  src/app/\(hub\)/security/page.tsx

# 6. Verify no admin-nav.ts modifications
git diff src/lib/hub/admin-nav.ts
```

**Expected outcomes:**
1. TypeScript: 0 errors
2. Tests: >= BASELINE_TESTS (currently 8603), no test count decrease
3. Lint: all checks pass
4. Banned terms: zero matches
5. All files under 300 lines
6. admin-nav.ts: no diff (untouched)

---

## 8. SPEC INCONSISTENCIES (Flagged for Owner Decision)

### Inconsistency 1: Trust Score vs Seller Score — Two Parallel Systems

The codebase has TWO scoring fields on `sellerProfile`:
- `trustScore` (real, default 80) — Event-based score from Platform Settings Canonical Section 10 (trust.event.* weights, trust.band* thresholds)
- `sellerScore` (integer, default 0) — Metric-based 0-1000 score from Seller Score Canonical Section 2

These are SEPARATE systems. The trust score uses event deltas (review5Star = +1.0, chargeback = -8.0) with band labels EXCELLENT/GOOD/WATCH/LIMITED/RESTRICTED. The seller score uses 6 weighted metrics with sigmoid normalization and band labels POWER_SELLER/TOP_RATED/ESTABLISHED/EMERGING.

**Decision needed:** The hub pages should display BOTH scores, or should one be the "primary" display? The current implementation displays both since both exist in the schema. The trust score is the simpler event-delta system; the seller score is the comprehensive metric-based system. The trust/settings page exposes the trust.event.* weights (event-delta system). The seller score configuration lives under the `score.*` platform settings keys (Seller Score Canonical Section 11) which are NOT currently seeded in v32-platform-settings-extended.ts.

**Current approach in this prompt:** Display both scores. Trust score as the "Trust Score" metric, seller score as the "Performance Score" metric. Let the owner decide if unification is needed.

### Inconsistency 2: Actors/Security Routes Use `/corp/` Prefix

The Actors/Security Canonical Section 19 specifies routes like `/corp/security`, `/corp/security/fraud`, `/corp/security/incidents`. The Page Registry and CLAUDE.md use hub.twicely.co routes without `/corp/` prefix. The existing codebase uses `/security` directly under the hub route group.

**Resolution:** Follow the Page Registry and existing codebase pattern. Routes are `/trust`, `/risk`, `/security` under the `(hub)` route group. The `/corp/` prefix from the Actors/Security doc is outdated and superseded by the Page Registry.

### Inconsistency 3: FraudCase CASL Subject Has No Table

Actors/Security Section 19 specifies `FraudCase` as a new CASL subject. No `fraud_case` table exists in the schema (144 tables, none matching). The `/mod/fraud` route is listed in Feature Lock-in Section 23 but has no page implementation.

**Resolution:** Add a comment-only reference in subjects.ts but do NOT add FraudCase to the subjects array. Fraud investigation currently uses `auditEvent` + `LocalFraudFlag` subjects. A dedicated fraud case system would require a new table spec.

### Inconsistency 4: trust.standards.belowStandardFvfSurcharge Uses Banned Term

Platform Settings Canonical Section 10.4 specifies key `trust.standards.belowStandardFvfSurcharge`. "FVF" is a banned term per CLAUDE.md. The key exists in the seed data.

**Resolution:** Do NOT rename the database key. Display it in the UI with label "Below Standard TF Surcharge (%)" to avoid the banned term in user-facing text.
