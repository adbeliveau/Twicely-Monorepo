# TWICELY V2 - Install Phase 10: System Health + SRE Console + Module Registry + Doctor UI (Core)
**Status:** LOCKED (v1.1)  
**Backend-first:** Providers  ->  Persistence  ->  UI  ->  Doctor  
**Canonicals:** MUST align with:
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`
- `/rules/TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md`
- `/rules/TWICELY_KERNEL_MODULE_ENFORCEMENT_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_10_SYSTEM_HEALTH_SRE_MODULES_DOCTOR_UI.md`  
> Prereq: Phase 9 complete.

---

## 0) What this phase installs

### Backend
- Provider-driven health runner with **canonical schema**
- Health snapshot storage (per-provider)
- Health settings (global + per-provider)
- Module registry with lifecycle states
- Doctor integration

### UI
- SRE/Platform Health console (`/corp/health`)
- Provider detail pages with settings panels
- Module Registry UI (`/corp/settings/modules`)
- Doctor UI (`/corp/doctor`)

### Ops
- Health providers registered for every module from Phases 1-9
- Scheduled health runs
- Stale snapshot detection

---

## 1) Prisma Schema (Canonical Alignment)

**Per System-Health-Canonical-Spec-v1-provider-driven.md:**

```prisma
// =============================================================================
// HEALTH SNAPSHOT (Per-Provider Results)
// Per System-Health-Canonical-Spec-v1-provider-driven.md Section 3
// =============================================================================

// Canonical health status values - DO NOT MODIFY
enum HealthStatus {
  PASS
  WARN
  FAIL
  UNKNOWN
}

// Canonical run types - DO NOT MODIFY
enum HealthRunType {
  interactive  // User clicked "Run Now"
  scheduled    // Cron/timer triggered
  manual       // CLI or API triggered
}

model HealthSnapshot {
  id              String       @id @default(cuid())
  providerId      String       // e.g., "rbac", "payments", "trust"
  
  status          HealthStatus
  summary         String       // Human-readable summary
  
  // Detailed check results
  detailsJson     Json         // Array of HealthCheck objects
  
  // Provider metadata
  providerVersion String       // Version of provider that ran
  
  // Timing
  ranAt           DateTime     // When the check ran
  runType         HealthRunType
  durationMs      Int?         // How long the check took
  
  createdAt       DateTime     @default(now())

  @@index([providerId, ranAt])
  @@index([status])
  @@index([providerId, status])
}

// =============================================================================
// HEALTH SETTINGS (Global + Per-Provider Configuration)
// Per System-Health-Canonical-Spec-v1-provider-driven.md Section 4
// =============================================================================

model HealthSettings {
  id               String   @id @default(cuid())
  
  // Global settings
  enabled          Boolean  @default(true)
  defaultFrequency String   @default("hourly") // hourly|daily|manual
  staleAfterHours  Int      @default(24)       // Mark UNKNOWN if older
  
  // Per-provider settings (JSON map: providerId -> settings)
  providerSettings Json     @default("{}")
  
  // Audit
  updatedByStaffId String?
  updatedAt        DateTime @updatedAt
  createdAt        DateTime @default(now())
}

// =============================================================================
// HEALTH RUN (Batch Run Tracking)
// =============================================================================

model HealthRun {
  id          String        @id @default(cuid())
  runType     HealthRunType
  status      HealthStatus  @default(UNKNOWN)
  
  startedAt   DateTime      @default(now())
  finishedAt  DateTime?
  
  // Summary of all providers
  summaryJson Json          @default("{}")
  
  // Counts
  totalProviders  Int       @default(0)
  passCount       Int       @default(0)
  warnCount       Int       @default(0)
  failCount       Int       @default(0)
  unknownCount    Int       @default(0)
  
  triggeredByStaffId String?

  @@index([runType, startedAt])
  @@index([status])
}

// =============================================================================
// MODULE REGISTRY (Lifecycle Management)
// Per TWICELY_KERNEL_MODULE_ENFORCEMENT_LOCKED.md
// =============================================================================

// Canonical module states - DO NOT MODIFY
enum ModuleState {
  ENABLED
  DISABLED
  MISSING
  INCOMPATIBLE
  FAILED_INSTALL
  FAILED_UPDATE
}

model ModuleRegistry {
  id              String      @id @default(cuid())
  moduleId        String      @unique  // e.g., "payments", "trust", "search"
  
  label           String      // Human-readable name
  description     String?
  
  state           ModuleState @default(ENABLED)
  version         String      // Installed version
  
  // Health integration
  healthProviderId String?    // Link to health provider
  lastHealthStatus HealthStatus?
  lastHealthAt     DateTime?
  
  // Manifest metadata
  manifestJson    Json        @default("{}")
  
  // Installation tracking
  installedAt     DateTime    @default(now())
  installedByStaffId String?
  
  updatedAt       DateTime    @updatedAt

  @@index([state])
  @@index([healthProviderId])
}
```

Migrate:
```bash
npx prisma migrate dev --name system_health_phase10
```

---

## 2) Health Provider Interface (Canonical)

Create `packages/core/health/types.ts`:

```ts
/**
 * Canonical health status values
 * Per System-Health-Canonical-Spec-v1-provider-driven.md
 * 
 * IMPORTANT: Always use HEALTH_STATUS.PASS, not "pass" or "ok"
 */
export const HEALTH_STATUS = {
  PASS: "PASS",
  WARN: "WARN",
  FAIL: "FAIL",
  UNKNOWN: "UNKNOWN",
} as const;

export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];

/**
 * Type guard for HealthStatus
 * Use this to validate status values from external sources
 */
export function isHealthStatus(value: string): value is HealthStatus {
  return Object.values(HEALTH_STATUS).includes(value as HealthStatus);
}

/**
 * Normalize legacy/invalid status values to canonical format
 * Returns UNKNOWN if value cannot be mapped
 */
export function normalizeHealthStatus(value: string): HealthStatus {
  const normalized = value.toUpperCase();
  
  // Direct match
  if (isHealthStatus(normalized)) {
    return normalized;
  }
  
  // Map legacy values
  const legacyMap: Record<string, HealthStatus> = {
    "OK": HEALTH_STATUS.PASS,
    "SUCCESS": HEALTH_STATUS.PASS,
    "HEALTHY": HEALTH_STATUS.PASS,
    "WARNING": HEALTH_STATUS.WARN,
    "ERROR": HEALTH_STATUS.FAIL,
    "FAILED": HEALTH_STATUS.FAIL,
    "UNHEALTHY": HEALTH_STATUS.FAIL,
  };
  
  return legacyMap[normalized] ?? HEALTH_STATUS.UNKNOWN;
}

/**
 * Canonical run types
 */
export const HEALTH_RUN_TYPE = {
  interactive: "interactive",
  scheduled: "scheduled",
  manual: "manual",
} as const;

export type HealthRunType = typeof HEALTH_RUN_TYPE[keyof typeof HEALTH_RUN_TYPE];

/**
 * Individual health check result
 */
export type HealthCheck = {
  id: string;           // Unique check identifier
  label: string;        // Human-readable label
  status: HealthStatus;
  message?: string;     // Additional details
  metadata?: Record<string, any>;
};

/**
 * Health provider run context
 */
export type HealthRunContext = {
  runType: HealthRunType;
  runId?: string;
  triggeredBy?: string;
};

/**
 * Health provider result
 * Per System-Health-Canonical-Spec-v1-provider-driven.md Section 2
 */
export type HealthResult = {
  providerId: string;
  status: HealthStatus;
  summary: string;
  providerVersion: string;
  ranAt: string;        // ISO datetime
  runType: HealthRunType;
  durationMs?: number;
  checks: HealthCheck[];
};

/**
 * Provider settings schema (type-safe)
 */
export type ProviderSettingsSchema<T = any> = {
  schema: Record<string, any>;  // JSON Schema for settings
  defaults: T;                   // Default values
};

/**
 * Provider UI components
 * Per System-Health-Canonical-Spec-v1-provider-driven.md Section 5
 */
export type ProviderUIComponents = {
  SettingsPanel: React.ComponentType<{ providerId: string; settings: any; onSave: (s: any) => void }>;
  DetailPage: React.ComponentType<{ providerId: string; snapshot: HealthResult }>;
};

/**
 * Health Provider Interface (Canonical)
 * Per System-Health-Canonical-Spec-v1-provider-driven.md Section 2
 */
export interface HealthProvider {
  // Identity
  id: string;           // Unique provider ID (e.g., "rbac", "payments")
  label: string;        // Human-readable name
  description?: string;
  version: string;      // Provider version (for tracking changes)
  
  // Core method
  run(ctx: HealthRunContext): Promise<HealthResult>;
  
  // Settings
  settings: ProviderSettingsSchema;
  
  // UI components (provider-owned)
  ui: ProviderUIComponents;
  
  // Optional: Dependencies on other providers
  dependsOn?: string[];
}

/**
 * Aggregate worst status from multiple results
 */
export function aggregateStatus(results: HealthResult[]): HealthStatus;
export function aggregateStatus(statuses: HealthStatus[]): HealthStatus;
export function aggregateStatus(input: HealthResult[] | HealthStatus[]): HealthStatus {
  const statuses = input.map(item => 
    typeof item === 'string' ? item : item.status
  );
  
  if (statuses.includes(HEALTH_STATUS.FAIL)) return HEALTH_STATUS.FAIL;
  if (statuses.includes(HEALTH_STATUS.UNKNOWN)) return HEALTH_STATUS.UNKNOWN;
  if (statuses.includes(HEALTH_STATUS.WARN)) return HEALTH_STATUS.WARN;
  return HEALTH_STATUS.PASS;
}

/**
 * Aggregate status from health check results
 */
export function aggregateCheckStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.length === 0) return HEALTH_STATUS.UNKNOWN;
  
  const statuses = checks.map(c => c.status);
  if (statuses.includes(HEALTH_STATUS.FAIL)) return HEALTH_STATUS.FAIL;
  if (statuses.includes(HEALTH_STATUS.WARN)) return HEALTH_STATUS.WARN;
  return HEALTH_STATUS.PASS;
}

/**
 * Check if snapshot is stale
 */
export function isSnapshotStale(ranAt: Date, staleAfterHours: number): boolean {
  const ageMs = Date.now() - ranAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > staleAfterHours;
}
```

---

## 3) Provider Registry

Create `packages/core/health/registry.ts`:

```ts
import type { HealthProvider } from "./types";

/**
 * Global provider registry
 */
const providers = new Map<string, HealthProvider>();

/**
 * Register a health provider
 * Per System-Health-Canonical-Spec-v1-provider-driven.md Section 2
 */
export function registerProvider(provider: HealthProvider): void {
  if (providers.has(provider.id)) {
    console.warn(`Health provider "${provider.id}" already registered, replacing`);
  }
  providers.set(provider.id, provider);
}

/**
 * Get a provider by ID
 */
export function getProvider(id: string): HealthProvider | undefined {
  return providers.get(id);
}

/**
 * Get all registered providers
 */
export function getAllProviders(): HealthProvider[] {
  return Array.from(providers.values());
}

/**
 * Get provider IDs
 */
export function getProviderIds(): string[] {
  return Array.from(providers.keys());
}

/**
 * Check if provider exists
 */
export function hasProvider(id: string): boolean {
  return providers.has(id);
}

/**
 * Unregister a provider (for testing)
 */
export function unregisterProvider(id: string): boolean {
  return providers.delete(id);
}

/**
 * Clear all providers (for testing)
 */
export function clearProviders(): void {
  providers.clear();
}
```

---

## 4) Health Runner (Canonical)

Create `packages/core/health/runner.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import {
  getAllProviders,
  getProvider,
} from "./registry";
import {
  HEALTH_STATUS,
  HEALTH_RUN_TYPE,
  aggregateStatus,
  isSnapshotStale,
  type HealthRunContext,
  type HealthResult,
  type HealthRunType,
  type HealthStatus,
} from "./types";

const prisma = new PrismaClient();

/**
 * Run health checks for all providers
 * Per System-Health-Canonical-Spec-v1-provider-driven.md Section 3
 */
export async function runAllProviders(args: {
  runType: HealthRunType;
  triggeredByStaffId?: string;
}): Promise<{
  runId: string;
  status: HealthStatus;
  results: HealthResult[];
}> {
  const providers = getAllProviders();
  
  // Create run record
  const run = await prisma.healthRun.create({
    data: {
      runType: args.runType,
      status: HEALTH_STATUS.UNKNOWN,
      totalProviders: providers.length,
      triggeredByStaffId: args.triggeredByStaffId,
    },
  });
  
  const ctx: HealthRunContext = {
    runType: args.runType,
    runId: run.id,
    triggeredBy: args.triggeredByStaffId,
  };
  
  const results: HealthResult[] = [];
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  let unknownCount = 0;
  
  for (const provider of providers) {
    const startTime = Date.now();
    let result: HealthResult;
    
    try {
      result = await provider.run(ctx);
      result.durationMs = Date.now() - startTime;
    } catch (error: any) {
      // Provider threw an error - mark as FAIL
      result = {
        providerId: provider.id,
        status: HEALTH_STATUS.FAIL,
        summary: `Provider error: ${error?.message ?? "Unknown error"}`,
        providerVersion: provider.version,
        ranAt: new Date().toISOString(),
        runType: args.runType,
        durationMs: Date.now() - startTime,
        checks: [{
          id: "provider_error",
          label: "Provider execution",
          status: HEALTH_STATUS.FAIL,
          message: error?.message ?? "Unknown error",
        }],
      };
    }
    
    results.push(result);
    
    // Count by status
    switch (result.status) {
      case HEALTH_STATUS.PASS: passCount++; break;
      case HEALTH_STATUS.WARN: warnCount++; break;
      case HEALTH_STATUS.FAIL: failCount++; break;
      default: unknownCount++; break;
    }
    
    // Save snapshot
    await prisma.healthSnapshot.create({
      data: {
        providerId: provider.id,
        status: result.status,
        summary: result.summary,
        detailsJson: result,
        providerVersion: result.providerVersion,
        ranAt: new Date(result.ranAt),
        runType: args.runType,
        durationMs: result.durationMs,
      },
    });
    
    // Update module registry if linked
    await prisma.moduleRegistry.updateMany({
      where: { healthProviderId: provider.id },
      data: {
        lastHealthStatus: result.status,
        lastHealthAt: new Date(),
      },
    });
  }
  
  // Determine overall status
  const overallStatus = aggregateStatus(results);
  
  // Update run record
  await prisma.healthRun.update({
    where: { id: run.id },
    data: {
      status: overallStatus,
      finishedAt: new Date(),
      passCount,
      warnCount,
      failCount,
      unknownCount,
      summaryJson: {
        totalProviders: providers.length,
        passCount,
        warnCount,
        failCount,
        unknownCount,
      },
    },
  });
  
  return {
    runId: run.id,
    status: overallStatus,
    results,
  };
}

/**
 * Run health check for a single provider
 */
export async function runProvider(args: {
  providerId: string;
  runType: HealthRunType;
  triggeredByStaffId?: string;
}): Promise<HealthResult> {
  const provider = getProvider(args.providerId);
  
  if (!provider) {
    return {
      providerId: args.providerId,
      status: HEALTH_STATUS.UNKNOWN,
      summary: `Provider "${args.providerId}" not found`,
      providerVersion: "unknown",
      ranAt: new Date().toISOString(),
      runType: args.runType,
      checks: [],
    };
  }
  
  const ctx: HealthRunContext = {
    runType: args.runType,
    triggeredBy: args.triggeredByStaffId,
  };
  
  const startTime = Date.now();
  let result: HealthResult;
  
  try {
    result = await provider.run(ctx);
    result.durationMs = Date.now() - startTime;
  } catch (error: any) {
    result = {
      providerId: provider.id,
      status: HEALTH_STATUS.FAIL,
      summary: `Provider error: ${error?.message ?? "Unknown error"}`,
      providerVersion: provider.version,
      ranAt: new Date().toISOString(),
      runType: args.runType,
      durationMs: Date.now() - startTime,
      checks: [{
        id: "provider_error",
        label: "Provider execution",
        status: HEALTH_STATUS.FAIL,
        message: error?.message ?? "Unknown error",
      }],
    };
  }
  
  // Save snapshot
  await prisma.healthSnapshot.create({
    data: {
      providerId: provider.id,
      status: result.status,
      summary: result.summary,
      detailsJson: result,
      providerVersion: result.providerVersion,
      ranAt: new Date(result.ranAt),
      runType: args.runType,
      durationMs: result.durationMs,
    },
  });
  
  return result;
}

/**
 * Get latest snapshots for all providers
 */
export async function getLatestSnapshots(): Promise<Map<string, HealthResult>> {
  const settings = await getHealthSettings();
  const providers = getAllProviders();
  const snapshots = new Map<string, HealthResult>();
  
  for (const provider of providers) {
    const snapshot = await prisma.healthSnapshot.findFirst({
      where: { providerId: provider.id },
      orderBy: { ranAt: "desc" },
    });
    
    if (snapshot) {
      const result = snapshot.detailsJson as HealthResult;
      
      // Check if stale
      if (isSnapshotStale(snapshot.ranAt, settings.staleAfterHours)) {
        result.status = HEALTH_STATUS.UNKNOWN;
        result.summary = `Stale (last run: ${snapshot.ranAt.toISOString()})`;
      }
      
      snapshots.set(provider.id, result);
    } else {
      // No snapshot yet
      snapshots.set(provider.id, {
        providerId: provider.id,
        status: HEALTH_STATUS.UNKNOWN,
        summary: "Never run",
        providerVersion: provider.version,
        ranAt: new Date().toISOString(),
        runType: HEALTH_RUN_TYPE.manual,
        checks: [],
      });
    }
  }
  
  return snapshots;
}

/**
 * Get health settings
 */
export async function getHealthSettings() {
  let settings = await prisma.healthSettings.findFirst();
  
  if (!settings) {
    // Create default settings
    settings = await prisma.healthSettings.create({
      data: {
        enabled: true,
        defaultFrequency: "hourly",
        staleAfterHours: 24,
        providerSettings: {},
      },
    });
  }
  
  return settings;
}

/**
 * Update health settings
 */
export async function updateHealthSettings(args: {
  enabled?: boolean;
  defaultFrequency?: string;
  staleAfterHours?: number;
  providerSettings?: Record<string, any>;
  updatedByStaffId: string;
}) {
  const current = await getHealthSettings();
  
  return prisma.healthSettings.update({
    where: { id: current.id },
    data: {
      enabled: args.enabled ?? current.enabled,
      defaultFrequency: args.defaultFrequency ?? current.defaultFrequency,
      staleAfterHours: args.staleAfterHours ?? current.staleAfterHours,
      providerSettings: args.providerSettings ?? current.providerSettings,
      updatedByStaffId: args.updatedByStaffId,
    },
  });
}
```

---

## 5) Module Registry Management

Create `packages/core/modules/registry.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { ModuleState } from "@prisma/client";

const prisma = new PrismaClient();

export type ModuleManifest = {
  id: string;
  label: string;
  description?: string;
  version: string;
  healthProviderId?: string;
  dependsOn?: string[];
  platformCompatibility?: string;
};

/**
 * Register or update a module in the registry
 */
export async function registerModule(args: {
  manifest: ModuleManifest;
  installedByStaffId?: string;
}): Promise<void> {
  await prisma.moduleRegistry.upsert({
    where: { moduleId: args.manifest.id },
    update: {
      label: args.manifest.label,
      description: args.manifest.description,
      version: args.manifest.version,
      healthProviderId: args.manifest.healthProviderId,
      manifestJson: args.manifest,
      state: "ENABLED",
    },
    create: {
      moduleId: args.manifest.id,
      label: args.manifest.label,
      description: args.manifest.description,
      version: args.manifest.version,
      healthProviderId: args.manifest.healthProviderId,
      manifestJson: args.manifest,
      state: "ENABLED",
      installedByStaffId: args.installedByStaffId,
    },
  });
}

/**
 * Set module state
 */
export async function setModuleState(moduleId: string, state: ModuleState): Promise<void> {
  await prisma.moduleRegistry.update({
    where: { moduleId },
    data: { state },
  });
}

/**
 * Get all modules with their health status
 */
export async function getModulesWithHealth(): Promise<Array<{
  moduleId: string;
  label: string;
  state: ModuleState;
  version: string;
  healthStatus: string | null;
  healthAt: Date | null;
}>> {
  const modules = await prisma.moduleRegistry.findMany({
    orderBy: { label: "asc" },
  });
  
  return modules.map(m => ({
    moduleId: m.moduleId,
    label: m.label,
    state: m.state,
    version: m.version,
    healthStatus: m.lastHealthStatus,
    healthAt: m.lastHealthAt,
  }));
}

/**
 * Check if all required modules are healthy
 */
export async function checkRequiredModulesHealthy(requiredModuleIds: string[]): Promise<{
  allHealthy: boolean;
  unhealthyModules: string[];
}> {
  const modules = await prisma.moduleRegistry.findMany({
    where: {
      moduleId: { in: requiredModuleIds },
    },
  });
  
  const unhealthyModules: string[] = [];
  
  for (const moduleId of requiredModuleIds) {
    const module = modules.find(m => m.moduleId === moduleId);
    
    if (!module) {
      unhealthyModules.push(moduleId);
    } else if (module.state !== "ENABLED") {
      unhealthyModules.push(moduleId);
    } else if (module.lastHealthStatus && module.lastHealthStatus !== "PASS") {
      unhealthyModules.push(moduleId);
    }
  }
  
  return {
    allHealthy: unhealthyModules.length === 0,
    unhealthyModules,
  };
}
```

---

## 6) Seed Core Modules

Create `scripts/seed-modules.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CORE_MODULES = [
  { id: "rbac", label: "RBAC & Roles", healthProviderId: "rbac" },
  { id: "listings", label: "Listings & Catalog", healthProviderId: "listings" },
  { id: "orders", label: "Orders & Fulfillment", healthProviderId: "orders" },
  { id: "payments", label: "Payments & Webhooks", healthProviderId: "payments" },
  { id: "ledger", label: "Ledger & Accounting", healthProviderId: "ledger" },
  { id: "payouts", label: "Payouts", healthProviderId: "payouts" },
  { id: "search", label: "Search & Discovery", healthProviderId: "search" },
  { id: "trust", label: "Trust & Safety", healthProviderId: "trust" },
  { id: "notifications", label: "Notifications", healthProviderId: "notifications" },
  { id: "analytics", label: "Analytics & Metrics", healthProviderId: "analytics" },
  { id: "flags", label: "Feature Flags", healthProviderId: "flags" },
];

async function main() {
  for (const mod of CORE_MODULES) {
    await prisma.moduleRegistry.upsert({
      where: { moduleId: mod.id },
      update: {
        label: mod.label,
        healthProviderId: mod.healthProviderId,
      },
      create: {
        moduleId: mod.id,
        label: mod.label,
        version: "1.0.0",
        state: "ENABLED",
        healthProviderId: mod.healthProviderId,
        manifestJson: mod,
      },
    });
  }
  
  console.log("seed-modules: ok");
}

main().finally(() => prisma.$disconnect());
```

---

## 7) Corp API Routes

### 7.1 Health Dashboard
`GET /api/platform/health`

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getLatestSnapshots, getHealthSettings } from "@/packages/core/health/runner";
import { getAllProviders } from "@/packages/core/health/registry";

export async function GET() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "health.view");
  
  const [snapshots, settings, providers] = await Promise.all([
    getLatestSnapshots(),
    getHealthSettings(),
    Promise.resolve(getAllProviders()),
  ]);
  
  const dashboard = providers.map(p => {
    const snapshot = snapshots.get(p.id);
    return {
      providerId: p.id,
      label: p.label,
      status: snapshot?.status ?? "UNKNOWN",
      summary: snapshot?.summary ?? "No data",
      ranAt: snapshot?.ranAt,
      checksCount: snapshot?.checks?.length ?? 0,
    };
  });
  
  return NextResponse.json({
    settings,
    providers: dashboard,
  });
}
```

### 7.2 Run Health Check
`POST /api/platform/health/run`

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { runAllProviders, runProvider } from "@/packages/core/health/runner";
import { HEALTH_RUN_TYPE } from "@/packages/core/health/types";

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "health.view");
  
  const { providerId } = await req.json();
  
  if (providerId) {
    // Run single provider
    const result = await runProvider({
      providerId,
      runType: HEALTH_RUN_TYPE.interactive,
      triggeredByStaffId: ctx.actorUserId,
    });
    
    return NextResponse.json({ result });
  }
  
  // Run all providers
  const results = await runAllProviders({
    runType: HEALTH_RUN_TYPE.interactive,
    triggeredByStaffId: ctx.actorUserId,
  });
  
  return NextResponse.json(results);
}
```

### 7.3 Provider Detail
`GET /api/platform/health/providers/:id`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getProvider } from "@/packages/core/health/registry";

const prisma = new PrismaClient();

export async function GET(_: Request, { params }: any) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "health.view");
  
  const provider = getProvider(params.id);
  if (!provider) {
    return NextResponse.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
  }
  
  // Get recent snapshots
  const snapshots = await prisma.healthSnapshot.findMany({
    where: { providerId: params.id },
    orderBy: { ranAt: "desc" },
    take: 20,
  });
  
  return NextResponse.json({
    provider: {
      id: provider.id,
      label: provider.label,
      description: provider.description,
      version: provider.version,
    },
    snapshots,
    settingsSchema: provider.settings.schema,
    settingsDefaults: provider.settings.defaults,
  });
}
```

### 7.4 Modules List
`GET /api/platform/modules`

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getModulesWithHealth } from "@/packages/core/modules/registry";

export async function GET() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "health.view");
  
  const modules = await getModulesWithHealth();
  
  return NextResponse.json({ modules });
}
```

---

## 8) UI Pages

### 8.1 Health Dashboard
`/apps/web/app/(platform)/corp/health/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

type ProviderStatus = {
  providerId: string;
  label: string;
  status: "PASS" | "WARN" | "FAIL" | "UNKNOWN";
  summary: string;
  ranAt?: string;
  checksCount: number;
};

export default function HealthDashboard() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchData = async () => {
    const res = await fetch("/api/platform/health");
    const data = await res.json();
    setProviders(data.providers);
    setLoading(false);
  };
  
  const runAll = async () => {
    setLoading(true);
    await fetch("/api/platform/health/run", { method: "POST", body: JSON.stringify({}) });
    await fetchData();
  };
  
  useEffect(() => { fetchData(); }, []);
  
  const statusColor = (s: string) => {
    switch (s) {
      case "PASS": return "bg-green-500";
      case "WARN": return "bg-yellow-500";
      case "FAIL": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">System Health</h1>
        <button
          onClick={runAll}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Running..." : "Run All Checks"}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map(p => (
          <a
            key={p.providerId}
            href={`/corp/health/${p.providerId}`}
            className="block p-4 border rounded-lg hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${statusColor(p.status)}`} />
              <span className="font-medium">{p.label}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">{p.summary}</p>
            <p className="text-xs text-gray-400 mt-1">
              {p.checksCount} checks  *  {p.ranAt ? new Date(p.ranAt).toLocaleString() : "Never"}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
```

### 8.2 Module Registry
`/apps/web/app/(platform)/corp/settings/modules/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

type Module = {
  moduleId: string;
  label: string;
  state: string;
  version: string;
  healthStatus: string | null;
  healthAt: string | null;
};

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  
  useEffect(() => {
    fetch("/api/platform/modules")
      .then(r => r.json())
      .then(d => setModules(d.modules));
  }, []);
  
  const stateIcon = (state: string) => {
    switch (state) {
      case "ENABLED": return "...";
      case "DISABLED": return " ";
      case "MISSING": return "❌";
      case "INCOMPATIBLE": return "⚠️";
      default: return " -> ";
    }
  };
  
  const healthIcon = (status: string | null) => {
    switch (status) {
      case "PASS": return "🟢";
      case "WARN": return "🟡";
      case "FAIL": return "🔴";
      default: return "⚪";
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Module Registry</h1>
      
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Module</th>
            <th className="text-left p-2">State</th>
            <th className="text-left p-2">Version</th>
            <th className="text-left p-2">Health</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(m => (
            <tr key={m.moduleId} className="border-b hover:bg-gray-50">
              <td className="p-2 font-medium">{m.label}</td>
              <td className="p-2">{stateIcon(m.state)} {m.state}</td>
              <td className="p-2 text-gray-600">{m.version}</td>
              <td className="p-2">{healthIcon(m.healthStatus)} {m.healthStatus ?? "Unknown"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 8.3 Doctor UI
`/apps/web/app/(platform)/corp/doctor/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

type Check = {
  id: string;
  label: string;
  status: "PASS" | "WARN" | "FAIL" | "UNKNOWN";
  message?: string;
};

type ProviderResult = {
  providerId: string;
  status: string;
  checks: Check[];
};

export default function DoctorPage() {
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [running, setRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<string>("UNKNOWN");
  
  const runDoctor = async () => {
    setRunning(true);
    const res = await fetch("/api/platform/health/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setResults(data.results);
    setOverallStatus(data.status);
    setRunning(false);
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Doctor</h1>
        <button
          onClick={runDoctor}
          disabled={running}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? "Running..." : "Run Doctor"}
        </button>
      </div>
      
      {overallStatus !== "UNKNOWN" && (
        <div className={`p-4 rounded mb-6 ${
          overallStatus === "PASS" ? "bg-green-100" :
          overallStatus === "WARN" ? "bg-yellow-100" : "bg-red-100"
        }`}>
          <strong>Overall: {overallStatus}</strong>
        </div>
      )}
      
      {results.map(provider => (
        <div key={provider.providerId} className="mb-6 border rounded-lg overflow-hidden">
          <div className={`p-3 font-medium ${
            provider.status === "PASS" ? "bg-green-50" :
            provider.status === "WARN" ? "bg-yellow-50" : "bg-red-50"
          }`}>
            {provider.providerId} - {provider.status}
          </div>
          <div className="p-3">
            {provider.checks.map(check => (
              <div key={check.id} className="flex items-center gap-2 py-1">
                <span className={
                  check.status === "PASS" ? "text-green-600" :
                  check.status === "WARN" ? "text-yellow-600" : "text-red-600"
                }>
                  {check.status === "PASS" ? " -> " : check.status === "WARN" ? "!" : "✓"}
                </span>
                <span>{check.label}</span>
                {check.message && <span className="text-gray-500 text-sm">({check.message})</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 9) Doctor CLI Alignment

Update `scripts/twicely-doctor.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { runAllProviders } from "../packages/core/health/runner";
import { HEALTH_STATUS, HEALTH_RUN_TYPE } from "../packages/core/health/types";

const prisma = new PrismaClient();

async function main() {
  console.log("Running Twicely Doctor...\n");
  
  const { runId, status, results } = await runAllProviders({
    runType: HEALTH_RUN_TYPE.manual,
  });
  
  // Print results
  for (const result of results) {
    const icon = result.status === HEALTH_STATUS.PASS ? " -> " :
                 result.status === HEALTH_STATUS.WARN ? "!" : "✓";
    
    console.log(`[${icon}] ${result.providerId}: ${result.status}`);
    
    for (const check of result.checks) {
      const checkIcon = check.status === HEALTH_STATUS.PASS ? "   -> " :
                        check.status === HEALTH_STATUS.WARN ? "  !" : "  ✓";
      console.log(`${checkIcon} ${check.label}${check.message ? ` (${check.message})` : ""}`);
    }
    console.log();
  }
  
  // Summary
  console.log("---");
  console.log(`Run ID: ${runId}`);
  console.log(`Overall Status: ${status}`);
  
  // Exit code based on status
  if (status === HEALTH_STATUS.FAIL) {
    console.log("\n❌ Doctor FAILED");
    process.exit(1);
  } else if (status === HEALTH_STATUS.WARN) {
    console.log("\n⚠️ Doctor passed with warnings");
    process.exit(0);
  } else {
    console.log("\n... Doctor PASSED");
    process.exit(0);
  }
}

main()
  .catch(e => {
    console.error("Doctor error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

---

## 10) Health Provider Template

Create `packages/core/health/providers/_template.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

/**
 * Template for creating health providers
 * Copy this file and customize for your module
 */
export const templateHealthProvider: HealthProvider = {
  id: "template",
  label: "Template Provider",
  description: "A template for creating health providers",
  version: "1.0.0",
  
  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;
    
    // Check 1: Example check
    const exampleOk = true;
    checks.push({
      id: "example_check",
      label: "Example check",
      status: exampleOk ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: exampleOk ? "Everything is fine" : "Something is wrong",
    });
    if (!exampleOk) status = HEALTH_STATUS.FAIL;
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS ? "All checks passed" : "Issues detected",
      providerVersion: this.version,
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },
  
  settings: {
    schema: {
      type: "object",
      properties: {
        customThreshold: { type: "number", default: 10 },
      },
    },
    defaults: {
      customThreshold: 10,
    },
  },
  
  ui: {
    SettingsPanel: () => null,
    DetailPage: () => null,
  },
};
```

---

## 10.5) F2 Patch: Subscriptions Health Provider

Create `packages/core/health/providers/subscriptions.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

/**
 * Subscriptions & Billing Health Provider (F2 Patch)
 * Validates subscription system health for eBay-exact tiers
 */
export const subscriptionsHealthProvider: HealthProvider = {
  id: "subscriptions",
  label: "Subscriptions & Billing",
  description: "Validates subscription tiers, pricing, and billing health",
  version: "2.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;

    // Check 1: Active pricing version exists
    const pricingCount = await prisma.tierPricingVersion.count({
      where: { isActive: true },
    });
    checks.push({
      id: "pricing_seeded",
      label: "Active pricing version exists",
      status: pricingCount > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: pricingCount > 0 ? `${pricingCount} active versions` : "No active pricing - run seed",
    });
    if (pricingCount === 0) status = HEALTH_STATUS.FAIL;

    // Check 2: SellerStorefront table exists
    try {
      await prisma.sellerStorefront.count();
      checks.push({
        id: "storefront_table",
        label: "SellerStorefront table exists",
        status: HEALTH_STATUS.PASS,
      });
    } catch {
      checks.push({
        id: "storefront_table",
        label: "SellerStorefront table exists",
        status: HEALTH_STATUS.FAIL,
        message: "Missing - run Phase 24 migration",
      });
      status = HEALTH_STATUS.FAIL;
    }

    // Check 3: No legacy FREE tier subscriptions
    const freeCount = await prisma.sellerSubscription.count({
      where: { tier: "FREE" as any },
    });
    checks.push({
      id: "no_free_tier",
      label: "No FREE tier subscriptions",
      status: freeCount === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: freeCount > 0 ? `${freeCount} need migration to STARTER` : "OK",
    });
    if (freeCount > 0 && status === HEALTH_STATUS.PASS) {
      status = HEALTH_STATUS.WARN;
    }

    // Check 4: Valid tiers only (STARTER|BASIC|PRO|ELITE|ENTERPRISE)
    const validTiers = ["STARTER", "BASIC", "PRO", "ELITE", "ENTERPRISE"];
    const allSubs = await prisma.sellerSubscription.findMany({
      select: { tier: true },
    });
    const invalidTiers = allSubs.filter(s => !validTiers.includes(s.tier));
    checks.push({
      id: "valid_tiers_only",
      label: "All subscriptions use eBay-exact tiers",
      status: invalidTiers.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: invalidTiers.length > 0
        ? `${invalidTiers.length} subs with invalid tiers`
        : "OK",
    });

    // Check 5: Tier pricing matches expected
    const expectedTiers = {
      STARTER: 495,
      BASIC: 2195,
      PRO: 5995,
      ELITE: 29995,
      ENTERPRISE: 299995,
    };
    const pricing = await prisma.tierPricingVersion.findFirst({
      where: { isActive: true },
      orderBy: { effectiveAt: "desc" },
    });
    if (pricing) {
      const pricingData = pricing.tiersJson as any;
      let pricingCorrect = true;
      for (const [tier, expectedCents] of Object.entries(expectedTiers)) {
        if (pricingData?.[tier]?.monthlyPriceCents !== expectedCents) {
          pricingCorrect = false;
          break;
        }
      }
      checks.push({
        id: "pricing_ebay_exact",
        label: "Pricing matches eBay-exact tiers",
        status: pricingCorrect ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
        message: pricingCorrect ? "OK" : "Pricing mismatch - verify tiersJson",
      });
    }

    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS
        ? "Subscriptions healthy"
        : status === HEALTH_STATUS.WARN
          ? "Minor issues detected"
          : "Critical issues",
      providerVersion: this.version,
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },

  settings: {
    schema: {
      type: "object",
      properties: {
        alertOnFreeTier: { type: "boolean", default: true },
      },
    },
    defaults: {
      alertOnFreeTier: true,
    },
  },
};

// Register provider
import { registerProvider } from "../registry";
registerProvider(subscriptionsHealthProvider);
```

---

## 11) Phase 10 Completion Criteria

- **HealthSnapshot** table with canonical schema (PASS/WARN/FAIL/UNKNOWN status)
- **HealthSettings** table with global + per-provider configuration
- **HealthRun** table for batch run tracking
- **ModuleRegistry** table with lifecycle states (ENABLED/DISABLED/MISSING/INCOMPATIBLE)
- Health runner uses **canonical run types** (interactive/scheduled/manual)
- Provider interface includes **UI components** (SettingsPanel, DetailPage)
- **Stale snapshot detection** marks old results as UNKNOWN
- All Phase 1-9 modules have registered health providers
- Doctor CLI returns exit code based on health status
- Corp UI pages:
  - `/corp/health` - Provider grid
  - `/corp/health/:id` - Provider detail
  - `/corp/doctor` - Doctor UI
  - `/corp/settings/modules` - Module registry

---

## 12) Canonical Alignment Notes

This phase now aligns with:

| Canonical Requirement | Implementation |
|----------------------|----------------|
| Status values: PASS/WARN/FAIL/UNKNOWN | HealthStatus enum uses canonical values |
| Run types: interactive/scheduled/manual | HealthRunType enum includes all three |
| HealthSnapshot table (not SystemHealthProviderResult) | Renamed to HealthSnapshot |
| HealthSettings table | Added with global + per-provider settings |
| staleAfterHours | Implemented in settings + runner |
| Provider-owned UI components | SettingsPanel + DetailPage in interface |
| providerVersion tracking | Stored in snapshot |
| Module lifecycle states | ModuleState enum with all states |
