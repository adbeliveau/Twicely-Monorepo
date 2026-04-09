---
name: Impersonation token TTL hardcoded
description: apps/web/src/app/api/hub/impersonation/start/route.ts line 161 hardcodes 15-minute TTL; no platform_settings key exists for it
type: project
---

`apps/web/src/app/api/hub/impersonation/start/route.ts:161` sets the impersonation token expiry as:

```ts
expiresAt: Date.now() + 15 * 60 * 1000,
```

This is a R5 violation — all session TTLs should come from `platform_settings`. There is no seed key for `general.impersonationTokenTtlMinutes` (or equivalent). The adjacent staff session TTL correctly reads `general.staffSessionAbsoluteHours` from platform_settings.

**Why:** The 15-minute window may need tuning (e.g., shorter for high-risk environments, longer for slow VPN setups). Hardcoding prevents admin override without a deploy.

**How to apply:** Flag as R5 DRIFT on every audit until a `general.impersonationTokenTtlMinutes` (seed default: 15) key is added and the route reads from it.
