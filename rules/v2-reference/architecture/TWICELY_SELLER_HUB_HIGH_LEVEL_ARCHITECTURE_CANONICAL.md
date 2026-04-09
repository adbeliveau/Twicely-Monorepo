# Seller Hub — High-Level Architecture Canonical (Seller Control Plane)
**Status:** LOCKED (v1.0)  
**Audience:** Marketplace platform engineers + AI installers  
**Purpose:** Define the seller-facing admin/control plane for managing selling operations.  
**Constraint:** This canonical mirrors mature marketplace seller hubs, but **does not reference any external marketplace by name**.

---

## 0) Core Principles

1. **Single Seller Control Plane**
   Sellers manage their entire business from one hub. No fragmented tools.

2. **Seller-Scoped Authority**
   All actions are scoped to `sellerId` and enforced server-side.

3. **Backend-First**
   Every screen maps to an explicit API + state machine.

4. **Deterministic & Auditable**
   Seller actions that affect money, listings, or trust emit auditable events.

5. **Permission-Aware**
   Seller staff access is governed by delegated access scopes.

---

## 1) Seller Hub Topology

### 1.1 Layers

- **Seller Hub UI**
  - Routes under `/seller/*`
  - Permission-gated by delegated access
- **Seller APIs**
  - Routes under `/api/seller/*`
  - Require seller context + scope checks
- **Core Domain Services**
  - Listings, orders, payouts, trust, analytics
- **Persistence**
  - Postgres (Prisma)
  - Append-only audit + ledger tables

---

## 2) Seller Hub Domains (Menus → Submenus)

### 2.1 Dashboard
- Sales summary (GMV, orders, net)
- Notifications / alerts
- Actionable tasks (ship orders, respond to cases)

### 2.2 Listings
- **Active Listings**
- **Drafts**
- **Scheduled**
- **Ended / Suppressed**
- Bulk tools:
  - Edit price / quantity
  - End / relist
  - Reindex (non-destructive)

### 2.3 Orders
- **Awaiting Shipment**
- **Shipped**
- **Delivered**
- **Returns / Disputes**
- Order detail:
  - Buyer info (masked)
  - Shipment status
  - Refund eligibility

### 2.4 Shipping
- Label purchase
- Tracking management
- Shipment exceptions

### 2.5 Finance
- **Overview**
  - Available balance
  - Pending funds
  - Holds
- **Ledger**
  - Per-order breakdown
- **Payouts**
  - Upcoming payouts
  - Payout history

### 2.6 Performance & Trust
- Seller performance metrics
- Trust indicators
- Policy compliance warnings

### 2.7 Marketing
- Promotions
- Coupons
- Listing boosts (if enabled)

### 2.8 Analytics
- Sales trends
- Conversion metrics
- Listing performance

### 2.9 Messages
- Buyer conversations
- Moderation flags (read-only)

### 2.10 Settings
- Business info
- Shipping preferences
- Payout destination (managed by platform)
- Seller staff & permissions

---

## 3) Seller Auth Context

```ts
export type SellerAuthContext = {
  userId: string;
  sellerId: string;
  scopes: string[]; // delegated access scopes
};
```

Scope enforcement helper:

```ts
export function assertSellerScope(ctx: SellerAuthContext, scope: string) {
  if (!ctx.scopes.includes(scope)) {
    throw new Error("FORBIDDEN_SELLER_SCOPE");
  }
}
```

---

## 4) Seller API Surface

### 4.1 Namespace
- `/api/seller/*`
- Never allow seller endpoints to mutate platform-owned config.

### 4.2 Patterns
- `GET /api/seller/<domain>` list
- `GET /api/seller/<domain>/:id` detail
- `POST /api/seller/<domain>/:id/<action>`

All actions:
- Validate seller ownership
- Enforce state machines
- Emit audit events

---

## 5) State Machines (Seller-Safe)

Seller-triggered transitions are **subset-only** of core state machines.

Examples:
- Seller may mark order as shipped
- Seller may NOT force-complete or refund outside policy
- Seller may NOT override trust enforcement

---

## 6) Audit & Safety

### 6.1 Seller audit events

```prisma
model SellerAuditEvent {
  id          String   @id @default(cuid())
  sellerId    String
  actorUserId String
  action      String
  entityType  String
  entityId    String
  metaJson    Json?
  createdAt   DateTime @default(now())

  @@index([sellerId, createdAt])
}
```

---

## 7) Navigation Registry

```ts
export type SellerNavItem = {
  key: string;
  label: string;
  href: string;
  requiresScope?: string;
};

export const SELLER_NAV: SellerNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/seller" },
  { key: "listings", label: "Listings", href: "/seller/listings", requiresScope: "listings.manage" },
  { key: "orders", label: "Orders", href: "/seller/orders", requiresScope: "orders.manage" },
  { key: "finance", label: "Finance", href: "/seller/finance", requiresScope: "finance.view" },
  { key: "analytics", label: "Analytics", href: "/seller/analytics", requiresScope: "analytics.view" },
  { key: "settings", label: "Settings", href: "/seller/settings", requiresScope: "settings.manage" },
];
```

---

## 8) Minimal Implementation Checklist

Seller Hub is complete when:
- Seller can list, edit, and end listings
- Seller can ship orders
- Seller can view balances and payouts
- Seller can see trust/performance status
- Seller staff permissions are enforced
- Seller actions generate audit events

---

## 9) Extension Rules

To add new seller tools:
1. Update canonical
2. Add API endpoints
3. Enforce scopes
4. Update nav registry
5. Add audit coverage

---

# END CANONICAL
