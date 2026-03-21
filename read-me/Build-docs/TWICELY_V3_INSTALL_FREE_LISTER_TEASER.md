# TWICELY V3 — Install Prompt: FREE ListerTier Teaser

## READ FIRST

Before writing any code, read these files in full:
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md` — §6.1 (import), §7.3 (publish limits)
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — §6 (ListerTier pricing)
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md` — sellerProfile table
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_DECISION_RATIONALE.md` — entries #93 and #94

---

## Context

FREE ListerTier has been redefined. It is now a **time-limited teaser**: 5 publishes/month for 6 months from account creation, then auto-downgrades to NONE. Previously it was 25 publishes/month with no expiry.

This is not a Stripe subscription. Expiry is tracked via a single timestamp column on `sellerProfile`. A nightly BullMQ cron job handles downgrades.

---

## Files to Create or Modify

### 1. MODIFY — `src/lib/db/seed/v32-platform-settings.ts`

Change:
```
{ key: 'xlister.publishes.FREE', value: 25, ... }
```
To:
```
{ key: 'xlister.publishes.FREE', value: 5, type: 'number', category: 'xlister', description: 'Publishes/mo for FREE tier (time-limited teaser)' }
```

Add after the `xlister.publishes.FREE` entry:
```typescript
{ key: 'xlister.freeTierMonths', value: 6, type: 'number', category: 'xlister', description: 'Months a new seller has FREE ListerTier before downgrade to NONE' },
```

### 2. CREATE — `src/lib/db/migrations/XXXX_add_lister_free_expires_at.sql`

Migration adds `lister_free_expires_at` to `seller_profile` table:

```sql
ALTER TABLE seller_profile
  ADD COLUMN lister_free_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN seller_profile.lister_free_expires_at IS
  'When the FREE ListerTier teaser expires. NULL = never had FREE tier or already on paid tier. Set to createdAt + xlister.freeTierMonths on seller profile creation.';
```

### 3. MODIFY — `src/lib/db/schema/identity.ts`

Add column to `sellerProfile` Drizzle table definition:

```typescript
listerFreeExpiresAt: timestamp('lister_free_expires_at', { withTimezone: true }),
```

Place it after the `listerTier` column. Nullable (no `.notNull()`).

### 4. MODIFY — `src/lib/mutations/seller-profile.ts` (or wherever seller profile is created on signup)

When a new `sellerProfile` row is created, set `listerFreeExpiresAt`:

```typescript
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// Inside seller profile creation:
const freeTierMonths = await getPlatformSetting('xlister.freeTierMonths', 6);
const listerFreeExpiresAt = new Date(
  Date.now() + freeTierMonths * 30 * 24 * 60 * 60 * 1000
);

// Include in insert:
{ listerFreeExpiresAt }
```

**Rules:**
- Only set `listerFreeExpiresAt` on new accounts (createdAt = now). Do NOT backfill existing accounts.
- Existing accounts with `listerTier = 'FREE'` get `listerFreeExpiresAt = NULL` — the nightly job treats NULL + FREE as already-grandfathered (no auto-downgrade unless explicitly set).

### 5. CREATE — `src/lib/jobs/expire-free-lister-tier.ts`

BullMQ repeatable job. Runs nightly at 02:00 UTC.

```typescript
/**
 * Nightly job: downgrade sellers whose FREE ListerTier teaser has expired.
 * Spec: Decision Rationale #93
 *
 * Criteria: listerTier = 'FREE' AND listerFreeExpiresAt IS NOT NULL AND listerFreeExpiresAt < now()
 * Action: set listerTier = 'NONE', listerFreeExpiresAt = NULL
 *
 * Does NOT delist any projections. Does NOT cancel any Stripe subscription.
 * Seller retains all existing projections — they just can't create new publishes.
 */
```

**Requirements:**
- Query: `WHERE listerTier = 'FREE' AND listerFreeExpiresAt IS NOT NULL AND listerFreeExpiresAt < now()`
- Update: `SET listerTier = 'NONE', listerFreeExpiresAt = NULL, updatedAt = now()`
- Process in batches of 100 (use `limit(100)` loop until 0 rows returned)
- Log count of sellers downgraded per run: `logger.info('[expireFreeListerTier] Downgraded N sellers')`
- Do NOT throw on individual row failure — catch, log, continue batch
- Idempotent: running twice on same day is safe (already-downgraded rows won't match WHERE clause)

### 6. MODIFY — `src/lib/jobs/index.ts` (or wherever BullMQ repeatable jobs are registered)

Register the nightly job:

```typescript
await listerQueue.add(
  'expire-free-lister-tier',
  {},
  {
    repeat: { pattern: '0 2 * * *' }, // 02:00 UTC nightly
    jobId: 'expire-free-lister-tier', // Prevents duplicates
  }
);
```

### 7. CREATE — `src/lib/jobs/__tests__/expire-free-lister-tier.test.ts`

Minimum 8 tests:

1. Sellers with `listerTier = FREE` and `listerFreeExpiresAt < now()` → downgraded to NONE
2. Sellers with `listerTier = FREE` and `listerFreeExpiresAt > now()` → NOT downgraded
3. Sellers with `listerTier = FREE` and `listerFreeExpiresAt = NULL` → NOT downgraded (grandfathered)
4. Sellers with `listerTier = NONE` → NOT touched
5. Sellers with `listerTier = LITE` → NOT touched
6. Sellers with `listerTier = PRO` → NOT touched
7. Batch processing: 250 expired sellers → processed in 3 batches (100 + 100 + 50)
8. Individual row failure → logs error, continues batch, does not throw

---

## Verification Checklist

After implementation, run:

```bash
# 1. TypeScript
npx tsc --noEmit 2>&1 | head -20

# 2. Tests (must show increase, not decrease)
npx vitest run 2>&1 | tail -5

# 3. Confirm seed value changed
grep -n "xlister.publishes.FREE\|xlister.freeTierMonths" src/lib/db/seed/v32-platform-settings.ts

# 4. Confirm schema column exists
grep -n "listerFreeExpiresAt\|lister_free_expires_at" src/lib/db/schema/identity.ts

# 5. Confirm job registered
grep -rn "expire-free-lister-tier" src/lib/jobs/

# 6. Confirm no hardcoded 25 or 6 in job logic
grep -rn "25\|freeTierMonths" src/lib/jobs/expire-free-lister-tier.ts
```

---

## Rules

- No hardcoded values. `xlister.freeTierMonths` and `xlister.publishes.FREE` must be read from platform settings.
- Do NOT create a Stripe subscription for FREE tier. This is a timestamp-based expiry only.
- Do NOT delist projections on downgrade. NONE sellers keep their existing projections.
- Do NOT backfill `listerFreeExpiresAt` on existing accounts. Only new signups get the timestamp set.
- TypeScript strict: true. Zero `as any`. Zero `@ts-ignore`.
- File size limit: 300 lines max per file.
- Tests must increase. If current count is 3333, minimum after this prompt is 3341.

---

## Expected Output

```
TypeScript: 0 errors
Tests: 3341+ passing (was 3333, +8 new minimum)
xlister.publishes.FREE: 5 ✅
xlister.freeTierMonths: 6 ✅
listerFreeExpiresAt column: exists in schema ✅
Migration file: created ✅
Nightly job: registered ✅
```
