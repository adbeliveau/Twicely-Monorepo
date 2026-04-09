# TWICELY V3 — Buyer Protection Canonical

**Version:** v1.0 | **Date:** 2026-02-17 | **Status:** LOCKED

---

## 1. PROTECTION TIERS

| Tier | Coverage | Claim Window |
|------|----------|-------------|
| Standard | Full refund + return shipping | 30 days from delivery |
| Counterfeit | Full refund + return shipping + seller strike | 60 days from delivery |
| Local (In-App) | Full refund if INAD | 7 days from QR confirmation |
| Local (Cash) | None | N/A |
| Authenticated | Full refund + cert void + strike | 90 days from delivery |

---

## 2. CLAIM FLOWS

### Standard (INAD / DAMAGED / WRONG_ITEM)
1. Buyer files claim → uploads photos → selects reason
2. System assigns `returnReasonBucket` (SELLER_FAULT, BUYER_REMORSE, PLATFORM_CARRIER_FAULT, EDGE_CONDITIONAL)
3. Seller has 72 hours to respond (ACCEPT / PARTIAL / DISPUTE)
4. No response → auto-approved in buyer's favor
5. If partial offered → buyer accepts or declines → if declines, escalated
6. Return shipped → condition inspected → refund issued or CONDITION_DISPUTE

### INR (Item Not Received)
1. Expected delivery + 3 business days → buyer can file
2. System checks tracking: DELIVERED → buyer prompted to check surroundings, can insist → escalated. IN_TRANSIT → wait. LOST → auto-approve. No tracking → seller fault → auto-approve.
3. 7+ days past delivery estimate → auto-approve

### Counterfeit
1. Buyer files within 60 days → MUST provide photo evidence
2. System records: was auth offered at checkout? Did buyer decline? Seller badges? Twicely auth?
3. Seller has 5 business days to respond (longer window)
4. Support reviews → CONFIRMED (full refund + strike) / DENIED / INCONCLUSIVE (platform absorbs)

---

## 3. COVERAGE LIMITS

| Limit | Amount |
|-------|--------|
| Single claim max | $25,000 (above → manual review) |
| Per buyer per 90 days | $50,000 |
| Shipping reimbursement | Actual return label cost |

**Exclusions:** Cash local, buyer-modified items, "for parts" listings claimed defective, final sale items (remorse only).

---

## 4. FEE ALLOCATION ON RETURNS

| Bucket | Return Shipping | Refund | Restocking | TF Treatment |
|--------|----------------|--------|------------|--------------|
| SELLER_FAULT | Seller | Full | 0% | Twicely keeps original |
| BUYER_REMORSE | Buyer | Full - restocking | Up to 15% | Twicely keeps original |
| PLATFORM_CARRIER_FAULT | Platform | Full | 0% | Full refund to seller |
| EDGE_CONDITIONAL | Negotiated | Negotiated | Negotiated | Case-by-case |

**Critical:** On partial refunds, Twicely keeps TF calculated on FULL sale price. Prevents gaming.

---

## 5. SELLER PROTECTION SCORE

Ranges: EXCELLENT (90-100), GOOD (70-89), FAIR (50-69), POOR (0-49).

**Inputs:** on-time shipping (25%), response time (15%), INAD rate (25%), return rate (15%), counterfeit rate (10%), buyer satisfaction (10%).

| Score | Effect |
|-------|--------|
| EXCELLENT | Benefit of doubt, all claims manually reviewed |
| GOOD | Standard |
| FAIR | Auto-approve if seller non-responsive at 48hr |
| POOR | Auto-approve immediately with evidence |

---

## 6. AUTHENTICATION PROGRAM

### Three Tiers
- **Tier 1: Verified Seller** (FREE) — KYC + sourcing docs. Badge on profile. At launch.
- **Tier 2: AI** ($19.99) — Photo-based AI. Deferred to post-launch.
- **Tier 3: Expert Human** ($39.99–$69.99) — Physical inspection + certificate. At launch.

### Cost Split (Buyer-Initiated)
- Authentic → 50/50 ($9.99 each), seller share deducted from THIS payout
- Counterfeit → seller pays all + strike
- Inconclusive → Twicely absorbs

### Certificate System
- Unique `TW-AUTH-XXXXX`, tied to listingId + authRequestId
- Does NOT transfer on relist
- Public verify: `twicely.co/verify/TW-AUTH-XXXXX`
- pHash photo fingerprinting to detect certificate fraud

### External Auth Policy
- Never recognized for Twicely badges. Disclaimer shown. Buyer nudged to Twicely auth.

### Liability Boundaries
- Twicely = facilitator, NOT authenticator
- Disclaimers required on every badge/certificate/listing page
- Three layers: buyer declination record, third-party liability insurance, ToS limitation (max = purchase price refund)

---

## 7. CHARGEBACK HANDLING

1. Received → freeze seller payout for disputed amount (Day 0)
2. Evidence gathered (order, tracking, comms, auth records) (Day 0-3)
3. Submitted to Stripe (Day 3-5)
4. Stripe decides (Day 30-75): win = unfreeze; lose = debit seller
5. $15 chargeback fee passed to seller if upheld
6. 3+ chargebacks in 90 days → account restricted

---

## 8. PLATFORM SETTINGS

```
protection.standardClaimWindowDays: 30
protection.counterfeitClaimWindowDays: 60
protection.authenticatedClaimWindowDays: 90
protection.localClaimWindowDays: 7
protection.maxClaimAmountCents: 2500000
protection.maxBuyerClaimsPerQuarter: 5000000
protection.sellerResponseHours: 72
protection.counterfeitResponseBusinessDays: 5
protection.autoApproveOnNonResponse: true
protection.chargebackFeeCents: 1500
protection.maxRestockingFeePercent: 15
```
