# TWICELY TESTING REQUIREMENTS CANONICAL
**Status:** LOCKED (v1.0)  
**Scope:** Testing strategy, coverage requirements, CI/CD gates, environment management  
**Audience:** Engineers, QA, DevOps, release managers

---

## 1. Testing Philosophy

### 1.1 Core Principles

1. **Test the contract, not the implementation** - Tests validate behavior, not internal structure
2. **Fail fast, fail loud** - Tests should catch issues before production
3. **Doctor is the gate** - No phase passes without Doctor health checks
4. **Production parity** - Test environments mirror production
5. **Automated everything** - Manual testing is a code smell

### 1.2 Testing Pyramid

```
                    ┌─────────────────┐
                    │    E2E Tests    │  ← Few, slow, high confidence
                    │    (10-15%)     │
                    ├─────────────────┤
                    │  Integration    │  ← More, medium speed
                    │    (25-30%)     │
                    ├─────────────────┤
                    │   Unit Tests    │  ← Many, fast, focused
                    │    (55-65%)     │
                    └─────────────────┘
```

---

## 2. Unit Testing Requirements

### 2.1 Coverage Targets

| Component Type | Minimum Coverage | Target Coverage |
|----------------|-----------------|-----------------|
| Services (business logic) | 80% | 95% |
| State machines | 100% | 100% |
| Fee calculations | 100% | 100% |
| Validators | 90% | 100% |
| Utilities | 80% | 90% |
| API routes | 70% | 85% |
| React components | 60% | 80% |

### 2.2 Required Unit Tests by Domain

#### Identity & Auth
- [ ] User registration validation
- [ ] Email verification flow
- [ ] Password hashing/verification
- [ ] Session management
- [ ] OAuth token generation/validation
- [ ] Scope permission checks
- [ ] Delegated access validation

#### Listings
- [ ] Listing state machine transitions (ALL paths)
- [ ] Price validation (min/max, currency)
- [ ] Inventory quantity management
- [ ] Multi-quantity listing behavior
- [ ] Variation validation
- [ ] Image upload validation
- [ ] Category assignment rules
- [ ] Condition mapping

#### Orders
- [ ] Order state machine transitions (ALL 17 states)
- [ ] Order total calculation
- [ ] Tax calculation
- [ ] Shipping cost calculation
- [ ] Inventory reservation
- [ ] Inventory release on cancellation
- [ ] Bundle discount application

#### Payments & Fees
- [ ] Final Value Fee calculation (per tier)
- [ ] Insertion fee calculation
- [ ] Payment processing fee passthrough
- [ ] Promoted listing fee calculation
- [ ] Subscription fee calculation
- [ ] Category-specific fee overrides
- [ ] International fee calculation
- [ ] Ledger entry creation
- [ ] Ledger balance computation
- [ ] Payout eligibility checks (5 gates)

#### Trust & Safety
- [ ] Trust score calculation
- [ ] Trust score decay
- [ ] Trust band assignment
- [ ] Trust event delta application
- [ ] Search multiplier computation
- [ ] Seller standards calculation
- [ ] Band transition logic

#### Search
- [ ] Search eligibility rules
- [ ] Boost multiplier application
- [ ] Filter validation
- [ ] Pagination cursor encoding/decoding
- [ ] Sort parameter parsing

### 2.3 Unit Test Standards

```typescript
// GOOD: Descriptive, focused, isolated
describe('FeeCalculationService', () => {
  describe('calculateFinalValueFee', () => {
    it('should apply 13.25% for SELLER tier', () => {
      const fee = service.calculateFinalValueFee({
        salePriceCents: 10000,
        tier: 'SELLER',
        categoryId: 'general'
      });
      expect(fee).toBe(1325); // 13.25% of $100
    });

    it('should apply category override when present', () => {
      const fee = service.calculateFinalValueFee({
        salePriceCents: 10000,
        tier: 'SELLER',
        categoryId: 'motors' // Has 5% rate
      });
      expect(fee).toBe(500);
    });

    it('should throw for negative price', () => {
      expect(() => service.calculateFinalValueFee({
        salePriceCents: -100,
        tier: 'SELLER'
      })).toThrow('INVALID_PRICE');
    });
  });
});

// BAD: Vague, testing implementation
describe('FeeCalculationService', () => {
  it('works', () => {
    const result = service.calculateFinalValueFee({...});
    expect(result).toBeTruthy();
  });
});
```

### 2.4 Mocking Guidelines

**Mock:**
- External services (Stripe, email providers)
- Database calls (use in-memory or test DB)
- Time-dependent functions (use fake timers)
- Random/UUID generation

**Don't Mock:**
- Business logic under test
- Pure utility functions
- Validation rules

---

## 3. Integration Testing Requirements

### 3.1 Required Integration Tests

#### API Endpoints
- [ ] All CRUD operations for each resource
- [ ] Authentication/authorization flows
- [ ] Error responses (400, 401, 403, 404, 422)
- [ ] Rate limiting behavior
- [ ] Pagination
- [ ] Filtering and sorting
- [ ] Bulk operations

#### Database
- [ ] Prisma migrations run successfully
- [ ] Foreign key constraints enforced
- [ ] Unique constraints enforced
- [ ] Index performance (query plans)
- [ ] Transaction rollback on error

#### Webhooks
- [ ] Webhook payload generation
- [ ] Webhook signature creation
- [ ] Webhook delivery (mock endpoint)
- [ ] Webhook retry logic
- [ ] Idempotency key handling

#### External Services
- [ ] Stripe payment intent creation
- [ ] Stripe webhook processing
- [ ] Stripe Connect account creation
- [ ] Stripe refund processing
- [ ] Search index updates
- [ ] Email delivery (mock SMTP)

### 3.2 Integration Test Database

```typescript
// Use isolated test database
beforeAll(async () => {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS test_${testId}`);
  await prisma.$executeRawUnsafe(`SET search_path TO test_${testId}`);
  await runMigrations();
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP SCHEMA test_${testId} CASCADE`);
});

// OR use transactions that rollback
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

### 3.3 Stripe Test Mode

```typescript
// Use Stripe test mode with test API keys
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY);

// Use test card numbers
const testCards = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficient: '4000000000009995',
  dispute: '4000000000000259',
};
```

---

## 4. End-to-End Testing Requirements

### 4.1 Critical User Journeys

#### Buyer Journey
```
1. Browse → Search → View Listing → Add to Cart → Checkout → Pay
2. View Order → Track Shipment → Receive → Leave Review
3. View Order → Request Return → Ship Return → Receive Refund
4. View Order → Open Dispute → Resolution
```

#### Seller Journey
```
1. Register → Verify Identity → Connect Stripe → List Item
2. Receive Order → Print Label → Ship → Upload Tracking
3. View Payout → Withdraw to Bank
4. Receive Return → Approve → Process Refund
5. Bulk Upload → Manage Inventory → End Listings
```

#### Platform Journey (Corp Admin)
```
1. Review Flagged Listing → Take Action → Notify Seller
2. Process Dispute → Gather Evidence → Decide → Execute
3. View Dashboard → Export Reports → Reconcile
```

### 4.2 E2E Test Scenarios (Mandatory)

| ID | Scenario | Priority |
|----|----------|----------|
| E2E-001 | Complete purchase flow (BIN) | P0 |
| E2E-002 | Complete purchase flow (auction) | P0 |
| E2E-003 | Checkout with multiple items | P0 |
| E2E-004 | Payment failure and retry | P0 |
| E2E-005 | Order cancellation (pre-shipment) | P0 |
| E2E-006 | Full return flow | P0 |
| E2E-007 | Partial refund | P1 |
| E2E-008 | Dispute won by buyer | P1 |
| E2E-009 | Dispute won by seller | P1 |
| E2E-010 | Seller payout (happy path) | P0 |
| E2E-011 | Seller payout (blocked - verification) | P1 |
| E2E-012 | Listing creation (single item) | P0 |
| E2E-013 | Listing creation (with variations) | P1 |
| E2E-014 | Listing edit (active listing) | P1 |
| E2E-015 | Bulk listing upload | P1 |
| E2E-016 | Search and filter | P0 |
| E2E-017 | Add to watchlist | P2 |
| E2E-018 | Send message to seller | P1 |
| E2E-019 | Leave review | P1 |
| E2E-020 | Account suspension flow | P2 |

### 4.3 E2E Test Framework

**Recommended Stack:**
- **Playwright** for browser automation
- **API testing** via supertest or built-in fetch
- **Database seeding** via Prisma seed scripts
- **Visual regression** via Percy or Chromatic (optional)

```typescript
// Example E2E test
test('E2E-001: Complete purchase flow', async ({ page }) => {
  // Setup: Create test seller with listing
  const seller = await seedSeller();
  const listing = await seedListing({ sellerId: seller.id });
  
  // Test: Buyer purchases item
  await page.goto(`/listings/${listing.id}`);
  await page.click('[data-testid="buy-now"]');
  await page.fill('[data-testid="card-number"]', '4242424242424242');
  await page.click('[data-testid="pay-button"]');
  
  // Assert: Order created, webhook processed
  await expect(page).toHaveURL(/\/orders\/ord_/);
  await expect(page.locator('[data-testid="order-status"]')).toHaveText('Paid');
  
  // Verify: Database state
  const order = await prisma.order.findFirst({ where: { listingId: listing.id }});
  expect(order.status).toBe('PAID');
});
```

---

## 5. Doctor Health Check Testing

### 5.1 Doctor Test Requirements

Every Doctor health check must have:
1. **Unit test** for the check logic itself
2. **Integration test** for database queries
3. **Fixture data** for pass/fail scenarios

### 5.2 Doctor Test Patterns

```typescript
describe('OrderHealthProvider', () => {
  describe('check: stuck_orders', () => {
    it('should PASS when no orders stuck > 7 days', async () => {
      // Seed: Recent order
      await seedOrder({ status: 'AWAITING_FULFILLMENT', createdAt: daysAgo(3) });
      
      const result = await provider.check();
      expect(result.checks.find(c => c.id === 'stuck_orders').status).toBe('pass');
    });

    it('should WARN when orders stuck 7-14 days', async () => {
      await seedOrder({ status: 'AWAITING_FULFILLMENT', createdAt: daysAgo(10) });
      
      const result = await provider.check();
      expect(result.checks.find(c => c.id === 'stuck_orders').status).toBe('warn');
    });

    it('should FAIL when orders stuck > 14 days', async () => {
      await seedOrder({ status: 'AWAITING_FULFILLMENT', createdAt: daysAgo(20) });
      
      const result = await provider.check();
      expect(result.checks.find(c => c.id === 'stuck_orders').status).toBe('fail');
    });
  });
});
```

### 5.3 Phase Gate Testing

Each installation phase must pass:
1. All phase-specific Doctor checks
2. All prerequisite phase checks
3. Schema validation
4. API smoke tests

---

## 6. Performance Testing

### 6.1 Performance Targets

| Metric | Target | Threshold |
|--------|--------|-----------|
| API p50 latency | < 100ms | < 200ms |
| API p95 latency | < 500ms | < 1000ms |
| API p99 latency | < 1000ms | < 2000ms |
| Search latency | < 200ms | < 500ms |
| Checkout flow | < 3s | < 5s |
| Page load (LCP) | < 2.5s | < 4s |
| Database queries | < 50ms | < 100ms |

### 6.2 Load Testing Scenarios

| Scenario | Target RPS | Duration |
|----------|------------|----------|
| Normal load | 100 | 30 min |
| Peak load | 500 | 15 min |
| Stress test | 1000 | 5 min |
| Soak test | 100 | 4 hours |

### 6.3 Load Testing Tools

- **k6** for API load testing
- **Artillery** for complex scenarios
- **Lighthouse CI** for frontend performance

```javascript
// k6 example
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '30m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('https://api.twicely.com/v1/listings');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
```

---

## 7. Security Testing

### 7.1 Required Security Tests

| Test Type | Frequency | Tool |
|-----------|-----------|------|
| SAST (static analysis) | Every PR | Semgrep, CodeQL |
| Dependency scanning | Daily | Snyk, Dependabot |
| DAST (dynamic analysis) | Weekly | OWASP ZAP |
| Penetration testing | Quarterly | Manual + automated |
| API security | Every PR | Custom + OWASP |

### 7.2 Security Test Checklist

#### Authentication
- [ ] SQL injection in login
- [ ] Brute force protection
- [ ] Session fixation
- [ ] Token expiration enforced
- [ ] Refresh token rotation

#### Authorization
- [ ] IDOR (access other user's data)
- [ ] Privilege escalation
- [ ] Missing auth on endpoints
- [ ] Scope enforcement

#### Input Validation
- [ ] XSS in all input fields
- [ ] SQL injection in search/filter
- [ ] Path traversal in file uploads
- [ ] SSRF in URL inputs
- [ ] XML/JSON injection

#### Business Logic
- [ ] Price manipulation
- [ ] Quantity manipulation
- [ ] Race conditions in checkout
- [ ] Inventory overselling
- [ ] Fee bypass attempts

---

## 8. Test Data Management

### 8.1 Seed Data Strategy

```
/prisma/seed/
├── base/                    # Minimal data for all tests
│   ├── categories.ts
│   ├── regions.ts
│   └── fee-schedules.ts
├── fixtures/                # Scenario-specific data
│   ├── active-marketplace.ts
│   ├── dispute-scenarios.ts
│   └── performance-load.ts
└── factories/               # Dynamic data generation
    ├── user.factory.ts
    ├── listing.factory.ts
    └── order.factory.ts
```

### 8.2 Factory Pattern

```typescript
// factories/listing.factory.ts
export const listingFactory = {
  build: (overrides = {}) => ({
    id: `lst_${nanoid()}`,
    title: faker.commerce.productName(),
    priceCents: faker.number.int({ min: 100, max: 100000 }),
    status: 'DRAFT',
    ...overrides,
  }),
  
  create: async (overrides = {}) => {
    return prisma.listing.create({
      data: listingFactory.build(overrides),
    });
  },
  
  createActive: async (overrides = {}) => {
    return listingFactory.create({
      status: 'ACTIVE',
      activatedAt: new Date(),
      ...overrides,
    });
  },
};
```

### 8.3 Data Isolation

- Each test file gets isolated database schema/transaction
- No shared mutable state between tests
- Cleanup runs automatically after each test
- CI runs tests in parallel with isolated DBs

---

## 9. CI/CD Integration

### 9.1 Pipeline Stages

```yaml
stages:
  - lint        # < 2 min
  - unit        # < 5 min
  - integration # < 10 min
  - e2e         # < 15 min
  - security    # < 10 min
  - performance # (nightly only)
```

### 9.2 PR Requirements

| Check | Required | Blocking |
|-------|----------|----------|
| Lint (ESLint, Prettier) | Yes | Yes |
| Type check (tsc) | Yes | Yes |
| Unit tests | Yes | Yes |
| Integration tests | Yes | Yes |
| Coverage threshold | Yes | Yes (drop = block) |
| Security scan (SAST) | Yes | Critical = block |
| E2E smoke tests | Yes | Yes |
| Full E2E | No | Nightly only |

### 9.3 Coverage Enforcement

```yaml
# jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  './src/services/': {
    branches: 90,
    functions: 90,
    lines: 90,
  },
  './src/services/payments/': {
    branches: 100,
    functions: 100,
    lines: 100,
  },
}
```

### 9.4 Test Artifacts

Every CI run produces:
- Coverage report (HTML + Codecov)
- Test results (JUnit XML)
- E2E screenshots/videos on failure
- Performance traces (on performance runs)

---

## 10. Test Environment Management

### 10.1 Environments

| Environment | Purpose | Data | Reset Frequency |
|-------------|---------|------|-----------------|
| Local | Developer testing | Seed data | On demand |
| CI | Automated tests | Ephemeral | Per run |
| Staging | Pre-release validation | Production-like | Weekly |
| Sandbox | Partner testing | Test data | Never (managed) |
| Production | Live | Real | Never |

### 10.2 Environment Parity

- All environments use same Docker images
- Same PostgreSQL version
- Same Redis version
- Same Elasticsearch version
- Same environment variables (different values)

### 10.3 Feature Flags in Tests

```typescript
// Enable/disable features for specific tests
beforeEach(() => {
  setFeatureFlags({
    'variations.enabled': true,
    'promoted-listings.enabled': false,
  });
});
```

---

## 11. Acceptance Criteria

### 11.1 Definition of Done (Testing)

A feature is "done" when:
- [ ] Unit tests written (meeting coverage targets)
- [ ] Integration tests written (API + DB)
- [ ] E2E test for critical path (if applicable)
- [ ] Doctor health check (if new subsystem)
- [ ] Documentation updated
- [ ] All CI checks passing
- [ ] Code reviewed and approved

### 11.2 Release Criteria

A release is approved when:
- [ ] All P0 E2E tests passing
- [ ] No critical security findings
- [ ] Performance within thresholds
- [ ] Doctor --mode=production passing
- [ ] Staging smoke tests passing
- [ ] Rollback plan documented

---

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-23 | Initial specification |

---

# END CANONICAL
