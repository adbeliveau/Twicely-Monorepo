---
name: Hardcoded SETTINGS_NAV in settings/layout.tsx
description: settings/layout.tsx has a hardcoded inline nav array violating the config-driven nav rule (R3/Banned Terms)
type: project
---

`apps/web/src/app/(hub)/my/settings/layout.tsx` contains a `SETTINGS_NAV` constant at line 3 — a hardcoded 5-item nav array rendered directly in a layout file. This violates:
- Business Rule R3: Nav must be config-driven (never hardcoded in layouts)
- Canonical §3.4: All navigation must live in `hub-nav.ts`

**Why this matters:** When settings nav items are added or removed, there are now two places to update — `hub-nav.ts` Settings section AND this layout constant. They are already diverged: `hub-nav.ts` lacks `privacy`, the layout `SETTINGS_NAV` includes it (`/my/settings/privacy`).

**How to apply:** Flag as R3 FAIL on every audit until the settings layout is refactored to either (a) derive its secondary tab nav from `hub-nav.ts` Settings section items, or (b) receive a dedicated settings sub-nav config key.
