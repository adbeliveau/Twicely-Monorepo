# Install Prompt: F5-S1 — Sale Detection & Emergency Delist Pipeline

**Phase & Step:** `[F5-S1]`
**Depends on:** F3 (crosslist outbound), F3.1 (publish queue + scheduler)
**One-line Summary:** Detect off-platform sales (webhook + polling), mark listing SOLD, trigger emergency delists on all other platforms, verify delists, handle double-sell, notify seller via Centrifugo.

**Canonical Sources (READ BEFORE STARTING):**
1. `TWICELY_V3_LISTER_CANONICAL.md` — §12 (sale detection, emergency delists, double-sell), §13 (adaptive polling)
2. `TWICELY_V3_CANONICAL_HUB_ENFORCEMENT.md` — §2 (sale-triggered transitions)
3. `TWICELY_V3_LISTER_CANONICAL.md` — §4.3 (BullMQ queue: `lister:emergency-delist`), §8.2 (priority 0)
4. `TWICELY_V3_LISTER_CANONICAL.md` — §21 (Centrifugo events: `sale.detected`, `delist.completed`)

---

## 0. PREREQUISITES

```bash
# Verify crosslister infrastructure exists
ls src/lib/crosslister/connectors/ 2>/dev/null
ls src/lib/crosslister/services/scheduler.ts 2>/dev/null

# Verify BullMQ queues exist
grep -rn "lister:emergency-delist\|emergency.delist\|emergencyDelist" src/lib/ --include="*.ts" | head -5

# Verify channel projection schema
grep -n "channelProjection\|channel_projection" src/lib/db/schema/crosslister.ts | head -10

# Verify listing status enum includes SOLD
grep -n "SOLD\|listing_status" src/lib/db/schema/enums.ts | head -5

# Verify Centrifugo client exists
grep -rn "centrifugo\|publish.*channel" src/lib/ --include="*.ts" -l | head -5

# Verify notification system
grep -rn "notify\|createNotification" src/lib/notifications/ --include="*.ts" -l | head -5

# Read existing connector interface
head -50 src/lib/crosslister/connectors/types.ts 2>/dev/null || head -50 src/lib/crosslister/connectors/base.ts 2>/dev/null

# Test baseline
npx vitest run 2>&1 | tail -3
```

Record baseline. Read ALL existing crosslister infrastructure before writing code.

---

## 1. SCOPE — EXACTLY WHAT TO BUILD

### 1.1 Sale Detection Service

New file: `src/lib/crosslister/services/sale-detection.ts`

Central service that processes detected sales regardless of source (webhook or polling).

```typescript
export interface DetectedSale {
  listingId: string;           // Twicely canonical listing ID
  projectionId: string;        // channel_projection that sold
  channel: Channel;            // 'EBAY' | 'POSHMARK' | 'MERCARI' etc
  externalOrderId: string;     // Platform's order/transaction ID
  salePriceCents: number;      // Sale price in cents
  platformFeeCents: number;    // Platform's fee in cents (eBay ~12.9%, Posh 20%, Mercari 10%)
  buyerUsername?: string;      // External buyer identifier
  soldAt: Date;                // When the sale occurred
}

export async function handleDetectedSale(sale: DetectedSale): Promise<void>
```

**handleDetectedSale flow:**

1. **Idempotency check** — query `listing` for existing sale with same `externalOrderId`. If already processed, skip.

2. **Double-sell check** — if `listing.status` is already `SOLD`:
   - Flag as `POTENTIAL_DOUBLE_SELL` (store on listing or separate tracking)
   - Notify seller immediately: "⚠️ {item} may have sold on both {channel1} and {channel2}. Please cancel one sale."
   - Do NOT create emergency delists (already running from first sale)
   - Return early

3. **Mark listing SOLD:**
   ```typescript
   await db.update(listing).set({
     status: 'SOLD',
     soldOnChannel: sale.channel,
     soldAt: sale.soldAt,
     soldPriceCents: sale.salePriceCents,
     updatedAt: new Date(),
   }).where(eq(listing.id, sale.listingId));
   ```

4. **Update selling projection** — mark the projection that sold:
   ```typescript
   await db.update(channelProjection).set({
     status: 'SOLD',
     updatedAt: new Date(),
   }).where(eq(channelProjection.id, sale.projectionId));
   ```

5. **Create emergency delist jobs** for ALL other ACTIVE projections:
   ```typescript
   const activeProjections = await db.select()
     .from(channelProjection)
     .where(and(
       eq(channelProjection.listingId, sale.listingId),
       eq(channelProjection.status, 'ACTIVE'),
       ne(channelProjection.id, sale.projectionId),  // exclude the one that sold
     ));

   for (const proj of activeProjections) {
     await emergencyDelistQueue.add('emergency-delist', {
       projectionId: proj.id,
       listingId: sale.listingId,
       channel: proj.channel,
       reason: 'SALE_DETECTED',
       sourceChannel: sale.channel,
       sourceSaleId: sale.externalOrderId,
     }, {
       priority: 0,  // highest — jump queue
       attempts: 3,
       backoff: { type: 'exponential', delay: 2000 },
     });
   }
   ```

6. **Notify seller** via Centrifugo + in-app notification:
   - Centrifugo event: `sale.detected` on channel `private-user.{sellerId}`
   - Payload: `{ listingId, channel, salePriceCents, delistingPlatforms: [channels] }`
   - In-app notification via existing `notify()` system

### 1.2 Emergency Delist Worker

New file: `src/lib/crosslister/workers/emergency-delist-worker.ts`

BullMQ worker for the `lister:emergency-delist` queue.

```typescript
export function createEmergencyDelistWorker(): Worker
```

**Worker flow per job:**

1. Load projection from DB
2. If projection status is already DELISTED or ENDED → skip (idempotent)
3. Load connector for the projection's channel
4. Call `connector.delistListing(projection.externalListingId)`
5. On success:
   - Update projection: `status = 'DELISTED', lastDelistedAt = now()`
   - Check if ALL projections for this listing are now non-ACTIVE
   - If all done → emit Centrifugo `delist.completed` event
6. On failure:
   - BullMQ retries (3 attempts, exponential backoff)
   - After final failure: projection status → `DELIST_FAILED`
   - Notify seller: "Could not delist {item} from {platform}. Please delist manually."

**Queue setup:**

```typescript
const emergencyDelistQueue = new Queue('lister:emergency-delist', {
  connection: valkey,
  defaultJobOptions: {
    priority: 0,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400 },    // keep 24h
    removeOnFail: { age: 604800 },        // keep 7d
  },
});
```

### 1.3 Webhook Sale Handler (eBay)

New file: `src/lib/crosslister/handlers/sale-webhook-handler.ts`

Processes incoming webhooks from platforms that support them (eBay, Etsy).

```typescript
export async function handleEbaySaleWebhook(payload: EbayOrderNotification): Promise<void>
```

**Flow:**
1. Extract `externalOrderId`, `externalListingId`, `salePriceCents` from webhook payload
2. Look up `channelProjection` by `channel = 'EBAY'` + `externalListingId`
3. If not found → log warning and skip (might be a listing not managed by Twicely)
4. Compute `platformFeeCents` from platform settings: `crosslister.fees.ebay.rateBps` (default: 1290 = 12.9%)
5. Call `handleDetectedSale({ ... })`

**IMPORTANT:** Different platforms have different webhook formats. The handler must normalize to `DetectedSale` shape. For V3 launch, implement eBay handler. Poshmark/Mercari use polling (no webhooks).

### 1.4 Polling Sale Parser

New file: `src/lib/crosslister/handlers/sale-polling-handler.ts`

For platforms without webhooks (Poshmark, Mercari, Depop), the adaptive polling engine detects sales by comparing current platform state to last known state.

```typescript
export async function parsePollResult(
  projection: ChannelProjection,
  currentState: ExternalListingState,
): Promise<void>
```

**Flow:**
1. If `currentState.status === 'SOLD'` and `projection.status === 'ACTIVE'`:
   - Extract sale data from `currentState`
   - Compute `platformFeeCents` based on channel fee rate from platform_settings
   - Call `handleDetectedSale({ ... })`
2. If `currentState.status === 'ENDED'` and `projection.status === 'ACTIVE'`:
   - Seller ended on platform directly — update projection status, notify seller
   - Do NOT mark listing as SOLD (it was ended, not sold)

### 1.5 Platform Fee Rates

Fee rates stored in platform_settings, NOT hardcoded:

```
crosslister.fees.ebay.rateBps: 1290         // 12.9% (eBay FVF + payment processing)
crosslister.fees.poshmark.rateBps: 2000     // 20% flat
crosslister.fees.mercari.rateBps: 1000      // 10%
crosslister.fees.depop.rateBps: 1000        // 10%
crosslister.fees.etsy.rateBps: 1300         // 13% (listing + transaction + payment)
crosslister.fees.facebook.rateBps: 500      // 5%
```

Helper function:
```typescript
export async function getPlatformFeeRate(channel: Channel): Promise<number>  // returns bps

export function calculatePlatformFee(salePriceCents: number, feeRateBps: number): number {
  return Math.round(salePriceCents * feeRateBps / 10000);
}
```

### 1.6 Double-Sell Tracking

Add fields to listing (or use a separate tracking mechanism):

Check if these already exist on the listing table:
- `soldOnChannel` — which channel the sale was detected on
- `soldAt` — when the sale occurred
- `soldPriceCents` — actual sale price

If not, they need to be added via migration. Check the schema doc first.

For double-sell tracking, create a lightweight table or use an audit event:

```typescript
// Option A: audit_event with type DOUBLE_SELL_DETECTED
// Option B: field on listing: doubleSellDetectedAt, doubleSellChannels
```

**Recommendation:** Use `audit_event` with `type: 'DOUBLE_SELL_DETECTED'` and metadata containing both channels. No schema change needed.

### 1.7 Delist Verification Jobs

After emergency delists complete, queue a VERIFICATION job to confirm:

```typescript
// Queued 60 seconds after delist success
await verificationQueue.add('verify-delist', {
  projectionId: proj.id,
  expectedStatus: 'DELISTED',
}, {
  priority: 100,
  delay: 60000,  // verify after 60s
});
```

The verification worker (likely already exists from F3) polls the platform to confirm the listing is actually removed. If still active → retry delist.

---

## 2. FILE MANIFEST

### New Files

| # | File | ~Lines | Description |
|---|------|--------|-------------|
| 1 | `src/lib/crosslister/services/sale-detection.ts` | ~200 | Core sale detection service |
| 2 | `src/lib/crosslister/workers/emergency-delist-worker.ts` | ~150 | BullMQ worker for emergency delists |
| 3 | `src/lib/crosslister/handlers/sale-webhook-handler.ts` | ~100 | eBay webhook → DetectedSale normalization |
| 4 | `src/lib/crosslister/handlers/sale-polling-handler.ts` | ~80 | Polling result → DetectedSale normalization |
| 5 | `src/lib/crosslister/services/platform-fees.ts` | ~60 | Platform fee rate lookup + calculation |
| 6 | `src/lib/crosslister/services/__tests__/sale-detection.test.ts` | ~280 | 15+ tests |
| 7 | `src/lib/crosslister/workers/__tests__/emergency-delist-worker.test.ts` | ~200 | 10+ tests |
| 8 | `src/lib/crosslister/services/__tests__/platform-fees.test.ts` | ~80 | 5+ tests |

### Modified Files

| # | File | Change |
|---|------|--------|
| 9 | `src/lib/db/seed/seed-crosslister.ts` | Add platform fee rate settings |
| 10 | Webhook route (check existing structure) | Add eBay sale webhook routing |
| 11 | Polling worker (if exists) | Wire `parsePollResult` into poll cycle |

### Migration (if needed)

| # | File | Description |
|---|------|-------------|
| 12 | `src/lib/db/migrations/XXXX_listing_sold_fields.ts` | Add `soldOnChannel`, `soldAt`, `soldPriceCents` if not already on listing table |

---

## 3. CONSTRAINTS

### DO NOT:
- Build new connectors — use existing connector.delistListing() from F3
- Build the adaptive polling engine — it exists from F3.1
- Build auto-cancel on external platforms — seller must cancel manually (Lister Canonical §12.3)
- Charge fees on off-platform sales — data is informational only (Decision Rationale §31)
- Create ledger entries in F5-S1 — that's F5-S2
- Build a double-sell resolution UI — just flag and notify
- Hardcode platform fee rates — read from platform_settings

### Queue rules:
- Emergency delist priority is 0 (highest) — ALWAYS preempts other jobs
- Emergency delist queue is `lister:emergency-delist` (separate from `lister:publish`)
- 3 retry attempts with exponential backoff (2s, 4s, 8s)
- After final failure: DELIST_FAILED status, seller notified to delist manually

### Idempotency:
- `handleDetectedSale` checks for existing sale by `externalOrderId` before processing
- Emergency delist worker checks projection status before executing
- Webhook handler skips projections not managed by Twicely

---

## 4. TEST REQUIREMENTS

### sale-detection.test.ts (~15 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Sale detected → listing status becomes SOLD | status: SOLD, soldOnChannel set |
| 2 | Sale detected → selling projection status becomes SOLD | projection.status: SOLD |
| 3 | Sale detected → emergency delist jobs created for other ACTIVE projections | 1 job per active projection |
| 4 | Sale detected → no delist job for the sold projection itself | Excluded from delist batch |
| 5 | Sale detected → no delist job for already DELISTED projections | Only ACTIVE ones |
| 6 | Duplicate sale (same externalOrderId) is idempotent | No duplicate processing |
| 7 | Double-sell detected when listing already SOLD | POTENTIAL_DOUBLE_SELL flagged |
| 8 | Double-sell does NOT create new delist jobs | Delists already running |
| 9 | Seller notified on sale detection | notify() called |
| 10 | Centrifugo event emitted: sale.detected | Correct channel and payload |
| 11 | Listing with no other projections → no delist jobs | Only notification |
| 12 | Platform fee calculated correctly for eBay (12.9%) | Math verification |
| 13 | Platform fee calculated correctly for Poshmark (20%) | Math verification |
| 14 | Sale with missing projection → graceful skip | No crash |
| 15 | soldPriceCents stored as integer cents | Not float |

### emergency-delist-worker.test.ts (~10 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Successful delist → projection DELISTED | status updated |
| 2 | All projections delisted → delist.completed event | Centrifugo emitted |
| 3 | Already DELISTED projection → skip (idempotent) | No connector call |
| 4 | Connector failure → job retried | BullMQ retry |
| 5 | 3 failures → DELIST_FAILED + seller notified | Final failure handling |
| 6 | Verification job queued after successful delist | 60s delay |
| 7 | Priority 0 on job options | Verified in queue.add call |
| 8 | Job metadata includes sourceChannel and reason | Correct metadata |
| 9 | Projection for different listing ID → correct isolation | No cross-contamination |
| 10 | Delist on Tier C platform (session) → same flow | No special handling |

### platform-fees.test.ts (~5 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | eBay fee rate from settings: 1290 bps | 12.9% |
| 2 | Poshmark fee rate: 2000 bps | 20% |
| 3 | calculatePlatformFee($100, 1290 bps) = $12.90 | 1290 cents |
| 4 | calculatePlatformFee($15.50, 2000 bps) = $3.10 | 310 cents |
| 5 | Unknown channel returns default rate | Graceful fallback |

---

## 5. VERIFICATION

```bash
pnpm typecheck                    # 0 errors
pnpm test                         # baseline + ~30 new tests

wc -l src/lib/crosslister/services/sale-detection.ts \
      src/lib/crosslister/workers/emergency-delist-worker.ts \
      src/lib/crosslister/handlers/sale-webhook-handler.ts \
      src/lib/crosslister/handlers/sale-polling-handler.ts \
      src/lib/crosslister/services/platform-fees.ts
# ALL under 300 lines

grep -rn "as any\|@ts-ignore\|SellerTier\|FVF" \
  src/lib/crosslister/services/sale-detection.ts \
  src/lib/crosslister/workers/emergency-delist-worker.ts \
  src/lib/crosslister/services/platform-fees.ts
# Should be 0

grep -rn "handleDetectedSale" src/lib/crosslister/ --include="*.ts" | head -5
# Should find usage in webhook handler + polling handler
```

**Stop and report after verification. Do not proceed to F5-S2.**

---

## LAUNCHER

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_F5_S1_SALE_DETECTION_EMERGENCY_DELIST.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md (§12, §13)
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_CANONICAL_HUB_ENFORCEMENT.md (§2)

F3 and F3.1 must be complete. Read ALL existing crosslister infrastructure in Task 0 before writing code. Execute all tasks in order. Stop and report after running verification.
```
