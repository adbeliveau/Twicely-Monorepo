---
name: G10.5 Feature Flag Client Context Findings
description: Findings from analyzing G10.5 feature flag client context scope, existing code, and spec details
type: project
---

## G10.5 Feature Flag Client Context -- Key Findings

### Canonical Basis
- Feature Lock-in Section 38: "Client-side: flags fetched on page load via API, cached in React context."
- Build tracker: "V2 has `FeatureFlagContext` with `{ enabled, isLoading }`. V3 flags are admin-only -- no client consumption."
- No Page Registry entry for `/api/flags` -- it's a new API route.
- No Decision Rationale entries for feature flag client consumption.

### Existing Code Inventory
- `src/lib/services/feature-flags.ts` (276 lines) -- server-side evaluation engine with Valkey cache. Has `isFeatureEnabled()`, `isKillSwitchActive()`, `isLaunchGateOpen()`.
- `src/lib/cache/valkey.ts` (56 lines) -- Valkey client singleton.
- `src/lib/actions/admin-feature-flags.ts` (204 lines) -- admin CRUD actions.
- `src/lib/queries/admin-feature-flags.ts` (105 lines) -- admin queries.
- `src/app/(hub)/flags/page.tsx` (78 lines) -- admin page.
- `src/lib/actions/admin-feature-flag-schemas.ts` (38 lines) -- Zod schemas.
- No existing `api/flags` or `api/feature-flags` route.
- No `useFeatureFlag` hook or `FeatureFlagContext`.
- Only existing React context in codebase: `src/components/Can.tsx` (CASL AbilityContext).
- Only existing custom hook: `src/hooks/use-camera-support.ts`.
- Test pattern: pure-logic extraction (no `renderHook` from `@testing-library/react` anywhere in codebase).

### Design Decisions Made in Prompt
- API route at `/api/flags` (GET) -- no CASL gate, optional auth for userId.
- Returns only `Record<string, boolean>` -- never raw flag metadata.
- `FeatureFlagProvider` in root layout via `Providers` wrapper.
- `useFeatureFlag(key)` returns `{ enabled, isLoading }` matching V2 API.
- `getEvaluatedFlags()` server helper for SSR pre-population.
- No polling, no WebSocket -- flags refresh on page navigation.
- `Cache-Control: private, max-age=30` matches Valkey TTL.

### Size Estimate
- 6 new files + 1 modified, ~28 new tests.
