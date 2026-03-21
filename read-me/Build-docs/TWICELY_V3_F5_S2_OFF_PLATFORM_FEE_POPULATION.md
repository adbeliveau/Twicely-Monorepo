# Install Prompt: F5-S2 — Off-Platform Revenue & Fee Auto-Population

**Phase & Step:** `[F5-S2]` (= Build Sequence F5.1)
**Depends on:** F5-S1 (sale detection service with `handleDetectedSale`)
**One-line Summary:** When a sale is detected on an external platform, auto-create ledger entries for off-platform revenue and platform fees, wire into Financial Center dashboard for cross-platform P&L.

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` — §5 (posting rules), §6 (KPI formulas), §12.5 (cross-platform revenue)
2. `TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md` — §2 (auto-populated data), §5 (event taxonomy: `crosslister.sale_detected`)
3. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — Decision §31 (no fees on off-platform sales)
4. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — §9 (financial tracking, revenue by platform)

---

## 0. PREREQUISITES

```bash
# Verify F5-S1 is complete
grep -n "handleDetectedSale" src/lib/crosslister/services/sale-detection.ts | head -3
grep -n "platformFeeCents\|salePriceCents" src/lib/crosslister/services/sale-detection.ts | head -5

# Verify ledger entry system exists
grep -n "ledgerEntryTypeEnum\|ledger_entry_type" src/lib/db/schema/enums.ts | head -5
grep -rn "createLedgerEntry\|insertLedgerEntry\|postLedgerEntries" src/lib/ --include="*.ts" -l | head -5

# Verify existing ledger entry types
grep -A 50 "ledgerEntryTypeEnum" src/lib/db/schema/enums.ts | head -60

# Verify Financial Center dashboard queries
grep -rn "grossRevenue\|revenueByPlatform\|crosslister.*sale\|offPlatform" src/lib/ --include="*.ts" | head -10

# Verify platform fee helper from F5-S1
grep -n "calculatePlatformFee\|getPlatformFeeRate" src/lib/crosslister/services/platform-fees.ts | head -5

# Test baseline
npx vitest run 2>&1 | tail -3
```

---

## 1. SCOPE — EXACTLY WHAT TO BUILD

### 1.1 New Ledger Entry Types

Add to `ledgerEntryTypeEnum` if not already present:

```
CROSSLISTER_SALE_REVENUE        // +salePriceCents (informational — not Twicely revenue)
CROSSLISTER_PLATFORM_FEE        // -platformFeeCents (informational — eBay/Posh/Mercari fee)
```

**CRITICAL:** These entries are INFORMATIONAL ONLY. They do NOT affect `sellerBalance.availableCents`. Off-platform sales are not processed through Twicely's payment system. The ledger entries exist for:
- Financial Center P&L accuracy (revenue by platform)
- Tax reporting (total sales across all platforms)
- Cross-platform fee comparison

The `amountCents` field stores the value but the posting rules do NOT update `sellerBalance`. This is the same pattern as `STORE_SUBSCRIPTION_CHARGE` which is tracked but doesn't reduce marketplace balance (Finance Engine Canonical §5.7).

### 1.2 Posting Function: Off-Platform Sale

New file: `src/lib/finance/post-off-platform-sale.ts`

```typescript
export async function postOffPlatformSale(params: {
  userId: string;
  listingId: string;
  channel: Channel;
  externalOrderId: string;
  salePriceCents: number;
  platformFeeCents: number;
  soldAt: Date;
}): Promise<void>
```

**Posts two ledger entries in a single transaction:**

1. `CROSSLISTER_SALE_REVENUE` — positive `salePriceCents`
   - idempotencyKey: `xsale:{externalOrderId}:revenue`
   - metadata: `{ channel, externalOrderId, listingId }`
   - channel field: set to the platform enum value

2. `CROSSLISTER_PLATFORM_FEE` — negative `platformFeeCents`
   - idempotencyKey: `xsale:{externalOrderId}:fee`
   - metadata: `{ channel, externalOrderId, feeRateBps, listingId }`
   - channel field: set to the platform enum value

**Idempotency:** Both entries use `ON CONFLICT (idempotencyKey) DO NOTHING`. Safe for webhook/polling retries.

**DO NOT update `sellerBalance`.** These are informational entries.

### 1.3 Wire into Sale Detection

Modify: `src/lib/crosslister/services/sale-detection.ts`

After step 4 (update selling projection) in `handleDetectedSale`, add:

```typescript
// Step 4.5: Post off-platform sale to financial ledger
// Need to resolve userId from listing.sellerId
const userId = listing.sellerId;  // or however sellerId is stored
await postOffPlatformSale({
  userId,
  listingId: sale.listingId,
  channel: sale.channel,
  externalOrderId: sale.externalOrderId,
  salePriceCents: sale.salePriceCents,
  platformFeeCents: sale.platformFeeCents,
  soldAt: sale.soldAt,
});
```

**IMPORTANT:** If the sale is on Twicely (not off-platform), DO NOT post these entries. Twicely sales already create `ORDER_PAYMENT_CAPTURED` and `ORDER_TF_FEE` entries via the existing commerce engine. Add a guard:

```typescript
if (sale.channel !== 'TWICELY') {
  await postOffPlatformSale({ ... });
}
```

### 1.4 Financial Center Query Updates

Modify the Financial Center queries to include off-platform revenue.

Find the existing query files (from the D4 audit: `finance-center.ts`, `finance-center-reports.ts`) and update:

**Gross Revenue** should now include:
```sql
SUM(CASE WHEN type = 'ORDER_PAYMENT_CAPTURED' THEN amountCents ELSE 0 END)
  + SUM(CASE WHEN type = 'CROSSLISTER_SALE_REVENUE' THEN amountCents ELSE 0 END)
```

**Revenue by Platform** (new or updated query):
```typescript
export async function getRevenueByPlatform(userId: string, startDate: Date, endDate: Date): Promise<PlatformRevenue[]>
```

Returns:
```typescript
interface PlatformRevenue {
  channel: string;         // 'TWICELY' | 'EBAY' | 'POSHMARK' | 'MERCARI' etc
  revenueCents: number;    // gross sales
  feesCents: number;       // platform fees
  netCents: number;        // revenue - fees
  orderCount: number;
}
```

Query groups ledger entries by `channel` field:
- `TWICELY`: `ORDER_PAYMENT_CAPTURED` + `ORDER_TF_FEE` + `ORDER_STRIPE_PROCESSING_FEE`
- `EBAY`: `CROSSLISTER_SALE_REVENUE` + `CROSSLISTER_PLATFORM_FEE` where channel = 'EBAY'
- etc.

**P&L Report Update:**
The existing P&L generation (`finance-center-reports.ts`) should already aggregate from ledger entries. Verify that adding new entry types automatically flows into the P&L. If the P&L hardcodes entry types to sum, update it to include `CROSSLISTER_SALE_REVENUE` and `CROSSLISTER_PLATFORM_FEE`.

### 1.5 Platform Revenue UI (if page exists)

Check if `/my/selling/finances/platforms` page exists. If not, create a minimal version.

The page shows:
- Revenue by platform bar chart
- Fee comparison table (Twicely 10% vs eBay 12.9% vs Poshmark 20%)
- Net after fees by platform
- "Twicely saves you $X compared to selling everything on [highest-fee platform]"

If the page doesn't exist, create it as a server page that calls `getRevenueByPlatform()` and renders a simple table + summary. Full chart components can be added later.

---

## 2. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/lib/finance/post-off-platform-sale.ts` | ~80 | Post CROSSLISTER_SALE_REVENUE + CROSSLISTER_PLATFORM_FEE entries |
| 2 | `src/lib/queries/revenue-by-platform.ts` | ~100 | Cross-platform revenue aggregation query |
| 3 | `src/lib/finance/__tests__/post-off-platform-sale.test.ts` | ~180 | 10+ tests |
| 4 | `src/lib/queries/__tests__/revenue-by-platform.test.ts` | ~120 | 5+ tests |

### Modified Files

| # | File | Change |
|---|------|--------|
| 5 | `src/lib/db/schema/enums.ts` | Add CROSSLISTER_SALE_REVENUE + CROSSLISTER_PLATFORM_FEE to ledgerEntryTypeEnum (if not present) |
| 6 | `src/lib/crosslister/services/sale-detection.ts` | Wire postOffPlatformSale after sale processing |
| 7 | Finance Center report queries (path TBD) | Include new entry types in revenue aggregation |
| 8 | `src/app/(hub)/my/selling/finances/platforms/page.tsx` (if missing) | Create or verify cross-platform revenue page |

### Migration (if enum change requires it)

| # | File | Description |
|---|------|-------------|
| 9 | `src/lib/db/migrations/XXXX_crosslister_ledger_types.ts` | Add new enum values to ledger_entry_type |

---

## 3. CONSTRAINTS

### DO NOT:
- Update `sellerBalance` for off-platform sales — entries are informational only
- Charge any Twicely fee on off-platform sales — Decision §31 is absolute
- Post off-platform entries for Twicely-native sales — those use existing ORDER_* entries
- Hardcode platform fee rates — use `getPlatformFeeRate()` from F5-S1
- Create new UI components for charts — use existing chart components or simple tables
- Build QuickBooks/Xero sync for off-platform data — G10.3 scope

### Ledger rules:
- Both entries posted in a single DB transaction
- Idempotency via `ON CONFLICT (idempotencyKey) DO NOTHING`
- `CROSSLISTER_SALE_REVENUE` is positive (seller received money on external platform)
- `CROSSLISTER_PLATFORM_FEE` is negative (platform took a cut)
- Neither entry changes `sellerBalance` — they're tracking-only
- `channel` field on ledger entry must be set to the platform enum

---

## 4. TEST REQUIREMENTS

### post-off-platform-sale.test.ts (~10 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | eBay sale creates 2 ledger entries | REVENUE + FEE |
| 2 | Revenue entry is positive salePriceCents | Correct sign |
| 3 | Fee entry is negative platformFeeCents | Correct sign |
| 4 | Idempotency: duplicate externalOrderId → no new entries | ON CONFLICT skip |
| 5 | Metadata includes channel and externalOrderId | Correct metadata |
| 6 | sellerBalance NOT updated | No balance change |
| 7 | Poshmark sale with 20% fee | Correct fee calculation |
| 8 | Both entries in same transaction | Atomic |
| 9 | Channel field set on both entries | channel = 'EBAY' etc |
| 10 | Twicely-native sale NOT posted as off-platform | Guard works |

### revenue-by-platform.test.ts (~5 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | No sales → empty array | Graceful |
| 2 | Twicely-only sales → one row with channel 'TWICELY' | Correct grouping |
| 3 | Mixed platform sales → rows per platform | Correct revenue/fee split |
| 4 | Date range filter works | Only includes entries in range |
| 5 | Net calculation = revenue - fees | Math correct |

---

## 5. VERIFICATION

```bash
pnpm typecheck                    # 0 errors
pnpm test                         # baseline + ~15 new tests

wc -l src/lib/finance/post-off-platform-sale.ts \
      src/lib/queries/revenue-by-platform.ts
# ALL under 300 lines

grep -rn "as any\|@ts-ignore\|SellerTier\|FVF\|Final Value Fee" \
  src/lib/finance/post-off-platform-sale.ts \
  src/lib/queries/revenue-by-platform.ts
# Should be 0

# Verify no sellerBalance update
grep -rn "sellerBalance\|availableCents.*update\|pendingCents.*update" \
  src/lib/finance/post-off-platform-sale.ts
# Should be 0

# Verify new ledger types exist
grep -n "CROSSLISTER_SALE_REVENUE\|CROSSLISTER_PLATFORM_FEE" src/lib/db/schema/enums.ts

# Verify wired into sale detection
grep -n "postOffPlatformSale" src/lib/crosslister/services/sale-detection.ts
```

**Stop and report after verification. F5 is complete when both S1 and S2 pass.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_F5_S2_OFF_PLATFORM_FEE_POPULATION.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCE_ENGINE_CANONICAL.md (§5, §6, §12.5)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md (§2, §5)

F5-S1 must be complete. Verify prerequisites in Task 0. Execute all tasks in order. Stop and report after running verification.
```
