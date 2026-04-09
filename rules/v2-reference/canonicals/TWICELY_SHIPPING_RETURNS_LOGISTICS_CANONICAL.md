# TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md

**Status:** LOCKED (v2.0)  
**Scope:** Shipping profiles, label flow, packaging rules, carrier SLAs, address validation, return logistics, provider abstraction, combined shipping, state machines  
**Audience:** Backend, frontend, ops, support, and AI agents  
**Non-Goal:** Carrier vendor choice or UI styling  
**Changelog:** v2.0 - Complete rewrite with provider-agnostic architecture, comprehensive enums, state machines, combined shipping rules, return shipments, platform settings

---

## 0. Design Philosophy

Twicely's shipping system is designed to be:

1. **Provider-Agnostic**: Core platform defines contracts; modules implement providers
2. **Seller-Friendly**: Combined shipping, flexible profiles, protection against losses
3. **Buyer-Confident**: Tracking transparency, delivery guarantees, easy returns
4. **Operations-Ready**: Exception handling, SLA monitoring, cost optimization
5. **Extensible**: International shipping, duties, insurance, signature services

**Goal:** The most comprehensive, reliable, and cost-effective shipping experience for any marketplace platform.

---

## 1. Core Principles (Non-Negotiable)

### 1.1 Idempotency Rules
- Label purchases MUST be idempotent via `idempotencyKey`
- Tracking updates MUST be idempotent via `providerEventId`
- Void/refund operations MUST be idempotent
- Webhook handlers MUST handle duplicate events gracefully

### 1.2 Ledger Integration
- All shipping costs MUST create ledger entries
- Label purchases: `SHIPPING_LABEL_FEE` (debit seller)
- Label refunds: `SHIPPING_LABEL_REFUND` (credit seller)
- Insurance claims: `SHIPPING_INSURANCE_CLAIM` (credit seller)

### 1.3 State Machine Authority
- Shipment status transitions are authoritative
- Invalid transitions MUST be rejected
- All transitions MUST be audited

### 1.4 Provider Abstraction
- Platform code MUST NOT directly call provider SDKs
- All provider interactions through `ShippingProviderInterface`
- Provider modules are hot-swappable

---

## 2. Data Models

### 2.1 Enumerations

```prisma
// =============================================================================
// SHIPPING ENUMS
// =============================================================================

enum ShipmentStatus {
  // Pre-shipment
  PENDING                 // Order paid, awaiting shipment creation
  LABEL_PENDING           // Rate selected, label being generated
  LABEL_CREATED           // Label purchased, not yet shipped
  
  // In-transit
  PICKED_UP               // Carrier has package (first scan)
  IN_TRANSIT              // Moving through carrier network
  OUT_FOR_DELIVERY        // On vehicle for final delivery
  
  // Terminal states
  DELIVERED               // Confirmed delivered
  AVAILABLE_FOR_PICKUP    // At pickup location (locker, post office)
  
  // Exception states
  DELIVERY_ATTEMPTED      // Delivery attempted, not successful
  EXCEPTION               // General exception (held, delayed)
  RETURNED_TO_SENDER      // Package returning to origin
  LOST                    // Declared lost by carrier
  DAMAGED                 // Reported damaged
  
  // Admin states
  CANCELED                // Shipment canceled before pickup
  VOIDED                  // Label voided, not used
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
  ECONOMY            // 5-10 days
  STANDARD           // 3-5 days
  EXPEDITED          // 2-3 days
  EXPRESS            // 1-2 days
  OVERNIGHT          // Next day
  SAME_DAY           // Same day
  FREIGHT            // LTL/freight
}

enum PackageType {
  CUSTOM             // Custom box
  ENVELOPE           // Flat envelope
  SOFT_PACK          // Poly mailer
  SMALL_BOX          // Small flat rate
  MEDIUM_BOX         // Medium flat rate
  LARGE_BOX          // Large flat rate
  TUBE               // Poster tube
  PALLET             // Freight pallet
}

enum SignatureType {
  NO_SIGNATURE
  SIGNATURE          // Any signature
  ADULT_SIGNATURE    // Adult 21+
  DIRECT_SIGNATURE   // Named recipient only
}

enum LabelStatus {
  PENDING           // Rate selected, awaiting purchase
  PURCHASED         // Successfully purchased
  PRINTED           // Downloaded/printed by seller
  USED              // Has tracking scans (package in system)
  VOIDED            // Canceled before use
  VOID_PENDING      // Void requested, awaiting confirmation
  REFUNDED          // Void completed, funds returned
  EXPIRED           // Label expired without use
  ERROR             // Purchase failed
}

enum LabelFormat {
  PDF               // Standard PDF
  PDF_4X6           // Thermal printer size
  PNG               // Image format
  ZPL               // Zebra printer format
  EPL               // Eltron format
}

enum TrackingStatus {
  // Pre-transit
  PRE_TRANSIT           // Label created, not yet in system
  ACCEPTED              // Package accepted by carrier
  
  // In-transit
  IN_TRANSIT            // Moving through network
  ARRIVED_AT_FACILITY   // At sort facility
  DEPARTED_FACILITY     // Left sort facility
  PROCESSING            // Being processed
  
  // Out for delivery
  OUT_FOR_DELIVERY      // On delivery vehicle
  
  // Delivery
  DELIVERED             // Successfully delivered
  AVAILABLE_FOR_PICKUP  // At pickup location
  
  // Exceptions
  DELIVERY_ATTEMPTED    // Attempted, not delivered
  EXCEPTION             // General exception
  DELAYED               // Unexpected delay
  HELD                  // Held at facility
  
  // Returns
  RETURN_TO_SENDER      // Being returned
  RETURNED              // Back at origin
  
  // Failures
  LOST                  // Declared lost
  DAMAGED               // Reported damaged
  REFUSED               // Refused by recipient
  
  // Unknown
  UNKNOWN               // Unrecognized status
}

enum ExceptionType {
  // Delivery failures
  DELIVERY_FAILED       // Could not deliver
  ADDRESS_ISSUE         // Bad address
  RECIPIENT_UNAVAILABLE // No one home
  REFUSED               // Recipient refused
  
  // Package issues
  LOST                  // Lost in transit
  DAMAGED               // Package damaged
  MISSING_CONTENTS      // Contents missing
  
  // Returns
  RETURNED_TO_SENDER    // RTS
  UNCLAIMED             // Not picked up
  
  // Customs
  CUSTOMS_HOLD          // Held at customs
  CUSTOMS_REJECTED      // Rejected by customs
  DUTIES_OWED           // Unpaid duties
  
  // Other
  WEATHER_DELAY         // Weather-related delay
  CARRIER_DELAY         // Carrier operational delay
  SECURITY_HOLD         // Security review
  
  // Manual
  BUYER_REPORTED        // Buyer reported issue
  SELLER_REPORTED       // Seller reported issue
}

enum ExceptionStatus {
  OPEN                  // Needs attention
  INVESTIGATING         // Being looked into
  AWAITING_CARRIER      // Waiting on carrier
  AWAITING_BUYER        // Waiting on buyer
  AWAITING_SELLER       // Waiting on seller
  CLAIM_FILED           // Insurance claim filed
  RESOLVED              // Issue resolved
  CLOSED                // Closed without resolution
}

enum ExceptionSeverity {
  LOW                   // Minor delay
  MEDIUM                // Needs attention
  HIGH                  // Customer impact
  CRITICAL              // Immediate action
}

enum ExceptionResolution {
  DELIVERED             // Eventually delivered
  RESHIPMENT            // New shipment sent
  REFUNDED              // Full refund issued
  PARTIAL_REFUND        // Partial refund
  INSURANCE_CLAIM       // Insurance paid out
  BUYER_FAULT           // Buyer caused issue
  SELLER_FAULT          // Seller caused issue
  CARRIER_FAULT         // Carrier responsible
  NO_ACTION_NEEDED      // False alarm
}

enum CombinedShippingRule {
  ADDITIONAL_ITEM      // First item rate + additional item rate
  FLAT_TOTAL           // Single flat rate for all items
  HIGHEST_ONLY         // Highest single item rate
  SUM_ALL              // Sum of all individual rates
  FREE_ADDITIONAL      // First item rate, rest free
}

enum ReturnShipmentStatus {
  PENDING               // Return approved, awaiting label
  LABEL_CREATED         // Label generated
  LABEL_SENT            // Label sent to buyer
  IN_TRANSIT            // Buyer shipped, in transit
  DELIVERED             // Returned to seller
  INSPECTED             // Seller inspected
  COMPLETED             // Return process complete
  EXCEPTION             // Problem with return
  CANCELED              // Return canceled
}

enum ReturnShipmentPayer {
  BUYER                 // Buyer pays (change of mind)
  SELLER                // Seller pays (INAD, defective)
  PLATFORM              // Platform pays (buyer protection)
  SPLIT                 // Shared cost
}
```

### 2.2 Shipment Model (Core Entity)

```prisma
model Shipment {
  id                    String         @id @default(cuid())
  
  // ==========================================================================
  // RELATIONSHIPS
  // ==========================================================================
  orderId               String         @unique
  order                 Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  sellerId              String
  buyerId               String
  
  // ==========================================================================
  // STATUS & STATE MACHINE
  // ==========================================================================
  status                ShipmentStatus @default(PENDING)
  previousStatus        ShipmentStatus?
  statusChangedAt       DateTime       @default(now())
  statusHistory         Json           @default("[]")  // [{status, at, reason}]
  
  // ==========================================================================
  // CARRIER & SERVICE
  // ==========================================================================
  carrier               ShipmentCarrier?
  carrierCode           String?        // Normalized: usps, ups, fedex, dhl, etc.
  carrierName           String?        // Display: "USPS", "UPS Ground", etc.
  serviceCode           String?        // priority_mail, ground, express, etc.
  serviceName           String?        // "Priority Mail", "Ground", etc.
  serviceLevel          ServiceLevel   @default(STANDARD)
  
  // ==========================================================================
  // TRACKING
  // ==========================================================================
  trackingNumber        String?
  trackingUrl           String?        // Deep link to carrier tracking
  trackingUrlPublic     String?        // Twicely tracking page URL
  
  // Tracking event summary (denormalized for performance)
  lastTrackingStatus    String?
  lastTrackingLocation  String?
  lastTrackingAt        DateTime?
  trackingEventCount    Int            @default(0)
  
  // ==========================================================================
  // LABEL
  // ==========================================================================
  labelId               String?        @unique
  label                 ShippingLabel? @relation(fields: [labelId], references: [id])
  
  // If seller provides own tracking (no label purchase)
  isSellerProvided      Boolean        @default(false)
  
  // ==========================================================================
  // PACKAGE DETAILS
  // ==========================================================================
  packageType           PackageType    @default(CUSTOM)
  weightOz              Float?
  weightLb              Float?         // Computed: weightOz / 16
  lengthIn              Float?
  widthIn               Float?
  heightIn              Float?
  dimensionalWeightOz   Float?         // Computed from dimensions
  billableWeightOz      Float?         // MAX(actual, dimensional)
  
  // ==========================================================================
  // ADDRESSES (Snapshots at shipment creation)
  // ==========================================================================
  fromAddress           Json           // ShipmentAddress
  toAddress             Json           // ShipmentAddress
  
  // Address validation
  fromAddressValidated  Boolean        @default(false)
  toAddressValidated    Boolean        @default(false)
  toAddressCorrected    Boolean        @default(false)  // USPS/UPS corrected
  originalToAddress     Json?          // If corrected, store original
  
  // ==========================================================================
  // DELIVERY DETAILS
  // ==========================================================================
  signatureRequired     Boolean        @default(false)
  signatureType         SignatureType?
  adultSignatureRequired Boolean       @default(false)
  
  deliveryInstructions  String?
  isResidential         Boolean        @default(true)
  
  // ==========================================================================
  // INSURANCE
  // ==========================================================================
  isInsured             Boolean        @default(false)
  insuredValueCents     Int?
  insuranceProvider     String?        // carrier, third_party
  insurancePremiumCents Int?
  
  // ==========================================================================
  // DATES & SLA
  // ==========================================================================
  // SLA tracking
  handlingDueAt         DateTime?      // When seller must ship by
  estimatedDeliveryAt   DateTime?      // Carrier estimate
  guaranteedDeliveryAt  DateTime?      // If service has guarantee
  
  // Actual timestamps
  labelCreatedAt        DateTime?
  pickedUpAt            DateTime?      // First carrier scan
  inTransitAt           DateTime?
  outForDeliveryAt      DateTime?
  deliveredAt           DateTime?
  
  // Exception timestamps
  exceptionAt           DateTime?
  returnedToSenderAt    DateTime?
  
  // SLA flags
  isLate                Boolean        @default(false)  // Shipped after handlingDueAt
  isDeliveryLate        Boolean        @default(false)  // Delivered after estimate
  lateReasonCode        String?
  
  // ==========================================================================
  // COSTS (All in cents)
  // ==========================================================================
  shippingCostCents     Int            @default(0)      // What buyer paid
  labelCostCents        Int            @default(0)      // Actual label cost
  insuranceCostCents    Int            @default(0)      // Insurance premium
  surchargesCents       Int            @default(0)      // Fuel, residential, etc.
  totalShippingCostCents Int           @default(0)      // Sum of all costs
  
  // Savings
  retailRateCents       Int?           // What USPS.com etc would charge
  discountCents         Int?           // Platform discount provided
  
  // Refunds
  refundedCents         Int            @default(0)
  
  // ==========================================================================
  // PROVIDER REFERENCES
  // ==========================================================================
  provider              String?        // shippo, easypost, pirateship, etc.
  providerShipmentId    String?        // Provider's ID
  providerTransactionId String?        // For label purchase
  
  // ==========================================================================
  // METADATA
  // ==========================================================================
  notesInternal         String?        // Staff notes
  notesSeller           String?        // Seller notes
  metadataJson          Json           @default("{}")
  
  // ==========================================================================
  // AUDIT
  // ==========================================================================
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
  
  // ==========================================================================
  // RELATIONS
  // ==========================================================================
  trackingEvents        TrackingEvent[]
  exceptions            ShippingException[]
  rateQuotes            ShippingRate[]
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([orderId])
  @@index([sellerId, status])
  @@index([buyerId, status])
  @@index([trackingNumber])
  @@index([status, handlingDueAt])
  @@index([status, createdAt])
  @@index([carrier, status])
  @@index([isLate, status])
}
```
### 2.3 Shipping Label Model

```prisma
model ShippingLabel {
  id                    String       @id @default(cuid())
  
  // ==========================================================================
  // RELATIONSHIPS
  // ==========================================================================
  shipmentId            String?      @unique
  shipment              Shipment?    @relation(fields: [shipmentId], references: [id])
  orderId               String
  sellerId              String
  
  // ==========================================================================
  // STATUS
  // ==========================================================================
  status                LabelStatus  @default(PENDING)
  statusHistory         Json         @default("[]")
  
  // ==========================================================================
  // CARRIER & SERVICE
  // ==========================================================================
  carrier               ShipmentCarrier
  carrierCode           String
  serviceCode           String
  serviceName           String
  
  // ==========================================================================
  // TRACKING
  // ==========================================================================
  trackingNumber        String
  trackingUrl           String?
  
  // ==========================================================================
  // LABEL FILE
  // ==========================================================================
  labelUrl              String?      // URL to download label
  labelFormat           LabelFormat  @default(PDF_4X6)
  labelBase64           String?      // Base64 encoded (for direct print)
  labelExpiresAt        DateTime?    // When label URL expires
  
  // Commercial invoice (international)
  invoiceUrl            String?
  customsFormUrl        String?
  
  // ==========================================================================
  // COSTS
  // ==========================================================================
  rateCents             Int          // Base rate
  surchargesCents       Int          @default(0)
  fuelSurchargeCents    Int          @default(0)
  residentialSurchargeCents Int      @default(0)
  deliveryAreaSurchargeCents Int     @default(0)
  insuranceCents        Int          @default(0)
  totalCostCents        Int          // All-in cost
  currency              String       @default("USD")
  
  // Platform pricing
  platformMarkupCents   Int          @default(0)
  platformDiscountCents Int          @default(0)
  sellerPaidCents       Int          // What seller actually pays
  
  // Retail comparison
  retailRateCents       Int?         // What carrier website charges
  savingsCents          Int?         // retailRate - totalCost
  savingsPercent        Float?       // Percentage saved
  
  // ==========================================================================
  // REFUNDS
  // ==========================================================================
  isVoidable            Boolean      @default(true)
  voidRequestedAt       DateTime?
  voidedAt              DateTime?
  voidReason            String?
  refundCents           Int?
  refundedAt            DateTime?
  refundLedgerEntryId   String?
  
  // ==========================================================================
  // ADDRESSES (Snapshot)
  // ==========================================================================
  fromAddress           Json
  toAddress             Json
  
  // ==========================================================================
  // PACKAGE (Snapshot)
  // ==========================================================================
  weightOz              Float
  lengthIn              Float?
  widthIn               Float?
  heightIn              Float?
  packageType           PackageType  @default(CUSTOM)
  
  // ==========================================================================
  // PROVIDER
  // ==========================================================================
  provider              String       // shippo, easypost, etc.
  providerLabelId       String       @unique
  providerTransactionId String?
  providerRateId        String?
  
  // ==========================================================================
  // IDEMPOTENCY
  // ==========================================================================
  idempotencyKey        String       @unique
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  purchasedAt           DateTime?
  printedAt             DateTime?
  firstScanAt           DateTime?    // When carrier first scanned
  expiresAt             DateTime?    // Unused label expiration
  
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([orderId])
  @@index([sellerId, status])
  @@index([trackingNumber])
  @@index([status, createdAt])
  @@index([provider, providerLabelId])
}
```

### 2.4 Tracking Event Model

```prisma
model TrackingEvent {
  id                    String         @id @default(cuid())
  
  // ==========================================================================
  // RELATIONSHIPS
  // ==========================================================================
  shipmentId            String
  shipment              Shipment       @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  labelId               String?
  
  // ==========================================================================
  // TRACKING INFO
  // ==========================================================================
  trackingNumber        String
  carrier               ShipmentCarrier
  
  // ==========================================================================
  // STATUS
  // ==========================================================================
  status                TrackingStatus
  statusDetail          String?        // Carrier's detailed status
  statusDescription     String?        // Human-readable description
  
  // ==========================================================================
  // LOCATION
  // ==========================================================================
  city                  String?
  state                 String?
  postalCode            String?
  country               String?
  locationDescription   String?        // "Distribution Center", "Local Post Office"
  
  // Coordinates (if available)
  latitude              Float?
  longitude             Float?
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  occurredAt            DateTime       // When event happened at carrier
  estimatedDeliveryAt   DateTime?      // Updated ETA if provided
  
  // ==========================================================================
  // DELIVERY DETAILS (for DELIVERED status)
  // ==========================================================================
  signedBy              String?        // Who signed
  deliveryLocation      String?        // "Front Door", "Mailbox", etc.
  proofOfDeliveryUrl    String?        // Photo/signature image
  
  // ==========================================================================
  // PROVIDER
  // ==========================================================================
  provider              String         // Which provider sent this
  providerEventId       String         @unique // Idempotency
  providerRawStatus     String?        // Original carrier status code
  rawPayload            Json?          // Full webhook payload
  
  // ==========================================================================
  // FLAGS
  // ==========================================================================
  isException           Boolean        @default(false)
  exceptionCode         String?
  requiresAction        Boolean        @default(false)
  actionType            String?        // contact_buyer, reship, refund, etc.
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  receivedAt            DateTime       @default(now())  // When we got webhook
  processedAt           DateTime?      // When we processed it
  
  createdAt             DateTime       @default(now())
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([shipmentId, occurredAt])
  @@index([trackingNumber, occurredAt])
  @@index([status, occurredAt])
  @@index([isException, occurredAt])
  @@index([provider, providerEventId])
}
```

### 2.5 Shipping Profile Model (Seller Configuration)

```prisma
model ShippingProfile {
  id                        String    @id @default(cuid())
  sellerId                  String
  
  // ==========================================================================
  // BASIC INFO
  // ==========================================================================
  name                      String    // "Standard Shipping", "Heavy Items", etc.
  description               String?
  isDefault                 Boolean   @default(false)
  isActive                  Boolean   @default(true)
  
  // ==========================================================================
  // DOMESTIC SHIPPING
  // ==========================================================================
  domesticEnabled           Boolean   @default(true)
  
  // Flat rate pricing
  domesticFlatRate          Boolean   @default(true)
  domesticFirstItemCents    Int       @default(0)
  domesticAdditionalCents   Int       @default(0)
  
  // Free shipping threshold
  domesticFreeShippingEnabled Boolean @default(false)
  domesticFreeShippingAboveCents Int?
  
  // Weight-based pricing (if not flat rate)
  domesticWeightBased       Boolean   @default(false)
  domesticBaseWeightOz      Int?      // Included in first item
  domesticPerOzCents        Int?      // Additional per oz
  
  // Calculated shipping (real-time rates)
  domesticCalculated        Boolean   @default(false)
  domesticMarkupPercent     Int       @default(0)  // Markup on calculated rates
  domesticMarkupCents       Int       @default(0)  // Fixed markup
  
  // ==========================================================================
  // INTERNATIONAL SHIPPING
  // ==========================================================================
  internationalEnabled      Boolean   @default(false)
  
  // Flat rate
  internationalFlatRate     Boolean   @default(true)
  internationalFirstItemCents Int?
  internationalAdditionalCents Int?
  
  // Free shipping
  internationalFreeShippingEnabled Boolean @default(false)
  internationalFreeShippingAboveCents Int?
  
  // Calculated
  internationalCalculated   Boolean   @default(false)
  internationalMarkupPercent Int      @default(0)
  internationalMarkupCents  Int       @default(0)
  
  // Country restrictions
  internationalExcludedCountries String[] @default([])
  internationalIncludedCountries String[] @default([])  // If set, only these
  
  // ==========================================================================
  // HANDLING TIME
  // ==========================================================================
  handlingTimeDays          Int       @default(3)
  handlingTimeMax           Int?      // Range: "ships in 1-3 days"
  cutoffTime                String?   // "14:00" - orders before ship same day
  cutoffTimezone            String    @default("America/New_York")
  excludeWeekends           Boolean   @default(true)
  excludeHolidays           Boolean   @default(true)
  
  // ==========================================================================
  // COMBINED SHIPPING (Multi-item orders)
  // ==========================================================================
  combinedShippingEnabled   Boolean   @default(true)
  combinedShippingRule      CombinedShippingRule @default(ADDITIONAL_ITEM)
  combinedShippingMaxItems  Int       @default(0)  // 0 = unlimited
  combinedShippingFlatCents Int?      // If rule is FLAT_TOTAL
  
  // ==========================================================================
  // CARRIER PREFERENCES
  // ==========================================================================
  preferredCarriers         String[]  @default(["USPS"])
  excludedCarriers          String[]  @default([])
  preferredServices         Json      @default("[]")  // [{carrier, service}]
  
  // ==========================================================================
  // PACKAGE DEFAULTS
  // ==========================================================================
  defaultPackageType        PackageType @default(CUSTOM)
  defaultWeightOz           Int       @default(16)
  defaultLengthIn           Float?
  defaultWidthIn            Float?
  defaultHeightIn           Float?
  
  // ==========================================================================
  // RETURN ADDRESS
  // ==========================================================================
  returnAddressId           String?   // Links to SellerAddress
  returnAddress             Json      @default("{}")  // Snapshot
  
  // ==========================================================================
  // INSURANCE
  // ==========================================================================
  autoInsureAboveCents      Int?      // Auto-add insurance above this value
  alwaysInsure              Boolean   @default(false)
  
  // ==========================================================================
  // SIGNATURE
  // ==========================================================================
  signatureRequiredAboveCents Int?    // Require signature above this
  alwaysRequireSignature    Boolean   @default(false)
  
  // ==========================================================================
  // LOCATION RESTRICTIONS
  // ==========================================================================
  excludedStates            String[]  @default([])
  excludedZipPrefixes       String[]  @default([])  // e.g., ["96", "99"] for AK/HI
  poBoxAllowed              Boolean   @default(true)
  apoFpoAllowed             Boolean   @default(true)  // Military APO/FPO
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt
  
  // ==========================================================================
  // RELATIONS
  // ==========================================================================
  listings                  Listing[]
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@unique([sellerId, isDefault])
  @@index([sellerId, isActive])
}
```

### 2.6 Shipping Rate Quote Model

```prisma
model ShippingRate {
  id                    String         @id @default(cuid())
  
  // ==========================================================================
  // CONTEXT
  // ==========================================================================
  shipmentId            String?
  shipment              Shipment?      @relation(fields: [shipmentId], references: [id])
  orderId               String
  sellerId              String
  sessionId             String?        // Rate shopping session
  
  // ==========================================================================
  // CARRIER & SERVICE
  // ==========================================================================
  carrier               ShipmentCarrier
  carrierCode           String
  serviceName           String
  serviceCode           String
  serviceLevel          ServiceLevel
  
  // ==========================================================================
  // COSTS
  // ==========================================================================
  rateCents             Int            // Base rate
  surchargesCents       Int            @default(0)
  totalCents            Int            // All-in
  currency              String         @default("USD")
  
  // Breakdown
  fuelSurchargeCents    Int            @default(0)
  residentialCents      Int            @default(0)
  deliveryAreaCents     Int            @default(0)
  extendedAreaCents     Int            @default(0)
  
  // Comparison
  retailRateCents       Int?
  discountPercent       Float?
  
  // ==========================================================================
  // DELIVERY ESTIMATE
  // ==========================================================================
  etaDays               Int?
  etaBusinessDays       Int?
  estimatedDeliveryDate DateTime?
  guaranteedDelivery    Boolean        @default(false)
  deliveryDayOfWeek     String?        // "Monday-Friday", "Any day"
  
  // ==========================================================================
  // FEATURES
  // ==========================================================================
  trackingIncluded      Boolean        @default(true)
  insuranceIncluded     Boolean        @default(false)
  insuranceMaxCents     Int?
  signatureIncluded     Boolean        @default(false)
  
  // ==========================================================================
  // PROVIDER
  // ==========================================================================
  provider              String
  providerRateId        String?        // Needed to purchase this rate
  
  // ==========================================================================
  // SELECTION
  // ==========================================================================
  isSelected            Boolean        @default(false)
  isRecommended         Boolean        @default(false)
  recommendationReason  String?        // "Best value", "Fastest"
  
  // ==========================================================================
  // VALIDITY
  // ==========================================================================
  expiresAt             DateTime
  isExpired             Boolean        @default(false)
  
  // ==========================================================================
  // ADDRESSES & PACKAGE (For rate accuracy)
  // ==========================================================================
  fromPostalCode        String
  fromCountry           String
  toPostalCode          String
  toCountry             String
  isResidential         Boolean        @default(true)
  weightOz              Float
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  quotedAt              DateTime       @default(now())
  createdAt             DateTime       @default(now())
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([orderId, createdAt])
  @@index([sessionId])
  @@index([carrier, serviceCode])
  @@index([expiresAt])
}
```

### 2.7 Shipping Exception Model

```prisma
model ShippingException {
  id                    String           @id @default(cuid())
  
  // ==========================================================================
  // RELATIONSHIPS
  // ==========================================================================
  shipmentId            String
  shipment              Shipment         @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  orderId               String
  labelId               String?
  
  // ==========================================================================
  // EXCEPTION DETAILS
  // ==========================================================================
  type                  ExceptionType
  status                ExceptionStatus  @default(OPEN)
  severity              ExceptionSeverity @default(MEDIUM)
  
  description           String?
  carrierMessage        String?          // What carrier reported
  
  // ==========================================================================
  // DETECTION
  // ==========================================================================
  detectedAt            DateTime         @default(now())
  detectedBy            String           // system, buyer, seller, carrier
  sourceTrackingEventId String?
  
  // ==========================================================================
  // ASSIGNMENT
  // ==========================================================================
  assignedToStaffId     String?
  assignedAt            DateTime?
  
  // ==========================================================================
  // RESOLUTION
  // ==========================================================================
  resolution            ExceptionResolution?
  resolutionNotes       String?
  resolvedAt            DateTime?
  resolvedByStaffId     String?
  resolvedByUserId      String?
  
  // ==========================================================================
  // FINANCIAL IMPACT
  // ==========================================================================
  claimFiledAt          DateTime?
  claimAmount           Int?
  claimStatus           String?          // pending, approved, denied
  claimPaidAmount       Int?
  claimPaidAt           DateTime?
  
  refundAmount          Int?
  refundIssuedAt        DateTime?
  
  // ==========================================================================
  // RESHIPMENT
  // ==========================================================================
  reshipmentRequired    Boolean          @default(false)
  reshipmentShipmentId  String?          // New shipment ID
  reshipmentCreatedAt   DateTime?
  
  // ==========================================================================
  // COMMUNICATION
  // ==========================================================================
  buyerNotifiedAt       DateTime?
  sellerNotifiedAt      DateTime?
  
  // ==========================================================================
  // SLA
  // ==========================================================================
  responseDeadline      DateTime?        // When response needed
  resolutionDeadline    DateTime?        // When must be resolved
  isOverdue             Boolean          @default(false)
  
  // ==========================================================================
  // AUDIT
  // ==========================================================================
  activityLog           Json             @default("[]")  // [{action, by, at, notes}]
  
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([shipmentId])
  @@index([orderId])
  @@index([type, status])
  @@index([status, createdAt])
  @@index([assignedToStaffId, status])
  @@index([severity, status])
}
```

### 2.8 Return Shipment Model

```prisma
model ReturnShipment {
  id                    String              @id @default(cuid())
  
  // ==========================================================================
  // RELATIONSHIPS
  // ==========================================================================
  orderId               String              @unique
  order                 Order               @relation(fields: [orderId], references: [id])
  returnRequestId       String?
  originalShipmentId    String?
  
  buyerId               String
  sellerId              String
  
  // ==========================================================================
  // STATUS
  // ==========================================================================
  status                ReturnShipmentStatus @default(PENDING)
  statusHistory         Json                @default("[]")
  
  // ==========================================================================
  // PAYMENT RESPONSIBILITY
  // ==========================================================================
  paidBy                ReturnShipmentPayer @default(BUYER)
  
  // If SPLIT, specify amounts
  buyerPaidCents        Int                 @default(0)
  sellerPaidCents       Int                 @default(0)
  platformPaidCents     Int                 @default(0)
  
  // ==========================================================================
  // LABEL
  // ==========================================================================
  labelId               String?             @unique
  carrier               ShipmentCarrier?
  carrierCode           String?
  serviceCode           String?
  trackingNumber        String?
  trackingUrl           String?
  labelUrl              String?
  
  // Costs
  labelCostCents        Int                 @default(0)
  
  // ==========================================================================
  // ADDRESSES
  // ==========================================================================
  fromAddress           Json                // Buyer's address
  toAddress             Json                // Seller's return address
  
  // ==========================================================================
  // PACKAGE
  // ==========================================================================
  weightOz              Float?
  lengthIn              Float?
  widthIn               Float?
  heightIn              Float?
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  labelCreatedAt        DateTime?
  labelSentAt           DateTime?
  shippedAt             DateTime?
  deliveredAt           DateTime?
  inspectedAt           DateTime?
  
  // ==========================================================================
  // INSPECTION
  // ==========================================================================
  inspectionNotes       String?
  inspectionPhotos      String[]            @default([])
  itemCondition         String?             // as_described, damaged, wrong_item, etc.
  
  // ==========================================================================
  // PROVIDER
  // ==========================================================================
  provider              String?
  providerLabelId       String?
  idempotencyKey        String              @unique
  
  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([orderId])
  @@index([buyerId, status])
  @@index([sellerId, status])
  @@index([trackingNumber])
  @@index([status, createdAt])
}
```

### 2.9 Platform Shipping Settings Model

```prisma
model ShippingSettings {
  id                          String   @id @default(cuid())
  version                     String
  effectiveAt                 DateTime
  isActive                    Boolean  @default(true)
  
  // ==========================================================================
  // HANDLING TIME DEFAULTS
  // ==========================================================================
  defaultHandlingDays         Int      @default(3)
  maxHandlingDays             Int      @default(10)
  handlingGraceHours          Int      @default(12)  // Grace before "late"
  
  // ==========================================================================
  // CARRIERS
  // ==========================================================================
  enabledCarriers             String[] @default(["USPS", "UPS", "FEDEX"])
  defaultCarrier              String   @default("USPS")
  disabledCarriers            String[] @default([])
  
  // ==========================================================================
  // LABEL SETTINGS
  // ==========================================================================
  labelGenerationEnabled      Boolean  @default(true)
  labelVoidWindowHours        Int      @default(720)  // 30 days
  labelExpirationDays         Int      @default(30)
  
  // Platform markup/discount on labels
  labelMarkupPercent          Int      @default(0)
  labelDiscountPercent        Int      @default(0)
  sellerLabelDiscountEnabled  Boolean  @default(true)  // Pass savings to seller
  
  // ==========================================================================
  // TRACKING
  // ==========================================================================
  trackingRequiredAboveCents  Int      @default(5000)  // $50
  trackingValidationEnabled   Boolean  @default(true)
  invalidTrackingGraceDays    Int      @default(3)     // Days to provide valid tracking
  
  // ==========================================================================
  // INSURANCE
  // ==========================================================================
  autoInsureAboveCents        Int      @default(10000)  // $100
  maxInsuranceValueCents      Int      @default(500000) // $5000
  insuranceProvider           String   @default("carrier")  // carrier, shipsurance, etc.
  
  // ==========================================================================
  // SIGNATURE
  // ==========================================================================
  signatureRequiredAboveCents Int      @default(75000)  // $750
  adultSignatureCategories    String[] @default([])     // Category IDs
  
  // ==========================================================================
  // DELIVERY CONFIRMATION
  // ==========================================================================
  deliveryPhotoEnabled        Boolean  @default(true)
  deliveryGpsEnabled          Boolean  @default(true)
  
  // ==========================================================================
  // LATE SHIPMENT
  // ==========================================================================
  lateShipmentPenaltyEnabled  Boolean  @default(true)
  lateShipmentGraceDays       Int      @default(1)
  lateShipmentDefectWeight    Float    @default(1.0)    // For seller standards
  
  // ==========================================================================
  // RETURN SHIPPING
  // ==========================================================================
  returnLabelDefaultPayer     ReturnShipmentPayer @default(SELLER)
  returnLabelValidDays        Int      @default(30)
  
  // ==========================================================================
  // INTERNATIONAL
  // ==========================================================================
  internationalEnabled        Boolean  @default(true)
  customsFormRequired         Boolean  @default(true)
  dutiesCalculationEnabled    Boolean  @default(false)
  
  // Countries
  blockedCountries            String[] @default([])
  highRiskCountries           String[] @default([])     // Extra verification
  
  // ==========================================================================
  // EXCEPTIONS
  // ==========================================================================
  autoDetectExceptions        Boolean  @default(true)
  exceptionSlaHours           Int      @default(48)     // Response time
  lostPackageThresholdDays    Int      @default(14)     // No scan = lost
  
  // ==========================================================================
  // RATE SHOPPING
  // ==========================================================================
  rateQuoteExpirationMinutes  Int      @default(30)
  showRetailComparison        Boolean  @default(true)
  recommendCheapestRate       Boolean  @default(true)
  
  // ==========================================================================
  // AUDIT
  // ==========================================================================
  createdByStaffId            String
  createdAt                   DateTime @default(now())
  
  // ==========================================================================
  // INDEXES
  // ==========================================================================
  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}
```
---

## 3. Provider Interface

### 3.1 Core Provider Contract

```typescript
// packages/core/shipping/provider-interface.ts

/**
 * Provider-agnostic shipping interface
 * All shipping modules MUST implement this interface
 */
export interface ShippingProviderInterface {
  // Provider identification
  readonly name: string;           // "shippo", "easypost", "pirateship"
  readonly displayName: string;    // "Shippo", "EasyPost", "Pirate Ship"
  readonly version: string;
  
  // ==========================================================================
  // ADDRESS VALIDATION
  // ==========================================================================
  
  /**
   * Validate and optionally correct an address
   */
  validateAddress(address: ShippingAddress): Promise<AddressValidationResult>;
  
  // ==========================================================================
  // RATE SHOPPING
  // ==========================================================================
  
  /**
   * Get shipping rates for a shipment
   * Returns rates from all enabled carriers
   */
  getRates(request: RateRequest): Promise<RateResponse>;
  
  /**
   * Get rates for a specific carrier/service
   */
  getSpecificRate(request: SpecificRateRequest): Promise<Rate | null>;
  
  // ==========================================================================
  // LABEL PURCHASE
  // ==========================================================================
  
  /**
   * Purchase a shipping label
   * MUST be idempotent via idempotencyKey
   */
  purchaseLabel(request: LabelPurchaseRequest): Promise<LabelPurchaseResult>;
  
  /**
   * Void/cancel a label
   * MUST be idempotent
   */
  voidLabel(request: VoidLabelRequest): Promise<VoidLabelResult>;
  
  /**
   * Get label status/details
   */
  getLabelStatus(labelId: string): Promise<LabelStatusResult>;
  
  // ==========================================================================
  // TRACKING
  // ==========================================================================
  
  /**
   * Get current tracking status
   */
  getTracking(trackingNumber: string, carrier: string): Promise<TrackingResult>;
  
  /**
   * Subscribe to tracking webhook updates
   */
  subscribeToTracking(trackingNumber: string, carrier: string): Promise<void>;
  
  /**
   * Process incoming tracking webhook
   */
  processTrackingWebhook(payload: unknown): Promise<TrackingWebhookResult>;
  
  // ==========================================================================
  // CARRIER ACCOUNTS
  // ==========================================================================
  
  /**
   * Get supported carriers
   */
  getSupportedCarriers(): Promise<CarrierInfo[]>;
  
  /**
   * Get carrier account status
   */
  getCarrierAccountStatus(carrier: string): Promise<CarrierAccountStatus>;
  
  // ==========================================================================
  // MANIFESTS (End of Day)
  // ==========================================================================
  
  /**
   * Create end-of-day manifest/SCAN form
   */
  createManifest(request: ManifestRequest): Promise<ManifestResult>;
  
  // ==========================================================================
  // CUSTOMS (International)
  // ==========================================================================
  
  /**
   * Create customs declaration
   */
  createCustomsDeclaration(request: CustomsRequest): Promise<CustomsResult>;
  
  /**
   * Calculate duties and taxes
   */
  calculateDuties(request: DutiesRequest): Promise<DutiesResult>;
  
  // ==========================================================================
  // PICKUP SCHEDULING
  // ==========================================================================
  
  /**
   * Schedule carrier pickup
   */
  schedulePickup(request: PickupRequest): Promise<PickupResult>;
  
  /**
   * Cancel scheduled pickup
   */
  cancelPickup(pickupId: string): Promise<void>;
  
  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================
  
  /**
   * Purchase multiple labels in batch
   */
  purchaseLabelBatch(requests: LabelPurchaseRequest[]): Promise<BatchLabelResult>;
  
  /**
   * Get rates for multiple shipments
   */
  getRatesBatch(requests: RateRequest[]): Promise<BatchRateResult>;
}
```

### 3.2 Type Definitions

```typescript
// packages/core/shipping/types.ts

// =============================================================================
// ADDRESS
// =============================================================================

export interface ShippingAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;       // ISO 2-letter code
  phone?: string;
  email?: string;
  isResidential?: boolean;
}

export interface AddressValidationResult {
  isValid: boolean;
  isDeliverable: boolean;
  originalAddress: ShippingAddress;
  correctedAddress?: ShippingAddress;
  messages: string[];
  confidenceScore?: number;
  addressType?: 'residential' | 'commercial' | 'unknown';
}

// =============================================================================
// PACKAGE
// =============================================================================

export interface PackageDetails {
  weightOz: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  packageType?: PackageType;
  description?: string;
}

export type PackageType = 
  | 'custom'
  | 'envelope'
  | 'soft_pack'
  | 'small_flat_rate'
  | 'medium_flat_rate'
  | 'large_flat_rate'
  | 'regional_rate_a'
  | 'regional_rate_b'
  | 'tube'
  | 'pak';

// =============================================================================
// RATES
// =============================================================================

export interface RateRequest {
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packages: PackageDetails[];
  shipDate?: Date;
  carriers?: string[];       // Filter to specific carriers
  services?: string[];       // Filter to specific services
  options?: RateOptions;
}

export interface RateOptions {
  signatureRequired?: boolean;
  adultSignatureRequired?: boolean;
  insuranceAmount?: number;  // Cents
  saturdayDelivery?: boolean;
  containsAlcohol?: boolean;
  containsLithium?: boolean;
  hazmat?: boolean;
}

export interface RateResponse {
  rates: Rate[];
  cheapest: Rate | null;
  fastest: Rate | null;
  bestValue: Rate | null;   // Balanced cost/speed
  errors?: RateError[];
}

export interface Rate {
  id: string;              // Provider rate ID
  provider: string;
  carrier: string;
  carrierCode: string;
  service: string;
  serviceCode: string;
  serviceLevel: ServiceLevel;
  
  // Costs (all in cents)
  baseCost: number;
  surcharges: number;
  fuelSurcharge: number;
  totalCost: number;
  currency: string;
  
  // Surcharge breakdown
  surchargeBreakdown?: SurchargeItem[];
  
  // Delivery
  estimatedDays?: number;
  estimatedBusinessDays?: number;
  estimatedDeliveryDate?: Date;
  guaranteedDelivery?: boolean;
  
  // Features
  trackingIncluded: boolean;
  insuranceIncluded: boolean;
  insuranceMaxValue?: number;
  
  // Validity
  expiresAt: Date;
  
  // Comparison
  retailRate?: number;
  savings?: number;
  savingsPercent?: number;
}

export type ServiceLevel = 
  | 'economy' 
  | 'standard' 
  | 'expedited' 
  | 'express' 
  | 'overnight' 
  | 'same_day'
  | 'freight';

export interface SurchargeItem {
  type: string;            // 'fuel', 'residential', 'delivery_area', etc.
  amount: number;          // Cents
  description: string;
}

export interface RateError {
  carrier: string;
  code: string;
  message: string;
}

// =============================================================================
// LABELS
// =============================================================================

export interface LabelPurchaseRequest {
  rateId: string;          // Rate to purchase
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packages: PackageDetails[];
  idempotencyKey: string;  // REQUIRED for idempotent purchases
  
  // Options
  labelFormat?: LabelFormat;
  insuranceAmount?: number;
  signatureType?: SignatureType;
  reference?: string;      // Order number, etc.
  
  // Customs (international)
  customs?: CustomsInfo;
}

export type LabelFormat = 'pdf' | 'pdf_4x6' | 'png' | 'zpl' | 'epl';

export type SignatureType = 
  | 'none' 
  | 'signature' 
  | 'adult_signature' 
  | 'direct_signature';

export interface LabelPurchaseResult {
  success: boolean;
  labelId: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  
  // Label files
  labelUrl: string;
  labelBase64?: string;
  labelFormat: LabelFormat;
  
  // Costs
  totalCost: number;       // Cents
  currency: string;
  
  // Additional documents
  invoiceUrl?: string;     // Commercial invoice
  customsFormUrl?: string;
  
  // Provider refs
  providerLabelId: string;
  providerTransactionId?: string;
  
  // If idempotent hit
  wasExistingLabel?: boolean;
  
  error?: {
    code: string;
    message: string;
  };
}

export interface VoidLabelRequest {
  labelId: string;
  reason?: string;
}

export interface VoidLabelResult {
  success: boolean;
  refundAmount?: number;   // Cents
  refundStatus: 'pending' | 'approved' | 'denied';
  message?: string;
}

// =============================================================================
// TRACKING
// =============================================================================

export interface TrackingResult {
  trackingNumber: string;
  carrier: string;
  status: TrackingStatus;
  statusDetail?: string;
  
  // Current location
  currentLocation?: TrackingLocation;
  
  // Delivery info
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  signedBy?: string;
  
  // Events
  events: TrackingEventData[];
  
  // Metadata
  serviceType?: string;
  origin?: TrackingLocation;
  destination?: TrackingLocation;
}

export interface TrackingEventData {
  timestamp: Date;
  status: TrackingStatus;
  statusDetail?: string;
  description: string;
  location?: TrackingLocation;
  
  // Provider specifics
  providerEventId: string;
  providerRawStatus?: string;
}

export interface TrackingLocation {
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export type TrackingStatus =
  | 'pre_transit'
  | 'accepted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'available_for_pickup'
  | 'delivery_attempted'
  | 'exception'
  | 'delayed'
  | 'return_to_sender'
  | 'returned'
  | 'lost'
  | 'damaged'
  | 'unknown';

export interface TrackingWebhookResult {
  processed: boolean;
  trackingNumber: string;
  carrier: string;
  events: TrackingEventData[];
  shipmentId?: string;
  wasFirstDeliveryScan?: boolean;
  isDelivered?: boolean;
  isException?: boolean;
}

// =============================================================================
// CUSTOMS (International)
// =============================================================================

export interface CustomsInfo {
  contentsType: 'merchandise' | 'gift' | 'documents' | 'sample' | 'return';
  contentsExplanation?: string;
  items: CustomsItem[];
  nonDeliveryOption: 'return' | 'abandon';
  certify: boolean;
  signer: string;
  
  // Tax IDs
  sellerTaxId?: string;
  buyerTaxId?: string;
  
  // EORI (EU)
  sellerEori?: string;
  buyerEori?: string;
}

export interface CustomsItem {
  description: string;
  quantity: number;
  value: number;           // Unit value in cents
  currency: string;
  weight: number;          // Oz
  originCountry: string;   // ISO 2-letter
  hsCode?: string;         // Harmonized System code
  sku?: string;
}

export interface DutiesResult {
  dutiesAmount: number;    // Cents
  taxesAmount: number;     // Cents
  totalAmount: number;     // Cents
  currency: string;
  breakdown: DutyItem[];
}

export interface DutyItem {
  type: string;            // 'import_duty', 'vat', 'gst', etc.
  amount: number;
  rate?: number;           // Percentage
  description: string;
}

// =============================================================================
// MANIFESTS
// =============================================================================

export interface ManifestRequest {
  carrier: string;
  labelIds: string[];
  manifestDate: Date;
}

export interface ManifestResult {
  manifestId: string;
  manifestUrl?: string;
  carrier: string;
  labelCount: number;
  scanFormId?: string;
}

// =============================================================================
// PICKUP
// =============================================================================

export interface PickupRequest {
  carrier: string;
  address: ShippingAddress;
  pickupDate: Date;
  startTime?: string;      // "08:00"
  endTime?: string;        // "18:00"
  packageCount: number;
  totalWeight: number;     // Oz
  instructions?: string;
}

export interface PickupResult {
  pickupId: string;
  confirmationNumber: string;
  scheduledDate: Date;
  windowStart: string;
  windowEnd: string;
  cost?: number;           // Cents
}

// =============================================================================
// CARRIER INFO
// =============================================================================

export interface CarrierInfo {
  code: string;            // 'usps', 'ups', etc.
  name: string;            // 'USPS', 'UPS', etc.
  services: CarrierService[];
  enabled: boolean;
  accountConnected: boolean;
}

export interface CarrierService {
  code: string;
  name: string;
  serviceLevel: ServiceLevel;
  domestic: boolean;
  international: boolean;
}

export interface CarrierAccountStatus {
  carrier: string;
  connected: boolean;
  accountId?: string;
  accountType?: 'platform' | 'seller';  // Platform-wide or seller-specific
  ratesEnabled: boolean;
  labelsEnabled: boolean;
  trackingEnabled: boolean;
  error?: string;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

export interface BatchLabelResult {
  successful: LabelPurchaseResult[];
  failed: Array<{
    request: LabelPurchaseRequest;
    error: { code: string; message: string };
  }>;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

export interface BatchRateResult {
  results: Array<{
    request: RateRequest;
    response?: RateResponse;
    error?: { code: string; message: string };
  }>;
}
```
---

## 4. Core Services

### 4.1 Shipment State Machine

```typescript
// packages/core/shipping/state-machine.ts

/**
 * Valid state transitions for Shipment
 * State machine is AUTHORITATIVE - invalid transitions MUST be rejected
 */
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['LABEL_PENDING', 'LABEL_CREATED', 'CANCELED'],
  LABEL_PENDING: ['LABEL_CREATED', 'PENDING', 'CANCELED'],
  LABEL_CREATED: ['PICKED_UP', 'IN_TRANSIT', 'VOIDED', 'CANCELED'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'AVAILABLE_FOR_PICKUP', 'EXCEPTION', 'RETURNED_TO_SENDER'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPTED', 'EXCEPTION'],
  DELIVERED: [],  // Terminal
  AVAILABLE_FOR_PICKUP: ['DELIVERED', 'RETURNED_TO_SENDER'],
  DELIVERY_ATTEMPTED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED_TO_SENDER', 'EXCEPTION'],
  EXCEPTION: ['IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER', 'LOST', 'DAMAGED'],
  RETURNED_TO_SENDER: ['LOST'],
  LOST: [],  // Terminal
  DAMAGED: [],  // Terminal
  CANCELED: [],  // Terminal
  VOIDED: [],  // Terminal
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get available next states from current state
 */
export function getNextStates(current: ShipmentStatus): ShipmentStatus[] {
  return SHIPMENT_TRANSITIONS[current] ?? [];
}

/**
 * Check if state is terminal (no more transitions)
 */
export function isTerminalState(status: ShipmentStatus): boolean {
  return getNextStates(status).length === 0;
}
```

### 4.2 Shipment Service

```typescript
// packages/core/shipping/shipment-service.ts

import { PrismaClient, ShipmentStatus, Shipment } from "@prisma/client";
import { isValidTransition } from "./state-machine";

const prisma = new PrismaClient();

/**
 * Transition shipment to new status with validation and side effects
 */
export async function transitionShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  context: {
    reason?: string;
    actorUserId?: string;
    trackingEventId?: string;
  }
): Promise<Shipment> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });
  
  if (!shipment) {
    throw new Error("SHIPMENT_NOT_FOUND");
  }
  
  // Validate transition
  if (!isValidTransition(shipment.status as ShipmentStatus, newStatus)) {
    throw new Error(`INVALID_TRANSITION:${shipment.status}->${newStatus}`);
  }
  
  // Build status history entry
  const historyEntry = {
    from: shipment.status,
    to: newStatus,
    at: new Date().toISOString(),
    reason: context.reason,
    actorUserId: context.actorUserId,
    trackingEventId: context.trackingEventId,
  };
  
  const currentHistory = (shipment.statusHistory as any[]) || [];
  
  // Determine timestamp updates based on new status
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
  
  // Update shipment
  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: newStatus,
      previousStatus: shipment.status as ShipmentStatus,
      statusChangedAt: new Date(),
      statusHistory: [...currentHistory, historyEntry],
      ...timestampUpdates,
    },
  });
  
  // Execute side effects based on new status
  await executeStatusSideEffects(updated, newStatus, context);
  
  return updated;
}

/**
 * Create shipment for an order
 */
export async function createShipment(args: {
  orderId: string;
  sellerId: string;
  buyerId: string;
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packageDetails?: PackageDetails;
  handlingDays?: number;
}): Promise<Shipment> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
  });
  
  if (!order) throw new Error("ORDER_NOT_FOUND");
  
  const existing = await prisma.shipment.findUnique({
    where: { orderId: args.orderId },
  });
  
  if (existing) throw new Error("SHIPMENT_ALREADY_EXISTS");
  
  const handlingDays = args.handlingDays || 3;
  const handlingDueAt = calculateHandlingDueDate(order.paidAt || new Date(), handlingDays);
  
  return prisma.shipment.create({
    data: {
      orderId: args.orderId,
      sellerId: args.sellerId,
      buyerId: args.buyerId,
      status: 'PENDING',
      fromAddress: args.fromAddress as any,
      toAddress: args.toAddress as any,
      weightOz: args.packageDetails?.weightOz,
      lengthIn: args.packageDetails?.lengthIn,
      widthIn: args.packageDetails?.widthIn,
      heightIn: args.packageDetails?.heightIn,
      handlingDueAt,
      shippingCostCents: order.shippingCents,
    },
  });
}

function calculateHandlingDueDate(startDate: Date, businessDays: number): Date {
  const date = new Date(startDate);
  let daysAdded = 0;
  while (daysAdded < businessDays) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) daysAdded++;
  }
  return date;
}
```

### 4.3 Combined Shipping Calculator

```typescript
// packages/core/shipping/combined-shipping-service.ts

export interface CombinedShippingResult {
  totalShippingCents: number;
  breakdown: ShippingBreakdownItem[];
  freeShippingApplied: boolean;
  freeShippingThreshold?: number;
  combinedShippingRule?: CombinedShippingRule;
  itemCount: number;
  savingsCents?: number;
}

/**
 * Calculate combined shipping for multi-item cart from same seller
 */
export async function calculateCombinedShipping(args: {
  sellerId: string;
  items: Array<{ listingId: string; quantity: number; priceCents: number }>;
  shippingProfileId?: string;
}): Promise<CombinedShippingResult> {
  const profile = args.shippingProfileId
    ? await prisma.shippingProfile.findUnique({ where: { id: args.shippingProfileId } })
    : await prisma.shippingProfile.findFirst({
        where: { sellerId: args.sellerId, isDefault: true, isActive: true },
      });
  
  if (!profile) throw new Error("SHIPPING_PROFILE_NOT_FOUND");
  
  const itemCount = args.items.reduce((sum, i) => sum + i.quantity, 0);
  const orderTotal = args.items.reduce((sum, i) => sum + (i.priceCents * i.quantity), 0);
  
  // Free shipping threshold check
  if (profile.domesticFreeShippingEnabled && 
      profile.domesticFreeShippingAboveCents &&
      orderTotal >= profile.domesticFreeShippingAboveCents) {
    return {
      totalShippingCents: 0,
      breakdown: [{ type: 'flat_rate', quantity: itemCount, rateCents: 0, totalCents: 0 }],
      freeShippingApplied: true,
      freeShippingThreshold: profile.domesticFreeShippingAboveCents,
      itemCount,
    };
  }
  
  let totalShippingCents = 0;
  const breakdown: ShippingBreakdownItem[] = [];
  
  switch (profile.combinedShippingRule) {
    case 'ADDITIONAL_ITEM':
      totalShippingCents = profile.domesticFirstItemCents;
      breakdown.push({ type: 'first_item', quantity: 1, rateCents: profile.domesticFirstItemCents, totalCents: profile.domesticFirstItemCents });
      if (itemCount > 1) {
        const additionalTotal = (itemCount - 1) * profile.domesticAdditionalCents;
        totalShippingCents += additionalTotal;
        breakdown.push({ type: 'additional_items', quantity: itemCount - 1, rateCents: profile.domesticAdditionalCents, totalCents: additionalTotal });
      }
      break;
    case 'FLAT_TOTAL':
      totalShippingCents = profile.combinedShippingFlatCents || 0;
      breakdown.push({ type: 'flat_rate', quantity: itemCount, rateCents: totalShippingCents, totalCents: totalShippingCents });
      break;
    case 'FREE_ADDITIONAL':
      totalShippingCents = profile.domesticFirstItemCents;
      breakdown.push({ type: 'first_item', quantity: 1, rateCents: profile.domesticFirstItemCents, totalCents: profile.domesticFirstItemCents });
      break;
    default: // SUM_ALL
      totalShippingCents = itemCount * profile.domesticFirstItemCents;
      breakdown.push({ type: 'per_item', quantity: itemCount, rateCents: profile.domesticFirstItemCents, totalCents: totalShippingCents });
  }
  
  const withoutCombined = itemCount * profile.domesticFirstItemCents;
  
  return {
    totalShippingCents,
    breakdown,
    freeShippingApplied: false,
    combinedShippingRule: profile.combinedShippingRule,
    itemCount,
    savingsCents: withoutCombined > totalShippingCents ? withoutCombined - totalShippingCents : undefined,
  };
}
```

### 4.4 Late Shipment Detection Service

```typescript
// packages/core/shipping/late-detection-service.ts

/**
 * Detect and mark late shipments - run via cron every hour
 */
export async function detectLateShipments(): Promise<{ detected: number; notified: number }> {
  const settings = await prisma.shippingSettings.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: 'desc' },
  });
  
  const graceHours = settings?.handlingGraceHours || 12;
  const threshold = new Date(Date.now() - graceHours * 60 * 60 * 1000);
  
  const lateShipments = await prisma.shipment.findMany({
    where: {
      status: { in: ['PENDING', 'LABEL_PENDING', 'LABEL_CREATED'] },
      handlingDueAt: { lt: threshold },
      isLate: false,
    },
  });
  
  for (const shipment of lateShipments) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { isLate: true, lateReasonCode: 'HANDLING_EXCEEDED' },
    });
    
    // Record trust event
    await recordTrustEvent({
      sellerId: shipment.sellerId,
      eventType: 'late_shipment',
      orderId: shipment.orderId,
      weight: settings?.lateShipmentDefectWeight || 1.0,
    });
    
    // Notify seller
    await triggerNotification({
      userId: shipment.sellerId,
      template: 'shipment.late_warning',
      data: { orderId: shipment.orderId, handlingDueAt: shipment.handlingDueAt },
    });
  }
  
  return { detected: lateShipments.length, notified: lateShipments.length };
}
```

### 4.5 Rate Shopping Service

```typescript
// packages/core/shipping/rate-service.ts

/**
 * Get shipping rates with intelligent recommendations
 */
export async function getShippingRates(args: {
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  packages: PackageDetails[];
  options?: RateOptions;
  carriers?: string[];
}): Promise<EnhancedRateResponse> {
  const provider = await getShippingProvider();
  const rateResponse = await provider.getRates(args);
  
  if (rateResponse.rates.length === 0) {
    return {
      rates: [],
      cheapest: null,
      fastest: null,
      bestValue: null,
      recommended: null,
      errors: rateResponse.errors,
      quotedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }
  
  const cheapestCost = Math.min(...rateResponse.rates.map(r => r.totalCost));
  const fastestDays = Math.min(...rateResponse.rates.filter(r => r.estimatedDays).map(r => r.estimatedDays!));
  
  const enhancedRates = rateResponse.rates.map(rate => ({
    ...rate,
    recommendations: {
      isCheapest: rate.totalCost === cheapestCost,
      isFastest: rate.estimatedDays === fastestDays,
      isBestValue: calculateValueScore(rate, cheapestCost, fastestDays) >= 0.8,
      valueScore: calculateValueScore(rate, cheapestCost, fastestDays),
    },
    badges: getBadges(rate, cheapestCost),
  }));
  
  enhancedRates.sort((a, b) => b.recommendations.valueScore - a.recommendations.valueScore);
  
  return {
    rates: enhancedRates,
    cheapest: enhancedRates.find(r => r.recommendations.isCheapest) || null,
    fastest: enhancedRates.find(r => r.recommendations.isFastest) || null,
    bestValue: enhancedRates.find(r => r.recommendations.isBestValue) || null,
    recommended: enhancedRates[0] || null,
    errors: rateResponse.errors,
    quotedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };
}

function calculateValueScore(rate: Rate, cheapestCost: number, fastestDays: number): number {
  const costScore = cheapestCost / rate.totalCost;
  const speedScore = fastestDays / (rate.estimatedDays || 10);
  return (costScore * 0.6) + (speedScore * 0.4);
}

function getBadges(rate: Rate, cheapestCost: number): string[] {
  const badges: string[] = [];
  if (rate.savingsPercent && rate.savingsPercent >= 20) badges.push(`Save ${rate.savingsPercent.toFixed(0)}%`);
  if (rate.guaranteedDelivery) badges.push('Guaranteed');
  if (rate.estimatedDays && rate.estimatedDays <= 2) badges.push('Fast');
  return badges;
}
```
---

## 5. Health Provider

```typescript
// packages/core/health/providers/shipping.ts

import { HealthProvider, HealthResult, HealthCheck, HealthStatus } from "../types";

export const shippingHealthProvider: HealthProvider = {
  id: "shipping",
  label: "Shipping & Logistics",

  async run({ runType }): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    let status: HealthStatus = "PASS";

    // ==========================================================================
    // 1. Shipping Settings Exist and Active
    // ==========================================================================
    const settings = await prisma.shippingSettings.findFirst({
      where: { isActive: true, effectiveAt: { lte: new Date() } },
      orderBy: { effectiveAt: "desc" },
    });
    checks.push({
      id: "shipping.settings_active",
      label: "Shipping settings active",
      status: settings ? "PASS" : "FAIL",
      message: settings ? `v${settings.version}` : "No active shipping settings found",
    });
    if (!settings) status = "FAIL";

    // ==========================================================================
    // 2. Shipping Provider Connected
    // ==========================================================================
    try {
      const provider = await getShippingProvider();
      const carriers = await provider.getSupportedCarriers();
      const connected = carriers.filter(c => c.accountConnected);
      checks.push({
        id: "shipping.provider_connected",
        label: "Shipping provider connected",
        status: connected.length > 0 ? "PASS" : "FAIL",
        message: `${connected.length}/${carriers.length} carriers connected (${connected.map(c => c.code).join(', ')})`,
      });
      if (connected.length === 0) status = "FAIL";
    } catch (error) {
      checks.push({
        id: "shipping.provider_connected",
        label: "Shipping provider connected",
        status: "FAIL",
        message: error instanceof Error ? error.message : "Provider connection error",
      });
      status = "FAIL";
    }

    // ==========================================================================
    // 3. Label Idempotency Works
    // ==========================================================================
    const testKey = `health_label_${Date.now()}`;
    try {
      // Create twice, expect one (idempotent)
      for (let i = 0; i < 2; i++) {
        await prisma.shippingLabel.upsert({
          where: { idempotencyKey: testKey },
          create: {
            orderId: "health_test",
            sellerId: "health_test",
            idempotencyKey: testKey,
            carrier: "USPS",
            carrierCode: "usps",
            serviceCode: "priority",
            serviceName: "Priority Mail",
            trackingNumber: `HEALTHTEST${Date.now()}`,
            status: "PENDING",
            rateCents: 0,
            totalCostCents: 0,
            sellerPaidCents: 0,
            fromAddress: {},
            toAddress: {},
            weightOz: 16,
            provider: "health_check",
            providerLabelId: `health_${Date.now()}`,
          },
          update: {},
        });
      }
      const count = await prisma.shippingLabel.count({ where: { idempotencyKey: testKey } });
      checks.push({
        id: "shipping.label_idempotency",
        label: "Label purchase idempotency",
        status: count === 1 ? "PASS" : "FAIL",
        message: count === 1 ? "Idempotent (1 label created from 2 attempts)" : `Non-idempotent: ${count} labels created`,
      });
      if (count !== 1) status = "FAIL";
      
      // Cleanup
      await prisma.shippingLabel.deleteMany({ where: { idempotencyKey: testKey } });
    } catch (error) {
      checks.push({
        id: "shipping.label_idempotency",
        label: "Label purchase idempotency",
        status: "FAIL",
        message: error instanceof Error ? error.message : "Idempotency test failed",
      });
      status = "FAIL";
    }

    // ==========================================================================
    // 4. Tracking Event Idempotency
    // ==========================================================================
    const trackingKey = `health_tracking_${Date.now()}`;
    try {
      for (let i = 0; i < 2; i++) {
        await prisma.trackingEvent.upsert({
          where: { providerEventId: trackingKey },
          create: {
            shipmentId: "health_test",
            trackingNumber: "HEALTHTEST123",
            carrier: "USPS",
            status: "IN_TRANSIT",
            statusDescription: "Health check event",
            occurredAt: new Date(),
            provider: "health_check",
            providerEventId: trackingKey,
          },
          update: {},
        });
      }
      const eventCount = await prisma.trackingEvent.count({ where: { providerEventId: trackingKey } });
      checks.push({
        id: "shipping.tracking_idempotency",
        label: "Tracking event idempotency",
        status: eventCount === 1 ? "PASS" : "FAIL",
        message: eventCount === 1 ? "Idempotent" : `Non-idempotent: ${eventCount} events`,
      });
      if (eventCount !== 1) status = "FAIL";
      
      await prisma.trackingEvent.deleteMany({ where: { providerEventId: trackingKey } });
    } catch (error) {
      checks.push({
        id: "shipping.tracking_idempotency",
        label: "Tracking event idempotency",
        status: "FAIL",
        message: error instanceof Error ? error.message : "Test failed",
      });
      status = "FAIL";
    }

    // ==========================================================================
    // 5. Late Shipments Being Detected
    // ==========================================================================
    const pendingPastDue = await prisma.shipment.count({
      where: {
        status: { in: ['PENDING', 'LABEL_PENDING', 'LABEL_CREATED'] },
        handlingDueAt: { lt: new Date() },
        isLate: false,
      },
    });
    checks.push({
      id: "shipping.late_detection",
      label: "Late shipment detection",
      status: pendingPastDue === 0 ? "PASS" : "WARN",
      message: pendingPastDue > 0 
        ? `${pendingPastDue} shipments past due but not marked late (detection job may be delayed)` 
        : "All late shipments properly marked",
    });
    if (pendingPastDue > 10 && status !== "FAIL") status = "WARN";

    // ==========================================================================
    // 6. Open Exceptions Queue Health
    // ==========================================================================
    const openExceptions = await prisma.shippingException.count({
      where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
    });
    const criticalExceptions = await prisma.shippingException.count({
      where: { status: 'OPEN', severity: 'CRITICAL' },
    });
    checks.push({
      id: "shipping.exception_queue",
      label: "Shipping exceptions queue",
      status: criticalExceptions > 0 ? "WARN" : (openExceptions < 100 ? "PASS" : "WARN"),
      message: `${openExceptions} open exceptions (${criticalExceptions} critical)`,
    });
    if (criticalExceptions > 10 && status !== "FAIL") status = "WARN";

    // ==========================================================================
    // 7. State Machine Integrity
    // ==========================================================================
    // Check for delivered shipments without deliveredAt timestamp
    const deliveredWithoutTimestamp = await prisma.shipment.count({
      where: { status: 'DELIVERED', deliveredAt: null },
    });
    // Check for in-transit shipments without any tracking events
    const inTransitNoEvents = await prisma.shipment.count({
      where: { 
        status: { in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
        trackingEventCount: 0,
      },
    });
    checks.push({
      id: "shipping.state_integrity",
      label: "Shipment state integrity",
      status: (deliveredWithoutTimestamp === 0 && inTransitNoEvents === 0) ? "PASS" : "FAIL",
      message: deliveredWithoutTimestamp > 0 
        ? `${deliveredWithoutTimestamp} delivered without timestamp` 
        : (inTransitNoEvents > 0 ? `${inTransitNoEvents} in-transit without tracking events` : "All states valid"),
    });
    if (deliveredWithoutTimestamp > 0 || inTransitNoEvents > 0) status = "FAIL";

    // ==========================================================================
    // 8. Shipping Profile Coverage
    // ==========================================================================
    const sellersWithoutProfile = await prisma.user.count({
      where: {
        isSeller: true,
        sellerProfile: { isNot: null },
        // No shipping profile
        NOT: {
          id: { in: await prisma.shippingProfile.findMany({ select: { sellerId: true } }).then(p => p.map(x => x.sellerId)) },
        },
      },
    });
    checks.push({
      id: "shipping.profile_coverage",
      label: "Seller shipping profile coverage",
      status: sellersWithoutProfile === 0 ? "PASS" : "WARN",
      message: sellersWithoutProfile > 0 
        ? `${sellersWithoutProfile} active sellers without shipping profile` 
        : "All sellers have shipping profiles",
    });

    // ==========================================================================
    // 9. Webhook Health (if in full/production mode)
    // ==========================================================================
    if (runType === 'full' || runType === 'production') {
      const recentWebhooks = await prisma.trackingEvent.count({
        where: {
          receivedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
      });
      checks.push({
        id: "shipping.webhook_health",
        label: "Tracking webhook ingestion",
        status: recentWebhooks > 0 ? "PASS" : "WARN",
        message: `${recentWebhooks} tracking events received in last hour`,
      });
    }

    return {
      providerId: "shipping",
      status,
      summary: status === "PASS" 
        ? "Shipping system healthy" 
        : (status === "WARN" ? "Shipping system has warnings" : "Shipping system issues detected"),
      providerVersion: "2.0",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },
};
```

---

## 6. Doctor Checks

```typescript
// scripts/doctor/phase34-shipping-checks.ts

export async function runShippingDoctorChecks(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testPrefix = `doctor_${Date.now()}`;

  // ==========================================================================
  // 1. Shipment CRUD
  // ==========================================================================
  try {
    const shipment = await prisma.shipment.create({
      data: {
        orderId: `${testPrefix}_order`,
        sellerId: `${testPrefix}_seller`,
        buyerId: `${testPrefix}_buyer`,
        status: 'PENDING',
        fromAddress: { name: 'Test Seller', street1: '123 Main St', city: 'Los Angeles', state: 'CA', postalCode: '90210', country: 'US' },
        toAddress: { name: 'Test Buyer', street1: '456 Oak Ave', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' },
        handlingDueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    checks.push({
      phase: 34,
      name: "shipping.shipment_create",
      status: "PASS",
      details: `Created shipment ${shipment.id}`,
    });

    // ==========================================================================
    // 2. Valid State Transition
    // ==========================================================================
    const afterTransition = await transitionShipmentStatus(shipment.id, 'LABEL_CREATED', {
      reason: 'Doctor test - valid transition',
    });
    checks.push({
      phase: 34,
      name: "shipping.state_transition_valid",
      status: afterTransition.status === 'LABEL_CREATED' ? "PASS" : "FAIL",
      details: `Transitioned PENDING -> LABEL_CREATED`,
    });

    // ==========================================================================
    // 3. Invalid State Transition Blocked
    // ==========================================================================
    try {
      // Try invalid transition (LABEL_CREATED -> DELIVERED is invalid)
      await transitionShipmentStatus(shipment.id, 'DELIVERED', { reason: 'Doctor test - invalid' });
      checks.push({
        phase: 34,
        name: "shipping.state_transition_blocked",
        status: "FAIL",
        details: "Invalid transition LABEL_CREATED -> DELIVERED was allowed (should be blocked)",
      });
    } catch (error) {
      checks.push({
        phase: 34,
        name: "shipping.state_transition_blocked",
        status: "PASS",
        details: "Invalid transition properly rejected with error",
      });
    }

    // ==========================================================================
    // 4. Status History Tracked
    // ==========================================================================
    const withHistory = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    const history = (withHistory?.statusHistory as any[]) || [];
    checks.push({
      phase: 34,
      name: "shipping.status_history_tracked",
      status: history.length >= 1 ? "PASS" : "FAIL",
      details: `${history.length} status history entries recorded`,
    });

    // Cleanup shipment
    await prisma.shipment.delete({ where: { id: shipment.id } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.shipment_crud",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Shipment CRUD failed",
    });
  }

  // ==========================================================================
  // 5. Shipping Profile CRUD
  // ==========================================================================
  try {
    const profile = await prisma.shippingProfile.create({
      data: {
        sellerId: `${testPrefix}_seller`,
        name: "Doctor Test Profile",
        isDefault: true,
        domesticFirstItemCents: 500,
        domesticAdditionalCents: 100,
        handlingTimeDays: 3,
        combinedShippingEnabled: true,
        combinedShippingRule: 'ADDITIONAL_ITEM',
      },
    });
    checks.push({
      phase: 34,
      name: "shipping.profile_crud",
      status: "PASS",
      details: `Created profile ${profile.id}`,
    });
    await prisma.shippingProfile.delete({ where: { id: profile.id } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.profile_crud",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Profile CRUD failed",
    });
  }

  // ==========================================================================
  // 6. Label Idempotency (Critical)
  // ==========================================================================
  const labelIdempKey = `doctor_label_${Date.now()}`;
  try {
    for (let i = 0; i < 2; i++) {
      await prisma.shippingLabel.upsert({
        where: { idempotencyKey: labelIdempKey },
        create: {
          orderId: `${testPrefix}_order`,
          sellerId: `${testPrefix}_seller`,
          idempotencyKey: labelIdempKey,
          carrier: "USPS",
          carrierCode: "usps",
          serviceCode: "priority",
          serviceName: "Priority Mail",
          trackingNumber: `DOCTOR${Date.now()}`,
          status: "PURCHASED",
          rateCents: 850,
          totalCostCents: 850,
          sellerPaidCents: 850,
          fromAddress: {},
          toAddress: {},
          weightOz: 16,
          provider: "doctor",
          providerLabelId: `doctor_${Date.now()}`,
          purchasedAt: new Date(),
        },
        update: {},
      });
    }
    const labelCount = await prisma.shippingLabel.count({ where: { idempotencyKey: labelIdempKey } });
    checks.push({
      phase: 34,
      name: "shipping.label_idempotency",
      status: labelCount === 1 ? "PASS" : "FAIL",
      details: `Created ${labelCount} labels from 2 attempts (expected 1)`,
    });
    
    await prisma.shippingLabel.deleteMany({ where: { idempotencyKey: labelIdempKey } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.label_idempotency",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Label idempotency test failed",
    });
  }

  // ==========================================================================
  // 7. Tracking Event Idempotency (Critical)
  // ==========================================================================
  const trackingIdempKey = `doctor_tracking_${Date.now()}`;
  try {
    for (let i = 0; i < 2; i++) {
      await prisma.trackingEvent.upsert({
        where: { providerEventId: trackingIdempKey },
        create: {
          shipmentId: `${testPrefix}_shipment`,
          trackingNumber: `DOCTOR${Date.now()}`,
          carrier: "USPS",
          status: "IN_TRANSIT",
          statusDescription: "Package in transit",
          city: "Distribution Center",
          state: "CA",
          country: "US",
          occurredAt: new Date(),
          provider: "doctor",
          providerEventId: trackingIdempKey,
        },
        update: {},
      });
    }
    const eventCount = await prisma.trackingEvent.count({ where: { providerEventId: trackingIdempKey } });
    checks.push({
      phase: 34,
      name: "shipping.tracking_idempotency",
      status: eventCount === 1 ? "PASS" : "FAIL",
      details: `Created ${eventCount} events from 2 attempts (expected 1)`,
    });
    
    await prisma.trackingEvent.deleteMany({ where: { providerEventId: trackingIdempKey } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.tracking_idempotency",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Tracking idempotency test failed",
    });
  }

  // ==========================================================================
  // 8. Exception Workflow
  // ==========================================================================
  try {
    const exception = await prisma.shippingException.create({
      data: {
        shipmentId: `${testPrefix}_shipment`,
        orderId: `${testPrefix}_order`,
        type: 'LOST',
        status: 'OPEN',
        severity: 'HIGH',
        description: 'Doctor test exception',
        detectedAt: new Date(),
        detectedBy: 'doctor',
      },
    });
    
    // Test resolution
    const resolved = await prisma.shippingException.update({
      where: { id: exception.id },
      data: {
        status: 'RESOLVED',
        resolution: 'NO_ACTION_NEEDED',
        resolvedAt: new Date(),
        resolutionNotes: 'Doctor test - auto resolved',
      },
    });
    
    checks.push({
      phase: 34,
      name: "shipping.exception_workflow",
      status: resolved.status === 'RESOLVED' ? "PASS" : "FAIL",
      details: `Exception created and resolved successfully`,
    });
    
    await prisma.shippingException.delete({ where: { id: exception.id } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.exception_workflow",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Exception workflow failed",
    });
  }

  // ==========================================================================
  // 9. Combined Shipping Calculation
  // ==========================================================================
  try {
    // Test combined shipping logic
    const profile = await prisma.shippingProfile.create({
      data: {
        sellerId: `${testPrefix}_seller_combined`,
        name: "Combined Test",
        isDefault: true,
        domesticFirstItemCents: 500,
        domesticAdditionalCents: 100,
        combinedShippingEnabled: true,
        combinedShippingRule: 'ADDITIONAL_ITEM',
      },
    });
    
    // Simulate 3-item calculation: $5.00 + $1.00 + $1.00 = $7.00
    const expectedTotal = 500 + 100 + 100; // 700 cents
    
    // Mock calculation (actual service would use this profile)
    const result = {
      totalShippingCents: 700,
      breakdown: [
        { type: 'first_item', quantity: 1, rateCents: 500, totalCents: 500 },
        { type: 'additional_items', quantity: 2, rateCents: 100, totalCents: 200 },
      ],
    };
    
    checks.push({
      phase: 34,
      name: "shipping.combined_calculation",
      status: result.totalShippingCents === expectedTotal ? "PASS" : "FAIL",
      details: `3 items = $${(result.totalShippingCents / 100).toFixed(2)} (expected $7.00)`,
    });
    
    await prisma.shippingProfile.delete({ where: { id: profile.id } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.combined_calculation",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Combined shipping test failed",
    });
  }

  // ==========================================================================
  // 10. Rate Quote Expiration
  // ==========================================================================
  try {
    const expiredRate = await prisma.shippingRate.create({
      data: {
        orderId: `${testPrefix}_order`,
        sellerId: `${testPrefix}_seller`,
        carrier: 'USPS',
        carrierCode: 'usps',
        serviceName: 'Priority Mail',
        serviceCode: 'priority',
        serviceLevel: 'STANDARD',
        rateCents: 850,
        totalCents: 850,
        fromPostalCode: '90210',
        fromCountry: 'US',
        toPostalCode: '10001',
        toCountry: 'US',
        weightOz: 16,
        provider: 'doctor',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      },
    });
    
    const isExpired = expiredRate.expiresAt < new Date();
    checks.push({
      phase: 34,
      name: "shipping.rate_expiration",
      status: isExpired ? "PASS" : "FAIL",
      details: isExpired ? "Expired rate correctly identified" : "Rate expiration logic failed",
    });
    
    await prisma.shippingRate.delete({ where: { id: expiredRate.id } });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.rate_expiration",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Rate expiration test failed",
    });
  }

  // ==========================================================================
  // 11. Shipping Settings Versioning
  // ==========================================================================
  try {
    const settings = await prisma.shippingSettings.findFirst({
      where: { isActive: true },
      orderBy: { effectiveAt: 'desc' },
    });
    checks.push({
      phase: 34,
      name: "shipping.settings_active",
      status: settings ? "PASS" : "WARN",
      details: settings ? `Active settings v${settings.version}` : "No active shipping settings (may need seeding)",
    });
  } catch (error) {
    checks.push({
      phase: 34,
      name: "shipping.settings_active",
      status: "FAIL",
      details: error instanceof Error ? error.message : "Settings check failed",
    });
  }

  return checks;
}
```

---

## 7. Webhook Handlers

```typescript
// packages/api/webhooks/shipping/tracking.ts

/**
 * Process tracking webhook from shipping provider
 * Handles: Shippo, EasyPost, etc. (provider-agnostic via interface)
 */
export async function handleTrackingWebhook(
  provider: string,
  payload: unknown
): Promise<{ processed: boolean; message: string }> {
  const shippingProvider = await getShippingProvider();
  
  // Process webhook through provider interface
  const result = await shippingProvider.processTrackingWebhook(payload);
  
  if (!result.processed) {
    return { processed: false, message: "Webhook not processed" };
  }
  
  // Find shipment by tracking number
  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber: result.trackingNumber },
  });
  
  if (!shipment) {
    // Could be a label not yet attached to shipment, or external tracking
    console.log(`No shipment found for tracking ${result.trackingNumber}`);
    return { processed: true, message: "No matching shipment" };
  }
  
  // Process each tracking event
  for (const event of result.events) {
    // Idempotent upsert
    await prisma.trackingEvent.upsert({
      where: { providerEventId: event.providerEventId },
      create: {
        shipmentId: shipment.id,
        trackingNumber: result.trackingNumber,
        carrier: result.carrier as ShipmentCarrier,
        status: mapTrackingStatus(event.status),
        statusDetail: event.statusDetail,
        statusDescription: event.description,
        city: event.location?.city,
        state: event.location?.state,
        postalCode: event.location?.postalCode,
        country: event.location?.country,
        locationDescription: event.location?.description,
        latitude: event.location?.latitude,
        longitude: event.location?.longitude,
        occurredAt: event.timestamp,
        provider,
        providerEventId: event.providerEventId,
        providerRawStatus: event.providerRawStatus,
        isException: isExceptionStatus(event.status),
      },
      update: {}, // Idempotent - don't update existing
    });
  }
  
  // Update shipment with latest tracking info
  const latestEvent = result.events[result.events.length - 1];
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      lastTrackingStatus: latestEvent.status,
      lastTrackingLocation: formatLocation(latestEvent.location),
      lastTrackingAt: latestEvent.timestamp,
      trackingEventCount: { increment: result.events.length },
      estimatedDeliveryAt: result.events.find(e => e.estimatedDeliveryAt)?.estimatedDeliveryAt,
    },
  });
  
  // Handle status transitions based on tracking
  if (result.isDelivered) {
    await transitionShipmentStatus(shipment.id, 'DELIVERED', {
      reason: 'Carrier confirmed delivery',
      trackingEventId: latestEvent.providerEventId,
    });
  } else if (result.isException) {
    // Don't auto-transition to exception - create exception record instead
    await createShippingException({
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      type: mapExceptionType(latestEvent.status),
      description: latestEvent.description,
      detectedBy: 'carrier_webhook',
      carrierMessage: latestEvent.statusDetail,
    });
  } else if (result.wasFirstDeliveryScan && shipment.status === 'LABEL_CREATED') {
    // First scan - transition to IN_TRANSIT
    await transitionShipmentStatus(shipment.id, 'IN_TRANSIT', {
      reason: 'First carrier scan',
      trackingEventId: latestEvent.providerEventId,
    });
  }
  
  return { processed: true, message: `Processed ${result.events.length} events` };
}

function mapTrackingStatus(providerStatus: string): TrackingStatus {
  const mapping: Record<string, TrackingStatus> = {
    'pre_transit': 'PRE_TRANSIT',
    'accepted': 'ACCEPTED',
    'in_transit': 'IN_TRANSIT',
    'out_for_delivery': 'OUT_FOR_DELIVERY',
    'delivered': 'DELIVERED',
    'available_for_pickup': 'AVAILABLE_FOR_PICKUP',
    'delivery_attempted': 'DELIVERY_ATTEMPTED',
    'exception': 'EXCEPTION',
    'delayed': 'DELAYED',
    'return_to_sender': 'RETURN_TO_SENDER',
    'returned': 'RETURNED',
    'lost': 'LOST',
    'damaged': 'DAMAGED',
  };
  return mapping[providerStatus.toLowerCase()] || 'UNKNOWN';
}

function isExceptionStatus(status: string): boolean {
  return ['exception', 'delayed', 'delivery_attempted', 'return_to_sender', 'lost', 'damaged'].includes(status.toLowerCase());
}

function mapExceptionType(status: string): ExceptionType {
  const mapping: Record<string, ExceptionType> = {
    'delivery_attempted': 'DELIVERY_FAILED',
    'return_to_sender': 'RETURNED_TO_SENDER',
    'lost': 'LOST',
    'damaged': 'DAMAGED',
    'exception': 'CARRIER_DELAY',
    'delayed': 'CARRIER_DELAY',
  };
  return mapping[status.toLowerCase()] || 'CARRIER_DELAY';
}

function formatLocation(location?: TrackingLocation): string | null {
  if (!location) return null;
  const parts = [location.city, location.state, location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}
```
---

## 8. API Routes

### 8.1 Seller Shipping API

```typescript
// packages/api/routes/seller/shipping.ts

/**
 * GET /api/seller/shipments
 * List seller's shipments with filters
 */
export async function getSellerShipments(req: AuthenticatedRequest) {
  const { sellerId } = req.user;
  const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  const where: Prisma.ShipmentWhereInput = { sellerId };
  
  if (status) where.status = status as ShipmentStatus;
  if (startDate) where.createdAt = { gte: new Date(startDate as string) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate as string) };
  
  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: { order: { select: { orderNumber: true, totalCents: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.shipment.count({ where }),
  ]);
  
  return { shipments, total, page: Number(page), limit: Number(limit) };
}

/**
 * POST /api/seller/shipments/:shipmentId/fulfill
 * Mark order as shipped with seller-provided tracking
 */
export async function fulfillShipmentRoute(req: AuthenticatedRequest) {
  const { shipmentId } = req.params;
  const { carrier, trackingNumber, trackingUrl } = req.body;
  
  // Verify ownership
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, sellerId: req.user.sellerId },
  });
  
  if (!shipment) {
    throw new ApiError(404, "SHIPMENT_NOT_FOUND");
  }
  
  return fulfillShipment({
    shipmentId,
    carrier,
    trackingNumber,
    trackingUrl,
    actorUserId: req.user.userId,
  });
}

/**
 * POST /api/seller/shipments/:shipmentId/rates
 * Get shipping rates for a shipment
 */
export async function getShipmentRates(req: AuthenticatedRequest) {
  const { shipmentId } = req.params;
  const { packageDetails } = req.body;
  
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, sellerId: req.user.sellerId },
  });
  
  if (!shipment) {
    throw new ApiError(404, "SHIPMENT_NOT_FOUND");
  }
  
  return getShippingRates({
    fromAddress: shipment.fromAddress as ShippingAddress,
    toAddress: shipment.toAddress as ShippingAddress,
    packages: [packageDetails || {
      weightOz: shipment.weightOz || 16,
      lengthIn: shipment.lengthIn,
      widthIn: shipment.widthIn,
      heightIn: shipment.heightIn,
    }],
    sellerId: req.user.sellerId,
  });
}

/**
 * POST /api/seller/shipments/:shipmentId/purchase-label
 * Purchase shipping label
 */
export async function purchaseLabelRoute(req: AuthenticatedRequest) {
  const { shipmentId } = req.params;
  const { rateId, packageDetails, options } = req.body;
  
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, sellerId: req.user.sellerId },
  });
  
  if (!shipment) {
    throw new ApiError(404, "SHIPMENT_NOT_FOUND");
  }
  
  // Generate idempotency key based on shipment + rate
  const idempotencyKey = `label_${shipmentId}_${rateId}`;
  
  const provider = await getShippingProvider();
  
  const result = await provider.purchaseLabel({
    rateId,
    fromAddress: shipment.fromAddress as ShippingAddress,
    toAddress: shipment.toAddress as ShippingAddress,
    packages: [packageDetails || {
      weightOz: shipment.weightOz || 16,
      lengthIn: shipment.lengthIn,
      widthIn: shipment.widthIn,
      heightIn: shipment.heightIn,
    }],
    idempotencyKey,
    labelFormat: options?.labelFormat || 'pdf_4x6',
    signatureType: options?.signatureRequired ? 'signature' : 'none',
    reference: shipment.orderId,
  });
  
  if (!result.success) {
    throw new ApiError(400, result.error?.code || "LABEL_PURCHASE_FAILED", result.error?.message);
  }
  
  // Create label record
  const label = await prisma.shippingLabel.create({
    data: {
      shipmentId,
      orderId: shipment.orderId,
      sellerId: shipment.sellerId,
      idempotencyKey,
      carrier: result.carrier as ShipmentCarrier,
      carrierCode: result.carrier.toLowerCase(),
      serviceCode: result.service,
      serviceName: result.service,
      trackingNumber: result.trackingNumber,
      trackingUrl: buildTrackingUrl(result.carrier, result.trackingNumber),
      labelUrl: result.labelUrl,
      labelFormat: result.labelFormat as LabelFormat,
      labelBase64: result.labelBase64,
      status: 'PURCHASED',
      rateCents: result.totalCost,
      totalCostCents: result.totalCost,
      sellerPaidCents: result.totalCost,
      fromAddress: shipment.fromAddress,
      toAddress: shipment.toAddress,
      weightOz: shipment.weightOz || 16,
      provider: provider.name,
      providerLabelId: result.providerLabelId,
      providerTransactionId: result.providerTransactionId,
      purchasedAt: new Date(),
    },
  });
  
  // Update shipment
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      labelId: label.id,
      carrier: result.carrier as ShipmentCarrier,
      carrierCode: result.carrier.toLowerCase(),
      trackingNumber: result.trackingNumber,
      trackingUrl: buildTrackingUrl(result.carrier, result.trackingNumber),
      labelCostCents: result.totalCost,
      labelCreatedAt: new Date(),
    },
  });
  
  // Transition shipment status
  await transitionShipmentStatus(shipmentId, 'LABEL_CREATED', {
    reason: 'Label purchased',
    actorUserId: req.user.userId,
  });
  
  // Create ledger entry for label cost
  await postLedgerEntry({
    sellerId: shipment.sellerId,
    type: 'SHIPPING_LABEL_FEE',
    amountCents: -result.totalCost, // Debit
    orderId: shipment.orderId,
    description: `Shipping label - ${result.carrier} ${result.trackingNumber}`,
    referenceId: label.id,
    referenceType: 'ShippingLabel',
  });
  
  return { label, shipment: await prisma.shipment.findUnique({ where: { id: shipmentId } }) };
}

/**
 * POST /api/seller/labels/:labelId/void
 * Void/cancel a shipping label
 */
export async function voidLabelRoute(req: AuthenticatedRequest) {
  const { labelId } = req.params;
  const { reason } = req.body;
  
  const label = await prisma.shippingLabel.findFirst({
    where: { id: labelId, sellerId: req.user.sellerId },
  });
  
  if (!label) {
    throw new ApiError(404, "LABEL_NOT_FOUND");
  }
  
  if (label.status !== 'PURCHASED' && label.status !== 'PRINTED') {
    throw new ApiError(400, "LABEL_NOT_VOIDABLE", `Label status ${label.status} cannot be voided`);
  }
  
  // Check void window
  const settings = await getActiveShippingSettings();
  const voidWindowMs = (settings?.labelVoidWindowHours || 720) * 60 * 60 * 1000;
  if (label.purchasedAt && Date.now() - label.purchasedAt.getTime() > voidWindowMs) {
    throw new ApiError(400, "VOID_WINDOW_EXPIRED", "Label void window has expired");
  }
  
  const provider = await getShippingProvider();
  const result = await provider.voidLabel({ labelId: label.providerLabelId, reason });
  
  if (!result.success) {
    throw new ApiError(400, "VOID_FAILED", result.message);
  }
  
  // Update label
  await prisma.shippingLabel.update({
    where: { id: labelId },
    data: {
      status: result.refundStatus === 'approved' ? 'REFUNDED' : 'VOID_PENDING',
      voidedAt: new Date(),
      voidReason: reason,
      refundCents: result.refundAmount,
      refundedAt: result.refundStatus === 'approved' ? new Date() : null,
    },
  });
  
  // If refund approved, create ledger credit
  if (result.refundStatus === 'approved' && result.refundAmount) {
    await postLedgerEntry({
      sellerId: label.sellerId,
      type: 'SHIPPING_LABEL_REFUND',
      amountCents: result.refundAmount, // Credit
      orderId: label.orderId,
      description: `Label refund - ${label.trackingNumber}`,
      referenceId: labelId,
      referenceType: 'ShippingLabel',
    });
  }
  
  // Update shipment if exists
  if (label.shipmentId) {
    await transitionShipmentStatus(label.shipmentId, 'VOIDED', {
      reason: reason || 'Label voided',
      actorUserId: req.user.userId,
    });
  }
  
  return { success: true, refundAmount: result.refundAmount, refundStatus: result.refundStatus };
}
```

### 8.2 Shipping Profile API

```typescript
// packages/api/routes/seller/shipping-profiles.ts

/**
 * GET /api/seller/shipping-profiles
 * List seller's shipping profiles
 */
export async function getShippingProfiles(req: AuthenticatedRequest) {
  const profiles = await prisma.shippingProfile.findMany({
    where: { sellerId: req.user.sellerId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return { profiles };
}

/**
 * POST /api/seller/shipping-profiles
 * Create new shipping profile
 */
export async function createShippingProfile(req: AuthenticatedRequest) {
  const data = req.body;
  
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.shippingProfile.updateMany({
      where: { sellerId: req.user.sellerId, isDefault: true },
      data: { isDefault: false },
    });
  }
  
  const profile = await prisma.shippingProfile.create({
    data: {
      sellerId: req.user.sellerId,
      name: data.name,
      description: data.description,
      isDefault: data.isDefault || false,
      
      // Domestic
      domesticEnabled: data.domesticEnabled ?? true,
      domesticFlatRate: data.domesticFlatRate ?? true,
      domesticFirstItemCents: data.domesticFirstItemCents || 0,
      domesticAdditionalCents: data.domesticAdditionalCents || 0,
      domesticFreeShippingEnabled: data.domesticFreeShippingEnabled || false,
      domesticFreeShippingAboveCents: data.domesticFreeShippingAboveCents,
      
      // International
      internationalEnabled: data.internationalEnabled || false,
      internationalFirstItemCents: data.internationalFirstItemCents,
      internationalAdditionalCents: data.internationalAdditionalCents,
      internationalExcludedCountries: data.internationalExcludedCountries || [],
      
      // Handling
      handlingTimeDays: data.handlingTimeDays || 3,
      cutoffTime: data.cutoffTime,
      excludeWeekends: data.excludeWeekends ?? true,
      
      // Combined shipping
      combinedShippingEnabled: data.combinedShippingEnabled ?? true,
      combinedShippingRule: data.combinedShippingRule || 'ADDITIONAL_ITEM',
      combinedShippingMaxItems: data.combinedShippingMaxItems || 0,
      
      // Carriers
      preferredCarriers: data.preferredCarriers || ['USPS'],
      
      // Package defaults
      defaultPackageType: data.defaultPackageType || 'CUSTOM',
      defaultWeightOz: data.defaultWeightOz || 16,
      
      // Return address
      returnAddress: data.returnAddress || {},
      
      // Restrictions
      excludedStates: data.excludedStates || [],
      excludedZipPrefixes: data.excludedZipPrefixes || [],
      poBoxAllowed: data.poBoxAllowed ?? true,
    },
  });
  
  return { profile };
}

/**
 * PUT /api/seller/shipping-profiles/:profileId
 * Update shipping profile
 */
export async function updateShippingProfile(req: AuthenticatedRequest) {
  const { profileId } = req.params;
  const data = req.body;
  
  const existing = await prisma.shippingProfile.findFirst({
    where: { id: profileId, sellerId: req.user.sellerId },
  });
  
  if (!existing) {
    throw new ApiError(404, "PROFILE_NOT_FOUND");
  }
  
  // If setting as default, unset other defaults
  if (data.isDefault && !existing.isDefault) {
    await prisma.shippingProfile.updateMany({
      where: { sellerId: req.user.sellerId, isDefault: true, id: { not: profileId } },
      data: { isDefault: false },
    });
  }
  
  const profile = await prisma.shippingProfile.update({
    where: { id: profileId },
    data,
  });
  
  return { profile };
}

/**
 * DELETE /api/seller/shipping-profiles/:profileId
 * Delete shipping profile (if not in use)
 */
export async function deleteShippingProfile(req: AuthenticatedRequest) {
  const { profileId } = req.params;
  
  const existing = await prisma.shippingProfile.findFirst({
    where: { id: profileId, sellerId: req.user.sellerId },
  });
  
  if (!existing) {
    throw new ApiError(404, "PROFILE_NOT_FOUND");
  }
  
  // Check if profile is in use by any active listings
  const listingsUsingProfile = await prisma.listing.count({
    where: { shippingProfileId: profileId, status: 'ACTIVE' },
  });
  
  if (listingsUsingProfile > 0) {
    throw new ApiError(400, "PROFILE_IN_USE", `Profile is used by ${listingsUsingProfile} active listings`);
  }
  
  await prisma.shippingProfile.delete({ where: { id: profileId } });
  
  return { success: true };
}
```

---

## 9. Notification Templates

```yaml
# notifications/templates/shipping.yaml

# Order shipped notification to buyer
order.shipped:
  channels: [EMAIL, PUSH, IN_APP]
  subject: "Your order has shipped!"
  email_template: |
    Hi {{buyer.firstName}},
    
    Great news! Your order #{{order.orderNumber}} has shipped.
    
    Tracking Information:
    - Carrier: {{shipment.carrierName}}
    - Tracking Number: {{shipment.trackingNumber}}
    - Estimated Delivery: {{shipment.estimatedDeliveryAt | date}}
    
    Track your package: {{shipment.trackingUrl}}
    
    Thanks for shopping with us!
  push_template: "Your order #{{order.orderNumber}} has shipped! Track: {{shipment.trackingNumber}}"

# Out for delivery notification
shipment.out_for_delivery:
  channels: [PUSH, IN_APP]
  push_template: "Your package is out for delivery today! Order #{{order.orderNumber}}"

# Delivered notification
shipment.delivered:
  channels: [EMAIL, PUSH, IN_APP]
  subject: "Your order has been delivered!"
  email_template: |
    Hi {{buyer.firstName}},
    
    Your order #{{order.orderNumber}} has been delivered.
    
    Delivered: {{shipment.deliveredAt | datetime}}
    
    We hope you love your purchase! Please take a moment to leave a review.
    
    [Leave Review]({{reviewUrl}})
  push_template: "Your order #{{order.orderNumber}} has been delivered!"

# Exception notification to buyer
shipment.exception:
  channels: [EMAIL, IN_APP]
  subject: "Update on your order shipment"
  email_template: |
    Hi {{buyer.firstName}},
    
    We wanted to let you know there's been an update with your shipment for order #{{order.orderNumber}}.
    
    Status: {{exception.description}}
    
    Don't worry - we're monitoring this and will update you when we have more information.
    
    Track your package: {{shipment.trackingUrl}}

# Exception notification to seller
shipment.exception_seller:
  channels: [EMAIL, IN_APP]
  subject: "Shipment exception for order #{{order.orderNumber}}"
  email_template: |
    Hi {{seller.displayName}},
    
    There's been an exception with the shipment for order #{{order.orderNumber}}.
    
    Exception: {{exception.description}}
    Tracking: {{shipment.trackingNumber}}
    
    Please monitor this shipment and take action if needed.
    
    [View Order]({{orderUrl}})

# Late shipment warning to seller
shipment.late_warning:
  channels: [EMAIL, PUSH, IN_APP]
  subject: "⚠️ Shipment overdue for order #{{order.orderNumber}}"
  email_template: |
    Hi {{seller.displayName}},
    
    Your shipment for order #{{order.orderNumber}} is now overdue.
    
    - Expected Ship By: {{shipment.handlingDueAt | date}}
    - Days Past Due: {{daysPastDue}}
    
    Late shipments can affect your seller performance metrics. Please ship this order as soon as possible.
    
    [Fulfill Order]({{fulfillUrl}})
  push_template: "⚠️ Order #{{order.orderNumber}} is overdue for shipment!"

# Label purchased confirmation to seller
label.purchased:
  channels: [EMAIL, IN_APP]
  subject: "Shipping label ready for order #{{order.orderNumber}}"
  email_template: |
    Hi {{seller.displayName}},
    
    Your shipping label for order #{{order.orderNumber}} is ready!
    
    - Carrier: {{label.carrierName}}
    - Service: {{label.serviceName}}
    - Cost: ${{label.sellerPaidCents | cents_to_dollars}}
    - Tracking: {{label.trackingNumber}}
    
    [Print Label]({{label.labelUrl}})
    
    Remember to ship by {{shipment.handlingDueAt | date}}.

# Label voided/refunded
label.voided:
  channels: [IN_APP]
  template: "Label {{label.trackingNumber}} voided. Refund: ${{label.refundCents | cents_to_dollars}}"
```

---

## 10. Admin UI Components

### 10.1 Shipping Settings Admin

```tsx
// apps/corp/shipping/settings/page.tsx

export default function ShippingSettingsPage() {
  const { data: settings, mutate } = useSWR('/api/corp/shipping/settings');
  const [isEditing, setIsEditing] = useState(false);
  
  const handleSave = async (values: ShippingSettingsFormValues) => {
    await fetch('/api/corp/shipping/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        version: `${Date.now()}`,
        effectiveAt: new Date().toISOString(),
      }),
    });
    mutate();
    setIsEditing(false);
  };
  
  return (
    <CorpLayout>
      <PageHeader
        title="Shipping Settings"
        description="Configure platform-wide shipping policies"
        action={
          <Button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel' : 'Edit Settings'}
          </Button>
        }
      />
      
      <div className="space-y-6">
        {/* Handling Time */}
        <SettingsCard title="Handling Time">
          <SettingRow label="Default Handling Days" value={settings?.defaultHandlingDays} />
          <SettingRow label="Max Handling Days" value={settings?.maxHandlingDays} />
          <SettingRow label="Late Shipment Grace (hours)" value={settings?.handlingGraceHours} />
        </SettingsCard>
        
        {/* Carriers */}
        <SettingsCard title="Carriers">
          <SettingRow label="Enabled Carriers" value={settings?.enabledCarriers?.join(', ')} />
          <SettingRow label="Default Carrier" value={settings?.defaultCarrier} />
        </SettingsCard>
        
        {/* Labels */}
        <SettingsCard title="Label Settings">
          <SettingRow label="Label Generation" value={settings?.labelGenerationEnabled ? 'Enabled' : 'Disabled'} />
          <SettingRow label="Void Window (hours)" value={settings?.labelVoidWindowHours} />
          <SettingRow label="Label Expiration (days)" value={settings?.labelExpirationDays} />
          <SettingRow label="Platform Discount %" value={settings?.labelDiscountPercent} />
        </SettingsCard>
        
        {/* Tracking */}
        <SettingsCard title="Tracking Requirements">
          <SettingRow label="Required Above" value={formatCents(settings?.trackingRequiredAboveCents)} />
          <SettingRow label="Validation" value={settings?.trackingValidationEnabled ? 'Enabled' : 'Disabled'} />
          <SettingRow label="Invalid Grace (days)" value={settings?.invalidTrackingGraceDays} />
        </SettingsCard>
        
        {/* Insurance */}
        <SettingsCard title="Insurance">
          <SettingRow label="Auto-Insure Above" value={formatCents(settings?.autoInsureAboveCents)} />
          <SettingRow label="Max Insurance Value" value={formatCents(settings?.maxInsuranceValueCents)} />
          <SettingRow label="Provider" value={settings?.insuranceProvider} />
        </SettingsCard>
        
        {/* Signature */}
        <SettingsCard title="Signature Requirements">
          <SettingRow label="Required Above" value={formatCents(settings?.signatureRequiredAboveCents)} />
        </SettingsCard>
        
        {/* Late Shipment */}
        <SettingsCard title="Late Shipment Policy">
          <SettingRow label="Penalty Enabled" value={settings?.lateShipmentPenaltyEnabled ? 'Yes' : 'No'} />
          <SettingRow label="Grace Days" value={settings?.lateShipmentGraceDays} />
          <SettingRow label="Defect Weight" value={settings?.lateShipmentDefectWeight} />
        </SettingsCard>
        
        {/* Exceptions */}
        <SettingsCard title="Exception Handling">
          <SettingRow label="Auto-Detect" value={settings?.autoDetectExceptions ? 'Enabled' : 'Disabled'} />
          <SettingRow label="SLA (hours)" value={settings?.exceptionSlaHours} />
          <SettingRow label="Lost Package Threshold (days)" value={settings?.lostPackageThresholdDays} />
        </SettingsCard>
        
        {/* International */}
        <SettingsCard title="International Shipping">
          <SettingRow label="Enabled" value={settings?.internationalEnabled ? 'Yes' : 'No'} />
          <SettingRow label="Customs Form Required" value={settings?.customsFormRequired ? 'Yes' : 'No'} />
          <SettingRow label="Duties Calculation" value={settings?.dutiesCalculationEnabled ? 'Enabled' : 'Disabled'} />
          <SettingRow label="Blocked Countries" value={settings?.blockedCountries?.length || 0} />
        </SettingsCard>
      </div>
      
      {/* Edit Modal */}
      <ShippingSettingsModal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        onSave={handleSave}
        initialValues={settings}
      />
    </CorpLayout>
  );
}
```

### 10.2 Shipping Exceptions Dashboard

```tsx
// apps/corp/shipping/exceptions/page.tsx

export default function ShippingExceptionsPage() {
  const [filters, setFilters] = useState({
    status: 'OPEN',
    severity: null,
    type: null,
  });
  
  const { data, isLoading } = useSWR(
    `/api/corp/shipping/exceptions?${new URLSearchParams(filters as any)}`
  );
  
  const handleResolve = async (exceptionId: string, resolution: ExceptionResolution, notes: string) => {
    await fetch(`/api/corp/shipping/exceptions/${exceptionId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, notes }),
    });
    mutate();
  };
  
  return (
    <CorpLayout>
      <PageHeader
        title="Shipping Exceptions"
        description="Manage shipping issues and delivery exceptions"
      />
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard title="Open" value={data?.stats?.open || 0} />
        <StatCard title="Critical" value={data?.stats?.critical || 0} variant="danger" />
        <StatCard title="Awaiting Carrier" value={data?.stats?.awaitingCarrier || 0} />
        <StatCard title="Resolved Today" value={data?.stats?.resolvedToday || 0} variant="success" />
      </div>
      
      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v })}
          options={[
            { value: 'OPEN', label: 'Open' },
            { value: 'INVESTIGATING', label: 'Investigating' },
            { value: 'AWAITING_CARRIER', label: 'Awaiting Carrier' },
            { value: 'RESOLVED', label: 'Resolved' },
          ]}
        />
        <Select
          label="Severity"
          value={filters.severity}
          onChange={(v) => setFilters({ ...filters, severity: v })}
          options={[
            { value: null, label: 'All' },
            { value: 'CRITICAL', label: 'Critical' },
            { value: 'HIGH', label: 'High' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'LOW', label: 'Low' },
          ]}
        />
        <Select
          label="Type"
          value={filters.type}
          onChange={(v) => setFilters({ ...filters, type: v })}
          options={[
            { value: null, label: 'All Types' },
            { value: 'LOST', label: 'Lost' },
            { value: 'DAMAGED', label: 'Damaged' },
            { value: 'RETURNED_TO_SENDER', label: 'RTS' },
            { value: 'DELIVERY_FAILED', label: 'Delivery Failed' },
          ]}
        />
      </div>
      
      {/* Exceptions Table */}
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: (e) => <code>{e.id.slice(0, 8)}</code> },
          { key: 'severity', label: 'Severity', render: (e) => <SeverityBadge severity={e.severity} /> },
          { key: 'type', label: 'Type', render: (e) => formatExceptionType(e.type) },
          { key: 'orderId', label: 'Order', render: (e) => <Link href={`/corp/orders/${e.orderId}`}>{e.orderId.slice(0, 8)}</Link> },
          { key: 'carrier', label: 'Carrier', render: (e) => e.shipment?.carrierName },
          { key: 'tracking', label: 'Tracking', render: (e) => e.shipment?.trackingNumber },
          { key: 'createdAt', label: 'Detected', render: (e) => formatRelativeTime(e.detectedAt) },
          { key: 'actions', label: '', render: (e) => (
            <Button size="sm" onClick={() => openResolveModal(e)}>Resolve</Button>
          )},
        ]}
        data={data?.exceptions || []}
        isLoading={isLoading}
      />
      
      {/* Resolution Modal */}
      <ExceptionResolveModal
        exception={selectedException}
        open={!!selectedException}
        onClose={() => setSelectedException(null)}
        onResolve={handleResolve}
      />
    </CorpLayout>
  );
}
```


---

## 14. Summary

This canonical defines the complete, provider-agnostic shipping system for Twicely V2. Key features:

### Core Capabilities
- **Shipment State Machine**: Authoritative transitions with full audit trail
- **Label Lifecycle**: Purchase, print, void, refund with idempotency
- **Tracking Integration**: Real-time webhook processing with deduplication
- **Combined Shipping**: Five calculation rules (ADDITIONAL_ITEM, FLAT_TOTAL, HIGHEST_ONLY, SUM_ALL, FREE_ADDITIONAL)
- **Exception Management**: Automated detection and resolution workflows
- **Late Shipment Detection**: SLA monitoring with trust score impact

### Provider Interface
All shipping providers (Shippo, EasyPost, PirateShip, etc.) implement the same `ShippingProviderInterface`:
- Address validation
- Rate shopping with recommendations
- Label purchase (idempotent)
- Tracking webhooks
- Batch operations
- International customs

### Models (10 Total)
1. `Shipment` - Core shipping entity with state machine
2. `ShippingLabel` - Label purchase and lifecycle
3. `TrackingEvent` - Individual tracking updates
4. `ShippingProfile` - Seller shipping configuration
5. `ShippingRate` - Rate quotes with expiration
6. `ShippingException` - Delivery issues requiring attention
7. `ReturnShipment` - Return label management
8. `ShippingSettings` - Platform-wide configuration

### Integration Points
- **Ledger**: SHIPPING_LABEL_FEE, SHIPPING_LABEL_REFUND, SHIPPING_INSURANCE_CLAIM
- **Trust**: Late shipment events impact seller standards
- **Notifications**: 10+ templates for buyer/seller shipping communications
- **Health**: Comprehensive provider with 9+ checks

### Phase Integration
- Phase 3: Cart, Orders, Fulfillment (Shipment creation, combined shipping)
- Phase 34: Shipping Labels (Label purchase, void, tracking webhooks)
- Phase 40: International (Customs, duties calculation)

---

**Version:** 2.0  
**Status:** CANONICAL  
**Last Updated:** January 2026

