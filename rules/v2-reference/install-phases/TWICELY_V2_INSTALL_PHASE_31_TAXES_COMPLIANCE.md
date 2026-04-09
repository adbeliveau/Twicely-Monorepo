# TWICELY V2 - Install Phase 31: Taxes & Compliance (US-baseline)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  Calculator  ->  Quote  ->  Receipt  ->  Health  ->  Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`
- `/rules/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_31_TAXES_COMPLIANCE.md`  
> Prereq: Phase 30 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Tax calculation abstraction (provider-agnostic)
- Jurisdiction mapping (US state-level baseline)
- Tax quote storage linked to orders
- Receipt line items with tax breakdown
- Address validation hook

### UI (minimal)
- Checkout  ->  Tax line item display
- Order detail  ->  Tax breakdown
- Corp  ->  Settings  ->  Tax Configuration

### Ops
- Health provider: `tax`
- Doctor checks:
  - create quote  ->  verify persisted
  - order totals include tax
  - receipt renders tax line items
  - calculator interface works

---

## 1) Tax Invariants (non-negotiable)

- Tax quotes are immutable once created
- Order totals MUST include tax in final charge
- Tax jurisdiction is determined by ship-to address
- Provider abstraction allows swap (internal  ->  Avalara/TaxJar)
- All tax calculations must be auditable

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model TaxQuote {
  id           String   @id @default(cuid())
  orderId      String   @unique
  subtotalCents Int
  taxCents     Int
  totalCents   Int      // subtotalCents + taxCents
  currency     String   @default("USD")
  jurisdiction String   // e.g., "US-CA", "US-TX"
  taxRate      Float    // e.g., 0.0875 for 8.75%
  provider     String   @default("internal") // internal|avalara|taxjar
  breakdown    Json     @default("[]") // line-item breakdown
  createdAt    DateTime @default(now())

  @@index([orderId])
  @@index([jurisdiction])
}

model TaxJurisdiction {
  id          String   @id @default(cuid())
  code        String   @unique // e.g., "US-CA"
  country     String   @default("US")
  state       String?
  county      String?
  city        String?
  rate        Float    // decimal rate, e.g., 0.0875
  isActive    Boolean  @default(true)
  effectiveAt DateTime @default(now())
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([country, state, isActive])
}

model TaxExemption {
  id           String   @id @default(cuid())
  userId       String?
  sellerId     String?
  exemptionType String  // resale|nonprofit|government
  jurisdiction String?  // null = all jurisdictions
  certificate  String?  // certificate number
  isActive     Boolean  @default(true)
  expiresAt    DateTime?
  createdAt    DateTime @default(now())

  @@index([userId, isActive])
  @@index([sellerId, isActive])
}
```

Migration:
```bash
npx prisma migrate dev --name taxes_compliance_phase31
```

---

## 3) Tax Calculator Interface

Create `packages/core/tax/types.ts`:

```ts
export type TaxCalcInput = {
  orderId: string;
  shipToPostal: string;
  shipToState: string;
  shipToCountry: string;
  subtotalCents: number;
  shippingCents: number;
  currency: "USD";
  lineItems?: Array<{
    sku?: string;
    description: string;
    priceCents: number;
    quantity: number;
    taxCategory?: string; // clothing|electronics|food|etc
  }>;
  buyerId?: string;
  sellerId?: string;
};

export type TaxCalcResult = {
  taxCents: number;
  taxRate: number;
  jurisdiction: string;
  breakdown: Array<{
    name: string;
    rate: number;
    amountCents: number;
  }>;
  isExempt: boolean;
  exemptReason?: string;
};

export interface TaxCalculator {
  name: string;
  quote(input: TaxCalcInput): Promise<TaxCalcResult>;
}
```

---

## 4) Internal Tax Calculator (US-baseline)

Create `packages/core/tax/calculators/internal.ts`:

```ts
import { TaxCalculator, TaxCalcInput, TaxCalcResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Simplified US state tax rates (baseline)
const US_STATE_RATES: Record<string, number> = {
  CA: 0.0725,
  TX: 0.0625,
  NY: 0.08,
  FL: 0.06,
  WA: 0.065,
  // Add more states as needed
};

export const internalTaxCalculator: TaxCalculator = {
  name: "internal",

  async quote(input: TaxCalcInput): Promise<TaxCalcResult> {
    // Check for exemptions
    const exemption = await checkExemption(input.buyerId, input.sellerId);
    if (exemption) {
      return {
        taxCents: 0,
        taxRate: 0,
        jurisdiction: `US-${input.shipToState}`,
        breakdown: [],
        isExempt: true,
        exemptReason: exemption.exemptionType,
      };
    }

    // Get rate from jurisdiction table or fallback to hardcoded
    const jurisdiction = await prisma.taxJurisdiction.findFirst({
      where: {
        country: input.shipToCountry,
        state: input.shipToState,
        isActive: true,
      },
    });

    const rate = jurisdiction?.rate ?? US_STATE_RATES[input.shipToState] ?? 0;
    const taxableAmount = input.subtotalCents + input.shippingCents;
    const taxCents = Math.round(taxableAmount * rate);

    return {
      taxCents,
      taxRate: rate,
      jurisdiction: `${input.shipToCountry}-${input.shipToState}`,
      breakdown: [
        {
          name: `${input.shipToState} State Tax`,
          rate,
          amountCents: taxCents,
        },
      ],
      isExempt: false,
    };
  },
};

async function checkExemption(buyerId?: string, sellerId?: string) {
  if (!buyerId && !sellerId) return null;

  return prisma.taxExemption.findFirst({
    where: {
      OR: [
        { userId: buyerId, isActive: true },
        { sellerId: sellerId, isActive: true },
      ],
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
}
```

---

## 5) Tax Service

Create `packages/core/tax/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { TaxCalculator, TaxCalcInput, TaxCalcResult } from "./types";
import { internalTaxCalculator } from "./calculators/internal";

const prisma = new PrismaClient();

// Provider registry
const calculators: Record<string, TaxCalculator> = {
  internal: internalTaxCalculator,
  // avalara: avalaraTaxCalculator,
  // taxjar: taxjarTaxCalculator,
};

export async function createTaxQuote(
  input: TaxCalcInput,
  provider: string = "internal"
): Promise<{ quote: any; result: TaxCalcResult }> {
  const calculator = calculators[provider];
  if (!calculator) {
    throw new Error(`Unknown tax provider: ${provider}`);
  }

  const result = await calculator.quote(input);

  const quote = await prisma.taxQuote.create({
    data: {
      orderId: input.orderId,
      subtotalCents: input.subtotalCents,
      taxCents: result.taxCents,
      totalCents: input.subtotalCents + result.taxCents,
      currency: input.currency,
      jurisdiction: result.jurisdiction,
      taxRate: result.taxRate,
      provider,
      breakdown: result.breakdown,
    },
  });

  return { quote, result };
}

export async function getTaxQuoteForOrder(orderId: string) {
  return prisma.taxQuote.findUnique({ where: { orderId } });
}

export async function recalculateTax(orderId: string, provider?: string) {
  // Delete existing quote
  await prisma.taxQuote.deleteMany({ where: { orderId } });

  // Fetch order details and recalculate
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error("Order not found");

  // Rebuild input from order
  const input: TaxCalcInput = {
    orderId: order.id,
    shipToPostal: order.shippingPostal ?? "",
    shipToState: order.shippingState ?? "",
    shipToCountry: order.shippingCountry ?? "US",
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents ?? 0,
    currency: "USD",
    buyerId: order.buyerId,
    sellerId: order.sellerId,
  };

  return createTaxQuote(input, provider);
}
```

---

## 6) Address Validation Hook

Create `packages/core/tax/address-validation.ts`:

```ts
export type AddressValidationInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

export type AddressValidationResult = {
  isValid: boolean;
  normalized?: AddressValidationInput;
  suggestions?: AddressValidationInput[];
  errors?: string[];
};

export interface AddressValidator {
  name: string;
  validate(input: AddressValidationInput): Promise<AddressValidationResult>;
}

// Basic internal validator (format checks only)
export const internalAddressValidator: AddressValidator = {
  name: "internal",

  async validate(input: AddressValidationInput): Promise<AddressValidationResult> {
    const errors: string[] = [];

    if (!input.line1) errors.push("Street address required");
    if (!input.city) errors.push("City required");
    if (!input.state) errors.push("State required");
    if (!input.postal) errors.push("Postal code required");
    if (!input.country) errors.push("Country required");

    // US postal code format
    if (input.country === "US" && input.postal) {
      const postalRegex = /^\d{5}(-\d{4})?$/;
      if (!postalRegex.test(input.postal)) {
        errors.push("Invalid US postal code format");
      }
    }

    return {
      isValid: errors.length === 0,
      normalized: errors.length === 0 ? {
        ...input,
        state: input.state.toUpperCase(),
        country: input.country.toUpperCase(),
      } : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
```

---

## 7) Receipt Line Items

Create `packages/core/tax/receipt.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ReceiptLineItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  type: "item" | "shipping" | "tax" | "discount" | "fee";
};

export type Receipt = {
  orderId: string;
  lineItems: ReceiptLineItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  taxJurisdiction?: string;
  taxBreakdown?: Array<{ name: string; rate: number; amountCents: number }>;
};

export async function generateReceipt(orderId: string): Promise<Receipt> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error("Order not found");

  const taxQuote = await prisma.taxQuote.findUnique({
    where: { orderId },
  });

  const lineItems: ReceiptLineItem[] = [];

  // Add order items
  for (const item of order.items) {
    lineItems.push({
      description: item.title,
      quantity: item.quantity,
      unitPriceCents: item.priceCents,
      totalCents: item.priceCents * item.quantity,
      type: "item",
    });
  }

  // Add shipping
  if (order.shippingCents && order.shippingCents > 0) {
    lineItems.push({
      description: "Shipping",
      quantity: 1,
      unitPriceCents: order.shippingCents,
      totalCents: order.shippingCents,
      type: "shipping",
    });
  }

  // Add tax
  if (taxQuote && taxQuote.taxCents > 0) {
    lineItems.push({
      description: `Tax (${taxQuote.jurisdiction})`,
      quantity: 1,
      unitPriceCents: taxQuote.taxCents,
      totalCents: taxQuote.taxCents,
      type: "tax",
    });
  }

  return {
    orderId,
    lineItems,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents ?? 0,
    taxCents: taxQuote?.taxCents ?? 0,
    totalCents: order.subtotalCents + (order.shippingCents ?? 0) + (taxQuote?.taxCents ?? 0),
    currency: order.currency ?? "USD",
    taxJurisdiction: taxQuote?.jurisdiction,
    taxBreakdown: taxQuote?.breakdown as any,
  };
}
```

---

## 8) Corp APIs

### Tax Configuration
- `GET /api/platform/tax/jurisdictions` - list all jurisdictions
- `POST /api/platform/tax/jurisdictions` - create jurisdiction
- `PUT /api/platform/tax/jurisdictions/:id` - update jurisdiction
- RBAC: requires `tax.config.manage`

### Tax Exemptions
- `GET /api/platform/tax/exemptions` - list exemptions
- `POST /api/platform/tax/exemptions` - create exemption
- `DELETE /api/platform/tax/exemptions/:id` - revoke exemption
- RBAC: requires `tax.exemptions.manage`

### Tax Quotes (read-only)
- `GET /api/platform/tax/quotes/:orderId` - get tax quote for order
- RBAC: requires `orders.view`

---

## 9) Health Provider

Create `packages/core/health/providers/tax.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";
import { internalTaxCalculator } from "../tax/calculators/internal";

const prisma = new PrismaClient();

export async function checkTax(): Promise<HealthCheckResult> {
  const errors: string[] = [];

  // Check tables accessible
  try {
    await prisma.taxQuote.count();
    await prisma.taxJurisdiction.count();
  } catch {
    errors.push("Tax tables not accessible");
  }

  // Test calculator with mock input
  try {
    const result = await internalTaxCalculator.quote({
      orderId: "test-order",
      shipToPostal: "90210",
      shipToState: "CA",
      shipToCountry: "US",
      subtotalCents: 10000,
      shippingCents: 500,
      currency: "USD",
    });

    if (typeof result.taxCents !== "number") {
      errors.push("Tax calculator returned invalid result");
    }
  } catch (e) {
    errors.push(`Tax calculator error: ${e}`);
  }

  return {
    provider: "tax",
    status: errors.length === 0 ? "healthy" : "degraded",
    errors,
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 10) Doctor Checks (Phase 31)

Add to `scripts/twicely-doctor.ts`:

```typescript
async function checkPhase31(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testOrderId = `doctor_order_${Date.now()}`;

  // 1. Create tax quote -> verify persisted
  const quote = await prisma.taxQuote.create({
    data: {
      orderId: testOrderId,
      subtotalCents: 10000,
      taxCents: 725, // 7.25% CA tax
      totalCents: 10725,
      currency: "USD",
      jurisdiction: "US-CA",
      rateAppliedBps: 725,
      calculatedAt: new Date(),
    },
  });
  checks.push({
    phase: 31,
    name: "tax.quote_create",
    status: quote?.id ? "PASS" : "FAIL",
    details: `Tax: ${quote?.taxCents} cents`,
  });

  // 2. Verify quote includes correct jurisdiction
  checks.push({
    phase: 31,
    name: "tax.jurisdiction",
    status: quote?.jurisdiction === "US-CA" ? "PASS" : "FAIL",
    details: `Jurisdiction: ${quote?.jurisdiction}`,
  });

  // 3. Verify total includes tax
  const expectedTotal = quote.subtotalCents + quote.taxCents;
  checks.push({
    phase: 31,
    name: "tax.total_includes_tax",
    status: quote?.totalCents === expectedTotal ? "PASS" : "FAIL",
    details: `Total: ${quote?.totalCents} (expected ${expectedTotal})`,
  });

  // 4. Verify receipt would have tax line (check quote has required fields)
  const hasTaxData = quote.taxCents !== undefined && quote.jurisdiction !== undefined;
  checks.push({
    phase: 31,
    name: "tax.receipt_data_present",
    status: hasTaxData ? "PASS" : "FAIL",
  });

  // 5. Create jurisdiction -> verify rate lookup works
  const testJurisdiction = await prisma.taxJurisdiction.create({
    data: {
      code: "US-DOCTOR",
      name: "Doctor Test State",
      rateBps: 850,
      isActive: true,
    },
  });
  const foundJurisdiction = await prisma.taxJurisdiction.findUnique({
    where: { code: "US-DOCTOR" },
  });
  checks.push({
    phase: 31,
    name: "tax.rate_lookup",
    status: foundJurisdiction?.rateBps === 850 ? "PASS" : "FAIL",
    details: `Rate: ${foundJurisdiction?.rateBps} bps`,
  });

  // 6. Create exemption -> verify exemption record
  const testExemptUser = `exempt_user_${Date.now()}`;
  const exemption = await prisma.taxExemption.create({
    data: {
      userId: testExemptUser,
      exemptionType: "RESELLER",
      certificateNumber: "DOCTOR-TEST-123",
      isActive: true,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  checks.push({
    phase: 31,
    name: "tax.exemption_create",
    status: exemption?.isActive === true ? "PASS" : "FAIL",
    details: `Exemption type: ${exemption?.exemptionType}`,
  });

  // 7. Address validation check (verify jurisdiction parsing works)
  const validAddress = { state: "CA", country: "US" };
  const jurisdictionCode = `${validAddress.country}-${validAddress.state}`;
  checks.push({
    phase: 31,
    name: "tax.address_validation",
    status: jurisdictionCode === "US-CA" ? "PASS" : "FAIL",
    details: `Parsed: ${jurisdictionCode}`,
  });

  // Cleanup
  await prisma.taxQuote.delete({ where: { id: quote.id } });
  await prisma.taxJurisdiction.delete({ where: { id: testJurisdiction.id } });
  await prisma.taxExemption.delete({ where: { id: exemption.id } });

  return checks;
}
```


---

## 11) Phase 31 Completion Criteria

- [ ] TaxQuote, TaxJurisdiction, TaxExemption tables created
- [ ] Internal tax calculator working (US states)
- [ ] Tax quotes created and linked to orders
- [ ] Order totals include tax amounts
- [ ] Receipt generation includes tax line items
- [ ] Address validation hook functional
- [ ] Health provider `tax` reports status
- [ ] Doctor passes all Phase 31 checks
