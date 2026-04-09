# Canonical 06 — Shipping Labels & Carrier Integration

**Status:** DRAFT (V4)
**Domain:** Shipping, Fulfillment, Carrier Integration
**Depends on:** Canonical 04 (Orders & Fulfillment), Finance Engine (ledger posting)
**Package:** `packages/shipping/src/` (new), extends `packages/commerce/src/shipping*.ts`, `packages/db/src/schema/shipping.ts`
**V2 lineage:** Install Phase 34 (Shipping System Complete) + TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md
**V3 existing code:** `packages/commerce/src/shipping.ts`, `shipping-exceptions.ts`, `combined-shipping.ts`; `packages/db/src/schema/shipping.ts` (shipment, returnRequest, dispute); `packages/jobs/src/shipping-quote-deadline.ts`

---

## 1. Purpose

Shipping Labels is the integrated shipping subsystem that lets sellers purchase discounted carrier labels (USPS, UPS, FedEx) directly from the Twicely seller hub via a provider abstraction layer. It handles rate shopping, label purchase/void/refund lifecycle, real-time tracking via carrier webhooks, shipping exception auto-detection, return label generation, manifest batching, and insurance options.

**What this is:**
- Provider-agnostic rate shopping across multiple carriers (Shippo primary, EasyPost/Pirate Ship pluggable)
- Label purchase with cost deducted from seller balance (ledger entry `SHIPPING_LABEL_PURCHASE`)
- Label void/refund lifecycle (ledger entry `SHIPPING_LABEL_REFUND`)
- Tracking webhook ingestion (idempotent, updates shipment status)
- Return label generation for approved returns (cost allocated by fault)
- Batch manifest generation for high-volume sellers
- Insurance option with configurable thresholds
- Optional platform commission on label sales

**What this is NOT:**
- Not a carrier. Shippo/EasyPost are aggregators; platform never calls carrier APIs directly.
- Not a customs/international shipping system (deferred).
- Not a shipping calculator for listing creation (that is `@twicely/commerce/combined-shipping`).

---

## 2. Core Principles

| # | Rule |
|---|---|
| P1 | All money in **integer cents**. Shippo returns floats -- convert immediately: `Math.round(parseFloat(rate.amount) * 100)`. |
| P2 | Label purchases are **idempotent** via `idempotencyKey` on ledger entries. |
| P3 | Tracking webhook processing is **idempotent** via `providerEventId`. |
| P4 | All label costs create **ledger entries**. No off-ledger money movement. |
| P5 | Shipment status transitions enforced by **state machine**. Invalid transitions rejected. |
| P6 | Provider abstraction: platform code calls `ShippingProviderInterface`, never raw SDK. |
| P7 | All thresholds and toggles from `platform_settings`. Hardcoded values are fallback-only. |
| P8 | Labels, addresses, and parcel dimensions are **immutable snapshots** at purchase time. |

---

## 3. Schema (Drizzle pgTable)

### 3.1 shipping_label table (new)

```typescript
// packages/db/src/schema/shipping-labels.ts
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { labelStatusEnum } from './enums';
import { shipment } from './shipping';
import { user } from './auth';
import { order } from './commerce';

export const shippingLabel = pgTable('shipping_label', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id, { onDelete: 'restrict' }),
  shipmentId:          text('shipment_id').references(() => shipment.id, { onDelete: 'set null' }),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),

  // Provider references (Shippo primary)
  provider:            text('provider').notNull().default('shippo'), // shippo | easypost | pirateship
  providerLabelId:     text('provider_label_id').notNull(),
  providerRateId:      text('provider_rate_id').notNull(),
  providerShipmentId:  text('provider_shipment_id'),

  // Label details
  status:              labelStatusEnum('status').notNull().default('PURCHASED'),
  carrier:             text('carrier').notNull(),       // USPS, UPS, FedEx
  carrierAccountId:    text('carrier_account_id'),
  service:             text('service').notNull(),       // Priority Mail, Ground, etc.
  trackingNumber:      text('tracking_number').notNull(),
  labelUrl:            text('label_url').notNull(),
  labelFormat:         text('label_format').notNull().default('PDF'),

  // Cost (integer cents, never floats)
  rateCents:           integer('rate_cents').notNull(),           // Base carrier rate
  surchargesCents:     integer('surcharges_cents').notNull().default(0),
  insuranceCostCents:  integer('insurance_cost_cents').notNull().default(0),
  totalCostCents:      integer('total_cost_cents').notNull(),     // All-in cost from provider
  platformMarkupCents: integer('platform_markup_cents').notNull().default(0),
  platformDiscountCents: integer('platform_discount_cents').notNull().default(0),
  sellerPaidCents:     integer('seller_paid_cents').notNull(),    // What seller actually pays
  currency:            text('currency').notNull().default('USD'),

  // Retail comparison
  retailRateCents:     integer('retail_rate_cents'),
  savingsCents:        integer('savings_cents'),

  // Ledger correlation
  ledgerEntryId:       text('ledger_entry_id'),
  refundLedgerEntryId: text('refund_ledger_entry_id'),

  // Idempotency
  idempotencyKey:      text('idempotency_key').notNull(),

  // Address snapshots (immutable at purchase time)
  fromAddressJson:     jsonb('from_address_json').notNull(),
  toAddressJson:       jsonb('to_address_json').notNull(),

  // Parcel details (integer for storage, real weights via weightOz on shipment)
  weightOz:            integer('weight_oz'),
  lengthIn:            integer('length_in'),
  widthIn:             integer('width_in'),
  heightIn:            integer('height_in'),
  packageType:         text('package_type').notNull().default('CUSTOM'),

  // Insurance
  isInsured:           boolean('is_insured').notNull().default(false),
  insuredValueCents:   integer('insured_value_cents'),

  // Signature
  signatureRequired:   boolean('signature_required').notNull().default(false),
  signatureType:       text('signature_type'),           // STANDARD | ADULT | DIRECT

  // Manifest
  manifestId:          text('manifest_id'),               // Batch manifest reference

  // Return label
  isReturnLabel:       boolean('is_return_label').notNull().default(false),
  returnRequestId:     text('return_request_id'),
  returnShippingPayer: text('return_shipping_payer'),      // BUYER | SELLER | PLATFORM

  // Lifecycle
  purchasedAt:         timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  printedAt:           timestamp('printed_at', { withTimezone: true }),
  firstScanAt:         timestamp('first_scan_at', { withTimezone: true }),
  voidedAt:            timestamp('voided_at', { withTimezone: true }),
  refundedAt:          timestamp('refunded_at', { withTimezone: true }),
  expiresAt:           timestamp('expires_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:        index('sl_order').on(table.orderId),
  sellerIdx:       index('sl_seller').on(table.sellerId, table.status),
  statusIdx:       index('sl_status').on(table.status, table.createdAt),
  trackingIdx:     index('sl_tracking').on(table.trackingNumber),
  providerIdx:     uniqueIndex('sl_provider_label').on(table.provider, table.providerLabelId),
  idempotencyIdx:  uniqueIndex('sl_idempotency').on(table.idempotencyKey),
  manifestIdx:     index('sl_manifest').on(table.manifestId),
}));
```

### 3.2 shipping_rate table (cached rate quotes)

```typescript
// packages/db/src/schema/shipping-labels.ts (continued)

export const shippingRate = pgTable('shipping_rate', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id, { onDelete: 'cascade' }),
  sellerId:            text('seller_id').notNull(),
  sessionId:           text('session_id').notNull(),       // Rate shopping session ID

  // Provider
  provider:            text('provider').notNull().default('shippo'),
  providerRateId:      text('provider_rate_id').notNull(), // Pass to purchaseLabel()

  // Carrier & service
  carrier:             text('carrier').notNull(),
  carrierCode:         text('carrier_code').notNull(),
  service:             text('service').notNull(),
  serviceCode:         text('service_code').notNull(),

  // Cost (integer cents)
  rateCents:           integer('rate_cents').notNull(),
  surchargesCents:     integer('surcharges_cents').notNull().default(0),
  totalCents:          integer('total_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),

  // Retail comparison
  retailRateCents:     integer('retail_rate_cents'),
  savingsPercent:      integer('savings_percent'),           // Integer percent (e.g. 15 = 15%)

  // Delivery estimate
  etaDays:             integer('eta_days'),
  etaBusinessDays:     integer('eta_business_days'),
  guaranteedDelivery:  boolean('guaranteed_delivery').notNull().default(false),

  // Features
  trackingIncluded:    boolean('tracking_included').notNull().default(true),
  insuranceIncluded:   boolean('insurance_included').notNull().default(false),
  signatureIncluded:   boolean('signature_included').notNull().default(false),

  // Selection flags
  isSelected:          boolean('is_selected').notNull().default(false),
  isRecommended:       boolean('is_recommended').notNull().default(false),
  recommendationTag:   text('recommendation_tag'),          // "Cheapest", "Fastest", "Best Value"

  // Address context (for rate accuracy)
  fromPostalCode:      text('from_postal_code').notNull(),
  toPostalCode:        text('to_postal_code').notNull(),
  weightOz:            integer('weight_oz').notNull(),

  // Validity
  expiresAt:           timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderSessionIdx:  index('sr_order_session').on(table.orderId, table.sessionId),
  expiresIdx:       index('sr_expires').on(table.expiresAt),
  carrierIdx:       index('sr_carrier').on(table.carrier, table.serviceCode),
}));
```

### 3.3 shipping_manifest table (batch shipping)

```typescript
export const shippingManifest = pgTable('shipping_manifest', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  provider:            text('provider').notNull().default('shippo'),
  providerManifestId:  text('provider_manifest_id'),

  carrier:             text('carrier').notNull(),
  labelCount:          integer('label_count').notNull().default(0),
  status:              text('status').notNull().default('PENDING'), // PENDING | CREATED | ERROR
  manifestUrl:         text('manifest_url'),

  shipDate:            timestamp('ship_date', { withTimezone: true }).notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:  index('sm_seller').on(table.sellerId, table.shipDate),
  statusIdx:  index('sm_status').on(table.status),
}));
```

### 3.4 New Enum: labelStatusEnum

Add to `packages/db/src/schema/enums.ts`:

```typescript
export const labelStatusEnum = pgEnum('label_status', [
  'PURCHASED',     // Label created and paid for
  'PRINTED',       // Seller has downloaded/printed
  'USED',          // Tracking shows carrier scanned
  'VOID_PENDING',  // Void requested, awaiting provider confirmation
  'VOIDED',        // Successfully voided
  'REFUNDED',      // Cost refunded to seller balance
  'EXPIRED',       // Unused past expiration (carrier-specific, typically 30 days)
  'ERROR',         // Provider reported an error
]);
```

### 3.5 Shipment Schema Update

The existing `shipment` table in `packages/db/src/schema/shipping.ts` gains a FK to the new `shippingLabel` table:

```typescript
shippingLabelId: text('shipping_label_id').references(() => shippingLabel.id, { onDelete: 'set null' }),
```

---

## 4. Provider Abstraction

### 4.1 Provider Interface

```typescript
// packages/shipping/src/provider-interface.ts

export interface ShippingProviderInterface {
  /** Fetch rates for a shipment */
  getRates(input: RateRequest): Promise<RateResult[]>;

  /** Purchase a label from a specific rate */
  purchaseLabel(rateId: string, options: PurchaseOptions): Promise<LabelResult>;

  /** Void/cancel a purchased label */
  voidLabel(providerLabelId: string): Promise<VoidResult>;

  /** Validate an address */
  validateAddress(address: AddressInput): Promise<AddressValidationResult>;

  /** Create end-of-day manifest for a carrier */
  createManifest(carrier: string, labelIds: string[], shipDate: Date): Promise<ManifestResult>;

  /** Parse incoming tracking webhook */
  parseTrackingWebhook(payload: unknown): TrackingWebhookData | null;
}
```

### 4.2 Provider Registry

```typescript
// packages/shipping/src/provider-registry.ts

const providers = new Map<string, ShippingProviderInterface>();

export function registerProvider(name: string, provider: ShippingProviderInterface): void {
  providers.set(name, provider);
}

export function getProvider(name?: string): ShippingProviderInterface {
  const providerName = name ?? getDefaultProvider();
  const provider = providers.get(providerName);
  if (!provider) throw new Error(`Shipping provider '${providerName}' not registered`);
  return provider;
}

function getDefaultProvider(): string {
  // Read from platform_settings, fallback to 'shippo'
  return 'shippo';
}
```

### 4.3 Shippo Implementation

```typescript
// packages/shipping/src/providers/shippo.ts
// Implements ShippingProviderInterface using the Shippo SDK
// Migrated from apps/web/src/lib/shipping/shippo/client.ts
```

### 4.4 Future Providers

EasyPost and Pirate Ship can be added by implementing `ShippingProviderInterface` and calling `registerProvider()`. No core code changes needed.

---

## 5. Rate Shopping

### 5.1 Service Contract

```typescript
// packages/shipping/src/rates.ts

export interface ShippingRateRequest {
  fromAddress: AddressInput;
  toAddress: AddressInput;
  parcel: ParcelInput;
  carriers?: string[];         // Filter to specific carriers
  serviceLevel?: string;       // Filter to service level
  includeInsurance?: boolean;
  insuredValueCents?: number;
}

export interface ShippingRateResult {
  carrier: string;
  service: string;
  rateCents: number;           // Integer cents
  totalCents: number;          // With surcharges
  currency: string;
  estimatedDays: number | null;
  providerRateId: string;      // Pass to purchaseLabel()
  carrierAccountId?: string;
  insuranceAvailable: boolean;
  insuranceCostCents?: number;
  retailRateCents?: number;
  savingsPercent?: number;
  tag?: string;                // 'CHEAPEST' | 'FASTEST' | 'BEST_VALUE'
}

export async function getShippingRates(
  request: ShippingRateRequest
): Promise<{ success: boolean; rates?: ShippingRateResult[]; sessionId?: string; error?: string }>
```

### 5.2 Rate Sorting & Tagging

Rates returned from the provider are:
1. Converted to integer cents immediately
2. Sorted by `totalCents` ascending (cheapest first)
3. Tagged: cheapest gets `CHEAPEST`, fastest gets `FASTEST`, best value (lowest cost/day) gets `BEST_VALUE`
4. Persisted to `shippingRate` table for audit trail + UI refresh without re-fetching
5. Expired rates cleaned up by BullMQ cron

### 5.3 Carrier Configuration

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `fulfillment.shipping.enabledCarriers` | string[] | `["USPS","UPS","FedEx"]` | Carriers shown in rate shopping |
| `fulfillment.shipping.defaultCarrier` | string | `"USPS"` | Pre-selected carrier |
| `fulfillment.shipping.preferCheapest` | boolean | `true` | Auto-select cheapest rate |

---

## 6. Label Lifecycle

### 6.1 Purchase

```typescript
// packages/shipping/src/labels.ts

export async function purchaseLabel(input: {
  orderId: string;
  sellerId: string;
  providerRateId: string;
  parcel: ParcelInput;
  fromAddress: AddressInput;
  toAddress: AddressInput;
  includeInsurance?: boolean;
  insuredValueCents?: number;
  signatureType?: string;
}): Promise<{ success: boolean; label?: PurchasedLabel; error?: string }>
```

**Purchase flow (atomic):**
1. Verify kill switch: `getPlatformSetting('fulfillment.shipping.labelGenerationEnabled', true)`
2. Call provider `purchaseLabel(providerRateId, options)`
3. Convert cost to integer cents: `Math.round(parseFloat(rate.amount) * 100)`
4. Calculate platform markup/discount from settings
5. In a single DB transaction:
   a. Insert `shippingLabel` row with status `PURCHASED`
   b. Post `SHIPPING_LABEL_PURCHASE` ledger entry (debit seller, idempotencyKey: `shipping_label:{labelId}`)
   c. If platform markup > 0, post `SHIPPING_LABEL_COMMISSION` ledger entry
   d. Update `shipment`: set `labelUrl`, `tracking`, `carrier`, `service`, `shippingLabelId`, status to `LABEL_CREATED`
   e. Update `order`: set `trackingNumber`, `carrierCode`
6. Return label details including PDF URL

### 6.2 Void

Labels can be voided within the carrier's void window (before first carrier scan).

```typescript
export async function voidLabel(input: {
  labelId: string;
  sellerId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }>
```

**Void flow:**
1. Verify label exists, belongs to seller, status is `PURCHASED` or `PRINTED`
2. Verify shipment status is `LABEL_CREATED` (no carrier scan)
3. Call provider void API
4. Update label status to `VOID_PENDING`
5. On provider confirmation (webhook or polling):
   a. Update label status to `VOIDED` then `REFUNDED`
   b. Post `SHIPPING_LABEL_REFUND` ledger entry (credit seller, idempotencyKey: `shipping_label_refund:{labelId}`)
   c. If platform commission was charged, post reversal
   d. Reset shipment: clear `labelUrl`, `tracking`, `shippingLabelId`, status to `PENDING`

### 6.3 Label Status Transitions

```
PURCHASED -> PRINTED     (seller downloads/prints)
PURCHASED -> USED        (carrier first scan via tracking webhook)
PRINTED   -> USED        (carrier first scan)
PURCHASED -> VOID_PENDING -> VOIDED -> REFUNDED  (void flow)
PURCHASED -> EXPIRED     (unused past expiration window)
PRINTED   -> EXPIRED     (unused past expiration window)
```

---

## 7. Shipment State Machine

### 7.1 Valid Transitions

```
PENDING            -> LABEL_CREATED       (label purchased)
LABEL_CREATED      -> PICKED_UP           (carrier first scan)
LABEL_CREATED      -> VOIDED              (label voided before scan)
PICKED_UP          -> IN_TRANSIT          (in transit scan)
PICKED_UP          -> DELIVERED           (fast delivery, no intermediate)
IN_TRANSIT         -> OUT_FOR_DELIVERY    (out for delivery)
IN_TRANSIT         -> DELIVERED           (delivered without OFD)
IN_TRANSIT         -> LOST               (no scan in N days)
IN_TRANSIT         -> DAMAGED_IN_TRANSIT  (carrier reports damage)
IN_TRANSIT         -> RETURN_TO_SENDER   (RTS by carrier)
OUT_FOR_DELIVERY   -> DELIVERED           (successful delivery)
OUT_FOR_DELIVERY   -> FAILED             (delivery attempt failed)
FAILED             -> OUT_FOR_DELIVERY    (re-attempt)
FAILED             -> RETURN_TO_SENDER   (returned after failed attempts)
```

### 7.2 Implementation

```typescript
// packages/shipping/src/shipment-state.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:             ['LABEL_CREATED'],
  LABEL_CREATED:       ['PICKED_UP', 'VOIDED'],
  PICKED_UP:           ['IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT:          ['OUT_FOR_DELIVERY', 'DELIVERED', 'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER'],
  OUT_FOR_DELIVERY:    ['DELIVERED', 'FAILED'],
  FAILED:              ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER'],
  // Terminal: DELIVERED, LOST, DAMAGED_IN_TRANSIT, RETURN_TO_SENDER, VOIDED
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## 8. Tracking Webhooks

### 8.1 Webhook Endpoint

```
POST /api/webhooks/shippo
```

### 8.2 Processing

```typescript
// packages/shipping/src/tracking.ts

export async function processTrackingWebhook(payload: unknown): Promise<void> {
  // 1. Parse via provider.parseTrackingWebhook(payload)
  // 2. Find shipment by tracking number
  // 3. Idempotency: skip if providerEventId already processed
  // 4. Append event to shipment.trackingEventsJson
  // 5. Map provider status to shipment status
  // 6. Apply state machine transition (skip invalid)
  // 7. If DELIVERED:
  //    a. Set shipment.deliveredAt, order.deliveredAt
  //    b. Update order status to DELIVERED
  //    c. Notify buyer: 'order.delivered'
  //    d. Start auto-complete timer (finance release hold)
  // 8. If LOST/DAMAGED/RETURN_TO_SENDER:
  //    a. Trigger shipping exception flow
  //    b. Notify buyer and seller
  // 9. If first scan (PICKED_UP):
  //    a. Update label status to USED
  //    b. Update label firstScanAt
}
```

### 8.3 Status Mapping (Shippo)

| Shippo Status | Shipment Status |
|---|---|
| `PRE_TRANSIT` | `LABEL_CREATED` |
| `TRANSIT` | `IN_TRANSIT` |
| `DELIVERED` | `DELIVERED` |
| `RETURNED` | `RETURN_TO_SENDER` |
| `FAILURE` | `FAILED` |
| `UNKNOWN` | (no transition) |

### 8.4 Webhook Security

- Verify provider webhook signature header
- Rate limit: max 100 requests/minute per tracking number
- Replay protection: deduplicate by `providerEventId`

---

## 9. Ledger Integration

### 9.1 Label Purchase

```
Type: SHIPPING_LABEL_PURCHASE
amountCents: -{sellerPaidCents}  (negative -- debit from seller)
userId: sellerId
orderId: orderId
idempotencyKey: 'shipping_label:{labelId}'
```

### 9.2 Label Refund (void)

```
Type: SHIPPING_LABEL_REFUND
amountCents: +{sellerPaidCents}  (positive -- credit to seller)
userId: sellerId
orderId: orderId
reversalOfEntryId: original purchase entry ID
idempotencyKey: 'shipping_label_refund:{labelId}'
```

### 9.3 Platform Commission (optional)

```
Type: SHIPPING_LABEL_COMMISSION
amountCents: +{platformMarkupCents}  (positive -- revenue to platform)
userId: null (platform)
orderId: orderId
idempotencyKey: 'shipping_label_commission:{labelId}'
```

---

## 10. Return Labels

When a return is approved and the platform, seller, or buyer is responsible for return shipping:

```typescript
export async function generateReturnLabel(input: {
  returnRequestId: string;
  orderId: string;
  fromAddress: AddressInput;  // Buyer's address
  toAddress: AddressInput;    // Seller's address
  parcel: ParcelInput;
  paidBy: 'BUYER' | 'SELLER' | 'PLATFORM';
}): Promise<{ success: boolean; label?: PurchasedLabel; error?: string }>
```

- If `paidBy === 'SELLER'`: deduct from seller balance via ledger
- If `paidBy === 'PLATFORM'`: no seller balance impact; ledger references platform
- If `paidBy === 'BUYER'`: buyer pays at time of return request

Update `returnRequest` with `returnTrackingNumber`, `returnCarrier`, `returnLabelUrl`, `returnShippingPaidBy`.

---

## 11. Manifest Generation (Batch Shipping)

High-volume sellers can batch-close their day's labels:

```typescript
export async function createManifest(input: {
  sellerId: string;
  carrier: string;
  shipDate: Date;
}): Promise<{ success: boolean; manifest?: ManifestData; error?: string }>
```

1. Find all `PURCHASED`/`PRINTED` labels for the seller + carrier + date
2. Call provider manifest API
3. Insert `shippingManifest` record
4. Link labels to manifest via `manifestId`
5. Return manifest PDF URL (SCAN form for USPS)

---

## 12. Insurance Options

### 12.1 Auto-Insurance

Configurable via platform_settings:

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `fulfillment.shipping.autoInsureAboveCents` | integer | `0` (disabled) | Auto-add insurance for orders above this value |
| `fulfillment.shipping.insuranceProvider` | string | `"carrier"` | `carrier` or `third_party` |

### 12.2 Seller-Opted Insurance

Sellers can opt into insurance during label purchase. Insurance cost is added to `insuranceCostCents` and included in `sellerPaidCents`.

### 12.3 Insurance Claim Flow

If a package is lost/damaged and insured:
1. Shipping exception created with `isInsured: true`
2. Staff files claim via provider API
3. Claim status tracked on `shippingLabel` or exception record
4. Claim payout posted as `SHIPPING_INSURANCE_CLAIM` ledger entry

---

## 13. Platform Commission on Labels

Optional revenue stream. When `fulfillment.shipping.platformCommissionPercent > 0`:

```
sellerPaidCents = totalCostCents + platformMarkupCents - platformDiscountCents
platformMarkupCents = Math.round(totalCostCents * (commissionPercent / 100))
```

Commission is a separate ledger entry (`SHIPPING_LABEL_COMMISSION`) for clean reconciliation.

---

## 14. Package Dimensions & Weight

### 14.1 Seller Shipping Profiles

Sellers save package presets via `sellerProfile.shippingProfilesJson`:

```typescript
interface ShippingProfile {
  id: string;
  name: string;              // "Small Flat Rate Box"
  carrier?: string;
  service?: string;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  packageType: string;       // CUSTOM | ENVELOPE | SOFT_PACK | SMALL_BOX | etc.
  isDefault: boolean;
}
```

### 14.2 Dimensional Weight

Carriers use the greater of actual weight or dimensional weight:
```
dimensionalWeightOz = (lengthIn * widthIn * heightIn) / dimFactor * 16
billableWeightOz = Math.max(actualWeightOz, dimensionalWeightOz)
```

Dim factor is carrier-specific (read from platform_settings).

---

## 15. RBAC (PlatformRole-based, CASL)

| Subject | Actor | Actions |
|---|---|---|
| ShippingLabel | Seller (owner) | `read`, `create` (purchase), `delete` (void) |
| ShippingLabel | Platform Staff (SUPPORT) | `read` any |
| ShippingLabel | Platform Staff (FINANCE) | `read` any |
| ShippingLabel | Platform Admin | `read`, `create`, `delete` any |
| Shipment | Seller (owner) | `read`, `update` (mark shipped) |
| Shipment | Buyer (owner) | `read` |
| ShippingRate | Seller (owner) | `read` |
| ShippingManifest | Seller (owner) | `read`, `create` |
| TrackingWebhook | System | `create` (provider webhook ingestion) |

---

## 16. Platform Settings Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `fulfillment.shipping.labelGenerationEnabled` | boolean | `true` | Kill switch for label purchase |
| `fulfillment.shipping.enabledCarriers` | string[] | `["USPS","UPS","FedEx"]` | Available carriers |
| `fulfillment.shipping.defaultCarrier` | string | `"USPS"` | Default carrier selection |
| `fulfillment.shipping.defaultProvider` | string | `"shippo"` | Default shipping provider |
| `fulfillment.shipping.labelDiscountPercent` | number | `0` | Platform-subsidized discount % |
| `fulfillment.shipping.platformCommissionPercent` | number | `0` | Platform markup on labels |
| `fulfillment.shipping.signatureRequiredAboveCents` | integer | `75000` | Auto-signature for orders > $750 |
| `fulfillment.shipping.autoInsureAboveCents` | integer | `0` | Auto-insurance threshold (0 = disabled) |
| `fulfillment.shipping.voidWindowHours` | integer | `720` | Hours before label void expires (30 days) |
| `fulfillment.shipping.labelFormat` | string | `"PDF"` | Default format: PDF, PNG, ZPL |
| `fulfillment.shipping.dimFactorUsps` | number | `166` | USPS dimensional weight divisor |
| `fulfillment.shipping.dimFactorUps` | number | `139` | UPS dimensional weight divisor |
| `fulfillment.shipping.dimFactorFedex` | number | `139` | FedEx dimensional weight divisor |
| `commerce.shipping.lostInTransitDays` | integer | `7` | Days without scan before lost-in-transit |
| `commerce.shipping.significantDelayDays` | integer | `14` | Days past ETA for delay exception |

---

## 17. Health Provider

Provider ID: `shipping_labels`

| Check | Pass | Warn | Fail |
|---|---|---|---|
| Provider API reachable | Responds < 2s | Responds < 10s | Timeout or error |
| Label purchase success rate (24h) | > 95% | > 80% | < 80% |
| Tracking webhook lag | < 5 min avg | < 30 min avg | > 30 min avg |
| Undelivered labels > 30 days | < 10 | < 50 | > 50 |
| Voided label refund backlog | 0 | < 5 | > 5 |

---

## 18. Out of Scope

- International shipping / customs declarations (deferred)
- Carrier contract negotiation
- Multi-warehouse / 3PL integration
- Drop-shipping provider integration
- Real-time carrier pickup scheduling
