# TWICELY V3 — Testing Standards

**Version:** v1.0 | **Date:** 2026-02-17 | **Status:** LOCKED

---

## 1. TESTING PYRAMID

| Layer | Tool | Scope | Minimum Coverage |
|-------|------|-------|-----------------|
| Unit | Vitest | Business logic, utilities, helpers | 80% of logic files |
| Integration | Vitest + test DB | API routes, server actions, DB queries | Every API route |
| E2E | Playwright | Full user flows, cross-browser | Every primary user flow |
| Visual | Playwright screenshots | UI regression | Key pages at 375px, 768px, 1280px |

---

## 2. UNIT TESTS (Vitest)

### What to test
- Fee calculations (TF, combined shipping, auth cost split, local fee)
- CASL permission checks (all 6 actor types)
- Business rule validation (offer expiry, claim windows, payout frequency)
- State machine transitions (order, return, dispute, authentication)
- Data transforms (import mapping, crosslister adapters)
- Utility functions (slug generation, currency formatting, pHash)

### What NOT to unit test
- UI rendering (use E2E instead)
- Database queries (use integration tests)
- Third-party API responses (mock at integration level)

### Naming convention
```
describe('calculateTF', () => {
  it('applies 10% rate for first $499 of monthly GMV', () => { ... });
  it('applies 11% marginal rate for $500-$1,999 bracket', () => { ... });
  it('enforces $0.50 minimum TF per order', () => { ... });
});
```

File naming: `*.test.ts` colocated next to source file.

---

## 3. INTEGRATION TESTS (Vitest + Test DB)

### Setup
- Dedicated test database (Neon branch or local PostgreSQL)
- Seed with known test data before each suite
- Transactions rolled back after each test (or truncate + reseed)

### What to test
- Every server action: valid input → expected DB state
- Every API route: request → response shape + status code
- Authorization: each actor type can/cannot perform expected actions
- Stripe webhooks: mock webhook → correct order/subscription state
- BullMQ jobs: enqueue → process → expected side effects

### Required per slice
Before a slice is considered done, it must have integration tests for:
- Happy path (primary flow works)
- Auth gate (unauthenticated → 401, wrong role → 403)
- Validation (bad input → 400 with error details)
- Edge case (concurrent access, already-sold item, expired offer)

---

## 4. E2E TESTS (Playwright)

### Primary User Flows (must pass before merge)

| Flow | Steps | Critical Assertions |
|------|-------|-------------------|
| Browse → Buy | Homepage → search → listing → add to cart → checkout → confirm | Order created, payment captured |
| List Item | Dashboard → new listing → fill form → upload images → activate | Listing ACTIVE, searchable |
| Make Offer | Listing → submit offer → seller accepts → order created | Hold captured, converted to charge |
| Return | Order → request return → ship back → refund | Return status transitions, refund issued |
| Import | Connect eBay → select listings → import → verify active | Listings ACTIVE, images transferred |
| Local Pickup | Listing → local checkout → QR confirm | Escrow released, order completed |

### Viewport Targets
- 375px (iPhone SE — minimum supported)
- 768px (iPad)
- 1280px (Desktop)

### Browser Targets
- Chromium (required)
- Firefox (required)
- WebKit (nice to have, run weekly)

---

## 5. PERFORMANCE TARGETS

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse CI |
| FID (First Input Delay) | < 100ms | Lighthouse CI |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse CI |
| TTFB (Time to First Byte) | < 200ms | Server monitoring |
| API response (P95) | < 500ms | Prometheus |
| API response (P99) | < 1000ms | Prometheus |
| Search query | < 200ms | Typesense metrics |
| Image load | < 1s (R2 + CDN) | RUM |

### Load Targets
- 100 concurrent users: all metrics within target
- 1,000 concurrent users: P95 within 2x target
- 10,000 concurrent users: no errors, graceful degradation

---

## 6. CI GATES (GitHub Actions)

Every PR must pass before merge:

| Gate | Command | Blocks Merge |
|------|---------|-------------|
| TypeScript compile | `tsc --noEmit` | ✅ Yes |
| Lint | `eslint . --max-warnings 0` | ✅ Yes |
| Unit tests | `vitest run` | ✅ Yes |
| Integration tests | `vitest run --config vitest.integration.ts` | ✅ Yes |
| E2E tests (Chromium) | `playwright test --project=chromium` | ✅ Yes |
| Build | `next build` | ✅ Yes |
| Bundle size | Check: < 250KB first load JS | ⚠️ Warning |
| Lighthouse | Check: all Core Web Vitals green | ⚠️ Warning |

### Pipeline Order
```
1. Install dependencies (cached)
2. TypeScript compile
3. Lint
4. Unit tests (parallel)
5. Integration tests (sequential, test DB)
6. Build
7. E2E tests (parallel, 3 browsers)
8. Lighthouse audit
9. Bundle size check
```

---

## 7. TEST DATA PRINCIPLES

- Test users: `test-buyer-1@twicely.co`, `test-seller-1@twicely.co`, etc.
- Test passwords: `TestPassword123!` (never used in production)
- Test Stripe: use Stripe test mode cards (`4242424242424242`)
- Test data must be deterministic — same seed produces same state
- No test depends on another test's side effects (isolation)
- Factories over fixtures: `createTestListing({ priceCents: 5000 })` not hardcoded JSON

---

## 8. COVERAGE REQUIREMENTS

| Category | Minimum | Ideal |
|----------|---------|-------|
| Fee calculations | 100% | 100% |
| CASL permissions | 100% | 100% |
| State machines | 95% | 100% |
| Server actions | 80% | 90% |
| API routes | 80% | 90% |
| UI components | 60% | 75% |
| Overall | 70% | 85% |

Fee calculations and CASL permissions are 100% mandatory — money and security cannot have gaps.
