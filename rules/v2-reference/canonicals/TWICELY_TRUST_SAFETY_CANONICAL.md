# TWICELY_TRUST_SAFETY_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Reports, moderation, enforcement, appeals, and safety controls.  
**Audience:** Trust & Safety, support, platform, AI agents.

---

## 1. Purpose

This canonical defines **how Twicely enforces trust** across buyers, sellers, and content.

---

## 2. Core Principles

1. **Policy-driven enforcement**
2. **Escalation before punishment**
3. **Evidence over emotion**
4. **Audit everything**
5. **Platform safety > individual outcomes**

---

## 3. Report Types

| Type | Target |
|---|---|
| Listing violation | Listing |
| Seller misconduct | Seller |
| Buyer abuse | Buyer |
| Message abuse | Message |

---

## 4. Enforcement Ladder

1. Warning
2. Restriction
3. Suspension
4. Permanent ban

Escalation requires justification and audit.

---

## 5. Listing Enforcement

Actions:
- hide listing
- remove listing
- restrict edits

```ts
function enforceListing(listingId: string, action: EnforcementAction) {
  requirePermission("trust.enforce");
  applyAction(listingId, action);
}
```

---

## 6. Account Enforcement

- Selling restrictions
- Buying restrictions
- Full suspension

Restrictions may be partial or total.

---

## 7. Appeals

- One appeal per action
- Evidence required
- Reviewed by separate staff

---

## 8. Automation

- Risk signals generate flags
- Flags never auto-ban
- Human review required for high impact actions

---

## 9. RBAC

| Action | Permission |
|---|---|
| Review reports | trust |
| Enforce actions | trust |
| Approve permanent ban | trust_admin |

---

## 10. Final Rule

Trust systems exist to **protect the ecosystem, not optimize individual happiness**.
