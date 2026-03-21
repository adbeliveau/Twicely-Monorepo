# [I14] Localization & Compliance — 6 Hub Pages

**Phase:** I (Enrichment)
**Step:** I14
**Feature:** Localization & Compliance Admin Pages
**One-line Summary:** Build 6 new hub admin pages for delegation oversight, translation management, policy versioning, currency configuration, shipping administration, and tax rule management.
**Depends On:** E3 COMPLETE.

## File Approval List

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/app/(hub)/delegated-access/page.tsx` | CREATE | Platform-wide delegation oversight (~150 lines) |
| 2 | `src/app/(hub)/translations/page.tsx` | CREATE | Translation/i18n settings (~100 lines) |
| 3 | `src/app/(hub)/policies/page.tsx` | CREATE | Policy version management (~150 lines) |
| 4 | `src/app/(hub)/currency/page.tsx` | CREATE | Currency settings (~100 lines) |
| 5 | `src/app/(hub)/shipping-admin/page.tsx` | CREATE | Global shipping administration (~150 lines) |
| 6 | `src/app/(hub)/taxes/page.tsx` | CREATE | Tax rules configuration (~150 lines) |
| 7 | `src/lib/queries/admin-delegations.ts` | CREATE | getAdminDelegationKPIs, getAdminDelegations (~120 lines) |
| 8 | `src/lib/actions/admin-delegations.ts` | CREATE | adminRevokeDelegation (~80 lines) |
| 9 | `src/lib/queries/__tests__/admin-delegations.test.ts` | CREATE | Query tests (~7 tests) |
| 10 | `src/lib/actions/__tests__/admin-delegations.test.ts` | CREATE | Action tests (~8 tests) |
| 11 | `src/lib/queries/admin-shipping.ts` | CREATE | getShippingAdminSettings (~40 lines) |
| 12 | `src/lib/queries/admin-tax-rules.ts` | CREATE | getTaxRuleSettings (~40 lines) |
| 13 | `src/lib/queries/__tests__/admin-shipping.test.ts` | CREATE | Tests (~5 tests) |
| 14 | `src/lib/queries/__tests__/admin-tax-rules.test.ts` | CREATE | Tests (~5 tests) |
| 15 | `src/lib/actions/admin-policy-version.ts` | CREATE | updatePolicyVersion (~80 lines) |
| 16 | `src/lib/actions/__tests__/admin-policy-version.test.ts` | CREATE | Tests (~8 tests) |
| 17 | `src/lib/db/seed/seed-i14-settings.ts` | CREATE | New platform_settings for I14 (i18n.*, policy.*, currency.*, shipping.new, tax.new) |
| 18 | `src/lib/db/seed/__tests__/seed-i14-settings.test.ts` | CREATE | Seed data tests (~4 tests) |
| 19 | `src/lib/hub/admin-nav.ts` | MODIFY | Add "Localization" collapsible group with 6 child links |
| 20 | `src/components/admin/admin-sidebar.tsx` | MODIFY | Add Globe, Languages, Calculator to ICON_MAP |
| 21 | `src/lib/db/seed/seed-platform.ts` | MODIFY | Import SEED_I14_SETTINGS |

**Total: 18 new files, 3 modified files (~42 tests)**

## Key Design Decisions (adopted from install-prompt-writer analysis)
- D1 Translation: Build lightweight i18n.* platform_settings management (NOT a CMS)
- D2 Policies: Track version metadata as platform_settings (policy.{type}.{field}), NOT edit content
- D3 Currency: USD-only display with "multi-currency coming soon" info banner
- Delegation page shows ALL delegations platform-wide (distinct from /my/selling/staff)
- /taxes = tax RULES config (NOT /fin/tax which is 1099-K compliance reporting)
- /shipping-admin links to /cfg/shippo for Shippo API config
