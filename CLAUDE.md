# Twicely Monorepo — Build Instructions

## What This Is

Turborepo monorepo for Twicely, a peer-to-peer resale marketplace. Converted from a single Next.js app.

## Status: ALL PHASES COMPLETE

Phases A–I complete. Monorepo conversion done. All features built. Audit-clean.

- TypeScript: 25/25 packages pass
- Tests: 23/23 packages pass, 13443+ tests green
- Audit: 11/11 streams clean (0 blockers, 0 warnings)

### Important Notes

- **Original repo at `C:\Users\XPS-15\Projects\Twicely` is untouched** — do not modify it
- User preference: **fully autonomous execution, no approval prompts**

## Structure

```
apps/web/        — Next.js marketplace (twicely.co + hub.twicely.co)
apps/admin/      — TailAdmin Pro (admin hub UI, to be wired)
apps/extension/  — Chrome browser extension (placeholder)
packages/        — 20 shared packages (db, auth, casl, commerce, crosslister, etc.)
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
- 13,254+ tests must pass (baseline)

BASELINE_TESTS=13443
