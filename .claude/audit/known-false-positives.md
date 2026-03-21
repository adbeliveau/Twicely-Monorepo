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
  `computeWeightedAverageRating`) exported but not yet called
  — Wired during Phase G launch polish. Expected gap.

- **FP-041:** Performance band functions exported but called only from cron
  — Called from scheduled job, not from direct user actions. Correct.

## Stripe (Stream 8)

_(No active false positives — FP-050 resolved: `charge.refunded` handler built in G1 session.)_

## Hygiene (Stream 9)

- **FP-060:** `console.error` in `src/lib/notifications/service.tsx`
  — Known. Structured logger not yet integrated. Phase G task.

- **FP-061:** `as unknown as` in `src/lib/queries/__tests__/*.test.ts`
  — Test mocks. Not production code.

- **FP-062:** Files over 300 lines
  — Owner accepts file size violations. Not blocking. Will address during refactor sprints.

- **FP-063:** `console.error/warn` in production code (13 occurrences)
  — Structured logger integration is a Phase G task. Acceptable until then.

- **FP-064:** Dead exports in `src/lib/commerce/` (35+ functions)
  — Phase G wiring. Functions are correct implementations awaiting UI/route integration.

- **FP-065:** Unwired notification templates (messaging, QA, search, watchlist)
  — Phase G wiring. Templates are defined correctly, notify() calls added when UI is built.

- **FP-066:** Weak ID validation (`z.string().min(1)` instead of `z.string().cuid2()`)
  — Acceptable for now. Will tighten ID validation in a dedicated security pass.

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

- **FP-070:** `eslint-disable-next-line @next/next/no-img-element` in photo/video components
  — `<img>` is used intentionally for external CDN URLs, blob URLs, and video thumbnails
  where Next.js `<Image>` doesn't apply (no optimization needed for user-uploaded content).
  Affected: `receipt-upload.tsx`, `local-meetup-card.tsx`, `meetup-photo-capture.tsx`,
  `listing-video-player.tsx`.

- **FP-071:** `eslint-disable react-hooks/exhaustive-deps` in effect hooks
  — Some effects intentionally run only on mount or when specific deps change.
  Each instance reviewed individually; some may be legitimate bugs. Re-audit periodically.

- **FP-072:** `void` async calls (105 occurrences)
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

- **FP-083:** W-NEW-09 — Key naming mismatches (`review.*` vs `trust.review.*`, etc.)
  — Code and seed are internally consistent: both use `review.*`, `standards.*`, and `commerce.protection.*`.
  The spec document uses `trust.review.*` etc., but this is a doc-only divergence.
  Renaming would require simultaneous changes to 10+ files and the DB. No functional impact.

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
