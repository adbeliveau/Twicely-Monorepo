# Install Prompt: F4-S1 — Publish Credit Rollover System

**Phase & Step:** `[F4-S1]`
**One-line Summary:** Create `publish_credit_ledger` table, implement rollover-manager with FIFO consumption, update publish-meter to use credit ledger, deprecate `crosslister.publishLimit.*` keys.

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — §6.2 (XLister pricing, publish limits, rollover rules), §6.4 (platform settings keys)
2. `TWICELY_V3_SCHEMA_v2_0_7.md` — §3.2 (`lister_subscription` table)
3. `TWICELY_V3_LISTER_CANONICAL.md` — §7.3 (publish limits by ListerTier, rollover rules)
4. `TWICELY_V3_DECISION_RATIONALE.md` — §77 (XLister three tiers with LITE)
5. `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` — §7.5 (XLister settings), §7.10 (overage packs)

---

## 0. PREREQUISITES

Run these checks BEFORE writing any code:

```bash
# Verify lister_subscription table exists
grep -n "lister_subscription\|listerSubscription" src/lib/db/schema/subscriptions.ts | head -10

# Verify listerTierEnum exists with correct values
grep -n "listerTierEnum\|lister_tier" src/lib/db/schema/enums.ts | head -5

# Verify publish-meter exists and has rollover TODO
grep -n "rollover" src/lib/crosslister/services/publish-meter.ts

# Verify platform settings keys exist
grep -n "xlister.publishes\|crosslister.publishLimit" src/lib/db/seed/*.ts

# Verify current test count
npx vitest run 2>&1 | tail -3
```

Record the test baseline. All tests must still pass at end.

---

## 1. SCOPE — EXACTLY WHAT TO BUILD

### 1.1 New Schema: `publish_credit_ledger` table

```typescript
export const creditTypeEnum = pgEnum('credit_type', ['MONTHLY', 'OVERAGE', 'BONUS']);

export const publishCreditLedger = pgTable('publish_credit_ledger', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  creditType:      creditTypeEnum('credit_type').notNull(),
  totalCredits:    integer('total_credits').notNull(),
  usedCredits:     integer('used_credits').notNull().default(0),
  expiresAt:       timestamp('expires_at', { withTimezone: true }).notNull(),
  periodStart:     timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:       timestamp('period_end', { withTimezone: true }).notNull(),
  listerSubscriptionId: text('lister_subscription_id').references(() => listerSubscription.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userExpiresIdx:  index('pcl_user_expires').on(table.userId, table.expiresAt),
  subIdx:          index('pcl_sub').on(table.listerSubscriptionId),
}));
```

Key design decisions:
- `userId` NOT `sellerId` — ownership via userId per User Model §5
- `listerSubscriptionId` nullable FK — MONTHLY credits reference subscription; OVERAGE credits may be null
- No `updatedAt` — ledger rows are append-mostly, only `usedCredits` gets updated
- `expiresAt` is the FIFO key — soonest-to-expire consumed first
- FREE tier credits: `expiresAt = periodEnd` (no rollover — expires at month end)
- LITE/PRO tier credits: `expiresAt = createdAt + 60 days`, capped at `3 × monthlyLimit`

### 1.2 Rollover Manager

New file: `src/lib/crosslister/services/rollover-manager.ts`

NOT a 'use server' file. Plain TypeScript module.

```typescript
// ─── Public API ─────────────────────────────────────────────────────────

// Add monthly credits when billing period renews
export async function addMonthlyCredits(
  userId: string,
  tier: ListerTier,
  periodStart: Date,
  periodEnd: Date,
  listerSubscriptionId: string,
): Promise<void>

// Add overage pack credits (expire at current period end)
export async function addOverageCredits(
  userId: string,
  quantity: number,
  periodEnd: Date,
): Promise<void>

// Get total available credits (monthly + rollover, excluding expired)
export async function getAvailableCredits(
  userId: string,
): Promise<{ total: number; breakdown: CreditBucket[] }>

// Consume N credits in soonest-to-expire order
export async function consumeCredits(
  userId: string,
  count: number,
): Promise<boolean>  // false if insufficient

// Forfeit excess credits on downgrade (keep up to newMaxStockpile)
export async function forfeitExcessRollover(
  userId: string,
  newMaxStockpile: number,
): Promise<number>  // returns forfeited count

// Forfeit all credits on cancel/downgrade to FREE/NONE
export async function forfeitAllCredits(
  userId: string,
): Promise<number>  // returns forfeited count
```

Implementation rules:

**addMonthlyCredits:**
- Read `xlister.publishes.{TIER}` from platform_settings for monthly limit
- Read `xlister.rolloverMaxMultiplier` from platform_settings (default: 3)
- Compute `maxStockpile = monthlyLimit × rolloverMaxMultiplier`
- Get current total via `getAvailableCredits`
- If `current.total + monthlyLimit > maxStockpile`, cap the new entry's `totalCredits` so total doesn't exceed maxStockpile
- FREE tier: `expiresAt = periodEnd` (no rollover)
- LITE/PRO tier: `expiresAt = NOW() + rolloverDays` (read `xlister.rolloverDays`, default: 60)
- Insert `publishCreditLedger` row with `creditType: 'MONTHLY'`

**addOverageCredits:**
- Insert row with `creditType: 'OVERAGE'`, `expiresAt: periodEnd`
- No stockpile cap on overage credits

**getAvailableCredits:**
- Query: `WHERE userId = ? AND expiresAt > NOW() AND usedCredits < totalCredits`
- Order by `expiresAt ASC` (soonest-to-expire first)
- Return breakdown array + total remaining

**consumeCredits:**
- In a transaction: lock rows `FOR UPDATE`, consume soonest-to-expire first
- Update `usedCredits` on each row until `count` is satisfied
- Return false if total remaining < count (no partial consumption)

**forfeitExcessRollover:**
- Get all non-expired credit rows ordered by `expiresAt DESC` (newest first — keep newest, forfeit oldest)
- Compute how many credits to keep (`newMaxStockpile`)
- Set `usedCredits = totalCredits` on excess rows (marks them fully consumed)
- Return total forfeited

**forfeitAllCredits:**
- Set `usedCredits = totalCredits` on ALL non-expired rows for this user
- Return total forfeited

### 1.3 Update Publish Meter

Modify: `src/lib/crosslister/services/publish-meter.ts`

Replace the current implementation that reads `crosslister.publishLimit.*` and returns `rolloverBalance: 0`.

New implementation:
- Call `getAvailableCredits(userId)` from rollover-manager
- Derive `rolloverBalance` = credits from previous periods still valid (creditType MONTHLY where periodStart < start of current billing period, or creditType OVERAGE)
- `remaining` = total available from credit ledger
- `usedThisMonth` = current period's MONTHLY credits used (totalCredits - remaining for current period bucket)
- `monthlyLimit` = read from `xlister.publishes.{TIER}` platform setting

**CRITICAL:** `canPublish(userId, count)` must now call `getAvailableCredits` and check `total >= count`. Do NOT still count crossJob rows.

### 1.4 Deprecate `crosslister.publishLimit.*` Keys

The publish-meter currently reads from `crosslister.publishLimit.free`, `crosslister.publishLimit.lite`, `crosslister.publishLimit.pro`. The Pricing Canonical §6.4 specifies `xlister.publishes.FREE`, `xlister.publishes.LITE`, `xlister.publishes.PRO`.

- Update publish-meter to read from `xlister.publishes.*` keys
- In seed file, mark `crosslister.publishLimit.*` entries with label suffix `(DEPRECATED — use xlister.publishes.*)` but do NOT delete them (backward compatibility for any existing data)

---

## 2. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/lib/db/schema/crosslister-credits.ts` | ~50 | `publishCreditLedger` table + `creditTypeEnum` |
| 2 | `src/lib/crosslister/services/rollover-manager.ts` | ~250 | All rollover credit operations |
| 3 | `src/lib/crosslister/services/__tests__/rollover-manager.test.ts` | ~280 | 15+ tests for rollover manager |
| 4 | `src/lib/crosslister/services/__tests__/publish-meter-rollover.test.ts` | ~250 | 25+ tests for updated publish meter |

### Modified Files

| # | File | Change |
|---|------|--------|
| 5 | `src/lib/db/schema/index.ts` | Export `publishCreditLedger` and `creditTypeEnum` |
| 6 | `src/lib/crosslister/services/publish-meter.ts` | Replace hardcoded rollover:0, use credit ledger, read xlister.publishes.* |
| 7 | `src/lib/db/seed/seed-crosslister.ts` | Mark crosslister.publishLimit.* as deprecated in labels |

### Migration

| # | File | Description |
|---|------|-------------|
| 8 | `src/lib/db/migrations/XXXX_publish_credit_ledger.ts` | Create table + enum + indexes |

---

## 3. CONSTRAINTS

### DO NOT:
- Create a 'use server' file for rollover-manager — it's a plain module imported by server actions and webhooks
- Export helper functions from 'use server' files
- Use `sellerProfileId` on the credit ledger — use `userId`
- Hardcode publish limits — read from `xlister.publishes.*` platform settings
- Hardcode rollover days or max multiplier — read from `xlister.rolloverDays` and `xlister.rolloverMaxMultiplier`
- Count crossJob rows for usage — usage comes from the credit ledger exclusively
- Use floats for credit arithmetic — integer only
- Create files over 300 lines — split if needed

### Banned Terms:
- NO `SellerTier` / `SubscriptionTier` — use `ListerTier`
- NO `PLUS` / `MAX` — use `LITE` / `PRO`
- NO `FVF` — use `TF`
- NO `Redis` — use `Valkey`
- NO `crosslister.publishLimit.*` in NEW code — use `xlister.publishes.*`

---

## 4. TEST REQUIREMENTS

### rollover-manager.test.ts (~15 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | addMonthlyCredits creates ledger entry for LITE | totalCredits: 200, creditType: MONTHLY |
| 2 | addMonthlyCredits creates ledger entry for PRO | totalCredits: 2000 |
| 3 | addMonthlyCredits caps at max stockpile (3x) | LITE with 500 existing → only 100 added (cap 600) |
| 4 | addMonthlyCredits for FREE sets expiresAt = periodEnd | No 60-day rollover |
| 5 | addMonthlyCredits for LITE sets expiresAt = now + 60 days | Rollover enabled |
| 6 | addOverageCredits creates entry with periodEnd expiry | creditType: OVERAGE, expiresAt: periodEnd |
| 7 | getAvailableCredits excludes expired rows | Expired rows not counted |
| 8 | getAvailableCredits returns correct breakdown | Array of CreditBucket objects |
| 9 | consumeCredits uses soonest-to-expire first | Row with earliest expiresAt consumed first |
| 10 | consumeCredits across multiple buckets | Spans two rows correctly |
| 11 | consumeCredits returns false when insufficient | No partial consumption |
| 12 | forfeitExcessRollover on PRO→LITE downgrade | Forfeits excess above 600 |
| 13 | forfeitAllCredits marks all rows consumed | usedCredits = totalCredits for all rows |
| 14 | rollover days read from platform_settings | Not hardcoded |
| 15 | max multiplier read from platform_settings | Not hardcoded |

### publish-meter-rollover.test.ts (~25 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | NONE tier returns 0 for everything | remaining: 0, rolloverBalance: 0 |
| 2 | FREE tier with no credits returns monthlyLimit: 25 | From xlister.publishes.FREE |
| 3 | FREE tier with credits returns correct remaining | No rollover balance |
| 4 | LITE tier with only monthly credits | remaining: 200, rolloverBalance: 0 |
| 5 | LITE tier with monthly + rollover | remaining: 200 + rollover, rolloverBalance > 0 |
| 6 | PRO tier correct limits | monthlyLimit: 2000 |
| 7 | canPublish returns true when credits available | Checks credit ledger |
| 8 | canPublish returns false when no credits | NONE tier or depleted |
| 9 | canPublish returns true when rollover covers request | Monthly depleted but rollover available |
| 10 | Monthly limit from platform_settings, not hardcoded | Verify setting key: xlister.publishes.LITE |
| 11-25 | Edge cases: exactly at limit, one credit left, expired rollover excluded, overage credits counted, multiple periods of rollover | Various |

---

## 5. GUARDRAILS

1. DO NOT wire rollover into webhooks yet — that's F4-S2
2. DO NOT build the overage pack purchase action — that's F4-S3
3. DO NOT build any UI components — that's F4-S4
4. DO NOT modify subscription-webhooks.ts — that's F4-S2
5. DO NOT modify import-service.ts — that's F4-S2
6. The rollover-manager is a library module — it has no server action boundary
7. All platform_settings reads must use the existing `getSetting()` helper
8. Credit ledger rows are never deleted — forfeiture sets `usedCredits = totalCredits`
9. `consumeCredits` must use `SELECT ... FOR UPDATE` inside a transaction for concurrency safety
10. The `expiresAt` column is the FIFO sort key — ORDER BY `expiresAt ASC` (soonest-to-expire first, NOT oldest-created first)

---

## 6. VERIFICATION

```bash
# TypeScript
pnpm typecheck                    # 0 errors

# Tests
pnpm test                         # baseline + ~40 new tests

# File sizes
wc -l src/lib/db/schema/crosslister-credits.ts \
      src/lib/crosslister/services/rollover-manager.ts \
      src/lib/crosslister/services/__tests__/rollover-manager.test.ts \
      src/lib/crosslister/services/__tests__/publish-meter-rollover.test.ts
# ALL under 300 lines

# Banned terms
grep -rn "SellerTier\|SubscriptionTier\|crosslister\.publishLimit" \
  src/lib/crosslister/services/rollover-manager.ts \
  src/lib/crosslister/services/publish-meter.ts \
  src/lib/db/schema/crosslister-credits.ts
# Should be 0

# Verify platform settings keys used
grep -rn "xlister\.publishes" src/lib/crosslister/services/publish-meter.ts
# Should find reads for FREE, LITE, PRO

# Verify no crossJob counting for usage
grep -rn "crossJob\|cross_job" src/lib/crosslister/services/publish-meter.ts
# Should be 0 (usage now comes from credit ledger)
```

**Stop and report after verification. Do not proceed to F4-S2.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_F4_S1_ROLLOVER_CREDIT_SYSTEM.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md (§6)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md (§7.3)

Execute all tasks in order. Do NOT skip Task 0 (prerequisite check). Stop and report after running verification.
```
