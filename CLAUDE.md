# Twicely Monorepo — Build Instructions

## What This Is

Turborepo monorepo for Twicely, a peer-to-peer resale marketplace. Converted from a single Next.js app.

## Status: ALL PHASES COMPLETE

Phases A–I complete. Monorepo conversion done. All features built. Audit-clean.

- TypeScript: 24/24 packages pass
- Tests: 23/23 packages pass, 11769+ tests green
- Audit: 11/11 streams clean (0 blockers, 0 warnings)
- Duplicate-tree consolidation: Tier 0 + 1 + 2 + 3 done (13 trees consolidated, security layer fully merged)

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
- 12,043+ tests must pass (baseline)
- **Never add files to `apps/web/src/lib/X` for trees that have been consolidated.** All shared code lives in `packages/X/src`. See `memory/project_duplicate_tree_consolidation.md` for the live status table.

BASELINE_TESTS=11627

## Duplicate-tree consolidation status

| Status | Trees |
|---|---|
| Done | shipping (deleted), realtime, email, scoring, config, finance, utils, storage, subscriptions, search, auth, casl, db (schema/index only), stripe, notifications |
| Pending Tier 4 | commerce |
| Pending Tier 5 | crosslister, jobs |

Old `BASELINE_TESTS=13443` was inflated by ~1,816 ghost duplicate runs from mirror trees. The 11627 count is the honest unique-test total verified by line-counting `it()` blocks across kept and deleted test files. (Tier 0+1: 1,233; Tier 2: 167; Tier 3: 274; Tier 4 stripe: 109; Tier 4 notifications: 33.)

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
