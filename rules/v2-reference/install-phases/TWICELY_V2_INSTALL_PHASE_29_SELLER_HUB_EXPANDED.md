# TWICELY V2 — Install Phase 29: Seller Hub (Expanded Implementation)
**Status:** LOCKED (v1.1)  
**Scope:** Seller control plane UI + APIs + delegated access enforcement  
**Backend-first:** Schema → Services → API → Audit → Health → UI → Doctor

**Canonicals (MUST follow):**
- `/rules/TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md`
- `/rules/TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md`
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `/rules/TWICELY_LISTINGS_CATALOG_CANONICAL.md`
- `/rules/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_29_SELLER_HUB.md`  
> Prereq: Phases 0–28 complete and Doctor green.

---

## 0) What this phase installs

### Backend (Seller APIs)
- Seller dashboard aggregation service
- Seller-scoped listing management
- Seller-scoped order fulfillment
- Seller finance read endpoints (balance, earnings)
- Seller staff delegation management
- Seller messaging endpoints
- Seller settings management

### UI (Seller Hub `/seller/*`)
- Dashboard with KPI tiles + action queues
- Listings management (CRUD, bulk actions)
- Orders management (fulfillment workflow)
- Shipping (labels, tracking)
- Finance (balance, earnings breakdown)
- Analytics (performance metrics)
- Messages (order conversations)
- Settings (profile, shipping, staff)

### Ops
- Health provider: `seller_hub`
- Doctor checks for completeness + boundary enforcement

### Explicit Boundaries (NOT IN SELLER HUB)
- ❌ Ledger mutation (Corp only)
- ❌ Payout execution (Corp only)
- ❌ Fee schedule editing (Corp only)
- ❌ Trust/policy enforcement (Corp only)
- ❌ Platform settings (Corp only)

---

## 1) Prisma Schema (Uses existing DelegatedAccess from Phase 1)

Phase 1 already created `DelegatedAccess`. We use that model directly.

### Additional Seller-Specific Settings Model

```prisma
// =============================================================================
// SELLER SETTINGS (Per-Seller Configuration)
// =============================================================================

model SellerSettings {
  id              String   @id @default(cuid())
  sellerId        String   @unique

  // NOTE: Business info (businessName, taxId, etc.) is in SellerProfile (Phase 13)
  // NOTE: Vacation mode is managed by SellerVacationMode model below

  // Shipping Preferences
  defaultShippingProfileId String?
  handlingTimeDays Int      @default(3)
  returnPolicyId   String?

  // Notification Preferences
  notificationPrefs Json    @default("{}")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// =============================================================================
// SELLER VACATION MODE
// =============================================================================

model SellerVacationMode {
  id              String    @id @default(cuid())
  sellerId        String    @unique

  isActive        Boolean   @default(false)
  autoReply       String?   // Auto-reply message to buyers

  // Scheduled vacation
  startAt         DateTime?
  endAt           DateTime?

  // Behavior
  pauseListings   Boolean   @default(true)
  hideFromSearch  Boolean   @default(true)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([isActive, startAt])
}

// =============================================================================
// SELLER AUDIT (Seller-Specific Actions)
// =============================================================================

model SellerAuditEvent {
  id              String   @id @default(cuid())
  sellerId        String
  actorUserId     String
  onBehalfOf      Boolean  @default(false) // true if staff acting for owner
  
  action          String   // listing.created, order.shipped, staff.invited, etc.
  entityType      String
  entityId        String
  metaJson        Json     @default("{}")
  
  ip              String?
  userAgent       String?
  
  createdAt       DateTime @default(now())

  @@index([sellerId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([action])
}
```

Run migration:
```bash
npx prisma migrate dev --name seller_hub_phase29
```

---

## 2) Seller Auth Context (Core Service)

Create `packages/core/seller/auth.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { DelegatedPermissionKey } from "../rbac/types";

const prisma = new PrismaClient();

/**
 * Seller Auth Context - returned after successful authentication
 */
export type SellerAuthContext = {
  actorUserId: string;
  sellerId: string;
  isOwner: boolean;
  scopes: string[];
  delegatedAccessId?: string;
};

/**
 * Resolve seller auth context
 * 
 * Rules per TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md:
 * 1. Owner self-access: actorUserId == sellerId → full access
 * 2. Delegated access: active delegation with permissions
 * 3. Default: DENY
 */
export async function requireSellerAuth(
  actorUserId: string,
  sellerId: string
): Promise<SellerAuthContext> {
  // Case 1: Owner self-access
  if (actorUserId === sellerId) {
    return {
      actorUserId,
      sellerId,
      isOwner: true,
      scopes: ["*"], // Owner has all scopes
    };
  }

  // Case 2: Delegated access
  const delegation = await prisma.delegatedAccess.findUnique({
    where: {
      ownerUserId_staffUserId: {
        ownerUserId: sellerId,
        staffUserId: actorUserId,
      },
    },
  });

  if (!delegation || delegation.status !== "active") {
    throw new Error("FORBIDDEN_SELLER_ACCESS");
  }

  return {
    actorUserId,
    sellerId,
    isOwner: false,
    scopes: delegation.permissions,
    delegatedAccessId: delegation.id,
  };
}

/**
 * Assert seller has required scope
 */
export function assertSellerScope(
  ctx: SellerAuthContext,
  requiredScope: string
): void {
  if (ctx.isOwner) return; // Owners have all permissions
  if (ctx.scopes.includes("*")) return; // Full access (shouldn't happen for staff)
  if (!ctx.scopes.includes(requiredScope)) {
    throw new Error(`FORBIDDEN_SELLER_SCOPE:${requiredScope}`);
  }
}

/**
 * Check if seller has scope (without throwing)
 */
export function hasSellerScope(
  ctx: SellerAuthContext,
  scope: string
): boolean {
  if (ctx.isOwner) return true;
  if (ctx.scopes.includes("*")) return true;
  return ctx.scopes.includes(scope);
}
```

---

## 3) Seller Dashboard Service

Create `packages/core/seller/dashboard.ts`:

```typescript
import { PrismaClient, OrderStatus, ListingStatus } from "@prisma/client";

const prisma = new PrismaClient();

export type SellerDashboardData = {
  // KPI Tiles
  activeListings: number;
  pendingOrders: number;
  unreadMessages: number;
  availableBalance: number;
  
  // Action Queues
  ordersToShip: Array<{
    id: string;
    orderNumber: string;
    buyerName: string;
    itemCount: number;
    totalCents: number;
    createdAt: Date;
  }>;
  
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    createdAt: Date;
  }>;
  
  // Performance Snapshot
  salesLast30Days: number;
  salesCountLast30Days: number;
  averageRating: number | null;
  reviewCount: number;
};

export async function getSellerDashboard(sellerId: string): Promise<SellerDashboardData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Parallel queries for performance
  const [
    activeListings,
    pendingOrders,
    unreadMessages,
    balance,
    ordersToShip,
    recentOrders,
    salesStats,
    ratingStats,
  ] = await Promise.all([
    // Active listings count
    prisma.listing.count({
      where: { sellerId, status: "ACTIVE" },
    }),

    // Pending orders count
    prisma.order.count({
      where: {
        sellerId,
        status: { in: ["PAID", "AWAITING_FULFILLMENT"] },
      },
    }),

    // Unread messages count
    prisma.message.count({
      where: {
        recipientId: sellerId,
        readAt: null,
      },
    }),

    // Available balance from ledger
    prisma.ledgerEntry.aggregate({
      where: { sellerId },
      _sum: { amountCents: true },
    }),

    // Orders awaiting shipment
    prisma.order.findMany({
      where: {
        sellerId,
        status: { in: ["PAID", "AWAITING_FULFILLMENT"] },
      },
      select: {
        id: true,
        orderNumber: true,
        buyerId: true,
        totalCents: true,
        createdAt: true,
        lineItems: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),

    // Recent orders
    prisma.order.findMany({
      where: { sellerId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Sales last 30 days
    prisma.order.aggregate({
      where: {
        sellerId,
        status: "COMPLETED",
        completedAt: { gte: thirtyDaysAgo },
      },
      _sum: { totalCents: true },
      _count: true,
    }),

    // Rating stats
    prisma.review.aggregate({
      where: { sellerId },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  // Get buyer names for orders to ship
  const buyerIds = ordersToShip.map((o) => o.buyerId);
  const buyers = await prisma.user.findMany({
    where: { id: { in: buyerIds } },
    select: { id: true, displayName: true },
  });
  const buyerMap = new Map(buyers.map((b) => [b.id, b.displayName ?? "Buyer"]));

  return {
    activeListings,
    pendingOrders,
    unreadMessages,
    availableBalance: balance._sum.amountCents ?? 0,

    ordersToShip: ordersToShip.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      buyerName: buyerMap.get(o.buyerId) ?? "Buyer",
      itemCount: o.lineItems.length,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
    })),

    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
    })),

    salesLast30Days: salesStats._sum.totalCents ?? 0,
    salesCountLast30Days: salesStats._count ?? 0,
    averageRating: ratingStats._avg.rating ?? null,
    reviewCount: ratingStats._count ?? 0,
  };
}
```

---

## 4) Seller Audit Service

Create `packages/core/seller/audit.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { SellerAuthContext } from "./auth";

const prisma = new PrismaClient();

export async function emitSellerAudit(args: {
  ctx: SellerAuthContext;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.sellerAuditEvent.create({
    data: {
      sellerId: args.ctx.sellerId,
      actorUserId: args.ctx.actorUserId,
      onBehalfOf: !args.ctx.isOwner,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metaJson: args.meta ?? {},
      ip: args.ip,
      userAgent: args.userAgent,
    },
  });
}
```

---

## 5) Seller API Endpoints

### 5.1 Dashboard
`GET /api/seller/dashboard`

```typescript
// apps/web/app/api/seller/dashboard/route.ts
import { NextResponse } from "next/server";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { getSellerDashboard } from "@/packages/core/seller/dashboard";
import { getSessionUserId, getActiveSellerId } from "@/lib/session";

export async function GET(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req); // From header or session
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "dashboard.view");
  
  const data = await getSellerDashboard(sellerId);
  return NextResponse.json(data);
}
```

### 5.2 Listings
`GET /api/seller/listings`

```typescript
// apps/web/app/api/seller/listings/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { getSessionUserId, getActiveSellerId } from "@/lib/session";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "listing.view");
  
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  
  const where = {
    sellerId,
    ...(status && { status }),
  };
  
  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        category: true,
      },
    }),
    prisma.listing.count({ where }),
  ]);
  
  return NextResponse.json({
    listings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "listing.create");
  
  // Check listing cap
  const { assertListingCapOrThrow, incrementListingUsage } = await import(
    "@/packages/core/monetization/tier-caps"
  );
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId },
  });
  await assertListingCapOrThrow({
    sellerId,
    tier: subscription?.tier ?? "STARTER", // No FREE tier
  });
  
  const body = await req.json();
  
  // Create listing...
  const listing = await prisma.listing.create({
    data: {
      sellerId,
      title: body.title,
      description: body.description,
      priceCents: body.priceCents,
      categoryId: body.categoryId,
      conditionCode: body.conditionCode,
      status: "DRAFT",
    },
  });
  
  // Increment usage counter
  await incrementListingUsage(sellerId);
  
  // Audit
  const { emitSellerAudit } = await import("@/packages/core/seller/audit");
  await emitSellerAudit({
    ctx,
    action: "listing.created",
    entityType: "Listing",
    entityId: listing.id,
  });
  
  return NextResponse.json({ listing }, { status: 201 });
}
```

### 5.3 Orders
`GET /api/seller/orders`
`POST /api/seller/orders/:id/mark-shipped`

```typescript
// apps/web/app/api/seller/orders/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "order.view");
  
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  
  const orders = await prisma.order.findMany({
    where: {
      sellerId,
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      lineItems: { include: { listing: true } },
      buyer: { select: { id: true, displayName: true } },
      shipments: true,
    },
    take: 50,
  });
  
  return NextResponse.json({ orders });
}
```

```typescript
// apps/web/app/api/seller/orders/[id]/mark-shipped/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { emitSellerAudit } from "@/packages/core/seller/audit";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "order.fulfill");
  
  const order = await prisma.order.findUnique({
    where: { id: params.id },
  });
  
  if (!order || order.sellerId !== sellerId) {
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }
  
  // Validate state transition
  if (!["PAID", "AWAITING_FULFILLMENT"].includes(order.status)) {
    return NextResponse.json({ error: "INVALID_ORDER_STATE" }, { status: 400 });
  }
  
  const body = await req.json();
  const { carrier, trackingNumber } = body;
  
  // Create shipment and update order
  await prisma.$transaction([
    prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier,
        trackingNumber,
        status: "LABEL_CREATED",
        shippedAt: new Date(),
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FULFILLED",
        fulfilledAt: new Date(),
      },
    }),
  ]);
  
  await emitSellerAudit({
    ctx,
    action: "order.shipped",
    entityType: "Order",
    entityId: order.id,
    meta: { carrier, trackingNumber },
  });
  
  return NextResponse.json({ ok: true });
}
```

### 5.4 Finance (Read-Only)
`GET /api/seller/finance/summary`

```typescript
// apps/web/app/api/seller/finance/summary/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "payouts.view");
  
  // Aggregate ledger entries
  const [totalBalance, pendingPayouts, recentEntries] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { sellerId },
      _sum: { amountCents: true },
    }),
    prisma.payout.aggregate({
      where: { sellerId, status: { in: ["DRAFT", "PENDING", "PROCESSING"] } },
      _sum: { netAmountCents: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { sellerId },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
  ]);
  
  return NextResponse.json({
    availableBalanceCents: totalBalance._sum.amountCents ?? 0,
    pendingPayoutCents: pendingPayouts._sum.netAmountCents ?? 0,
    recentEntries,
  });
}
```

### 5.5 Staff Management
`GET /api/seller/staff`
`POST /api/seller/staff/invite`
`POST /api/seller/staff/:userId/revoke`

```typescript
// apps/web/app/api/seller/staff/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { emitSellerAudit } from "@/packages/core/seller/audit";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "staff.invite"); // View requires staff management scope
  
  const staff = await prisma.delegatedAccess.findMany({
    where: { ownerUserId: sellerId },
    include: {
      // Get staff user details - need to join manually or include relation
    },
  });
  
  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "staff.invite");
  
  const { staffEmail, permissions } = await req.json();
  
  // Find user by email
  const staffUser = await prisma.user.findUnique({
    where: { email: staffEmail },
  });
  
  if (!staffUser) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  
  // Cannot invite yourself
  if (staffUser.id === sellerId) {
    return NextResponse.json({ error: "CANNOT_INVITE_SELF" }, { status: 400 });
  }
  
  // Create delegation
  const delegation = await prisma.delegatedAccess.create({
    data: {
      ownerUserId: sellerId,
      staffUserId: staffUser.id,
      permissions,
      status: "active",
      createdByUserId: actorUserId,
    },
  });
  
  await emitSellerAudit({
    ctx,
    action: "staff.invited",
    entityType: "DelegatedAccess",
    entityId: delegation.id,
    meta: { staffEmail, permissions },
  });
  
  return NextResponse.json({ delegation }, { status: 201 });
}
```

```typescript
// apps/web/app/api/seller/staff/[userId]/revoke/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { emitSellerAudit } from "@/packages/core/seller/audit";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const actorUserId = await getSessionUserId();
  const sellerId = await getActiveSellerId(req);
  
  const ctx = await requireSellerAuth(actorUserId, sellerId);
  assertSellerScope(ctx, "staff.revoke");
  
  const delegation = await prisma.delegatedAccess.findUnique({
    where: {
      ownerUserId_staffUserId: {
        ownerUserId: sellerId,
        staffUserId: params.userId,
      },
    },
  });
  
  if (!delegation) {
    return NextResponse.json({ error: "DELEGATION_NOT_FOUND" }, { status: 404 });
  }
  
  await prisma.delegatedAccess.update({
    where: { id: delegation.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: actorUserId,
    },
  });
  
  await emitSellerAudit({
    ctx,
    action: "staff.revoked",
    entityType: "DelegatedAccess",
    entityId: delegation.id,
    meta: { revokedUserId: params.userId },
  });
  
  return NextResponse.json({ ok: true });
}
```

---

## 6) Seller UI Pages

### 6.1 Navigation Registry

Create `apps/web/app/seller/navigation.ts`:

```typescript
export type SellerNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  requiresScope?: string;
};

export const SELLER_NAV: SellerNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/seller", icon: "LayoutDashboard", requiresScope: "dashboard.view" },
  { key: "listings", label: "Listings", href: "/seller/listings", icon: "Package", requiresScope: "listing.view" },
  { key: "orders", label: "Orders", href: "/seller/orders", icon: "ShoppingCart", requiresScope: "order.view" },
  { key: "shipping", label: "Shipping", href: "/seller/shipping", icon: "Truck", requiresScope: "order.fulfill" },
  { key: "finance", label: "Finance", href: "/seller/finance", icon: "DollarSign", requiresScope: "payouts.view" },
  { key: "analytics", label: "Analytics", href: "/seller/analytics", icon: "BarChart2", requiresScope: "reports.view" },
  { key: "messages", label: "Messages", href: "/seller/messages", icon: "MessageSquare", requiresScope: "messages.view" },
  { key: "settings", label: "Settings", href: "/seller/settings", icon: "Settings", requiresScope: "store.view" },
];

export function filterNavByScopes(scopes: string[]): SellerNavItem[] {
  const hasAll = scopes.includes("*");
  return SELLER_NAV.filter((item) => {
    if (!item.requiresScope) return true;
    if (hasAll) return true;
    return scopes.includes(item.requiresScope);
  });
}
```

### 6.2 Page Structure

```
apps/web/app/seller/
├── layout.tsx              # Seller layout with sidebar
├── page.tsx                # Dashboard
├── listings/
│   ├── page.tsx            # Listing grid
│   ├── new/page.tsx        # Create listing
│   └── [id]/page.tsx       # Edit listing
├── orders/
│   ├── page.tsx            # Order list
│   └── [id]/page.tsx       # Order detail + fulfillment
├── shipping/
│   └── page.tsx            # Shipping queue
├── finance/
│   ├── page.tsx            # Balance summary
│   └── transactions/page.tsx # Transaction history
├── analytics/
│   └── page.tsx            # Performance metrics
├── messages/
│   ├── page.tsx            # Inbox
│   └── [id]/page.tsx       # Thread
└── settings/
    ├── page.tsx            # Settings overview
    ├── profile/page.tsx    # Business info
    ├── shipping/page.tsx   # Shipping preferences
    └── staff/page.tsx      # Staff management
```

---

## 7) Health Provider

Create `packages/core/health/providers/seller-hub.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";

const prisma = new PrismaClient();

export const sellerHubHealthProvider: HealthProvider = {
  id: "seller_hub",
  label: "Seller Hub",
  version: "1.0",

  async run({ runType }): Promise<HealthResult> {
    const checks = [];
    let status: "PASS" | "WARN" | "FAIL" = "PASS";

    // Check 1: SellerSettings table exists
    try {
      await prisma.sellerSettings.count();
      checks.push({
        id: "seller_settings_table",
        label: "SellerSettings table exists",
        status: "PASS",
      });
    } catch {
      checks.push({
        id: "seller_settings_table",
        label: "SellerSettings table exists",
        status: "FAIL",
        message: "Table missing",
      });
      status = "FAIL";
    }

    // Check 2: SellerAuditEvent table exists
    try {
      await prisma.sellerAuditEvent.count();
      checks.push({
        id: "seller_audit_table",
        label: "SellerAuditEvent table exists",
        status: "PASS",
      });
    } catch {
      checks.push({
        id: "seller_audit_table",
        label: "SellerAuditEvent table exists",
        status: "FAIL",
        message: "Table missing",
      });
      status = "FAIL";
    }

    // Check 3: DelegatedAccess integration works
    const delegationCount = await prisma.delegatedAccess.count();
    checks.push({
      id: "delegation_integration",
      label: "DelegatedAccess integration",
      status: "PASS",
      message: `${delegationCount} delegations`,
    });

    return {
      providerId: "seller_hub",
      status,
      summary: status === "PASS" ? "Seller Hub healthy" : "Seller Hub issues",
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

## 8) Doctor Checks

Add to Doctor script:

```typescript
async function checkSellerHub() {
  const checks = [];

  // Check 1: Create test delegation
  const testSellerId = "test_seller_" + Date.now();
  const testStaffId = "test_staff_" + Date.now();
  
  // Check 2: Verify scope enforcement
  try {
    const { requireSellerAuth, assertSellerScope } = await import(
      "@/packages/core/seller/auth"
    );
    
    // This should throw for non-existent delegation
    try {
      await requireSellerAuth(testStaffId, testSellerId);
      checks.push({
        key: "seller_hub.auth_denies_invalid",
        ok: false,
        details: "Should have denied access",
      });
    } catch (e) {
      checks.push({
        key: "seller_hub.auth_denies_invalid",
        ok: (e as Error).message === "FORBIDDEN_SELLER_ACCESS",
        details: "Access correctly denied",
      });
    }
  } catch (e) {
    checks.push({
      key: "seller_hub.auth_module_loads",
      ok: false,
      details: (e as Error).message,
    });
  }

  // Check 3: Dashboard service exists
  try {
    const { getSellerDashboard } = await import(
      "@/packages/core/seller/dashboard"
    );
    checks.push({
      key: "seller_hub.dashboard_service",
      ok: typeof getSellerDashboard === "function",
    });
  } catch {
    checks.push({
      key: "seller_hub.dashboard_service",
      ok: false,
      details: "Service not found",
    });
  }

  // Check 4: Seller cannot access platform APIs
  // (This would be an integration test)

  return checks;
}
```

---

## 9) Boundary Enforcement Rules

### 9.1 What Seller Hub CAN Do
- ✅ View own listings, orders, finance summary
- ✅ Create/edit/end own listings
- ✅ Ship orders (mark as shipped)
- ✅ View and send messages
- ✅ Manage staff (invite/revoke)
- ✅ Update seller settings
- ✅ View analytics

### 9.2 What Seller Hub CANNOT Do
- ❌ Access other sellers' data
- ❌ Mutate ledger entries
- ❌ Execute payouts
- ❌ Issue refunds (must request via support)
- ❌ Change fee schedules
- ❌ Modify trust/policy settings
- ❌ Access `/api/platform/*` endpoints
- ❌ Access Corp Admin UI

### 9.3 Enforcement Implementation

In middleware or route handlers:

```typescript
// apps/web/middleware.ts
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  // Seller routes must not access platform APIs
  if (path.startsWith("/seller") || path.startsWith("/api/seller")) {
    // Block any attempt to access platform routes from seller context
    if (path.includes("/platform") || path.includes("/corp")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }
  
  return NextResponse.next();
}
```

---

## 9.5) G2 Patch: Subscription Management Page (with Personal/Business Gate)

Create `app/(seller)/seller/settings/subscription/page.tsx`:

```tsx
// app/(seller)/seller/settings/subscription/page.tsx
// G2 + Personal/Business Patch: Seller subscription management with business gate

"use client";

import { useState, useEffect } from "react";
import { TierBadge, TierCard, TIER_OPTIONS } from "@/components/corp/TierSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

/**
 * eBay-exact tier feature matrix (including SELLER for casual sellers)
 */
const TIER_FEATURES = {
  SELLER: {
    price: "Free",
    listings: "250/month",
    fee: "13.25%",
    insertionFee: "$0.35",
    features: ["Basic Selling", "No Storefront", "No Store Subscription"],
  },
  STARTER: {
    price: "$4.95/mo",
    listings: "250/month",
    fee: "12.35%",
    insertionFee: "$0.30",
    features: ["Branded Storefront", "Basic Analytics", "Vacation Mode"],
  },
  BASIC: {
    price: "$21.95/mo",
    listings: "1,000/month",
    fee: "11.5%",
    insertionFee: "$0.25",
    features: [
      "Everything in Starter",
      "Advanced Analytics",
      "Bulk Tools",
      "Promoted Listings",
      "2 Staff Accounts",
    ],
  },
  PRO: {
    price: "$59.95/mo",
    listings: "10,000/month",
    fee: "10.25%",
    insertionFee: "$0.15",
    features: [
      "Everything in Basic",
      "Sales Events",
      "Priority Support",
      "5 Staff Accounts",
    ],
  },
  ELITE: {
    price: "$299.95/mo",
    listings: "25,000/month",
    fee: "9.15%",
    insertionFee: "$0.05",
    features: [
      "Everything in Premium",
      "Dedicated Rep",
      "Custom Pages",
      "15 Staff Accounts",
    ],
  },
  ENTERPRISE: {
    price: "$2,999.95/mo",
    listings: "100,000/month",
    fee: "Custom",
    insertionFee: "$0.05",
    features: [
      "Everything in Anchor",
      "Custom Fee Negotiation",
      "100 Staff Accounts",
      "10x API Rate Limit",
    ],
  },
};

type SubscriptionData = {
  tier: string;
  status: string;
  currentPeriodEnd?: string;
  usage: {
    listings: number;
    limit: number;
  };
};

type UserData = {
  sellerType: "PERSONAL" | "BUSINESS";
  businessName?: string;
  businessVerifiedAt?: string;
};

type StoreEligibility = {
  canSubscribe: boolean;
  reason?: string;
  requiresBusinessUpgrade: boolean;
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [eligibility, setEligibility] = useState<StoreEligibility | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showBusinessUpgrade, setShowBusinessUpgrade] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch subscription, user info, and store eligibility in parallel
        const [subRes, userRes, eligRes] = await Promise.all([
          fetch("/api/seller/subscription"),
          fetch("/api/user/me"),
          fetch("/api/seller/subscription/eligibility"),
        ]);

        if (subRes.ok) {
          const data = await subRes.json();
          setSubscription(data.subscription);
          setSelectedTier(data.subscription?.tier || "SELLER");
        }

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }

        if (eligRes.ok) {
          const eligData = await eligRes.json();
          setEligibility(eligData);
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleUpgrade = async () => {
    if (!selectedTier || selectedTier === subscription?.tier) return;

    // Check if trying to subscribe to store without business status
    if (selectedTier !== "SELLER" && eligibility?.requiresBusinessUpgrade) {
      setShowBusinessUpgrade(true);
      return;
    }

    setIsUpgrading(true);
    try {
      const res = await fetch("/api/seller/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          window.location.reload();
        }
      } else {
        const error = await res.json();
        if (error.requiresBusinessUpgrade) {
          setShowBusinessUpgrade(true);
        }
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const currentTier = subscription?.tier || "SELLER";
  const currentFeatures = TIER_FEATURES[currentTier as keyof typeof TIER_FEATURES];
  const isPersonalSeller = user?.sellerType === "PERSONAL";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Subscription</h1>

      {/* Business Upgrade Alert - Personal sellers cannot open store */}
      {isPersonalSeller && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                Business account required for store subscription
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Store subscriptions (Starter, Basic, Premium, Anchor, Enterprise) are
                only available to Business sellers. Upgrade to a Business account for
                free to unlock store features.
              </p>
              <button
                onClick={() => setShowBusinessUpgrade(true)}
                className="mt-3 text-sm font-medium text-amber-800 underline hover:no-underline"
              >
                Upgrade to Business Account (Free) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Business Upgrade Modal */}
      {showBusinessUpgrade && (
        <BusinessUpgradeModal
          onClose={() => setShowBusinessUpgrade(false)}
          onSuccess={() => {
            setShowBusinessUpgrade(false);
            // Refetch user data after upgrade
            fetch("/api/seller-hub/user").then(r => r.json()).then(setUser);
          }}
        />
      )}

      {/* Current Plan Summary */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <div className="flex items-center gap-3 mt-1">
              <TierBadge tier={currentTier} />
              <span className="text-2xl font-bold">{currentFeatures?.price}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Listing Usage</p>
            <p className="text-lg font-semibold">
              {subscription?.usage.listings || 0} / {subscription?.usage.limit || 250}
            </p>
          </div>
        </div>

        {subscription?.status === "ACTIVE" && subscription.currentPeriodEnd && (
          <p className="text-sm text-gray-500">
            Next billing date: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}

        {subscription?.status === "PENDING" && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm">
              Your subscription is pending. Complete payment to start selling.
            </p>
          </div>
        )}
      </div>

      {/* Tier Selection Grid */}
      <h2 className="text-lg font-semibold mb-4">Choose Your Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Object.entries(TIER_FEATURES).map(([tier, info]) => {
          const isStoreTier = tier !== "SELLER";
          const isLocked = isPersonalSeller && isStoreTier;

          return (
            <div
              key={tier}
              onClick={() => !isLocked && setSelectedTier(tier)}
              className={`border rounded-lg p-4 transition-all relative ${
                isLocked
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                  : selectedTier === tier
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 cursor-pointer"
                  : tier === currentTier
                  ? "border-green-300 bg-green-50 cursor-pointer"
                  : "border-gray-200 hover:border-gray-300 cursor-pointer"
              }`}
            >
              {/* Lock overlay for Personal sellers on store tiers */}
              {isLocked && (
                <div className="absolute top-2 right-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <TierBadge tier={tier} />
                {tier === currentTier && (
                  <span className="text-xs text-green-600 font-medium">Current</span>
                )}
              </div>
              <p className="text-xl font-bold mt-2">{info.price}</p>
              <p className="text-sm text-gray-600">{info.listings}</p>
              <p className="text-sm text-gray-600">{info.fee} fee</p>
              {info.insertionFee && (
                <p className="text-xs text-gray-500">{info.insertionFee} insertion</p>
              )}

              <ul className="mt-4 text-xs space-y-1">
                {info.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    <span className="text-gray-600">{f}</span>
                  </li>
                ))}
                {info.features.length > 3 && (
                  <li className="text-gray-400">+{info.features.length - 3} more</li>
                )}
              </ul>

              {/* Business required badge for Personal sellers */}
              {isLocked && (
                <p className="mt-3 text-xs text-gray-500 text-center">
                  Business account required
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Upgrade/Downgrade Button */}
      {selectedTier && selectedTier !== currentTier && (
        <div className="flex justify-center">
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {isUpgrading
              ? "Processing..."
              : TIER_OPTIONS.findIndex((t) => t.value === selectedTier) >
                TIER_OPTIONS.findIndex((t) => t.value === currentTier)
              ? `Upgrade to ${selectedTier}`
              : `Downgrade to ${selectedTier}`}
          </button>
        </div>
      )}
    </div>
  );
}
```

### 9.5b) Business Upgrade Modal & Card Components

```tsx
// app/seller-hub/subscription/BusinessUpgradeModal.tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Alignment Patch: Use UPPER_CASE enum values to match Prisma BusinessType enum
const BUSINESS_TYPES = [
  { value: "SOLE_PROPRIETOR", label: "Sole Proprietor" },
  { value: "LLC", label: "Limited Liability Company (LLC)" },
  { value: "CORPORATION", label: "Corporation" },
  { value: "PARTNERSHIP", label: "Partnership" },
];

const TAX_ID_TYPES = [
  { value: "EIN", label: "EIN (Employer Identification Number)" },
  { value: "SSN", label: "SSN (Social Security Number)" },
  { value: "ITIN", label: "ITIN (Individual Taxpayer ID)" },
];

interface BusinessUpgradeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BusinessUpgradeModal({ onClose, onSuccess }: BusinessUpgradeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    legalName: "",       // Alignment Patch: renamed from businessName
    businessType: "",
    taxId: "",           // Alignment Patch: renamed from businessTaxId
    taxIdType: "EIN",    // Alignment Patch: new field
    line1: "",           // Alignment Patch: renamed from street
    line2: "",           // Alignment Patch: new field
    city: "",
    state: "",
    postalCode: "",      // Alignment Patch: renamed from zip
    country: "US",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Alignment Patch: Use correct API endpoint and field names
      const res = await fetch("/api/seller/business/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: formData.legalName,
          businessType: formData.businessType,
          taxId: formData.taxId || undefined,
          taxIdType: formData.taxIdType,
          address: {
            line1: formData.line1,
            line2: formData.line2 || undefined,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            country: formData.country,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upgrade to business account");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Upgrade to Business Account</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm text-green-800">
              <strong>This upgrade is FREE.</strong> Business accounts can subscribe
              to store plans (Starter, Basic, Premium, Anchor, Enterprise) and access
              additional seller features.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Alignment Patch: Renamed fields to match BusinessInfo model */}
          <div>
            <label className="block text-sm font-medium mb-1">Legal Business Name *</label>
            <input
              type="text"
              required
              value={formData.legalName}
              onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="Your Legal Business Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Business Type *</label>
            <select
              required
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select business type...</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tax ID <span className="text-gray-400">— optional</span>
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="XX-XXXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tax ID Type</label>
              <select
                value={formData.taxIdType}
                onChange={(e) => setFormData({ ...formData, taxIdType: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                {TAX_ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Optional for upgrade, may be required for payouts.</p>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Business Address *</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Street Address *</label>
            <input
              type="text"
              required
              value={formData.line1}
              onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Address Line 2 <span className="text-gray-400">— optional</span>
            </label>
            <input
              type="text"
              value={formData.line2}
              onChange={(e) => setFormData({ ...formData, line2: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="Apt, Suite, Unit, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State/Province *</label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Postal Code *</label>
              <input
                type="text"
                required
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country *</label>
              <select
                required
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Upgrading..." : "Upgrade to Business"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 9.5c) Business Upgrade Card Component (Alignment Patch)

Inline card for displaying business status and upgrade prompt:

```tsx
// components/seller/BusinessUpgradeCard.tsx
"use client";

import { useState } from "react";
import { Building2, Check, ArrowRight } from "lucide-react";
import { BusinessUpgradeModal } from "@/app/seller-hub/subscription/BusinessUpgradeModal";

interface BusinessInfo {
  legalName: string;
  businessType: string;
  verifiedAt: string;
}

interface Props {
  sellerType: "PERSONAL" | "BUSINESS";
  businessInfo?: BusinessInfo | null;
  onUpgraded?: () => void;
}

export function BusinessUpgradeCard({ sellerType, businessInfo, onUpgraded }: Props) {
  const [showModal, setShowModal] = useState(false);

  // Already a business seller
  if (sellerType === "BUSINESS" && businessInfo) {
    return (
      <div className="border rounded-lg p-4 bg-green-50 border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-green-600" />
          <span className="font-semibold">Business Account</span>
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" /> Verified
          </span>
        </div>
        <p className="text-sm text-green-700">
          <strong>{businessInfo.legalName}</strong>
        </p>
        <p className="text-xs text-green-600">
          Verified {new Date(businessInfo.verifiedAt).toLocaleDateString()}
        </p>
      </div>
    );
  }

  // Personal seller - show upgrade prompt
  return (
    <>
      <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-amber-600" />
          <span className="font-semibold">Personal Account</span>
        </div>
        <p className="text-sm text-amber-700 mb-3">
          Upgrade to a Business account to open a store. This is <strong>free</strong>.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
        >
          Upgrade to Business <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      </div>

      {showModal && (
        <BusinessUpgradeModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            onUpgraded?.();
          }}
        />
      )}
    </>
  );
}
```

---

## 10) Phase 29 Completion Criteria

- [ ] SellerSettings and SellerAuditEvent models exist
- [ ] Seller auth context resolution works
- [ ] Scope enforcement works (owner vs staff)
- [ ] Dashboard endpoint returns data
- [ ] Listings CRUD works with cap enforcement
- [ ] Orders list and fulfill works
- [ ] Finance summary returns (read-only)
- [ ] Staff invite/revoke works
- [ ] Seller cannot access platform APIs
- [ ] Health provider passes
- [ ] Doctor checks pass
- [ ] Subscription page shows business gate for Personal sellers
- [ ] BusinessUpgradeModal allows free upgrade to Business (uses BusinessInfo model)
- [ ] BusinessUpgradeCard shows business status or upgrade prompt
- [ ] Store tiers locked/disabled for Personal sellers

---

## VERSION HISTORY
- v1.0 — Initial skeleton
- v1.1 — Full implementation with services, APIs, health, and Doctor checks
- v1.2 — H-Series: Updated planCode → tier for eBay-exact tier system
- v2.0 — Personal/Business Seller Patch: Added business gate UI, BusinessUpgradeModal, locked store tiers for Personal sellers
- v2.1 — Alignment Patch: Updated modal to use BusinessInfo model fields (legalName, taxIdType, address), added BusinessUpgradeCard component

# END PHASE 29
