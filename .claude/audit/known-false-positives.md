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

- **FP-079:** W-07 — `cookie-consent.ts` has no auth gate
  — File correctly calls `authorize()` (user-level auth). Cookie consent is a user privacy
  preference (GDPR G8.3 feature), not a staff permission. Intentionally not CASL-gated.
  Unauthenticated users get a guest cookie; consent is merged on login.

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
