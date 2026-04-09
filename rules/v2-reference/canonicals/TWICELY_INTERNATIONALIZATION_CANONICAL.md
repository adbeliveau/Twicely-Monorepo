# TWICELY_INTERNATIONALIZATION_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Multi-currency, multi-locale, time zones, and regional marketplace rules.  
**Audience:** Product, engineering, ops, AI agents.

---

## 1. Purpose

This canonical defines how Twicely supports multiple regions safely without breaking:
- pricing
- tax
- payouts
- search
- content

---

## 2. Core Principles

1. **Locale is presentation; currency is accounting**
2. **Money is stored in minor units**
3. **Time zones never change history**
4. **Regional rules are effective-dated**
5. **Default region remains stable**

---

## 3. Locale & Language

- UI locale: `en-US` default
- Content fields may support translations (future)
- Dates displayed in user locale; stored in UTC

---

## 4. Currency

### 4.1 Storage
- Store amounts as `amountCents` + `currency`
- Do not mix currencies in a single order

### 4.2 Currency Support (v1)
- USD only (launch)
- Multi-currency is a gated phase

---

## 5. Region Model

```ts
type Region = {
  code: string;          // "US"
  defaultCurrency: string;
  locales: string[];
  shippingCountries: string[];
};
```

---

## 6. Search & Discovery (Regional)

- Search results must be region-filtered
- Category schemas may vary by region (effective-dated)
- Ranking rules remain consistent across regions

---

## 7. Payouts (Regional)

- Payout provider must support region
- Seller onboarding is region-specific
- Tax/KYC requirements vary and are enforced per region

---

## 8. RBAC

- Region configuration is admin-only
- Currency conversion settings are finance-admin-only

---

## 9. Final Rule

Internationalization must never compromise:
**ledger correctness, buyer clarity, or policy enforcement**.
