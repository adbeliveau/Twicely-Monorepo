---
name: I2 User Management Enrichment Findings
description: Schema gaps, existing code state, and spec inconsistencies for I2 admin user management enrichment
type: project
---

## I2 User Management Enrichment (Prompt WRITTEN 2026-03-19)

### Schema State (Verified Against Codebase)
- `user` table EXISTS in identity.ts with all needed fields including isBanned, bannedAt, bannedReason, buyerQualityTier, creditBalanceCents, deletionRequestedAt
- `sellerProfile` table EXISTS in identity.ts with sellerScore (int 0-1000), enforcementLevel, bandOverride fields, boostCreditCents, isNew
- `businessInfo` table EXISTS in identity.ts — ein column present but must NEVER be returned to client
- `storeSubscription` joins via sellerProfile.id (NOT userId) — FK is sellerProfileId
- `listerSubscription` same join pattern as storeSubscription
- `sellerBalance` table EXISTS in finance.ts — PK is userId (not CUID2), has pendingCents/availableCents/reservedCents
- `identity_verification` table does NOT EXIST — Feature Lock-in S45 describes it but never created
- `seller_performance_snapshots` table does NOT EXIST — Seller Score Canonical S10.3 describes it but never created
- `seller_score_overrides` table does NOT EXIST — override data stored inline on sellerProfile

### Existing Code Inventory
- `/usr/page.tsx`: 107 lines, basic user list with search + status filter
- `/usr/[id]/page.tsx`: 111 lines, 3 stat cards + orders table
- `queries/admin-users.ts`: 226 lines, 6 query functions (already close to 300-line limit)
- `actions/admin-users.ts`: 131 lines, 4 server actions
- `actions/user-actions.tsx`: 105 lines, suspend/warn/impersonate buttons
- `/usr/new/`, `/usr/sellers/`, `/usr/sellers/verification/` — NONE exist yet

### CASL Permissions (Verified in platform-abilities.ts)
- ADMIN/SUPER_ADMIN: `can('manage', 'all')` — covers User create/update/delete/impersonate
- SUPPORT: `can('read', 'User')` only — no create/update
- FINANCE: `can('read', 'User')`, `can('read', 'Payout')`, `can('update', 'Payout')`
- MODERATION: `can('read', 'User')`, `can('update', 'SellerProfile')`
- No IdentityVerification CASL subject needed (table doesn't exist)

### Key Architecture Decisions
- File split: queries/admin-sellers.ts for seller list + verification queue (keeps admin-users.ts under 300)
- File split: actions/admin-users-management.ts for new actions (keeps admin-users.ts unchanged)
- Tab implementation: URL search params (?tab=X), server-side data fetch per active tab
- Verification queue: read-only view using sellerProfile.verifiedAt (no approve/reject until KYC table built)
- EIN: NEVER returned from any query. Omit from select entirely.
- stripeAccountId: masked as `acct_****XXXX` before return
- subscriptions join through sellerProfile.id (CUID2 PK), NOT through userId

### Spec Gaps
1. No identity_verification table (Feature Lock-in S45 vs actual schema)
2. No seller_performance_snapshots table (Seller Score Canonical S10.3 vs actual schema)
3. Routes /usr/new, /usr/sellers, /usr/sellers/verification not in Page Registry
4. Admin user creation mechanism vs Better Auth not documented
5. No "unrestrict selling" action exists (only restrict)

### Test Patterns
- Follow admin-users.test.ts exactly: vi.mock staff-authorize + db + drizzle-orm + schema
- makeUpdateChain(), makeInsertChain() helpers
- mockAllowed(action, subject) / mockForbidden() helpers
- Dynamic import pattern: `const { actionName } = await import('../module')`
