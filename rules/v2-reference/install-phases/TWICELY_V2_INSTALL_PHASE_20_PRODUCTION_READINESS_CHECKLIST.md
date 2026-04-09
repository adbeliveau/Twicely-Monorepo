# TWICELY V2 - Install Phase 20: Production Readiness Checklist
**Status:** LOCKED (v1.0)  
**Backend-first:** Invariants  ->  Gates  ->  Kill switches  ->  Health  ->  Doctor  ->  Go/No-Go  
**Canonicals:** TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md, System-Health-Canonical-Spec-v1-provider-driven.md

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_20_PRODUCTION_READINESS_CHECKLIST.md`  
> Prereq: Phases 0-19 complete and Doctor green for each phase.

---

## 0) What this phase does

This phase **does not add features**. It:
- Freezes core invariants
- Enforces launch gates
- Verifies kill switches
- Runs full-system Doctor
- Produces a **single Go / No-Go decision**

No bypasses. No partial launches.

---

## 1) Prisma Schema

```prisma
model KillSwitch {
  id              String    @id @default(cuid())
  key             String    @unique
  isEnabled       Boolean   @default(false)
  label           String
  description     String?
  affectedSystems String[]  @default([])
  enabledAt       DateTime?
  enabledByStaffId String?
  disabledAt      DateTime?
  reason          String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([isEnabled])
}

model LaunchGate {
  id              String    @id @default(cuid())
  name            String    @unique
  status          String    @default("PENDING")
  category        String
  description     String
  checkType       String
  lastCheckAt     DateTime?
  lastResult      Json?
  errorMessage    String?
  isRequired      Boolean   @default(true)
  blocksLaunch    Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status, category])
}

model LaunchDecision {
  id              String    @id @default(cuid())
  decision        String    // GO|NO_GO|PENDING
  environment     String
  version         String
  totalChecks     Int
  passedChecks    Int
  failedChecks    Int
  skippedChecks   Int
  failedGates     String[]  @default([])
  resultsJson     Json      @default("{}")
  decidedByStaffId String?
  decidedAt       DateTime  @default(now())
  notes           String?
  createdAt       DateTime  @default(now())

  @@index([environment, createdAt])
}

model ProductionInvariant {
  id              String    @id @default(cuid())
  key             String    @unique
  category        String
  name            String
  description     String
  lastCheckAt     DateTime?
  lastCheckPassed Boolean?
  lastErrorMessage String?
  isCritical      Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## 2) Kill Switch Service

Create `packages/core/safety/killswitch.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export type KillSwitchKey = "CHECKOUT_DISABLED" | "PAYOUTS_DISABLED" | "SEARCH_DISABLED" | "WEBHOOKS_DISABLED" | "NEW_REGISTRATIONS_DISABLED";

const cache = new Map<KillSwitchKey, boolean>();

export async function isKillSwitchEnabled(key: KillSwitchKey): Promise<boolean> {
  if (cache.has(key)) return cache.get(key)!;
  const ks = await prisma.killSwitch.findUnique({ where: { key } });
  const enabled = ks?.isEnabled ?? false;
  cache.set(key, enabled);
  return enabled;
}

export async function enableKillSwitch(key: KillSwitchKey, staffId: string, reason?: string): Promise<void> {
  await prisma.killSwitch.upsert({
    where: { key },
    update: { isEnabled: true, enabledAt: new Date(), enabledByStaffId: staffId, reason },
    create: { key, label: key, isEnabled: true, enabledAt: new Date(), enabledByStaffId: staffId, reason },
  });
  cache.set(key, true);
  await prisma.auditEvent.create({
    data: { actorUserId: staffId, action: "killswitch.enable", entityType: "KillSwitch", entityId: key, metaJson: { reason } },
  });
}

export async function disableKillSwitch(key: KillSwitchKey, staffId: string, reason?: string): Promise<void> {
  await prisma.killSwitch.update({ where: { key }, data: { isEnabled: false, disabledAt: new Date(), reason } });
  cache.set(key, false);
  await prisma.auditEvent.create({
    data: { actorUserId: staffId, action: "killswitch.disable", entityType: "KillSwitch", entityId: key, metaJson: { reason } },
  });
}

export async function assertNotKilled(key: KillSwitchKey): Promise<void> {
  if (await isKillSwitchEnabled(key)) throw new Error(`SYSTEM_DISABLED:${key}`);
}

export async function getAllKillSwitches() {
  return prisma.killSwitch.findMany({ orderBy: { key: "asc" } });
}
```

---

## 3) Production Invariants

Create `packages/core/safety/invariants.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export type InvariantCheck = {
  key: string;
  name: string;
  category: string;
  check: () => Promise<{ passed: boolean; message: string }>;
  isCritical: boolean;
};

export const PRODUCTION_INVARIANTS: InvariantCheck[] = [
  {
    key: "commerce.one_payout_per_order",
    name: "One payout per order",
    category: "commerce",
    isCritical: true,
    check: async () => {
      const dups = await prisma.$queryRaw`SELECT "orderId" FROM "Payout" WHERE status='COMPLETED' GROUP BY "orderId" HAVING COUNT(*)>1` as any[];
      return { passed: dups.length === 0, message: dups.length === 0 ? "OK" : `${dups.length} duplicates` };
    },
  },
  {
    key: "commerce.one_review_per_order",
    name: "One review per order",
    category: "commerce",
    isCritical: true,
    check: async () => {
      const dups = await prisma.$queryRaw`SELECT "orderId" FROM "Review" GROUP BY "orderId" HAVING COUNT(*)>1` as any[];
      return { passed: dups.length === 0, message: dups.length === 0 ? "OK" : `${dups.length} duplicates` };
    },
  },
  {
    key: "money.ledger_keys_unique",
    name: "Ledger keys unique",
    category: "finance",
    isCritical: true,
    check: async () => {
      const dups = await prisma.$queryRaw`SELECT "ledgerKey" FROM "LedgerEntry" GROUP BY "ledgerKey" HAVING COUNT(*)>1` as any[];
      return { passed: dups.length === 0, message: dups.length === 0 ? "OK" : `${dups.length} duplicates` };
    },
  },
  {
    key: "trust.events_idempotent",
    name: "Trust events idempotent",
    category: "trust",
    isCritical: true,
    check: async () => {
      const dups = await prisma.$queryRaw`SELECT "eventKey" FROM "TrustEvent" WHERE "eventKey" IS NOT NULL GROUP BY "eventKey" HAVING COUNT(*)>1` as any[];
      return { passed: dups.length === 0, message: dups.length === 0 ? "OK" : `${dups.length} duplicates` };
    },
  },
  {
    key: "trust.restricted_not_searchable",
    name: "Restricted sellers not in search",
    category: "trust",
    isCritical: true,
    check: async () => {
      const count = await prisma.searchIndex.count({ where: { isEligible: true, sellerTrustScore: { lt: 40 } } });
      return { passed: count === 0, message: count === 0 ? "OK" : `${count} in search` };
    },
  },
];

export async function runInvariantChecks() {
  const results = [];
  for (const inv of PRODUCTION_INVARIANTS) {
    try {
      const r = await inv.check();
      results.push({ key: inv.key, name: inv.name, passed: r.passed, message: r.message, isCritical: inv.isCritical });
    } catch (e) {
      results.push({ key: inv.key, name: inv.name, passed: false, message: (e as Error).message, isCritical: inv.isCritical });
    }
  }
  return { passed: results.filter((r) => r.isCritical && !r.passed).length === 0, results };
}
```

---

## 4) Launch Gates

Create `packages/core/safety/launchGates.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { runInvariantChecks } from "./invariants";

const prisma = new PrismaClient();

export async function runLaunchGates(staffId?: string) {
  const results = [];
  const failedGates: string[] = [];

  // Run invariants
  const inv = await runInvariantChecks();
  for (const r of inv.results) {
    results.push({ gate: r.key, status: r.passed ? "PASSED" : "FAILED", message: r.message });
    if (!r.passed && r.isCritical) failedGates.push(r.key);
  }

  // Check kill switches (must be OFF for launch)
  const active = await prisma.killSwitch.findMany({ where: { isEnabled: true } });
  for (const ks of active) {
    results.push({ gate: `killswitch.${ks.key}`, status: "FAILED", message: "Active kill switch" });
    failedGates.push(`killswitch.${ks.key}`);
  }

  const decision = failedGates.length === 0 ? "GO" : "NO_GO";

  await prisma.launchDecision.create({
    data: {
      decision,
      environment: process.env.NODE_ENV ?? "dev",
      version: process.env.APP_VERSION ?? "unknown",
      totalChecks: results.length,
      passedChecks: results.filter((r) => r.status === "PASSED").length,
      failedChecks: results.filter((r) => r.status === "FAILED").length,
      skippedChecks: 0,
      failedGates,
      resultsJson: results,
      decidedByStaffId: staffId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: staffId ?? "system",
      action: decision === "GO" ? "launch.go" : "launch.no_go",
      entityType: "LaunchDecision",
      metaJson: { decision, failedGates },
    },
  });

  return { decision, totalChecks: results.length, passedChecks: results.filter((r) => r.status === "PASSED").length, failedChecks: failedGates.length, failedGates, results };
}
```

---

## 5) API Endpoints

### Kill Switches

`apps/web/app/api/platform/killswitches/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getAllKillSwitches } from "@/packages/core/safety/killswitch";

export async function GET() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "system.killswitch.view");
  return NextResponse.json({ switches: await getAllKillSwitches() });
}
```

### Run Launch Check

`apps/web/app/api/platform/launch/run/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { runLaunchGates } from "@/packages/core/safety/launchGates";

export async function POST() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "system.launch.run");
  return NextResponse.json(await runLaunchGates(ctx.actorUserId));
}
```

---

## 6) Health Provider

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";
import { runInvariantChecks } from "@/packages/core/safety/invariants";

const prisma = new PrismaClient();

export const productionReadinessHealthProvider: HealthProvider = {
  id: "production_readiness",
  label: "Production Readiness",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Kill switches
    const active = await prisma.killSwitch.count({ where: { isEnabled: true } });
    checks.push({ id: "killswitches", label: "No active kill switches", status: active === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN, message: `${active} active` });
    if (active > 0) status = HEALTH_STATUS.WARN;

    // Invariants
    const inv = await runInvariantChecks();
    const failed = inv.results.filter((r) => r.isCritical && !r.passed);
    checks.push({ id: "invariants", label: "Invariants hold", status: failed.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL, message: `${failed.length} failed` });
    if (failed.length > 0) status = HEALTH_STATUS.FAIL;

    // Last decision
    const last = await prisma.launchDecision.findFirst({ orderBy: { createdAt: "desc" } });
    checks.push({ id: "launch", label: "Launch decision", status: last?.decision === "GO" ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN, message: last?.decision ?? "None" });

    return { providerId: "production_readiness", status, summary: status === HEALTH_STATUS.PASS ? "Ready" : "Not ready", providerVersion: "1.0.0", ranAt: new Date().toISOString(), runType: ctx.runType, checks };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 7) Doctor Checks

```ts
async function checkProductionReadiness() {
  const checks = [];

  // Kill switch toggle test
  await enableKillSwitch("CHECKOUT_DISABLED", "doctor", "Test");
  const blocked = await isKillSwitchEnabled("CHECKOUT_DISABLED");
  checks.push({ key: "killswitch.blocks", ok: blocked, details: blocked ? "Blocks" : "NOT blocking" });

  await disableKillSwitch("CHECKOUT_DISABLED", "doctor", "Test done");
  const recovered = !(await isKillSwitchEnabled("CHECKOUT_DISABLED"));
  checks.push({ key: "killswitch.recovers", ok: recovered, details: recovered ? "Recovers" : "NOT recovering" });

  // Invariants
  const inv = await runInvariantChecks();
  checks.push({ key: "invariants.pass", ok: inv.passed, details: `${inv.results.filter((r) => r.passed).length}/${inv.results.length} passed` });

  return checks;
}
```

---

## 8) Phase 20 Completion Criteria

- All health providers return PASS
- All production invariants hold
- Kill switches verified (enable  ->  block  ->  disable  ->  recover)
- Launch gates all PASSED
- Launch decision persisted with GO status
- Core marketplace ready for production traffic
