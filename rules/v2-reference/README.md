# TWICELY V2 — Complete Rules Directory Structure
**Version:** v2.1
**Last Updated:** January 23, 2026  
**Purpose:** Authoritative file placement guide for all specification documents

---

## Directory Overview

```
/rules/
├── README.md                              # This guide
├── AGENTS.md                              # AI agent behavioral guidelines
│
├── /canonicals/                           # Domain canonical specifications (26 files)
│   ├── TWICELY_LISTINGS_CATALOG_CANONICAL.md
│   ├── TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md
│   ├── TWICELY_ORDERS_FULFILLMENT_CANONICAL.md
│   ├── TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md
│   ├── TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md
│   ├── TWICELY_BUYER_EXPERIENCE_CANONICAL.md
│   ├── TWICELY_RATINGS_TRUST_CANONICAL.md
│   ├── TWICELY_TRUST_SAFETY_CANONICAL.md
│   ├── TWICELY_POLICY_LIBRARY_CANONICAL.md
│   ├── TWICELY_NOTIFICATIONS_CANONICAL.md
│   ├── TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md
│   ├── TWICELY_ANALYTICS_METRICS_CANONICAL.md
│   ├── TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md
│   ├── TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md
│   ├── TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md
│   └── TWICELY_INTERNATIONALIZATION_CANONICAL.md
│
├── /locked/                               # Locked behavioral specifications (8 files)
│   ├── TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md
│   ├── TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md
│   ├── TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md
│   ├── TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md
│   ├── TWICELY_STRIPE_CONNECT_IMPLEMENTATION_LOCKED.md
│   ├── TWICELY_KERNEL_MODULE_ENFORCEMENT_LOCKED.md
│   ├── TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md
│   └── TWICELY_USER_MODEL_LOCKED.md
│
├── /governance/                           # Governance and meta files (7 files)
│   ├── TWICELY_V2_FREEZE_0_44_LOCKED.md
│   ├── TWICELY_V2_CORE_LOCK.md
│   ├── TWICELY_V2_META_GOVERNANCE_CANONICAL.md
│   ├── TWICELY_V2_OPERATIONAL_GLUE_CANONICAL.md
│   ├── TWICELY_V2_MASTER_DOCTOR_SPEC.md
│   ├── TWICELY_MARKETPLACE_INDEX_CANONICAL.md
│   ├── TWICELY_KERNEL_MODULES_SPEC.md
│
├── /architecture/                         # High-level architecture docs (3 files)
│   ├── TWICELY_CORP_ADMIN_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md
│   ├── TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md
│   └── TWICELY_CORP_SELLER_BOUNDARY_RULES_CANONICAL.md
│
├── /health/                               # Health and monitoring specs (2 files)
│   ├── System-Health-Canonical-Spec-v1-provider-driven.md
│   └── Twicely-Studio-Health-Provider-Spec-v1.md
│
├── /modules/                              # Module system specs (6 files)
│   ├── Twicely-Module-Creation-Template-v1.md
│   ├── Twicely-Module-Linter-Spec-v1.md
│   ├── Twicely-Module-Installer-UI-Canonical-v1.md
│   ├── Twicely-Module-Runtime-Guards-Canonical-v1.md
│   ├── Twicely-AI-Module-Validation-Checklist-v1.md
│   ├── twicely-modules-integration-checklist.md
│   └── Twicely-Studio-SelfInstall-and-Health-Master-Prompt.md
│
├── /rbac/                                 # RBAC and permissions (2 files)
│   ├── TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md
│   └── (TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md symlink → /locked/)
│
└── /install-phases/                       # All 45 installation phases (0-44)
    ├── TWICELY_V2_INSTALL_PHASE_0_BOOTSTRAP.md
    ├── TWICELY_V2_INSTALL_PHASE_1_RBAC_ROLES.md
    ├── TWICELY_V2_INSTALL_PHASE_2_LISTINGS_CATALOG.md
    ├── TWICELY_V2_INSTALL_PHASE_3_ORDERS_SHIPPING.md
    ├── TWICELY_V2_INSTALL_PHASE_4_PAYMENTS_WEBHOOKS_LEDGER_PAYOUTS.md
    ├── TWICELY_V2_INSTALL_PHASE_5_SEARCH_DISCOVERY.md
    ├── TWICELY_V2_INSTALL_PHASE_6_TRUST_POLICY_RATINGS.md
    ├── TWICELY_V2_INSTALL_PHASE_7_NOTIFICATIONS_PIPELINE.md
    ├── TWICELY_V2_INSTALL_PHASE_8_ANALYTICS_METRICS.md
    ├── TWICELY_V2_INSTALL_PHASE_9_FEATURE_FLAGS.md
    ├── TWICELY_V2_INSTALL_PHASE_10_SYSTEM_HEALTH_SRE_MODULES_DOCTOR_UI.md
    ├── TWICELY_V2_INSTALL_PHASE_11_DATA_RETENTION_PRIVACY.md
    ├── TWICELY_V2_INSTALL_PHASE_12_INTERNATIONALIZATION.md
    ├── TWICELY_V2_INSTALL_PHASE_13_SELLER_ONBOARDING_VERIFICATION.md
    ├── TWICELY_V2_INSTALL_PHASE_14_RETURNS_DISPUTES_CASE_MGMT.md
    ├── TWICELY_V2_INSTALL_PHASE_15_CORP_NAV_MENUS_SETTINGS_REGISTRY.md
    ├── TWICELY_V2_INSTALL_PHASE_16_BUYER_EXPERIENCE_REVIEWS.md
    ├── TWICELY_V2_INSTALL_PHASE_17_SEARCH_RANKING_PIPELINE.md
    ├── TWICELY_V2_INSTALL_PHASE_18_FINANCE_RECON_REPORTING.md
    ├── TWICELY_V2_INSTALL_PHASE_19_AUDIT_LOGS_OBSERVABILITY.md
    ├── TWICELY_V2_INSTALL_PHASE_20_PRODUCTION_READINESS_CHECKLIST.md
    ├── TWICELY_V2_INSTALL_PHASE_21_MESSAGING_NOTIFICATIONS.md
    ├── TWICELY_V2_INSTALL_PHASE_22_PROMOTIONS_COUPONS.md
    ├── TWICELY_V2_INSTALL_PHASE_23_SELLER_ANALYTICS.md
    ├── TWICELY_V2_INSTALL_PHASE_24_SUBSCRIPTIONS_BILLING_TIERS.md
    ├── TWICELY_V2_INSTALL_PHASE_25_PROMOTIONS_AUTOMATION.md
    ├── TWICELY_V2_INSTALL_PHASE_26_TRUST_PERFORMANCE_INSIGHTS.md
    ├── TWICELY_V2_INSTALL_PHASE_27_MESSAGING_ENHANCEMENTS.md
    ├── TWICELY_V2_INSTALL_PHASE_28_DISPUTES_AUTOMATION.md
    ├── TWICELY_V2_INSTALL_PHASE_29_SELLER_HUB_EXPANDED.md
    ├── TWICELY_V2_INSTALL_PHASE_30_CUSTOMER_SUPPORT_CONSOLE.md
    ├── TWICELY_V2_INSTALL_PHASE_31_TAXES_COMPLIANCE.md
    ├── TWICELY_V2_INSTALL_PHASE_32_IDENTITY_VERIFICATION_RISK.md
    ├── TWICELY_V2_INSTALL_PHASE_33_CHARGEBACKS_CLAIMS.md
    ├── TWICELY_V2_INSTALL_PHASE_34_SHIPPING_LABELS.md
    ├── TWICELY_V2_INSTALL_PHASE_35_CATALOG_NORMALIZATION.md
    ├── TWICELY_V2_INSTALL_PHASE_36_PROMOTED_LISTINGS.md
    ├── TWICELY_V2_INSTALL_PHASE_37_SELLER_STANDARDS.md
    ├── TWICELY_V2_INSTALL_PHASE_38_BUYER_PROTECTION.md
    ├── TWICELY_V2_INSTALL_PHASE_39_SEO_PUBLIC_BROWSE.md
    ├── TWICELY_V2_INSTALL_PHASE_40_INTERNATIONAL_ENHANCED.md
    ├── TWICELY_V2_INSTALL_PHASE_41_VARIATIONS_COMPLETE.md
    ├── TWICELY_V2_INSTALL_PHASE_42_SELLER_EXPERIENCE_PLUS.md
    ├── TWICELY_V2_INSTALL_PHASE_43_BUYER_EXPERIENCE_PLUS.md
    └── TWICELY_V2_INSTALL_PHASE_44_LISTING_VARIATIONS.md
```

---

## Detailed File Manifest

### Root Level Files (2)

| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Directory guide and navigation | Required |
| `AGENTS.md` | AI agent behavioral guidelines for code generation | Required |

---

### /canonicals/ — Domain Canonical Specifications (26)

These define **what** each domain does and its rules. Canonicals are the source of truth for domain behavior.

| # | File | Domain | Description |
|---|------|--------|-------------|
| 1 | `TWICELY_LISTINGS_CATALOG_CANONICAL.md` | Commerce | Listing lifecycle, categories, attributes, variations |
| 2 | `TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md` | Discovery | Search indexing, eligibility, browse, filters |
| 3 | `TWICELY_ORDERS_FULFILLMENT_CANONICAL.md` | Commerce | Order states, fulfillment, completion |
| 4 | `TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md` | Logistics | Shipping profiles, labels, tracking, carrier events |
| 5 | `TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md` | Resolution | Return workflow, refund rules, dispute lifecycle |
| 6 | `TWICELY_BUYER_EXPERIENCE_CANONICAL.md` | Experience | Browse, checkout, order tracking, reviews |
| 7 | `TWICELY_RATINGS_TRUST_CANONICAL.md` | Trust | Ratings, trust score, decay, bands, multipliers |
| 8 | `TWICELY_TRUST_SAFETY_CANONICAL.md` | Safety | Policy enforcement, cases, actions |
| 9 | `TWICELY_POLICY_LIBRARY_CANONICAL.md` | Governance | Policy versioning, effective dates |
| 10 | `TWICELY_NOTIFICATIONS_CANONICAL.md` | Comms | Notification types, channels, idempotency |
| 11 | `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md` | Finance | Fees, ledger entries, payout rules |
| 12 | `TWICELY_ANALYTICS_METRICS_CANONICAL.md` | Intelligence | Events, metrics, KPIs |
| 13 | `TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md` | Platform | Flags, kill switches, rollouts |
| 14 | `TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md` | Onboarding | Seller verification, payout setup |
| 15 | `TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md` | Compliance | Retention periods, exports, anonymization |
| 16 | `TWICELY_INTERNATIONALIZATION_CANONICAL.md` | i18n | Regions, currencies, locales |
| 17 | `TWICELY_MULTI_CURRENCY_TRANSLATIONS_CANONICAL.md` | i18n | Multi-currency support, translations |
| 18 | `TWICELY_PRODUCT_VARIATIONS_CANONICAL.md` | Commerce | Product variation types and values |
| 19 | `TWICELY_BUYER_EXPERIENCE_PLUS_CANONICAL.md` | Experience | Price alerts, recommendations, bundles |
| 20 | `TWICELY_BUYER_PROTECTION_CANONICAL.md` | Safety | Claims, guarantees, seller protection scores |
| 21 | `TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md` | Experience | Bulk ops, block lists, vacation mode |
| 22 | `TWICELY_V2_UNIFIED_PLATFORM_SETTINGS_CANONICAL.md` | Platform | Settings registry, effective dates |
| 23 | `TWICELY_V2_VARIATIONS_CANONICAL.md` | Commerce | Complete variations system |
| 24 | `TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md` | RBAC | Seller delegated access scopes |
| 25 | `TWICELY_API_VERSIONING_DEVELOPER_PLATFORM_CANONICAL.md` | Platform | API versioning, OAuth, developer platform |
| 26 | `TWICELY_TESTING_REQUIREMENTS_CANONICAL.md` | Engineering | Testing strategy, coverage, CI/CD |

---

### /locked/ — Locked Behavioral Specifications (8)

These define **immutable** cross-cutting behavioral contracts. Changes require governance approval.

| # | File | Domain | Description |
|---|------|--------|-------------|
| 1 | `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md` | Auth | Platform RBAC + seller delegation model |
| 2 | `TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md` | Commerce | Order, listing, payment state transitions |
| 3 | `TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md` | Finance | Payment flow, Stripe Connect integration |
| 4 | `TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md` | Finance | Webhook processing, idempotency, reconciliation |
| 5 | `TWICELY_STRIPE_CONNECT_IMPLEMENTATION_LOCKED.md` | Finance | Stripe Connect account types, onboarding |
| 6 | `TWICELY_KERNEL_MODULE_ENFORCEMENT_LOCKED.md` | Platform | Module installation, validation, guards |
| 7 | `TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md` | Ops | Health providers, Doctor checks, SRE console |
| 8 | `TWICELY_USER_MODEL_LOCKED.md` | Auth | User model, single-owner principle |

---

### /governance/ — Governance and Meta Files (7)

These control **how** the system evolves and maintains integrity.

| # | File | Purpose | Description |
|---|------|---------|-------------|
| 1 | `TWICELY_V2_FREEZE_0_44_LOCKED.md` | Phase Lock | Locks phases 0-43 structure |
| 2 | `TWICELY_V2_CORE_LOCK.md` | Core Lock | Immutable core behaviors |
| 3 | `TWICELY_V2_META_GOVERNANCE_CANONICAL.md` | Meta | How to change canonicals |
| 4 | `TWICELY_V2_OPERATIONAL_GLUE_CANONICAL.md` | Glue | Cross-phase integration rules |
| 5 | `TWICELY_V2_MASTER_DOCTOR_SPEC.md` | Doctor | Master Doctor script specification |
| 6 | `TWICELY_MARKETPLACE_INDEX_CANONICAL.md` | Index | Master index of all canonicals |
| 7 | `TWICELY_KERNEL_MODULES_SPEC.md` | Modules | Kernel module system spec |

---

### /architecture/ — High-Level Architecture (3)

These define **structural** patterns for major system areas.

| # | File | Area | Description |
|---|------|------|-------------|
| 1 | `TWICELY_CORP_ADMIN_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md` | Corp Admin | Corp Hub structure, menus, permissions |
| 2 | `TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md` | Seller Hub | Seller dashboard structure |
| 3 | `TWICELY_CORP_SELLER_BOUNDARY_RULES_CANONICAL.md` | Boundaries | Corp vs Seller route separation |

---

### /health/ — Health and Monitoring (2)

These define **observability** patterns.

| # | File | Purpose | Description |
|---|------|---------|-------------|
| 1 | `System-Health-Canonical-Spec-v1-provider-driven.md` | Health System | Provider-driven health checks |
| 2 | `Twicely-Studio-Health-Provider-Spec-v1.md` | Studio | Studio-specific health checks |

---

### /modules/ — Module System (7)

These define the **module** installation and validation system.

| # | File | Purpose | Description |
|---|------|---------|-------------|
| 1 | `Twicely-Module-Creation-Template-v1.md` | Template | How to create new modules |
| 2 | `Twicely-Module-Linter-Spec-v1.md` | Linting | Module code validation |
| 3 | `Twicely-Module-Installer-UI-Canonical-v1.md` | UI | Module installer interface |
| 4 | `Twicely-Module-Runtime-Guards-Canonical-v1.md` | Guards | Runtime module protection |
| 5 | `Twicely-AI-Module-Validation-Checklist-v1.md` | AI | AI validation requirements |
| 6 | `twicely-modules-integration-checklist.md` | Checklist | Integration checklist |
| 7 | `Twicely-Studio-SelfInstall-and-Health-Master-Prompt.md` | Master | Master installation prompt |

---

### /rbac/ — RBAC and Permissions (2)

These define **access control** patterns.

| # | File | Purpose | Description |
|---|------|---------|-------------|
| 1 | `TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md` | Seller Scopes | Seller permission mapping |
| 2 | Symlink → `/locked/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md` | Reference | Cross-reference to locked spec |

---

### /install-phases/ — Installation Phases (45)

These define **how** to build the system phase by phase.

#### Foundation (Phases 0-4)
| Phase | File | Domain |
|-------|------|--------|
| 0 | `TWICELY_V2_INSTALL_PHASE_0_BOOTSTRAP.md` | Bootstrap |
| 1 | `TWICELY_V2_INSTALL_PHASE_1_RBAC_ROLES.md` | RBAC |
| 2 | `TWICELY_V2_INSTALL_PHASE_2_LISTINGS_CATALOG.md` | Listings |
| 3 | `TWICELY_V2_INSTALL_PHASE_3_ORDERS_SHIPPING.md` | Orders |
| 4 | `TWICELY_V2_INSTALL_PHASE_4_PAYMENTS_WEBHOOKS_LEDGER_PAYOUTS.md` | Payments |

#### Core Platform (Phases 5-10)
| Phase | File | Domain |
|-------|------|--------|
| 5 | `TWICELY_V2_INSTALL_PHASE_5_SEARCH_DISCOVERY.md` | Search |
| 6 | `TWICELY_V2_INSTALL_PHASE_6_TRUST_POLICY_RATINGS.md` | Trust |
| 7 | `TWICELY_V2_INSTALL_PHASE_7_NOTIFICATIONS_PIPELINE.md` | Notifications |
| 8 | `TWICELY_V2_INSTALL_PHASE_8_ANALYTICS_METRICS.md` | Analytics |
| 9 | `TWICELY_V2_INSTALL_PHASE_9_FEATURE_FLAGS.md` | Feature Flags |
| 10 | `TWICELY_V2_INSTALL_PHASE_10_SYSTEM_HEALTH_SRE_MODULES_DOCTOR_UI.md` | System Health |

#### Platform Operations (Phases 11-20)
| Phase | File | Domain |
|-------|------|--------|
| 11 | `TWICELY_V2_INSTALL_PHASE_11_DATA_RETENTION_PRIVACY.md` | Privacy |
| 12 | `TWICELY_V2_INSTALL_PHASE_12_INTERNATIONALIZATION.md` | i18n |
| 13 | `TWICELY_V2_INSTALL_PHASE_13_SELLER_ONBOARDING_VERIFICATION.md` | Seller Onboarding |
| 14 | `TWICELY_V2_INSTALL_PHASE_14_RETURNS_DISPUTES_CASE_MGMT.md` | Returns/Disputes |
| 15 | `TWICELY_V2_INSTALL_PHASE_15_CORP_NAV_MENUS_SETTINGS_REGISTRY.md` | Corp Navigation |
| 16 | `TWICELY_V2_INSTALL_PHASE_16_BUYER_EXPERIENCE_REVIEWS.md` | Buyer Experience |
| 17 | `TWICELY_V2_INSTALL_PHASE_17_SEARCH_RANKING_PIPELINE.md` | Search Ranking |
| 18 | `TWICELY_V2_INSTALL_PHASE_18_FINANCE_RECON_REPORTING.md` | Finance Recon |
| 19 | `TWICELY_V2_INSTALL_PHASE_19_AUDIT_LOGS_OBSERVABILITY.md` | Audit Logs |
| 20 | `TWICELY_V2_INSTALL_PHASE_20_PRODUCTION_READINESS_CHECKLIST.md` | Prod Readiness |

#### Growth & Automation (Phases 21-28)
| Phase | File | Domain |
|-------|------|--------|
| 21 | `TWICELY_V2_INSTALL_PHASE_21_MESSAGING_NOTIFICATIONS.md` | Messaging |
| 22 | `TWICELY_V2_INSTALL_PHASE_22_PROMOTIONS_COUPONS.md` | Promotions |
| 23 | `TWICELY_V2_INSTALL_PHASE_23_SELLER_ANALYTICS.md` | Seller Analytics |
| 24 | `TWICELY_V2_INSTALL_PHASE_24_SUBSCRIPTIONS_BILLING_TIERS.md` | Subscriptions |
| 25 | `TWICELY_V2_INSTALL_PHASE_25_PROMOTIONS_AUTOMATION.md` | Promo Automation |
| 26 | `TWICELY_V2_INSTALL_PHASE_26_TRUST_PERFORMANCE_INSIGHTS.md` | Trust Insights |
| 27 | `TWICELY_V2_INSTALL_PHASE_27_MESSAGING_ENHANCEMENTS.md` | Messaging+ |
| 28 | `TWICELY_V2_INSTALL_PHASE_28_DISPUTES_AUTOMATION.md` | Disputes Auto |

#### Seller Hub & Advanced (Phases 29-39)
| Phase | File | Domain |
|-------|------|--------|
| 29 | `TWICELY_V2_INSTALL_PHASE_29_SELLER_HUB_EXPANDED.md` | Seller Hub |
| 30 | `TWICELY_V2_INSTALL_PHASE_30_CUSTOMER_SUPPORT_CONSOLE.md` | Support Console |
| 31 | `TWICELY_V2_INSTALL_PHASE_31_TAXES_COMPLIANCE.md` | Taxes |
| 32 | `TWICELY_V2_INSTALL_PHASE_32_IDENTITY_VERIFICATION_RISK.md` | Identity/Risk |
| 33 | `TWICELY_V2_INSTALL_PHASE_33_CHARGEBACKS_CLAIMS.md` | Chargebacks |
| 34 | `TWICELY_V2_INSTALL_PHASE_34_SHIPPING_LABELS.md` | Shipping Labels |
| 35 | `TWICELY_V2_INSTALL_PHASE_35_CATALOG_NORMALIZATION.md` | Catalog Norm |
| 36 | `TWICELY_V2_INSTALL_PHASE_36_PROMOTED_LISTINGS.md` | Promoted Listings |
| 37 | `TWICELY_V2_INSTALL_PHASE_37_SELLER_STANDARDS.md` | Seller Standards |
| 38 | `TWICELY_V2_INSTALL_PHASE_38_BUYER_PROTECTION.md` | Buyer Protection |
| 39 | `TWICELY_V2_INSTALL_PHASE_39_SEO_PUBLIC_BROWSE.md` | SEO/Public |

#### Enhancement Phases (40-44)
| Phase | File | Domain |
|-------|------|--------|
| 40 | `TWICELY_V2_INSTALL_PHASE_40_INTERNATIONAL_ENHANCED.md` | International |
| 41 | `TWICELY_V2_INSTALL_PHASE_41_VARIATIONS_COMPLETE.md` | Variations Core |
| 42 | `TWICELY_V2_INSTALL_PHASE_42_SELLER_EXPERIENCE_PLUS.md` | Seller Exp+ |
| 43 | `TWICELY_V2_INSTALL_PHASE_43_BUYER_EXPERIENCE_PLUS.md` | Buyer Exp+ |
| 44 | `TWICELY_V2_INSTALL_PHASE_44_LISTING_VARIATIONS.md` | Variations Library |

---

## File Count Summary

| Directory | Count | Purpose |
|-----------|-------|---------|
| Root | 2 | Navigation + AI guidelines |
| /canonicals/ | 20 | Domain specifications |
| /locked/ | 8 | Immutable behaviors |
| /governance/ | 7 | Meta + governance |
| /architecture/ | 3 | High-level structure |
| /health/ | 2 | Observability |
| /modules/ | 7 | Module system |
| /rbac/ | 2 | Access control |
| /install-phases/ | 45 | Build instructions (Phases 0-44) |
| **TOTAL** | **94** | Complete specification |

---

## Reading Order

For new team members:

1. **Start:** `/governance/TWICELY_MARKETPLACE_INDEX_CANONICAL.md`
2. **Then:** `/governance/TWICELY_V2_META_GOVERNANCE_CANONICAL.md`
3. **Then:** All files in `/locked/` (behavioral contracts)
4. **Then:** All files in `/canonicals/` (domain specs)
5. **Finally:** `/install-phases/` in order (0 → 44)

---

## Migration Script

To restructure from flat to nested:

```bash
#!/bin/bash
# Run from project root

cd rules

# Create directories
mkdir -p canonicals locked governance architecture health modules rbac install-phases

# Move canonicals (16 files)
mv TWICELY_LISTINGS_CATALOG_CANONICAL.md canonicals/
mv TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md canonicals/
mv TWICELY_ORDERS_FULFILLMENT_CANONICAL.md canonicals/
mv TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md canonicals/
mv TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md canonicals/
mv TWICELY_BUYER_EXPERIENCE_CANONICAL.md canonicals/
mv TWICELY_RATINGS_TRUST_CANONICAL.md canonicals/
mv TWICELY_TRUST_SAFETY_CANONICAL.md canonicals/
mv TWICELY_POLICY_LIBRARY_CANONICAL.md canonicals/
mv TWICELY_NOTIFICATIONS_CANONICAL.md canonicals/
mv TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md canonicals/
mv TWICELY_ANALYTICS_METRICS_CANONICAL.md canonicals/
mv TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md canonicals/
mv TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md canonicals/
mv TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md canonicals/
mv TWICELY_INTERNATIONALIZATION_CANONICAL.md canonicals/

# Move locked specs (8 files)
mv TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md locked/
mv TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md locked/
mv TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md locked/
mv TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md locked/
mv TWICELY_STRIPE_CONNECT_IMPLEMENTATION_LOCKED.md locked/
mv TWICELY_KERNEL_MODULE_ENFORCEMENT_LOCKED.md locked/
mv TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md locked/
mv TWICELY_USER_MODEL_LOCKED.md locked/

# Move governance (8 files)
mv TWICELY_V2_FREEZE_0_44_LOCKED.md governance/
mv TWICELY_V2_CORE_LOCK.md governance/
mv TWICELY_V2_META_GOVERNANCE_CANONICAL.md governance/
mv TWICELY_V2_OPERATIONAL_GLUE_CANONICAL.md governance/
mv TWICELY_V2_MASTER_DOCTOR_SPEC.md governance/
mv TWICELY_MARKETPLACE_INDEX_CANONICAL.md governance/
mv TWICELY_KERNEL_MODULES_SPEC.md governance/

# Move architecture (3 files)
mv TWICELY_CORP_ADMIN_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md architecture/
mv TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md architecture/
mv TWICELY_CORP_SELLER_BOUNDARY_RULES_CANONICAL.md architecture/

# Move health (2 files)
mv System-Health-Canonical-Spec-v1-provider-driven.md health/
mv Twicely-Studio-Health-Provider-Spec-v1.md health/

# Move modules (7 files)
mv Twicely-Module-Creation-Template-v1.md modules/
mv Twicely-Module-Linter-Spec-v1.md modules/
mv Twicely-Module-Installer-UI-Canonical-v1.md modules/
mv Twicely-Module-Runtime-Guards-Canonical-v1.md modules/
mv Twicely-AI-Module-Validation-Checklist-v1.md modules/
mv twicely-modules-integration-checklist.md modules/
mv Twicely-Studio-SelfInstall-and-Health-Master-Prompt.md modules/

# Move RBAC (1 file + symlink)
mv TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md rbac/
ln -s ../locked/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md rbac/

# Move install phases (45 files - Phases 0-44)
mv TWICELY_V2_INSTALL_PHASE_*.md install-phases/

echo "Migration complete! Verify with: find . -type f -name '*.md' | wc -l"
# Expected: 94 files total
```

---

## Cross-Reference Map

| When working on... | Read these files |
|--------------------|------------------|
| Listings | `/canonicals/TWICELY_LISTINGS_CATALOG_CANONICAL.md`, `/install-phases/PHASE_2` |
| Search | `/canonicals/TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md`, `/canonicals/TWICELY_RATINGS_TRUST_CANONICAL.md`, `/install-phases/PHASE_5`, `/install-phases/PHASE_17` |
| Orders | `/canonicals/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`, `/locked/TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`, `/install-phases/PHASE_3` |
| Payments | `/locked/TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`, `/locked/TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`, `/install-phases/PHASE_4` |
| Trust | `/canonicals/TWICELY_RATINGS_TRUST_CANONICAL.md`, `/canonicals/TWICELY_TRUST_SAFETY_CANONICAL.md`, `/install-phases/PHASE_6` |
| Corp Admin | `/architecture/TWICELY_CORP_ADMIN_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md`, `/architecture/TWICELY_CORP_SELLER_BOUNDARY_RULES_CANONICAL.md` |
| Seller Hub | `/architecture/TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md`, `/install-phases/PHASE_29` |
| Health | `/health/System-Health-Canonical-Spec-v1-provider-driven.md`, `/locked/TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md`, `/install-phases/PHASE_10` |

---

## Versioning Convention

| File Type | Version Format | Location |
|-----------|---------------|----------|
| Canonicals | `v1`, `v1.1`, `v2` | In file header |
| Locked specs | `LOCKED` | In filename suffix |
| Install phases | Phase number | In filename |
| Governance | Date or version | In file header |

---

## File Naming Rules

1. **Canonicals:** `TWICELY_{DOMAIN}_CANONICAL.md`
2. **Locked specs:** `TWICELY_{DOMAIN}_LOCKED.md`
3. **Install phases:** `TWICELY_V2_INSTALL_PHASE_{N}_{NAME}.md`
4. **Module specs:** `Twicely-{Name}-Spec-v{N}.md`
5. **Architecture:** `TWICELY_{AREA}_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md`

---

## New Features (v2.1)

### Price Intelligence (Phase 43)
- 📈 Price history tracking with visual graphs
- 🏷️ Deal badges (Great Deal, Good Deal, Price Drop, Lowest Ever)
- 📊 Market price comparison
- 🔔 Smart price alerts (multiple trigger types)
- 📁 Category alerts for new listings
- 📧 Daily/weekly alert digests

### Buyer Protection Plus (Phase 38)
- 🛡️ Category-specific coverage limits
- ⭐ Seller protection scores (transparency)
- ⚖️ Seller appeal rights
- 📋 Dispute timeline tracking
- 📄 Public /protection page
- ✅ Protection badges on listings

### Bundle Builder (Phase 3)
- 📦 Seller-created bundles with discounts
- 💬 "Make Me a Deal" buyer negotiation
- 🎯 Smart cart prompts (free shipping, bundle suggestions)
- 🤝 Counter-offer workflow
- 📊 Bundle analytics for sellers

---

## "Better Than eBay" Comparison

| Feature | eBay | Twicely |
|---------|------|---------|
| Price history | Limited | ✅ Full history with graphs |
| Deal badges | No | ✅ Market-based deal detection |
| Seller bundles | Limited | ✅ Full bundle creation |
| Buyer negotiation | Offers only | ✅ "Make Me a Deal" multi-item |
| Smart cart prompts | No | ✅ Free shipping + bundle prompts |
| Seller protection scores | No | ✅ Visible score with tiers |
| Seller appeals | Limited | ✅ Full appeal workflow |
| Category coverage limits | No | ✅ Transparent per-category |
| Alert digests | Basic | ✅ Rich daily/weekly digests |

---

## Final Notes

- **Never delete** files from `/locked/` without governance approval
- **Always update** `/governance/TWICELY_MARKETPLACE_INDEX_CANONICAL.md` when adding new canonicals
- **Phase order** (0-44) must be followed during installation
- **Symlinks** are acceptable for cross-references
- **README.md** in each directory should list its contents
