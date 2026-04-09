---
name: Settings layout nav — RESOLVED (2026-04-08)
description: settings/layout.tsx previously had a hardcoded inline nav array; now fixed to use SETTINGS_SUB_NAV from hub-nav.ts
type: project
---

RESOLVED as of the Phase A-E audit-remediation merge (commit cb87b89).

`apps/web/src/app/(hub)/my/settings/layout.tsx` now imports and renders `SETTINGS_SUB_NAV` (derived from the Settings section of `HUB_NAV` in `hub-nav.ts`). The previous hardcoded `SETTINGS_NAV` constant is gone.

**Why it matters:** Settings nav items are now config-driven. Any change to the Settings section in `hub-nav.ts` automatically propagates to the layout. R3 now PASSES for this file.

**How to apply:** Do not flag this as R3 FAIL going forward. If a future audit finds a new inline nav array in a layout file, open a new memory entry.
