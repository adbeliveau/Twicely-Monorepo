# TWICELY V3 — Developer Platform (Designed Now, Built Post-Launch)

**Version:** v1.0 | **Date:** 2026-02-17 | **Status:** DEFERRED (design locked, implementation post-launch)

---

## 1. WHY DEFERRED

Developer platform is a growth multiplier but not a launch requirement. Twicely needs 10K+ sellers and proven marketplace mechanics before opening APIs to third parties. Design now so architecture doesn't paint us into a corner.

---

## 2. API VERSIONING

- Base URL: `api.twicely.co/v1/`
- Versioning in URL path (not headers)
- Breaking changes → new version. Non-breaking changes → same version.
- Deprecation: 12-month notice before version sunset
- Rate limits: 100 req/min (free), 1,000 req/min (paid), custom (enterprise)

---

## 3. AUTHENTICATION

- OAuth 2.0 with PKCE for third-party apps
- API keys for server-to-server integrations
- Scopes: `listings:read`, `listings:write`, `orders:read`, `orders:write`, `profile:read`, `analytics:read`
- Seller grants permission to third-party app via OAuth consent screen
- Tokens: 1-hour access token, 30-day refresh token
- Revocation: seller can revoke at any time from `/my/settings/apps`

---

## 4. WEBHOOKS

| Event | Payload | Use Case |
|-------|---------|----------|
| `listing.created` | Listing object | Inventory sync |
| `listing.updated` | Changed fields | Price monitoring |
| `listing.sold` | Listing + order summary | Cross-delist |
| `order.created` | Order object | Fulfillment |
| `order.shipped` | Order + tracking | Notification |
| `order.completed` | Order + review | Analytics |
| `offer.received` | Offer object | Auto-response |
| `return.requested` | Return object | Dispute management |
| `payout.sent` | Payout summary | Accounting |

Delivery: HTTPS POST with HMAC-SHA256 signature. Retry: 3 attempts with exponential backoff. Dead letter queue after 3 failures.

---

## 5. SANDBOX

- Separate environment: `sandbox.api.twicely.co`
- Test data auto-seeded (same as dev seed)
- Stripe test mode integrated
- No real money, no real emails
- Rate limits relaxed (10,000 req/min)
- Data resets weekly

---

## 6. PARTNER PROGRAM

### Tier 1: Community (Free)
- API access (100 req/min)
- Sandbox access
- Community forum support
- Listed in "Community Apps" directory

### Tier 2: Verified Partner ($99/mo)
- API access (1,000 req/min)
- Priority webhook delivery
- Partner badge in app directory
- Email support (48hr SLA)
- Beta access to new APIs

### Tier 3: Premier Partner (Custom)
- Custom rate limits
- Dedicated account manager
- Co-marketing opportunities
- Revenue share on referred sellers
- SLA guarantees

---

## 7. SDK

Languages: TypeScript (official), Python (official), PHP (community), Ruby (community).

```typescript
import { TwicelyClient } from '@twicely/sdk';

const client = new TwicelyClient({
  apiKey: 'twk_live_xxxx',
  version: 'v1'
});

const listings = await client.listings.list({ status: 'ACTIVE', limit: 50 });
const order = await client.orders.get('order_abc123');
```

---

## 8. ARCHITECTURE IMPLICATIONS (Build Now)

Even though the developer platform is post-launch, these architectural decisions must be made now:

| Decision | Impact | When |
|----------|--------|------|
| API routes return typed JSON (not HTML) | All B-G API routes | Now |
| Rate limiting middleware exists | Phase E (feature flags) | Phase E |
| Webhook event system in BullMQ | Phase E (notifications) | Phase E |
| OAuth2 tables in schema | Schema v1.2 | Now (deferred tables) |
| HMAC signing utility | Shared utils | Phase E |

**Key:** every server action and API route we build now should return well-typed JSON responses. This makes the eventual public API a thin wrapper, not a rewrite.

---

## 9. TIMELINE

- **Pre-launch:** Architecture decisions locked, API response shapes standardized
- **Launch + 3 months:** API v1 beta (invite-only partners)
- **Launch + 6 months:** API v1 GA + SDK + sandbox
- **Launch + 9 months:** Partner program + app directory
- **Launch + 12 months:** Webhook GA + premier partners
