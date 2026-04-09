# TWICELY_MULTI_CURRENCY_TRANSLATIONS_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Exchange rates, currency conversion, user currency preferences, UI translations, listing translations, AI translation.  
**Audience:** Product, engineering, finance, localization, and AI agents.  
**Extends:** `TWICELY_INTERNATIONALIZATION_CANONICAL.md` (which covers regions/locales scaffolding)

---

## 1. Purpose

This canonical defines the **full multi-currency and translation system** for Twicely.

It ensures:
- buyers can view prices in their preferred currency
- exchange rates are accurate, auditable, and refreshable
- translations are consistent, verifiable, and AI-assisted
- currency conversions never break ledger integrity

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Listing currency is authoritative**  
   Sellers price in one currency; display conversion is presentation only.

2. **Conversion is logged, not hidden**  
   Every non-display conversion creates an audit trail.

3. **Rates expire and refresh**  
   No stale rates; all rates have expiration and source tracking.

4. **Translations are layered**  
   Platform UI → Category → Listing, each with fallback rules.

5. **AI translations are provisional**  
   Machine translations are flagged; human verification is tracked.

6. **Checkout locks currency**  
   Once checkout begins, conversion rates are frozen for that order.

---

## 3. Currency System

### 3.1 Supported Currencies

| Code | Name | Symbol | Decimal Places |
|------|------|--------|----------------|
| USD | US Dollar | $ | 2 |
| CAD | Canadian Dollar | CA$ | 2 |
| GBP | British Pound | £ | 2 |
| EUR | Euro | € | 2 |
| AUD | Australian Dollar | A$ | 2 |
| JPY | Japanese Yen | ¥ | 0 |
| MXN | Mexican Peso | MX$ | 2 |

**Rules:**
- New currencies require canonical update
- All amounts stored as integers (cents/minor units)
- JPY has 0 decimal places (stored as whole yen)

### 3.2 Exchange Rate Model

```ts
type ExchangeRate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: Decimal;           // High precision (18,8)
  inverseRate: Decimal;    // Pre-calculated for performance
  source: ExchangeRateSource;
  sourceRateId?: string;   // External API reference
  effectiveAt: Date;
  expiresAt: Date;
  isActive: boolean;
  isManualOverride: boolean;
  createdByUserId?: string;
};

type ExchangeRateSource = 
  | "openexchangerates"
  | "fixer"
  | "manual"
  | "seed";
```

**Rules:**
1. Only one active rate per currency pair at a time
2. Rates MUST have expiration (max 24 hours)
3. Manual overrides take precedence over API rates
4. Inverse rate is stored to avoid recalculation
5. Source is always tracked for audit

### 3.3 Exchange Rate Refresh

```ts
// Cron schedule: Every 4 hours
async function refreshExchangeRates(): Promise<RefreshResult> {
  // 1. Fetch from external API
  // 2. Deactivate old rates (unless manual override)
  // 3. Create new rates
  // 4. Clear rate cache
  // 5. Emit platform event
}
```

**Rules:**
- Refresh must not delete historical rates
- Failed refresh must alert ops, not fail silently
- Manual overrides are preserved across refreshes

### 3.4 Currency Conversion

```ts
type ConversionType = "display" | "checkout" | "payout" | "refund";

type ConversionResult = {
  originalAmountCents: number;
  originalCurrency: string;
  convertedAmountCents: number;
  convertedCurrency: string;
  rate: Decimal;
  exchangeRateId: string;
  effectiveAt: Date;
};

async function convertCurrency(args: {
  amountCents: number;
  fromCurrency: string;
  toCurrency: string;
  type: ConversionType;
  orderId?: string;
  logConversion?: boolean;
}): Promise<ConversionResult>;
```

**Conversion Rules:**
1. Same currency → no conversion, rate = 1
2. Display conversions → not logged (high volume)
3. Checkout/payout/refund conversions → always logged
4. Rounding: always round to nearest cent
5. Missing rate → throw error, never fallback to stale

### 3.5 Conversion Logging

```ts
type CurrencyConversionLog = {
  id: string;
  orderId?: string;
  listingId?: string;
  userId?: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmountCents: number;
  toAmountCents: number;
  rateUsed: Decimal;
  exchangeRateId: string;
  conversionType: ConversionType;
  createdAt: Date;
};
```

**Audit Requirements:**
- Checkout conversions: MUST log with orderId
- Payout conversions: MUST log with sellerId
- Refund conversions: MUST log with orderId

### 3.6 User Currency Preference

```ts
type UserCurrencyPreference = {
  userId: string;
  displayCurrency: string;      // What they see prices in
  checkoutCurrency?: string;    // What they pay in (null = listing currency)
  notifyOnRateChanges: boolean;
  rateChangeThreshold: number;  // Basis points (e.g., 500 = 5%)
};
```

**Rules:**
1. Default displayCurrency = USD
2. checkoutCurrency null means pay in listing currency
3. Rate change notifications are optional
4. Preference detection from locale is fallback only

---

## 4. Translation System

### 4.1 Translation Layers

| Layer | Description | Source |
|-------|-------------|--------|
| UI Strings | Navigation, buttons, labels | Platform (verified) |
| Category Names | Category tree labels | Platform (verified) |
| Listing Content | Title, description | Seller or AI |

### 4.2 UI Translation Model

```ts
type Translation = {
  id: string;
  key: string;           // "nav.home", "button.buy_now"
  locale: string;        // "es-ES", "fr-FR"
  namespace: string;     // "common", "seller", "buyer", "corp", "email"
  value: string;
  context?: string;      // For translators
  isVerified: boolean;
  verifiedByUserId?: string;
  verifiedAt?: Date;
};
```

**Namespaces:**
- `common` — Shared UI elements
- `buyer` — Buyer-facing pages
- `seller` — Seller Hub
- `corp` — Corp Admin
- `email` — Email templates

**Rules:**
1. Key format: `namespace.section.element` (e.g., `buyer.cart.checkout_button`)
2. Missing translation → fallback to en-US
3. Verified translations are human-reviewed
4. Unverified translations display with indicator

### 4.3 Listing Translation Model

```ts
type ListingTranslation = {
  id: string;
  listingId: string;
  locale: string;
  title: string;
  description: string;
  isAutomatic: boolean;    // AI-translated
  aiModel?: string;        // "claude-3-haiku"
  confidence?: number;     // 0-1 score
  isVerified: boolean;
  sellerEdited: boolean;
  sellerEditedAt?: Date;
};
```

**Rules:**
1. One translation per listing per locale
2. AI translations flagged as `isAutomatic: true`
3. Seller may edit AI translations → sets `sellerEdited: true`
4. Original listing content is always in seller's language
5. AI confidence below 0.7 should trigger review flag

### 4.4 Category Translation Model

```ts
type CategoryTranslation = {
  id: string;
  categoryId: string;
  locale: string;
  name: string;
  description?: string;
  slug?: string;           // URL-safe name
  seoTitle?: string;
  seoDescription?: string;
};
```

**Rules:**
1. Slug must be unique per locale
2. SEO fields optional but recommended for top categories
3. Missing translation → display en-US name

### 4.5 Translation Fallback Chain

```
User locale (es-MX)
  ↓ missing?
Language fallback (es-ES)
  ↓ missing?
Default locale (en-US)
  ↓ missing?
Key name (emergency fallback)
```

### 4.6 AI Translation Jobs

```ts
type TranslationJob = {
  id: string;
  type: "listing" | "category" | "ui_strings";
  targetLocales: string[];
  status: "pending" | "processing" | "completed" | "failed";
  totalItems: number;
  processedItems: number;
  successCount: number;
  errorCount: number;
  aiModel: string;
  glossaryId?: string;
  requestedByUserId: string;
};
```

**Rules:**
1. Batch jobs for bulk translation
2. Glossary support for brand/product terms
3. Failed items logged individually
4. Jobs may be cancelled mid-processing

### 4.7 Translation Glossary

```ts
type TranslationGlossary = {
  id: string;
  name: string;
  locale: string;
  entries: Array<{
    source: string;
    target: string;
    caseSensitive: boolean;
  }>;
};
```

**Use Cases:**
- Brand names (never translate)
- Product terms (consistent translation)
- Category-specific terminology

---

## 5. RBAC & Permissions

| Action | Required Permission |
|--------|---------------------|
| View exchange rates | finance.view |
| Refresh exchange rates | finance.rates.manage |
| Set manual rate override | finance.rates.override |
| View translations | settings.i18n.view |
| Edit UI translations | settings.i18n.edit |
| Run AI translation job | settings.i18n.translate |
| Edit listing translation | listing.owner OR listing.translate |
| Set currency preference | buyer (self) |

---

## 6. Health Checks

| Check | Pass Condition |
|-------|----------------|
| Active rates exist | At least 1 active rate per supported pair |
| No expired active rates | All active rates have future expiresAt |
| Major currencies covered | USD↔CAD, USD↔GBP, USD↔EUR rates exist |
| Default translations exist | en-US has 100% coverage |
| No orphaned translations | All listingIds reference valid listings |

---

## 7. Audit Requirements

**Must emit audit events:**
- Exchange rate created/deactivated
- Manual rate override set
- Translation created/updated
- AI translation job started/completed
- User currency preference changed

---

## 8. Integration Points

| System | Integration |
|--------|-------------|
| Listing Service | Get/set listing translations |
| Search Service | Index translations by locale |
| Notification Service | Send in user's locale |
| Checkout Service | Lock exchange rate at checkout |
| Payout Service | Convert payout amounts |

---

## 9. Out of Scope

- Real-time forex trading
- Currency hedging
- Seller multi-currency pricing
- Regional tax calculation (see Taxes canonical)
- Right-to-left language support (future)

---

## 10. Final Rule

Multi-currency and translations must never:
- Break ledger correctness
- Hide conversion costs from users
- Display unattributed AI content
- Use stale exchange rates

**If behavior is not defined here, it must be rejected or added to this canonical.**
