# G10.13 Connector & Integration Admin Pages — Findings

## What Already Exists (Substantial)

### Pages (ALL 10 route pages EXIST)
- `/cfg/stripe/page.tsx` (85 lines) + `stripe-settings-form.tsx` (295 lines) — FULLY FUNCTIONAL
  - Module status toggles (enable/disable, test/live mode)
  - Test/Live API key entry (4 fields, password inputs, masks)
  - Webhook signing secrets (2 fields)
  - Payment settings (statement descriptor, currency)
  - Stripe Connect config (country, auto-transfer, delay hours)
  - Test Connection button (validates key existence)
  - Save button (3 sequential server actions)
- `/cfg/ebay/page.tsx` (57 lines) — uses ConnectorSettingsPage
- `/cfg/etsy/page.tsx` (54 lines) — uses ConnectorSettingsPage
- `/cfg/mercari/page.tsx` (50 lines) — uses ConnectorSettingsPage
- `/cfg/poshmark/page.tsx` (49 lines) — uses ConnectorSettingsPage
- `/cfg/depop/page.tsx` (50 lines) — uses ConnectorSettingsPage
- `/cfg/grailed/page.tsx` (50 lines) — uses ConnectorSettingsPage
- `/cfg/fb-marketplace/page.tsx` (50 lines) — uses ConnectorSettingsPage
- `/cfg/therealreal/page.tsx` (49 lines) — uses ConnectorSettingsPage
- `/cfg/integrations/page.tsx` (168 lines) — dependency status dashboard

### Shared Component
- `src/components/admin/settings/connector-settings-page.tsx` (257 lines) — reusable client component
  - Module status toggles (dynamic from `*Enabled` keys)
  - Credentials form (clientId, clientSecret, redirectUri, apiBase, userAgent, environment)
  - OAuth callback URL display
  - Webhook configuration display (URL + events)
  - Capabilities grid (booleans + numbers)
  - Connected accounts stats (total + active)
  - Save button → `updateConnectorSettings` action
  - Secret masking for sensitive fields

### Server Actions
- `src/lib/actions/admin-connector-settings.ts` (81 lines) — `updateConnectorSettings()`
  - Zod strict schema, staffAuthorize, CASL `update Setting`, audit event
  - Batch updates platform_settings with prefix validation
  - History tracking for each changed setting
- `src/lib/actions/admin-integrations.ts` (217 lines) — Stripe/Shippo key management
  - `updateIntegrationKeys()` — upserts provider_secret records
  - `testStripeConnection()` — validates key existence
  - `testShippoConnection()` — validates key existence
  - `toggleIntegrationModule()` — creates/updates boolean platform_settings

### Queries
- `src/lib/queries/admin-connector-settings.ts` (69 lines)
  - `getConnectorSettings(prefix)` — fetches `crosslister.{prefix}.*` settings
  - `getConnectorStats(channel)` — counts total/active crosslisterAccounts
- `src/lib/queries/admin-dependency-status.ts` (63 lines)
  - `getInstalledDependencies()` — reads package.json versions for 17 tracked packages

### Sidebar Navigation
- `admin-nav.ts` has full nav structure:
  - Settings collapsible: 14 children including cfg-integrations
  - Crosslister collapsible: 8 connector pages (ebay through therealreal)
  - Providers collapsible: 5 children

### Platform Settings (Seeded)
- `seed-crosslister.ts`: 120+ settings per connector:
  - Per-connector feature flags: `crosslister.{name}.importEnabled/crosslistEnabled/automationEnabled`
  - Per-connector rate limits: `crosslister.rateLimit.{name}.callsPerHourPerSeller`
  - Per-connector OAuth credentials: `crosslister.{name}.clientId/clientSecret/redirectUri/environment`
  - Per-connector session config (Poshmark, TheRealReal): `crosslister.{name}.apiBase/userAgent`
  - Platform fee rates: `crosslister.fees.{name}.rateBps`

## GAP ANALYSIS — What's Missing

### GAP 1: No Tests At All
- ZERO test files for any of these files:
  - No tests for `admin-connector-settings.ts` (actions)
  - No tests for `admin-connector-settings.ts` (queries)
  - No tests for `admin-dependency-status.ts` (queries)
  - No tests for `admin-integrations.ts` (actions)
  - No tests for `connector-settings-page.tsx` (component)
  - This is the primary gap. The build tracker says G10.13 is QUEUED, meaning it was built without tests.

### GAP 2: No Test Connection for Connector Pages
- Stripe has `testStripeConnection()` (validates key existence) with UI button
- 8 connector pages have NO test connection feature
- The build tracker specifies: "test connection" for all connector pages
- Need: `testConnectorConnection(connectorCode)` action that validates credentials exist

### GAP 3: Integrations Dashboard Incomplete
- Current `/cfg/integrations` shows installed versions only
- Build tracker says: "current version vs latest, update availability"
- Missing: npm registry lookup for latest versions, update-available indicators
- However: this is OPTIONAL enhancement. Reading package.json is good. npm registry calls add latency/failure modes.
- RECOMMENDATION: Add "latest version" column that shows "unknown" initially. Can be enhanced later with npm API.

### GAP 4: CASL Subject Mismatch
- Connector pages use `ability.can('read', 'Setting')` — this is the correct subject
- Stripe page uses `ability.can('read', 'ProviderAdapter')` — this is a DIFFERENT subject
- Actors/Security Canonical lists: `Setting` (view, update) and `PlatformSetting` (view, edit)
- Both `Setting` and `ProviderAdapter` are CASL subjects. Stripe page checks adapter access for reading instance secrets.
- The stripe page ALSO checks `ability.can('update', 'ProviderInstance')` for edit permission — appropriate since it manages provider secrets.
- Not a bug, but inconsistent gate between Stripe and connector pages.

### GAP 5: stripe-settings-form.tsx is 295 lines (near limit)
- At 295 lines, close to 300-line limit
- Any additions to Stripe page must be careful about line count

## Connector Tier Reference (Lister Canonical Section 9.1)
| Tier | Auth | Platforms | Webhooks |
|------|------|-----------|----------|
| A | OAUTH | eBay, Etsy | Yes |
| B | OAUTH | Mercari, Depop, Grailed, FB Marketplace | No |
| C | SESSION | Poshmark, TheRealReal | No |

## Current CASL Pattern
- All connector pages: `staffAuthorize()` + `ability.can('read', 'Setting')`
- Edit gate: `ability.can('update', 'Setting')`
- Stripe page: `ability.can('read', 'ProviderAdapter')` + `ability.can('update', 'ProviderInstance')`

## Scope Decision
Since ALL pages and core logic already exist, G10.13 is essentially a TEST COVERAGE + POLISH pass:
1. Write comprehensive tests for all existing code (actions, queries, component)
2. Add testConnectorConnection action for the 8 connector pages
3. Wire test connection button in ConnectorSettingsPage component
4. Minor polish to integrations dashboard (if needed)
