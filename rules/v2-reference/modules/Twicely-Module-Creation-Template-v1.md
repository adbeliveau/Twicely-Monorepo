# TWICELY -- MODULE CREATION TEMPLATE & BUILD INSTRUCTIONS (v1)

This document is a **copy-paste, execution-ready template** for building any Twicely module.
It defines **exact files, folders, contracts, and rules** required for a safe, installable, update-safe, uninstallable module.

This file is designed for:
- Human developers
- AI agents generating modules
- Automated installers

If anything here conflicts with platform core rules, **platform core always wins**.

---

## REQUIRED FOLDER STRUCTURE

```
modules/<module-slug>/
- " -- -- manifest.json
- " -- -- README.md
- " -- -- install.ts
- " -- -- uninstall.ts
- " -- -- src/
- -- " -- -- index.ts
- -- " -- -- permissions.ts
- -- " -- -- doctor/
- -- -- " -- -- types.ts
- -- -- -- -- -- runDoctor.ts
- -- " -- -- health/ # OPTIONAL
- -- -- " -- -- provider.ts
- -- -- -- -- -- ui.tsx
- -- " -- -- api/ # OPTIONAL (admin-only)
- -- -- -- -- ui/ # OPTIONAL (admin pages)
- -- -- -- migrations/ # OPTIONAL (CREATE IF NOT EXISTS only)
```

Rules:
- Everything stays inside this folder
- No node_modules, no secrets, no binaries
- Module must function if removed or disabled

---

## manifest.json (REQUIRED)

```json
{
 "id": "<module-slug>",
 "label": "Human Module Name",
 "version": "1.0.0",
 "platformCompatibility": ">=1.0.0",
 "requires": [],
 "provides": []
}
```

Rules:
- `id` is immutable
- Use semantic versioning
- No logic in manifest

---

## src/permissions.ts (REQUIRED)

```ts
export const MODULE_PERMISSIONS = {
 moduleId: "<module-slug>",
 permissions: [
 { code: "<module-slug>.view", name: "View module" },
 { code: "<module-slug>.manage", name: "Manage module" }
 ],
} as const;
```

Rules:
- Permissions are registered idempotently
- Never overwrite custom roles

---

## install.ts (REQUIRED, SAFE)

```ts
import { MODULE_PERMISSIONS } from "./src/permissions";

export async function installModule(ctx: {
 db: any;
 rbac: any;
 logger: any;
}) {
 await ctx.rbac.registerPermissions(MODULE_PERMISSIONS);

 // Optional SQL (CREATE IF NOT EXISTS only)
 // await ctx.db.exec(sql);

 await ctx.rbac.registerModule?.({
 id: MODULE_PERMISSIONS.moduleId,
 version: "1.0.0",
 });

 return { ok: true };
}
```

Hard rules:
- No prisma db push
- No destructive SQL
- Must be safe to re-run

---

## uninstall.ts (REQUIRED, NON-DESTRUCTIVE)

```ts
export async function uninstallModule(ctx: {
 db: any;
 logger: any;
 options?: {
 purgeData?: boolean;
 purgeSettings?: boolean;
 };
}) {
 await ctx.db?.disableModule?.("<module-slug>");

 if (ctx.options?.purgeSettings) {
 await ctx.db?.deleteModuleSettings?.("<module-slug>");
 }

 if (ctx.options?.purgeData === true) {
 // Dangerous path -- SUPER_ADMIN + double confirm only
 // DROP TABLE allowed ONLY here
 }

 return { ok: true };
}
```

Rules:
- Default uninstall never deletes data
- Purge is explicit and optional

---

## src/index.ts (REQUIRED)

```ts
export function initModule(ctx: {
 db: any;
 rbac: any;
 logger: any;
}) {
 // Register hooks, UI, schedulers
 // Must tolerate missing dependencies

 return {
 id: "<module-slug>",
 version: "1.0.0",
 };
}
```

---

## Doctor System (RECOMMENDED / REQUIRED FOR RUNTIME MODULES)

### src/doctor/types.ts

```ts
export type DoctorStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";

export type DoctorCheck = {
 id: string;
 label: string;
 status: "PASS" | "WARN" | "FAIL";
 message?: string;
};

export type DoctorReport = {
 moduleId: string;
 status: DoctorStatus;
 summary: string;
 ranAt: string;
 checks: DoctorCheck[];
};
```

### src/doctor/runDoctor.ts

```ts
import type { DoctorReport, DoctorCheck } from "./types";

export async function runDoctor(): Promise<DoctorReport> {
 const checks: DoctorCheck[] = [];

 // Add read-only checks here

 const status =
 checks.some(c => c.status === "FAIL") ? "FAIL":
 checks.some(c => c.status === "WARN") ? "WARN":
 "PASS";

 return {
 moduleId: "<module-slug>",
 status,
 summary: "Doctor run complete",
 ranAt: new Date().toISOString(),
 checks,
 };
}
```

Rules:
- Doctor is read-only
- No auto-fix
- Must never crash

---

## System Health Provider (OPTIONAL)

### src/health/provider.ts

```ts
import { runDoctor } from "../doctor/runDoctor";

export const healthProvider = {
 id: "<module-slug>",
 label: "Human Module Name",
 run: async ({ runType }: any) => {
 const report = await runDoctor();
 return {
 providerId: "<module-slug>",
 status: report.status,
 summary: report.summary,
 providerVersion: "1.0.0",
 ranAt: report.ranAt,
 runType,
 checks: report.checks,
 };
 },
 settings: {
 schema: null,
 defaults: { enabled: true, frequency: "hourly" },
 },
 ui: {
 SettingsPanel: () => null,
 DetailPage: () => null,
 },
};
```

---

## migrations (OPTIONAL)

```sql
CREATE TABLE IF NOT EXISTS <module_slug>_settings (
 id TEXT PRIMARY KEY,
 settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Forbidden outside purge:
- DROP
- TRUNCATE
- DELETE without WHERE

---

## README.md (REQUIRED)

Must include:
- Module purpose
- Permissions
- Install behavior
- Uninstall behavior
- Install prompt

```md
### Install Prompt
1. Upload module ZIP
2. Confirm permissions
3. Click Install
4. Run Doctor
```

---

## ZIP PACKAGING RULES

ZIP must contain:
- modules/<module-slug>/ only
- No secrets
- No node_modules

---

## FINAL GUARANTEES

A valid module:
- Installs safely
- Updates without data loss
- Uninstalls without breaking platform
- Never locks out SUPER_ADMIN
- Never assumes another module exists

END OF TEMPLATE
