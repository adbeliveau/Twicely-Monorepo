# G10.3 QuickBooks/Xero Accounting Sync -- Findings

## Key Discovery: Feature ALREADY SUBSTANTIALLY BUILT
- 26+ files already exist across schema, OAuth routes, server actions, sync engine, adapters, UI, tests
- 79 test cases across 6 test files
- CASL subject, abilities, seeds, notification templates all wired
- Task is AUDIT + GAP FILL, not greenfield build

## Key Schema Facts
- `accountingIntegration` table already exists in `packages/db/src/schema/finance-center.ts` (line 66-83)
- Uses `userId` ownership (NOT sellerId or sellerProfileId)
- Unique constraint on `(userId, provider)` -- one QB + one Xero per seller max
- Code has 4 extra columns not in schema canonical: syncFrequency, lastSyncStatus, syncErrorCount, companyName
- These extras are justified by FC Canonical Section 11 requirements
- Two additional tables: `accountingSyncLog` (lines 86-99), `accountingEntityMap` (lines 102-113)

## Finance Tier Gate
- `financeTierEnum` = `['FREE', 'PRO']` only (2 values, Decision #45 SUPERSEDED)
- Feature Lock-in Addendum Section 49: QB/Xero sync = "Pro+"
- Gate check: `sellerProfile.financeTier === 'PRO'`
- Power Bundle includes Finance Pro (Decision #100)

## OAuth Pattern
- QB cookies: `qb_oauth_state`, Xero cookies: `xero_oauth_state`
- SEC-010: callback verifies session user matches cookie-stored userId
- Token encryption: `@twicely/db/encryption` (AES-256-GCM)
- QB realmId from callback query param, Xero tenantId from `/connections` API post-token-exchange

## CASL (All Wired)
- Subject: `AccountingIntegration` in subjects.ts line 96
- Seller: `can(['create', 'read', 'update', 'delete'], 'AccountingIntegration', { userId })` -- ability.ts line 158
- FINANCE role: `can('read', 'AccountingIntegration')` -- platform-abilities.ts line 143
- Delegate: `finance.view` scope grants `['read', 'manage']` -- staff-abilities.ts line 147
- ADMIN: inherits from platform-abilities

## Identified Gaps (for installer to fill)
1. **NO scheduled auto-sync cron job** -- syncFrequency selector saves to DB but nothing reads it
2. **NO per-entity retry logic** -- sync engine does single attempt, maxRetries setting unused
3. **NO batch size limit** -- sync queries fetch all eligible records, batchSize setting unused
4. **NO auto-disable on error threshold** -- syncErrorCount tracked but no logic to set status='ERROR'

## Platform Settings (17 keys, all seeded)
- QB: enabled, clientId, clientSecret, apiUrl, tokenUrl, authUrl, scopes
- Xero: enabled, clientId, clientSecret, apiUrl, tokenUrl, authUrl, scopes
- Shared: defaultFrequency, maxRetries, batchSize
- Missing from seed: cronPattern (needed for cron job)

## Spec Inconsistencies (Active)
1. Route: FC Canonical `/my/finances/integrations` vs Page Registry `/my/selling/finances/integrations`
2. Finance tiers: Addendum lists 5, schema has 2 -- Decision #45 resolves
3. Finance Engine Canonical says "OUT OF SCOPE" but Build Tracker schedules it
4. Delegation scope: `finance.view` (CASL) vs `finances.view` (hub-nav.ts)

## File Count
- 26+ existing files, 4 to modify, 3 to create = ~29 total
- ~104 tests expected after gap fills (79 existing + ~25 new)
