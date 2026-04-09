# STRICT PHASE INSTALLATION PROTOCOL

## ⛔ STOP - READ THIS BEFORE EVERY PHASE

Previous installations failed because you:
1. Started coding before reading the full spec
2. Created files with names YOU invented instead of what the spec says
3. Wrote implementations from your head instead of copying from spec
4. Skipped sections of the spec

**THIS ENDS NOW.**

---

## MANDATORY PRE-CODING CHECKLIST

Before writing ANY code for Phase N, you MUST complete these steps IN ORDER:

### Step 1: Read the ENTIRE Phase Spec
```bash
# Read the COMPLETE spec file - every line
view rules/install-phases/TWICELY_V2_INSTALL_PHASE_N_*.md
```
**Output to user:** "I have read the Phase N spec. It contains X sections: [list them]"

### Step 2: List ALL Files the Spec Says to Create
Before coding, extract from the spec:
- Every Prisma model to add
- Every file path mentioned (EXACT paths)
- Every function/class name mentioned

**Output to user:** 
```
Files to create per spec:
1. [exact path from spec] - [what it contains]
2. [exact path from spec] - [what it contains]
...
```

### Step 3: Read ALL Referenced Canonicals
The spec header lists canonicals. Read EACH ONE completely:
```bash
view rules/canonicals/[CANONICAL_NAME].md
view rules/locked/[LOCKED_NAME].md
```

### Step 4: User Confirms Before Coding
**Ask the user:** "I have read all specs. Here are the files I will create: [list]. Proceed?"

---

## DURING CODING - ABSOLUTE RULES

### Rule A: File Names Come From Spec ONLY
❌ WRONG: You decide `analyticsHealthProvider.ts` sounds good
✅ RIGHT: Spec says `packages/core/health/providers/analytics.ts` → create that EXACT path

### Rule B: Copy Code Blocks CHARACTER-FOR-CHARACTER
When the spec shows:
```ts
export const analyticsHealthProvider: HealthProvider = {
  id: "analytics",
  label: "Analytics & Metrics",
```

You write EXACTLY that. Not:
```ts
export const analyticsProvider: HealthProvider = {  // WRONG - changed name
  id: "analytics-service",  // WRONG - changed id
```

### Rule C: If Spec Doesn't Show It, Don't Create It
- Spec shows 5 files → create 5 files
- Spec shows 3 Doctor checks → implement 3 Doctor checks
- Don't add "helpful" extras

### Rule D: Show Your Work
After creating each file, show:
```
Created: [path]
- Copied from spec section: [section number/name]
- Contains: [brief description]
```

---

## POST-CODING VERIFICATION

### Step 5: File-by-File Spec Comparison
For EACH file created:
```
File: [path]
Spec says: [quote from spec]
I created: [what you created]
Match: YES/NO
```

### Step 6: Run Doctor
```bash
pnpm doctor
```

### Step 7: Report to User
```
Phase N Complete:
- Files created: [list with paths]
- Doctor checks: X passing
- Any deviations from spec: [list or "NONE"]
```

---

## COMMON VIOLATIONS TO AVOID

| Violation | Example | Correct Approach |
|-----------|---------|------------------|
| Invented file names | `ordersHealthProvider.ts` | Use spec's exact path: `orders.ts` |
| "Improved" field names | `userId` → `user_id` | Copy exactly from spec |
| Added extra files | Created README.md | Only create what spec lists |
| Skipped spec sections | Didn't create UI pages | Create EVERYTHING in spec |
| Changed IDs | `id: "order-service"` | Use spec's exact ID: `id: "orders"` |

---

## IF YOU'RE UNSURE

1. **Re-read the spec section** - the answer is there
2. **Quote the spec to the user** - "The spec says X, should I do X?"
3. **DO NOT GUESS** - ask for clarification

---

## ENFORCEMENT

After each phase, I (the user/reviewer) will audit:
1. Every file name matches spec exactly
2. Every implementation matches spec code blocks
3. No extra files were created
4. No spec files were skipped

**If violations are found, the phase will be rejected and you must redo it.**

---

## START OF EACH PHASE

Copy-paste this to Claude Code:

```
Start Phase [N]. 

BEFORE WRITING ANY CODE:
1. Read the ENTIRE spec file from line 1 to the end
2. List ALL files the spec says to create (with exact paths)
3. Read ALL canonicals referenced in the spec header
4. Tell me what you're about to create and wait for my confirmation

DURING CODING:
- Copy code from spec CHARACTER-FOR-CHARACTER
- Use EXACT file paths from spec
- Create ONLY what the spec lists

After completion, show me:
- List of files created (with paths)
- Doctor check count
- Any deviations from spec (should be NONE)
```
