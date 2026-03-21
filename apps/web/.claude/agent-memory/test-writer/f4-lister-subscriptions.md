# F4 Lister Subscriptions — Test Patterns and Edge Cases

## Module Architecture

- `rollover-manager.ts` — no 'use server', plain TS module; called by `publish-meter.ts` and webhooks
- `publish-meter.ts` — calls `getAvailableCredits()` from `rollover-manager` (3 db.select calls total: tier, setting, credits)
- `lister-downgrade-warnings.ts` — pure function, no DB; circular import with `subscription-engine.ts`
- `purchase-overage-pack.ts` — 'use server' action; uses `authorize()` from `@/lib/casl`
- `checkout-webhooks.ts` — NOT 'use server'; called from API route after Stripe signature verification

## Mock Setup Patterns

### rollover-manager.ts mock (for tests that use it indirectly)
```typescript
const mockAddOverageCredits = vi.fn();
vi.mock('@/lib/crosslister/services/rollover-manager', () => ({
  addOverageCredits: (...args: unknown[]) => mockAddOverageCredits(...args),
  getAvailableCredits: vi.fn(),
  consumeCredits: vi.fn(),
}));
```

### Transaction mock for consumeCredits
`consumeCredits` runs inside `db.transaction()`. Mock with:
```typescript
const mockTxSelect = vi.fn();
const mockTxUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    ...otherMethods,
    transaction: vi.fn(async (fn) => fn({ select: mockTxSelect, update: mockTxUpdate })),
  },
}));
```
The `tx.select()` chain needs: `.from().where().orderBy().for('update')` resolving to rows array.

### getAvailableCredits select chain
The query ends at `.orderBy()` with no `.limit()` — use thenable pattern:
```typescript
function makeSelectChain(rows) {
  const chain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), ... };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.then = (resolve) => Promise.resolve(rows).then(resolve);
  return chain;
}
```

### checkout-webhooks.ts innerJoin
`handleOveragePackPurchase` uses `.innerJoin()` to join sellerProfile to listerSubscription.
The select chain must include `innerJoin`:
```typescript
chain.innerJoin = vi.fn().mockReturnValue(chain);
```

## Edge Cases

### addMonthlyCredits
- FREE tier: `expiresAt = periodEnd` (no rollover)
- LITE/PRO tier: `expiresAt = now + rolloverDays * 24h` (from platform_settings, fallback 60)
- Cap formula: `Math.max(0, Math.min(monthlyLimit, maxStockpile - currentTotal))`
- maxStockpile = monthlyLimit * rolloverMaxMultiplier (from settings, fallback 3)
- Returns immediately (no insert) when `creditsToAdd === 0`
- Requires 4 DB calls: 3 settings + 1 getAvailableCredits

### addOverageCredits
- `listerSubscriptionId: null` (no sub linkage)
- `expiresAt = periodEnd` (no rollover on overage credits)
- No stockpile cap on overage credits

### forfeitExcessRollover
- Queries in DESC order (newest first) — keeps newest, forfeits oldest
- Returns 0 without any DB update when `total <= newMaxStockpile`
- Partial row forfeit: `usedCredits = totalCredits - keepFromRow`

### consumeCredits
- Returns `false` immediately when insufficient (no partial consumption, no DB updates)
- FIFO: consumes soonest-to-expire first (ASC order in tx query)
- Uses SELECT FOR UPDATE (.for('update')) for concurrency safety

### Circular import: lister-downgrade-warnings ↔ subscription-engine
- Mock `@/lib/subscriptions/price-map` to prevent issues when subscription-engine loads
- price-map.ts itself has no side effects, but mocking prevents any future issues
- Do NOT need to mock subscription-engine itself — compareListerTiers is pure

### purchaseOveragePack — DB call order
1. `sellerProfile` by id (listerTier + stripeCustomerId)
2. `platformSetting` for price cents (fees.overage.publishPack.cents)
3. `platformSetting` for quantity (fees.overage.publishPack.quantity)

### checkout-webhooks — DB call order (overage_pack handler)
1. Select listerSubscription (inner join sellerProfile) by userId
2. Select publishCreditLedger for idempotency check (OVERAGE within 60s)

### handleCheckoutSessionCompleted behavior
- `userId: undefined` in metadata → logs error, returns (no DB calls)
- Unknown `type` in metadata → hits default case, logs info, returns
- Status PAST_DUE → logs error, returns (not ACTIVE or TRIALING)
- Duplicate: existing OVERAGE row within 60s → logs info, skips addOverageCredits

### Lister downgrade warnings — key rules
- Any tier → NONE: 1 critical warning about crosslisting (returns early)
- PRO → LITE: publish limit warning + optional rollover cap warning (if rollover > 600)
- LITE → FREE: publish limit warning + optional rollover forfeit warning (if rollover > 0) + AI features warning
- PRO → FREE: same as LITE→FREE but publish limit uses PRO numbers
- Upgrade or same tier: always returns [] (no warnings)

### ListerSubscriptionCard helpers (not exported — test as local functions)
- `meterColor(pct)`: `>90` → red, `>75` → amber, else → green
  - At exactly 75%: green (condition is `>75`, not `>=75`)
  - At exactly 90%: amber (condition is `>90`, not `>=90`)
- `usedPercent`: denominator is `monthlyLimit + rolloverBalance` (not just monthlyLimit)
- `isRunningLow`: `remaining / total < 0.2 AND remaining > 0` (exhausted is handled separately)
- `isExhausted`: `remaining === 0`
- `tierLabel`: FREE→"Free", LITE→"Lite", PRO→"Pro", else raw string
