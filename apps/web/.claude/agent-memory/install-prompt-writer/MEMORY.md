# Install Prompt Writer - Agent Memory

## Key Facts
- Schema doc is v2.1.0 (file: TWICELY_V3_SCHEMA_v2_1_0.md). CLAUDE.md still references v2.0.7 filename.
- Build tracker baseline: 7811 tests, 640 files (v1.80, 2026-03-18)
- CLAUDE.md baseline: 7403 tests, 599 files
- Current branch: master, main branch: main

## Codebase State (Updated 2026-03-20)
- Phase A-G: 100% COMPLETE. All 183 build steps done. Phase H begun.
- Build tracker v1.87+: 8893 tests, 650 files, 0 TS errors.
- H1.1 COMPLETE: Extension scaffold + registration (86 tests, 6 API routes).
- H1.2 COMPLETE: Poshmark + FB Marketplace content scripts (bridge dispatcher, shared-utils, scrape route).
- H1.3 COMPLETE: TheRealReal content scripts (session/CSRF capture, consignment scrape).
- H1.4 COMPLETE: Extension Status UI (crosslister dashboard page, 53 tests).
- H2.1 COMPLETE: Whatnot OAuth (first GraphQL connector, Tier B, 35 tests).
- H2.2 COMPLETE: Whatnot BIN Crosslist (fetchListings, createListing, updateListing, delistListing, verifyListing, 97 tests).
- H2.3 COMPLETE: Whatnot Sale Webhook (HMAC verification, sale-webhook-handler, ledger posting, emergency delists).
- H3.1 COMPLETE: Shopify OAuth + scope selection UI (11th channel, Tier A, per-store OAuth, HMAC callback verify, 41 tests).
- H3.2 COMPLETE: Shopify Import (fetchListings via REST /products.json, Link-header cursor pagination, shopify-normalizer, normalizer-dispatch SHOPIFY+WHATNOT fix).
- H3.3 COMPLETE: Shopify Crosslist (createListing/updateListing/delistListing/verifyListing via REST Admin API).
- H3.4 COMPLETE: Shopify Bidirectional Sync (webhooks + outbound sync).
- H4.1 COMPLETE: Vestiaire extension scripts (12th channel, Tier C/Session, multi-currency, CHANNEL_REGISTRY all 11 entries).
- H4.2 COMPLETE: Vestiaire Import (connector + normalizer + dispatch integration, ~35 tests).

## Install Prompt Patterns
- Always check for existing schema files before specifying "create table" instructions
- Feature Lock-in Addendum (v2.1, sections 47-50) has more detail than main Feature Lock-in
- Platform settings keys follow `category.subcategory.settingName` pattern
- Existing action pattern: `'use server'`, Zod .strict(), authorize(), explicit field mapping, revalidatePath
- Existing test pattern: vi.mock for db/casl/queries, selectChain/insertChain helpers, makeOwnerSession/makeStaffSession
- Exported helpers in `'use server'` files = unintended server actions. Always keep helpers unexported.
- `sellerProfile.id` is CUID2 PK (NOT userId). `sellerProfile.userId` references `user.id`.

## Common Audit Defect Patterns
- Exported helper functions in `'use server'` files = unintended server actions
- Zod `.strict()` missing on inline schemas (only schemas in `/validations/` tend to have it)
- Fee loaders exist but callers use default params instead of awaiting them
- `sellerProfile.id` vs `session.userId` confusion (ownership model violation)
- Old route names surviving in sidebar components and redirect URLs

## Staff Auth & Hub
- Staff auth SEPARATE from Better Auth (staffUser table, twicely.staff_token cookie)
- Hub subdomain routes: /d, /usr, /tx, /fin, /mod, /hd, /kb, /cfg, /roles, /audit, /health, /flags
- staff-auth.ts: loginStaff(), getStaffSession() (cache-wrapped), logoutStaff()
- getStaffSession() checks BOTH absolute expiry + inactivity, updates lastActivityAt

## Crosslister Architecture
- 10 connectors (11 with Vestiaire): eBay, Etsy (Tier A/OAuth+webhooks), Mercari, Depop, Grailed, FB Marketplace (Tier B/OAuth), Poshmark, TheRealReal (Tier C/Session), Whatnot (Tier B/OAuth+GraphQL, H2.1), Shopify (Tier A/OAuth+REST, H3.1), Vestiaire (Tier C/Session, H4.1)
- All connector admin pages exist at `/cfg/{name}` using shared ConnectorSettingsPage component
- Per-connector platform_settings seeded in seed-crosslister.ts: feature flags, rate limits, OAuth creds, session config
- CASL: connector pages use `ability.can('read', 'Setting')`, Stripe uses `ability.can('read', 'ProviderAdapter')`
- admin-nav.ts: Crosslister collapsible group with 10 connector links (11 after H4.1), roles: ['ADMIN', 'DEVELOPER']
- CHANNEL_REGISTRY in channel-registry.ts has 11 entries (all channels including WHATNOT, SHOPIFY, VESTIAIRE). Fixed in parallel batches.

## Key Schema Facts
- `financeTierEnum` = `['FREE', 'PRO']` only (2 tiers). Decision #45 5-tier model SUPERSEDED.
- `featureFlag` table in platform.ts. `featureFlagTypeEnum`: `['BOOLEAN', 'PERCENTAGE', 'TARGETED']`
- `auditEvent` table in platform.ts. Cannot delete (immutable).
- `crosslisterAccount` in crosslister.ts. `channelEnum`: TWICELY + 9 external channels (10 with WHATNOT after H2.1, 11 with SHOPIFY after H3.1, 12 with VESTIAIRE after H4.1).
- `conversation` + `message` tables in messaging.ts. Decision #38: one per buyer-seller-listing.

## Feature Flag Systems
- **platformSetting**: Used by crosslister (`crosslister.*.crosslistEnabled`, `crosslister.*.importEnabled`)
- **featureFlag** table: Used for app-level flags (E4 scope). `connector:*` keys for Phase H.
- F3 uses platformSetting as primary gate, featureFlag as secondary (skip if not seeded yet)

## Platform Settings Seeding
- Main: `v32-platform-settings.ts` exports `V32_PLATFORM_SETTINGS` array (PlatformSettingSeed[])
- Extended: `v32-platform-settings-extended.ts` exists for additional settings
- Crosslister: `seed-crosslister.ts` — 120+ settings (per-connector flags, rate limits, creds, fees)
- Seed runner: `seed-platform.ts` imports V32_ALL_SETTINGS and upserts each with onConflictDoUpdate
- Setting types: 'number' | 'string' | 'boolean' | 'cents' | 'bps' | 'array'

## WIP / Uncommitted Work
- D1.3 Puck page builder: 11 puck blocks, editor pages, storefront-pages actions/queries/tests all untracked
- V3.2 platform settings hub: admin settings pages for cfg/environment, cfg/messaging, cfg/modules, etc.

## Schema-Only (No Business Logic Yet)
- helpdesk.ts, kb.ts, authentication.ts, personalization.ts, acquisition.ts, market-intelligence.ts, social.ts, providers.ts

## Spec Inconsistencies (Active)
- Addendum A0 deprecates 5% flat TF but CLAUDE.md still says "5% flat". `tfRateBps: 500` still seeded.
- Actors/Security says per-role timeouts vs code uses single values for all staff.
- Feature Lock-in uses `notifications.*`, Platform Settings Canonical uses `comms.*` keys.
- 8+ connector admin pages NOT in Page Registry (documentation gap, code is correct).
- CHANNEL_REGISTRY now has 11 entries (all channels including WHATNOT, SHOPIFY, VESTIAIRE). Fixed in parallel batch.

- I3+I4 Finance Gaps + Enrichment -- See [i3-i4-finance-findings.md]

## Recent Prompts Written (2026-03-18/19/20)
- I17 Admin Sidebar Final Update — See [i17-admin-sidebar-findings.md]
- I16 Remaining Page Enrichment — See [i16-remaining-page-enrichment-findings.md]
- I15 Settings & Config Enrichment — See [i15-settings-config-findings.md]
- H3.4 Shopify Bidirectional Sync — See [h34-shopify-sync-findings.md]
- I11 System & Operations — See [i11-system-operations-findings.md]
- I14 Localization & Compliance — See [i14-localization-compliance-findings.md]
- H4.2 Vestiaire Import — See [h42-vestiaire-import-findings.md]
- I9 Promotions Admin — See [i9-promotions-admin-findings.md]
- I10 Analytics — See [i10-analytics-findings.md]
- I7 Trust & Safety Suite — See [i7-trust-safety-findings.md]
- H3.3 Shopify Crosslist — See [h33-shopify-crosslist-findings.md]
- I8 Notification Admin — See [i8-notification-admin-findings.md]
- I2 User Management Enrichment — See [i2-user-management-findings.md]
- H3.2 Shopify Import — See [h32-shopify-import-findings.md]
- H4.1 Vestiaire Extension Scripts — See [h41-vestiaire-findings.md]
- I1 Categories & Catalog — See [i1-categories-catalog-findings.md]
- H3.1 Shopify OAuth — See [h31-shopify-oauth-findings.md]
- H2.3 Whatnot Sale Webhook — See [h23-whatnot-sale-webhook-findings.md]
- H2.2 Whatnot BIN Crosslist — See [h22-whatnot-bin-crosslist-findings.md]
- H2.1 Whatnot OAuth — See [h21-whatnot-oauth-findings.md]
- H1.4 Extension Status UI — See [h14-extension-status-ui-findings.md]
- H1.3 TheRealReal Content Scripts — See [h13-therealreal-findings.md]
- H1.2 Content Scripts (Poshmark + FB Marketplace) — See [h12-content-scripts-findings.md]
- H1.1 Extension Scaffold — See [h11-extension-scaffold-findings.md]
- G10.8 Staff Impersonation — See [g108-impersonation-findings.md]
- G10.9 Become Seller CTA — See findings in MEMORY.md archive
- G10.10 Saved Payment Methods — See [g1010-payment-methods-findings.md]
- G10.11 Chat Polish — See [g1011-chat-polish-findings.md]
- G10.12 Newsletter Subscribe — See [g1012-newsletter-findings.md]
- G10.13 Connector Admin — See [g1013-connector-admin-findings.md]

## See Also (Topic Files)
- [i17-admin-sidebar-findings.md] - I17 Admin Sidebar Final Update: 15 new nav items, 3 group restructures, 2 new groups (trust-safety, promotions), 5 missing icons, dispute rules URL discrepancy, ~25-30 tests
- [i16-remaining-page-enrichment-findings.md] - I16 Remaining Page Enrichment: 8 pages, NO new schema tables, dashboard quick actions, KB filters+author+helpful%, audit date range+export, flags search, mod report name resolution, ~40 tests
- [i15-settings-config-findings.md] - I15 Settings & Config: 7 pages, keyword API route MISSING, no bannedKeyword table in schema, provider mapping new page needed, 6 existing pages to enrich, ~50 tests
- [h34-shopify-sync-findings.md] - H3.4 Shopify Bidirectional Sync: HMAC Base64 (not hex), no envelope (topic from header), multi-line-item orders, outbound sync service, 3 open questions, ~70 tests
- [i14-localization-compliance-findings.md] - I14 Localization & Compliance: 6 hub pages, NO new schema tables (all platform_setting backed), delegated_access oversight, i18n scaffold, policy versioning, USD-only currency, shipping+tax rule config
- [i11-system-operations-findings.md] - I11 System & Operations: 6 pages, 0 schema changes, 4 spec inconsistencies (errors/operations/admin-messages/search-admin not in Page Registry), auditEvent immutable, Typesense REST API, broadcast via platformSetting
- [h42-vestiaire-import-findings.md] - H4.2 Vestiaire Import: connector+normalizer+dispatch, EUR default currency, sessionToken (not sessionId), /items endpoint, ~35 tests
- [i10-analytics-findings.md] - I10 Analytics: 2 pages, GMV/take rate/cohort retention, ledgerEntry fee types, no schema changes, ADMIN+FINANCE roles
- [i7-trust-safety-findings.md] - I7 Trust & Safety: 5 hub pages (/trust, /trust/sellers/[id], /trust/settings, /risk, /security), 2 CASL subjects, 2 parallel scoring systems (trustScore vs sellerScore), 4 spec inconsistencies
- [i8-notification-admin-findings.md] - I8 Notification Admin: 3 pages, 4 actions, notificationTemplate CRUD, ADMIN-only, 19 seed templates, no schema changes
- [h33-shopify-crosslist-findings.md] - H3.3 Shopify Crosslist: REST Admin API, 1-step create (vs Whatnot 2-step), DELETE for delist, image cap discrepancy (250 vs 10), connector file size issue
- [i2-user-management-findings.md] - I2 User Management: 20 files, tabbed user detail, seller list, verification queue, 5 schema gaps (no identity_verification/performance_snapshots/score_overrides tables)
- [h32-shopify-import-findings.md] - H3.2 Shopify Import: REST API, Link-header cursor pagination, normalizer-dispatch SHOPIFY+WHATNOT gap fix, shopify-import.ts extraction
- [i3-i4-finance-findings.md] - I3+I4 Finance gaps + enrichment: chargebacks=ledger entries, holds=ledger entries, 5 sub tables, CASL gaps
- [h41-vestiaire-findings.md] - H4.1 Vestiaire extension scripts: multi-currency, Tier C/Session, CHANNEL_REGISTRY gap (WHATNOT+SHOPIFY missing)
- [h31-shopify-oauth-findings.md] - H3.1 Shopify OAuth: per-store OAuth, permanent tokens, HMAC callback verify, Tier A, NOT in Lister Canonical
- [h23-whatnot-sale-webhook-findings.md] - H2.3 Whatnot sale webhook: HMAC verify, handler mirrors eBay pattern, missing seeds, spec gaps
- [h22-whatnot-bin-crosslist-findings.md] - H2.2 BIN crosslist: 5 stub methods, GraphQL mutations, 2-step create, extracted helpers
- [h21-whatnot-oauth-findings.md] - H2.1 Whatnot OAuth: GraphQL API, env-aware URLs, refresh token invalidation, NOT in canonical specs
- [h14-extension-status-ui-findings.md] - H1.4 crosslister dashboard page, extension detection heuristic, Tier C banner
- [h13-therealreal-findings.md] - H1.3 TheRealReal content script: consignment model, session data shape, no Next.js
- [h12-content-scripts-findings.md] - H1.2 Poshmark/FB content script architecture, session data shapes, DOM scraping strategies
- [h11-extension-scaffold-findings.md] - H1.1 browser extension architecture decisions, no canonical spec
- [g1013-connector-admin-findings.md] - G10.13 full gap analysis, existing code inventory
- [g1012-newsletter-findings.md] - G10.12 newsletter spec gaps
- [g1011-chat-polish-findings.md] - G10.11 chat polish 4 sub-steps
- [g1010-payment-methods-findings.md] - G10.10 Stripe payment methods
- [g108-impersonation-findings.md] - G10.8 impersonation spec gaps
- [g2-local-findings.md] - G2 existing code inventory, CASL gaps
- [g6-kyc-findings.md] - G6 KYC schema gaps
- [g8-gdpr-findings.md] - G8 GDPR schema gaps
- [crosslister-automation-details.md] - Crosslister E2.1-F6 architecture
- [g1-affiliate-findings.md] - G1 affiliate program details
