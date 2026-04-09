# TWICELY_POLICY_LIBRARY_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Policy catalog, prohibited/restricted items, messaging rules, return policies, promotions, and enforcement mapping.  
**Audience:** Trust & Safety, support, product, AI agents.

---

## 1. Purpose

This canonical lists the policy categories enforced by Twicely.
It is referenced by Trust & Safety systems to ensure enforcement is consistent.

---

## 2. Core Principles

1. **Clear categories**
2. **Consistent enforcement mapping**
3. **Policy changes are versioned and effective-dated**
4. **Rules must be explainable**
5. **Templates standardize seller policies**

---

## 3. Policy Categories

### 3.1 Prohibited Items (always disallowed)
- illegal goods
- stolen goods
- weapons and weapon parts (restricted by law)
- counterfeit goods
- controlled substances
- hazardous materials

### 3.2 Restricted Items (allowed with constraints)
- luxury goods (auth signals required for high value)
- electronics with safety requirements (future)
- branded items (IP monitoring)
- alcohol (age verification, licensed sellers)
- recalled items (blocked)

### 3.3 Content & Messaging
- no off-platform contact info
- no harassment or hate speech
- no fraud attempts
- no spam or misleading listings
- no keyword stuffing

### 3.4 Return Policies

Platform maintains return policy templates that sellers must use.

```ts
type ReturnPolicyTemplate = {
  id: string;
  name: string;
  description?: string;
  isDefaultPolicy: boolean;
  
  // Return window
  returnWindow: "NO_RETURNS" | "DAYS_7" | "DAYS_14" | "DAYS_30" | "DAYS_60" | "DAYS_90";
  
  // Conditions
  acceptedConditions: ("ANY_REASON" | "DEFECTIVE_ONLY" | "NOT_AS_DESCRIBED" | "DAMAGED_IN_SHIPPING")[];
  
  // Shipping
  returnShippingPaidBy: "BUYER" | "SELLER" | "PLATFORM";
  freeReturnShipping: boolean;
  
  // Refund
  refundMethods: ("ORIGINAL_PAYMENT" | "STORE_CREDIT" | "EXCHANGE_ONLY")[];
  restockingFeePct: number;  // 0-100
  
  // Requirements
  requireOriginalPackaging: boolean;
  requireTags: boolean;
  requireUnused: boolean;
  
  // Exclusions
  excludedCategories: string[];
  
  isActive: boolean;
};
```

#### Return Policy Rules
- Sellers select from approved templates
- Custom policies require admin approval
- Policy displayed on listing and at checkout
- One template marked as platform default
- Final sale items must be clearly marked

### 3.5 Promotions

Platform and sellers may run promotions with defined rules.

```ts
type PromotionTemplate = {
  id: string;
  name: string;
  
  // Type
  type: "PERCENT_OFF" | "FIXED_AMOUNT_OFF" | "FREE_SHIPPING" | "BUY_X_GET_Y" | "BUNDLE_DISCOUNT";
  
  // Scope
  scope: "PLATFORM_WIDE" | "CATEGORY" | "SELLER" | "LISTING";
  
  // Discount
  discountValue: number;      // Percentage (1-100) or cents
  minOrderCents?: number;     // Minimum order value
  maxDiscountCents?: number;  // Cap for percentage discounts
  
  // Limits
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  
  // Schedule
  startsAt?: Date;
  endsAt?: Date;
  
  // Status
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELED";
  
  // Stacking
  stackable: boolean;
  priority: number;
};
```

#### Promotion Rules
- Platform promotions take precedence
- Seller promotions apply to their listings only
- Non-stackable promotions: best discount wins
- Stackable promotions: apply in priority order
- Promotion codes are case-insensitive
- One code per order (unless stackable)

---

## 4. Enforcement Mapping

| Violation | Listing Action | Account Action |
|---|---|---|
| Prohibited item | remove | restrict/suspend |
| Counterfeit | remove | suspend/ban |
| Harassment | n/a | restrict/suspend |
| Off-platform contact | warn/remove message | restrict |
| Spam/keyword stuffing | remove | warn/restrict |
| Policy abuse | case-by-case | warn/restrict |
| Return abuse | n/a | restrict returns |
| Promotion abuse | void promotion | restrict |

---

## 5. Policy Versioning

Policies must include:
- `policyVersion`
- `effectiveAt`
- change summary

```ts
type PolicyVersion = {
  version: string;
  effectiveAt: Date;
  changes: string[];
  approvedBy: string;
};
```

---

## 6. Appeals

Appeals follow Trust & Safety canonical.
Policy references must be attached to decisions.

Appeal flow:
1. User submits appeal with evidence
2. Review by Trust & Safety
3. Decision with policy citation
4. Final decision (no further appeals for same incident)

---

## 7. Buyer Protection Policy

Buyers are protected when:
- Payment made on-platform
- Dispute opened within window (14 days from delivery)
- Valid reason provided

Protection covers:
- Item not received
- Item not as described
- Damaged in shipping
- Counterfeit item

Protection limits:
- Max 3 protection claims per 90 days
- Abuse results in restriction

---

## 8. Seller Standards Policy

Sellers must maintain:
- Late shipment rate < 5%
- Cancellation rate < 2%
- Return rate < 10%
- Response time < 24 hours

Violations result in:
- Warnings
- Visibility reduction
- Payout holds
- Account restriction

---

## 9. RBAC

| Action | Permission |
|---|---|
| View policies | public |
| Create return template | settings.returns.edit |
| Create promotion | settings.promotions.edit |
| Enforce policy | trust.enforce |
| Override enforcement | admin |

---

## 10. Audit Requirements

Audit events for:
- Policy template created/updated
- Enforcement action taken
- Appeal submitted/decided
- Promotion created/activated

---

## 11. Out of Scope

- Legal compliance by jurisdiction
- Tax policy
- International trade rules

---

## 12. Final Rule

Policies are enforced to **protect the marketplace**.

If a rule is not in this library, it cannot be enforced.
