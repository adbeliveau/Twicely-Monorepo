# TWICELY RBAC + DELEGATED ACCESS SPEC (EBAY-MIRRORED) - LOCKED

## STATUS
**LOCKED BASELINE - DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines Twicely's authorization model with **two separate layers**:
1) **Platform RBAC** (Twicely internal staff)
2) **Delegated Access** (seller/business owner delegates staff access)

It intentionally mirrors **eBay-style account access**:
- **One true owner (User)**
- **Staff act on behalf of owner**
- **No shared ownership**
- **Every action is attributable**

This spec MUST align with:
- `TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`
- `TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md`

---

## 0. Definitions

### Actor
The authenticated user making the request (the person clicking buttons).
- `actorUserId`

### Owner
The user that owns the data/resources being acted on.
- `ownerUserId`

### Delegation
A relationship allowing `actorUserId` to perform actions **on behalf of** `ownerUserId`.
- `DelegatedAccess(ownerUserId, staffUserId, permissions[])`

### Scope
The boundary within which permissions apply:
- **Platform scope**: global (Twicely employees/admins)
- **Owner scope**: one ownerUserId (seller/business owner)

---

## 1. Non-Negotiable Rules

1. **Single Ownership**
   - Listings, orders, payouts, storefronts are owned by a `userId` only.
2. **Delegated Access is not ownership**
   - Staff never become owners.
3. **Two RBAC systems never merge**
   - Platform RBAC and Delegated Access are evaluated separately.
4. **Every write is attributable**
   - Log `actorUserId` and `onBehalfOfUserId` for all privileged mutations.
5. **Least privilege**
   - Default deny. Grant only the minimum required.

---

## 2. Permission Context (Required Everywhere)

Every request MUST build an Authorization Context:

```ts
AuthContext {
  actorUserId: string
  isPlatformStaff: boolean
  platformRoles: PlatformRole[]
  // Optional acting mode:
  onBehalfOfUserId?: string // present only if acting as delegated staff
  delegatedScopes?: string[] // seller scopes from DelegatedAccess.scopes
}
```

### Acting Modes
- **Self-mode (default):**
  - `onBehalfOfUserId` is undefined
- **Delegated-mode:**
  - `onBehalfOfUserId = ownerUserId`
  - `delegatedScopes` loaded from `DelegatedAccess.scopes`

---

## 3. Data Model (Minimum Required)

### Platform RBAC
```ts
PlatformRole {
  id
  name: "ADMIN" | "SUPPORT" | "FINANCE" | "MODERATION" | "DEVELOPER"
}

PlatformUserRole {
  actorUserId
  roleId
}
```

### Delegated Access (eBay-style)
```ts
DelegatedAccess {
  id
  ownerUserId      // the account owner
  staffUserId      // the delegate
  status           // "active" | "invited" | "revoked"
  scopes           // string[] of seller scope keys (see TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md)
  createdAt
  createdByUserId  // usually ownerUserId
  revokedAt?
  revokedByUserId?
}
```

> **Note:** The field is named `scopes` (not `permissions`) to clearly distinguish seller delegated scopes from platform RBAC permissions.

### Audit (Required for privileged actions)
```ts
AuditEvent {
  id
  actorUserId
  onBehalfOfUserId?     // set for delegated actions
  actionKey             // e.g. "listing.update"
  resourceType
  resourceId
  metadataJson
  ip
  userAgent
  createdAt
}
```

---

## 4. Platform RBAC (Twicely Internal Staff)

### Purpose
Platform RBAC is for **Twicely's own staff** to manage the marketplace.

### Platform Roles (baseline)
- `ADMIN` - full access (including role assignment)
- `SUPPORT` - user support tools, disputes, refunds (guarded)
- `FINANCE` - payouts, fees, tax reports (read-heavy, guarded writes)
- `MODERATION` - content moderation, listings takedowns, bans
- `DEVELOPER` - diagnostics, logs, feature flags (no financial writes)

> Platform roles are not seller roles and do not grant "ownership".

### Platform RBAC Rules
- Platform staff may access platform-admin routes and tools.
- Platform staff actions MUST be logged with `actorUserId`.
- When staff act on a seller's resources, the seller remains the owner.
  - `onBehalfOfUserId` MAY be set for traceability, but does not imply delegation.

---

## 5. Delegated Access (Seller Staff Access) - eBay Mirror

### Purpose
Allows an owner to grant staff access to manage selling operations **without transferring ownership**.

### Delegated Permission Keys (baseline)
These are string keys stored in `DelegatedAccess.permissions[]`.

**Storefront**
- `store.view`
- `store.edit_branding`
- `store.edit_policies`

**Listings**
- `listing.view`
- `listing.create`
- `listing.edit`
- `listing.end`
- `listing.delete` (optional, often restricted)

**Orders**
- `order.view`
- `order.fulfill`
- `order.refund_request` (request only, not approve)
- `order.message_buyer`

**Inventory & Pricing**
- `inventory.adjust`
- `pricing.edit`

**Messaging**
- `messages.view`
- `messages.send`

**Reports**
- `reports.view`

**Staff Management (Owner-only by default)**
- `staff.invite`
- `staff.revoke`
- `staff.permissions_edit`

**Payouts (Owner-only by default)**
- `payouts.view`
- `payouts.manage` (strongly restricted / 2FA recommended)

### Delegated Access Rules (Non-negotiable)
- Staff permissions are only valid **within owner scope**.
- Staff cannot grant permissions they do not have.
- Staff cannot modify owner identity, tax profile, or payout destination unless explicitly permitted.
- Payout permissions must be treated as **high risk**.

---

## 6. Authorization Algorithm (Canonical)

### Step 1 - Build AuthContext
- Resolve `actorUserId` from session.
- Load platform roles for actor.
- If request includes "act on behalf":
  - Load `DelegatedAccess` where `ownerUserId = targetOwnerId` and `staffUserId = actorUserId` and `status=active`.
  - Attach `onBehalfOfUserId` and `delegatedPermissions`.

### Step 2 - Determine Effective Owner
For seller resources, the owner is always:
- `ownerUserId` (resource.sellerId / resource.ownerId)

### Step 3 - Evaluate Permission
**ALLOW if any is true:**
1) **Owner self-access**
   - `actorUserId == ownerUserId`
2) **Delegated access**
   - `onBehalfOfUserId == ownerUserId` AND required permission key is present
3) **Platform RBAC**
   - actor is platform staff with appropriate platform permission (admin routes only)

Else: **DENY**

---

## 7. Required Logging (Audit)

For every privileged mutation (create/update/delete/fulfill/refund/etc.), record:
- `actorUserId`
- `onBehalfOfUserId` (if delegated-mode)
- `actionKey`
- `resourceType` + `resourceId`
- metadata (diff summary, reason codes, etc.)

This is mandatory for:
- Security
- Disputes
- Tax/audit
- Support traceability

---

## 8. UI/UX Rules (Seller Side)

### Owner View
Owners must be able to:
- Invite staff
- Set permissions
- Revoke access
- View audit history for staff actions

### Staff View
Staff must:
- Clearly see "Acting as: <Owner>"
- Be prevented from viewing other owners' data
- Have UI locked to permission set (no dead buttons)

### Mode Switching
Staff may only select owners they are assigned to via `DelegatedAccess`.
No global "business switch" beyond allowed owners.

---

## 9. API Requirements (Hard Requirements)

### Every seller-facing mutation endpoint must:
- Identify resource ownerUserId
- Enforce the canonical algorithm
- Write an audit event
- Never accept ownerUserId from client as truth without verification

### Forbidden Anti-patterns
- X `if (isSeller) allow`
- X trusting `ownerId` passed from client
- X staff actions without `onBehalfOfUserId`
- X business/store IDs used as ownership

---

## 10. Security Requirements (Baseline)

- Owners should require **2FA** to enable:
  - `payouts.manage`
  - `staff.permissions_edit`
- Rate-limit:
  - invites
  - permission changes
  - payout changes
- Email alerts on:
  - staff invite accepted
  - permissions changed
  - payout destination changed
- Session device history for owners (recommended)

---

## 11. Acceptance Checklist (What must be true)

- [ ] A staff member cannot view or edit data unless delegated.
- [ ] A staff member cannot act outside the owner scope.
- [ ] All staff mutations record actor + onBehalfOf.
- [ ] Platform staff tools are separate from seller tools.
- [ ] No resource ownership references business/store/staff IDs.
- [ ] Default is deny.
- [ ] Permission keys are consistent across UI + API.

---

## VERSION
- **v1.0 - eBay-mirrored delegated access + platform RBAC baseline**
- Date locked: 2026-01-17
- **v1.1 - Unified terminology fix (permissions -> scopes for seller delegated access)**
- Date updated: 2026-01-24
