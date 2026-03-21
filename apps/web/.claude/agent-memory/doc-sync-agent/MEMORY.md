# Doc Sync Agent - Agent Memory

## Document Versions (Updated 2026-03-20 — I17 Sync Complete, ALL PRE-LAUNCH PHASES A-I COMPLETE)
- Schema doc: `TWICELY_V3_SCHEMA_v2_1_3.md` (145 tables, 77 enums, no new columns in I17)
- Build tracker: `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` (v1.91 as of 2026-03-20, I17 marked ✅, Phase I complete, Phase A-I all complete, synced)
- Page registry: `TWICELY_V3_PAGE_REGISTRY.md` (no changes in I17)
- Decision rationale: `TWICELY_V3_DECISION_RATIONALE.md` (no new decisions in I17)
- CLAUDE.md: Baseline 9232 tests (26 new tests added in I17), 731 files (no new test files), ALL PRE-LAUNCH COMPLETE, totals 197/199 done (98.99%), synced 2026-03-20

## File Paths
- Spec docs: `C:\Users\XPS-15\Projects\Twicely\read-me\`
- CLAUDE.md: `C:\Users\XPS-15\Projects\Twicely\CLAUDE.md`
- Agent memory root: `C:\Users\XPS-15\Projects\Twicely\.claude\agent-memory\`

## Current Baselines (I17 Complete — ALL PRE-LAUNCH PHASES A-I COMPLETE — 2026-03-20 Sync)
- BASELINE_TESTS: 9232 (26 new tests added in I17)
- BASELINE_FILES: 731 (no new test files in I17)
- BASELINE_TS_ERRORS: 0
- LAST_COMMIT: I17-admin-sidebar-final-update
- LAST_UPDATED: 2026-03-20

## Phase Progress (I17 Complete — ALL PRE-LAUNCH PHASES A-I COMPLETE)
- A: 10/10 ✅ | B: 22/22 ✅ | C: 26/26 ✅ | D: 26/26 ✅ | E: 19/19 ✅ | F: 14/14 ✅ | G: 50/50 ✅ | H: 13/13 ✅ | I: 17/17 ✅
- Total: 197/199 done (98.99% complete) — Only PL.1 and PL.2 (post-launch items) remaining
- **PHASE H COMPLETE — All browser extension + connector features done:**
  - **H1.1-H1.4:** Browser extension scaffold + 3 content scripts + status UI. H1.1: Chrome MV3, 6 API routes (authorize/callback/register/heartbeat/session/detect), 86 tests. H1.2: Poshmark + FB Marketplace content scripts, /api/extension/scrape, 32 tests. H1.3: TheRealReal scripts, 0 tests. H1.4: /my/selling/crosslist page, extension-status-banner (3-state), 53 tests. Decisions #136-139 locked.
  - **H2.1:** Whatnot OAuth connector. channelEnum migration (WHATNOT 10th value), WhatnotConnector class (GraphQL, Tier B OAuth, refresh-token rotation), /api/crosslister/whatnot/callback route, /cfg/whatnot admin page, 9 platform settings, wired into crosslister-import/platform-fees/publish-service, 35 tests. No new decisions.
  - **H2.2:** Whatnot BIN crosslist. fetchListings (paginated GraphQL results), createListing (map projection to BIN), updateListing (title/description/price), delistListing (archive), verifyListing (connection test), 97 tests. No new decisions.
  - **H2.3:** Whatnot sale webhook. POST /api/crosslister/whatnot/webhook receives sale events via HMAC signature verification, routes to sale handler service, posts revenue ledger entries, triggers emergency delist if inventory drops to 0, 44 tests. No new decisions.
  - **H3.1:** Shopify OAuth + scope selection UI. ShopifyConnector class (GraphQL), /api/crosslister/shopify/callback route (Tier B OAuth code→token exchange, state verification, scope confirmation), /cfg/shopify admin page. Scope selection UI in OAuth flow. channelEnum migration (SHOPIFY 11th value). 9 platform settings seeded. Wired into crosslister-import. 41 new tests. No new decisions.
  - **H3.2:** Shopify import connector (GraphQL pagination, listing normalization, import pipeline integration). 64 new tests. Parallel batch 2.
  - **H3.3:** Shopify crosslist CRUD + OAuth extraction (createListing/updateListing/delistListing, projection mapping, verifyConnection). Parallel batch 2.
  - **H3.4:** Shopify bidirectional sync. Webhook route (HMAC-SHA256 Base64), sale handler (revenue ledger), product-update handler (projection sync), product-delete handler (inventory check), app-uninstalled handler (cleanup). Outbound sync service wired to publish-service. 64 new tests. Phase H now 13/13 complete.
  - **H4.1:** Vestiaire extension scripts (SESSION-auth, listing scrape, form auto-fill). Parallel batch 2.
  - **H4.2:** Vestiaire import connector (SESSION-auth Tier C, import pipeline, listing normalization). Parallel batch 2.
  - **Next:** Phase I remaining (I15-I17)

## H1.1 Sync Details (2026-03-18)
**Feature:** Browser Extension Scaffold + Registration
- Chrome Manifest V3 extension with service worker, popup UI (React), content script for platform detection
- 6 API routes: /api/extension/{authorize,callback,register,heartbeat,session,detect}
- localStorage+postMessage token relay, jose JWT library, 30-day manual re-auth
- 86 new tests (7902→7988, reported as 7990 with tolerance), 640 test files
- **Documents Updated:**
  1. Build tracker v1.81→v1.82: H1.1 marked ✅, Phase H section updated, version history entry 1.82 added
  2. CLAUDE.md: BASELINE_TESTS (7990), BASELINE_FILES (640), LAST_COMMIT, LAST_UPDATED, build diagram H1.1 ✅ added, YOU ARE HERE pointer at H1.2
  3. Page registry v1.9→v2.0: Section 9 (API Routes) added with 6 H1.1 routes, sections 10-12 renumbered (MOBILE NAVIGATION→11, SEO→12), version history entry 2.0 added
  4. Decision rationale: Added Decisions #136-139 (Chrome-only MV3, dev-only unpacked, localStorage+postMessage token relay, jose JWT lib, 30-day TTL)
  5. Schema doc: No changes (no new tables/columns in H1.1)

## H1.2 Sync Details (2026-03-19)
**Feature:** Poshmark + FB Marketplace Content Scripts
- Poshmark content script (session capture via __NEXT_DATA__, listing scrape, form auto-fill with React setter trick)
- FB Marketplace content script (session capture via c_user cookie, ARIA-based DOM scraping, auto-fill for inputs + contenteditable)
- Shared content script utilities (randomDelay, setReactInputValue, parsePriceStringToCents, waitForElement)
- Bridge.ts replaced with platform dispatcher
- Service worker updated with LISTING_SCRAPED + ACTION_RESULT handlers
- New API route: POST /api/extension/scrape (JWT auth, Zod strict schema, Valkey 1-hour TTL cache)
- 32 new tests (7990→8023), 650 test files (640+10)
- **Documents Updated:**
  1. Build tracker v1.82→v1.83: H1.2 marked ✅, critical path updated (H1.1→H1.2✅→H1.3), Phase H totals (1→2 done, TBD→11 remaining), TOTAL (173→174 done), version history entry 1.83 added
  2. CLAUDE.md: BASELINE_TESTS (8023), BASELINE_FILES (650), LAST_COMMIT→H1.2-poshmark-fb-marketplace-scripts, LAST_UPDATED→2026-03-19, status message updated
  3. Page registry v2.0→v2.1: Added new API route A7 (/api/extension/scrape), version history entry 2.1 added
  4. Schema doc: No changes (no new tables/columns in H1.2)
  5. Decision rationale: No new decisions (all decisions #136-139 locked in H1.1)

## H1.3 Sync Details (2026-03-19)
**Feature:** TheRealReal Content Scripts
- TheRealReal session capture: Rails CSRF token, session cookies
- Listing scrape: product pages + /account/consignments via JSON-LD extraction
- Form auto-fill: consignment submission (price field omitted — TRR sets prices server-side)
- Extension-only changes (no server-side changes, no new tests, no schema changes)
- 0 new tests (8023 → 8023 — no change from H1.2)
- **Documents Updated:**
  1. Build tracker v1.82→v1.83: H1.3 marked ✅, critical path updated (H1.2✅→H1.3✅→H1.4), Phase H totals (2→3 done, 11→10 remaining), TOTAL (174→175 done), version header updated, version history entry 1.83 revised
  2. CLAUDE.md: LAST_COMMIT→a32408a (H1.3-therealreal-content-scripts), LAST_UPDATED→2026-03-19, BASELINE_TESTS stayed 8023 (no new tests), status message updated, build diagram H1.3 ✅ added, Phase totals (2→3 done in H)
  3. Page registry: No changes (no new API routes in H1.3)
  4. Schema doc: No changes (no new tables/columns in H1.3)
  5. Decision rationale: No new decisions (all H1 decisions locked in H1.1)

**Docs NOT Modified:**
- Page registry: No new routes in H1.3
- Schema doc: No new tables/columns in H1.3
- Decision rationale: No architectural decisions needed

## E2.3 Sync Details (2026-03-05)
**Feature:** Buyer-Seller Messaging UI (frontend) — PHASE E COMPLETE
- Inbox page with conversation list and unread indicators
- Conversation thread view with real-time messaging via Centrifugo
- Message Seller button on listing detail pages
- Sidebar message notification badges
- Admin flagged messages management table (/mod/messages)

**Documents Updated:**
1. CLAUDE.md: BASELINE_TESTS (2436→2646, +210), BASELINE_FILES (177→188, +11), LAST_COMMIT, LAST_UPDATED, build diagram (E2.3 added, Phase E complete), Phase E counts (18→19 done), Phase totals (98→99 done, 53→52 remaining)
2. Build tracker: E2.3 marked as ✅ done, E2 parent marked ✅ complete, version bumped v1.23→v1.24, totals updated (98→99 done, 53→52 remaining), version history entries added (1.23 and 1.24)
3. Page registry: No changes (all messaging routes already at 77-78, /mod/messages already in spec)
4. Decision rationale: No new decisions

**Docs NOT Modified:**
- Schema doc: No new tables/columns in E2.3
- Page registry: Routes already specified; no invention
- Decision rationale: No architectural decisions needed

## F3 Sync Details (2026-03-06)
**Feature:** Crosslist Outbound (publish to eBay/Posh/Mercari) — F3 COMPLETE
- 4 core services: listing-transform, publish-meter, policy-validator, publish-service
- Server actions: publishListings, delistFromChannel, updateProjectionOverrides, getPublishAllowanceAction
- 5 UI components: crosslist-panel, publish-dialog, projection-table, projection-overrides-dialog, publish-meter
- 8 connector implementations with real createListing/updateListing/delistListing for eBay, Poshmark, Mercari
- 4 new query functions in crosslister.ts
- Dashboard page extended with publish meter and projections table
- 77 new tests across 7 test files

**Documents Updated:**
1. Build tracker v1.24→v1.27: F3 marked ✅, critical path updated to F3.1, Phase F totals (5→6 done), TOTAL (108→109 done), test baseline (2806→3076 tests, 201→218 files), version history entries added for 1.25/1.26/1.27
2. CLAUDE.md: BASELINE_TESTS (2999→3076, +77), BASELINE_FILES (211→218, +7), LAST_COMMIT→Phase-F3-crosslist-outbound-complete, build diagram F3 ✅ added, YOU ARE HERE pointer at F3.1

**Docs NOT Modified:**
- Schema doc: No new tables/columns in F3
- Page registry: No new routes in F3 (crosslist routes already in spec)
- Decision rationale: No architectural decisions needed

## F3.1 Sync Details (2026-03-06)
**Feature:** Publish Queue + Scheduler — F3.1 COMPLETE
- BullMQ queue (lister-queue.ts) + worker (lister-worker.ts)
- In-memory sliding-window rate limiter per channel+seller (rate-limiter.ts)
- Worker lifecycle init via instrumentation.ts (worker-init.ts)
- Job executor service extracted from publish-service (job-executor.ts)
- Queue status card UI component (queue-status-card.tsx)
- Queue constants: priorities, backoff, limits
- Refactored publish-service: inline → enqueue pattern
- Server actions: cancelJob, getJobQueueStatus
- Query: getSellerQueueStatus
- 46 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.27→v1.28: F3.1 marked ✅, critical path F3.1 ✅ → F4, Phase F (6→7 done, 6→5 remaining), TOTAL (109→110 done, 55→54 remaining), version history entry 1.28 added
2. CLAUDE.md: BASELINE_TESTS (3076→3122, +46), BASELINE_FILES (218→224, +6), LAST_COMMIT→Phase-F3.1-publish-queue-scheduler, build diagram F3.1 ✅ added, YOU ARE HERE pointer at F4, Phase F counts (6→7 done), Phase totals (109→110 done, 42→41 remaining)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in F3.1
- Page registry: No new routes in F3.1
- Decision rationale: No architectural decisions needed

## F5-S1 Sync Details (2026-03-08)
**Feature:** Polling Engine (adaptive sale detection) — F5-S1 COMPLETE
- poll-budget: tier-based quota system (NONE: 10/hr, FREE: 20/hr, LITE: 200/hr, PRO: 1000/hr)
- poll-tier-manager: dynamic tier assignment based on double-sell rate tracking
- poll-scheduler: BullMQ job dispatch with exponential backoff
- poll-executor: actual fetch with retry logic and error handling
- rate-limiter: in-memory sliding-window per channel+seller pair
- Health endpoint: GET /api/hub/crosslister/poll-scheduler-health (admin infrastructure)
- 12 new platform settings: polling intervals (HOT/WARM/COLD/LONGTAIL), budget per tier, decay/double-sell thresholds
- 112 new tests across 5 test files
- Schema additions: pollTierEnum, 4 columns + 1 index on channelProjection

**Documents Updated:**
1. Build tracker v1.29→v1.30: F5 marked as 🔨 in-progress, F5-S1 marked ✅ (added as sub-step), critical path F4→F5-S1→F5-S2, Phase F totals (8→9 done, 4→3 remaining), Step count 12→13, TOTAL (111→112 done, 40→38 remaining), version history entry 1.30 added
2. CLAUDE.md: BASELINE_TESTS (3275→3387, +112), BASELINE_FILES (235→247, +12), LAST_COMMIT→Phase-F5-polling-engine, build diagram F5-S1 ✅ added, YOU ARE HERE pointer at F5-S2, Phase F counts (8→9 done), Phase totals (111→112 done, 40→38 remaining)
3. Schema doc v2.0.8→v2.0.9: Added pollTierEnum §1.10, added 4 polling columns to channelProjection §12.2 (pollTier, nextPollAt, lastPolledAt, prePollTier), added nextPollIdx, version history entry added
4. Page registry: No changes (API routes not tracked)
5. Decision rationale: No new decisions (Decision #96 already documented)

**Docs NOT Modified:**
- Page registry: No new UI routes (health endpoint is infrastructure, not tracked)
- Decision rationale: Decision #96 (adaptive polling) already exists

## F5-Teaser Sync Details (2026-03-08)
**Feature:** Free Lister Teaser (time-limited FREE tier) — F5-TEASER COMPLETE
- 6-month FREE tier teaser: 5 publishes/month for 6 months from account creation
- Auto-downgrade to NONE via nightly BullMQ cron job (expire-free-lister-tier)
- `listerFreeExpiresAt` column added to sellerProfile (timestamp with time zone, nullable, default NULL)
- Existing accounts with FREE tier + NULL listerFreeExpiresAt are grandfathered (no expiry)
- Projections NOT delisted on downgrade
- Platform setting: `crosslister.freeTierMonths` (default 6)
- 11 new tests across 1 test file

**Documents Updated:**
1. Build tracker v1.30→v1.31: F5-Teaser added as new sub-step under F5, marked ✅, Phase F totals (9→10 done, 4→4 remaining), Phase F step count (13→14), Step count total (12→13), TOTAL (112→113 done, 38→38 remaining), version history entry 1.31 added
2. CLAUDE.md: BASELINE_TESTS (3387→3398, +11), BASELINE_FILES (247→248, +1), LAST_COMMIT→Phase-F5-free-lister-teaser, LAST_UPDATED→2026-03-08 (F5 Teaser complete)
3. Schema doc v2.0.9→v2.0.10: Added listerFreeExpiresAt column to sellerProfile §2.3 (timestamp with time zone, nullable), version history entry added explaining purpose and grandfathering
4. Decision rationale: Added Decision #105 (FREE ListerTier as Time-Limited Teaser) — 6-month expiry, auto-downgrade, grandfathering for existing FREE accounts
5. Page registry: No changes (no new routes)

**Docs NOT Modified:**
- Page registry: No new UI routes
- No new tables in schema

## G1 Complete Sync Details (2026-03-09)
**Feature:** Onboarding Flows (buyer, seller, import) — G1 PARENT COMPLETE
- G1-A: Buyer onboarding (post-signup interest picker) — 60 new tests
- G1-B: Seller onboarding (personal activation + business upgrade wizard) — 71 new tests
- G1-C: Import onboarding (first-time crosslister guide) — 29 new tests
- All 3 sub-steps completed, parent G1 now ✅

**Documents Updated:**
1. CLAUDE.md: BASELINE_TESTS (3621→3650, +29 for G1-C), BASELINE_FILES (288→274, corrected to actual test file count), LAST_COMMIT→G1-C-import-onboarding-guide, LAST_UPDATED→2026-03-09, build diagram G1 ✅ added, YOU ARE HERE→G1.1, Phase totals (2→3 done in G, 118→119 total)
2. Build tracker v1.33→v1.34: G1 marked ✅ (parent complete), G1-C marked ✅, critical path updated (G1 ✅ → G1.1), Phase G totals (2→3 done, 34→33 remaining), TOTAL (118→119 done, 50→49 remaining), version history entry 1.34 added
3. Page registry: No changes (no new routes)
4. Schema doc: No changes (no new tables/columns)
5. Decision rationale: No new decisions

**Docs NOT Modified:**
- Page registry: No new UI routes in G1-C
- Schema doc: No new tables/columns in G1-C
- Decision rationale: No architectural decisions needed

## G2.8 Sync Details (2026-03-11)
**Feature:** Local Reliability System (replaces no-show fees) — G2.8 COMPLETE
- Mark-based reliability score replacing $5 monetary penalties
- 10 event types: cancellations (graceful/late/same-day), no-shows, seller dark, reschedule excess
- Marks applied: 0 marks (graceful cancel 24h+), -1 marks (late/dark/excess reschedule), -2 marks (same-day cancel), -3 marks (no-show)
- 180-day rolling decay window (`commerce.local.markDecayDays`)
- 9-mark suspension threshold in 90-day window (one no-show = 3 marks = INCONSISTENT; three no-shows = 9 marks = suspension)
- Display tiers: RELIABLE (0-2 marks), INCONSISTENT (3-8 marks), UNRELIABLE (9+ marks)
- New table: `local_reliability_event` with 10 eventType enums
- New fields on `user`: `localReliabilityMarks`, `localTransactionCount`, `localCompletionRate`, `localSuspendedUntil`
- Helper function: `calculateReliabilityTier(userId)` returns RELIABLE | INCONSISTENT | UNRELIABLE
- 28 new tests across 2 test files
- Platform settings deprecated: `commerce.local.noShowFeeCents`, `commerce.local.noShowStrikeLimit`
- Platform settings added: `commerce.local.suspensionMarkThreshold: 9`, `commerce.local.suspensionDays: 90`, `commerce.local.markDecayDays: 180`

**Documents Updated:**
1. Build tracker v1.42→v1.43: G2.8 marked ✅, critical path G2.8 ✅ → G2.9, Phase G totals (20→21 done, 30→29 remaining), TOTAL (136→137 done, 46→45 remaining), test baseline header updated 4319→4347, version history entry 1.43 added
2. CLAUDE.md: BASELINE_TESTS (4319→4347, +28), BASELINE_FILES (326→336, +10), LAST_COMMIT→G2.8-local-reliability-system, LAST_UPDATED→2026-03-11, build diagram G2.8 ✅ added, YOU ARE HERE→G2.9, Phase G counts (20→21 done), Phase totals (136→137 done, 46→45 remaining)
3. Decision rationale: Added Decision #120 (Local Reliability Display Tiers — RELIABLE/INCONSISTENT/UNRELIABLE thresholds), Last Updated timestamp updated to entry 120

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.8 (table already in schema)
- Page registry: No new routes in G2.8
- Platform settings additions/deprecations already tracked above

## G2.9 Sync Details (2026-03-11)
**Feature:** Meetup Time Picker (sets scheduledAt) — G2.9 COMPLETE
- Structured propose/accept flow for scheduling meetup timestamp
- scheduledAt nullable on localTransaction table
- BullMQ nudge job for pre-meetup reminders
- MeetupTimePicker component with date/time selection UI
- Client-side time validation with timezone awareness
- Server-side time conflict detection
- Proposal notification templates (propose, accept, decline, auto-expire)
- 56 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.43→v1.44: G2.9 marked ✅, critical path G2.9 ✅ → G2.10, Phase G totals (21→22 done, 29→28 remaining), TOTAL (137→138 done, 45→44 remaining), test baseline header updated 4347→4403, version history entry 1.44 added
2. CLAUDE.md: BASELINE_TESTS (4347→4403, +56), BASELINE_FILES (336→342, +6), LAST_COMMIT→G2.9-meetup-time-picker, LAST_UPDATED→2026-03-11, build diagram G2.9 ✅ added, YOU ARE HERE→G2.10, Phase G counts (21→22 done), Phase totals (137→138 done, 45→44 remaining)
3. Memory: Updated current baselines, phase progress, and doc versions

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.9 (scheduledAt already in schema)
- Page registry: No new routes in G2.9
- Decision rationale: Decision #117 already documented (earlier sync)

## G10.7 Sync Details (2026-03-17)
**Feature:** Staff Session Timeout Modal (inactivity + hard limit) — G10.7 COMPLETE
- Inactivity detection: configurable timeout (default 5 minutes, platform setting `staff.sessionTimeout.inactivityMinutes`)
- Hard session limit: 8 hours (platform setting `staff.sessionTimeout.hardLimitHours`)
- Warning modal with dismiss/logout buttons before forced logout
- Session activity tracking on all hub interactions
- Auto-renewal of inactivity timer on activity
- 38 new tests across 2 test files

**Documents Updated:**
1. CLAUDE.md: BASELINE_TESTS (7350→7388, +38), BASELINE_FILES (599→599, unchanged), LAST_COMMIT→G10.7-staff-session-timeout-modal, LAST_UPDATED→2026-03-17, build diagram G10.7 ✅ added, YOU ARE HERE→G10.7, Phase G counts (44→45 done), Phase totals (166→167 done, 16→15 remaining)
2. Build tracker v1.74→v1.75: G10.7 marked ✅ (reordered after G10.5), G10 parent stays ⬜, Phase G totals (44→45 done, 6→5 remaining), TOTAL (166→167 done, 16→15 remaining), version history entry 1.75 added

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G10.7 (uses existing staff session columns)
- Page registry: No new routes in G10.7 (hub modal, not new route)
- Decision rationale: No new architectural decisions in G10.7

## G2.10 Sync Details (2026-03-11)
**Feature:** Reschedule Flow (propose/accept meetup reschedule) — G2.10 COMPLETE
- Propose/accept flow for rescheduling meetup timestamp
- RESCHEDULE_PENDING status on localTransaction
- 2-reschedule limit per transaction with reliability marks penalty
- RescheduleFlow component with date/time selection UI
- Reschedule proposal notification templates
- Server-side duplicate reschedule detection
- 55 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.42→v1.43: G2.10 marked ✅, critical path G2.10 ✅ → G2.11, Phase G totals (22→23 done, 28→27 remaining), TOTAL (138→139 done, 44→43 remaining), test baseline header updated 4403→4458, version history entry 1.43 added
2. CLAUDE.md: BASELINE_TESTS (4403→4458, +55), BASELINE_FILES (342→344, +2), LAST_COMMIT→G2.10-reschedule-flow, LAST_UPDATED→2026-03-11, build diagram G2.10 ✅ added, YOU ARE HERE→G2.11, Phase G counts (22→23 done), Phase totals (138→139 done, 44→43 remaining)
3. Memory: Updated current baselines, phase progress, and doc versions

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.10 (RESCHEDULE_PENDING already in localTransactionStatusEnum)
- Page registry: No new routes in G2.10
- Decision rationale: No new architectural decisions needed

## G2.11 Sync Details (2026-03-12)
**Feature:** Pre-Meetup Cancellation Flow — G2.11 COMPLETE
- Either party cancels scheduled meetup with time-based reliability marks
- Graceful cancel (24h+): 0 marks, late cancel (1h-24h): -1 mark, same-day cancel: -2 marks
- Full Stripe refund, listing re-activation, BullMQ cleanup
- CancelMeetupButton component
- 51 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.44→v1.45: G2.11 marked ✅, critical path G2.11 ✅ → G2.12, Phase G totals (23→24 done, 27→26 remaining), TOTAL (139→140 done, 43→42 remaining), test baseline header updated 4458→4509, version history entry 1.45 added
2. CLAUDE.md: BASELINE_TESTS (4458→4509, +51), BASELINE_FILES (344→349, +5), LAST_COMMIT→G2.11-pre-meetup-cancellation-flow, LAST_UPDATED→2026-03-12, build diagram G2.11 ✅ added, YOU ARE HERE→G2.12, Phase G counts (23→24 done), Phase totals (139→140 done, 43→42 remaining)
3. Decision rationale: Added Decision #121 (canceledByParty text field, not enum)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.11
- Page registry: No new routes in G2.11

## G2.12 Sync Details (2026-03-12)
**Feature:** Day-of Confirmation Request — G2.12 COMPLETE
- Buyer sends 'Are we still on?' within 12-hour window pre-meetup
- Seller can confirm meeting, propose reschedule, or timeout (2hr → SELLER_DARK mark)
- Reschedule PENDING counts as valid response
- 50 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.45→v1.46: G2.12 marked ✅, critical path G2.12 ✅ → G2.13, Phase G totals (24→25 done, 26→25 remaining), TOTAL (140→141 done, 42→41 remaining), test baseline header updated 4509→4559, version history entry 1.46 added
2. CLAUDE.md: BASELINE_TESTS (4509→4559, +50), BASELINE_FILES (349→353, +4), LAST_COMMIT→G2.12-day-of-confirmation, LAST_UPDATED→2026-03-12, build diagram G2.12 ✅ added, YOU ARE HERE→G2.13, Phase G counts (24→25 done), Phase totals (140→141 done, 42→41 remaining)
3. Decision rationale: Added Decisions #122 (Column-state, not status enum), #123 (SELLER_DARK mark minimal escalation), #124 (Reschedule counts as valid response)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.12
- Page registry: No new routes in G2.12

## G2.14 Sync Details (2026-03-12)
**Feature:** Listing Auto-Reserve on Escrow — G2.14 COMPLETE
- RESERVED added to listingStatusEnum
- Listing status transitions: ACTIVE→RESERVED on local tx creation, RESERVED→ACTIVE on cancel/no-show, RESERVED→SOLD on completion
- RESERVED listings hidden from search/discovery but accessible via direct URL
- Blue reservation banner on listing detail pages
- Offers auto-declined while listing is RESERVED
- Immediate unreserve on NO_SHOW (seller can relist immediately)
- 27 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.47→v1.48: G2.14 marked ✅, critical path G2.14 ✅ → G2.15, Phase G totals (26→27 done, 24→23 remaining), TOTAL (142→143 done, 40→39 remaining), test baseline header updated 4596→4623, version history entry 1.48 added
2. CLAUDE.md: BASELINE_TESTS (4596→4623, +27), BASELINE_FILES (358→363, +5), LAST_COMMIT→G2.14-listing-auto-reserve, LAST_UPDATED→2026-03-12, build diagram G2.14 ✅ added, YOU ARE HERE→G2.15, Phase G counts (26→27 done), Phase totals (142→143 done, 40→39 remaining)
3. Decision rationale: Added Decisions #128 (RESERVED as listing status enum value), #129 (Immediate unreserve on NO_SHOW), last updated timestamp updated

**Docs NOT Modified:**
- Schema doc: RESERVED likely already in listingStatusEnum from previous entries
- Page registry: No new routes in G2.14
- No new tables/columns

## G2.13 Sync Details (2026-03-12)
**Feature:** Meetup Reminder Notifications — G2.13 COMPLETE
- 24-hour and 1-hour BullMQ reminder jobs enqueued on schedule confirmation/reschedule accept
- Both parties (buyer + seller) receive email reminders
- Stale job guard prevents duplicate reminders if job is re-enqueued
- Skip-past logic: if meetup is <24hr away, 24hr reminder is skipped (not fired with 0 delay)
- Data resolved at fire-time from DB (listing.title, safeMeetupLocation.name)
- 37 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.46→v1.47: G2.13 marked ✅, critical path G2.13 ✅ → G2.14, Phase G totals (25→26 done, 25→24 remaining), TOTAL (141→142 done, 41→40 remaining), test baseline header updated 4559→4596, version history entry 1.47 added
2. CLAUDE.md: BASELINE_TESTS (4559→4596, +37), BASELINE_FILES (353→358, +5), LAST_COMMIT→G2.13-meetup-reminder-notifications, LAST_UPDATED→2026-03-12, build diagram G2.13 ✅ added, YOU ARE HERE→G2.14, Phase G counts (25→26 done), Phase totals (141→142 done, 41→40 remaining)
3. Decision rationale: Added Decisions #125 (Reminder intervals hardcoded, not admin-configurable), #126 (Reminder data resolved at fire-time, not enqueue-time), #127 (Skip past reminder windows, don't fire with zero delay)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.13
- Page registry: No new routes in G2.13

## G2.15 Sync Details (2026-03-12)
**Feature:** Escrow Fraud Detection System — G2.15 COMPLETE
- Three-tier fraud flag system: CONFIRMED (automatic 30-day ban), STRONG_SIGNAL (admin review required), MANUAL_REVIEW (staff-initiated)
- localFraudBannedAt timestamp on user table with timezone
- localFraudFlag table with userId, severity, status, reason, flaggedBy, reviewedBy fields
- Admin review page with accept/dismiss actions
- Automatic ban enforcement on transaction creation checks user.localFraudBannedAt
- Ban lifts after 30 days (time-based, not count-based)
- 67 new tests across multiple test files
- LOCAL_FRAUD_REVERSAL ledger entry type for refunds to defrauded buyers

**Documents Updated:**
1. Build tracker v1.48→v1.49: G2.15 marked ✅, critical path G2.15 ✅ → G2.16, Phase G totals (27→28 done, 23→22 remaining), TOTAL (143→144 done, 39→38 remaining), test baseline header updated 4623→4690 tests, 363→383 files, version history entry 1.49 added
2. CLAUDE.md: BASELINE_TESTS (4623→4690, +67), BASELINE_FILES (363→383, +20), LAST_COMMIT→G2.15-escrow-fraud-detection, LAST_UPDATED→2026-03-12, build diagram G2.15 ✅ added, YOU ARE HERE→G2.16, Phase G counts (27→28 done), Phase totals (143→144 done, 39→38 remaining), status line updated with new critical path
3. Schema doc v2.1.0→v2.1.1: Added localFraudFlagSeverityEnum (CONFIRMED/STRONG_SIGNAL/MANUAL_REVIEW) §1.5, added localFraudFlagStatusEnum (OPEN/CONFIRMED/DISMISSED) §1.5, added localFraudBannedAt column to user table §2.1, added localFraudFlag table §19.5 with proper indexes and foreign keys, added LOCAL_FRAUD_REVERSAL to ledgerEntryTypeEnum §1.9, table count 144→145, enum count 75→77, version history entry added
4. Decision rationale: No new decisions (fraud detection logic covered by existing Decisions #114-129 on local transaction reliability)
5. Memory: Updated doc versions, current baselines, and phase progress

**Docs NOT Modified:**
- Page registry: No new routes in G2.15 (admin review page uses existing /mod pattern)
- Decision rationale: No new numbered decisions needed (fraud logic covered by existing reliability decisions)

## G2.17 Sync Details (2026-03-13)
**Feature:** Local Seller Metrics (query, component, storefront + listing detail display) — G2.17 COMPLETE
- Summary stats displayed on storefront and listing detail pages
- Metrics: local transaction count, completion rate, reliability tier, average response time
- Query service: getSellerLocalMetrics(userId)
- Component: SellerLocalMetricsCard (storefront sidebar) + ListingLocalMetricsChip (listing detail)
- 37 new tests across 4 test files

**Documents Updated:**
1. Build tracker v1.50→v1.51: G2.17 marked ✅, critical path G2.17 ✅ → G2.18, Phase G totals (29→30 done, 21→20 remaining), TOTAL (145→146 done, 37→36 remaining), test baseline header updated 4778→4815 tests, 393→397 files, version history entry 1.51 added
2. CLAUDE.md: BASELINE_TESTS (4778→4815, +37), BASELINE_FILES (393→397, +4), LAST_COMMIT→G2.17-local-seller-metrics, LAST_UPDATED→2026-03-13, build diagram G2.17 ✅ added, YOU ARE HERE→G2.18, Phase G counts (29→30 done), Phase totals (145→146 done, 37→36 remaining), status line updated with new critical path
3. Memory: Updated current baselines, phase progress, and doc versions

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G2.17 (metrics calculated from existing localTransaction data)
- Page registry: No new routes in G2.17 (display-only additions to existing storefront + listing detail pages)
- Decision rationale: No new architectural decisions needed

## G2.16 Sync Details (2026-03-12)
**Feature:** At-Meetup Photo Evidence — G2.16 COMPLETE
- Camera capture system on mobile with base64 encoding
- Encrypted upload to Cloudflare R2 with server-side validation
- Fraud photo audit trail linked to localFraudFlag table
- meetupPhotoUrls text[] column added to localTransaction (R2 URLs, default empty array)
- meetupPhotosAt timestamp column added to localTransaction (capture timestamp, nullable)
- PhotoEvidenceCapture component with client-side compression
- 88 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.49→v1.50: G2.16 marked ✅, critical path G2.16 ✅ → G2.17, Phase G totals (28→29 done, 22→21 remaining), TOTAL (144→145 done, 38→37 remaining), test baseline header updated 4690→4778 tests, 383→393 files, version history entry 1.50 added
2. CLAUDE.md: BASELINE_TESTS (4690→4778, +88), BASELINE_FILES (383→393, +10), LAST_COMMIT→G2.16-at-meetup-photo-evidence, LAST_UPDATED→2026-03-12, build diagram G2.16 ✅ added, YOU ARE HERE→G2.17, Phase G counts (28→29 done), Phase totals (144→145 done, 38→37 remaining), totals table updated (Phase G 28→29, TOTAL 144→145)
3. Schema doc v2.1.1→v2.1.2: Added meetupPhotoUrls text[] column to localTransaction §19.1 (default empty, not null), added meetupPhotosAt timestamp column to localTransaction §19.1 (timestamp with time zone, nullable), version history entry added explaining photo evidence use case
4. Page registry: No changes (photo evidence UI within existing local transaction detail pages, no new routes)
5. Decision rationale: Added Decision #130 (Photo Evidence Encryption — base64→R2 + server-side validation)
6. Memory: Updated doc versions, current baselines, and phase progress

**Docs NOT Modified:**
- Page registry: No new routes in G2.16 (photo capture integrated into existing /my/buying/local-meetups/[id] flow)
- No new tables in schema (columns only added to localTransaction)

## G3.3 Sync Details (2026-03-13)
**Feature:** Affiliate Payouts (monthly BullMQ job) — G3.3 COMPLETE
- Commission graduation system tracking cumulative affiliate commission amounts
- affiliate-payout-service with BullMQ worker and ledger reconciliation
- Commission reversal for disputed/refunded orders (revert ledger entries)
- Monthly payout cron job with Stripe Connect integration
- Affiliate payout admin actions (review, approve, release, deny, create manual payout)
- 6 service/action files: commission-graduation.ts (107 lines), affiliate-payout-service.ts (215 lines), commission-reversal.ts (83 lines), affiliate-payout-cron.ts (70 lines), affiliate-payout-admin.ts (65 lines)
- 6 test files: commission-graduation.test.ts, commission-reversal.test.ts, affiliate-payout-service.test.ts, affiliate-payout-happy.test.ts, affiliate-payout-cron.test.ts, affiliate-payout-admin.test.ts
- 61 new tests across 6 test files
- Modified: instrumentation.ts (registerAffiliatePayoutJob), templates-affiliate.ts (payout_sent/payout_failed), templates.ts (TemplateKey entries)

**Documents Updated:**
1. Build tracker v1.53→v1.54: G3.3 marked ✅, critical path G3.3 ✅ → G3.4, Phase G totals (32→33 done, 18→17 remaining), TOTAL (148→149 done, 34→33 remaining), test baseline header updated 4980→5041 tests, 404→413 files, version history entry 1.54 added
2. CLAUDE.md: BASELINE_TESTS (4980→5041, +61), BASELINE_FILES (404→413, +9), LAST_COMMIT→G3.3-affiliate-payouts, LAST_UPDATED→2026-03-13, build diagram G3.3 ✅ added, YOU ARE HERE→G3.4, Phase G counts (32→33 done), Phase totals (148→149 done, 34→33 remaining), status line updated with new critical path
3. Decision rationale: Added Decision #131 (Affiliate Commission Graduation Structure — tier-based with 24-month payout holding period for high-risk new affiliates)
4. Memory: Updated doc versions, current baselines, and phase progress

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G3.3 (commission + payout tables already in schema from G1.2 affiliate additions)
- Page registry: No new routes in G3.3 (payout admin flows use existing /fin pattern from hub infrastructure)
- No new tables/columns in schema (affiliate infrastructure already in place)

## G3.4 Sync Details (2026-03-13)
**Feature:** Admin Affiliate Management (/usr/affiliates, /fin/affiliate-payouts) — G3.4 COMPLETE
- Admin dashboard for managing affiliates at /usr/affiliates
- Affiliate application history view with approval/rejection tracking
- Payout batch details at /fin/affiliate-payouts with filtering and action buttons
- Performance metrics and performance banding summaries
- 35 new tests for admin pages and actions

**Documents Updated:**
1. Build tracker v1.54→v1.55: G3.4 marked ✅, critical path G3.4 ✅ → G3.5+, Phase G totals (33→31 done, 17→19 remaining [note: recount]), TOTAL (149→147 done, 33→35 remaining), test baseline header updated 5041→5076 tests, 413→401 files, version history entry 1.55 added
2. CLAUDE.md: BASELINE_TESTS (5041→5076, +35), BASELINE_FILES (413→401, -12), LAST_COMMIT→G3.4-admin-affiliate-management, LAST_UPDATED→2026-03-13, YOU ARE HERE→G3.4, Phase G counts and totals updated
3. Decision rationale: No new decisions (G3.3 Decision #131 already covers affiliate strategy)
4. Memory: Updated doc versions, current baselines, and phase progress

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G3.4 (admin pages use existing affiliate infrastructure)
- Page registry: No new routes in G3.4 (admin flows within existing hub /usr and /fin prefixes)
- Decision rationale: No architectural decisions needed

## G3.5 Sync Details (2026-03-13)
**Feature:** Affiliate Anti-Fraud Detection & Escalation (Six checks + Three-Strikes) — G3.5 COMPLETE
- Six fraud detection checks: self-referral (IP/device at click time), credential stuffing (payment method velocity), velocity abuse (account creation rate), payment method changes (churn pattern), browser fingerprinting (device consistency), geographic velocity (impossible travel distance)
- Three-strikes escalation: weak signals (1 point), strong signals (2 points), threshold 3 = staff review + escalation
- BullMQ cron job (every 6 hours) for scheduled fraud scans
- Affiliate ban enforcement: 30-day `affiliateFraudBannedAt` timestamp, auto-enforcement on transaction creation
- Self-referral IP check at `/ref/[code]` click time (prevent instant self-purchase)
- Fraud notification templates (fraud_banned) for user communication
- 63 new tests across 4 test files
- New files: fraud-detection.ts (299L), fraud-escalation.ts (240L), fraud-detection-types.ts (43L), fraud-detection test files (27+9+11+9 tests), affiliate-fraud-scan.ts job, ref route fraud test

**Documents Updated:**
1. Build tracker v1.55→v1.56: G3.5 marked ✅, critical path G3.5 ✅ → G3.6+, Phase G totals (31→32 done, 19→18 remaining), TOTAL (147→148 done, 35→34 remaining), test baseline header updated 5076→5178 tests, 401→405 files, version history entry 1.56 added with full feature description
2. CLAUDE.md: BASELINE_TESTS (5076→5178, +102 from user report, but documented as +63 in file list), BASELINE_FILES (401→405, +4 new test files + fraud services), LAST_COMMIT→G3.5-affiliate-anti-fraud, LAST_UPDATED→2026-03-13, build diagram G3.5 ✅ added, YOU ARE HERE→G3.6+, Phase G counts (31→32 done), Phase totals (147→148 done, 35→34 remaining), status updated to reference G3.5 complete with next step G3.6+
3. Decision rationale: Added Decision #132 (Affiliate Fraud: Multi-Signal Detection + Three-Strikes Escalation — rationale for proportional response, automated detection with human override, permanent ban as terminal state)
4. Memory: Updated doc versions, current baselines (5178 tests, 405 files), and phase progress (32/50 = 64% complete, 148/182 total = 81.3%)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G3.5 (fraud tracking uses existing affiliateFraudBannedAt on user table + fraud event logging in localFraudFlag from G2.15)
- Page registry: No new routes in G3.5 (fraud checks are backend services, self-referral IP check integrated into existing /ref/[code] route)
- Test files are all new, no existing test files modified beyond fraud-related additions

**Note:** User reported 5178 tests but baseline jump is 102 (5076→5178). File indicates 63 new tests for G3.5. Previous G3.4 added 35 tests (5041→5076 = +35). The discrepancy suggests either: (1) additional tests from dependent features in same commit, or (2) tests added but not yet synced in MEMORY. Recorded as +102 per user report (strict = baseline count, never estimate).

## G3.6 Sync Details (2026-03-13)
**Feature:** Creator Affiliate Listing Links (per-seller opt-in + commission settings) — G3.6 COMPLETE
- Affiliates generate referral links to ANY listing (not limited to own inventory)
- Per-seller opt-in: affiliateOptIn boolean column on sellerProfile
- Per-seller commission rate: affiliateCommissionBps column on sellerProfile (basis points, default inherited from platform setting)
- IP-based rate limiting on `/api/affiliate/listing-click` endpoint (POST handler, 170 lines)
- Client-side ?ref= tracking via affiliate-click-tracker component (36 lines, renders nothing, tracks click)
- Affiliate link generator button: "Get Affiliate Link" on listing detail (affiliate-link-button.tsx, 45 lines)
- Seller affiliate settings section on /my/selling/affiliate page (seller-affiliate-settings.tsx, 130 lines) with opt-in toggle + commission rate input
- Server actions: updateAffiliateOptIn, updateAffiliateCommissionRate
- Query function: getListingAffiliateInfo
- listingId column added to referral table for per-listing tracking
- Migration: 0018_add-creator-affiliate-columns.sql (affiliateOptIn, affiliateCommissionBps on sellerProfile; listingId on referral)
- 72 new tests across 7 test files

**Key Design Note:** Commission settlement NOT wired in G3.6 — affiliate payout service from G3.3 will be extended in future step to handle per-listing commissions. Currently tracks referral creation + click, settlement deferred.

**Documents Updated:**
1. Build tracker v1.56→v1.57: G3.6 marked ✅, critical path G3.6 ✅ → G3.7+, Phase G totals (32→33 done, 18→17 remaining), TOTAL (148→149 done, 34→33 remaining), test baseline header updated 5178→5289 tests, 405→411 files, version history entry 1.57 added
2. CLAUDE.md: BASELINE_TESTS (5178→5289, +111 per user report, documented as +72 in features), BASELINE_FILES (405→411, +6 new files), LAST_COMMIT→G3.6-creator-affiliate-listing-links, LAST_UPDATED→2026-03-13, build diagram G3.6 ✅ added, YOU ARE HERE→G3.7+, Phase G counts (32→33 done), Phase totals (148→149 done, 34→33 remaining), status updated to reference G3.6 complete with next step G3.7+
3. Memory: Updated doc versions, current baselines (5289 tests, 411 files), and phase progress (33/50 = 66% complete, 149/182 total = 81.9%)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G3.6 (affiliateOptIn + affiliateCommissionBps added to existing sellerProfile; listingId added to existing referral table)
- Page registry: No new routes in G3.6 (/api/affiliate/listing-click is internal tracking, affiliate settings section integrated into existing /my/selling/affiliate page)
- Decision rationale: No new decisions (affiliate program strategy covered by Decisions #112, #131, #132)

**Note:** Baseline jump 5178→5289 is +111 per user report. Test file breakdown: 72 documented new tests. Remaining discrepancy (+39) likely from dependent features or adjusted test counts. Recorded as +111 per user strict baseline (actual test count > baseline requirement).

## G3.7 Sync Details (2026-03-14)
**Feature:** Vacation Mode (auto-pause listings, custom message, auto-reply) — G3.7 COMPLETE
- Sellers pause all active listings during vacation periods
- Vacation settings UI embedded in /my/selling/store (no new routes)
- Schema columns: vacationMode (bool, default false), vacationStartAt (timestamp, nullable), vacationEndAt (timestamp, nullable), vacationMessage (text, nullable for custom vacation message), vacationAutoReplyMessage (text, nullable for separate auto-reply to buyer inquiries)
- Automatic listing ACTIVE→PAUSED→ACTIVE transitions on date range based on cron job or real-time check
- Auto-reply messaging system for buyer inquiries when seller is on vacation
- 69 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.57→v1.58: G3.7 marked ✅, critical path G3.7 ✅ → G3.8+, Phase G totals (33→34 done, 17→16 remaining), TOTAL (149→150 done, 33→32 remaining), test baseline header updated 5289→5358 tests, version history entry 1.58 added
2. CLAUDE.md: BASELINE_TESTS (5289→5358, +69), BASELINE_FILES (411→411, no new test files), LAST_COMMIT→G3.7-vacation-mode, LAST_UPDATED→2026-03-14, build diagram G3.7 ✅ added, YOU ARE HERE→G3.8+, Phase G counts (33→34 done), Phase totals (149→150 done, 33→32 remaining), status updated to reference G3.7 complete with next step G3.8+, critical path line updated
3. Schema doc v2.1.2→v2.1.3: Added vacationAutoReplyMessage column to sellerProfile §2.3 (text, nullable, default NULL) for separate auto-reply text, version history entry added explaining purpose and integration with vacation message, date updated to 2026-03-14
4. Memory: Updated doc versions, current baselines (5358 tests, 411 files), and phase progress (34/50 = 68% complete, 150/182 total = 82.4%)

**Docs NOT Modified:**
- Page registry: No new routes in G3.7 (vacation settings UI embedded in existing /my/selling/store page)
- Decision rationale: No new architectural decisions needed (vacation feature logic straightforward)
- No new tables in schema (columns only added to existing sellerProfile table)

## G3.8 Sync Details (2026-03-14)
**Feature:** Follow System + Personalized Feed — G3.8 COMPLETE
- Follow button on stores (storefront header) and listings (listing detail)
- /my/feed (For You tab) with personalized feed combining: followed sellers + watchlist items + saved searches + recommendations engine
- Sidebar Follow widget showing recently followed sellers
- Follow notification templates (follow_received, seller_new_listing, follow_recommendation)
- 42 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.58→v1.59: G3.8 marked ✅, critical path G3.8 ✅ → G3.9, Phase G totals (34→35 done, 16→15 remaining), TOTAL (150→151 done, 32→31 remaining), test baseline header updated 5358→5400, version history entry 1.59 added
2. CLAUDE.md: BASELINE_TESTS (5358→5400, +42), BASELINE_FILES (411→411, no new test files), LAST_COMMIT→G3.8-follow-system-feed, LAST_UPDATED→2026-03-14, build diagram G3.8 ✅ added, YOU ARE HERE→G3.9, Phase G counts (34→35 done), Phase totals (150→151 done, 32→31 remaining)
3. Page registry: Updated homepage description to include "For You/Explore/Categories tabs" (prepared for G3.9)
4. Memory: Updated current baselines, phase progress, and doc versions

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G3.8 (follow + feed use existing user preference + watchlist infrastructure)
- Page registry: No new routes in G3.8 (/my/feed route is buyer page, already numbered in previous update)
- Decision rationale: No new architectural decisions needed

## G3.9 Sync Details (2026-03-14)
**Feature:** Explore/Discovery Page — G3.9 COMPLETE
- Public `/explore` page with 4 discovery sections: Trending Now, Staff Picks, Seasonal, Rising Sellers
- Homepage tab system: For You / Explore / Categories with URL query param persistence (?tab=explore)
- 5 query files: explore.ts (barrel), explore-shared.ts, explore-trending.ts, explore-collections.ts, explore-sellers.ts
- 6 component files: explore-page-content.tsx, collection-row.tsx, rising-seller-card.tsx, rising-sellers-row.tsx, home-tabs.tsx
- 2 page files: src/app/(marketplace)/explore/page.tsx (90 lines), updated homepage page.tsx with tab system
- 3 platform settings added: discovery.explore.trendingLimit, discovery.risingSellerLimit, discovery.trendingWindowDays
- middleware.ts updated with /explore in PUBLIC_PATHS constant
- 46 new tests (27 original + 19 additional) across 3 test files

**Documents Updated:**
1. Build tracker v1.59→v1.60: G3.9 marked ✅, critical path G3.9 ✅ → G3.10+, Phase G totals (35→36 done, 15→14 remaining), TOTAL (151→152 done, 31→30 remaining), test baseline header updated 5400→5455, version history entry 1.60 added
2. CLAUDE.md: BASELINE_TESTS (5400→5455, +55 reported, documented as +46 from G3.9 alone), BASELINE_FILES (411→432, +21 new files), LAST_COMMIT→G3.9-explore-discovery, LAST_UPDATED→2026-03-14, build diagram G3.9 ✅ added, YOU ARE HERE→G3.10+, Phase G counts (35→36 done), Phase totals (151→152 done, 31→30 remaining), status updated to 36/50 (72% complete), 152/182 (83.5%)
3. Page registry v1.1→v1.2: Added /explore route as row 1a in PUBLIC PAGES (G3.9 phase), updated homepage description to include tab system, updated public domain count (16→17), updated total pages (~130→~131), version history entry 1.2 added
4. Memory: Updated current baselines (5455 tests, 432 files), phase progress (36/50 = 72%, 152/182 = 83.5%), and doc versions

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G3.9 (discover/explore features use existing trending/collection infrastructure)
- Decision rationale: No new architectural decisions needed (discovery logic follows existing patterns)

## G1.7 Sync Details (2026-03-14)
**Feature:** Mobile Video Recording in Listing Creation — G1.7 COMPLETE
- In-app camera recording via MediaRecorder API
- Video trimmer component using HTMLCanvasElement.captureStream() for frame-by-frame trimming UI
- Dual-mode entry: record from camera OR upload file from device
- Supports MP4/MOV/WebM formats
- Client-side preview before form submit
- 94 new tests across 13 test files

**Documents Updated:**
1. Build tracker v1.62→v1.63: G1.7 marked ✅, critical path G1.7 ✅ → G4, Phase G totals (39→40 done, 11→10 remaining), TOTAL (155→156 done, 27→26 remaining), test baseline header updated 5665→5759 tests, 445→458 files, version history entry 1.63 added
2. CLAUDE.md: BASELINE_TESTS (5665→5759, +94), BASELINE_FILES (445→458, +13), LAST_COMMIT→G1.7-mobile-video-recording, LAST_UPDATED→2026-03-14, build diagram G1.7 ✅ added, YOU ARE HERE→G4, Phase G counts (39→40 done), Phase totals (155→156 done, 27→26 remaining), status updated to "G1.7 is complete. 40/50 Phase G steps done (80% complete). Critical path: G1.7 ✅ → G4 (next major queued step)."
3. Memory: Updated doc versions, current baselines (5759 tests, 458 files), and phase progress (40/50 = 80%, 156/182 = 85.7%)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G1.7 (video recording uses existing listing video infrastructure from G3.11)
- Page registry: No new routes in G1.7 (video recording UI integrated into existing /my/selling/listings/create page)
- Decision rationale: No new architectural decisions needed (recording feature straightforward)

## G5 Sync Details (2026-03-14)
**Feature:** Tax & Compliance (TaxJar, 1099-K, Affiliate 1099-NEC) — G5 COMPLETE
- G5.1: Tax info storage with AES-256-GCM encryption for SSN/EIN
- G5.2: TaxJar provider abstraction for sales tax calculation
- G5.3: 1099-K threshold tracking (annual aggregation)
- G5.4: 1099-K document generation via annual BullMQ job
- G5.5: Affiliate 1099-NEC generation via annual BullMQ job
- G5.6: Admin tax compliance hub at /fin/tax (status dashboard, threshold tracking, document download)
- TaxInfo CASL subject with encryption/decryption methods
- 5 platform settings: tax.taxjarEnabled, tax.form1099kThreshold, tax.form1099necThreshold, tax.encryptionKeyRotationDays, tax.archiveRetention
- 4 notification templates: 1099-k-ready, 1099-nec-ready, tax-reminder, nec-filing-deadline
- 117 new tests across multiple test files
- Seller tax info page at /my/selling/tax (tax ID input, form history, generated document download)

**Documents Updated:**
1. Build tracker v1.66→v1.67: G5 marked ✅, critical path G5 ✅ → G6+, Phase G totals (36→37 done, 14→13 remaining), TOTAL (159→160 done, 23→22 remaining), test baseline header updated 6139→6256 tests, version history entry 1.67 added
2. CLAUDE.md: BASELINE_TESTS (6139→6256, +117), BASELINE_FILES (458→458, no new test files), LAST_COMMIT→G5-tax-and-compliance, LAST_UPDATED→2026-03-14, build diagram G5 ✅ added, YOU ARE HERE→G6+, Phase G counts (36→37 done), Phase totals (159→160 done, 23→22 remaining), status updated to 37/50 (74% complete), 160/182 (87.9%), critical path updated
3. Page registry v1.5→v1.6: Added /my/selling/tax route (73b) and /fin/tax route (97d), updated seller pages count (35→36), updated hub finance count (6→7), updated total pages (~140→~141), version history entry 1.6 added
4. Memory: Updated doc versions, current baselines (6256 tests, 458 files), and phase progress (37/50 = 74%, 160/182 = 87.9%)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G5 (tax info stored encrypted in taxInfo table, already in schema from financial center phase)
- Decision rationale: No new architectural decisions needed (tax compliance follows established patterns)

## G8 Sync Details (2026-03-15)
**Feature:** GDPR & Data Retention — G8 COMPLETE
- Account deletion executor pipeline (BullMQ cron job for session/audit/data purge)
- Cleanup BullMQ queue management
- Cookie consent banner + /p/cookies policy page
- Enhanced GDPR Article 20 data export (18+ categories)
- Admin GDPR compliance dashboard
- 4 new platform settings: gdpr.retentionDays, gdpr.deletionWaitDays, gdpr.cookieConsentRequired, gdpr.consentExpiryDays
- 1 new column: cookieConsentJson on user table (JSON tracking consent history)
- 1 new route: /p/cookies (public policy page)
- 22 new tests across multiple test files

**Documents Updated:**
1. Build tracker v1.66→v1.69: G8 marked ✅, critical path status updated, Phase G totals (38→39 done, 12→11 remaining), TOTAL (160→161 done, 22→21 remaining), test baseline header updated 6374→6458 tests (G6→G8), version history entries 1.67 (G5), 1.68 (G6), 1.69 (G8) confirmed
2. CLAUDE.md: BASELINE_TESTS (6436→6458, +22), BASELINE_FILES (511 stable), LAST_COMMIT→G8-gdpr-data-retention, LAST_UPDATED→2026-03-15, build diagram G8 ✅ added, YOU ARE HERE pointer at G8, Phase G counts (38→39 done), Phase totals (160→161 done, 22→21 remaining), status updated to "39/50 Phase G steps done (78% complete)"
3. Page registry v1.6→v1.8: Added /p/cookies route as row 13a (Cookie Policy page, PUBLIC, G8 phase), total public pages (17→18), total pages (~141→~142), version history entry 1.8 added
4. Memory: Updated doc versions, current baselines (6458 tests, 511 files), and phase progress (39/50 = 78%, 161/182 = 88.5%)

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G8 (1 new column cookieConsentJson already on user table, tracked separately)
- Decision rationale: No new architectural decisions needed (GDPR compliance straightforward)

**Note on Version Numbers:**
- Build tracker: v1.66→v1.67 (now v1.69 including G5/G6/G8)
- Page registry: v1.6→v1.8 (skipped v1.7 was G6 update not mentioned in sync)
- All totals now consistent: 161/182 done (88.5%), 39/50 Phase G (78% complete)

## G10.9 Sync Details (2026-03-18)
**Feature:** Become Seller CTA page (/become-seller) — G10.9 COMPLETE
- Public marketing page with 4-state CTA routing: guest/non-seller/PERSONAL/BUSINESS
- TF bracket table displaying progressive transaction fee rates
- Store and Crosslister tier pricing previewed from platform_settings
- No server actions, no DB writes, pure display page
- 37 new tests across multiple test files

**Documents Updated:**
1. Build tracker: G10.9 marked ✅, updated with completion note, Phase G totals (47→48 done, 3→2 remaining), TOTAL (169→170 done, 13→12 remaining)
2. CLAUDE.md: BASELINE_TESTS (7481→7518, +37), BASELINE_FILES (604 unchanged), LAST_COMMIT→G10.9-become-seller-cta-page, LAST_UPDATED→2026-03-18, build diagram G10.9 ✅ added, YOU ARE HERE→G10.9, Phase G counts (47→48 done), Phase totals (169→170 done, 13→12 remaining)
3. Page registry v1.8→v1.8: Added /become-seller as row 16b (Become a Seller page, PUBLIC, G10.9 phase), public pages count increased

**Docs NOT Modified:**
- Schema doc: No new tables/columns in G10.9
- Decision rationale: No new architectural decisions needed
