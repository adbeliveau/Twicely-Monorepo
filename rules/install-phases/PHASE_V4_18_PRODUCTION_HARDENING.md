# V4 Install Phase 18 -- Production Hardening & Observability

**Status:** DRAFT (V4)
**Prereq:** V3 Stripe webhook pipeline operational, kill switches seeded, ledger entry system working, BullMQ operational, Valkey connected
**Canonical:** `rules/canonicals/36_PRODUCTION_HARDENING.md`
**V2 lineage:** Phase 19 (Audit Logs & Observability) + Phase 20 (Production Readiness Checklist) + Operational Glue Canonical
**Estimated steps:** 10

---

## 0) What This Phase Installs

### Backend
- `auditLog`, `retentionPolicy`, `circuitBreakerState` tables (Drizzle)
- `stripeTransferId` column on `orderPayment`, `NONPROFIT`/`OTHER` on `businessTypeEnum`, `TRANSFER_REVERSAL` on `ledgerEntryTypeEnum`
- Audit log emitter (append-only, immutable)
- Structured JSON logger with correlation IDs
- Sentry error tracking integration
- API rate limiting middleware (Valkey-backed token bucket)
- Security headers middleware (CSP, CORS, HSTS, etc.)
- Circuit breaker for external services (Stripe, Shippo, OpenAI, Typesense, Centrifugo)
- Data retention enforcement cron job
- Production invariant check cron job (7 invariants)
- Global `kill.platform` kill switch with maintenance page
- `transfer.created`, `transfer.reversed`, `refund.created` webhook handlers
- Launch gate automated checks

### Hub UI
- `/operations` -- Invariant check panel, circuit breaker status, retention run history
- `/flags` -- Prominent kill.platform warning styling
- `/audit` -- Audit log viewer (read-only, filterable)

### Ops
- Maintenance page at `/maintenance` (static, no DB)
- Correlation ID propagation via AsyncLocalStorage

### Seed Data
- `kill.platform` kill switch
- All `system.*` and `stripe.webhook.*` platform settings
- Default retention policies for 8 tables

---

## 1) Schema (Drizzle)

### Files

| File | Action |
|---|---|
| `packages/db/src/schema/enums.ts` | MODIFY (add 4 enums, extend 2 existing) |
| `packages/db/src/schema/audit.ts` | CREATE (3 tables) |
| `packages/db/src/schema/commerce.ts` | MODIFY (add stripeTransferId) |
| `packages/db/src/schema/index.ts` | MODIFY (export audit tables) |

### Step 1.1: Enums

Add to `packages/db/src/schema/enums.ts`:

```ts
export const auditCategoryEnum = pgEnum('audit_category', [
  'RBAC', 'FINANCE', 'TRUST', 'COMMERCE', 'MODERATION',
  'SYSTEM', 'SECURITY', 'SETTINGS', 'MESSAGING',
]);
export const auditSeverityEnum = pgEnum('audit_severity', ['INFO', 'WARNING', 'CRITICAL']);
export const retentionPolicyStatusEnum = pgEnum('retention_policy_status', ['ACTIVE', 'PAUSED', 'DISABLED']);
export const circuitBreakerStateEnum = pgEnum('circuit_breaker_state', ['CLOSED', 'OPEN', 'HALF_OPEN']);
```

Extend existing enums:
- `businessTypeEnum`: add `NONPROFIT`, `OTHER`
- `ledgerEntryTypeEnum`: add `TRANSFER_REVERSAL`

### Step 1.2: `auditLog` table

File: `packages/db/src/schema/audit.ts` (CREATE)

```ts
export const auditLog = pgTable('audit_log', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  actorUserId:     text('actor_user_id'),
  actorRole:       text('actor_role'),
  actorIp:         text('actor_ip'),
  actorUserAgent:  text('actor_user_agent'),
  action:          text('action').notNull(),
  category:        auditCategoryEnum('category').notNull().default('SYSTEM'),
  severity:        auditSeverityEnum('severity').notNull().default('INFO'),
  entityType:      text('entity_type'),
  entityId:        text('entity_id'),
  metaJson:        jsonb('meta_json').notNull().default(sql`'{}'`),
  correlationId:   text('correlation_id'),
  sessionId:       text('session_id'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  actionDateIdx:   index('al_action_date').on(table.action, table.createdAt),
  categoryDateIdx: index('al_category_date').on(table.category, table.createdAt),
  entityIdx:       index('al_entity').on(table.entityType, table.entityId),
  actorDateIdx:    index('al_actor_date').on(table.actorUserId, table.createdAt),
  severityDateIdx: index('al_severity_date').on(table.severity, table.createdAt),
  correlationIdx:  index('al_correlation').on(table.correlationId),
}));
```

### Step 1.3: `retentionPolicy` table

```ts
export const retentionPolicy = pgTable('retention_policy', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  tableName:       text('table_name').notNull().unique(),
  retentionDays:   integer('retention_days').notNull(),
  dateColumn:      text('date_column').notNull(),
  purgeStrategy:   text('purge_strategy').notNull(), // hard_delete, soft_archive, body_redact
  batchSize:       integer('batch_size').notNull().default(1000),
  status:          retentionPolicyStatusEnum('status').notNull().default('ACTIVE'),
  lastRunAt:       timestamp('last_run_at', { withTimezone: true }),
  lastPurgedCount: integer('last_purged_count'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Step 1.4: `circuitBreakerState` table

```ts
export const circuitBreakerState = pgTable('circuit_breaker_state', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  serviceKey:      text('service_key').notNull().unique(),
  state:           circuitBreakerStateEnum('state').notNull().default('CLOSED'),
  failureCount:    integer('failure_count').notNull().default(0),
  lastFailureAt:   timestamp('last_failure_at', { withTimezone: true }),
  lastSuccessAt:   timestamp('last_success_at', { withTimezone: true }),
  openedAt:        timestamp('opened_at', { withTimezone: true }),
  halfOpenAt:      timestamp('half_open_at', { withTimezone: true }),
  closedAt:        timestamp('closed_at', { withTimezone: true }),
  metaJson:        jsonb('meta_json').notNull().default(sql`'{}'`),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Step 1.5: `orderPayment` extension

Add to `packages/db/src/schema/commerce.ts`:
```ts
stripeTransferId: text('stripe_transfer_id'),
```

### Step 1.6: Exports + migration

```bash
cd packages/db && npx drizzle-kit generate --name production_hardening_v4_18
```

---

## 2) Audit Log System

### Step 2.1: Audit emitter

File: `packages/config/src/production/audit-emitter.ts`

```ts
export async function emitAuditEvent(input: {
  actorUserId?: string;
  actorRole?: string;
  actorIp?: string;
  action: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  correlationId?: string;
}): Promise<string>
// Derives category from action prefix if not provided
// Derives severity from known action mappings
// INSERT into auditLog -- APPEND ONLY, no update/delete exports
```

### Step 2.2: Audit query service

File: `packages/config/src/production/audit-query.ts`

```ts
export async function queryAuditEvents(
  filters: AuditQueryFilters,
  pagination: { page?: number; limit?: number }
): Promise<{ events: AuditLog[]; pagination: PaginationMeta }>

export async function getEntityAuditHistory(
  entityType: string, entityId: string, limit?: number
): Promise<AuditLog[]>
```

### Step 2.3: Audit API route

File: `apps/web/src/app/api/platform/audit/route.ts`

GET: CASL gate `ability.can('read', 'AuditLog')`. Supports action, category, severity, actorUserId, entityType, entityId, date range filters. Paginated (max 100 per page).

---

## 3) Structured Logging + Correlation IDs

### Step 3.1: Logger utility

File: `packages/config/src/production/logger.ts`

```ts
export function createLogger(module: string): {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, error?: Error, meta?: Record<string, unknown>): void;
}
// Output: JSON, one line per entry
// { timestamp, level, module, message, correlationId (from AsyncLocalStorage), meta }
```

### Step 3.2: Correlation ID middleware

File: `apps/web/src/lib/middleware/correlation-id.ts`

- Generate `req_${cuid2}` per incoming request
- Store in `AsyncLocalStorage` context
- Attach to response header `X-Correlation-ID`
- Logger auto-reads from AsyncLocalStorage

---

## 4) Error Tracking (Sentry)

### Step 4.1: Sentry init

File: `apps/web/src/lib/sentry.ts` (client), `apps/web/src/instrumentation.ts` (server)

- DSN from `SENTRY_DSN` env var (required in production, optional in dev)
- Environment, release version, correlation ID context
- Error sample rate: 100%, transaction sample rate: 10% (configurable via `system.sentry.transactionSampleRate`)
- User context (userId, role) from session

---

## 5) API Rate Limiting

### Step 5.1: Rate limit middleware

File: `apps/web/src/lib/middleware/rate-limit.ts`

Token bucket via Valkey `INCR` + `EXPIRE`:

| Route Type | Requests/min | Burst |
|---|---|---|
| `auth` | 10 | 15 |
| `search` | 60 | 100 |
| `messaging` | 30 | 50 |
| `checkout` | 10 | 15 |
| `api_general` | 120 | 200 |
| `webhook` | 500 | 1000 |

Returns 429 with `Retry-After` header. Rate limit headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

Kill switch: `system.rateLimit.enabled` platform setting.

---

## 6) Security Headers

### Step 6.1: Headers middleware

File: `apps/web/src/lib/middleware/security-headers.ts`

Apply to all responses:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (see canonical section 9.2 for full policy)

### Step 6.2: CORS config

Add CORS headers to `/api/*` routes in `apps/web/next.config.ts`. Origin from `CORS_ALLOWED_ORIGINS` env var (default `https://twicely.co`).

---

## 7) Circuit Breakers

### Step 7.1: Circuit breaker utility

File: `packages/config/src/production/circuit-breaker.ts`

```ts
export async function withCircuitBreaker<T>(
  serviceKey: string,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T>
// State: CLOSED -> OPEN (after threshold failures) -> HALF_OPEN (after duration) -> CLOSED (on probe success)
// Persisted in circuitBreakerState table + Valkey cache
```

### Step 7.2: Service configurations (seeded)

| Service Key | Failure Threshold | Open Duration (sec) |
|---|---|---|
| `stripe` | 5 | 60 |
| `shippo` | 3 | 120 |
| `openai` | 3 | 300 |
| `typesense` | 5 | 30 |
| `centrifugo` | 5 | 30 |

### Step 7.3: Graceful degradation

- Stripe OPEN: queue payment ops for retry, show "Payment processing delayed"
- Typesense OPEN: fall back to Drizzle ILIKE search
- OpenAI OPEN: skip AI features, degrade to non-AI mode
- Centrifugo OPEN: disable realtime, data on next page load

---

## 8) Stripe Webhook Handlers

### Step 8.1: `transfer.created` handler

File: `packages/stripe/src/webhook-transfer-handlers.ts` (CREATE)

1. Find `orderPayment` by `stripeChargeId` matching `transfer.source_transaction`
2. Update `orderPayment.stripeTransferId`
3. Create `TRANSFER` ledger entry with `idempotencyKey = transfer:{transferId}`
4. Skip silently if no matching orderPayment (non-marketplace transfer)

### Step 8.2: `transfer.reversed` handler

Same file. For each reversal in `transfer.reversals.data`:
1. Check idempotency via `transfer_reversal:{reversalId}` ledger key
2. Create `TRANSFER_REVERSAL` ledger entry with negative amount
3. Set `reversalOfEntryId` to original TRANSFER entry
4. Notify seller

### Step 8.3: `refund.created` handler

File: `packages/stripe/src/webhook-refund-handler.ts` (EXTEND)

Supplementary to `charge.refunded`. Defensive reconciliation: verify `orderPayment.refundAmountCents` matches. Create audit event.

### Step 8.4: Wire into webhook router

File: `packages/stripe/src/webhooks.ts` -- add 3 new cases to `dispatchPlatformEvent()` switch. Each handler checks its `stripe.webhook.*.enabled` platform setting.

---

## 9) Kill Switch + Invariants + Retention

### Step 9.1: Global kill switch

Seed `kill.platform` in `packages/db/src/seed/seed-kill-switches.ts`.

Maintenance page: `apps/web/src/app/maintenance/page.tsx` (static, no DB calls).

Middleware check in `apps/web/src/middleware.ts`:
- Hub bypass, exempt paths (`/auth/login`, `/api/platform/killswitches`, `/_next/*`, `/maintenance`)
- API routes: 503 JSON response
- Page routes: rewrite to `/maintenance`
- 10-second Valkey cache TTL for kill.platform

### Step 9.2: Production invariants

File: `packages/config/src/production/invariants.ts`

7 invariant checks (see canonical section 13.1). BullMQ cron every 6 hours (`0 */6 * * *`, UTC). On critical failure: notify ADMIN staff, emit audit event. No auto-kill-switch activation.

API: `POST /api/platform/invariants/run` (CASL: `create ProductionInvariant`).

### Step 9.3: Data retention enforcement

BullMQ cron: daily 03:00 UTC. Job name: `system.retention-purge`.

Processes each active `retentionPolicy`: select old rows in batches, apply purge strategy, update `lastRunAt`/`lastPurgedCount`, emit audit event.

### Step 9.4: Launch gates

File: `packages/config/src/production/launch-gates.ts`

8 automated checks (see canonical section 15.1). Returns GO/NO_GO decision.

---

## 10) Tests + UI + Doctor

### Tests

| File | Min Tests |
|---|---|
| `packages/config/src/production/__tests__/audit-emitter.test.ts` | 6 |
| `packages/config/src/production/__tests__/audit-query.test.ts` | 5 |
| `packages/config/src/production/__tests__/circuit-breaker.test.ts` | 8 |
| `packages/config/src/production/__tests__/invariants.test.ts` | 7 |
| `packages/config/src/production/__tests__/logger.test.ts` | 4 |
| `packages/stripe/src/__tests__/webhook-transfer-created.test.ts` | 6 |
| `packages/stripe/src/__tests__/webhook-transfer-reversed.test.ts` | 8 |
| `packages/stripe/src/__tests__/webhook-refund-created.test.ts` | 5 |
| `apps/web/src/middleware/__tests__/platform-killswitch.test.ts` | 6 |
| `apps/web/src/middleware/__tests__/rate-limit.test.ts` | 5 |
| `apps/web/src/middleware/__tests__/security-headers.test.ts` | 4 |
| `packages/jobs/src/__tests__/invariant-cron.test.ts` | 3 |
| `packages/jobs/src/__tests__/retention-purge.test.ts` | 4 |
| **Total** | **76** |

### Hub UI updates

- `/operations`: invariant check results, circuit breaker status, retention run history, "Run Now" button
- `/flags`: `kill.platform` red border, double-confirmation dialog
- `/audit`: audit log viewer (read-only, filterable by action, category, severity, actor, entity, date)

### Doctor checks

- Audit event emitter writes and persists
- Audit events are immutable (no update/delete exposed)
- Kill switch blocks correctly and recovers
- All invariant checks pass on clean data
- Circuit breaker state transitions work
- Structured logger outputs valid JSON

### Completion Criteria

- [ ] 3 new tables created, enum extensions applied, stripeTransferId added
- [ ] Audit log emitter functional (append-only, immutable)
- [ ] Structured JSON logger with correlation IDs
- [ ] Sentry integration configured (optional in dev)
- [ ] API rate limiting enforced on all public routes
- [ ] Security headers applied (CSP, CORS, HSTS, X-Frame-Options)
- [ ] Circuit breakers configured for 5 external services
- [ ] `transfer.created` webhook links transfer ID to orderPayment + ledger
- [ ] `transfer.reversed` webhook creates TRANSFER_REVERSAL ledger entries
- [ ] `refund.created` webhook reconciles refund amounts
- [ ] `kill.platform` takes marketplace offline, hub unaffected
- [ ] Maintenance page renders without DB calls
- [ ] 7 production invariants defined and passing
- [ ] Invariant cron registered (every 6 hours)
- [ ] 8 default retention policies seeded
- [ ] Retention purge cron registered (daily 03:00 UTC)
- [ ] Launch gates automated checks functional
- [ ] All seed data inserted
- [ ] CASL subjects/abilities added (AuditLog, KillSwitch, ProductionInvariant, RetentionPolicy, CircuitBreaker)
- [ ] 76+ new tests passing
- [ ] `npx turbo typecheck` -- 0 errors
- [ ] `npx turbo test` -- baseline maintained or increased
