# Canonical 29 — Taxes & Compliance (US-Baseline)

**Status:** DRAFT (V4)
**Domain:** Finance / Compliance
**Depends on:** Canonical 31 (Finance Reconciliation), `packages/db/src/schema/tax.ts`, `packages/commerce/src/create-order.ts`, `packages/stripe/src/`
**Package:** `packages/commerce/src/tax/`

---

## 1. Purpose

Twicely operates as a **marketplace facilitator** in all US states that require it. The platform calculates, collects, remits, and reports sales tax on behalf of sellers. This canonical defines:

- Real-time tax calculation at checkout (state-level, with county/city where applicable)
- Provider-agnostic calculator interface (internal table-driven first, TaxJar/Avalara hot-swap later)
- Tax jurisdiction rate management (the `taxJurisdiction` table)
- Tax-exempt buyer handling with certificate verification
- Per-order tax quote storage with immutability after payment
- Seller 1099-K threshold tracking and annual document generation
- Integration with Financial Center (tax line items in P&L)
- Receipt line-item tax breakdown generation
- All settings from `platform_settings`, never hardcoded

**i18n note:** V4 is US-only. Multi-country VAT/GST deferred to V5.

---

## 2. Core Principles

1. **Tax quotes are immutable once locked.** Draft quotes during checkout preview may be recalculated; once the order is paid, the quote is locked and becomes a permanent audit record.
2. **All money in integer cents.** Tax rates stored as basis points (integer, 1 bps = 0.01%). Never floats for money. `725 bps = 7.25%`.
3. **Ship-to address determines jurisdiction.** For local pickup, use the seller's registered address state.
4. **Marketplace facilitator flag per jurisdiction.** The platform collects and remits in states where it is the legal facilitator. In non-facilitator states, tax responsibility falls to the seller.
5. **Exemptions require documentation.** No blanket exemptions without a certificate number and expiry date.
6. **Provider abstraction is mandatory.** The `TaxCalculator` interface allows hot-swap between `internal`, `taxjar`, and `avalara` without schema changes.
7. **All thresholds, rates, and limits come from `platform_settings`** via `getPlatformSetting()`.
8. **1099-K reporting is threshold-driven.** The $600 federal threshold (as of 2024) is read from settings, not hardcoded.

---

## 3. Schema (Drizzle pgTable)

### 3.1 `taxInfo` -- EXISTING (no changes)

Seller tax identity data (W-9, TIN). Already in `packages/db/src/schema/tax.ts`:

```
taxInfo: userId, taxIdType, taxIdEncrypted, taxIdLastFour, legalName, businessName,
         address1, city, state, zip, country, w9ReceivedAt, form1099Threshold
```

### 3.2 `taxQuote` -- EXISTING (V4 extensions)

Per-order tax calculation record. Already in `packages/db/src/schema/tax.ts`.

**V4 adds these columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `provider` | `text NOT NULL DEFAULT 'internal'` | Which calculator produced the quote |
| `taxRateBps` | `integer NOT NULL` | Tax rate in basis points (replaces float `taxRatePercent` for precision) |
| `lineItemBreakdownJson` | `jsonb` | Per-line-item tax allocation `[{listingId, taxCents}]` |
| `exemptionId` | `text` | FK to `taxExemption` if buyer was exempt |
| `isLocked` | `boolean NOT NULL DEFAULT false` | True once order payment is captured |
| `validatedAddressJson` | `jsonb` | Normalized ship-to address used for calculation |

### 3.3 `taxJurisdiction` -- NEW

```typescript
// packages/db/src/schema/tax.ts

export const taxJurisdiction = pgTable('tax_jurisdiction', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  code:           text('code').notNull().unique(),     // 'US-CA', 'US-TX', 'US-NY-NYC'
  country:        text('country').notNull().default('US'),
  state:          text('state').notNull(),              // 2-letter state code
  county:         text('county'),
  city:           text('city'),
  rateBps:        integer('rate_bps').notNull(),         // 725 = 7.25%
  isActive:       boolean('is_active').notNull().default(true),
  effectiveAt:    timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:      timestamp('expires_at', { withTimezone: true }),
  isMarketplaceFacilitator: boolean('is_marketplace_facilitator').notNull().default(true),
  // Category-level exemptions (e.g., clothing exempt in PA under threshold)
  exemptCategorySlugs: text('exempt_category_slugs').array().notNull().default(sql`'{}'::text[]`),
  exemptThresholdCents: integer('exempt_threshold_cents'),  // null = no threshold
  notes:          text('notes'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  countryStateIdx: index('tj_country_state').on(table.country, table.state, table.isActive),
  codeIdx:         index('tj_code').on(table.code),
}));
```

### 3.4 `taxExemption` -- NEW

```typescript
export const taxExemption = pgTable('tax_exemption', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  exemptionType:     text('exemption_type').notNull(),  // 'RESELLER' | 'NONPROFIT' | 'GOVERNMENT' | 'OTHER'
  jurisdictionCode:  text('jurisdiction_code'),          // null = all jurisdictions
  certificateNumber: text('certificate_number').notNull(),
  certificateFileUrl: text('certificate_file_url'),     // S3 URL to uploaded cert
  isActive:          boolean('is_active').notNull().default(true),
  verifiedAt:        timestamp('verified_at', { withTimezone: true }),
  verifiedByStaffId: text('verified_by_staff_id'),
  validUntil:        timestamp('valid_until', { withTimezone: true }),
  revokedAt:         timestamp('revoked_at', { withTimezone: true }),
  revokedReason:     text('revoked_reason'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userActiveIdx: index('te_user_active').on(table.userId, table.isActive),
  certIdx:       index('te_cert').on(table.certificateNumber),
}));
```

### 3.5 `taxDocument` -- NEW

Generated 1099-K documents for sellers who exceed the reporting threshold.

```typescript
export const taxDocument = pgTable('tax_document', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:         text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  taxYear:          integer('tax_year').notNull(),
  documentType:     text('document_type').notNull().default('1099-K'),  // '1099-K' | 'W-9_RECEIPT'
  status:           text('status').notNull().default('PENDING'),  // 'PENDING' | 'GENERATED' | 'DELIVERED' | 'CORRECTED' | 'VOID'
  grossAmountCents: integer('gross_amount_cents').notNull(),
  transactionCount: integer('transaction_count').notNull(),
  // Seller snapshot at generation time
  legalName:        text('legal_name').notNull(),
  taxIdLastFour:    text('tax_id_last_four').notNull(),
  address:          jsonb('address').notNull(),  // {line1, city, state, zip}
  // File
  documentUrl:      text('document_url'),         // S3 signed URL to generated PDF
  documentUrlExpiresAt: timestamp('document_url_expires_at', { withTimezone: true }),
  // Delivery
  deliveredAt:      timestamp('delivered_at', { withTimezone: true }),
  deliveryMethod:   text('delivery_method'),      // 'EMAIL' | 'DOWNLOAD' | 'MAIL'
  // IRS filing
  filedWithIrsAt:   timestamp('filed_with_irs_at', { withTimezone: true }),
  irsConfirmation:  text('irs_confirmation'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerYearIdx:    index('td_seller_year').on(table.sellerId, table.taxYear),
  statusIdx:        index('td_status').on(table.status),
  uniqueSellerYear: unique('td_unique_seller_year_type').on(table.sellerId, table.taxYear, table.documentType),
}));
```

---

## 4. Calculator Interface

```typescript
// packages/commerce/src/tax/types.ts

export interface TaxCalcInput {
  orderId: string;
  shipToState: string;
  shipToPostal: string;
  shipToCountry: string;
  shipToCity?: string;
  shipToCounty?: string;
  subtotalCents: number;
  shippingCents: number;
  currency: 'USD';
  lineItems: Array<{
    listingId: string;
    priceCents: number;
    quantity: number;
    categorySlug?: string;
  }>;
  buyerId: string;
  sellerId: string;
}

export interface TaxCalcResult {
  taxCents: number;
  taxRateBps: number;              // e.g., 725 for 7.25%
  jurisdictionCode: string;        // e.g., 'US-CA'
  isMarketplaceFacilitator: boolean;
  isExempt: boolean;
  exemptionId?: string;
  exemptReason?: string;
  breakdown: Array<{
    name: string;
    rateBps: number;
    amountCents: number;
    level: 'STATE' | 'COUNTY' | 'CITY' | 'DISTRICT';
  }>;
  lineItemTax: Array<{
    listingId: string;
    taxCents: number;
  }>;
}

export interface TaxCalculator {
  name: string;
  quote(input: TaxCalcInput): Promise<TaxCalcResult>;
}
```

---

## 5. Internal Calculator (US-only baseline)

Lives in `packages/commerce/src/tax/internal-calculator.ts`.

Algorithm:
1. Look up `taxJurisdiction` by `(country, state, isActive, effectiveAt <= now, expiresAt > now or null)`. If county/city available, try more specific match first, fall back to state-level.
2. Check `taxExemption` for buyer `(userId, isActive, validUntil > now, jurisdiction matches or null)`.
3. Apply category exemptions from jurisdiction's `exemptCategorySlugs` (e.g., clothing exempt in PA under threshold).
4. Compute tax: `Math.round(taxableAmountCents * rateBps / 10000)`.
5. Split tax proportionally across line items by price weight.

**Fallback rates:** Seeded from `platform_settings` key `tax.fallbackRates` (JSON map of state code to bps). The calculator NEVER hardcodes rates. If no jurisdiction row and no fallback setting, it returns 0 tax with a logged warning.

**Provider swap:** The active provider is read from `tax.provider` setting. A factory function resolves `'internal'` | `'taxjar'` | `'avalara'` to the correct `TaxCalculator` implementation.

---

## 6. Address Validation

```typescript
// packages/commerce/src/tax/address-validator.ts

export interface AddressValidationResult {
  isValid: boolean;
  normalized?: {
    line1: string; line2?: string;
    city: string; state: string; postal: string; country: string;
    county?: string;
  };
  suggestions?: Array<{ line1: string; city: string; state: string; postal: string }>;
  errors?: string[];
}

export interface AddressValidator {
  name: string;
  validate(input: AddressInput): Promise<AddressValidationResult>;
}
```

- **Internal validator:** Format checks only (5-digit postal regex, valid state code from settings, required fields).
- **External validators** (USPS, SmartyStreets) swappable via `tax.addressValidator.provider` setting.
- Address validation runs before tax calculation at checkout. The normalized address is stored in `taxQuote.validatedAddressJson`.

---

## 7. Order Integration

Tax calculation integrates at two points:

1. **Checkout preview** -- `estimateTax(cartItems, shippingAddress)` returns a draft result (not persisted). Displayed in the checkout summary.
2. **Order creation** -- `createTaxQuote(orderId, input)` persists the final quote to the `taxQuote` table.
3. **Payment capture** -- Quote is locked (`isLocked = true`). After this, the quote is immutable.

The existing `order.taxCents` column is populated from `taxQuote.taxCents`. The `order.totalCents` = `itemSubtotalCents + shippingCents + taxCents - discountCents`.

---

## 8. Receipt Generation

Receipts pull from the order (line items, shipping) and the tax quote (jurisdiction, breakdown). A receipt renders:

- Per-item subtotals
- Shipping line
- Tax line with jurisdiction label (e.g., "CA Sales Tax (7.25%)")
- Multi-level tax breakdown if available (state + county + city + district)
- Exemption notice if the buyer was tax-exempt
- Marketplace facilitator disclosure where legally required

---

## 9. 1099-K Reporting

### 9.1 Threshold Tracking

The platform continuously tracks each seller's annual gross sales against the federal 1099-K threshold:
- Current federal threshold: $600 (stored in `tax.1099k.federalThresholdCents`, default `60000`)
- When a seller crosses the threshold, their `taxInfo.form1099Threshold` flag is set to `true`

### 9.2 Annual Generation

BullMQ cron job `generate-1099k` runs in January (configurable via `tax.1099k.generationCronPattern`):
1. Query all sellers where `form1099Threshold = true` for the prior tax year
2. Aggregate gross sales from completed orders in the tax year
3. Generate `taxDocument` record with seller snapshot (name, TIN last four, address)
4. Generate PDF from template, upload to S3 with signed URL
5. Notify seller via email with download link
6. Track IRS filing status

### 9.3 Corrections and Voids

- Staff can issue corrected 1099-Ks (status `CORRECTED`, new document generated)
- Voided documents set status to `VOID` and notify seller
- All corrections create audit events

---

## 10. Financial Center Integration

Tax data flows into the Financial Center (Canonical 31):
- `taxCents` from each order appears as a separate line item in the seller's P&L
- Marketplace facilitator taxes (collected by platform) appear in platform ledger entries
- Tax documents are accessible from the seller's Financial Center under a "Tax Documents" tab
- Annual tax summary aggregates total tax collected, remitted, and net to seller

---

## 11. Platform Settings Keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `tax.provider` | string | `'internal'` | Active tax calculator (`internal`, `taxjar`, `avalara`) |
| `tax.addressValidator.provider` | string | `'internal'` | Address validation provider |
| `tax.fallbackRates` | json | `{}` | State-code to bps fallback map (e.g., `{"CA": 725, "TX": 625}`) |
| `tax.exemption.requireVerification` | boolean | `true` | Staff must verify certificates before they take effect |
| `tax.exemption.maxPerUser` | number | `5` | Max active exemptions per buyer |
| `tax.quote.lockOnPayment` | boolean | `true` | Lock quote when order payment is captured |
| `tax.marketplace.facilitatorDefault` | boolean | `true` | Default marketplace facilitator flag for new jurisdictions |
| `tax.1099k.federalThresholdCents` | number | `60000` | Federal 1099-K reporting threshold ($600) |
| `tax.1099k.generationCronPattern` | string | `'0 6 15 1 *'` | 1099-K generation cron (Jan 15 at 6 AM UTC) |
| `tax.1099k.documentTtlHours` | number | `720` | Download link TTL for tax documents (30 days) |
| `tax.jurisdiction.seedStates` | json | `[all 50 states + DC]` | States to seed with fallback rates |

---

## 12. RBAC (CASL Permissions)

| Action | Subject | Roles |
|--------|---------|-------|
| `manage` | `TaxJurisdiction` | FINANCE, ADMIN, SUPER_ADMIN |
| `manage` | `TaxExemption` | FINANCE, ADMIN, SUPER_ADMIN |
| `create` | `TaxExemption` | Authenticated users (own exemptions only) |
| `read` | `TaxQuote` | Order owner, FINANCE, SUPPORT, ADMIN |
| `read` | `TaxDocument` | Document owner (seller), FINANCE, ADMIN |
| `manage` | `TaxDocument` | FINANCE, ADMIN, SUPER_ADMIN |
| `read` | `TaxInfo` | Own info, FINANCE, ADMIN |
| `manage` | `TaxInfo` | Own info (update), FINANCE, ADMIN |

---

## 13. Hub Routes

| Route | Purpose |
|-------|---------|
| `(hub)/cfg/tax` | Tax provider config, fallback rates, facilitator state management |
| `(hub)/cfg/tax/jurisdictions` | CRUD for jurisdiction rate table |
| `(hub)/cfg/tax/exemptions` | Review/approve exemption certificates |
| `(hub)/fin/tax-documents` | Generated 1099-K documents with filing status |
| `(hub)/fin/tax-documents/[id]` | Individual document detail + correction/void actions |

### Seller-facing:
| Route | Purpose |
|-------|---------|
| `(hub)/my/selling/tax` | Seller tax info (W-9), threshold status, annual summary |
| `(hub)/my/selling/tax/documents` | Download generated 1099-K PDFs |
| `(hub)/my/selling/tax/exemptions` | Upload exemption certificates (for buyers who are also sellers) |

---

## 14. BullMQ Jobs

| Job | Queue | Schedule | Purpose |
|-----|-------|----------|---------|
| `generate-1099k` | `tax-compliance` | `0 6 15 1 *` (Jan 15) | Annual 1099-K generation for qualifying sellers |
| `1099k-threshold-check` | `tax-compliance` | `0 0 * * *` (daily) | Flag sellers who have crossed the threshold |
| `tax-exemption-expiry` | `tax-compliance` | `0 3 * * *` (daily) | Deactivate expired exemption certificates |
| `tax-jurisdiction-refresh` | `tax-compliance` | `0 2 1 * *` (monthly) | Refresh jurisdiction rates from external provider (when not internal) |

All crons use `tz: 'UTC'` and read schedule from `platform_settings`.

---

## 15. Out of Scope

- Multi-country VAT/GST (deferred to V5 i18n phase)
- Real-time tax filing with state agencies (manual remittance for V4)
- Automated refund tax adjustments (handled in Canonical 32 dispute flow)
- Sales tax nexus calculation (platform is facilitator in all applicable states)
- Canadian HST/GST, EU VAT reverse charge
- Tax on platform fees (fees are tax-inclusive to the buyer)

---

## 16. Differentiators

| Feature | eBay | Poshmark | Twicely V4 |
|---------|------|----------|------------|
| Marketplace facilitator | Yes | Yes | Yes |
| Tax exemption certificates | Manual process | No | Self-service upload + staff verify |
| Tax breakdown on receipt | Basic | None | Multi-level (state/county/city/district) |
| Provider hot-swap | N/A | N/A | Internal / TaxJar / Avalara |
| Category exemptions | Limited | No | Per-jurisdiction category exemptions with threshold |
| 1099-K generation | Yes (opaque) | Basic | Transparent with Financial Center integration |
| Tax documents in seller dashboard | Minimal | No | Full tax document center with download + history |
