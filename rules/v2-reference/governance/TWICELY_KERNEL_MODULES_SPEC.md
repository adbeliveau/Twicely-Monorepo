# Twicely Kernel + Modules Architecture Spec (v1)

## Purpose
This document defines how Twicely is built from scratch using a **kernel + standalone modules** architecture.
The goal is to allow features to be added, removed, or evolved **without touching core code**, while staying aligned with Twicely V2 rules.

This file is the **single source of truth** for architecture decisions.

---

## Core Principles (Non-Negotiable)

1. **Kernel is small and stable**
2. **Everything else is a module**
3. **Modules do not import app internals**
4. **All permissions flow through PermissionContext**
5. **Single ownership model (V2)**
6. **Explicit mount points only**
7. **Event-driven, not tightly coupled**

If a change violates one of these, it is rejected.

---

## 1. The Kernel (Core)

The kernel is the only part of the system that knows about:
- Authentication
- Database connection
- Permissions
- Module registration
- Global routing

The kernel should change **rarely**.

### Kernel Responsibilities

- Auth + session resolution
- Prisma client initialization
- PermissionContext creation
- RBAC resolution (platform + business)
- Event bus
- Module registry
- Minimal route mounting

### Kernel Must NOT:
- Contain business logic
- Contain feature logic
- Contain UI beyond shared primitives

---

## 2. Unified Account Model (v3)

### Everyone is a User
- Buyers
- Sellers
- Admins
- Platform Staff

All start as a `User`.

### Seller Capabilities
- Any user can become a seller
- Seller identity = userId (no separate seller entity)
- Delegated access via `DelegatedAccess` (staff acting on behalf of seller)

### Ownership Rule (Critical - Per Locked Specs)
- **All resources are owned by userId only**
- Listings.sellerId = userId (owner)
- Orders.sellerId/buyerId = userId
- Payouts.ownerId = userId
- Delegated staff NEVER own resources
- Staff actions attributed via `actorUserId` + `onBehalfOfUserId`

---

## 3. PermissionContext (Required Everywhere)

Every request, API call, and mutation MUST build a PermissionContext.

### PermissionContext Fields
- userId (required)
- sellerId (optional - for seller hub context, equals userId of owner)
- scopes[] (delegated access scopes, if acting on behalf)
- isPlatformStaff (boolean)
- platformRoles[] (ADMIN, SUPPORT, FINANCE, MODERATION, DEVELOPER)

No operation is allowed without it.

---

## 4. RBAC (Two Systems, Never Mixed)

### Platform RBAC (Corp Staff)
- ADMIN
- SUPPORT
- FINANCE
- MODERATION
- DEVELOPER

Scope: entire platform (`/corp/*`, `/api/platform/*`)

### Delegated Access (Seller Staff)
- Scopes: listings.manage, orders.manage, shipping.manage, etc.
- Owner grants scopes to staff users
- Staff act on behalf of owner (never own resources)

Scope: single seller account (`/seller/*`, `/api/seller/*`)

### Rule
Permissions are evaluated as:
- Platform RBAC (for corp staff) OR
- Delegated Access scopes (for seller staff)

These two systems MUST NOT be merged or interchangeable.

---

## 5. Module System

### What Is a Module?
A module is a **self-contained feature package**.

Examples:
- Twicely Studio
- Twicely AI
- Cross-Lister
- Analytics
- Live Auctions

### Module Must Contain
- Its own routes
- Its own services
- Its own UI
- Its own permissions logic (using shared helpers)
- Its own database models (registered centrally)

### Module Must NOT
- Import from `app/*`
- Modify core behavior
- Bypass PermissionContext
- Talk directly to other modules

---

## 6. Dependency Injection (Required)

Modules receive dependencies at runtime.

Injected Dependencies:
- db (Prisma)
- auth / getSession
- eventBus
- shared helpers
- config

Modules never create their own DB or auth instances.

---

## 7. Allowed Core Touch Points

Modules are allowed to touch core ONLY in these places:

1. API Mount
```
/app/api/<module>/[...path]/route.ts
```

2. UI Entry Points
```
/app/(seller)/<module>/*
/app/(business)/[businessProfileId]/<module>/*
```

3. Module Registry
```
lib/modules.ts
```

Nothing else.

---

## 8. Event Bus (Decoupling Layer)

Modules communicate via events, not imports.

Example Events:
- listing.created
- listing.updated
- order.paid
- subscription.changed

This allows modules to react without dependencies.

---

## 9. Database Strategy

### Single Schema (Preferred)
- One Prisma schema
- Modules contribute models
- Core owns migrations
- No module self-migrates in prod

### Ownership Rules
- All records reference owner userId
- Staff attribution via createdByUserId
- No businessProfileId ownership

---

## 10. API & Service Boundaries

Marketplace-critical logic lives behind thin APIs:
- Products
- Listings
- Orders
- Media uploads

Modules consume these APIs instead of querying core tables freely.

---

## 11. UI System

- Tailwind CSS
- Shadcn UI
- Shared design tokens

Modules may ship UI but must conform to shared primitives.

---

## 12. Folder Structure

### Core
- app/
- lib/
- components/
- shared/

### Modules
- modules/twicely-studio/
- modules/twicely-ai/
- modules/twicely-crosslist/

---

## 13. Build Order (Strict)

1. Kernel
2. Accounts + RBAC
3. Marketplace MVP
4. Module registry
5. Studio
6. AI
7. Cross-Lister

---

## 14. Guardrails (Enforced)

- No module imports app/*
- No logic without PermissionContext
- No dual ownership
- No hidden coupling
- Standard API responses

---

## 15. Change Policy

Any change to this document:
- Must list what rule is affected
- Must explain why
- Must not break existing modules

This document evolves, but **discipline is mandatory**.
