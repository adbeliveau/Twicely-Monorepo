# Detailed Step Findings

Per-step findings extracted from install prompt writing sessions.
Referenced from MEMORY.md. Organized by phase/step.

---

## D6 Authentication Program (2026-03-03)
- See D6 install prompt for full details. All schema exists. CASL `AuthenticationRequest` now in subjects.
- Decision #39/#40: cost split, per-item certs, pHash, certs die on relist

## D2.2 Combined Shipping Mode 5 (2026-03-04)
- See D2.2 install prompt for full details. All shipping schema exists. CASL `CombinedShippingQuote` now added.

## A4/A4.1 Staff Roles (2026-03-04)
- See A4/A4.1 install prompts. `StaffUser`+`CustomRole` in CASL. bcryptjs (cost 10) for staff passwords.
- `customRole.permissionsJson` = jsonb array of `{ subject, action }` (CASL-native)

## D4 Financial Center (2026-03-04)
- D4 through D4.3 ALL COMPLETE. D4 Audit Repair prompt written.
- Schema in `finance.ts`: expense, mileageEntry, financialReport, accountingIntegration, financeSubscription
- `financeTierEnum` = `['FREE', 'PRO']` only (2 tiers). Decision #45 5-tier model is SUPERSEDED.
- CASL subjects: Expense, FinancialReport, MileageEntry all added. Seller has `manage` on all three.
- Delegation: `finance.view` grants read-only. No `finance.manage` scope (CRUD is owner-only).
- Platform settings: finance.pricing.pro.annualCents (999), monthlyCents (1499), mileageRatePerMile (0.70)
- "PDF" format = print-optimized HTML uploaded to R2 (no Puppeteer)
- See [d4-audit-patterns.md](d4-audit-patterns.md) for audit defect patterns and file structure

## E1.1 Notification Preferences (2026-03-05)
- notification/notificationPreference/notificationTemplate tables ALL EXIST in `src/lib/db/schema/notifications.ts`
- `notificationPreference` has per-template toggles: email, push, inApp, sms (4 booleans per templateKey)
- NO digest/quiet-hours columns exist ANYWHERE in schema doc or codebase
- `user.marketingOptIn` boolean ALREADY EXISTS in auth.ts line 26
- NO `timezone` column on user table or any notification table
- CASL: `Notification` subject exists, buyer gets `can('manage', 'Notification', { userId })` in ability.ts
- `notify()` in service.tsx: 108 lines, checks per-template prefs, sends EMAIL + IN_APP
- Existing form: 112 lines, only email + inApp checkbox grid, no digest/quiet/marketing sections
- 30 templates across 10 categories in templates.ts (with shipping-quote templates in separate file)
- Comms platform settings NOT YET SEEDED (no `comms.*` keys in seed data)
- SPEC INCONSISTENCY: Feature Lock-in uses `notifications.*` admin keys, Platform Settings Canonical uses `comms.*` keys
- SPEC GAP: No schema table for user-level notification settings (digest freq, quiet hours, timezone)
- Resolution: New `notification_setting` table (one row per user) with digest + quiet hours + seller notif fields
- 18 files total: 8 new + 5 modified + 4 test + 1 migration

## E1.3 Q&A Notifications (2026-03-05)
- `listingQuestion` table ALREADY EXISTS in `src/lib/db/schema/social-discovery.ts` (24 lines, 3 indexes)
- Schema re-exported in `src/lib/db/schema/index.ts` line 30 (`export * from './social-discovery'`)
- CASL: `ListingQuestion` NOW in subjects.ts (added by E1.3)
- Q&A actions/queries NOW EXIST: askQuestion, answerQuestion, hideQuestion, pinQuestion + queries
- 5 seed Q&A entries in `src/lib/db/seed/seed-social.ts` (3 answered, 2 unanswered, 1 pinned)
- Notifier: qa-notifier.ts with notifyQuestionAsked + notifyQuestionAnswered
- `listing.ownerUserId` = seller userId. Q&A ownership check: listing -> ownerUserId == session.userId
- Schema limits: questionText 500 chars, answerText 1000 chars, max 3 pinned per listing
- Anti-spam: max 3 pending (unanswered) questions per user per listing
- Decision #55/#56: Q&A is Amazon-style structured, public, NOT Poshmark comments
- 13 files total: 8 new + 5 modified, ~42 new tests

## E1.4 Q&A Listing UI (2026-03-05)
- Pure UI step: 8 new files + 1 modified (page.tsx), ~25-30 new tests
- All backend from E1.3: actions, queries, validations, CASL, notifier all exist
- Listing page at `/i/[slug]` is 299 lines -- careful not to exceed 300
- `getListingPageData()` in listing-page.ts loads all listing data; Q&A fetched separately by QaSection
- `formatDate(date, 'relative')` exists in format.ts for timestamps
- Seller actions via `session.onBehalfOfSellerId ?? session.userId` (delegation support)
- `askQuestion` already checks listing.status === 'ACTIVE' server-side
- Build tracker "moderation scan" NOT SPECIFIED -- seller hideQuestion IS the moderation mechanism

## E4 Feature Flags + Audit Log (2026-03-05)
- `featureFlag` table ALREADY EXISTS in `src/lib/db/schema/platform.ts` (lines 37-49)
- `featureFlagTypeEnum` ALREADY EXISTS in enums.ts: `['BOOLEAN', 'PERCENTAGE', 'TARGETED']`
- `auditEvent` table ALREADY EXISTS in `platform.ts` (lines 52-69)
- CASL: `FeatureFlag` + `AuditEvent` ALREADY in subjects.ts (lines 25-26)
- CASL: DEVELOPER has `read` + `update` on FeatureFlag (NOT create/delete). ADMIN has `manage all`.
- CASL: `cannot('delete', 'AuditEvent')` enforced for ALL roles (immutable)
- admin-nav.ts: `/flags` entry exists (roles: ADMIN, DEVELOPER), `/audit` entry exists (roles: any)
- SPEC INCONSISTENCY: Feature Lock-in shows `/cfg/flags` route, Page Registry shows `/flags` -- use `/flags`
- SPEC INCONSISTENCY: Feature Lock-in schema uses plural `feature_flags` table, actual schema uses `feature_flag`
- All spec inconsistencies resolved in favor of actual schema doc v2.0.8
- 17 files total: 16 new + 1 modified (seed), ~40-45 new tests

## E5 Monitoring (2026-03-05)
- CASL: `HealthCheck` subject ALREADY EXISTS in subjects.ts (line 29)
- CASL: DEVELOPER `can('read', 'HealthCheck')` ALREADY in platform-abilities.ts (line 67)
- CASL: SRE `can('read'+'manage', 'HealthCheck')` ALREADY in platform-abilities.ts (lines 72-74)
- Hub nav: `system-health` item ALREADY EXISTS in admin-nav.ts (lines 165-170)
- No `/health` or `/health/doctor` pages exist yet
- `providerInstance` + `providerHealthLog` tables ALREADY EXIST in providers.ts
- Structured logger ALREADY EXISTS at `src/lib/logger.ts`
- No Dockerfile or docker-compose files exist yet
- Platform Settings Canonical has NO monitoring section -- settings keys only in Feature Lock-in Section 41
- Cron pattern exists: Bearer CRON_SECRET in request header (see /api/cron/orders/route.ts)
- 33 files total: 30 new + 3 modified, across 5 parallel streams

## E2.1 Crosslister Connector Framework (2026-03-05) [COMPLETE]
- E2.1 IS DONE. All CASL, types, registries, validations, seed data committed.
- crosslister.ts schema: 233 lines, 9 tables. Enums: channelEnum (9 values) + 6 status/type enums.
- CASL: CrosslisterAccount, ChannelProjection, CrossJob, ImportBatch all in subjects.ts
- Delegation: crosslister.read/publish/import/manage all in staff-abilities.ts
- 40+ platform settings seeded in seed-crosslister.ts
- Connector interface: 10 required + 2 optional methods
- Channel tiers: A (eBay, Etsy), B (Mercari, Depop, FB, Grailed), C (Poshmark, TheRealReal)
- Launch channels: eBay, Poshmark, Mercari only (others disabled via feature flags)

## E2.2 Buyer-Seller Messaging Backend (2026-03-06) [COMPLETE]
- All backend exists: 3 action files, 1 query file, 1 validation file, 1 safety service, 1 notifier, 1 seed file
- `conversation` + `message` tables in `src/lib/db/schema/messaging.ts` (45 lines)
- CASL: `Message` + `Conversation` BOTH in subjects.ts. Buyer+Seller CASL rules added.
- Actions: createConversation, sendMessage, markAsRead, archiveConversation, reportMessage
- Decision #38: One conversation per buyer-seller-listing. LOCKED.

## E2.3 Messaging UI (2026-03-06) [COMPLETE]
- Phase E is 100% complete (19/19).
- Page Registry: `/m` -> `/my/messages` (308 redirect), pages inside hub shell
- Hub nav already has Messages section at hub-nav.ts line 149
- HubSidebar is client component -- cannot do async badge query. Pass unread count from layout.
- Listing detail page at 299 lines -- MUST extract action buttons to stay under 300
- 20 files total: 13 new + 7 modified, ~29 new tests

## F1 eBay Import (2026-03-06) [COMPLETE]
- Install prompt at `install-prompts/F1-ebay-import.md` covers F1.1 + F1.2 + F1.3
- Decision #16/#17: imports ACTIVE immediately, free flywheel, no insertion fees
- 33 files total (29 new + 4 modified), ~55-65 new tests, 3 parallel streams
- Key deferrals: pHash (text fingerprinting only), category mapping (null), Centrifugo (polling), image download (store URLs), token encryption (plaintext + TODO)
- eBay OAuth 2.0 Auth Code Grant flow. `firstImportCompletedAt` enforces one-time free import.

## F2 Poshmark + Mercari Import (2026-03-06)
- Install prompt at `install-prompts/F2-poshmark-mercari-import.md`
- F1 code HEAVILY hardcoded to eBay -- Stream 0 (genericize) MUST come before connector implementation
- Poshmark: Tier C, SESSION auth, internal mobile API, `canShare: true`, max 16 images
- Mercari: Tier B, OAUTH (same flow as eBay), limited API, max 12 images, single-quantity
- Key refactor: connectEbayAccount() -> generic connectPlatformAccount({ channel })
- Key refactor: import-service hardcoded getConnector('EBAY') -> getConnector(batch.channel)
- Connectors self-register via side-effect import barrel at connectors/index.ts
- 24 files total (16 new + 8 modified), ~73 new tests

## F3 Crosslist Outbound (2026-03-06)
- Install prompt at `install-prompts/F3-crosslist-outbound.md`
- OUTBOUND crosslisting: publish Twicely canonical listings TO external platforms (reverse of import)
- All 8 connector stubs exist (createListing/updateListing/delistListing return "Not implemented in F1")
- 4 new services: listing-transform.ts, publish-meter.ts, policy-validator.ts, publish-service.ts
- 1 new actions file: crosslister-publish.ts (publishListings, delistFromChannel, updateProjectionOverrides, getPublishAllowanceAction)
- 5 new UI components: crosslist-panel, publish-dialog, projection-table, projection-overrides-dialog, publish-meter
- Publish metering: DERIVED from crossJob COUNT where jobType='CREATE' for current calendar month (no separate counter)
- FREE=25/mo, LITE=200/mo, PRO=2000/mo, NONE=0 (read from platformSetting, never hardcoded)
- Calendar month reset (UTC 1st), not rolling 30-day
- Policy validator: ALLOW/DENY/REQUIRE_FIELDS/REQUIRE_CHANGES
- Transform engine: reverse of import normalizer (canonical -> TransformedListing per channel)
- Per-platform overrides: title/description/price in channelProjection.overridesJson
- Dual feature flag check: platformSetting `crosslister.*.crosslistEnabled` (primary) + featureFlag `connector:*` (secondary, skip if not seeded)
- Rollover publishes: deferred to F4
- Inline execution (no BullMQ); scheduler is F3.1
- Delists and syncs do NOT consume publishes (Lister Canonical Section 7.1)
- No fees on off-platform sales (Decision #31)
- No CASL changes needed (all subjects/abilities already exist)
- 25 files total (15 new + 10 modified), ~60 new tests, 4 streams: A -> (B+C parallel) -> D
- 3 open questions: feature flag convergence, listing form integration timing, connector API credentials seeding

## G1-A Buyer Onboarding Interest Picker (2026-03-09) [COMPLETE]
- Install prompt at `install-prompts/G1-A-buyer-onboarding-interest-picker.md`
- 60 new tests, baseline 3550. /auth/onboarding route. userInterest table with EXPLICIT source.
- Auth onboarding layout overrides max-w-md. 8 seed interest tags.

## G1-B Seller Onboarding Wizard (2026-03-09)
- Install prompt at `install-prompts/G1-B-seller-onboarding-wizard.md`
- TWO PATHS: (A) PERSONAL = one-click enableSellerAction, no wizard; (B) BUSINESS = 4-step wizard
- Hub Canonical Section 6: "NO multi-step onboarding wizard for personal sellers"
- Feature Lock-in Section 13: 4-step wizard = BUSINESS upgrade path
- Existing code: `ensureSellerProfile()` in seller-activate.ts, stripe-onboarding.ts actions
- Existing page: `/my/selling/onboarding/page.tsx` + `onboarding-client.tsx` = Stripe-only card (to be replaced)

## G1-C Import Onboarding Guide (2026-03-09)
- Install prompt at `install-prompts/G1-C-import-onboarding.md`
- ONBOARDING UX ONLY — no new infrastructure. Modifies 2 existing pages, adds 3 components + 1 query.
- Enhanced empty state on `/my/selling/crosslist` (3-step guide + key facts cards)
- Post-connection import guide banner (dismissible, localStorage persistence)
- Crosslister CTA card on selling overview page (`/my/selling`)
- getImportOnboardingState query: derives state from crosslisterAccount + importBatch + sellerProfile
- Zero schema changes, zero new actions. All data from existing tables.
- Key existing auth issue: crosslist/page.tsx uses auth.api.getSession not authorize() (F6-FIX defect)
- Crosslister sidebar gated by HAS_CROSSLISTER (listerTier !== NONE) — but the crosslist page itself is still accessible via direct URL even without a tier (redirect to onboarding only if !isSeller)
- Banner dismissal via localStorage key `twicely:import-guide-dismissed`
- Test count: ~20 new tests (10 query + 4 component + 6 banner)
- `businessInfo` table EXISTS in identity.ts. NO existing action to create/update businessInfo.
- NO `BusinessInfo` CASL subject exists -- auth via SellerProfile check (same userId)
- businessInfo.ein: Schema doc says "Encrypted at application layer" but stored as plain text. Flagged for owner decision.
- selling/layout.tsx allows non-sellers to create listing page (safety net: ensureSellerProfile called during listing creation)
- sellerProfile.storeSlug has unique constraint. Need reserved word blocklist (flagged for owner decision).
- 10 new files + 2 modified + 1 deleted. ~34 new tests expected. No new tables.
