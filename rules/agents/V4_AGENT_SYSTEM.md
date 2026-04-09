# V4 Claude Code Agent System

**Status:** DRAFT (V4)
**Purpose:** Define the dedicated Claude Code agents for V4 domain management.
**Enforcement:** Agents run via `/twicely-audit`, `/twicely-fix`, `/twicely-ask` skills.

---

## 1. Agent Architecture

### 1.1 Agent Types
Each domain has a **triplet** of agents:

| Type | Role | Tools | Model |
|------|------|-------|-------|
| **Expert** | Answer questions, find code, explain behavior | Read, Grep, Glob, Bash | sonnet |
| **Auditor** | Verify code matches canonical. PASS/DRIFT/FAIL | Read, Grep, Glob, Bash | sonnet |
| **Fixer** | Apply canonical-correct fixes | Read, Write, Edit, Bash, Grep, Glob | sonnet |

### 1.2 Execution Pattern
```
/twicely-ask <domain>   → launches Expert agent
/twicely-audit <domain> → launches Auditor agent → returns PASS/DRIFT/FAIL report
/twicely-fix <domain>   → launches Fixer agent → applies minimal correct fix
```

---

## 2. V4 Domain Agents (New)

### 2.1 twicely-engine-ai
**Scope:** `packages/ai/src/` — centralized AI engine, providers, features, cache, audit, budgets.
**Canonical:** `rules/canonicals/30_AI_MODULE.md`
**Triplet:** twicely-engine-ai, twicely-engine-ai-audit, twicely-engine-ai-fix

**Auditor checks:**
- All AI calls route through packages/ai (no direct provider calls elsewhere)
- Provider fallback chain configured
- Token budget enforcement present
- aiRequest audit logging on every call
- aiCache used for deterministic responses
- Platform settings keys match canonical
- No raw PII sent to providers

### 2.2 twicely-engine-search-ai
**Scope:** `packages/search/src/` — Typesense vector search, embeddings, hybrid ranking, visual search.
**Canonical:** `rules/canonicals/07_SEARCH_AI_DISCOVERY.md`
**Triplet:** twicely-engine-search-ai, twicely-engine-search-ai-audit, twicely-engine-search-ai-fix

**Auditor checks:**
- Typesense schema includes vector fields
- Embedding generation on listing create/update
- Hybrid search query handler combines keyword + semantic scores
- Eligibility rules from V3 preserved (isDiscoveryEligible)
- Trust multiplier pipeline intact
- Search analytics collection active

### 2.3 twicely-engine-analytics
**Scope:** `packages/analytics/src/` — event tracking, metric snapshots, platform KPIs.
**Canonical:** `rules/canonicals/15_PLATFORM_ANALYTICS.md`
**Triplet:** twicely-engine-analytics, twicely-engine-analytics-audit, twicely-engine-analytics-fix

**Auditor checks:**
- analyticsEvent table with idempotencyKey
- Event emitter wired to key flows
- Snapshot jobs registered in cron-jobs.ts
- Dashboard queries reconcile with commerce/finance
- No raw PII in events

### 2.4 twicely-engine-analytics-seller
**Scope:** `packages/analytics/src/seller-*` — per-seller snapshots, listing performance.
**Canonical:** `rules/canonicals/14_SELLER_ANALYTICS.md`
**Triplet:** twicely-engine-analytics-seller, twicely-engine-analytics-seller-audit, twicely-engine-analytics-seller-fix

**Auditor checks:**
- sellerDailySnapshot computation job
- No cross-seller data leakage
- Tier-gated analytics (basic for all, advanced for PRO)

### 2.5 twicely-engine-risk
**Scope:** `packages/risk/src/` — risk signals, scoring, fraud detection, identity verification.
**Canonical:** `rules/canonicals/26_RISK_FRAUD.md`
**Triplet:** twicely-engine-risk, twicely-engine-risk-audit, twicely-engine-risk-fix

**Auditor checks:**
- Risk check before critical actions (order, payout, publish)
- Signal collection pipeline active
- Configurable thresholds via platform_settings
- Audit trail of risk-triggered actions

### 2.6 twicely-engine-shipping
**Scope:** `packages/shipping/src/` — label purchase, rate shopping, tracking, manifests.
**Canonical:** `rules/canonicals/06_SHIPPING_LABELS.md`
**Triplet:** twicely-engine-shipping, twicely-engine-shipping-audit, twicely-engine-shipping-fix

**Auditor checks:**
- Shippo integration for rate shopping
- Label purchase flow complete
- Tracking webhook handler
- Return label generation
- Integer cents for all rates/costs

### 2.7 twicely-engine-tax
**Scope:** `packages/tax/src/` — tax calculation, 1099-K, marketplace facilitator.
**Canonical:** `rules/canonicals/29_TAXES_COMPLIANCE.md`
**Triplet:** twicely-engine-tax, twicely-engine-tax-audit, twicely-engine-tax-fix

**Auditor checks:**
- Real-time tax calculation at checkout
- Marketplace facilitator states configured
- 1099-K threshold tracking ($600)
- Annual document generation job
- Integer cents for all tax amounts

### 2.8 twicely-mk-variations
**Scope:** Variations + catalog normalization (extends `packages/commerce/`).
**Canonical:** `rules/canonicals/03_VARIATIONS_CATALOG.md`
**Triplet:** twicely-mk-variations, twicely-mk-variations-audit, twicely-mk-variations-fix

**Auditor checks:**
- Option types, values, variant rows present
- Per-variant inventory tracking
- Stock reservation on cart hold
- Typesense indexes variant attributes
- Max 5 option types per listing enforced

### 2.9 twicely-mk-seo
**Scope:** SEO system (Next.js metadata, sitemaps, structured data).
**Canonical:** `rules/canonicals/21_SEO_DISCOVERY.md`
**Triplet:** twicely-mk-seo, twicely-mk-seo-audit, twicely-mk-seo-fix

**Auditor checks:**
- JSON-LD on PDP, category, storefront pages
- Dynamic sitemap generation
- robots.txt blocks private routes
- Canonical URLs on all public pages
- Open Graph + Twitter Card meta tags

### 2.10 twicely-hub-promotions
**Scope:** Promotions, campaigns, promoted listings.
**Canonical:** `rules/canonicals/13_PROMOTIONS_CAMPAIGNS.md`
**Triplet:** twicely-hub-promotions, twicely-hub-promotions-audit, twicely-hub-promotions-fix

**Auditor checks:**
- Campaign lifecycle state machine
- Budget caps enforced
- Stacking rules (max 1 coupon + 1 campaign)
- Promoted listing bid + budget system

### 2.11 twicely-hub-disputes-auto
**Scope:** Disputes automation, auto-resolution rules.
**Canonical:** `rules/canonicals/32_DISPUTES_AUTOMATION.md`
**Triplet:** twicely-hub-disputes-auto, twicely-hub-disputes-auto-audit, twicely-hub-disputes-auto-fix

**Auditor checks:**
- Auto-resolution rules engine active
- Decision #92 waterfall integration
- SLA automation for seller response
- Escalation ladder correct

### 2.12 twicely-hub-messaging-safety
**Scope:** Messaging rate limiting, spam detection, content moderation.
**Canonical:** `rules/canonicals/35_MESSAGING_SAFETY.md`
**Triplet:** twicely-hub-messaging-safety, twicely-hub-messaging-safety-audit, twicely-hub-messaging-safety-fix

**Auditor checks:**
- Rate limiting per user
- Off-platform transaction detection
- AI content moderation integration
- Automated warning escalation

### 2.13 twicely-engine-health
**Scope:** System health, monitoring, doctor system.
**Canonical:** `rules/canonicals/27_SYSTEM_HEALTH.md`
**Triplet:** twicely-engine-health, twicely-engine-health-audit, twicely-engine-health-fix

**Auditor checks:**
- All packages register health providers
- Doctor checks cover all domains
- Alert pipeline configured
- Global kill switch present

### 2.14 twicely-engine-recon
**Scope:** Finance reconciliation, variance detection.
**Canonical:** `rules/canonicals/31_FINANCE_RECONCILIATION.md`
**Triplet:** twicely-engine-recon, twicely-engine-recon-audit, twicely-engine-recon-fix

**Auditor checks:**
- Nightly recon job runs
- Variance thresholds configurable
- Stripe ↔ ledger ↔ orders reconcile
- Alert on variance > threshold

### 2.15 twicely-hub-kb
**Scope:** Knowledge Base page builder, help articles.
**Canonical:** `rules/canonicals/37_KB_PAGE_BUILDER.md`
**Triplet:** twicely-hub-kb, twicely-hub-kb-audit, twicely-hub-kb-fix

**Auditor checks:**
- Tiptap editor integration
- Article versioning and approval workflow
- Public KB at /help/*
- Internal KB for agents
- Search integration (Typesense index)

### 2.16 twicely-hub-buyer-plus
**Scope:** Enhanced buyer experience features.
**Canonical:** `rules/canonicals/33_BUYER_EXPERIENCE_PLUS.md`
**Triplet:** twicely-hub-buyer-plus, twicely-hub-buyer-plus-audit, twicely-hub-buyer-plus-fix

### 2.17 twicely-hub-seller-plus
**Scope:** Enhanced seller experience features.
**Canonical:** `rules/canonicals/34_SELLER_EXPERIENCE_PLUS.md`
**Triplet:** twicely-hub-seller-plus, twicely-hub-seller-plus-audit, twicely-hub-seller-plus-fix

### 2.18 twicely-engine-production
**Scope:** Production hardening, audit logs, observability.
**Canonical:** `rules/canonicals/36_PRODUCTION_HARDENING.md`
**Triplet:** twicely-engine-production, twicely-engine-production-audit, twicely-engine-production-fix

---

## 3. Inherited V3 Agents (20 domains)

These agents continue unchanged from V3:

| Agent Prefix | Domain |
|-------------|--------|
| twicely-engine-schema | Drizzle schema, migrations, enums |
| twicely-engine-security | Auth, CASL, actors, delegation |
| twicely-engine-finance | TF math, fees, payouts, Stripe |
| twicely-engine-local | Local/meetup engine |
| twicely-engine-crosslister | Crosslister scheduler, connectors |
| twicely-hub-shell | Hub layout, nav, enforcement |
| twicely-hub-subscriptions | Tiers, bundles, trials, affiliate |
| twicely-hub-finance | Seller financial center |
| twicely-hub-company-finance | Twicely Inc. company P&L |
| twicely-hub-crosslister | Crosslister UI |
| twicely-hub-local | Local sale UI |
| twicely-hub-helpdesk | Helpdesk, KB (base) |
| twicely-hub-seller-score | Seller score, performance bands |
| twicely-hub-platform-settings | Platform settings admin |
| twicely-hub-messaging | Messaging system (base) |
| twicely-mk-browse | Marketplace browse, search, PLP, PDP |
| twicely-mk-checkout | Cart, checkout, order placement |
| twicely-mk-listings | Listing CRUD |
| twicely-mk-buyer-protection | Returns, disputes, claims |
| twicely-mk-personalization | Homepage feed, recommendations |

---

## 4. Agent Registration

Each new V4 agent needs 3 entries in `.claude/settings.json` under the `agents` key, following the existing pattern:

```json
{
  "twicely-engine-ai": {
    "description": "Domain expert for Twicely AI engine...",
    "tools": ["Read", "Grep", "Glob", "Bash"]
  },
  "twicely-engine-ai-audit": {
    "description": "Paired auditor for twicely-engine-ai...",
    "tools": ["Read", "Grep", "Glob", "Bash"]
  },
  "twicely-engine-ai-fix": {
    "description": "Paired fixer for twicely-engine-ai...",
    "tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
  }
}
```

Total: 18 new domains × 3 agents = **54 new agent definitions** + 20 existing V3 domains × 3 = 60 existing = **114 total agents**.

---

## 5. Audit Orchestration

### Full Audit
`/twicely-audit all` launches all 38 domain auditors in parallel (20 V3 + 18 V4).

### Domain-Specific Audit
`/twicely-audit engine-ai` launches only the AI engine auditor.

### Diff-Mode Audit
`/twicely-audit diff` audits only domains with changed files since last commit.

---

## 6. Agent Quality Rules

1. **Auditors are read-only** — they NEVER modify files
2. **Fixers make minimal changes** — smallest diff that resolves the finding
3. **Experts answer questions** — they help understand, not change
4. **All agents cite canonical section numbers** — e.g., "Canonical 30 §4.2"
5. **All agents run on sonnet** — cost-effective for audits, opus for complex fixes
