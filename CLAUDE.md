# Twicely Monorepo — Build Instructions

## What This Is

Turborepo monorepo for Twicely, a peer-to-peer resale marketplace. Converted from a single Next.js app.

## Status: ALL PHASES COMPLETE

Phases A–I complete. Monorepo conversion done. All features built. Audit-clean.

- TypeScript: 24/24 packages pass
- Tests: 23/23 packages pass, 12210+ tests green
- Audit: 11/11 streams clean (0 blockers, 0 warnings)
- Duplicate-tree consolidation: Tier 0 + Tier 1 done (7 trees, 38 mirror files removed)

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
- 12,210+ tests must pass (baseline)
- **Never add files to `apps/web/src/lib/X` for trees that have been consolidated.** All shared code lives in `packages/X/src`. See `memory/project_duplicate_tree_consolidation.md` for the live status table.

BASELINE_TESTS=12210

## Duplicate-tree consolidation status

| Status | Trees |
|---|---|
| Done | shipping (deleted), realtime, email, scoring, config, finance, utils |
| Pending Tier 2 | storage, subscriptions, search |
| Pending Tier 3 (HIGH RISK) | auth, casl, db |
| Pending Tier 4 | stripe, notifications, commerce |
| Pending Tier 5 | crosslister, jobs |

Old `BASELINE_TESTS=13443` was inflated by ~1,233 ghost duplicate runs from mirror trees. The 12210 count is the honest unique-test total verified by line-counting `it()` blocks across kept and deleted test files.
