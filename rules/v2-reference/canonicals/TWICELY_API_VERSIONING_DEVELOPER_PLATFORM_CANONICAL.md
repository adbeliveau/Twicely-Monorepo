# TWICELY API VERSIONING & DEVELOPER PLATFORM CANONICAL
**Status:** LOCKED (v1.0)  
**Scope:** API versioning strategy, developer platform, third-party integrations, OAuth, rate limiting  
**Audience:** Engineers, API consumers, crosslisters, third-party developers, partner integrations

---

## 1. Vision: eBay-Scale Developer Ecosystem

Twicely's API platform enables:
- **Crosslisting tools** (List Perfectly, Vendoo, Crosslist, etc.)
- **Inventory management systems** (Sellbrite, ChannelAdvisor, Linnworks)
- **Shipping integrations** (ShipStation, Pirate Ship, EasyPost)
- **Accounting software** (QuickBooks, Xero, Wave)
- **Analytics platforms** (custom dashboards, BI tools)
- **Mobile app developers** (third-party buyer/seller apps)
- **Enterprise sellers** (bulk operations, ERP integrations)

---

## 2. API Architecture Overview

### 2.1 API Tiers

| Tier | Audience | Auth | Rate Limits | SLA |
|------|----------|------|-------------|-----|
| **Public API** | All developers | OAuth 2.0 | Standard | 99.9% |
| **Partner API** | Verified partners | OAuth 2.0 + API Key | Elevated | 99.95% |
| **Enterprise API** | Enterprise sellers | OAuth 2.0 + mTLS | Custom | 99.99% |
| **Internal API** | Twicely apps only | Session/JWT | Unlimited | N/A |

### 2.2 API Domains

```
api.twicely.com           # Production API gateway
sandbox.api.twicely.com   # Sandbox/testing environment
developer.twicely.com     # Developer portal & docs
webhooks.twicely.com      # Webhook delivery
bulk.api.twicely.com      # Bulk operations (async)
streaming.twicely.com     # Real-time feeds (future)
```

### 2.3 URL Structure

```
https://api.twicely.com/v{version}/{resource}

Examples:
https://api.twicely.com/v1/listings
https://api.twicely.com/v1/listings/abc123
https://api.twicely.com/v1/listings/abc123/images
https://api.twicely.com/v1/orders?status=AWAITING_FULFILLMENT
https://api.twicely.com/v1/sell/inventory/bulk
```

---

## 3. Versioning Strategy

### 3.1 Version Format

**Primary:** URL path versioning (mandatory)
```
/v1/listings
/v2/listings
```

**Secondary:** Date-based minor versions via header (optional)
```
Twicely-Version: 2024-01-15
```

This hybrid approach provides:
- Simple major versions in URL (v1, v2, v3)
- Fine-grained control via date headers for minor changes
- Mirrors Stripe's successful versioning model

### 3.2 Version Lifecycle

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   BETA      │ →  │   STABLE    │ →  │ DEPRECATED  │ →  │   SUNSET    │
│  (6 months) │    │ (unlimited) │    │ (12 months) │    │  (removed)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

| Phase | Duration | Behavior |
|-------|----------|----------|
| **Beta** | 6 months max | May change without notice, not for production |
| **Stable** | Unlimited | Fully supported, no breaking changes |
| **Deprecated** | 12 months minimum | Works but returns `Sunset` header |
| **Sunset** | - | Returns 410 Gone with migration guide |

### 3.3 Version Support Matrix

| Version | Status | Released | Deprecated | Sunset |
|---------|--------|----------|------------|--------|
| v1 | Stable | Launch | - | - |
| v2 | Beta | +18 months | - | - |

**Rule:** Minimum 2 stable versions supported simultaneously.

### 3.4 What Triggers a New Major Version

**Breaking changes (require new version):**
- Removing a field from response
- Renaming a field
- Changing a field's data type
- Removing an endpoint
- Changing authentication requirements
- Changing error response structure
- Changing enum values
- Changing pagination structure

**Non-breaking changes (same version):**
- Adding new optional fields to response
- Adding new optional query parameters
- Adding new endpoints
- Adding new enum values (with default handling)
- Adding new OAuth scopes
- Performance improvements
- Bug fixes

### 3.5 Deprecation Headers

When a version or endpoint is deprecated:

```http
HTTP/1.1 200 OK
Deprecation: Sun, 01 Jan 2028 00:00:00 GMT
Sunset: Sun, 01 Jan 2029 00:00:00 GMT
Link: <https://developer.twicely.com/migration/v1-to-v2>; rel="deprecation"
```

---

## 4. Authentication & Authorization

### 4.1 OAuth 2.0 Implementation

**Supported Flows:**

| Flow | Use Case | Token Lifetime |
|------|----------|----------------|
| Authorization Code | Web apps, user context | 1 hour (refresh: 90 days) |
| Authorization Code + PKCE | Mobile/SPA apps | 1 hour (refresh: 90 days) |
| Client Credentials | Server-to-server, no user | 1 hour (no refresh) |
| Refresh Token | Token renewal | N/A |

**Authorization Endpoint:**
```
https://auth.twicely.com/oauth/authorize
```

**Token Endpoint:**
```
https://auth.twicely.com/oauth/token
```

### 4.2 OAuth Scopes (Granular Permissions)

#### Buyer Scopes
| Scope | Description |
|-------|-------------|
| `buyer:profile:read` | Read buyer profile |
| `buyer:profile:write` | Update buyer profile |
| `buyer:orders:read` | View purchase history |
| `buyer:orders:write` | Place orders, request returns |
| `buyer:messages:read` | Read conversations |
| `buyer:messages:write` | Send messages |
| `buyer:watchlist:read` | View watchlist |
| `buyer:watchlist:write` | Add/remove watchlist items |
| `buyer:reviews:write` | Leave reviews |

#### Seller Scopes
| Scope | Description |
|-------|-------------|
| `seller:profile:read` | Read seller profile |
| `seller:profile:write` | Update seller profile |
| `seller:listings:read` | View listings |
| `seller:listings:write` | Create/edit/end listings |
| `seller:inventory:read` | View inventory levels |
| `seller:inventory:write` | Update inventory |
| `seller:orders:read` | View orders |
| `seller:orders:write` | Fulfill, cancel orders |
| `seller:shipping:read` | View shipping settings |
| `seller:shipping:write` | Create labels, update tracking |
| `seller:finances:read` | View earnings, fees, payouts |
| `seller:analytics:read` | View performance metrics |
| `seller:promotions:read` | View promotions |
| `seller:promotions:write` | Create/manage promotions |
| `seller:messages:read` | Read buyer messages |
| `seller:messages:write` | Reply to buyers |
| `seller:returns:read` | View return requests |
| `seller:returns:write` | Approve/deny returns |
| `seller:settings:read` | View store settings |
| `seller:settings:write` | Update store settings |

#### Bulk/Enterprise Scopes
| Scope | Description |
|-------|-------------|
| `bulk:listings:write` | Bulk listing operations |
| `bulk:inventory:write` | Bulk inventory updates |
| `bulk:orders:read` | Bulk order export |
| `feed:subscribe` | Real-time feed subscription |

#### Meta Scopes (Convenience)
| Scope | Expands To |
|-------|------------|
| `seller:full` | All seller:* scopes |
| `buyer:full` | All buyer:* scopes |
| `crosslist:standard` | listings:*, inventory:*, orders:read |

### 4.3 API Keys (Partner/Enterprise)

Partners receive API keys for:
- Higher rate limits
- Priority support
- Webhook delivery guarantees
- Beta feature access

```http
Authorization: Bearer {oauth_token}
X-Twicely-Api-Key: pk_live_xxxxxxxxxxxx
```

### 4.4 mTLS (Enterprise)

Enterprise integrations can use mutual TLS for:
- Certificate-based authentication
- IP allowlisting bypass
- Highest rate limits

---

## 5. Rate Limiting

### 5.1 Rate Limit Tiers

| Tier | Requests/Second | Requests/Day | Burst |
|------|-----------------|--------------|-------|
| Free Developer | 5 | 10,000 | 10 |
| Basic Partner | 25 | 100,000 | 50 |
| Premium Partner | 100 | 1,000,000 | 200 |
| Enterprise | Custom | Custom | Custom |

### 5.2 Rate Limit Headers

Every response includes:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
X-RateLimit-Policy: 100;w=1
Retry-After: 1  # Only on 429 responses
```

### 5.3 Rate Limit Scopes

Limits apply per:
- **Application** (client_id)
- **User** (access_token holder)
- **Endpoint category** (listings, orders, search)

### 5.4 Handling 429 Too Many Requests

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Retry after 1 second.",
  "retry_after": 1,
  "limit": 100,
  "remaining": 0,
  "reset": 1640000000,
  "documentation_url": "https://developer.twicely.com/rate-limits"
}
```

---

## 6. Request/Response Standards

### 6.1 Request Format

```http
POST /v1/listings HTTP/1.1
Host: api.twicely.com
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
Twicely-Version: 2026-01-23
Idempotency-Key: unique-request-id-12345
X-Request-Id: client-correlation-id

{
  "title": "Vintage Camera",
  "price": { "amount": 15000, "currency": "USD" },
  "condition": "USED_GOOD"
}
```

### 6.2 Response Format

**Success Response:**
```json
{
  "data": {
    "id": "lst_abc123",
    "type": "listing",
    "attributes": {
      "title": "Vintage Camera",
      "price": { "amount": 15000, "currency": "USD" },
      "status": "DRAFT",
      "created_at": "2026-01-23T12:00:00Z"
    },
    "relationships": {
      "seller": { "id": "usr_xyz789", "type": "user" },
      "category": { "id": "cat_electronics", "type": "category" }
    },
    "links": {
      "self": "https://api.twicely.com/v1/listings/lst_abc123",
      "images": "https://api.twicely.com/v1/listings/lst_abc123/images"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "api_version": "v1",
    "timestamp": "2026-01-23T12:00:00.123Z"
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "price.amount",
        "code": "INVALID_VALUE",
        "message": "Price must be greater than 0"
      }
    ],
    "documentation_url": "https://developer.twicely.com/errors/VALIDATION_ERROR"
  },
  "meta": {
    "request_id": "req_abc123",
    "api_version": "v1",
    "timestamp": "2026-01-23T12:00:00.123Z"
  }
}
```

### 6.3 Pagination

**Cursor-based pagination (recommended):**
```http
GET /v1/listings?limit=50&cursor=eyJpZCI6Imxz...
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6Imxz...",
    "prev_cursor": "eyJpZCI6Imxz..."
  }
}
```

**Offset-based pagination (legacy support):**
```http
GET /v1/listings?limit=50&offset=100
```

### 6.4 Filtering & Sorting

```http
GET /v1/listings?status=ACTIVE&category_id=cat_electronics&sort=-created_at&fields=id,title,price
```

| Parameter | Description | Example |
|-----------|-------------|---------|
| `filter[field]` | Filter by field | `filter[status]=ACTIVE` |
| `sort` | Sort field (- for desc) | `sort=-created_at` |
| `fields` | Sparse fieldsets | `fields=id,title,price` |
| `include` | Related resources | `include=seller,category` |

### 6.5 Idempotency

For POST/PUT/DELETE requests:

```http
Idempotency-Key: unique-client-generated-key
```

- Keys are valid for 24 hours
- Duplicate requests return cached response
- Required for financial operations

---

## 7. Webhooks

### 7.1 Webhook Events

#### Listing Events
| Event | Trigger |
|-------|---------|
| `listing.created` | New listing created |
| `listing.updated` | Listing modified |
| `listing.activated` | Listing went live |
| `listing.ended` | Listing ended |
| `listing.sold` | Listing sold (single item) |

#### Order Events
| Event | Trigger |
|-------|---------|
| `order.created` | New order placed |
| `order.paid` | Payment confirmed |
| `order.shipped` | Tracking uploaded |
| `order.delivered` | Delivery confirmed |
| `order.completed` | Order finalized |
| `order.cancelled` | Order cancelled |
| `order.refunded` | Refund processed |

#### Return Events
| Event | Trigger |
|-------|---------|
| `return.requested` | Buyer requested return |
| `return.approved` | Return approved |
| `return.received` | Return received by seller |
| `return.refunded` | Return refund processed |

#### Financial Events
| Event | Trigger |
|-------|---------|
| `payout.scheduled` | Payout scheduled |
| `payout.paid` | Payout sent |
| `payout.failed` | Payout failed |

#### Account Events
| Event | Trigger |
|-------|---------|
| `account.updated` | Account settings changed |
| `account.suspended` | Account suspended |
| `account.verified` | Verification completed |

### 7.2 Webhook Payload

```json
{
  "id": "evt_abc123",
  "type": "order.paid",
  "api_version": "v1",
  "created_at": "2026-01-23T12:00:00Z",
  "data": {
    "object": {
      "id": "ord_xyz789",
      "type": "order",
      "status": "PAID",
      "total": { "amount": 15000, "currency": "USD" }
    },
    "previous_attributes": {
      "status": "AWAITING_PAYMENT"
    }
  },
  "request": {
    "id": "req_original",
    "idempotency_key": "key_123"
  }
}
```

### 7.3 Webhook Security

**Signature Verification:**
```
Twicely-Signature: t=1640000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

Verification:
```javascript
const payload = timestamp + '.' + rawBody;
const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');
```

### 7.4 Webhook Delivery

- **Retry policy:** 3 retries with exponential backoff (1m, 10m, 1h)
- **Timeout:** 30 seconds per attempt
- **Ordering:** Best-effort ordering, use `created_at` for sequencing
- **Deduplication:** Use `id` field for idempotency

---

## 8. Bulk Operations API

For high-volume integrations (crosslisters, enterprise sellers):

### 8.1 Bulk Endpoints

```
POST /v1/bulk/listings/create
POST /v1/bulk/listings/update
POST /v1/bulk/inventory/update
GET  /v1/bulk/jobs/{job_id}
```

### 8.2 Bulk Request Format

```json
{
  "operations": [
    {
      "method": "create",
      "data": { "title": "Item 1", "price": {"amount": 1000, "currency": "USD"} }
    },
    {
      "method": "create", 
      "data": { "title": "Item 2", "price": {"amount": 2000, "currency": "USD"} }
    }
  ],
  "options": {
    "stop_on_error": false,
    "callback_url": "https://yourapp.com/webhooks/bulk"
  }
}
```

### 8.3 Bulk Response (Async)

```json
{
  "job_id": "job_abc123",
  "status": "processing",
  "total_operations": 100,
  "processed": 0,
  "succeeded": 0,
  "failed": 0,
  "estimated_completion": "2026-01-23T12:05:00Z",
  "status_url": "https://api.twicely.com/v1/bulk/jobs/job_abc123"
}
```

### 8.4 Bulk Limits

| Tier | Operations/Request | Concurrent Jobs |
|------|-------------------|-----------------|
| Basic Partner | 100 | 5 |
| Premium Partner | 1,000 | 20 |
| Enterprise | 10,000 | 100 |

---

## 9. Sandbox Environment

### 9.1 Sandbox Features

- Full API parity with production
- Test credit card numbers
- Simulated webhook delivery
- Accelerated time (disputes, payouts)
- No real money movement

### 9.2 Sandbox Credentials

```
Base URL: https://sandbox.api.twicely.com
OAuth: https://sandbox.auth.twicely.com
```

### 9.3 Test Data

| Test Card | Behavior |
|-----------|----------|
| 4242424242424242 | Always succeeds |
| 4000000000000002 | Always declines |
| 4000000000009995 | Insufficient funds |
| 4000000000000259 | Dispute after 1 minute |

---

## 10. Developer Portal

### 10.1 Portal Features

- **API Documentation:** OpenAPI 3.0 spec, interactive explorer
- **SDKs:** Official SDKs for JavaScript, Python, PHP, Ruby, Java, Go, C#
- **Code Samples:** Copy-paste examples for common use cases
- **Webhooks Tester:** Send test webhooks to your endpoint
- **API Logs:** Real-time request/response logging (7 days)
- **Changelog:** Version history, deprecation notices
- **Status Page:** API health, incident history

### 10.2 SDK Support

| Language | Package | Support Level |
|----------|---------|---------------|
| JavaScript/TypeScript | `@twicely/sdk` | Official |
| Python | `twicely` | Official |
| PHP | `twicely/twicely-php` | Official |
| Ruby | `twicely` | Official |
| Java | `com.twicely:sdk` | Official |
| Go | `github.com/twicely/go` | Official |
| C# | `Twicely.Sdk` | Official |

### 10.3 OpenAPI Specification

Available at:
```
https://api.twicely.com/v1/openapi.json
https://api.twicely.com/v1/openapi.yaml
```

---

## 11. Partner Program

### 11.1 Partner Tiers

| Tier | Requirements | Benefits |
|------|--------------|----------|
| **Registered** | Create account | Basic rate limits, sandbox |
| **Verified** | App review passed | Production access, standard limits |
| **Partner** | 100+ active users | Elevated limits, priority support |
| **Premier** | 10,000+ active users | Custom limits, dedicated support, beta access |

### 11.2 App Review Process

1. Submit app for review via developer portal
2. Provide demo credentials or video
3. Review takes 3-5 business days
4. Approval grants production OAuth credentials

### 11.3 Partner Benefits

- **Co-marketing:** Featured in Twicely app marketplace
- **Beta access:** Early access to new APIs
- **Support:** Direct Slack channel with API team
- **Revenue share:** Referral program for new sellers

---

## 12. Crosslister Integration Guide

### 12.1 Recommended Scopes

```
seller:listings:read
seller:listings:write
seller:inventory:read
seller:inventory:write
seller:orders:read
bulk:listings:write
```

### 12.2 Sync Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Crosslister   │────▶│  Twicely API    │────▶│   Twicely DB    │
│   (Your App)    │◀────│   + Webhooks    │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Other Markets  │
│ eBay, Poshmark  │
└─────────────────┘
```

### 12.3 Inventory Sync Best Practices

1. **Use webhooks** for real-time updates (not polling)
2. **Bulk API** for initial import/export
3. **Idempotency keys** for reliable updates
4. **Optimistic locking** via `version` field
5. **Handle conflicts** gracefully (last-write-wins or merge)

---

## 13. Compliance & Security

### 13.1 Data Access

- Apps only access data for authorized users
- Access tokens scoped to specific permissions
- Audit logs for all API access
- Data retention follows platform policies

### 13.2 Required Disclosures

Apps must disclose:
- What data they access
- How data is used
- Data retention policies
- Third-party sharing

### 13.3 Prohibited Uses

- Scraping without authorization
- Circumventing rate limits
- Storing payment credentials
- Reselling API access
- Automated purchasing (sniping)

---

## 14. Error Codes Reference

### 14.1 HTTP Status Codes

| Code | Meaning | Retry? |
|------|---------|--------|
| 200 | Success | - |
| 201 | Created | - |
| 204 | No Content | - |
| 400 | Bad Request | No |
| 401 | Unauthorized | No (refresh token) |
| 403 | Forbidden | No |
| 404 | Not Found | No |
| 409 | Conflict | Maybe |
| 422 | Unprocessable | No |
| 429 | Rate Limited | Yes (after delay) |
| 500 | Server Error | Yes |
| 503 | Unavailable | Yes |

### 14.2 Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | Missing or invalid token |
| `INSUFFICIENT_SCOPE` | Token lacks required scope |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `VALIDATION_ERROR` | Request validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `RESOURCE_CONFLICT` | Conflicting update (optimistic lock) |
| `INVALID_STATE` | Operation not allowed in current state |
| `PAYMENT_REQUIRED` | Seller account issue |
| `QUOTA_EXCEEDED` | Account limit reached |

---

## 15. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-23 | Initial specification |

---

# END CANONICAL
