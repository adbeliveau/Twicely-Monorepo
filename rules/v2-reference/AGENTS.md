# AGENTS.md — Twicely V2 AI Entry Point
**Status:** REQUIRED • **Scope:** Entire repository • **Audience:** Any AI agent (ChatGPT / Claude / Copilot / Cursor / etc.)

This file is the **single entry point** for AI work in this repository.  
If you are an AI agent: **read this file first** and follow it exactly.

---

## 0) Prime Directive

You are not designing Twicely. You are **installing / implementing** Twicely V2 **exactly** as defined by the rules and canonicals.

- **Do not invent** schema, routes, roles, permissions, flows, or features.
- **Do not refactor** locked areas unless a canonical explicitly instructs it.
- If anything is unclear or missing: **STOP** and report what is missing.

---

## 1) Canonical Folder Structure (Authoritative)

Twicely V2 uses a split rules system:

```
/rules
  TWICELY_V2_CORE_LOCK.md
  TWICELY_V2_MASTER_AI_INSTALL_PROMPT.md
  TWICELY_V2_PROJECT_INSTRUCTIONS_CORE.md
  TWICELY_MARKETPLACE_INDEX_CANONICAL.md
  Twicely-Module-Installer-UI-Canonical-v1.md
  Twicely-Module-Runtime-Guards-Canonical-v1.md
  Twicely-AI-Module-Validation-Checklist-v1.md
  /canonicals
    ... (system canonicals)
    ... (install phase docs 0-43)
```

### Meaning
- `/rules/` (root) = **entry + governance** (what to read first, how to install, how to enforce)
- `/rules/canonicals/` = **system truth** (locked behavior specs + install phase specs)

**Canonicals override everything** (including this file) if conflicts exist.

---

## 2) Required Read Order (Strict)

Before writing or changing ANY code, the AI must read (in order):

1. `/rules/governance/TWICELY_V2_CORE_LOCK.md` (what is frozen / non-negotiable)
2. `/rules/TWICELY_V2_PROJECT_INSTRUCTIONS_CORE.md` (repo conventions and constraints)
3. `/rules/TWICELY_V2_MASTER_AI_INSTALL_PROMPT.md` (execution controller)
4. `/rules/governance/TWICELY_MARKETPLACE_INDEX_CANONICAL.md` (completeness manifest / canonical list)
5. **Module governance (required):**
   - `/rules/modules/Twicely-Module-Installer-UI-Canonical-v1.md`
   - `/rules/modules/Twicely-Module-Runtime-Guards-Canonical-v1.md`
   - `/rules/modules/Twicely-AI-Module-Validation-Checklist-v1.md`
6. `/rules/canonicals/**` (ALL canonicals referenced by the marketplace index)


### Hard Stop Rule
If any file referenced above is missing â†’ **STOP**.

---

## 3) Completeness Rule (No Missing Canonicals)

`/rules/TWICELY_MARKETPLACE_INDEX_CANONICAL.md` is the **manifest**.  
AI must verify that every file named in the manifest exists.

### Minimum verification checklist
- Marketplace index exists (root rules)
- All listed canonicals exist in `/rules/canonicals/` (or explicitly in `/rules/` if intended)
- All install phase docs 0â€“39 exist (and are readable)

If canonicals are missing or renamed, do not proceed.

---

## 4) Installation Philosophy (Backend-First, Deterministic)

For every phase/module:

1. **Schema first**
   - Update `prisma/schema.prisma` (additive unless phase says otherwise)
   - Run migration
2. **Types next**
   - Generate/align TypeScript types (must mirror Prisma)
3. **Core logic**
   - Implement in `/packages/core` (pure business logic)
4. **API routes**
   - Implement in `/apps/web/app/api/...` (or project's API location)
5. **Audit + Idempotency**
   - Any money/state/permission change must be auditable and idempotent where applicable
6. **Health provider**
   - Register provider checks
7. **Doctor checks**
   - Add checks for the phase/module
8. **UI last**
   - Add minimal UI pages/menus (RBAC gated)
9. **Verify**
   - Run Doctor; fix failures; only then proceed

---

## 5) Non-Negotiable Invariants (Summary)
These are enforced by canonicals. If anything violates these, STOP.

### Ownership
- **UserId-only ownership** (single ownership primitive)

### Authorization
- RBAC + delegated access model only
- Only SUPER_ADMIN can grant/create SUPER_ADMIN

### State Machines
- No ad-hoc status changes
- Order/listing/payment states must follow canonical state machines

### Money
- "Paid" status comes from provider/webhook processing only
- Ledger is internal truth and immutable
- Reconciliation never mutates ledger
- Payouts derived from ledger and blocked by holds/verification

### Search & Trust
- Restricted sellers are hard-excluded
- New sellers protected via cap-only rules (no demotion for low volume)

### Ops
- Provider-driven System Health
- Doctor gates phase progress
- Module registry must reflect install/health status

---

## 6) Module System Governance (Required Even if Not Installing New Modules Yet)

These files define how module install/update/uninstall and runtime safety work:
- Module Installer UI canonical
- Runtime Guards canonical
- AI Module Validation Checklist

**Rule:** Any module (including "core modules") must:
- declare manifest metadata (if your system uses manifests)
- register health provider keys
- pass doctor checks
- obey runtime guards (no kernel boundary violations)

### Example: provider registration (pattern)
```ts
// packages/core/health/registry.ts
export interface HealthProvider {
  key: string;
  run(): Promise<{ status: "ok" | "warn" | "fail"; checks: Array<{ key: string; ok: boolean; details?: string }> }>;
}

const providers: HealthProvider[] = [];
export function registerProvider(p: HealthProvider) { providers.push(p); }
export function listProviders() { return providers; }
```

---

## 7) Doctor Contract (Must Exist + Must Gate Progress)

Doctor is the enforcement mechanism. A phase is "installed" only when Doctor passes.

### Example: doctor result shape
```ts
export type DoctorResult = {
  ok: boolean;
  checks: Array<{ key: string; ok: boolean; details?: string }>;
};
```

### Hard Stop Rule
If Doctor fails â†’ **STOP** and fix. Do not continue phases.

---

## 8) Repo Boundaries (Kernel vs Modules)

Respect kernel/module enforcement. If a canonical says "no cross-imports" or "module boundaries," you must obey.

### Example: boundary guard (pattern)
```ts
// Pseudocode: lint/build-time rule
// - packages/core cannot import from apps/web
// - modules cannot import from kernel-private paths
```

If you discover boundary violations in existing code, do not refactor without explicit canonical instruction—report it.

---

## 9) How to Proceed (Operational Playbook)

When asked to install or implement:

1. Confirm required files exist (marketplace index + canonicals + phases)
2. Start at Phase 0 and proceed sequentially
3. After each phase:
   - migrate
   - seed (if phase requires)
   - run doctor
   - run health console check
4. Never skip forward

---

## 10) If Something Is Missing or Conflicts

When you hit missing/conflict:
- Do not guess
- Do not "patch" canonicals
- Do not proceed
- Output a short report:

```md
## BLOCKER REPORT
- Missing file: <n>
- Expected location: <path>
- Why it blocks: <reason>
- Suggested fix: <minimal fix>
```

---

## 11) Forbidden Scope (Twicely V2)

Do NOT implement these unless a new canonical phase explicitly adds them:
- Studio / page builder
- Cross-lister
- AI content generation modules
- Real-time chat sockets (unless explicitly phased in)

---

# END AGENTS.md
