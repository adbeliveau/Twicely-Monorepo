---
name: Schema table naming drift vs canonical spec
description: Canonical spec uses plural table names; implementation uses singular; this is intentional and consistent throughout
type: feedback
---

The canonical spec sketches use plural names (`crosslister_accounts`, `channel_projections`, `cross_jobs`, `import_batches`). The actual Drizzle schema at `packages/db/src/schema/crosslister.ts` uses singular names (`crosslister_account`, `channel_projection`, `cross_job`, `import_batch`).

**Why:** The monorepo uses a consistent singular-table convention throughout the entire schema (visible in `packages/db/src/schema/auth.ts`, `listings.ts`, etc.). The canonical spec was written before the schema convention was locked.

**How to apply:** Do not flag this as schema drift. It is a naming convention difference, not a missing table or field.
