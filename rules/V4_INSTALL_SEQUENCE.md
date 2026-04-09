# V4 Install Sequence

**Status:** DRAFT (V4)
**Purpose:** Master execution order for V4 install phases. Each phase is small, tight, and atomic.
**Starting point:** V3 codebase (v4 branch from master commit f5b801b).

---

## Prerequisite: V3 Baseline

Before any V4 phase, verify V3 baseline:
- TypeScript: 24/24 packages pass
- Tests: 9,838+ tests green
- Audit: 11/11 streams clean
- Doctor: all V3 checks pass

---

## Phase Execution Order

| Phase | Domain | Canonical | Prereq | Package(s) | Est. Files |
|-------|--------|-----------|--------|------------|------------|
| V4-01 | Product Variations | 03_VARIATIONS_CATALOG | V3 baseline | commerce (extend) | ~20 |
| V4-02 | Platform Analytics | 15_PLATFORM_ANALYTICS | V3 baseline | analytics (new) | ~15 |
| V4-03 | Seller Analytics | 14_SELLER_ANALYTICS | V4-02 | analytics (extend) | ~10 |
| V4-04 | SEO System | 21_SEO_DISCOVERY | V3 baseline | web (metadata) | ~15 |
| V4-05 | Shipping Labels | 06_SHIPPING_LABELS | V3 baseline | shipping (new) | ~16 |
| V4-06 | Promotions Automation | 13_PROMOTIONS_CAMPAIGNS | V3 baseline | commerce (extend) | ~15 |
| V4-07 | Finance Reconciliation | 31_FINANCE_RECONCILIATION | V3 baseline | finance (extend) | ~12 |
| V4-08 | Disputes Automation | 32_DISPUTES_AUTOMATION | V3 baseline | commerce (extend) | ~12 |
| V4-09 | Risk/Fraud Engine | 26_RISK_FRAUD | V3 baseline | risk (new) | ~15 |
| V4-10 | Catalog Normalization | 03_VARIATIONS_CATALOG | V4-01 | commerce (extend) | ~10 |
| V4-11 | Health Framework | 27_SYSTEM_HEALTH | V3 baseline | jobs (extend) | ~12 |
| V4-12 | Tax Calculation | 29_TAXES_COMPLIANCE | V4-05 | tax (new) | ~12 |
| V4-13 | Buyer Experience Plus | 33_BUYER_EXPERIENCE_PLUS | V3 baseline | commerce (extend) | ~15 |
| V4-14 | Seller Experience Plus | 34_SELLER_EXPERIENCE_PLUS | V3 baseline | commerce (extend) | ~15 |
| V4-15 | Messaging Safety | 35_MESSAGING_SAFETY | V3 baseline | notifications (extend) | ~10 |
| V4-16 | AI Module | 30_AI_MODULE | V3 baseline | ai (new) | ~20 |
| V4-17 | Search AI | 07_SEARCH_AI_DISCOVERY | V4-16 | search (extend) + ai | ~12 |
| V4-18 | Production Hardening | 36_PRODUCTION_HARDENING | ALL above | cross-cutting | ~15 |
| V4-19 | KB Page Builder | 37_KB_PAGE_BUILDER | V3 baseline | web + helpdesk | ~12 |

**Total: 19 phases, ~250 new files**

---

## Parallel Execution Groups

Phases with no dependencies on each other can run in parallel:

### Wave 1 (V3 baseline only — run simultaneously)
- V4-01: Variations
- V4-02: Platform Analytics
- V4-04: SEO
- V4-05: Shipping Labels
- V4-06: Promotions
- V4-07: Finance Recon
- V4-08: Disputes Automation
- V4-09: Risk Engine
- V4-11: Health Framework
- V4-13: Buyer Experience Plus
- V4-14: Seller Experience Plus
- V4-15: Messaging Safety
- V4-16: AI Module
- V4-19: KB Page Builder

### Wave 2 (depends on Wave 1)
- V4-03: Seller Analytics (needs V4-02)
- V4-10: Catalog Normalization (needs V4-01)
- V4-12: Tax Calculation (needs V4-05)
- V4-17: Search AI (needs V4-16)

### Wave 3 (depends on all)
- V4-18: Production Hardening (final integration)

---

## Completion Criteria

Each phase is complete when:
1. All files from install phase created
2. Schema migrations generated (not applied)
3. Server actions + queries implemented
4. UI pages rendered correctly
5. Tests written and passing
6. Doctor checks registered and passing
7. Platform settings seeded
8. CASL abilities registered
9. TypeScript compiles (zero errors)
10. Test baseline maintained or increased

---

## V4 Complete When

- All 19 phases installed and verified
- TypeScript: 24+ packages pass (new packages added)
- Tests: 9,838 + new tests (target: 11,000+)
- Audit: all streams clean (V3 + V4 agents)
- Doctor: all checks pass
- No V3 regressions
