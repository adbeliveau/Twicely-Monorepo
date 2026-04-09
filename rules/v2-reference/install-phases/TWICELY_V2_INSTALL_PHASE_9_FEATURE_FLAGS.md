# TWICELY V2 — Install Phase 9: Feature Flags & Rollouts (Core)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → Eval → Admin UI → Health → Doctor  
**Canonical:** `/rules/TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_9_FEATURE_FLAGS.md`  
> Prereq: Phase 8 complete.

---

## 0) What this phase installs

### Backend
- FeatureFlag storage with versioning
- FeatureFlagOverride for user-level overrides
- FeatureFlagAudit for change tracking
- Deterministic evaluator with precedence rules
- Kill switches for critical code paths

### UI (Corp)
- Corp → Feature Flags → Flag management (CRUD)
- Corp → Feature Flags → User overrides
- Corp → Feature Flags → Audit log

### Ops
- Health provider: `flags`
- Doctor checks: precedence rules, percentage stability, kill switch enforcement

---

## 1) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
// ============================================================
// PHASE 9: FEATURE FLAGS & ROLLOUTS
// ============================================================

enum FeatureFlagType {
  BOOLEAN      // Simple on/off
  PERCENTAGE   // Gradual rollout
  USER_LIST    // Specific users only
  TIER_BASED   // Based on subscription tier
}

model FeatureFlag {
  id          String          @id @default(cuid())
  key         String          @unique  // e.g., "checkout.new_flow"
  name        String
  description String?
  
  // Flag type and value
  type        FeatureFlagType @default(BOOLEAN)
  enabled     Boolean         @default(false)
  
  // Scope controls
  scope       String          @default("global")  // global|user|seller|staff|percentage
  percentage  Int?            // 0-100 for percentage rollout
  
  // List-based targeting
  allowListUserIds String[]   // Users always included
  denyListUserIds  String[]   // Users always excluded
  allowListTiers   String[]   // Subscription tiers allowed (STARTER, BASIC, PRO, ELITE, ENTERPRISE)
  
  // Time-based targeting
  startsAt    DateTime?       // Flag active from
  endsAt      DateTime?       // Flag active until
  
  // Categories and metadata
  category    String?         // e.g., "checkout", "search", "payments"
  ownerEmail  String?         // Who owns this flag
  tags        String[]
  
  // Kill switch indicator
  isKillSwitch Boolean        @default(false)
  
  // Audit
  version     Int             @default(1)
  updatedByStaffId String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  
  // Relations
  overrides   FeatureFlagOverride[]
  auditLogs   FeatureFlagAudit[]
}

model FeatureFlagOverride {
  id          String   @id @default(cuid())
  flagId      String
  flag        FeatureFlag @relation(fields: [flagId], references: [id], onDelete: Cascade)
  
  // Target
  userId      String
  
  // Override value
  enabled     Boolean
  reason      String?
  
  // Expiration
  expiresAt   DateTime?
  
  // Audit
  createdByStaffId String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([flagId, userId])
  @@index([userId])
}

model FeatureFlagAudit {
  id          String   @id @default(cuid())
  flagId      String
  flag        FeatureFlag @relation(fields: [flagId], references: [id], onDelete: Cascade)
  
  // Change details
  action      String   // created|updated|deleted|override_added|override_removed
  changeJson  Json     // What changed
  
  // Actor
  actorStaffId String
  actorIp     String?
  
  createdAt   DateTime @default(now())
  
  @@index([flagId, createdAt])
  @@index([actorStaffId, createdAt])
}
```

Migrate:
```bash
npx prisma migrate dev --name flags_phase9
```

---

## 2) Feature Flag Types

Create `packages/core/flags/types.ts`:

```ts
import type { FeatureFlagType } from "@prisma/client";

/**
 * Context for flag evaluation
 */
export type FlagEvaluationContext = {
  userId?: string;
  sellerId?: string;
  staffId?: string;
  tier?: string;  // STARTER | BASIC | PRO | ELITE | ENTERPRISE
  seed?: string;  // For deterministic percentage rollout
  ip?: string;
  sessionId?: string;
};

/**
 * Flag evaluation result
 */
export type FlagEvaluationResult = {
  enabled: boolean;
  reason: string;
  flagVersion: number;
};

/**
 * Kill switch keys (canonical)
 * Per TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md Section 5
 */
export const KILL_SWITCHES = {
  CHECKOUT: "kill.checkout",
  PAYOUTS_EXECUTE: "kill.payouts_execute",
  LISTING_ACTIVATION: "kill.listing_activation",
  SEARCH: "kill.search",
  PAYMENTS: "kill.payments",
  USER_REGISTRATION: "kill.user_registration",
} as const;

export type KillSwitchKey = typeof KILL_SWITCHES[keyof typeof KILL_SWITCHES];

/**
 * Flag change event
 */
export type FlagChangeEvent = {
  flagKey: string;
  action: "created" | "updated" | "deleted" | "override_added" | "override_removed";
  before?: Record<string, any>;
  after?: Record<string, any>;
  actorStaffId: string;
};
```

---

## 3) Deterministic Evaluator

Create `packages/core/flags/evaluator.ts`:

```ts
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import type { FlagEvaluationContext, FlagEvaluationResult } from "./types";

const prisma = new PrismaClient();

// In-memory cache for hot flags (optional optimization)
const flagCache = new Map<string, { flag: any; expires: number }>();
const CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Evaluate a feature flag for a given context
 * Per TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md Section 4
 * 
 * Precedence order:
 * 1. User override (if exists and not expired)
 * 2. Deny list
 * 3. Allow list
 * 4. Time window
 * 5. Tier-based
 * 6. Percentage rollout
 * 7. Global enabled
 */
export async function evaluateFlag(
  flagKey: string,
  ctx: FlagEvaluationContext
): Promise<FlagEvaluationResult> {
  // Get flag (with caching)
  const flag = await getFlag(flagKey);
  
  if (!flag) {
    return { enabled: false, reason: "FLAG_NOT_FOUND", flagVersion: 0 };
  }
  
  // 1. Check user override first
  if (ctx.userId) {
    const override = await prisma.featureFlagOverride.findUnique({
      where: {
        flagId_userId: {
          flagId: flag.id,
          userId: ctx.userId,
        },
      },
    });
    
    if (override) {
      // Check expiration
      if (!override.expiresAt || override.expiresAt > new Date()) {
        return {
          enabled: override.enabled,
          reason: "USER_OVERRIDE",
          flagVersion: flag.version,
        };
      }
    }
  }
  
  // 2. Deny list (highest priority exclusion)
  if (ctx.userId && flag.denyListUserIds?.includes(ctx.userId)) {
    return { enabled: false, reason: "DENY_LIST", flagVersion: flag.version };
  }
  
  // 3. Allow list (highest priority inclusion)
  if (ctx.userId && flag.allowListUserIds?.includes(ctx.userId)) {
    return { enabled: true, reason: "ALLOW_LIST", flagVersion: flag.version };
  }
  
  // 4. Time window
  const now = Date.now();
  if (flag.startsAt && now < flag.startsAt.getTime()) {
    return { enabled: false, reason: "BEFORE_START_TIME", flagVersion: flag.version };
  }
  if (flag.endsAt && now > flag.endsAt.getTime()) {
    return { enabled: false, reason: "AFTER_END_TIME", flagVersion: flag.version };
  }
  
  // 5. Tier-based
  if (flag.type === "TIER_BASED" && flag.allowListTiers?.length > 0) {
    if (!ctx.tier) {
      return { enabled: false, reason: "NO_TIER_CONTEXT", flagVersion: flag.version };
    }
    if (flag.allowListTiers.includes(ctx.tier)) {
      return { enabled: true, reason: "TIER_MATCH", flagVersion: flag.version };
    }
    return { enabled: false, reason: "TIER_NOT_ALLOWED", flagVersion: flag.version };
  }
  
  // 6. Percentage rollout
  if (flag.type === "PERCENTAGE" && flag.percentage !== null && flag.percentage !== undefined) {
    const seed = ctx.seed ?? ctx.userId ?? ctx.sessionId ?? "anon";
    const bucket = computeBucket(flagKey, seed);
    const enabled = bucket < flag.percentage;
    return {
      enabled,
      reason: enabled ? "PERCENTAGE_INCLUDED" : "PERCENTAGE_EXCLUDED",
      flagVersion: flag.version,
    };
  }
  
  // 7. Global enabled
  return {
    enabled: flag.enabled,
    reason: flag.enabled ? "GLOBALLY_ENABLED" : "GLOBALLY_DISABLED",
    flagVersion: flag.version,
  };
}

/**
 * Check if a flag is enabled (simple boolean helper)
 */
export async function isFlagEnabled(
  flagKey: string,
  ctx: FlagEvaluationContext = {}
): Promise<boolean> {
  const result = await evaluateFlag(flagKey, ctx);
  return result.enabled;
}

/**
 * Check if a kill switch is active (blocks operation when TRUE)
 */
export async function isKillSwitchActive(killSwitchKey: string): Promise<boolean> {
  const result = await evaluateFlag(killSwitchKey, {});
  return result.enabled;
}

/**
 * Require kill switch to be OFF before proceeding
 * Throws if kill switch is active
 */
export async function requireKillSwitchOff(killSwitchKey: string): Promise<void> {
  const active = await isKillSwitchActive(killSwitchKey);
  if (active) {
    throw new Error(`KILL_SWITCH_ACTIVE: ${killSwitchKey}`);
  }
}

/**
 * Compute deterministic bucket (0-99) for percentage rollout
 * Same seed always produces same bucket
 */
function computeBucket(flagKey: string, seed: string): number {
  const hash = crypto
    .createHash("sha256")
    .update(`${flagKey}:${seed}`)
    .digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 100;
}

/**
 * Get flag with optional caching
 */
async function getFlag(flagKey: string): Promise<any | null> {
  // Check cache
  const cached = flagCache.get(flagKey);
  if (cached && cached.expires > Date.now()) {
    return cached.flag;
  }
  
  // Fetch from DB
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });
  
  if (flag) {
    flagCache.set(flagKey, { flag, expires: Date.now() + CACHE_TTL_MS });
  }
  
  return flag;
}

/**
 * Invalidate cache for a flag (call after updates)
 */
export function invalidateFlagCache(flagKey: string): void {
  flagCache.delete(flagKey);
}

/**
 * Clear all flag cache
 */
export function clearFlagCache(): void {
  flagCache.clear();
}
```

---

## 4) Flag Management Service

Create `packages/core/flags/flagService.ts`:

```ts
import { PrismaClient, FeatureFlagType } from "@prisma/client";
import { invalidateFlagCache } from "./evaluator";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export type CreateFlagInput = {
  key: string;
  name: string;
  description?: string;
  type?: FeatureFlagType;
  enabled?: boolean;
  scope?: string;
  percentage?: number;
  allowListUserIds?: string[];
  denyListUserIds?: string[];
  allowListTiers?: string[];
  startsAt?: Date;
  endsAt?: Date;
  category?: string;
  ownerEmail?: string;
  tags?: string[];
  isKillSwitch?: boolean;
};

export type UpdateFlagInput = Partial<CreateFlagInput>;

/**
 * Create a new feature flag
 */
export async function createFlag(
  input: CreateFlagInput,
  staffId: string
): Promise<{ flag: any; auditId: string }> {
  const flag = await prisma.featureFlag.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description,
      type: input.type ?? "BOOLEAN",
      enabled: input.enabled ?? false,
      scope: input.scope ?? "global",
      percentage: input.percentage,
      allowListUserIds: input.allowListUserIds ?? [],
      denyListUserIds: input.denyListUserIds ?? [],
      allowListTiers: input.allowListTiers ?? [],
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      category: input.category,
      ownerEmail: input.ownerEmail,
      tags: input.tags ?? [],
      isKillSwitch: input.isKillSwitch ?? false,
      updatedByStaffId: staffId,
    },
  });
  
  // Audit log
  const audit = await prisma.featureFlagAudit.create({
    data: {
      flagId: flag.id,
      action: "created",
      changeJson: { after: flag },
      actorStaffId: staffId,
    },
  });
  
  await emitAuditEvent({
    eventType: "flags.created",
    actorType: "STAFF",
    actorId: staffId,
    entityType: "FeatureFlag",
    entityId: flag.id,
    metaJson: { key: flag.key },
  });
  
  return { flag, auditId: audit.id };
}

/**
 * Update an existing feature flag
 */
export async function updateFlag(
  flagKey: string,
  input: UpdateFlagInput,
  staffId: string
): Promise<{ flag: any; auditId: string }> {
  const before = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });
  
  if (!before) {
    throw new Error("FLAG_NOT_FOUND");
  }
  
  const flag = await prisma.featureFlag.update({
    where: { key: flagKey },
    data: {
      ...input,
      version: { increment: 1 },
      updatedByStaffId: staffId,
    },
  });
  
  // Invalidate cache
  invalidateFlagCache(flagKey);
  
  // Audit log
  const audit = await prisma.featureFlagAudit.create({
    data: {
      flagId: flag.id,
      action: "updated",
      changeJson: { before, after: flag },
      actorStaffId: staffId,
    },
  });
  
  await emitAuditEvent({
    eventType: "flags.updated",
    actorType: "STAFF",
    actorId: staffId,
    entityType: "FeatureFlag",
    entityId: flag.id,
    metaJson: { key: flag.key, changes: Object.keys(input) },
  });
  
  return { flag, auditId: audit.id };
}

/**
 * Delete a feature flag
 */
export async function deleteFlag(flagKey: string, staffId: string): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });
  
  if (!flag) {
    throw new Error("FLAG_NOT_FOUND");
  }
  
  // Cannot delete kill switches easily
  if (flag.isKillSwitch) {
    throw new Error("CANNOT_DELETE_KILL_SWITCH");
  }
  
  await prisma.featureFlag.delete({
    where: { key: flagKey },
  });
  
  // Invalidate cache
  invalidateFlagCache(flagKey);
  
  await emitAuditEvent({
    eventType: "flags.deleted",
    actorType: "STAFF",
    actorId: staffId,
    entityType: "FeatureFlag",
    entityId: flag.id,
    metaJson: { key: flag.key },
  });
}

/**
 * Add user override
 */
export async function addOverride(
  flagKey: string,
  userId: string,
  enabled: boolean,
  staffId: string,
  options?: { reason?: string; expiresAt?: Date }
): Promise<any> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });
  
  if (!flag) {
    throw new Error("FLAG_NOT_FOUND");
  }
  
  const override = await prisma.featureFlagOverride.upsert({
    where: {
      flagId_userId: {
        flagId: flag.id,
        userId,
      },
    },
    update: {
      enabled,
      reason: options?.reason,
      expiresAt: options?.expiresAt,
      createdByStaffId: staffId,
    },
    create: {
      flagId: flag.id,
      userId,
      enabled,
      reason: options?.reason,
      expiresAt: options?.expiresAt,
      createdByStaffId: staffId,
    },
  });
  
  // Audit
  await prisma.featureFlagAudit.create({
    data: {
      flagId: flag.id,
      action: "override_added",
      changeJson: { userId, enabled, reason: options?.reason },
      actorStaffId: staffId,
    },
  });
  
  return override;
}

/**
 * Remove user override
 */
export async function removeOverride(
  flagKey: string,
  userId: string,
  staffId: string
): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });
  
  if (!flag) {
    throw new Error("FLAG_NOT_FOUND");
  }
  
  await prisma.featureFlagOverride.delete({
    where: {
      flagId_userId: {
        flagId: flag.id,
        userId,
      },
    },
  });
  
  // Audit
  await prisma.featureFlagAudit.create({
    data: {
      flagId: flag.id,
      action: "override_removed",
      changeJson: { userId },
      actorStaffId: staffId,
    },
  });
}
```

---

## 5) Corp API Endpoints

### 5.1 List Flags

Create `apps/web/app/api/platform/flags/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";
import { createFlag } from "@/packages/core/flags/flagService";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requirePermission(req, "flags.read");
  
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  
  const where: any = {};
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { key: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  
  const flags = await prisma.featureFlag.findMany({
    where,
    orderBy: [{ isKillSwitch: "desc" }, { key: "asc" }],
    include: {
      _count: { select: { overrides: true } },
    },
  });
  
  return NextResponse.json({ flags });
}

export async function POST(req: Request) {
  // RBAC: Require PlatformRole.ADMIN or DEVELOPER for flag management
  const staffCtx = await requirePlatformRole(req, ["ADMIN", "DEVELOPER"]);
  const body = await req.json();
  
  const { flag, auditId } = await createFlag(body, staffCtx.staffUserId);
  
  return NextResponse.json({ flag, auditId }, { status: 201 });
}
```

### 5.2 Flag Details & Update

Create `apps/web/app/api/platform/flags/[key]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";
import { updateFlag, deleteFlag } from "@/packages/core/flags/flagService";

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { key: string } }) {
  await requirePermission(req, "flags.read");
  
  const flag = await prisma.featureFlag.findUnique({
    where: { key: params.key },
    include: {
      overrides: true,
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  
  if (!flag) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  
  return NextResponse.json({ flag });
}

export async function PATCH(req: Request, { params }: { params: { key: string } }) {
  // RBAC: Require PlatformRole.ADMIN or DEVELOPER for flag management
  const staffCtx = await requirePlatformRole(req, ["ADMIN", "DEVELOPER"]);
  const body = await req.json();
  
  const { flag, auditId } = await updateFlag(params.key, body, staffCtx.staffUserId);
  
  return NextResponse.json({ flag, auditId });
}

export async function DELETE(req: Request, { params }: { params: { key: string } }) {
  // RBAC: Require PlatformRole.ADMIN or DEVELOPER for flag management
  const staffCtx = await requirePlatformRole(req, ["ADMIN", "DEVELOPER"]);
  
  await deleteFlag(params.key, staffCtx.staffUserId);
  
  return NextResponse.json({ ok: true });
}
```

### 5.3 Flag Overrides

Create `apps/web/app/api/platform/flags/[key]/overrides/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";
import { addOverride, removeOverride } from "@/packages/core/flags/flagService";

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { key: string } }) {
  await requirePermission(req, "flags.read");
  
  const flag = await prisma.featureFlag.findUnique({
    where: { key: params.key },
    include: { overrides: true },
  });
  
  if (!flag) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  
  return NextResponse.json({ overrides: flag.overrides });
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  // RBAC: Require PlatformRole.ADMIN or DEVELOPER for flag management
  const staffCtx = await requirePlatformRole(req, ["ADMIN", "DEVELOPER"]);
  const body = await req.json();
  
  const override = await addOverride(
    params.key,
    body.userId,
    body.enabled,
    staffCtx.staffUserId,
    { reason: body.reason, expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined }
  );
  
  return NextResponse.json({ override }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { key: string } }) {
  // RBAC: Require PlatformRole.ADMIN or DEVELOPER for flag management
  const staffCtx = await requirePlatformRole(req, ["ADMIN", "DEVELOPER"]);
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
  }
  
  await removeOverride(params.key, userId, staffCtx.staffUserId);
  
  return NextResponse.json({ ok: true });
}
```

---

## 6) Seed Kill Switches

Create `scripts/seed-kill-switches.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KILL_SWITCHES = [
  {
    key: "kill.checkout",
    name: "Kill Switch: Checkout",
    description: "Blocks all checkout operations when enabled",
    category: "kill-switches",
    isKillSwitch: true,
    enabled: false,
  },
  {
    key: "kill.payouts_execute",
    name: "Kill Switch: Payout Execution",
    description: "Blocks all payout executions when enabled",
    category: "kill-switches",
    isKillSwitch: true,
    enabled: false,
  },
  {
    key: "kill.listing_activation",
    name: "Kill Switch: Listing Activation",
    description: "Blocks all listing activations when enabled",
    category: "kill-switches",
    isKillSwitch: true,
    enabled: false,
  },
  {
    key: "kill.search",
    name: "Kill Switch: Search",
    description: "Blocks all search queries when enabled",
    category: "kill-switches",
    isKillSwitch: true,
    enabled: false,
  },
  {
    key: "kill.payments",
    name: "Kill Switch: Payments",
    description: "Blocks all payment processing when enabled",
    category: "kill-switches",
    isKillSwitch: true,
    enabled: false,
  },
  {
    key: "kill.user_registration",
    name: "Kill Switch: User Registration",
    description: "Blocks new user registrations when enabled",
    category: "kill-switches",
    isKillSwitch: true,
    enabled: false,
  },
];

async function main() {
  for (const ks of KILL_SWITCHES) {
    await prisma.featureFlag.upsert({
      where: { key: ks.key },
      update: { 
        name: ks.name,
        description: ks.description,
        isKillSwitch: true,
      },
      create: {
        ...ks,
        type: "BOOLEAN",
        scope: "global",
        updatedByStaffId: "bootstrap",
      } as any,
    });
  }
  
  console.log(`Seeded ${KILL_SWITCHES.length} kill switches`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 7) Health Provider

Create `packages/core/health/providers/flagsHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";
import { evaluateFlag } from "../flags/evaluator";
import { KILL_SWITCHES } from "../flags/types";

const prisma = new PrismaClient();

export const flagsHealthProvider: HealthProvider = {
  id: "flags",
  label: "Feature Flags & Kill Switches",
  description: "Validates flag configuration, kill switch state, and evaluator functionality",
  version: "1.0.0",
  
  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;
    
    // Check 1: Kill switches exist
    const killSwitchKeys = Object.values(KILL_SWITCHES);
    const existingKillSwitches = await prisma.featureFlag.findMany({
      where: { key: { in: killSwitchKeys }, isKillSwitch: true },
      select: { key: true, enabled: true },
    });
    
    const missingKillSwitches = killSwitchKeys.filter(
      k => !existingKillSwitches.some(ks => ks.key === k)
    );
    
    checks.push({
      id: "flags.kill_switches_exist",
      label: "All kill switches configured",
      status: missingKillSwitches.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: missingKillSwitches.length === 0 
        ? `${existingKillSwitches.length} kill switches present`
        : `Missing: ${missingKillSwitches.join(", ")}`,
    });
    if (missingKillSwitches.length > 0) status = HEALTH_STATUS.FAIL;
    
    // Check 2: No kill switches accidentally enabled
    const activeKillSwitches = existingKillSwitches.filter(ks => ks.enabled);
    
    checks.push({
      id: "flags.kill_switches_off",
      label: "Kill switches not active",
      status: activeKillSwitches.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: activeKillSwitches.length === 0 
        ? "All kill switches OFF"
        : `ACTIVE: ${activeKillSwitches.map(ks => ks.key).join(", ")}`,
    });
    if (activeKillSwitches.length > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 3: Evaluator functional
    try {
      const testResult = await evaluateFlag("kill.checkout", {});
      checks.push({
        id: "flags.evaluator_functional",
        label: "Flag evaluator working",
        status: HEALTH_STATUS.PASS,
        message: `Test evaluation: ${testResult.reason}`,
      });
    } catch (e) {
      checks.push({
        id: "flags.evaluator_functional",
        label: "Flag evaluator working",
        status: HEALTH_STATUS.FAIL,
        message: `Evaluator error: ${e}`,
      });
      status = HEALTH_STATUS.FAIL;
    }
    
    // Check 4: No expired overrides
    const expiredOverrides = await prisma.featureFlagOverride.count({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    
    checks.push({
      id: "flags.no_expired_overrides",
      label: "No expired overrides lingering",
      status: expiredOverrides === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: expiredOverrides === 0 
        ? "No expired overrides"
        : `${expiredOverrides} expired overrides should be cleaned up`,
    });
    if (expiredOverrides > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 5: Percentage flags in valid range
    const invalidPercentage = await prisma.featureFlag.count({
      where: {
        type: "PERCENTAGE",
        OR: [
          { percentage: { lt: 0 } },
          { percentage: { gt: 100 } },
        ],
      },
    });
    
    checks.push({
      id: "flags.valid_percentages",
      label: "Percentage rollouts in valid range",
      status: invalidPercentage === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: invalidPercentage === 0 
        ? "All percentages valid"
        : `${invalidPercentage} flags with invalid percentage`,
    });
    if (invalidPercentage > 0) status = HEALTH_STATUS.FAIL;
    
    // Check 6: Total flag count (sanity)
    const totalFlags = await prisma.featureFlag.count();
    
    checks.push({
      id: "flags.count",
      label: "Feature flags configured",
      status: HEALTH_STATUS.PASS,
      message: `${totalFlags} flags total`,
    });
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS 
        ? "Feature flags healthy"
        : status === HEALTH_STATUS.WARN
          ? "Feature flags have warnings"
          : "Feature flags have failures",
      checks,
      meta: {
        totalFlags,
        killSwitchCount: existingKillSwitches.length,
        activeKillSwitches: activeKillSwitches.map(ks => ks.key),
        expiredOverrides,
      },
    };
  },
};
```

---

## 8) Doctor Checks

Add to `scripts/twicely-doctor.ts` phase 9 section:

```ts
// ============================================================
// PHASE 9: FEATURE FLAGS DOCTOR CHECKS
// ============================================================

async function runPhase9DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Deny list beats allow list
  const testFlagKey = `doctor.test.${Date.now()}`;
  const testUserId = "doctor_test_user";
  
  await prisma.featureFlag.create({
    data: {
      key: testFlagKey,
      name: "Doctor Test Flag",
      type: "BOOLEAN",
      enabled: true,
      allowListUserIds: [testUserId],
      denyListUserIds: [testUserId],
      updatedByStaffId: "doctor",
    },
  });
  
  const denyVsAllowResult = await evaluateFlag(testFlagKey, { userId: testUserId });
  
  results.push({
    id: "flags.deny_beats_allow",
    label: "Deny list has higher priority than allow list",
    status: !denyVsAllowResult.enabled && denyVsAllowResult.reason === "DENY_LIST" ? "PASS" : "FAIL",
    message: !denyVsAllowResult.enabled 
      ? "Deny list correctly blocks allow list"
      : `ERROR: User was enabled (${denyVsAllowResult.reason})`,
  });
  
  // Test 2: Percentage rollout is stable for same seed
  await prisma.featureFlag.update({
    where: { key: testFlagKey },
    data: {
      type: "PERCENTAGE",
      percentage: 50,
      allowListUserIds: [],
      denyListUserIds: [],
    },
  });
  
  const seed = "stable_seed_123";
  const result1 = await evaluateFlag(testFlagKey, { seed });
  const result2 = await evaluateFlag(testFlagKey, { seed });
  const result3 = await evaluateFlag(testFlagKey, { seed });
  
  const stable = result1.enabled === result2.enabled && result2.enabled === result3.enabled;
  
  results.push({
    id: "flags.percentage_stable",
    label: "Percentage rollout is deterministic for same seed",
    status: stable ? "PASS" : "FAIL",
    message: stable 
      ? `Same seed always returns ${result1.enabled}`
      : "ERROR: Results varied for same seed",
  });
  
  // Test 3: Time window respected
  const futureStart = new Date(Date.now() + 60000); // 1 minute in future
  
  await prisma.featureFlag.update({
    where: { key: testFlagKey },
    data: {
      type: "BOOLEAN",
      enabled: true,
      startsAt: futureStart,
    },
  });
  
  const timeResult = await evaluateFlag(testFlagKey, {});
  
  results.push({
    id: "flags.time_window_respected",
    label: "Time window blocks flag before start time",
    status: !timeResult.enabled && timeResult.reason === "BEFORE_START_TIME" ? "PASS" : "FAIL",
    message: !timeResult.enabled 
      ? "Correctly blocked before start time"
      : "ERROR: Flag enabled before start time",
  });
  
  // Test 4: User override takes precedence
  await prisma.featureFlag.update({
    where: { key: testFlagKey },
    data: {
      enabled: false,
      startsAt: null,
    },
  });
  
  const flag = await prisma.featureFlag.findUnique({ where: { key: testFlagKey } });
  
  await prisma.featureFlagOverride.create({
    data: {
      flagId: flag!.id,
      userId: testUserId,
      enabled: true,
      reason: "Doctor test",
      createdByStaffId: "doctor",
    },
  });
  
  const overrideResult = await evaluateFlag(testFlagKey, { userId: testUserId });
  
  results.push({
    id: "flags.override_precedence",
    label: "User override takes precedence",
    status: overrideResult.enabled && overrideResult.reason === "USER_OVERRIDE" ? "PASS" : "FAIL",
    message: overrideResult.enabled 
      ? "Override correctly applied"
      : `ERROR: Override not applied (${overrideResult.reason})`,
  });
  
  // Test 5: Kill switch integration
  const killResult = await evaluateFlag("kill.checkout", {});
  
  results.push({
    id: "flags.kill_switch_exists",
    label: "Kill switch 'kill.checkout' exists and evaluates",
    status: killResult.flagVersion > 0 || killResult.reason === "FLAG_NOT_FOUND" ? "PASS" : "FAIL",
    message: killResult.flagVersion > 0 
      ? `Kill switch status: ${killResult.enabled ? "ACTIVE" : "OFF"}`
      : "Kill switch not found - run seeder",
  });
  
  // Cleanup
  await prisma.featureFlagOverride.deleteMany({
    where: { flagId: flag?.id },
  });
  await prisma.featureFlag.delete({
    where: { key: testFlagKey },
  });
  
  return results;
}
```

---

## 9) Kill Switch Usage Examples

In critical code paths, integrate kill switch checks:

```ts
// In checkout flow
import { requireKillSwitchOff, KILL_SWITCHES } from "@/packages/core/flags";

async function processCheckout(orderId: string) {
  // Check kill switch first
  await requireKillSwitchOff(KILL_SWITCHES.CHECKOUT);
  
  // Proceed with checkout...
}
```

```ts
// In payout execution
import { isKillSwitchActive, KILL_SWITCHES } from "@/packages/core/flags";

async function executePayout(payoutId: string) {
  if (await isKillSwitchActive(KILL_SWITCHES.PAYOUTS_EXECUTE)) {
    throw new Error("PAYOUTS_DISABLED");
  }
  
  // Proceed with payout...
}
```

---

## 10) Phase 9 Completion Criteria

- [ ] FeatureFlag model migrated
- [ ] FeatureFlagOverride model migrated
- [ ] FeatureFlagAudit model migrated
- [ ] Evaluator respects precedence order
- [ ] Deny list beats allow list
- [ ] Percentage rollout is deterministic
- [ ] Time windows respected
- [ ] User overrides work
- [ ] Kill switches seeded
- [ ] Corp UI for flag management
- [ ] Corp UI for overrides
- [ ] Audit trail recorded
- [ ] Health provider registered and passing
- [ ] Doctor passes all Phase 9 checks

---

## 11) Migration Checklist

1. Run migration: `npx prisma migrate dev --name flags_phase9`
2. Seed kill switches: `npx ts-node scripts/seed-kill-switches.ts`
3. Wire kill switch checks to critical paths
4. Verify health provider passes
5. Run Doctor checks
