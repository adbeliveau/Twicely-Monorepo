---
name: Crosslister & Automation Architecture
description: Detailed architecture notes for crosslister (E2.1-F5) and automation (F6/F6.1) - all complete
type: reference
---

## Crosslister Architecture (Phases E2.1/F1/F2/F3)
- E2.1 COMPLETE: connector interface (10 required + 2 optional methods), channel/connector registries, types, seed
- crosslister.ts: 233 lines, 9 tables. channelEnum (9 values) + 6 status/type enums.
- CASL: CrosslisterAccount, ChannelProjection, CrossJob, ImportBatch, AutomationSetting all in subjects.ts
- Delegation: crosslister.read/publish/import/manage all in staff-abilities.ts
- 40+ platform settings seeded in seed-crosslister.ts
- Channel tiers: A (eBay, Etsy), B (Mercari, Depop, FB, Grailed), C (Poshmark, TheRealReal)
- Launch channels: eBay, Poshmark, Mercari only (others disabled via feature flags)
- Connectors self-register via side-effect import barrel at connectors/index.ts
- normalizer-dispatch.ts: switch on channel -> call platform-specific normalizer
- F1: eBay import complete. eBay OAuth 2.0 Auth Code Grant. `firstImportCompletedAt` enforces one-time free import.
- F2: Poshmark (Tier C, SESSION auth) + Mercari (Tier B, OAUTH). Requires genericizing F1 eBay-hardcoded code first.
- F3: Outbound publishing pipeline. 4 services (transform, meter, policy, publish), 4 actions, 5 UI components.
  - Publish metering: derived from crossJob COUNT (no separate counter). Calendar month reset (UTC).
  - Dual feature flag check: platformSetting (primary) + featureFlag (secondary, skip if not seeded).
  - Delists/syncs don't consume publishes. No fees on off-platform sales (Decision #31).
  - Inline execution (no BullMQ); scheduler is F3.1. Rollover is F4.
- Decision #16/#17: imports ACTIVE immediately, free flywheel, no insertion fees
- Decision #31: no fees on off-platform sales (crosslisting subscription-funded)
- Key deferrals: pHash, category mapping, Centrifugo (polling), image download (store URLs), token encryption
- F3.1: Async BullMQ queue + worker. Refactors inline publish to enqueue pattern.
  - CRITICAL enum mismatch: Lister Canonical uses PENDING/SCHEDULED/RUNNING/DEAD_LETTERED/CANCELLED but actual enums.ts has PENDING/QUEUED/IN_PROGRESS/COMPLETED/FAILED/CANCELED. Always use actual enum.
  - Similarly jobType: Canonical uses PUBLISH/IMPORT/etc but actual enum has CREATE/UPDATE/DELIST/RELIST/SYNC/VERIFY.
  - Worker runs in-process (Railway single container), init via instrumentation.ts
  - Rate limiter V1 is in-memory (Valkey-backed is Phase G)
  - cancelJobSchema already exists in validations/crosslister.ts but action not implemented (placeholder `void cancelJobSchema`)
  - Existing BullMQ factory in src/lib/jobs/queue.ts (createQueue, createWorker)
- F4: Lister subscriptions. Publish credit ledger, rollover, overage packs, FREE activation. 102 tests.
- F5-S1: Adaptive polling engine. poll-budget, poll-scheduler, poll-executor, rate-limiter. 112 tests.
- F5-S2: Off-platform revenue ledger. postOffPlatformSale, revenue-by-platform query, P&L integration. 16 tests.
- F5-Teaser: Free lister teaser. 6-month FREE tier with auto-downgrade cron.
- F6+F6.1: IMPLEMENTED 2026-03-08. 92 tests. Automation add-on subscription + 4 engines.
- F6-FIX: Install prompt written 2026-03-08. 5 compliance fixes (auth, feature flags, retry, circuit breaker, follow engine).

## Automation Architecture (F6/F6.1)
- automationSetting table ALREADY EXISTS in crosslister.ts (Section 12.9) — all columns present
- automationSubscription table ALREADY EXISTS in identity.ts
- sellerProfile.hasAutomation boolean ALREADY EXISTS — toggled by upsertAutomationSubscription()
- updateAutomationSettingsSchema ALREADY EXISTS in validations/crosslister.ts with .strict()
- CASL rules for AutomationSetting ALREADY EXIST in ability.ts + staff-abilities.ts
- Platform settings ALREADY SEEDED: automation.pricing.*, automation.actionsPerMonth, automation.overagePackSize
- ConnectorCapabilities type ALREADY has canAutoRelist, canMakeOffers, canShare booleans
- PlatformConnector interface has 10 required + 2 optional methods (buildAuthUrl, registerWebhook/handleWebhook)
- F6 adds 3 more optional methods: relistListing?, sendOfferToLikers?, shareListing?
- Automation gate: requires ListerTier LITE or PRO (FREE/NONE NOT eligible) per Lister Canonical Section 17.3
- Automation metering: 2000 actions/month FLAT (not per ListerTier). Read from automation.actionsPerMonth.
- Auto-relist does NOT consume publish credits (relists/syncs/delists never count as publishes)
- Poshmark is Tier C (session automation) — requires explicit risk acknowledgment (Section 16.3)
- Auto-reprice (Store Power+ market intelligence) vs auto price drops (Automation add-on time-based) = different features
- Lister Canonical Section 8.1: Automation priority = 700 (lowest before metrics at 900)
- crossJob payload.automationEngine differentiates automation jobs from manual publish jobs
- F6-FIX gaps found: page uses auth.api.getSession not authorize(), no per-platform feature flag check,
  maxAttempts defaults to 3 (should be 2 per Lister Canonical §24.2), no per-seller circuit breaker,
  missing follow/unfollow engine (Lister Canonical §16.3 Mode 3)
- Posh follow/unfollow shares `poshShareEnabled` toggle (Mode 3 toggle covers all Posh automation)
- Automation worker was missing markCompleted helper — only had markInProgress and markFailed
- `automation.{platform}.enabled` keys use lowercase platform names (e.g., `automation.fb_marketplace.enabled`)
