# TWICELY SRE / PLATFORM HEALTH CONSOLE SPEC — LOCKED

## STATUS
**LOCKED BASELINE – DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines the **Site Reliability Engineering (SRE) / Platform Health Console** for Twicely.
Its purpose is to provide **real-time visibility**, **operational safety**, and **incident response tooling**
without mixing business logic or admin workflows.

This console is **read-heavy**, **restricted**, and **non-invasive** by design.

This spec MUST align with:
- `TWICELY_KERNEL_MODULE_ENFORCEMENT_LOCKED.md`
- `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`
- `TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`

---

## 0. Goals (What this console exists for)

1. Detect platform issues **before users report them**
2. Provide a single source of truth for **system health**
3. Enable **safe diagnostics** without modifying production data
4. Support **incident response** and post-mortems
5. Avoid mixing SRE tools with business/admin tools

This console is NOT:
- a customer support tool
- a finance tool
- a marketplace management UI

---

## 1. Access Control (Hard Rules)

### 1.1 Platform Roles Allowed
Only platform RBAC roles may access the SRE console:
- `ADMIN`
- `DEVELOPER`
- `SRE` (recommended dedicated role)

### 1.2 Forbidden
- Sellers
- Delegated staff
- Buyers
- Support agents (unless explicitly granted SRE role)

### 1.3 Mode
- Read-only by default
- Write actions (rare) require:
  - elevated role
  - confirmation step
  - audit logging

---

## 2. Console Location & Routing

### 2.1 UI Route
```
/app/(platform)/sre
```

### 2.2 API Namespace
```
/api/platform/sre/*
```

All endpoints:
- require platform RBAC
- are isolated from seller/admin APIs
- never accept ownerUserId context

---

## 3. Core Dashboard (Landing View)

### 3.1 Global Health Summary
Displayed at top of console:

- API status: ✅ / ⚠️ / 🔴
- Webhook ingestion status
- Payment provider connectivity
- Database connectivity
- Queue/worker health
- Error rate (last 5m / 1h)
- Latency p95 / p99

### 3.2 Status Sources
Health signals must be computed from:
- internal metrics
- heartbeat checks
- error logs
- webhook backlogs
- queue depth

Never rely solely on UI pings.

---

## 4. Subsystems & Panels (Required)

### 4.1 API Health
- Request volume
- Error rate (4xx vs 5xx)
- Slow endpoints (p95, p99)
- Top failing routes
- Rate-limit hits

### 4.2 Webhooks Health
- Events received (per minute)
- Events processed vs failed
- Retry counts
- Dead-letter queue size
- Oldest unprocessed event age

Integrates directly with `PaymentEventLog`.

---

### 4.3 Payments & Money Signals (Read-only)
No sensitive financial details, only signals:

- Payment success rate
- Refund rate
- Dispute rate
- Transfer backlog
- Held payouts count
- Failed payouts count

Drill-down links may jump to finance console (separate module).

---

### 4.4 Queue / Worker Health
If using background workers:

- Active workers
- Queue depth per queue
- Job retry counts
- Oldest job age
- Failed jobs (last N)

---

### 4.5 Database Health
- Connection pool usage
- Query latency
- Slow query count
- Migration status (applied/pending)

No raw SQL execution allowed.

---

### 4.6 Cache / CDN (If applicable)
- Cache hit/miss ratio
- CDN error rate
- Origin latency

---

## 5. Incident Timeline & Correlation

### 5.1 Incident Feed
Chronological feed of:
- spikes in errors
- webhook failures
- provider outages
- deploy events
- config changes

Each event includes:
- timestamp
- subsystem
- severity
- correlationId (if available)

---

### 5.2 Correlation Rules
SRE console should allow filtering by:
- time window
- subsystem
- correlationId
- deployment version

Goal: answer “what broke and when” quickly.

---

## 6. Alerting Integration (Required)

### 6.1 Alert Triggers (Baseline)
- API error rate > threshold
- Webhook backlog > threshold
- Payment success rate drop
- Queue depth spike
- Database connectivity issues

### 6.2 Alert Channels
- Slack / Teams
- Email
- PagerDuty / Opsgenie (optional)

Alerting is configured externally but surfaced in the console.

---

## 7. Safe Actions (Very Limited Writes)

### 7.1 Allowed Actions
- Retry failed webhook event
- Re-enqueue stuck background job
- Toggle maintenance mode (if supported)

### 7.2 Required Safeguards
- Confirmation modal
- Reason input
- AuditEvent with:
  - actorUserId
  - actionKey
  - affected subsystem
  - reason
  - timestamp

### 7.3 Forbidden Actions
- Editing business data
- Editing orders/listings/payments
- Manual balance changes
- Direct DB writes

---

## 8. Metrics & Observability Contract

### 8.1 Required Metrics
Expose metrics for:
- request_count
- error_count
- latency_ms
- webhook_events_received
- webhook_events_failed
- queue_depth
- job_failures

### 8.2 Logging Requirements
Logs must include:
- timestamp
- subsystem
- severity
- correlationId (requestId, webhook event id, etc.)

### 8.3 Tracing (Recommended)
Distributed tracing for:
- API requests
- webhook processing
- background jobs

---

## 9. Performance & Safety Requirements

- Console must load even during partial outages
- Data should be cached briefly (e.g., 5–30s)
- No heavy queries on hot paths
- No blocking calls to production workflows

---

## 10. Acceptance Checklist

- [ ] Only platform RBAC roles can access console
- [ ] Dashboard shows real-time system health
- [ ] Webhook backlog and failures are visible
- [ ] Payment signals are visible but read-only
- [ ] Queue/worker health is visible
- [ ] Safe actions require confirmation + audit
- [ ] No business data mutations possible
- [ ] Console usable during degraded states

---

## VERSION
- **v1.0 – SRE / platform health console baseline**
- Date locked: 2026-01-17
