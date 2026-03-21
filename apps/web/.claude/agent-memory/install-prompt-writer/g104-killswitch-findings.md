---
name: G10.4 Kill Switch + Launch Gates Findings
description: Existing E4 feature flag infrastructure state, Valkey integration gaps, and kill switch spec details
type: project
---

## G10.4 Kill Switch + Launch Gates -- Code Audit Findings (2026-03-16)

### Existing E4 Infrastructure
- `featureFlag` table: id, key, name, description, type(BOOLEAN/PERCENTAGE/TARGETED), enabled, percentage, targetingJson, createdByStaffId, timestamps
- `feature-flag-table.tsx` already has `isKillSwitch = (key) => key.startsWith('kill.')` and red bg treatment for kill.* rows
- `isFeatureEnabled()` at `src/lib/services/feature-flags.ts` -- NO Valkey cache yet, direct DB reads only
- Comment in service file: "Valkey caching is a future optimization -- not in E4"
- Only consumer of `isFeatureEnabled()`: crosslister publish-service.ts (connector flag checks)
- No tests exist for `feature-flags.ts` service or `admin-feature-flags.ts` actions

### Valkey Client State
- No shared Valkey client module exists at `src/lib/cache/`
- BullMQ queue.ts uses its own connection (likely `REDIS_URL` env)
- rate-limiter.ts in crosslister uses Valkey
- automation-circuit-breaker.ts uses Valkey
- Installer will need to either find existing Valkey singleton or create one

### CASL State
- FeatureFlag subject in subjects.ts (line 26)
- DEVELOPER role: can('read', 'FeatureFlag') + can('update', 'FeatureFlag') -- CAN toggle but CANNOT create/delete
- ADMIN: can('manage', 'all') -- full access
- No additional CASL changes needed for G10.4

### Spec Sources for Kill Switch
- Feature Lock-in Section 38: mentions "Kill Switch section: critical flags that can disable features instantly"
- Feature Lock-in Section 38: Valkey cache with 30-second TTL specified
- Build tracker: "V2 has `killswitch.ts` + `launchGates.ts`. Panic-button system to instantly disable features in prod."
- No specific decisions in Decision Rationale doc about kill switches

### Spec Gaps
- No canonical lists which features should have kill switches
- No canonical describes launch gates at all (only V2 reference in build tracker)
- No canonical specifies whether app code should enforce kill switch checks
- Feature Lock-in specifies cache TTL but not cache key format
