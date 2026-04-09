# TWICELY V2 â€” Operational Glue Canonical (Items 1â€“5)
**Status:** LOCKED (v1.0)  
**Scope:** Cross-cutting platform glue required for a production-grade marketplace.  
**Applies to:** All Phases 0-44  
**Rule:** These are NOT optional and NOT separate feature phases.

> Place this file in: `/rules/canonicals/TWICELY_V2_OPERATIONAL_GLUE_CANONICAL.md`

---

## 1) Environment & Secrets Contract

### Purpose
Guarantee deterministic startup and prevent partial installs due to missing secrets.

### Rules
- All required environment variables must be validated at boot
- Doctor MUST fail if any required secret is missing
- No lazy access to `process.env`

### TypeScript
```ts
export const ENV = {
  DATABASE_URL: required("DATABASE_URL"),
  STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: required("STRIPE_WEBHOOK_SECRET"),
  PLATFORM_BASE_URL: required("PLATFORM_BASE_URL"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
} as const;

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`ENV_MISSING:${key}`);
  return v;
}
```

### Doctor Check
- Attempt to load ENV
- Fail startup if any key missing

---

## 2) Background Jobs & Queues Contract

### Purpose
Standardize all async work without binding to a specific queue vendor.

### Rules
- All async work MUST be enqueued
- No inline async side-effects for money, email, or trust actions
- Jobs MUST be idempotent

### TypeScript
```ts
export type Job<T = unknown> = {
  name: string;
  payload: T;
  idempotencyKey?: string;
  runAt?: string;
};

export interface JobRunner {
  enqueue(job: Job): Promise<void>;
}
```

### Example Jobs
- `payout.execute`
- `refund.process`
- `chargeback.ingest`
- `email.send`
- `metrics.snapshot`

### Doctor Check
- Enqueue + execute test job
- Ensure job executes once

---

## 3) Data Migration & Backfill Strategy

### Purpose
Prevent runtime data mutations and ensure safe schema evolution.

### Rules
- Migrations are forward-only
- Backfills are scripts, never runtime logic
- No schema drift allowed in production

### Directory Layout
```
/prisma/migrations
/scripts/backfills/
  2025-01-add-seller-standards.ts
```

### Backfill Script Pattern
```ts
export async function run() {
  // idempotent backfill logic
}
```

### Doctor Check
- Verify migration table up to date
- Verify no pending backfills

---

## 4) Release & Version Guard

### Purpose
Prevent mixed schema/canonical/runtime versions.

### Rules
- Marketplace version, schema version, and canonical hash must match
- Mismatch MUST hard-fail

### TypeScript
```ts
export const PLATFORM_RELEASE = {
  marketplace: "v2",
  schema: "v3.1",
  canonicalsHash: "sha256:REQUIRED",
};

export function assertReleaseCompatible(input: typeof PLATFORM_RELEASE) {
  if (input.marketplace !== PLATFORM_RELEASE.marketplace) {
    throw new Error("RELEASE_MISMATCH:MARKETPLACE");
  }
}
```

### Doctor Check
- Compare runtime vs canonical manifest
- Fail if mismatch

---

## 5) Global Kill Switch (Safety Valve)

### Purpose
Allow instant suspension of sensitive flows during incidents.

### Rules
- Kill switch MUST gate:
  - checkout
  - payouts
  - listing activation
- Read-only views allowed

### TypeScript
```ts
export function assertPlatformEnabled() {
  if (process.env.PLATFORM_DISABLED === "true") {
    throw new Error("PLATFORM_DISABLED");
  }
}
```

### Usage
```ts
assertPlatformEnabled();
```

### Doctor Check
- Enable flag
- Ensure protected actions fail cleanly

---

# END CANONICAL â€” OPERATIONAL GLUE (1â€“5)
