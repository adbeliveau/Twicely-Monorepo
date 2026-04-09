# Twicely Domain Audit Rollup — `/twicely-audit all`

**Run at:** 2026-04-08T18:00:00Z
**Commit:** cb87b89 (master, post Phase A-E audit-remediation merge)
**Scope:** all 20 domains (19 registered + hub-messaging via Explore fallback)
**Auditor model:** sonnet

---

## OVERALL VERDICT: **FAIL** (2 FAIL, 10 DRIFT, 7 PASS, 1 PASS*)

- **PASS:** 7 (hub-company-finance, engine-security, engine-schema, mk-listings, hub-helpdesk, hub-crosslister, mk-checkout)
- **PASS\*:** 1 (hub-finance — 7 rules PASS, 3 UNVERIFIED Phase-D4 features, 2 low-severity copy drifts)
- **DRIFT:** 10 (engine-local, mk-personalization, hub-subscriptions, mk-browse, hub-seller-score, hub-local, hub-platform-settings, hub-shell, engine-crosslister, engine-finance)
- **FAIL:** 2 (hub-messaging, mk-buyer-protection)

---

## Domain verdicts

| Domain | Verdict | Top finding |
|---|---|---|
| mk-browse | DRIFT | R4 — `packages/search/src/listings.ts:44` hardcodes `limit = 48`; canonical default is 24; `discovery.search.defaultPageSize` seeded but never read |
| mk-checkout | **PASS** | All 7 rules clean. SELECT FOR UPDATE verified, order-number canonical, `reverse_transfer + refund_application_fee` on cancel |
| mk-listings | **PASS** | All 7 rules clean. Imports ACTIVE, SOLD unarchivable (Decision #109), FREE 5/6mo teaser wired |
| mk-buyer-protection | **FAIL** | **R1 critical:** `calculateTfRefund()` returns full TF for SELLER_FAULT. Decision #1 LOCKED says Twicely keeps 100%. Bug in `return-fees.ts:101-111` + test asserts wrong value |
| mk-personalization | DRIFT | D1 `homepage.ts` uses `user.name`, `feed.ts` uses `user.displayName` (inconsistent). D2 `cardEmphasis` not in feed query output (Phase G polish, no TODO) |
| hub-shell | DRIFT | D1 Crosslister nav gate uses `IS_SELLER` not canonical `HAS_CROSSLISTER` (no Decision record). D2 Impersonation token TTL hardcoded 15min, no seed key |
| hub-finance | PASS\* | R4/R6/R8 UNVERIFIED — Phase D4 intelligence-layer features not yet built. 2 low-severity copy drifts on upsell card + render-path defensive check |
| hub-company-finance | **PASS** | Future surface, canonical LOCKED, no scope creep, zero conflation terms |
| hub-subscriptions | DRIFT | Finance PRO 6-month trial (FC v3.0 §2): schema + seed keys exist but never read/written. Canonical tags as "Phase D4 work" — intentional deferred |
| hub-crosslister | **PASS** | All 11 rules clean. Phase 10 verified (11-platform UI + auth health check cron at `:15` UTC) |
| hub-helpdesk | **PASS** | All 8 rules clean. SLA/routing from DB, all 4 crons registered with `tz: 'UTC'`, Phase D split verified, 29 test files |
| hub-seller-score | DRIFT | Engine B `computePerformanceBand` still exported (dead code) from `packages/scoring/src/performance-band.ts`. Phase 4 removed from commerce path, missed scoring package. Zero callers but risks future fork |
| hub-platform-settings | DRIFT | SD-1: `platformSetting` uses inline `.unique()` but canonical §1.2 specifies named `uniqueIndex('ps_key')`. R5: `feature-flags.ts` module-level `_cachedTtl` cache has no invalidation path |
| hub-local | DRIFT | **D1 blocking:** Phase 5 cash sale action layer absent — `local-cash-sale.ts`/`local-cash-complete.ts` exist in `packages/commerce` but no `apps/web/src/lib/actions` wrapper; seller has no UI entry point |
| hub-messaging | **FAIL** | **V1 (R1):** no `uniqueIndex('buyerId','sellerId','listingId')` in `schema/messaging.ts` — race-unsafe app-level dedup. **V2 (R10):** `use-conversation-realtime.ts` inlines channel string instead of importing `conversationChannel()` |
| engine-finance | DRIFT | **D1 important:** `ledger_entry.idempotencyKey` column + unique partial index added in Phase 6, but **not populated at 9+ insert sites** (refund, chargeback, admin-finance, local-ledger, etc.). Partial index means NULL inserts pass silently — **idempotency guarantee is inactive** |
| engine-crosslister | DRIFT | `packages/jobs/src/crosslister-auth-health-check.ts` (Phase 10) has no test file. 4 detection branches + idempotency + notification dispatch all uncovered |
| engine-security | **PASS** | All 8 rules clean. Better Auth, HMAC-SHA256 impersonation (constant-time compare), Phase A DEVELOPER rule scoped read-only |
| engine-schema | **PASS** | 189 tables, 37 schema files, zero Prisma, all FKs have explicit onDelete, Phase 6 baseline migration present |
| engine-local | DRIFT | D1 3 dead schema columns (`noShowFeeCents`, `noShowFeeChargedAt`, `noShowParty`) superseded by §A5 but still in schema. D2 `commerce.local.inconsistentMarkThreshold` used in code but not seeded |

---

## Top violations (FAIL + blocking DRIFT)

1. **mk-buyer-protection / R1** — `packages/commerce/src/return-fees.ts:101-111`
   `calculateTfRefund()` returns full TF to seller for SELLER_FAULT bucket. Decision #1 (LOCKED 2026-02-20) mandates "Twicely keeps 100% of TF on SELLER_FAULT". Current code: `return originalTfCents` for every bucket except BUYER_REMORSE. Correct: return `0` for SELLER_FAULT. **Test asserts the wrong value** (`return-fees.test.ts:100` expects 500, should expect 0). This is a real money bug: Twicely loses TF on every INAD/WRONG_ITEM/COUNTERFEIT return.

2. **hub-messaging / V1 (R1)** — `packages/db/src/schema/messaging.ts:27-32`
   Missing `uniqueIndex` on `(buyerId, sellerId, listingId)` tuple. Application-level dedup exists (`messaging-actions.ts:90-100` SELECT before INSERT) but is NOT race-safe under concurrent load. Two concurrent `createConversationAndSend` calls with the same triple can insert duplicate rows.

3. **hub-messaging / V2 (R10)** — `apps/web/src/hooks/use-conversation-realtime.ts:36`
   Channel constructed inline as `private-conversation.${conversationId}` instead of importing `conversationChannel()` from `@twicely/realtime/messaging-channels`. If the channel naming scheme changes in the package, this hook will silently diverge. The typing route correctly imports the helper.

4. **hub-local / D1 blocking** — `apps/web/src/lib/actions/local-cash-sale.ts` ABSENT
   Phase 5 backend exists in `packages/commerce/src/local-cash-sale.ts` + `local-cash-complete.ts`. Read side (`LOCAL_CASH_SALE_REVENUE`) is consumed in `finance-center-detail.ts` + `finance-center-reports-pnl.ts`. BUT no server action wrapper exists in `apps/web/src/lib/actions/`, so a seller has NO UI entry point to log a cash sale. Feature is inoperative.

5. **engine-finance / D1 important** — `packages/db/src/schema/finance.ts:42` + 9 insert sites
   `ledger_entry.idempotencyKey` column added (Phase 6) with partial unique index `le_uniq_idempotency`. But **zero new ledger insert sites populate it**: `webhook-refund-handler.ts`, `chargebacks.ts`, `admin-finance.ts`, `local-ledger.ts`, `protection-processing.ts`, `dispute-recovery.ts`, `return-fee-apply.ts`, `order-cancel.ts`, `checkout-finalize.ts`. The canonical format is defined (`order:{id}:tf`, `refund:{id}:full`, etc.) but unused. Partial index (`WHERE idempotency_key IS NOT NULL`) means NULL inserts pass silently, so the idempotency guarantee §4.4 was meant to provide is not actually active on any path yet.

---

## Drift summary

| Category | Count |
|---|---|
| Files in code, missing from registry | 1 (`use-conversation-realtime.ts` in hub-messaging) |
| Files in registry, missing from code | 2 (`storefront-header-local.tsx`, `seller-card-local.tsx` in hub-local — absorbed into parents) |
| Schema mismatches (canonical vs implementation) | 3 (engine-local 3 dead cols, hub-platform-settings missing named index, engine-schema 2 extra enum values) |
| Test coverage gaps | ~15 (seller-score action, 6 orders query files, 3 search package files, 1 Phase 10 cron, etc.) |
| Missing server-action wrappers | 2 (`local-cash-sale`, `local-cash-complete` in apps/web/src/lib/actions/) |
| Unseeded canonical keys | 2 (`commerce.local.inconsistentMarkThreshold`, `general.impersonationTokenTtlMinutes`) |
| Dead exported code | 1 (`computePerformanceBand` in `packages/scoring/src/performance-band.ts`) |
| Re-export patterns rejected by Turbopack | 0 (all fixed in Phase D hotfix) |

---

## Deferred / Phase-gated (not regressions)

- **hub-subscriptions** Finance PRO 6-month trial wiring — canonical tags as "Phase D4 work"
- **hub-finance** R4/R6/R8 intelligence layer — Phase D4 build targets, schema tables present, jobs/components absent
- **mk-personalization** Layer 2 `cardEmphasis` — canonical §14 "G polish"
- **engine-crosslister** test coverage for Phase 10 auth health check — follow-up from recent addition
- **hub-crosslister** minor canonical drift on projection status enum (`ORPHANED`/`UNMANAGED` extensions beyond spec §5.7 v1 sketch)

---

## Suppressed (known false positives)

Total: ~25 FP suppressions matched across 20 domains. Key patterns:
- **FP-010** (fallback default constants matching seed) — applied in 12 domains
- **FP-200/FP-201/FP-202** (boundary `parseFloat` → `Math.round * 100`) — applied in mk-listings, mk-checkout, engine-crosslister, hub-finance
- **FP-062** (file size over 300 lines — 7 remaining owner-accepted) — applied in hub-messaging, hub-platform-settings, mk-checkout
- **FP-206** (heartbeat staffAuthorize bypass) — applied in engine-security, hub-shell
- **FP-032** (implementation-phase enum/table additions ahead of spec doc) — applied in engine-schema

---

## Comparison vs last audit (2026-04-06, commit 722fd87 — pre-remediation)

| Metric | Pre-remediation | Post-remediation | Delta |
|---|---|---|---|
| PASS domains | 5 | 7 | +2 |
| DRIFT domains | 14 | 10 + 1 PASS\* | −3 |
| FAIL domains | 0 | 2 | +2 (both new: hub-messaging first audit, mk-buyer-protection regression surfaced) |
| Real blockers | 0 | 0 | — |
| File splits done | 0 of 17 | 10 of 17 | +10 |
| Unowned action files | 85 | 0 | −85 |
| Domain count | 19 | 20 | +1 (hub-messaging) |
| Tests | 9631 | 9838 | +207 |

**Net progress is significant** — the remediation branch resolved most Phase 1-9 drift. The 2 new FAILs are:

- **hub-messaging** — **FIRST EVER AUDIT** of a brand-new domain. V1 (DB-level dedup) and V2 (channel helper import) are real gaps but are greenfield findings, not regressions.
- **mk-buyer-protection** — The `calculateTfRefund` bug is **pre-existing** and was NOT introduced in this remediation sweep (the code block was untouched by any Phase A-E commit). The auditor surfaced a latent Decision #1 violation that's been in the codebase since the D1 dispute fixes landed. This is the most important finding of the run.

---

## Recommended next actions (priority order)

1. **URGENT — mk-buyer-protection / R1 SELLER_FAULT TF bug** (real money loss on every INAD return). Fix `calculateTfRefund()` to return 0 for SELLER_FAULT, update `return-fees.test.ts:100` to assert 0, add a new test asserting the full rule table per Decision #1.

2. **HIGH — engine-finance / ledger_entry idempotencyKey population.** The partial unique index is inactive because no insert site populates the column. Add canonical-format keys to all 9+ insert sites (`order:{id}:tf`, `refund:{id}:full`, etc.). Write a regression test asserting `idempotencyKey` is non-null on new inserts.

3. **HIGH — hub-local / D1 Phase 5 action layer missing.** Create `apps/web/src/lib/actions/local-cash-sale.ts` + `local-cash-complete.ts` as `'use server'` wrappers over the commerce package functions. Seller currently has no UI entry point.

4. **HIGH — hub-messaging / V1 conversation dedup.** Add `uniqueIndex('conv_unique_triple', [buyerId, sellerId, listingId])` to the conversation table. Generate incremental migration.

5. **MEDIUM — hub-messaging / V2 realtime channel helper.** Update `use-conversation-realtime.ts:36` to import `conversationChannel()` from `@twicely/realtime/messaging-channels`. Add the hook to agent code_paths registry.

6. **MEDIUM — hub-seller-score / Engine B cleanup.** Delete `computePerformanceBand` from `packages/scoring/src/performance-band.ts`. Keep type exports (`PerformanceBand`, `SellerMetrics`, `getTrustBadge`) that display consumers still need.

7. **MEDIUM — hub-shell / D2 impersonation TTL.** Add `general.impersonationTokenTtlMinutes` to `platform_settings` seed (default 15), read from `impersonation/start/route.ts:161`.

8. **LOW — documentation cleanups** (engine-local 3 dead schema cols, hub-platform-settings named index, build doc BASIC/ELITE staleness, mk-personalization sellerName inconsistency, hub-crosslister projection enum spec update, engine-schema spec doc sync)

9. **LOW — test coverage gaps** (6 orders query files, 3 search package files, Phase 10 auth health check cron, seller-score action, mk-browse browse queries)

---

## Gates

- `npx turbo typecheck`: 24/24 pass, 0 errors
- `npx turbo build`: 1/1 task, 5m07s (passed)
- Tests: 9838/9838 (isolated per-package)
- Domain audit: **FAIL** (2 FAIL + 10 DRIFT + 7 PASS + 1 PASS\*)

---

## Verdict: **FAIL — 2 domains, 1 critical money bug**

The mk-buyer-protection SELLER_FAULT TF bug is the #1 priority — it's a direct violation of Decision #1 LOCKED and represents ongoing revenue loss on every returned INAD/WRONG_ITEM/COUNTERFEIT order. The hub-messaging FAIL is less urgent (schema race condition with a low-probability trigger) but should be paired with the V2 channel helper fix in the same commit.

All other DRIFT items are low-to-medium severity and can be handled in a follow-up sprint. The 7 PASS domains and 1 PASS\* confirm the Phase A-E remediation worked — consolidation is clean, schema hygiene holds, CASL is tight, build is green.

**Run `/twicely-fix mk-buyer-protection R1 return-fees.ts:101` to fix the critical bug first.**
