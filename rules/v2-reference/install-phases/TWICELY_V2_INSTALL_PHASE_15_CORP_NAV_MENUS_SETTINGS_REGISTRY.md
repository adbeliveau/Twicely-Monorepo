# TWICELY V2 - Install Phase 15: Corp Navigation + Menus + Settings Registry
**Status:** LOCKED (v1.4)  
**Goal:** No missing menus/routes/pages. Every core module has settings and admin screens wired and permission-gated.

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_15_CORP_NAV_MENUS_SETTINGS_REGISTRY.md`  
> Prereq: Phase 14 complete.

---

## 0) What this phase installs

### Backend
- Navigation registry (single source of truth for Corp menu)
- Settings registry (versioned configs for all platform settings)
- SettingsVersion model for effective-dated config storage
- Settings history API
- Route validation service

### UI (Corp)
- Dynamic sidebar navigation (permission-gated)
- Settings index page
- Quick access dashboard tiles
- Breadcrumb navigation

### Ops
- Health provider: `navigation`
- Doctor checks: all routes mounted, no 404s, permissions enforced

---

## 1) Prisma Schema (Additive)

```prisma
enum SettingsCategory {
  MONETIZATION
  TRUST
  FLAGS
  RETENTION
  POLICY
  NOTIFICATIONS
  SHIPPING
  CATEGORIES
  SEARCH
  ANALYTICS
}

model SettingsVersion {
  id              String           @id @default(cuid())
  category        SettingsCategory
  version         String
  effectiveAt     DateTime
  isActive        Boolean          @default(true)
  configJson      Json
  createdByStaffId String
  notes           String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@unique([category, version])
  @@index([category, isActive, effectiveAt])
}

model NavItem {
  id              String    @id @default(cuid())
  area            String    // corp|seller|buyer
  section         String    // main|settings|tools|reports
  key             String
  label           String
  icon            String?
  href            String
  sortOrder       Int       @default(0)
  parentKey       String?
  requiredPermission String?
  requiredFeatureFlag String?
  isActive        Boolean   @default(true)
  isHidden        Boolean   @default(false)
  badgeType       String?
  badgeSource     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([area, key])
  @@index([area, section, sortOrder])
}

model QuickAccessTile {
  id              String    @id @default(cuid())
  area            String
  title           String
  description     String?
  icon            String
  color           String    @default("gray")
  href            String
  statsEndpoint   String?
  statsLabel      String?
  requiredPermission String?
  sortOrder       Int       @default(0)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([area, sortOrder])
}
```

Run migration:
```bash
npx prisma migrate dev --name corp_nav_settings_phase15
```

---

## 2) Navigation Registry

Create `apps/web/app/(platform)/corp/navigation.ts`:

```ts
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
  section: "main" | "settings" | "tools" | "reports";
  sortOrder?: number;
  parentKey?: string;
  requires?: string;
};

export const CORP_NAV: NavItem[] = [
  // === MAIN ===
  { key: "dashboard", label: "Dashboard", href: "/corp", icon: "LayoutDashboard", section: "main", sortOrder: 0 },
  { key: "users", label: "Users", href: "/corp/users", icon: "Users", section: "main", sortOrder: 10, requires: "users.view" },
  { key: "roles", label: "Roles", href: "/corp/roles", icon: "Shield", section: "main", sortOrder: 11, requires: "roles.view" },
  { key: "staff", label: "Staff", href: "/corp/staff", icon: "UserCog", section: "main", sortOrder: 12, requires: "staff.view" },
  { key: "listings", label: "Listings", href: "/corp/listings", icon: "Package", section: "main", sortOrder: 20, requires: "listings.view" },
  { key: "orders", label: "Orders", href: "/corp/orders", icon: "ShoppingCart", section: "main", sortOrder: 21, requires: "orders.view" },
  { key: "sellers", label: "Sellers", href: "/corp/sellers", icon: "Store", section: "main", sortOrder: 22, requires: "sellers.view" },
  { key: "payments", label: "Payments", href: "/corp/payments/events", icon: "CreditCard", section: "main", sortOrder: 30, requires: "payments.view" },
  { key: "ledger", label: "Ledger", href: "/corp/finance/ledger", icon: "BookOpen", section: "main", sortOrder: 31, requires: "ledger.view" },
  { key: "payouts", label: "Payouts", href: "/corp/finance/payouts", icon: "Banknote", section: "main", sortOrder: 32, requires: "payouts.read" },
  { key: "holds", label: "Holds", href: "/corp/finance/holds", icon: "PauseCircle", section: "main", sortOrder: 33, requires: "holds.view" },
  { key: "trust", label: "Trust Cases", href: "/corp/trust/cases", icon: "AlertTriangle", section: "main", sortOrder: 40, requires: "trust.view" },
  { key: "returns", label: "Returns", href: "/corp/returns", icon: "PackageX", section: "main", sortOrder: 41, requires: "returns.view" },
  { key: "disputes", label: "Disputes", href: "/corp/disputes", icon: "Scale", section: "main", sortOrder: 42, requires: "disputes.view" },
  { key: "support", label: "Support", href: "/corp/support", icon: "MessageSquare", section: "main", sortOrder: 50, requires: "support.view" },

  // === SETTINGS ===
  { key: "settings", label: "Settings", href: "/corp/settings", icon: "Settings", section: "settings", sortOrder: 0 },
  { key: "platform-settings", label: "Platform Settings", href: "/corp/settings/platform", icon: "Settings", section: "settings", sortOrder: 1, requires: "PlatformRole.ADMIN" },
  { key: "monetization", label: "Monetization", href: "/corp/settings/monetization", icon: "DollarSign", section: "settings", sortOrder: 10, requires: "monetization.read" },
  { key: "fee-schedules", label: "Fee Schedules", href: "/corp/settings/monetization/fee-schedules", icon: "Percent", section: "settings", sortOrder: 11, requires: "monetization.read", parentKey: "monetization" },
  { key: "tiers", label: "Tier Pricing", href: "/corp/settings/tiers", icon: "Layers", section: "settings", sortOrder: 12, requires: "monetization.read", parentKey: "monetization" },
  { key: "trust-settings", label: "Trust Settings", href: "/corp/settings/trust", icon: "ShieldCheck", section: "settings", sortOrder: 20, requires: "trust.edit" },
  { key: "policy", label: "Policy Library", href: "/corp/trust/policy", icon: "FileText", section: "settings", sortOrder: 21, requires: "trust.view" },
  { key: "flags", label: "Feature Flags", href: "/corp/settings/flags", icon: "Flag", section: "settings", sortOrder: 30, requires: "flags.read" },
  { key: "notifications", label: "Notifications", href: "/corp/settings/notifications", icon: "Bell", section: "settings", sortOrder: 31, requires: "notifications.read" },
  { key: "retention", label: "Data Retention", href: "/corp/settings/retention", icon: "Database", section: "settings", sortOrder: 40, requires: "privacy.read" },
  { key: "categories", label: "Categories", href: "/corp/settings/categories", icon: "FolderTree", section: "settings", sortOrder: 50, requires: "categories.write" },
  { key: "shipping", label: "Shipping", href: "/corp/settings/shipping", icon: "Truck", section: "settings", sortOrder: 51, requires: "shipping.write" },
  { key: "cancellation", label: "Cancellation Policy", href: "/corp/settings/cancellation", icon: "XCircle", section: "settings", sortOrder: 52, requires: "policy.write" },

  // === TOOLS ===
  { key: "search-admin", label: "Search Index", href: "/corp/tools/search", icon: "Search", section: "tools", sortOrder: 10, requires: "search.admin" },
  { key: "bulk-actions", label: "Bulk Actions", href: "/corp/tools/bulk", icon: "Layers", section: "tools", sortOrder: 20, requires: "bulk.execute" },
  { key: "imports", label: "Imports", href: "/corp/tools/imports", icon: "Upload", section: "tools", sortOrder: 30, requires: "imports.execute" },
  { key: "exports", label: "Exports", href: "/corp/tools/exports", icon: "Download", section: "tools", sortOrder: 31, requires: "exports.execute" },
  { key: "health", label: "System Health", href: "/corp/health", icon: "Activity", section: "tools", sortOrder: 100, requires: "health.view" },
  { key: "doctor", label: "Doctor", href: "/corp/doctor", icon: "Stethoscope", section: "tools", sortOrder: 101, requires: "health.view" },
  { key: "modules", label: "Modules", href: "/corp/settings/modules", icon: "Puzzle", section: "tools", sortOrder: 102, requires: "health.view" },

  // === REPORTS ===
  { key: "analytics", label: "Analytics", href: "/corp/reports/analytics", icon: "BarChart3", section: "reports", sortOrder: 10, requires: "analytics.view" },
  { key: "finance-reports", label: "Finance Reports", href: "/corp/reports/finance", icon: "PieChart", section: "reports", sortOrder: 20, requires: "finance.reports" },
  { key: "seller-reports", label: "Seller Reports", href: "/corp/reports/sellers", icon: "TrendingUp", section: "reports", sortOrder: 30, requires: "sellers.reports" },
  { key: "audit-logs", label: "Audit Logs", href: "/corp/reports/audit", icon: "ScrollText", section: "reports", sortOrder: 40, requires: "audit.view" },
];

export function getNavBySection(section: string): NavItem[] {
  return CORP_NAV.filter((i) => i.section === section && !i.parentKey)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getNavChildren(parentKey: string): NavItem[] {
  return CORP_NAV.filter((i) => i.parentKey === parentKey);
}

export function getAllRoutes(): string[] {
  return CORP_NAV.map((i) => i.href);
}
```

---

## 3) Settings Registry

Create `packages/core/settings/registry.ts`:

```ts
import { PrismaClient, SettingsCategory } from "@prisma/client";

const prisma = new PrismaClient();

export type SettingsKey = "monetization" | "trust" | "flags" | "retention" | "policy" | "notifications" | "shipping" | "categories" | "search" | "analytics";

export const SETTINGS_KEYS: SettingsKey[] = ["monetization", "trust", "flags", "retention", "policy", "notifications", "shipping", "categories", "search", "analytics"];

export const SETTINGS_CATEGORY_MAP: Record<SettingsKey, SettingsCategory> = {
  monetization: "MONETIZATION",
  trust: "TRUST",
  flags: "FLAGS",
  retention: "RETENTION",
  policy: "POLICY",
  notifications: "NOTIFICATIONS",
  shipping: "SHIPPING",
  categories: "CATEGORIES",
  search: "SEARCH",
  analytics: "ANALYTICS",
};

// **RBAC Note:** Use PlatformRole-based authorization, NOT invented permission keys.
// All settings require PlatformRole.ADMIN or role-specific access (FINANCE, MODERATION, etc.)
export const SETTINGS_PERMISSIONS: Record<SettingsKey, { read: string; write: string }> = {
  monetization: { read: "PlatformRole.ADMIN | PlatformRole.FINANCE", write: "PlatformRole.ADMIN | PlatformRole.FINANCE" },
  trust: { read: "PlatformRole.ADMIN", write: "PlatformRole.ADMIN" },
  flags: { read: "PlatformRole.ADMIN | PlatformRole.DEVELOPER", write: "PlatformRole.ADMIN | PlatformRole.DEVELOPER" },
  retention: { read: "PlatformRole.ADMIN", write: "PlatformRole.ADMIN" },
  policy: { read: "PlatformRole.ADMIN | PlatformRole.MODERATION", write: "PlatformRole.ADMIN | PlatformRole.MODERATION" },
  notifications: { read: "PlatformRole.ADMIN | PlatformRole.SUPPORT", write: "PlatformRole.ADMIN | PlatformRole.SUPPORT" },
  shipping: { read: "PlatformRole.ADMIN", write: "PlatformRole.ADMIN" },
  categories: { read: "PlatformRole.ADMIN | PlatformRole.MODERATION", write: "PlatformRole.ADMIN | PlatformRole.MODERATION" },
  search: { read: "PlatformRole.ADMIN", write: "PlatformRole.ADMIN" },
  analytics: { read: "analytics.read", write: "analytics.write" },
};

export async function getCurrentSettings(key: SettingsKey): Promise<any | null> {
  const category = SETTINGS_CATEGORY_MAP[key];
  const settings = await prisma.settingsVersion.findFirst({
    where: { category, isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
  return settings?.configJson ?? null;
}

export async function getSettingsHistory(key: SettingsKey, limit = 20) {
  const category = SETTINGS_CATEGORY_MAP[key];
  return prisma.settingsVersion.findMany({
    where: { category },
    orderBy: { effectiveAt: "desc" },
    take: limit,
  });
}

export async function createSettingsVersion(args: {
  key: SettingsKey;
  version: string;
  effectiveAt: Date;
  configJson: any;
  createdByStaffId: string;
  notes?: string;
}) {
  const category = SETTINGS_CATEGORY_MAP[args.key];
  const created = await prisma.settingsVersion.create({
    data: {
      category,
      version: args.version,
      effectiveAt: args.effectiveAt,
      isActive: true,
      configJson: args.configJson,
      createdByStaffId: args.createdByStaffId,
      notes: args.notes,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: args.createdByStaffId,
      action: `settings.${args.key}.create`,
      entityType: "SettingsVersion",
      entityId: created.id,
      metaJson: { category, version: args.version },
    },
  });

  return created;
}
```

---

## 4) Quick Access Tiles

Create `apps/web/app/(platform)/corp/tiles.ts`:

```ts
export type QuickTile = {
  id: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  href: string;
  statsEndpoint?: string;
  statsLabel?: string;
  requires?: string;
};

export const CORP_QUICK_TILES: QuickTile[] = [
  { id: "disputes", title: "Open Disputes", description: "Cases requiring attention", icon: "Scale", color: "red", href: "/corp/disputes?status=OPEN", statsEndpoint: "/api/platform/disputes/count", statsLabel: "open", requires: "disputes.view" },
  { id: "returns", title: "Pending Returns", description: "Awaiting seller response", icon: "PackageX", color: "orange", href: "/corp/returns?status=PENDING_SELLER", statsEndpoint: "/api/platform/returns/count", statsLabel: "pending", requires: "returns.view" },
  { id: "payouts", title: "Pending Payouts", description: "Ready for execution", icon: "Banknote", color: "green", href: "/corp/finance/payouts?status=PENDING", statsEndpoint: "/api/platform/payouts/count", statsLabel: "ready", requires: "payouts.view" },
  { id: "holds", title: "Active Holds", description: "Blocking payouts", icon: "PauseCircle", color: "yellow", href: "/corp/finance/holds?status=ACTIVE", statsEndpoint: "/api/platform/holds/count", statsLabel: "active", requires: "holds.view" },
  { id: "trust", title: "Trust Cases", description: "Under review", icon: "AlertTriangle", color: "purple", href: "/corp/trust/cases", statsEndpoint: "/api/platform/trust/cases/count", statsLabel: "open", requires: "trust.view" },
  { id: "health", title: "System Health", description: "Platform status", icon: "Activity", color: "blue", href: "/corp/health", requires: "health.view" },
];
```

---

## 5) Corp Sidebar Component

Create `apps/web/app/(platform)/corp/components/CorpSidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CORP_NAV, getNavBySection } from "../navigation";

type Props = { userPermissions: string[] };

export function CorpSidebar({ userPermissions }: Props) {
  const pathname = usePathname();
  
  const canAccess = (requires?: string) => !requires || userPermissions.includes(requires);
  const isActive = (href: string) => href === "/corp" ? pathname === "/corp" : pathname.startsWith(href);

  const sections = [
    { key: "main", label: null },
    { key: "settings", label: "Settings" },
    { key: "tools", label: "Tools" },
    { key: "reports", label: "Reports" },
  ];

  return (
    <div className="w-64 border-r bg-background h-screen flex flex-col">
      <div className="h-16 flex items-center px-4 border-b">
        <Link href="/corp" className="flex items-center gap-2 font-semibold text-lg">
          <span className="text-primary">Twicely</span>
          <Badge variant="outline">Corp</Badge>
        </Link>
      </div>

      <ScrollArea className="flex-1 p-4">
        {sections.map((section) => (
          <div key={section.key} className="mb-6">
            {section.label && (
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {getNavBySection(section.key)
                .filter((item) => canAccess(item.requires))
                .map((item) => (
                  <Button
                    key={item.key}
                    variant={isActive(item.href) ? "secondary" : "ghost"}
                    className={cn("w-full justify-start", isActive(item.href) && "font-medium")}
                    asChild
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
```

---

## 6) Settings Index Page

Create `apps/web/app/(platform)/corp/settings/page.tsx`:

```tsx
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETTINGS = [
  { key: "monetization", title: "Monetization", description: "Fee schedules and tier pricing", href: "/corp/settings/monetization" },
  { key: "trust", title: "Trust Settings", description: "Trust score and ranking config", href: "/corp/settings/trust" },
  { key: "flags", title: "Feature Flags", description: "Toggle features and rollouts", href: "/corp/settings/flags" },
  { key: "retention", title: "Data Retention", description: "Privacy and lifecycle settings", href: "/corp/settings/retention" },
  { key: "policy", title: "Policy Library", description: "Platform policies", href: "/corp/trust/policy" },
  { key: "notifications", title: "Notifications", description: "Email templates", href: "/corp/settings/notifications" },
  { key: "shipping", title: "Shipping", description: "Carrier integrations", href: "/corp/settings/shipping" },
  { key: "categories", title: "Categories", description: "Category management", href: "/corp/settings/categories" },
];

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Platform Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS.map((s) => (
          <Link key={s.key} href={s.href}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

## 7) API Endpoints

### 7.1 Settings API

Create `apps/web/app/api/platform/settings/[category]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getCurrentSettings, getSettingsHistory, createSettingsVersion, SETTINGS_PERMISSIONS } from "@/packages/core/settings/registry";

export async function GET(req: Request, { params }: { params: { category: string } }) {
  const ctx = await requirePlatformAuth();
  const perms = SETTINGS_PERMISSIONS[params.category as keyof typeof SETTINGS_PERMISSIONS];
  if (!perms) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  assertPermission(ctx, perms.read);

  const { searchParams } = new URL(req.url);
  const current = await getCurrentSettings(params.category as any);
  const history = searchParams.get("history") === "true" ? await getSettingsHistory(params.category as any) : [];
  return NextResponse.json({ current, history });
}

export async function POST(req: Request, { params }: { params: { category: string } }) {
  const ctx = await requirePlatformAuth();
  const perms = SETTINGS_PERMISSIONS[params.category as keyof typeof SETTINGS_PERMISSIONS];
  if (!perms) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  assertPermission(ctx, perms.write);

  const { version, effectiveAt, configJson, notes } = await req.json();
  const created = await createSettingsVersion({
    key: params.category as any,
    version,
    effectiveAt: new Date(effectiveAt),
    configJson,
    createdByStaffId: ctx.actorUserId,
    notes,
  });
  return NextResponse.json({ created }, { status: 201 });
}
```

---

## 8) Health Provider

Create `packages/core/health/providers/navigationHealthProvider.ts`:

```ts
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";
import { CORP_NAV } from "@/apps/web/app/(platform)/corp/navigation";
import { SETTINGS_KEYS, getCurrentSettings } from "@/packages/core/settings/registry";

export const navigationHealthProvider: HealthProvider = {
  id: "navigation",
  label: "Navigation & Settings",
  description: "Validates navigation registry and settings versions",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: No duplicate nav keys
    const keys = CORP_NAV.map((i) => i.key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    checks.push({
      id: "nav.no_duplicates",
      label: "No duplicate nav keys",
      status: duplicates.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: duplicates.length === 0 ? "No duplicates" : `Duplicates: ${[...new Set(duplicates)].join(", ")}`,
    });
    if (duplicates.length > 0) status = HEALTH_STATUS.FAIL;

    // Check 2: All settings have versions
    const missing: string[] = [];
    for (const key of SETTINGS_KEYS) {
      const current = await getCurrentSettings(key);
      if (!current) missing.push(key);
    }
    checks.push({
      id: "settings.versions_exist",
      label: "Settings have active versions",
      status: missing.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: missing.length === 0 ? "All configured" : `Missing: ${missing.join(", ")}`,
    });
    if (missing.length > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;

    // Check 3: Nav items have valid hrefs
    const invalid = CORP_NAV.filter((i) => !i.href || !i.href.startsWith("/"));
    checks.push({
      id: "nav.valid_hrefs",
      label: "All nav items have valid hrefs",
      status: invalid.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: invalid.length === 0 ? "All valid" : `Invalid: ${invalid.map(i => i.key).join(", ")}`,
    });
    if (invalid.length > 0) status = HEALTH_STATUS.FAIL;

    return {
      providerId: "navigation",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Navigation & settings healthy" : "Issues detected",
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

## 9) Doctor Checks

```ts
async function checkNavigation() {
  const checks = [];

  // 1. All required routes defined
  const required = ["/corp", "/corp/users", "/corp/roles", "/corp/listings", "/corp/orders", "/corp/payments/events", "/corp/finance/ledger", "/corp/finance/payouts", "/corp/trust/cases", "/corp/disputes", "/corp/returns", "/corp/settings", "/corp/health", "/corp/doctor"];
  const defined = CORP_NAV.map((i) => i.href);
  const missing = required.filter((r) => !defined.includes(r));
  checks.push({ key: "nav.required_routes", ok: missing.length === 0, details: missing.length === 0 ? "All present" : `Missing: ${missing.join(", ")}` });

  // 2. No duplicate keys
  const keys = CORP_NAV.map((i) => i.key);
  const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
  checks.push({ key: "nav.no_duplicates", ok: dups.length === 0, details: dups.length === 0 ? "No duplicates" : `Duplicates: ${dups.join(", ")}` });

  // 3. Settings versions exist
  const settingsOk = [];
  for (const key of ["monetization", "trust", "flags"]) {
    const c = await getCurrentSettings(key as any);
    if (!c) settingsOk.push(key);
  }
  checks.push({ key: "settings.critical_exist", ok: settingsOk.length === 0, details: settingsOk.length === 0 ? "All exist" : `Missing: ${settingsOk.join(", ")}` });

  return checks;
}
```

---

## 10) Route Manifest

All Corp routes that MUST exist:

| Route | Permission | Description |
|-------|------------|-------------|
| `/corp` | - | Dashboard |
| `/corp/users` | users.view | User management |
| `/corp/roles` | roles.view | Role management |
| `/corp/listings` | listings.view | Listings |
| `/corp/orders` | orders.view | Orders |
| `/corp/payments/events` | payments.view | Payment events |
| `/corp/finance/ledger` | ledger.view | Ledger |
| `/corp/finance/payouts` | payouts.read | Payouts |
| `/corp/finance/holds` | holds.view | Holds |
| `/corp/trust/cases` | trust.view | Trust cases |
| `/corp/returns` | returns.view | Returns |
| `/corp/disputes` | disputes.view | Disputes |
| `/corp/settings` | - | Settings index |
| `/corp/settings/monetization` | monetization.read | Monetization |
| `/corp/settings/monetization/fee-schedules` | monetization.read | Fee schedules |
| `/corp/settings/tiers` | monetization.read | Tier pricing |
| `/corp/settings/trust` | trust.edit | Trust settings |
| `/corp/settings/flags` | flags.read | Feature flags |
| `/corp/settings/retention` | privacy.read | Data retention |
| `/corp/settings/cancellation` | policy.write | Cancellation policy settings |
| `/corp/health` | health.view | System health |
| `/corp/doctor` | health.view | Doctor |
| `/corp/reports/analytics` | analytics.view | Analytics |
| `/corp/reports/audit` | audit.view | Audit logs |

---

---

# PART B: Settings Editor UIs

The following sections add the missing editor UIs for platform configuration.

---

## 12) Additional Prisma Schema (Settings Editors)

```prisma
// =============================================================================
// PROMOTION TEMPLATES
// =============================================================================

enum PromotionType {
  PERCENT_OFF
  FIXED_AMOUNT_OFF
  FREE_SHIPPING
  BUY_X_GET_Y
  BUNDLE_DISCOUNT
}

enum PromotionScope {
  PLATFORM_WIDE
  CATEGORY
  SELLER
  LISTING
}

enum PromotionStatus {
  DRAFT
  SCHEDULED
  ACTIVE
  PAUSED
  EXPIRED
  CANCELED
}

model PromotionTemplate {
  id              String          @id @default(cuid())
  name            String
  description     String?
  internalNotes   String?
  type            PromotionType
  scope           PromotionScope
  discountValue   Int
  minOrderCents   Int?
  maxDiscountCents Int?
  categoryIds     String[]        @default([])
  sellerIds       String[]        @default([])
  usageLimitTotal Int?
  usageLimitPerUser Int?
  startsAt        DateTime?
  endsAt          DateTime?
  status          PromotionStatus @default(DRAFT)
  stackable       Boolean         @default(false)
  priority        Int             @default(0)
  createdByStaffId String
  updatedByStaffId String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([status, startsAt, endsAt])
}

model PromotionCode {
  id              String    @id @default(cuid())
  templateId      String
  code            String    @unique
  usageLimitTotal Int?
  usageLimitPerUser Int?
  usedCount       Int       @default(0)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  expiresAt       DateTime?

  @@index([code, isActive])
}

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

model NotificationTemplate {
  id              String   @id @default(cuid())
  key             String   @unique
  name            String
  description     String?
  category        String
  inAppTitle      String
  inAppBody       String
  inAppActionUrl  String?
  emailSubject    String?
  emailBodyHtml   String?
  emailBodyText   String?
  pushTitle       String?
  pushBody        String?
  smsBody         String?
  enabledChannels String[] @default(["IN_APP"])
  variablesSchema Json     @default("[]")
  previewDataJson Json     @default("{}")
  isActive        Boolean  @default(true)
  isSystemTemplate Boolean @default(false)
  lastEditedByStaffId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([category, isActive])
}

// =============================================================================
// SHIPPING PROFILE TEMPLATES
// =============================================================================

model ShippingProfileTemplate {
  id              String   @id @default(cuid())
  name            String
  description     String?
  isDefaultTemplate Boolean @default(false)
  handlingDaysMin Int      @default(1)
  handlingDaysMax Int      @default(3)
  carriers        String[] @default([])
  servicesJson    Json     @default("[]")
  pricingType     String   @default("FLAT")
  flatRateCents   Int?
  freeShippingMinCents Int?
  domesticOnly    Boolean  @default(true)
  excludedRegions String[] @default([])
  insuranceRequired Boolean @default(false)
  isActive        Boolean  @default(true)
  createdByStaffId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([isActive, isDefaultTemplate])
}

// =============================================================================
// CATEGORY ATTRIBUTES
// =============================================================================

enum AttributeType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
  BOOLEAN
  DATE
  COLOR
  SIZE
}

enum AttributeScope {
  REQUIRED
  RECOMMENDED
  OPTIONAL
}

model CategoryAttributeSchema {
  id              String         @id @default(cuid())
  categoryId      String
  attributeKey    String
  label           String
  description     String?
  type            AttributeType
  scope           AttributeScope @default(OPTIONAL)
  validationJson  Json           @default("{}")
  options         String[]       @default([])
  allowCustom     Boolean        @default(false)
  displayOrder    Int            @default(0)
  showInFilters   Boolean        @default(false)
  showInCard      Boolean        @default(false)
  showInSearch    Boolean        @default(false)
  inheritToChildren Boolean      @default(true)
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([categoryId, attributeKey])
  @@index([categoryId, isActive])
}

// =============================================================================
// RETURN POLICY TEMPLATES
// =============================================================================

enum ReturnWindow {
  NO_RETURNS
  DAYS_7
  DAYS_14
  DAYS_30
  DAYS_60
  DAYS_90
}

enum ReturnCondition {
  ANY_REASON
  DEFECTIVE_ONLY
  NOT_AS_DESCRIBED
  DAMAGED_IN_SHIPPING
}

enum RefundMethod {
  ORIGINAL_PAYMENT
  STORE_CREDIT
  EXCHANGE_ONLY
}

model ReturnPolicyTemplate {
  id              String            @id @default(cuid())
  name            String
  description     String?
  isDefaultPolicy Boolean           @default(false)
  returnWindow    ReturnWindow      @default(DAYS_30)
  acceptedConditions ReturnCondition[] @default([ANY_REASON])
  returnShippingPaidBy String       @default("BUYER")
  freeReturnShipping Boolean        @default(false)
  refundMethods   RefundMethod[]    @default([ORIGINAL_PAYMENT])
  restockingFeePct Int              @default(0)
  requireOriginalPackaging Boolean  @default(false)
  requireTags     Boolean           @default(false)
  requireUnused   Boolean           @default(false)
  excludedCategories String[]       @default([])
  summaryText     String?
  fullPolicyHtml  String?
  isActive        Boolean           @default(true)
  createdByStaffId String
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([isActive, isDefaultPolicy])
}
```

---

## 13) Promotion Settings Service

Create `packages/core/settings/promotions.ts`:

```ts
import { PrismaClient, PromotionStatus, PromotionType, PromotionScope } from "@prisma/client";

const prisma = new PrismaClient();

export async function createPromotionTemplate(input: {
  name: string;
  type: PromotionType;
  scope: PromotionScope;
  discountValue: number;
  staffId: string;
  description?: string;
  minOrderCents?: number;
  maxDiscountCents?: number;
  categoryIds?: string[];
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  startsAt?: Date;
  endsAt?: Date;
  stackable?: boolean;
}) {
  if (input.type === "PERCENT_OFF" && (input.discountValue < 1 || input.discountValue > 100)) {
    throw new Error("INVALID_DISCOUNT_PERCENT");
  }

  const template = await prisma.promotionTemplate.create({
    data: {
      name: input.name,
      description: input.description,
      type: input.type,
      scope: input.scope,
      discountValue: input.discountValue,
      minOrderCents: input.minOrderCents,
      maxDiscountCents: input.maxDiscountCents,
      categoryIds: input.categoryIds ?? [],
      usageLimitTotal: input.usageLimitTotal,
      usageLimitPerUser: input.usageLimitPerUser,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      stackable: input.stackable ?? false,
      status: "DRAFT",
      createdByStaffId: input.staffId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: input.staffId,
      action: "promotion.template.create",
      entityType: "PromotionTemplate",
      entityId: template.id,
    },
  });

  return template;
}

export async function updatePromotionStatus(id: string, status: PromotionStatus, staffId: string) {
  const existing = await prisma.promotionTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  const validTransitions: Record<PromotionStatus, PromotionStatus[]> = {
    DRAFT: ["SCHEDULED", "ACTIVE", "CANCELED"],
    SCHEDULED: ["ACTIVE", "PAUSED", "CANCELED"],
    ACTIVE: ["PAUSED", "CANCELED"],
    PAUSED: ["ACTIVE", "CANCELED"],
    EXPIRED: [],
    CANCELED: [],
  };

  if (!validTransitions[existing.status]?.includes(status)) {
    throw new Error(`INVALID_TRANSITION:${existing.status}->${status}`);
  }

  return prisma.promotionTemplate.update({
    where: { id },
    data: { status, updatedByStaffId: staffId },
  });
}

export async function listPromotionTemplates(filters?: { status?: PromotionStatus }) {
  const where: any = {};
  if (filters?.status) where.status = filters.status;
  return prisma.promotionTemplate.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function createPromotionCode(templateId: string, code: string, staffId: string) {
  const existing = await prisma.promotionCode.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) throw new Error("CODE_EXISTS");

  return prisma.promotionCode.create({
    data: { templateId, code: code.toUpperCase() },
  });
}
```

---

## 14) Notification Template Service

Create `packages/core/settings/notificationTemplates.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createNotificationTemplate(input: {
  key: string;
  name: string;
  category: string;
  inAppTitle: string;
  inAppBody: string;
  staffId: string;
  emailSubject?: string;
  emailBodyHtml?: string;
  pushTitle?: string;
  pushBody?: string;
  smsBody?: string;
  variables?: Array<{ name: string; type: string; required: boolean }>;
}) {
  const existing = await prisma.notificationTemplate.findUnique({ where: { key: input.key } });
  if (existing) throw new Error("KEY_EXISTS");

  return prisma.notificationTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      category: input.category,
      inAppTitle: input.inAppTitle,
      inAppBody: input.inAppBody,
      emailSubject: input.emailSubject,
      emailBodyHtml: input.emailBodyHtml,
      pushTitle: input.pushTitle,
      pushBody: input.pushBody,
      smsBody: input.smsBody,
      variablesSchema: input.variables ?? [],
      lastEditedByStaffId: input.staffId,
    },
  });
}

export async function updateNotificationTemplate(id: string, updates: any, staffId: string) {
  const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.isSystemTemplate) throw new Error("CANNOT_EDIT_SYSTEM");

  return prisma.notificationTemplate.update({
    where: { id },
    data: { ...updates, lastEditedByStaffId: staffId },
  });
}

export async function previewTemplate(id: string, data: Record<string, any>) {
  const template = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!template) throw new Error("NOT_FOUND");

  const render = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? `{{${k}}}`);

  return {
    inApp: { title: render(template.inAppTitle), body: render(template.inAppBody) },
    email: template.emailSubject ? { subject: render(template.emailSubject), body: template.emailBodyHtml ? render(template.emailBodyHtml) : null } : null,
  };
}

export async function listNotificationTemplates(category?: string) {
  const where: any = { isActive: true };
  if (category) where.category = category;
  return prisma.notificationTemplate.findMany({ where, orderBy: { name: "asc" } });
}
```

---

## 15) Shipping Profile Template Service

Create `packages/core/settings/shippingProfiles.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createShippingProfileTemplate(input: {
  name: string;
  staffId: string;
  isDefaultTemplate?: boolean;
  handlingDaysMin?: number;
  handlingDaysMax?: number;
  carriers?: string[];
  pricingType?: string;
  flatRateCents?: number;
  domesticOnly?: boolean;
}) {
  if (input.isDefaultTemplate) {
    await prisma.shippingProfileTemplate.updateMany({
      where: { isDefaultTemplate: true },
      data: { isDefaultTemplate: false },
    });
  }

  return prisma.shippingProfileTemplate.create({
    data: {
      name: input.name,
      isDefaultTemplate: input.isDefaultTemplate ?? false,
      handlingDaysMin: input.handlingDaysMin ?? 1,
      handlingDaysMax: input.handlingDaysMax ?? 3,
      carriers: input.carriers ?? [],
      pricingType: input.pricingType ?? "FLAT",
      flatRateCents: input.flatRateCents,
      domesticOnly: input.domesticOnly ?? true,
      createdByStaffId: input.staffId,
    },
  });
}

export async function listShippingProfileTemplates() {
  return prisma.shippingProfileTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefaultTemplate: "desc" }, { name: "asc" }],
  });
}

export async function getDefaultShippingProfile() {
  return prisma.shippingProfileTemplate.findFirst({
    where: { isDefaultTemplate: true, isActive: true },
  });
}
```

---

## 16) Category Attribute Service

Create `packages/core/settings/categoryAttributes.ts`:

```ts
import { PrismaClient, AttributeType, AttributeScope } from "@prisma/client";

const prisma = new PrismaClient();

export async function createCategoryAttribute(input: {
  categoryId: string;
  attributeKey: string;
  label: string;
  type: AttributeType;
  staffId: string;
  scope?: AttributeScope;
  options?: string[];
  showInFilters?: boolean;
  showInCard?: boolean;
}) {
  if (!/^[a-z][a-z0-9_]*$/.test(input.attributeKey)) {
    throw new Error("INVALID_KEY_FORMAT");
  }

  const existing = await prisma.categoryAttributeSchema.findUnique({
    where: { categoryId_attributeKey: { categoryId: input.categoryId, attributeKey: input.attributeKey } },
  });
  if (existing) throw new Error("ATTRIBUTE_EXISTS");

  const attr = await prisma.categoryAttributeSchema.create({
    data: {
      categoryId: input.categoryId,
      attributeKey: input.attributeKey,
      label: input.label,
      type: input.type,
      scope: input.scope ?? "OPTIONAL",
      options: input.options ?? [],
      showInFilters: input.showInFilters ?? false,
      showInCard: input.showInCard ?? false,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: input.staffId,
      action: "category.attribute.create",
      entityType: "CategoryAttributeSchema",
      entityId: attr.id,
    },
  });

  return attr;
}

export async function getCategoryAttributes(categoryId: string) {
  return prisma.categoryAttributeSchema.findMany({
    where: { categoryId, isActive: true },
    orderBy: { displayOrder: "asc" },
  });
}

export async function deleteCategoryAttribute(id: string, staffId: string) {
  await prisma.categoryAttributeSchema.update({ where: { id }, data: { isActive: false } });
  await prisma.auditEvent.create({
    data: { actorUserId: staffId, action: "category.attribute.delete", entityType: "CategoryAttributeSchema", entityId: id },
  });
}
```

---

## 17) Return Policy Service

Create `packages/core/settings/returnPolicies.ts`:

```ts
import { PrismaClient, ReturnWindow, ReturnCondition, RefundMethod } from "@prisma/client";

const prisma = new PrismaClient();

export async function createReturnPolicyTemplate(input: {
  name: string;
  staffId: string;
  returnWindow?: ReturnWindow;
  acceptedConditions?: ReturnCondition[];
  returnShippingPaidBy?: string;
  refundMethods?: RefundMethod[];
  restockingFeePct?: number;
  isDefaultPolicy?: boolean;
}) {
  if (input.isDefaultPolicy) {
    await prisma.returnPolicyTemplate.updateMany({
      where: { isDefaultPolicy: true },
      data: { isDefaultPolicy: false },
    });
  }

  return prisma.returnPolicyTemplate.create({
    data: {
      name: input.name,
      isDefaultPolicy: input.isDefaultPolicy ?? false,
      returnWindow: input.returnWindow ?? "DAYS_30",
      acceptedConditions: input.acceptedConditions ?? ["ANY_REASON"],
      returnShippingPaidBy: input.returnShippingPaidBy ?? "BUYER",
      refundMethods: input.refundMethods ?? ["ORIGINAL_PAYMENT"],
      restockingFeePct: input.restockingFeePct ?? 0,
      createdByStaffId: input.staffId,
    },
  });
}

export async function listReturnPolicyTemplates() {
  return prisma.returnPolicyTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefaultPolicy: "desc" }, { name: "asc" }],
  });
}

export async function getDefaultReturnPolicy() {
  return prisma.returnPolicyTemplate.findFirst({
    where: { isDefaultPolicy: true, isActive: true },
  });
}
```

---

## 17.1) Cancellation Policy Settings Service

Create `packages/core/settings/cancellationPolicy.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get current cancellation policy settings
 * Uses CancellationPolicySettings model from Phase 3
 */
export async function getCancellationPolicySettings() {
  // Get active settings (most recent)
  const settings = await prisma.cancellationPolicySettings.findFirst({
    where: { isActive: true },
    orderBy: { effectiveAt: "desc" },
  });

  if (!settings) {
    // Return defaults if no settings exist
    return {
      id: null,
      buyerFreeWindowMinutes: 5,
      sellerAutoApproveWindowHours: 24,
      maxCancelsBeforeRestriction: 5,
      cancelWindowDays: 30,
      restrictionDurationDays: 30,
      requireReasonAfterFreeWindow: true,
      allowPartialCancellation: false,
      defectThresholdPct: 2.0,
      defectWindowDays: 90,
      isActive: true,
      effectiveAt: new Date(),
    };
  }

  return settings;
}

/**
 * Update cancellation policy settings
 * Creates a new version (settings are versioned)
 */
export async function updateCancellationPolicySettings(args: {
  buyerFreeWindowMinutes?: number;
  sellerAutoApproveWindowHours?: number;
  maxCancelsBeforeRestriction?: number;
  cancelWindowDays?: number;
  restrictionDurationDays?: number;
  requireReasonAfterFreeWindow?: boolean;
  allowPartialCancellation?: boolean;
  defectThresholdPct?: number;
  defectWindowDays?: number;
  staffId: string;
  notes?: string;
}) {
  // Deactivate current settings
  await prisma.cancellationPolicySettings.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  // Get current values to merge with updates
  const current = await getCancellationPolicySettings();

  // Create new version
  const newSettings = await prisma.cancellationPolicySettings.create({
    data: {
      buyerFreeWindowMinutes: args.buyerFreeWindowMinutes ?? current.buyerFreeWindowMinutes,
      sellerAutoApproveWindowHours: args.sellerAutoApproveWindowHours ?? current.sellerAutoApproveWindowHours,
      maxCancelsBeforeRestriction: args.maxCancelsBeforeRestriction ?? current.maxCancelsBeforeRestriction,
      cancelWindowDays: args.cancelWindowDays ?? current.cancelWindowDays,
      restrictionDurationDays: args.restrictionDurationDays ?? current.restrictionDurationDays,
      requireReasonAfterFreeWindow: args.requireReasonAfterFreeWindow ?? current.requireReasonAfterFreeWindow,
      allowPartialCancellation: args.allowPartialCancellation ?? current.allowPartialCancellation,
      defectThresholdPct: args.defectThresholdPct ?? current.defectThresholdPct,
      defectWindowDays: args.defectWindowDays ?? current.defectWindowDays,
      isActive: true,
      effectiveAt: new Date(),
      createdByStaffId: args.staffId,
      notes: args.notes,
    },
  });

  // Audit log
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.staffId,
      action: "settings.cancellation.update",
      entityType: "CancellationPolicySettings",
      entityId: newSettings.id,
      metaJson: {
        changes: args,
        previousId: current.id,
      },
    },
  });

  return newSettings;
}

/**
 * Get cancellation policy settings history
 */
export async function getCancellationPolicyHistory(limit = 20) {
  return prisma.cancellationPolicySettings.findMany({
    orderBy: { effectiveAt: "desc" },
    take: limit,
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Get cancellation statistics for dashboard
 */
export async function getCancellationStats(daysBack = 30) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [totalCancels, buyerCancels, sellerCancels, freeWindowCancels, requestedCancels] = await Promise.all([
    prisma.order.count({
      where: {
        status: "CANCELED",
        updatedAt: { gte: since },
      },
    }),
    prisma.order.count({
      where: {
        status: "CANCELED",
        cancelInitiator: "BUYER",
        updatedAt: { gte: since },
      },
    }),
    prisma.order.count({
      where: {
        status: "CANCELED",
        cancelInitiator: "SELLER",
        updatedAt: { gte: since },
      },
    }),
    prisma.order.count({
      where: {
        status: "CANCELED",
        wasFreeWindowCancel: true,
        updatedAt: { gte: since },
      },
    }),
    prisma.orderCancelRequest.count({
      where: {
        createdAt: { gte: since },
      },
    }),
  ]);

  return {
    period: `${daysBack} days`,
    totalCancels,
    buyerCancels,
    sellerCancels,
    freeWindowCancels,
    requestedCancels,
    buyerCancelRate: totalCancels > 0 ? ((buyerCancels / totalCancels) * 100).toFixed(1) : "0",
    sellerCancelRate: totalCancels > 0 ? ((sellerCancels / totalCancels) * 100).toFixed(1) : "0",
  };
}
```

---

## 17.2) Cancellation Policy API Endpoints

Create `apps/web/app/api/platform/settings/cancellation/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import {
  getCancellationPolicySettings,
  updateCancellationPolicySettings,
  getCancellationPolicyHistory,
  getCancellationStats,
} from "@/packages/core/settings/cancellationPolicy";

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "policy.read");

  const { searchParams } = new URL(req.url);
  const includeHistory = searchParams.get("history") === "true";
  const includeStats = searchParams.get("stats") === "true";

  const current = await getCancellationPolicySettings();
  const history = includeHistory ? await getCancellationPolicyHistory() : [];
  const stats = includeStats ? await getCancellationStats() : null;

  return NextResponse.json({ current, history, stats });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "policy.write");

  const body = await req.json();
  const settings = await updateCancellationPolicySettings({
    ...body,
    staffId: ctx.actorUserId,
  });

  return NextResponse.json({ settings }, { status: 201 });
}
```

---

## 17.3) Cancellation Policy Settings UI

Create `apps/web/app/(platform)/corp/settings/cancellation/page.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, History, BarChart3, AlertTriangle, Clock, Ban, Shield } from "lucide-react";

type CancellationSettings = {
  id: string | null;
  buyerFreeWindowMinutes: number;
  sellerAutoApproveWindowHours: number;
  maxCancelsBeforeRestriction: number;
  cancelWindowDays: number;
  restrictionDurationDays: number;
  requireReasonAfterFreeWindow: boolean;
  allowPartialCancellation: boolean;
  defectThresholdPct: number;
  defectWindowDays: number;
};

type CancellationStats = {
  period: string;
  totalCancels: number;
  buyerCancels: number;
  sellerCancels: number;
  freeWindowCancels: number;
  requestedCancels: number;
  buyerCancelRate: string;
  sellerCancelRate: string;
};

export default function CancellationPolicyPage() {
  const [settings, setSettings] = useState<CancellationSettings | null>(null);
  const [stats, setStats] = useState<CancellationStats | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const res = await fetch("/api/platform/settings/cancellation?history=true&stats=true");
    const data = await res.json();
    setSettings(data.current);
    setHistory(data.history || []);
    setStats(data.stats);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/platform/settings/cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setDirty(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof CancellationSettings>(key: K, value: CancellationSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
  }

  if (!settings) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cancellation Policy Settings</h1>
          <p className="text-muted-foreground">Configure order cancellation rules and restrictions</p>
        </div>
        <Button onClick={saveSettings} disabled={!dirty || saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {dirty && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsaved Changes</AlertTitle>
          <AlertDescription>You have unsaved changes. Click Save to apply them.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          {/* Buyer Cancellation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Buyer Cancellation Rules
              </CardTitle>
              <CardDescription>
                Configure how buyers can cancel orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="freeWindow">Free Cancellation Window (minutes)</Label>
                  <Input
                    id="freeWindow"
                    type="number"
                    min={0}
                    max={60}
                    value={settings.buyerFreeWindowMinutes}
                    onChange={(e) => updateSetting("buyerFreeWindowMinutes", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Buyers can cancel without reason within this window after purchase
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cancelWindow">Cancel Request Window (days)</Label>
                  <Input
                    id="cancelWindow"
                    type="number"
                    min={1}
                    max={90}
                    value={settings.cancelWindowDays}
                    onChange={(e) => updateSetting("cancelWindowDays", parseInt(e.target.value) || 30)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Days after purchase that buyer can request cancellation
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Reason After Free Window</Label>
                  <p className="text-xs text-muted-foreground">
                    Buyers must provide a reason after the free window expires
                  </p>
                </div>
                <Switch
                  checked={settings.requireReasonAfterFreeWindow}
                  onCheckedChange={(v) => updateSetting("requireReasonAfterFreeWindow", v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Partial Cancellation</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow canceling individual items from multi-item orders
                  </p>
                </div>
                <Switch
                  checked={settings.allowPartialCancellation}
                  onCheckedChange={(v) => updateSetting("allowPartialCancellation", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Abuse Prevention */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Buyer Abuse Prevention
              </CardTitle>
              <CardDescription>
                Restrict buyers who cancel too frequently
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxCancels">Max Cancellations Before Restriction</Label>
                  <Input
                    id="maxCancels"
                    type="number"
                    min={1}
                    max={20}
                    value={settings.maxCancelsBeforeRestriction}
                    onChange={(e) => updateSetting("maxCancelsBeforeRestriction", parseInt(e.target.value) || 5)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of cancellations within window before restrictions apply
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restrictionDuration">Restriction Duration (days)</Label>
                  <Input
                    id="restrictionDuration"
                    type="number"
                    min={1}
                    max={365}
                    value={settings.restrictionDurationDays}
                    onChange={(e) => updateSetting("restrictionDurationDays", parseInt(e.target.value) || 30)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How long the buyer loses free cancellation privileges
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seller Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Seller Cancellation Rules
              </CardTitle>
              <CardDescription>
                Configure seller cancellation handling and defect tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="autoApprove">Auto-Approve Window (hours)</Label>
                  <Input
                    id="autoApprove"
                    type="number"
                    min={1}
                    max={168}
                    value={settings.sellerAutoApproveWindowHours}
                    onChange={(e) => updateSetting("sellerAutoApproveWindowHours", parseInt(e.target.value) || 24)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cancel requests auto-approve if seller doesn't respond within this time
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defectThreshold">Defect Rate Threshold (%)</Label>
                  <Input
                    id="defectThreshold"
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={settings.defectThresholdPct}
                    onChange={(e) => updateSetting("defectThresholdPct", parseFloat(e.target.value) || 2.0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sellers above this cancellation rate face account restrictions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defectWindow">Defect Evaluation Window (days)</Label>
                  <Input
                    id="defectWindow"
                    type="number"
                    min={30}
                    max={365}
                    value={settings.defectWindowDays}
                    onChange={(e) => updateSetting("defectWindowDays", parseInt(e.target.value) || 90)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Rolling window for calculating seller defect rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.totalCancels}</div>
                  <p className="text-sm text-muted-foreground">Total Cancellations</p>
                  <Badge variant="outline" className="mt-2">{stats.period}</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.buyerCancels}</div>
                  <p className="text-sm text-muted-foreground">Buyer Cancellations</p>
                  <Badge variant="outline" className="mt-2">{stats.buyerCancelRate}% of total</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.sellerCancels}</div>
                  <p className="text-sm text-muted-foreground">Seller Cancellations</p>
                  <Badge variant="outline" className="mt-2">{stats.sellerCancelRate}% of total</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.freeWindowCancels}</div>
                  <p className="text-sm text-muted-foreground">Free Window Cancels</p>
                  <Badge variant="secondary" className="mt-2">No penalty</Badge>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Settings History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history.map((h, i) => (
                  <div key={h.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {new Date(h.effectiveAt).toLocaleDateString()}
                        </span>
                        {i === 0 && <Badge>Current</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Free window: {h.buyerFreeWindowMinutes}min | Max cancels: {h.maxCancelsBeforeRestriction}
                      </p>
                      {h.notes && <p className="text-sm italic mt-1">{h.notes}</p>}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {h.createdBy?.name || "System"}
                    </span>
                  </div>
                ))}
                {history.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No history available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 18) Settings Editor API Endpoints

### 18.1 Promotions

`apps/web/app/api/platform/settings/promotions/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { listPromotionTemplates, createPromotionTemplate } from "@/packages/core/settings/promotions";

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.promotions.view");
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as any;
  return NextResponse.json({ templates: await listPromotionTemplates({ status }) });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.promotions.edit");
  const body = await req.json();
  const template = await createPromotionTemplate({ ...body, staffId: ctx.actorUserId });
  return NextResponse.json({ template }, { status: 201 });
}
```

### 18.2 Notification Templates

`apps/web/app/api/platform/settings/notifications/templates/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { listNotificationTemplates, createNotificationTemplate } from "@/packages/core/settings/notificationTemplates";

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.notifications.view");
  const { searchParams } = new URL(req.url);
  return NextResponse.json({ templates: await listNotificationTemplates(searchParams.get("category") ?? undefined) });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.notifications.edit");
  const body = await req.json();
  return NextResponse.json({ template: await createNotificationTemplate({ ...body, staffId: ctx.actorUserId }) }, { status: 201 });
}
```

### 18.3 Shipping Profiles

`apps/web/app/api/platform/settings/shipping/profiles/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { listShippingProfileTemplates, createShippingProfileTemplate } from "@/packages/core/settings/shippingProfiles";

export async function GET() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.shipping.view");
  return NextResponse.json({ templates: await listShippingProfileTemplates() });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.shipping.edit");
  const body = await req.json();
  return NextResponse.json({ template: await createShippingProfileTemplate({ ...body, staffId: ctx.actorUserId }) }, { status: 201 });
}
```

### 18.4 Category Attributes

`apps/web/app/api/platform/settings/categories/[categoryId]/attributes/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getCategoryAttributes, createCategoryAttribute } from "@/packages/core/settings/categoryAttributes";

export async function GET(req: Request, { params }: { params: { categoryId: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.categories.view");
  return NextResponse.json({ attributes: await getCategoryAttributes(params.categoryId) });
}

export async function POST(req: Request, { params }: { params: { categoryId: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.categories.edit");
  const body = await req.json();
  return NextResponse.json({ attribute: await createCategoryAttribute({ ...body, categoryId: params.categoryId, staffId: ctx.actorUserId }) }, { status: 201 });
}
```

### 18.5 Return Policies

`apps/web/app/api/platform/settings/return-policies/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { listReturnPolicyTemplates, createReturnPolicyTemplate } from "@/packages/core/settings/returnPolicies";

export async function GET() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.returns.view");
  return NextResponse.json({ policies: await listReturnPolicyTemplates() });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "settings.returns.edit");
  const body = await req.json();
  return NextResponse.json({ policy: await createReturnPolicyTemplate({ ...body, staffId: ctx.actorUserId }) }, { status: 201 });
}
```

---

## 19) Settings Editor UI Components

### 19.1 Promotion Settings Editor

`apps/web/app/platform/settings/promotions/page.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pause, Play, Edit } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100", ACTIVE: "bg-green-100", PAUSED: "bg-yellow-100", EXPIRED: "bg-red-100",
};

export default function PromotionSettingsPage() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => { fetchPromotions(); }, [filter]);

  async function fetchPromotions() {
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/platform/settings/promotions${params}`);
    setPromotions((await res.json()).templates ?? []);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Promotion Settings</h1>
        <Button><Plus className="w-4 h-4 mr-2" /> Create</Button>
      </div>
      <div className="flex gap-2">
        {["all", "DRAFT", "ACTIVE", "PAUSED"].map(s => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>{s}</Button>
        ))}
      </div>
      <div className="grid gap-4">
        {promotions.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                </div>
                <p className="text-sm text-gray-500">{p.type}  *  {p.discountValue}{p.type === "PERCENT_OFF" ? "%" : "¢"} off</p>
              </div>
              <Button variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 19.2 Notification Template Editor

`apps/web/app/platform/settings/notifications/templates/page.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Eye } from "lucide-react";

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState("all");

  useEffect(() => { fetchTemplates(); }, [category]);

  async function fetchTemplates() {
    const params = category !== "all" ? `?category=${category}` : "";
    const res = await fetch(`/api/platform/settings/notifications/templates${params}`);
    setTemplates((await res.json()).templates ?? []);
  }

  const categories = [...new Set(templates.map(t => t.category))];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Notification Templates</h1>
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="grid gap-4">
        {templates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4 flex justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.name}</span>
                  <Badge variant="outline">{t.key}</Badge>
                  {t.isSystemTemplate && <Badge>System</Badge>}
                </div>
                <p className="text-sm text-gray-500">{t.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button>
                {!t.isSystemTemplate && <Button variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 19.3 Category Attribute Editor

`apps/web/app/platform/settings/categories/[categoryId]/attributes/page.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, GripVertical } from "lucide-react";

const TYPES = ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "BOOLEAN", "DATE", "COLOR", "SIZE"];

export default function CategoryAttributesPage() {
  const { categoryId } = useParams();
  const [attrs, setAttrs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ attributeKey: "", label: "", type: "TEXT", scope: "OPTIONAL", options: "" });

  useEffect(() => { fetchAttrs(); }, [categoryId]);

  async function fetchAttrs() {
    const res = await fetch(`/api/platform/settings/categories/${categoryId}/attributes`);
    setAttrs((await res.json()).attributes ?? []);
  }

  async function create() {
    await fetch(`/api/platform/settings/categories/${categoryId}/attributes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, options: form.options ? form.options.split(",").map(s => s.trim()) : [] }),
    });
    setShowForm(false);
    setForm({ attributeKey: "", label: "", type: "TEXT", scope: "OPTIONAL", options: "" });
    fetchAttrs();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Category Attributes</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Add</Button>
      </div>
      {showForm && (
        <Card><CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="key (e.g., brand)" value={form.attributeKey} onChange={e => setForm({ ...form, attributeKey: e.target.value.toLowerCase().replace(/\s/g, "_") })} />
            <Input placeholder="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REQUIRED">Required</SelectItem>
                <SelectItem value="RECOMMENDED">Recommended</SelectItem>
                <SelectItem value="OPTIONAL">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.type === "SELECT" || form.type === "MULTI_SELECT") && (
            <Input placeholder="Options (comma-separated)" value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} />
          )}
          <div className="flex gap-2">
            <Button onClick={create}>Create</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </CardContent></Card>
      )}
      <div className="space-y-2">
        {attrs.map(a => (
          <Card key={a.id}>
            <CardContent className="p-3 flex items-center gap-4">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <div className="flex-1">
                <span className="font-medium">{a.label}</span>
                <code className="ml-2 text-xs bg-gray-100 px-1 rounded">{a.attributeKey}</code>
                <Badge className="ml-2" variant="outline">{a.type}</Badge>
                <Badge className="ml-1">{a.scope}</Badge>
              </div>
              <Button variant="ghost" size="sm"><Trash className="w-4 h-4 text-red-500" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 19.4 Return Policy Editor

`apps/web/app/platform/settings/return-policies/page.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Star } from "lucide-react";

const WINDOW_LABELS: Record<string, string> = { NO_RETURNS: "No Returns", DAYS_7: "7 Days", DAYS_14: "14 Days", DAYS_30: "30 Days", DAYS_60: "60 Days", DAYS_90: "90 Days" };

export default function ReturnPoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);

  useEffect(() => { fetchPolicies(); }, []);

  async function fetchPolicies() {
    const res = await fetch("/api/platform/settings/return-policies");
    setPolicies((await res.json()).policies ?? []);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Return Policies</h1>
        <Button><Plus className="w-4 h-4 mr-2" /> Create</Button>
      </div>
      <div className="grid gap-4">
        {policies.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.isDefaultPolicy && <Badge className="bg-yellow-100"><Star className="w-3 h-3 mr-1" />Default</Badge>}
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{WINDOW_LABELS[p.returnWindow]}</Badge>
                  <Badge variant="outline">Shipping: {p.returnShippingPaidBy}</Badge>
                  {p.restockingFeePct > 0 && <Badge variant="outline">{p.restockingFeePct}% Restocking</Badge>}
                </div>
              </div>
              <Button variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 19.5 Shipping Profile Editor

`apps/web/app/platform/settings/shipping/profiles/page.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Star } from "lucide-react";

export default function ShippingProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => { fetchProfiles(); }, []);

  async function fetchProfiles() {
    const res = await fetch("/api/platform/settings/shipping/profiles");
    setProfiles((await res.json()).templates ?? []);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Shipping Profiles</h1>
        <Button><Plus className="w-4 h-4 mr-2" /> Create</Button>
      </div>
      <div className="grid gap-4">
        {profiles.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.isDefaultTemplate && <Badge className="bg-yellow-100"><Star className="w-3 h-3 mr-1" />Default</Badge>}
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{p.handlingDaysMin}-{p.handlingDaysMax} days handling</Badge>
                  <Badge variant="outline">{p.pricingType}</Badge>
                  {p.domesticOnly && <Badge variant="outline">Domestic Only</Badge>}
                </div>
              </div>
              <Button variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 20) Navigation Registry Updates

Add to `NAV_ITEMS` in navigation registry:

```ts
// Settings sub-items
{ path: "/corp/settings/promotions", label: "Promotions", permission: "settings.promotions.view", parent: "settings" },
{ path: "/corp/settings/notifications/templates", label: "Notification Templates", permission: "settings.notifications.view", parent: "settings" },
{ path: "/corp/settings/shipping/profiles", label: "Shipping Profiles", permission: "settings.shipping.view", parent: "settings" },
{ path: "/corp/settings/categories", label: "Category Attributes", permission: "settings.categories.view", parent: "settings" },
{ path: "/corp/settings/return-policies", label: "Return Policies", permission: "settings.returns.view", parent: "settings" },
{ path: "/corp/settings/cancellation", label: "Cancellation Policy", permission: "policy.write", parent: "settings" },
```

---

## 21) Bulk Actions Service (HIGH-10)

Create `packages/core/bulk/listing-actions.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { canUseFeature, TierFeatureError, getSellerTier } from "../subscriptions/tier-enforcement";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export type BulkAction =
  | "ACTIVATE_LISTINGS"
  | "PAUSE_LISTINGS"
  | "DELETE_LISTINGS"
  | "UPDATE_PRICE"
  | "UPDATE_QUANTITY"
  | "APPLY_PROMOTION"
  | "EXPORT_CSV";

export type BulkActionResult = {
  success: boolean;
  action: BulkAction;
  totalItems: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ listingId: string; error: string }>;
};

/**
 * Execute bulk action on listings
 * Requires BASIC tier or higher (not available for STARTER)
 */
export async function executeBulkListingAction(args: {
  sellerId: string;
  action: BulkAction;
  listingIds: string[];
  params?: {
    priceCents?: number;
    quantity?: number;
    couponId?: string;
  };
}): Promise<BulkActionResult> {
  // Check tier allows bulk tools
  const allowed = await canUseFeature(args.sellerId, "bulkListingTools");
  if (!allowed) {
    const tier = await getSellerTier(args.sellerId);
    throw new TierFeatureError(
      "Bulk listing tools require BASIC tier or higher. Upgrade from STARTER to access this feature.",
      "bulkListingTools",
      tier
    );
  }

  // Verify ownership of all listings
  const ownedListings = await prisma.listing.findMany({
    where: {
      id: { in: args.listingIds },
      ownerUserId: args.sellerId,
    },
    select: { id: true, status: true },
  });

  const ownedIds = new Set(ownedListings.map((l) => l.id));
  const errors: Array<{ listingId: string; error: string }> = [];
  let successCount = 0;

  for (const listingId of args.listingIds) {
    if (!ownedIds.has(listingId)) {
      errors.push({ listingId, error: "Not found or not owned by seller" });
      continue;
    }

    try {
      switch (args.action) {
        case "ACTIVATE_LISTINGS":
          await prisma.listing.update({
            where: { id: listingId },
            data: { status: "ACTIVE" },
          });
          break;

        case "PAUSE_LISTINGS":
          await prisma.listing.update({
            where: { id: listingId },
            data: { status: "PAUSED" },
          });
          break;

        case "DELETE_LISTINGS":
          await prisma.listing.update({
            where: { id: listingId },
            data: { status: "DELETED", deletedAt: new Date() },
          });
          break;

        case "UPDATE_PRICE":
          if (!args.params?.priceCents) {
            errors.push({ listingId, error: "priceCents required for UPDATE_PRICE" });
            continue;
          }
          await prisma.listing.update({
            where: { id: listingId },
            data: { priceCents: args.params.priceCents },
          });
          break;

        case "UPDATE_QUANTITY":
          if (args.params?.quantity === undefined) {
            errors.push({ listingId, error: "quantity required for UPDATE_QUANTITY" });
            continue;
          }
          await prisma.listing.update({
            where: { id: listingId },
            data: { quantity: args.params.quantity },
          });
          break;

        case "APPLY_PROMOTION":
          if (!args.params?.couponId) {
            errors.push({ listingId, error: "couponId required for APPLY_PROMOTION" });
            continue;
          }
          await prisma.listingPromotion.create({
            data: {
              listingId,
              couponId: args.params.couponId,
              appliedAt: new Date(),
            },
          });
          break;

        case "EXPORT_CSV":
          // Export is handled separately, just mark as success
          break;

        default:
          errors.push({ listingId, error: `Unknown action: ${args.action}` });
          continue;
      }

      successCount++;
    } catch (error) {
      errors.push({
        listingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Audit log
  await emitAuditEvent({
    actorUserId: args.sellerId,
    action: `bulk.${args.action.toLowerCase()}`,
    entityType: "Listing",
    entityId: args.listingIds.join(",").substring(0, 100),
    meta: {
      totalItems: args.listingIds.length,
      successCount,
      failedCount: errors.length,
      params: args.params,
    },
  });

  return {
    success: errors.length === 0,
    action: args.action,
    totalItems: args.listingIds.length,
    successCount,
    failedCount: errors.length,
    errors,
  };
}

/**
 * Export listings to CSV (for EXPORT_CSV action)
 */
export async function exportListingsToCSV(args: {
  sellerId: string;
  listingIds: string[];
}): Promise<string> {
  // Check tier
  const allowed = await canUseFeature(args.sellerId, "bulkListingTools");
  if (!allowed) {
    throw new Error("Bulk tools require BASIC tier or higher");
  }

  const listings = await prisma.listing.findMany({
    where: {
      id: { in: args.listingIds },
      ownerUserId: args.sellerId,
    },
    include: {
      category: { select: { name: true } },
    },
  });

  const headers = ["ID", "Title", "Price", "Quantity", "Status", "Category", "Created"];
  const rows = listings.map((l) => [
    l.id,
    `"${(l.title ?? "").replace(/"/g, '""')}"`,
    (l.priceCents / 100).toFixed(2),
    l.quantity?.toString() ?? "0",
    l.status,
    l.category?.name ?? "",
    l.createdAt.toISOString(),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Get bulk action history for seller
 */
export async function getBulkActionHistory(sellerId: string): Promise<
  Array<{
    action: string;
    timestamp: Date;
    itemCount: number;
    successCount: number;
  }>
> {
  const events = await prisma.auditEvent.findMany({
    where: {
      actorUserId: sellerId,
      action: { startsWith: "bulk." },
    },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  return events.map((e) => ({
    action: e.action.replace("bulk.", ""),
    timestamp: e.timestamp,
    itemCount: (e.metaJson as any)?.totalItems ?? 0,
    successCount: (e.metaJson as any)?.successCount ?? 0,
  }));
}
```

### API Endpoint

Create `app/api/seller/listings/bulk/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { executeBulkListingAction, exportListingsToCSV, BulkAction } from "@/packages/core/bulk/listing-actions";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, listingIds, params } = body;

  if (!action || !listingIds || !Array.isArray(listingIds)) {
    return NextResponse.json({ error: "action and listingIds required" }, { status: 400 });
  }

  try {
    if (action === "EXPORT_CSV") {
      const csv = await exportListingsToCSV({
        sellerId: session.user.id,
        listingIds,
      });
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="listings-${Date.now()}.csv"`,
        },
      });
    }

    const result = await executeBulkListingAction({
      sellerId: session.user.id,
      action: action as BulkAction,
      listingIds,
      params,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === "TierFeatureError") {
      return NextResponse.json(
        { error: error.message, code: "TIER_REQUIRED" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

---

## 21.5) G1 Patch: Tier Selection Components

Create `components/corp/TierSelect.tsx`:

```tsx
// components/corp/TierSelect.tsx
// G1 Patch: eBay-exact tier selection components

import React from "react";

/**
 * eBay-exact tier options
 * Per TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md
 */
const TIER_OPTIONS = [
  { value: "STARTER", label: "Starter ($4.95/mo)", color: "gray", listings: "250/mo" },
  { value: "BASIC", label: "Basic ($21.95/mo)", color: "blue", listings: "1,000/mo" },
  { value: "PRO", label: "Premium ($59.95/mo)", color: "purple", listings: "10,000/mo" },
  { value: "ELITE", label: "Anchor ($299.95/mo)", color: "amber", listings: "25,000/mo" },
  { value: "ENTERPRISE", label: "Enterprise ($2,999.95/mo)", color: "emerald", listings: "100,000/mo" },
];

type TierSelectProps = {
  value: string;
  onChange: (tier: string) => void;
  disabled?: boolean;
};

/**
 * Tier dropdown selector
 */
export function TierSelect({ value, onChange, disabled }: TierSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="border rounded px-3 py-2 w-full"
    >
      {TIER_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Tier badge component
 */
const TIER_COLORS: Record<string, string> = {
  STARTER: "bg-gray-100 text-gray-800 border-gray-200",
  BASIC: "bg-blue-100 text-blue-800 border-blue-200",
  PRO: "bg-purple-100 text-purple-800 border-purple-200",
  ELITE: "bg-amber-100 text-amber-800 border-amber-200",
  ENTERPRISE: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function TierBadge({ tier }: { tier: string }) {
  const colorClasses = TIER_COLORS[tier] || TIER_COLORS.STARTER;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colorClasses}`}>
      {tier}
    </span>
  );
}

/**
 * Tier card for selection UI
 */
export function TierCard({
  tier,
  isSelected,
  onSelect,
}: {
  tier: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const option = TIER_OPTIONS.find((o) => o.value === tier);
  if (!option) return null;

  return (
    <div
      onClick={onSelect}
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <TierBadge tier={tier} />
        {isSelected && (
          <span className="text-blue-500 text-sm font-medium">Selected</span>
        )}
      </div>
      <p className="text-sm text-gray-600">{option.listings}</p>
    </div>
  );
}

/**
 * Export tier options for reuse
 */
export { TIER_OPTIONS };
```

---

# PART C: Unified Platform Settings

This section consolidates all scattered settings into a single unified page at `/corp/settings/platform` with 7 tabs covering 174 configurable settings.

---

## 24) Unified Platform Settings Schema

Add to `prisma/schema.prisma`:

```prisma
// =============================================================================
// PLATFORM SETTINGS - Single source of truth for all configurable values
// =============================================================================

model PlatformSettings {
  id          String   @id @default(cuid())
  category    String   // monetization | commerce | fulfillment | trust | discovery | communications | privacy
  key         String   // Specific settings key within category
  configJson  Json     // The actual configuration values
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  effectiveAt DateTime @default(now())
  expiresAt   DateTime?
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([category, key])
  @@index([category])
  @@index([isActive, effectiveAt])
}

model PlatformSettingsAudit {
  id              String   @id @default(cuid())
  settingsId      String
  category        String
  key             String
  previousJson    Json?
  newJson         Json
  changedBy       String
  changedAt       DateTime @default(now())
  changeReason    String?

  @@index([settingsId])
  @@index([category, key])
  @@index([changedAt])
}
```

Run migration:
```bash
npx prisma migrate dev --name unified_platform_settings
```

---

## 25) Platform Settings Type Definitions

Create `packages/core/settings/platformSettingsTypes.ts`:

```typescript
// =============================================================================
// PLATFORM SETTINGS TYPE DEFINITIONS
// =============================================================================

// -----------------------------------------------------------------------------
// TAB 1: FEES & PRICING (monetization)
// -----------------------------------------------------------------------------

export interface FeeSettings {
  insertionFeeNone: number;
  insertionFeeStarter: number;
  insertionFeeBasic: number;
  insertionFeePremium: number;
  insertionFeeAnchor: number;
  insertionFeeEnterprise: number;
  perOrderFeeCents: number;
  perOrderFeeCentsSmall: number;
  smallOrderThresholdCents: number;
  processingFeeBps: number;
  processingFeeFixedCents: number;
}

export interface TierConfig {
  monthlyCents: number;
  annualCents: number;
  freeListingsMonthly: number;
  finalValueFeeBps: number;
  staffAccountsMax: number;
  storefrontEnabled: boolean;
  promotedListingsEnabled: boolean;
  analyticsLevel: "basic" | "standard" | "advanced" | "enterprise";
}

export interface TierSettings {
  SELLER: TierConfig;
  STARTER: TierConfig;
  BASIC: TierConfig;
  PRO: TierConfig;
  ELITE: TierConfig;
  ENTERPRISE: TierConfig;
}

// -----------------------------------------------------------------------------
// TAB 2: COMMERCE
// -----------------------------------------------------------------------------

export interface CartSettings {
  reservationDurationMinutes: number;
  cartExpiryHours: number;
  maxCartItems: number;
  maxQuantityPerItem: number;
  abandonedCartReminderHours: number;
  abandonedCartSecondReminderHours: number;
}

export interface OrderSettings {
  autoCompleteDaysAfterDelivery: number;
  disputeWindowDays: number;
  defaultReturnWindowDays: number;
  requireSignatureAboveCents: number;
  allowPartialShipments: boolean;
  autoRefundOnCancelBeforeShip: boolean;
}

export interface OfferSettings {
  defaultOfferExpiryHours: number;
  maxCounterOffers: number;
  minOfferPercentOfPrice: number;
  platformOfferFeeEnabled: boolean;
  platformOfferFeeBps: number;
}

export interface CancellationSettings {
  buyerFreeCancelWindowMinutes: number;
  buyerCanRequestCancelBeforeShip: boolean;
  sellerCancelResponseHours: number;
  buyerCancelAbuseWindowDays: number;
  buyerCancelAbuseThreshold: number;
  buyerCancelAbusePenaltyType: "WARNING" | "RESTRICT" | "SUSPEND";
  buyerCancelAbuseCooldownDays: number;
  sellerCancelCountsAsDefect: boolean;
  sellerCancelExemptReasons: string[];
  unpaidOrderCancelHours: number;
}

// -----------------------------------------------------------------------------
// TAB 3: FULFILLMENT
// -----------------------------------------------------------------------------

export interface ShippingSettings {
  defaultHandlingDays: number;
  maxHandlingDays: number;
  lateShipmentGracePeriodHours: number;
  combinedShippingEnabled: boolean;
  freeShippingPromotionEnabled: boolean;
  domesticOnlyDefault: boolean;
  requireTrackingNumber: boolean;
  autoMarkDeliveredDays: number;
}

export interface PayoutSettings {
  minPayoutAmountCents: number;
  payoutSchedule: "daily" | "weekly" | "biweekly" | "monthly";
  payoutDayOfWeek: number;
  newSellerHoldDays: number;
  highRiskHoldEnabled: boolean;
  highRiskThresholdCents: number;
  instantPayoutEnabled: boolean;
  instantPayoutFeeBps: number;
}

// -----------------------------------------------------------------------------
// TAB 4: TRUST & QUALITY
// -----------------------------------------------------------------------------

export interface ReviewSettings {
  reviewEligibleDaysAfterDelivery: number;
  reviewWindowDays: number;
  allowSellerResponse: boolean;
  sellerResponseWindowDays: number;
  reviewModerationEnabled: boolean;
  autoApproveReviewsAboveStars: number;
  reviewEditWindowHours: number;
  minReviewLengthChars: number;
  maxReviewLengthChars: number;
}

export interface SellerStandardsSettings {
  evaluationPeriodDays: number;
  minOrdersForEvaluation: number;
  maxDefectRatePercent: number;
  maxLateShipRatePercent: number;
  maxCasesWithoutResolutionPercent: number;
  topRatedMaxDefectRatePercent: number;
  topRatedMaxLateShipRatePercent: number;
  topRatedMinOrdersPerYear: number;
  belowStandardListingVisibilityReduction: number;
  belowStandardFvfSurchargePercent: number;
  restrictedMaxActiveListings: number;
  defectExpiryDays: number;
}

export interface DisputeSettings {
  sellerEvidenceWindowHours: number;
  buyerResponseWindowHours: number;
  autoEscalateDays: number;
  platformReviewDays: number;
  refundProcessingDays: number;
  chargebackFeeAmountCents: number;
  autoRefundOnSellerNoResponse: boolean;
  returnShippingDefaultPaidBy: "buyer" | "seller" | "platform";
}

// -----------------------------------------------------------------------------
// TAB 5: DISCOVERY
// -----------------------------------------------------------------------------

export interface SearchSettings {
  titleWeight: number;
  descriptionWeight: number;
  categoryWeight: number;
  attributeWeight: number;
  trustScoreEnabled: boolean;
  trustMultiplierWeight: number;
  freshnessBoostEnabled: boolean;
  freshnessBoostDays: number;
  freshnessMaxBoost: number;
  defaultPageSize: number;
  maxPageSize: number;
  personalizationEnabled: boolean;
  recentViewsBoostEnabled: boolean;
}

export interface PromotionSettings {
  promotedListingsEnabled: boolean;
  minAdRatePercent: number;
  maxAdRatePercent: number;
  defaultAdRatePercent: number;
  promotedSlotsPerPage: number;
  promotedSlotPositions: number[];
  secondPriceAuctionEnabled: boolean;
  minDailyBudgetCents: number;
  platformPromotionTakeRateBps: number;
}

// -----------------------------------------------------------------------------
// TAB 6: COMMUNICATIONS
// -----------------------------------------------------------------------------

export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  digestEnabled: boolean;
  digestFrequency: "daily" | "weekly";
  digestTimeUtc: string;
  maxEmailsPerDayPerUser: number;
  maxPushPerDayPerUser: number;
  maxSmsPerDayPerUser: number;
  marketingEmailsEnabled: boolean;
  marketingOptInRequired: boolean;
}

// -----------------------------------------------------------------------------
// TAB 7: PRIVACY
// -----------------------------------------------------------------------------

export interface RetentionSettings {
  messageRetentionDays: number;
  searchLogRetentionDays: number;
  webhookLogRetentionDays: number;
  analyticsEventRetentionDays: number;
  notificationLogRetentionDays: number;
  auditLogRetentionDays: number;
  dataExportEnabled: boolean;
  dataExportFormatOptions: string[];
  accountDeletionGracePeriodDays: number;
  anonymizeOnDeletion: boolean;
}

// -----------------------------------------------------------------------------
// AGGREGATE TYPE
// -----------------------------------------------------------------------------

export interface PlatformSettingsConfig {
  monetization: {
    fees: FeeSettings;
    tiers: TierSettings;
  };
  commerce: {
    cart: CartSettings;
    orders: OrderSettings;
    offers: OfferSettings;
    cancellation: CancellationSettings;
  };
  fulfillment: {
    shipping: ShippingSettings;
    payouts: PayoutSettings;
  };
  trust: {
    reviews: ReviewSettings;
    sellerStandards: SellerStandardsSettings;
    disputes: DisputeSettings;
  };
  discovery: {
    search: SearchSettings;
    promotions: PromotionSettings;
  };
  communications: {
    notifications: NotificationSettings;
  };
  privacy: {
    retention: RetentionSettings;
  };
}

// Tab configuration
export const PLATFORM_SETTINGS_TABS = [
  { key: "monetization", label: "Fees & Pricing", icon: "DollarSign" },
  { key: "commerce", label: "Commerce", icon: "ShoppingCart" },
  { key: "fulfillment", label: "Fulfillment", icon: "Package" },
  { key: "trust", label: "Trust & Quality", icon: "Star" },
  { key: "discovery", label: "Discovery", icon: "Search" },
  { key: "communications", label: "Communications", icon: "Bell" },
  { key: "privacy", label: "Privacy", icon: "Lock" },
] as const;

export type PlatformSettingsTab = typeof PLATFORM_SETTINGS_TABS[number]["key"];

export const TIER_NAMES = ["SELLER", "STARTER", "BASIC", "PRO", "ELITE", "ENTERPRISE"] as const;
export type TierName = typeof TIER_NAMES[number];
```

---

## 26) Platform Settings Default Values

Create `packages/core/settings/platformSettingsDefaults.ts`:

```typescript
import type { PlatformSettingsConfig } from "./platformSettingsTypes";

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsConfig = {
  monetization: {
    fees: {
      insertionFeeNone: 35,
      insertionFeeStarter: 30,
      insertionFeeBasic: 25,
      insertionFeePremium: 15,
      insertionFeeAnchor: 5,
      insertionFeeEnterprise: 5,
      perOrderFeeCents: 40,
      perOrderFeeCentsSmall: 30,
      smallOrderThresholdCents: 1000,
      processingFeeBps: 290,
      processingFeeFixedCents: 30,
    },
    tiers: {
      SELLER: {
        monthlyCents: 0,
        annualCents: 0,
        freeListingsMonthly: 250,
        finalValueFeeBps: 1325,
        staffAccountsMax: 0,
        storefrontEnabled: false,
        promotedListingsEnabled: true,
        analyticsLevel: "basic",
      },
      STARTER: {
        monthlyCents: 495,
        annualCents: 4740,
        freeListingsMonthly: 250,
        finalValueFeeBps: 1235,
        staffAccountsMax: 1,
        storefrontEnabled: true,
        promotedListingsEnabled: true,
        analyticsLevel: "standard",
      },
      BASIC: {
        monthlyCents: 2195,
        annualCents: 21060,
        freeListingsMonthly: 1000,
        finalValueFeeBps: 1150,
        staffAccountsMax: 5,
        storefrontEnabled: true,
        promotedListingsEnabled: true,
        analyticsLevel: "standard",
      },
      PRO: {
        monthlyCents: 5995,
        annualCents: 57550,
        freeListingsMonthly: 10000,
        finalValueFeeBps: 1025,
        staffAccountsMax: 15,
        storefrontEnabled: true,
        promotedListingsEnabled: true,
        analyticsLevel: "advanced",
      },
      ELITE: {
        monthlyCents: 29995,
        annualCents: 287950,
        freeListingsMonthly: 25000,
        finalValueFeeBps: 915,
        staffAccountsMax: 50,
        storefrontEnabled: true,
        promotedListingsEnabled: true,
        analyticsLevel: "advanced",
      },
      ENTERPRISE: {
        monthlyCents: 299995,
        annualCents: 2879950,
        freeListingsMonthly: 100000,
        finalValueFeeBps: 800,
        staffAccountsMax: 100,
        storefrontEnabled: true,
        promotedListingsEnabled: true,
        analyticsLevel: "enterprise",
      },
    },
  },
  commerce: {
    cart: {
      reservationDurationMinutes: 15,
      cartExpiryHours: 24,
      maxCartItems: 50,
      maxQuantityPerItem: 10,
      abandonedCartReminderHours: 4,
      abandonedCartSecondReminderHours: 24,
    },
    orders: {
      autoCompleteDaysAfterDelivery: 3,
      disputeWindowDays: 30,
      defaultReturnWindowDays: 30,
      requireSignatureAboveCents: 75000,
      allowPartialShipments: false,
      autoRefundOnCancelBeforeShip: true,
    },
    offers: {
      defaultOfferExpiryHours: 48,
      maxCounterOffers: 5,
      minOfferPercentOfPrice: 0,
      platformOfferFeeEnabled: false,
      platformOfferFeeBps: 0,
    },
    cancellation: {
      buyerFreeCancelWindowMinutes: 5,
      buyerCanRequestCancelBeforeShip: true,
      sellerCancelResponseHours: 48,
      buyerCancelAbuseWindowDays: 30,
      buyerCancelAbuseThreshold: 5,
      buyerCancelAbusePenaltyType: "WARNING",
      buyerCancelAbuseCooldownDays: 7,
      sellerCancelCountsAsDefect: true,
      sellerCancelExemptReasons: ["BUYER_REQUESTED", "SUSPECTED_FRAUD"],
      unpaidOrderCancelHours: 48,
    },
  },
  fulfillment: {
    shipping: {
      defaultHandlingDays: 3,
      maxHandlingDays: 30,
      lateShipmentGracePeriodHours: 24,
      combinedShippingEnabled: true,
      freeShippingPromotionEnabled: true,
      domesticOnlyDefault: true,
      requireTrackingNumber: true,
      autoMarkDeliveredDays: 0,
    },
    payouts: {
      minPayoutAmountCents: 100,
      payoutSchedule: "daily",
      payoutDayOfWeek: 1,
      newSellerHoldDays: 7,
      highRiskHoldEnabled: true,
      highRiskThresholdCents: 100000,
      instantPayoutEnabled: false,
      instantPayoutFeeBps: 100,
    },
  },
  trust: {
    reviews: {
      reviewEligibleDaysAfterDelivery: 3,
      reviewWindowDays: 60,
      allowSellerResponse: true,
      sellerResponseWindowDays: 30,
      reviewModerationEnabled: true,
      autoApproveReviewsAboveStars: 0,
      reviewEditWindowHours: 24,
      minReviewLengthChars: 0,
      maxReviewLengthChars: 5000,
    },
    sellerStandards: {
      evaluationPeriodDays: 90,
      minOrdersForEvaluation: 10,
      maxDefectRatePercent: 2.0,
      maxLateShipRatePercent: 4.0,
      maxCasesWithoutResolutionPercent: 0.3,
      topRatedMaxDefectRatePercent: 0.5,
      topRatedMaxLateShipRatePercent: 1.0,
      topRatedMinOrdersPerYear: 100,
      belowStandardListingVisibilityReduction: 50,
      belowStandardFvfSurchargePercent: 5,
      restrictedMaxActiveListings: 10,
      defectExpiryDays: 365,
    },
    disputes: {
      sellerEvidenceWindowHours: 72,
      buyerResponseWindowHours: 72,
      autoEscalateDays: 7,
      platformReviewDays: 5,
      refundProcessingDays: 5,
      chargebackFeeAmountCents: 2000,
      autoRefundOnSellerNoResponse: true,
      returnShippingDefaultPaidBy: "seller",
    },
  },
  discovery: {
    search: {
      titleWeight: 3.0,
      descriptionWeight: 1.0,
      categoryWeight: 2.0,
      attributeWeight: 1.5,
      trustScoreEnabled: true,
      trustMultiplierWeight: 0.3,
      freshnessBoostEnabled: true,
      freshnessBoostDays: 7,
      freshnessMaxBoost: 1.2,
      defaultPageSize: 48,
      maxPageSize: 100,
      personalizationEnabled: true,
      recentViewsBoostEnabled: true,
    },
    promotions: {
      promotedListingsEnabled: true,
      minAdRatePercent: 2,
      maxAdRatePercent: 15,
      defaultAdRatePercent: 5,
      promotedSlotsPerPage: 4,
      promotedSlotPositions: [1, 5, 9, 13],
      secondPriceAuctionEnabled: true,
      minDailyBudgetCents: 100,
      platformPromotionTakeRateBps: 0,
    },
  },
  communications: {
    notifications: {
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      digestEnabled: true,
      digestFrequency: "daily",
      digestTimeUtc: "09:00",
      maxEmailsPerDayPerUser: 50,
      maxPushPerDayPerUser: 20,
      maxSmsPerDayPerUser: 5,
      marketingEmailsEnabled: true,
      marketingOptInRequired: true,
    },
  },
  privacy: {
    retention: {
      messageRetentionDays: 730,
      searchLogRetentionDays: 90,
      webhookLogRetentionDays: 90,
      analyticsEventRetentionDays: 365,
      notificationLogRetentionDays: 180,
      auditLogRetentionDays: 2555,
      dataExportEnabled: true,
      dataExportFormatOptions: ["json", "csv"],
      accountDeletionGracePeriodDays: 30,
      anonymizeOnDeletion: true,
    },
  },
};
```

---

## 27) Platform Settings Service

Create `packages/core/settings/platformSettingsService.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { PlatformSettingsTab, PlatformSettingsConfig } from "./platformSettingsTypes";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettingsDefaults";

const prisma = new PrismaClient();

/**
 * Get ALL platform settings (merged with defaults)
 */
export async function getAllPlatformSettings(): Promise<PlatformSettingsConfig> {
  const result = structuredClone(DEFAULT_PLATFORM_SETTINGS);

  const allSettings = await prisma.platformSettings.findMany({
    where: {
      isActive: true,
      effectiveAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { effectiveAt: "desc" },
  });

  for (const setting of allSettings) {
    const cat = setting.category as PlatformSettingsTab;
    if (result[cat] && typeof result[cat] === "object") {
      (result[cat] as Record<string, unknown>)[setting.key] = setting.configJson;
    }
  }

  return result;
}

/**
 * Get a specific settings key within a category
 */
export async function getSettings<T>(category: PlatformSettingsTab, key: string): Promise<T> {
  const settings = await prisma.platformSettings.findFirst({
    where: {
      category,
      key,
      isActive: true,
      effectiveAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { effectiveAt: "desc" },
  });

  if (settings) {
    return settings.configJson as T;
  }

  const categoryDefaults = DEFAULT_PLATFORM_SETTINGS[category] as Record<string, unknown>;
  return categoryDefaults[key] as T;
}

/**
 * Update all settings for a category at once
 */
export async function updateCategorySettings(args: {
  category: PlatformSettingsTab;
  settings: Record<string, unknown>;
  updatedBy: string;
  reason?: string;
}): Promise<void> {
  const { category, settings, updatedBy, reason } = args;

  await prisma.$transaction(async (tx) => {
    for (const [key, config] of Object.entries(settings)) {
      const existing = await tx.platformSettings.findUnique({
        where: { category_key: { category, key } },
      });

      // Audit trail
      await tx.platformSettingsAudit.create({
        data: {
          settingsId: existing?.id ?? "new",
          category,
          key,
          previousJson: existing?.configJson ?? null,
          newJson: config as any,
          changedBy: updatedBy,
          changeReason: reason,
        },
      });

      // Upsert
      await tx.platformSettings.upsert({
        where: { category_key: { category, key } },
        create: { category, key, configJson: config as any, createdBy: updatedBy, updatedBy },
        update: { configJson: config as any, updatedBy, version: { increment: 1 } },
      });
    }
  });
}

/**
 * Reset a category to default values
 */
export async function resetCategoryToDefaults(category: PlatformSettingsTab, resetBy: string): Promise<void> {
  const categoryDefaults = DEFAULT_PLATFORM_SETTINGS[category] as Record<string, unknown>;
  await updateCategorySettings({
    category,
    settings: categoryDefaults,
    updatedBy: resetBy,
    reason: "Reset to defaults",
  });
}

/**
 * Get audit history for a category
 */
export async function getSettingsAuditHistory(category: PlatformSettingsTab, limit = 50) {
  return prisma.platformSettingsAudit.findMany({
    where: { category },
    orderBy: { changedAt: "desc" },
    take: limit,
  });
}
```

---

## 28) Platform Settings API Route

Create `apps/web/app/api/corp/settings/platform/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/packages/core/rbac/permissions";
import {
  getAllPlatformSettings,
  updateCategorySettings,
  resetCategoryToDefaults,
  getSettingsAuditHistory,
} from "@/packages/core/settings/platformSettingsService";
import type { PlatformSettingsTab } from "@/packages/core/settings/platformSettingsTypes";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RBAC: Require PlatformRole.ADMIN for platform settings access
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "audit") {
    const category = searchParams.get("category") as PlatformSettingsTab;
    if (!category) {
      return NextResponse.json({ error: "Category required" }, { status: 400 });
    }
    const history = await getSettingsAuditHistory(category);
    return NextResponse.json({ history });
  }

  const settings = await getAllPlatformSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RBAC: Require PlatformRole.ADMIN for platform settings write
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { category, settings, reason } = body as {
    category: PlatformSettingsTab;
    settings: Record<string, unknown>;
    reason?: string;
  };

  if (!category || !settings) {
    return NextResponse.json({ error: "Category and settings required" }, { status: 400 });
  }

  await updateCategorySettings({
    category,
    settings,
    updatedBy: session.user.id,
    reason: reason || "Updated via admin UI",
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RBAC: Require PlatformRole.ADMIN for platform settings write
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as PlatformSettingsTab;

  if (!category) {
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }

  await resetCategoryToDefaults(category, session.user.id);
  return NextResponse.json({ success: true });
}
```

---

## 29) Unified Platform Settings UI Page

Create `apps/web/app/(platform)/corp/settings/platform/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  DollarSign, ShoppingCart, Package, Star, Search, Bell, Lock,
  Save, RotateCcw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { PlatformSettingsConfig, PlatformSettingsTab } from "@/packages/core/settings/platformSettingsTypes";
import { PLATFORM_SETTINGS_TABS, TIER_NAMES } from "@/packages/core/settings/platformSettingsTypes";

// =============================================================================
// TAB ICONS
// =============================================================================

const TAB_ICONS: Record<string, React.ReactNode> = {
  monetization: <DollarSign className="h-4 w-4" />,
  commerce: <ShoppingCart className="h-4 w-4" />,
  fulfillment: <Package className="h-4 w-4" />,
  trust: <Star className="h-4 w-4" />,
  discovery: <Search className="h-4 w-4" />,
  communications: <Bell className="h-4 w-4" />,
  privacy: <Lock className="h-4 w-4" />,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PlatformSettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as PlatformSettingsTab) || "monetization";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<PlatformSettingsTab>(initialTab);
  const [settings, setSettings] = useState<PlatformSettingsConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/corp/settings/platform");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSettings(data.settings);
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/corp/settings/platform", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeTab,
          settings: settings[activeTab],
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Settings saved");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    setSaving(true);
    try {
      const res = await fetch(`/api/corp/settings/platform?category=${activeTab}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset");
      await fetchSettings();
      toast.success("Reset to defaults");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to reset");
    } finally {
      setSaving(false);
      setShowResetDialog(false);
    }
  }

  // Generic updater
  function update(category: PlatformSettingsTab, section: string, key: string, value: any) {
    if (!settings) return;
    setSettings((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      (next[category] as any)[section][key] = value;
      return next;
    });
    setHasChanges(true);
  }

  // Tier updater
  function updateTier(tier: string, key: string, value: any) {
    if (!settings) return;
    setSettings((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      (next.monetization.tiers as any)[tier][key] = value;
      return next;
    });
    setHasChanges(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6 text-center text-muted-foreground">Failed to load settings</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">All platform configuration in one place - 174 settings across 7 tabs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowResetDialog(true)} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Tab
          </Button>
          <Button onClick={saveSettings} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-100">Unsaved</Badge>
          <span className="text-sm text-amber-800">You have unsaved changes</span>
        </div>
      )}

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PlatformSettingsTab)}>
        <TabsList className="grid grid-cols-7 w-full mb-6 h-auto">
          {PLATFORM_SETTINGS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-2 py-3">
              {TAB_ICONS[tab.key]}
              <span className="hidden lg:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: FEES & PRICING */}
        {/* ============================================================== */}
        <TabsContent value="monetization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fee Schedule</CardTitle>
              <CardDescription>Insertion and per-order fees by tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium">Insertion Fees (per listing over free limit)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-3">
                  {["None", "Starter", "Basic", "Premium", "Anchor", "Enterprise"].map((tier) => (
                    <div key={tier}>
                      <Label className="text-sm text-muted-foreground">{tier}</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          className="pl-7"
                          value={((settings.monetization.fees as any)[`insertionFee${tier}`] / 100).toFixed(2)}
                          onChange={(e) => update("monetization", "fees", `insertionFee${tier}`, Math.round(parseFloat(e.target.value || "0") * 100))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-base font-medium">Per-Order Fees</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Standard</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number" step="0.01" className="pl-7"
                        value={(settings.monetization.fees.perOrderFeeCents / 100).toFixed(2)}
                        onChange={(e) => update("monetization", "fees", "perOrderFeeCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Small Orders</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number" step="0.01" className="pl-7"
                        value={(settings.monetization.fees.perOrderFeeCentsSmall / 100).toFixed(2)}
                        onChange={(e) => update("monetization", "fees", "perOrderFeeCentsSmall", Math.round(parseFloat(e.target.value || "0") * 100))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Small Order Threshold</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number" step="0.01" className="pl-7"
                        value={(settings.monetization.fees.smallOrderThresholdCents / 100).toFixed(2)}
                        onChange={(e) => update("monetization", "fees", "smallOrderThresholdCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tier Pricing</CardTitle>
              <CardDescription>Subscription tiers and benefits (eBay-exact tiers)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 font-medium">Tier</th>
                      <th className="text-left py-3 font-medium">Monthly</th>
                      <th className="text-left py-3 font-medium">Annual</th>
                      <th className="text-left py-3 font-medium">Free Listings</th>
                      <th className="text-left py-3 font-medium">FVF Rate</th>
                      <th className="text-left py-3 font-medium">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIER_NAMES.map((tier) => (
                      <tr key={tier} className="border-b">
                        <td className="py-3 font-medium">{tier}</td>
                        <td className="py-3">
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <Input type="number" step="0.01" className="pl-5 h-8 text-sm"
                              value={(settings.monetization.tiers[tier].monthlyCents / 100).toFixed(2)}
                              onChange={(e) => updateTier(tier, "monthlyCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                            />
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="relative w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <Input type="number" step="0.01" className="pl-5 h-8 text-sm"
                              value={(settings.monetization.tiers[tier].annualCents / 100).toFixed(2)}
                              onChange={(e) => updateTier(tier, "annualCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                            />
                          </div>
                        </td>
                        <td className="py-3">
                          <Input type="number" className="w-24 h-8 text-sm"
                            value={settings.monetization.tiers[tier].freeListingsMonthly}
                            onChange={(e) => updateTier(tier, "freeListingsMonthly", parseInt(e.target.value || "0"))}
                          />
                        </td>
                        <td className="py-3">
                          <div className="relative w-20">
                            <Input type="number" step="0.01" className="pr-5 h-8 text-sm"
                              value={(settings.monetization.tiers[tier].finalValueFeeBps / 100).toFixed(2)}
                              onChange={(e) => updateTier(tier, "finalValueFeeBps", Math.round(parseFloat(e.target.value || "0") * 100))}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <Input type="number" className="w-16 h-8 text-sm"
                            value={settings.monetization.tiers[tier].staffAccountsMax}
                            onChange={(e) => updateTier(tier, "staffAccountsMax", parseInt(e.target.value || "0"))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: COMMERCE */}
        {/* ============================================================== */}
        <TabsContent value="commerce" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Cart Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Reservation Duration (min)</Label><Input type="number" value={settings.commerce.cart.reservationDurationMinutes} onChange={(e) => update("commerce", "cart", "reservationDurationMinutes", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Cart Expiry (hours)</Label><Input type="number" value={settings.commerce.cart.cartExpiryHours} onChange={(e) => update("commerce", "cart", "cartExpiryHours", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Max Cart Items</Label><Input type="number" value={settings.commerce.cart.maxCartItems} onChange={(e) => update("commerce", "cart", "maxCartItems", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Max Qty Per Item</Label><Input type="number" value={settings.commerce.cart.maxQuantityPerItem} onChange={(e) => update("commerce", "cart", "maxQuantityPerItem", parseInt(e.target.value || "0"))} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Order Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Auto-Complete After Delivery (days)</Label><Input type="number" value={settings.commerce.orders.autoCompleteDaysAfterDelivery} onChange={(e) => update("commerce", "orders", "autoCompleteDaysAfterDelivery", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Dispute Window (days)</Label><Input type="number" value={settings.commerce.orders.disputeWindowDays} onChange={(e) => update("commerce", "orders", "disputeWindowDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Return Window (days)</Label><Input type="number" value={settings.commerce.orders.defaultReturnWindowDays} onChange={(e) => update("commerce", "orders", "defaultReturnWindowDays", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.commerce.orders.allowPartialShipments} onCheckedChange={(v) => update("commerce", "orders", "allowPartialShipments", v)} /><Label>Allow Partial Shipments</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.commerce.orders.autoRefundOnCancelBeforeShip} onCheckedChange={(v) => update("commerce", "orders", "autoRefundOnCancelBeforeShip", v)} /><Label>Auto-Refund on Cancel</Label></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Offer Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Offer Expiry (hours)</Label><Input type="number" value={settings.commerce.offers.defaultOfferExpiryHours} onChange={(e) => update("commerce", "offers", "defaultOfferExpiryHours", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Max Counter Offers</Label><Input type="number" value={settings.commerce.offers.maxCounterOffers} onChange={(e) => update("commerce", "offers", "maxCounterOffers", parseInt(e.target.value || "0"))} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cancellation Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Free Cancel Window (min)</Label><Input type="number" value={settings.commerce.cancellation.buyerFreeCancelWindowMinutes} onChange={(e) => update("commerce", "cancellation", "buyerFreeCancelWindowMinutes", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Unpaid Order Cancel (hours)</Label><Input type="number" value={settings.commerce.cancellation.unpaidOrderCancelHours} onChange={(e) => update("commerce", "cancellation", "unpaidOrderCancelHours", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Abuse Threshold</Label><Input type="number" value={settings.commerce.cancellation.buyerCancelAbuseThreshold} onChange={(e) => update("commerce", "cancellation", "buyerCancelAbuseThreshold", parseInt(e.target.value || "0"))} /></div>
                <div>
                  <Label>Abuse Penalty</Label>
                  <Select value={settings.commerce.cancellation.buyerCancelAbusePenaltyType} onValueChange={(v) => update("commerce", "cancellation", "buyerCancelAbusePenaltyType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="RESTRICT">Restrict</SelectItem>
                      <SelectItem value="SUSPEND">Suspend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.commerce.cancellation.sellerCancelCountsAsDefect} onCheckedChange={(v) => update("commerce", "cancellation", "sellerCancelCountsAsDefect", v)} /><Label>Seller Cancel = Defect</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: FULFILLMENT */}
        {/* ============================================================== */}
        <TabsContent value="fulfillment" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Shipping Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Default Handling (days)</Label><Input type="number" value={settings.fulfillment.shipping.defaultHandlingDays} onChange={(e) => update("fulfillment", "shipping", "defaultHandlingDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Max Handling (days)</Label><Input type="number" value={settings.fulfillment.shipping.maxHandlingDays} onChange={(e) => update("fulfillment", "shipping", "maxHandlingDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Late Ship Grace (hours)</Label><Input type="number" value={settings.fulfillment.shipping.lateShipmentGracePeriodHours} onChange={(e) => update("fulfillment", "shipping", "lateShipmentGracePeriodHours", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.fulfillment.shipping.combinedShippingEnabled} onCheckedChange={(v) => update("fulfillment", "shipping", "combinedShippingEnabled", v)} /><Label>Combined Shipping</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.fulfillment.shipping.requireTrackingNumber} onCheckedChange={(v) => update("fulfillment", "shipping", "requireTrackingNumber", v)} /><Label>Require Tracking</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.fulfillment.shipping.domesticOnlyDefault} onCheckedChange={(v) => update("fulfillment", "shipping", "domesticOnlyDefault", v)} /><Label>Domestic Only Default</Label></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payout Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Min Payout ($)</Label><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span><Input type="number" step="0.01" className="pl-7" value={(settings.fulfillment.payouts.minPayoutAmountCents / 100).toFixed(2)} onChange={(e) => update("fulfillment", "payouts", "minPayoutAmountCents", Math.round(parseFloat(e.target.value || "0") * 100))} /></div></div>
                <div>
                  <Label>Payout Schedule</Label>
                  <Select value={settings.fulfillment.payouts.payoutSchedule} onValueChange={(v) => update("fulfillment", "payouts", "payoutSchedule", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>New Seller Hold (days)</Label><Input type="number" value={settings.fulfillment.payouts.newSellerHoldDays} onChange={(e) => update("fulfillment", "payouts", "newSellerHoldDays", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.fulfillment.payouts.highRiskHoldEnabled} onCheckedChange={(v) => update("fulfillment", "payouts", "highRiskHoldEnabled", v)} /><Label>High Risk Hold</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.fulfillment.payouts.instantPayoutEnabled} onCheckedChange={(v) => update("fulfillment", "payouts", "instantPayoutEnabled", v)} /><Label>Instant Payout</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: TRUST & QUALITY */}
        {/* ============================================================== */}
        <TabsContent value="trust" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Review Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Eligible After Delivery (days)</Label><Input type="number" value={settings.trust.reviews.reviewEligibleDaysAfterDelivery} onChange={(e) => update("trust", "reviews", "reviewEligibleDaysAfterDelivery", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Review Window (days)</Label><Input type="number" value={settings.trust.reviews.reviewWindowDays} onChange={(e) => update("trust", "reviews", "reviewWindowDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Seller Response Window (days)</Label><Input type="number" value={settings.trust.reviews.sellerResponseWindowDays} onChange={(e) => update("trust", "reviews", "sellerResponseWindowDays", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.trust.reviews.allowSellerResponse} onCheckedChange={(v) => update("trust", "reviews", "allowSellerResponse", v)} /><Label>Allow Seller Response</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.trust.reviews.reviewModerationEnabled} onCheckedChange={(v) => update("trust", "reviews", "reviewModerationEnabled", v)} /><Label>Moderation Enabled</Label></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Seller Standards</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Evaluation Period (days)</Label><Input type="number" value={settings.trust.sellerStandards.evaluationPeriodDays} onChange={(e) => update("trust", "sellerStandards", "evaluationPeriodDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Min Orders for Eval</Label><Input type="number" value={settings.trust.sellerStandards.minOrdersForEvaluation} onChange={(e) => update("trust", "sellerStandards", "minOrdersForEvaluation", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Max Defect Rate %</Label><Input type="number" step="0.1" value={settings.trust.sellerStandards.maxDefectRatePercent} onChange={(e) => update("trust", "sellerStandards", "maxDefectRatePercent", parseFloat(e.target.value || "0"))} /></div>
                <div><Label>Max Late Ship Rate %</Label><Input type="number" step="0.1" value={settings.trust.sellerStandards.maxLateShipRatePercent} onChange={(e) => update("trust", "sellerStandards", "maxLateShipRatePercent", parseFloat(e.target.value || "0"))} /></div>
                <div><Label>Top Rated Min Orders/Year</Label><Input type="number" value={settings.trust.sellerStandards.topRatedMinOrdersPerYear} onChange={(e) => update("trust", "sellerStandards", "topRatedMinOrdersPerYear", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Defect Expiry (days)</Label><Input type="number" value={settings.trust.sellerStandards.defectExpiryDays} onChange={(e) => update("trust", "sellerStandards", "defectExpiryDays", parseInt(e.target.value || "0"))} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dispute Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Seller Evidence Window (hours)</Label><Input type="number" value={settings.trust.disputes.sellerEvidenceWindowHours} onChange={(e) => update("trust", "disputes", "sellerEvidenceWindowHours", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Auto-Escalate (days)</Label><Input type="number" value={settings.trust.disputes.autoEscalateDays} onChange={(e) => update("trust", "disputes", "autoEscalateDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Chargeback Fee ($)</Label><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span><Input type="number" step="0.01" className="pl-7" value={(settings.trust.disputes.chargebackFeeAmountCents / 100).toFixed(2)} onChange={(e) => update("trust", "disputes", "chargebackFeeAmountCents", Math.round(parseFloat(e.target.value || "0") * 100))} /></div></div>
                <div>
                  <Label>Return Shipping Paid By</Label>
                  <Select value={settings.trust.disputes.returnShippingDefaultPaidBy} onValueChange={(v) => update("trust", "disputes", "returnShippingDefaultPaidBy", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="seller">Seller</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.trust.disputes.autoRefundOnSellerNoResponse} onCheckedChange={(v) => update("trust", "disputes", "autoRefundOnSellerNoResponse", v)} /><Label>Auto-Refund if No Response</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 5: DISCOVERY */}
        {/* ============================================================== */}
        <TabsContent value="discovery" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Search Ranking</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Title Weight</Label><Input type="number" step="0.1" value={settings.discovery.search.titleWeight} onChange={(e) => update("discovery", "search", "titleWeight", parseFloat(e.target.value || "0"))} /></div>
                <div><Label>Description Weight</Label><Input type="number" step="0.1" value={settings.discovery.search.descriptionWeight} onChange={(e) => update("discovery", "search", "descriptionWeight", parseFloat(e.target.value || "0"))} /></div>
                <div><Label>Category Weight</Label><Input type="number" step="0.1" value={settings.discovery.search.categoryWeight} onChange={(e) => update("discovery", "search", "categoryWeight", parseFloat(e.target.value || "0"))} /></div>
                <div><Label>Trust Multiplier</Label><Input type="number" step="0.1" value={settings.discovery.search.trustMultiplierWeight} onChange={(e) => update("discovery", "search", "trustMultiplierWeight", parseFloat(e.target.value || "0"))} /></div>
                <div><Label>Default Page Size</Label><Input type="number" value={settings.discovery.search.defaultPageSize} onChange={(e) => update("discovery", "search", "defaultPageSize", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.discovery.search.freshnessBoostEnabled} onCheckedChange={(v) => update("discovery", "search", "freshnessBoostEnabled", v)} /><Label>Freshness Boost</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.discovery.search.personalizationEnabled} onCheckedChange={(v) => update("discovery", "search", "personalizationEnabled", v)} /><Label>Personalization</Label></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Promoted Listings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Min Ad Rate %</Label><Input type="number" value={settings.discovery.promotions.minAdRatePercent} onChange={(e) => update("discovery", "promotions", "minAdRatePercent", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Max Ad Rate %</Label><Input type="number" value={settings.discovery.promotions.maxAdRatePercent} onChange={(e) => update("discovery", "promotions", "maxAdRatePercent", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Default Ad Rate %</Label><Input type="number" value={settings.discovery.promotions.defaultAdRatePercent} onChange={(e) => update("discovery", "promotions", "defaultAdRatePercent", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Slots Per Page</Label><Input type="number" value={settings.discovery.promotions.promotedSlotsPerPage} onChange={(e) => update("discovery", "promotions", "promotedSlotsPerPage", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.discovery.promotions.promotedListingsEnabled} onCheckedChange={(v) => update("discovery", "promotions", "promotedListingsEnabled", v)} /><Label>Enabled</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.discovery.promotions.secondPriceAuctionEnabled} onCheckedChange={(v) => update("discovery", "promotions", "secondPriceAuctionEnabled", v)} /><Label>Second-Price Auction</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 6: COMMUNICATIONS */}
        {/* ============================================================== */}
        <TabsContent value="communications" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Notification Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3"><Switch checked={settings.communications.notifications.emailEnabled} onCheckedChange={(v) => update("communications", "notifications", "emailEnabled", v)} /><Label>Email Enabled</Label></div>
                <div className="flex items-center gap-3"><Switch checked={settings.communications.notifications.pushEnabled} onCheckedChange={(v) => update("communications", "notifications", "pushEnabled", v)} /><Label>Push Enabled</Label></div>
                <div className="flex items-center gap-3"><Switch checked={settings.communications.notifications.smsEnabled} onCheckedChange={(v) => update("communications", "notifications", "smsEnabled", v)} /><Label>SMS Enabled</Label></div>
                <div><Label>Max Emails/Day/User</Label><Input type="number" value={settings.communications.notifications.maxEmailsPerDayPerUser} onChange={(e) => update("communications", "notifications", "maxEmailsPerDayPerUser", parseInt(e.target.value || "0"))} /></div>
                <div>
                  <Label>Digest Frequency</Label>
                  <Select value={settings.communications.notifications.digestFrequency} onValueChange={(v) => update("communications", "notifications", "digestFrequency", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3"><Switch checked={settings.communications.notifications.marketingOptInRequired} onCheckedChange={(v) => update("communications", "notifications", "marketingOptInRequired", v)} /><Label>Marketing Opt-In Required</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 7: PRIVACY */}
        {/* ============================================================== */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Data Retention</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Message Retention (days)</Label><Input type="number" value={settings.privacy.retention.messageRetentionDays} onChange={(e) => update("privacy", "retention", "messageRetentionDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Search Log Retention (days)</Label><Input type="number" value={settings.privacy.retention.searchLogRetentionDays} onChange={(e) => update("privacy", "retention", "searchLogRetentionDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Analytics Retention (days)</Label><Input type="number" value={settings.privacy.retention.analyticsEventRetentionDays} onChange={(e) => update("privacy", "retention", "analyticsEventRetentionDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Audit Log Retention (days)</Label><Input type="number" value={settings.privacy.retention.auditLogRetentionDays} onChange={(e) => update("privacy", "retention", "auditLogRetentionDays", parseInt(e.target.value || "0"))} /></div>
                <div><Label>Deletion Grace Period (days)</Label><Input type="number" value={settings.privacy.retention.accountDeletionGracePeriodDays} onChange={(e) => update("privacy", "retention", "accountDeletionGracePeriodDays", parseInt(e.target.value || "0"))} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.privacy.retention.dataExportEnabled} onCheckedChange={(v) => update("privacy", "retention", "dataExportEnabled", v)} /><Label>Data Export Enabled</Label></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={settings.privacy.retention.anonymizeOnDeletion} onCheckedChange={(v) => update("privacy", "retention", "anonymizeOnDeletion", v)} /><Label>Anonymize on Deletion</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all {PLATFORM_SETTINGS_TABS.find(t => t.key === activeTab)?.label} settings to defaults.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefaults}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

---

## 30) URL Redirects (Middleware)

Add to `apps/web/middleware.ts`:

```typescript
const SETTINGS_REDIRECTS: Record<string, string> = {
  "/corp/settings/monetization": "/corp/settings/platform?tab=monetization",
  "/corp/settings/monetization/fee-schedules": "/corp/settings/platform?tab=monetization",
  "/corp/settings/tiers": "/corp/settings/platform?tab=monetization",
  "/corp/settings/orders": "/corp/settings/platform?tab=commerce",
  "/corp/settings/cart": "/corp/settings/platform?tab=commerce",
  "/corp/settings/offers": "/corp/settings/platform?tab=commerce",
  "/corp/settings/shipping": "/corp/settings/platform?tab=fulfillment",
  "/corp/settings/payouts": "/corp/settings/platform?tab=fulfillment",
  "/corp/settings/trust": "/corp/settings/platform?tab=trust",
  "/corp/settings/reviews": "/corp/settings/platform?tab=trust",
  "/corp/settings/seller-standards": "/corp/settings/platform?tab=trust",
  "/corp/settings/disputes": "/corp/settings/platform?tab=trust",
  "/corp/settings/search": "/corp/settings/platform?tab=discovery",
  "/corp/settings/promotions": "/corp/settings/platform?tab=discovery",
  "/corp/settings/notifications": "/corp/settings/platform?tab=communications",
  "/corp/settings/retention": "/corp/settings/platform?tab=privacy",
  "/corp/settings/privacy": "/corp/settings/platform?tab=privacy",
};

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (SETTINGS_REDIRECTS[path]) {
    return NextResponse.redirect(new URL(SETTINGS_REDIRECTS[path], request.url));
  }

  // ... rest of middleware
}
```

---

## 31) Navigation Registry Update

Update the navigation registry to include the unified platform settings:

```typescript
// In CORP_NAV array, ADD:
{
  key: "platform-settings",
  label: "Platform Settings",
  href: "/corp/settings/platform",
  icon: "Settings",
  section: "settings",
  sortOrder: 1,
  requires: "PlatformRole.ADMIN", // Use PlatformRole, not invented permission keys
},
```

---

## 32) Files to DELETE (After Migration)

After confirming the unified page works:

```
apps/web/app/(platform)/corp/settings/
â”œâ”€â”€ monetization/           # DELETE (replaced by tab 1)
â”œâ”€â”€ tiers/                  # DELETE (replaced by tab 1)
â”œâ”€â”€ trust/                  # DELETE (replaced by tab 4)
â”œâ”€â”€ retention/              # DELETE (replaced by tab 7)
â”œâ”€â”€ shipping/               # DELETE (replaced by tab 3)
â”œâ”€â”€ search/                 # DELETE (replaced by tab 5)
â”œâ”€â”€ payouts/                # DELETE (replaced by tab 3)
â”œâ”€â”€ orders/                 # DELETE (replaced by tab 2)
â”œâ”€â”€ cart/                   # DELETE (replaced by tab 2)
â”œâ”€â”€ reviews/                # DELETE (replaced by tab 4)
â”œâ”€â”€ seller-standards/       # DELETE (replaced by tab 4)
â”œâ”€â”€ disputes/               # DELETE (replaced by tab 4)
â””â”€â”€ promotions/             # DELETE (replaced by tab 5)
```

**KEEP:**
```
â”œâ”€â”€ flags/                  # KEEP - Feature flags (different system)
â”œâ”€â”€ notifications/templates # KEEP - Email templates (different system)
â”œâ”€â”€ categories/             # KEEP - Category management (different system)
â”œâ”€â”€ cancellation/           # KEEP - Already integrated into commerce tab
â””â”€â”€ platform/               # NEW - Unified settings
```

---

## 33) Unified Platform Settings Implementation Summary

| Component | File Location |
|-----------|---------------|
| Schema | `prisma/schema.prisma` (PlatformSettings, PlatformSettingsAudit) |
| Types | `packages/core/settings/platformSettingsTypes.ts` |
| Defaults | `packages/core/settings/platformSettingsDefaults.ts` |
| Service | `packages/core/settings/platformSettingsService.ts` |
| API | `apps/web/app/api/corp/settings/platform/route.ts` |
| UI | `apps/web/app/(platform)/corp/settings/platform/page.tsx` |
| Redirects | `apps/web/middleware.ts` |

**Total: 174 settings across 7 tabs in a single unified page**

---

## 22) Phase 15 Completion Criteria (Updated)

- Navigation registry with all routes
- Settings registry with versioned storage
- Permission-gated menu rendering
- Corp sidebar component
- Settings index page
- Settings API (GET/POST per category)
- **Promotion Settings editor UI**
- **Notification Template editor UI**
- **Shipping Profile editor UI**
- **Category Attribute editor UI**
- **Return Policy editor UI**
- **Cancellation Policy Settings editor UI** (Commerce Flow Fix)
- **Bulk listing actions service (HIGH-10)** - BASIC tier or higher only
- **Unified Platform Settings page** (174 settings, 7 tabs) - consolidates all platform settings
- Health provider passes
- Doctor verifies routes and settings

---

## 23) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 15 implementation |
| 1.1 | 2026-01-20 | HIGH-10: Bulk listing actions service |
| 1.2 | 2026-01-21 | H-Series: Updated tier references to eBay-exact tiers (BASIC+ instead of PRO/STORE) |
| 1.3 | 2026-01-21 | **Commerce Flow Fix**: Added Cancellation Policy Settings admin UI (sections 17.1-17.3) |
| 1.4 | 2026-01-21 | **Unified Platform Settings**: Added PART C (sections 24-33) with consolidated platform settings page (174 settings, 7 tabs, full audit trail) |
