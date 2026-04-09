# V4 Governance Rules

**Status:** LOCKED (v4.0)
**Scope:** Platform-level governance for Twicely V4.
**Enforced by:** Doctor checks, CI pipeline, Claude Code agents.

---

## 1. Master Doctor

### Purpose
Doctor is the ONLY authority that determines whether the platform is install-complete and deployable.

### Rules
- Every install phase MUST register doctor checks
- Any failure = hard stop (no bypass flags)
- Doctor runs on: `npx turbo doctor` (all packages + app)

### Check Categories
| Category | What It Verifies |
|----------|-----------------|
| Environment | Required env vars, secrets present |
| Database | Migrations applied, schema matches Drizzle |
| Auth | Better Auth config, session settings |
| CASL | All abilities registered, no orphan permissions |
| Search | Typesense collections exist, index lag < threshold |
| Finance | Ledger balances, TF bracket config, payout settings |
| Commerce | Order state machine integrity, offer settings |
| AI | Provider API keys, fallback chain, budget limits |
| Health | All providers registered, no stale checks |
| Jobs | BullMQ workers running, no stale jobs |
| Realtime | Centrifugo connection, channel config |

### TypeScript Contract
```ts
export type DoctorCheck = {
  id: string;
  phase: string;        // V4 install phase ID
  domain: string;       // package name
  description: string;
  severity: 'critical' | 'warning';
  run(): Promise<{ ok: boolean; message?: string }>;
};
```

---

## 2. Version Freeze

### V4 Freeze Rules
- V3 codebase is the starting point (v4 branch from master)
- 19 new install phases are additive (no V3 regression)
- V3 features MUST continue working after V4 phases
- No new domains without version bump (V5)

### Baseline Enforcement
- TypeScript: 24/24 packages must pass
- Tests: 9,838+ tests must pass (baseline from V3)
- Audit: 11/11 streams clean

---

## 3. Canonical Authority

### Hierarchy (highest → lowest)
1. **V4 Locked Decisions** (`rules/locked/V4_LOCKED_DECISIONS.md`)
2. **V4 Canonicals** (`rules/canonicals/*.md`)
3. **V3 Canonicals** (`rules/v3-reference/*.md`) — inherited unless superseded
4. **V4 Install Phases** (`rules/install-phases/*.md`)
5. **CLAUDE.md** (build instructions)

### Conflict Resolution
- V4 canonical supersedes V3 canonical on same topic
- V4 locked decision supersedes all canonicals
- When in doubt, ask Adrian

---

## 4. Code Quality Gates

### TypeScript
- `strict: true` everywhere
- Zero `as any` casts
- Zero `@ts-ignore` or `@ts-expect-error`

### Testing
- Vitest for all packages
- Baseline must never decrease
- New code requires tests (enforced by CI)
- Test files split at 250 lines

### Money
- Integer cents ONLY
- `priceCents`, `feeCents`, `totalCents` naming
- Never `price`, `fee`, `total` (ambiguous)
- Never floats for money math

### Settings
- All tunable values from `platform_settings` table
- No hardcoded thresholds, timeouts, limits
- Settings keys documented in canonical's "Platform Settings" section

---

## 5. Package Governance

### New Package Checklist
1. `package.json` with proper `name`, `exports`, `types`
2. `tsconfig.json` extending root
3. `vitest.config.ts` with proper aliases
4. `src/index.ts` barrel export
5. Registered in `turbo.json` pipeline
6. Doctor checks registered

### Import Rules
- `apps/web` → `@twicely/X` (workspace packages)
- `packages/X` → `@twicely/Y` (peer packages, declared in package.json)
- NEVER `../../../packages/X/src/...` (relative cross-package imports)
- NEVER `@/lib/X` for code that lives in packages (eliminated in V3 consolidation)
- Dynamic `import()` for circular deps (see CLAUDE.md Tier 5 pattern)

### Shared Code Rule
- If code is used by 2+ packages → lives in a package
- If code is app-specific → lives in `apps/web/src/`
- NEVER duplicate code across packages

---

## 6. Install Phase Rules

### Phase Format
Every install phase MUST include:
1. What this phase installs (Backend / UI / Ops)
2. Schema (Drizzle pgTable definitions)
3. Server actions + queries
4. UI pages (App Router paths)
5. Tests required
6. Doctor checks

### Phase Execution Rules
- Phases execute in order (prereqs enforced)
- Each phase is atomic — either fully installed or not
- Doctor checks verify phase completion
- No partial installs

### Phase Size
- SMALL and TIGHT — one focused domain per phase
- If a phase takes more than 2 days, split it
- Each phase should produce < 20 new files

---

## 7. AI Governance

### AI Feature Rules
- All AI calls route through `packages/ai/`
- Every AI request logged to `aiRequest` table
- Token budgets enforced per feature per day
- Responses cached when deterministic
- Fallback to non-AI behavior when provider is unavailable
- No raw PII sent to AI providers (anonymize first)

### AI Provider Rules
- Primary: OpenAI (cheapest for embeddings + classification)
- Secondary: Anthropic Claude (complex reasoning)
- Tertiary: Local models (if applicable)
- All providers behind abstraction layer
- Provider switch = config change, not code change

---

## 8. Security Governance

### Authentication
- Better Auth with 24h sessions (SEC-036)
- 60-second cookie cache for ban propagation (A3)
- HMAC impersonation tokens (Decision #133)

### Authorization
- CASL abilities on EVERY server action
- PlatformRole for operator surfaces
- No invented permission keys (use PlatformRole only)
- Staff impersonation audit logged

### Data
- Webhook idempotency: fail-CLOSED on DB error (SEC-022)
- Payout minimum 2-day delay (SEC-016)
- Purge allowlist enforced (SEC-027)
- No raw PII in analytics events

---

## 9. Deployment Governance

### Pre-Deploy Checklist
1. `npx turbo typecheck` — zero errors
2. `npx turbo test` — baseline met
3. `npx turbo build` — successful
4. Doctor checks — all pass
5. Migration review — no destructive changes without approval

### Rollback
- Every deployment must be rollback-safe
- Database migrations must be backward-compatible
- Feature flags for risky features (gradual rollout)

---

## 10. Agent Governance

### Claude Code Agents
- Domain agents defined in `rules/agents/`
- Each agent owns exactly one domain
- Agents audit against their domain's canonical
- Agent findings are PASS / DRIFT / FAIL
- DRIFT requires fix within same sprint
- FAIL blocks deployment

### Agent Execution
- Agents run via `/twicely-audit <domain>` skill
- Fixes applied via `/twicely-fix <domain> <issue>` skill
- All agent actions logged

---

## 11. Final Rule

Governance rules documented here are **mandatory**. Violations are:
1. Flagged by Doctor or CI
2. Blocked at PR review
3. Escalated to Adrian if persistent

No exceptions without written approval and version bump.
