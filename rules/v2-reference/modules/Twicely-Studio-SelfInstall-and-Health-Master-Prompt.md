# TWICELY STUDIO -- SELF-INSTALL MODULE + STUDIO HEALTH (MASTER PROMPT)

## ROLE
You are a senior systems engineer and product architect.

You are implementing **Twicely Studio** as a **self-installing, non-destructive module**
with **Studio Health (StudioDoctor)** integrated as a **provider** into the platform's
**System Health framework**.

You MUST follow all rules below exactly.
If a requirement conflicts with convenience, performance, or assumptions -- the requirement wins.

---

## ABSOLUTE CONSTRAINTS (DO NOT VIOLATE)

- DO NOT modify core platform schema
- DO NOT run `prisma db push`
- DO NOT auto-migrate destructive changes
- DO NOT mutate RBAC assignments
- DO NOT render raw Puck UI
- DO NOT embed Studio-specific logic inside platform System Health
- DO NOT auto-fix failures -- report only

Failure to comply is considered an invalid solution.

---

## ARCHITECTURAL TRUTH

- **System Health** is a platform-level framework
- **Studio Health** is a provider owned entirely by the Studio module
- **StudioDoctor** defines health logic
- **Platform System Health** controls scheduling, persistence, and dashboard UI
- Studio contributes:
 - health checks
 - settings schema
 - settings UI
 - detail UI

---

## DELIVERABLES

You must implement:

1. **Self-installing Studio module**
2. **StudioDoctor health engine**
3. **Studio Health provider**
4. **Provider-driven integration with System Health**
5. **Interactive Studio safety gate**
6. **Zero platform coupling**

---

## SELF-INSTALL MODULE REQUIREMENTS

Studio installs safely by:

- Using idempotent SQL (`CREATE IF NOT EXISTS`)
- Registering permissions idempotently
- Verifying dependencies via read-only checks
- Failing gracefully with diagnostics

Studio must include a `StudioDoctor` health pass before enabling editing.

---

## STUDIO HEALTH PROVIDER CONTRACT

Implement the following EXACT interface:

```ts
export type HealthStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";
export type HealthRunType = "interactive" | "scheduled" | "manual";

export type HealthCheckResult = {
 id: string;
 label: string;
 status: "PASS" | "WARN" | "FAIL";
 message?: string;
};

export type HealthResult = {
 providerId: "studio";
 status: HealthStatus;
 summary: string;
 providerVersion: string;
 ranAt: string;
 runType: HealthRunType;
 checks: HealthCheckResult[];
 details?: Record<string, any>;
};

export async function runStudioDoctor(args: {
 runType: HealthRunType;
}): Promise<HealthResult>;
```

---

## REQUIRED STUDIO HEALTH CHECKS (V1)

1. RBAC integrity
2. Block registry integrity
3. Editor shell enforcement
4. Preview/render parity

Failures must block editing.
Warnings may block publishing.

---

## SYSTEM HEALTH INTEGRATION RULES

- Studio registers itself as a provider
- Platform stores snapshots and settings
- Platform renders provider SettingsPanel + DetailPage
- Platform scheduler calls `runStudioDoctor({ runType: "scheduled" })`
- Studio NEVER writes to System Health tables directly

---

## INTERACTIVE STUDIO GATE

On `/admin/studio` entry:

1. Run `runStudioDoctor({ runType: "interactive" })`
2. If FAIL:
 - Do NOT mount editor
 - Show diagnostics screen
 - Provide link to System Health detail page
3. If WARN:
 - Allow editing
 - Block publish (configurable)
4. If PASS:
 - Load editor normally

---

## PROVIDER SETTINGS (STUDIO-OWNED)

Studio defines its own settings schema and defaults.
Platform treats settings as opaque JSON.

Studio MUST supply:
- settings schema
- default values
- SettingsPanel UI
- DetailPage UI

---

## UI ENFORCEMENT

- Studio UI MUST follow Elementor / WordPress mental model
- Puck MUST be wrapped in StudioShell
- No floating inspectors
- Right panel = document only

---

## VALIDATION

Your output is valid ONLY IF:

- Studio can be removed without breaking platform
- System Health has zero Studio-specific logic
- Studio Health appears as a tile in System Health
- Studio refuses to run when unsafe
- No silent failures exist

---

## FINAL INSTRUCTION

If you are unsure -- STOP.
Do not guess.
Do not assume.
Do not "improve" requirements.

Implement exactly.

END OF PROMPT
