# Twicely V4 Rules

This directory contains the complete specification for Twicely V4 — the definitive build that merges the best of V2 (comprehensive specs, 45 install phases) and V3 (working Turborepo monorepo, 9,838+ tests, 20-domain agent system).

## Directory Structure

```
rules/
├── README.md                   # This file
├── V4_INSTALL_SEQUENCE.md      # Master execution order (19 phases)
├── architecture/
│   └── V4_PLATFORM_ARCHITECTURE.md   # Tech stack, topology, domain map
├── governance/
│   └── V4_GOVERNANCE.md              # Quality gates, doctor, freeze rules
├── locked/
│   └── V4_LOCKED_DECISIONS.md        # Immutable tech + business decisions
├── agents/
│   └── V4_AGENT_SYSTEM.md            # 38 domain agents (20 V3 + 18 V4)
├── canonicals/                  # V4 canonical specifications
│   ├── 03_VARIATIONS_CATALOG.md
│   ├── 06_SHIPPING_LABELS.md
│   ├── 07_SEARCH_AI_DISCOVERY.md
│   ├── 13_PROMOTIONS_CAMPAIGNS.md
│   ├── 14_SELLER_ANALYTICS.md
│   ├── 15_PLATFORM_ANALYTICS.md
│   ├── 21_SEO_DISCOVERY.md
│   ├── 26_RISK_FRAUD.md
│   ├── 27_SYSTEM_HEALTH.md
│   ├── 29_TAXES_COMPLIANCE.md
│   ├── 30_AI_MODULE.md
│   ├── 31_FINANCE_RECONCILIATION.md
│   ├── 32_DISPUTES_AUTOMATION.md
│   ├── 33_BUYER_EXPERIENCE_PLUS.md
│   ├── 34_SELLER_EXPERIENCE_PLUS.md
│   ├── 35_MESSAGING_SAFETY.md
│   ├── 36_PRODUCTION_HARDENING.md
│   └── 37_KB_PAGE_BUILDER.md
├── install-phases/              # V4 install phases (tight, atomic)
│   ├── PHASE_V4_01_VARIATIONS.md
│   ├── PHASE_V4_02_PLATFORM_ANALYTICS.md
│   ├── PHASE_V4_03_SELLER_ANALYTICS.md
│   ├── PHASE_V4_04_SEO.md
│   ├── PHASE_V4_05_SHIPPING_LABELS.md
│   ├── PHASE_V4_06_PROMOTIONS_AUTOMATION.md
│   ├── PHASE_V4_07_FINANCE_RECON.md
│   ├── PHASE_V4_08_DISPUTES_AUTOMATION.md
│   ├── PHASE_V4_09_RISK_ENGINE.md
│   ├── PHASE_V4_10_CATALOG_NORMALIZATION.md
│   ├── PHASE_V4_11_HEALTH_FRAMEWORK.md
│   ├── PHASE_V4_12_TAXES_ENHANCED.md
│   ├── PHASE_V4_13_BUYER_EXPERIENCE_PLUS.md
│   ├── PHASE_V4_14_SELLER_EXPERIENCE_PLUS.md
│   ├── PHASE_V4_15_MESSAGING_SAFETY.md
│   ├── PHASE_V4_16_AI_MODULE.md
│   ├── PHASE_V4_17_SEARCH_AI.md
│   ├── PHASE_V4_18_PRODUCTION_HARDENING.md
│   └── PHASE_V4_19_KB_PAGE_BUILDER.md
├── v2-reference/                # Original V2 specs (read-only reference)
│   ├── canonicals/              # 27 V2 canonical documents
│   ├── install-phases/          # 46 V2 install phases (0-45)
│   ├── locked/                  # 12 V2 locked decisions
│   ├── architecture/            # 3 V2 architecture docs
│   ├── governance/              # 7 V2 governance docs
│   ├── modules/                 # 11 V2 module system docs
│   └── ...                      # Root V2 files (schema, agents, etc.)
└── v3-reference/                # 40 V3 canonical documents (read-only)
```

## What V4 Adds (19 New Domains)

| # | Domain | Key Capability |
|---|--------|---------------|
| 1 | Product Variations | Multi-size/color with per-variant inventory |
| 2 | Platform Analytics | Event tracking + metric snapshots + KPI dashboards |
| 3 | Seller Analytics | Per-seller performance snapshots + listing analytics |
| 4 | SEO System | Sitemaps, JSON-LD, meta tags, structured data |
| 5 | Shipping Labels | Rate shopping + label purchase via Shippo |
| 6 | Promotions Automation | Campaign lifecycle, flash sales, promoted listings |
| 7 | Search AI | Hybrid keyword + semantic + visual search |
| 8 | Disputes Automation | Auto-resolution rules engine + SLA monitoring |
| 9 | Risk/Fraud Engine | Risk scoring, fraud detection, identity verification |
| 10 | Catalog Normalization | Product matching, brand registry, attribute normalization |
| 11 | Health Framework | Provider-driven health checks + doctor UI |
| 12 | Tax Calculation | US sales tax + marketplace facilitator + 1099-K |
| 13 | Buyer Experience Plus | Collections, price alerts, photo reviews |
| 14 | Seller Experience Plus | Bulk ops, templates, shipping presets |
| 15 | Messaging Safety | Rate limiting, spam detection, AI moderation |
| 16 | AI Module | Centralized AI engine (12 features) |
| 17 | Finance Reconciliation | Stripe-ledger variance detection |
| 18 | Production Hardening | Audit logs, error tracking, circuit breakers |
| 19 | KB Page Builder | Help articles with Tiptap editor |

## What V4 Inherits from V3 (20 Existing Domains)

Auth, CASL, Schema, Finance Engine, Commerce, Crosslister, Local/Meetup, Search (base), Subscriptions, Seller Score, Helpdesk, Messaging, Notifications, Stripe, Shell/Nav, Platform Settings, Browse/PDP, Checkout, Listings, Buyer Protection, Personalization.

## What V4 Defers to V5

- Studio page builder (Puck → full drag-and-drop)
- Internationalization (multi-currency, multi-language)
- Developer Platform (public API)
- Mobile apps (native iOS/Android)

## How to Execute

1. Verify V3 baseline: `npx turbo typecheck && npx turbo test`
2. Execute phases in order per `V4_INSTALL_SEQUENCE.md`
3. After each phase: run doctor checks + typecheck + tests
4. After all phases: run full audit `/twicely-audit all`
