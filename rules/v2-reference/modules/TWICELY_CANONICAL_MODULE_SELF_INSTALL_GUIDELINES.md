# TWICELY — CANONICAL MODULE BUILD + SELF-INSTALL GUIDELINES (v1)

Use this document as the **single source of truth** when building ANY Twicely module (Studio, Shipping, Promotions, Live, Accounting, etc.).  
It is written as **instructions for an AI code assistant or engineer**. Follow it exactly.

---

## 0) Definitions

**Host App**: the main Twicely application (Next.js + Prisma + Better Auth + RBAC).  
**Module**: a package that adds features without breaking or rewriting the host.  
**Self-Install**: a module can **copy/wire** required files and **validate** prerequisites, but must **NOT** run destructive operations.

---

## 1) Non-Negotiables (Hard Rules)

A module MUST NOT:

1. **Modify `prisma/schema.prisma`** (no string appends, no edits, no merges).
2. Run any DB command automatically:
   - `prisma db push`
   - `prisma migrate dev/deploy`
   - drop/reset DB
3. Delete, rename, or overwrite existing host routes, slugs, or fields.
4. Overwrite RBAC roles/permissions. (**Merge/add only**.)
5. Introduce a third access system. Use **Twicely Platform RBAC** and/or **Business RBAC**.
6. Assume auth/session works without host adapters. Don't invent auth helpers.
7. Hide failures. If something is missing, **fail gracefully** with clear diagnostics.

A module MUST:

- Be **idempotent** (safe to run install/register multiple times).
- Provide a **Doctor/Health Check**.
- Use **host adapters** for Auth/RBAC/DB.
- Keep all changes scoped to module-owned files.

---

## 2) Canonical Architecture

Every module uses **three layers**:

### A) Core (Pure module logic)
- business rules
- domain types (imported from Twicely shared types, never re-created)
- services and helpers

### B) Integration (Host adapters)
- Auth adapter (`getSession(req)` etc.)
- RBAC adapters (platform + business)
- DB client (Prisma from host)
- logging + config

### C) Surface (UI + routes)
- Admin pages
- API routes
- public components
- jobs/cron hooks (if needed)

**Never let Surface or Integration leak back into Core.**

---

## 3) Folder Structure (Required)

All modules must follow this structure (or a close equivalent):

```
@twicely/<module-name>/
  package.json
  README.md
  src/
    index.ts                # init + exports
    register.ts             # idempotent setup (RBAC, seeds)
    doctor.ts               # health checks
    adapters/               # types + default adapter contracts
    core/                   # domain logic (no Next.js imports here)
    api/                    # route handlers (if module provides handlers)
    ui/                     # components + admin pages
    policy/                 # access rules, feature gates, locks
    registry/               # component registry (if builder-like module)
  routes/                   # OPTIONAL: files that may be copied into host
  migrations/               # OPTIONAL: sql files (idempotent only)
  scripts/
    install.js              # safe route copier + manifest
    uninstall.js            # optional, uses manifest
```

---

## 4) Init / Register / Doctor Contract (Required)

### `initTwicely<Module>(options)`
- stores adapters/config in module runtime
- does **not** modify host files
- does **not** touch DB unless called by register()

### `register()`
Idempotent setup steps (safe to run repeatedly):
- ensure required RBAC permission keys exist (merge-only)
- ensure default records exist (templates, settings, etc.)
- ensure module config rows exist
- never remove or overwrite existing data

### `doctor()`
Returns a structured report:
- missing tables
- missing env vars
- missing routes
- missing permissions
- version mismatch warnings
- recommended commands to run

Doctor should power an Admin page:  
`/admin/modules/<module>/doctor` (or equivalent)

---

## 5) Self-Install: Safe and Canonical

Self-Install means **copy + validate + instruct**, not "take over".

### 5.1 Installer script responsibilities (SAFE)
`scripts/install.js` may:
- detect host project root and verify it looks like Twicely
- copy module-provided routes into approved host locations
- create a module manifest: `./.twicely/modules/<module>.installed.json`
- print next steps (migrations/env)
- support `--dry-run` to preview changes
- support `--force` to overwrite module-owned files only

Installer must never:
- edit host Prisma schema
- run migrations
- run DB commands
- delete host files
- overwrite non-module files

### 5.2 Manifest (Required)
The installer must write a manifest containing:
- module name + version
- files created/copied (destination paths)
- timestamp
- install options used (dry-run/force)
- rollback instructions

Example path:
`.twicely/modules/studio.installed.json`

### 5.3 Uninstall (Optional but recommended)
If provided, uninstall must:
- read manifest
- delete ONLY the files it created
- never touch DB

---

## 6) Database Rules

### 6.1 Safe DB shipping
A module may ship:
- `migrations/*.sql` containing only **idempotent** SQL:
  - `CREATE TABLE IF NOT EXISTS`
  - `CREATE INDEX IF NOT EXISTS`
  - additive columns only (no drops)
- optional Prisma schema fragment as reference

### 6.2 Applying DB changes (Host-owned)
DB changes are applied by the host repo's standard workflow.  
The module should guide the admin via Doctor:
- "Apply migration X"
- "Run command Y"

Never auto-migrate by default.

If you support "assisted migrate," it must be gated behind:
- `TWICELY_ALLOW_MODULE_DB_WRITE=true`
and must still never drop data.

---

## 7) RBAC Rules (Critical)

Twicely has two RBAC contexts:

### 7.1 Platform RBAC (Twicely staff)
Use for:
- platform admin pages
- platform content editing
- platform module settings

Module must:
- add new permission keys (merge-only)
- attach defaults to system roles (SUPER_ADMIN, ADMIN, etc.) if they exist
- never overwrite a role's existing permissions

### 7.2 Business RBAC (seller business staff)
Use for:
- seller-facing module features
- store editing
- staff access restrictions

Module must:
- add permission keys (merge-only)
- ensure default business roles exist (OWNER/ADMIN/STAFF/VIEWER) if missing
- never remove privileges from existing roles

### 7.3 Access Pattern
All routes/components must check access via adapters:

- `platformRbac.can(user, "perm")`
- `businessRbac.can(context, "perm")`

No direct DB reads for permissions in UI code unless routed through adapters.

---

## 8) Auth Rules

All auth/session resolution must be done through a host-provided adapter:

- `auth.getSession(req)` for route handlers
- `auth.getUser()` (optional helper) for server components

Module must not assume cookie parsing or request context works by default.

---

## 9) UI Rules

Modules must follow Twicely UI system:
- Tailwind + Shadcn UI components
- Lucide icons
- Twicely tokens/colors
- consistent admin shell patterns (cards, badges, tables, toolbars)

If module includes an editor/builder (like Studio), it must:
- have a single shared registry (editor + renderer)
- support policy-driven gating (locked blocks/features)
- provide stable preview rendering (no config mismatch)

---

## 10) Logging + Error Handling

- All failures must be actionable:
  - show what is missing
  - show where it is missing
  - show the next command/step
- Avoid silent fallbacks that render blank pages.
- Use structured error codes in API responses.

---

## 11) Canonical Build Checklist (AI must satisfy)

Before calling a module "done":

### Install Safety
- [ ] install script supports `--dry-run`
- [ ] manifest is created
- [ ] install is idempotent
- [ ] uninstall (if present) only removes manifest files

### DB Safety
- [ ] no schema append
- [ ] no auto migration
- [ ] any SQL is additive + idempotent

### RBAC
- [ ] permissions registered (merge-only)
- [ ] Super Admin can always access platform module pages
- [ ] business roles default seed does not overwrite

### Auth
- [ ] route handlers can resolve session reliably via adapter
- [ ] no hardcoded session assumptions

### UI
- [ ] uses Shadcn/Tailwind patterns
- [ ] matches Twicely admin look/feel

### Doctor
- [ ] doctor report is accurate and visible to admins

---

## 12) Canonical AI Prompt Header (Copy/Paste)

Use this at the top of any AI task:

> You are building a Twicely module. Follow **TWICELY - CANONICAL MODULE BUILD + SELF-INSTALL GUIDELINES** exactly.  
> Non-negotiables: no Prisma schema edits, no db push/migrate, no DB resets, RBAC merge-only, adapters for auth/RBAC, provide doctor + register, installer uses manifest and supports dry-run.  
> If something is missing, fail gracefully and surface it via Doctor.

---

## FINAL RULE

If a module decision conflicts with Twicely's:
- schema rules
- RBAC rules
- UI system
- security rules

**Twicely wins. The module adapts.**

END OF FILE
