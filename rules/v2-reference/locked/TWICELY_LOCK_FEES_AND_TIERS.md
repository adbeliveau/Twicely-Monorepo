# TWICELY_LOCK_FEES_AND_TIERS.md
## Authoritative Fee & Tier Definitions

**Version:** 1.0  
**Locked:** 2026-01-23  
**Authority:** This document is the single source of truth for all pricing, fees, and tier configurations.

---

## PRECEDENCE RULE

**Canonical Source:** `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`

All other documents must reference this canonical. Any deviation is a bug.

---

## 1. SELLER TIERS (eBay-Exact)

### 1.1 Tier Pricing Table

| Tier | Monthly Fee | Free Listings/Mo | Insertion Fee | FVF Rate | eBay Equivalent |
|------|-------------|------------------|---------------|----------|-----------------|
| **SELLER** | $0 | 250 | $0.35 | 13.25% | No store (casual seller) |
| **STARTER** | $4.95 | 250 | $0.30 | 12.35% | eBay Starter Store |
| **BASIC** | $21.95 | 1,000 | $0.25 | 11.5% | eBay Basic Store |
| **PRO** | $59.95 | 10,000 | $0.15 | 10.25% | eBay Pro Store |
| **ELITE** | $299.95 | 25,000 | $0.05 | 9.15% | eBay Elite Store |
| **ENTERPRISE** | $2,999.95 | 100,000 | $0.05 | 8.0% (negotiable) | eBay Enterprise Store |

**Source:** Monetization_CANONICAL:L42-49, L475-500

### 1.2 Staff Accounts by Tier

| Tier | Staff Accounts |
|------|----------------|
| SELLER | 0 |
| STARTER | 0 |
| BASIC | 2 |
| PRO | 5 |
| ELITE | 15 |
| ENTERPRISE | 100 |

**Source:** Monetization_CANONICAL:L73

### 1.3 Features by Tier

| Feature | SELLER | STARTER | BASIC | PRO | ELITE | ENTERPRISE |
|---------|--------|---------|-------|-----|-------|------------|
| Branded Storefront | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Store URL | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vacation Mode | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Basic Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Advanced Analytics | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Bulk Listing Tools | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Promoted Listings | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Scheduled Listings | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Markdown Manager | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Custom Categories | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Dedicated Rep | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Sales Events | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom Pages | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| API Rate Multiplier | 1x | 1x | 1x | 2x | 5x | 10x |

**Source:** Monetization_CANONICAL:L61-78

---

## 2. FEE CALCULATION RULES

### 2.1 Final Value Fee (FVF) Basis

**Rule:** FVF is calculated on **item price + shipping charged**, excluding taxes.

```
FVF = (itemPriceCents + shippingCents) × FVF_RATE
```

**Source:** Monetization_CANONICAL:L134

### 2.2 FVF Rate Constants

```typescript
const FVF_RATES: Record<SellerTier, number> = {
  SELLER: 0.1325,      // 13.25%
  STARTER: 0.1235,     // 12.35%
  BASIC: 0.115,        // 11.5%
  PRO: 0.1025,         // 10.25%
  ELITE: 0.0915,       // 9.15%
  ENTERPRISE: 0.08,    // 8.0%
};
```

**Source:** Monetization_CANONICAL:L475-482

### 2.3 Insertion Fee Constants

```typescript
const INSERTION_FEES: Record<SellerTier, number> = {
  SELLER: 35,      // $0.35 in cents
  STARTER: 30,     // $0.30 in cents
  BASIC: 25,       // $0.25 in cents
  PRO: 15,         // $0.15 in cents
  ELITE: 5,        // $0.05 in cents
  ENTERPRISE: 5,   // $0.05 in cents
};
```

**Source:** Monetization_CANONICAL:L484-491

### 2.4 Free Listing Allowance Constants

```typescript
const FREE_LISTINGS: Record<SellerTier, number> = {
  SELLER: 250,
  STARTER: 250,
  BASIC: 1000,
  PRO: 10000,
  ELITE: 25000,
  ENTERPRISE: 100000,
};
```

**Source:** Monetization_CANONICAL:L493-500

### 2.5 Rounding Rule

**Rule:** All fee calculations use `Math.round()` to nearest cent.

```typescript
export function calculateMarketplaceFee(
  saleAmountCents: number,
  tier: SellerTier
): number {
  const rate = FVF_RATES[tier];
  return Math.round(saleAmountCents * rate);
}
```

**Source:** Monetization_CANONICAL:L502-508

---

## 3. REQUIRED SERVICES

### 3.1 Service Signatures

```typescript
// Calculate FVF for an order
export function calculateMarketplaceFee(
  saleAmountCents: number,
  tier: SellerTier
): number;

// Get insertion fee for a tier
export function getInsertionFee(tier: SellerTier): number;

// Get free listing allowance for a tier
export function getFreeListingAllowance(tier: SellerTier): number;

// Check cap and determine insertion fee
export async function checkListingCapAndChargeFee(
  sellerId: string,
  tier: SellerTier
): Promise<{ allowed: boolean; insertionFeeCents: number }>;
```

**Source:** Monetization_CANONICAL:L502-540

---

## 4. EFFECTIVE-DATING RULES

### 4.1 Fee Schedule Versioning

- All fee schedules are **effective-dated**
- Changes do NOT retroactively alter past orders
- New schedules apply to orders created after `effectiveAt`

### 4.2 Storage Model

```prisma
model TierPricingVersion {
  id              String   @id @default(cuid())
  version         String   @unique
  effectiveAt     DateTime
  isActive        Boolean  @default(true)
  pricingJson     Json
  createdByStaffId String
  createdAt       DateTime @default(now())
  
  @@index([effectiveAt])
}
```

**Source:** schema.prisma:L1884-1896

---

## 5. TIER UPGRADE/DOWNGRADE RULES

### 5.1 Upgrade Rules

- **Immediate effect**
- Prorated billing for remaining period
- Features unlock immediately

### 5.2 Downgrade Rules

- **Effective at end of billing period**
- Features available until period ends
- Grace period: 7 days for failed payments before auto-downgrade

### 5.3 Listing Pause on Downgrade

- Excess listings paused (oldest first)
- Paused listings remain in system, not deleted

### 5.4 Staff Revocation on Downgrade

- Excess staff accounts revoked (newest first)
- Revoked staff lose access immediately

**Source:** Monetization_CANONICAL:L117-124

---

## 6. SELLER TYPE GATE (eBay-Exact)

### 6.1 Store Subscription Gate

| SellerType | Allowed Tiers |
|------------|---------------|
| PERSONAL | SELLER only |
| BUSINESS | SELLER, STARTER, BASIC, PRO, ELITE, ENTERPRISE |

### 6.2 Gate Rule

**PERSONAL sellers CANNOT subscribe to store tiers (STARTER+).**

To subscribe to a store:
1. User must upgrade sellerType to BUSINESS (free)
2. User must provide BusinessInfo
3. Then user can subscribe to STARTER+ tiers

**Source:** USER_MODEL_LOCKED:§3, §9

---

## 7. LEDGER POSTING RULES

### 7.1 On Sale (Order Paid)

Post these ledger entries:
1. `type=SALE, direction=CREDIT, amount=orderTotal`
2. `type=MARKETPLACE_FEE, direction=DEBIT, amount=fvfAmount`
3. `type=PROCESSING_FEE, direction=DEBIT, amount=stripeFee`
4. `type=TRANSFER, direction=DEBIT, amount=sellerNet` (when transfer executes)

### 7.2 Insertion Fee

Post on listing creation when over free allowance:
- `type=INSERTION_FEE, direction=DEBIT, amount=insertionFee`

### 7.3 Subscription Fee

Post monthly on billing:
- `type=SUBSCRIPTION_FEE, direction=DEBIT, amount=monthlyFee`

**Source:** Monetization_CANONICAL:L371-434

---

## SOURCE-OF-TRUTH REFERENCES

| Aspect | Source File | Lines |
|--------|-------------|-------|
| Tier Pricing | TWICELY_Monetization_CANONICAL_v1.md | L42-49 |
| FVF Rates | TWICELY_Monetization_CANONICAL_v1.md | L475-482 |
| Insertion Fees | TWICELY_Monetization_CANONICAL_v1.md | L484-491 |
| Free Listings | TWICELY_Monetization_CANONICAL_v1.md | L493-500 |
| Staff Limits | TWICELY_Monetization_CANONICAL_v1.md | L73 |
| Features Matrix | TWICELY_Monetization_CANONICAL_v1.md | L61-78 |
| FVF Basis | TWICELY_Monetization_CANONICAL_v1.md | L134 |
| Services | TWICELY_Monetization_CANONICAL_v1.md | L502-540 |
| Store Gate | TWICELY_USER_MODEL_LOCKED.md | §3, §9 |
| Tier Enum | TWICELY_V2_FREEZE_0_44_LOCKED.md | L184-191 |

---

**END OF LOCK SHEET**
