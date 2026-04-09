# Corporate Admin — High-Level Architecture Canonical (Platform Control Plane)
**Status:** LOCKED (v1.0)  
**Audience:** Platform engineering + AI installers  
**Purpose:** Define the corporate admin/control plane architecture for a large marketplace-style platform.  
**Constraint:** This canonical mirrors proven marketplace control planes, but **does not reference any external marketplace by name**.

---

## 0) Principles (Non‑Negotiable)

1. **One Control Plane, Many Domains**  
   Corporate admin is a single “hub” app with permission-gated areas. Separate logins are not required unless explicitly mandated by security policy.

2. **Backend‑first**  
   Every admin screen must be backed by an explicit domain API and read/write policy. No “UI-only” state.

3. **Least privilege**  
   RBAC is the default. Dangerous actions require stronger permissions and (optionally) step-up checks.

4. **Audit everything that matters**  
   Any permission change, money action, enforcement action, or system config change must emit an immutable audit event.

5. **Idempotent mutations**  
   Admin actions that trigger side effects (refunds, payouts, enforcement, reindex, etc.) must be idempotent and safely retryable.

6. **Operational visibility is first-class**  
   System Health + Doctor are core admin modules, not optional add-ons.

---

## 1) Control Plane Topology

### 1.1 Layers

- **Admin UI (Web App)**
  - Renders pages under `/corp/*`
  - Calls admin APIs under `/api/platform/*`
  - Uses RBAC/Delegated Access gates on every route

- **Admin APIs (Platform Surface)**
  - All corporate actions are executed via `/api/platform/*`
  - All endpoints require platform auth context (staff) and explicit permissions

- **Domain Services (Core)**
  - Business logic in `/packages/core/*`
  - State machines, ledger, trust scoring, enforcement logic, etc.

- **Persistence**
  - Postgres (Prisma)
  - Append-only audit tables
  - Idempotency tables for webhook + admin side-effects

- **Operational Plane**
  - Health providers registry
  - Doctor checks registry
  - Module registry + install status
  - Event logs / reconciliation runs

---

## 2) Domain Model: Admin Areas (Menus → Submenus)

This list is canonical. You may add new domains later, but the base set must exist for a serious marketplace control plane.

### 2.1 Identity & Access
- **Users**
  - Lookup user by ID/email/phone
  - View status, verification, risk flags
  - Admin-only actions: suspend/restore, reset MFA, force logout
- **Roles & Permissions**
  - Create roles, assign permissions
  - Assign roles to staff users
  - Super Admin grant restricted (hard gate)
- **Delegated Access**
  - Seller staff invites, scopes, revocation
  - Access logs for delegation events

### 2.2 Commerce Operations
- **Listings**
  - Listing lookup, status, enforcement state
  - Bulk tools: reindex, suppress, restore
- **Orders**
  - Order lookup by ID / buyer / seller
  - Status timeline, shipment status
  - Manual interventions: cancel, refund initiation (policy gated)
- **Shipping & Returns**
  - Shipment tracking exceptions
  - Return cases, RMA workflows
  - Refund execution (ledger + provider)

### 2.3 Payments & Finance
- **Payments**
  - Provider event viewer (webhooks)
  - Payment intent/charge status
- **Ledger**
  - Per-order ledger view
  - Per-seller balance view
  - Immutable entries; adjustments only by explicit policy
- **Payouts**
  - Payout preview, holds, eligibility checks
  - Execution (idempotent), failure handling
- **Reconciliation**
  - Daily reconciliation runs
  - Variance queue and resolutions

### 2.4 Trust, Safety & Policy
- **Cases Queue**
  - Reports, disputes, abuse flags
  - Assignment, resolution notes
- **Enforcement**
  - Listing suppression, seller restrictions/suspension
  - Evidence and justification required
- **Policy Library**
  - Versioned policies with effective dates
- **Trust Settings**
  - Versioned thresholds, decay, caps
  - Trust snapshot recompute tools

### 2.5 Communications
- **Notifications**
  - Outbox viewer
  - Retry/DLQ management
- **Messaging Moderation**
  - Flagged conversations
  - Action history + audit events

### 2.6 Analytics & Growth
- **Platform Analytics**
  - KPIs (GMV, orders, active sellers)
  - Cohorts and funnels (optional)
- **Seller Analytics**
  - Seller performance snapshots
- **Promotions**
  - Coupons, campaigns, budgets, schedules
- **Subscriptions**
  - Tier pricing versions
  - Billing events + entitlement checks

### 2.7 Platform Operations
- **System Health Console**
  - Provider-driven checks
  - Drill-down details
- **Doctor**
  - Install/config/health matrix
  - Blockers with remediation steps
- **Modules**
  - Installed modules list
  - Install/update/uninstall (Super Admin)
  - Module doctor per module
- **Feature Flags**
  - Kill switches and rollouts
- **Data & Privacy**
  - Retention policies
  - Export requests
  - Soft-delete/anonymization tools

---

## 3) Authentication & Authorization (RBAC)

### 3.1 Staff session context

```ts
export type StaffAuthContext = {
  staffUserId: string;
  roles: string[];              // role slugs
  permissions: string[];        // flattened permission keys
  ip?: string;
  userAgent?: string;
};
```

### 3.2 Permission gating helper (server-side)

```ts
export function assertPermission(ctx: StaffAuthContext, perm: string) {
  if (!ctx.permissions.includes(perm)) {
    const err = new Error("FORBIDDEN");
    (err as any).code = "FORBIDDEN";
    throw err;
  }
}
```

### 3.3 Super Admin hard gate (example)

```ts
export function assertCanGrantSuperAdmin(ctx: StaffAuthContext) {
  // strict: must already be super admin
  if (!ctx.roles.includes("SUPER_ADMIN")) throw new Error("FORBIDDEN_SUPER_ADMIN_GRANT");
}
```

---

## 4) Admin API Surface (Routing Canonical)

### 4.1 Namespace
- Corporate APIs live under: `/api/platform/*`
- Never expose internal admin endpoints to non-staff sessions.

### 4.2 Standard patterns
- `GET /api/platform/<domain>/<resource>` list/search
- `GET /api/platform/<domain>/<resource>/:id` detail
- `POST /api/platform/<domain>/<resource>/:id/<action>` action endpoints
- All actions must:
  - be idempotent (use idempotency keys)
  - write audit events
  - return action receipts

#### Example: action receipt shape

```ts
export type ActionReceipt = {
  ok: boolean;
  action: string;
  entityType: string;
  entityId: string;
  idempotencyKey: string;
  occurredAt: string; // ISO
  auditEventId?: string;
  details?: Record<string, unknown>;
};
```

---

## 5) Audit, Idempotency, and Safety

### 5.1 Audit event (append-only)

```prisma
model AuditEvent {
  id          String   @id @default(cuid())
  actorUserId String?
  action      String
  entityType  String?
  entityId    String?
  metaJson    Json?
  createdAt   DateTime @default(now())

  @@index([action, createdAt])
  @@index([entityType, entityId])
}
```

### 5.2 Idempotency for admin actions

```prisma
model AdminActionIdempotency {
  id             String   @id @default(cuid())
  idempotencyKey String   @unique
  action         String
  entityType     String
  entityId       String
  resultJson     Json
  createdAt      DateTime @default(now())
}
```

Server pattern:
1) upsert idempotency record
2) if exists → return stored result
3) else execute action, write audit, store receipt

---

## 6) Control Plane Observability

### 6.1 System Health providers
Every domain MUST register a health provider key:
- `rbac`
- `listings`
- `orders`
- `payments`
- `ledger`
- `payouts`
- `search`
- `trust`
- `notifications`
- `analytics`
- `flags`
- `privacy`

### 6.2 Doctor matrix
Doctor reports per domain/module:
- Installed
- Configured
- Healthy

---

## 7) UI Composition (Admin App)

### 7.1 Navigation registry (canonical pattern)

```ts
export type NavItem = {
  key: string;
  label: string;
  href: string;
  requires?: string; // permission key
};

export const CORP_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/corp" },
  { key: "users", label: "Users", href: "/corp/users", requires: "users.view" },
  { key: "roles", label: "Roles", href: "/corp/roles", requires: "roles.view" },
  { key: "orders", label: "Orders", href: "/corp/orders", requires: "orders.view" },
  { key: "finance", label: "Finance", href: "/corp/finance", requires: "finance.view" },
  { key: "trust", label: "Trust", href: "/corp/trust", requires: "trust.view" },
  { key: "health", label: "Health", href: "/corp/health", requires: "health.view" },
];
```

Render rules:
- Only show items if `requires` permission is granted.
- Never rely on “hidden menu” for security; always enforce on server.

---

## 8) Minimal Implementation Checklist

Corporate admin is “present” when:
- `/corp` renders a dashboard
- `/corp/roles` role editor exists (Super Admin gating enforced)
- `/corp/orders` order lookup works
- `/corp/finance/ledger` ledger explorer exists
- `/corp/health` and `/corp/doctor` exist and are functional
- Audit events are created for sensitive actions
- All admin actions are idempotent

---

## 9) Extensibility: Adding New Admin Domains

To add a new domain:
1. Add domain canonical/spec
2. Add Prisma models if needed
3. Implement `/api/platform/<domain>/*`
4. Add health provider key
5. Add doctor checks
6. Add nav registry entries (permission-gated)
7. Add audit coverage for write actions

---

# END CANONICAL
