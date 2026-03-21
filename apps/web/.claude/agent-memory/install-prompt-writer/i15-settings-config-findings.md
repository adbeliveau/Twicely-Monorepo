---
name: I15 Settings & Config Enrichment Findings
description: Gap analysis for I15 — 7 pages of settings/config enrichment. Existing code inventory, missing API routes, schema gaps.
type: project
---

## I15 Settings & Config Enrichment — Findings (2026-03-20)

### Pages to Enrich/Create
1. `/cfg` — Settings hub overview (64 lines, has search, quick links, general settings form)
2. `/cfg/platform` — Platform config (53 lines, has tab-based settings with sections/tier tables)
3. `/cfg/stripe` — Stripe settings (86 lines page + 296 lines form = full featured)
4. `/cfg/shippo` — Shippo settings (111 lines, has provider instance form + webhook config)
5. `/cfg/messaging/keywords` — Banned keywords (33 lines page + 182 lines component, uses MISSING API route)
6. `/cfg/providers/mappings/new` — NEW page (does NOT exist yet)
7. (Seventh page unclear from tracker — likely `/cfg/monetization` enrichment or similar)

### Existing Infrastructure (Already Built)
- `admin-settings.ts` queries: getSettingsByCategory, getSettingsByKeys, getSettingHistory
- `admin-settings.ts` actions: updateSettingAction, updatePlatformSetting, saveGeneralSettings
- `admin-connector-settings.ts` actions: updateConnectorSettings, testConnectorConnection
- `admin-providers.ts` queries: full CRUD for adapters/instances/mappings/health
- `admin-providers.ts` actions: createInstance, updateInstance, testInstance, createUsageMapping, updateUsageMapping, saveInstanceConfig
- `platform-settings-tabs.tsx`: Full tab UI with sections, tier tables, inline editing
- `settings-sections.ts`: Section definitions for all 10 tab categories
- `settings-display.ts`: Labels, formatting, input conversion for 227 setting keys
- `settings-help.ts`: Tooltip help text for 50+ settings
- `settings-quick-links.tsx`: 7 quick-link cards
- `settings-hub-form.tsx`: General settings save form
- `keyword-management.tsx`: Full CRUD UI but API route MISSING
- `stripe-settings-form.tsx`: Full Stripe config UI (296 lines)
- Existing test: `admin-settings.test.ts` (9 tests)

### Missing Pieces (Gaps)
1. **No bannedKeyword table in schema** — keywords component calls `/api/platform/messaging/keywords` but no API route or DB table exists
2. **No `/cfg/providers/mappings/new` page** — only `/cfg/providers/mappings` (list view) exists
3. **No admin-providers tests** — 0 test coverage for provider actions
4. **No admin-settings validation schemas** — Zod schemas inline in actions, not in /validations/
5. **cfg page only 64 lines** — needs category stat cards, recent changes, setting health indicators
6. **cfg/platform page only 53 lines** — functional but needs version history panel, search within tab
7. **cfg/shippo page only 111 lines** — functional, needs carrier-specific settings, label format config

### Platform Settings Canonical vs Code Comparison
- Canonical defines 10 tab categories: Environment, Integrations, Fees, Commerce, Fulfillment, Trust, Discovery, Communications, Payments, Privacy
- Code CATEGORY_ORDER has 11 categories: general + the 10 above (minus Environment is listed but present)
- Code normalizeCategory() maps seed categories to tab categories correctly
- Setting display labels cover ~227 keys (settings-display.ts)
- Setting sections cover all 10 tabs (settings-sections.ts)

### Key Schema Facts
- `platformSetting` table: id, key, value (jsonb), type, category, description, isSecret, updatedByStaffId, updatedAt
- `platformSettingHistory` table: id, settingId, previousValue, newValue, changedByStaffId, reason, createdAt
- Provider tables: providerAdapter, providerInstance, providerSecret, providerUsageMapping, providerHealthLog
- NO bannedKeyword/autoModerationKeyword table in schema v2.1.0
