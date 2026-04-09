# TWICELY_BUYER_PROTECTION_CANONICAL.md
**Status:** LOCKED (v2.0)  
**Scope:** Buyer protection, returns, refunds, disputes, claims, category coverage, seller protection scores, appeals, chargebacks, and transparency.  
**Audience:** Trust & Safety, payments, support, and AI agents.  
**Replaces:** `TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md` (v1)

---

## 1. Purpose

This canonical defines **how Twicely protects buyers and resolves problems after a sale**.

It ensures:
- buyers have clear, category-appropriate coverage
- sellers have fair appeal rights and visibility into their standing
- disputes follow transparent, time-bound processes
- the platform maintains financial integrity
- all parties understand the rules through public transparency

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Buyer protection is a feature, not a cost**  
   Trust drives marketplace growth.

2. **Category-appropriate coverage**  
   High-value categories may have different limits than low-value ones.

3. **Seller protection scores drive accountability**  
   Sellers see their standing and can improve it.

4. **Appeals are a right, not a privilege**  
   Every resolution can be appealed with evidence.

5. **Transparency builds trust**  
   Coverage rules are public; buyers know what they're getting.

6. **Evidence-based decisions**  
   Photos, tracking, and communication drive outcomes.

7. **Audit everything**  
   Every decision is logged and reviewable.

---

## 3. Claim Types

### 3.1 Supported Claim Types

| Type | Code | Window | Description |
|------|------|--------|-------------|
| Item Not Received | INR | 30 days | Item never arrived |
| Item Not As Described | INAD | 30 days | Item differs from listing |
| Item Damaged | DAMAGED | 30 days | Item damaged in transit |
| Counterfeit | COUNTERFEIT | 180 days | Item is not authentic |
| Buyer Remorse | REMORSE | Per policy | Changed mind (if seller allows) |
| Other | OTHER | 30 days | Other issues |

### 3.2 Claim Model

```ts
type BuyerProtectionClaim = {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  
  // Claim details
  claimType: ClaimType;
  description: string;
  evidenceUrls: string[];
  
  // Status
  status: ClaimStatus;
  
  // Coverage determination
  coverageResult: CoverageResult;
  maxRefundCents: number;
  deductibleCents: number;
  
  // Resolution
  resolution?: ClaimResolution;
  resolutionReason?: string;
  refundAmountCents?: number;
  
  // Timeline (NEW)
  timelineEvents: TimelineEvent[];
  
  // SLA tracking
  sellerResponseDeadline: Date;
  sellerRespondedAt?: Date;
  escalatedAt?: Date;
  resolvedAt?: Date;
  
  // Appeal tracking
  appealId?: string;
  
  createdAt: Date;
  updatedAt: Date;
};

type ClaimStatus =
  | "OPEN"
  | "AWAITING_SELLER"
  | "AWAITING_BUYER"
  | "UNDER_REVIEW"
  | "ESCALATED"
  | "RESOLVED"
  | "APPEALED"
  | "CLOSED";

type ClaimResolution =
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "RETURN_REQUIRED"
  | "NO_REFUND"
  | "REPLACED"
  | "WITHDRAWN";
```

---

## 4. Category Coverage Limits (NEW)

### 4.1 Category Coverage Model

```ts
type CategoryCoverageLimit = {
  id: string;
  categoryId: string;
  
  // Coverage limits
  maxCoverageCents: number;        // Max refund for this category
  deductibleCents: number;         // Buyer pays this portion
  
  // Evidence requirements
  requiresEvidence: boolean;       // Photos required?
  evidenceTypes: string[];         // ["photo", "video", "receipt"]
  
  // Auto-approval threshold
  autoApproveUnderCents: number;   // Claims under this auto-approve
  
  // Special rules
  extendedWindowDays?: number;     // Override default window
  requiresReturn: boolean;         // Must return item for refund?
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

### 4.2 Default Coverage Limits

| Category | Max Coverage | Deductible | Auto-Approve Under | Requires Evidence |
|----------|--------------|------------|-------------------|-------------------|
| Electronics | $5,000 | $0 | $100 | Yes |
| Luxury/Designer | $10,000 | $0 | $0 | Yes (+ authentication) |
| Clothing | $2,000 | $0 | $150 | Yes |
| Collectibles | $5,000 | $0 | $100 | Yes |
| Books/Media | $500 | $0 | $50 | No |
| Home/Garden | $2,000 | $0 | $100 | Yes |
| Default | $5,000 | $0 | $100 | Yes |

### 4.3 Coverage Determination

```ts
async function determineCoverage(claim: BuyerProtectionClaim): Promise<CoverageResult> {
  const order = await getOrder(claim.orderId);
  const listing = await getListing(order.listingId);
  
  // Get category-specific limits
  const categoryLimit = await getCategoryLimit(listing.categoryId);
  const limit = categoryLimit ?? getDefaultLimit();
  
  // Calculate max refund
  let maxRefundCents = Math.min(order.totalCents, limit.maxCoverageCents);
  
  // Apply deductible
  maxRefundCents = Math.max(0, maxRefundCents - limit.deductibleCents);
  
  // Check auto-approve eligibility
  const autoApproveEligible = 
    order.totalCents <= limit.autoApproveUnderCents &&
    !limit.requiresEvidence;
  
  // Get seller's protection score for context
  const sellerScore = await getSellerProtectionScore(claim.sellerId);
  
  return {
    eligible: true,
    maxRefundCents,
    deductibleCents: limit.deductibleCents,
    requiresEvidence: limit.requiresEvidence,
    requiresReturn: limit.requiresReturn,
    autoApproveEligible,
    sellerProtectionScore: sellerScore?.score,
    categoryLimitId: limit.id,
  };
}
```

---

## 5. Seller Protection Score (NEW)

### 5.1 Seller Protection Score Model

```ts
type SellerProtectionScore = {
  id: string;
  sellerId: string;
  
  // Score (0-100)
  score: number;
  tier: SellerProtectionTier;
  
  // Component metrics (rolling 90 days)
  claimsLast90Days: number;
  claimsResolvedFavorably: number;   // Resolved in seller's favor
  claimsLostCount: number;            // Resolved against seller
  
  // Appeal performance
  appealsFiled: number;
  appealsWon: number;
  appealWinRate: number;
  
  // Response metrics
  averageResponseHours: number;
  
  // Factors
  factorsJson: ScoreFactors;
  
  // Tracking
  lastComputedAt: Date;
  nextComputeAt: Date;
};

type SellerProtectionTier =
  | "EXCELLENT"   // 90-100
  | "GOOD"        // 70-89
  | "FAIR"        // 50-69
  | "POOR";       // 0-49

type ScoreFactors = {
  claimRate: number;           // Claims per 100 orders
  resolutionRate: number;      // % resolved favorably
  responseTime: number;        // Avg hours to respond
  appealSuccessRate: number;   // % appeals won
  trackingRate: number;        // % orders with tracking
  deliveryRate: number;        // % delivered on time
};
```

### 5.2 Score Computation

```ts
async function computeSellerProtectionScore(sellerId: string): Promise<SellerProtectionScore> {
  const since = daysAgo(90);
  
  // Get metrics
  const orders = await getOrderCount(sellerId, since);
  const claims = await getClaimsAgainstSeller(sellerId, since);
  const appeals = await getAppeals(sellerId, since);
  
  // Calculate factors
  const claimRate = (claims.total / orders) * 100;
  const resolutionRate = claims.total > 0 ? (claims.favorableToBuyer / claims.total) * 100 : 100;
  const appealWinRate = appeals.total > 0 ? (appeals.won / appeals.total) * 100 : 0;
  const avgResponseHours = await getAverageResponseTime(sellerId, since);
  
  // Compute score
  let score = 100;
  
  // Deductions
  score -= claims.lostCount * 5;                    // -5 per claim lost
  score -= Math.max(0, claimRate - 2) * 10;         // -10 per % claim rate above 2%
  score -= Math.max(0, avgResponseHours - 24) * 0.5; // -0.5 per hour above 24h response
  
  // Bonuses
  score += appeals.won * 3;                          // +3 per appeal won
  score += (resolutionRate > 90 ? 5 : 0);           // +5 for >90% favorable resolution
  
  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determine tier
  const tier = score >= 90 ? "EXCELLENT" 
             : score >= 70 ? "GOOD"
             : score >= 50 ? "FAIR"
             : "POOR";
  
  return {
    sellerId,
    score,
    tier,
    claimsLast90Days: claims.total,
    claimsResolvedFavorably: claims.favorableToSeller,
    claimsLostCount: claims.lostCount,
    appealsFiled: appeals.total,
    appealsWon: appeals.won,
    appealWinRate,
    averageResponseHours: avgResponseHours,
    lastComputedAt: new Date(),
    nextComputeAt: addHours(new Date(), 24),
  };
}
```

### 5.3 Score Refresh Schedule

- **Daily:** Recompute all active sellers
- **On-demand:** After claim resolution or appeal decision
- **Display:** Seller dashboard shows score with breakdown

---

## 6. Seller Appeal Workflow (NEW)

### 6.1 Appeal Model

```ts
type SellerAppeal = {
  id: string;
  claimId: string;
  sellerId: string;
  
  // Appeal details
  reason: AppealReason;
  description: string;
  evidenceUrls: string[];
  
  // Status
  status: AppealStatus;
  
  // Review
  reviewedByStaffId?: string;
  reviewedAt?: Date;
  
  // Decision
  decision?: AppealDecision;
  decisionReason?: string;
  
  // Outcome
  refundReversed: boolean;
  refundReversedAmountCents?: number;
  scoreAdjustment?: number;
  
  createdAt: Date;
  updatedAt: Date;
};

type AppealReason =
  | "BUYER_ABUSE"           // Buyer is gaming the system
  | "EVIDENCE_INVALID"      // Evidence doesn't support claim
  | "POLICY_MISAPPLIED"     // Wrong policy applied
  | "ITEM_RETURNED_DAMAGED" // Buyer damaged item
  | "TRACKING_SHOWS_DELIVERED" // Item was delivered
  | "OTHER";

type AppealStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DENIED"
  | "WITHDRAWN";

type AppealDecision =
  | "OVERTURN_FULL"    // Full reversal
  | "OVERTURN_PARTIAL" // Partial reversal
  | "UPHELD"           // Original decision stands
  | "MODIFIED";        // Decision modified
```

### 6.2 Appeal Rules

1. **30-day appeal window** from claim resolution
2. **One appeal per claim** (no re-appeals)
3. **Evidence required** (photos, tracking, communication)
4. **48-hour review SLA** for platform
5. **Seller notified of decision** with reasoning

### 6.3 Appeal Processing

```ts
async function processAppeal(appealId: string, decision: AppealDecision, reason: string): Promise<void> {
  const appeal = await getAppeal(appealId);
  const claim = await getClaim(appeal.claimId);
  
  await db.$transaction(async (tx) => {
    // Update appeal
    await tx.sellerAppeal.update({
      where: { id: appealId },
      data: {
        status: decision === "UPHELD" ? "DENIED" : "APPROVED",
        decision,
        decisionReason: reason,
        reviewedAt: new Date(),
      },
    });
    
    // If overturned, reverse refund
    if (decision === "OVERTURN_FULL" || decision === "OVERTURN_PARTIAL") {
      const reverseAmount = decision === "OVERTURN_FULL" 
        ? claim.refundAmountCents 
        : Math.floor(claim.refundAmountCents! / 2);
      
      await reverseRefund(claim.orderId, reverseAmount);
      
      await tx.sellerAppeal.update({
        where: { id: appealId },
        data: {
          refundReversed: true,
          refundReversedAmountCents: reverseAmount,
        },
      });
    }
    
    // Update seller protection score
    if (decision !== "UPHELD") {
      await adjustSellerScore(appeal.sellerId, +3); // Bonus for successful appeal
    }
    
    // Emit audit event
    await emitAuditEvent({
      action: "appeal.decided",
      entityType: "SellerAppeal",
      entityId: appealId,
      meta: { decision, reason },
    });
  });
  
  // Notify seller
  await sendAppealDecisionNotification(appeal.sellerId, decision, reason);
}
```

---

## 7. Dispute Timeline (NEW)

### 7.1 Timeline Event Model

```ts
type TimelineEvent = {
  id: string;
  claimId: string;
  
  eventType: TimelineEventType;
  description: string;
  actorType: "BUYER" | "SELLER" | "SYSTEM" | "STAFF";
  actorId?: string;
  
  // Additional data
  metaJson?: Record<string, any>;
  
  occurredAt: Date;
};

type TimelineEventType =
  | "CLAIM_OPENED"
  | "EVIDENCE_ADDED"
  | "SELLER_RESPONDED"
  | "BUYER_REPLIED"
  | "ESCALATED"
  | "AUTO_APPROVED"
  | "REFUND_ISSUED"
  | "PARTIAL_REFUND_ISSUED"
  | "RETURN_REQUESTED"
  | "RETURN_SHIPPED"
  | "RETURN_DELIVERED"
  | "RESOLVED"
  | "APPEAL_FILED"
  | "APPEAL_DECIDED"
  | "APPEAL_DENIED"
  | "CLOSED";
```

### 7.2 Timeline Recording

```ts
async function recordTimelineEvent(args: {
  claimId: string;
  eventType: TimelineEventType;
  actorType: string;
  actorId?: string;
  description: string;
  meta?: Record<string, any>;
}): Promise<void> {
  await createTimelineEvent({
    claimId: args.claimId,
    eventType: args.eventType,
    description: args.description,
    actorType: args.actorType,
    actorId: args.actorId,
    metaJson: args.meta,
    occurredAt: new Date(),
  });
}

// Auto-record on claim actions
async function onClaimOpened(claim: BuyerProtectionClaim) {
  await recordTimelineEvent({
    claimId: claim.id,
    eventType: "CLAIM_OPENED",
    actorType: "BUYER",
    actorId: claim.buyerId,
    description: `Claim opened: ${claim.claimType}`,
  });
}
```

### 7.3 Timeline Display

Timeline is visible to:
- **Buyer:** Full timeline of their claim
- **Seller:** Timeline events they're involved in
- **Staff:** Full timeline with internal notes

---

## 8. Protection Badge (NEW)

### 8.1 Badge Model

```ts
type ProtectionBadge = {
  eligible: boolean;
  badgeText: string;              // "Buyer Protection"
  coverageAmountCents: number;
  coverageDescription: string;    // "Get a full refund if..."
  learnMoreUrl: string;           // "/protection"
};
```

### 8.2 Badge Generation

```ts
async function getProtectionBadge(listingId: string): Promise<ProtectionBadge> {
  const listing = await getListing(listingId);
  const categoryLimit = await getCategoryLimit(listing.categoryId);
  const limit = categoryLimit ?? getDefaultLimit();
  
  const coverageAmount = Math.min(listing.priceCents, limit.maxCoverageCents);
  
  return {
    eligible: true,
    badgeText: "Buyer Protection",
    coverageAmountCents: coverageAmount,
    coverageDescription: `Get a full refund if the item isn't as described or doesn't arrive. Coverage up to $${(coverageAmount / 100).toFixed(0)}.`,
    learnMoreUrl: "/protection",
  };
}
```

### 8.3 Badge Display

- Show on listing pages
- Show in search results (icon only)
- Show in cart
- Show in checkout summary

---

## 9. Public Protection Page (NEW)

### 9.1 Page Content

**URL:** `/protection`

**Sections:**
1. **Hero:** "Shop with confidence - You're protected"
2. **Coverage Types:** INR, INAD, Damaged, Counterfeit
3. **How It Works:** 3-step process
4. **Coverage Limits:** Category-specific limits table
5. **Seller Protection Scores:** How sellers are rated
6. **FAQ:** Common questions
7. **Stats:** "98% of claims resolved, 3-day average"

### 9.2 Data Requirements

```ts
type ProtectionPageData = {
  coverageTypes: Array<{
    type: string;
    title: string;
    description: string;
    windowDays: number;
    icon: string;
  }>;
  
  howItWorks: Array<{
    step: number;
    title: string;
    description: string;
  }>;
  
  categoryLimits: Array<{
    category: string;
    maxCoverage: string;
    requirements: string;
  }>;
  
  stats: {
    claimsResolved: number;        // Percentage
    avgResolutionDays: number;
    appealSuccessRate: number;
  };
  
  faq: Array<{
    question: string;
    answer: string;
  }>;
};
```

---

## 10. Return Flow

### 10.1 Return Eligibility

| Reason | Eligible | Return Required |
|--------|----------|-----------------|
| Item Not Received | Yes | No |
| Item Not As Described | Yes | Yes (usually) |
| Item Damaged | Yes | Sometimes |
| Counterfeit | Yes | Yes |
| Buyer Remorse | Per seller policy | Yes |

### 10.2 Return Process

```ts
async function initiateReturn(claim: BuyerProtectionClaim): Promise<void> {
  // Determine if return required
  const coverage = await determineCoverage(claim);
  
  if (!coverage.requiresReturn) {
    // Direct refund without return
    await processRefund(claim);
    return;
  }
  
  // Create return request
  await createReturnRequest({
    claimId: claim.id,
    orderId: claim.orderId,
    returnReasonCode: claim.claimType,
  });
  
  // Generate return label (if platform pays)
  const settings = await getShippingSettings();
  if (settings.returnLabelFundingModel === "platform") {
    await generateReturnLabel(claim.orderId);
  }
  
  // Update claim
  await updateClaim(claim.id, {
    status: "AWAITING_BUYER",
  });
  
  // Timeline event
  await recordTimelineEvent({
    claimId: claim.id,
    eventType: "RETURN_REQUESTED",
    actorType: "SYSTEM",
    description: "Return label generated - please ship item back",
  });
}
```

---

## 11. Refund Rules

### 11.1 Refund Timing

| Scenario | Refund Timing |
|----------|---------------|
| Auto-approved | Immediate |
| Seller accepts | Within 24h |
| Escalated (platform decides) | After review (48h SLA) |
| Return required | After item received |

### 11.2 Refund Amounts

```ts
function calculateRefundAmount(claim: BuyerProtectionClaim): number {
  const order = getOrder(claim.orderId);
  const coverage = claim.coverageResult;
  
  let amount = order.totalCents;
  
  // Cap at category limit
  amount = Math.min(amount, coverage.maxRefundCents);
  
  // Subtract deductible
  amount = Math.max(0, amount - coverage.deductibleCents);
  
  // Subtract restocking fee if applicable
  if (claim.claimType === "REMORSE" && order.restockingFeePercent) {
    amount = amount * (1 - order.restockingFeePercent / 100);
  }
  
  return Math.round(amount);
}
```

### 11.3 Ledger Impact

Refund creates:
- `REFUND_DEBIT` on seller ledger
- `REFUND_CREDIT` on buyer (payment provider)
- `PLATFORM_REFUND_SUBSIDY` if platform covers (rare)

---

## 12. Chargebacks

### 12.1 Chargeback Handling

```ts
async function handleChargeback(paymentId: string): Promise<void> {
  const order = await getOrderByPayment(paymentId);
  
  // Apply hold immediately
  await applyPayoutHold(order.sellerId, order.id, "CHARGEBACK");
  
  // Create dispute case
  await createDisputeCase({
    orderId: order.id,
    type: "CHARGEBACK",
    amountCents: order.totalCents,
  });
  
  // Collect evidence automatically
  await collectChargebackEvidence(order.id);
  
  // Notify seller
  await notifySeller(order.sellerId, "CHARGEBACK_RECEIVED", { orderId: order.id });
}
```

### 12.2 Seller Protection (Chargebacks)

Seller protected from chargebacks if:
- Valid tracking provided
- Delivery confirmed to buyer's address
- Evidence submitted on time
- No prior seller issues with this order

---

## 13. Platform Settings

| Setting | Default | Description |
|---------|---------|-------------|
| CLAIM_WINDOW_DAYS_DEFAULT | 30 | Default claim window |
| CLAIM_WINDOW_DAYS_COUNTERFEIT | 180 | Counterfeit claim window |
| SELLER_RESPONSE_DEADLINE_HOURS | 72 | Seller must respond within |
| APPEAL_WINDOW_DAYS | 30 | Days to file appeal |
| AUTO_REFUND_MAX_CENTS | 10000 | Auto-approve threshold ($100) |
| PROTECTION_SCORE_CLAIM_PENALTY | 5 | Points lost per claim lost |
| PROTECTION_SCORE_APPEAL_WIN_BONUS | 3 | Points gained per appeal won |
| APPEAL_REVIEW_SLA_HOURS | 48 | Appeal review deadline |
| DEFAULT_COVERAGE_LIMIT_CENTS | 500000 | Default max coverage ($5,000) |
| MAX_CLAIMS_PER_BUYER_90_DAYS | 5 | Abuse detection threshold |
| MAX_RESTOCKING_FEE_BPS | 1500 | Max 15% restocking fee |

---

## 14. RBAC & Permissions

| Action | Permission |
|--------|------------|
| Open claim | buyer (self) |
| Add evidence to claim | buyer (self), seller (self) |
| Respond to claim | seller (self) |
| Escalate claim | buyer (self) |
| Resolve claim | seller (self), support |
| File appeal | seller (self) |
| Review appeal | support, trust |
| Configure category limits | protection.admin |
| View protection analytics | analytics.view |
| Force refund | support, trust |
| Apply/release hold | finance |

---

## 15. Health Checks

| Check | Pass Condition |
|-------|----------------|
| Expired seller deadlines | <10 claims past 72h without response |
| Escalated claims backlog | <50 escalated claims >48h old |
| Pending refunds | <20 approved refunds not processed in 24h |
| Appeal review backlog | <25 appeals past 48h SLA |
| Protection score freshness | All scores computed in last 24h |

---

## 16. Audit Requirements

**Must emit audit events:**
- Claim opened/updated/resolved
- Evidence added
- Claim escalated
- Refund issued/reversed
- Appeal filed/decided
- Hold applied/released
- Category limit changed
- Protection score adjusted (manual)

---

## 17. Integration Points

| System | Integration |
|--------|-------------|
| Orders | Link claims to orders |
| Payments | Process refunds, handle chargebacks |
| Notifications | Claim updates, appeal decisions |
| Shipping | Return labels, tracking verification |
| Seller Standards | Factor claim rate into metrics |
| Ledger | Record refund entries |
| Analytics | Protection metrics dashboard |

---

## 18. Out of Scope

- Legal arbitration
- Insurance products beyond protection
- Cross-border dispute laws
- Payment processor arbitration

---

## 19. Final Rule

Buyer protection exists to:
- **Build trust** so buyers shop confidently
- **Protect sellers** from false claims through evidence and appeals
- **Maintain platform integrity** through consistent rules

**If behavior is not defined here, it must be escalated or added to this canonical.**
