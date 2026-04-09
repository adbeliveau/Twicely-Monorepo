# TWICELY V2 - Install Phase 32: Identity Verification & Risk (Seller + Account Security)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  Signals  ->  Scoring  ->  Gates  ->  Verification  ->  Health  ->  Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_32_IDENTITY_VERIFICATION_RISK.md`  
> Prereq: Phase 31 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Seller identity verification workflow (KYC-lite)
- Risk signal collection (velocity/device/IP/behavior)
- Risk scoring engine with configurable thresholds
- Step-up authentication requirements for high-risk actions
- Account security monitoring

### UI (Corp)
- Corp  ->  Risk  ->  Seller Verification Queue
- Corp  ->  Risk  ->  Risk Signals Dashboard
- Corp  ->  Risk  ->  Account Security Alerts

### UI (Seller)
- Seller  ->  Settings  ->  Verification Status
- Seller  ->  Modal  ->  Step-up verification when required

### Ops
- Health provider: `risk`
- Doctor checks: create risk signal, high-risk gate, verification workflow

### Doctor Check Implementation (Phase 32)

Add to `scripts/twicely-doctor.ts`:

```typescript
async function checkPhase32(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testSellerId = `doctor_seller_${Date.now()}`;

  // 1. Create risk signal -> verify persisted
  const signal = await prisma.riskSignal.create({
    data: {
      sellerId: testSellerId,
      signalType: "device_change",
      score: 20,
      source: "doctor_test",
      occurredAt: new Date(),
    },
  });
  checks.push({
    phase: 32,
    name: "risk.signal_create",
    status: signal?.id ? "PASS" : "FAIL",
    details: `Signal: ${signal?.signalType}, Score: ${signal?.score}`,
  });

  // 2. Add more signals to push score above threshold
  await prisma.riskSignal.create({
    data: {
      sellerId: testSellerId,
      signalType: "payout_change",
      score: 40,
      source: "doctor_test",
      occurredAt: new Date(),
    },
  });
  await prisma.riskSignal.create({
    data: {
      sellerId: testSellerId,
      signalType: "unusual_volume",
      score: 30,
      source: "doctor_test",
      occurredAt: new Date(),
    },
  });

  // Calculate total risk score
  const signals = await prisma.riskSignal.findMany({
    where: { sellerId: testSellerId },
  });
  const totalScore = signals.reduce((sum, s) => sum + s.score, 0);
  const isHighRisk = totalScore > 60;
  checks.push({
    phase: 32,
    name: "risk.high_risk_detection",
    status: isHighRisk ? "PASS" : "FAIL",
    details: `Total score: ${totalScore}, High risk: ${isHighRisk}`,
  });

  // 3. Verify high-risk actions would be blocked
  checks.push({
    phase: 32,
    name: "risk.high_risk_gate",
    status: isHighRisk && totalScore > 60 ? "PASS" : "FAIL",
    details: `Gate active for scores > 60`,
  });

  // 4. Verification case workflow -> verify state transitions
  const verificationCase = await prisma.verificationCase.create({
    data: {
      sellerId: testSellerId,
      reason: "risk_threshold",
      requiredDocuments: ["ID", "BANK_STATEMENT"],
      status: "PENDING",
      createdAt: new Date(),
    },
  });
  checks.push({
    phase: 32,
    name: "risk.verification_case_create",
    status: verificationCase?.status === "PENDING" ? "PASS" : "FAIL",
  });

  // Transition to IN_REVIEW
  await prisma.verificationCase.update({
    where: { id: verificationCase.id },
    data: { status: "IN_REVIEW" },
  });
  const updated = await prisma.verificationCase.findUnique({
    where: { id: verificationCase.id },
  });
  checks.push({
    phase: 32,
    name: "risk.verification_transition",
    status: updated?.status === "IN_REVIEW" ? "PASS" : "FAIL",
    details: `Status: ${updated?.status}`,
  });

  // Cleanup
  await prisma.verificationCase.delete({ where: { id: verificationCase.id } });
  await prisma.riskSignal.deleteMany({ where: { sellerId: testSellerId } });

  return checks;
}
```


---

## 1) Risk Invariants (non-negotiable)

- All risk signals are append-only (no deletes)
- High-risk actions MUST be blocked until verification
- Verification cases require audit trail
- Step-up requirements apply to:
  - Payout destination changes
  - Large withdrawal requests
  - Account credential changes
  - Unusual velocity patterns

Risk thresholds (configurable):
- Score 0-30: LOW (no friction)
- Score 31-60: MEDIUM (soft warning)
- Score 61-80: HIGH (step-up required)
- Score 81-100: CRITICAL (action blocked)

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model RiskSignal {
  id         String   @id @default(cuid())
  userId     String?
  sellerId   String?
  type       String   // ip_velocity|device_change|login_failures|payout_change|unusual_volume|geo_anomaly
  score      Int      // 0-100
  severity   String   @default("LOW") // LOW|MEDIUM|HIGH|CRITICAL
  metaJson   Json     @default("{}")
  resolved   Boolean  @default(false)
  resolvedAt DateTime?
  resolvedByStaffId String?
  occurredAt DateTime @default(now())

  @@index([sellerId, occurredAt])
  @@index([userId, occurredAt])
  @@index([type, occurredAt])
  @@index([severity, resolved])
}

model SellerVerificationCase {
  id               String    @id @default(cuid())
  sellerId         String    @unique
  status           String    @default("PENDING") // PENDING|IN_REVIEW|APPROVED|REJECTED|NEEDS_INFO
  verificationType String    @default("standard") // standard|enhanced|manual
  submittedDocs    Json      @default("[]") // array of doc references
  notes            String?
  rejectionReason  String?
  assignedToStaffId String?
  updatedByStaffId String?
  submittedAt      DateTime?
  reviewedAt       DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([status, createdAt])
  @@index([assignedToStaffId, status])
}

model AccountSecurityEvent {
  id          String   @id @default(cuid())
  userId      String
  eventType   String   // login|logout|password_change|mfa_enable|mfa_disable|recovery_attempt
  ipAddress   String?
  userAgent   String?
  deviceId    String?
  location    String?  // geo approximation
  success     Boolean  @default(true)
  metaJson    Json     @default("{}")
  occurredAt  DateTime @default(now())

  @@index([userId, occurredAt])
  @@index([eventType, occurredAt])
  @@index([ipAddress, occurredAt])
}

model RiskThreshold {
  id          String   @id @default(cuid())
  action      String   @unique // payout_change|large_withdrawal|credential_change
  warnAt      Int      @default(31)
  stepUpAt    Int      @default(61)
  blockAt     Int      @default(81)
  isActive    Boolean  @default(true)
  updatedAt   DateTime @updatedAt
}
```

Migration:
```bash
npx prisma migrate dev --name identity_risk_phase32
```

---

## 3) Risk Signal Types

Create `packages/core/risk/signal-types.ts`:

```ts
export const RISK_SIGNAL_TYPES = {
  IP_VELOCITY: "ip_velocity",           // Too many requests from same IP
  DEVICE_CHANGE: "device_change",       // New device detected
  LOGIN_FAILURES: "login_failures",     // Multiple failed login attempts
  PAYOUT_CHANGE: "payout_change",       // Payout destination modified
  UNUSUAL_VOLUME: "unusual_volume",     // Sudden spike in activity
  GEO_ANOMALY: "geo_anomaly",          // Login from unusual location
  CARD_VELOCITY: "card_velocity",       // Multiple card attempts
  REFUND_ABUSE: "refund_abuse",        // Pattern of refund requests
  ACCOUNT_AGE: "account_age",          // New account high-value action
} as const;

export type RiskSignalType = typeof RISK_SIGNAL_TYPES[keyof typeof RISK_SIGNAL_TYPES];

export const SIGNAL_BASE_SCORES: Record<RiskSignalType, number> = {
  ip_velocity: 15,
  device_change: 20,
  login_failures: 25,
  payout_change: 40,
  unusual_volume: 30,
  geo_anomaly: 35,
  card_velocity: 45,
  refund_abuse: 50,
  account_age: 25,
};
```

---

## 4) Risk Scoring Engine

Create `packages/core/risk/scoring.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { SIGNAL_BASE_SCORES, RiskSignalType } from "./signal-types";

const prisma = new PrismaClient();

export type RiskScore = {
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  signals: Array<{ type: string; score: number; occurredAt: Date }>;
  recommendation: "allow" | "warn" | "step_up" | "block";
};

export async function computeRiskScore(args: {
  userId?: string;
  sellerId?: string;
  action: string;
  windowHours?: number;
}): Promise<RiskScore> {
  const windowHours = args.windowHours ?? 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Get recent unresolved signals
  const signals = await prisma.riskSignal.findMany({
    where: {
      OR: [
        { userId: args.userId },
        { sellerId: args.sellerId },
      ],
      occurredAt: { gte: since },
      resolved: false,
    },
    orderBy: { occurredAt: "desc" },
  });

  // Calculate aggregate score (capped at 100)
  const rawScore = signals.reduce((sum, s) => sum + s.score, 0);
  const score = Math.min(rawScore, 100);

  // Determine severity
  let severity: RiskScore["severity"] = "LOW";
  if (score >= 81) severity = "CRITICAL";
  else if (score >= 61) severity = "HIGH";
  else if (score >= 31) severity = "MEDIUM";

  // Get threshold for action
  const threshold = await prisma.riskThreshold.findUnique({
    where: { action: args.action },
  });

  // Determine recommendation
  let recommendation: RiskScore["recommendation"] = "allow";
  if (threshold) {
    if (score >= threshold.blockAt) recommendation = "block";
    else if (score >= threshold.stepUpAt) recommendation = "step_up";
    else if (score >= threshold.warnAt) recommendation = "warn";
  } else {
    // Default thresholds
    if (score >= 81) recommendation = "block";
    else if (score >= 61) recommendation = "step_up";
    else if (score >= 31) recommendation = "warn";
  }

  return {
    score,
    severity,
    signals: signals.map((s) => ({
      type: s.type,
      score: s.score,
      occurredAt: s.occurredAt,
    })),
    recommendation,
  };
}

export function severityFromScore(score: number): string {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}
```

---

## 5) Risk Signal Service

Create `packages/core/risk/signals.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { SIGNAL_BASE_SCORES, RiskSignalType } from "./signal-types";
import { severityFromScore } from "./scoring";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function recordRiskSignal(args: {
  userId?: string;
  sellerId?: string;
  type: RiskSignalType;
  scoreMultiplier?: number;
  meta?: Record<string, unknown>;
}) {
  const baseScore = SIGNAL_BASE_SCORES[args.type] ?? 10;
  const score = Math.round(baseScore * (args.scoreMultiplier ?? 1));
  const severity = severityFromScore(score);

  const signal = await prisma.riskSignal.create({
    data: {
      userId: args.userId,
      sellerId: args.sellerId,
      type: args.type,
      score,
      severity,
      metaJson: args.meta ?? {},
    },
  });

  await emitAuditEvent({
    action: "risk.signal.recorded",
    entityType: "RiskSignal",
    entityId: signal.id,
    meta: { type: args.type, score, severity },
  });

  return signal;
}

export async function resolveRiskSignal(args: {
  signalId: string;
  staffActorId: string;
  reason?: string;
}) {
  const signal = await prisma.riskSignal.update({
    where: { id: args.signalId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedByStaffId: args.staffActorId,
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "risk.signal.resolved",
    entityType: "RiskSignal",
    entityId: signal.id,
    meta: { reason: args.reason },
  });

  return signal;
}
```

---

## 6) Risk Gate (Action Blocker)

Create `packages/core/risk/gate.ts`:

```ts
import { computeRiskScore, RiskScore } from "./scoring";

export class RiskBlockedError extends Error {
  public score: RiskScore;
  public action: string;

  constructor(action: string, score: RiskScore) {
    super(`RISK_BLOCKED:${action} (score=${score.score}, severity=${score.severity})`);
    this.name = "RiskBlockedError";
    this.action = action;
    this.score = score;
  }
}

export class StepUpRequiredError extends Error {
  public score: RiskScore;
  public action: string;

  constructor(action: string, score: RiskScore) {
    super(`STEP_UP_REQUIRED:${action} (score=${score.score})`);
    this.name = "StepUpRequiredError";
    this.action = action;
    this.score = score;
  }
}

export async function assertRiskAllowed(args: {
  userId?: string;
  sellerId?: string;
  action: string;
  bypassStepUp?: boolean;
}): Promise<RiskScore> {
  const score = await computeRiskScore({
    userId: args.userId,
    sellerId: args.sellerId,
    action: args.action,
  });

  if (score.recommendation === "block") {
    throw new RiskBlockedError(args.action, score);
  }

  if (score.recommendation === "step_up" && !args.bypassStepUp) {
    throw new StepUpRequiredError(args.action, score);
  }

  return score;
}
```

---

## 7) Seller Verification Service

Create `packages/core/risk/verification.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function createVerificationCase(args: {
  sellerId: string;
  verificationType?: string;
}) {
  const existing = await prisma.sellerVerificationCase.findUnique({
    where: { sellerId: args.sellerId },
  });

  if (existing) {
    return existing;
  }

  const verCase = await prisma.sellerVerificationCase.create({
    data: {
      sellerId: args.sellerId,
      verificationType: args.verificationType ?? "standard",
    },
  });

  await emitAuditEvent({
    action: "risk.verification.created",
    entityType: "SellerVerificationCase",
    entityId: verCase.id,
    meta: { sellerId: args.sellerId },
  });

  return verCase;
}

export async function submitVerificationDocs(args: {
  sellerId: string;
  docs: Array<{ type: string; url: string }>;
}) {
  const verCase = await prisma.sellerVerificationCase.update({
    where: { sellerId: args.sellerId },
    data: {
      status: "IN_REVIEW",
      submittedDocs: args.docs,
      submittedAt: new Date(),
    },
  });

  await emitAuditEvent({
    action: "risk.verification.docs_submitted",
    entityType: "SellerVerificationCase",
    entityId: verCase.id,
    meta: { docCount: args.docs.length },
  });

  return verCase;
}

export async function reviewVerificationCase(args: {
  sellerId: string;
  staffActorId: string;
  decision: "APPROVED" | "REJECTED" | "NEEDS_INFO";
  notes?: string;
  rejectionReason?: string;
}) {
  const verCase = await prisma.sellerVerificationCase.update({
    where: { sellerId: args.sellerId },
    data: {
      status: args.decision,
      notes: args.notes,
      rejectionReason: args.decision === "REJECTED" ? args.rejectionReason : null,
      updatedByStaffId: args.staffActorId,
      reviewedAt: new Date(),
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "risk.verification.reviewed",
    entityType: "SellerVerificationCase",
    entityId: verCase.id,
    meta: { decision: args.decision, rejectionReason: args.rejectionReason },
  });

  return verCase;
}

export async function isSellerVerified(sellerId: string): Promise<boolean> {
  const verCase = await prisma.sellerVerificationCase.findUnique({
    where: { sellerId },
  });

  return verCase?.status === "APPROVED";
}
```

---

## 8) Account Security Events

Create `packages/core/risk/security-events.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { recordRiskSignal } from "./signals";
import { RISK_SIGNAL_TYPES } from "./signal-types";

const prisma = new PrismaClient();

export async function recordSecurityEvent(args: {
  userId: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  location?: string;
  success: boolean;
  meta?: Record<string, unknown>;
}) {
  const event = await prisma.accountSecurityEvent.create({
    data: {
      userId: args.userId,
      eventType: args.eventType,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      deviceId: args.deviceId,
      location: args.location,
      success: args.success,
      metaJson: args.meta ?? {},
    },
  });

  // Auto-generate risk signals for certain events
  if (args.eventType === "login" && !args.success) {
    // Check for velocity
    const recentFailures = await prisma.accountSecurityEvent.count({
      where: {
        userId: args.userId,
        eventType: "login",
        success: false,
        occurredAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // 15 min
      },
    });

    if (recentFailures >= 3) {
      await recordRiskSignal({
        userId: args.userId,
        type: RISK_SIGNAL_TYPES.LOGIN_FAILURES,
        scoreMultiplier: Math.min(recentFailures / 3, 2),
        meta: { failureCount: recentFailures },
      });
    }
  }

  return event;
}

export async function detectDeviceChange(args: {
  userId: string;
  deviceId: string;
}): Promise<boolean> {
  const knownDevices = await prisma.accountSecurityEvent.findMany({
    where: {
      userId: args.userId,
      deviceId: { not: null },
    },
    distinct: ["deviceId"],
    take: 10,
    orderBy: { occurredAt: "desc" },
  });

  const isNewDevice = !knownDevices.some((e) => e.deviceId === args.deviceId);

  if (isNewDevice && knownDevices.length > 0) {
    await recordRiskSignal({
      userId: args.userId,
      type: RISK_SIGNAL_TYPES.DEVICE_CHANGE,
      meta: { newDeviceId: args.deviceId },
    });
  }

  return isNewDevice;
}
```

---

## 9) Corp APIs

### Risk Signals
- `GET /api/platform/risk/signals` - list signals (filterable)
- `POST /api/platform/risk/signals/:id/resolve` - resolve signal
- RBAC: requires `risk.signals.view` / `risk.signals.resolve`

### Verification Cases
- `GET /api/platform/risk/verifications` - list verification queue
- `GET /api/platform/risk/verifications/:sellerId` - get case detail
- `POST /api/platform/risk/verifications/:sellerId/review` - review case
- RBAC: requires `risk.verifications.view` / `risk.verifications.review`

### Thresholds
- `GET /api/platform/risk/thresholds` - list thresholds
- `PUT /api/platform/risk/thresholds/:action` - update threshold
- RBAC: requires `risk.config.manage`

### Security Events
- `GET /api/platform/risk/security-events` - list events
- RBAC: requires `risk.security.view`

---

## 10) Seller APIs

- `GET /api/seller/verification` - get own verification status
- `POST /api/seller/verification/submit` - submit verification docs

---

## 11) Health Provider

Create `packages/core/health/providers/risk.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkRisk(): Promise<HealthCheckResult> {
  const errors: string[] = [];

  // Check tables accessible
  try {
    await prisma.riskSignal.count();
    await prisma.sellerVerificationCase.count();
  } catch {
    errors.push("Risk tables not accessible");
  }

  // Check for critical unresolved signals
  const criticalCount = await prisma.riskSignal.count({
    where: {
      severity: "CRITICAL",
      resolved: false,
      occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (criticalCount > 10) {
    errors.push(`${criticalCount} unresolved CRITICAL risk signals in 24h`);
  }

  // Check verification queue backlog
  const pendingVerifications = await prisma.sellerVerificationCase.count({
    where: {
      status: { in: ["PENDING", "IN_REVIEW"] },
      createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
  });

  if (pendingVerifications > 50) {
    errors.push(`${pendingVerifications} verifications pending >48h`);
  }

  return {
    provider: "risk",
    status: errors.length === 0 ? "healthy" : "degraded",
    errors,
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 12) Doctor Checks (Phase 32)

Doctor must:
1. Create risk signal  ->  verify persisted + severity computed
2. Compute risk score  ->  verify aggregation works
3. High-risk action with score  81  ->  verify blocked
4. Step-up action with score 61-80  ->  verify StepUpRequiredError
5. Create verification case  ->  verify PENDING status
6. Submit docs  ->  verify status changes to IN_REVIEW
7. Review case (approve/reject)  ->  verify audit event
8. Record security event  ->  verify auto-signal on failures
9. Non-corp access to risk APIs  ->  expect 403

---

## 13) Phase 32 Completion Criteria

- [ ] RiskSignal, SellerVerificationCase, AccountSecurityEvent tables created
- [ ] Risk signal recording with auto-severity working
- [ ] Risk scoring aggregates signals correctly
- [ ] Risk gate blocks/step-up based on thresholds
- [ ] Verification case workflow (create  ->  submit  ->  review) working
- [ ] Security events trigger auto-signals on patterns
- [ ] All risk actions emit audit events
- [ ] Health provider `risk` reports status
- [ ] Doctor passes all Phase 32 checks
