# Twicely Monorepo — Build Instructions

## What This Is

Turborepo monorepo for Twicely, a peer-to-peer resale marketplace. Converted from a single Next.js app.

## Status: CONVERSION IN PROGRESS

Phase 0-1 complete (scaffold + file copy + import rewrites). Phase 2 next (typecheck + test verification).

### Next Steps

1. Run `npx turbo typecheck` — fix all TypeScript errors
2. Fix ~36 cross-package imports that still reference `@/lib/` (app-local modules)
3. Run `npx turbo test` — all 9,232 tests must pass
4. Wire `apps/admin` (TailAdmin) to share `@twicely/db`, `@twicely/auth`, `@twicely/casl`
5. Push to GitHub

### Important Notes

- **Original repo at `C:\Users\XPS-15\Projects\Twicely` is untouched** — do not modify it
- Source files were COPIED (not moved) — `apps/web/src/lib/` still has originals alongside package copies
- After tests pass, the duplicates in `apps/web/src/lib/` matching package contents should be removed
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
- 9,232 tests must pass (baseline)
