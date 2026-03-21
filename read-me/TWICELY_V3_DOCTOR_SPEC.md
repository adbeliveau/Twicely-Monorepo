# TWICELY V3 — Doctor Spec (Health Check System)

**Version:** v1.0 | **Date:** 2026-02-17 | **Status:** LOCKED

---

## 1. CONCEPT

Doctor is the platform health check system. It verifies that every critical subsystem is operational, reports status via API and dashboard, and provides phase gates for deployment.

---

## 2. HEALTH CHECK ENDPOINTS

### /api/health (Public — No Auth)
Returns HTTP 200 if app server is responding. Load balancer target.
```json
{ "status": "ok", "timestamp": "2026-02-17T12:00:00Z" }
```

### /api/health/deep (Hub Auth — Staff Only)
Checks all subsystems. Returns per-component status.
```json
{
  "status": "degraded",
  "timestamp": "2026-02-17T12:00:00Z",
  "checks": {
    "database": { "status": "ok", "latencyMs": 12 },
    "cache": { "status": "ok", "latencyMs": 3 },
    "search": { "status": "ok", "latencyMs": 8 },
    "storage": { "status": "ok", "latencyMs": 45 },
    "queue": { "status": "ok", "pending": 23, "failed": 0 },
    "realtime": { "status": "ok", "connections": 142 },
    "email": { "status": "degraded", "lastSentAt": "2026-02-17T11:58:00Z" },
    "stripe": { "status": "ok", "lastWebhookAt": "2026-02-17T11:59:30Z" },
    "shippo": { "status": "ok" }
  },
  "version": "3.0.45",
  "uptime": 86400
}
```

Status values: `ok` | `degraded` | `down`. Overall status = worst component status.

---

## 3. COMPONENT CHECKS

| Component | Check | Degraded If | Down If |
|-----------|-------|-------------|---------|
| Database (Neon) | `SELECT 1` query | Latency > 500ms | Connection fails |
| Cache (Valkey) | `PING` | Latency > 100ms | Connection fails |
| Search (Typesense) | `/health` endpoint | Latency > 500ms | Connection fails |
| Storage (R2) | HEAD request on test object | Latency > 2000ms | Request fails |
| Queue (BullMQ) | Check pending + failed counts | Failed > 100 | Connection fails |
| Realtime (Centrifugo) | `/health` endpoint | Active connections = 0 (expected > 0) | Connection fails |
| Email (Resend) | API key validation | Last successful send > 30 min ago | API returns error |
| Stripe | API key validation | Last webhook > 30 min ago | API returns error |
| Shippo | API key validation | — | API returns error |

---

## 4. PHASE GATES

Before deploying to production, Doctor verifies the current phase's requirements:

| Phase | Gate Conditions |
|-------|----------------|
| A | DB migrated, auth endpoints respond, CASL tests pass |
| B | All B-phase routes return 200, listing CRUD works, checkout creates order |
| C | Stripe Connect responds, offer flow works, return creates case |
| D | Subscription billing active, storefront renders, analytics endpoint returns data |
| E | Notifications deliver, messaging works, admin dashboard loads |
| F | eBay OAuth succeeds, import creates listings, publish queue processes |
| G | All E2E tests pass, Lighthouse green, load test passes |

Phase gate check: `GET /api/health/gate?phase=B` → returns pass/fail with details.

---

## 5. EXECUTION MODES

| Mode | Behavior | Trigger |
|------|----------|---------|
| Normal | All checks run every 60 seconds | Default |
| Intensive | All checks run every 10 seconds | After deployment or incident |
| Maintenance | Returns 503 with maintenance message | Manual toggle in admin |
| Read-Only | Marketplace browsable, no writes | Manual toggle for DB maintenance |

---

## 6. KILL SWITCHES

Emergency toggles accessible at `/cfg/kill-switches` (SUPER_ADMIN only):

| Switch | Effect | Use Case |
|--------|--------|----------|
| `killCheckout` | Disable all new purchases | Payment system issue |
| `killPayouts` | Halt all seller payouts | Fraud investigation |
| `killImports` | Disable crosslister imports | Platform API rate limiting |
| `killPublish` | Disable crosslister outbound | Platform API issue |
| `killRegistration` | Disable new account creation | Bot attack |
| `killLocalTransactions` | Disable Twicely.Local | Safety concern |
| `killAuthentication` | Disable authentication program | Provider issue |
| `readOnlyMode` | No writes to DB | DB maintenance |

Kill switches are instant (no deployment needed). Stored in Valkey for immediate effect. Logged in audit trail.

---

## 7. ALERTING

| Severity | Condition | Notification |
|----------|-----------|-------------|
| CRITICAL | Any component DOWN | SMS + email to SRE on-call |
| HIGH | Any component DEGRADED > 5 min | Email to SRE team |
| MEDIUM | Queue failed jobs > 50 | Slack #alerts |
| LOW | Latency above threshold (single check) | Grafana annotation |

Alert routing configured in Grafana Alerting. PagerDuty integration at 10K+ sellers.

---

## 8. DASHBOARD

Hub admin: `/health` — visual status page showing all components, response times (graph), uptime percentage (30 days), recent incidents, active kill switches.

Public status page: `status.twicely.co` — simplified view for sellers/buyers. Shows: operational / degraded / major outage. No internal details.

---

## 9. PLATFORM SETTINGS

```
health.checkIntervalSeconds: 60
health.intensiveIntervalSeconds: 10
health.degradedThresholdMs.database: 500
health.degradedThresholdMs.cache: 100
health.degradedThresholdMs.search: 500
health.degradedThresholdMs.storage: 2000
health.failedJobsAlertThreshold: 100
health.emailStalenessMinutes: 30
health.stripeWebhookStalenessMinutes: 30
```

## 10. PHASE

E5 (Monitoring & Alerting)
