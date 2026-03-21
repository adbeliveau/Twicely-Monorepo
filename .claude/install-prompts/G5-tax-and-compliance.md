# [G5] Tax & Compliance — TaxJar, 1099-K, Affiliate 1099-NEC

**Phase & Step:** G5 (single step, decomposed into 6 sub-steps)
**Feature Name:** Tax & Compliance System
**One-line Summary:** Sales tax calculation via TaxJar at checkout, seller 1099-K generation, affiliate 1099-NEC generation, tax document management, tax info collection, and admin tax compliance tools.
**Date Written:** 2026-03-14

## Canonical Sources — READ ALL BEFORE STARTING

| Document | What to look for |
|----------|-----------------|
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` §43 | Tax & Compliance business rules: marketplace facilitator, 1099-K threshold, tax info collection, admin settings |
| `TWICELY_V3_SCHEMA_v2_1_0.md` §17 | `taxInfo` table (§17.1) and `taxQuote` table (§17.2) — ALREADY IN CODEBASE |
| `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` §3.2 | Stripe 1099 e-file costs ($2.99 IRS, $1.49 state) |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` §16 | Tax settings: `tax.facilitatorEnabled`, `tax.1099kThresholdCents`, `tax.earlyWarningThresholdCents` |
| `TWICELY_V3_FINANCIAL_CENTER_CANONICAL_v3_0.md` §6.5, §6.6 | Tax withholding assistant (PRO), quarterly tax estimates (PRO), tax prep package |
| `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` §4–§5 | Ledger entry types, order payment flow, how taxCents flows |
| `TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md` §2.6 | Affiliate 1099-NEC: $600+/year threshold, tax info required before first payout |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` §4.2, §12.3 | PII handling (SSN/EIN encrypted, restricted access), tax compliance requirements |
| `TWICELY_V3_PAGE_REGISTRY.md` §4 | `/my/selling/finances/settings` (D4 — tax settings), `/my/selling/finances/reports` (D4 — tax prep) |
| `TWICELY_V3_DECISION_RATIONALE.md` §110 | Financial records: 7-year retention |

---

## SPEC INCONSISTENCIES (6 Found — Owner Decision Required)

### INCONSISTENCY 1: SSN/Tax ID Storage
- **Actors Security §4.2** says: "SSN/Tax ID never stored in Twicely — Stripe Connect handles KYC — we store verification status only"
- **Schema doc §17.1** defines `taxInfo` table with `taxIdEncrypted` (AES-256-GCM encrypted SSN/EIN)
- **Feature Lock-in §43** says: "Data encrypted at rest (AES-256-GCM), stored in separate database table with restricted access"
- **RECOMMENDATION:** Follow Schema doc + Feature Lock-in. The Actors Security statement appears to be about general KYC, not specifically about 1099 tax reporting which requires SSN/EIN collection. Stripe 1099 filing via Stripe Tax Reporting also requires this data to be collected. The `taxInfo` table already exists in `tax.ts`.
- **OWNER DECISION NEEDED:** Confirm we store encrypted SSN/EIN in `taxInfo` for 1099 reporting purposes.

### INCONSISTENCY 2: Missing `/my/selling/tax` Route
- **Feature Lock-in §43** says: "At `/my/selling/tax`: seller enters SSN or EIN, legal name, address"
- **Page Registry** has NO entry for `/my/selling/tax`. The closest route is `/my/selling/finances/settings` (D4) described as "Payout preferences, tax settings, accounting integrations"
- **RECOMMENDATION:** Build a standalone `/my/selling/tax` page as Feature Lock-in specifies, since tax info collection is sensitive enough to warrant its own isolated page rather than being buried in finance settings.
- **OWNER DECISION NEEDED:** Use `/my/selling/tax` (per Feature Lock-in) or embed in `/my/selling/finances/settings` (per Page Registry)?

### INCONSISTENCY 3: TaxJar vs Stripe Tax vs Avalara
- **Feature Lock-in §43** says: "Tax rate sourced from third-party tax API (TaxJar or similar)"
- **Actors Security §12.3** says: "Integrate tax service (TaxJar, Avalara, or Stripe Tax)"
- **Platform Settings §16** has `tax.taxApiProvider` key but it's NOT listed in the Platform Settings Canonical (only `tax.facilitatorEnabled`, `tax.1099kThresholdCents`, `tax.earlyWarningThresholdCents` are listed)
- **Pricing Canonical §3.2** references Stripe 1099 e-file fees, suggesting Stripe Tax Reporting for 1099 filing
- **RECOMMENDATION:** Use TaxJar for sales tax calculation (it's the most common for marketplace facilitators), Stripe Tax Reporting API for 1099-K e-filing. Build behind provider abstraction so the tax calc provider can be swapped.
- **OWNER DECISION NEEDED:** Confirm TaxJar for tax calc + Stripe for 1099 filing.

### INCONSISTENCY 4: Affiliate 1099-NEC Collection Point
- **Affiliate Canonical §2.6** says: "Must provide tax info (SSN/EIN) before first payout"
- **Schema doc** has `affiliate.taxInfoProvided` boolean but no FK to `taxInfo`
- **RECOMMENDATION:** Reuse the same `taxInfo` table for affiliates. The `taxInfo.userId` references `user.id`, and affiliates are users. Set `affiliate.taxInfoProvided = true` when `taxInfo` row exists for that user. Block affiliate payouts if `taxInfoProvided = false` AND `totalEarnedCents >= earlyWarningThresholdCents`.
- **OWNER DECISION NEEDED:** Confirm affiliates share the `taxInfo` table with sellers.

### INCONSISTENCY 5: Platform Settings Key for Tax API Provider
- **Feature Lock-in §43** lists `tax.taxApiProvider: "taxjar"` as an admin setting
- **Platform Settings Canonical §16** does NOT include this key — only 3 keys listed
- **RECOMMENDATION:** Add `tax.taxApiProvider` to the seed. Also add `tax.1099necThresholdCents` for affiliate threshold (same $600 default, but separate setting allows independent control).
- **OWNER DECISION NEEDED:** Confirm adding the missing platform settings keys.

### INCONSISTENCY 6: 1099-K Filing Mechanism
- **Feature Lock-in §43** says: "Filed electronically with IRS" and "1099-K generated annually, available for download at `/my/selling/tax` by January 31"
- **Pricing Canonical §3.2** lists Stripe 1099 e-file costs ($2.99/seller IRS, $1.49/seller state), implying Stripe handles the actual filing
- **Schema doc** has NO `taxDocument` table for storing generated 1099 documents
- **RECOMMENDATION:** Stripe Tax Reporting handles actual IRS filing. Twicely generates a preview/copy of the 1099-K data for sellers to download. Store document metadata in `financialReport` table (which already has `reportType` including 'TAX_PREP'). Use `reportType: '1099_K'` and `reportType: '1099_NEC'` as new report types.
- **OWNER DECISION NEEDED:** Confirm using `financialReport` table for 1099 document storage vs creating a new `taxDocument` table.

---

## PREREQUISITES

| Prerequisite | Status |
|-------------|--------|
| Phase C3 (Stripe Connect Onboarding) | COMPLETE |
| Phase D4 (Financial Center) | COMPLETE |
| Phase G3.3 (Affiliate Payouts) | COMPLETE |
| `taxInfo` table in `tax.ts` | EXISTS (schema only, no business logic) |
| `taxQuote` table in `tax.ts` | EXISTS (schema only, no business logic) |
| `order.taxCents` column | EXISTS |
| `stripe.irsEfileCents` and `stripe.stateEfileCents` platform settings | SEEDED |
| `finance.tax.*` platform settings (8 keys) | SEEDED |
| Encryption utility at `lib/encryption.ts` | VERIFY — may need to be created |

---

## DECOMPOSITION — 6 Sub-Steps

G5 is decomposed into 6 sequential sub-steps. Each produces a working, testable increment.

| Sub-step | Name | Depends On | Est. Time |
|----------|------|------------|-----------|
| G5.1 | Tax info collection + encryption service | G5 prereqs | 45 min |
| G5.2 | TaxJar integration (sales tax at checkout) | G5.1 | 60 min |
| G5.3 | 1099-K threshold tracking + payout gating | G5.1 | 45 min |
| G5.4 | 1099-K document generation + seller download | G5.3 | 45 min |
| G5.5 | Affiliate 1099-NEC generation | G5.1, G5.3 | 30 min |
| G5.6 | Admin tax compliance hub page + notifications | G5.3, G5.4, G5.5 | 45 min |

---

## G5.1 — Tax Info Collection + Encryption Service

### Scope

**Database:** No new tables. `taxInfo` already exists in `src/lib/db/schema/tax.ts` with all required columns (taxIdType, taxIdEncrypted, taxIdLastFour, legalName, businessName, address1, city, state, zip, country, w9ReceivedAt, form1099Threshold).

**Encryption Service:** Create or verify `src/lib/encryption.ts` implementing AES-256-GCM encryption per Platform Settings Canonical §1.4. Functions needed:
- `encrypt(plaintext: string): string` — returns `iv:tag:ciphertext` format
- `decrypt(encryptedStr: string): string` — reverses encryption
- `maskTaxId(lastFour: string): string` — returns `***-**-1234` for SSN or `**-***1234` for EIN

**CASL:** Add `TaxInfo` to CASL subjects. Rules:
- Seller: `can('read', 'TaxInfo', { userId: session.userId })` and `can('update', 'TaxInfo', { userId: session.userId })`
- STAFF(ADMIN, FINANCE): `can('read', 'TaxInfo')` — can view any seller's tax info (masked)
- STAFF(ADMIN): `can('manage', 'TaxInfo')` — full access
- All other roles: NO access to TaxInfo. Not SUPPORT, not MODERATION, not HELPDESK.
- Reference: Feature Lock-in §43 — "Only accessible by: the seller, compliance admin role."

**Validation:** Create `src/lib/validations/tax.ts` with Zod schemas:
- `taxInfoSchema`: taxIdType (enum: 'SSN' | 'EIN' | 'ITIN'), taxId (string, validated format per type — SSN: 9 digits, EIN: 9 digits, ITIN: 9 digits starting with 9), legalName (required string), businessName (optional), address1 (required), city (required), state (required, US state code), zip (required, US zip format), country (default 'US'). `.strict()`.
- SSN format validation: `/^\d{9}$/` (raw digits, no dashes — dashes stripped before encryption)
- EIN format validation: `/^\d{9}$/`

**Server Actions:** Create `src/lib/actions/tax-info.ts`:
- `saveTaxInfoAction(formData)`: Validates input via `taxInfoSchema`, encrypts taxId using `encrypt()`, stores `taxIdLastFour` (last 4 digits), upserts into `taxInfo` table. Logs audit event. Revalidates path.
- `getTaxInfoAction()`: Returns tax info for current user. `taxIdEncrypted` field is NEVER returned to client — return `taxIdLastFour` and `taxIdType` only.

**Queries:** Create `src/lib/queries/tax-info.ts`:
- `getTaxInfoByUserId(userId: string)`: Returns tax info row for user. Excludes `taxIdEncrypted` from returned fields (use explicit field selection, NOT spread).
- `getTaxInfoForAdmin(userId: string)`: Returns tax info with masked taxId. Used by admin tax compliance page.

**Page:** Create `/my/selling/tax/page.tsx` (per Feature Lock-in §43):
- SSR page with `auth.api.getSession()` check
- SELLER gate
- Form with taxIdType selector, taxId input (masked on blur), legalName, businessName, address fields
- Shows masked last-four after submission
- "Your tax information is encrypted and stored securely. Only you and authorized compliance staff can view it."
- Submit calls `saveTaxInfoAction`
- If `taxInfo` already exists, show current data (masked) with "Update" button

**Platform Settings:** Add to seed (3 new, 1 already in Feature Lock-in but not seeded):
```
tax.facilitatorEnabled: true (boolean) — "Enable marketplace facilitator tax collection"
tax.1099kThresholdCents: 60000 (cents) — "IRS 1099-K reporting threshold ($600)"
tax.earlyWarningThresholdCents: 50000 (cents) — "Tax info collection trigger ($500)"
tax.taxApiProvider: "taxjar" (string) — "Third-party tax rate provider"
tax.1099necThresholdCents: 60000 (cents) — "IRS 1099-NEC reporting threshold for affiliates ($600)"
```

### Files

| File | Description |
|------|-------------|
| `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt/mask utility (CREATE or VERIFY) |
| `src/lib/validations/tax.ts` | Zod schemas for tax info input (CREATE) |
| `src/lib/actions/tax-info.ts` | saveTaxInfoAction, getTaxInfoAction server actions (CREATE) |
| `src/lib/queries/tax-info.ts` | getTaxInfoByUserId, getTaxInfoForAdmin queries (CREATE) |
| `src/app/(hub)/my/selling/tax/page.tsx` | Tax info collection page (CREATE) |
| `src/lib/casl/subjects.ts` | Add TaxInfo subject (MODIFY) |
| `src/lib/casl/platform-abilities.ts` | Add TaxInfo CASL rules (MODIFY) |
| `src/lib/db/seed/v32-platform-settings-extended.ts` | Add 5 tax platform settings (MODIFY) |
| `src/lib/actions/__tests__/tax-info.test.ts` | Unit tests for tax info actions (CREATE) |
| `src/lib/queries/__tests__/tax-info.test.ts` | Unit tests for tax info queries (CREATE) |

### Acceptance Criteria

- [ ] Tax info form at `/my/selling/tax` renders for authenticated sellers
- [ ] SSN/EIN is encrypted with AES-256-GCM before storage — plaintext NEVER appears in DB
- [ ] `taxIdLastFour` stores last 4 digits only
- [ ] `taxIdEncrypted` is NEVER returned to the client — not in queries, not in actions
- [ ] Non-sellers get 403 on `/my/selling/tax`
- [ ] Non-ADMIN/FINANCE staff cannot read TaxInfo via CASL
- [ ] Zod validation rejects invalid SSN (not 9 digits) and invalid EIN (not 9 digits)
- [ ] Upsert: updating tax info replaces existing row, sets `updatedAt`
- [ ] Audit event created on every save/update
- [ ] 5 new platform settings seeded correctly

---

## G5.2 — TaxJar Integration (Sales Tax at Checkout)

### Scope

**Tax Calculation Service:** Create `src/lib/tax/tax-service.ts`:
- Provider abstraction: interface `TaxProvider` with method `calculateTax(params: TaxCalcParams): Promise<TaxCalcResult>`
- `TaxCalcParams`: `{ subtotalCents: number, shippingCents: number, buyerAddress: { state, city, zip }, sellerAddress: { state }, itemCategoryTaxCode?: string }`
- `TaxCalcResult`: `{ taxCents: number, taxRatePercent: number, jurisdictionJson: Record<string, unknown>, isMarketplaceFacilitator: boolean }`
- TaxJar implementation: `TaxJarProvider` class implementing `TaxProvider`
- Uses TaxJar API v2: `POST /v2/taxes` with `nexus_addresses` for marketplace facilitator states
- API key from environment secret: `TAXJAR_API_KEY`
- Tax code mapping: basic category-to-tax-code map (clothing exempt in some states, etc.)
- Fallback: if TaxJar API fails, use `tax.facilitatorEnabled` = false as circuit breaker — log error, return 0 tax (order proceeds without tax rather than blocking checkout)

**Checkout Integration:** Modify checkout flow to call tax service:
- At checkout step 2 (after shipping address selected), calculate sales tax
- Store result in `taxQuote` table with orderId link
- Display "Sales tax: $X.XX" as separate line item in checkout summary
- `order.taxCents` set from tax calculation result
- Tax is NOT included in TF calculation (TF applies to item subtotal + shipping only, per Pricing Canonical)

**Key Rules from Feature Lock-in §43:**
- Twicely collects sales tax as marketplace facilitator in states where required
- Tax calculated at checkout based on: buyer shipping address, item category, seller state
- Tax collected by Twicely and remitted to states — seller is NOT responsible
- Tax shown as separate line item at checkout: "Sales tax: $X.XX"

**Provider Secret:** Store TaxJar API key in `environmentSecret` table (encrypted). Key: `TAXJAR_API_KEY`.

### Files

| File | Description |
|------|-------------|
| `src/lib/tax/tax-service.ts` | TaxProvider interface + TaxJarProvider implementation (CREATE) |
| `src/lib/tax/tax-codes.ts` | Category-to-tax-code mapping (CREATE) |
| `src/lib/tax/__tests__/tax-service.test.ts` | Unit tests for tax calc service (CREATE) |
| `src/lib/commerce/create-order.ts` | Wire tax calculation into order creation (MODIFY) |
| `src/components/pages/checkout/order-confirmation.tsx` | Show tax line item (MODIFY — verify already shows) |
| `src/lib/actions/shipping-quote.ts` | Return tax preview when address changes (MODIFY if needed) |

### Acceptance Criteria

- [ ] Tax calculated server-side only — never in frontend
- [ ] TaxJar API called with correct params (nexus, amounts in dollars not cents per TaxJar API)
- [ ] Result stored in `taxQuote` table linked to order
- [ ] `order.taxCents` populated from tax calculation
- [ ] Tax shown as separate line item at checkout (not included in TF)
- [ ] Graceful fallback: if TaxJar API fails, order proceeds with $0 tax + error logged
- [ ] `tax.facilitatorEnabled` = false disables all tax calculation (returns 0)
- [ ] TaxJar API key stored encrypted in `environmentSecret`, never in code
- [ ] Local pickup orders: tax calculated based on meetup location state (buyer and seller in same state)
- [ ] All monetary values as integer cents (convert to dollars only for TaxJar API call, convert back)

---

## G5.3 — 1099-K Threshold Tracking + Payout Gating

### Scope

**Threshold Tracking Service:** Create `src/lib/tax/threshold-tracker.ts`:
- `getSellerYtdGrossSales(userId: string, year: number): Promise<number>` — sum of `order.totalCents` for COMPLETED orders where `sellerId = userId` in the given calendar year. Excludes refunded/canceled. This is GROSS sales, not net (IRS 1099-K reports gross).
- `checkThresholdStatus(userId: string): Promise<ThresholdStatus>` — returns `{ ytdGrossCents: number, thresholdCents: number, earlyWarningCents: number, needsTaxInfo: boolean, taxInfoProvided: boolean, isOverThreshold: boolean }`
- `updateThresholdFlag(userId: string)`: Called after each order completion. If `ytdGrossCents >= earlyWarningThresholdCents`, prompt for tax info. If `ytdGrossCents >= 1099kThresholdCents`, set `taxInfo.form1099Threshold = true`.

**Payout Gating:** Modify payout logic to check tax info:
- If seller's YTD gross sales >= `tax.1099kThresholdCents` AND `taxInfo` does not exist for user → BLOCK payout
- Payout action returns error: "Tax information required. Please complete your tax details at /my/selling/tax before requesting your next payout."
- This does NOT block order completion — only payout disbursement
- Reference: Feature Lock-in §43 — "Seller must complete tax info before next payout if over $600"

**Threshold Check Trigger:** After each order completion (in `order-completion.ts` or equivalent), call `updateThresholdFlag`. Use existing order completion flow — do not create a new trigger.

**Early Warning Notification:** When seller crosses `tax.earlyWarningThresholdCents` ($500 default):
- Send in-app notification: "You're approaching the $600 IRS reporting threshold. Please provide your tax information."
- Send email with same message + link to `/my/selling/tax`
- One-time notification per calendar year per seller (check `taxInfo.form1099Threshold` to avoid repeats)

### Files

| File | Description |
|------|-------------|
| `src/lib/tax/threshold-tracker.ts` | YTD gross sales calc + threshold checking (CREATE) |
| `src/lib/tax/__tests__/threshold-tracker.test.ts` | Unit tests for threshold logic (CREATE) |
| `src/lib/commerce/order-completion.ts` | Wire threshold check after order completion (MODIFY) |
| `src/lib/actions/payout-settings.ts` | Add tax info check to payout request gating (MODIFY) |
| `src/lib/notifications/templates.ts` | Add tax info required notification template (MODIFY) |

### Acceptance Criteria

- [ ] `getSellerYtdGrossSales` sums COMPLETED orders only, excludes refunded/canceled
- [ ] Uses GROSS sales (totalCents), not net — per IRS 1099-K requirements
- [ ] Calendar year basis (Jan 1 – Dec 31), not rolling
- [ ] Early warning fires at $500 (configurable via `tax.earlyWarningThresholdCents`)
- [ ] Payout blocked at $600 (configurable via `tax.1099kThresholdCents`) if no tax info
- [ ] Payout block message directs seller to `/my/selling/tax`
- [ ] Order completion is NOT blocked — only payouts
- [ ] Early warning notification sent only once per year per seller
- [ ] `taxInfo.form1099Threshold` set to `true` when threshold crossed
- [ ] All threshold values read from platform_settings, never hardcoded

---

## G5.4 — 1099-K Document Generation + Seller Download

### Scope

**1099-K Data Generator:** Create `src/lib/tax/form-1099k-generator.ts`:
- `generate1099KData(userId: string, taxYear: number): Promise<Form1099KData>` — compiles annual data:
  - Gross sales (sum of COMPLETED order totalCents for the year)
  - Number of transactions
  - Monthly breakdown (gross per calendar month — required by IRS)
  - Seller tax info (from `taxInfo` table — legalName, businessName, address, taxIdLastFour)
  - Twicely platform info (platform name, EIN, address — from platform settings or hardcoded constants)
- `Form1099KData` type: `{ taxYear, payeeName, payeeTin (last 4 only), payeeAddress, filerName, filerEin, grossAmount, transactionCount, monthlyAmounts: number[], generatedAt }`

**PDF Generation:** Use jsPDF (already in project for financial reports) to render 1099-K preview:
- NOT an official IRS form — Stripe handles actual filing
- Labeled clearly: "1099-K Summary — For Your Records. The official 1099-K is filed electronically by Twicely through Stripe."
- Includes hardcoded disclaimer per Financial Center Canonical §10: "This report is provided for informational purposes only and does not constitute tax advice. Consult a qualified tax professional before filing."

**Storage:** Store generated document in `financialReport` table:
- `reportType: '1099_K'`
- `snapshotJson`: the `Form1099KData` object
- `format: 'PDF'`
- `fileUrl`: R2 path `tax-documents/{userId}/{taxYear}/1099-K-summary.pdf`
- Retained 7 years per Decision #110

**BullMQ Job:** Create `src/lib/jobs/tax-document-generation.ts`:
- Cron job `tax:1099k:generate` runs January 15 annually
- Iterates all sellers where `taxInfo.form1099Threshold = true` for the prior year
- Generates and stores 1099-K data for each
- Sends notification: "Your 1099-K summary for {year} is ready for download"

**Seller Download:** Add download endpoint or action:
- Seller can download from `/my/selling/tax` page (add a "Tax Documents" section)
- Lists all available 1099-K documents by year
- Download returns the PDF from R2

### Files

| File | Description |
|------|-------------|
| `src/lib/tax/form-1099k-generator.ts` | 1099-K data compilation + PDF generation (CREATE) |
| `src/lib/tax/__tests__/form-1099k-generator.test.ts` | Unit tests for 1099-K generation (CREATE) |
| `src/lib/jobs/tax-document-generation.ts` | BullMQ cron job for annual 1099-K generation (CREATE) |
| `src/lib/queries/tax-documents.ts` | Query tax documents for a seller by year (CREATE) |
| `src/app/(hub)/my/selling/tax/page.tsx` | Add tax documents download section (MODIFY) |
| `src/lib/notifications/templates.ts` | Add 1099-K ready notification template (MODIFY) |

### Acceptance Criteria

- [ ] 1099-K data includes: gross amount, transaction count, monthly breakdown (12 months)
- [ ] Only COMPLETED orders counted — refunded/canceled excluded
- [ ] Generated only for sellers where `form1099Threshold = true`
- [ ] PDF clearly labeled as "Summary — For Your Records", not official IRS form
- [ ] Hardcoded disclaimer present on every generated document
- [ ] `taxIdEncrypted` is NEVER included in the document — only `taxIdLastFour`
- [ ] Document stored in R2 and referenced in `financialReport` table
- [ ] 7-year retention policy applied
- [ ] Download requires SELLER auth + own userId match
- [ ] Notification sent when document is ready

---

## G5.5 — Affiliate 1099-NEC Generation

### Scope

**Affiliate Tax Info Gate:** Modify affiliate payout flow:
- Before first payout, check `affiliate.taxInfoProvided`
- If false AND `affiliate.totalEarnedCents >= tax.1099necThresholdCents`, block payout
- Direct affiliate to `/my/selling/tax` to provide tax info (same page, same `taxInfo` table — affiliates are users)
- After affiliate submits tax info, set `affiliate.taxInfoProvided = true`

**1099-NEC Data Generator:** Create `src/lib/tax/form-1099nec-generator.ts`:
- `generate1099NECData(affiliateId: string, taxYear: number): Promise<Form1099NECData>`
- Compiles: total commissions paid in the year (from `affiliateCommission` where `status = 'PAID'`)
- Uses `taxInfo` for the affiliate's user for name/address/TIN
- `Form1099NECData` type: `{ taxYear, payeeName, payeeTin (last 4 only), payeeAddress, nonemployeeCompensation, filerName, filerEin, generatedAt }`

**PDF Generation:** Same pattern as 1099-K — jsPDF summary with disclaimer.

**BullMQ Job:** Extend `tax:1099k:generate` cron OR create separate `tax:1099nec:generate`:
- Runs January 15 annually
- Iterates all affiliates where total paid commissions >= $600 for the prior year
- Generates and stores 1099-NEC data
- Sends notification

**Storage:** In `financialReport` table with `reportType: '1099_NEC'`.

### Files

| File | Description |
|------|-------------|
| `src/lib/tax/form-1099nec-generator.ts` | 1099-NEC data compilation + PDF generation (CREATE) |
| `src/lib/tax/__tests__/form-1099nec-generator.test.ts` | Unit tests for 1099-NEC generation (CREATE) |
| `src/lib/jobs/tax-document-generation.ts` | Add 1099-NEC generation to cron job (MODIFY) |
| `src/lib/affiliate/affiliate-payout-service.ts` | Add tax info check before payout (MODIFY) |
| `src/lib/actions/tax-info.ts` | Wire affiliate taxInfoProvided update on save (MODIFY) |
| `src/lib/notifications/templates.ts` | Add 1099-NEC ready notification template (MODIFY) |

### Acceptance Criteria

- [ ] Affiliates reuse the same `taxInfo` table as sellers (via `userId`)
- [ ] `affiliate.taxInfoProvided` set to `true` when user saves tax info
- [ ] Affiliate payouts blocked if `totalEarnedCents >= 1099necThresholdCents` and no tax info
- [ ] 1099-NEC includes total non-employee compensation (commissions paid)
- [ ] Only PAID commissions counted — PENDING/REVERSED excluded
- [ ] Same disclaimer and "For Your Records" label as 1099-K
- [ ] Document stored in `financialReport` with `reportType: '1099_NEC'`
- [ ] Notification sent when 1099-NEC ready for download

---

## G5.6 — Admin Tax Compliance Hub Page + Notifications

### Scope

**Hub Page:** Create `/fin/tax` page on hub.twicely.co:
- STAFF(ADMIN, FINANCE) access only
- Dashboard showing:
  - Total sellers approaching threshold (YTD $500-$599)
  - Total sellers over threshold ($600+)
  - Total sellers with tax info provided vs missing
  - Total 1099-K documents generated for current/prior year
  - Total affiliates over 1099-NEC threshold
- Table: sellers over threshold with columns: name, email, YTD gross, tax info status (provided/missing), 1099-K generated (yes/no)
- Admin can click into user detail to see masked tax info (last 4 only)
- Admin can manually trigger 1099-K generation for a specific seller
- Admin can download all 1099-K data as CSV for the year (for reconciliation with Stripe)

**Admin Nav:** Add `/fin/tax` to hub sidebar under Finance group.

**Notification Templates:** Add 4 new notification templates:
1. `tax.info_required` — "You're approaching the IRS reporting threshold. Please provide your tax information." (email + in-app)
2. `tax.info_required_payout_blocked` — "Your payout is on hold. Tax information is required for sellers earning $600+/year." (email + in-app)
3. `tax.form_1099k_ready` — "Your 1099-K summary for {year} is available for download." (email + in-app)
4. `tax.form_1099nec_ready` — "Your 1099-NEC summary for {year} is available for download." (email + in-app)

**Queries:** Create `src/lib/queries/tax-compliance.ts`:
- `getTaxComplianceSummary(year: number)`: Aggregate stats for admin dashboard
- `getSellersNeedingTaxInfo(year: number)`: List of sellers over threshold without tax info
- `getAffilatesNeedingTaxInfo(year: number)`: List of affiliates over threshold without tax info

### Files

| File | Description |
|------|-------------|
| `src/app/(hub)/fin/tax/page.tsx` | Admin tax compliance dashboard (CREATE) |
| `src/components/hub/tax/tax-compliance-dashboard.tsx` | Client component for tax dashboard (CREATE) |
| `src/lib/queries/tax-compliance.ts` | Admin tax compliance queries (CREATE) |
| `src/lib/queries/__tests__/tax-compliance.test.ts` | Unit tests for compliance queries (CREATE) |
| `src/lib/hub/admin-nav.ts` | Add /fin/tax nav item (MODIFY) |
| `src/lib/notifications/templates.ts` | Add 4 tax notification templates (MODIFY) |

### Acceptance Criteria

- [ ] `/fin/tax` accessible only by ADMIN and FINANCE staff
- [ ] Dashboard shows accurate counts of sellers at threshold
- [ ] Tax info is shown MASKED (last 4 digits only) to admin — full SSN never displayed
- [ ] Admin can trigger manual 1099-K generation for specific seller
- [ ] CSV export includes seller name, TIN last 4, address, gross amount, transaction count
- [ ] 4 notification templates registered and working
- [ ] Hub sidebar shows "Tax Compliance" under Finance section
- [ ] All queries use calendar year basis

---

## CONSTRAINTS — WHAT NOT TO DO

1. **NEVER** store unencrypted SSN/EIN anywhere — not in logs, not in error messages, not in API responses, not in search indexes
2. **NEVER** return `taxIdEncrypted` to the client — only `taxIdLastFour` + `taxIdType`
3. **NEVER** hardcode tax rates — TaxJar provides rates dynamically
4. **NEVER** hardcode the $600 threshold — read from `tax.1099kThresholdCents` platform setting
5. **NEVER** include tax in TF calculation — TF applies to subtotal + shipping only
6. **NEVER** block order completion for missing tax info — only block payouts
7. **NEVER** display full SSN/EIN to admin staff — always masked to last 4
8. **NEVER** store TaxJar API key in code or platform_settings — use `environmentSecret` table
9. **NEVER** generate an official IRS form — label clearly as "Summary — For Your Records"
10. **NEVER** use `as any` or `@ts-ignore`
11. **NEVER** create files over 300 lines
12. **NEVER** use banned terms (no "wallet", "balance", "withdraw", etc.)
13. **NEVER** use `storeId` or `sellerProfileId` as ownership key — always `userId`

---

## TEST REQUIREMENTS

### Unit Tests (~45 total)

**G5.1 — Tax Info (10 tests):**
- Encrypts SSN correctly with AES-256-GCM
- Decrypts SSN correctly back to plaintext
- Stores last 4 digits only in `taxIdLastFour`
- Rejects invalid SSN (not 9 digits)
- Rejects invalid EIN (not 9 digits)
- ITIN validation (starts with 9)
- Upsert overwrites existing tax info
- Returns masked data only (no `taxIdEncrypted` in response)
- CASL: seller can read own tax info
- CASL: SUPPORT role cannot read any tax info

**G5.2 — Tax Calculation (8 tests):**
- Calculates tax correctly for a sample order
- Returns 0 when `tax.facilitatorEnabled` = false
- Handles TaxJar API error gracefully (returns 0, logs error)
- Stores tax quote in `taxQuote` table with correct orderId
- Tax NOT included in TF calculation
- Local pickup orders: tax based on meetup location
- Converts cents to dollars for TaxJar API, converts back
- Does not call TaxJar if tax.facilitatorEnabled is false

**G5.3 — Threshold Tracking (10 tests):**
- Calculates YTD gross sales correctly (COMPLETED orders only)
- Excludes refunded orders from YTD total
- Calendar year boundary (Dec 31 vs Jan 1)
- Early warning at $500 threshold
- Payout blocked at $600 threshold when no tax info
- Payout NOT blocked when tax info provided
- Payout NOT blocked when under threshold
- `form1099Threshold` flag set when threshold crossed
- Notification sent only once per year
- Threshold values read from platform_settings

**G5.4 — 1099-K Generation (8 tests):**
- Generates correct gross amount for year
- Monthly breakdown has 12 entries
- Transaction count matches completed orders
- Only includes COMPLETED orders (not refunded)
- Document stored in `financialReport` with type '1099_K'
- Disclaimer text present in generated data
- `taxIdEncrypted` not included in generated document
- Notification sent after generation

**G5.5 — 1099-NEC (5 tests):**
- Generates correct total from PAID commissions only
- Excludes REVERSED commissions
- Blocks affiliate payout when tax info missing + over threshold
- Reuses `taxInfo` table for affiliate tax data
- Sets `affiliate.taxInfoProvided` on save

**G5.6 — Admin Compliance (4 tests):**
- ADMIN can access `/fin/tax`
- SUPPORT cannot access `/fin/tax`
- Compliance summary returns correct counts
- CSV export includes correct data (masked TIN)

---

## FILE APPROVAL LIST — COMPLETE

### New Files (20)

| # | File | Description |
|---|------|-------------|
| 1 | `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt utility |
| 2 | `src/lib/validations/tax.ts` | Zod schemas for tax info + tax calc |
| 3 | `src/lib/actions/tax-info.ts` | Server actions: save/get tax info |
| 4 | `src/lib/queries/tax-info.ts` | Queries: get tax info by user, for admin |
| 5 | `src/lib/tax/tax-service.ts` | TaxProvider interface + TaxJarProvider |
| 6 | `src/lib/tax/tax-codes.ts` | Category-to-TaxJar-tax-code mapping |
| 7 | `src/lib/tax/threshold-tracker.ts` | YTD gross sales + threshold checking |
| 8 | `src/lib/tax/form-1099k-generator.ts` | 1099-K data compilation + PDF |
| 9 | `src/lib/tax/form-1099nec-generator.ts` | 1099-NEC data compilation + PDF |
| 10 | `src/lib/queries/tax-documents.ts` | Query tax documents for seller |
| 11 | `src/lib/queries/tax-compliance.ts` | Admin tax compliance summary queries |
| 12 | `src/lib/jobs/tax-document-generation.ts` | BullMQ cron for annual 1099 generation |
| 13 | `src/app/(hub)/my/selling/tax/page.tsx` | Tax info collection page |
| 14 | `src/app/(hub)/fin/tax/page.tsx` | Admin tax compliance dashboard |
| 15 | `src/components/hub/tax/tax-compliance-dashboard.tsx` | Client component for admin dashboard |
| 16 | `src/lib/actions/__tests__/tax-info.test.ts` | Tests for tax info actions |
| 17 | `src/lib/queries/__tests__/tax-info.test.ts` | Tests for tax info queries |
| 18 | `src/lib/tax/__tests__/tax-service.test.ts` | Tests for TaxJar integration |
| 19 | `src/lib/tax/__tests__/threshold-tracker.test.ts` | Tests for threshold tracking |
| 20 | `src/lib/tax/__tests__/form-1099k-generator.test.ts` | Tests for 1099-K generation |

### Modified Files (10)

| # | File | Description |
|---|------|-------------|
| 1 | `src/lib/casl/subjects.ts` | Add TaxInfo subject |
| 2 | `src/lib/casl/platform-abilities.ts` | Add TaxInfo CASL rules |
| 3 | `src/lib/db/seed/v32-platform-settings-extended.ts` | Add 5 tax platform settings |
| 4 | `src/lib/notifications/templates.ts` | Add 4 tax notification templates |
| 5 | `src/lib/commerce/order-completion.ts` | Wire threshold check on completion |
| 6 | `src/lib/commerce/create-order.ts` | Wire tax calculation at order creation |
| 7 | `src/lib/actions/payout-settings.ts` | Add tax info payout gate |
| 8 | `src/lib/affiliate/affiliate-payout-service.ts` | Add tax info gate for affiliate payouts |
| 9 | `src/lib/hub/admin-nav.ts` | Add /fin/tax nav item |
| 10 | `src/lib/actions/tax-info.ts` | Wire affiliate taxInfoProvided |

**Total: 20 new files + 10 modified files = 30 files**
**Expected: ~45 new tests**

---

## VERIFICATION CHECKLIST

After implementation, run ALL of these and report raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test count
pnpm test

# 3. Banned terms
grep -r "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|fvf\|Twicely Balance\|wallet\|Withdraw" src/lib/tax/ src/lib/actions/tax-info.ts src/app/\(hub\)/my/selling/tax/ src/app/\(hub\)/fin/tax/ || echo "No banned terms found"

# 4. Route prefix check
grep -r '"/l/\|"/listing/\|"/store/\|"/shop/\|"/dashboard\|"/admin' src/lib/tax/ src/app/\(hub\)/my/selling/tax/ src/app/\(hub\)/fin/tax/ || echo "No wrong routes found"

# 5. File size check
wc -l src/lib/tax/*.ts src/lib/actions/tax-info.ts src/lib/queries/tax-info.ts src/lib/queries/tax-compliance.ts src/lib/queries/tax-documents.ts src/app/\(hub\)/my/selling/tax/page.tsx src/app/\(hub\)/fin/tax/page.tsx src/components/hub/tax/*.tsx

# 6. Encryption never leaked
grep -r "taxIdEncrypted" src/lib/actions/tax-info.ts src/lib/queries/tax-info.ts src/lib/queries/tax-documents.ts src/lib/tax/ --include="*.ts" | grep -v "test" | grep -v "__tests__"

# 7. Full lint
./twicely-lint.sh
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 6139 (current baseline) + ~45 new = >= 6184
- No banned terms
- No wrong routes
- All files under 300 lines
- `taxIdEncrypted` should appear ONLY in the encryption service and database layer, never in actions/queries/client code

---

## NOTES FOR INSTALLER

1. **Check if `src/lib/encryption.ts` already exists.** Platform Settings Canonical §1.4 specifies it should exist. If it does, verify it matches the AES-256-GCM spec. If not, create it.

2. **The `taxInfo` and `taxQuote` tables already exist** in `src/lib/db/schema/tax.ts`. Do NOT create a migration to add them — they should already be in the database. If they're not, use an existing migration or create one only if needed.

3. **TaxJar API integration is V1 (stub-ready).** For initial implementation, the `TaxJarProvider` can be a well-typed stub that returns mock data when `TAXJAR_API_KEY` is not set. The interface and types are the valuable part — actual API calls can be wired when the TaxJar account is provisioned.

4. **1099 generation BullMQ job:** This is a once-per-year job. For testing, make it manually triggerable via admin action. The cron schedule (`0 0 15 1 *` — January 15, midnight) is set but won't fire until next January.

5. **Tax documents are NOT official IRS forms.** Stripe handles actual 1099 filing via Stripe Tax Reporting. Twicely generates informational summaries for sellers to download. Every document must include the disclaimer.

6. **The `financialReport` table** already exists with `reportType` as a text field. You can add '1099_K' and '1099_NEC' as new values without schema changes (it's not an enum).

7. **Affiliate tax info flow:** When a user who is an affiliate submits tax info via `/my/selling/tax`, the `saveTaxInfoAction` should check if the user has an affiliate record and update `affiliate.taxInfoProvided = true`. This is a cross-cutting concern in the save action, not a separate flow.
