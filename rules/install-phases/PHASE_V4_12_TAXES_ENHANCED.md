# V4 Install Phase 12 — Taxes & Compliance Enhanced

**Status:** DRAFT (V4)
**Prereq:** Drizzle schema infrastructure, `packages/commerce` exists, Stripe integration operational, Financial Center (Canonical 31) operational
**Canonical:** `rules/canonicals/29_TAXES_COMPLIANCE.md`

---

## 0) What this phase installs

### Backend
- `taxJurisdiction` table -- configurable US state/county/city tax rates (Drizzle)
- `taxExemption` table -- buyer tax exemption certificates with staff verification
- `taxDocument` table -- generated 1099-K documents for seller tax reporting
- Extensions to existing `taxQuote` table (provider, taxRateBps, lineItemBreakdownJson, isLocked, exemptionId, validatedAddressJson)
- Tax calculator interface (`TaxCalculator`) with internal US-baseline implementation
- Calculator factory for provider hot-swap (internal / taxjar / avalara)
- Address validation hook (internal format-check baseline)
- Tax service: estimate, create quote, lock on payment
- Exemption service: create, verify, revoke, check
- 1099-K document service: threshold tracking, annual generation, correction/void
- Receipt data generator with multi-level tax breakdown

### Hub UI
- `(hub)/cfg/tax` -- Tax provider configuration and fallback rates
- `(hub)/cfg/tax/jurisdictions` -- Jurisdiction rate CRUD
- `(hub)/cfg/tax/exemptions` -- Exemption certificate review queue
- `(hub)/fin/tax-documents` -- 1099-K document management and IRS filing status
- `(hub)/my/selling/tax` -- Seller tax info center and document downloads

### Ops
- BullMQ crons: annual 1099-K generation, daily threshold check, exemption expiry, jurisdiction refresh
- Seed data: 50 US states + DC with baseline rates, category exemptions for clothing-exempt states

---

## 1) Schema (Drizzle)

### Files

| File | Action |
|---|---|
| `packages/db/src/schema/tax.ts` | MODIFY -- add `taxJurisdiction`, `taxExemption`, `taxDocument`; extend `taxQuote` |
| `packages/db/src/schema/index.ts` | MODIFY -- add new table exports |

### `taxJurisdiction` -- Canonical 29 section 3.3

```typescript
export const taxJurisdiction = pgTable('tax_jurisdiction', {
  id, code (text, unique), country (text, default 'US'), state (text),
  county (text?), city (text?), rateBps (integer),
  isActive (boolean, default true), effectiveAt (timestamp), expiresAt (timestamp?),
  isMarketplaceFacilitator (boolean, default true),
  exemptCategorySlugs (text[], default []), exemptThresholdCents (integer?),
  notes (text?), createdAt, updatedAt
});
// Indexes: tj_country_state, tj_code
```

### `taxExemption` -- Canonical 29 section 3.4

```typescript
export const taxExemption = pgTable('tax_exemption', {
  id, userId (FK user, onDelete cascade), exemptionType (text),
  jurisdictionCode (text?), certificateNumber (text),
  certificateFileUrl (text?), isActive (boolean),
  verifiedAt (timestamp?), verifiedByStaffId (text?),
  validUntil (timestamp?), revokedAt (timestamp?), revokedReason (text?),
  createdAt, updatedAt
});
// Indexes: te_user_active, te_cert
```

### `taxDocument` -- Canonical 29 section 3.5

```typescript
export const taxDocument = pgTable('tax_document', {
  id, sellerId (FK user, onDelete restrict), taxYear (integer),
  documentType (text, default '1099-K'), status (text, default 'PENDING'),
  grossAmountCents (integer), transactionCount (integer),
  legalName (text), taxIdLastFour (text), address (jsonb),
  documentUrl (text?), documentUrlExpiresAt (timestamp?),
  deliveredAt (timestamp?), deliveryMethod (text?),
  filedWithIrsAt (timestamp?), irsConfirmation (text?),
  createdAt, updatedAt
});
// Indexes: td_seller_year, td_status
// Unique: td_unique_seller_year_type (sellerId, taxYear, documentType)
```

### Extend `taxQuote` -- add columns

```
provider:               text NOT NULL DEFAULT 'internal'
taxRateBps:             integer NOT NULL DEFAULT 0
lineItemBreakdownJson:  jsonb
exemptionId:            text
isLocked:               boolean NOT NULL DEFAULT false
validatedAddressJson:   jsonb
```

### Migration

```bash
npx drizzle-kit generate --name taxes_enhanced
npx drizzle-kit migrate
npx turbo typecheck --filter=@twicely/db
```

---

## 2) Server actions + queries

### Files

| File | Action |
|---|---|
| `packages/commerce/src/tax/types.ts` | CREATE -- TaxCalcInput, TaxCalcResult, TaxCalculator |
| `packages/commerce/src/tax/internal-calculator.ts` | CREATE -- Internal US calculator |
| `packages/commerce/src/tax/calculator-factory.ts` | CREATE -- Provider resolution from settings |
| `packages/commerce/src/tax/address-validator.ts` | CREATE -- AddressValidator interface + internal |
| `packages/commerce/src/tax/tax-service.ts` | CREATE -- estimateTax, createTaxQuote, lockTaxQuote |
| `packages/commerce/src/tax/exemption-service.ts` | CREATE -- createExemption, verifyExemption, revokeExemption, checkExemption |
| `packages/commerce/src/tax/document-service.ts` | CREATE -- generate1099K, correctDocument, voidDocument, getSellerDocuments |
| `packages/commerce/src/tax/receipt-generator.ts` | CREATE -- generateReceiptData |
| `packages/commerce/src/tax/index.ts` | CREATE -- barrel export |
| `apps/web/src/lib/queries/tax.ts` | CREATE -- getTaxJurisdictions, getTaxExemptions, getSellerTaxDocuments |
| `apps/web/src/lib/actions/tax.ts` | CREATE -- server actions for admin CRUD and seller-facing actions |

### Key Service Functions

**tax-service.ts:**
- `estimateTax(input: TaxCalcInput)` -- returns draft result (not persisted)
- `createTaxQuote(orderId, input)` -- persists to taxQuote table
- `lockTaxQuote(orderId)` -- sets isLocked=true after payment capture
- `getTaxQuoteForOrder(orderId)` -- read-only query

**exemption-service.ts:**
- `createExemption(userId, data)` -- creates pending exemption (requires verification if setting enabled)
- `verifyExemption(exemptionId, staffId)` -- staff approves certificate
- `revokeExemption(exemptionId, staffId, reason)` -- deactivates with reason
- `checkExemption(userId, jurisdictionCode)` -- returns active exemption if exists

**document-service.ts:**
- `checkThresholdAndFlag(sellerId, taxYear)` -- flags seller when crossing $600 threshold
- `generate1099K(sellerId, taxYear)` -- aggregates sales, generates document record
- `correctDocument(documentId, staffId)` -- creates corrected version
- `voidDocument(documentId, staffId)` -- voids document
- `getSellerDocuments(sellerId)` -- returns all documents for seller

### Integration: Order Creation

In `packages/commerce/src/create-order.ts`, after order creation:
1. Call `createTaxQuote(orderId, taxCalcInput)`
2. Update `order.taxCents` from quote
3. After payment capture: `lockTaxQuote(orderId)`

---

## 3) UI pages

### Files

| File | Action |
|---|---|
| `apps/web/src/app/(hub)/cfg/tax/page.tsx` | CREATE -- Tax provider config |
| `apps/web/src/app/(hub)/cfg/tax/jurisdictions/page.tsx` | CREATE -- Jurisdiction CRUD |
| `apps/web/src/app/(hub)/cfg/tax/exemptions/page.tsx` | CREATE -- Exemption review queue |
| `apps/web/src/app/(hub)/fin/tax-documents/page.tsx` | CREATE -- 1099-K dashboard |
| `apps/web/src/app/(hub)/fin/tax-documents/[id]/page.tsx` | CREATE -- Document detail |
| `apps/web/src/app/(hub)/my/selling/tax/page.tsx` | CREATE -- Seller tax center |
| `apps/web/src/app/(hub)/my/selling/tax/documents/page.tsx` | CREATE -- Seller document downloads |

### Page Details

- **`(hub)/cfg/tax`**: Provider selector, fallback rates editor, facilitator toggle, exemption config. CASL: `TaxJurisdiction:manage`.
- **`(hub)/cfg/tax/jurisdictions`**: Filterable table, create/edit/deactivate, category exemption config. CASL: `TaxJurisdiction:manage`.
- **`(hub)/cfg/tax/exemptions`**: Pending queue, verify/reject with note, certificate file viewer. CASL: `TaxExemption:manage`.
- **`(hub)/fin/tax-documents`**: All generated 1099-Ks by year and status, re-generate/correct/void. CASL: `TaxDocument:manage`.
- **`(hub)/my/selling/tax`**: View/update W-9, threshold status, annual summary. CASL: own data only.

---

## 4) Tests

### Files

| File | Action |
|---|---|
| `packages/commerce/src/tax/__tests__/internal-calculator.test.ts` | CREATE |
| `packages/commerce/src/tax/__tests__/tax-service.test.ts` | CREATE |
| `packages/commerce/src/tax/__tests__/exemption-service.test.ts` | CREATE |
| `packages/commerce/src/tax/__tests__/document-service.test.ts` | CREATE |
| `packages/commerce/src/tax/__tests__/address-validator.test.ts` | CREATE |
| `packages/commerce/src/tax/__tests__/calculator-factory.test.ts` | CREATE |
| `packages/commerce/src/tax/__tests__/receipt-generator.test.ts` | CREATE |

### Test Matrix

| Category | Count |
|----------|-------|
| Internal calculator: state lookup, rate application, rounding | 6 |
| Internal calculator: category exemption, threshold exemption | 4 |
| Internal calculator: fallback rate from settings, no rate = 0 + warning | 3 |
| Internal calculator: line item proportional split | 2 |
| Tax service: estimate (no persist), create (persisted), lock | 5 |
| Tax service: locked quote cannot be modified | 2 |
| Exemption: create, verify, revoke, check active | 5 |
| Exemption: expired cert not applied, max per user enforced | 3 |
| Document: 1099-K generation for qualifying seller | 3 |
| Document: threshold check flags seller, below threshold skipped | 3 |
| Document: correction creates new, voids old | 2 |
| Address validator: valid US, invalid format, missing fields, normalization | 4 |
| Calculator factory: resolves internal, throws on unknown | 2 |
| Receipt generator: builds correct breakdown, handles exemption | 3 |
| **Total** | **47** |

---

## 5) Doctor checks

| Check | Pass Condition |
|-------|----------------|
| `tax.jurisdiction_table` | taxJurisdiction table accessible, >= 46 active US rows |
| `tax.exemption_table` | taxExemption table accessible |
| `tax.document_table` | taxDocument table accessible |
| `tax.calculator_works` | Internal calculator returns valid result for CA test input |
| `tax.quote_create_lock` | Create quote, lock, verify isLocked=true |
| `tax.address_validation` | Internal validator returns isValid=true for valid US address |
| `tax.platform_settings` | All tax.* settings readable with defaults |
| `tax.zero_rate_states` | OR, NH, DE, MT, AK return 0 tax |

---

## Seed Data

### Jurisdiction Seed

50 US states + DC. 45 states with non-zero rates, 5 with rateBps=0 (AK, DE, MT, NH, OR). Category exemptions:
- PA: clothing exempt (`exemptCategorySlugs: ['clothing']`)
- NJ: clothing exempt
- MN: clothing exempt
- NY: clothing under $110 exempt (`exemptThresholdCents: 11000`)

### Platform Settings Seed

All keys from Canonical 29 section 11:
```
tax.provider, tax.addressValidator.provider, tax.fallbackRates,
tax.exemption.requireVerification, tax.exemption.maxPerUser,
tax.quote.lockOnPayment, tax.marketplace.facilitatorDefault,
tax.1099k.federalThresholdCents, tax.1099k.generationCronPattern,
tax.1099k.documentTtlHours, tax.jurisdiction.seedStates
```

---

## Completion Criteria

- [ ] `taxJurisdiction`, `taxExemption`, `taxDocument` tables created and migrated
- [ ] `taxQuote` extended with provider, taxRateBps, lineItemBreakdown, isLocked, exemptionId, validatedAddressJson
- [ ] Internal calculator computes tax from jurisdiction table with fallback
- [ ] Calculator factory resolves provider from platform_settings
- [ ] Address validator runs before tax calculation
- [ ] Tax quotes created during order flow, locked on payment
- [ ] Exemption certificate upload + staff verification flow working
- [ ] 1099-K threshold tracking and annual generation functional
- [ ] 1099-K correction and void flows working
- [ ] Receipt generator produces correct multi-level tax breakdown
- [ ] All hub pages render with CASL gating
- [ ] 50 US states + DC seeded in taxJurisdiction
- [ ] Category exemptions configured for PA, NJ, MN, NY
- [ ] All tax.* platform settings seeded
- [ ] `npx turbo typecheck` passes (0 errors)
- [ ] `npx turbo test` passes (>= BASELINE_TESTS + 47 new)
