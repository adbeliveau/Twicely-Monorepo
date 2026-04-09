# TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Safe feature rollout, kill switches, experiments, and progressive delivery.  
**Audience:** Engineering, ops, product, AI agents.

---

## 1. Purpose

This canonical defines how Twicely ships changes safely with:
- feature flags
- staged rollouts
- kill switches
- controlled experiments

---

## 2. Core Principles

1. **Flags are runtime controls, not config sprawl**
2. **Every risky feature ships behind a flag**
3. **Kill switch must be instant**
4. **Flags are auditable**
5. **Defaults are safe**

---

## 3. Flag Model

```ts
type FlagScope = "global" | "user" | "seller" | "staff" | "percentage";

type FeatureFlag = {
  key: string;             // "checkout.new_flow"
  enabled: boolean;
  scope: FlagScope;
  percentage?: number;     // 0..100 if scope=percentage
  allowListUserIds?: string[];
  denyListUserIds?: string[];
  startsAt?: string;
  endsAt?: string;
  updatedByStaffId: string;
  updatedAt: string;
};
```

---

## 4. Evaluation Rules

Order of precedence:
1. denylist
2. allowlist
3. time window (starts/ends)
4. percentage rollout
5. global enabled

```ts
function isFlagEnabled(flag: FeatureFlag, ctx: { userId?: string; seed?: string }) {
  if (ctx.userId && flag.denyListUserIds?.includes(ctx.userId)) return false;
  if (ctx.userId && flag.allowListUserIds?.includes(ctx.userId)) return true;
  const now = Date.now();
  if (flag.startsAt && now < Date.parse(flag.startsAt)) return false;
  if (flag.endsAt && now > Date.parse(flag.endsAt)) return false;
  if (flag.scope === "percentage" && flag.percentage != null) {
    return hashToBucket(ctx.seed ?? ctx.userId ?? "anon") < flag.percentage;
  }
  return flag.enabled;
}
```

---

## 5. Kill Switches

Kill switches are flags with:
- scope=global
- enforced at critical code paths
- cached for immediate evaluation

Examples:
- disable checkout
- disable payouts execution
- disable listing activation

---

## 6. Experiments (v1 minimal)

Experiment = two or more variants behind flags.
Logging required:
- assignment
- exposure
- conversion events

---

## 7. Admin UI / Corp Hub

- `/corp/flags`
- create/update flags
- view audit log
- search by key

---

## 8. RBAC

**Authorization:** Feature flag management is governed by **PlatformRole** only.

| Action | Required Role |
|---|---|
| View flags | PlatformRole.ADMIN \| PlatformRole.DEVELOPER |
| Edit flags | PlatformRole.ADMIN \| PlatformRole.DEVELOPER |
| Use kill switches | PlatformRole.ADMIN |

**Note:** Do NOT use invented permission keys like `flags.read`, `flags.write`, or `flags.kill`. Use PlatformRole authorization only.

---

## 9. Final Rule

Flags exist to **prevent incidents**, not add complexity.
If a feature is risky and not flagged, it must not ship.
