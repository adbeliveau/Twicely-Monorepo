# G10.3 QuickBooks/Xero Accounting Sync -- Findings

## Key Schema Facts
- `accountingIntegration` table already exists in `packages/db/src/schema/finance-center.ts` (line 66-79)
- Uses `userId` ownership (NOT sellerId or sellerProfileId)
- Unique constraint on `(userId, provider)` -- one QB + one Xero per seller max
- Needs 8 new columns added: tokenExpiresAt, scopes, companyName, syncEnabled, syncIntervalHours, lastErrorMessage, errorCount, configJson
- Two NEW tables: `accountingSyncLog`, `accountingEntityMap`

## Finance Tier Gate
- `financeTierEnum` = `['FREE', 'PRO']` only (2 values, Decision #45 SUPERSEDED)
- Feature Lock-in Addendum Section 49: QB/Xero sync = "Pro+"
- Gate check: `sellerProfile.financeTier === 'PRO'`
- Power Bundle includes Finance Pro (Decision #100)

## OAuth Pattern Reuse
- Cookie name: `accounting_oauth_state` (NOT crosslister_oauth_state)
- Same CSRF pattern as eBay callback: set state cookie, redirect to provider, validate on return, delete cookie immediately
- Token encryption: reuse `@twicely/db/encryption` (AES-256-GCM) not crosslister token-crypto
- QB realmId from callback query param, Xero tenantId from `/connections` API post-token-exchange

## CASL
- New subject: `AccountingIntegration` (not yet in subjects.ts)
- Seller: `can('manage', 'AccountingIntegration', { userId })`
- FINANCE role: `can('read', 'AccountingIntegration')`
- ADMIN: `can('manage', 'AccountingIntegration')`

## Delegation Scope Inconsistency
- Actors & Security canonical: `finance.view` (singular)
- Page Registry: `finances.view` / `finances.manage` (plural)
- CASL code reality: `finance.view` (singular, in ability.ts and staff-abilities.ts)
- hub-nav.ts: uses `finances.view` (plural)

## Spec Gaps
1. Finance Engine Canonical Section 14 says QB/Xero sync is "OUT OF SCOPE for V3" -- Build Sequence Tracker overrides
2. No `/my/selling/finances/integrations` in Page Registry -- accounting UI lives in existing settings page (row 56d)
3. Feature Lock-in Addendum lists 5 finance tiers but schema only has 2 -- resolved by Decision #45

## Platform Settings
- 17 new settings under `finance.accounting.*` prefix
- QB needs: enabled, clientId, clientSecret, redirectUri, scopes, environment
- Xero needs: enabled, clientId, clientSecret, redirectUri, scopes
- Shared: syncIntervalHours (default/min/max), maxErrorRetries, syncBatchSize, master enabled toggle

## File Count
- 18 new files + 7-8 modified = 25-26 total
- ~70 tests across 4 test files
