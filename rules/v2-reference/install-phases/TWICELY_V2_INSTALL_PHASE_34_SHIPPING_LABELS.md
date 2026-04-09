# TWICELY V2 - Install Phase 34: Shipping System Complete

**Status:** LOCKED (v2.0)  
**Backend-first:** Schema → Enums → State Machine → Services → Tracking → Exceptions → Returns → Health → Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md` (v2)
- `/rules/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`
- `/rules/TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_34_SHIPPING_LABELS.md`  
> Prereq: Phase 33 complete and Doctor green.  
> Changelog: v2.0 - Complete rewrite combining original Phase 34 with v2 enhancements

---

## 0) What This Phase Installs

This phase implements the **complete shipping system** including:

### Backend
- Full shipping enums (16 enums replacing string statuses)
- Comprehensive data models (Shipment, ShippingLabel, TrackingEvent, ShippingException, ShippingProfile, ShippingRate, ReturnShipment, ShippingSettings)
- State machine with valid transition enforcement
- Provider-agnostic `ShippingProviderInterface`
- Provider registry for module plug-in
- Rate shopping abstraction (multi-carrier)
- Label purchase/void/refund lifecycle
- Tracking webhook ingestion (idempotent)
- Exception handling (lost/damaged/returned-to-sender)
- Combined shipping calculations
- Return shipment support
- Label cost ledger entries

### UI (Seller)
- Seller → Order → Buy Label (rate comparison)
- Seller → Order → Print Label
- Seller → Order → Void Label
- Seller → Shipping Profiles management
- Seller → Combined shipping rules

### UI (Corp)
- Corp → Shipping → Label Dashboard
- Corp → Shipping → Exceptions Queue
- Corp → Shipping → Shipping Settings

### Ops
- Health provider: `shipping` (v2)
- Doctor checks: state machine, idempotency, tracking, exceptions, settings

---

## 1) Prisma Schema - Enums

Add all shipping enums to `prisma/schema.prisma`:

```prisma
// =============================================================================
// SHIPPING ENUMS (16 enums)
// =============================================================================

enum ShipmentStatus {
  PENDING
  LABEL_PENDING
  LABEL_CREATED
  PICKED_UP
  IN_TRANSIT
  OUT_FOR_DELIVERY
  DELIVERED
  AVAILABLE_FOR_PICKUP
  DELIVERY_ATTEMPTED
  EXCEPTION
  RETURNED_TO_SENDER
  LOST
  DAMAGED
  CANCELED
  VOIDED
}

enum ShipmentCarrier {
  USPS
  UPS
  FEDEX
  DHL
  DHL_EXPRESS
  DHL_ECOMMERCE
  ONTRAC
  LASERSHIP
  AMAZON_LOGISTICS
  CANADA_POST
  ROYAL_MAIL
  AUSTRALIA_POST
  OTHER
}

enum ServiceLevel {
  ECONOMY
  STANDARD
  EXPEDITED
  EXPRESS
  OVERNIGHT
  SAME_DAY
  FREIGHT
}

enum PackageType {
  CUSTOM
  ENVELOPE
  SOFT_PACK
  SMALL_BOX
  MEDIUM_BOX
  LARGE_BOX
  TUBE
  PALLET
}

enum SignatureType {
  NO_SIGNATURE
  SIGNATURE
  ADULT_SIGNATURE
  DIRECT_SIGNATURE
}

enum LabelStatus {
  PENDING
  PURCHASED
  PRINTED
  USED
  VOIDED
  VOID_PENDING
  REFUNDED
  EXPIRED
  ERROR
}

enum LabelFormat {
  PDF
  PDF_4X6
  PNG
  ZPL
  EPL
}

enum TrackingStatus {
  PRE_TRANSIT
  ACCEPTED
  IN_TRANSIT
  ARRIVED_AT_FACILITY
  DEPARTED_FACILITY
  PROCESSING
  OUT_FOR_DELIVERY
  DELIVERED
  AVAILABLE_FOR_PICKUP
  DELIVERY_ATTEMPTED
  EXCEPTION
  DELAYED
  HELD
  RETURN_TO_SENDER
  RETURNED
  LOST
  DAMAGED
  REFUSED
  UNKNOWN
}

enum ExceptionType {
  DELIVERY_FAILED
  ADDRESS_ISSUE
  RECIPIENT_UNAVAILABLE
  REFUSED
  LOST
  DAMAGED
  MISSING_CONTENTS
  RETURNED_TO_SENDER
  UNCLAIMED
  CUSTOMS_HOLD
  CUSTOMS_REJECTED
  DUTIES_OWED
  WEATHER_DELAY
  CARRIER_DELAY
  SECURITY_HOLD
  BUYER_REPORTED
  SELLER_REPORTED
}

enum ExceptionStatus {
  OPEN
  INVESTIGATING
  AWAITING_CARRIER
  AWAITING_BUYER
  AWAITING_SELLER
  CLAIM_FILED
  RESOLVED
  CLOSED
}

enum ExceptionSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ExceptionResolution {
  DELIVERED
  RESHIPMENT
  REFUNDED
  PARTIAL_REFUND
  INSURANCE_CLAIM
  BUYER_FAULT
  SELLER_FAULT
  CARRIER_FAULT
  NO_ACTION_NEEDED
}

enum CombinedShippingRule {
  ADDITIONAL_ITEM
  FLAT_TOTAL
  HIGHEST_ONLY
  SUM_ALL
  FREE_ADDITIONAL
}

enum ReturnShipmentStatus {
  PENDING
  LABEL_CREATED
  LABEL_SENT
  IN_TRANSIT
  DELIVERED
  INSPECTED
  COMPLETED
  EXCEPTION
  CANCELED
}

enum ReturnShipmentPayer {
  BUYER
  SELLER
  PLATFORM
  SPLIT
}
```

---

## 2) Prisma Schema - Models

### 2.1 Shipment Model

```prisma
model Shipment {
  id                    String          @id @default(cuid())
  
  // Relationships
  orderId               String          @unique
  order                 Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  sellerId              String
  buyerId               String
  
  // Status & State Machine
  status                ShipmentStatus  @default(PENDING)
  previousStatus        ShipmentStatus?
  statusChangedAt       DateTime        @default(now())
  statusHistory         Json            @default("[]")
  
  // Carrier & Service
  carrier               ShipmentCarrier?
  carrierCode           String?
  carrierName           String?
  serviceCode           String?
  serviceName           String?
  serviceLevel          ServiceLevel    @default(STANDARD)
  
  // Tracking
  trackingNumber        String?
  trackingUrl           String?
  trackingUrlPublic     String?
  lastTrackingStatus    String?
  lastTrackingLocation  String?
  lastTrackingAt        DateTime?
  trackingEventCount    Int             @default(0)
  
  // Label
  labelId               String?         @unique
  label                 ShippingLabel?  @relation(fields: [labelId], references: [id])
  isSellerProvided      Boolean         @default(false)
  
  // Package Details
  packageType           PackageType     @default(CUSTOM)
  weightOz              Float?
  lengthIn              Float?
  widthIn               Float?
  heightIn              Float?
  
  // Addresses (Snapshots)
  fromAddress           Json
  toAddress             Json
  toAddressValidated    Boolean         @default(false)
  
  // Delivery Details
  signatureRequired     Boolean         @default(false)
  signatureType         SignatureType?
  deliveryInstructions  String?
  isResidential         Boolean         @default(true)
  
  // Insurance
  isInsured             Boolean         @default(false)
  insuredValueCents     Int?
  insurancePremiumCents Int?
  
  // Dates & SLA
  handlingDueAt         DateTime?
  estimatedDeliveryAt   DateTime?
  labelCreatedAt        DateTime?
  pickedUpAt            DateTime?
  inTransitAt           DateTime?
  outForDeliveryAt      DateTime?
  deliveredAt           DateTime?
  exceptionAt           DateTime?
  returnedToSenderAt    DateTime?
  
  // SLA Flags
  isLate                Boolean         @default(false)
  isDeliveryLate        Boolean         @default(false)
  lateReasonCode        String?
  
  // Costs (Cents)
  shippingCostCents     Int             @default(0)
  labelCostCents        Int             @default(0)
  insuranceCostCents    Int             @default(0)
  totalShippingCostCents Int            @default(0)
  refundedCents         Int             @default(0)
  
  // Provider
  provider              String?
  providerShipmentId    String?
  
  // Metadata
  notesInternal         String?
  notesSeller           String?
  
  // Audit
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  
  // Relations
  trackingEvents        TrackingEvent[]
  exceptions            ShippingException[]
  rateQuotes            ShippingRate[]
  
  @@index([orderId])
  @@index([sellerId, status])
  @@index([buyerId, status])
  @@index([trackingNumber])
  @@index([status, handlingDueAt])
  @@index([carrier, status])
  @@index([isLate, status])
}
```

### 2.2 ShippingLabel Model

```prisma
model ShippingLabel {
  id                    String        @id @default(cuid())
  
  // Relationships
  shipmentId            String?       @unique
  shipment              Shipment?     @relation(fields: [shipmentId], references: [id])
  orderId               String
  sellerId              String
  
  // Status
  status                LabelStatus   @default(PENDING)
  
  // Carrier & Service
  carrier               ShipmentCarrier
  carrierCode           String
  serviceCode           String
  serviceName           String
  
  // Tracking
  trackingNumber        String
  trackingUrl           String?
  
  // Label File
  labelUrl              String?
  labelFormat           LabelFormat   @default(PDF_4X6)
  labelExpiresAt        DateTime?
  
  // Costs
  rateCents             Int
  totalCostCents        Int
  currency              String        @default("USD")
  sellerPaidCents       Int
  
  // Refunds
  isVoidable            Boolean       @default(true)
  voidedAt              DateTime?
  voidReason            String?
  refundCents           Int?
  refundedAt            DateTime?
  
  // Addresses (Snapshot)
  fromAddress           Json
  toAddress             Json
  
  // Package (Snapshot)
  weightOz              Float
  lengthIn              Float?
  widthIn               Float?
  heightIn              Float?
  packageType           PackageType   @default(CUSTOM)
  
  // Provider
  provider              String
  providerLabelId       String        @unique
  providerRateId        String?
  
  // Idempotency
  idempotencyKey        String        @unique
  
  // Timestamps
  purchasedAt           DateTime?
  printedAt             DateTime?
  firstScanAt           DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
  
  @@index([orderId])
  @@index([sellerId, status])
  @@index([trackingNumber])
  @@index([status, createdAt])
}
```

### 2.3 TrackingEvent Model

```prisma
model TrackingEvent {
  id                    String          @id @default(cuid())
  
  // Relationships
  shipmentId            String
  shipment              Shipment        @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  labelId               String?
  
  // Tracking Info
  trackingNumber        String
  carrier               ShipmentCarrier
  
  // Status
  status                TrackingStatus
  statusDetail          String?
  statusDescription     String?
  
  // Location
  city                  String?
  state                 String?
  postalCode            String?
  country               String?
  locationDescription   String?
  
  // Timestamps
  occurredAt            DateTime
  estimatedDeliveryAt   DateTime?
  
  // Delivery Details
  signedBy              String?
  deliveryLocation      String?
  
  // Provider
  provider              String
  providerEventId       String          @unique
  rawPayload            Json?
  
  // Flags
  isException           Boolean         @default(false)
  
  // Timestamps
  receivedAt            DateTime        @default(now())
  createdAt             DateTime        @default(now())
  
  @@index([shipmentId, occurredAt])
  @@index([trackingNumber, occurredAt])
  @@index([status, occurredAt])
  @@index([isException, occurredAt])
}
```

### 2.4 ShippingException Model

```prisma
model ShippingException {
  id                    String            @id @default(cuid())
  
  // Relationships
  shipmentId            String
  shipment              Shipment          @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  orderId               String
  labelId               String?
  
  // Exception Details
  type                  ExceptionType
  status                ExceptionStatus   @default(OPEN)
  severity              ExceptionSeverity @default(MEDIUM)
  description           String?
  carrierMessage        String?
  
  // Detection
  detectedAt            DateTime          @default(now())
  detectedBy            String
  
  // Assignment
  assignedToStaffId     String?
  assignedAt            DateTime?
  
  // Resolution
  resolution            ExceptionResolution?
  resolutionNotes       String?
  resolvedAt            DateTime?
  resolvedByStaffId     String?
  
  // Financial Impact
  claimFiledAt          DateTime?
  claimAmount           Int?
  refundAmount          Int?
  refundIssuedAt        DateTime?
  
  // SLA
  responseDeadline      DateTime?
  resolutionDeadline    DateTime?
  isOverdue             Boolean           @default(false)
  
  // Audit
  activityLog           Json              @default("[]")
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  
  @@index([shipmentId])
  @@index([orderId])
  @@index([type, status])
  @@index([status, createdAt])
  @@index([severity, status])
}
```

### 2.5 ShippingProfile Model

```prisma
model ShippingProfile {
  id                        String              @id @default(cuid())
  sellerId                  String
  
  // Basic Info
  name                      String
  description               String?
  isDefault                 Boolean             @default(false)
  isActive                  Boolean             @default(true)
  
  // Domestic Shipping
  domesticEnabled           Boolean             @default(true)
  domesticFlatRate          Boolean             @default(true)
  domesticFirstItemCents    Int                 @default(0)
  domesticAdditionalCents   Int                 @default(0)
  domesticFreeShippingEnabled Boolean           @default(false)
  domesticFreeShippingAboveCents Int?
  domesticCalculated        Boolean             @default(false)
  
  // International Shipping
  internationalEnabled      Boolean             @default(false)
  internationalFirstItemCents Int?
  internationalAdditionalCents Int?
  internationalExcludedCountries String[]       @default([])
  
  // Handling Time
  handlingTimeDays          Int                 @default(3)
  handlingTimeMax           Int?
  cutoffTime                String?
  cutoffTimezone            String              @default("America/New_York")
  excludeWeekends           Boolean             @default(true)
  
  // Combined Shipping
  combinedShippingEnabled   Boolean             @default(true)
  combinedShippingRule      CombinedShippingRule @default(ADDITIONAL_ITEM)
  combinedShippingMaxItems  Int                 @default(0)
  
  // Carrier Preferences
  preferredCarriers         String[]            @default(["USPS"])
  
  // Package Defaults
  defaultPackageType        PackageType         @default(CUSTOM)
  defaultWeightOz           Int                 @default(16)
  
  // Return Address
  returnAddress             Json                @default("{}")
  
  // Insurance
  autoInsureAboveCents      Int?
  alwaysInsure              Boolean             @default(false)
  
  // Signature
  signatureRequiredAboveCents Int?
  alwaysRequireSignature    Boolean             @default(false)
  
  // Location Restrictions
  excludedStates            String[]            @default([])
  poBoxAllowed              Boolean             @default(true)
  
  // Timestamps
  createdAt                 DateTime            @default(now())
  updatedAt                 DateTime            @updatedAt
  
  // Relations
  listings                  Listing[]
  
  @@unique([sellerId, isDefault])
  @@index([sellerId, isActive])
}
```

### 2.6 ShippingRate Model

```prisma
model ShippingRate {
  id                    String          @id @default(cuid())
  
  // Context
  shipmentId            String?
  shipment              Shipment?       @relation(fields: [shipmentId], references: [id])
  orderId               String
  sellerId              String
  
  // Carrier & Service
  carrier               ShipmentCarrier
  carrierCode           String
  serviceName           String
  serviceCode           String
  serviceLevel          ServiceLevel
  
  // Costs
  rateCents             Int
  totalCents            Int
  currency              String          @default("USD")
  retailRateCents       Int?
  
  // Delivery Estimate
  etaDays               Int?
  estimatedDeliveryDate DateTime?
  guaranteedDelivery    Boolean         @default(false)
  
  // Features
  trackingIncluded      Boolean         @default(true)
  insuranceIncluded     Boolean         @default(false)
  signatureIncluded     Boolean         @default(false)
  
  // Provider
  provider              String
  providerRateId        String?
  
  // Selection
  isSelected            Boolean         @default(false)
  isRecommended         Boolean         @default(false)
  
  // Validity
  expiresAt             DateTime
  isExpired             Boolean         @default(false)
  
  // Timestamps
  quotedAt              DateTime        @default(now())
  createdAt             DateTime        @default(now())
  
  @@index([orderId, createdAt])
  @@index([carrier, serviceCode])
  @@index([expiresAt])
}
```

### 2.7 ReturnShipment Model (NEW)

```prisma
model ReturnShipment {
  id                    String                @id @default(cuid())
  
  // Relationships
  orderId               String                @unique
  order                 Order                 @relation(fields: [orderId], references: [id])
  returnRequestId       String?
  originalShipmentId    String?
  buyerId               String
  sellerId              String
  
  // Status
  status                ReturnShipmentStatus  @default(PENDING)
  statusHistory         Json                  @default("[]")
  
  // Payment Responsibility
  paidBy                ReturnShipmentPayer   @default(BUYER)
  buyerPaidCents        Int                   @default(0)
  sellerPaidCents       Int                   @default(0)
  platformPaidCents     Int                   @default(0)
  
  // Label
  labelId               String?               @unique
  carrier               ShipmentCarrier?
  carrierCode           String?
  serviceCode           String?
  trackingNumber        String?
  trackingUrl           String?
  labelUrl              String?
  labelCostCents        Int                   @default(0)
  
  // Addresses
  fromAddress           Json
  toAddress             Json
  
  // Package
  weightOz              Float?
  
  // Tracking
  lastTrackingStatus    String?
  lastTrackingAt        DateTime?
  
  // Timestamps
  labelCreatedAt        DateTime?
  labelSentAt           DateTime?
  shippedAt             DateTime?
  deliveredAt           DateTime?
  inspectedAt           DateTime?
  completedAt           DateTime?
  
  // Notes
  buyerNotes            String?
  sellerNotes           String?
  inspectionNotes       String?
  
  // Idempotency
  idempotencyKey        String                @unique
  
  // Audit
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  
  @@index([orderId])
  @@index([buyerId, status])
  @@index([sellerId, status])
  @@index([status, createdAt])
  @@index([trackingNumber])
}
```

### 2.8 ShippingSettings Model (NEW)

```prisma
model ShippingSettings {
  id                        String    @id @default(cuid())
  version                   Int       @default(1)
  
  // Provider Configuration
  enabledProviders          String[]  @default([])
  defaultProvider           String?
  fallbackProvider          String?
  
  // Combined Shipping Defaults
  combinedShippingEnabled   Boolean   @default(true)
  defaultCombinedRule       CombinedShippingRule @default(ADDITIONAL_ITEM)
  
  // SLA Settings
  defaultHandlingDays       Int       @default(3)
  maxHandlingDays           Int       @default(7)
  scanSlaHours              Int       @default(48)
  
  // Label Settings
  defaultLabelFormat        LabelFormat @default(PDF_4X6)
  labelRetentionDays        Int       @default(30)
  
  // Void Settings
  voidWindowHours           Int       @default(24)
  autoVoidUnusedLabelsHours Int?
  
  // Insurance Defaults
  autoInsureAboveCents      Int?
  insuranceMarkupPercent    Int       @default(0)
  
  // Exception Settings
  exceptionResponseHours    Int       @default(48)
  exceptionResolutionDays   Int       @default(7)
  
  // Admin
  isActive                  Boolean   @default(true)
  effectiveAt               DateTime  @default(now())
  createdAt                 DateTime  @default(now())
  createdByStaffId          String?
  
  @@index([isActive, effectiveAt])
}
```

---

## 3) Shipping Invariants (Non-Negotiable)

1. **Label purchases are idempotent** by `idempotencyKey`
2. **Voided labels are refunded** to seller
3. **Tracking updates are idempotent** by `providerEventId`
4. **Exceptions auto-flag** for review
5. **Label costs are ledgered** immediately
6. **State transitions are validated** - invalid transitions rejected
7. **All transitions emit audit events**

---

## 4) State Machine

### 4.1 Valid Shipment Transitions

```
PENDING → LABEL_PENDING → LABEL_CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                            ↓                            ↓               ↓
                          VOIDED                    EXCEPTION    DELIVERY_ATTEMPTED
                          CANCELED                      ↓               ↓
                                              RETURNED_TO_SENDER    EXCEPTION
                                                    LOST
                                                    DAMAGED
```

### 4.2 Transition Enforcement

```typescript
// packages/core/shipping/state-machine.ts

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['LABEL_PENDING', 'CANCELED'],
  LABEL_PENDING: ['LABEL_CREATED', 'CANCELED'],
  LABEL_CREATED: ['PICKED_UP', 'IN_TRANSIT', 'VOIDED', 'CANCELED'],
  PICKED_UP: ['IN_TRANSIT', 'EXCEPTION'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED_TO_SENDER'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPTED', 'EXCEPTION'],
  DELIVERY_ATTEMPTED: ['DELIVERED', 'OUT_FOR_DELIVERY', 'EXCEPTION', 'RETURNED_TO_SENDER'],
  DELIVERED: [],
  AVAILABLE_FOR_PICKUP: ['DELIVERED', 'RETURNED_TO_SENDER'],
  EXCEPTION: ['IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER', 'LOST', 'DAMAGED'],
  RETURNED_TO_SENDER: [],
  LOST: [],
  DAMAGED: [],
  CANCELED: [],
  VOIDED: [],
};

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function transitionShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  context: { reason?: string; actorId?: string; trackingEventId?: string }
): Promise<Shipment> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error('Shipment not found');
  
  if (!canTransition(shipment.status, newStatus)) {
    throw new Error(`Invalid transition: ${shipment.status} → ${newStatus}`);
  }
  
  const historyEntry = {
    from: shipment.status,
    to: newStatus,
    at: new Date().toISOString(),
    reason: context.reason,
    actorId: context.actorId,
    trackingEventId: context.trackingEventId,
  };
  
  const currentHistory = (shipment.statusHistory as any[]) || [];
  
  // Determine timestamp updates
  const timestampUpdates: Partial<Shipment> = {};
  switch (newStatus) {
    case 'LABEL_CREATED': timestampUpdates.labelCreatedAt = new Date(); break;
    case 'PICKED_UP': timestampUpdates.pickedUpAt = new Date(); break;
    case 'IN_TRANSIT': timestampUpdates.inTransitAt = new Date(); break;
    case 'OUT_FOR_DELIVERY': timestampUpdates.outForDeliveryAt = new Date(); break;
    case 'DELIVERED': timestampUpdates.deliveredAt = new Date(); break;
    case 'EXCEPTION': timestampUpdates.exceptionAt = new Date(); break;
    case 'RETURNED_TO_SENDER': timestampUpdates.returnedToSenderAt = new Date(); break;
  }
  
  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: newStatus,
      previousStatus: shipment.status,
      statusChangedAt: new Date(),
      statusHistory: [...currentHistory, historyEntry],
      ...timestampUpdates,
    },
  });
  
  // Execute side effects
  await executeStatusSideEffects(updated, newStatus, context);
  
  await emitAuditEvent({
    actorUserId: context.actorId,
    action: 'shipping.status.transitioned',
    entityType: 'Shipment',
    entityId: shipmentId,
    meta: { from: shipment.status, to: newStatus, reason: context.reason },
  });
  
  return updated;
}
```

---

## 5) Shipping Provider Interface

The core platform defines a provider interface that modules implement:

```typescript
// packages/core/shipping/provider-interface.ts

export interface ShippingProviderInterface {
  readonly providerId: string;
  readonly providerName: string;
  
  isConfigured(): Promise<boolean>;
  
  getRates(params: {
    fromAddress: ShippingAddress;
    toAddress: ShippingAddress;
    parcels: ShippingParcel[];
    shipDate?: string;
  }): Promise<ShippingRate[]>;
  
  purchaseLabel(params: {
    rateId: string;
    labelFormat?: 'PDF' | 'PNG' | 'ZPL';
  }): Promise<ShippingLabel>;
  
  voidLabel(params: {
    labelId: string;
  }): Promise<{ success: boolean; message?: string }>;
  
  getTracking(params: {
    trackingNumber: string;
    carrier: string;
  }): Promise<TrackingStatus>;
  
  validateAddress(params: {
    address: ShippingAddress;
  }): Promise<AddressValidationResult>;
}
```

See `TWICELY_MODULE_SYSTEM_GUIDANCE.md` Section 9 for provider registration pattern.

---

## 6) Rate Shopping Service

```typescript
// packages/core/shipping/rate-shopping.ts

import { getProvider, getAllProviders, hasProvider } from "@/lib/providers/registry";
import type { ShippingProviderInterface } from "./provider-interface";

export async function getRates(args: {
  orderId: string;
  from: Address;
  to: Address;
  package: PackageDetails;
}): Promise<Rate[]> {
  if (!hasProvider('shipping')) {
    // No provider installed - return empty rates
    return [];
  }
  
  const allProviders = getAllProviders<ShippingProviderInterface>('shipping');
  
  const ratePromises = allProviders.map(({ provider }) =>
    provider.getRates({ 
      fromAddress: args.from, 
      toAddress: args.to, 
      parcels: [args.package] 
    }).catch(() => [])
  );

  const rateArrays = await Promise.all(ratePromises);
  const allRates = rateArrays.flat().sort((a, b) => a.amountCents - b.amountCents);

  // Cache rates for selection
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  for (const rate of allRates) {
    await prisma.shippingRate.create({
      data: {
        orderId: args.orderId,
        provider: rate.providerId,
        carrier: rate.carrier as ShipmentCarrier,
        carrierCode: rate.carrier,
        serviceName: rate.serviceName,
        serviceCode: rate.serviceCode,
        serviceLevel: mapServiceLevel(rate.serviceCode),
        rateCents: rate.amountCents,
        totalCents: rate.amountCents,
        currency: rate.currency,
        etaDays: rate.estimatedDays,
        estimatedDeliveryDate: rate.deliveryDate ? new Date(rate.deliveryDate) : undefined,
        providerRateId: rate.rateId,
        expiresAt,
      },
    });
  }

  return allRates;
}
```

---

## 7) Label Purchase Service

```typescript
// packages/core/shipping/label.ts

export async function purchaseLabel(args: {
  orderId: string;
  sellerId: string;
  rateId: string;
  idempotencyKey: string;
}): Promise<ShippingLabel> {
  // Idempotency check
  const existing = await prisma.shippingLabel.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
  });
  if (existing) return existing;

  const rate = await prisma.shippingRate.findUnique({ where: { id: args.rateId } });
  if (!rate) throw new Error('Rate not found or expired');

  const provider = getProvider<ShippingProviderInterface>('shipping');
  if (!provider) throw new Error('No shipping provider installed');

  const result = await provider.purchaseLabel({
    rateId: rate.providerRateId!,
    labelFormat: 'PDF',
  });

  const label = await prisma.shippingLabel.create({
    data: {
      orderId: args.orderId,
      sellerId: args.sellerId,
      status: 'PURCHASED',
      carrier: rate.carrier,
      carrierCode: rate.carrierCode,
      serviceCode: rate.serviceCode,
      serviceName: rate.serviceName,
      trackingNumber: result.trackingNumber,
      trackingUrl: result.labelUrl,
      labelUrl: result.labelUrl,
      labelFormat: result.labelFormat as LabelFormat,
      rateCents: result.amountCents,
      totalCostCents: result.amountCents,
      sellerPaidCents: result.amountCents,
      currency: result.currency,
      provider: result.providerId,
      providerLabelId: result.labelId,
      providerRateId: rate.providerRateId,
      fromAddress: rate.fromAddress ?? {},
      toAddress: rate.toAddress ?? {},
      weightOz: rate.weightOz ?? 16,
      purchasedAt: new Date(),
      idempotencyKey: args.idempotencyKey,
    },
  });

  // Create ledger entry
  await createLedgerEntry({
    type: 'SHIPPING_LABEL_FEE',
    sellerId: args.sellerId,
    amountCents: result.amountCents,
    currency: result.currency,
    referenceType: 'ShippingLabel',
    referenceId: label.id,
  });

  await emitAuditEvent({
    action: 'shipping.label.purchased',
    entityType: 'ShippingLabel',
    entityId: label.id,
    meta: { orderId: args.orderId, costCents: result.amountCents, carrier: rate.carrier },
  });

  return label;
}
```

---

## 8) Tracking Ingestion

```typescript
// packages/core/shipping/tracking.ts

export async function ingestTrackingEvent(args: {
  trackingNumber: string;
  carrier: string;
  status: string;
  statusDetail?: string;
  location?: { city?: string; state?: string; postalCode?: string; country?: string };
  occurredAt: Date;
  providerEventId: string;
  provider: string;
}): Promise<TrackingEvent> {
  // Idempotent check
  const existing = await prisma.trackingEvent.findUnique({
    where: { providerEventId: args.providerEventId },
  });
  if (existing) return existing;

  // Find associated shipment
  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber: args.trackingNumber },
  });

  if (!shipment) {
    throw new Error(`No shipment found for tracking ${args.trackingNumber}`);
  }

  const event = await prisma.trackingEvent.create({
    data: {
      shipmentId: shipment.id,
      labelId: shipment.labelId,
      trackingNumber: args.trackingNumber,
      carrier: args.carrier as ShipmentCarrier,
      status: mapTrackingStatus(args.status),
      statusDetail: args.statusDetail,
      city: args.location?.city,
      state: args.location?.state,
      postalCode: args.location?.postalCode,
      country: args.location?.country,
      occurredAt: args.occurredAt,
      provider: args.provider,
      providerEventId: args.providerEventId,
      isException: isExceptionStatus(args.status),
    },
  });

  // Update shipment tracking info
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      lastTrackingStatus: args.status,
      lastTrackingLocation: args.location?.city,
      lastTrackingAt: args.occurredAt,
      trackingEventCount: { increment: 1 },
    },
  });

  // Transition shipment status if applicable
  const newShipmentStatus = mapTrackingToShipmentStatus(args.status);
  if (newShipmentStatus && canTransition(shipment.status, newShipmentStatus)) {
    await transitionShipmentStatus(shipment.id, newShipmentStatus, {
      reason: `Tracking update: ${args.status}`,
      trackingEventId: event.id,
    });
  }

  // Check for exceptions
  if (isExceptionStatus(args.status)) {
    await createException({
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      labelId: shipment.labelId,
      type: mapToExceptionType(args.status),
      description: args.statusDetail,
      detectedBy: 'tracking_webhook',
    });
  }

  return event;
}
```

---

## 9) Health Provider

```typescript
// packages/core/health/providers/shipping.ts

export const shippingHealthProvider: HealthProvider = {
  id: "shipping",
  label: "Shipping & Logistics",

  async run({ runType }): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    let status: HealthStatus = "PASS";

    // 1. Shipping settings exist
    const settings = await prisma.shippingSettings.findFirst({
      where: { isActive: true, effectiveAt: { lte: new Date() } },
      orderBy: { effectiveAt: "desc" },
    });
    checks.push({
      id: "shipping.settings_active",
      label: "Shipping settings active",
      status: settings ? "PASS" : "FAIL",
      message: settings ? `v${settings.version}` : "No active settings",
    });
    if (!settings) status = "FAIL";

    // 2. Late shipments detection
    const unmarkedLate = await prisma.shipment.count({
      where: {
        status: { in: ['PENDING', 'LABEL_PENDING', 'LABEL_CREATED'] },
        handlingDueAt: { lt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        isLate: false,
      },
    });
    checks.push({
      id: "shipping.late_detection",
      label: "Late shipment detection",
      status: unmarkedLate === 0 ? "PASS" : "WARN",
      message: unmarkedLate > 0 ? `${unmarkedLate} unmarked late shipments` : "All caught up",
    });

    // 3. Open exceptions backlog
    const criticalExceptions = await prisma.shippingException.count({
      where: { status: 'OPEN', severity: 'CRITICAL' },
    });
    checks.push({
      id: "shipping.critical_exceptions",
      label: "Critical exceptions",
      status: criticalExceptions === 0 ? "PASS" : (criticalExceptions < 5 ? "WARN" : "FAIL"),
      message: `${criticalExceptions} critical exceptions open`,
    });
    if (criticalExceptions >= 5) status = "FAIL";

    // 4. State machine integrity
    const deliveredNoTimestamp = await prisma.shipment.count({
      where: { status: 'DELIVERED', deliveredAt: null },
    });
    checks.push({
      id: "shipping.state_integrity",
      label: "State machine integrity",
      status: deliveredNoTimestamp === 0 ? "PASS" : "FAIL",
      message: deliveredNoTimestamp > 0 ? `${deliveredNoTimestamp} delivered without timestamp` : "Valid",
    });
    if (deliveredNoTimestamp > 0) status = "FAIL";

    // 5. Shipping provider available
    const hasShippingProvider = hasProvider('shipping');
    checks.push({
      id: "shipping.provider_available",
      label: "Shipping provider available",
      status: hasShippingProvider ? "PASS" : "WARN",
      message: hasShippingProvider ? "Provider registered" : "No provider - manual tracking only",
    });

    return {
      providerId: "shipping",
      status,
      summary: status === "PASS" ? "Shipping healthy" : "Issues detected",
      providerVersion: "2.0",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },
};
```

---

## 10) Doctor Checks

```typescript
// scripts/doctor/phase34-checks.ts

export async function runPhase34Checks(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testPrefix = `doctor_34_${Date.now()}`;

  // 1. Shipment state machine - valid transition
  try {
    const shipment = await prisma.shipment.create({
      data: {
        orderId: `${testPrefix}_order`,
        sellerId: `${testPrefix}_seller`,
        buyerId: `${testPrefix}_buyer`,
        status: 'PENDING',
        fromAddress: {},
        toAddress: {},
      },
    });
    
    const updated = await transitionShipmentStatus(shipment.id, 'LABEL_CREATED', { reason: 'Doctor test' });
    checks.push({
      phase: 34,
      name: "shipping.valid_transition",
      status: updated.status === 'LABEL_CREATED' ? "PASS" : "FAIL",
    });
    
    // 2. Invalid transition blocked
    try {
      await transitionShipmentStatus(shipment.id, 'DELIVERED', { reason: 'Invalid' });
      checks.push({ phase: 34, name: "shipping.invalid_blocked", status: "FAIL" });
    } catch {
      checks.push({ phase: 34, name: "shipping.invalid_blocked", status: "PASS" });
    }
    
    // 3. Status history tracked
    const withHistory = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    const history = (withHistory?.statusHistory as any[]) || [];
    checks.push({
      phase: 34,
      name: "shipping.history_tracked",
      status: history.length >= 1 ? "PASS" : "FAIL",
    });
    
    await prisma.shipment.delete({ where: { id: shipment.id } });
  } catch (error) {
    checks.push({ phase: 34, name: "shipping.state_machine", status: "FAIL", details: String(error) });
  }

  // 4. Label idempotency
  const idempotencyKey = `${testPrefix}_label`;
  for (let i = 0; i < 2; i++) {
    await prisma.shippingLabel.upsert({
      where: { idempotencyKey },
      create: {
        orderId: `${testPrefix}_order`,
        sellerId: `${testPrefix}_seller`,
        carrier: 'USPS',
        carrierCode: 'usps',
        serviceCode: 'priority',
        serviceName: 'Priority Mail',
        trackingNumber: `${testPrefix}_tracking`,
        rateCents: 850,
        totalCostCents: 850,
        sellerPaidCents: 850,
        provider: 'test',
        providerLabelId: `${testPrefix}_provider`,
        fromAddress: {},
        toAddress: {},
        weightOz: 16,
        idempotencyKey,
      },
      update: {},
    });
  }
  const labelCount = await prisma.shippingLabel.count({ where: { idempotencyKey } });
  checks.push({
    phase: 34,
    name: "shipping.label_idempotent",
    status: labelCount === 1 ? "PASS" : "FAIL",
  });

  // 5. ShippingSettings exists
  const settings = await prisma.shippingSettings.findFirst({ where: { isActive: true } });
  checks.push({
    phase: 34,
    name: "shipping.settings_exists",
    status: settings ? "PASS" : "WARN",
    details: settings ? undefined : "Create default settings",
  });

  // 6. Combined shipping rule in profile
  try {
    const profile = await prisma.shippingProfile.create({
      data: {
        sellerId: `${testPrefix}_seller`,
        name: "Doctor Test",
        isDefault: true,
        combinedShippingRule: 'ADDITIONAL_ITEM',
        domesticFirstItemCents: 500,
        domesticAdditionalCents: 100,
      },
    });
    checks.push({
      phase: 34,
      name: "shipping.profile_combined_rule",
      status: profile.combinedShippingRule === 'ADDITIONAL_ITEM' ? "PASS" : "FAIL",
    });
    await prisma.shippingProfile.delete({ where: { id: profile.id } });
  } catch {
    checks.push({ phase: 34, name: "shipping.profile_combined_rule", status: "FAIL" });
  }

  // Cleanup
  await prisma.shippingLabel.deleteMany({ where: { idempotencyKey } });

  return checks;
}
```

---

## 11) Seller APIs

- `GET /api/seller/orders/:orderId/shipping/rates` - get rates
- `POST /api/seller/orders/:orderId/shipping/label` - purchase label
- `POST /api/seller/shipping/labels/:id/void` - void label
- `GET /api/seller/shipping/labels/:id` - get label detail + tracking
- `GET /api/seller/shipping/profiles` - list profiles
- `POST /api/seller/shipping/profiles` - create profile
- `PUT /api/seller/shipping/profiles/:id` - update profile

---

## 12) Corp APIs

- `GET /api/platform/shipping/labels` - list all labels
- `GET /api/platform/shipping/exceptions` - list exceptions
- `POST /api/platform/shipping/exceptions/:id/resolve` - resolve exception
- `GET /api/platform/shipping/settings` - get settings
- `PUT /api/platform/shipping/settings` - update settings
- RBAC: requires `shipping.view` / `shipping.exceptions.resolve` / `settings.shipping.edit`

---

## 13) Phase 34 Completion Criteria

- [ ] All 16 shipping enums created
- [ ] Shipment model with state machine fields
- [ ] ShippingLabel model with idempotency
- [ ] TrackingEvent model with provider reference
- [ ] ShippingException model with severity/resolution
- [ ] ShippingProfile model with combined shipping rules
- [ ] ShippingRate model with provider rate ID
- [ ] ReturnShipment model (NEW)
- [ ] ShippingSettings model (NEW)
- [ ] State machine validates transitions
- [ ] Invalid transitions are rejected
- [ ] Status history tracked on transitions
- [ ] Label purchases are idempotent
- [ ] Tracking events are idempotent
- [ ] Exceptions auto-created on problem statuses
- [ ] All actions emit audit events
- [ ] Health provider `shipping` reports status
- [ ] Doctor passes all Phase 34 checks

---

## 14) What's Next

After Phase 34 completes:
1. **Install shipping provider module** (e.g., Shippo) via Admin → Modules
2. **Enable rate shopping** - real carrier rates
3. **Enable label purchase** - buy USPS/UPS/FedEx labels
4. **Enable tracking webhooks** - live tracking updates

The core shipping system is provider-ready!
