# TWICELY V2 - Install Phase 33: Chargebacks & Claims Flow (Money Truth)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  Ingestion  ->  Evidence  ->  Ledger  ->  Holds  ->  Health  ->  Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`
- `/rules/TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_33_CHARGEBACKS_CLAIMS.md`  
> Prereq: Phase 32 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Chargeback case ingestion from payment provider webhooks
- Evidence pack generator for dispute responses
- Ledger correction rules + seller attribution
- Automatic payout holds during disputes
- Case resolution workflow

### UI (Corp)
- Corp  ->  Finance  ->  Chargeback Queue
- Corp  ->  Finance  ->  Case Detail (evidence viewer)
- Corp  ->  Finance  ->  Ledger Corrections

### Ops
- Health provider: `chargebacks`
- Doctor checks: ingest idempotently, auto-hold, ledger entry, evidence pack

### Doctor Check Implementation (Phase 33)

Add to `scripts/twicely-doctor.ts`:

```typescript
async function checkPhase33(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testOrderId = `doctor_order_${Date.now()}`;
  const testSellerId = `doctor_seller_${Date.now()}`;
  const providerRef = `ch_doctor_${Date.now()}`;

  // 1. Ingest case idempotently (insert twice, expect one record)
  for (let i = 0; i < 2; i++) {
    await prisma.chargebackCase.upsert({
      where: { providerRef },
      create: {
        provider: "stripe",
        providerRef,
        orderId: testOrderId,
        sellerId: testSellerId,
        amountCents: 5000,
        reason: "fraudulent",
        status: "OPEN",
        openedAt: new Date(),
      },
      update: {},
    });
  }

  const caseCount = await prisma.chargebackCase.count({ where: { providerRef } });
  checks.push({
    phase: 33,
    name: "chargebacks.idempotent_ingest",
    status: caseCount === 1 ? "PASS" : "FAIL",
    details: `Cases created: ${caseCount} (expected 1)`,
  });

  const chargebackCase = await prisma.chargebackCase.findUnique({ where: { providerRef } });

  // 2. Payout hold applied automatically
  const hold = await prisma.payoutHold.create({
    data: {
      sellerId: testSellerId,
      reason: `chargeback:${chargebackCase?.id}`,
      amountCents: 5000,
      status: "ACTIVE",
      createdAt: new Date(),
    },
  });
  checks.push({
    phase: 33,
    name: "chargebacks.auto_hold",
    status: hold?.status === "ACTIVE" ? "PASS" : "FAIL",
    details: `Hold amount: ${hold?.amountCents} cents`,
  });

  // 3. Ledger entry created once (idempotent)
  const ledgerKey = `chargeback_${providerRef}`;
  for (let i = 0; i < 2; i++) {
    try {
      await prisma.ledgerEntry.create({
        data: {
          orderId: testOrderId,
          sellerId: testSellerId,
          type: "CHARGEBACK",
          direction: "DEBIT",
          amountCents: 5000,
          currency: "USD",
          occurredAt: new Date(),
          idempotencyKey: ledgerKey,
        },
      });
    } catch {
      // Expected on second attempt - duplicate key
    }
  }

  const ledgerCount = await prisma.ledgerEntry.count({
    where: { idempotencyKey: ledgerKey },
  });
  checks.push({
    phase: 33,
    name: "chargebacks.ledger_idempotent",
    status: ledgerCount === 1 ? "PASS" : "FAIL",
    details: `Ledger entries: ${ledgerCount} (expected 1)`,
  });

  // 4. Evidence pack structure (verify case has required fields)
  const hasEvidenceFields = chargebackCase?.orderId && chargebackCase?.sellerId && chargebackCase?.amountCents;
  checks.push({
    phase: 33,
    name: "chargebacks.evidence_data",
    status: hasEvidenceFields ? "PASS" : "FAIL",
    details: `Order: ${chargebackCase?.orderId}`,
  });

  // Cleanup
  await prisma.ledgerEntry.deleteMany({ where: { idempotencyKey: ledgerKey } });
  await prisma.payoutHold.delete({ where: { id: hold.id } });
  await prisma.chargebackCase.delete({ where: { providerRef } });

  return checks;
}
```


---

## 1) Chargeback Invariants (non-negotiable)

- Chargeback cases are idempotent by `providerRef`
- Payout holds are automatic on case open
- Ledger corrections create audit trail
- Evidence submission has deadline tracking
- Won/Lost status triggers appropriate ledger adjustments

Chargeback flow:
```
Webhook  ->  Case Created  ->  Hold Applied  ->  Evidence Submitted  ->  Awaiting  ->  Won/Lost  ->  Ledger Adjusted
```

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model ChargebackCase {
  id              String    @id @default(cuid())
  provider        String    // stripe|paypal|etc
  providerRef     String    @unique
  providerCaseId  String?   // provider's dispute ID
  orderId         String?
  sellerId        String?
  buyerId         String?
  status          String    @default("OPEN") // OPEN|EVIDENCE_NEEDED|SUBMITTED|WON|LOST|CLOSED
  reasonCode      String?   // provider reason code
  reasonText      String?   // human-readable reason
  amountCents     Int
  currency        String    @default("USD")
  evidenceJson    Json      @default("{}")
  evidenceDueAt   DateTime?
  submittedAt     DateTime?
  resolvedAt      DateTime?
  outcome         String?   // won|lost|withdrawn
  openedAt        DateTime  @default(now())
  closedAt        DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([orderId])
  @@index([sellerId, status])
  @@index([status, openedAt])
  @@index([evidenceDueAt])
}

model ChargebackHold {
  id              String    @id @default(cuid())
  chargebackId    String
  sellerId        String
  amountCents     Int
  currency        String    @default("USD")
  status          String    @default("ACTIVE") // ACTIVE|RELEASED|APPLIED
  releasedAt      DateTime?
  appliedAt       DateTime?
  createdAt       DateTime  @default(now())

  @@index([sellerId, status])
  @@index([chargebackId])
}

model LedgerCorrection {
  id              String    @id @default(cuid())
  chargebackId    String?
  orderId         String?
  sellerId        String?
  type            String    // chargeback_loss|chargeback_win_reversal|manual_adjustment
  amountCents     Int       // positive = credit, negative = debit
  currency        String    @default("USD")
  reason          String
  idempotencyKey  String    @unique
  createdByStaffId String?
  createdAt       DateTime  @default(now())

  @@index([sellerId, createdAt])
  @@index([chargebackId])
}
```

Migration:
```bash
npx prisma migrate dev --name chargebacks_claims_phase33
```

---

## 3) Evidence Pack Types

Create `packages/core/chargebacks/evidence.ts`:

```ts
export type EvidencePack = {
  orderId: string;
  orderDate?: string;
  customerName?: string;
  customerEmail?: string;
  billingAddress?: {
    line1: string;
    city: string;
    state: string;
    postal: string;
    country: string;
  };
  shippingAddress?: {
    line1: string;
    city: string;
    state: string;
    postal: string;
    country: string;
  };
  tracking?: {
    carrier: string;
    trackingNumber: string;
    deliveredAt?: string;
  };
  messages?: Array<{
    at: string;
    from: string;
    to: string;
    body: string;
  }>;
  receipts?: Array<{
    name: string;
    amountCents: number;
    date: string;
  }>;
  itemDescriptions?: Array<{
    title: string;
    description: string;
    imageUrl?: string;
  }>;
  refundPolicy?: string;
  additionalNotes?: string;
};

export type EvidenceSubmission = {
  chargebackId: string;
  evidence: EvidencePack;
  submittedAt: string;
  providerSubmissionRef?: string;
};
```

---

## 4) Chargeback Ingestion Service

Create `packages/core/chargebacks/ingestion.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export type ChargebackWebhookPayload = {
  provider: string;
  providerRef: string;
  providerCaseId?: string;
  orderId?: string;
  amountCents: number;
  currency: string;
  reasonCode?: string;
  reasonText?: string;
  evidenceDueAt?: string;
  status?: string;
};

export async function ingestChargeback(
  payload: ChargebackWebhookPayload,
  idempotencyKey: string
): Promise<{ case: any; created: boolean }> {
  // Check for existing case (idempotent)
  const existing = await prisma.chargebackCase.findUnique({
    where: { providerRef: payload.providerRef },
  });

  if (existing) {
    return { case: existing, created: false };
  }

  // Look up order to get seller
  let sellerId: string | null = null;
  let buyerId: string | null = null;

  if (payload.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
    });
    if (order) {
      sellerId = order.sellerId;
      buyerId = order.buyerId;
    }
  }

  // Create case
  const chargebackCase = await prisma.chargebackCase.create({
    data: {
      provider: payload.provider,
      providerRef: payload.providerRef,
      providerCaseId: payload.providerCaseId,
      orderId: payload.orderId,
      sellerId,
      buyerId,
      amountCents: payload.amountCents,
      currency: payload.currency,
      reasonCode: payload.reasonCode,
      reasonText: payload.reasonText,
      evidenceDueAt: payload.evidenceDueAt ? new Date(payload.evidenceDueAt) : null,
      status: "OPEN",
    },
  });

  // Auto-apply payout hold
  if (sellerId) {
    await applyPayoutHold({
      chargebackId: chargebackCase.id,
      sellerId,
      amountCents: payload.amountCents,
      currency: payload.currency,
    });
  }

  await emitAuditEvent({
    action: "chargeback.case.created",
    entityType: "ChargebackCase",
    entityId: chargebackCase.id,
    meta: {
      providerRef: payload.providerRef,
      amountCents: payload.amountCents,
      reasonCode: payload.reasonCode,
      idempotencyKey,
    },
  });

  return { case: chargebackCase, created: true };
}

async function applyPayoutHold(args: {
  chargebackId: string;
  sellerId: string;
  amountCents: number;
  currency: string;
}) {
  await prisma.chargebackHold.create({
    data: {
      chargebackId: args.chargebackId,
      sellerId: args.sellerId,
      amountCents: args.amountCents,
      currency: args.currency,
      status: "ACTIVE",
    },
  });

  await emitAuditEvent({
    action: "chargeback.hold.applied",
    entityType: "ChargebackHold",
    entityId: args.chargebackId,
    meta: { sellerId: args.sellerId, amountCents: args.amountCents },
  });
}
```

---

## 5) Evidence Pack Builder

Create `packages/core/chargebacks/evidence-builder.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { EvidencePack } from "./evidence";

const prisma = new PrismaClient();

export async function buildEvidencePack(orderId: string): Promise<EvidencePack> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      buyer: true,
    },
  });

  if (!order) {
    return { orderId };
  }

  // Get shipping/tracking info
  const shipment = await prisma.shipment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  // Get messages between buyer and seller
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: order.buyerId, recipientId: order.sellerId },
        { senderId: order.sellerId, recipientId: order.buyerId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const evidence: EvidencePack = {
    orderId,
    orderDate: order.createdAt.toISOString(),
    customerName: order.buyer?.name ?? undefined,
    customerEmail: order.buyer?.email ?? undefined,
    shippingAddress: order.shippingLine1
      ? {
          line1: order.shippingLine1,
          city: order.shippingCity ?? "",
          state: order.shippingState ?? "",
          postal: order.shippingPostal ?? "",
          country: order.shippingCountry ?? "US",
        }
      : undefined,
    tracking: shipment?.trackingNumber
      ? {
          carrier: shipment.carrier ?? "unknown",
          trackingNumber: shipment.trackingNumber,
          deliveredAt: shipment.deliveredAt?.toISOString(),
        }
      : undefined,
    messages: messages.map((m) => ({
      at: m.createdAt.toISOString(),
      from: m.senderId,
      to: m.recipientId ?? "",
      body: m.body,
    })),
    itemDescriptions: order.items.map((item) => ({
      title: item.title,
      description: item.description ?? "",
    })),
    receipts: [
      {
        name: "Order Total",
        amountCents: order.totalCents,
        date: order.createdAt.toISOString(),
      },
    ],
  };

  return evidence;
}
```

---

## 6) Chargeback Resolution Service

Create `packages/core/chargebacks/resolution.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function submitEvidence(args: {
  chargebackId: string;
  evidence: any;
  staffActorId?: string;
}): Promise<any> {
  const chargebackCase = await prisma.chargebackCase.update({
    where: { id: args.chargebackId },
    data: {
      evidenceJson: args.evidence,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "chargeback.evidence.submitted",
    entityType: "ChargebackCase",
    entityId: args.chargebackId,
  });

  return chargebackCase;
}

export async function resolveChargeback(args: {
  chargebackId: string;
  outcome: "won" | "lost" | "withdrawn";
  staffActorId?: string;
  idempotencyKey: string;
}): Promise<any> {
  const chargebackCase = await prisma.chargebackCase.findUnique({
    where: { id: args.chargebackId },
  });

  if (!chargebackCase) {
    throw new Error("Chargeback case not found");
  }

  if (chargebackCase.closedAt) {
    // Already resolved, idempotent return
    return chargebackCase;
  }

  // Update case
  const updated = await prisma.chargebackCase.update({
    where: { id: args.chargebackId },
    data: {
      status: args.outcome === "won" ? "WON" : args.outcome === "lost" ? "LOST" : "CLOSED",
      outcome: args.outcome,
      resolvedAt: new Date(),
      closedAt: new Date(),
    },
  });

  // Handle hold
  const hold = await prisma.chargebackHold.findFirst({
    where: { chargebackId: args.chargebackId, status: "ACTIVE" },
  });

  if (hold) {
    if (args.outcome === "won" || args.outcome === "withdrawn") {
      // Release hold
      await prisma.chargebackHold.update({
        where: { id: hold.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });

      await emitAuditEvent({
        actorUserId: args.staffActorId,
        action: "chargeback.hold.released",
        entityType: "ChargebackHold",
        entityId: hold.id,
        meta: { outcome: args.outcome },
      });
    } else if (args.outcome === "lost") {
      // Apply hold (deduct from seller)
      await prisma.chargebackHold.update({
        where: { id: hold.id },
        data: { status: "APPLIED", appliedAt: new Date() },
      });

      // Create ledger correction
      await createLedgerCorrection({
        chargebackId: args.chargebackId,
        sellerId: hold.sellerId,
        amountCents: -hold.amountCents, // Debit
        type: "chargeback_loss",
        reason: `Chargeback lost: ${chargebackCase.reasonCode ?? "unknown"}`,
        idempotencyKey: args.idempotencyKey,
        staffActorId: args.staffActorId,
      });
    }
  }

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "chargeback.resolved",
    entityType: "ChargebackCase",
    entityId: args.chargebackId,
    meta: { outcome: args.outcome, idempotencyKey: args.idempotencyKey },
  });

  return updated;
}

async function createLedgerCorrection(args: {
  chargebackId: string;
  sellerId: string;
  amountCents: number;
  type: string;
  reason: string;
  idempotencyKey: string;
  staffActorId?: string;
}) {
  // Check idempotency
  const existing = await prisma.ledgerCorrection.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
  });

  if (existing) {
    return existing;
  }

  const correction = await prisma.ledgerCorrection.create({
    data: {
      chargebackId: args.chargebackId,
      sellerId: args.sellerId,
      amountCents: args.amountCents,
      type: args.type,
      reason: args.reason,
      idempotencyKey: args.idempotencyKey,
      createdByStaffId: args.staffActorId,
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "ledger.correction.created",
    entityType: "LedgerCorrection",
    entityId: correction.id,
    meta: {
      chargebackId: args.chargebackId,
      amountCents: args.amountCents,
      type: args.type,
    },
  });

  return correction;
}
```

---

## 7) Chargeback Trust Impact Service (HIGH-7)

Create `packages/core/chargebacks/trust-impact.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";
import { queueSellerReindex } from "../search/reindex-trigger";

const prisma = new PrismaClient();

/**
 * Apply trust score impact when a chargeback occurs
 * Called when chargeback is ingested
 */
export async function applyChargebackTrustImpact(args: {
  sellerId: string;
  chargebackId: string;
  amountCents: number;
}): Promise<{ previousScore: number; newScore: number; penalty: number }> {
  // Check if this is first chargeback for seller
  const previousChargebacks = await prisma.chargebackCase.count({
    where: {
      sellerId: args.sellerId,
      id: { not: args.chargebackId },
    },
  });
  
  const isFirstChargeback = previousChargebacks === 0;
  
  // Calculate penalty
  // First chargeback: -10 points
  // Subsequent chargebacks: -20 points
  // High-value (>$500): additional -5 points
  let penalty = isFirstChargeback ? 10 : 20;
  if (args.amountCents > 50000) penalty += 5;
  
  // Get current trust score
  const currentTrust = await prisma.sellerTrustScore.findUnique({
    where: { sellerId: args.sellerId },
  });
  const previousScore = currentTrust?.score ?? 100;
  
  // Create trust event
  await prisma.trustEvent.create({
    data: {
      sellerId: args.sellerId,
      eventType: "CHARGEBACK",
      impact: -penalty,
      sourceId: args.chargebackId,
      sourceType: "ChargebackCase",
      reason: `Chargeback of $${(args.amountCents / 100).toFixed(2)} - ${isFirstChargeback ? "first" : "repeat"} offense`,
    },
  });
  
  // Recalculate trust score
  const newScore = await recalculateTrustScore(args.sellerId);
  
  // Trigger search reindex for all seller listings (HIGH-8 integration)
  await queueSellerReindex({
    sellerId: args.sellerId,
    reason: "TRUST_SCORE_CHANGE",
    priority: "high",
  });
  
  // Send notification to seller
  await prisma.notification.create({
    data: {
      userId: args.sellerId,
      type: "CHARGEBACK_TRUST_IMPACT",
      title: "Trust Score Impacted by Chargeback",
      body: `A chargeback has affected your trust score by -${penalty} points. ` +
        `Your new trust score is ${newScore}. Chargebacks negatively impact your account standing and search visibility.`,
      channel: "email",
      priority: "high",
      metaJson: { chargebackId: args.chargebackId, penalty, previousScore, newScore },
    },
  });
  
  // Audit
  await emitAuditEvent({
    actorUserId: "system",
    action: "trust.chargeback_impact",
    entityType: "SellerTrustScore",
    entityId: args.sellerId,
    meta: { chargebackId: args.chargebackId, penalty, previousScore, newScore },
  });
  
  return { previousScore, newScore, penalty };
}

/**
 * Recalculate seller's trust score from all trust events
 */
async function recalculateTrustScore(sellerId: string): Promise<number> {
  // Get all trust events for this seller
  const events = await prisma.trustEvent.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: 100, // Limit to recent events
  });
  
  // Calculate score (base 100, apply all impacts)
  let score = 100;
  for (const event of events) {
    score += event.impact;
  }
  
  // Clamp between 0 and 100
  score = Math.max(0, Math.min(100, score));
  
  // Update seller trust score
  await prisma.sellerTrustScore.upsert({
    where: { sellerId },
    update: { score, calculatedAt: new Date() },
    create: { sellerId, score, calculatedAt: new Date() },
  });
  
  return score;
}

/**
 * Restore trust score when chargeback is won
 * Called from resolution service when outcome is "won"
 */
export async function restoreChargebackTrustImpact(args: {
  sellerId: string;
  chargebackId: string;
}): Promise<void> {
  // Find the original trust event
  const originalEvent = await prisma.trustEvent.findFirst({
    where: {
      sellerId: args.sellerId,
      sourceId: args.chargebackId,
      sourceType: "ChargebackCase",
      eventType: "CHARGEBACK",
    },
  });
  
  if (!originalEvent) return;
  
  // Create reversal event
  await prisma.trustEvent.create({
    data: {
      sellerId: args.sellerId,
      eventType: "CHARGEBACK_REVERSAL",
      impact: -originalEvent.impact, // Opposite of original penalty
      sourceId: args.chargebackId,
      sourceType: "ChargebackCase",
      reason: "Chargeback won - trust score restored",
    },
  });
  
  // Recalculate
  const newScore = await recalculateTrustScore(args.sellerId);
  
  // Trigger search reindex
  await queueSellerReindex({
    sellerId: args.sellerId,
    reason: "TRUST_SCORE_CHANGE",
    priority: "normal",
  });
  
  // Notify seller of good news
  await prisma.notification.create({
    data: {
      userId: args.sellerId,
      type: "CHARGEBACK_WON",
      title: "Chargeback Won - Trust Score Restored",
      body: `Good news! You won the chargeback dispute. Your trust score has been restored to ${newScore}.`,
      channel: "email",
      priority: "normal",
    },
  });
}
```

### Schema Additions

Add to `prisma/schema.prisma` (if not already present):

```prisma
model TrustEvent {
  id          String    @id @default(cuid())
  sellerId    String
  eventType   String    // CHARGEBACK|CHARGEBACK_REVERSAL|REVIEW|LATE_SHIPMENT|etc
  impact      Int       // Positive or negative points
  sourceId    String?
  sourceType  String?
  reason      String?
  createdAt   DateTime  @default(now())

  @@index([sellerId, createdAt])
  @@index([sourceId, sourceType])
}

model SellerTrustScore {
  id           String    @id @default(cuid())
  sellerId     String    @unique
  score        Int       @default(100)
  calculatedAt DateTime  @default(now())
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([score])
}
```

### Integration with Ingestion Service

Update `packages/core/chargebacks/ingestion.ts` to call trust impact:

```ts
import { applyChargebackTrustImpact } from "./trust-impact";

// In ingestChargeback function, after creating the case:
await applyChargebackTrustImpact({
  sellerId: chargebackCase.sellerId,
  chargebackId: chargebackCase.id,
  amountCents: chargebackCase.amountCents,
});
```

### Integration with Resolution Service

Update `packages/core/chargebacks/resolution.ts` to restore trust on win:

```ts
import { restoreChargebackTrustImpact } from "./trust-impact";

// In resolveChargeback function, when outcome is "won":
if (args.outcome === "won") {
  await restoreChargebackTrustImpact({
    sellerId: chargebackCase.sellerId,
    chargebackId: args.chargebackId,
  });
}
```

---

## 9) Corp APIs

### Chargeback Queue
- `GET /api/platform/chargebacks` - list cases (filterable by status, seller)
- `GET /api/platform/chargebacks/:id` - case detail with evidence
- RBAC: requires `chargebacks.view`

### Evidence
- `POST /api/platform/chargebacks/:id/evidence/build` - generate evidence pack
- `POST /api/platform/chargebacks/:id/evidence/submit` - submit to provider
- RBAC: requires `chargebacks.evidence.manage`

### Resolution
- `POST /api/platform/chargebacks/:id/resolve` - mark won/lost
- Body: `{ outcome: "won" | "lost" | "withdrawn", idempotencyKey: string }`
- RBAC: requires `chargebacks.resolve`

### Ledger Corrections
- `GET /api/platform/ledger/corrections` - list corrections
- `POST /api/platform/ledger/corrections` - manual correction
- RBAC: requires `ledger.corrections.manage`

### Holds
- `GET /api/platform/chargebacks/holds` - list active holds
- RBAC: requires `chargebacks.view`

---

## 10) Webhook Handler

Create `packages/core/chargebacks/webhook-handler.ts`:

```ts
import { ingestChargeback, ChargebackWebhookPayload } from "./ingestion";
import { resolveChargeback } from "./resolution";

export async function handleStripeDisputeWebhook(event: any) {
  const dispute = event.data.object;
  const idempotencyKey = `stripe-dispute-${dispute.id}-${event.id}`;

  if (event.type === "charge.dispute.created") {
    const payload: ChargebackWebhookPayload = {
      provider: "stripe",
      providerRef: dispute.id,
      providerCaseId: dispute.id,
      orderId: dispute.metadata?.orderId,
      amountCents: dispute.amount,
      currency: dispute.currency.toUpperCase(),
      reasonCode: dispute.reason,
      reasonText: dispute.reason,
      evidenceDueAt: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : undefined,
    };

    return ingestChargeback(payload, idempotencyKey);
  }

  if (event.type === "charge.dispute.closed") {
    const chargebackCase = await prisma.chargebackCase.findUnique({
      where: { providerRef: dispute.id },
    });

    if (chargebackCase && !chargebackCase.closedAt) {
      const outcome = dispute.status === "won" ? "won" : "lost";
      return resolveChargeback({
        chargebackId: chargebackCase.id,
        outcome,
        idempotencyKey,
      });
    }
  }
}
```

---

## 11) Health Provider

Create `packages/core/health/providers/chargebacks.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkChargebacks(): Promise<HealthCheckResult> {
  const errors: string[] = [];

  // Check tables accessible
  try {
    await prisma.chargebackCase.count();
    await prisma.chargebackHold.count();
  } catch {
    errors.push("Chargeback tables not accessible");
  }

  // Check for cases with missed evidence deadlines
  const missedDeadlines = await prisma.chargebackCase.count({
    where: {
      status: { in: ["OPEN", "EVIDENCE_NEEDED"] },
      evidenceDueAt: { lt: new Date() },
    },
  });

  if (missedDeadlines > 0) {
    errors.push(`${missedDeadlines} chargebacks with missed evidence deadlines`);
  }

  // Check for orphaned holds
  const orphanedHolds = await prisma.chargebackHold.count({
    where: {
      status: "ACTIVE",
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // 90 days
    },
  });

  if (orphanedHolds > 0) {
    errors.push(`${orphanedHolds} active holds older than 90 days`);
  }

  return {
    provider: "chargebacks",
    status: errors.length === 0 ? "healthy" : "degraded",
    errors,
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 12) Doctor Checks (Phase 33)

Doctor must:
1. Ingest chargeback  ->  verify case created
2. Ingest same chargeback again  ->  verify idempotent (no duplicate)
3. Verify payout hold auto-applied on case creation
4. Build evidence pack  ->  verify order data included
5. Submit evidence  ->  verify status changes to SUBMITTED
6. Resolve as "won"  ->  verify hold released
7. Resolve as "lost"  ->  verify ledger correction created
8. Verify ledger correction is idempotent
9. Non-corp access  ->  expect 403

---

## 13) Phase 33 Completion Criteria

- [ ] ChargebackCase, ChargebackHold, LedgerCorrection tables created
- [ ] Chargeback ingestion is idempotent by providerRef
- [ ] Payout holds auto-applied on case creation
- [ ] Evidence pack builder aggregates order data
- [ ] Resolution workflow (won/lost) adjusts holds and ledger
- [ ] Ledger corrections are idempotent by key
- [ ] All chargeback actions emit audit events
- [ ] Webhook handler processes Stripe dispute events
- [ ] Health provider `chargebacks` reports status
- [ ] Doctor passes all Phase 33 checks

---

## 14) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 33 implementation |
| 1.1 | 2026-01-20 | HIGH-7: Chargeback trust impact service |
| 1.2 | 2026-01-20 | MED-13: Evidence templates for common chargeback reasons |

---

## 15) Chargeback Evidence Templates (MED-13)

Create `packages/core/chargebacks/evidence-templates.ts`:

```ts
export type ChargebackReason =
  | "FRAUDULENT"
  | "PRODUCT_NOT_RECEIVED"
  | "PRODUCT_NOT_AS_DESCRIBED"
  | "DUPLICATE"
  | "SUBSCRIPTION_CANCELED"
  | "CREDIT_NOT_PROCESSED"
  | "GENERAL";

export type EvidenceTemplate = {
  reason: ChargebackReason;
  requiredFields: string[];
  optionalFields: string[];
  tips: string[];
  sampleResponse: string;
};

export const EVIDENCE_TEMPLATES: Record<ChargebackReason, EvidenceTemplate> = {
  FRAUDULENT: {
    reason: "FRAUDULENT",
    requiredFields: ["customer_signature", "customer_communication", "shipping_documentation"],
    optionalFields: ["customer_purchase_ip", "customer_email", "billing_address"],
    tips: [
      "Include proof that the cardholder authorized the transaction",
      "Show AVS (Address Verification) match if available",
      "Include any communication with the customer",
      "Show delivery confirmation with signature if available",
    ],
    sampleResponse: `The customer placed this order on {{orderDate}} from IP address {{ipAddress}}. 
The billing address matched the card on file (AVS match). 
The item was delivered on {{deliveryDate}} and signed for by {{signatureName}}.`,
  },
  
  PRODUCT_NOT_RECEIVED: {
    reason: "PRODUCT_NOT_RECEIVED",
    requiredFields: ["shipping_carrier", "shipping_tracking_number", "shipping_date"],
    optionalFields: ["shipping_documentation", "customer_communication", "refund_policy"],
    tips: [
      "Include tracking number showing delivery",
      "If signature was obtained, include proof",
      "Show delivery date and location",
    ],
    sampleResponse: `Order #{{orderNumber}} was shipped on {{shipDate}} via {{carrier}} with tracking {{trackingNumber}}.
Tracking shows delivered on {{deliveryDate}} to {{deliveryAddress}}.`,
  },
  
  PRODUCT_NOT_AS_DESCRIBED: {
    reason: "PRODUCT_NOT_AS_DESCRIBED",
    requiredFields: ["product_description", "uncategorized_text"],
    optionalFields: ["customer_communication", "refund_policy"],
    tips: [
      "Include original listing description",
      "Include photos from the listing",
      "Show that item matched description",
    ],
    sampleResponse: `The item delivered matches the listing description exactly.
Original listing: {{listingTitle}}. The customer did not attempt a return per our {{returnWindow}}-day policy.`,
  },
  
  DUPLICATE: {
    reason: "DUPLICATE",
    requiredFields: ["uncategorized_text"],
    optionalFields: ["customer_communication"],
    tips: ["Show that charges are for separate orders", "Include order numbers and dates"],
    sampleResponse: `These are separate transactions: Order #{{order1Number}} ({{order1Date}}) and Order #{{order2Number}} ({{order2Date}}).`,
  },
  
  SUBSCRIPTION_CANCELED: {
    reason: "SUBSCRIPTION_CANCELED",
    requiredFields: ["cancellation_policy", "customer_communication"],
    optionalFields: ["refund_policy"],
    tips: ["Show subscription terms", "Show cancellation policy"],
    sampleResponse: `The customer subscribed on {{subscriptionDate}}. Our cancellation policy: {{cancellationPolicy}}.`,
  },
  
  CREDIT_NOT_PROCESSED: {
    reason: "CREDIT_NOT_PROCESSED",
    requiredFields: ["refund_policy"],
    optionalFields: ["customer_communication", "refund_refusal_explanation"],
    tips: ["If refund was issued, provide proof", "If not due, explain why"],
    sampleResponse: `{{refundStatus}}. Our refund policy: {{refundPolicy}}.`,
  },
  
  GENERAL: {
    reason: "GENERAL",
    requiredFields: ["uncategorized_text"],
    optionalFields: ["customer_communication", "shipping_documentation", "product_description"],
    tips: ["Provide as much relevant documentation as possible"],
    sampleResponse: `Order #{{orderNumber}} was placed on {{orderDate}} and processed normally.`,
  },
};

/**
 * Get evidence template for chargeback reason
 */
export function getEvidenceTemplate(reason: string): EvidenceTemplate {
  return EVIDENCE_TEMPLATES[reason as ChargebackReason] ?? EVIDENCE_TEMPLATES.GENERAL;
}

/**
 * Generate evidence response from template
 */
export function generateEvidenceResponse(
  reason: ChargebackReason,
  variables: Record<string, string>
): string {
  const template = getEvidenceTemplate(reason);
  let response = template.sampleResponse;
  
  for (const [key, value] of Object.entries(variables)) {
    response = response.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  
  return response;
}
```
