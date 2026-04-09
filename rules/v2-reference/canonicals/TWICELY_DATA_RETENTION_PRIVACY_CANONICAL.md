# TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Data retention, deletion/deactivation rules, audit retention, and user data export basics.  
**Audience:** Engineering, ops, trust, legal, AI agents.  
**Non-Goal:** Legal advice or jurisdiction-specific compliance workflows.

---

## 1. Purpose

This canonical defines how Twicely stores and retains data safely:
- operational necessity
- security
- user trust

---

## 2. Core Principles

1. **Keep what we need; delete what we don't**
2. **Audit logs outlive user deletions**
3. **Deletions are soft by default**
4. **Exports are scoped and safe**

---

## 3. Retention Classes

| Data Type | Retention |
|---|---|
| Orders | 7 years (accounting integrity) |
| Ledger entries | 7 years |
| Audit events | 7 years |
| Messages | 2 years (configurable) |
| Search logs | 90 days (aggregated only) |
| Raw webhooks | 30 days |

---

## 4. Deactivation vs Deletion

### 4.1 Deactivation
- disables login/actions
- preserves history

### 4.2 Deletion (soft delete)
- removes public profile
- retains orders/ledger/audit

```ts
async function deleteUser(userId: string) {
  await markUserSoftDeleted(userId);
  await anonymizePublicFields(userId);
}
```

---

## 5. Data Export (v1)

User may request export of:
- profile
- orders summary
- listings summary

Exports must exclude:
- other users' PII
- internal risk signals
- staff notes

---

## 6. RBAC

| Action | Permission |
|---|---|
| View audit logs | audit.read |
| Process export request | support |
| Hard delete (rare) | admin only |

---

## 7. Final Rule

Retention exists to **protect integrity** while respecting users.
If retention policy is not defined here, it must not be implemented.
