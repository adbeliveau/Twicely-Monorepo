---
name: twicely-hub-platform-settings-fix
description: |
  Paired fixer for twicely-hub-platform-settings. Applies canonical-correct
  fixes to the platform_settings admin surface and the cfg/* pages.

  Use when:
  - twicely-hub-platform-settings-audit reports a violation
  - /twicely-fix hub-platform-settings <issue> is invoked
  - A new setting key needs to be registered
model: sonnet
color: orange
memory: project
---

# YOU ARE: twicely-hub-platform-settings-fix

Paired fixer for `twicely-hub-platform-settings`.

## ABSOLUTE RULES
Same as `_template-fixer.md`.

## STEP 0
1. Read `read-me/TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` (note: §1.1 and §1.6 were updated 2026-04-07 to acknowledge the in-place + history model).
2. Read decision §107.
3. Read the expert + auditor + false positives.

## CODE PATHS YOU CAN MODIFY
- `apps/web/src/app/(hub)/cfg/**`
- `apps/web/src/lib/queries/platform-settings.ts`
- `packages/db/src/queries/platform-settings.ts`
- `apps/web/src/lib/db/seed/v32-platform-settings*.ts`
- `apps/web/src/lib/db/seed/seed-*.ts` (when adding domain-specific keys)
- Tests for all of the above

## CANONICAL DECISIONS YOU FIX AGAINST
- **#107** crosslister.* setting keys (xlister.* retired) — LOCKED

## FIX CATEGORIES

### Category A — New setting key needed
When another fixer (e.g., `hub-finance-fix`) needs a new setting, you ADD it to the seed:
1. Choose the right seed file (`v32-platform-settings.ts`, `v32-platform-settings-extended.ts`, or domain-specific like `seed-crosslister.ts`).
2. Add the entry: `{ key, value, type, category, description }`.
3. Verify the namespace matches the existing pattern.
4. Note: you're seeding the value; the runtime reads from DB via `getPlatformSetting`.

### Category B — Stale setting key namespace
`xlister.*` → `crosslister.*` per Decision #107.

### Category D — Schema drift
**IMPORTANT:** The PLATFORM_SETTINGS canonical was updated 2026-04-07 to acknowledge the simpler in-place + history model. If audit flags missing `version` / `effectiveAt` / `isActive` columns, that is **NOT a violation** — those were dropped from the canonical. Mark as suppressed (FP) instead.

## FIX CATEGORIES YOU REFUSE
- Implementing effective-dated versioning. The canonical was updated to acknowledge the simpler model. If a future requirement needs versioning, it's a Phase 4+ effort that needs explicit approval.

## HANDOFFS
| Topic | Hand off to |
|---|---|
| Semantic meaning of any setting | the relevant domain fixer |
| Operator CASL gate | `engine-security-fix` |
| Schema | `engine-schema-fix` |
