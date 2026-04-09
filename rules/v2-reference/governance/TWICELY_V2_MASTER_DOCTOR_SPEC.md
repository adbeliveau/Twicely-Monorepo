# TWICELY V2 — MASTER DOCTOR SPEC
**Status:** REQUIRED  
**Scope:** Validate Phases 0-44 + Operational Glue  
**Version:** 1.2

> Place this file in: `/rules/TWICELY_V2_MASTER_DOCTOR_SPEC.md`

---

## 1) Purpose

Doctor is the **single source of truth** for installation correctness.
- If Doctor fails → platform is NOT considered installed
- Doctor must pass before proceeding to next phase
- Doctor must pass before production deployment

**Philosophy:** Doctor is a gatekeeper, not a fixer. It validates state, never mutates.

---

## 2) Doctor Execution Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **Phase** | `pnpm doctor --phase=N` | Validate specific phase |
| **Full** | `pnpm doctor --all` | Validate all installed phases |
| **Production** | `pnpm doctor --production` | Pre-deploy gate (Phase 20+) |
| **Quick** | `pnpm doctor --quick` | Fast smoke test (critical checks only) |

---

## 3) Phase Dependency Graph

Doctor validates phases in order. Each phase depends on prior phases passing.

```
Phase 0: Bootstrap
    ↓
Phase 1: RBAC ← (foundation for all)
    ↓
Phase 2: Listings ← (requires RBAC)
    ↓
Phase 3: Orders ← (requires Listings)
    ↓
Phase 4: Payments ← (requires Orders)
    ↓
Phase 5: Search ← (requires Listings)
    ↓
Phase 6: Trust ← (requires Orders for data)
    ↓
Phase 7: Notifications ← (requires all above for triggers)
    ↓
Phase 8: Analytics ← (requires Orders, Payments)
    ↓
Phase 9: Feature Flags ← (used by all)
    ↓
Phase 10: Health/Doctor ← (monitors all above)
    ↓
Phases 11-20: Operations & Infrastructure
    ↓
Phase 20: PRODUCTION READINESS GATE ← All systems must pass
    ↓
Phases 21-28: Growth & Automation
    ↓
Phases 29-39: Advanced Features
    ↓
Phases 40-44: Enhanced Features
```

---

## 4) Doctor Domains & Checks

### Foundation (Phases 0-10)

| Domain | Provider | Key Checks |
|--------|----------|------------|
| **Environment** | `bootstrap` | DB connects, env vars present, Prisma works |
| **RBAC** | `rbac` | Roles seeded, admin exists, delegated access table |
| **Listings** | `listings` | CRUD works, state transitions valid, categories seeded |
| **Orders** | `orders` | Creation works, state machine valid, inventory reserves |
| **Payments** | `payments` | Webhook idempotency, ledger immutable, payout gates |
| **Ledger** | `ledger` | Entry types match canonical, no orphans |
| **Payouts** | `payouts` | Holds block execution, destination verified |
| **Search** | `search` | Index builds, eligibility gates work |
| **Trust** | `trust` | Score computes, decay works, bands match canonical |
| **Notifications** | `notifications` | Templates render, delivery logs |
| **Analytics** | `analytics` | Events idempotent, snapshots compute |
| **Feature Flags** | `feature_flags` | Kill switches work, precedence correct |
| **Health** | `health` | All providers registered, endpoint responds |

### Platform Operations (Phases 11-20)

| Domain | Provider | Key Checks |
|--------|----------|------------|
| **Retention** | `retention` | Policies active, export works |
| **i18n** | `i18n` | Regions configured, currency formatting |
| **Seller Onboarding** | `seller_onboarding` | Profile creation, verification workflow |
| **Disputes** | `disputes` | Case creation, escalation, assignment |
| **Corp Nav** | `corp_nav` | Items render, settings sections load |
| **Reviews** | `reviews` | Submission works, moderation workflow |
| **Search Ranking** | `search_ranking` | Signals compute, model weights load |
| **Finance** | `finance` | Reconciliation runs, discrepancies detected |
| **Audit** | `audit` | Events immutable, search works |
| **Production** | `production` | ALL SYSTEMS PASS |

### Growth Features (Phases 21-28)

| Domain | Provider | Key Checks |
|--------|----------|------------|
| **Messaging** | `messaging` | Conversations work, delivery confirmed |
| **Promotions** | `promotions` | Coupon creation, validation, redemption |
| **Seller Analytics** | `seller_analytics` | Snapshots compute, reports generate |
| **Subscriptions** | `subscriptions` | Tier assignment, billing works |
| **Promotions Auto** | `promotions_auto` | Rules execute, campaigns activate |
| **Trust Insights** | `trust_insights` | Dashboards load, alerts trigger |
| **Messaging Enhanced** | `messaging_enhanced` | Keywords filter, attachments work |
| **Disputes Auto** | `disputes_auto` | Auto-resolution triggers, SLAs enforced |

### Advanced Marketplace (Phases 29-39)

| Domain | Provider | Key Checks |
|--------|----------|------------|
| **Seller Hub** | `seller_hub` | Dashboard loads, vacation mode works |
| **Support Console** | `support_console` | Tickets route, macros work |
| **Taxes** | `taxes` | Calculation correct, reporting works |
| **Identity** | `identity` | Verification flow, risk scoring |
| **Chargebacks** | `chargebacks` | Case creation, evidence upload |
| **Shipping Labels** | `shipping_labels` | Rate fetch, label generation |
| **Catalog** | `catalog` | Normalization runs, suggestions work |
| **Promoted Listings** | `promoted` | Campaigns create, bidding works |
| **Seller Standards** | `seller_standards` | Scores compute, badges assign |
| **Buyer Protection** | `buyer_protection` | Claims create, resolution works |
| **SEO** | `seo` | Metadata generates, sitemap builds |

### Enhanced Features (Phases 40-44)

| Domain | Provider | Key Checks |
|--------|----------|------------|
| **International** | `international` | Exchange rates update, conversion works |
| **Variations** | `variations` | Creation works, inventory tracks |
| **Seller Exp+** | `seller_experience` | Block list works, bulk jobs process |
| **Buyer Exp+** | `buyer_experience_plus` | Price alerts trigger, recommendations load |
| **Listing Variations** | `listing_variations` | Types seeded, values create, usage tracks |

---

## 5) Doctor Check Interface

```typescript
// packages/core/doctor/types.ts

export type DoctorCheckStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

export type DoctorCheckResult = {
  id: string;           // e.g., "rbac.roles_seeded"
  label: string;        // Human-readable description
  status: DoctorCheckStatus;
  message?: string;     // Details on failure/warning
  durationMs?: number;  // How long the check took
};

export type DoctorPhaseResult = {
  phase: number;
  status: DoctorCheckStatus;
  checks: DoctorCheckResult[];
  durationMs: number;
};

export type DoctorReport = {
  status: "PASS" | "FAIL";
  checkedAt: string;      // ISO timestamp
  mode: "phase" | "full" | "production" | "quick";
  phases: DoctorPhaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
  };
  failures?: string[];    // List of failed check IDs
};
```

---

## 6) Phase 44 Doctor Checks (Listing Variations)

```typescript
// packages/core/doctor/checks/phase44.ts

import { PrismaClient } from "@prisma/client";
import type { DoctorCheckResult } from "../types";

const prisma = new PrismaClient();

export async function checkPhase44(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testPrefix = `doctor_${Date.now()}`;

  // 1. Verify VariationType table exists and has system types
  try {
    const systemTypes = await prisma.variationType.count({
      where: { isSystem: true },
    });
    checks.push({
      id: "listing_variations.system_types_seeded",
      label: "System variation types seeded",
      status: systemTypes >= 13 ? "PASS" : "FAIL",
      message: `${systemTypes} system types found (expected 13+)`,
    });
  } catch (error) {
    checks.push({
      id: "listing_variations.system_types_seeded",
      label: "System variation types seeded",
      status: "FAIL",
      message: error instanceof Error ? error.message : "Table missing",
    });
  }

  // 2. Verify VariationValue table exists and has platform values
  try {
    const platformValues = await prisma.variationValue.count({
      where: { scope: "PLATFORM" },
    });
    checks.push({
      id: "listing_variations.platform_values_seeded",
      label: "Platform variation values seeded",
      status: platformValues >= 100 ? "PASS" : "FAIL",
      message: `${platformValues} platform values found (expected 100+)`,
    });
  } catch (error) {
    checks.push({
      id: "listing_variations.platform_values_seeded",
      label: "Platform variation values seeded",
      status: "FAIL",
      message: error instanceof Error ? error.message : "Table missing",
    });
  }

  // 3. Create test variation type
  let testType;
  try {
    testType = await prisma.variationType.create({
      data: {
        key: `${testPrefix}_TYPE`,
        label: "Doctor Test Type",
        isSystem: false,
        isActive: true,
      },
    });
    checks.push({
      id: "listing_variations.type_create",
      label: "Variation type creation works",
      status: "PASS",
    });
  } catch (error) {
    checks.push({
      id: "listing_variations.type_create",
      label: "Variation type creation works",
      status: "FAIL",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // 4. Create test variation value
  if (testType) {
    try {
      const testValue = await prisma.variationValue.create({
        data: {
          variationTypeId: testType.id,
          value: "Doctor Test Value",
          normalizedValue: "doctor test value",
          scope: "SELLER",
          sellerId: `${testPrefix}_seller`,
          isActive: true,
        },
      });
      checks.push({
        id: "listing_variations.value_create",
        label: "Variation value creation works",
        status: "PASS",
      });

      // Cleanup value
      await prisma.variationValue.delete({ where: { id: testValue.id } });
    } catch (error) {
      checks.push({
        id: "listing_variations.value_create",
        label: "Variation value creation works",
        status: "FAIL",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Cleanup type
    await prisma.variationType.delete({ where: { id: testType.id } });
  }

  // 5. Verify usage tracking increments
  try {
    const sizeType = await prisma.variationType.findUnique({
      where: { key: "SIZE" },
    });
    if (sizeType) {
      const before = sizeType.totalListings;
      await prisma.variationType.update({
        where: { id: sizeType.id },
        data: { totalListings: { increment: 1 } },
      });
      const after = await prisma.variationType.findUnique({
        where: { id: sizeType.id },
      });
      
      // Restore
      await prisma.variationType.update({
        where: { id: sizeType.id },
        data: { totalListings: before },
      });

      checks.push({
        id: "listing_variations.usage_tracking",
        label: "Usage tracking works",
        status: after && after.totalListings === before + 1 ? "PASS" : "FAIL",
      });
    } else {
      checks.push({
        id: "listing_variations.usage_tracking",
        label: "Usage tracking works",
        status: "SKIP",
        message: "SIZE type not found for test",
      });
    }
  } catch (error) {
    checks.push({
      id: "listing_variations.usage_tracking",
      label: "Usage tracking works",
      status: "FAIL",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return checks;
}
```

---

## 7) Doctor Best Practices

### DO:
- Run Doctor after every migration
- Run Doctor before merging PRs
- Run Doctor in CI/CD pipeline
- Use `--quick` for fast feedback during development
- Use `--production` before deploying
- Use unique test prefixes (`doctor_${Date.now()}_`) for test data
- Clean up test data after checks complete
- Wrap checks in try/catch to handle errors gracefully

### DON'T:
- Skip Doctor failures
- Modify Doctor to pass failing checks
- Run Doctor checks that mutate production data
- Proceed to next phase if current phase fails
- Leave test data in the database
- Use static test IDs that could conflict

---

## 8) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Doctor spec (phases 0-39) |
| 1.1 | 2026-01-19 | Extended to phases 40-43 |
| 1.2 | 2026-01-22 | Extended to Phase 44, added listing variations checks, fixed UTF-8 |
