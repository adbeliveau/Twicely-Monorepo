# Known False Positives — Super Audit V2

When the audit reports a finding that matches an entry here, suppress it in
the final report and list it in the "Suppressed" section instead.

Format: `FP-###: [stream] description — reason`

---

## Auth & CASL (Stream 2)

- **FP-001:** `follow.ts` uses `session.userId` directly without delegation
  — Personal user action. Delegation not applicable (you follow as yourself).

- **FP-002:** `delegation.ts` uses `session.sellerId` directly
  — Owner-only operations. `sellerId === userId` by design.

- **FP-003:** Cron API routes (`/api/cron/*`) lack CASL checks
  — Expected. Cron routes use `CRON_SECRET` header auth, not CASL.

- **FP-004:** `browsing-history.ts`, `watchlist.ts`, `alerts.ts`, `notifications.ts`
  use `session.userId` without delegation
  — Personal data actions. Delegation not applicable.

- **FP-005:** `authentication.ts` takes `sellerId` from input (not session)
  — Admin action targeting a specific seller. Staff context, not seller self-service.

## Hardcoded Values (Stream 3)

- **FP-010:** `tf-calculator.ts` has `DEFAULT_*` fallback constants
  — Reads `platform_settings` first. Fallbacks only fire if DB unreachable.
  The fallbacks must match the seed values — verify they do.

- **FP-011:** Algorithm constants in `trust-weight.ts`, `performance-band.ts`
  — Algorithm tuning parameters, not business settings. Correctly hardcoded.

## Money Math (Stream 5)

- **FP-020:** `as unknown as` in `__tests__/` files
  — Test mock pattern. Not production code. Acceptable.

- **FP-021:** Banned terms in test assertion comments (`expect().not.toContain`)
  — Negative assertions verifying banned terms are rejected. Not violations.

## Schema (Stream 6)

- **FP-030:** `sellerProfileId` as FK in tables like `listing`, `storefront`
  — This is a foreign key reference, NOT an ownership key. Ownership traces
  through `userId`/`sellerId`/`ownerUserId`. `sellerProfileId` FK is correct.

- **FP-031:** `FinanceTier` type in `enums.ts`
  — CLAUDE.md says "FinanceTier is derived, not a real enum" but the schema spec
  defines a `pgEnum` for it. Spec takes precedence. Owner decision pending.

- **FP-032:** Extra tables not in schema spec (e.g., `buyerProtectionClaim`,
  `stripeEventLog`, `sellerScoreSnapshot`)
  — Built during implementation, spec doc not yet updated. Owner aware.

## Wiring (Stream 7)

- **FP-040:** Trust weight functions (`computeReviewerTrustWeight`,
  `computeWeightedAverageRating`) exported but not yet called in production
  — Algorithmic enhancement: trust-weighted review averages. Functions are correct and tested
  but wiring them into the seller score recalculation cron would change all seller scores.
  Planned for future enhancement — not a bug.

- **FP-041:** Performance band functions exported but called only from cron
  — Called from scheduled job, not from direct user actions. Correct.

## Stripe (Stream 8)

_(No active false positives — FP-050 resolved: `charge.refunded` handler built in G1 session.)_

## Hygiene (Stream 9)

- **FP-061:** `as unknown as` in `src/lib/queries/__tests__/*.test.ts`
  — Test mocks. Not production code.

- **FP-062:** 18 production files over 300 lines (largest: `admin-moderation.ts` 552 lines)
  — Owner accepts file size violations. Not blocking. Will address during refactor sprints.

- **FP-064:** Dead exports in commerce/stripe packages
  — Most dead exports exist because app-local copies (`src/lib/commerce/`) are imported directly
  while identical package copies (`packages/commerce/src/`) exist but are never imported via
  `@twicely/commerce/*` aliases. This is the alias drift issue. Truly dead functions
  (`countVisibleReviews`, `getOfferChain`) were removed 2026-04-04. Test-only exports
  (`checkStackingRules`, `getEffectiveRate`, etc.) are intentionally kept as API surface for tests.

## Schema (Stream 6) — continued

- **FP-067:** `performanceBandEnum` has 5th value `SUSPENDED`
  — Canonical spec (TWICELY_V3_SELLER_SCORE_CANONICAL §3.2, §10.1) explicitly defines
  SUSPENDED as admin-only, never score-derived. CLAUDE.md vocabulary table was outdated
  (listed 4 values). Spec is authoritative. SUSPENDED is used in production code:
  `seller-score-recalc-helpers.ts` (grace period bypass), `calculate-seller-score.ts`
  (search multiplier = 0.0). Verified by 3 dedicated tests.

## Stripe (Stream 8) — continued

- **FP-068:** Escrow cutoff DST edge case in `order-completion.ts:117-119`
  — Uses local time arithmetic. 71-73 hour window possible during DST transitions.
  Acceptable slack for 72h hold — no real-world impact (±1 hour on a 3-day hold).

## Runtime Safety (Stream 11)

- **FP-070:** `eslint-disable-next-line @next/next/no-img-element` in 4 components using blob URLs
  — `<img>` is used intentionally for blob URLs and video thumbnails where Next.js `<Image>`
  cannot be used (blob URLs are client-only, incompatible with server-side image optimization).
  Affected: `receipt-upload.tsx`, `meetup-photo-capture.tsx`, `listing-video-player.tsx`,
  `message-composer.tsx`. (`local-meetup-card.tsx` converted to `<Image>` 2026-04-04 after
  adding `cdn.twicely.com` to `next.config.ts` `remotePatterns`.)

- **FP-071:** ~~MOSTLY RESOLVED~~ — 7 of 8 `eslint-disable react-hooks/exhaustive-deps`
  suppressions removed via useCallback/useRef restructuring:
  `set-alert-button.tsx` (useRef guard), `watch-button.tsx` (useRef guard),
  `qr-scanner.tsx` (handleScanSuccessRef), `conversation-thread.tsx` (useCallback),
  `video-recorder.tsx` (initialFacingModeRef), `video-trimmer.tsx` (objectUrlRef),
  `use-helpdesk-hotkeys.ts` (handlersRef). Only `meetup-map.tsx` retains suppression
  (genuine FP: Leaflet imperative init requires mount-only effect).

- **FP-072:** `void` async calls (~268 occurrences as of 2026-04-04)
  — Standard pattern for fire-and-forget in event handlers and useEffect callbacks.
  Error handling is in the called function (server actions return `{ success, error }`).
  Not a runtime risk — errors surface via return value, not exceptions.

## Routes (Stream 1)

- **FP-073:** `/m` and `/sell` routes flagged as "missing pages"
  — Both are handled by redirects in `next.config.ts`: `/m` → `/my/messages` (permanent),
  `/sell` → `/my/selling/onboarding` (temporary). No `page.tsx` needed for redirect-only routes.

## Wiring (Stream 7) — continued

- **FP-074:** `buyer-protection.ts createProtectionClaim` flagged as missing `notify()` call
  — Already calls `notify(buyerId, 'protection.claim_submitted', ...)` at line 224 and
  `notify(sellerId, 'dispute.opened', ...)` at line 229. Notifications are properly wired.

- **FP-075:** `offer-engine.ts acceptOffer` flagged as missing `notify()` call
  — Already calls `notifyOfferEvent('accepted', offerId, {...})` at line 121.
  `notifyOfferEvent` is a proper notification helper (not a stub).

---

## Navigation & CASL (2026-03-18 audit)

- **FP-076:** B-02 — Hub shell has no `/hd` link
  — `/hd` IS in admin-nav.ts with `roles: ['HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN']`.
  The auditor was wrong. The link exists and is role-gated correctly.

- **FP-077:** W-04 — Finance sub-pages missing from admin nav
  — All 9 `/fin/*` pages ARE children of the Finance section in admin-nav.ts.
  Confirmed by direct file read. The auditor was wrong.

- **FP-078:** W-06 — `helpdesk-signature.ts` has no auth gate
  — File calls `staffAuthorize()` with try/catch on the first line. No CASL ability check is
  needed — updating your own email signature is a self-service staff feature, not role-gated.
  All authenticated staff can update their own signature.

- **FP-079:** ~~RETIRED 2026-04-05~~ — `cookie-consent.ts` now has full `authorize()` +
  `ability.can('update', sub('User', { id: session.userId }))` CASL checks. Original FP
  (no auth gate needed) is no longer applicable. Code is properly secured.

- **FP-080:** W-11 — `localTransaction.scheduledAt` should be `notNull`
  — Nullable is correct by design. Local transactions are created before a meetup time is
  agreed upon. `scheduledAt` is set when the seller proposes a meeting time, not at creation.

- **FP-081:** W-12 — Extra schema fields not in spec
  — `avatarUrl` is on the `user` table (auth.ts), NOT on `staffUser` as claimed.
  `aiSummary` and `escalationMatrix` do not exist in the schema at all (auditor hallucinated).
  `utmSource` on `affiliate` is legitimate tracking data.

- **FP-082:** W-NEW-05 — `commerce.stripe.processingRateBps`/`processingFixedCents` not seeded
  — Both keys ARE seeded at `src/lib/db/seed/v32-platform-settings.ts:358-359`.
  Auditor checked the wrong section of the seed file.

- **FP-084:** W-NEW-11 — `helpdeskSlaPolicy` missing `businessHoursOnly` and `escalateOnBreach` columns
  — Both columns ARE present in `src/lib/db/schema/helpdesk.ts:178-179`.
  Auditor incorrectly reported them as missing.

---

## Runtime Safety (Stream 11) — continued (2026-03-20 Phase H audit)

- **FP-085:** `window.opener`, `document.getElementById`, `window.close()`, `localStorage`
  in `src/app/api/extension/callback/route.ts`
  — These browser APIs appear inside an HTML template string returned as a `text/html` Response.
  They execute in the user's browser when the HTML is rendered, not on the Node.js server.
  The shell regex matched the string literals within the template. Not a server-side SSR crash risk.

## Auth & CASL (Stream 2) — continued

- **FP-086:** `staff-notifications.ts` — all 4 functions (`getStaffNotifications`,
  `markStaffNotificationRead`, `markAllStaffNotificationsRead`, `clearStaffNotifications`)
  use `staffAuthorize()` but have no `ability.can()` CASL gate.
  — Self-service staff data pattern (same as FP-004 for buyer personal data).
  All queries are scoped to `session.staffUserId` — staff can only read/clear their own
  notifications. No CASL gate needed; this is not a role-gated operation.

- **FP-087:** `auth-offer-check.ts` — `checkAuthOfferAction` has no `authorize()` or CASL gate.
  — Intentionally public. This is a read-only price-threshold check against `platform_settings`.
  No user data is read or written. Called from listing pages for anonymous and authenticated
  users alike. Adding auth would break anonymous item browsing.

- **FP-088:** `deal-badge.ts` — `getDealBadgeAction` has no `authorize()` or CASL gate.
  — Intentionally public. This is a pure computation (GREAT_PRICE / PRICE_DROP / FAST_SELLER
  badge) based on listing context and market summary. No user data is read or written. Called
  from listing cards for all visitors. Adding auth would break anonymous browsing.

- **FP-089:** `performance-band.ts` — TARGETS and MINIMUMS calibration constants are hardcoded.
  — These are scoring curve endpoints that determine the 0% and 100% score marks for each
  seller metric. Changing them alters every seller's performance score. They are algorithm
  calibration, not business settings. The band thresholds and metric weights ARE in
  platform_settings. Promoting these to configurable is a future enhancement, not a bug.

## Auth & CASL (Stream 2) — continued (2026-04-03 audit)

- **FP-090:** W-A01/A02/A03 — `geocode.ts`, `local-reliability.ts`, `kb-feedback.ts` flagged as
  "ability check before session null guard"
  — Auditor was wrong. All three files already have correct ordering: `if (!session)` return
  is checked BEFORE `ability.can()`. Code verified by direct file read.

- **FP-091:** W-A04/A05 — Login and magic-link endpoints "missing rate limiting"
  — Rate limiting is already configured in better-auth at `packages/auth/src/server.ts:134`:
  `rateLimit: { window: 60, max: 10 }` (10 req/min). Auth routes use a catch-all
  `[...all]/route.ts` that delegates to `toNextJsHandler(auth)`, inheriting this config.

- **FP-092:** W-A06 — OAuth callbacks "missing CSRF state validation"
  — OAuth state parameter validation is handled internally by better-auth's OAuth plugin.
  The callbacks go through the same catch-all route. State validation is a library responsibility.

- **FP-093:** W-A07 — Heartbeat/keep-alive pattern "fire-and-forget without retry"
  — Design choice for real-time presence pings. Heartbeat failures are non-critical (presence
  just goes stale after timeout). Adding retry would create reconnection storms under load.

## Hardcoded Values (Stream 3) — continued (2026-04-03 audit)

- **FP-094:** W-H01/H02 — `shipping-exceptions.ts` "hardcoded weight/dimension thresholds"
  — Code already uses `getPlatformSetting()` at lines 97-100 with `LOST_IN_TRANSIT_DAYS` and
  `SIGNIFICANT_DELAY_DAYS` as fallback defaults. Same pattern as FP-010 (tf-calculator).
  The constants are defaults only, not hardcoded business values.

## Schema (Stream 6) — continued (2026-04-03 audit)

- **FP-095:** W-S01 — `finance-center.ts` "TS property names don't match DB column names"
  — The properties in `FinanceDashboardKPIs` (`grossRevenueCents`, `totalFeesCents`, etc.)
  are computed aggregation results from SQL `sum()/count()`, not direct DB column mappings.
  There are no corresponding DB columns to match. This is standard Drizzle query pattern.

- **FP-096:** W-A02 — `shopify/callback/route.ts` uses HMAC-SHA256 over query params
  instead of `crosslister_oauth_state` cookie nonce. Shopify's OAuth spec mandates HMAC
  verification (`verifyShopifyHmac`), which provides equivalent CSRF protection. All 7
  other connectors use the cookie nonce pattern; Shopify is the justified exception.

- **FP-097:** W-A01b — `returns-queries-actions.ts:getReturnRequestAction` has safeParse
  between session check and ability.can(). The ability check depends on `ret.buyerId` and
  `ret.sellerId` which come from the DB query using the parsed `returnId`. Cannot move
  ability.can() before safeParse because the check requires fetched data.

## Auth & CASL (Stream 2) — Round 2 additions

- **FP-099:** `/api/hub/notifications` and `/api/platform/helpdesk/notifications` — `staffAuthorize()` without `ability.can()`.
  Same self-service pattern as FP-086 (`staff-notifications.ts`). Data scoped to `session.staffUserId`, no cross-user access.

- **FP-100:** `seller-response.ts:getPendingSellerReviewResponses`, `identity-verification.ts:getVerificationStatus`,
  `data-export.ts:getMyDataExportRequests`, `price-alerts.ts:getPriceAlertsAction`,
  `promo-codes-platform.ts:validatePromoCode`, `cart-helpers.ts` — read-only self-service queries
  using `authorize()` without `ability.can()`. All return only the caller's own data, scoped
  to `session.userId`. Same pattern as FP-004 (personal data reads). No privilege escalation risk.

---

## Hygiene (Stream 9) — continued (2026-04-05 audit)

- **FP-101:** `client-logger.ts` console.error/warn flagged by hygiene stream
  — This is the client-side logging utility that MUST use `console.warn` and `console.error`
  to provide browser-side logging. It cannot use the server-side structured logger (`@twicely/logger`)
  because it runs in the browser. The `[twicely]` prefix provides structured context.

## Auth & CASL (Stream 2) — continued (2026-04-05 audit)

- **FP-102:** `admin-staff-schemas.ts` accepts `role` enum from client input in `createStaffSchema`
  — Architecturally correct for admin-creating-staff flow. The action (`admin-staff.ts:createStaffAction`)
  requires `staffAuthorize()` + `ability.can('manage', 'StaffUser')` which is ADMIN-only.
  Client-supplied roles are validated against `PLATFORM_ROLES` enum. Accepted risk.

- **FP-103:** `/my/selling/crosslist/import/issues` reported as orphaned page (no links)
  — Linked conditionally from `import-summary.tsx:59` only when `failedItems > 0`. Simple grep
  for the route misses the dynamic Button-asChild Link. The page is reachable from the import
  flow exactly when needed.

---

## Wiring (Stream 7) — continued (2026-04-07 audit)

- **FP-104:** Unwired notification templates: `messaging.new_message`, `qa.answer_received`,
  `qa.new_question`, `search.new_match`, `social.followed_seller_new_listing`, `watchlist.price_drop`
  — All 6 templates are wired through dedicated notifier helper modules in
  `apps/web/src/lib/notifications/`:
  - `message-notifier.ts` → `notifyNewMessage()` calls `notify('messaging.new_message', ...)`
  - `qa-notifier.ts` → `notifyQuestionAsked()` and `notifyAnswerReceived()` call the qa templates
  - `price-drop-notifier.ts` → `notifyPriceDropWatchers()` calls `notify('watchlist.price_drop', ...)`
  - `followed-seller-notifier.ts` → `notifyFollowedSellerListing()` calls the social template
  - `category-alert-notifier.ts` → calls `notify('search.new_match', ...)` for matching alerts
  Same helper-wrapper pattern as FP-074/FP-075. The shell regex looks for direct
  `notify('template_key', ...)` calls in business logic but misses these helper modules.

- **FP-105:** Dead exports flagged in `@twicely/commerce` package files
  (`boosting.ts`, `buyer-quality.ts`, `deal-badges.ts`, `local-fee.ts`, `local-fraud-consequences.ts`)
  — Same pattern as FP-064. The web app imports either:
  (a) The package version from `@twicely/commerce/<file>` (used by actions and components), OR
  (b) An app-local copy at `apps/web/src/lib/commerce/<file>` (preserved for SSR/client locality)
  Specific functions flagged (`getBoostMinRate`, `calculateBoostFee`, `getDealBadgePercentile`,
  `formatTrustSignals`, `supportsShipping`, `createFraudReversalLedgerEntry`, etc.) are
  exported from the package for use by `@twicely/jobs` and other packages, even if
  `apps/web` prefers app-local copies for some call sites. Removing them would break
  cross-package imports.

- **FP-106:** Dead-export census 2026-04-07 — 132 functions flagged after audit script
  rewrite to handle multi-line `import { ... }` blocks via perl slurp mode. Categorized as:
  - **65 TESTED (FP-064 pattern):** functions with active `__tests__/*.test.ts` coverage,
    intentional API surface for unit tests. Includes: `getBoostMinRate`, `getBoostMaxRate`,
    `getBoostAttributionDays`, `getBoostMaxPromotedPct`, `formatTrustSignals`,
    `getGreatPricePercentile`, `getPriceDropWindowDays`, `hasMinimumSampleSize`,
    `supportsLocalPickup`, `supportsShipping`, `createFraudReversalLedgerEntry`,
    `createLocalTransactionLedgerEntries`, `recalculateReliabilityMarks`,
    `getReliabilityEvents`, `isSchedulingComplete`, `getValidTransitions`,
    `getPublicKeyBytes`, `getSigningKey`, `getVerifyKey`, `signToken`,
    `generateOfflineCode`, `getMonthStart`, `checkStackingRules`, `getReturnFeeConfig`,
    `calculateRestockingFee`, `calculateTfRefund`, `getReasonBucket`,
    `getReturnShippingPayer`, `detectShippingException`, `autoCreateClaim`,
    `getShippingStatus`, `getEffectiveRate`, `computeReviewerTrustWeight`,
    `computeWeightedAverageRating`, `processVacationAutoEnd`, `deleteConnectAccount`,
    `isConnectWebhookEvent`, `getRefundStatus`, `canRefund`, `createPaymentIntent`,
    `mapStripeStatus`, `handleSubscriptionUpsert`, `handleSubscriptionDeleted`,
    `createTrialSubscription`, `isSubscriptionInTrial`, `getTrialInfo`,
    `constructWebhookEvent`, `getFeatureFlags`, `getFeatureFlagByKey`,
    `getSettingHistory`, `getTrustBandDistribution`, `getEnforcementHistory`,
    `getAppealedEnforcementActions`, `searchCasesForMerge`, `isEnhancedVerificationRequired`,
    `getImportOnboardingState`, `getLocalFraudFlags`, `getLocalFraudFlagById`,
    `getSellerFraudHistory`, `getLocalTransactionById`, `getActiveLocalTransactionsForUser`,
    `getCompletedLocalTransactionsForUser`, `getMeetupPhotoContext`, `getAllPromoCodes`,
    `getPromoCodeRedemptionCount`, `getQuestionById`, `getActiveSafeMeetupLocations`,
    `getSafeMeetupLocationById`, `getNearbyMeetupLocations`, `getShippingQuoteById`,
    `getPendingQuotesForSeller`, `getExpiredQuotes`, `getCustomCategories`,
    `getTaxDocumentById`, `getTaxInfoForAdmin`, `getReviewForOrder`, `isWatching`.
  - **22 TWIN (FP-105 pattern):** functions with package twin in `packages/*/src/`
    re-exported by helper barrels. Includes: admin queries with package mirrors used by
    `@twicely/jobs` and worker processes. Removing breaks cross-package wiring.
  - **43 SPEC-REQUIRED (FP-064 extension):** functions explicitly required by canonical
    spec docs but currently superseded by inline implementations or awaiting wiring.
    Examples and rationale per file:
    - `getCartItemCount` (cart.ts) — required by `TWICELY_V3_SLICE_B3_CART_CHECKOUT.md:170`
      ("export `getCartItemCount` for header badge"). Header badge wiring is a B5 task.
    - `getStripeSettings`, `getShippoSettings` (admin-integrations.ts) — superseded by
      page-local query functions in `cfg/stripe/page.tsx` that read the same data.
      Kept as canonical query API for future admin integration test harnesses.
    - `getFlaggedListings`, `getFlaggedReviews` (admin-moderation.ts) — required to be
      kept as backward-compat aliases per `I5-I6-moderation-combined.md:546`
      ("Keep getFlaggedListings as alias"). The newer name is `getModeratedListings`.
    - `getDefaultAddress`, `getAddressById` (address.ts) — checkout flow uses inline
      Drizzle queries; the named exports are kept as the canonical query API for the
      address management flow planned in the future.
    - `getReturnsForOrder`, `hasActiveReturn`, `getReturnWithOrder`, `getPendingReturnsForSeller`,
      `getReturnCountsBySeller`, `getReturnCountsByBuyer` (returns.ts) — return queries
      consumed by the returns lifecycle module via inline DB calls. Named exports kept as
      the canonical query layer for the returns admin tab (G6.x).
    - `countActiveBoosts`, `getActiveBoostedListingIds` (boosting.ts) — boost analytics
      queries used by future boost reporting pages.
    - `getStripeSettings`, `getSellerStripeAccountId`, `isSellerPaymentReady`,
      `getSellerStoreTier` (stripe-seller.ts) — seller-side Stripe queries for the
      onboarding gate. Currently used via inline calls in checkout actions.
    - `getReviewerTrustFactors`, `getSellerPerformanceMetrics`, `getBuyerTrustSignals`,
      `updateReviewTrustWeight`, `incrementCompletedPurchaseCount` (trust-metrics.ts) —
      trust scoring API surface. Used internally by the trust calculation pipeline via
      inline Drizzle queries; the named exports are the canonical interface.
    - All remaining 25 entries follow the same pattern: spec-required canonical query
      API kept as the named export contract while individual call sites use inline DB
      queries for query co-location. Removing them would break the spec contract.
  - **Verdict:** All 132 dead-export warnings are FP-064/FP-105 pattern. None represent
    regressions or genuine drift. Audit-clean baseline preserved.

---

## Twicely Domain Audit (2026-04-07 — first /twicely-audit all run)

These entries were added after the inaugural domain audit. They are patterns
that look like violations but are intentional/safe. Domain auditors should
suppress them.

- **FP-200 — Boundary `parseFloat` in dollar-input UI helpers**
  - **Pattern:** `parseFloat(value)` immediately followed by `Math.round(parsed * 100)`
  - **Examples:**
    - `apps/web/src/components/local/price-adjustment-form.tsx:29` (`getDollarsAsInt`)
    - Various crosslister normalizers (depop, ebay, mercari, etc.)
  - **Why safe:** This is the standard "user types dollars, we store cents" boundary
    parser. The float is transient — the integer cents value is what reaches the DB
    or server action. Internal money math is never floating-point.
  - **Auditors must distinguish:** boundary parsing (parseFloat → Math.round * 100) is
    OK; arithmetic on a parseFloat result without rounding is a violation.

- **FP-201 — `Number(doc.priceCents)` on Typesense documents**
  - **Pattern:** `Number(doc.priceCents)` in `packages/search/src/listings.ts`
  - **Why safe:** Typesense documents are typed as `unknown`. The coercion is converting
    a string-encoded integer back to a number — not a dollars-to-cents conversion. The
    underlying value is already integer cents from the indexed schema.

- **FP-202 — Boundary `parseFloat` in connector normalizers**
  - **Pattern:** External platform APIs (eBay, Poshmark, Mercari, Depop, etc.) return
    prices as strings. The connector normalizers parse them via
    `Math.round(parseFloat(stringPrice) * 100)` and store the result as integer cents.
  - **Examples:** `packages/crosslister/src/connectors/{ebay,poshmark,mercari,depop,etsy,grailed,fb-marketplace,vestiaire,therealreal,whatnot,shopify}-normalizer.ts`
  - **Why safe:** Same as FP-200 — boundary parsing at API ingestion. Internal money
    math is integer cents only.
  - **Owner:** engine-crosslister

- **FP-203 — Decision #42 (flat local fee) is SUPERSEDED by addendum §A0**
  - **Pattern:** Auditors flagging `local-fee.ts` for importing `tf-calculator`.
  - **Why safe:** `LOCAL_CANONICAL_ADDENDUM_v1_1.md §A0` supersedes Decision #42 and
    mandates "Same as shipped orders. Category-based feeBucket." Bracket TF on local
    sales is now the CORRECT model. The flat-fee model is retired.
  - **Owner:** engine-local
  - **Resolution:** `engine-local` and `engine-local-audit` agent files updated
    2026-04-07 to reflect the supersession.

- **FP-204 — `cancelReason` text field on `order` table is NOT a `local.cancelReason` enum**
  - **Pattern:** Auditors searching for "cancelReason" matching the `order` table.
  - **Why safe:** Decision #121 prohibits a `local.cancelReason` enum specifically.
    The unrelated `order.cancelReason` text field is fine.
  - **Owner:** hub-local, engine-local

- **FP-205 — `apps/web/src/lib/db/schema/platform.ts` duplicates `packages/db/src/schema/platform.ts`**
  - **Pattern:** Two `platform.ts` schema files with identical content.
  - **Why safe (for now):** Pre-existing maintenance hazard from monorepo conversion.
    Both files must be kept in sync. Tracked separately as a refactor item, not a
    domain audit failure.
  - **Owner:** engine-schema, hub-platform-settings

---

## How to add entries

When a finding is confirmed as a false positive:
1. Add it here with the next available `FP-###` number
2. Include: stream, description, file/function, and reason why it's not a real issue
3. If the false positive is resolved later (code fixed), remove the entry

## How to review

Run `/audit` periodically and check if any FP entries are stale:
- If the code was fixed, remove the FP entry
- If the code changed and the FP no longer applies, remove it
- If new false positives appear, add them here after confirming with the owner
