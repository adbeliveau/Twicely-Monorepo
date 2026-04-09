# V4 Platform Architecture

**Status:** LOCKED (v4.0)
**Audience:** Engineering, AI agents, DevOps
**Purpose:** Single source of truth for the V4 platform architecture. Supersedes V2's `/corp` and V3's monorepo-only docs.

---

## 0. Principles (Non-Negotiable)

1. **One codebase, one deployment** — Turborepo monorepo, single Next.js app (`apps/web`), packages for domain logic.
2. **Backend-first** — Every UI screen backed by server actions + Drizzle queries. No UI-only state.
3. **Least privilege** — CASL abilities enforce every action. PlatformRole gates operator actions.
4. **Audit everything that matters** — Money, enforcement, config changes, AI requests all emit audit events.
5. **Idempotent mutations** — All side-effect actions carry idempotency keys and are safely retryable.
6. **AI-native** — AI is a first-class platform capability, not a bolted-on feature. Centralized in `packages/ai/`.
7. **Integer cents** — All money in integer cents. Never floats.
8. **Settings-driven** — All tunable behavior reads from `platform_settings` table. No magic numbers.

---

## 1. Tech Stack (Locked)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 + TypeScript strict:true | Full-stack RSC + server actions |
| ORM | Drizzle ORM | Type-safe, zero runtime overhead |
| Auth | Better Auth | Flexible, self-hosted |
| Authorization | CASL | Declarative, composable abilities |
| Database | PostgreSQL | ACID, JSON, full-text |
| Search | Typesense (keyword + vector) | Hybrid search with built-in embeddings |
| File Storage | Cloudflare R2 | S3-compatible, free egress |
| Cache | Valkey | Redis-compatible, open source |
| Queues | BullMQ | Reliable job processing |
| Real-Time | Centrifugo | Scalable WebSocket pub/sub |
| UI | Tailwind + shadcn/ui | Utility-first, accessible |
| Email | React Email + Resend | Component-based emails |
| Testing | Vitest (unit) + Playwright (E2E) | Fast, native ESM |
| Monitoring | Grafana + Prometheus + Loki | Full observability stack |
| Error Tracking | Sentry (free tier) | Exception capture + tracing |
| Deployment | Coolify on Hetzner | Self-hosted, cost-effective |
| CI/CD | GitHub Actions | Branch-gated pipelines |
| Shipping | Shippo | Rate shopping + labels |
| Page Builder | Puck (storefronts only) | Seller page customization |
| KB Editor | Tiptap | Rich text for help articles |
| AI Providers | OpenAI + Anthropic Claude | With fallback chain |

### Banned Technologies
Prisma, NextAuth, Zustand, tRPC, Chatwoot, Zendesk, Meilisearch, MinIO, Soketi, Nodemailer, SellerTier, SubscriptionTier.

---

## 2. Monorepo Topology

```
twicely-mono/
├── apps/
│   ├── web/              # Next.js marketplace + hub (twicely.co + hub.twicely.co)
│   ├── admin/            # Admin hub UI (future wiring)
│   ├── registry/         # Feature Registry SPA
│   └── extension/        # Chrome browser extension
├── packages/
│   ├── db/               # Drizzle schema, migrations, queries
│   ├── auth/             # Better Auth server + client
│   ├── casl/             # CASL ability definitions
│   ├── commerce/         # Orders, checkout, returns, disputes, offers, local
│   ├── crosslister/      # Multi-platform listing management
│   ├── search/           # Typesense keyword + vector + PostgreSQL fallback
│   ├── finance/          # TF brackets, fee math, payout calculation
│   ├── scoring/          # Seller score + performance bands
│   ├── notifications/    # Email, push, in-app notification pipeline
│   ├── subscriptions/    # Multi-product tiers, bundles, trials
│   ├── stripe/           # Stripe Connect, webhooks, payouts
│   ├── jobs/             # BullMQ workers + cron jobs
│   ├── ai/               # [V4 NEW] Centralized AI engine
│   ├── analytics/        # [V4 NEW] Event tracking + metric snapshots
│   ├── risk/             # [V4 NEW] Fraud detection + risk scoring
│   ├── shipping/         # [V4 NEW] Label purchase + rate shopping
│   ├── tax/              # [V4 NEW] Tax calculation + 1099-K
│   ├── config/           # Platform settings utilities
│   ├── storage/          # Cloudflare R2 file operations
│   ├── realtime/         # Centrifugo client
│   ├── email/            # React Email templates
│   └── utils/            # Shared utilities
├── rules/                # V4 canonicals, install phases, architecture
└── turbo.json            # Turborepo pipeline config
```

---

## 3. Application Surfaces

### 3.1 Marketplace (twicely.co)
Public-facing buyer experience:
- Homepage + personalized feed
- Category browse + search (keyword + semantic)
- Product detail pages (PDP)
- Cart + checkout
- Buyer account, orders, messages
- Public seller storefronts
- Help center / KB

### 3.2 Seller Hub (hub.twicely.co/my/selling/*)
Authenticated seller workspace:
- Listings management (CRUD, bulk ops, templates)
- Crosslister configuration + imports
- Orders + shipping + labels
- Financial center (P&L, tax, payouts)
- Analytics dashboard
- Messages + offers
- Settings + subscriptions

### 3.3 Operator Hub (hub.twicely.co/cfg/*, /fin/*, /mod/*)
Platform operations (PlatformRole-gated):
- **cfg/** — Platform settings, feature flags, health dashboard
- **fin/** — Payout integrity, finance reconciliation, ledger
- **mod/** — Trust & safety, enforcement, content moderation
- **hd/** — Helpdesk agent views, case management
- Analytics + reporting dashboards

---

## 4. Domain Architecture

### 4.1 Domain Packages
Each domain package is self-contained with:
- Schema definitions (Drizzle `pgTable`)
- Server-side query functions
- Server actions (mutations)
- Business logic and validation
- Types and constants
- Tests (Vitest)

### 4.2 Package Dependency Rules
```
apps/web → packages/* (any package)
packages/jobs → packages/* (via dynamic imports for cycles)
packages/ai → packages/db (schema + queries only)
packages/search → packages/db
packages/commerce → packages/db, packages/finance, packages/notifications
packages/finance → packages/db, packages/stripe
```

**Circular dependency resolution:** Use dynamic `import()` + factory pattern (see CLAUDE.md Tier 5 jobs findings).

### 4.3 Data Flow
```
User Action → Server Action → Business Logic (package) → Drizzle Query → PostgreSQL
                                    ↓
                              BullMQ Job (async)
                                    ↓
                         Notifications / Search Index / Analytics Event
```

---

## 5. Products & Subscriptions

Five products, three independent subscription axes:

| Product | Tiers | Revenue Model |
|---------|-------|---------------|
| Store Subscription | NONE / STARTER / PRO / POWER / ENTERPRISE | Monthly/annual |
| Crosslister (Lister) | NONE / FREE / LITE / PRO | Monthly/annual |
| Automation Add-On | On/Off ($9.99/mo) | Monthly |
| Boosting | 1-8% seller-controlled | Per-sale commission |
| Bundles | Store + Lister combos | 14-17% discount |

**Enum names:** `StoreTier`, `ListerTier`, `PerformanceBand`. NEVER `SellerTier` or `SubscriptionTier`.

**Fee model:** Progressive 8-bracket Transaction Fee (TF) by rolling 90-day GMV. Integer cents. No floats.

---

## 6. AI Architecture

### 6.1 Centralized AI Package
`packages/ai/` is the platform's AI brain. All AI features route through it.

```
packages/ai/
├── src/
│   ├── providers/        # OpenAI, Anthropic, local model adapters
│   ├── features/         # One module per AI feature
│   │   ├── description-generator.ts
│   │   ├── smart-categorization.ts
│   │   ├── price-suggestion.ts
│   │   ├── image-analysis.ts
│   │   ├── visual-search.ts
│   │   ├── authentication.ts
│   │   ├── helpdesk-ai.ts
│   │   ├── smart-autofill.ts
│   │   ├── fraud-detection.ts
│   │   ├── recommendations.ts
│   │   ├── natural-language-search.ts
│   │   └── content-moderation.ts
│   ├── cache.ts          # Response caching (aiCache table)
│   ├── audit.ts          # Request audit trail (aiRequest table)
│   ├── budget.ts         # Token budget management
│   └── index.ts          # Public API
```

### 6.2 Provider Fallback Chain
```
Primary (OpenAI GPT-4o) → Secondary (Claude) → Tertiary (local/smaller model) → Graceful degradation
```

### 6.3 AI-Powered Search
Typesense v0.25+ built-in vector search:
- Keyword relevance + semantic embedding scores combined
- Image → embedding → visual search
- Natural language query understanding
- Personalized re-ranking

---

## 7. Security Architecture

### 7.1 Authentication
- Better Auth with 24h sessions
- 60-second cookie cache for ban propagation
- HMAC impersonation tokens (staff → seller view)
- Extension auth (Chrome extension OAuth)

### 7.2 Authorization (CASL)
- 6 actor types: Anonymous, Buyer, Seller, Staff, Admin, System
- 200+ ability definitions across domains
- Abilities checked on every server action
- PlatformRole gates operator surfaces

### 7.3 Data Security
- Integer cents (no floating point money)
- Idempotency keys on all financial mutations
- Encrypted tokens for external platform credentials
- IP hashing (no raw IPs stored)
- PII minimization in analytics

---

## 8. Infrastructure

### 8.1 Deployment
```
Hetzner VPS → Coolify (self-hosted PaaS)
├── Next.js app (apps/web)
├── PostgreSQL
├── Valkey (cache + queues)
├── Typesense
├── Centrifugo
├── BullMQ workers (packages/jobs)
└── Grafana + Prometheus + Loki
```

### 8.2 External Services
| Service | Purpose | Cost |
|---------|---------|------|
| Stripe Connect | Payments + payouts | Transaction % |
| Cloudflare R2 | File storage | Free egress |
| Resend | Transactional email | Free tier |
| Shippo | Shipping labels + rates | Per-label |
| OpenAI | AI features | Per-token |
| Sentry | Error tracking | Free tier |

### 8.3 Health & Monitoring
- Doctor system: per-domain health checks registered at startup
- Grafana dashboards: API latency, search performance, queue depth
- Alert pipeline: Prometheus → Alertmanager → Slack/email
- Global kill switch: `PLATFORM_DISABLED` env var

---

## 9. V4 New Domains (Gap Closure from V2)

| # | Domain | Package | Status |
|---|--------|---------|--------|
| 1 | Product Variations | packages/commerce (extend) | V4 NEW |
| 2 | Platform Analytics | packages/analytics | V4 NEW |
| 3 | Seller Analytics | packages/analytics (extend) | V4 NEW |
| 4 | SEO System | apps/web (Next.js metadata) | V4 NEW |
| 5 | Shipping Labels | packages/shipping | V4 NEW |
| 6 | Promotions Automation | packages/commerce (extend) | V4 NEW |
| 7 | Search AI + Vector | packages/search + packages/ai | V4 NEW |
| 8 | Disputes Automation | packages/commerce (extend) | V4 NEW |
| 9 | Risk/Fraud Engine | packages/risk | V4 NEW |
| 10 | Catalog Normalization | packages/commerce (extend) | V4 NEW |
| 11 | System Health Framework | packages/jobs (extend) | V4 NEW |
| 12 | Tax Calculation | packages/tax | V4 NEW |
| 13 | Buyer Experience Plus | packages/commerce (extend) | V4 NEW |
| 14 | Seller Experience Plus | packages/commerce (extend) | V4 NEW |
| 15 | Messaging Safety | packages/notifications (extend) | V4 NEW |
| 16 | AI Module | packages/ai | V4 NEW |
| 17 | Finance Reconciliation | packages/finance (extend) | V4 NEW |
| 18 | Production Hardening | cross-cutting | V4 NEW |
| 19 | KB Page Builder | apps/web + Tiptap | V4 NEW |

---

## 10. What V4 Defers to V5

| Feature | Reason |
|---------|--------|
| Studio page builder (Puck) | Full drag-and-drop deferred; Puck stays for storefronts |
| Internationalization (i18n) | USD-only for launch; multi-currency in V5 |
| Multi-language UI | English-only for launch |
| Developer Platform / API | Internal APIs only; public API in V5 |
| Mobile apps | Web-first; native apps in V5 |

---

## 11. Final Rule

Architecture decisions documented here are **locked**. Changes require:
1. Written proposal with rationale
2. Impact analysis across all domains
3. Approval by platform owner (Adrian)
4. Version bump to this document
