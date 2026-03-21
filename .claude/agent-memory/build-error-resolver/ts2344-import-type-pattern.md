---
name: TS2344 import type as function constraint
description: Fixing TS2344 when a test helper parameter is typed as Awaited<ReturnType<typeof import(...)>>
type: feedback
---

## TS2344: `typeof import(...)` does not satisfy `(...args: any) => any`

**Error:**
```
error TS2344: Type 'typeof import("...")' does not satisfy the constraint '(...args: any) => any'.
```

**Root cause:** `typeof import('@/lib/db')` returns the module namespace type, not a callable. Using it inside `Awaited<ReturnType<...>>` is invalid because `ReturnType<T>` requires `T` to be callable.

**Fix:** Use `import type { db as DbType } from '@/lib/db'` at the top of the test file, then type the parameter as `typeof DbType`. Since `db` is exported as `export const db = drizzle(client)`, `typeof DbType` gives the Drizzle database instance type — exactly what the helper needs. The `import type` is erased at runtime and does not conflict with `vi.mock('@/lib/db', ...)`.

**Pattern:**
```ts
// WRONG — causes TS2344
function helper(db: Awaited<ReturnType<typeof import('@/lib/db')>>['db']) { ... }

// CORRECT
import type { db as DbType } from '@/lib/db';
function helper(db: typeof DbType) { ... }
```

**File affected:** `src/lib/jobs/__tests__/account-deletion-executor-edge.test.ts`
