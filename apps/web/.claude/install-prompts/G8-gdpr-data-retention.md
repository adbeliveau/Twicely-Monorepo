# [G8] GDPR & Data Retention

**Phase & Step:** G8
**Feature Name:** GDPR Compliance & Automated Data Retention
**One-line Summary:** Implement automated data lifecycle enforcement (purge/pseudonymize cron jobs), right-to-erasure execution pipeline, cookie consent management, consent audit trail, and enhanced GDPR compliance dashboard -- all building on top of the G6 foundation.
**Estimated Effort:** 4 sub-steps, ~4-5 hours total

## Canonical Sources

Read ALL of these before starting:

| Document | Why |
|----------|-----|
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` section 37 (Data Retention & GDPR), section 39 (Audit Logging -- retention), section 40 (Background Jobs -- cleanup queue) | Primary business rules |
| `TWICELY_V3_DECISION_RATIONALE.md` entries #109 (Sold Listing Auto-Archive), #110 (7-Year Financial Retention), #111 (Image Retention Policy) | Locked retention decisions |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` section 14 (Privacy) | Platform setting keys for retention + GDPR |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` sections 4.3 (GDPR Compliance), 4.4 (CCPA Compliance) | Security/compliance requirements |
| `TWICELY_V3_PAGE_REGISTRY.md` routes #78 (/my/settings/privacy), #116j (/cfg?tab=privacy), #130 (/data-retention) | Existing routes |
| `TWICELY_V3_SCHEMA_v2_1_0.md` | Table/column reference |
| `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` | Current state (G6 complete) |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns |
| `CLAUDE.md` | Build rules |

---

## Prerequisites

### Phases/Steps Complete
- G6 (KYC & Identity Verification) -- COMPLETE. This built the foundation:
  - `/my/settings/privacy` page with DataExportSection, AccountDeletionSection, MarketingPreferences
  - `/data-retention` hub page with RetentionDashboard (policies, deletion queue, export requests)
  - `data-export.ts` BullMQ job (collects user data, uploads to R2, signed URL)
  - `account-deletion.ts` actions (beginAccountDeletion, cancelAccountDeletion, getAccountDeletionBlockers)
  - `data-export.ts` actions (requestDataExport, downloadDataExport, getMyDataExportRequests)
  - `admin-data-retention.ts` actions (getRetentionDashboard, getDeletionQueue, forceCompleteDeletion, getDataExportRequests)
  - `privacy-settings.ts` action (updateMarketingOptIn)
  - `templates-privacy.ts` (3 templates: data_export_ready, deletion_started, deletion_completed)
  - `identity-verification.ts` schema (identityVerification + dataExportRequest tables)
  - CASL subjects: DataExportRequest, DataRetention, IdentityVerification
  - 11 privacy/retention platform settings seeded in v32-platform-settings-extended.ts

### Existing Tables Required
- `user` (auth.ts) -- has `deletionRequestedAt`, `marketingOptIn`
- `session` (auth.ts) -- Better Auth managed
- `audit_event` (platform.ts) -- immutable
- `data_export_request` (identity-verification.ts) -- tracks export jobs
- `order`, `order_item`, `order_payment` -- financial records
- `ledger_entry` -- immutable financial records
- `listing` -- ownerUserId, listing images
- `conversation`, `message` -- messaging
- `review` -- reviews written/received
- `payout`, `payout_batch` -- payout records
- `listing_image` -- image references

### Existing Infrastructure
- BullMQ `cleanup` queue defined in Feature Lock-in section 40 -- NOT YET CREATED as a queue
- BullMQ `platform-cron` queue (cron-jobs.ts) -- existing, can add new tasks
- R2 storage client (`src/lib/storage/r2-client.ts`)
- `createQueue` / `createWorker` helpers (`src/lib/jobs/queue.ts`)

---

## SPEC INCONSISTENCIES (Documented, Not Resolved)

### INCONSISTENCY 1: Platform Setting Key Prefixes
- **Platform Settings Canonical section 14** defines keys as `privacy.retention.messageDays`, `privacy.gdpr.dataExportEnabled`, etc.
- **Feature Lock-in section 37** defines keys as `privacy.deletionCoolOffDays`, `privacy.orderRetentionYears`, etc.
- **Seeded keys in v32-platform-settings-extended.ts** use `retention.messageDays`, `gdpr.dataExportEnabled`, etc. (NO `privacy.` prefix).
- **Existing G6 code** reads keys WITHOUT the `privacy.` prefix (e.g., `gdpr.deletionGracePeriodDays`).
- **RESOLUTION for G8:** Follow the existing code convention. Use the SEEDED key names (without `privacy.` prefix). Any NEW settings added in G8 should follow the same pattern as existing seeded keys.

### INCONSISTENCY 2: Cooling-Off Period Duration
- **Feature Lock-in section 37** says 30-day cooling-off.
- **Actors & Security Canonical section 4.3** says 24-hour cooling-off.
- **RESOLUTION:** Feature Lock-in takes precedence. G6 already implemented 30 days (reads from `gdpr.deletionGracePeriodDays` setting, default 30). G8 follows this.

### INCONSISTENCY 3: Audit Log Retention
- **Feature Lock-in section 37** says "2 years" for audit logs.
- **Feature Lock-in section 39** says "`audit.retentionMonths`: 24 (default)".
- **Platform Settings Canonical section 14.1** says `privacy.retention.auditLogDays: 2555` (7 years).
- **Seeded value** is `retention.auditLogDays: 2555` (7 years).
- **RESOLUTION:** The seeded value (2555 days / 7 years) is MORE conservative and already in the DB. G8 will read from `retention.auditLogDays`. The cron job uses whatever value is in platform_settings.

### INCONSISTENCY 4: `/p/cookies` Route
- **Feature Lock-in section 37** references `/p/cookies` for cookie consent revocation.
- **Page Registry** does NOT list `/p/cookies`.
- **RESOLUTION:** G8 will create `/p/cookies` as a new public route (policy layout). Flag this for Page Registry update.

### INCONSISTENCY 5: Feature Lock-in Admin Setting Keys Not Seeded
- Feature Lock-in section 37 defines: `privacy.orderRetentionYears` (7), `privacy.auditLogRetentionMonths` (24), `privacy.granularAnalyticsRetentionDays` (90), `privacy.deletionCoolOffDays` (30), `privacy.dataExportMaxHours` (48).
- Some of these overlap with already-seeded keys under different names. `privacy.dataExportMaxHours` IS already seeded as `privacy.dataExportMaxHours` (48). `gdpr.deletionGracePeriodDays` IS already seeded (30).
- `privacy.orderRetentionYears`, `privacy.auditLogRetentionMonths`, and `privacy.granularAnalyticsRetentionDays` are NOT seeded but overlap with `retention.auditLogDays` (2555).
- **RESOLUTION:** Seed the missing Feature Lock-in settings as new platform_settings entries. The cron job will read from whichever key provides the most specific/relevant value. Document the overlapping keys in code comments.

---

## G8.1 -- Account Deletion Execution Pipeline (Right to Erasure)

### What This Sub-Step Builds

The actual data scrubbing/pseudonymization job that runs after the 30-day cooling-off expires. G6 built the REQUEST flow (user clicks delete, cooling-off starts). G8.1 builds the EXECUTION flow (data is actually pseudonymized/deleted).

### Scope

**BullMQ Cron Job: `account-deletion-executor`**

A new BullMQ job (NOT part of `platform-cron` -- separate queue in the `cleanup` family) that runs daily at 04:00 UTC. For each user where `deletionRequestedAt + gracePeriodDays < now()`:

1. **Pre-flight check:** Re-verify no blocking orders/disputes/returns (same logic as `getBlockersForUser`).
2. **Generate pseudonym:** `deleted_user_[SHA256(userId + salt)]` where salt is a random 32-byte value generated once per deletion and NOT stored.
3. **Pseudonymize financial records:**
   - `order` table: replace `buyerId`/`sellerId` with pseudonym where they match the userId. Set buyer/seller name fields to pseudonym.
   - `ledger_entry` table: replace `userId` with pseudonym. (Ledger is immutable -- this is the ONLY allowed mutation per GDPR legal exception. Must bypass the DB trigger for this specific operation, OR use a dedicated `pseudonymize_ledger_actor` stored procedure.)
   - `payout` / `payout_batch`: replace `ownerId` with pseudonym.
   - `affiliate_commission` / `affiliate_payout`: pseudonymize if user was affiliate.
   - `tax_info`: hard delete (encrypted PII).
4. **Pseudonymize messages:** In `message` table, replace `senderId` with pseudonym where senderId = userId. In `conversation`, set participant name to pseudonym.
5. **Pseudonymize audit logs:** In `audit_event`, replace `actorId` with pseudonym where actorId = userId.
6. **Remove listings from search:** Remove all user's listings from Typesense index.
7. **Delete images from R2:** Delete all listing images from R2 storage for this user's listings (per Decision #111, images with face detection flag are hard-deleted immediately; others follow tiered lifecycle -- but on account deletion, all are de-linked from identity).
8. **Hard delete PII:** Clear `user.name`, `user.email` (set to pseudonym@deleted.twicely.co), `user.phone`, `user.avatarUrl`, `user.bio`, `user.displayName`, `user.username` (set to pseudonym). Set `user.isBanned = true` to prevent re-registration confusion.
9. **Delete addresses:** Hard delete all entries in `address` table for this user.
10. **Cascade crosslister cleanup:** Delete `crosslister_account` tokens (already revoked by G6's cascadeProjectionsToOrphaned, but ensure hard delete of stored tokens).
11. **Send confirmation email:** Using `privacy.deletion_completed` template (already exists in templates-privacy.ts). Send to the ORIGINAL email (captured before deletion) as a final notification.
12. **Create CRITICAL audit event:** Record the deletion completion with pseudonymized details.

**Server Action: `executeAccountDeletion`** (internal helper, NOT a server action -- called only by the BullMQ job)

### Database

No new tables. Uses existing tables only.

New column needed: NONE. The `user.deletionRequestedAt` already exists.

### Platform Settings Read By This Job

| Key (as seeded) | Default | Usage |
|---|---|---|
| `gdpr.deletionGracePeriodDays` | 30 | Days before execution begins |
| `gdpr.anonymizeOnDeletion` | true | If false, hard-delete instead of pseudonymize (not recommended) |

### CASL

No new subjects. The job runs as a system process (no user session). The admin `forceCompleteDeletion` action (already exists) triggers immediate execution by backdating `deletionRequestedAt`.

### Business Rules (Feature Lock-in section 37 + Decision #110)

- Financial records (order, ledger_entry, payout, fee records) are PSEUDONYMIZED, never hard-deleted. Retained 7 years.
- Ledger entries are immutable. Pseudonymization of the actor reference is the only allowed mutation (GDPR legal exception overrides immutability for PII fields only).
- Pseudonymization is one-way: `deleted_user_[SHA256(userId + salt)]`. No reverse mapping stored.
- User cannot reactivate after execution completes (cooling-off period has passed).
- Confirmation email sent to original email BEFORE the email field is cleared.
- Images follow Decision #111 tiered lifecycle. On deletion confirmation: de-link from identity (nullify sellerId FK), strip EXIF. Face-flagged images hard-deleted immediately.

### Constraints

- The pseudonymization salt MUST be generated fresh for each deletion and MUST NOT be stored anywhere. This ensures one-way pseudonymization.
- Do NOT delete `ledger_entry` rows. Only update the `userId` field to the pseudonym.
- Do NOT bypass the ledger immutability trigger in application code. If the DB trigger prevents UPDATE on ledger_entry, create a dedicated PostgreSQL function `pseudonymize_ledger_entries(old_user_id TEXT, pseudonym TEXT)` that runs with elevated privileges. This function is the ONLY code path that modifies ledger entries.
- The job must be idempotent. If it fails halfway and retries, it should not produce duplicate pseudonyms or miss records.
- Do NOT process users who still have blocking conditions (open orders, disputes, returns). Skip them and log a warning.

---

## G8.2 -- Automated Data Retention Cron Jobs

### What This Sub-Step Builds

The `cleanup` queue with three repeatable BullMQ jobs that enforce data retention policies automatically.

### Scope

**1. Session Cleanup Job** -- Every 6 hours (Feature Lock-in section 40)

Purge expired sessions from the `session` table where `expiresAt < now()`.

```
DELETE FROM session WHERE expires_at < now()
```

Simple, idempotent. Log count of purged sessions.

**2. Audit Archive Job** -- Monthly 1st at 03:00 UTC (Feature Lock-in section 40)

Per Feature Lock-in section 39:
- Events older than `retention.auditLogDays` (default 2555 days) are candidates.
- If `audit.archiveBeforePurge` is true (default): archive to R2 as compressed JSON before deleting.
- Archive format: `audit-archives/{year}/{month}/audit-events-{year}-{month}.json.gz` in R2.
- After successful archive upload: hard delete the archived rows from `audit_event`.
- NOTE: `audit_event` has INSERT-only application constraints, but this cron job operates at a system level. Create a dedicated function or use a system-level DB operation for the DELETE. The application code never deletes audit events; only this system cron does, and only after archival.

Platform settings read:
| Key (to seed) | Default | Usage |
|---|---|---|
| `audit.retentionMonths` | 24 | Months before archive/purge (Feature Lock-in section 39) |
| `audit.archiveBeforePurge` | true | Archive to R2 before deleting |

**NOTE:** `retention.auditLogDays` (2555 = 7 years) is already seeded but conflicts with `audit.retentionMonths` (24 = 2 years) from Feature Lock-in section 39. The cron job should read `audit.retentionMonths` as the primary authority for when to archive, since Feature Lock-in section 39 explicitly defines this key. If not found, fall back to `retention.auditLogDays` converted to months.

**3. Data Retention Purge Job** -- Daily at 04:30 UTC

Purge data that has exceeded its retention period. Processes each category:

| Category | Setting Key | Default | Action |
|---|---|---|---|
| Expired sessions | (handled by job 1) | -- | -- |
| Search logs | `retention.searchLogDays` | 90 | Hard delete rows older than threshold |
| Webhook logs | `retention.webhookLogDays` | 90 | Hard delete rows older than threshold |
| Analytics events | `retention.analyticsEventDays` | 365 | Hard delete granular events older than threshold |
| Notification logs | `retention.notificationLogDays` | 180 | Hard delete old notification delivery records |
| Messages (orphaned) | `retention.messageDays` | 730 | Pseudonymize messages where BOTH participants have deleted accounts |
| Expired data exports | -- | 7 days | Hard delete `data_export_request` rows with status COMPLETED/FAILED/EXPIRED older than 7 days. Delete corresponding R2 files. |

**IMPORTANT:** Many of these tables (search_log, webhook_log, analytics_event, notification_log) may not exist yet as concrete tables in the codebase. The cron job should gracefully skip any category where the target table does not exist, logging a debug message. This prevents the job from failing on tables that haven't been created yet. The job structure is ready for when those tables are created in future phases.

**4. Account Deletion Executor** -- Daily at 04:00 UTC (from G8.1)

This is the job from G8.1 above. It runs as part of the cleanup queue.

### Queue Architecture

Create a new `cleanup` queue (per Feature Lock-in section 40: concurrency 3, retry 1x, no dead letter). Register 3 repeatable jobs + the account deletion executor.

### Platform Settings to Seed

Add to `v32-platform-settings-extended.ts`:

```
{ key: 'audit.retentionMonths', value: 24, type: 'number', category: 'privacy', description: 'Months before audit events are archived and purged' },
{ key: 'audit.archiveBeforePurge', value: true, type: 'boolean', category: 'privacy', description: 'Archive audit events to R2 cold storage before purging' },
{ key: 'privacy.orderRetentionYears', value: 7, type: 'number', category: 'privacy', description: 'Years to retain pseudonymized order data (legal/tax)' },
{ key: 'privacy.granularAnalyticsRetentionDays', value: 90, type: 'number', category: 'privacy', description: 'Days before granular analytics data is purged' },
```

(Other keys from Feature Lock-in section 37 are already seeded under different names -- see INCONSISTENCY 5.)

---

## G8.3 -- Cookie Consent Banner & `/p/cookies` Page

### What This Sub-Step Builds

EU/EEA cookie consent banner (Feature Lock-in section 37) and the `/p/cookies` page for managing consent.

### Scope

**Cookie Consent Categories** (Feature Lock-in section 37):
1. **Strictly Necessary** -- always on, cannot be toggled (session cookies, CSRF, auth)
2. **Functional** -- opt-in (preferences, language, recently viewed)
3. **Analytics** -- opt-in (usage tracking, performance monitoring)

**Cookie Banner Component** (`cookie-consent-banner.tsx`):
- Displayed to all visitors when no consent cookie exists
- GeoIP detection for EU/EEA: show full banner with category toggles for EU visitors. For non-EU visitors, show a simplified "We use cookies" notice with accept/settings link (CCPA "Do Not Sell" link in footer handles California).
- On accept/reject: store consent in a `twicely_consent` cookie (JSON: `{ necessary: true, functional: boolean, analytics: boolean, timestamp: string, version: string }`)
- Cookie is httpOnly: false (needs client-side read for analytics gating), Secure, SameSite=Lax, expires in 1 year
- If user is authenticated, also persist consent to the `user` table via server action

**`/p/cookies` Page** (policy layout, PUBLIC):
- Explains what cookies are used and why
- Lists each category with toggle switches (same as banner)
- "Save Preferences" button
- Link to Privacy Policy (`/p/privacy`)
- Reads current consent from cookie or user record

**Server Action: `updateCookieConsent`**:
- Authenticated users: store consent preferences in user record
- Input: `{ functional: boolean, analytics: boolean }`
- Creates audit event at severity LOW

**New Column on `user` Table:**
- `cookieConsentJson` (jsonb, nullable) -- stores authenticated user's cookie consent preferences
- Shape: `{ functional: boolean, analytics: boolean, updatedAt: string, version: string }`

**NOT SPECIFIED -- Owner Decision Needed:**
- GeoIP detection mechanism: The spec says "detected by GeoIP" but does not specify the provider. Options: (a) Cloudflare `CF-IPCountry` header (free, available on Railway if proxied through CF), (b) MaxMind GeoLite2 database, (c) ip-api.com free tier. **Recommendation:** Use Cloudflare `CF-IPCountry` header if available, with a fallback to assume EU (conservative default). This requires NO new dependency.
- The `version` field in consent cookie: should this track privacy policy version? The spec doesn't define versioning. **Recommendation:** Use a simple integer version starting at 1. When the privacy policy changes, increment the version and re-show the banner to users whose consent is on an older version.

### Platform Settings

Already seeded: `gdpr.cookieConsentRequired` (boolean, default true). The banner reads this setting. If false, no banner is shown.

### Routes

| Route | Layout | Gate | Phase |
|---|---|---|---|
| `/p/cookies` | policy | PUBLIC | G8 (NEW -- not in Page Registry) |

### Business Rules

- Strictly Necessary cookies CANNOT be disabled by the user.
- Analytics scripts (if any) must NOT load until the user has explicitly opted in to the Analytics category.
- Consent must be revocable at any time via `/p/cookies`.
- Consent stored per user (if authenticated) AND per cookie (for guests).
- On guest-to-user session merge (signup/login), cookie consent from the guest session transfers to the user record.

---

## G8.4 -- Enhanced Data Export (GDPR Article 20 Portability) & Admin Dashboard

### What This Sub-Step Builds

1. Enhance the existing data export job to include ALL user data per GDPR Article 20.
2. Enhance the admin `/data-retention` dashboard with GDPR compliance metrics and retention job status.

### Scope

**Enhanced Data Export** -- Modify `src/lib/jobs/data-export.ts`:

The existing `collectUserData()` function collects: profile, orders (buyer+seller), listings, ledger entries, reviews written/received. Per Decision #110, the export MUST also include:

- Full sold listing history (already covered by listings query)
- Complete payout history (`payout` table)
- Saved searches (`saved_search` table)
- Watchlist items (`watchlist_item` table)
- Following list (`follow` table)
- Notification preferences (`notification_preference` table)
- Addresses (`address` table)
- Tax information (`tax_info` table, decrypted -- this is the user's own data)
- Affiliate data if applicable (`affiliate`, `affiliate_commission`, `affiliate_payout`)
- Cookie consent preferences (from user record)
- Identity verification status (`identity_verification` table -- status only, no raw documents)
- Conversations and messages (`conversation`, `message` tables)
- Local transaction history (`local_transaction` table)
- Promo code redemptions (`promo_code_redemption` table)
- User interests / personalization tags (`user_interest` table)

The export must include an `_metadata` section:
```json
{
  "_metadata": {
    "exportedAt": "2026-03-15T12:00:00Z",
    "userId": "cuid2...",
    "format": "json",
    "version": "2.0",
    "sections": ["profile", "orders", "listings", ...]
  }
}
```

**Split `collectUserData` into `collectUserDataFull`** to keep the function under 300 lines. Use a parallel `Promise.all` for all queries (existing pattern).

**Enhanced Admin Dashboard** -- Modify `src/components/pages/data-retention/retention-dashboard.tsx`:

Add two new sections to the existing RetentionDashboard component:

1. **Retention Job Status Card**: Shows last run time and result for each cleanup cron job (session cleanup, audit archive, data purge, account deletion executor). Reads from BullMQ job metadata (or a simple `platform_setting` key updated by each job on completion).
2. **GDPR Compliance Summary Card**: Shows counts of:
   - Active deletion requests (in cooling-off)
   - Completed deletions (last 30 days)
   - Pending data exports
   - Completed data exports (last 30 days)
   - Failed data exports requiring attention

The existing dashboard already shows policies, deletion queue, and export requests. These new cards ADD to it.

**New Admin Action: `getGdprComplianceSummary`** in `admin-data-retention.ts`:
- Returns the counts described above
- Requires `read` permission on `DataRetention` CASL subject

**New Admin Action: `getRetentionJobStatus`** in `admin-data-retention.ts`:
- Returns last run timestamps and results for cleanup jobs
- Reads from platform_settings keys set by each job on completion

### Platform Settings Written By Jobs (status tracking)

Each cleanup cron job writes its last run status to a platform_setting key on completion:

| Key | Type | Written By |
|---|---|---|
| `cleanup.sessionCleanup.lastRunAt` | string (ISO date) | Session cleanup job |
| `cleanup.sessionCleanup.lastResult` | string | Session cleanup job |
| `cleanup.auditArchive.lastRunAt` | string (ISO date) | Audit archive job |
| `cleanup.auditArchive.lastResult` | string | Audit archive job |
| `cleanup.dataPurge.lastRunAt` | string (ISO date) | Data purge job |
| `cleanup.dataPurge.lastResult` | string | Data purge job |
| `cleanup.accountDeletion.lastRunAt` | string (ISO date) | Account deletion executor |
| `cleanup.accountDeletion.lastResult` | string | Account deletion executor |

These are NOT seeded -- they're created on first job run via upsert.

---

## Constraints -- What NOT To Do

### Banned Terms
Scan all output for: `SellerTier`, `SubscriptionTier`, `FVF`, `Final Value Fee`, `BASIC` (as StoreTier), `ELITE`, `PLUS` (as ListerTier), `MAX` (as ListerTier), `PREMIUM`, `Twicely Balance`, `wallet` (seller UI), `Withdraw` (seller UI).

### Tech Stack
- Use BullMQ for all background jobs (NOT raw `setTimeout` or `setInterval`)
- Use Valkey as BullMQ backend (NOT Redis)
- Use Cloudflare R2 for archive storage (NOT S3 direct, NOT MinIO)
- Use Drizzle ORM for all DB operations (NOT Prisma)
- Use React Email + Resend for deletion confirmation email (NOT Nodemailer)

### Code Patterns
- `strict: true` TypeScript. Zero `as any`, zero `@ts-ignore`.
- Money as integer cents only.
- All settings read from `platform_settings` table via `getPlatformSetting()`. Never hardcode retention periods.
- Max 300 lines per file. Split if longer.
- Ownership via `userId` always.
- Zod validation on all inputs (server actions).
- Explicit field mapping (never spread request body).
- Server-side only for deletion/pseudonymization logic.
- The pseudonymization salt MUST NOT be stored.
- Exported functions in `'use server'` files = server actions. Keep helpers unexported.

### Routes
- `/p/cookies` (NOT `/p/cookie`, NOT `/cookies`, NOT `/settings/cookies`)
- `/my/settings/privacy` (already exists, do NOT recreate)
- `/data-retention` (already exists, do NOT recreate)
- `/cfg?tab=privacy` (already exists, do NOT recreate)

### Business Logic
- Financial records (order, ledger_entry, payout) are NEVER hard-deleted. Only pseudonymized. Retained 7 years.
- Ledger entries are immutable. Pseudonymization of actor reference is the ONLY exception (GDPR legal carve-out).
- Audit events have INSERT-only application constraint. The archive/purge cron is a SYSTEM operation that bypasses application-level immutability.
- No retroactive changes to financial data.
- Pseudonymization is one-way. No reverse mapping stored.
- Images follow Decision #111 tiered lifecycle.
- Face-flagged images hard-deleted immediately on account deletion confirmation.

---

## Acceptance Criteria

### G8.1 -- Account Deletion Execution

- [ ] BullMQ job `account-deletion-executor` runs daily at 04:00 UTC
- [ ] Users past cooling-off period have PII hard-deleted (name, email, phone, avatar, bio, display name cleared)
- [ ] User email replaced with `pseudonym@deleted.twicely.co`
- [ ] User username replaced with pseudonym
- [ ] Financial records (order, ledger, payout) pseudonymized with `deleted_user_[hash]` -- NOT deleted
- [ ] Messages pseudonymized (senderId replaced)
- [ ] Audit events pseudonymized (actorId replaced)
- [ ] User addresses hard-deleted
- [ ] Tax info hard-deleted
- [ ] Listings removed from Typesense search index
- [ ] Confirmation email sent to ORIGINAL email before PII cleared
- [ ] CRITICAL audit event created for each deletion
- [ ] Job is idempotent (safe to retry on failure)
- [ ] Users with blocking conditions (open orders/disputes/returns) are SKIPPED, not failed
- [ ] Pseudonymization salt is NOT stored anywhere
- [ ] Admin `forceCompleteDeletion` action (existing) triggers immediate execution by backdating `deletionRequestedAt`

### G8.2 -- Retention Cron Jobs

- [ ] `cleanup` BullMQ queue exists with concurrency 3
- [ ] Session cleanup runs every 6 hours, deletes expired sessions
- [ ] Audit archive runs monthly 1st at 03:00 UTC
- [ ] Audit archive uploads compressed JSON to R2 before deleting events
- [ ] Audit archive respects `audit.retentionMonths` setting (default 24)
- [ ] Data purge runs daily at 04:30 UTC
- [ ] Data purge gracefully skips tables that don't exist yet
- [ ] Expired data export requests (>7 days) are cleaned up with R2 files deleted
- [ ] All jobs log their results
- [ ] All jobs write last-run status to platform_settings
- [ ] New platform settings seeded: `audit.retentionMonths`, `audit.archiveBeforePurge`, `privacy.orderRetentionYears`, `privacy.granularAnalyticsRetentionDays`

### G8.3 -- Cookie Consent

- [ ] Cookie banner appears for visitors without existing consent cookie
- [ ] Banner shows three categories: Necessary (always on), Functional (toggle), Analytics (toggle)
- [ ] Accept All / Reject All / Save Preferences buttons work
- [ ] Consent stored in `twicely_consent` cookie (JSON, 1-year expiry)
- [ ] Authenticated users have consent persisted to user record
- [ ] `/p/cookies` page exists with policy layout, PUBLIC gate
- [ ] `/p/cookies` shows current consent state and allows modification
- [ ] `gdpr.cookieConsentRequired` platform setting controls whether banner is shown
- [ ] Guest consent merges to user record on login/signup
- [ ] New `cookieConsentJson` column on user table (jsonb, nullable)
- [ ] LOW severity audit event created on consent change (authenticated users)
- [ ] No banned terms in any UI copy

### G8.4 -- Enhanced Export & Dashboard

- [ ] Data export includes ALL user data categories listed in scope
- [ ] Export includes `_metadata` section with version and section list
- [ ] Export includes payout history, saved searches, watchlist, follows, addresses, tax info, conversations, messages, local transactions, promo redemptions, interests, affiliate data, identity verification status
- [ ] Admin dashboard shows GDPR compliance summary card (deletion counts, export counts)
- [ ] Admin dashboard shows retention job status card (last run, result per job)
- [ ] `getGdprComplianceSummary` action returns correct counts
- [ ] `getRetentionJobStatus` action returns job timestamps
- [ ] All monetary values in export are integer cents
- [ ] No PII leaked in admin dashboard (masked as per G6 pattern)

### Negative Cases

- [ ] Unauthenticated users CANNOT access `/my/settings/privacy`
- [ ] Non-ADMIN staff CANNOT access `forceCompleteDeletion`
- [ ] Account deletion executor does NOT delete financial records -- only pseudonymizes
- [ ] Account deletion executor does NOT process users still in cooling-off period
- [ ] Account deletion executor does NOT process users with blocking orders/disputes
- [ ] Cookie consent banner does NOT appear when `gdpr.cookieConsentRequired` is false
- [ ] Strictly Necessary cookies CANNOT be disabled by users
- [ ] Data export does NOT include other users' data
- [ ] Pseudonymization salt is NOT stored or retrievable
- [ ] Audit archive does NOT delete events without successful R2 upload (when archiveBeforePurge is true)

---

## Test Requirements

### Unit Tests

**G8.1 -- Account Deletion Execution:**
- `account-deletion-executor.test.ts` (~18 tests):
  - generates correct pseudonym format (deleted_user_[64 hex chars])
  - pseudonymizes order buyer/seller IDs
  - pseudonymizes ledger entry userIds
  - pseudonymizes payout ownerIds
  - pseudonymizes message senderIds
  - pseudonymizes audit event actorIds
  - hard-deletes user PII (name, email, phone, avatar, bio)
  - hard-deletes addresses
  - hard-deletes tax info
  - replaces email with pseudonym@deleted.twicely.co
  - replaces username with pseudonym
  - sends confirmation email before PII cleared
  - creates CRITICAL audit event
  - skips users still in cooling-off period
  - skips users with open orders
  - skips users with open disputes
  - is idempotent (running twice on same user produces same result)
  - reads gracePeriodDays from platform settings

**G8.2 -- Retention Jobs:**
- `cleanup-session.test.ts` (~5 tests):
  - deletes sessions past expiresAt
  - does not delete active sessions
  - handles empty session table
  - logs purged count
  - writes last-run status to platform settings

- `cleanup-audit-archive.test.ts` (~8 tests):
  - archives events older than retention threshold
  - uploads compressed JSON to R2
  - deletes archived events after successful upload
  - does NOT delete if R2 upload fails
  - reads retentionMonths from platform settings
  - respects archiveBeforePurge setting
  - handles empty audit table
  - writes last-run status

- `cleanup-data-purge.test.ts` (~6 tests):
  - purges expired data export requests older than 7 days
  - deletes R2 files for expired exports
  - gracefully skips non-existent tables
  - reads retention settings from platform_settings
  - logs results per category
  - writes last-run status

**G8.3 -- Cookie Consent:**
- `cookie-consent.test.ts` (~8 tests):
  - updateCookieConsent requires authentication
  - updateCookieConsent validates input (functional and analytics are booleans)
  - updateCookieConsent stores preferences in user record
  - updateCookieConsent creates LOW audit event
  - rejects unknown fields (Zod strict)
  - reads cookieConsentRequired from platform settings
  - handles user with no existing consent
  - banner component renders correctly with categories

**G8.4 -- Enhanced Export & Dashboard:**
- `data-export-enhanced.test.ts` (~6 tests):
  - collectUserDataFull includes all required sections
  - export includes _metadata section
  - export includes payout history
  - export includes messages/conversations
  - export includes affiliate data
  - export format is valid JSON

- `admin-gdpr-dashboard.test.ts` (~5 tests):
  - getGdprComplianceSummary requires DataRetention read permission
  - getGdprComplianceSummary returns correct counts
  - getRetentionJobStatus returns last-run timestamps
  - non-admin staff cannot access compliance summary
  - handles empty state (no deletions, no exports)

**Total: ~56 new tests across 7 test files.**

### Edge Cases

- User deletes account, then the deletion executor fails halfway through pseudonymization. On retry, it should complete without double-pseudonymizing already-processed records.
- User with no orders/listings/messages -- deletion should complete quickly with no errors.
- User with massive data (10k+ orders) -- ensure queries are batched to avoid OOM.
- Cookie consent cookie is malformed or tampered -- banner should re-show.
- Data export for user with deleted account (impossible path -- ensure guard).
- Audit archive with 0 events to archive -- should complete successfully as no-op.

---

## File Approval List

### New Files (20 files)

| # | Path | Description |
|---|------|-------------|
| 1 | `src/lib/jobs/account-deletion-executor.ts` | BullMQ job: daily account deletion execution pipeline |
| 2 | `src/lib/gdpr/pseudonymize.ts` | Pseudonymization utility: generate pseudonym, pseudonymize records by table |
| 3 | `src/lib/jobs/cleanup-queue.ts` | Cleanup BullMQ queue + 3 repeatable job registrations |
| 4 | `src/lib/jobs/cleanup-session.ts` | Session cleanup job (purge expired sessions) |
| 5 | `src/lib/jobs/cleanup-audit-archive.ts` | Audit archive job (archive to R2 + purge) |
| 6 | `src/lib/jobs/cleanup-data-purge.ts` | Data retention purge job (multi-category) |
| 7 | `src/components/cookie-consent-banner.tsx` | Client-side cookie consent banner component |
| 8 | `src/lib/actions/cookie-consent.ts` | Server action: updateCookieConsent for authenticated users |
| 9 | `src/app/(marketplace)/p/cookies/page.tsx` | Cookie preferences page (PUBLIC, policy layout) |
| 10 | `src/components/pages/privacy/cookie-preferences.tsx` | Cookie preferences form component |
| 11 | `src/lib/jobs/__tests__/account-deletion-executor.test.ts` | Tests for deletion execution pipeline |
| 12 | `src/lib/jobs/__tests__/cleanup-session.test.ts` | Tests for session cleanup |
| 13 | `src/lib/jobs/__tests__/cleanup-audit-archive.test.ts` | Tests for audit archive |
| 14 | `src/lib/jobs/__tests__/cleanup-data-purge.test.ts` | Tests for data purge |
| 15 | `src/lib/actions/__tests__/cookie-consent.test.ts` | Tests for cookie consent action |
| 16 | `src/lib/jobs/__tests__/data-export-enhanced.test.ts` | Tests for enhanced data export |
| 17 | `src/lib/actions/__tests__/admin-gdpr-dashboard.test.ts` | Tests for GDPR dashboard actions |
| 18 | `src/lib/gdpr/__tests__/pseudonymize.test.ts` | Tests for pseudonymization utility |
| 19 | `drizzle/XXXX_add-cookie-consent-column.sql` | Migration: add cookieConsentJson to user table |
| 20 | `src/components/pages/data-retention/gdpr-compliance-card.tsx` | Admin GDPR compliance summary card component |

### Modified Files (10 files)

| # | Path | Change |
|---|------|--------|
| 1 | `src/lib/db/schema/auth.ts` | Add `cookieConsentJson` column to user table |
| 2 | `src/lib/db/seed/v32-platform-settings-extended.ts` | Seed new platform settings (audit.retentionMonths, audit.archiveBeforePurge, privacy.orderRetentionYears, privacy.granularAnalyticsRetentionDays) |
| 3 | `src/lib/jobs/cron-jobs.ts` | Register cleanup queue jobs in startup |
| 4 | `src/lib/jobs/data-export.ts` | Enhance collectUserData to include all GDPR Article 20 categories |
| 5 | `src/lib/actions/admin-data-retention.ts` | Add getGdprComplianceSummary + getRetentionJobStatus actions |
| 6 | `src/components/pages/data-retention/retention-dashboard.tsx` | Add GDPR compliance card + retention job status card |
| 7 | `src/app/(marketplace)/layout.tsx` | Add CookieConsentBanner to marketplace layout |
| 8 | `src/components/admin/settings/settings-display.ts` | Add labels for new platform settings |
| 9 | `src/components/admin/settings/settings-search-index.ts` | Add search entries for new settings |
| 10 | `src/lib/notifications/templates-privacy.ts` | Add consent_changed notification template |

### Total: 30 files (20 new + 10 modified)

---

## Verification Checklist

After implementation, run these checks and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Full test suite
pnpm test

# 3. Banned terms grep
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|Twicely Balance\|wallet\|Withdraw" src/lib/jobs/account-deletion-executor.ts src/lib/gdpr/pseudonymize.ts src/lib/jobs/cleanup-queue.ts src/lib/jobs/cleanup-session.ts src/lib/jobs/cleanup-audit-archive.ts src/lib/jobs/cleanup-data-purge.ts src/components/cookie-consent-banner.tsx src/lib/actions/cookie-consent.ts src/app/\(marketplace\)/p/cookies/page.tsx src/components/pages/privacy/cookie-preferences.tsx src/components/pages/data-retention/gdpr-compliance-card.tsx || echo "CLEAN"

# 4. Route prefix check
grep -rn '"/l/\|"/listing/\|"/store/\|"/shop/\|"/dashboard\|"/admin\|"/search"' src/lib/jobs/account-deletion-executor.ts src/lib/gdpr/pseudonymize.ts src/components/cookie-consent-banner.tsx src/lib/actions/cookie-consent.ts src/app/\(marketplace\)/p/cookies/page.tsx || echo "CLEAN"

# 5. File size check
wc -l src/lib/jobs/account-deletion-executor.ts src/lib/gdpr/pseudonymize.ts src/lib/jobs/cleanup-queue.ts src/lib/jobs/cleanup-session.ts src/lib/jobs/cleanup-audit-archive.ts src/lib/jobs/cleanup-data-purge.ts src/components/cookie-consent-banner.tsx src/lib/actions/cookie-consent.ts src/app/\(marketplace\)/p/cookies/page.tsx src/components/pages/privacy/cookie-preferences.tsx src/components/pages/data-retention/gdpr-compliance-card.tsx src/lib/jobs/data-export.ts src/lib/actions/admin-data-retention.ts src/components/pages/data-retention/retention-dashboard.tsx

# 6. Lint script
./twicely-lint.sh
```

### Expected Outcomes

- TypeScript: 0 errors
- Test count: >= 6374 (current baseline) + ~56 new = ~6430+
- No banned terms
- No wrong route prefixes
- All files under 300 lines
- Lint script passes all 7 checks

---

## Decomposition & Execution Order

| Sub-step | Dependencies | Parallelizable? | Est. Time |
|---|---|---|---|
| G8.1 | None (builds on G6) | No (foundational) | 90 min |
| G8.2 | G8.1 (shares cleanup queue) | No (needs queue from G8.1) | 60 min |
| G8.3 | None (independent UI) | Yes (parallel with G8.1/G8.2) | 60 min |
| G8.4 | G8.1 + G8.2 (needs job status tracking) | No (needs jobs to exist) | 60 min |

**Recommended order:** G8.1 -> G8.2 -> G8.3 -> G8.4

G8.3 (cookie consent) is technically independent and could be built in parallel with G8.1/G8.2, but sequential execution is simpler for the installer.
