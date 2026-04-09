# V4 Install Phase 05 — Shipping Labels

**Status:** DRAFT (V4)
**Prereq:** Phase V4-04 complete, `npx turbo typecheck` green, `npx turbo test` green
**Canonical:** `rules/canonicals/06_SHIPPING_LABELS.md`
**Provider:** Shippo (`shippo` npm package, free tier; provider-agnostic abstraction)
**Estimated files:** ~22 new, ~8 modified

---

## 0) What this phase installs

### Backend
- `packages/shipping/` workspace package with provider abstraction layer
- `shippingLabel`, `shippingRate`, `shippingManifest` Drizzle tables + `labelStatusEnum`
- Provider interface + Shippo implementation (migrated from `apps/web/src/lib/shipping/shippo/`)
- Rate shopping service (multi-carrier, sorted, tagged)
- Label purchase/void/refund lifecycle with ledger integration
- Tracking webhook handler (idempotent, state machine enforced)
- Address validation service
- Return label generation
- Manifest batch shipping
- Shipment state machine

### Hub UI
- `(hub)/my/selling/orders/[id]/ship` -- Seller label purchase (rate comparison, buy, print)
- `(hub)/cfg/shipping/*` -- Admin shipping dashboard + exception queue

### Ops
- Health provider: `shipping_labels`
- Platform settings seed (15 keys)
- CASL permissions for ShippingLabel, ShippingRate, ShippingManifest

---

## 1) Schema (Drizzle)

### Step 1.1: Add labelStatusEnum

**Edit: `packages/db/src/schema/enums.ts`**

Add after the `shipmentStatusEnum` block:

```typescript
export const labelStatusEnum = pgEnum('label_status', [
  'PURCHASED', 'PRINTED', 'USED', 'VOID_PENDING', 'VOIDED', 'REFUNDED', 'EXPIRED', 'ERROR',
]);
```

### Step 1.2: Create schema file

**File: `packages/db/src/schema/shipping-labels.ts`**

Contains `shippingLabel`, `shippingRate`, and `shippingManifest` tables exactly as specified in Canonical 06 Sections 3.1, 3.2, and 3.3. Key columns:

- `shippingLabel`: provider-agnostic (provider, providerLabelId, providerRateId), full cost breakdown (rateCents, surchargesCents, totalCostCents, platformMarkupCents, platformDiscountCents, sellerPaidCents), idempotencyKey, insurance/signature options, manifest reference, return label support
- `shippingRate`: cached rate quotes with session grouping, delivery estimates, recommendation tags
- `shippingManifest`: batch manifest records per carrier/date

### Step 1.3: Add FK to shipment table

**Edit: `packages/db/src/schema/shipping.ts`**

Import `shippingLabel` from `./shipping-labels` and add:

```typescript
shippingLabelId: text('shipping_label_id').references(() => shippingLabel.id, { onDelete: 'set null' }),
```

### Step 1.4: Export from schema barrel

**Edit: `packages/db/src/schema/index.ts`**

```typescript
export * from './shipping-labels';
```

### Step 1.5: Generate migration

```bash
cd packages/db && npx drizzle-kit generate --name shipping_labels
```

### Step 1.6: Verify

```bash
npx turbo typecheck --filter=@twicely/db
```

---

## 2) Server actions + queries

### Step 2.1: Create `packages/shipping` workspace package

```bash
mkdir -p packages/shipping/src/{providers,__tests__}
```

**File: `packages/shipping/package.json`**

```json
{
  "name": "@twicely/shipping",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./rates": "./src/rates.ts",
    "./labels": "./src/labels.ts",
    "./tracking": "./src/tracking.ts",
    "./address-validation": "./src/address-validation.ts",
    "./shipment-state": "./src/shipment-state.ts",
    "./manifest": "./src/manifest.ts",
    "./return-labels": "./src/return-labels.ts",
    "./provider-interface": "./src/provider-interface.ts",
    "./types": "./src/types.ts"
  },
  "dependencies": {
    "shippo": "^3.0.0",
    "@twicely/db": "workspace:*",
    "@twicely/logger": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

**File: `packages/shipping/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

**File: `packages/shipping/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: true } });
```

Run: `pnpm install`

### Step 2.2: Provider interface + registry

**File: `packages/shipping/src/provider-interface.ts`**

Define `ShippingProviderInterface` per Canonical Section 4.1 with methods:
- `getRates(input: RateRequest): Promise<RateResult[]>`
- `purchaseLabel(rateId: string, options: PurchaseOptions): Promise<LabelResult>`
- `voidLabel(providerLabelId: string): Promise<VoidResult>`
- `validateAddress(address: AddressInput): Promise<AddressValidationResult>`
- `createManifest(carrier: string, labelIds: string[], shipDate: Date): Promise<ManifestResult>`
- `parseTrackingWebhook(payload: unknown): TrackingWebhookData | null`

**File: `packages/shipping/src/provider-registry.ts`**

Map-based registry per Canonical Section 4.2. Default provider from `getPlatformSetting('fulfillment.shipping.defaultProvider', 'shippo')`.

### Step 2.3: Types

**File: `packages/shipping/src/types.ts`**

```typescript
export interface AddressInput {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ParcelInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  packageType?: string;
}

export interface ShippingRateResult {
  carrier: string;
  service: string;
  rateCents: number;
  totalCents: number;
  currency: string;
  estimatedDays: number | null;
  providerRateId: string;
  carrierAccountId?: string;
  insuranceAvailable: boolean;
  insuranceCostCents?: number;
  retailRateCents?: number;
  savingsPercent?: number;
  tag?: 'CHEAPEST' | 'FASTEST' | 'BEST_VALUE';
}

export interface PurchasedLabel {
  id: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
  sellerPaidCents: number;
}

export interface ManifestData {
  id: string;
  carrier: string;
  labelCount: number;
  manifestUrl?: string;
}

export interface TrackingWebhookData {
  trackingNumber: string;
  carrier: string;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  providerEventId: string;
  status: string;
  statusDetail?: string;
  location?: string;
  occurredAt: Date;
}
```

### Step 2.4: Shippo provider implementation

**File: `packages/shipping/src/providers/shippo.ts`**

Migrate from `apps/web/src/lib/shipping/shippo/client.ts`. Implements `ShippingProviderInterface`. Reads `SHIPPO_API_KEY` from env. All amounts converted to integer cents immediately: `Math.round(parseFloat(rate.amount) * 100)`.

### Step 2.5: Shipment state machine

**File: `packages/shipping/src/shipment-state.ts`**

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:             ['LABEL_CREATED'],
  LABEL_CREATED:       ['PICKED_UP', 'VOIDED'],
  PICKED_UP:           ['IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT:          ['OUT_FOR_DELIVERY', 'DELIVERED', 'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER'],
  OUT_FOR_DELIVERY:    ['DELIVERED', 'FAILED'],
  FAILED:              ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER'],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getTerminalStatuses(): string[] {
  return ['DELIVERED', 'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER', 'VOIDED'];
}
```

### Step 2.6: Rate shopping

**File: `packages/shipping/src/rates.ts`**

`getShippingRates(request)`:
1. Check kill switch: `getPlatformSetting('fulfillment.shipping.labelGenerationEnabled', true)`
2. Read enabled carriers: `getPlatformSetting('fulfillment.shipping.enabledCarriers', ['USPS','UPS','FedEx'])`
3. Call provider `getRates()` with filtered carriers
4. Convert all costs to integer cents
5. Sort by `totalCents` ascending
6. Tag: cheapest gets `CHEAPEST`, fastest gets `FASTEST`, best cost/day gets `BEST_VALUE`
7. Generate sessionId, persist to `shippingRate` table
8. Return rates + sessionId

### Step 2.7: Label purchase + void

**File: `packages/shipping/src/labels.ts`**

`purchaseLabel(input)`:
1. Check kill switch
2. Check signature threshold: auto-add if order > `fulfillment.shipping.signatureRequiredAboveCents`
3. Check insurance threshold: auto-add if order > `fulfillment.shipping.autoInsureAboveCents`
4. Call provider `purchaseLabel(providerRateId, options)`
5. Calculate markup/discount from settings
6. In DB transaction:
   a. Insert `shippingLabel` row (status PURCHASED)
   b. Post `SHIPPING_LABEL_PURCHASE` ledger entry (idempotencyKey: `shipping_label:{labelId}`)
   c. If `platformMarkupCents > 0`: post `SHIPPING_LABEL_COMMISSION` ledger entry
   d. Update `shipment`: labelUrl, tracking, carrier, shippingLabelId, status LABEL_CREATED
   e. Update `order`: trackingNumber, carrierCode
7. Return `PurchasedLabel`

`voidLabel(input)`:
1. Verify label exists, belongs to seller, status is PURCHASED or PRINTED
2. Verify shipment status is LABEL_CREATED
3. Call provider `voidLabel()`
4. Update label status to VOID_PENDING
5. On confirmation: status to VOIDED then REFUNDED, post `SHIPPING_LABEL_REFUND` ledger entry
6. If commission was charged, post reversal
7. Reset shipment: clear label fields, status to PENDING

### Step 2.8: Tracking webhook handler

**File: `packages/shipping/src/tracking.ts`**

`processTrackingWebhook(payload)`:
1. Call provider `parseTrackingWebhook(payload)` to normalize
2. Find shipment by tracking number
3. For each event: check idempotency via providerEventId, append to trackingEventsJson
4. Map status, apply state machine (skip invalid transitions)
5. If DELIVERED: update dates, order status, notify buyer, start auto-complete timer
6. If exception (LOST/DAMAGED/RETURN_TO_SENDER): trigger shipping exception flow
7. If first carrier scan: update label status to USED, set firstScanAt

### Step 2.9: Address validation

**File: `packages/shipping/src/address-validation.ts`**

`validateAddress(address)`: calls provider validation API, returns isValid + suggestedAddress + messages.

### Step 2.10: Manifest generation

**File: `packages/shipping/src/manifest.ts`**

`createManifest(input)`: finds PURCHASED/PRINTED labels for seller + carrier + date, calls provider manifest API, inserts `shippingManifest` row, links labels via manifestId.

### Step 2.11: Return labels

**File: `packages/shipping/src/return-labels.ts`**

`generateReturnLabel(input)`: generates prepaid return label, allocates cost by `paidBy` (BUYER/SELLER/PLATFORM), updates `returnRequest` with tracking info.

### Step 2.12: Barrel export

**File: `packages/shipping/src/index.ts`**

Re-exports: `getShippingRates`, `purchaseLabel`, `voidLabel`, `processTrackingWebhook`, `validateAddress`, `createManifest`, `generateReturnLabel`, `isValidTransition`, `getTerminalStatuses`, all types.

### Step 2.13: Webhook route

**File: `apps/web/src/app/api/webhooks/shippo/route.ts`**

POST handler: verify webhook signature, parse body, call `processTrackingWebhook()`, always return 200.

### Step 2.14: Seller server action routes

| File | Method | Handler |
|---|---|---|
| `apps/web/src/app/api/shipping/rates/route.ts` | POST | `getShippingRates()` |
| `apps/web/src/app/api/shipping/labels/purchase/route.ts` | POST | `purchaseLabel()` |
| `apps/web/src/app/api/shipping/labels/[id]/void/route.ts` | POST | `voidLabel()` |
| `apps/web/src/app/api/shipping/labels/[id]/route.ts` | GET | Label details + PDF |
| `apps/web/src/app/api/shipping/address/validate/route.ts` | POST | `validateAddress()` |
| `apps/web/src/app/api/shipping/manifest/route.ts` | POST | `createManifest()` |

All routes authenticate seller ownership.

### Step 2.15: Admin API routes

| File | Method | Handler |
|---|---|---|
| `apps/web/src/app/api/platform/shipping/labels/route.ts` | GET | Paginated label dashboard |
| `apps/web/src/app/api/platform/shipping/exceptions/route.ts` | GET | Shipping exception queue |

Auth: SUPPORT, FINANCE, or ADMIN platform role.

### Step 2.16: Migrate old imports

Repoint any `apps/web/` imports from `apps/web/src/lib/shipping/shippo/*` to `@twicely/shipping/*`. Delete dead files after confirming no remaining imports.

### Step 2.17: CASL permissions

**Edit: `packages/casl/src/permission-registry-data.ts`**

Add `ShippingLabel` subject: seller read/create/delete own, staff read any, admin full.
Add `ShippingRate` subject: seller read own.
Add `ShippingManifest` subject: seller read/create own.

### Step 2.18: Platform settings seed

**Edit: appropriate seed file in `packages/db/src/seed/`**

Seed all 15 keys from Canonical 06 Section 16.

---

## 3) UI pages

### Step 3.1: Seller label purchase page

**File: `apps/web/src/app/(hub)/my/selling/orders/[id]/ship/page.tsx`**

- Fetch order details, seller addresses, seller shipping profiles
- Show rate comparison table (call `/api/shipping/rates` on load with order addresses + parcel)
- Rate cards: carrier logo, service name, estimated days, cost (sellerPaidCents formatted as dollars), recommendation tag badge
- Package dimensions form with seller profile presets (dropdown)
- "Buy Label" button calls `/api/shipping/labels/purchase`
- After purchase: label PDF download link, tracking number display, "Print Label" button
- "Void Label" button (visible only if status is PURCHASED/PRINTED and no carrier scan)
- Insurance checkbox (auto-checked if above threshold)
- Signature checkbox (auto-checked if above threshold)

### Step 3.2: Admin shipping dashboard

**File: `apps/web/src/app/(hub)/cfg/shipping/page.tsx`**

- Table of all labels (paginated, filterable by status/carrier/seller/date)
- Status badge colors: PURCHASED=blue, PRINTED=yellow, USED=green, VOIDED=gray, ERROR=red
- Click-through to label detail with order link
- Summary stats: labels purchased today, total cost, average savings

**File: `apps/web/src/app/(hub)/cfg/shipping/exceptions/page.tsx`**

- Open shipping exceptions queue from `@twicely/commerce/shipping-exceptions`
- Exception cards: severity badge, order number, carrier, tracking, days since exception
- Resolve/assign actions for staff

---

## 4) Tests

### Step 4.1: State machine tests

**File: `packages/shipping/src/__tests__/shipment-state.test.ts`**

- Valid transitions succeed for all paths in Canonical Section 7
- Invalid transitions return false (e.g., PENDING to DELIVERED)
- Terminal states (DELIVERED, LOST, DAMAGED_IN_TRANSIT, RETURN_TO_SENDER, VOIDED) have no outbound transitions

### Step 4.2: Rate shopping tests

**File: `packages/shipping/src/__tests__/rates.test.ts`**

- Mock provider API, verify rate mapping to integer cents (no floats)
- Rates sorted by totalCents ascending
- CHEAPEST/FASTEST/BEST_VALUE tags applied correctly
- Kill switch returns error when disabled
- Only enabled carriers returned (respect fulfillment.shipping.enabledCarriers)
- Empty rates array handled gracefully

### Step 4.3: Label lifecycle tests

**File: `packages/shipping/src/__tests__/labels.test.ts`**

- Purchase creates shippingLabel row + SHIPPING_LABEL_PURCHASE ledger entry
- Ledger entry idempotencyKey format: `shipping_label:{labelId}`
- Ledger entry amountCents = sellerPaidCents (not totalCostCents)
- Platform commission ledger entry created when platformCommissionPercent > 0
- Void flow: label status PURCHASED -> VOID_PENDING -> VOIDED -> REFUNDED
- Void posts SHIPPING_LABEL_REFUND ledger entry with reversalOfEntryId
- Cannot void after carrier scan (shipment status past LABEL_CREATED)
- Signature auto-added when order exceeds signatureRequiredAboveCents
- Insurance auto-added when order exceeds autoInsureAboveCents
- All monetary values are integer cents

### Step 4.4: Tracking webhook tests

**File: `packages/shipping/src/__tests__/tracking.test.ts`**

- Webhook updates shipment status via state machine
- Duplicate events (same providerEventId) are idempotent
- DELIVERED webhook triggers order status update + auto-complete timer
- LOST webhook triggers shipping exception flow
- Invalid state transitions are skipped (no error thrown, event still recorded)
- First carrier scan updates label status to USED + sets firstScanAt

### Step 4.5: Address validation tests

**File: `packages/shipping/src/__tests__/address-validation.test.ts`**

- Valid address returns isValid=true
- Invalid address returns isValid=false with diagnostic messages
- Suggested correction returned when provider offers one

### Step 4.6: Manifest tests

**File: `packages/shipping/src/__tests__/manifest.test.ts`**

- Manifest groups labels by carrier + date for the seller
- shippingManifest row created with correct labelCount
- Labels linked to manifest via manifestId
- Provider manifest API called with correct label IDs

### Step 4.7: Return label tests

**File: `packages/shipping/src/__tests__/return-labels.test.ts`**

- Return label created with isReturnLabel=true
- paidBy=SELLER deducts from seller balance
- paidBy=PLATFORM no seller balance impact
- returnRequest updated with tracking info

---

## 5) Doctor checks

### Step 5.1: Health provider

**File: `packages/shipping/src/health.ts`**

Provider ID: `shipping_labels`

| Check | Implementation |
|---|---|
| Provider API reachable | Ping Shippo address validation with test address, expect < 2s |
| Label purchase success rate (24h) | Count shippingLabel where createdAt > 24h ago, check ERROR rate < 5% |
| Tracking webhook lag | Compare latest tracking event receivedAt vs occurredAt, warn if avg > 30 min |
| Undelivered labels > 30 days | Count PURCHASED/PRINTED labels with createdAt > 30 days ago |
| Voided label refund backlog | Count labels with status VOIDED but not REFUNDED |

### Step 5.2: Register health provider

**Edit: Health provider registry**

Register `shipping_labels` provider.

---

## Completion Criteria

- [ ] `packages/shipping/` exists with provider abstraction, Shippo implementation, all services
- [ ] `shippingLabel`, `shippingRate`, `shippingManifest` tables with migration generated
- [ ] `labelStatusEnum` added to `packages/db/src/schema/enums.ts`
- [ ] `purchaseLabel()` calls provider + creates ledger entry + updates shipment/order atomically
- [ ] `voidLabel()` calls provider void + posts refund ledger entry + resets shipment
- [ ] Platform commission ledger entry posted when `platformCommissionPercent > 0`
- [ ] Tracking webhook processes events idempotently with state machine enforcement
- [ ] `createManifest()` batch-closes labels for a carrier/date
- [ ] `generateReturnLabel()` allocates cost by paidBy (BUYER/SELLER/PLATFORM)
- [ ] Address validation via provider API
- [ ] Seller UI at `(hub)/my/selling/orders/[id]/ship` with rate comparison + label purchase
- [ ] Admin dashboard at `(hub)/cfg/shipping/*` with label management + exception queue
- [ ] Old `apps/web/src/lib/shipping/shippo/` imports migrated to `@twicely/shipping`
- [ ] CASL permissions for ShippingLabel, ShippingRate, ShippingManifest
- [ ] Platform settings seeded (15 keys from Canonical Section 16)
- [ ] Health provider `shipping_labels` registered with 5 checks
- [ ] `npx turbo typecheck` green (all packages)
- [ ] `npx turbo test` green (baseline + new shipping tests)
