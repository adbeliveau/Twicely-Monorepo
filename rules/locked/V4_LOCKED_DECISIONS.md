# V4 Locked Decisions

**Status:** LOCKED (v4.0)
**Purpose:** Decisions that are final and cannot be changed without a version bump.
**Enforcement:** Claude Code agents + Doctor checks + CI pipeline.

---

## Technology Decisions (Inherited from V3)

### TD-001: Drizzle ORM (not Prisma)
**Decided:** V3 inception
**Rationale:** Type-safe, zero runtime overhead, direct SQL when needed.
**Lock:** Schema lives in `packages/db/src/schema/`. Migrations in `packages/db/migrations/`.

### TD-002: Better Auth (not NextAuth)
**Decided:** V3 inception
**Rationale:** Self-hosted, flexible, session-based with 24h expiry.
**Lock:** Auth config in `packages/auth/src/server.ts`. 60-second cookie cache (ban propagation).

### TD-003: CASL Authorization (not custom RBAC)
**Decided:** V3 inception, Decision #21
**Rationale:** Declarative, composable, testable ability system.
**Lock:** Abilities in `packages/casl/src/`. PlatformRole for operator gates. No invented permission keys.

### TD-004: Typesense Search (not Meilisearch)
**Decided:** V3 inception
**Rationale:** Better faceting, built-in vector search (v0.25+), typo tolerance.
**Lock:** Search config in `packages/search/src/`. V4 adds vector fields for AI search.

### TD-005: BullMQ + Valkey (not Redis + Bull)
**Decided:** V3 inception
**Rationale:** Open-source Valkey, reliable job processing, cron scheduling.
**Lock:** Jobs in `packages/jobs/src/`. All cron jobs must specify `tz: 'UTC'`.

### TD-006: Centrifugo Realtime (not Soketi/Pusher)
**Decided:** V3 inception
**Rationale:** Scalable, self-hosted WebSocket pub/sub.
**Lock:** Client in `packages/realtime/src/`.

### TD-007: Cloudflare R2 Storage (not S3/MinIO)
**Decided:** V3 inception
**Rationale:** S3-compatible with free egress.
**Lock:** Storage utilities in `packages/storage/src/`.

### TD-008: Coolify on Hetzner (not Vercel)
**Decided:** V3 inception
**Rationale:** Self-hosted, cost-effective, full control.
**Lock:** Deployment via Coolify. CI/CD via GitHub Actions.

---

## Business Decisions (Inherited from V3)

### BD-001: Multi-Product Subscriptions (5 products, 3 axes)
**Decided:** V3, Decision #100
**Rationale:** Store/Lister/Automation/Boosting/Bundles are independent.
**Lock:** Enum names: `StoreTier`, `ListerTier`, `PerformanceBand`. NEVER `SellerTier`/`SubscriptionTier`.

### BD-002: Progressive Transaction Fee (8 brackets by GMV)
**Decided:** V3, Decision #78
**Rationale:** Volume discounts encourage growth. Fair across all seller sizes.
**Lock:** Brackets in `packages/finance/src/`. Integer cents only.

### BD-003: Importer-First Strategy
**Decided:** V3 inception
**Rationale:** Free import is the growth engine. Crosslister forces listings onto Twicely.
**Lock:** FREE ListerTier always allows import. Import auto-activates listings.

### BD-004: Three-Layer Personalization
**Decided:** V3, Decision #18
**Rationale:** Browsing history → collaborative filtering → trending.
**Lock:** Feed algorithm in `packages/search/` + `packages/ai/`.

### BD-005: Decision #92 Claim Recovery Waterfall
**Decided:** V3, post-release fix
**Rationale:** Recover from seller before platform absorbs loss.
**Lock:** `dispute-queries.ts` in `packages/commerce/`.

---

## V4 New Decisions

### V4D-001: Centralized AI Package
**Decided:** V4 planning
**Rationale:** All AI features route through `packages/ai/`. No scattered AI calls.
**Lock:** Provider abstraction with fallback chain. Token budgets per feature. Audit trail on every call.

### V4D-002: Typesense Vector Search for AI Discovery
**Decided:** V4 planning
**Rationale:** Typesense v0.25+ has built-in embedding generation. Hybrid keyword + semantic search.
**Lock:** Vector fields added to Typesense collection schema. OpenAI embeddings for listings.

### V4D-003: Shippo for Shipping Labels
**Decided:** V4 planning
**Rationale:** Already in V3 tech stack for quotes. Extend to label purchase + rate shopping.
**Lock:** `packages/shipping/` for label operations. Shippo API integration.

### V4D-004: TaxJar Free Tier for Tax Calculation
**Decided:** V4 planning
**Rationale:** Free tier covers US sales tax. Fallback to manual rate table.
**Lock:** `packages/tax/` for calculation. US-only (i18n deferred to V5).

### V4D-005: Tiptap for KB Editor
**Decided:** V4 planning
**Rationale:** Rich text editor for help articles. Not full Studio (V5).
**Lock:** KB articles use Tiptap. Public at `/help/*`. Internal KB for agents.

### V4D-006: Sentry Free Tier for Error Tracking
**Decided:** V4 planning
**Rationale:** Best-in-class error tracking. Free tier sufficient for launch.
**Lock:** Sentry SDK integrated in `apps/web`. Source maps uploaded in CI.

### V4D-007: Studio/Puck Page Builder Deferred to V5
**Decided:** V4 planning
**Rationale:** Full drag-and-drop page builder is scope creep for V4.
**Lock:** Puck stays for storefronts only. KB uses Tiptap. Full Studio in V5.

### V4D-008: Internationalization Deferred to V5
**Decided:** V4 planning
**Rationale:** USD-only, English-only for V4 launch. Multi-currency/language in V5.
**Lock:** No i18n infrastructure in V4. All strings hardcoded English.

### V4D-009: AI is Platform-Wide
**Decided:** V4 planning
**Rationale:** AI is deeply rooted across all domains, not an optional feature.
**Lock:** 12 AI features in `packages/ai/`. Every domain integrates with AI where applicable.

### V4D-010: Global Platform Kill Switch
**Decided:** V4 planning
**Rationale:** Emergency shutdown capability for incidents.
**Lock:** `PLATFORM_DISABLED` env var → maintenance page. No feature flags needed — binary on/off.

---

## Security Decisions (Inherited from V3)

### SEC-001: Live Price Lookup at Checkout
**Lock:** `create-order.ts` uses live `listing.priceCents`, not stale cart price.

### SEC-016: Minimum 2-Day Payout Delay
**Lock:** `Math.max(2, options.delayDays)` enforced in `packages/stripe/src/payouts.ts`.

### SEC-022: Webhook Idempotency Fail-CLOSED
**Lock:** DB error → treat as "already processed" (not "new"). Prevents double-charge.

### SEC-027: Purge Allowlist
**Lock:** `ALLOWED_PURGE_TABLES` + `ALLOWED_PURGE_COLUMNS` checked before any purge query.

### SEC-036: 24h Sessions + 60s Ban Cache
**Lock:** `packages/auth/src/server.ts`. Cookie cache prevents banned users from acting for up to 60s.

---

## Naming Conventions (Locked)

| Correct | NEVER Use |
|---------|-----------|
| `StoreTier` | `SellerTier`, `SubscriptionTier` |
| `ListerTier` | `CrosslisterTier` |
| `PerformanceBand` | `SellerBand`, `TrustLevel` |
| `priceCents` | `price` (ambiguous) |
| `feeCents` | `fee` (ambiguous) |
| `Transaction Fee` / `TF` | `FVF`, `Final Value Fee` |
| `(hub)/` | `/corp/` |
| server action | REST endpoint |
| Drizzle pgTable | Prisma model |

---

## Final Rule

Locked decisions cannot be unlocked without:
1. Written proposal with impact analysis
2. Approval by Adrian
3. Version bump (V5+)
4. All affected canonicals updated
5. All affected tests updated
