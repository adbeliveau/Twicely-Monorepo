# Twicely Monorepo — Build Instructions

## What This Is

Turborepo monorepo for Twicely, a peer-to-peer resale marketplace. Converted from a single Next.js app.

## Status: ALL PHASES COMPLETE

Phases A–I complete. Monorepo conversion done. All features built. Audit-clean.

- TypeScript: 24/24 packages pass
- Tests: 23/23 packages pass, 9836+ tests green (ghost-duplicate-free)
- Audit: 11/11 streams clean (0 blockers, 0 warnings)
- Duplicate-tree consolidation: Tier 0 + 1 + 2 + 3 + 4 + 5 COMPLETE (all 18 trees consolidated)

### Important Notes

- **Original repo at `C:\Users\XPS-15\Projects\Twicely` is untouched** — do not modify it
- User preference: **fully autonomous execution, no approval prompts**

## Structure

```
apps/web/        — Next.js marketplace (twicely.co + hub.twicely.co)
apps/admin/      — Admin hub UI (to be wired)
apps/registry/   — Feature Registry app (Vite + React SPA, Codespring-like dashboard)
apps/extension/  — Chrome browser extension (placeholder)
packages/        — 22 shared packages (db, auth, casl, commerce, crosslister, etc.)
```

## Commands

```bash
pnpm install          # Install all workspace dependencies
npx turbo typecheck   # TypeScript check across all packages
npx turbo test        # Run all tests
npx turbo build       # Build all packages + apps
npx turbo dev         # Start dev server
```

## Rules (inherited from original repo)

- All rules from `apps/web/CLAUDE.md` still apply
- TypeScript strict mode, zero `as any`
- Integer cents for money, never floats
- All settings from `platform_settings` table
- 9,836+ tests must pass (baseline)
- **Never add files to `apps/web/src/lib/X` for trees that have been consolidated.** All shared code lives in `packages/X/src`. See `memory/project_duplicate_tree_consolidation.md` for the live status table.

BASELINE_TESTS=9836

## Duplicate-tree consolidation status

| Status | Trees |
|---|---|
| Done (ALL TIERS 0–5) | shipping (deleted), realtime, email, scoring, config, finance, utils, storage, subscriptions, search, auth, casl, db (schema/index only), stripe, notifications, commerce, crosslister, **jobs** |

Old `BASELINE_TESTS=13443` was inflated by ~3,812 ghost duplicate runs from mirror trees. The 9631 count is the honest unique-test total verified by `npx turbo test`. (Tier 0+1: 1,233; Tier 2: 167; Tier 3: 274; Tier 4 stripe: 109; Tier 4 notifications: 33; Tier 4 commerce: 550; Tier 5 crosslister: 1,193; Tier 5 jobs: 253.)

**Tier 5 jobs findings (many bidirectional regressions):**
- Package lost `getPlatformSetting` calls across the board. All restored in package: `privacy.dataExport.downloadUrlTtlHours` (data-export.ts), `affiliate.fraud.scanWindowHours` (affiliate-fraud-scan.ts), `trust.standards.evaluationPeriodDays` as `windowDays` (seller-score-recalc.ts — also replaced the hardcoded `WINDOW_DAYS = 90` constant), `commerce.local.meetupReminder{24Hr,1Hr}Offset` (local-meetup-reminder.ts), `cleanup.auditArchive.batchSize` (cleanup-audit-archive.ts), `helpdesk.{autoClose,slaCheck,csatSend,retentionPurge}.batchSize` (all 4 helpdesk workers), `helpdesk.cron.{autoClose,slaCheck,csatSend,retentionPurge}.pattern` (all 4 helpdesk enqueue helpers — read cron schedule from platform_settings).
- Package was silently running cron jobs without `tz: 'UTC'` — restored on `affiliate-suspension-expiry`, `expire-free-lister-tier`, `seller-score-recalc`, `affiliate-fraud-scan`, `tax-document-generation`, `affiliate-payout-cron`, and all 4 helpdesk enqueue functions. Without UTC anchoring, the BullMQ scheduler would drift across DST boundaries.
- Package had dropped `helpdesk.cleanup.dataPurge.exportBatchSize` + all four `privacy.retention.*` setting keys (had rewritten them as `retention.*` which didn't match the seed). **Restored web's `privacy.retention.*` keys + `privacy.dataExport.expiryDays`** (cleanup-data-purge.ts).
- Package had dropped SEC-027 purge allowlist (`ALLOWED_PURGE_TABLES` + `ALLOWED_PURGE_COLUMNS` + explicit membership check in `purgeTableGracefully`). **Restored** — unconditional table/column names in purge queries were a SQL-injection guardrail.
- Package had dropped the `shipping.penaltyDiscountPercent` read — restored with the canonical key `commerce.shippingQuote.penaltyDiscountPercent` (matches seed).
- `seller-score-recalc.ts`: package had dropped the Typesense sync block that patches `sellerScore` and `sellerPerformanceBand` on all ACTIVE listings after a score recalc. Restored with **dynamic imports** of `@twicely/search/typesense-client` + `@twicely/search/typesense-schema` to avoid the `jobs → search → commerce → jobs` circular dep at compile time.
- `helpdesk-auto-close.ts`, `helpdesk-sla-check.ts`, `helpdesk-csat-send.ts`: package had dropped user/agent notification calls (`notify(requesterId, 'helpdesk.case.closed')`, `notify(assignedAgentId, 'helpdesk.agent.sla_{breach,warning}')`, `notify(requesterId, 'helpdesk.case.escalated_user')`, `notify(requesterId, 'helpdesk.csat.request')`) and the SELECT columns that feed them (`requesterId`, `caseNumber`, `assignedAgentId`, `subject`). Restored all.
- `queue.ts`: package added `registerShutdown(() => worker.close())` on every `createWorker()` call — centralized SIGTERM/SIGINT handling (Node.js MaxListeners default is 10, web mirror had 16+ individual `process.on('SIGTERM')` calls). Package wins.
- **Circular dep resolved with DI factory + lazy IIFE pattern**: `jobs → commerce` can't be a compile-time dep because `commerce → jobs` already exists. Solution: files that need commerce export a `create…Worker(handlers)` factory + mirror the `LocalReliabilityEventType` union type inline. An auto-instantiated `void (async () => { const mod = await import('@twicely/commerce/…'); createWorker(mod.fn); })()` IIFE at module bottom launches the worker once commerce is loaded. Applied to `local-noshow-check.ts`, `local-day-of-confirmation-timeout.ts`, `local-fraud-noshow-relist.ts`, `offer-expiry.ts`, `affiliate-payout-cron.ts`. Dynamic imports in `seller-score-recalc.ts` (Typesense) and `cron-jobs.ts` (commerce shipping/returns/vacation/exceptions) follow the same pattern.
- Declared `@twicely/commerce`, `@twicely/search`, `@twicely/stripe` as **optional peerDependencies** in `packages/jobs/package.json` so pnpm's workspace resolver can resolve the dynamic imports without treating it as a hard cycle. Install emits a cyclic workspace warning (expected — dev-only, runtime-safe).
- `cleanup-queue.ts`, `cron-jobs.ts`: registered the 4 helpdesk cron jobs (auto-close, sla-check, csat-send, retention-purge) in `packages/jobs/src/cron-jobs.ts` that the package had missed. Cron-jobs test assertion count bumped from 14 → 17.
- 14 test files needed mock additions: `@twicely/db/queries/platform-settings`, `@twicely/notifications/service`, `@twicely/search/typesense-{client,schema}` — package tests were written against the regressed source files so they lacked the mocks I needed once the source was restored.
- **`shipping-quote-deadline.ts`** was importing `resolveQuoteFinalPrice` from `@/lib/services/shipping-quote-resolver` (web mirror path) — pointed to `./shipping-quote-resolver` (package already had the helper).
- **Baseline corrected 9884 → 9631** (jobs pkg: 257 tests already counted, web mirror's 253 ghost runs removed).

**Tier 5 crosslister findings:**
124 source files differed + 3 package-only files. Pattern: package was uniformly canonical — no bidirectional regressions, no platform_settings reads were stripped (verified by `grep` of `getPlatformSetting('crosslister.*')` calls). All package wins:
- `services/publish-service.ts` (largest diff, 116 lines): split out into `publish-service-helpers.ts` to keep both files under 300-line CLAUDE.md limit. Helpers: `channelSettingKey`, `isCrosslistEnabled` (platform_setting + featureFlag dual-check kill switch), `enqueueSyncJob`. Re-exported from `publish-service.ts` for source compatibility.
- `connectors/etsy-connector.ts` (65 lines): package adds **proper PKCE code verifier** (`randomBytes(32) → SHA-256 challenge`); web mirror was passing the OAuth `state` as `code_challenge`, a fake PKCE that any auditor would flag.
- All other connectors (`ebay`, `grailed`, `vestiaire`, `therealreal`, etc.): refactor of `const acc = withDecryptedTokens(account); ...acc.X` → reassigning `account = withDecryptedTokens(account); ...account.X`. No semantic change.
- `queue/scheduler-loop.ts`: package reads `crosslister.scheduler.tickIntervalMs` and `crosslister.scheduler.batchPullSize` from platform_settings (web hardcoded both as constants). Package wins on the platform_settings rule.
- `services/queue-settings-loader.ts`: web mirror's file header literally said "Mirror of packages/crosslister/src/services/queue-settings-loader.ts". Now obsolete.
- `types.ts`: package re-exports `ExternalChannel`/`Channel` from `@twicely/db/channel-types` (single source of truth, breaks finance↔crosslister circular dep).
- 3 package-only files: `queries.ts`, `services/publish-service-helpers.ts`, `slug.ts`.
- **One typecheck regression caught at flip time**: `apps/web/src/lib/queries/crosslister.ts` had `import type ... from '../crosslister/db-types'` (relative path that broke when the mirror was deleted). Updated to `@twicely/crosslister/db-types`.

**Tier 4 commerce findings (multiple regressions surfaced):**
The commerce mirror was the most diverged tree (84 source files differ + 13 package-only files). Pattern:
*Package wins on newer features:*
- `dispute-queries.ts`: package has Decision #92 Post-Release Claim Recovery Waterfall (recover from seller available + reserved before platform absorption). Web mirror lacked this entirely — production was refunding from platform without attempting seller clawback.
- `create-order.ts`: package has SEC-001 live price lookup (uses live `listing.priceCents` from locked listing instead of stale cart price), preventing price manipulation. Package also has auth-fee qualification gating.
- `offer-queries.ts`: package extends buyer selection to include `completedPurchaseCount`, `createdAt`, `emailVerified`, `phoneVerified`.
- `order-completion.ts`: package adds `recordBoostAttribution` call (D2.4).
- `returns-types.ts`: package adds `getSellerResponseDeadlineHour()` reading from platform_settings.
- 13 package-only files: `address-types.ts`, `boost-attribution.ts`, `browsing-history-helpers.ts`, `buyer-block.ts`, `combined-shipping.ts`, `dispute-recovery.ts`, `local-token-types.ts`, `local-transaction-types.ts`, `personalization-signals.ts`, `tax-threshold-tracker.ts`, `watcher-offers-validation.ts`, plus `dispute-recovery.test.ts` and `offer-notifications.test.ts`. Web mirror was stale.

*Web wins on platform_settings reads & concurrency guards (restored to package):*
- `create-order.ts`: web had `commerce.order.maxItemsPerOrder` cap check; package had hardcoded the value out. **Restored.**
- `performance-band.ts`: web had `score.trendModifierMax` + `score.trendDampeningFactor` reads; package hardcoded `0.05` and `0.5`. **Restored.**
- `offer-create.ts`: web had `commerce.offer.enabled` kill switch; package removed it. **Restored.**
- `offer-transitions.ts`: web had `commerce.offer.counterOfferEnabled` kill switch + `eq(listingOffer.status, 'PENDING')` AND-conditions in all 3 update WHERE clauses (`declineOffer`, `cancelOffer`, `expireOffer`) + `if (!updated) return ...` guards. Package removed all of them — concurrency regression. **Restored all.**
- `offer-engine.ts`: web had `.for('update')` row-level lock on `listingOffer` row in `acceptOffer` transaction to prevent double-accept race. Package removed it. **Restored** (also fixed the offer-engine.test.ts mock setup which the package had simplified to match).
- `order-cancel.ts`: web had `commerce.cancel.buyerWindowHours` enforcement (buyers can only cancel within configurable window after `paidAt`). Package removed it AND removed `paidAt`/`createdAt` from the SELECT. **Restored both.**
- `seller-score-compute.ts`: web had `commerce.seller.defaultOnTimeShippingPct` read; package hardcoded `100`. **Restored.**

**Tier 4 notifications findings:**
- Package had `templates-authentication.ts` (G10.2 AI authentication: authenticated/counterfeit/inconclusive) and `templates-accounting.ts` (G10.3 accounting sync completed/failed) that the web mirror lacked entirely. Package wins.
- Package's `templates-types.ts` had 5 new TemplateKey entries (`auth.ai.*`, `accounting.sync.*`) that the web mirror lacked. Package wins.
- Package's `templates.ts` spread in the two new template groups; web mirror did not. Package wins.
- `service.tsx` in web vs `service.ts` in package — no actual JSX (only a comment referencing lazy-loaded email components). Package `.ts` extension wins.
- All 15 notifier/template files had only import-path drift (`@twicely/notifications/X` → `./X`).
- `followed-seller-notifier.ts` existed only in web — promoted to `packages/notifications/src/` with `./service` relative import. Web consumers (`listings-create.ts`, 2 test files) updated to `@twicely/notifications/followed-seller-notifier`.
- `staff-notification-links.ts` existed only in web and returns app-specific hub routes (`/hd`, `/mod`, `/tx`) — moved to `apps/web/src/components/header/` (co-located with its only consumer `HubNotificationDropdown.tsx`) rather than the package.

**Tier 4 stripe findings (critical):**
- `packages/stripe/src/webhook-idempotency.ts` was the canonical — had SEC-022 fail-CLOSED on DB error to prevent double-processing. The web mirror was failing OPEN (returning false on error), meaning if both Valkey and DB were down, Stripe webhooks could double-charge. Package wins.
- `packages/stripe/src/payouts.ts` had SEC-016 minimum 2-day delay enforcement (`Math.max(2, options.delayDays)`) that the web mirror lacked. Package won on enforcement but had HARDCODED delayDays defaults (2); web mirror had the correct `getPlatformSetting('commerce.payout.delayDays', 2)` read. Merged both into package.
- `packages/stripe/src/chargebacks.ts` had a hardcoded `7 * 24 * 60 * 60 * 1000` chargeback deadline; web mirror read `commerce.dispute.chargebackDeadlineDays` from platform_settings. Merged web's settings read into package.
- `packages/stripe/src/subscription-webhooks.ts` used modern `@twicely/subscriptions/{queries,mutations,apply-pending-downgrade}` paths and passed `stripe.subscriptions.update` as a dependency-inject parameter to `applyPendingDowngradeIfNeeded`; web mirror used old `@/lib/*` paths. Package wins.
- All remaining stripe files had only import-path drift (`@twicely/stripe/X` vs `./X`) and CRLF/LF line endings — package wins (relative imports required once consolidated, LF normalized).
- `apps/web/src/lib/__tests__/helpers/stripe-mocks.ts` stays in the web tree — it's still imported by `apps/web/src/lib/actions/__tests__/create-subscription-checkout.test.ts`. The package has its own byte-identical copy at `packages/stripe/src/__tests__/helpers/stripe-mocks.ts`.

**Tier 3 security findings (critical):**
- `packages/casl/src/authorize.ts` was missing G10.8 staff impersonation + H1 banned-user blocking that the web mirror had. Production was broken; tests validated the correct mirror. Promoted web→package.
- `packages/casl/src/ability.ts`, `buyer-abilities.ts`, `platform-abilities.ts`, `staff-abilities.ts` had MORE CASL permissions (EnforcementAction appeals, AccountingIntegration, Chargeback/Hold reads) than the web mirror. Package wins — web tests were validating without these permissions (false-negative gate).
- `packages/auth/src/server.ts` has SEC-036 24h sessions + A3 60-second cookie cache for ban propagation. Web mirror had the OLD 5-minute cache. Package wins.
- `packages/auth/src/client.ts` was missing explicit `baseURL` that the web mirror had. Promoted web→package (prevents auth failures behind reverse proxy).
- `@twicely/db/queries` vitest alias intentionally kept pointing at `apps/web/src/lib/queries` (NOT `packages/db/src/queries`) — 182 existing tests mock `@/lib/queries/platform-settings` and would all break if the alias flipped. The two files are kept in sync.

Only 2 files remain in `apps/web/src/lib/auth/` (actions.ts and extension-auth.ts — Next.js-specific server actions that can't live in the pure package). apps/web/src/lib/db/ keeps only `seed.ts` and `seed/` for the `pnpm db:seed` entry point.
