# TWICELY V2 â€” Meta Governance Canonical (Items 1â€“4)
**Status:** LOCKED (v1.1)  
**Scope:** Platform-level governance required for a production-grade marketplace.  
**Applies to:** Phases 0-44 + Operational Glue  
**Rule:** These are mandatory and enforced by Doctor.

> Place this file in: `/rules/canonicals/TWICELY_V2_META_GOVERNANCE_CANONICAL.md`

---

## 1) Master Doctor (Single Source of Truth)

### Purpose
Doctor is the ONLY authority that determines whether the platform is install-complete and deployable.

### Rules
- Every phase MUST register checks
- Any failure = hard stop
- No bypass flags

### TypeScript
```ts
export type DoctorCheck = {
  id: string;
  phase: number;
  description: string;
  run(): Promise<{ ok: boolean; message?: string }>;
};

export async function runDoctor(checks: DoctorCheck[]) {
  const failures: string[] = [];
  for (const c of checks) {
    const res = await c.run();
    if (!res.ok) failures.push(`${c.id}:${c.message ?? "FAILED"}`);
  }
  if (failures.length) {
    throw new Error(`DOCTOR_FAIL:\n${failures.join("\n")}`);
  }
}
```

### Required Domains
- Environment & secrets
- Database & migrations
- RBAC & scopes
- Listings, orders, search
- Ledger, payouts, refunds
- Trust, safety, disputes
- Seller Hub & Corp Admin
- Health providers & glue

---

## 2) Formal Freeze (V2 Lock)

### Purpose
Prevent architectural drift after V2 is declared complete.

### Rules
- Phase order 0-44 is immutable
- Operational Glue is mandatory
- No new domains without version bump

### TypeScript
```ts
export const V2_FREEZE = {
  marketplaceVersion: "v2",
  phases: { min: 0, max: 44 },
  glueRequired: true,
  frozenAt: "2025-01",
} as const;

export function assertFrozen(version: string) {
  if (version !== V2_FREEZE.marketplaceVersion) {
    throw new Error("FREEZE_VIOLATION");
  }
}
```

---

## 3) Canonical Index Enforcement

### Purpose
Guarantee no partial installs or missing system law.

### Rules
- Marketplace Index lists ALL canonicals
- Installer MUST stop if any are missing
- Canonicals are immutable inputs

### TypeScript
```ts
export function assertCanonicalSet(expected: string[], found: string[]) {
  const missing = expected.filter(e => !found.includes(e));
  if (missing.length) {
    throw new Error(`MISSING_CANONICALS:${missing.join(",")}`);
  }
}
```

### Installer Behavior
- Load index
- Resolve filesystem
- Validate completeness
- Abort on mismatch

---

## 4) Minimal Operations Runbook

### Purpose
Ensure safe operation during incidents without improvisation.

### Global Kill Switch
```ts
export function assertPlatformEnabled() {
  if (process.env.PLATFORM_DISABLED === "true") {
    throw new Error("PLATFORM_DISABLED");
  }
}
```

### Emergency Actions
- Disable checkout & payouts
- Leave read-only views online
- Notify ops via audit log

### Recovery Checklist
- Re-run Doctor
- Reconcile ledger
- Reindex search
- Verify payouts queue empty

---

# END CANONICAL â€” META GOVERNANCE (1â€“4)
