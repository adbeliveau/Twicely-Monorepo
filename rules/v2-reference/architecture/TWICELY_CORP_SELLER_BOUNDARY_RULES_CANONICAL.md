# Corp ↔ Seller Hub Boundary Rules Canonical
**Status:** LOCKED (v1.0)  
**Purpose:** Define strict boundaries between the corporate control plane (`/corp/*`, `/api/platform/*`) and the seller hub (`/seller/*`, `/api/seller/*`).  
**Constraint:** Mirrors mature marketplace separation, without referencing any external platform.

---

## 0) Non‑negotiable principles

1. **Two planes, two auth contexts**
   - Corp plane uses **StaffAuthContext**
   - Seller plane uses **SellerAuthContext**
   - Contexts MUST NOT be interchangeable.

2. **Read vs write ownership**
   - Seller plane may write only seller‑owned resources and seller‑allowed state machine transitions.
   - Corp plane may write platform controls (enforcement, policy, finance interventions) and can override via explicit privileged actions.

3. **Security is server-side**
   - Navigation hiding is not security.
   - Every endpoint must enforce context + permission/scope.

4. **No cross-import drift**
   - Seller UI must not import corp-only packages.
   - Corp UI must not reuse seller-only auth helpers.

---

## 1) Route namespaces (LOCKED)

### Corp (Staff)
- UI: `/corp/*`
- API: `/api/platform/*`

### Seller (Seller users + delegated staff)
- UI: `/seller/*`
- API: `/api/seller/*`

### Buyer (Buyers)
- UI: `/account/*` (or your buyer area)
- API: `/api/buyer/*`

**Rule:** A route must exist in exactly one namespace.

---

## 2) Auth context contracts

### 2.1 Staff context (corp)

```ts
export type StaffAuthContext = {
  staffUserId: string;
  roles: string[];
  permissions: string[];
  ip?: string;
  userAgent?: string;
};
```

### 2.2 Seller context (seller hub)

```ts
export type SellerAuthContext = {
  userId: string;
  sellerId: string;
  scopes: string[]; // delegated access scopes
  ip?: string;
  userAgent?: string;
};
```

### 2.3 Prohibited conversions
- You MUST NOT mint `StaffAuthContext` from a seller session.
- You MUST NOT mint `SellerAuthContext` from a staff session.
- Exception: Corp tooling may **impersonate** a seller for debugging only if explicitly enabled and fully audited (optional feature; not required).

---

## 3) What Seller Hub may do (allowed writes)

Seller hub may:
- Create/update seller listings (within caps/entitlements)
- Change listing price/quantity
- End/relist listing
- Mark order as shipped + attach tracking
- Respond to dispute/return (upload evidence)
- Manage seller staff invites/scopes (delegated access)

Seller hub may NOT:
- Force complete orders
- Execute refunds outside policy
- Execute payouts
- Modify trust settings, policy versions, fee tables, feature flags
- Unsuppress hard-enforced listings/sellers
- Mutate ledger entries

All “may” actions must be enforced via state machines and/or policy checks.

---

## 4) What Corp may do (privileged writes)

Corp may:
- Enforce suppressions/restrictions
- Execute refunds (policy gated) and record ledger entries
- Execute payouts (ledger gated) and manage holds
- Modify fee tables / tiers / promotions / flags
- Run reindex and recompute jobs
- Manage retention/export/delete workflows
- Moderate messages and reviews

Corp must:
- Require explicit permissions
- Emit AuditEvents for sensitive actions
- Use idempotency keys for side-effecting actions

---

## 5) Data access boundaries

### 5.1 Buyer data exposure (seller hub)
Seller hub can view buyer information only as needed for fulfillment, and must be masked where appropriate.

Example masking helper:
```ts
export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0,2)}***@${d}`;
}
```

### 5.2 Financial data exposure (seller hub)
Seller hub can view:
- seller balance summaries
- order-level fee/earnings breakdown

Seller hub cannot view:
- platform global revenue
- other sellers' balances
- raw provider event payloads

---

## 6) Shared domain services (core)

Both planes may call the same core services if those services:
- accept explicit context arguments
- enforce permissions/scopes internally where appropriate
- do not assume “corp” authority by default

Example:
```ts
export async function sellerMarkShipped(ctx: SellerAuthContext, orderId: string, tracking: string) {
  // verify order belongs to ctx.sellerId
  // enforce state machine transition
  // emit audit event
}
```

---

## 7) Testing & Doctor gates

Doctor must assert:
- Seller endpoint rejects staff context (and vice versa)
- Seller cannot access `/api/platform/*`
- Corp cannot access `/api/seller/*` without a seller session
- Forbidden seller actions fail closed

---

# END CANONICAL
