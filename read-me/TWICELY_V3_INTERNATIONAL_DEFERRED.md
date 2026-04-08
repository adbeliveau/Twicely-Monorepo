# TWICELY V3 — International / Multi-currency (Designed Now, Built Post-Launch)

**Version:** v1.0 | **Date:** 2026-04-08 | **Status:** DEFERRED (post-launch Wave 3, months 6–12)
**Source:** Ported from Twicely V2 `TWICELY_V2_INSTALL_PHASE_40_INTERNATIONAL_ENHANCED.md`
**Blocked by:** `TWICELY_V3_CATALOG_NORMALIZATION_DEFERRED.md` (normalize before translating)

---

## 1. WHY DEFERRED

True international support is a **horizontal concern that touches every surface**: pricing, checkout, payments, tax, search, SEO, listings UI, seller tools, display formatting. It is not a feature add — it's an infrastructure rewrite.

US launch first. Canada/UK after catalog normalization. Full international after crosslister stabilizes and seller base proves demand.

**Do not ship US-only code that hardcodes `$` or assumes dot-separated decimals.** See Section 8 for pre-launch decisions that must be made now to avoid a rewrite later.

---

## 2. SUPPORTED CURRENCIES (target)

10 currencies at full launch:

| Code | Name | Symbol | Position | Decimals |
|---|---|---|---|---|
| USD | US Dollar | $ | before | 2 |
| CAD | Canadian Dollar | CA$ | before | 2 |
| GBP | British Pound | £ | before | 2 |
| EUR | Euro | € | after | 2 |
| AUD | Australian Dollar | A$ | before | 2 |
| JPY | Japanese Yen | ¥ | before | **0** |
| MXN | Mexican Peso | MX$ | before | 2 |
| NZD | New Zealand Dollar | NZ$ | before | 2 |
| CHF | Swiss Franc | CHF | before | 2 |
| SEK | Swedish Krona | kr | after | 2 |

**Gotchas:**
- JPY has 0 decimal places — "500 yen" not "5.00 yen". Any code assuming `cents = amount * 100` breaks.
- EUR/SEK use `,` as decimal separator in display (1.234,56 €)
- CHF uses `'` as thousands separator (1'234.56)

## 3. SUPPORTED LOCALES (target)

16 locales: `en-US`, `en-GB`, `en-CA`, `en-AU`, `es-ES`, `es-MX`, `es-AR`, `fr-FR`, `fr-CA`, `de-DE`, `de-AT`, `de-CH`, `it-IT`, `ja-JP`, `pt-BR`, `pt-PT`.

Locale is separate from currency. A UK buyer (`en-GB`) can view in EUR. A Mexican buyer (`es-MX`) can pay in USD.

---

## 4. CORE MODELS

```typescript
// Drizzle schema (adapt from V2 Prisma)

export const exchangeRates = pgTable("exchange_rates", {
  id: text("id").primaryKey(),
  fromCurrency: text("from_currency").notNull(),     // "USD"
  toCurrency: text("to_currency").notNull(),         // "EUR"
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
  inverseRate: numeric("inverse_rate", { precision: 18, scale: 8 }).notNull(),
  source: text("source").default("openexchangerates"), // manual|openexchangerates|fixer
  sourceRateId: text("source_rate_id"),
  effectiveAt: timestamp("effective_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  isManualOverride: boolean("is_manual_override").default(false),
}, (t) => ({
  uniq: uniqueIndex("rate_unq").on(t.fromCurrency, t.toCurrency, t.effectiveAt),
  active: index("rate_active").on(t.fromCurrency, t.toCurrency, t.isActive),
}));

export const userCurrencyPreference = pgTable("user_currency_preference", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  displayCurrency: text("display_currency").default("USD"),    // what they see
  checkoutCurrency: text("checkout_currency"),                 // what they pay (null = listing currency)
  notifyOnRateChanges: boolean("notify_on_rate_changes").default(false),
  rateChangeThreshold: integer("rate_change_threshold").default(500), // bps
});

export const currencyConversionLog = pgTable("currency_conversion_log", {
  id: text("id").primaryKey(),
  orderId: text("order_id"),
  listingId: text("listing_id"),
  userId: text("user_id"),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  fromAmountCents: integer("from_amount_cents").notNull(),
  toAmountCents: integer("to_amount_cents").notNull(),
  rateUsed: numeric("rate_used", { precision: 18, scale: 8 }).notNull(),
  exchangeRateId: text("exchange_rate_id").notNull(),
  conversionType: text("conversion_type").notNull(),  // display|checkout|payout|refund
  createdAt: timestamp("created_at").defaultNow(),
});

export const translations = pgTable("translations", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),               // "nav.home", "button.buy_now"
  locale: text("locale").notNull(),         // "es-ES"
  value: text("value").notNull(),
  namespace: text("namespace").default("common"),
  isVerified: boolean("is_verified").default(false),  // human vs machine
}, (t) => ({
  unq: uniqueIndex("trans_unq").on(t.key, t.locale, t.namespace),
}));

export const listingTranslations = pgTable("listing_translations", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  locale: text("locale").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  isAutomatic: boolean("is_automatic").default(false),
  aiModel: text("ai_model"),              // "claude-3", "gpt-4"
  confidence: numeric("confidence"),
  isVerified: boolean("is_verified").default(false),
  sellerEdited: boolean("seller_edited").default(false),
}, (t) => ({
  unq: uniqueIndex("lst_trans_unq").on(t.listingId, t.locale),
}));
```

Plus: `categoryTranslations`, `translationJobs` (batch AI translation), `translationGlossary`.

---

## 5. EXCHANGE RATE SERVICE

**Rules:**
- Refresh every 1 hour from openexchangerates.org (or fixer.io fallback)
- Cache active rates for 5 minutes in memory
- Store both direct and inverse rates on every row (no runtime division)
- Manual override by corp admin for critical pairs
- Never throw at display time — fall back to cached rate, then to last-known rate, then show listing currency as-is with warning

**Payments:**
- Checkout locks in the rate at order creation (`currencyConversionLog` row)
- Refunds use the **original** conversion rate, not current rate
- Payouts use the rate at payout time (seller sees FX spread)

---

## 6. TRANSLATION SERVICE

**Priority order:**
1. Seller-provided translation (highest trust)
2. Human-verified translation
3. AI-translated + seller-edited
4. AI-translated only (lowest trust, show "auto-translated" badge)
5. Fall back to source language

**AI translation:**
- Use Claude (preferred) or GPT-4 via batch job
- Preserve HTML tags in description
- Use per-locale glossary for brand-safe terms ("Twicely" never translates)
- Confidence score stored; below 0.8 → flag for review

---

## 7. MONO-SPECIFIC ADAPTATION

| Concern | V2 Pattern | Mono Adaptation |
|---|---|---|
| Schema | Prisma | Drizzle (see Section 4) |
| Rate refresh job | Phase 7 queue | BullMQ + Valkey cron |
| AI translation | Claude via abstraction | Direct Claude API (Mono already uses Claude Vision for receipts — reuse client) |
| Locale detection | Accept-Language header | Better Auth session stores locale, fallback to Accept-Language |
| Translation cache | In-memory | Valkey with 1-hour TTL |
| Format display | Custom util | Use Intl.NumberFormat + Intl.DateTimeFormat with locale |
| Search index | Phase 17 | Typesense — separate collection per locale OR locale field on main collection (benchmark both) |
| Crosslister interaction | N/A | Each external platform wants its own locale (eBay.de for Germany) — connector maps Mono locale → platform locale |
| Tax | Phase 31 | Mono tax engine must accept currency parameter; VAT rate per country |

---

## 8. PRE-LAUNCH DECISIONS (architecture implications)

Even though international is months out, these decisions must be made **now** to avoid a rewrite:

| Decision | Why | When |
|---|---|---|
| All prices stored as `cents` integer + `currency` code | JPY has 0 decimals — amount × 100 ≠ cents | Schema v1 |
| Never use `$` in hardcoded strings | All symbols must route through currency formatter | Now |
| Never use `toLocaleString('en-US')` — always pass locale | Hardcoded locale breaks later | Now |
| Listing has `currency` field (default USD, not-null) | Retrofit nullable currency is painful | Schema v1 |
| Order has `currency` + snapshotted rate | Orders immutable — refunds need original rate | Schema v1 |
| Centrifugo channel naming doesn't include locale | Locale is a view concern, not a channel concern | Now |
| Accept-Language middleware exists | Even if it only sets en-US for now | Phase A3 |
| `formatMoney(cents, currency, locale)` utility exists | All display goes through it | Now |

**Rule:** if a file contains `$` or `"USD"` as a literal outside of configuration, it's a bug.

---

## 9. OUT OF SCOPE (even at full launch)

- RTL languages (Arabic, Hebrew) — layout rewrite required
- CJK full-width formatting for descriptions
- Regional payment methods (iDEAL, SEPA, Konbini) — Stripe handles for now
- Country-specific legal (GDPR cookie banner logic is separate)
- Timezone-aware listing expiry (uses UTC for v1)

---

## 10. TIMELINE

- **Pre-launch:** Architecture decisions in Section 8 are **locked now**. Money formatter utility exists. `currency` field on listings/orders is non-null with default USD.
- **Launch + 3 months:** Exchange rate infrastructure live (USD-only transactions, but rates are fetching)
- **Launch + 6 months:** CA + UK launch (CAD, GBP) with translations en-CA, en-GB
- **Launch + 9 months:** EU launch (EUR) with es-ES, fr-FR, de-DE
- **Launch + 12 months:** Full 10 currencies × 16 locales; crosslister international targeting

---

## 11. REFERENCE

Full V2 spec (50KB, includes services, Doctor checks, health providers, UI wireframes):
`Twicely-V2/rules/install-phases/TWICELY_V2_INSTALL_PHASE_40_INTERNATIONAL_ENHANCED.md`

Scanned and imported 2026-04-08 as part of V2 → Mono gap analysis.
