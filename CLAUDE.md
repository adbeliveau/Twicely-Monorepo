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

BASELINE_TESTS=11769

## Duplicate-tree consolidation status

| Status | Trees |
|---|---|
| Done | shipping (deleted), realtime, email, scoring, config, finance, utils, storage, subscriptions, search, auth, casl, db (schema/index only) |
| Pending Tier 4 | stripe, notifications, commerce |
| Pending Tier 5 | crosslister, jobs |

Old `BASELINE_TESTS=13443` was inflated by ~1,674 ghost duplicate runs from mirror trees. The 11769 count is the honest unique-test total verified by line-counting `it()` blocks across kept and deleted test files. (Tier 0+1: 1,233; Tier 2: 167; Tier 3: 274.)

**Tier 3 security findings (critical):**
- `packages/casl/src/authorize.ts` was missing G10.8 staff impersonation + H1 banned-user blocking that the web mirror had. Production was broken; tests validated the correct mirror. Promoted web→package.
- `packages/casl/src/ability.ts`, `buyer-abilities.ts`, `platform-abilities.ts`, `staff-abilities.ts` had MORE CASL permissions (EnforcementAction appeals, AccountingIntegration, Chargeback/Hold reads) than the web mirror. Package wins — web tests were validating without these permissions (false-negative gate).
- `packages/auth/src/server.ts` has SEC-036 24h sessions + A3 60-second cookie cache for ban propagation. Web mirror had the OLD 5-minute cache. Package wins.
- `packages/auth/src/client.ts` was missing explicit `baseURL` that the web mirror had. Promoted web→package (prevents auth failures behind reverse proxy).
- `@twicely/db/queries` vitest alias intentionally kept pointing at `apps/web/src/lib/queries` (NOT `packages/db/src/queries`) — 182 existing tests mock `@/lib/queries/platform-settings` and would all break if the alias flipped. The two files are kept in sync.

Only 2 files remain in `apps/web/src/lib/auth/` (actions.ts and extension-auth.ts — Next.js-specific server actions that can't live in the pure package). apps/web/src/lib/db/ keeps only `seed.ts` and `seed/` for the `pnpm db:seed` entry point.
