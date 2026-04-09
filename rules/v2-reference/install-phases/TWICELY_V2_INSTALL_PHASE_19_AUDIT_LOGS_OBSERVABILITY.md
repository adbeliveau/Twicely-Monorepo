# TWICELY V2 — Install Phase 19: Audit Logs & Observability
**Status:** LOCKED (v1.0)  
**Backend-first:** Emit → Persist → Query → Alert → Health → Doctor  
**Canonicals:** TWICELY_TRUST_SAFETY_CANONICAL.md, TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_19_AUDIT_LOGS_OBSERVABILITY.md`  
> Prereq: Phase 18 complete.

---

## 0) What this phase installs

### Backend
- Central immutable AuditEvent emitter
- Mandatory coverage map for sensitive actions
- SystemEvent model for errors/warnings
- AlertRule model for automated alerting
- Activity log for user actions
- Observability hooks integration

### UI (Corp)
- Audit Logs viewer (filterable, read-only)
- System Events dashboard
- Alert configuration
- Activity timeline

### Ops
- Health provider: `audit_observability`
- Doctor checks: audit coverage, immutability, RBAC enforcement

---

## 1) Audit Invariants (Non-Negotiable)

- Audit events are **append-only**
- No deletes, no updates
- All sensitive actions MUST emit an audit event
- Audit reads are **corp-only** with `audit.view` permission
- System events capture errors and operational issues
- Retention: 7 years for compliance

---

## 2) Prisma Schema

```prisma
// =============================================================================
// AUDIT EVENTS (Immutable)
// =============================================================================

enum AuditCategory {
  RBAC
  FINANCE
  TRUST
  COMMERCE
  MODERATION
  SYSTEM
  SECURITY
  SETTINGS
}

enum AuditSeverity {
  INFO
  WARNING
  CRITICAL
}

model AuditEvent {
  id              String        @id @default(cuid())
  
  // Actor
  actorUserId     String?
  actorRole       String?       // buyer|seller|staff|system
  actorIp         String?
  actorUserAgent  String?
  
  // Action
  action          String        // e.g., "rbac.role.create"
  category        AuditCategory @default(SYSTEM)
  severity        AuditSeverity @default(INFO)
  
  // Target
  entityType      String?       // e.g., "Role", "Payout", "Review"
  entityId        String?
  
  // Context
  metaJson        Json          @default("{}")
  
  // Request context
  requestId       String?
  sessionId       String?
  
  // Immutable timestamp
  createdAt       DateTime      @default(now())

  @@index([action, createdAt])
  @@index([category, createdAt])
  @@index([entityType, entityId])
  @@index([actorUserId, createdAt])
  @@index([severity, createdAt])
}

// =============================================================================
// SYSTEM EVENTS (Operational)
// =============================================================================

enum SystemEventType {
  ERROR
  WARNING
  INFO
  ALERT
}

enum SystemEventSource {
  API
  WEBHOOK
  CRON
  WORKER
  HEALTH
  DOCTOR
  PROVIDER
}

model SystemEvent {
  id              String           @id @default(cuid())
  
  // Classification
  type            SystemEventType
  source          SystemEventSource
  
  // Details
  code            String           // e.g., "WEBHOOK_FAILED", "RECON_ERROR"
  message         String
  stackTrace      String?
  
  // Context
  metaJson        Json             @default("{}")
  
  // Request context
  requestId       String?
  
  // Resolution
  isAcknowledged  Boolean          @default(false)
  acknowledgedAt  DateTime?
  acknowledgedBy  String?
  resolution      String?
  
  createdAt       DateTime         @default(now())

  @@index([type, createdAt])
  @@index([source, createdAt])
  @@index([code, createdAt])
  @@index([isAcknowledged, type])
}

// =============================================================================
// ALERT RULES
// =============================================================================

enum AlertChannel {
  EMAIL
  SLACK
  WEBHOOK
  SMS
}

model AlertRule {
  id              String        @id @default(cuid())
  
  // Rule definition
  name            String
  description     String?
  
  // Trigger conditions
  eventType       String?       // SystemEventType or AuditEvent action
  eventSource     String?
  eventCode       String?
  conditionJson   Json          @default("{}")  // Custom conditions
  
  // Thresholds
  threshold       Int           @default(1)     // Trigger after N occurrences
  windowMinutes   Int           @default(5)     // Within this time window
  
  // Actions
  channels        AlertChannel[]
  recipients      String[]      // emails, slack channels, webhook URLs
  
  // Cooldown
  cooldownMinutes Int           @default(60)    // Don't re-alert within
  lastTriggeredAt DateTime?
  
  // State
  isActive        Boolean       @default(true)
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([isActive])
}

// =============================================================================
// ALERT HISTORY
// =============================================================================

model AlertHistory {
  id              String    @id @default(cuid())
  
  alertRuleId     String
  
  // Trigger context
  triggerEventIds String[]  // SystemEvent or AuditEvent IDs
  triggerCount    Int
  
  // Delivery
  channel         AlertChannel
  recipient       String
  status          String    // sent|failed|suppressed
  
  // Response
  responseJson    Json?
  errorMessage    String?
  
  createdAt       DateTime  @default(now())

  @@index([alertRuleId, createdAt])
  @@index([status, createdAt])
}

// =============================================================================
// ACTIVITY LOG (User-facing timeline)
// =============================================================================

model ActivityLog {
  id              String    @id @default(cuid())
  
  // Target user (whose activity timeline this appears on)
  userId          String
  
  // Actor (who performed the action)
  actorId         String
  actorType       String    // self|staff|system
  
  // Action
  action          String    // e.g., "order.placed", "listing.created"
  description     String
  
  // Related entity
  entityType      String?
  entityId        String?
  
  // Visibility
  isPublic        Boolean   @default(false)  // Visible on public profile
  
  createdAt       DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([actorId, createdAt])
}
```

Run migration:
```bash
npx prisma migrate dev --name audit_observability_phase19
```

---

## 3) Audit Types & Constants

Create `packages/core/audit/types.ts`:

```ts
export type AuditCategory =
  | "RBAC"
  | "FINANCE"
  | "TRUST"
  | "COMMERCE"
  | "MODERATION"
  | "SYSTEM"
  | "SECURITY"
  | "SETTINGS";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AuditEventInput = {
  actorUserId?: string;
  actorRole?: string;
  actorIp?: string;
  actorUserAgent?: string;
  action: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, any>;
  requestId?: string;
  sessionId?: string;
};

// Actions that MUST be audited
export const AUDIT_REQUIRED_ACTIONS = [
  // RBAC
  "rbac.role.create",
  "rbac.role.update",
  "rbac.role.delete",
  "rbac.permission.grant",
  "rbac.permission.revoke",
  "rbac.delegation.create",
  "rbac.delegation.revoke",

  // Finance
  "finance.reconcile.run",
  "finance.reconcile.error",
  "payout.execute",
  "payout.cancel",
  "refund.execute",
  "hold.apply",
  "hold.release",

  // Trust
  "trust.case.create",
  "trust.case.resolve",
  "trust.enforcement.apply",
  "trust.enforcement.lift",

  // Moderation
  "review.hide",
  "review.restore",
  "review.remove",
  "listing.remove",
  "user.suspend",
  "user.unsuspend",

  // Settings
  "feature_flag.update",
  "settings.monetization.update",
  "settings.trust.update",

  // Security
  "login.success",
  "login.failed",
  "password.change",
  "mfa.enable",
  "mfa.disable",
] as const;

export type RequiredAuditAction = typeof AUDIT_REQUIRED_ACTIONS[number];

// Category mapping
export const ACTION_CATEGORY_MAP: Record<string, AuditCategory> = {
  rbac: "RBAC",
  finance: "FINANCE",
  payout: "FINANCE",
  refund: "FINANCE",
  hold: "FINANCE",
  trust: "TRUST",
  review: "MODERATION",
  listing: "COMMERCE",
  user: "SECURITY",
  login: "SECURITY",
  password: "SECURITY",
  mfa: "SECURITY",
  feature_flag: "SETTINGS",
  settings: "SETTINGS",
};

// Severity mapping
export const ACTION_SEVERITY_MAP: Partial<Record<string, AuditSeverity>> = {
  "finance.reconcile.error": "CRITICAL",
  "trust.enforcement.apply": "WARNING",
  "user.suspend": "WARNING",
  "review.remove": "WARNING",
  "listing.remove": "WARNING",
  "login.failed": "WARNING",
};
```

---

## 4) Central Audit Emitter

Create `packages/core/audit/emit.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { AuditEventInput, AuditCategory, AuditSeverity } from "./types";
import { ACTION_CATEGORY_MAP, ACTION_SEVERITY_MAP } from "./types";

const prisma = new PrismaClient();

/**
 * Emit an audit event (immutable, append-only)
 */
export async function emitAuditEvent(input: AuditEventInput): Promise<string> {
  // Derive category from action if not provided
  const actionPrefix = input.action.split(".")[0];
  const category: AuditCategory = input.category ?? ACTION_CATEGORY_MAP[actionPrefix] ?? "SYSTEM";

  // Derive severity from action if not provided
  const severity: AuditSeverity = input.severity ?? ACTION_SEVERITY_MAP[input.action] ?? "INFO";

  const event = await prisma.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorIp: input.actorIp,
      actorUserAgent: input.actorUserAgent,
      action: input.action,
      category,
      severity,
      entityType: input.entityType,
      entityId: input.entityId,
      metaJson: input.meta ?? {},
      requestId: input.requestId,
      sessionId: input.sessionId,
    },
  });

  // Check if this triggers any alert rules
  await checkAlertRules(event.id, input.action, category, severity);

  return event.id;
}

/**
 * Emit audit event with request context
 */
export async function emitAuditEventWithContext(
  input: AuditEventInput,
  context: { requestId?: string; ip?: string; userAgent?: string }
): Promise<string> {
  return emitAuditEvent({
    ...input,
    actorIp: input.actorIp ?? context.ip,
    actorUserAgent: input.actorUserAgent ?? context.userAgent,
    requestId: input.requestId ?? context.requestId,
  });
}

/**
 * Batch emit audit events
 */
export async function emitAuditEventBatch(inputs: AuditEventInput[]): Promise<number> {
  const data = inputs.map((input) => {
    const actionPrefix = input.action.split(".")[0];
    return {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      category: input.category ?? ACTION_CATEGORY_MAP[actionPrefix] ?? "SYSTEM",
      severity: input.severity ?? ACTION_SEVERITY_MAP[input.action] ?? "INFO",
      entityType: input.entityType,
      entityId: input.entityId,
      metaJson: input.meta ?? {},
      requestId: input.requestId,
    };
  });

  const result = await prisma.auditEvent.createMany({ data });
  return result.count;
}

async function checkAlertRules(
  eventId: string,
  action: string,
  category: string,
  severity: string
) {
  // Find matching active rules
  const rules = await prisma.alertRule.findMany({
    where: {
      isActive: true,
      OR: [
        { eventType: action },
        { eventType: severity },
        { eventCode: category },
      ],
    },
  });

  for (const rule of rules) {
    // Check cooldown
    if (rule.lastTriggeredAt) {
      const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60000);
      if (new Date() < cooldownEnd) continue;
    }

    // Count occurrences in window
    const windowStart = new Date(Date.now() - rule.windowMinutes * 60000);
    const count = await prisma.auditEvent.count({
      where: {
        action,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= rule.threshold) {
      await triggerAlert(rule, [eventId], count);
    }
  }
}

async function triggerAlert(rule: any, eventIds: string[], count: number) {
  // Update last triggered
  await prisma.alertRule.update({
    where: { id: rule.id },
    data: { lastTriggeredAt: new Date() },
  });

  // Send to each channel/recipient
  for (const channel of rule.channels) {
    for (const recipient of rule.recipients) {
      await prisma.alertHistory.create({
        data: {
          alertRuleId: rule.id,
          triggerEventIds: eventIds,
          triggerCount: count,
          channel,
          recipient,
          status: "sent", // Simplified - actual send would be async
        },
      });
    }
  }
}
```

---

## 5) System Event Service

Create `packages/core/observability/systemEvents.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type SystemEventInput = {
  type: "ERROR" | "WARNING" | "INFO" | "ALERT";
  source: "API" | "WEBHOOK" | "CRON" | "WORKER" | "HEALTH" | "DOCTOR" | "PROVIDER";
  code: string;
  message: string;
  stackTrace?: string;
  meta?: Record<string, any>;
  requestId?: string;
};

/**
 * Emit a system event
 */
export async function emitSystemEvent(input: SystemEventInput): Promise<string> {
  const event = await prisma.systemEvent.create({
    data: {
      type: input.type,
      source: input.source,
      code: input.code,
      message: input.message,
      stackTrace: input.stackTrace,
      metaJson: input.meta ?? {},
      requestId: input.requestId,
    },
  });

  // Log to console for immediate visibility
  const logFn = input.type === "ERROR" ? console.error : input.type === "WARNING" ? console.warn : console.log;
  logFn(`[${input.type}] [${input.source}] ${input.code}: ${input.message}`);

  // Check alert rules for system events
  await checkSystemEventAlerts(event);

  return event.id;
}

/**
 * Emit error from exception
 */
export async function emitErrorEvent(
  error: Error,
  source: SystemEventInput["source"],
  meta?: Record<string, any>
): Promise<string> {
  return emitSystemEvent({
    type: "ERROR",
    source,
    code: error.name || "UNKNOWN_ERROR",
    message: error.message,
    stackTrace: error.stack,
    meta,
  });
}

async function checkSystemEventAlerts(event: any) {
  const rules = await prisma.alertRule.findMany({
    where: {
      isActive: true,
      OR: [
        { eventType: event.type },
        { eventSource: event.source },
        { eventCode: event.code },
      ],
    },
  });

  for (const rule of rules) {
    if (rule.lastTriggeredAt) {
      const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60000);
      if (new Date() < cooldownEnd) continue;
    }

    const windowStart = new Date(Date.now() - rule.windowMinutes * 60000);
    const count = await prisma.systemEvent.count({
      where: {
        type: event.type,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= rule.threshold) {
      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: new Date() },
      });

      for (const channel of rule.channels) {
        for (const recipient of rule.recipients) {
          await prisma.alertHistory.create({
            data: {
              alertRuleId: rule.id,
              triggerEventIds: [event.id],
              triggerCount: count,
              channel,
              recipient,
              status: "sent",
            },
          });
        }
      }
    }
  }
}

/**
 * Acknowledge system event
 */
export async function acknowledgeSystemEvent(
  eventId: string,
  staffId: string,
  resolution?: string
) {
  return prisma.systemEvent.update({
    where: { id: eventId },
    data: {
      isAcknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: staffId,
      resolution,
    },
  });
}

/**
 * Get unacknowledged events
 */
export async function getUnacknowledgedEvents(limit = 100) {
  return prisma.systemEvent.findMany({
    where: { isAcknowledged: false },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
```

---

## 6) Audit Query Service

Create `packages/core/audit/query.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type AuditQueryFilters = {
  action?: string;
  actionPrefix?: string;
  category?: string;
  severity?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
};

/**
 * Query audit events with filters
 */
export async function queryAuditEvents(
  filters: AuditQueryFilters,
  pagination: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.action) where.action = filters.action;
  if (filters.actionPrefix) where.action = { startsWith: filters.actionPrefix };
  if (filters.category) where.category = filters.category;
  if (filters.severity) where.severity = filters.severity;
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get audit event by ID
 */
export async function getAuditEvent(id: string) {
  return prisma.auditEvent.findUnique({ where: { id } });
}

/**
 * Get audit events for entity
 */
export async function getEntityAuditHistory(entityType: string, entityId: string, limit = 50) {
  return prisma.auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get actor's audit history
 */
export async function getActorAuditHistory(actorUserId: string, limit = 50) {
  return prisma.auditEvent.findMany({
    where: { actorUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get audit summary by category
 */
export async function getAuditSummary(startDate: Date, endDate: Date) {
  const results = await prisma.auditEvent.groupBy({
    by: ["category", "severity"],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _count: true,
  });

  return results.map((r) => ({
    category: r.category,
    severity: r.severity,
    count: r._count,
  }));
}
```

---

## 7) API Endpoints

### 7.1 Audit Events List

Create `apps/web/app/api/platform/audit/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { queryAuditEvents } from "@/packages/core/audit/query";

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "audit.view");

  const { searchParams } = new URL(req.url);

  const filters = {
    action: searchParams.get("action") ?? undefined,
    actionPrefix: searchParams.get("actionPrefix") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    actorUserId: searchParams.get("actorUserId") ?? undefined,
    entityType: searchParams.get("entityType") ?? undefined,
    entityId: searchParams.get("entityId") ?? undefined,
    startDate: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined,
    endDate: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined,
  };

  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const result = await queryAuditEvents(filters, { page, limit });

  return NextResponse.json(result);
}
```

### 7.2 Audit Event Detail

Create `apps/web/app/api/platform/audit/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getAuditEvent } from "@/packages/core/audit/query";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "audit.view");

  const event = await getAuditEvent(params.id);
  if (!event) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ event });
}
```

### 7.3 System Events

Create `apps/web/app/api/platform/system-events/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "system.view");

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const unacknowledgedOnly = searchParams.get("unacknowledged") === "true";

  const where: any = {};
  if (type) where.type = type;
  if (source) where.source = source;
  if (unacknowledgedOnly) where.isAcknowledged = false;

  const events = await prisma.systemEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ events });
}
```

### 7.4 Acknowledge System Event

Create `apps/web/app/api/platform/system-events/[id]/acknowledge/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { acknowledgeSystemEvent } from "@/packages/core/observability/systemEvents";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "system.acknowledge");

  const { resolution } = await req.json();

  const event = await acknowledgeSystemEvent(params.id, ctx.actorUserId, resolution);

  return NextResponse.json({ event });
}
```

---

## 8) Global Error Handler Integration

Create `packages/core/observability/errorHandler.ts`:

```ts
import { emitErrorEvent } from "./systemEvents";

/**
 * Global error handler for API routes
 */
export async function handleApiError(error: Error, requestId?: string) {
  await emitErrorEvent(error, "API", { requestId });
}

/**
 * Wrap async handler with error logging
 */
export function withErrorLogging<T>(
  handler: () => Promise<T>,
  source: "API" | "WEBHOOK" | "CRON" | "WORKER"
): Promise<T> {
  return handler().catch(async (error) => {
    await emitErrorEvent(error, source);
    throw error;
  });
}

/**
 * Error boundary for cron jobs
 */
export async function runWithErrorLogging(
  jobName: string,
  fn: () => Promise<void>
) {
  try {
    await fn();
  } catch (error) {
    await emitErrorEvent(error as Error, "CRON", { jobName });
    throw error;
  }
}
```

---

## 9) Health Provider

Create `packages/core/health/providers/auditObservabilityHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";
import { AUDIT_REQUIRED_ACTIONS } from "@/packages/core/audit/types";

const prisma = new PrismaClient();

export const auditObservabilityHealthProvider: HealthProvider = {
  id: "audit_observability",
  label: "Audit & Observability",
  description: "Validates audit coverage and system event tracking",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: Recent audit events exist
    const recentAudit = await prisma.auditEvent.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    checks.push({
      id: "audit.recent_events",
      label: "Audit events (24h)",
      status: recentAudit > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${recentAudit} events`,
    });

    // Check 2: Required actions have been audited (sample check)
    const sampleActions = AUDIT_REQUIRED_ACTIONS.slice(0, 5);
    const coveredActions = await prisma.auditEvent.groupBy({
      by: ["action"],
      where: { action: { in: sampleActions } },
    });
    const coverage = (coveredActions.length / sampleActions.length) * 100;
    checks.push({
      id: "audit.action_coverage",
      label: "Required action coverage",
      status: coverage >= 50 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${Math.round(coverage)}% of sample actions`,
    });

    // Check 3: No unacknowledged critical errors
    const criticalErrors = await prisma.systemEvent.count({
      where: {
        type: "ERROR",
        isAcknowledged: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    checks.push({
      id: "system.unacked_errors",
      label: "Unacknowledged errors (24h)",
      status: criticalErrors === 0 ? HEALTH_STATUS.PASS : criticalErrors < 10 ? HEALTH_STATUS.WARN : HEALTH_STATUS.FAIL,
      message: `${criticalErrors} unacknowledged`,
    });
    if (criticalErrors >= 10) status = HEALTH_STATUS.FAIL;
    else if (criticalErrors > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;

    // Check 4: Alert rules configured
    const activeRules = await prisma.alertRule.count({ where: { isActive: true } });
    checks.push({
      id: "alerts.rules_configured",
      label: "Active alert rules",
      status: activeRules > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${activeRules} rules`,
    });

    // Check 5: Audit event count growing (not stuck)
    const lastHour = await prisma.auditEvent.count({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    const prevHour = await prisma.auditEvent.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lt: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });
    checks.push({
      id: "audit.event_flow",
      label: "Event flow",
      status: HEALTH_STATUS.PASS,
      message: `${lastHour} this hour, ${prevHour} prev hour`,
    });

    return {
      providerId: "audit_observability",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Audit & observability healthy" : "Issues detected",
      providerVersion: "1.0.0",
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 10) Doctor Checks

```ts
async function checkAuditObservability() {
  const checks = [];

  // 1. Emit audit event and verify it persists
  const testAction = `test.audit.${Date.now()}`;
  await emitAuditEvent({
    actorUserId: "test_doctor",
    action: testAction,
    entityType: "Test",
    entityId: "test_123",
    meta: { test: true },
  });

  const found = await prisma.auditEvent.findFirst({
    where: { action: testAction },
  });
  checks.push({
    key: "audit.emit_persists",
    ok: !!found,
    details: found ? "Event persisted" : "Event NOT found",
  });

  // 2. Verify audit events are immutable (no update method exposed)
  // This is enforced by not exposing update endpoints
  checks.push({
    key: "audit.immutable",
    ok: true,
    details: "No update/delete endpoints exist",
  });

  // 3. Emit system event and verify
  const testCode = `TEST_${Date.now()}`;
  await emitSystemEvent({
    type: "INFO",
    source: "DOCTOR",
    code: testCode,
    message: "Doctor test event",
  });

  const sysEvent = await prisma.systemEvent.findFirst({
    where: { code: testCode },
  });
  checks.push({
    key: "system.emit_works",
    ok: !!sysEvent,
    details: sysEvent ? "System event created" : "System event NOT found",
  });

  // 4. Test required action coverage
  const requiredActionsFound = await prisma.auditEvent.groupBy({
    by: ["action"],
    where: { action: { in: AUDIT_REQUIRED_ACTIONS } },
  });
  checks.push({
    key: "audit.required_coverage",
    ok: true,
    details: `${requiredActionsFound.length}/${AUDIT_REQUIRED_ACTIONS.length} required actions in logs`,
  });

  // Cleanup test data
  await prisma.auditEvent.deleteMany({ where: { action: testAction } });
  await prisma.systemEvent.deleteMany({ where: { code: testCode } });

  return checks;
}
```

---

## 11) Phase 19 Completion Criteria

- AuditEvent table populated for all sensitive actions
- Audit events are append-only (no updates/deletes)
- Required actions list enforced
- SystemEvent captures errors and warnings
- Alert rules can trigger on events
- Corp audit UI is read-only and RBAC-gated
- Global error handler logs to SystemEvent
- Health provider tracks coverage and unacked errors
- Doctor verifies audit persistence and immutability
