# TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Returns, refunds, disputes, chargebacks, and seller protections.  
**Audience:** Trust & Safety, payments, support, and AI agents.

---

## 1. Purpose

This canonical defines **how Twicely resolves problems after a sale**.
It ensures:
- fairness to buyers
- predictability for sellers
- financial integrity for the platform

---

## 2. Core Principles

1. **Clear windows**
2. **Evidence-based decisions**
3. **Ledger-first accounting**
4. **Escalation before punishment**
5. **Audit everything**

---

## 3. Return Eligibility (v1)

### 3.1 Eligible Reasons
- Item not as described
- Damaged in transit
- Wrong item received

### 3.2 Ineligible
- Buyer remorse (unless seller allows)
- Final-sale items

---

## 4. Return Flow

1. Buyer opens return request
2. Seller reviews
3. Item shipped back (if applicable)
4. Seller receives item
5. Refund decision executed

```ts
function openReturn(orderId: string, reason: ReturnReason) {
  assertWithinReturnWindow(orderId);
  createReturnCase(orderId, reason);
}
```

---

## 5. Refund Rules

### 5.1 Timing
- Refunds issued only after:
  - item received, or
  - platform adjudication

### 5.2 Ledger Impact
- Refund creates:
  - REFUND_DEBIT (seller)
  - refund event to payment provider

---

## 6. Disputes & Chargebacks

### 6.1 Dispute Triggers
- Payment provider notification
- Buyer escalation

### 6.2 Platform Actions
- Apply payout hold
- Collect evidence
- Respond to provider

---

## 7. Holds

- Holds may be applied for:
  - disputes
  - risk flags
  - repeated issues
- Holds block payouts, not sales

---

## 8. Seller Protections

Seller protected if:
- tracking provided
- delivery confirmed
- evidence submitted on time

---

## 9. Enforcement Ladder

1. Warning
2. Restriction
3. Suspension

Applied only after review.

---

## 10. RBAC & Permissions

| Action | Permission |
|---|---|
| Approve return | owner or delegated |
| Force refund | support |
| Apply hold | finance |
| Suspend seller | trust |

---

## 11. Audit Requirements

Audit events required for:
- refunds
- holds
- dispute outcomes
- enforcement actions

---

## 12. Out of Scope

- Arbitration
- Legal proceedings
- Insurance products

---

## 13. Final Rule

Disputes exist to **resolve issues, not punish sellers by default**.

If behavior is not defined here, it must be escalated or versioned.
