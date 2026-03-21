# /project:audit — Super Audit V2 (11 Streams + Self-Healing Fix Loop)

Run a comprehensive codebase audit using 11 streams. Combines agent-based
code reading with deterministic shell checks. Optional `fix` mode auto-repairs
issues using the install-prompt-writer + install-executor + build-error-resolver
agent chain, then re-audits until clean.

**Input:** `$ARGUMENTS` (optional)

| Argument | Behavior |
|---|---|
| _(empty)_ or `full` | Run all 11 streams in parallel |
| `1`-`11` or stream name | Run only that stream |
| `diff` | Run all 11 streams, filter to files changed since last commit |
| `diff main` | Filter to files changed vs `main` branch |
| `quick` | Run only shell-based streams (5, 7, 8, 9, 10a, 11) — fast, deterministic |
| `fix` | **Self-healing mode** — scan, auto-fix, re-audit until clean (max 3 rounds) |
| `fix quick` | Fix mode using only shell streams for faster iteration |

---

## Stream Map

| # | Name | Method | What it catches |
|---|---|---|---|
| 1 | `routes` | Agent | Missing pages, wrong route prefixes, 404 links |
| 2 | `auth` | Agent | Missing authorize(), CASL gaps, session leaks |
| 3 | `hardcoded` | Agent | Magic numbers that should be platform_settings |
| 4 | `nav` | Agent | Broken nav links, wrong identifiers in hrefs |
| 5 | `money` | **Shell** | Banned terms, UX language, float math, hardcoded fees |
| 6 | `schema` | Agent | Schema drift, enum mismatches, wrong column types |
| 7 | `wiring` | **Shell** | Dead exports, unwired notifications, missing side effects |
| 8 | `stripe` | **Shell + Agent** | Missing reverse_transfer, webhook gaps, onboarding checks |
| 9 | `hygiene` | **Shell** | console.log, file sizes, dead code, import wiring |
| 10a | `smoke` | **Shell** | HTTP smoke tests — curl critical URLs, check status codes |
| 11 | `runtime` | **Shell** | XSS, eslint-disable, SSR crashes, cuid2 mismatches, broken hrefs, unguarded actions |
| _10b_ | _`e2e`_ | _Reserved_ | _Playwright browser tests (future)_ |

---

## Step 0: Read False Positives

Before launching any stream, read `.claude/audit/known-false-positives.md`.
When compiling the final report, **suppress** any finding that matches a known false positive.
Mark suppressed items in a collapsed section at the bottom.

---

## Step 1: Determine Scope

- **If `$ARGUMENTS` is `fix` or `fix quick`**: Enter self-healing mode (see Step 5 below).
- **If `$ARGUMENTS` is `diff` or `diff <branch>`**: Run `git diff --name-only <branch>...HEAD` (default: `HEAD~1`) to get changed files. Pass the file list to each stream so they only check those files.
- **If `$ARGUMENTS` is `quick`**: Skip streams 1-4, 6. Run only 5, 7, 8, 9, 10a, 11 via shell.
- **If `$ARGUMENTS` is a number or name**: Run only that stream.
- **Otherwise**: Run all 10 streams.

---

## Step 2: Launch Streams

**CRITICAL: Launch ALL agent streams as PARALLEL Agent tool calls in a SINGLE message.**
Use `subagent_type: "Explore"` with `model: "sonnet"` for each agent stream.
Each agent runs in background (`run_in_background: true`).

For shell streams (5, 7, 8, 9, 10a): run `bash twicely-audit.sh <stream>` via Bash tool.
Shell streams can run in parallel with agent streams.

### Stream 1: Routes & Pages (Agent)

```
THOROUGHNESS: very thorough

AUDIT STREAM 1: Routes & Pages Completeness

1. Read read-me/TWICELY_V3_PAGE_REGISTRY.md
2. Read CLAUDE.md for the build sequence (which phases are complete)
3. For every route in the registry, check if a corresponding page.tsx or route.ts exists in src/app/
4. Check for WRONG route prefixes: /l/, /listing/, /listings/, /store/, /shop/, /search, /dashboard, /admin, /settings (without /my)
5. Check footer links in src/components/shared/marketplace-footer.tsx
6. Check all Link components for links to pages that don't exist
7. Distinguish between BUGS (completed phase, missing page) and EXPECTED GAPS (future phase)

DIFF_FILES: $DIFF_FILES

Report format per finding:
[SEVERITY] description — file:line
- BLOCKER: Completed phase, page missing, users will see 404
- WARNING: Link points to non-existent page but is disabled/gated
- INFO: Future phase, expected to be missing

End with a summary table: | Check | PASS/FAIL | Count |
```

### Stream 2: Auth & CASL (Agent)

```
THOROUGHNESS: very thorough

AUDIT STREAM 2: Auth & CASL Security Gates

1. Read read-me/TWICELY_V3_ACTORS_SECURITY_CANONICAL.md
2. Every server action in src/lib/actions/ — must call authorize() or staffAuthorize() as FIRST operation
3. Every API route in src/app/api/ — must call authorize(), check session, verify webhook signature, or check CRON_SECRET
4. Every server action must have ability.can() check AFTER authorize()
5. Check src/lib/casl/subjects.ts — list all subjects
6. Check src/lib/casl/ability.ts — verify rules exist for each subject
7. Verify no server action takes sellerId or delegationId from request body (must come from session)
8. Verify role/status/ownerUserId are never settable from client input

Read .claude/audit/known-false-positives.md — suppress known false positives.
DIFF_FILES: $DIFF_FILES

Report format per finding:
[SEVERITY] description — file:line
- BLOCKER: Missing auth check on mutation endpoint
- WARNING: Missing CASL gate (auth exists but no ability check)
- INFO: Public read endpoint without explicit CASL (acceptable if intentional)

End with summary: X/Y actions have auth, X/Y have CASL gates
```

### Stream 3: Hardcoded Values (Agent)

```
THOROUGHNESS: very thorough

AUDIT STREAM 3: Hardcoded Values & Platform Settings

1. Read read-me/TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md
2. Read src/lib/db/seed/v32-platform-settings.ts — count all entries
3. Search ALL src/lib/commerce/ files for magic numbers (48, 72, 7, 14, 800, 500, etc.) that should be configurable
4. For each hardcoded value found, check: is there a matching platform_settings key in the seed file?
5. For each platform_settings key in any canonical spec, check: is it in the seed file?
6. Verify getPlatformSetting() is used (not hardcoded constants) for: dispute deadlines, bundle expiry, shipping thresholds, return shipping, escrow hold hours, payout minimums, TF rates
7. Check read-me/TWICELY_V3_LOCAL_CANONICAL.md Section 12 — are all local settings in the seed?

DIFF_FILES: $DIFF_FILES

Report format per finding:
[SEVERITY] description — file:line
- BLOCKER: Business-critical value hardcoded (fee rate, deadline, threshold)
- WARNING: Configurable value hardcoded but has safe default
- INFO: Algorithm constant (not a business setting, correctly hardcoded)

End with: X platform_settings entries in seed, Y missing from spec
```

### Stream 4: Navigation & Wiring (Agent)

```
THOROUGHNESS: very thorough

AUDIT STREAM 4: Navigation Links & Wiring

1. Read src/lib/hub/hub-nav.ts — check all hrefs point to existing pages, disabled items are correct
2. Read src/lib/hub/admin-nav.ts — check all hrefs use correct hub prefixes (/d, /usr, /tx, /fin, /mod, /hd, /kb, /cfg, /roles, /audit, /health, /flags), disabled items are correct
3. Read src/components/hub/hub-sidebar.tsx — verify disabled rendering works
4. Read src/components/admin/admin-sidebar.tsx — verify disabled rendering works
5. Read src/components/shared/marketplace-footer.tsx — all links correct
6. Read next.config.ts — check redirects (/sell, /m)
7. Search ALL Link components across src/components/ for broken hrefs
8. Check for any links to /h or /h/contact — do those pages exist?

DIFF_FILES: $DIFF_FILES

Report format per finding:
[SEVERITY] description — file:line
- BLOCKER: Active link to non-existent page (user will see 404)
- WARNING: Href uses wrong identifier (userId instead of slug)
- INFO: Redirect-based link (works but not canonical path)

End with summary table of all nav items and their status
```

### Stream 5: Money Math & Banned Terms (Shell)

Run via: `bash twicely-audit.sh money`

### Stream 6: Schema Alignment (Agent)

```
THOROUGHNESS: very thorough

AUDIT STREAM 6: Schema Alignment

1. Read read-me/TWICELY_V3_SCHEMA_v2_0_7.md
2. Check src/lib/db/schema/enums.ts — all enum definitions match spec, no duplicates
3. Check all schema files import enums from ./enums (no local enum definitions)
4. Verify all schema files are re-exported from src/lib/db/schema/index.ts
5. Check ownership columns use userId (not storeId, businessId, sellerProfileId as ownership keys)
   - NOTE: sellerProfileId as a FK to the sellerProfile table is FINE — it's only wrong as an ownership key
6. Search for `as any`, `@ts-ignore`, `@ts-expect-error` in schema files — zero allowed
7. Verify monetary columns use integer cents naming (priceCents, amountCents, etc.)
8. Verify rate columns: platform fee rates should be integer bps; display/snapshot rates can be real per schema doc

DIFF_FILES: $DIFF_FILES

Report format per finding:
[SEVERITY] description — file:line

End with: Tables verified: X, Enums verified: X, Violations: X
```

### Stream 7: Wiring & Side Effects (Shell)

Run via: `bash twicely-audit.sh wiring`

### Stream 8: Stripe & Payments (Shell + Agent)

**Shell part** — run via: `bash twicely-audit.sh stripe`

**Agent part** (only if full audit, not quick):
```
THOROUGHNESS: very thorough

AUDIT STREAM 8: Stripe & Payments Deep Check

1. Read src/lib/stripe/webhooks.ts — list all handled events
2. Cross-reference: are payment_intent.succeeded, payment_intent.payment_failed,
   charge.refunded, account.updated handled?
3. Read src/lib/actions/checkout.ts — verify seller onboarding, MIN_ORDER_CENTS, TF from platform_settings
4. Read src/lib/stripe/refunds.ts — verify reverse_transfer, refund_application_fee, ledger entries
5. Check payout frequency respects tier gating

DIFF_FILES: $DIFF_FILES

End with: Webhook events: X handled, Refund safety: PASS/FAIL, Checkout gates: PASS/FAIL
```

### Stream 9: Code Hygiene (Shell)

Run via: `bash twicely-audit.sh hygiene`

### Stream 10a: Smoke Tests (Shell)

Run via: `bash twicely-audit.sh smoke`

Checks:
- Detects if dev server is running on port 3000
- If running: curls critical URLs (/, /auth/login, /s, /pricing, /cart, /my, /p/protection)
- Checks hub routes return 302 (auth redirect) not 500
- If not running: falls back to `pnpm build` compile check
- Reports pass/fail per route with status codes

### Stream 11: Runtime Safety (Shell)

Run via: `bash twicely-audit.sh runtime`

Catches things that compile fine but break when users actually click buttons:
- **11a. dangerouslySetInnerHTML** — XSS risk. Flags unsanitized usage (excludes JSON-LD and DOMPurify)
- **11b. eslint-disable comments** — Suppressed warnings often hide real bugs (e.g., hooks-after-return)
- **11c. Empty catch blocks** — Silently swallowed errors
- **11d. Browser API in server files** — `window.location`, `document.querySelector` etc. in non-client files → SSR crash
- **11e. Zod .cuid2() on internal IDs** — Rejects seed-format IDs at runtime (the exact bug that caused "Assign to me" to fail)
- **11f. Suspicious href constructions** — Bare `/tx/${id}` without `/tx/orders/${id}`, broken helpdesk sub-routes
- **11g. Unguarded server actions** — Files with 4+ startTransition calls and zero error handling
- **11h. Client-server boundary violations** — "use client" files importing from `@/lib/db` or `drizzle-orm` → 500 error
- **11i. Fire-and-forget void calls** — INFO level, flags `void asyncFunc()` patterns for review

---

## Step 3: Collect Results

Wait for ALL streams to complete. Then compile the unified scorecard:

```markdown
# Super Audit V2 Report
**Date:** [today]
**Mode:** [full / diff / quick / fix]
**Commit:** [current HEAD short hash]
**TypeScript:** [run pnpm typecheck, report result]

## Scorecard
| # | Stream | Method | PASS | WARN | BLOCK | Status |
|---|---|---|---|---|---|---|
| 1 | Routes & Pages | Agent | X | X | X | PASS/FAIL |
| 2 | Auth & CASL | Agent | X | X | X | PASS/FAIL |
| 3 | Hardcoded Values | Agent | X | X | X | PASS/FAIL |
| 4 | Navigation | Agent | X | X | X | PASS/FAIL |
| 5 | Money & Terms | Shell | X | X | X | PASS/FAIL |
| 6 | Schema | Agent | X | X | X | PASS/FAIL |
| 7 | Wiring & Side Effects | Shell | X | X | X | PASS/FAIL |
| 8 | Stripe & Payments | Hybrid | X | X | X | PASS/FAIL |
| 9 | Code Hygiene | Shell | X | X | X | PASS/FAIL |
| 10a | Smoke Tests | Shell | X | X | X | PASS/FAIL |
| 11 | Runtime Safety | Shell | X | X | X | PASS/FAIL |
| **TOTAL** | | | **X** | **X** | **X** | |

## Blockers (must fix)
[List all BLOCKER findings from all streams]

## Warnings (should fix)
[List all WARNING findings]

## Info (context only)
[Summarize INFO findings by category]

## Suppressed (known false positives)
<details>
<summary>X items suppressed — click to expand</summary>
[List each suppressed finding with its FP ID]
</details>

## Comparison vs Last Audit
[If .claude/audit/last-report.md exists, diff against it]

## Verdict: READY / NOT READY
```

---

## Step 4: Save & Recommend (scan-only modes)

1. **Save report** to `.claude/audit/last-report.md` (overwrite previous).
2. **If BLOCKERS:** "Run `/audit fix` to auto-repair, or fix manually."
3. **If only WARNINGS:** "Codebase is functional. Review warnings before launch."
4. **If clean:** "All 10 streams PASS. Codebase is audit-clean."

---

## Step 5: Self-Healing Fix Mode (`/audit fix`)

**This is the most powerful mode.** It scans, fixes, and re-audits in a loop until the
codebase is canonically compliant. No shortcuts, no workarounds — everything must be
correct per the canonical docs.

### Fix Loop Architecture

```
ROUND 1:
  1. Run full audit (all 10 streams)
  2. Collect all BLOCKERS and WARNINGS
  3. Group findings by domain (see grouping table below)
  4. For each group:
     a. Deploy @install-prompt-writer → writes fix prompt using canonicals as source of truth
     b. Deploy @install-executor → applies the fix exactly as written
     c. If errors arise → deploy @build-error-resolver to fix build/lint errors
  5. Run twicely-lint.sh as gate — if it fails, the fix round failed
  6. Run pnpm typecheck — must be 0 errors
  7. Run pnpm test — must be >= BASELINE_TESTS

ROUND 2 (if issues remain):
  1. Re-run full audit
  2. Compare findings vs Round 1 — are issues being resolved?
  3. Fix remaining issues using same agent chain
  4. If a finding persists after 2 fix attempts → mark as NEEDS_HUMAN
  5. Gate checks again

ROUND 3 (final attempt, if needed):
  1. Re-run full audit
  2. Any remaining issues are either NEEDS_HUMAN or false positives
  3. Update known-false-positives.md if new FPs discovered
  4. Final report

MAX 3 ROUNDS. If still failing after 3, stop and report.
```

### Finding → Domain Grouping

When grouping findings for the install-prompt-writer, use this mapping to identify
which canonical docs the writer needs:

| Finding Domain | Canonical Docs to Read | Agent Approach |
|---|---|---|
| Auth/CASL gaps | `ACTORS_SECURITY_CANONICAL.md` | Write fix prompt per file with exact authorize()/sub() patterns |
| Banned terms / UX language | `CLAUDE.md` banned terms table | @build-error-resolver direct (1:1 replacements, no prompt needed) |
| Wrong route prefixes | `PAGE_REGISTRY.md` | @build-error-resolver direct (1:1 replacements) |
| Hardcoded values | `PLATFORM_SETTINGS_CANONICAL.md`, `FEATURE_LOCKIN_ALL_DOMAINS.md` | Write prompt: add to seed + replace with getPlatformSetting() |
| Schema mismatches | `SCHEMA_v2_0_7.md` | Write prompt: align columns/types to spec |
| File size violations | N/A | Write prompt: split file into logical modules |
| Unwired notifications | `FEATURE_LOCKIN_ALL_DOMAINS.md` | Write prompt: add notify() calls per spec |
| Missing notify() | `FEATURE_LOCKIN_ALL_DOMAINS.md` | Write prompt: wire side effects per spec |
| Dead exports | N/A | Evaluate: is it future-phase? If yes → FP. If no → remove. |
| console.log | N/A | @build-error-resolver direct: replace with logger or remove |
| Type assertions | N/A | @build-error-resolver: fix actual types |
| Weak ID validation | N/A | @build-error-resolver direct: z.string().min(1) → z.string().cuid2() |
| Stripe safety | `PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` | Write prompt: add missing flags/handlers |
| Smoke test failures | `PAGE_REGISTRY.md` | Write prompt: create missing pages or fix routes |
| dangerouslySetInnerHTML | N/A | @build-error-resolver: add DOMPurify.sanitize() or switch to text rendering |
| eslint-disable (hooks) | N/A | @build-error-resolver: restructure hooks to avoid conditional calls |
| eslint-disable (img) | N/A | Evaluate: if external/blob URL → FP. If optimizable → use next/image |
| Strict cuid2 on internal IDs | N/A | @build-error-resolver: replace .cuid2() with internalId (z.string().min(1)) |
| Browser API in server files | N/A | @build-error-resolver: add "use client" or wrap in typeof window check |
| Broken href construction | `PAGE_REGISTRY.md` | @build-error-resolver direct: fix route segments |
| Client importing server module | N/A | @build-error-resolver: move import to server component or use server action |
| Unguarded startTransition | N/A | @build-error-resolver: add try/catch or result.error checking |

### Fix Agent Orchestration Rules

**Rule 1: Canonicals are the source of truth.**
When the install-prompt-writer needs to decide HOW to fix something, it reads the relevant
canonical doc. It does NOT invent fixes. If the canonical doesn't specify the answer,
it consults other canonicals or audits adjacent phases to find the pattern.

**Rule 2: No shortcuts or workarounds.**
Every fix must be the CORRECT fix per the specs. Examples of what is NOT acceptable:
- Commenting out code to silence a check
- Adding `// eslint-disable` or equivalent
- Deleting tests to fix count
- Using `as any` to fix types
- Removing an export instead of wiring it
- Adding a placeholder page instead of the real implementation

**Rule 3: The lint gate is non-negotiable.**
After every fix round, run `bash twicely-lint.sh`. If it fails, the fix round failed.
The build-error-resolver handles lint failures specifically.

**Rule 4: Questions go to canonicals first, then audit.**
When the install-prompt-writer is unsure about the correct fix:
1. Read the relevant canonical doc
2. If still unclear, audit adjacent phases to find established patterns
3. If still unclear, check `.claude/audit/known-false-positives.md` (maybe it's a known FP)
4. If STILL unclear, mark as NEEDS_HUMAN and move on

**Rule 5: Everything must be connected.**
A fix is not complete until:
- The code compiles (TypeScript 0 errors)
- Tests pass (>= BASELINE_TESTS)
- The fix is wired into the rest of the system (not orphaned)
- Side effects (notifications, Stripe calls, ledger entries) are present where required

### Fix Mode Report

After all rounds complete, output:

```markdown
# Audit Fix Report
**Date:** [today]
**Rounds:** X/3
**Starting blockers:** X | **Resolved:** Y | **Remaining:** Z

## Auto-Fixed (by @build-error-resolver)
| # | Finding | File | Fix Applied |
|---|---|---|---|

## Prompt-Fixed (by @install-prompt-writer + @install-executor)
| # | Finding | Prompt Written | Files Changed | Verified |
|---|---|---|---|---|

## Needs Human Decision
| # | Finding | File | Why Auto-Fix Failed | Suggested Options |
|---|---|---|---|---|

## New False Positives Discovered
[If any findings are confirmed FP during fix, list them for addition to known-false-positives.md]

## Gate Results
| Check | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| twicely-lint.sh | PASS/FAIL | PASS/FAIL | — |
| pnpm typecheck | 0 errors / X errors | ... | — |
| pnpm test | X passing (baseline Y) | ... | — |

## Final Verdict: CLEAN / NEEDS_HUMAN (X items)
```

---

## Quick Reference: All Modes

| Mode | What runs | Who fixes | Speed |
|---|---|---|---|
| `/audit` or `/audit full` | All 11 streams | Nobody (report only) | ~5 min |
| `/audit quick` | Shell streams only (5,7,8,9,10a,11) | Nobody (report only) | ~30 sec |
| `/audit diff` | All 11, changed files only | Nobody (report only) | ~3 min |
| `/audit 5` or `/audit money` | Single stream | Nobody (report only) | ~10 sec |
| `/audit 11` or `/audit runtime` | Runtime safety only | Nobody (report only) | ~15 sec |
| `/audit fix` | All 11 + fix loop | Agents auto-fix | ~15-30 min |
| `/audit fix quick` | Shell streams + fix loop | Agents auto-fix | ~5-10 min |
