# I14 Localization & Compliance Findings

## Key Discovery: Missing Schema Tables
- NO `translation_string`, `currency_rate`, `policy_version`, or `shipping_carrier` tables exist in schema v2.1.3
- All 6 pages must be backed by `platform_setting` table (key-value config pattern)
- Only `delegated_access` (section 3.4) and `tax_info`/`tax_quote` (section 17) have dedicated tables

## Existing Resources
- `delegation.ts` actions + queries already complete (D5)
- `/fin/tax` page exists (G5) -- for compliance reporting, NOT rule config
- Shipping settings already seeded: `shipping.*`, `fulfillment.*`
- Tax settings already seeded: `tax.*`, `finance.tax.*`
- 3 delegation platform_settings seeded: `delegation.maxStaffPerSeller`, `delegation.require2faForHighRisk`, `delegation.payoutChangeHoldHours`

## Auth Pattern
- All hub pages use `staffAuthorize()` (not `authorize()`)
- CASL subjects already registered: DelegatedAccess, Policy, Setting, TaxInfo
- No new CASL subjects needed

## Pages Summary
1. `/delegated-access` -- ADMIN+SUPPORT, reads delegated_access table (most complex)
2. `/translations` -- ADMIN, i18n settings scaffold (forward-looking)
3. `/policies` -- ADMIN, policy version tracking via platform_settings
4. `/currency` -- ADMIN, USD-only display settings
5. `/shipping-admin` -- ADMIN, existing shipping settings aggregated
6. `/taxes` -- ADMIN+FINANCE, tax rule config (distinct from /fin/tax compliance)

## Decision Points for Owner
- D1: Translation scope (no table exists -- recommended: platform_setting backed)
- D2: Policy versioning scope (no table exists -- recommended: version metadata via settings)
- D3: Currency scope (no table exists -- recommended: USD-only display config)

## New Platform Settings to Seed
- `i18n.*` (7 keys): defaultLocale, enabledLocales, fallbackLocale, dateFormat, numberFormat, currencyDisplay, translationOverrides
- `policy.*` (12 keys): version/effectiveDate/lastUpdatedBy per policy type (terms, privacy, buyerProtection, fees, cookiePolicy)
- `currency.*` (5 keys): supportedCurrencies, displaySymbol, decimalSeparator, thousandsSeparator, symbolPosition
- `shipping.*` (5 new keys): supportedCarriers, freeShippingPromotionEnabled, maxWeightOz, maxDimensionIn, lateShipmentPenaltyEnabled
- `tax.*` (5 new keys): collectSalesTax, nexusStates, taxExemptCategoriesEnabled, taxExemptCategories, displayTaxInSearch

## Admin Nav
- New "Localization" collapsible group needed in admin-nav.ts
- New icons needed in ICON_MAP: Globe, Languages, Calculator
