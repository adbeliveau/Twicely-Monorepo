# TWICELY KERNEL + MODULES ENFORCEMENT SPEC (BOUNDARIES, REGISTRY, LINT) - LOCKED

## STATUS
**LOCKED BASELINE - DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines the enforceable rules that make Twicely's **kernel + modules** architecture real:
- Import boundaries (what can import what)
- Module registry contract
- Dependency injection contract
- Route mount patterns (API + UI)
- Event bus contract
- Lint + CI enforcement

This spec exists so modules remain **standalone** and do not gradually leak into core.

This spec MUST align with:
- `TWICELY_KERNEL_MODULES_SPEC.md`
- `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md`

> NOTE: This document does **not** reference any external marketplace. It is purely Twicely's enforcement spec.

---

## 0. Architecture Summary

### Kernel
Small and stable. Responsible only for:
- Auth/session resolution
- Database client
- PermissionContext construction
- Module registry + initialization
- Event bus
- Minimal route mounts (API forwarders + UI entry)

### Modules
Self-contained packages for features and infrastructure:
- Own their routes, UI, services, and provider integrations
- Receive dependencies via injection
- Communicate via events (not imports)

---

## 1. Canonical Folder Layout (Enforced)

```
/app                 # Next.js routes (entry only)
/lib                 # kernel wiring (auth/db/context/modules/events)
/components          # shared UI primitives only
/modules             # all standalone modules live here
/shared              # shared types/helpers (import-only contracts)
```

### Allowed in `/app`
- Route components that render module pages
- API forwarders to module routers
- No business logic

---

## 2. Import Boundaries (Hard Rules)

### 2.1 Kernel Allowed Imports
Kernel may import:
- `/shared/**`
- `/modules/**` ONLY for module registration types and `init()` function (no deep imports)
- External libs

Kernel must NOT import:
- module internal files (services/components) directly
- app routes from modules

### 2.2 Module Allowed Imports
A module may import:
- `/shared/**`
- its own module files (`/modules/<name>/**`)
- injected dependencies (db, auth, eventBus, config) passed at runtime
- external libs

A module must NOT import:
- `/app/**`
- `/lib/**` (kernel internals)
- other modules' internal code (`/modules/<other>/**`)
- server-only secrets directly (must be provided via config injection)

### 2.3 Shared Allowed Imports
`/shared/**` may import:
- other `/shared/**`
- external libs
Must NOT import:
- `/app/**`, `/lib/**`, `/modules/**`

---

## 3. Route Mount Patterns (Enforced)

Modules do not create Next.js routes directly in `/app`.
Kernel provides mount points.

### 3.1 API Mount Pattern (Required)
For each module named `<module>`:

```
/app/api/<module>/[...path]/route.ts
```

This file MUST:
- authenticate (if required)
- build PermissionContext
- forward request to module router:
  - `modules/<module>/server/router.handle(req, ctx, deps)`

No other API routes are allowed for module APIs.

### 3.2 UI Entry Pattern (Required)
For each module named `<module>`:

Seller-facing:
```
/app/(seller)/<module>/*
```

Owner-scoped (delegated mode):
```
/app/(business)/[ownerUserId]/<module>/*
```

These pages MUST:
- resolve actor session
- pass owner scope parameter (if present)
- render module-provided React pages/components via stable entry export:
  - `modules/<module>/ui/entry`

No business logic in `/app` pages.

---

## 4. Dependency Injection Contract (Required)

Modules MUST receive all privileged capabilities via injection.

### 4.1 Kernel Injected Dependencies
```ts
KernelDeps {
  db: PrismaClient
  auth: {
    getSession(req): Promise<Session | null>
  }
  context: {
    buildAuthContext(session, ownerUserId?): AuthContext
  }
  eventBus: EventBus
  audit: {
    write(event): Promise<void>
  }
  config: {
    get(key): string | number | boolean | object | undefined
  }
  clock: {
    now(): Date
  }
}
```

### 4.2 Module API Surface
Each module exposes an initializer and optional router/ui exports.

```ts
TwicelyModule {
  name: string
  version: string
  init(deps: KernelDeps): Promise<void> | void

  // Optional:
  router?: {
    handle(req: Request, ctx: AuthContext, deps: KernelDeps): Promise<Response>
  }

  ui?: {
    SellerEntry?: ReactComponent
    OwnerScopedEntry?: ReactComponent
  }

  events?: {
    subscriptions: string[] // event names it listens to
  }
}
```

### 4.3 Forbidden
Modules may NOT:
- instantiate Prisma
- read raw env secrets (must use deps.config)
- create their own auth session resolver
- bypass audit logging rules

---

## 5. Module Registry (Required)

Kernel registers modules in one place.

### 5.1 Registry File
`/lib/modules.ts`

### 5.2 Registry Responsibilities
- Imports each module's **top-level entry only**:
  - `import studio from "@/modules/studio"`
- Initializes enabled modules at startup
- Provides route forwarding map:
  - `moduleName -> router.handle`
- Provides feature flags:
  - enable/disable modules safely

### 5.3 Feature Flag Rules
- Flags are config-driven
- Disabling a module:
  - hides UI entry routes
  - returns 404 for API mounts
  - does not break kernel

---

## 6. Event Bus Contract (Required)

Modules communicate through events, not imports.

### 6.1 Event Bus Interface
```ts
EventBus {
  emit(name: string, payload: any): Promise<void>
  on(name: string, handler: (payload: any) => Promise<void> | void): void
}
```

### 6.2 Event Naming Convention
Use dotted namespaces:
- `payment.paid`
- `payment.refund.completed`
- `listing.sold`
- `order.fulfilled`
- `account.staff.invited`

### 6.3 Rules
- Events must be documented and versioned if payload changes
- Handlers must be idempotent where appropriate
- Event publishing must not throw uncaught exceptions back into request path (use safe dispatch)

---

## 7. Lint & CI Enforcement (Hard Requirements)

### 7.1 ESLint Import Boundary Rules
Enforce with `eslint-plugin-boundaries` or `eslint-plugin-import` restrictions.

#### Example rules (conceptual)
- Modules cannot import `app/**` or `lib/**`
- Shared cannot import `modules/**`, `app/**`, `lib/**`
- App cannot import deep module internals beyond `modules/<name>/ui/entry` and `modules/<name>/server/router`

### 7.2 TypeScript Path Aliases
Define stable aliases to prevent path hacks:
- `@/shared/*`
- `@/modules/*`
- `@/lib/*`

Then restrict usage by folder.

### 7.3 CI Checks (Required)
- `lint` must run on every PR
- `typecheck` must run on every PR
- A boundary rule violation fails CI

---

## 8. Allowed Exceptions (Very Limited)

Exceptions must be explicit and rare.

### 8.1 Module Top-level Entry
Kernel may import:
- `modules/<name>/index.ts` only

### 8.2 UI Shared Primitives
Modules may import shared UI primitives from `/components` ONLY if:
- they are purely presentational
- they do not contain business logic
- they do not import kernel internals

If this becomes messy, move UI primitives into `/shared/ui`.

---

## 9. Anti-Patterns (Forbidden)

- X "Quick fix" calling Prisma directly from `/app`
- X Module importing another module's services
- X Module importing `/lib/*`
- X Module reading `process.env.*` directly
- X Adding random APIs outside the mount pattern
- X Silent permission bypass (no AuthContext)

---

## 10. Acceptance Checklist

- [ ] No module imports `/app/**`.
- [ ] No module imports `/lib/**`.
- [ ] No module imports other module internals.
- [ ] `/app` contains only UI entry + API forwarders.
- [ ] All module APIs go through `/app/api/<module>/[...path]`.
- [ ] All module UI goes through `/app/(seller)/<module>` and `/app/(business)/[ownerUserId]/<module>`.
- [ ] All privileged deps are injected (db/auth/eventBus/audit/config).
- [ ] CI fails on boundary violations.

---

## VERSION
- **v1.0 - Kernel + modules enforcement baseline**
- Date locked: 2026-01-17
