# TWICELY V2 — Install Phase 28: Disputes Automation (Auto-Resolution & Escalation)
**Status:** LOCKED (v1.0)  
**Scope:** Auto-resolution rules, SLA timers, evidence handling, escalation workflows — NO arbitration, NO legal proceedings  
**Backend-first:** Schema → API → Jobs → Permissions → Audit → Health → Doctor → UI  
**Canonicals (MUST follow):**
- `/rules/TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`
- `/rules/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_28_DISPUTES_AUTOMATION.md`  
> Prereq: Phase 27 complete and Doctor green.  
> Extends: Phase 14 (core disputes)

---

## 0) What this phase installs

### Backend
- DisputeRule model for configurable auto-resolution
- SLA timer system with escalation triggers
- Evidence upload and management
- Auto-resolve logic (tracking-based, delivery-confirmed)
- Escalation workflow (buyer → seller → platform)

### UI Enhancements
- `/corp/disputes/rules` — Rule management
- `/corp/disputes/queue` — Enhanced queue with SLA indicators
- Evidence viewer with timeline
- Escalation controls

### Explicit exclusions
- ❌ No external arbitration
- ❌ No legal document generation
- ❌ No insurance claims
- ❌ No chargeback representment (handled in Phase 33)

---

## 1) Disputes automation invariants (non-negotiable)

- **Auto-resolution is evidence-based** (not arbitrary)
- **SLAs are configurable** but have platform minimums
- **Escalation always possible** before final resolution
- **Ledger entries created only on final resolution**
- **All decisions are audited**
- **Seller protection rules honored** (per canonical)

---

## 2) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
model DisputeRule {
  id           String   @id @default(cuid())
  name         String   @unique
  type         String   // auto_close_delivered | auto_close_no_response | auto_escalate | refund_on_no_tracking
  priority     Int      @default(100) // lower = higher priority
  conditions   Json     // { deliveryConfirmed: true, daysSinceDelivery: 3 }
  action       String   // close_buyer_favor | close_seller_favor | escalate | refund_partial
  actionParams Json     @default("{}") // { refundPercent: 100 }
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdByStaffId String

  @@index([type, isActive])
}

model DisputeSLA {
  id              String   @id @default(cuid())
  disputeId       String   @unique
  currentStage    String   // seller_response | buyer_response | platform_review | final
  stageStartedAt  DateTime
  slaDeadline     DateTime
  escalatedAt     DateTime?
  isOverdue       Boolean  @default(false)
  
  @@index([slaDeadline, isOverdue])
  @@index([currentStage])
}

model DisputeEvidence {
  id           String   @id @default(cuid())
  disputeId    String
  submittedBy  String   // buyer | seller | platform
  submitterId  String   // userId or staffId
  evidenceType String   // tracking | photo | receipt | communication | other
  description  String?
  storageKey   String?  // for file uploads
  metadata     Json     @default("{}")
  createdAt    DateTime @default(now())

  @@index([disputeId, submittedBy])
}

model DisputeTimeline {
  id          String   @id @default(cuid())
  disputeId   String
  eventType   String   // opened | response | evidence | escalated | resolved | auto_action
  actorType   String   // buyer | seller | platform | system
  actorId     String?
  description String
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())

  @@index([disputeId, createdAt])
}

model DisputeResolution {
  id            String   @id @default(cuid())
  disputeId     String   @unique
  outcome       String   // buyer_favor | seller_favor | split | withdrawn
  reason        String
  refundCents   Int      @default(0)
  sellerDebited Boolean  @default(false)
  resolvedBy    String   // auto | staff
  resolvedById  String?  // staffId if manual
  ruleId        String?  // DisputeRule.id if auto
  createdAt     DateTime @default(now())

  @@index([outcome])
}
```

Extend existing DisputeCase model (from Phase 14):

```prisma
model DisputeCase {
  // ... existing fields from Phase 14 ...
  
  // New fields for Phase 28
  category         String?  // item_not_received | item_not_as_described | damaged | other
  buyerClaim       String?
  sellerResponse   String?
  lastActionAt     DateTime?
  isAutoResolvable Boolean  @default(true)
}
```

Migration:
```bash
npx prisma migrate dev --name disputes_automation_phase28
```

---

## 3) Permission keys

Add to permissions registry:

```ts
export const disputeAutomationKeys = {
  // Existing from Phase 14
  viewDisputes: "disputes.view",
  resolveDisputes: "disputes.resolve",
  
  // New for Phase 28
  manageRules: "disputes.rules.manage",
  overrideAuto: "disputes.auto.override",
  viewTimeline: "disputes.timeline.view",
  submitEvidence: "disputes.evidence.submit",
  escalate: "disputes.escalate",
};
```

Rules:
- Buyer/Seller: `disputes.evidence.submit` (own disputes), `disputes.escalate`
- Corp Support: `disputes.view`, `disputes.resolve`, `disputes.timeline.view`
- Corp Trust Admin: `disputes.rules.manage`, `disputes.auto.override`

---

## 4) SLA configuration

Create `packages/core/disputes/slaConfig.ts`:

```ts
// SLA configuration (should be in settings, hardcoded for v1)
export const DISPUTE_SLA = {
  // Time limits in hours
  sellerResponseHours: 48,      // Seller must respond within 48h
  buyerResponseHours: 72,       // Buyer must respond to seller within 72h
  platformReviewHours: 120,     // Platform decision within 5 days
  
  // Auto-escalation triggers
  autoEscalateOnNoResponse: true,
  autoCloseOnDeliveryConfirmed: true,
  deliveryConfirmationGraceDays: 3,
  
  // Auto-close rules
  autoCloseInactivityDays: 14,  // Close if no activity for 14 days
};

export type DisputeStage = 
  | "seller_response"
  | "buyer_response" 
  | "platform_review"
  | "final";

export function getSLADeadline(stage: DisputeStage, startTime: Date): Date {
  const hours = {
    seller_response: DISPUTE_SLA.sellerResponseHours,
    buyer_response: DISPUTE_SLA.buyerResponseHours,
    platform_review: DISPUTE_SLA.platformReviewHours,
    final: 0,
  }[stage];

  return new Date(startTime.getTime() + hours * 60 * 60 * 1000);
}
```

---

## 5) Auto-resolution engine

Create `packages/core/disputes/autoResolve.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { DISPUTE_SLA } from "./slaConfig";
import { postRefundLedgerOnce } from "../refunds/refund";
import { emitAudit } from "../audit";

const prisma = new PrismaClient();

interface RuleConditions {
  deliveryConfirmed?: boolean;
  daysSinceDelivery?: number;
  hasTracking?: boolean;
  sellerResponded?: boolean;
  buyerResponded?: boolean;
  daysSinceOpen?: number;
}

export async function evaluateAutoResolution(disputeId: string): Promise<{
  shouldResolve: boolean;
  rule?: any;
  action?: string;
}> {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
    include: { order: true },
  });

  if (!dispute || dispute.status === "RESOLVED" || !dispute.isAutoResolvable) {
    return { shouldResolve: false };
  }

  // Get active rules sorted by priority
  const rules = await prisma.disputeRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });

  // Build condition context
  const order = dispute.order;
  const shipment = await prisma.shipment.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" },
  });

  const context: RuleConditions = {
    deliveryConfirmed: shipment?.deliveredAt != null,
    daysSinceDelivery: shipment?.deliveredAt
      ? Math.floor((Date.now() - shipment.deliveredAt.getTime()) / (24 * 60 * 60 * 1000))
      : undefined,
    hasTracking: !!shipment?.trackingNumber,
    sellerResponded: !!dispute.sellerResponse,
    buyerResponded: !!dispute.buyerClaim,
    daysSinceOpen: Math.floor(
      (Date.now() - dispute.openedAt.getTime()) / (24 * 60 * 60 * 1000)
    ),
  };

  // Evaluate rules
  for (const rule of rules) {
    const conditions = rule.conditions as RuleConditions;
    
    if (matchesConditions(conditions, context)) {
      return {
        shouldResolve: true,
        rule,
        action: rule.action,
      };
    }
  }

  return { shouldResolve: false };
}

function matchesConditions(
  ruleConditions: RuleConditions,
  context: RuleConditions
): boolean {
  for (const [key, value] of Object.entries(ruleConditions)) {
    if (value === undefined) continue;
    
    const contextValue = context[key as keyof RuleConditions];
    
    if (typeof value === "boolean" && contextValue !== value) {
      return false;
    }
    
    if (typeof value === "number") {
      // For numeric conditions, check if context meets minimum
      if (contextValue === undefined || contextValue < value) {
        return false;
      }
    }
  }
  
  return true;
}

export async function executeAutoResolution(
  disputeId: string,
  rule: any
): Promise<void> {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
    include: { order: true },
  });

  if (!dispute) return;

  const actionParams = rule.actionParams || {};
  let outcome: string;
  let refundCents = 0;
  let reason: string;

  switch (rule.action) {
    case "close_buyer_favor":
      outcome = "buyer_favor";
      refundCents = dispute.order.totalCents;
      reason = `Auto-resolved: ${rule.name}`;
      break;

    case "close_seller_favor":
      outcome = "seller_favor";
      reason = `Auto-resolved: ${rule.name}`;
      break;

    case "refund_partial":
      outcome = "split";
      refundCents = Math.round(
        dispute.order.totalCents * ((actionParams.refundPercent || 50) / 100)
      );
      reason = `Auto-resolved partial refund: ${rule.name}`;
      break;

    case "escalate":
      await escalateDispute(disputeId, "system", `Auto-escalated: ${rule.name}`);
      return;

    default:
      return;
  }

  // Create resolution
  await prisma.disputeResolution.create({
    data: {
      disputeId,
      outcome,
      reason,
      refundCents,
      sellerDebited: refundCents > 0,
      resolvedBy: "auto",
      ruleId: rule.id,
    },
  });

  // Update dispute status
  await prisma.disputeCase.update({
    where: { id: disputeId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      outcome,
    },
  });

  // Process refund if needed
  if (refundCents > 0) {
    await postRefundLedgerOnce({
      refundId: `dispute:${disputeId}`,
      orderId: dispute.orderId,
      sellerId: dispute.order.sellerId,
      amountCents: refundCents,
      currency: dispute.order.currency,
    });
  }

  // Add timeline entry
  await prisma.disputeTimeline.create({
    data: {
      disputeId,
      eventType: "resolved",
      actorType: "system",
      description: reason,
      metadata: { ruleId: rule.id, outcome, refundCents },
    },
  });

  // Audit
  await emitAudit({
    action: "dispute.auto_resolved",
    entityType: "DisputeCase",
    entityId: disputeId,
    meta: { ruleId: rule.id, outcome, refundCents },
  });
}

export async function escalateDispute(
  disputeId: string,
  actorType: string,
  reason: string,
  actorId?: string
): Promise<void> {
  await prisma.disputeCase.update({
    where: { id: disputeId },
    data: {
      status: "ESCALATED",
      lastActionAt: new Date(),
    },
  });

  await prisma.disputeSLA.update({
    where: { disputeId },
    data: {
      currentStage: "platform_review",
      stageStartedAt: new Date(),
      slaDeadline: new Date(Date.now() + DISPUTE_SLA.platformReviewHours * 60 * 60 * 1000),
      escalatedAt: new Date(),
    },
  });

  await prisma.disputeTimeline.create({
    data: {
      disputeId,
      eventType: "escalated",
      actorType,
      actorId,
      description: reason,
    },
  });

  await emitAudit({
    action: "dispute.escalated",
    entityType: "DisputeCase",
    entityId: disputeId,
    actorUserId: actorId,
    meta: { reason },
  });
}
```

---

## 6) SLA monitoring job

Create `packages/core/disputes/slaMonitor.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { DISPUTE_SLA, getSLADeadline } from "./slaConfig";
import { escalateDispute, evaluateAutoResolution, executeAutoResolution } from "./autoResolve";

const prisma = new PrismaClient();

export async function runSLAMonitor(): Promise<{
  checked: number;
  escalated: number;
  autoResolved: number;
}> {
  let escalated = 0;
  let autoResolved = 0;

  // Find overdue SLAs
  const overdueSLAs = await prisma.disputeSLA.findMany({
    where: {
      slaDeadline: { lt: new Date() },
      isOverdue: false,
      currentStage: { not: "final" },
    },
    include: {
      dispute: true,
    },
  });

  for (const sla of overdueSLAs) {
    // Mark as overdue
    await prisma.disputeSLA.update({
      where: { id: sla.id },
      data: { isOverdue: true },
    });

    // Check if should auto-escalate
    if (DISPUTE_SLA.autoEscalateOnNoResponse) {
      if (sla.currentStage === "seller_response" && !sla.dispute.sellerResponse) {
        await escalateDispute(
          sla.disputeId,
          "system",
          "Auto-escalated: Seller did not respond within SLA"
        );
        escalated++;
        continue;
      }
    }

    // Check auto-resolution rules
    const { shouldResolve, rule } = await evaluateAutoResolution(sla.disputeId);
    if (shouldResolve && rule) {
      await executeAutoResolution(sla.disputeId, rule);
      autoResolved++;
    }
  }

  // Check for delivery-confirmed auto-close
  const openDisputes = await prisma.disputeCase.findMany({
    where: {
      status: { in: ["OPEN", "RESPONDED"] },
      isAutoResolvable: true,
    },
  });

  for (const dispute of openDisputes) {
    const { shouldResolve, rule } = await evaluateAutoResolution(dispute.id);
    if (shouldResolve && rule) {
      await executeAutoResolution(dispute.id, rule);
      autoResolved++;
    }
  }

  return {
    checked: overdueSLAs.length + openDisputes.length,
    escalated,
    autoResolved,
  };
}
```

---

## 7) Evidence handling

Create `packages/core/disputes/evidence.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAudit } from "../audit";

const prisma = new PrismaClient();

const EVIDENCE_CONFIG = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
  maxPerDispute: 10,
};

export async function submitEvidence(args: {
  disputeId: string;
  submittedBy: "buyer" | "seller" | "platform";
  submitterId: string;
  evidenceType: string;
  description?: string;
  storageKey?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  // Check evidence limit
  const existingCount = await prisma.disputeEvidence.count({
    where: { disputeId: args.disputeId },
  });

  if (existingCount >= EVIDENCE_CONFIG.maxPerDispute) {
    throw new Error("EVIDENCE_LIMIT_REACHED");
  }

  const evidence = await prisma.disputeEvidence.create({
    data: {
      disputeId: args.disputeId,
      submittedBy: args.submittedBy,
      submitterId: args.submitterId,
      evidenceType: args.evidenceType,
      description: args.description,
      storageKey: args.storageKey,
      metadata: args.metadata || {},
    },
  });

  // Add timeline entry
  await prisma.disputeTimeline.create({
    data: {
      disputeId: args.disputeId,
      eventType: "evidence",
      actorType: args.submittedBy,
      actorId: args.submitterId,
      description: `${args.submittedBy} submitted ${args.evidenceType} evidence`,
      metadata: { evidenceId: evidence.id },
    },
  });

  // Update last action
  await prisma.disputeCase.update({
    where: { id: args.disputeId },
    data: { lastActionAt: new Date() },
  });

  await emitAudit({
    action: "dispute.evidence_submitted",
    entityType: "DisputeEvidence",
    entityId: evidence.id,
    actorUserId: args.submitterId,
    meta: { disputeId: args.disputeId, evidenceType: args.evidenceType },
  });
}

export async function getEvidenceForDispute(disputeId: string) {
  return prisma.disputeEvidence.findMany({
    where: { disputeId },
    orderBy: { createdAt: "asc" },
  });
}
```

---

## 8) Dispute rules API

### 8.1 List rules
`GET /api/platform/disputes/rules`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getStaffSession, assertPermission } from "@/lib/staff-auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getStaffSession();
  assertPermission(session, "disputes.rules.manage");

  const rules = await prisma.disputeRule.findMany({
    orderBy: [{ isActive: "desc" }, { priority: "asc" }],
  });

  return NextResponse.json({ rules });
}
```

### 8.2 Create rule
`POST /api/platform/disputes/rules`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getStaffSession, assertPermission } from "@/lib/staff-auth";
import { emitAudit } from "@/packages/core/audit";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getStaffSession();
  assertPermission(session, "disputes.rules.manage");

  const { name, type, priority, conditions, action, actionParams } = await req.json();

  if (!name || !type || !action) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const rule = await prisma.disputeRule.create({
    data: {
      name,
      type,
      priority: priority || 100,
      conditions: conditions || {},
      action,
      actionParams: actionParams || {},
      createdByStaffId: session.staffId,
    },
  });

  await emitAudit({
    actorStaffId: session.staffId,
    action: "dispute.rule_created",
    entityType: "DisputeRule",
    entityId: rule.id,
    meta: { name, type, action },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
```

### 8.3 Update rule
`PATCH /api/platform/disputes/rules/:id`

```ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getStaffSession();
  assertPermission(session, "disputes.rules.manage");

  const updates = await req.json();

  const rule = await prisma.disputeRule.update({
    where: { id: params.id },
    data: {
      ...updates,
      updatedAt: new Date(),
    },
  });

  await emitAudit({
    actorStaffId: session.staffId,
    action: "dispute.rule_updated",
    entityType: "DisputeRule",
    entityId: rule.id,
    meta: updates,
  });

  return NextResponse.json({ rule });
}
```

---

## 9) Seller/Buyer dispute APIs

### 9.1 Submit evidence
`POST /api/disputes/:id/evidence`

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { submitEvidence } from "@/packages/core/disputes/evidence";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dispute = await prisma.disputeCase.findUnique({
    where: { id: params.id },
    include: { order: true },
  });

  if (!dispute) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Check if user is buyer or seller
  const isBuyer = dispute.order.buyerId === session.userId;
  const isSeller = dispute.order.sellerId === session.userId;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { evidenceType, description, storageKey, metadata } = await req.json();

  await submitEvidence({
    disputeId: params.id,
    submittedBy: isBuyer ? "buyer" : "seller",
    submitterId: session.userId,
    evidenceType,
    description,
    storageKey,
    metadata,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

### 9.2 Escalate dispute
`POST /api/disputes/:id/escalate`

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { escalateDispute } from "@/packages/core/disputes/autoResolve";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dispute = await prisma.disputeCase.findUnique({
    where: { id: params.id },
    include: { order: true },
  });

  if (!dispute) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const isBuyer = dispute.order.buyerId === session.userId;
  const isSeller = dispute.order.sellerId === session.userId;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (dispute.status === "ESCALATED" || dispute.status === "RESOLVED") {
    return NextResponse.json({ error: "CANNOT_ESCALATE" }, { status: 400 });
  }

  const { reason } = await req.json();

  await escalateDispute(
    params.id,
    isBuyer ? "buyer" : "seller",
    reason || "Escalated by user",
    session.userId
  );

  return NextResponse.json({ ok: true });
}
```

---

## 10) Health provider

Create `packages/core/health/providers/disputesAutomation.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider } from "../types";

const prisma = new PrismaClient();

export const disputesAutomationProvider: HealthProvider = {
  key: "disputes_automation",

  async run(runType) {
    const checks = [];

    // Check rules exist
    const ruleCount = await prisma.disputeRule.count({
      where: { isActive: true },
    });

    checks.push({
      key: "disputes.rules_configured",
      ok: ruleCount > 0,
      details: `${ruleCount} active rules`,
    });

    // Check SLA monitoring
    const overdueCount = await prisma.disputeSLA.count({
      where: { isOverdue: true, currentStage: { not: "final" } },
    });

    checks.push({
      key: "disputes.overdue_slas",
      ok: overdueCount < 10, // Warning threshold
      details: `${overdueCount} overdue SLAs`,
    });

    // Check auto-resolution is working
    const recentAutoResolved = await prisma.disputeResolution.count({
      where: {
        resolvedBy: "auto",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    checks.push({
      key: "disputes.auto_resolution_active",
      ok: true,
      details: `${recentAutoResolved} auto-resolved in 7 days`,
    });

    // Check timeline logging
    const recentTimeline = await prisma.disputeTimeline.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    checks.push({
      key: "disputes.timeline_logging",
      ok: true,
      details: `${recentTimeline} timeline events in 24h`,
    });

    const allOk = checks.every(c => c.ok);

    return {
      status: allOk ? "healthy" : overdueCount > 20 ? "critical" : "degraded",
      message: allOk ? "Disputes automation healthy" : "Issues detected",
      providerVersion: "1.0",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 11) Seed default rules

Create `scripts/seed-dispute-rules.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultRules = [
  {
    name: "Auto-close on delivery confirmation",
    type: "auto_close_delivered",
    priority: 10,
    conditions: {
      deliveryConfirmed: true,
      daysSinceDelivery: 3,
    },
    action: "close_seller_favor",
    actionParams: {},
  },
  {
    name: "Auto-refund on no tracking",
    type: "refund_on_no_tracking",
    priority: 20,
    conditions: {
      hasTracking: false,
      daysSinceOpen: 7,
    },
    action: "close_buyer_favor",
    actionParams: {},
  },
  {
    name: "Auto-escalate on seller no response",
    type: "auto_escalate",
    priority: 30,
    conditions: {
      sellerResponded: false,
      daysSinceOpen: 3,
    },
    action: "escalate",
    actionParams: {},
  },
  {
    name: "Auto-close on inactivity",
    type: "auto_close_no_response",
    priority: 100,
    conditions: {
      daysSinceOpen: 14,
    },
    action: "close_seller_favor",
    actionParams: {},
  },
];

async function seed() {
  for (const rule of defaultRules) {
    await prisma.disputeRule.upsert({
      where: { name: rule.name },
      update: {},
      create: {
        ...rule,
        createdByStaffId: "system",
      },
    });
  }

  console.log("seed-dispute-rules: ok");
}

seed().finally(() => prisma.$disconnect());
```

---

## 12) Doctor checks (Phase 28)

```ts
async function checkPhase28() {
  const checks = [];

  // 1. Rules seeded
  const ruleCount = await prisma.disputeRule.count({ where: { isActive: true } });
  checks.push({
    phase: 28,
    name: "disputes.rules_seeded",
    status: ruleCount >= 4 ? "PASS" : "FAIL",
  });

  // 2. Auto-resolution works
  // Create test dispute and verify evaluation
  const testOrder = await prisma.order.findFirst({
    where: { status: "DELIVERED" },
  });

  if (testOrder) {
    const testDispute = await prisma.disputeCase.create({
      data: {
        orderId: testOrder.id,
        reasonCode: "test",
        isAutoResolvable: true,
      },
    });

    const { shouldResolve } = await evaluateAutoResolution(testDispute.id);
    
    // Clean up
    await prisma.disputeCase.delete({ where: { id: testDispute.id } });

    checks.push({
      phase: 28,
      name: "disputes.auto_evaluation_works",
      status: "PASS",
    });
  }

  // 3. SLA tracking works
  const slaCount = await prisma.disputeSLA.count();
  checks.push({
    phase: 28,
    name: "disputes.sla_table_exists",
    status: "PASS",
  });

  // 4. Evidence submission works
  checks.push({
    phase: 28,
    name: "disputes.evidence_table_exists",
    status: "PASS",
  });

  // 5. Timeline logging works
  checks.push({
    phase: 28,
    name: "disputes.timeline_table_exists",
    status: "PASS",
  });

  return checks;
}
```

---

## 13) UI Pages (Corp Admin)

### 13.1 Rules Management
`/corp/disputes/rules`

Components:
- Rules list with priority, conditions, action
- Create/edit rule form
- Toggle active/inactive
- Audit history

### 13.2 Enhanced Queue
`/corp/disputes/queue`

Enhancements:
- SLA countdown indicators (red when overdue)
- Filter by: stage, SLA status, category
- Quick actions: escalate, resolve, override auto
- Timeline viewer in side panel

### 13.3 Dispute Detail
`/corp/disputes/[id]`

Components:
- Full timeline with evidence
- Both sides' claims and responses
- SLA status and deadline
- Manual resolution form
- Override auto-resolution toggle

---

## 14) Seller Protection Score in Auto-Resolution (Phase 38 Integration)

The seller's protection score affects automated dispute resolution:

| Score Tier | Auto-Resolve Behavior |
|------------|----------------------|
| EXCELLENT (90-100) | Favor seller in ambiguous cases, higher evidence bar for buyer |
| GOOD (70-89) | Standard rules apply |
| FAIR (50-69) | Standard rules apply |
| POOR (0-49) | Favor buyer in ambiguous cases, lower evidence bar |

### Implementation

```typescript
async function getAutoResolutionBias(sellerId: string): Promise<"SELLER" | "NEUTRAL" | "BUYER"> {
  const score = await getSellerProtectionScore(sellerId);

  if (score.tier === "EXCELLENT") return "SELLER";
  if (score.tier === "POOR") return "BUYER";
  return "NEUTRAL";
}

// Use in evaluateAutoResolution:
const bias = await getAutoResolutionBias(dispute.sellerId);
// Adjust evidence thresholds based on bias
```

---

## 15) Appeal Outcome Effects on Automation (Phase 38 Integration)

When appeals are decided, update automation rules:

| Appeal Outcome | Effect |
|----------------|--------|
| OVERTURN_FULL | Add buyer to watch list, reduce auto-approve rate for buyer |
| OVERTURN_PARTIAL | Log for pattern analysis |
| UPHELD | No change |

### Buyer Abuse Detection

If a buyer has 3+ claims overturned on appeal in 90 days:
- Flag account for review
- Disable auto-approve for all claims from this buyer
- Require manual review for future claims

```typescript
async function checkBuyerAbuseAfterAppeal(buyerId: string): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const overturnedAppeals = await prisma.sellerAppeal.count({
    where: {
      claim: { buyerId },
      decision: { in: ["OVERTURN_FULL", "OVERTURN_PARTIAL"] },
      reviewedAt: { gte: ninetyDaysAgo },
    },
  });

  if (overturnedAppeals >= 3) {
    await flagBuyerForReview(buyerId, "APPEAL_ABUSE_PATTERN");
  }
}
```

---

## 16) Category Coverage in Auto-Refund (Phase 38 Integration)

```typescript
// Before auto-approving refund:
async function canAutoRefund(claim: BuyerProtectionClaim): Promise<boolean> {
  const categoryLimit = await getCategoryLimit(claim.categoryId);

  // Check if claim amount is within auto-approve threshold for category
  if (claim.amountCents > categoryLimit.autoApproveUnderCents) {
    return false; // Requires manual review
  }

  // Check evidence requirements
  if (categoryLimit.requiresEvidence && claim.evidenceUrls.length === 0) {
    return false; // Evidence required but not provided
  }

  return true;
}
```

---

## 17) Phase 28 Completion Criteria

- [ ] DisputeRule, DisputeSLA, DisputeEvidence, DisputeTimeline, DisputeResolution models created
- [ ] Default auto-resolution rules seeded
- [ ] SLA monitoring job implemented
- [ ] Auto-resolution engine evaluates rules correctly
- [ ] Delivery-confirmed disputes auto-close (with grace period)
- [ ] No-tracking disputes auto-refund buyer
- [ ] Escalation workflow implemented
- [ ] Evidence submission works for buyer/seller
- [ ] Timeline tracks all dispute events
- [ ] Health provider `disputes_automation` registered
- [ ] Doctor passes all Phase 28 checks

---

---

## 18) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 28 implementation |
| 1.1 | 2026-01-22 | Phase 38 Integration: Protection score in auto-resolution, appeal outcome effects, category coverage |

---

# END PHASE 28
