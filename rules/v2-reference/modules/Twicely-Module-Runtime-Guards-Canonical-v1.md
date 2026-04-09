# TWICELY — MODULE RUNTIME GUARDS & ENFORCEMENT CANONICAL (v1)

## PURPOSE
Define **code-level guards** that enforce module safety and prevent drift.
These guards make the canonical rules executable at runtime.

This is platform-level infrastructure that modules plug into.

---

## A) MODULE LOADER GUARDS (PLATFORM)

### 1) Manifest Validation (REQUIRED)
On module load/install/update, validate:
- manifest exists
- id matches folder
- semver valid
- platformCompatibility satisfied
- no path traversal in zip

If invalid: refuse to load/register.

### 2) Sandbox File Writes (RECOMMENDED)
During install/update:
- restrict writes to `modules/<id>/...`
- deny attempts to write outside target directory

### 3) Permission Enforcement (REQUIRED)
Centralized server guard for admin actions:
- validate PermissionContext (userId, businessProfileId?)
- enforce SUPER_ADMIN on uninstall/update/disable/install

### 4) Safe SQL Guard (REQUIRED)
If module provides SQL scripts:
- scan for forbidden statements in non-purge paths:
  - DROP, TRUNCATE, DELETE (without WHERE), ALTER COLUMN DROP, etc.
- refuse execution if detected

---

## B) MODULE STATE MACHINE (PLATFORM)

Define states:
- INSTALLED_ENABLED
- INSTALLED_DISABLED
- MISSING
- INCOMPATIBLE
- FAILED_INSTALL
- FAILED_UPDATE

Rules:
- Only enabled modules can mount UI/hooks/schedulers.
- Disabled modules are inert.
- Missing modules must not crash platform.

---

## C) HEALTH / DOCTOR GUARDS (PLATFORM)

### Health Provider Contract Enforcement (REQUIRED)
Validate provider outputs:
- status in PASS/WARN/FAIL/UNKNOWN
- ranAt ISO
- checks array with id/label/status

If invalid: mark provider UNKNOWN and log error.

### Stale Snapshot Guard (REQUIRED)
If last snapshot older than staleAfterHours:
- treat as UNKNOWN
- show grey tile

---

## D) MODULE UPDATE SAFETY GUARDS (PLATFORM)

### 1) Settings Backward Compatibility Guard (REQUIRED)
Provider settings must:
- have defaults for new fields
- ignore unknown fields (passthrough)

If provider throws parsing error:
- set provider status UNKNOWN
- do not block platform

### 2) Version Drift Visibility (REQUIRED)
Store and display:
- installed version
- last snapshot providerVersion

If mismatch:
- show “version drift” badge

---

## E) UNINSTALL SAFETY GUARDS (PLATFORM)

### Non-destructive default (REQUIRED)
Uninstall must never purge data unless:
- purge flag is explicitly set
- double confirmation completed
- SUPER_ADMIN authorized

### Purge guardrails (RECOMMENDED)
Require:
- typed module id confirmation
- second modal confirmation
- server-side verification

---

## F) STANDARD REPORT OBJECTS (PLATFORM)

For any action (install/update/disable/uninstall), produce a report:
```ts
export type ModuleActionReport = {
  action: "install" | "update" | "disable" | "enable" | "uninstall" | "purge";
  moduleId: string;
  fromVersion?: string;
  toVersion?: string;
  userId: string;
  timestamp: string; // ISO
  success: boolean;
  errors?: Array<{ code: string; message: string; details?: any }>;
  logs?: string[]; // redacted
};
```

UI must allow:
- copy report
- download report JSON

---

## G) ENFORCEMENT SUMMARY
If these guards are implemented, the platform enforces:
- safe installs
- safe updates
- safe uninstalls
- predictable module lifecycle
- provider-driven health without coupling

END OF CANONICAL
