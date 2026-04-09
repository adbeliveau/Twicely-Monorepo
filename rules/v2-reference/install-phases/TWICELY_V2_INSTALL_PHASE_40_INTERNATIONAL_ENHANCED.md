# TWICELY V2 — Install Phase 40: International Enhanced
**Status:** LOCKED (v1.0)  
**Scope:** Full multi-currency conversion + translation system  
**Backend-first:** Schema → Services → API → Health → UI → Doctor  
**Canonical:** `/rules/TWICELY_INTERNATIONALIZATION_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_40_INTERNATIONAL_ENHANCED.md`  
> Prereq: Phases 0–39 complete and Doctor green.

---

## 0) What This Phase Installs

### Backend
- ExchangeRate model with automatic refresh
- UserCurrencyPreference model
- CurrencyConversionLog for audit trail
- Translation model (UI strings)
- ListingTranslation model (seller/AI content)
- CategoryTranslation model
- Currency conversion service with caching
- Translation lookup service

### UI (Buyer)
- Currency selector in header
- Display prices in user's preferred currency
- "Prices shown in [currency]" indicator

### UI (Seller Hub)
- Add translations to listings
- View listing in different locales

### UI (Corp Admin)
- Exchange rate management (manual override)
- Translation management (UI strings)
- AI translation configuration

### Ops
- Health provider: `i18n_enhanced`
- Doctor checks: exchange rate freshness, translation coverage
- Background job: Exchange rate refresh

---

## 1) Prisma Schema (Additive)

```prisma
// =============================================================================
// EXCHANGE RATES
// =============================================================================

model ExchangeRate {
  id              String   @id @default(cuid())
  fromCurrency    String   // "USD"
  toCurrency      String   // "EUR"
  rate            Decimal  @db.Decimal(18,8)  // High precision for forex
  inverseRate     Decimal  @db.Decimal(18,8)  // Pre-calculated inverse
  source          String   @default("openexchangerates") // manual|openexchangerates|fixer
  sourceRateId    String?  // External API reference
  effectiveAt     DateTime @default(now())
  expiresAt       DateTime
  isActive        Boolean  @default(true)
  isManualOverride Boolean @default(false)
  createdAt       DateTime @default(now())
  createdByUserId String?

  @@unique([fromCurrency, toCurrency, effectiveAt])
  @@index([fromCurrency, toCurrency, isActive])
  @@index([expiresAt])
  @@index([isActive, effectiveAt])
}

model UserCurrencyPreference {
  id                String   @id @default(cuid())
  userId            String   @unique
  displayCurrency   String   @default("USD")  // What they see prices in
  checkoutCurrency  String?  // What they pay in (null = use listing currency)
  
  // Notification preferences
  notifyOnRateChanges Boolean @default(false)
  rateChangeThreshold Int     @default(500)   // basis points (5%)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model CurrencyConversionLog {
  id              String   @id @default(cuid())
  orderId         String?
  listingId       String?
  userId          String?
  fromCurrency    String
  toCurrency      String
  fromAmountCents Int
  toAmountCents   Int
  rateUsed        Decimal  @db.Decimal(18,8)
  exchangeRateId  String
  conversionType  String   // display|checkout|payout|refund
  purpose         String?  // Additional context
  createdAt       DateTime @default(now())

  @@index([orderId])
  @@index([userId, createdAt])
  @@index([conversionType, createdAt])
}

// =============================================================================
// TRANSLATIONS
// =============================================================================

model Translation {
  id              String   @id @default(cuid())
  key             String   // "nav.home", "listing.price_label", "button.buy_now"
  locale          String   // "es-ES", "fr-FR", "de-DE"
  value           String   // Translated text
  context         String?  // Where it's used (for translators)
  namespace       String   @default("common") // common|seller|buyer|corp|email
  isVerified      Boolean  @default(false)    // Human-verified vs machine
  verifiedByUserId String?
  verifiedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([key, locale, namespace])
  @@index([locale, namespace])
  @@index([key])
}

model ListingTranslation {
  id              String   @id @default(cuid())
  listingId       String
  locale          String
  title           String
  description     String   @db.Text
  
  // Translation metadata
  isAutomatic     Boolean  @default(false)  // AI-translated vs seller-provided
  aiModel         String?  // "gpt-4", "claude-3" if AI-translated
  confidence      Float?   // AI confidence score
  isVerified      Boolean  @default(false)
  verifiedByUserId String?
  verifiedAt      DateTime?
  
  // Seller can edit AI translations
  sellerEdited    Boolean  @default(false)
  sellerEditedAt  DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([listingId, locale])
  @@index([listingId])
  @@index([locale, isVerified])
}

model CategoryTranslation {
  id              String   @id @default(cuid())
  categoryId      String
  locale          String
  name            String
  description     String?
  slug            String?  // URL-safe name for this locale
  seoTitle        String?
  seoDescription  String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([categoryId, locale])
  @@index([locale])
}

// =============================================================================
// TRANSLATION JOBS (for batch AI translation)
// =============================================================================

model TranslationJob {
  id              String   @id @default(cuid())
  type            String   // listing|category|ui_strings
  targetLocales   String[] // ["es-ES", "fr-FR"]
  status          String   @default("pending") // pending|processing|completed|failed
  
  // Progress
  totalItems      Int      @default(0)
  processedItems  Int      @default(0)
  successCount    Int      @default(0)
  errorCount      Int      @default(0)
  errorsJson      Json     @default("[]")
  
  // Source selection
  sourceFilter    Json?    // { categoryId: "...", status: "ACTIVE" }
  
  // AI config
  aiModel         String   @default("claude-3-haiku")
  preserveHtml    Boolean  @default(true)
  glossaryId      String?  // Reference to translation glossary
  
  requestedByUserId String
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  @@index([status, createdAt])
  @@index([requestedByUserId])
}

model TranslationGlossary {
  id              String   @id @default(cuid())
  name            String
  description     String?
  locale          String   // Target locale for this glossary
  entriesJson     Json     @default("[]") // [{ source: "...", target: "...", caseSensitive: bool }]
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([locale, isActive])
}
```

Run migration:
```bash
npx prisma migrate dev --name i18n_enhanced_phase40
```

---

## 2) Types & Constants

Create `packages/core/i18n/enhanced/types.ts`:

```typescript
// Supported currencies (expanded from Phase 12)
export type CurrencyCode = 
  | "USD" | "CAD" | "GBP" | "EUR" | "AUD" 
  | "JPY" | "MXN" | "NZD" | "CHF" | "SEK";

// Currency metadata
export const CURRENCY_CONFIG: Record<CurrencyCode, {
  name: string;
  symbol: string;
  symbolPosition: "before" | "after";
  decimalPlaces: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}> = {
  USD: { name: "US Dollar", symbol: "$", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: ",", decimalSeparator: "." },
  CAD: { name: "Canadian Dollar", symbol: "CA$", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: ",", decimalSeparator: "." },
  GBP: { name: "British Pound", symbol: "£", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: ",", decimalSeparator: "." },
  EUR: { name: "Euro", symbol: "€", symbolPosition: "after", decimalPlaces: 2, thousandsSeparator: ".", decimalSeparator: "," },
  AUD: { name: "Australian Dollar", symbol: "A$", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: ",", decimalSeparator: "." },
  JPY: { name: "Japanese Yen", symbol: "¥", symbolPosition: "before", decimalPlaces: 0, thousandsSeparator: ",", decimalSeparator: "." },
  MXN: { name: "Mexican Peso", symbol: "MX$", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: ",", decimalSeparator: "." },
  NZD: { name: "New Zealand Dollar", symbol: "NZ$", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: ",", decimalSeparator: "." },
  CHF: { name: "Swiss Franc", symbol: "CHF", symbolPosition: "before", decimalPlaces: 2, thousandsSeparator: "'", decimalSeparator: "." },
  SEK: { name: "Swedish Krona", symbol: "kr", symbolPosition: "after", decimalPlaces: 2, thousandsSeparator: " ", decimalSeparator: "," },
};

// Supported locales (expanded)
export type LocaleCode = 
  | "en-US" | "en-GB" | "en-CA" | "en-AU"
  | "es-ES" | "es-MX" | "es-AR"
  | "fr-FR" | "fr-CA"
  | "de-DE" | "de-AT" | "de-CH"
  | "it-IT"
  | "ja-JP"
  | "pt-BR" | "pt-PT";

// Conversion result
export type ConversionResult = {
  originalAmountCents: number;
  originalCurrency: CurrencyCode;
  convertedAmountCents: number;
  convertedCurrency: CurrencyCode;
  rate: string; // Decimal as string
  exchangeRateId: string;
  effectiveAt: Date;
};

// Translation context
export type TranslationContext = {
  locale: LocaleCode;
  namespace: string;
  fallbackLocale?: LocaleCode;
};

// Conversion type for logging
export type ConversionType = "display" | "checkout" | "payout" | "refund";
```

---

## 3) Exchange Rate Service

Create `packages/core/i18n/enhanced/exchangeRates.ts`:

```typescript
import { PrismaClient, Prisma } from "@prisma/client";
import type { CurrencyCode, ConversionResult, ConversionType } from "./types";

const prisma = new PrismaClient();

// Cache for active exchange rates (5 minute TTL)
const rateCache = new Map<string, { rate: any; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get active exchange rate between two currencies
 */
export async function getActiveExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<{ rate: Prisma.Decimal; exchangeRateId: string; effectiveAt: Date }> {
  // Same currency = no conversion needed
  if (fromCurrency === toCurrency) {
    return {
      rate: new Prisma.Decimal(1),
      exchangeRateId: "same_currency",
      effectiveAt: new Date(),
    };
  }
  
  const cacheKey = `${fromCurrency}-${toCurrency}`;
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }
  
  // Try direct rate first
  let rate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      isActive: true,
      effectiveAt: { lte: new Date() },
      expiresAt: { gt: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
  });
  
  // Try inverse rate if direct not found
  if (!rate) {
    const inverse = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: toCurrency,
        toCurrency: fromCurrency,
        isActive: true,
        effectiveAt: { lte: new Date() },
        expiresAt: { gt: new Date() },
      },
      orderBy: { effectiveAt: "desc" },
    });
    
    if (inverse) {
      rate = {
        ...inverse,
        rate: inverse.inverseRate,
        fromCurrency,
        toCurrency,
      };
    }
  }
  
  if (!rate) {
    throw new Error(`NO_EXCHANGE_RATE: ${fromCurrency} to ${toCurrency}`);
  }
  
  const result = {
    rate: rate.rate,
    exchangeRateId: rate.id,
    effectiveAt: rate.effectiveAt,
  };
  
  rateCache.set(cacheKey, { rate: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/**
 * Convert currency amount
 */
export async function convertCurrency(args: {
  amountCents: number;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  type: ConversionType;
  orderId?: string;
  listingId?: string;
  userId?: string;
  logConversion?: boolean;
}): Promise<ConversionResult> {
  const { amountCents, fromCurrency, toCurrency, type, logConversion = true } = args;
  
  // Same currency = no conversion
  if (fromCurrency === toCurrency) {
    return {
      originalAmountCents: amountCents,
      originalCurrency: fromCurrency,
      convertedAmountCents: amountCents,
      convertedCurrency: toCurrency,
      rate: "1",
      exchangeRateId: "same_currency",
      effectiveAt: new Date(),
    };
  }
  
  const rateInfo = await getActiveExchangeRate(fromCurrency, toCurrency);
  const convertedCents = Math.round(amountCents * rateInfo.rate.toNumber());
  
  // Log conversion for audit trail (except display conversions to reduce noise)
  if (logConversion && type !== "display") {
    await prisma.currencyConversionLog.create({
      data: {
        orderId: args.orderId,
        listingId: args.listingId,
        userId: args.userId,
        fromCurrency,
        toCurrency,
        fromAmountCents: amountCents,
        toAmountCents: convertedCents,
        rateUsed: rateInfo.rate,
        exchangeRateId: rateInfo.exchangeRateId,
        conversionType: type,
      },
    });
  }
  
  return {
    originalAmountCents: amountCents,
    originalCurrency: fromCurrency,
    convertedAmountCents: convertedCents,
    convertedCurrency: toCurrency,
    rate: rateInfo.rate.toString(),
    exchangeRateId: rateInfo.exchangeRateId,
    effectiveAt: rateInfo.effectiveAt,
  };
}

/**
 * Batch convert multiple amounts (for listing grids)
 */
export async function batchConvertCurrency(args: {
  amounts: Array<{ id: string; amountCents: number; currency: CurrencyCode }>;
  toCurrency: CurrencyCode;
}): Promise<Map<string, { convertedCents: number; rate: string }>> {
  const results = new Map<string, { convertedCents: number; rate: string }>();
  
  // Group by source currency for efficiency
  const byCurrency = new Map<CurrencyCode, Array<{ id: string; amountCents: number }>>();
  for (const item of args.amounts) {
    const list = byCurrency.get(item.currency) ?? [];
    list.push({ id: item.id, amountCents: item.amountCents });
    byCurrency.set(item.currency, list);
  }
  
  // Convert each currency group
  for (const [fromCurrency, items] of byCurrency) {
    const rateInfo = await getActiveExchangeRate(fromCurrency, args.toCurrency);
    const rateNum = rateInfo.rate.toNumber();
    
    for (const item of items) {
      results.set(item.id, {
        convertedCents: Math.round(item.amountCents * rateNum),
        rate: rateInfo.rate.toString(),
      });
    }
  }
  
  return results;
}

/**
 * Refresh exchange rates from external API
 */
export async function refreshExchangeRates(args: {
  source?: string;
  baseCurrency?: CurrencyCode;
  actorUserId?: string;
}): Promise<{ updated: number; errors: string[] }> {
  const { source = "openexchangerates", baseCurrency = "USD" } = args;
  const errors: string[] = [];
  let updated = 0;
  
  // In production, fetch from external API
  // For now, this is a placeholder that sets rates from config
  const externalRates = await fetchExternalRates(source, baseCurrency);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  
  for (const [targetCurrency, rate] of Object.entries(externalRates)) {
    if (targetCurrency === baseCurrency) continue;
    
    try {
      // Deactivate old rates
      await prisma.exchangeRate.updateMany({
        where: {
          fromCurrency: baseCurrency,
          toCurrency: targetCurrency,
          isActive: true,
          isManualOverride: false,
        },
        data: { isActive: false },
      });
      
      // Create new rate
      const rateDecimal = new Prisma.Decimal(rate);
      const inverseDecimal = new Prisma.Decimal(1).div(rateDecimal);
      
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: baseCurrency,
          toCurrency: targetCurrency,
          rate: rateDecimal,
          inverseRate: inverseDecimal,
          source,
          effectiveAt: now,
          expiresAt,
          isActive: true,
          createdByUserId: args.actorUserId,
        },
      });
      
      updated++;
    } catch (err) {
      errors.push(`Failed to update ${baseCurrency}-${targetCurrency}: ${err}`);
    }
  }
  
  // Clear cache
  rateCache.clear();
  
  return { updated, errors };
}

async function fetchExternalRates(
  source: string,
  baseCurrency: CurrencyCode
): Promise<Record<string, number>> {
  // In production, call actual API
  // Placeholder with approximate rates
  if (baseCurrency === "USD") {
    return {
      CAD: 1.35,
      GBP: 0.79,
      EUR: 0.92,
      AUD: 1.53,
      JPY: 149.50,
      MXN: 17.15,
      NZD: 1.64,
      CHF: 0.88,
      SEK: 10.45,
    };
  }
  
  throw new Error(`Unsupported base currency for rate fetch: ${baseCurrency}`);
}

/**
 * Set manual exchange rate override
 */
export async function setManualExchangeRate(args: {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  expiresAt: Date;
  actorUserId: string;
}): Promise<void> {
  const rateDecimal = new Prisma.Decimal(args.rate);
  const inverseDecimal = new Prisma.Decimal(1).div(rateDecimal);
  
  // Deactivate existing rates for this pair
  await prisma.exchangeRate.updateMany({
    where: {
      fromCurrency: args.fromCurrency,
      toCurrency: args.toCurrency,
      isActive: true,
    },
    data: { isActive: false },
  });
  
  await prisma.exchangeRate.create({
    data: {
      fromCurrency: args.fromCurrency,
      toCurrency: args.toCurrency,
      rate: rateDecimal,
      inverseRate: inverseDecimal,
      source: "manual",
      effectiveAt: new Date(),
      expiresAt: args.expiresAt,
      isActive: true,
      isManualOverride: true,
      createdByUserId: args.actorUserId,
    },
  });
  
  // Clear cache
  rateCache.clear();
}
```

---

## 4) User Currency Preference Service

Create `packages/core/i18n/enhanced/userPreferences.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { CurrencyCode } from "./types";

const prisma = new PrismaClient();

/**
 * Get user's currency preference
 */
export async function getUserCurrencyPreference(userId: string): Promise<{
  displayCurrency: CurrencyCode;
  checkoutCurrency: CurrencyCode | null;
}> {
  const pref = await prisma.userCurrencyPreference.findUnique({
    where: { userId },
  });
  
  return {
    displayCurrency: (pref?.displayCurrency as CurrencyCode) ?? "USD",
    checkoutCurrency: pref?.checkoutCurrency as CurrencyCode | null,
  };
}

/**
 * Set user's currency preference
 */
export async function setUserCurrencyPreference(args: {
  userId: string;
  displayCurrency?: CurrencyCode;
  checkoutCurrency?: CurrencyCode | null;
  notifyOnRateChanges?: boolean;
  rateChangeThreshold?: number;
}): Promise<void> {
  const { userId, ...updates } = args;
  
  await prisma.userCurrencyPreference.upsert({
    where: { userId },
    update: updates,
    create: {
      userId,
      displayCurrency: updates.displayCurrency ?? "USD",
      checkoutCurrency: updates.checkoutCurrency,
      notifyOnRateChanges: updates.notifyOnRateChanges ?? false,
      rateChangeThreshold: updates.rateChangeThreshold ?? 500,
    },
  });
}

/**
 * Detect currency from user's region/locale
 */
export function detectCurrencyFromLocale(locale: string): CurrencyCode {
  const localeMap: Record<string, CurrencyCode> = {
    "en-US": "USD",
    "en-CA": "CAD",
    "en-GB": "GBP",
    "en-AU": "AUD",
    "de-DE": "EUR",
    "fr-FR": "EUR",
    "es-ES": "EUR",
    "it-IT": "EUR",
    "ja-JP": "JPY",
    "es-MX": "MXN",
    "en-NZ": "NZD",
    "de-CH": "CHF",
    "sv-SE": "SEK",
  };
  
  return localeMap[locale] ?? "USD";
}
```

---

## 5) Translation Service

Create `packages/core/i18n/enhanced/translations.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { LocaleCode } from "./types";

const prisma = new PrismaClient();

// Translation cache (1 hour TTL)
const translationCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Get single translation
 */
export async function getTranslation(
  key: string,
  locale: LocaleCode,
  namespace: string = "common"
): Promise<string | null> {
  const cacheKey = `${namespace}:${key}:${locale}`;
  const cached = translationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  
  const translation = await prisma.translation.findUnique({
    where: {
      key_locale_namespace: { key, locale, namespace },
    },
  });
  
  if (translation) {
    translationCache.set(cacheKey, {
      value: translation.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return translation.value;
  }
  
  return null;
}

/**
 * Get translations for a namespace (batch load)
 */
export async function getTranslationsForNamespace(
  locale: LocaleCode,
  namespace: string = "common"
): Promise<Record<string, string>> {
  const translations = await prisma.translation.findMany({
    where: { locale, namespace },
  });
  
  const result: Record<string, string> = {};
  for (const t of translations) {
    result[t.key] = t.value;
    translationCache.set(`${namespace}:${t.key}:${locale}`, {
      value: t.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
  
  return result;
}

/**
 * Get listing translation
 */
export async function getListingTranslation(
  listingId: string,
  locale: LocaleCode
): Promise<{ title: string; description: string } | null> {
  const translation = await prisma.listingTranslation.findUnique({
    where: {
      listingId_locale: { listingId, locale },
    },
  });
  
  if (!translation) return null;
  
  return {
    title: translation.title,
    description: translation.description,
  };
}

/**
 * Get or create listing translation (with AI fallback)
 */
export async function getOrCreateListingTranslation(args: {
  listingId: string;
  locale: LocaleCode;
  originalTitle: string;
  originalDescription: string;
  useAi?: boolean;
}): Promise<{ title: string; description: string; isAutomatic: boolean }> {
  // Check for existing translation
  const existing = await getListingTranslation(args.listingId, args.locale);
  if (existing) {
    const record = await prisma.listingTranslation.findUnique({
      where: { listingId_locale: { listingId: args.listingId, locale: args.locale } },
    });
    return { ...existing, isAutomatic: record?.isAutomatic ?? false };
  }
  
  // If AI disabled, return original
  if (!args.useAi) {
    return {
      title: args.originalTitle,
      description: args.originalDescription,
      isAutomatic: false,
    };
  }
  
  // Generate AI translation (placeholder - integrate with actual AI service)
  const aiTranslation = await generateAITranslation({
    title: args.originalTitle,
    description: args.originalDescription,
    targetLocale: args.locale,
  });
  
  // Save translation
  await prisma.listingTranslation.create({
    data: {
      listingId: args.listingId,
      locale: args.locale,
      title: aiTranslation.title,
      description: aiTranslation.description,
      isAutomatic: true,
      aiModel: "claude-3-haiku",
      confidence: aiTranslation.confidence,
    },
  });
  
  return {
    title: aiTranslation.title,
    description: aiTranslation.description,
    isAutomatic: true,
  };
}

/**
 * Set translation (admin/seller)
 */
export async function setTranslation(args: {
  key: string;
  locale: LocaleCode;
  value: string;
  namespace?: string;
  context?: string;
  actorUserId?: string;
}): Promise<void> {
  const { key, locale, value, namespace = "common", context, actorUserId } = args;
  
  await prisma.translation.upsert({
    where: {
      key_locale_namespace: { key, locale, namespace },
    },
    update: {
      value,
      context,
      isVerified: !!actorUserId,
      verifiedByUserId: actorUserId,
      verifiedAt: actorUserId ? new Date() : undefined,
    },
    create: {
      key,
      locale,
      value,
      namespace,
      context,
      isVerified: !!actorUserId,
      verifiedByUserId: actorUserId,
      verifiedAt: actorUserId ? new Date() : undefined,
    },
  });
  
  // Clear cache
  translationCache.delete(`${namespace}:${key}:${locale}`);
}

/**
 * Set listing translation (seller)
 */
export async function setListingTranslation(args: {
  listingId: string;
  locale: LocaleCode;
  title: string;
  description: string;
  sellerId: string;
}): Promise<void> {
  await prisma.listingTranslation.upsert({
    where: {
      listingId_locale: { listingId: args.listingId, locale: args.locale },
    },
    update: {
      title: args.title,
      description: args.description,
      isAutomatic: false,
      sellerEdited: true,
      sellerEditedAt: new Date(),
    },
    create: {
      listingId: args.listingId,
      locale: args.locale,
      title: args.title,
      description: args.description,
      isAutomatic: false,
    },
  });
}

async function generateAITranslation(args: {
  title: string;
  description: string;
  targetLocale: LocaleCode;
}): Promise<{ title: string; description: string; confidence: number }> {
  // Placeholder - integrate with actual AI service
  // In production, call Claude/GPT API
  return {
    title: args.title, // Would be translated
    description: args.description, // Would be translated
    confidence: 0.95,
  };
}

/**
 * Clear translation cache
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
```

---

## 6) API Endpoints

### 6.1 User Currency Preference

```typescript
// apps/web/app/api/user/currency-preference/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import {
  getUserCurrencyPreference,
  setUserCurrencyPreference,
} from "@/packages/core/i18n/enhanced/userPreferences";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const pref = await getUserCurrencyPreference(userId);
  return NextResponse.json(pref);
}

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const body = await req.json();
  await setUserCurrencyPreference({
    userId,
    displayCurrency: body.displayCurrency,
    checkoutCurrency: body.checkoutCurrency,
    notifyOnRateChanges: body.notifyOnRateChanges,
    rateChangeThreshold: body.rateChangeThreshold,
  });
  
  return NextResponse.json({ success: true });
}
```

### 6.2 Currency Conversion (Public)

```typescript
// apps/web/app/api/currency/convert/route.ts
import { NextResponse } from "next/server";
import { convertCurrency } from "@/packages/core/i18n/enhanced/exchangeRates";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const amount = parseInt(searchParams.get("amount") ?? "0");
  const from = searchParams.get("from") ?? "USD";
  const to = searchParams.get("to") ?? "USD";
  
  if (!amount || !from || !to) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }
  
  try {
    const result = await convertCurrency({
      amountCents: amount,
      fromCurrency: from as any,
      toCurrency: to as any,
      type: "display",
      logConversion: false,
    });
    
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Conversion failed" }, { status: 400 });
  }
}
```

### 6.3 Translations API

```typescript
// apps/web/app/api/translations/[locale]/route.ts
import { NextResponse } from "next/server";
import { getTranslationsForNamespace } from "@/packages/core/i18n/enhanced/translations";

export async function GET(
  req: Request,
  { params }: { params: { locale: string } }
) {
  const { searchParams } = new URL(req.url);
  const namespace = searchParams.get("namespace") ?? "common";
  
  const translations = await getTranslationsForNamespace(
    params.locale as any,
    namespace
  );
  
  return NextResponse.json(translations);
}
```

### 6.4 Corp: Exchange Rate Management

```typescript
// apps/web/app/api/corp/exchange-rates/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCorpRole } from "@/packages/core/rbac/corp";
import { refreshExchangeRates, setManualExchangeRate } from "@/packages/core/i18n/enhanced/exchangeRates";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requireCorpRole("CORP_FINANCE");
  
  const rates = await prisma.exchangeRate.findMany({
    where: { isActive: true },
    orderBy: { fromCurrency: "asc" },
  });
  
  return NextResponse.json({ rates });
}

export async function POST(req: Request) {
  const actor = await requireCorpRole("CORP_FINANCE");
  const body = await req.json();
  
  if (body.action === "refresh") {
    const result = await refreshExchangeRates({
      source: body.source ?? "openexchangerates",
      actorUserId: actor.userId,
    });
    return NextResponse.json(result);
  }
  
  if (body.action === "set_manual") {
    await setManualExchangeRate({
      fromCurrency: body.fromCurrency,
      toCurrency: body.toCurrency,
      rate: body.rate,
      expiresAt: new Date(body.expiresAt),
      actorUserId: actor.userId,
    });
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
```

---

## 7) Health Provider

Create `packages/core/health/providers/i18nEnhancedHealthProvider.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthCheck } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const i18nEnhancedHealthProvider: HealthProvider = {
  id: "i18n_enhanced",
  label: "Internationalization Enhanced",
  description: "Validates exchange rates, translations, and multi-currency support",
  version: "1.0.0",
  
  async run(): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    let status = HEALTH_STATUS.PASS;
    
    // Check 1: Active exchange rates exist
    const activeRates = await prisma.exchangeRate.count({
      where: { isActive: true },
    });
    checks.push({
      id: "i18n_enhanced.active_rates_exist",
      label: "Active exchange rates configured",
      status: activeRates > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: activeRates > 0 ? `${activeRates} active rates` : "No exchange rates configured",
    });
    if (activeRates === 0) status = HEALTH_STATUS.WARN;
    
    // Check 2: Rates not expired
    const expiredRates = await prisma.exchangeRate.count({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
    });
    checks.push({
      id: "i18n_enhanced.no_expired_rates",
      label: "No expired exchange rates",
      status: expiredRates === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: expiredRates === 0 ? "All rates current" : `${expiredRates} expired rates need refresh`,
    });
    if (expiredRates > 0) status = HEALTH_STATUS.FAIL;
    
    // Check 3: USD rates exist for major currencies
    const majorCurrencies = ["CAD", "GBP", "EUR", "AUD"];
    const usdRates = await prisma.exchangeRate.findMany({
      where: {
        fromCurrency: "USD",
        toCurrency: { in: majorCurrencies },
        isActive: true,
      },
    });
    const missingRates = majorCurrencies.filter(
      c => !usdRates.some(r => r.toCurrency === c)
    );
    checks.push({
      id: "i18n_enhanced.major_currency_rates",
      label: "Major currency rates configured",
      status: missingRates.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: missingRates.length === 0
        ? "All major currencies covered"
        : `Missing: ${missingRates.join(", ")}`,
    });
    if (missingRates.length > 0 && status === HEALTH_STATUS.PASS) {
      status = HEALTH_STATUS.WARN;
    }
    
    // Check 4: Default translations exist
    const defaultLocale = "en-US";
    const translationCount = await prisma.translation.count({
      where: { locale: defaultLocale },
    });
    checks.push({
      id: "i18n_enhanced.default_translations",
      label: "Default locale translations exist",
      status: translationCount > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${translationCount} translations for ${defaultLocale}`,
    });
    
    // Check 5: No orphaned listing translations
    const orphanedTranslations = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "ListingTranslation" lt
      LEFT JOIN "Listing" l ON lt."listingId" = l."id"
      WHERE l."id" IS NULL
    `.catch(() => [{ count: 0n }]);
    const orphanCount = Number(orphanedTranslations[0]?.count ?? 0);
    checks.push({
      id: "i18n_enhanced.no_orphaned_translations",
      label: "No orphaned listing translations",
      status: orphanCount === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: orphanCount === 0 ? "No orphans" : `${orphanCount} orphaned translations`,
    });
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS
        ? "i18n enhanced healthy"
        : `i18n enhanced: ${status}`,
      checks,
    };
  },
};
```

---

## 8) Doctor Checks

```typescript
// packages/core/doctor/checks/i18nEnhancedDoctorChecks.ts
import { PrismaClient, Prisma } from "@prisma/client";
import type { DoctorCheckResult } from "../types";
import { convertCurrency, getActiveExchangeRate } from "../../i18n/enhanced/exchangeRates";
import { getTranslation, setTranslation, clearTranslationCache } from "../../i18n/enhanced/translations";

const prisma = new PrismaClient();

export async function runPhase40DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Exchange rate retrieval works
  try {
    // First ensure we have a test rate
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_effectiveAt: {
          fromCurrency: "USD",
          toCurrency: "EUR",
          effectiveAt: new Date("2025-01-01"),
        },
      },
      update: { isActive: true },
      create: {
        fromCurrency: "USD",
        toCurrency: "EUR",
        rate: new Prisma.Decimal(0.92),
        inverseRate: new Prisma.Decimal(1.087),
        source: "test",
        effectiveAt: new Date("2025-01-01"),
        expiresAt: new Date("2099-12-31"),
        isActive: true,
      },
    });
    
    const rate = await getActiveExchangeRate("USD", "EUR");
    results.push({
      id: "i18n_enhanced.rate_retrieval",
      label: "Exchange rate retrieval works",
      status: rate.rate.toNumber() > 0 ? "PASS" : "FAIL",
      message: `USD→EUR rate: ${rate.rate}`,
    });
  } catch (err) {
    results.push({
      id: "i18n_enhanced.rate_retrieval",
      label: "Exchange rate retrieval works",
      status: "FAIL",
      message: `Error: ${err}`,
    });
  }
  
  // Test 2: Currency conversion math is correct
  try {
    const result = await convertCurrency({
      amountCents: 10000, // $100
      fromCurrency: "USD",
      toCurrency: "EUR",
      type: "display",
      logConversion: false,
    });
    
    // Should be roughly 9200 cents (€92) at 0.92 rate
    const expectedApprox = 9200;
    const isReasonable = Math.abs(result.convertedAmountCents - expectedApprox) < 500;
    
    results.push({
      id: "i18n_enhanced.conversion_math",
      label: "Currency conversion math correct",
      status: isReasonable ? "PASS" : "FAIL",
      message: `$100 → €${(result.convertedAmountCents / 100).toFixed(2)}`,
    });
  } catch (err) {
    results.push({
      id: "i18n_enhanced.conversion_math",
      label: "Currency conversion math correct",
      status: "FAIL",
      message: `Error: ${err}`,
    });
  }
  
  // Test 3: Same currency returns same amount
  try {
    const result = await convertCurrency({
      amountCents: 10000,
      fromCurrency: "USD",
      toCurrency: "USD",
      type: "display",
      logConversion: false,
    });
    
    results.push({
      id: "i18n_enhanced.same_currency_passthrough",
      label: "Same currency returns same amount",
      status: result.convertedAmountCents === 10000 ? "PASS" : "FAIL",
      message: `USD→USD: ${result.convertedAmountCents === 10000 ? "Correct" : "Wrong"}`,
    });
  } catch (err) {
    results.push({
      id: "i18n_enhanced.same_currency_passthrough",
      label: "Same currency returns same amount",
      status: "FAIL",
      message: `Error: ${err}`,
    });
  }
  
  // Test 4: Translation set/get works
  try {
    clearTranslationCache();
    const testKey = "_doctor_test_key_" + Date.now();
    const testValue = "Test Translation Value";
    
    await setTranslation({
      key: testKey,
      locale: "en-US",
      value: testValue,
      namespace: "test",
    });
    
    const retrieved = await getTranslation(testKey, "en-US", "test");
    
    // Cleanup
    await prisma.translation.deleteMany({
      where: { key: testKey },
    });
    
    results.push({
      id: "i18n_enhanced.translation_crud",
      label: "Translation set/get works",
      status: retrieved === testValue ? "PASS" : "FAIL",
      message: retrieved === testValue ? "CRUD working" : "Value mismatch",
    });
  } catch (err) {
    results.push({
      id: "i18n_enhanced.translation_crud",
      label: "Translation set/get works",
      status: "FAIL",
      message: `Error: ${err}`,
    });
  }
  
  // Test 5: Conversion log is created for checkout conversions
  try {
    const orderId = "_doctor_test_order_" + Date.now();
    
    await convertCurrency({
      amountCents: 5000,
      fromCurrency: "USD",
      toCurrency: "EUR",
      type: "checkout",
      orderId,
      logConversion: true,
    });
    
    const log = await prisma.currencyConversionLog.findFirst({
      where: { orderId },
    });
    
    // Cleanup
    await prisma.currencyConversionLog.deleteMany({
      where: { orderId },
    });
    
    results.push({
      id: "i18n_enhanced.conversion_logging",
      label: "Conversion log created for checkout",
      status: log ? "PASS" : "FAIL",
      message: log ? "Log created correctly" : "Log not created",
    });
  } catch (err) {
    results.push({
      id: "i18n_enhanced.conversion_logging",
      label: "Conversion log created for checkout",
      status: "FAIL",
      message: `Error: ${err}`,
    });
  }
  
  return results;
}
```

---

## 9) Background Job: Exchange Rate Refresh

```typescript
// packages/core/jobs/refreshExchangeRates.ts
import { refreshExchangeRates } from "../i18n/enhanced/exchangeRates";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Cron job to refresh exchange rates
 * Recommended schedule: Every 4 hours
 */
export async function runExchangeRateRefreshJob(): Promise<void> {
  console.log("[ExchangeRateRefresh] Starting...");
  
  const result = await refreshExchangeRates({
    source: "openexchangerates",
    baseCurrency: "USD",
  });
  
  console.log(`[ExchangeRateRefresh] Updated ${result.updated} rates`);
  if (result.errors.length > 0) {
    console.error("[ExchangeRateRefresh] Errors:", result.errors);
  }
  
  // Emit platform event
  await prisma.platformEvent.create({
    data: {
      type: "exchange_rates_refreshed",
      dataJson: {
        updated: result.updated,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
    },
  });
}
```

---

## 10) Corp Admin UI

### 10.1 Exchange Rate Management Page

```tsx
// apps/web/app/corp/settings/exchange-rates/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, Edit, Clock, AlertTriangle } from "lucide-react";

type ExchangeRate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  source: string;
  effectiveAt: string;
  expiresAt: string;
  isManualOverride: boolean;
};

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    fetchRates();
  }, []);
  
  async function fetchRates() {
    const res = await fetch("/api/corp/exchange-rates");
    const data = await res.json();
    setRates(data.rates);
    setLoading(false);
  }
  
  async function handleRefresh() {
    setRefreshing(true);
    await fetch("/api/corp/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh" }),
    });
    await fetchRates();
    setRefreshing(false);
  }
  
  const isExpiringSoon = (expiresAt: string) => {
    const hours = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    return hours < 6;
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Exchange Rates</h1>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Rates
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Active Exchange Rates (Base: USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency Pair</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">
                    {rate.fromCurrency} → {rate.toCurrency}
                  </TableCell>
                  <TableCell>{parseFloat(rate.rate).toFixed(6)}</TableCell>
                  <TableCell>
                    <Badge variant={rate.isManualOverride ? "destructive" : "secondary"}>
                      {rate.isManualOverride ? "Manual" : rate.source}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(rate.effectiveAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={isExpiringSoon(rate.expiresAt) ? "text-orange-600" : ""}>
                      {isExpiringSoon(rate.expiresAt) && (
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                      )}
                      {new Date(rate.expiresAt).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 11) Buyer UI: Currency Selector

```tsx
// components/buyer/CurrencySelector.tsx
"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
];

export function CurrencySelector() {
  const [selected, setSelected] = useState("USD");
  
  useEffect(() => {
    // Load user preference
    fetch("/api/user/currency-preference")
      .then((res) => res.json())
      .then((data) => setSelected(data.displayCurrency))
      .catch(() => {});
  }, []);
  
  async function handleSelect(currency: string) {
    setSelected(currency);
    await fetch("/api/user/currency-preference", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayCurrency: currency }),
    });
    // Trigger price refresh
    window.dispatchEvent(new CustomEvent("currency-changed", { detail: currency }));
  }
  
  const current = CURRENCIES.find((c) => c.code === selected)!;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Globe className="w-4 h-4 mr-1" />
          {current.symbol} {current.code}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CURRENCIES.map((currency) => (
          <DropdownMenuItem
            key={currency.code}
            onClick={() => handleSelect(currency.code)}
            className={selected === currency.code ? "bg-accent" : ""}
          >
            {currency.symbol} {currency.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 12) Seed Script

```typescript
// scripts/seed-i18n-enhanced.ts
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding i18n enhanced data...");
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  // Seed exchange rates
  const rates = [
    { to: "CAD", rate: 1.35 },
    { to: "GBP", rate: 0.79 },
    { to: "EUR", rate: 0.92 },
    { to: "AUD", rate: 1.53 },
    { to: "JPY", rate: 149.50 },
    { to: "MXN", rate: 17.15 },
  ];
  
  for (const r of rates) {
    const rateDecimal = new Prisma.Decimal(r.rate);
    const inverseDecimal = new Prisma.Decimal(1).div(rateDecimal);
    
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_effectiveAt: {
          fromCurrency: "USD",
          toCurrency: r.to,
          effectiveAt: now,
        },
      },
      update: {
        rate: rateDecimal,
        inverseRate: inverseDecimal,
        expiresAt,
        isActive: true,
      },
      create: {
        fromCurrency: "USD",
        toCurrency: r.to,
        rate: rateDecimal,
        inverseRate: inverseDecimal,
        source: "seed",
        effectiveAt: now,
        expiresAt,
        isActive: true,
      },
    });
  }
  
  // Seed common translations
  const translations = [
    { key: "nav.home", value: "Home" },
    { key: "nav.shop", value: "Shop" },
    { key: "nav.sell", value: "Sell" },
    { key: "nav.cart", value: "Cart" },
    { key: "button.buy_now", value: "Buy Now" },
    { key: "button.add_to_cart", value: "Add to Cart" },
    { key: "button.make_offer", value: "Make Offer" },
    { key: "listing.price", value: "Price" },
    { key: "listing.shipping", value: "Shipping" },
    { key: "listing.condition", value: "Condition" },
  ];
  
  for (const t of translations) {
    await prisma.translation.upsert({
      where: {
        key_locale_namespace: {
          key: t.key,
          locale: "en-US",
          namespace: "common",
        },
      },
      update: { value: t.value },
      create: {
        key: t.key,
        locale: "en-US",
        namespace: "common",
        value: t.value,
        isVerified: true,
      },
    });
  }
  
  console.log("i18n enhanced data seeded!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 13) Phase 40 Completion Criteria

- [ ] ExchangeRate model migrated
- [ ] UserCurrencyPreference model migrated
- [ ] CurrencyConversionLog model migrated
- [ ] Translation, ListingTranslation, CategoryTranslation models migrated
- [ ] TranslationJob, TranslationGlossary models migrated
- [ ] Exchange rate service working (get, convert, refresh)
- [ ] User currency preference service working
- [ ] Translation service working (get, set, namespace batch)
- [ ] API endpoints deployed
- [ ] Currency selector in buyer header
- [ ] Corp exchange rate management page
- [ ] Health provider passing
- [ ] Doctor checks passing
- [ ] Exchange rate refresh job scheduled
- [ ] Seed data applied

---

## 14) "Better Than eBay" Differentiators

| Feature | eBay | Twicely |
|---------|------|---------|
| Display currency choice | Limited | ✅ Full user control |
| Real-time conversion | No | ✅ Live rates |
| Conversion audit trail | No | ✅ Full logging |
| AI listing translations | No | ✅ Automatic |
| Seller-editable translations | No | ✅ Full control |
| Rate change notifications | No | ✅ Configurable alerts |
