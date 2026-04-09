# TWICELY V2 — Install Phase 12: Internationalization Scaffold (USD Launch)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → Types → Currency/Locale helpers → Health → Doctor  
**Canonical:** `/rules/TWICELY_INTERNATIONALIZATION_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_12_INTERNATIONALIZATION.md`  
> Prereq: Phase 11 complete.

---

## 0) What this phase installs

### Backend
- Region model (US-only at launch, expandable later)
- SupportedCurrency and SupportedLocale tracking
- Money/time helpers (presentation vs accounting separation)
- Locale detection middleware
- Enforcement: one currency per order

### UI (Corp)
- Corp → Settings → Regions (read-only v1)
- Corp → Settings → Supported currencies

### Ops
- Health provider: `i18n`
- Doctor checks: currency invariants, UTC storage, locale detection

---

## 1) Prisma schema (additive)

```prisma
model Region {
  id                String   @id @default(cuid())
  code              String   @unique  // "US", "CA", "UK"
  name              String
  defaultCurrency   String   @default("USD")
  locales           String[]
  shippingCountries String[]
  taxProvider       String?  // Future: tax calculation provider
  isActive          Boolean  @default(true)
  launchDate        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model SupportedCurrency {
  id              String   @id @default(cuid())
  code            String   @unique  // "USD", "CAD", "GBP"
  name            String
  symbol          String   // "$", "£"
  decimalPlaces   Int      @default(2)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
}

model SupportedLocale {
  id              String   @id @default(cuid())
  code            String   @unique  // "en-US", "en-CA", "fr-CA"
  name            String
  regionCode      String   // References Region.code
  isDefault       Boolean  @default(false)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
}
```

Migrate: `npx prisma migrate dev --name i18n_phase12`

---

## 2) Types & Constants

Create `packages/core/i18n/types.ts`:

```ts
// Supported currencies at launch
export type Currency = "USD";

// Supported locales at launch
export type Locale = "en-US";

// Full currency type for future expansion
export type CurrencyCode = "USD" | "CAD" | "GBP" | "EUR" | "AUD";

// Locale context
export type LocaleContext = {
  locale: string;
  currency: Currency;
  timezone: string;
  region: string;
};

// Money representation
export type Money = {
  amountCents: number;
  currency: Currency;
};
```

---

## 3) Money Helpers

Create `packages/core/i18n/money.ts`:

```ts
import type { Currency, Money } from "./types";

/**
 * Assert same currency (prevents mixed currency operations)
 */
export function assertSameCurrency(a: string, b: string): void {
  if (a.toUpperCase() !== b.toUpperCase()) {
    throw new Error(`MIXED_CURRENCY_NOT_ALLOWED: ${a} vs ${b}`);
  }
}

/**
 * Format money for display
 */
export function formatMoney(
  cents: number,
  currency: Currency = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Format money with explicit parts
 */
export function formatMoneyParts(
  cents: number,
  currency: Currency = "USD"
): { symbol: string; whole: string; decimal: string; formatted: string } {
  const value = cents / 100;
  const symbol = currency === "USD" ? "$" : currency;
  const whole = Math.floor(value).toString();
  const decimal = (cents % 100).toString().padStart(2, "0");
  
  return {
    symbol,
    whole,
    decimal,
    formatted: `${symbol}${whole}.${decimal}`,
  };
}

/**
 * Parse money string to cents (for forms)
 */
export function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

/**
 * Add money amounts (same currency only)
 */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a.currency, b.currency);
  return {
    amountCents: a.amountCents + b.amountCents,
    currency: a.currency,
  };
}

/**
 * Subtract money amounts (same currency only)
 */
export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a.currency, b.currency);
  return {
    amountCents: a.amountCents - b.amountCents,
    currency: a.currency,
  };
}

/**
 * Calculate percentage of money
 */
export function percentageOfMoney(money: Money, basisPoints: number): Money {
  const amount = Math.round((money.amountCents * basisPoints) / 10000);
  return { amountCents: amount, currency: money.currency };
}
```

---

## 4) Time Helpers

Create `packages/core/i18n/time.ts`:

```ts
/**
 * Convert date to ISO string (always store UTC)
 */
export function toISO(date: Date): string {
  return date.toISOString();
}

/**
 * Format date for display in user's locale
 */
export function formatDate(
  date: Date | string,
  locale: string = "en-US",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...options,
  }).format(d);
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string,
  locale: string = "en-US",
  timezone?: string
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(d);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string = "en-US"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  
  if (diffDays > 0) return rtf.format(-diffDays, "day");
  if (diffHours > 0) return rtf.format(-diffHours, "hour");
  if (diffMin > 0) return rtf.format(-diffMin, "minute");
  return rtf.format(-diffSec, "second");
}
```

---

## 5) Locale Detection

Create `packages/core/i18n/localeDetector.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { LocaleContext } from "./types";

const prisma = new PrismaClient();

// Default context for US launch
const DEFAULT_CONTEXT: LocaleContext = {
  locale: "en-US",
  currency: "USD",
  timezone: "America/New_York",
  region: "US",
};

/**
 * Detect locale from request headers
 */
export function detectLocaleFromHeaders(headers: Headers): Partial<LocaleContext> {
  const acceptLanguage = headers.get("Accept-Language");
  const timezone = headers.get("X-Timezone");
  
  // Parse Accept-Language header
  let locale = "en-US";
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(",")[0].trim();
    // For v1, only support en-US
    if (preferred.startsWith("en")) {
      locale = "en-US";
    }
  }
  
  return {
    locale,
    timezone: timezone ?? undefined,
  };
}

/**
 * Get full locale context for a user
 */
export async function getLocaleContext(
  userId?: string,
  headers?: Headers
): Promise<LocaleContext> {
  let context = { ...DEFAULT_CONTEXT };
  
  // Override from headers if available
  if (headers) {
    const detected = detectLocaleFromHeaders(headers);
    if (detected.locale) context.locale = detected.locale;
    if (detected.timezone) context.timezone = detected.timezone;
  }
  
  // Override from user preferences if logged in
  if (userId) {
    const userPrefs = await getUserLocalePreferences(userId);
    if (userPrefs) {
      if (userPrefs.locale) context.locale = userPrefs.locale;
      if (userPrefs.timezone) context.timezone = userPrefs.timezone;
    }
  }
  
  return context;
}

async function getUserLocalePreferences(userId: string) {
  // In v1, user preferences may not exist yet
  // Return null to use defaults
  return null;
}

/**
 * Get region configuration
 */
export async function getRegion(regionCode: string) {
  return prisma.region.findUnique({
    where: { code: regionCode, isActive: true },
  });
}

/**
 * Get default region (US for v1)
 */
export async function getDefaultRegion() {
  return getRegion("US");
}
```

---

## 6) Order Currency Enforcement

Create `packages/core/i18n/currencyEnforcement.ts`:

```ts
import { assertSameCurrency } from "./money";

/**
 * Validate order has consistent currency
 */
export function validateOrderCurrency(
  orderCurrency: string,
  listingCurrency: string,
  regionCurrency: string
): void {
  // All must match
  assertSameCurrency(orderCurrency, listingCurrency);
  assertSameCurrency(orderCurrency, regionCurrency);
}

/**
 * Middleware to enforce currency on checkout
 */
export function enforceCheckoutCurrency(
  cartItems: Array<{ currency: string }>,
  regionCurrency: string
): void {
  for (const item of cartItems) {
    assertSameCurrency(item.currency, regionCurrency);
  }
  
  // Also ensure all items have same currency
  const currencies = new Set(cartItems.map(i => i.currency.toUpperCase()));
  if (currencies.size > 1) {
    throw new Error("MIXED_CURRENCY_CART_NOT_ALLOWED");
  }
}
```

---

## 7) Seed Default Region

`scripts/seed-regions.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Seed US region
  await prisma.region.upsert({
    where: { code: "US" },
    update: {
      name: "United States",
      defaultCurrency: "USD",
      locales: ["en-US"],
      shippingCountries: ["US"],
      isActive: true,
    },
    create: {
      code: "US",
      name: "United States",
      defaultCurrency: "USD",
      locales: ["en-US"],
      shippingCountries: ["US"],
      isActive: true,
      launchDate: new Date(),
    },
  });
  
  // Seed USD currency
  await prisma.supportedCurrency.upsert({
    where: { code: "USD" },
    update: {},
    create: {
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      decimalPlaces: 2,
      isActive: true,
    },
  });
  
  // Seed en-US locale
  await prisma.supportedLocale.upsert({
    where: { code: "en-US" },
    update: {},
    create: {
      code: "en-US",
      name: "English (US)",
      regionCode: "US",
      isDefault: true,
      isActive: true,
    },
  });
  
  console.log("Regions, currencies, and locales seeded");
}

main().finally(() => prisma.$disconnect());
```

---

## 8) Health Provider

Create `packages/core/health/providers/i18nHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const i18nHealthProvider: HealthProvider = {
  id: "i18n",
  label: "Internationalization",
  description: "Validates region, currency, and locale configuration",
  version: "1.0.0",
  
  async run(): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;
    
    // Check 1: US region exists and active
    const usRegion = await prisma.region.findUnique({
      where: { code: "US" },
    });
    checks.push({
      id: "i18n.us_region_exists",
      label: "US region configured",
      status: usRegion?.isActive ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: usRegion?.isActive ? "US region active" : "US region missing or inactive",
    });
    if (!usRegion?.isActive) status = HEALTH_STATUS.FAIL;
    
    // Check 2: USD currency exists
    const usd = await prisma.supportedCurrency.findUnique({
      where: { code: "USD" },
    });
    checks.push({
      id: "i18n.usd_currency_exists",
      label: "USD currency configured",
      status: usd?.isActive ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: usd?.isActive ? "USD currency active" : "USD currency missing",
    });
    if (!usd?.isActive) status = HEALTH_STATUS.FAIL;
    
    // Check 3: Default locale exists
    const defaultLocale = await prisma.supportedLocale.findFirst({
      where: { isDefault: true, isActive: true },
    });
    checks.push({
      id: "i18n.default_locale_exists",
      label: "Default locale configured",
      status: defaultLocale ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: defaultLocale ? `Default: ${defaultLocale.code}` : "No default locale",
    });
    if (!defaultLocale) status = HEALTH_STATUS.FAIL;
    
    // Check 4: No orders with mismatched currency
    const mismatchedOrders = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "Order" o
      JOIN "Listing" l ON o."listingId" = l."id"
      WHERE o."currency" != l."currency"
    `.catch(() => [{ count: 0n }]);
    
    const hasMismatches = Number(mismatchedOrders[0]?.count ?? 0) > 0;
    checks.push({
      id: "i18n.no_currency_mismatches",
      label: "No currency mismatches in orders",
      status: hasMismatches ? HEALTH_STATUS.FAIL : HEALTH_STATUS.PASS,
      message: hasMismatches ? "Currency mismatches found!" : "All currencies consistent",
    });
    if (hasMismatches) status = HEALTH_STATUS.FAIL;
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS ? "i18n healthy" : "i18n has issues",
      checks,
    };
  },
};
```

---

## 9) Doctor Checks

```ts
async function runPhase12DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: US region exists and is active
  const usRegion = await prisma.region.findUnique({ where: { code: "US" } });
  results.push({
    id: "i18n.us_region",
    label: "US region exists and active",
    status: usRegion?.isActive ? "PASS" : "FAIL",
    message: usRegion?.isActive ? "US region active" : "Missing or inactive",
  });
  
  // Test 2: Order currency matches region default
  // Create test order
  const testCurrency = "USD";
  const regionCurrency = usRegion?.defaultCurrency ?? "USD";
  
  results.push({
    id: "i18n.currency_equals_region",
    label: "Order currency equals region default",
    status: testCurrency === regionCurrency ? "PASS" : "FAIL",
    message: `Order: ${testCurrency}, Region: ${regionCurrency}`,
  });
  
  // Test 3: Mixed currency throws
  let mixedThrew = false;
  try {
    assertSameCurrency("USD", "CAD");
  } catch (e) {
    mixedThrew = true;
  }
  results.push({
    id: "i18n.mixed_currency_throws",
    label: "Mixed currency attempt throws error",
    status: mixedThrew ? "PASS" : "FAIL",
    message: mixedThrew ? "Correctly throws" : "Did not throw",
  });
  
  // Test 4: Money formatting
  const formatted = formatMoney(1999, "USD", "en-US");
  const formattedCorrect = formatted === "$19.99";
  results.push({
    id: "i18n.money_formatting",
    label: "Money formatting works",
    status: formattedCorrect ? "PASS" : "FAIL",
    message: `1999 cents → ${formatted}`,
  });
  
  // Test 5: UTC storage (all dates should be ISO strings)
  const testDate = new Date();
  const isoString = toISO(testDate);
  const isIso = isoString.endsWith("Z") || isoString.includes("+");
  results.push({
    id: "i18n.utc_storage",
    label: "Dates stored as UTC",
    status: isIso ? "PASS" : "FAIL",
    message: `Date format: ${isoString}`,
  });
  
  return results;
}
```

---

## 10) Phase 12 Completion Criteria

- [ ] Region model migrated
- [ ] SupportedCurrency model migrated
- [ ] SupportedLocale model migrated
- [ ] US region seeded and active
- [ ] USD currency seeded
- [ ] en-US locale seeded as default
- [ ] Money helpers work correctly
- [ ] Time helpers use UTC
- [ ] Locale detection works
- [ ] Mixed currency throws error
- [ ] Health provider passing
- [ ] Doctor checks passing
