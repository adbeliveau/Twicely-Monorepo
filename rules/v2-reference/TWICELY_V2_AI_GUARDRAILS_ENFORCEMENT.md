# TWICELY V2 — AI GUARDRAILS & ENFORCEMENT PROTOCOL
**Status:** LOCKED (v1.0)  
**Authority:** OVERRIDES all other guidance when conflict exists  
**Scope:** Every AI agent (Claude Code, Cursor, Copilot, ChatGPT, etc.)  
**Purpose:** Prevent drift, invention, skipping, and silent deviation during implementation  

> **Place this file in:** `/rules/TWICELY_V2_AI_GUARDRAILS_ENFORCEMENT.md`  
> **This file must be read BEFORE any code is written. Period.**

---

## WHY THIS EXISTS

Previous implementations suffered from:

1. **Field name invention** — AI renamed `sellerId` to `sellerUserId`, `priceCents` to `priceInCents`, etc.
2. **Silent feature invention** — AI added fields, enums, models not in any spec
3. **Spec skipping** — AI implemented phases without reading the phase doc
4. **Partial implementation** — AI built schema but skipped services, health providers, doctor checks, or UI
5. **Unauthorized refactoring** — AI "improved" locked patterns without permission
6. **False completion claims** — AI reported "100% complete" while 15+ phases had zero implementation

**These guardrails exist because "please read the instructions" was not enough.**

---

## SECTION 1: MANDATORY PRE-FLIGHT CHECKLIST

### Before writing ANY code for ANY phase, the AI MUST complete ALL of these steps. No exceptions.

```
┌─────────────────────────────────────────────────────────────┐
│  PRE-FLIGHT CHECKLIST (complete in order, skip nothing)     │
│                                                             │
│  □ 1. Read the phase install doc cover to cover             │
│  □ 2. Read every canonical referenced by the phase doc      │
│  □ 3. Read the relevant locked behavioral spec (if any)     │
│  □ 4. List EVERY file you will create/modify (full paths)   │
│  □ 5. List EVERY model, enum, field you will add to schema  │
│  □ 6. List EVERY API route with its HTTP method              │
│  □ 7. List EVERY UI page with its URL path                  │
│  □ 8. Identify the health provider key for this phase       │
│  □ 9. Identify the doctor checks for this phase             │
│  □ 10. STOP and present this list for human approval        │
│       DO NOT write code until approval is received          │
└─────────────────────────────────────────────────────────────┘
```

### How to Present the Pre-Flight

Output this EXACT format before any implementation:

```markdown
## PRE-FLIGHT: Phase [N] — [Name]

### Spec Documents Read:
- [ ] /rules/TWICELY_V2_INSTALL_PHASE_[N]_[NAME].md
- [ ] /rules/canonicals/[RELEVANT_CANONICAL].md
- [ ] /rules/locked/[RELEVANT_LOCKED_SPEC].md (if applicable)

### Files to Create/Modify:
1. prisma/schema.prisma (additive: [list models])
2. packages/core/[domain]/types.ts
3. packages/core/[domain]/service.ts
4. apps/web/app/api/[routes]/route.ts
5. packages/core/health/providers/[phase]HealthProvider.ts
6. packages/core/doctor/checks/phase[N].ts
7. apps/web/app/(corp)/[pages]/page.tsx
8. [etc.]

### Schema Changes:
- Models: [list each model with key fields]
- Enums: [list each enum with values]
- New fields on existing models: [list each]

### API Routes:
- GET  /api/[path] — [purpose]
- POST /api/[path] — [purpose]
- [etc.]

### UI Pages:
- /corp/[path] — [purpose]
- /seller/[path] — [purpose]
- [etc.]

### Health Provider: [key]
### Doctor Checks: [list check IDs]

**Awaiting approval before implementation.**
```

**If the AI skips this step and jumps straight to code: REJECT THE OUTPUT.**

---

## SECTION 2: CHARACTER-FOR-CHARACTER RULE

### The Spec Is the Code. The Code Is the Spec.

When a phase document provides code (schema, TypeScript, API routes):

| Spec Provides | AI Must Do |
|---|---|
| Prisma model with field names | Copy field names EXACTLY — do not rename |
| Enum with values | Copy values EXACTLY — do not add/remove/rename |
| TypeScript type definition | Copy the type EXACTLY |
| API route path | Use that EXACT path |
| Service function signature | Use that EXACT signature |
| Doctor check IDs | Use those EXACT IDs |
| Health provider key | Use that EXACT key |
| UI page path | Use that EXACT path |

### FORBIDDEN Actions (Automatic Rejection)

| Action | Example | Why It's Wrong |
|---|---|---|
| Rename a field | `sellerId` → `sellerUserId` | Breaks all downstream references |
| Change a type | `Int` → `Float` for cents | Violates money-in-cents invariant |
| Add a field not in spec | Adding `description` to a model | Unauthorized invention |
| Remove a field from spec | Skipping `suspendedReason` | Incomplete implementation |
| Change an enum value | `SELLER_ACTIVE` → `ACTIVE` | Breaks state machine contracts |
| Add an enum value | Adding `SELLER_ON_HOLD` | Unauthorized state |
| Rename a route | `/api/returns` → `/api/return-requests` | Breaks API contracts |
| Change function signature | Adding optional params | Unauthorized interface change |
| "Improve" code patterns | Changing error handling style | Unauthorized refactoring |
| Use different library | Switching from Prisma to Drizzle | Unauthorized tech change |

### The Only Exception

If the spec has an **obvious typo** (e.g., `funciton` instead of `function`), fix the typo and document it:

```
// TYPO FIX: Spec says "funciton", corrected to "function"
```

---

## SECTION 3: IMPLEMENTATION ORDER (NON-NEGOTIABLE)

Every phase MUST be implemented in this exact order. Do not skip steps. Do not reorder.

```
STEP 1: SCHEMA
  → Add models/enums to prisma/schema.prisma
  → Run: npx prisma generate (verify no errors)
  → Run: npx prisma db push (or migrate dev)

STEP 2: TYPES
  → Create TypeScript types in packages/core/[domain]/types.ts
  → Types MUST mirror Prisma exactly

STEP 3: SERVICES
  → Create business logic in packages/core/[domain]/service.ts
  → Services use Prisma client directly
  → All state changes go through state machine helpers
  → All money operations use cents (Int, never Float)

STEP 4: API ROUTES
  → Create Next.js route handlers in apps/web/app/api/
  → Every route checks auth (getSessionUserId)
  → Every corp route checks platform RBAC
  → Every seller route checks ownership or delegation

STEP 5: HEALTH PROVIDER
  → Create provider in packages/core/health/providers/
  → Register in health provider registry
  → Provider returns PASS/WARN/FAIL/UNKNOWN

STEP 6: DOCTOR CHECKS
  → Create checks in packages/core/doctor/checks/phase[N].ts
  → Each check has a unique ID matching the spec
  → Checks are read-only (no mutations)

STEP 7: UI PAGES
  → Create pages in apps/web/app/(corp)/ or (seller)/
  → Pages use RBAC gating
  → Pages call API routes (not services directly)

STEP 8: VERIFICATION
  → Run: npx next build (zero TypeScript errors)
  → Run: pnpm doctor --phase=[N] (all checks pass)
  → Run: pnpm doctor --all (no regressions)
```

**If any step fails: FIX IT before moving to the next step. Do not proceed with broken steps behind you.**

---

## SECTION 4: SCHEMA GUARDRAILS

### 4.1 Before Touching schema.prisma

```
□ I have read the phase doc's "Prisma schema" section completely
□ I have cross-checked field names against the canonical
□ I have verified no model with this name already exists
□ I have verified no enum with this name already exists
□ I will NOT rename any field from what the spec says
□ I will NOT change any field type from what the spec says
□ I will NOT add fields not in the spec
□ I will NOT remove fields that are in the spec
```

### 4.2 Existing Model Rules

| Scenario | Rule |
|---|---|
| Phase spec adds fields to User | Add ONLY the listed fields. Touch NOTHING else. |
| Phase spec references a model from a prior phase | Do NOT recreate it. Use the existing model. |
| Phase spec says "additive" | You may ONLY add. You may NOT modify or remove. |
| Two specs define the same field differently | STOP. Report the conflict. Do not guess. |

### 4.3 Money Fields (Absolute Rule)

```
ALL monetary values MUST be:
  - Type: Int
  - Name ends with: Cents (e.g., priceCents, totalCents, feeCents)
  - Stored as: integer cents (e.g., $19.99 = 1999)
  - NEVER: Float, Decimal, or bare "price" without "Cents"
```

### 4.4 Ownership Fields (Absolute Rule)

```
ALL ownership MUST resolve to userId:
  - sellerId references User.id (it IS a userId)
  - buyerId references User.id (it IS a userId)
  - ownerUserId references User.id
  - NEVER: separate Seller/Buyer tables for identity
```

---

## SECTION 5: API ROUTE GUARDRAILS

### 5.1 Route Authentication (Every Route, No Exceptions)

```typescript
// REQUIRED at the top of EVERY route handler
const userId = await getSessionUserId();
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 5.2 RBAC Enforcement

| Route Prefix | Required Check |
|---|---|
| `/api/corp/*` or `/api/platform/*` | `assertPlatformRole(userId, requiredRole)` |
| `/api/seller/*` | `assertSellerOwnerOrDelegate(userId, sellerId, requiredScope)` |
| `/api/buyer/*` | `assertAuthenticatedUser(userId)` |
| `/api/public/*` | No auth required (but rate limit) |

### 5.3 Response Envelope (Standard)

```typescript
// Success
return NextResponse.json({ data: result });

// Error
return NextResponse.json({ error: "Description" }, { status: 4xx });

// List
return NextResponse.json({ data: items, total, page, pageSize });
```

### 5.4 Forbidden Patterns in Routes

| Pattern | Why It's Forbidden |
|---|---|
| Direct Prisma calls in route handler | Business logic belongs in services |
| `try/catch` that silently swallows errors | Errors must be surfaced |
| Returning full Prisma objects to client | Select only needed fields |
| Hardcoded user IDs or roles | Use session + RBAC |
| `any` type on request body | Type everything |

---

## SECTION 6: STATE MACHINE GUARDRAILS

### No Ad-Hoc Status Changes. Ever.

```typescript
// ✅ CORRECT — Use state machine transition
const newStatus = applyTransition(currentStatus, "SHIP", actor);

// ❌ FORBIDDEN — Direct status assignment
await prisma.order.update({
  where: { id: orderId },
  data: { status: "SHIPPED" }  // NEVER DO THIS
});
```

### Required for Every State Change

```
□ Transition is defined in the canonical state machine
□ Actor has permission for this transition
□ AuditEvent is created with actorUserId, fromState, toState, reasonCode
□ Transition is idempotent (re-applying same transition = no-op)
```

---

## SECTION 7: HEALTH PROVIDER & DOCTOR GUARDRAILS

### 7.1 Every Phase MUST Register a Health Provider

```
If you implement a phase and do NOT create a health provider:
→ THE PHASE IS NOT COMPLETE
→ You have failed the implementation
```

### 7.2 Health Provider Contract (Exact)

```typescript
export interface HealthProvider {
  id: string;          // e.g., "returns_disputes"
  label: string;       // e.g., "Returns & Disputes"
  phase: number;       // e.g., 14
  run(): Promise<HealthResult>;
}

export interface HealthResult {
  providerId: string;
  status: "PASS" | "WARN" | "FAIL" | "UNKNOWN";
  summary: string;
  checks: HealthCheckResult[];
}

export interface HealthCheckResult {
  id: string;          // e.g., "returns.model_exists"
  label: string;       // e.g., "ReturnRequest model exists"
  status: "PASS" | "WARN" | "FAIL";
  message?: string;
}
```

### 7.3 Doctor Checks Are READ-ONLY

```
Doctor checks MUST NOT:
  - Create data
  - Modify data
  - Delete data
  - Run migrations
  - Fix problems

Doctor checks MUST ONLY:
  - Read data
  - Verify existence
  - Validate state
  - Report status
```

---

## SECTION 8: UI PAGE GUARDRAILS

### 8.1 Every Admin Page MUST Have RBAC

```typescript
// REQUIRED at the top of every /corp/ page
const user = await getCurrentUser();
if (!user || !hasRole(user, "ADMIN")) {
  redirect("/unauthorized");
}
```

### 8.2 Every Seller Page MUST Check Ownership

```typescript
// REQUIRED at the top of every /seller/ page
const user = await getCurrentUser();
const profile = await getSellerProfile(user.id);
if (!profile) {
  redirect("/seller/onboarding");
}
```

### 8.3 Forbidden UI Patterns

| Pattern | Rule |
|---|---|
| Client-side auth checks only | Server-side RBAC is REQUIRED |
| Direct Prisma in page component | Call API routes or server actions |
| Hardcoded tiers/prices in UI | Read from settings/config |
| `console.log` of sensitive data | Never log PII, tokens, or keys |

---

## SECTION 9: COMPLETION CRITERIA (What "Done" Actually Means)

### A phase is NOT complete until ALL of these are true:

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE COMPLETION CHECKLIST                                 │
│                                                             │
│  □ Schema models migrated and Prisma generated              │
│  □ TypeScript types created and aligned with schema         │
│  □ Service layer created with business logic                │
│  □ API routes created with auth + RBAC                      │
│  □ Health provider created and registered                   │
│  □ Doctor checks created with spec-matching IDs             │
│  □ UI pages created (corp, seller, and/or buyer)            │
│  □ Seed data added (if phase requires it)                   │
│  □ `npx next build` passes with zero errors                 │
│  □ `pnpm doctor --phase=[N]` all checks PASS               │
│  □ `pnpm doctor --all` no regressions                      │
│  □ No invented fields/enums/models                          │
│  □ No renamed fields/enums/models                           │
│  □ No skipped fields/enums/models                           │
│                                                             │
│  If ANY box is unchecked: PHASE IS NOT COMPLETE             │
└─────────────────────────────────────────────────────────────┘
```

### False Completion = Automatic Rejection

If the AI claims a phase is "complete" or "done" but:

- Missing health provider → **Rejected**
- Missing doctor checks → **Rejected**
- Missing UI pages listed in spec → **Rejected**
- Build has TypeScript errors → **Rejected**
- Fields renamed from spec → **Rejected**
- Models added not in spec → **Rejected**

---

## SECTION 10: FORBIDDEN PHRASES (Things the AI Must Never Say)

| Phrase | Why It's Forbidden | What to Say Instead |
|---|---|---|
| "I've improved the naming..." | You don't have permission to rename | "I copied the spec exactly" |
| "I added a helper field..." | You don't have permission to add | "I implemented only what the spec defines" |
| "This is essentially complete..." | Either it's complete or it isn't | "Here's what's done and what remains: [list]" |
| "I'll skip the health provider for now..." | Health providers are mandatory | "Health provider implemented" |
| "The UI can be added later..." | UI is part of the phase | "UI pages created per spec" |
| "I combined these into one..." | Don't merge what the spec separates | "Implemented separately as spec requires" |
| "I think this pattern is better..." | You're implementing, not designing | "Following spec pattern exactly" |
| "100% complete" | Only Doctor can confirm this | "Doctor checks passing, build clean" |

---

## SECTION 11: CONFLICT RESOLUTION

### When Specs Conflict

```
1. Check CORE_LOCK.md first (highest authority)
2. Check the relevant LOCKED behavioral spec
3. Check the canonical for the domain
4. Check the phase install doc
5. If still unclear: STOP and ask the human
```

### When the AI Is Uncertain

```
CORRECT: "The spec says X, but I'm not sure if this conflicts with Y. 
          Should I proceed with X or should we check?"

WRONG:   "I'll just go with what seems right."
WRONG:   (Silently picking one interpretation and hoping it's correct)
```

### Hierarchy of Authority

```
1. CORE_LOCK.md (highest — frozen invariants)
2. FREEZE_0_44_LOCKED.md (phase ordering)
3. LOCKED behavioral specs (state machines, payments, RBAC)
4. Domain canonicals (listings, orders, trust, etc.)
5. Phase install docs (implementation instructions)
6. AGENTS.md (AI entry point)
7. This guardrails doc (enforcement protocol)
```

---

## SECTION 12: POST-IMPLEMENTATION AUDIT PROTOCOL

### After completing a phase, the AI MUST run this self-audit:

```markdown
## POST-IMPLEMENTATION AUDIT: Phase [N]

### Schema Verification
- [ ] Every model in spec exists in schema.prisma
- [ ] Every field in spec exists with correct name and type
- [ ] Every enum in spec exists with correct values
- [ ] No extra models/fields/enums added beyond spec
- [ ] Prisma generate runs clean

### Service Verification
- [ ] Every service function in spec is implemented
- [ ] Function signatures match spec exactly
- [ ] State machine transitions match canonical
- [ ] Money calculations use Int cents

### Route Verification
- [ ] Every API route in spec exists
- [ ] Auth check present on every route
- [ ] RBAC check present on corp/seller routes
- [ ] Response format matches standard envelope

### Health & Doctor Verification
- [ ] Health provider registered with correct key
- [ ] Doctor checks match spec IDs
- [ ] All checks are read-only

### UI Verification
- [ ] Every page in spec exists at correct URL
- [ ] RBAC gating on every admin page
- [ ] Ownership check on every seller page

### Build Verification
- [ ] `npx next build` — zero errors
- [ ] `pnpm doctor --phase=[N]` — all PASS
- [ ] `pnpm doctor --all` — no regressions
```

---

## SECTION 13: EMERGENCY STOP CONDITIONS

### The AI MUST immediately stop and ask the human if:

1. **Two specs define the same thing differently** (e.g., different field names for same concept)
2. **A referenced canonical is missing** from the rules directory
3. **The schema has a breaking conflict** (e.g., model name collision)
4. **A dependency phase is not implemented** (e.g., Phase 14 needs Phase 4's PayoutHold)
5. **The build fails with errors the AI cannot resolve** in 2 attempts
6. **The AI is unsure whether something is in scope** for the current phase

### How to Stop

```
⚠️ GUARDRAIL STOP: [reason]

I've encountered [specific issue]. The spec says [X] but [Y].

Options:
A) [First option with tradeoffs]
B) [Second option with tradeoffs]
C) [Third option — e.g., skip and come back]

Which approach should I take?
```

---

## SECTION 14: QUICK REFERENCE CARD

Copy this into every implementation session:

```
═══════════════════════════════════════════════════════════════
TWICELY V2 — GUARDRAILS QUICK REFERENCE
═══════════════════════════════════════════════════════════════

BEFORE CODING:
  ✦ Read the phase doc cover to cover
  ✦ Read referenced canonicals
  ✦ Present file list for approval
  ✦ WAIT for approval

DURING CODING:
  ✦ Copy spec CHARACTER-FOR-CHARACTER
  ✦ Do NOT rename fields
  ✦ Do NOT add fields
  ✦ Do NOT skip fields
  ✦ Do NOT "improve" patterns
  ✦ Follow: Schema → Types → Services → Routes → Health → Doctor → UI

AFTER CODING:
  ✦ Run build (zero errors)
  ✦ Run doctor (all pass)
  ✦ Run self-audit checklist
  ✦ Report what's done and what remains

IF CONFUSED:
  ✦ STOP
  ✦ Describe the confusion
  ✦ Present options
  ✦ Wait for human decision

═══════════════════════════════════════════════════════════════
```

---

## VERSION HISTORY

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-02-01 | Initial guardrails document |

---

# END GUARDRAILS ENFORCEMENT PROTOCOL
