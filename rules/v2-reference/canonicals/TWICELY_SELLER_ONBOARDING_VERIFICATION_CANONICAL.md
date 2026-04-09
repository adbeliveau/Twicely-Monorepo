# TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Seller onboarding, payouts onboarding, identity/KYC status gates, and restrictions.  
**Audience:** Payments, ops, trust, engineering, AI agents.

---

## 1. Purpose

This canonical defines how Twicely onboards sellers safely:
- becoming a seller
- enabling payouts
- verification states
- restrictions when unverified

---

## 2. Core Principles

1. **Sell fast, get paid safely**
2. **Verification gates payouts more than listings**
3. **Progressive requirements** (start simple; tighten with risk/volume)
4. **State machines govern onboarding**

---

## 3. Seller States

| State | Meaning |
|---|---|
| SELLER_DRAFT | seller profile created |
| SELLER_ACTIVE | allowed to list and sell |
| PAYOUTS_PENDING | payouts onboarding incomplete |
| PAYOUTS_ENABLED | can receive payouts |
| RESTRICTED | limited actions |
| SUSPENDED | blocked |

---

## 4. Payout Onboarding Gates

### 4.1 Rules
- Seller may list and sell without payouts enabled (optional policy)
- Seller cannot receive payouts until payouts onboarding complete
- Funds remain pending until enabled or policy triggers refund/hold

```ts
function canReceivePayouts(seller: SellerProfile) {
  return seller.payoutStatus === "PAYOUTS_ENABLED";
}
```

---

## 5. Progressive Verification (v1)

Triggers for requiring stronger verification:
- high GMV threshold
- repeated disputes/chargebacks
- suspicious login/device
- payout destination changes

```ts
function requiresEnhancedVerification(ctx: RiskContext): boolean {
  return ctx.gmv30dCents > ctx.thresholdCents || ctx.chargebackCount30d > 0;
}
```

---

## 6. Restrictions

If payouts not enabled:
- listings allowed (optional)
- sales allowed
- payouts blocked
- seller shown onboarding prompts

If verification fails:
- restrict selling
- hold payouts
- escalate to trust review

---

## 7. RBAC

| Action | Permission |
|---|---|
| View KYC status | payouts.read |
| Override restrictions | trust |
| Change payout destination | seller (2FA recommended) |

---

## 8. Audit Requirements

Audit events required for:
- payout destination changes
- KYC status changes
- overrides/restrictions

---

## 9. Final Rule

Verification exists to **protect payouts and prevent fraud** without blocking legitimate sellers.
