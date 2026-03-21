# G6 — KYC & Identity Verification + Privacy Settings

**Phase:** G6
**Feature Name:** KYC & Identity Verification + Privacy & Data Controls
**One-line Summary:** Build identity verification infrastructure (Stripe Identity integration), seller verification page, user privacy settings page (data export + account deletion UI), and admin data retention hub page.
**Date:** 2026-03-15

## Canonical Sources — READ ALL BEFORE STARTING

| Document | Sections | Why |
|----------|----------|-----|
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | §37 (Data Retention & GDPR), §45 (Identity Verification / KYC) | Core business rules for verification levels, triggers, privacy flows |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | §4 (Data Protection & Privacy), §4.3 (GDPR), §4.4 (CCPA), §6.3 (Account Farming), §6.5 (Impersonation), §12 (COPPA), §15.1 (Deepfake) | Security requirements for PII handling, verification, data export |
| `TWICELY_V3_SCHEMA_v2_1_0.md` | §2 (Identity tables) | Existing tables: user, sellerProfile, businessInfo |
| `TWICELY_V3_PAGE_REGISTRY.md` | #73 (`/my/selling/verification`), #78 (`/my/settings/privacy`), #116j (`/cfg?tab=privacy`), #130 (`/data-retention`) | Routes for this phase |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | §14 (Privacy settings) | Platform settings keys for privacy/GDPR |
| `TWICELY_V3_USER_MODEL.md` | §3 (Seller capability), §6 (Business is metadata) | Seller verification context |
| `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` | §3 (Stripe fee display) | Stripe Identity cost context |
| `TWICELY_V3_DECISION_RATIONALE.md` | #109 (Sold listing auto-archive), #110 (7-year retention), #111 (Image retention) | Locked retention decisions |
| `TWICELY_V3_TESTING_STANDARDS.md` | All | Test patterns |
| `CLAUDE.md` | All | Build rules |

---

## 1. PREREQUISITES

### Must Be Complete
- Phase C3 (Stripe Connect) — Stripe SDK configured, seller Stripe accounts exist
- Phase G5 (Tax & Compliance) — taxInfo table populated, encryption utilities exist at `src/lib/encryption.ts`
- Phase G4.2 (Appeal flow) — enforcement infrastructure available
- Account deletion actions ALREADY EXIST at `src/lib/actions/account-deletion.ts`

### Already Exists (DO NOT recreate)
- `user.deletionRequestedAt` column — EXISTS in `src/lib/db/schema/auth.ts` line 27
- `sellerProfile.verifiedAt` column — EXISTS in `src/lib/db/schema/identity.ts` line 42
- `account-deletion.ts` server actions — `beginAccountDeletion()`, `cancelAccountDeletion()`, `getAccountDeletionBlockers()` EXIST
- Privacy platform settings — 7 keys ALREADY SEEDED in `v32-platform-settings-extended.ts` lines 122-128:
  - `privacy.retention.messageDays` (730)
  - `privacy.retention.searchLogDays` (90)
  - `privacy.retention.auditLogDays` (2555)
  - `privacy.gdpr.dataExportEnabled` (true)
  - `privacy.gdpr.deletionGracePeriodDays` (30)
  - `privacy.gdpr.anonymizeOnDeletion` (true)
  - `privacy.gdpr.cookieConsentRequired` (true)
- `/p/privacy` page — EXISTS as stub at `src/app/(marketplace)/p/privacy/page.tsx`
- `encrypt()` / `decrypt()` / `maskSecret()` — EXIST in `src/lib/encryption.ts`
- CASL subject `TaxInfo` — EXISTS in subjects.ts
- Middleware at `src/middleware.ts` — EXISTS, handles auth-required routes

### Dependencies (npm packages)
- `@stripe/stripe-js` — already installed for Stripe Connect
- `stripe` — already installed server-side
- No new npm packages needed. Stripe Identity is part of the existing Stripe SDK.

---

## 2. DECOMPOSITION — 4 Sub-Steps

G6 is decomposed into 4 sub-steps that each produce a working, testable increment:

| Sub-step | Name | Time Est. | Depends On |
|----------|------|-----------|------------|
| G6.1 | Identity Verification Schema + Stripe Identity Service | ~45 min | G5 complete |
| G6.2 | Seller Verification Page + Actions | ~45 min | G6.1 |
| G6.3 | Privacy Settings Page (Data Export + Account Deletion UI) | ~45 min | G6.1 |
| G6.4 | Admin Data Retention Hub Page + Admin Privacy Settings Tab | ~30 min | G6.1 |

G6.2 and G6.3 can be built in parallel after G6.1 completes. G6.4 can be built after G6.1.

---

## 3. G6.1 — Identity Verification Schema + Stripe Identity Service

### 3.1 Schema Changes

#### 3.1.1 New Enum: `verificationLevelEnum`

Add to `src/lib/db/schema/enums.ts`:

```typescript
export const verificationLevelEnum = pgEnum('verification_level', [
  'BASIC',       // Email verified + phone verified
  'TAX',         // SSN/EIN + legal name + address (handled by G5 taxInfo)
  'ENHANCED',    // Government-issued photo ID + selfie match (Stripe Identity)
  'CATEGORY',    // Additional credentials per category (future)
]);
```

Source: Feature Lock-in §45 — Verification Levels table.

#### 3.1.2 New Enum: `verificationStatusEnum`

Add to `src/lib/db/schema/enums.ts`:

```typescript
export const verificationStatusEnum = pgEnum('verification_status', [
  'NOT_REQUIRED',  // No verification needed
  'PENDING',       // Verification submitted, awaiting result
  'VERIFIED',      // Successfully verified
  'FAILED',        // Verification failed (retryable)
  'EXPIRED',       // Enhanced verification expired after N months
]);
```

Source: Feature Lock-in §45 — Verification Status Effects table.

#### 3.1.3 New Table: `identityVerification`

Create new schema file `src/lib/db/schema/identity-verification.ts`:

```typescript
export const identityVerification = pgTable('identity_verification', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  level:           verificationLevelEnum('level').notNull(),
  status:          verificationStatusEnum('status').notNull().default('PENDING'),

  // Stripe Identity session (Enhanced level only)
  stripeSessionId: text('stripe_session_id'),           // VerificationSession ID from Stripe
  stripeReportId:  text('stripe_report_id'),             // VerificationReport ID from Stripe

  // Result metadata — NEVER store raw ID images
  verifiedAt:      timestamp('verified_at', { withTimezone: true }),
  failedAt:        timestamp('failed_at', { withTimezone: true }),
  failureReason:   text('failure_reason'),               // "document_expired", "selfie_mismatch", etc.
  expiresAt:       timestamp('expires_at', { withTimezone: true }),  // Enhanced verification expiry

  // Trigger context
  triggeredBy:     text('triggered_by').notNull(),       // 'STORE_PRO_UPGRADE' | 'PAYOUT_THRESHOLD' | 'FRAUD_FLAG' | 'CATEGORY_REQUIREMENT' | 'ADMIN_REQUEST'
  triggeredByStaffId: text('triggered_by_staff_id'),     // For admin-initiated requests

  // Retry tracking
  attemptCount:    integer('attempt_count').notNull().default(1),
  lastAttemptAt:   timestamp('last_attempt_at', { withTimezone: true }),
  retryAfter:      timestamp('retry_after', { withTimezone: true }),  // After failed verification

  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:    index('iv_user').on(table.userId),
  statusIdx:  index('iv_status').on(table.status),
  levelIdx:   index('iv_level').on(table.level),
}));
```

**IMPORTANT:** This table does NOT exist in the schema doc (TWICELY_V3_SCHEMA_v2_1_0.md). The schema doc has no `identity_verification` table. Feature Lock-in §45 specifies the requirements but leaves the table design to implementation. The schema doc only has `sellerProfile.verifiedAt` as a timestamp.

**NOT SPECIFIED — Owner decision needed:** The schema doc does not define an `identity_verification` table. Should we:
  (a) Create this new table as specified above to track verification sessions/attempts, OR
  (b) Track verification status on `sellerProfile` using additional columns (simpler but less auditable)?

**Recommendation:** Option (a) — separate table. It provides audit trail, retry history, and multi-level verification tracking that columns on `sellerProfile` cannot.

#### 3.1.4 New Table: `dataExportRequest`

Create in same file or add to `identity-verification.ts`:

```typescript
export const dataExportRequest = pgTable('data_export_request', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status:          text('status').notNull().default('PENDING'),  // PENDING | PROCESSING | COMPLETED | FAILED | EXPIRED
  format:          text('format').notNull().default('json'),      // 'json' | 'csv'
  downloadUrl:     text('download_url'),                          // Signed R2 URL (expires after download)
  downloadExpiresAt: timestamp('download_expires_at', { withTimezone: true }),
  completedAt:     timestamp('completed_at', { withTimezone: true }),
  errorMessage:    text('error_message'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:   index('der_user').on(table.userId),
  statusIdx: index('der_status').on(table.status),
}));
```

**IMPORTANT:** This table does NOT exist in the schema doc. Feature Lock-in §37 specifies "Download My Data → JSON export within 48 hours" but doesn't define a tracking table. Since exports are async (up to 48 hours SLA), a tracking table is necessary.

**NOT SPECIFIED — Owner decision needed:** The schema doc does not define a `data_export_request` table. Should we create it as above to track async data export requests?

#### 3.1.5 Barrel Export

Add both new tables to `src/lib/db/schema/index.ts` barrel export.

#### 3.1.6 Migration

Generate migration file via `pnpm drizzle-kit generate`.

### 3.2 New Platform Settings (KYC)

Add to `src/lib/db/seed/v32-platform-settings-extended.ts`:

```typescript
// KYC & Identity Verification — Feature Lock-in §45
{ key: 'provider', value: 'stripe_identity', type: 'string', category: 'kyc', description: 'Third-party KYC provider' },
{ key: 'enhancedThresholdCents', value: 1000000, type: 'cents', category: 'kyc', description: 'Monthly payout threshold ($10,000) triggering enhanced verification' },
{ key: 'enhancedExpirationMonths', value: 24, type: 'number', category: 'kyc', description: 'Months before enhanced verification expires' },
{ key: 'failedRetryDays', value: 30, type: 'number', category: 'kyc', description: 'Days to retry after failed verification' },
{ key: 'autoVerifyBasic', value: true, type: 'boolean', category: 'kyc', description: 'Auto-verify basic level (email + phone) without manual review' },
```

Source: Feature Lock-in §45 — Admin Settings.

**Also add missing privacy settings** from Platform Settings Canonical §14 that are NOT yet seeded:

```typescript
{ key: 'retention.webhookLogDays', value: 90, type: 'number', category: 'privacy', description: 'Webhook log retention (days)' },
{ key: 'retention.analyticsEventDays', value: 365, type: 'number', category: 'privacy', description: 'Analytics event retention (1 year)' },
{ key: 'retention.notificationLogDays', value: 180, type: 'number', category: 'privacy', description: 'Notification log retention (days)' },
{ key: 'gdpr.exportFormats', value: ['json', 'csv'], type: 'array', category: 'privacy', description: 'Available data export formats' },
```

Source: Platform Settings Canonical §14.1 and §14.2. Compare with already-seeded keys in `v32-platform-settings-extended.ts` lines 122-128.

### 3.3 CASL Subject

Add `'IdentityVerification'` and `'DataExportRequest'` and `'DataRetention'` to `src/lib/casl/subjects.ts`.

CASL rules:
- **Seller (own):** Can `read` and `create` own `IdentityVerification`. Can `read` and `create` own `DataExportRequest`.
- **ADMIN:** Can `manage` all `IdentityVerification`, `DataExportRequest`, `DataRetention`.
- **FINANCE:** Can `read` `IdentityVerification` (verification status relevant for payout decisions).
- **SUPPORT:** Can `read` `IdentityVerification` (support needs to see verification status when helping sellers).

Source: Actors & Security Canonical §4.3.5 — `DataRetention` subject defined. Feature Lock-in §45 — Admin can request verification at any level.

### 3.4 Stripe Identity Service

Create `src/lib/stripe/identity-service.ts`:

**Functions:**
1. `createVerificationSession(userId: string, level: 'ENHANCED'): Promise<{ sessionId: string; clientSecret: string }>` — Creates a Stripe Identity VerificationSession. Returns the client secret for the embedded verification UI.
2. `getVerificationSessionResult(sessionId: string): Promise<{ status: 'verified' | 'requires_input' | 'canceled'; reportId?: string }>` — Polls Stripe for verification result.
3. `handleVerificationWebhook(event: Stripe.Event): Promise<void>` — Handles `identity.verification_session.verified`, `identity.verification_session.requires_input`, `identity.verification_session.canceled` events. Updates `identityVerification` table.

**Privacy rule from Feature Lock-in §45:** "KYC documents processed by third-party provider — Twicely does NOT store raw ID images. Only verification status and metadata (verified date, provider, level) stored in Twicely database."

**Privacy rule from Actors & Security Canonical §4.2:** "SSN/Tax ID never stored in Twicely — Stripe Connect handles KYC — we store verification status only."

**SPEC INCONSISTENCY #1:** Actors & Security Canonical §4.2 says "SSN/Tax ID never stored in Twicely" but the schema doc has `taxInfo` table with encrypted SSN/EIN fields, and G5 was built with that storage. The G6 identity verification layer does NOT store any ID documents — this rule is respected. Tax info storage was resolved in G5 with encrypted storage per schema doc. G6 ONLY stores verification status metadata, not raw documents.

### 3.5 Notification Templates

Add to `src/lib/notifications/templates.ts`:

```typescript
// KYC & Identity Verification
| 'kyc.verification_required'      // Seller needs to verify identity
| 'kyc.verification_submitted'     // Confirmation that verification was submitted
| 'kyc.verification_approved'      // Verification passed
| 'kyc.verification_failed'        // Verification failed with retry info
| 'kyc.verification_expired'       // Enhanced verification expired, re-verify needed
// Privacy / Data
| 'privacy.data_export_ready'      // Data export completed, download link available
| 'privacy.deletion_started'       // Account deletion cooling-off started
| 'privacy.deletion_completed'     // Account permanently deleted (sent before deletion)
```

Create `src/lib/notifications/templates-kyc.ts` for the template definitions.
Create `src/lib/notifications/templates-privacy.ts` for the template definitions.

### 3.6 Webhook Route

Add Stripe Identity webhook handling. Check if existing webhook handler at `src/app/api/webhooks/subscriptions/route.ts` can be extended, or create a new webhook route at `src/app/api/webhooks/identity/route.ts`.

Events to handle:
- `identity.verification_session.verified` → Update identityVerification status to VERIFIED, set verifiedAt, also set `sellerProfile.verifiedAt`
- `identity.verification_session.requires_input` → Update status to FAILED with failureReason
- `identity.verification_session.canceled` → Update status to FAILED with 'canceled' reason

---

## 4. G6.2 — Seller Verification Page + Actions

### 4.1 Pages

#### `/my/selling/verification` — Page Registry #73

Route: `src/app/(hub)/my/selling/verification/page.tsx`
Gate: OWNER_ONLY (no staff delegation)
Layout: dashboard
Build Phase: G6

**Page States:**
- LOADING: Skeleton cards
- NOT_REQUIRED: "No verification needed right now" with explanation of when verification is required
- PENDING: "Verification in progress" with status indicator and estimated timeline
- VERIFIED: Green checkmark, "Verified on [date]", verification level, expiry date (if Enhanced)
- FAILED: Red alert, failure reason, retry button (if within retry window), contact support link
- EXPIRED: Warning banner, "Your verification expired on [date]", re-verify button

**Page Content:**
1. **Verification Status Card** — Current level + status
2. **Verification History** — List of past verification attempts (from `identityVerification` table)
3. **Required Verifications** — What's needed and why (based on triggers)
4. **Start Verification** — Button to begin verification flow (for Enhanced: opens Stripe Identity embedded UI)

### 4.2 Server Actions

Create `src/lib/actions/identity-verification.ts`:

1. `getVerificationStatus()` — Returns current verification status for authenticated seller.
2. `startEnhancedVerification(triggeredBy: string)` — Creates Stripe Identity session, returns client secret for embedding.
3. `checkVerificationResult(verificationId: string)` — Polls for result (backup for webhook).

Create `src/lib/queries/identity-verification.ts`:

1. `getVerificationHistory(userId: string)` — Returns all verification records for user.
2. `getActiveVerification(userId: string)` — Returns the current active verification record (most recent VERIFIED or PENDING).
3. `isEnhancedVerificationRequired(userId: string)` — Checks triggers: Store Pro+ application, payout threshold, fraud flags, admin request. Returns `{ required: boolean; reason?: string }`.

### 4.3 Verification Trigger Logic

Per Feature Lock-in §45, verification is required when:

| Trigger | Level | Check Location |
|---------|-------|---------------|
| Seller exceeds $600 in sales | TAX | Already handled by G5 (tax info collection) |
| Seller applies for Store Pro+ | ENHANCED | Subscription upgrade flow (D3) — add check |
| Seller requests payout increase above $10,000/month | ENHANCED | Payout settings — add check |
| Fraud flags triggered | ENHANCED | Enforcement system (G4) — add check |
| Admin manual request | Any | Admin user detail page — add button |
| Seller in luxury/authentication-required categories | CATEGORY | Category system (future, not G6 scope) |

**For G6, implement:**
- `isEnhancedVerificationRequired()` query that checks payout volume against `kyc.enhancedThresholdCents` setting
- Verification gate check that can be called before Store Pro+ subscription upgrade
- Admin-initiated verification request via hub user detail page (existing `/usr/[id]`)

**NOT in G6 scope:**
- Category-specific verification (CATEGORY level) — future phase
- Automatic blocking of Store Pro+ upgrades (display warning, not hard gate) — the gate display is informational in G6, hard enforcement deferred to when the subscription upgrade flow is fully wired

### 4.4 Components

Create `src/components/pages/verification/`:
1. `verification-status-card.tsx` — Shows current status with icon/badge
2. `verification-history.tsx` — Table of past verification attempts
3. `verification-trigger-banner.tsx` — Warning banner when verification is required
4. `stripe-identity-embed.tsx` — Client component that loads Stripe Identity embedded UI using `@stripe/stripe-js`

### 4.5 Basic Verification (Email + Phone)

Per Feature Lock-in §45:
- BASIC level = email verified + phone verified
- `kyc.autoVerifyBasic` setting (default: true) = auto-mark as BASIC verified

`user.emailVerified` already exists. `user.phoneVerified` already exists. When both are true AND `kyc.autoVerifyBasic` is true, the user is BASIC verified. No additional flow needed — this is derived, not stored as a separate verification record.

---

## 5. G6.3 — Privacy Settings Page (Data Export + Account Deletion UI)

### 5.1 Pages

#### `/my/settings/privacy` — Page Registry #78

Route: `src/app/(hub)/my/settings/privacy/page.tsx`
Gate: AUTH (any authenticated user)
Layout: dashboard
Build Phase: G6

**Page Sections:**

1. **Download My Data**
   - Button: "Download My Data"
   - Shows format selector (JSON / CSV) based on `privacy.gdpr.exportFormats` setting
   - On click: creates `dataExportRequest` record, shows "Your data export is being prepared. We'll notify you when it's ready (up to 48 hours)."
   - Shows list of pending/completed export requests with download links
   - Download links expire (signed R2 URLs, 24-hour TTL)

2. **Account Deletion**
   - Shows blockers if any (from existing `getAccountDeletionBlockers()`)
   - Warning text: "This will permanently delete your account after a {deletionGracePeriodDays}-day cooling-off period."
   - If deletion NOT requested: "Delete My Account" button with confirmation dialog
   - If deletion ALREADY requested: Shows countdown, "Cancel Deletion" button
   - Uses existing `beginAccountDeletion()` and `cancelAccountDeletion()` actions

3. **Marketing Preferences**
   - Toggle for `user.marketingOptIn`
   - "Opt out of marketing emails and recommendations"

4. **Cookie Preferences** (if `privacy.gdpr.cookieConsentRequired` is true)
   - Link to cookie settings / consent manager
   - Categories: Strictly Necessary (always on), Functional, Analytics

### 5.2 Server Actions

Create `src/lib/actions/data-export.ts`:

1. `requestDataExport(format: 'json' | 'csv')` — Creates a `dataExportRequest` record. Enqueues a BullMQ job (`data-export` queue) to generate the export.
2. `getMyDataExportRequests()` — Returns user's export requests, most recent first.
3. `downloadDataExport(requestId: string)` — Returns signed download URL if export is COMPLETED and not expired.

Create `src/lib/actions/privacy-settings.ts`:

1. `updateMarketingOptIn(optIn: boolean)` — Updates `user.marketingOptIn`.

### 5.3 Data Export Job (BullMQ)

Create `src/lib/jobs/data-export.ts`:

The export job collects ALL user data per Decision #110 (GDPR portability):
- User profile (name, email, phone, addresses)
- Order history (as buyer AND seller)
- Listing history (active + sold + ended)
- Payout history
- Ledger entries for their account
- Messages (conversations they participated in)
- Reviews they wrote and received
- Watchlist items
- Saved searches
- Notification preferences
- Tax information (1099-K data if applicable)

The job:
1. Queries all data for the userId
2. Assembles into JSON or CSV format
3. Uploads to R2 with a signed URL
4. Updates `dataExportRequest` record with downloadUrl + completedAt
5. Sends `privacy.data_export_ready` notification

**SLA:** Max 48 hours (per `privacy.gdpr.dataExportMaxHours` setting from Feature Lock-in §37).

**Rate limit:** Max 1 export request per 24 hours per user.

### 5.4 Components

Create `src/components/pages/privacy/`:
1. `data-export-section.tsx` — Export request form + history
2. `account-deletion-section.tsx` — Deletion UI (uses existing actions)
3. `marketing-preferences.tsx` — Marketing opt-in toggle

### 5.5 Modify Existing Account Deletion

The existing `account-deletion.ts` sets `deletionRequestedAt` but does NOT:
- Send the `privacy.deletion_started` notification
- Check `privacy.gdpr.deletionGracePeriodDays` setting (hardcoded in the action? verify)

**Modify** `beginAccountDeletion()` to:
1. Set `user.deletionRequestedAt = new Date()`
2. Send `privacy.deletion_started` notification
3. Read grace period from `privacy.gdpr.deletionGracePeriodDays` setting

**Modify** `cancelAccountDeletion()` to:
1. Clear `user.deletionRequestedAt = null`
2. Log audit event

**IMPORTANT:** The existing `beginAccountDeletion()` does NOT actually set `deletionRequestedAt` on the user table. It only calls `cascadeProjectionsToOrphaned()`. This is a GAP — the actual `user.deletionRequestedAt` timestamp update is missing. G6.3 MUST add this.

---

## 6. G6.4 — Admin Data Retention Hub Page + Admin Privacy Settings Tab

### 6.1 Pages

#### `/data-retention` — Page Registry #130

Route: `src/app/(hub-admin)/data-retention/page.tsx` (or wherever hub admin pages live)
Gate: ADMIN
Layout: hub
Build Phase: G6

**Page Content:**
1. **Retention Policies Table** — Shows current retention periods from platform settings
   - Message retention: {privacy.retention.messageDays} days
   - Search log retention: {privacy.retention.searchLogDays} days
   - Audit log retention: {privacy.retention.auditLogDays} days
   - Webhook log retention: {privacy.retention.webhookLogDays} days
   - Analytics event retention: {privacy.retention.analyticsEventDays} days
   - Notification log retention: {privacy.retention.notificationLogDays} days

2. **GDPR Request Queue** — List of pending account deletion requests (users in cooling-off period)
   - Shows: user name/email (masked), deletion requested date, cooling-off remaining days, status
   - Admin can force-complete deletion (with 2FA) or extend cooling-off

3. **Data Export Requests** — All pending/completed data export requests across all users
   - Shows: request ID, user (masked), format, status, requested at, completed at

4. **Retention Statistics** — Counts of records approaching retention expiry
   - "X audit log entries older than Y days"
   - "X session records older than 30 days"

#### `/cfg?tab=privacy` — Page Registry #116j

Route: Extends existing settings page at `src/app/(hub-admin)/cfg/page.tsx`
Gate: ADMIN
Build Phase: G6

Add privacy tab to the existing settings tabs. Renders editable forms for all `privacy.*` platform settings.

### 6.2 Admin Actions

Create `src/lib/actions/admin-data-retention.ts`:

1. `getRetentionDashboard()` — Returns retention policy data + stats.
2. `getDeletionQueue()` — Returns users in cooling-off period.
3. `forceCompleteDeletion(userId: string)` — Immediately starts deletion process (skips remaining cooling-off). Requires ADMIN role. Audit event at CRITICAL severity.
4. `getDataExportRequests()` — Returns all export requests (admin view).

### 6.3 Components

Create `src/components/pages/data-retention/`:
1. `retention-policies-table.tsx` — Shows retention periods
2. `deletion-queue.tsx` — GDPR deletion request queue
3. `data-export-queue.tsx` — Admin view of all export requests

Create `src/components/hub/settings/`:
1. `privacy-settings-tab.tsx` — Privacy settings form for `/cfg?tab=privacy`

---

## 7. CONSTRAINTS — WHAT NOT TO DO

### Banned Patterns
- Do NOT store raw ID images, selfies, or document photos in Twicely database or R2. Stripe Identity handles this.
- Do NOT call ID images from Stripe API and cache them. Status and metadata only.
- Do NOT expose internal verification IDs in error messages.
- Do NOT use `as any` or `@ts-ignore` anywhere.
- Do NOT hardcode fee rates, threshold values, or retention periods — ALL from platform_settings.
- Do NOT spread request body into DB — explicit field mapping only.
- Do NOT create files over 300 lines.
- Do NOT use banned vocabulary (see CLAUDE.md BANNED Terms table).

### CASL Rules
- Sellers can only read/create their OWN IdentityVerification records.
- Admin can manage all. Finance can read all (for payout decisions). Support can read all.
- Data export requests are own-user only. Admin can read all via admin action.
- DataRetention subject is ADMIN-only for edit. All staff can read.

### Privacy Rules (from Actors & Security Canonical §4)
- PII display is masked in admin views: Phone: ***-***-1234, Email: a***@email.com
- PII never logged in request/response logging
- Every time staff views a user's verification status, it creates an audit event
- SSN/Tax ID encrypted at rest (handled by G5 encryption utils, not duplicated here)

### Route Rules
- Verification page: `/my/selling/verification` (NOT `/my/verification` or `/seller/verification`)
- Privacy page: `/my/settings/privacy` (NOT `/my/privacy` or `/account/privacy`)
- Data retention: `/data-retention` (hub route, NOT `/cfg/data-retention`)

---

## 8. SPEC INCONSISTENCIES

### INCONSISTENCY #1: SSN Storage
- **Actors & Security Canonical §4.2:** "SSN/Tax ID never stored in Twicely — Stripe Connect handles KYC."
- **Schema doc + G5 implementation:** taxInfo table stores encrypted SSN/EIN.
- **Resolution:** G5 resolved this by implementing encrypted storage per schema doc. G6 does NOT introduce any additional SSN/EIN storage — that's handled by taxInfo. G6's `identityVerification` only stores status metadata.

### INCONSISTENCY #2: Cooling-Off Period
- **Feature Lock-in §37:** "30-day cooling off period"
- **Actors & Security Canonical §4.3:** "24hr cooling period → pseudonymize"
- **Resolution:** Feature Lock-in §37 is more detailed and is the later/more considered document. Use 30 days (configurable via `privacy.gdpr.deletionGracePeriodDays`). The 24hr value in Actors Canonical appears to be an earlier draft value.

### INCONSISTENCY #3: Verification Page Route
- **Page Registry #73:** Lists `/my/selling/verification` with gate OWNER_ONLY, Build Phase G4.
- **Build Sequence Tracker:** Lists G6 as "KYC & Identity Verification."
- **Resolution:** The page was planned for G4 but G4 was focused on enforcement. G6 is the correct build phase. Route stays as `/my/selling/verification`.

### INCONSISTENCY #4: No Schema Doc Table
- **Schema doc (v2.1.3):** Has NO `identity_verification` or `data_export_request` table.
- **Feature Lock-in §45:** Defines verification levels, triggers, statuses, and flow.
- **Resolution:** These tables must be created. Feature Lock-in §45 defines the requirements; the tables are the necessary implementation. Owner decision requested in Section 3.1.3 above.

### INCONSISTENCY #5: `dataExportMaxHours` Setting
- **Feature Lock-in §37:** References `privacy.dataExportMaxHours: 48`
- **Platform Settings Canonical §14:** Does NOT list this key.
- **Resolution:** Add it to the seed as a new privacy setting.

---

## 9. ACCEPTANCE CRITERIA

### Identity Verification
- [ ] `identityVerification` table created with all columns per Section 3.1.3
- [ ] `verificationLevelEnum` and `verificationStatusEnum` enums created
- [ ] Stripe Identity service can create a VerificationSession and return client secret
- [ ] Webhook handler processes `identity.verification_session.*` events
- [ ] On successful verification: `identityVerification.status` = VERIFIED, `sellerProfile.verifiedAt` set
- [ ] On failed verification: `identityVerification.status` = FAILED, `failureReason` populated
- [ ] Failed verification sets `retryAfter` based on `kyc.failedRetryDays` setting (NOT hardcoded)
- [ ] Enhanced verification expiry calculated from `kyc.enhancedExpirationMonths` setting
- [ ] `isEnhancedVerificationRequired()` checks payout threshold against `kyc.enhancedThresholdCents`
- [ ] Seller can view verification status at `/my/selling/verification`
- [ ] Seller can start Enhanced verification flow (Stripe Identity UI renders)
- [ ] Verification history shows past attempts
- [ ] BASIC verification is derived from emailVerified + phoneVerified (not stored as record)
- [ ] Admin can request verification for any user via hub
- [ ] Twicely does NOT store raw ID images — only status metadata
- [ ] All verification template notifications fire correctly

### Privacy / Data Export
- [ ] `/my/settings/privacy` page renders with Download Data, Account Deletion, and Marketing sections
- [ ] User can request data export in JSON or CSV format
- [ ] Export request creates `dataExportRequest` record and enqueues BullMQ job
- [ ] Data export job collects: profile, orders, listings, payouts, ledger, messages, reviews, watchlist, saved searches, tax info
- [ ] Export uploaded to R2 with signed URL, notification sent when ready
- [ ] Download link expires after 24 hours
- [ ] Rate limit: max 1 export request per 24 hours per user
- [ ] Account deletion shows blockers (open orders, disputes)
- [ ] Account deletion sets `user.deletionRequestedAt` timestamp
- [ ] Account deletion reads grace period from `privacy.gdpr.deletionGracePeriodDays` setting
- [ ] Account deletion can be cancelled during cooling-off, clears `deletionRequestedAt`
- [ ] Marketing opt-in/out toggle works and persists

### Admin Data Retention
- [ ] `/data-retention` hub page shows retention policies, deletion queue, export requests
- [ ] Admin can view all users in deletion cooling-off period
- [ ] Admin can force-complete deletion (audit event logged at CRITICAL)
- [ ] `/cfg?tab=privacy` tab renders with all privacy settings editable
- [ ] Privacy settings changes create audit events

### Authorization
- [ ] Unauthenticated users cannot access `/my/selling/verification`
- [ ] Unauthenticated users cannot access `/my/settings/privacy`
- [ ] Sellers can only see their OWN verification records
- [ ] Sellers can only see their OWN data export requests
- [ ] Non-ADMIN staff cannot access `/data-retention`
- [ ] FINANCE staff can read verification status (for payout decisions)
- [ ] SUPPORT staff can read verification status (for support context)

### Vocabulary
- [ ] No banned terms in any UI text or code comments
- [ ] "Available for payout" used (not "balance" or "wallet")
- [ ] No files over 300 lines

### Data Integrity
- [ ] All monetary values as integer cents
- [ ] All settings read from `platform_settings` — no hardcoded thresholds
- [ ] Ownership via `userId` throughout
- [ ] Zod validation on all action inputs
- [ ] 0 TypeScript errors

---

## 10. TEST REQUIREMENTS

### Unit Tests (~15 tests)
- `identity-service.test.ts`:
  - Creates Stripe VerificationSession with correct params
  - Handles successful verification result
  - Handles failed verification result
  - Sets correct expiry based on platform setting

- `data-export-job.test.ts`:
  - Collects all required data categories
  - Generates valid JSON export
  - Generates valid CSV export
  - Uploads to R2 and returns signed URL
  - Sends notification on completion

### Action Tests (~20 tests)
- `identity-verification.test.ts`:
  - `getVerificationStatus` returns current status for authenticated user
  - `getVerificationStatus` returns NOT_REQUIRED when no verification needed
  - `startEnhancedVerification` creates identityVerification record
  - `startEnhancedVerification` fails if already PENDING
  - `startEnhancedVerification` fails if retry window active
  - `isEnhancedVerificationRequired` checks payout threshold
  - `isEnhancedVerificationRequired` returns false when already VERIFIED and not expired
  - Non-seller cannot start verification
  - CASL denies access to other user's verification records

- `data-export.test.ts`:
  - `requestDataExport` creates record with PENDING status
  - `requestDataExport` rejects if export already pending
  - `requestDataExport` enforces 1-per-24h rate limit
  - `requestDataExport` validates format ('json' | 'csv')
  - `getMyDataExportRequests` returns only own requests
  - `downloadDataExport` returns signed URL for COMPLETED requests
  - `downloadDataExport` rejects for expired downloads

- `privacy-settings.test.ts`:
  - `updateMarketingOptIn` toggles user.marketingOptIn
  - Unauthenticated user cannot update settings

- `admin-data-retention.test.ts`:
  - `getRetentionDashboard` returns settings data
  - `getDeletionQueue` returns users in cooling-off
  - `forceCompleteDeletion` requires ADMIN role
  - `forceCompleteDeletion` creates CRITICAL audit event
  - Non-admin cannot access retention dashboard

### Webhook Tests (~5 tests)
- `identity-webhook.test.ts`:
  - Handles `identity.verification_session.verified` event correctly
  - Handles `identity.verification_session.requires_input` event correctly
  - Handles `identity.verification_session.canceled` event correctly
  - Ignores events for unknown session IDs
  - Verifies webhook signature

**Total expected: ~40 new tests**

---

## 11. FILE APPROVAL LIST

### New Files (20 files)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/db/schema/identity-verification.ts` | identityVerification + dataExportRequest tables |
| 2 | `drizzle/XXXX_identity-verification.sql` | Migration for new tables + enums |
| 3 | `src/lib/stripe/identity-service.ts` | Stripe Identity session creation + result handling |
| 4 | `src/lib/actions/identity-verification.ts` | Seller verification server actions |
| 5 | `src/lib/queries/identity-verification.ts` | Verification queries (history, active, required check) |
| 6 | `src/lib/actions/data-export.ts` | Data export request server actions |
| 7 | `src/lib/actions/privacy-settings.ts` | Marketing opt-in toggle action |
| 8 | `src/lib/actions/admin-data-retention.ts` | Admin data retention + deletion queue actions |
| 9 | `src/lib/jobs/data-export.ts` | BullMQ job for async data export generation |
| 10 | `src/lib/notifications/templates-kyc.ts` | KYC notification template definitions |
| 11 | `src/lib/notifications/templates-privacy.ts` | Privacy notification template definitions |
| 12 | `src/app/(hub)/my/selling/verification/page.tsx` | Seller verification page |
| 13 | `src/app/(hub)/my/settings/privacy/page.tsx` | User privacy settings page |
| 14 | `src/app/(hub-admin)/data-retention/page.tsx` | Admin data retention hub page |
| 15 | `src/app/api/webhooks/identity/route.ts` | Stripe Identity webhook handler |
| 16 | `src/components/pages/verification/verification-status-card.tsx` | Verification status display |
| 17 | `src/components/pages/verification/stripe-identity-embed.tsx` | Client component for Stripe Identity UI |
| 18 | `src/components/pages/privacy/data-export-section.tsx` | Data export request UI |
| 19 | `src/components/pages/privacy/account-deletion-section.tsx` | Account deletion UI |
| 20 | `src/components/pages/data-retention/retention-dashboard.tsx` | Admin retention dashboard |

### New Test Files (6 files)

| # | File Path | Description |
|---|-----------|-------------|
| 21 | `src/lib/stripe/__tests__/identity-service.test.ts` | Stripe Identity service unit tests |
| 22 | `src/lib/actions/__tests__/identity-verification.test.ts` | Verification action tests |
| 23 | `src/lib/actions/__tests__/data-export.test.ts` | Data export action tests |
| 24 | `src/lib/actions/__tests__/privacy-settings.test.ts` | Privacy settings action tests |
| 25 | `src/lib/actions/__tests__/admin-data-retention.test.ts` | Admin data retention action tests |
| 26 | `src/app/api/webhooks/__tests__/identity-webhook.test.ts` | Identity webhook handler tests |

### Modified Files (10 files)

| # | File Path | Change |
|---|-----------|--------|
| 27 | `src/lib/db/schema/enums.ts` | Add verificationLevelEnum + verificationStatusEnum |
| 28 | `src/lib/db/schema/index.ts` | Export new tables |
| 29 | `src/lib/casl/subjects.ts` | Add IdentityVerification, DataExportRequest, DataRetention |
| 30 | `src/lib/casl/platform-abilities.ts` | Add CASL rules for new subjects |
| 31 | `src/lib/db/seed/v32-platform-settings-extended.ts` | Add KYC + missing privacy settings |
| 32 | `src/lib/notifications/templates.ts` | Add new template keys + import template files |
| 33 | `src/lib/actions/account-deletion.ts` | Add deletionRequestedAt update + notification |
| 34 | `src/lib/hub/admin-nav.ts` | Add Data Retention nav item |
| 35 | `src/app/(hub-admin)/cfg/page.tsx` | Add privacy tab |
| 36 | `src/app/(hub)/my/settings/layout.tsx` | Add Privacy nav link |

**Total: 20 new files + 6 test files + 10 modified files = 36 files**

---

## 12. VERIFICATION CHECKLIST

After implementation, run these commands and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Banned terms grep
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|fvf\|BASIC.*StoreTier\|ELITE.*StoreTier\|PLUS.*ListerTier\|MAX.*ListerTier\|PREMIUM\|Twicely Balance\|wallet.*seller\|Withdraw.*seller" src/ --include="*.ts" --include="*.tsx" || echo "No banned terms found"

# 4. Route prefix check
grep -rn '"/l/\|"/listing/\|"/store/\|"/shop/\|"/dashboard"\|"/admin"' src/ --include="*.ts" --include="*.tsx" || echo "No wrong routes found"

# 5. File size check (>300 lines)
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20

# 6. Lint script
./twicely-lint.sh
```

Expected outcomes:
- 0 TypeScript errors
- Test count >= BASELINE_TESTS (6256)
- ~40 new tests
- 0 banned terms
- 0 wrong routes
- 0 files over 300 lines

---

## 13. OPEN OWNER DECISIONS

1. **New tables not in schema doc:** `identityVerification` and `dataExportRequest` tables need to be created but don't exist in the schema doc (v2.1.3). Confirm these are acceptable additions.

2. **Category-level verification:** Feature Lock-in §45 mentions "Category-specific verification" for luxury/authentication-required categories. This is marked as future/not-G6-scope. Confirm this deferral.

3. **Data export job queue:** The data export BullMQ job uses a new `data-export` queue. Confirm the queue name follows BullMQ naming convention (hyphens, not colons).

4. **Account deletion gap:** The existing `beginAccountDeletion()` action does NOT set `user.deletionRequestedAt`. G6.3 will add this. Confirm this is the correct fix location.

5. **`privacy.dataExportMaxHours` setting:** Feature Lock-in §37 references this but Platform Settings Canonical §14 does not list it. Should it be added?

---

**END OF G6 INSTALL PROMPT**
