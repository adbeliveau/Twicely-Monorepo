# Parallel Decomposer - Agent Memory

## Successful Decompositions

### Phase I — Admin Panel V2→V3 Port (2026-03-19)
- 17 steps decomposed into 4 parallel batches + 1 sequential final step
- Batch 1: 5 streams (I1, I2, I3, I5, I6) — all fully independent, no shared file touches
- Batch 2: 4 streams (I4, I7, I8, I9) — I4 depends on I3 finishing; I7/I8/I9 independent
- Batch 3: 4 streams (I10, I11, I12, I13) — all independent
- Batch 4: 2 streams (I14, I15) — I14 touches no shared files; I15 enriches cfg pages
- I16 is a sweep pass enriching pages from multiple streams — runs after batches 1-4
- I17 (admin-nav.ts) always runs last — collects nav entries from all prior steps
- See: phase-i-decomposition.md for full plan

## Dependency Patterns

### Hub Page Anatomy
- All hub pages use `staffAuthorize()` + `ability.can()` before any data fetch
- Pages import from `@/lib/queries/admin-*` for reads, `@/lib/actions/admin-*` for mutations
- CASL subjects in `src/lib/casl/subjects.ts` — new subjects rarely needed for Phase I (UI enrichment)
- `platform-abilities.ts` — rarely needs changes for Phase I (ADMIN has `manage 'all'`)

### Shared File Conflict Rules (Phase I specific)
- `admin-nav.ts` — owned ONLY by I17 (final merge step)
- `v32-platform-settings-extended.ts` — only needs changes if a step adds NEW platform_settings keys
  - Phase I steps are mostly UI enrichment — they READ settings, don't add new ones
  - Exception: I7 (Trust) and I15 (Settings) may add new keys
- `casl/subjects.ts` — only needs changes if a step introduces a wholly new domain subject
  - Phase I steps use existing subjects (Trust, Notification, Promotion, Analytics, etc.)
- `casl/platform-abilities.ts` — ADMIN already has `manage 'all'`; only non-admin roles need additions

### New Directory Pattern (Phase I)
Steps creating wholly new top-level routes (I7 /trust, I9 /promotions, I12 /bulk etc.):
- Create `src/app/(hub)/[route]/page.tsx` as new files
- Create `src/lib/queries/admin-[domain].ts` if no query file exists
- Create `src/lib/actions/admin-[domain].ts` if no action file exists
- These are safe to run in parallel (no existing files to conflict on)
